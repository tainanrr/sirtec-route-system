import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { autenticarEquipe, EquipeAuthResult } from "@/lib/authUtils";

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  status: string;
  habilidades: string[] | null;
  usuario: string;
}

interface EquipeAuthContextType {
  equipe: Equipe | null;
  isLoading: boolean;
  error: string | null;
  login: (usuario: string, senha: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const EquipeAuthContext = createContext<EquipeAuthContextType | undefined>(undefined);

export function EquipeAuthProvider({ children }: { children: ReactNode }) {
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar equipe do localStorage ao iniciar
  useEffect(() => {
    const equipeSalva = localStorage.getItem("equipe_auth");
    if (equipeSalva) {
      try {
        const equipeData = JSON.parse(equipeSalva);
        setEquipe(equipeData);
      } catch {
        localStorage.removeItem("equipe_auth");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (usuario: string, senha: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await autenticarEquipe(usuario, senha);

      if (result.success && result.equipe) {
        setEquipe(result.equipe);
        localStorage.setItem("equipe_auth", JSON.stringify(result.equipe));
        return true;
      } else {
        setError(result.message || "Erro ao fazer login");
        return false;
      }
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setEquipe(null);
    localStorage.removeItem("equipe_auth");
  };

  return (
    <EquipeAuthContext.Provider
      value={{
        equipe,
        isLoading,
        error,
        login,
        logout,
        isAuthenticated: !!equipe,
      }}
    >
      {children}
    </EquipeAuthContext.Provider>
  );
}

export function useEquipeAuth() {
  const context = useContext(EquipeAuthContext);
  if (context === undefined) {
    throw new Error("useEquipeAuth deve ser usado dentro de EquipeAuthProvider");
  }
  return context;
}






