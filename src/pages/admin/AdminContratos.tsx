import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useTelaPermissao } from "@/hooks/usePermissoes";
import { useLogSistema } from "@/hooks/useLogSistema";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Calendar,
  DollarSign,
  Loader2,
  AlertCircle,
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
import { ExportButton } from "@/components/ui/export-button";
import { cn } from "@/lib/utils";

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  cliente: string | null;
  data_inicio: string;
  data_fim: string | null;
  status: string;
  valor_mensal: number | null;
  observacoes: string | null;
  created_at: string;
}

const statusOptions = [
  { value: "ativo", label: "Ativo", color: "bg-green-500" },
  { value: "inativo", label: "Inativo", color: "bg-gray-500" },
  { value: "encerrado", label: "Encerrado", color: "bg-red-500" },
  { value: "suspenso", label: "Suspenso", color: "bg-amber-500" },
];

// Configuração dos filtros
const filterConfigs: FilterConfig[] = [
  {
    id: "search",
    label: "Buscar",
    type: "text",
    placeholder: "Buscar por código, nome ou cliente...",
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: statusOptions,
  },
];

export default function AdminContratos() {
  // Permissões da tela
  const { podeEditar } = useTelaPermissao("contratos");
  const { logCriar, logEditar, logExcluir } = useLogSistema();

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [contratoToDelete, setContratoToDelete] = useState<Contrato | null>(null);
  const [saving, setSaving] = useState(false);

  // Filtros
  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  // Form state
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    cliente: "",
    data_inicio: "",
    data_fim: "",
    status: "ativo",
    valor_mensal: "",
    observacoes: "",
  });

  // Carregar contratos
  const fetchContratos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .order("codigo", { ascending: true });

      if (error) throw error;
      setContratos(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar contratos:", error);
      toast.error("Erro ao carregar contratos");
    } finally {
      setLoading(false);
    }
  };

  // Atualizar status inline
  const handleUpdateStatus = async (contratoId: string, novoStatus: string) => {
    const contrato = contratos.find(c => c.id === contratoId);
    if (!contrato) return;

    const { error } = await supabase
      .from("contratos")
      .update({ status: novoStatus })
      .eq("id", contratoId);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      const statusLabel = statusOptions.find(s => s.value === novoStatus)?.label || novoStatus;
      toast.success(`Status alterado para "${statusLabel}"`);
      
      // Log de edição
      logEditar("contratos", "contratos", contratoId, contrato, { status: novoStatus },
        `Alterou status do contrato ${contrato.codigo} para "${statusLabel}"`);
      
      fetchContratos();
    }
  };

  useEffect(() => {
    fetchContratos();
  }, []);

  // Filtrar dados
  const filteredContratos = useMemo(() => {
    return filterData(
      contratos,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm) ||
            item.cliente?.toLowerCase().includes(searchTerm) || false
          );
        },
      }
    );
  }, [contratos, filterValues]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredContratos,
    { column: "codigo", direction: "asc" }
  );

  // Abrir dialog para criar
  const handleCreate = () => {
    setEditingContrato(null);
    setFormData({
      codigo: "",
      nome: "",
      descricao: "",
      cliente: "",
      data_inicio: new Date().toISOString().split("T")[0],
      data_fim: "",
      status: "ativo",
      valor_mensal: "",
      observacoes: "",
    });
    setDialogOpen(true);
  };

  // Abrir dialog para editar
  const handleEdit = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setFormData({
      codigo: contrato.codigo,
      nome: contrato.nome,
      descricao: contrato.descricao || "",
      cliente: contrato.cliente || "",
      data_inicio: contrato.data_inicio,
      data_fim: contrato.data_fim || "",
      status: contrato.status,
      valor_mensal: contrato.valor_mensal?.toString() || "",
      observacoes: contrato.observacoes || "",
    });
    setDialogOpen(true);
  };

  // Salvar contrato
  const handleSave = async () => {
    if (!formData.codigo || !formData.nome || !formData.data_inicio) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: formData.codigo,
        nome: formData.nome,
        descricao: formData.descricao || null,
        cliente: formData.cliente || null,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim || null,
        status: formData.status,
        valor_mensal: formData.valor_mensal ? parseFloat(formData.valor_mensal) : null,
        observacoes: formData.observacoes || null,
      };

      if (editingContrato) {
        const { error } = await supabase
          .from("contratos")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingContrato.id);

        if (error) throw error;
        
        // Log de edição
        logEditar("admin", "contratos", editingContrato.id, editingContrato, payload, 
          `Editou contrato ${payload.codigo} - ${payload.nome}`);
        
        toast.success("Contrato atualizado com sucesso");
      } else {
        const { data: newData, error } = await supabase
          .from("contratos")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;
        
        // Log de criação
        logCriar("admin", "contratos", newData?.id || "", payload, 
          `Criou contrato ${payload.codigo} - ${payload.nome}`);
        
        toast.success("Contrato criado com sucesso");
      }

      setDialogOpen(false);
      fetchContratos();
    } catch (error: any) {
      console.error("Erro ao salvar contrato:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Excluir contrato
  const handleDelete = async () => {
    if (!contratoToDelete) return;

    try {
      const { error } = await supabase
        .from("contratos")
        .delete()
        .eq("id", contratoToDelete.id);

      if (error) throw error;

      // Log de exclusão
      logExcluir("admin", "contratos", contratoToDelete.id, contratoToDelete, 
        `Excluiu contrato ${contratoToDelete.codigo} - ${contratoToDelete.nome}`);

      toast.success("Contrato excluído com sucesso");
      setDeleteDialogOpen(false);
      setContratoToDelete(null);
      fetchContratos();
    } catch (error: any) {
      console.error("Erro ao excluir contrato:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Ações */}
      <div className="flex items-center justify-end gap-2">
        <ExportButton
          data={contratos}
          filename="contratos"
          columns={[
            { key: "codigo", label: "Código" },
            { key: "nome", label: "Nome" },
            { key: "descricao", label: "Descrição" },
            { key: "cliente", label: "Cliente" },
            { key: "data_inicio", label: "Data Início", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
            { key: "data_fim", label: "Data Fim", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
            { key: "valor", label: "Valor", format: (v) => v ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Criado em", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
          ]}
          disabled={loading}
        />
        <Button variant="outline" onClick={fetchContratos} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button 
          onClick={handleCreate}
          disabled={!podeEditar}
          title={!podeEditar ? "Você não tem permissão para criar" : undefined}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Contrato
        </Button>
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

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statusOptions.map((status) => {
          const count = contratos.filter((c) => c.status === status.value).length;
          return (
            <button
              key={status.value}
              onClick={() => setFilterValues({ ...filterValues, status: status.value })}
              className={`p-3 rounded-lg border transition-all hover:shadow-md ${
                filterValues.status === status.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${status.color}`} />
                <span className="text-sm font-medium">{status.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{count}</p>
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
                column="codigo"
                label="Código"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="nome"
                label="Nome"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="cliente"
                label="Cliente"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="data_inicio"
                label="Período"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="valor_mensal"
                label="Valor Mensal"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="status"
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
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sortedData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? "Nenhum contrato encontrado com os filtros aplicados"
                      : "Nenhum contrato cadastrado"}
                  </p>
                  {hasActiveFilters && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={clearFilters}
                      className="mt-2"
                    >
                      Limpar filtros
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedData?.map((contrato) => {
                const statusOpt = statusOptions.find((s) => s.value === contrato.status);
                return (
                  <TableRow key={contrato.id} className="group">
                    <TableCell className="font-mono font-medium">
                      {contrato.codigo}
                    </TableCell>
                    <TableCell className="font-medium">{contrato.nome}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {contrato.cliente || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(contrato.data_inicio + "T12:00:00"), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                        {contrato.data_fim && (
                          <>
                            {" - "}
                            {format(new Date(contrato.data_fim + "T12:00:00"), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contrato.valor_mensal ? (
                        <div className="flex items-center gap-1 text-green-600 font-medium">
                          <DollarSign className="h-3 w-3" />
                          {contrato.valor_mensal.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={contrato.status}
                        onValueChange={(value) => handleUpdateStatus(contrato.id, value)}
                        disabled={!podeEditar}
                      >
                        <SelectTrigger 
                          className={cn(
                            "h-7 w-[100px] text-xs font-medium border text-white",
                            statusOpt?.color,
                            !podeEditar && "cursor-not-allowed opacity-60"
                          )}
                          title={!podeEditar ? "Você não tem permissão para editar" : "Clique para alterar o status"}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${opt.color}`} />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(contrato)}
                          disabled={!podeEditar}
                          title={!podeEditar ? "Você não tem permissão para editar" : "Editar"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setContratoToDelete(contrato);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={!podeEditar}
                          title={!podeEditar ? "Você não tem permissão para excluir" : "Excluir"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Footer com contagem */}
        {sortedData && sortedData.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
            Mostrando {sortedData.length} de {contratos.length} contratos
          </div>
        )}
      </div>

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingContrato ? "Editar Contrato" : "Novo Contrato"}
            </DialogTitle>
            <DialogDescription>
              {editingContrato
                ? "Atualize as informações do contrato"
                : "Preencha os dados para criar um novo contrato"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) =>
                  setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                }
                placeholder="Ex: 4600079966"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do contrato"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_inicio">
                Data Início <span className="text-destructive">*</span>
              </Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) =>
                  setFormData({ ...formData, data_inicio: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_fim">Data Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_mensal">Valor Mensal (R$)</Label>
              <Input
                id="valor_mensal"
                type="number"
                step="0.01"
                value={formData.valor_mensal}
                onChange={(e) =>
                  setFormData({ ...formData, valor_mensal: e.target.value })
                }
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) =>
                  setFormData({ ...formData, descricao: e.target.value })
                }
                placeholder="Descrição do contrato..."
                rows={3}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) =>
                  setFormData({ ...formData, observacoes: e.target.value })
                }
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingContrato ? "Salvar Alterações" : "Criar Contrato"}
            </Button>
          </DialogFooter>
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
              Tem certeza que deseja excluir o contrato{" "}
              <strong>{contratoToDelete?.codigo}</strong>?
              <br />
              Esta ação não pode ser desfeita.
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

