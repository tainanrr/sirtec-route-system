import { useState, useMemo } from "react";
import { format, parseISO, differenceInMinutes, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Flag,
  MapPin,
  MessageSquare,
  Plus,
  Shield,
  Timer,
  UserCheck,
  X,
  Zap,
} from "lucide-react";

export type SeveridadeAlerta = "critical" | "high" | "medium" | "low";
export type TipoAlerta = 
  | "os_urgente_sem_campo"
  | "os_regulada_vencendo"
  | "os_regulada_vencida"
  | "equipe_ociosa"
  | "equipe_atrasada"
  | "equipe_offline"
  | "parada_prolongada"
  | "checkin_fora_raio"
  | "manual";

export type StatusAlerta = "novo" | "reconhecido" | "assumido" | "silenciado" | "resolvido";

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidade: SeveridadeAlerta;
  titulo: string;
  descricao: string;
  equipeId?: string;
  equipeCodigo?: string;
  osId?: string;
  osNumero?: string;
  prazo?: string;
  status: StatusAlerta;
  criadoEm: string;
  silenciadoAte?: string;
  assumidoPor?: string;
  reconhecidoPor?: string;
  tratativas?: TratativaAlerta[];
}

export interface TratativaAlerta {
  id: string;
  acao: string;
  motivo?: string;
  comentario?: string;
  criadoPor: string;
  criadoEm: string;
}

export interface MotivoTratativa {
  id: string;
  nome: string;
  tipo: "resolucao" | "escalonamento" | "silenciamento" | "comentario";
}

interface Props {
  alertas: Alerta[];
  motivos: MotivoTratativa[];
  onReconhecer: (alertaId: string) => Promise<void>;
  onAssumir: (alertaId: string) => Promise<void>;
  onSilenciar: (alertaId: string, minutos: number) => Promise<void>;
  onResolver: (alertaId: string, motivoId: string, comentario?: string) => Promise<void>;
  onComentar: (alertaId: string, comentario: string) => Promise<void>;
  onVerOS: (osId: string) => void;
  onVerEquipe: (equipeId: string) => void;
  isProcessing?: boolean;
}

const SEVERIDADE_CONFIG = {
  critical: {
    label: "Crítico",
    color: "bg-red-500",
    bgColor: "bg-red-500/10 border-red-500/30",
    textColor: "text-red-700 dark:text-red-400",
    icon: Zap,
  },
  high: {
    label: "Alto",
    color: "bg-orange-500",
    bgColor: "bg-orange-500/10 border-orange-500/30",
    textColor: "text-orange-700 dark:text-orange-400",
    icon: AlertTriangle,
  },
  medium: {
    label: "Médio",
    color: "bg-yellow-500",
    bgColor: "bg-yellow-500/10 border-yellow-500/30",
    textColor: "text-yellow-700 dark:text-yellow-400",
    icon: Flag,
  },
  low: {
    label: "Baixo",
    color: "bg-blue-500",
    bgColor: "bg-blue-500/10 border-blue-500/30",
    textColor: "text-blue-700 dark:text-blue-400",
    icon: Bell,
  },
};

const TIPO_CONFIG: Record<TipoAlerta, { label: string; icon: React.ElementType }> = {
  os_urgente_sem_campo: { label: "OS Urgente sem Equipe", icon: Shield },
  os_regulada_vencendo: { label: "Regulada Vencendo", icon: Clock },
  os_regulada_vencida: { label: "Regulada Vencida", icon: AlertTriangle },
  equipe_ociosa: { label: "Equipe Ociosa", icon: Timer },
  equipe_atrasada: { label: "Equipe Atrasada", icon: Clock },
  equipe_offline: { label: "Equipe Offline", icon: AlertTriangle },
  parada_prolongada: { label: "Parada Prolongada", icon: Clock },
  checkin_fora_raio: { label: "Check-in Fora do Raio", icon: MapPin },
  manual: { label: "Manual", icon: Flag },
};

