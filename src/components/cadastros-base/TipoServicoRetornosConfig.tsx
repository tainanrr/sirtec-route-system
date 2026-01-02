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
  FolderCog,
  MoveRight,
  Palette,
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

interface GrupoRetorno {
  id: string;
  codigo: string;
  nome: string;
  cor: string;
  cor_fundo: string;
  cor_texto: string;
  cor_borda: string;
  icone: string;
  ordem: number;
  ativo: boolean;
}

interface Props {
  tipoServicoId: string;
  tipoServicoCodigo: string;
  tipoServicoNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mapeamento de ícones disponíveis
const ICONES_DISPONIVEIS = {
  "check-circle": CheckCircle2,
  "alert-triangle": AlertTriangle,
  "clock": Clock,
  "check": Check,
  "x-circle": XCircle,
  "layers": Layers,
  "file-text": FileText,
};

// Grupos padrão (fallback caso a tabela não exista)
const GRUPOS_PADRAO: GrupoRetorno[] = [
  {
    id: "default-executado",
    codigo: "executado",
    nome: "Executado",
    cor: "#22c55e",
    cor_fundo: "#f0fdf4",
    cor_texto: "#15803d",
    cor_borda: "#bbf7d0",
    icone: "check-circle",
    ordem: 0,
    ativo: true,
  },
  {
    id: "default-impedimento",
    codigo: "impedimento",
    nome: "Impedimento",
    cor: "#ef4444",
    cor_fundo: "#fef2f2",
    cor_texto: "#b91c1c",
    cor_borda: "#fecaca",
    icone: "alert-triangle",
    ordem: 1,
    ativo: true,
  },
];

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
  const [grupos, setGrupos] = useState<GrupoRetorno[]>([]);

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addRetornoOpen, setAddRetornoOpen] = useState(false);
  const [editAtividadeOpen, setEditAtividadeOpen] = useState(false);
  const [selectedRetornoId, setSelectedRetornoId] = useState<string | null>(null);
  const [selectedAtividade, setSelectedAtividade] = useState<RetornoAtividade | null>(null);
  const [searchRetorno, setSearchRetorno] = useState("");
  const [searchAtividade, setSearchAtividade] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  
  // Estados para gerenciamento de grupos
  const [gruposDialogOpen, setGruposDialogOpen] = useState(false);
  const [editGrupoOpen, setEditGrupoOpen] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoRetorno | null>(null);
  const [novoGrupo, setNovoGrupo] = useState<Partial<GrupoRetorno>>({
    codigo: "",
    nome: "",
    cor: "#6b7280",
    cor_fundo: "#f3f4f6",
    cor_texto: "#374151",
    cor_borda: "#e5e7eb",
    icone: "check-circle",
  });
  
  // Estado para mover retorno entre grupos
  const [moverRetornoOpen, setMoverRetornoOpen] = useState(false);
  const [retornoParaMover, setRetornoParaMover] = useState<RetornoCampo | null>(null);

  // ============================================
  // CARREGAR DADOS
  // ============================================

  const carregarDados = useCallback(async () => {
    if (!tipoServicoId) return;
    
    setLoading(true);
    try {
      // Carregar retornos e atividades disponíveis
      const [retornosRes, atividadesRes] = await Promise.all([
        supabase.from("retornos_campo").select("*").eq("ativo", true).order("descricao"),
        supabase.from("atividades").select("*").eq("ativo", true).order("descricao"),
      ]);

      if (retornosRes.error) throw retornosRes.error;
      if (atividadesRes.error) throw atividadesRes.error;

      setTodosRetornos(retornosRes.data || []);
      setTodasAtividades(atividadesRes.data || []);

      // Tentar carregar grupos do banco, usar padrão se falhar ou estiver vazio
      let gruposData: GrupoRetorno[] = [];
      try {
        const gruposRes = await supabase.from("grupos_retorno").select("*").eq("ativo", true).order("ordem");
        if (!gruposRes.error && gruposRes.data && gruposRes.data.length > 0) {
          gruposData = gruposRes.data;
        } else {
          // Usar grupos padrão se a tabela não existir ou estiver vazia
          gruposData = GRUPOS_PADRAO;
        }
      } catch {
        // Usar grupos padrão se houver erro (ex: tabela não existe)
        gruposData = GRUPOS_PADRAO;
      }
      
      setGrupos(gruposData);
      
      // Expandir todos os grupos por padrão
      setExpandedGroups(gruposData.map(g => g.codigo));

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
    const gruposMap: Record<string, TipoServicoRetorno[]> = {};
    
    // Inicializar todos os grupos
    grupos.forEach(g => {
      gruposMap[g.codigo] = [];
    });

    // Agrupar por tipo
    retornosVinculados.forEach(retorno => {
      const tipo = retorno.retorno?.tipo || grupos[0]?.codigo || "executado";
      if (gruposMap[tipo]) {
        gruposMap[tipo].push(retorno);
      } else if (grupos.length > 0) {
        gruposMap[grupos[0].codigo].push(retorno); // fallback para primeiro grupo
      }
    });

    // Ordenar cada grupo por descrição (alfabético)
    Object.keys(gruposMap).forEach(key => {
      gruposMap[key].sort((a, b) => {
        const descA = a.retorno?.descricao || "";
        const descB = b.retorno?.descricao || "";
        return descA.localeCompare(descB, 'pt-BR');
      });
    });

    return gruposMap;
  }, [retornosVinculados, grupos]);

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
  // HANDLERS - GRUPOS
  // ============================================

  const handleCriarGrupo = async () => {
    if (!novoGrupo.codigo || !novoGrupo.nome) {
      toast.error("Código e nome são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("grupos_retorno")
        .insert({
          codigo: novoGrupo.codigo,
          nome: novoGrupo.nome,
          cor: novoGrupo.cor,
          cor_fundo: novoGrupo.cor_fundo,
          cor_texto: novoGrupo.cor_texto,
          cor_borda: novoGrupo.cor_borda,
          icone: novoGrupo.icone,
          ordem: grupos.length,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      setGrupos([...grupos, data]);
      setExpandedGroups([...expandedGroups, data.codigo]);
      setNovoGrupo({
        codigo: "",
        nome: "",
        cor: "#6b7280",
        cor_fundo: "#f3f4f6",
        cor_texto: "#374151",
        cor_borda: "#e5e7eb",
        icone: "check-circle",
      });
      toast.success("Grupo criado com sucesso");
    } catch (error: any) {
      console.error("Erro ao criar grupo:", error);
      toast.error(error.message || "Erro ao criar grupo");
    } finally {
      setSaving(false);
    }
  };

  const handleEditarGrupo = async () => {
    if (!selectedGrupo) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("grupos_retorno")
        .update({
          nome: selectedGrupo.nome,
          cor: selectedGrupo.cor,
          cor_fundo: selectedGrupo.cor_fundo,
          cor_texto: selectedGrupo.cor_texto,
          cor_borda: selectedGrupo.cor_borda,
          icone: selectedGrupo.icone,
        })
        .eq("id", selectedGrupo.id);

      if (error) throw error;

      setGrupos(grupos.map(g => g.id === selectedGrupo.id ? selectedGrupo : g));
      setEditGrupoOpen(false);
      toast.success("Grupo atualizado com sucesso");
    } catch (error: any) {
      console.error("Erro ao atualizar grupo:", error);
      toast.error("Erro ao atualizar grupo");
    } finally {
      setSaving(false);
    }
  };

  const handleExcluirGrupo = async (grupoId: string) => {
    const grupo = grupos.find(g => g.id === grupoId);
    if (!grupo) return;

    // Verificar se há retornos neste grupo
    const retornosNoGrupo = todosRetornos.filter(r => r.tipo === grupo.codigo);
    if (retornosNoGrupo.length > 0) {
      toast.error(`Não é possível excluir. Existem ${retornosNoGrupo.length} retornos neste grupo.`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("grupos_retorno")
        .delete()
        .eq("id", grupoId);

      if (error) throw error;

      setGrupos(grupos.filter(g => g.id !== grupoId));
      toast.success("Grupo excluído com sucesso");
    } catch (error: any) {
      console.error("Erro ao excluir grupo:", error);
      toast.error("Erro ao excluir grupo");
    } finally {
      setSaving(false);
    }
  };

  const handleMoverRetornoParaGrupo = async (novoGrupoCodigo: string) => {
    if (!retornoParaMover) return;

    setSaving(true);
    try {
      // Atualizar o tipo do retorno de campo
      const { error } = await supabase
        .from("retornos_campo")
        .update({ tipo: novoGrupoCodigo })
        .eq("id", retornoParaMover.id);

      if (error) throw error;

      // Atualizar estado local
      setTodosRetornos(todosRetornos.map(r => 
        r.id === retornoParaMover.id ? { ...r, tipo: novoGrupoCodigo } : r
      ));

      // Atualizar retornos vinculados se necessário
      setRetornosVinculados(retornosVinculados.map(rv => 
        rv.retorno_campo_id === retornoParaMover.id 
          ? { ...rv, retorno: { ...rv.retorno!, tipo: novoGrupoCodigo } }
          : rv
      ));

      setMoverRetornoOpen(false);
      setRetornoParaMover(null);
      toast.success("Retorno movido para o novo grupo");
    } catch (error: any) {
      console.error("Erro ao mover retorno:", error);
      toast.error("Erro ao mover retorno");
    } finally {
      setSaving(false);
    }
  };

  const handleAbrirMoverRetorno = (retorno: RetornoCampo) => {
    setRetornoParaMover(retorno);
    setMoverRetornoOpen(true);
  };

  // ============================================
  // HELPERS
  // ============================================

  const getGrupoConfig = (codigo: string) => {
    const grupo = grupos.find(g => g.codigo === codigo);
    if (!grupo) return null;
    
    const IconComponent = ICONES_DISPONIVEIS[grupo.icone as keyof typeof ICONES_DISPONIVEIS] || CheckCircle2;
    
    return {
      ...grupo,
      IconComponent,
    };
  };

  const retornosNaoVinculados = useMemo(() => {
    // Agrupar por tipo usando grupos dinâmicos
    const agrupados: Record<string, RetornoCampo[]> = {};
    
    // Inicializar grupos
    grupos.forEach(g => {
      agrupados[g.codigo] = [];
    });

    console.log("[RetornosConfig] todosRetornos:", todosRetornos.length);
    console.log("[RetornosConfig] retornosVinculados:", retornosVinculados.length);

    todosRetornos
      .filter(r => !retornosVinculados.some(v => v.retorno_campo_id === r.id))
      .forEach(r => {
        const tipo = r.tipo || grupos[0]?.codigo || "executado";
        if (agrupados[tipo]) {
          agrupados[tipo].push(r);
        } else if (grupos.length > 0) {
          agrupados[grupos[0].codigo].push(r);
        }
      });

    console.log("[RetornosConfig] retornosNaoVinculados:", agrupados);

    return agrupados;
  }, [todosRetornos, retornosVinculados, grupos]);

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
              {/* Cabeçalho com botões */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    {retornosVinculados.length} Retornos configurados
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    {grupos.length} Grupos
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    (Arraste para reordenar)
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setGruposDialogOpen(true)}
                  >
                    <FolderCog className="h-4 w-4 mr-1" />
                    Gerenciar Grupos
                  </Button>
                  
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
                        {grupos.map((grupo) => {
                          const retornosDoTipo = retornosNaoVinculados[grupo.codigo] || [];
                          const retornosFiltrados = retornosDoTipo.filter(r =>
                            r.codigo.toLowerCase().includes(searchRetorno.toLowerCase()) ||
                            r.descricao.toLowerCase().includes(searchRetorno.toLowerCase())
                          );

                          if (retornosFiltrados.length === 0) return null;

                          const IconComponent = ICONES_DISPONIVEIS[grupo.icone as keyof typeof ICONES_DISPONIVEIS] || CheckCircle2;

                          return (
                            <CommandGroup 
                              key={grupo.codigo}
                              heading={
                                <div className="flex items-center gap-2">
                                  <IconComponent className="h-4 w-4" style={{ color: grupo.cor_texto }} />
                                  <span style={{ color: grupo.cor_texto }}>{grupo.nome}</span>
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
                  {grupos.map((grupo) => {
                    const retornosDoGrupo = retornosAgrupados[grupo.codigo] || [];
                    if (retornosDoGrupo.length === 0) return null;

                    const IconComponent = ICONES_DISPONIVEIS[grupo.icone as keyof typeof ICONES_DISPONIVEIS] || CheckCircle2;
                    const isExpanded = expandedGroups.includes(grupo.codigo);

                    return (
                      <div 
                        key={grupo.codigo}
                        className="border rounded-lg overflow-hidden"
                        style={{ borderColor: grupo.cor_borda }}
                      >
                        {/* Cabeçalho do grupo */}
                        <button
                          onClick={() => toggleGroup(grupo.codigo)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: grupo.cor_fundo }}
                        >
                          <div className="flex items-center gap-3">
                            <IconComponent className="h-5 w-5" style={{ color: grupo.cor_texto }} />
                            <span className="font-semibold" style={{ color: grupo.cor_texto }}>
                              {grupo.nome}
                            </span>
                            <Badge variant="secondary">
                              {retornosDoGrupo.length}
                            </Badge>
                          </div>
                          <ChevronDown 
                            className={cn(
                              "h-5 w-5 transition-transform",
                              isExpanded && "transform rotate-180"
                            )} 
                            style={{ color: grupo.cor_texto }}
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
                                  onDrop={(e) => handleDrop(e, retornoVinculado.id, grupo.codigo)}
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
                                          onClick={() => retorno && handleAbrirMoverRetorno(retorno)}
                                          disabled={saving}
                                        >
                                          <MoveRight className="h-3 w-3 mr-1" />
                                          Mover Grupo
                                        </Button>
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
        <DialogContent className="max-w-md z-[9999]">
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

      {/* Dialog de Gerenciamento de Grupos */}
      <Dialog open={gruposDialogOpen} onOpenChange={setGruposDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderCog className="h-5 w-5" />
              Gerenciar Grupos de Retornos
            </DialogTitle>
            <DialogDescription>
              Crie, edite ou exclua grupos para organizar os retornos de campo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Criar novo grupo */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Criar Novo Grupo
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input
                    placeholder="ex: pendente"
                    value={novoGrupo.codigo || ""}
                    onChange={(e) => setNovoGrupo({ ...novoGrupo, codigo: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    placeholder="ex: Pendente"
                    value={novoGrupo.nome || ""}
                    onChange={(e) => setNovoGrupo({ ...novoGrupo, nome: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Cor Principal</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={novoGrupo.cor || "#6b7280"}
                      onChange={(e) => setNovoGrupo({ ...novoGrupo, cor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor Fundo</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={novoGrupo.cor_fundo || "#f3f4f6"}
                      onChange={(e) => setNovoGrupo({ ...novoGrupo, cor_fundo: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor Texto</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={novoGrupo.cor_texto || "#374151"}
                      onChange={(e) => setNovoGrupo({ ...novoGrupo, cor_texto: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor Borda</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={novoGrupo.cor_borda || "#e5e7eb"}
                      onChange={(e) => setNovoGrupo({ ...novoGrupo, cor_borda: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select
                  value={novoGrupo.icone || "check-circle"}
                  onValueChange={(v) => setNovoGrupo({ ...novoGrupo, icone: v })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ICONES_DISPONIVEIS).map(([key, Icon]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{key}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCriarGrupo} disabled={saving || !novoGrupo.codigo || !novoGrupo.nome}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Grupo
              </Button>
            </div>

            {/* Lista de grupos existentes */}
            <div className="space-y-4">
              <h4 className="font-semibold">Grupos Existentes ({grupos.length})</h4>
              {grupos.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum grupo cadastrado
                </p>
              ) : (
                <div className="space-y-2">
                  {grupos.map((grupo) => {
                    const IconComponent = ICONES_DISPONIVEIS[grupo.icone as keyof typeof ICONES_DISPONIVEIS] || CheckCircle2;
                    const retornosNoGrupo = todosRetornos.filter(r => r.tipo === grupo.codigo).length;
                    
                    return (
                      <div
                        key={grupo.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        style={{ borderColor: grupo.cor_borda, backgroundColor: grupo.cor_fundo }}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent className="h-5 w-5" style={{ color: grupo.cor_texto }} />
                          <div>
                            <span className="font-semibold" style={{ color: grupo.cor_texto }}>
                              {grupo.nome}
                            </span>
                            <span className="text-xs ml-2 text-muted-foreground">
                              ({grupo.codigo})
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {retornosNoGrupo} retornos
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedGrupo(grupo);
                              setEditGrupoOpen(true);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleExcluirGrupo(grupo.id)}
                            disabled={saving || retornosNoGrupo > 0}
                            title={retornosNoGrupo > 0 ? "Não é possível excluir grupo com retornos" : "Excluir grupo"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGruposDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Grupo */}
      <Dialog open={editGrupoOpen} onOpenChange={setEditGrupoOpen}>
        <DialogContent className="max-w-md z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Editar Grupo
            </DialogTitle>
            <DialogDescription>
              Código: {selectedGrupo?.codigo}
            </DialogDescription>
          </DialogHeader>

          {selectedGrupo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={selectedGrupo.nome}
                  onChange={(e) => setSelectedGrupo({ ...selectedGrupo, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor Principal</Label>
                  <input
                    type="color"
                    value={selectedGrupo.cor}
                    onChange={(e) => setSelectedGrupo({ ...selectedGrupo, cor: e.target.value })}
                    className="w-full h-10 rounded cursor-pointer border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor Fundo</Label>
                  <input
                    type="color"
                    value={selectedGrupo.cor_fundo}
                    onChange={(e) => setSelectedGrupo({ ...selectedGrupo, cor_fundo: e.target.value })}
                    className="w-full h-10 rounded cursor-pointer border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor Texto</Label>
                  <input
                    type="color"
                    value={selectedGrupo.cor_texto}
                    onChange={(e) => setSelectedGrupo({ ...selectedGrupo, cor_texto: e.target.value })}
                    className="w-full h-10 rounded cursor-pointer border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor Borda</Label>
                  <input
                    type="color"
                    value={selectedGrupo.cor_borda}
                    onChange={(e) => setSelectedGrupo({ ...selectedGrupo, cor_borda: e.target.value })}
                    className="w-full h-10 rounded cursor-pointer border"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select
                  value={selectedGrupo.icone}
                  onValueChange={(v) => setSelectedGrupo({ ...selectedGrupo, icone: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ICONES_DISPONIVEIS).map(([key, Icon]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{key}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview do grupo */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div
                  className="p-3 rounded-lg border flex items-center gap-3"
                  style={{
                    backgroundColor: selectedGrupo.cor_fundo,
                    borderColor: selectedGrupo.cor_borda,
                  }}
                >
                  {(() => {
                    const Icon = ICONES_DISPONIVEIS[selectedGrupo.icone as keyof typeof ICONES_DISPONIVEIS] || CheckCircle2;
                    return <Icon className="h-5 w-5" style={{ color: selectedGrupo.cor_texto }} />;
                  })()}
                  <span className="font-semibold" style={{ color: selectedGrupo.cor_texto }}>
                    {selectedGrupo.nome}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGrupoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditarGrupo} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Mover Retorno entre Grupos */}
      <Dialog open={moverRetornoOpen} onOpenChange={setMoverRetornoOpen}>
        <DialogContent className="max-w-md z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5" />
              Mover Retorno para Outro Grupo
            </DialogTitle>
            <DialogDescription>
              {retornoParaMover?.codigo} - {retornoParaMover?.descricao}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Grupo atual: <strong>{grupos.find(g => g.codigo === retornoParaMover?.tipo)?.nome || retornoParaMover?.tipo}</strong>
            </p>
            
            <div className="space-y-2">
              <Label>Selecione o novo grupo:</Label>
              <div className="space-y-2">
                {grupos
                  .filter(g => g.codigo !== retornoParaMover?.tipo)
                  .map((grupo) => {
                    const IconComponent = ICONES_DISPONIVEIS[grupo.icone as keyof typeof ICONES_DISPONIVEIS] || CheckCircle2;
                    
                    return (
                      <button
                        key={grupo.id}
                        onClick={() => handleMoverRetornoParaGrupo(grupo.codigo)}
                        disabled={saving}
                        className="w-full flex items-center gap-3 p-3 border rounded-lg hover:opacity-80 transition-opacity text-left"
                        style={{
                          backgroundColor: grupo.cor_fundo,
                          borderColor: grupo.cor_borda,
                        }}
                      >
                        <IconComponent className="h-5 w-5" style={{ color: grupo.cor_texto }} />
                        <span className="font-semibold" style={{ color: grupo.cor_texto }}>
                          {grupo.nome}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoverRetornoOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
