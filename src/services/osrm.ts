// Serviço para comunicação com a API OSRM (Open Source Routing Machine)
// API pública: https://router.project-osrm.org

export interface OSRMRouteResponse {
  code: string;
  routes: Array<{
    geometry: {
      coordinates: [number, number][]; // [longitude, latitude]
      type: string;
    };
    distance: number; // em metros
    duration: number; // em segundos
    legs: Array<{
      distance: number;
      duration: number;
      steps: any[];
    }>;
  }>;
  waypoints: Array<{
    location: [number, number]; // [longitude, latitude]
    name: string;
  }>;
}

export interface RouteGeometry {
  coordinates: [number, number][]; // [longitude, latitude] para GeoJSON
  duration: number; // em segundos
  distance: number; // em metros
}

export interface OSRMTableResponse {
  code: string;
  durations: number[][]; // Matriz: durations[origem][destino] = tempo em segundos
  distances?: number[][]; // Matriz opcional de distâncias
  sources?: any[];
  destinations?: any[];
}

// Cache em memória: chave é uma string concatenada das coordenadas
const routeCache = new Map<string, RouteGeometry>();
const matrixCache = new Map<string, number[][]>();

// Base URL (HTTPS evita problemas de mixed-content em produção)
const OSRM_BASE_URL = "https://router.project-osrm.org";

/**
 * Gera uma chave única para o cache baseada nas coordenadas
 */
function generateCacheKey(coords: [number, number][]): string {
  return coords.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join('|');
}

/**
 * Converte coordenadas de Leaflet (Lat, Lon) para OSRM (Lon, Lat)
 */
function convertToOSRMFormat(coords: [number, number][]): [number, number][] {
  return coords.map(([lat, lon]) => [lon, lat]);
}

/**
 * Converte coordenadas de OSRM (Lon, Lat) para Leaflet (Lat, Lon)
 */
function convertToLeafletFormat(coords: [number, number][]): [number, number][] {
  return coords.map(([lon, lat]) => [lat, lon]);
}

/**
 * Busca uma rota do OSRM entre múltiplos pontos
 * @param coords Array de coordenadas [latitude, longitude] (formato Leaflet)
 * @returns Promise com a geometria da rota, duração e distância
 */
