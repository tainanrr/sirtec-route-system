// Utilitários para conversão de dados de equipes entre Supabase e sistema de roteirização

import type { Tables } from "@/integrations/supabase/types";
import type { Equipe, TipoOS, ConfigAlmoco, Localizacao } from "@/data/mockData";

/**
 * Normaliza uma skill removendo acentos e convertendo para uppercase
 */
function normalizarSkillSemAcento(skill: string): string {
  return skill
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove todos os acentos via NFD
}

/**
 * Converte um técnico do Supabase para o formato Equipe usado na roteirização
 */
export function tecnicoParaEquipe(tecnico: Tables<"tecnicos">): Equipe {
  const habilidades = (tecnico.habilidades || []) as string[];
  
  // Manter habilidades como estão - o matching é feito pelo tipo exato da OS
  // Apenas fazer trim e uppercase para consistência
  const skills: TipoOS[] = habilidades
    .map(h => h.trim().toUpperCase() as TipoOS)
    .filter(h => h.length > 0);

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

