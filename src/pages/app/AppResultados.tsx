import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Calendar,
  DollarSign,
  Activity,
  RefreshCw,
  Loader2,
  BarChart3,
  PieChart,
  Zap,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, subMonths, setDate, getDate, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Função para calcular período padrão (26 a 25)
const calcularPeriodoPadrao = (dataRef: Date = new Date()) => {
  const diaAtual = getDate(dataRef);
  
  let inicio: Date;
  let fim: Date;
  
  if (diaAtual >= 26) {
    inicio = setDate(dataRef, 26);
    fim = setDate(addMonths(dataRef, 1), 25);
  } else {
    inicio = setDate(subMonths(dataRef, 1), 26);
    fim = setDate(dataRef, 25);
  }
  
  return {
    inicio: format(inicio, "yyyy-MM-dd"),
    fim: format(fim, "yyyy-MM-dd"),
  };
};

export default function AppResultados() {
  const { equipe: equipeAuth, logout } = useEquipeAuth();
  const { equipe, isLoading: isLoadingEquipe, refetch: refetchEquipe } = useTecnico();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("resumo");

  const periodoPadrao = calcularPeriodoPadrao();
  const [dataInicio] = useState(periodoPadrao.inicio);
  const [dataFim] = useState(periodoPadrao.fim);

  // Buscar metas da equipe
  const { data: metas, isLoading: isLoadingMetas, refetch: refetchMetas } = useQuery({
    queryKey: ["metas-equipe", equipe?.id, dataInicio, dataFim],
    queryFn: async () => {
      if (!equipe?.id) return [];
      
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .eq("equipe_id", equipe.id)
        .gte("data", dataInicio)
        .lte("data", dataFim);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!equipe?.id,
  });

  // Buscar produções da equipe
  const { data: producoes, isLoading: isLoadingProducoes, refetch: refetchProducoes } = useQuery({
    queryKey: ["producoes-equipe", equipe?.id, dataInicio, dataFim],
    queryFn: async () => {
      if (!equipe?.id) return [];
      
      const { data, error } = await supabase
        .from("producao_equipes")
        .select(`
          *,
          retornos_campo:retorno_campo_id (id, codigo, descricao, tipo)
        `)
        .eq("equipe_id", equipe.id)
        .gte("created_at", dataInicio + "T00:00:00")
        .lte("created_at", dataFim + "T23:59:59");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!equipe?.id,
  });

  // Calcular dados de meta vs produção
  const dadosMetaProducao = useMemo(() => {
    const totalMeta = metas?.reduce((acc, m) => acc + (m.valor_meta || 0), 0) || 0;
    const totalProducao = producoes?.reduce((acc, p) => acc + (p.valor_total || 0), 0) || 0;
    const percentual = totalMeta > 0 ? (totalProducao / totalMeta) * 100 : 0;
    const diferenca = totalProducao - totalMeta;
    const diasComMeta = metas?.length || 0;
    
    return {
      totalMeta,
      totalProducao,
      percentual,
      diferenca,
      diasComMeta,
      mediaMeta: diasComMeta > 0 ? totalMeta / diasComMeta : 0,
      mediaProducao: diasComMeta > 0 ? totalProducao / diasComMeta : 0,
    };
  }, [metas, producoes]);

  // Calcular dados de assertividade
  const dadosAssertividade = useMemo(() => {
    const totalVisitas = producoes?.length || 0;
    const executadas = producoes?.filter(p => p.retornos_campo?.tipo === "executado").length || 0;
    const impedimentos = producoes?.filter(p => p.retornos_campo?.tipo === "impedimento").length || 0;
    const parciais = producoes?.filter(p => p.retornos_campo?.tipo === "parcial").length || 0;
    const semRetorno = totalVisitas - executadas - impedimentos - parciais;
    
    const percentualExecutado = totalVisitas > 0 ? (executadas / totalVisitas) * 100 : 0;
    const percentualImpedimento = totalVisitas > 0 ? (impedimentos / totalVisitas) * 100 : 0;
    const percentualParcial = totalVisitas > 0 ? (parciais / totalVisitas) * 100 : 0;
    
    return {
      totalVisitas,
      executadas,
      impedimentos,
      parciais,
      semRetorno,
      percentualExecutado,
      percentualImpedimento,
      percentualParcial,
      assertividade: percentualExecutado,
    };
  }, [producoes]);

  // Dados por dia para gráfico simplificado
  const dadosDiarios = useMemo(() => {
    const dias = eachDayOfInterval({
      start: parseISO(dataInicio),
      end: parseISO(dataFim),
    });

    return dias.map(dia => {
      const dataStr = format(dia, "yyyy-MM-dd");
      const metaDia = metas?.find(m => m.data === dataStr)?.valor_meta || 0;
      const producaoDia = producoes
        ?.filter(p => p.created_at.startsWith(dataStr))
        .reduce((acc, p) => acc + (p.valor_total || 0), 0) || 0;
      
      return {
        data: format(dia, "dd/MM"),
        dataCompleta: dataStr,
        diaSemana: format(dia, "EEE", { locale: ptBR }),
        meta: metaDia,
        producao: producaoDia,
        percentual: metaDia > 0 ? (producaoDia / metaDia) * 100 : 0,
      };
    }).filter(d => d.meta > 0 || d.producao > 0);
  }, [dataInicio, dataFim, metas, producoes]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchEquipe(), refetchMetas(), refetchProducoes()]);
      toast.success("Dados atualizados!");
    } catch {
      toast.error("Erro ao atualizar dados");
    } finally {
      setIsRefreshing(false);
    }
  };

  const isLoading = isLoadingEquipe || isLoadingMetas || isLoadingProducoes;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPercentualColor = (percentual: number) => {
    if (percentual >= 100) return "text-green-600";
    if (percentual >= 80) return "text-amber-600";
    return "text-red-600";
  };

  const getPercentualBg = (percentual: number) => {
    if (percentual >= 100) return "bg-green-500";
    if (percentual >= 80) return "bg-amber-500";
    return "bg-red-500";
  };

  if (isLoadingEquipe) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-background to-muted/30">
      {/* Header compacto */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Meus Resultados</h1>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(dataInicio), "dd/MM")} - {format(parseISO(dataFim), "dd/MM/yyyy")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-4 space-y-4 pb-24">
        {/* Card Principal - Meta vs Produção */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className={cn(
            "p-4",
            dadosMetaProducao.percentual >= 100 
              ? "bg-gradient-to-br from-green-500 to-green-600"
              : dadosMetaProducao.percentual >= 80
                ? "bg-gradient-to-br from-amber-500 to-amber-600"
                : "bg-gradient-to-br from-red-500 to-red-600"
          )}>
            <div className="flex items-center justify-between text-white mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                <span className="font-medium">Meta do Ciclo</span>
              </div>
              {dadosMetaProducao.percentual >= 100 ? (
                <Award className="h-6 w-6" />
              ) : dadosMetaProducao.percentual >= 80 ? (
                <TrendingUp className="h-6 w-6" />
              ) : (
                <TrendingDown className="h-6 w-6" />
              )}
            </div>
            
            <div className="text-center py-4">
              <div className="text-5xl font-bold text-white mb-1">
                {dadosMetaProducao.percentual.toFixed(0)}%
              </div>
              <p className="text-white/80 text-sm">
                {dadosMetaProducao.percentual >= 100 
                  ? "🎉 Meta atingida!" 
                  : dadosMetaProducao.percentual >= 80 
                    ? "Quase lá!"
                    : "Continue focado!"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white/20 rounded-lg p-3 text-center">
                <p className="text-white/70 text-xs">Meta</p>
                <p className="text-white font-bold text-lg">
                  {formatCurrency(dadosMetaProducao.totalMeta)}
                </p>
              </div>
              <div className="bg-white/20 rounded-lg p-3 text-center">
                <p className="text-white/70 text-xs">Produzido</p>
                <p className="text-white font-bold text-lg">
                  {formatCurrency(dadosMetaProducao.totalProducao)}
                </p>
              </div>
            </div>

            {dadosMetaProducao.diferenca !== 0 && (
              <div className="mt-3 text-center">
                <span className={cn(
                  "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
                  dadosMetaProducao.diferenca >= 0 ? "bg-white/30" : "bg-black/20"
                )}>
                  {dadosMetaProducao.diferenca >= 0 ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                  <span className="text-white">
                    {formatCurrency(Math.abs(dadosMetaProducao.diferenca))}
                    {dadosMetaProducao.diferenca >= 0 ? " acima" : " faltando"}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Barra de progresso */}
          <div className="p-4 bg-card">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Progresso</span>
              <span>{dadosMetaProducao.diasComMeta} dias com meta</span>
            </div>
            <Progress 
              value={Math.min(dadosMetaProducao.percentual, 100)} 
              className="h-2"
            />
          </div>
        </Card>

        {/* Tabs de navegação */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="resumo" className="text-xs">
              <BarChart3 className="h-4 w-4 mr-1" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="assertividade" className="text-xs">
              <PieChart className="h-4 w-4 mr-1" />
              Assertividade
            </TabsTrigger>
            <TabsTrigger value="diario" className="text-xs">
              <Calendar className="h-4 w-4 mr-1" />
              Diário
            </TabsTrigger>
          </TabsList>

          {/* Tab Resumo */}
          <TabsContent value="resumo" className="mt-4 space-y-4">
            {/* Médias */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Target className="h-4 w-4" />
                  <span className="text-xs">Média Meta/Dia</span>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrency(dadosMetaProducao.mediaMeta)}
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Média Prod./Dia</span>
                </div>
                <p className={cn("text-xl font-bold", getPercentualColor(dadosMetaProducao.percentual))}>
                  {formatCurrency(dadosMetaProducao.mediaProducao)}
                </p>
              </Card>
            </div>

            {/* Estatísticas rápidas */}
            <Card className="p-4">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Estatísticas do Período
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de visitas</span>
                  <span className="font-medium">{dadosAssertividade.totalVisitas}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Dias trabalhados</span>
                  <span className="font-medium">{dadosDiarios.filter(d => d.producao > 0).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor total produzido</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(dadosMetaProducao.totalProducao)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Status */}
            <Card className={cn(
              "p-4",
              dadosMetaProducao.percentual >= 100 
                ? "border-green-200 bg-green-50/50"
                : dadosMetaProducao.percentual >= 80
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-red-200 bg-red-50/50"
            )}>
              <div className="flex items-center gap-3">
                {dadosMetaProducao.percentual >= 100 ? (
                  <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                ) : dadosMetaProducao.percentual >= 80 ? (
                  <div className="h-12 w-12 rounded-full bg-amber-500 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-white" />
                  </div>
                )}
                <div>
                  <p className="font-medium">
                    {dadosMetaProducao.percentual >= 100 
                      ? "Excelente trabalho!"
                      : dadosMetaProducao.percentual >= 80
                        ? "Bom desempenho"
                        : "Atenção necessária"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {dadosMetaProducao.percentual >= 100 
                      ? "Você superou a meta do ciclo!"
                      : `Faltam ${formatCurrency(Math.abs(dadosMetaProducao.diferenca))} para atingir a meta`}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Tab Assertividade */}
          <TabsContent value="assertividade" className="mt-4 space-y-4">
            {/* Card principal de assertividade */}
            <Card className="overflow-hidden border-0 shadow-lg">
              <div className={cn(
                "p-4",
                dadosAssertividade.assertividade >= 90 
                  ? "bg-gradient-to-br from-green-500 to-emerald-600"
                  : dadosAssertividade.assertividade >= 70
                    ? "bg-gradient-to-br from-amber-500 to-orange-600"
                    : "bg-gradient-to-br from-red-500 to-rose-600"
              )}>
                <div className="flex items-center justify-between text-white mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    <span className="font-medium">Assertividade</span>
                  </div>
                </div>
                
                <div className="text-center py-4">
                  <div className="text-5xl font-bold text-white mb-1">
                    {dadosAssertividade.assertividade.toFixed(0)}%
                  </div>
                  <p className="text-white/80 text-sm">
                    de visitas produtivas
                  </p>
                </div>

                <div className="bg-white/20 rounded-lg p-3 text-center">
                  <p className="text-white font-bold text-lg">
                    {dadosAssertividade.executadas} de {dadosAssertividade.totalVisitas}
                  </p>
                  <p className="text-white/70 text-xs">visitas executadas</p>
                </div>
              </div>
            </Card>

            {/* Breakdown por tipo */}
            <Card className="p-4">
              <h3 className="font-medium mb-4">Detalhamento</h3>
              <div className="space-y-4">
                {/* Executadas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="text-sm">Executadas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{dadosAssertividade.executadas}</span>
                      <Badge variant="outline" className="text-green-600">
                        {dadosAssertividade.percentualExecutado.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={dadosAssertividade.percentualExecutado} className="h-2 [&>div]:bg-green-500" />
                </div>

                {/* Impedimentos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500" />
                      <span className="text-sm">Impedimentos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{dadosAssertividade.impedimentos}</span>
                      <Badge variant="outline" className="text-red-600">
                        {dadosAssertividade.percentualImpedimento.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={dadosAssertividade.percentualImpedimento} className="h-2 [&>div]:bg-red-500" />
                </div>

                {/* Parciais */}
                {dadosAssertividade.parciais > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-amber-500" />
                        <span className="text-sm">Parciais</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{dadosAssertividade.parciais}</span>
                        <Badge variant="outline" className="text-amber-600">
                          {dadosAssertividade.percentualParcial.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={dadosAssertividade.percentualParcial} className="h-2 [&>div]:bg-amber-500" />
                  </div>
                )}
              </div>
            </Card>

            {/* Dica */}
            <Card className="p-4 bg-blue-50/50 border-blue-200">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">Dica de Assertividade</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dadosAssertividade.assertividade >= 90 
                      ? "Excelente! Mantenha esse padrão de visitas produtivas."
                      : dadosAssertividade.assertividade >= 70
                        ? "Bom trabalho! Tente reduzir os impedimentos para aumentar a assertividade."
                        : "Atenção aos impedimentos. Verifique se há padrões que possam ser evitados."}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Tab Diário */}
          <TabsContent value="diario" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : dadosDiarios.length === 0 ? (
              <Card className="p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum dado no período selecionado</p>
              </Card>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {dadosDiarios.map((dia) => (
                    <Card 
                      key={dia.dataCompleta} 
                      className={cn(
                        "p-3 transition-all",
                        dia.producao >= dia.meta && dia.meta > 0
                          ? "border-green-200 bg-green-50/30"
                          : dia.producao > 0 && dia.producao < dia.meta
                            ? "border-amber-200 bg-amber-50/30"
                            : ""
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[50px]">
                            <p className="text-lg font-bold">{dia.data.split("/")[0]}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{dia.diaSemana}</p>
                          </div>
                          <div className="h-10 w-px bg-border" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Meta:</span>
                              <span className="font-medium">{formatCurrency(dia.meta)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Prod:</span>
                              <span className={cn("font-medium", getPercentualColor(dia.percentual))}>
                                {formatCurrency(dia.producao)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {dia.meta > 0 && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                dia.percentual >= 100 ? "border-green-500 text-green-700" :
                                dia.percentual >= 80 ? "border-amber-500 text-amber-700" :
                                "border-red-500 text-red-700"
                              )}
                            >
                              {dia.percentual.toFixed(0)}%
                            </Badge>
                          )}
                          {dia.producao >= dia.meta && dia.meta > 0 ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : dia.producao > 0 ? (
                            <Minus className="h-5 w-5 text-muted-foreground" />
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Botão de logout no rodapé */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <Button 
          variant="outline" 
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          Sair da Conta
        </Button>
      </div>
    </div>
  );
}

