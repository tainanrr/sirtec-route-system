import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWebAuth } from "@/contexts/WebAuthContext";

// Tipos de ação disponíveis
export type AcaoLog = 
  | "criar" 
  | "editar" 
  | "excluir" 
  | "login" 
  | "logout" 
  | "visualizar" 
  | "exportar" 
  | "importar"
  | "abrir_turno"
  | "fechar_turno"
  | "executar"
  | "aprovar"
  | "rejeitar"
  | "sincronizar";

// Módulos do sistema
export type ModuloLog = 
  | "admin"
  | "cadastros"
  | "roteirizacao"
  | "materiais"
  | "ordens"
  | "app"
  | "auth"
  | "checklists"
  | "procedimentos"
  | "turnos"
  | "equipes"
  | "colaboradores"
  | "dashboard"
  | "relatorios";

// Plataformas
export type PlataformaLog = "web" | "app" | "api";

// Interface para dados do log
export interface DadosLog {
  acao: AcaoLog;
  modulo: ModuloLog;
  tabela?: string;
  registroId?: string;
  dadosAnteriores?: Record<string, any>;
  dadosNovos?: Record<string, any>;
  detalhes?: string;
  plataforma?: PlataformaLog;
  latitude?: number;
  longitude?: number;
  sucesso?: boolean;
  erroMensagem?: string;
  // Dados da equipe (para app)
  equipeId?: string;
  equipeCodigo?: string;
}

// Interface para contexto do usuário (usado no app)
export interface UsuarioContexto {
  id?: string;
  nome?: string;
  email?: string;
  equipeId?: string;
  equipeCodigo?: string;
}

/**
 * Obtém informações do dispositivo/navegador
 */
function getDeviceInfo(): { userAgent: string; plataforma: PlataformaLog } {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  
  // Detectar se é app mobile
  const isApp = userAgent.toLowerCase().includes("mobile") || 
                userAgent.toLowerCase().includes("android") ||
                userAgent.toLowerCase().includes("iphone");
  
  return {
    userAgent,
    plataforma: isApp ? "app" : "web"
  };
}

/**
 * Função standalone para registrar log (pode ser usada sem hook)
 * IMPORTANTE: Esta função NUNCA lança exceção - sempre falha silenciosamente
 */
export async function registrarLog(
  dados: DadosLog,
  usuario?: UsuarioContexto
): Promise<string | null> {
  const startTime = Date.now();
  
  try {
    const deviceInfo = getDeviceInfo();
    const duracao = Date.now() - startTime;

    console.log("[LOG] Registrando log:", {
      acao: dados.acao,
      modulo: dados.modulo,
      tabela: dados.tabela,
      usuario: usuario?.nome,
      detalhes: dados.detalhes
    });

    // Inserção direta na tabela (sem RPC)
    const { data, error } = await supabase
      .from("logs_sistema")
      .insert({
        usuario_id: usuario?.id || null,
        usuario_nome: usuario?.nome || null,
        usuario_email: usuario?.email || null,
        equipe_id: dados.equipeId || usuario?.equipeId || null,
        equipe_codigo: dados.equipeCodigo || usuario?.equipeCodigo || null,
        acao: dados.acao,
        modulo: dados.modulo,
        tabela: dados.tabela || null,
        registro_id: dados.registroId || null,
        dados_anteriores: dados.dadosAnteriores || null,
        dados_novos: dados.dadosNovos || null,
        detalhes: dados.detalhes || null,
        user_agent: deviceInfo.userAgent.substring(0, 500), // Limitar tamanho
        plataforma: dados.plataforma || deviceInfo.plataforma,
        latitude: dados.latitude || null,
        longitude: dados.longitude || null,
        duracao_ms: duracao,
        sucesso: dados.sucesso !== false,
        erro_mensagem: dados.erroMensagem || null
      })
      .select("id")
      .single();

    if (error) {
      console.error("[LOG] Erro ao registrar log:", error.message, error);
      return null;
    }

    console.log("[LOG] Log registrado com sucesso:", data?.id);
    return data?.id || null;
  } catch (err: any) {
    console.error("[LOG] Exceção ao registrar log:", err.message);
    return null;
  }
}

/**
 * Hook para registrar logs de forma fácil em componentes React
 */
