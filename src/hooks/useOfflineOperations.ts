import { useCallback } from "react";
import { useOfflineSyncContext, OperationType } from "./useOfflineSync";
import { useOfflineData, CACHE_KEYS } from "./useOfflineData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

// Interface para ordem de serviço
interface OrdemServico {
  id: string;
  numero: string;
  tipo: string;
  status: string;
  endereco?: string;
  latitude?: number;
  longitude?: number;
  cliente_nome?: string;
  cliente_telefone?: string;
  prazo?: string;
  valor?: number;
  regulada?: string;
  observacoes?: string;
  contrato_id?: string;
  centro_custo_id?: string;
  deslocamento_iniciado_at?: string;
  chegada_local_at?: string;
  execucao_iniciada_at?: string;
  concluido_at?: string;
  pausado_at?: string;
}

// Interface para intervalo
interface Intervalo {
  id: string;
  equipe_id: string;
  tipo_intervalo_id: string;
  hora_inicio: string;
  hora_fim?: string;
  observacao?: string;
}

// Interface para produção
interface Producao {
  id: string;
  equipe_id: string;
  turno_id: string;
  ordem_servico_id: string;
  retorno_campo_id: string;
  data_execucao: string;
  tempo_execucao_minutos?: number;
  observacoes?: string;
}

