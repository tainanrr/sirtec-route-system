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
  bairros: string[]; // Lista de bairros/localidades que pertencem a este território
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export const CORES_TERRITORIOS = [
  // Vermelhos
  '#EF4444', '#DC2626', '#B91C1C', '#991B1B',
  // Laranjas
  '#F97316', '#EA580C', '#C2410C', '#9A3412',
  // Amarelos
  '#EAB308', '#CA8A04', '#A16207', '#854D0E',
  // Verdes claros
  '#84CC16', '#65A30D', '#4D7C0F', '#3F6212',
  // Verdes
  '#22C55E', '#16A34A', '#15803D', '#166534',
  // Teais
  '#14B8A6', '#0D9488', '#0F766E', '#115E59',
  // Cyans
  '#06B6D4', '#0891B2', '#0E7490', '#155E75',
  // Azuis claros
  '#0EA5E9', '#0284C7', '#0369A1', '#075985',
  // Azuis
  '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF',
  // Índigos
  '#6366F1', '#4F46E5', '#4338CA', '#3730A3',
  // Violetas
  '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6',
  // Roxos
  '#A855F7', '#9333EA', '#7E22CE', '#6B21A8',
  // Fúcsias
  '#D946EF', '#C026D3', '#A21CAF', '#86198F',
  // Rosas
  '#EC4899', '#DB2777', '#BE185D', '#9D174D',
  // Marrons/Neutros
  '#78716C', '#57534E', '#44403C', '#292524',
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
    bairros: db.bairros || [],
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
    bairros: territorio.bairros || [],
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

/**
 * Atualiza o campo 'territorios' de todas as OSs pendentes/atrasadas
 * verificando em quais territórios cada OS está localizada
 */
export async function atualizarTerritoriosOSs(): Promise<{ atualizadas: number; erros: number }> {
  console.log("[Territórios] Iniciando atualização de territórios das OSs...");
  
  try {
    // 1. Carregar todos os territórios ativos
    const territorios = await carregarTerritorios();
    const territoriosAtivos = territorios.filter(t => t.ativo && t.poligono.length >= 3);
    console.log(`[Territórios] ${territoriosAtivos.length} territórios ativos encontrados`);
    
    if (territoriosAtivos.length === 0) {
      console.log("[Territórios] Nenhum território ativo para processar");
      return { atualizadas: 0, erros: 0 };
    }
    
    // 2. Carregar todas as OSs pendentes/atrasadas com coordenadas válidas
    const { data: ordensServico, error: osError } = await supabase
      .from("ordens_servico")
      .select("id, latitude, longitude, territorios")
      .in("status", ["pendente", "atrasada"])
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    
    if (osError) {
      console.error("[Territórios] Erro ao carregar OSs:", osError);
      return { atualizadas: 0, erros: 1 };
    }
    
    console.log(`[Territórios] ${ordensServico?.length || 0} OSs pendentes/atrasadas com coordenadas encontradas`);
    
    if (!ordensServico || ordensServico.length === 0) {
      return { atualizadas: 0, erros: 0 };
    }
    
    // 3. Para cada OS, verificar em quais territórios ela está
    let atualizadas = 0;
    let erros = 0;
    
    // Processar em lotes de 100 para não sobrecarregar
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < ordensServico.length; i += BATCH_SIZE) {
      const batch = ordensServico.slice(i, i + BATCH_SIZE);
      
      const updates = batch.map(os => {
        const ponto: Coordenada = { lat: os.latitude, lng: os.longitude };
        
        // Encontrar todos os territórios que contêm esta OS
        const territoriosOS = territoriosAtivos
          .filter(t => pontoNoPoligono(ponto, t.poligono))
          .map(t => t.id);
        
        return {
          id: os.id,
          territorios: territoriosOS,
          territoriosAntigos: os.territorios || []
        };
      });
      
      // Atualizar apenas as OSs cujos territórios mudaram
      for (const update of updates) {
        const mudou = JSON.stringify(update.territorios.sort()) !== JSON.stringify((update.territoriosAntigos as string[]).sort());
        
        if (mudou) {
          const { error: updateError } = await supabase
            .from("ordens_servico")
            .update({ territorios: update.territorios })
            .eq("id", update.id);
          
          if (updateError) {
            console.error(`[Territórios] Erro ao atualizar OS ${update.id}:`, updateError);
            erros++;
          } else {
            atualizadas++;
          }
        }
      }
    }
    
    console.log(`[Territórios] Atualização concluída: ${atualizadas} OSs atualizadas, ${erros} erros`);
    return { atualizadas, erros };
    
  } catch (e) {
    console.error("[Territórios] Erro na atualização:", e);
    return { atualizadas: 0, erros: 1 };
  }
}

/**
 * Obtém os nomes dos territórios a partir de seus IDs
 */
export async function obterNomesTerritorios(territorioIds: string[]): Promise<string[]> {
  if (!territorioIds || territorioIds.length === 0) return [];
  
  try {
    const { data, error } = await supabase
      .from("territorios")
      .select("id, nome")
      .in("id", territorioIds);
    
    if (error || !data) return [];
    
    // Retornar na mesma ordem dos IDs
    return territorioIds.map(id => {
      const territorio = data.find(t => t.id === id);
      return territorio?.nome || "";
    }).filter(nome => nome !== "");
  } catch (e) {
    console.error("[Territórios] Erro ao obter nomes:", e);
    return [];
  }
}


