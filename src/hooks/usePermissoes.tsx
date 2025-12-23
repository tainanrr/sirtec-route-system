import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      
      // Buscar usuário logado
      const usuarioStr = localStorage.getItem("usuario_web");
      if (!usuarioStr) {
        console.log("[Permissoes] Nenhum usuário logado");
        setPermissoes({});
        setIsAdmin(false);
        return;
      }

      const usuario = JSON.parse(usuarioStr);
      const perfilId = usuario.perfil_id;

      if (!perfilId) {
        console.log("[Permissoes] Usuário sem perfil definido");
        setPermissoes({});
        setIsAdmin(false);
        return;
      }

      // Buscar perfil e permissões
      const { data: perfil, error } = await supabase
        .from("perfis_permissao")
        .select("*")
        .eq("id", perfilId)
        .single();

      if (error) {
        console.error("[Permissoes] Erro ao carregar perfil:", error);
        setPermissoes({});
        setIsAdmin(false);
        return;
      }

      if (!perfil) {
        console.log("[Permissoes] Perfil não encontrado");
        setPermissoes({});
        setIsAdmin(false);
        return;
      }

      const permissoesJson = (perfil as any).permissoes_json || {};
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
export function useTelaPermissao(telaId: string) {
  const { podeEditar, podeConsultar, isAdmin, loading } = usePermissoes();
  
  return {
    podeEditar: podeEditar(telaId),
    podeConsultar: podeConsultar(telaId),
    apenasLeitura: !podeEditar(telaId) && podeConsultar(telaId),
    semAcesso: !podeConsultar(telaId) && !isAdmin,
    isAdmin,
    loading,
  };
}

