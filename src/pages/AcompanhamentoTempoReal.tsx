import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTelaPermissao } from "@/hooks/usePermissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  Calendar,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  DollarSign,
  Eye,
  Filter,
  Loader2,
  Map,
  MapPin,
  Phone,
  RefreshCcw,
  Route,
  RotateCcw,
  Search,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
  Zap,
  Activity,
  Coffee,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TimelinePrevistoRealizado, type TimelineEquipeCompleta, type TimelineOrdemServico, type TimelineIntervalo } from "@/components/torre/TimelinePrevistoRealizado";
import { OrdemServicoDetalhesDialog } from "@/components/ordens/OrdemServicoDetalhesDialog";
import MapaTorreControle, { type TorreMapaPoint, type TorreRouteGeometry } from "@/pages/components/MapaTorreControle";
import { buscarRotaOSRM } from "@/services/osrm";

// Tipos
interface EquipeRota {
  id: string;
  codigo: string;
  nome: string;
  telefone?: string | null;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  turnoAberto: boolean;
  ordens: OrdemRota[];
  intervalos: IntervaloEquipe[];
  metricas: {
    totalOS: number;
    concluidas: number;
    emAndamento: number;
    valorPrevisto: number;
    valorProduzido: number;
    distanciaTotal: number;
    tempoEstimado: number;
  };
}

interface OrdemRota {
  id: string;
  numero: string;
  tipo: string;
  status: string;
  endereco: string;
  cliente_nome?: string | null;
  prazo?: string | null;
  regulada: boolean;
  latitude?: number | null;
  longitude?: number | null;
  ordemNaRota: number;
  horaInicioEstimada?: string | null;
  horaFimEstimada?: string | null;
  distanciaKm?: number | null;
  tempoEstimadoMin?: number | null;
  valorPrevisto: number;
  valorProduzido: number;
  deslocamentoIniciadoAt?: string | null;
  chegadaLocalAt?: string | null;
  execucaoIniciadaAt?: string | null;
  concluidoAt?: string | null;
  pausadoAt?: string | null;
}

interface IntervaloEquipe {
  id: string;
  tipo: string;
  horaInicio: string;
  horaFim?: string | null;
}

interface RetornoCampo {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  cor?: string | null;
}

