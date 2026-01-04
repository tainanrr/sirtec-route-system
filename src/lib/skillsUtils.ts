import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Skill = Tables<"skills">;

// Cache para armazenar os dados das skills
interface SkillCacheData {
  tempoExecucao: number;
  valor: number;
  regulada: boolean;
  icone?: string;
  icone_url?: string; // URL da imagem personalizada para o mapa
  sigla?: string; // Sigla de até 3 caracteres para o mapa
  cor?: string; // Cor do marcador no mapa
  nome?: string; // Nome do tipo de serviço (ex: "Corte A")
}

let skillsCache: Map<string, SkillCacheData> | null = null;
let lastCacheUpdate: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Busca todas as skills ativas do banco de dados
 */
export async function fetchSkills(): Promise<Skill[]> {
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("ativo", true)
    .order("codigo");

  if (error) {
    console.error("[SKILLS] Erro ao buscar skills:", error);
    throw error;
  }

  return data || [];
}

/**
 * Busca o tempo de execução de uma skill específica pelo código
 * Usa cache para evitar múltiplas consultas ao banco
 */
export async function getTempoExecucao(codigoSkill: string): Promise<number> {
  const dados = await getDadosSkill(codigoSkill);
  return dados.tempoExecucao;
}

/**
 * Busca todos os dados de uma skill (tempo, valor, regulada, icone)
 */
export async function getDadosSkill(codigoSkill: string): Promise<SkillCacheData> {
  // Verificar se o cache está válido
  const now = Date.now();
  if (!skillsCache || now - lastCacheUpdate > CACHE_DURATION) {
    await refreshSkillsCache();
  }

  // Buscar no cache
  const dados = skillsCache?.get(codigoSkill.toUpperCase());
  
  if (dados) {
    return dados;
  }

  // Se não encontrou no cache, buscar no banco
  const { data, error } = await supabase
    .from("skills")
    .select("nome, tempo_execucao_minutos, valor, regulada, icone, icone_url, sigla, cor")
    .eq("codigo", codigoSkill.toUpperCase())
    .eq("ativo", true)
    .single();

  if (error || !data) {
    return {
      tempoExecucao: 15,
      valor: 0,
      regulada: false,
    };
  }

  const skillData: SkillCacheData = {
    tempoExecucao: data.tempo_execucao_minutos,
    valor: Number(data.valor || 0),
    regulada: data.regulada || false,
    icone: data.icone || undefined,
    icone_url: (data as any).icone_url || undefined,
    sigla: (data as any).sigla || undefined,
    cor: (data as any).cor || undefined,
    nome: data.nome || undefined,
  };

  // Atualizar cache
  if (skillsCache) {
    skillsCache.set(codigoSkill.toUpperCase(), skillData);
  }

  return skillData;
}

/**
 * Busca todos os dados das skills e armazena em cache
 */
export async function refreshSkillsCache(): Promise<void> {
  try {
    const skills = await fetchSkills();
    skillsCache = new Map();
    
    skills.forEach((skill) => {
      skillsCache!.set(skill.codigo.toUpperCase(), {
        tempoExecucao: skill.tempo_execucao_minutos,
        valor: Number(skill.valor || 0),
        regulada: skill.regulada || false,
        icone: skill.icone || undefined,
        icone_url: (skill as any).icone_url || undefined,
        sigla: (skill as any).sigla || undefined,
        cor: (skill as any).cor || undefined,
        nome: skill.nome || undefined,
      });
    });

    lastCacheUpdate = Date.now();
  } catch (error) {
    console.error("[SKILLS] Erro ao atualizar cache:", error);
    // Manter cache anterior se houver erro
  }
}

/**
 * Busca o tempo de execução de múltiplas skills de uma vez
 * Retorna um Map com código -> tempo
 */
export async function getTemposExecucao(codigosSkills: string[]): Promise<Map<string, number>> {
  const dados = await getDadosSkills(codigosSkills);
  const tempos = new Map<string, number>();
  dados.forEach((dados, codigo) => {
    tempos.set(codigo, dados.tempoExecucao);
  });
  return tempos;
}

/**
 * Busca todos os dados de múltiplas skills de uma vez
 * Retorna um Map com código -> dados completos
 */
export async function getDadosSkills(codigosSkills: string[]): Promise<Map<string, SkillCacheData>> {
  const dados = new Map<string, SkillCacheData>();

  // Verificar se o cache está válido
  const now = Date.now();
  if (!skillsCache || now - lastCacheUpdate > CACHE_DURATION) {
    await refreshSkillsCache();
  }

  // Buscar todos os códigos únicos (normalizar para uppercase)
  const codigosUnicos = [...new Set(codigosSkills.map((c) => c.toUpperCase().trim()))];

  // Buscar no cache primeiro
  const codigosNaoEncontrados: string[] = [];
  codigosUnicos.forEach((codigo) => {
    const skillData = skillsCache?.get(codigo);
    if (skillData) {
      dados.set(codigo, skillData);
    } else {
      codigosNaoEncontrados.push(codigo);
    }
  });

  // Se houver códigos não encontrados, buscar no banco
  if (codigosNaoEncontrados.length > 0) {
    const { data, error } = await supabase
      .from("skills")
      .select("codigo, nome, tempo_execucao_minutos, valor, regulada, icone, icone_url, sigla, cor")
      .in("codigo", codigosNaoEncontrados)
      .eq("ativo", true);

    if (!error && data) {
      data.forEach((skill) => {
        const codigoUpper = skill.codigo.toUpperCase().trim();
        const skillData: SkillCacheData = {
          tempoExecucao: skill.tempo_execucao_minutos,
          valor: Number(skill.valor || 0),
          regulada: skill.regulada || false,
          icone: skill.icone || undefined,
          icone_url: (skill as any).icone_url || undefined,
          sigla: (skill as any).sigla || undefined,
          cor: (skill as any).cor || undefined,
          nome: skill.nome || undefined,
        };
        dados.set(codigoUpper, skillData);
        // Atualizar cache
        if (skillsCache) {
          skillsCache.set(codigoUpper, skillData);
        }
      });
    }

    // Para códigos não encontrados, usar valores padrão
    codigosNaoEncontrados.forEach((codigo) => {
      if (!dados.has(codigo)) {
        dados.set(codigo, {
          tempoExecucao: 15,
          valor: 0,
          regulada: false,
        });
      }
    });
  }

  return dados;
}

/**
 * Limpa o cache de skills (útil para testes ou quando necessário forçar atualização)
 */
export function clearSkillsCache(): void {
  skillsCache = null;
  lastCacheUpdate = 0;
}

