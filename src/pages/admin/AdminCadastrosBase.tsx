import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useLogSistema } from "@/hooks/useLogSistema";
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
  Upload,
  X,
  ImageIcon,
  TrendingUp,
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
import TipoServicoRetornosConfig from "@/components/cadastros-base/TipoServicoRetornosConfig";
import RetornosCampoAtividades from "@/components/cadastros-base/RetornosCampoAtividades";
import ValoresPorContratoTab from "@/components/cadastros-base/ValoresPorContratoTab";
import { clearSkillsCache } from "@/lib/skillsUtils";

// Função para calcular a produtividade (R$/hora) e retornar a cor correspondente
const calcularProdutividade = (valor: number | null, tempoMinutos: number | null): { valor: number; cor: string; bgClass: string } => {
  if (!valor || !tempoMinutos || tempoMinutos === 0) {
    return { valor: 0, cor: "text-muted-foreground", bgClass: "bg-gray-100 dark:bg-gray-800" };
  }
  
  // Produtividade = Valor / Tempo em horas
  const produtividade = (valor / tempoMinutos) * 60;
  
  // Escala de cores baseada na produtividade (R$/hora)
  if (produtividade < 50) {
    return { valor: produtividade, cor: "text-red-700 dark:text-red-400", bgClass: "bg-red-100 dark:bg-red-900/30" };
  } else if (produtividade < 100) {
    return { valor: produtividade, cor: "text-orange-700 dark:text-orange-400", bgClass: "bg-orange-100 dark:bg-orange-900/30" };
  } else if (produtividade < 150) {
    return { valor: produtividade, cor: "text-yellow-700 dark:text-yellow-400", bgClass: "bg-yellow-100 dark:bg-yellow-900/30" };
  } else if (produtividade < 200) {
    return { valor: produtividade, cor: "text-lime-700 dark:text-lime-400", bgClass: "bg-lime-100 dark:bg-lime-900/30" };
  } else if (produtividade < 300) {
    return { valor: produtividade, cor: "text-green-700 dark:text-green-400", bgClass: "bg-green-100 dark:bg-green-900/30" };
  } else {
    return { valor: produtividade, cor: "text-emerald-700 dark:text-emerald-300", bgClass: "bg-emerald-100 dark:bg-emerald-900/40 font-semibold" };
  }
};

// Usando tabela skills como Tipos de Serviço
interface TipoServico {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  grupo_servico: string | null;
  tempo_execucao_minutos: number;
  valor: number | null;
  regulada: boolean;
  permite_avulso: boolean;
  icone: string | null;
  icone_url: string | null; // URL da imagem personalizada
  sigla: string | null; // Sigla de até 3 caracteres exibida no mapa
  cor: string | null;
  ativo: boolean;
  created_at: string;
}

