import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOfflineSyncContext } from "./useOfflineSync";
import { CACHE_KEYS } from "./useOfflineData";

interface Atividade {
  id: string;
  codigo: string;
  descricao: string;
  valor_unitario: number;
  unidade: string;
}

interface AtividadeSelecionada {
  atividade_id: string;
  quantidade: number;
  atividade: Atividade;
  qtd_min_fotos: number;
}

interface RetornoCampoResult {
  retorno_campo_id: string;
  retorno_codigo: string;
  retorno_descricao: string;
  gera_producao: boolean;
  atividades: AtividadeSelecionada[];
}

// Função auxiliar para extrair apenas o código da atividade (sem descrição)
// Ex: "SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT" -> "SDCLU6013II"
function extrairCodigoAtividade(codigoCompleto: string): string {
  if (!codigoCompleto) return "";
  // Se contém " - ", extrair apenas a parte antes
  const partes = codigoCompleto.split(" - ");
  const codigo = partes[0].trim();
  // Limitar a 50 caracteres para caber no VARCHAR(50) do banco
  return codigo.substring(0, 50);
}

// Função auxiliar para extrair a descrição da atividade
// Ex: "SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT" -> "INSTALAR RAMAL DE LIG-MONO-BT"
function extrairDescricaoAtividade(codigoCompleto: string, descricaoOriginal?: string): string {
  if (descricaoOriginal) return descricaoOriginal.substring(0, 255);
  if (!codigoCompleto) return "";
  const partes = codigoCompleto.split(" - ");
  if (partes.length > 1) {
    return partes.slice(1).join(" - ").trim().substring(0, 255);
  }
  return codigoCompleto.substring(0, 255);
}

interface ProducaoRegistrada {
  id: string;
  ordem_servico_id: string;
  retorno_campo_id: string;
  valor_total: number;
}

