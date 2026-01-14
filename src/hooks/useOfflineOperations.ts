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
  turno_id?: string;
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
  const { isOnline, queueOperation, saveToCache, getFromCache, resolveLocalId } = useOfflineSyncContext();
  const { updateOrdemLocal, addProducaoLocal, addIntervaloLocal, updateIntervaloLocal } = useOfflineData();

  // ============ OPERAÇÕES DE ORDEM DE SERVIÇO ============

  // Atualizar status de uma OS
  const updateOSStatus = useCallback(async (
    osId: string,
    novoStatus: string,
    equipeId: string,
    dadosAdicionais?: Partial<OrdemServico>,
    numeroOs?: string // Número da OS para exibição no indicador de sincronização offline
  ): Promise<{ success: boolean; offline?: boolean }> => {
    // IMPORTANTE: Resolver ID local para real (caso a OS tenha sido criada offline)
    const osIdResolvido = resolveLocalId(osId);
    
    if (osIdResolvido !== osId) {
      console.log(`[OfflineOps] 🗺️ UpdateOSStatus: ID da OS resolvido de ${osId} para ${osIdResolvido}`);
    }
    
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
      console.log("[OfflineOps] Atualizando OS offline:", osIdResolvido, novoStatus);
      
      try {
        // Enfileirar operação para sincronização
        // Incluir numero_os para exibição no indicador de sincronização (será removido antes de enviar ao banco)
        await queueOperation(
          "update_os_status",
          "ordens_servico",
          "update",
          { id: osIdResolvido, numero_os: numeroOs, ...updateData },
          1 // Alta prioridade
        );

        // Atualizar dados locais
        await updateOrdemLocal(equipeId, osIdResolvido, updateData);

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
        .eq("id", osIdResolvido);

      if (error) throw error;

      // Atualizar dados locais também (cache)
      await updateOrdemLocal(equipeId, osIdResolvido, updateData);

      return { success: true, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao atualizar OS:", error);
      
      // Se falhou por rede, tentar offline
      if (!navigator.onLine) {
        return updateOSStatus(osId, novoStatus, equipeId, dadosAdicionais, numeroOs);
      }
      
      toast.error("Erro ao atualizar ordem de serviço");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, updateOrdemLocal, resolveLocalId]);

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
    turnoId?: string,
    observacao?: string
  ): Promise<{ success: boolean; id?: string; offline?: boolean }> => {
    const agora = new Date().toISOString();
    const dataHoje = format(new Date(), "yyyy-MM-dd");
    const intervaloId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const intervalo: Intervalo = {
      id: intervaloId,
      equipe_id: equipeId,
      turno_id: turnoId,
      tipo_intervalo_id: tipoIntervaloId,
      hora_inicio: agora,
      observacao,
    };

    // Se offline, salvar na fila e localmente
    if (!isOnline) {
      console.log("[OfflineOps] Iniciando intervalo offline com turno_id:", turnoId);
      
      try {
        // Enfileirar para sincronização
        await queueOperation(
          "start_intervalo",
          "intervalos_equipe",
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
        .from("intervalos_equipe")
        .insert({
          equipe_id: equipeId,
          turno_id: turnoId,
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
        return iniciarIntervalo(equipeId, tipoIntervaloId, turnoId, observacao);
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
        // Incluir equipe_id para permitir busca do intervalo caso o ID seja temporário
        await queueOperation(
          "end_intervalo",
          "intervalos_equipe",
          "update",
          { id: intervaloId, hora_fim: agora, equipe_id: equipeId },
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
        .from("intervalos_equipe")
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

  // ============ OPERAÇÕES DE APR/CHECKLIST ============

  // Salvar resposta de APR/Checklist
  const salvarAPR = useCallback(async (
    checklistId: string,
    ordemServicoId: string,
    equipeId: string,
    respostas: any[],
    respostaExistenteId?: string,
    numeroOs?: string // Número da OS para exibição no indicador de sincronização offline
  ): Promise<{ success: boolean; id?: string; offline?: boolean }> => {
    // IMPORTANTE: Resolver ID local para real (caso a OS tenha sido criada offline)
    const ordemServicoIdResolvido = resolveLocalId(ordemServicoId);
    
    if (ordemServicoIdResolvido !== ordemServicoId) {
      console.log(`[OfflineOps] 🗺️ APR: ID da OS resolvido de ${ordemServicoId} para ${ordemServicoIdResolvido}`);
    }
    
    // Para inserts, não incluir ID (banco gera UUID)
    // Para updates, usar o ID existente
    const payload: any = {
      checklist_id: checklistId,
      ordem_servico_id: ordemServicoIdResolvido,
      equipe_id: equipeId,
      respostas: respostas,
      status: 'completo',
      numero_os: numeroOs, // Para exibição no indicador offline (será removido antes de enviar ao banco)
    };

    // Se for update, incluir o ID
    if (respostaExistenteId) {
      payload.id = respostaExistenteId;
    }

    // ID temporário apenas para cache local (não será enviado ao banco)
    const tempId = respostaExistenteId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Se offline, salvar na fila
    if (!isOnline) {
      console.log("[OfflineOps] Salvando APR offline");
      
      try {
        // Enfileirar para sincronização (sem ID para inserts)
        await queueOperation(
          respostaExistenteId ? "update_apr" : "save_apr",
          "checklist_respostas",
          respostaExistenteId ? "update" : "insert",
          payload,
          1 // Alta prioridade
        );

        // Salvar localmente no cache de APRs respondidas (com ID temporário para referência)
        const cacheKey = `apr_resposta_${ordemServicoIdResolvido}`;
        await saveToCache(cacheKey, {
          ...payload,
          id: tempId, // ID temporário apenas para cache
          created_at: new Date().toISOString(),
          pendente_sync: true
        }, 48);

        toast.info("APR salva localmente. Será sincronizada quando houver conexão.");
        return { success: true, id: tempId, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao salvar APR offline:", error);
        toast.error("Erro ao salvar APR offline");
        return { success: false, offline: true };
      }
    }

    // Se online, salvar direto
    try {
      if (respostaExistenteId) {
        const { error } = await supabase
          .from("checklist_respostas")
          .update({
            checklist_id: checklistId,
            ordem_servico_id: ordemServicoIdResolvido,
            equipe_id: equipeId,
            respostas: respostas,
            status: 'completo',
          })
          .eq("id", respostaExistenteId);

        if (error) throw error;
        return { success: true, id: respostaExistenteId, offline: false };
      } else {
        const { data, error } = await supabase
          .from("checklist_respostas")
          .insert({
            checklist_id: checklistId,
            ordem_servico_id: ordemServicoIdResolvido,
            equipe_id: equipeId,
            respostas: respostas,
            status: 'completo',
          })
          .select("id")
          .single();

        if (error) throw error;
        return { success: true, id: data.id, offline: false };
      }
    } catch (error) {
      console.error("[OfflineOps] Erro ao salvar APR:", error);
      
      // Se falhou por rede, tentar offline
      if (!navigator.onLine) {
        return salvarAPR(checklistId, ordemServicoId, equipeId, respostas, respostaExistenteId);
      }
      
      toast.error("Erro ao salvar APR");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, saveToCache, resolveLocalId]);

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

  // ============ OPERAÇÕES DE MATERIAIS ============

  // Aplicar material em OS
  const aplicarMaterialOS = useCallback(async (
    ordemServicoId: string,
    materialId: string,
    quantidade: number,
    equipeId: string,
    numeroSerie?: string
  ): Promise<{ success: boolean; id?: string; offline?: boolean }> => {
    // IMPORTANTE: Resolver ID local para real (caso a OS tenha sido criada offline)
    const ordemServicoIdResolvido = resolveLocalId(ordemServicoId);
    
    if (ordemServicoIdResolvido !== ordemServicoId) {
      console.log(`[OfflineOps] 🗺️ AplicarMaterial: ID da OS resolvido de ${ordemServicoId} para ${ordemServicoIdResolvido}`);
    }
    
    const itemId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const payload = {
      id: itemId,
      ordem_servico_id: ordemServicoIdResolvido,
      material_id: materialId,
      quantidade,
      numero_serie: numeroSerie,
      equipe_id: equipeId,
      created_at: new Date().toISOString(),
    };

    if (!isOnline) {
      console.log("[OfflineOps] Aplicando material offline");
      
      try {
        await queueOperation(
          "aplicar_material_os",
          "ordens_servico_materiais",
          "insert",
          payload,
          2
        );

        // Salvar localmente
        const cacheKey = `materiais_os_${ordemServicoIdResolvido}`;
        const materiaisAtuais = await getFromCache<any[]>(cacheKey) || [];
        materiaisAtuais.push({ ...payload, pendente: true });
        await saveToCache(cacheKey, materiaisAtuais, 24);

        toast.info("Material aplicado localmente. Será sincronizado quando houver conexão.");
        return { success: true, id: itemId, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao aplicar material offline:", error);
        toast.error("Erro ao aplicar material offline");
        return { success: false, offline: true };
      }
    }

    try {
      const { data, error } = await supabase
        .from("ordens_servico_materiais")
        .insert({
          ordem_servico_id: ordemServicoIdResolvido,
          material_id: materialId,
          quantidade,
          numero_serie: numeroSerie,
        })
        .select("id")
        .single();

      if (error) throw error;
      return { success: true, id: data.id, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao aplicar material:", error);
      if (!navigator.onLine) {
        return aplicarMaterialOS(ordemServicoId, materialId, quantidade, equipeId, numeroSerie);
      }
      toast.error("Erro ao aplicar material");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, getFromCache, saveToCache, resolveLocalId]);

  // Remover material de OS
  const removerMaterialOS = useCallback(async (
    itemId: string,
    ordemServicoId: string
  ): Promise<{ success: boolean; offline?: boolean }> => {
    // IMPORTANTE: Resolver ID local para real (caso a OS tenha sido criada offline)
    const ordemServicoIdResolvido = resolveLocalId(ordemServicoId);
    
    if (ordemServicoIdResolvido !== ordemServicoId) {
      console.log(`[OfflineOps] 🗺️ RemoverMaterial: ID da OS resolvido de ${ordemServicoId} para ${ordemServicoIdResolvido}`);
    }
    
    if (!isOnline) {
      console.log("[OfflineOps] Removendo material offline:", itemId);
      
      try {
        await queueOperation(
          "remover_material_os",
          "ordens_servico_materiais",
          "delete",
          { id: itemId },
          2
        );

        // Atualizar cache local
        const cacheKey = `materiais_os_${ordemServicoIdResolvido}`;
        const materiaisAtuais = await getFromCache<any[]>(cacheKey) || [];
        const materiaisAtualizados = materiaisAtuais.filter(m => m.id !== itemId);
        await saveToCache(cacheKey, materiaisAtualizados, 24);

        toast.info("Material removido localmente. Será sincronizado quando houver conexão.");
        return { success: true, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao remover material offline:", error);
        toast.error("Erro ao remover material offline");
        return { success: false, offline: true };
      }
    }

    try {
      const { error } = await supabase
        .from("ordens_servico_materiais")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      return { success: true, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao remover material:", error);
      if (!navigator.onLine) {
        return removerMaterialOS(itemId, ordemServicoId);
      }
      toast.error("Erro ao remover material");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, getFromCache, saveToCache, resolveLocalId]);

  // ============ OPERAÇÕES DE DEVOLUÇÃO ============

  // Criar solicitação de devolução
  const criarDevolucao = useCallback(async (
    equipeId: string,
    itens: { material_id: string; quantidade: number; numero_serie?: string }[],
    observacao?: string
  ): Promise<{ success: boolean; id?: string; offline?: boolean }> => {
    const devolucaoId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const payload = {
      id: devolucaoId,
      equipe_id: equipeId,
      status: "pendente",
      observacao,
      created_at: new Date().toISOString(),
      itens,
    };

    if (!isOnline) {
      console.log("[OfflineOps] Criando devolução offline");
      
      try {
        await queueOperation(
          "criar_devolucao",
          "materiais_devolucoes",
          "insert",
          payload,
          2
        );

        // Salvar localmente
        const cacheKey = `devolucoes_${equipeId}`;
        const devolucoesAtuais = await getFromCache<any[]>(cacheKey) || [];
        devolucoesAtuais.push({ ...payload, pendente: true });
        await saveToCache(cacheKey, devolucoesAtuais, 24);

        toast.info("Devolução criada localmente. Será sincronizada quando houver conexão.");
        return { success: true, id: devolucaoId, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao criar devolução offline:", error);
        toast.error("Erro ao criar devolução offline");
        return { success: false, offline: true };
      }
    }

    try {
      // Criar devolução
      const { data: devolucao, error: devolucaoError } = await supabase
        .from("materiais_devolucoes")
        .insert({
          equipe_id: equipeId,
          status: "pendente",
          observacao,
        })
        .select("id")
        .single();

      if (devolucaoError) throw devolucaoError;

      // Criar itens da devolução
      const itensPayload = itens.map(item => ({
        devolucao_id: devolucao.id,
        material_id: item.material_id,
        quantidade: item.quantidade,
        numero_serie: item.numero_serie,
      }));

      const { error: itensError } = await supabase
        .from("materiais_devolucoes_itens")
        .insert(itensPayload);

      if (itensError) throw itensError;

      return { success: true, id: devolucao.id, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao criar devolução:", error);
      if (!navigator.onLine) {
        return criarDevolucao(equipeId, itens, observacao);
      }
      toast.error("Erro ao criar devolução");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, getFromCache, saveToCache]);

  // Confirmar recebimento de materiais
  const confirmarRecebimento = useCallback(async (
    entregaId: string,
    equipeId: string,
    checklistRespostas?: any[]
  ): Promise<{ success: boolean; offline?: boolean }> => {
    const payload = {
      id: entregaId,
      status: "confirmado",
      data_confirmacao: new Date().toISOString(),
      checklist_respostas: checklistRespostas,
    };

    if (!isOnline) {
      console.log("[OfflineOps] Confirmando recebimento offline:", entregaId);
      
      try {
        await queueOperation(
          "confirmar_recebimento",
          "materiais_entregas",
          "update",
          payload,
          2
        );

        // Atualizar cache local
        const cacheKey = `entregas_pendentes_${equipeId}`;
        const entregasAtuais = await getFromCache<any[]>(cacheKey) || [];
        const entregasAtualizadas = entregasAtuais.filter(e => e.id !== entregaId);
        await saveToCache(cacheKey, entregasAtualizadas, 24);

        toast.info("Recebimento confirmado localmente. Será sincronizado quando houver conexão.");
        return { success: true, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao confirmar recebimento offline:", error);
        toast.error("Erro ao confirmar recebimento offline");
        return { success: false, offline: true };
      }
    }

    try {
      const { error } = await supabase
        .from("materiais_entregas")
        .update({
          status: "confirmado",
          data_confirmacao: new Date().toISOString(),
        })
        .eq("id", entregaId);

      if (error) throw error;
      return { success: true, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao confirmar recebimento:", error);
      if (!navigator.onLine) {
        return confirmarRecebimento(entregaId, equipeId, checklistRespostas);
      }
      toast.error("Erro ao confirmar recebimento");
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation, getFromCache, saveToCache]);

  // ============ OPERAÇÕES DE EVENTOS DO TURNO ============

  // Registrar evento do turno manualmente
  const registrarEventoTurno = useCallback(async (
    turnoId: string,
    equipeId: string,
    tipoEvento: string,
    ordemServicoId?: string,
    descricao?: string,
    metadata?: Record<string, any>,
    latitude?: number,
    longitude?: number
  ): Promise<{ success: boolean; id?: string; offline?: boolean }> => {
    const agora = new Date().toISOString();
    const eventoId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const evento = {
      id: eventoId,
      turno_id: turnoId,
      equipe_id: equipeId,
      tipo_evento: tipoEvento,
      ordem_servico_id: ordemServicoId || null,
      descricao: descricao || null,
      metadata: metadata || {},
      latitude: latitude || null,
      longitude: longitude || null,
      data_hora: agora,
    };

    // Se offline, salvar na fila
    if (!isOnline) {
      console.log("[OfflineOps] Registrando evento offline:", tipoEvento);
      
      try {
        await queueOperation(
          "create_evento_turno" as OperationType,
          "turno_eventos",
          "insert",
          evento,
          2 // Prioridade média
        );

        return { success: true, id: eventoId, offline: true };
      } catch (error) {
        console.error("[OfflineOps] Erro ao registrar evento offline:", error);
        return { success: false, offline: true };
      }
    }

    // Se online, inserir direto
    try {
      const { data, error } = await supabase
        .from("turno_eventos")
        .insert({
          turno_id: turnoId,
          equipe_id: equipeId,
          tipo_evento: tipoEvento,
          ordem_servico_id: ordemServicoId || null,
          descricao: descricao || null,
          metadata: metadata || {},
          latitude: latitude || null,
          longitude: longitude || null,
          data_hora: agora,
        })
        .select("id")
        .single();

      if (error) throw error;

      return { success: true, id: data.id, offline: false };
    } catch (error) {
      console.error("[OfflineOps] Erro ao registrar evento:", error);
      
      // Se falhou por rede, tentar offline
      if (!navigator.onLine) {
        return registrarEventoTurno(turnoId, equipeId, tipoEvento, ordemServicoId, descricao, metadata, latitude, longitude);
      }
      
      return { success: false, offline: false };
    }
  }, [isOnline, queueOperation]);

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
    
    // Operações de APR/Checklist
    salvarAPR,
    
    // Operações de materiais
    aplicarMaterialOS,
    removerMaterialOS,
    
    // Operações de devolução
    criarDevolucao,
    confirmarRecebimento,
    
    // Operações de eventos do turno
    registrarEventoTurno,
  };
}

