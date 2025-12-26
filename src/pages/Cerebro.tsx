import { useEffect, useMemo, useState } from "react";
import { addDays, format, isPast, isToday, parseISO, startOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { buscarRotaOSRM } from "@/services/osrm";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ChatTorreControle } from "@/components/chat/ChatTorreControle";
import MapaTorreControle, { type TorreMapaPoint, type TorreRouteGeometry } from "@/pages/components/MapaTorreControle";

import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Crosshair,
  Filter,
  HeartPulse,
  MapPin,
  MessageSquareText,
  Phone,
  RefreshCcw,
  Route,
  Shield,
  Sparkles,
  Timer,
  UserCheck,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";

type Severidade = "critical" | "high" | "medium" | "low";
type AlertKind =
  | "os_urgente_sem_campo"
  | "rota_atrasada"
  | "equipe_ociosa"
  | "offline"
  | "manual";

type AlertStatus = "open" | "acknowledged" | "assigned" | "snoozed" | "resolved";

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  telefone?: string | null;
  status?: string | null;
}

interface PlanejamentoOrdem {
  id: string;
  planejamento_id: string;
  equipe_id: string;
  ordem_na_rota: number;
  hora_inicio_estimada?: string | null;
  hora_fim_estimada?: string | null;
  ordens_servico: {
    id: string;
    numero: string;
    tipo: string;
    status: string;
    endereco: string;
    cliente_nome?: string | null;
    prazo?: string | null;
    regulada?: boolean | null;
    latitude?: number | null;
    longitude?: number | null;
    updated_at?: string | null;
    deslocamento_iniciado_at?: string | null;
    chegada_local_at?: string | null;
    execucao_iniciada_at?: string | null;
    concluido_at?: string | null;
    pausado_at?: string | null;
  } | null;
  tecnicos: {
    id: string;
    codigo: string;
    nome: string;
    telefone?: string | null;
    status?: string | null;
  } | null;
}

interface RouteEquipe {
  equipe: Equipe;
  ordens: PlanejamentoOrdem[];
  planejamentoId: string;
}

interface BrainEvent {
  id: string; // db:... | engine:...
  kind: AlertKind;
  severidade: Severidade;
  status: AlertStatus;
  titulo: string;
  descricao: string;
  equipeId?: string;
  equipeCodigo?: string;
  osId?: string;
  osNumero?: string;
  createdAt: string;
  source: "db" | "engine";
  dbId?: string;
  snoozedUntil?: string | null;
  assignedTo?: string | null;
  acknowledgedBy?: string | null;
}

const MOTIVOS: Array<{ grupo: string; itens: string[] }> = [
  { grupo: "Operação", itens: ["Replanejamento", "Priorização alterada", "Apoio solicitado", "Falta de equipe"] },
  { grupo: "Campo", itens: ["Equipe sem sinal", "Cliente ausente", "Acesso impedido", "Parada imprevista"] },
  { grupo: "Técnico", itens: ["Material faltante", "Falha de equipamento", "Necessita especialista", "Dúvida técnica"] },
  { grupo: "Sistema", itens: ["Status incorreto", "OS duplicada", "Cadastro incompleto", "Erro de integração"] },
];

function dateToISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function toMinutes(hhmmss?: string | null): number | null {
  if (!hhmmss) return null;
  const [hh, mm, ss] = hhmmss.split(":").map((x) => Number(x));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm + (Number.isNaN(ss) ? 0 : ss / 60);
}

function diffMinutes(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60000);
}

function computeLastUpdate(ordens: PlanejamentoOrdem[]): Date | null {
  const dates: Date[] = [];
  for (const o of ordens) {
    const os = o.ordens_servico;
    if (!os) continue;
    if (os.updated_at) dates.push(new Date(os.updated_at));
    if (os.deslocamento_iniciado_at) dates.push(new Date(os.deslocamento_iniciado_at));
    if (os.chegada_local_at) dates.push(new Date(os.chegada_local_at));
    if (os.execucao_iniciada_at) dates.push(new Date(os.execucao_iniciada_at));
    if (os.concluido_at) dates.push(new Date(os.concluido_at));
    if (os.pausado_at) dates.push(new Date(os.pausado_at));
  }
  if (dates.length === 0) return null;
  dates.sort((a, b) => b.getTime() - a.getTime());
  return dates[0];
}

function computeEquipeProgress(ordens: PlanejamentoOrdem[]) {
  const total = ordens.length;
  const done = ordens.filter((o) => o.ordens_servico?.status === "concluida").length;
  const canceled = ordens.filter((o) => o.ordens_servico?.status === "cancelada").length;
  const inProgress = ordens.filter((o) => {
    const st = o.ordens_servico?.status;
    return st === "em_deslocamento" || st === "no_local" || st === "em_execucao" || st === "em_andamento" || st === "pausada";
  }).length;
  const remaining = Math.max(0, total - done - canceled);
  return { total, done, canceled, inProgress, remaining };
}

function computeExpectedIndex(now: Date, dataPlanejamentoISO: string, ordens: PlanejamentoOrdem[]): number | null {
  if (format(now, "yyyy-MM-dd") !== dataPlanejamentoISO) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sorted = [...ordens].sort((a, b) => (a.ordem_na_rota ?? 0) - (b.ordem_na_rota ?? 0));
  let expected = -1;
  for (let i = 0; i < sorted.length; i++) {
    const endMin = toMinutes(sorted[i].hora_fim_estimada);
    if (endMin == null) continue;
    if (nowMin >= endMin) expected = i;
  }
  return expected >= 0 ? expected : 0;
}

