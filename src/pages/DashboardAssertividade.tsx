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
  Zap,
  CheckCircle2,
  XCircle,
  Users,
  RefreshCcw,
  Loader2,
  Award,
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subMonths, setDate, getDate, addMonths, eachDayOfInterval, parseISO } from "date-fns";
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
} from "recharts";
import * as XLSX from "xlsx";

interface Producao {
  id: string;
  equipe_id: string;
  ordem_servico_id: string;
  valor_total: number;
  created_at: string;
  retornos_campo?: {
    id: string;
    codigo: string;
    descricao: string;
    tipo: string;
  } | null;
  ordens_servico?: {
    tipo: string;
  } | null;
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

interface Skill {
  codigo: string;
  grupo_servico: string | null;
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

export default function DashboardAssertividade() {
  const [loading, setLoading] = useState(true);
  const [producoes, setProducoes] = useState<Producao[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [gruposServico, setGruposServico] = useState<string[]>([]);
  const [mapaGrupoServico, setMapaGrupoServico] = useState<Map<string, string>>(new Map());

  // Filtros
  const periodoPadrao = calcularPeriodoPadrao();
  const [dataInicio, setDataInicio] = useState(periodoPadrao.inicio);
  const [dataFim, setDataFim] = useState(periodoPadrao.fim);
  const [filtrosCentroCusto, setFiltrosCentroCusto] = useState<string[]>([]);
  const [filtrosTipoEquipe, setFiltrosTipoEquipe] = useState<string[]>([]);
  const [filtrosEquipe, setFiltrosEquipe] = useState<string[]>([]);
  const [filtrosGrupoServico, setFiltrosGrupoServico] = useState<string[]>([]);
  
  // Busca nos filtros
  const [buscaCentroCusto, setBuscaCentroCusto] = useState("");
  const [buscaTipoEquipe, setBuscaTipoEquipe] = useState("");
  const [buscaEquipe, setBuscaEquipe] = useState("");
  const [buscaGrupoServico, setBuscaGrupoServico] = useState("");

  // Tab ativa
  const [activeTab, setActiveTab] = useState("visao-geral");

  // Buscar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const [producaoRes, equipesRes, centrosRes, skillsRes] = await Promise.all([
        supabase.from("producao_equipes")
          .select("*, retornos_campo:retorno_campo_id(id, codigo, descricao, tipo), ordens_servico:ordem_servico_id(tipo)")
          .gte("created_at", dataInicio + "T00:00:00")
          .lte("created_at", dataFim + "T23:59:59"),
        supabase.from("tecnicos").select("id, codigo, nome, centro_custo_id, tipo_equipe").neq("status", "offline").order("codigo"),
        supabase.from("centros_custo").select("id, codigo, nome").order("codigo"),
        supabase.from("skills").select("codigo, grupo_servico"),
      ]);

      if (producaoRes.error) throw producaoRes.error;
      if (equipesRes.error) throw equipesRes.error;

      // Criar mapa de tipo -> grupo_servico
      const novoMapaGrupo = new Map<string, string>();
      (skillsRes.data || []).forEach((skill: Skill) => {
        if (skill.grupo_servico) {
          novoMapaGrupo.set(skill.codigo.toLowerCase(), skill.grupo_servico);
          novoMapaGrupo.set(skill.codigo.toUpperCase(), skill.grupo_servico);
          novoMapaGrupo.set(skill.codigo, skill.grupo_servico);
        }
      });
      setMapaGrupoServico(novoMapaGrupo);

      // Extrair grupos de serviço únicos
      const grupos = new Set<string>();
      (producaoRes.data || []).forEach((p: any) => {
        if (p.ordens_servico?.tipo) {
          const tipo = p.ordens_servico.tipo;
          const grupo = novoMapaGrupo.get(tipo) || novoMapaGrupo.get(tipo.toLowerCase()) || novoMapaGrupo.get(tipo.toUpperCase()) || "Outros";
          grupos.add(grupo);
        }
      });

      setProducoes(producaoRes.data || []);
      setEquipes(equipesRes.data || []);
      setCentrosCusto(centrosRes.data || []);
      setGruposServico(Array.from(grupos).sort());
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

