import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Clock,
  DollarSign,
  Building,
  Tag,
  Settings2,
  Ruler,
  Wrench,
  CheckCircle,
  XCircle,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";
import { ExportButton } from "@/components/ui/export-button";
import PrecificacaoServicos from "@/components/cadastros-base/PrecificacaoServicos";
import UnidadesGruposFeriados from "@/components/cadastros-base/UnidadesGruposFeriados";

// Usando tabela skills como Tipos de Serviço
interface TipoServico {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  tempo_execucao_minutos: number;
  valor: number | null;
  regulada: boolean;
  icone: string | null;
  cor: string | null;
  ativo: boolean;
  created_at: string;
}

interface RetornoCampo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  requer_foto: boolean;
  requer_assinatura: boolean;
  ativo: boolean;
  created_at: string;
}

interface TipoIntervalo {
  id: string;
  codigo: string;
  nome: string;
  tempo_minutos: number;
  cor: string | null;
  ativo: boolean;
  created_at: string;
}

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  contrato_id: string | null;
  responsavel_id: string | null;
  orcamento_previsto: number | null;
  orcamento_utilizado: number | null;
  centro_pai_id: string | null;
  nivel: number;
  ativo: boolean;
  created_at: string;
  contratos?: { codigo: string; nome: string } | null;
  usuarios_web?: { nome: string } | null;
  centro_pai?: { codigo: string; nome: string } | null;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

interface UsuarioWeb {
  id: string;
  nome: string;
}

const tipoRetornoOptions = [
  { value: "executado", label: "Executado", color: "bg-green-500" },
  { value: "nao_executado", label: "Não Executado", color: "bg-red-500" },
  { value: "parcial", label: "Parcial", color: "bg-amber-500" },
  { value: "reagendado", label: "Reagendado", color: "bg-blue-500" },
];

