import { useEffect, useMemo, useState } from "react";
import { addDays, format, isPast, isToday, parseISO, subDays } from "date-fns";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { ChatTorreControle } from "@/components/chat/ChatTorreControle";
import { PainelEquipesDestaque, type EquipeDestaque } from "@/components/torre/PainelEquipesDestaque";
import { TimelineEquipes, type TimelineEquipeData } from "@/components/torre/TimelineEquipes";
import { IntervencaoRota, type OSParaAdicionar } from "@/components/torre/IntervencaoRota";

import MapaTorreControle, { type TorreMapaPoint, type TorreRouteGeometry } from "@/pages/components/MapaTorreControle";

import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MessageSquareText,
  Phone,
  RefreshCcw,
  Route,
  Shield,
  Timer,
  UserCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

type Severidade = "critical" | "high" | "medium" | "low";
type AlertKind =
  | "os_urgente_sem_campo"
  | "rota_atrasada"
  | "equipe_ociosa"
  | "offline"
  | "manual";

interface TorreEquipe {
  id: string;
  codigo: string;
  nome: string;
  telefone?: string | null;
  status?: string | null;
}

interface TorrePlanejamentoOrdem {
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
  equipe: TorreEquipe;
  ordens: TorrePlanejamentoOrdem[];
  planejamentoId: string;
}

interface OperacaoAlertaUI {
  id: string; // engine:... ou db:...
  kind: AlertKind;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  equipeId?: string;
  equipeCodigo?: string;
  osId?: string;
  osNumero?: string;
  createdAt: string;
  source: "engine" | "db";
  dbId?: string;
  status?: string | null;
  snoozedUntil?: string | null;
  assignedTo?: string | null;
  acknowledgedBy?: string | null;
}

interface MotivoGrupo {
  group: string;
  motivos: string[];
}

