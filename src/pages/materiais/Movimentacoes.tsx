import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface Movimentacao {
  id: string;
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
  materiais: {
    codigo: string;
    nome: string;
    unidade: string;
  };
  ordem_servico_id: string | null;
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

  // Query para movimentações
  const { data: movimentacoes, isLoading } = useQuery({
    queryKey: ["movimentacoes", filtroTipo, filtroPeriodo, searchTerm, currentPage],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(filtroPeriodo));

      let query = supabase
        .from("materiais_movimentacoes")
        .select(`
          id,
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
          materiais!inner (codigo, nome, unidade)
        `)
        .gte("created_at", startOfDay(dataInicio).toISOString())
        .order("created_at", { ascending: false })
        .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

      if (filtroTipo !== "todos") {
        query = query.eq("tipo", filtroTipo);
      }

      const { data, error } = await query;
      if (error) throw error;

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
          <Button variant="outline">
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
      </div>
    </MainLayout>
  );
}



