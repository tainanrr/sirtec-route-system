import { OrdemServico } from "@/data/mockData";
import type { Tables } from "@/integrations/supabase/types";
import { getDadosSkills } from "./skillsUtils";

/**
 * Converte uma ordem de serviço do Supabase para o formato OrdemServico usado na roteirização
 * Aplica os dados das skills (valor, regulada, tempoExecucao) se disponíveis
 */
export async function mapSupabaseOrdemServicoToOrdemServico(
  ordemSupabase: Tables<"ordens_servico">,
  dadosSkills?: Map<string, { tempoExecucao: number; valor: number; regulada: boolean }>
): Promise<OrdemServico> {
  // Normalizar o tipo para o código da skill (sem acentos, uppercase)
  const tipoParaSkillCodigo = (tipo: string): string => {
    const tipoLower = tipo.toLowerCase().trim();
    // Mapear tipos do formulário (minúsculas) para códigos das skills (maiúsculas, SEM ACENTOS)
    const mapeamento: Record<string, string> = {
      'corte': 'CORTE',
      'religa': 'RELIGA',
      'religação': 'RELIGA',
      'inspecao': 'INSPECAO',
      'inspeção': 'INSPECAO',
      'ligacao': 'LIGACAO',
      'ligação': 'LIGACAO',
      'manutencao': 'MANUTENCAO',
      'manutenção': 'MANUTENCAO',
      'troca_medidor': 'TROCA_MEDIDOR',
      'troca medidor': 'TROCA_MEDIDOR',
    };
    
    if (mapeamento[tipoLower]) {
      return mapeamento[tipoLower];
    }
    
    // Se não encontrou no mapeamento, normalizar para uppercase e remover acentos
    return tipo.toUpperCase()
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÕÖ]/g, 'O')
      .replace(/[ÙÚÛÜ]/g, 'U')
      .replace(/[Ç]/g, 'C')
      .replace(/[Ñ]/g, 'N')
      .trim();
  };
  
  // Obter código da skill (sem acentos)
  const codigoSkill = tipoParaSkillCodigo(ordemSupabase.tipo);
  
  // Normalizar tipo para formato OrdemServico (SEM acentos para consistência na comparação)
  // IMPORTANTE: Esta normalização deve ser consistente com a usada em equipeUtils.ts
  const normalizarTipo = (tipo: string): string => {
    const tipoNorm = tipo
      .toUpperCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove todos os acentos
    
    const mapeamento: Record<string, string> = {
      'CORTE': 'CORTE',
      'RELIGA': 'RELIGA',
      'RELIGACAO': 'RELIGA',
      'INSPECAO': 'INSPECAO',
      'LIGACAO': 'LIGACAO',
      'LIGACAO NOVA': 'LIGACAO',
      'MANUTENCAO': 'MANUTENCAO',
      'TROCA_MEDIDOR': 'TROCA_MEDIDOR',
      'TROCA MEDIDOR': 'TROCA_MEDIDOR',
    };
    return mapeamento[tipoNorm] || tipoNorm;
  };
  
  const tipoNormalizado = normalizarTipo(ordemSupabase.tipo) as OrdemServico["tipo"];
  
  // Buscar dados da skill usando o código (sem acentos)
  // OTIMIZAÇÃO: Não fazer import dinâmico aqui - usar apenas o cache passado
  const skillData = dadosSkills?.get(codigoSkill);

  // SEMPRE usar dados da skill se disponível, caso contrário usar valor da OS como fallback
  // Valor: Priorizar skill, depois OS, depois 0
  const valor = skillData?.valor !== undefined && skillData.valor > 0
    ? skillData.valor
    : (ordemSupabase.valor !== null && ordemSupabase.valor !== undefined 
        ? Number(ordemSupabase.valor) 
        : 0);

  // Regulada: SEMPRE usar dados da skill se disponível, caso contrário usar valor da OS como fallback
  // IMPORTANTE: Se skillData existe, usar seu valor de regulada, mesmo que seja false
  const regulada = skillData !== undefined && skillData !== null
    ? (skillData.regulada !== undefined ? skillData.regulada : false)
    : (ordemSupabase.regulada !== null && ordemSupabase.regulada !== undefined
        ? ordemSupabase.regulada
        : false);

  // Tempo de execução: SEMPRE priorizar skill, depois duracao_estimada da OS, depois 15min padrão
  const tempoExecucao = skillData?.tempoExecucao !== undefined && skillData.tempoExecucao > 0
    ? skillData.tempoExecucao
    : (ordemSupabase.duracao_estimada !== null && ordemSupabase.duracao_estimada !== undefined && ordemSupabase.duracao_estimada > 0
        ? ordemSupabase.duracao_estimada
        : 15);

  // Determinar prioridade baseado em prazo
  const temPrazo = ordemSupabase.prazo !== null;
  const prioridade: "ALTA" | "NORMAL" = temPrazo ? "ALTA" : "NORMAL";

  // Validar e processar coordenadas
  // Coordenadas válidas para Brasil: lat entre -35 e 5, lng entre -75 e -32
  // Se inválidas, usar fallback de Vitória da Conquista, BA
  const latValida = typeof ordemSupabase.latitude === 'number' && 
                    !isNaN(ordemSupabase.latitude) && 
                    ordemSupabase.latitude >= -35 && 
                    ordemSupabase.latitude <= 5;
  const lngValida = typeof ordemSupabase.longitude === 'number' && 
                    !isNaN(ordemSupabase.longitude) && 
                    ordemSupabase.longitude >= -75 && 
                    ordemSupabase.longitude <= -32;
  
  const latitude = latValida ? ordemSupabase.latitude! : -14.8661;
  const longitude = lngValida ? ordemSupabase.longitude! : -40.8394;
  
  // Log de coordenadas inválidas removido para não poluir o console
  // Se necessário debug, descomentar:
  // if (!latValida || !lngValida) {
  //   console.warn(`[ORDEM_SERVICO] OS ${ordemSupabase.numero} tem coordenadas inválidas (lat: ${ordemSupabase.latitude}, lng: ${ordemSupabase.longitude}), usando fallback`);
  // }

  return {
    id: ordemSupabase.id,
    numero: ordemSupabase.numero,
    tipo: tipoNormalizado,
    endereco: ordemSupabase.endereco,
    latitude: latitude,
    longitude: longitude,
    prazo: ordemSupabase.prazo ? new Date(ordemSupabase.prazo) : null,
    valor: valor,
    tempoExecucao: tempoExecucao,
    regulada: regulada,
    prioridade: prioridade,
  };
}

