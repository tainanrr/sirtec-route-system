import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Timer,
  Coffee,
  Truck,
  Play,
  Users,
  RefreshCcw,
  Loader2,
  Award,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  PieChart,
  Activity,
  ArrowUp,
  ArrowDown,
  Download,
  Search,
  ChevronDown,
  X,
  Filter,
  TrendingUp,
  TrendingDown,
  Target,
  Pause,
  ClipboardCheck,
  Zap,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subMonths, setDate, getDate, addMonths, eachDayOfInterval, parseISO, differenceInMinutes } from "date-fns";
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
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar,
} from "recharts";
import * as XLSX from "xlsx";

interface Turno {
  id: string;
  equipe_id: string;
  hora_inicio: string;
  hora_fim: string | null;
  status: string;
  tecnicos?: {
    id: string;
    codigo: string;
    nome: string;
    tipo_equipe?: string;
    centro_custo_id?: string;
  };
}

interface Intervalo {
  id: string;
  turno_id: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo_intervalo?: {
    nome: string;
    tipo: string;
  };
}

interface ProducaoOS {
  id: string;
  equipe_id: string;
  ordem_servico_id: string;
  created_at: string;
  ordens_servico?: {
    id: string;
    deslocamento_iniciado_at?: string;
    chegada_local_at?: string;
    execucao_iniciada_at?: string;
    concluido_at?: string;
  };
}

interface ChecklistResposta {
  id: string;
  equipe_id: string;
  created_at: string;
  checklists?: {
    tipo: string;
  };
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

interface TempoTurno {
  turnoId: string;
  equipeId: string;
  equipeCodigo: string;
  equipeNome: string;
  tipoEquipe: string;
  centroCustoId: string;
  data: string;
  tempoTotal: number;
  tempoDeslocamento: number;
  tempoExecucao: number;
  tempoIntervalo: number;
  tempoAPR: number;
  tempoOcioso: number;
  percentualOcioso: number;
  percentualProdutivo: number;
  qtdOSs: number;
  status: string;
}

const CORES = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const CORES_TEMPO = {
  execucao: "#10b981",
  deslocamento: "#3b82f6",
  intervalo: "#f59e0b",
  apr: "#8b5cf6",
  ocioso: "#ef4444",
};

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

// Formatar minutos para exibição
const formatarTempo = (minutos: number): string => {
  if (minutos < 0) minutos = 0;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h > 0) {
    return `${h}h ${m}min`;
  }
  return `${m}min`;
};

