/**
 * Serviço de previsão do tempo usando Open Meteo API (gratuita, sem API key)
 * Docs: https://open-meteo.com/
 */

export interface PrevisaoTempo {
  data: string; // ISO date (YYYY-MM-DD)
  temperaturaMax: number;
  temperaturaMin: number;
  codigoClima: number; // WMO Weather interpretation codes
  descricaoClima: string;
  icone: string;
  precipitacao: number; // mm
  probabilidadeChuva: number; // %
  velocidadeVento: number; // km/h
}

// Mapeamento de códigos WMO para descrições em português e ícones
const WMO_CODES: Record<number, { descricao: string; icone: string }> = {
  0: { descricao: "Céu limpo", icone: "☀️" },
  1: { descricao: "Principalmente limpo", icone: "🌤️" },
  2: { descricao: "Parcialmente nublado", icone: "⛅" },
  3: { descricao: "Nublado", icone: "☁️" },
  45: { descricao: "Neblina", icone: "🌫️" },
  48: { descricao: "Neblina com geada", icone: "🌫️" },
  51: { descricao: "Garoa leve", icone: "🌧️" },
  53: { descricao: "Garoa moderada", icone: "🌧️" },
  55: { descricao: "Garoa densa", icone: "🌧️" },
  56: { descricao: "Garoa congelante leve", icone: "🌧️" },
  57: { descricao: "Garoa congelante densa", icone: "🌧️" },
  61: { descricao: "Chuva leve", icone: "🌦️" },
  63: { descricao: "Chuva moderada", icone: "🌧️" },
  65: { descricao: "Chuva forte", icone: "🌧️" },
  66: { descricao: "Chuva congelante leve", icone: "🌧️" },
  67: { descricao: "Chuva congelante forte", icone: "🌧️" },
  71: { descricao: "Neve leve", icone: "🌨️" },
  73: { descricao: "Neve moderada", icone: "🌨️" },
  75: { descricao: "Neve forte", icone: "🌨️" },
  77: { descricao: "Grãos de neve", icone: "🌨️" },
  80: { descricao: "Pancadas de chuva leves", icone: "🌦️" },
  81: { descricao: "Pancadas de chuva moderadas", icone: "🌧️" },
  82: { descricao: "Pancadas de chuva violentas", icone: "⛈️" },
  85: { descricao: "Pancadas de neve leves", icone: "🌨️" },
  86: { descricao: "Pancadas de neve fortes", icone: "🌨️" },
  95: { descricao: "Tempestade", icone: "⛈️" },
  96: { descricao: "Tempestade com granizo leve", icone: "⛈️" },
  99: { descricao: "Tempestade com granizo forte", icone: "⛈️" },
};

function getClimaInfo(codigo: number): { descricao: string; icone: string } {
  return WMO_CODES[codigo] || { descricao: "Desconhecido", icone: "❓" };
}

/**
 * Busca previsão do tempo para uma localização específica
 * @param latitude Latitude da localização
 * @param longitude Longitude da localização
 * @param dias Número de dias para previsão (máximo 16)
 */
export async function buscarPrevisaoTempo(
  latitude: number,
  longitude: number,
  dias: number = 10
): Promise<PrevisaoTempo[]> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", latitude.toString());
    url.searchParams.set("longitude", longitude.toString());
    url.searchParams.set("daily", [
      "weathercode",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "windspeed_10m_max"
    ].join(","));
    url.searchParams.set("timezone", "America/Sao_Paulo");
    url.searchParams.set("forecast_days", Math.min(dias, 16).toString());

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error("[WeatherService] Erro na API:", response.statusText);
      return [];
    }

    const data = await response.json();
    
    if (!data.daily) {
      console.error("[WeatherService] Dados inválidos:", data);
      return [];
    }

    const previsoes: PrevisaoTempo[] = data.daily.time.map((dataStr: string, index: number) => {
      const codigo = data.daily.weathercode[index] || 0;
      const climaInfo = getClimaInfo(codigo);
      
      return {
        data: dataStr,
        temperaturaMax: Math.round(data.daily.temperature_2m_max[index] || 0),
        temperaturaMin: Math.round(data.daily.temperature_2m_min[index] || 0),
        codigoClima: codigo,
        descricaoClima: climaInfo.descricao,
        icone: climaInfo.icone,
        precipitacao: data.daily.precipitation_sum[index] || 0,
        probabilidadeChuva: data.daily.precipitation_probability_max[index] || 0,
        velocidadeVento: Math.round(data.daily.windspeed_10m_max[index] || 0),
      };
    });

    return previsoes;
  } catch (error) {
    console.error("[WeatherService] Erro ao buscar previsão:", error);
    return [];
  }
}

/**
 * Cache simples para previsões de tempo por localização
 */
const cachePrevisoes = new Map<string, { previsoes: PrevisaoTempo[]; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

export async function buscarPrevisaoTempoComCache(
  latitude: number,
  longitude: number,
  dias: number = 10
): Promise<PrevisaoTempo[]> {
  // Arredondar coordenadas para 2 casas decimais para cache mais eficiente
  const latRounded = Math.round(latitude * 100) / 100;
  const lngRounded = Math.round(longitude * 100) / 100;
  const cacheKey = `${latRounded},${lngRounded},${dias}`;
  
  const cached = cachePrevisoes.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("[WeatherService] Usando cache para", cacheKey);
    return cached.previsoes;
  }

  const previsoes = await buscarPrevisaoTempo(latRounded, lngRounded, dias);
  
  if (previsoes.length > 0) {
    cachePrevisoes.set(cacheKey, { previsoes, timestamp: Date.now() });
  }

  return previsoes;
}

/**
 * Retorna a cor de fundo baseada nas condições climáticas
 */
export function getCorClima(codigo: number): string {
  // Céu limpo/parcialmente nublado
  if (codigo <= 2) return "bg-sky-50 border-sky-200";
  // Nublado
  if (codigo === 3) return "bg-slate-100 border-slate-300";
  // Neblina
  if (codigo === 45 || codigo === 48) return "bg-gray-100 border-gray-300";
  // Garoa
  if (codigo >= 51 && codigo <= 57) return "bg-blue-50 border-blue-200";
  // Chuva
  if (codigo >= 61 && codigo <= 67) return "bg-blue-100 border-blue-300";
  // Neve
  if (codigo >= 71 && codigo <= 77) return "bg-indigo-50 border-indigo-200";
  // Pancadas
  if (codigo >= 80 && codigo <= 86) return "bg-blue-100 border-blue-300";
  // Tempestade
  if (codigo >= 95) return "bg-purple-100 border-purple-300";
  
  return "bg-white border-gray-200";
}

/**
 * Retorna se o clima é favorável para trabalho externo
 */
export function climaFavoravel(codigo: number, precipitacao: number): boolean {
  // Desfavorável: chuva forte, tempestade, granizo
  if (codigo >= 65 || codigo >= 82 || codigo >= 95) return false;
  // Desfavorável: precipitação acima de 10mm
  if (precipitacao > 10) return false;
  return true;
}
