/**
 * Utilitários para enviar notificações automáticas via chat
 * quando há alterações nas rotas das equipes
 */

import { supabase } from "@/integrations/supabase/client";

interface AlteracaoRota {
  osIncluidas: { numero: string; tipo: string }[];
  osRemovidas: { numero: string; tipo: string }[];
}

/**
 * Verifica se a equipe tem turno em andamento
 */
export async function verificarTurnoAberto(equipeId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("turnos")
      .select("id")
      .eq("equipe_id", equipeId)
      .eq("status", "aberto")
      .limit(1);

    if (error) {
      console.error("[Chat Notificação] Erro ao verificar turno:", error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error("[Chat Notificação] Erro ao verificar turno:", error);
    return false;
  }
}

/**
 * Obtém ou cria uma conversa de chat para a equipe
 */
async function obterOuCriarConversaEquipe(equipeId: string): Promise<string | null> {
  try {
    // Verificar se já existe conversa ativa
    const { data: existentes, error: searchError } = await supabase
      .from("chat_conversas")
      .select("id")
      .eq("equipe_id", equipeId)
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(1);

    if (searchError) {
      console.error("[Chat Notificação] Erro ao buscar conversa:", searchError);
      return null;
    }

    if (existentes && existentes.length > 0) {
      return existentes[0].id;
    }

    // Criar nova conversa
    const { data: nova, error: createError } = await supabase
      .from("chat_conversas")
      .insert({
        tipo: "direto",
        equipe_id: equipeId,
        titulo: "Chat com Torre"
      })
      .select("id")
      .single();

    if (createError) {
      console.error("[Chat Notificação] Erro ao criar conversa:", createError);
      return null;
    }

    return nova.id;
  } catch (error) {
    console.error("[Chat Notificação] Erro ao obter/criar conversa:", error);
    return null;
  }
}

/**
 * Envia uma mensagem de sistema para a equipe
 */
async function enviarMensagemSistema(
  conversaId: string,
  conteudo: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("chat_mensagens")
      .insert({
        conversa_id: conversaId,
        remetente_tipo: "torre",
        remetente_id: null,
        remetente_nome: "🤖 Sistema",
        tipo: "sistema",
        conteudo,
        status: "enviada"
      });

    if (error) {
      console.error("[Chat Notificação] Erro ao enviar mensagem:", error);
      return false;
    }

    console.log("[Chat Notificação] Mensagem enviada com sucesso");
    return true;
  } catch (error) {
    console.error("[Chat Notificação] Erro ao enviar mensagem:", error);
    return false;
  }
}

/**
 * Notifica a equipe sobre alterações na rota via chat
 * Só envia se a equipe tiver turno em andamento
 */
export async function notificarAlteracaoRota(
  equipeId: string,
  equipeCodigo: string,
  alteracoes: AlteracaoRota
): Promise<boolean> {
  try {
    // Verificar se tem turno aberto
    const temTurnoAberto = await verificarTurnoAberto(equipeId);
    
    if (!temTurnoAberto) {
      console.log(`[Chat Notificação] Equipe ${equipeCodigo} não tem turno aberto, não notificar`);
      return false;
    }

    // Verificar se há alterações para notificar
    const { osIncluidas, osRemovidas } = alteracoes;
    
    if (osIncluidas.length === 0 && osRemovidas.length === 0) {
      console.log(`[Chat Notificação] Nenhuma alteração para notificar`);
      return false;
    }

    // Obter ou criar conversa
    const conversaId = await obterOuCriarConversaEquipe(equipeId);
    
    if (!conversaId) {
      console.error("[Chat Notificação] Não foi possível obter conversa");
      return false;
    }

    // Montar mensagem
    let mensagem = `⚠️ ATENÇÃO: ALTERAÇÃO NA SUA ROTA\n\n`;
    mensagem += `📅 ${new Date().toLocaleString('pt-BR')}\n\n`;

    if (osIncluidas.length > 0) {
      mensagem += `✅ OSs INCLUÍDAS (${osIncluidas.length}):\n`;
      osIncluidas.forEach(os => {
        mensagem += `   • ${os.numero} - ${os.tipo}\n`;
      });
      mensagem += `\n`;
    }

    if (osRemovidas.length > 0) {
      mensagem += `❌ OSs REMOVIDAS (${osRemovidas.length}):\n`;
      osRemovidas.forEach(os => {
        mensagem += `   • ${os.numero} - ${os.tipo}\n`;
      });
      mensagem += `\n`;
    }

    mensagem += `💬 Em caso de dúvidas, é só sinalizar, mandar áudio ou ligar!`;

    // Enviar mensagem
    const enviado = await enviarMensagemSistema(conversaId, mensagem);
    
    if (enviado) {
      console.log(`[Chat Notificação] Equipe ${equipeCodigo} notificada sobre alterações na rota`);
    }

    return enviado;
  } catch (error) {
    console.error("[Chat Notificação] Erro ao notificar alteração:", error);
    return false;
  }
}

/**
 * Notifica múltiplas equipes sobre alterações em suas rotas
 */
export async function notificarMultiplasEquipes(
  alteracoesPorEquipe: Map<string, { codigo: string; alteracoes: AlteracaoRota }>
): Promise<{ sucesso: number; falhas: number }> {
  let sucesso = 0;
  let falhas = 0;

  for (const [equipeId, dados] of alteracoesPorEquipe.entries()) {
    const resultado = await notificarAlteracaoRota(equipeId, dados.codigo, dados.alteracoes);
    if (resultado) {
      sucesso++;
    } else {
      falhas++;
    }
  }

  return { sucesso, falhas };
}

/**
 * Verifica e compara rotas para detectar alterações
 * Retorna as OSs que foram incluídas ou removidas
 */
export function detectarAlteracoesRota(
  rotaAnterior: { numero: string; tipo: string }[],
  rotaNova: { numero: string; tipo: string }[]
): AlteracaoRota {
  const numerosAnteriores = new Set(rotaAnterior.map(os => os.numero));
  const numerosNovos = new Set(rotaNova.map(os => os.numero));

  // OSs incluídas (estão na nova, mas não na anterior)
  const osIncluidas = rotaNova.filter(os => !numerosAnteriores.has(os.numero));

  // OSs removidas (estavam na anterior, mas não na nova)
  const osRemovidas = rotaAnterior.filter(os => !numerosNovos.has(os.numero));

  return { osIncluidas, osRemovidas };
}

