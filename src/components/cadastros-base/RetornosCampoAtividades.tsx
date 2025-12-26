import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FileText,
  Camera,
  DollarSign,
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

interface Atividade {
  id: string;
  codigo: string;
  descricao: string;
  categoria: string | null;
  grupo: string | null;
  valor_unitario: number;
  unidade: string;
  requer_foto: boolean;
  qtd_min_fotos: number;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
}

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
  const [activeTab, setActiveTab] = useState("retornos");
  
  // Dados
  const [retornos, setRetornos] = useState<RetornoCampo[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [currentType, setCurrentType] = useState<"retorno" | "atividade">("retorno");

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

  // Form de Atividade
  const [atividadeForm, setAtividadeForm] = useState({
    codigo: "",
    descricao: "",
    categoria: "",
    grupo: "",
    valor_unitario: "0",
    unidade: "UN",
    requer_foto: false,
    qtd_min_fotos: "0",
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
      const [retornosRes, atividadesRes] = await Promise.all([
        supabase.from("retornos_campo").select("*").order("codigo"),
        supabase.from("atividades").select("*").order("codigo"),
      ]);

      if (retornosRes.error) throw retornosRes.error;
      if (atividadesRes.error) throw atividadesRes.error;

      setRetornos(retornosRes.data || []);
      setAtividades(atividadesRes.data || []);
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
      status: (item, value) => {
        if (value === "ativo") return item.ativo;
        if (value === "inativo") return !item.ativo;
        return true;
      },
    });
  }, [retornos, filterValues, filterConfigs]);

  const filteredAtividades = useMemo(() => {
    return filterData(atividades, filterValues, filterConfigs, {
      search: (item, value) => {
        const term = value.toLowerCase();
        return (
          item.codigo.toLowerCase().includes(term) ||
          item.descricao.toLowerCase().includes(term) ||
          item.categoria?.toLowerCase().includes(term) || false ||
          item.grupo?.toLowerCase().includes(term) || false
        );
      },
      status: (item, value) => {
        if (value === "ativo") return item.ativo;
        if (value === "inativo") return !item.ativo;
        return true;
      },
    });
  }, [atividades, filterValues, filterConfigs]);

  const { sortConfig: retornoSortConfig, handleSort: handleRetornoSort, sortedData: sortedRetornos } =
    useSortableTable(filteredRetornos, { column: "codigo", direction: "asc" });

  const { sortConfig: atividadeSortConfig, handleSort: handleAtividadeSort, sortedData: sortedAtividades } =
    useSortableTable(filteredAtividades, { column: "codigo", direction: "asc" });

  // ============================================
  // HANDLERS
  // ============================================

  const handleCreate = (type: "retorno" | "atividade") => {
    setCurrentType(type);
    setEditingItem(null);

    if (type === "retorno") {
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
    } else {
      setAtividadeForm({
        codigo: "",
        descricao: "",
        categoria: "",
        grupo: "",
        valor_unitario: "0",
        unidade: "UN",
        requer_foto: false,
        qtd_min_fotos: "0",
        ativo: true,
        observacoes: "",
      });
    }

    setDialogOpen(true);
  };

  const handleEdit = (type: "retorno" | "atividade", item: any) => {
    setCurrentType(type);
    setEditingItem(item);

    if (type === "retorno") {
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
    } else {
      setAtividadeForm({
        codigo: item.codigo,
        descricao: item.descricao,
        categoria: item.categoria || "",
        grupo: item.grupo || "",
        valor_unitario: item.valor_unitario?.toString() || "0",
        unidade: item.unidade || "UN",
        requer_foto: item.requer_foto,
        qtd_min_fotos: item.qtd_min_fotos?.toString() || "0",
        ativo: item.ativo,
        observacoes: item.observacoes || "",
      });
    }

    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const table = currentType === "retorno" ? "retornos_campo" : "atividades";
      let payload: any;

      if (currentType === "retorno") {
        if (!retornoForm.codigo || !retornoForm.descricao) {
          toast.error("Preencha código e descrição");
          setSaving(false);
          return;
        }
        payload = {
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
      } else {
        if (!atividadeForm.codigo || !atividadeForm.descricao) {
          toast.error("Preencha código e descrição");
          setSaving(false);
          return;
        }
        payload = {
          codigo: atividadeForm.codigo.toUpperCase(),
          descricao: atividadeForm.descricao,
          categoria: atividadeForm.categoria || null,
          grupo: atividadeForm.grupo || null,
          valor_unitario: parseFloat(atividadeForm.valor_unitario) || 0,
          unidade: atividadeForm.unidade,
          requer_foto: atividadeForm.requer_foto,
          qtd_min_fotos: parseInt(atividadeForm.qtd_min_fotos) || 0,
          ativo: atividadeForm.ativo,
          observacoes: atividadeForm.observacoes || null,
        };
      }

      if (editingItem) {
        const { error } = await supabase
          .from(table)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Registro atualizado com sucesso");
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
        toast.success("Registro criado com sucesso");
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

  const confirmDelete = (type: "retorno" | "atividade", item: any) => {
    setCurrentType(type);
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const table = currentType === "retorno" ? "retornos_campo" : "atividades";
      const { error } = await supabase.from(table).delete().eq("id", itemToDelete.id);

      if (error) throw error;

      toast.success("Registro excluído com sucesso");
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="retornos" className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Retornos de Campo
            </TabsTrigger>
            <TabsTrigger value="atividades" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Atividades / Tabela de Preço
            </TabsTrigger>
          </TabsList>

          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Tab Retornos de Campo */}
        <TabsContent value="retornos" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Badge variant="outline">{retornos.filter(r => r.ativo).length} Ativos</Badge>
              <Badge variant="outline">{retornos.filter(r => r.tipo === "executado").length} Executados</Badge>
              <Badge variant="outline">{retornos.filter(r => r.tipo === "impedimento").length} Impedimentos</Badge>
            </div>
            <div className="flex gap-2">
              <ExportButton
                data={retornos}
                filename="retornos_campo"
                columns={[
                  { key: "codigo", label: "Código" },
                  { key: "descricao", label: "Descrição" },
                  { key: "tipo", label: "Tipo" },
                  { key: "categoria", label: "Categoria" },
                  { key: "gera_producao", label: "Gera Produção", format: (v: any) => v ? "Sim" : "Não" },
                  { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
                ]}
              />
              <Button onClick={() => handleCreate("retorno")}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Retorno
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <DataTableFilters
              filters={filterConfigs}
              values={filterValues}
              onChange={setFilterValues}
              onClear={clearFilters}
            />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="codigo" label="Código" sortConfig={retornoSortConfig} onSort={handleRetornoSort} />
                  <SortableTableHead column="descricao" label="Descrição" sortConfig={retornoSortConfig} onSort={handleRetornoSort} />
                  <SortableTableHead column="tipo" label="Tipo" sortConfig={retornoSortConfig} onSort={handleRetornoSort} />
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Produção</TableHead>
                  <TableHead>Cor</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={retornoSortConfig} onSort={handleRetornoSort} />
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
                ) : sortedRetornos?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <ListChecks className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {hasActiveFilters ? "Nenhum resultado" : "Nenhum retorno cadastrado"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRetornos?.map((item) => (
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
                          <Button variant="ghost" size="sm" onClick={() => handleEdit("retorno", item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => confirmDelete("retorno", item)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {sortedRetornos && sortedRetornos.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
                Mostrando {sortedRetornos.length} de {retornos.length} registros
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab Atividades */}
        <TabsContent value="atividades" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Badge variant="outline">{atividades.filter(a => a.ativo).length} Ativas</Badge>
              <Badge variant="outline">{atividades.filter(a => a.requer_foto).length} Requerem Foto</Badge>
            </div>
            <div className="flex gap-2">
              <ExportButton
                data={atividades}
                filename="atividades"
                columns={[
                  { key: "codigo", label: "Código" },
                  { key: "descricao", label: "Descrição" },
                  { key: "categoria", label: "Categoria" },
                  { key: "grupo", label: "Grupo" },
                  { key: "valor_unitario", label: "Valor", format: (v: any) => `R$ ${Number(v).toFixed(2)}` },
                  { key: "unidade", label: "Unidade" },
                  { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
                ]}
              />
              <Button onClick={() => handleCreate("atividade")}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Atividade
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <DataTableFilters
              filters={filterConfigs}
              values={filterValues}
              onChange={setFilterValues}
              onClear={clearFilters}
            />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="codigo" label="Código" sortConfig={atividadeSortConfig} onSort={handleAtividadeSort} />
                  <SortableTableHead column="descricao" label="Descrição" sortConfig={atividadeSortConfig} onSort={handleAtividadeSort} />
                  <TableHead>Categoria</TableHead>
                  <TableHead>Grupo</TableHead>
                  <SortableTableHead column="valor_unitario" label="Valor" sortConfig={atividadeSortConfig} onSort={handleAtividadeSort} className="text-right" />
                  <TableHead className="text-center">Unid.</TableHead>
                  <TableHead className="text-center">Foto</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={atividadeSortConfig} onSort={handleAtividadeSort} />
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
                ) : sortedAtividades?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {hasActiveFilters ? "Nenhum resultado" : "Nenhuma atividade cadastrada"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedAtividades?.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.descricao}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.categoria || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.grupo || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono text-green-600">
                          <DollarSign className="h-3 w-3 mr-0.5" />
                          {Number(item.valor_unitario || 0).toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">{item.unidade}</TableCell>
                      <TableCell className="text-center">
                        {item.requer_foto ? (
                          <div className="flex items-center justify-center gap-1">
                            <Camera className="h-4 w-4 text-blue-500" />
                            <span className="text-xs">{item.qtd_min_fotos}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.ativo ? "default" : "secondary"}>
                          {item.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit("atividade", item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => confirmDelete("atividade", item)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {sortedAtividades && sortedAtividades.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
                Mostrando {sortedAtividades.length} de {atividades.length} registros
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar" : "Novo"}{" "}
              {currentType === "retorno" ? "Retorno de Campo" : "Atividade"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Form de Retorno */}
            {currentType === "retorno" && (
              <>
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
              </>
            )}

            {/* Form de Atividade */}
            {currentType === "atividade" && (
              <>
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input
                    value={atividadeForm.codigo}
                    onChange={(e) => setAtividadeForm({ ...atividadeForm, codigo: e.target.value.toUpperCase() })}
                    placeholder="Ex: SDCLU6012II"
                    className="font-mono"
                    disabled={!!editingItem}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input
                    value={atividadeForm.descricao}
                    onChange={(e) => setAtividadeForm({ ...atividadeForm, descricao: e.target.value })}
                    placeholder="Ex: INSTALAR RAMAL DE LIG POLI-BT"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Input
                      value={atividadeForm.categoria}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, categoria: e.target.value })}
                      placeholder="Ex: Instalação"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grupo</Label>
                    <Input
                      value={atividadeForm.grupo}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, grupo: e.target.value })}
                      placeholder="Ex: Ramal, Medidor"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor Unitário (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={atividadeForm.valor_unitario}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, valor_unitario: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Select
                      value={atividadeForm.unidade}
                      onValueChange={(v) => setAtividadeForm({ ...atividadeForm, unidade: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UN">UN - Unidade</SelectItem>
                        <SelectItem value="M">M - Metro</SelectItem>
                        <SelectItem value="M2">M² - Metro Quadrado</SelectItem>
                        <SelectItem value="KG">KG - Quilograma</SelectItem>
                        <SelectItem value="HR">HR - Hora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label>Requer Foto</Label>
                      <p className="text-xs text-muted-foreground">Obrigatório anexar</p>
                    </div>
                    <Switch
                      checked={atividadeForm.requer_foto}
                      onCheckedChange={(v) => setAtividadeForm({ ...atividadeForm, requer_foto: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Qtd. Mín. Fotos</Label>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      value={atividadeForm.qtd_min_fotos}
                      onChange={(e) => setAtividadeForm({ ...atividadeForm, qtd_min_fotos: e.target.value })}
                      disabled={!atividadeForm.requer_foto}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label>Ativo</Label>
                    <p className="text-xs text-muted-foreground">Disponível para uso</p>
                  </div>
                  <Switch
                    checked={atividadeForm.ativo}
                    onCheckedChange={(v) => setAtividadeForm({ ...atividadeForm, ativo: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={atividadeForm.observacoes}
                    onChange={(e) => setAtividadeForm({ ...atividadeForm, observacoes: e.target.value })}
                    placeholder="Observações..."
                    rows={2}
                  />
                </div>
              </>
            )}
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


