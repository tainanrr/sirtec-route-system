import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    nome: string;
    is_admin: boolean;
  } | null;
}

interface WebAuthContextType {
  usuarioWeb: UsuarioWeb | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; usuario?: UsuarioWeb }>;
  signOut: () => void;
  isAuthenticated: boolean;
}

const WebAuthContext = createContext<WebAuthContextType | undefined>(undefined);

const STORAGE_KEY = "usuario_web_session";

export function WebAuthProvider({ children }: { children: ReactNode }) {
  const [usuarioWeb, setUsuarioWeb] = useState<UsuarioWeb | null>(null);
  const [loading, setLoading] = useState(true);

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
                nome,
                is_admin
              )
            `)
            .eq("id", sessionData.id)
            .eq("ativo", true)
            .single();

          if (usuario && !error) {
            setUsuarioWeb({
              ...usuario,
              perfil: usuario.perfis_permissao,
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
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log("[WebAuth] Tentando login com:", email);
      
      // Buscar usuário pelo email
      const { data: usuario, error: fetchError } = await supabase
        .from("usuarios_web")
        .select(`
          *,
          perfis_permissao (
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

      const usuarioLogado: UsuarioWeb = {
        ...usuario,
        perfil: usuario.perfis_permissao,
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

  return (
    <WebAuthContext.Provider
      value={{
        usuarioWeb,
        loading,
        signIn,
        signOut,
        isAuthenticated: !!usuarioWeb,
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
