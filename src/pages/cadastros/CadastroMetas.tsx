import { useState, useEffect, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
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
  ChevronDown,
  ChevronUp,
  Zap,
  Search,
  CalendarOff,
  Copy,
  Check,
  X,
  Users,
  DollarSign,
  Save,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Separador para chaves compostas
const KEY_SEP = "|||";

interface Meta {
  id: string;
  equipe_id: string;
  contrato_id: string | null;
  data: string;
  valor_meta: number | null;
  tipo_meta: string;
  created_at: string;
  tecnicos?: { codigo: string; nome: string; color?: string } | null;
  contratos?: { codigo: string; nome: string } | null;
}

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  color?: string;
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
  descricao?: string;
  tipo: string;
  nacional: boolean;
  recorrente: boolean;
  ativo: boolean;
}

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
}

interface CicloEquipe {
  equipeId: string;
  equipe: Equipe;
  dataInicio: string | null;
  dataFim: string | null;
  dias: { data: string; valor: number; metaId?: string; isFeriado?: boolean; feriadoNome?: string }[];
  totalValor: number;
  diasComMeta: number;
  temMeta: boolean;
}

const diasSemanaLabels = ["D", "S", "T", "Q", "Q", "S", "S"];

const tipoMetaOptions = [
  { value: "producao", label: "Produção" },
  { value: "faturamento", label: "Faturamento" },
];

