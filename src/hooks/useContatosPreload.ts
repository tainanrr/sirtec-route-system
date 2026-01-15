/**
 * Hook para pré-carregar contatos extraídos das observações das OSs usando IA
 * 
 * Uso típico: chamar quando as OSs são carregadas no app (junto com o preload de fachadas)
 * Os contatos são salvos no IndexedDB para uso offline
 */

import { useState, useCallback, useRef } from "react";
import { extrairContatosComIA, type ContatoIA } from "@/lib/contatoExtractorIA";
import { toast } from "sonner";

// Nome do IndexedDB e store para cache de contatos
const DB_NAME = "contatos_cache";
const STORE_NAME = "contatos_os";
const DB_VERSION = 1;

interface PreloadProgress {
  isLoading: boolean;
  current: number;
  total: number;
  currentOS?: string;
}

interface PreloadResult {
  processed: number;
  withContacts: number;
  failed: number;
  skipped: number;
}

interface OSComObservacao {
  id: string;
  numero?: string;
  observacoes: string | null;
  contatos_extraidos?: ContatoIA[] | null;
}

/**
 * Abre conexão com IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "os_id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

/**
 * Salva contatos no cache
 */
async function saveToCache(osId: string, contatos: ContatoIA[]): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      
      store.put({
        os_id: osId,
        contatos,
        timestamp: Date.now(),
      });
      
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (error) {
    console.error("[useContatosPreload] Erro ao salvar cache:", error);
    return false;
  }
}

/**
 * Busca contatos do cache
 */
