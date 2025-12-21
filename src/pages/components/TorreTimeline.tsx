import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, Route, Activity, MapPin } from "lucide-react";

type OSStatus =
  | "pendente"
  | "planejada"
  | "em_deslocamento"
  | "no_local"
  | "em_execucao"
  | "em_andamento"
  | "pausada"
  | "concluida"
  | "cancelada"
  | string;

export interface TimelineEquipe {
  id: string;
  codigo: string;
  nome: string;
}

export interface TimelineOrdem {
  id: string;
  equipe_id: string;
  ordem_na_rota: number;
  hora_inicio_estimada?: string | null; // HH:mm:ss
  hora_fim_estimada?: string | null; // HH:mm:ss
  ordens_servico: {
    id: string;
    numero: string;
    tipo: string;
    status: OSStatus;
    regulada?: boolean | null;
  } | null;
}

export interface TimelineRotaEquipe {
  equipe: TimelineEquipe;
  ordens: TimelineOrdem[];
}

export interface TimelineAlerta {
  id: string;
  equipeId?: string;
  osId?: string;
  createdAt: string;
  severidade: "critical" | "high" | "medium" | "low";
  titulo: string;
}

export interface TimelineLog {
  id: string;
  ordem_servico_id?: string | null;
  acao?: string | null;
  descricao?: string | null;
  created_at: string;
}

interface Props {
  dateISO: string; // YYYY-MM-DD
  rotas: TimelineRotaEquipe[];
  alertas: TimelineAlerta[];
  logs: TimelineLog[];
  offlineThresholdMin: number;
  onSelectEquipe: (equipeId: string) => void;
  onSelectOS: (osId: string, equipeId?: string) => void;
}

function toMinutes(hhmmss?: string | null): number | null {
  if (!hhmmss) return null;
  const [hh, mm, ss] = hhmmss.split(":").map((x) => Number(x));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm + (Number.isNaN(ss) ? 0 : ss / 60);
}

