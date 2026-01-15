/**
 * Hook para pré-carregar imagens do Street View das OSs planejadas
 * 
 * Uso típico: chamar no início do turno ou quando as OSs são carregadas
 */

import { useState, useCallback } from "react";
import { 
  preloadStreetViewImages, 
  getStreetViewCacheStats,
  clearStreetViewCache,
  isCacheAvailable 
} from "@/lib/streetViewCache";
import { toast } from "sonner";

interface PreloadProgress {
  isLoading: boolean;
  current: number;
  total: number;
  currentOS?: string;
}

interface PreloadResult {
  cached: number;
  failed: number;
  skipped: number;
}

interface OSComCoordenadas {
  id: string;
  numero?: string;
  latitude: number | null;
  longitude: number | null;
}

export function useStreetViewPreload() {
  const [progress, setProgress] = useState<PreloadProgress>({
    isLoading: false,
    current: 0,
    total: 0,
  });
  const [lastResult, setLastResult] = useState<PreloadResult | null>(null);

  /**
   * Pré-carrega imagens do Street View para uma lista de OSs
   * Exibe toast de progresso e resultado
   */
  const preloadImages = useCallback(async (
    ordens: OSComCoordenadas[],
    showToast: boolean = true
  ): Promise<PreloadResult | null> => {
    if (!isCacheAvailable()) {
      if (showToast) {
        toast.error("Cache não disponível neste navegador");
      }
      return null;
    }

    if (ordens.length === 0) {
      if (showToast) {
        toast.info("Nenhuma OS para baixar fachadas");
      }
      return { cached: 0, failed: 0, skipped: 0 };
    }

    // Filtrar OSs com coordenadas
    const osComCoord = ordens.filter(
      (os) => os.latitude != null && os.longitude != null
    );

    if (osComCoord.length === 0) {
      if (showToast) {
        toast.info("Nenhuma OS com coordenadas para baixar fachadas");
      }
      return { cached: 0, failed: 0, skipped: ordens.length };
    }

    setProgress({ isLoading: true, current: 0, total: osComCoord.length });

    let toastId: string | number | undefined;
    if (showToast) {
      toastId = toast.loading(`Baixando fachadas: 0/${osComCoord.length}...`, {
        duration: Infinity,
      });
    }

    try {
      const result = await preloadStreetViewImages(
        osComCoord,
        (current, total, osNumero) => {
          setProgress({ 
            isLoading: true, 
            current, 
            total, 
            currentOS: osNumero 
          });
          
          if (toastId) {
            toast.loading(`Baixando fachadas: ${current}/${total}...`, {
              id: toastId,
            });
          }
        }
      );

      const finalResult: PreloadResult = {
        cached: result.cached,
        failed: result.failed,
        skipped: result.skipped,
      };

      setLastResult(finalResult);

      if (showToast) {
        if (result.cached > 0) {
          toast.success(
            `✅ ${result.cached} fachadas baixadas para uso offline!`,
            { id: toastId, duration: 4000 }
          );
        } else if (result.failed > 0) {
          toast.warning(
            `⚠️ ${result.failed} fachadas não puderam ser baixadas`,
            { id: toastId, duration: 4000 }
          );
        } else {
          toast.info("Nenhuma nova fachada para baixar", {
            id: toastId,
            duration: 3000,
          });
        }
      }

      return finalResult;
    } catch (error) {
      console.error("[useStreetViewPreload] Erro:", error);
      if (showToast) {
        toast.error("Erro ao baixar fachadas", { id: toastId });
      }
      return null;
    } finally {
      setProgress({ isLoading: false, current: 0, total: 0 });
    }
  }, []);

  /**
   * Obtém estatísticas do cache atual
   */
  const getCacheStats = useCallback(async () => {
    return await getStreetViewCacheStats();
  }, []);

  /**
   * Limpa todo o cache de fachadas
   */
  const clearCache = useCallback(async (showToast: boolean = true) => {
    const success = await clearStreetViewCache();
    if (showToast) {
      if (success) {
        toast.success("Cache de fachadas limpo!");
      } else {
        toast.error("Erro ao limpar cache");
      }
    }
    return success;
  }, []);

  return {
    preloadImages,
    getCacheStats,
    clearCache,
    progress,
    lastResult,
    isAvailable: isCacheAvailable(),
  };
}
