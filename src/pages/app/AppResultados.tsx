import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData } from "@/hooks/useOfflineData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Award,
  Calendar,
  DollarSign,
  Activity,
  RefreshCw,
  Loader2,
  BarChart3,
  PieChart,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, eachDayOfInterval, parseISO, subMonths, setDate, getDate, addMonths, isAfter, isBefore, isEqual } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Função para calcular período do ciclo (26 a 25) com offset de meses
const calcularPeriodoCiclo = (dataRef: Date = new Date(), offsetMeses: number = 0) => {
  // Aplicar offset de meses
  let dataAjustada = dataRef;
  if (offsetMeses !== 0) {
    dataAjustada = offsetMeses > 0 ? addMonths(dataRef, offsetMeses) : subMonths(dataRef, Math.abs(offsetMeses));
  }
  
  const diaAtual = getDate(dataAjustada);
  
  let inicio: Date;
  let fim: Date;
  
  if (diaAtual >= 26) {
    inicio = setDate(dataAjustada, 26);
    fim = setDate(addMonths(dataAjustada, 1), 25);
  } else {
    inicio = setDate(subMonths(dataAjustada, 1), 26);
    fim = setDate(dataAjustada, 25);
  }
  
  return {
    inicio: format(inicio, "yyyy-MM-dd"),
    fim: format(fim, "yyyy-MM-dd"),
    inicioDate: inicio,
    fimDate: fim,
  };
};

// Função para calcular período até hoje (ou fim do ciclo se for ciclo passado)
const calcularPeriodoAteHoje = (dataRef: Date = new Date(), offsetMeses: number = 0) => {
  const ciclo = calcularPeriodoCiclo(dataRef, offsetMeses);
  const hoje = new Date();
  
  // Se o ciclo é do passado, mostrar até o fim do ciclo
  if (isBefore(parseISO(ciclo.fim), hoje)) {
    return {
      inicio: ciclo.inicio,
      fim: ciclo.fim,
    };
  }
  
  // Senão, mostrar até hoje
  return {
    inicio: ciclo.inicio,
    fim: format(hoje, "yyyy-MM-dd"),
  };
};

