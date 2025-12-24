import { supabase } from "@/integrations/supabase/client";
import { AcaoLog, ModuloLog, PlataformaLog, registrarLog, UsuarioContexto } from "@/hooks/useLogSistema";

/**
 * Utilitário para registrar logs de forma standalone (fora de componentes React)
 * Útil para chamadas em funções utilitárias, services, etc.
 */

// Cache do usuário atual para evitar múltiplas chamadas
let cachedUser: UsuarioContexto | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minuto

/**
 * Obtém o usuário atual do Supabase Auth
 */
async function getUsuarioAtual(): Promise<UsuarioContexto> {
  const now = Date.now();
  
  // Usar cache se ainda válido
  if (cachedUser && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedUser;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      cachedUser = {
        id: session.user.id,
        nome: session.user.user_metadata?.nome || session.user.email?.split("@")[0] || "Usuário",
        email: session.user.email || undefined
      };
      cacheTimestamp = now;
      return cachedUser;
    }
  } catch (error) {
    console.error("[LogUtils] Erro ao obter usuário:", error);
  }

  return {};
}

/**
 * Limpa o cache do usuário (chamar no logout)
 */
export function limparCacheUsuario() {
  cachedUser = null;
  cacheTimestamp = 0;
}

/**
 * Define manualmente o usuário do cache (útil para app mobile)
 */
export function setUsuarioCache(usuario: UsuarioContexto) {
  cachedUser = usuario;
  cacheTimestamp = Date.now();
}

/**
 * Registra log de criação
 */
export async function logCriar(
  modulo: ModuloLog,
  tabela: string,
  registroId: string,
  dadosNovos?: Record<string, any>,
  detalhes?: string,
  usuario?: UsuarioContexto
) {
  const user = usuario || await getUsuarioAtual();
  return registrarLog({
    acao: "criar",
    modulo,
    tabela,
    registroId,
    dadosNovos,
    detalhes: detalhes || `Criou ${tabela}`
  }, user);
}

/**
 * Registra log de edição
 */
export async function logEditar(
  modulo: ModuloLog,
  tabela: string,
  registroId: string,
  dadosAnteriores?: Record<string, any>,
  dadosNovos?: Record<string, any>,
  detalhes?: string,
  usuario?: UsuarioContexto
) {
  const user = usuario || await getUsuarioAtual();
  return registrarLog({
    acao: "editar",
    modulo,
    tabela,
    registroId,
    dadosAnteriores,
    dadosNovos,
    detalhes: detalhes || `Editou ${tabela}`
  }, user);
}

/**
 * Registra log de exclusão
 */
export async function logExcluir(
  modulo: ModuloLog,
  tabela: string,
  registroId: string,
  dadosAnteriores?: Record<string, any>,
  detalhes?: string,
  usuario?: UsuarioContexto
) {
  const user = usuario || await getUsuarioAtual();
  return registrarLog({
    acao: "excluir",
    modulo,
    tabela,
    registroId,
    dadosAnteriores,
    detalhes: detalhes || `Excluiu ${tabela}`
  }, user);
}

/**
 * Registra log de login
 */
export async function logLogin(
  plataforma: PlataformaLog = "web",
  usuario?: UsuarioContexto,
  detalhes?: string,
  equipeId?: string,
  equipeCodigo?: string
) {
  console.log("[LogUtils] Registrando login:", { plataforma, usuario, detalhes, equipeId, equipeCodigo });
  return registrarLog({
    acao: "login",
    modulo: "auth",
    plataforma,
    detalhes: detalhes || `Login via ${plataforma}`,
    equipeId,
    equipeCodigo
  }, usuario);
}

/**
 * Registra log de logout
 */
export async function logLogout(
  plataforma: PlataformaLog = "web",
  usuario?: UsuarioContexto,
  detalhes?: string
) {
  const user = usuario || await getUsuarioAtual();
  console.log("[LogUtils] Registrando logout:", { plataforma, user, detalhes });
  limparCacheUsuario();
  return registrarLog({
    acao: "logout",
    modulo: "auth",
    plataforma,
    detalhes: detalhes || `Logout via ${plataforma}`
  }, user);
}

