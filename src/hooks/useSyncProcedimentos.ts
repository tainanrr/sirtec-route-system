import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineCache } from "./useOfflineCache";

interface Anexo {
  id: string;
  procedimento_id: string;
  nome: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tamanho_bytes: number;
  storage_path: string;
  url_publica: string | null;
}

interface Procedimento {
  id: string;
  titulo: string;
  categoria: string;
  updated_at: string;
}

interface SyncStatus {
  issyncing: boolean;
  progress: {
    current: number;
    total: number;
    currentFile?: string;
  };
  lastSync: string | null;
  totalCached: number;
  totalSize: number;
  error: string | null;
}

const SYNC_STORAGE_KEY = "sirtec_procedimentos_last_sync";
const SYNC_INTERVAL = 1000 * 60 * 30; // 30 minutos - verificar por atualizações

export function useSyncProcedimentos(contratoId?: string | null) {
  const {
    isSupported,
    cachedFiles,
    totalCacheSize,
    saveToCache,
    isInCache,
    refreshCache,
  } = useOfflineCache();

  const [status, setStatus] = useState<SyncStatus>({
    issyncing: false,
    progress: { current: 0, total: 0 },
    lastSync: null,
    totalCached: 0,
    totalSize: 0,
    error: null,
  });

  const syncInProgress = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar último sync do localStorage
  useEffect(() => {
    try {
      const lastSync = localStorage.getItem(SYNC_STORAGE_KEY);
      if (lastSync) {
        setStatus((prev) => ({ ...prev, lastSync }));
      }
    } catch {
      // Ignorar erro de localStorage
    }
  }, []);

  // Atualizar contadores quando cache mudar
  useEffect(() => {
    setStatus((prev) => ({
      ...prev,
      totalCached: cachedFiles.length,
      totalSize: totalCacheSize,
    }));
  }, [cachedFiles, totalCacheSize]);

  // Função principal de sincronização
  const syncAll = useCallback(async (forceSync = false) => {
    if (!isSupported || syncInProgress.current) {
      return { success: false, message: "Sync não disponível ou já em andamento" };
    }

    // Verificar se precisa sincronizar (se não forçado)
    if (!forceSync) {
      try {
        const lastSync = localStorage.getItem(SYNC_STORAGE_KEY);
        if (lastSync) {
          const lastSyncTime = new Date(lastSync).getTime();
          const now = Date.now();
          // Se sincronizou há menos de 30 minutos, pular
          if (now - lastSyncTime < SYNC_INTERVAL) {
            console.log("[SYNC] Sincronização recente encontrada, pulando...");
            return { success: true, message: "Já sincronizado recentemente" };
          }
        }
      } catch {
        // Continuar com sync
      }
    }

    syncInProgress.current = true;
    setStatus((prev) => ({
      ...prev,
      issyncing: true,
      progress: { current: 0, total: 0 },
      error: null,
    }));

    try {
      console.log("[SYNC] Iniciando sincronização de procedimentos...");

      // 1. Buscar todos os procedimentos ativos e visíveis no app
      let query = supabase
        .from("procedimentos")
        .select("id, titulo, categoria, updated_at")
        .eq("ativo", true)
        .eq("visivel_app", true);

      // Filtrar por contrato se especificado
      if (contratoId) {
        query = query.or(`contrato_id.is.null,contrato_id.eq.${contratoId}`);
      } else {
        query = query.is("contrato_id", null);
      }

      const { data: procedimentos, error: procError } = await query;

      if (procError) throw procError;

      if (!procedimentos || procedimentos.length === 0) {
        console.log("[SYNC] Nenhum procedimento encontrado");
        setStatus((prev) => ({
          ...prev,
          issyncing: false,
          lastSync: new Date().toISOString(),
        }));
        localStorage.setItem(SYNC_STORAGE_KEY, new Date().toISOString());
        return { success: true, message: "Nenhum procedimento para sincronizar" };
      }

      console.log(`[SYNC] ${procedimentos.length} procedimentos encontrados`);

      // 2. Buscar todos os anexos de todos os procedimentos
      const procIds = procedimentos.map((p) => p.id);
      const { data: anexos, error: anexosError } = await supabase
        .from("procedimentos_anexos")
        .select("*")
        .in("procedimento_id", procIds)
        .eq("ativo", true);

      if (anexosError) throw anexosError;

      if (!anexos || anexos.length === 0) {
        console.log("[SYNC] Nenhum anexo encontrado");
        setStatus((prev) => ({
          ...prev,
          issyncing: false,
          lastSync: new Date().toISOString(),
        }));
        localStorage.setItem(SYNC_STORAGE_KEY, new Date().toISOString());
        return { success: true, message: "Nenhum anexo para sincronizar" };
      }

      console.log(`[SYNC] ${anexos.length} anexos encontrados`);

      // 3. Filtrar anexos que não estão em cache
      const anexosParaBaixar = anexos.filter((a) => !isInCache(a.id));
      console.log(`[SYNC] ${anexosParaBaixar.length} anexos para baixar (${anexos.length - anexosParaBaixar.length} já em cache)`);

      if (anexosParaBaixar.length === 0) {
        console.log("[SYNC] Todos os anexos já estão em cache");
        setStatus((prev) => ({
          ...prev,
          issyncing: false,
          lastSync: new Date().toISOString(),
        }));
        localStorage.setItem(SYNC_STORAGE_KEY, new Date().toISOString());
        return { success: true, message: "Tudo já sincronizado" };
      }

      setStatus((prev) => ({
        ...prev,
        progress: { current: 0, total: anexosParaBaixar.length },
      }));

      // 4. Baixar cada anexo
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < anexosParaBaixar.length; i++) {
        const anexo = anexosParaBaixar[i] as Anexo;

        setStatus((prev) => ({
          ...prev,
          progress: {
            current: i + 1,
            total: anexosParaBaixar.length,
            currentFile: anexo.nome,
          },
        }));

        try {
          // Obter URL do arquivo
          let url = anexo.url_publica;
          if (!url && anexo.storage_path) {
            const { data } = await supabase.storage
              .from("procedimentos")
              .getPublicUrl(anexo.storage_path);
            url = data.publicUrl;
          }

          if (url) {
            const saved = await saveToCache(
              {
                id: anexo.id,
                procedimento_id: anexo.procedimento_id,
                nome: anexo.nome,
                nome_arquivo: anexo.nome_arquivo,
                tipo_arquivo: anexo.tipo_arquivo,
                tamanho_bytes: anexo.tamanho_bytes,
              },
              url
            );

            if (saved) {
              successCount++;
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`[SYNC] Erro ao baixar ${anexo.nome}:`, error);
          failedCount++;
        }

        // Pequena pausa para não sobrecarregar
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // 5. Atualizar cache
      await refreshCache();

      const now = new Date().toISOString();
      localStorage.setItem(SYNC_STORAGE_KEY, now);

      setStatus((prev) => ({
        ...prev,
        issyncing: false,
        lastSync: now,
        progress: { current: 0, total: 0 },
      }));

      console.log(`[SYNC] Sincronização concluída: ${successCount} sucesso, ${failedCount} falhas`);

      return {
        success: true,
        message: `${successCount} arquivos sincronizados`,
        successCount,
        failedCount,
      };
    } catch (error) {
      console.error("[SYNC] Erro na sincronização:", error);
      setStatus((prev) => ({
        ...prev,
        issyncing: false,
        error: (error as Error).message,
      }));
      return { success: false, message: (error as Error).message };
    } finally {
      syncInProgress.current = false;
    }
  }, [isSupported, contratoId, isInCache, saveToCache, refreshCache]);

  // Iniciar sincronização automática
  const startAutoSync = useCallback(() => {
    // Sincronizar imediatamente
    syncAll();

    // Configurar intervalo para verificar atualizações
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    syncIntervalRef.current = setInterval(() => {
      syncAll();
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [syncAll]);

  // Parar sincronização automática
  const stopAutoSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  // Limpar intervalo quando componente desmontar
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  return {
    status,
    syncAll,
    startAutoSync,
    stopAutoSync,
    isSupported,
  };
}
