export default function AppResultados() {
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe, isLoading: isLoadingEquipe, refetch: refetchEquipe } = useTecnico();
  const { isOnline } = useOfflineSyncContext();
  const { getMetasCicloFromCache, getProducoesCicloFromCache } = useOfflineData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("resumo");
  const [filtroTipoServico, setFiltroTipoServico] = useState("todos");
  const [cicloOffset, setCicloOffset] = useState(0); // 0 = atual, -1 = anterior, etc.

  // Períodos (com offset do ciclo)
  const periodoCiclo = calcularPeriodoCiclo(new Date(), cicloOffset);
  const periodoAteHoje = calcularPeriodoAteHoje(new Date(), cicloOffset);
  
  // Verificar se é ciclo atual
  const isCicloAtual = cicloOffset === 0;
  const hoje = new Date();
  const isCicloPassado = isBefore(parseISO(periodoCiclo.fim), hoje);
  
  // Usar período do ciclo completo para busca de dados
  const dataInicio = periodoCiclo.inicio;
  const dataFim = periodoCiclo.fim;
  const dataHoje = format(new Date(), "yyyy-MM-dd");

  // Funções de navegação de ciclo
  const irCicloAnterior = () => setCicloOffset(prev => prev - 1);
  const irProximoCiclo = () => setCicloOffset(prev => prev + 1);
  const irCicloAtual = () => setCicloOffset(0);

  // Buscar metas da equipe
  const { data: metas, isLoading: isLoadingMetas, refetch: refetchMetas } = useQuery({
    queryKey: ["metas-equipe", equipe?.id, dataInicio, dataFim, cicloOffset, isOnline],
    queryFn: async () => {
      if (!equipe?.id) return [];
      
      // Se offline, buscar do cache
      if (!isOnline) {
        const cached = await getMetasCicloFromCache(equipe.id, dataInicio, dataFim);
        if (cached) {
          console.log("[Resultados] Usando cache offline de metas:", cached.length);
          return cached as any[];
        }
        return [];
      }
      
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
    queryKey: ["producoes-equipe", equipe?.id, dataInicio, dataFim, cicloOffset, isOnline],
    queryFn: async () => {
      if (!equipe?.id) return [];
      
      // Se offline, buscar do cache
      if (!isOnline) {
        const cached = await getProducoesCicloFromCache(equipe.id, dataInicio, dataFim);
        if (cached) {
          console.log("[Resultados] Usando cache offline de produções:", cached.length);
          return cached as any[];
        }
        return [];
      }
      
      const { data, error } = await supabase
        .from("producao_equipes")
        .select(`
          *,
          retornos_campo:retorno_campo_id (id, codigo, descricao, tipo),
          ordens_servico:ordem_servico_id (tipo)
        `)
        .eq("equipe_id", equipe.id)
        .gte("created_at", dataInicio + "T00:00:00")
        .lte("created_at", dataFim + "T23:59:59");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!equipe?.id,
  });

  // Tipos de serviço únicos
  const tiposServico = useMemo(() => {
    const tipos = new Set<string>();
    producoes?.forEach(p => {
      if (p.ordens_servico?.tipo) {
        tipos.add(p.ordens_servico.tipo);
      }
    });
    return Array.from(tipos).sort();
  }, [producoes]);

  // Produções filtradas por tipo
  const producoesFiltradas = useMemo(() => {
    if (filtroTipoServico === "todos") return producoes || [];
    return (producoes || []).filter(p => p.ordens_servico?.tipo === filtroTipoServico);
  }, [producoes, filtroTipoServico]);

  // Calcular dados para um período específico
  const calcularDadosPeriodo = (inicio: string, fim: string) => {
    const metasPeriodo = metas?.filter(m => m.data >= inicio && m.data <= fim) || [];
    const producoesPeriodo = producoesFiltradas.filter(p => {
      const dataProducao = p.created_at.substring(0, 10);
      return dataProducao >= inicio && dataProducao <= fim;
    });
    
    const totalMeta = metasPeriodo.reduce((acc, m) => acc + (m.valor_meta || 0), 0);
    const totalProducao = producoesPeriodo.reduce((acc, p) => acc + (p.valor_total || 0), 0);
    const percentual = totalMeta > 0 ? (totalProducao / totalMeta) * 100 : (totalProducao > 0 ? 100 : 0);
    const diferenca = totalProducao - totalMeta;
    const diasComMeta = metasPeriodo.length;
    
    return {
      totalMeta,
      totalProducao,
      percentual,
      diferenca,
      diasComMeta,
      mediaMeta: diasComMeta > 0 ? totalMeta / diasComMeta : 0,
      mediaProducao: diasComMeta > 0 ? totalProducao / diasComMeta : 0,
    };
  };

  // Dados até hoje (foco principal)
  const dadosAteHoje = useMemo(() => {
    return calcularDadosPeriodo(periodoAteHoje.inicio, periodoAteHoje.fim);
  }, [metas, producoesFiltradas, periodoAteHoje]);

  // Dados do ciclo completo
  const dadosCiclo = useMemo(() => {
    return calcularDadosPeriodo(periodoCiclo.inicio, periodoCiclo.fim);
  }, [metas, producoesFiltradas, periodoCiclo]);

  // Calcular dados de assertividade
  const dadosAssertividade = useMemo(() => {
    const producoesPeriodo = producoesFiltradas.filter(p => {
      const dataProducao = p.created_at.substring(0, 10);
      return dataProducao >= periodoAteHoje.inicio && dataProducao <= periodoAteHoje.fim;
    });
    
    const totalVisitas = producoesPeriodo.length;
    const executadas = producoesPeriodo.filter(p => p.retornos_campo?.tipo === "executado").length;
    const impedimentos = producoesPeriodo.filter(p => p.retornos_campo?.tipo === "impedimento").length;
    const semRetorno = totalVisitas - executadas - impedimentos;
    
    const percentualExecutado = totalVisitas > 0 ? (executadas / totalVisitas) * 100 : 0;
    const percentualImpedimento = totalVisitas > 0 ? (impedimentos / totalVisitas) * 100 : 0;
    
    // Por tipo de serviço
    const porTipo: Record<string, { total: number; executadas: number; impedimentos: number }> = {};
    producoesPeriodo.forEach(p => {
      const tipo = p.ordens_servico?.tipo || "outros";
      if (!porTipo[tipo]) {
        porTipo[tipo] = { total: 0, executadas: 0, impedimentos: 0 };
      }
      porTipo[tipo].total++;
      if (p.retornos_campo?.tipo === "executado") porTipo[tipo].executadas++;
      if (p.retornos_campo?.tipo === "impedimento") porTipo[tipo].impedimentos++;
    });
    
    const assertividadePorTipo = Object.entries(porTipo).map(([tipo, dados]) => ({
      tipo,
      ...dados,
      assertividade: dados.total > 0 ? (dados.executadas / dados.total) * 100 : 0,
    })).sort((a, b) => b.assertividade - a.assertividade);
    
    return {
      totalVisitas,
      executadas,
      impedimentos,
      semRetorno,
      percentualExecutado,
      percentualImpedimento,
      assertividade: percentualExecutado,
      porTipo: assertividadePorTipo,
    };
  }, [producoesFiltradas, periodoAteHoje]);

  // Dados por dia (incluindo dias sem meta)
  const dadosDiarios = useMemo(() => {
    const dias = eachDayOfInterval({
      start: parseISO(dataInicio),
      end: parseISO(dataFim),
    });

    const hoje = new Date();

    return dias.map(dia => {
      const dataStr = format(dia, "yyyy-MM-dd");
      const metaDia = metas?.find(m => m.data === dataStr)?.valor_meta || 0;
      const producoesDia = producoesFiltradas.filter(p => p.created_at.startsWith(dataStr));
      const producaoDia = producoesDia.reduce((acc, p) => acc + (p.valor_total || 0), 0);
      const isFuturo = isAfter(dia, hoje);
      const isHoje = format(hoje, "yyyy-MM-dd") === dataStr;
      
      return {
        data: format(dia, "dd/MM"),
        dataCompleta: dataStr,
        diaSemana: format(dia, "EEE", { locale: ptBR }),
        meta: metaDia,
        producao: producaoDia,
        percentual: metaDia > 0 ? (producaoDia / metaDia) * 100 : (producaoDia > 0 ? 100 : 0),
        isFuturo,
        isHoje,
        temMeta: metaDia > 0,
        temProducao: producaoDia > 0,
      };
    });
  }, [dataInicio, dataFim, metas, producoesFiltradas]);

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
      {/* Header com navegação de ciclo */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        {/* Título e botão de refresh */}
        <div className="flex items-center justify-between px-4 py-2">
          <h1 className="text-lg font-bold">Meus Resultados</h1>
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

        {/* Navegação de Ciclo - Em destaque */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 px-4 py-3 border-t">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={irCicloAnterior}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">
                  {format(parseISO(periodoCiclo.inicio), "dd/MM/yy")} - {format(parseISO(periodoCiclo.fim), "dd/MM/yy")}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-1">
                {isCicloAtual ? (
                  <Badge className="text-[10px] h-5 bg-primary">Ciclo Atual</Badge>
                ) : isCicloPassado ? (
                  <Badge variant="secondary" className="text-[10px] h-5">Ciclo Encerrado</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-5">Ciclo Futuro</Badge>
                )}
                {!isCicloAtual && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={irCicloAtual}
                    className="h-5 px-1 text-[10px] text-primary"
                  >
                    Ir para atual
                  </Button>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={irProximoCiclo}
              className="h-8 px-2"
              disabled={cicloOffset >= 0} // Não permitir ir para o futuro além do atual
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-4 space-y-4 pb-24">
        {/* Tabs de navegação */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="resumo" className="text-xs">
              <BarChart3 className="h-4 w-4 mr-1" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="diario" className="text-xs">
              <Calendar className="h-4 w-4 mr-1" />
              Diário
            </TabsTrigger>
            <TabsTrigger value="assertividade" className="text-xs">
              <Zap className="h-4 w-4 mr-1" />
              Assertividade
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
                  {formatCurrency(dadosAteHoje.mediaMeta)}
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Média Prod./Dia</span>
                </div>
                <p className={cn("text-xl font-bold", getPercentualColor(dadosAteHoje.percentual))}>
                  {formatCurrency(dadosAteHoje.mediaProducao)}
                </p>
              </Card>
            </div>

            {/* Estatísticas rápidas */}
            <Card className="p-4">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Estatísticas até Hoje
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de visitas</span>
                  <span className="font-medium">{dadosAssertividade.totalVisitas}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Dias trabalhados</span>
                  <span className="font-medium">{dadosDiarios.filter(d => d.temProducao && !d.isFuturo).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor total produzido</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(dadosAteHoje.totalProducao)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Status */}
            <Card className={cn(
              "p-4",
              dadosAteHoje.percentual >= 100 
                ? "border-green-200 bg-green-50/50"
                : dadosAteHoje.percentual >= 80
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-red-200 bg-red-50/50"
            )}>
              <div className="flex items-center gap-3">
                {dadosAteHoje.percentual >= 100 ? (
                  <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                ) : dadosAteHoje.percentual >= 80 ? (
                  <div className="h-12 w-12 rounded-full bg-amber-500 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-white" />
                  </div>
                )}
                <div>
                  <p className="font-medium">
                    {dadosAteHoje.percentual >= 100 
                      ? "Excelente trabalho!"
                      : dadosAteHoje.percentual >= 80
                        ? "Bom desempenho"
                        : "Atenção necessária"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {dadosAteHoje.percentual >= 100 
                      ? "Você superou a meta até hoje!"
                      : `Faltam ${formatCurrency(Math.abs(dadosAteHoje.diferenca))} para atingir a meta`}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Tab Assertividade */}
          <TabsContent value="assertividade" className="mt-4 space-y-4">
            {/* Filtro por tipo de serviço */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filtroTipoServico} onValueChange={setFiltroTipoServico}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Tipo de Serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  {tiposServico.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>{tipo.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              </div>
            </Card>

            {/* Assertividade por Tipo de Serviço */}
            {dadosAssertividade.porTipo.length > 0 && (
              <Card className="p-4">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Por Tipo de Serviço
                </h3>
                <div className="space-y-3">
                  {dadosAssertividade.porTipo.map(item => (
                    <div key={item.tipo} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.tipo.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.executadas}/{item.total}
                        </span>
                      </div>
                      <span className={cn(
                        "font-medium text-sm",
                        item.assertividade >= 90 ? "text-green-600" :
                        item.assertividade >= 70 ? "text-amber-600" : "text-red-600"
                      )}>
                        {item.assertividade.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
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
                  {dadosDiarios.filter(d => !d.isFuturo).reverse().map((dia) => (
                    <Card 
                      key={dia.dataCompleta} 
                      className={cn(
                        "p-3 transition-all",
                        dia.isHoje && "ring-2 ring-primary",
                        dia.temProducao && dia.producao >= dia.meta && dia.temMeta
                          ? "border-green-200 bg-green-50/30"
                          : dia.temProducao && dia.producao < dia.meta
                            ? "border-amber-200 bg-amber-50/30"
                            : !dia.temMeta && dia.temProducao
                              ? "border-blue-200 bg-blue-50/30"
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
                              <span className={cn("font-medium", !dia.temMeta && "text-muted-foreground")}>
                                {dia.temMeta ? formatCurrency(dia.meta) : "Sem meta"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Prod:</span>
                              <span className={cn(
                                "font-medium",
                                dia.temProducao ? getPercentualColor(dia.percentual) : "text-muted-foreground"
                              )}>
                                {dia.temProducao ? formatCurrency(dia.producao) : "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {dia.isHoje && (
                            <Badge className="text-xs">Hoje</Badge>
                          )}
                          {!dia.temMeta && dia.temProducao && (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                              Extra
                            </Badge>
                          )}
                          {dia.temMeta && (
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
                          {dia.temProducao && dia.producao >= dia.meta && dia.temMeta ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : dia.temProducao ? (
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

    </div>
  );
}
