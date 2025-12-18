import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  ArrowLeft,
  Barcode,
  Tag,
  DollarSign,
  Box,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  Copy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

function formatCurrencyBRL(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function isMissingRelationOrFunctionError(err: any) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "").toLowerCase();
  // 42P01: undefined_table, 42883: undefined_function
  return code === "42P01" || code === "42883" || msg.includes("does not exist") || msg.includes("undefined");
}

// Categorias de materiais do setor elétrico
const CATEGORIAS = [
  { value: "medidores", label: "Medidores de Energia", icon: Zap },
  { value: "cabos_condutores", label: "Cabos e Condutores", icon: Package },
  { value: "conectores", label: "Conectores e Terminais", icon: Package },
  { value: "postes_estruturas", label: "Postes e Estruturas", icon: Package },
  { value: "transformadores", label: "Transformadores", icon: Zap },
  { value: "chaves_fusíveis", label: "Chaves e Fusíveis", icon: Package },
  { value: "isoladores", label: "Isoladores", icon: Package },
  { value: "ferragens", label: "Ferragens", icon: Package },
  { value: "equipamentos_protecao", label: "Equipamentos de Proteção", icon: Package },
  { value: "ferramentas", label: "Ferramentas", icon: Package },
  { value: "consumiveis", label: "Consumíveis", icon: Package },
  { value: "outros", label: "Outros", icon: Package },
];

const UNIDADES = [
  { value: "UN", label: "Unidade" },
  { value: "M", label: "Metro" },
  { value: "KG", label: "Quilograma" },
  { value: "L", label: "Litro" },
  { value: "CX", label: "Caixa" },
  { value: "PC", label: "Peça" },
  { value: "RL", label: "Rolo" },
  { value: "KIT", label: "Kit" },
  { value: "PAR", label: "Par" },
  { value: "JG", label: "Jogo" },
];

interface Material {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  unidade: string;
  valor_unitario: number | null;
  estoque_minimo: number;
  estoque_maximo: number | null;
  localizacao: string | null;
  codigo_barras: string | null;
  codigo_concessionaria: string | null;
  requer_serial: boolean;
  dias_alerta_retencao: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface MaterialPrecoHistorico {
  id: string;
  material_id: string;
  valor_unitario_anterior: number | null;
  valor_unitario_novo: number;
  origem: string;
  referencia: string | null;
  created_at: string;
  created_by: string | null;
}

interface FormData {
  codigo: string;
  nome: string;
  descricao: string;
  categoria: string;
  unidade: string;
  valor_unitario: string;
  estoque_minimo: string;
  estoque_maximo: string;
  localizacao: string;
  codigo_barras: string;
  codigo_concessionaria: string;
  requer_serial: boolean;
  dias_alerta_retencao: string;
  ativo: boolean;
}

const initialFormData: FormData = {
  codigo: "",
  nome: "",
  descricao: "",
  categoria: "",
  unidade: "UN",
  valor_unitario: "",
  estoque_minimo: "0",
  estoque_maximo: "",
  localizacao: "",
  codigo_barras: "",
  codigo_concessionaria: "",
  requer_serial: false,
  dias_alerta_retencao: "7",
  ativo: true,
};

export default function CatalogoMateriais() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [activeTab, setActiveTab] = useState("geral");
  const [confirmRevert, setConfirmRevert] = useState<{
    open: boolean;
    preco: MaterialPrecoHistorico | null;
  }>({ open: false, preco: null });

