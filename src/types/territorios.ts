export interface Coordenada {
  lat: number;
  lng: number;
}

export interface Territorio {
  id: string;
  nome: string;
  cor: string;
  poligono: Coordenada[];
  equipeIds: string[]; // Múltiplas equipes podem ser vinculadas
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export const CORES_TERRITORIOS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1', '#06B6D4',
];

export function pontoNoPoligono(ponto: Coordenada, poligono: Coordenada[]): boolean {
  if (poligono.length < 3) return false;
  let dentro = false;
  const x = ponto.lng, y = ponto.lat;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i].lng, yi = poligono[i].lat;
    const xj = poligono[j].lng, yj = poligono[j].lat;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export function carregarTerritorios(): Territorio[] {
  try {
    const saved = localStorage.getItem('territorios');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Converter strings de data para objetos Date e migrar equipeId para equipeIds
      return parsed.map((t: any) => {
        // Migração: se tiver equipeId antigo, converter para equipeIds
        let equipeIds: string[] = [];
        if (t.equipeIds && Array.isArray(t.equipeIds)) {
          equipeIds = t.equipeIds;
        } else if (t.equipeId) {
          // Migrar de equipeId único para array
          equipeIds = [t.equipeId];
        }
        
        return {
          ...t,
          equipeIds,
          criadoEm: new Date(t.criadoEm),
          atualizadoEm: new Date(t.atualizadoEm),
        };
      });
    }
  } catch (e) {
    console.error('Erro ao carregar territórios:', e);
  }
  return [];
}

export function salvarTerritorios(territorios: Territorio[]): void {
  try {
    localStorage.setItem('territorios', JSON.stringify(territorios));
  } catch (e) {
    console.error('Erro ao salvar territórios:', e);
  }
}



