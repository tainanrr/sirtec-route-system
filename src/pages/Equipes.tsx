import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTelaPermissao } from "@/hooks/usePermissoes";
import { useLogSistema } from "@/hooks/useLogSistema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Copy,
  Clock,
  User,
  X,
  Check,
  CheckCircle,
  XCircle,
  CheckSquare,
  Square,
  Settings2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  FilterX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TecnicoFormDialog } from "@/components/equipes/TecnicoFormDialog";
import type { Tables } from "@/integrations/supabase/types";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ExportButton } from "@/components/ui/export-button";

// Interface para colaborador
interface Colaborador {
  id: string;
  cpf: string;
  nome: string;
  cargo: string | null;
  ativo: boolean;
}

// Interface para equipe com colaboradores
interface EquipeColaborador {
  id: string;
  colaborador_id: string;
  funcao: string;
  colaborador: Colaborador;
}

interface EquipeComColaboradores extends Tables<"tecnicos"> {
  colaboradores?: EquipeColaborador[];
}

// Interface para Supervisor
interface Supervisor {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
}

// Interface para Centro de Custo
interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
}

const statusConfig = {
  disponivel: { label: "Ativa", icon: CheckCircle, color: "bg-success", dotColor: "bg-success" },
  offline: { label: "Inativa", icon: XCircle, color: "bg-muted", dotColor: "bg-muted-foreground" },
};

const tipoEquipeConfig = {
  normal: { label: "Normal", color: "bg-slate-100 text-slate-700 border-slate-300" },
  gaviao: { label: "Gavião", color: "bg-amber-100 text-amber-700 border-amber-300" },
  kit: { label: "Kit", color: "bg-purple-100 text-purple-700 border-purple-300" },
};

