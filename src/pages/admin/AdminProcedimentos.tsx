import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Eye,
  Download,
  Smartphone,
  Link,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";

interface Procedimento {
  id: string;
  titulo: string;
  descricao: string | null;
  conteudo: string | null;
  categoria: string;
  arquivo_url: string | null;
  contrato_id: string | null;
  visivel_app: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
  contratos?: { codigo: string; nome: string } | null;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

const categoriaOptions = [
  { value: "seguranca", label: "Segurança" },
  { value: "tecnico", label: "Técnico" },
  { value: "qualidade", label: "Qualidade" },
  { value: "administrativo", label: "Administrativo" },
  { value: "operacional", label: "Operacional" },
  { value: "outro", label: "Outro" },
];

export default function AdminProcedimentos() {
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProcedimento, setEditingProcedimento] = useState<Procedimento | null>(null);
  const [viewingProcedimento, setViewingProcedimento] = useState<Procedimento | null>(null);
  const [procedimentoToDelete, setProcedimentoToDelete] = useState<Procedimento | null>(null);
  const [saving, setSaving] = useState(false);

  // Configuração dos filtros
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por título ou descrição...",
    },
    {
      id: "categoria",
      label: "Categoria",
      type: "select",
      options: categoriaOptions,
    },
    {
      id: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "ativo", label: "Ativos", color: "bg-green-500" },
        { value: "inativo", label: "Inativos", color: "bg-gray-500" },
      ],
    },
    {
      id: "visivel_app",
      label: "Visível no App",
      type: "select",
      options: [
        { value: "sim", label: "Sim", color: "bg-blue-500" },
        { value: "nao", label: "Não", color: "bg-gray-500" },
      ],
    },
    {
      id: "contrato_id",
      label: "Contrato",
      type: "select",
      options: contratos.map((c) => ({
        value: c.id,
        label: `${c.codigo} - ${c.nome}`,
      })),
    },
  ], [contratos]);

  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  // Form state
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    conteudo: "",
    categoria: "operacional",
    arquivo_url: "",
    contrato_id: "",
    visivel_app: true,
    ativo: true,
    ordem: 0,
  });

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("procedimentos")
        .select(`
          *,
          contratos (codigo, nome)
        `)
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });

      if (error) throw error;
      setProcedimentos(data || []);

      const { data: contratosData } = await supabase
        .from("contratos")
        .select("id, codigo, nome")
        .eq("status", "ativo")
        .order("codigo");
      setContratos(contratosData || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrar dados
  const filteredProcedimentos = useMemo(() => {
    return filterData(
      procedimentos,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.titulo.toLowerCase().includes(searchTerm) ||
            item.descricao?.toLowerCase().includes(searchTerm) || false
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
        visivel_app: (item, value) => {
          if (value === "sim") return item.visivel_app;
          if (value === "nao") return !item.visivel_app;
          return true;
        },
      }
    );
  }, [procedimentos, filterValues, filterConfigs]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredProcedimentos,
    { column: "ordem", direction: "asc" }
  );

  const handleCreate = () => {
    setEditingProcedimento(null);
    const maxOrdem = Math.max(...procedimentos.map((p) => p.ordem), 0);
    setFormData({
      titulo: "",
      descricao: "",
      conteudo: "",
      categoria: "operacional",
      arquivo_url: "",
      contrato_id: "",
      visivel_app: true,
      ativo: true,
      ordem: maxOrdem + 1,
    });
    setDialogOpen(true);
  };

  const handleEdit = (procedimento: Procedimento) => {
    setEditingProcedimento(procedimento);
    setFormData({
      titulo: procedimento.titulo,
      descricao: procedimento.descricao || "",
      conteudo: procedimento.conteudo || "",
      categoria: procedimento.categoria,
      arquivo_url: procedimento.arquivo_url || "",
      contrato_id: procedimento.contrato_id || "",
      visivel_app: procedimento.visivel_app,
      ativo: procedimento.ativo,
      ordem: procedimento.ordem,
    });
    setDialogOpen(true);
  };

  const handleView = (procedimento: Procedimento) => {
    setViewingProcedimento(procedimento);
    setViewDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.titulo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        titulo: formData.titulo,
        descricao: formData.descricao || null,
        conteudo: formData.conteudo || null,
        categoria: formData.categoria,
        arquivo_url: formData.arquivo_url || null,
        contrato_id: formData.contrato_id || null,
        visivel_app: formData.visivel_app,
        ativo: formData.ativo,
        ordem: formData.ordem,
      };

      if (editingProcedimento) {
        const { error } = await supabase
          .from("procedimentos")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingProcedimento.id);

        if (error) throw error;
        toast.success("Procedimento atualizado com sucesso");
      } else {
        const { error } = await supabase.from("procedimentos").insert(payload);

        if (error) throw error;
        toast.success("Procedimento criado com sucesso");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!procedimentoToDelete) return;

    try {
      const { error } = await supabase
        .from("procedimentos")
        .delete()
        .eq("id", procedimentoToDelete.id);

      if (error) throw error;

      toast.success("Procedimento excluído com sucesso");
      setDeleteDialogOpen(false);
      setProcedimentoToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Procedimentos</h2>
          <p className="text-muted-foreground">
            Gerencie os procedimentos operacionais disponíveis no aplicativo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Procedimento
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4">
        <DataTableFilters
          filters={filterConfigs}
          values={filterValues}
          onChange={setFilterValues}
          onClear={clearFilters}
        />
      </div>

      {/* Estatísticas por categoria */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {categoriaOptions.map((cat) => {
          const count = procedimentos.filter((p) => p.categoria === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterValues({ ...filterValues, categoria: cat.value })}
              className={`p-3 rounded-lg border transition-all hover:shadow-md ${
                filterValues.categoria === cat.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <span className="text-xs font-medium">{cat.label}</span>
              <p className="text-xl font-bold mt-1">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="ordem"
                label="#"
                sortConfig={sortConfig}
                onSort={handleSort}
                className="w-16"
              />
              <SortableTableHead
                column="titulo"
                label="Título"
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
                column="contratos.codigo"
                label="Contrato"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <TableHead>Arquivo</TableHead>
              <SortableTableHead
                column="visivel_app"
                label="App"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="ativo"
                label="Status"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sortedData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? "Nenhum procedimento encontrado com os filtros aplicados"
                      : "Nenhum procedimento cadastrado"}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                      Limpar filtros
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedData?.map((proc) => (
                <TableRow key={proc.id} className="group">
                  <TableCell className="font-mono text-muted-foreground">
                    {proc.ordem}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{proc.titulo}</p>
                      {proc.descricao && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {proc.descricao}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {categoriaOptions.find((c) => c.value === proc.categoria)?.label ||
                        proc.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {proc.contratos ? (
                      <Badge variant="secondary">{proc.contratos.codigo}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Todos</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {proc.arquivo_url ? (
                      <a
                        href={proc.arquivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Link className="h-3 w-3" />
                        Arquivo
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {proc.visivel_app ? (
                      <Badge variant="default" className="bg-blue-500">
                        <Smartphone className="h-3 w-3 mr-1" />
                        Sim
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={proc.ativo ? "default" : "secondary"}>
                      {proc.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(proc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(proc)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setProcedimentoToDelete(proc);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {sortedData && sortedData.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
            Mostrando {sortedData.length} de {procedimentos.length} procedimentos
          </div>
        )}
      </div>

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProcedimento ? "Editar Procedimento" : "Novo Procedimento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Título *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) =>
                    setFormData({ ...formData, titulo: e.target.value })
                  }
                  placeholder="Título do procedimento"
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(v) => setFormData({ ...formData, categoria: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriaOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={formData.ordem}
                  onChange={(e) =>
                    setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                  placeholder="Descrição breve"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Conteúdo</Label>
                <Textarea
                  value={formData.conteudo}
                  onChange={(e) =>
                    setFormData({ ...formData, conteudo: e.target.value })
                  }
                  placeholder="Conteúdo completo do procedimento..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label>URL do Arquivo</Label>
                <Input
                  value={formData.arquivo_url}
                  onChange={(e) =>
                    setFormData({ ...formData, arquivo_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>Contrato</Label>
                <Select
                  value={formData.contrato_id}
                  onValueChange={(v) => setFormData({ ...formData, contrato_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os contratos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-6 col-span-2 p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.visivel_app}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, visivel_app: v })
                    }
                  />
                  <div>
                    <Label>Visível no App</Label>
                    <p className="text-xs text-muted-foreground">
                      Disponível para visualização no aplicativo móvel
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.ativo}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, ativo: v })
                    }
                  />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Visualização */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingProcedimento?.titulo}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">
                  {categoriaOptions.find((c) => c.value === viewingProcedimento?.categoria)
                    ?.label || viewingProcedimento?.categoria}
                </Badge>
                {viewingProcedimento?.visivel_app && (
                  <Badge variant="default" className="bg-blue-500">
                    <Smartphone className="h-3 w-3 mr-1" />
                    Visível no App
                  </Badge>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {viewingProcedimento && (
            <div className="space-y-4">
              {viewingProcedimento.descricao && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    Descrição
                  </p>
                  <p className="text-sm">{viewingProcedimento.descricao}</p>
                </div>
              )}

              {viewingProcedimento.conteudo && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    Conteúdo
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg text-sm whitespace-pre-wrap">
                    {viewingProcedimento.conteudo}
                  </div>
                </div>
              )}

              {viewingProcedimento.arquivo_url && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    Arquivo
                  </p>
                  <a
                    href={viewingProcedimento.arquivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    Baixar arquivo
                  </a>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-4 border-t">
                Criado em{" "}
                {format(new Date(viewingProcedimento.created_at), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o procedimento{" "}
              <strong>{procedimentoToDelete?.titulo}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
