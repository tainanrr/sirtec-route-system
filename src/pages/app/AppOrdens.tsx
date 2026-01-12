import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTecnico } from "@/contexts/TecnicoContext";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { usePageState } from "@/contexts/ScrollRestoreContext";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData, CACHE_KEYS } from "@/hooks/useOfflineData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MapPin, 
  ChevronRight, 
  Search, 
  Clock, 
  AlertTriangle,
  Calendar,
  Navigation,
  Timer,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  Truck,
  RefreshCw,
  Loader2,
  Map as MapIcon,
  X,
  Plus
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, addDays, subDays, isToday, isTomorrow, isYesterday, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getDadosSkills } from "@/lib/skillsUtils";
import CriarOSAvulsaDialog from "@/components/app/CriarOSAvulsaDialog";

// Função para formatar tempo em minutos para formato legível
const formatarTempo = (minutos: number | null | undefined): string => {
  if (!minutos || minutos <= 0) return "";
  
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  
  if (horas > 0) {
    return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
  }
  return `${mins}min`;
};

interface OrdemPlanejada {
  id: string;
  ordem_na_rota: number;
  hora_inicio_estimada: string | null;
  hora_fim_estimada: string | null;
  distancia_km: number | null;
  tempo_estimado_minutos: number | null;
  planejamento_id: string;
  ordens_servico: {
    id: string;
    numero: string;
    tipo: string;
    endereco: string;
    cliente_nome: string | null;
    status: string;
    prazo: string | null;
    regulada: boolean | null;
    avulsa: boolean | null;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
  } | null;
  planejamentos: {
    id: string;
    data_planejamento: string;
    status: string;
  } | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ElementType; color: string }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: Clock, color: "text-gray-500" },
  planejada: { label: "Planejada", variant: "secondary", icon: Calendar, color: "text-blue-500" },
  em_deslocamento: { label: "Em Deslocamento", variant: "default", icon: Truck, color: "text-orange-500" },
  no_local: { label: "No Local", variant: "default", icon: MapPin, color: "text-cyan-500" },
  em_andamento: { label: "Em Execução", variant: "default", icon: PlayCircle, color: "text-blue-600" },
  em_execucao: { label: "Em Execução", variant: "default", icon: PlayCircle, color: "text-blue-600" },
  pausada: { label: "Pausada", variant: "outline", icon: PauseCircle, color: "text-amber-500" },
  concluida: { label: "Concluída", variant: "outline", icon: CheckCircle2, color: "text-green-600" },
  cancelada: { label: "Cancelada", variant: "destructive", icon: AlertTriangle, color: "text-red-500" },
};

