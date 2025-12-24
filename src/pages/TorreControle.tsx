import { useEffect, useMemo, useState } from "react";
import { format, isToday, isYesterday, isTomorrow, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  Settings,
  Timer,
  UserCheck,
  BellOff,
  MessageSquareText,
  Check,
  Undo2,
  Wifi,
  WifiOff,
  Activity,
  Route,
  Navigation,
  BadgeCheck,
  PauseCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MapaTorreControle, { type TorreRouteGeometry, type TorreMapaPoint } from "./components/MapaTorreControle";
import TorreTimeline from "./components/TorreTimeline";
import { buscarRotaOSRM } from "@/services/osrm";
import { toast } from "sonner";
import { ChatTorreControle } from "@/components/chat/ChatTorreControle";

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

type AlertKind =
  | "fora_de_rota"
  | "parada_nao_planejada"
  | "rota_atrasada"
  | "os_em_risco"
  | "gps_off"
  | "offline"
  | "bateria_baixa"
  | "checkin_fora_raio"
  | "servico_forado_raio"
  | "tempo_servico_excedido"
  | "manual";

const ALERT_CATALOG: Array<{
  kind: AlertKind;
  nome: string;
  ativoHoje: boolean;
  origem: "engine" | "banco";
  gatilho: string;
  dadosNecessarios: string;
  recomendacao: string;
}> = [
  {
    kind: "offline",
    nome: "Equipe sem atualização",
    ativoHoje: true,
    origem: "engine",
    gatilho: "Última atualização > X min (proxy por OS/logs) ou sem telemetria",
    dadosNecessarios: "ordens_servico.updated_at / planejamento_logs / tecnicos_posicoes",
    recomendacao: "Reconhecer → Ligar → Assumir → Registrar comentário → Resolver",
  },
  {
    kind: "rota_atrasada",
    nome: "Atraso na rota",
    ativoHoje: true,
    origem: "engine",
    gatilho: "Hora atual passou do fim previsto da próxima OS por X min",
    dadosNecessarios: "planejamento_ordens.hora_fim_estimada + status da OS",
    recomendacao: "Assumir → avaliar replanejamento/apoio → comentar → resolver",
  },
  {
    kind: "parada_nao_planejada",
    nome: "Parada prolongada",
    ativoHoje: true,
    origem: "engine",
    gatilho: "Status (no_local/pausada/em_deslocamento) parado por Y min (proxy)",
    dadosNecessarios: "timestamps da OS (pausado_at/chegada/execução/updated_at)",
    recomendacao: "Reconhecer → contato → comentar causa → resolver ou silenciar 30m",
  },
  {
    kind: "fora_de_rota",
    nome: "Fora de rota (desvio)",
    ativoHoje: false,
    origem: "engine",
    gatilho: "Distância da posição atual para a geometria planejada > N metros",
    dadosNecessarios: "tecnicos_posicoes (telemetria real) + rota OSRM",
    recomendacao: "Assumir → orientar equipe → comentar → resolver",
  },
  {
    kind: "gps_off",
    nome: "GPS desativado",
    ativoHoje: false,
    origem: "engine",
    gatilho: "gps_ativo = false ou ausência de posição por janela curta",
    dadosNecessarios: "tecnicos_posicoes.gps_ativo",
    recomendacao: "Contato → instrução → comentar → resolver",
  },
  {
    kind: "bateria_baixa",
    nome: "Bateria baixa",
    ativoHoje: false,
    origem: "engine",
    gatilho: "battery_pct abaixo do limite",
    dadosNecessarios: "tecnicos_posicoes.battery_pct",
    recomendacao: "Contato → orientar carregamento → silenciar → resolver",
  },
  {
    kind: "checkin_fora_raio",
    nome: "Check-in fora do raio",
    ativoHoje: false,
    origem: "engine",
    gatilho: "Check-in/ação com distância > raio permitido",
    dadosNecessarios: "telemetria + ponto da OS + evento de check-in",
    recomendacao: "Auditar → comentar evidências → resolver",
  },
  {
    kind: "tempo_servico_excedido",
    nome: "Tempo máximo excedido",
    ativoHoje: false,
    origem: "engine",
    gatilho: "Tempo em execução > limite (por tipo/skill)",
    dadosNecessarios: "execucao_iniciada_at + regras de limite",
    recomendacao: "Contato → apoio → comentar → resolver",
  },
  {
    kind: "manual",
    nome: "Alerta manual (criado no banco)",
    ativoHoje: true,
    origem: "banco",
    gatilho: "Registro inserido em public.alertas",
    dadosNecessarios: "public.alertas",
    recomendacao: "Aplicar tratativas e registrar histórico",
  },
];

interface TorreAlertaUI {
  id: string;
  kind: AlertKind;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  equipeId?: string;
  equipeCodigo?: string;
  osId?: string;
  osNumero?: string;
  createdAt: string;
  source: "sistema" | "banco";
  dbId?: string; // quando existir registro em public.alertas
  status?: string | null;
  snoozedUntil?: string | null;
  assignedTo?: string | null;
  acknowledgedBy?: string | null;
}

interface TorreEquipe {
  id: string;
  codigo: string;
  nome: string;
  telefone?: string | null;
  status?: string | null;
  color?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  local_partida?: { lat: number; lng: number } | null;
  local_chegada?: { lat: number; lng: number } | null;
}

interface TorrePlanejamentoOrdem {
  id: string;
  planejamento_id: string;
  equipe_id: string;
  ordem_na_rota: number;
  distancia_km?: number | null;
  tempo_estimado_minutos?: number | null;
  hora_inicio_estimada?: string | null; // "HH:mm:ss"
  hora_fim_estimada?: string | null; // "HH:mm:ss"
  ordens_servico: {
    id: string;
    numero: string;
    tipo: string;
    status: OSStatus;
    endereco: string;
    cliente_nome?: string | null;
    prazo?: string | null;
    regulada?: boolean | null;
    valor?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    updated_at?: string | null;
    deslocamento_iniciado_at?: string | null;
    chegada_local_at?: string | null;
    execucao_iniciada_at?: string | null;
    iniciado_at?: string | null;
    concluido_at?: string | null;
    pausado_at?: string | null;
  } | null;
  tecnicos: {
    id: string;
    codigo: string;
    nome: string;
    telefone?: string | null;
    status?: string | null;
    color?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    local_partida?: any;
    local_chegada?: any;
  } | null;
}

interface TorreConfig {
  refreshIntervalSec: number;
  autoRefresh: boolean;
  onlyOpenPlanning: boolean;
  showReguladasOnly: boolean;
  offlineThresholdMin: number;
  stopThresholdMin: number;
  atrasoThresholdMin: number;
  mostrarRotasNoMapa: boolean;
  mostrarMarcadoresEquipes: boolean;
  // Alertas
  alertaForaRotaAtivo: boolean;
  alertaParadaAtivo: boolean;
  alertaAtrasoAtivo: boolean;
  alertaOfflineAtivo: boolean;
  // Limiar de desvio (se houver geometria e “posição” inferida)
  foraRotaDistanciaM: number;
}

const defaultConfig: TorreConfig = {
  refreshIntervalSec: 60,
  autoRefresh: true,
  onlyOpenPlanning: true,
  showReguladasOnly: false,
  offlineThresholdMin: 8,
  stopThresholdMin: 7,
  atrasoThresholdMin: 15,
  mostrarRotasNoMapa: true,
  mostrarMarcadoresEquipes: true,
  alertaForaRotaAtivo: true,
  alertaParadaAtivo: true,
  alertaAtrasoAtivo: true,
  alertaOfflineAtivo: true,
  foraRotaDistanciaM: 350,
};

function safeParseJson<T>(value: any): T | null {
  try {
    if (!value) return null;
    if (typeof value === "object") return value as T;
    if (typeof value === "string") return JSON.parse(value) as T;
    return null;
  } catch {
    return null;
  }
}

function dateToISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function getDateLabel(d: Date): string {
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
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

function fmtMin(min: number): string {
  const abs = Math.abs(min);
  if (abs < 60) return `${min} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = min < 0 ? "-" : "";
  return `${sign}${h}h ${String(m).padStart(2, "0")}min`;
}

function statusBadgeVariant(status: OSStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "concluida":
      return "default";
    case "cancelada":
      return "secondary";
    case "pausada":
      return "outline";
    case "em_deslocamento":
    case "no_local":
    case "em_execucao":
    case "em_andamento":
      return "outline";
    case "pendente":
    case "planejada":
    default:
      return "secondary";
  }
}

function statusLabel(status: OSStatus): string {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "planejada":
      return "Planejada";
    case "em_deslocamento":
      return "Em deslocamento";
    case "no_local":
      return "No local";
    case "em_execucao":
      return "Em execução";
    case "em_andamento":
      return "Em andamento";
    case "pausada":
      return "Pausada";
    case "concluida":
      return "Concluída";
    case "cancelada":
      return "Cancelada";
    default:
      return status;
  }
}

function pickEquipeCoord(e: TorreEquipe): { lat: number; lng: number } | null {
  const lp = safeParseJson<{ lat: number; lng: number }>(e.local_partida);
  if (lp?.lat && lp?.lng) return lp;
  if (e.latitude != null && e.longitude != null) return { lat: Number(e.latitude), lng: Number(e.longitude) };
  return null;
}

function inferPosicaoEquipeFromOS(ordens: TorrePlanejamentoOrdem[]): { lat: number; lng: number; updatedAt?: string | null } | null {
  // Sem telemetria real: inferimos posição aproximada como:
  // 1) OS em andamento (deslocamento/no_local/execução/pausada) com coordenadas
  // 2) última OS concluída com coordenadas
  const inProgress = ordens
    .filter((o) => {
      const st = o.ordens_servico?.status;
      return st === "em_deslocamento" || st === "no_local" || st === "em_execucao" || st === "em_andamento" || st === "pausada";
    })
    .filter((o) => o.ordens_servico?.latitude != null && o.ordens_servico?.longitude != null)
    .sort((a, b) => (a.ordem_na_rota ?? 0) - (b.ordem_na_rota ?? 0));

  if (inProgress[0]?.ordens_servico?.latitude != null && inProgress[0]?.ordens_servico?.longitude != null) {
    return {
      lat: Number(inProgress[0].ordens_servico.latitude),
      lng: Number(inProgress[0].ordens_servico.longitude),
      updatedAt: inProgress[0].ordens_servico.updated_at ?? null,
    };
  }

  const lastDone = ordens
    .filter((o) => o.ordens_servico?.status === "concluida")
    .filter((o) => o.ordens_servico?.latitude != null && o.ordens_servico?.longitude != null)
    .sort((a, b) => (b.ordem_na_rota ?? 0) - (a.ordem_na_rota ?? 0))[0];

  if (lastDone?.ordens_servico?.latitude != null && lastDone?.ordens_servico?.longitude != null) {
    return {
      lat: Number(lastDone.ordens_servico.latitude),
      lng: Number(lastDone.ordens_servico.longitude),
      updatedAt: lastDone.ordens_servico.updated_at ?? null,
    };
  }
  return null;
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

function computeExpectedIndex(now: Date, dataPlanejamento: Date, ordens: TorrePlanejamentoOrdem[]): number | null {
  // Retorna o índice (0-based) da OS que “deveria” estar concluída/atingida pelo plano horário.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sorted = [...ordens].sort((a, b) => (a.ordem_na_rota ?? 0) - (b.ordem_na_rota ?? 0));
  if (format(now, "yyyy-MM-dd") !== format(dataPlanejamento, "yyyy-MM-dd")) {
    return null; // fora do dia
  }
  let expected = -1;
  for (let i = 0; i < sorted.length; i++) {
    const endMin = toMinutes(sorted[i].hora_fim_estimada);
    if (endMin == null) continue;
    if (nowMin >= endMin) expected = i;
  }
  return expected >= 0 ? expected : 0;
}

function computeLastUpdate(ordens: TorrePlanejamentoOrdem[]): Date | null {
  const dates: Date[] = [];
  for (const o of ordens) {
    const u = o.ordens_servico?.updated_at;
    if (u) dates.push(new Date(u));
    const c = o.ordens_servico?.concluido_at;
    if (c) dates.push(new Date(c));
    const d = o.ordens_servico?.deslocamento_iniciado_at;
    if (d) dates.push(new Date(d));
    const e = o.ordens_servico?.execucao_iniciada_at;
    if (e) dates.push(new Date(e));
    const p = o.ordens_servico?.pausado_at;
    if (p) dates.push(new Date(p));
  }
  if (dates.length === 0) return null;
  dates.sort((a, b) => b.getTime() - a.getTime());
  return dates[0];
}

function computeStopMinutes(ordem: TorrePlanejamentoOrdem): number | null {
  const os = ordem.ordens_servico;
  if (!os) return null;
  // Parada “não planejada” = ficou em um status por muito tempo (proxy)
  // Priorizamos timestamps específicos:
  const anchor =
    os.pausado_at ||
    os.chegada_local_at ||
    os.execucao_iniciada_at ||
    os.deslocamento_iniciado_at ||
    os.updated_at;
  if (!anchor) return null;
  return diffMinutes(new Date(), new Date(anchor));
}

function computeRiscoAtraso(now: Date, dataPlanejamento: Date, ordem: TorrePlanejamentoOrdem, thresholdMin: number): { isLate: boolean; lateByMin: number } {
  const endMin = toMinutes(ordem.hora_fim_estimada);
  if (endMin == null) return { isLate: false, lateByMin: 0 };
  if (format(now, "yyyy-MM-dd") !== format(dataPlanejamento, "yyyy-MM-dd")) return { isLate: false, lateByMin: 0 };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const lateBy = nowMin - endMin;
  return { isLate: lateBy >= thresholdMin, lateByMin: lateBy };
}

const TorreControle = () => {
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [search, setSearch] = useState("");
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null);
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [mainView, setMainView] = useState<"operacao" | "timeline">("operacao");
  const [tabRight, setTabRight] = useState<"alertas" | "atividade" | "detalhes">("alertas");
  const [nowTick, setNowTick] = useState(0);
  const [alertaExpandidoId, setAlertaExpandidoId] = useState<string | null>(null);
  const [comentarioDialog, setComentarioDialog] = useState<{ open: boolean; alerta: TorreAlertaUI | null; texto: string }>({
    open: false,
    alerta: null,
    texto: "",
  });
  const [mostrarSilenciados, setMostrarSilenciados] = useState(false);
  const [materializedAlertMap, setMaterializedAlertMap] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<TorreConfig>(() => {
    try {
      const raw = localStorage.getItem("torre_controle_config_v1");
      if (!raw) return defaultConfig;
      return { ...defaultConfig, ...(JSON.parse(raw) as Partial<TorreConfig>) };
    } catch {
      return defaultConfig;
    }
  });

  const selectedDateISO = useMemo(() => dateToISODate(selectedDate), [selectedDate]);

  // Persist config
  useEffect(() => {
    localStorage.setItem("torre_controle_config_v1", JSON.stringify(config));
  }, [config]);

  // Clock tick (para atualizar “há X min” sem refetch)
  useEffect(() => {
    const t = window.setInterval(() => {
      setNowTick((v) => v + 1);
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const refreshInterval = config.autoRefresh ? Math.max(10, config.refreshIntervalSec) * 1000 : false;

  const { data: posicoesAtuais } = useQuery({
    queryKey: ["torre", "posicoes_atuais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_tecnicos_posicao_atual")
        .select("equipe_id,latitude,longitude,recorded_at,accuracy_m,speed_mps,heading_deg,battery_pct,gps_ativo,app_state");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: refreshInterval,
  });

  const { data: equipes, isLoading: loadingEquipes } = useQuery({
    queryKey: ["torre", "equipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("id,codigo,nome,telefone,status,color,latitude,longitude,local_partida,local_chegada")
        .order("codigo");
      if (error) throw error;
      return (data || []) as unknown as TorreEquipe[];
    },
    staleTime: 60_000,
    refetchInterval: refreshInterval,
  });

  const { data: planejamentosHoje, isLoading: loadingPlanejamentos } = useQuery({
    queryKey: ["torre", "planejamentos", selectedDateISO],
    queryFn: async () => {
      let q = supabase.from("planejamentos").select("id,data_planejamento,status").eq("data_planejamento", selectedDateISO);
      if (config.onlyOpenPlanning) q = q.eq("status", "aberto");
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{ id: string; data_planejamento: string; status: string }>;
    },
    refetchInterval: refreshInterval,
  });

  const planejamentoIds = useMemo(() => (planejamentosHoje || []).map((p) => p.id), [planejamentosHoje]);

  const { data: ordensPlanejadas, isLoading: loadingOrdens } = useQuery({
    queryKey: ["torre", "planejamento_ordens", selectedDateISO, planejamentoIds.join("|")],
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
          distancia_km,
          tempo_estimado_minutos,
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
            valor,
            latitude,
            longitude,
            updated_at,
            deslocamento_iniciado_at,
            chegada_local_at,
            execucao_iniciada_at,
            iniciado_at,
            concluido_at,
            pausado_at
          ),
          tecnicos:equipe_id (
            id,
            codigo,
            nome,
            telefone,
            status,
            color,
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
    refetchInterval: refreshInterval,
  });

  const { data: alertasDB, isLoading: loadingAlertasDB } = useQuery({
    queryKey: ["torre", "alertas_db"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas")
        .select("id,tipo,severidade,titulo,descricao,tecnico_id,ordem_servico_id,resolvido,created_at,status,snoozed_until,assigned_to,acknowledged_by")
        .eq("resolvido", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: refreshInterval,
  });

  const alertasDbIds = useMemo(() => (alertasDB || []).map((a: any) => String(a.id)), [alertasDB]);

  const { data: tratativasAlertas, isLoading: loadingTratativasAlertas } = useQuery({
    queryKey: ["torre", "alertas_tratativas", alertasDbIds.join("|")],
    queryFn: async () => {
      if (alertasDbIds.length === 0) return [] as any[];
      const { data, error } = await supabase
        .from("alertas_tratativas")
        .select("id,alerta_id,acao,comentario,payload,created_by,created_at")
        .in("alerta_id", alertasDbIds)
        .order("created_at", { ascending: false })
        .limit(800);
      if (error) throw error;
      return data || [];
    },
    enabled: alertasDbIds.length > 0,
    refetchInterval: refreshInterval,
  });

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["torre", "logs", selectedDateISO, planejamentoIds.join("|")],
    queryFn: async () => {
      if (planejamentoIds.length === 0) return [] as any[];
      const { data, error } = await supabase
        .from("planejamento_logs")
        .select("id,planejamento_id,ordem_servico_id,acao,descricao,created_at,created_by")
        .in("planejamento_id", planejamentoIds)
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return data || [];
    },
    enabled: planejamentoIds.length > 0,
    refetchInterval: refreshInterval,
  });

  // Realtime (ordens_servico / planejamento_logs / alertas)
  useEffect(() => {
    const channel = supabase
      .channel("torre-controle-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordens_servico" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["torre", "planejamento_ordens"] });
          queryClient.invalidateQueries({ queryKey: ["torre", "alertas_db"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planejamento_logs" },
        () => queryClient.invalidateQueries({ queryKey: ["torre", "logs"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas" },
        () => queryClient.invalidateQueries({ queryKey: ["torre", "alertas_db"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas_tratativas" },
        () => queryClient.invalidateQueries({ queryKey: ["torre", "alertas_tratativas"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tecnicos_posicoes" },
        () => queryClient.invalidateQueries({ queryKey: ["torre", "posicoes_atuais"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const dataPlanejamentoDate = useMemo(() => new Date(`${selectedDateISO}T12:00:00`), [selectedDateISO]);

  const rotasPorEquipe = useMemo(() => {
    const grouped = new Map<
      string,
      {
        equipe: TorreEquipe;
        ordens: TorrePlanejamentoOrdem[];
        planejamentoId: string;
      }
    >();
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
        color: eq.color ?? null,
        latitude: eq.latitude ?? null,
        longitude: eq.longitude ?? null,
        local_partida: safeParseJson(eq.local_partida),
        local_chegada: safeParseJson(eq.local_chegada),
      };

      if (!grouped.has(eq.id)) {
        grouped.set(eq.id, { equipe, ordens: [], planejamentoId: po.planejamento_id });
      }
      grouped.get(eq.id)!.ordens.push(po);
    }

    // sort each route
    for (const entry of grouped.values()) {
      entry.ordens.sort((a, b) => (a.ordem_na_rota ?? 0) - (b.ordem_na_rota ?? 0));
    }

    const arr = Array.from(grouped.values());

    // Apply search + reguladas filter
    const term = search.trim().toLowerCase();
    const filtered = arr
      .map((r) => {
        let ordens = r.ordens;
        if (config.showReguladasOnly) {
          ordens = ordens.filter((o) => !!o.ordens_servico?.regulada);
        }
        if (term) {
          ordens = ordens.filter((o) => {
            const os = o.ordens_servico;
            if (!os) return false;
            return (
              os.numero?.toLowerCase().includes(term) ||
              os.endereco?.toLowerCase().includes(term) ||
              os.tipo?.toLowerCase().includes(term) ||
              (os.cliente_nome?.toLowerCase().includes(term) ?? false)
            );
          });
        }
        return { ...r, ordens };
      })
      .filter((r) => r.ordens.length > 0);

    // Order by severity/late first
    const now = new Date();
    filtered.sort((a, b) => {
      const aLast = computeLastUpdate(a.ordens)?.getTime() ?? 0;
      const bLast = computeLastUpdate(b.ordens)?.getTime() ?? 0;
      const aProg = computeEquipeProgress(a.ordens);
      const bProg = computeEquipeProgress(b.ordens);

      const aOpen = aProg.remaining > 0 ? 1 : 0;
      const bOpen = bProg.remaining > 0 ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;

      // late count
      const aLate = a.ordens.filter((o) => {
        const os = o.ordens_servico;
        if (!os) return false;
        if (os.status === "concluida" || os.status === "cancelada") return false;
        return computeRiscoAtraso(now, dataPlanejamentoDate, o, config.atrasoThresholdMin).isLate;
      }).length;
      const bLate = b.ordens.filter((o) => {
        const os = o.ordens_servico;
        if (!os) return false;
        if (os.status === "concluida" || os.status === "cancelada") return false;
        return computeRiscoAtraso(now, dataPlanejamentoDate, o, config.atrasoThresholdMin).isLate;
      }).length;
      if (aLate !== bLate) return bLate - aLate;

      return bLast - aLast;
    });

    return filtered;
  }, [ordensPlanejadas, search, config.showReguladasOnly, config.atrasoThresholdMin, dataPlanejamentoDate, nowTick]);

  // Auto-select first equipe when data arrives
  useEffect(() => {
    if (!selectedEquipeId && rotasPorEquipe.length > 0) {
      setSelectedEquipeId(rotasPorEquipe[0].equipe.id);
    }
  }, [rotasPorEquipe, selectedEquipeId]);

  const selectedRoute = useMemo(() => rotasPorEquipe.find((r) => r.equipe.id === selectedEquipeId) ?? null, [rotasPorEquipe, selectedEquipeId]);

  const kpis = useMemo(() => {
    const all = rotasPorEquipe.flatMap((r) => r.ordens);
    const total = all.length;
    const done = all.filter((o) => o.ordens_servico?.status === "concluida").length;
    const canceled = all.filter((o) => o.ordens_servico?.status === "cancelada").length;
    const inProgress = all.filter((o) => {
      const st = o.ordens_servico?.status;
      return st === "em_deslocamento" || st === "no_local" || st === "em_execucao" || st === "em_andamento" || st === "pausada";
    }).length;
    const pending = Math.max(0, total - done - canceled - inProgress);
    const reguladas = all.filter((o) => !!o.ordens_servico?.regulada).length;

    const now = new Date();
    const atrasadas = all.filter((o) => {
      const os = o.ordens_servico;
      if (!os) return false;
      if (os.status === "concluida" || os.status === "cancelada") return false;
      return computeRiscoAtraso(now, dataPlanejamentoDate, o, config.atrasoThresholdMin).isLate;
    }).length;

    const equipesAtivas = rotasPorEquipe.filter((r) => computeEquipeProgress(r.ordens).remaining > 0).length;
    return { total, done, canceled, inProgress, pending, reguladas, atrasadas, equipesAtivas };
  }, [rotasPorEquipe, dataPlanejamentoDate, config.atrasoThresholdMin, nowTick]);

  const alertasGerados = useMemo(() => {
    const now = new Date();
    const result: TorreAlertaUI[] = [];

    for (const r of rotasPorEquipe) {
      const { equipe, ordens } = r;
      const progress = computeEquipeProgress(ordens);
      const lastUpdate = computeLastUpdate(ordens);
      const isOffline = lastUpdate ? diffMinutes(now, lastUpdate) >= config.offlineThresholdMin : true;

      if (config.alertaOfflineAtivo && progress.total > 0 && isOffline) {
        result.push({
          id: `offline:${equipe.id}`,
          kind: "offline",
          severidade: "high",
          titulo: `${equipe.codigo} • Sem atualização`,
          descricao: lastUpdate ? `Última atualização há ${fmtMin(diffMinutes(now, lastUpdate))}.` : "Sem histórico de atualização para o dia.",
          equipeId: equipe.id,
          equipeCodigo: equipe.codigo,
          createdAt: now.toISOString(),
          source: "sistema",
        });
      }

      // Próxima OS (primeira não concluída/cancelada)
      const proxima = ordens.find((o) => {
        const st = o.ordens_servico?.status;
        return st && st !== "concluida" && st !== "cancelada";
      });

      if (!proxima?.ordens_servico) continue;

      if (config.alertaAtrasoAtivo) {
        const risco = computeRiscoAtraso(now, dataPlanejamentoDate, proxima, config.atrasoThresholdMin);
        if (risco.isLate) {
          result.push({
            id: `late:${proxima.ordens_servico.id}`,
            kind: "rota_atrasada",
            severidade: risco.lateByMin >= 60 ? "critical" : "high",
            titulo: `${equipe.codigo} • Atraso na rota`,
            descricao: `OS ${proxima.ordens_servico.numero} deveria terminar às ${proxima.hora_fim_estimada?.slice(0, 5) || "--:--"} (atraso ${fmtMin(risco.lateByMin)}).`,
            equipeId: equipe.id,
            equipeCodigo: equipe.codigo,
            osId: proxima.ordens_servico.id,
            osNumero: proxima.ordens_servico.numero,
            createdAt: now.toISOString(),
            source: "sistema",
          });
        }
      }

      if (config.alertaParadaAtivo) {
        const st = proxima.ordens_servico.status;
        // Parada não planejada: está em “no_local/pausada” ou “em_deslocamento” sem progresso por muito tempo
        if (st === "no_local" || st === "pausada" || st === "em_deslocamento") {
          const mins = computeStopMinutes(proxima);
          if (mins != null && mins >= config.stopThresholdMin) {
            result.push({
              id: `stop:${proxima.ordens_servico.id}`,
              kind: "parada_nao_planejada",
              severidade: mins >= 20 ? "high" : "medium",
              titulo: `${equipe.codigo} • Parada prolongada`,
              descricao: `OS ${proxima.ordens_servico.numero} em “${statusLabel(st)}” há ~${fmtMin(mins)}.`,
              equipeId: equipe.id,
              equipeCodigo: equipe.codigo,
              osId: proxima.ordens_servico.id,
              osNumero: proxima.ordens_servico.numero,
              createdAt: now.toISOString(),
              source: "sistema",
            });
          }
        }
      }

      // “Fora de rota” real depende de telemetria + geometria. Aqui fica como placeholder inteligente:
      // quando houver geometria (selecionada) + posição inferida, calcularemos no detalhe.
    }

    // DB alerts -> UI
    const fromDb: TorreAlertaUI[] =
      (alertasDB || []).map((a) => ({
        id: `db:${a.id}`,
        kind: (a.tipo as AlertKind) || "manual",
        severidade: (a.severidade as Severidade) || "medium",
        titulo: a.titulo || "Alerta",
        descricao: a.descricao || "",
        equipeId: a.tecnico_id || undefined,
        osId: a.ordem_servico_id || undefined,
        createdAt: a.created_at,
        source: "banco",
        dbId: String(a.id),
        status: a.status ?? null,
        snoozedUntil: a.snoozed_until ?? null,
        assignedTo: a.assigned_to ?? null,
        acknowledgedBy: a.acknowledged_by ?? null,
      })) || [];

    const merged = [...result, ...fromDb].map((a) => {
      if (a.source === "sistema") {
        const materialized = materializedAlertMap[a.id];
        if (materialized) {
          return { ...a, dbId: materialized, id: `db:${materialized}`, source: "banco" as const };
        }
      }
      return a;
    });
    // Dedup básico
    const uniq = new Map<string, TorreAlertaUI>();
    for (const a of merged) {
      uniq.set(a.id, a);
    }

    const list = Array.from(uniq.values()).filter((a) => {
      if (!mostrarSilenciados && a.snoozedUntil) {
        const until = new Date(a.snoozedUntil).getTime();
        if (until > Date.now()) return false;
      }
      return true;
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    rotasPorEquipe,
    alertasDB,
    config.offlineThresholdMin,
    config.stopThresholdMin,
    config.atrasoThresholdMin,
    config.alertaOfflineAtivo,
    config.alertaParadaAtivo,
    config.alertaAtrasoAtivo,
    dataPlanejamentoDate,
    nowTick,
    mostrarSilenciados,
    materializedAlertMap,
  ]);

  const getUserId = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) throw error || new Error("Usuário não autenticado");
    return data.user.id;
  };

  const ensureAlertDbId = async (a: TorreAlertaUI): Promise<string> => {
    if (a.dbId) return a.dbId;
    const mapped = materializedAlertMap[a.id];
    if (mapped) return mapped;

    // Materializa alerta "sistema" no banco para permitir tratativa auditável
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

  const registrarTratativaMutation = useMutation({
    mutationFn: async (params: { alerta: TorreAlertaUI; acao: string; comentario?: string; payload?: Record<string, unknown> }) => {
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

      const updates: Record<string, unknown> = { updated_at: nowIso };
      if (params.acao === "acknowledge") {
        updates.status = "acknowledged";
        updates.acknowledged_at = nowIso;
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
        updates.resolvido_at = nowIso;
        updates.resolved_by_user_id = userId;
      }
      if (params.acao === "reopen") {
        updates.status = "open";
        updates.resolvido = false;
        updates.resolvido_at = null;
        updates.resolved_by_user_id = null;
        updates.snoozed_until = null;
      }

      const { error: upErr } = await supabase.from("alertas").update(updates).eq("id", alertaId);
      if (upErr) throw upErr;

      return { alertaId };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["torre", "alertas_db"] });
      await queryClient.invalidateQueries({ queryKey: ["torre", "alertas_tratativas"] });
    },
    onError: (e: any) => {
      console.error(e);
      toast.error("Não foi possível registrar a tratativa do alerta.");
    },
  });

  const mapaPoints = useMemo(() => {
    const pts: TorreMapaPoint[] = [];

    const posMap = new Map<string, { lat: number; lng: number; recorded_at?: string }>();
    for (const p of posicoesAtuais || []) {
      if (!p?.equipe_id) continue;
      if (p.latitude == null || p.longitude == null) continue;
      posMap.set(String(p.equipe_id), {
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        recorded_at: p.recorded_at,
      });
    }

    for (const r of rotasPorEquipe) {
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

      // Equipe marker (inferido)
      if (config.mostrarMarcadoresEquipes) {
        const telem = posMap.get(equipe.id) || null;
        const inferred = inferPosicaoEquipeFromOS(ordens);
        const fallback = pickEquipeCoord(equipe);
        const pos =
          telem
            ? { lat: telem.lat, lng: telem.lng, updatedAt: telem.recorded_at ?? null }
            : inferred || (fallback ? { ...fallback, updatedAt: null } : null);
        if (pos) {
          pts.push({
            kind: "equipe",
            equipeId: equipe.id,
            equipeCodigo: equipe.codigo,
            equipeNome: equipe.nome,
            statusEquipe: equipe.status ?? null,
            lat: pos.lat,
            lng: pos.lng,
            updatedAt: pos.updatedAt ?? null,
          });
        }
      }
    }

    return pts;
  }, [rotasPorEquipe, config.mostrarMarcadoresEquipes, posicoesAtuais]);

  // Rota no mapa (só equipe selecionada, para não saturar OSRM)
  const [routeGeometry, setRouteGeometry] = useState<TorreRouteGeometry | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [executedGeometry, setExecutedGeometry] = useState<TorreRouteGeometry | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!config.mostrarRotasNoMapa) {
        setRouteGeometry(null);
        return;
      }
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
  }, [selectedRoute, config.mostrarRotasNoMapa]);

  // Track executado (telemetria) da equipe selecionada
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedEquipeId) {
        setExecutedGeometry(null);
        return;
      }

      // Range do dia (local) -> ISO
      const startLocal = new Date(`${selectedDateISO}T00:00:00`);
      const endLocal = new Date(`${selectedDateISO}T23:59:59`);

      const { data, error } = await supabase
        .from("tecnicos_posicoes")
        .select("latitude,longitude,recorded_at")
        .eq("equipe_id", selectedEquipeId)
        .gte("recorded_at", startLocal.toISOString())
        .lte("recorded_at", endLocal.toISOString())
        .order("recorded_at", { ascending: true })
        .limit(600);

      if (cancelled) return;
      if (error) {
        setExecutedGeometry(null);
        return;
      }

      const coords = (data || [])
        .filter((p: any) => p.latitude != null && p.longitude != null)
        .map((p: any) => [Number(p.longitude), Number(p.latitude)] as [number, number]);

      if (coords.length < 2) {
        setExecutedGeometry(null);
        return;
      }

      setExecutedGeometry({ coordinates: coords });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedEquipeId, selectedDateISO, refreshInterval]);

  const isLoading = loadingEquipes || loadingPlanejamentos || loadingOrdens;

  const headerConnectionBadge = config.autoRefresh ? (
    <Badge variant="secondary" className="gap-2">
      <Wifi className="h-3.5 w-3.5" />
      Auto (a cada {config.refreshIntervalSec}s)
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-2">
      <WifiOff className="h-3.5 w-3.5" />
      Manual
    </Badge>
  );

  return (
    <MainLayout title="Torre de Controle" subtitle="Monitoramento operacional (tempo real + execução vs planejado)" breadcrumbs={[{ label: "Torre de Controle" }]}>
      {/* Header Controls */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-danger/10 text-danger border border-danger/20 gap-2">
              <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
              AO VIVO
            </Badge>
            {headerConnectionBadge}
            <span className="text-sm text-muted-foreground">
              {format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
            </span>
            <Separator orientation="vertical" className="hidden lg:block h-6" />
            <Badge variant="secondary" className="gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              {alertasGerados.length} alertas (sistema + banco)
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 bg-muted/40 border rounded-lg p-1">
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => subDays(d, 1))} title="Dia anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="gap-2" onClick={() => setSelectedDate(new Date())} title="Ir para hoje">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{getDateLabel(selectedDate)}</span>
                <span className="text-xs text-muted-foreground">{format(selectedDate, "EEE", { locale: ptBR })}</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => addDays(d, 1))} title="Próximo dia">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Input
              type="date"
              value={selectedDateISO}
              onChange={(e) => setSelectedDate(new Date(`${e.target.value}T12:00:00`))}
              className="w-[160px]"
            />

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["torre"] });
              }}
              disabled={isLoading}
            >
              <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Atualizar
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="default" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>Configurações da Torre</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-90px)] pr-4 mt-4">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          Monitoramento
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-medium">Auto-refresh</div>
                            <div className="text-sm text-muted-foreground">Atualiza dados automaticamente (polling + realtime).</div>
                          </div>
                          <Switch checked={config.autoRefresh} onCheckedChange={(v) => setConfig((c) => ({ ...c, autoRefresh: v }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Intervalo (seg)</div>
                            <Input
                              type="number"
                              min={10}
                              step={10}
                              value={config.refreshIntervalSec}
                              onChange={(e) => setConfig((c) => ({ ...c, refreshIntervalSec: Number(e.target.value || 60) }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Somente planejamento “aberto”</div>
                            <div className="h-10 flex items-center justify-end">
                              <Switch checked={config.onlyOpenPlanning} onCheckedChange={(v) => setConfig((c) => ({ ...c, onlyOpenPlanning: v }))} />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Mostrar rota no mapa</div>
                            <div className="h-10 flex items-center justify-end">
                              <Switch checked={config.mostrarRotasNoMapa} onCheckedChange={(v) => setConfig((c) => ({ ...c, mostrarRotasNoMapa: v }))} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Mostrar marcador da equipe</div>
                            <div className="h-10 flex items-center justify-end">
                              <Switch checked={config.mostrarMarcadoresEquipes} onCheckedChange={(v) => setConfig((c) => ({ ...c, mostrarMarcadoresEquipes: v }))} />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Apenas reguladas</div>
                            <div className="h-10 flex items-center justify-end">
                              <Switch checked={config.showReguladasOnly} onCheckedChange={(v) => setConfig((c) => ({ ...c, showReguladasOnly: v }))} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Limiar atraso (min)</div>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={config.atrasoThresholdMin}
                              onChange={(e) => setConfig((c) => ({ ...c, atrasoThresholdMin: Number(e.target.value || 15) }))}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Alertas (engine)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Offline (min)</div>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={config.offlineThresholdMin}
                              onChange={(e) => setConfig((c) => ({ ...c, offlineThresholdMin: Number(e.target.value || 8) }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Parada (min)</div>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={config.stopThresholdMin}
                              onChange={(e) => setConfig((c) => ({ ...c, stopThresholdMin: Number(e.target.value || 7) }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Fora de rota (distância, m)</div>
                          <Input
                            type="number"
                            min={50}
                            step={50}
                            value={config.foraRotaDistanciaM}
                            onChange={(e) => setConfig((c) => ({ ...c, foraRotaDistanciaM: Number(e.target.value || 350) }))}
                          />
                          <div className="text-xs text-muted-foreground">
                            Esse alerta fica “total” quando houver telemetria real (posição atual). Hoje a torre usa posição inferida por OS.
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm">Atraso na rota</span>
                            <Switch checked={config.alertaAtrasoAtivo} onCheckedChange={(v) => setConfig((c) => ({ ...c, alertaAtrasoAtivo: v }))} />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm">Parada prolongada</span>
                            <Switch checked={config.alertaParadaAtivo} onCheckedChange={(v) => setConfig((c) => ({ ...c, alertaParadaAtivo: v }))} />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm">Offline</span>
                            <Switch checked={config.alertaOfflineAtivo} onCheckedChange={(v) => setConfig((c) => ({ ...c, alertaOfflineAtivo: v }))} />
                          </div>
                          <div className="flex items-center justify-between gap-2 opacity-60">
                            <span className="text-sm">Fora de rota</span>
                            <Switch checked={config.alertaForaRotaAtivo} onCheckedChange={(v) => setConfig((c) => ({ ...c, alertaForaRotaAtivo: v }))} disabled />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Catálogo de Alertas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm text-muted-foreground">
                          Lista de todos os tipos de alertas (ativos hoje e previstos). Serve como referência operacional e de configuração.
                        </div>
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Origem</TableHead>
                                <TableHead>Ativo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ALERT_CATALOG.map((a) => (
                                <TableRow key={a.kind}>
                                  <TableCell className="font-medium">{a.nome}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {a.origem.toUpperCase()}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {a.ativoHoje ? (
                                      <Badge className="bg-success/15 text-success border border-success/30 text-[10px]">SIM</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px]">NÃO</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="space-y-2">
                          {ALERT_CATALOG.map((a) => (
                            <div key={`${a.kind}-details`} className="rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium text-sm">{a.nome}</div>
                                  <div className="text-xs text-muted-foreground">{a.kind}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {a.origem.toUpperCase()}
                                  </Badge>
                                  {a.ativoHoje ? (
                                    <Badge className="bg-success/15 text-success border border-success/30 text-[10px]">ATIVO</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px]">EM BREVE</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                <b className="text-foreground">Gatilho:</b> {a.gatilho}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                <b className="text-foreground">Dados:</b> {a.dadosNecessarios}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                <b className="text-foreground">Tratativa recomendada:</b> {a.recomendacao}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Padrões Maestro / Automação (visão)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm text-muted-foreground">
                          Esta seção replica padrões de plataformas de tracking. As ações aqui são de configuração (persistidas no navegador). Em seguida podemos
                          sincronizar isso no banco e automatizar despacho/atribuição.
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            "Despachar rotas ao finalizar a roteirização",
                            "Atribuir rotas despachadas",
                            "Enviar rotas atribuídas",
                            "Automatizar desatribuição de rotas não aceitas",
                            "Permitir recusa de rota",
                            "Finalizar rota somente com todos serviços finalizados",
                            "Resequenciar rota ao iniciar/finalizar pausa",
                          ].map((label) => (
                            <div key={label} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                              <span className="text-sm">{label}</span>
                              <Switch disabled />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Planejamentos no dia: <b className="text-foreground">{planejamentosHoje?.length ?? 0}</b> • Rotas:{" "}
            <b className="text-foreground">{rotasPorEquipe.length}</b>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Filter className="h-3.5 w-3.5" />
              {config.onlyOpenPlanning ? "Somente aberto" : "Todos"}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Route className="h-3.5 w-3.5" />
              {config.showReguladasOnly ? "Só reguladas" : "Todas"}
            </Badge>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3 mb-6">
        {[
          { title: "Total OS", value: kpis.total, icon: Navigation, tone: "text-foreground" },
          { title: "Concluídas", value: kpis.done, icon: CheckCircle2, tone: "text-success" },
          { title: "Em andamento", value: kpis.inProgress, icon: Activity, tone: "text-primary" },
          { title: "Pendentes", value: kpis.pending, icon: Clock, tone: "text-muted-foreground" },
          { title: "Canceladas", value: kpis.canceled, icon: XCircle, tone: "text-muted-foreground" },
          { title: "Reguladas", value: kpis.reguladas, icon: BadgeCheck, tone: "text-destructive" },
          { title: "Atrasadas", value: kpis.atrasadas, icon: AlertTriangle, tone: "text-destructive" },
          { title: "Equipes ativas", value: kpis.equipesAtivas, icon: Route, tone: "text-foreground" },
        ].map((k) => (
          <Card key={k.title} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{k.title}</div>
                  <div className={cn("text-2xl font-bold", k.tone)}>{k.value}</div>
                </div>
                <k.icon className={cn("h-5 w-5", k.tone)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={mainView} onValueChange={(v) => setMainView(v as any)}>
        <TabsList className="grid w-full max-w-[420px] grid-cols-2 mb-4">
          <TabsTrigger value="operacao">Operação</TabsTrigger>
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
        </TabsList>

        <TabsContent value="operacao" className="m-0">
          {/* Main Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left: Routes list */}
            <Card className="xl:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Route className="h-4 w-4" /> Rotas
                  </span>
                  <Badge variant="secondary">{rotasPorEquipe.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar OS, endereço, tipo, cliente…" className="pl-9" />
                </div>

                <ScrollArea className="h-[520px] pr-3">
                  <div className="space-y-2">
                    {isLoading ? (
                      <div className="text-sm text-muted-foreground py-8 text-center">Carregando rotas…</div>
                    ) : rotasPorEquipe.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-10 text-center">
                        Nenhuma rota para {getDateLabel(selectedDate)}.
                        <div className="text-xs mt-2">Dica: confirme um planejamento em “Roteirização”.</div>
                      </div>
                    ) : (
                      rotasPorEquipe.map((r) => {
                        const progress = computeEquipeProgress(r.ordens);
                        const lastUpdate = computeLastUpdate(r.ordens);
                        const offline = lastUpdate ? diffMinutes(new Date(), lastUpdate) >= config.offlineThresholdMin : true;

                        const next = r.ordens.find((o) => {
                          const st = o.ordens_servico?.status;
                          return st && st !== "concluida" && st !== "cancelada";
                        });
                        const late = next?.ordens_servico
                          ? computeRiscoAtraso(new Date(), dataPlanejamentoDate, next, config.atrasoThresholdMin)
                          : { isLate: false, lateByMin: 0 };

                        const isSelected = r.equipe.id === selectedEquipeId;

                        return (
                          <button
                            key={r.equipe.id}
                            className={cn(
                              "w-full text-left rounded-lg border p-3 transition",
                              isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                            )}
                            onClick={() => {
                              setSelectedEquipeId(r.equipe.id);
                              setSelectedOSId(null);
                              setTabRight("detalhes");
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold">{r.equipe.codigo}</div>
                              <div className="flex items-center gap-1">
                                {offline ? (
                                  <Badge variant="secondary" className="gap-1">
                                    <WifiOff className="h-3 w-3" />
                                    Offline
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="gap-1">
                                    <Wifi className="h-3 w-3" />
                                    Online
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">{r.equipe.nome}</div>

                            <div className="mt-2 flex flex-wrap gap-1">
                              <Badge variant="secondary" className="text-[10px]">
                                {progress.done}/{progress.total} feitas
                              </Badge>
                              {progress.inProgress > 0 ? (
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                  <Activity className="h-3 w-3" /> {progress.inProgress} ativas
                                </Badge>
                              ) : null}
                              {late.isLate ? (
                                <Badge variant="destructive" className="text-[10px] gap-1">
                                  <AlertTriangle className="h-3 w-3" /> atraso {fmtMin(late.lateByMin)}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="mt-2 text-xs text-muted-foreground">
                              Próxima:{" "}
                              <span className="text-foreground">
                                {next?.ordens_servico ? `${next.ordens_servico.numero} • ${next.ordens_servico.tipo}` : "—"}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Center: Map */}
            <div className="xl:col-span-6 space-y-4">
              <MapaTorreControle
                points={mapaPoints}
                selectedEquipeId={selectedEquipeId}
                selectedOSId={selectedOSId}
                routeGeometry={routeGeometry}
                executedGeometry={executedGeometry}
                isRouteLoading={routeLoading}
                onSelect={(p) => {
                  if (p.kind === "equipe") {
                    setSelectedEquipeId(p.equipeId || p.id);
                    setSelectedOSId(null);
                    setTabRight("detalhes");
                  } else {
                    setSelectedOSId(p.id);
                    if (p.equipeId) setSelectedEquipeId(p.equipeId);
                    setTabRight("detalhes");
                  }
                }}
              />

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Navigation className="h-4 w-4" />
                    Insights do dia (execução vs planejado)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Ritmo</div>
                      <div className="text-sm">
                        {kpis.total > 0 ? (
                          <>
                            <b className="text-foreground">{Math.round((kpis.done / kpis.total) * 100)}%</b> concluído
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Alertas</div>
                      <div className="text-sm">
                        <b className="text-foreground">{alertasGerados.length}</b> ativos (inclui banco)
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Reguladas</div>
                      <div className="text-sm">
                        <b className="text-foreground">{kpis.reguladas}</b> no dia
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Dica: clique numa equipe à esquerda para destacar rota no mapa e ver detalhes (OS atual, próxima, risco e logs).
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Alerts / Activity / Details */}
            <Card className="xl:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Centro de Ação
                  </span>
                  <Badge variant="secondary">{selectedRoute ? selectedRoute.equipe.codigo : "—"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs value={tabRight} onValueChange={(v) => setTabRight(v as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="alertas" className="text-xs">
                      Alertas
                    </TabsTrigger>
                    <TabsTrigger value="atividade" className="text-xs">
                      Atividade
                    </TabsTrigger>
                    <TabsTrigger value="detalhes" className="text-xs">
                      Detalhes
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="alertas" className="mt-3">
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <div className="text-xs text-muted-foreground">Priorize críticos e altos. Faça tratativas para registrar ações.</div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1">
                          <span className="text-[10px] text-muted-foreground">Mostrar silenciados</span>
                          <Switch checked={mostrarSilenciados} onCheckedChange={setMostrarSilenciados} />
                        </div>
                        <Badge variant="secondary">{alertasGerados.length}</Badge>
                      </div>
                    </div>
                    <ScrollArea className="h-[520px] pr-3">
                      <div className="space-y-2">
                        {loadingAlertasDB ? (
                          <div className="text-sm text-muted-foreground py-8 text-center">Carregando alertas…</div>
                        ) : alertasGerados.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-10 text-center">Sem alertas ativos.</div>
                        ) : (
                          alertasGerados.map((a) => {
                            const tratativas = a.dbId
                              ? (tratativasAlertas || []).filter((t: any) => String(t.alerta_id) === String(a.dbId)).slice(0, 6)
                              : [];
                            const hasTratativas = (tratativasAlertas || []).some((t: any) => String(t.alerta_id) === String(a.dbId));
                            const expanded = alertaExpandidoId === a.id;
                            const isSnoozed = a.snoozedUntil ? new Date(a.snoozedUntil).getTime() > Date.now() : false;
                            const status = a.status || (a.source === "banco" ? "open" : "novo");
                            const statusLabelUI =
                              status === "acknowledged"
                                ? "Reconhecido"
                                : status === "assigned"
                                  ? "Assumido"
                                  : status === "snoozed"
                                    ? "Silenciado"
                                    : status === "resolved"
                                      ? "Resolvido"
                                      : status === "novo"
                                        ? "Novo"
                                        : "Aberto";

                            const sevClass =
                              a.severidade === "critical"
                                ? "border-l-destructive bg-destructive/5"
                                : a.severidade === "high"
                                  ? "border-l-orange-500 bg-orange-500/5"
                                  : a.severidade === "medium"
                                    ? "border-l-yellow-500 bg-yellow-500/5"
                                    : "border-l-sky-500 bg-sky-500/5";

                            return (
                              <div key={a.id} className={cn("rounded-lg border border-l-4 p-3", sevClass)}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-medium text-sm">{a.titulo}</div>
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {a.source === "banco" ? "BD" : "IA"}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {statusLabelUI}
                                    </Badge>
                                    {isSnoozed ? (
                                      <Badge variant="secondary" className="text-[10px] gap-1">
                                        <BellOff className="h-3 w-3" />
                                        até {format(new Date(a.snoozedUntil as string), "HH:mm")}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{a.descricao}</div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => {
                                      if (a.equipeId) setSelectedEquipeId(a.equipeId);
                                      if (a.osId) setSelectedOSId(a.osId);
                                      setTabRight("detalhes");
                                    }}
                                  >
                                    <MapPin className="h-3 w-3" /> Ver
                                  </Button>
                                  {a.equipeId ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => {
                                        const eq = (equipes || []).find((e) => e.id === a.equipeId);
                                        const tel = eq?.telefone;
                                        if (tel) window.open(`tel:${tel}`);
                                      }}
                                    >
                                      <Phone className="h-3 w-3" /> Ligar
                                    </Button>
                                  ) : null}

                                  <Separator orientation="vertical" className="h-7 mx-1" />

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => registrarTratativaMutation.mutate({ alerta: a, acao: "acknowledge" })}
                                    disabled={registrarTratativaMutation.isPending}
                                    title="Reconhecer (registrar que alguém viu)"
                                  >
                                    <Check className="h-3 w-3" /> Reconhecer
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => registrarTratativaMutation.mutate({ alerta: a, acao: "assign" })}
                                    disabled={registrarTratativaMutation.isPending}
                                    title="Assumir (atribuir para você)"
                                  >
                                    <UserCheck className="h-3 w-3" /> Assumir
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => registrarTratativaMutation.mutate({ alerta: a, acao: "snooze", payload: { minutes: 30 } })}
                                    disabled={registrarTratativaMutation.isPending}
                                    title="Silenciar por 30 minutos"
                                  >
                                    <BellOff className="h-3 w-3" /> 30m
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => setComentarioDialog({ open: true, alerta: a, texto: "" })}
                                    disabled={registrarTratativaMutation.isPending}
                                    title="Adicionar comentário"
                                  >
                                    <MessageSquareText className="h-3 w-3" /> Comentar
                                  </Button>
                                  {isSnoozed ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => registrarTratativaMutation.mutate({ alerta: a, acao: "reopen" })}
                                      disabled={registrarTratativaMutation.isPending}
                                      title="Reabrir (remover silêncio)"
                                    >
                                      <Undo2 className="h-3 w-3" /> Reabrir
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => registrarTratativaMutation.mutate({ alerta: a, acao: "resolve" })}
                                      disabled={registrarTratativaMutation.isPending}
                                      title="Resolver (encerra o alerta)"
                                    >
                                      <CheckCircle2 className="h-3 w-3" /> Resolver
                                    </Button>
                                  )}
                                </div>

                                <div className="mt-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => setAlertaExpandidoId((cur) => (cur === a.id ? null : a.id))}
                                  >
                                    {expanded ? "Ocultar histórico" : "Histórico"}
                                    <Badge variant="secondary" className="text-[10px] ml-1">
                                      {a.dbId ? (tratativasAlertas || []).filter((t: any) => String(t.alerta_id) === String(a.dbId)).length : 0}
                                    </Badge>
                                  </Button>
                                  {expanded ? (
                                    <div className="mt-2 space-y-2">
                                      {!a.dbId ? (
                                        <div className="text-xs text-muted-foreground">Este alerta ainda não foi materializado no banco.</div>
                                      ) : loadingTratativasAlertas ? (
                                        <div className="text-xs text-muted-foreground">Carregando tratativas…</div>
                                      ) : !hasTratativas ? (
                                        <div className="text-xs text-muted-foreground">Nenhuma tratativa registrada ainda.</div>
                                      ) : (
                                        tratativas.map((t: any) => (
                                          <div key={t.id} className="rounded-md border bg-card/50 p-2">
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="text-xs font-medium">{t.acao}</div>
                                              <div className="text-[10px] text-muted-foreground">{format(new Date(t.created_at), "dd/MM HH:mm")}</div>
                                            </div>
                                            {t.comentario ? <div className="text-xs text-muted-foreground mt-1">{t.comentario}</div> : null}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="atividade" className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-muted-foreground">Logs de execução (planejamento_logs).</div>
                      <Badge variant="secondary">{logs?.length ?? 0}</Badge>
                    </div>
                    <ScrollArea className="h-[520px] pr-3">
                      <div className="space-y-2">
                        {loadingLogs ? (
                          <div className="text-sm text-muted-foreground py-8 text-center">Carregando atividade…</div>
                        ) : (logs?.length ?? 0) === 0 ? (
                          <div className="text-sm text-muted-foreground py-10 text-center">Sem atividade registrada.</div>
                        ) : (
                          (logs || []).map((l) => (
                            <div key={l.id} className="rounded-lg border p-3 hover:bg-muted/30 transition">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-medium truncate">{l.descricao || l.acao}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {format(new Date(l.created_at), "HH:mm", { locale: ptBR })}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {l.acao}
                                {l.ordem_servico_id ? ` • OS ${l.ordem_servico_id.slice(0, 6)}…` : ""}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="detalhes" className="mt-3">
                    {!selectedRoute ? (
                      <div className="text-sm text-muted-foreground py-10 text-center">Selecione uma equipe para ver o detalhe.</div>
                    ) : (
                      <div className="space-y-3">
                        <Card className="border-primary/30">
                          <CardContent className="p-3 space-y-2">
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
                              </div>
                            </div>

                            <Separator />

                            {(() => {
                              const ordens = selectedRoute.ordens;
                              const progress = computeEquipeProgress(ordens);
                              const next = ordens.find((o) => {
                                const st = o.ordens_servico?.status;
                                return st && st !== "concluida" && st !== "cancelada";
                              });
                              const expectedIndex = computeExpectedIndex(new Date(), dataPlanejamentoDate, ordens);
                              const actualIndex = ordens.filter((o) => o.ordens_servico?.status === "concluida").length - 1;

                              return (
                                <>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="rounded-lg border p-2">
                                      <div className="text-[10px] text-muted-foreground">Feitas</div>
                                      <div className="text-sm font-semibold">{progress.done}/{progress.total}</div>
                                    </div>
                                    <div className="rounded-lg border p-2">
                                      <div className="text-[10px] text-muted-foreground">Ativas</div>
                                      <div className="text-sm font-semibold">{progress.inProgress}</div>
                                    </div>
                                    <div className="rounded-lg border p-2">
                                      <div className="text-[10px] text-muted-foreground">Restam</div>
                                      <div className="text-sm font-semibold">{progress.remaining}</div>
                                    </div>
                                  </div>

                                  <div className="rounded-lg border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">Próxima OS</div>
                                    <div className="font-semibold">
                                      {next?.ordens_servico ? `${next.ordens_servico.numero} • ${next.ordens_servico.tipo}` : "—"}
                                    </div>
                                    {next?.ordens_servico ? (
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <Badge variant={statusBadgeVariant(next.ordens_servico.status)} className="gap-1">
                                          {next.ordens_servico.status === "pausada" ? <PauseCircle className="h-3.5 w-3.5" /> : null}
                                          {statusLabel(next.ordens_servico.status)}
                                        </Badge>
                                        {next.ordens_servico.regulada ? <Badge variant="destructive">REGULADA</Badge> : null}
                                        <Badge variant="secondary" className="gap-1">
                                          <Clock className="h-3.5 w-3.5" />
                                          Prev: {next.hora_fim_estimada?.slice(0, 5) || "--:--"}
                                        </Badge>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="rounded-lg border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">Execução vs plano</div>
                                    <div className="text-sm">
                                      {expectedIndex == null ? (
                                        "Fora do dia —"
                                      ) : (
                                        <>
                                          Esperado: <b>#{expectedIndex + 1}</b> • Real: <b>#{Math.max(0, actualIndex + 1)}</b>{" "}
                                          <span className={cn("ml-2", actualIndex - expectedIndex >= 0 ? "text-success" : "text-destructive")}>
                                            ({actualIndex - expectedIndex >= 0 ? "adiantada" : "atrasada"} {fmtMin(Math.abs(actualIndex - expectedIndex) * 10)})
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                      Obs: sem telemetria contínua, o “desvio de rota” usa proxy por status/horários.
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Lista de OS (rota)</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <ScrollArea className="h-[360px] pr-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[52px]">#</TableHead>
                                    <TableHead>OS</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Prev</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {selectedRoute.ordens.map((o) => {
                                    const os = o.ordens_servico;
                                    const isSelected = os?.id && os.id === selectedOSId;
                                    return (
                                      <TableRow
                                        key={o.id}
                                        className={cn(isSelected && "bg-primary/5")}
                                        onClick={() => {
                                          if (os?.id) setSelectedOSId(os.id);
                                        }}
                                      >
                                        <TableCell className="font-semibold">{o.ordem_na_rota}</TableCell>
                                        <TableCell className="min-w-0">
                                          <div className="font-medium truncate">{os?.numero || "—"}</div>
                                          <div className="text-xs text-muted-foreground truncate">{os?.tipo || ""}</div>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={statusBadgeVariant(os?.status || "pendente")} className="gap-1">
                                            {statusLabel(os?.status || "pendente")}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                          {o.hora_fim_estimada?.slice(0, 5) || "—"}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="m-0">
          <TorreTimeline
            dateISO={selectedDateISO}
            rotas={rotasPorEquipe}
            logs={logs || []}
            alertas={alertasGerados.map((a) => ({
              id: a.id,
              equipeId: a.equipeId,
              osId: a.osId,
              createdAt: a.createdAt,
              severidade: a.severidade,
              titulo: a.titulo,
            }))}
            offlineThresholdMin={config.offlineThresholdMin}
            onSelectEquipe={(equipeId) => {
              setSelectedEquipeId(equipeId);
              setSelectedOSId(null);
              setTabRight("detalhes");
              setMainView("operacao");
            }}
            onSelectOS={(osId, equipeId) => {
              if (equipeId) setSelectedEquipeId(equipeId);
              setSelectedOSId(osId);
              setTabRight("detalhes");
              setMainView("operacao");
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Dialog: comentar alerta */}
      <Dialog
        open={comentarioDialog.open}
        onOpenChange={(open) => setComentarioDialog((s) => ({ ...s, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar comentário</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {comentarioDialog.alerta?.titulo || "Alerta"}
            </div>
            <Textarea
              value={comentarioDialog.texto}
              onChange={(e) => setComentarioDialog((s) => ({ ...s, texto: e.target.value }))}
              placeholder="Descreva a tratativa, o contato feito, decisão tomada, próximos passos..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setComentarioDialog({ open: false, alerta: null, texto: "" })}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!comentarioDialog.alerta) return;
                registrarTratativaMutation.mutate({
                  alerta: comentarioDialog.alerta,
                  acao: "comment",
                  comentario: comentarioDialog.texto.trim() || undefined,
                });
                setComentarioDialog({ open: false, alerta: null, texto: "" });
              }}
              disabled={registrarTratativaMutation.isPending}
            >
              Salvar comentário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat com Equipes */}
      <ChatTorreControle />
    </MainLayout>
  );
};

export default TorreControle;
