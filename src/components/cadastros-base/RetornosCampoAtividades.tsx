import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  ListChecks,
  CheckCircle,
  XCircle,
  RefreshCcw,
} from "lucide-react";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";
import { ExportButton } from "@/components/ui/export-button";

// ============================================
// TIPOS
// ============================================

interface RetornoCampo {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  categoria: string | null;
  gera_producao: boolean;
  finaliza_os: boolean;
  requer_justificativa: boolean;
  cor: string | null;
  icone: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function RetornosCampoAtividades() {
  // Dados
  const [retornos, setRetornos] = useState<RetornoCampo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RetornoCampo | null>(null);
  const [itemToDelete, setItemToDelete] = useState<RetornoCampo | null>(null);
  const [saving, setSaving] = useState(false);

  // Form de Retorno
  const [retornoForm, setRetornoForm] = useState({
    codigo: "",
    descricao: "",
    tipo: "executado",
    categoria: "",
    gera_producao: true,
    finaliza_os: true,
    requer_justificativa: false,
    cor: "#22c55e",
    ativo: true,
    observacoes: "",
  });

  // Filtros
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por código ou descrição...",
    },
    {
      id: "tipo",
      label: "Tipo",
      type: "select",
      options: [
        { value: "executado", label: "Executado", color: "bg-green-500" },
        { value: "impedimento", label: "Impedimento", color: "bg-red-500" },
      ],
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
  ], []);

  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  // ============================================
  // CARREGAR DADOS
  // ============================================

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("retornos_campo")
        .select("*")
        .order("codigo");

      if (error) throw error;
      setRetornos(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar retornos de campo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ============================================
  // FILTROS E ORDENAÇÃO
  // ============================================

  const filteredRetornos = useMemo(() => {
    return filterData(retornos, filterValues, filterConfigs, {
      search: (item, value) => {
        const term = value.toLowerCase();
        return (
          item.codigo.toLowerCase().includes(term) ||
          item.descricao.toLowerCase().includes(term) ||
          item.categoria?.toLowerCase().includes(term) || false
        );
      },
      tipo: (item, value) => item.tipo === value,
      status: (item, value) => {
        if (value === "ativo") return item.ativo;
        if (value === "inativo") return !item.ativo;
        return true;
      },
    });
  }, [retornos, filterValues, filterConfigs]);

  const { sortConfig, handleSort, sortedData } =
    useSortableTable(filteredRetornos, { column: "codigo", direction: "asc" });

  // ============================================
  // HANDLERS
  // ============================================

  const handleCreate = () => {
    try {
      setEditingItem(null);
      setRetornoForm({
        codigo: "",
        descricao: "",
        tipo: "executado",
        categoria: "",
        gera_producao: true,
        finaliza_os: true,
        requer_justificativa: false,
        cor: "#22c55e",
        ativo: true,
        observacoes: "",
      });
      setDialogOpen(true);
    } catch (error: any) {
      console.error("Erro ao abrir dialog de criação:", error);
      toast.error(`Erro ao abrir formulário: ${error.message || "Erro desconhecido"}`);
    }
  };

  const handleEdit = (item: RetornoCampo) => {
    setEditingItem(item);
    setRetornoForm({
      codigo: item.codigo,
      descricao: item.descricao,
      tipo: item.tipo,
      categoria: item.categoria || "",
      gera_producao: item.gera_producao,
      finaliza_os: item.finaliza_os,
      requer_justificativa: item.requer_justificativa,
      cor: item.cor || "#22c55e",
      ativo: item.ativo,
      observacoes: item.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!retornoForm.codigo || !retornoForm.descricao) {
        toast.error("Preencha código e descrição");
        setSaving(false);
        return;
      }

      const payload = {
        codigo: retornoForm.codigo.toUpperCase(),
        descricao: retornoForm.descricao,
        tipo: retornoForm.tipo,
        categoria: retornoForm.categoria || null,
        gera_producao: retornoForm.gera_producao,
        finaliza_os: retornoForm.finaliza_os,
        requer_justificativa: retornoForm.requer_justificativa,
        cor: retornoForm.cor,
        ativo: retornoForm.ativo,
        observacoes: retornoForm.observacoes || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("retornos_campo")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Retorno atualizado com sucesso");
      } else {
        const { error } = await supabase.from("retornos_campo").insert(payload);
        if (error) throw error;
        toast.success("Retorno criado com sucesso");
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

  const confirmDelete = (item: RetornoCampo) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from("retornos_campo")
        .delete()
        .eq("id", itemToDelete.id);

      if (error) throw error;

      toast.success("Retorno excluído com sucesso");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "executado":
        return <Badge className="bg-green-500">Executado</Badge>;
      case "impedimento":
        return <Badge className="bg-red-500">Impedimento</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Badge variant="outline">{retornos.filter(r => r.ativo).length} Ativos</Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {retornos.filter(r => r.tipo === "executado").length} Executados
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            {retornos.filter(r => r.tipo === "impedimento").length} Impedimentos
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <ExportButton
            data={retornos}
            filename="retornos_campo"
            columns={[
              { key: "codigo", label: "Código" },
              { key: "descricao", label: "Descrição" },
              { key: "tipo", label: "Tipo" },
              { key: "categoria", label: "Categoria" },
              { key: "gera_producao", label: "Gera Produção", format: (v: any) => v ? "Sim" : "Não" },
              { key: "finaliza_os", label: "Finaliza OS", format: (v: any) => v ? "Sim" : "Não" },
              { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
            ]}
          />
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Retorno
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

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="codigo" label="Código" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead column="descricao" label="Descrição" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead column="tipo" label="Tipo" sortConfig={sortConfig} onSort={handleSort} />
              <TableHead>Categoria</TableHead>
              <TableHead className="text-center">Produção</TableHead>
              <TableHead className="text-center">Finaliza OS</TableHead>
              <TableHead>Cor</TableHead>
              <SortableTableHead column="ativo" label="Status" sortConfig={sortConfig} onSort={handleSort} />
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sortedData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <ListChecks className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters ? "Nenhum resultado encontrado" : "Nenhum retorno de campo cadastrado"}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedData?.map((item) => (
                <TableRow key={item.id} className="group">
                  <TableCell className="font-mono font-semibold">{item.codigo}</TableCell>
                  <TableCell className="max-w-xs truncate">{item.descricao}</TableCell>
                  <TableCell>{getTipoBadge(item.tipo)}</TableCell>
                  <TableCell className="text-muted-foreground">{item.categoria || "-"}</TableCell>
                  <TableCell className="text-center">
                    {item.gera_producao ? (
                      <CheckCircle className="h-4 w-4 mx-auto text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 mx-auto text-red-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.finaliza_os ? (
                      <CheckCircle className="h-4 w-4 mx-auto text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 mx-auto text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: item.cor || "#gray" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.ativo ? "default" : "secondary"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => confirmDelete(item)}>
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
            Mostrando {sortedData.length} de {retornos.length} registros
          </div>
        )}
      </div>

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar" : "Novo"} Retorno de Campo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={retornoForm.codigo}
                  onChange={(e) => setRetornoForm({ ...retornoForm, codigo: e.target.value.toUpperCase() })}
                  placeholder="Ex: 95012"
                  className="font-mono"
                  disabled={!!editingItem}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={retornoForm.tipo}
                  onValueChange={(v) => setRetornoForm({ ...retornoForm, tipo: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executado">✅ Executado</SelectItem>
                    <SelectItem value="impedimento">❌ Impedimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={retornoForm.descricao}
                onChange={(e) => setRetornoForm({ ...retornoForm, descricao: e.target.value })}
                placeholder="Ex: MONO-Poste e Ramal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={retornoForm.categoria}
                  onChange={(e) => setRetornoForm({ ...retornoForm, categoria: e.target.value })}
                  placeholder="Ex: Instalação, Técnico"
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={retornoForm.cor}
                    onChange={(e) => setRetornoForm({ ...retornoForm, cor: e.target.value })}
                    className="w-14 h-10 p-1"
                  />
                  <Input
                    value={retornoForm.cor}
                    onChange={(e) => setRetornoForm({ ...retornoForm, cor: e.target.value })}
                    className="font-mono flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Gera Produção</Label>
                  <p className="text-xs text-muted-foreground">Conta para produtividade</p>
                </div>
                <Switch
                  checked={retornoForm.gera_producao}
                  onCheckedChange={(v) => setRetornoForm({ ...retornoForm, gera_producao: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Finaliza OS</Label>
                  <p className="text-xs text-muted-foreground">Encerra a ordem</p>
                </div>
                <Switch
                  checked={retornoForm.finaliza_os}
                  onCheckedChange={(v) => setRetornoForm({ ...retornoForm, finaliza_os: v })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Requer Justificativa</Label>
                <p className="text-xs text-muted-foreground">Obrigatório informar motivo</p>
              </div>
              <Switch
                checked={retornoForm.requer_justificativa}
                onCheckedChange={(v) => setRetornoForm({ ...retornoForm, requer_justificativa: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Ativo</Label>
                <p className="text-xs text-muted-foreground">Disponível para uso</p>
              </div>
              <Switch
                checked={retornoForm.ativo}
                onCheckedChange={(v) => setRetornoForm({ ...retornoForm, ativo: v })}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={retornoForm.observacoes}
                onChange={(e) => setRetornoForm({ ...retornoForm, observacoes: e.target.value })}
                placeholder="Observações..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
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
              Tem certeza que deseja excluir <strong>{itemToDelete?.codigo}</strong> - {itemToDelete?.descricao}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
