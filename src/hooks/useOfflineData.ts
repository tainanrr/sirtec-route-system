import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineSyncContext } from "./useOfflineSync";
import { format } from "date-fns";

// Chaves de cache
export const CACHE_KEYS = {
  // Autenticação
  EQUIPE_AUTH: "equipe_auth",
  TURNO_ATIVO: "turno_ativo",
  COLABORADORES_TURNO: "colaboradores_turno",
  
  // Dados do dia
  ORDENS_PLANEJADAS: "ordens_planejadas",
  PLANEJAMENTO_DIA: "planejamento_dia",
  PRODUCAO_DIA: "producao_dia",
  INTERVALOS_DIA: "intervalos_dia",
  
  // Dados de referência (cachear por mais tempo)
  TIPOS_INTERVALO: "tipos_intervalo",
  SKILLS: "skills",
  RETORNOS_CAMPO: "retornos_campo",
  PROCEDIMENTOS: "procedimentos",
  CHECKLISTS: "checklists",
  MATERIAIS_CATALOGO: "materiais_catalogo",
  
  // Dados da equipe
  MATERIAIS_ESTOQUE: "materiais_estoque",
  HISTORICO_PRODUCAO: "historico_producao",
};

// Hook para gerenciar dados offline
export function useOfflineData() {
  const { saveToCache, getFromCache, isOnline } = useOfflineSyncContext();

  // ============ FUNÇÕES DE PRÉ-CARREGAMENTO ============

  // Pré-carregar todos os dados essenciais para o dia
  const preloadEssentialData = useCallback(async (equipeId: string) => {
    if (!isOnline) {
      console.log("[OfflineData] Offline - não é possível pré-carregar");
      return false;
    }

    console.log("[OfflineData] Iniciando pré-carregamento de dados essenciais...");
    const dataHoje = format(new Date(), "yyyy-MM-dd");

    try {
      // Carregar dados em paralelo
      await Promise.all([
        preloadTiposIntervalo(),
        preloadSkills(),
        preloadRetornosCampo(),
        preloadPlanejamentoDia(equipeId, dataHoje),
        preloadOrdensServico(equipeId),
        preloadIntervalosDia(equipeId, dataHoje),
        preloadProducaoDia(equipeId, dataHoje),
        preloadMateriaisEstoque(equipeId),
        preloadChecklists(),
      ]);

      console.log("[OfflineData] Pré-carregamento concluído!");
      return true;
    } catch (error) {
      console.error("[OfflineData] Erro no pré-carregamento:", error);
      return false;
    }
  }, [isOnline, saveToCache]);

  // Pré-carregar tipos de intervalo
  const preloadTiposIntervalo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("tipos_intervalo")
        .select("*")
        .eq("ativo", true)
        .order("tipo", { ascending: false })
        .order("nome");
      
      if (error) throw error;
      await saveToCache(CACHE_KEYS.TIPOS_INTERVALO, data, 168); // 7 dias
      console.log("[OfflineData] Tipos de intervalo cacheados:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear tipos de intervalo:", error);
    }
  }, [saveToCache]);

  // Pré-carregar skills (tipos de serviço)
  const preloadSkills = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .eq("ativo", true)
        .order("codigo");
      
      if (error) throw error;
      await saveToCache(CACHE_KEYS.SKILLS, data, 168); // 7 dias
      console.log("[OfflineData] Skills cacheados:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear skills:", error);
    }
  }, [saveToCache]);

  // Pré-carregar retornos de campo
  const preloadRetornosCampo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("retornos_campo")
        .select("id, codigo, descricao, tipo, cor, ativo")
        .eq("ativo", true)
        .order("codigo");
      
      if (error) throw error;
      await saveToCache(CACHE_KEYS.RETORNOS_CAMPO, data, 168); // 7 dias
      console.log("[OfflineData] Retornos de campo cacheados:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear retornos de campo:", error);
    }
  }, [saveToCache]);

  // Pré-carregar planejamento do dia - formato igual ao AppOrdens.tsx
  const preloadPlanejamentoDia = useCallback(async (equipeId: string, data: string) => {
    try {
      // Buscar ordens planejadas - MESMA query do AppOrdens para compatibilidade
      const { data: ordensPlanejadasData, error: errorPlanejadas } = await supabase
        .from("planejamento_ordens")
        .select(`
          id,
          ordem_na_rota,
          hora_inicio_estimada,
          hora_fim_estimada,
          distancia_km,
          tempo_estimado_minutos,
          planejamento_id,
          equipe_id,
          ordens_servico:ordem_servico_id (
            id,
            numero,
            tipo,
            endereco,
            cliente_nome,
            status,
            prazo,
            regulada,
            avulsa,
            latitude,
            longitude,
            created_at
          ),
          planejamentos!inner (
            id,
            data_planejamento,
            status
          )
        `)
        .eq("equipe_id", equipeId)
        .eq("planejamentos.data_planejamento", data)
        .eq("planejamentos.status", "aberto")
        .order("ordem_na_rota", { ascending: true });

      if (errorPlanejadas) throw errorPlanejadas;

      // Buscar OSs avulsas da equipe criadas no dia (que não estão no planejamento)
      const dataInicio = `${data}T00:00:00`;
      const dataFim = `${data}T23:59:59`;
      
      const { data: ordensAvulsasData, error: errorAvulsas } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          numero,
          tipo,
          endereco,
          cliente_nome,
          status,
          prazo,
          regulada,
          avulsa,
          latitude,
          longitude,
          created_at
        `)
        .eq("tecnico_id", equipeId)
        .eq("avulsa", true)
        .gte("created_at", dataInicio)
        .lte("created_at", dataFim)
        .order("created_at", { ascending: true });

      if (errorAvulsas) {
        console.error("[OfflineData] Erro ao buscar ordens avulsas:", errorAvulsas);
      }

      // Mesclar ordens planejadas e avulsas (igual AppOrdens)
      const todasOrdens: any[] = [];
      
      if (ordensPlanejadasData) {
        todasOrdens.push(...ordensPlanejadasData);
      }
      
      if (ordensAvulsasData) {
        const idsJaIncluidos = new Set(todasOrdens.map(o => o.ordens_servico?.id));
        
        ordensAvulsasData.forEach((osAvulsa, index) => {
          if (!idsJaIncluidos.has(osAvulsa.id)) {
            const maxOrdem = todasOrdens.length > 0 
              ? Math.max(...todasOrdens.map(o => o.ordem_na_rota || 0))
              : 0;
            
            todasOrdens.push({
              id: `avulsa-${osAvulsa.id}`,
              ordem_na_rota: maxOrdem + index + 1,
              hora_inicio_estimada: null,
              hora_fim_estimada: null,
              distancia_km: null,
              tempo_estimado_minutos: null,
              planejamento_id: "",
              ordens_servico: osAvulsa,
              planejamentos: null,
            });
          }
        });
      }

      await saveToCache(`${CACHE_KEYS.PLANEJAMENTO_DIA}_${equipeId}_${data}`, todasOrdens, 24);
      console.log("[OfflineData] Planejamento cacheado:", todasOrdens.length, "OSs (incluindo avulsas)");
      
      // Cachear também as ordens separadamente para acesso rápido
      if (todasOrdens.length > 0) {
        const ordens = todasOrdens
          .filter(p => p.ordens_servico)
          .map(p => p.ordens_servico);
        await saveToCache(`${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeId}`, ordens, 24);
      }
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear planejamento:", error);
    }
  }, [saveToCache]);

  // Pré-carregar ordens de serviço
  const preloadOrdensServico = useCallback(async (equipeId: string) => {
    try {
      // Buscar OSs planejadas para a equipe (últimos 7 dias)
      const dataInicio = format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
      
      const { data: planejamentos, error } = await supabase
        .from("planejamento_ordens")
        .select("ordem_servico_id")
        .eq("equipe_id", equipeId)
        .gte("data_planejamento", dataInicio);
      
      if (error) throw error;
      
      if (planejamentos && planejamentos.length > 0) {
        const osIds = [...new Set(planejamentos.map(p => p.ordem_servico_id))];
        
        const { data: ordens, error: ordensError } = await supabase
          .from("ordens_servico")
          .select("*")
          .in("id", osIds);
        
        if (ordensError) throw ordensError;
        await saveToCache(`${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeId}_all`, ordens, 24);
        console.log("[OfflineData] Ordens de serviço cacheadas:", ordens?.length);
      }
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear ordens:", error);
    }
  }, [saveToCache]);

  // Pré-carregar intervalos do dia
  const preloadIntervalosDia = useCallback(async (equipeId: string, data: string) => {
    try {
      const { data: intervalos, error } = await supabase
        .from("intervalos_equipe")
        .select("*")
        .eq("equipe_id", equipeId)
        .gte("hora_inicio", `${data}T00:00:00`)
        .lte("hora_inicio", `${data}T23:59:59`);
      
      if (error) throw error;
      await saveToCache(`${CACHE_KEYS.INTERVALOS_DIA}_${equipeId}_${data}`, intervalos, 24);
      console.log("[OfflineData] Intervalos cacheados:", intervalos?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear intervalos:", error);
    }
  }, [saveToCache]);

  // Pré-carregar produção do dia
  const preloadProducaoDia = useCallback(async (equipeId: string, data: string) => {
    try {
      const { data: producao, error } = await supabase
        .from("producao_equipes")
        .select("*")
        .eq("equipe_id", equipeId)
        .gte("created_at", `${data}T00:00:00`)
        .lte("created_at", `${data}T23:59:59`);
      
      if (error) throw error;
      await saveToCache(`${CACHE_KEYS.PRODUCAO_DIA}_${equipeId}_${data}`, producao, 24);
      console.log("[OfflineData] Produção cacheada:", producao?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear produção:", error);
    }
  }, [saveToCache]);

  // Pré-carregar materiais do estoque da equipe
  const preloadMateriaisEstoque = useCallback(async (equipeId: string) => {
    try {
      const { data: estoque, error } = await supabase
        .from("materiais_estoque")
        .select(`
          id,
          material_id,
          quantidade,
          materiais!inner (
            id, codigo, nome, unidade, categoria, estoque_minimo, requer_serial
          )
        `)
        .eq("local_tipo", "equipe")
        .eq("local_id", equipeId)
        .gt("quantidade", 0);
      
      if (error) throw error;
      await saveToCache(`${CACHE_KEYS.MATERIAIS_ESTOQUE}_${equipeId}`, estoque, 24);
      console.log("[OfflineData] Estoque cacheado:", estoque?.length, "itens");
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear estoque:", error);
    }
  }, [saveToCache]);

  // Pré-carregar checklists
  const preloadChecklists = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      
      if (error) throw error;
      await saveToCache(CACHE_KEYS.CHECKLISTS, data, 168); // 7 dias
      console.log("[OfflineData] Checklists cacheados:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear checklists:", error);
    }
  }, [saveToCache]);

  // ============ FUNÇÕES DE ACESSO AO CACHE ============

  // Obter equipe do cache
  const getEquipeFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.EQUIPE_AUTH);
  }, [getFromCache]);

  // Obter turno do cache
  const getTurnoFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.TURNO_ATIVO);
  }, [getFromCache]);

  // Obter colaboradores do turno do cache
  const getColaboradoresFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.COLABORADORES_TURNO);
  }, [getFromCache]);

  // Obter planejamento do dia do cache
  const getPlanejamentoFromCache = useCallback(async (equipeId: string, data: string) => {
    return await getFromCache(`${CACHE_KEYS.PLANEJAMENTO_DIA}_${equipeId}_${data}`);
  }, [getFromCache]);

  // Obter ordens planejadas do cache
  const getOrdensFromCache = useCallback(async (equipeId: string) => {
    return await getFromCache(`${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeId}`);
  }, [getFromCache]);

  // Obter tipos de intervalo do cache
  const getTiposIntervaloFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.TIPOS_INTERVALO);
  }, [getFromCache]);

  // Obter skills do cache
  const getSkillsFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.SKILLS);
  }, [getFromCache]);

  // Obter retornos de campo do cache
  const getRetornosCampoFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.RETORNOS_CAMPO);
  }, [getFromCache]);

  // Obter checklists do cache
  const getChecklistsFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.CHECKLISTS);
  }, [getFromCache]);

  // Obter estoque do cache
  const getEstoqueFromCache = useCallback(async (equipeId: string) => {
    return await getFromCache(`${CACHE_KEYS.MATERIAIS_ESTOQUE}_${equipeId}`);
  }, [getFromCache]);

  // Obter produção do dia do cache
  const getProducaoFromCache = useCallback(async (equipeId: string, data: string) => {
    return await getFromCache(`${CACHE_KEYS.PRODUCAO_DIA}_${equipeId}_${data}`);
  }, [getFromCache]);

  // Obter intervalos do dia do cache
  const getIntervalosFromCache = useCallback(async (equipeId: string, data: string) => {
    return await getFromCache(`${CACHE_KEYS.INTERVALOS_DIA}_${equipeId}_${data}`);
  }, [getFromCache]);

  // ============ FUNÇÕES DE ATUALIZAÇÃO LOCAL ============

  // Atualizar ordem de serviço localmente (para refletir mudanças offline)
  const updateOrdemLocal = useCallback(async (equipeId: string, ordemId: string, updates: any) => {
    const ordens = await getFromCache<any[]>(`${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeId}`);
    if (ordens) {
      const updatedOrdens = ordens.map(o => 
        o.id === ordemId ? { ...o, ...updates } : o
      );
      await saveToCache(`${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeId}`, updatedOrdens, 24);
    }
  }, [getFromCache, saveToCache]);

  // Adicionar produção localmente
  const addProducaoLocal = useCallback(async (equipeId: string, data: string, producao: any) => {
    const producoes = await getFromCache<any[]>(`${CACHE_KEYS.PRODUCAO_DIA}_${equipeId}_${data}`) || [];
    producoes.push(producao);
    await saveToCache(`${CACHE_KEYS.PRODUCAO_DIA}_${equipeId}_${data}`, producoes, 24);
  }, [getFromCache, saveToCache]);

  // Adicionar intervalo localmente
  const addIntervaloLocal = useCallback(async (equipeId: string, data: string, intervalo: any) => {
    const intervalos = await getFromCache<any[]>(`${CACHE_KEYS.INTERVALOS_DIA}_${equipeId}_${data}`) || [];
    intervalos.push(intervalo);
    await saveToCache(`${CACHE_KEYS.INTERVALOS_DIA}_${equipeId}_${data}`, intervalos, 24);
  }, [getFromCache, saveToCache]);

  // Atualizar intervalo localmente
  const updateIntervaloLocal = useCallback(async (equipeId: string, data: string, intervaloId: string, updates: any) => {
    const intervalos = await getFromCache<any[]>(`${CACHE_KEYS.INTERVALOS_DIA}_${equipeId}_${data}`);
    if (intervalos) {
      const updatedIntervalos = intervalos.map(i => 
        i.id === intervaloId ? { ...i, ...updates } : i
      );
      await saveToCache(`${CACHE_KEYS.INTERVALOS_DIA}_${equipeId}_${data}`, updatedIntervalos, 24);
    }
  }, [getFromCache, saveToCache]);

  return {
    // Pré-carregamento
    preloadEssentialData,
    preloadTiposIntervalo,
    preloadSkills,
    preloadRetornosCampo,
    preloadPlanejamentoDia,
    preloadOrdensServico,
    preloadIntervalosDia,
    preloadProducaoDia,
    preloadMateriaisEstoque,
    preloadChecklists,
    
    // Acesso ao cache
    getEquipeFromCache,
    getTurnoFromCache,
    getColaboradoresFromCache,
    getPlanejamentoFromCache,
    getOrdensFromCache,
    getTiposIntervaloFromCache,
    getSkillsFromCache,
    getRetornosCampoFromCache,
    getChecklistsFromCache,
    getEstoqueFromCache,
    getProducaoFromCache,
    getIntervalosFromCache,
    
    // Atualizações locais
    updateOrdemLocal,
    addProducaoLocal,
    addIntervaloLocal,
    updateIntervaloLocal,
    
    // Acesso direto ao cache genérico
    saveToCache,
    getFromCache,
  };
}

