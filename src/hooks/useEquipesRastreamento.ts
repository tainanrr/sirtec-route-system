import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

// =====================================================
// TIPOS
// =====================================================

export interface ColaboradorTurno {
  id: string;
  nome: string;
  funcao: string | null;
}

export interface OSAtual {
  id: string;
  numero: string;
  tipo: string;
  status: string;
  endereco: string;
}

export interface EquipeTurnoAberto {
  turno_id: string;
  equipe_id: string;
  data_turno: string;
  hora_inicio: string;
  placa_veiculo: string;
  km_inicial: number | null;
  turno_status: string;
  equipe_codigo: string;
  equipe_nome: string;
  equipe_status: string;
  ultima_latitude: number | null;
  ultima_longitude: number | null;
  ultima_posicao_at: string | null;
  accuracy_m: number | null;
  speed_mps: number | null;
  battery_pct: number | null;
  gps_ativo: boolean | null;
  ultimo_evento_tipo: string | null;
  ultimo_evento_at: string | null;
  colaboradores: ColaboradorTurno[] | null;
  os_atual: OSAtual | null;
}

export interface TurnoEvento {
  evento_id: string;
  turno_id: string;
  equipe_id: string;
  ordem_servico_id: string | null;
  tipo_evento: string;
  descricao: string | null;
  metadata: Record<string, any>;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  data_hora: string;
  os_numero: string | null;
  os_tipo: string | null;
  os_endereco: string | null;
  os_status: string | null;
  data_turno: string;
  placa_veiculo: string;
  equipe_codigo: string;
  equipe_nome: string;
}

export interface TurnoParada {
  id: string;
  turno_id: string;
  equipe_id: string;
  latitude: number;
  longitude: number;
  endereco: string | null;
  inicio_parada: string;
  fim_parada: string | null;
  duracao_minutos: number | null;
  tipo_parada: string | null;
  justificativa: string | null;
  ordem_servico_id: string | null;
}

export interface PosicaoHistorico {
  id: string;
  equipe_id: string;
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  battery_pct: number | null;
}