interface Skill {
  codigo: string;
  nome: string;
  valor?: number | null;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  planejada: "Planejada",
  em_deslocamento: "Em Deslocamento",
  no_local: "No Local",
  em_execucao: "Em Execução",
  em_andamento: "Em Andamento",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_EQUIPE_CONFIG = {
  normal: { label: "Normal", color: "text-emerald-600", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30", icon: Activity },
  adiantada: { label: "Adiantada", color: "text-emerald-600", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30", icon: TrendingUp },
  atrasada: { label: "Atrasada", color: "text-red-600", bgColor: "bg-red-500/10", borderColor: "border-red-500/30", icon: TrendingDown },
  ociosa: { label: "Ociosa", color: "text-amber-600", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30", icon: Timer },
  offline: { label: "Offline", color: "text-slate-500", bgColor: "bg-slate-500/10", borderColor: "border-slate-500/30", icon: AlertTriangle },
  em_intervalo: { label: "Intervalo", color: "text-blue-600", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", icon: Coffee },
};

export default function AcompanhamentoTempoReal() {
  const queryClient = useQueryClient();
  const { podeEditar } = useTelaPermissao("acompanhamento_tempo_real");
  
  // Data atual (sempre hoje)
  const hoje = format(new Date(), "yyyy-MM-dd");
  
  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(30);
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null);
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [ordemDetalhesId, setOrdemDetalhesId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"timeline" | "mapa">("timeline");
  
  // Filtros (iguais à Consulta Serviços)
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [equipeFilter, setEquipeFilter] = useState<string>("all");
  const [retornoFilter, setRetornoFilter] = useState<string>("all");
  const [coordenadasFilter, setCoordenadasFilter] = useState<string>("all");
  const [producaoFilter, setProducaoFilter] = useState<string>("all");
  
  const refetchInterval = autoRefresh ? Math.max(10, refreshIntervalSec) * 1000 : false;

  // Buscar equipes
  const { data: equipes } = useQuery({
    queryKey: ["acompanhamento", "equipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome, telefone, status, latitude, longitude")
        .order("codigo");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
    refetchInterval,
  });

  // Buscar retornos de campo
  const { data: retornos } = useQuery({
    queryKey: ["acompanhamento", "retornos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retornos_campo")
        .select("id, codigo, descricao, tipo, cor")
        .eq("ativo", true)
        .order("descricao");
      if (error) throw error;
      return (data || []) as RetornoCampo[];
    },
    staleTime: 300_000,
  });

  // Buscar skills
  const { data: skills } = useQuery({
    queryKey: ["acompanhamento", "skills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("codigo, nome, valor")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as Skill[];
    },
    staleTime: 300_000,
  });

  // Buscar planejamentos do dia atual
  const { data: planejamentosHoje } = useQuery({
    queryKey: ["acompanhamento", "planejamentos", hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planejamentos")
        .select("id, data_planejamento, status")
        .eq("data_planejamento", hoje)
        .eq("status", "aberto");
      if (error) throw error;
      return data || [];
    },
    refetchInterval,
  });

  const planejamentoIds = useMemo(() => (planejamentosHoje || []).map(p => p.id), [planejamentosHoje]);

  // Buscar ordens planejadas
  const { data: ordensPlanejadas, isLoading: loadingOrdens } = useQuery({
    queryKey: ["acompanhamento", "ordens", hoje, planejamentoIds.join("|")],
    queryFn: async () => {
      if (planejamentoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
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
            longitude
          )
        `)
        .in("planejamento_id", planejamentoIds)
        .order("ordem_na_rota");
      if (error) throw error;
      return data || [];
    },
    enabled: planejamentoIds.length > 0,
    refetchInterval,
  });

  // Buscar produções
  const { data: producoes } = useQuery({
    queryKey: ["acompanhamento", "producoes", hoje],
    queryFn: async () => {
      const osIds = (ordensPlanejadas || [])
        .map(o => (o.ordens_servico as any)?.id)
        .filter(Boolean);
      if (osIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("producao_equipes")
        .select("ordem_servico_id, valor_total")
        .in("ordem_servico_id", osIds);
      if (error) throw error;
      
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        map[p.ordem_servico_id] = p.valor_total || 0;
      });
      return map;
    },
    enabled: (ordensPlanejadas || []).length > 0,
    refetchInterval,
  });

  // Buscar turnos abertos
  const { data: turnosAbertos } = useQuery({
    queryKey: ["acompanhamento", "turnos", hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turnos")
        .select("id, equipe_id, hora_inicio, status")
        .eq("status", "aberto")
        .gte("hora_inicio", `${hoje}T00:00:00`)
        .lte("hora_inicio", `${hoje}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    refetchInterval,
  });

  // Buscar intervalos ativos
  const { data: intervalosAtivos } = useQuery({
    queryKey: ["acompanhamento", "intervalos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervalos_equipe")
        .select("id, equipe_id, hora_inicio, hora_fim, tipos_intervalo:tipo_intervalo_id(id, nome)")
        .is("hora_fim", null);
      if (error) throw error;
      return data || [];
    },
    refetchInterval,
  });

  // Posições atuais
  const { data: posicoesAtuais } = useQuery({
    queryKey: ["acompanhamento", "posicoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_tecnicos_posicao_atual")
        .select("equipe_id, latitude, longitude, recorded_at");
      if (error) throw error;
      return data || [];
    },
    refetchInterval,
  });

  // Processar dados das equipes com rotas
  const equipesComRotas = useMemo((): EquipeRota[] => {
    if (!ordensPlanejadas || ordensPlanejadas.length === 0) return [];

    const turnosAbertosSet = new Set((turnosAbertos || []).map(t => t.equipe_id));
    const intervalosPorEquipe = new Map<string, any>();
    (intervalosAtivos || []).forEach((i: any) => {
      intervalosPorEquipe.set(i.equipe_id, i);
    });

    const grouped = new Map<string, EquipeRota>();

    for (const po of ordensPlanejadas) {
      const eq = po.tecnicos as any;
      const os = po.ordens_servico as any;
      if (!eq || !os) continue;

      if (!grouped.has(eq.id)) {
        const intervalo = intervalosPorEquipe.get(eq.id);
        const intervalos: IntervaloEquipe[] = intervalo ? [{
          id: intervalo.id,
          tipo: intervalo.tipos_intervalo?.nome || "Intervalo",
          horaInicio: intervalo.hora_inicio?.slice(11, 19) || "",
          horaFim: intervalo.hora_fim?.slice(11, 19),
        }] : [];

        grouped.set(eq.id, {
          id: eq.id,
          codigo: eq.codigo,
          nome: eq.nome,
          telefone: eq.telefone,
          status: eq.status || "online",
          latitude: eq.latitude,
          longitude: eq.longitude,
          turnoAberto: turnosAbertosSet.has(eq.id),
          ordens: [],
          intervalos,
          metricas: {
            totalOS: 0,
            concluidas: 0,
            emAndamento: 0,
            valorPrevisto: 0,
            valorProduzido: 0,
            distanciaTotal: 0,
            tempoEstimado: 0,
          },
        });
      }

      const equipe = grouped.get(eq.id)!;
      const valorOS = Number(os.valor) || 0;
      const valorProd = producoes?.[os.id] || 0;

      const ordem: OrdemRota = {
        id: os.id,
        numero: os.numero,
        tipo: os.tipo,
        status: os.status,
        endereco: os.endereco,
        cliente_nome: os.cliente_nome,
        prazo: os.prazo,
        regulada: !!os.regulada,
        latitude: os.latitude,
        longitude: os.longitude,
        ordemNaRota: po.ordem_na_rota,
        horaInicioEstimada: po.hora_inicio_estimada,
        horaFimEstimada: po.hora_fim_estimada,
        distanciaKm: po.distancia_km,
        tempoEstimadoMin: po.tempo_estimado_minutos,
        valorPrevisto: valorOS,
        valorProduzido: valorProd,
        deslocamentoIniciadoAt: os.deslocamento_iniciado_at,
        chegadaLocalAt: os.chegada_local_at,
        execucaoIniciadaAt: os.execucao_iniciada_at,
        concluidoAt: os.concluido_at,
        pausadoAt: os.pausado_at,
      };

      equipe.ordens.push(ordem);
      equipe.metricas.totalOS++;
      equipe.metricas.valorPrevisto += valorOS;
      equipe.metricas.valorProduzido += valorProd;
      equipe.metricas.distanciaTotal += po.distancia_km || 0;
      equipe.metricas.tempoEstimado += po.tempo_estimado_minutos || 0;
      
      if (os.status === "concluida") {
        equipe.metricas.concluidas++;
      } else if (["em_deslocamento", "no_local", "em_execucao", "em_andamento", "pausada"].includes(os.status)) {
        equipe.metricas.emAndamento++;
      }
    }

    // Ordenar ordens dentro de cada equipe
    grouped.forEach(eq => {
      eq.ordens.sort((a, b) => a.ordemNaRota - b.ordemNaRota);
    });

    return Array.from(grouped.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [ordensPlanejadas, turnosAbertos, intervalosAtivos, producoes]);

  // Aplicar filtros
  const equipesFiltradas = useMemo(() => {
    let result = equipesComRotas;
    
    // Filtro de equipe
    if (equipeFilter !== "all") {
      result = result.filter(e => e.id === equipeFilter);
    }
    
    // Filtro de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.map(e => ({
        ...e,
        ordens: e.ordens.filter(o =>
          o.numero.toLowerCase().includes(term) ||
          o.endereco.toLowerCase().includes(term) ||
          (o.cliente_nome || "").toLowerCase().includes(term) ||
          o.tipo.toLowerCase().includes(term)
        ),
      })).filter(e => e.ordens.length > 0);
    }

    // Filtro de status
    if (statusFilter !== "all") {
      result = result.map(e => ({
        ...e,
        ordens: e.ordens.filter(o => o.status === statusFilter),
      })).filter(e => e.ordens.length > 0);
    }

    // Filtro de tipo
    if (tipoFilter !== "all") {
      result = result.map(e => ({
        ...e,
        ordens: e.ordens.filter(o => o.tipo.toLowerCase() === tipoFilter.toLowerCase()),
      })).filter(e => e.ordens.length > 0);
    }

    // Filtro de coordenadas
    if (coordenadasFilter !== "all") {
      result = result.map(e => ({
        ...e,
        ordens: e.ordens.filter(o => 
          coordenadasFilter === "com" 
            ? o.latitude && o.longitude 
            : !o.latitude || !o.longitude
        ),
      })).filter(e => e.ordens.length > 0);
    }

    // Filtro de produção
    if (producaoFilter !== "all") {
      result = result.map(e => ({
        ...e,
        ordens: e.ordens.filter(o => 
          producaoFilter === "com" 
            ? o.valorProduzido > 0 
            : o.valorProduzido === 0
        ),
      })).filter(e => e.ordens.length > 0);
    }

    return result;
  }, [equipesComRotas, searchTerm, statusFilter, tipoFilter, equipeFilter, coordenadasFilter, producaoFilter]);

  // Converter para formato da Timeline
  const timelineEquipes = useMemo((): TimelineEquipeCompleta[] => {
    return equipesFiltradas.map(eq => {
      const now = new Date();
      const turnosAbertosSet = new Set((turnosAbertos || []).map(t => t.equipe_id));
      
      // Calcular status
      let status: TimelineEquipeCompleta["status"] = "normal";
      let minutosDesvio = 0;
      
      if (eq.intervalos.length > 0 && !eq.intervalos[0].horaFim) {
        status = "em_intervalo";
      } else if (!turnosAbertosSet.has(eq.id) && eq.metricas.totalOS > 0) {
        status = "offline";
      } else if (eq.metricas.emAndamento === 0 && eq.metricas.concluidas < eq.metricas.totalOS) {
        status = "ociosa";
      } else {
        // Calcular desvio
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const ordensOrdenadas = [...eq.ordens].sort((a, b) => a.ordemNaRota - b.ordemNaRota);
        
        // Encontrar onde deveria estar baseado no horário atual
        let expectedIndex = 0;
        for (let i = 0; i < ordensOrdenadas.length; i++) {
          const horaFim = ordensOrdenadas[i].horaFimEstimada;
          if (horaFim) {
            const [h, m] = horaFim.split(":").map(Number);
            const fimMin = h * 60 + m;
            if (nowMin >= fimMin) expectedIndex = i + 1;
          }
        }

        const actualIndex = eq.metricas.concluidas;
        minutosDesvio = (expectedIndex - actualIndex) * 15; // ~15min por OS de diferença
        
        if (minutosDesvio > 15) {
          status = "atrasada";
        } else if (minutosDesvio < -15) {
          status = "adiantada";
          minutosDesvio = -minutosDesvio;
        }
      }

      return {
        id: eq.id,
        codigo: eq.codigo,
        nome: eq.nome,
        turnoAberto: eq.turnoAberto,
        status,
        minutosDesvio: minutosDesvio !== 0 ? minutosDesvio : undefined,
        intervalos: eq.intervalos.map(i => ({
          id: i.id,
          tipo: i.tipo,
          horaInicio: i.horaInicio,
          horaFim: i.horaFim || undefined,
        })),
        ordens: eq.ordens.map(o => ({
          id: o.id,
          numero: o.numero,
          tipo: o.tipo,
          status: o.status as any,
          regulada: o.regulada,
          ordemNaRota: o.ordemNaRota,
          horaInicioEstimada: o.horaInicioEstimada || undefined,
          horaFimEstimada: o.horaFimEstimada || undefined,
          deslocamentoIniciadoAt: o.deslocamentoIniciadoAt || undefined,
          chegadaLocalAt: o.chegadaLocalAt || undefined,
          execucaoIniciadaAt: o.execucaoIniciadaAt || undefined,
          concluidoAt: o.concluidoAt || undefined,
          pausadoAt: o.pausadoAt || undefined,
        })),
      };
    });
  }, [equipesFiltradas, turnosAbertos]);

  // Pontos para o mapa
  const mapaPoints = useMemo((): TorreMapaPoint[] => {
    const pts: TorreMapaPoint[] = [];
    const posMap = new Map<string, { lat: number; lng: number }>();
    
    for (const p of posicoesAtuais || []) {
      if (p?.equipe_id && p.latitude != null && p.longitude != null) {
        posMap.set(String(p.equipe_id), { lat: Number(p.latitude), lng: Number(p.longitude) });
      }
    }

    for (const eq of equipesFiltradas) {
      // Marcadores de OS
      for (const o of eq.ordens) {
        if (o.latitude && o.longitude) {
          pts.push({
            kind: "os",
            id: o.id,
            equipeId: eq.id,
            equipeCodigo: eq.codigo,
            ordemNaRota: o.ordemNaRota,
            numero: o.numero,
            tipo: o.tipo,
            status: o.status as any,
            regulada: o.regulada,
            lat: Number(o.latitude),
            lng: Number(o.longitude),
            endereco: o.endereco,
          });
        }
      }

      // Marcador da equipe
      const pos = posMap.get(eq.id);
      if (pos) {
        pts.push({
          kind: "equipe",
          equipeId: eq.id,
          equipeCodigo: eq.codigo,
          equipeNome: eq.nome,
          statusEquipe: eq.status,
          lat: pos.lat,
          lng: pos.lng,
          updatedAt: null,
        });
      }
    }

    return pts;
  }, [equipesFiltradas, posicoesAtuais]);

  // Rota selecionada para o mapa
  const selectedRoute = useMemo(() => 
    equipesFiltradas.find(e => e.id === selectedEquipeId) || null, 
    [equipesFiltradas, selectedEquipeId]
  );

  const [routeGeometry, setRouteGeometry] = useState<TorreRouteGeometry | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadRoute() {
      if (!selectedRoute || viewMode !== "mapa") {
        setRouteGeometry(null);
        return;
      }
      
      const coords = selectedRoute.ordens
        .filter(o => o.latitude && o.longitude)
        .map(o => [Number(o.latitude), Number(o.longitude)] as [number, number]);
      
      if (coords.length < 2) {
        setRouteGeometry(null);
        return;
      }

      setRouteLoading(true);
      try {
        const geo = await buscarRotaOSRM(coords);
        if (!cancelled) {
          setRouteGeometry({ coordinates: geo.coordinates, distance: geo.distance, duration: geo.duration });
        }
      } catch {
        if (!cancelled) setRouteGeometry(null);
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    }
    loadRoute();
    return () => { cancelled = true; };
  }, [selectedRoute, viewMode]);

