import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { autenticarEquipe, EquipeAuthResult, validarLoginEquipe, ColaboradorEquipe, abrirTurno, fecharTurno } from "@/lib/authUtils";
import { supabase } from "@/integrations/supabase/client";

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  status: string;
  habilidades: string[] | null;
  usuario?: string;
  placa_veiculo?: string;
  min_colaboradores: number;
  max_colaboradores: number;
}

interface Turno {
  id: string;
  equipe_id: string;
  data_turno: string;
  hora_inicio: string;
  placa_veiculo: string;
  km_inicial?: number;
  status: string;
  colaboradores: ColaboradorEquipe[];
}

interface EquipeAuthContextType {
  equipe: Equipe | null;
  turno: Turno | null;
  colaboradoresPendentes: ColaboradorEquipe[];
  isLoading: boolean;
  error: string | null;
  // Login antigo (com senha)
  login: (usuario: string, senha: string) => Promise<boolean>;
  // Login novo (código + placa)
  loginEquipe: (codigoEquipe: string, placaVeiculo: string) => Promise<{
    success: boolean;
    colaboradores?: ColaboradorEquipe[];
    message?: string;
  }>;
  // Abrir turno com colaboradores selecionados
  iniciarTurno: (colaboradoresIds: string[], kmInicial?: number, colaboradoresFull?: ColaboradorEquipe[]) => Promise<boolean>;
  // Fechar turno
  encerrarTurno: (kmFinal?: number, observacoes?: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  temTurnoAberto: boolean;
}

const EquipeAuthContext = createContext<EquipeAuthContextType | undefined>(undefined);

export function EquipeAuthProvider({ children }: { children: ReactNode }) {
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [colaboradoresPendentes, setColaboradoresPendentes] = useState<ColaboradorEquipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar equipe e turno do localStorage ao iniciar
  useEffect(() => {
    const equipeSalva = localStorage.getItem("equipe_auth");
    const turnoSalvo = localStorage.getItem("turno_auth");
    
    if (equipeSalva) {
      try {
        const equipeData = JSON.parse(equipeSalva);
        setEquipe(equipeData);
      } catch {
        localStorage.removeItem("equipe_auth");
      }
    }
    
    if (turnoSalvo) {
      try {
        const turnoData = JSON.parse(turnoSalvo);
        setTurno(turnoData);
      } catch {
        localStorage.removeItem("turno_auth");
      }
    }
    
    setIsLoading(false);
  }, []);

  // Login antigo (com usuário e senha) - mantido para compatibilidade
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

  // Login novo (código da equipe + placa)
  const loginEquipe = async (codigoEquipe: string, placaVeiculo: string): Promise<{
    success: boolean;
    colaboradores?: ColaboradorEquipe[];
    message?: string;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await validarLoginEquipe(codigoEquipe, placaVeiculo);

      if (result.success && result.equipe_id) {
        const equipeData: Equipe = {
          id: result.equipe_id,
          codigo: result.equipe_codigo || codigoEquipe,
          nome: result.equipe_nome || "",
          status: "disponivel",
          habilidades: null,
          placa_veiculo: placaVeiculo,
          min_colaboradores: result.min_colaboradores || 1,
          max_colaboradores: result.max_colaboradores || 2,
        };
        
        setEquipe(equipeData);
        setColaboradoresPendentes(result.colaboradores || []);
        localStorage.setItem("equipe_auth", JSON.stringify(equipeData));
        
        return {
          success: true,
          colaboradores: result.colaboradores || [],
        };
      } else {
        setError(result.message || "Equipe não encontrada");
        return {
          success: false,
          message: result.message || "Equipe não encontrada",
        };
      }
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
      return {
        success: false,
        message: err.message || "Erro ao fazer login",
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Iniciar turno com colaboradores selecionados
  const iniciarTurno = async (colaboradoresIds: string[], kmInicial?: number, colaboradoresFull?: ColaboradorEquipe[]): Promise<boolean> => {
    if (!equipe) {
      setError("Equipe não autenticada");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await abrirTurno(
        equipe.id,
        equipe.placa_veiculo || "",
        colaboradoresIds,
        kmInicial
      );

      if (result.success && result.turnoId) {
        // Usar colaboradoresFull se fornecido, senão filtrar de colaboradoresPendentes
        const colaboradoresTurno = colaboradoresFull || colaboradoresPendentes.filter(c => colaboradoresIds.includes(c.id));
        
        const turnoData: Turno = {
          id: result.turnoId,
          equipe_id: equipe.id,
          data_turno: new Date().toISOString().split("T")[0],
          hora_inicio: new Date().toISOString(),
          placa_veiculo: equipe.placa_veiculo || "",
          km_inicial: kmInicial,
          status: "aberto",
          colaboradores: colaboradoresTurno,
        };
        
        setTurno(turnoData);
        localStorage.setItem("turno_auth", JSON.stringify(turnoData));
        setColaboradoresPendentes([]);
        return true;
      } else {
        setError(result.message || "Erro ao iniciar turno");
        return false;
      }
    } catch (err: any) {
      setError(err.message || "Erro ao iniciar turno");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Encerrar turno
  const encerrarTurno = async (kmFinal?: number, observacoes?: string): Promise<boolean> => {
    if (!turno) {
      setError("Nenhum turno aberto");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fecharTurno(turno.id, kmFinal, observacoes);

      if (result.success) {
        setTurno(null);
        localStorage.removeItem("turno_auth");
        return true;
      } else {
        setError(result.message || "Erro ao encerrar turno");
        return false;
      }
    } catch (err: any) {
      setError(err.message || "Erro ao encerrar turno");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setEquipe(null);
    setTurno(null);
    setColaboradoresPendentes([]);
    localStorage.removeItem("equipe_auth");
    localStorage.removeItem("turno_auth");
  };

  return (
    <EquipeAuthContext.Provider
      value={{
        equipe,
        turno,
        colaboradoresPendentes,
        isLoading,
        error,
        login,
        loginEquipe,
        iniciarTurno,
        encerrarTurno,
        logout,
        isAuthenticated: !!equipe,
        temTurnoAberto: !!turno,
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

