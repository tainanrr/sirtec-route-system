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
  
  // Dados de retorno de campo completos
  TIPO_SERVICO_RETORNOS: "tipo_servico_retornos",
  TIPO_SERVICO_RETORNO_ATIVIDADES: "tipo_servico_retorno_atividades",
  ATIVIDADES: "atividades",
  
  // Dados da equipe - Estoque
  MATERIAIS_ESTOQUE: "materiais_estoque",
  HISTORICO_PRODUCAO: "historico_producao",
  ENTREGAS_PENDENTES: "entregas_pendentes",
  DEVOLUCOES_PENDENTES: "devolucoes_pendentes",
  MOVIMENTACOES_ESTOQUE: "movimentacoes_estoque",
  MATERIAIS_SERIALIZADOS: "materiais_serializados",
  
  // Chat
  MENSAGENS_CHAT: "mensagens_chat",
  
  // Procedimentos
  PROCEDIMENTOS_LISTA: "procedimentos_lista",
  
  // Resultados e Metas
  METAS_CICLO: "metas_ciclo",
  PRODUCOES_CICLO: "producoes_ciclo",
  
  // Colaboradores
  COLABORADORES_DISPONIVEIS: "colaboradores_disponiveis",
  
  // Estatísticas do perfil
  ESTATISTICAS_TECNICO: "estatisticas_tecnico",
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

    const dataHoje = format(new Date(), "yyyy-MM-dd");
    
    // Calcular período do ciclo atual (26 a 25)
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    let dataInicioCiclo: string;
    let dataFimCiclo: string;
    
    if (diaAtual >= 26) {
      const inicioDate = new Date(hoje.getFullYear(), hoje.getMonth(), 26);
      const fimDate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 25);
      dataInicioCiclo = format(inicioDate, "yyyy-MM-dd");
      dataFimCiclo = format(fimDate, "yyyy-MM-dd");
    } else {
      const inicioDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 26);
      const fimDate = new Date(hoje.getFullYear(), hoje.getMonth(), 25);
      dataInicioCiclo = format(inicioDate, "yyyy-MM-dd");
      dataFimCiclo = format(fimDate, "yyyy-MM-dd");
    }
    
    console.log("[OfflineData] ========================================");
    console.log("[OfflineData] Iniciando pré-carregamento de dados essenciais");
    console.log("[OfflineData] Equipe:", equipeId);
    console.log("[OfflineData] Data:", dataHoje);
    console.log("[OfflineData] Ciclo:", dataInicioCiclo, "a", dataFimCiclo);
    console.log("[OfflineData] ========================================");

    try {
      // Carregar dados em paralelo
      const results = await Promise.allSettled([
        preloadTiposIntervalo(),
        preloadSkills(),
        preloadRetornosCampo(),
        preloadPlanejamentoDia(equipeId, dataHoje),
        preloadOrdensServico(equipeId),
        preloadIntervalosDia(equipeId, dataHoje),
        preloadProducaoDia(equipeId, dataHoje),
        preloadMateriaisEstoque(equipeId),
        preloadChecklists(),
        preloadRetornosCampoCompleto(),
        preloadEntregasPendentes(equipeId),
        preloadDevolucoesPendentes(equipeId),
        preloadMovimentacoesEstoque(equipeId),
        preloadMateriaisSerializados(equipeId),
        preloadColaboradores(),
        preloadProcedimentos(),
        preloadEstatisticasTecnico(equipeId),
        preloadMetasCiclo(equipeId, dataInicioCiclo, dataFimCiclo),
        preloadProducoesCiclo(equipeId, dataInicioCiclo, dataFimCiclo),
        preloadMateriaisCatalogo(),
      ]);

      // Log de resultados
      const nomes = ['TiposIntervalo', 'Skills', 'RetornosCampo', 'PlanejamentoDia', 
                     'OrdensServico', 'IntervalosDia', 'ProducaoDia', 'MateriaisEstoque', 'Checklists', 'RetornosCampoCompleto',
                     'EntregasPendentes', 'DevolucoesPendentes', 'MovimentacoesEstoque', 'MateriaisSerializados',
                     'Colaboradores', 'Procedimentos', 'EstatisticasTecnico', 'MetasCiclo', 'ProducoesCiclo', 'MateriaisCatalogo'];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[OfflineData] ❌ ${nomes[index]} falhou:`, result.reason);
        } else {
          console.log(`[OfflineData] ✓ ${nomes[index]} OK`);
        }
      });

      console.log("[OfflineData] ========================================");
      console.log("[OfflineData] Pré-carregamento concluído!");
      console.log("[OfflineData] ========================================");
      return true;
    } catch (error) {
      console.error("[OfflineData] Erro geral no pré-carregamento:", error);
      return false;
    }
  }, [isOnline]);

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
    console.log("[OfflineData] Buscando planejamento para equipe:", equipeId, "data:", data);
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
        // IMPORTANTE: Filtrar ordens com ordens_servico válido (join pode falhar se OS foi deletada)
        const ordensValidas = ordensPlanejadasData.filter(o => o.ordens_servico && o.ordens_servico.id);
        const ordensInvalidas = ordensPlanejadasData.length - ordensValidas.length;
        if (ordensInvalidas > 0) {
          console.warn(`[OfflineData] ${ordensInvalidas} ordens ignoradas (sem ordens_servico válido)`);
        }
        
        // IMPORTANTE: Fazer deep clone para garantir serialização correta no IndexedDB
        // Objetos do Supabase podem ter propriedades não serializáveis
        ordensValidas.forEach(ordem => {
          try {
            const ordemClonada = JSON.parse(JSON.stringify(ordem));
            todasOrdens.push(ordemClonada);
          } catch (e) {
            console.warn("[OfflineData] Erro ao clonar ordem, usando original:", e);
            todasOrdens.push(ordem);
          }
        });
      }
      
      if (ordensAvulsasData) {
        const idsJaIncluidos = new Set(todasOrdens.map(o => o.ordens_servico?.id));
        
        ordensAvulsasData.forEach((osAvulsa, index) => {
          if (!idsJaIncluidos.has(osAvulsa.id)) {
            const maxOrdem = todasOrdens.length > 0 
              ? Math.max(...todasOrdens.map(o => o.ordem_na_rota || 0))
              : 0;
            
            // Deep clone da OS avulsa também
            let osClonada;
            try {
              osClonada = JSON.parse(JSON.stringify(osAvulsa));
            } catch (e) {
              console.warn("[OfflineData] Erro ao clonar OS avulsa, usando original:", e);
              osClonada = osAvulsa;
            }
            
            todasOrdens.push({
              id: `avulsa-${osAvulsa.id}`,
              ordem_na_rota: maxOrdem + index + 1,
              hora_inicio_estimada: null,
              hora_fim_estimada: null,
              distancia_km: null,
              tempo_estimado_minutos: null,
              planejamento_id: "",
              ordens_servico: osClonada,
              planejamentos: null,
            });
          }
        });
      }

      // Log detalhado dos IDs que serão salvos no cache
      const idsParaSalvar = todasOrdens.map(o => o.ordens_servico?.id).filter(Boolean);
      console.log("[OfflineData] IDs das ordens para salvar no cache:", idsParaSalvar.length, "IDs:", idsParaSalvar.slice(0, 10));

      await saveToCache(`${CACHE_KEYS.PLANEJAMENTO_DIA}_${equipeId}_${data}`, todasOrdens, 24);
      console.log("[OfflineData] Planejamento cacheado:", todasOrdens.length, "OSs válidas (incluindo avulsas)");
      
      // Cachear também as ordens separadamente para acesso rápido
      if (todasOrdens.length > 0) {
        const ordens = todasOrdens
          .filter(p => p.ordens_servico)
          .map(p => {
            // Deep clone também aqui
            try {
              return JSON.parse(JSON.stringify(p.ordens_servico));
            } catch {
              return p.ordens_servico;
            }
          });
        await saveToCache(`${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeId}`, ordens, 24);
      }
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear planejamento:", error);
    }
  }, [saveToCache]);

  // Pré-carregar ordens de serviço
  const preloadOrdensServico = useCallback(async (equipeId: string) => {
    try {
      // Buscar OSs planejadas para a equipe (últimos 7 dias) - join com planejamentos para acessar data_planejamento
      const dataInicio = format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
      
      const { data: planejamentos, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          ordem_servico_id,
          planejamentos!inner (
            data_planejamento
          )
        `)
        .eq("equipe_id", equipeId)
        .gte("planejamentos.data_planejamento", dataInicio);
      
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

  // Pré-carregar dados completos de retorno de campo
  const preloadRetornosCampoCompleto = useCallback(async () => {
    try {
      console.log("[OfflineData] Cacheando dados de retorno de campo completos...");
      
      // 1. Cachear tipo_servico_retornos com retornos_campo
      const { data: tipoServicoRetornos, error: tsrError } = await supabase
        .from("tipo_servico_retornos")
        .select(`
          id,
          skill_id,
          retorno_campo_id,
          padrao,
          ordem,
          retorno:retornos_campo(
            id,
            codigo,
            descricao,
            tipo,
            cor,
            gera_producao
          )
        `)
        .eq("ativo", true)
        .order("skill_id")
        .order("ordem");
      
      if (tsrError) {
        console.error("[OfflineData] Erro ao buscar tipo_servico_retornos:", tsrError);
      } else {
        await saveToCache(CACHE_KEYS.TIPO_SERVICO_RETORNOS, tipoServicoRetornos || [], 168);
        console.log("[OfflineData] tipo_servico_retornos cacheados:", tipoServicoRetornos?.length);
      }
      
      // 2. Cachear tipo_servico_retorno_atividades com atividades
      const { data: retornoAtividades, error: raError } = await supabase
        .from("tipo_servico_retorno_atividades")
        .select(`
          id,
          tipo_servico_retorno_id,
          atividade_id,
          situacao,
          quantidade_padrao,
          permite_alterar_qtd,
          qtd_min_fotos,
          ordem,
          atividade:atividades(
            id,
            codigo,
            descricao,
            valor_unitario,
            unidade
          )
        `)
        .order("tipo_servico_retorno_id")
        .order("ordem");
      
      if (raError) {
        console.error("[OfflineData] Erro ao buscar retorno_atividades:", raError);
      } else {
        await saveToCache(CACHE_KEYS.TIPO_SERVICO_RETORNO_ATIVIDADES, retornoAtividades || [], 168);
        console.log("[OfflineData] tipo_servico_retorno_atividades cacheados:", retornoAtividades?.length);
      }
      
      // 3. Cachear todas as atividades (para referência)
      const { data: atividades, error: atvError } = await supabase
        .from("atividades")
        .select("id, codigo, descricao, valor_unitario, unidade")
        .eq("ativo", true)
        .order("codigo");
      
      if (atvError) {
        console.error("[OfflineData] Erro ao buscar atividades:", atvError);
      } else {
        await saveToCache(CACHE_KEYS.ATIVIDADES, atividades || [], 168);
        console.log("[OfflineData] Atividades cacheadas:", atividades?.length);
      }
      
      console.log("[OfflineData] ✅ Dados de retorno de campo completos cacheados!");
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear retornos de campo:", error);
    }
  }, [saveToCache]);

  // Pré-carregar entregas pendentes da equipe
  const preloadEntregasPendentes = useCallback(async (equipeId: string) => {
    try {
      // Buscar entregas pendentes
      const { data: entregas, error } = await supabase
        .from("materiais_entregas")
        .select(`
          id,
          data_entrega,
          status,
          observacao
        `)
        .eq("equipe_id", equipeId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Buscar itens de cada entrega
      const entregasComItens = await Promise.all(
        (entregas || []).map(async (entrega: any) => {
          const { data: itens } = await supabase
            .from("materiais_entregas_itens")
            .select(`
              material_id,
              quantidade,
              numero_serie,
              materiais (codigo, nome, unidade)
            `)
            .eq("entrega_id", entrega.id);

          return {
            ...entrega,
            itens: itens || [],
          };
        })
      );
      
      await saveToCache(`${CACHE_KEYS.ENTREGAS_PENDENTES}_${equipeId}`, entregasComItens, 24);
      console.log("[OfflineData] Entregas pendentes cacheadas:", entregasComItens?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear entregas pendentes:", error);
    }
  }, [saveToCache]);

  // Pré-carregar devoluções pendentes de confirmação
  const preloadDevolucoesPendentes = useCallback(async (equipeId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from("materiais_devolucoes")
        .select("id, status, created_at, observacao")
        .eq("equipe_id", equipeId)
        .eq("status", "pendente_confirmacao_equipe")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      await saveToCache(`${CACHE_KEYS.DEVOLUCOES_PENDENTES}_${equipeId}`, data || [], 24);
      console.log("[OfflineData] Devoluções pendentes cacheadas:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear devoluções pendentes:", error);
    }
  }, [saveToCache]);

  // Pré-carregar movimentações de estoque
  const preloadMovimentacoesEstoque = useCallback(async (equipeId: string) => {
    try {
      const { data, error } = await supabase
        .from("materiais_movimentacoes")
        .select(`
          id,
          tipo,
          quantidade,
          observacao,
          created_at,
          materiais (codigo, nome, unidade)
        `)
        .or(`local_origem_id.eq.${equipeId},local_destino_id.eq.${equipeId}`)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      await saveToCache(`${CACHE_KEYS.MOVIMENTACOES_ESTOQUE}_${equipeId}`, data || [], 24);
      console.log("[OfflineData] Movimentações de estoque cacheadas:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear movimentações:", error);
    }
  }, [saveToCache]);

  // Pré-carregar colaboradores disponíveis (para abertura de turno)
  const preloadColaboradores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, cpf, nome, cargo")
        .eq("ativo", true)
        .order("nome");
      
      if (error) throw error;
      await saveToCache(CACHE_KEYS.COLABORADORES_DISPONIVEIS, data, 24);
      console.log("[OfflineData] Colaboradores cacheados:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear colaboradores:", error);
    }
  }, [saveToCache]);

  // Pré-carregar catálogo de materiais (todos os materiais ativos)
  const preloadMateriaisCatalogo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, codigo, nome, unidade, requer_serial, categoria, estoque_minimo")
        .eq("ativo", true)
        .order("codigo");
      
      if (error) throw error;
      await saveToCache(CACHE_KEYS.MATERIAIS_CATALOGO, data, 168); // 7 dias
      console.log("[OfflineData] Catálogo de materiais cacheado:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear catálogo de materiais:", error);
    }
  }, [saveToCache]);

  // Pré-carregar procedimentos
  const preloadProcedimentos = useCallback(async (contratoId?: string) => {
    try {
      let query = supabase
        .from("procedimentos")
        .select(`
          id,
          titulo,
          descricao,
          categoria,
          visivel_app,
          ativo,
          ordem,
          created_at,
          updated_at,
          procedimentos_anexos(count)
        `)
        .eq("ativo", true)
        .eq("visivel_app", true)
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });

      if (contratoId) {
        query = query.or(`contrato_id.is.null,contrato_id.eq.${contratoId}`);
      } else {
        query = query.is("contrato_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const procedimentos = (data || []).map((p: any) => ({
        ...p,
        anexos_count: p.procedimentos_anexos?.[0]?.count || 0,
      }));
      
      await saveToCache(CACHE_KEYS.PROCEDIMENTOS_LISTA, procedimentos, 24);
      console.log("[OfflineData] Procedimentos cacheados:", procedimentos?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear procedimentos:", error);
    }
  }, [saveToCache]);

  // Pré-carregar metas do ciclo
  const preloadMetasCiclo = useCallback(async (equipeId: string, dataInicio: string, dataFim: string) => {
    try {
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .eq("equipe_id", equipeId)
        .gte("data", dataInicio)
        .lte("data", dataFim);
      
      if (error) throw error;
      await saveToCache(`${CACHE_KEYS.METAS_CICLO}_${equipeId}_${dataInicio}_${dataFim}`, data, 24);
      console.log("[OfflineData] Metas cacheadas:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear metas:", error);
    }
  }, [saveToCache]);

  // Pré-carregar produções do ciclo
  const preloadProducoesCiclo = useCallback(async (equipeId: string, dataInicio: string, dataFim: string) => {
    try {
      const { data, error } = await supabase
        .from("producao_equipes")
        .select(`
          *,
          retornos_campo:retorno_campo_id (id, codigo, descricao, tipo),
          ordens_servico:ordem_servico_id (tipo)
        `)
        .eq("equipe_id", equipeId)
        .gte("created_at", dataInicio + "T00:00:00")
        .lte("created_at", dataFim + "T23:59:59");
      
      if (error) throw error;
      await saveToCache(`${CACHE_KEYS.PRODUCOES_CICLO}_${equipeId}_${dataInicio}_${dataFim}`, data, 24);
      console.log("[OfflineData] Produções do ciclo cacheadas:", data?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear produções do ciclo:", error);
    }
  }, [saveToCache]);

  // Pré-carregar estatísticas do técnico
  const preloadEstatisticasTecnico = useCallback(async (equipeId: string) => {
    try {
      const inicioMes = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const fimMes = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");
      const hoje = format(new Date(), "yyyy-MM-dd");

      // Buscar ordens do mês
      const { data: ordensConcluidasData, error: ordensError } = await supabase
        .from("planejamento_ordens")
        .select(`
          id,
          ordens_servico:ordem_servico_id (
            id,
            status,
            concluido_at,
            tempo_total_minutos,
            valor
          )
        `)
        .eq("equipe_id", equipeId)
        .gte("created_at", inicioMes + "T00:00:00")
        .lte("created_at", fimMes + "T23:59:59");

      if (ordensError) throw ordensError;

      const ordensConcluidas = ordensConcluidasData?.filter(
        (o: any) => o.ordens_servico?.status === "concluida"
      ) || [];

      const totalOrdens = ordensConcluidasData?.length || 0;
      const totalConcluidas = ordensConcluidas.length;
      const tempoTotal = ordensConcluidas.reduce(
        (acc: number, o: any) => acc + (o.ordens_servico?.tempo_total_minutos || 0),
        0
      );
      const valorTotal = ordensConcluidas.reduce(
        (acc: number, o: any) => acc + (o.ordens_servico?.valor || 0),
        0
      );

      // Buscar ordens de hoje
      const { data: ordensHojeData } = await supabase
        .from("planejamento_ordens")
        .select(`
          id,
          ordens_servico:ordem_servico_id (
            id,
            status
          ),
          planejamentos!inner (
            data_planejamento
          )
        `)
        .eq("equipe_id", equipeId)
        .eq("planejamentos.data_planejamento", hoje);

      const ordensHoje = ordensHojeData?.length || 0;
      const concluidasHoje = ordensHojeData?.filter(
        (o: any) => o.ordens_servico?.status === "concluida"
      ).length || 0;

      const estatisticas = {
        totalOrdens,
        totalConcluidas,
        tempoTotalMinutos: tempoTotal,
        valorTotal,
        ordensHoje,
        concluidasHoje,
        taxaConclusao: totalOrdens > 0 ? Math.round((totalConcluidas / totalOrdens) * 100) : 0,
      };

      await saveToCache(`${CACHE_KEYS.ESTATISTICAS_TECNICO}_${equipeId}`, estatisticas, 24);
      console.log("[OfflineData] Estatísticas do técnico cacheadas:", estatisticas);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear estatísticas:", error);
    }
  }, [saveToCache]);

  // Pré-carregar materiais serializados da equipe
  const preloadMateriaisSerializados = useCallback(async (equipeId: string) => {
    try {
      // Buscar entregas confirmadas da equipe
      const { data: entregas, error: entregasError } = await supabase
        .from("materiais_entregas")
        .select("id, data_entrega, data_confirmacao")
        .eq("equipe_id", equipeId)
        .eq("status", "confirmado");

      if (entregasError) throw entregasError;
      if (!entregas || entregas.length === 0) {
        await saveToCache(`${CACHE_KEYS.MATERIAIS_SERIALIZADOS}_${equipeId}`, [], 24);
        console.log("[OfflineData] Nenhum material serializado para cachear");
        return;
      }

      // Buscar itens das entregas que têm número de série
      const entregaIds = entregas.map((e: any) => e.id);
      const { data: itensEntrega, error: itensError } = await supabase
        .from("materiais_entregas_itens")
        .select(`
          id,
          entrega_id,
          numero_serie,
          material_id,
          materiais (
            codigo,
            nome,
            dias_alerta_retencao
          )
        `)
        .in("entrega_id", entregaIds)
        .not("numero_serie", "is", null);

      if (itensError) throw itensError;
      if (!itensEntrega || itensEntrega.length === 0) {
        await saveToCache(`${CACHE_KEYS.MATERIAIS_SERIALIZADOS}_${equipeId}`, [], 24);
        console.log("[OfflineData] Nenhum item serializado para cachear");
        return;
      }

      // Verificar quais materiais ainda estão com a equipe
      const numerosSerieEntregues = itensEntrega.map((i: any) => i.numero_serie).filter(Boolean);
      
      const { data: serializados, error: serializadosError } = await supabase
        .from("materiais_serializados")
        .select("numero_serie, status")
        .in("numero_serie", numerosSerieEntregues);

      if (serializadosError) throw serializadosError;

      const serializadosMap = new Map(
        (serializados || []).map((s: any) => [s.numero_serie, s.status])
      );

      const entregasMap = new Map(
        entregas.map((e: any) => [e.id, e])
      );

      const materiaisSerializados = itensEntrega
        .filter((item: any) => {
          const status = serializadosMap.get(item.numero_serie);
          return !status || status === "em_estoque" || status === "com_equipe";
        })
        .map((item: any) => {
          const entrega = entregasMap.get(item.entrega_id);
          return {
            id: item.id,
            numero_serie: item.numero_serie,
            data_entrega_equipe: entrega?.data_confirmacao || entrega?.data_entrega,
            created_at: entrega?.data_entrega,
            updated_at: entrega?.data_confirmacao,
            materiais: item.materiais,
          };
        });

      await saveToCache(`${CACHE_KEYS.MATERIAIS_SERIALIZADOS}_${equipeId}`, materiaisSerializados, 24);
      console.log("[OfflineData] Materiais serializados cacheados:", materiaisSerializados?.length);
    } catch (error) {
      console.error("[OfflineData] Erro ao cachear materiais serializados:", error);
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

  // Obter tipo_servico_retornos do cache (por skill_id)
  const getTipoServicoRetornosFromCache = useCallback(async (skillId?: string) => {
    const data = await getFromCache<any[]>(CACHE_KEYS.TIPO_SERVICO_RETORNOS);
    if (!data) return [];
    if (skillId) {
      return data.filter(item => item.skill_id === skillId);
    }
    return data;
  }, [getFromCache]);

  // Obter atividades de retorno do cache (por tipo_servico_retorno_id)
  const getRetornoAtividadesFromCache = useCallback(async (tipoServicoRetornoId?: string) => {
    const data = await getFromCache<any[]>(CACHE_KEYS.TIPO_SERVICO_RETORNO_ATIVIDADES);
    if (!data) return [];
    if (tipoServicoRetornoId) {
      return data.filter(item => item.tipo_servico_retorno_id === tipoServicoRetornoId);
    }
    return data;
  }, [getFromCache]);

  // Obter atividades do cache
  const getAtividadesFromCache = useCallback(async () => {
    return await getFromCache<any[]>(CACHE_KEYS.ATIVIDADES) || [];
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

  // Obter entregas pendentes do cache
  const getEntregasPendentesFromCache = useCallback(async (equipeId: string) => {
    return await getFromCache(`${CACHE_KEYS.ENTREGAS_PENDENTES}_${equipeId}`);
  }, [getFromCache]);

  // Obter devoluções pendentes do cache
  const getDevolucoesPendentesFromCache = useCallback(async (equipeId: string) => {
    return await getFromCache(`${CACHE_KEYS.DEVOLUCOES_PENDENTES}_${equipeId}`);
  }, [getFromCache]);

  // Obter movimentações de estoque do cache
  const getMovimentacoesFromCache = useCallback(async (equipeId: string) => {
    return await getFromCache(`${CACHE_KEYS.MOVIMENTACOES_ESTOQUE}_${equipeId}`);
  }, [getFromCache]);

  // Obter materiais serializados do cache
  const getMateriaisSerializadosFromCache = useCallback(async (equipeId: string) => {
    return await getFromCache(`${CACHE_KEYS.MATERIAIS_SERIALIZADOS}_${equipeId}`);
  }, [getFromCache]);

  // Obter catálogo de materiais do cache
  const getMateriaisCatalogoFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.MATERIAIS_CATALOGO);
  }, [getFromCache]);

  // Obter colaboradores disponíveis do cache
  const getColaboradoresDisponiveisFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.COLABORADORES_DISPONIVEIS);
  }, [getFromCache]);

  // Obter procedimentos do cache
  const getProcedimentosFromCache = useCallback(async () => {
    return await getFromCache(CACHE_KEYS.PROCEDIMENTOS_LISTA);
  }, [getFromCache]);

  // Obter metas do ciclo do cache
  const getMetasCicloFromCache = useCallback(async (equipeId: string, dataInicio: string, dataFim: string) => {
    return await getFromCache(`${CACHE_KEYS.METAS_CICLO}_${equipeId}_${dataInicio}_${dataFim}`);
  }, [getFromCache]);

  // Obter produções do ciclo do cache
  const getProducoesCicloFromCache = useCallback(async (equipeId: string, dataInicio: string, dataFim: string) => {
    return await getFromCache(`${CACHE_KEYS.PRODUCOES_CICLO}_${equipeId}_${dataInicio}_${dataFim}`);
  }, [getFromCache]);

  // Obter estatísticas do técnico do cache
  const getEstatisticasTecnicoFromCache = useCallback(async (equipeId: string) => {
    return await getFromCache(`${CACHE_KEYS.ESTATISTICAS_TECNICO}_${equipeId}`);
  }, [getFromCache]);

  // ============ FUNÇÕES DE ATUALIZAÇÃO LOCAL ============

  // Atualizar ordem de serviço localmente (para refletir mudanças offline)
  const updateOrdemLocal = useCallback(async (equipeId: string, ordemId: string, updates: any) => {
    const dataHoje = format(new Date(), "yyyy-MM-dd");
    
    // Atualizar cache de ordens planejadas
    const ordens = await getFromCache<any[]>(`${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeId}`);
    if (ordens) {
      const updatedOrdens = ordens.map(o => 
        o.id === ordemId ? { ...o, ...updates } : o
      );
      await saveToCache(`${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeId}`, updatedOrdens, 24);
    }
    
    // IMPORTANTE: Atualizar também o cache de planejamento do dia
    // Este cache tem estrutura { ordens_servico: {...}, ordem_na_rota: ... }
    const planejamento = await getFromCache<any[]>(`${CACHE_KEYS.PLANEJAMENTO_DIA}_${equipeId}_${dataHoje}`);
    if (planejamento) {
      const updatedPlanejamento = planejamento.map(p => {
        // Verificar se é a ordem correta (pode estar em ordens_servico ou direto)
        const ordemAtual = p.ordens_servico || p;
        const ordemIdAtual = ordemAtual.id || p.ordem_servico_id || p.id;
        
        if (ordemIdAtual === ordemId) {
          // Atualizar a estrutura correta
          if (p.ordens_servico) {
            return {
              ...p,
              ordens_servico: { ...p.ordens_servico, ...updates }
            };
          }
          return { ...p, ...updates };
        }
        return p;
      });
      await saveToCache(`${CACHE_KEYS.PLANEJAMENTO_DIA}_${equipeId}_${dataHoje}`, updatedPlanejamento, 24);
      console.log("[OfflineData] Cache de planejamento atualizado para ordem:", ordemId);
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
    preloadRetornosCampoCompleto,
    preloadEntregasPendentes,
    preloadDevolucoesPendentes,
    preloadMovimentacoesEstoque,
    preloadMateriaisSerializados,
    preloadColaboradores,
    preloadProcedimentos,
    preloadMetasCiclo,
    preloadProducoesCiclo,
    preloadEstatisticasTecnico,
    preloadMateriaisCatalogo,
    
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
    getTipoServicoRetornosFromCache,
    getRetornoAtividadesFromCache,
    getAtividadesFromCache,
    getEntregasPendentesFromCache,
    getDevolucoesPendentesFromCache,
    getMovimentacoesFromCache,
    getMateriaisSerializadosFromCache,
    getMateriaisCatalogoFromCache,
    getColaboradoresDisponiveisFromCache,
    getProcedimentosFromCache,
    getMetasCicloFromCache,
    getProducoesCicloFromCache,
    getEstatisticasTecnicoFromCache,
    
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

