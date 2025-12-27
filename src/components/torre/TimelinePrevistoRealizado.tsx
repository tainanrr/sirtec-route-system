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
  Car,
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
  Navigation,
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

export interface TimelineOrdemServico {
  id: string;
  numero: string;
  tipo: string;
  status: OSStatus;
  regulada: boolean;
  ordemNaRota: number;
  // Previstos
  horaInicioEstimada?: string; // HH:mm:ss
  horaFimEstimada?: string;
  tempoDeslocamentoMinutos?: number;
  tempoExecucaoMinutos?: number;
  // Realizados
  deslocamentoIniciadoAt?: string;
  chegadaLocalAt?: string;
  execucaoIniciadaAt?: string;
  concluidoAt?: string;
  pausadoAt?: string;
}

export interface TimelineIntervalo {
  id: string;
  tipo: string;
  horaInicio: string;
  horaFim?: string;
  duracaoMinutos?: number;
}

export interface TimelineEquipeCompleta {
  id: string;
  codigo: string;
  nome: string;
  ordens: TimelineOrdemServico[];
  intervalos: TimelineIntervalo[];
  turnoInicio?: string; // HH:mm
  turnoFim?: string;
  status: "normal" | "atrasada" | "adiantada" | "ociosa" | "offline" | "em_intervalo";
  minutosDesvio?: number;
  turnoAberto: boolean;
}

interface Props {
  dateISO: string;
  equipes: TimelineEquipeCompleta[];
  onSelectEquipe: (equipeId: string) => void;
  onSelectOS: (osId: string, equipeId: string) => void;
}

