import { useMemo, useState, useRef, useEffect, useCallback } from "react";
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
  XCircle,
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
  tipo: string; // Código do tipo de serviço (skill)
  tipoDescricao?: string; // Descrição/Nome do tipo de serviço
  status: OSStatus;
  regulada: boolean;
  prazo?: string; // Data/hora de prazo (ISO string)
  ordemNaRota: number;
  endereco?: string;
  distanciaKm?: number; // Distância em km até este ponto
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
  previsto?: boolean; // Se é intervalo previsto ou não
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
  selectedEquipeId?: string | null;
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
    // Verificar se já está no formato HH:mm:ss ou HH:mm
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(isoString)) {
      return isoString.length === 5 ? `${isoString}:00` : isoString;
    }
    
    // Se contém T, é uma data ISO - usar Date para converter para horário local
    // Isso garante que UTC seja convertido corretamente para o fuso horário do browser
    if (isoString.includes('T')) {
      const date = new Date(isoString);
      if (!isNaN(date.getTime())) {
        return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
      }
    }
    
    // Tentar como Date genérico
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) {
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
    }
    
    return null;
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

// Verificar se uma OS é regulada urgente (vencida ou vencendo hoje)
function isReguladaUrgente(os: TimelineOrdemServico): boolean {
  if (!os.regulada || !os.prazo) return false;
  
  try {
    const prazo = new Date(os.prazo);
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const prazoDia = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
    
    // Urgente se venceu (passado) ou vence hoje
    return prazoDia <= hoje;
  } catch {
    return false;
  }
}

// Formatar prazo para exibição
function formatarPrazo(prazoISO?: string): string {
  if (!prazoISO) return "Sem prazo";
  
  try {
    const prazo = new Date(prazoISO);
    return prazo.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "Data inválida";
  }
}

