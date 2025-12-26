import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInMinutes, format, isPast, isToday, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { buscarRotaOSRM } from "@/services/osrm";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ChatTorreControle } from "@/components/chat/ChatTorreControle";
import { IntervencaoRota, type OSParaAdicionar } from "@/components/torre/IntervencaoRota";
import { PainelEquipesDestaque, type EquipeDestaque } from "@/components/torre/PainelEquipesDestaque";
import { TimelineEquipes, type TimelineEquipeData } from "@/components/torre/TimelineEquipes";

import MapaTorreControle, { type TorreMapaPoint, type TorreRouteGeometry } from "@/pages/components/MapaTorreControle";

import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  RefreshCcw,
  Route,
  Search,
  Shield,
  Timer,
  Users,
  Wifi,
  WifiOff,
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
  | "cancelada"
  | string;

type Severidade = "critical" | "high" | "medium" | "low";

interface TorreEquipe {
  id: string;
  codigo: string;
  nome: string;
  telefone?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  local_partida?: any;
  local_chegada?: any;
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
    status: OSStatus;
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
    latitude?: number | null;
    longitude?: number | null;
    local_partida?: any;
    local_chegada?: any;
  } | null;
}

interface RouteEquipe {
  equipe: TorreEquipe;
  ordens: TorrePlanejamentoOrdem[];
  planejamentoId: string;
}

interface AlertaUI {
  id: string;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  equipeId?: string;
  equipeCodigo?: string;
  osId?: string;
  osNumero?: string;
  createdAt: string;
}

function dateToISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function fmtMin(min: number): string {
  const abs = Math.abs(min);
  if (abs < 60) return `${min} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = min < 0 ? "-" : "";
  return `${sign}${h}h ${String(m).padStart(2, "0")}min`;
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

    // OS markers
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

    // Equipe marker (telemetria)
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

export default function TorreControlePage() {
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"monitor" | "intervencao" | "timeline">("monitor");
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null);
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(30);
  const [offlineThresholdMin, setOfflineThresholdMin] = useState(8);
  const [atrasoThresholdMin, setAtrasoThresholdMin] = useState(15);
  const [intervirOpen, setIntervirOpen] = useState(false);

  const selectedDateISO = useMemo(() => dateToISODate(selectedDate), [selectedDate]);
  const refreshInterval = autoRefresh ? Math.max(10, refreshIntervalSec) * 1000 : false;
  // Alias para evitar confusão com o nome da prop do React Query
  const refetchInterval = refreshInterval;

  const { data: posicoesAtuais } = useQuery({
    queryKey: ["torre2", "posicoes_atuais"],
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
    queryKey: ["torre2", "equipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("id,codigo,nome,telefone,status,latitude,longitude,local_partida,local_chegada")
        .order("codigo");
      if (error) throw error;
      return (data || []) as TorreEquipe[];
    },
    staleTime: 60_000,
    refetchInterval,
  });

  const { data: planejamentosHoje } = useQuery({
    queryKey: ["torre2", "planejamentos", selectedDateISO],
    queryFn: async () => {
      const { data, error } = await supabase.from("planejamentos").select("id,data_planejamento,status").eq("data_planejamento", selectedDateISO);
      if (error) throw error;
      return (data || []) as Array<{ id: string; data_planejamento: string; status: string }>;
    },
    refetchInterval,
  });

  const planejamentoIds = useMemo(() => (planejamentosHoje || []).map((p) => p.id), [planejamentosHoje]);

  const { data: ordensPlanejadas } = useQuery({
    queryKey: ["torre2", "planejamento_ordens", selectedDateISO, planejamentoIds.join("|")],
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
            status,
            latitude,
            longitude,
            local_partida,
            local_chegada
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
    queryKey: ["torre2", "turnos_abertos", selectedDateISO],
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
    queryKey: ["torre2", "intervalos_ativos"],
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

  // Backlog de OS (para adicionar em rotas) - propositalmente EXPLÍCITO na aba Intervenção
  const { data: backlogOS } = useQuery({
    queryKey: ["torre2", "backlog_os", selectedDateISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id,numero,tipo,endereco,cliente_nome,prazo,regulada,status,latitude,longitude")
        .in("status", ["pendente", "planejada"])
        .order("prazo", { ascending: true })
        .limit(400);
      if (error) throw error;
      return (data || []) as any[];
    },
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
        latitude: eq.latitude ?? null,
        longitude: eq.longitude ?? null,
        local_partida: eq.local_partida,
        local_chegada: eq.local_chegada,
      };
      if (!grouped.has(eq.id)) {
        grouped.set(eq.id, { equipe, ordens: [], planejamentoId: po.planejamento_id });
      }
      grouped.get(eq.id)!.ordens.push(po);
    }

    for (const entry of grouped.values()) {
      entry.ordens.sort((a, b) => (a.ordem_na_rota ?? 0) - (b.ordem_na_rota ?? 0));
    }

    const term = search.trim().toLowerCase();
    const openTeams = new Set((turnosAbertos || []).map((t: any) => t.equipe_id).filter(Boolean));

    const arr = Array.from(grouped.values())
      // Only equipes em campo (turno aberto) — mantém a torre “cérebro do agora”
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

    // Ordenar: quem tem problema primeiro (offline/ocioso/atraso)
    const now = new Date();
    arr.sort((a, b) => {
      const aLast = computeLastUpdate(a.ordens)?.getTime() ?? 0;
      const bLast = computeLastUpdate(b.ordens)?.getTime() ?? 0;
      const aOffline = aLast ? diffMinutes(now, new Date(aLast)) >= offlineThresholdMin : true;
      const bOffline = bLast ? diffMinutes(now, new Date(bLast)) >= offlineThresholdMin : true;
      if (aOffline !== bOffline) return aOffline ? -1 : 1;
      return bLast - aLast;
    });

    return arr;
  }, [ordensPlanejadas, search, turnosAbertos, offlineThresholdMin]);

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
          tempoIntervalo: differenceInMinutes(now, new Date(intervalo.hora_inicio)),
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

      // atraso (proxy) — visível no painel e na timeline
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

  const alertas = useMemo((): AlertaUI[] => {
    const now = new Date();
    const result: AlertaUI[] = [];

    // 1) OS regulada vencida/vencendo hoje e NÃO planejada em nenhuma rota do dia
    const plannedOsIds = new Set((ordensPlanejadas || []).map((o) => o.ordens_servico?.id).filter(Boolean) as string[]);
    for (const os of backlogOS || []) {
      if (!os.regulada) continue;
      if (!os.prazo) continue;
      const prazo = parseISO(os.prazo);
      const vencida = prazo < now;
      const vencendoHoje = isToday(prazo) && !vencida;
      if (!vencida && !vencendoHoje) continue;
      if (plannedOsIds.has(os.id)) continue;
      result.push({
        id: `regulada:${os.id}`,
        severidade: vencida ? "critical" : "high",
        titulo: vencida ? "OS regulada VENCIDA sem equipe" : "OS regulada vencendo hoje sem equipe",
        descricao: `OS ${os.numero} (${os.tipo}) • ${os.endereco}`,
        osId: os.id,
        osNumero: os.numero,
        createdAt: now.toISOString(),
      });
    }

    // 2) Equipes ociosas acima de 5 min
    for (const eq of equipesEmDestaque) {
      if (eq.status === "ociosa" && (eq.tempoOcioso ?? 0) >= 5) {
        result.push({
          id: `ociosa:${eq.id}`,
          severidade: (eq.tempoOcioso ?? 0) >= 15 ? "high" : "medium",
          titulo: `Equipe ociosa: ${eq.codigo}`,
          descricao: `Sem atividade há ${eq.tempoOcioso} min (turno aberto, sem OS ativa, sem intervalo).`,
          equipeId: eq.id,
          equipeCodigo: eq.codigo,
          createdAt: now.toISOString(),
        });
      }
      if (eq.status === "offline") {
        result.push({
          id: `offline:${eq.id}`,
          severidade: "high",
          titulo: `Equipe sem atualização: ${eq.codigo}`,
          descricao: `Última atualização acima de ${offlineThresholdMin} min.`,
          equipeId: eq.id,
          equipeCodigo: eq.codigo,
          createdAt: now.toISOString(),
        });
      }
    }

    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return result.sort((a, b) => order[a.severidade] - order[b.severidade]);
  }, [backlogOS, ordensPlanejadas, equipesEmDestaque, offlineThresholdMin]);

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
          ? [
              {
                id: intervalo.id,
                tipo: intervalo.tipos_intervalo?.nome || "Intervalo",
                horaInicio: intervalo.hora_inicio?.slice(11, 19) || "",
                horaFim: intervalo.hora_fim?.slice(11, 19),
              },
            ]
          : [],
        status,
        minutosDesvio: eq.minutosDesvio,
        turnoAberto: true,
      };
    });
  }, [equipesEmDestaque, rotasPorEquipe, intervalosAtivos]);

  const mapaPoints = useMemo(() => buildMapaPoints(rotasPorEquipe, posicoesAtuais), [rotasPorEquipe, posicoesAtuais]);

  // Rota no mapa (selecionada)
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

  const osDisponiveisParaIntervencao = useMemo((): OSParaAdicionar[] => {
    const plannedOsToEquipe = new Map<string, string>();
    for (const o of ordensPlanejadas || []) {
      const osId = o.ordens_servico?.id;
      const eqCod = o.tecnicos?.codigo;
      if (osId && eqCod) plannedOsToEquipe.set(osId, eqCod);
    }

    const term = search.trim().toLowerCase();
    return (backlogOS || [])
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
        // OBS: se já estiver planejada em outra equipe, isso aparece no painel à direita (aba Intervenção)
        plannedEquipeCodigo: plannedOsToEquipe.get(os.id),
      })) as any;
  }, [backlogOS, ordensPlanejadas, search]);

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

  const openAlertsCount = alertas.filter((a) => a.severidade === "critical" || a.severidade === "high").length;

  const backlogFiltrado = useMemo(() => {
    const term = search.trim().toLowerCase();
    const selectedRouteOs = new Set((selectedRoute?.ordens || []).map((o) => o.ordens_servico?.id).filter(Boolean) as string[]);
    return (backlogOS || [])
      .filter((os) => !selectedRouteOs.has(os.id))
      .filter((os) => {
        if (!term) return true;
        return (
          os.numero?.toLowerCase().includes(term) ||
          os.endereco?.toLowerCase().includes(term) ||
          os.tipo?.toLowerCase().includes(term) ||
          (os.cliente_nome?.toLowerCase().includes(term) ?? false)
        );
      });
  }, [backlogOS, search, selectedRoute]);

  return (
    <MainLayout title="Torre de Controle" subtitle="Tempo real • Monitoramento / Intervenção / Timeline" breadcrumbs={[{ label: "Torre de Controle" }]}>
      {/* Command bar (única, sempre) */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("gap-2", openAlertsCount > 0 ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-success/10 text-success border border-success/20")}>
              <span className={cn("h-2 w-2 rounded-full", openAlertsCount > 0 ? "bg-destructive animate-pulse" : "bg-success")} />
              {openAlertsCount > 0 ? "ATENÇÃO" : "AO VIVO"}
            </Badge>
            {headerBadge}
            <span className="text-sm text-muted-foreground">{format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
            <Separator orientation="vertical" className="hidden lg:block h-6" />
            <Badge variant="secondary" className="gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              {alertas.length} alertas (auto)
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar OS, endereço, equipe…" className="pl-9 w-[280px]" />
            </div>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["torre2"] })}
              title="Atualizar agora"
            >
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
                onChange={(e) => setRefreshIntervalSec(Number(e.target.value || 30))}
                className="w-[78px] h-8"
                disabled={!autoRefresh}
              />
              <span className="text-xs text-muted-foreground">s</span>
            </div>

            <Button
              className={cn("gap-2", "bg-primary")}
              onClick={() => {
                setActiveTab("intervencao");
                setIntervirOpen(true);
              }}
              title="Onde incluir/remover OS nas rotas"
            >
              <Route className="h-4 w-4" />
              Intervir na rota
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Planejamentos no dia: <b className="text-foreground">{planejamentoIds.length}</b> • Rotas em campo:{" "}
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

      {/* IA clara: só 3 modos */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-[520px] grid-cols-3 mb-4">
          <TabsTrigger value="monitor">Monitoramento</TabsTrigger>
          <TabsTrigger value="intervencao">Intervenção</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* MONITORAMENTO */}
        <TabsContent value="monitor" className="m-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-3">
              <PainelEquipesDestaque
                equipes={equipesEmDestaque}
                onSelectEquipe={(equipeId) => {
                  setSelectedEquipeId(equipeId);
                  setSelectedOSId(null);
                }}
                onOpenChat={(equipeId) => {
                  // Chat flutuante já existe. Aqui focamos em ações rápidas.
                  setSelectedEquipeId(equipeId);
                  toast.message("Chat disponível no canto inferior (Torre).");
                }}
                onLigar={(telefone) => window.open(`tel:${telefone}`)}
              />
            </div>

            <div className="xl:col-span-6 space-y-4">
              <MapaTorreControle
                points={mapaPoints}
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Equipe selecionada
                    </span>
                    <Badge variant="secondary">{selectedRoute?.equipe.codigo || "—"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!selectedRoute ? (
                    <div className="text-sm text-muted-foreground">Selecione uma equipe.</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{selectedRoute.equipe.codigo}</div>
                          <div className="text-xs text-muted-foreground">{selectedRoute.equipe.nome}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedRoute.equipe.telefone ? (
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(`tel:${selectedRoute.equipe.telefone}`)}>
                              <Phone className="h-4 w-4" />
                              Ligar
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setActiveTab("intervencao");
                              setIntervirOpen(true);
                            }}
                          >
                            <Route className="h-4 w-4" />
                            Editar rota
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[60px]">#</TableHead>
                              <TableHead>OS</TableHead>
                              <TableHead className="w-[120px]">Prazo</TableHead>
                              <TableHead className="w-[120px] text-right">Prev</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedRoute.ordens.slice(0, 8).map((o) => {
                              const os = o.ordens_servico;
                              if (!os) return null;
                              const prazo = os.prazo ? parseISO(os.prazo) : null;
                              const vencida = !!prazo && isPast(prazo);
                              return (
                                <TableRow key={o.id} className={cn(os.id === selectedOSId && "bg-primary/5")}>
                                  <TableCell className="font-semibold">{o.ordem_na_rota}</TableCell>
                                  <TableCell>
                                    <div className="font-medium">{os.numero}</div>
                                    <div className="text-xs text-muted-foreground truncate max-w-[360px]">{os.tipo} • {os.endereco}</div>
                                    {os.regulada ? <Badge variant="destructive" className="mt-1">REGULADA</Badge> : null}
                                  </TableCell>
                                  <TableCell>
                                    {prazo ? (
                                      <Badge variant={vencida ? "destructive" : "secondary"}>{format(prazo, "dd/MM HH:mm")}</Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-xs text-muted-foreground">{o.hora_fim_estimada?.slice(0, 5) || "—"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {selectedRoute.ordens.length > 8 ? (
                        <div className="text-xs text-muted-foreground">Mostrando 8 de {selectedRoute.ordens.length}. Vá em **Intervenção** para editar / ver tudo.</div>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-3 space-y-4">
              <Card className={cn(openAlertsCount > 0 ? "border-destructive/40" : "")}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Alertas (auto)
                    </span>
                    <Badge variant={openAlertsCount > 0 ? "destructive" : "secondary"}>{alertas.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {alertas.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6">Sem alertas.</div>
                  ) : (
                    <ScrollArea className="h-[520px] pr-3">
                      <div className="space-y-2">
                        {alertas.map((a) => (
                          <div key={a.id} className={cn("rounded-lg border p-3", a.severidade === "critical" ? "border-red-500/40 bg-red-500/5" : a.severidade === "high" ? "border-orange-500/40 bg-orange-500/5" : "bg-muted/20")}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm">{a.titulo}</div>
                              <Badge variant="secondary" className="text-[10px]">{a.severidade.toUpperCase()}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{a.descricao}</div>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              {a.equipeCodigo ? (
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{a.equipeCodigo}</span>
                              ) : null}
                              {a.osNumero ? (
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />OS {a.osNumero}</span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* INTERVENÇÃO (o lugar ÚNICO e explícito para incluir/remover/reordenar OS) */}
        <TabsContent value="intervencao" className="m-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-4">
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      Intervenção em rota
                    </span>
                    <Badge variant="secondary">{selectedRoute?.equipe.codigo || "Selecione"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Passo a passo:
                    <div className="mt-1 text-xs">
                      1) Selecione a equipe • 2) Busque a OS no backlog • 3) Clique para <b>Adicionar</b> ou use a lixeira para <b>Remover</b>.
                    </div>
                  </div>
                  <PainelEquipesDestaque
                    equipes={equipesEmDestaque}
                    onSelectEquipe={(equipeId) => {
                      setSelectedEquipeId(equipeId);
                      setSelectedOSId(null);
                    }}
                    onOpenChat={() => toast.message("Chat disponível no canto inferior (Torre).")}
                    onLigar={(telefone) => window.open(`tel:${telefone}`)}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-8 space-y-4">
              {!selectedRoute ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Selecione uma equipe (à esquerda) para editar a rota.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <IntervencaoRota
                    equipe={{
                      id: selectedRoute.equipe.id,
                      codigo: selectedRoute.equipe.codigo,
                      nome: selectedRoute.equipe.nome,
                      ordens: selectedRoute.ordens.map((o) => ({
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
                    osDisponiveis={osDisponiveisParaIntervencao as any}
                    onPreviewAdicionarOS={async (osId, posicao, motivo) => {
                      const os = (backlogOS || []).find((x: any) => x.id === osId);
                      const impactAlerts: string[] = [];
                      if (!os) {
                        impactAlerts.push("OS não encontrada no backlog local (atualize a página).");
                        return { osReguladasAfetadas: 0, osUrgentesForaDaRota: [], novaOrdemEstimada: [], alertas: impactAlerts };
                      }
                      // Preview simples: avisos de prazo/regulada
                      if (os.regulada && os.prazo) {
                        const prazo = parseISO(os.prazo);
                        if (isPast(prazo) || isToday(prazo)) impactAlerts.push("OS regulada com prazo hoje/vencido. Priorize o atendimento.");
                      }
                      if (!motivo?.trim()) impactAlerts.push("Motivo obrigatório para auditoria.");
                      return { osReguladasAfetadas: os.regulada ? 1 : 0, osUrgentesForaDaRota: [], novaOrdemEstimada: [], alertas: impactAlerts };
                    }}
                    onAplicarAdicionarOS={async (osId, posicao, motivo) => {
                      const planningId = selectedRoute.planejamentoId || planejamentoIds[0];
                      if (!planningId) throw new Error("Sem planejamento para o dia.");

                      // Se a OS já existir no planejamento (outra equipe), MOVEMOS (update) em vez de inserir (evita 409)
                      const { data: existente, error: exErr } = await supabase
                        .from("planejamento_ordens")
                        .select("id,equipe_id,ordem_na_rota")
                        .eq("planejamento_id", planningId)
                        .eq("ordem_servico_id", osId)
                        .maybeSingle();
                      if (exErr) throw exErr;

                      if (existente?.id) {
                        if (existente.equipe_id === selectedRoute.equipe.id) {
                          toast.info("Essa OS já está na rota desta equipe.");
                          return;
                        }

                        // Abrir espaço na rota alvo e fechar buraco na rota origem
                        await resequenceAfterInsert(planningId, selectedRoute.equipe.id, posicao);
                        await resequenceAfterDelete(planningId, existente.equipe_id, existente.ordem_na_rota);

                        const { error: upErr } = await supabase
                          .from("planejamento_ordens")
                          .update({ equipe_id: selectedRoute.equipe.id, ordem_na_rota: posicao })
                          .eq("id", existente.id);
                        if (upErr) throw upErr;

                        await supabase.from("planejamento_logs").insert({
                          planejamento_id: planningId,
                          ordem_servico_id: osId,
                          acao: "intervencao_mover",
                          descricao: `OS movida para a rota (${selectedRoute.equipe.codigo}) pos ${posicao}. Motivo: ${motivo}`,
                        });

                        toast.success("OS movida para a rota.");
                        await queryClient.invalidateQueries({ queryKey: ["torre2"] });
                        return;
                      }

                      await resequenceAfterInsert(planningId, selectedRoute.equipe.id, posicao);
                      const { error } = await supabase.from("planejamento_ordens").insert({
                        planejamento_id: planningId,
                        equipe_id: selectedRoute.equipe.id,
                        ordem_servico_id: osId,
                        ordem_na_rota: posicao,
                      });
                      if (error) throw error;

                      await supabase.from("planejamento_logs").insert({
                        planejamento_id: planningId,
                        ordem_servico_id: osId,
                        acao: "intervencao_adicao",
                        descricao: `OS adicionada na rota (${selectedRoute.equipe.codigo}) pos ${posicao}. Motivo: ${motivo}`,
                      });

                      toast.success("OS adicionada na rota.");
                      await queryClient.invalidateQueries({ queryKey: ["torre2"] });
                    }}
                    onPreviewRemoverOS={async (osId, motivo) => {
                      const removed = selectedRoute.ordens.find((o) => o.ordens_servico?.id === osId);
                      const os = removed?.ordens_servico;
                      const impactAlerts: string[] = [];
                      if (!os) {
                        impactAlerts.push("OS não encontrada na rota (atualize a página).");
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
                      const planningId = selectedRoute.planejamentoId || planejamentoIds[0];
                      if (!planningId) throw new Error("Sem planejamento para o dia.");

                      const removed = selectedRoute.ordens.find((o) => o.ordens_servico?.id === osId);
                      const removedOrder = removed?.ordem_na_rota ?? 0;

                      const { error } = await supabase
                        .from("planejamento_ordens")
                        .delete()
                        .eq("planejamento_id", planningId)
                        .eq("equipe_id", selectedRoute.equipe.id)
                        .eq("ordem_servico_id", osId);
                      if (error) throw error;

                      if (removedOrder > 0) await resequenceAfterDelete(planningId, selectedRoute.equipe.id, removedOrder);

                      await supabase.from("planejamento_logs").insert({
                        planejamento_id: planningId,
                        ordem_servico_id: osId,
                        acao: "intervencao_remocao",
                        descricao: `OS removida da rota (${selectedRoute.equipe.codigo}). Motivo: ${motivo}`,
                      });

                      toast.success("OS removida da rota.");
                      await queryClient.invalidateQueries({ queryKey: ["torre2"] });
                    }}
                    onReordenar={async (novaOrdem) => {
                      const planningId = selectedRoute.planejamentoId || planejamentoIds[0];
                      if (!planningId) throw new Error("Sem planejamento para o dia.");
                      for (let i = 0; i < novaOrdem.length; i++) {
                        const { error } = await supabase
                          .from("planejamento_ordens")
                          .update({ ordem_na_rota: i + 1 })
                          .eq("planejamento_id", planningId)
                          .eq("equipe_id", selectedRoute.equipe.id)
                          .eq("ordem_servico_id", novaOrdem[i]);
                        if (error) throw error;
                      }
                      await supabase.from("planejamento_logs").insert({
                        planejamento_id: planningId,
                        acao: "intervencao_reordenacao",
                        descricao: `Rota reordenada manualmente (${selectedRoute.equipe.codigo}).`,
                      });
                      toast.success("Rota reordenada.");
                      await queryClient.invalidateQueries({ queryKey: ["torre2"] });
                    }}
                    isProcessing={false}
                  />

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Backlog de OS (fora da rota selecionada)
                        </span>
                        <Badge variant="secondary">{backlogFiltrado.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-xs text-muted-foreground mb-3">
                        Dica: clique em uma OS no backlog e depois use “Adicionar OS à rota” no bloco acima (ou busque por número/endereço).
                      </div>
                      <ScrollArea className="h-[320px] pr-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>OS</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Prazo</TableHead>
                              <TableHead className="text-right">Reg</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {backlogFiltrado.slice(0, 60).map((os: any) => {
                              const prazo = os.prazo ? parseISO(os.prazo) : null;
                              const vencida = !!prazo && isPast(prazo);
                              return (
                                <TableRow key={os.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedOSId(os.id)}>
                                  <TableCell className="font-medium">{os.numero}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{os.tipo}</TableCell>
                                  <TableCell>
                                    {prazo ? <Badge variant={vencida ? "destructive" : "secondary"}>{format(prazo, "dd/MM HH:mm")}</Badge> : "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {os.regulada ? <Badge variant="destructive">SIM</Badge> : <Badge variant="secondary">—</Badge>}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        {backlogFiltrado.length > 60 ? (
                          <div className="text-xs text-muted-foreground mt-2">Mostrando 60 de {backlogFiltrado.length}. Use a busca no topo para refinar.</div>
                        ) : null}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="m-0">
          <TimelineEquipes
            dateISO={selectedDateISO}
            equipes={timelineData}
            onSelectEquipe={(equipeId) => {
              setSelectedEquipeId(equipeId);
              setSelectedOSId(null);
              setActiveTab("monitor");
            }}
            onSelectOS={(osId, equipeId) => {
              setSelectedEquipeId(equipeId);
              setSelectedOSId(osId);
              setActiveTab("monitor");
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Dialog “Intervir na rota” (atalho global) */}
      <Dialog open={intervirOpen} onOpenChange={setIntervirOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Intervenção em rota (onde incluir/remover OS)
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Use a aba <b>Intervenção</b> para trabalhar com calma. Este diálogo é só um atalho para te levar até lá.
          </div>
          <div className="flex items-center justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setIntervirOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setIntervirOpen(false);
                setActiveTab("intervencao");
              }}
            >
              Ir para Intervenção
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat com Equipes (mantém o link rápido) */}
      <ChatTorreControle />
    </MainLayout>
  );
}