/**
 * Converte múltiplas ordens de serviço do Supabase para o formato OrdemServico
 * Otimiza buscando dados das skills em lote
 */
export async function mapSupabaseOrdensServicoToOrdemServico(
  ordensSupabase: Tables<"ordens_servico">[]
): Promise<OrdemServico[]> {
  if (ordensSupabase.length === 0) {
    return [];
  }

  // Converter tipo para código da skill (sem acentos, uppercase) - DEVE ser consistente com normalizarTipo
  const tipoParaSkillCodigo = (tipo: string): string => {
    const tipoNorm = tipo
      .toUpperCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove todos os acentos via NFD
    
    const mapeamento: Record<string, string> = {
      'CORTE': 'CORTE',
      'RELIGA': 'RELIGA',
      'RELIGACAO': 'RELIGA',
      'INSPECAO': 'INSPECAO',
      'LIGACAO': 'LIGACAO',
      'LIGACAO NOVA': 'LIGACAO',
      'MANUTENCAO': 'MANUTENCAO',
      'TROCA_MEDIDOR': 'TROCA_MEDIDOR',
      'TROCA MEDIDOR': 'TROCA_MEDIDOR',
    };
    
    return mapeamento[tipoNorm] || tipoNorm;
  };

  // Buscar todos os códigos únicos das skills (sem acentos) e obter dados em lote
  const codigosSkillsUnicos = [...new Set(ordensSupabase.map((os) => tipoParaSkillCodigo(os.tipo)))];
  const dadosSkills = await getDadosSkills(codigosSkillsUnicos);

  // Converter cada ordem
  const ordensConvertidas = await Promise.all(
    ordensSupabase.map((ordem) => 
      mapSupabaseOrdemServicoToOrdemServico(ordem, dadosSkills)
    )
  );

  return ordensConvertidas;
}

