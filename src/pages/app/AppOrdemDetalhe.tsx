import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  User,
  Phone,
  Clock,
  Play,
  Pause,
  CheckCircle,
  Camera,
  Navigation,
  FileText,
  Package,
  Truck,
  AlertTriangle,
  Timer,
  Calendar,
  History,
  ChevronDown,
  ChevronUp,
  Loader2,
  XCircle,
  ClipboardCheck,
  StopCircle,
  ChevronRight,
  List,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Configuração de status
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ElementType; color: string; bgColor: string }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: Clock, color: "text-gray-600", bgColor: "bg-gray-100" },
  planejada: { label: "Planejada", variant: "secondary", icon: Calendar, color: "text-blue-600", bgColor: "bg-blue-100" },
  em_deslocamento: { label: "Em Deslocamento", variant: "default", icon: Truck, color: "text-orange-600", bgColor: "bg-orange-100" },
  no_local: { label: "No Local", variant: "default", icon: MapPin, color: "text-purple-600", bgColor: "bg-purple-100" },
  em_andamento: { label: "Em Execução", variant: "default", icon: Play, color: "text-blue-600", bgColor: "bg-blue-100" },
  em_execucao: { label: "Em Execução", variant: "default", icon: Play, color: "text-blue-600", bgColor: "bg-blue-100" },
  pausada: { label: "Pausada", variant: "outline", icon: Pause, color: "text-amber-600", bgColor: "bg-amber-100" },
  concluida: { label: "Concluída", variant: "outline", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100" },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },
};

// Fluxo de status permitidos - Novo fluxo com etapas claras
// Iniciar Deslocamento -> Concluir Deslocamento (chegar no local) -> Iniciar Serviço -> Concluir Serviço
const statusFlow: Record<string, string[]> = {
  pendente: ["em_deslocamento"],
  planejada: ["em_deslocamento"],
  em_deslocamento: ["no_local", "pausada"], // Chegar no local
  no_local: ["em_execucao", "pausada"], // Iniciar execução
  em_andamento: ["concluida", "pausada"],
  em_execucao: ["concluida", "pausada"],
  pausada: ["em_execucao", "em_deslocamento"],
  concluida: [],
  cancelada: [],
};

// Função para formatar minutos de forma legível
const formatarTempo = (minutos: number | null | undefined): string => {
  if (!minutos || minutos <= 0) return "-";
  
  // Se o valor for muito alto (provavelmente está em segundos), converter
  let mins = minutos;
  if (mins > 1000) {
    mins = Math.round(mins / 60); // Converter de segundos para minutos
  }
  
  if (mins < 60) {
    return `${mins}min`;
  }
  
  const horas = Math.floor(mins / 60);
  const minutosRestantes = mins % 60;
  
  if (minutosRestantes === 0) {
    return `${horas}h`;
  }
  
  return `${horas}h ${minutosRestantes}min`;
};