function statusColor(status: OSStatus) {
  if (status === "concluida") return { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-800 dark:text-green-300" };
  if (status === "cancelada") return { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-700 dark:text-slate-300" };
  if (status === "pausada") return { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-800 dark:text-amber-300" };
  if (status === "em_deslocamento" || status === "no_local") return { bg: "bg-sky-500/15", border: "border-sky-500/40", text: "text-sky-800 dark:text-sky-300" };
  if (status === "em_execucao" || status === "em_andamento") return { bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-800 dark:text-violet-300" };
  return { bg: "bg-muted/40", border: "border-border", text: "text-foreground" };
}

function sevDot(sev: TimelineAlerta["severidade"]) {
  if (sev === "critical") return "bg-destructive";
  if (sev === "high") return "bg-orange-500";
  if (sev === "medium") return "bg-yellow-500";
  return "bg-sky-500";
}

export default function TorreTimeline({
  dateISO,
  rotas,
  alertas,
  logs,
  offlineThresholdMin,
  onSelectEquipe,
  onSelectOS,
}: Props) {
  const [zoom, setZoom] = useState(1.4); // px/min
  const [mostrarAlertas, setMostrarAlertas] = useState(true);
  const [mostrarLogs, setMostrarLogs] = useState(true);
  const [mostrarSomenteComOcorrencias, setMostrarSomenteComOcorrencias] = useState(false);

  const dayStartMin = 6 * 60;
  const dayEndMin = 20 * 60;
  const totalMin = dayEndMin - dayStartMin;
  const widthPx = Math.max(900, Math.round(totalMin * zoom));

  const nowLine = useMemo(() => {
    const todayISO = format(new Date(), "yyyy-MM-dd");
    if (todayISO !== dateISO) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < dayStartMin || nowMin > dayEndMin) return null;
    return Math.round(((nowMin - dayStartMin) / totalMin) * widthPx);
  }, [dateISO, totalMin, widthPx]);

  const index = useMemo(() => {
    const osToEquipe = new Map<string, { equipeId: string; equipeCodigo: string }>();
    const osToPlannedEnd = new Map<string, number>();
    for (const r of rotas) {
      for (const o of r.ordens) {
        const os = o.ordens_servico;
        if (!os) continue;
        osToEquipe.set(os.id, { equipeId: r.equipe.id, equipeCodigo: r.equipe.codigo });
        const end = toMinutes(o.hora_fim_estimada);
        if (end != null) osToPlannedEnd.set(os.id, end);
      }
    }
    return { osToEquipe, osToPlannedEnd };
  }, [rotas]);

  const lanes = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayISO = format(now, "yyyy-MM-dd");

    const lanes = rotas.map((r) => {
      const blocks = r.ordens
        .map((o) => {
          const start = toMinutes(o.hora_inicio_estimada);
          const end = toMinutes(o.hora_fim_estimada);
          if (start == null || end == null || !o.ordens_servico) return null;
          const os = o.ordens_servico;
          const late = todayISO === dateISO && nowMin > end && os.status !== "concluida" && os.status !== "cancelada";
          return {
            osId: os.id,
            ordemNaRota: o.ordem_na_rota,
            numero: os.numero,
            tipo: os.tipo,
            regulada: !!os.regulada,
            status: os.status,
            start,
            end,
            late,
          };
        })
        .filter(Boolean) as Array<{
        osId: string;
        ordemNaRota: number;
        numero: string;
        tipo: string;
        regulada: boolean;
        status: OSStatus;
        start: number;
        end: number;
        late: boolean;
      }>;

      const alertEvents = mostrarAlertas
        ? alertas
            .filter((a) => {
              if (a.equipeId) return a.equipeId === r.equipe.id;
              if (a.osId) return index.osToEquipe.get(a.osId)?.equipeId === r.equipe.id;
              return false;
            })
            .map((a) => {
              const at = new Date(a.createdAt);
              const atMin = at.getHours() * 60 + at.getMinutes();
              return {
                kind: "alert" as const,
                id: a.id,
                atMin,
                title: a.titulo,
                severidade: a.severidade,
                osId: a.osId,
              };
            })
        : [];

      const logEvents = mostrarLogs
        ? logs
            .filter((l) => {
              const osId = l.ordem_servico_id ? String(l.ordem_servico_id) : null;
              if (!osId) return false;
              return index.osToEquipe.get(osId)?.equipeId === r.equipe.id;
            })
            .map((l) => {
              const at = new Date(l.created_at);
              const atMin = at.getHours() * 60 + at.getMinutes();
              return {
                kind: "log" as const,
                id: l.id,
                atMin,
                title: l.descricao || l.acao || "Evento",
                osId: l.ordem_servico_id ? String(l.ordem_servico_id) : undefined,
              };
            })
        : [];

      // Offline proxy: se não houver logs no dia e nenhuma OS mexida, consideramos offline.
      const lastChange = logEvents.length > 0 ? Math.max(...logEvents.map((e) => e.atMin)) : null;
      const offline = todayISO === dateISO && lastChange != null ? nowMin - lastChange >= offlineThresholdMin : false;

      const hasOccurrences = alertEvents.length > 0 || logEvents.length > 0 || blocks.some((b) => b.late);

      return {
        equipe: r.equipe,
        blocks,
        alertEvents,
        logEvents,
        offline,
        hasOccurrences,
      };
    });

    return mostrarSomenteComOcorrencias ? lanes.filter((l) => l.hasOccurrences) : lanes;
  }, [rotas, alertas, logs, dateISO, offlineThresholdMin, mostrarAlertas, mostrarLogs, mostrarSomenteComOcorrencias, index.osToEquipe]);

  const hours = useMemo(() => {
    const list: Array<{ label: string; x: number; min: number }> = [];
    for (let h = 6; h <= 20; h++) {
      const min = h * 60;
      const x = Math.round(((min - dayStartMin) / totalMin) * widthPx);
      list.push({ label: `${String(h).padStart(2, "0")}:00`, x, min });
    }
    return list;
  }, [dayStartMin, totalMin, widthPx]);

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            Linha do Tempo (todas as equipes)
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{lanes.length} equipes</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground mb-2">Zoom</div>
            <div className="flex items-center gap-3">
              <Slider
                value={[zoom]}
                min={0.9}
                max={2.8}
                step={0.1}
                onValueChange={(v) => setZoom(v[0] ?? 1.4)}
              />
              <Badge variant="secondary" className="min-w-[58px] justify-center">
                {zoom.toFixed(1)}x
              </Badge>
            </div>
          </div>
          <div className="rounded-lg border p-3 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Eventos</div>
              <div className="text-xs text-muted-foreground">Sobrepor alertas e logs no dia.</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Alertas</span>
                <Switch checked={mostrarAlertas} onCheckedChange={setMostrarAlertas} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Logs</span>
                <Switch checked={mostrarLogs} onCheckedChange={setMostrarLogs} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border p-3 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Filtro</div>
              <div className="text-xs text-muted-foreground">Mostrar só equipes com ocorrências.</div>
            </div>
            <Switch checked={mostrarSomenteComOcorrencias} onCheckedChange={setMostrarSomenteComOcorrencias} />
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <div className="grid grid-cols-12 bg-muted/40 border-b">
            <div className="col-span-3 p-3">
              <div className="text-xs text-muted-foreground">Equipe</div>
            </div>
            <div className="col-span-9 p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> {format(new Date(`${dateISO}T12:00:00`), "EEEE, dd/MM", { locale: ptBR })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12">
            <div className="col-span-3 border-r bg-card">
              <ScrollArea className="h-[560px]">
                <div className="divide-y">
                  {lanes.map((l) => (
                    <button
                      key={l.equipe.id}
                      className={cn("w-full text-left p-3 hover:bg-muted/30 transition")}
                      onClick={() => onSelectEquipe(l.equipe.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{l.equipe.codigo}</div>
                        {l.offline ? (
                          <Badge variant="secondary" className="text-[10px]">
                            offline
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{l.equipe.nome}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {l.blocks.some((b) => b.late) ? (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> atraso
                          </Badge>
                        ) : null}
                        {(l.alertEvents.length > 0 || l.logEvents.length > 0) ? (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Activity className="h-3 w-3" /> {l.alertEvents.length + l.logEvents.length} eventos
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">sem eventos</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="col-span-9 bg-card">
              <div className="relative">
                {/* header axis */}
                <div className="relative h-10 border-b bg-card">
                  <div className="absolute inset-0" style={{ width: widthPx }}>
                    {hours.map((h) => (
                      <div key={h.label} className="absolute top-0 bottom-0" style={{ left: h.x }}>
                        <div className="h-full w-px bg-border" />
                        <div className="absolute top-2 left-1 text-[10px] text-muted-foreground">{h.label}</div>
                      </div>
                    ))}
                    {nowLine != null ? (
                      <div className="absolute top-0 bottom-0" style={{ left: nowLine }}>
                        <div className="h-full w-[2px] bg-destructive/70" />
                      </div>
                    ) : null}
                  </div>
                </div>

                <ScrollArea className="h-[560px]">
                  <div className="relative" style={{ width: widthPx }}>
                    <div className="divide-y">
                      {lanes.map((l) => (
                        <div key={l.equipe.id} className="relative h-[58px]">
                          {nowLine != null ? (
                            <div className="absolute top-0 bottom-0" style={{ left: nowLine }}>
                              <div className="h-full w-[2px] bg-destructive/40" />
                            </div>
                          ) : null}

                          {/* planned blocks */}
                          {l.blocks.map((b) => {
                            const startX = Math.round(((b.start - dayStartMin) / totalMin) * widthPx);
                            const endX = Math.round(((b.end - dayStartMin) / totalMin) * widthPx);
                            const w = Math.max(10, endX - startX);
                            const c = statusColor(b.status);
                            return (
                              <button
                                key={b.osId}
                                className={cn(
                                  "absolute top-2 h-10 rounded-md border px-2 flex items-center gap-2 overflow-hidden",
                                  c.bg,
                                  c.border,
                                  b.late && "ring-1 ring-destructive/60"
                                )}
                                style={{ left: startX, width: w }}
                                title={`${l.equipe.codigo} • #${b.ordemNaRota} • ${b.numero} • ${b.tipo}`}
                                onClick={() => onSelectOS(b.osId, l.equipe.id)}
                              >
                                <Badge variant="secondary" className="text-[10px] h-5">
                                  #{b.ordemNaRota}
                                </Badge>
                                <span className={cn("text-xs font-medium truncate", c.text)}>{b.numero}</span>
                                {b.regulada ? (
                                  <span className="ml-auto text-[10px] font-semibold text-destructive">REG</span>
                                ) : null}
                              </button>
                            );
                          })}

                          {/* events */}
                          {l.alertEvents.map((e) => {
                            const x = Math.round(((e.atMin - dayStartMin) / totalMin) * widthPx);
                            if (x < 0 || x > widthPx) return null;
                            return (
                              <button
                                key={e.id}
                                className="absolute top-[44px] -translate-x-1/2"
                                style={{ left: x }}
                                title={`Alerta • ${e.title}`}
                                onClick={() => {
                                  if (e.osId) onSelectOS(e.osId, l.equipe.id);
                                  else onSelectEquipe(l.equipe.id);
                                }}
                              >
                                <span className={cn("block h-2.5 w-2.5 rounded-full", sevDot(e.severidade))} />
                              </button>
                            );
                          })}

                          {l.logEvents.map((e) => {
                            const x = Math.round(((e.atMin - dayStartMin) / totalMin) * widthPx);
                            if (x < 0 || x > widthPx) return null;
                            return (
                              <button
                                key={e.id}
                                className="absolute top-[44px] -translate-x-1/2"
                                style={{ left: x }}
                                title={`Evento • ${e.title}`}
                                onClick={() => {
                                  if (e.osId) onSelectOS(e.osId, l.equipe.id);
                                  else onSelectEquipe(l.equipe.id);
                                }}
                              >
                                <span className="block h-2.5 w-2.5 rotate-45 bg-foreground/40" />
                              </button>
                            );
                          })}

                          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-60">
                            <MapPin className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Alerta crítico
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Alerta alto
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Alerta médio
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Alerta baixo
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rotate-45 bg-foreground/40" /> Evento (log)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

