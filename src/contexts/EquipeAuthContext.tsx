import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { autenticarEquipe, EquipeAuthResult, validarLoginEquipe, ColaboradorEquipe, abrirTurno, fecharTurno, verificarTurnoAberto, TurnoExistente } from "@/lib/authUtils";
import { supabase } from "@/integrations/supabase/client";
import { logApp } from "@/lib/logUtils";

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
    turnoExistente?: TurnoExistente;
  }>;
  // Acessar turno existente
  acessarTurnoExistente: (turnoExistente: TurnoExistente) => void;
  // Abrir turno com colaboradores selecionados
  iniciarTurno: (colaboradoresIds: string[], kmInicial?: number, colaboradoresFull?: ColaboradorEquipe[]) => Promise<{ success: boolean; message?: string }>;
  // Fechar turno
  encerrarTurno: (kmFinal?: number, observacoes?: string) => Promise<{ success: boolean; message?: string; osEmAndamento?: { id: string; numero: string; status: string } }>;
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
    turnoExistente?: TurnoExistente;
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
        
        // Verificar se já existe turno aberto para esta equipe
        const turnoResult = await verificarTurnoAberto(result.equipe_id);
        
        // Registrar log de login no app
        const colaboradoresNomes = (result.colaboradores || []).map(c => c.nome).join(", ");
        const lider = (result.colaboradores || []).find(c => c.funcao === "lider");
        logApp(
          "login",
          "app",
          `Login app - Equipe ${codigoEquipe} (${placaVeiculo}) - Colaboradores: ${colaboradoresNomes}`,
          { 
            id: lider?.id,
            nome: lider?.nome || colaboradoresNomes,
            equipeId: result.id,
            equipeCodigo: codigoEquipe
          },
          { equipeId: result.id, equipeCodigo: codigoEquipe }
        );
        
        return {
          success: true,
          colaboradores: result.colaboradores || [],
          turnoExistente: turnoResult.turno,
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

  // Acessar turno existente
  const acessarTurnoExistente = (turnoExistente: TurnoExistente) => {
    if (!equipe) return;
    
    const turnoData: Turno = {
      id: turnoExistente.id,
      equipe_id: equipe.id,
      data_turno: turnoExistente.data_turno,
      hora_inicio: turnoExistente.hora_inicio,
      placa_veiculo: turnoExistente.placa_veiculo || equipe.placa_veiculo || "",
      km_inicial: turnoExistente.km_inicial || undefined,
      status: "aberto",
      colaboradores: turnoExistente.colaboradores || [],
    };
    
    setTurno(turnoData);
    localStorage.setItem("turno_auth", JSON.stringify(turnoData));
    setColaboradoresPendentes([]);
    
    // Log de acesso ao turno existente
    const colaboradoresNomes = turnoExistente.colaboradores?.map(c => c.nome).join(", ") || "";
    logApp(
      "acessar_turno",
      "turnos",
      `Acessou turno existente - Equipe ${equipe.codigo} - Turno de ${turnoExistente.data_turno}`,
      { 
        id: turnoExistente.colaboradores?.[0]?.id,
        nome: colaboradoresNomes || equipe.nome,
        equipeId: equipe.id,
        equipeCodigo: equipe.codigo
      },
      { 
        equipeId: equipe.id, 
        equipeCodigo: equipe.codigo,
        tabela: "turnos",
        registroId: turnoExistente.id,
      }
    );
  };

  // Iniciar turno com colaboradores selecionados
  const iniciarTurno = async (colaboradoresIds: string[], kmInicial?: number, colaboradoresFull?: ColaboradorEquipe[]): Promise<{ success: boolean; message?: string }> => {
    if (!equipe) {
      setError("Equipe não autenticada");
      return { success: false, message: "Equipe não autenticada" };
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
        
        // Registrar log de abertura de turno
        const colaboradoresNomes = colaboradoresTurno.map(c => c.nome).join(", ");
        const liderTurno = colaboradoresTurno.find(c => c.funcao === "lider");
        logApp(
          "abrir_turno",
          "turnos",
          `Turno aberto - Equipe ${equipe.codigo} - KM: ${kmInicial || 'N/A'} - Colaboradores: ${colaboradoresNomes}`,
          { 
            id: liderTurno?.id,
            nome: liderTurno?.nome || colaboradoresNomes,
            equipeId: equipe.id,
            equipeCodigo: equipe.codigo
          },
          { 
            equipeId: equipe.id, 
            equipeCodigo: equipe.codigo,
            tabela: "turnos",
            registroId: result.turnoId,
            dadosNovos: { km_inicial: kmInicial, colaboradores: colaboradoresIds }
          }
        );
        
        return { success: true };
      } else {
        const errorMessage = result.message || "Erro ao iniciar turno";
        setError(errorMessage);
        return { success: false, message: errorMessage };
      }
    } catch (err: any) {
      const errorMessage = err.message || "Erro ao iniciar turno";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Encerrar turno
  const encerrarTurno = async (kmFinal?: number, observacoes?: string): Promise<{ success: boolean; message?: string; osEmAndamento?: { id: string; numero: string; status: string } }> => {
    if (!turno) {
      setError("Nenhum turno aberto");
      return { success: false, message: "Nenhum turno aberto" };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Passar equipe_id para verificação de OS em andamento
      const result = await fecharTurno(turno.id, kmFinal, observacoes, equipe?.id);

      if (result.success) {
        // Registrar log de fechamento de turno
        const colaboradoresNomes = turno.colaboradores?.map(c => c.nome).join(", ") || "";
        const liderTurno = turno.colaboradores?.find(c => c.funcao === "lider");
        logApp(
          "fechar_turno",
          "turnos",
          `Turno fechado - Equipe ${equipe?.codigo} - KM Final: ${kmFinal || 'N/A'} - Colaboradores: ${colaboradoresNomes}`,
          { 
            id: liderTurno?.id,
            nome: liderTurno?.nome || colaboradoresNomes,
            equipeId: equipe?.id,
            equipeCodigo: equipe?.codigo
          },
          { 
            equipeId: equipe?.id, 
            equipeCodigo: equipe?.codigo,
            tabela: "turnos",
            registroId: turno.id,
            dadosNovos: { km_final: kmFinal, observacoes }
          }
        );
        
        setTurno(null);
        localStorage.removeItem("turno_auth");
        return { success: true };
      } else {
        setError(result.message || "Erro ao encerrar turno");
        return { 
          success: false, 
          message: result.message, 
          osEmAndamento: result.osEmAndamento 
        };
      }
    } catch (err: any) {
      setError(err.message || "Erro ao encerrar turno");
      return { success: false, message: err.message || "Erro ao encerrar turno" };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Registrar log de logout do app
    if (equipe) {
      const colaboradoresNomes = turno?.colaboradores?.map(c => c.nome).join(", ") || "";
      const lider = turno?.colaboradores?.find(c => c.funcao === "lider");
      logApp(
        "logout",
        "app",
        `Logout app - Equipe ${equipe.codigo}`,
        { 
          id: lider?.id,
          nome: lider?.nome || colaboradoresNomes || equipe.nome,
          equipeId: equipe.id,
          equipeCodigo: equipe.codigo
        },
        { equipeId: equipe.id, equipeCodigo: equipe.codigo }
      );
    }
    
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
        acessarTurnoExistente,
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