function buildMapaPoints(routes: RouteEquipe[], posicoesAtuais: any[] | undefined): TorreMapaPoint[] {
  const pts: TorreMapaPoint[] = [];
  const posMap = new Map<string, { lat: number; lng: number; recorded_at?: string }>();
  for (const p of posicoesAtuais || []) {
    if (!p?.equipe_id) continue;
    if (p.latitude == null || p.longitude == null) continue;
    posMap.set(String(p.equipe_id), { lat: Number(p.latitude), lng: Number(p.longitude), recorded_at: p.recorded_at });
  }

  for (const r of routes) {
    const { equipe, ordens } = r;
    for (const o of ordens) {
      const os = o.ordens_servico;
      if (!os?.latitude || !os?.longitude) continue;
      pts.push({
        kind: "os",
        id: os.id,
        equipeId: equipe.id,
        equipeCodigo: equipe.codigo,
        ordemNaRota: o.ordem_na_rota,
        numero: os.numero,
        tipo: os.tipo,
        status: os.status,
        regulada: !!os.regulada,
        lat: Number(os.latitude),
        lng: Number(os.longitude),
        endereco: os.endereco,
      });
    }
    const telem = posMap.get(equipe.id);
    if (telem) {
      pts.push({
        kind: "equipe",
        equipeId: equipe.id,
        equipeCodigo: equipe.codigo,
        equipeNome: equipe.nome,
        statusEquipe: equipe.status ?? null,
        lat: telem.lat,
        lng: telem.lng,
        updatedAt: telem.recorded_at ?? null,
      });
    }
  }
  return pts;
}

async function resequenceAfterInsert(planningId: string, equipeId: string, posicao: number) {
  const { data, error } = await supabase
    .from("planejamento_ordens")
    .select("id, ordem_na_rota")
    .eq("planejamento_id", planningId)
    .eq("equipe_id", equipeId)
    .order("ordem_na_rota", { ascending: false });
  if (error) throw error;
  const rows = (data || []) as Array<{ id: string; ordem_na_rota: number }>;
  for (const row of rows) {
    if (row.ordem_na_rota >= posicao) {
      const { error: upErr } = await supabase.from("planejamento_ordens").update({ ordem_na_rota: row.ordem_na_rota + 1 }).eq("id", row.id);
      if (upErr) throw upErr;
    }
  }
}

async function resequenceAfterDelete(planningId: string, equipeId: string, removedOrder: number) {
  const { data, error } = await supabase
    .from("planejamento_ordens")
    .select("id, ordem_na_rota")
    .eq("planejamento_id", planningId)
    .eq("equipe_id", equipeId)
    .order("ordem_na_rota", { ascending: true });
  if (error) throw error;
  const rows = (data || []) as Array<{ id: string; ordem_na_rota: number }>;
  for (const row of rows) {
    if (row.ordem_na_rota > removedOrder) {
      const { error: upErr } = await supabase.from("planejamento_ordens").update({ ordem_na_rota: row.ordem_na_rota - 1 }).eq("id", row.id);
      if (upErr) throw upErr;
    }
  }
}

