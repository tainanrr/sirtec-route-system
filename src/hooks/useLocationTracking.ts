import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";

interface LocationTrackingOptions {
  enabled?: boolean;
  intervalMs?: number; // Intervalo entre envios (padrão: 30 segundos)
  highAccuracy?: boolean;
}

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  lastUpdate: Date | null;
  error: string | null;
  isTracking: boolean;
}

/**
 * Hook para rastreamento de localização em tempo real
 * Envia a posição da equipe para o banco de dados periodicamente
 */
export function useLocationTracking(options: LocationTrackingOptions = {}) {
  const {
    enabled = true,
    intervalMs = 30000, // 30 segundos
    highAccuracy = true,
  } = options;

  const { equipe, turno, temTurnoAberto } = useEquipeAuth();
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<Date | null>(null);
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    lastUpdate: null,
    error: null,
    isTracking: false,
  });

  // Função para enviar posição para o banco
  const sendPosition = useCallback(async (
    latitude: number,
    longitude: number,
    accuracy?: number,
    speed?: number,
    heading?: number
  ) => {
    if (!equipe?.id) {
      console.log("[LocationTracking] Sem equipe autenticada, ignorando envio");
      return false;
    }

    // Evitar enviar muito frequentemente
    const agora = new Date();
    if (lastSentRef.current) {
      const diffMs = agora.getTime() - lastSentRef.current.getTime();
      if (diffMs < intervalMs * 0.8) { // 80% do intervalo
        console.log("[LocationTracking] Enviado recentemente, ignorando");
        return false;
      }
    }

    try {
      console.log(`[LocationTracking] Enviando posição: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      
      const { error } = await supabase
        .from("tecnicos_posicoes")
        .insert({
          equipe_id: equipe.id,
          latitude,
          longitude,
          accuracy_m: accuracy || null,
          speed_mps: speed || null,
          heading_deg: heading || null,
          gps_ativo: true,
          app_state: temTurnoAberto ? "turno_aberto" : "sem_turno",
        });

      if (error) {
        console.error("[LocationTracking] Erro ao enviar posição:", error);
        return false;
      }

      lastSentRef.current = agora;
      console.log("[LocationTracking] ✅ Posição enviada com sucesso");
      return true;
    } catch (err) {
      console.error("[LocationTracking] Erro ao enviar posição:", err);
      return false;
    }
  }, [equipe?.id, temTurnoAberto, intervalMs]);

  // Callback quando a posição é atualizada
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    
    setState(prev => ({
      ...prev,
      latitude,
      longitude,
      accuracy,
      lastUpdate: new Date(),
      error: null,
      isTracking: true,
    }));

    // Enviar para o banco se tiver turno aberto
    if (temTurnoAberto) {
      sendPosition(latitude, longitude, accuracy, speed || undefined, heading || undefined);
    }
  }, [temTurnoAberto, sendPosition]);

  // Callback de erro
  const handlePositionError = useCallback((error: GeolocationPositionError) => {
    let errorMsg = "Erro desconhecido de GPS";
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMsg = "Permissão de localização negada";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMsg = "Localização indisponível";
        break;
      case error.TIMEOUT:
        errorMsg = "Tempo esgotado ao obter localização";
        break;
    }

    console.warn("[LocationTracking] Erro:", errorMsg);
    setState(prev => ({
      ...prev,
      error: errorMsg,
      isTracking: false,
    }));
  }, []);

  // Iniciar/parar rastreamento baseado nas condições
  useEffect(() => {
    // Só rastrear se:
    // 1. Está habilitado
    // 2. Tem equipe autenticada
    // 3. Tem turno aberto
    // 4. Navegador suporta geolocalização
    const shouldTrack = enabled && equipe?.id && temTurnoAberto && navigator.geolocation;

    if (shouldTrack) {
      console.log("[LocationTracking] Iniciando rastreamento de localização...");
      
      // Obter posição inicial imediatamente
      navigator.geolocation.getCurrentPosition(
        handlePositionUpdate,
        handlePositionError,
        {
          enableHighAccuracy: highAccuracy,
          timeout: 15000,
          maximumAge: 0,
        }
      );

      // Iniciar watch contínuo
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handlePositionError,
        {
          enableHighAccuracy: highAccuracy,
          timeout: 30000,
          maximumAge: intervalMs,
        }
      );

      setState(prev => ({ ...prev, isTracking: true }));
    } else {
      // Parar rastreamento
      if (watchIdRef.current !== null) {
        console.log("[LocationTracking] Parando rastreamento de localização");
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setState(prev => ({ ...prev, isTracking: false }));
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, equipe?.id, temTurnoAberto, highAccuracy, intervalMs, handlePositionUpdate, handlePositionError]);

  // Envio periódico forçado (mesmo que posição não mude)
  useEffect(() => {
    if (!enabled || !equipe?.id || !temTurnoAberto) return;

    const interval = setInterval(() => {
      if (state.latitude && state.longitude) {
        console.log("[LocationTracking] Envio periódico forçado");
        sendPosition(state.latitude, state.longitude, state.accuracy || undefined);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, equipe?.id, temTurnoAberto, intervalMs, state.latitude, state.longitude, state.accuracy, sendPosition]);

  // Função manual para forçar envio
  const forceUpdate = useCallback(async () => {
    if (!navigator.geolocation) {
      return { success: false, error: "Geolocalização não suportada" };
    }

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy, speed, heading } = position.coords;
          
          setState(prev => ({
            ...prev,
            latitude,
            longitude,
            accuracy,
            lastUpdate: new Date(),
            error: null,
          }));

          const success = await sendPosition(
            latitude,
            longitude,
            accuracy,
            speed || undefined,
            heading || undefined
          );

          resolve({ success });
        },
        (error) => {
          resolve({ success: false, error: error.message });
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }, [highAccuracy, sendPosition]);

  return {
    ...state,
    forceUpdate,
  };
}
