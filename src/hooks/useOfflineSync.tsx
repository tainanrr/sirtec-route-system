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

// Mutex global via localStorage para evitar sincronizações paralelas de múltiplas instâncias
const SYNC_LOCK_KEY = "sirtec_sync_lock";
const SYNC_LOCK_TIMEOUT = 120000; // 2 minutos máximo de lock

const acquireSyncLock = (): boolean => {
  const now = Date.now();
  const lockData = localStorage.getItem(SYNC_LOCK_KEY);
  
  if (lockData) {
    const { timestamp, lockId } = JSON.parse(lockData);
    // Se o lock expirou, podemos adquirir
    if (now - timestamp > SYNC_LOCK_TIMEOUT) {
      console.log("[OfflineSync] Lock expirado, adquirindo novo lock");
    } else {
      // Lock ainda válido, não podemos adquirir
      return false;
    }
  }
  
  // Adquirir o lock
  const newLockId = generateId();
  localStorage.setItem(SYNC_LOCK_KEY, JSON.stringify({ timestamp: now, lockId: newLockId }));
  
  // Verificar se realmente adquirimos (double-check)
  const verifyLock = localStorage.getItem(SYNC_LOCK_KEY);
  if (verifyLock) {
    const { lockId } = JSON.parse(verifyLock);
    return lockId === newLockId;
  }
  return false;
};

const releaseSyncLock = (): void => {
  localStorage.removeItem(SYNC_LOCK_KEY);
};

