import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWebAuth } from "@/contexts/WebAuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ConfigUrgencia {
  id: string;
  usuario_id: string;
  prazo_limite_urgente: string; // ISO timestamp
  atualizado_em: string;
  atualizado_automaticamente: boolean;
}

// Lista de query keys que devem ser invalidadas quando o prazo muda
const QUERY_KEYS_TO_INVALIDATE = [
  "ordens-servico",
  "os-pendentes",
  "roteirizacao",
  "acompanhamento",
  "planejamentos",
];

/**
 * Hook para gerenciar a configuração de prazo limite para OSs urgentes.
 * 
 * O prazo limite define até qual data/hora as OSs reguladas são consideradas urgentes.
 * Por padrão, às 00:01 de cada dia, o sistema reseta para o próximo dia às 10h.
 * Quando o usuário altera manualmente, o valor persiste até o próximo reset automático.
 */
export function useConfigUrgencia() {
  const { usuarioWeb } = useWebAuth();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ConfigUrgencia | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Contador para forçar re-renderização quando o prazo muda
  const [versao, setVersao] = useState(0);
  // Ref para evitar invalidação na primeira renderização
  const isFirstRender = useRef(true);

  // Calcular prazo padrão (próximo dia às 10h no horário de Brasília)
  const calcularPrazoPadrao = useCallback((): Date => {
    const agora = new Date();
    const amanha = new Date(agora);
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(10, 0, 0, 0);
    return amanha;
  }, []);

  // Função para invalidar todas as queries relacionadas
  const invalidarQueries = useCallback(() => {
    console.log("[useConfigUrgencia] Invalidando queries relacionadas...");
    QUERY_KEYS_TO_INVALIDATE.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
    // Incrementar versão para forçar re-renderização de componentes
    setVersao(v => v + 1);
  }, [queryClient]);

  // Carregar configuração do usuário
  const loadConfig = useCallback(async () => {
    // Se não há usuário, usar padrão sem bloquear
    if (!usuarioWeb?.id) {
      console.log("[useConfigUrgencia] Sem usuário, usando prazo padrão");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from("config_prazo_urgente")
        .select("*")
        .eq("usuario_id", usuarioWeb.id)
        .maybeSingle();

      // Se tabela não existe ou outro erro, usar padrão silenciosamente
      if (error) {
        // Erro 42P01 = tabela não existe, ignorar silenciosamente
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          console.warn("[useConfigUrgencia] Tabela não existe, usando prazo padrão. Execute a migração.");
        } else {
          console.error("[useConfigUrgencia] Erro ao carregar config:", error);
        }
        setIsLoading(false);
        return;
      }

      if (data) {
        setConfig(data);
      } else {
        // Se não existe registro, tentar criar
        try {
          const prazoPadrao = calcularPrazoPadrao();
          const novaConfig = {
            usuario_id: usuarioWeb.id,
            prazo_limite_urgente: prazoPadrao.toISOString(),
            atualizado_automaticamente: true,
          };

          const { data: insertedData, error: insertError } = await supabase
            .from("config_prazo_urgente")
            .insert(novaConfig)
            .select()
            .single();

          if (insertError) {
            // Se erro ao inserir (tabela não existe), ignorar
            if (insertError.code === "42P01" || insertError.message?.includes("does not exist")) {
              console.warn("[useConfigUrgencia] Tabela não existe, usando prazo padrão.");
            } else {
              console.error("[useConfigUrgencia] Erro ao criar config:", insertError);
            }
          } else if (insertedData) {
            setConfig(insertedData);
          }
        } catch (insertErr) {
          console.warn("[useConfigUrgencia] Erro ao criar config, usando padrão:", insertErr);
        }
      }
    } catch (err) {
      console.error("[useConfigUrgencia] Erro:", err);
    } finally {
      setIsLoading(false);
    }
  }, [usuarioWeb?.id, calcularPrazoPadrao]);

  // Salvar nova configuração
  const salvarPrazoLimite = useCallback(async (novoPrazo: Date): Promise<boolean> => {
    if (!usuarioWeb?.id) {
      toast.error("Usuário não autenticado");
      return false;
    }

    try {
      setIsSaving(true);

      const { data, error } = await supabase
        .from("config_prazo_urgente")
        .upsert({
          usuario_id: usuarioWeb.id,
          prazo_limite_urgente: novoPrazo.toISOString(),
          atualizado_em: new Date().toISOString(),
          atualizado_automaticamente: false, // Atualização manual
        }, {
          onConflict: "usuario_id",
        })
        .select()
        .single();

      if (error) {
        // Se tabela não existe, salvar apenas localmente
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          console.warn("[useConfigUrgencia] Tabela não existe, salvando apenas em memória");
          setConfig({
            id: "local",
            usuario_id: usuarioWeb.id,
            prazo_limite_urgente: novoPrazo.toISOString(),
            atualizado_em: new Date().toISOString(),
            atualizado_automaticamente: false,
          });
          invalidarQueries();
          toast.success("Prazo limite atualizado! (Execute a migração para persistir)");
          return true;
        }
        console.error("[useConfigUrgencia] Erro ao salvar:", error);
        toast.error("Erro ao salvar configuração");
        return false;
      }

      setConfig(data);
      // Invalidar queries para forçar recálculo em todos os componentes
      invalidarQueries();
      toast.success("Prazo limite atualizado! Dados recarregados.");
      return true;
    } catch (err) {
      console.error("[useConfigUrgencia] Erro:", err);
      toast.error("Erro ao salvar configuração");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [usuarioWeb?.id, invalidarQueries]);

  // Resetar para o padrão
  const resetarParaPadrao = useCallback(async (): Promise<boolean> => {
    const prazoPadrao = calcularPrazoPadrao();
    return salvarPrazoLimite(prazoPadrao);
  }, [calcularPrazoPadrao, salvarPrazoLimite]);

  // Prazo limite como Date
  const prazoLimiteDate = useMemo((): Date => {
    if (config?.prazo_limite_urgente) {
      return new Date(config.prazo_limite_urgente);
    }
    return calcularPrazoPadrao();
  }, [config?.prazo_limite_urgente, calcularPrazoPadrao]);

  // Verificar se uma OS é urgente baseado no prazo limite configurado
  const isOSUrgente = useCallback((prazo: string | null | undefined, regulada: boolean | null | undefined): boolean => {
    // Não regulada = não urgente (por prazo)
    if (!regulada) return false;
    // Sem prazo = não dá para determinar urgência
    if (!prazo) return false;

    const prazoDate = new Date(prazo);
    // Urgente se o prazo da OS é menor ou igual ao prazo limite configurado
    return prazoDate <= prazoLimiteDate;
  }, [prazoLimiteDate]);

  // Carregar ao montar ou quando usuário mudar
  useEffect(() => {
    loadConfig();
    
    // Timeout de segurança para nunca ficar em loading infinito
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [loadConfig]);

  // Verificar se precisa resetar (às 00:01 de cada dia)
  useEffect(() => {
    if (!config) return;

    const verificarReset = () => {
      const agora = new Date();
      const ultimaAtualizacao = new Date(config.atualizado_em);
      
      // Se foi atualizado manualmente hoje, não resetar
      if (!config.atualizado_automaticamente) {
        const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        const diaAtualizacao = new Date(ultimaAtualizacao.getFullYear(), ultimaAtualizacao.getMonth(), ultimaAtualizacao.getDate());
        
        if (hoje.getTime() === diaAtualizacao.getTime()) {
          return; // Atualização manual de hoje, não resetar
        }
      }

      // Verificar se é um novo dia (precisa resetar)
      const diaConfig = new Date(ultimaAtualizacao.getFullYear(), ultimaAtualizacao.getMonth(), ultimaAtualizacao.getDate());
      const diaAtual = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

      if (diaAtual > diaConfig) {
        console.log("[useConfigUrgencia] Novo dia detectado, resetando para padrão...");
        resetarParaPadrao();
      }
    };

    // Verificar ao carregar
    verificarReset();

    // Verificar a cada minuto
    const interval = setInterval(verificarReset, 60000);

    return () => clearInterval(interval);
  }, [config, resetarParaPadrao]);

  return {
    /** Configuração atual salva no banco */
    config,
    /** Data/hora limite para considerar OS como urgente */
    prazoLimiteDate,
    /** Se está carregando a configuração */
    isLoading,
    /** Se está salvando a configuração */
    isSaving,
    /** Salvar novo prazo limite */
    salvarPrazoLimite,
    /** Resetar para o padrão (próximo dia às 10h) */
    resetarParaPadrao,
    /** Verificar se uma OS é urgente baseado no prazo limite */
    isOSUrgente,
    /** Recarregar configuração do banco */
    recarregar: loadConfig,
    /** Invalidar queries relacionadas (força recálculo) */
    invalidarQueries,
    /** Versão do prazo (incrementa a cada alteração para forçar re-render) */
    versao,
  };
}

/**
 * Função helper para verificar urgência fora do React (uso em funções puras)
 * @param prazo - Prazo da OS
 * @param regulada - Se a OS é regulada
 * @param prazoLimite - Data limite configurada para urgência
 */
export function verificarUrgenciaOS(
  prazo: string | null | undefined,
  regulada: boolean | null | undefined,
  prazoLimite: Date
): boolean {
  if (!regulada) return false;
  if (!prazo) return false;
  
  const prazoDate = new Date(prazo);
  return prazoDate <= prazoLimite;
}
