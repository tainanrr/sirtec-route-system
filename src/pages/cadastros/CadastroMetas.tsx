import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Zap,
  Search,
  CalendarOff,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay, parseISO } from "date-fns";
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
  meta_valor: number | null;
  tipo_meta: string;
  created_at: string;
  tecnicos?: { codigo: string; nome: string; centro_custo_id?: string } | null;
  contratos?: { codigo: string; nome: string } | null;
}

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  centro_custo_id?: string;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

interface Feriado {
  id: string;
  centro_custo_id: string | null;
  data: string;
  nome: string;
  descricao?: string; // Fallback para bases que usam descricao
  tipo: string;
  nacional: boolean;
  recorrente: boolean;
  ativo: boolean;
  centros_custo?: { codigo: string; nome: string } | null;
}

// Helper para obter nome do feriado
const getFeriadoNome = (f: Feriado) => f.nome || f.descricao || "Feriado";

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
}

const tipoMetaOptions = [
  { value: "producao", label: "Produção" },
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
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feriadoDialogOpen, setFeriadoDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [editingFeriado, setEditingFeriado] = useState<Feriado | null>(null);
  const [metaToDelete, setMetaToDelete] = useState<Meta | null>(null);
  const [saving, setSaving] = useState(false);
  const [mainTab, setMainTab] = useState("metas");
  
  // Estados de busca para seleção de equipes
  const [equipeBusca, setEquipeBusca] = useState("");
  const [equipeBuscaBulk, setEquipeBuscaBulk] = useState("");
  
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
    meta_valor: "",
    tipo_meta: "producao",
    excluir_feriados: true,
  });

  // Form state para feriado
  const [feriadoForm, setFeriadoForm] = useState({
    centro_custo_id: "nacional",
    data: "",
    nome: "",
    tipo: "nacional",
    recorrente: false,
  });

  // Equipes filtradas por busca (Nova Meta)
  const equipesFiltradas = useMemo(() => {
    if (!equipeBusca.trim()) return equipes;
    const termo = equipeBusca.toLowerCase();
    return equipes.filter(
      (e) =>
        e.codigo.toLowerCase().includes(termo) ||
        e.nome.toLowerCase().includes(termo)
    );
  }, [equipes, equipeBusca]);

  // Equipes filtradas por busca (Criação em Massa)
  const equipesFiltradasBulk = useMemo(() => {
    if (!equipeBuscaBulk.trim()) return equipes;
    const termo = equipeBuscaBulk.toLowerCase();
    return equipes.filter(
      (e) =>
        e.codigo.toLowerCase().includes(termo) ||
        e.nome.toLowerCase().includes(termo)
    );
  }, [equipes, equipeBuscaBulk]);

  // Feriados que afetam o período selecionado na criação em massa
  const feriadosNoPeriodo = useMemo(() => {
    if (!bulkData.data_inicio || !bulkData.data_fim || !bulkData.excluir_feriados) return [];
    
    const inicio = parseISO(bulkData.data_inicio);
    const fim = parseISO(bulkData.data_fim);
    
    // Pegar centros de custo das equipes selecionadas
    const centrosCustoSelecionados = new Set(
      bulkData.equipes_ids
        .map(id => equipes.find(e => e.id === id)?.centro_custo_id)
        .filter(Boolean)
    );
    
    return feriados.filter(f => {
      const dataFeriado = parseISO(f.data);
      const dentroDoIntervalo = dataFeriado >= inicio && dataFeriado <= fim;
      const isNacional = f.nacional || f.tipo === "nacional";
      // Aplica se for nacional OU se não tiver centro específico OU se o centro estiver na lista
      const aplicaAosCentros = isNacional || !f.centro_custo_id || centrosCustoSelecionados.has(f.centro_custo_id);
      const diaDaSemana = getDay(dataFeriado);
      const diaTrabalho = bulkData.dias_semana.includes(diaDaSemana);
      
      return dentroDoIntervalo && aplicaAosCentros && diaTrabalho;
    });
  }, [bulkData, feriados, equipes]);

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
          tecnicos (codigo, nome, centro_custo_id),
          contratos (codigo, nome)
        `)
        .gte("data", format(monthStart, "yyyy-MM-dd"))
        .lte("data", format(monthEnd, "yyyy-MM-dd"))
        .order("data", { ascending: true });

      if (error) throw error;
      setMetas(data || []);

      const { data: equipesData } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome, centro_custo_id")
        .neq("status", "offline")
        .order("codigo");
      setEquipes(equipesData || []);

      const { data: contratosData } = await supabase
        .from("contratos")
        .select("id, codigo, nome")
        .eq("status", "ativo")
        .order("codigo");
      setContratos(contratosData || []);

      const { data: feriadosData } = await supabase
        .from("feriados")
        .select("*, centros_custo(codigo, nome)")
        .eq("ativo", true)
        .order("data", { ascending: true });
      setFeriados(feriadosData || []);

      const { data: centrosData } = await supabase
        .from("centros_custo")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("codigo");
      setCentrosCusto(centrosData || []);
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
    const totalValor = metas.reduce((acc, m) => acc + (m.meta_valor || 0), 0);
    const equipesComMeta = new Set(metas.map((m) => m.equipe_id)).size;

    return { totalMetas, totalValor, equipesComMeta };
  }, [metas]);

  const handleCreate = () => {
    setEditingMeta(null);
    setEquipeBusca("");
    setFormData({
      equipe_id: "",
      contrato_id: "nenhum",
      data: new Date().toISOString().split("T")[0],
      meta_valor: "",
      tipo_meta: "producao",
    });
    setDialogOpen(true);
  };

  const handleEdit = (meta: Meta) => {
    setEditingMeta(meta);
    setEquipeBusca("");
    setFormData({
      equipe_id: meta.equipe_id,
      contrato_id: meta.contrato_id || "nenhum",
      data: meta.data,
      meta_valor: meta.meta_valor?.toString() || "",
      tipo_meta: meta.tipo_meta,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.equipe_id || !formData.data || !formData.meta_valor) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        equipe_id: formData.equipe_id,
        contrato_id: formData.contrato_id && formData.contrato_id !== "nenhum" ? formData.contrato_id : null,
        data: formData.data,
        meta_valor: parseFloat(formData.meta_valor),
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
      !bulkData.meta_valor
    ) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const dataInicio = new Date(bulkData.data_inicio + "T12:00:00");
      const dataFim = new Date(bulkData.data_fim + "T12:00:00");
      const dias = eachDayOfInterval({ start: dataInicio, end: dataFim });

      // Filtrar dias da semana
      let diasFiltrados = dias.filter((dia) =>
        bulkData.dias_semana.includes(getDay(dia))
      );

      // Excluir feriados se marcado
      if (bulkData.excluir_feriados) {
        const datasFeridados = new Set(feriadosNoPeriodo.map(f => f.data));
        diasFiltrados = diasFiltrados.filter(dia => 
          !datasFeridados.has(format(dia, "yyyy-MM-dd"))
        );
      }

      const metasToInsert: any[] = [];

      for (const equipeId of bulkData.equipes_ids) {
        for (const dia of diasFiltrados) {
          metasToInsert.push({
            equipe_id: equipeId,
            contrato_id: bulkData.contrato_id && bulkData.contrato_id !== "nenhum" ? bulkData.contrato_id : null,
            data: format(dia, "yyyy-MM-dd"),
            meta_valor: parseFloat(bulkData.meta_valor),
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

      const diasExcluidos = feriadosNoPeriodo.length;
      toast.success(
        `${metasToInsert.length} metas criadas/atualizadas${diasExcluidos > 0 ? ` (${diasExcluidos} dia(s) excluído(s) por feriado)` : ""}`
      );
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

  const handleSaveFeriado = async () => {
    if (!feriadoForm.data || !feriadoForm.nome) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const isNacional = feriadoForm.tipo === "nacional";
      const payload = {
        centro_custo_id: isNacional ? null : (feriadoForm.centro_custo_id === "nacional" || feriadoForm.centro_custo_id === "todos" ? null : feriadoForm.centro_custo_id),
        data: feriadoForm.data,
        nome: feriadoForm.nome,
        tipo: feriadoForm.tipo,
        nacional: isNacional,
        recorrente: feriadoForm.recorrente,
        ativo: true,
      };

      if (editingFeriado) {
        // Atualizar feriado existente
        const { error } = await supabase.from("feriados").update(payload).eq("id", editingFeriado.id);
        if (error) throw error;
        toast.success("Feriado atualizado com sucesso");
      } else {
        // Criar novo feriado
        const { error } = await supabase.from("feriados").insert(payload);
        if (error) throw error;
        toast.success("Feriado cadastrado com sucesso");
      }
      
      setFeriadoDialogOpen(false);
      setEditingFeriado(null);
      setFeriadoForm({ centro_custo_id: "nacional", data: "", nome: "", tipo: "nacional", recorrente: false });
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar feriado:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditFeriado = (feriado: Feriado) => {
    setEditingFeriado(feriado);
    setFeriadoForm({
      centro_custo_id: feriado.centro_custo_id || (feriado.nacional ? "nacional" : "todos"),
      data: feriado.data,
      nome: feriado.nome,
      tipo: feriado.tipo,
      recorrente: feriado.recorrente,
    });
    setFeriadoDialogOpen(true);
  };

  const handleDeleteFeriado = async (feriadoId: string) => {
    try {
      const { error } = await supabase
        .from("feriados")
        .delete()
        .eq("id", feriadoId);

      if (error) throw error;
      toast.success("Feriado excluído");
      fetchData();
    } catch (error: any) {
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

  // Feriados do mês atual para exibição
  const feriadosDoMes = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    return feriados.filter(f => {
      const dataFeriado = parseISO(f.data);
      return dataFeriado >= monthStart && dataFeriado <= monthEnd;
    });
  }, [feriados, currentMonth]);

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
        {/* Tabs principais */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="metas">Metas</TabsTrigger>
            <TabsTrigger value="feriados">
              Feriados
              {feriados.length > 0 && (
                <Badge variant="secondary" className="ml-2">{feriados.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab de Metas */}
          <TabsContent value="metas" className="space-y-6 mt-4">
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
                    { key: "meta_valor", label: "Meta Valor", format: (v) => v ? `R$ ${Number(v).toFixed(2)}` : "" },
                  ]}
                  disabled={loading}
                />
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                  <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button variant="outline" onClick={() => {
                  setEquipeBuscaBulk("");
                  setBulkData({
                    equipes_ids: [],
                    contrato_id: "nenhum",
                    data_inicio: format(startOfMonth(currentMonth), "yyyy-MM-dd"),
                    data_fim: format(endOfMonth(currentMonth), "yyyy-MM-dd"),
                    dias_semana: [1, 2, 3, 4, 5],
                    meta_valor: "",
                    tipo_meta: "producao",
                    excluir_feriados: true,
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="h-4 w-4" />
                  <span className="text-sm">Total de Metas</span>
                </div>
                <p className="text-2xl font-bold mt-1">{monthSummary.totalMetas}</p>
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

            {/* Alerta de feriados no mês */}
            {feriadosDoMes.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-amber-800">
                    <CalendarOff className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {feriadosDoMes.length} feriado(s) neste mês:
                    </span>
                    <span className="text-sm">
                      {feriadosDoMes.map(f => 
                        `${format(parseISO(f.data), "dd/MM")} (${getFeriadoNome(f)})`
                      ).join(", ")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

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
                      column="meta_valor"
                      label="Valor (R$)"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : sortedData?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
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
                        <TableCell>
                          <span className="text-green-600 font-bold">
                            R$ {(meta.meta_valor || 0).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
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
          </TabsContent>

          {/* Tab de Feriados */}
          <TabsContent value="feriados" className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Gerenciar Feriados</h3>
                <p className="text-sm text-muted-foreground">
                  Cadastre feriados por centro de custo ou nacionais
                </p>
              </div>
              <Button onClick={() => {
                setEditingFeriado(null);
                setFeriadoForm({ centro_custo_id: "nacional", data: "", nome: "", tipo: "nacional", recorrente: false });
                setFeriadoDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Feriado
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feriados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <CalendarOff className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Nenhum feriado cadastrado</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    feriados.map((feriado) => (
                      <TableRow key={feriado.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(parseISO(feriado.data), "dd/MM/yyyy (EEE)", { locale: ptBR })}
                            {feriado.recorrente && (
                              <Badge variant="outline" className="text-[10px] px-1">Anual</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{getFeriadoNome(feriado)}</TableCell>
                        <TableCell>
                          {feriado.nacional || feriado.tipo === "nacional" ? (
                            <Badge className="bg-blue-500">Nacional</Badge>
                          ) : feriado.centros_custo ? (
                            <Badge variant="outline">
                              {feriado.centros_custo.nome}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Todos</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{feriado.tipo}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditFeriado(feriado)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFeriado(feriado.id)}
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
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog de Criar/Editar Meta */}
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar equipe..."
                    value={equipeBusca}
                    onChange={(e) => setEquipeBusca(e.target.value)}
                    className="pl-9 mb-2"
                  />
                </div>
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {equipesFiltradas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">
                      Nenhuma equipe encontrada
                    </p>
                  ) : (
                    equipesFiltradas.map((e) => (
                      <div
                        key={e.id}
                        className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50 transition-colors ${
                          formData.equipe_id === e.id ? "bg-primary/10 border-l-2 border-primary" : ""
                        }`}
                        onClick={() => setFormData({ ...formData, equipe_id: e.id })}
                      >
                        <span className="font-medium">{e.codigo}</span>
                        <span className="text-muted-foreground text-sm">{e.nome}</span>
                      </div>
                    ))
                  )}
                </div>
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

              <div className="space-y-2">
                <Label>Valor da Meta (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.meta_valor}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_valor: e.target.value })
                  }
                  placeholder="Ex: 5000.00"
                />
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar equipe por código ou nome..."
                    value={equipeBuscaBulk}
                    onChange={(e) => setEquipeBuscaBulk(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {equipesFiltradasBulk.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma equipe encontrada
                    </p>
                  ) : (
                    equipesFiltradasBulk.map((equipe) => (
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
                    ))
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {bulkData.equipes_ids.length} equipe(s) selecionada(s)
                  {equipeBuscaBulk && ` (mostrando ${equipesFiltradasBulk.length} de ${equipes.length})`}
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

                {/* Opção de excluir feriados */}
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <CalendarOff className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-900">Excluir feriados</p>
                      <p className="text-xs text-amber-700">
                        Não criar metas em dias de feriado
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={bulkData.excluir_feriados}
                    onCheckedChange={(checked) =>
                      setBulkData({ ...bulkData, excluir_feriados: checked })
                    }
                  />
                </div>

                {/* Mostrar feriados que serão excluídos */}
                {bulkData.excluir_feriados && feriadosNoPeriodo.length > 0 && (
                  <Card className="border-amber-300 bg-amber-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                        <AlertTriangle className="h-4 w-4" />
                        {feriadosNoPeriodo.length} dia(s) serão excluídos por feriado:
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {feriadosNoPeriodo.map((f) => (
                          <div key={f.id} className="flex items-center gap-2 text-sm">
                            <CalendarOff className="h-3 w-3 text-amber-600" />
                            <span className="font-medium">
                              {format(parseISO(f.data), "dd/MM/yyyy (EEE)", { locale: ptBR })}
                            </span>
                            <span className="text-amber-700">- {getFeriadoNome(f)}</span>
                            {f.nacional && (
                              <Badge className="bg-blue-500 text-xs">Nacional</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="valores" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Valor da Meta por Dia (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={bulkData.meta_valor}
                    onChange={(e) =>
                      setBulkData({ ...bulkData, meta_valor: e.target.value })
                    }
                    placeholder="Ex: 5000.00"
                  />
                </div>

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
                    <li>Meta: R$ {bulkData.meta_valor || "0,00"} /dia</li>
                    {bulkData.excluir_feriados && feriadosNoPeriodo.length > 0 && (
                      <li className="text-amber-600">
                        {feriadosNoPeriodo.length} feriado(s) serão excluídos
                      </li>
                    )}
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

        {/* Dialog de Novo/Editar Feriado */}
        <Dialog open={feriadoDialogOpen} onOpenChange={(open) => {
          setFeriadoDialogOpen(open);
          if (!open) {
            setEditingFeriado(null);
            setFeriadoForm({ centro_custo_id: "nacional", data: "", nome: "", tipo: "nacional", recorrente: false });
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingFeriado ? "Editar Feriado" : "Novo Feriado"}</DialogTitle>
              <DialogDescription>
                {editingFeriado 
                  ? "Altere as informações do feriado"
                  : "Cadastre um feriado nacional ou específico de um centro de custo"
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={feriadoForm.data}
                    onChange={(e) => setFeriadoForm({ ...feriadoForm, data: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={feriadoForm.tipo}
                    onValueChange={(v) => setFeriadoForm({ ...feriadoForm, tipo: v, centro_custo_id: v === "nacional" ? "nacional" : feriadoForm.centro_custo_id })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nacional">Nacional</SelectItem>
                      <SelectItem value="estadual">Estadual</SelectItem>
                      <SelectItem value="municipal">Municipal</SelectItem>
                      <SelectItem value="ponto_facultativo">Ponto Facultativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={feriadoForm.nome}
                  onChange={(e) => setFeriadoForm({ ...feriadoForm, nome: e.target.value })}
                  placeholder="Ex: Natal, Ano Novo..."
                />
              </div>

              {feriadoForm.tipo !== "nacional" && (
                <div className="space-y-2">
                  <Label>Centro de Custo</Label>
                  <Select
                    value={feriadoForm.centro_custo_id}
                    onValueChange={(v) => setFeriadoForm({ ...feriadoForm, centro_custo_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os centros" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Centros de Custo</SelectItem>
                      {centrosCusto.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.codigo ? `${cc.codigo} - ` : ""}{cc.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecione um centro específico ou deixe "Todos" para aplicar a todas as equipes.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  checked={feriadoForm.recorrente}
                  onCheckedChange={(v) => setFeriadoForm({ ...feriadoForm, recorrente: v })}
                />
                <Label>Recorrente (repete todo ano)</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFeriadoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveFeriado} disabled={saving}>
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