export default function AdminCadastrosBase() {
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
  const [retornosCampo, setRetornosCampo] = useState<RetornoCampo[]>([]);
  const [tiposIntervalo, setTiposIntervalo] = useState<TipoIntervalo[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioWeb[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "precificacao");
  
  // Atualizar tab quando URL mudar
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  // Estados de dialog e form para cada tipo
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentFormType, setCurrentFormType] = useState<string>("");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Forms
  const [tipoServicoForm, setTipoServicoForm] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    tempo_execucao_minutos: "30",
    valor: "0",
    regulada: false,
    icone: "",
    cor: "#3b82f6",
    ativo: true,
  });

  const [retornoCampoForm, setRetornoCampoForm] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    tipo: "executado",
    requer_foto: false,
    requer_assinatura: false,
    ativo: true,
  });

  const [tipoIntervaloForm, setTipoIntervaloForm] = useState({
    codigo: "",
    nome: "",
    tempo_minutos: "",
    cor: "#3B82F6",
    ativo: true,
  });

  const [centroCustoForm, setCentroCustoForm] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    contrato_id: "todos",
    responsavel_id: "nenhum",
    orcamento_previsto: "",
    centro_pai_id: "raiz",
    ativo: true,
  });

  // Configuração de filtros para tipos de serviço (skills)
  const tipoServicoFilterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por código ou nome...",
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
      id: "regulada",
      label: "Regulada",
      type: "select",
      options: [
        { value: "sim", label: "Sim", color: "bg-green-500" },
        { value: "nao", label: "Não", color: "bg-gray-500" },
      ],
    },
  ], []);

  // Configuração de filtros genérica
  const genericFilterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por código ou nome...",
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
    useDataTableFilters(genericFilterConfigs);

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const [tiposRes, retornosRes, intervalosRes, centrosRes, contratosRes, usuariosRes] = await Promise.all([
        supabase.from("skills").select("*").order("codigo"),
        supabase.from("retornos_campo").select("*").order("codigo"),
        supabase.from("tipos_intervalo").select("*").order("codigo"),
        supabase.from("centros_custo").select("*, contratos(codigo, nome), usuarios_web:responsavel_id(nome)").order("codigo"),
        supabase.from("contratos").select("id, codigo, nome").eq("status", "ativo").order("codigo"),
        supabase.from("usuarios_web").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      if (tiposRes.error) throw tiposRes.error;
      if (retornosRes.error) throw retornosRes.error;
      if (intervalosRes.error) throw intervalosRes.error;
      if (centrosRes.error) throw centrosRes.error;
      if (contratosRes.error) throw contratosRes.error;

      setTiposServico(tiposRes.data || []);
      setRetornosCampo(retornosRes.data || []);
      setTiposIntervalo(intervalosRes.data || []);
      setCentrosCusto(centrosRes.data || []);
      setContratos(contratosRes.data || []);
      setUsuarios(usuariosRes.data || []);
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

  // Filtrar e ordenar dados para tipos de serviço (skills)
  const filteredTiposServico = useMemo(() => {
    return filterData(
      tiposServico,
      filterValues,
      tipoServicoFilterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm) ||
            item.descricao?.toLowerCase().includes(searchTerm) || false
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
        regulada: (item, value) => {
          if (value === "sim") return item.regulada === true;
          if (value === "nao") return item.regulada === false || item.regulada === null;
          return true;
        },
      }
    );
  }, [tiposServico, filterValues, tipoServicoFilterConfigs]);

  const { sortConfig: tipoServicoSortConfig, handleSort: handleTipoServicoSort, sortedData: sortedTiposServico } =
    useSortableTable(filteredTiposServico, { column: "codigo", direction: "asc" });

  // Filtrar e ordenar dados para retornos de campo
  const filteredRetornosCampo = useMemo(() => {
    return filterData(
      retornosCampo,
      filterValues,
      genericFilterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm)
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
      }
    );
  }, [retornosCampo, filterValues, genericFilterConfigs]);

  const { sortConfig: retornoSortConfig, handleSort: handleRetornoSort, sortedData: sortedRetornosCampo } =
    useSortableTable(filteredRetornosCampo, { column: "codigo", direction: "asc" });

  // Filtrar e ordenar dados para tipos de intervalo
  const filteredTiposIntervalo = useMemo(() => {
    return filterData(
      tiposIntervalo,
      filterValues,
      genericFilterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm)
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
      }
    );
  }, [tiposIntervalo, filterValues, genericFilterConfigs]);

  const { sortConfig: intervaloSortConfig, handleSort: handleIntervaloSort, sortedData: sortedTiposIntervalo } =
    useSortableTable(filteredTiposIntervalo, { column: "codigo", direction: "asc" });

  // Filtrar e ordenar dados para centros de custo
  const filteredCentrosCusto = useMemo(() => {
    return filterData(
      centrosCusto,
      filterValues,
      tipoServicoFilterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm)
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
      }
    );
  }, [centrosCusto, filterValues, tipoServicoFilterConfigs]);

  const { sortConfig: centroSortConfig, handleSort: handleCentroSort, sortedData: sortedCentrosCusto } =
    useSortableTable(filteredCentrosCusto, { column: "codigo", direction: "asc" });

  // Handlers de criação
  const handleCreate = (type: string) => {
    setCurrentFormType(type);
    setEditingItem(null);

    if (type === "tipo-servico") {
      setTipoServicoForm({
        codigo: "",
        nome: "",
        descricao: "",
        tempo_execucao_minutos: "30",
        valor: "0",
        regulada: false,
        icone: "",
        cor: "#3b82f6",
        ativo: true,
      });
    } else if (type === "retorno-campo") {
      setRetornoCampoForm({
        codigo: "",
        nome: "",
        descricao: "",
        tipo: "executado",
        requer_foto: false,
        requer_assinatura: false,
        ativo: true,
      });
    } else if (type === "tipo-intervalo") {
      setTipoIntervaloForm({
        codigo: "",
        nome: "",
        tempo_minutos: "",
        cor: "#3B82F6",
        ativo: true,
      });
    } else if (type === "centro-custo") {
      setCentroCustoForm({
        codigo: "",
        nome: "",
        descricao: "",
        contrato_id: "todos",
        responsavel_id: "nenhum",
        orcamento_previsto: "",
        centro_pai_id: "raiz",
        ativo: true,
      });
    }

    setDialogOpen(true);
  };

  // Handlers de edição
  const handleEdit = (type: string, item: any) => {
    setCurrentFormType(type);
    setEditingItem(item);

    if (type === "tipo-servico") {
      setTipoServicoForm({
        codigo: item.codigo,
        nome: item.nome,
        descricao: item.descricao || "",
        tempo_execucao_minutos: item.tempo_execucao_minutos?.toString() || "30",
        valor: item.valor?.toString() || "0",
        regulada: item.regulada || false,
        icone: item.icone || "",
        cor: item.cor || "#3b82f6",
        ativo: item.ativo,
      });
    } else if (type === "retorno-campo") {
      setRetornoCampoForm({
        codigo: item.codigo,
        nome: item.nome,
        descricao: item.descricao || "",
        tipo: item.tipo,
        requer_foto: item.requer_foto,
        requer_assinatura: item.requer_assinatura,
        ativo: item.ativo,
      });
    } else if (type === "tipo-intervalo") {
      setTipoIntervaloForm({
        codigo: item.codigo,
        nome: item.nome,
        tempo_minutos: item.tempo_minutos?.toString() || "",
        cor: item.cor || "#3B82F6",
        ativo: item.ativo,
      });
    } else if (type === "centro-custo") {
      setCentroCustoForm({
        codigo: item.codigo,
        nome: item.nome,
        descricao: item.descricao || "",
        contrato_id: item.contrato_id || "todos",
        responsavel_id: item.responsavel_id || "nenhum",
        orcamento_previsto: item.orcamento_previsto?.toString() || "",
        centro_pai_id: item.centro_pai_id || "raiz",
        ativo: item.ativo,
      });
    }

    setDialogOpen(true);
  };

  // Handler de salvamento
  const handleSave = async () => {
    setSaving(true);
    try {
      let table = "";
      let payload: any = {};

      if (currentFormType === "tipo-servico") {
        if (!tipoServicoForm.codigo || !tipoServicoForm.nome) {
          toast.error("Preencha os campos obrigatórios");
          setSaving(false);
          return;
        }
        table = "skills";
        payload = {
          codigo: tipoServicoForm.codigo.toUpperCase(),
          nome: tipoServicoForm.nome,
          descricao: tipoServicoForm.descricao || null,
          tempo_execucao_minutos: parseInt(tipoServicoForm.tempo_execucao_minutos) || 30,
          valor: parseFloat(tipoServicoForm.valor) || 0,
          regulada: tipoServicoForm.regulada,
          icone: tipoServicoForm.icone || null,
          cor: tipoServicoForm.cor || "#3b82f6",
          ativo: tipoServicoForm.ativo,
        };
      } else if (currentFormType === "retorno-campo") {
        if (!retornoCampoForm.codigo || !retornoCampoForm.nome) {
          toast.error("Preencha os campos obrigatórios");
          setSaving(false);
          return;
        }
        table = "retornos_campo";
        payload = {
          codigo: retornoCampoForm.codigo,
          nome: retornoCampoForm.nome,
          descricao: retornoCampoForm.descricao || null,
          tipo: retornoCampoForm.tipo,
          requer_foto: retornoCampoForm.requer_foto,
          requer_assinatura: retornoCampoForm.requer_assinatura,
          ativo: retornoCampoForm.ativo,
        };
      } else if (currentFormType === "tipo-intervalo") {
        if (!tipoIntervaloForm.codigo || !tipoIntervaloForm.nome || !tipoIntervaloForm.tempo_minutos) {
          toast.error("Preencha os campos obrigatórios");
          setSaving(false);
          return;
        }
        table = "tipos_intervalo";
        payload = {
          codigo: tipoIntervaloForm.codigo,
          nome: tipoIntervaloForm.nome,
          tempo_minutos: parseInt(tipoIntervaloForm.tempo_minutos),
          cor: tipoIntervaloForm.cor || null,
          ativo: tipoIntervaloForm.ativo,
        };
      } else if (currentFormType === "centro-custo") {
        if (!centroCustoForm.codigo || !centroCustoForm.nome) {
          toast.error("Preencha os campos obrigatórios");
          setSaving(false);
          return;
        }
        table = "centros_custo";
        payload = {
          codigo: centroCustoForm.codigo,
          nome: centroCustoForm.nome,
          descricao: centroCustoForm.descricao || null,
          contrato_id: centroCustoForm.contrato_id && centroCustoForm.contrato_id !== "todos" ? centroCustoForm.contrato_id : null,
          responsavel_id: centroCustoForm.responsavel_id && centroCustoForm.responsavel_id !== "nenhum" ? centroCustoForm.responsavel_id : null,
          orcamento_previsto: centroCustoForm.orcamento_previsto ? parseFloat(centroCustoForm.orcamento_previsto) : null,
          centro_pai_id: centroCustoForm.centro_pai_id && centroCustoForm.centro_pai_id !== "raiz" ? centroCustoForm.centro_pai_id : null,
          ativo: centroCustoForm.ativo,
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

  // Handler de exclusão
  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      let table = "";
      if (currentFormType === "tipo-servico") table = "skills";
      else if (currentFormType === "retorno-campo") table = "retornos_campo";
      else if (currentFormType === "tipo-intervalo") table = "tipos_intervalo";
      else if (currentFormType === "centro-custo") table = "centros_custo";

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

  const confirmDelete = (type: string, item: any) => {
    setCurrentFormType(type);
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const formatCurrency = (value: number | null) => {
    if (value == null) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cadastros Base</h2>
          <p className="text-muted-foreground">
            Configurações base do sistema: precificação, centros de custo, unidades, feriados e mais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="precificacao" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Precificação
          </TabsTrigger>
          <TabsTrigger value="centros-custo" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Centros de Custo
          </TabsTrigger>
          <TabsTrigger value="tipos-servico" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tipos de Serviço
          </TabsTrigger>
          <TabsTrigger value="retornos-campo" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Retornos
          </TabsTrigger>
          <TabsTrigger value="tipos-intervalo" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Intervalos
          </TabsTrigger>
          <TabsTrigger value="auxiliares" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Auxiliares
          </TabsTrigger>
        </TabsList>

        {/* Tab de Precificação */}
        <TabsContent value="precificacao" className="mt-6">
          <PrecificacaoServicos />
        </TabsContent>

        {/* Tab de Centros de Custo */}
        <TabsContent value="centros-custo" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <div className="rounded-xl border border-border bg-card p-4 flex-1 mr-4">
              <DataTableFilters
                filters={tipoServicoFilterConfigs}
                values={filterValues}
                onChange={setFilterValues}
                onClear={clearFilters}
              />
            </div>
            <div className="flex gap-2">
              <ExportButton
                data={centrosCusto}
                filename="centros_custo"
                columns={[
                  { key: "codigo", label: "Código" },
                  { key: "nome", label: "Nome" },
                  { key: "descricao", label: "Descrição" },
                  { key: "orcamento_previsto", label: "Orçamento Previsto", format: (v: any) => v ? `R$ ${Number(v).toFixed(2)}` : "" },
                  { key: "orcamento_utilizado", label: "Orçamento Utilizado", format: (v: any) => v ? `R$ ${Number(v).toFixed(2)}` : "" },
                  { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
                ]}
              />
              <Button onClick={() => handleCreate("centro-custo")}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Centro
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="codigo" label="Código" sortConfig={centroSortConfig} onSort={handleCentroSort} />
                  <SortableTableHead column="nome" label="Nome" sortConfig={centroSortConfig} onSort={handleCentroSort} />
                  <TableHead>Responsável</TableHead>
                  <SortableTableHead column="contratos.codigo" label="Contrato" sortConfig={centroSortConfig} onSort={handleCentroSort} />
                  <TableHead>Orçamento Prev.</TableHead>
                  <TableHead>Orçamento Util.</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={centroSortConfig} onSort={handleCentroSort} />
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
                ) : sortedCentrosCusto?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Building className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {hasActiveFilters ? "Nenhum resultado" : "Nenhum centro cadastrado"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCentrosCusto?.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-mono">{item.codigo}</TableCell>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell className="text-sm">
                        {(item as any).usuarios_web?.nome || "-"}
                      </TableCell>
                      <TableCell>
                        {item.contratos ? (
                          <Badge variant="secondary">{item.contratos.codigo}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(item.orcamento_previsto)}</TableCell>
                      <TableCell>
                        {item.orcamento_utilizado != null && item.orcamento_previsto ? (
                          <div className="flex items-center gap-2">
                            <span>{formatCurrency(item.orcamento_utilizado)}</span>
                            <Badge variant={item.orcamento_utilizado > item.orcamento_previsto ? "destructive" : "outline"} className="text-xs">
                              {((item.orcamento_utilizado / item.orcamento_previsto) * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.ativo ? "default" : "secondary"}>
                          {item.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit("centro-custo", item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => confirmDelete("centro-custo", item)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {sortedCentrosCusto && sortedCentrosCusto.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
                Mostrando {sortedCentrosCusto.length} de {centrosCusto.length} registros
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab de Tipos de Serviço */}
        {/* Tab de Tipos de Serviço / Skills */}
        <TabsContent value="tipos-servico" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">
                {tiposServico?.filter((s) => s.ativo).length || 0} Ativos
              </Badge>
              <Badge variant="outline" className="text-sm">
                {tiposServico?.filter((s) => !s.ativo).length || 0} Inativos
              </Badge>
              <Badge variant="outline" className="text-sm">
                {tiposServico?.filter((s) => s.regulada).length || 0} Regulados
              </Badge>
            </div>
            <div className="flex gap-2">
              <ExportButton
                data={tiposServico}
                filename="tipos_servico"
                columns={[
                  { key: "codigo", label: "Código" },
                  { key: "nome", label: "Nome" },
                  { key: "descricao", label: "Descrição" },
                  { key: "tempo_execucao_minutos", label: "Tempo (min)" },
                  { key: "valor", label: "Valor", format: (v: any) => v ? `R$ ${Number(v).toFixed(2)}` : "" },
                  { key: "regulada", label: "Regulada", format: (v: any) => v ? "Sim" : "Não" },
                  { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
                ]}
              />
              <Button onClick={() => handleCreate("tipo-servico")}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Tipo
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <DataTableFilters
              filters={tipoServicoFilterConfigs}
              values={filterValues}
              onChange={setFilterValues}
              onClear={clearFilters}
            />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="codigo" label="Código" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} />
                  <SortableTableHead column="nome" label="Nome" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} />
                  <TableHead>Descrição</TableHead>
                  <SortableTableHead column="tempo_execucao_minutos" label="Tempo" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} className="text-center" />
                  <SortableTableHead column="valor" label="Valor" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} className="text-center" />
                  <SortableTableHead column="regulada" label="Regulada" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} className="text-center" />
                  <TableHead className="text-center">Ícone</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} />
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
                ) : sortedTiposServico?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Wrench className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {hasActiveFilters ? "Nenhum resultado" : "Nenhum tipo cadastrado"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTiposServico?.map((item) => {
                    const IconComponent = item.icone ? (LucideIcons as any)[item.icone] : null;
                    return (
                      <TableRow key={item.id} className="group">
                        <TableCell className="font-mono font-semibold">{item.codigo}</TableCell>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.descricao || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono">
                            <Clock className="h-3 w-3 mr-1" />
                            {item.tempo_execucao_minutos} min
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-green-600">
                            <DollarSign className="h-3 w-3 mr-0.5" />
                            {Number(item.valor || 0).toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.regulada ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Sim
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              Não
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {IconComponent ? (
                            <IconComponent className="h-5 w-5 mx-auto" style={{ color: item.cor || undefined }} />
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.ativo ? "default" : "secondary"}>
                            {item.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit("tipo-servico", item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => confirmDelete("tipo-servico", item)}>
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
            {sortedTiposServico && sortedTiposServico.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
                Mostrando {sortedTiposServico.length} de {tiposServico.length} registros
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab de Retornos de Campo */}
        <TabsContent value="retornos-campo" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <div className="rounded-xl border border-border bg-card p-4 flex-1 mr-4">
              <DataTableFilters
                filters={genericFilterConfigs}
                values={filterValues}
                onChange={setFilterValues}
                onClear={clearFilters}
              />
            </div>
            <div className="flex gap-2">
              <ExportButton
                data={retornosCampo}
                filename="retornos_campo"
                columns={[
                  { key: "codigo", label: "Código" },
                  { key: "nome", label: "Nome" },
                  { key: "tipo", label: "Tipo" },
                  { key: "requer_foto", label: "Requer Foto", format: (v: any) => v ? "Sim" : "Não" },
                  { key: "requer_assinatura", label: "Requer Assinatura", format: (v: any) => v ? "Sim" : "Não" },
                  { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
                ]}
              />
              <Button onClick={() => handleCreate("retorno-campo")}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Retorno
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="codigo" label="Código" sortConfig={retornoSortConfig} onSort={handleRetornoSort} />
                  <SortableTableHead column="nome" label="Nome" sortConfig={retornoSortConfig} onSort={handleRetornoSort} />
                  <SortableTableHead column="tipo" label="Tipo" sortConfig={retornoSortConfig} onSort={handleRetornoSort} />
                  <TableHead>Requisitos</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={retornoSortConfig} onSort={handleRetornoSort} />
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
                ) : sortedRetornosCampo?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {hasActiveFilters ? "Nenhum resultado" : "Nenhum retorno cadastrado"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRetornosCampo?.map((item) => {
                    const tipoOpt = tipoRetornoOptions.find((t) => t.value === item.tipo);
                    return (
                      <TableRow key={item.id} className="group">
                        <TableCell className="font-mono">{item.codigo}</TableCell>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell>
                          <Badge className={`${tipoOpt?.color} text-white`}>
                            {tipoOpt?.label || item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {item.requer_foto && <Badge variant="outline">📷 Foto</Badge>}
                            {item.requer_assinatura && <Badge variant="outline">✍️ Assinatura</Badge>}
                            {!item.requer_foto && !item.requer_assinatura && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.ativo ? "default" : "secondary"}>
                            {item.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit("retorno-campo", item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => confirmDelete("retorno-campo", item)}>
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
            {sortedRetornosCampo && sortedRetornosCampo.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
                Mostrando {sortedRetornosCampo.length} de {retornosCampo.length} registros
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab de Tipos de Intervalo */}
        <TabsContent value="tipos-intervalo" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <div className="rounded-xl border border-border bg-card p-4 flex-1 mr-4">
              <DataTableFilters
                filters={genericFilterConfigs}
                values={filterValues}
                onChange={setFilterValues}
                onClear={clearFilters}
              />
            </div>
            <div className="flex gap-2">
              <ExportButton
                data={tiposIntervalo}
                filename="tipos_intervalo"
                columns={[
                  { key: "codigo", label: "Código" },
                  { key: "nome", label: "Nome" },
                  { key: "tempo_minutos", label: "Tempo (min)" },
                  { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
                ]}
              />
              <Button onClick={() => handleCreate("tipo-intervalo")}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Intervalo
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="codigo" label="Código" sortConfig={intervaloSortConfig} onSort={handleIntervaloSort} />
                  <SortableTableHead column="nome" label="Nome" sortConfig={intervaloSortConfig} onSort={handleIntervaloSort} />
                  <SortableTableHead column="tempo_minutos" label="Tempo" sortConfig={intervaloSortConfig} onSort={handleIntervaloSort} />
                  <TableHead>Cor</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={intervaloSortConfig} onSort={handleIntervaloSort} />
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
                ) : sortedTiposIntervalo?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {hasActiveFilters ? "Nenhum resultado" : "Nenhum intervalo cadastrado"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTiposIntervalo?.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-mono">{item.codigo}</TableCell>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {item.tempo_minutos} min
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.cor && (
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: item.cor }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.ativo ? "default" : "secondary"}>
                          {item.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit("tipo-intervalo", item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => confirmDelete("tipo-intervalo", item)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {sortedTiposIntervalo && sortedTiposIntervalo.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
                Mostrando {sortedTiposIntervalo.length} de {tiposIntervalo.length} registros
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab de Auxiliares */}
        <TabsContent value="auxiliares" className="mt-6">
          <UnidadesGruposFeriados />
        </TabsContent>
      </Tabs>

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar" : "Novo"}{" "}
              {currentFormType === "tipo-servico" && "Tipo de Serviço"}
              {currentFormType === "retorno-campo" && "Retorno de Campo"}
              {currentFormType === "tipo-intervalo" && "Tipo de Intervalo"}
              {currentFormType === "centro-custo" && "Centro de Custo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Form para Tipo de Serviço (Skills) */}
            {currentFormType === "tipo-servico" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input
                      value={tipoServicoForm.codigo}
                      onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, codigo: e.target.value.toUpperCase() })}
                      placeholder="Ex: CORTE, RELIGA"
                      className="font-mono"
                      disabled={!!editingItem}
                    />
                    <p className="text-xs text-muted-foreground">Código único (não pode ser alterado após criação)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={tipoServicoForm.nome}
                      onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, nome: e.target.value })}
                      placeholder="Ex: Corte de Energia"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={tipoServicoForm.descricao}
                    onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, descricao: e.target.value })}
                    placeholder="Descrição do tipo de serviço..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tempo de Execução (min) *</Label>
                    <Input
                      type="number"
                      min={1}
                      max={1440}
                      value={tipoServicoForm.tempo_execucao_minutos}
                      onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, tempo_execucao_minutos: e.target.value })}
                      placeholder="30"
                    />
                    <p className="text-xs text-muted-foreground">Usado na roteirização</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={tipoServicoForm.valor}
                      onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, valor: e.target.value })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">Valor de referência</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <Select
                      value={tipoServicoForm.icone || "none"}
                      onValueChange={(v) => setTipoServicoForm({ ...tipoServicoForm, icone: v === "none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="Zap">⚡ Zap (Raio)</SelectItem>
                        <SelectItem value="Power">🔌 Power (Energia)</SelectItem>
                        <SelectItem value="AlertCircle">⚠️ AlertCircle (Alerta)</SelectItem>
                        <SelectItem value="CheckCircle">✅ CheckCircle (Concluído)</SelectItem>
                        <SelectItem value="Wrench">🔧 Wrench (Ferramenta)</SelectItem>
                        <SelectItem value="Settings">⚙️ Settings (Configurações)</SelectItem>
                        <SelectItem value="Search">🔍 Search (Busca/Inspeção)</SelectItem>
                        <SelectItem value="Clipboard">📋 Clipboard (Checklist)</SelectItem>
                        <SelectItem value="FileText">📄 FileText (Documento)</SelectItem>
                        <SelectItem value="MapPin">📍 MapPin (Localização)</SelectItem>
                        <SelectItem value="Home">🏠 Home (Casa)</SelectItem>
                        <SelectItem value="Building">🏢 Building (Prédio)</SelectItem>
                        <SelectItem value="Tool">🛠️ Tool (Ferramenta)</SelectItem>
                        <SelectItem value="Plug">🔌 Plug (Tomada)</SelectItem>
                        <SelectItem value="Shield">🛡️ Shield (Proteção)</SelectItem>
                        <SelectItem value="AlertTriangle">⚠️ AlertTriangle (Atenção)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={tipoServicoForm.cor}
                        onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, cor: e.target.value })}
                        className="w-14 h-10 p-1"
                      />
                      <Input
                        value={tipoServicoForm.cor}
                        onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, cor: e.target.value })}
                        placeholder="#3b82f6"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <div className="flex items-center justify-between rounded-lg border p-3 flex-1">
                    <div className="space-y-0.5">
                      <Label>Nota Regulada</Label>
                      <p className="text-xs text-muted-foreground">Marque se é uma nota regulada</p>
                    </div>
                    <Switch checked={tipoServicoForm.regulada} onCheckedChange={(v) => setTipoServicoForm({ ...tipoServicoForm, regulada: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 flex-1">
                    <div className="space-y-0.5">
                      <Label>Ativo</Label>
                      <p className="text-xs text-muted-foreground">Tipos inativos não aparecem</p>
                    </div>
                    <Switch checked={tipoServicoForm.ativo} onCheckedChange={(v) => setTipoServicoForm({ ...tipoServicoForm, ativo: v })} />
                  </div>
                </div>
              </>
            )}

            {/* Form para Retorno de Campo */}
            {currentFormType === "retorno-campo" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input
                      value={retornoCampoForm.codigo}
                      onChange={(e) => setRetornoCampoForm({ ...retornoCampoForm, codigo: e.target.value.toUpperCase() })}
                      placeholder="Ex: RET001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select
                      value={retornoCampoForm.tipo}
                      onValueChange={(v) => setRetornoCampoForm({ ...retornoCampoForm, tipo: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tipoRetornoOptions.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={retornoCampoForm.nome}
                    onChange={(e) => setRetornoCampoForm({ ...retornoCampoForm, nome: e.target.value })}
                    placeholder="Nome do retorno"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={retornoCampoForm.requer_foto} onCheckedChange={(v) => setRetornoCampoForm({ ...retornoCampoForm, requer_foto: v })} />
                    <Label>Requer Foto</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={retornoCampoForm.requer_assinatura} onCheckedChange={(v) => setRetornoCampoForm({ ...retornoCampoForm, requer_assinatura: v })} />
                    <Label>Requer Assinatura</Label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={retornoCampoForm.ativo} onCheckedChange={(v) => setRetornoCampoForm({ ...retornoCampoForm, ativo: v })} />
                  <Label>Ativo</Label>
                </div>
              </>
            )}

            {/* Form para Tipo de Intervalo */}
            {currentFormType === "tipo-intervalo" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input
                      value={tipoIntervaloForm.codigo}
                      onChange={(e) => setTipoIntervaloForm({ ...tipoIntervaloForm, codigo: e.target.value.toUpperCase() })}
                      placeholder="Ex: INT001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo (min) *</Label>
                    <Input
                      type="number"
                      value={tipoIntervaloForm.tempo_minutos}
                      onChange={(e) => setTipoIntervaloForm({ ...tipoIntervaloForm, tempo_minutos: e.target.value })}
                      placeholder="60"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={tipoIntervaloForm.nome}
                    onChange={(e) => setTipoIntervaloForm({ ...tipoIntervaloForm, nome: e.target.value })}
                    placeholder="Nome do intervalo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={tipoIntervaloForm.cor}
                    onChange={(e) => setTipoIntervaloForm({ ...tipoIntervaloForm, cor: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={tipoIntervaloForm.ativo} onCheckedChange={(v) => setTipoIntervaloForm({ ...tipoIntervaloForm, ativo: v })} />
                  <Label>Ativo</Label>
                </div>
              </>
            )}

            {/* Form para Centro de Custo */}
            {currentFormType === "centro-custo" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input
                      value={centroCustoForm.codigo}
                      onChange={(e) => setCentroCustoForm({ ...centroCustoForm, codigo: e.target.value.toUpperCase() })}
                      placeholder="Ex: CC001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contrato</Label>
                    <Select
                      value={centroCustoForm.contrato_id}
                      onValueChange={(v) => setCentroCustoForm({ ...centroCustoForm, contrato_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {contratos.map((c) => (<SelectItem key={c.id} value={c.id}>{c.codigo}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={centroCustoForm.nome}
                    onChange={(e) => setCentroCustoForm({ ...centroCustoForm, nome: e.target.value })}
                    placeholder="Nome do centro"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Select
                      value={centroCustoForm.responsavel_id}
                      onValueChange={(v) => setCentroCustoForm({ ...centroCustoForm, responsavel_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {usuarios.map((u) => (<SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Orçamento Previsto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={centroCustoForm.orcamento_previsto}
                      onChange={(e) => setCentroCustoForm({ ...centroCustoForm, orcamento_previsto: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Centro de Custo Pai</Label>
                  <Select
                    value={centroCustoForm.centro_pai_id}
                    onValueChange={(v) => setCentroCustoForm({ ...centroCustoForm, centro_pai_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Nenhum (raiz)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raiz">Nenhum (raiz)</SelectItem>
                      {centrosCusto.filter(c => c.id !== editingItem?.id).map((c) => (<SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={centroCustoForm.descricao}
                    onChange={(e) => setCentroCustoForm({ ...centroCustoForm, descricao: e.target.value })}
                    placeholder="Descrição..."
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={centroCustoForm.ativo} onCheckedChange={(v) => setCentroCustoForm({ ...centroCustoForm, ativo: v })} />
                  <Label>Ativo</Label>
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
              Tem certeza que deseja excluir <strong>{itemToDelete?.nome}</strong>?
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
