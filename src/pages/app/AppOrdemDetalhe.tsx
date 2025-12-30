import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { logApp } from "@/lib/logUtils";
import { usePageState } from "@/contexts/ScrollRestoreContext";
import { getAppParentRoute } from "@/lib/appNavigation";
import { useRetornoCampo } from "@/hooks/useRetornoCampo";
import RetornoCampoSelector from "@/components/app/RetornoCampoSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  User,
  Clock,
  Play,
  CheckCircle,
  Camera,
  Navigation,
  Package,
  Truck,
  AlertTriangle,
  Loader2,
  XCircle,
  ClipboardCheck,
  StopCircle,
  ChevronRight,
  List,
  Phone,
  Image,
  MessageSquare,
  Info,
  Flag,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Configuração de status simplificada
const statusConfig: Record<string, { 
  label: string; 
  color: string; 
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  pendente: { label: "Pendente", color: "bg-slate-500", bgColor: "bg-slate-50", textColor: "text-slate-700", borderColor: "border-slate-200" },
  planejada: { label: "Planejada", color: "bg-blue-500", bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-blue-200" },
  em_deslocamento: { label: "Em Deslocamento", color: "bg-orange-500", bgColor: "bg-orange-50", textColor: "text-orange-700", borderColor: "border-orange-200" },
  no_local: { label: "No Local", color: "bg-purple-500", bgColor: "bg-purple-50", textColor: "text-purple-700", borderColor: "border-purple-200" },
  em_andamento: { label: "Em Execução", color: "bg-blue-600", bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-blue-200" },
  em_execucao: { label: "Em Execução", color: "bg-blue-600", bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-blue-200" },
  pausada: { label: "Pausada", color: "bg-amber-500", bgColor: "bg-amber-50", textColor: "text-amber-700", borderColor: "border-amber-200" },
  concluida: { label: "Concluída", color: "bg-green-500", bgColor: "bg-green-50", textColor: "text-green-700", borderColor: "border-green-200" },
  cancelada: { label: "Cancelada", color: "bg-red-500", bgColor: "bg-red-50", textColor: "text-red-700", borderColor: "border-red-200" },
};

// Fluxo de status
const statusFlow: Record<string, string[]> = {
  pendente: ["em_deslocamento"],
  planejada: ["em_deslocamento"],
  em_deslocamento: ["no_local"],
  no_local: ["em_execucao"],
  em_andamento: ["concluida"],
  em_execucao: ["concluida"],
  pausada: ["em_execucao", "em_deslocamento"],
  concluida: [],
  cancelada: [],
};

// Labels para botões de ação
const actionLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  em_deslocamento: { label: "Iniciar Deslocamento", icon: Truck, color: "bg-orange-500 hover:bg-orange-600" },
  no_local: { label: "Cheguei no Local", icon: MapPin, color: "bg-purple-600 hover:bg-purple-700" },
  em_execucao: { label: "Iniciar Serviço", icon: Play, color: "bg-blue-600 hover:bg-blue-700" },
  concluida: { label: "Concluir Serviço", icon: CheckCircle, color: "bg-green-600 hover:bg-green-700" },
};

export default function AppOrdemDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [observacao, setObservacao] = useState("");
  const { getState, saveState } = usePageState<{
    observacao?: string;
  }>(`app-ordem-detalhe-${id || "sem-id"}`);

  const initialState = getState();
  useEffect(() => {
    if (initialState?.observacao && !observacao) {
      setObservacao(initialState.observacao);
    }
  }, []);

  useEffect(() => {
    saveState({ observacao });
  }, [observacao, saveState]);

  const navegarComEstado = (path: string) => {
    saveState({ observacao });
    navigate(path);
  };

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; status: string; title: string; description: string }>({
    open: false,
    status: "",
    title: "",
    description: "",
  });
  
  // Estados para Retorno de Campo
  const [retornoCampoOpen, setRetornoCampoOpen] = useState(false);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [retornoSelecionado, setRetornoSelecionado] = useState<{
    retorno_campo_id: string;
    retorno_codigo: string;
    retorno_descricao: string;
    gera_producao: boolean;
    atividades: Array<{
      atividade_id: string;
      quantidade: number;
      atividade: { id: string; codigo: string; descricao: string; valor_unitario: number; unidade: string };
      qtd_min_fotos: number;
    }>;
  } | null>(null);
  const [tentouIniciarSemApr, setTentouIniciarSemApr] = useState(false);
  const { buscarSkillId, registrarProducao, atualizarOrdemComRetorno } = useRetornoCampo();
  
  // Estado para diálogo de OS em andamento
  const [osEmAndamentoDialog, setOsEmAndamentoDialog] = useState<{
    open: boolean;
    os: { id: string; numero: string; tipo: string } | null;
  }>({ open: false, os: null });

  const handleBack = () => {
    saveState({ observacao });
    const parent = getAppParentRoute(location.pathname);
    navigate(parent || "/app");
  };

  // Buscar ordem
  const { data: ordem, isLoading } = useQuery({
    queryKey: ["ordem-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Buscar produção (valor produzido)
  const { data: producao } = useQuery({
    queryKey: ["ordem-producao", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_equipes")
        .select("valor_total")
        .eq("ordem_servico_id", id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!id,
  });

  // Buscar skills
  const { data: skillsData } = useQuery({
    queryKey: ["skills-app-detalhe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("codigo, nome")
        .eq("ativo", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const getTipoNome = (tipo: string | null | undefined): string => {
    if (!tipo) return "";
    if (!skillsData) return tipo;
    const skill = skillsData.find((s: { codigo: string; nome: string }) => 
      s.codigo?.toLowerCase() === tipo.toLowerCase()
    );
    return skill?.nome || tipo;
  };

  // Buscar planejamento
  const { data: planejamento } = useQuery({
    queryKey: ["ordem-planejamento", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("planejamento_ordens")
        .select("ordem_na_rota, hora_inicio_estimada, distancia_km")
        .eq("ordem_servico_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Buscar anexos
  const { data: anexos } = useQuery({
    queryKey: ["ordem-anexos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordem_anexos")
        .select("*")
        .eq("ordem_servico_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Buscar intervalo ativo (para bloquear início de serviço durante intervalo)
  const { data: intervaloAtivo } = useQuery({
    queryKey: ["intervalo-ativo-bloqueio", equipe?.id || equipeAuth?.id],
    queryFn: async () => {
      const equipeId = equipe?.id || equipeAuth?.id;
      if (!equipeId) return null;
      
      const { data, error } = await supabase
        .from("intervalos_equipe")
        .select(`*, tipo_intervalo:tipo_intervalo_id (nome)`)
        .eq("equipe_id", equipeId)
        .is("hora_fim", null)
        .order("hora_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") return null;
      return data;
    },
    enabled: !!(equipe?.id || equipeAuth?.id),
    refetchInterval: 10000,
  });

  // Buscar se há OUTRA OS em andamento (diferente da atual) - para bloquear início de múltiplas OS
  const { data: outraOsEmAndamento } = useQuery({
    queryKey: ["outra-os-em-andamento", equipe?.id || equipeAuth?.id, id],
    queryFn: async () => {
      const equipeId = equipe?.id || equipeAuth?.id;
      if (!equipeId) return null;
      
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          ordem_servico_id,
          ordens_servico:ordem_servico_id (id, numero, tipo, status)
        `)
        .eq("equipe_id", equipeId)
        .neq("ordem_servico_id", id) // Excluir a OS atual
        .in("ordens_servico.status", ["em_deslocamento", "no_local", "em_andamento", "em_execucao"]);
      
      if (error) return null;
      
      // Filtrar apenas as que realmente estão em andamento
      const osAtivas = data?.filter(d => d.ordens_servico?.status) || [];
      return osAtivas.length > 0 ? osAtivas[0].ordens_servico : null;
    },
    enabled: !!(equipe?.id || equipeAuth?.id) && !!id,
    refetchInterval: 10000,
  });

  // Buscar checklists/APRs
  const { data: checklistsPreenchidos } = useQuery({
    queryKey: ["ordem-checklists", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("checklist_respostas")
        .select(`id, checklist_id, checklists:checklist_id (id, nome, tipo)`)
        .eq("ordem_servico_id", id);
      return data || [];
    },
    enabled: !!id,
  });

  const temAprPreenchida = checklistsPreenchidos?.some(
    (c: any) => c.checklists?.tipo === "apr" || c.checklists?.nome?.toLowerCase().includes("apr")
  ) || false;

  // Buscar próxima OS
  const { data: proximaOS } = useQuery({
    queryKey: ["proxima-os", id, planejamento?.ordem_na_rota],
    queryFn: async () => {
      const equipeId = equipe?.id || equipeAuth?.id;
      if (!equipeId || !planejamento?.ordem_na_rota) return null;
      const { data } = await supabase
        .from("planejamento_ordens")
        .select(`ordem_na_rota, ordens_servico:ordem_servico_id (id, numero, tipo, status)`)
        .eq("equipe_id", equipeId)
        .gt("ordem_na_rota", planejamento.ordem_na_rota)
        .order("ordem_na_rota", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.ordens_servico && !["concluida", "cancelada"].includes(data.ordens_servico.status)) {
        return data;
      }
      return null;
    },
    enabled: !!planejamento?.ordem_na_rota && !!(equipe?.id || equipeAuth?.id),
  });

  // Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`ordem-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ordens_servico", filter: `id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ["ordem-detalhe", id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { status: newStatus, updated_at: now };
      let acaoDescricao = "";

      if (newStatus === "em_deslocamento") {
        updates.deslocamento_iniciado_at = now;
        acaoDescricao = "Deslocamento iniciado";
      } else if (newStatus === "no_local") {
        updates.chegada_local_at = now;
        acaoDescricao = "Chegou no local";
      } else if (newStatus === "em_execucao" || newStatus === "em_andamento") {
        if (!ordem?.iniciado_at) updates.iniciado_at = now;
        updates.execucao_iniciada_at = now;
        acaoDescricao = "Serviço iniciado";
      } else if (newStatus === "concluida") {
        updates.concluido_at = now;
        acaoDescricao = "Serviço concluído";
        if (ordem?.deslocamento_iniciado_at) {
          updates.tempo_total_minutos = Math.round((new Date().getTime() - new Date(ordem.deslocamento_iniciado_at).getTime()) / 60000);
        }
        if (ordem?.execucao_iniciada_at) {
          updates.tempo_execucao_minutos = Math.round((new Date().getTime() - new Date(ordem.execucao_iniciada_at).getTime()) / 60000);
        }
      }

      if (observacao.trim()) {
        const novaObs = `[${format(new Date(), "dd/MM HH:mm")} - ${acaoDescricao}] ${observacao}`;
        const obsEquipeAtual = (ordem as any)?.observacoes_equipe || "";
        (updates as any).observacoes_equipe = obsEquipeAtual ? `${obsEquipeAtual}\n\n${novaObs}` : novaObs;
      }

      const { error } = await supabase.from("ordens_servico").update(updates).eq("id", id);
      if (error) throw error;

      const equipeId = equipe?.id || equipeAuth?.id;
      if (equipeId) {
        await supabase.from("planejamento_logs").insert({
          ordem_servico_id: id,
          acao: `status_${newStatus}`,
          descricao: `${acaoDescricao}${observacao ? `: ${observacao}` : ""}`,
          dados_anteriores: { status: ordem?.status },
          dados_novos: { status: newStatus, timestamp: now },
          created_by: equipeId,
        });
        logApp("editar", "ordens", "ordens_servico", id || "",
          { id: equipeId, nome: equipe?.codigo || equipeAuth?.codigo || "", equipeId },
          { status: ordem?.status }, { status: newStatus, timestamp: now },
          `Alterou OS ${ordem?.numero || id} para ${statusConfig[newStatus]?.label || newStatus}`
        );
      }
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["ordem-detalhe", id] });
      queryClient.invalidateQueries({ queryKey: ["ordens-planejadas"] });
      queryClient.invalidateQueries({ queryKey: ["ordem-historico", id] });
      queryClient.invalidateQueries({ queryKey: ["ordem-producao", id] });
      setObservacao("");
      setConfirmDialog({ open: false, status: "", title: "", description: "" });
      toast.success(statusConfig[newStatus]?.label || "Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  // Upload de foto
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("service-attachments").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("service-attachments").getPublicUrl(fileName);
      const { error: insertError } = await supabase.from("ordem_anexos").insert({
        ordem_servico_id: id,
        tipo: "foto",
        url: urlData.publicUrl,
        descricao: `Foto - ${format(new Date(), "dd/MM HH:mm")}`,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordem-anexos", id] });
      toast.success("Foto enviada!");
    },
    onError: () => toast.error("Erro ao enviar foto"),
  });

  // Deletar foto
  const deleteFotoMutation = useMutation({
    mutationFn: async (anexoId: string) => {
      const { error } = await supabase.from("ordem_anexos").delete().eq("id", anexoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordem-anexos", id] });
      toast.success("Foto removida!");
    },
    onError: () => toast.error("Erro ao remover foto"),
  });

  const handleDeleteFoto = (anexoId: string) => {
    if (window.confirm("Deseja remover esta foto?")) {
      deleteFotoMutation.mutate(anexoId);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const openNavigation = () => {
    // Usar geo: intent para abrir o seletor de apps de navegação
    if (ordem?.latitude && ordem?.longitude) {
      // geo: URI scheme abre o seletor de apps de navegação no mobile
      const geoUri = `geo:${ordem.latitude},${ordem.longitude}?q=${ordem.latitude},${ordem.longitude}`;
      window.location.href = geoUri;
    } else if (ordem?.endereco) {
      // Para endereço, usar geo: com query
      const geoUri = `geo:0,0?q=${encodeURIComponent(ordem.endereco)}`;
      window.location.href = geoUri;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    // Verificar se há intervalo em andamento (bloqueia início de deslocamento e serviço)
    if (intervaloAtivo && (newStatus === "em_deslocamento" || newStatus === "em_execucao")) {
      const nomeIntervalo = intervaloAtivo.tipo_intervalo?.nome || "Intervalo";
      toast.error(`Finalize o intervalo "${nomeIntervalo}" antes de continuar!`, { duration: 4000 });
      return;
    }

    // Verificar se há outra OS em andamento (impede iniciar múltiplas OS)
    if (outraOsEmAndamento && newStatus === "em_deslocamento") {
      setOsEmAndamentoDialog({
        open: true,
        os: {
          id: outraOsEmAndamento.id,
          numero: outraOsEmAndamento.numero,
          tipo: outraOsEmAndamento.tipo,
        },
      });
      return;
    }

    if (newStatus === "em_execucao" && !temAprPreenchida) {
      setTentouIniciarSemApr(true);
      toast.error("Preencha a APR antes de iniciar!", { duration: 4000 });
      return;
    }
    
    if (newStatus === "concluida") {
      if (retornoSelecionado) {
        const qtdFotosExigidas = retornoSelecionado.atividades.reduce((t, a) => t + (a.qtd_min_fotos || 0), 0);
        const qtdFotosAnexadas = anexos?.filter(a => a.tipo === "foto").length || 0;
        if (qtdFotosExigidas > 0 && qtdFotosAnexadas < qtdFotosExigidas) {
          toast.error(`Faltam ${qtdFotosExigidas - qtdFotosAnexadas} foto(s)!`);
          return;
        }
        const equipeId = equipe?.id || equipeAuth?.id;
        if (equipeId && ordem?.id) {
          await registrarProducao(ordem.id, equipeId, retornoSelecionado);
          await atualizarOrdemComRetorno(ordem.id, retornoSelecionado);
          setRetornoSelecionado(null);
          updateStatusMutation.mutate("concluida");
        }
        return;
      }
      
      if (ordem?.tipo) {
        const foundSkillId = await buscarSkillId(ordem.tipo);
        if (foundSkillId) {
          setSkillId(foundSkillId);
          setRetornoCampoOpen(true);
          return;
        }
      }
      
      setConfirmDialog({
        open: true,
        status: newStatus,
        title: "Concluir Serviço",
        description: "Confirma a conclusão deste serviço?",
      });
    } else {
      updateStatusMutation.mutate(newStatus);
    }
  };

  const handleRetornoCampoConfirm = async (result: any) => {
    const equipeId = equipe?.id || equipeAuth?.id;
    if (!equipeId || !ordem?.id) {
      toast.error("Erro ao identificar equipe");
      return;
    }
    const qtdFotosExigidas = result.atividades.reduce((t: number, a: any) => t + (a.qtd_min_fotos || 0), 0);
    const qtdFotosAnexadas = anexos?.filter(a => a.tipo === "foto").length || 0;
    if (qtdFotosExigidas > 0 && qtdFotosAnexadas < qtdFotosExigidas) {
      setRetornoSelecionado(result);
      toast.error(`Adicione ${qtdFotosExigidas - qtdFotosAnexadas} foto(s) para continuar`);
      setRetornoCampoOpen(false);
      return;
    }
    await registrarProducao(ordem.id, equipeId, result);
    await atualizarOrdemComRetorno(ordem.id, result);
    updateStatusMutation.mutate("concluida");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  if (!ordem) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Ordem não encontrada</p>
        </div>
      </div>
    );
  }

  const status = ordem.status as keyof typeof statusConfig;
  const config = statusConfig[status] || statusConfig.pendente;
  const nextStatuses = statusFlow[status] || [];
  const primaryAction = nextStatuses[0];
  const actionConfig = primaryAction ? actionLabels[primaryAction] : null;
  const ActionIcon = actionConfig?.icon || Play;
  const qtdFotos = anexos?.filter(a => a.tipo === "foto").length || 0;
  const isActive = !["concluida", "cancelada"].includes(status);

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      {/* Header Compacto */}
      <div className={`${config.bgColor} ${config.borderColor} border-b`}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0 -ml-2 h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{ordem.numero}</span>
                {ordem.regulada && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0.5">URGENTE</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{getTipoNome(ordem.tipo)}</p>
            </div>

            <div className={`${config.color} text-white px-3 py-1.5 rounded-full text-xs font-medium`}>
              {config.label}
            </div>
          </div>

          {/* Info rápida */}
          {planejamento && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground ml-10">
              <span className="font-bold text-foreground">#{planejamento.ordem_na_rota}</span>
              {planejamento.hora_inicio_estimada && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {planejamento.hora_inicio_estimada}
                </span>
              )}
              {planejamento.distancia_km && planejamento.distancia_km > 0 && (
                <span>{planejamento.distancia_km.toFixed(1)}km</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Card Endereço + Navegação */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-snug">{ordem.endereco}</p>
              {ordem.cliente_nome && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {ordem.cliente_nome}
                </p>
              )}
            </div>
          </div>
          <Button className="w-full mt-3 h-11 bg-blue-600 hover:bg-blue-700 text-base font-medium" onClick={openNavigation}>
            <Navigation className="h-5 w-5 mr-2" />
            Navegar
          </Button>
        </div>

        {/* Botões de Ação Secundários */}
        {isActive && (
          <div className="flex gap-2">
            {/* Fotos */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-emerald-600" />
              )}
              <span className="text-xs mt-1 font-medium">Fotos {qtdFotos > 0 && `(${qtdFotos})`}</span>
            </button>

            {/* APR */}
            <button
              onClick={() => {
                setTentouIniciarSemApr(false);
                navegarComEstado(`/app/ordens/${id}/apr`);
              }}
              className={`flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm ${
                tentouIniciarSemApr && !temAprPreenchida ? "ring-2 ring-red-500" : ""
              }`}
            >
              <ClipboardCheck className={`h-6 w-6 ${temAprPreenchida ? "text-green-600" : "text-violet-600"}`} />
              <span className="text-xs mt-1 font-medium">APR {temAprPreenchida && "✓"}</span>
            </button>

            {/* Encerrar OS */}
            <button
              onClick={async () => {
                if (ordem?.tipo) {
                  const foundSkillId = await buscarSkillId(ordem.tipo);
                  if (foundSkillId) {
                    setSkillId(foundSkillId);
                    setRetornoCampoOpen(true);
                  } else {
                    toast.error("Nenhum retorno configurado");
                  }
                }
              }}
              className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm"
            >
              <StopCircle className="h-6 w-6 text-red-500" />
              <span className="text-xs mt-1 font-medium">Encerrar</span>
            </button>
          </div>
        )}

        {/* Linha extra de botões se necessário */}
        {isActive && (status === "em_andamento" || status === "em_execucao" || status === "no_local" || ordem.cliente_telefone) && (
          <div className="flex gap-2">
            {/* Materiais */}
            {(status === "em_andamento" || status === "em_execucao" || status === "no_local") && (
              <button
                onClick={() => navegarComEstado(`/app/ordens/${id}/materiais`)}
                className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm"
              >
                <Package className="h-6 w-6 text-teal-600" />
                <span className="text-xs mt-1 font-medium">Materiais</span>
              </button>
            )}

            {/* Ligar Cliente */}
            {ordem.cliente_telefone && (
              <a
                href={`tel:${ordem.cliente_telefone}`}
                className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm"
              >
                <Phone className="h-6 w-6 text-blue-500" />
                <span className="text-xs mt-1 font-medium">Ligar</span>
              </a>
            )}
          </div>
        )}

        {/* Retorno Selecionado (Pendente por fotos) */}
        {retornoSelecionado && isActive && (
          <div
            onClick={async () => {
              if (ordem?.tipo) {
                const foundSkillId = await buscarSkillId(ordem.tipo);
                if (foundSkillId) {
                  setSkillId(foundSkillId);
                  setRetornoCampoOpen(true);
                }
              }
            }}
            className="bg-amber-50 border border-amber-300 rounded-xl p-3 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flag className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900 text-sm">{retornoSelecionado.retorno_descricao}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Fotos: {qtdFotos}/{retornoSelecionado.atividades.reduce((t, a) => t + (a.qtd_min_fotos || 0), 0)}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        )}

        {/* Observações */}
        {isActive && (
          <div className="bg-white rounded-xl border p-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Observações</span>
            </div>
            <Textarea
              placeholder="Adicione observações..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="resize-none border-0 p-0 focus-visible:ring-0 text-sm min-h-[40px]"
            />
          </div>
        )}

        {/* Accordion com Detalhes */}
        <Accordion type="single" collapsible className="bg-white rounded-xl border overflow-hidden">
          <AccordionItem value="detalhes" className="border-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Detalhes do Serviço</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2 text-sm">
                {ordem.instalacao && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Instalação</span>
                    <span className="font-mono">{ordem.instalacao}</span>
                  </div>
                )}
                {ordem.medidor && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Medidor</span>
                    <span className="font-mono">{ordem.medidor}</span>
                  </div>
                )}
                {ordem.prazo && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Prazo</span>
                    <span className={ordem.regulada ? "text-red-600 font-medium" : ""}>
                      {format(new Date(ordem.prazo), "dd/MM/yy HH:mm")}
                    </span>
                  </div>
                )}
                {ordem.valor && ordem.valor > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Valor Prev.</span>
                    <span className="font-medium text-blue-600">R$ {ordem.valor.toFixed(2)}</span>
                  </div>
                )}
                {status === "concluida" && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Valor Prod.</span>
                    <span className="font-medium text-green-600">
                      R$ {(producao?.valor_total || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {ordem.observacoes && (
                  <div className="pt-2">
                    <p className="text-xs text-blue-600 font-medium">Obs. Coelba:</p>
                    <p className="text-xs bg-blue-50 p-2 rounded mt-1">{ordem.observacoes}</p>
                  </div>
                )}
                {(ordem as any).observacoes_equipe && (
                  <div className="pt-2">
                    <p className="text-xs text-emerald-600 font-medium">Obs. Equipe:</p>
                    <p className="text-xs bg-emerald-50 p-2 rounded mt-1">{(ordem as any).observacoes_equipe}</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Fotos */}
        {qtdFotos > 0 && (
          <div id="fotos-section" className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Fotos ({qtdFotos})</span>
              </div>
              {isActive && (
                <Badge variant="destructive" className="text-xs">Toque no X para excluir</Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {anexos?.filter(a => a.tipo === "foto").map((anexo) => (
                <div key={anexo.id} className="relative p-1">
                  <img
                    src={anexo.url}
                    alt=""
                    className="w-full aspect-square object-cover rounded-lg cursor-pointer border-2 border-gray-200"
                    onClick={() => window.open(anexo.url, "_blank")}
                  />
                  {isActive && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFoto(anexo.id);
                      }}
                      disabled={deleteFotoMutation.isPending}
                      className="absolute -top-1 -right-1 h-7 w-7 rounded-full shadow-lg"
                    >
                      {deleteFotoMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Concluído */}
        {status === "concluida" && (
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-center">
            <CheckCircle className="h-14 w-14 mx-auto mb-3 text-white" />
            <p className="font-bold text-xl text-white">Concluído! 🎉</p>
            {ordem.concluido_at && (
              <p className="text-sm text-white/90 mt-2">
                {format(new Date(ordem.concluido_at), "dd/MM 'às' HH:mm")}
              </p>
            )}
            
            <div className="mt-4 space-y-3">
              {proximaOS?.ordens_servico && (
                <Button
                  className="w-full h-12 bg-white text-green-700 hover:bg-green-50 text-base font-semibold"
                  onClick={() => navegarComEstado(`/app/ordens/${proximaOS.ordens_servico.id}`)}
                >
                  <ChevronRight className="h-5 w-5 mr-2" />
                  Próximo Serviço
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full h-11 text-sm font-semibold shadow-lg"
                style={{ 
                  backgroundColor: '#ffffff', 
                  color: '#065f46', 
                  borderColor: '#10b981',
                  borderWidth: '2px'
                }}
                onClick={() => navegarComEstado("/app/ordens")}
              >
                <List className="h-5 w-5 mr-2" />
                Ver Todas as OSs
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Botão de Ação Principal Fixo - ACIMA DA NAVEGAÇÃO */}
      {primaryAction && actionConfig && (
        <div className="fixed bottom-[70px] left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pt-6">
          <Button
            className={`w-full h-14 text-base font-bold rounded-xl shadow-lg ${actionConfig.color}`}
            onClick={() => handleStatusChange(primaryAction)}
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? (
              <Loader2 className="h-6 w-6 mr-2 animate-spin" />
            ) : (
              <ActionIcon className="h-6 w-6 mr-2" />
            )}
            {actionConfig.label}
          </Button>
        </div>
      )}

      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Dialog de Confirmação */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateStatusMutation.mutate(confirmDialog.status)}
              className="bg-green-600 hover:bg-green-700"
            >
              {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Seletor de Retorno de Campo */}
      {skillId && (
        <RetornoCampoSelector
          open={retornoCampoOpen}
          onOpenChange={setRetornoCampoOpen}
          skillId={skillId}
          onConfirm={handleRetornoCampoConfirm}
        />
      )}

      {/* Dialog de OS em Andamento */}
      <Dialog 
        open={osEmAndamentoDialog.open} 
        onOpenChange={(open) => setOsEmAndamentoDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <DialogTitle className="text-lg">OS já em andamento</DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Você já possui uma Ordem de Serviço em andamento. 
                  Finalize o preenchimento dela antes de iniciar uma nova.
                </p>
                
                {osEmAndamentoDialog.os && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="font-semibold text-amber-900">
                      OS {osEmAndamentoDialog.os.numero}
                    </p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      {osEmAndamentoDialog.os.tipo}
                    </p>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setOsEmAndamentoDialog({ open: false, os: null })}
              className="flex-1"
            >
              Fechar
            </Button>
            <Button 
              onClick={() => {
                if (osEmAndamentoDialog.os) {
                  setOsEmAndamentoDialog({ open: false, os: null });
                  navigate(`/app/ordens/${osEmAndamentoDialog.os.id}`);
                }
              }}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Ir para OS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