export default function AppOrdemDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [observacao, setObservacao] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; status: string; title: string; description: string }>({
    open: false,
    status: "",
    title: "",
    description: "",
  });

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

  // Buscar dados do planejamento
  const { data: planejamento } = useQuery({
    queryKey: ["ordem-planejamento", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          ordem_na_rota,
          hora_inicio_estimada,
          hora_fim_estimada,
          distancia_km,
          tempo_estimado_minutos
        `)
        .eq("ordem_servico_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar planejamento:", error);
        return null;
      }
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

  // Buscar histórico/timeline
  const { data: historico } = useQuery({
    queryKey: ["ordem-historico", id],
    queryFn: async () => {
      // Buscar logs do planejamento
      const { data: logs, error } = await supabase
        .from("planejamento_logs")
        .select("*")
        .eq("ordem_servico_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar histórico:", error);
        return [];
      }
      return logs || [];
    },
    enabled: !!id,
  });

  // Buscar próxima OS na rota
  const { data: proximaOS } = useQuery({
    queryKey: ["proxima-os", id, planejamento?.ordem_na_rota],
    queryFn: async () => {
      const equipeId = equipe?.id || equipeAuth?.id;
      if (!equipeId || !planejamento?.ordem_na_rota) return null;

      // Buscar a próxima OS na rota (ordem_na_rota + 1)
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          ordem_na_rota,
          ordens_servico:ordem_servico_id (
            id,
            numero,
            tipo,
            endereco,
            status
          )
        `)
        .eq("equipe_id", equipeId)
        .gt("ordem_na_rota", planejamento.ordem_na_rota)
        .order("ordem_na_rota", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar próxima OS:", error);
        return null;
      }
      
      // Verificar se a próxima OS não está concluída
      if (data?.ordens_servico && data.ordens_servico.status !== "concluida" && data.ordens_servico.status !== "cancelada") {
        return data;
      }
      
      return null;
    },
    enabled: !!planejamento?.ordem_na_rota && !!(equipe?.id || equipeAuth?.id),
  });

  // Realtime subscription
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`ordem-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ordens_servico",
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ordem-detalhe", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { 
        status: newStatus,
        updated_at: now,
      };

      // Descrição da ação para o log
      let acaoDescricao = "";

      // Registrar timestamps específicos para cada etapa
      if (newStatus === "em_deslocamento") {
        updates.deslocamento_iniciado_at = now;
        acaoDescricao = "Deslocamento iniciado";
      } else if (newStatus === "no_local") {
        updates.chegada_local_at = now;
        acaoDescricao = "Chegou no local";
      } else if (newStatus === "em_execucao" || newStatus === "em_andamento") {
        if (!ordem?.iniciado_at) {
          updates.iniciado_at = now;
        }
        updates.execucao_iniciada_at = now;
        acaoDescricao = "Serviço iniciado";
      } else if (newStatus === "pausada") {
        updates.pausado_at = now;
        acaoDescricao = "Serviço pausado";
      } else if (newStatus === "concluida") {
        updates.concluido_at = now;
        acaoDescricao = "Serviço concluído";
        
        // Calcular tempo total desde o início do deslocamento
        const inicioDeslocamento = ordem?.deslocamento_iniciado_at;
        if (inicioDeslocamento) {
          const inicio = new Date(inicioDeslocamento);
          const fim = new Date();
          updates.tempo_total_minutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);
        }
        
        // Calcular tempo de execução (desde o início do serviço)
        const inicioExecucao = ordem?.execucao_iniciada_at || ordem?.iniciado_at;
        if (inicioExecucao) {
          const inicio = new Date(inicioExecucao);
          const fim = new Date();
          updates.tempo_execucao_minutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);
        }
      }

      // Adicionar observação se houver
      if (observacao.trim()) {
        const novaObs = `[${format(new Date(), "dd/MM HH:mm")} - ${acaoDescricao || statusConfig[newStatus]?.label || newStatus}] ${observacao}`;
        updates.observacoes = ordem?.observacoes
          ? `${ordem.observacoes}\n\n${novaObs}`
          : novaObs;
      }

      const { error } = await supabase
        .from("ordens_servico")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      // Registrar no log
      const equipeId = equipe?.id || equipeAuth?.id;
      if (equipeId) {
        await supabase.from("planejamento_logs").insert({
          ordem_servico_id: id,
          acao: `status_${newStatus}`,
          descricao: `${acaoDescricao || statusConfig[newStatus]?.label || newStatus}${observacao ? `: ${observacao}` : ""}`,
          dados_anteriores: { status: ordem?.status },
          dados_novos: { status: newStatus, timestamp: now },
          created_by: equipeId,
        });
      }
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["ordem-detalhe", id] });
      queryClient.invalidateQueries({ queryKey: ["ordens-planejadas"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-planejadas-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["ordem-historico", id] });
      setObservacao("");
      setConfirmDialog({ open: false, status: "", title: "", description: "" });

      const config = statusConfig[newStatus];
      toast.success(config?.label ? `${config.label}!` : "Status atualizado");
    },
    onError: (error) => {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  // Mutation para upload de foto
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("service-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("service-attachments")
        .getPublicUrl(fileName);

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
    onError: () => {
      toast.error("Erro ao enviar foto");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const openNavigation = () => {
    if (ordem?.latitude && ordem?.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${ordem.latitude},${ordem.longitude}`,
        "_blank"
      );
    } else if (ordem?.endereco) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ordem.endereco)}`,
        "_blank"
      );
    }
  };

  const handleStatusChange = (newStatus: string) => {
    const config = statusConfig[newStatus];
    
    if (newStatus === "concluida") {
      setConfirmDialog({
        open: true,
        status: newStatus,
        title: "Concluir Serviço",
        description: "Tem certeza que deseja concluir este serviço? Esta ação não pode ser desfeita.",
      });
    } else {
      updateStatusMutation.mutate(newStatus);
    }
  };

  if (isLoading) {
    return (
      <div className="pb-6">
        <div className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1">
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!ordem) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
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
  const StatusIcon = config.icon;
  const nextStatuses = statusFlow[status] || [];

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm">{ordem.numero}</span>
              <Badge variant={config.variant} className="flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />
                {config.label}
              </Badge>
              {ordem.regulada && (
                <Badge variant="destructive" className="text-xs">URGENTE</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{ordem.tipo}</p>
          </div>
        </div>
        
        {/* Info do planejamento */}
        {planejamento && (
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">#{planejamento.ordem_na_rota}</Badge>
            </span>
            {planejamento.hora_inicio_estimada && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ETA: {planejamento.hora_inicio_estimada}
              </span>
            )}
            {ordem?.duracao_estimada && ordem.duracao_estimada > 0 && (
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                ~{formatarTempo(ordem.duracao_estimada)}
              </span>
            )}
            {planejamento.distancia_km && planejamento.distancia_km > 0 && (
              <span className="flex items-center gap-1">
                <Navigation className="h-3 w-3" />
                {planejamento.distancia_km.toFixed(1)}km
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Endereço e Navegação */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
                <MapPin className={`h-5 w-5 ${config.color}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium">{ordem.endereco}</p>
                {ordem.cliente_nome && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {ordem.cliente_nome}
                  </p>
                )}
              </div>
            </div>
            <Button className="w-full mt-3" variant="outline" onClick={openNavigation}>
              <Navigation className="h-4 w-4 mr-2" />
              Navegar até o local
            </Button>
          </CardContent>
        </Card>

        {/* Etapas do Serviço */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Etapas do Serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Etapa 1: Deslocamento */}
            <div className={`flex items-center justify-between p-2 rounded-lg ${ordem.deslocamento_iniciado_at ? 'bg-green-50 dark:bg-green-950' : 'bg-muted/50'}`}>
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${ordem.deslocamento_iniciado_at ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  <Truck className="h-3 w-3" />
                </div>
                <span className="text-sm">Deslocamento Iniciado</span>
              </div>
              {ordem.deslocamento_iniciado_at ? (
                <span className="text-xs text-green-600 font-medium">
                  {format(new Date(ordem.deslocamento_iniciado_at), "HH:mm")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Pendente</span>
              )}
            </div>

            {/* Etapa 2: Chegada no Local */}
            <div className={`flex items-center justify-between p-2 rounded-lg ${ordem.chegada_local_at ? 'bg-green-50 dark:bg-green-950' : 'bg-muted/50'}`}>
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${ordem.chegada_local_at ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  <MapPin className="h-3 w-3" />
                </div>
                <span className="text-sm">Chegada no Local</span>
              </div>
              {ordem.chegada_local_at ? (
                <span className="text-xs text-green-600 font-medium">
                  {format(new Date(ordem.chegada_local_at), "HH:mm")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Pendente</span>
              )}
            </div>

            {/* Etapa 3: Serviço Iniciado */}
            <div className={`flex items-center justify-between p-2 rounded-lg ${ordem.execucao_iniciada_at ? 'bg-green-50 dark:bg-green-950' : 'bg-muted/50'}`}>
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${ordem.execucao_iniciada_at ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  <Play className="h-3 w-3" />
                </div>
                <span className="text-sm">Serviço Iniciado</span>
              </div>
              {ordem.execucao_iniciada_at ? (
                <span className="text-xs text-green-600 font-medium">
                  {format(new Date(ordem.execucao_iniciada_at), "HH:mm")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Pendente</span>
              )}
            </div>

            {/* Etapa 4: Serviço Concluído */}
            <div className={`flex items-center justify-between p-2 rounded-lg ${ordem.concluido_at ? 'bg-green-50 dark:bg-green-950' : 'bg-muted/50'}`}>
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${ordem.concluido_at ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  <CheckCircle className="h-3 w-3" />
                </div>
                <span className="text-sm">Serviço Concluído</span>
              </div>
              {ordem.concluido_at ? (
                <span className="text-xs text-green-600 font-medium">
                  {format(new Date(ordem.concluido_at), "HH:mm")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Pendente</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detalhes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Detalhes do Serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {ordem.instalacao && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Instalação:</span>
                <span className="font-mono">{ordem.instalacao}</span>
              </div>
            )}
            {ordem.medidor && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Medidor:</span>
                <span className="font-mono">{ordem.medidor}</span>
              </div>
            )}
            {ordem.duracao_estimada && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duração estimada:</span>
                <span>{ordem.duracao_estimada} min</span>
              </div>
            )}
            {ordem.prazo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prazo:</span>
                <span className={ordem.regulada ? "text-red-600 font-medium" : ""}>
                  {format(new Date(ordem.prazo), "dd/MM/yyyy HH:mm")}
                </span>
              </div>
            )}
            {ordem.valor && ordem.valor > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-medium text-green-600">
                  R$ {ordem.valor.toFixed(2)}
                </span>
              </div>
            )}
            {ordem.observacoes && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground mb-1">Observações:</p>
                <p className="whitespace-pre-wrap text-xs bg-muted/50 p-2 rounded">
                  {ordem.observacoes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline/Histórico */}
        {historico && historico.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle 
                className="text-base flex items-center justify-between cursor-pointer"
                onClick={() => setShowTimeline(!showTimeline)}
              >
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico ({historico.length})
                </span>
                {showTimeline ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
            {showTimeline && (
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {historico.map((log, index) => (
                    <div key={log.id} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        {index < historico.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="font-medium">{log.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Fotos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Fotos ({anexos?.length || 0})
              </span>
              {status !== "concluida" && status !== "cancelada" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-1" />
                      Adicionar
                    </>
                  )}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            {anexos && anexos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {anexos.map((anexo) => (
                  <img
                    key={anexo.id}
                    src={anexo.url}
                    alt={anexo.descricao || "Foto"}
                    className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(anexo.url, "_blank")}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma foto adicionada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Observação do técnico */}
        {status !== "concluida" && status !== "cancelada" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Observações do Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Adicione observações sobre o serviço..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        )}

        {/* Botão APR - Sempre visível quando não concluído/cancelado */}
        {status !== "concluida" && status !== "cancelada" && (
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            size="lg"
            onClick={() => navigate(`/app/ordens/${id}/apr`)}
          >
            <ClipboardCheck className="h-5 w-5 mr-2" />
            APR - Análise de Riscos
          </Button>
        )}

        {/* Botão Materiais - Sempre visível quando em execução */}
        {(status === "em_andamento" || status === "em_execucao" || status === "no_local") && (
          <Button
            variant="outline"
            className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            size="lg"
            onClick={() => navigate(`/app/ordens/${id}/materiais`)}
          >
            <Package className="h-5 w-5 mr-2" />
            Materiais Aplicados/Retirados
          </Button>
        )}

        {/* Ações de Status */}
        {nextStatuses.length > 0 && (
          <div className="space-y-2">
            {nextStatuses.map((nextStatus) => {
              const nextConfig = statusConfig[nextStatus];
              const NextIcon = nextConfig?.icon || Play;
              
              // Estilização especial para cada botão
              let buttonVariant: "default" | "outline" | "destructive" = "default";
              let buttonClass = "";
              let buttonLabel = "";
              
              if (nextStatus === "em_deslocamento") {
                buttonClass = "bg-orange-500 hover:bg-orange-600";
                buttonLabel = "Iniciar Deslocamento";
              } else if (nextStatus === "no_local") {
                buttonClass = "bg-purple-600 hover:bg-purple-700";
                buttonLabel = "Cheguei no Local";
              } else if (nextStatus === "em_execucao") {
                buttonClass = "bg-blue-600 hover:bg-blue-700";
                buttonLabel = "Iniciar Serviço";
              } else if (nextStatus === "concluida") {
                buttonClass = "bg-green-600 hover:bg-green-700";
                buttonLabel = "Concluir Serviço";
              } else if (nextStatus === "pausada") {
                buttonVariant = "outline";
                buttonClass = "border-amber-500 text-amber-600 hover:bg-amber-50";
                buttonLabel = "Pausar";
              }
              
              return (
                <Button
                  key={nextStatus}
                  className={`w-full ${buttonClass}`}
                  variant={buttonVariant}
                  size="lg"
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <NextIcon className="h-5 w-5 mr-2" />
                  )}
                  {buttonLabel}
                </Button>
              );
            })}
          </div>
        )}

        {/* Status Concluído */}
        {status === "concluida" && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-green-700 dark:text-green-400 text-lg">
                Serviço Concluído! 🎉
              </p>
              {ordem.tempo_total_minutos && (
                <p className="text-sm text-muted-foreground mt-2">
                  Tempo total: {formatarTempo(ordem.tempo_total_minutos)}
                </p>
              )}
              {ordem.concluido_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Finalizado em {format(new Date(ordem.concluido_at), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              )}
              
              {/* Botões de navegação após conclusão */}
              <div className="mt-6 space-y-3">
                {proximaOS?.ordens_servico && (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => navigate(`/app/ordens/${proximaOS.ordens_servico.id}`)}
                  >
                    <ChevronRight className="h-4 w-4 mr-2" />
                    Ir para Próximo Serviço
                    <Badge variant="secondary" className="ml-2 bg-white/20">
                      #{proximaOS.ordem_na_rota}
                    </Badge>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/app/ordens")}
                >
                  <List className="h-4 w-4 mr-2" />
                  Ver Todas as Ordens
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