// Hook principal de sincronização offline
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState<SyncOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncInProgress = useRef(false);
  const lastSyncAttempt = useRef<number>(0);

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

    // Primeiro adicionar ao estado local (garante que estará disponível mesmo se IndexedDB falhar)
    setPendingOperations(prev => [...prev, operation]);

    try {
      const db = await openDB();
      const transaction = db.transaction(QUEUE_STORE, "readwrite");
      const store = transaction.objectStore(QUEUE_STORE);
      
      // Criar promise que resolve quando a transação completar (registrar ANTES do put)
      const transactionPromise = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(new Error("Transaction aborted"));
      });
      
      // Usar put em vez de add para evitar erros se já existir
      const putPromise = new Promise<void>((resolve, reject) => {
        const request = store.put(operation);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      // Aguardar o put completar
      await putPromise;
      
      // Aguardar a transação completar (com timeout para evitar travamento)
      await Promise.race([
        transactionPromise,
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error("Transaction timeout")), 5000)
        )
      ]).catch(err => {
        // Se deu timeout ou erro, a operação já está no estado local, então continuar
        console.warn(`[OfflineSync] Aviso na transação (operação já está no estado local):`, err.message);
      });

      console.log(`[OfflineSync] Operação enfileirada: ${type}`, operation.id);
      
      // Se online, tentar sincronizar imediatamente
      if (navigator.onLine) {
        syncPendingOperations();
      }

      return operation.id;
    } catch (error) {
      console.error("[OfflineSync] Erro ao enfileirar operação:", error);
      // Mesmo se falhar no IndexedDB, a operação está no estado local
      console.warn("[OfflineSync] Operação salva apenas no estado local:", operation.id);
      return operation.id;
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

  // Função auxiliar para verificar se uma string é um UUID válido
  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Função para limpar IDs inválidos recursivamente
  const cleanInvalidIds = (obj: any, path: string = ''): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Se for array, limpar cada item
    if (Array.isArray(obj)) {
      return obj.map((item, index) => cleanInvalidIds(item, `${path}[${index}]`));
    }

    // Se for objeto, limpar recursivamente
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Se for campo 'id' e não for UUID válido, remover
        if (key === 'id') {
          if (typeof value === 'string' && !isValidUUID(value)) {
            console.log(`[OfflineSync] Removendo ID inválido em ${currentPath}: ${value}`);
            // Não incluir este campo (banco gerará UUID)
            continue;
          }
        }
        // Limpar recursivamente
        cleaned[key] = cleanInvalidIds(value, currentPath);
      }
      return cleaned;
    }

    // Valores primitivos retornam como estão
    return obj;
  };

  // Executar uma operação no Supabase
  const executeOperation = async (operation: SyncOperation): Promise<boolean> => {
    try {
      console.log(`[OfflineSync] Executando operação: ${operation.type}`, operation.id);
      
      let result;
      
      // Tratamento especial para save_foto (upload de imagem base64 para Storage)
      if (operation.type === "save_foto" && operation.action === "insert") {
        const payload = operation.payload;
        
        // Se a URL é base64, fazer upload para Storage primeiro
        if (payload.url && payload.url.startsWith("data:image")) {
          try {
            console.log("[OfflineSync] Fazendo upload de foto base64 para Storage...");
            
            // Converter base64 para blob
            const response = await fetch(payload.url);
            const blob = await response.blob();
            
            // Gerar nome do arquivo
            const fileExt = "jpg";
            const fileName = payload.storage_path || `${payload.ordem_servico_id}/${Date.now()}.${fileExt}`;
            
            // Upload para Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("service-attachments")
              .upload(fileName, blob, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: true,
              });
            
            if (uploadError) {
              throw uploadError;
            }
            
            // Obter URL pública
            const { data: urlData } = supabase.storage
              .from("service-attachments")
              .getPublicUrl(fileName);
            
            // Atualizar payload com URL do Storage
            payload.url = urlData.publicUrl;
            payload.storage_path = fileName;
            
            console.log("[OfflineSync] Upload de foto concluído:", urlData.publicUrl);
          } catch (uploadError: any) {
            console.error("[OfflineSync] Erro ao fazer upload de foto:", uploadError);
            // Continuar com base64 se upload falhar
          }
        }
        
        // Remover campo auxiliar numero_os antes de inserir
        const { numero_os, ...cleanFotoPayload } = payload;
        
        // Inserir na tabela
        result = await supabase.from(operation.table).insert(cleanFotoPayload);
      } else if (operation.action === "rpc") {
        // Chamada RPC
        result = await supabase.rpc(operation.table, operation.payload);
      } else if (operation.action === "insert") {
        // Remover IDs inválidos (banco gera UUID automaticamente)
        let insertPayload = cleanInvalidIds(operation.payload);
        
        // Remover campo auxiliar numero_os que é usado apenas para exibição no indicador offline
        if (insertPayload.numero_os) {
          const { numero_os, ...payloadSemNumero } = insertPayload;
          insertPayload = payloadSemNumero;
        }
        
        // Tratamento especial para checklist_respostas: sempre tentar UPDATE primeiro, depois INSERT
        if (operation.table === "checklist_respostas" && (operation.type === "save_apr" || operation.type === "update_apr")) {
          console.log(`[OfflineSync] Processando APR para OS ${insertPayload.ordem_servico_id}, checklist ${insertPayload.checklist_id}`);
          
          // Limpar IDs dentro do array respostas
          let respostasLimpas = insertPayload.respostas;
          if (respostasLimpas && Array.isArray(respostasLimpas)) {
            respostasLimpas = respostasLimpas.map((r: any) => {
              const cleaned = { ...r };
              // Remover ID se não for UUID válido
              if (cleaned.id && typeof cleaned.id === 'string' && !isValidUUID(cleaned.id)) {
                delete cleaned.id;
              }
              return cleaned;
            });
          }
          
          // ESTRATÉGIA: Sempre tentar UPDATE primeiro usando ordem_servico_id + checklist_id
          // Isso evita race conditions onde duas operações verificam simultaneamente
          const updateData = {
            respostas: respostasLimpas,
            status: insertPayload.status || 'completo',
            equipe_id: insertPayload.equipe_id,
            updated_at: new Date().toISOString(),
          };
          
          // ESTRATÉGIA: Buscar APR existente primeiro, depois fazer UPDATE ou INSERT
          console.log(`[OfflineSync] 🔍 Buscando APR existente para OS ${insertPayload.ordem_servico_id}, checklist ${insertPayload.checklist_id}`);
          const { data: existingAPR, error: checkError } = await supabase
            .from("checklist_respostas")
            .select("id")
            .eq("ordem_servico_id", insertPayload.ordem_servico_id)
            .eq("checklist_id", insertPayload.checklist_id)
            .maybeSingle();
          
          if (checkError) {
            console.error(`[OfflineSync] Erro ao buscar APR existente:`, checkError);
            // Se erro na busca, tentar INSERT mesmo assim
          }
          
          // Se encontrou APR existente, fazer UPDATE usando o ID
          if (existingAPR?.id) {
            console.log(`[OfflineSync] ✅ APR encontrada (ID: ${existingAPR.id}), fazendo UPDATE`);
            const updateResult = await supabase
              .from("checklist_respostas")
              .update(updateData)
              .eq("id", existingAPR.id)
              .select()
              .single();
            
            if (updateResult?.error) {
              console.error(`[OfflineSync] Erro ao atualizar APR:`, updateResult.error);
              throw updateResult.error;
            }
            
            console.log(`[OfflineSync] ✅ APR atualizada com sucesso (ID: ${existingAPR.id})`);
            result = { data: updateResult.data, error: null };
          } else {
            // UPDATE não afetou nenhuma linha, fazer INSERT
            console.log(`[OfflineSync] ➕ APR não encontrada, inserindo nova para OS ${insertPayload.ordem_servico_id}, checklist ${insertPayload.checklist_id}`);
            
            // Limpar payload para INSERT (remover campos que não devem ser inseridos)
            const { id, numero_os, ...insertData } = insertPayload;
            insertData.respostas = respostasLimpas;
            
            // ANTES de inserir, verificar novamente se não foi criada por outra operação simultânea
            // Isso evita race condition quando duas operações são executadas ao mesmo tempo
            const { data: doubleCheckAPR } = await supabase
              .from("checklist_respostas")
              .select("id")
              .eq("ordem_servico_id", insertPayload.ordem_servico_id)
              .eq("checklist_id", insertPayload.checklist_id)
              .maybeSingle();
            
            if (doubleCheckAPR?.id) {
              // APR foi criada entre a primeira busca e agora, fazer UPDATE
              console.log(`[OfflineSync] ⚠️ APR encontrada na verificação dupla (ID: ${doubleCheckAPR.id}), fazendo UPDATE`);
              const updateResult = await supabase
                .from("checklist_respostas")
                .update(updateData)
                .eq("id", doubleCheckAPR.id)
                .select()
                .single();
              
              if (updateResult?.error) {
                console.error(`[OfflineSync] Erro ao atualizar APR na verificação dupla:`, updateResult.error);
                throw updateResult.error;
              }
              
              console.log(`[OfflineSync] ✅ APR atualizada com sucesso na verificação dupla (ID: ${doubleCheckAPR.id})`);
              result = { data: updateResult.data, error: null };
            } else {
              // Realmente não existe, fazer INSERT
              result = await supabase.from(operation.table).insert(insertData).select().single();
              
              // Verificar se o insert foi bem-sucedido
              if (result?.error) {
                // Se o erro for de duplicação, tentar UPDATE novamente (pode ter sido criado entre verificação e INSERT)
                if (result.error.code === '23505' || result.error.message?.includes('duplicate') || result.error.message?.includes('unique')) {
                  console.log(`[OfflineSync] ⚠️ Erro de duplicação no INSERT, buscando APR existente para UPDATE...`);
                  
                  // Buscar APR existente pelo ID
                  const { data: existingAPRRetry } = await supabase
                    .from("checklist_respostas")
                    .select("id")
                    .eq("ordem_servico_id", insertPayload.ordem_servico_id)
                    .eq("checklist_id", insertPayload.checklist_id)
                    .maybeSingle();
                  
                  if (existingAPRRetry?.id) {
                    // Fazer UPDATE usando o ID encontrado
                    const retryUpdate = await supabase
                      .from("checklist_respostas")
                      .update(updateData)
                      .eq("id", existingAPRRetry.id)
                      .select()
                      .single();
                    
                    if (retryUpdate?.data) {
                      console.log(`[OfflineSync] ✅ APR encontrada após retry, atualizada com sucesso (ID: ${existingAPRRetry.id})`);
                      result = { data: retryUpdate.data, error: null };
                    } else if (retryUpdate?.error) {
                      console.error(`[OfflineSync] ❌ Erro ao atualizar APR após retry:`, retryUpdate.error);
                      throw retryUpdate.error;
                    } else {
                      throw result.error;
                    }
                  } else {
                    console.error(`[OfflineSync] ❌ APR não encontrada após erro de duplicação:`, result.error);
                    throw result.error;
                  }
                } else {
                  throw result.error;
                }
              } else {
                console.log(`[OfflineSync] ✅ Nova APR inserida com sucesso (ID: ${result.data?.id})`);
              }
            }
          }
        } else if (operation.table === "checklist_respostas" && insertPayload.respostas && Array.isArray(insertPayload.respostas)) {
          // Limpar IDs dentro do array respostas para outros tipos de checklist
          insertPayload = {
            ...insertPayload,
            respostas: insertPayload.respostas.map((r: any) => {
              const cleaned = { ...r };
              // Remover ID se não for UUID válido
              if (cleaned.id && typeof cleaned.id === 'string' && !isValidUUID(cleaned.id)) {
                delete cleaned.id;
              }
              return cleaned;
            })
          };
          
          console.log(`[OfflineSync] Payload limpo para ${operation.table}:`, JSON.stringify(insertPayload).substring(0, 300));
          result = await supabase.from(operation.table).insert(insertPayload).select().single();
        } else {
          // Tratamento especial para producao_equipes: remover campo atividades (vai para producao_atividades separadamente)
          let atividadesParaInserir: any[] | null = null;
          if (operation.table === "producao_equipes" && insertPayload.atividades) {
            atividadesParaInserir = insertPayload.atividades;
            const { atividades, pendente_sync, ...payloadSemAtividades } = insertPayload;
            insertPayload = payloadSemAtividades;
          }
          
          console.log(`[OfflineSync] Payload limpo para ${operation.table}:`, JSON.stringify(insertPayload).substring(0, 300));
          result = await supabase.from(operation.table).insert(insertPayload).select().single();
          
          // Se houver atividades para inserir, inserir na tabela producao_atividades
          if (atividadesParaInserir && result?.data) {
            const producaoId = result.data.id;
            const atividadesPayload = atividadesParaInserir.map((atv: any) => ({
              producao_id: producaoId,
              atividade_id: atv.atividade_id,
              atividade_codigo: atv.atividade_codigo,
              atividade_descricao: atv.atividade_descricao,
              quantidade: atv.quantidade,
              valor_unitario: atv.valor_unitario || 0,
              valor_total: atv.valor_total || 0,
              qtd_min_fotos: atv.qtd_min_fotos || 0,
            }));
            
            const { error: atividadesError } = await supabase
              .from("producao_atividades")
              .insert(atividadesPayload);
            
            if (atividadesError) {
              console.error("[OfflineSync] Erro ao inserir atividades da produção:", atividadesError);
              // Não falhar a operação principal se atividades falharem
            } else {
              console.log(`[OfflineSync] ${atividadesPayload.length} atividade(s) inserida(s) para produção ${producaoId}`);
            }
          }
        }
      } else if (operation.action === "update") {
        // Remover campos auxiliares que não devem ir para o banco
        const { numero_os, ...cleanPayload } = operation.payload;
        
        // Tratamento especial para update_apr: verificar se ID é válido
        if (operation.type === "update_apr" && operation.table === "checklist_respostas") {
          const { id, ...data } = cleanPayload;
          
          // Se o ID não é um UUID válido, tentar encontrar pelo ordem_servico_id e checklist_id
          if (id && typeof id === 'string' && !isValidUUID(id)) {
            console.log(`[OfflineSync] ID inválido para update_apr, buscando APR existente...`);
            const { data: existingAPR } = await supabase
              .from("checklist_respostas")
              .select("id")
              .eq("ordem_servico_id", data.ordem_servico_id)
              .eq("checklist_id", data.checklist_id)
              .maybeSingle();
            
            if (existingAPR) {
              console.log(`[OfflineSync] APR encontrada (ID: ${existingAPR.id}), fazendo UPDATE`);
              result = await supabase.from(operation.table).update(data).eq("id", existingAPR.id);
            } else {
              // Se não encontrou, fazer INSERT
              console.log(`[OfflineSync] APR não encontrada, fazendo INSERT`);
              const { id: _, ...insertData } = data;
              result = await supabase.from(operation.table).insert(insertData).select().single();
            }
          } else {
            result = await supabase.from(operation.table).update(data).eq("id", id);
          }
        } else {
        const { id, ...data } = cleanPayload;
        result = await supabase.from(operation.table).update(data).eq("id", id);
        }
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

  // Sincronizar todas as operações pendentes (com mutex global para evitar execuções paralelas)
  const syncPendingOperations = useCallback(async () => {
    // Verificação rápida antes do mutex para evitar enfileirar desnecessariamente
    if (!navigator.onLine) {
      console.log(`[OfflineSync] Sincronização ignorada - offline`);
      return;
    }

    // Debounce: ignorar se a última tentativa foi há menos de 1000ms
    const now = Date.now();
    if (now - lastSyncAttempt.current < 1000) {
      console.log(`[OfflineSync] Sincronização ignorada - debounce (${now - lastSyncAttempt.current}ms desde última tentativa)`);
      return;
    }
    lastSyncAttempt.current = now;

    // Verificar se já está em progresso localmente
    if (syncInProgress.current) {
      console.log(`[OfflineSync] Sincronização ignorada - já em progresso (local)`);
      return;
    }

    // Tentar adquirir o mutex global (via localStorage)
    if (!acquireSyncLock()) {
      console.log(`[OfflineSync] Sincronização ignorada - outra instância está sincronizando (mutex global)`);
      return;
    }

    // Verificar novamente após adquirir o mutex
    if (!navigator.onLine) {
      console.log(`[OfflineSync] Sincronização ignorada - ficou offline durante espera`);
      releaseSyncLock();
      return;
    }
    
    console.log(`[OfflineSync] Iniciando sincronização (lock adquirido)...`);
    syncInProgress.current = true;
    setIsSyncing(true);
    
    try {
      // Primeiro recarregar as operações do estado local (que foram adicionadas durante offline)
      console.log(`[OfflineSync] Estado local tem ${pendingOperations.length} operações`);
      
      const db = await openDB();
      const transaction = db.transaction(QUEUE_STORE, "readonly");
      const store = transaction.objectStore(QUEUE_STORE);
      
      const operations = await new Promise<SyncOperation[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          console.log(`[OfflineSync] IndexedDB retornou ${request.result?.length || 0} operações`);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });

      // Se o IndexedDB está vazio mas temos operações no estado local, usar o estado local
      // Isso pode acontecer se o IndexedDB não persistiu corretamente
      if (operations.length === 0 && pendingOperations.length > 0) {
        console.warn(`[OfflineSync] ⚠️ IndexedDB vazio mas estado local tem ${pendingOperations.length} operações! Tentando re-persistir...`);
        
        // Tentar re-persistir as operações do estado local
        const writeTransaction = db.transaction(QUEUE_STORE, "readwrite");
        const writeStore = writeTransaction.objectStore(QUEUE_STORE);
        
        for (const op of pendingOperations) {
          try {
            await new Promise<void>((resolve, reject) => {
              const req = writeStore.put(op);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            });
            console.log(`[OfflineSync] Re-persistida operação: ${op.type} ${op.id}`);
          } catch (e) {
            console.error(`[OfflineSync] Erro ao re-persistir operação ${op.id}:`, e);
          }
        }
        
        // Usar operações do estado local
        operations.push(...pendingOperations);
      }

      // Ordenar por prioridade e data
      operations.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      // Filtrar apenas operações com menos de 5 tentativas
      const toSync = operations.filter(op => op.retries < 5);
      
      if (toSync.length === 0) {
        console.log("[OfflineSync] Nenhuma operação para sincronizar");
        // Limpar estado local se não tiver operações válidas
        if (pendingOperations.length > 0) {
          setPendingOperations([]);
        }
        setIsSyncing(false);
        syncInProgress.current = false;
        releaseSyncLock();
        return;
      }

      console.log(`[OfflineSync] Sincronizando ${toSync.length} operações...`);
      
      // Filtrar operações duplicadas de APR para a mesma OS e checklist
      const aprOperations = new Map<string, SyncOperation>();
      const otherOperations: SyncOperation[] = [];
      
      for (const operation of toSync) {
        if (operation.table === "checklist_respostas" && 
            (operation.type === "save_apr" || operation.type === "update_apr") &&
            operation.payload?.ordem_servico_id && 
            operation.payload?.checklist_id) {
          // Criar chave única para APR (OS + checklist)
          const aprKey = `${operation.payload.ordem_servico_id}_${operation.payload.checklist_id}`;
          
          // Manter apenas a operação mais recente para cada APR
          const existing = aprOperations.get(aprKey);
          if (!existing || new Date(operation.created_at) > new Date(existing.created_at)) {
            // Se já existe uma operação mais antiga, remover ela
            if (existing) {
              console.log(`[OfflineSync] Removendo operação duplicada de APR (mais antiga) para OS ${operation.payload.ordem_servico_id}, checklist ${operation.payload.checklist_id}`);
              await removeOperation(existing.id);
            }
            aprOperations.set(aprKey, operation);
          } else {
            console.log(`[OfflineSync] Removendo operação duplicada de APR (mais antiga) para OS ${operation.payload.ordem_servico_id}, checklist ${operation.payload.checklist_id}`);
            // Remover a operação duplicada mais antiga
            await removeOperation(operation.id);
          }
        } else {
          otherOperations.push(operation);
        }
      }
      
      // Combinar operações únicas de APR com outras operações
      const uniqueOperations = [...Array.from(aprOperations.values()), ...otherOperations];
      
      // Ordenar novamente por prioridade e data
      uniqueOperations.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      
      console.log(`[OfflineSync] Após remover duplicatas: ${uniqueOperations.length} operações únicas`);
      
      let successCount = 0;
      let errorCount = 0;

      for (const operation of uniqueOperations) {
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
      releaseSyncLock();
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
  const getFromCache = useCallback(async <T,>(key: string): Promise<T | null> => {
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

  // Limpar apenas operações com erro (retries >= 5)
  const clearFailedOperations = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(QUEUE_STORE, "readwrite");
      const store = transaction.objectStore(QUEUE_STORE);
      
      // Buscar todas as operações
      const allOperations = await new Promise<SyncOperation[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Filtrar operações com erro (retries >= 5)
      const failedOperations = allOperations.filter(op => op.retries >= 5);
      
      if (failedOperations.length === 0) {
        console.log("[OfflineSync] Nenhuma operação com erro para limpar");
        return 0;
      }

      // Remover cada operação com erro
      for (const op of failedOperations) {
        await new Promise<void>((resolve, reject) => {
          const request = store.delete(op.id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      // Atualizar lista local
      setPendingOperations(prev => prev.filter(op => op.retries < 5));
      
      console.log(`[OfflineSync] ${failedOperations.length} operação(ões) com erro removida(s)`);
      return failedOperations.length;
    } catch (error) {
      console.error("[OfflineSync] Erro ao limpar operações com erro:", error);
      throw error;
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
    clearFailedOperations,
    
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

