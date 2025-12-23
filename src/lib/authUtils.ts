import { supabase } from "@/integrations/supabase/client";

export interface EquipeAuthResult {
  success: boolean;
  message?: string;
  equipe?: {
    id: string;
    codigo: string;
    nome: string;
    status: string;
    habilidades: string[] | null;
    usuario: string;
  };
}

// Nova interface para login por código + placa
export interface ColaboradorEquipe {
  id: string;
  cpf: string;
  nome: string;
  cargo: string | null;
  funcao: string;
}

export interface ValidarLoginEquipeResult {
  success: boolean;
  message?: string;
  equipe_id?: string;
  equipe_nome?: string;
  equipe_codigo?: string;
  placa_informada?: string;
  colaboradores?: ColaboradorEquipe[];
  min_colaboradores?: number;
  max_colaboradores?: number;
}

/**
 * Autentica uma equipe usando usuário e senha
 */
export async function autenticarEquipe(
  usuario: string,
  senha: string
): Promise<EquipeAuthResult> {
  try {
    const { data, error } = await supabase.rpc("autenticar_equipe", {
      p_usuario: usuario,
      p_senha: senha,
    });

    if (error) {
      console.error("Erro na autenticação:", error);
      return {
        success: false,
        message: error.message || "Erro ao autenticar",
      };
    }

    return data as EquipeAuthResult;
  } catch (error: any) {
    console.error("Erro na autenticação:", error);
    return {
      success: false,
      message: error.message || "Erro ao autenticar",
    };
  }
}

/**
 * Cria ou atualiza credenciais de uma equipe
 */
export async function criarCredenciaisEquipe(
  equipeId: string,
  usuario: string,
  senha: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.rpc("criar_credenciais_equipe", {
      p_equipe_id: equipeId,
      p_usuario: usuario,
      p_senha: senha,
    });

    if (error) {
      console.error("Erro ao criar credenciais:", error);
      return {
        success: false,
        message: error.message || "Erro ao criar credenciais",
      };
    }

    return data as { success: boolean; message?: string };
  } catch (error: any) {
    console.error("Erro ao criar credenciais:", error);
    return {
      success: false,
      message: error.message || "Erro ao criar credenciais",
    };
  }
}

/**
 * Atualiza a senha de uma equipe
 */
export async function atualizarSenhaEquipe(
  usuario: string,
  senhaAntiga: string,
  senhaNova: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.rpc("atualizar_senha_equipe", {
      p_usuario: usuario,
      p_senha_antiga: senhaAntiga,
      p_senha_nova: senhaNova,
    });

    if (error) {
      console.error("Erro ao atualizar senha:", error);
      return {
        success: false,
        message: error.message || "Erro ao atualizar senha",
      };
    }

    return data as { success: boolean; message?: string };
  } catch (error: any) {
    console.error("Erro ao atualizar senha:", error);
    return {
      success: false,
      message: error.message || "Erro ao atualizar senha",
    };
  }
}

/**
 * Valida login da equipe usando código + placa (novo método sem senha)
 */
export async function validarLoginEquipe(
  codigoEquipe: string,
  placaVeiculo: string
): Promise<ValidarLoginEquipeResult> {
  try {
    const { data, error } = await supabase.rpc("validar_login_equipe", {
      p_codigo_equipe: codigoEquipe,
      p_placa_veiculo: placaVeiculo,
    });

    if (error) {
      console.error("Erro na validação:", error);
      return {
        success: false,
        message: error.message || "Erro ao validar login",
      };
    }

    // A função pode retornar um objeto ou array dependendo da versão
    let result: any;
    if (Array.isArray(data) && data.length > 0) {
      result = data[0];
    } else if (data && typeof data === 'object') {
      result = data;
    }

    if (result && result.success !== false) {
      return {
        success: true,
        equipe_id: result.equipe_id,
        equipe_nome: result.equipe_nome,
        equipe_codigo: result.equipe_codigo,
        placa_informada: result.placa_informada,
        colaboradores: result.colaboradores || [],
        min_colaboradores: result.min_colaboradores || 1,
        max_colaboradores: result.max_colaboradores || 2,
      };
    } else {
      return {
        success: false,
        message: result?.message || "Equipe não encontrada ou código incorreto",
      };
    }
  } catch (error: any) {
    console.error("Erro na validação:", error);
    return {
      success: false,
      message: error.message || "Erro ao validar login",
    };
  }
}

/**
 * Abre um novo turno para a equipe
 */
export async function abrirTurno(
  equipeId: string,
  placaVeiculo: string,
  colaboradoresIds: string[],
  kmInicial?: number
): Promise<{ success: boolean; turnoId?: string; message?: string }> {
  try {
    const { data, error } = await supabase.rpc("abrir_turno", {
      p_equipe_id: equipeId,
      p_placa_veiculo: placaVeiculo,
      p_colaboradores_ids: colaboradoresIds,
      p_km_inicial: kmInicial || null,
    });

    if (error) {
      console.error("Erro ao abrir turno:", error);
      return {
        success: false,
        message: error.message || "Erro ao abrir turno",
      };
    }

    return {
      success: true,
      turnoId: data,
    };
  } catch (error: any) {
    console.error("Erro ao abrir turno:", error);
    return {
      success: false,
      message: error.message || "Erro ao abrir turno",
    };
  }
}

/**
 * Fecha um turno aberto
 */
export async function fecharTurno(
  turnoId: string,
  kmFinal?: number,
  observacoes?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.rpc("fechar_turno", {
      p_turno_id: turnoId,
      p_km_final: kmFinal || null,
      p_observacoes: observacoes || null,
    });

    if (error) {
      console.error("Erro ao fechar turno:", error);
      return {
        success: false,
        message: error.message || "Erro ao fechar turno",
      };
    }

    return {
      success: data === true,
      message: data === true ? "Turno fechado com sucesso" : "Erro ao fechar turno",
    };
  } catch (error: any) {
    console.error("Erro ao fechar turno:", error);
    return {
      success: false,
      message: error.message || "Erro ao fechar turno",
    };
  }
}