const MOTIVOS: MotivoGrupo[] = [
  { group: "Operacional", motivos: ["Replanejamento", "Falta de equipe", "Apoio solicitado", "Priorização alterada"] },
  { group: "Campo", motivos: ["Equipe sem sinal", "Parada imprevista", "Cliente ausente", "Acesso impedido"] },
  { group: "Técnico", motivos: ["Material faltante", "Falha de equipamento", "Dúvida técnica", "Necessita especialista"] },
  { group: "Sistema", motivos: ["Status incorreto", "OS duplicada", "Cadastro incompleto", "Erro de integração"] },
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

function computeLastUpdate(ordens: TorrePlanejamentoOrdem[]): Date | null {
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

function computeEquipeProgress(ordens: TorrePlanejamentoOrdem[]) {
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

function computeExpectedIndex(now: Date, dataPlanejamentoISO: string, ordens: TorrePlanejamentoOrdem[]): number | null {
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

export default function Operacao() {
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [search, setSearch] = useState("");
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null);
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(20);
  const [offlineThresholdMin, setOfflineThresholdMin] = useState(8);
  const [atrasoThresholdMin, setAtrasoThresholdMin] = useState(15);
  const refetchInterval = autoRefresh ? Math.max(10, refreshIntervalSec) * 1000 : false;

  const [tab, setTab] = useState<"tempo-real" | "intervencao" | "relatorios">("tempo-real");
  const [resolverDialog, setResolverDialog] = useState<{ open: boolean; alerta: OperacaoAlertaUI | null; grupo: string; motivo: string; comentario: string }>({
    open: false,
    alerta: null,
    grupo: "",
    motivo: "",
    comentario: "",
  });

  const selectedDateISO = useMemo(() => dateToISODate(selectedDate), [selectedDate]);

  const { data: posicoesAtuais } = useQuery({
    queryKey: ["operacao", "posicoes_atuais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_tecnicos_posicao_atual")
        .select("equipe_id,latitude,longitude,recorded_at,accuracy_m,speed_mps,heading_deg,battery_pct,gps_ativo,app_state");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval,
  });

  const { data: equipes } = useQuery({
    queryKey: ["operacao", "equipes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tecnicos").select("id,codigo,nome,telefone,status").order("codigo");
      if (error) throw error;
      return (data || []) as TorreEquipe[];
    },
    staleTime: 60_000,
    refetchInterval,
  });

  const { data: planejamentosHoje } = useQuery({
    queryKey: ["operacao", "planejamentos", selectedDateISO],
    queryFn: async () => {
      const { data, error } = await supabase.from("planejamentos").select("id,data_planejamento,status").eq("data_planejamento", selectedDateISO);
      if (error) throw error;
      return (data || []) as Array<{ id: string; data_planejamento: string; status: string }>;
    },
    refetchInterval,
  });

  const planejamentoIds = useMemo(() => (planejamentosHoje || []).map((p) => p.id), [planejamentosHoje]);

  const { data: ordensPlanejadas } = useQuery({
    queryKey: ["operacao", "planejamento_ordens", selectedDateISO, planejamentoIds.join("|")],
    queryFn: async () => {
      if (planejamentoIds.length === 0) return [] as TorrePlanejamentoOrdem[];
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
      return (data || []) as unknown as TorrePlanejamentoOrdem[];
    },
    enabled: planejamentoIds.length > 0,
    refetchInterval,
  });

  const { data: turnosAbertos } = useQuery({
    queryKey: ["operacao", "turnos_abertos", selectedDateISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turnos")
        .select("id,equipe_id,hora_inicio,status,tecnicos:equipe_id(id,codigo,nome)")
        .eq("status", "aberto")
        .gte("hora_inicio", `${selectedDateISO}T00:00:00`)
        .lte("hora_inicio", `${selectedDateISO}T23:59:59`);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval,
  });

  const { data: intervalosAtivos } = useQuery({
    queryKey: ["operacao", "intervalos_ativos"],
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
    queryKey: ["operacao", "backlog_os", selectedDateISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id,numero,tipo,endereco,cliente_nome,prazo,regulada,status,latitude,longitude")
        .in("status", ["pendente", "planejada"])
        .order("prazo", { ascending: true })
        .limit(600);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval,
  });

  const { data: alertasDB } = useQuery({
    queryKey: ["operacao", "alertas_db"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas")
        .select("id,tipo,severidade,titulo,descricao,tecnico_id,ordem_servico_id,resolvido,created_at,status,snoozed_until,assigned_to,acknowledged_by")
        .eq("resolvido", false)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval,
  });

  const alertasDbIds = useMemo(() => (alertasDB || []).map((a: any) => String(a.id)), [alertasDB]);

  const { data: tratativasAlertas } = useQuery({
    queryKey: ["operacao", "alertas_tratativas", alertasDbIds.join("|")],
    queryFn: async () => {
      if (alertasDbIds.length === 0) return [] as any[];
      const { data, error } = await supabase
        .from("alertas_tratativas")
        .select("id,alerta_id,acao,comentario,payload,created_by,created_at")
        .in("alerta_id", alertasDbIds)
        .order("created_at", { ascending: false })
        .limit(1200);
      if (error) throw error;
      return data || [];
    },
    enabled: alertasDbIds.length > 0,
    refetchInterval,
  });

  const rotasPorEquipe = useMemo((): RouteEquipe[] => {
    const grouped = new Map<string, RouteEquipe>();
    const list = ordensPlanejadas || [];
    for (const po of list) {
      const eq = po.tecnicos;
      if (!eq) continue;
      const equipe: TorreEquipe = {
        id: eq.id,
        codigo: eq.codigo,
        nome: eq.nome,
        telefone: eq.telefone ?? null,
        status: eq.status ?? null,
      };
      if (!grouped.has(eq.id)) grouped.set(eq.id, { equipe, ordens: [], planejamentoId: po.planejamento_id });
      grouped.get(eq.id)!.ordens.push(po);
    }
    for (const entry of grouped.values()) {
      entry.ordens.sort((a, b) => (a.ordem_na_rota ?? 0) - (b.ordem_na_rota ?? 0));
    }

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
    if (!selectedEquipeId && rotasPorEquipe.length > 0) setSelectedEquipeId(rotasPorEquipe[0].equipe.id);
  }, [rotasPorEquipe, selectedEquipeId]);

  const selectedRoute = useMemo(() => rotasPorEquipe.find((r) => r.equipe.id === selectedEquipeId) ?? null, [rotasPorEquipe, selectedEquipeId]);

  const equipesEmDestaque = useMemo((): EquipeDestaque[] => {
    const now = new Date();
    const openTeams = new Set((turnosAbertos || []).map((t: any) => t.equipe_id).filter(Boolean));
    const intervalosPorEquipe = new Map<string, any>();
    (intervalosAtivos || []).forEach((i: any) => intervalosPorEquipe.set(i.equipe_id, i));

    const list: EquipeDestaque[] = [];
    for (const r of rotasPorEquipe) {
      if (openTeams.size > 0 && !openTeams.has(r.equipe.id)) continue;
      const { equipe, ordens } = r;
      const progress = computeEquipeProgress(ordens);
      const lastUpdate = computeLastUpdate(ordens);
      const offline = lastUpdate ? diffMinutes(now, lastUpdate) >= offlineThresholdMin : true;
      const intervalo = intervalosPorEquipe.get(equipe.id);

      if (intervalo) {
        list.push({
          id: equipe.id,
          codigo: equipe.codigo,
          nome: equipe.nome,
          telefone: equipe.telefone,
          status: "em_intervalo",
          temTurnoAberto: true,
          tempoIntervalo: diffMinutes(now, new Date(intervalo.hora_inicio)),
          tipoIntervalo: intervalo.tipos_intervalo?.nome || "Intervalo",
          osTotal: progress.total,
          osConcluidas: progress.done,
          osEmAndamento: progress.inProgress,
        });
        continue;
      }

      if (offline) {
        list.push({
          id: equipe.id,
          codigo: equipe.codigo,
          nome: equipe.nome,
          telefone: equipe.telefone,
          status: "offline",
          temTurnoAberto: true,
          ultimaAtualizacao: lastUpdate?.toISOString(),
          osTotal: progress.total,
          osConcluidas: progress.done,
          osEmAndamento: progress.inProgress,
        });
        continue;
      }

      if (progress.inProgress === 0 && progress.remaining > 0) {
        list.push({
          id: equipe.id,
          codigo: equipe.codigo,
          nome: equipe.nome,
          telefone: equipe.telefone,
          status: "ociosa",
          temTurnoAberto: true,
          tempoOcioso: lastUpdate ? diffMinutes(now, lastUpdate) : 0,
          osTotal: progress.total,
          osConcluidas: progress.done,
          osEmAndamento: 0,
        });
        continue;
      }

      const expectedIndex = computeExpectedIndex(now, selectedDateISO, ordens);
      const actualIndex = progress.done - 1;
      const desvio = expectedIndex != null ? (expectedIndex - actualIndex) * 10 : 0;
      if (desvio > atrasoThresholdMin) {
        list.push({
          id: equipe.id,
          codigo: equipe.codigo,
          nome: equipe.nome,
          telefone: equipe.telefone,
          status: "atrasada",
          temTurnoAberto: true,
          minutosDesvio: desvio,
          osTotal: progress.total,
          osConcluidas: progress.done,
          osEmAndamento: progress.inProgress,
        });
        continue;
      }

      list.push({
        id: equipe.id,
        codigo: equipe.codigo,
        nome: equipe.nome,
        telefone: equipe.telefone,
        status: "normal",
        temTurnoAberto: true,
        osTotal: progress.total,
        osConcluidas: progress.done,
        osEmAndamento: progress.inProgress,
      });
    }
    return list;
  }, [rotasPorEquipe, turnosAbertos, intervalosAtivos, offlineThresholdMin, atrasoThresholdMin, selectedDateISO]);

  const timelineData = useMemo((): TimelineEquipeData[] => {
    const intervalosPorEquipe = new Map<string, any>();
    (intervalosAtivos || []).forEach((i: any) => intervalosPorEquipe.set(i.equipe_id, i));
    return equipesEmDestaque.map((eq) => {
      const rota = rotasPorEquipe.find((r) => r.equipe.id === eq.id);
      const intervalo = intervalosPorEquipe.get(eq.id);
      const status =
        eq.status === "ociosa" ? "ociosa" : eq.status === "atrasada" ? "atrasada" : eq.status === "offline" ? "offline" : eq.status === "em_intervalo" ? "em_intervalo" : "normal";
      return {
        id: eq.id,
        codigo: eq.codigo,
        nome: eq.nome,
        ordens:
          (rota?.ordens || []).map((o) => ({
            id: o.ordens_servico?.id || "",
            numero: o.ordens_servico?.numero || "",
            tipo: o.ordens_servico?.tipo || "",
            status: (o.ordens_servico?.status || "pendente") as any,
            regulada: !!o.ordens_servico?.regulada,
            ordemNaRota: o.ordem_na_rota,
            horaInicioEstimada: o.hora_inicio_estimada || undefined,
            horaFimEstimada: o.hora_fim_estimada || undefined,
            horaInicioReal: o.ordens_servico?.execucao_iniciada_at?.slice(11, 19),
            horaFimReal: o.ordens_servico?.concluido_at?.slice(11, 19),
          })) || [],
        intervalos: intervalo
          ? [{ id: intervalo.id, tipo: intervalo.tipos_intervalo?.nome || "Intervalo", horaInicio: intervalo.hora_inicio?.slice(11, 19) || "", horaFim: intervalo.hora_fim?.slice(11, 19) }]
          : [],
        status,
        minutosDesvio: eq.minutosDesvio,
        turnoAberto: true,
      };
    });
  }, [equipesEmDestaque, rotasPorEquipe, intervalosAtivos]);

  const mapaPoints = useMemo(() => buildMapaPoints(rotasPorEquipe, posicoesAtuais), [rotasPorEquipe, posicoesAtuais]);

  const [routeGeometry, setRouteGeometry] = useState<TorreRouteGeometry | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!selectedRoute) {
        setRouteGeometry(null);
        return;
      }
      const coords = selectedRoute.ordens
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
  }, [selectedRoute]);

  const plannedOsIds = useMemo(() => new Set((ordensPlanejadas || []).map((o) => o.ordens_servico?.id).filter(Boolean) as string[]), [ordensPlanejadas]);

  const osDisponiveisParaIntervencao = useMemo((): OSParaAdicionar[] => {
    const term = search.trim().toLowerCase();
    return (backlogOS || [])
      .filter((os) => !plannedOsIds.has(os.id)) // PRINCIPAL: não oferecer as que já estão em alguma rota
      .filter((os) => {
        if (!term) return true;
        return (
          os.numero?.toLowerCase().includes(term) ||
          os.endereco?.toLowerCase().includes(term) ||
          os.tipo?.toLowerCase().includes(term) ||
          (os.cliente_nome?.toLowerCase().includes(term) ?? false)
        );
      })
      .map((os) => ({
        id: os.id,
        numero: os.numero,
        tipo: os.tipo,
        endereco: os.endereco,
        cliente: os.cliente_nome,
        regulada: !!os.regulada,
        prazo: os.prazo ?? undefined,
        latitude: os.latitude ?? undefined,
        longitude: os.longitude ?? undefined,
      }));
  }, [backlogOS, plannedOsIds, search]);

  const materializedAlertMap = useState<Record<string, string>>({})[0];
  const setMaterializedAlertMap = useState<Record<string, string>>({})[1];

  const alertasEngine = useMemo((): OperacaoAlertaUI[] => {
    const now = new Date();
    const out: OperacaoAlertaUI[] = [];

    // OS reguladas vencidas/vencendo hoje fora do campo (não planejadas)
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
        titulo: vencida ? "OS regulada VENCIDA sem equipe" : "OS regulada vencendo hoje sem equipe",
        descricao: `OS ${os.numero} • ${os.tipo} • ${os.endereco}`,
        osId: os.id,
        osNumero: os.numero,
        createdAt: now.toISOString(),
        source: "engine",
      });
    }

    for (const eq of equipesEmDestaque) {
      if (eq.status === "ociosa" && (eq.tempoOcioso ?? 0) >= 5) {
        out.push({
          id: `engine:ociosa:${eq.id}`,
          kind: "equipe_ociosa",
          severidade: (eq.tempoOcioso ?? 0) >= 15 ? "high" : "medium",
          titulo: `Equipe ociosa: ${eq.codigo}`,
          descricao: `Sem atividade há ${eq.tempoOcioso} min.`,
          equipeId: eq.id,
          equipeCodigo: eq.codigo,
          createdAt: now.toISOString(),
          source: "engine",
        });
      }
      if (eq.status === "offline") {
        out.push({
          id: `engine:offline:${eq.id}`,
          kind: "offline",
          severidade: "high",
          titulo: `Equipe sem atualização: ${eq.codigo}`,
          descricao: `Última atualização acima de ${offlineThresholdMin} min.`,
          equipeId: eq.id,
          equipeCodigo: eq.codigo,
          createdAt: now.toISOString(),
          source: "engine",
        });
      }
    }

    // atraso (proxy)
    for (const r of rotasPorEquipe) {
      const progress = computeEquipeProgress(r.ordens);
      const expectedIndex = computeExpectedIndex(new Date(), selectedDateISO, r.ordens);
      const actualIndex = progress.done - 1;
      const desvio = expectedIndex != null ? (expectedIndex - actualIndex) * 10 : 0;
      if (desvio > atrasoThresholdMin) {
        out.push({
          id: `engine:atraso:${r.equipe.id}`,
          kind: "rota_atrasada",
          severidade: desvio >= 60 ? "critical" : "high",
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
  }, [backlogOS, plannedOsIds, equipesEmDestaque, offlineThresholdMin, rotasPorEquipe, atrasoThresholdMin, selectedDateISO]);

  const alertas = useMemo((): OperacaoAlertaUI[] => {
    const fromDb: OperacaoAlertaUI[] =
      (alertasDB || []).map((a: any) => ({
        id: `db:${a.id}`,
        kind: (a.tipo as AlertKind) || "manual",
        severidade: (a.severidade as Severidade) || "medium",
        titulo: a.titulo || "Alerta",
        descricao: a.descricao || "",
        equipeId: a.tecnico_id || undefined,
        osId: a.ordem_servico_id || undefined,
        createdAt: a.created_at,
        source: "db",
        dbId: String(a.id),
        status: a.status ?? null,
        snoozedUntil: a.snoozed_until ?? null,
        assignedTo: a.assigned_to ?? null,
        acknowledgedBy: a.acknowledged_by ?? null,
      })) || [];

    const merged = [...alertasEngine, ...fromDb].map((a) => {
      if (a.source === "engine") {
        const mapped = (materializedAlertMap as any)[a.id];
        if (mapped) return { ...a, source: "db" as const, dbId: mapped, id: `db:${mapped}` };
      }
      return a;
    });

    const uniq = new Map<string, OperacaoAlertaUI>();
    for (const a of merged) uniq.set(a.id, a);

    const list = Array.from(uniq.values()).filter((a) => {
      if (a.snoozedUntil) {
        const until = new Date(a.snoozedUntil).getTime();
        if (until > Date.now()) return false;
      }
      return true;
    });

    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    list.sort((a, b) => order[a.severidade] - order[b.severidade] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [alertasDB, alertasEngine, materializedAlertMap]);

  const getUserId = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) throw error || new Error("Usuário não autenticado");
    return data.user.id;
  };

  const ensureAlertDbId = async (a: OperacaoAlertaUI): Promise<string> => {
    if (a.dbId) return a.dbId;
    const mapped = (materializedAlertMap as any)[a.id];
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
    setMaterializedAlertMap((m) => ({ ...m, [a.id]: id }));
    return id;
  };

  const registrarTratativa = useMutation({
    mutationFn: async (params: { alerta: OperacaoAlertaUI; acao: string; comentario?: string; payload?: Record<string, unknown> }) => {
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
      if (params.acao === "acknowledge") {
        updates.status = "acknowledged";
        updates.acknowledged_by = userId;
      }
      if (params.acao === "assign") {
        updates.status = "assigned";
        updates.assigned_to = userId;
      }
      if (params.acao === "snooze") {
        const minutes = Number((params.payload as any)?.minutes ?? 30);
        const until = new Date(Date.now() + minutes * 60_000).toISOString();
        updates.status = "snoozed";
        updates.snoozed_until = until;
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
      await queryClient.invalidateQueries({ queryKey: ["operacao", "alertas_db"] });
      await queryClient.invalidateQueries({ queryKey: ["operacao", "alertas_tratativas"] });
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message ? `Erro: ${e.message}` : "Não foi possível registrar a tratativa.");
    },
  });

  const [intervirEquipeId, setIntervirEquipeId] = useState<string | null>(null);
  const equipeParaIntervencao = useMemo(() => {
    const eqId = intervirEquipeId || selectedEquipeId;
    return rotasPorEquipe.find((r) => r.equipe.id === eqId) ?? null;
  }, [rotasPorEquipe, intervirEquipeId, selectedEquipeId]);

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

  const alertsCritical = alertas.filter((a) => a.severidade === "critical").length;
  const alertsHigh = alertas.filter((a) => a.severidade === "high").length;

  return (
    <MainLayout
      title="Operação"
      subtitle="Centro de comando em tempo real (timeline + alertas tratáveis + intervenção em rotas)"
      breadcrumbs={[{ label: "Operação" }]}
    >
      {/* Command bar premium */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("gap-2", alertsCritical > 0 ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-success/10 text-success border border-success/20")}>
              <span className={cn("h-2 w-2 rounded-full", alertsCritical > 0 ? "bg-destructive animate-pulse" : "bg-success")} />
              {alertsCritical > 0 ? "CRÍTICO" : "AO VIVO"}
            </Badge>
            {headerBadge}
            <span className="text-sm text-muted-foreground">{format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
            <Separator orientation="vertical" className="hidden lg:block h-6" />
            <Badge variant="secondary" className="gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              {alertsCritical + alertsHigh} prioridade alta • {alertas.length} total
            </Badge>
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
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar OS, endereço, equipe…" className="w-[320px]" />

            <Button variant="outline" className="gap-2" onClick={() => queryClient.invalidateQueries({ queryKey: ["operacao"] })}>
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </Button>

            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <span className="text-xs text-muted-foreground">Auto</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Input
                type="number"
                min={10}
                step={10}
                value={refreshIntervalSec}
                onChange={(e) => setRefreshIntervalSec(Number(e.target.value || 20))}
                className="w-[78px] h-8"
                disabled={!autoRefresh}
              />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Planejamentos: <b className="text-foreground">{planejamentoIds.length}</b> • Rotas em campo:{" "}
            <b className="text-foreground">{rotasPorEquipe.length}</b>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Timer className="h-3.5 w-3.5" />
              Offline: {offlineThresholdMin}m
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3.5 w-3.5" />
              Atraso: {atrasoThresholdMin}m
            </Badge>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full max-w-[560px] grid-cols-3 mb-4">
          <TabsTrigger value="tempo-real">Tempo real</TabsTrigger>
          <TabsTrigger value="intervencao">Intervenção</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="tempo-real" className="m-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left */}
            <div className="xl:col-span-3 space-y-4">
              <PainelEquipesDestaque
                equipes={equipesEmDestaque}
                onSelectEquipe={(equipeId) => {
                  setSelectedEquipeId(equipeId);
                  setSelectedOSId(null);
                }}
                onOpenChat={() => toast.message("Chat da operação disponível no canto inferior direito.")}
                onLigar={(telefone) => window.open(`tel:${telefone}`)}
              />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Limiar
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Offline (min)</Label>
                      <Input type="number" min={1} value={offlineThresholdMin} onChange={(e) => setOfflineThresholdMin(Number(e.target.value || 8))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Atraso (min)</Label>
                      <Input type="number" min={1} value={atrasoThresholdMin} onChange={(e) => setAtrasoThresholdMin(Number(e.target.value || 15))} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Center */}
            <div className="xl:col-span-6 space-y-4">
              <TimelineEquipes
                dateISO={selectedDateISO}
                equipes={timelineData}
                onSelectEquipe={(equipeId) => {
                  setSelectedEquipeId(equipeId);
                  setSelectedOSId(null);
                }}
                onSelectOS={(osId, equipeId) => {
                  setSelectedEquipeId(equipeId);
                  setSelectedOSId(osId);
                }}
              />
              <MapaTorreControle
                points={buildMapaPoints(rotasPorEquipe, posicoesAtuais)}
                selectedEquipeId={selectedEquipeId}
                selectedOSId={selectedOSId}
                routeGeometry={routeGeometry}
                executedGeometry={null}
                isRouteLoading={routeLoading}
                onSelect={(p) => {
                  if (p.kind === "equipe") {
                    setSelectedEquipeId(p.equipeId || p.id);
                    setSelectedOSId(null);
                  } else {
                    setSelectedOSId(p.id);
                    if (p.equipeId) setSelectedEquipeId(p.equipeId);
                  }
                }}
              />
            </div>

            {/* Right: Centro de Ação */}
            <div className="xl:col-span-3 space-y-4">
              <Card className={cn(alertsCritical > 0 ? "border-destructive/40" : "")}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Centro de Ação
                    </span>
                    <Badge variant={alertsCritical > 0 ? "destructive" : "secondary"}>{alertas.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[760px] pr-3">
                    <div className="space-y-2">
                      {alertas.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-10 text-center">Sem alertas.</div>
                      ) : (
                        alertas.map((a) => {
                          const tratativas = a.dbId ? (tratativasAlertas || []).filter((t: any) => String(t.alerta_id) === String(a.dbId)).slice(0, 3) : [];
                          return (
                            <div
                              key={a.id}
                              className={cn(
                                "rounded-lg border p-3",
                                a.severidade === "critical"
                                  ? "border-red-500/40 bg-red-500/5"
                                  : a.severidade === "high"
                                    ? "border-orange-500/40 bg-orange-500/5"
                                    : "bg-muted/20"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-sm">{a.titulo}</div>
                                <Badge variant="secondary" className="text-[10px]">
                                  {a.severidade.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">{a.descricao}</div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => registrarTratativa.mutate({ alerta: a, acao: "acknowledge" })}>
                                  <Check className="h-3 w-3" /> Reconhecer
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => registrarTratativa.mutate({ alerta: a, acao: "assign" })}>
                                  <UserCheck className="h-3 w-3" /> Assumir
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => registrarTratativa.mutate({ alerta: a, acao: "snooze", payload: { minutes: 30 } })}>
                                  <Timer className="h-3 w-3" /> 30m
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => setResolverDialog({ open: true, alerta: a, grupo: "", motivo: "", comentario: "" })}
                                >
                                  <CheckCircle2 className="h-3 w-3" /> Resolver
                                </Button>
                              </div>
                              {tratativas.length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  {tratativas.map((t: any) => (
                                    <div key={t.id} className="rounded-md border bg-card/50 p-2 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{t.acao}</span>
                                        <span className="text-muted-foreground">{format(new Date(t.created_at), "HH:mm")}</span>
                                      </div>
                                      {t.comentario ? <div className="text-muted-foreground mt-1">{t.comentario}</div> : null}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="intervencao" className="m-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-4">
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      Selecionar equipe
                    </span>
                    <Badge variant="secondary">{equipeParaIntervencao?.equipe.codigo || "—"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PainelEquipesDestaque
                    equipes={equipesEmDestaque}
                    onSelectEquipe={(equipeId) => setIntervirEquipeId(equipeId)}
                    onOpenChat={() => toast.message("Chat da operação disponível no canto inferior direito.")}
                    onLigar={(telefone) => window.open(`tel:${telefone}`)}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-8 space-y-4">
              {!equipeParaIntervencao ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">Selecione uma equipe.</CardContent>
                </Card>
              ) : (
                <IntervencaoRota
                  equipe={{
                    id: equipeParaIntervencao.equipe.id,
                    codigo: equipeParaIntervencao.equipe.codigo,
                    nome: equipeParaIntervencao.equipe.nome,
                    ordens: equipeParaIntervencao.ordens.map((o) => ({
                      id: o.ordens_servico?.id || "",
                      numero: o.ordens_servico?.numero || "",
                      tipo: o.ordens_servico?.tipo || "",
                      status: o.ordens_servico?.status || "pendente",
                      endereco: o.ordens_servico?.endereco || "",
                      regulada: !!o.ordens_servico?.regulada,
                      prazo: o.ordens_servico?.prazo || undefined,
                      ordemNaRota: o.ordem_na_rota,
                      horaInicioEstimada: o.hora_inicio_estimada || undefined,
                      horaFimEstimada: o.hora_fim_estimada || undefined,
                    })),
                  }}
                  osDisponiveis={osDisponiveisParaIntervencao}
                  onPreviewAdicionarOS={async (osId, posicao, motivo) => {
                    const os = (backlogOS || []).find((x: any) => x.id === osId);
                    const impactAlerts: string[] = [];
                    if (!os) {
                      impactAlerts.push("OS não encontrada no backlog.");
                      return { osReguladasAfetadas: 0, osUrgentesForaDaRota: [], novaOrdemEstimada: [], alertas: impactAlerts };
                    }
                    if (os.regulada && os.prazo) {
                      const prazo = parseISO(os.prazo);
                      if (isPast(prazo) || isToday(prazo)) impactAlerts.push("OS regulada com prazo hoje/vencido. Priorize o atendimento.");
                    }
                    if (!motivo?.trim()) impactAlerts.push("Motivo obrigatório para auditoria.");
                    return { osReguladasAfetadas: os.regulada ? 1 : 0, osUrgentesForaDaRota: [], novaOrdemEstimada: [], alertas: impactAlerts };
                  }}
                  onAplicarAdicionarOS={async (osId, posicao, motivo) => {
                    const planningId = equipeParaIntervencao.planejamentoId || planejamentoIds[0];
                    if (!planningId) throw new Error("Sem planejamento para o dia.");

                    // Se já existir no planejamento, mover
                    const { data: existente, error: exErr } = await supabase
                      .from("planejamento_ordens")
                      .select("id,equipe_id,ordem_na_rota")
                      .eq("planejamento_id", planningId)
                      .eq("ordem_servico_id", osId)
                      .maybeSingle();
                    if (exErr) throw exErr;

                    if (existente?.id) {
                      if (existente.equipe_id === equipeParaIntervencao.equipe.id) {
                        toast.info("Essa OS já está na rota desta equipe.");
                        return;
                      }
                      await resequenceAfterInsert(planningId, equipeParaIntervencao.equipe.id, posicao);
                      await resequenceAfterDelete(planningId, existente.equipe_id, existente.ordem_na_rota);
                      const { error: upErr } = await supabase
                        .from("planejamento_ordens")
                        .update({ equipe_id: equipeParaIntervencao.equipe.id, ordem_na_rota: posicao })
                        .eq("id", existente.id);
                      if (upErr) throw upErr;
                      await supabase.from("planejamento_logs").insert({
                        planejamento_id: planningId,
                        ordem_servico_id: osId,
                        acao: "intervencao_mover",
                        descricao: `OS movida para rota ${equipeParaIntervencao.equipe.codigo} pos ${posicao}. Motivo: ${motivo}`,
                      });
                      toast.success("OS movida para a rota.");
                      await queryClient.invalidateQueries({ queryKey: ["operacao"] });
                      return;
                    }

                    await resequenceAfterInsert(planningId, equipeParaIntervencao.equipe.id, posicao);
                    const { error } = await supabase.from("planejamento_ordens").insert({
                      planejamento_id: planningId,
                      equipe_id: equipeParaIntervencao.equipe.id,
                      ordem_servico_id: osId,
                      ordem_na_rota: posicao,
                    });
                    if (error) throw error;
                    await supabase.from("planejamento_logs").insert({
                      planejamento_id: planningId,
                      ordem_servico_id: osId,
                      acao: "intervencao_adicao",
                      descricao: `OS adicionada na rota ${equipeParaIntervencao.equipe.codigo} pos ${posicao}. Motivo: ${motivo}`,
                    });
                    toast.success("OS adicionada na rota.");
                    await queryClient.invalidateQueries({ queryKey: ["operacao"] });
                  }}
                  onPreviewRemoverOS={async (osId, motivo) => {
                    const removed = equipeParaIntervencao.ordens.find((o) => o.ordens_servico?.id === osId);
                    const os = removed?.ordens_servico;
                    const impactAlerts: string[] = [];
                    if (!os) {
                      impactAlerts.push("OS não encontrada na rota.");
                      return { osReguladasAfetadas: 0, osUrgentesForaDaRota: [], novaOrdemEstimada: [], alertas: impactAlerts };
                    }
                    if (os.regulada) impactAlerts.push("Você está removendo uma OS REGULADA.");
                    if (os.prazo) {
                      const prazo = parseISO(os.prazo);
                      if (isPast(prazo) || isToday(prazo)) impactAlerts.push("OS com prazo hoje/vencido pode ficar fora do campo.");
                    }
                    if (!motivo?.trim()) impactAlerts.push("Motivo obrigatório para auditoria.");
                    return { osReguladasAfetadas: os.regulada ? 1 : 0, osUrgentesForaDaRota: os.regulada ? [`OS ${os.numero}`] : [], novaOrdemEstimada: [], alertas: impactAlerts };
                  }}
                  onAplicarRemoverOS={async (osId, motivo) => {
                    const planningId = equipeParaIntervencao.planejamentoId || planejamentoIds[0];
                    if (!planningId) throw new Error("Sem planejamento para o dia.");
                    const removed = equipeParaIntervencao.ordens.find((o) => o.ordens_servico?.id === osId);
                    const removedOrder = removed?.ordem_na_rota ?? 0;
                    const { error } = await supabase
                      .from("planejamento_ordens")
                      .delete()
                      .eq("planejamento_id", planningId)
                      .eq("equipe_id", equipeParaIntervencao.equipe.id)
                      .eq("ordem_servico_id", osId);
                    if (error) throw error;
                    if (removedOrder > 0) await resequenceAfterDelete(planningId, equipeParaIntervencao.equipe.id, removedOrder);
                    await supabase.from("planejamento_logs").insert({
                      planejamento_id: planningId,
                      ordem_servico_id: osId,
                      acao: "intervencao_remocao",
                      descricao: `OS removida da rota ${equipeParaIntervencao.equipe.codigo}. Motivo: ${motivo}`,
                    });
                    toast.success("OS removida da rota.");
                    await queryClient.invalidateQueries({ queryKey: ["operacao"] });
                  }}
                  onReordenar={async (novaOrdem) => {
                    const planningId = equipeParaIntervencao.planejamentoId || planejamentoIds[0];
                    if (!planningId) throw new Error("Sem planejamento para o dia.");
                    for (let i = 0; i < novaOrdem.length; i++) {
                      const { error } = await supabase
                        .from("planejamento_ordens")
                        .update({ ordem_na_rota: i + 1 })
                        .eq("planejamento_id", planningId)
                        .eq("equipe_id", equipeParaIntervencao.equipe.id)
                        .eq("ordem_servico_id", novaOrdem[i]);
                      if (error) throw error;
                    }
                    await supabase.from("planejamento_logs").insert({
                      planejamento_id: planningId,
                      acao: "intervencao_reordenacao",
                      descricao: `Rota reordenada manualmente (${equipeParaIntervencao.equipe.codigo}).`,
                    });
                    toast.success("Rota reordenada.");
                    await queryClient.invalidateQueries({ queryKey: ["operacao"] });
                  }}
                  isProcessing={false}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="relatorios" className="m-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-12">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Relatório de Alertas sem Tratativa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    Este relatório lista alertas no banco (não resolvidos) que ainda não possuem tratativas registradas.
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <ScrollArea className="h-[520px]">
                      <div className="divide-y">
                        {(alertasDB || [])
                          .filter((a: any) => !(tratativasAlertas || []).some((t: any) => String(t.alerta_id) === String(a.id)))
                          .slice(0, 200)
                          .map((a: any) => (
                            <div key={a.id} className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-medium">{a.titulo || "Alerta"}</div>
                                <Badge variant={a.severidade === "critical" ? "destructive" : "secondary"} className="text-[10px]">
                                  {(a.severidade || "medium").toUpperCase()}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">{a.descricao || ""}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">Criado em {format(new Date(a.created_at), "dd/MM HH:mm")}</div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Resolver com motivo/grupo */}
      <Dialog open={resolverDialog.open} onOpenChange={(open) => setResolverDialog((s) => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver alerta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{resolverDialog.alerta?.titulo}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Grupo *</Label>
                <Select value={resolverDialog.grupo} onValueChange={(v) => setResolverDialog((s) => ({ ...s, grupo: v, motivo: "" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS.map((g) => (
                      <SelectItem key={g.group} value={g.group}>
                        {g.group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Motivo *</Label>
                <Select value={resolverDialog.motivo} onValueChange={(v) => setResolverDialog((s) => ({ ...s, motivo: v }))} disabled={!resolverDialog.grupo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(MOTIVOS.find((g) => g.group === resolverDialog.grupo)?.motivos || []).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Comentário</Label>
              <Textarea value={resolverDialog.comentario} onChange={(e) => setResolverDialog((s) => ({ ...s, comentario: e.target.value }))} rows={3} placeholder="Descreva a ação tomada…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolverDialog({ open: false, alerta: null, grupo: "", motivo: "", comentario: "" })}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!resolverDialog.alerta) return;
                if (!resolverDialog.grupo || !resolverDialog.motivo) {
                  toast.error("Selecione grupo e motivo.");
                  return;
                }
                registrarTratativa.mutate({
                  alerta: resolverDialog.alerta,
                  acao: "resolve",
                  comentario: resolverDialog.comentario.trim() || undefined,
                  payload: { grupo: resolverDialog.grupo, motivo: resolverDialog.motivo },
                });
                setResolverDialog({ open: false, alerta: null, grupo: "", motivo: "", comentario: "" });
              }}
              disabled={registrarTratativa.isPending}
            >
              Resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat (link rápido) */}
      <ChatTorreControle />
    </MainLayout>
  );
}







