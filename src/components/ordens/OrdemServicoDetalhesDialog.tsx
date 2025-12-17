import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  MapPin,
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  History,
  Truck,
  Play,
  Pause,
  Flag,
  Camera,
  DollarSign,
  Timer,
} from "lucide-react";

interface OrdemServicoDetalhesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemId: string | null;
}

interface Pergunta {
  id: string;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  ordem: number;
}

interface GrupoPerguntas {
  id: string;
  nome: string;
  ordem: number;
  perguntas: Pergunta[];
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  em_aberto: { label: "Em Aberto", color: "bg-gray-500", icon: Clock },
  planejada: { label: "Planejada", color: "bg-blue-500", icon: Calendar },
  em_deslocamento: { label: "Em Deslocamento", color: "bg-amber-500", icon: Truck },
  no_local: { label: "No Local", color: "bg-purple-500", icon: MapPin },
  em_execucao: { label: "Em Execução", color: "bg-orange-500", icon: Play },
  pausada: { label: "Pausada", color: "bg-yellow-500", icon: Pause },
  concluida: { label: "Concluída", color: "bg-green-500", icon: CheckCircle },
  cancelada: { label: "Cancelada", color: "bg-red-500", icon: XCircle },
};

export function OrdemServicoDetalhesDialog({
  open,
  onOpenChange,
  ordemId,
}: OrdemServicoDetalhesDialogProps) {
  // Buscar detalhes da OS
  const { data: ordem, isLoading: loadingOrdem } = useQuery({
    queryKey: ["ordem-detalhes", ordemId],
    queryFn: async () => {
      if (!ordemId) return null;

      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          tecnicos:tecnico_id (id, codigo, nome),
          equipe_planejada:equipe_planejada_id (id, codigo, nome)
        `)
        .eq("id", ordemId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && open,
  });

  // Buscar checklists preenchidos para esta OS
  const { data: checklists, isLoading: loadingChecklists } = useQuery({
    queryKey: ["ordem-checklists", ordemId],
    queryFn: async () => {
      if (!ordemId) return [];

      const { data, error } = await supabase
        .from("checklist_respostas")
        .select(`
          *,
          checklists (id, nome, tipo, grupos)
        `)
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && open,
  });

  // Buscar logs/histórico da OS
  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["ordem-logs", ordemId],
    queryFn: async () => {
      if (!ordemId) return [];

      const { data, error } = await supabase
        .from("planejamento_logs")
        .select("*")
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && open,
  });

  // Buscar planejamento da OS
  const { data: planejamento } = useQuery({
    queryKey: ["ordem-planejamento", ordemId],
    queryFn: async () => {
      if (!ordemId) return null;

      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          *,
          planejamentos (id, data_planejamento, status),
          tecnicos:equipe_id (id, codigo, nome, color)
        `)
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && open,
  });

  const statusInfo = ordem ? statusConfig[ordem.status] || statusConfig.em_aberto : null;
  const StatusIcon = statusInfo?.icon || Clock;

  // Renderizar coordenadas copiáveis
  const renderCoordenadasCopiavel = (lat?: number, lng?: number, dataHora?: string) => {
    if (!lat && !lng && !dataHora) return null;
    
    const coordsText = lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;

    return (
      <div className="mt-0.5 space-y-0">
        {dataHora && (
          <p 
            className="text-[9px] text-muted-foreground font-mono cursor-pointer hover:text-foreground select-all"
            title="Clique para selecionar"
          >
            {dataHora}
          </p>
        )}
        {coordsText && (
          <p 
            className="text-[9px] text-muted-foreground font-mono cursor-pointer hover:text-foreground select-all"
            title="Clique para selecionar"
          >
            {coordsText}
          </p>
        )}
      </div>
    );
  };

  // Renderizar valor da resposta do checklist
  const renderValorResposta = (pergunta: Pergunta, resposta: any) => {
    if (!resposta) return <span className="text-muted-foreground text-sm">-</span>;

    const valor = resposta.resposta;
    const fotoUrl = resposta.foto_url;
    const assinaturaUrl = resposta.assinatura_url;
    const fotoLat = resposta.foto_latitude;
    const fotoLng = resposta.foto_longitude;
    const fotoDataHora = resposta.foto_data_hora;
    const assLat = resposta.assinatura_latitude;
    const assLng = resposta.assinatura_longitude;
    const assDataHora = resposta.assinatura_data_hora;

    if (pergunta.tipo === "foto") {
      return fotoUrl ? (
        <div>
          <img src={fotoUrl} alt="Foto" className="w-20 h-16 object-cover rounded cursor-pointer hover:opacity-80" onClick={() => window.open(fotoUrl, '_blank')} />
          {renderCoordenadasCopiavel(fotoLat, fotoLng, fotoDataHora)}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">Sem foto</span>
      );
    }

    if (pergunta.tipo === "assinatura") {
      return assinaturaUrl ? (
        <div>
          <img src={assinaturaUrl} alt="Assinatura" className="w-32 h-16 object-contain bg-white border rounded" />
          {renderCoordenadasCopiavel(assLat, assLng, assDataHora)}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">-</span>
      );
    }

    if (pergunta.tipo === "sim_nao") {
      return valor === "sim" ? (
        <Badge variant="destructive" className="text-xs">Sim</Badge>
      ) : valor === "nao" ? (
        <Badge className="bg-green-600 text-xs">Não</Badge>
      ) : (
        <span className="text-sm">{String(valor)}</span>
      );
    }

    if (pergunta.tipo === "multipla_escolha" && Array.isArray(valor)) {
      return (
        <div className="flex flex-wrap gap-1">
          {valor.slice(0, 3).map((v: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-xs">{v}</Badge>
          ))}
          {valor.length > 3 && (
            <Badge variant="outline" className="text-xs">+{valor.length - 3}</Badge>
          )}
        </div>
      );
    }

    return <span className="text-sm">{String(valor)}</span>;
  };

  // Formatar tempo em minutos para exibição
  const formatarTempo = (minutos: number | null | undefined): string => {
    if (!minutos) return "-";
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
      return `${horas}h ${mins}min`;
    }
    return `${mins}min`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {ordem ? `OS #${ordem.numero}` : "Detalhes da OS"}
          </DialogTitle>
        </DialogHeader>

        {loadingOrdem ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : ordem ? (
          <ScrollArea className="max-h-[70vh] pr-4">
            <Tabs defaultValue="detalhes" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="execucao">Execução</TabsTrigger>
                <TabsTrigger value="checklists">
                  Checklists
                  {checklists && checklists.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                      {checklists.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>

              {/* Tab Detalhes */}
              <TabsContent value="detalhes" className="space-y-4 mt-4">
                {/* Status e Informações Principais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <Badge className={statusInfo?.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo?.label}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-1">Tipo</p>
                      <p className="font-semibold text-sm">{ordem.tipo}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-1">Prazo</p>
                      <p className="font-semibold text-sm">
                        {ordem.prazo ? format(new Date(ordem.prazo), "dd/MM/yyyy HH:mm") : "-"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-1">Regulada</p>
                      {ordem.regulada ? (
                        <Badge variant="destructive">Sim</Badge>
                      ) : (
                        <Badge variant="outline">Não</Badge>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Endereço e Cliente */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <MapPin className="h-4 w-4" />
                          Endereço
                        </div>
                        <p className="font-medium">{ordem.endereco}</p>
                        {ordem.latitude && ordem.longitude && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {ordem.latitude}, {ordem.longitude}
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <User className="h-4 w-4" />
                          Cliente
                        </div>
                        <p className="font-medium">{ordem.cliente_nome || "-"}</p>
                        {ordem.cliente_telefone && (
                          <p className="text-sm text-muted-foreground">{ordem.cliente_telefone}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Planejamento */}
                {planejamento && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Planejamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Equipe</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: planejamento.tecnicos?.color || "#666" }}
                            />
                            <span className="font-medium">{planejamento.tecnicos?.codigo}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Data</p>
                          <p className="font-medium mt-1">
                            {planejamento.planejamentos?.data_planejamento
                              ? format(new Date(planejamento.planejamentos.data_planejamento + 'T12:00:00'), "dd/MM/yyyy")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Horário Previsto</p>
                          <p className="font-medium mt-1">
                            {planejamento.hora_inicio_estimada} - {planejamento.hora_fim_estimada}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ordem na Rota</p>
                          <Badge variant="outline" className="mt-1">#{planejamento.ordem_na_rota}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Valores */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" />
                          Valor
                        </div>
                        <p className="font-semibold text-lg">
                          {ordem.valor ? `R$ ${Number(ordem.valor).toFixed(2)}` : "-"}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Timer className="h-4 w-4" />
                          Tempo Execução
                        </div>
                        <p className="font-semibold">
                          {formatarTempo(ordem.tempo_execucao)}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Clock className="h-4 w-4" />
                          Tempo Total
                        </div>
                        <p className="font-semibold">
                          {formatarTempo(ordem.tempo_total_minutos)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Observações */}
                {ordem.observacoes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Observações</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{ordem.observacoes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Execução */}
              <TabsContent value="execucao" className="space-y-4 mt-4">
                {/* Timeline de Execução */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Etapas da Execução
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Deslocamento Iniciado */}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ordem.deslocamento_iniciado_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Truck className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Deslocamento Iniciado</p>
                          <p className="text-xs text-muted-foreground">
                            {ordem.deslocamento_iniciado_at
                              ? format(new Date(ordem.deslocamento_iniciado_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : "Aguardando"}
                          </p>
                        </div>
                      </div>

                      {/* Chegada no Local */}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ordem.chegada_local_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Chegada no Local</p>
                          <p className="text-xs text-muted-foreground">
                            {ordem.chegada_local_at
                              ? format(new Date(ordem.chegada_local_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : "Aguardando"}
                          </p>
                        </div>
                      </div>

                      {/* Execução Iniciada */}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ordem.execucao_iniciada_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Play className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Execução Iniciada</p>
                          <p className="text-xs text-muted-foreground">
                            {ordem.execucao_iniciada_at
                              ? format(new Date(ordem.execucao_iniciada_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : "Aguardando"}
                          </p>
                        </div>
                      </div>

                      {/* Pausado (se aplicável) */}
                      {ordem.pausado_at && (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-100 text-yellow-600">
                            <Pause className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">Pausado</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(ordem.pausado_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Concluído */}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ordem.concluido_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Flag className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Concluído</p>
                          <p className="text-xs text-muted-foreground">
                            {ordem.concluido_at
                              ? format(new Date(ordem.concluido_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : "Aguardando"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Métricas de Tempo */}
                {(ordem.deslocamento_iniciado_at || ordem.concluido_at) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        Métricas de Tempo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Tempo Deslocamento</p>
                          <p className="font-semibold">
                            {ordem.deslocamento_iniciado_at && ordem.chegada_local_at
                              ? formatarTempo(Math.round((new Date(ordem.chegada_local_at).getTime() - new Date(ordem.deslocamento_iniciado_at).getTime()) / 60000))
                              : "-"}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Tempo Execução</p>
                          <p className="font-semibold">
                            {ordem.execucao_iniciada_at && ordem.concluido_at
                              ? formatarTempo(Math.round((new Date(ordem.concluido_at).getTime() - new Date(ordem.execucao_iniciada_at).getTime()) / 60000))
                              : "-"}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Tempo Total</p>
                          <p className="font-semibold">
                            {ordem.deslocamento_iniciado_at && ordem.concluido_at
                              ? formatarTempo(Math.round((new Date(ordem.concluido_at).getTime() - new Date(ordem.deslocamento_iniciado_at).getTime()) / 60000))
                              : formatarTempo(ordem.tempo_total_minutos)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Checklists */}
              <TabsContent value="checklists" className="space-y-4 mt-4">
                {loadingChecklists ? (
                  <Skeleton className="h-48 w-full" />
                ) : checklists && checklists.length > 0 ? (
                  checklists.map((checklist: any) => (
                    <Card key={checklist.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-violet-600" />
                            {checklist.checklists?.nome}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs uppercase">
                              {checklist.checklists?.tipo}
                            </Badge>
                            {checklist.status === "completo" ? (
                              <Badge className="bg-green-600 text-xs">Completo</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Rascunho</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Preenchido em {format(new Date(checklist.created_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </CardHeader>
                      <CardContent>
                        {checklist.checklists?.grupos?.map((grupo: GrupoPerguntas) => {
                          const respostasMap = Array.isArray(checklist.respostas)
                            ? checklist.respostas.reduce((acc: any, r: any) => ({ ...acc, [r.pergunta_id]: r }), {})
                            : checklist.respostas || {};

                          // Contar riscos no grupo
                          const riscosGrupo = grupo.perguntas?.filter(p => {
                            if (p.tipo !== "sim_nao") return false;
                            return respostasMap[p.id]?.resposta === "sim";
                          }).length || 0;

                          return (
                            <div key={grupo.id} className="mb-4 last:mb-0">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium text-sm">{grupo.nome}</p>
                                {riscosGrupo > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {riscosGrupo} risco(s)
                                  </Badge>
                                )}
                              </div>
                              <div className="grid gap-2">
                                {grupo.perguntas?.slice(0, 5).map((pergunta) => {
                                  const resposta = respostasMap[pergunta.id];
                                  return (
                                    <div key={pergunta.id} className="flex items-center justify-between py-1 border-b last:border-0">
                                      <span className="text-xs text-muted-foreground truncate max-w-[60%]">
                                        {pergunta.texto}
                                      </span>
                                      {renderValorResposta(pergunta, resposta)}
                                    </div>
                                  );
                                })}
                                {grupo.perguntas && grupo.perguntas.length > 5 && (
                                  <p className="text-xs text-muted-foreground text-center">
                                    +{grupo.perguntas.length - 5} perguntas
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhum checklist preenchido para esta OS</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Histórico */}
              <TabsContent value="historico" className="space-y-4 mt-4">
                {loadingLogs ? (
                  <Skeleton className="h-48 w-full" />
                ) : logs && logs.length > 0 ? (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {logs.map((log: any) => (
                          <div key={log.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <History className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{log.descricao}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhum registro no histórico</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Ordem de serviço não encontrada</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