// Hook para operações offline
export function useOfflineOperations() {
  const { isOnline, queueOperation, saveToCache, getFromCache } = useOfflineSyncContext();
  const { updateOrdemLocal, addProducaoLocal, addIntervaloLocal, updateIntervaloLocal } = useOfflineData();

  // ============ OPERAÇÕES DE ORDEM DE SERVIÇO ============

  // Atualizar status de uma OS
  const updateOSStatus = useCallback(async (
    osId: string,
    novoStatus: string,
    equipeId: string,
    dadosAdicionais?: Partial<OrdemServico>
  ): Promise<{ success: boolean; offline?: boolean }> => {
    const agora = new Date().toISOString();
    
    // Preparar dados de atualização
    const updateData: Partial<OrdemServico> = {
      status: novoStatus,
      ...dadosAdicionais,
    };

    // Adicionar timestamps conforme o status
    if (novoStatus === "em_deslocamento") {
      updateData.deslocamento_iniciado_at = agora;
    } else if (novoStatus === "no_local") {
      updateData.chegada_local_at = agora;
    } else if (novoStatus === "em_execucao" || novoStatus === "em_andamento") {
      updateData.execucao_iniciada_at = agora;
    } else if (novoStatus === "concluida") {
      updateData.concluido_at = agora;
    } else if (novoStatus === "pausada") {
      updateData.pausado_at = agora;
    }

    // Se offline, salvar na fila e atualizar localmente
    if (!isOnline) {
      console.log("[OfflineOps] Atualizando OS offline:", osId, novoStatus);
      
      try {
        // Enfileirar operação para sincronização
        await queueOperation(
          "update_os_status",
          "ordens_servico",
          "update",
          { id: osId, ...updateData },
          1 // Alta prioridade
        );

        // Atualizar dados locais
        await updateOrdemLocal(equipeId, osId, updateData);

        toast.info("Status atualizado localmente. Será sincronizado quando houver conexão.");
        return { success: true, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao atualizar OS offline:", error);
        toast.error("Erro ao salvar operação offline");
        return { success: false, offline: true };
      }
    }

    // Se online, executar direto
    try {
      const { error } = await supabase
        .from("ordens_servico")
        .update(updateData)
        .eq("id", osId);

      if (error) throw error;

      // Atualizar dados locais também (cache)
      await updateOrdemLocal(equipeId, osId, updateData);

      return { success: true, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao atualizar OS:", error);
      
      // Se falhou por rede, tentar offline
      if (!navigator.onLine) {
        return updateOSStatus(osId, novoStatus, equipeId, dadosAdicionais);
      }
      
      toast.error("Erro ao atualizar ordem de serviço");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, updateOrdemLocal]);

  // ============ OPERAÇÕES DE PRODUÇÃO ============

  // Registrar produção
  const registrarProducao = useCallback(async (
    producao: Omit<Producao, "id">
  ): Promise<{ success: boolean; id?: string; offline?: boolean }> => {
    const dataHoje = format(new Date(), "yyyy-MM-dd");
    const producaoId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Se offline, salvar na fila e localmente
    if (!isOnline) {
      console.log("[OfflineOps] Registrando produção offline");
      
      try {
        const producaoCompleta: Producao = {
          ...producao,
          id: producaoId,
        };

        // Enfileirar para sincronização
        await queueOperation(
          "register_producao",
          "producao_equipes",
          "insert",
          producaoCompleta,
          1 // Alta prioridade
        );

        // Salvar localmente
        await addProducaoLocal(producao.equipe_id, dataHoje, producaoCompleta);

        toast.info("Produção registrada localmente. Será sincronizada quando houver conexão.");
        return { success: true, id: producaoId, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao registrar produção offline:", error);
        toast.error("Erro ao salvar produção offline");
        return { success: false, offline: true };
      }
    }

    // Se online, inserir direto
    try {
      const { data, error } = await supabase
        .from("producao_equipes")
        .insert(producao)
        .select("id")
        .single();

      if (error) throw error;

      // Salvar localmente também
      await addProducaoLocal(producao.equipe_id, dataHoje, { ...producao, id: data.id });

      return { success: true, id: data.id, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao registrar produção:", error);
      
      // Se falhou por rede, tentar offline
      if (!navigator.onLine) {
        return registrarProducao(producao);
      }
      
      toast.error("Erro ao registrar produção");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, addProducaoLocal]);

  // ============ OPERAÇÕES DE INTERVALO ============

  // Iniciar intervalo
  const iniciarIntervalo = useCallback(async (
    equipeId: string,
    tipoIntervaloId: string,
    observacao?: string
  ): Promise<{ success: boolean; id?: string; offline?: boolean }> => {
    const agora = new Date().toISOString();
    const dataHoje = format(new Date(), "yyyy-MM-dd");
    const intervaloId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const intervalo: Intervalo = {
      id: intervaloId,
      equipe_id: equipeId,
      tipo_intervalo_id: tipoIntervaloId,
      hora_inicio: agora,
      observacao,
    };

    // Se offline, salvar na fila e localmente
    if (!isOnline) {
      console.log("[OfflineOps] Iniciando intervalo offline");
      
      try {
        // Enfileirar para sincronização
        await queueOperation(
          "start_intervalo",
          "equipes_intervalos",
          "insert",
          intervalo,
          2 // Prioridade média
        );

        // Salvar localmente
        await addIntervaloLocal(equipeId, dataHoje, intervalo);

        toast.info("Intervalo iniciado localmente. Será sincronizado quando houver conexão.");
        return { success: true, id: intervaloId, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao iniciar intervalo offline:", error);
        toast.error("Erro ao salvar intervalo offline");
        return { success: false, offline: true };
      }
    }

    // Se online, inserir direto
    try {
      const { data, error } = await supabase
        .from("equipes_intervalos")
        .insert({
          equipe_id: equipeId,
          tipo_intervalo_id: tipoIntervaloId,
          hora_inicio: agora,
          observacao,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Salvar localmente também
      await addIntervaloLocal(equipeId, dataHoje, { ...intervalo, id: data.id });

      return { success: true, id: data.id, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao iniciar intervalo:", error);
      
      // Se falhou por rede, tentar offline
      if (!navigator.onLine) {
        return iniciarIntervalo(equipeId, tipoIntervaloId, observacao);
      }
      
      toast.error("Erro ao iniciar intervalo");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, addIntervaloLocal]);

  // Encerrar intervalo
  const encerrarIntervalo = useCallback(async (
    intervaloId: string,
    equipeId: string
  ): Promise<{ success: boolean; offline?: boolean }> => {
    const agora = new Date().toISOString();
    const dataHoje = format(new Date(), "yyyy-MM-dd");

    // Se offline, salvar na fila e atualizar localmente
    if (!isOnline) {
      console.log("[OfflineOps] Encerrando intervalo offline:", intervaloId);
      
      try {
        // Enfileirar para sincronização
        await queueOperation(
          "end_intervalo",
          "equipes_intervalos",
          "update",
          { id: intervaloId, hora_fim: agora },
          2 // Prioridade média
        );

        // Atualizar localmente
        await updateIntervaloLocal(equipeId, dataHoje, intervaloId, { hora_fim: agora });

        toast.info("Intervalo encerrado localmente. Será sincronizado quando houver conexão.");
        return { success: true, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao encerrar intervalo offline:", error);
        toast.error("Erro ao salvar encerramento offline");
        return { success: false, offline: true };
      }
    }

    // Se online, atualizar direto
    try {
      const { error } = await supabase
        .from("equipes_intervalos")
        .update({ hora_fim: agora })
        .eq("id", intervaloId);

      if (error) throw error;

      // Atualizar localmente também
      await updateIntervaloLocal(equipeId, dataHoje, intervaloId, { hora_fim: agora });

      return { success: true, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao encerrar intervalo:", error);
      
      // Se falhou por rede, tentar offline
      if (!navigator.onLine) {
        return encerrarIntervalo(intervaloId, equipeId);
      }
      
      toast.error("Erro ao encerrar intervalo");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, updateIntervaloLocal]);

  // ============ OPERAÇÕES DE LOCALIZAÇÃO ============

  // Atualizar localização da equipe
  const atualizarLocalizacao = useCallback(async (
    equipeId: string,
    latitude: number,
    longitude: number
  ): Promise<{ success: boolean; offline?: boolean }> => {
    const agora = new Date().toISOString();

    // Se offline, apenas salvar na fila (prioridade baixa)
    if (!isOnline) {
      try {
        await queueOperation(
          "update_localizacao",
          "equipes_localizacoes",
          "insert",
          {
            equipe_id: equipeId,
            latitude,
            longitude,
            timestamp: agora,
          },
          3 // Prioridade baixa
        );
        return { success: true, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao salvar localização offline:", error);
        return { success: false, offline: true };
      }
    }

    // Se online, inserir direto
    try {
      const { error } = await supabase
        .from("equipes_localizacoes")
        .insert({
          equipe_id: equipeId,
          latitude,
          longitude,
          timestamp: agora,
        });

      if (error) throw error;
      return { success: true, offline: false };
    } catch (error) {
      // Localização não é crítica, não mostrar erro
      console.error("[OfflineOps] Erro ao atualizar localização:", error);
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation]);

  // ============ OPERAÇÕES DE CHAT ============

  // Enviar mensagem de chat
  const enviarMensagemChat = useCallback(async (
    conversaId: string,
    conteudo: string,
    remetenteId: string,
    remetenteTipo: "equipe" | "coordenador"
  ): Promise<{ success: boolean; id?: string; offline?: boolean }> => {
    const agora = new Date().toISOString();
    const mensagemId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const mensagem = {
      id: mensagemId,
      conversa_id: conversaId,
      conteudo,
      remetente_id: remetenteId,
      remetente_tipo: remetenteTipo,
      created_at: agora,
    };

    // Se offline, salvar na fila
    if (!isOnline) {
      console.log("[OfflineOps] Enviando mensagem de chat offline");
      
      try {
        await queueOperation(
          "send_chat_message",
          "chat_mensagens",
          "insert",
          mensagem,
          2 // Prioridade média
        );

        // Salvar localmente para exibição imediata
        const cacheKey = `chat_mensagens_${conversaId}`;
        const mensagensAtuais = await getFromCache<any[]>(cacheKey) || [];
        mensagensAtuais.push({ ...mensagem, pendente: true });
        await saveToCache(cacheKey, mensagensAtuais, 24);

        toast.info("Mensagem será enviada quando houver conexão.");
        return { success: true, id: mensagemId, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao salvar mensagem offline:", error);
        toast.error("Erro ao salvar mensagem");
        return { success: false, offline: true };
      }
    }

    // Se online, inserir direto
    try {
      const { data, error } = await supabase
        .from("chat_mensagens")
        .insert({
          conversa_id: conversaId,
          conteudo,
          remetente_id: remetenteId,
          remetente_tipo: remetenteTipo,
        })
        .select("id")
        .single();

      if (error) throw error;
      return { success: true, id: data.id, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao enviar mensagem:", error);
      
      // Se falhou por rede, tentar offline
      if (!navigator.onLine) {
        return enviarMensagemChat(conversaId, conteudo, remetenteId, remetenteTipo);
      }
      
      toast.error("Erro ao enviar mensagem");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, getFromCache, saveToCache]);

  return {
    // Verificação de status
    isOnline,
    
    // Operações de OS
    updateOSStatus,
    
    // Operações de produção
    registrarProducao,
    
    // Operações de intervalo
    iniciarIntervalo,
    encerrarIntervalo,
    
    // Operações de localização
    atualizarLocalizacao,
    
    // Operações de chat
    enviarMensagemChat,
  };
}