  // Query para buscar materiais
  const { data: materiais, isLoading } = useQuery({
    queryKey: ["materiais", filtroCategoria, filtroStatus, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("materiais")
        .select("*")
        .order("codigo");

      if (filtroCategoria !== "todos") {
        query = query.eq("categoria", filtroCategoria);
      }

      if (filtroStatus === "ativos") {
        query = query.eq("ativo", true);
      } else if (filtroStatus === "inativos") {
        query = query.eq("ativo", false);
      }

      if (searchTerm) {
        query = query.or(`codigo.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%,codigo_barras.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Material[];
    },
  });

  // Query para buscar estoque
  const { data: estoqueMap } = useQuery({
    queryKey: ["materiais-estoque-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_estoque")
        .select("material_id, quantidade")
        .eq("local_tipo", "central");

      if (error) throw error;

      const map: Record<string, number> = {};
      data?.forEach((item: any) => {
        map[item.material_id] = item.quantidade;
      });
      return map;
    },
  });

  // Query para calcular sugestão de estoque baseada nos movimentos dos últimos 3 meses
  const { data: sugestoesEstoque } = useQuery({
    queryKey: ["sugestoes-estoque"],
    queryFn: async () => {
      // Data de 3 meses atrás
      const tresMesesAtras = new Date();
      tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
      const dataInicio = tresMesesAtras.toISOString();

      // Buscar movimentações de saída dos últimos 3 meses
      const { data: movimentacoes, error } = await supabase
        .from("materiais_movimentacoes")
        .select("material_id, quantidade, tipo, created_at")
        .gte("created_at", dataInicio)
        .in("tipo", ["saida", "transferencia"]);

      if (error) {
        console.error("Erro ao buscar movimentações:", error);
        return {};
      }

      // Buscar aplicações em OS dos últimos 3 meses
      const { data: aplicacoes } = await supabase
        .from("materiais_aplicados_os")
        .select("material_id, quantidade, created_at")
        .gte("created_at", dataInicio)
        .eq("tipo", "aplicado");

      // Calcular consumo por material
      const consumoPorMaterial: Record<string, { total: number; count: number }> = {};

      // Somar movimentações
      movimentacoes?.forEach((mov: any) => {
        if (!consumoPorMaterial[mov.material_id]) {
          consumoPorMaterial[mov.material_id] = { total: 0, count: 0 };
        }
        consumoPorMaterial[mov.material_id].total += mov.quantidade;
        consumoPorMaterial[mov.material_id].count += 1;
      });

      // Somar aplicações
      aplicacoes?.forEach((ap: any) => {
        if (!consumoPorMaterial[ap.material_id]) {
          consumoPorMaterial[ap.material_id] = { total: 0, count: 0 };
        }
        consumoPorMaterial[ap.material_id].total += ap.quantidade;
        consumoPorMaterial[ap.material_id].count += 1;
      });

      // Calcular sugestões
      // Estoque mínimo sugerido = consumo médio mensal (para 1 mês de segurança)
      // Estoque máximo sugerido = consumo médio mensal * 3 (para 3 meses)
      const sugestoes: Record<string, { minimo: number; maximo: number; consumoMensal: number }> = {};
      
      Object.entries(consumoPorMaterial).forEach(([materialId, dados]) => {
        const consumoMensal = Math.ceil(dados.total / 3); // Média mensal
        sugestoes[materialId] = {
          minimo: Math.max(1, consumoMensal), // Mínimo de 1 mês
          maximo: Math.max(3, consumoMensal * 3), // Máximo de 3 meses
          consumoMensal,
        };
      });

      return sugestoes;
    },
  });

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

  // Ordenar materiais
  const materiaisOrdenados = useMemo(() => {
    if (!materiais || !sortConfig || !sortConfig.direction) {
      return materiais;
    }

    return [...materiais].sort((a: any, b: any) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.column) {
        case "codigo":
          aValue = a.codigo;
          bValue = b.codigo;
          break;
        case "nome":
          aValue = a.nome;
          bValue = b.nome;
          break;
        case "categoria":
          aValue = a.categoria;
          bValue = b.categoria;
          break;
        case "unidade":
          aValue = a.unidade;
          bValue = b.unidade;
          break;
        case "valor_unitario":
          aValue = a.valor_unitario || 0;
          bValue = b.valor_unitario || 0;
          break;
        case "estoque":
          aValue = estoqueMap?.[a.id] || 0;
          bValue = estoqueMap?.[b.id] || 0;
          break;
        case "ativo":
          aValue = a.ativo ? 1 : 0;
          bValue = b.ativo ? 1 : 0;
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
  }, [materiais, sortConfig, estoqueMap]);

  // Mutation para salvar material
  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        codigo: data.codigo.toUpperCase(),
        nome: data.nome,
        descricao: data.descricao || null,
        categoria: data.categoria,
        unidade: data.unidade,
        // valor_unitario será tratado via RPC (para registrar histórico) quando estiver editando
        valor_unitario: data.valor_unitario ? parseFloat(data.valor_unitario) : null,
        estoque_minimo: parseInt(data.estoque_minimo) || 0,
        estoque_maximo: data.estoque_maximo ? parseInt(data.estoque_maximo) : null,
        localizacao: data.localizacao || null,
        codigo_barras: data.codigo_barras || null,
        codigo_concessionaria: data.codigo_concessionaria || null,
        requer_serial: data.requer_serial,
        dias_alerta_retencao: data.dias_alerta_retencao ? parseInt(data.dias_alerta_retencao) : 7,
        ativo: data.ativo,
      };

      if (selectedMaterial) {
        const novoValor = payload.valor_unitario;
        const valorAtual = selectedMaterial.valor_unitario ?? null;

        // Atualiza campos (exceto preço) diretamente
        const { valor_unitario: _ignored, ...payloadSemPreco } = payload;
        const { error } = await supabase
          .from("materiais")
          .update(payloadSemPreco)
          .eq("id", selectedMaterial.id);
        if (error) throw error;

        // Atualiza preço via RPC (para registrar histórico)
        if (novoValor != null && Number(valorAtual) !== Number(novoValor)) {
          const { error: rpcErr } = await (supabase as any).rpc("update_material_price", {
            p_material_id: selectedMaterial.id,
            p_valor_unitario: novoValor,
            p_origem: "catalogo",
            p_referencia: null,
          });
          if (rpcErr) throw rpcErr;
        }
      } else {
        const { error } = await supabase
          .from("materiais")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      queryClient.invalidateQueries({ queryKey: ["materiais-precos-historico"] });
      toast.success(selectedMaterial ? "Material atualizado!" : "Material cadastrado!");
      handleCloseDialog();
    },
    onError: (error: any) => {
      console.error("Erro ao salvar material:", error);
      if (error.code === "23505") {
        toast.error("Já existe um material com este código!");
      } else {
        toast.error("Erro ao salvar material");
      }
    },
  });

  // Mutation para excluir material
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("materiais")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      toast.success("Material excluído!");
      setDeleteDialogOpen(false);
      setSelectedMaterial(null);
    },
    onError: (error: any) => {
      console.error("Erro ao excluir material:", error);
      if (error.code === "23503") {
        toast.error("Não é possível excluir: material possui movimentações");
      } else {
        toast.error("Erro ao excluir material");
      }
    },
  });

  // Mutation para alternar status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("materiais")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      toast.success(ativo ? "Material ativado!" : "Material desativado!");
    },
    onError: () => {
      toast.error("Erro ao alterar status");
    },
  });

  const handleOpenDialog = (material?: Material) => {
    if (material) {
      setSelectedMaterial(material);
      setFormData({
        codigo: material.codigo,
        nome: material.nome,
        descricao: material.descricao || "",
        categoria: material.categoria,
        unidade: material.unidade,
        valor_unitario: material.valor_unitario?.toString() || "",
        estoque_minimo: material.estoque_minimo.toString(),
        estoque_maximo: material.estoque_maximo?.toString() || "",
        localizacao: material.localizacao || "",
        codigo_barras: material.codigo_barras || "",
        codigo_concessionaria: material.codigo_concessionaria || "",
        requer_serial: material.requer_serial,
        dias_alerta_retencao: material.dias_alerta_retencao?.toString() || "7",
        ativo: material.ativo,
      });
    } else {
      setSelectedMaterial(null);
      setFormData(initialFormData);
    }
    setActiveTab("geral");
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedMaterial(null);
    setFormData(initialFormData);
    setActiveTab("geral");
    setConfirmRevert({ open: false, preco: null });
  };

  const { data: precosHistorico, isLoading: isLoadingPrecos, error: precosError } = useQuery({
    queryKey: ["materiais-precos-historico", selectedMaterial?.id],
    enabled: dialogOpen && !!selectedMaterial?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais_precos_historico")
        .select("*")
        .eq("material_id", selectedMaterial!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as MaterialPrecoHistorico[];
    },
    retry: (failureCount, error: any) => {
      // Se a tabela não existir (migration não aplicada), não adianta retry
      if (isMissingRelationOrFunctionError(error)) return false;
      return failureCount < 2;
    },
  });

  const aplicarPrecoMutation = useMutation({
    mutationFn: async (preco: MaterialPrecoHistorico) => {
      if (!selectedMaterial?.id) throw new Error("Material não selecionado");
      const { error: rpcErr } = await (supabase as any).rpc("update_material_price", {
        p_material_id: selectedMaterial.id,
        p_valor_unitario: Number(preco.valor_unitario_novo),
        p_origem: "catalogo",
        p_referencia: `revert:${preco.id}`,
      });
      if (rpcErr) throw rpcErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      queryClient.invalidateQueries({ queryKey: ["materiais-precos-historico", selectedMaterial?.id] });
      toast.success("Preço aplicado e histórico atualizado!");
      // Atualiza o campo do formulário para refletir o valor atual
      if (selectedMaterial?.id) {
        // forçamos reselect do material (via query invalidate) e deixamos o usuário ver na lista,
        // mas também atualizamos localmente o form para evitar confusão no modal
        const ultimo = confirmRevert.preco?.valor_unitario_novo;
        if (ultimo != null) {
          setFormData((p) => ({ ...p, valor_unitario: String(ultimo) }));
          setSelectedMaterial((p) => (p ? { ...p, valor_unitario: Number(ultimo) } : p));
        }
      }
      setConfirmRevert({ open: false, preco: null });
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message || "Erro ao aplicar preço");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.codigo || !formData.nome || !formData.categoria) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    saveMutation.mutate(formData);
  };

  const getEstoqueStatus = (material: Material) => {
    const quantidade = estoqueMap?.[material.id] || 0;
    if (quantidade <= 0) {
      return { label: "Sem Estoque", variant: "destructive" as const, icon: XCircle };
    }
    if (quantidade <= material.estoque_minimo) {
      return { label: "Baixo", variant: "warning" as const, icon: AlertTriangle };
    }
    return { label: "OK", variant: "success" as const, icon: CheckCircle };
  };

  const getCategoriaLabel = (categoria: string) => {
    return CATEGORIAS.find(c => c.value === categoria)?.label || categoria;
  };

  return (
    <MainLayout title="Catálogo de Materiais">
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
                <Package className="h-6 w-6 text-violet-600" />
                Catálogo de Materiais
              </h1>
              <p className="text-muted-foreground text-sm">
                Gerencie o cadastro de materiais e produtos
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Material
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por código, nome ou código de barras..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Categorias</SelectItem>
                  {CATEGORIAS.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="inativos">Inativos</SelectItem>
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
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : materiaisOrdenados && materiaisOrdenados.length > 0 ? (
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
                    <SortableTableHead
                      column="categoria"
                      label="Categoria"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      column="unidade"
                      label="Unidade"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      className="text-center"
                    />
                    <SortableTableHead
                      column="valor_unitario"
                      label="Valor Unit."
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      className="text-right"
                    />
                    <SortableTableHead
                      column="estoque"
                      label="Estoque"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      className="text-center"
                    />
                    <SortableTableHead
                      column="ativo"
                      label="Status"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      className="text-center"
                    />
                    <TableHead className="text-right w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materiaisOrdenados.map((material) => {
                    const estoqueStatus = getEstoqueStatus(material);
                    const quantidade = estoqueMap?.[material.id] || 0;

                    return (
                      <TableRow key={material.id} className={!material.ativo ? "opacity-50" : ""}>
                        <TableCell className="font-mono font-medium">
                          {material.codigo}
                          {material.requer_serial && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              Serial
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{material.nome}</p>
                            {material.codigo_barras && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Barcode className="h-3 w-3" />
                                {material.codigo_barras}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getCategoriaLabel(material.categoria)}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{material.unidade}</TableCell>
                        <TableCell className="text-right">
                          {material.valor_unitario
                            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(material.valor_unitario)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-medium">{quantidade}</span>
                            <estoqueStatus.icon className={`h-4 w-4 ${
                              estoqueStatus.label === "OK" ? "text-green-500" :
                              estoqueStatus.label === "Baixo" ? "text-amber-500" : "text-red-500"
                            }`} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={material.ativo ? "default" : "secondary"}>
                            {material.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleOpenDialog(material)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                navigator.clipboard.writeText(material.codigo);
                                toast.success("Código copiado!");
                              }}
                              title="Copiar Código"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${material.ativo ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}`}
                              onClick={() => toggleStatusMutation.mutate({ id: material.id, ativo: !material.ativo })}
                              title={material.ativo ? "Desativar" : "Ativar"}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedMaterial(material);
                                setDeleteDialogOpen(true);
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
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
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum material encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Material
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Cadastro/Edição */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedMaterial ? "Editar Material" : "Novo Material"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 h-auto">
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="estoque">Estoque</TabsTrigger>
                  <TabsTrigger value="codigos">Códigos</TabsTrigger>
                  <TabsTrigger value="precos" disabled={!selectedMaterial}>
                    <span className="hidden sm:inline">Histórico de Preços</span>
                    <span className="sm:hidden">Preços</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="codigo">Código *</Label>
                      <Input
                        id="codigo"
                        value={formData.codigo}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                        placeholder="Ex: MED001"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="categoria">Categoria *</Label>
                      <Select
                        value={formData.categoria}
                        onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Nome do material"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Descrição detalhada do material..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="unidade">Unidade de Medida</Label>
                      <Select
                        value={formData.unidade}
                        onValueChange={(value) => setFormData({ ...formData, unidade: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map(un => (
                            <SelectItem key={un.value} value={un.value}>{un.label} ({un.value})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="valor_unitario">Valor Unitário (R$)</Label>
                      <Input
                        id="valor_unitario"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.valor_unitario}
                        onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="space-y-0.5">
                      <Label>Material Ativo</Label>
                      <p className="text-sm text-muted-foreground">
                        Materiais inativos não aparecem para seleção
                      </p>
                    </div>
                    <Switch
                      checked={formData.ativo}
                      onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="estoque" className="space-y-4 mt-4">
                  {/* Sugestão baseada em consumo */}
                  {selectedMaterial && sugestoesEstoque?.[selectedMaterial.id] && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-800">
                            Sugestão baseada no consumo dos últimos 3 meses
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Consumo médio mensal: {sugestoesEstoque[selectedMaterial.id].consumoMensal} unidades
                          </p>
                          <div className="flex gap-4 mt-2">
                            <button
                              type="button"
                              className="text-xs text-blue-700 hover:text-blue-900 underline"
                              onClick={() => setFormData({
                                ...formData,
                                estoque_minimo: sugestoesEstoque[selectedMaterial.id].minimo.toString()
                              })}
                            >
                              Usar mínimo sugerido: {sugestoesEstoque[selectedMaterial.id].minimo}
                            </button>
                            <button
                              type="button"
                              className="text-xs text-blue-700 hover:text-blue-900 underline"
                              onClick={() => setFormData({
                                ...formData,
                                estoque_maximo: sugestoesEstoque[selectedMaterial.id].maximo.toString()
                              })}
                            >
                              Usar máximo sugerido: {sugestoesEstoque[selectedMaterial.id].maximo}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                        {selectedMaterial && sugestoesEstoque?.[selectedMaterial.id] && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                            Sugerido: {sugestoesEstoque[selectedMaterial.id].minimo}
                          </Badge>
                        )}
                      </div>
                      <Input
                        id="estoque_minimo"
                        type="number"
                        min="0"
                        value={formData.estoque_minimo}
                        onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">
                        Alerta quando o estoque atingir este valor
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="estoque_maximo">Estoque Máximo</Label>
                        {selectedMaterial && sugestoesEstoque?.[selectedMaterial.id] && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                            Sugerido: {sugestoesEstoque[selectedMaterial.id].maximo}
                          </Badge>
                        )}
                      </div>
                      <Input
                        id="estoque_maximo"
                        type="number"
                        min="0"
                        value={formData.estoque_maximo}
                        onChange={(e) => setFormData({ ...formData, estoque_maximo: e.target.value })}
                        placeholder="Opcional"
                      />
                      <p className="text-xs text-muted-foreground">
                        Capacidade máxima de armazenamento
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="localizacao">Localização no Estoque</Label>
                    <Input
                      id="localizacao"
                      value={formData.localizacao}
                      onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                      placeholder="Ex: Prateleira A3, Corredor 2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Endereço físico do material no almoxarifado
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-600" />
                        Requer Número de Série
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Para medidores e equipamentos rastreáveis
                      </p>
                    </div>
                    <Switch
                      checked={formData.requer_serial}
                      onCheckedChange={(checked) => setFormData({ ...formData, requer_serial: checked })}
                    />
                  </div>

                  {/* Campo de dias de alerta - só aparece para materiais com rastro */}
                  {formData.requer_serial && (
                    <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-violet-600" />
                        <Label className="text-violet-700 font-medium">Alerta de Retenção</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Configure após quantos dias um material com rastro entregue à equipe deve gerar alerta de retenção.
                      </p>
                      <div className="flex items-center gap-3">
                        <Input
                          id="dias_alerta_retencao"
                          type="number"
                          min="1"
                          max="365"
                          value={formData.dias_alerta_retencao}
                          onChange={(e) => setFormData({ ...formData, dias_alerta_retencao: e.target.value })}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">dias sem aplicação em campo</span>
                      </div>
                      <p className="text-xs text-violet-600">
                        💡 Materiais que ultrapassarem este prazo aparecerão em destaque nas telas de gestão
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="codigos" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo_barras">Código de Barras</Label>
                    <div className="relative">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="codigo_barras"
                        value={formData.codigo_barras}
                        onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
                        placeholder="EAN-13, UPC, etc."
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codigo_concessionaria">Código da Concessionária</Label>
                    <Input
                      id="codigo_concessionaria"
                      value={formData.codigo_concessionaria}
                      onChange={(e) => setFormData({ ...formData, codigo_concessionaria: e.target.value })}
                      placeholder="Código usado pela concessionária"
                    />
                    <p className="text-xs text-muted-foreground">
                      Código do material no sistema da concessionária (CPFL, Elektro, etc.)
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="precos" className="space-y-4 mt-4">
                  {!selectedMaterial ? (
                    <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                      Salve o material primeiro para visualizar o histórico de preços.
                    </div>
                  ) : isMissingRelationOrFunctionError(precosError) ? (
                    <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                      <p className="text-sm font-medium text-amber-800">Histórico de preços indisponível</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Parece que a migration de histórico de preços ainda não foi aplicada no banco.
                      </p>
                    </div>
                  ) : isLoadingPrecos ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : precosError ? (
                    <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                      <p className="text-sm font-medium text-red-800">Erro ao carregar histórico</p>
                      <p className="text-xs text-red-700 mt-1">
                        {String((precosError as any)?.message || "Tente novamente.")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Preço atual</p>
                          <p className="text-xs text-muted-foreground">
                            Este é o valor que será usado como padrão para novos recebimentos/movimentações.
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-lg font-bold">{formatCurrencyBRL(selectedMaterial.valor_unitario)}</p>
                          <p className="text-xs text-muted-foreground">Material: {selectedMaterial.codigo}</p>
                        </div>
                      </div>

                      {precosHistorico?.length ? (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="w-full overflow-x-auto">
                            <Table className="min-w-[860px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Origem</TableHead>
                                <TableHead className="text-right">Anterior</TableHead>
                                <TableHead className="text-right">Novo</TableHead>
                                <TableHead>Referência</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {precosHistorico.map((p) => {
                                const isAtual = Number(selectedMaterial.valor_unitario ?? 0) === Number(p.valor_unitario_novo ?? 0);
                                return (
                                  <TableRow key={p.id}>
                                    <TableCell className="text-sm">
                                      {format(new Date(p.created_at), "dd/MM/yyyy HH:mm")}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs">
                                        {p.origem}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">
                                      {formatCurrencyBRL(p.valor_unitario_anterior)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatCurrencyBRL(p.valor_unitario_novo)}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                                      {p.referencia || "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={isAtual ? "outline" : "default"}
                                        disabled={isAtual || aplicarPrecoMutation.isPending}
                                        onClick={() => setConfirmRevert({ open: true, preco: p })}
                                      >
                                        {isAtual ? "Atual" : "Aplicar"}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Nenhuma alteração de preço registrada ainda.
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Dica: alterações no catálogo e recebimentos passam a registrar histórico automaticamente.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6 flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : selectedMaterial ? "Atualizar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmação: aplicar preço do histórico */}
        <AlertDialog
          open={confirmRevert.open}
          onOpenChange={(open) => setConfirmRevert((p) => ({ ...p, open }))}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Aplicar preço do histórico?</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a definir o preço atual para{" "}
                <span className="font-medium">{formatCurrencyBRL(confirmRevert.preco?.valor_unitario_novo ?? null)}</span>.
                Isso cria um novo registro no histórico e passa a valer para novos recebimentos/movimentações.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={aplicarPrecoMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmRevert.preco && aplicarPrecoMutation.mutate(confirmRevert.preco)}
                disabled={!confirmRevert.preco || aplicarPrecoMutation.isPending}
              >
                {aplicarPrecoMutation.isPending ? "Aplicando..." : "Confirmar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Material</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o material "{selectedMaterial?.nome}"?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedMaterial && deleteMutation.mutate(selectedMaterial.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}



