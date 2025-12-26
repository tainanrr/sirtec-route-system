import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface ProducaoRegistrada {
  id: string;
  ordem_servico_id: string;
  retorno_campo_id: string;
  valor_total: number;
}

export function useRetornoCampo() {
  const [loading, setLoading] = useState(false);

  /**
   * Busca o skill_id baseado no código do tipo de serviço
   */
  const buscarSkillId = useCallback(async (tipoServico: string): Promise<string | null> => {
    try {
      // Normalizar o tipo para buscar
      const tipoNormalizado = tipoServico
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .trim();

      // Tentar buscar pelo código exato primeiro
      let { data, error } = await supabase
        .from("skills")
        .select("id")
        .eq("codigo", tipoNormalizado)
        .eq("ativo", true)
        .maybeSingle();

      if (!data) {
        // Tentar buscar pelo nome
        const { data: dataByNome } = await supabase
          .from("skills")
          .select("id")
          .ilike("nome", `%${tipoServico}%`)
          .eq("ativo", true)
          .maybeSingle();

        data = dataByNome;
      }

      return data?.id || null;
    } catch (error) {
      console.error("Erro ao buscar skill:", error);
      return null;
    }
  }, []);

  /**
   * Registra a produção da equipe com base no retorno de campo selecionado
   */
  const registrarProducao = useCallback(
    async (
      ordemServicoId: string,
      equipeId: string,
      retorno: RetornoCampoResult
    ): Promise<ProducaoRegistrada | null> => {
      setLoading(true);
      try {
        // Calcular valor total das atividades
        let valorTotal = 0;
        retorno.atividades.forEach((atv) => {
          valorTotal += (atv.atividade.valor_unitario || 0) * atv.quantidade;
        });

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
          throw producaoError;
        }

        // Inserir atividades da produção
        if (retorno.atividades.length > 0 && producao) {
          const atividadesParaInserir = retorno.atividades.map((atv) => ({
            producao_id: producao.id,
            atividade_id: atv.atividade_id,
            atividade_codigo: atv.atividade.codigo,
            atividade_descricao: atv.atividade.descricao,
            quantidade: atv.quantidade,
            valor_unitario: atv.atividade.valor_unitario || 0,
            valor_total: (atv.atividade.valor_unitario || 0) * atv.quantidade,
            qtd_min_fotos: atv.qtd_min_fotos,
          }));

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
    []
  );

  /**
   * Atualiza a OS com as informações do retorno de campo
   */
  const atualizarOrdemComRetorno = useCallback(
    async (
      ordemServicoId: string,
      retorno: RetornoCampoResult
    ): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("ordens_servico")
          .update({
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
          throw error;
        }

        return true;
      } catch (error: any) {
        console.error("Erro ao atualizar ordem:", error);
        return false;
      }
    },
    []
  );

  return {
    loading,
    buscarSkillId,
    registrarProducao,
    atualizarOrdemComRetorno,
  };
}

