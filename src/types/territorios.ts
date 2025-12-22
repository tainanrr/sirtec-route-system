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

import { supabase } from "@/integrations/supabase/client";

// Converter do formato do banco para o formato da interface
function dbToTerritorio(db: any): Territorio {
  return {
    id: db.id,
    nome: db.nome,
    cor: db.cor,
    poligono: db.poligono || [],
    equipeIds: db.equipe_ids || [],
    ativo: db.ativo ?? true,
    criadoEm: new Date(db.created_at),
    atualizadoEm: new Date(db.updated_at),
  };
}

// Converter do formato da interface para o formato do banco
function territorioToDb(territorio: Territorio): any {
  return {
    nome: territorio.nome,
    cor: territorio.cor,
    poligono: territorio.poligono,
    equipe_ids: territorio.equipeIds || [],
    ativo: territorio.ativo ?? true,
  };
}

export async function carregarTerritorios(): Promise<Territorio[]> {
  try {
    const { data, error } = await supabase
      .from("territorios")
      .select("*")
      .order("nome");

    if (error) {
      console.error("Erro ao carregar territórios:", error);
      return [];
    }

    return (data || []).map(dbToTerritorio);
  } catch (e) {
    console.error("Erro ao carregar territórios:", e);
    return [];
  }
}

export async function salvarTerritorio(territorio: Territorio): Promise<Territorio | null> {
  try {
    const dbData = territorioToDb(territorio);

    if (territorio.id && territorio.id.startsWith("territorio-")) {
      // Novo território (ID temporário do localStorage)
      const { data, error } = await supabase
        .from("territorios")
        .insert(dbData)
        .select()
        .single();

      if (error) {
        console.error("Erro ao criar território:", error);
        return null;
      }

      return dbToTerritorio(data);
    } else {
      // Atualizar território existente
      const { data, error } = await supabase
        .from("territorios")
        .update(dbData)
        .eq("id", territorio.id)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar território:", error);
        return null;
      }

      return dbToTerritorio(data);
    }
  } catch (e) {
    console.error("Erro ao salvar território:", e);
    return null;
  }
}

export async function salvarTerritorios(territorios: Territorio[]): Promise<void> {
  try {
    // Salvar todos os territórios (criar ou atualizar)
    for (const territorio of territorios) {
      await salvarTerritorio(territorio);
    }
  } catch (e) {
    console.error("Erro ao salvar territórios:", e);
  }
}

export async function deletarTerritorio(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("territorios")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao deletar território:", error);
      return false;
    }

    return true;
  } catch (e) {
    console.error("Erro ao deletar território:", e);
    return false;
  }
}



