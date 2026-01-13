import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  ClipboardCheck,
  ArrowLeft,
  Loader2,
  Camera,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TIPOS
// ============================================

interface Pergunta {
  id: string;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  opcoes?: string[] | { id: string; texto: string }[];
  ordem: number;
  permite_nao_aplica?: boolean; // Quando true, exibe checkbox "Não se aplica"
}

interface ChecklistServico {
  checklist_id: string;
  checklist_nome: string;
  checklist_descricao: string | null;
  obrigatorio: boolean;
  perguntas: Pergunta[];
  grupos?: any[];
}

interface Resposta {
  resposta: any;
  foto_url?: string;
  observacao?: string;
  nao_aplica?: boolean; // Se marcado como "Não se aplica"
}

interface ChecklistRespostaResult {
  checklist_id: string;
  checklist_nome: string;
  respostas: { pergunta_id: string; resposta: any; foto_url?: string; observacao?: string; nao_aplica?: boolean }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId: string;
  grupoRetorno: string; // 'executado', 'impedimento', 'parcial'
  ordemServicoId: string;
  equipeId: string;
  onComplete: (checklists: ChecklistRespostaResult[]) => void;
  onSkip?: () => void; // Quando não há checklists obrigatórios
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ChecklistServicoSheet({
  open,
  onOpenChange,
  skillId,
  grupoRetorno,
  ordemServicoId,
  equipeId,
  onComplete,
  onSkip,
}: Props) {
  const { isOnline, queueOperation, getFromCache, saveToCache } = useOfflineSyncContext();

  // Estados
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checklists, setChecklists] = useState<ChecklistServico[]>([]);
  const [currentChecklistIndex, setCurrentChecklistIndex] = useState(0);
  const [respostas, setRespostas] = useState<Map<string, Resposta>>(new Map());
  const [checklistsCompletos, setChecklistsCompletos] = useState<ChecklistRespostaResult[]>([]);

  // Checklist atual
  const currentChecklist = checklists[currentChecklistIndex] || null;
  const isLastChecklist = currentChecklistIndex === checklists.length - 1;

  // ============================================
  // CARREGAR CHECKLISTS
  // ============================================

  useEffect(() => {
    if (open && skillId && grupoRetorno) {
      carregarChecklists();
    }
  }, [open, skillId, grupoRetorno]);

