import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// Drag and drop pode ser adicionado futuramente para reordenação
// import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
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
  Map as MapIcon,
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
  Settings,
  Play,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  Undo2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TimelinePrevistoRealizado, type TimelineEquipeCompleta, type TimelineOrdemServico, type TimelineIntervalo } from "@/components/torre/TimelinePrevistoRealizado";
import { OrdemServicoDetalhesDialog } from "@/components/ordens/OrdemServicoDetalhesDialog";
import { ChatTorreControle } from "@/components/chat/ChatTorreControle";
import MapaLeaflet from "@/pages/components/MapaLeaflet";
import { Territorio } from "@/types/territorios";
import { ConfigPrazoUrgente } from "@/components/roteirizacao/ConfigPrazoUrgente";
import { useConfigUrgencia, verificarUrgenciaOS } from "@/hooks/useConfigUrgencia";

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
  
  // Configuração de prazo para OSs urgentes (versao força re-render quando prazo muda)
  const { prazoLimiteDate, versao: versaoPrazoUrgente, recarregar: recarregarConfig, invalidarQueries } = useConfigUrgencia();
  
  // Callback quando o prazo limite muda (forçar atualização de todas as views)
  const handlePrazoChange = useCallback(async () => {
    console.log("[AcompanhamentoTempoReal] Prazo limite alterado, recarregando configuração...");
    await recarregarConfig();
    invalidarQueries();
  }, [recarregarConfig, invalidarQueries]);
  
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
  const [equipeHovered, setEquipeHovered] = useState<string | null>(null);
  
  // Estados para o Editor de Rotas
  const [osSelecionadaNoEditor, setOsSelecionadaNoEditor] = useState<string | null>(null);
  const [rotasEditadas, setRotasEditadas] = useState<Map<string, OrdemRota[]>>(new Map());
  const [salvandoRota, setSalvandoRota] = useState(false);
  const [temAlteracoesPendentes, setTemAlteracoesPendentes] = useState(false);
  
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

  // Buscar territórios
  const { data: territorios } = useQuery({
    queryKey: ["acompanhamento", "territorios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("territorios")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        cor: t.cor || "#3b82f6",
        ativo: t.ativo,
        poligono: t.poligono || [],
        equipeIds: t.equipe_ids || [],
      })) as Territorio[];
    },
    staleTime: 300_000,
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
          // Converter para horário local usando Date
          horaInicio: intervalo.hora_inicio ? (() => {
            const d = new Date(intervalo.hora_inicio);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
          })() : "",
          horaFim: intervalo.hora_fim ? (() => {
            const d = new Date(intervalo.hora_fim);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
          })() : undefined,
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
    // Criar mapa de skill codigo -> nome
    const skillsMap = new Map<string, string>();
    (skills || []).forEach(s => skillsMap.set(s.codigo.toLowerCase(), s.nome));
    
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

      // Intervalos em tempo real (iniciados pelo técnico)
      // TODO: No futuro, buscar intervalos previstos da tabela de planejamentos se houver
      const intervalosTimeline: TimelineIntervalo[] = eq.intervalos.map(i => ({
        id: i.id,
        tipo: i.tipo,
        horaInicio: i.horaInicio, // Já foi convertido para horário local
        horaFim: i.horaFim || undefined,
        previsto: false, // Intervalos iniciados manualmente não são previstos
      }));

      return {
        id: eq.id,
        codigo: eq.codigo,
        nome: eq.nome,
        turnoAberto: eq.turnoAberto,
        status,
        minutosDesvio: minutosDesvio !== 0 ? minutosDesvio : undefined,
        intervalos: intervalosTimeline,
        ordens: eq.ordens.map(o => ({
          id: o.id,
          numero: o.numero,
          tipo: o.tipo,
          tipoDescricao: skillsMap.get(o.tipo.toLowerCase()) || o.tipo,
          status: o.status as any,
          regulada: o.regulada,
          prazo: o.prazo || undefined,
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
  }, [equipesFiltradas, turnosAbertos, skills]);

  // Converter dados para formato do MapaLeaflet (tipos como any para compatibilidade)
  const rotasParaMapa = useMemo((): any[] => {
    // Criar mapa de posições atuais das equipes
    const posMap = new Map<string, { lat: number; lng: number }>();
    for (const p of posicoesAtuais || []) {
      if ((p as any)?.equipe_id && (p as any).latitude != null && (p as any).longitude != null) {
        posMap.set(String((p as any).equipe_id), { lat: Number((p as any).latitude), lng: Number((p as any).longitude) });
      }
    }

    const cores = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

    return equipesFiltradas.map((eq, idx) => {
      // Usar posição atual se disponível, senão usar latitude/longitude da equipe
      const pos = posMap.get(eq.id) || { lat: eq.latitude || -14.8661, lng: eq.longitude || -40.8394 };
      
      const equipe: any = {
        id: eq.id,
        codigo: eq.codigo,
        tecnico: eq.nome,
        latitude: pos.lat,
        longitude: pos.lng,
        habilidades: [],
        skills: [],
        jornadaHoras: 8,
        maxHorasTrabalho: 10,
        horaInicio: "07:30",
        color: cores[idx % cores.length],
      };

      const servicos: any[] = eq.ordens.map((o, sidx) => ({
        tipo: "SERVICO" as const,
        ordemNaRota: o.ordemNaRota || sidx + 1,
        ordemServico: {
          id: o.id,
          numero: o.numero,
          tipo: o.tipo,
          status: o.status,
          endereco: o.endereco,
          cliente: o.cliente_nome || "",
          prazo: o.prazo ? new Date(o.prazo) : null,
          regulada: o.regulada,
          latitude: o.latitude || 0,
          longitude: o.longitude || 0,
          valor: o.valorPrevisto || 0,
        },
        tempoDeslocamento: 0,
        distancia: o.distanciaKm || 0,
        tempoTotal: o.tempoEstimadoMin || 15,
        horaInicio: o.horaInicioEstimada || "",
        horaFim: o.horaFimEstimada || "",
        eta: o.horaInicioEstimada || "",
      }));

      return {
        equipe,
        servicos,
        distanciaTotal: eq.metricas.distanciaTotal,
        tempoTotal: eq.metricas.tempoEstimado,
        faturamentoTotal: eq.metricas.valorPrevisto,
        progresso: eq.metricas.totalOS > 0 ? (eq.metricas.concluidas / eq.metricas.totalOS) * 100 : 0,
      };
    });
  }, [equipesFiltradas, posicoesAtuais]);

  // Equipes para o mapa (tipos como any para compatibilidade)
  const equipesParaMapa = useMemo((): any[] => {
    const posMap = new Map<string, { lat: number; lng: number }>();
    for (const p of posicoesAtuais || []) {
      if ((p as any)?.equipe_id && (p as any).latitude != null && (p as any).longitude != null) {
        posMap.set(String((p as any).equipe_id), { lat: Number((p as any).latitude), lng: Number((p as any).longitude) });
      }
    }

    const cores = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
    
    return equipesFiltradas.map((eq, idx) => {
      const pos = posMap.get(eq.id) || { lat: eq.latitude || -14.8661, lng: eq.longitude || -40.8394 };
      return {
        id: eq.id,
        codigo: eq.codigo,
        tecnico: eq.nome,
        latitude: pos.lat,
        longitude: pos.lng,
        habilidades: [],
        skills: [],
        jornadaHoras: 8,
        maxHorasTrabalho: 10,
        horaInicio: "07:30",
        color: cores[idx % cores.length],
      };
    });
  }, [equipesFiltradas, posicoesAtuais]);

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

  // === FUNÇÕES DE EDIÇÃO DE ROTA ===
  
  // Obter ordens da rota (editadas ou originais)
  const getOrdensRota = useCallback((equipeId: string): OrdemRota[] => {
    if (rotasEditadas.has(equipeId)) {
      return rotasEditadas.get(equipeId)!;
    }
    const equipe = equipesFiltradas.find(e => e.id === equipeId);
    return equipe ? [...equipe.ordens] : [];
  }, [rotasEditadas, equipesFiltradas]);

  // Mover OS para cima
  const moverOSParaCima = useCallback((equipeId: string, osId: string) => {
    const ordens = getOrdensRota(equipeId);
    const index = ordens.findIndex(o => o.id === osId);
    if (index <= 0) return; // Já é o primeiro ou não encontrado
    
    // Verificar se a OS pode ser movida (apenas planejadas)
    const os = ordens[index];
    if (os.status !== "planejada") {
      toast.error("Apenas OSs com status 'planejada' podem ser reordenadas");
      return;
    }
    
    // Verificar se a OS anterior também é planejada
    const osAnterior = ordens[index - 1];
    if (osAnterior.status !== "planejada") {
      toast.error("Não é possível mover para cima de uma OS já iniciada/concluída");
      return;
    }
    
    const novasOrdens = [...ordens];
    [novasOrdens[index - 1], novasOrdens[index]] = [novasOrdens[index], novasOrdens[index - 1]];
    
    // Atualizar ordem na rota
    novasOrdens.forEach((o, i) => { o.ordemNaRota = i + 1; });
    
    setRotasEditadas(prev => new Map(prev).set(equipeId, novasOrdens));
    setTemAlteracoesPendentes(true);
  }, [getOrdensRota]);

  // Mover OS para baixo
  const moverOSParaBaixo = useCallback((equipeId: string, osId: string) => {
    const ordens = getOrdensRota(equipeId);
    const index = ordens.findIndex(o => o.id === osId);
    if (index < 0 || index >= ordens.length - 1) return; // Já é o último ou não encontrado
    
    // Verificar se a OS pode ser movida
    const os = ordens[index];
    if (os.status !== "planejada") {
      toast.error("Apenas OSs com status 'planejada' podem ser reordenadas");
      return;
    }
    
    const novasOrdens = [...ordens];
    [novasOrdens[index], novasOrdens[index + 1]] = [novasOrdens[index + 1], novasOrdens[index]];
    
    // Atualizar ordem na rota
    novasOrdens.forEach((o, i) => { o.ordemNaRota = i + 1; });
    
    setRotasEditadas(prev => new Map(prev).set(equipeId, novasOrdens));
    setTemAlteracoesPendentes(true);
  }, [getOrdensRota]);

  // Remover OS da rota
  const removerOSDaRota = useCallback(async (equipeId: string, osId: string) => {
    const ordens = getOrdensRota(equipeId);
    const os = ordens.find(o => o.id === osId);
    
    if (!os) return;
    
    if (os.status !== "planejada") {
      toast.error("Apenas OSs com status 'planejada' podem ser removidas da rota");
      return;
    }
    
    if (!confirm(`Deseja remover a OS ${os.numero} da rota?`)) return;
    
    try {
      // Remover do banco
      const { error: erroDelete } = await supabase
        .from("planejamento_ordens")
        .delete()
        .eq("ordem_servico_id", osId);
      
      if (erroDelete) throw erroDelete;
      
      // Atualizar status da OS para pendente
      const { error: erroUpdate } = await supabase
        .from("ordens_servico")
        .update({ status: "pendente", equipe_planejada_id: null })
        .eq("id", osId);
      
      if (erroUpdate) throw erroUpdate;
      
      // Remover da lista local
      const novasOrdens = ordens.filter(o => o.id !== osId);
      novasOrdens.forEach((o, i) => { o.ordemNaRota = i + 1; });
      
      setRotasEditadas(prev => new Map(prev).set(equipeId, novasOrdens));
      toast.success(`OS ${os.numero} removida da rota`);
      
      // Recarregar dados
      queryClient.invalidateQueries({ queryKey: ["acompanhamento"] });
    } catch (error) {
      console.error("Erro ao remover OS:", error);
      toast.error("Erro ao remover OS da rota");
    }
  }, [getOrdensRota, queryClient]);

  // Salvar alterações na rota
  const salvarAlteracoesRota = useCallback(async (equipeId: string) => {
    const ordens = getOrdensRota(equipeId);
    const equipe = equipesFiltradas.find(e => e.id === equipeId);
    
    if (!equipe) return;
    
    setSalvandoRota(true);
    
    try {
      // Atualizar ordem_na_rota de cada OS no planejamento_ordens
      for (const os of ordens) {
        const { error } = await supabase
          .from("planejamento_ordens")
          .update({ ordem_na_rota: os.ordemNaRota })
          .eq("ordem_servico_id", os.id);
        
        if (error) throw error;
      }
      
      toast.success(`Rota da equipe ${equipe.codigo} atualizada com sucesso!`);
      
      // Limpar edições pendentes para esta equipe
      setRotasEditadas(prev => {
        const novo = new Map(prev);
        novo.delete(equipeId);
        return novo;
      });
      
      // Verificar se ainda há alterações pendentes em outras equipes
      setTemAlteracoesPendentes(rotasEditadas.size > 1);
      
      // Recarregar dados
      queryClient.invalidateQueries({ queryKey: ["acompanhamento"] });
    } catch (error) {
      console.error("Erro ao salvar rota:", error);
      toast.error("Erro ao salvar alterações na rota");
    } finally {
      setSalvandoRota(false);
    }
  }, [getOrdensRota, equipesFiltradas, queryClient, rotasEditadas.size]);

  // Desfazer alterações na rota
  const desfazerAlteracoesRota = useCallback((equipeId: string) => {
    setRotasEditadas(prev => {
      const novo = new Map(prev);
      novo.delete(equipeId);
      return novo;
    });
    setTemAlteracoesPendentes(rotasEditadas.size > 1);
    toast.info("Alterações descartadas");
  }, [rotasEditadas.size]);

  // Verificar se uma equipe tem alterações pendentes
  const equipeTemAlteracoes = useCallback((equipeId: string): boolean => {
    return rotasEditadas.has(equipeId);
  }, [rotasEditadas]);

  // === FIM FUNÇÕES DE EDIÇÃO ===

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
      title="Tempo Real"
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

            <Separator orientation="vertical" className="h-6 hidden lg:block" />

            {/* Configuração de prazo para OSs urgentes */}
            <ConfigPrazoUrgente onPrazoChange={handlePrazoChange} />
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
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
      ) : (
        <div className="space-y-4">
          {/* TIMELINE - Parte superior */}
          <TimelinePrevistoRealizado
            dateISO={hoje}
            equipes={timelineEquipes}
            onSelectEquipe={(equipeId) => {
              setSelectedEquipeId(equipeId);
              setSelectedOSId(null);
              setEquipeHovered(equipeId);
            }}
            onSelectOS={(osId, equipeId) => {
              setOrdemDetalhesId(osId);
              setDetalhesOpen(true);
            }}
          />

          {/* EDITOR DE ROTAS + MAPA - Parte inferior */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Editor de Rotas - Esquerda */}
            <div className="xl:col-span-4">
              <Card className="h-[650px] overflow-hidden flex flex-col">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Editor de Rotas
                    </span>
                    <Badge variant="secondary">{equipesFiltradas.length}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedEquipeId 
                      ? `Equipe ${equipesFiltradas.find(e => e.id === selectedEquipeId)?.codigo || ""} selecionada`
                      : "Selecione uma equipe na timeline ou mapa"
                    }
                  </p>
                  
                  {/* Seletor de Equipe */}
                  {equipesFiltradas.length > 0 && (
                    <Select
                      value={selectedEquipeId || "todas"}
                      onValueChange={(value) => {
                        if (value === "todas") {
                          setSelectedEquipeId(null);
                          setEquipeHovered(null);
                          setSelectedOSId(null);
                        } else {
                          setSelectedEquipeId(value);
                          setEquipeHovered(value);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full mt-2">
                        <SelectValue placeholder="Selecione uma equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-muted" />
                            <span>Todas as equipes</span>
                          </div>
                        </SelectItem>
                        {equipesFiltradas.map((eq) => {
                          const timeline = timelineEquipes.find(t => t.id === eq.id);
                          const statusConfig = STATUS_EQUIPE_CONFIG[timeline?.status || "normal"];
                          const progresso = eq.metricas.totalOS > 0 
                            ? Math.round((eq.metricas.concluidas / eq.metricas.totalOS) * 100) 
                            : 0;
                          return (
                            <SelectItem key={eq.id} value={eq.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn("h-3 w-3 rounded-full", statusConfig.bgColor)}
                                  style={{ borderColor: statusConfig.borderColor }}
                                />
                                <span className="font-medium">{eq.codigo}</span>
                                <span className="text-muted-foreground text-xs">
                                  ({eq.metricas.concluidas}/{eq.metricas.totalOS} - {progresso}%)
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </CardHeader>
                
                <CardContent className="p-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {!selectedEquipeId ? (
                      <div className="p-6 text-center">
                        <Settings className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          Selecione uma equipe na timeline, mapa ou no seletor acima para visualizar e editar sua rota
                        </p>
                      </div>
                    ) : (() => {
                      const equipeSelecionada = equipesFiltradas.find(e => e.id === selectedEquipeId);
                      if (!equipeSelecionada) return null;
                      
                      const timeline = timelineEquipes.find(t => t.id === selectedEquipeId);
                      const statusConfig = STATUS_EQUIPE_CONFIG[timeline?.status || "normal"];
                      const StatusIcon = statusConfig.icon;
                      const progresso = equipeSelecionada.metricas.totalOS > 0 
                        ? Math.round((equipeSelecionada.metricas.concluidas / equipeSelecionada.metricas.totalOS) * 100) 
                        : 0;

                      const ordensParaExibir = getOrdensRota(selectedEquipeId);
                      const temAlteracoes = equipeTemAlteracoes(selectedEquipeId);

                      return (
                        <div className="divide-y">
                          {/* Barra de ações de edição */}
                          {temAlteracoes && (
                            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[10px] text-blue-700 dark:text-blue-400">
                                  <Settings className="h-4 w-4" />
                                  <span className="font-semibold">Alterações pendentes</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={() => desfazerAlteracoesRota(selectedEquipeId)}
                                  >
                                    <Undo2 className="h-3 w-3 mr-1" />
                                    Desfazer
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700"
                                    disabled={salvandoRota}
                                    onClick={() => salvarAlteracoesRota(selectedEquipeId)}
                                  >
                                    {salvandoRota ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3 mr-1" />
                                    )}
                                    Salvar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Resumo da Equipe */}
                          <div className="p-3 bg-muted/20">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{equipeSelecionada.codigo}</span>
                                <Badge
                                  variant="outline"
                                  className={cn("text-[10px] px-1.5", statusConfig.bgColor, statusConfig.borderColor)}
                                >
                                  <StatusIcon className={cn("h-3 w-3 mr-1", statusConfig.color)} />
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              {equipeSelecionada.telefone && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => window.open(`tel:${equipeSelecionada.telefone}`)}
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">{equipeSelecionada.nome}</div>
                            
                            {/* Progresso */}
                            <div className="mb-2">
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="text-muted-foreground">Progresso</span>
                                <span className="font-medium">
                                  {equipeSelecionada.metricas.concluidas}/{equipeSelecionada.metricas.totalOS} ({progresso}%)
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
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div className="bg-card rounded p-2">
                                <DollarSign className="h-3 w-3 text-muted-foreground mb-1" />
                                <div className="font-bold">R$ {equipeSelecionada.metricas.valorProduzido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div>
                                <div className="text-muted-foreground">Produzido</div>
                              </div>
                              <div className="bg-card rounded p-2">
                                <Route className="h-3 w-3 text-muted-foreground mb-1" />
                                <div className="font-bold">{equipeSelecionada.metricas.distanciaTotal.toFixed(1)} km</div>
                                <div className="text-muted-foreground">Distância</div>
                              </div>
                              <div className="bg-card rounded p-2">
                                <Clock className="h-3 w-3 text-muted-foreground mb-1" />
                                <div className="font-bold">{Math.floor(equipeSelecionada.metricas.tempoEstimado / 60)}h{equipeSelecionada.metricas.tempoEstimado % 60}m</div>
                                <div className="text-muted-foreground">Tempo Est.</div>
                              </div>
                            </div>
                          </div>

                          {/* Lista de OSs */}
                          <div className="p-2">
                            <div className="flex items-center justify-between mb-2 px-1">
                              <div className="text-xs font-semibold text-muted-foreground">
                                Sequência de OSs ({ordensParaExibir.length}):
                              </div>
                              <div className="text-[9px] text-muted-foreground">
                                Use ↑↓ para reordenar
                              </div>
                            </div>
                            <div className="space-y-1">
                              {ordensParaExibir.map((os, idx) => {
                                const isSelected = selectedOSId === os.id || osSelecionadaNoEditor === os.id;
                                const isUrgente = verificarUrgenciaOS(os.prazo, os.regulada, prazoLimiteDate);
                                const isConcluida = os.status === "concluida";
                                const isEmAndamento = ["em_deslocamento", "no_local", "em_execucao", "em_andamento", "pausada"].includes(os.status);
                                const podeMover = os.status === "planejada"; // Só pode mover OS que ainda não foi iniciada
                                const podeSubir = podeMover && idx > 0 && ordensParaExibir[idx - 1]?.status === "planejada";
                                const podeDescer = podeMover && idx < ordensParaExibir.length - 1;
                                
                                return (
                                  <div
                                    key={os.id}
                                    className={cn(
                                      "p-2 rounded-lg border transition-all",
                                      isSelected && "ring-2 ring-primary bg-primary/5",
                                      isConcluida && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
                                      isUrgente && !isConcluida && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
                                      isEmAndamento && !isConcluida && !isUrgente && "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800",
                                      !isSelected && !isConcluida && !isUrgente && !isEmAndamento && "bg-card hover:bg-muted/40"
                                    )}
                                  >
                                    <div className="flex items-start gap-2">
                                      {/* Botões de ordenação */}
                                      <div className="flex flex-col gap-0.5">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={cn("h-5 w-5", !podeSubir && "opacity-30 cursor-not-allowed")}
                                          disabled={!podeSubir}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            moverOSParaCima(selectedEquipeId, os.id);
                                          }}
                                          title="Mover para cima"
                                        >
                                          <ArrowUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={cn("h-5 w-5", !podeDescer && "opacity-30 cursor-not-allowed")}
                                          disabled={!podeDescer}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            moverOSParaBaixo(selectedEquipeId, os.id);
                                          }}
                                          title="Mover para baixo"
                                        >
                                          <ArrowDown className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      
                                      {/* Número da ordem */}
                                      <div 
                                        className={cn(
                                          "flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white cursor-pointer",
                                          isConcluida ? "bg-emerald-500" : isUrgente ? "bg-red-500" : isEmAndamento ? "bg-violet-500" : "bg-primary"
                                        )}
                                        onClick={() => {
                                          setSelectedOSId(os.id);
                                          setOsSelecionadaNoEditor(os.id);
                                          setOrdemDetalhesId(os.id);
                                          setDetalhesOpen(true);
                                        }}
                                      >
                                        {idx + 1}
                                      </div>
                                      
                                      {/* Conteúdo */}
                                      <div 
                                        className="flex-1 min-w-0 cursor-pointer"
                                        onClick={() => {
                                          setSelectedOSId(os.id);
                                          setOsSelecionadaNoEditor(os.id);
                                          setOrdemDetalhesId(os.id);
                                          setDetalhesOpen(true);
                                        }}
                                      >
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold text-xs">{os.numero}</span>
                                          {os.regulada && <Zap className={cn("h-3 w-3", isUrgente ? "text-red-500" : "text-orange-500")} />}
                                          {isConcluida && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                                          {os.status === "em_execucao" && <Play className="h-3 w-3 text-violet-500" />}
                                          {os.status === "em_deslocamento" && <Car className="h-3 w-3 text-sky-500" />}
                                          {os.status === "pausada" && <Timer className="h-3 w-3 text-amber-500" />}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                          {os.endereco}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-[9px]">
                                          {os.horaInicioEstimada && (
                                            <span className="flex items-center gap-0.5 text-muted-foreground">
                                              <Clock className="h-2.5 w-2.5" />
                                              {os.horaInicioEstimada.slice(0, 5)} - {os.horaFimEstimada?.slice(0, 5)}
                                            </span>
                                          )}
                                          {os.distanciaKm != null && os.distanciaKm > 0 && (
                                            <span className="flex items-center gap-0.5 text-muted-foreground">
                                              <Route className="h-2.5 w-2.5" />
                                              {os.distanciaKm.toFixed(1)}km
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Status Badge e Botão Remover */}
                                      <div className="flex flex-col items-end gap-1">
                                        <Badge 
                                          variant="outline" 
                                          className={cn(
                                            "text-[8px] shrink-0",
                                            isConcluida && "bg-emerald-100 text-emerald-700 border-emerald-300",
                                            os.status === "em_execucao" && "bg-violet-100 text-violet-700 border-violet-300",
                                            os.status === "em_deslocamento" && "bg-sky-100 text-sky-700 border-sky-300",
                                            os.status === "planejada" && "bg-slate-100 text-slate-700 border-slate-300"
                                          )}
                                        >
                                          {statusLabels[os.status] || os.status}
                                        </Badge>
                                        {podeMover && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removerOSDaRota(selectedEquipeId, os.id);
                                            }}
                                            title="Remover da rota"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Aviso se não pode editar */}
                                    {!podeMover && !isConcluida && (
                                      <div className="mt-2 pt-2 border-t border-dashed text-[9px] text-amber-600 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        {isEmAndamento ? "OS em andamento - não pode ser movida" : "Aguarde para editar"}
                                      </div>
                                    )}
                                    {isConcluida && (
                                      <div className="mt-2 pt-2 border-t border-dashed text-[9px] text-emerald-600 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        OS concluída
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              
                              {ordensParaExibir.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                  <Route className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  Nenhuma OS nesta rota
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Mapa - Direita */}
            <div className="xl:col-span-8">
              <Card className="h-[650px] overflow-hidden">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MapIcon className="h-4 w-4" />
                      Mapa de Rotas
                    </span>
                    {selectedEquipeId && (
                      <Badge variant="secondary">
                        {equipesFiltradas.find(e => e.id === selectedEquipeId)?.codigo}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[590px]">
                  <MapaLeaflet
                    rotas={rotasParaMapa}
                    osPendentes={[]}
                    equipesMock={equipesParaMapa}
                    equipeHovered={equipeHovered}
                    equipeEditando={selectedEquipeId}
                    osSelecionada={selectedOSId}
                    territorios={territorios || []}
                    prazoLimiteUrgente={prazoLimiteDate}
                    versaoPrazoUrgente={versaoPrazoUrgente}
                    onOSSelecionada={(osId) => {
                      setSelectedOSId(osId);
                      if (osId) {
                        setOrdemDetalhesId(osId);
                        setDetalhesOpen(true);
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de Detalhes da OS */}
      <OrdemServicoDetalhesDialog
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        ordemId={ordemDetalhesId}
      />

      {/* Chat da Torre de Controle */}
      <ChatTorreControle />
    </MainLayout>
  );
}

