import { useState, useEffect, useCallback } from "react";

// Nome do banco de dados IndexedDB
const DB_NAME = "sirtec_offline_cache";
const DB_VERSION = 1;
const STORE_NAME = "arquivos";

interface ArquivoCache {
  id: string;
  procedimento_id: string;
  nome: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tamanho_bytes: number;
  blob: Blob;
  url_original: string;
  cached_at: string;
}

interface CacheInfo {
  id: string;
  procedimento_id: string;
  nome: string;
  cached_at: string;
  tamanho_bytes: number;
}

// Abrir conexão com IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Criar object store se não existir
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("procedimento_id", "procedimento_id", { unique: false });
        store.createIndex("cached_at", "cached_at", { unique: false });
      }
    };
  });
};

// Hook para gerenciar cache offline
export function useOfflineCache() {
  const [isSupported, setIsSupported] = useState(false);
  const [cachedFiles, setCachedFiles] = useState<CacheInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCacheSize, setTotalCacheSize] = useState(0);

  // Verificar suporte e carregar lista de arquivos em cache
  useEffect(() => {
    const init = async () => {
      try {
        // Verificar suporte a IndexedDB
        if (!("indexedDB" in window)) {
          setIsSupported(false);
          setIsLoading(false);
          return;
        }

        setIsSupported(true);
        await loadCachedFiles();
      } catch (error) {
        console.error("Erro ao inicializar cache offline:", error);
        setIsSupported(false);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Carregar lista de arquivos em cache
  const loadCachedFiles = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const files = request.result as ArquivoCache[];
          const cacheInfo: CacheInfo[] = files.map((f) => ({
            id: f.id,
            procedimento_id: f.procedimento_id,
            nome: f.nome,
            cached_at: f.cached_at,
            tamanho_bytes: f.tamanho_bytes,
          }));
          setCachedFiles(cacheInfo);
          setTotalCacheSize(files.reduce((acc, f) => acc + f.tamanho_bytes, 0));
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Erro ao carregar arquivos em cache:", error);
    }
  }, []);

  // Salvar arquivo no cache
  const saveToCache = useCallback(async (
    arquivo: {
      id: string;
      procedimento_id: string;
      nome: string;
      nome_arquivo: string;
      tipo_arquivo: string;
      tamanho_bytes: number;
    },
    url: string
  ): Promise<boolean> => {
    try {
      // Baixar o arquivo
      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao baixar arquivo");
      
      const blob = await response.blob();

      // Salvar no IndexedDB
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const cacheData: ArquivoCache = {
        id: arquivo.id,
        procedimento_id: arquivo.procedimento_id,
        nome: arquivo.nome,
        nome_arquivo: arquivo.nome_arquivo,
        tipo_arquivo: arquivo.tipo_arquivo,
        tamanho_bytes: blob.size,
        blob,
        url_original: url,
        cached_at: new Date().toISOString(),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(cacheData);
        request.onsuccess = () => {
          loadCachedFiles();
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Erro ao salvar no cache:", error);
      return false;
    }
  }, [loadCachedFiles]);

  // Remover arquivo do cache
  const removeFromCache = useCallback(async (id: string): Promise<boolean> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => {
          loadCachedFiles();
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Erro ao remover do cache:", error);
      return false;
    }
  }, [loadCachedFiles]);

  // Obter arquivo do cache
  const getFromCache = useCallback(async (id: string): Promise<Blob | null> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => {
          const data = request.result as ArquivoCache | undefined;
          resolve(data?.blob || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Erro ao obter do cache:", error);
      return null;
    }
  }, []);

  // Verificar se arquivo está em cache
  const isInCache = useCallback((id: string): boolean => {
    return cachedFiles.some((f) => f.id === id);
  }, [cachedFiles]);

  // Verificar se procedimento tem arquivos em cache
  const hasCachedFiles = useCallback((procedimentoId: string): boolean => {
    return cachedFiles.some((f) => f.procedimento_id === procedimentoId);
  }, [cachedFiles]);

  // Obter arquivos em cache de um procedimento
  const getCachedByProcedimento = useCallback((procedimentoId: string): CacheInfo[] => {
    return cachedFiles.filter((f) => f.procedimento_id === procedimentoId);
  }, [cachedFiles]);

  // Limpar todo o cache
  const clearCache = useCallback(async (): Promise<boolean> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          setCachedFiles([]);
          setTotalCacheSize(0);
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Erro ao limpar cache:", error);
      return false;
    }
  }, []);

  // Salvar todos os anexos de um procedimento
  const saveAllProcedimentoFiles = useCallback(async (
    anexos: Array<{
      id: string;
      procedimento_id: string;
      nome: string;
      nome_arquivo: string;
      tipo_arquivo: string;
      tamanho_bytes: number;
      url: string;
    }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: number; failed: number }> => {
    let success = 0;
    let failed = 0;

    for (let i = 0; i < anexos.length; i++) {
      const anexo = anexos[i];
      onProgress?.(i + 1, anexos.length);
      
      const result = await saveToCache(
        {
          id: anexo.id,
          procedimento_id: anexo.procedimento_id,
          nome: anexo.nome,
          nome_arquivo: anexo.nome_arquivo,
          tipo_arquivo: anexo.tipo_arquivo,
          tamanho_bytes: anexo.tamanho_bytes,
        },
        anexo.url
      );

      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }, [saveToCache]);

  return {
    isSupported,
    isLoading,
    cachedFiles,
    totalCacheSize,
    saveToCache,
    removeFromCache,
    getFromCache,
    isInCache,
    hasCachedFiles,
    getCachedByProcedimento,
    clearCache,
    saveAllProcedimentoFiles,
    refreshCache: loadCachedFiles,
  };
}

// Função utilitária para formatar tamanho
export const formatCacheSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};
















