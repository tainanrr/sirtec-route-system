/**
 * Serviço de Cache para imagens do Google Street View
 * 
 * Permite pré-carregar imagens das OSs planejadas no início do turno
 * para que fiquem disponíveis offline durante o dia.
 */

import { getStreetViewImageUrl, StreetViewOptions } from "./streetView";

const CACHE_NAME = "streetview-images-v1";

interface CacheResult {
  success: boolean;
  cached: number;
  failed: number;
  skipped: number;
  errors: string[];
}

interface OSParaCache {
  id: string;
  numero?: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Verifica se o Cache API está disponível
 */
export function isCacheAvailable(): boolean {
  return "caches" in window;
}

/**
 * Pré-carrega imagens do Street View para uma lista de OSs
 * 
 * @param ordens Lista de OSs com coordenadas
 * @param onProgress Callback de progresso (opcional)
 * @returns Resultado do cache
 */
export async function preloadStreetViewImages(
  ordens: OSParaCache[],
  onProgress?: (current: number, total: number, osNumero?: string) => void
): Promise<CacheResult> {
  const result: CacheResult = {
    success: true,
    cached: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  if (!isCacheAvailable()) {
    result.success = false;
    result.errors.push("Cache API não disponível neste navegador");
    return result;
  }

  // Filtrar apenas OSs com coordenadas válidas
  const ordensComCoordenadas = ordens.filter(
    (os) => os.latitude != null && os.longitude != null && 
            !isNaN(os.latitude) && !isNaN(os.longitude)
  );

  result.skipped = ordens.length - ordensComCoordenadas.length;

  if (ordensComCoordenadas.length === 0) {
    console.log("[StreetViewCache] Nenhuma OS com coordenadas para cachear");
    return result;
  }

  console.log(`[StreetViewCache] Iniciando cache de ${ordensComCoordenadas.length} imagens...`);

  try {
    const cache = await caches.open(CACHE_NAME);

    for (let i = 0; i < ordensComCoordenadas.length; i++) {
      const os = ordensComCoordenadas[i];
      
      onProgress?.(i + 1, ordensComCoordenadas.length, os.numero);

      try {
        // Gerar URL da imagem
        const options: StreetViewOptions = {
          latitude: os.latitude!,
          longitude: os.longitude!,
          width: 600,
          height: 400,
          heading: 0,
          pitch: 0,
          fov: 90,
          radius: 100,
          source: "outdoor",
        };

        const imageUrl = getStreetViewImageUrl(options);
        
        if (!imageUrl) {
          result.skipped++;
          continue;
        }

        // Verificar se já está em cache
        const cachedResponse = await cache.match(imageUrl);
        if (cachedResponse) {
          console.log(`[StreetViewCache] OS ${os.numero || os.id} já em cache`);
          result.cached++;
          continue;
        }

        // Baixar e cachear a imagem
        const response = await fetch(imageUrl, { mode: "cors" });
        
        if (response.ok) {
          // Clonar a response antes de cachear (response só pode ser lida uma vez)
          await cache.put(imageUrl, response.clone());
          result.cached++;
          console.log(`[StreetViewCache] ✅ OS ${os.numero || os.id} cacheada`);
        } else {
          result.failed++;
          result.errors.push(`OS ${os.numero || os.id}: HTTP ${response.status}`);
        }
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
        result.errors.push(`OS ${os.numero || os.id}: ${errorMsg}`);
        console.warn(`[StreetViewCache] ❌ Erro ao cachear OS ${os.numero || os.id}:`, error);
      }

      // Pequeno delay para não sobrecarregar a API
      if (i < ordensComCoordenadas.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`[StreetViewCache] Concluído: ${result.cached} cacheadas, ${result.failed} falhas, ${result.skipped} puladas`);
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : "Erro ao abrir cache");
  }

  return result;
}

/**
 * Busca uma imagem do cache (se existir)
 * 
 * @param latitude Latitude
 * @param longitude Longitude
 * @returns URL do blob cacheado ou null
 */
export async function getStreetViewFromCache(
  latitude: number,
  longitude: number
): Promise<string | null> {
  if (!isCacheAvailable()) return null;

  try {
    const options: StreetViewOptions = {
      latitude,
      longitude,
      width: 600,
      height: 400,
      heading: 0,
      pitch: 0,
      fov: 90,
      radius: 100,
      source: "outdoor",
    };

    const imageUrl = getStreetViewImageUrl(options);
    if (!imageUrl) return null;

    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(imageUrl);

    if (cachedResponse) {
      // Converter para blob URL para uso offline
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    return null;
  } catch (error) {
    console.warn("[StreetViewCache] Erro ao buscar do cache:", error);
    return null;
  }
}

/**
 * Limpa o cache de imagens do Street View
 */
export async function clearStreetViewCache(): Promise<boolean> {
  if (!isCacheAvailable()) return false;

  try {
    return await caches.delete(CACHE_NAME);
  } catch (error) {
    console.error("[StreetViewCache] Erro ao limpar cache:", error);
    return false;
  }
}

/**
 * Retorna estatísticas do cache
 */
export async function getStreetViewCacheStats(): Promise<{
  available: boolean;
  count: number;
  sizeEstimate?: number;
}> {
  if (!isCacheAvailable()) {
    return { available: false, count: 0 };
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    // Estimar tamanho (se a API estiver disponível)
    let sizeEstimate: number | undefined;
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      sizeEstimate = estimate.usage;
    }

    return {
      available: true,
      count: keys.length,
      sizeEstimate,
    };
  } catch (error) {
    return { available: false, count: 0 };
  }
}
