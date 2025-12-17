import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useEquipeAuth } from "./EquipeAuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  habilidades: string[] | null;
  status: string;
  telefone: string | null;
  usuario?: string | null;
}

interface TecnicoContextType {
  equipe: Equipe | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const TecnicoContext = createContext<TecnicoContextType | undefined>(undefined);

export function TecnicoProvider({ children }: { children: ReactNode }) {
  const { equipe: equipeAuth } = useEquipeAuth();
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEquipe = async () => {
    if (!equipeAuth?.id) {
      setEquipe(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: tecnicoData, error: tecnicoError } = await supabase
        .from("tecnicos")
        .select("*")
        .eq("id", equipeAuth.id)
        .maybeSingle();

      if (tecnicoError) {
        console.error("Erro ao buscar técnico:", tecnicoError);
        setError("Erro ao carregar dados da equipe.");
        setEquipe(null);
      } else if (tecnicoData) {
        setEquipe(tecnicoData);
      } else {
        setError("Equipe não encontrada.");
      }
    } catch (err) {
      console.error("Erro ao buscar equipe:", err);
      setError("Erro ao carregar dados do técnico.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (equipeAuth) {
      // Usar dados do contexto de autenticação diretamente
      setEquipe({
        id: equipeAuth.id,
        codigo: equipeAuth.codigo,
        nome: equipeAuth.nome,
        habilidades: equipeAuth.habilidades,
        status: equipeAuth.status,
        telefone: null,
        usuario: equipeAuth.usuario,
      });
      setIsLoading(false);
    } else {
      setEquipe(null);
      setIsLoading(false);
    }
  }, [equipeAuth]);

  return (
    <TecnicoContext.Provider value={{ equipe, isLoading, error, refetch: fetchEquipe }}>
      {children}
    </TecnicoContext.Provider>
  );
}

export function useTecnico() {
  const context = useContext(TecnicoContext);
  if (context === undefined) {
    throw new Error("useTecnico deve ser usado dentro de TecnicoProvider");
  }
  return context;
}
