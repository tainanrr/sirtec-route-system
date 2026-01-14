import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Users,
  Search,
  ArrowLeft,
  Package,
  Eye,
  RefreshCw,
  Filter,
  User,
  Boxes,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  PackageOpen,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ExportButton } from "@/components/ui/export-button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EstoqueEquipeItem {
  id: string;
  material_id: string;
  quantidade: number;
  local_tipo: string;
  local_id: string;
  updated_at: string;
  origem_tipo?: string;
  materiais: {
    id: string;
    codigo: string;
    nome: string;
    unidade: string;
    categoria: string;
    valor_unitario: number | null;
    requer_serial: boolean;
  };
}

interface EquipeEstoque {
  id: string;
  codigo: string;
  nome: string;
  itens: EstoqueEquipeItem[];
  totalItens: number;
  totalQuantidade: number;
  valorTotal: number;
}

export default function EstoqueEquipes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEquipe, setFiltroEquipe] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todos");
  const [expandedEquipes, setExpandedEquipes] = useState<string[]>([]);
  const [detalhesDialog, setDetalhesDialog] = useState(false);
  const [equipeDetalhe, setEquipeDetalhe] = useState<EquipeEstoque | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Query para buscar estoque de todas as equipes
  const { data: estoqueEquipes, isLoading, refetch } = useQuery({
    queryKey: ["estoque-equipes", searchTerm, filtroEquipe, filtroCategoria, filtroOrigem],
    queryFn: async () => {
      // Buscar estoque das equipes
      const { data: estoqueData, error: estoqueError } = await supabase
        .from("materiais_estoque")
        .select(`
          id,
          material_id,
          quantidade,
          local_tipo,
          local_id,
          updated_at,
          origem_tipo,
          materiais!inner (
            id,
            codigo,
            nome,
            unidade,
            categoria,
            valor_unitario,
            requer_serial
          )
        `)
        .eq("local_tipo", "equipe")
        .gt("quantidade", 0);

      if (estoqueError) throw estoqueError;

      // Buscar equipes
      const equipeIds = [...new Set((estoqueData as EstoqueEquipeItem[]).map(e => e.local_id))];
      
      const { data: equipesData, error: equipesError } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome")
        .in("id", equipeIds);

      if (equipesError) throw equipesError;

      // Agrupar por equipe
      const equipesMap = new Map<string, EquipeEstoque>();

      (equipesData || []).forEach((equipe: any) => {
        equipesMap.set(equipe.id, {
          id: equipe.id,
          codigo: equipe.codigo,
          nome: equipe.nome,
          itens: [],
          totalItens: 0,
          totalQuantidade: 0,
          valorTotal: 0,
        });
      });

      (estoqueData as EstoqueEquipeItem[]).forEach((item) => {
        const equipe = equipesMap.get(item.local_id);
        if (equipe) {
          // Aplicar filtros
          let incluir = true;

          if (searchTerm) {
            const term = searchTerm.toLowerCase();
            incluir = item.materiais.codigo.toLowerCase().includes(term) ||
                      item.materiais.nome.toLowerCase().includes(term) ||
                      equipe.codigo.toLowerCase().includes(term) ||
                      equipe.nome.toLowerCase().includes(term);
          }

          if (filtroCategoria !== "todos" && item.materiais.categoria !== filtroCategoria) {
            incluir = false;
          }

          if (filtroOrigem !== "todos" && item.origem_tipo !== filtroOrigem) {
            incluir = false;
          }

          if (incluir) {
            equipe.itens.push(item);
            equipe.totalItens++;
            equipe.totalQuantidade += item.quantidade;
            equipe.valorTotal += item.quantidade * (item.materiais.valor_unitario || 0);
          }
        }
      });

      let equipes = Array.from(equipesMap.values()).filter(e => e.totalItens > 0);

      // Filtrar por equipe específica
      if (filtroEquipe !== "todos") {
        equipes = equipes.filter(e => e.id === filtroEquipe);
      }

      // Ordenar por código da equipe
      equipes.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));

      return equipes;
    },
  });

  // Query para estatísticas gerais
  const { data: stats } = useQuery({
    queryKey: ["estoque-equipes-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_estoque")
        .select(`
          quantidade,
          local_id,
          materiais (valor_unitario)
        `)
        .eq("local_tipo", "equipe")
        .gt("quantidade", 0);

      if (error) throw error;

      const equipesComEstoque = new Set((data || []).map((d: any) => d.local_id)).size;
      const totalItens = data?.length || 0;
      const totalQuantidade = data?.reduce((acc: number, item: any) => acc + item.quantidade, 0) || 0;
      const valorTotal = data?.reduce((acc: number, item: any) => {
        return acc + item.quantidade * (item.materiais?.valor_unitario || 0);
      }, 0) || 0;

      return {
        equipesComEstoque,
        totalItens,
        totalQuantidade,
        valorTotal,
      };
    },
  });

  // Query para lista de equipes (para o filtro)
  const { data: equipes } = useQuery({
    queryKey: ["equipes-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("codigo");

      if (error) throw error;
      return data;
    },
  });

  // Query para categorias
  const { data: categorias } = useQuery({
    queryKey: ["materiais-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("categoria")
        .eq("ativo", true);

      if (error) throw error;

      const uniqueCategorias = [...new Set(data?.map((m: any) => m.categoria))];
      return uniqueCategorias;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const toggleEquipe = (equipeId: string) => {
    setExpandedEquipes((prev) =>
      prev.includes(equipeId)
        ? prev.filter((id) => id !== equipeId)
        : [...prev, equipeId]
    );
  };

  const handleVerDetalhes = (equipe: EquipeEstoque) => {
    setEquipeDetalhe(equipe);
    setDetalhesDialog(true);
  };

  // Handler de ordenação para os itens da equipe
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

  // Ordenar itens da equipe em detalhes
  const sortedItens = useMemo(() => {
    if (!equipeDetalhe?.itens || !sortConfig || !sortConfig.direction) {
      return equipeDetalhe?.itens;
    }

    return [...equipeDetalhe.itens].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.column) {
        case "codigo":
          aValue = a.materiais?.codigo || "";
          bValue = b.materiais?.codigo || "";
          break;
        case "nome":
          aValue = a.materiais?.nome || "";
          bValue = b.materiais?.nome || "";
          break;
        case "quantidade":
          aValue = a.quantidade;
          bValue = b.quantidade;
          break;
        case "valor":
          aValue = a.quantidade * (a.materiais?.valor_unitario || 0);
          bValue = b.quantidade * (b.materiais?.valor_unitario || 0);
          break;
        case "origem":
          aValue = a.origem_tipo || "";
          bValue = b.origem_tipo || "";
          break;
        default:
          aValue = a[sortConfig.column as keyof EstoqueEquipeItem];
          bValue = b[sortConfig.column as keyof EstoqueEquipeItem];
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
  }, [equipeDetalhe?.itens, sortConfig]);

  // Preparar dados para exportação
  const dadosExportacao = useMemo(() => {
    if (!estoqueEquipes) return [];

    const dados: any[] = [];
    estoqueEquipes.forEach((equipe) => {
      equipe.itens.forEach((item) => {
        dados.push({
          equipe_codigo: equipe.codigo,
          equipe_nome: equipe.nome,
          material_codigo: item.materiais.codigo,
          material_nome: item.materiais.nome,
          categoria: item.materiais.categoria,
          unidade: item.materiais.unidade,
          quantidade: item.quantidade,
          valor_unitario: item.materiais.valor_unitario || 0,
          valor_total: item.quantidade * (item.materiais.valor_unitario || 0),
          origem: item.origem_tipo || "entrega",
          ultima_atualizacao: format(new Date(item.updated_at), "dd/MM/yyyy HH:mm"),
        });
      });
    });

    return dados;
  }, [estoqueEquipes]);

  return (
    <MainLayout title="Estoque Equipes" breadcrumbs={[{ label: "Materiais" }, { label: "Estoque Equipes" }]}>
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
                <Users className="h-6 w-6 text-indigo-600" />
                Estoque das Equipes
              </h1>
              <p className="text-muted-foreground text-sm">
                Visualize os materiais que estão em posse de cada equipe
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ExportButton
              data={dadosExportacao}
              filename="estoque_equipes"
              columns={[
                { key: "equipe_codigo", label: "Cód. Equipe" },
                { key: "equipe_nome", label: "Nome Equipe" },
                { key: "material_codigo", label: "Cód. Material" },
                { key: "material_nome", label: "Material" },
                { key: "categoria", label: "Categoria" },
                { key: "unidade", label: "Unidade" },
                { key: "quantidade", label: "Quantidade" },
                { key: "valor_unitario", label: "Valor Unit.", format: (v: number) => formatCurrency(v) },
                { key: "valor_total", label: "Valor Total", format: (v: number) => formatCurrency(v) },
                { key: "origem", label: "Origem" },
                { key: "ultima_atualizacao", label: "Última Atualização" },
              ]}
              disabled={isLoading || !dadosExportacao.length}
            />
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Equipes com Estoque</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats?.equipesComEstoque || 0}</p>
                </div>
                <Users className="h-8 w-8 text-indigo-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tipos de Material</p>
                  <p className="text-2xl font-bold text-blue-600">{stats?.totalItens || 0}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Itens</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats?.totalQuantidade || 0}</p>
                </div>
                <Boxes className="h-8 w-8 text-emerald-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <CardContent className="pt-4">
              <div>
                <p className="text-indigo-100 text-sm">Valor Total</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.valorTotal || 0)}</p>
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
                    placeholder="Buscar por equipe, código ou material..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Equipes</SelectItem>
                  {equipes?.map((eq: any) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.codigo} - {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Categorias</SelectItem>
                  {categorias?.map((cat: string) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Origens</SelectItem>
                  <SelectItem value="entrega">Entrega Normal</SelectItem>
                  <SelectItem value="retirado_campo">Retirado em Campo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Equipes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Estoque por Equipe
            </CardTitle>
            <CardDescription>
              Clique em uma equipe para expandir e ver os materiais
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : estoqueEquipes && estoqueEquipes.length > 0 ? (
              <div className="divide-y">
                {estoqueEquipes.map((equipe) => (
                  <div key={equipe.id} className="border-b last:border-b-0">
                    {/* Header da Equipe */}
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleEquipe(equipe.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <User className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-semibold flex items-center gap-2">
                            {equipe.codigo}
                            <span className="text-muted-foreground font-normal">-</span>
                            {equipe.nome}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Package className="h-3.5 w-3.5" />
                              {equipe.totalItens} tipos
                            </span>
                            <span className="flex items-center gap-1">
                              <Boxes className="h-3.5 w-3.5" />
                              {equipe.totalQuantidade} itens
                            </span>
                            <span className="font-medium text-indigo-600">
                              {formatCurrency(equipe.valorTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerDetalhes(equipe);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detalhes
                        </Button>
                        {expandedEquipes.includes(equipe.id) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Itens da Equipe (expandido) */}
                    {expandedEquipes.includes(equipe.id) && (
                      <div className="bg-muted/30 px-4 pb-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Código</TableHead>
                              <TableHead>Material</TableHead>
                              <TableHead className="text-center">Qtd</TableHead>
                              <TableHead className="text-center">Origem</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {equipe.itens.slice(0, 10).map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono text-sm">
                                  {item.materiais.codigo}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{item.materiais.nome}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.materiais.categoria}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-bold">{item.quantidade}</span>
                                  <span className="text-muted-foreground text-xs ml-1">
                                    {item.materiais.unidade}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={item.origem_tipo === "retirado_campo" ? "secondary" : "outline"}>
                                    {item.origem_tipo === "retirado_campo" ? "Campo" : "Entrega"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(item.quantidade * (item.materiais.valor_unitario || 0))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {equipe.itens.length > 10 && (
                          <div className="text-center pt-2">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handleVerDetalhes(equipe)}
                            >
                              Ver todos os {equipe.itens.length} itens
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <PackageOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma equipe com estoque encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os materiais são enviados às equipes através da tela de Entregas
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Detalhes da Equipe */}
        <Dialog open={detalhesDialog} onOpenChange={setDetalhesDialog}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" />
                Estoque da Equipe: {equipeDetalhe?.codigo} - {equipeDetalhe?.nome}
              </DialogTitle>
            </DialogHeader>

            {equipeDetalhe && (
              <div className="space-y-4">
                {/* Resumo */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Tipos de Material</p>
                        <p className="text-2xl font-bold text-indigo-600">{equipeDetalhe.totalItens}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total de Itens</p>
                        <p className="text-2xl font-bold text-emerald-600">{equipeDetalhe.totalQuantidade}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Valor Total</p>
                        <p className="text-2xl font-bold text-purple-600">{formatCurrency(equipeDetalhe.valorTotal)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabela completa */}
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableTableHead
                            column="codigo"
                            label="Código"
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            className="w-[100px]"
                          />
                          <SortableTableHead
                            column="nome"
                            label="Material"
                            sortConfig={sortConfig}
                            onSort={handleSort}
                          />
                          <TableHead>Categoria</TableHead>
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
                            className="text-center"
                          />
                          <SortableTableHead
                            column="valor"
                            label="Valor Total"
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            className="text-right"
                          />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(sortedItens || equipeDetalhe.itens).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono font-medium">
                              {item.materiais.codigo}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{item.materiais.nome}</p>
                                {item.materiais.requer_serial && (
                                  <Badge variant="outline" className="text-xs">Rastro</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{item.materiais.categoria}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-bold text-lg">{item.quantidade}</span>
                              <span className="text-muted-foreground text-sm ml-1">
                                {item.materiais.unidade}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={item.origem_tipo === "retirado_campo" ? "default" : "outline"}
                                className={item.origem_tipo === "retirado_campo" ? "bg-amber-500" : ""}
                              >
                                {item.origem_tipo === "retirado_campo" ? "Retirado Campo" : "Entrega"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.quantidade * (item.materiais.valor_unitario || 0))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Ações */}
                <div className="flex justify-end gap-2">
                  <ExportButton
                    data={equipeDetalhe.itens.map(item => ({
                      codigo: item.materiais.codigo,
                      nome: item.materiais.nome,
                      categoria: item.materiais.categoria,
                      unidade: item.materiais.unidade,
                      quantidade: item.quantidade,
                      valor_unitario: item.materiais.valor_unitario || 0,
                      valor_total: item.quantidade * (item.materiais.valor_unitario || 0),
                      origem: item.origem_tipo || "entrega",
                    }))}
                    filename={`estoque_${equipeDetalhe.codigo}`}
                    columns={[
                      { key: "codigo", label: "Código" },
                      { key: "nome", label: "Material" },
                      { key: "categoria", label: "Categoria" },
                      { key: "unidade", label: "Unidade" },
                      { key: "quantidade", label: "Quantidade" },
                      { key: "valor_unitario", label: "Valor Unit.", format: (v: number) => formatCurrency(v) },
                      { key: "valor_total", label: "Valor Total", format: (v: number) => formatCurrency(v) },
                      { key: "origem", label: "Origem" },
                    ]}
                  />
                  <Button variant="outline" onClick={() => setDetalhesDialog(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
