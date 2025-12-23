import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Permissao {
  codigo: string;
  nome: string;
  modulo: string;
}

// Permissões no novo formato JSON
interface PermissaoJson {
  editar: boolean;
  consultar: boolean;
}

interface UsuarioWeb {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  departamento: string | null;
  centro_custo: string | null;
  perfil_id: string | null;
  ativo: boolean;
  ultimo_acesso: string | null;
  perfil?: {
    id: string;
    nome: string;
    is_admin: boolean;
    permissoes_json?: Record<string, PermissaoJson>;
  } | null;
  permissoes?: Permissao[];
  permissoesJson?: Record<string, PermissaoJson>;
}

interface WebAuthContextType {
  usuarioWeb: UsuarioWeb | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; usuario?: UsuarioWeb }>;
  signOut: () => void;
  refreshPermissoes: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasPermission: (codigo: string) => boolean;
  hasAnyPermission: (codigos: string[]) => boolean;
  hasModuleAccess: (modulo: string) => boolean;
}

const WebAuthContext = createContext<WebAuthContextType | undefined>(undefined);

const STORAGE_KEY = "usuario_web_session";

export function WebAuthProvider({ children }: { children: ReactNode }) {
  const [usuarioWeb, setUsuarioWeb] = useState<UsuarioWeb | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar permissões do perfil
  const loadPermissoes = useCallback(async (perfilId: string): Promise<Permissao[]> => {
    try {
      console.log("[WebAuth] ========================================");
      console.log("[WebAuth] Carregando permissões para perfil_id:", perfilId);
      
      // Primeiro, vamos ver se o perfil existe e qual é o nome
      const { data: perfilInfo, error: perfilError } = await supabase
        .from("perfis_permissao")
        .select("id, nome, is_admin")
        .eq("id", perfilId)
        .single();
      
      console.log("[WebAuth] Info do perfil:", perfilInfo, "Erro:", perfilError);
      
      // Agora buscar as permissões vinculadas
      const { data, error } = await supabase
        .from("perfil_permissoes")
        .select(`
          id,
          perfil_id,
          permissao_id,
          permissoes (
            id,
            codigo,
            nome,
            modulo
          )
        `)
        .eq("perfil_id", perfilId);

      console.log("[WebAuth] Query perfil_permissoes - Data:", data, "Error:", error);

      if (error) {
        console.error("[WebAuth] Erro ao carregar permissões:", error);
        return [];
      }

      if (!data || data.length === 0) {
        console.warn("[WebAuth] ATENÇÃO: Nenhuma permissão encontrada para este perfil!");
        console.warn("[WebAuth] Verifique se existem registros em perfil_permissoes para perfil_id:", perfilId);
        return [];
      }

      // Extrair permissões do resultado
      const permissoes: Permissao[] = [];
      data?.forEach((item: any) => {
        console.log("[WebAuth] Item do perfil_permissoes:", item);
        if (item.permissoes) {
          permissoes.push(item.permissoes);
        }
      });

      console.log("[WebAuth] Permissões extraídas:", permissoes.map(p => p.codigo));
      console.log("[WebAuth] ========================================");
      return permissoes;
    } catch (err) {
      console.error("[WebAuth] Erro ao carregar permissões:", err);
      return [];
    }
  }, []);

  // Função para recarregar permissões do usuário atual
  const refreshPermissoes = useCallback(async () => {
    if (!usuarioWeb?.perfil_id) {
      console.log("[WebAuth] Sem perfil_id para recarregar permissões");
      return;
    }

    console.log("[WebAuth] Recarregando permissões...");
    
    // Recarregar perfil do banco para obter permissoes_json atualizado
    const { data: perfilAtualizado, error: perfilError } = await supabase
      .from("perfis_permissao")
      .select("id, nome, is_admin, permissoes_json")
      .eq("id", usuarioWeb.perfil_id)
      .single();
    
    if (perfilError) {
      console.error("[WebAuth] Erro ao recarregar perfil:", perfilError);
      return;
    }
    
    const permissoesJson = (perfilAtualizado as any)?.permissoes_json || {};
    console.log("[WebAuth] permissoesJson recarregado:", JSON.stringify(permissoesJson));
    
    // Também recarregar permissões do formato antigo
    let permissoes: Permissao[] = [];
    if (!perfilAtualizado?.is_admin) {
      permissoes = await loadPermissoes(usuarioWeb.perfil_id);
    }
    
    setUsuarioWeb(prev => prev ? {
      ...prev,
      perfil: perfilAtualizado,
      permissoes,
      permissoesJson,
    } : null);
    
    toast.success("Permissões atualizadas!", { duration: 2000 });
  }, [usuarioWeb?.perfil_id, loadPermissoes]);

  // Carregar sessão do localStorage ao iniciar
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedSession = localStorage.getItem(STORAGE_KEY);
        if (storedSession) {
          const sessionData = JSON.parse(storedSession);
          // Verificar se a sessão ainda é válida (buscar o usuário no banco)
          const { data: usuario, error } = await supabase
            .from("usuarios_web")
            .select(`
              *,
              perfis_permissao (
                id,
                nome,
                is_admin,
                permissoes_json
              )
            `)
            .eq("id", sessionData.id)
            .eq("ativo", true)
            .single();

          if (usuario && !error) {
            // SEMPRE carregar permissões do banco (não usar cache)
            let permissoes: Permissao[] = [];
            if (usuario.perfil_id && !usuario.perfis_permissao?.is_admin) {
              permissoes = await loadPermissoes(usuario.perfil_id);
            }

            // Extrair permissões JSON do perfil
            const permissoesJson = (usuario.perfis_permissao as any)?.permissoes_json || {};

            setUsuarioWeb({
              ...usuario,
              perfil: usuario.perfis_permissao,
              permissoes,
              permissoesJson,
            });
          } else {
            // Sessão inválida, limpar
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error("[WebAuth] Erro ao carregar sessão:", err);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [loadPermissoes]);

  // Recarregar permissões quando a janela ganha foco (útil para quando admin altera permissões)
  useEffect(() => {
    const handleFocus = () => {
      if (usuarioWeb?.perfil_id && !usuarioWeb.perfil?.is_admin) {
        console.log("[WebAuth] Janela ganhou foco, recarregando permissões...");
        refreshPermissoes();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [usuarioWeb?.perfil_id, usuarioWeb?.perfil?.is_admin, refreshPermissoes]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log("[WebAuth] Tentando login com:", email);
      
      // Buscar usuário pelo email
      const { data: usuario, error: fetchError } = await supabase
        .from("usuarios_web")
        .select(`
          *,
          perfis_permissao (
            id,
            nome,
            is_admin,
            permissoes_json
          )
        `)
        .eq("email", email.toLowerCase().trim())
        .single();

      if (fetchError || !usuario) {
        console.log("[WebAuth] Usuário não encontrado:", fetchError);
        return { error: new Error("Email ou senha incorretos") };
      }

      // Verificar se o usuário está ativo
      if (!usuario.ativo) {
        console.log("[WebAuth] Usuário inativo");
        return { error: new Error("Usuário inativo. Entre em contato com o administrador.") };
      }

      // Verificar senha (comparação simples - em produção usaria hash)
      if (usuario.senha_hash !== password) {
        console.log("[WebAuth] Senha incorreta");
        return { error: new Error("Email ou senha incorretos") };
      }

      console.log("[WebAuth] Login bem-sucedido:", usuario.nome);

      // Atualizar último acesso
      await supabase
        .from("usuarios_web")
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq("id", usuario.id);

      // Carregar permissões se tiver perfil e não for admin
      let permissoes: Permissao[] = [];
      if (usuario.perfil_id && !usuario.perfis_permissao?.is_admin) {
        permissoes = await loadPermissoes(usuario.perfil_id);
      }

      // Extrair permissões JSON do perfil
      const permissoesJson = (usuario.perfis_permissao as any)?.permissoes_json || {};
      console.log("[WebAuth] Login - permissoesJson carregado:", JSON.stringify(permissoesJson));

      const usuarioLogado: UsuarioWeb = {
        ...usuario,
        perfil: usuario.perfis_permissao,
        permissoes,
        permissoesJson,
      };

      // Salvar sessão no localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: usuario.id }));
      
      setUsuarioWeb(usuarioLogado);

      return { error: null, usuario: usuarioLogado };
    } catch (err: any) {
      console.error("[WebAuth] Erro no login:", err);
      return { error: new Error("Erro ao realizar login. Tente novamente.") };
    }
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUsuarioWeb(null);
  };

  // Verificar se é admin
  const isAdmin = useMemo(() => {
    return usuarioWeb?.perfil?.is_admin === true;
  }, [usuarioWeb]);

  // Mapeamento de códigos antigos para IDs de tela no novo formato
  const mapCodigoParaTela = useCallback((codigo: string): string => {
    // Mapear códigos no formato antigo (cadastros.equipes) para novo (equipes)
    const mapeamento: Record<string, string> = {
      // Cadastros
      "cadastros.equipes": "equipes",
      "cadastros.skills": "skills",
      "cadastros.territorios": "territorios",
      "cadastros.coordenadores": "coordenadores",
      "cadastros.veiculos": "veiculos",
      "cadastros.metas": "metas",
      // Admin
      "admin.contratos": "contratos",
      "admin.usuarios_web": "usuarios_web",
      "admin.usuarios_app": "usuarios_app",
      "admin.permissoes": "permissoes",
      "admin.cadastros_base": "cadastros_base",
      "admin.procedimentos": "procedimentos",
      "admin.checklists": "checklists",
      "admin.logs": "logs",
      // Roteirização
      "roteirizacao.torre_controle": "torre_controle",
      "roteirizacao.visualizar": "roteirizacao",
      "roteirizacao.acompanhar": "acompanhamento_rotas",
      // OS
      "os.visualizar": "ordens_servico",
      "os.checklists": "checklists",
    };
    return mapeamento[codigo] || codigo;
  }, []);

  // Verificar se tem permissão específica
  const hasPermission = useCallback((codigo: string): boolean => {
    // Admin tem todas as permissões
    if (usuarioWeb?.perfil?.is_admin) return true;
    
    // PRIORIDADE: Verificar primeiro no formato JSON (novo)
    const telaId = mapCodigoParaTela(codigo);
    const permJson = usuarioWeb?.permissoesJson?.[telaId];
    if (permJson) {
      // Se tem consultar ou editar, tem acesso
      const temAcesso = permJson.consultar === true || permJson.editar === true;
      console.log(`[WebAuth] hasPermission("${codigo}") -> tela "${telaId}" = ${temAcesso}`);
      return temAcesso;
    }

    // Fallback: verificar no formato antigo (para compatibilidade)
    const hasOld = usuarioWeb?.permissoes?.some(p => p.codigo === codigo) ?? false;
    if (hasOld) {
      console.log(`[WebAuth] hasPermission("${codigo}") -> formato antigo = true`);
      return true;
    }

    console.log(`[WebAuth] hasPermission("${codigo}") -> NÃO TEM ACESSO`);
    return false;
  }, [usuarioWeb?.perfil?.is_admin, usuarioWeb?.permissoes, usuarioWeb?.permissoesJson, mapCodigoParaTela]);

  // Verificar se tem alguma das permissões
  const hasAnyPermission = useCallback((codigos: string[]): boolean => {
    // Admin tem todas as permissões
    if (usuarioWeb?.perfil?.is_admin) return true;
    
    return codigos.some(codigo => hasPermission(codigo));
  }, [usuarioWeb?.perfil?.is_admin, hasPermission]);

  // Verificar se tem acesso a um módulo
  const hasModuleAccess = useCallback((modulo: string): boolean => {
    // Admin tem acesso a tudo
    if (usuarioWeb?.perfil?.is_admin) return true;
    
    // Verificar no formato antigo
    const hasOld = usuarioWeb?.permissoes?.some(p => p.modulo === modulo) ?? false;
    if (hasOld) return true;

    // Verificar no novo formato JSON - procurar qualquer tela do módulo com acesso
    const telasDoModulo: Record<string, string[]> = {
      "materiais": ["materiais_dashboard", "catalogo_materiais", "estoque_central", "movimentacoes", "recebimentos", "entregas_equipes", "devolucoes", "aplicacoes_os", "rastreabilidade"],
      "cadastros": ["equipes", "colaboradores", "coordenadores", "skills", "veiculos", "territorios", "pontos_saida", "poligonos", "checklists", "metas"],
      "admin": ["usuarios_web", "usuarios_app", "contratos", "permissoes", "cadastros_base", "procedimentos", "logs"],
      "relatorios": ["relatorios_produtividade", "relatorios_materiais", "relatorios_financeiro", "relatorios_kpis"],
    };

    const telas = telasDoModulo[modulo] || [];
    return telas.some(telaId => {
      const permJson = usuarioWeb?.permissoesJson?.[telaId];
      return permJson?.consultar === true || permJson?.editar === true;
    });
  }, [usuarioWeb?.perfil?.is_admin, usuarioWeb?.permissoes, usuarioWeb?.permissoesJson]);

  return (
    <WebAuthContext.Provider
      value={{
        usuarioWeb,
        loading,
        signIn,
        signOut,
        refreshPermissoes,
        isAuthenticated: !!usuarioWeb,
        isAdmin,
        hasPermission,
        hasAnyPermission,
        hasModuleAccess,
      }}
    >
      {children}
    </WebAuthContext.Provider>
  );
}

export function useWebAuth() {
  const context = useContext(WebAuthContext);
  if (context === undefined) {
    throw new Error("useWebAuth must be used within a WebAuthProvider");
  }
  return context;
}

