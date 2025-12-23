import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Permissao {
  codigo: string;
  nome: string;
  modulo: string;
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
  } | null;
  permissoes?: Permissao[];
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

    // Se for admin, não precisa carregar permissões específicas
    if (usuarioWeb.perfil?.is_admin) {
      console.log("[WebAuth] Usuário é admin, não precisa recarregar permissões");
      return;
    }

    console.log("[WebAuth] Recarregando permissões...");
    const permissoes = await loadPermissoes(usuarioWeb.perfil_id);
    
    setUsuarioWeb(prev => prev ? {
      ...prev,
      permissoes,
    } : null);
  }, [usuarioWeb?.perfil_id, usuarioWeb?.perfil?.is_admin, loadPermissoes]);

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
                is_admin
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

            setUsuarioWeb({
              ...usuario,
              perfil: usuario.perfis_permissao,
              permissoes,
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
            is_admin
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

      const usuarioLogado: UsuarioWeb = {
        ...usuario,
        perfil: usuario.perfis_permissao,
        permissoes,
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

  // Verificar se tem permissão específica
  const hasPermission = useCallback((codigo: string): boolean => {
    // Admin tem todas as permissões
    if (usuarioWeb?.perfil?.is_admin) return true;
    
    // Verificar nas permissões do usuário
    const has = usuarioWeb?.permissoes?.some(p => p.codigo === codigo) ?? false;
    return has;
  }, [usuarioWeb?.perfil?.is_admin, usuarioWeb?.permissoes]);

  // Verificar se tem alguma das permissões
  const hasAnyPermission = useCallback((codigos: string[]): boolean => {
    // Admin tem todas as permissões
    if (usuarioWeb?.perfil?.is_admin) return true;
    
    return codigos.some(codigo => 
      usuarioWeb?.permissoes?.some(p => p.codigo === codigo) ?? false
    );
  }, [usuarioWeb?.perfil?.is_admin, usuarioWeb?.permissoes]);

  // Verificar se tem acesso a um módulo
  const hasModuleAccess = useCallback((modulo: string): boolean => {
    // Admin tem acesso a tudo
    if (usuarioWeb?.perfil?.is_admin) return true;
    
    // Verificar se tem alguma permissão do módulo
    const has = usuarioWeb?.permissoes?.some(p => p.modulo === modulo) ?? false;
    return has;
  }, [usuarioWeb?.perfil?.is_admin, usuarioWeb?.permissoes]);

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