export default function Cerebro() {
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const selectedDateISO = useMemo(() => dateToISODate(selectedDate), [selectedDate]);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(15);
  const refetchInterval = autoRefresh ? Math.max(10, refreshIntervalSec) * 1000 : false;

  const [offlineThresholdMin, setOfflineThresholdMin] = useState(8);
  const [atrasoThresholdMin, setAtrasoThresholdMin] = useState(15);

  // “Time Scrubber”: minuto do dia (0..1439). Em dias passados, serve para replay.
  const [scrubMinute, setScrubMinute] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  useEffect(() => {
    if (!isToday(selectedDate)) return;
    if (!autoRefresh) return;
    const t = window.setInterval(() => {
      const now = new Date();
      setScrubMinute(now.getHours() * 60 + now.getMinutes());
    }, 30_000);
    return () => window.clearInterval(t);
  }, [selectedDate, autoRefresh]);

  const [search, setSearch] = useState("");
  const [focusEquipeId, setFocusEquipeId] = useState<string | null>(null);
  const [focusOSId, setFocusOSId] = useState<string | null>(null);
  const [mode, setMode] = useState<"pulse" | "tools">("pulse"); // muda o painel direito sem tabs

  const [tratativaDialog, setTratativaDialog] = useState<{
    open: boolean;
    alerta: BrainEvent | null;
    grupo: string;
    motivo: string;
    comentario: string;
  }>({ open: false, alerta: null, grupo: "", motivo: "", comentario: "" });

  const { data: posicoesAtuais } = useQuery({
    queryKey: ["cerebro", "posicoes_atuais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_tecnicos_posicao_atual")
        .select("equipe_id,latitude,longitude,recorded_at,accuracy_m,speed_mps,heading_deg,battery_pct,gps_ativo,app_state");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval,
  });

  const { data: planejamentosHoje } = useQuery({
    queryKey: ["cerebro", "planejamentos", selectedDateISO],
    queryFn: async () => {
      const { data, error } = await supabase.from("planejamentos").select("id,data_planejamento,status").eq("data_planejamento", selectedDateISO);
      if (error) throw error;
      return (data || []) as Array<{ id: string; data_planejamento: string; status: string }>;
    },
    refetchInterval,
  });
  const planejamentoIds = useMemo(() => (planejamentosHoje || []).map((p) => p.id), [planejamentosHoje]);

  const { data: ordensPlanejadas } = useQuery({
    queryKey: ["cerebro", "planejamento_ordens", selectedDateISO, planejamentoIds.join("|")],
    queryFn: async () => {
      if (planejamentoIds.length === 0) return [] as PlanejamentoOrdem[];
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(
          `
          id,
          planejamento_id,
          equipe_id,
          ordem_na_rota,
          hora_inicio_estimada,
          hora_fim_estimada,
          ordens_servico:ordem_servico_id (
            id,
            numero,
            tipo,
            status,
            endereco,
            cliente_nome,
            prazo,
            regulada,
            latitude,
            longitude,
            updated_at,
            deslocamento_iniciado_at,
            chegada_local_at,
            execucao_iniciada_at,
            concluido_at,
            pausado_at
          ),
          tecnicos:equipe_id (
            id,
            codigo,
            nome,
            telefone,
            status
          )
        `
        )
        .in("planejamento_id", planejamentoIds);
      if (error) throw error;
      return (data || []) as unknown as PlanejamentoOrdem[];
    },
    enabled: planejamentoIds.length > 0,
    refetchInterval,
  });

  const { data: turnosAbertos } = useQuery({
    queryKey: ["cerebro", "turnos_abertos", selectedDateISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turnos")
        .select("id,equipe_id,hora_inicio,status,tecnicos:equipe_id(id,codigo,nome,telefone,status)")
        .eq("status", "aberto")
        .gte("hora_inicio", `${selectedDateISO}T00:00:00`)
        .lte("hora_inicio", `${selectedDateISO}T23:59:59`);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval,
  });

  const { data: intervalosAtivos } = useQuery({
    queryKey: ["cerebro", "intervalos_ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervalos_equipe")
        .select("id,equipe_id,hora_inicio,hora_fim,tipos_intervalo:tipo_intervalo_id(id,nome)")
        .is("hora_fim", null);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval,
  });

  const { data: backlogOS } = useQuery({
    queryKey: ["cerebro", "backlog_os", selectedDateISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id,numero,tipo,endereco,cliente_nome,prazo,regulada,status,latitude,longitude")
        .in("status", ["pendente", "planejada"])
        .order("prazo", { ascending: true })
        .limit(700);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval,
  });

  // Alertas tratáveis: banco
  const { data: alertasDB } = useQuery({
    queryKey: ["cerebro", "alertas_db"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas")
        .select("id,tipo,severidade,titulo,descricao,tecnico_id,ordem_servico_id,resolvido,created_at,status,snoozed_until,assigned_to,acknowledged_by")
        .eq("resolvido", false)
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval,
  });
  const alertasDbIds = useMemo(() => (alertasDB || []).map((a: any) => String(a.id)), [alertasDB]);
  const { data: tratativasAlertas } = useQuery({
    queryKey: ["cerebro", "alertas_tratativas", alertasDbIds.join("|")],
    queryFn: async () => {
      if (alertasDbIds.length === 0) return [] as any[];
      const { data, error } = await supabase
        .from("alertas_tratativas")
        .select("id,alerta_id,acao,comentario,payload,created_by,created_at")
        .in("alerta_id", alertasDbIds)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    enabled: alertasDbIds.length > 0,
    refetchInterval,
  });

  const [materializedMap, setMaterializedMap] = useState<Record<string, string>>({});

  const rotasPorEquipe = useMemo((): RouteEquipe[] => {
    const grouped = new Map<string, RouteEquipe>();
    const list = ordensPlanejadas || [];
    for (const po of list) {
      const eq = po.tecnicos;
      if (!eq) continue;
      const equipe: Equipe = { id: eq.id, codigo: eq.codigo, nome: eq.nome, telefone: eq.telefone ?? null, status: eq.status ?? null };
      if (!grouped.has(eq.id)) grouped.set(eq.id, { equipe, ordens: [], planejamentoId: po.planejamento_id });
      grouped.get(eq.id)!.ordens.push(po);
    }
    for (const entry of grouped.values()) entry.ordens.sort((a, b) => (a.ordem_na_rota ?? 0) - (b.ordem_na_rota ?? 0));

    const openTeams = new Set((turnosAbertos || []).map((t: any) => t.equipe_id).filter(Boolean));
    const term = search.trim().toLowerCase();

    return Array.from(grouped.values())
      .filter((r) => openTeams.size === 0 || openTeams.has(r.equipe.id))
      .map((r) => {
        if (!term) return r;
        const ordens = r.ordens.filter((o) => {
          const os = o.ordens_servico;
          if (!os) return false;
          return (
            os.numero?.toLowerCase().includes(term) ||
            os.endereco?.toLowerCase().includes(term) ||
            os.tipo?.toLowerCase().includes(term) ||
            (os.cliente_nome?.toLowerCase().includes(term) ?? false)
          );
        });
        return { ...r, ordens };
      })
      .filter((r) => r.ordens.length > 0);
  }, [ordensPlanejadas, turnosAbertos, search]);

  useEffect(() => {
    if (!focusEquipeId && rotasPorEquipe.length > 0) setFocusEquipeId(rotasPorEquipe[0].equipe.id);
  }, [rotasPorEquipe, focusEquipeId]);

  const focusRoute = useMemo(() => rotasPorEquipe.find((r) => r.equipe.id === focusEquipeId) ?? null, [rotasPorEquipe, focusEquipeId]);

  // Rota no mapa (foco)
  const [routeGeometry, setRouteGeometry] = useState<TorreRouteGeometry | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!focusRoute) {
        setRouteGeometry(null);
        return;
      }
      const coords = focusRoute.ordens
        .map((o) => o.ordens_servico)
        .filter(Boolean)
        .filter((os) => os!.latitude != null && os!.longitude != null)
        .map((os) => [Number(os!.latitude), Number(os!.longitude)] as [number, number]);
      if (coords.length < 2) {
        setRouteGeometry(null);
        return;
      }
      setRouteLoading(true);
      try {
        const geo = await buscarRotaOSRM(coords);
        if (cancelled) return;
        setRouteGeometry({ coordinates: geo.coordinates, distance: geo.distance, duration: geo.duration });
      } catch {
        if (cancelled) return;
        setRouteGeometry(null);
      } finally {
        if (cancelled) return;
        setRouteLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [focusRoute]);

  const plannedOsIds = useMemo(() => new Set((ordensPlanejadas || []).map((o) => o.ordens_servico?.id).filter(Boolean) as string[]), [ordensPlanejadas]);

  // “Pulse Engine”: eventos gerados por regras + banco
  const engineEvents = useMemo((): BrainEvent[] => {
    const now = new Date();
    const out: BrainEvent[] = [];

    for (const os of backlogOS || []) {
      if (!os.regulada || !os.prazo) continue;
      const prazo = parseISO(os.prazo);
      const vencida = prazo < now;
      const vencendoHoje = isToday(prazo) && !vencida;
      if (!vencida && !vencendoHoje) continue;
      if (plannedOsIds.has(os.id)) continue;
      out.push({
        id: `engine:regulada:${os.id}`,
        kind: "os_urgente_sem_campo",
        severidade: vencida ? "critical" : "high",
        status: "open",
        titulo: vencida ? "REGULADA VENCIDA sem equipe" : "Regulada vencendo hoje sem equipe",
        descricao: `OS ${os.numero} • ${os.tipo} • ${os.endereco}`,
        osId: os.id,
        osNumero: os.numero,
        createdAt: now.toISOString(),
        source: "engine",
      });
    }

    const intervalosPorEquipe = new Map<string, any>();
    (intervalosAtivos || []).forEach((i: any) => intervalosPorEquipe.set(i.equipe_id, i));

    for (const r of rotasPorEquipe) {
      const nowLocal = new Date();
      const progress = computeEquipeProgress(r.ordens);
      const lastUpdate = computeLastUpdate(r.ordens);
      const offline = lastUpdate ? diffMinutes(nowLocal, lastUpdate) >= offlineThresholdMin : true;
      const intervalo = intervalosPorEquipe.get(r.equipe.id);

      if (offline) {
        out.push({
          id: `engine:offline:${r.equipe.id}`,
          kind: "offline",
          severidade: "high",
          status: "open",
          titulo: `Equipe sem atualização: ${r.equipe.codigo}`,
          descricao: `Última atualização acima de ${offlineThresholdMin} min.`,
          equipeId: r.equipe.id,
          equipeCodigo: r.equipe.codigo,
          createdAt: new Date().toISOString(),
          source: "engine",
        });
      }

      if (!intervalo && progress.inProgress === 0 && progress.remaining > 0) {
        const idleMin = lastUpdate ? diffMinutes(nowLocal, lastUpdate) : 0;
        if (idleMin >= 5) {
          out.push({
            id: `engine:ociosa:${r.equipe.id}`,
            kind: "equipe_ociosa",
            severidade: idleMin >= 15 ? "high" : "medium",
            status: "open",
            titulo: `Equipe ociosa: ${r.equipe.codigo}`,
            descricao: `Sem atividade há ${idleMin} min.`,
            equipeId: r.equipe.id,
            equipeCodigo: r.equipe.codigo,
            createdAt: new Date().toISOString(),
            source: "engine",
          });
        }
      }

      const expectedIndex = computeExpectedIndex(nowLocal, selectedDateISO, r.ordens);
      const actualIndex = progress.done - 1;
      const desvio = expectedIndex != null ? (expectedIndex - actualIndex) * 10 : 0;
      if (desvio > atrasoThresholdMin) {
        out.push({
          id: `engine:atraso:${r.equipe.id}`,
          kind: "rota_atrasada",
          severidade: desvio >= 60 ? "critical" : "high",
          status: "open",
          titulo: `Atraso na rota: ${r.equipe.codigo}`,
          descricao: `Estimativa de atraso: ${desvio} min.`,
          equipeId: r.equipe.id,
          equipeCodigo: r.equipe.codigo,
          createdAt: new Date().toISOString(),
          source: "engine",
        });
      }
    }

    return out;
  }, [backlogOS, plannedOsIds, rotasPorEquipe, intervalosAtivos, offlineThresholdMin, atrasoThresholdMin, selectedDateISO]);

  const events = useMemo((): BrainEvent[] => {
    const fromDb: BrainEvent[] =
      (alertasDB || []).map((a: any) => ({
        id: `db:${a.id}`,
        kind: (a.tipo as AlertKind) || "manual",
        severidade: (a.severidade as Severidade) || "medium",
        status: (a.status as AlertStatus) || "open",
        titulo: a.titulo || "Alerta",
        descricao: a.descricao || "",
        equipeId: a.tecnico_id || undefined,
        osId: a.ordem_servico_id || undefined,
        createdAt: a.created_at,
        source: "db",
        dbId: String(a.id),
        snoozedUntil: a.snoozed_until ?? null,
        assignedTo: a.assigned_to ?? null,
        acknowledgedBy: a.acknowledged_by ?? null,
      })) || [];

    const merged = [...engineEvents, ...fromDb].map((e) => {
      if (e.source === "engine") {
        const mapped = materializedMap[e.id];
        if (mapped) return { ...e, source: "db" as const, dbId: mapped, id: `db:${mapped}` };
      }
      return e;
    });

    const uniq = new Map<string, BrainEvent>();
    for (const e of merged) uniq.set(e.id, e);
    const list = Array.from(uniq.values()).filter((e) => {
      if (e.snoozedUntil) {
        const until = new Date(e.snoozedUntil).getTime();
        if (until > Date.now()) return false;
      }
      return e.status !== "resolved";
    });

    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    list.sort((a, b) => order[a.severidade] - order[b.severidade] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [alertasDB, engineEvents, materializedMap]);

  const counts = useMemo(() => {
    const critical = events.filter((e) => e.severidade === "critical").length;
    const high = events.filter((e) => e.severidade === "high").length;
    const needsAction = events.filter((e) => e.status === "open").length;
    return { critical, high, needsAction, total: events.length };
  }, [events]);

  const mapaPoints = useMemo(() => buildMapaPoints(rotasPorEquipe, posicoesAtuais), [rotasPorEquipe, posicoesAtuais]);

  const getUserId = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) throw error || new Error("Usuário não autenticado");
    return data.user.id;
  };

  const ensureAlertDbId = async (a: BrainEvent): Promise<string> => {
    if (a.dbId) return a.dbId;
    const mapped = materializedMap[a.id];
    if (mapped) return mapped;
    const payload = {
      tipo: a.kind,
      severidade: a.severidade,
      titulo: a.titulo,
      descricao: a.descricao,
      tecnico_id: a.equipeId ?? null,
      ordem_servico_id: a.osId ?? null,
      resolvido: false,
      status: "open",
    };
    const { data, error } = await supabase.from("alertas").insert(payload).select("id").single();
    if (error) throw error;
    const id = String(data.id);
    setMaterializedMap((m) => ({ ...m, [a.id]: id }));
    return id;
  };

  const registrarTratativa = useMutation({
    mutationFn: async (params: { alerta: BrainEvent; acao: string; comentario?: string; payload?: Record<string, unknown> }) => {
      const userId = await getUserId();
      const alertaId = await ensureAlertDbId(params.alerta);
      const nowIso = new Date().toISOString();

      const { error: insErr } = await supabase.from("alertas_tratativas").insert({
        alerta_id: alertaId,
        acao: params.acao,
        comentario: params.comentario ?? null,
        payload: params.payload ?? {},
        created_by: userId,
        created_at: nowIso,
      });
      if (insErr) throw insErr;

      const updates: Record<string, unknown> = {};
      if (params.acao === "acknowledge") updates.status = "acknowledged";
      if (params.acao === "assign") updates.status = "assigned";
      if (params.acao === "snooze") {
        const minutes = Number((params.payload as any)?.minutes ?? 30);
        updates.status = "snoozed";
        updates.snoozed_until = new Date(Date.now() + minutes * 60_000).toISOString();
      }
      if (params.acao === "resolve") {
        updates.status = "resolved";
        updates.resolvido = true;
      }
      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await supabase.from("alertas").update(updates).eq("id", alertaId);
        if (upErr) throw upErr;
      }
      return { alertaId };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cerebro", "alertas_db"] });
      await queryClient.invalidateQueries({ queryKey: ["cerebro", "alertas_tratativas"] });
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message ? `Erro: ${e.message}` : "Falha ao registrar tratativa.");
    },
  });

  // Backlog filtrado para ferramentas
  const backlogFiltrado = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (backlogOS || []).filter((os) => {
      if (!term) return true;
      return (
        os.numero?.toLowerCase().includes(term) ||
        os.endereco?.toLowerCase().includes(term) ||
        os.tipo?.toLowerCase().includes(term) ||
        (os.cliente_nome?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [backlogOS, search]);

  // Intervenção “from scratch”: editor de rota focada (sem reutilizar IntervencaoRota)
  const osDisponiveis = useMemo((): Array<{ id: string; numero: string; tipo: string; endereco: string; regulada: boolean; prazo?: string | null }> => {
    return backlogFiltrado
      .filter((os) => !plannedOsIds.has(os.id))
      .slice(0, 80)
      .map((os) => ({ id: os.id, numero: os.numero, tipo: os.tipo, endereco: os.endereco, regulada: !!os.regulada, prazo: os.prazo ?? null }));
  }, [backlogFiltrado, plannedOsIds]);

  const [toolAdd, setToolAdd] = useState<{ osId: string; pos: number; motivo: string }>({ osId: "", pos: 1, motivo: "" });
  useEffect(() => {
    if (!focusRoute) return;
    setToolAdd((s) => ({ ...s, pos: Math.max(1, focusRoute.ordens.length + 1) }));
  }, [focusRoute]);

  const aplicarAdd = useMutation({
    mutationFn: async () => {
      if (!focusRoute) throw new Error("Selecione uma equipe.");
      if (!toolAdd.osId) throw new Error("Selecione uma OS.");
      if (!toolAdd.motivo.trim()) throw new Error("Motivo é obrigatório.");
      const planningId = focusRoute.planejamentoId || planejamentoIds[0];
      if (!planningId) throw new Error("Sem planejamento para o dia.");

      // mover se já existir no planejamento
      const { data: existente, error: exErr } = await supabase
        .from("planejamento_ordens")
        .select("id,equipe_id,ordem_na_rota")
        .eq("planejamento_id", planningId)
        .eq("ordem_servico_id", toolAdd.osId)
        .maybeSingle();
      if (exErr) throw exErr;

      if (existente?.id) {
        if (existente.equipe_id === focusRoute.equipe.id) return;
        await resequenceAfterInsert(planningId, focusRoute.equipe.id, toolAdd.pos);
        await resequenceAfterDelete(planningId, existente.equipe_id, existente.ordem_na_rota);
        const { error: upErr } = await supabase
          .from("planejamento_ordens")
          .update({ equipe_id: focusRoute.equipe.id, ordem_na_rota: toolAdd.pos })
          .eq("id", existente.id);
        if (upErr) throw upErr;
      } else {
        await resequenceAfterInsert(planningId, focusRoute.equipe.id, toolAdd.pos);
        const { error } = await supabase.from("planejamento_ordens").insert({
          planejamento_id: planningId,
          equipe_id: focusRoute.equipe.id,
          ordem_servico_id: toolAdd.osId,
          ordem_na_rota: toolAdd.pos,
        });
        if (error) throw error;
      }

      await supabase.from("planejamento_logs").insert({
        planejamento_id: planningId,
        ordem_servico_id: toolAdd.osId,
        acao: "cerebro_add",
        descricao: `CÉREBRO: OS adicionada/movida para ${focusRoute.equipe.codigo} pos ${toolAdd.pos}. Motivo: ${toolAdd.motivo}`,
      });
    },
    onSuccess: async () => {
      toast.success("Intervenção aplicada.");
      setToolAdd({ osId: "", pos: 1, motivo: "" });
      await queryClient.invalidateQueries({ queryKey: ["cerebro", "planejamento_ordens"] });
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message ? `Erro: ${e.message}` : "Falha ao aplicar intervenção.");
    },
  });

  const aplicarRemove = useMutation({
    mutationFn: async (osId: string) => {
      if (!focusRoute) throw new Error("Selecione uma equipe.");
      const planningId = focusRoute.planejamentoId || planejamentoIds[0];
      if (!planningId) throw new Error("Sem planejamento.");
      const row = focusRoute.ordens.find((o) => o.ordens_servico?.id === osId);
      if (!row) throw new Error("OS não encontrada na rota.");
      const removedOrder = row.ordem_na_rota;

      const { error } = await supabase
        .from("planejamento_ordens")
        .delete()
        .eq("planejamento_id", planningId)
        .eq("equipe_id", focusRoute.equipe.id)
        .eq("ordem_servico_id", osId);
      if (error) throw error;
      await resequenceAfterDelete(planningId, focusRoute.equipe.id, removedOrder);

      await supabase.from("planejamento_logs").insert({
        planejamento_id: planningId,
        ordem_servico_id: osId,
        acao: "cerebro_remove",
        descricao: `CÉREBRO: OS removida da rota ${focusRoute.equipe.codigo} (ordem ${removedOrder}).`,
      });
    },
    onSuccess: async () => {
      toast.success("OS removida.");
      await queryClient.invalidateQueries({ queryKey: ["cerebro", "planejamento_ordens"] });
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message ? `Erro: ${e.message}` : "Falha ao remover OS.");
    },
  });

  const aplicarReorder = useMutation({
    mutationFn: async (vars: { osId: string; direction: "up" | "down" }) => {
      if (!focusRoute) throw new Error("Selecione uma equipe.");
      const planningId = focusRoute.planejamentoId || planejamentoIds[0];
      if (!planningId) throw new Error("Sem planejamento.");
      const ordens = [...focusRoute.ordens].sort((a, b) => a.ordem_na_rota - b.ordem_na_rota);
      const idx = ordens.findIndex((o) => o.ordens_servico?.id === vars.osId);
      if (idx < 0) throw new Error("OS não encontrada.");
      const j = vars.direction === "up" ? idx - 1 : idx + 1;
      if (j < 0 || j >= ordens.length) return;
      const a = ordens[idx];
      const b = ordens[j];
      const aId = a.id;
      const bId = b.id;
      const aOrder = a.ordem_na_rota;
      const bOrder = b.ordem_na_rota;
      const { error: up1 } = await supabase.from("planejamento_ordens").update({ ordem_na_rota: bOrder }).eq("id", aId);
      if (up1) throw up1;
      const { error: up2 } = await supabase.from("planejamento_ordens").update({ ordem_na_rota: aOrder }).eq("id", bId);
      if (up2) throw up2;
      await supabase.from("planejamento_logs").insert({
        planejamento_id: planningId,
        acao: "cerebro_reorder",
        descricao: `CÉREBRO: swap ordem_na_rota ${aOrder}<->${bOrder} (${focusRoute.equipe.codigo}).`,
      });
    },
    onSuccess: async () => {
      toast.success("Reordenado.");
      await queryClient.invalidateQueries({ queryKey: ["cerebro", "planejamento_ordens"] });
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message ? `Erro: ${e.message}` : "Falha ao reordenar.");
    },
  });

  const headerBadge = autoRefresh ? (
    <Badge variant="secondary" className="gap-2">
      <Wifi className="h-3.5 w-3.5" />
      Auto ({refreshIntervalSec}s)
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-2">
      <WifiOff className="h-3.5 w-3.5" />
      Manual
    </Badge>
  );

  // Timeline “compacta” (sem usar TimelineEquipes) – uma barra por equipe com status, progress e desvio
  const compactTimeline = useMemo(() => {
    const now = new Date(`${selectedDateISO}T${String(Math.floor(scrubMinute / 60)).padStart(2, "0")}:${String(scrubMinute % 60).padStart(2, "0")}:00`);
    return rotasPorEquipe.map((r) => {
      const progress = computeEquipeProgress(r.ordens);
      const expected = computeExpectedIndex(now, selectedDateISO, r.ordens);
      const actual = progress.done - 1;
      const desvio = expected != null ? (expected - actual) * 10 : 0;
      const last = computeLastUpdate(r.ordens);
      const offline = last ? diffMinutes(new Date(), last) >= offlineThresholdMin : true;
      return { equipe: r.equipe, progress, desvio, offline };
    });
  }, [rotasPorEquipe, scrubMinute, selectedDateISO, offlineThresholdMin]);

  const timeLabel = useMemo(() => `${String(Math.floor(scrubMinute / 60)).padStart(2, "0")}:${String(scrubMinute % 60).padStart(2, "0")}`, [scrubMinute]);

  return (
    <MainLayout
      title="Cérebro"
      subtitle="Acompanhamento + intervenção de rotas em tempo real (mission control)"
      breadcrumbs={[{ label: "Cérebro" }]}
    >
      {/* “Neural Bar” (top) */}
      <div className="rounded-xl border bg-gradient-to-r from-background via-muted/20 to-background p-3 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("gap-2", counts.critical > 0 ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-success/10 text-success border border-success/20")}>
              <Sparkles className="h-3.5 w-3.5" />
              {counts.critical > 0 ? "CRÍTICO" : "ESTÁVEL"}
            </Badge>
            {headerBadge}
            <Badge variant="secondary" className="gap-2">
              <HeartPulse className="h-3.5 w-3.5" />
              {counts.total} eventos • {counts.needsAction} em aberto
            </Badge>
            <Separator orientation="vertical" className="hidden lg:block h-6" />
            <span className="text-sm text-muted-foreground">{format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 bg-muted/40 border rounded-lg p-1">
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => subDays(d, 1))} title="Dia anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="gap-2" onClick={() => setSelectedDate(new Date())} title="Ir para hoje">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{isToday(selectedDate) ? "Hoje" : format(selectedDate, "dd/MM", { locale: ptBR })}</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => addDays(d, 1))} title="Próximo dia">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Input type="date" value={selectedDateISO} onChange={(e) => setSelectedDate(new Date(`${e.target.value}T12:00:00`))} className="w-[160px]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar OS, endereço, equipe…" className="w-[280px]" />
            <Button variant="outline" className="gap-2" onClick={() => queryClient.invalidateQueries({ queryKey: ["cerebro"] })}>
              <RefreshCcw className="h-4 w-4" />
              Sync
            </Button>
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <span className="text-xs text-muted-foreground">Auto</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Input type="number" min={10} step={5} value={refreshIntervalSec} onChange={(e) => setRefreshIntervalSec(Number(e.target.value || 15))} className="w-[72px] h-8" disabled={!autoRefresh} />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
          </div>
        </div>

        {/* Scrubber */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Replay</span>
            <Badge variant="secondary">{timeLabel}</Badge>
          </div>
          <div className="lg:col-span-8">
            <input
              type="range"
              min={0}
              max={1439}
              value={scrubMinute}
              onChange={(e) => setScrubMinute(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:59</span>
            </div>
          </div>
          <div className="lg:col-span-2 flex items-center justify-end gap-2">
            <Button variant={mode === "pulse" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setMode("pulse")}>
              <HeartPulse className="h-4 w-4" />
              Pulse
            </Button>
            <Button variant={mode === "tools" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setMode("tools")}>
              <Wrench className="h-4 w-4" />
              Tools
            </Button>
          </div>
        </div>
      </div>

      {/* Mission Control layout (resizable, sem tabs) */}
      <div className="h-[calc(100vh-320px)] min-h-[680px]">
        <ResizablePanelGroup direction="horizontal" className="rounded-xl border overflow-hidden">
          {/* Left: Pulse queue */}
          <ResizablePanel defaultSize={28} minSize={18}>
            <div className="h-full flex flex-col">
              <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4" />
                  <div className="font-semibold">Pulse Queue</div>
                </div>
                <Badge variant={counts.critical > 0 ? "destructive" : "secondary"}>{counts.total}</Badge>
              </div>

              <div className="p-3 border-b">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Offline (min)</Label>
                    <Input type="number" min={1} value={offlineThresholdMin} onChange={(e) => setOfflineThresholdMin(Number(e.target.value || 8))} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Atraso (min)</Label>
                    <Input type="number" min={1} value={atrasoThresholdMin} onChange={(e) => setAtrasoThresholdMin(Number(e.target.value || 15))} className="h-8" />
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {events.map((e) => {
                    const sevCls =
                      e.severidade === "critical"
                        ? "border-red-500/40 bg-red-500/5"
                        : e.severidade === "high"
                          ? "border-orange-500/40 bg-orange-500/5"
                          : e.severidade === "medium"
                            ? "border-yellow-500/40 bg-yellow-500/5"
                            : "border-sky-500/30 bg-sky-500/5";
                    const treatedCount = e.dbId ? (tratativasAlertas || []).filter((t: any) => String(t.alerta_id) === String(e.dbId)).length : 0;

                    return (
                      <button
                        key={e.id}
                        className={cn("w-full text-left rounded-lg border p-3 transition hover:bg-muted/30", sevCls)}
                        onClick={() => {
                          if (e.equipeId) setFocusEquipeId(e.equipeId);
                          if (e.osId) setFocusOSId(e.osId);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-sm">{e.titulo}</div>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {e.source.toUpperCase()}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {e.status.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.descricao}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          {e.equipeCodigo ? (
                            <span className="flex items-center gap-1">
                              <Crosshair className="h-3 w-3" />
                              {e.equipeCodigo}
                            </span>
                          ) : null}
                          {e.osNumero ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              OS {e.osNumero}
                            </span>
                          ) : null}
                          <span className="ml-auto flex items-center gap-1">
                            <BadgeCheck className="h-3 w-3" /> {treatedCount} tratativas
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              registrarTratativa.mutate({ alerta: e, acao: "acknowledge" });
                            }}
                          >
                            <Check className="h-3 w-3" />
                            Reconhecer
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              registrarTratativa.mutate({ alerta: e, acao: "assign" });
                            }}
                          >
                            <UserCheck className="h-3 w-3" />
                            Assumir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              registrarTratativa.mutate({ alerta: e, acao: "snooze", payload: { minutes: 30 } });
                            }}
                          >
                            <Timer className="h-3 w-3" />
                            30m
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs gap-1"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setTratativaDialog({ open: true, alerta: e, grupo: "", motivo: "", comentario: "" });
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Resolver
                          </Button>
                        </div>
                      </button>
                    );
                  })}
                  {events.length === 0 ? <div className="text-sm text-muted-foreground py-10 text-center">Sem eventos.</div> : null}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Center: Geo + Focus */}
          <ResizablePanel defaultSize={44} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4" />
                  <div className="font-semibold">Geo + Focus</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{focusRoute?.equipe.codigo || "—"}</Badge>
                  {focusRoute?.equipe.telefone ? (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(`tel:${focusRoute.equipe.telefone}`)}>
                      <Phone className="h-4 w-4" />
                      Ligar
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="p-3 border-b">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-muted-foreground">
                    Foco: <b className="text-foreground">{focusRoute?.equipe.nome || "Selecione uma equipe"}</b>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        if (!focusRoute) return;
                        navigator.clipboard?.writeText(focusRoute.equipe.codigo);
                        toast.success("Código da equipe copiado.");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setMode((m) => (m === "pulse" ? "tools" : "pulse"))}>
                      <MessageSquareText className="h-4 w-4" />
                      Chat
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-3">
                <MapaTorreControle
                  points={mapaPoints}
                  selectedEquipeId={focusEquipeId}
                  selectedOSId={focusOSId}
                  routeGeometry={routeGeometry}
                  executedGeometry={null}
                  isRouteLoading={routeLoading}
                  onSelect={(p) => {
                    if (p.kind === "equipe") {
                      setFocusEquipeId(p.equipeId || p.id);
                      setFocusOSId(null);
                    } else {
                      setFocusOSId(p.id);
                      if (p.equipeId) setFocusEquipeId(p.equipeId);
                    }
                  }}
                />
              </div>

              <div className="p-3 border-t bg-muted/10">
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Timeline compacta (replay @ {timeLabel})
                </div>
                <ScrollArea className="h-[160px]">
                  <div className="space-y-2 pr-3">
                    {compactTimeline.map((l) => {
                      const isFocus = l.equipe.id === focusEquipeId;
                      return (
                        <button
                          key={l.equipe.id}
                          className={cn("w-full rounded-lg border p-2 text-left hover:bg-muted/30 transition", isFocus && "border-primary bg-primary/5")}
                          onClick={() => setFocusEquipeId(l.equipe.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm">{l.equipe.codigo}</div>
                            <div className="flex items-center gap-2">
                              {l.offline ? <Badge variant="secondary">offline</Badge> : null}
                              <Badge variant={l.desvio > atrasoThresholdMin ? "destructive" : "secondary"} className="text-[10px]">
                                {l.desvio > 0 ? `+${l.desvio}m` : l.desvio < 0 ? `${l.desvio}m` : "no prazo"}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {l.progress.done}/{l.progress.total} concluídas • {l.progress.inProgress} ativas • {l.progress.remaining} restantes
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Tools (route editor) */}
          <ResizablePanel defaultSize={28} minSize={18}>
            <div className="h-full flex flex-col">
              <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  <div className="font-semibold">Toolkit</div>
                </div>
                <Badge variant="secondary">{mode.toUpperCase()}</Badge>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-3 space-y-4">
                  <Card className="border-primary/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Route className="h-4 w-4" />
                        Editor de rota (foco)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!focusRoute ? (
                        <div className="text-sm text-muted-foreground">Selecione uma equipe no mapa ou na lista.</div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{focusRoute.equipe.codigo}</div>
                              <div className="text-xs text-muted-foreground">{focusRoute.equipe.nome}</div>
                            </div>
                            <Badge variant="secondary">{focusRoute.ordens.length} OS</Badge>
                          </div>

                          <div className="rounded-lg border overflow-hidden">
                            <div className="bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
                              <span>Rota</span>
                              <span>Intervenções ficam em `planejamento_logs`</span>
                            </div>
                            <div className="divide-y">
                              {focusRoute.ordens.map((o) => {
                                const os = o.ordens_servico;
                                if (!os) return null;
                                const prazo = os.prazo ? parseISO(os.prazo) : null;
                                const vencida = !!prazo && isPast(prazo);
                                return (
                                  <div key={o.id} className="p-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <button className="text-left" onClick={() => setFocusOSId(os.id)}>
                                        <div className="font-medium text-sm">
                                          #{o.ordem_na_rota} • {os.numero} {os.regulada ? <span className="text-destructive font-semibold">REG</span> : null}
                                        </div>
                                        <div className="text-xs text-muted-foreground line-clamp-1">{os.tipo} • {os.endereco}</div>
                                        {prazo ? (
                                          <div className="mt-1">
                                            <Badge variant={vencida ? "destructive" : "secondary"} className="text-[10px]">
                                              {format(prazo, "dd/MM HH:mm")}
                                            </Badge>
                                          </div>
                                        ) : null}
                                      </button>

                                      <div className="flex items-center gap-1">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => aplicarReorder.mutate({ osId: os.id, direction: "up" } as any)}>
                                          <ChevronLeft className="h-4 w-4 rotate-90" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => aplicarReorder.mutate({ osId: os.id, direction: "down" } as any)}>
                                          <ChevronRight className="h-4 w-4 rotate-90" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => aplicarRemove.mutate(os.id)}>
                                          <AlertTriangle className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-2">
                            <div className="text-xs font-semibold flex items-center gap-2">
                              <Wrench className="h-3.5 w-3.5" /> Adicionar OS na rota
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">OS disponível</Label>
                                <select
                                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                                  value={toolAdd.osId}
                                  onChange={(e) => setToolAdd((s) => ({ ...s, osId: e.target.value }))}
                                >
                                  <option value="">Selecione…</option>
                                  {osDisponiveis.map((os) => (
                                    <option key={os.id} value={os.id}>
                                      {os.numero} {os.regulada ? "• REG" : ""} {os.prazo && (isPast(parseISO(os.prazo)) || isToday(parseISO(os.prazo))) ? "• URG" : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Posição</Label>
                                <Input type="number" min={1} value={toolAdd.pos} onChange={(e) => setToolAdd((s) => ({ ...s, pos: Number(e.target.value || 1) }))} className="h-9" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Motivo (obrigatório)</Label>
                              <Textarea value={toolAdd.motivo} onChange={(e) => setToolAdd((s) => ({ ...s, motivo: e.target.value }))} rows={2} placeholder="Ex: regulada vencendo hoje, redespacho, apoio..." />
                            </div>
                            <Button className="w-full gap-2" onClick={() => aplicarAdd.mutate()} disabled={aplicarAdd.isPending}>
                              <Wrench className="h-4 w-4" />
                              Aplicar intervenção
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Backlog STC (top 80)
                        </span>
                        <Badge variant="secondary">{osDisponiveis.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                      Aqui entram apenas OS **não planejadas** em nenhuma rota do dia (evita duplicidade).
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Dialog de resolução com grupo/motivo */}
      <Dialog open={tratativaDialog.open} onOpenChange={(open) => setTratativaDialog((s) => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{tratativaDialog.alerta?.titulo}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Grupo *</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={tratativaDialog.grupo}
                  onChange={(e) => setTratativaDialog((s) => ({ ...s, grupo: e.target.value, motivo: "" }))}
                >
                  <option value="">Selecione…</option>
                  {MOTIVOS.map((g) => (
                    <option key={g.grupo} value={g.grupo}>
                      {g.grupo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Motivo *</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={tratativaDialog.motivo}
                  onChange={(e) => setTratativaDialog((s) => ({ ...s, motivo: e.target.value }))}
                  disabled={!tratativaDialog.grupo}
                >
                  <option value="">Selecione…</option>
                  {(MOTIVOS.find((g) => g.grupo === tratativaDialog.grupo)?.itens || []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Comentário</Label>
              <Textarea value={tratativaDialog.comentario} onChange={(e) => setTratativaDialog((s) => ({ ...s, comentario: e.target.value }))} rows={3} placeholder="Descreva a ação tomada..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTratativaDialog({ open: false, alerta: null, grupo: "", motivo: "", comentario: "" })}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!tratativaDialog.alerta) return;
                if (!tratativaDialog.grupo || !tratativaDialog.motivo) {
                  toast.error("Selecione grupo e motivo.");
                  return;
                }
                registrarTratativa.mutate({
                  alerta: tratativaDialog.alerta,
                  acao: "resolve",
                  comentario: tratativaDialog.comentario.trim() || undefined,
                  payload: { grupo: tratativaDialog.grupo, motivo: tratativaDialog.motivo },
                });
                setTratativaDialog({ open: false, alerta: null, grupo: "", motivo: "", comentario: "" });
              }}
              disabled={registrarTratativa.isPending}
            >
              Resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat rápido */}
      <ChatTorreControle />
    </MainLayout>
  );
}