interface TipoIntervalo {
  id: string;
  codigo: string;
  nome: string;
  tempo_minutos: number;
  tipo: "padrao" | "nao_padrao";
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

export default function AdminCadastrosBase() {
  const { logCriar, logEditar, logExcluir } = useLogSistema();
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
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
  
  // Estado para configuração de retornos de campo
  const [retornosConfigOpen, setRetornosConfigOpen] = useState(false);
  const [selectedTipoServico, setSelectedTipoServico] = useState<TipoServico | null>(null);

  // Forms
  const [tipoServicoForm, setTipoServicoForm] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    grupo_servico: "",
    tempo_execucao_minutos: "30",
    valor: "0",
    regulada: false,
    permite_avulso: false,
    icone: "",
    icone_url: "", // URL da imagem personalizada
    sigla: "", // Sigla de até 3 caracteres exibida no mapa
    cor: "#3b82f6",
    ativo: true,
  });

  const [tipoIntervaloForm, setTipoIntervaloForm] = useState({
    codigo: "",
    nome: "",
    tempo_minutos: "",
    tipo: "padrao" as "padrao" | "nao_padrao",
    cor: "#3B82F6",
    ativo: true,
  });

  const [centroCustoForm, setCentroCustoForm] = useState({
    nome: "",
    descricao: "",
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
      const [tiposRes, intervalosRes, centrosRes, contratosRes, usuariosRes] = await Promise.all([
        supabase.from("skills").select("*").order("codigo"),
        supabase.from("tipos_intervalo").select("*").order("codigo"),
        supabase.from("centros_custo").select("*, contratos(codigo, nome), usuarios_web:responsavel_id(nome)").order("codigo"),
        supabase.from("contratos").select("id, codigo, nome").eq("status", "ativo").order("codigo"),
        supabase.from("usuarios_web").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      if (tiposRes.error) throw tiposRes.error;
      if (intervalosRes.error) throw intervalosRes.error;
      if (centrosRes.error) throw centrosRes.error;
      if (contratosRes.error) throw contratosRes.error;

      setTiposServico(tiposRes.data || []);
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
        grupo_servico: "",
        tempo_execucao_minutos: "30",
        valor: "0",
        regulada: false,
        permite_avulso: false,
        icone: "",
        icone_url: "",
        sigla: "",
        cor: "#3b82f6",
        ativo: true,
      });
    } else if (type === "tipo-intervalo") {
      setTipoIntervaloForm({
        codigo: "",
        nome: "",
        tempo_minutos: "",
        tipo: "padrao" as "padrao" | "nao_padrao",
        cor: "#3B82F6",
        ativo: true,
      });
    } else if (type === "centro-custo") {
      setCentroCustoForm({
        nome: "",
        descricao: "",
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
        grupo_servico: item.grupo_servico || "",
        tempo_execucao_minutos: item.tempo_execucao_minutos?.toString() || "30",
        valor: item.valor?.toString() || "0",
        regulada: item.regulada || false,
        permite_avulso: item.permite_avulso || false,
        icone: item.icone || "",
        icone_url: item.icone_url || "",
        sigla: item.sigla || "",
        cor: item.cor || "#3b82f6",
        ativo: item.ativo,
      });
    } else if (type === "tipo-intervalo") {
      setTipoIntervaloForm({
        codigo: item.codigo,
        nome: item.nome,
        tempo_minutos: item.tempo_minutos?.toString() || "",
        tipo: item.tipo || "padrao",
        cor: item.cor || "#3B82F6",
        ativo: item.ativo,
      });
    } else if (type === "centro-custo") {
      setCentroCustoForm({
        nome: item.nome,
        descricao: item.descricao || "",
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
          grupo_servico: tipoServicoForm.grupo_servico || null,
          tempo_execucao_minutos: parseInt(tipoServicoForm.tempo_execucao_minutos) || 30,
          valor: parseFloat(tipoServicoForm.valor) || 0,
          regulada: tipoServicoForm.regulada,
          permite_avulso: tipoServicoForm.permite_avulso,
          icone: tipoServicoForm.icone || null,
          icone_url: tipoServicoForm.icone_url || null,
          sigla: tipoServicoForm.sigla ? tipoServicoForm.sigla.toUpperCase().slice(0, 3) : null,
          cor: tipoServicoForm.cor || "#3b82f6",
          ativo: tipoServicoForm.ativo,
        };
      } else if (currentFormType === "tipo-intervalo") {
        if (!tipoIntervaloForm.codigo || !tipoIntervaloForm.nome) {
          toast.error("Preencha os campos obrigatórios");
          setSaving(false);
          return;
        }
        table = "tipos_intervalo";
        payload = {
          codigo: tipoIntervaloForm.codigo,
          nome: tipoIntervaloForm.nome,
          tempo_minutos: parseInt(tipoIntervaloForm.tempo_minutos) || 0,
          tipo: tipoIntervaloForm.tipo,
          cor: tipoIntervaloForm.cor || null,
          ativo: tipoIntervaloForm.ativo,
        };
      } else if (currentFormType === "centro-custo") {
        if (!centroCustoForm.nome) {
          toast.error("Preencha o nome");
          setSaving(false);
          return;
        }
        table = "centros_custo";
        payload = {
          nome: centroCustoForm.nome,
          descricao: centroCustoForm.descricao || null,
          ativo: centroCustoForm.ativo,
        };
      }

      if (editingItem) {
        const { error } = await supabase
          .from(table)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingItem.id);

        if (error) throw error;
        
        // Log de edição
        logEditar("cadastros_base", table, editingItem.id, editingItem, payload,
          `Editou ${currentFormType} ${payload.codigo || payload.nome}`);
        
        // Limpar cache de skills para forçar atualização no mapa
        if (table === "skills") {
          clearSkillsCache();
        }
        
        toast.success("Registro atualizado com sucesso");
      } else {
        const { data: newData, error } = await supabase
          .from(table)
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;
        
        // Log de criação
        logCriar("cadastros_base", table, newData?.id || "", payload,
          `Criou ${currentFormType} ${payload.codigo || payload.nome}`);
        
        // Limpar cache de skills para forçar atualização no mapa
        if (table === "skills") {
          clearSkillsCache();
        }
        
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
      else if (currentFormType === "tipo-intervalo") table = "tipos_intervalo";
      else if (currentFormType === "centro-custo") table = "centros_custo";

      const { error } = await supabase.from(table).delete().eq("id", itemToDelete.id);

      if (error) throw error;

      // Log de exclusão
      logExcluir("cadastros_base", table, itemToDelete.id, itemToDelete,
        `Excluiu ${currentFormType} ${(itemToDelete as any).codigo || (itemToDelete as any).nome}`);

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
      {/* Ações */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="precificacao" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Precificação
          </TabsTrigger>
          <TabsTrigger value="retornos-campo" className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Retornos de Campo
          </TabsTrigger>
          <TabsTrigger value="centros-custo" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Centros de Custo
          </TabsTrigger>
          <TabsTrigger value="tipos-servico" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tipos de Serviço
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

        {/* Tab de Retornos de Campo */}
        <TabsContent value="retornos-campo" className="mt-6">
          <RetornosCampoAtividades />
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
                  { key: "nome", label: "Nome" },
                  { key: "descricao", label: "Descrição" },
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
                  <SortableTableHead column="nome" label="Nome" sortConfig={centroSortConfig} onSort={handleCentroSort} />
                  <TableHead>Descrição</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={centroSortConfig} onSort={handleCentroSort} />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : sortedCentrosCusto?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Building className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {hasActiveFilters ? "Nenhum resultado" : "Nenhum centro cadastrado"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCentrosCusto?.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {item.descricao || "-"}
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
                data={tiposServico.map(s => ({
                  ...s,
                  produtividade_prev: s.valor && s.tempo_execucao_minutos 
                    ? ((s.valor / s.tempo_execucao_minutos) * 60).toFixed(2) 
                    : 0
                }))}
                filename="tipos_servico"
                columns={[
                  { key: "codigo", label: "Código" },
                  { key: "nome", label: "Nome" },
                  { key: "grupo_servico", label: "Grupo" },
                  { key: "descricao", label: "Descrição" },
                  { key: "tempo_execucao_minutos", label: "Tempo (min)" },
                  { key: "valor", label: "Valor", format: (v: any) => v ? `R$ ${Number(v).toFixed(2)}` : "" },
                  { key: "produtividade_prev", label: "Produtividade (R$/h)", format: (v: any) => v ? `R$ ${Number(v).toFixed(2)}/h` : "" },
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
                  <SortableTableHead column="grupo_servico" label="Grupo" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} />
                  <TableHead>Descrição</TableHead>
                  <SortableTableHead column="tempo_execucao_minutos" label="Tempo" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} className="text-center" />
                  <SortableTableHead column="valor" label="Valor" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} className="text-center" />
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>Produtiv.</span>
                    </div>
                  </TableHead>
                  <SortableTableHead column="regulada" label="Regulada" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} className="text-center" />
                  <TableHead className="text-center">Avulso</TableHead>
                  <TableHead className="text-center">Sigla/Mapa</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={tipoServicoSortConfig} onSort={handleTipoServicoSort} />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                        <TableCell colSpan={12} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : sortedTiposServico?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
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
                        <TableCell>
                          {item.grupo_servico ? (
                            <Badge variant="outline" className="bg-slate-50">{item.grupo_servico}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
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
                          {(() => {
                            const prod = calcularProdutividade(item.valor, item.tempo_execucao_minutos);
                            return (
                              <Badge 
                                variant="outline" 
                                className={`font-mono ${prod.cor} ${prod.bgClass} border-0`}
                                title={`Produtividade: R$ ${prod.valor.toFixed(2)}/hora (Valor ÷ Tempo × 60)`}
                              >
                                <TrendingUp className="h-3 w-3 mr-1" />
                                R$ {prod.valor.toFixed(0)}/h
                              </Badge>
                            );
                          })()}
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
                          {item.permite_avulso ? (
                            <Badge variant="default" className="bg-violet-600">
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
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs mx-auto shadow-sm border border-white/50"
                            style={{ backgroundColor: item.cor || '#6b7280' }}
                            title={`Sigla: ${item.sigla || '-'}`}
                          >
                            {item.sigla || '?'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.ativo ? "default" : "secondary"}>
                            {item.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setSelectedTipoServico(item);
                                setRetornosConfigOpen(true);
                              }}
                              title="Configurar Retornos de Campo"
                            >
                              <Settings2 className="h-4 w-4 text-blue-600" />
                            </Button>
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
                  { key: "tipo", label: "Tipo", format: (v: any) => v === "padrao" ? "Padrão" : "Não Padrão" },
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
                  <SortableTableHead column="tipo" label="Tipo" sortConfig={intervaloSortConfig} onSort={handleIntervaloSort} />
                  <SortableTableHead column="tempo_minutos" label="Tempo" sortConfig={intervaloSortConfig} onSort={handleIntervaloSort} />
                  <TableHead>Cor</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={intervaloSortConfig} onSort={handleIntervaloSort} />
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
                ) : sortedTiposIntervalo?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
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
                        <Badge variant={item.tipo === "padrao" ? "default" : "outline"} className={item.tipo === "padrao" ? "bg-green-100 text-green-700 border-green-300" : "bg-amber-100 text-amber-700 border-amber-300"}>
                          {item.tipo === "padrao" ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Padrão</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Exceção</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {item.tempo_minutos || 0} min
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
              {currentFormType === "tipo-intervalo" && "Tipo de Intervalo"}
              {currentFormType === "centro-custo" && "Centro de Custo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Form para Tipo de Serviço (Skills) */}
            {currentFormType === "tipo-servico" && (
              <Tabs defaultValue="geral" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
                  <TabsTrigger value="valores" disabled={!editingItem}>
                    <DollarSign className="h-4 w-4 mr-1" />
                    Valores por Contrato
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="geral" className="space-y-4">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Grupo de Serviço</Label>
                      <Input
                        value={tipoServicoForm.grupo_servico}
                        onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, grupo_servico: e.target.value })}
                        placeholder="Ex: Comercial, Técnico, Emergência"
                      />
                      <p className="text-xs text-muted-foreground">Usado para filtros e agrupamentos</p>
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tempo de Execução Previsto (min) *</Label>
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
                      <Label>Valor Previsto (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={tipoServicoForm.valor}
                        onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, valor: e.target.value })}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground">Valor de referência geral (configure valores por contrato na aba Valores)</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Sigla (Mapa) *</Label>
                      <Input
                        value={tipoServicoForm.sigla}
                        onChange={(e) => setTipoServicoForm({ ...tipoServicoForm, sigla: e.target.value.toUpperCase().slice(0, 3) })}
                        placeholder="Ex: COA"
                        maxLength={3}
                        className="font-mono font-bold text-center uppercase"
                      />
                      <p className="text-xs text-muted-foreground">Máx. 3 caracteres. Exibida no mapa.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Cor *</Label>
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
                    <div className="space-y-2">
                      <Label>Preview</Label>
                      <div className="flex items-center justify-center h-10">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white"
                          style={{ backgroundColor: tipoServicoForm.cor || '#3b82f6' }}
                        >
                          {tipoServicoForm.sigla || '?'}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">Como aparece no mapa</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ícone (Referência)</Label>
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
                    <p className="text-xs text-muted-foreground">Ícone de referência para listagens (não exibido no mapa)</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label>Regulada</Label>
                        <p className="text-xs text-muted-foreground">Nota regulada (ANEEL)</p>
                      </div>
                      <Switch checked={tipoServicoForm.regulada} onCheckedChange={(v) => setTipoServicoForm({ ...tipoServicoForm, regulada: v })} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3 border-violet-200 bg-violet-50/50">
                      <div className="space-y-0.5">
                        <Label>Permite Avulso</Label>
                        <p className="text-xs text-muted-foreground">Criar OS pelo app</p>
                      </div>
                      <Switch checked={tipoServicoForm.permite_avulso} onCheckedChange={(v) => setTipoServicoForm({ ...tipoServicoForm, permite_avulso: v })} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label>Ativo</Label>
                        <p className="text-xs text-muted-foreground">Tipos inativos não aparecem</p>
                      </div>
                      <Switch checked={tipoServicoForm.ativo} onCheckedChange={(v) => setTipoServicoForm({ ...tipoServicoForm, ativo: v })} />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="valores">
                  {editingItem && (
                    <ValoresPorContratoTab 
                      skillCodigo={(editingItem as TipoServico).codigo}
                      skillNome={(editingItem as TipoServico).nome}
                    />
                  )}
                </TabsContent>
              </Tabs>
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
                      placeholder="Ex: ALMOCO"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo Padrão (min)</Label>
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
                  <Label>Tipo *</Label>
                  <Select
                    value={tipoIntervaloForm.tipo}
                    onValueChange={(v: "padrao" | "nao_padrao") => setTipoIntervaloForm({ ...tipoIntervaloForm, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Padrão (Esperado)
                        </div>
                      </SelectItem>
                      <SelectItem value="nao_padrao">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Não Padrão (Exceção)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {tipoIntervaloForm.tipo === "padrao" 
                      ? "Intervalos esperados na rotina (ex: Almoço, Lanche)"
                      : "Intervalos de exceção (ex: Oficina, Chuva, Manutenção)"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <Input
                      type="color"
                      value={tipoIntervaloForm.cor}
                      onChange={(e) => setTipoIntervaloForm({ ...tipoIntervaloForm, cor: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={tipoIntervaloForm.ativo} onCheckedChange={(v) => setTipoIntervaloForm({ ...tipoIntervaloForm, ativo: v })} />
                    <Label>Ativo</Label>
                  </div>
                </div>
              </>
            )}

            {/* Form para Centro de Custo */}
            {currentFormType === "centro-custo" && (
              <>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={centroCustoForm.nome}
                    onChange={(e) => setCentroCustoForm({ ...centroCustoForm, nome: e.target.value })}
                    placeholder="Nome do centro de custo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={centroCustoForm.descricao}
                    onChange={(e) => setCentroCustoForm({ ...centroCustoForm, descricao: e.target.value })}
                    placeholder="Descrição..."
                    rows={3}
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

      {/* Dialog de Configuração de Retornos de Campo */}
      {selectedTipoServico && (
        <TipoServicoRetornosConfig
          tipoServicoId={selectedTipoServico.id}
          tipoServicoCodigo={selectedTipoServico.codigo}
          tipoServicoNome={selectedTipoServico.nome}
          open={retornosConfigOpen}
          onOpenChange={setRetornosConfigOpen}
        />
      )}
    </div>
  );
}