export default function CadastroMetas() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Período
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Visualização
  const [expandedEquipes, setExpandedEquipes] = useState<Set<string>>(new Set());
  const [selectedDias, setSelectedDias] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, number>>({});

  // Filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyWithMeta, setShowOnlyWithMeta] = useState(false);

  // Dialogs
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [feriadoDialogOpen, setFeriadoDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingFeriado, setEditingFeriado] = useState<Feriado | null>(null);

  // Bulk
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
  const [equipeBuscaBulk, setEquipeBuscaBulk] = useState("");

  // Copiar
  const [copyData, setCopyData] = useState({
    equipeOrigem: "",
    equipesDestino: [] as string[],
    sobrescrever: false,
  });

  // Feriado
  const [feriadoForm, setFeriadoForm] = useState({
    data: "",
    nome: "",
    tipo: "nacional",
    centro_custo_id: "nacional",
    recorrente: true,
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const inicioMes = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const [metasRes, equipesRes, contratosRes, feriadosRes, centrosCustoRes] = await Promise.all([
        supabase
          .from("metas")
          .select(`*, tecnicos:equipe_id(id, codigo, nome, color), contratos:contrato_id(codigo, nome)`)
          .gte("data", inicioMes)
          .lte("data", fimMes)
          .order("data"),
        supabase
          .from("tecnicos")
          .select("id, codigo, nome, color")
          .or("status.eq.ativo,status.eq.em_rota,status.eq.online")
          .order("codigo"),
        supabase
          .from("contratos")
          .select("id, codigo, nome")
          .eq("status", "ativo")
          .order("codigo"),
        supabase
          .from("feriados")
          .select("*")
          .eq("ativo", true)
          .order("data"),
        supabase
          .from("centros_custo")
          .select("id, codigo, nome")
          .eq("ativo", true)
          .order("nome"),
      ]);

      setMetas(metasRes.data || []);
      setEquipes(equipesRes.data || []);
      setContratos(contratosRes.data || []);
      setFeriados(feriadosRes.data || []);
      setCentrosCusto(centrosCustoRes.data || []);
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dias do mês
  const diasDoMes = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
  }, [currentMonth]);

  // Mapa de feriados
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

  // Ciclos por equipe
  const ciclosPorEquipe = useMemo(() => {
    let eqs = equipes.filter(e =>
      searchTerm === "" ||
      e.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const ciclos: CicloEquipe[] = eqs.map(equipe => {
      const metasEquipe = metas.filter(m => m.equipe_id === equipe.id);
      const temMeta = metasEquipe.length > 0;

      let dataInicio: string | null = null;
      let dataFim: string | null = null;
      if (temMeta) {
        const datas = metasEquipe.map(m => m.data).sort();
        dataInicio = datas[0];
        dataFim = datas[datas.length - 1];
      }

      const dias = diasDoMes.map(d => {
        const dataStr = format(d, "yyyy-MM-dd");
        const meta = metasEquipe.find(m => m.data === dataStr);
        const feriado = feriadosPorData.get(dataStr);
        return {
          data: dataStr,
          valor: meta?.valor_meta || 0,
          metaId: meta?.id,
          isFeriado: !!feriado,
          feriadoNome: feriado?.nome || feriado?.descricao,
        };
      });

      return {
        equipeId: equipe.id,
        equipe,
        dataInicio,
        dataFim,
        dias,
        totalValor: dias.reduce((acc, d) => acc + d.valor, 0),
        diasComMeta: dias.filter(d => d.valor > 0).length,
        temMeta,
      };
    });

    if (showOnlyWithMeta) {
      return ciclos.filter(c => c.temMeta);
    }

    return ciclos.sort((a, b) => {
      if (a.temMeta && !b.temMeta) return -1;
      if (!a.temMeta && b.temMeta) return 1;
      return a.equipe.codigo.localeCompare(b.equipe.codigo);
    });
  }, [metas, equipes, diasDoMes, feriadosPorData, searchTerm, showOnlyWithMeta]);

  // Resumo
  const resumo = useMemo(() => ({
    total: ciclosPorEquipe.reduce((acc, c) => acc + c.totalValor, 0),
    comMeta: ciclosPorEquipe.filter(c => c.temMeta).length,
    semMeta: ciclosPorEquipe.filter(c => !c.temMeta).length,
  }), [ciclosPorEquipe]);

  // Feriados do mês
  const feriadosDoMes = useMemo(() => {
    return diasDoMes.map(d => feriadosPorData.get(format(d, "yyyy-MM-dd"))).filter((f): f is Feriado => !!f);
  }, [diasDoMes, feriadosPorData]);

  // Handlers
  const parseKey = (key: string) => {
    const [equipeId, data] = key.split(KEY_SEP);
    return { equipeId, data };
  };

  const toggleExpanded = (id: string) => {
    setExpandedEquipes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDia = (equipeId: string, data: string) => {
    const key = `${equipeId}${KEY_SEP}${data}`;
    setSelectedDias(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAllDias = (equipeId: string) => {
    const ciclo = ciclosPorEquipe.find(c => c.equipeId === equipeId);
    if (!ciclo) return;
    setSelectedDias(prev => {
      const next = new Set(prev);
      ciclo.dias.forEach(d => {
        if (!d.isFeriado) next.add(`${equipeId}${KEY_SEP}${d.data}`);
      });
      return next;
    });
  };

  const handleApplyValue = async (valor: number) => {
    if (selectedDias.size === 0) return toast.error("Selecione dias");
    setSaving(true);
    try {
      for (const key of selectedDias) {
        const { equipeId, data } = parseKey(key);
        const { data: existe } = await supabase
          .from("metas")
          .select("id")
          .eq("equipe_id", equipeId)
          .eq("data", data)
          .maybeSingle();

        if (existe) {
          await supabase.from("metas").update({ valor_meta: valor }).eq("id", existe.id);
        } else {
          await supabase.from("metas").insert({ equipe_id: equipeId, data, valor_meta: valor, tipo_meta: "producao" });
        }
      }
      toast.success(`${selectedDias.size} metas atualizadas`);
      setSelectedDias(new Set());
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!Object.keys(editValues).length) {
      setEditMode(false);
      return;
    }
    setSaving(true);
    try {
      for (const [key, valor] of Object.entries(editValues)) {
        const { equipeId, data } = parseKey(key);
        const { data: existe } = await supabase
          .from("metas")
          .select("id")
          .eq("equipe_id", equipeId)
          .eq("data", data)
          .maybeSingle();

        if (existe) {
          if (valor === 0) {
            await supabase.from("metas").delete().eq("id", existe.id);
          } else {
            await supabase.from("metas").update({ valor_meta: valor }).eq("id", existe.id);
          }
        } else if (valor > 0) {
          await supabase.from("metas").insert({ equipe_id: equipeId, data, valor_meta: valor, tipo_meta: "producao" });
        }
      }
      toast.success("Alterações salvas");
      setEditValues({});
      setEditMode(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkCreate = async () => {
    if (!bulkData.equipes_ids.length || !bulkData.data_inicio || !bulkData.data_fim || !bulkData.valor_meta) {
      return toast.error("Preencha todos os campos");
    }
    setSaving(true);
    try {
      const inicio = new Date(bulkData.data_inicio + "T12:00:00");
      const fim = new Date(bulkData.data_fim + "T12:00:00");
      let dias = eachDayOfInterval({ start: inicio, end: fim })
        .filter(d => bulkData.dias_semana.includes(getDay(d)));
      
      if (bulkData.excluir_feriados) {
        dias = dias.filter(d => !feriadosPorData.has(format(d, "yyyy-MM-dd")));
      }

      for (const equipeId of bulkData.equipes_ids) {
        for (const dia of dias) {
          const dataStr = format(dia, "yyyy-MM-dd");
          const { data: existe } = await supabase
            .from("metas")
            .select("id")
            .eq("equipe_id", equipeId)
            .eq("data", dataStr)
            .maybeSingle();

          if (existe) {
            await supabase.from("metas").update({
              valor_meta: parseFloat(bulkData.valor_meta),
              tipo_meta: bulkData.tipo_meta,
              contrato_id: bulkData.contrato_id !== "nenhum" ? bulkData.contrato_id : null,
            }).eq("id", existe.id);
          } else {
            await supabase.from("metas").insert({
              equipe_id: equipeId,
              data: dataStr,
              valor_meta: parseFloat(bulkData.valor_meta),
              tipo_meta: bulkData.tipo_meta,
              contrato_id: bulkData.contrato_id !== "nenhum" ? bulkData.contrato_id : null,
            });
          }
        }
      }
      toast.success(`Metas criadas para ${bulkData.equipes_ids.length} equipes`);
      setBulkDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedDias.size) return;
    setSaving(true);
    try {
      let count = 0;
      for (const key of selectedDias) {
        const { equipeId, data } = parseKey(key);
        const { data: existe } = await supabase
          .from("metas")
          .select("id")
          .eq("equipe_id", equipeId)
          .eq("data", data)
          .maybeSingle();

        if (existe) {
          await supabase.from("metas").delete().eq("id", existe.id);
          count++;
        }
      }
      toast.success(`${count} metas removidas`);
      setSelectedDias(new Set());
      setDeleteConfirmOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeriado = async () => {
    if (!feriadoForm.data || !feriadoForm.nome) return toast.error("Preencha os campos");
    setSaving(true);
    try {
      const isNacional = feriadoForm.tipo === "nacional";
      const payload = {
        data: feriadoForm.data,
        nome: feriadoForm.nome,
        tipo: feriadoForm.tipo,
        nacional: isNacional,
        recorrente: feriadoForm.recorrente,
        centro_custo_id: isNacional ? null : (feriadoForm.centro_custo_id === "nacional" ? null : feriadoForm.centro_custo_id),
        ativo: true,
      };

      if (editingFeriado) {
        await supabase.from("feriados").update(payload).eq("id", editingFeriado.id);
      } else {
        await supabase.from("feriados").insert(payload);
      }
      toast.success("Feriado salvo");
      setFeriadoDialogOpen(false);
      setEditingFeriado(null);
      setFeriadoForm({ data: "", nome: "", tipo: "nacional", centro_custo_id: "nacional", recorrente: true });
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-4 space-y-3">
        {/* Header compacto */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Metas</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[100px] text-center">
              {format(currentMonth, "MMM/yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Hoje</Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCcw className={cn("h-3 w-3", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Resumo compacto + ações */}
        <div className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {resumo.comMeta} c/ meta
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3" /> {resumo.semMeta} s/ meta
            </span>
            <span className="flex items-center gap-1 text-green-600">
              <DollarSign className="h-3 w-3" /> R$ {resumo.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            {feriadosDoMes.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <CalendarOff className="h-3 w-3" /> {feriadosDoMes.length} feriado(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-7 w-40 pl-7 text-xs"
              />
            </div>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox checked={showOnlyWithMeta} onCheckedChange={v => setShowOnlyWithMeta(!!v)} className="h-3 w-3" />
              Só c/ meta
            </label>
            {editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={() => { setEditValues({}); setEditMode(false); }}>
                  <X className="h-3 w-3 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveEdits} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Salvar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCopyDialogOpen(true)}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
                <Button size="sm" onClick={() => {
                  setBulkData({
                    ...bulkData,
                    data_inicio: format(startOfMonth(currentMonth), "yyyy-MM-dd"),
                    data_fim: format(endOfMonth(currentMonth), "yyyy-MM-dd"),
                  });
                  setBulkDialogOpen(true);
                }}>
                  <Zap className="h-3 w-3 mr-1" /> Em Massa
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Seleção em massa */}
        {selectedDias.size > 0 && (
          <div className="flex items-center gap-3 p-2 bg-primary/5 rounded border border-primary/20 text-xs">
            <span className="font-medium">{selectedDias.size} selecionado(s)</span>
            <Input
              type="number"
              placeholder="R$"
              className="w-20 h-6 text-xs"
              id="valor-massa"
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  if (!isNaN(v)) handleApplyValue(v);
                }
              }}
            />
            <Button size="sm" variant="outline" onClick={() => {
              const v = parseFloat((document.getElementById("valor-massa") as HTMLInputElement)?.value || "0");
              if (!isNaN(v)) handleApplyValue(v);
            }} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Aplicar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-3 w-3 mr-1" /> Zerar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedDias(new Set())}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="metas">
          <TabsList className="h-7">
            <TabsTrigger value="metas" className="text-xs h-6">Metas</TabsTrigger>
            <TabsTrigger value="feriados" className="text-xs h-6">Feriados ({feriados.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="metas" className="mt-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : ciclosPorEquipe.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2" />
                <p>Nenhuma equipe encontrada</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Botões expandir/recolher */}
                <div className="flex gap-1 mb-2">
                  <Button size="sm" variant="ghost" onClick={() => setExpandedEquipes(new Set(equipes.map(e => e.id)))}>
                    <ChevronDown className="h-3 w-3 mr-1" /> Expandir
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpandedEquipes(new Set())}>
                    <ChevronUp className="h-3 w-3 mr-1" /> Recolher
                  </Button>
                </div>

                {ciclosPorEquipe.map(ciclo => (
                  <Card key={ciclo.equipeId} className={cn("overflow-hidden", !ciclo.temMeta && "border-amber-300 bg-amber-50/20")}>
                    <div
                      className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpanded(ciclo.equipeId)}
                    >
                      <div className="w-1 h-6 rounded" style={{ backgroundColor: ciclo.equipe.color || "#6366f1" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-bold">{ciclo.equipe.codigo}</span>
                          <span className="text-muted-foreground truncate text-xs">{ciclo.equipe.nome}</span>
                          {!ciclo.temMeta && (
                            <Badge variant="outline" className="text-[10px] px-1 bg-amber-100 text-amber-800 border-amber-300">
                              <AlertTriangle className="h-2 w-2 mr-0.5" /> Sem meta
                            </Badge>
                          )}
                        </div>
                        {ciclo.temMeta && (
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{ciclo.dataInicio && format(parseISO(ciclo.dataInicio), "dd/MM")} - {ciclo.dataFim && format(parseISO(ciclo.dataFim), "dd/MM")}</span>
                            <span>{ciclo.diasComMeta} dias</span>
                            <span className="text-green-600 font-medium">R$ {ciclo.totalValor.toLocaleString("pt-BR")}</span>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={e => { e.stopPropagation(); selectAllDias(ciclo.equipeId); }}>
                        Todos
                      </Button>
                      {expandedEquipes.has(ciclo.equipeId) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>

                    {expandedEquipes.has(ciclo.equipeId) && (
                      <div className="border-t p-2 bg-muted/20">
                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                          {diasSemanaLabels.map((d, i) => (
                            <div key={i} className="text-center text-[9px] text-muted-foreground">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5">
                          {Array.from({ length: getDay(diasDoMes[0]) }).map((_, i) => (
                            <div key={`e${i}`} />
                          ))}
                          {ciclo.dias.map(dia => {
                            const key = `${ciclo.equipeId}${KEY_SEP}${dia.data}`;
                            const isSel = selectedDias.has(key);
                            const editVal = editValues[key];
                            const val = editVal !== undefined ? editVal : dia.valor;
                            const diaNum = parseInt(dia.data.split("-")[2]);

                            return (
                              <div
                                key={dia.data}
                                className={cn(
                                  "h-7 rounded border text-center flex flex-col items-center justify-center cursor-pointer transition-all text-[10px]",
                                  dia.isFeriado && "bg-amber-100 border-amber-300",
                                  isSel && "ring-1 ring-primary",
                                  val > 0 && !dia.isFeriado && "bg-green-50 border-green-300",
                                  val === 0 && !dia.isFeriado && "bg-gray-50 border-gray-200",
                                  editMode && "hover:bg-blue-50"
                                )}
                                onClick={() => !editMode && toggleDia(ciclo.equipeId, dia.data)}
                                title={dia.isFeriado ? dia.feriadoNome : undefined}
                              >
                                <span className={cn("text-[9px]", dia.isFeriado && "text-amber-700")}>{diaNum}</span>
                                {editMode ? (
                                  <input
                                    type="number"
                                    value={val}
                                    onChange={e => setEditValues(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                    className="w-full h-3 text-[9px] text-center bg-transparent border-0 p-0"
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (
                                  <span className={cn("font-medium text-[9px]", val > 0 ? "text-green-700" : "text-gray-400", dia.isFeriado && "text-amber-600")}>
                                    {val > 0 ? (val >= 1000 ? `${(val/1000).toFixed(0)}k` : val) : "-"}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="feriados" className="mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Feriados Cadastrados</span>
              <Button size="sm" onClick={() => {
                setEditingFeriado(null);
                setFeriadoForm({ data: "", nome: "", tipo: "nacional", centro_custo_id: "nacional", recorrente: true });
                setFeriadoDialogOpen(true);
              }}>
                <Plus className="h-3 w-3 mr-1" /> Novo
              </Button>
            </div>
            <div className="space-y-1">
              {feriados.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhum feriado</p>
              ) : (
                feriados.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-2 border rounded text-sm">
                    <div className="flex items-center gap-2">
                      <div className="text-center min-w-[40px]">
                        <div className="font-bold">{format(parseISO(f.data), "dd")}</div>
                        <div className="text-[10px] text-muted-foreground">{format(parseISO(f.data), "MMM", { locale: ptBR })}</div>
                      </div>
                      <div>
                        <p className="font-medium text-xs">{f.nome || f.descricao}</p>
                        <div className="flex gap-1">
                          <Badge variant={f.nacional ? "default" : "secondary"} className="text-[9px] px-1">{f.tipo}</Badge>
                          {f.recorrente && <Badge variant="outline" className="text-[9px] px-1">Anual</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                        setEditingFeriado(f);
                        setFeriadoForm({ data: f.data, nome: f.nome || f.descricao || "", tipo: f.tipo, centro_custo_id: f.centro_custo_id || "nacional", recorrente: f.recorrente });
                        setFeriadoDialogOpen(true);
                      }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={async () => {
                        await supabase.from("feriados").delete().eq("id", f.id);
                        toast.success("Feriado removido");
                        fetchData();
                      }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog Bulk */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Metas em Massa</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Equipes ({bulkData.equipes_ids.length})</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={equipeBuscaBulk}
                    onChange={e => setEquipeBuscaBulk(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>
                <ScrollArea className="h-28 border rounded mt-1">
                  <div className="p-1 space-y-0.5">
                    {equipes
                      .filter(e => !equipeBuscaBulk || e.codigo.toLowerCase().includes(equipeBuscaBulk.toLowerCase()) || e.nome.toLowerCase().includes(equipeBuscaBulk.toLowerCase()))
                      .map(eq => (
                        <div
                          key={eq.id}
                          className={cn("flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-muted text-xs", bulkData.equipes_ids.includes(eq.id) && "bg-primary/10")}
                          onClick={() => setBulkData(prev => ({
                            ...prev,
                            equipes_ids: prev.equipes_ids.includes(eq.id)
                              ? prev.equipes_ids.filter(id => id !== eq.id)
                              : [...prev.equipes_ids, eq.id]
                          }))}
                        >
                          <Checkbox checked={bulkData.equipes_ids.includes(eq.id)} className="h-3 w-3" />
                          <span className="font-medium">{eq.codigo}</span>
                          <span className="text-muted-foreground truncate">{eq.nome}</span>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-1 mt-1">
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setBulkData(prev => ({ ...prev, equipes_ids: equipes.map(e => e.id) }))}>
                    Todas
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setBulkData(prev => ({ ...prev, equipes_ids: [] }))}>
                    Limpar
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input type="date" value={bulkData.data_inicio} onChange={e => setBulkData({ ...bulkData, data_inicio: e.target.value })} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Fim</Label>
                  <Input type="date" value={bulkData.data_fim} onChange={e => setBulkData({ ...bulkData, data_fim: e.target.value })} className="h-7 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Dias</Label>
                <div className="flex gap-1">
                  {[{ v: 1, l: "S" }, { v: 2, l: "T" }, { v: 3, l: "Q" }, { v: 4, l: "Q" }, { v: 5, l: "S" }, { v: 6, l: "S" }, { v: 0, l: "D" }].map(d => (
                    <Badge
                      key={d.v}
                      variant={bulkData.dias_semana.includes(d.v) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => setBulkData(prev => ({
                        ...prev,
                        dias_semana: prev.dias_semana.includes(d.v)
                          ? prev.dias_semana.filter(x => x !== d.v)
                          : [...prev.dias_semana, d.v]
                      }))}
                    >
                      {d.l}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Valor R$</Label>
                  <Input type="number" value={bulkData.valor_meta} onChange={e => setBulkData({ ...bulkData, valor_meta: e.target.value })} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={bulkData.tipo_meta} onValueChange={v => setBulkData({ ...bulkData, tipo_meta: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tipoMetaOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={bulkData.excluir_feriados} onCheckedChange={v => setBulkData({ ...bulkData, excluir_feriados: !!v })} className="h-3 w-3" />
                Excluir feriados
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleBulkCreate} disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Copiar */}
        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copiar Metas</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Origem</Label>
                <Select value={copyData.equipeOrigem} onValueChange={v => setCopyData({ ...copyData, equipeOrigem: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {ciclosPorEquipe.filter(c => c.temMeta).map(c => (
                      <SelectItem key={c.equipeId} value={c.equipeId}>{c.equipe.codigo} ({c.diasComMeta} dias)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Destino</Label>
                <ScrollArea className="h-28 border rounded">
                  <div className="p-1 space-y-0.5">
                    {equipes.filter(e => e.id !== copyData.equipeOrigem).map(eq => (
                      <div
                        key={eq.id}
                        className={cn("flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-muted text-xs", copyData.equipesDestino.includes(eq.id) && "bg-primary/10")}
                        onClick={() => setCopyData(prev => ({
                          ...prev,
                          equipesDestino: prev.equipesDestino.includes(eq.id)
                            ? prev.equipesDestino.filter(id => id !== eq.id)
                            : [...prev.equipesDestino, eq.id]
                        }))}
                      >
                        <Checkbox checked={copyData.equipesDestino.includes(eq.id)} className="h-3 w-3" />
                        <span className="font-medium">{eq.codigo}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={copyData.sobrescrever} onCheckedChange={v => setCopyData({ ...copyData, sobrescrever: !!v })} className="h-3 w-3" />
                Sobrescrever existentes
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Cancelar</Button>
              <Button onClick={async () => {
                if (!copyData.equipeOrigem || !copyData.equipesDestino.length) return toast.error("Selecione origem e destino");
                setSaving(true);
                try {
                  const ciclo = ciclosPorEquipe.find(c => c.equipeId === copyData.equipeOrigem);
                  if (!ciclo) return;
                  let count = 0;
                  for (const destino of copyData.equipesDestino) {
                    for (const dia of ciclo.dias.filter(d => d.valor > 0)) {
                      const { data: existe } = await supabase.from("metas").select("id").eq("equipe_id", destino).eq("data", dia.data).maybeSingle();
                      if (existe) {
                        if (copyData.sobrescrever) {
                          await supabase.from("metas").update({ valor_meta: dia.valor }).eq("id", existe.id);
                          count++;
                        }
                      } else {
                        await supabase.from("metas").insert({ equipe_id: destino, data: dia.data, valor_meta: dia.valor, tipo_meta: "producao" });
                        count++;
                      }
                    }
                  }
                  toast.success(`${count} metas copiadas`);
                  setCopyDialogOpen(false);
                  fetchData();
                } catch (e: any) {
                  toast.error(e.message);
                } finally {
                  setSaving(false);
                }
              }} disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Copiar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Feriado */}
        <Dialog open={feriadoDialogOpen} onOpenChange={setFeriadoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFeriado ? "Editar" : "Novo"} Feriado</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={feriadoForm.data} onChange={e => setFeriadoForm({ ...feriadoForm, data: e.target.value })} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={feriadoForm.tipo} onValueChange={v => setFeriadoForm({ ...feriadoForm, tipo: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nacional">Nacional</SelectItem>
                      <SelectItem value="estadual">Estadual</SelectItem>
                      <SelectItem value="municipal">Municipal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={feriadoForm.nome} onChange={e => setFeriadoForm({ ...feriadoForm, nome: e.target.value })} className="h-7 text-xs" />
              </div>
              {feriadoForm.tipo !== "nacional" && (
                <div>
                  <Label className="text-xs">Centro de Custo</Label>
                  <Select value={feriadoForm.centro_custo_id} onValueChange={v => setFeriadoForm({ ...feriadoForm, centro_custo_id: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nacional">Todos</SelectItem>
                      {centrosCusto.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={feriadoForm.recorrente} onCheckedChange={v => setFeriadoForm({ ...feriadoForm, recorrente: !!v })} className="h-3 w-3" />
                Recorrente (anual)
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeriadoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveFeriado} disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Delete */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zerar metas?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso removerá {selectedDias.size} meta(s). Ação irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground">
                Zerar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
