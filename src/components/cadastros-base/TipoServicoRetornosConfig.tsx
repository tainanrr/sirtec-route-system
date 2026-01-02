import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  Settings,
  Check,
  CheckCircle,
  XCircle,
  Camera,
  Edit3,
  ListChecks,
  FileText,
  Layers,
  GripVertical,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  ativo: boolean;
}

interface RetornoCampo {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  categoria: string | null;
  gera_producao: boolean;
  finaliza_os: boolean;
  cor: string | null;
  ativo: boolean;
}

interface TipoServicoRetorno {
  id: string;
  skill_id: string;
  retorno_campo_id: string;
  ordem: number;
  ativo: boolean;
  padrao: boolean;
  retorno?: RetornoCampo;
}

interface RetornoAtividade {
  id: string;
  tipo_servico_retorno_id: string;
  atividade_id: string;
  situacao: "obrigatorio" | "opcional_selecionado" | "opcional_nao_selecionado";
  quantidade_padrao: number;
  permite_alterar_qtd: boolean;
  qtd_min_fotos: number;
  ordem: number;
  atividade?: Atividade;
}

interface Props {
  tipoServicoId: string;
  tipoServicoCodigo: string;
  tipoServicoNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Configuração dos grupos
const GRUPOS_RETORNO = {
  executado: {
    label: "Executado",
    icon: CheckCircle2,
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
  impedimento: {
    label: "Impedimento",
    icon: AlertTriangle,
    color: "bg-red-500",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
  },
  parcial: {
    label: "Parcial",
    icon: Clock,
    color: "bg-yellow-500",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
    borderColor: "border-yellow-200",
  },
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function TipoServicoRetornosConfig({
  tipoServicoId,
  tipoServicoCodigo,
  tipoServicoNome,
  open,
  onOpenChange,
}: Props) {
  // Estados de dados
  const [retornosVinculados, setRetornosVinculados] = useState<TipoServicoRetorno[]>([]);
  const [todosRetornos, setTodosRetornos] = useState<RetornoCampo[]>([]);
  const [todasAtividades, setTodasAtividades] = useState<Atividade[]>([]);
  const [atividadesPorRetorno, setAtividadesPorRetorno] = useState<Record<string, RetornoAtividade[]>>({});

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addRetornoOpen, setAddRetornoOpen] = useState(false);
  const [editAtividadeOpen, setEditAtividadeOpen] = useState(false);
  const [selectedRetornoId, setSelectedRetornoId] = useState<string | null>(null);
  const [selectedAtividade, setSelectedAtividade] = useState<RetornoAtividade | null>(null);
  const [searchRetorno, setSearchRetorno] = useState("");
  const [searchAtividade, setSearchAtividade] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["executado", "impedimento", "parcial"]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // ============================================
  // CARREGAR DADOS
  // ============================================

  const carregarDados = useCallback(async () => {
    if (!tipoServicoId) return;
    
    setLoading(true);
    try {
      // Carregar todos os retornos e atividades disponíveis
      const [retornosRes, atividadesRes] = await Promise.all([
        supabase.from("retornos_campo").select("*").eq("ativo", true).order("descricao"),
        supabase.from("atividades").select("*").eq("ativo", true).order("descricao"),
      ]);

      if (retornosRes.error) throw retornosRes.error;
      if (atividadesRes.error) throw atividadesRes.error;

      setTodosRetornos(retornosRes.data || []);
      setTodasAtividades(atividadesRes.data || []);

      // Carregar retornos vinculados a este tipo de serviço
      const { data: vinculados, error: vinculadosError } = await supabase
        .from("tipo_servico_retornos")
        .select(`
          *,
          retorno:retornos_campo(*)
        `)
        .eq("skill_id", tipoServicoId)
        .order("ordem");

      if (vinculadosError) throw vinculadosError;
      setRetornosVinculados(vinculados || []);

      // Carregar atividades de cada retorno vinculado
      const atividadesMap: Record<string, RetornoAtividade[]> = {};
      
      for (const retorno of vinculados || []) {
        const { data: atividades, error: atividadesError } = await supabase
          .from("tipo_servico_retorno_atividades")
          .select(`
            *,
            atividade:atividades(*)
          `)
          .eq("tipo_servico_retorno_id", retorno.id)
          .order("ordem");

        if (!atividadesError && atividades) {
          atividadesMap[retorno.id] = atividades;
        }
      }

      setAtividadesPorRetorno(atividadesMap);

    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }, [tipoServicoId]);

  useEffect(() => {
    if (open) {
      carregarDados();
    }
  }, [open, carregarDados]);

  // ============================================
  // AGRUPAR E ORDENAR RETORNOS
  // ============================================

  const retornosAgrupados = useMemo(() => {
    const grupos: Record<string, TipoServicoRetorno[]> = {
      executado: [],
      impedimento: [],
      parcial: [],
    };

    // Agrupar por tipo
    retornosVinculados.forEach(retorno => {
      const tipo = retorno.retorno?.tipo || "executado";
      if (grupos[tipo]) {
        grupos[tipo].push(retorno);
      } else {
        grupos.executado.push(retorno); // fallback
      }
    });

    // Ordenar cada grupo por descrição (alfabético)
    Object.keys(grupos).forEach(key => {
      grupos[key].sort((a, b) => {
        const descA = a.retorno?.descricao || "";
        const descB = b.retorno?.descricao || "";
        return descA.localeCompare(descB, 'pt-BR');
      });
    });

    return grupos;
  }, [retornosVinculados]);

  // ============================================
  // HANDLERS - RETORNOS
  // ============================================

  const handleAdicionarRetorno = async (retornoId: string) => {
    setSaving(true);
    try {
      const ordem = retornosVinculados.length;
      
      const { data, error } = await supabase
        .from("tipo_servico_retornos")
        .insert({
          skill_id: tipoServicoId,
          retorno_campo_id: retornoId,
          ordem,
          ativo: true,
          padrao: retornosVinculados.length === 0,
        })
        .select(`*, retorno:retornos_campo(*)`)
        .single();

      if (error) throw error;

      setRetornosVinculados([...retornosVinculados, data]);
      setAtividadesPorRetorno({ ...atividadesPorRetorno, [data.id]: [] });
      setAddRetornoOpen(false);
      toast.success("Retorno adicionado com sucesso");

    } catch (error: any) {
      console.error("Erro ao adicionar retorno:", error);
      toast.error(error.message || "Erro ao adicionar retorno");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverRetorno = async (retornoVinculadoId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tipo_servico_retornos")
        .delete()
        .eq("id", retornoVinculadoId);

      if (error) throw error;

      setRetornosVinculados(retornosVinculados.filter(r => r.id !== retornoVinculadoId));
      const newAtividades = { ...atividadesPorRetorno };
      delete newAtividades[retornoVinculadoId];
      setAtividadesPorRetorno(newAtividades);
      
      toast.success("Retorno removido");

    } catch (error: any) {
      console.error("Erro ao remover retorno:", error);
      toast.error("Erro ao remover retorno");
    } finally {
      setSaving(false);
    }
  };

  const handleSetRetornoPadrao = async (retornoVinculadoId: string) => {
    setSaving(true);
    try {
      await supabase
        .from("tipo_servico_retornos")
        .update({ padrao: false })
        .eq("skill_id", tipoServicoId);

      const { error } = await supabase
        .from("tipo_servico_retornos")
        .update({ padrao: true })
        .eq("id", retornoVinculadoId);

      if (error) throw error;

      setRetornosVinculados(retornosVinculados.map(r => ({
        ...r,
        padrao: r.id === retornoVinculadoId
      })));
      
      toast.success("Retorno padrão definido");

    } catch (error: any) {
      console.error("Erro ao definir padrão:", error);
      toast.error("Erro ao definir retorno padrão");
    } finally {
      setSaving(false);
    }
  };

  const handleAlterarCorRetorno = async (retornoCampoId: string, novaCor: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("retornos_campo")
        .update({ cor: novaCor })
        .eq("id", retornoCampoId);

      if (error) throw error;

      // Atualizar estado local
      setRetornosVinculados(retornosVinculados.map(r => ({
        ...r,
        retorno: r.retorno_campo_id === retornoCampoId 
          ? { ...r.retorno!, cor: novaCor }
          : r.retorno
      })));

      setTodosRetornos(todosRetornos.map(r => 
        r.id === retornoCampoId ? { ...r, cor: novaCor } : r
      ));
      
      toast.success("Cor atualizada");

    } catch (error: any) {
      console.error("Erro ao alterar cor:", error);
      toast.error("Erro ao alterar cor");
    } finally {
      setSaving(false);
    }
  };

  // Handler para mover item para cima ou para baixo
  const handleMoverRetorno = async (retornoId: string, direcao: 'up' | 'down') => {
    const grupoAtual = Object.entries(retornosAgrupados).find(([_, retornos]) => 
      retornos.some(r => r.id === retornoId)
    );
    
    if (!grupoAtual) return;

    const [tipoGrupo, retornosDoGrupo] = grupoAtual;
    const index = retornosDoGrupo.findIndex(r => r.id === retornoId);
    
    if (direcao === 'up' && index === 0) return;
    if (direcao === 'down' && index === retornosDoGrupo.length - 1) return;

    const newIndex = direcao === 'up' ? index - 1 : index + 1;
    const newRetornos = [...retornosDoGrupo];
    [newRetornos[index], newRetornos[newIndex]] = [newRetornos[newIndex], newRetornos[index]];

    // Atualizar ordem no banco
    setSaving(true);
    try {
      for (let i = 0; i < newRetornos.length; i++) {
        await supabase
          .from("tipo_servico_retornos")
          .update({ ordem: i })
          .eq("id", newRetornos[i].id);
      }

      // Atualizar estado local
      const updatedVinculados = retornosVinculados.map(r => {
        const novoIndex = newRetornos.findIndex(nr => nr.id === r.id);
        if (novoIndex !== -1) {
          return { ...r, ordem: novoIndex };
        }
        return r;
      });

      setRetornosVinculados(updatedVinculados);
    } catch (error: any) {
      console.error("Erro ao reordenar:", error);
      toast.error("Erro ao reordenar");
    } finally {
      setSaving(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, retornoId: string) => {
    setDraggedItem(retornoId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string, tipoGrupo: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) {
      setDraggedItem(null);
      return;
    }

    const retornosDoGrupo = retornosAgrupados[tipoGrupo];
    const draggedIndex = retornosDoGrupo.findIndex(r => r.id === draggedItem);
    const targetIndex = retornosDoGrupo.findIndex(r => r.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    const newRetornos = [...retornosDoGrupo];
    const [removed] = newRetornos.splice(draggedIndex, 1);
    newRetornos.splice(targetIndex, 0, removed);

    // Atualizar ordem no banco
    setSaving(true);
    try {
      for (let i = 0; i < newRetornos.length; i++) {
        await supabase
          .from("tipo_servico_retornos")
          .update({ ordem: i })
          .eq("id", newRetornos[i].id);
      }

      // Atualizar estado local
      const updatedVinculados = retornosVinculados.map(r => {
        const novoIndex = newRetornos.findIndex(nr => nr.id === r.id);
        if (novoIndex !== -1) {
          return { ...r, ordem: novoIndex };
        }
        return r;
      });

      setRetornosVinculados(updatedVinculados);
      toast.success("Ordem atualizada");
    } catch (error: any) {
      console.error("Erro ao reordenar:", error);
      toast.error("Erro ao reordenar");
    } finally {
      setSaving(false);
      setDraggedItem(null);
    }
  };

  // ============================================
  // HANDLERS - ATIVIDADES
  // ============================================

  const handleAdicionarAtividade = async (retornoVinculadoId: string, atividadeId: string) => {
    setSaving(true);
    try {
      const atividadesAtuais = atividadesPorRetorno[retornoVinculadoId] || [];
      const ordem = atividadesAtuais.length;
      
      const { data, error } = await supabase
        .from("tipo_servico_retorno_atividades")
        .insert({
          tipo_servico_retorno_id: retornoVinculadoId,
          atividade_id: atividadeId,
          situacao: "opcional_nao_selecionado",
          quantidade_padrao: 1,
          permite_alterar_qtd: true,
          qtd_min_fotos: 0,
          ordem,
        })
        .select(`*, atividade:atividades(*)`)
        .single();

      if (error) throw error;

      setAtividadesPorRetorno({
        ...atividadesPorRetorno,
        [retornoVinculadoId]: [...atividadesAtuais, data]
      });
      
      toast.success("Atividade adicionada");

    } catch (error: any) {
      console.error("Erro ao adicionar atividade:", error);
      toast.error(error.message || "Erro ao adicionar atividade");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverAtividade = async (retornoVinculadoId: string, atividadeVinculadaId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tipo_servico_retorno_atividades")
        .delete()
        .eq("id", atividadeVinculadaId);

      if (error) throw error;

      setAtividadesPorRetorno({
        ...atividadesPorRetorno,
        [retornoVinculadoId]: (atividadesPorRetorno[retornoVinculadoId] || [])
          .filter(a => a.id !== atividadeVinculadaId)
      });
      
      toast.success("Atividade removida");

    } catch (error: any) {
      console.error("Erro ao remover atividade:", error);
      toast.error("Erro ao remover atividade");
    } finally {
      setSaving(false);
    }
  };

  const handleEditarAtividade = (retornoId: string, atividade: RetornoAtividade) => {
    setSelectedRetornoId(retornoId);
    setSelectedAtividade(atividade);
    setEditAtividadeOpen(true);
  };

  const handleSalvarAtividade = async () => {
    if (!selectedAtividade || !selectedRetornoId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tipo_servico_retorno_atividades")
        .update({
          situacao: selectedAtividade.situacao,
          quantidade_padrao: selectedAtividade.quantidade_padrao,
          permite_alterar_qtd: selectedAtividade.permite_alterar_qtd,
          qtd_min_fotos: selectedAtividade.qtd_min_fotos,
        })
        .eq("id", selectedAtividade.id);

      if (error) throw error;

      setAtividadesPorRetorno({
        ...atividadesPorRetorno,
        [selectedRetornoId]: (atividadesPorRetorno[selectedRetornoId] || []).map(a =>
          a.id === selectedAtividade.id ? selectedAtividade : a
        )
      });

      setEditAtividadeOpen(false);
      toast.success("Atividade atualizada");

    } catch (error: any) {
      console.error("Erro ao atualizar atividade:", error);
      toast.error("Erro ao atualizar atividade");
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const retornosNaoVinculados = useMemo(() => {
    // Agrupar por tipo
    const agrupados: Record<string, RetornoCampo[]> = {
      executado: [],
      impedimento: [],
      parcial: [],
    };

    console.log("[RetornosConfig] todosRetornos:", todosRetornos.length);
    console.log("[RetornosConfig] retornosVinculados:", retornosVinculados.length);

    todosRetornos
      .filter(r => !retornosVinculados.some(v => v.retorno_campo_id === r.id))
      .forEach(r => {
        const tipo = r.tipo || "executado";
        if (agrupados[tipo]) {
          agrupados[tipo].push(r);
        } else {
          agrupados.executado.push(r);
        }
      });

    console.log("[RetornosConfig] retornosNaoVinculados:", {
      executado: agrupados.executado.length,
      impedimento: agrupados.impedimento.length,
      parcial: agrupados.parcial.length,
    });

    return agrupados;
  }, [todosRetornos, retornosVinculados]);

  const getAtividadesNaoVinculadas = (retornoVinculadoId: string) => {
    const vinculadas = atividadesPorRetorno[retornoVinculadoId] || [];
    return todasAtividades.filter(
      a => !vinculadas.some(v => v.atividade_id === a.id)
    );
  };

  const getSituacaoBadge = (situacao: string) => {
    switch (situacao) {
      case "obrigatorio":
        return <Badge className="bg-red-500">Obrigatório</Badge>;
      case "opcional_selecionado":
        return <Badge className="bg-blue-500">Opcional (selecionado)</Badge>;
      case "opcional_nao_selecionado":
        return <Badge variant="secondary">Opcional (não selecionado)</Badge>;
      default:
        return <Badge variant="outline">{situacao}</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    const config = GRUPOS_RETORNO[tipo as keyof typeof GRUPOS_RETORNO];
    if (!config) return <Badge variant="outline">{tipo}</Badge>;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const toggleGroup = (grupo: string) => {
    setExpandedGroups(prev => 
      prev.includes(grupo) 
        ? prev.filter(g => g !== grupo)
        : [...prev, grupo]
    );
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Retornos de Campo
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold">{tipoServicoCodigo}</span> - {tipoServicoNome}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cabeçalho com botão de adicionar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    {retornosVinculados.length} Retornos configurados
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    (Arraste para reordenar)
                  </span>
                </div>
                
                <Popover open={addRetornoOpen} onOpenChange={(open) => {
                    console.log("[RetornosConfig] Popover onOpenChange:", open);
                    setAddRetornoOpen(open);
                  }}>
                  <PopoverTrigger asChild>
                    <Button size="sm" onClick={() => console.log("[RetornosConfig] Botão Adicionar clicado")}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Retorno
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0 z-[9999]" align="end">
                    <Command>
                      <CommandInput 
                        placeholder="Buscar retorno de campo..." 
                        value={searchRetorno}
                        onValueChange={setSearchRetorno}
                      />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        <CommandEmpty>Nenhum retorno encontrado.</CommandEmpty>
                        
                        {/* Grupos de retornos */}
                        {Object.entries(GRUPOS_RETORNO).map(([tipo, config]) => {
                          const retornosDoTipo = retornosNaoVinculados[tipo] || [];
                          const retornosFiltrados = retornosDoTipo.filter(r =>
                            r.codigo.toLowerCase().includes(searchRetorno.toLowerCase()) ||
                            r.descricao.toLowerCase().includes(searchRetorno.toLowerCase())
                          );

                          if (retornosFiltrados.length === 0) return null;

                          const IconComponent = config.icon;

                          return (
                            <CommandGroup 
                              key={tipo}
                              heading={
                                <div className="flex items-center gap-2">
                                  <IconComponent className={cn("h-4 w-4", config.textColor)} />
                                  <span className={config.textColor}>{config.label}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {retornosFiltrados.length}
                                  </Badge>
                                </div>
                              }
                            >
                              {retornosFiltrados.slice(0, 10).map(retorno => (
                                <CommandItem
                                  key={retorno.id}
                                  value={`${retorno.codigo}-${retorno.descricao}`}
                                  onSelect={() => handleAdicionarRetorno(retorno.id)}
                                  className="cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <span 
                                      className="w-3 h-3 rounded-full shrink-0" 
                                      style={{ backgroundColor: retorno.cor || "#6b7280" }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-semibold text-xs">{retorno.codigo}</span>
                                      </div>
                                      <span className="text-sm text-muted-foreground truncate block">
                                        {retorno.descricao}
                                      </span>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Lista de retornos agrupados */}
              {retornosVinculados.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/30">
                  <ListChecks className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">Nenhum retorno configurado</h3>
                  <p className="text-muted-foreground mt-1">
                    Adicione retornos de campo para este tipo de serviço
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(GRUPOS_RETORNO).map(([tipo, config]) => {
                    const retornosDoGrupo = retornosAgrupados[tipo] || [];
                    if (retornosDoGrupo.length === 0) return null;

                    const IconComponent = config.icon;
                    const isExpanded = expandedGroups.includes(tipo);

                    return (
                      <div 
                        key={tipo}
                        className={cn(
                          "border rounded-lg overflow-hidden",
                          config.borderColor
                        )}
                      >
                        {/* Cabeçalho do grupo */}
                        <button
                          onClick={() => toggleGroup(tipo)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center justify-between",
                            config.bgColor,
                            "hover:opacity-90 transition-opacity"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <IconComponent className={cn("h-5 w-5", config.textColor)} />
                            <span className={cn("font-semibold", config.textColor)}>
                              {config.label}
                            </span>
                            <Badge variant="secondary">
                              {retornosDoGrupo.length}
                            </Badge>
                          </div>
                          <ChevronDown 
                            className={cn(
                              "h-5 w-5 transition-transform",
                              config.textColor,
                              isExpanded && "transform rotate-180"
                            )} 
                          />
                        </button>

                        {/* Conteúdo do grupo */}
                        {isExpanded && (
                          <Accordion type="multiple" className="border-t">
                            {retornosDoGrupo.map((retornoVinculado, index) => {
                              const retorno = retornoVinculado.retorno;
                              const atividades = atividadesPorRetorno[retornoVinculado.id] || [];
                              const atividadesDisponiveis = getAtividadesNaoVinculadas(retornoVinculado.id);

                              return (
                                <AccordionItem
                                  key={retornoVinculado.id}
                                  value={retornoVinculado.id}
                                  className={cn(
                                    "border-b last:border-b-0",
                                    draggedItem === retornoVinculado.id && "opacity-50"
                                  )}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, retornoVinculado.id)}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, retornoVinculado.id, tipo)}
                                >
                                  <div className="flex items-center px-4 py-3 hover:bg-muted/50">
                                    <AccordionTrigger className="flex-1 hover:no-underline p-0">
                                      <div className="flex items-center gap-3 flex-1 text-left">
                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                                        <span 
                                          className="w-4 h-4 rounded-full shrink-0" 
                                          style={{ backgroundColor: retorno?.cor || "#6b7280" }}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono font-semibold">{retorno?.codigo}</span>
                                            {retornoVinculado.padrao && (
                                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                Padrão
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-sm text-muted-foreground truncate">
                                            {retorno?.descricao}
                                          </p>
                                        </div>
                                        <Badge variant="secondary" className="shrink-0">
                                          {atividades.length} atividades
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <div className="flex items-center gap-1 ml-2 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoverRetorno(retornoVinculado.id, 'up');
                                        }}
                                        disabled={index === 0 || saving}
                                      >
                                        <ChevronUp className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoverRetorno(retornoVinculado.id, 'down');
                                        }}
                                        disabled={index === retornosDoGrupo.length - 1 || saving}
                                      >
                                        <ChevronDown className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>

                                  <AccordionContent className="px-4 pb-4">
                                    <div className="space-y-4">
                                      {/* Ações do retorno */}
                                      <div className="flex items-center gap-3 pt-2 flex-wrap">
                                        {/* Seletor de cor */}
                                        <div className="flex items-center gap-2">
                                          <Label className="text-xs text-muted-foreground">Cor:</Label>
                                          <input
                                            type="color"
                                            value={retorno?.cor || "#6b7280"}
                                            onChange={(e) => handleAlterarCorRetorno(retornoVinculado.retorno_campo_id, e.target.value)}
                                            className="w-8 h-8 rounded cursor-pointer border border-input"
                                            title="Alterar cor do retorno"
                                          />
                                        </div>
                                        
                                        <Separator orientation="vertical" className="h-6" />
                                        
                                        {!retornoVinculado.padrao && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSetRetornoPadrao(retornoVinculado.id)}
                                            disabled={saving}
                                          >
                                            <Check className="h-3 w-3 mr-1" />
                                            Definir como Padrão
                                          </Button>
                                        )}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-destructive hover:text-destructive"
                                          onClick={() => handleRemoverRetorno(retornoVinculado.id)}
                                          disabled={saving}
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" />
                                          Remover Retorno
                                        </Button>
                                      </div>

                                      <Separator />

                                      {/* Tabela de atividades */}
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <h4 className="font-medium flex items-center gap-2">
                                            <Layers className="h-4 w-4" />
                                            Atividades / Tabela de Preço
                                          </h4>
                                          
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button variant="outline" size="sm">
                                                <Plus className="h-3 w-3 mr-1" />
                                                Adicionar Atividade
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[450px] p-0 z-[9999]" align="end">
                                              <Command>
                                                <CommandInput 
                                                  placeholder="Buscar atividade..." 
                                                  value={searchAtividade}
                                                  onValueChange={setSearchAtividade}
                                                />
                                                <CommandList className="max-h-[300px] overflow-y-auto">
                                                  <CommandEmpty>Nenhuma atividade encontrada.</CommandEmpty>
                                                  <CommandGroup heading="Atividades disponíveis">
                                                    {atividadesDisponiveis
                                                      .filter(a => 
                                                        a.codigo.toLowerCase().includes(searchAtividade.toLowerCase()) ||
                                                        a.descricao.toLowerCase().includes(searchAtividade.toLowerCase())
                                                      )
                                                      .slice(0, 10)
                                                      .map(atividade => (
                                                        <CommandItem
                                                          key={atividade.id}
                                                          value={`${atividade.codigo}-${atividade.descricao}`}
                                                          onSelect={() => handleAdicionarAtividade(retornoVinculado.id, atividade.id)}
                                                          className="cursor-pointer"
                                                        >
                                                          <div className="flex flex-col gap-0.5">
                                                            <span className="font-mono text-sm">{atividade.codigo}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                              {atividade.descricao}
                                                            </span>
                                                          </div>
                                                        </CommandItem>
                                                      ))
                                                    }
                                                  </CommandGroup>
                                                </CommandList>
                                              </Command>
                                            </PopoverContent>
                                          </Popover>
                                        </div>

                                        {atividades.length === 0 ? (
                                          <div className="text-center py-6 border rounded bg-muted/20">
                                            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                              Nenhuma atividade vinculada
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="border rounded overflow-hidden">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="w-[200px]">Código</TableHead>
                                                  <TableHead>Descrição</TableHead>
                                                  <TableHead className="w-[150px]">Situação</TableHead>
                                                  <TableHead className="w-[80px] text-center">Qtd</TableHead>
                                                  <TableHead className="w-[80px] text-center">Alterar</TableHead>
                                                  <TableHead className="w-[80px] text-center">Fotos</TableHead>
                                                  <TableHead className="w-[80px] text-right">Ações</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {atividades.map((atv) => (
                                                  <TableRow key={atv.id}>
                                                    <TableCell className="font-mono text-xs">
                                                      {atv.atividade?.codigo}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                      {atv.atividade?.descricao}
                                                    </TableCell>
                                                    <TableCell>
                                                      {getSituacaoBadge(atv.situacao)}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono">
                                                      {atv.quantidade_padrao}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                      {atv.permite_alterar_qtd ? (
                                                        <CheckCircle className="h-4 w-4 mx-auto text-green-500" />
                                                      ) : (
                                                        <XCircle className="h-4 w-4 mx-auto text-red-500" />
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                      <div className="flex items-center justify-center gap-1">
                                                        <Camera className="h-3 w-3 text-muted-foreground" />
                                                        <span className="font-mono text-xs">{atv.qtd_min_fotos}</span>
                                                      </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                      <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="h-7 w-7"
                                                          onClick={() => handleEditarAtividade(retornoVinculado.id, atv)}
                                                        >
                                                          <Edit3 className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                                          onClick={() => handleRemoverAtividade(retornoVinculado.id, atv.id)}
                                                        >
                                                          <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Dialog de Edição de Atividade */}
      <Dialog open={editAtividadeOpen} onOpenChange={setEditAtividadeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Atividade</DialogTitle>
            <DialogDescription>
              {selectedAtividade?.atividade?.codigo} - {selectedAtividade?.atividade?.descricao}
            </DialogDescription>
          </DialogHeader>

          {selectedAtividade && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select
                  value={selectedAtividade.situacao}
                  onValueChange={(v: any) => setSelectedAtividade({ ...selectedAtividade, situacao: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="obrigatorio">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Obrigatório
                      </div>
                    </SelectItem>
                    <SelectItem value="opcional_selecionado">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Opcional (selecionado)
                      </div>
                    </SelectItem>
                    <SelectItem value="opcional_nao_selecionado">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        Opcional (não selecionado)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade Padrão</Label>
                  <Input
                    type="number"
                    min={0}
                    max={999}
                    value={selectedAtividade.quantidade_padrao}
                    onChange={(e) => setSelectedAtividade({
                      ...selectedAtividade,
                      quantidade_padrao: parseInt(e.target.value) || 0
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Qtd. Mín. Fotos</Label>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={selectedAtividade.qtd_min_fotos}
                    onChange={(e) => setSelectedAtividade({
                      ...selectedAtividade,
                      qtd_min_fotos: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Permite alterar quantidade no PDA</Label>
                  <p className="text-xs text-muted-foreground">
                    Se ativado, a equipe pode alterar a quantidade no app
                  </p>
                </div>
                <Switch
                  checked={selectedAtividade.permite_alterar_qtd}
                  onCheckedChange={(v) => setSelectedAtividade({
                    ...selectedAtividade,
                    permite_alterar_qtd: v
                  })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAtividadeOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarAtividade} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
