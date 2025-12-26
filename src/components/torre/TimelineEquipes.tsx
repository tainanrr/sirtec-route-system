import { useMemo, useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  MapPin,
  Pause,
  Play,
  Route,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

type OSStatus =
  | "pendente"
  | "planejada"
  | "em_deslocamento"
  | "no_local"
  | "em_execucao"
  | "em_andamento"
  | "pausada"
  | "concluida"
  | "cancelada";

export interface TimelineOS {
  id: string;
  numero: string;
  tipo: string;
  status: OSStatus;
  regulada: boolean;
  ordemNaRota: number;
  horaInicioEstimada?: string; // HH:mm:ss
  horaFimEstimada?: string;
  horaInicioReal?: string;
  horaFimReal?: string;
}

export interface TimelineIntervalo {
  id: string;
  tipo: string;
  horaInicio: string;
  horaFim?: string;
}

export interface TimelineEquipeData {
  id: string;
  codigo: string;
  nome: string;
  ordens: TimelineOS[];
  intervalos: TimelineIntervalo[];
  status: "normal" | "atrasada" | "adiantada" | "ociosa" | "offline" | "em_intervalo";
  minutosDesvio?: number; // positivo = atrasado, negativo = adiantado
  ultimaAtualizacao?: string;
  turnoAberto: boolean;
}

interface Props {
  dateISO: string;
  equipes: TimelineEquipeData[];
  onSelectEquipe: (equipeId: string) => void;
  onSelectOS: (osId: string, equipeId: string) => void;
}

function toMinutes(hhmmss?: string | null): number | null {
  if (!hhmmss) return null;
  const [hh, mm, ss] = hhmmss.split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  return hh * 60 + mm + (isNaN(ss) ? 0 : ss / 60);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getStatusColor(status: OSStatus) {
  switch (status) {
    case "concluida":
      return { bg: "bg-emerald-500", border: "border-emerald-600", text: "text-emerald-100" };
    case "cancelada":
      return { bg: "bg-slate-400", border: "border-slate-500", text: "text-slate-100" };
    case "em_execucao":
    case "em_andamento":
      return { bg: "bg-violet-500", border: "border-violet-600", text: "text-violet-100" };
    case "no_local":
      return { bg: "bg-blue-500", border: "border-blue-600", text: "text-blue-100" };
    case "em_deslocamento":
      return { bg: "bg-sky-500", border: "border-sky-600", text: "text-sky-100" };
    case "pausada":
      return { bg: "bg-amber-500", border: "border-amber-600", text: "text-amber-100" };
    default:
      return { bg: "bg-slate-300 dark:bg-slate-600", border: "border-slate-400", text: "text-slate-800 dark:text-slate-200" };
  }
}

const STATUS_EQUIPE_CONFIG = {
  normal: { label: "Normal", color: "text-green-600", icon: Activity },
  adiantada: { label: "Adiantada", color: "text-green-600", icon: TrendingUp },
  atrasada: { label: "Atrasada", color: "text-red-600", icon: TrendingDown },
  ociosa: { label: "Ociosa", color: "text-amber-600", icon: Timer },
  offline: { label: "Offline", color: "text-slate-500", icon: AlertTriangle },
  em_intervalo: { label: "Intervalo", color: "text-blue-600", icon: Coffee },
};

export function TimelineEquipes({ dateISO, equipes, onSelectEquipe, onSelectOS }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.6);
  const [filtrarComProblema, setFiltrarComProblema] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  // Config da timeline
  const dayStartMin = 6 * 60; // 06:00
  const dayEndMin = 22 * 60; // 22:00
  const totalMin = dayEndMin - dayStartMin;
  const widthPx = Math.max(1000, Math.round(totalMin * zoom));

  // Linha do tempo atual
  const nowLine = useMemo(() => {
    const todayISO = format(new Date(), "yyyy-MM-dd");
    if (todayISO !== dateISO) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < dayStartMin || nowMin > dayEndMin) return null;
    return Math.round(((nowMin - dayStartMin) / totalMin) * widthPx);
  }, [dateISO, totalMin, widthPx]);

  // Equipes filtradas
  const equipesFiltradas = useMemo(() => {
    let lista = equipes.filter(e => e.turnoAberto);
    if (filtrarComProblema) {
      lista = lista.filter(e => e.status !== "normal" && e.status !== "adiantada");
    }
    // Ordenar por status (problemas primeiro)
    const ordem = { offline: 0, atrasada: 1, ociosa: 2, em_intervalo: 3, normal: 4, adiantada: 5 };
    return lista.sort((a, b) => ordem[a.status] - ordem[b.status]);
  }, [equipes, filtrarComProblema]);

  // Horas para exibir
  const hours = useMemo(() => {
    const list: Array<{ label: string; x: number }> = [];
    for (let h = 6; h <= 22; h++) {
      const min = h * 60;
      const x = Math.round(((min - dayStartMin) / totalMin) * widthPx);
      list.push({ label: `${String(h).padStart(2, "0")}:00`, x });
    }
    return list;
  }, [totalMin, widthPx]);

  // Scroll para hora atual
  useEffect(() => {
    if (nowLine && scrollRef.current) {
      const container = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (container) {
        container.scrollLeft = Math.max(0, nowLine - 200);
      }
    }
  }, [nowLine]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Linha do Tempo - {format(new Date(`${dateISO}T12:00:00`), "EEEE, dd/MM", { locale: ptBR })}
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Só problemas</span>
              <Switch checked={filtrarComProblema} onCheckedChange={setFiltrarComProblema} />
            </div>
            <Badge variant="secondary">
              {equipesFiltradas.length} equipe{equipesFiltradas.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {/* Controle de Zoom */}
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">Zoom:</span>
            <div className="w-32">
              <Slider
                value={[zoom]}
                min={0.8}
                max={3}
                step={0.1}
                onValueChange={(v) => setZoom(v[0])}
              />
            </div>
            <Badge variant="outline" className="text-[10px]">{zoom.toFixed(1)}x</Badge>
          </div>
        </div>

        {/* Legenda */}
        <div className="px-3 py-2 border-b bg-card flex items-center gap-4 flex-wrap text-[10px]">
          <span className="text-muted-foreground">Status OS:</span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Concluída
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Em execução
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Deslocamento
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pausada
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Pendente
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-6 rounded bg-blue-500/30" /> Intervalo
          </span>
        </div>

        <div className="grid grid-cols-12">
          {/* Coluna de equipes */}
          <div className="col-span-2 border-r bg-card">
            <div className="h-10 border-b flex items-center px-3">
              <span className="text-xs font-medium text-muted-foreground">Equipe</span>
            </div>
            <ScrollArea className="h-[450px]">
              <div className="divide-y">
                {equipesFiltradas.map((equipe) => {
                  const statusConfig = STATUS_EQUIPE_CONFIG[equipe.status];
                  const StatusIcon = statusConfig.icon;
                  const isExpanded = expandido === equipe.id;

                  return (
                    <div key={equipe.id}>
                      <button
                        className={cn(
                          "w-full text-left p-3 hover:bg-muted/30 transition h-[60px]",
                          isExpanded && "bg-muted/50"
                        )}
                        onClick={() => {
                          setExpandido(isExpanded ? null : equipe.id);
                          onSelectEquipe(equipe.id);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm">{equipe.codigo}</div>
                          <div className="flex items-center gap-1">
                            <StatusIcon className={cn("h-3.5 w-3.5", statusConfig.color)} />
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {equipe.nome}
                        </div>
                        {equipe.minutosDesvio != null && equipe.minutosDesvio !== 0 && (
                          <div className={cn(
                            "text-[10px] font-medium",
                            equipe.minutosDesvio > 0 ? "text-red-600" : "text-green-600"
                          )}>
                            {equipe.minutosDesvio > 0 ? "+" : ""}{equipe.minutosDesvio}min
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}

                {equipesFiltradas.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma equipe
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Área da timeline */}
          <div className="col-span-10 bg-card">
            {/* Header com horas */}
            <div className="h-10 border-b relative" style={{ width: widthPx }}>
              <ScrollArea className="h-full" ref={scrollRef}>
                <div className="relative h-full" style={{ width: widthPx }}>
                  {hours.map((h) => (
                    <div
                      key={h.label}
                      className="absolute top-0 bottom-0"
                      style={{ left: h.x }}
                    >
                      <div className="h-full w-px bg-border" />
                      <span className="absolute top-2 left-1 text-[10px] text-muted-foreground">
                        {h.label}
                      </span>
                    </div>
                  ))}
                  {nowLine != null && (
                    <div className="absolute top-0 bottom-0" style={{ left: nowLine }}>
                      <div className="h-full w-[2px] bg-red-500" />
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1 rounded">
                        Agora
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Lanes das equipes */}
            <ScrollArea className="h-[450px]">
              <div className="relative" style={{ width: widthPx }}>
                {equipesFiltradas.map((equipe) => {
                  const isExpanded = expandido === equipe.id;
                  const laneHeight = isExpanded ? 100 : 60;

                  return (
                    <div
                      key={equipe.id}
                      className="relative border-b transition-all"
                      style={{ height: laneHeight }}
                    >
                      {/* Grid de horas (background) */}
                      {hours.map((h) => (
                        <div
                          key={h.label}
                          className="absolute top-0 bottom-0 w-px bg-border/50"
                          style={{ left: h.x }}
                        />
                      ))}

                      {/* Linha do tempo atual */}
                      {nowLine != null && (
                        <div
                          className="absolute top-0 bottom-0 w-[2px] bg-red-500/40"
                          style={{ left: nowLine }}
                        />
                      )}

                      {/* Intervalos */}
                      {equipe.intervalos.map((intervalo) => {
                        const startMin = toMinutes(intervalo.horaInicio);
                        const endMin = toMinutes(intervalo.horaFim) || (startMin ? startMin + 30 : null);
                        if (!startMin || !endMin) return null;

                        const startX = Math.max(0, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                        const endX = Math.min(widthPx, Math.round(((endMin - dayStartMin) / totalMin) * widthPx));
                        const w = Math.max(10, endX - startX);

                        return (
                          <TooltipProvider key={intervalo.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute top-1 h-4 rounded bg-blue-500/30 border border-blue-500/50 flex items-center justify-center"
                                  style={{ left: startX, width: w }}
                                >
                                  <Coffee className="h-2.5 w-2.5 text-blue-600" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{intervalo.tipo}</p>
                                <p className="text-xs text-muted-foreground">
                                  {intervalo.horaInicio?.slice(0, 5)} - {intervalo.horaFim?.slice(0, 5) || "Em andamento"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}

                      {/* OSs */}
                      {equipe.ordens.map((os) => {
                        const startMin = toMinutes(os.horaInicioEstimada);
                        const endMin = toMinutes(os.horaFimEstimada);
                        if (!startMin || !endMin) return null;

                        const startX = Math.max(0, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                        const endX = Math.min(widthPx, Math.round(((endMin - dayStartMin) / totalMin) * widthPx));
                        const w = Math.max(30, endX - startX);
                        const colors = getStatusColor(os.status);

                        // Calcular posição Y baseado no status expandido
                        const yOffset = isExpanded ? 24 : 20;

                        return (
                          <TooltipProvider key={os.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={cn(
                                    "absolute rounded-md border px-1.5 flex items-center gap-1 transition-all hover:shadow-md hover:scale-105",
                                    colors.bg,
                                    colors.border,
                                    os.regulada && "ring-2 ring-red-500 ring-offset-1"
                                  )}
                                  style={{
                                    left: startX,
                                    width: w,
                                    top: yOffset,
                                    height: isExpanded ? 32 : 28,
                                  }}
                                  onClick={() => onSelectOS(os.id, equipe.id)}
                                >
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      "text-[9px] h-4 px-1",
                                      colors.text,
                                      "bg-white/20"
                                    )}
                                  >
                                    {os.ordemNaRota}
                                  </Badge>
                                  <span className={cn("text-[10px] font-medium truncate", colors.text)}>
                                    {os.numero}
                                  </span>
                                  {os.status === "concluida" && (
                                    <Check className={cn("h-3 w-3 shrink-0", colors.text)} />
                                  )}
                                  {os.status === "pausada" && (
                                    <Pause className={cn("h-3 w-3 shrink-0", colors.text)} />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold">{os.numero}</p>
                                  <p className="text-xs">{os.tipo}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    Prev: {os.horaInicioEstimada?.slice(0, 5)} - {os.horaFimEstimada?.slice(0, 5)}
                                  </div>
                                  {os.horaInicioReal && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Play className="h-3 w-3" />
                                      Real: {os.horaInicioReal?.slice(0, 5)}
                                      {os.horaFimReal && ` - ${os.horaFimReal?.slice(0, 5)}`}
                                    </div>
                                  )}
                                  {os.regulada && (
                                    <Badge variant="destructive" className="text-[10px]">
                                      Regulada
                                    </Badge>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}

                      {/* Info expandida */}
                      {isExpanded && (
                        <div className="absolute bottom-2 left-4 right-4 flex items-center gap-4 text-[10px]">
                          <span className="text-muted-foreground">
                            {equipe.ordens.filter(o => o.status === "concluida").length}/{equipe.ordens.length} concluídas
                          </span>
                          {equipe.minutosDesvio != null && equipe.minutosDesvio !== 0 && (
                            <span className={equipe.minutosDesvio > 0 ? "text-red-600" : "text-green-600"}>
                              {equipe.minutosDesvio > 0 ? "Atrasada" : "Adiantada"} {Math.abs(equipe.minutosDesvio)}min
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