export function AlertasUrgentes({
  alertas,
  motivos,
  onReconhecer,
  onAssumir,
  onSilenciar,
  onResolver,
  onComentar,
  onVerOS,
  onVerEquipe,
  isProcessing,
}: Props) {
  const [alertaExpandido, setAlertaExpandido] = useState<string | null>(null);
  const [dialogResolver, setDialogResolver] = useState<{
    open: boolean;
    alerta: Alerta | null;
    motivoId: string;
    comentario: string;
  }>({ open: false, alerta: null, motivoId: "", comentario: "" });
  const [dialogComentar, setDialogComentar] = useState<{
    open: boolean;
    alerta: Alerta | null;
    comentario: string;
  }>({ open: false, alerta: null, comentario: "" });

  // Filtrar e ordenar alertas
  const alertasAtivos = useMemo(() => {
    return alertas
      .filter(a => a.status !== "resolvido")
      .filter(a => {
        // Filtrar silenciados que já passaram do tempo
        if (a.status === "silenciado" && a.silenciadoAte) {
          return new Date(a.silenciadoAte) > new Date();
        }
        return true;
      })
      .sort((a, b) => {
        // Ordenar por severidade, depois por data
        const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sevDiff = sevOrder[a.severidade] - sevOrder[b.severidade];
        if (sevDiff !== 0) return sevDiff;
        return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
      });
  }, [alertas]);

  const estatisticas = useMemo(() => {
    return {
      total: alertasAtivos.length,
      criticos: alertasAtivos.filter(a => a.severidade === "critical").length,
      altos: alertasAtivos.filter(a => a.severidade === "high").length,
      naoReconhecidos: alertasAtivos.filter(a => a.status === "novo").length,
      silenciados: alertas.filter(a => a.status === "silenciado").length,
    };
  }, [alertasAtivos, alertas]);

  const handleResolver = async () => {
    if (!dialogResolver.alerta || !dialogResolver.motivoId) return;
    await onResolver(
      dialogResolver.alerta.id,
      dialogResolver.motivoId,
      dialogResolver.comentario || undefined
    );
    setDialogResolver({ open: false, alerta: null, motivoId: "", comentario: "" });
  };

  const handleComentar = async () => {
    if (!dialogComentar.alerta || !dialogComentar.comentario.trim()) return;
    await onComentar(dialogComentar.alerta.id, dialogComentar.comentario);
    setDialogComentar({ open: false, alerta: null, comentario: "" });
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-destructive/5 to-card">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alertas Ativos
            </span>
            <div className="flex items-center gap-2">
              {estatisticas.criticos > 0 && (
                <Badge variant="destructive" className="gap-1 animate-pulse">
                  {estatisticas.criticos} crítico{estatisticas.criticos > 1 ? "s" : ""}
                </Badge>
              )}
              {estatisticas.naoReconhecidos > 0 && (
                <Badge variant="secondary" className="gap-1">
                  {estatisticas.naoReconhecidos} novo{estatisticas.naoReconhecidos > 1 ? "s" : ""}
                </Badge>
              )}
              <Badge variant="outline">{estatisticas.total}</Badge>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {alertasAtivos.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum alerta ativo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todas as situações estão sob controle
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {alertasAtivos.map((alerta) => {
                  const sevConfig = SEVERIDADE_CONFIG[alerta.severidade];
                  const tipoConfig = TIPO_CONFIG[alerta.tipo];
                  const TipoIcon = tipoConfig.icon;
                  const isExpanded = alertaExpandido === alerta.id;
                  const isSilenciado = alerta.status === "silenciado";

                  return (
                    <div
                      key={alerta.id}
                      className={cn(
                        "p-3 transition-all",
                        sevConfig.bgColor,
                        isSilenciado && "opacity-60"
                      )}
                    >
                      {/* Header do alerta */}
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          alerta.severidade === "critical" && "bg-red-500/20",
                          alerta.severidade === "high" && "bg-orange-500/20",
                          alerta.severidade === "medium" && "bg-yellow-500/20",
                          alerta.severidade === "low" && "bg-blue-500/20"
                        )}>
                          <TipoIcon className={cn("h-4 w-4", sevConfig.textColor)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("font-semibold text-sm", sevConfig.textColor)}>
                              {alerta.titulo}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-4">
                              {sevConfig.label}
                            </Badge>
                            {alerta.status === "reconhecido" && (
                              <Badge variant="secondary" className="text-[10px] h-4 gap-1">
                                <Eye className="h-2.5 w-2.5" /> Visto
                              </Badge>
                            )}
                            {alerta.status === "assumido" && (
                              <Badge variant="secondary" className="text-[10px] h-4 gap-1">
                                <UserCheck className="h-2.5 w-2.5" /> Assumido
                              </Badge>
                            )}
                            {isSilenciado && (
                              <Badge variant="secondary" className="text-[10px] h-4 gap-1">
                                <BellOff className="h-2.5 w-2.5" /> Silenciado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {alerta.descricao}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            <span>{format(parseISO(alerta.criadoEm), "HH:mm", { locale: ptBR })}</span>
                            {alerta.equipeCodigo && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" />
                                {alerta.equipeCodigo}
                              </span>
                            )}
                            {alerta.osNumero && (
                              <span className="font-medium">OS {alerta.osNumero}</span>
                            )}
                            {alerta.prazo && (
                              <span className={cn(
                                "font-medium",
                                isPast(parseISO(alerta.prazo)) && "text-red-600"
                              )}>
                                Prazo: {format(parseISO(alerta.prazo), "dd/MM HH:mm")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ações rápidas */}
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {alerta.osId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => onVerOS(alerta.osId!)}
                          >
                            <ExternalLink className="h-3 w-3" /> Ver OS
                          </Button>
                        )}
                        {alerta.equipeId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => onVerEquipe(alerta.equipeId!)}
                          >
                            <MapPin className="h-3 w-3" /> Ver Equipe
                          </Button>
                        )}

                        <div className="flex-1" />

                        {alerta.status === "novo" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => onReconhecer(alerta.id)}
                            disabled={isProcessing}
                          >
                            <Eye className="h-3 w-3" /> Reconhecer
                          </Button>
                        )}
                        
                        {alerta.status !== "assumido" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => onAssumir(alerta.id)}
                            disabled={isProcessing}
                          >
                            <UserCheck className="h-3 w-3" /> Assumir
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => onSilenciar(alerta.id, 30)}
                          disabled={isProcessing || isSilenciado}
                        >
                          <BellOff className="h-3 w-3" /> 30min
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => setDialogComentar({ open: true, alerta, comentario: "" })}
                          disabled={isProcessing}
                        >
                          <MessageSquare className="h-3 w-3" /> Comentar
                        </Button>

                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs gap-1"
                          onClick={() => setDialogResolver({ 
                            open: true, 
                            alerta, 
                            motivoId: "", 
                            comentario: "" 
                          })}
                          disabled={isProcessing}
                        >
                          <Check className="h-3 w-3" /> Resolver
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setAlertaExpandido(isExpanded ? null : alerta.id)}
                        >
                          <Plus className={cn(
                            "h-3 w-3 transition-transform",
                            isExpanded && "rotate-45"
                          )} />
                        </Button>
                      </div>

                      {/* Histórico de tratativas (expandido) */}
                      {isExpanded && alerta.tratativas && alerta.tratativas.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            Histórico de Tratativas
                          </div>
                          {alerta.tratativas.map((t) => (
                            <div key={t.id} className="rounded-md bg-card/50 p-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{t.acao}</span>
                                <span className="text-muted-foreground">
                                  {format(parseISO(t.criadoEm), "dd/MM HH:mm")}
                                </span>
                              </div>
                              {t.motivo && (
                                <div className="text-muted-foreground mt-1">
                                  Motivo: {t.motivo}
                                </div>
                              )}
                              {t.comentario && (
                                <div className="text-muted-foreground mt-1 italic">
                                  "{t.comentario}"
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog Resolver */}
      <Dialog 
        open={dialogResolver.open} 
        onOpenChange={(open) => setDialogResolver(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Alerta</DialogTitle>
            <DialogDescription>
              {dialogResolver.alerta?.titulo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo da resolução *</Label>
              <Select
                value={dialogResolver.motivoId}
                onValueChange={(v) => setDialogResolver(prev => ({ ...prev, motivoId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivos
                    .filter(m => m.tipo === "resolucao")
                    .map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comentário (opcional)</Label>
              <Textarea
                value={dialogResolver.comentario}
                onChange={(e) => setDialogResolver(prev => ({ ...prev, comentario: e.target.value }))}
                placeholder="Descreva a ação tomada..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDialogResolver({ open: false, alerta: null, motivoId: "", comentario: "" })}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleResolver}
              disabled={!dialogResolver.motivoId || isProcessing}
            >
              Resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Comentar */}
      <Dialog 
        open={dialogComentar.open} 
        onOpenChange={(open) => setDialogComentar(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Comentário</DialogTitle>
            <DialogDescription>
              {dialogComentar.alerta?.titulo}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={dialogComentar.comentario}
              onChange={(e) => setDialogComentar(prev => ({ ...prev, comentario: e.target.value }))}
              placeholder="Descreva a tratativa, contato realizado, próximos passos..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDialogComentar({ open: false, alerta: null, comentario: "" })}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleComentar}
              disabled={!dialogComentar.comentario.trim() || isProcessing}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

