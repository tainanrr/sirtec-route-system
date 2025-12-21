/**
 * Utilitário para geocodificação de endereços usando Nominatim (OpenStreetMap)
 * Converte endereços em coordenadas (latitude/longitude)
 */

interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

// Cache de geocodificação para evitar chamadas repetidas
const geocodingCache = new Map<string, GeocodingResult | null>();

// Fila de requisições para respeitar rate limit do Nominatim (1 req/segundo)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 segundos entre requisições

/**
 * Normaliza um endereço para busca
 */
function normalizeAddress(endereco: string): string {
  return endereco
    .replace(/,\s*--[A-Z]?\s*,/gi, ',') // Remove marcadores como --B
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Aguarda o intervalo mínimo entre requisições
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Geocodifica um endereço usando Nominatim
 */
export async function geocodeAddress(endereco: string): Promise<GeocodingResult | null> {
  const normalizedAddress = normalizeAddress(endereco);
  
  // Verificar cache
  if (geocodingCache.has(normalizedAddress)) {
    return geocodingCache.get(normalizedAddress) || null;
  }
  
  try {
    // Respeitar rate limit
    await waitForRateLimit();
    
    // Adicionar "Brasil" ao final se não tiver país
    const searchAddress = normalizedAddress.toLowerCase().includes('brasil') 
      ? normalizedAddress 
      : `${normalizedAddress}, Brasil`;
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SirtecRoute/1.0 (Routing Application)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    
    if (!response.ok) {
      console.warn(`[GEOCODING] Erro HTTP ${response.status} para: ${normalizedAddress}`);
      geocodingCache.set(normalizedAddress, null);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result: GeocodingResult = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
      
      console.log(`[GEOCODING] Sucesso: ${normalizedAddress} -> (${result.latitude}, ${result.longitude})`);
      geocodingCache.set(normalizedAddress, result);
      return result;
    }
    
    console.warn(`[GEOCODING] Não encontrado: ${normalizedAddress}`);
    geocodingCache.set(normalizedAddress, null);
    return null;
  } catch (error) {
    console.error(`[GEOCODING] Erro ao geocodificar: ${normalizedAddress}`, error);
    geocodingCache.set(normalizedAddress, null);
    return null;
  }
}

/**
 * Geocodifica múltiplos endereços em lote
 * Respeita o rate limit do Nominatim
 */
export async function geocodeAddresses(
  enderecos: { id: string; endereco: string }[],
  onProgress?: (current: number, total: number, endereco: string) => void
): Promise<Map<string, GeocodingResult | null>> {
  const results = new Map<string, GeocodingResult | null>();
  
  for (let i = 0; i < enderecos.length; i++) {
    const { id, endereco } = enderecos[i];
    
    if (onProgress) {
      onProgress(i + 1, enderecos.length, endereco);
    }
    
    const result = await geocodeAddress(endereco);
    results.set(id, result);
  }
  
  return results;
}

/**
 * Limpa o cache de geocodificação
 */
export function clearGeocodingCache(): void {
  geocodingCache.clear();
}