export async function getFromCache(osId: string): Promise<ContatoIA[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(osId);
      
      request.onsuccess = () => {
        db.close();
        const data = request.result;
        if (data && data.contatos) {
          resolve(data.contatos);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch (error) {
    console.error("[useContatosPreload] Erro ao buscar cache:", error);
    return null;
  }
}

/**
 * Limpa cache de contatos
 */
export async function clearContatosCache(): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (error) {
    console.error("[useContatosPreload] Erro ao limpar cache:", error);
    return false;
  }
}

/**
 * Verifica se IndexedDB está disponível
 */
export function isCacheAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function useContatosPreload() {
  const [progress, setProgress] = useState<PreloadProgress>({
    isLoading: false,
    current: 0,
    total: 0,
  });
  const [lastResult, setLastResult] = useState<PreloadResult | null>(null);
  const isProcessingRef = useRef(false);

  /**
   * Pré-carrega contatos para uma lista de OSs
   * Processa apenas OSs que têm observações e não têm contatos_extraidos
   */
  const preloadContatos = useCallback(async (
    ordens: OSComObservacao[],
    showToast: boolean = false
  ): Promise<PreloadResult | null> => {
    // Evita processamento duplicado
    if (isProcessingRef.current) {
      console.log("[useContatosPreload] Já está processando, ignorando chamada");
      return null;
    }

    if (!isCacheAvailable()) {
      console.warn("[useContatosPreload] IndexedDB não disponível");
      return null;
    }

    if (ordens.length === 0) {
      return { processed: 0, withContacts: 0, failed: 0, skipped: 0 };
    }

    // Filtrar apenas OSs que:
    // 1. Têm observações
    // 2. NÃO têm contatos_extraidos (null ou undefined ou array vazio)
    const osParaProcessar = ordens.filter(
      (os) => os.observacoes && 
              os.observacoes.trim().length > 10 && 
              (!os.contatos_extraidos || os.contatos_extraidos.length === 0)
    );

    if (osParaProcessar.length === 0) {
      console.log("[useContatosPreload] Nenhuma OS precisa de processamento de contatos");
      return { processed: 0, withContacts: 0, failed: 0, skipped: ordens.length };
    }

    isProcessingRef.current = true;
    setProgress({ isLoading: true, current: 0, total: osParaProcessar.length });

    let toastId: string | number | undefined;
    if (showToast) {
      toastId = toast.loading(`Identificando contatos: 0/${osParaProcessar.length}...`, {
        duration: Infinity,
      });
    } else {
      console.log(`[useContatosPreload] 📞 Iniciando extração de contatos para ${osParaProcessar.length} OSs...`);
    }

    let processed = 0;
    let withContacts = 0;
    let failed = 0;

    try {
      // Processar uma OS por vez para respeitar rate limits da API Gemini
      // O tier gratuito tem limites muito baixos (15 req/min)
      const DELAY_ENTRE_CHAMADAS = 5000; // 5 segundos entre cada chamada
      let rateLimitHit = false;
      
      for (let i = 0; i < osParaProcessar.length; i++) {
        // Se atingiu rate limit, parar
        if (rateLimitHit) break;
        
        const os = osParaProcessar[i];
        
        try {
          const resultado = await extrairContatosComIA(os.observacoes!);
          
          if (resultado.sucesso) {
            // Salvar no cache local (IndexedDB)
            await saveToCache(os.id, resultado.contatos);
            processed++;
            if (resultado.contatos.length > 0) {
              withContacts++;
            }
          } else {
            // Se foi erro de rate limit, parar o processamento
            if (resultado.erro?.includes("Limite de requisições") || resultado.erro?.includes("429")) {
              console.warn("[useContatosPreload] Rate limit atingido, pausando processamento");
              rateLimitHit = true;
            }
            failed++;
          }
        } catch (error) {
          console.error(`[useContatosPreload] Erro OS ${os.numero}:`, error);
          failed++;
        }

        // Atualizar progresso
        setProgress({ 
          isLoading: true, 
          current: i + 1, 
          total: osParaProcessar.length,
          currentOS: os.numero,
        });

        if (toastId) {
          toast.loading(`Identificando contatos: ${i + 1}/${osParaProcessar.length}...`, {
            id: toastId,
          });
        }

        // Delay entre chamadas para respeitar rate limit
        if (i + 1 < osParaProcessar.length && !rateLimitHit) {
          await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_CHAMADAS));
        }
      }

      const finalResult: PreloadResult = {
        processed,
        withContacts,
        failed,
        skipped: ordens.length - osParaProcessar.length,
      };

      setLastResult(finalResult);

      if (showToast) {
        if (withContacts > 0) {
          toast.success(
            `✅ ${withContacts} OSs com contatos identificados!`,
            { id: toastId, duration: 4000 }
          );
        } else if (processed > 0) {
          toast.info(
            `Processadas ${processed} OSs - nenhum contato encontrado`,
            { id: toastId, duration: 3000 }
          );
        } else {
          toast.dismiss(toastId);
        }
      } else {
        console.log(`[useContatosPreload] ✅ Concluído: ${withContacts} OSs com contatos de ${processed} processadas`);
      }

      return finalResult;
    } catch (error) {
      console.error("[useContatosPreload] Erro geral:", error);
      if (toastId) {
        toast.error("Erro ao identificar contatos", { id: toastId });
      }
      return null;
    } finally {
      isProcessingRef.current = false;
      setProgress({ isLoading: false, current: 0, total: 0 });
    }
  }, []);

  /**
   * Extrai contatos de uma única OS (para uso na web)
   */
  const extrairContatosOS = useCallback(async (
    observacoes: string
  ): Promise<ContatoIA[]> => {
    if (!observacoes || observacoes.trim().length < 10) {
      return [];
    }

    const resultado = await extrairContatosComIA(observacoes);
    return resultado.sucesso ? resultado.contatos : [];
  }, []);

  /**
   * Limpa todo o cache de contatos
   */
  const clearCache = useCallback(async (showToast: boolean = true) => {
    const success = await clearContatosCache();
    if (showToast) {
      if (success) {
        toast.success("Cache de contatos limpo!");
      } else {
        toast.error("Erro ao limpar cache");
      }
    }
    return success;
  }, []);

  return {
    preloadContatos,
    extrairContatosOS,
    getFromCache,
    clearCache,
    progress,
    lastResult,
    isAvailable: isCacheAvailable(),
    isLoading: progress.isLoading,
  };
}