export default function DashboardTempoOcioso() {
  const [loading, setLoading] = useState(true);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [intervalos, setIntervalos] = useState<Intervalo[]>([]);
  const [producoes, setProducoes] = useState<ProducaoOS[]>([]);
  const [checklists, setChecklists] = useState<ChecklistResposta[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);

  // Filtros
  const periodoPadrao = calcularPeriodoPadrao();
  const [dataInicio, setDataInicio] = useState(periodoPadrao.inicio);
  const [dataFim, setDataFim] = useState(periodoPadrao.fim);
  const [filtrosCentroCusto, setFiltrosCentroCusto] = useState<string[]>([]);
  const [filtrosTipoEquipe, setFiltrosTipoEquipe] = useState<string[]>([]);
  const [filtrosEquipe, setFiltrosEquipe] = useState<string[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("all");
  
  // Busca nos filtros
  const [buscaCentroCusto, setBuscaCentroCusto] = useState("");
  const [buscaEquipe, setBuscaEquipe] = useState("");

  // Carregar dados
  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar equipes e centros de custo
      const [equipesRes, centrosRes] = await Promise.all([
        supabase.from("tecnicos").select("id, codigo, nome, centro_custo_id, tipo_equipe").eq("ativo", true),
        supabase.from("centros_custo").select("id, codigo, nome").eq("ativo", true),
      ]);

      if (equipesRes.data) setEquipes(equipesRes.data);
      if (centrosRes.data) setCentrosCusto(centrosRes.data);

      // Carregar turnos do período
      const { data: turnosData, error: turnosError } = await supabase
        .from("turnos")
        .select(`
          id, equipe_id, hora_inicio, hora_fim, status,
          tecnicos:equipe_id (id, codigo, nome, tipo_equipe, centro_custo_id)
        `)
        .gte("hora_inicio", dataInicio + "T00:00:00")
        .lte("hora_inicio", dataFim + "T23:59:59")
        .order("hora_inicio", { ascending: false });

      if (turnosError) throw turnosError;
      setTurnos(turnosData || []);

      // Carregar intervalos dos turnos
      if (turnosData && turnosData.length > 0) {
        const turnoIds = turnosData.map(t => t.id);
        const { data: intervalosData } = await supabase
          .from("intervalos_equipe")
          .select(`
            id, turno_id, hora_inicio, hora_fim,
            tipo_intervalo:tipo_intervalo_id (nome, tipo)
          `)
          .in("turno_id", turnoIds);
        
        setIntervalos(intervalosData || []);
      }

      // Carregar produções com tempos das OSs
      const { data: producoesData } = await supabase
        .from("producao_equipes")
        .select(`
          id, equipe_id, ordem_servico_id, created_at,
          ordens_servico:ordem_servico_id (
            id, deslocamento_iniciado_at, chegada_local_at, 
            execucao_iniciada_at, concluido_at
          )
        `)
        .gte("created_at", dataInicio + "T00:00:00")
        .lte("created_at", dataFim + "T23:59:59");

      setProducoes(producoesData || []);

      // Carregar checklists (APRs)
      const { data: checklistsData } = await (supabase as any)
        .from("checklist_respostas")
        .select(`
          id, equipe_id, created_at,
          checklists:checklist_id (tipo)
        `)
        .gte("created_at", dataInicio + "T00:00:00")
        .lte("created_at", dataFim + "T23:59:59");

      setChecklists(checklistsData || []);

    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim]);

  // Calcular tempos por turno
  const temposPorTurno = useMemo((): TempoTurno[] => {
    return turnos.map(turno => {
      const horaInicio = parseISO(turno.hora_inicio);
      const horaFim = turno.hora_fim ? parseISO(turno.hora_fim) : new Date();
      const tempoTotal = differenceInMinutes(horaFim, horaInicio);

      // Calcular tempo de intervalos
      const intervalosTurno = intervalos.filter(i => i.turno_id === turno.id);
      const tempoIntervalo = intervalosTurno.reduce((acc, int) => {
        if (int.hora_inicio && int.hora_fim) {
          return acc + differenceInMinutes(parseISO(int.hora_fim), parseISO(int.hora_inicio));
        }
        return acc;
      }, 0);

      // Calcular tempos das OSs (deslocamento e execução)
      const dataInicioTurno = turno.hora_inicio.substring(0, 10);
      const dataFimTurno = turno.hora_fim?.substring(0, 10) || format(new Date(), "yyyy-MM-dd");
      
      const producoesTurno = producoes.filter(p => 
        p.equipe_id === turno.equipe_id &&
        p.created_at >= dataInicioTurno + "T00:00:00" &&
        p.created_at <= dataFimTurno + "T23:59:59"
      );

      let tempoDeslocamento = 0;
      let tempoExecucao = 0;

      producoesTurno.forEach(prod => {
        const os = prod.ordens_servico as any;
        if (os) {
          // Tempo de deslocamento
          if (os.deslocamento_iniciado_at && os.chegada_local_at) {
            tempoDeslocamento += differenceInMinutes(
              parseISO(os.chegada_local_at),
              parseISO(os.deslocamento_iniciado_at)
            );
          }
          // Tempo de execução
          if (os.execucao_iniciada_at && os.concluido_at) {
            tempoExecucao += differenceInMinutes(
              parseISO(os.concluido_at),
              parseISO(os.execucao_iniciada_at)
            );
          }
        }
      });

      // Calcular tempo de APR (estimativa: 5 min por APR)
      const checklistsTurno = checklists.filter(c => 
        c.equipe_id === turno.equipe_id &&
        c.created_at >= dataInicioTurno + "T00:00:00" &&
        c.created_at <= dataFimTurno + "T23:59:59" &&
        (c.checklists as any)?.tipo === "apr"
      );
      const tempoAPR = checklistsTurno.length * 5; // 5 min por APR

      // Calcular tempo ocioso
      const tempoMedido = tempoDeslocamento + tempoExecucao + tempoIntervalo + tempoAPR;
      const tempoOcioso = Math.max(0, tempoTotal - tempoMedido);
      const percentualOcioso = tempoTotal > 0 ? (tempoOcioso / tempoTotal) * 100 : 0;
      const percentualProdutivo = 100 - percentualOcioso;

      return {
        turnoId: turno.id,
        equipeId: turno.equipe_id,
        equipeCodigo: turno.tecnicos?.codigo || "-",
        equipeNome: turno.tecnicos?.nome || "-",
        tipoEquipe: turno.tecnicos?.tipo_equipe || "normal",
        centroCustoId: turno.tecnicos?.centro_custo_id || "",
        data: turno.hora_inicio.substring(0, 10),
        tempoTotal,
        tempoDeslocamento,
        tempoExecucao,
        tempoIntervalo,
        tempoAPR,
        tempoOcioso,
        percentualOcioso,
        percentualProdutivo,
        qtdOSs: producoesTurno.length,
        status: turno.status,
      };
    });
  }, [turnos, intervalos, producoes, checklists]);

  // Aplicar filtros
  const temposFiltrados = useMemo(() => {
    return temposPorTurno.filter(t => {
      if (filtrosCentroCusto.length > 0 && !filtrosCentroCusto.includes(t.centroCustoId)) return false;
      if (filtrosTipoEquipe.length > 0 && !filtrosTipoEquipe.includes(t.tipoEquipe)) return false;
      if (filtrosEquipe.length > 0 && !filtrosEquipe.includes(t.equipeId)) return false;
      if (filtroStatus !== "all" && t.status !== filtroStatus) return false;
      return true;
    });
  }, [temposPorTurno, filtrosCentroCusto, filtrosTipoEquipe, filtrosEquipe, filtroStatus]);

  // Métricas gerais
  const metricas = useMemo(() => {
    if (temposFiltrados.length === 0) {
      return {
        totalTurnos: 0,
        tempoTotalGeral: 0,
        tempoOciosoTotal: 0,
        tempoProdutivoTotal: 0,
        percentualOciosoMedio: 0,
        percentualProdutivoMedio: 0,
        mediaOciosoPorTurno: 0,
        tempoDeslocamentoTotal: 0,
        tempoExecucaoTotal: 0,
        tempoIntervaloTotal: 0,
        tempoAPRTotal: 0,
      };
    }

    const totais = temposFiltrados.reduce((acc, t) => ({
      tempoTotal: acc.tempoTotal + t.tempoTotal,
      tempoOcioso: acc.tempoOcioso + t.tempoOcioso,
      tempoDeslocamento: acc.tempoDeslocamento + t.tempoDeslocamento,
      tempoExecucao: acc.tempoExecucao + t.tempoExecucao,
      tempoIntervalo: acc.tempoIntervalo + t.tempoIntervalo,
      tempoAPR: acc.tempoAPR + t.tempoAPR,
    }), { tempoTotal: 0, tempoOcioso: 0, tempoDeslocamento: 0, tempoExecucao: 0, tempoIntervalo: 0, tempoAPR: 0 });

    const tempoProdutivoTotal = totais.tempoTotal - totais.tempoOcioso;

    return {
      totalTurnos: temposFiltrados.length,
      tempoTotalGeral: totais.tempoTotal,
      tempoOciosoTotal: totais.tempoOcioso,
      tempoProdutivoTotal,
      percentualOciosoMedio: totais.tempoTotal > 0 ? (totais.tempoOcioso / totais.tempoTotal) * 100 : 0,
      percentualProdutivoMedio: totais.tempoTotal > 0 ? (tempoProdutivoTotal / totais.tempoTotal) * 100 : 0,
      mediaOciosoPorTurno: temposFiltrados.length > 0 ? totais.tempoOcioso / temposFiltrados.length : 0,
      tempoDeslocamentoTotal: totais.tempoDeslocamento,
      tempoExecucaoTotal: totais.tempoExecucao,
      tempoIntervaloTotal: totais.tempoIntervalo,
      tempoAPRTotal: totais.tempoAPR,
    };
  }, [temposFiltrados]);

  // Dados para gráfico de pizza (distribuição do tempo)
  const dadosDistribuicao = useMemo(() => {
    return [
      { name: "Execução", value: metricas.tempoExecucaoTotal, color: CORES_TEMPO.execucao },
      { name: "Deslocamento", value: metricas.tempoDeslocamentoTotal, color: CORES_TEMPO.deslocamento },
      { name: "Intervalo", value: metricas.tempoIntervaloTotal, color: CORES_TEMPO.intervalo },
      { name: "APR", value: metricas.tempoAPRTotal, color: CORES_TEMPO.apr },
      { name: "Ocioso", value: metricas.tempoOciosoTotal, color: CORES_TEMPO.ocioso },
    ].filter(d => d.value > 0);
  }, [metricas]);

  // Ranking de equipes por tempo ocioso
  const rankingEquipes = useMemo(() => {
    const porEquipe = new Map<string, { 
      codigo: string; 
      nome: string; 
      tempoOcioso: number; 
      tempoTotal: number;
      turnos: number;
    }>();

    temposFiltrados.forEach(t => {
      const atual = porEquipe.get(t.equipeId) || { 
        codigo: t.equipeCodigo, 
        nome: t.equipeNome, 
        tempoOcioso: 0, 
        tempoTotal: 0,
        turnos: 0,
      };
      atual.tempoOcioso += t.tempoOcioso;
      atual.tempoTotal += t.tempoTotal;
      atual.turnos += 1;
      porEquipe.set(t.equipeId, atual);
    });

    return Array.from(porEquipe.entries())
      .map(([id, data]) => ({
        id,
        ...data,
        percentualOcioso: data.tempoTotal > 0 ? (data.tempoOcioso / data.tempoTotal) * 100 : 0,
        mediaOciosoPorTurno: data.turnos > 0 ? data.tempoOcioso / data.turnos : 0,
      }))
      .sort((a, b) => b.percentualOcioso - a.percentualOcioso);
  }, [temposFiltrados]);

  // Dados por dia
  const dadosPorDia = useMemo(() => {
    const porDia = new Map<string, { 
      tempoTotal: number; 
      tempoOcioso: number; 
      turnos: number;
    }>();

    temposFiltrados.forEach(t => {
      const atual = porDia.get(t.data) || { tempoTotal: 0, tempoOcioso: 0, turnos: 0 };
      atual.tempoTotal += t.tempoTotal;
      atual.tempoOcioso += t.tempoOcioso;
      atual.turnos += 1;
      porDia.set(t.data, atual);
    });

    return Array.from(porDia.entries())
      .map(([data, dados]) => ({
        data,
        dataFormatada: format(parseISO(data), "dd/MM", { locale: ptBR }),
        ...dados,
        percentualOcioso: dados.tempoTotal > 0 ? (dados.tempoOcioso / dados.tempoTotal) * 100 : 0,
        tempoProdutivo: dados.tempoTotal - dados.tempoOcioso,
      }))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [temposFiltrados]);

  // Exportar para Excel
  const exportarExcel = () => {
    const dados = temposFiltrados.map(t => ({
      "Data": format(parseISO(t.data), "dd/MM/yyyy"),
      "Equipe": t.equipeCodigo,
      "Nome": t.equipeNome,
      "Tipo": tipoEquipeLabels[t.tipoEquipe]?.label || t.tipoEquipe,
      "Tempo Total (min)": t.tempoTotal,
      "Tempo Execução (min)": t.tempoExecucao,
      "Tempo Deslocamento (min)": t.tempoDeslocamento,
      "Tempo Intervalo (min)": t.tempoIntervalo,
      "Tempo APR (min)": t.tempoAPR,
      "Tempo Ocioso (min)": t.tempoOcioso,
      "% Ocioso": t.percentualOcioso.toFixed(1) + "%",
      "% Produtivo": t.percentualProdutivo.toFixed(1) + "%",
      "OSs": t.qtdOSs,
      "Status": t.status,
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tempo Ocioso");
    XLSX.writeFile(wb, `tempo_ocioso_${dataInicio}_${dataFim}.xlsx`);
    toast.success("Relatório exportado!");
  };

  // Limpar filtros
  const limparFiltros = () => {
    setFiltrosCentroCusto([]);
    setFiltrosTipoEquipe([]);
    setFiltrosEquipe([]);
    setFiltroStatus("all");
  };

  const filtrosAtivos = filtrosCentroCusto.length + filtrosTipoEquipe.length + filtrosEquipe.length + (filtroStatus !== "all" ? 1 : 0);

  // Tooltip customizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-3">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatarTempo(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <MainLayout title="Análise de Tempo Ocioso" breadcrumbs={[{ label: "Dashboard Tempo Ocioso" }]}>
      <div className="space-y-6">
        {/* Header com filtros */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Análise de Tempo Ocioso</h1>
              <p className="text-sm text-muted-foreground">
                Monitore a produtividade e identifique oportunidades de melhoria
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={carregarDados} disabled={loading}>
              <RefreshCcw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={exportarExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Período */}
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-[140px]"
                />
                <span className="text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-[140px]"
                />
              </div>

              {/* Centro de Custo */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[150px] justify-between">
                    <span className="truncate">
                      {filtrosCentroCusto.length > 0 
                        ? `${filtrosCentroCusto.length} CC` 
                        : "Centro Custo"}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={buscaCentroCusto}
                      onChange={(e) => setBuscaCentroCusto(e.target.value)}
                      className="pl-8 h-8"
                    />
                  </div>
                  <ScrollArea className="h-48">
                    {centrosCusto
                      .filter(cc => cc.nome.toLowerCase().includes(buscaCentroCusto.toLowerCase()))
                      .map(cc => (
                        <div key={cc.id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded">
                          <Checkbox
                            checked={filtrosCentroCusto.includes(cc.id)}
                            onCheckedChange={(checked) => {
                              setFiltrosCentroCusto(prev => 
                                checked ? [...prev, cc.id] : prev.filter(id => id !== cc.id)
                              );
                            }}
                          />
                          <span className="text-sm truncate">{cc.nome}</span>
                        </div>
                      ))}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Tipo de Equipe */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[130px] justify-between">
                    <span className="truncate">
                      {filtrosTipoEquipe.length > 0 
                        ? `${filtrosTipoEquipe.length} tipo(s)` 
                        : "Tipo Equipe"}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  {Object.entries(tipoEquipeLabels).map(([key, { label, color }]) => (
                    <div key={key} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded">
                      <Checkbox
                        checked={filtrosTipoEquipe.includes(key)}
                        onCheckedChange={(checked) => {
                          setFiltrosTipoEquipe(prev => 
                            checked ? [...prev, key] : prev.filter(t => t !== key)
                          );
                        }}
                      />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm">{label}</span>
                    </div>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Equipe */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[130px] justify-between">
                    <span className="truncate">
                      {filtrosEquipe.length > 0 
                        ? `${filtrosEquipe.length} equipe(s)` 
                        : "Equipe"}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={buscaEquipe}
                      onChange={(e) => setBuscaEquipe(e.target.value)}
                      className="pl-8 h-8"
                    />
                  </div>
                  <ScrollArea className="h-48">
                    {equipes
                      .filter(eq => 
                        eq.codigo.toLowerCase().includes(buscaEquipe.toLowerCase()) ||
                        eq.nome.toLowerCase().includes(buscaEquipe.toLowerCase())
                      )
                      .map(eq => (
                        <div key={eq.id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded">
                          <Checkbox
                            checked={filtrosEquipe.includes(eq.id)}
                            onCheckedChange={(checked) => {
                              setFiltrosEquipe(prev => 
                                checked ? [...prev, eq.id] : prev.filter(id => id !== eq.id)
                              );
                            }}
                          />
                          <span className="text-sm truncate">{eq.codigo} - {eq.nome}</span>
                        </div>
                      ))}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Status */}
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="aberto">Em Andamento</SelectItem>
                  <SelectItem value="fechado">Finalizados</SelectItem>
                </SelectContent>
              </Select>

              {filtrosAtivos > 0 && (
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar ({filtrosAtivos})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-blue-100 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium">Turnos</span>
                  </div>
                  <p className="text-2xl font-bold">{metricas.totalTurnos}</p>
                  <p className="text-xs text-blue-100">{formatarTempo(metricas.tempoTotalGeral)} total</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-green-100 mb-1">
                    <Play className="h-4 w-4" />
                    <span className="text-xs font-medium">Execução</span>
                  </div>
                  <p className="text-2xl font-bold">{formatarTempo(metricas.tempoExecucaoTotal)}</p>
                  <p className="text-xs text-green-100">
                    {metricas.tempoTotalGeral > 0 
                      ? ((metricas.tempoExecucaoTotal / metricas.tempoTotalGeral) * 100).toFixed(1) 
                      : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-400 to-cyan-500 text-white">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-blue-100 mb-1">
                    <Truck className="h-4 w-4" />
                    <span className="text-xs font-medium">Deslocamento</span>
                  </div>
                  <p className="text-2xl font-bold">{formatarTempo(metricas.tempoDeslocamentoTotal)}</p>
                  <p className="text-xs text-blue-100">
                    {metricas.tempoTotalGeral > 0 
                      ? ((metricas.tempoDeslocamentoTotal / metricas.tempoTotalGeral) * 100).toFixed(1) 
                      : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-amber-100 mb-1">
                    <Coffee className="h-4 w-4" />
                    <span className="text-xs font-medium">Intervalos</span>
                  </div>
                  <p className="text-2xl font-bold">{formatarTempo(metricas.tempoIntervaloTotal)}</p>
                  <p className="text-xs text-amber-100">
                    {metricas.tempoTotalGeral > 0 
                      ? ((metricas.tempoIntervaloTotal / metricas.tempoTotalGeral) * 100).toFixed(1) 
                      : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-violet-100 mb-1">
                    <ClipboardCheck className="h-4 w-4" />
                    <span className="text-xs font-medium">APR</span>
                  </div>
                  <p className="text-2xl font-bold">{formatarTempo(metricas.tempoAPRTotal)}</p>
                  <p className="text-xs text-violet-100">
                    {metricas.tempoTotalGeral > 0 
                      ? ((metricas.tempoAPRTotal / metricas.tempoTotalGeral) * 100).toFixed(1) 
                      : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-red-100 mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-medium">Tempo Ocioso</span>
                  </div>
                  <p className="text-2xl font-bold">{formatarTempo(metricas.tempoOciosoTotal)}</p>
                  <p className="text-xs text-red-100">
                    {metricas.percentualOciosoMedio.toFixed(1)}% do tempo
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Card de destaque - Eficiência */}
            <Card className="border-2 border-dashed">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-16 w-16 rounded-2xl flex items-center justify-center",
                      metricas.percentualProdutivoMedio >= 80 
                        ? "bg-green-100 text-green-600" 
                        : metricas.percentualProdutivoMedio >= 60
                          ? "bg-amber-100 text-amber-600"
                          : "bg-red-100 text-red-600"
                    )}>
                      <Zap className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Eficiência Geral</p>
                      <p className="text-4xl font-bold">
                        {metricas.percentualProdutivoMedio.toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Média de {formatarTempo(metricas.mediaOciosoPorTurno)} ocioso por turno
                      </p>
                    </div>
                  </div>
                  <div className="w-48">
                    <Progress 
                      value={metricas.percentualProdutivoMedio} 
                      className="h-4"
                    />
                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs com visualizações */}
            <Tabs defaultValue="distribuicao" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="distribuicao" className="gap-2">
                  <PieChart className="h-4 w-4" />
                  Distribuição
                </TabsTrigger>
                <TabsTrigger value="evolucao" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Evolução
                </TabsTrigger>
                <TabsTrigger value="ranking" className="gap-2">
                  <Award className="h-4 w-4" />
                  Ranking
                </TabsTrigger>
                <TabsTrigger value="detalhado" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Detalhado
                </TabsTrigger>
              </TabsList>

              {/* Tab Distribuição */}
              <TabsContent value="distribuicao">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Distribuição do Tempo</CardTitle>
                      <CardDescription>Como o tempo total está sendo utilizado</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={dadosDistribuicao}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {dadosDistribuicao.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number) => formatarTempo(value)}
                            />
                            <Legend />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tempo por Categoria</CardTitle>
                      <CardDescription>Comparativo em barras horizontais</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={dadosDistribuicao} 
                            layout="vertical"
                            margin={{ left: 80 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(v) => formatarTempo(v)} />
                            <YAxis type="category" dataKey="name" />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {dadosDistribuicao.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab Evolução */}
              <TabsContent value="evolucao">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Evolução Diária</CardTitle>
                    <CardDescription>Tempo produtivo vs ocioso ao longo do período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dadosPorDia}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="dataFormatada" />
                          <YAxis yAxisId="left" tickFormatter={(v) => formatarTempo(v)} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="tempoProdutivo" name="Produtivo" fill={CORES_TEMPO.execucao} stackId="stack" />
                          <Bar yAxisId="left" dataKey="tempoOcioso" name="Ocioso" fill={CORES_TEMPO.ocioso} stackId="stack" />
                          <Line yAxisId="right" type="monotone" dataKey="percentualOcioso" name="% Ocioso" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab Ranking */}
              <TabsContent value="ranking">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ranking de Equipes por Tempo Ocioso</CardTitle>
                    <CardDescription>Equipes ordenadas pelo percentual de tempo ocioso</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Equipe</TableHead>
                          <TableHead className="text-center">Turnos</TableHead>
                          <TableHead className="text-right">Tempo Total</TableHead>
                          <TableHead className="text-right">Tempo Ocioso</TableHead>
                          <TableHead className="text-right">Média/Turno</TableHead>
                          <TableHead className="w-[180px]">% Ocioso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rankingEquipes.slice(0, 20).map((eq, index) => (
                          <TableRow key={eq.id}>
                            <TableCell>
                              <Badge variant={index < 3 ? "destructive" : "outline"}>
                                {index + 1}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{eq.codigo}</p>
                                <p className="text-xs text-muted-foreground">{eq.nome}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{eq.turnos}</TableCell>
                            <TableCell className="text-right">{formatarTempo(eq.tempoTotal)}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              {formatarTempo(eq.tempoOcioso)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatarTempo(eq.mediaOciosoPorTurno)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={eq.percentualOcioso} 
                                  className="h-2 flex-1"
                                />
                                <span className={cn(
                                  "text-sm font-medium w-12 text-right",
                                  eq.percentualOcioso > 30 ? "text-red-600" : 
                                  eq.percentualOcioso > 20 ? "text-amber-600" : "text-green-600"
                                )}>
                                  {eq.percentualOcioso.toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab Detalhado */}
              <TabsContent value="detalhado">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Detalhamento por Turno</CardTitle>
                    <CardDescription>Todos os turnos com breakdown de tempos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Equipe</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Execução</TableHead>
                          <TableHead className="text-right">Desloc.</TableHead>
                          <TableHead className="text-right">Interv.</TableHead>
                          <TableHead className="text-right">APR</TableHead>
                          <TableHead className="text-right">Ocioso</TableHead>
                          <TableHead className="text-center">OSs</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {temposFiltrados.slice(0, 50).map((t) => (
                          <TableRow key={t.turnoId}>
                            <TableCell>{format(parseISO(t.data), "dd/MM/yyyy")}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{t.equipeCodigo}</p>
                                <p className="text-xs text-muted-foreground">{t.equipeNome}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatarTempo(t.tempoTotal)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatarTempo(t.tempoExecucao)}</TableCell>
                            <TableCell className="text-right text-blue-600">{formatarTempo(t.tempoDeslocamento)}</TableCell>
                            <TableCell className="text-right text-amber-600">{formatarTempo(t.tempoIntervalo)}</TableCell>
                            <TableCell className="text-right text-violet-600">{formatarTempo(t.tempoAPR)}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn(
                                "font-medium",
                                t.percentualOcioso > 30 ? "text-red-600" : 
                                t.percentualOcioso > 20 ? "text-amber-600" : "text-green-600"
                              )}>
                                {formatarTempo(t.tempoOcioso)}
                                <span className="text-xs ml-1">({t.percentualOcioso.toFixed(0)}%)</span>
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{t.qtdOSs}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={t.status === "fechado" ? "secondary" : "default"}>
                                {t.status === "fechado" ? "Finalizado" : "Aberto"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {temposFiltrados.length > 50 && (
                      <p className="text-center text-sm text-muted-foreground mt-4">
                        Mostrando 50 de {temposFiltrados.length} turnos. Exporte para ver todos.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </MainLayout>
  );
}

