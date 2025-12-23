import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import { ExportButton } from "@/components/ui/export-button";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";

interface Meta {
  id: string;
  equipe_id: string;
  contrato_id: string | null;
  data: string;
  meta_quantidade: number;
  meta_valor: number | null;
  tipo_meta: string;
  created_at: string;
  tecnicos?: { codigo: string; nome: string } | null;
  contratos?: { codigo: string; nome: string } | null;
}

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

const tipoMetaOptions = [
  { value: "producao", label: "Produção" },
  { value: "qualidade", label: "Qualidade" },
  { value: "faturamento", label: "Faturamento" },
];

const diasSemana = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export default function CadastroMetas() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [metaToDelete, setMetaToDelete] = useState<Meta | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Estado do mês atual para visualização
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Configuração dos filtros
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por equipe...",
    },
    {
      id: "equipe_id",
      label: "Equipe",
      type: "select",
      options: equipes.map((e) => ({
        value: e.id,
        label: `${e.codigo} - ${e.nome}`,
      })),
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
    {
      id: "tipo_meta",
      label: "Tipo",
      type: "select",
      options: tipoMetaOptions,
    },
  ], [equipes, contratos]);

  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  // Form state para meta individual
  const [formData, setFormData] = useState({
    equipe_id: "",
    contrato_id: "nenhum",
    data: new Date().toISOString().split("T")[0],
    meta_quantidade: "",
    meta_valor: "",
    tipo_meta: "producao",
  });

  // Form state para criação em massa
  const [bulkData, setBulkData] = useState({
    equipes_ids: [] as string[],
    contrato_id: "nenhum",
    data_inicio: "",
    data_fim: "",
    dias_semana: [1, 2, 3, 4, 5] as number[],
    meta_quantidade: "",
    meta_valor: "",
    tipo_meta: "producao",
  });

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from("metas")
        .select(`
          *,
          tecnicos (codigo, nome),
          contratos (codigo, nome)
        `)
        .gte("data", format(monthStart, "yyyy-MM-dd"))
        .lte("data", format(monthEnd, "yyyy-MM-dd"))
        .order("data", { ascending: true });

      if (error) throw error;
      setMetas(data || []);

      const { data: equipesData } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("codigo");
      setEquipes(equipesData || []);

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
  }, [currentMonth]);

  // Filtrar dados
  const filteredMetas = useMemo(() => {
    return filterData(
      metas,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.tecnicos?.codigo.toLowerCase().includes(searchTerm) ||
            item.tecnicos?.nome.toLowerCase().includes(searchTerm) ||
            false
          );
        },
      }
    );
  }, [metas, filterValues, filterConfigs]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredMetas,
    { column: "data", direction: "asc" }
  );

  // Sumário do mês
  const monthSummary = useMemo(() => {
    const totalMetas = metas.length;
    const totalQuantidade = metas.reduce((acc, m) => acc + m.meta_quantidade, 0);
    const totalValor = metas.reduce((acc, m) => acc + (m.meta_valor || 0), 0);
    const equipesComMeta = new Set(metas.map((m) => m.equipe_id)).size;

    return { totalMetas, totalQuantidade, totalValor, equipesComMeta };
  }, [metas]);

  const handleCreate = () => {
    setEditingMeta(null);
    setFormData({
      equipe_id: "",
      contrato_id: "nenhum",
      data: new Date().toISOString().split("T")[0],
      meta_quantidade: "",
      meta_valor: "",
      tipo_meta: "producao",
    });
    setDialogOpen(true);
  };

  const handleEdit = (meta: Meta) => {
    setEditingMeta(meta);
    setFormData({
      equipe_id: meta.equipe_id,
      contrato_id: meta.contrato_id || "nenhum",
      data: meta.data,
      meta_quantidade: meta.meta_quantidade.toString(),
      meta_valor: meta.meta_valor?.toString() || "",
      tipo_meta: meta.tipo_meta,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.equipe_id || !formData.data || !formData.meta_quantidade) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        equipe_id: formData.equipe_id,
        contrato_id: formData.contrato_id && formData.contrato_id !== "nenhum" ? formData.contrato_id : null,
        data: formData.data,
        meta_quantidade: parseInt(formData.meta_quantidade),
        meta_valor: formData.meta_valor ? parseFloat(formData.meta_valor) : null,
        tipo_meta: formData.tipo_meta,
      };

      if (editingMeta) {
        const { error } = await supabase
          .from("metas")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingMeta.id);

        if (error) throw error;
        toast.success("Meta atualizada com sucesso");
      } else {
        const { error } = await supabase.from("metas").insert(payload);

        if (error) throw error;
        toast.success("Meta criada com sucesso");
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

  const handleBulkCreate = async () => {
    if (
      bulkData.equipes_ids.length === 0 ||
      !bulkData.data_inicio ||
      !bulkData.data_fim ||
      !bulkData.meta_quantidade
    ) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const dataInicio = new Date(bulkData.data_inicio + "T12:00:00");
      const dataFim = new Date(bulkData.data_fim + "T12:00:00");
      const dias = eachDayOfInterval({ start: dataInicio, end: dataFim });

      const diasFiltrados = dias.filter((dia) =>
        bulkData.dias_semana.includes(getDay(dia))
      );

      const metasToInsert: any[] = [];

      for (const equipeId of bulkData.equipes_ids) {
        for (const dia of diasFiltrados) {
          metasToInsert.push({
            equipe_id: equipeId,
            contrato_id: bulkData.contrato_id && bulkData.contrato_id !== "nenhum" ? bulkData.contrato_id : null,
            data: format(dia, "yyyy-MM-dd"),
            meta_quantidade: parseInt(bulkData.meta_quantidade),
            meta_valor: bulkData.meta_valor
              ? parseFloat(bulkData.meta_valor)
              : null,
            tipo_meta: bulkData.tipo_meta,
          });
        }
      }

      if (metasToInsert.length === 0) {
        toast.error("Nenhuma meta para criar com os critérios informados");
        return;
      }

      const { error } = await supabase.from("metas").upsert(metasToInsert, {
        onConflict: "equipe_id,data",
      });

      if (error) throw error;

      toast.success(`${metasToInsert.length} metas criadas/atualizadas com sucesso`);
      setBulkDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao criar metas em massa:", error);
      toast.error(`Erro ao criar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!metaToDelete) return;

    try {
      const { error } = await supabase
        .from("metas")
        .delete()
        .eq("id", metaToDelete.id);

      if (error) throw error;

      toast.success("Meta excluída com sucesso");
      setDeleteDialogOpen(false);
      setMetaToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const toggleEquipeSelection = (equipeId: string) => {
    setBulkData((prev) => ({
      ...prev,
      equipes_ids: prev.equipes_ids.includes(equipeId)
        ? prev.equipes_ids.filter((id) => id !== equipeId)
        : [...prev.equipes_ids, equipeId],
    }));
  };

  const toggleDiaSemana = (dia: number) => {
    setBulkData((prev) => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter((d) => d !== dia)
        : [...prev.dias_semana, dia].sort(),
    }));
  };

  const selectAllEquipes = () => {
    setBulkData((prev) => ({
      ...prev,
      equipes_ids: equipes.map((e) => e.id),
    }));
  };

  const deselectAllEquipes = () => {
    setBulkData((prev) => ({
      ...prev,
      equipes_ids: [],
    }));
  };

  return (
    <MainLayout
      title="Metas"
      subtitle="Gerencie as metas de produção das equipes"
      breadcrumbs={[
        { label: "Cadastros", href: "/cadastros" },
        { label: "Metas" },
      ]}
    >
      <div className="space-y-6">
        {/* Header com navegação do mês */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[150px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              data={metas}
              filename="metas"
              columns={[
                { key: "data", label: "Data", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
                { key: "tecnicos.codigo", label: "Equipe Código" },
                { key: "tecnicos.nome", label: "Equipe Nome" },
                { key: "contratos.codigo", label: "Contrato" },
                { key: "meta_qtd", label: "Meta Qtd" },
                { key: "meta_valor", label: "Meta Valor", format: (v) => v ? `R$ ${Number(v).toFixed(2)}` : "" },
                { key: "realizado_qtd", label: "Realizado Qtd" },
                { key: "realizado_valor", label: "Realizado Valor", format: (v) => v ? `R$ ${Number(v).toFixed(2)}` : "" },
              ]}
              disabled={loading}
            />
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={() => {
              setBulkData({
                equipes_ids: [],
                contrato_id: "nenhum",
                data_inicio: format(startOfMonth(currentMonth), "yyyy-MM-dd"),
                data_fim: format(endOfMonth(currentMonth), "yyyy-MM-dd"),
                dias_semana: [1, 2, 3, 4, 5],
                meta_quantidade: "",
                meta_valor: "",
                tipo_meta: "producao",
              });
              setBulkDialogOpen(true);
            }}>
              <Zap className="h-4 w-4 mr-2" />
              Criação em Massa
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Meta
            </Button>
          </div>
        </div>

        {/* Resumo do mês */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              <span className="text-sm">Total de Metas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{monthSummary.totalMetas}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-blue-600">
              <Copy className="h-4 w-4" />
              <span className="text-sm">Quantidade Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{monthSummary.totalQuantidade.toLocaleString("pt-BR")}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-green-600">
              <span className="text-sm">💰 Valor Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              R$ {monthSummary.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-purple-600">
              <span className="text-sm">👥 Equipes c/ Meta</span>
            </div>
            <p className="text-2xl font-bold mt-1">{monthSummary.equipesComMeta}</p>
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
                <SortableTableHead
                  column="data"
                  label="Data"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="tecnicos.codigo"
                  label="Equipe"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="contratos.codigo"
                  label="Contrato"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="tipo_meta"
                  label="Tipo"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="meta_quantidade"
                  label="Quantidade"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="meta_valor"
                  label="Valor"
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
                    <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      {hasActiveFilters
                        ? "Nenhuma meta encontrada com os filtros aplicados"
                        : "Nenhuma meta cadastrada para este mês"}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                        Limpar filtros
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData?.map((meta) => (
                  <TableRow key={meta.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(meta.data + "T12:00:00"), "dd/MM/yyyy (EEE)", {
                          locale: ptBR,
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {meta.tecnicos ? (
                        <div>
                          <p className="font-medium">{meta.tecnicos.codigo}</p>
                          <p className="text-xs text-muted-foreground">
                            {meta.tecnicos.nome}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {meta.contratos ? (
                        <Badge variant="secondary">{meta.contratos.codigo}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tipoMetaOptions.find((t) => t.value === meta.tipo_meta)?.label ||
                          meta.tipo_meta}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-primary">
                      {meta.meta_quantidade.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {meta.meta_valor ? (
                        <span className="text-green-600 font-medium">
                          R$ {meta.meta_valor.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(meta)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMetaToDelete(meta);
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
              Mostrando {sortedData.length} de {metas.length} metas
            </div>
          )}
        </div>

        {/* Dialog de Criar/Editar */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMeta ? "Editar Meta" : "Nova Meta"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Equipe *</Label>
                <Select
                  value={formData.equipe_id}
                  onValueChange={(v) => setFormData({ ...formData, equipe_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipes.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.codigo} - {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.tipo_meta}
                    onValueChange={(v) => setFormData({ ...formData, tipo_meta: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoMetaOptions.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    value={formData.meta_quantidade}
                    onChange={(e) =>
                      setFormData({ ...formData, meta_quantidade: e.target.value })
                    }
                    placeholder="Ex: 10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.meta_valor}
                    onChange={(e) =>
                      setFormData({ ...formData, meta_valor: e.target.value })
                    }
                    placeholder="Ex: 1000.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Contrato</Label>
                <Select
                  value={formData.contrato_id}
                  onValueChange={(v) => setFormData({ ...formData, contrato_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        {/* Dialog de Criação em Massa */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Criação de Metas em Massa
              </DialogTitle>
              <DialogDescription>
                Crie metas para várias equipes e dias de uma vez
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="equipes" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="equipes">1. Equipes</TabsTrigger>
                <TabsTrigger value="periodo">2. Período</TabsTrigger>
                <TabsTrigger value="valores">3. Valores</TabsTrigger>
              </TabsList>

              <TabsContent value="equipes" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label>Selecione as equipes</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllEquipes}>
                      Selecionar Todas
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllEquipes}>
                      Limpar
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {equipes.map((equipe) => (
                    <div
                      key={equipe.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleEquipeSelection(equipe.id)}
                    >
                      <Checkbox
                        checked={bulkData.equipes_ids.includes(equipe.id)}
                        onCheckedChange={() => toggleEquipeSelection(equipe.id)}
                      />
                      <div className="flex-1">
                        <span className="font-medium">{equipe.codigo}</span>
                        <span className="text-muted-foreground ml-2">{equipe.nome}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {bulkData.equipes_ids.length} equipe(s) selecionada(s)
                </p>
              </TabsContent>

              <TabsContent value="periodo" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início *</Label>
                    <Input
                      type="date"
                      value={bulkData.data_inicio}
                      onChange={(e) =>
                        setBulkData({ ...bulkData, data_inicio: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim *</Label>
                    <Input
                      type="date"
                      value={bulkData.data_fim}
                      onChange={(e) =>
                        setBulkData({ ...bulkData, data_fim: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {diasSemana.map((dia) => (
                      <button
                        key={dia.value}
                        type="button"
                        onClick={() => toggleDiaSemana(dia.value)}
                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                          bulkData.dias_semana.includes(dia.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {dia.label}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="valores" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade por Dia *</Label>
                    <Input
                      type="number"
                      value={bulkData.meta_quantidade}
                      onChange={(e) =>
                        setBulkData({ ...bulkData, meta_quantidade: e.target.value })
                      }
                      placeholder="Ex: 10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor por Dia (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bulkData.meta_valor}
                      onChange={(e) =>
                        setBulkData({ ...bulkData, meta_valor: e.target.value })
                      }
                      placeholder="Ex: 1000.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Meta</Label>
                    <Select
                      value={bulkData.tipo_meta}
                      onValueChange={(v) =>
                        setBulkData({ ...bulkData, tipo_meta: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tipoMetaOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contrato</Label>
                    <Select
                      value={bulkData.contrato_id}
                      onValueChange={(v) =>
                        setBulkData({ ...bulkData, contrato_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {contratos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.codigo} - {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  <p className="font-medium mb-1">Resumo da criação:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>{bulkData.equipes_ids.length} equipe(s)</li>
                    <li>{bulkData.dias_semana.length} dia(s) por semana</li>
                    <li>
                      Período: {bulkData.data_inicio || "..."} a{" "}
                      {bulkData.data_fim || "..."}
                    </li>
                    <li>Meta: {bulkData.meta_quantidade || "0"} unidades/dia</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleBulkCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Metas
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
                Tem certeza que deseja excluir esta meta?
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
    </MainLayout>
  );
}