const Equipes = () => {
  // Permissões da tela
  const { podeEditar, apenasLeitura } = useTelaPermissao("equipes");
  const { logCriar, logEditar, logExcluir } = useLogSistema();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tecnicos, setTecnicos] = useState<EquipeComColaboradores[]>([]);
  const [todosColaboradores, setTodosColaboradores] = useState<Colaborador[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tables<"tecnicos"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tecnicoToDelete, setTecnicoToDelete] = useState<Tables<"tecnicos"> | null>(null);
  
  // Estados para edição inline
  const [editingJornada, setEditingJornada] = useState<string | null>(null);
  const [jornadaValue, setJornadaValue] = useState("");
  
  // Estados para seleção e edição em massa
  const [equipesSelecionadas, setEquipesSelecionadas] = useState<Set<string>>(new Set());
  const [editarMassaDialogOpen, setEditarMassaDialogOpen] = useState(false);
  const [tipoEdicaoMassa, setTipoEdicaoMassa] = useState<"tipos" | "jornada" | "status" | "supervisor" | "centroCusto" | null>(null);
  const [valorEdicaoMassa, setValorEdicaoMassa] = useState<string>("");
  const [salvandoMassa, setSalvandoMassa] = useState(false);

  // Buscar todos os colaboradores disponíveis
  const fetchTodosColaboradores = async () => {
    const { data, error } = await supabase
      .from("colaboradores")
      .select("id, cpf, nome, cargo, ativo")
      .eq("ativo", true)
      .order("nome");

    if (!error && data) {
      setTodosColaboradores(data);
    }
  };

  // Buscar supervisores
  const fetchSupervisores = async () => {
    const { data, error } = await supabase
      .from("coordenadores_supervisores")
      .select("id, codigo, nome, tipo")
      .eq("tipo", "supervisor")
      .eq("ativo", true)
      .order("nome");

    if (!error && data) {
      setSupervisores(data);
    }
  };

  // Buscar centros de custo
  const fetchCentrosCusto = async () => {
    const { data, error } = await supabase
      .from("centros_custo")
      .select("id, codigo, nome")
      .eq("ativo", true)
      .order("nome");

    if (!error && data) {
      setCentrosCusto(data);
    }
  };

  const fetchTecnicos = async () => {
    setLoading(true);
    
    // Buscar técnicos com centro de custo e supervisor
    const { data: tecnicosData, error: tecnicosError } = await supabase
      .from("tecnicos")
      .select("*, centros_custo:centro_custo_id(id, codigo, nome), supervisor:supervisor_id(id, codigo, nome)")
      .order("codigo");

    if (tecnicosError) {
      toast.error("Erro ao carregar técnicos");
      setLoading(false);
      return;
    }

    // Buscar colaboradores de cada equipe
    const { data: equipesColabs, error: colabsError } = await supabase
      .from("equipe_colaboradores")
      .select(`
        id,
        equipe_id,
        colaborador_id,
        funcao,
        ativo,
        colaboradores:colaborador_id (id, cpf, nome, cargo, ativo)
      `)
      .eq("ativo", true);

    if (colabsError) {
      console.error("Erro ao carregar colaboradores:", colabsError);
    }

    // Mapear colaboradores para cada equipe
    const tecnicosComColabs: EquipeComColaboradores[] = (tecnicosData || []).map(tecnico => {
      const colabs = (equipesColabs || [])
        .filter((ec: any) => ec.equipe_id === tecnico.id)
        .map((ec: any) => ({
          id: ec.id,
          colaborador_id: ec.colaborador_id,
          funcao: ec.funcao,
          colaborador: ec.colaboradores,
        }));

      return {
        ...tecnico,
        colaboradores: colabs,
      };
    });

    setTecnicos(tecnicosComColabs);
    setLoading(false);
  };

  useEffect(() => {
    fetchTecnicos();
    fetchTodosColaboradores();
    fetchSupervisores();
    fetchCentrosCusto();
  }, []);

  const handleEdit = (tecnico: Tables<"tecnicos">) => {
    setSelectedTecnico(tecnico);
    setFormOpen(true);
  };

  const handleDuplicate = (tecnico: Tables<"tecnicos">) => {
    let novoCodigo = `${tecnico.codigo}-Copy`;
    let contador = 1;
    
    while (tecnicos.some(t => t.codigo === novoCodigo && t.id !== tecnico.id)) {
      novoCodigo = `${tecnico.codigo}-Copy${contador > 1 ? contador : ''}`;
      contador++;
    }
    
    const tecnicoDuplicado: Tables<"tecnicos"> = {
      ...tecnico,
      id: `temp-duplicate-${Date.now()}`,
      codigo: novoCodigo,
      nome: `${tecnico.nome} (Cópia)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    setSelectedTecnico(tecnicoDuplicado);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!tecnicoToDelete) return;

    try {
      // Verificar se há ordens de serviço concluídas para esta equipe
      const { data: osConcluidas, error: osError } = await supabase
        .from("ordens_servico")
        .select("id")
        .eq("equipe_planejada_id", tecnicoToDelete.id)
        .in("status", ["concluida", "finalizada", "executada"])
        .limit(1);

      if (osError) {
        console.error("Erro ao verificar OS:", osError);
      }

      // Se há OS concluídas, apenas desativar
      if (osConcluidas && osConcluidas.length > 0) {
        const { error: updateError } = await supabase
          .from("tecnicos")
          .update({ status: "offline" })
          .eq("id", tecnicoToDelete.id);

        if (updateError) {
          toast.error("Erro ao desativar equipe");
        } else {
          // Log de desativação
          logEditar("equipes", "tecnicos", tecnicoToDelete.id, tecnicoToDelete, { status: "offline" },
            `Desativou equipe ${tecnicoToDelete.codigo} - ${tecnicoToDelete.nome} (possui OS concluídas)`);
          
          toast.info("Equipe desativada (possui OS concluídas no histórico)");
          fetchTecnicos();
        }
      } else {
        // Primeiro, remover vínculos com colaboradores
        await supabase
          .from("equipe_colaboradores")
          .delete()
          .eq("equipe_id", tecnicoToDelete.id);

        // Remover vínculos com OS pendentes (definir equipe como null)
        await supabase
          .from("ordens_servico")
          .update({ equipe_planejada_id: null })
          .eq("equipe_planejada_id", tecnicoToDelete.id);

        // Agora pode excluir a equipe
        const { error } = await supabase
          .from("tecnicos")
          .delete()
          .eq("id", tecnicoToDelete.id);

        if (error) {
          // Se ainda der erro, apenas desativar
          console.error("Erro ao excluir, tentando desativar:", error);
          const { error: updateError } = await supabase
            .from("tecnicos")
            .update({ status: "offline" })
            .eq("id", tecnicoToDelete.id);

          if (updateError) {
            toast.error("Erro ao excluir/desativar equipe");
          } else {
            // Log de desativação
            logEditar("equipes", "tecnicos", tecnicoToDelete.id, tecnicoToDelete, { status: "offline" },
              `Desativou equipe ${tecnicoToDelete.codigo} - ${tecnicoToDelete.nome}`);
            
            toast.info("Equipe desativada (não foi possível excluir)");
            fetchTecnicos();
          }
        } else {
          // Log de exclusão
          logExcluir("equipes", "tecnicos", tecnicoToDelete.id, tecnicoToDelete,
            `Excluiu equipe ${tecnicoToDelete.codigo} - ${tecnicoToDelete.nome}`);
          
          toast.success("Equipe excluída com sucesso");
          fetchTecnicos();
        }
      }
    } catch (err) {
      console.error("Erro:", err);
      toast.error("Erro ao processar solicitação");
    }

    setDeleteDialogOpen(false);
    setTecnicoToDelete(null);
  };

  // Atualizar jornada inline
  const handleSaveJornada = async (tecnicoId: string) => {
    if (!jornadaValue) return;

    const { error } = await supabase
      .from("tecnicos")
      .update({ hora_inicio: jornadaValue })
      .eq("id", tecnicoId);

    if (error) {
      toast.error("Erro ao atualizar jornada");
    } else {
      toast.success("Jornada atualizada");
      fetchTecnicos();
    }
    setEditingJornada(null);
  };

  // Atualizar status inline
  const handleToggleStatus = async (tecnicoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "disponivel" ? "offline" : "disponivel";
    
    const { error } = await supabase
      .from("tecnicos")
      .update({ status: newStatus })
      .eq("id", tecnicoId);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(newStatus === "disponivel" ? "Equipe ativada" : "Equipe inativada");
      fetchTecnicos();
    }
  };

  // Atualizar tipo de equipe inline
  const handleUpdateTipoEquipe = async (tecnicoId: string, novoTipo: string) => {
    const { error } = await supabase
      .from("tecnicos")
      .update({ tipo_equipe: novoTipo })
      .eq("id", tecnicoId);

    if (error) {
      toast.error("Erro ao atualizar tipo de equipe");
    } else {
      const tipoLabel = tipoEquipeConfig[novoTipo as keyof typeof tipoEquipeConfig]?.label || novoTipo;
      toast.success(`Tipo alterado para "${tipoLabel}"`);
      fetchTecnicos();
    }
  };

  // Atualizar centro de custo inline
  const handleUpdateCentroCusto = async (tecnicoId: string, novoCentroCustoId: string | null) => {
    const { error } = await supabase
      .from("tecnicos")
      .update({ centro_custo_id: novoCentroCustoId })
      .eq("id", tecnicoId);

    if (error) {
      toast.error("Erro ao atualizar centro de custo");
    } else {
      const cc = centrosCusto.find(c => c.id === novoCentroCustoId);
      toast.success(cc ? `Centro de custo alterado para "${cc.nome}"` : "Centro de custo removido");
      fetchTecnicos();
    }
  };

  // Atualizar supervisor inline
  const handleUpdateSupervisor = async (tecnicoId: string, novoSupervisorId: string) => {
    if (!novoSupervisorId) {
      toast.error("Supervisor é obrigatório");
      return;
    }
    
    const { error } = await supabase
      .from("tecnicos")
      .update({ supervisor_id: novoSupervisorId })
      .eq("id", tecnicoId);

    if (error) {
      toast.error("Erro ao atualizar supervisor");
    } else {
      const sup = supervisores.find(s => s.id === novoSupervisorId);
      toast.success(`Supervisor alterado para "${sup?.nome}"`);
      fetchTecnicos();
    }
  };

  // Adicionar colaborador à equipe
  const handleAddColaborador = async (equipeId: string, colaboradorId: string, slotIndex: number) => {
    const equipe = tecnicos.find(t => t.id === equipeId);
    if (!equipe) return;

    // Verificar se o colaborador já está ativo em outra equipe
    const { data: vinculoExistente } = await supabase
      .from("equipe_colaboradores")
      .select(`
        id,
        equipe_id,
        tecnicos:equipe_id (codigo, nome)
      `)
      .eq("colaborador_id", colaboradorId)
      .eq("ativo", true)
      .single();

    if (vinculoExistente && vinculoExistente.equipe_id !== equipeId) {
      const equipeAtual = (vinculoExistente as any).tecnicos;
      toast.error(`Colaborador já está vinculado à equipe ${equipeAtual?.codigo || ''} (${equipeAtual?.nome || ''})`);
      return;
    }

    // Verificar se já tem um colaborador no slot
    const colabNoSlot = equipe.colaboradores?.[slotIndex];
    
    if (colabNoSlot) {
      // Remover colaborador existente
      await supabase
        .from("equipe_colaboradores")
        .update({ ativo: false, data_fim: new Date().toISOString().split("T")[0] })
        .eq("id", colabNoSlot.id);
    }

    // Adicionar novo colaborador
    const { error } = await supabase
      .from("equipe_colaboradores")
      .insert({
        equipe_id: equipeId,
        colaborador_id: colaboradorId,
        funcao: slotIndex === 0 ? "lider" : "membro",
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("Colaborador já está vinculado a esta equipe");
      } else {
        toast.error("Erro ao adicionar colaborador");
      }
    } else {
      toast.success("Colaborador vinculado");
      fetchTecnicos();
    }
  };

  // Remover colaborador da equipe
  const handleRemoveColaborador = async (equipeColaboradorId: string) => {
    const { error } = await supabase
      .from("equipe_colaboradores")
      .update({ ativo: false, data_fim: new Date().toISOString().split("T")[0] })
      .eq("id", equipeColaboradorId);

    if (error) {
      toast.error("Erro ao remover colaborador");
    } else {
      toast.success("Colaborador removido");
      fetchTecnicos();
    }
  };

  // Atualizar função do colaborador
  const handleUpdateFuncao = async (equipeColaboradorId: string, novaFuncao: string) => {
    const { error } = await supabase
      .from("equipe_colaboradores")
      .update({ funcao: novaFuncao })
      .eq("id", equipeColaboradorId);

    if (error) {
      toast.error("Erro ao atualizar função");
    } else {
      toast.success("Função atualizada");
      fetchTecnicos();
    }
  };

  // Funções para seleção em massa
  const toggleSelecionarEquipe = (equipeId: string) => {
    const novaSelecao = new Set(equipesSelecionadas);
    if (novaSelecao.has(equipeId)) {
      novaSelecao.delete(equipeId);
    } else {
      novaSelecao.add(equipeId);
    }
    setEquipesSelecionadas(novaSelecao);
  };

  const selecionarTodasVisiveis = () => {
    const idsVisiveis = filteredEquipes.map(e => e.id);
    setEquipesSelecionadas(new Set(idsVisiveis));
  };

  const limparSelecao = () => {
    setEquipesSelecionadas(new Set());
  };

  // Função para abrir diálogo de edição em massa
  const abrirEdicaoMassa = (tipo: "tipos" | "jornada" | "status" | "supervisor" | "centroCusto") => {
    setTipoEdicaoMassa(tipo);
    setValorEdicaoMassa("");
    setEditarMassaDialogOpen(true);
  };

  // Função para aplicar edição em massa
  const aplicarEdicaoMassa = async () => {
    if (equipesSelecionadas.size === 0 || !tipoEdicaoMassa) return;
    
    setSalvandoMassa(true);
    const idsParaAtualizar = Array.from(equipesSelecionadas);
    
    try {
      let updateData: any = {};
      let mensagemSucesso = "";
      
      switch (tipoEdicaoMassa) {
        case "tipos":
          // Para tipos, esperamos uma string de habilidades separadas por vírgula
          const habilidades = valorEdicaoMassa.split(",").map(h => h.trim()).filter(h => h);
          updateData = { habilidades };
          mensagemSucesso = `Habilidades atualizadas em ${idsParaAtualizar.length} equipe(s)`;
          break;
        case "jornada":
          updateData = { hora_inicio: valorEdicaoMassa };
          mensagemSucesso = `Jornada atualizada em ${idsParaAtualizar.length} equipe(s)`;
          break;
        case "status":
          updateData = { status: valorEdicaoMassa };
          mensagemSucesso = `Status atualizado em ${idsParaAtualizar.length} equipe(s)`;
          break;
        case "supervisor":
          updateData = { supervisor_id: valorEdicaoMassa };
          mensagemSucesso = `Supervisor atualizado em ${idsParaAtualizar.length} equipe(s)`;
          break;
        case "centroCusto":
          updateData = { centro_custo_id: valorEdicaoMassa === "_none_" ? null : valorEdicaoMassa };
          mensagemSucesso = `Centro de Custo atualizado em ${idsParaAtualizar.length} equipe(s)`;
          break;
      }
      
      // Atualizar todas as equipes selecionadas
      const { error } = await supabase
        .from("tecnicos")
        .update(updateData)
        .in("id", idsParaAtualizar);
      
      if (error) throw error;
      
      toast.success(mensagemSucesso);
      setEditarMassaDialogOpen(false);
      setEquipesSelecionadas(new Set());
      fetchTecnicos();
    } catch (error: any) {
      console.error("Erro na edição em massa:", error);
      toast.error("Erro ao aplicar alterações em massa", {
        description: error.message || "Erro desconhecido"
      });
    } finally {
      setSalvandoMassa(false);
    }
  };

  // Colaboradores disponíveis (não vinculados à equipe)
  const getColaboradoresDisponiveis = (equipeId: string, searchTerm: string = "") => {
    const equipe = tecnicos.find(t => t.id === equipeId);
    const colabsEquipe = equipe?.colaboradores?.map(c => c.colaborador_id) || [];
    
    return todosColaboradores.filter(c => 
      !colabsEquipe.includes(c.id) &&
      (searchTerm === "" || 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cpf.includes(searchTerm))
    );
  };

  const filteredEquipes = tecnicos.filter((tecnico) => {
    const matchesSearch =
      tecnico.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tecnico.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tecnico.colaboradores?.some(c => 
        c.colaborador?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    // Normalizar status para filtro
    const normalizedStatus = tecnico.status === "offline" ? "offline" : "disponivel";
    const matchesStatus = statusFilter === "all" || normalizedStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Verificar se todas as equipes visíveis estão selecionadas
  const todasSelecionadas = filteredEquipes.length > 0 && 
    filteredEquipes.every(e => equipesSelecionadas.has(e.id));

  // Normalizar status para contagem (antigos status são considerados como "disponivel")
  const statusCounts = tecnicos.reduce((acc, eq) => {
    const normalizedStatus = eq.status === "offline" ? "offline" : "disponivel";
    acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Componente para célula de tipo de equipe com edição inline
  const TipoEquipeCell = ({ equipe }: { equipe: EquipeComColaboradores }) => {
    const tipoAtual = (equipe as any).tipo_equipe || "normal";
    const config = tipoEquipeConfig[tipoAtual as keyof typeof tipoEquipeConfig] || tipoEquipeConfig.normal;

    return (
      <Select
        value={tipoAtual}
        onValueChange={(value) => handleUpdateTipoEquipe(equipe.id, value)}
        disabled={!podeEditar}
      >
        <SelectTrigger 
          className={cn(
            "h-7 w-[90px] text-xs font-medium border",
            config.color,
            !podeEditar && "cursor-not-allowed opacity-60"
          )}
          title={!podeEditar ? "Você não tem permissão para editar" : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="normal">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              Normal
            </div>
          </SelectItem>
          <SelectItem value="gaviao">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Gavião
            </div>
          </SelectItem>
          <SelectItem value="kit">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Kit
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  };

  // Componente para célula de centro de custo com edição inline
  const CentroCustoCell = ({ equipe }: { equipe: EquipeComColaboradores }) => {
    const ccAtual = (equipe as any).centros_custo;
    const ccId = (equipe as any).centro_custo_id || "";

    return (
      <Select
        value={ccId || "_none_"}
        onValueChange={(value) => handleUpdateCentroCusto(equipe.id, value === "_none_" ? null : value)}
        disabled={!podeEditar}
      >
        <SelectTrigger 
          className={cn(
            "h-7 w-[130px] text-xs font-medium border",
            ccAtual ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-500 border-gray-200",
            !podeEditar && "cursor-not-allowed opacity-60"
          )}
          title={!podeEditar ? "Você não tem permissão para editar" : undefined}
        >
          <SelectValue placeholder="Selecionar..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none_">
            <span className="text-muted-foreground">Nenhum</span>
          </SelectItem>
          {centrosCusto.map((cc) => (
            <SelectItem key={cc.id} value={cc.id}>
              {cc.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  // Componente para célula de supervisor com edição inline
  const SupervisorCell = ({ equipe }: { equipe: EquipeComColaboradores }) => {
    const supAtual = (equipe as any).supervisor;
    const supId = (equipe as any).supervisor_id || "";

    return (
      <Select
        value={supId || "_none_"}
        onValueChange={(value) => {
          if (value !== "_none_") {
            handleUpdateSupervisor(equipe.id, value);
          }
        }}
        disabled={!podeEditar}
      >
        <SelectTrigger 
          className={cn(
            "h-7 w-[150px] text-xs font-medium border",
            supAtual ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-red-50 text-red-600 border-red-200",
            !podeEditar && "cursor-not-allowed opacity-60"
          )}
          title={!podeEditar ? "Você não tem permissão para editar" : supAtual ? supAtual.nome : "Selecione um supervisor"}
        >
          <SelectValue placeholder="Selecionar..." />
        </SelectTrigger>
        <SelectContent>
          {!supId && (
            <SelectItem value="_none_" disabled>
              <span className="text-destructive">Selecione...</span>
            </SelectItem>
          )}
          {supervisores.map((sup) => (
            <SelectItem key={sup.id} value={sup.id}>
              {sup.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  // Componente para célula de colaborador com edição inline
  const ColaboradorCell = ({ 
    equipe, 
    slotIndex, 
    label 
  }: { 
    equipe: EquipeComColaboradores; 
    slotIndex: number; 
    label: string;
  }) => {
    const colaborador = equipe.colaboradores?.[slotIndex];
    const [open, setOpen] = useState(false);
    const [localSearch, setLocalSearch] = useState("");
    const [showTrocar, setShowTrocar] = useState(false);

    const colaboradoresDisponiveis = getColaboradoresDisponiveis(equipe.id, localSearch);

    const funcoes = [
      { value: "lider", label: "Líder", color: "bg-amber-500" },
      { value: "membro", label: "Membro", color: "bg-blue-500" },
      { value: "motorista", label: "Motorista", color: "bg-green-500" },
    ];

    // Se não tem permissão de editar, mostra apenas visualização
    if (!podeEditar) {
      return (
        <div 
          className={cn(
            "flex items-center gap-2 p-2 rounded-md min-h-[40px]",
            colaborador 
              ? "bg-muted/50" 
              : "border border-dashed border-muted-foreground/30"
          )}
          title="Você não tem permissão para editar"
        >
          {colaborador ? (
            <>
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                {colaborador.colaborador?.nome?.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{colaborador.colaborador?.nome?.split(" ")[0]}</p>
                <p className="text-xs text-muted-foreground capitalize">{colaborador.funcao}</p>
              </div>
            </>
          ) : (
            <>
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{label}</span>
            </>
          )}
        </div>
      );
    }

    return (
      <Popover 
        open={open} 
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setLocalSearch("");
            setShowTrocar(false);
          }
        }}
      >
        <PopoverTrigger asChild>
          <div 
            className={cn(
              "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors min-h-[40px]",
              colaborador 
                ? "bg-muted/50 hover:bg-muted" 
                : "border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
            )}
          >
            {colaborador ? (
              <>
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                  {colaborador.colaborador?.nome?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{colaborador.colaborador?.nome?.split(" ")[0]}</p>
                  <p className="text-xs text-muted-foreground capitalize">{colaborador.funcao}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveColaborador(colaborador.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-72 p-2" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-2">
            {/* Se já tem colaborador, mostrar opções de edição */}
            {colaborador && !showTrocar ? (
              <>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                    {colaborador.colaborador?.nome?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{colaborador.colaborador?.nome}</p>
                    <p className="text-xs text-muted-foreground">{colaborador.colaborador?.cargo || "Colaborador"}</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-1">Função:</p>
                  <div className="grid grid-cols-3 gap-1">
                    {funcoes.map((f) => (
                      <Button
                        key={f.value}
                        variant={colaborador.funcao === f.value ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "text-xs h-8",
                          colaborador.funcao === f.value && f.color
                        )}
                        onClick={() => {
                          handleUpdateFuncao(colaborador.id, f.value);
                          setOpen(false);
                        }}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-2 mt-2 space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => setShowTrocar(true)}
                  >
                    <User className="h-3 w-3 mr-2" />
                    Trocar colaborador
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      handleRemoveColaborador(colaborador.id);
                      setOpen(false);
                    }}
                  >
                    <X className="h-3 w-3 mr-2" />
                    Remover colaborador
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Busca de colaboradores */}
                {showTrocar && colaborador && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7 mb-2"
                    onClick={() => setShowTrocar(false)}
                  >
                    ← Voltar
                  </Button>
                )}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CPF..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="h-8 pl-7 text-sm"
                    autoFocus
                  />
                </div>
                <div className="text-xs text-muted-foreground px-1">
                  {colaboradoresDisponiveis.length} colaborador(es) disponível(is)
                </div>
                <ScrollArea className="h-52">
                  <div className="space-y-1">
                    {colaboradoresDisponiveis.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                        onClick={() => {
                          handleAddColaborador(equipe.id, c.id, slotIndex);
                          setOpen(false);
                          setLocalSearch("");
                          setShowTrocar(false);
                        }}
                      >
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                          {c.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">{c.cargo || "Sem cargo"}</p>
                        </div>
                      </div>
                    ))}
                    {colaboradoresDisponiveis.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum colaborador encontrado
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <MainLayout
      title="Equipes"
    >
      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = statusCounts[key] || 0;
          return (
            <div
              key={key}
              className={cn(
                "rounded-xl border border-border bg-card p-4 flex items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors",
                statusFilter === key && "border-primary"
              )}
              onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}
            >
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", config.color + "/10")}>
                <config.icon className={cn("h-5 w-5", config.color.replace("bg-", "text-"))} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar equipe ou colaborador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ExportButton
            data={tecnicos}
            filename="equipes"
            columns={[
              { key: "codigo", label: "Código" },
              { key: "nome", label: "Nome" },
              { key: "status", label: "Status", format: (v) => v === "offline" ? "Inativa" : "Ativa" },
              { key: "tipo_equipe", label: "Tipo", format: (v) => v === "gaviao" ? "Gavião" : v === "kit" ? "Kit" : "Normal" },
              { key: "hora_inicio", label: "Jornada Início" },
              { key: "jornada_horas", label: "Jornada (horas)" },
              { key: "max_horas_trabalho", label: "Máx Horas Trabalho" },
              { key: "habilidades", label: "Habilidades", format: (v) => Array.isArray(v) ? v.join(", ") : "" },
              { key: "color", label: "Cor" },
              { key: "placa_veiculo", label: "Placa Veículo" },
              { key: "min_colaboradores", label: "Mín Colaboradores" },
              { key: "max_colaboradores", label: "Máx Colaboradores" },
              { key: "colaboradores", label: "Colaboradores", format: (v) => Array.isArray(v) ? v.map((c: any) => c.colaborador?.nome).join(", ") : "" },
            ]}
            disabled={loading}
          />
          <Button 
            className="gap-2" 
            onClick={() => { setSelectedTecnico(null); setFormOpen(true); }}
            disabled={!podeEditar}
            title={!podeEditar ? "Você não tem permissão para criar equipes" : undefined}
          >
            <Plus className="h-4 w-4" />
            Nova Equipe
          </Button>
        </div>
      </div>

      {/* Barra de Ações em Massa */}
      {equipesSelecionadas.size > 0 && (
        <div className="rounded-xl border border-primary/50 bg-primary/5 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-semibold text-primary">
                  {equipesSelecionadas.size} equipe(s) selecionada(s)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={limparSelecao}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar seleção
              </Button>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">Alterar em massa:</span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => abrirEdicaoMassa("tipos")}
                disabled={!podeEditar}
                title="Alterar habilidades/tipos de serviço"
              >
                <Settings2 className="h-4 w-4 mr-1" />
                Tipos
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => abrirEdicaoMassa("jornada")}
                disabled={!podeEditar}
                title="Alterar horário de início da jornada"
              >
                <Clock className="h-4 w-4 mr-1" />
                Jornada
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => abrirEdicaoMassa("status")}
                disabled={!podeEditar}
                title="Alterar status (ativa/inativa)"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Status
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => abrirEdicaoMassa("supervisor")}
                disabled={!podeEditar}
                title="Alterar supervisor"
              >
                <User className="h-4 w-4 mr-1" />
                Supervisor
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => abrirEdicaoMassa("centroCusto")}
                disabled={!podeEditar}
                title="Alterar centro de custo"
              >
                Centro de Custo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Teams Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filteredEquipes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum técnico encontrado. Clique em "Nova Equipe" para cadastrar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[50px]">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={todasSelecionadas}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selecionarTodasVisiveis();
                          } else {
                            limparSelecao();
                          }
                        }}
                        title="Selecionar todas as equipes visíveis"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead className="w-[100px]">Jornada</TableHead>
                  <TableHead className="w-[180px]">Colaborador 1</TableHead>
                  <TableHead className="w-[180px]">Colaborador 2</TableHead>
                  <TableHead className="w-[180px]">Colaborador 3</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[150px]">Supervisor</TableHead>
                  <TableHead className="w-[140px]">Centro Custo</TableHead>
                  <TableHead>Habilidades</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipes.map((tecnico) => {
                  // Normalizar status para exibição
                  const normalizedStatus = tecnico.status === "offline" ? "offline" : "disponivel";
                  const config = statusConfig[normalizedStatus as keyof typeof statusConfig];
                  const horaInicio = (tecnico as any).hora_inicio || "07:30";
                  const isAtivo = normalizedStatus === "disponivel";

                  return (
                    <TableRow 
                      key={tecnico.id} 
                      className={cn("group", equipesSelecionadas.has(tecnico.id) && "bg-primary/5")}
                    >
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={equipesSelecionadas.has(tecnico.id)}
                            onCheckedChange={() => toggleSelecionarEquipe(tecnico.id)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                              {tecnico.codigo.slice(0, 2)}
                            </div>
                            <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card", config.dotColor)} />
                          </div>
                          <span>{tecnico.codigo}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TipoEquipeCell equipe={tecnico} />
                      </TableCell>
                      <TableCell>
                        {editingJornada === tecnico.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="time"
                              value={jornadaValue}
                              onChange={(e) => setJornadaValue(e.target.value)}
                              className="h-8 w-24 text-sm"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleSaveJornada(tecnico.id)}
                            >
                              <Check className="h-3 w-3 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setEditingJornada(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className={`flex items-center gap-1.5 p-1.5 rounded-md transition-colors ${podeEditar ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'}`}
                            onClick={() => {
                              if (!podeEditar) return;
                              setEditingJornada(tecnico.id);
                              setJornadaValue(horaInicio);
                            }}
                            title={podeEditar ? "Clique para editar" : "Você não tem permissão para editar"}
                          >
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{horaInicio}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ColaboradorCell equipe={tecnico} slotIndex={0} label="Líder" />
                      </TableCell>
                      <TableCell>
                        <ColaboradorCell equipe={tecnico} slotIndex={1} label="Membro" />
                      </TableCell>
                      <TableCell>
                        <ColaboradorCell equipe={tecnico} slotIndex={2} label="Membro" />
                      </TableCell>
                      <TableCell>
                        <div 
                          className={podeEditar ? "cursor-pointer" : "cursor-default"}
                          onClick={() => {
                            if (!podeEditar) return;
                            handleToggleStatus(tecnico.id, normalizedStatus);
                          }}
                          title={podeEditar ? "Clique para alternar status" : "Você não tem permissão para editar"}
                        >
                          <Badge 
                            variant={isAtivo ? "success" : "secondary"}
                            className={`gap-1 ${podeEditar ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
                          >
                            {isAtivo ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {config.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <SupervisorCell equipe={tecnico} />
                      </TableCell>
                      <TableCell>
                        <CentroCustoCell equipe={tecnico} />
                      </TableCell>
                      <TableCell>
                        {tecnico.habilidades && tecnico.habilidades.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tecnico.habilidades.slice(0, 2).map((hab) => (
                              <Badge key={hab} variant="outline" className="text-xs">
                                {hab}
                              </Badge>
                            ))}
                            {tecnico.habilidades.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{tecnico.habilidades.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleEdit(tecnico)}
                            title={podeEditar ? "Editar" : "Você não tem permissão para editar"}
                            disabled={!podeEditar}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleDuplicate(tecnico)}
                            title={podeEditar ? "Duplicar equipe" : "Você não tem permissão para duplicar"}
                            disabled={!podeEditar}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => { setTecnicoToDelete(tecnico); setDeleteDialogOpen(true); }}
                            title={podeEditar ? "Excluir" : "Você não tem permissão para excluir"}
                            disabled={!podeEditar}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <TecnicoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tecnico={selectedTecnico}
        onSuccess={fetchTecnicos}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir/Desativar Equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a equipe <strong>{tecnicoToDelete?.nome}</strong>?
              <br /><br />
              <span className="text-muted-foreground text-xs">
                • Se a equipe tiver OS concluídas, será apenas <strong>desativada</strong> (mantendo o histórico).
                <br />
                • Se não tiver OS concluídas, será <strong>excluída permanentemente</strong>.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Edição em Massa */}
      <Dialog open={editarMassaDialogOpen} onOpenChange={setEditarMassaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edição em Massa - {
                tipoEdicaoMassa === "tipos" ? "Habilidades/Tipos" :
                tipoEdicaoMassa === "jornada" ? "Jornada" :
                tipoEdicaoMassa === "status" ? "Status" :
                tipoEdicaoMassa === "supervisor" ? "Supervisor" :
                tipoEdicaoMassa === "centroCusto" ? "Centro de Custo" : ""
              }
            </DialogTitle>
            <DialogDescription>
              Aplicar alteração em {equipesSelecionadas.size} equipe(s) selecionada(s)
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Campo de acordo com o tipo de edição */}
            {tipoEdicaoMassa === "tipos" && (
              <div className="space-y-2">
                <Label htmlFor="habilidades-massa">Habilidades (separadas por vírgula)</Label>
                <Input
                  id="habilidades-massa"
                  placeholder="Ex: INSTALACAO, MANUTENCAO, REPARO"
                  value={valorEdicaoMassa}
                  onChange={(e) => setValorEdicaoMassa(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Digite as habilidades separadas por vírgula. Isso substituirá as habilidades existentes.
                </p>
              </div>
            )}
            
            {tipoEdicaoMassa === "jornada" && (
              <div className="space-y-2">
                <Label htmlFor="jornada-massa">Horário de Início</Label>
                <Input
                  id="jornada-massa"
                  type="time"
                  value={valorEdicaoMassa}
                  onChange={(e) => setValorEdicaoMassa(e.target.value)}
                />
              </div>
            )}
            
            {tipoEdicaoMassa === "status" && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={valorEdicaoMassa} onValueChange={setValorEdicaoMassa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponivel">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Ativa
                      </div>
                    </SelectItem>
                    <SelectItem value="offline">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        Inativa
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {tipoEdicaoMassa === "supervisor" && (
              <div className="space-y-2">
                <Label>Supervisor</Label>
                <Select value={valorEdicaoMassa} onValueChange={setValorEdicaoMassa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisores.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {tipoEdicaoMassa === "centroCusto" && (
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Select value={valorEdicaoMassa} onValueChange={setValorEdicaoMassa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">
                      <span className="text-muted-foreground">Nenhum</span>
                    </SelectItem>
                    {centrosCusto.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Lista das equipes que serão afetadas */}
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Equipes que serão alteradas:
              </p>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {Array.from(equipesSelecionadas).map(id => {
                  const eq = tecnicos.find(t => t.id === id);
                  return eq ? (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {eq.codigo}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditarMassaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={aplicarEdicaoMassa}
              disabled={!valorEdicaoMassa || salvandoMassa}
            >
              {salvandoMassa ? "Aplicando..." : `Aplicar em ${equipesSelecionadas.size} equipe(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Equipes;
