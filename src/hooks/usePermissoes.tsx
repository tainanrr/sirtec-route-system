import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "usuario_web_session";

interface Permissao {
  editar: boolean;
  consultar: boolean;
}

interface PermissoesContextType {
  permissoes: Record<string, Permissao>;
  isAdmin: boolean;
  loading: boolean;
  podeEditar: (telaId: string) => boolean;
  podeConsultar: (telaId: string) => boolean;
  recarregar: () => Promise<void>;
}

const PermissoesContext = createContext<PermissoesContextType | null>(null);

export function PermissoesProvider({ children }: { children: ReactNode }) {
  const [permissoes, setPermissoes] = useState<Record<string, Permissao>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const carregarPermissoes = useCallback(async () => {
    try {
      setLoading(true);
      
      // Buscar sessão do localStorage
      const sessionStr = localStorage.getItem(STORAGE_KEY);
      if (!sessionStr) {
        console.log("[Permissoes] Nenhuma sessão encontrada");
        setPermissoes({});
        setIsAdmin(false);
        return;
      }

      const session = JSON.parse(sessionStr);
      const usuarioId = session.id;
      
      console.log("[Permissoes] Sessão encontrada, buscando usuário ID:", usuarioId);

      if (!usuarioId) {
        console.log("[Permissoes] ID do usuário não encontrado na sessão");
        setPermissoes({});
        setIsAdmin(false);
        return;
      }

      // Buscar usuário do banco de dados
      const { data: usuario, error: usuarioError } = await supabase
        .from("usuarios_web")
        .select(`
          id,
          nome,
          email,
          perfil_id,
          perfis_permissao (
            id,
            nome,
            is_admin,
            permissoes_json
          )
        `)
        .eq("id", usuarioId)
        .single();

      if (usuarioError || !usuario) {
        console.error("[Permissoes] Erro ao buscar usuário:", usuarioError);
        setPermissoes({});
        setIsAdmin(false);
        return;
      }

      console.log("[Permissoes] Usuário encontrado:", usuario.nome, usuario.email);
      console.log("[Permissoes] Perfil:", usuario.perfis_permissao?.nome);

      if (!usuario.perfil_id || !usuario.perfis_permissao) {
        console.log("[Permissoes] Usuário sem perfil definido");
        setPermissoes({});
        setIsAdmin(false);
        return;
      }

      const perfil = usuario.perfis_permissao as any;
      const permissoesJson = perfil.permissoes_json || {};
      
      console.log("[Permissoes] Perfil carregado:", perfil.nome, "Admin:", perfil.is_admin);
      console.log("[Permissoes] Permissões do perfil:", JSON.stringify(permissoesJson));
      
      setIsAdmin(perfil.is_admin || false);
      setPermissoes(permissoesJson);
    } catch (error) {
      console.error("[Permissoes] Erro:", error);
      setPermissoes({});
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarPermissoes();
  }, [carregarPermissoes]);

  // Verificar se pode editar uma tela
  const podeEditar = useCallback((telaId: string): boolean => {
    // Admin tem acesso total
    if (isAdmin) return true;
    
    const perm = permissoes[telaId];
    return perm?.editar === true;
  }, [isAdmin, permissoes]);

  // Verificar se pode consultar uma tela
  const podeConsultar = useCallback((telaId: string): boolean => {
    // Admin tem acesso total
    if (isAdmin) return true;
    
    const perm = permissoes[telaId];
    return perm?.consultar === true || perm?.editar === true;
  }, [isAdmin, permissoes]);

  return (
    <PermissoesContext.Provider
      value={{
        permissoes,
        isAdmin,
        loading,
        podeEditar,
        podeConsultar,
        recarregar: carregarPermissoes,
      }}
    >
      {children}
    </PermissoesContext.Provider>
  );
}

export function usePermissoes() {
  const context = useContext(PermissoesContext);
  if (!context) {
    throw new Error("usePermissoes deve ser usado dentro de um PermissoesProvider");
  }
  return context;
}

// Hook simplificado para usar em componentes
// Memoizado para evitar re-renders desnecessários em componentes pesados
export function useTelaPermissao(telaId: string) {
  const { podeEditar, podeConsultar, isAdmin, loading } = usePermissoes();
  
  // Calcular permissões uma única vez
  const podeEditarTela = podeEditar(telaId);
  const podeConsultarTela = podeConsultar(telaId);
  
  // Memoizar o resultado para evitar re-renders desnecessários
  const resultado = useMemo(() => ({
    podeEditar: podeEditarTela,
    podeConsultar: podeConsultarTela,
    apenasLeitura: !podeEditarTela && podeConsultarTela,
    semAcesso: !podeConsultarTela && !isAdmin,
    isAdmin,
    loading,
  }), [podeEditarTela, podeConsultarTela, isAdmin, loading]);
  
  return resultado;
}

