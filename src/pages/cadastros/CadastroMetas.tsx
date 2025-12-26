import { useState, useEffect, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Zap,
  Search,
  CalendarOff,
  AlertTriangle,
  Check,
  X,
  Save,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay, parseISO, isWeekend, getDate, setDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Meta {
  id: string;
  equipe_id: string;
  contrato_id: string | null;
  data: string;
  valor_meta: number | null;
  tipo_meta: string;
  created_at: string;
}

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  centro_custo_id?: string;
  tipo_equipe?: string;
}

// Labels para tipos de equipe
const tipoEquipeLabels: Record<string, { label: string; color: string }> = {
  normal: { label: "Normal", color: "bg-gray-500" },
  gaviao: { label: "Gavião", color: "bg-orange-500" },
  kit: { label: "Kit", color: "bg-purple-500" },
};

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
  descricao?: string;
  tipo: string;
  nacional: boolean;
  recorrente: boolean;
  ativo: boolean;
  centros_custo?: { codigo: string; nome: string } | null;
}

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
}

// Helper para obter nome do feriado
const getFeriadoNome = (f: Feriado) => f.nome || f.descricao || "Feriado";

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

// Separador único para chaves compostas (evitar conflito com UUID hífens)
const KEY_SEP = "|||";

// Função para calcular o período padrão (26 do mês até 25 do próximo)
const calcularPeriodoPadrao = (dataRef: Date = new Date()) => {
  const diaAtual = getDate(dataRef);
  
  let inicio: Date;
  let fim: Date;
  
  if (diaAtual >= 26) {
    // Se é dia 26 ou depois: 26 do mês atual até 25 do próximo mês
    inicio = setDate(dataRef, 26);
    fim = setDate(addMonths(dataRef, 1), 25);
  } else {
    // Se é antes do dia 26: 26 do mês anterior até 25 do mês atual
    inicio = setDate(subMonths(dataRef, 1), 26);
    fim = setDate(dataRef, 25);
  }
  
  return {
    inicio: format(inicio, "yyyy-MM-dd"),
    fim: format(fim, "yyyy-MM-dd"),
  };
};

