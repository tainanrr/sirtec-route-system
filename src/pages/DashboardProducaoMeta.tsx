import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
  Search,
  ChevronDown,
  X,
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
  numero_os?: string;
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
  const [filtrosCentroCusto, setFiltrosCentroCusto] = useState<string[]>([]);
  const [filtrosTipoEquipe, setFiltrosTipoEquipe] = useState<string[]>([]);
  const [filtrosEquipe, setFiltrosEquipe] = useState<string[]>([]);
  
  // Busca nos filtros
  const [buscaCentroCusto, setBuscaCentroCusto] = useState("");
  const [buscaTipoEquipe, setBuscaTipoEquipe] = useState("");
  const [buscaEquipe, setBuscaEquipe] = useState("");

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

      // Buscar números das OSs para as produções
      const producoesData = producaoRes.data || [];
      const osIds = [...new Set(producoesData.map(p => p.ordem_servico_id).filter(Boolean))];
      
      let numerosOsMap: Record<string, string> = {};
      if (osIds.length > 0) {
        // Buscar em lotes para evitar limite de URL
        const chunks = [];
        for (let i = 0; i < osIds.length; i += 50) {
          chunks.push(osIds.slice(i, i + 50));
        }
        
        for (const chunk of chunks) {
          const { data: ordensData } = await supabase
            .from("ordens_servico")
            .select("id, numero_os")
            .in("id", chunk);
          
          if (ordensData) {
            ordensData.forEach(o => {
              numerosOsMap[o.id] = o.numero_os;
            });
          }
        }
      }
      
      // Adicionar numero_os às produções
      const producoesComNumero = producoesData.map(p => ({
        ...p,
        numero_os: numerosOsMap[p.ordem_servico_id] || undefined,
      }));

      setMetas(metasRes.data || []);
      setProducoes(producoesComNumero);
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
    if (filtrosCentroCusto.length > 0) {
      filtered = filtered.filter(e => e.centro_custo_id && filtrosCentroCusto.includes(e.centro_custo_id));
    }
    if (filtrosTipoEquipe.length > 0) {
      filtered = filtered.filter(e => filtrosTipoEquipe.includes(e.tipo_equipe || "normal"));
    }
    if (filtrosEquipe.length > 0) {
      filtered = filtered.filter(e => filtrosEquipe.includes(e.id));
    }
    return filtered;
  }, [equipes, filtrosCentroCusto, filtrosTipoEquipe, filtrosEquipe]);
  
  // Opções filtradas para cada dropdown
  const centrosCustoFiltrados = useMemo(() => {
    if (!buscaCentroCusto) return centrosCusto;
    const termo = buscaCentroCusto.toLowerCase();
    return centrosCusto.filter(cc => 
      cc.codigo.toLowerCase().includes(termo) || 
      cc.nome.toLowerCase().includes(termo)
    );
  }, [centrosCusto, buscaCentroCusto]);
  
  const equipesFiltradosDropdown = useMemo(() => {
    if (!buscaEquipe) return equipes;
    const termo = buscaEquipe.toLowerCase();
    return equipes.filter(e => 
      e.codigo.toLowerCase().includes(termo) || 
      e.nome.toLowerCase().includes(termo)
    );
  }, [equipes, buscaEquipe]);
  
  // Helpers para toggle de filtros
  const toggleFiltroCentroCusto = (id: string) => {
    setFiltrosCentroCusto(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  
  const toggleFiltroTipoEquipe = (tipo: string) => {
    setFiltrosTipoEquipe(prev => 
      prev.includes(tipo) ? prev.filter(x => x !== tipo) : [...prev, tipo]
    );
  };
  
  const toggleFiltroEquipe = (id: string) => {
    setFiltrosEquipe(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  
  const limparFiltros = () => {
    setFiltrosCentroCusto([]);
    setFiltrosTipoEquipe([]);
    setFiltrosEquipe([]);
    setBuscaCentroCusto("");
    setBuscaTipoEquipe("");
    setBuscaEquipe("");
  };
  
  const temFiltrosAtivos = filtrosCentroCusto.length > 0 || filtrosTipoEquipe.length > 0 || filtrosEquipe.length > 0;

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

  // Exportar dados completos
  const handleExportar = () => {
    try {
      const wb = XLSX.utils.book_new();

      // ===== ABA 1: RESUMO GERAL =====
      const resumoGeral = [
        { "Indicador": "Período", "Valor": `${format(parseISO(dataInicio), "dd/MM/yyyy")} a ${format(parseISO(dataFim), "dd/MM/yyyy")}` },
        { "Indicador": "Total de Equipes", "Valor": kpis.totalEquipes },
        { "Indicador": "Meta Total (R$)", "Valor": kpis.totalMeta },
        { "Indicador": "Produção Total (R$)", "Valor": kpis.totalProducao },
        { "Indicador": "Diferença (R$)", "Valor": kpis.diferenca },
        { "Indicador": "% Atingimento Geral", "Valor": kpis.percentualGeral.toFixed(2) + "%" },
        { "Indicador": "Equipes Acima da Meta (≥100%)", "Valor": kpis.equipesAcimaMeta },
        { "Indicador": "Equipes Abaixo da Meta (<100%)", "Valor": kpis.equipesAbaixoMeta },
        { "Indicador": "Equipes em Risco (<80%)", "Valor": kpis.equipesEmRisco },
        { "Indicador": "", "Valor": "" },
        { "Indicador": "Melhor Equipe", "Valor": kpis.melhorEquipe ? `${kpis.melhorEquipe.equipe.codigo} - ${kpis.melhorEquipe.percentual.toFixed(1)}%` : "-" },
        { "Indicador": "Equipe com Menor Desempenho", "Valor": kpis.piorEquipe ? `${kpis.piorEquipe.equipe.codigo} - ${kpis.piorEquipe.percentual.toFixed(1)}%` : "-" },
      ];
      const wsResumo = XLSX.utils.json_to_sheet(resumoGeral);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Geral");

      // ===== ABA 2: RANKING POR EQUIPE =====
      const rankingEquipes = dadosPorEquipe.map((d, idx) => ({
        "Posição": idx + 1,
        "Código Equipe": d.equipe.codigo,
        "Nome Equipe": d.equipe.nome,
        "Tipo Equipe": tipoEquipeLabels[d.equipe.tipo_equipe || "normal"]?.label || d.equipe.tipo_equipe,
        "Centro de Custo": centrosCusto.find(c => c.id === d.equipe.centro_custo_id)?.codigo || "-",
        "Meta (R$)": d.totalMeta,
        "Produção (R$)": d.totalProducao,
        "Diferença (R$)": d.diferenca,
        "% Atingimento": parseFloat(d.percentual.toFixed(2)),
        "Status": d.percentual >= 100 ? "Acima da Meta" : d.percentual >= 80 ? "Em Alerta" : d.totalMeta > 0 ? "Em Risco" : "Sem Meta",
        "Dias com Meta": d.diasComMeta,
        "OSs Executadas": d.osExecutadas,
        "Média Meta/Dia (R$)": d.diasComMeta > 0 ? parseFloat((d.totalMeta / d.diasComMeta).toFixed(2)) : 0,
        "Média Produção/Dia (R$)": d.diasComMeta > 0 ? parseFloat((d.totalProducao / d.diasComMeta).toFixed(2)) : 0,
      }));
      const wsRanking = XLSX.utils.json_to_sheet(rankingEquipes);
      XLSX.utils.book_append_sheet(wb, wsRanking, "Ranking Equipes");

      // ===== ABA 3: EVOLUÇÃO DIÁRIA =====
      const evolucaoDiaria = dadosEvolucaoDiaria.map(d => ({
        "Data": format(parseISO(d.dataCompleta), "dd/MM/yyyy"),
        "Dia da Semana": format(parseISO(d.dataCompleta), "EEEE", { locale: ptBR }),
        "Meta do Dia (R$)": d.meta,
        "Produção do Dia (R$)": d.producao,
        "Diferença (R$)": d.producao - d.meta,
        "% Atingimento": parseFloat(d.percentual.toFixed(2)),
      }));
      const wsEvolucao = XLSX.utils.json_to_sheet(evolucaoDiaria);
      XLSX.utils.book_append_sheet(wb, wsEvolucao, "Evolução Diária");

      // ===== ABA 4: EVOLUÇÃO ACUMULADA =====
      const evolucaoAcumulada = dadosAcumulados.map(d => ({
        "Data": format(parseISO(d.dataCompleta), "dd/MM/yyyy"),
        "Meta Acumulada (R$)": d.metaAcumulada,
        "Produção Acumulada (R$)": d.producaoAcumulada,
        "Diferença Acumulada (R$)": d.producaoAcumulada - d.metaAcumulada,
        "% Atingimento Acumulado": parseFloat(d.percentualAcumulado.toFixed(2)),
      }));
      const wsAcumulado = XLSX.utils.json_to_sheet(evolucaoAcumulada);
      XLSX.utils.book_append_sheet(wb, wsAcumulado, "Evolução Acumulada");

      // ===== ABA 5: ANÁLISE POR TIPO DE EQUIPE =====
      const analisePorTipo = dadosPorTipo.map(t => ({
        "Tipo de Equipe": t.label,
        "Quantidade de Equipes": t.count,
        "Meta Total (R$)": t.meta,
        "Produção Total (R$)": t.producao,
        "Diferença (R$)": t.producao - t.meta,
        "% Atingimento": parseFloat(t.percentual.toFixed(2)),
        "Meta Média por Equipe (R$)": t.count > 0 ? parseFloat((t.meta / t.count).toFixed(2)) : 0,
        "Produção Média por Equipe (R$)": t.count > 0 ? parseFloat((t.producao / t.count).toFixed(2)) : 0,
      }));
      const wsTipo = XLSX.utils.json_to_sheet(analisePorTipo);
      XLSX.utils.book_append_sheet(wb, wsTipo, "Análise por Tipo");

      // ===== ABA 6: DETALHAMENTO META POR EQUIPE/DIA =====
      const equipeIds = new Set(equipesFiltradas.map(e => e.id));
      const detalhamentoMetas: any[] = [];
      
      equipesFiltradas.forEach(equipe => {
        const metasEquipe = metas.filter(m => m.equipe_id === equipe.id);
        const producoesEquipe = producoes.filter(p => p.equipe_id === equipe.id);
        
        // Agrupar por data
        const diasPeriodo = eachDayOfInterval({
          start: parseISO(dataInicio),
          end: parseISO(dataFim),
        });
        
        diasPeriodo.forEach(dia => {
          const dataStr = format(dia, "yyyy-MM-dd");
          const metaDia = metasEquipe.find(m => m.data === dataStr);
          const prodDia = producoesEquipe
            .filter(p => p.created_at.startsWith(dataStr))
            .reduce((acc, p) => acc + (p.valor_total || 0), 0);
          
          if (metaDia || prodDia > 0) {
            detalhamentoMetas.push({
              "Código Equipe": equipe.codigo,
              "Nome Equipe": equipe.nome,
              "Data": format(dia, "dd/MM/yyyy"),
              "Dia da Semana": format(dia, "EEE", { locale: ptBR }),
              "Meta (R$)": metaDia?.valor_meta || 0,
              "Produção (R$)": prodDia,
              "Diferença (R$)": prodDia - (metaDia?.valor_meta || 0),
              "% Atingimento": metaDia?.valor_meta ? parseFloat(((prodDia / metaDia.valor_meta) * 100).toFixed(2)) : (prodDia > 0 ? 100 : 0),
            });
          }
        });
      });
      
      if (detalhamentoMetas.length > 0) {
        const wsDetalhamento = XLSX.utils.json_to_sheet(detalhamentoMetas);
        XLSX.utils.book_append_sheet(wb, wsDetalhamento, "Detalhamento Diário");
      }

      // ===== ABA 7: PRODUÇÕES INDIVIDUAIS =====
      const producoesDetalhadas = producoes
        .filter(p => equipeIds.has(p.equipe_id))
        .map(p => {
          const equipe = equipes.find(e => e.id === p.equipe_id);
          return {
            "Número OS": p.numero_os || "-",
            "Código Equipe": equipe?.codigo || "-",
            "Nome Equipe": equipe?.nome || "-",
            "Valor Produzido (R$)": p.valor_total,
            "Data/Hora": format(parseISO(p.created_at), "dd/MM/yyyy HH:mm"),
            "ID Produção": p.id.substring(0, 8),
            "ID OS": p.ordem_servico_id.substring(0, 8),
          };
        });
      
      if (producoesDetalhadas.length > 0) {
        const wsProducoes = XLSX.utils.json_to_sheet(producoesDetalhadas);
        XLSX.utils.book_append_sheet(wb, wsProducoes, "Produções Detalhadas");
      }

      // Salvar arquivo
      const nomeArquivo = `Dashboard_Producao_Meta_${dataInicio}_a_${dataFim}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);
      toast.success(`Exportado com sucesso! ${Object.keys(wb.Sheets).length} abas geradas.`);
    } catch (error) {
      console.error("Erro ao exportar:", error);
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

        {/* Filtro Centro de Custo - Multi-select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 min-w-[120px] justify-between">
              <span className="truncate">
                {filtrosCentroCusto.length === 0 
                  ? "C.Custo: Todos" 
                  : filtrosCentroCusto.length === 1
                    ? centrosCusto.find(c => c.id === filtrosCentroCusto[0])?.codigo || "1 selecionado"
                    : `${filtrosCentroCusto.length} selecionados`}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-2" align="start">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar centro de custo..."
                  value={buscaCentroCusto}
                  onChange={e => setBuscaCentroCusto(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
              <ScrollArea className="h-[180px]">
                <div className="space-y-1">
                  {centrosCustoFiltrados.map(cc => (
                    <label
                      key={cc.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={filtrosCentroCusto.includes(cc.id)}
                        onCheckedChange={() => toggleFiltroCentroCusto(cc.id)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs truncate">{cc.codigo} - {cc.nome}</span>
                    </label>
                  ))}
                  {centrosCustoFiltrados.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">Nenhum encontrado</div>
                  )}
                </div>
              </ScrollArea>
              {filtrosCentroCusto.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-xs"
                  onClick={() => setFiltrosCentroCusto([])}
                >
                  Limpar seleção
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Filtro Tipo Equipe - Multi-select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 min-w-[100px] justify-between">
              <span className="truncate">
                {filtrosTipoEquipe.length === 0 
                  ? "Tipo: Todos" 
                  : filtrosTipoEquipe.length === 1
                    ? tipoEquipeLabels[filtrosTipoEquipe[0]]?.label || "1 selecionado"
                    : `${filtrosTipoEquipe.length} tipos`}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[180px] p-2" align="start">
            <div className="space-y-1">
              {Object.entries(tipoEquipeLabels).map(([value, { label, color }]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={filtrosTipoEquipe.includes(value)}
                    onCheckedChange={() => toggleFiltroTipoEquipe(value)}
                    className="h-3.5 w-3.5"
                  />
                  <Badge style={{ backgroundColor: color }} className="text-white text-[10px] px-1.5">
                    {label}
                  </Badge>
                </label>
              ))}
              {filtrosTipoEquipe.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-xs mt-2"
                  onClick={() => setFiltrosTipoEquipe([])}
                >
                  Limpar seleção
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Filtro Equipe - Multi-select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 min-w-[120px] justify-between">
              <span className="truncate">
                {filtrosEquipe.length === 0 
                  ? "Equipe: Todas" 
                  : filtrosEquipe.length === 1
                    ? equipes.find(e => e.id === filtrosEquipe[0])?.codigo || "1 selecionada"
                    : `${filtrosEquipe.length} equipes`}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-2" align="start">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar equipe..."
                  value={buscaEquipe}
                  onChange={e => setBuscaEquipe(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {equipesFiltradosDropdown.map(e => (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={filtrosEquipe.includes(e.id)}
                        onCheckedChange={() => toggleFiltroEquipe(e.id)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs font-medium">{e.codigo}</span>
                      <span className="text-xs text-muted-foreground truncate">{e.nome}</span>
                    </label>
                  ))}
                  {equipesFiltradosDropdown.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">Nenhuma encontrada</div>
                  )}
                </div>
              </ScrollArea>
              {filtrosEquipe.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-xs"
                  onClick={() => setFiltrosEquipe([])}
                >
                  Limpar seleção ({filtrosEquipe.length})
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Limpar todos os filtros */}
        {temFiltrosAtivos && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={limparFiltros}
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}

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
                <CardTitle className="text-sm flex items-center gap-2">
                  Meta x Produção por Equipe
                  <Badge variant="outline" className="font-normal text-[10px]">
                    Ordenado por % atingimento (melhor → pior)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dadosPorEquipe.slice(0, 15)} margin={{ top: 20, right: 60, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="equipe.codigo" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                                <p className="font-bold mb-2">Equipe: {label}</p>
                                <p className="text-blue-600">Meta: {formatCurrency(data.totalMeta)}</p>
                                <p className="text-green-600">Produção: {formatCurrency(data.totalProducao)}</p>
                                <p className={cn(
                                  "font-bold mt-1 pt-1 border-t",
                                  data.percentual >= 100 ? "text-green-600" : data.percentual >= 80 ? "text-amber-600" : "text-red-600"
                                )}>
                                  Atingimento: {data.percentual.toFixed(1)}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="totalMeta" name="Meta" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="totalProducao" name="Produção" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="percentual" name="% Atingimento" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316", r: 4 }} />
                    </ComposedChart>
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

