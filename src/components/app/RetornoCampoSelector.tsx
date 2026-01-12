import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData } from "@/hooks/useOfflineData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  ArrowLeft,
  Search,
  Loader2,
  Camera,
  Plus,
  Minus,
  Check,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TIPOS
// ============================================

interface Atividade {
  id: string;
  codigo: string;
  descricao: string;
  valor_unitario: number;
  unidade: string;
}

interface RetornoCampo {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  cor: string | null;
  gera_producao: boolean;
}

interface TipoServicoRetorno {
  id: string;
  retorno_campo_id: string;
  padrao: boolean;
  retorno: RetornoCampo;
}

interface RetornoAtividade {
  id: string;
  atividade_id: string;
  situacao: "obrigatorio" | "opcional_selecionado" | "opcional_nao_selecionado";
  quantidade_padrao: number;
  permite_alterar_qtd: boolean;
  qtd_min_fotos: number;
  atividade: Atividade;
}

interface AtividadeSelecionada {
  atividade_id: string;
  quantidade: number;
  atividade: Atividade;
  qtd_min_fotos: number;
}

interface RetornoCampoResult {
  retorno_campo_id: string;
  retorno_codigo: string;
  retorno_descricao: string;
  gera_producao: boolean;
  atividades: AtividadeSelecionada[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId: string; // ID do tipo de serviço (skill)
  onConfirm: (result: RetornoCampoResult) => void;
}

// Configuração dos grupos
const GRUPOS_RETORNO = {
  executado: {
    label: "Executado",
    icon: CheckCircle2,
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
    description: "Serviço realizado com sucesso",
  },
  impedimento: {
    label: "Impedimento",
    icon: AlertTriangle,
    color: "bg-red-500",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
    description: "Não foi possível realizar o serviço",
  },
  parcial: {
    label: "Parcial",
    icon: Clock,
    color: "bg-yellow-500",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
    borderColor: "border-yellow-200",
    description: "Serviço parcialmente executado",
  },
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function RetornoCampoSelector({
  open,
  onOpenChange,
  skillId,
  onConfirm,
}: Props) {
  // Hooks de offline
  const { isOnline } = useOfflineSyncContext();
  const { getTipoServicoRetornosFromCache, getRetornoAtividadesFromCache } = useOfflineData();

  // Estados
  const [loading, setLoading] = useState(true);
  const [retornosDisponiveis, setRetornosDisponiveis] = useState<TipoServicoRetorno[]>([]);
  const [step, setStep] = useState<"grupo" | "retorno" | "atividades">("grupo");
  const [selectedGrupo, setSelectedGrupo] = useState<string | null>(null);
  const [selectedRetorno, setSelectedRetorno] = useState<TipoServicoRetorno | null>(null);
  const [atividadesRetorno, setAtividadesRetorno] = useState<RetornoAtividade[]>([]);
  const [atividadesSelecionadas, setAtividadesSelecionadas] = useState<Map<string, number>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAtividades, setLoadingAtividades] = useState(false);

  // ============================================
  // CARREGAR DADOS
  // ============================================

  useEffect(() => {
    if (open && skillId) {
      carregarRetornos();
    }
  }, [open, skillId]);

  // Carregar retornos do cache offline
  const carregarRetornosOffline = async () => {
    try {
      console.log("[RetornoCampoSelector] 📦 Buscando retornos do cache para skill:", skillId);
      const retornosCache = await getTipoServicoRetornosFromCache(skillId);
      
      if (retornosCache && retornosCache.length > 0) {
        console.log("[RetornoCampoSelector] ✅ Retornos do cache:", retornosCache.length);
        setRetornosDisponiveis(retornosCache);
        return true;
      }
      
      console.log("[RetornoCampoSelector] ❌ Nenhum retorno no cache");
      return false;
    } catch (error) {
      console.error("[RetornoCampoSelector] Erro ao buscar cache:", error);
      return false;
    }
  };

  const carregarRetornos = async () => {
    setLoading(true);
    try {
      // Se offline, usar cache
      if (!isOnline) {
        const sucesso = await carregarRetornosOffline();
        if (!sucesso) {
          toast.error("Dados de retorno não disponíveis offline");
        }
        return;
      }

      // Se online, buscar do Supabase
      const { data, error } = await supabase
        .from("tipo_servico_retornos")
        .select(`
          id,
          retorno_campo_id,
          padrao,
          retorno:retornos_campo(
            id,
            codigo,
            descricao,
            tipo,
            cor,
            gera_producao
          )
        `)
        .eq("skill_id", skillId)
        .eq("ativo", true)
        .order("ordem");

      if (error) throw error;
      setRetornosDisponiveis(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar retornos:", error);
      // Tentar cache como fallback
      if (!navigator.onLine) {
        await carregarRetornosOffline();
      } else {
        toast.error("Erro ao carregar opções de retorno");
      }
    } finally {
      setLoading(false);
    }
  };

  // Carregar atividades do cache offline
  const carregarAtividadesOffline = async (tipoServicoRetornoId: string) => {
    try {
      console.log("[RetornoCampoSelector] 📦 Buscando atividades do cache para retorno:", tipoServicoRetornoId);
      const atividadesCache = await getRetornoAtividadesFromCache(tipoServicoRetornoId);
      
      if (atividadesCache && atividadesCache.length > 0) {
        console.log("[RetornoCampoSelector] ✅ Atividades do cache:", atividadesCache.length);
        setAtividadesRetorno(atividadesCache);
        
        // Pré-selecionar atividades obrigatórias e opcionais selecionadas
        const novasSelecionadas = new Map<string, number>();
        atividadesCache.forEach((atv: any) => {
          if (atv.situacao === "obrigatorio" || atv.situacao === "opcional_selecionado") {
            novasSelecionadas.set(atv.atividade_id, atv.quantidade_padrao);
          }
        });
        setAtividadesSelecionadas(novasSelecionadas);
        return true;
      }
      
      console.log("[RetornoCampoSelector] ❌ Nenhuma atividade no cache");
      return false;
    } catch (error) {
      console.error("[RetornoCampoSelector] Erro ao buscar atividades do cache:", error);
      return false;
    }
  };

  const carregarAtividadesRetorno = async (tipoServicoRetornoId: string) => {
    setLoadingAtividades(true);
    try {
      // Se offline, usar cache
      if (!isOnline) {
        const sucesso = await carregarAtividadesOffline(tipoServicoRetornoId);
        if (!sucesso) {
          toast.error("Atividades não disponíveis offline");
        }
        return;
      }

      // Se online, buscar do Supabase
      const { data, error } = await supabase
        .from("tipo_servico_retorno_atividades")
        .select(`
          id,
          atividade_id,
          situacao,
          quantidade_padrao,
          permite_alterar_qtd,
          qtd_min_fotos,
          atividade:atividades(
            id,
            codigo,
            descricao,
            valor_unitario,
            unidade
          )
        `)
        .eq("tipo_servico_retorno_id", tipoServicoRetornoId)
        .order("ordem");

      if (error) throw error;

      setAtividadesRetorno(data || []);

      // Pré-selecionar atividades obrigatórias e opcionais selecionadas
      const novasSelecionadas = new Map<string, number>();
      (data || []).forEach((atv) => {
        if (atv.situacao === "obrigatorio" || atv.situacao === "opcional_selecionado") {
          novasSelecionadas.set(atv.atividade_id, atv.quantidade_padrao);
        }
      });
      setAtividadesSelecionadas(novasSelecionadas);

    } catch (error: any) {
      console.error("Erro ao carregar atividades:", error);
      // Tentar cache como fallback
      if (!navigator.onLine) {
        await carregarAtividadesOffline(tipoServicoRetornoId);
      } else {
        toast.error("Erro ao carregar atividades");
      }
    } finally {
      setLoadingAtividades(false);
    }
  };

  // ============================================
  // AGRUPAMENTO DE RETORNOS
  // ============================================

  const retornosPorGrupo = useMemo(() => {
    const grupos: Record<string, TipoServicoRetorno[]> = {
      executado: [],
      impedimento: [],
      parcial: [],
    };

    retornosDisponiveis.forEach((r) => {
      const tipo = r.retorno?.tipo || "executado";
      if (grupos[tipo]) {
        grupos[tipo].push(r);
      } else {
        grupos.executado.push(r);
      }
    });

    // Ordenar alfabeticamente
    Object.keys(grupos).forEach((key) => {
      grupos[key].sort((a, b) => {
        const descA = a.retorno?.descricao || "";
        const descB = b.retorno?.descricao || "";
        return descA.localeCompare(descB, "pt-BR");
      });
    });

    return grupos;
  }, [retornosDisponiveis]);

  const gruposComRetornos = useMemo(() => {
    return Object.entries(retornosPorGrupo).filter(([_, retornos]) => retornos.length > 0);
  }, [retornosPorGrupo]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSelectGrupo = (grupo: string) => {
    setSelectedGrupo(grupo);
    setSearchTerm("");
    setStep("retorno");
  };

  const handleSelectRetorno = async (retorno: TipoServicoRetorno) => {
    setSelectedRetorno(retorno);
    await carregarAtividadesRetorno(retorno.id);
    setStep("atividades");
  };

  const handleVoltar = () => {
    if (step === "atividades") {
      setStep("retorno");
      setSelectedRetorno(null);
      setAtividadesRetorno([]);
      setAtividadesSelecionadas(new Map());
    } else if (step === "retorno") {
      setStep("grupo");
      setSelectedGrupo(null);
      setSearchTerm("");
    }
  };

  const handleToggleAtividade = (atividadeId: string, quantidade: number, obrigatorio: boolean) => {
    if (obrigatorio) return; // Não pode desmarcar obrigatórias

    const novasSelecionadas = new Map(atividadesSelecionadas);
    if (novasSelecionadas.has(atividadeId)) {
      novasSelecionadas.delete(atividadeId);
    } else {
      novasSelecionadas.set(atividadeId, quantidade);
    }
    setAtividadesSelecionadas(novasSelecionadas);
  };

  const handleAlterarQuantidade = (atividadeId: string, delta: number, min: number = 1) => {
    const novasSelecionadas = new Map(atividadesSelecionadas);
    const qtdAtual = novasSelecionadas.get(atividadeId) || min;
    const novaQtd = Math.max(min, qtdAtual + delta);
    novasSelecionadas.set(atividadeId, novaQtd);
    setAtividadesSelecionadas(novasSelecionadas);
  };

  const handleConfirmar = () => {
    if (!selectedRetorno) return;

    // Montar lista de atividades selecionadas
    const atividades: AtividadeSelecionada[] = [];
    atividadesSelecionadas.forEach((quantidade, atividadeId) => {
      const atvConfig = atividadesRetorno.find((a) => a.atividade_id === atividadeId);
      if (atvConfig) {
        atividades.push({
          atividade_id: atividadeId,
          quantidade,
          atividade: atvConfig.atividade,
          qtd_min_fotos: atvConfig.qtd_min_fotos,
        });
      }
    });

    // Verificar se todas as atividades obrigatórias estão selecionadas
    const obrigatoriasFaltando = atividadesRetorno.filter(
      (a) => a.situacao === "obrigatorio" && !atividadesSelecionadas.has(a.atividade_id)
    );

    if (obrigatoriasFaltando.length > 0) {
      toast.error("Selecione todas as atividades obrigatórias");
      return;
    }

    const result: RetornoCampoResult = {
      retorno_campo_id: selectedRetorno.retorno_campo_id,
      retorno_codigo: selectedRetorno.retorno?.codigo || "",
      retorno_descricao: selectedRetorno.retorno?.descricao || "",
      gera_producao: selectedRetorno.retorno?.gera_producao || false,
      atividades,
    };

    onConfirm(result);
    resetState();
    onOpenChange(false);
  };

  const resetState = () => {
    setStep("grupo");
    setSelectedGrupo(null);
    setSelectedRetorno(null);
    setAtividadesRetorno([]);
    setAtividadesSelecionadas(new Map());
    setSearchTerm("");
  };

  // Filtrar retornos do grupo selecionado
  const retornosFiltrados = useMemo(() => {
    if (!selectedGrupo) return [];
    const retornosDoGrupo = retornosPorGrupo[selectedGrupo] || [];
    if (!searchTerm) return retornosDoGrupo;

    const termo = searchTerm.toLowerCase();
    return retornosDoGrupo.filter(
      (r) =>
        r.retorno?.codigo?.toLowerCase().includes(termo) ||
        r.retorno?.descricao?.toLowerCase().includes(termo)
    );
  }, [selectedGrupo, retornosPorGrupo, searchTerm]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            {step !== "grupo" && (
              <Button variant="ghost" size="icon" onClick={handleVoltar}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex-1">
              <SheetTitle>
                {step === "grupo" && "Selecione o Resultado"}
                {step === "retorno" && GRUPOS_RETORNO[selectedGrupo as keyof typeof GRUPOS_RETORNO]?.label}
                {step === "atividades" && "Atividades Realizadas"}
              </SheetTitle>
              <SheetDescription>
                {step === "grupo" && "Qual foi o resultado do serviço?"}
                {step === "retorno" && "Selecione o retorno de campo"}
                {step === "atividades" && selectedRetorno?.retorno?.descricao}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <>
                {/* STEP 1: Seleção de Grupo */}
                {step === "grupo" && (
                  <div className="space-y-3">
                    {gruposComRetornos.map(([tipo, retornos]) => {
                      const config = GRUPOS_RETORNO[tipo as keyof typeof GRUPOS_RETORNO];
                      const IconComponent = config?.icon || CheckCircle2;

                      return (
                        <button
                          key={tipo}
                          onClick={() => handleSelectGrupo(tipo)}
                          className={cn(
                            "w-full p-4 rounded-xl border-2 transition-all",
                            "flex items-center gap-4 text-left",
                            config?.borderColor || "border-gray-200",
                            config?.bgColor || "bg-gray-50",
                            "hover:shadow-md active:scale-[0.98]"
                          )}
                        >
                          <div
                            className={cn(
                              "h-14 w-14 rounded-full flex items-center justify-center",
                              config?.color || "bg-gray-500"
                            )}
                          >
                            <IconComponent className="h-7 w-7 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className={cn("font-semibold text-lg", config?.textColor)}>
                              {config?.label || tipo}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {config?.description}
                            </p>
                            <Badge variant="secondary" className="mt-1">
                              {retornos.length} opções
                            </Badge>
                          </div>
                          <ChevronRight className={cn("h-6 w-6", config?.textColor)} />
                        </button>
                      );
                    })}

                    {gruposComRetornos.length === 0 && (
                      <div className="text-center py-12">
                        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">
                          Nenhum retorno configurado para este tipo de serviço
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: Seleção de Retorno */}
                {step === "retorno" && selectedGrupo && (
                  <div className="space-y-4">
                    {/* Barra de busca */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar retorno..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Lista de retornos */}
                    <div className="space-y-2">
                      {retornosFiltrados.map((retorno) => (
                        <button
                          key={retorno.id}
                          onClick={() => handleSelectRetorno(retorno)}
                          className={cn(
                            "w-full p-4 rounded-lg border transition-all",
                            "flex items-center gap-3 text-left",
                            "hover:bg-muted/50 active:scale-[0.99]",
                            retorno.padrao && "border-primary ring-1 ring-primary"
                          )}
                        >
                          <span
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: retorno.retorno?.cor || "#6b7280" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {retorno.retorno?.descricao}
                              </span>
                              {retorno.padrao && (
                                <Badge variant="outline" className="text-xs">
                                  Padrão
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </button>
                      ))}

                      {retornosFiltrados.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">Nenhum retorno encontrado</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 3: Atividades */}
                {step === "atividades" && (
                  <div className="space-y-4">
                    {loadingAtividades ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : atividadesRetorno.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">
                          Nenhuma atividade configurada para este retorno
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Legenda */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge className="bg-red-500">Obrigatório</Badge>
                          <Badge className="bg-blue-500">Opcional (selecionado)</Badge>
                          <Badge variant="secondary">Opcional</Badge>
                        </div>

                        {/* Lista de atividades */}
                        <div className="space-y-3">
                          {atividadesRetorno.map((atv) => {
                            const isSelected = atividadesSelecionadas.has(atv.atividade_id);
                            const isObrigatorio = atv.situacao === "obrigatorio";
                            const quantidade = atividadesSelecionadas.get(atv.atividade_id) || atv.quantidade_padrao;

                            return (
                              <Card
                                key={atv.id}
                                className={cn(
                                  "transition-all",
                                  isSelected && "ring-2 ring-primary",
                                  !isSelected && !isObrigatorio && "opacity-60"
                                )}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-start gap-3">
                                    {/* Checkbox/Toggle */}
                                    <button
                                      onClick={() =>
                                        handleToggleAtividade(
                                          atv.atividade_id,
                                          atv.quantidade_padrao,
                                          isObrigatorio
                                        )
                                      }
                                      disabled={isObrigatorio}
                                      className={cn(
                                        "h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                                        isSelected ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30",
                                        isObrigatorio && "cursor-not-allowed"
                                      )}
                                    >
                                      {isSelected && <Check className="h-4 w-4" />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs text-muted-foreground">
                                          {atv.atividade?.codigo}
                                        </span>
                                        {atv.situacao === "obrigatorio" && (
                                          <Badge className="bg-red-500 text-xs h-5">Obrigatório</Badge>
                                        )}
                                        {atv.qtd_min_fotos > 0 && (
                                          <Badge variant="outline" className="text-xs h-5">
                                            <Camera className="h-3 w-3 mr-1" />
                                            {atv.qtd_min_fotos}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm">{atv.atividade?.descricao}</p>

                                      {/* Controle de quantidade */}
                                      {isSelected && atv.permite_alterar_qtd && (
                                        <div className="flex items-center gap-3 mt-2">
                                          <span className="text-xs text-muted-foreground">Quantidade:</span>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => handleAlterarQuantidade(atv.atividade_id, -1)}
                                              disabled={quantidade <= 1}
                                            >
                                              <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="font-mono text-lg w-8 text-center">
                                              {quantidade}
                                            </span>
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => handleAlterarQuantidade(atv.atividade_id, 1)}
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Quantidade fixa */}
                                      {isSelected && !atv.permite_alterar_qtd && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Quantidade: {quantidade}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {step === "atividades" && !loadingAtividades && (
          <SheetFooter className="px-4 py-3 border-t shrink-0">
            <Button
              className="w-full"
              size="lg"
              onClick={handleConfirmar}
              disabled={atividadesSelecionadas.size === 0 && atividadesRetorno.length > 0}
            >
              <Check className="h-5 w-5 mr-2" />
              Confirmar Retorno
              {atividadesSelecionadas.size > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {atividadesSelecionadas.size} atividades
                </Badge>
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