// Configuração de cores/ícones por tipo de evento
export const EVENTO_CONFIG: Record<string, { cor: string; icone: string; label: string }> = {
  inicio_turno: { cor: "#22c55e", icone: "Play", label: "Início do Turno" },
  fim_turno: { cor: "#ef4444", icone: "Square", label: "Fim do Turno" },
  inicio_deslocamento: { cor: "#3b82f6", icone: "Navigation", label: "Início Deslocamento" },
  fim_deslocamento: { cor: "#6366f1", icone: "MapPin", label: "Fim Deslocamento" },
  chegada_local: { cor: "#8b5cf6", icone: "Flag", label: "Chegada no Local" },
  inicio_apr: { cor: "#f59e0b", icone: "ClipboardCheck", label: "Início APR" },
  fim_apr: { cor: "#f97316", icone: "ClipboardList", label: "Fim APR" },
  inicio_servico: { cor: "#14b8a6", icone: "Wrench", label: "Início Serviço" },
  fim_servico: { cor: "#10b981", icone: "CheckCircle", label: "Fim Serviço" },
  inicio_intervalo: { cor: "#ec4899", icone: "Coffee", label: "Início Intervalo" },
  fim_intervalo: { cor: "#d946ef", icone: "Clock", label: "Fim Intervalo" },
  parada_detectada: { cor: "#f43f5e", icone: "AlertTriangle", label: "Parada Detectada" },
  movimento_retomado: { cor: "#06b6d4", icone: "ArrowRight", label: "Movimento Retomado" },
  posicao_atualizada: { cor: "#64748b", icone: "MapPin", label: "Posição" },
};

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export function useEquipesRastreamento(options?: {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableRealtime?: boolean;
}) {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 segundos
    enableRealtime = true,
  } = options || {};

  const queryClient = useQueryClient();
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);

  // =====================================================
  // QUERY: Equipes com turno aberto
  // =====================================================
  const {
    data: equipesComTurno,
    isLoading: isLoadingEquipes,
    error: errorEquipes,
    refetch: refetchEquipes,
  } = useQuery({
    queryKey: ["equipes-turno-aberto"],
    queryFn: async (): Promise<EquipeTurnoAberto[]> => {
      const { data, error } = await supabase
        .from("vw_equipes_turno_aberto")
        .select("*");

      if (error) {
        console.error("[useEquipesRastreamento] Erro ao buscar equipes:", error);
        throw error;
      }

      return (data || []) as EquipeTurnoAberto[];
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 10000, // 10 segundos
  });

  // =====================================================
  // FUNÇÃO: Buscar trajeto/eventos de um turno específico
  // =====================================================
  const buscarTrajetoTurno = useCallback(async (turnoId: string): Promise<TurnoEvento[]> => {
    const { data, error } = await supabase
      .from("vw_turno_trajeto")
      .select("*")
      .eq("turno_id", turnoId)
      .order("data_hora", { ascending: true });

    if (error) {
      console.error("[useEquipesRastreamento] Erro ao buscar trajeto:", error);
      throw error;
    }

    return (data || []) as TurnoEvento[];
  }, []);

  // =====================================================
  // FUNÇÃO: Buscar paradas de um turno específico
  // =====================================================
  const buscarParadasTurno = useCallback(async (turnoId: string): Promise<TurnoParada[]> => {
    const { data, error } = await supabase
      .from("turno_paradas")
      .select("*")
      .eq("turno_id", turnoId)
      .order("inicio_parada", { ascending: true });

    if (error) {
      console.error("[useEquipesRastreamento] Erro ao buscar paradas:", error);
      throw error;
    }

    return (data || []) as TurnoParada[];
  }, []);

  // =====================================================
  // FUNÇÃO: Buscar histórico de posições de uma equipe
  // =====================================================
  const buscarHistoricoPosicoes = useCallback(async (
    equipeId: string,
    dataInicio?: string,
    dataFim?: string
  ): Promise<PosicaoHistorico[]> => {
    let query = supabase
      .from("tecnicos_posicoes")
      .select("*")
      .eq("equipe_id", equipeId)
      .order("recorded_at", { ascending: true });

    if (dataInicio) {
      query = query.gte("recorded_at", dataInicio);
    }
    if (dataFim) {
      query = query.lte("recorded_at", dataFim);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[useEquipesRastreamento] Erro ao buscar histórico:", error);
      throw error;
    }

    return (data || []) as PosicaoHistorico[];
  }, []);

  // =====================================================
  // FUNÇÃO: Registrar evento manualmente
  // =====================================================
  const registrarEvento = useCallback(async (
    turnoId: string,
    equipeId: string,
    tipoEvento: string,
    ordemServicoId?: string,
    descricao?: string,
    metadata?: Record<string, any>,
    latitude?: number,
    longitude?: number
  ): Promise<string | null> => {
    const { data, error } = await supabase.rpc("registrar_evento_turno", {
      p_turno_id: turnoId,
      p_equipe_id: equipeId,
      p_tipo_evento: tipoEvento,
      p_ordem_servico_id: ordemServicoId || null,
      p_descricao: descricao || null,
      p_metadata: metadata || {},
      p_latitude: latitude || null,
      p_longitude: longitude || null,
      p_accuracy_m: null,
    });

    if (error) {
      console.error("[useEquipesRastreamento] Erro ao registrar evento:", error);
      return null;
    }

    // Invalidar cache para atualizar dados
    queryClient.invalidateQueries({ queryKey: ["equipes-turno-aberto"] });

    return data as string;
  }, [queryClient]);

  // =====================================================
  // REALTIME: Subscription para atualizações em tempo real
  // =====================================================
  useEffect(() => {
    if (!enableRealtime) return;

    // Criar canal de realtime
    const channel = supabase
      .channel("equipes-rastreamento")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tecnicos_posicoes",
        },
        (payload) => {
          console.log("[Realtime] Nova posição:", payload);
          // Invalidar cache para forçar atualização
          queryClient.invalidateQueries({ queryKey: ["equipes-turno-aberto"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "turno_eventos",
        },
        (payload) => {
          console.log("[Realtime] Novo evento:", payload);
          queryClient.invalidateQueries({ queryKey: ["equipes-turno-aberto"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "turnos",
        },
        (payload) => {
          console.log("[Realtime] Atualização turno:", payload);
          queryClient.invalidateQueries({ queryKey: ["equipes-turno-aberto"] });
        }
      )
      .subscribe();

    setRealtimeChannel(channel);

    return () => {
      channel.unsubscribe();
    };
  }, [enableRealtime, queryClient]);

  // =====================================================
  // ESTATÍSTICAS COMPUTADAS
  // =====================================================
  const estatisticas = useMemo(() => {
    if (!equipesComTurno) return null;

    const total = equipesComTurno.length;
    const emDeslocamento = equipesComTurno.filter(e => e.ultimo_evento_tipo === "inicio_deslocamento").length;
    const noLocal = equipesComTurno.filter(e => e.ultimo_evento_tipo === "chegada_local").length;
    const emServico = equipesComTurno.filter(e => e.ultimo_evento_tipo === "inicio_servico").length;
    const emIntervalo = equipesComTurno.filter(e => e.ultimo_evento_tipo === "inicio_intervalo").length;
    const comGPSAtivo = equipesComTurno.filter(e => e.gps_ativo).length;
    const semPosicaoRecente = equipesComTurno.filter(e => {
      if (!e.ultima_posicao_at) return true;
      const diffMinutos = (Date.now() - new Date(e.ultima_posicao_at).getTime()) / 60000;
      return diffMinutos > 10; // Sem posição há mais de 10 minutos
    }).length;

    return {
      total,
      emDeslocamento,
      noLocal,
      emServico,
      emIntervalo,
      comGPSAtivo,
      semPosicaoRecente,
      ociosas: total - emDeslocamento - noLocal - emServico - emIntervalo,
    };
  }, [equipesComTurno]);

  return {
    // Dados
    equipesComTurno: equipesComTurno || [],
    estatisticas,
    
    // Estados
    isLoading: isLoadingEquipes,
    error: errorEquipes,
    
    // Funções
    refetch: refetchEquipes,
    buscarTrajetoTurno,
    buscarParadasTurno,
    buscarHistoricoPosicoes,
    registrarEvento,
    
    // Realtime
    isRealtimeActive: !!realtimeChannel,
  };
}

// =====================================================
// HOOK: Trajeto de um turno específico
// =====================================================
export function useTurnoTrajeto(turnoId: string | null) {
  const {
    data: eventos,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["turno-trajeto", turnoId],
    queryFn: async (): Promise<TurnoEvento[]> => {
      if (!turnoId) return [];

      const { data, error } = await supabase
        .from("vw_turno_trajeto")
        .select("*")
        .eq("turno_id", turnoId)
        .order("data_hora", { ascending: true });

      if (error) throw error;
      return (data || []) as TurnoEvento[];
    },
    enabled: !!turnoId,
    staleTime: 30000,
  });

  // Agrupar eventos por tipo para facilitar filtragem
  const eventosPorTipo = useMemo(() => {
    if (!eventos) return new Map<string, TurnoEvento[]>();
    
    const map = new Map<string, TurnoEvento[]>();
    eventos.forEach(evento => {
      const tipo = evento.tipo_evento;
      if (!map.has(tipo)) {
        map.set(tipo, []);
      }
      map.get(tipo)!.push(evento);
    });
    return map;
  }, [eventos]);

  // Eventos com coordenadas (para o trajeto no mapa)
  const eventosComCoordenadas = useMemo(() => {
    return (eventos || []).filter(e => e.latitude && e.longitude);
  }, [eventos]);

  // Calcular duração total do turno
  const duracaoTurno = useMemo(() => {
    if (!eventos || eventos.length === 0) return null;

    const inicioTurno = eventos.find(e => e.tipo_evento === "inicio_turno");
    const fimTurno = eventos.find(e => e.tipo_evento === "fim_turno");

    if (!inicioTurno) return null;

    const inicio = new Date(inicioTurno.data_hora);
    const fim = fimTurno ? new Date(fimTurno.data_hora) : new Date();
    const diffMs = fim.getTime() - inicio.getTime();

    return {
      horas: Math.floor(diffMs / 3600000),
      minutos: Math.floor((diffMs % 3600000) / 60000),
      emAndamento: !fimTurno,
    };
  }, [eventos]);

  // Resumo de atividades
  const resumoAtividades = useMemo(() => {
    if (!eventos) return null;

    const osAtendidas = new Set<string>();
    let totalDeslocamentos = 0;
    let totalIntervalos = 0;
    let totalParadas = 0;

    eventos.forEach(e => {
      if (e.ordem_servico_id && e.tipo_evento === "fim_servico") {
        osAtendidas.add(e.ordem_servico_id);
      }
      if (e.tipo_evento === "inicio_deslocamento") totalDeslocamentos++;
      if (e.tipo_evento === "inicio_intervalo") totalIntervalos++;
      if (e.tipo_evento === "parada_detectada") totalParadas++;
    });

    return {
      osAtendidas: osAtendidas.size,
      totalDeslocamentos,
      totalIntervalos,
      totalParadas,
      totalEventos: eventos.length,
    };
  }, [eventos]);

  return {
    eventos: eventos || [],
    eventosPorTipo,
    eventosComCoordenadas,
    duracaoTurno,
    resumoAtividades,
    isLoading,
    error,
    refetch,
  };
}

// =====================================================
// HOOK: Histórico de posições para desenhar trajeto
// =====================================================
export function useHistoricoPosicoes(
  equipeId: string | null,
  turnoId: string | null
) {
  const {
    data: posicoes,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["historico-posicoes", equipeId, turnoId],
    queryFn: async (): Promise<PosicaoHistorico[]> => {
      if (!equipeId) return [];

      // Se temos turno, buscar posições apenas desse período
      let dataInicio: string | undefined;
      let dataFim: string | undefined;

      if (turnoId) {
        const { data: turno } = await supabase
          .from("turnos")
          .select("hora_inicio, hora_fim")
          .eq("id", turnoId)
          .single();

        if (turno) {
          dataInicio = turno.hora_inicio;
          dataFim = turno.hora_fim || undefined;
        }
      }

      let query = supabase
        .from("tecnicos_posicoes")
        .select("*")
        .eq("equipe_id", equipeId)
        .order("recorded_at", { ascending: true });

      if (dataInicio) {
        query = query.gte("recorded_at", dataInicio);
      }
      if (dataFim) {
        query = query.lte("recorded_at", dataFim);
      }

      const { data, error } = await query.limit(5000); // Limitar para performance

      if (error) throw error;
      return (data || []) as PosicaoHistorico[];
    },
    enabled: !!equipeId,
    staleTime: 60000, // 1 minuto
  });

  // Converter para formato de linha (Leaflet)
  const polylineCoords = useMemo(() => {
    return (posicoes || []).map(p => [p.latitude, p.longitude] as [number, number]);
  }, [posicoes]);

  return {
    posicoes: posicoes || [],
    polylineCoords,
    isLoading,
    error,
    refetch,
  };
}