export function useLogSistema() {
  const { usuarioWeb } = useWebAuth();
  const pendingLogs = useRef<Promise<any>[]>([]);

  // Dados do usuário logado
  const getUsuarioAtual = useCallback((): UsuarioContexto => {
    if (!usuarioWeb) return {};
    
    return {
      id: usuarioWeb.id,
      nome: usuarioWeb.nome || usuarioWeb.email?.split("@")[0] || "Usuário",
      email: usuarioWeb.email || undefined
    };
  }, [usuarioWeb]);

  /**
   * Registra um log no sistema
   */
  const log = useCallback(async (dados: DadosLog): Promise<string | null> => {
    const usuario = getUsuarioAtual();
    const logPromise = registrarLog(dados, usuario);
    
    // Manter referência para aguardar se necessário
    pendingLogs.current.push(logPromise);
    
    const result = await logPromise;
    
    // Remover da lista de pendentes
    pendingLogs.current = pendingLogs.current.filter(p => p !== logPromise);
    
    return result;
  }, [getUsuarioAtual]);

  /**
   * Log de criação de registro
   */
  const logCriar = useCallback((
    modulo: ModuloLog,
    tabela: string,
    registroId: string,
    dadosNovos?: Record<string, any>,
    detalhes?: string
  ) => {
    return log({
      acao: "criar",
      modulo,
      tabela,
      registroId,
      dadosNovos,
      detalhes: detalhes || `Criou registro em ${tabela}`
    });
  }, [log]);

  /**
   * Log de edição de registro
   */
  const logEditar = useCallback((
    modulo: ModuloLog,
    tabela: string,
    registroId: string,
    dadosAnteriores?: Record<string, any>,
    dadosNovos?: Record<string, any>,
    detalhes?: string
  ) => {
    return log({
      acao: "editar",
      modulo,
      tabela,
      registroId,
      dadosAnteriores,
      dadosNovos,
      detalhes: detalhes || `Editou registro em ${tabela}`
    });
  }, [log]);

  /**
   * Log de exclusão de registro
   */
  const logExcluir = useCallback((
    modulo: ModuloLog,
    tabela: string,
    registroId: string,
    dadosAnteriores?: Record<string, any>,
    detalhes?: string
  ) => {
    return log({
      acao: "excluir",
      modulo,
      tabela,
      registroId,
      dadosAnteriores,
      detalhes: detalhes || `Excluiu registro de ${tabela}`
    });
  }, [log]);

  /**
   * Log de login
   */
  const logLogin = useCallback((
    plataforma: PlataformaLog = "web",
    detalhes?: string,
    equipeId?: string,
    equipeCodigo?: string
  ) => {
    return log({
      acao: "login",
      modulo: "auth",
      plataforma,
      detalhes: detalhes || "Login realizado",
      equipeId,
      equipeCodigo
    });
  }, [log]);

  /**
   * Log de logout
   */
  const logLogout = useCallback((
    plataforma: PlataformaLog = "web",
    detalhes?: string
  ) => {
    return log({
      acao: "logout",
      modulo: "auth",
      plataforma,
      detalhes: detalhes || "Logout realizado"
    });
  }, [log]);

  /**
   * Log de erro
   */
  const logErro = useCallback((
    modulo: ModuloLog,
    acao: AcaoLog,
    erroMensagem: string,
    detalhes?: string,
    tabela?: string,
    registroId?: string
  ) => {
    return log({
      acao,
      modulo,
      tabela,
      registroId,
      sucesso: false,
      erroMensagem,
      detalhes: detalhes || `Erro: ${erroMensagem}`
    });
  }, [log]);

  /**
   * Aguarda todos os logs pendentes serem enviados
   */
  const aguardarPendentes = useCallback(async () => {
    await Promise.all(pendingLogs.current);
  }, []);

  return {
    log,
    logCriar,
    logEditar,
    logExcluir,
    logLogin,
    logLogout,
    logErro,
    aguardarPendentes,
    getUsuarioAtual
  };
}

/**
 * Hook simplificado para uso no App Mobile
 */
export function useLogApp() {
  const pendingLogs = useRef<Promise<any>[]>([]);

  /**
   * Registra um log no app mobile
   */
  const log = useCallback(async (
    dados: DadosLog,
    usuario: UsuarioContexto
  ): Promise<string | null> => {
    const logPromise = registrarLog(
      { ...dados, plataforma: "app" },
      usuario
    );
    
    pendingLogs.current.push(logPromise);
    const result = await logPromise;
    pendingLogs.current = pendingLogs.current.filter(p => p !== logPromise);
    
    return result;
  }, []);

  return { log };
}

export default useLogSistema;
