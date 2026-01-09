import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Nome do banco de dados IndexedDB para sincronização
const DB_NAME = "sirtec_offline_sync";
const DB_VERSION = 2;
const QUEUE_STORE = "sync_queue";
const CACHE_STORE = "data_cache";

// Tipos de operações que podem ser enfileiradas
export type OperationType = 
  | "update_os_status"
  | "register_producao"
  | "start_turno"
  | "end_turno"
  | "start_intervalo"
  | "end_intervalo"
  | "update_localizacao"
  | "send_chat_message"
  | "save_checklist"
  | "save_foto"
  | "movimentar_material";

export interface SyncOperation {
  id: string;
  type: OperationType;
  table: string;
  action: "insert" | "update" | "delete" | "rpc";
  payload: any;
  created_at: string;
  retries: number;
  last_error?: string;
  priority: number; // 1 = alta, 2 = média, 3 = baixa
}

export interface CacheEntry {
  key: string;
  data: any;
  updated_at: string;
  expires_at?: string;
}

// Abrir conexão com IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store para fila de sincronização
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        queueStore.createIndex("created_at", "created_at", { unique: false });
        queueStore.createIndex("priority", "priority", { unique: false });
        queueStore.createIndex("type", "type", { unique: false });
      }
      
      // Store para cache de dados
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        const cacheStore = db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        cacheStore.createIndex("updated_at", "updated_at", { unique: false });
        cacheStore.createIndex("expires_at", "expires_at", { unique: false });
      }
    };
  });
};