  const carregarChecklists = async () => {
    setLoading(true);
    setRespostas(new Map());
    setCurrentChecklistIndex(0);
    setChecklistsCompletos([]);

    try {
      // Tentar cache primeiro se offline
      if (!isOnline) {
        const cacheKey = `checklists_servico_${skillId}_${grupoRetorno}`;
        const cached = await getFromCache<ChecklistServico[]>(cacheKey);
        if (cached && cached.length > 0) {
          console.log("[ChecklistServicoSheet] Usando cache:", cached.length);
          setChecklists(cached);
          setLoading(false);
          return;
        }
      }

      // Buscar usando a função do banco
      const { data, error } = await supabase.rpc("get_checklists_servico_para_os", {
        p_skill_id: skillId,
        p_grupo_retorno: grupoRetorno,
      });

      if (error) {
        console.error("[ChecklistServicoSheet] Erro na RPC:", error);
        // Fallback: buscar manualmente
        await carregarChecklistsFallback();
        return;
      }

      // Parsear perguntas JSON
      const checklistsParsed: ChecklistServico[] = (data || []).map((c: any) => ({
        checklist_id: c.checklist_id,
        checklist_nome: c.checklist_nome,
        checklist_descricao: c.checklist_descricao,
        obrigatorio: c.obrigatorio,
        perguntas: typeof c.perguntas === "string" ? JSON.parse(c.perguntas) : (c.perguntas || []),
        grupos: typeof c.grupos === "string" ? JSON.parse(c.grupos) : c.grupos,
      }));

      setChecklists(checklistsParsed);

      // Salvar no cache para uso offline
      if (checklistsParsed.length > 0) {
        await saveToCache(`checklists_servico_${skillId}_${grupoRetorno}`, checklistsParsed, 24);
      }

      // Se não há checklists, permitir pular
      if (checklistsParsed.length === 0 && onSkip) {
        onSkip();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("[ChecklistServicoSheet] Erro ao carregar:", error);
      toast.error("Erro ao carregar checklists");
    } finally {
      setLoading(false);
    }
  };

  // Fallback para quando a função RPC não existe
  const carregarChecklistsFallback = async () => {
    try {
      // Buscar vínculos
      const { data: vinculos, error: vinculosError } = await supabase
        .from("checklist_servico_vinculos")
        .select(`
          checklist_id,
          obrigatorio,
          ordem,
          checklists:checklist_id (id, nome, descricao, perguntas, grupos)
        `)
        .eq("skill_id", skillId)
        .eq("ativo", true)
        .or(`grupo_retorno.eq.${grupoRetorno},grupo_retorno.eq.todos`)
        .order("ordem");

      if (vinculosError) {
        console.error("[ChecklistServicoSheet] Erro vínculos:", vinculosError);
        
        // Se a tabela não existe, não há checklists configurados
        if (vinculosError.code === "42P01") {
          console.log("[ChecklistServicoSheet] Tabela de vínculos não existe");
          setChecklists([]);
          if (onSkip) {
            onSkip();
            onOpenChange(false);
          }
          return;
        }
        throw vinculosError;
      }

      // Filtrar apenas checklists ativos
      const checklistsParsed: ChecklistServico[] = (vinculos || [])
        .filter((v: any) => v.checklists && v.checklists.id)
        .map((v: any) => ({
          checklist_id: v.checklists.id,
          checklist_nome: v.checklists.nome,
          checklist_descricao: v.checklists.descricao,
          obrigatorio: v.obrigatorio,
          perguntas:
            typeof v.checklists.perguntas === "string"
              ? JSON.parse(v.checklists.perguntas)
              : (v.checklists.perguntas || []),
          grupos:
            typeof v.checklists.grupos === "string"
              ? JSON.parse(v.checklists.grupos)
              : v.checklists.grupos,
        }));

      setChecklists(checklistsParsed);

      // Salvar no cache
      if (checklistsParsed.length > 0) {
        await saveToCache(`checklists_servico_${skillId}_${grupoRetorno}`, checklistsParsed, 24);
      }

      // Se não há checklists, permitir pular
      if (checklistsParsed.length === 0 && onSkip) {
        onSkip();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("[ChecklistServicoSheet] Erro fallback:", error);
      // Se não conseguir carregar, permitir pular
      setChecklists([]);
      if (onSkip) {
        onSkip();
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HANDLERS DE RESPOSTAS
  // ============================================

  const updateResposta = (perguntaId: string, valor: any) => {
    setRespostas((prev) => {
      const novas = new Map(prev);
      const atual = novas.get(perguntaId) || { resposta: null };
      novas.set(perguntaId, { ...atual, resposta: valor });
      return novas;
    });
  };

  const toggleNaoAplica = (perguntaId: string, checked: boolean) => {
    setRespostas((prev) => {
      const novas = new Map(prev);
      const atual = novas.get(perguntaId) || { resposta: null };
      novas.set(perguntaId, { 
        ...atual, 
        nao_aplica: checked,
        // Limpa a resposta quando marca "Não se aplica"
        resposta: checked ? null : atual.resposta 
      });
      return novas;
    });
  };

  const getOpcoes = (pergunta: Pergunta): { id: string; texto: string }[] => {
    if (!pergunta.opcoes) return [];

    if (pergunta.opcoes.length > 0 && typeof pergunta.opcoes[0] === "object") {
      return pergunta.opcoes as { id: string; texto: string }[];
    }

    return (pergunta.opcoes as string[]).map((texto, i) => ({
      id: `opt-${i}`,
      texto,
    }));
  };

  // Verificar se todas as perguntas obrigatórias foram respondidas
  const todasObrigatoriasRespondidas = useMemo(() => {
    if (!currentChecklist) return false;

    const perguntasObrigatorias = currentChecklist.perguntas.filter((p) => p.obrigatoria);
    return perguntasObrigatorias.every((p) => {
      const resp = respostas.get(p.id);
      if (!resp) return false;

      // Se marcou "Não se aplica" e a pergunta permite, está ok
      if (resp.nao_aplica && p.permite_nao_aplica) return true;

      const valor = resp.resposta;
      if (valor === null || valor === undefined) return false;
      if (typeof valor === "string" && valor.trim() === "") return false;
      if (Array.isArray(valor) && valor.length === 0) return false;

      return true;
    });
  }, [currentChecklist, respostas]);

  // ============================================
  // SALVAR E AVANÇAR
  // ============================================

  const salvarChecklistAtual = async () => {
    if (!currentChecklist || !todasObrigatoriasRespondidas) {
      toast.error("Preencha todas as perguntas obrigatórias");
      return;
    }

    // Montar respostas
    const respostasArray = currentChecklist.perguntas.map((p) => {
      const resp = respostas.get(p.id);
      return {
        pergunta_id: p.id,
        resposta: resp?.nao_aplica ? "N/A" : (resp?.resposta ?? null),
        foto_url: resp?.foto_url,
        observacao: resp?.observacao,
        nao_aplica: resp?.nao_aplica || false,
      };
    });

    const checklistCompleto: ChecklistRespostaResult = {
      checklist_id: currentChecklist.checklist_id,
      checklist_nome: currentChecklist.checklist_nome,
      respostas: respostasArray,
    };

    // Adicionar aos completos
    const novosCompletos = [...checklistsCompletos, checklistCompleto];
    setChecklistsCompletos(novosCompletos);

    // Se é o último, finalizar
    if (isLastChecklist) {
      await finalizarTodosChecklists(novosCompletos);
    } else {
      // Avançar para o próximo
      setCurrentChecklistIndex((prev) => prev + 1);
      setRespostas(new Map());
    }
  };

  const finalizarTodosChecklists = async (checklistsParaSalvar: ChecklistRespostaResult[]) => {
    setSaving(true);

    try {
      // Salvar cada checklist no banco
      for (const checklist of checklistsParaSalvar) {
        const payload = {
          checklist_id: checklist.checklist_id,
          ordem_servico_id: ordemServicoId,
          equipe_id: equipeId,
          respostas: checklist.respostas,
          status: "completo",
          grupo_retorno: grupoRetorno,
        };

        if (isOnline) {
          const { error } = await supabase.from("checklist_respostas").insert(payload);
          if (error) {
            console.error("[ChecklistServicoSheet] Erro ao salvar:", error);
          }
        } else {
          // Enfileirar para sincronização offline
          await queueOperation(
            "save_checklist_servico",
            "checklist_respostas",
            "insert",
            payload,
            1
          );
        }
      }

      toast.success(
        isOnline
          ? "Checklists salvos com sucesso!"
          : "Checklists salvos (serão sincronizados quando online)"
      );

      // Chamar callback de conclusão
      onComplete(checklistsParaSalvar);
      onOpenChange(false);
    } catch (error: any) {
      console.error("[ChecklistServicoSheet] Erro ao finalizar:", error);
      toast.error("Erro ao salvar checklists");
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RENDER DE CAMPOS
  // ============================================

  const renderCampo = (pergunta: Pergunta) => {
    const resposta = respostas.get(pergunta.id);
    const valor = resposta?.resposta;
    const naoAplica = resposta?.nao_aplica || false;

    // Componente de "Não se aplica" reutilizável
    const renderNaoAplica = () => {
      if (!pergunta.permite_nao_aplica) return null;
      return (
        <label className={cn(
          "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-all mt-2",
          naoAplica 
            ? "border-orange-300 bg-orange-50 text-orange-700" 
            : "hover:bg-muted/50"
        )}>
          <Checkbox
            checked={naoAplica}
            onCheckedChange={(checked) => toggleNaoAplica(pergunta.id, checked as boolean)}
          />
          <span className="text-sm">Não se aplica</span>
        </label>
      );
    };

    switch (pergunta.tipo) {
      case "texto":
        return (
          <div>
            <Input
              value={(valor as string) || ""}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder="Digite sua resposta..."
              disabled={naoAplica}
              className={naoAplica ? "opacity-50" : ""}
            />
            {renderNaoAplica()}
          </div>
        );

      case "texto_longo":
        return (
          <div>
            <Textarea
              value={(valor as string) || ""}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder="Digite sua resposta..."
              rows={3}
              disabled={naoAplica}
              className={naoAplica ? "opacity-50" : ""}
            />
            {renderNaoAplica()}
          </div>
        );

      case "numero":
        return (
          <div>
            <Input
              type="number"
              value={(valor as string) || ""}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder="0"
              className={cn("w-32", naoAplica && "opacity-50")}
              disabled={naoAplica}
            />
            {renderNaoAplica()}
          </div>
        );

      case "sim_nao":
        return (
          <div className="flex gap-3">
            <Button
              type="button"
              variant={valor === true ? "default" : "outline"}
              className={cn(
                "flex-1 h-12",
                valor === true && "bg-green-600 hover:bg-green-700"
              )}
              onClick={() => updateResposta(pergunta.id, true)}
            >
              <Check className="h-5 w-5 mr-2" />
              Sim
            </Button>
            <Button
              type="button"
              variant={valor === false ? "default" : "outline"}
              className={cn(
                "flex-1 h-12",
                valor === false && "bg-red-600 hover:bg-red-700"
              )}
              onClick={() => updateResposta(pergunta.id, false)}
            >
              <X className="h-5 w-5 mr-2" />
              Não
            </Button>
          </div>
        );

      case "multipla_escolha":
        const opcoes = getOpcoes(pergunta);
        const selecionados = (valor as string[]) || [];
        return (
          <div className="space-y-2">
            {opcoes.map((opcao) => {
              const isSelected = selecionados.includes(opcao.texto);
              return (
                <label
                  key={opcao.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const novosSelecionados = checked
                        ? [...selecionados, opcao.texto]
                        : selecionados.filter((s) => s !== opcao.texto);
                      updateResposta(pergunta.id, novosSelecionados);
                    }}
                  />
                  <span className="text-sm">{opcao.texto}</span>
                </label>
              );
            })}
          </div>
        );

      case "foto":
        return (
          <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
            <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Funcionalidade de foto em desenvolvimento
            </p>
          </div>
        );

      default:
        return (
          <div>
            <Input
              value={(valor as string) || ""}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder="Digite sua resposta..."
              disabled={naoAplica}
              className={naoAplica ? "opacity-50" : ""}
            />
            {renderNaoAplica()}
          </div>
        );
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            {currentChecklistIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentChecklistIndex((prev) => prev - 1);
                  setRespostas(new Map());
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex-1">
              <SheetTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                {currentChecklist?.checklist_nome || "Checklist de Serviço"}
              </SheetTitle>
              <SheetDescription>
                {checklists.length > 1 && (
                  <span className="mr-2">
                    {currentChecklistIndex + 1} de {checklists.length}
                  </span>
                )}
                {currentChecklist?.checklist_descricao || "Preencha o checklist para concluir"}
              </SheetDescription>
            </div>
            {currentChecklist?.obrigatorio && (
              <Badge variant="destructive" className="shrink-0">
                Obrigatório
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : !currentChecklist ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-lg font-medium">Nenhum checklist necessário</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Você pode prosseguir com a conclusão da OS.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Indicador de progresso */}
                {checklists.length > 1 && (
                  <div className="flex gap-1 mb-4">
                    {checklists.map((_, index) => (
                      <div
                        key={index}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-colors",
                          index < currentChecklistIndex
                            ? "bg-green-500"
                            : index === currentChecklistIndex
                            ? "bg-primary"
                            : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                )}

                {/* Perguntas */}
                {currentChecklist.perguntas
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((pergunta, index) => {
                    const resp = respostas.get(pergunta.id);
                    const preenchida =
                      (resp?.nao_aplica && pergunta.permite_nao_aplica) ||
                      (resp?.resposta !== null &&
                      resp?.resposta !== undefined &&
                      (typeof resp?.resposta !== "string" || resp?.resposta.trim() !== ""));

                    return (
                      <Card
                        key={pergunta.id}
                        className={cn(
                          "transition-all",
                          pergunta.obrigatoria && !preenchida && "border-amber-300"
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <Badge variant="outline" className="shrink-0 mt-0.5">
                              {index + 1}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {pergunta.texto}
                                {pergunta.obrigatoria && (
                                  <span className="text-destructive ml-1">*</span>
                                )}
                              </p>
                            </div>
                            {preenchida && (
                              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                            )}
                          </div>
                          {renderCampo(pergunta)}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {currentChecklist && (
          <SheetFooter className="px-4 py-3 border-t shrink-0">
            <Button
              className="w-full"
              size="lg"
              onClick={salvarChecklistAtual}
              disabled={!todasObrigatoriasRespondidas || saving}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : isLastChecklist ? (
                <Check className="h-5 w-5 mr-2" />
              ) : (
                <ChevronRight className="h-5 w-5 mr-2" />
              )}
              {saving
                ? "Salvando..."
                : isLastChecklist
                ? "Concluir Checklists"
                : "Próximo Checklist"}
            </Button>
            {!todasObrigatoriasRespondidas && (
              <p className="text-xs text-center text-amber-600 mt-2 flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Preencha todas as perguntas obrigatórias
              </p>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
