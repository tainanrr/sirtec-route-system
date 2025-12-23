import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Pencil, Trash2, Loader2, DollarSign, Upload, Download, History, Calculator,
  AlertCircle, Calendar, FileSpreadsheet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters, useDataTableFilters, filterData, FilterConfig,
} from "@/components/ui/data-table-filters";
import { ExportButton } from "@/components/ui/export-button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

interface Precificacao {
  id: string;
  codigo_servico: string;
  codigo_referencia: string | null;
  descricao: string;
  fator_k: number;
  valor_unitario: number;
  valor_total: number;
  coeficiente: number;
  data_inicio: string;
  data_fim: string | null;
  casas_decimais: number;
  permite_maior_previsto: boolean;
  qtd_maior_previsto: number;
  fracao_preco_pai: number;
  ativo: boolean;
  unidade_id: string | null;
  grupo_id: string | null;
  contrato_id: string;
  preco_pai_id: string | null;
  territorio_id: string | null;
  unidades_medida?: { codigo: string; nome: string } | null;
  grupos_servico?: { codigo: string; nome: string } | null;
  contratos?: { codigo: string; nome: string } | null;
  preco_pai?: { codigo_servico: string; descricao: string } | null;
  territorios?: { nome: string } | null;
}

interface Unidade {
  id: string;
  codigo: string;
  nome: string;
}