  // Métricas gerais
  const metricas = useMemo(() => {
    const totais = {
      equipes: equipesFiltradas.length,
      totalOS: 0,
      concluidas: 0,
      emAndamento: 0,
      valorPrevisto: 0,
      valorProduzido: 0,
      atrasadas: 0,
      adiantadas: 0,
    };

    for (const eq of equipesFiltradas) {
      totais.totalOS += eq.metricas.totalOS;
      totais.concluidas += eq.metricas.concluidas;
      totais.emAndamento += eq.metricas.emAndamento;
      totais.valorPrevisto += eq.metricas.valorPrevisto;
      totais.valorProduzido += eq.metricas.valorProduzido;
    }

    timelineEquipes.forEach(eq => {
      if (eq.status === "atrasada") totais.atrasadas++;
      if (eq.status === "adiantada") totais.adiantadas++;
    });

    return totais;
  }, [equipesFiltradas, timelineEquipes]);

  // Limpar filtros
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTipoFilter("all");
    setEquipeFilter("all");
    setRetornoFilter("all");
    setCoordenadasFilter("all");
    setProducaoFilter("all");
  };

  const activeFiltersCount = [
    statusFilter !== "all",
    tipoFilter !== "all",
    equipeFilter !== "all",
    retornoFilter !== "all",
    coordenadasFilter !== "all",
    producaoFilter !== "all",
  ].filter(Boolean).length;

  return (
    <MainLayout
      title="Acompanhamento Tempo Real"
      subtitle={`Rotas do dia ${format(new Date(), "dd/MM/yyyy")} - ${metricas.equipes} equipes em campo`}
      breadcrumbs={[{ label: "Acompanhamento Tempo Real" }]}
    >
      {/* Barra de Controle Superior */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Status e métricas */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge 
              className={cn(
                "gap-2 text-sm py-1.5 px-3",
                metricas.atrasadas > 0 
                  ? "bg-red-500/10 text-red-600 border border-red-500/30" 
                  : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
              )}
            >
              <span className={cn(
                "h-2.5 w-2.5 rounded-full",
                metricas.atrasadas > 0 ? "bg-red-500 animate-pulse" : "bg-emerald-500"
              )} />
              {metricas.atrasadas > 0 ? `${metricas.atrasadas} ATRASADA(S)` : "AO VIVO"}
            </Badge>

            <Badge variant="secondary" className="gap-2">
              <Users className="h-3.5 w-3.5" />
              {metricas.equipes} equipes
            </Badge>

            <Badge variant="secondary" className="gap-2">
              <MapPin className="h-3.5 w-3.5" />
              {metricas.concluidas}/{metricas.totalOS} OS
            </Badge>

            <Badge variant="secondary" className="gap-2">
              <DollarSign className="h-3.5 w-3.5" />
              R$ {metricas.valorProduzido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              <span className="text-muted-foreground">/</span>
              R$ {metricas.valorPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </Badge>

            <Separator orientation="vertical" className="h-6 hidden lg:block" />

            <span className="text-sm text-muted-foreground">
              {format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
            </span>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Toggle de visualização */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <Button
                variant={viewMode === "timeline" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-2"
                onClick={() => setViewMode("timeline")}
              >
                <Clock className="h-4 w-4" />
                Timeline
              </Button>
              <Button
                variant={viewMode === "mapa" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-2"
                onClick={() => setViewMode("mapa")}
              >
                <Map className="h-4 w-4" />
                Mapa
              </Button>
            </div>

            {/* Auto-refresh */}
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Auto</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              {autoRefresh && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Wifi className="h-3 w-3" />
                  {refreshIntervalSec}s
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["acompanhamento"] })}
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar OS, endereço, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={showFilters ? "default" : "outline"}
              className="gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <RotateCcw className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Painel de filtros avançados */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Serviço */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo de Serviço</label>
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Tipos</SelectItem>
                    {(skills || []).map((skill) => (
                      <SelectItem key={skill.codigo} value={skill.codigo.toLowerCase()}>
                        {skill.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Equipe */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Equipe
                </label>
                <Select value={equipeFilter} onValueChange={setEquipeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Equipes</SelectItem>
                    {equipesComRotas.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.codigo} - {eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Retorno de Campo */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Retorno de Campo</label>
                <Select value={retornoFilter} onValueChange={setRetornoFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Retornos</SelectItem>
                    <SelectItem value="sem_retorno">Sem Retorno</SelectItem>
                    {(retornos || []).map((retorno) => (
                      <SelectItem key={retorno.id} value={retorno.id}>
                        {retorno.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Coordenadas */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Coordenadas
                </label>
                <Select value={coordenadasFilter} onValueChange={setCoordenadasFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="com">Com Coordenadas</SelectItem>
                    <SelectItem value="sem">Sem Coordenadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Produção */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Produção</label>
                <Select value={producaoFilter} onValueChange={setProducaoFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="com">Com Produção</SelectItem>
                    <SelectItem value="sem">Sem Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Área Principal */}
      {loadingOrdens ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Carregando rotas do dia...</p>
          </div>
        </div>
      ) : equipesFiltradas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Route className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma rota encontrada</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {planejamentoIds.length === 0
                ? "Não há planejamentos criados para hoje. Crie um planejamento na tela de Roteirização."
                : "Nenhuma equipe corresponde aos filtros aplicados."}
            </p>
            {activeFiltersCount > 0 && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "timeline" ? (
        /* TIMELINE */
        <TimelinePrevistoRealizado
          dateISO={hoje}
          equipes={timelineEquipes}
          onSelectEquipe={(equipeId) => {
            setSelectedEquipeId(equipeId);
            setSelectedOSId(null);
          }}
          onSelectOS={(osId, equipeId) => {
            setOrdemDetalhesId(osId);
            setDetalhesOpen(true);
          }}
        />
      ) : (
        /* MAPA + LISTA */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Lista de Equipes */}
          <div className="xl:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Equipes em Campo
                  </span>
                  <Badge variant="secondary">{equipesFiltradas.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="divide-y">
                    {equipesFiltradas.map((eq) => {
                      const timeline = timelineEquipes.find(t => t.id === eq.id);
                      const statusConfig = STATUS_EQUIPE_CONFIG[timeline?.status || "normal"];
                      const StatusIcon = statusConfig.icon;
                      const isSelected = selectedEquipeId === eq.id;
                      const progresso = eq.metricas.totalOS > 0 
                        ? Math.round((eq.metricas.concluidas / eq.metricas.totalOS) * 100) 
                        : 0;

                      return (
                        <button
                          key={eq.id}
                          className={cn(
                            "w-full text-left p-4 hover:bg-muted/40 transition-all",
                            isSelected && "bg-primary/5 border-l-4 border-l-primary"
                          )}
                          onClick={() => setSelectedEquipeId(isSelected ? null : eq.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{eq.codigo}</span>
                                <Badge
                                  variant="outline"
                                  className={cn("text-[10px] px-1.5", statusConfig.bgColor, statusConfig.borderColor)}
                                >
                                  <StatusIcon className={cn("h-3 w-3 mr-1", statusConfig.color)} />
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {eq.nome}
                              </div>
                            </div>
                            {eq.telefone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`tel:${eq.telefone}`);
                                }}
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          {/* Progresso */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Progresso</span>
                              <span className="font-medium">
                                {eq.metricas.concluidas}/{eq.metricas.totalOS} ({progresso}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${progresso}%` }}
                              />
                            </div>
                          </div>

                          {/* Métricas */}
                          <div className="flex items-center gap-3 mt-3 text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              R$ {eq.metricas.valorProduzido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Route className="h-3 w-3" />
                              {eq.metricas.distanciaTotal.toFixed(1)} km
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Mapa */}
          <div className="xl:col-span-9">
            <Card className="h-[650px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Map className="h-4 w-4" />
                    Mapa de Rotas
                  </span>
                  {selectedRoute && (
                    <Badge variant="secondary">{selectedRoute.codigo}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[590px]">
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
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Dialog de Detalhes da OS */}
      <OrdemServicoDetalhesDialog
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        ordemId={ordemDetalhesId}
      />
    </MainLayout>
  );
}