export default function AppOrdens() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { equipe, isLoading: isLoadingEquipe } = useTecnico();
  const { isOnline, pendingOperations } = useOfflineSyncContext();
  const { getPlanejamentoFromCache, getSkillsFromCache, saveToCache } = useOfflineData();
  const { getState, saveState } = usePageState<{
    searchTerm?: string;
    activeTab?: string;
    selectedDate?: string; // ISO
    showMap?: boolean;
  }>("app-ordens");

  const initialState = getState();
  const [searchTerm, setSearchTerm] = useState(() => initialState?.searchTerm || "");
  const [activeTab, setActiveTab] = useState(() => initialState?.activeTab || "todas");
  // SEMPRE começar com data de hoje - NUNCA restaurar data salva
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    // Forçar data de hoje ao abrir a tela
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasAutoReloaded, setHasAutoReloaded] = useState(false);
  const previousOnlineRef = useRef(isOnline);
  const [showMap, setShowMap] = useState(() => Boolean(initialState?.showMap));
  const [showCriarAvulsa, setShowCriarAvulsa] = useState(false);

  // Persistir estado de UI desta tela (além do scroll)
  useEffect(() => {
    const t = window.setTimeout(() => {
      saveState({
        searchTerm,
        activeTab,
        selectedDate: selectedDate.toISOString(),
        showMap,
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [searchTerm, activeTab, selectedDate, showMap, saveState]);

  // Buscar ordens planejadas para a data selecionada
  const { equipe: equipeAuth } = useEquipeAuth();
  
  // Determinar o ID da equipe - priorizar equipeAuth que funciona offline
  const equipeIdParaUsar = equipeAuth?.id || equipe?.id;
  
  console.log("[DEBUG AppOrdens] IDs disponíveis - equipe:", equipe?.id, "equipeAuth:", equipeAuth?.id, "usando:", equipeIdParaUsar);

  // Estado local para armazenar ordens do cache quando offline
  const [ordensOfflineCache, setOrdensOfflineCache] = useState<OrdemPlanejada[]>([]);

  // Função auxiliar para obter o status mais recente de uma OS (verificando operações pendentes)
  const getStatusAtualizado = useCallback((osId: string, statusAtual: string): string => {
    // Buscar operações de update_os_status para esta OS
    const operacoesDestaOS = pendingOperations.filter(op => {
      if (op.type !== "update_os_status") return false;
      const payload = op.payload;
      if (!payload) return false;
      return payload.id === osId || payload.ordem_servico_id === osId;
    });

    if (operacoesDestaOS.length > 0) {
      // Encontrar a operação mais recente
      const operacaoMaisRecente = operacoesDestaOS.reduce((prev, current) =>
        new Date(prev.created_at) > new Date(current.created_at) ? prev : current
      );
      
      const novosStatus = operacaoMaisRecente.payload?.status;
      if (novosStatus && novosStatus !== statusAtual) {
        console.log(`[AppOrdens] Status atualizado para OS ${osId}: ${statusAtual} → ${novosStatus} (operação pendente)`);
        return novosStatus;
      }
    }
    
    return statusAtual;
  }, [pendingOperations]);
  
  const { data: ordensPlanejadas, isLoading: isLoadingOrdens, refetch, isFetching } = useQuery({
    // NÃO incluir isOnline na queryKey para que o cache seja compartilhado entre online/offline
    queryKey: ["ordens-planejadas", equipeIdParaUsar, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!equipeIdParaUsar) {
        console.log("[DEBUG AppOrdens] ❌ Nenhuma equipe encontrada - equipe:", equipe?.id, "equipeAuth:", equipeAuth?.id);
        return [];
      }

      const dataFormatada = format(selectedDate, "yyyy-MM-dd");
      const dataInicio = `${dataFormatada}T00:00:00`;
      const dataFim = `${dataFormatada}T23:59:59`;
      console.log("[DEBUG AppOrdens] Buscando ordens para equipe:", equipeIdParaUsar, "data:", dataFormatada, "online:", isOnline);

      // Se estiver offline, tentar usar o cache
      if (!isOnline) {
        console.log("[DEBUG AppOrdens] 📦 Offline - buscando do cache...");
        console.log("[DEBUG AppOrdens] Chave do cache: planejamento_dia_" + equipeIdParaUsar + "_" + dataFormatada);
        
        try {
          const cachedPlanejamento = await getPlanejamentoFromCache(equipeIdParaUsar, dataFormatada);
          console.log("[DEBUG AppOrdens] Resultado do cache:", cachedPlanejamento);
          
          if (cachedPlanejamento && Array.isArray(cachedPlanejamento) && cachedPlanejamento.length > 0) {
            console.log("[DEBUG AppOrdens] ✅ Cache encontrado:", cachedPlanejamento.length, "ordens");
            // Converter para o formato esperado
            const ordensFromCache: OrdemPlanejada[] = (cachedPlanejamento as any[]).map((item, index) => ({
              id: item.id || `cache-${index}`,
              ordem_na_rota: item.ordem_na_rota || index + 1,
              hora_inicio_estimada: item.hora_inicio_estimada,
              hora_fim_estimada: item.hora_fim_estimada,
              distancia_km: item.distancia_km,
              tempo_estimado_minutos: item.tempo_estimado_minutos,
              planejamento_id: item.planejamento_id || "",
              ordens_servico: item.ordens_servico || null,
              planejamentos: item.planejamentos || { id: "", data_planejamento: dataFormatada, status: "aberto" },
            }));
            return ordensFromCache;
          }
          console.log("[DEBUG AppOrdens] ⚠️ Cache vazio ou não encontrado");
        } catch (cacheError) {
          console.error("[DEBUG AppOrdens] ❌ Erro ao buscar cache:", cacheError);
        }
        return [];
      }

      // Buscar ordens planejadas
      const { data: ordensPlanejadasData, error: errorPlanejadas } = await supabase
        .from("planejamento_ordens")
        .select(`
          id,
          ordem_na_rota,
          hora_inicio_estimada,
          hora_fim_estimada,
          distancia_km,
          tempo_estimado_minutos,
          planejamento_id,
          equipe_id,
          ordens_servico:ordem_servico_id (
            id,
            numero,
            tipo,
            endereco,
            cliente_nome,
            status,
            prazo,
            regulada,
            avulsa,
            latitude,
            longitude,
            created_at
          ),
          planejamentos!inner (
            id,
            data_planejamento,
            status
          )
        `)
        .eq("equipe_id", equipeIdParaUsar)
        .eq("planejamentos.data_planejamento", dataFormatada)
        .eq("planejamentos.status", "aberto")
        .order("ordem_na_rota", { ascending: true });

      if (errorPlanejadas) {
        console.error("[DEBUG AppOrdens] Erro ao buscar ordens planejadas:", errorPlanejadas);
      }

      // Buscar OSs avulsas da equipe criadas no dia (que não estão no planejamento)
      const { data: ordensAvulsasData, error: errorAvulsas } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          numero,
          tipo,
          endereco,
          cliente_nome,
          status,
          prazo,
          regulada,
          avulsa,
          latitude,
          longitude,
          created_at
        `)
        .eq("tecnico_id", equipeIdParaUsar)
        .eq("avulsa", true)
        .gte("created_at", dataInicio)
        .lte("created_at", dataFim)
        .order("created_at", { ascending: true });

      if (errorAvulsas) {
        console.error("[DEBUG AppOrdens] Erro ao buscar ordens avulsas:", errorAvulsas);
      }

      // Mesclar ordens planejadas e avulsas
      const todasOrdens: OrdemPlanejada[] = [];
      
      // Adicionar ordens planejadas
      if (ordensPlanejadasData) {
        todasOrdens.push(...(ordensPlanejadasData as OrdemPlanejada[]));
      }
      
      // Adicionar ordens avulsas (convertendo para o formato esperado)
      if (ordensAvulsasData) {
        const idsJaIncluidos = new Set(todasOrdens.map(o => o.ordens_servico?.id));
        
        ordensAvulsasData.forEach((osAvulsa, index) => {
          // Só adicionar se não estiver já no planejamento
          if (!idsJaIncluidos.has(osAvulsa.id)) {
            const maxOrdem = todasOrdens.length > 0 
              ? Math.max(...todasOrdens.map(o => o.ordem_na_rota || 0))
              : 0;
            
            todasOrdens.push({
              id: `avulsa-${osAvulsa.id}`,
              ordem_na_rota: maxOrdem + index + 1,
              hora_inicio_estimada: null,
              hora_fim_estimada: null,
              distancia_km: null,
              tempo_estimado_minutos: null,
              planejamento_id: "",
              ordens_servico: osAvulsa,
              planejamentos: null,
            });
          }
        });
      }

      console.log("[DEBUG AppOrdens] Total ordens (planejadas + avulsas):", todasOrdens.length);

      // Salvar no cache para uso offline (apenas se tiver dados)
      if (todasOrdens.length > 0) {
        try {
          await saveToCache(`${CACHE_KEYS.PLANEJAMENTO_DIA}_${equipeIdParaUsar}_${dataFormatada}`, todasOrdens, 24);
          console.log("[DEBUG AppOrdens] Ordens salvas no cache");
        } catch (e) {
          console.error("[DEBUG AppOrdens] Erro ao salvar cache:", e);
        }
      }
      
      return todasOrdens;
    },
    enabled: !!equipeIdParaUsar,
    staleTime: 0, // Sempre considerar dados como "stale" para garantir que busque do cache/API
    refetchInterval: isOnline ? 30000 : false, // Não refetch quando offline
    refetchOnWindowFocus: isOnline, // Só refetch no foco se online
    retry: isOnline ? 3 : 0, // Não fazer retry se offline
  });

  // Log do estado atual da query
  console.log("[DEBUG AppOrdens] Estado da query - isLoading:", isLoadingOrdens, "isFetching:", isFetching, "ordensPlanejadas:", ordensPlanejadas?.length || 0, "ordensOfflineCache:", ordensOfflineCache.length);

  // Buscar do cache quando offline e não temos dados
  useEffect(() => {
    const buscarDoCache = async () => {
      if (!isOnline && equipeIdParaUsar && (!ordensPlanejadas || ordensPlanejadas.length === 0)) {
        console.log("[DEBUG AppOrdens] 🔄 Offline sem dados - buscando do cache manualmente...");
        const dataFormatada = format(selectedDate, "yyyy-MM-dd");
        
        try {
          const cachedData = await getPlanejamentoFromCache(equipeIdParaUsar, dataFormatada);
          console.log("[DEBUG AppOrdens] Cache manual encontrado:", cachedData);
          
          if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
            console.log("[DEBUG AppOrdens] ✅ Convertendo", cachedData.length, "ordens do cache");
            const ordensFromCache: OrdemPlanejada[] = (cachedData as any[]).map((item, index) => ({
              id: item.id || `cache-${index}`,
              ordem_na_rota: item.ordem_na_rota || index + 1,
              hora_inicio_estimada: item.hora_inicio_estimada,
              hora_fim_estimada: item.hora_fim_estimada,
              distancia_km: item.distancia_km,
              tempo_estimado_minutos: item.tempo_estimado_minutos,
              planejamento_id: item.planejamento_id || "",
              equipe_id: item.equipe_id || equipeIdParaUsar,
              ordens_servico: item.ordens_servico || item,
              planejamentos: item.planejamentos || { id: "", data_planejamento: dataFormatada, status: "aberto" },
            }));
            setOrdensOfflineCache(ordensFromCache);
            console.log("[DEBUG AppOrdens] ✅ ordensOfflineCache atualizado com", ordensFromCache.length, "ordens");
          } else {
            console.log("[DEBUG AppOrdens] ⚠️ Cache vazio ou inválido");
          }
        } catch (error) {
          console.error("[DEBUG AppOrdens] ❌ Erro ao buscar cache:", error);
        }
      }
    };
    
    buscarDoCache();
  }, [isOnline, equipeIdParaUsar, selectedDate, ordensPlanejadas]);

  // Recarregar dados automaticamente quando a internet voltar
  useEffect(() => {
    const wasOffline = !previousOnlineRef.current;
    const isNowOnline = isOnline;
    previousOnlineRef.current = isOnline;
    
    // Se estava offline e agora está online, recarregar dados
    if (wasOffline && isNowOnline && (equipe?.id || equipeAuth?.id)) {
      console.log("[AppOrdens] Internet restaurada - recarregando dados automaticamente...");
      // Limpar cache offline
      setOrdensOfflineCache([]);
      // Invalidar cache do react-query para forçar nova busca
      queryClient.invalidateQueries({ queryKey: ["ordens-planejadas"] });
      refetch().then(() => {
        toast.success("Dados da rota atualizados!");
      }).catch(err => {
        console.error("[AppOrdens] Erro ao atualizar dados:", err);
      });
    }
  }, [isOnline, equipe?.id, equipeAuth?.id, refetch, queryClient]);

  // Realtime subscription
  useEffect(() => {
    if (!equipe?.id || !isOnline) return; // Só ativar realtime se online

    const channel = supabase
      .channel("ordens-lista-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ordens_servico",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ordens-planejadas"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [equipe?.id, queryClient, isOnline]);

  // Estado local para skills offline
  const [skillsOfflineCache, setSkillsOfflineCache] = useState<any[]>([]);

  // Buscar skills para mapear código -> nome
  const { data: skillsDataList } = useQuery({
    queryKey: ["skills-app-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("codigo, nome")
        .eq("ativo", true);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    enabled: isOnline, // Só executar quando online
  });

  // Buscar skills do cache quando offline
  useEffect(() => {
    const buscarSkillsDoCache = async () => {
      if (!isOnline && skillsOfflineCache.length === 0) {
        console.log("[AppOrdens] 📦 Offline - buscando skills do cache manualmente...");
        try {
          const cachedSkills = await getSkillsFromCache();
          if (cachedSkills && Array.isArray(cachedSkills) && cachedSkills.length > 0) {
            console.log("[AppOrdens] ✅ Skills do cache:", cachedSkills.length);
            setSkillsOfflineCache(cachedSkills);
          } else {
            console.log("[AppOrdens] ⚠️ Skills não encontrados no cache");
          }
        } catch (error) {
          console.error("[AppOrdens] ❌ Erro ao buscar skills do cache:", error);
        }
      }
    };
    buscarSkillsDoCache();
  }, [isOnline, skillsOfflineCache.length, getSkillsFromCache]);

  // Usar skills do React Query ou do cache offline
  const skillsParaUsar = (skillsDataList && skillsDataList.length > 0) 
    ? skillsDataList 
    : skillsOfflineCache;

  // Criar mapa de códigos para nomes
  const skillsNomes = new Map<string, string>();
  if (skillsParaUsar && skillsParaUsar.length > 0) {
    skillsParaUsar.forEach((skill: { codigo: string; nome: string }) => {
      if (skill.codigo && skill.nome) {
        skillsNomes.set(skill.codigo.toLowerCase(), skill.nome);
        skillsNomes.set(skill.codigo.toUpperCase(), skill.nome);
        skillsNomes.set(skill.codigo, skill.nome); // Também sem normalização
        const normalizado = skill.codigo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        skillsNomes.set(normalizado, skill.nome);
      }
    });
    console.log("[AppOrdens] skillsNomes criado com", skillsNomes.size, "entradas");
  }

  // Usar ordens do React Query ou do cache offline
  const ordensParaUsar = (ordensPlanejadas && ordensPlanejadas.length > 0) 
    ? ordensPlanejadas 
    : ordensOfflineCache;
  
  console.log("[DEBUG AppOrdens] ordensParaUsar:", ordensParaUsar.length, "- origem:", (ordensPlanejadas && ordensPlanejadas.length > 0) ? "React Query" : "Cache Offline");

  // Filtrar ordens (usando status atualizado das operações pendentes)
  const filteredOrdens = ordensParaUsar?.filter((ordem) => {
    if (!ordem.ordens_servico) return false;

    const matchesSearch =
      ordem.ordens_servico.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ordem.ordens_servico.endereco.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ordem.ordens_servico.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ordem.ordens_servico.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    // Usar status atualizado das operações pendentes
    const status = getStatusAtualizado(ordem.ordens_servico.id, ordem.ordens_servico.status);

    if (activeTab === "todas") return matchesSearch;
    if (activeTab === "pendentes") return matchesSearch && (status === "pendente" || status === "planejada");
    if (activeTab === "andamento") return matchesSearch && (status === "em_deslocamento" || status === "em_andamento" || status === "em_execucao" || status === "no_local" || status === "pausada");
    if (activeTab === "concluidas") return matchesSearch && status === "concluida";

    return matchesSearch;
  });

  // Limite de 3 dias para visualização de rotas antigas (para não sobrecarregar com fotos/anexos)
  const LIMITE_DIAS_PASSADO = 3;
  
  // Verificar se pode navegar para o dia anterior
  const podeIrParaAnterior = () => {
    const hoje = startOfDay(new Date());
    const diasDiferenca = differenceInDays(hoje, startOfDay(selectedDate));
    return diasDiferenca < LIMITE_DIAS_PASSADO;
  };

  // Limpar cache de dados antigos quando a data selecionada muda
  useEffect(() => {
    const hoje = startOfDay(new Date());
    const diasDiferenca = differenceInDays(hoje, startOfDay(selectedDate));
    
    // Se a data selecionada está além do limite de 3 dias, limpar cache local
    if (diasDiferenca > LIMITE_DIAS_PASSADO) {
      // Limpar dados do localStorage relacionados a ordens antigas
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('page-state-app-ordens') || key.startsWith('app-ordens'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Invalidar queries antigas
      queryClient.removeQueries({ 
        queryKey: ["ordens-planejadas"],
        predicate: (query) => {
          const queryKey = query.queryKey as any[];
          const dataKey = queryKey.find(k => typeof k === 'string' && k.includes('yyyy-MM-dd'));
          if (dataKey) {
            const dataQuery = new Date(dataKey);
            const diasDiff = differenceInDays(hoje, startOfDay(dataQuery));
            return diasDiff > LIMITE_DIAS_PASSADO;
          }
          return false;
        }
      });
    }
  }, [selectedDate, queryClient]);

  // Funções de navegação de data
  const goToPreviousDay = () => {
    if (podeIrParaAnterior()) {
      setSelectedDate(prev => subDays(prev, 1));
    } else {
      toast.error(`Você pode visualizar rotas de até ${LIMITE_DIAS_PASSADO} dias atrás`);
    }
  };
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

  // Formatar label da data
  const getDateLabel = () => {
    if (isToday(selectedDate)) return "Hoje";
    if (isTomorrow(selectedDate)) return "Amanhã";
    if (isYesterday(selectedDate)) return "Ontem";
    return format(selectedDate, "dd/MM/yyyy");
  };

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Lista atualizada!");
    } catch {
      toast.error("Erro ao atualizar");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoadingEquipe) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
      <h1 className="text-xl font-bold">Minhas Ordens</h1>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowCriarAvulsa(true)}
            title="Criar OS Avulsa"
            className="text-violet-600 hover:text-violet-700 hover:bg-violet-100"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowMap(true)}
            disabled={!ordensParaUsar || ordensParaUsar.length === 0}
            title="Ver roteiro no mapa"
          >
            <MapIcon className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Seletor de Data */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goToPreviousDay}
          disabled={!podeIrParaAnterior()}
          title={!podeIrParaAnterior() ? `Limite de ${LIMITE_DIAS_PASSADO} dias` : "Dia anterior"}
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
        </Button>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2"
          onClick={goToToday}
        >
          <Calendar className="h-4 w-4" />
          <span className="font-medium">{getDateLabel()}</span>
          <span className="text-xs text-muted-foreground">
            {format(selectedDate, "EEE", { locale: ptBR })}
          </span>
        </Button>
        <Button variant="ghost" size="icon" onClick={goToNextDay}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por número, endereço, tipo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todas" className="text-xs">
            Todas
            {ordensParaUsar && ordensParaUsar.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                {ordensParaUsar.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="text-xs">Pendentes</TabsTrigger>
          <TabsTrigger value="andamento" className="text-xs">Andamento</TabsTrigger>
          <TabsTrigger value="concluidas" className="text-xs">Feitas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lista */}
      <div className="space-y-3">
        {isLoadingOrdens ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : filteredOrdens?.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {searchTerm ? "Nenhuma ordem encontrada" : "Nenhuma ordem para esta data"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {!searchTerm && "Tente selecionar outra data ou aguarde o planejamento."}
            </p>
          </div>
        ) : (
          filteredOrdens?.map((ordem) => {
            if (!ordem.ordens_servico) return null;
            
            // Usar status atualizado das operações pendentes
            const statusAtualizado = getStatusAtualizado(ordem.ordens_servico.id, ordem.ordens_servico.status) as keyof typeof statusConfig;
            const config = statusConfig[statusAtualizado] || statusConfig.pendente;
            const StatusIcon = config.icon;
            
            const isConcluida = statusAtualizado === "concluida";
            const isCancelada = statusAtualizado === "cancelada";
            const isEmAndamento = statusAtualizado === "em_deslocamento" || statusAtualizado === "em_andamento" || statusAtualizado === "em_execucao" || statusAtualizado === "no_local";
            const isAvulsa = ordem.ordens_servico.avulsa || ordem.ordens_servico.numero.startsWith("AVL-");
            
            // Verificar se tem pendência de sincronização para esta OS
            const temPendenciaSync = pendingOperations.some(op => {
              const payload = op.payload;
              if (!payload) return false;
              if (payload.ordem_servico_id === ordem.ordens_servico?.id) return true;
              if (payload.id === ordem.ordens_servico?.id) return true;
              return false;
            });
            
            // Determinar classe de estilo - concluída pendente tem cor diferente (verde-limão)
            const getCardClass = () => {
              if (isEmAndamento) {
                return "border-2 border-orange-500 bg-gradient-to-r from-orange-100 to-amber-50 shadow-lg shadow-orange-200/50 animate-pulse ring-2 ring-orange-400";
              }
              if (isConcluida) {
                // Concluída mas pendente de sincronização = verde-limão com indicador visual
                if (temPendenciaSync) {
                  return "border-l-4 border-l-lime-500 bg-gradient-to-r from-lime-50 to-green-50 ring-1 ring-lime-300";
                }
                return "border-l-4 border-l-green-500 bg-green-50/50";
              }
              if (isCancelada) {
                return "border-l-4 border-l-gray-400 bg-gray-50/50 opacity-60";
              }
              if (isAvulsa) {
                return "border-l-4 border-l-violet-500 bg-violet-50/30";
              }
              if (ordem.ordens_servico?.regulada) {
                return "border-l-4 border-l-red-500";
              }
              return "";
            };
            
            return (
            <Card
              key={ordem.id}
                className={`cursor-pointer hover:shadow-md transition-all ${getCardClass()}`}
                onClick={() => navigate(`/app/ordens/${ordem.ordens_servico!.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                      {/* Header da ordem */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                          #{ordem.ordem_na_rota}
                        </Badge>
                        <Badge variant={config.variant} className="text-xs flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        {ordem.ordens_servico.regulada && (
                          <Badge variant="destructive" className="text-xs">
                            URGENTE
                          </Badge>
                        )}
                        {isAvulsa && (
                          <Badge className="text-xs bg-violet-600 hover:bg-violet-700">
                            AVULSA
                          </Badge>
                        )}
                        {temPendenciaSync && (
                          <Badge className="text-xs bg-lime-600 hover:bg-lime-700 animate-pulse">
                            ⏳ Sincronizando
                          </Badge>
                        )}
                      </div>
                      
                      {/* Número e Tipo */}
                      <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground font-mono">
                          {ordem.ordens_servico.numero}
                      </span>
                    </div>
                      <p className="font-semibold text-foreground">
                        {skillsNomes.get(ordem.ordens_servico.tipo) || 
                         skillsNomes.get(ordem.ordens_servico.tipo?.toLowerCase()) ||
                         ordem.ordens_servico.tipo}
                      </p>
                      
                      {/* Endereço */}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{ordem.ordens_servico.endereco}</span>
                    </div>
                      
                      {/* Info adicional */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                        {ordem.hora_inicio_estimada && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                            {ordem.hora_inicio_estimada}
                          </span>
                        )}
                        {ordem.tempo_estimado_minutos && ordem.tempo_estimado_minutos > 0 && (
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            ~{formatarTempo(ordem.tempo_estimado_minutos)}
                          </span>
                        )}
                        {ordem.distancia_km && ordem.distancia_km > 0 && (
                          <span className="flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            {ordem.distancia_km.toFixed(1)}km
                          </span>
                        )}
                        {ordem.ordens_servico.cliente_nome && (
                          <span className="truncate">
                            {ordem.ordens_servico.cliente_nome}
                      </span>
                      )}
                    </div>
                  </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
                </div>
              </CardContent>
            </Card>
            );
          })
        )}
      </div>

      {/* Modal do Mapa */}
      <Dialog open={showMap} onOpenChange={setShowMap}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-3 pb-2 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MapIcon className="h-5 w-5" />
              Roteiro do Dia - {getDateLabel()}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 relative">
            {ordensParaUsar && ordensParaUsar.length > 0 ? (
              <MapaRoteiro 
                ordens={ordensParaUsar} 
                equipe={equipe}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Nenhuma ordem para exibir no mapa</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Criar OS Avulsa */}
      <CriarOSAvulsaDialog
        open={showCriarAvulsa}
        onOpenChange={setShowCriarAvulsa}
        onSuccess={(osId) => {
          // Navegar para a OS criada
          navigate(`/app/ordens/${osId}`);
        }}
      />
    </div>
  );
}

// Componente do Mapa - Replicando visual do MapaLeaflet da Roteirização
interface MapaRoteiroProps {
  ordens: OrdemPlanejada[];
  equipe: { latitude?: number; longitude?: number; codigo?: string; color?: string } | null;
}

// Mapeamento de ícones Lucide para SVG paths
const lucideIconPaths: Record<string, string> = {
  MapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>',
  Zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
  Wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>',
  Scissors: '<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>',
  CheckCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
  AlertCircle: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
  Power: '<path d="M12 2v10"></path><path d="M18.364 5.636a9 9 0 1 1-12.728 0"></path>',
  Plug: '<path d="M12 22v-5"></path><path d="M9 8V2"></path><path d="M15 8V2"></path><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"></path>',
  Search: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>',
  Settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>',
  Gauge: '<path d="m12 14 4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path>',
  Activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
};

// Função para obter SVG do ícone baseado no nome do ícone Lucide
const getLucideIconSVG = (iconName: string | undefined, color: string = "white", size: number = 16): string => {
  const path = lucideIconPaths[iconName || 'MapPin'] || lucideIconPaths.MapPin;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${path}
    </svg>
  `;
};

// Função para verificar se OS é urgente (regulada vencida ou vencendo hoje)
const isOSUrgente = (prazo: string | null | undefined, regulada: boolean | null | undefined): boolean => {
  if (!regulada) return false;
  if (!prazo) return false;
  
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const prazoDate = new Date(prazo);
  const prazoDia = new Date(prazoDate.getFullYear(), prazoDate.getMonth(), prazoDate.getDate());
  
  // Urgente se vencida (passado) ou vencendo hoje
  return prazoDia <= hoje;
};

function MapaRoteiro({ ordens, equipe }: MapaRoteiroProps) {
  const navigate = useNavigate();
  const { pendingOperations } = useOfflineSyncContext(); // Para verificar operações pendentes de sincronização
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map()); // Ref para armazenar marcadores por ordem_id
  const highlightCircleRef = useRef<any>(null); // Ref para o círculo de destaque
  const [mapLoaded, setMapLoaded] = useState(false);
  const [skillsIcons, setSkillsIcons] = useState<Map<string, string>>(new Map());
  const [skillsNomes, setSkillsNomes] = useState<Map<string, string>>(new Map());
  const [osSelecionada, setOsSelecionada] = useState<OrdemPlanejada | null>(null);

  // Função auxiliar para obter o status mais recente de uma OS (verificando operações pendentes)
  const getStatusAtualizado = useCallback((osId: string, statusAtual: string): string => {
    // Buscar operações de update_os_status para esta OS
    const operacoesDestaOS = pendingOperations.filter(op => {
      if (op.type !== "update_os_status") return false;
      const payload = op.payload;
      if (!payload) return false;
      return payload.id === osId || payload.ordem_servico_id === osId;
    });

    if (operacoesDestaOS.length > 0) {
      // Encontrar a operação mais recente
      const operacaoMaisRecente = operacoesDestaOS.reduce((prev, current) =>
        new Date(prev.created_at) > new Date(current.created_at) ? prev : current
      );
      
      return operacaoMaisRecente.payload?.status || statusAtual;
    }
    
    return statusAtual;
  }, [pendingOperations]);
  
  // Separar ordens com e sem coordenadas
  const ordensComCoordenadas = ordens.filter(
    o => o.ordens_servico?.latitude && o.ordens_servico?.longitude
  );
  
  const ordensSemCoordenadas = ordens.filter(
    o => !o.ordens_servico?.latitude || !o.ordens_servico?.longitude
  );
  
  // Log de debug
  useEffect(() => {
    if (ordensSemCoordenadas.length > 0) {
      console.log("[MAPA APP] OSs sem coordenadas:", ordensSemCoordenadas.map(o => ({
        ordem: o.ordem_na_rota,
        numero: o.ordens_servico?.numero,
        tipo: o.ordens_servico?.tipo,
        lat: o.ordens_servico?.latitude,
        lng: o.ordens_servico?.longitude
      })));
    }
  }, [ordensSemCoordenadas]);
  
  // Ordenar por ordem_na_rota
  const ordensOrdenadas = [...ordensComCoordenadas].sort((a, b) => a.ordem_na_rota - b.ordem_na_rota);
  const ordensSemCoordenadasOrdenadas = [...ordensSemCoordenadas].sort((a, b) => a.ordem_na_rota - b.ordem_na_rota);

  // Função para converter tipo de OS para código de skill
  const tipoParaSkillCodigo = (tipo: string): string => {
    const tipoLower = tipo.toLowerCase();
    const mapeamento: Record<string, string> = {
      'corte': 'CORTE',
      'religa': 'RELIGA',
      'ligacao': 'LIGACAO',
      'ligação': 'LIGACAO',
      'inspecao': 'INSPECAO',
      'inspeção': 'INSPECAO',
      'manutencao': 'MANUTENCAO',
      'manutenção': 'MANUTENCAO',
      'troca_medidor': 'TROCA_MEDIDOR',
    };
    return mapeamento[tipoLower] || tipo.toUpperCase();
  };

  // Buscar ícones e nomes das Skills quando ordens mudam
  useEffect(() => {
    const fetchSkillsData = async () => {
      try {
        const tiposUnicos = new Set<string>();
        ordens.forEach(o => {
          if (o.ordens_servico?.tipo) {
            tiposUnicos.add(o.ordens_servico.tipo);
          }
        });
        
        if (tiposUnicos.size === 0) return;
        
        const codigosSkills = Array.from(tiposUnicos).map(tipo => tipoParaSkillCodigo(tipo));
        
        // Buscar skills para ícones e nomes
        const { data: skillsData } = await supabase
          .from("skills")
          .select("codigo, nome, icone")
          .eq("ativo", true);
        
        const iconsMap = new Map<string, string>();
        const nomesMap = new Map<string, string>();
        
        if (skillsData) {
          skillsData.forEach((skill: { codigo: string; nome: string; icone: string | null }) => {
            const codigoLower = skill.codigo?.toLowerCase();
            const codigoUpper = skill.codigo?.toUpperCase();
            
            // Mapear por código (upper e lower case)
            if (skill.icone) {
              iconsMap.set(codigoLower, skill.icone);
              iconsMap.set(codigoUpper, skill.icone);
            }
            if (skill.nome) {
              nomesMap.set(codigoLower, skill.nome);
              nomesMap.set(codigoUpper, skill.nome);
              // Também mapear o código normalizado
              const normalizado = skill.codigo?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
              nomesMap.set(normalizado, skill.nome);
            }
          });
        }
        
        // Adicionar mapeamentos para os tipos que correspondem aos códigos
        tiposUnicos.forEach(tipo => {
          const codigoSkill = tipoParaSkillCodigo(tipo);
          const tipoLower = tipo.toLowerCase();
          
          // Se o icone existe para o código da skill, mapear também para o tipo
          if (iconsMap.has(codigoSkill)) {
            iconsMap.set(tipo, iconsMap.get(codigoSkill)!);
          }
          if (nomesMap.has(codigoSkill)) {
            nomesMap.set(tipo, nomesMap.get(codigoSkill)!);
            nomesMap.set(tipoLower, nomesMap.get(codigoSkill)!);
          }
        });
        
        setSkillsIcons(iconsMap);
        setSkillsNomes(nomesMap);
      } catch (error) {
        console.error("[MAPA APP] Erro ao buscar dados das Skills:", error);
      }
    };
    
    fetchSkillsData();
  }, [ordens]);

  // Inicializar mapa Leaflet
  useEffect(() => {
    if (!mapRef.current) return;

    // Verificar se já existe um mapa
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Verificar se Leaflet já está carregado
    if ((window as any).L) {
      initMap();
      return;
    }

    // Carregar CSS do Leaflet
    if (!document.querySelector('link[href*="leaflet"]')) {
      const linkEl = document.createElement("link");
      linkEl.rel = "stylesheet";
      linkEl.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(linkEl);
    }

    // Carregar JS do Leaflet
    if (!document.querySelector('script[src*="leaflet"]')) {
      const scriptEl = document.createElement("script");
      scriptEl.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      scriptEl.onload = () => {
        initMap();
      };
      document.head.appendChild(scriptEl);
    } else {
      // Script já existe, esperar carregar
      const checkLeaflet = setInterval(() => {
        if ((window as any).L) {
          clearInterval(checkLeaflet);
          initMap();
        }
      }, 100);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Atualizar marcadores quando ordens ou ícones mudam
  useEffect(() => {
    if (mapInstanceRef.current && (window as any).L) {
      updateMarkers();
    }
  }, [ordens, equipe, skillsIcons]);

  // Centralizar e destacar OS selecionada no mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !(window as any).L || !osSelecionada) return;
    
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    const lat = osSelecionada.ordens_servico?.latitude;
    const lng = osSelecionada.ordens_servico?.longitude;
    
    if (!lat || !lng) return;
    
    // Remover círculo de destaque anterior
    if (highlightCircleRef.current) {
      try { map.removeLayer(highlightCircleRef.current); } catch(e) {}
      highlightCircleRef.current = null;
    }
    
    // Criar círculo de destaque pulsante
    const highlightCircle = L.circle([lat, lng], {
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      radius: 100,
      weight: 3,
      className: 'pulse-animation'
    }).addTo(map);
    highlightCircleRef.current = highlightCircle;
    
    // Centralizar o mapa na OS com animação
    map.flyTo([lat, lng], 16, { duration: 0.5 });
    
    // Abrir popup do marcador se existir
    const marker = markersRef.current.get(osSelecionada.id);
    if (marker) {
      marker.openPopup();
    }
    
  }, [osSelecionada]);

  // Limpar círculo quando desseleciona OS
  useEffect(() => {
    if (!osSelecionada && highlightCircleRef.current && mapInstanceRef.current) {
      try { 
        mapInstanceRef.current.removeLayer(highlightCircleRef.current); 
      } catch(e) {}
      highlightCircleRef.current = null;
    }
  }, [osSelecionada]);

  // Funções globais para os botões do popup
  useEffect(() => {
    (window as any).irParaOS = (osId: string) => {
      navigate(`/app/ordens/${osId}`);
    };
    (window as any).navegarOS = (lat: string, lng: string) => {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(url, "_blank");
    };
    
    return () => {
      delete (window as any).irParaOS;
      delete (window as any).navegarOS;
    };
  }, [navigate]);

  const initMap = () => {
    if (!mapRef.current || !(window as any).L || mapInstanceRef.current) return;

    const L = (window as any).L;

    // Calcular centro inicial
    const lats = ordensOrdenadas.map(o => o.ordens_servico!.latitude!);
    const lngs = ordensOrdenadas.map(o => o.ordens_servico!.longitude!);
    if (equipe?.latitude && equipe?.longitude) {
      lats.push(equipe.latitude);
      lngs.push(equipe.longitude);
    }
    const centerLat = lats.length > 0 ? lats.reduce((a, b) => a + b, 0) / lats.length : -14.8661;
    const centerLng = lngs.length > 0 ? lngs.reduce((a, b) => a + b, 0) / lngs.length : -40.8394;

    // Criar mapa
    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 13,
    });
    mapInstanceRef.current = map;

    // Adicionar tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    updateMarkers();
    setMapLoaded(true);
  };

  const updateMarkers = () => {
    if (!mapInstanceRef.current || !(window as any).L) return;

    const L = (window as any).L;
    const map = mapInstanceRef.current;

    // Limpar marcadores anteriores
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });
    
    // Limpar ref de marcadores
    markersRef.current.clear();

    // Re-adicionar tiles se necessário
    let hasTileLayer = false;
    map.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) hasTileLayer = true;
    });
    if (!hasTileLayer) {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
    }

    const corEquipe = equipe?.color || "#3b82f6";
    const routePoints: [number, number][] = [];

    // Adicionar marcador da equipe (ponto de partida) - Estilo similar ao MapaLeaflet
    if (equipe?.latitude && equipe?.longitude) {
      const markerHTML = `
        <div style="
          background-color: ${corEquipe};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        "></div>
      `;
      const marker = L.marker([equipe.latitude, equipe.longitude], {
        icon: L.divIcon({
          className: "custom-marker-base",
          html: markerHTML,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);
      marker.bindPopup(`<strong>${equipe.codigo || "Equipe"}</strong><br><span style="color: #666;">Base de Saída</span>`);
      routePoints.push([equipe.latitude, equipe.longitude]);
    }

    // Adicionar marcadores das ordens - Estilo similar ao MapaLeaflet com ícones das Skills
    ordensOrdenadas.forEach((ordem) => {
      const lat = ordem.ordens_servico!.latitude!;
      const lng = ordem.ordens_servico!.longitude!;
      // Usar status atualizado das operações pendentes
      const status = getStatusAtualizado(ordem.ordens_servico?.id || "", ordem.ordens_servico?.status || "");
      const tipo = ordem.ordens_servico?.tipo || "";
      const prazo = ordem.ordens_servico?.prazo;
      const regulada = ordem.ordens_servico?.regulada;
      const isConcluida = status === "concluida";
      const isCancelada = status === "cancelada";
      const isEmAndamento = status === "em_deslocamento" || status === "em_andamento" || status === "em_execucao" || status === "no_local";
      
      // Verificar se é urgente (regulada vencida ou vencendo hoje)
      const urgente = isOSUrgente(prazo, regulada);
      
      // Determinar cor baseada no status
      let corFundo = "#000000"; // Preto para pendentes
      let corBorda = "#374151"; // Cinza escuro padrão
      let corIcone = "white";
      
      if (isConcluida) {
        corFundo = "#22c55e";
        corBorda = "#15803d";
      } else if (isCancelada) {
        corFundo = "#ef4444";
        corBorda = "#b91c1c";
      } else if (isEmAndamento) {
        corFundo = "#f59e0b";
        corBorda = "#d97706";
      } else if (urgente) {
        // Apenas urgentes (reguladas vencidas ou vencendo hoje) têm borda vermelha
        corBorda = "#dc2626";
      }
      
      // Obter ícone da Skill cadastrada
      const iconName = skillsIcons.get(tipo);
      const iconSVG = getLucideIconSVG(iconName, corIcone, 18);
      
      // Tamanho do marcador
      const tamanhoMarker = 40;
      
      const markerHTML = `
        <div style="
          background-color: ${corFundo};
          width: ${tamanhoMarker}px;
          height: ${tamanhoMarker}px;
          border-radius: 50%;
          border: 3px solid ${corBorda};
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          ${iconSVG}
          <div style="
            position: absolute;
            bottom: -4px;
            right: -4px;
            background-color: rgba(0,0,0,0.85);
            color: white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            border: 1.5px solid white;
          ">${ordem.ordem_na_rota}</div>
          ${urgente ? `
            <div style="
              position: absolute;
              top: -4px;
              right: -4px;
              background-color: #dc2626;
              color: white;
              border-radius: 50%;
              width: 14px;
              height: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8px;
              font-weight: bold;
              border: 1px solid white;
            ">!</div>
          ` : ''}
        </div>
      `;
      
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "custom-marker-os",
          html: markerHTML,
          iconSize: [tamanhoMarker, tamanhoMarker],
          iconAnchor: [tamanhoMarker / 2, tamanhoMarker / 2],
        }),
      }).addTo(map);
      
      // Popup com informações detalhadas
      const prazoFormatado = ordem.ordens_servico?.prazo 
        ? new Date(ordem.ordens_servico.prazo).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          })
        : "Sem prazo";
      
      const osId = ordem.ordens_servico?.id;
      const popupContent = `
        <div style="min-width: 200px; font-family: system-ui, sans-serif;">
          <div style="margin-bottom: 6px;">
            <strong style="color: ${corFundo};">#${ordem.ordem_na_rota}</strong> - 
            <span style="font-weight: 600;">${ordem.ordens_servico?.tipo}</span>
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
            ${ordem.ordens_servico?.endereco}
          </div>
          <div style="font-size: 11px; color: #888; margin-bottom: 8px;">
            <strong>Horário:</strong> ${ordem.hora_inicio_estimada || "-"}<br>
            <strong>Prazo:</strong> ${prazoFormatado}
          </div>
          ${regulada ? '<div style="margin-bottom: 8px; padding: 2px 6px; background-color: #fee2e2; border-radius: 4px; display: inline-block;"><span style="color: #dc2626; font-weight: bold; font-size: 10px;">REGULADA</span></div>' : ""}
          <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px;">
            <button onclick="window.irParaOS('${osId}')" style="flex: 1; padding: 6px 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
              Ir para OS
            </button>
            <button onclick="window.navegarOS('${lat}', '${lng}')" style="padding: 6px 10px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; cursor: pointer;" title="Google Maps">
              📍
            </button>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);
      
      // Armazenar marcador no ref para acesso posterior
      markersRef.current.set(ordem.id, marker);
      
      // Ao clicar no marcador, selecionar a OS
      marker.on('click', () => {
        setOsSelecionada(ordem);
      });
      
      routePoints.push([lat, lng]);
    });

    // Desenhar linha da rota - Estilo similar ao MapaLeaflet
    if (routePoints.length > 1) {
      L.polyline(routePoints, {
        color: corEquipe,
        weight: 4,
        opacity: 0.8,
        dashArray: "8, 8"
      }).addTo(map);
    }

    // Ajustar zoom para mostrar todos os pontos
    if (routePoints.length > 0) {
      const bounds = L.latLngBounds(routePoints);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  };
  
  // Abrir Google Maps para uma OS específica
  const openOSInGoogleMaps = (ordem: OrdemPlanejada) => {
    if (!ordem.ordens_servico?.latitude || !ordem.ordens_servico?.longitude) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${ordem.ordens_servico.latitude},${ordem.ordens_servico.longitude}&travelmode=driving`;
    window.open(url, "_blank");
  };
  
  // Abrir Waze para uma OS específica
  const openOSInWaze = (ordem: OrdemPlanejada) => {
    if (!ordem.ordens_servico?.latitude || !ordem.ordens_servico?.longitude) return;
    const url = `https://waze.com/ul?ll=${ordem.ordens_servico.latitude},${ordem.ordens_servico.longitude}&navigate=yes`;
    window.open(url, "_blank");
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Barra de OS selecionada */}
      {osSelecionada && (
        <div className="p-2 bg-primary/10 border-b flex items-center gap-2 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              #{osSelecionada.ordem_na_rota} - {osSelecionada.ordens_servico?.tipo}
            </p>
            <p className="text-xs text-muted-foreground truncate">{osSelecionada.ordens_servico?.endereco}</p>
          </div>
          <Button 
            onClick={() => navigate(`/app/ordens/${osSelecionada.ordens_servico?.id}`)}
            size="sm"
            variant="default"
          >
            <ChevronRight className="h-4 w-4 mr-1" />
            Ir para OS
          </Button>
          <Button 
            onClick={() => openOSInGoogleMaps(osSelecionada)}
            size="sm"
            variant="outline"
            disabled={!osSelecionada.ordens_servico?.latitude}
          >
            <Navigation className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => openOSInWaze(osSelecionada)}
            size="sm"
            variant="outline"
            disabled={!osSelecionada.ordens_servico?.latitude}
          >
            <MapIcon className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => setOsSelecionada(null)}
            size="sm"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Mapa Leaflet */}
      <div className="flex-1 min-h-0 relative">
        <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 1 }} />
        
        {/* Overlay com lista de pontos */}
        <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t max-h-[40%] overflow-auto" style={{ zIndex: 1000 }}>
          <div className="p-3">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Sequência do Roteiro ({ordens.length} pontos)
              {ordensSemCoordenadasOrdenadas.length > 0 && (
                <span className="text-orange-500 text-xs">
                  ({ordensSemCoordenadasOrdenadas.length} sem localização)
                </span>
              )}
            </h4>
            <div className="space-y-2">
              {equipe?.latitude && equipe?.longitude && (
                <div className="flex items-center gap-2 text-xs p-2 rounded border" style={{ backgroundColor: `${equipe.color || '#3b82f6'}15`, borderColor: `${equipe.color || '#3b82f6'}40` }}>
                  <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: equipe.color || '#3b82f6' }}>
                    P
                  </div>
                  <span className="font-medium" style={{ color: equipe.color || '#3b82f6' }}>Ponto de Partida ({equipe.codigo})</span>
                </div>
              )}
              {/* Todas as ordens ordenadas por ordem_na_rota */}
              {[...ordens].sort((a, b) => a.ordem_na_rota - b.ordem_na_rota).map((ordem) => {
                // Usar status atualizado das operações pendentes
                const status = getStatusAtualizado(ordem.ordens_servico?.id || "", ordem.ordens_servico?.status || "");
                const tipo = ordem.ordens_servico?.tipo || "";
                const prazo = ordem.ordens_servico?.prazo;
                const regulada = ordem.ordens_servico?.regulada;
                const isConcluida = status === "concluida";
                const isCancelada = status === "cancelada";
                const isEmAndamento = status === "em_deslocamento" || status === "em_andamento" || status === "em_execucao" || status === "no_local";
                const urgente = isOSUrgente(prazo, regulada);
                const semCoordenadas = !ordem.ordens_servico?.latitude || !ordem.ordens_servico?.longitude;
                
                // Verificar se há operações pendentes de sincronização para esta OS
                const osId = ordem.ordens_servico?.id;
                const temPendenciaSync = osId && pendingOperations.some(op => {
                  const payload = op.payload;
                  if (!payload) return false;
                  if (payload.ordem_servico_id === osId) return true;
                  if (op.type === "update_os_status" && payload.id === osId) return true;
                  if (op.type === "update_ordem_retorno" && payload.id === osId) return true;
                  return false;
                });
                
                let bgClass = "bg-gray-100 border-gray-300";
                let badgeBg = "#000000"; // Preto para pendentes
                
                if (isConcluida) {
                  // Se concluída mas tem pendência de sincronização, usar verde mais claro/amarelado
                  if (temPendenciaSync) {
                    bgClass = "bg-green-300/20 border-green-400/40";
                    badgeBg = "#84cc16"; // Verde limão para indicar pendência
                  } else {
                    bgClass = "bg-green-500/10 border-green-500/30";
                    badgeBg = "#22c55e";
                  }
                } else if (isCancelada) {
                  bgClass = "bg-red-500/10 border-red-500/30 line-through opacity-50";
                  badgeBg = "#ef4444";
                } else if (isEmAndamento) {
                  bgClass = "bg-amber-500/10 border-amber-500/30";
                  badgeBg = "#f59e0b";
                } else if (urgente) {
                  bgClass = "bg-red-50 border-red-300";
                }
                
                // Se não tem coordenadas, destacar com fundo laranja
                if (semCoordenadas) {
                  bgClass = "bg-orange-100 border-orange-400";
                }
                
                // Obter ícone da Skill
                const iconName = skillsIcons.get(tipo);
                
                return (
                  <div 
                    key={ordem.id}
                    className={`flex items-center gap-2 text-xs p-2 rounded border cursor-pointer hover:shadow-md transition-shadow ${bgClass} ${osSelecionada?.id === ordem.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setOsSelecionada(ordem)}
                  >
                    <div 
                      className="h-7 w-7 rounded-full flex items-center justify-center relative shrink-0"
                      style={{ 
                        backgroundColor: semCoordenadas ? '#f97316' : badgeBg,
                        border: urgente ? '2px solid #dc2626' : 'none'
                      }}
                      dangerouslySetInnerHTML={{ 
                        __html: getLucideIconSVG(iconName, "white", 14) 
                      }}
                    />
                    <div className="h-5 w-5 rounded-full bg-black/80 text-white flex items-center justify-center text-[10px] font-bold -ml-4 mt-3 border border-white z-10">
                      {ordem.ordem_na_rota}
                    </div>
                    <div className="flex-1 min-w-0 ml-1">
                      <div className="flex items-center gap-1">
                        <p className="font-medium truncate">{tipo}</p>
                        {urgente && (
                          <span className="bg-red-500 text-white text-[8px] px-1 rounded font-bold">URGENTE</span>
                        )}
                        {semCoordenadas && (
                          <span className="bg-orange-500 text-white text-[8px] px-1 rounded font-bold">SEM GPS</span>
                        )}
                      </div>
                      <p className="text-muted-foreground truncate">{ordem.ordens_servico?.endereco}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {ordem.hora_inicio_estimada && (
                        <span className="text-muted-foreground whitespace-nowrap mr-1">
                          {ordem.hora_inicio_estimada}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/ordens/${ordem.ordens_servico?.id}`);
                        }}
                        title="Ir para OS"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