  // Função helper para obter grupo de serviço
  const obterGrupoServico = (tipo: string | undefined | null): string => {
    if (!tipo) return "Outros";
    return mapaGrupoServico.get(tipo) || mapaGrupoServico.get(tipo.toLowerCase()) || mapaGrupoServico.get(tipo.toUpperCase()) || "Outros";
  };

  // Produções filtradas
  const producoesFiltradas = useMemo(() => {
    const equipeIds = new Set(equipesFiltradas.map(e => e.id));
    let filtered = producoes.filter(p => equipeIds.has(p.equipe_id));
    
    if (filtrosGrupoServico.length > 0) {
      filtered = filtered.filter(p => {
        const grupo = obterGrupoServico(p.ordens_servico?.tipo);
        return filtrosGrupoServico.includes(grupo);
      });
    }
    
    return filtered;
  }, [producoes, equipesFiltradas, filtrosGrupoServico, mapaGrupoServico]);

  // Opções filtradas para cada dropdown
  const centrosCustoFiltrados = useMemo(() => {
    if (!buscaCentroCusto) return centrosCusto;
    const termo = buscaCentroCusto.toLowerCase();
    return centrosCusto.filter(cc => 
      cc.codigo.toLowerCase().includes(termo) || 
      cc.nome.toLowerCase().includes(termo)
    );
  }, [centrosCusto, buscaCentroCusto]);
  
  const tiposEquipeFiltrados = useMemo(() => {
    const tipos = Object.entries(tipoEquipeLabels);
    if (!buscaTipoEquipe) return tipos;
    const termo = buscaTipoEquipe.toLowerCase();
    return tipos.filter(([_, { label }]) => label.toLowerCase().includes(termo));
  }, [buscaTipoEquipe]);
  
  const equipesFiltradas2 = useMemo(() => {
    if (!buscaEquipe) return equipes;
    const termo = buscaEquipe.toLowerCase();
    return equipes.filter(e => 
      e.codigo.toLowerCase().includes(termo) || 
      e.nome.toLowerCase().includes(termo)
    );
  }, [equipes, buscaEquipe]);

  const gruposServicoFiltrados = useMemo(() => {
    if (!buscaGrupoServico) return gruposServico;
    const termo = buscaGrupoServico.toLowerCase();
    return gruposServico.filter(g => g.toLowerCase().includes(termo));
  }, [gruposServico, buscaGrupoServico]);

  // KPIs gerais de assertividade
  const kpis = useMemo(() => {
    const totalVisitas = producoesFiltradas.length;
    const executadas = producoesFiltradas.filter(p => p.retornos_campo?.tipo === "executado").length;
    const impedimentos = producoesFiltradas.filter(p => p.retornos_campo?.tipo === "impedimento").length;
    const semRetorno = totalVisitas - executadas - impedimentos;
    
    const assertividadeGeral = totalVisitas > 0 ? (executadas / totalVisitas) * 100 : 0;
    
    return {
      totalVisitas,
      executadas,
      impedimentos,
      semRetorno,
      assertividadeGeral,
      percentualExecutado: totalVisitas > 0 ? (executadas / totalVisitas) * 100 : 0,
      percentualImpedimento: totalVisitas > 0 ? (impedimentos / totalVisitas) * 100 : 0,
    };
  }, [producoesFiltradas]);

  // Dados por equipe
  const dadosPorEquipe = useMemo(() => {
    return equipesFiltradas.map(equipe => {
      const producoesEquipe = producoesFiltradas.filter(p => p.equipe_id === equipe.id);
      const total = producoesEquipe.length;
      const executadas = producoesEquipe.filter(p => p.retornos_campo?.tipo === "executado").length;
      const impedimentos = producoesEquipe.filter(p => p.retornos_campo?.tipo === "impedimento").length;
      
      return {
        equipe,
        totalVisitas: total,
        executadas,
        impedimentos,
        assertividade: total > 0 ? (executadas / total) * 100 : 0,
        valorExecutado: producoesEquipe
          .filter(p => p.retornos_campo?.tipo === "executado")
          .reduce((acc, p) => acc + (p.valor_total || 0), 0),
        valorImpedido: producoesEquipe
          .filter(p => p.retornos_campo?.tipo === "impedimento")
          .reduce((acc, p) => acc + (p.valor_total || 0), 0),
      };
    }).filter(e => e.totalVisitas > 0).sort((a, b) => b.assertividade - a.assertividade);
  }, [equipesFiltradas, producoesFiltradas]);