export async function buscarRotaOSRM(
  coords: [number, number][]
): Promise<RouteGeometry> {
  if (coords.length < 2) {
    throw new Error('É necessário pelo menos 2 pontos para calcular uma rota');
  }

  // Verificar cache
  const cacheKey = generateCacheKey(coords);
  const cached = routeCache.get(cacheKey);
  if (cached) {
    console.log('[OSRM] Rota encontrada no cache');
    return cached;
  }

  try {
    // Converter para formato OSRM (Lon, Lat)
    const osrmCoords = convertToOSRMFormat(coords);
    
    // Construir URL da API
    const coordsString = osrmCoords.map(([lon, lat]) => `${lon},${lat}`).join(';');
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

    console.log('[OSRM] Buscando rota:', url);

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro na API OSRM: ${response.status} ${response.statusText}`);
    }

    const data: OSRMRouteResponse = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(`OSRM retornou erro: ${data.code}`);
    }

    const route = data.routes[0];
    
    // Extrair coordenadas, duração e distância
    const geometry: RouteGeometry = {
      coordinates: route.geometry.coordinates, // Já está em [lon, lat] para GeoJSON
      duration: route.duration, // em segundos
      distance: route.distance, // em metros
    };

    // Armazenar no cache
    routeCache.set(cacheKey, geometry);
    console.log('[OSRM] Rota calculada e armazenada no cache');

    return geometry;
  } catch (error) {
    console.error('[OSRM] Erro ao buscar rota:', error);
    
    // Em caso de erro, retornar uma rota reta como fallback
    console.warn('[OSRM] Usando rota reta como fallback');
    const fallbackCoords = convertToOSRMFormat(coords);
    return {
      coordinates: fallbackCoords,
      duration: 0, // Será calculado depois
      distance: 0, // Será calculado depois
    };
  }
}

/**
 * Busca rota entre dois pontos (caso comum)
 */
export async function buscarRotaEntrePontos(
  origem: [number, number], // [lat, lon]
  destino: [number, number] // [lat, lon]
): Promise<RouteGeometry> {
  return buscarRotaOSRM([origem, destino]);
}

/**
 * Limpa o cache de rotas
 */
export function limparCacheOSRM(): void {
  routeCache.clear();
  console.log('[OSRM] Cache limpo');
}

/**
 * Retorna o tamanho atual do cache
 */
export function tamanhoCacheOSRM(): number {
  return routeCache.size;
}

/**
 * Busca matriz de tempos de viagem (Table API) entre múltiplos pontos
 * Retorna uma matriz onde matrix[origem][destino] = tempo em segundos
 * @param locations Array de coordenadas [latitude, longitude] (formato Leaflet)
 * @returns Promise com matriz bidimensional de durações em segundos
 */
export async function getTravelTimeMatrix(
  locations: [number, number][]
): Promise<number[][]> {
  if (locations.length === 0) {
    throw new Error('É necessário pelo menos um ponto para calcular a matriz');
  }

  // Limite da API OSRM pública (URL muito longa causa erro 400)
  const MAX_LOCATIONS = 100;
  if (locations.length > MAX_LOCATIONS) {
    throw new Error(`Muitos pontos para OSRM: ${locations.length} (máximo: ${MAX_LOCATIONS}). Usando cálculo Haversine.`);
  }

  // Verificar cache
  const cacheKey = generateCacheKey(locations);
  const cached = matrixCache.get(cacheKey);
  if (cached) {
    console.log('[OSRM] Matriz encontrada no cache');
    return cached;
  }

  // Verificar se há coordenadas inválidas
  for (let i = 0; i < locations.length; i++) {
    const [lat, lon] = locations[i];
    if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error(`Coordenada inválida no índice ${i}: [${lat}, ${lon}]`);
    }
  }

  try {
    // Converter para formato OSRM (Lon, Lat)
    const osrmCoords = convertToOSRMFormat(locations);
    
    // Construir URL da API Table
    const coordsString = osrmCoords.map(([lon, lat]) => `${lon},${lat}`).join(';');
    const url = `${OSRM_BASE_URL}/table/v1/driving/${coordsString}?annotations=duration`;

    // Verificar tamanho da URL (limite prático é ~8000 caracteres)
    if (url.length > 8000) {
      throw new Error(`URL muito longa (${url.length} chars). Reduza o número de pontos.`);
    }

    console.log(`[OSRM] Buscando matriz de tempos para ${locations.length} pontos...`);

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Erro na API OSRM Table: ${response.status} ${response.statusText}. ${errorBody}`);
    }

    const data: OSRMTableResponse = await response.json();

    if (data.code !== 'Ok' || !data.durations) {
      throw new Error(`OSRM Table retornou código de erro: ${data.code}`);
    }

    // Validar que a matriz tem o tamanho esperado
    const expectedSize = locations.length;
    if (data.durations.length !== expectedSize) {
      throw new Error(`Matriz retornada tem tamanho incorreto: esperado ${expectedSize}, recebido ${data.durations.length}`);
    }

    // Validar que cada linha tem o tamanho correto
    for (let i = 0; i < data.durations.length; i++) {
      if (data.durations[i].length !== expectedSize) {
        throw new Error(`Linha ${i} da matriz tem tamanho incorreto: esperado ${expectedSize}, recebido ${data.durations[i].length}`);
      }
    }

    console.log(`[OSRM] ✅ Matriz ${expectedSize}x${expectedSize} calculada com sucesso`);
    
    // Armazenar no cache
    matrixCache.set(cacheKey, data.durations);
    
    return data.durations;
  } catch (error) {
    console.error('[OSRM] Erro ao buscar matriz de tempos:', error);
    // Não fazer fallback aqui - deixar o erro propagar para que o algoritmo use Haversine
    throw error;
  }
}

