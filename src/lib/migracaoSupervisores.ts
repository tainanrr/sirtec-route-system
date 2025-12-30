import { supabase } from "@/integrations/supabase/client";

// Mapeamento das equipes com seus supervisores
// Baseado na lista fornecida
const equipeSupervisorMap: Record<string, string> = {
  "4ST001": "TARCISIO JESUS DOS SANTOS",
  "4ST002": "MANUEL ABREU NOVAES NETO",
  "4ST004": "MANUEL ABREU NOVAES NETO",
  "4ST005": "TARCISIO JESUS DOS SANTOS",
  "4ST006": "TARCISIO JESUS DOS SANTOS",
  "4ST008": "MANUEL ABREU NOVAES NETO",
  "4ST009": "TARCISIO JESUS DOS SANTOS",
  "4ST00C": "TARCISIO JESUS DOS SANTOS",
  "4ST00D": "TARCISIO JESUS DOS SANTOS",
  "4ST00E": "TARCISIO JESUS DOS SANTOS",
  "4ST00H": "TARCISIO JESUS DOS SANTOS",
  "4ST00I": "TARCISIO JESUS DOS SANTOS",
  "4ST00J": "MANUEL ABREU NOVAES NETO",
  "4ST00K": "MANUEL ABREU NOVAES NETO",
  "4ST00M": "TARCISIO JESUS DOS SANTOS",
  "4ST00O": "TARCISIO JESUS DOS SANTOS",
  "4ST00P": "MANUEL ABREU NOVAES NETO",
  "4ST01B": "MANUEL ABREU NOVAES NETO",
  "4ST00Q": "TARCISIO JESUS DOS SANTOS",
  "4ST00R": "TARCISIO JESUS DOS SANTOS",
  "4ST00S": "MANUEL ABREU NOVAES NETO",
  "4ST00W": "TARCISIO JESUS DOS SANTOS",
  "4ST003": "TARCISIO JESUS DOS SANTOS",
  "4ST015": "TARCISIO JESUS DOS SANTOS",
  "4ST00Z": "TARCISIO JESUS DOS SANTOS",
  "4STKIT": "TARCISIO JESUS DOS SANTOS",
  "KT003": "MANUEL ABREU NOVAES NETO",
  "4ST02B": "TARCISIO JESUS DOS SANTOS",
  "4STJ02": "TARCISIO JESUS DOS SANTOS",
  "4STJ04": "TARCISIO JESUS DOS SANTOS",
};

interface MigrationResult {
  success: boolean;
  updated: number;
  errors: string[];
  details: { codigo: string; supervisor: string; status: string }[];
}

/**
 * Migra os supervisores para as equipes baseado no mapeamento fornecido
 * @returns Resultado da migração com detalhes de cada operação
 */
export async function migrarSupervisoresEquipes(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    updated: 0,
    errors: [],
    details: [],
  };

  try {
    // 1. Buscar todos os supervisores cadastrados
    const { data: supervisores, error: supError } = await supabase
      .from("coordenadores_supervisores")
      .select("id, nome")
      .eq("tipo", "supervisor")
      .eq("ativo", true);

    if (supError) {
      result.success = false;
      result.errors.push(`Erro ao buscar supervisores: ${supError.message}`);
      return result;
    }

    // 2. Criar mapa de nome para ID do supervisor
    const supervisorIdMap: Record<string, string> = {};
    supervisores?.forEach((sup) => {
      supervisorIdMap[sup.nome.toUpperCase()] = sup.id;
    });

    console.log("Supervisores encontrados:", supervisores);
    console.log("Mapa de IDs:", supervisorIdMap);

    // 3. Buscar todas as equipes
    const { data: equipes, error: eqError } = await supabase
      .from("tecnicos")
      .select("id, codigo, supervisor_id");

    if (eqError) {
      result.success = false;
      result.errors.push(`Erro ao buscar equipes: ${eqError.message}`);
      return result;
    }

    // 4. Para cada equipe no mapeamento, atualizar o supervisor
    for (const [codigoEquipe, nomeSupervisor] of Object.entries(equipeSupervisorMap)) {
      const equipe = equipes?.find((e) => e.codigo === codigoEquipe);
      const supervisorId = supervisorIdMap[nomeSupervisor.toUpperCase()];

      if (!equipe) {
        result.details.push({
          codigo: codigoEquipe,
          supervisor: nomeSupervisor,
          status: "Equipe não encontrada",
        });
        continue;
      }

      if (!supervisorId) {
        result.details.push({
          codigo: codigoEquipe,
          supervisor: nomeSupervisor,
          status: `Supervisor "${nomeSupervisor}" não encontrado`,
        });
        result.errors.push(`Supervisor "${nomeSupervisor}" não encontrado para equipe ${codigoEquipe}`);
        continue;
      }

      // Se já tem o mesmo supervisor, pular
      if (equipe.supervisor_id === supervisorId) {
        result.details.push({
          codigo: codigoEquipe,
          supervisor: nomeSupervisor,
          status: "Já configurado",
        });
        continue;
      }

      // Atualizar o supervisor
      const { error: updateError } = await supabase
        .from("tecnicos")
        .update({ supervisor_id: supervisorId })
        .eq("id", equipe.id);

      if (updateError) {
        result.details.push({
          codigo: codigoEquipe,
          supervisor: nomeSupervisor,
          status: `Erro: ${updateError.message}`,
        });
        result.errors.push(`Erro ao atualizar ${codigoEquipe}: ${updateError.message}`);
      } else {
        result.details.push({
          codigo: codigoEquipe,
          supervisor: nomeSupervisor,
          status: "Atualizado com sucesso",
        });
        result.updated++;
      }
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Erro inesperado: ${error.message}`);
    return result;
  }
}

// Exportar o mapa para referência
export { equipeSupervisorMap };

