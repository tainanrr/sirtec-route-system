/**
 * Utilitário para gerar URLs do Google Street View Static API
 * 
 * CONFIGURAÇÃO NECESSÁRIA:
 * 1. Criar uma variável de ambiente VITE_GOOGLE_MAPS_API_KEY com sua chave de API
 * 2. A chave deve ter a Street View Static API habilitada no Google Cloud Console
 * 
 * @see https://developers.google.com/maps/documentation/streetview/overview
 */

export interface StreetViewOptions {
  /** Latitude da localização */
  latitude: number;
  /** Longitude da localização */
  longitude: number;
  /** Largura da imagem em pixels (máx 640 para plano gratuito) */
  width?: number;
  /** Altura da imagem em pixels (máx 640 para plano gratuito) */
  height?: number;
  /** Direção da câmera em graus (0-360, 0=Norte) */
  heading?: number;
  /** Inclinação da câmera em graus (-90 a 90) */
  pitch?: number;
  /** Campo de visão (10-120, menor = mais zoom) */
  fov?: number;
  /** Tamanho do raio em metros para buscar a imagem mais próxima */
  radius?: number;
  /** Fonte da imagem: "default" ou "outdoor" */
  source?: "default" | "outdoor";
}

export interface StreetViewMetadata {
  status: "OK" | "ZERO_RESULTS" | "NOT_FOUND" | "OVER_QUERY_LIMIT" | "REQUEST_DENIED" | "INVALID_REQUEST" | "UNKNOWN_ERROR";
  copyright?: string;
  date?: string;
  location?: {
    lat: number;
    lng: number;
  };
  pano_id?: string;
}

/**
 * Gera a URL da imagem do Street View
 */
export function getStreetViewImageUrl(options: StreetViewOptions): string | null {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn("[StreetView] API Key não configurada. Configure VITE_GOOGLE_MAPS_API_KEY no arquivo .env");
    return null;
  }

  const {
    latitude,
    longitude,
    width = 600,
    height = 400,
    heading = 0,
    pitch = 0,
    fov = 90,
    radius = 100,
    source = "outdoor",
  } = options;

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${latitude},${longitude}`,
    heading: heading.toString(),
    pitch: pitch.toString(),
    fov: fov.toString(),
    radius: radius.toString(),
    source,
    key: apiKey,
  });

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

/**
 * Verifica se existe imagem do Street View para as coordenadas
 */
export async function checkStreetViewAvailability(
  latitude: number,
  longitude: number
): Promise<StreetViewMetadata | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return null;
  }

  const params = new URLSearchParams({
    location: `${latitude},${longitude}`,
    radius: "100",
    key: apiKey,
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[StreetView] Erro ao verificar disponibilidade:", error);
    return null;
  }
}

/**
 * Calcula o heading (direção da câmera) para uma localização específica
 * Útil quando se quer apontar a câmera para um ponto específico
 */
export function calculateHeading(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const heading = (Math.atan2(y, x) * 180) / Math.PI;
  return (heading + 360) % 360;
}

/**
 * URL de placeholder quando não há imagem do Street View disponível
 */
export function getStreetViewPlaceholderUrl(): string {
  return "/placeholder.svg";
}