export function useRetornoCampo() {
  const [loading, setLoading] = useState(false);
  const { isOnline, getFromCache, queueOperation } = useOfflineSyncContext();

  /**
   * Busca skill no cache offline
   */
  const buscarSkillOffline = useCallback(async (tipoServico: string): Promise<string | null> => {
    try {
      const skillsCache = await getFromCache<any[]>(CACHE_KEYS.SKILLS);
      
      if (!skillsCache || skillsCache.length === 0) {
        console.log("[useRetornoCampo] Cache de skills vazio");
        return null;
      }

      // Normalizar o tipo para buscar
      const tipoNormalizado = tipoServico
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .trim();

      const tipoLower = tipoServico.toLowerCase().trim();
      const tipoUpper = tipoServico.toUpperCase().trim();

      // Buscar por código (várias variações)
      let skill = skillsCache.find((s: any) => {
        if (!s.ativo) return false;
        const codigo = (s.codigo || "").toUpperCase().trim();
        return codigo === tipoNormalizado ||
               codigo === tipoUpper ||
               codigo === tipoNormalizado.replace(/_/g, " ") ||
               codigo === tipoNormalizado.replace(/_/g, "");
      });

      // Se não encontrou pelo código, buscar pelo nome
      if (!skill) {
        skill = skillsCache.find((s: any) => {
          if (!s.ativo) return false;
          const nome = (s.nome || "").toLowerCase();
          return nome.includes(tipoLower) || tipoLower.includes(nome);
        });
      }

      // Busca parcial por palavras
      if (!skill) {
        const palavras = tipoServico.toLowerCase().split(/\s+/).filter(p => p.length >= 3);
        for (const palavra of palavras) {
          skill = skillsCache.find((s: any) => {
            if (!s.ativo) return false;
            const nome = (s.nome || "").toLowerCase();
            return nome.includes(palavra);
          });
          if (skill) break;
        }
      }

      if (skill) {
        console.log(`[useRetornoCampo] ✅ Skill encontrada no cache: ${skill.id} (${skill.nome})`);
        return skill.id;
      }

      console.log(`[useRetornoCampo] ❌ Skill não encontrada no cache para: ${tipoServico}`);
      return null;
    } catch (error) {
      console.error("[useRetornoCampo] Erro ao buscar skill do cache:", error);
      return null;
    }
  }, [getFromCache]);

  /**
   * Busca o skill_id baseado no código do tipo de serviço
   * Verifica também se há retornos de campo configurados
   */
  const buscarSkillId = useCallback(async (tipoServico: string): Promise<string | null> => {
    // Se offline, buscar do cache
    if (!isOnline) {
      console.log("[useRetornoCampo] Offline - buscando skill do cache...");
      return buscarSkillOffline(tipoServico);
    }

    try {
      // Normalizar o tipo para buscar
      const tipoNormalizado = tipoServico
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .trim();

      // Variações do código para busca
      const variacoes = [
        tipoNormalizado,
        tipoServico.toUpperCase().trim(),
        tipoServico.trim(),
        tipoNormalizado.replace(/_/g, " "),
        tipoNormalizado.replace(/_/g, ""),
      ];

      let skillId: string | null = null;

      // Tentar buscar pelo código com diferentes variações
      for (const variacao of variacoes) {
        if (skillId) break;
        
        const { data } = await supabase
          .from("skills")
          .select("id")
          .eq("codigo", variacao)
          .eq("ativo", true)
          .maybeSingle();
        
        if (data?.id) {
          skillId = data.id;
        }
      }

      // Se não encontrou pelo código, tentar pelo nome
      if (!skillId) {
        const { data: dataByNome } = await supabase
          .from("skills")
          .select("id")
          .ilike("nome", `%${tipoServico}%`)
          .eq("ativo", true)
          .maybeSingle();

        skillId = dataByNome?.id || null;
      }

      // Se não encontrou por nome exato, tentar busca parcial
      if (!skillId) {
        const palavras = tipoServico.split(/\s+/);
        for (const palavra of palavras) {
          if (skillId || palavra.length < 3) continue;
          
          const { data: dataByPalavra } = await supabase
            .from("skills")
            .select("id")
            .ilike("nome", `%${palavra}%`)
            .eq("ativo", true)
            .limit(1)
            .maybeSingle();

          skillId = dataByPalavra?.id || null;
        }
      }

      // Se encontrou a skill, verificar se tem retornos de campo configurados
      if (skillId) {
        const { data: retornos, error: retornosError } = await supabase
          .from("tipo_servico_retornos")
          .select("id")
          .eq("skill_id", skillId)
          .eq("ativo", true)
          .limit(1);

        if (retornosError || !retornos || retornos.length === 0) {
          console.warn(`[useRetornoCampo] Skill ${skillId} encontrada mas sem retornos configurados para tipo: ${tipoServico}`);
          // Ainda retorna o skillId para permitir configuração futura
          // mas o componente mostrará "Nenhum retorno configurado"
        }
      }

      if (!skillId) {
        console.warn(`[useRetornoCampo] Nenhuma skill encontrada para tipo: ${tipoServico} (normalizado: ${tipoNormalizado})`);
      }

      return skillId;
    } catch (error) {
      console.error("Erro ao buscar skill:", error);
      // Se falhou por rede, tentar offline
      if (!navigator.onLine) {
        return buscarSkillOffline(tipoServico);
      }
      return null;
    }
  }, [isOnline, buscarSkillOffline]);

  /**
   * Busca o valor de uma atividade na precificação do contrato
   */
  const buscarValorPrecificacao = useCallback(
    async (codigoAtividade: string, contratoId: string | null): Promise<number> => {
      if (!contratoId) return 0;

      try {
        // Extrair apenas o código da atividade (antes do " - " se houver descrição concatenada)
        const codigoLimpo = codigoAtividade.includes(" - ") 
          ? codigoAtividade.split(" - ")[0].trim() 
          : codigoAtividade.trim();
        
        // Primeiro, buscar o código do contrato para debug
        const { data: contratoData } = await supabase
          .from("contratos")
          .select("codigo, nome")
          .eq("id", contratoId)
          .maybeSingle();
        
        const codigoContrato = contratoData?.codigo || "N/A";
        console.log(`[useRetornoCampo] 🔍 Buscando precificação: atividade_original=${codigoAtividade}, codigo_limpo=${codigoLimpo}, contrato_id=${contratoId}, contrato_codigo=${codigoContrato}`);

        // Buscar na tabela de precificação pelo código da atividade e contrato
        const { data, error } = await supabase
          .from("precificacao_servicos")
          .select("valor_unitario, valor_total, data_inicio, data_fim, ativo")
          .eq("contrato_id", contratoId)
          .eq("codigo_servico", codigoLimpo)
          .eq("ativo", true)
          .lte("data_inicio", new Date().toISOString().split("T")[0])
          .or(`data_fim.is.null,data_fim.gte.${new Date().toISOString().split("T")[0]}`)
          .order("data_inicio", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn(`[useRetornoCampo] ❌ Erro ao buscar precificação para ${codigoLimpo} no contrato ${contratoId} (${codigoContrato}):`, error);
          return 0;
        }

        if (!data) {
          console.warn(`[useRetornoCampo] ⚠️ Nenhum registro encontrado na precificação para ${codigoLimpo} no contrato ${contratoId} (${codigoContrato})`);
          // Tentar buscar sem filtro de vigência para debug
          const { data: debugData } = await supabase
            .from("precificacao_servicos")
            .select("valor_unitario, valor_total, data_inicio, data_fim, ativo")
            .eq("contrato_id", contratoId)
            .eq("codigo_servico", codigoLimpo)
            .order("data_inicio", { ascending: false })
            .limit(5);
          if (debugData && debugData.length > 0) {
            console.log(`[useRetornoCampo] 🔍 Debug: Encontrados ${debugData.length} registros sem filtro de vigência:`, debugData);
          }
          return 0;
        }

        // Usar valor_total se existir (já considera fator_k), senão valor_unitario
        const valor = data?.valor_total || data?.valor_unitario || 0;
        if (valor > 0) {
          console.log(`[useRetornoCampo] ✅ Precificação encontrada para ${codigoLimpo} no contrato ${contratoId} (${codigoContrato}): R$${valor} (vigência: ${data.data_inicio} a ${data.data_fim || 'indefinida'})`);
        } else {
          console.warn(`[useRetornoCampo] ⚠️ Precificação encontrada mas valor zerado para ${codigoLimpo} no contrato ${contratoId} (${codigoContrato})`);
        }
        return Number(valor);
      } catch (error) {
        console.error(`[useRetornoCampo] ❌ Erro ao buscar precificação:`, error);
        return 0;
      }
    },
    []
  );

  /**
   * Registra produção offline (enfileira para sincronização)
   */
  const registrarProducaoOffline = useCallback(
    async (
      ordemServicoId: string,
      equipeId: string,
      retorno: RetornoCampoResult
    ): Promise<ProducaoRegistrada | null> => {
      console.log("[useRetornoCampo] 📦 Registrando produção OFFLINE");
      
      // Calcular valor total com valores disponíveis
      let valorTotal = 0;
      const atividadesComValor = retorno.atividades.map(atv => {
        const valorUnit = atv.atividade.valor_unitario || 0;
        const subtotal = valorUnit * atv.quantidade;
        valorTotal += subtotal;
        return {
          ...atv,
          atividade: { ...atv.atividade, valor_unitario: valorUnit }
        };
      });
      
      // Criar ID temporário para a produção
      const producaoId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Preparar dados para enfileirar
      const producaoData = {
        id: producaoId,
        ordem_servico_id: ordemServicoId,
        equipe_id: equipeId,
        retorno_campo_id: retorno.retorno_campo_id,
        retorno_codigo: retorno.retorno_codigo,
        retorno_descricao: retorno.retorno_descricao,
        gera_producao: retorno.gera_producao,
        valor_total: valorTotal,
        data_registro: new Date().toISOString(),
        atividades: atividadesComValor.map(atv => ({
          atividade_id: atv.atividade_id,
          // Extrair apenas o código (antes do " - ") para caber no VARCHAR(50)
          atividade_codigo: extrairCodigoAtividade(atv.atividade.codigo),
          // Usar descrição da atividade ou extrair do código completo
          atividade_descricao: extrairDescricaoAtividade(atv.atividade.codigo, atv.atividade.descricao),
          quantidade: atv.quantidade,
          valor_unitario: atv.atividade.valor_unitario || 0,
          valor_total: (atv.atividade.valor_unitario || 0) * atv.quantidade,
          qtd_min_fotos: atv.qtd_min_fotos,
        })),
        pendente_sync: true,
      };
      
      // Enfileirar operação
      try {
        await queueOperation(
          "register_producao_completa",
          "producao_equipes",
          "insert",
          producaoData,
          1 // Alta prioridade
        );
        
        toast.info("Produção registrada localmente. Será sincronizada quando houver conexão.");
        
        return {
          id: producaoId,
          ordem_servico_id: ordemServicoId,
          retorno_campo_id: retorno.retorno_campo_id,
          valor_total: valorTotal,
        };
      } catch (error) {
        console.error("[useRetornoCampo] Erro ao enfileirar produção:", error);
        toast.error("Erro ao salvar produção offline");
        return null;
      }
    },
    [queueOperation]
  );

  /**
   * Registra a produção da equipe com base no retorno de campo selecionado
   */
  const registrarProducao = useCallback(
    async (
      ordemServicoId: string,
      equipeId: string,
      retorno: RetornoCampoResult
    ): Promise<ProducaoRegistrada | null> => {
      // Se offline, usar função específica
      if (!isOnline) {
        return registrarProducaoOffline(ordemServicoId, equipeId, retorno);
      }

      setLoading(true);
      try {
        console.log("[useRetornoCampo] Registrando produção:", {
          ordemServicoId,
          equipeId,
          retorno_campo_id: retorno.retorno_campo_id,
          atividades: retorno.atividades.map(a => ({
            codigo: a.atividade.codigo,
            qtd: a.quantidade,
            valor_unit: a.atividade.valor_unitario
          }))
        });

        // Buscar contrato_id da OS
        const { data: osData } = await supabase
          .from("ordens_servico")
          .select("contrato_id")
          .eq("id", ordemServicoId)
          .single();

        const contratoId = osData?.contrato_id || null;
        console.log("[useRetornoCampo] Contrato da OS:", contratoId);

        // Calcular valor total das atividades (buscando da precificação quando necessário)
        let valorTotal = 0;
        const atividadesComValor: AtividadeSelecionada[] = [];

        for (const atv of retorno.atividades) {
          let valorUnit = atv.atividade.valor_unitario || 0;
          console.log(`[useRetornoCampo] 🔍 Processando atividade ${atv.atividade.codigo}: valor_unitario inicial = R$${valorUnit}, contratoId = ${contratoId}`);
          
          // Se não tem valor na atividade, tentar buscar na precificação do contrato
          if (valorUnit === 0 && contratoId) {
            console.log(`[useRetornoCampo] 🔎 Buscando precificação para ${atv.atividade.codigo} no contrato ${contratoId}...`);
            valorUnit = await buscarValorPrecificacao(atv.atividade.codigo, contratoId);
            console.log(`[useRetornoCampo] ✅ Valor buscado da precificação para ${atv.atividade.codigo}: R$${valorUnit}`);
          } else if (valorUnit === 0 && !contratoId) {
            console.warn(`[useRetornoCampo] ⚠️ Atividade ${atv.atividade.codigo} sem valor_unitario e sem contrato_id na OS`);
          }
          
          // Se ainda não tem valor e não tem contrato, logar aviso (mas não bloquear)
          if (valorUnit === 0) {
            console.warn(`[useRetornoCampo] ⚠️ Atividade ${atv.atividade.codigo} sem valor_unitario definido e sem contrato_id para buscar precificação`);
          }
          
          const subtotal = valorUnit * atv.quantidade;
          console.log(`[useRetornoCampo] 💰 Atividade ${atv.atividade.codigo}: ${atv.quantidade} x R$${valorUnit} = R$${subtotal}`);
          valorTotal += subtotal;

          // Atualizar atividade com valor encontrado
          atividadesComValor.push({
            ...atv,
            atividade: {
              ...atv.atividade,
              valor_unitario: valorUnit
            }
          });
        }
        
        console.log("[useRetornoCampo] Valor total calculado:", valorTotal);

        // Inserir registro de produção
        const { data: producao, error: producaoError } = await supabase
          .from("producao_equipes")
          .insert({
            ordem_servico_id: ordemServicoId,
            equipe_id: equipeId,
            retorno_campo_id: retorno.retorno_campo_id,
            retorno_codigo: retorno.retorno_codigo,
            retorno_descricao: retorno.retorno_descricao,
            gera_producao: retorno.gera_producao,
            valor_total: valorTotal,
            data_registro: new Date().toISOString(),
          })
          .select()
          .single();

        if (producaoError) {
          // Se a tabela não existir, criar silenciosamente (pode ser primeira vez)
          if (producaoError.code === "42P01") {
            console.warn("Tabela producao_equipes não existe ainda");
            return null;
          }
          // Se offline, tentar modo offline
          if (!navigator.onLine) {
            return registrarProducaoOffline(ordemServicoId, equipeId, retorno);
          }
          throw producaoError;
        }

        // Inserir atividades da produção (usando atividadesComValor que tem os valores corretos)
        if (atividadesComValor.length > 0 && producao) {
          const atividadesParaInserir = atividadesComValor.map((atv) => ({
            producao_id: producao.id,
            atividade_id: atv.atividade_id,
            // Extrair apenas o código (antes do " - ") para caber no VARCHAR(50)
            atividade_codigo: extrairCodigoAtividade(atv.atividade.codigo),
            // Usar descrição da atividade ou extrair do código completo
            atividade_descricao: extrairDescricaoAtividade(atv.atividade.codigo, atv.atividade.descricao),
            quantidade: atv.quantidade,
            valor_unitario: atv.atividade.valor_unitario || 0,
            valor_total: (atv.atividade.valor_unitario || 0) * atv.quantidade,
            qtd_min_fotos: atv.qtd_min_fotos,
          }));

          console.log("[useRetornoCampo] Inserindo atividades:", atividadesParaInserir.map(a => ({
            codigo: a.atividade_codigo,
            descricao: a.atividade_descricao?.substring(0, 30),
            valor: a.valor_total
          })));

          const { error: atividadesError } = await supabase
            .from("producao_atividades")
            .insert(atividadesParaInserir);

          if (atividadesError && atividadesError.code !== "42P01") {
            console.error("Erro ao inserir atividades:", atividadesError);
          }
        }

        return producao;
      } catch (error: any) {
        console.error("Erro ao registrar produção:", error);
        // Não exibir toast de erro se for só a tabela faltando
        if (error.code !== "42P01") {
          toast.error("Erro ao registrar produção");
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [buscarValorPrecificacao]
  );

  /**
   * Atualiza a OS com as informações do retorno de campo
   */
  const atualizarOrdemComRetorno = useCallback(
    async (
      ordemServicoId: string,
      retorno: RetornoCampoResult,
      numeroOs?: string // Número da OS para exibição no indicador de sincronização offline
    ): Promise<boolean> => {
      const updateData = {
        id: ordemServicoId,
        numero_os: numeroOs, // Para exibição no indicador offline (será removido antes de enviar ao banco)
        retorno_campo_id: retorno.retorno_campo_id,
        retorno_campo_codigo: retorno.retorno_codigo,
        retorno_campo_descricao: retorno.retorno_descricao,
        gera_producao: retorno.gera_producao,
        updated_at: new Date().toISOString(),
      };

      // Se offline, enfileirar operação
      if (!isOnline) {
        console.log("[useRetornoCampo] 📦 Enfileirando atualização de retorno (offline)");
        try {
          await queueOperation(
            "update_ordem_retorno",
            "ordens_servico",
            "update",
            updateData,
            1 // Alta prioridade
          );
          return true;
        } catch (error) {
          console.error("[useRetornoCampo] Erro ao enfileirar atualização:", error);
          return false;
        }
      }

      try {
        const { error } = await supabase
          .from("ordens_servico")
          .update({
            retorno_campo_id: retorno.retorno_campo_id,
            retorno_campo_codigo: retorno.retorno_codigo,
            retorno_campo_descricao: retorno.retorno_descricao,
            gera_producao: retorno.gera_producao,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ordemServicoId);

        if (error) {
          // Se as colunas não existirem, ignorar silenciosamente
          if (error.code === "42703") {
            console.warn("Colunas de retorno de campo não existem na tabela ordens_servico");
            return true;
          }
          // Se offline, enfileirar
          if (!navigator.onLine) {
            await queueOperation(
              "update_ordem_retorno",
              "ordens_servico",
              "update",
              { ...updateData, numero_os: numeroOs },
              1
            );
            return true;
          }
          throw error;
        }

        return true;
      } catch (error: any) {
        console.error("Erro ao atualizar ordem:", error);
        return false;
      }
    },
    [isOnline, queueOperation]
  );

  return {
    loading,
    buscarSkillId,
    registrarProducao,
    atualizarOrdemComRetorno,
  };
}