  // Dados por grupo de serviço
  const dadosPorGrupoServico = useMemo(() => {
    const porGrupo: Record<string, { total: number; executadas: number; impedimentos: number; valor: number }> = {};
    
    producoesFiltradas.forEach(p => {
      const grupo = obterGrupoServico(p.ordens_servico?.tipo);
      if (!porGrupo[grupo]) {
        porGrupo[grupo] = { total: 0, executadas: 0, impedimentos: 0, valor: 0 };
      }
      porGrupo[grupo].total++;
      porGrupo[grupo].valor += p.valor_total || 0;
      if (p.retornos_campo?.tipo === "executado") porGrupo[grupo].executadas++;
      if (p.retornos_campo?.tipo === "impedimento") porGrupo[grupo].impedimentos++;
    });
    
    return Object.entries(porGrupo).map(([grupo, dados]) => ({
      grupo,
      grupoUpper: grupo.toUpperCase(),
      ...dados,
      assertividade: dados.total > 0 ? (dados.executadas / dados.total) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
  }, [producoesFiltradas, mapaGrupoServico]);

  // Dados por tipo de equipe
  const dadosPorTipoEquipe = useMemo(() => {
    const porTipo: Record<string, { total: number; executadas: number; impedimentos: number; equipes: number }> = {};
    
    dadosPorEquipe.forEach(e => {
      const tipo = e.equipe.tipo_equipe || "normal";
      if (!porTipo[tipo]) {
        porTipo[tipo] = { total: 0, executadas: 0, impedimentos: 0, equipes: 0 };
      }
      porTipo[tipo].total += e.totalVisitas;
      porTipo[tipo].executadas += e.executadas;
      porTipo[tipo].impedimentos += e.impedimentos;
      porTipo[tipo].equipes++;
    });
    
    return Object.entries(porTipo).map(([tipo, dados]) => ({
      tipo,
      label: tipoEquipeLabels[tipo]?.label || tipo,
      color: tipoEquipeLabels[tipo]?.color || "#6b7280",
      ...dados,
      assertividade: dados.total > 0 ? (dados.executadas / dados.total) * 100 : 0,
    }));
  }, [dadosPorEquipe]);

  // Evolução diária
  const evolucaoDiaria = useMemo(() => {
    const dias = eachDayOfInterval({
      start: parseISO(dataInicio),
      end: parseISO(dataFim),
    });

    return dias.map(dia => {
      const dataStr = format(dia, "yyyy-MM-dd");
      const producoesDia = producoesFiltradas.filter(p => p.created_at.startsWith(dataStr));
      const total = producoesDia.length;
      const executadas = producoesDia.filter(p => p.retornos_campo?.tipo === "executado").length;
      const impedimentos = producoesDia.filter(p => p.retornos_campo?.tipo === "impedimento").length;
      
      return {
        data: format(dia, "dd/MM"),
        dataCompleta: dataStr,
        total,
        executadas,
        impedimentos,
        assertividade: total > 0 ? (executadas / total) * 100 : 0,
      };
    }).filter(d => d.total > 0);
  }, [dataInicio, dataFim, producoesFiltradas]);

  // Limpar filtros
  const limparFiltros = () => {
    setFiltrosCentroCusto([]);
    setFiltrosTipoEquipe([]);
    setFiltrosEquipe([]);
    setFiltrosGrupoServico([]);
  };

  const temFiltrosAtivos = filtrosCentroCusto.length > 0 || filtrosTipoEquipe.length > 0 || 
                           filtrosEquipe.length > 0 || filtrosGrupoServico.length > 0;

  // Exportar dados
  const handleExportar = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Aba 1: Resumo Geral
      const resumo = [
        { "Indicador": "Período", "Valor": `${format(parseISO(dataInicio), "dd/MM/yyyy")} a ${format(parseISO(dataFim), "dd/MM/yyyy")}` },
        { "Indicador": "Total de Visitas", "Valor": kpis.totalVisitas },
        { "Indicador": "Executadas", "Valor": kpis.executadas },
        { "Indicador": "Impedimentos", "Valor": kpis.impedimentos },
        { "Indicador": "Assertividade Geral", "Valor": kpis.assertividadeGeral.toFixed(2) + "%" },
      ];
      const wsResumo = XLSX.utils.json_to_sheet(resumo);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Geral");

      // Aba 2: Por Equipe
      const porEquipe = dadosPorEquipe.map((d, idx) => ({
        "Posição": idx + 1,
        "Código": d.equipe.codigo,
        "Nome": d.equipe.nome,
        "Tipo Equipe": tipoEquipeLabels[d.equipe.tipo_equipe || "normal"]?.label || d.equipe.tipo_equipe,
        "Total Visitas": d.totalVisitas,
        "Executadas": d.executadas,
        "Impedimentos": d.impedimentos,
        "Assertividade (%)": parseFloat(d.assertividade.toFixed(2)),
        "Valor Executado (R$)": d.valorExecutado,
        "Valor Impedido (R$)": d.valorImpedido,
      }));
      const wsEquipe = XLSX.utils.json_to_sheet(porEquipe);
      XLSX.utils.book_append_sheet(wb, wsEquipe, "Por Equipe");

      // Aba 3: Por Grupo de Serviço
      const porGrupo = dadosPorGrupoServico.map(d => ({
        "Grupo de Serviço": d.grupoUpper,
        "Total Visitas": d.total,
        "Executadas": d.executadas,
        "Impedimentos": d.impedimentos,
        "Assertividade (%)": parseFloat(d.assertividade.toFixed(2)),
        "Valor Total (R$)": d.valor,
      }));
      const wsGrupo = XLSX.utils.json_to_sheet(porGrupo);
      XLSX.utils.book_append_sheet(wb, wsGrupo, "Por Grupo Serviço");

      // Aba 4: Evolução Diária
      const evolucao = evolucaoDiaria.map(d => ({
        "Data": format(parseISO(d.dataCompleta), "dd/MM/yyyy"),
        "Total Visitas": d.total,
        "Executadas": d.executadas,
        "Impedimentos": d.impedimentos,
        "Assertividade (%)": parseFloat(d.assertividade.toFixed(2)),
      }));
      const wsEvolucao = XLSX.utils.json_to_sheet(evolucao);
      XLSX.utils.book_append_sheet(wb, wsEvolucao, "Evolução Diária");

      // Aba 5: Por Tipo de Equipe
      const porTipoEquipe = dadosPorTipoEquipe.map(d => ({
        "Tipo de Equipe": d.label,
        "Qtd Equipes": d.equipes,
        "Total Visitas": d.total,
        "Executadas": d.executadas,
        "Impedimentos": d.impedimentos,
        "Assertividade (%)": parseFloat(d.assertividade.toFixed(2)),
      }));
      const wsTipoEquipe = XLSX.utils.json_to_sheet(porTipoEquipe);
      XLSX.utils.book_append_sheet(wb, wsTipoEquipe, "Por Tipo Equipe");

      const nomeArquivo = `Dashboard_Assertividade_${dataInicio}_a_${dataFim}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);
      toast.success("Exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <MainLayout
      title="Assertividade"
      breadcrumbs={[
        { label: "Dashboards" },
        { label: "Assertividade" },
      ]}
    >
      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
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

        {/* Centro de Custo */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
              <Filter className="h-3 w-3" />
              C.Custo
              {filtrosCentroCusto.length > 0 && (
                <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {filtrosCentroCusto.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <div className="space-y-2">
              <Input placeholder="Buscar..." value={buscaCentroCusto} onChange={e => setBuscaCentroCusto(e.target.value)} className="h-7 text-xs" />
              <ScrollArea className="h-40">
                {centrosCustoFiltrados.map(cc => (
                  <div key={cc.id} className="flex items-center gap-2 py-1">
                    <Checkbox 
                      checked={filtrosCentroCusto.includes(cc.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setFiltrosCentroCusto([...filtrosCentroCusto, cc.id]);
                        else setFiltrosCentroCusto(filtrosCentroCusto.filter(id => id !== cc.id));
                      }}
                    />
                    <span className="text-xs">{cc.codigo} - {cc.nome}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

        {/* Tipo Equipe */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
              Tipo Eq.
              {filtrosTipoEquipe.length > 0 && (
                <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {filtrosTipoEquipe.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2">
            <div className="space-y-2">
              {tiposEquipeFiltrados.map(([value, { label }]) => (
                <div key={value} className="flex items-center gap-2 py-1">
                  <Checkbox 
                    checked={filtrosTipoEquipe.includes(value)}
                    onCheckedChange={(checked) => {
                      if (checked) setFiltrosTipoEquipe([...filtrosTipoEquipe, value]);
                      else setFiltrosTipoEquipe(filtrosTipoEquipe.filter(t => t !== value));
                    }}
                  />
                  <span className="text-xs">{label}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Equipe */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
              Equipe
              {filtrosEquipe.length > 0 && (
                <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {filtrosEquipe.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <div className="space-y-2">
              <Input placeholder="Buscar..." value={buscaEquipe} onChange={e => setBuscaEquipe(e.target.value)} className="h-7 text-xs" />
              <ScrollArea className="h-40">
                {equipesFiltradas2.map(e => (
                  <div key={e.id} className="flex items-center gap-2 py-1">
                    <Checkbox 
                      checked={filtrosEquipe.includes(e.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setFiltrosEquipe([...filtrosEquipe, e.id]);
                        else setFiltrosEquipe(filtrosEquipe.filter(id => id !== e.id));
                      }}
                    />
                    <span className="text-xs">{e.codigo} - {e.nome}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

        {/* Grupo de Serviço */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
              <Zap className="h-3 w-3" />
              Grupo Serviço
              {filtrosGrupoServico.length > 0 && (
                <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {filtrosGrupoServico.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="space-y-2">
              <Input placeholder="Buscar..." value={buscaGrupoServico} onChange={e => setBuscaGrupoServico(e.target.value)} className="h-7 text-xs" />
              <ScrollArea className="h-40">
                {gruposServicoFiltrados.map(grupo => (
                  <div key={grupo} className="flex items-center gap-2 py-1">
                    <Checkbox 
                      checked={filtrosGrupoServico.includes(grupo)}
                      onCheckedChange={(checked) => {
                        if (checked) setFiltrosGrupoServico([...filtrosGrupoServico, grupo]);
                        else setFiltrosGrupoServico(filtrosGrupoServico.filter(g => g !== grupo));
                      }}
                    />
                    <span className="text-xs">{grupo}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

        {temFiltrosAtivos && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={limparFiltros}>
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
            <TabsTrigger value="grupo-servico" className="text-xs">
              <Zap className="h-4 w-4 mr-1" /> Por Grupo Serviço
            </TabsTrigger>
            <TabsTrigger value="ranking" className="text-xs">
              <Award className="h-4 w-4 mr-1" /> Ranking
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="text-xs">
              <Activity className="h-4 w-4 mr-1" /> Evolução
            </TabsTrigger>
          </TabsList>

          {/* Tab Visão Geral */}
          <TabsContent value="visao-geral" className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className={cn(
                "bg-gradient-to-br",
                kpis.assertividadeGeral >= 90 ? "from-green-500/10 to-green-600/5" :
                kpis.assertividadeGeral >= 70 ? "from-amber-500/10 to-amber-600/5" :
                "from-red-500/10 to-red-600/5"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">Assertividade</span>
                  </div>
                  <div className={cn(
                    "text-2xl font-bold",
                    kpis.assertividadeGeral >= 90 ? "text-green-600" :
                    kpis.assertividadeGeral >= 70 ? "text-amber-600" : "text-red-600"
                  )}>
                    {kpis.assertividadeGeral.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Total Visitas</span>
                  </div>
                  <div className="text-2xl font-bold">{kpis.totalVisitas}</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Executadas</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{kpis.executadas}</div>
                  <div className="text-[10px] text-muted-foreground">{kpis.percentualExecutado.toFixed(1)}%</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-muted-foreground">Impedimentos</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{kpis.impedimentos}</div>
                  <div className="text-[10px] text-muted-foreground">{kpis.percentualImpedimento.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pizza de distribuição */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Distribuição de Visitas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { name: "Executadas", value: kpis.executadas, fill: "#10b981" },
                            { name: "Impedimentos", value: kpis.impedimentos, fill: "#ef4444" },
                            { name: "Sem Retorno", value: kpis.semRetorno, fill: "#9ca3af" },
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        />
                        <Tooltip formatter={(value: number) => [value, "Visitas"]} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Assertividade por tipo de equipe */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Assertividade por Tipo de Equipe</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dadosPorTipoEquipe} layout="vertical" margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Assertividade"]} />
                        <Bar dataKey="assertividade" name="Assertividade" radius={[0, 4, 4, 0]}>
                          {dadosPorTipoEquipe.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.assertividade >= 90 ? "#10b981" : entry.assertividade >= 70 ? "#f59e0b" : "#ef4444"} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Por Grupo de Serviço */}
          <TabsContent value="grupo-servico" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gráfico de barras */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Assertividade por Grupo de Serviço</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dadosPorGrupoServico} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="grupoUpper" 
                          tick={{ fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="executadas" name="Executadas" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="impedimentos" name="Impedimentos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="assertividade" name="% Assertividade" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Tabela detalhada */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Detalhamento por Grupo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grupo</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="text-center">Exec.</TableHead>
                          <TableHead className="text-center">Imped.</TableHead>
                          <TableHead className="text-right">Assert.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosPorGrupoServico.map(d => (
                          <TableRow key={d.grupo}>
                            <TableCell>
                              <Badge variant="outline">{d.grupoUpper}</Badge>
                            </TableCell>
                            <TableCell className="text-center">{d.total}</TableCell>
                            <TableCell className="text-center text-green-600 font-medium">{d.executadas}</TableCell>
                            <TableCell className="text-center text-red-600 font-medium">{d.impedimentos}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn(
                                "font-bold",
                                d.assertividade >= 90 ? "text-green-600" :
                                d.assertividade >= 70 ? "text-amber-600" : "text-red-600"
                              )}>
                                {d.assertividade.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Ranking */}
          <TabsContent value="ranking" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Ranking de Assertividade por Equipe
                  <Badge variant="outline" className="font-normal text-[10px]">
                    Ordenado por % (melhor → pior)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Exec.</TableHead>
                        <TableHead className="text-center">Imped.</TableHead>
                        <TableHead className="text-right">Valor Exec.</TableHead>
                        <TableHead className="text-right">Assertividade</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosPorEquipe.map((d, idx) => (
                        <TableRow key={d.equipe.id}>
                          <TableCell className="font-medium">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className="text-[10px]"
                                style={{ borderColor: tipoEquipeLabels[d.equipe.tipo_equipe || "normal"]?.color }}
                              >
                                {d.equipe.codigo}
                              </Badge>
                              <span className="text-sm truncate max-w-[150px]">{d.equipe.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{d.totalVisitas}</TableCell>
                          <TableCell className="text-center text-green-600 font-medium">{d.executadas}</TableCell>
                          <TableCell className="text-center text-red-600 font-medium">{d.impedimentos}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(d.valorExecutado)}</TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-bold",
                              d.assertividade >= 90 ? "text-green-600" :
                              d.assertividade >= 70 ? "text-amber-600" : "text-red-600"
                            )}>
                              {d.assertividade.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full transition-all",
                                  d.assertividade >= 90 ? "bg-green-500" :
                                  d.assertividade >= 70 ? "bg-amber-500" : "bg-red-500"
                                )}
                                style={{ width: `${Math.min(d.assertividade, 100)}%` }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Evolução */}
          <TabsContent value="evolucao" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Evolução Diária da Assertividade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={evolucaoDiaria} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="executadas" name="Executadas" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="impedimentos" name="Impedimentos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="assertividade" name="% Assertividade" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </MainLayout>
  );
}

