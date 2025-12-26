import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  RefreshCcw,
  Loader2,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart,
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  Download,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, getDay, subMonths, setDate, getDate, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import * as XLSX from "xlsx";

interface Meta {
  id: string;
  equipe_id: string;
  data: string;
  valor_meta: number;
}

interface Producao {
  id: string;
  equipe_id: string;
  ordem_servico_id: string;
  valor_total: number;
  created_at: string;
}

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  centro_custo_id?: string;
  tipo_equipe?: string;
}

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
}

const CORES = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const tipoEquipeLabels: Record<string, { label: string; color: string }> = {
  normal: { label: "Normal", color: "#6b7280" },
  gaviao: { label: "Gavião", color: "#f97316" },
  kit: { label: "Kit", color: "#8b5cf6" },
};

// Função para calcular o período padrão (26 do mês até 25 do próximo)
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

export default function DashboardProducaoMeta() {
  const [loading, setLoading] = useState(true);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [producoes, setProducoes] = useState<Producao[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);

  // Filtros
  const periodoPadrao = calcularPeriodoPadrao();
  const [dataInicio, setDataInicio] = useState(periodoPadrao.inicio);
  const [dataFim, setDataFim] = useState(periodoPadrao.fim);
  const [filtroCentroCusto, setFiltroCentroCusto] = useState("todos");
  const [filtroTipoEquipe, setFiltroTipoEquipe] = useState("todos");
  const [filtroEquipe, setFiltroEquipe] = useState("todos");

  // Tab ativa
  const [activeTab, setActiveTab] = useState("visao-geral");

  // Buscar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const [metasRes, producaoRes, equipesRes, centrosRes] = await Promise.all([
        supabase.from("metas").select("*").gte("data", dataInicio).lte("data", dataFim),
        supabase.from("producao_equipes").select("*").gte("created_at", dataInicio + "T00:00:00").lte("created_at", dataFim + "T23:59:59"),
        supabase.from("tecnicos").select("id, codigo, nome, centro_custo_id, tipo_equipe").neq("status", "offline").order("codigo"),
        supabase.from("centros_custo").select("id, codigo, nome").order("codigo"),
      ]);

      if (metasRes.error) throw metasRes.error;
      if (producaoRes.error) throw producaoRes.error;
      if (equipesRes.error) throw equipesRes.error;

      setMetas(metasRes.data || []);
      setProducoes(producaoRes.data || []);
      setEquipes(equipesRes.data || []);
      setCentrosCusto(centrosRes.data || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dataInicio, dataFim]);

  // Equipes filtradas
  const equipesFiltradas = useMemo(() => {
    let filtered = equipes;
    if (filtroCentroCusto !== "todos") {
      filtered = filtered.filter(e => e.centro_custo_id === filtroCentroCusto);
    }
    if (filtroTipoEquipe !== "todos") {
      filtered = filtered.filter(e => e.tipo_equipe === filtroTipoEquipe);
    }
    if (filtroEquipe !== "todos") {
      filtered = filtered.filter(e => e.id === filtroEquipe);
    }
    return filtered;
  }, [equipes, filtroCentroCusto, filtroTipoEquipe, filtroEquipe]);

  // Dados calculados por equipe
  const dadosPorEquipe = useMemo(() => {
    const equipeIds = new Set(equipesFiltradas.map(e => e.id));
    
    return equipesFiltradas.map(equipe => {
      const metasEquipe = metas.filter(m => m.equipe_id === equipe.id);
      const producaoEquipe = producoes.filter(p => p.equipe_id === equipe.id);
      
      const totalMeta = metasEquipe.reduce((acc, m) => acc + (m.valor_meta || 0), 0);
      const totalProducao = producaoEquipe.reduce((acc, p) => acc + (p.valor_total || 0), 0);
      const percentual = totalMeta > 0 ? (totalProducao / totalMeta) * 100 : 0;
      const diferenca = totalProducao - totalMeta;
      
      return {
        equipe,
        totalMeta,
        totalProducao,
        percentual,
        diferenca,
        diasComMeta: metasEquipe.length,
        osExecutadas: producaoEquipe.length,
      };
    }).sort((a, b) => b.percentual - a.percentual);
  }, [equipesFiltradas, metas, producoes]);

  // KPIs gerais
  const kpis = useMemo(() => {
    const totalMeta = dadosPorEquipe.reduce((acc, d) => acc + d.totalMeta, 0);
    const totalProducao = dadosPorEquipe.reduce((acc, d) => acc + d.totalProducao, 0);
    const percentualGeral = totalMeta > 0 ? (totalProducao / totalMeta) * 100 : 0;
    
    const equipesAcimaMeta = dadosPorEquipe.filter(d => d.percentual >= 100).length;
    const equipesAbaixoMeta = dadosPorEquipe.filter(d => d.percentual < 100 && d.totalMeta > 0).length;
    const equipesEmRisco = dadosPorEquipe.filter(d => d.percentual < 80 && d.totalMeta > 0).length;
    
    const melhorEquipe = dadosPorEquipe[0];
    const piorEquipe = dadosPorEquipe.filter(d => d.totalMeta > 0).slice(-1)[0];
    
    return {
      totalMeta,
      totalProducao,
      percentualGeral,
      equipesAcimaMeta,
      equipesAbaixoMeta,
      equipesEmRisco,
      totalEquipes: equipesFiltradas.length,
      melhorEquipe,
      piorEquipe,
      diferenca: totalProducao - totalMeta,
    };
  }, [dadosPorEquipe, equipesFiltradas]);

  // Dados para gráfico de evolução diária
  const dadosEvolucaoDiaria = useMemo(() => {
    const dias = eachDayOfInterval({
      start: parseISO(dataInicio),
      end: parseISO(dataFim),
    });

    const equipeIds = new Set(equipesFiltradas.map(e => e.id));

    return dias.map(dia => {
      const dataStr = format(dia, "yyyy-MM-dd");
      const metaDia = metas
        .filter(m => m.data === dataStr && equipeIds.has(m.equipe_id))
        .reduce((acc, m) => acc + (m.valor_meta || 0), 0);
      
      const producaoDia = producoes
        .filter(p => p.created_at.startsWith(dataStr) && equipeIds.has(p.equipe_id))
        .reduce((acc, p) => acc + (p.valor_total || 0), 0);
      
      return {
        data: format(dia, "dd/MM"),
        dataCompleta: dataStr,
        meta: metaDia,
        producao: producaoDia,
        percentual: metaDia > 0 ? (producaoDia / metaDia) * 100 : 0,
      };
    });
  }, [dataInicio, dataFim, metas, producoes, equipesFiltradas]);

  // Dados acumulados
  const dadosAcumulados = useMemo(() => {
    let metaAcum = 0;
    let prodAcum = 0;
    
    return dadosEvolucaoDiaria.map(d => {
      metaAcum += d.meta;
      prodAcum += d.producao;
      return {
        ...d,
        metaAcumulada: metaAcum,
        producaoAcumulada: prodAcum,
        percentualAcumulado: metaAcum > 0 ? (prodAcum / metaAcum) * 100 : 0,
      };
    });
  }, [dadosEvolucaoDiaria]);

  // Dados por tipo de equipe
  const dadosPorTipo = useMemo(() => {
    const tipos: Record<string, { meta: number; producao: number; count: number }> = {};
    
    dadosPorEquipe.forEach(d => {
      const tipo = d.equipe.tipo_equipe || "normal";
      if (!tipos[tipo]) {
        tipos[tipo] = { meta: 0, producao: 0, count: 0 };
      }
      tipos[tipo].meta += d.totalMeta;
      tipos[tipo].producao += d.totalProducao;
      tipos[tipo].count++;
    });
    
    return Object.entries(tipos).map(([tipo, dados]) => ({
      tipo,
      label: tipoEquipeLabels[tipo]?.label || tipo,
      color: tipoEquipeLabels[tipo]?.color || "#6b7280",
      ...dados,
      percentual: dados.meta > 0 ? (dados.producao / dados.meta) * 100 : 0,
    }));
  }, [dadosPorEquipe]);

  // Exportar dados
  const handleExportar = () => {
    try {
      const dadosExport = dadosPorEquipe.map(d => ({
        "Equipe": d.equipe.codigo,
        "Nome": d.equipe.nome,
        "Tipo": tipoEquipeLabels[d.equipe.tipo_equipe || "normal"]?.label || d.equipe.tipo_equipe,
        "Meta (R$)": d.totalMeta,
        "Produção (R$)": d.totalProducao,
        "Diferença (R$)": d.diferenca,
        "% Atingimento": d.percentual.toFixed(1) + "%",
        "OSs Executadas": d.osExecutadas,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExport);
      XLSX.utils.book_append_sheet(wb, ws, "Produção x Meta");
      XLSX.writeFile(wb, `Producao_Meta_${dataInicio}_${dataFim}.xlsx`);
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar dados");
    }
  };

  const formatCurrency = (value: number) => 
    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <MainLayout
      title="Dashboard Produção x Meta"
      subtitle="Acompanhe o desempenho das equipes em relação às metas"
      breadcrumbs={[
        { label: "Dashboard" },
        { label: "Produção x Meta" },
      ]}
    >
      {/* Filtros */}
      <div className="flex items-center gap-2 mb-3 p-2 rounded-lg border bg-card flex-wrap">
        <Filter className="h-3 w-3 text-muted-foreground" />
        
        <Input
          type="date"
          value={dataInicio}
          onChange={e => setDataInicio(e.target.value)}
          className="h-7 w-[115px] text-xs"
        />
        <span className="text-xs text-muted-foreground">-</span>
        <Input
          type="date"
          value={dataFim}
          onChange={e => setDataFim(e.target.value)}
          className="h-7 w-[115px] text-xs"
        />

        <Select value={filtroCentroCusto} onValueChange={setFiltroCentroCusto}>
          <SelectTrigger className="h-7 w-[100px] text-xs">
            <SelectValue placeholder="C.Custo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {centrosCusto.map(cc => (
              <SelectItem key={cc.id} value={cc.id}>{cc.codigo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroTipoEquipe} onValueChange={setFiltroTipoEquipe}>
          <SelectTrigger className="h-7 w-[90px] text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(tipoEquipeLabels).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
          <SelectTrigger className="h-7 w-[90px] text-xs">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {equipes.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.codigo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="h-7 px-2" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
        </Button>

        <Button variant="outline" size="sm" className="h-7 px-2 ml-auto" onClick={handleExportar}>
          <Download className="h-3 w-3" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="visao-geral" className="text-xs">
              <BarChart3 className="h-4 w-4 mr-1" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="text-xs">
              <Activity className="h-4 w-4 mr-1" /> Evolução
            </TabsTrigger>
            <TabsTrigger value="ranking" className="text-xs">
              <Award className="h-4 w-4 mr-1" /> Ranking
            </TabsTrigger>
            <TabsTrigger value="analise" className="text-xs">
              <PieChart className="h-4 w-4 mr-1" /> Análise
            </TabsTrigger>
          </TabsList>

          {/* Tab Visão Geral */}
          <TabsContent value="visao-geral" className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Meta Total</span>
                  </div>
                  <div className="text-xl font-bold">{formatCurrency(kpis.totalMeta)}</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Produção Total</span>
                  </div>
                  <div className="text-xl font-bold text-green-600">{formatCurrency(kpis.totalProducao)}</div>
                </CardContent>
              </Card>

              <Card className={cn(
                "bg-gradient-to-br",
                kpis.percentualGeral >= 100 ? "from-green-500/10 to-green-600/5" :
                kpis.percentualGeral >= 80 ? "from-yellow-500/10 to-yellow-600/5" :
                "from-red-500/10 to-red-600/5"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {kpis.percentualGeral >= 100 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs text-muted-foreground">% Atingimento</span>
                  </div>
                  <div className={cn(
                    "text-xl font-bold",
                    kpis.percentualGeral >= 100 ? "text-green-600" :
                    kpis.percentualGeral >= 80 ? "text-yellow-600" : "text-red-600"
                  )}>
                    {kpis.percentualGeral.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Acima da Meta</span>
                  </div>
                  <div className="text-xl font-bold text-green-600">{kpis.equipesAcimaMeta}</div>
                  <div className="text-[10px] text-muted-foreground">equipes</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs text-muted-foreground">Abaixo da Meta</span>
                  </div>
                  <div className="text-xl font-bold text-yellow-600">{kpis.equipesAbaixoMeta}</div>
                  <div className="text-[10px] text-muted-foreground">equipes</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-muted-foreground">Em Risco (&lt;80%)</span>
                  </div>
                  <div className="text-xl font-bold text-red-600">{kpis.equipesEmRisco}</div>
                  <div className="text-[10px] text-muted-foreground">equipes</div>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico Meta x Produção por Equipe */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Meta x Produção por Equipe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosPorEquipe.slice(0, 15)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="equipe.codigo" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Equipe: ${label}`}
                      />
                      <Legend />
                      <Bar dataKey="totalMeta" name="Meta" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="totalProducao" name="Produção" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Cards de Destaque */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpis.melhorEquipe && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="h-4 w-4 text-green-600" />
                      Melhor Desempenho
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold">{kpis.melhorEquipe.equipe.codigo}</div>
                        <div className="text-xs text-muted-foreground">{kpis.melhorEquipe.equipe.nome}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">{kpis.melhorEquipe.percentual.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(kpis.melhorEquipe.totalProducao)} / {formatCurrency(kpis.melhorEquipe.totalMeta)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {kpis.piorEquipe && (
                <Card className="border-red-200 bg-red-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      Precisa de Atenção
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold">{kpis.piorEquipe.equipe.codigo}</div>
                        <div className="text-xs text-muted-foreground">{kpis.piorEquipe.equipe.nome}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">{kpis.piorEquipe.percentual.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(kpis.piorEquipe.totalProducao)} / {formatCurrency(kpis.piorEquipe.totalMeta)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Tab Evolução */}
          <TabsContent value="evolucao" className="space-y-4">
            {/* Evolução Diária */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Evolução Diária - Meta x Produção</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dadosEvolucaoDiaria} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="meta" name="Meta" fill="#3b82f6" opacity={0.7} />
                      <Bar dataKey="producao" name="Produção" fill="#10b981" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Evolução Acumulada */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Evolução Acumulada</CardTitle>
                <CardDescription className="text-xs">Meta e Produção acumuladas no período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dadosAcumulados} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="metaAcumulada" 
                        name="Meta Acumulada" 
                        stroke="#3b82f6" 
                        fill="#3b82f6" 
                        fillOpacity={0.2} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="producaoAcumulada" 
                        name="Produção Acumulada" 
                        stroke="#10b981" 
                        fill="#10b981" 
                        fillOpacity={0.4} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* % Atingimento Diário */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">% Atingimento Diário</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosEvolucaoDiaria} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Line 
                        type="monotone" 
                        dataKey="percentual" 
                        name="% Atingimento" 
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        dot={{ fill: "#8b5cf6", strokeWidth: 2 }}
                      />
                      {/* Linha de referência 100% */}
                      <Line 
                        type="monotone" 
                        dataKey={() => 100} 
                        name="Meta 100%" 
                        stroke="#ef4444" 
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Ranking */}
          <TabsContent value="ranking" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ranking de Equipes por Atingimento</CardTitle>
                <CardDescription className="text-xs">Ordenado do maior para o menor percentual de atingimento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Meta</TableHead>
                        <TableHead className="text-right">Produção</TableHead>
                        <TableHead className="text-right">Diferença</TableHead>
                        <TableHead className="text-right">% Ating.</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosPorEquipe.map((d, idx) => (
                        <TableRow key={d.equipe.id} className={cn(
                          idx === 0 && "bg-green-50",
                          d.percentual < 80 && d.totalMeta > 0 && "bg-red-50"
                        )}>
                          <TableCell className="font-bold">
                            {idx === 0 && <Award className="h-4 w-4 text-yellow-500 inline mr-1" />}
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{d.equipe.codigo}</div>
                            <div className="text-xs text-muted-foreground">{d.equipe.nome}</div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              style={{ backgroundColor: tipoEquipeLabels[d.equipe.tipo_equipe || "normal"]?.color }}
                              className="text-white text-[10px]"
                            >
                              {tipoEquipeLabels[d.equipe.tipo_equipe || "normal"]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(d.totalMeta)}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(d.totalProducao)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            d.diferenca >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {d.diferenca >= 0 ? "+" : ""}{formatCurrency(d.diferenca)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-bold",
                              d.percentual >= 100 ? "text-green-600" :
                              d.percentual >= 80 ? "text-yellow-600" : "text-red-600"
                            )}>
                              {d.percentual.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {d.percentual >= 100 ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                            ) : d.percentual >= 80 ? (
                              <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto" />
                            ) : d.totalMeta > 0 ? (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            ) : (
                              <Minus className="h-5 w-5 text-gray-300 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Análise */}
          <TabsContent value="analise" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Por Tipo de Equipe */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Desempenho por Tipo de Equipe</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dadosPorTipo} layout="vertical" margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={50} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="meta" name="Meta" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="producao" name="Produção" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Distribuição de Atingimento */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Distribuição de Atingimento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { name: "Acima de 100%", value: kpis.equipesAcimaMeta, color: "#10b981" },
                            { name: "80% - 100%", value: kpis.equipesAbaixoMeta - kpis.equipesEmRisco, color: "#f59e0b" },
                            { name: "Abaixo de 80%", value: kpis.equipesEmRisco, color: "#ef4444" },
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {[
                            { name: "Acima de 100%", value: kpis.equipesAcimaMeta, color: "#10b981" },
                            { name: "80% - 100%", value: kpis.equipesAbaixoMeta - kpis.equipesEmRisco, color: "#f59e0b" },
                            { name: "Abaixo de 80%", value: kpis.equipesEmRisco, color: "#ef4444" },
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Resumo por Tipo */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Resumo por Tipo de Equipe</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {dadosPorTipo.map(tipo => (
                      <div 
                        key={tipo.tipo}
                        className="p-4 rounded-lg border"
                        style={{ borderLeftColor: tipo.color, borderLeftWidth: 4 }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Badge style={{ backgroundColor: tipo.color }} className="text-white">
                            {tipo.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{tipo.count} equipes</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Meta:</span>
                            <span className="font-medium">{formatCurrency(tipo.meta)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Produção:</span>
                            <span className="font-medium text-green-600">{formatCurrency(tipo.producao)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Atingimento:</span>
                            <span className={cn(
                              "font-bold",
                              tipo.percentual >= 100 ? "text-green-600" :
                              tipo.percentual >= 80 ? "text-yellow-600" : "text-red-600"
                            )}>
                              {tipo.percentual.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </MainLayout>
  );
}