// Verificar status do prazo
function getStatusPrazo(prazoISO?: string): "vencido" | "hoje" | "futuro" | "sem_prazo" {
  if (!prazoISO) return "sem_prazo";
  
  try {
    const prazo = new Date(prazoISO);
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const prazoDia = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
    
    const diffDias = Math.floor((prazoDia.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDias < 0) return "vencido";
    if (diffDias === 0) return "hoje";
    return "futuro";
  } catch {
    return "sem_prazo";
  }
}

// Verificar se foi concluída dentro do prazo
function foiConcluidaDentroDoPrazo(os: TimelineOrdemServico): boolean | null {
  if (os.status !== "concluida" || !os.concluidoAt) return null;
  if (!os.prazo) return true; // Sem prazo = consideramos dentro do prazo
  
  try {
    const prazo = new Date(os.prazo);
    const conclusao = new Date(os.concluidoAt);
    return conclusao <= prazo;
  } catch {
    return null;
  }
}

export function TimelinePrevistoRealizado({ dateISO, equipes, onSelectEquipe, onSelectOS, selectedEquipeId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const equipesScrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [filtrarComProblema, setFiltrarComProblema] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [mostrarRealizado, setMostrarRealizado] = useState(true);
  
  // Config da timeline
  const dayStartMin = 6 * 60; // 06:00
  const dayEndMin = 22 * 60; // 22:00
  const totalMin = dayEndMin - dayStartMin;
  // Largura base menor para caber em telas menores (Dialog ~900px - 224px da coluna equipe = ~680px disponível)
  const widthPx = Math.max(600, Math.round(totalMin * zoom * 0.8));
  const pixelsPerMinute = widthPx / totalMin;

  // Linha do tempo atual (recalculada a cada mudança de zoom)
  const nowMinutes = useMemo(() => {
    const todayISO = format(new Date(), "yyyy-MM-dd");
    if (todayISO !== dateISO) return null;
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, [dateISO]);

  const nowLine = useMemo(() => {
    if (nowMinutes === null) return null;
    if (nowMinutes < dayStartMin || nowMinutes > dayEndMin) return null;
    return Math.round(((nowMinutes - dayStartMin) / totalMin) * widthPx);
  }, [nowMinutes, totalMin, widthPx, dayStartMin, dayEndMin]);

  // Sincronizar scrolls horizontais
  const handleHorizontalScroll = useCallback((scrollLeft: number) => {
    if (headerScrollRef.current && headerScrollRef.current.scrollLeft !== scrollLeft) {
      headerScrollRef.current.scrollLeft = scrollLeft;
    }
    if (timelineScrollRef.current && timelineScrollRef.current.scrollLeft !== scrollLeft) {
      timelineScrollRef.current.scrollLeft = scrollLeft;
    }
  }, []);

  // Sincronizar scroll vertical entre equipes e timeline
  const handleVerticalScroll = useCallback((scrollTop: number) => {
    if (equipesScrollRef.current) {
      const viewport = equipesScrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport && viewport.scrollTop !== scrollTop) {
        viewport.scrollTop = scrollTop;
      }
    }
    if (timelineScrollRef.current && timelineScrollRef.current.scrollTop !== scrollTop) {
      timelineScrollRef.current.scrollTop = scrollTop;
    }
  }, []);

  // Equipes ordenadas por código (para manter mesma ordem do mapa)
  const equipesFiltradas = useMemo(() => {
    let lista = equipes.filter(e => e.turnoAberto || e.ordens.length > 0);
    if (filtrarComProblema) {
      lista = lista.filter(e => e.status !== "normal" && e.status !== "adiantada");
    }
    // Ordenar por código da equipe (alfabeticamente)
    return lista.sort((a, b) => a.codigo.localeCompare(b.codigo));
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
  }, [totalMin, widthPx, dayStartMin]);

  // Scroll para hora atual ou início ao carregar
  useEffect(() => {
    setTimeout(() => {
      // Se há linha AGORA, scrollar para ela
      // Se não há (turno passado), scrollar para o início
      const scrollTo = nowLine ? Math.max(0, nowLine - 300) : 0;
      if (timelineScrollRef.current) {
        timelineScrollRef.current.scrollLeft = scrollTo;
      }
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = scrollTo;
      }
    }, 100);
  }, [nowLine, dateISO]);

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
    <Card className="overflow-hidden border-2 border-primary/20 w-full">
      <CardHeader className="pb-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="text-lg">
          <div className="flex flex-col gap-3">
            {/* Título e Data */}
            <div className="flex items-center justify-between flex-wrap gap-2">
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
              <Badge variant="secondary" className="text-sm">
                {equipesFiltradas.length} equipe{equipesFiltradas.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            {/* Controles */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground">Mostrar Realizado</span>
                <Switch checked={mostrarRealizado} onCheckedChange={setMostrarRealizado} />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground">Só Problemas</span>
                <Switch checked={filtrarComProblema} onCheckedChange={setFiltrarComProblema} />
              </div>
            </div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {/* Controle de Zoom e Legenda */}
        <div className="p-3 border-b bg-muted/20">
          <div className="flex flex-col gap-3">
            {/* Zoom */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Zoom:</span>
              <div className="w-32">
                <Slider
                  value={[zoom]}
                  min={1}
                  max={5}
                  step={0.1}
                  onValueChange={(v) => setZoom(v[0])}
                />
              </div>
              <Badge variant="outline" className="text-xs font-mono">{zoom.toFixed(1)}x</Badge>
            </div>
            
            {/* Legenda */}
            <div className="flex items-center gap-2 text-[9px] flex-wrap">
              <span className="text-muted-foreground font-medium">Legenda:</span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-5 rounded bg-emerald-500 border border-emerald-600" /> No prazo
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-5 rounded bg-red-800 border border-red-900" /> Fora prazo
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-5 rounded bg-red-500/30 border-2 border-red-600" /> Urgente
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-5 rounded border-2 border-orange-500" /> Regulada
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-5 rounded bg-violet-500" /> Em exec.
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-5 rounded bg-amber-500/30 border border-amber-500" /> Int. Prev.
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-5 rounded bg-blue-500/30 border border-blue-500" /> Int. Atual
              </span>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Coluna de equipes (fixa) */}
          <div className="w-56 flex-shrink-0 border-r bg-card">
            <div className="h-12 border-b flex items-center px-3 bg-muted/30">
              <span className="text-sm font-semibold text-muted-foreground">Equipe / Status</span>
            </div>
            <ScrollArea 
              className="max-h-[400px]" 
              ref={equipesScrollRef}
              onScrollCapture={(e: any) => {
                const scrollTop = e.target?.scrollTop;
                if (scrollTop !== undefined) handleVerticalScroll(scrollTop);
              }}
            >
              <div className="divide-y">
                {equipesFiltradas.map((equipe) => {
                  const statusConfig = STATUS_EQUIPE_CONFIG[equipe.status];
                  const StatusIcon = statusConfig.icon;
                  const isExpanded = expandido === equipe.id;
                  const isSelected = selectedEquipeId === equipe.id;
                  const progresso = calcularProgresso(equipe);
                  // Usar mesma lógica de altura da lane da timeline
                  const laneHeight = mostrarRealizado ? (isExpanded ? 120 : 100) : (isExpanded ? 90 : 70);

                  return (
                    <div key={equipe.id}>
                      <button
                        className={cn(
                          "w-full text-left p-2 hover:bg-muted/40 transition-all flex flex-col justify-center",
                          isExpanded && "bg-muted/60",
                          isSelected && "bg-primary/10 border-l-4 border-l-primary"
                        )}
                        style={{ height: laneHeight }}
                        onClick={() => {
                          setExpandido(isExpanded ? null : equipe.id);
                          onSelectEquipe(equipe.id);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm">{equipe.codigo}</span>
                              <Badge 
                                variant="outline" 
                                className={cn("text-[9px] px-1 py-0", statusConfig.bgColor, statusConfig.borderColor)}
                              >
                                <StatusIcon className={cn("h-2.5 w-2.5 mr-0.5", statusConfig.color)} />
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {equipe.nome}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>

                        {/* Barra de progresso */}
                        <div className="mt-1.5">
                          <div className="flex items-center justify-between text-[9px] mb-0.5">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className="font-medium">
                              {progresso.concluidas}/{progresso.total} ({progresso.percentual}%)
                            </span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${progresso.percentual}%` }}
                            />
                          </div>
                        </div>

                        {equipe.minutosDesvio != null && equipe.minutosDesvio !== 0 && (
                          <div className={cn(
                            "text-[10px] font-semibold mt-1 flex items-center gap-1",
                            equipe.minutosDesvio > 0 ? "text-red-600" : "text-emerald-600"
                          )}>
                            {equipe.minutosDesvio > 0 ? (
                              <TrendingDown className="h-2.5 w-2.5" />
                            ) : (
                              <TrendingUp className="h-2.5 w-2.5" />
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
          <div className="flex-1 min-w-0 overflow-x-auto">
            {/* Header com horas - sincronizado horizontalmente */}
            <div className="h-12 border-b relative">
              <div 
                className="h-full overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent" 
                ref={headerScrollRef}
                style={{ scrollbarWidth: 'thin' }}
              >
                <div className="relative h-full" style={{ width: widthPx, minWidth: widthPx }}>
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
                  {/* Linha AGORA no header */}
                  {nowLine != null && (
                    <div className="absolute top-0 bottom-0 z-50" style={{ left: nowLine }}>
                      <div className="h-full w-[3px] bg-red-500 shadow-lg shadow-red-500/30" />
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                        AGORA
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lanes das equipes */}
            <div 
              className="max-h-[400px] overflow-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent" 
              ref={timelineScrollRef}
              style={{ scrollbarWidth: 'thin' }}
              onScroll={(e: any) => {
                const target = e.target as HTMLElement;
                if (target) {
                  handleVerticalScroll(target.scrollTop);
                  handleHorizontalScroll(target.scrollLeft);
                }
              }}
            >
              <div className="relative" style={{ width: widthPx, minWidth: widthPx }}>
                {equipesFiltradas.map((equipe) => {
                  const isExpanded = expandido === equipe.id;
                  const isSelected = selectedEquipeId === equipe.id;
                  const laneHeight = mostrarRealizado ? (isExpanded ? 120 : 100) : (isExpanded ? 90 : 70);

                  return (
                    <div
                      key={equipe.id}
                      className={cn(
                        "relative border-b transition-all",
                        isExpanded && "bg-primary/5",
                        isSelected && "bg-primary/10"
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
                          className="absolute top-0 bottom-0 w-[3px] bg-red-500/40 z-40"
                          style={{ left: nowLine }}
                        />
                      )}

                      {/* Labels das linhas */}
                      <div className="absolute left-2 top-2 text-[8px] font-bold text-primary/60 uppercase tracking-wider z-10">
                        Previsto
                      </div>
                      {mostrarRealizado && (
                        <div className="absolute left-2 top-[52px] text-[8px] font-bold text-emerald-600/60 uppercase tracking-wider z-10">
                          Realizado
                        </div>
                      )}

                      {/* === INTERVALOS PREVISTOS (apenas marcados como previsto === true) === */}
                      {equipe.intervalos.filter(i => i.previsto === true).map((intervalo) => {
                        const startMin = toMinutes(intervalo.horaInicio);
                        const duracao = intervalo.duracaoMinutos || 60;
                        const endMin = toMinutes(intervalo.horaFim) || (startMin ? startMin + duracao : null);
                        if (!startMin) return null;
                        const endMinFinal = endMin || startMin + duracao;

                        const startX = Math.max(0, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                        const endX = Math.min(widthPx, Math.round(((endMinFinal - dayStartMin) / totalMin) * widthPx));
                        const w = Math.max(30, endX - startX);

                        return (
                          <TooltipProvider key={`int-prev-${intervalo.id}`}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute rounded-md bg-amber-500/20 border-2 border-dashed border-amber-500 flex items-center justify-center z-20"
                                  style={{ 
                                    left: startX, 
                                    width: w, 
                                    top: 16,
                                    height: 34
                                  }}
                                >
                                  <Coffee className="h-4 w-4 text-amber-600" />
                                  <span className="ml-1 text-[9px] font-medium text-amber-700">
                                    {intervalo.tipo.toLowerCase().includes('almoço') || intervalo.tipo.toLowerCase().includes('almoco') ? 'Almoço' : intervalo.tipo}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-card border shadow-xl">
                                <div className="font-semibold flex items-center gap-2">
                                  <Coffee className="h-4 w-4 text-amber-500" />
                                  {intervalo.tipo} (Previsto)
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {minutesToTime(startMin)} - {minutesToTime(endMinFinal)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Duração: {duracao}min
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}

                      {/* === INTERVALOS REALIZADOS (não previstos - previsto !== true) === */}
                      {equipe.intervalos.filter(i => i.previsto !== true).map((intervalo) => {
                        // Extrair hora corretamente sem conversão de timezone
                        const horaInicioStr = intervalo.horaInicio?.includes('T') 
                          ? extractTimeFromISO(intervalo.horaInicio) 
                          : intervalo.horaInicio;
                        const horaFimStr = intervalo.horaFim?.includes('T') 
                          ? extractTimeFromISO(intervalo.horaFim) 
                          : intervalo.horaFim;
                        
                        const startMin = toMinutes(horaInicioStr);
                        const duracao = intervalo.duracaoMinutos || 30;
                        const currentNowMin = nowMinutes || (new Date().getHours() * 60 + new Date().getMinutes());
                        const endMin = toMinutes(horaFimStr) || currentNowMin; // Se não terminou, usar hora atual
                        
                        if (!startMin) return null;

                        const startX = Math.max(0, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                        const endX = Math.min(widthPx, Math.round(((endMin - dayStartMin) / totalMin) * widthPx));
                        const w = Math.max(20, endX - startX);
                        const emAndamento = !intervalo.horaFim;

                        return (
                          <TooltipProvider key={`int-real-${intervalo.id}`}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "absolute rounded-md bg-blue-500/30 border-2 border-blue-500 flex items-center justify-center z-20",
                                    emAndamento && "animate-pulse border-dashed"
                                  )}
                                  style={{ 
                                    left: startX, 
                                    width: w, 
                                    top: mostrarRealizado ? 54 : 16,
                                    height: 30
                                  }}
                                >
                                  <Coffee className="h-4 w-4 text-blue-600" />
                                  {w > 60 && (
                                    <span className="ml-1 text-[9px] font-medium text-blue-700">
                                      {intervalo.tipo}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-card border shadow-xl">
                                <div className="font-semibold flex items-center gap-2">
                                  <Coffee className="h-4 w-4 text-blue-500" />
                                  {intervalo.tipo} {emAndamento && "(Em andamento)"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Início: {horaInicioStr?.slice(0, 5)}
                                </div>
                                {horaFimStr && (
                                  <div className="text-xs text-muted-foreground">
                                    Fim: {horaFimStr?.slice(0, 5)}
                                  </div>
                                )}
                                {emAndamento && (
                                  <div className="text-xs text-blue-600 font-medium">
                                    Duração até agora: {Math.round(currentNowMin - startMin)}min
                                  </div>
                                )}
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
                          
                          // Se não há dados previstos, mostrar as OSs baseado na ordem na rota (distribuição visual)
                          const temDadosPrevistos = startMin && endMin;
                          if (!temDadosPrevistos) {
                            // Calcular posição baseada na ordem na rota - distribuir ao longo do dia de trabalho
                            // Assumir início às 07:00 e ~30min por OS
                            const totalOrdens = equipe.ordens.length || 1;
                            const tempoMedioPorOS = 45; // minutos por OS (deslocamento + execução)
                            const inicioTrabalho = 7 * 60; // 07:00 em minutos
                            
                            const osStartMin = inicioTrabalho + (os.ordemNaRota - 1) * tempoMedioPorOS;
                            const osEndMin = osStartMin + 30; // 30 min de execução
                            
                            // Converter para pixels usando a escala da timeline
                            const osStartX = Math.max(55, Math.round(((osStartMin - dayStartMin) / totalMin) * widthPx));
                            const osEndX = Math.min(widthPx - 5, Math.round(((osEndMin - dayStartMin) / totalMin) * widthPx));
                            const osW = Math.max(50, osEndX - osStartX);
                            
                            const foiConcluida = os.status === "concluida";
                            const dentroDoPrazo = foiConcluidaDentroDoPrazo(os);
                            const urgente = !foiConcluida && isReguladaUrgente(os);

                            return (
                              <TooltipProvider key={`prev-${os.id}`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={cn(
                                        "absolute rounded-md border-2 px-1 flex items-center gap-1 transition-all hover:shadow-lg hover:scale-[1.02] z-30",
                                        foiConcluida && dentroDoPrazo === true && "bg-emerald-500/30 border-solid border-emerald-500",
                                        foiConcluida && dentroDoPrazo === false && "bg-red-900/50 border-solid border-red-900",
                                        foiConcluida && dentroDoPrazo === null && "bg-slate-400/30 border-solid border-slate-500",
                                        !foiConcluida && urgente && "bg-red-500/20 border-solid border-red-500 ring-2 ring-red-400 ring-offset-1 animate-pulse",
                                        !foiConcluida && os.regulada && !urgente && "bg-card/80 backdrop-blur-sm border-dashed border-orange-500 ring-1 ring-orange-400",
                                        !foiConcluida && !os.regulada && "bg-card/80 backdrop-blur-sm border-dashed border-slate-400"
                                      )}
                                      style={{
                                        left: osStartX,
                                        width: osW,
                                        height: 26,
                                        top: 3,
                                      }}
                                      onClick={() => onSelectOS(os.id, equipe.id)}
                                    >
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[8px] h-3.5 px-0.5 shrink-0",
                                          foiConcluida && "bg-emerald-500/30 text-emerald-700 border-emerald-500"
                                        )}
                                      >
                                        {os.ordemNaRota}
                                      </Badge>
                                      <span className="text-[9px] font-medium truncate">
                                        {os.numero}
                                      </span>
                                      {foiConcluida && <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs bg-card border shadow-xl z-50">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{os.ordemNaRota}ª</Badge>
                                        <span className="font-bold">{os.numero}</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground">{os.tipoDescricao || os.tipo}</div>
                                      {os.endereco && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{os.endereco}</div>}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          }
                          
                          // Código original para OSs com dados previstos

                          const startX = Math.max(55, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                          const endX = Math.min(widthPx - 5, Math.round(((endMin - dayStartMin) / totalMin) * widthPx));
                          const w = Math.max(35, endX - startX);
                          
                          // Verificar status de conclusão
                          const foiConcluida = os.status === "concluida";
                          const dentroDoPrazo = foiConcluidaDentroDoPrazo(os);
                          
                          // Verificar se é regulada urgente (vencida ou vencendo hoje) - apenas para não concluídas
                          const urgente = !foiConcluida && isReguladaUrgente(os);
                          const statusPrazo = getStatusPrazo(os.prazo);

                          // Calcular linha de deslocamento para a próxima OS
                          const nextOS = equipe.ordens[idx + 1];
                          let deslocamentoLine = null;
                          if (nextOS) {
                            const nextStartMin = toMinutes(nextOS.horaInicioEstimada);
                            if (nextStartMin && endMin < nextStartMin) {
                              const deslocStartX = endX;
                              const deslocEndX = Math.round(((nextStartMin - dayStartMin) / totalMin) * widthPx);
                              const deslocW = deslocEndX - deslocStartX;
                              const tempoDeslocMin = nextStartMin - endMin;
                              const distanciaKm = nextOS.distanciaKm || 0;
                              
                              if (deslocW > 5) {
                                deslocamentoLine = (
                                  <TooltipProvider key={`desloc-${os.id}-${nextOS.id}`}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div 
                                          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-slate-300 to-slate-400 rounded-full opacity-70 hover:opacity-100 cursor-help"
                                          style={{ left: deslocStartX, width: deslocW }}
                                        >
                                          <Navigation className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="bg-card border shadow-xl">
                                        <div className="space-y-1">
                                          <div className="font-semibold flex items-center gap-2">
                                            <Car className="h-4 w-4 text-slate-500" />
                                            Deslocamento
                                          </div>
                                          <div className="text-xs">
                                            <span className="font-medium">De:</span> OS {os.numero} ({os.ordemNaRota}ª)
                                          </div>
                                          <div className="text-xs">
                                            <span className="font-medium">Para:</span> OS {nextOS.numero} ({nextOS.ordemNaRota}ª)
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3 inline mr-1" />
                                            Tempo: ~{Math.round(tempoDeslocMin)}min
                                          </div>
                                          {distanciaKm > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                              <Route className="h-3 w-3 inline mr-1" />
                                              Distância: {distanciaKm.toFixed(1)}km
                                            </div>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              }
                            }
                          }

                          // Primeiro deslocamento (da base para primeira OS)
                          let primeiroDeslocamento = null;
                          if (idx === 0 && os.tempoDeslocamentoMinutos && os.tempoDeslocamentoMinutos > 0) {
                            const deslocInicioMin = startMin - os.tempoDeslocamentoMinutos;
                            if (deslocInicioMin >= dayStartMin) {
                              const deslocStartX = Math.round(((deslocInicioMin - dayStartMin) / totalMin) * widthPx);
                              const deslocEndX = startX;
                              const deslocW = deslocEndX - deslocStartX;
                              
                              if (deslocW > 5) {
                                primeiroDeslocamento = (
                                  <TooltipProvider key={`desloc-inicio-${os.id}`}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div 
                                          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-emerald-300 to-slate-300 rounded-full opacity-70 hover:opacity-100 cursor-help"
                                          style={{ left: deslocStartX, width: deslocW }}
                                        >
                                          <MapPin className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-3 text-emerald-500" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="bg-card border shadow-xl">
                                        <div className="space-y-1">
                                          <div className="font-semibold flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-emerald-500" />
                                            Saída da Base
                                          </div>
                                          <div className="text-xs">
                                            <span className="font-medium">Para:</span> OS {os.numero} (1ª)
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3 inline mr-1" />
                                            Tempo: ~{os.tempoDeslocamentoMinutos}min
                                          </div>
                                          {os.distanciaKm && os.distanciaKm > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                              <Route className="h-3 w-3 inline mr-1" />
                                              Distância: {os.distanciaKm.toFixed(1)}km
                                            </div>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              }
                            }
                          }

                          return (
                            <div key={`prev-${os.id}`}>
                              {primeiroDeslocamento}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={cn(
                                        "absolute rounded-md border-2 px-1 flex items-center gap-1 transition-all hover:shadow-lg hover:scale-[1.02] z-30",
                                        // Concluída dentro do prazo: verde
                                        foiConcluida && dentroDoPrazo === true && "bg-emerald-500/30 border-solid border-emerald-500",
                                        // Concluída fora do prazo: vermelho escuro (maroon) - bem diferente de urgente
                                        foiConcluida && dentroDoPrazo === false && "bg-red-900/50 border-solid border-red-900",
                                        // Concluída sem prazo: cinza mais escuro
                                        foiConcluida && dentroDoPrazo === null && "bg-slate-400/30 border-solid border-slate-500",
                                        // Não concluída - Urgente: vermelho pulsante com ring
                                        !foiConcluida && urgente && "bg-red-500/20 border-solid border-red-500 ring-2 ring-red-400 ring-offset-1 animate-pulse",
                                        // Não concluída - Regulada mas não urgente: laranja
                                        !foiConcluida && os.regulada && !urgente && "bg-card/80 backdrop-blur-sm border-dashed border-orange-500 ring-1 ring-orange-400",
                                        // Não concluída - Normal: cinza tracejado
                                        !foiConcluida && !os.regulada && "bg-card/80 backdrop-blur-sm border-dashed border-slate-400"
                                      )}
                                      style={{
                                        left: startX,
                                        width: w,
                                        height: 26,
                                        top: 3,
                                      }}
                                      onClick={() => onSelectOS(os.id, equipe.id)}
                                    >
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[8px] h-3.5 px-0.5 shrink-0",
                                          foiConcluida && dentroDoPrazo === true && "bg-emerald-500/30 text-emerald-700 border-emerald-500",
                                          foiConcluida && dentroDoPrazo === false && "bg-red-900/50 text-white border-red-900",
                                          urgente && "bg-red-500/30 text-red-700 border-red-500",
                                          !foiConcluida && !urgente && "bg-muted/50"
                                        )}
                                      >
                                        {os.ordemNaRota}
                                      </Badge>
                                      <span className={cn(
                                        "text-[9px] font-medium truncate",
                                        foiConcluida && dentroDoPrazo === true && "text-emerald-700",
                                        foiConcluida && dentroDoPrazo === false && "text-white",
                                        urgente && "text-red-700 font-bold",
                                        !foiConcluida && !urgente && "text-foreground"
                                      )}>
                                        {os.numero}
                                      </span>
                                      {foiConcluida && dentroDoPrazo === true && (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                      )}
                                      {foiConcluida && dentroDoPrazo === false && (
                                        <XCircle className="h-3 w-3 text-white shrink-0" />
                                      )}
                                      {!foiConcluida && urgente && (
                                        <AlertTriangle className="h-3 w-3 text-red-600 shrink-0 animate-pulse" />
                                      )}
                                      {!foiConcluida && os.regulada && !urgente && (
                                        <Zap className="h-3 w-3 text-orange-500 shrink-0" />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs bg-card border shadow-xl z-50">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs">{os.ordemNaRota}ª</Badge>
                                        <span className="font-bold">{os.numero}</span>
                                        {foiConcluida && dentroDoPrazo === true && (
                                          <Badge className="text-[10px] bg-emerald-500">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            NO PRAZO
                                          </Badge>
                                        )}
                                        {foiConcluida && dentroDoPrazo === false && (
                                          <Badge className="text-[10px] bg-red-900 text-white">
                                            <XCircle className="h-3 w-3 mr-1" />
                                            FORA PRAZO
                                          </Badge>
                                        )}
                                        {!foiConcluida && urgente && (
                                          <Badge variant="destructive" className="text-[10px] bg-red-600">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            URGENTE
                                          </Badge>
                                        )}
                                        {!foiConcluida && os.regulada && !urgente && (
                                          <Badge className="text-[10px] bg-orange-500">Regulada</Badge>
                                        )}
                                      </div>
                                      <div className="text-xs font-medium text-foreground">
                                        {os.tipoDescricao || os.tipo}
                                      </div>
                                      {os.endereco && (
                                        <div className="text-xs text-muted-foreground flex items-start gap-1">
                                          <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                                          {os.endereco}
                                        </div>
                                      )}
                                      {os.prazo && (
                                        <div className={cn(
                                          "flex items-center gap-2 text-xs rounded px-2 py-1",
                                          statusPrazo === "vencido" && "bg-red-500/20 text-red-700",
                                          statusPrazo === "hoje" && "bg-orange-500/20 text-orange-700",
                                          statusPrazo === "futuro" && "bg-slate-500/10 text-muted-foreground"
                                        )}>
                                          <Timer className="h-3 w-3" />
                                          <span className="font-medium">Prazo:</span>
                                          <span className={cn(statusPrazo === "vencido" && "font-bold")}>
                                            {formatarPrazo(os.prazo)}
                                          </span>
                                          {statusPrazo === "vencido" && <span className="text-red-600 font-bold">(VENCIDO)</span>}
                                          {statusPrazo === "hoje" && <span className="text-orange-600 font-bold">(HOJE)</span>}
                                        </div>
                                      )}
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
                        <div className="absolute left-0 right-0" style={{ top: 54, height: 32 }}>
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
                                  // Limitar ao momento atual (não pode ir além de nowMinutes)
                                  const currentNowMin = nowMinutes || (new Date().getHours() * 60 + new Date().getMinutes());
                                  if (startMin && startMin <= currentNowMin) {
                                    const startX = Math.max(55, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                                    let endX = Math.round(((currentNowMin - dayStartMin) / totalMin) * widthPx);
                                    // Garantir que não ultrapasse a linha do AGORA
                                    if (nowLine != null) {
                                      endX = Math.min(endX, nowLine - 2);
                                    }
                                    const w = Math.max(30, Math.max(0, endX - startX));
                                    
                                    return (
                                      <div
                                        key={`real-${os.id}`}
                                        className="absolute rounded-full bg-sky-400 border border-sky-500 flex items-center justify-center gap-1 px-2 z-30"
                                        style={{
                                          left: startX,
                                          width: w,
                                          height: 22,
                                          top: 5,
                                        }}
                                      >
                                        <Navigation className="h-3 w-3 text-white animate-pulse" />
                                        <span className="text-[8px] text-white font-medium">Deslocando</span>
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
                            
                            // Se não concluiu, usar hora atual como fim temporário (mas não além de nowMinutes)
                            const currentNowMin = nowMinutes || (new Date().getHours() * 60 + new Date().getMinutes());
                            let endMin = endMinReal;
                            if (!endMin && os.status !== "concluida") {
                              endMin = currentNowMin;
                            }
                            
                            if (!startMin || !endMin) return null;
                            
                            // Garantir que não ultrapasse o momento atual para OSs não concluídas
                            const finalEndMin = os.status !== "concluida" ? Math.min(endMin, currentNowMin) : endMin;

                            const startX = Math.max(55, Math.round(((startMin - dayStartMin) / totalMin) * widthPx));
                            // Garantir que não ultrapasse a linha do AGORA para OSs não concluídas
                            let endX = Math.round(((finalEndMin - dayStartMin) / totalMin) * widthPx);
                            if (os.status !== "concluida" && nowLine != null) {
                              endX = Math.min(endX, nowLine - 2); // -2px para garantir que fica antes da linha
                            }
                            endX = Math.min(widthPx - 5, endX);
                            const w = Math.max(35, Math.max(0, endX - startX));
                            const colors = getStatusColor(os.status);

                            return (
                              <TooltipProvider key={`real-${os.id}`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={cn(
                                        "absolute rounded-md border px-1 flex items-center gap-1 transition-all hover:shadow-lg hover:scale-[1.02] z-30",
                                        colors.bg,
                                        colors.border,
                                        os.status !== "concluida" && "animate-pulse"
                                      )}
                                      style={{
                                        left: startX,
                                        width: w,
                                        height: 22,
                                        top: 5,
                                      }}
                                      onClick={() => onSelectOS(os.id, equipe.id)}
                                    >
                                      <Badge
                                        variant="secondary"
                                        className={cn("text-[8px] h-3.5 px-0.5 bg-white/20 shrink-0", colors.text)}
                                      >
                                        {os.ordemNaRota}
                                      </Badge>
                                      <span className={cn("text-[9px] font-medium truncate", colors.text)}>
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
                                  <TooltipContent side="top" className="max-w-xs bg-card border shadow-xl z-50">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{os.ordemNaRota}ª</Badge>
                                        <span className="font-bold">{os.numero}</span>
                                        <Badge className={cn("text-[10px]", colors.bg)}>{os.status}</Badge>
                                        {isReguladaUrgente(os) && (
                                          <Badge variant="destructive" className="text-[10px] bg-red-600">URGENTE</Badge>
                                        )}
                                      </div>
                                      <div className="text-xs font-medium text-foreground">
                                        {os.tipoDescricao || os.tipo}
                                      </div>
                                      {os.prazo && (
                                        <div className={cn(
                                          "flex items-center gap-2 text-xs rounded px-2 py-1",
                                          getStatusPrazo(os.prazo) === "vencido" && "bg-red-500/20 text-red-700",
                                          getStatusPrazo(os.prazo) === "hoje" && "bg-orange-500/20 text-orange-700",
                                          getStatusPrazo(os.prazo) === "futuro" && "bg-slate-500/10 text-muted-foreground"
                                        )}>
                                          <Timer className="h-3 w-3" />
                                          <span className="font-medium">Prazo:</span>
                                          {formatarPrazo(os.prazo)}
                                        </div>
                                      )}
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
                        <div className="absolute bottom-2 left-16 right-4 flex items-center gap-4 text-[9px] z-10">
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
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TimelinePrevistoRealizado;