export default function CadastroMetas() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mainTab, setMainTab] = useState("metas");
  
  // Estado do mês atual para visualização
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Período padrão 26-25
  const periodoPadrao = calcularPeriodoPadrao();
  
  // Filtros de data personalizados (padrão: período 26-25)
  const [usarPeriodoCustom, setUsarPeriodoCustom] = useState(true); // Já inicia com período customizado
  const [dataInicio, setDataInicio] = useState(periodoPadrao.inicio);
  const [dataFim, setDataFim] = useState(periodoPadrao.fim);
  
  // Estados para edição
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyWithMeta, setShowOnlyWithMeta] = useState(false);
  const [filtroCentroCusto, setFiltroCentroCusto] = useState<string>("todos");
  const [filtroTipoEquipe, setFiltroTipoEquipe] = useState<string>("todos");
  
  // Estados de busca para seleção de equipes
  const [equipeBuscaBulk, setEquipeBuscaBulk] = useState("");
  
  // Dialogs
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [feriadoDialogOpen, setFeriadoDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [bulkValueDialogOpen, setBulkValueDialogOpen] = useState(false);
  const [distribuirDialogOpen, setDistribuirDialogOpen] = useState(false);
  const [editingFeriado, setEditingFeriado] = useState<Feriado | null>(null);

  // Form state para criação em massa
  const [bulkData, setBulkData] = useState({
    equipes_ids: [] as string[],
    contrato_id: "nenhum",
    data_inicio: "",
    data_fim: "",
    dias_semana: [1, 2, 3, 4, 5] as number[],
    valor_meta: "",
    tipo_meta: "producao",
    excluir_feriados: true,
  });

  // Form state para distribuir meta total
  const [distribuirData, setDistribuirData] = useState({
    equipes_ids: [] as string[],
    contrato_id: "nenhum",
    data_inicio: periodoPadrao.inicio,
    data_fim: periodoPadrao.fim,
    dias_semana: [1, 2, 3, 4, 5] as number[],
    valor_total: "",
    tipo_meta: "producao",
    excluir_feriados: true,
  });
  const [equipeBuscaDistribuir, setEquipeBuscaDistribuir] = useState("");

  // Form state para feriado
  const [feriadoForm, setFeriadoForm] = useState({
    centro_custo_id: "nacional",
    data: "",
    nome: "",
    tipo: "nacional",
    recorrente: false,
  });

  // Form para copiar metas
  const [copyData, setCopyData] = useState({
    equipeOrigem: "",
    equipesDestino: [] as string[],
    sobrescrever: false,
  });

  // Valor para aplicar em massa
  const [bulkValue, setBulkValue] = useState("");

  // Dias do período (mês ou customizado)
  const diasDoMes = useMemo(() => {
    if (usarPeriodoCustom && dataInicio && dataFim) {
      return eachDayOfInterval({
        start: parseISO(dataInicio),
        end: parseISO(dataFim),
      });
    }
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
  }, [currentMonth, usarPeriodoCustom, dataInicio, dataFim]);

  // Mapa de feriados por data
  const feriadosPorData = useMemo(() => {
    const map = new Map<string, Feriado>();
    feriados.forEach(f => {
      if (f.recorrente) {
        const [, mes, dia] = f.data.split("-");
        diasDoMes.forEach(d => {
          if (format(d, "MM-dd") === `${mes}-${dia}`) {
            map.set(format(d, "yyyy-MM-dd"), f);
          }
        });
      } else {
        map.set(f.data, f);
      }
    });
    return map;
  }, [feriados, diasDoMes]);

  // Mapa de metas por equipe+data
  const metasPorEquipeData = useMemo(() => {
    const map = new Map<string, Meta>();
    metas.forEach(m => {
      map.set(`${m.equipe_id}${KEY_SEP}${m.data}`, m);
    });
    return map;
  }, [metas]);

  // Equipes filtradas
  const equipesFiltradas = useMemo(() => {
    let filtered = equipes;
    
    // Filtro por texto (código ou nome)
    if (searchTerm) {
      const termo = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.codigo.toLowerCase().includes(termo) ||
        e.nome.toLowerCase().includes(termo)
      );
    }
    
    // Filtro por centro de custo
    if (filtroCentroCusto && filtroCentroCusto !== "todos") {
      filtered = filtered.filter(e => e.centro_custo_id === filtroCentroCusto);
    }
    
    // Filtro por tipo de equipe
    if (filtroTipoEquipe && filtroTipoEquipe !== "todos") {
      filtered = filtered.filter(e => e.tipo_equipe === filtroTipoEquipe);
    }
    
    // Filtro só com meta
    if (showOnlyWithMeta) {
      const equipesComMeta = new Set(metas.map(m => m.equipe_id));
      filtered = filtered.filter(e => equipesComMeta.has(e.id));
    }
    
    return filtered;
  }, [equipes, searchTerm, showOnlyWithMeta, metas, filtroCentroCusto, filtroTipoEquipe]);

  // Resumo
  const resumo = useMemo(() => {
    const equipesComMeta = new Set(metas.map(m => m.equipe_id)).size;
    const totalValor = metas.reduce((acc, m) => acc + (m.valor_meta || 0), 0);
    const totalMetas = metas.length;
    
    return { equipesComMeta, equipesTotal: equipes.length, totalValor, totalMetas };
  }, [metas, equipes]);

  // Feriados do mês
  const feriadosDoMes = useMemo(() => {
    return Array.from(feriadosPorData.values());
  }, [feriadosPorData]);

  // Carregar dados
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Determinar período de busca
      let periodoInicio: string;
      let periodoFim: string;
      
      if (usarPeriodoCustom && dataInicio && dataFim) {
        periodoInicio = dataInicio;
        periodoFim = dataFim;
      } else {
        periodoInicio = format(startOfMonth(currentMonth), "yyyy-MM-dd");
        periodoFim = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      }

      console.log("Buscando metas de", periodoInicio, "até", periodoFim);

      const [metasRes, equipesRes, contratosRes, feriadosRes, centrosRes] = await Promise.all([
        supabase.from("metas").select("*").gte("data", periodoInicio).lte("data", periodoFim).order("data"),
        supabase.from("tecnicos").select("id, codigo, nome, centro_custo_id, tipo_equipe").neq("status", "offline").order("codigo"),
        supabase.from("contratos").select("id, codigo, nome").eq("status", "ativo").order("codigo"),
        supabase.from("feriados").select("*, centros_custo(codigo, nome)").eq("ativo", true).order("data"),
        supabase.from("centros_custo").select("id, codigo, nome").eq("ativo", true).order("codigo"),
      ]);

      console.log("Metas encontradas:", metasRes.data?.length || 0);
      console.log("Equipes encontradas:", equipesRes.data?.length || 0);

      setMetas(metasRes.data || []);
      setEquipes(equipesRes.data || []);
      setContratos(contratosRes.data || []);
      setFeriados(feriadosRes.data || []);
      setCentrosCusto(centrosRes.data || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [currentMonth, usarPeriodoCustom, dataInicio, dataFim]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Atualizar período quando mudar o mês (usa período 26-25)
  useEffect(() => {
    if (!usarPeriodoCustom) {
      const periodo = calcularPeriodoPadrao(currentMonth);
      setDataInicio(periodo.inicio);
      setDataFim(periodo.fim);
    }
  }, [currentMonth, usarPeriodoCustom]);

  // Handlers de célula
  const getCellKey = (equipeId: string, data: string) => `${equipeId}${KEY_SEP}${data}`;
  
  const parseCellKey = (key: string) => {
    const [equipeId, data] = key.split(KEY_SEP);
    return { equipeId, data };
  };

  const toggleCellSelection = (equipeId: string, data: string) => {
    const key = getCellKey(equipeId, data);
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllForEquipe = (equipeId: string) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      diasDoMes.forEach(d => {
        const dataStr = format(d, "yyyy-MM-dd");
        if (!feriadosPorData.has(dataStr) && !isWeekend(d)) {
          next.add(getCellKey(equipeId, dataStr));
        }
      });
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedCells(new Set());
  };

  // Aplicar valor em massa às células selecionadas
  const handleApplyBulkValue = async () => {
    if (selectedCells.size === 0) {
      toast.error("Selecione células primeiro");
      return;
    }
    
    const valor = parseFloat(bulkValue);
    if (isNaN(valor) || valor < 0) {
      toast.error("Digite um valor válido");
      return;
    }

    setSaving(true);
    try {
      for (const key of selectedCells) {
        const { equipeId, data } = parseCellKey(key);
        const metaExistente = metasPorEquipeData.get(key);

        if (valor === 0) {
          // Remover meta se valor for 0
          if (metaExistente) {
            await supabase.from("metas").delete().eq("id", metaExistente.id);
          }
        } else if (metaExistente) {
          // Atualizar meta existente
          await supabase.from("metas").update({ valor_meta: valor }).eq("id", metaExistente.id);
        } else {
          // Criar nova meta
          await supabase.from("metas").insert({
            equipe_id: equipeId,
            data: data,
            valor_meta: valor,
            tipo_meta: "producao",
          });
        }
      }

      toast.success(`${selectedCells.size} meta(s) ${valor === 0 ? "removida(s)" : "atualizada(s)"}`);
      setSelectedCells(new Set());
      setBulkValue("");
      setBulkValueDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Salvar edições inline
  const handleSaveEdits = async () => {
    if (Object.keys(editValues).length === 0) {
      setEditMode(false);
      return;
    }

    setSaving(true);
    try {
      for (const [key, valor] of Object.entries(editValues)) {
        const { equipeId, data } = parseCellKey(key);
        const metaExistente = metasPorEquipeData.get(key);

        if (valor === 0) {
          if (metaExistente) {
            await supabase.from("metas").delete().eq("id", metaExistente.id);
          }
        } else if (metaExistente) {
          await supabase.from("metas").update({ valor_meta: valor }).eq("id", metaExistente.id);
        } else {
          await supabase.from("metas").insert({
            equipe_id: equipeId,
            data: data,
            valor_meta: valor,
            tipo_meta: "producao",
          });
        }
      }

      toast.success("Alterações salvas");
      setEditValues({});
      setEditMode(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Criação em massa
  const handleBulkCreate = async () => {
    if (!bulkData.equipes_ids.length || !bulkData.data_inicio || !bulkData.data_fim || !bulkData.valor_meta) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const inicioData = new Date(bulkData.data_inicio + "T12:00:00");
      const fimData = new Date(bulkData.data_fim + "T12:00:00");
      let dias = eachDayOfInterval({ start: inicioData, end: fimData });

      // Filtrar dias da semana
      dias = dias.filter(dia => bulkData.dias_semana.includes(getDay(dia)));

      // Excluir feriados se marcado
      if (bulkData.excluir_feriados) {
        dias = dias.filter(dia => !feriadosPorData.has(format(dia, "yyyy-MM-dd")));
      }

      if (dias.length === 0) {
        toast.error("Nenhum dia válido no período selecionado");
        return;
      }

      let criadas = 0;
      let atualizadas = 0;

      for (const equipeId of bulkData.equipes_ids) {
        for (const dia of dias) {
          const dataStr = format(dia, "yyyy-MM-dd");
          const key = getCellKey(equipeId, dataStr);
          const metaExistente = metasPorEquipeData.get(key);

          if (metaExistente) {
            // Atualizar meta existente
            const { error } = await supabase
              .from("metas")
              .update({ 
                valor_meta: parseFloat(bulkData.valor_meta),
                tipo_meta: bulkData.tipo_meta,
                contrato_id: bulkData.contrato_id !== "nenhum" ? bulkData.contrato_id : null,
              })
              .eq("id", metaExistente.id);
            
            if (error) throw error;
            atualizadas++;
          } else {
            // Criar nova meta
            const { error } = await supabase
              .from("metas")
              .insert({
            equipe_id: equipeId,
                contrato_id: bulkData.contrato_id !== "nenhum" ? bulkData.contrato_id : null,
                data: dataStr,
                valor_meta: parseFloat(bulkData.valor_meta),
            tipo_meta: bulkData.tipo_meta,
          });
            
            if (error) throw error;
            criadas++;
          }
        }
      }

      toast.success(`${criadas} metas criadas, ${atualizadas} atualizadas`);
      setBulkDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Calcular quantidade de dias válidos para distribuição
  const calcularDiasDistribuicao = useMemo(() => {
    if (!distribuirData.data_inicio || !distribuirData.data_fim) return { dias: [], quantidade: 0 };
    
    const inicioData = new Date(distribuirData.data_inicio + "T12:00:00");
    const fimData = new Date(distribuirData.data_fim + "T12:00:00");
    let dias = eachDayOfInterval({ start: inicioData, end: fimData });

    // Filtrar dias da semana
    dias = dias.filter(dia => distribuirData.dias_semana.includes(getDay(dia)));

    // Excluir feriados se marcado
    if (distribuirData.excluir_feriados) {
      dias = dias.filter(dia => !feriadosPorData.has(format(dia, "yyyy-MM-dd")));
    }

    return { dias, quantidade: dias.length };
  }, [distribuirData.data_inicio, distribuirData.data_fim, distribuirData.dias_semana, distribuirData.excluir_feriados, feriadosPorData]);

  // Feriados impactados no período de distribuição
  const feriadosImpactadosDistribuir = useMemo(() => {
    if (!distribuirData.data_inicio || !distribuirData.data_fim || !distribuirData.excluir_feriados) return [];
    
    const inicioData = new Date(distribuirData.data_inicio + "T12:00:00");
    const fimData = new Date(distribuirData.data_fim + "T12:00:00");
    const diasPeriodo = eachDayOfInterval({ start: inicioData, end: fimData });
    
    // Filtrar apenas dias da semana selecionados
    const diasValidos = diasPeriodo.filter(dia => distribuirData.dias_semana.includes(getDay(dia)));
    
    // Encontrar feriados nesses dias
    return diasValidos
      .map(dia => {
        const dataStr = format(dia, "yyyy-MM-dd");
        const feriado = feriadosPorData.get(dataStr);
        return feriado ? { data: dataStr, feriado } : null;
      })
      .filter((f): f is { data: string; feriado: Feriado } => f !== null);
  }, [distribuirData.data_inicio, distribuirData.data_fim, distribuirData.dias_semana, distribuirData.excluir_feriados, feriadosPorData]);

  // Feriados impactados no período de bulk
  const feriadosImpactadosBulk = useMemo(() => {
    if (!bulkData.data_inicio || !bulkData.data_fim || !bulkData.excluir_feriados) return [];
    
    const inicioData = new Date(bulkData.data_inicio + "T12:00:00");
    const fimData = new Date(bulkData.data_fim + "T12:00:00");
    const diasPeriodo = eachDayOfInterval({ start: inicioData, end: fimData });
    
    // Filtrar apenas dias da semana selecionados
    const diasValidos = diasPeriodo.filter(dia => bulkData.dias_semana.includes(getDay(dia)));
    
    // Encontrar feriados nesses dias
    return diasValidos
      .map(dia => {
        const dataStr = format(dia, "yyyy-MM-dd");
        const feriado = feriadosPorData.get(dataStr);
        return feriado ? { data: dataStr, feriado } : null;
      })
      .filter((f): f is { data: string; feriado: Feriado } => f !== null);
  }, [bulkData.data_inicio, bulkData.data_fim, bulkData.dias_semana, bulkData.excluir_feriados, feriadosPorData]);

  // Valor calculado por dia
  const valorPorDia = useMemo(() => {
    const valorTotal = parseFloat(distribuirData.valor_total) || 0;
    const qtdDias = calcularDiasDistribuicao.quantidade;
    if (qtdDias === 0 || valorTotal === 0) return 0;
    return valorTotal / qtdDias;
  }, [distribuirData.valor_total, calcularDiasDistribuicao.quantidade]);

  // Distribuir meta total pelos dias
  const handleDistribuirMeta = async () => {
    if (!distribuirData.equipes_ids.length || !distribuirData.data_inicio || !distribuirData.data_fim || !distribuirData.valor_total) {
      toast.error("Preencha os campos obrigatórios");
        return;
      }

    const { dias, quantidade } = calcularDiasDistribuicao;
    
    if (quantidade === 0) {
      toast.error("Nenhum dia válido no período selecionado");
      return;
    }

    const valorTotal = parseFloat(distribuirData.valor_total);
    const valorDia = valorTotal / quantidade;

    setSaving(true);
    try {
      let criadas = 0;
      let atualizadas = 0;

      for (const equipeId of distribuirData.equipes_ids) {
        for (const dia of dias) {
          const dataStr = format(dia, "yyyy-MM-dd");
          const key = getCellKey(equipeId, dataStr);
          const metaExistente = metasPorEquipeData.get(key);

          if (metaExistente) {
            const { error } = await supabase
              .from("metas")
              .update({ 
                valor_meta: valorDia,
                tipo_meta: distribuirData.tipo_meta,
                contrato_id: distribuirData.contrato_id !== "nenhum" ? distribuirData.contrato_id : null,
              })
              .eq("id", metaExistente.id);
            
            if (error) throw error;
            atualizadas++;
          } else {
            const { error } = await supabase
              .from("metas")
              .insert({
                equipe_id: equipeId,
                contrato_id: distribuirData.contrato_id !== "nenhum" ? distribuirData.contrato_id : null,
                data: dataStr,
                valor_meta: valorDia,
                tipo_meta: distribuirData.tipo_meta,
      });

      if (error) throw error;
            criadas++;
          }
        }
      }

      toast.success(`Meta total R$ ${valorTotal.toLocaleString("pt-BR")} distribuída em ${quantidade} dias (R$ ${valorDia.toFixed(2)}/dia) - ${criadas} criadas, ${atualizadas} atualizadas`);
      setDistribuirDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Copiar metas
  const handleCopyMetas = async () => {
    if (!copyData.equipeOrigem || !copyData.equipesDestino.length) {
      toast.error("Selecione origem e destino");
      return;
    }

    setSaving(true);
    try {
      const metasOrigem = metas.filter(m => m.equipe_id === copyData.equipeOrigem);
      let count = 0;

      for (const destino of copyData.equipesDestino) {
        for (const meta of metasOrigem) {
          const key = getCellKey(destino, meta.data);
          const existe = metasPorEquipeData.get(key);

          if (existe) {
            if (copyData.sobrescrever) {
              await supabase.from("metas").update({ valor_meta: meta.valor_meta }).eq("id", existe.id);
              count++;
            }
          } else {
            await supabase.from("metas").insert({
              equipe_id: destino,
              data: meta.data,
              valor_meta: meta.valor_meta,
              tipo_meta: meta.tipo_meta,
            });
            count++;
          }
        }
      }

      toast.success(`${count} metas copiadas`);
      setCopyDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Feriados
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
        await supabase.from("feriados").update(payload).eq("id", editingFeriado.id);
        toast.success("Feriado atualizado");
      } else {
        await supabase.from("feriados").insert(payload);
        toast.success("Feriado cadastrado");
      }

      setFeriadoDialogOpen(false);
      setEditingFeriado(null);
      setFeriadoForm({ centro_custo_id: "nacional", data: "", nome: "", tipo: "nacional", recorrente: false });
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFeriado = async (id: string) => {
    try {
      await supabase.from("feriados").delete().eq("id", id);
      toast.success("Feriado excluído");
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  // Helpers
  const toggleEquipeSelection = (equipeId: string) => {
    setBulkData(prev => ({
      ...prev,
      equipes_ids: prev.equipes_ids.includes(equipeId)
        ? prev.equipes_ids.filter(id => id !== equipeId)
        : [...prev.equipes_ids, equipeId],
    }));
  };

  const toggleDiaSemana = (dia: number) => {
    setBulkData(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia].sort(),
    }));
  };

  const formatValorCompacto = (valor: number) => {
    if (valor >= 1000) {
      const valorK = valor / 1000;
      // Se for número inteiro em k, não mostrar decimais
      if (valorK === Math.floor(valorK)) {
        return `${valorK.toFixed(0)}k`;
      }
      // Caso contrário, mostrar 2 casas decimais
      return `${valorK.toFixed(2).replace('.', ',')}k`;
    }
    // Valores menores que 1000, mostrar inteiro ou com decimais se tiver
    if (valor === Math.floor(valor)) {
      return valor.toString();
    }
    return valor.toFixed(2).replace('.', ',');
  };

  // Equipes com metas no mês (para copiar)
  const equipesComMeta = useMemo(() => {
    const ids = new Set(metas.map(m => m.equipe_id));
    return equipes.filter(e => ids.has(e.id));
  }, [equipes, metas]);

  return (
    <MainLayout
      title="Metas"
      subtitle="Gerencie as metas de produção das equipes"
      breadcrumbs={[
        { label: "Cadastros", href: "/cadastros" },
        { label: "Metas" },
      ]}
    >
      <div className="space-y-4">
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="h-8">
            <TabsTrigger value="metas" className="text-xs">Metas</TabsTrigger>
            <TabsTrigger value="feriados" className="text-xs">
              Feriados {feriados.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{feriados.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Tab Metas */}
          <TabsContent value="metas" className="space-y-3 mt-3">
            {/* Header compacto */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Metas</h2>
                
                {/* Navegação por mês */}
                {!usarPeriodoCustom && (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                    <span className="text-sm font-medium min-w-[110px] text-center">
                      {format(currentMonth, "MMMM/yyyy", { locale: ptBR })}
                    </span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCurrentMonth(new Date())}>
                      Hoje
                </Button>
              </div>
                )}
                
                {/* Toggle período customizado */}
                <div className="flex items-center gap-1 ml-2">
                  <label className="flex items-center gap-1 cursor-pointer text-xs">
                    <Checkbox
                      checked={usarPeriodoCustom}
                      onCheckedChange={v => setUsarPeriodoCustom(!!v)}
                      className="h-3 w-3"
                    />
                    Período
                  </label>
                </div>
                
                {/* Filtros de data customizados */}
                {usarPeriodoCustom && (
              <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={e => setDataInicio(e.target.value)}
                      className="h-9 w-40 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">até</span>
                    <Input
                      type="date"
                      value={dataFim}
                      onChange={e => setDataFim(e.target.value)}
                      className="h-9 w-40 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7" onClick={fetchData} disabled={loading}>
                  <RefreshCcw className={cn("h-3 w-3", loading && "animate-spin")} />
                </Button>
                {editMode ? (
                  <>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => { setEditMode(false); setEditValues({}); }}>
                      <X className="h-3 w-3 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" className="h-7" onClick={handleSaveEdits} disabled={saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Salvar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => setEditMode(true)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => setCopyDialogOpen(true)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                    <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700" onClick={() => {
                  setBulkData({
                        ...bulkData,
                        data_inicio: dataInicio,
                        data_fim: dataFim,
                    equipes_ids: [],
                      });
                      setEquipeBuscaBulk("");
                  setBulkDialogOpen(true);
                }}>
                      <Zap className="h-3 w-3 mr-1" /> Em Massa
                </Button>
                    <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700" onClick={() => {
                      setDistribuirData({
                        ...distribuirData,
                        data_inicio: dataInicio,
                        data_fim: dataFim,
                        equipes_ids: [],
                        valor_total: "",
                      });
                      setEquipeBuscaDistribuir("");
                      setDistribuirDialogOpen(true);
                    }}>
                      <Target className="h-3 w-3 mr-1" /> Distribuir
                </Button>
                  </>
                )}
              </div>
            </div>

            {/* Resumo + Filtros */}
            <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-4">
                <span>👥 {resumo.equipesComMeta}/{resumo.equipesTotal} equipes</span>
                <span className="text-green-600 font-medium">💰 R$ {resumo.totalValor.toLocaleString("pt-BR")}</span>
                <span>📊 {resumo.totalMetas} metas</span>
                {feriadosDoMes.length > 0 && (
                  <span className="text-amber-600">
                    <CalendarOff className="h-3 w-3 inline mr-1" />
                    {feriadosDoMes.length} feriado(s)
                  </span>
                )}
                </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar equipe..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-7 w-36 pl-7 text-xs"
                  />
                </div>
                
                {/* Filtro Centro de Custo */}
                <Select value={filtroCentroCusto} onValueChange={setFiltroCentroCusto}>
                  <SelectTrigger className="h-7 w-40 text-xs">
                    <SelectValue placeholder="Centro de Custo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos C.Custos</SelectItem>
                    {centrosCusto.map(cc => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.codigo} - {cc.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Filtro Tipo de Equipe */}
                <Select value={filtroTipoEquipe} onValueChange={setFiltroTipoEquipe}>
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue placeholder="Tipo Equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Tipos</SelectItem>
                    {Object.entries(tipoEquipeLabels).map(([value, { label }]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={showOnlyWithMeta}
                    onCheckedChange={v => setShowOnlyWithMeta(!!v)}
                    className="h-3 w-3"
                  />
                  <span className="text-xs">Só c/ meta</span>
                </label>
                
                {/* Indicador de filtros ativos */}
                {(filtroCentroCusto !== "todos" || filtroTipoEquipe !== "todos" || searchTerm) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => {
                      setFiltroCentroCusto("todos");
                      setFiltroTipoEquipe("todos");
                      setSearchTerm("");
                    }}
                  >
                    <X className="h-3 w-3 mr-1" /> Limpar filtros
                  </Button>
                )}
              </div>
            </div>

            {/* Seleção em massa */}
            {selectedCells.size > 0 && (
              <div className="flex items-center gap-3 p-2 bg-primary/5 rounded border border-primary/20 text-xs">
                <span className="font-medium">{selectedCells.size} célula(s) selecionada(s)</span>
                <Button size="sm" variant="outline" className="h-6" onClick={() => setBulkValueDialogOpen(true)}>
                  <Check className="h-3 w-3 mr-1" /> Aplicar Valor
                </Button>
                <Button size="sm" variant="ghost" className="h-6" onClick={clearSelection}>
                  <X className="h-3 w-3" /> Limpar
                </Button>
                  </div>
            )}

            {/* Tabela Calendário */}
                  {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
            ) : equipesFiltradas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-3" />
                <p>Nenhuma equipe encontrada</p>
                            </div>
                          ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-w-full" style={{ maxHeight: "calc(100vh - 350px)" }}>
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="sticky left-0 z-20 bg-muted border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[160px] text-xs font-bold">
                          Equipe
                        </TableHead>
                        <TableHead className="sticky left-[160px] z-20 bg-muted border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center text-xs w-16 font-bold">
                          Total
                        </TableHead>
                        {diasDoMes.map(dia => {
                          const dataStr = format(dia, "yyyy-MM-dd");
                          const feriado = feriadosPorData.get(dataStr);
                          const dayOfWeek = getDay(dia);
                          const isSaturday = dayOfWeek === 6;
                          const isSunday = dayOfWeek === 0;
                          return (
                            <TableHead
                              key={dataStr}
                              className={cn(
                                "text-center text-[10px] p-0.5 w-10",
                                isSaturday && "bg-gray-100",
                                isSunday && "bg-red-100",
                                feriado && "bg-amber-100"
                              )}
                              title={feriado ? getFeriadoNome(feriado) : undefined}
                            >
                              <div className={cn(
                                "font-normal",
                                isSunday ? "text-red-500" : "text-muted-foreground"
                              )}>
                                {format(dia, "EEE", { locale: ptBR }).charAt(0).toUpperCase()}
                              </div>
                              <div className={cn(
                                "font-bold",
                                feriado && "text-amber-700",
                                isSunday && !feriado && "text-red-600"
                              )}>
                                {format(dia, "dd")}
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {equipesFiltradas.map(equipe => {
                          const totalEquipe = metas
                            .filter(m => m.equipe_id === equipe.id)
                            .reduce((acc, m) => acc + (m.valor_meta || 0), 0);

                          return (
                            <TableRow key={equipe.id} className="hover:bg-muted/30">
                              <TableCell className="sticky left-0 z-10 bg-background border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[160px] p-1">
                                <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                                    className="h-5 px-1 text-[10px]"
                                    onClick={() => selectAllForEquipe(equipe.id)}
                                    title="Selecionar todos os dias úteis"
                            >
                                    ✓
                            </Button>
                                  <div className="truncate max-w-32">
                                    <span className="font-bold text-xs">{equipe.codigo}</span>
                                    {equipe.tipo_equipe && equipe.tipo_equipe !== "normal" && (
                                      <Badge 
                                        className={cn(
                                          "ml-1 text-[8px] px-1 py-0 h-4",
                                          tipoEquipeLabels[equipe.tipo_equipe]?.color || "bg-gray-500"
                                        )}
                                      >
                                        {tipoEquipeLabels[equipe.tipo_equipe]?.label || equipe.tipo_equipe}
                                      </Badge>
                                    )}
                                    <span className="text-[10px] text-muted-foreground ml-1 hidden xl:inline">
                                      {equipe.nome.slice(0, 12)}
                                    </span>
                                  </div>
                          </div>
                        </TableCell>
                              <TableCell className="sticky left-[160px] z-10 bg-background border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center text-[10px] font-bold text-green-600 p-1 w-16">
                                {totalEquipe > 0 ? formatValorCompacto(totalEquipe) : "-"}
                              </TableCell>
                              {diasDoMes.map(dia => {
                                const dataStr = format(dia, "yyyy-MM-dd");
                                const key = getCellKey(equipe.id, dataStr);
                                const meta = metasPorEquipeData.get(key);
                                const feriado = feriadosPorData.get(dataStr);
                                const dayOfWeek = getDay(dia);
                                const isSaturday = dayOfWeek === 6;
                                const isSunday = dayOfWeek === 0;
                                const isWknd = isSaturday || isSunday;
                                const isSelected = selectedCells.has(key);
                                const editVal = editValues[key];
                                const valor = editVal !== undefined ? editVal : (meta?.valor_meta || 0);

                                return (
                                  <TableCell
                                    key={dataStr}
                                    className={cn(
                                      "text-center p-0 w-10 h-8 cursor-pointer transition-all border-l",
                                      isSaturday && "bg-gray-50",
                                      isSunday && "bg-red-50",
                                      feriado && "bg-amber-50",
                                      isSelected && "ring-2 ring-primary ring-inset",
                                      valor > 0 && !feriado && !isWknd && "bg-green-50",
                                      editMode && "hover:bg-blue-50"
                                    )}
                                    onClick={() => !editMode && toggleCellSelection(equipe.id, dataStr)}
                                    title={feriado ? getFeriadoNome(feriado) : undefined}
                                  >
                                    {editMode ? (
                                      <input
                                        type="number"
                                        value={valor || ""}
                                        onChange={e => setEditValues(prev => ({
                                          ...prev,
                                          [key]: parseFloat(e.target.value) || 0
                                        }))}
                                        className="w-full h-full text-center text-[10px] bg-transparent border-0 p-0 focus:outline-none focus:ring-1 focus:ring-primary"
                                        onClick={e => e.stopPropagation()}
                                      />
                                    ) : (
                                      <span className={cn(
                                        "text-[10px]",
                                        valor > 0 ? "text-green-700 font-medium" : "text-gray-300",
                                        feriado && "text-amber-600",
                                        isSunday && !feriado && valor === 0 && "text-red-300"
                                      )}>
                                        {valor > 0 ? formatValorCompacto(valor) : "-"}
                                      </span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                </TableBody>
              </Table>
                  </div>
                </div>
              )}

            {/* Legenda */}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-50 border rounded" /> Com meta
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-amber-50 border rounded" /> Feriado
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-50 border rounded" /> Sábado
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-50 border border-red-200 rounded" /> Domingo
              </span>
              <span className="ml-auto">Clique para selecionar • Clique em ✓ para selecionar dias úteis da equipe</span>
            </div>
          </TabsContent>

          {/* Tab Feriados */}
          <TabsContent value="feriados" className="space-y-4 mt-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Feriados Cadastrados</h3>
                <p className="text-xs text-muted-foreground">Gerencie os feriados que afetam as metas</p>
              </div>
              <Button size="sm" onClick={() => {
                setEditingFeriado(null);
                setFeriadoForm({ centro_custo_id: "nacional", data: "", nome: "", tipo: "nacional", recorrente: false });
                setFeriadoDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-1" /> Novo Feriado
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feriados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <CalendarOff className="h-8 w-8 mx-auto mb-2" />
                        Nenhum feriado cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    feriados.map(f => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(parseISO(f.data), "dd/MM/yyyy")}
                            {f.recorrente && <Badge variant="outline" className="text-[10px] ml-1">Anual</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{getFeriadoNome(f)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{f.tipo}</Badge>
                        </TableCell>
                        <TableCell>
                          {f.nacional ? (
                            <Badge className="bg-blue-500">Nacional</Badge>
                          ) : f.centros_custo ? (
                            <Badge variant="outline">{f.centros_custo.nome}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Todos</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingFeriado(f);
                            setFeriadoForm({
                              centro_custo_id: f.centro_custo_id || (f.nacional ? "nacional" : "todos"),
                              data: f.data,
                              nome: f.nome,
                              tipo: f.tipo,
                              recorrente: f.recorrente,
                            });
                            setFeriadoDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteFeriado(f.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog Aplicar Valor em Massa */}
        <Dialog open={bulkValueDialogOpen} onOpenChange={setBulkValueDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Aplicar Valor</DialogTitle>
              <DialogDescription>
                Aplicar valor às {selectedCells.size} célula(s) selecionada(s).
                Use 0 para remover as metas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={bulkValue}
                  onChange={e => setBulkValue(e.target.value)}
                  placeholder="Ex: 5000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkValueDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleApplyBulkValue} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Aplicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Criação em Massa */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" /> Criação de Metas em Massa
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="equipes" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="equipes">1. Equipes</TabsTrigger>
                <TabsTrigger value="periodo">2. Período</TabsTrigger>
                <TabsTrigger value="valores">3. Valores</TabsTrigger>
              </TabsList>

              <TabsContent value="equipes" className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Equipes ({bulkData.equipes_ids.length})</Label>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setBulkData(p => ({ ...p, equipes_ids: equipes.map(e => e.id) }))}>
                      Todas
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setBulkData(p => ({ ...p, equipes_ids: [] }))}>
                      Limpar
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={equipeBuscaBulk}
                    onChange={e => setEquipeBuscaBulk(e.target.value)}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
                <ScrollArea className="h-48 border rounded">
                  <div className="p-1 space-y-0.5">
                    {equipes
                      .filter(e => !equipeBuscaBulk || e.codigo.toLowerCase().includes(equipeBuscaBulk.toLowerCase()) || e.nome.toLowerCase().includes(equipeBuscaBulk.toLowerCase()))
                      .map(eq => (
                        <div
                          key={eq.id}
                          className={cn("flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted text-sm", bulkData.equipes_ids.includes(eq.id) && "bg-primary/10")}
                          onClick={() => toggleEquipeSelection(eq.id)}
                        >
                          <Checkbox checked={bulkData.equipes_ids.includes(eq.id)} className="h-4 w-4" />
                          <span className="font-medium">{eq.codigo}</span>
                          <span className="text-muted-foreground truncate">{eq.nome}</span>
                      </div>
                      ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="periodo" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Data Início</Label>
                    <Input type="date" value={bulkData.data_inicio} onChange={e => setBulkData({ ...bulkData, data_inicio: e.target.value })} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Data Fim</Label>
                    <Input type="date" value={bulkData.data_fim} onChange={e => setBulkData({ ...bulkData, data_fim: e.target.value })} className="h-8" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm">Dias da Semana</Label>
                  <div className="flex flex-wrap gap-1">
                    {diasSemana.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDiaSemana(d.value)}
                        className={cn(
                          "px-2 py-1 rounded border text-xs",
                          bulkData.dias_semana.includes(d.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                </div>
              </div>

                <div className="flex items-center justify-between p-3 bg-amber-50 rounded border border-amber-200">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="h-4 w-4 text-amber-600" />
                    <span className="text-sm">Excluir feriados</span>
                  </div>
                  <Switch
                    checked={bulkData.excluir_feriados}
                    onCheckedChange={v => setBulkData({ ...bulkData, excluir_feriados: v })}
                  />
                </div>

                {/* Feriados que serão excluídos */}
                {bulkData.excluir_feriados && feriadosImpactadosBulk.length > 0 && (
                  <div className="p-3 bg-red-50 rounded border border-red-200">
                    <p className="text-sm font-medium text-red-800 mb-2">
                      🚫 {feriadosImpactadosBulk.length} dia(s) serão excluídos por feriado:
                    </p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {feriadosImpactadosBulk.map(({ data, feriado }) => (
                        <div key={data} className="flex items-center gap-2 text-xs text-red-700">
                          <CalendarOff className="h-3 w-3" />
                          <span className="font-medium">{format(parseISO(data), "dd/MM (EEE)", { locale: ptBR })}</span>
                          <span>- {getFeriadoNome(feriado)}</span>
                          {feriado.nacional && <Badge className="bg-blue-500 text-[9px] px-1">Nacional</Badge>}
                        </div>
                      ))}
                </div>
              </div>
                )}
              </TabsContent>

              <TabsContent value="valores" className="space-y-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-sm">Valor da Meta (R$)</Label>
                <Input
                  type="number"
                    value={bulkData.valor_meta}
                    onChange={e => setBulkData({ ...bulkData, valor_meta: e.target.value })}
                    placeholder="Ex: 5000"
                    className="h-8"
                />
              </div>

                <div className="space-y-1">
                  <Label className="text-sm">Tipo de Meta</Label>
                  <Select value={bulkData.tipo_meta} onValueChange={v => setBulkData({ ...bulkData, tipo_meta: v })}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      {tipoMetaOptions.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

                <div className="bg-muted/50 p-3 rounded text-sm">
                  <p className="font-medium mb-1">Resumo:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-xs">
                    <li>{bulkData.equipes_ids.length} equipe(s)</li>
                    <li>{bulkData.dias_semana.length} dia(s) por semana</li>
                    <li>Período: {bulkData.data_inicio || "..."} a {bulkData.data_fim || "..."}</li>
                    <li>Meta: R$ {bulkData.valor_meta || "0"} /dia</li>
                  </ul>
            </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleBulkCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Criar Metas
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Distribuir Meta Total */}
        <Dialog open={distribuirDialogOpen} onOpenChange={setDistribuirDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" /> Distribuir Meta Total
              </DialogTitle>
              <DialogDescription>
                Informe o valor total do período e o sistema dividirá automaticamente pelos dias
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Valor Total */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <Label className="text-sm font-medium text-green-800">Valor Total do Período (R$)</Label>
                  <Input
                  type="number"
                  value={distribuirData.valor_total}
                  onChange={e => setDistribuirData({ ...distribuirData, valor_total: e.target.value })}
                  placeholder="Ex: 50000"
                  className="h-12 text-xl font-bold mt-2"
                  />
                </div>

              {/* Período */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Data Início</Label>
                    <Input
                      type="date"
                    value={distribuirData.data_inicio}
                    onChange={e => setDistribuirData({ ...distribuirData, data_inicio: e.target.value })}
                    className="h-9"
                    />
                  </div>
                <div className="space-y-1">
                  <Label className="text-sm">Data Fim</Label>
                    <Input
                      type="date"
                    value={distribuirData.data_fim}
                    onChange={e => setDistribuirData({ ...distribuirData, data_fim: e.target.value })}
                    className="h-9"
                    />
                  </div>
                </div>

              {/* Dias da semana */}
              <div className="space-y-1">
                <Label className="text-sm">Dias da Semana</Label>
                <div className="flex flex-wrap gap-1">
                  {diasSemana.map(d => (
                      <button
                      key={d.value}
                        type="button"
                      onClick={() => setDistribuirData(prev => ({
                        ...prev,
                        dias_semana: prev.dias_semana.includes(d.value)
                          ? prev.dias_semana.filter(x => x !== d.value)
                          : [...prev.dias_semana, d.value].sort()
                      }))}
                      className={cn(
                        "px-2 py-1 rounded border text-xs",
                        distribuirData.dias_semana.includes(d.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary/50"
                      )}
                      >
                      {d.label}
                      </button>
                    ))}
                  </div>
                </div>

              {/* Excluir feriados */}
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded border border-amber-200">
                <div className="flex items-center gap-2">
                  <CalendarOff className="h-4 w-4 text-amber-600" />
                  <span className="text-sm">Excluir feriados</span>
                  </div>
                  <Switch
                  checked={distribuirData.excluir_feriados}
                  onCheckedChange={v => setDistribuirData({ ...distribuirData, excluir_feriados: v })}
                  />
                </div>

              {/* Feriados que serão excluídos */}
              {distribuirData.excluir_feriados && feriadosImpactadosDistribuir.length > 0 && (
                <div className="p-3 bg-red-50 rounded border border-red-200">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    🚫 {feriadosImpactadosDistribuir.length} dia(s) serão excluídos por feriado:
                  </p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {feriadosImpactadosDistribuir.map(({ data, feriado }) => (
                      <div key={data} className="flex items-center gap-2 text-xs text-red-700">
                        <CalendarOff className="h-3 w-3" />
                        <span className="font-medium">{format(parseISO(data), "dd/MM (EEE)", { locale: ptBR })}</span>
                        <span>- {getFeriadoNome(feriado)}</span>
                        {feriado.nacional && <Badge className="bg-blue-500 text-[9px] px-1">Nacional</Badge>}
                          </div>
                        ))}
                      </div>
                </div>
                )}

              {/* Equipes */}
                <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Equipes ({distribuirData.equipes_ids.length})</Label>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setDistribuirData(p => ({ ...p, equipes_ids: equipes.map(e => e.id) }))}>
                      Todas
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setDistribuirData(p => ({ ...p, equipes_ids: [] }))}>
                      Limpar
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={equipeBuscaDistribuir}
                    onChange={e => setEquipeBuscaDistribuir(e.target.value)}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
                <ScrollArea className="h-32 border rounded">
                  <div className="p-1 space-y-0.5">
                    {equipes
                      .filter(e => !equipeBuscaDistribuir || e.codigo.toLowerCase().includes(equipeBuscaDistribuir.toLowerCase()) || e.nome.toLowerCase().includes(equipeBuscaDistribuir.toLowerCase()))
                      .map(eq => (
                        <div
                          key={eq.id}
                          className={cn("flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted text-sm", distribuirData.equipes_ids.includes(eq.id) && "bg-primary/10")}
                          onClick={() => setDistribuirData(prev => ({
                            ...prev,
                            equipes_ids: prev.equipes_ids.includes(eq.id)
                              ? prev.equipes_ids.filter(id => id !== eq.id)
                              : [...prev.equipes_ids, eq.id]
                          }))}
                        >
                          <Checkbox checked={distribuirData.equipes_ids.includes(eq.id)} className="h-4 w-4" />
                          <span className="font-medium">{eq.codigo}</span>
                          <span className="text-muted-foreground truncate">{eq.nome}</span>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Preview do cálculo */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-blue-800 mb-2">📊 Cálculo Automático</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-blue-700">
                    <span className="text-muted-foreground">Dias com meta:</span>
                    <span className="font-bold ml-2">{calcularDiasDistribuicao.quantidade}</span>
                  </div>
                  <div className="text-blue-700">
                    <span className="text-muted-foreground">Equipes:</span>
                    <span className="font-bold ml-2">{distribuirData.equipes_ids.length}</span>
                  </div>
                  <div className="text-blue-700">
                    <span className="text-muted-foreground">Valor total:</span>
                    <span className="font-bold ml-2">R$ {parseFloat(distribuirData.valor_total || "0").toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="text-green-700">
                    <span className="text-muted-foreground">Valor/dia:</span>
                    <span className="font-bold ml-2">R$ {valorPorDia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDistribuirDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleDistribuirMeta} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Distribuir Metas
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Copiar Metas */}
        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copiar Metas</DialogTitle>
              <DialogDescription>
                Copie as metas de uma equipe para outras equipes
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm">Equipe de Origem</Label>
                <Select value={copyData.equipeOrigem} onValueChange={v => setCopyData({ ...copyData, equipeOrigem: v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                    {equipesComMeta.map(e => {
                      const total = metas.filter(m => m.equipe_id === e.id).length;
                      return (
                        <SelectItem key={e.id} value={e.id}>
                          {e.codigo} - {e.nome} ({total} dias)
                        </SelectItem>
                      );
                    })}
                    </SelectContent>
                  </Select>
                </div>

              <div className="space-y-1">
                <Label className="text-sm">Equipes de Destino</Label>
                <ScrollArea className="h-40 border rounded">
                  <div className="p-1 space-y-0.5">
                    {equipes.filter(e => e.id !== copyData.equipeOrigem).map(eq => (
                      <div
                        key={eq.id}
                        className={cn("flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted text-sm", copyData.equipesDestino.includes(eq.id) && "bg-primary/10")}
                        onClick={() => setCopyData(prev => ({
                          ...prev,
                          equipesDestino: prev.equipesDestino.includes(eq.id)
                            ? prev.equipesDestino.filter(id => id !== eq.id)
                            : [...prev.equipesDestino, eq.id]
                        }))}
                      >
                        <Checkbox checked={copyData.equipesDestino.includes(eq.id)} className="h-4 w-4" />
                        <span className="font-medium">{eq.codigo}</span>
                        <span className="text-muted-foreground truncate">{eq.nome}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={copyData.sobrescrever}
                  onCheckedChange={v => setCopyData({ ...copyData, sobrescrever: !!v })}
                />
                <Label className="text-sm">Sobrescrever metas existentes</Label>
                </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCopyMetas} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Copiar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Feriado */}
        <Dialog open={feriadoDialogOpen} onOpenChange={setFeriadoDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingFeriado ? "Editar Feriado" : "Novo Feriado"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Data</Label>
                  <Input
                    type="date"
                    value={feriadoForm.data}
                    onChange={e => setFeriadoForm({ ...feriadoForm, data: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Tipo</Label>
                  <Select
                    value={feriadoForm.tipo}
                    onValueChange={v => setFeriadoForm({ ...feriadoForm, tipo: v, centro_custo_id: v === "nacional" ? "nacional" : feriadoForm.centro_custo_id })}
                  >
                    <SelectTrigger className="h-8">
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

              <div className="space-y-1">
                <Label className="text-sm">Nome</Label>
                <Input
                  value={feriadoForm.nome}
                  onChange={e => setFeriadoForm({ ...feriadoForm, nome: e.target.value })}
                  placeholder="Ex: Natal"
                  className="h-8"
                />
              </div>

              {feriadoForm.tipo !== "nacional" && (
                <div className="space-y-1">
                  <Label className="text-sm">Centro de Custo</Label>
                  <Select
                    value={feriadoForm.centro_custo_id}
                    onValueChange={v => setFeriadoForm({ ...feriadoForm, centro_custo_id: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Centros</SelectItem>
                      {centrosCusto.map(cc => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.codigo ? `${cc.codigo} - ` : ""}{cc.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  checked={feriadoForm.recorrente}
                  onCheckedChange={v => setFeriadoForm({ ...feriadoForm, recorrente: v })}
                />
                <Label className="text-sm">Recorrente (repete todo ano)</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFeriadoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveFeriado} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
