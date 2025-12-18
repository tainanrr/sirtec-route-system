import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Warehouse,
  Search,
  ArrowLeft,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  History,
  RefreshCw,
  Filter,
  BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

interface EstoqueItem {
  id: string;
  material_id: string;
  quantidade: number;
  local_tipo: string;
  local_id: string | null;
  updated_at: string;
  materiais: {
    id: string;
    codigo: string;
    nome: string;
    unidade: string;
    categoria: string;
    estoque_minimo: number;
    estoque_maximo: number | null;
    valor_unitario: number | null;
    localizacao: string | null;
    requer_serial: boolean;
  };
}

interface MovimentacaoForm {
  tipo: "entrada" | "saida" | "ajuste";
  material_id: string;
  quantidade: number;
  observacao: string;
  documento_referencia: string;
}

export default function EstoqueCentral() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [movimentacaoDialog, setMovimentacaoDialog] = useState(false);
  const [movimentacaoForm, setMovimentacaoForm] = useState<MovimentacaoForm>({
    tipo: "entrada",
    material_id: "",
    quantidade: 0,
    observacao: "",
    documento_referencia: "",
  });
  const [selectedItem, setSelectedItem] = useState<EstoqueItem | null>(null);

  // Query para buscar estoque central
  const { data: estoque, isLoading } = useQuery({
    queryKey: ["estoque-central", searchTerm, filtroStatus, filtroCategoria],
    queryFn: async () => {
      let query = supabase
        .from("materiais_estoque")
        .select(`
          id,
          material_id,
          quantidade,
          local_tipo,
          local_id,
          updated_at,
          materiais!inner (
            id,
            codigo,
            nome,
            unidade,
            categoria,
            estoque_minimo,
            estoque_maximo,
            valor_unitario,
            localizacao,
            requer_serial
          )
        `)
        .eq("local_tipo", "central")
        .order("materiais(codigo)");

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data as EstoqueItem[];

      // Filtrar por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = filteredData.filter(
          (item) =>
            item.materiais.codigo.toLowerCase().includes(term) ||
            item.materiais.nome.toLowerCase().includes(term)
        );
      }

      // Filtrar por status de estoque
      if (filtroStatus === "baixo") {
        filteredData = filteredData.filter(
          (item) => item.quantidade > 0 && item.quantidade <= item.materiais.estoque_minimo
        );
      } else if (filtroStatus === "zerado") {
        filteredData = filteredData.filter((item) => item.quantidade <= 0);
      } else if (filtroStatus === "ok") {
        filteredData = filteredData.filter(
          (item) => item.quantidade > item.materiais.estoque_minimo
        );
      }

      // Filtrar por categoria
      if (filtroCategoria !== "todos") {
        filteredData = filteredData.filter(
          (item) => item.materiais.categoria === filtroCategoria
        );
      }

      return filteredData;
    },
  });

  // Query para estatísticas
  const { data: stats } = useQuery({
    queryKey: ["estoque-central-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_estoque")
        .select(`
          quantidade,
          materiais!inner (
            estoque_minimo,
            valor_unitario
          )
        `)
        .eq("local_tipo", "central");

      if (error) throw error;

      const total = data?.length || 0;
      const zerados = data?.filter((item: any) => item.quantidade <= 0).length || 0;
      const baixos = data?.filter(
        (item: any) => item.quantidade > 0 && item.quantidade <= (item.materiais?.estoque_minimo || 0)
      ).length || 0;
      const ok = total - zerados - baixos;

      const valorTotal = data?.reduce((acc: number, item: any) => {
        return acc + item.quantidade * (item.materiais?.valor_unitario || 0);
      }, 0) || 0;

      return { total, zerados, baixos, ok, valorTotal };
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

  // Query para materiais (para o select de movimentação)
  const { data: materiais } = useQuery({
    queryKey: ["materiais-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, codigo, nome, unidade")
        .eq("ativo", true)
        .order("codigo");

      if (error) throw error;
      return data;
    },
  });

  // Mutation para movimentação
  const movimentacaoMutation = useMutation({
    mutationFn: async (form: MovimentacaoForm) => {
      // Buscar estoque atual
      const { data: estoqueAtual, error: estoqueError } = await supabase
        .from("materiais_estoque")
        .select("id, quantidade")
        .eq("material_id", form.material_id)
        .eq("local_tipo", "central")
        .maybeSingle();

      if (estoqueError) throw estoqueError;

      let novaQuantidade: number;
      if (form.tipo === "entrada") {
        novaQuantidade = (estoqueAtual?.quantidade || 0) + form.quantidade;
      } else if (form.tipo === "saida") {
        novaQuantidade = (estoqueAtual?.quantidade || 0) - form.quantidade;
        if (novaQuantidade < 0) {
          throw new Error("Quantidade insuficiente em estoque");
        }
      } else {
        // Ajuste direto
        novaQuantidade = form.quantidade;
      }

      // Atualizar ou criar registro de estoque
      if (estoqueAtual) {
        const { error } = await supabase
          .from("materiais_estoque")
          .update({ quantidade: novaQuantidade, updated_at: new Date().toISOString() })
          .eq("id", estoqueAtual.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("materiais_estoque")
          .insert({
            material_id: form.material_id,
            quantidade: novaQuantidade,
            local_tipo: "central",
          });
        if (error) throw error;
      }

      // Registrar movimentação
      const { error: movError } = await supabase
        .from("materiais_movimentacoes")
        .insert({
          material_id: form.material_id,
          tipo: form.tipo,
          quantidade: form.tipo === "ajuste" ? Math.abs(novaQuantidade - (estoqueAtual?.quantidade || 0)) : form.quantidade,
          quantidade_anterior: estoqueAtual?.quantidade || 0,
          quantidade_nova: novaQuantidade,
          local_origem_tipo: form.tipo === "entrada" ? "externo" : "central",
          local_destino_tipo: form.tipo === "saida" ? "externo" : "central",
          observacao: form.observacao,
          documento_referencia: form.documento_referencia || null,
        });

      if (movError) throw movError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-central"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-central-stats"] });
      toast.success("Movimentação registrada com sucesso!");
      setMovimentacaoDialog(false);
      setMovimentacaoForm({
        tipo: "entrada",
        material_id: "",
        quantidade: 0,
        observacao: "",
        documento_referencia: "",
      });
      setSelectedItem(null);
    },
    onError: (error: any) => {
      console.error("Erro na movimentação:", error);
      toast.error(error.message || "Erro ao registrar movimentação");
    },
  });

  const handleMovimentacao = (item: EstoqueItem, tipo: "entrada" | "saida") => {
    setSelectedItem(item);
    setMovimentacaoForm({
      tipo,
      material_id: item.material_id,
      quantidade: 0,
      observacao: "",
      documento_referencia: "",
    });
    setMovimentacaoDialog(true);
  };

  const handleNovaMovimentacao = () => {
    setSelectedItem(null);
    setMovimentacaoForm({
      tipo: "entrada",
      material_id: "",
      quantidade: 0,
      observacao: "",
      documento_referencia: "",
    });
    setMovimentacaoDialog(true);
  };

  const handleSubmitMovimentacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movimentacaoForm.material_id || movimentacaoForm.quantidade <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    movimentacaoMutation.mutate(movimentacaoForm);
  };

  const getEstoqueStatus = (item: EstoqueItem) => {
    if (item.quantidade <= 0) {
      return { label: "Sem Estoque", color: "text-red-600", bg: "bg-red-100", icon: XCircle };
    }
    if (item.quantidade <= item.materiais.estoque_minimo) {
      return { label: "Estoque Baixo", color: "text-amber-600", bg: "bg-amber-100", icon: AlertTriangle };
    }
    return { label: "OK", color: "text-green-600", bg: "bg-green-100", icon: CheckCircle };
  };

  const getEstoqueProgress = (item: EstoqueItem) => {
    const max = item.materiais.estoque_maximo || item.materiais.estoque_minimo * 3;
    return Math.min(100, (item.quantidade / max) * 100);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <MainLayout title="Estoque Central">
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
                <Warehouse className="h-6 w-6 text-emerald-600" />
                Estoque Central
              </h1>
              <p className="text-muted-foreground text-sm">
                Controle de estoque do almoxarifado principal
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/materiais/movimentacoes">
                <History className="h-4 w-4 mr-2" />
                Histórico
              </Link>
            </Button>
            <Button onClick={handleNovaMovimentacao}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Movimentação
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Itens</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Estoque OK</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.ok || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                  <p className="text-2xl font-bold text-amber-600">{stats?.baixos || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sem Estoque</p>
                  <p className="text-2xl font-bold text-red-600">{stats?.zerados || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
            <CardContent className="pt-4">
              <div>
                <p className="text-emerald-100 text-sm">Valor em Estoque</p>
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
                    placeholder="Buscar por código ou nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="ok">Estoque OK</SelectItem>
                  <SelectItem value="baixo">Estoque Baixo</SelectItem>
                  <SelectItem value="zerado">Sem Estoque</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Categorias</SelectItem>
                  {categorias?.map((cat: string) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Estoque */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : estoque && estoque.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-center">Quantidade</TableHead>
                    <TableHead className="text-center">Nível</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center w-[150px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estoque.map((item) => {
                    const status = getEstoqueStatus(item);
                    const progress = getEstoqueProgress(item);
                    const valorTotal = item.quantidade * (item.materiais.valor_unitario || 0);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-medium">
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
                          <span className="font-bold text-lg">{item.quantidade}</span>
                          <span className="text-muted-foreground text-sm ml-1">
                            {item.materiais.unidade}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="w-full max-w-[100px] mx-auto">
                            <Progress
                              value={progress}
                              className={`h-2 ${
                                item.quantidade <= 0
                                  ? "[&>div]:bg-red-500"
                                  : item.quantidade <= item.materiais.estoque_minimo
                                  ? "[&>div]:bg-amber-500"
                                  : "[&>div]:bg-green-500"
                              }`}
                            />
                            <p className="text-[10px] text-center text-muted-foreground mt-1">
                              Mín: {item.materiais.estoque_minimo}
                              {item.materiais.estoque_maximo && ` / Máx: ${item.materiais.estoque_maximo}`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${status.bg} ${status.color} border-0`}>
                            <status.icon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.materiais.localizacao || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(valorTotal)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleMovimentacao(item, "entrada")}
                            >
                              <ArrowUpRight className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleMovimentacao(item, "saida")}
                              disabled={item.quantidade <= 0}
                            >
                              <ArrowDownRight className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Warehouse className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum item encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Movimentação */}
        <Dialog open={movimentacaoDialog} onOpenChange={setMovimentacaoDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {movimentacaoForm.tipo === "entrada" ? (
                  <>
                    <ArrowUpRight className="h-5 w-5 text-green-600" />
                    Entrada de Material
                  </>
                ) : movimentacaoForm.tipo === "saida" ? (
                  <>
                    <ArrowDownRight className="h-5 w-5 text-red-600" />
                    Saída de Material
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5 text-blue-600" />
                    Ajuste de Estoque
                  </>
                )}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmitMovimentacao} className="space-y-4">
              {!selectedItem && (
                <div className="space-y-2">
                  <Label>Tipo de Movimentação</Label>
                  <Select
                    value={movimentacaoForm.tipo}
                    onValueChange={(value: "entrada" | "saida" | "ajuste") =>
                      setMovimentacaoForm({ ...movimentacaoForm, tipo: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="ajuste">Ajuste de Inventário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Material *</Label>
                {selectedItem ? (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">{selectedItem.materiais.codigo}</p>
                    <p className="text-sm text-muted-foreground">{selectedItem.materiais.nome}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Estoque atual: {selectedItem.quantidade} {selectedItem.materiais.unidade}
                    </p>
                  </div>
                ) : (
                  <Select
                    value={movimentacaoForm.material_id}
                    onValueChange={(value) =>
                      setMovimentacaoForm({ ...movimentacaoForm, material_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materiais?.map((mat: any) => (
                        <SelectItem key={mat.id} value={mat.id}>
                          {mat.codigo} - {mat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  {movimentacaoForm.tipo === "ajuste" ? "Nova Quantidade *" : "Quantidade *"}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={movimentacaoForm.quantidade || ""}
                  onChange={(e) =>
                    setMovimentacaoForm({
                      ...movimentacaoForm,
                      quantidade: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
                {movimentacaoForm.tipo !== "ajuste" && selectedItem && (
                  <p className="text-xs text-muted-foreground">
                    Novo estoque:{" "}
                    {movimentacaoForm.tipo === "entrada"
                      ? selectedItem.quantidade + movimentacaoForm.quantidade
                      : selectedItem.quantidade - movimentacaoForm.quantidade}{" "}
                    {selectedItem.materiais.unidade}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Documento de Referência</Label>
                <Input
                  value={movimentacaoForm.documento_referencia}
                  onChange={(e) =>
                    setMovimentacaoForm({
                      ...movimentacaoForm,
                      documento_referencia: e.target.value,
                    })
                  }
                  placeholder="NF, Requisição, etc."
                />
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={movimentacaoForm.observacao}
                  onChange={(e) =>
                    setMovimentacaoForm({ ...movimentacaoForm, observacao: e.target.value })
                  }
                  placeholder="Motivo da movimentação..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMovimentacaoDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={movimentacaoMutation.isPending}
                  className={
                    movimentacaoForm.tipo === "entrada"
                      ? "bg-green-600 hover:bg-green-700"
                      : movimentacaoForm.tipo === "saida"
                      ? "bg-red-600 hover:bg-red-700"
                      : ""
                  }
                >
                  {movimentacaoMutation.isPending ? "Salvando..." : "Confirmar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}



