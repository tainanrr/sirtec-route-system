import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { autenticarEquipe, EquipeAuthResult, validarLoginEquipe, ColaboradorEquipe, abrirTurno, fecharTurno, verificarTurnoAberto, TurnoExistente } from "@/lib/authUtils";
import { supabase } from "@/integrations/supabase/client";
import { logApp } from "@/lib/logUtils";
import { format } from "date-fns";

// Nome do banco de dados IndexedDB para autenticação offline
const OFFLINE_AUTH_DB = "sirtec_offline_auth";
const OFFLINE_AUTH_VERSION = 1;
const AUTH_STORE = "auth_data";

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
  contrato_padrao_avulsas?: string | null; // Contrato padrão para criação de OSs avulsas
  centro_custo_id?: string | null; // Centro de custo da equipe para OSs avulsas
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

// Dados salvos para autenticação offline
interface OfflineAuthData {
  equipe: Equipe;
  turno: Turno | null;
  colaboradores: ColaboradorEquipe[];
  lastLoginDate: string; // Data do último login online
  lastSyncDate: string; // Data da última sincronização
}

interface EquipeAuthContextType {
  equipe: Equipe | null;
  turno: Turno | null;
  colaboradoresPendentes: ColaboradorEquipe[];
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
  isOfflineLogin: boolean; // Indica se está logado via dados offline
  // Login antigo (com senha)
  login: (usuario: string, senha: string) => Promise<boolean>;
  // Login novo (código + placa)
  loginEquipe: (codigoEquipe: string, placaVeiculo: string) => Promise<{
    success: boolean;
    colaboradores?: ColaboradorEquipe[];
    message?: string;
    turnoExistente?: TurnoExistente;
    isOffline?: boolean;
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
  // Novas funções para offline
  saveOfflineAuthData: () => Promise<void>;
  clearOfflineAuthData: () => Promise<void>;
}

// Abrir conexão com IndexedDB para autenticação offline
const openAuthDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_AUTH_DB, OFFLINE_AUTH_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(AUTH_STORE)) {
        db.createObjectStore(AUTH_STORE, { keyPath: "key" });
      }
    };
  });
};

