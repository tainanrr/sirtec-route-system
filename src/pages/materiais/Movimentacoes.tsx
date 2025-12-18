import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead, SortConfig } from "@/components/ui/sortable-table-head";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Search,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  Package,
  Truck,
  User,
  FileText,
  QrCode,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface Movimentacao {
  id: string;
  material_id: string;
  tipo: string;
  quantidade: number;
  quantidade_anterior: number | null;
  quantidade_nova: number | null;
  local_origem_tipo: string | null;
  local_origem_id: string | null;
  local_destino_tipo: string | null;
  local_destino_id: string | null;
  documento_referencia: string | null;
  observacao: string | null;
  created_at: string;
  created_by: string | null;
  recebimento_id?: string | null;
  entrega_id?: string | null;
  valor_unitario?: number | null;
  valor_total?: number | null;
  materiais: {
    codigo: string;
    nome: string;
    unidade: string;
    valor_unitario?: number | null;
  };
  ordem_servico_id: string | null;
}

function formatCurrencyBRL(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function isMissingColumnError(err: any, column: string) {
  const msg = String(err?.message || "");
  return msg.toLowerCase().includes("column") && msg.toLowerCase().includes(column.toLowerCase());
}

async function fetchMovimentacoesSafe(params: {
  filtroTipo: string;
  dataInicioISO: string;
  rangeFrom?: number;
  rangeTo?: number;
}) {
  // Tenta buscar com colunas novas (valor_unitario/valor_total/recebimento_id/entrega_id).
  try {
    let query = supabase
      .from("materiais_movimentacoes")
      .select(`
        id,
        material_id,
        tipo,
        quantidade,
        quantidade_anterior,
        quantidade_nova,
        local_origem_tipo,
        local_origem_id,
        local_destino_tipo,
        local_destino_id,
        documento_referencia,
        observacao,
        created_at,
        created_by,
        ordem_servico_id,
        recebimento_id,
        entrega_id,
        valor_unitario,
        valor_total,
        materiais!inner (codigo, nome, unidade, valor_unitario)
      `)
      .gte("created_at", params.dataInicioISO)
      .order("created_at", { ascending: false });

    if (params.filtroTipo !== "todos") {
      query = query.eq("tipo", params.filtroTipo);
    }

    if (params.rangeFrom != null && params.rangeTo != null) {
      query = query.range(params.rangeFrom, params.rangeTo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Movimentacao[];
  } catch (err: any) {
    // Fallback para bancos que ainda não aplicaram migrations de colunas novas.
    if (
      isMissingColumnError(err, "valor_unitario") ||
      isMissingColumnError(err, "valor_total") ||
      isMissingColumnError(err, "recebimento_id") ||
      isMissingColumnError(err, "entrega_id")
    ) {
      let query = supabase
        .from("materiais_movimentacoes")
        .select(`
          id,
          material_id,
          tipo,
          quantidade,
          quantidade_anterior,
          quantidade_nova,
          local_origem_tipo,
          local_origem_id,
          local_destino_tipo,
          local_destino_id,
          documento_referencia,
          observacao,
          created_at,
          created_by,
          ordem_servico_id,
          materiais!inner (codigo, nome, unidade, valor_unitario)
        `)
        .gte("created_at", params.dataInicioISO)
        .order("created_at", { ascending: false });

      if (params.filtroTipo !== "todos") {
        query = query.eq("tipo", params.filtroTipo);
      }
      if (params.rangeFrom != null && params.rangeTo != null) {
        query = query.range(params.rangeFrom, params.rangeTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]).map((m) => ({ ...m, valor_unitario: null, valor_total: null, recebimento_id: null, entrega_id: null })) as Movimentacao[];
    }
    throw err;
  }
}

const TIPOS_MOVIMENTACAO = [
  { value: "entrada", label: "Entrada", color: "bg-green-100 text-green-700", icon: ArrowUpRight },
  { value: "saida", label: "Saída", color: "bg-red-100 text-red-700", icon: ArrowDownRight },
  { value: "transferencia", label: "Transferência", color: "bg-blue-100 text-blue-700", icon: Truck },
  { value: "ajuste", label: "Ajuste", color: "bg-amber-100 text-amber-700", icon: RefreshCw },
];

export default function Movimentacoes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("7");
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 50;
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [rastroDialog, setRastroDialog] = useState<{ open: boolean; title: string; serials: string[] }>({
    open: false,
    title: "",
    serials: [],
  });

  const handleExport = async () => {
    try {
      toast.loading("Gerando exportação...", { id: "mov-export" });

      const dataInicio = subDays(new Date(), parseInt(filtroPeriodo));
      const dataInicioISO = startOfDay(dataInicio).toISOString();

      // Buscar tudo do período/filtro (paginações de 1000)
      const pageSize = 1000;
      let from = 0;
      let all: Movimentacao[] = [];

      while (true) {
        const chunk = await fetchMovimentacoesSafe({
          filtroTipo,
          dataInicioISO,
          rangeFrom: from,
          rangeTo: from + pageSize - 1,
        });
        if (!chunk.length) break;
        all = all.concat(chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }

      // Aplicar busca (mesma regra da tela)
      let filtered = all;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = all.filter(
          (mov) =>
            mov.materiais.codigo.toLowerCase().includes(term) ||
            mov.materiais.nome.toLowerCase().includes(term) ||
            mov.documento_referencia?.toLowerCase().includes(term)
        );
      }

      if (!filtered.length) {
        toast.error("Nada para exportar com os filtros atuais.", { id: "mov-export" });
        return;
      }

      // Buscar serials/rastros (best-effort)
      const recIds = Array.from(new Set(filtered.map((m) => m.recebimento_id).filter(Boolean))) as string[];
      const entIds = Array.from(new Set(filtered.map((m) => m.entrega_id).filter(Boolean))) as string[];

      const serialsByRecMat = new Map<string, string[]>();
      if (recIds.length) {
        const { data: rastros } = await supabase
          .from("materiais_recebimentos_itens_rastros")
          .select("recebimento_id, material_id, numero_serie")
          .in("recebimento_id", recIds);
        (rastros || []).forEach((r: any) => {
          const k = `${r.recebimento_id}::${r.material_id}`;
          const arr = serialsByRecMat.get(k) || [];
          arr.push(String(r.numero_serie || "").toUpperCase());
          serialsByRecMat.set(k, arr);
        });
      }

      const serialsByEntMat = new Map<string, string[]>();
      if (entIds.length) {
        const { data: itens } = await supabase
          .from("materiais_entregas_itens")
          .select("entrega_id, material_id, numero_serie")
          .in("entrega_id", entIds);
        (itens || []).forEach((i: any) => {
          if (!i.numero_serie) return;
          const k = `${i.entrega_id}::${i.material_id}`;
          const arr = serialsByEntMat.get(k) || [];
          arr.push(String(i.numero_serie || "").toUpperCase());
          serialsByEntMat.set(k, arr);
        });
      }

      const linhas = filtered.map((m) => {
        const unit = m.valor_unitario ?? m.materiais.valor_unitario ?? null;
        const total = m.valor_total ?? (unit != null ? Number(unit) * Number(m.quantidade) : null);

        const serials =
          (m.recebimento_id ? serialsByRecMat.get(`${m.recebimento_id}::${m.material_id}`) : null) ||
          (m.entrega_id ? serialsByEntMat.get(`${m.entrega_id}::${m.material_id}`) : null) ||
          [];

        return {
          id: m.id,
          created_at: m.created_at,
          tipo: m.tipo,
          material_id: m.material_id,
          material_codigo: m.materiais.codigo,
          material_nome: m.materiais.nome,
          unidade: m.materiais.unidade,
          quantidade: m.quantidade,
          valor_unitario: unit,
          valor_total: total,
          serial_count: serials.length || null,
          serials: serials.length ? serials.join("\n") : null,
          local_origem: getLocalLabel(m.local_origem_tipo, m.local_origem_id),
          local_destino: getLocalLabel(m.local_destino_tipo, m.local_destino_id),
          documento: m.documento_referencia,
          observacao: m.observacao,
          recebimento_id: m.recebimento_id || null,
          entrega_id: m.entrega_id || null,
          ordem_servico_id: m.ordem_servico_id || null,
        };
      });

      // Linhas detalhadas (1 por serial quando existir)
      const detalhadas = filtered.flatMap((m) => {
        const unit = m.valor_unitario ?? m.materiais.valor_unitario ?? null;
        const total = m.valor_total ?? (unit != null ? Number(unit) * Number(m.quantidade) : null);
        const serials =
          (m.recebimento_id ? serialsByRecMat.get(`${m.recebimento_id}::${m.material_id}`) : null) ||
          (m.entrega_id ? serialsByEntMat.get(`${m.entrega_id}::${m.material_id}`) : null) ||
          [];

        if (!serials.length) {
          return [{
            movimentacao_id: m.id,
            created_at: m.created_at,
            tipo: m.tipo,
            material_codigo: m.materiais.codigo,
            material_nome: m.materiais.nome,
            quantidade: m.quantidade,
            valor_unitario: unit,
            valor_total: total,
            numero_serie: null,
            documento: m.documento_referencia,
            observacao: m.observacao,
          }];
        }

        return serials.map((ns) => ({
          movimentacao_id: m.id,
          created_at: m.created_at,
          tipo: m.tipo,
          material_codigo: m.materiais.codigo,
          material_nome: m.materiais.nome,
          quantidade: 1,
          valor_unitario: unit,
          valor_total: unit != null ? Number(unit) : null,
          numero_serie: ns,
          documento: m.documento_referencia,
          observacao: m.observacao,
        }));
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Movimentacoes");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhadas), "MovimentacoesDetalhadas");
      XLSX.writeFile(wb, `movimentacoes-export-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);

      toast.success("Exportação gerada!", { id: "mov-export" });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao exportar", { id: "mov-export" });
    }
  };

  // Query para movimentações
  const { data: movimentacoes, isLoading } = useQuery({
    queryKey: ["movimentacoes", filtroTipo, filtroPeriodo, searchTerm, currentPage],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(filtroPeriodo));
      const data = await fetchMovimentacoesSafe({
        filtroTipo,
        dataInicioISO: startOfDay(dataInicio).toISOString(),
        rangeFrom: currentPage * ITEMS_PER_PAGE,
        rangeTo: (currentPage + 1) * ITEMS_PER_PAGE - 1,
      });

      // Filtrar por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (data as Movimentacao[]).filter(
          (mov) =>
            mov.materiais.codigo.toLowerCase().includes(term) ||
            mov.materiais.nome.toLowerCase().includes(term) ||
            mov.documento_referencia?.toLowerCase().includes(term)
        );
      }

      return data as Movimentacao[];
    },
  });

  // Serial/rastrros (best-effort) para a página atual
  const { data: serialsMap } = useQuery({
    queryKey: ["movimentacoes-serials", movimentacoes?.map((m) => m.id).join("|")],
    enabled: !!movimentacoes?.length,
    queryFn: async () => {
      const movs = movimentacoes || [];
      const recIds = Array.from(new Set(movs.map((m) => m.recebimento_id).filter(Boolean))) as string[];
      const entIds = Array.from(new Set(movs.map((m) => m.entrega_id).filter(Boolean))) as string[];

      const map = new Map<string, string[]>(); // key: mov.id -> serials

      // Recebimentos: rastros por recebimento_id + material_id
      if (recIds.length) {
        const { data: rastros } = await supabase
          .from("materiais_recebimentos_itens_rastros")
          .select("recebimento_id, material_id, numero_serie")
          .in("recebimento_id", recIds);

        const byRecMat = new Map<string, string[]>();
        (rastros || []).forEach((r: any) => {
          const k = `${r.recebimento_id}::${r.material_id}`;
          const arr = byRecMat.get(k) || [];
          arr.push(String(r.numero_serie || "").toUpperCase());
          byRecMat.set(k, arr);
        });

        movs.forEach((m) => {
          if (!m.recebimento_id) return;
          const k = `${m.recebimento_id}::${m.material_id}`;
          const serials = byRecMat.get(k) || [];
          if (serials.length) map.set(m.id, serials);
        });
      }

      // Entregas: numero_serie por entrega_id + material_id
      if (entIds.length) {
        const { data: itens } = await supabase
          .from("materiais_entregas_itens")
          .select("entrega_id, material_id, numero_serie")
          .in("entrega_id", entIds);

        const byEntMat = new Map<string, string[]>();
        (itens || []).forEach((i: any) => {
          if (!i.numero_serie) return;
          const k = `${i.entrega_id}::${i.material_id}`;
          const arr = byEntMat.get(k) || [];
          arr.push(String(i.numero_serie || "").toUpperCase());
          byEntMat.set(k, arr);
        });

        movs.forEach((m) => {
          if (!m.entrega_id) return;
          const k = `${m.entrega_id}::${m.material_id}`;
          const serials = byEntMat.get(k) || [];
          if (serials.length) map.set(m.id, serials);
        });
      }

      return map;
    },
  });

  // Query para contagem total
  const { data: totalCount } = useQuery({
    queryKey: ["movimentacoes-count", filtroTipo, filtroPeriodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(filtroPeriodo));

      let query = supabase
        .from("materiais_movimentacoes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfDay(dataInicio).toISOString());

      if (filtroTipo !== "todos") {
        query = query.eq("tipo", filtroTipo);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Query para estatísticas do período
  const { data: stats } = useQuery({
    queryKey: ["movimentacoes-stats", filtroPeriodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(filtroPeriodo));

      const { data, error } = await supabase
        .from("materiais_movimentacoes")
        .select("tipo, quantidade")
        .gte("created_at", startOfDay(dataInicio).toISOString());

      if (error) throw error;

      const entradas = data?.filter((m: any) => m.tipo === "entrada").reduce((acc, m) => acc + m.quantidade, 0) || 0;
      const saidas = data?.filter((m: any) => m.tipo === "saida").reduce((acc, m) => acc + m.quantidade, 0) || 0;
      const transferencias = data?.filter((m: any) => m.tipo === "transferencia").length || 0;
      const ajustes = data?.filter((m: any) => m.tipo === "ajuste").length || 0;

      return { entradas, saidas, transferencias, ajustes, total: data?.length || 0 };
    },
  });

  // Query para buscar equipes (para exibir códigos corretos)
  const { data: equipesMap } = useQuery({
    queryKey: ["equipes-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome");

      if (error) throw error;

      const map: Record<string, { codigo: string; nome: string }> = {};
      data?.forEach((equipe: any) => {
        map[equipe.id] = { codigo: equipe.codigo, nome: equipe.nome };
      });
      return map;
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const getTipoConfig = (tipo: string) => {
    return TIPOS_MOVIMENTACAO.find((t) => t.value === tipo) || TIPOS_MOVIMENTACAO[0];
  };

  const getLocalLabel = (tipo: string | null, id: string | null) => {
    if (!tipo) return "-";
    if (tipo === "central") return "Estoque Central";
    if (tipo === "equipe") {
      // Buscar código real da equipe
      if (id && equipesMap?.[id]) {
        return `Equipe ${equipesMap[id].codigo}`;
      }
      return `Equipe ${id?.substring(0, 8) || ""}`;
    }
    if (tipo === "campo") return "Campo/OS";
    if (tipo === "externo") return "Externo";
    return tipo;
  };

  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  // Handler de ordenação
  const handleSort = (column: string) => {
    setSortConfig((current) => {
      if (current?.column === column) {
        if (current.direction === "asc") {
          return { column, direction: "desc" };
        } else if (current.direction === "desc") {
          return null;
        }
      }
      return { column, direction: "asc" };
    });
  };

  // Ordenar movimentações
  const movimentacoesOrdenadas = useMemo(() => {
    if (!movimentacoes || !sortConfig || !sortConfig.direction) {
      return movimentacoes;
    }

    return [...movimentacoes].sort((a: any, b: any) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.column) {
        case "created_at":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case "material":
          aValue = a.materiais?.codigo || "";
          bValue = b.materiais?.codigo || "";
          break;
        case "tipo":
          aValue = a.tipo;
          bValue = b.tipo;
          break;
        case "quantidade":
          aValue = a.quantidade;
          bValue = b.quantidade;
          break;
        case "origem":
          aValue = a.local_origem_tipo || "";
          bValue = b.local_origem_tipo || "";
          break;
        case "destino":
          aValue = a.local_destino_tipo || "";
          bValue = b.local_destino_tipo || "";
          break;
        default:
          aValue = a[sortConfig.column];
          bValue = b[sortConfig.column];
      }

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === "asc" ? 1 : -1;
      if (bValue == null) return sortConfig.direction === "asc" ? -1 : 1;

      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue, "pt-BR", { numeric: true });
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue), "pt-BR");
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [movimentacoes, sortConfig]);

  return (
    <MainLayout title="Movimentações">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link to="/materiais">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <History className="h-6 w-6 text-violet-600" />
                Movimentações
              </h1>
              <p className="text-muted-foreground text-sm">
                Histórico de entradas, saídas e transferências
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <History className="h-8 w-8 text-violet-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entradas</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.entradas || 0}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saídas</p>
                  <p className="text-2xl font-bold text-red-600">{stats?.saidas || 0}</p>
                </div>
                <ArrowDownRight className="h-8 w-8 text-red-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Transferências</p>
                  <p className="text-2xl font-bold text-blue-600">{stats?.transferencias || 0}</p>
                </div>
                <Truck className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ajustes</p>
                  <p className="text-2xl font-bold text-amber-600">{stats?.ajustes || 0}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por material ou documento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  {TIPOS_MOVIMENTACAO.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="15">Últimos 15 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : movimentacoesOrdenadas && movimentacoesOrdenadas.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        column="created_at"
                        label="Data/Hora"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHead
                        column="material"
                        label="Material"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHead
                        column="tipo"
                        label="Tipo"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableTableHead
                        column="quantidade"
                        label="Quantidade"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <TableHead className="text-center">Rastro/Serial</TableHead>
                      <SortableTableHead
                        column="valor_total"
                        label="Valor"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <SortableTableHead
                        column="origem"
                        label="Origem"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHead
                        column="destino"
                        label="Destino"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHead>Documento</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoesOrdenadas.map((mov) => {
                      const tipoConfig = getTipoConfig(mov.tipo);
                      const TipoIcon = tipoConfig.icon;

                      return (
                        <TableRow key={mov.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {format(new Date(mov.created_at), "dd/MM/yyyy")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(mov.created_at), "HH:mm:ss")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{mov.materiais.codigo}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {mov.materiais.nome}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${tipoConfig.color} border-0`}>
                              <TipoIcon className="h-3 w-3 mr-1" />
                              {tipoConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${
                              mov.tipo === "entrada" ? "text-green-600" :
                              mov.tipo === "saida" ? "text-red-600" : ""
                            }`}>
                              {mov.tipo === "entrada" ? "+" : mov.tipo === "saida" ? "-" : ""}
                              {mov.quantidade} {mov.materiais.unidade}
                            </span>
                            {mov.quantidade_anterior !== null && mov.quantidade_nova !== null && (
                              <p className="text-xs text-muted-foreground">
                                {mov.quantidade_anterior} → {mov.quantidade_nova}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              const serials = serialsMap?.get(mov.id) || [];
                              if (!serials.length) return <span className="text-muted-foreground text-xs">-</span>;
                              return (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() =>
                                    setRastroDialog({
                                      open: true,
                                      title: `${mov.materiais.codigo} • ${serials.length} rastro(s)`,
                                      serials,
                                    })
                                  }
                                >
                                  <QrCode className="h-3 w-3 mr-1" />
                                  Ver ({serials.length})
                                </Button>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">
                                {formatCurrencyBRL(mov.valor_total ?? (mov.valor_unitario ?? mov.materiais.valor_unitario) != null ? Number(mov.valor_unitario ?? mov.materiais.valor_unitario) * Number(mov.quantidade) : null)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrencyBRL(mov.valor_unitario ?? mov.materiais.valor_unitario)} / un
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {getLocalLabel(mov.local_origem_tipo, mov.local_origem_id)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {getLocalLabel(mov.local_destino_tipo, mov.local_destino_id)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {mov.documento_referencia ? (
                              <Badge variant="outline" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                {mov.documento_referencia}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground line-clamp-1 max-w-[150px]">
                              {mov.observacao || "-"}
                            </p>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {currentPage * ITEMS_PER_PAGE + 1} a{" "}
                      {Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalCount || 0)} de{" "}
                      {totalCount} registros
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage((p) => p - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma movimentação encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={rastroDialog.open} onOpenChange={(open) => setRastroDialog((p) => ({ ...p, open }))}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{rastroDialog.title || "Rastros/Seriais"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea value={rastroDialog.serials.join("\n")} readOnly rows={12} className="font-mono" />
              <DialogFooter>
                <Button variant="outline" onClick={() => setRastroDialog({ open: false, title: "", serials: [] })}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}