// Gerar ID único
const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Hook principal de sincronização offline
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState<SyncOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncInProgress = useRef(false);

  // Monitorar status de conexão
  useEffect(() => {
    const handleOnline = () => {
      console.log("[OfflineSync] Conexão restaurada");
      setIsOnline(true);
      // Iniciar sincronização quando voltar online
      syncPendingOperations();
    };

    const handleOffline = () => {
      console.log("[OfflineSync] Conexão perdida");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Carregar operações pendentes ao iniciar
  useEffect(() => {
    loadPendingOperations();
  }, []);

  // Carregar operações pendentes do IndexedDB
  const loadPendingOperations = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(QUEUE_STORE, "readonly");
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const operations = request.result as SyncOperation[];
        // Ordenar por prioridade e data
        operations.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        setPendingOperations(operations);
        console.log(`[OfflineSync] ${operations.length} operações pendentes carregadas`);
      };
    } catch (error) {
      console.error("[OfflineSync] Erro ao carregar operações:", error);
    }
  }, []);

  // Adicionar operação à fila
  const queueOperation = useCallback(async (
    type: OperationType,
    table: string,
    action: "insert" | "update" | "delete" | "rpc",
    payload: any,
    priority: number = 2
  ): Promise<string> => {
    const operation: SyncOperation = {
      id: generateId(),
      type,
      table,
      action,
      payload,
      created_at: new Date().toISOString(),
      retries: 0,
      priority,
    };

    try {
      const db = await openDB();
      const transaction = db.transaction(QUEUE_STORE, "readwrite");
      const store = transaction.objectStore(QUEUE_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.add(operation);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`[OfflineSync] Operação enfileirada: ${type}`, operation.id);
      
      // Atualizar lista local
      setPendingOperations(prev => [...prev, operation]);
      
      // Se online, tentar sincronizar imediatamente
      if (navigator.onLine) {
        syncPendingOperations();
      }

      return operation.id;
    } catch (error) {
      console.error("[OfflineSync] Erro ao enfileirar operação:", error);
      throw error;
    }
  }, []);

  // Remover operação da fila
  const removeOperation = useCallback(async (id: string) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(QUEUE_STORE, "readwrite");
      const store = transaction.objectStore(QUEUE_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      setPendingOperations(prev => prev.filter(op => op.id !== id));
    } catch (error) {
      console.error("[OfflineSync] Erro ao remover operação:", error);
    }
  }, []);

  // Atualizar operação na fila (após erro)
  const updateOperation = useCallback(async (operation: SyncOperation) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(QUEUE_STORE, "readwrite");
      const store = transaction.objectStore(QUEUE_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(operation);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      setPendingOperations(prev => 
        prev.map(op => op.id === operation.id ? operation : op)
      );
    } catch (error) {
      console.error("[OfflineSync] Erro ao atualizar operação:", error);
    }
  }, []);

  // Executar uma operação no Supabase
  const executeOperation = async (operation: SyncOperation): Promise<boolean> => {
    try {
      console.log(`[OfflineSync] Executando operação: ${operation.type}`, operation.id);
      
      let result;
      
      if (operation.action === "rpc") {
        // Chamada RPC
        result = await supabase.rpc(operation.table, operation.payload);
      } else if (operation.action === "insert") {
        result = await supabase.from(operation.table).insert(operation.payload);
      } else if (operation.action === "update") {
        const { id, ...data } = operation.payload;
        result = await supabase.from(operation.table).update(data).eq("id", id);
      } else if (operation.action === "delete") {
        result = await supabase.from(operation.table).delete().eq("id", operation.payload.id);
      }

      if (result?.error) {
        throw result.error;
      }

      console.log(`[OfflineSync] Operação executada com sucesso: ${operation.id}`);
      return true;
    } catch (error: any) {
      console.error(`[OfflineSync] Erro ao executar operação ${operation.id}:`, error);
      
      // Atualizar operação com erro
      operation.retries++;
      operation.last_error = error.message || "Erro desconhecido";
      await updateOperation(operation);
      
      // Se excedeu tentativas, desistir
      if (operation.retries >= 5) {
        console.warn(`[OfflineSync] Operação ${operation.id} excedeu tentativas`);
        // Manter na fila mas não tentar mais automaticamente
      }
      
      return false;
    }
  };

  // Sincronizar todas as operações pendentes
  const syncPendingOperations = useCallback(async () => {
    if (syncInProgress.current || !navigator.onLine) return;
    
    syncInProgress.current = true;
    setIsSyncing(true);
    
    try {
      const db = await openDB();
      const transaction = db.transaction(QUEUE_STORE, "readonly");
      const store = transaction.objectStore(QUEUE_STORE);
      
      const operations = await new Promise<SyncOperation[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Ordenar por prioridade e data
      operations.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      // Filtrar apenas operações com menos de 5 tentativas
      const toSync = operations.filter(op => op.retries < 5);
      
      if (toSync.length === 0) {
        console.log("[OfflineSync] Nenhuma operação para sincronizar");
        setIsSyncing(false);
        syncInProgress.current = false;
        return;
      }

      console.log(`[OfflineSync] Sincronizando ${toSync.length} operações...`);
      
      let successCount = 0;
      let errorCount = 0;

      for (const operation of toSync) {
        if (!navigator.onLine) {
          console.log("[OfflineSync] Conexão perdida durante sincronização");
          break;
        }

        const success = await executeOperation(operation);
        
        if (success) {
          await removeOperation(operation.id);
          successCount++;
        } else {
          errorCount++;
        }
      }

      setLastSyncTime(new Date());
      
      if (successCount > 0) {
        toast.success(`${successCount} operação(ões) sincronizada(s)`);
      }
      
      if (errorCount > 0) {
        toast.warning(`${errorCount} operação(ões) com erro`);
      }

      await loadPendingOperations();
    } catch (error) {
      console.error("[OfflineSync] Erro durante sincronização:", error);
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, [loadPendingOperations, removeOperation, updateOperation]);

  // ============ CACHE DE DADOS ============

  // Salvar dados no cache
  const saveToCache = useCallback(async (key: string, data: any, expiresInHours: number = 24) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(CACHE_STORE, "readwrite");
      const store = transaction.objectStore(CACHE_STORE);
      
      const entry: CacheEntry = {
        key,
        data,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`[OfflineSync] Cache salvo: ${key}`);
    } catch (error) {
      console.error(`[OfflineSync] Erro ao salvar cache ${key}:`, error);
    }
  }, []);

  // Obter dados do cache
  const getFromCache = useCallback(async <T>(key: string): Promise<T | null> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(CACHE_STORE, "readonly");
      const store = transaction.objectStore(CACHE_STORE);
      
      const entry = await new Promise<CacheEntry | undefined>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!entry) return null;

      // Verificar expiração
      if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
        console.log(`[OfflineSync] Cache expirado: ${key}`);
        // Não remover, pode ser útil offline
      }

      return entry.data as T;
    } catch (error) {
      console.error(`[OfflineSync] Erro ao obter cache ${key}:`, error);
      return null;
    }
  }, []);

  // Remover do cache
  const removeFromCache = useCallback(async (key: string) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(CACHE_STORE, "readwrite");
      const store = transaction.objectStore(CACHE_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[OfflineSync] Erro ao remover cache ${key}:`, error);
    }
  }, []);

  // Limpar todo o cache
  const clearCache = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(CACHE_STORE, "readwrite");
      const store = transaction.objectStore(CACHE_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      console.log("[OfflineSync] Cache limpo");
    } catch (error) {
      console.error("[OfflineSync] Erro ao limpar cache:", error);
    }
  }, []);

  // Limpar fila de sincronização
  const clearQueue = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(QUEUE_STORE, "readwrite");
      const store = transaction.objectStore(QUEUE_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      setPendingOperations([]);
      console.log("[OfflineSync] Fila de sincronização limpa");
    } catch (error) {
      console.error("[OfflineSync] Erro ao limpar fila:", error);
    }
  }, []);

  return {
    // Estado
    isOnline,
    isSyncing,
    pendingOperations,
    pendingCount: pendingOperations.length,
    lastSyncTime,
    
    // Fila de operações
    queueOperation,
    removeOperation,
    syncPendingOperations,
    clearQueue,
    
    // Cache de dados
    saveToCache,
    getFromCache,
    removeFromCache,
    clearCache,
    
    // Refresh
    refreshPendingOperations: loadPendingOperations,
  };
}

// ============ CONTEXTO GLOBAL ============

interface OfflineSyncContextType extends ReturnType<typeof useOfflineSync> {}

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const offlineSync = useOfflineSync();
  
  return (
    <OfflineSyncContext.Provider value={offlineSync}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("useOfflineSyncContext deve ser usado dentro de OfflineSyncProvider");
  }
  return context;
}

