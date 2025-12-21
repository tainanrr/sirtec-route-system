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




