import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useOfflineSyncContext } from "./useOfflineSync";

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutos
const APP_VERSION = "1.0.0";

interface HeartbeatData {
  equipe_id: string;
  app_version: string;
  plataforma: string;
  latitude?: number;
  longitude?: number;
  bateria_nivel?: number;
  conexao_tipo?: string;
}

/**
 * Hook para enviar heartbeat (ping) periodicamente ao servidor
 * Usado para detecção de conectividade real das equipes
 */
export function useHeartbeat() {
  const { equipe, temTurnoAberto } = useEquipeAuth();
  const { isOnline } = useOfflineSyncContext();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<Date | null>(null);

  // Detectar tipo de conexão
  const getConexaoTipo = useCallback((): string => {
    if (!navigator.onLine) return "offline";
    
    // @ts-ignore - navigator.connection pode não existir em todos os browsers
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType) return effectiveType; // '4g', '3g', '2g', 'slow-2g'
      
      const type = connection.type;
      if (type === "wifi") return "wifi";
      if (type === "cellular") return "4g";
    }
    
    return "unknown";
  }, []);

  // Obter nível de bateria (se disponível)
  const getBateriaNivel = useCallback(async (): Promise<number | undefined> => {
    try {
      // @ts-ignore - navigator.getBattery pode não existir
      if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        return Math.round(battery.level * 100);
      }
    } catch {
      // Ignorar erro se API não disponível
    }
    return undefined;
  }, []);

  // Obter localização atual
  const getLocalizacao = useCallback((): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    });
  }, []);

  // Detectar plataforma
  const getPlataforma = useCallback((): string => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/android/i.test(userAgent)) return "android";
    if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
    if (/windows/i.test(userAgent)) return "windows";
    if (/mac/i.test(userAgent)) return "macos";
    
    return "web";
  }, []);

  // Enviar heartbeat
  const enviarHeartbeat = useCallback(async () => {
    if (!equipe?.id || !isOnline) {
      console.log("[Heartbeat] Não enviando - equipe:", !!equipe?.id, "online:", isOnline);
      return;
    }

    try {
      const [localizacao, bateriaNivel] = await Promise.all([
        getLocalizacao(),
        getBateriaNivel(),
      ]);

      const heartbeatData: HeartbeatData = {
        equipe_id: equipe.id,
        app_version: APP_VERSION,
        plataforma: getPlataforma(),
        conexao_tipo: getConexaoTipo(),
        bateria_nivel: bateriaNivel,
        ...(localizacao && {
          latitude: localizacao.latitude,
          longitude: localizacao.longitude,
        }),
      };

      // Usar upsert para inserir ou atualizar
      const { error } = await supabase
        .from("equipe_heartbeat")
        .upsert(
          {
            equipe_id: heartbeatData.equipe_id,
            ultimo_ping: new Date().toISOString(),
            app_version: heartbeatData.app_version,
            plataforma: heartbeatData.plataforma,
            latitude: heartbeatData.latitude,
            longitude: heartbeatData.longitude,
            bateria_nivel: heartbeatData.bateria_nivel,
            conexao_tipo: heartbeatData.conexao_tipo,
          },
          { onConflict: "equipe_id" }
        );

      if (error) {
        // Se tabela não existe, não mostrar erro (pode ainda não ter sido criada)
        if (error.code !== "42P01") {
          console.error("[Heartbeat] Erro ao enviar:", error);
        }
        return;
      }

      lastHeartbeatRef.current = new Date();
      console.log("[Heartbeat] ✓ Enviado com sucesso", {
        equipe: equipe.codigo,
        conexao: heartbeatData.conexao_tipo,
        bateria: heartbeatData.bateria_nivel,
      });
    } catch (error) {
      console.error("[Heartbeat] Erro:", error);
    }
  }, [equipe?.id, equipe?.codigo, isOnline, getLocalizacao, getBateriaNivel, getPlataforma, getConexaoTipo]);

  // Iniciar/parar intervalo de heartbeat
  useEffect(() => {
    // Só enviar heartbeat se tem equipe logada e turno aberto
    if (!equipe?.id || !temTurnoAberto) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Enviar imediatamente ao iniciar
    enviarHeartbeat();

    // Configurar intervalo
    intervalRef.current = setInterval(enviarHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [equipe?.id, temTurnoAberto, enviarHeartbeat]);

  // Enviar heartbeat quando volta online
  useEffect(() => {
    if (isOnline && equipe?.id && temTurnoAberto) {
      // Pequeno delay para garantir que a conexão está estável
      const timeout = setTimeout(enviarHeartbeat, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, equipe?.id, temTurnoAberto, enviarHeartbeat]);

  // Enviar heartbeat antes de fechar o app (se possível)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (equipe?.id && isOnline) {
        // Usar sendBeacon para envio assíncrono que não bloqueia
        const data = JSON.stringify({
          equipe_id: equipe.id,
          ultimo_ping: new Date().toISOString(),
          conexao_tipo: "closing",
        });
        
        // Tentar enviar via sendBeacon (não bloqueia o fechamento)
        if (navigator.sendBeacon) {
          const blob = new Blob([data], { type: "application/json" });
          navigator.sendBeacon(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/registrar_heartbeat`,
            blob
          );
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [equipe?.id, isOnline]);

  return {
    enviarHeartbeat,
    ultimoHeartbeat: lastHeartbeatRef.current,
  };
}

export default useHeartbeat;
