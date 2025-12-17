// Utilitários para conversão de dados de equipes entre Supabase e sistema de roteirização

import type { Tables } from "@/integrations/supabase/types";
import type { Equipe, TipoOS, ConfigAlmoco, Localizacao } from "@/data/mockData";

/**
 * Converte um técnico do Supabase para o formato Equipe usado na roteirização
 */
export function tecnicoParaEquipe(tecnico: Tables<"tecnicos">): Equipe {
  const habilidades = (tecnico.habilidades || []) as string[];
  
  // Normalizar habilidades: converter variações para formato padrão
  const normalizarSkill = (skill: string): string => {
    const skillUpper = skill.toUpperCase().trim();
    // Mapear variações para formato padrão
    const mapeamento: Record<string, string> = {
      'LIGACAO': 'LIGAÇÃO',
      'LIGAÇÃO': 'LIGAÇÃO',
      'LIGAÇÃO NOVA': 'LIGAÇÃO',
      'INSPECAO': 'INSPEÇÃO',
      'INSPEÇÃO': 'INSPEÇÃO',
      'MANUTENCAO': 'MANUTENÇÃO',
      'MANUTENÇÃO': 'MANUTENÇÃO',
      'TROCA_MEDIDOR': 'TROCA_MEDIDOR',
      'TROCA MEDIDOR': 'TROCA_MEDIDOR',
      'CORTE': 'CORTE',
      'RELIGA': 'RELIGA',
      'RELIGAÇÃO': 'RELIGA',
    };
    return mapeamento[skillUpper] || skillUpper;
  };
  
  // Mapear habilidades para tipos de OS, normalizando variações
  const skills: TipoOS[] = habilidades
    .map(normalizarSkill)
    .filter((h): h is TipoOS => {
      // Aceitar todos os tipos válidos
      const tiposValidos: string[] = [
        'CORTE', 
        'RELIGA', 
        'INSPEÇÃO', 
        'LIGAÇÃO', 
        'MANUTENÇÃO', 
        'TROCA_MEDIDOR'
      ];
      return tiposValidos.includes(h);
    })
    .map((h) => h as TipoOS);

  // Obter configuração de almoço
  const almocoRaw = (tecnico as any).almoco;
  const almoco: ConfigAlmoco | undefined = almocoRaw
    ? {
        duracao: almocoRaw.duracao || 60,
        janelaInicio: almocoRaw.janelaInicio || "11:00",
        janelaFim: almocoRaw.janelaFim || "14:00",
      }
    : undefined;

  // Obter localizações
  const localPartidaRaw = (tecnico as any).local_partida;
  const localPartida: Localizacao | undefined = localPartidaRaw
    ? { lat: localPartidaRaw.lat, lng: localPartidaRaw.lng }
    : undefined;

  const localChegadaRaw = (tecnico as any).local_chegada;
  const localChegada: Localizacao | undefined = localChegadaRaw
    ? { lat: localChegadaRaw.lat, lng: localChegadaRaw.lng }
    : undefined;

  // Obter coordenadas base (latitude/longitude)
  const latitude = (tecnico as any).latitude
    ? Number((tecnico as any).latitude)
    : localPartida?.lat || -14.8661; // Fallback para Vitória da Conquista, BA
  const longitude = (tecnico as any).longitude
    ? Number((tecnico as any).longitude)
    : localPartida?.lng || -40.8394; // Fallback para Vitória da Conquista, BA

  return {
    id: tecnico.id,
    codigo: tecnico.codigo,
    tecnico: tecnico.nome,
    latitude,
    longitude,
    localPartida,
    localChegada,
    habilidades: skills,
    skills, // Alias para compatibilidade
    jornadaHoras: (tecnico as any).jornada_horas || 8,
    maxHorasTrabalho: (tecnico as any).max_horas_trabalho || 10,
    horaInicio: (tecnico as any).hora_inicio || "07:30",
    almoco,
    color: (tecnico as any).color || "#3b82f6",
  };
}

/**
 * Converte múltiplos técnicos do Supabase para o formato Equipe
 */
export function tecnicosParaEquipes(tecnicos: Tables<"tecnicos">[]): Equipe[] {
  return tecnicos.map(tecnicoParaEquipe);
}