function toMinutes(hhmmss?: string | null): number | null {
  if (!hhmmss) return null;
  const parts = hhmmss.split(":");
  const hh = parseInt(parts[0] || "0");
  const mm = parseInt(parts[1] || "0");
  const ss = parseInt(parts[2] || "0");
  if (isNaN(hh) || isNaN(mm)) return null;
  return hh * 60 + mm + ss / 60;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function extractTimeFromISO(isoString?: string | null): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function getStatusColor(status: OSStatus) {
  switch (status) {
    case "concluida":
      return { bg: "bg-emerald-500", border: "border-emerald-600", text: "text-white", fill: "#10b981" };
    case "cancelada":
      return { bg: "bg-slate-400", border: "border-slate-500", text: "text-white", fill: "#94a3b8" };
    case "em_execucao":
    case "em_andamento":
      return { bg: "bg-violet-500", border: "border-violet-600", text: "text-white", fill: "#8b5cf6" };
    case "no_local":
      return { bg: "bg-blue-500", border: "border-blue-600", text: "text-white", fill: "#3b82f6" };
    case "em_deslocamento":
      return { bg: "bg-sky-400", border: "border-sky-500", text: "text-white", fill: "#38bdf8" };
    case "pausada":
      return { bg: "bg-amber-500", border: "border-amber-600", text: "text-white", fill: "#f59e0b" };
    default:
      return { bg: "bg-slate-300 dark:bg-slate-600", border: "border-slate-400", text: "text-slate-800 dark:text-slate-200", fill: "#cbd5e1" };
  }
}

const STATUS_EQUIPE_CONFIG = {
  normal: { label: "Normal", color: "text-emerald-600", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30", icon: Activity },
  adiantada: { label: "Adiantada", color: "text-emerald-600", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30", icon: TrendingUp },
  atrasada: { label: "Atrasada", color: "text-red-600", bgColor: "bg-red-500/10", borderColor: "border-red-500/30", icon: TrendingDown },
  ociosa: { label: "Ociosa", color: "text-amber-600", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30", icon: Timer },
  offline: { label: "Offline", color: "text-slate-500", bgColor: "bg-slate-500/10", borderColor: "border-slate-500/30", icon: AlertTriangle },
  em_intervalo: { label: "Intervalo", color: "text-blue-600", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", icon: Coffee },
};

export function TimelinePrevistoRealizado({ dateISO, equipes, onSelectEquipe, onSelectOS }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(2);
  const [filtrarComProblema, setFiltrarComProblema] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [mostrarRealizado, setMostrarRealizado] = useState(true);

  // Config da timeline
  const dayStartMin = 6 * 60; // 06:00
  const dayEndMin = 22 * 60; // 22:00
  const totalMin = dayEndMin - dayStartMin;
  const widthPx = Math.max(1200, Math.round(totalMin * zoom));
  const pixelsPerMinute = widthPx / totalMin;

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
    let lista = equipes.filter(e => e.turnoAberto || e.ordens.length > 0);
    if (filtrarComProblema) {
      lista = lista.filter(e => e.status !== "normal" && e.status !== "adiantada");
    }
    // Ordenar por status (problemas primeiro)
    const ordem = { offline: 0, atrasada: 1, ociosa: 2, em_intervalo: 3, normal: 4, adiantada: 5 };
    return lista.sort((a, b) => ordem[a.status] - ordem[b.status]);
  }, [equipes, filtrarComProblema]);

  // Horas para exibir
  const hours = useMemo(() => {
    const list: Array<{ label: string; x: number; isHour: boolean }> = [];
    for (let h = 6; h <= 22; h++) {
      const min = h * 60;
      const x = Math.round(((min - dayStartMin) / totalMin) * widthPx);
      list.push({ label: `${String(h).padStart(2, "0")}:00`, x, isHour: true });
      // Adicionar marcas de 30 minutos
      if (h < 22) {
        const minHalf = h * 60 + 30;
        const xHalf = Math.round(((minHalf - dayStartMin) / totalMin) * widthPx);
        list.push({ label: `${String(h).padStart(2, "0")}:30`, x: xHalf, isHour: false });
      }
    }
    return list;
  }, [totalMin, widthPx]);

  // Scroll para hora atual
  useEffect(() => {
    if (nowLine && scrollRef.current) {
      const container = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (container) {
        container.scrollLeft = Math.max(0, nowLine - 300);
      }
    }
  }, [nowLine]);

  // Calcular progresso de uma equipe
  const calcularProgresso = (equipe: TimelineEquipeCompleta) => {
    const total = equipe.ordens.length;
    const concluidas = equipe.ordens.filter(o => o.status === "concluida").length;
    const emAndamento = equipe.ordens.filter(o => 
      o.status === "em_deslocamento" || o.status === "no_local" || o.status === "em_execucao" || o.status === "em_andamento"
    ).length;
    return { total, concluidas, emAndamento, percentual: total > 0 ? Math.round((concluidas / total) * 100) : 0 };
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/20">
      <CardHeader className="pb-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-bold">Timeline Previsto vs Realizado</div>
              <div className="text-sm font-normal text-muted-foreground">
                {format(new Date(`${dateISO}T12:00:00`), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </div>
            </div>
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground">Mostrar Realizado</span>
              <Switch checked={mostrarRealizado} onCheckedChange={setMostrarRealizado} />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground">Só Problemas</span>
              <Switch checked={filtrarComProblema} onCheckedChange={setFiltrarComProblema} />
            </div>
            <Badge variant="secondary" className="text-sm">
              {equipesFiltradas.length} equipe{equipesFiltradas.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {/* Controle de Zoom */}
        <div className="p-3 border-b bg-muted/20">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Zoom:</span>
              <div className="w-40">
                <Slider
                  value={[zoom]}
                  min={1}
                  max={4}
                  step={0.1}
                  onValueChange={(v) => setZoom(v[0])}
                />
              </div>
              <Badge variant="outline" className="text-xs font-mono">{zoom.toFixed(1)}x</Badge>
            </div>
            
            {/* Legenda */}
            <div className="flex items-center gap-4 ml-auto text-[10px]">
              <span className="text-muted-foreground font-medium">Legenda:</span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded bg-emerald-500" /> Concluída
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded bg-violet-500" /> Em execução
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded-full bg-sky-400 flex items-center justify-center">
                  <Navigation className="h-2 w-2 text-white" />
                </span> Deslocamento
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded bg-amber-500" /> Pausada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded bg-blue-500/30 border border-blue-500/50" /> Intervalo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded border-2 border-dashed border-slate-400" /> Previsto
              </span>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Coluna de equipes (fixa) */}
          <div className="w-64 flex-shrink-0 border-r bg-card">
            <div className="h-12 border-b flex items-center px-4 bg-muted/30">
              <span className="text-sm font-semibold text-muted-foreground">Equipe / Status</span>
            </div>
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {equipesFiltradas.map((equipe) => {
                  const statusConfig = STATUS_EQUIPE_CONFIG[equipe.status];
                  const StatusIcon = statusConfig.icon;
                  const isExpanded = expandido === equipe.id;
                  const progresso = calcularProgresso(equipe);

                  return (
                    <div key={equipe.id}>
                      <button
                        className={cn(
                          "w-full text-left p-3 hover:bg-muted/40 transition-all",
                          isExpanded && "bg-muted/60",
                          mostrarRealizado ? "min-h-[100px]" : "min-h-[70px]"
                        )}
                        onClick={() => {
                          setExpandido(isExpanded ? null : equipe.id);
                          onSelectEquipe(equipe.id);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{equipe.codigo}</span>
                              <Badge 
                                variant="outline" 
                                className={cn("text-[10px] px-1.5 py-0", statusConfig.bgColor, statusConfig.borderColor)}
                              >
                                <StatusIcon className={cn("h-3 w-3 mr-1", statusConfig.color)} />
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {equipe.nome}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>

                        {/* Barra de progresso */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className="font-medium">
                              {progresso.concluidas}/{progresso.total} ({progresso.percentual}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${progresso.percentual}%` }}
                            />
                          </div>
                        </div>

                        {equipe.minutosDesvio != null && equipe.minutosDesvio !== 0 && (
                          <div className={cn(
                            "text-xs font-semibold mt-2 flex items-center gap-1",
                            equipe.minutosDesvio > 0 ? "text-red-600" : "text-emerald-600"
                          )}>
                            {equipe.minutosDesvio > 0 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : (
                              <TrendingUp className="h-3 w-3" />
                            )}
                            {equipe.minutosDesvio > 0 ? "+" : ""}{equipe.minutosDesvio}min
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}

                {equipesFiltradas.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    Nenhuma equipe com rota para hoje
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Área da timeline (scrollável) */}
          <div className="flex-1 overflow-hidden">
            {/* Header com horas */}
            <div className="h-12 border-b relative overflow-hidden">
              <ScrollArea className="h-full" ref={scrollRef}>
                <div className="relative h-full" style={{ width: widthPx }}>
                  {hours.map((h, idx) => (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0"
                      style={{ left: h.x }}
                    >
                      <div className={cn("h-full w-px", h.isHour ? "bg-border" : "bg-border/30")} />
                      {h.isHour && (
                        <span className="absolute top-3 left-1.5 text-xs font-medium text-muted-foreground">
                          {h.label}
                        </span>
                      )}
                    </div>
                  ))}
                  {nowLine != null && (
                    <div className="absolute top-0 bottom-0" style={{ left: nowLine }}>
                      <div className="h-full w-[3px] bg-red-500 shadow-lg shadow-red-500/30" />
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        AGORA
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Lanes das equipes */}
            <ScrollArea className="h-[600px]">
              <div className="relative" style={{ width: widthPx }}>
                {equipesFiltradas.map((equipe) => {
                  const isExpanded = expandido === equipe.id;
                  const laneHeight = mostrarRealizado ? (isExpanded ? 120 : 100) : (isExpanded ? 90 : 70);

                  return (
                    <div
                      key={equipe.id}
                      className={cn(
                        "relative border-b transition-all",
                        isExpanded && "bg-primary/5"
                      )}
                      style={{ height: laneHeight }}
                    >
                      {/* Grid de horas (background) */}
                      {hours.map((h, idx) => (
                        <div
                          key={idx}
                          className={cn("absolute top-0 bottom-0 w-px", h.isHour ? "bg-border/40" : "bg-border/20")}
                          style={{ left: h.x }}
                        />
                      ))}

                      {/* Linha do tempo atual */}
                      {nowLine != null && (
                        <div
                          className="absolute top-0 bottom-0 w-[3px] bg-red-500/30"
                          style={{ left: nowLine }}
                        />
                      )}

                      {/* Labels das linhas */}
                      <div className="absolute left-2 top-2 text-[9px] font-bold text-primary/60 uppercase tracking-wider">
                        Previsto
                      </div>
                      {mostrarRealizado && (
                        <div className="absolute left-2 top-[52px] text-[9px] font-bold text-emerald-600/60 uppercase tracking-wider">
                          Realizado
                        </div>
                      )}

                      {/* Intervalos (aparecem nas duas linhas) */}
                      {equipe.intervalos.map((intervalo) => {
                        const startMin = toMinutes(intervalo.horaInicio);
                        const duracao = intervalo.duracaoMinutos || 30;
                        const endMin = toMinutes(intervalo.horaFim) || (startMin ? startMin + duracao : null);
                        if (!startMin || !endMin) return null;

                        const startX = Math.max(0, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                        const endX = Math.min(widthPx, Math.round(((endMin - dayStartMin) / totalMin) * widthPx));
                        const w = Math.max(20, endX - startX);

                        return (
                          <TooltipProvider key={intervalo.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute rounded-md bg-blue-500/20 border border-blue-500/40 flex items-center justify-center"
                                  style={{ 
                                    left: startX, 
                                    width: w, 
                                    top: 18,
                                    height: mostrarRealizado ? laneHeight - 30 : laneHeight - 28
                                  }}
                                >
                                  <Coffee className="h-4 w-4 text-blue-600" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-card border shadow-xl">
                                <div className="font-semibold">{intervalo.tipo}</div>
                                <div className="text-xs text-muted-foreground">
                                  {intervalo.horaInicio?.slice(0, 5)} - {intervalo.horaFim?.slice(0, 5) || "Em andamento"}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}

                      {/* === LINHA DO PREVISTO === */}
                      <div className="absolute left-0 right-0" style={{ top: 18, height: 32 }}>
                        {equipe.ordens.map((os, idx) => {
                          const startMin = toMinutes(os.horaInicioEstimada);
                          const endMin = toMinutes(os.horaFimEstimada);
                          if (!startMin || !endMin) return null;

                          const startX = Math.max(70, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                          const endX = Math.min(widthPx - 10, Math.round(((endMin - dayStartMin) / totalMin) * widthPx));
                          const w = Math.max(40, endX - startX);

                          // Calcular linha de deslocamento para a próxima OS
                          const nextOS = equipe.ordens[idx + 1];
                          let deslocamentoLine = null;
                          if (nextOS) {
                            const nextStartMin = toMinutes(nextOS.horaInicioEstimada);
                            if (nextStartMin && endMin < nextStartMin) {
                              const deslocStartX = endX;
                              const deslocEndX = Math.round(((nextStartMin - dayStartMin) / totalMin) * widthPx);
                              const deslocW = deslocEndX - deslocStartX;
                              if (deslocW > 5) {
                                deslocamentoLine = (
                                  <div 
                                    className="absolute top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-slate-300 to-slate-400 rounded-full opacity-60"
                                    style={{ left: deslocStartX, width: deslocW }}
                                  >
                                    <Navigation className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                                  </div>
                                );
                              }
                            }
                          }

                          return (
                            <div key={`prev-${os.id}`}>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={cn(
                                        "absolute rounded-md border-2 border-dashed px-2 flex items-center gap-1.5 transition-all hover:shadow-lg hover:scale-[1.02]",
                                        "bg-card/80 backdrop-blur-sm border-slate-400",
                                        os.regulada && "ring-2 ring-red-500 ring-offset-1"
                                      )}
                                      style={{
                                        left: startX,
                                        width: w,
                                        height: 28,
                                        top: 2,
                                      }}
                                      onClick={() => onSelectOS(os.id, equipe.id)}
                                    >
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] h-4 px-1 bg-muted/50"
                                      >
                                        {os.ordemNaRota}
                                      </Badge>
                                      <span className="text-[10px] font-medium truncate text-foreground">
                                        {os.numero}
                                      </span>
                                      {os.regulada && (
                                        <Zap className="h-3 w-3 text-red-500 shrink-0" />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs bg-card border shadow-xl">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{os.ordemNaRota}ª</Badge>
                                        <span className="font-bold">{os.numero}</span>
                                        {os.regulada && <Badge variant="destructive" className="text-[10px]">Regulada</Badge>}
                                      </div>
                                      <div className="text-xs text-muted-foreground">{os.tipo}</div>
                                      <div className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                                        <Clock className="h-3 w-3" />
                                        <span className="font-medium">Previsto:</span>
                                        {os.horaInicioEstimada?.slice(0, 5)} - {os.horaFimEstimada?.slice(0, 5)}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {deslocamentoLine}
                            </div>
                          );
                        })}
                      </div>

                      {/* === LINHA DO REALIZADO === */}
                      {mostrarRealizado && (
                        <div className="absolute left-0 right-0" style={{ top: 56, height: 32 }}>
                          {equipe.ordens.map((os, idx) => {
                            // Determinar horários reais
                            const realInicio = extractTimeFromISO(os.execucaoIniciadaAt) || extractTimeFromISO(os.chegadaLocalAt);
                            const realFim = extractTimeFromISO(os.concluidoAt);
                            
                            // Se não tem dados reais e não está concluída, mostrar indicador de status
                            if (!realInicio && os.status !== "concluida") {
                              // Se está em deslocamento, mostrar indicador
                              if (os.status === "em_deslocamento") {
                                const deslocInicio = extractTimeFromISO(os.deslocamentoIniciadoAt);
                                if (deslocInicio) {
                                  const startMin = toMinutes(deslocInicio);
                                  const now = new Date();
                                  const nowMin = now.getHours() * 60 + now.getMinutes();
                                  if (startMin) {
                                    const startX = Math.max(70, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                                    const endX = Math.round(((nowMin - dayStartMin) / totalMin) * widthPx);
                                    const w = Math.max(30, endX - startX);
                                    
                                    return (
                                      <div
                                        key={`real-${os.id}`}
                                        className="absolute rounded-full bg-sky-400 border border-sky-500 flex items-center justify-center gap-1 px-2"
                                        style={{
                                          left: startX,
                                          width: w,
                                          height: 24,
                                          top: 4,
                                        }}
                                      >
                                        <Navigation className="h-3 w-3 text-white animate-pulse" />
                                        <span className="text-[9px] text-white font-medium">Em deslocamento</span>
                                      </div>
                                    );
                                  }
                                }
                              }
                              return null;
                            }

                            if (!realInicio) return null;

                            const startMin = toMinutes(realInicio);
                            const endMinReal = realFim ? toMinutes(realFim) : null;
                            
                            // Se não concluiu, usar hora atual como fim temporário
                            const now = new Date();
                            const nowMin = now.getHours() * 60 + now.getMinutes();
                            const endMin = endMinReal || (os.status !== "concluida" ? nowMin : null);
                            
                            if (!startMin || !endMin) return null;

                            const startX = Math.max(70, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                            const endX = Math.min(widthPx - 10, Math.round(((endMin - dayStartMin) / totalMin) * widthPx));
                            const w = Math.max(40, endX - startX);
                            const colors = getStatusColor(os.status);

                            return (
                              <TooltipProvider key={`real-${os.id}`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={cn(
                                        "absolute rounded-md border px-2 flex items-center gap-1.5 transition-all hover:shadow-lg hover:scale-[1.02]",
                                        colors.bg,
                                        colors.border,
                                        os.status !== "concluida" && "animate-pulse"
                                      )}
                                      style={{
                                        left: startX,
                                        width: w,
                                        height: 24,
                                        top: 4,
                                      }}
                                      onClick={() => onSelectOS(os.id, equipe.id)}
                                    >
                                      <Badge
                                        variant="secondary"
                                        className={cn("text-[9px] h-4 px-1 bg-white/20", colors.text)}
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
                                  <TooltipContent side="top" className="max-w-xs bg-card border shadow-xl">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{os.ordemNaRota}ª</Badge>
                                        <span className="font-bold">{os.numero}</span>
                                        <Badge className={cn("text-[10px]", colors.bg)}>{os.status}</Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground">{os.tipo}</div>
                                      <div className="flex items-center gap-2 text-xs bg-emerald-500/10 rounded px-2 py-1">
                                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                        <span className="font-medium">Real:</span>
                                        {realInicio?.slice(0, 5)} - {realFim?.slice(0, 5) || "em andamento"}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      )}

                      {/* Info expandida */}
                      {isExpanded && (
                        <div className="absolute bottom-2 left-20 right-4 flex items-center gap-4 text-[10px]">
                          <span className="text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3 w-3 inline mr-1" />
                            {equipe.ordens.filter(o => o.status === "concluida").length}/{equipe.ordens.length} concluídas
                          </span>
                          {equipe.minutosDesvio != null && equipe.minutosDesvio !== 0 && (
                            <span className={cn(
                              "font-medium px-2 py-0.5 rounded",
                              equipe.minutosDesvio > 0 ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"
                            )}>
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

export default TimelinePrevistoRealizado;