interface Grupo {
  id: string;
  codigo: string;
  nome: string;
  contrato_id: string | null;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

interface Territorio {
  id: string;
  nome: string;
}

interface HistoricoFatorK {
  id: string;
  ano: number;
  fator_k_anterior: number;
  fator_k_novo: number;
  data_aplicacao: string;
  observacao: string | null;
  created_at: string;
}

export default function PrecificacaoServicos() {
  const [precificacoes, setPrecificacoes] = useState<Precificacao[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [fatorKDialogOpen, setFatorKDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Precificacao | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Precificacao | null>(null);
  const [historico, setHistorico] = useState<HistoricoFatorK[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    codigo_servico: "",
    codigo_referencia: "",
    descricao: "",
    fator_k: "1.000000",
    valor_unitario: "",
    coeficiente: "1.0000000",
    data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_fim: "",
    casas_decimais: "2",
    permite_maior_previsto: false,
    qtd_maior_previsto: "999999.9999999",
    fracao_preco_pai: "0.0000000",
    unidade_id: "",
    grupo_id: "",
    contrato_id: "",
    preco_pai_id: "none",
    territorio_id: "todas",
    ativo: true,
  });

  const [fatorKForm, setFatorKForm] = useState({
    contrato_id: "",
    novo_fator_k: "",
    data_aplicacao: format(new Date(), "yyyy-MM-dd"),
    observacao: "",
  });

  const filterConfigs: FilterConfig[] = useMemo(() => [
    { id: "search", label: "Buscar", type: "text", placeholder: "Código ou descrição..." },
    {
      id: "contrato_id", label: "Contrato", type: "select",
      options: contratos.map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nome}` })),
    },
    {
      id: "status", label: "Status", type: "select",
      options: [
        { value: "ativo", label: "Ativos", color: "bg-green-500" },
        { value: "inativo", label: "Inativos", color: "bg-gray-500" },
        { value: "vigente", label: "Vigentes", color: "bg-blue-500" },
      ],
    },
  ], [contratos]);

  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } = useDataTableFilters(filterConfigs);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [precRes, unidRes, grupoRes, contRes, terrRes] = await Promise.all([
        supabase.from("precificacao_servicos").select(`
          *, unidades_medida(codigo, nome), grupos_servico(codigo, nome),
          contratos(codigo, nome), territorios(nome)
        `).order("codigo_servico"),
        supabase.from("unidades_medida").select("id, codigo, nome").eq("ativo", true).order("codigo"),
        supabase.from("grupos_servico").select("id, codigo, nome, contrato_id").eq("ativo", true).order("codigo"),
        supabase.from("contratos").select("id, codigo, nome").eq("status", "ativo").order("codigo"),
        supabase.from("territorios").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      if (precRes.error) throw precRes.error;
      setPrecificacoes(precRes.data || []);
      setUnidades(unidRes.data || []);
      setGrupos(grupoRes.data || []);
      setContratos(contRes.data || []);
      setTerritorios(terrRes.data || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar precificações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredData = useMemo(() => {
    const hoje = new Date().toISOString().split("T")[0];
    return filterData(precificacoes, filterValues, filterConfigs, {
      search: (item, value) => {
        const term = value.toLowerCase();
        return item.codigo_servico.toLowerCase().includes(term) || item.descricao.toLowerCase().includes(term);
      },
      status: (item, value) => {
        if (value === "ativo") return item.ativo;
        if (value === "inativo") return !item.ativo;
        if (value === "vigente") return item.ativo && item.data_inicio <= hoje && (!item.data_fim || item.data_fim >= hoje);
        return true;
      },
    });
  }, [precificacoes, filterValues, filterConfigs]);

  const { sortConfig, handleSort, sortedData } = useSortableTable(filteredData, { column: "codigo_servico", direction: "asc" });

  // Estados para importação
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // Download template de importação em Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        codigo_servico: "CORTE",
        codigo_referencia: "SRV001",
        descricao: "Corte de fornecimento",
        fator_k: 1.0,
        valor_unitario: 50.0,
        coeficiente: 1.0,
        data_inicio: "2024-01-01",
        data_fim: "",
        casas_decimais: 2,
        permite_maior_previsto: "NÃO",
        qtd_maior_previsto: 999999.99,
        fracao_preco_pai: 0,
        unidade_codigo: "UN",
        grupo_codigo: "COMERCIAL",
        contrato_codigo: "VTC",
        territorio_nome: "",
        ativo: "SIM"
      },
      {
        codigo_servico: "RELIGA",
        codigo_referencia: "SRV002",
        descricao: "Religação de fornecimento",
        fator_k: 1.0,
        valor_unitario: 45.0,
        coeficiente: 1.0,
        data_inicio: "2024-01-01",
        data_fim: "",
        casas_decimais: 2,
        permite_maior_previsto: "NÃO",
        qtd_maior_previsto: 999999.99,
        fracao_preco_pai: 0,
        unidade_codigo: "UN",
        grupo_codigo: "COMERCIAL",
        contrato_codigo: "VTC",
        territorio_nome: "",
        ativo: "SIM"
      }
    ];
    
    // Criar aba de instruções
    const instrucoes = [
      { Campo: "codigo_servico", Obrigatorio: "SIM", Descricao: "Código único do serviço (ex: CORTE, RELIGA)" },
      { Campo: "codigo_referencia", Obrigatorio: "NÃO", Descricao: "Código de referência externo" },
      { Campo: "descricao", Obrigatorio: "SIM", Descricao: "Descrição do serviço" },
      { Campo: "fator_k", Obrigatorio: "NÃO", Descricao: "Fator K (padrão: 1.0)" },
      { Campo: "valor_unitario", Obrigatorio: "SIM", Descricao: "Valor unitário do serviço" },
      { Campo: "coeficiente", Obrigatorio: "NÃO", Descricao: "Coeficiente multiplicador (padrão: 1.0)" },
      { Campo: "data_inicio", Obrigatorio: "SIM", Descricao: "Data início vigência (formato: AAAA-MM-DD)" },
      { Campo: "data_fim", Obrigatorio: "NÃO", Descricao: "Data fim vigência (formato: AAAA-MM-DD)" },
      { Campo: "casas_decimais", Obrigatorio: "NÃO", Descricao: "Casas decimais (padrão: 2)" },
      { Campo: "permite_maior_previsto", Obrigatorio: "NÃO", Descricao: "SIM ou NÃO" },
      { Campo: "qtd_maior_previsto", Obrigatorio: "NÃO", Descricao: "Quantidade máxima permitida" },
      { Campo: "fracao_preco_pai", Obrigatorio: "NÃO", Descricao: "Fração do preço pai (composição)" },
      { Campo: "unidade_codigo", Obrigatorio: "NÃO", Descricao: "Código da unidade de medida" },
      { Campo: "grupo_codigo", Obrigatorio: "NÃO", Descricao: "Código do grupo de serviço" },
      { Campo: "contrato_codigo", Obrigatorio: "SIM", Descricao: "Código do contrato" },
      { Campo: "territorio_nome", Obrigatorio: "NÃO", Descricao: "Nome do território/zona" },
      { Campo: "ativo", Obrigatorio: "NÃO", Descricao: "SIM ou NÃO (padrão: SIM)" },
    ];

    const wb = XLSX.utils.book_new();
    
    // Aba de dados
    const wsData = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, wsData, "Precificação");
    
    // Aba de instruções
    const wsInstrucoes = XLSX.utils.json_to_sheet(instrucoes);
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, "Instruções");
    
    // Ajustar largura das colunas
    wsData["!cols"] = [
      { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 8 }
    ];
    
    wsInstrucoes["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 50 }];
    
    XLSX.writeFile(wb, "template_precificacao_servicos.xlsx");
    toast.success("Template Excel baixado com sucesso!");
  };

  // Processar arquivo de importação
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      setImportPreview(jsonData.slice(0, 5)); // Preview das primeiras 5 linhas
      toast.success(`Arquivo carregado: ${jsonData.length} registros encontrados`);
    } catch (error) {
      console.error("Erro ao ler arquivo:", error);
      toast.error("Erro ao ler arquivo. Verifique se é um arquivo Excel válido.");
      setImportFile(null);
      setImportPreview([]);
    }
  };

  // Importar dados do arquivo
  const handleImport = async () => {
    if (!importFile) {
      toast.error("Selecione um arquivo para importar");
      return;
    }
    
    setImporting(true);
    try {
      const data = await importFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
      
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      for (const row of jsonData) {
        try {
          // Validar campos obrigatórios
          if (!row.codigo_servico || !row.descricao || !row.valor_unitario || !row.contrato_codigo || !row.data_inicio) {
            errors.push(`Linha ${successCount + errorCount + 1}: Campos obrigatórios faltando`);
            errorCount++;
            continue;
          }
          
          // Buscar contrato pelo código
          const { data: contratoData } = await supabase
            .from("contratos")
            .select("id")
            .eq("codigo", row.contrato_codigo)
            .single();
          
          if (!contratoData) {
            errors.push(`Linha ${successCount + errorCount + 1}: Contrato "${row.contrato_codigo}" não encontrado`);
            errorCount++;
            continue;
          }
          
          // Buscar unidade pelo código (opcional)
          let unidadeId = null;
          if (row.unidade_codigo) {
            const { data: unidadeData } = await supabase
              .from("unidades_medida")
              .select("id")
              .eq("codigo", row.unidade_codigo)
              .single();
            unidadeId = unidadeData?.id || null;
          }
          
          // Buscar grupo pelo código (opcional)
          let grupoId = null;
          if (row.grupo_codigo) {
            const { data: grupoData } = await supabase
              .from("grupos_servico")
              .select("id")
              .eq("codigo", row.grupo_codigo)
              .single();
            grupoId = grupoData?.id || null;
          }
          
          // Buscar território pelo nome (opcional)
          let territorioId = null;
          if (row.territorio_nome) {
            const { data: territorioData } = await supabase
              .from("territorios")
              .select("id")
              .eq("nome", row.territorio_nome)
              .single();
            territorioId = territorioData?.id || null;
          }
          
          const payload = {
            codigo_servico: String(row.codigo_servico).toUpperCase(),
            codigo_referencia: row.codigo_referencia || null,
            descricao: row.descricao,
            fator_k: parseFloat(row.fator_k) || 1.0,
            valor_unitario: parseFloat(row.valor_unitario),
            coeficiente: parseFloat(row.coeficiente) || 1.0,
            data_inicio: row.data_inicio,
            data_fim: row.data_fim || null,
            casas_decimais: parseInt(row.casas_decimais) || 2,
            permite_maior_previsto: row.permite_maior_previsto === "SIM" || row.permite_maior_previsto === true,
            qtd_maior_previsto: parseFloat(row.qtd_maior_previsto) || 999999.9999999,
            fracao_preco_pai: parseFloat(row.fracao_preco_pai) || 0,
            unidade_id: unidadeId,
            grupo_id: grupoId,
            contrato_id: contratoData.id,
            territorio_id: territorioId,
            ativo: row.ativo !== "NÃO" && row.ativo !== false,
          };
          
          // Verificar se já existe (upsert)
          const { data: existing } = await supabase
            .from("precificacao_servicos")
            .select("id")
            .eq("codigo_servico", payload.codigo_servico)
            .eq("contrato_id", payload.contrato_id)
            .single();
          
          if (existing) {
            await supabase.from("precificacao_servicos").update(payload).eq("id", existing.id);
          } else {
            await supabase.from("precificacao_servicos").insert(payload);
          }
          
          successCount++;
        } catch (err: any) {
          errors.push(`Linha ${successCount + errorCount + 1}: ${err.message}`);
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(`${successCount} registros importados com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} registros com erro. Verifique o console.`);
        console.error("Erros de importação:", errors);
      }
      
      setImportDialogOpen(false);
      setImportFile(null);
      setImportPreview([]);
      fetchData();
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(`Erro na importação: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    setForm({
      codigo_servico: "", codigo_referencia: "", descricao: "",
      fator_k: "1.000000", valor_unitario: "", coeficiente: "1.0000000",
      data_inicio: format(new Date(), "yyyy-MM-dd"), data_fim: "",
      casas_decimais: "2", permite_maior_previsto: false,
      qtd_maior_previsto: "999999.9999999", fracao_preco_pai: "0.0000000",
      unidade_id: "", grupo_id: "", contrato_id: "", preco_pai_id: "none", territorio_id: "todas", ativo: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (item: Precificacao) => {
    setEditingItem(item);
    setForm({
      codigo_servico: item.codigo_servico,
      codigo_referencia: item.codigo_referencia || "",
      descricao: item.descricao,
      fator_k: item.fator_k?.toString() || "1.000000",
      valor_unitario: item.valor_unitario?.toString() || "",
      coeficiente: item.coeficiente?.toString() || "1.0000000",
      data_inicio: item.data_inicio,
      data_fim: item.data_fim || "",
      casas_decimais: item.casas_decimais?.toString() || "2",
      permite_maior_previsto: item.permite_maior_previsto,
      qtd_maior_previsto: item.qtd_maior_previsto?.toString() || "999999.9999999",
      fracao_preco_pai: item.fracao_preco_pai?.toString() || "0.0000000",
      unidade_id: item.unidade_id || "",
      grupo_id: item.grupo_id || "",
      contrato_id: item.contrato_id,
      preco_pai_id: item.preco_pai_id || "none",
      territorio_id: item.territorio_id || "todas",
      ativo: item.ativo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.codigo_servico || !form.descricao || !form.valor_unitario || !form.contrato_id || !form.data_inicio) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        codigo_servico: form.codigo_servico,
        codigo_referencia: form.codigo_referencia || null,
        descricao: form.descricao,
        fator_k: parseFloat(form.fator_k),
        valor_unitario: parseFloat(form.valor_unitario),
        coeficiente: parseFloat(form.coeficiente),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        casas_decimais: parseInt(form.casas_decimais),
        permite_maior_previsto: form.permite_maior_previsto,
        qtd_maior_previsto: parseFloat(form.qtd_maior_previsto),
        fracao_preco_pai: parseFloat(form.fracao_preco_pai),
        unidade_id: form.unidade_id || null,
        grupo_id: form.grupo_id || null,
        contrato_id: form.contrato_id,
        preco_pai_id: form.preco_pai_id && form.preco_pai_id !== "none" ? form.preco_pai_id : null,
        territorio_id: form.territorio_id && form.territorio_id !== "todas" ? form.territorio_id : null,
        ativo: form.ativo,
      };

      if (editingItem) {
        const { error } = await supabase.from("precificacao_servicos").update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Precificação atualizada");
      } else {
        const { error } = await supabase.from("precificacao_servicos").insert(payload);
        if (error) throw error;
        toast.success("Precificação criada");
      }
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const { error } = await supabase.from("precificacao_servicos").delete().eq("id", itemToDelete.id);
      if (error) throw error;
      toast.success("Precificação excluída");
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  const handleViewHistorico = async (item: Precificacao) => {
    setEditingItem(item);
    try {
      const { data, error } = await supabase
        .from("historico_fator_k")
        .select("*")
        .eq("precificacao_id", item.id)
        .order("data_aplicacao", { ascending: false });
      if (error) throw error;
      setHistorico(data || []);
      setHistoricoDialogOpen(true);
    } catch (error: any) {
      toast.error("Erro ao carregar histórico");
    }
  };

  const handleAtualizarFatorK = async () => {
    if (!fatorKForm.contrato_id || !fatorKForm.novo_fator_k || !fatorKForm.data_aplicacao) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("atualizar_fator_k_contrato", {
        p_contrato_id: fatorKForm.contrato_id,
        p_novo_fator_k: parseFloat(fatorKForm.novo_fator_k),
        p_data_aplicacao: fatorKForm.data_aplicacao,
        p_usuario_id: null,
        p_observacao: fatorKForm.observacao || null,
      });
      if (error) throw error;
      toast.success(`Fator K atualizado em ${data} serviços`);
      setFatorKDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const valorTotal = useMemo(() => {
    const fk = parseFloat(form.fator_k) || 1;
    const vu = parseFloat(form.valor_unitario) || 0;
    return (fk * vu).toFixed(parseInt(form.casas_decimais) || 2);
  }, [form.fator_k, form.valor_unitario, form.casas_decimais]);

  const gruposFiltrados = useMemo(() => {
    if (!form.contrato_id) return grupos;
    return grupos.filter(g => !g.contrato_id || g.contrato_id === form.contrato_id);
  }, [grupos, form.contrato_id]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="rounded-xl border border-border bg-card p-4 flex-1 mr-4">
          <DataTableFilters filters={filterConfigs} values={filterValues} onChange={setFilterValues} onClear={clearFilters} />
        </div>
        <div className="flex gap-2">
          <ExportButton data={precificacoes} filename="precificacao_servicos" columns={[
            { key: "codigo_servico", label: "Código" },
            { key: "descricao", label: "Descrição" },
            { key: "fator_k", label: "Fator K" },
            { key: "valor_unitario", label: "Valor Unit." },
            { key: "valor_total", label: "Valor Total" },
            { key: "data_inicio", label: "Vigência Início" },
            { key: "data_fim", label: "Vigência Fim" },
            { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
          ]} />
          <Button variant="outline" onClick={() => setFatorKDialogOpen(true)}>
            <Calculator className="h-4 w-4 mr-2" />
            Atualizar Fator K
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Preço
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="codigo_servico" label="Código" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead column="descricao" label="Descrição" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead column="fator_k" label="Fator K" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead column="valor_unitario" label="Valor Unit." sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead column="valor_total" label="Total" sortConfig={sortConfig} onSort={handleSort} />
              <TableHead>Contrato</TableHead>
              <TableHead>Vigência</TableHead>
              <SortableTableHead column="ativo" label="Status" sortConfig={sortConfig} onSort={handleSort} />
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : sortedData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <DollarSign className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">{hasActiveFilters ? "Nenhum resultado" : "Nenhum preço cadastrado"}</p>
                </TableCell>
              </TableRow>
            ) : (
              sortedData?.map((item) => {
                const hoje = new Date().toISOString().split("T")[0];
                const vigente = item.ativo && item.data_inicio <= hoje && (!item.data_fim || item.data_fim >= hoje);
                return (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-mono text-sm">{item.codigo_servico}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.descricao}</TableCell>
                    <TableCell className="font-mono">{item.fator_k?.toFixed(6)}</TableCell>
                    <TableCell>
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {item.valor_unitario?.toFixed(item.casas_decimais || 2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-blue-600 font-bold">
                        R$ {item.valor_total?.toFixed(item.casas_decimais || 2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.contratos ? (
                        <Badge variant="secondary">{item.contratos.codigo}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(item.data_inicio + "T00:00:00"), "dd/MM/yyyy")}
                        {item.data_fim && ` - ${format(new Date(item.data_fim + "T00:00:00"), "dd/MM/yyyy")}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={vigente ? "default" : item.ativo ? "secondary" : "outline"}>
                        {vigente ? "Vigente" : item.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => handleViewHistorico(item)} title="Histórico Fator K">
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setItemToDelete(item); setDeleteDialogOpen(true); }}>
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
        {sortedData && sortedData.length > 0 && (
          <div className="px-4 py-3 border-t bg-muted/30 text-sm text-muted-foreground">
            Mostrando {sortedData.length} de {precificacoes.length} registros
          </div>
        )}
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar" : "Novo"} Preço de Serviço</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Código Serviço *</Label>
                  <Input value={form.codigo_servico} onChange={(e) => setForm({ ...form, codigo_servico: e.target.value.toUpperCase() })} placeholder="SDCLU6028SC" />
                </div>
                <div className="space-y-2">
                  <Label>Código Referência</Label>
                  <Input value={form.codigo_referencia} onChange={(e) => setForm({ ...form, codigo_referencia: e.target.value })} placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <Label>Contrato *</Label>
                  <Select value={form.contrato_id} onValueChange={(v) => setForm({ ...form, contrato_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {contratos.map((c) => (<SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição do Serviço *</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="VISTORIA MICROGERACAO MEDICAO POLI" />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Fator K</Label>
                  <Input type="number" step="0.000001" value={form.fator_k} onChange={(e) => setForm({ ...form, fator_k: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Valor Unitário *</Label>
                  <Input type="number" step="0.01" value={form.valor_unitario} onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })} placeholder="39.60" />
                </div>
                <div className="space-y-2">
                  <Label>Valor Total</Label>
                  <div className="h-10 px-3 rounded-md border bg-muted flex items-center font-bold text-blue-600">
                    R$ {valorTotal}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Coeficiente</Label>
                  <Input type="number" step="0.0000001" value={form.coeficiente} onChange={(e) => setForm({ ...form, coeficiente: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map((u) => (<SelectItem key={u.id} value={u.id}>{u.codigo} - {u.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Select value={form.grupo_id} onValueChange={(v) => setForm({ ...form, grupo_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {gruposFiltrados.map((g) => (<SelectItem key={g.id} value={g.id}>{g.codigo} - {g.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Casas Decimais</Label>
                  <Select value={form.casas_decimais} onValueChange={(v) => setForm({ ...form, casas_decimais: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (<SelectItem key={n} value={n.toString()}>{n}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início Vigência *</Label>
                  <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim Vigência</Label>
                  <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço Pai (Composição)</Label>
                  <Select value={form.preco_pai_id} onValueChange={(v) => setForm({ ...form, preco_pai_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {precificacoes.filter(p => p.contrato_id === form.contrato_id && p.id !== editingItem?.id).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.codigo_servico}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fração Preço Pai</Label>
                  <Input type="number" step="0.0000001" value={form.fracao_preco_pai} onChange={(e) => setForm({ ...form, fracao_preco_pai: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zona/Território</Label>
                  <Select value={form.territorio_id} onValueChange={(v) => setForm({ ...form, territorio_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {territorios.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Maior que Previsto</Label>
                  <Input type="number" step="0.0000001" value={form.qtd_maior_previsto} onChange={(e) => setForm({ ...form, qtd_maior_previsto: e.target.value })} disabled={!form.permite_maior_previsto} />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.permite_maior_previsto} onCheckedChange={(v) => setForm({ ...form, permite_maior_previsto: v })} />
                  <Label>Permite Maior que Previsto</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico Fator K */}
      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico Fator K - {editingItem?.codigo_servico}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {historico.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum histórico encontrado</p>
            ) : (
              <div className="space-y-3">
                {historico.map((h) => (
                  <div key={h.id} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{h.ano}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(h.data_aplicacao + "T00:00:00"), "dd/MM/yyyy")}
                          </span>
                        </div>
                        <p className="text-sm">
                          <span className="text-muted-foreground">{h.fator_k_anterior?.toFixed(6)}</span>
                          <span className="mx-2">→</span>
                          <span className="font-bold text-blue-600">{h.fator_k_novo?.toFixed(6)}</span>
                        </p>
                        {h.observacao && <p className="text-xs text-muted-foreground mt-1">{h.observacao}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog Atualizar Fator K em Massa */}
      <Dialog open={fatorKDialogOpen} onOpenChange={setFatorKDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Atualizar Fator K em Massa
            </DialogTitle>
            <DialogDescription>Atualiza o Fator K de todos os serviços ativos do contrato selecionado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contrato *</Label>
              <Select value={fatorKForm.contrato_id} onValueChange={(v) => setFatorKForm({ ...fatorKForm, contrato_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => (<SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Novo Fator K *</Label>
              <Input type="number" step="0.000001" value={fatorKForm.novo_fator_k} onChange={(e) => setFatorKForm({ ...fatorKForm, novo_fator_k: e.target.value })} placeholder="1.050000" />
            </div>
            <div className="space-y-2">
              <Label>Data de Aplicação *</Label>
              <Input type="date" value={fatorKForm.data_aplicacao} onChange={(e) => setFatorKForm({ ...fatorKForm, data_aplicacao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input value={fatorKForm.observacao} onChange={(e) => setFatorKForm({ ...fatorKForm, observacao: e.target.value })} placeholder="Ex: Reajuste anual 2025" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFatorKDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAtualizarFatorK} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Importar */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setImportFile(null);
          setImportPreview([]);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Precificação
            </DialogTitle>
            <DialogDescription>Importe uma planilha Excel (.xlsx) com os preços de serviço.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-3">Arraste um arquivo Excel ou clique para selecionar</p>
              <Input 
                type="file" 
                accept=".xlsx,.xls" 
                className="max-w-xs mx-auto cursor-pointer" 
                onChange={handleFileChange}
              />
              {importFile && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-green-600">
                  <FileSpreadsheet className="h-4 w-4" />
                  {importFile.name}
                </div>
              )}
            </div>
            
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Preview (primeiras 5 linhas):</Label>
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-[150px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(importPreview[0]).slice(0, 5).map((key) => (
                            <TableHead key={key} className="text-xs whitespace-nowrap">{key}</TableHead>
                          ))}
                          {Object.keys(importPreview[0]).length > 5 && <TableHead className="text-xs">...</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.map((row, idx) => (
                          <TableRow key={idx}>
                            {Object.values(row).slice(0, 5).map((val: any, i) => (
                              <TableCell key={i} className="text-xs py-1">{String(val).substring(0, 20)}</TableCell>
                            ))}
                            {Object.keys(row).length > 5 && <TableCell className="text-xs">...</TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Modelo Excel
              </Button>
              <p className="text-xs text-muted-foreground">
                Campos obrigatórios: codigo_servico, descricao, valor_unitario, contrato_codigo, data_inicio
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importing ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{itemToDelete?.codigo_servico}</strong>?
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