/**
 * Registra log de exportação
 */
export async function logExportar(
  modulo: ModuloLog,
  tabela: string,
  quantidadeRegistros: number,
  formato: string = "xlsx",
  usuario?: UsuarioContexto
) {
  const user = usuario || await getUsuarioAtual();
  return registrarLog({
    acao: "exportar",
    modulo,
    tabela,
    detalhes: `Exportou ${quantidadeRegistros} registros de ${tabela} em ${formato.toUpperCase()}`
  }, user);
}

/**
 * Registra log de visualização
 */
export async function logVisualizar(
  modulo: ModuloLog,
  tabela: string,
  registroId: string,
  detalhes?: string,
  usuario?: UsuarioContexto
) {
  const user = usuario || await getUsuarioAtual();
  return registrarLog({
    acao: "visualizar",
    modulo,
    tabela,
    registroId,
    detalhes: detalhes || `Visualizou ${tabela}`
  }, user);
}

/**
 * Registra log de operação no app mobile
 */
export async function logApp(
  acao: AcaoLog,
  modulo: ModuloLog,
  detalhes: string,
  usuario: UsuarioContexto,
  extra?: {
    tabela?: string;
    registroId?: string;
    dadosAnteriores?: Record<string, any>;
    dadosNovos?: Record<string, any>;
    latitude?: number;
    longitude?: number;
    equipeId?: string;
    equipeCodigo?: string;
  }
) {
  console.log("[LogUtils] Registrando log app:", { acao, modulo, detalhes, usuario, extra });
  return registrarLog({
    acao,
    modulo,
    plataforma: "app",
    detalhes,
    ...extra
  }, usuario);
}

/**
 * Wrapper para operações do Supabase com log automático
 */
export const supabaseComLog = {
  /**
   * Insert com log
   */
  async insert<T extends Record<string, any>>(
    tabela: string,
    dados: T,
    modulo: ModuloLog,
    detalhes?: string
  ) {
    const usuario = await getUsuarioAtual();
    
    const { data, error } = await supabase
      .from(tabela)
      .insert(dados)
      .select()
      .single();

    // Registrar log
    await registrarLog({
      acao: "criar",
      modulo,
      tabela,
      registroId: data?.id,
      dadosNovos: dados,
      detalhes: detalhes || `Criou registro em ${tabela}`,
      sucesso: !error,
      erroMensagem: error?.message
    }, usuario);

    return { data, error };
  },

  /**
   * Update com log
   */
  async update<T extends Record<string, any>>(
    tabela: string,
    id: string,
    dados: T,
    modulo: ModuloLog,
    dadosAnteriores?: Record<string, any>,
    detalhes?: string
  ) {
    const usuario = await getUsuarioAtual();

    const { data, error } = await supabase
      .from(tabela)
      .update(dados)
      .eq("id", id)
      .select()
      .single();

    // Registrar log
    await registrarLog({
      acao: "editar",
      modulo,
      tabela,
      registroId: id,
      dadosAnteriores,
      dadosNovos: dados,
      detalhes: detalhes || `Editou registro em ${tabela}`,
      sucesso: !error,
      erroMensagem: error?.message
    }, usuario);

    return { data, error };
  },

  /**
   * Delete com log
   */
  async delete(
    tabela: string,
    id: string,
    modulo: ModuloLog,
    dadosAnteriores?: Record<string, any>,
    detalhes?: string
  ) {
    const usuario = await getUsuarioAtual();

    const { error } = await supabase
      .from(tabela)
      .delete()
      .eq("id", id);

    // Registrar log
    await registrarLog({
      acao: "excluir",
      modulo,
      tabela,
      registroId: id,
      dadosAnteriores,
      detalhes: detalhes || `Excluiu registro de ${tabela}`,
      sucesso: !error,
      erroMensagem: error?.message
    }, usuario);

    return { error };
  }
};