// Salvar dados de autenticação offline
const saveAuthToIndexedDB = async (key: string, data: any): Promise<void> => {
  const db = await openAuthDB();
  const transaction = db.transaction(AUTH_STORE, "readwrite");
  const store = transaction.objectStore(AUTH_STORE);
  
  await new Promise<void>((resolve, reject) => {
    const request = store.put({ key, data, updated_at: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Obter dados de autenticação offline
const getAuthFromIndexedDB = async (key: string): Promise<any> => {
  const db = await openAuthDB();
  const transaction = db.transaction(AUTH_STORE, "readonly");
  const store = transaction.objectStore(AUTH_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.data || null);
    request.onerror = () => reject(request.error);
  });
};

// Remover dados de autenticação offline
const removeAuthFromIndexedDB = async (key: string): Promise<void> => {
  const db = await openAuthDB();
  const transaction = db.transaction(AUTH_STORE, "readwrite");
  const store = transaction.objectStore(AUTH_STORE);
  
  await new Promise<void>((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const EquipeAuthContext = createContext<EquipeAuthContextType | undefined>(undefined);

export function EquipeAuthProvider({ children }: { children: ReactNode }) {
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [colaboradoresPendentes, setColaboradoresPendentes] = useState<ColaboradorEquipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineLogin, setIsOfflineLogin] = useState(false);

  // Monitorar status de conexão
  useEffect(() => {
    const handleOnline = () => {
      console.log("[EquipeAuth] Conexão restaurada");
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log("[EquipeAuth] Conexão perdida");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Carregar equipe e turno do localStorage ao iniciar
  useEffect(() => {
    const loadAuthData = async () => {
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
    };

    loadAuthData();
  }, []);

  // Salvar dados de autenticação para uso offline
  const saveOfflineAuthData = useCallback(async () => {
    if (!equipe) return;

    const dataHoje = format(new Date(), "yyyy-MM-dd");
    const offlineData: OfflineAuthData = {
      equipe,
      turno,
      colaboradores: turno?.colaboradores || colaboradoresPendentes,
      lastLoginDate: dataHoje,
      lastSyncDate: new Date().toISOString(),
    };

    // Salvar usando código da equipe como chave
    await saveAuthToIndexedDB(`auth_${equipe.codigo}`, offlineData);
    console.log("[EquipeAuth] Dados salvos para uso offline:", equipe.codigo);
  }, [equipe, turno, colaboradoresPendentes]);

  // Limpar dados de autenticação offline
  const clearOfflineAuthData = useCallback(async () => {
    if (equipe) {
      await removeAuthFromIndexedDB(`auth_${equipe.codigo}`);
      console.log("[EquipeAuth] Dados offline removidos:", equipe.codigo);
    }
  }, [equipe]);

  // Salvar automaticamente quando turno é aberto
  useEffect(() => {
    if (equipe && turno) {
      saveOfflineAuthData();
    }
  }, [equipe, turno, saveOfflineAuthData]);

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

  // Login novo (código da equipe + placa) - com suporte offline
  const loginEquipe = async (codigoEquipe: string, placaVeiculo: string): Promise<{
    success: boolean;
    colaboradores?: ColaboradorEquipe[];
    message?: string;
    turnoExistente?: TurnoExistente;
    isOffline?: boolean;
  }> => {
    setIsLoading(true);
    setError(null);
    setIsOfflineLogin(false);

    // Se está offline, tentar login via dados salvos
    if (!navigator.onLine) {
      console.log("[EquipeAuth] Tentando login offline para:", codigoEquipe);
      
      try {
        const offlineData = await getAuthFromIndexedDB(`auth_${codigoEquipe.toUpperCase()}`);
        
        if (offlineData) {
          const dataHoje = format(new Date(), "yyyy-MM-dd");
          
          // Verificar se o login offline é do mesmo dia
          if (offlineData.lastLoginDate === dataHoje) {
            console.log("[EquipeAuth] Login offline autorizado - dados do mesmo dia");
            
            // Verificar se a placa confere
            if (offlineData.equipe.placa_veiculo !== placaVeiculo.toUpperCase()) {
              setIsLoading(false);
              setError("Placa do veículo não confere com o último acesso");
              return {
                success: false,
                message: "Placa do veículo não confere com o último acesso",
                isOffline: true,
              };
            }
            
            // Restaurar dados
            setEquipe(offlineData.equipe);
            setIsOfflineLogin(true);
            localStorage.setItem("equipe_auth", JSON.stringify(offlineData.equipe));
            
            // Se tinha turno aberto, restaurar
            if (offlineData.turno) {
              setTurno(offlineData.turno);
              localStorage.setItem("turno_auth", JSON.stringify(offlineData.turno));
              setColaboradoresPendentes([]);
              
              setIsLoading(false);
              return {
                success: true,
                colaboradores: offlineData.turno.colaboradores,
                turnoExistente: {
                  id: offlineData.turno.id,
                  data_turno: offlineData.turno.data_turno,
                  hora_inicio: offlineData.turno.hora_inicio,
                  placa_veiculo: offlineData.turno.placa_veiculo,
                  km_inicial: offlineData.turno.km_inicial,
                  colaboradores: offlineData.turno.colaboradores,
                },
                isOffline: true,
              };
            } else {
              // Não tinha turno, retornar colaboradores salvos
              setColaboradoresPendentes(offlineData.colaboradores);
              setIsLoading(false);
              return {
                success: true,
                colaboradores: offlineData.colaboradores,
                isOffline: true,
              };
            }
          } else {
            // Dados de outro dia - não permitir login offline
            console.log("[EquipeAuth] Login offline negado - dados de outro dia");
            setIsLoading(false);
            setError("Dados offline expirados. Conecte-se à internet para fazer login.");
            return {
              success: false,
              message: "Dados offline expirados. Conecte-se à internet para fazer login.",
              isOffline: true,
            };
          }
        } else {
          // Sem dados offline
          console.log("[EquipeAuth] Login offline negado - sem dados salvos");
          setIsLoading(false);
          setError("Sem conexão com internet. Faça login online primeiro.");
          return {
            success: false,
            message: "Sem conexão com internet. Faça login online primeiro.",
            isOffline: true,
          };
        }
      } catch (offlineError) {
        console.error("[EquipeAuth] Erro ao tentar login offline:", offlineError);
        setIsLoading(false);
        setError("Sem conexão com internet");
        return {
          success: false,
          message: "Sem conexão com internet",
          isOffline: true,
        };
      }
    }

    // Login online normal
    try {
      const result = await validarLoginEquipe(codigoEquipe, placaVeiculo);

      if (result.success && result.equipe_id) {
        // Buscar dados adicionais da equipe (contrato padrão para avulsas e centro de custo)
        let contratoPadraoAvulsas: string | null = null;
        let centroCustoId: string | null = null;
        try {
          const { data: equipeExtra } = await supabase
            .from("tecnicos")
            .select("contrato_padrao_avulsas, centro_custo_id")
            .eq("id", result.equipe_id)
            .single();
          contratoPadraoAvulsas = equipeExtra?.contrato_padrao_avulsas || null;
          centroCustoId = equipeExtra?.centro_custo_id || null;
          console.log("[EquipeAuth] Contrato padrão para avulsas:", contratoPadraoAvulsas);
          console.log("[EquipeAuth] Centro de custo:", centroCustoId);
        } catch (err) {
          console.warn("[EquipeAuth] Erro ao buscar dados extras da equipe:", err);
        }
        
        const equipeData: Equipe = {
          id: result.equipe_id,
          codigo: result.equipe_codigo || codigoEquipe,
          nome: result.equipe_nome || "",
          status: "disponivel",
          habilidades: null,
          placa_veiculo: placaVeiculo,
          min_colaboradores: result.min_colaboradores || 1,
          max_colaboradores: result.max_colaboradores || 2,
          contrato_padrao_avulsas: contratoPadraoAvulsas,
          centro_custo_id: centroCustoId,
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

        // Salvar dados para uso offline futuro
        const dataHoje = format(new Date(), "yyyy-MM-dd");
        const offlineData: OfflineAuthData = {
          equipe: equipeData,
          turno: turnoResult.turno ? {
            id: turnoResult.turno.id,
            equipe_id: equipeData.id,
            data_turno: turnoResult.turno.data_turno,
            hora_inicio: turnoResult.turno.hora_inicio,
            placa_veiculo: turnoResult.turno.placa_veiculo || placaVeiculo,
            km_inicial: turnoResult.turno.km_inicial,
            status: "aberto",
            colaboradores: turnoResult.turno.colaboradores || [],
          } : null,
          colaboradores: result.colaboradores || [],
          lastLoginDate: dataHoje,
          lastSyncDate: new Date().toISOString(),
        };
        await saveAuthToIndexedDB(`auth_${equipeData.codigo}`, offlineData);
        console.log("[EquipeAuth] Dados salvos para uso offline");
        
        return {
          success: true,
          colaboradores: result.colaboradores || [],
          turnoExistente: turnoResult.turno,
          isOffline: false,
        };
      } else {
        setError(result.message || "Equipe não encontrada");
        return {
          success: false,
          message: result.message || "Equipe não encontrada",
        };
      }
    } catch (err: any) {
      // Se falhou por erro de rede, tentar login offline
      if (!navigator.onLine || err.message?.includes("network") || err.message?.includes("Failed to fetch")) {
        console.log("[EquipeAuth] Erro de rede, tentando login offline...");
        // Recursivamente tentar login offline
        setIsOnline(false);
        return loginEquipe(codigoEquipe, placaVeiculo);
      }
      
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

  // Iniciar turno com colaboradores selecionados - com suporte offline
  const iniciarTurno = async (colaboradoresIds: string[], kmInicial?: number, colaboradoresFull?: ColaboradorEquipe[]): Promise<{ success: boolean; message?: string }> => {
    if (!equipe) {
      setError("Equipe não autenticada");
      return { success: false, message: "Equipe não autenticada" };
    }

    setIsLoading(true);
    setError(null);

    // Usar colaboradoresFull se fornecido, senão filtrar de colaboradoresPendentes
    const colaboradoresTurno = colaboradoresFull || colaboradoresPendentes.filter(c => colaboradoresIds.includes(c.id));
    const dataHoje = format(new Date(), "yyyy-MM-dd");

    // Se está offline, criar turno local
    if (!navigator.onLine) {
      console.log("[EquipeAuth] Criando turno offline");
      
      const turnoOfflineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const turnoData: Turno = {
        id: turnoOfflineId,
        equipe_id: equipe.id,
        data_turno: dataHoje,
        hora_inicio: new Date().toISOString(),
        placa_veiculo: equipe.placa_veiculo || "",
        km_inicial: kmInicial,
        status: "aberto",
        colaboradores: colaboradoresTurno,
      };
      
      setTurno(turnoData);
      localStorage.setItem("turno_auth", JSON.stringify(turnoData));
      setColaboradoresPendentes([]);
      
      // Salvar dados offline atualizados
      const offlineData: OfflineAuthData = {
        equipe,
        turno: turnoData,
        colaboradores: colaboradoresTurno,
        lastLoginDate: dataHoje,
        lastSyncDate: new Date().toISOString(),
      };
      await saveAuthToIndexedDB(`auth_${equipe.codigo}`, offlineData);
      
      // TODO: Enfileirar para sincronização quando voltar online
      // Isso será tratado pelo hook useOfflineSync
      
      setIsLoading(false);
      return { success: true, message: "Turno criado offline. Será sincronizado quando houver conexão." };
    }

    // Online - criar turno normalmente
    try {
      const result = await abrirTurno(
        equipe.id,
        equipe.placa_veiculo || "",
        colaboradoresIds,
        kmInicial
      );

      if (result.success && result.turnoId) {
        const turnoData: Turno = {
          id: result.turnoId,
          equipe_id: equipe.id,
          data_turno: dataHoje,
          hora_inicio: new Date().toISOString(),
          placa_veiculo: equipe.placa_veiculo || "",
          km_inicial: kmInicial,
          status: "aberto",
          colaboradores: colaboradoresTurno,
        };
        
        setTurno(turnoData);
        localStorage.setItem("turno_auth", JSON.stringify(turnoData));
        
        // Limpar histórico de navegação das seções para evitar navegar para URLs de ordens antigas
        try {
          sessionStorage.removeItem("app_last_route_ordens");
          sessionStorage.removeItem("app_last_route_estoque");
          sessionStorage.removeItem("app_last_route_chat");
          sessionStorage.removeItem("app_last_route_docs");
          sessionStorage.removeItem("app_last_route_resultados");
          console.log("[EquipeAuth] Histórico de navegação limpo ao abrir novo turno");
        } catch {
          // ignore
        }
        setColaboradoresPendentes([]);
        
        // Salvar dados offline atualizados
        const offlineData: OfflineAuthData = {
          equipe,
          turno: turnoData,
          colaboradores: colaboradoresTurno,
          lastLoginDate: dataHoje,
          lastSyncDate: new Date().toISOString(),
        };
        await saveAuthToIndexedDB(`auth_${equipe.codigo}`, offlineData);
        
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
        isOnline,
        isOfflineLogin,
        login,
        loginEquipe,
        acessarTurnoExistente,
        iniciarTurno,
        encerrarTurno,
        logout,
        isAuthenticated: !!equipe,
        temTurnoAberto: !!turno,
        saveOfflineAuthData,
        clearOfflineAuthData,
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

