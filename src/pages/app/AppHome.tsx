import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData, CACHE_KEYS } from "@/hooks/useOfflineData";
import { useOfflineOperations } from "@/hooks/useOfflineOperations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Clock, 
  ChevronRight, 
  RefreshCw,
  Calendar,
  Route,
  Loader2,
  Power,
  Users,
  Car,
  Target,
  DollarSign,
  TrendingUp,
  Coffee,
  Wrench,
  Play,
  Pause,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Zap,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, subMonths, setDate, getDate, addMonths, parseISO, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Função para calcular período do ciclo (26 a 25) - retorna início, fim completo e fim até hoje
const calcularPeriodoCiclo = () => {
  const hoje = new Date();
  const diaAtual = getDate(hoje);
  
  let inicio: Date;
  let fimCiclo: Date;
  
  if (diaAtual >= 26) {
    inicio = setDate(hoje, 26);
    fimCiclo = setDate(addMonths(hoje, 1), 25);
  } else {
    inicio = setDate(subMonths(hoje, 1), 26);
    fimCiclo = setDate(hoje, 25);
  }
  
  return {
    inicio: format(inicio, "yyyy-MM-dd"),
    fim: format(fimCiclo, "yyyy-MM-dd"),
    fimAteHoje: format(hoje, "yyyy-MM-dd"), // Até o dia atual
  };
};

interface TipoIntervalo {
  id: string;
  codigo: string;
  nome: string;
  tempo_minutos: number;
  tipo: "padrao" | "nao_padrao";
  cor: string | null;
}

interface IntervaloAtivo {
  id: string;
  tipo_intervalo_id: string;
  hora_inicio: string;
  tipo_intervalo?: TipoIntervalo;
}

export default function AppHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth, turno, encerrarTurno, temTurnoAberto, logout } = useEquipeAuth();
  const { equipe, isLoading: isLoadingEquipe, error: equipeError } = useTecnico();
  const { isOnline } = useOfflineSyncContext();
  const { getTiposIntervaloFromCache, getProducaoFromCache, getIntervalosFromCache } = useOfflineData();
  const { iniciarIntervalo: iniciarIntervaloOffline, encerrarIntervalo: encerrarIntervaloOffline } = useOfflineOperations();
  const [greeting, setGreeting] = useState("Olá");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [kmFinal, setKmFinal] = useState("");
  const [isClosingTurno, setIsClosingTurno] = useState(false);
  
  // Estado para intervalos
  const [intervaloDialogOpen, setIntervaloDialogOpen] = useState(false);
  const [selectedIntervalo, setSelectedIntervalo] = useState<string>("");
  const [intervaloObs, setIntervaloObs] = useState("");
  const [isStartingIntervalo, setIsStartingIntervalo] = useState(false);
  const [isEndingIntervalo, setIsEndingIntervalo] = useState(false);
  
  // Estado para contador de ociosidade (usa localStorage para persistência)
  const [tempoOcioso, setTempoOcioso] = useState(0);

  // Período do ciclo atual
  const periodoCiclo = calcularPeriodoCiclo();
  const dataHoje = format(new Date(), "yyyy-MM-dd");

  // Definir saudação baseada na hora
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Bom dia");
    else if (hour < 18) setGreeting("Boa tarde");
    else setGreeting("Boa noite");
  }, []);

  // Buscar tipos de intervalo (com fallback para cache offline)
  const { data: tiposIntervalo } = useQuery({
    queryKey: ["tipos-intervalo"],
    queryFn: async () => {
      // Se offline, tentar usar cache
      if (!isOnline) {
        const cached = await getTiposIntervaloFromCache();
        if (cached && Array.isArray(cached)) {
          console.log("[AppHome] Usando tipos de intervalo do cache:", cached.length);
          return cached as TipoIntervalo[];
        }
        return [];
      }

      const { data, error } = await supabase
        .from("tipos_intervalo")
        .select("*")
        .eq("ativo", true)
        .order("tipo", { ascending: false }) // Padrão primeiro
        .order("nome");
      
      if (error) throw error;
      return (data || []) as TipoIntervalo[];
    },
  });

  // Buscar intervalo ativo (não finalizado)
  const { data: intervaloAtivo, refetch: refetchIntervalo } = useQuery({
    queryKey: ["intervalo-ativo", equipe?.id, turno?.id],
    queryFn: async () => {
      if (!equipe?.id) return null;
      
      // Se offline, buscar do cache
      if (!isOnline) {
        const intervalosCached = await getIntervalosFromCache(equipe.id, dataHoje);
        if (intervalosCached && Array.isArray(intervalosCached)) {
          // Buscar intervalo ativo (sem hora_fim)
          const intervaloAtivoCache = intervalosCached.find((i: any) => !i.hora_fim);
          if (intervaloAtivoCache) {
            // Adicionar dados do tipo de intervalo do cache
            const tiposIntervaloCache = await getTiposIntervaloFromCache();
            if (tiposIntervaloCache && Array.isArray(tiposIntervaloCache)) {
              const tipoIntervalo = tiposIntervaloCache.find((t: any) => t.id === intervaloAtivoCache.tipo_intervalo_id);
              return { ...intervaloAtivoCache, tipo_intervalo: tipoIntervalo } as IntervaloAtivo;
            }
            return intervaloAtivoCache as IntervaloAtivo;
          }
        }
        return null;
      }
      
      const { data, error } = await supabase
        .from("intervalos_equipe")
        .select(`
          *,
          tipo_intervalo:tipo_intervalo_id (*)
        `)
        .eq("equipe_id", equipe.id)
        .is("hora_fim", null)
        .order("hora_inicio", { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as IntervaloAtivo | null;
    },
    enabled: !!equipe?.id,
    refetchInterval: isOnline ? 30000 : false, // Não atualizar automaticamente quando offline
  });

  // Buscar todos os intervalos do turno atual
  const { data: intervalosTurno, refetch: refetchIntervalosTurno } = useQuery({
    queryKey: ["intervalos-turno", equipe?.id, turno?.id, dataHoje],
    queryFn: async () => {
      if (!equipe?.id) return [];
      
      // Se offline, buscar do cache
      if (!isOnline) {
        const intervalosCached = await getIntervalosFromCache(equipe.id, dataHoje);
        if (intervalosCached && Array.isArray(intervalosCached)) {
          // Adicionar dados do tipo de intervalo do cache
          const tiposIntervaloCache = await getTiposIntervaloFromCache();
          return intervalosCached.map((i: any) => {
            if (tiposIntervaloCache && Array.isArray(tiposIntervaloCache)) {
              const tipoIntervalo = tiposIntervaloCache.find((t: any) => t.id === i.tipo_intervalo_id);
              return { ...i, tipo_intervalo: tipoIntervalo };
            }
            return i;
          }).sort((a: any, b: any) => new Date(b.hora_inicio).getTime() - new Date(a.hora_inicio).getTime());
        }
        return [];
      }
      
      // Buscar do turno atual se tiver, senão do dia
      const query = supabase
        .from("intervalos_equipe")
        .select(`
          *,
          tipo_intervalo:tipo_intervalo_id (*)
        `)
        .eq("equipe_id", equipe.id)
        .order("hora_inicio", { ascending: false });
      
      if (turno?.id) {
        query.eq("turno_id", turno.id);
      } else {
        // Fallback para buscar do dia se não tiver turno_id
        query.gte("hora_inicio", dataHoje + "T00:00:00")
             .lte("hora_inicio", dataHoje + "T23:59:59");
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!equipe?.id,
    refetchInterval: isOnline ? 30000 : false,
  });

  // Buscar produção do dia
  const { data: producaoHoje, refetch: refetchProducao } = useQuery({
    queryKey: ["producao-hoje", equipe?.id, dataHoje],
    queryFn: async () => {
      if (!equipe?.id) return { valor: 0, quantidade: 0 };
      
      // Se offline, buscar do cache
      if (!isOnline) {
        const producaoCached = await getProducaoFromCache(equipe.id, dataHoje);
        if (producaoCached && Array.isArray(producaoCached)) {
          const valor = producaoCached.reduce((acc: number, p: any) => acc + (p.valor_total || 0), 0);
          return { valor, quantidade: producaoCached.length };
        }
        return { valor: 0, quantidade: 0 };
      }
      
      const { data, error } = await supabase
        .from("producao_equipes")
        .select("valor_total")
        .eq("equipe_id", equipe.id)
        .gte("created_at", dataHoje + "T00:00:00")
        .lte("created_at", dataHoje + "T23:59:59");
      
      if (error) throw error;
      
      const valor = (data || []).reduce((acc, p) => acc + (p.valor_total || 0), 0);
      return { valor, quantidade: data?.length || 0 };
    },
    enabled: !!equipe?.id,
    refetchInterval: isOnline ? 30000 : false,
  });

  // Buscar meta do dia
  const { data: metaHoje } = useQuery({
    queryKey: ["meta-hoje", equipe?.id, dataHoje],
    queryFn: async () => {
      if (!equipe?.id) return 0;
      
      const { data, error } = await supabase
        .from("metas")
        .select("valor_meta")
        .eq("equipe_id", equipe.id)
        .eq("data", dataHoje)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data?.valor_meta || 0;
    },
    enabled: !!equipe?.id,
  });

  // Verificar se há OS em andamento (bloqueia início de intervalo)
  const { data: osEmAndamento } = useQuery({
    queryKey: ["os-em-andamento", equipe?.id, dataHoje],
    queryFn: async () => {
      if (!equipe?.id) return null;
      
      // Buscar OS que estão em andamento para esta equipe
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          ordem_servico_id,
          ordens_servico:ordem_servico_id (id, numero, status, tipo)
        `)
        .eq("equipe_id", equipe.id)
        .in("ordens_servico.status", ["em_deslocamento", "no_local", "em_andamento", "em_execucao"]);
      
      if (error) return null;
      
      // Filtrar apenas as que realmente estão em andamento
      const osAtivas = data?.filter(d => d.ordens_servico?.status) || [];
      return osAtivas.length > 0 ? osAtivas[0].ordens_servico : null;
    },
    enabled: !!equipe?.id,
    refetchInterval: 10000,
  });

  // Verificar se equipe está ociosa (turno aberto, sem OS em andamento, sem intervalo)
  const estaOcioso = useMemo(() => {
    return temTurnoAberto && !intervaloAtivo && !osEmAndamento;
  }, [temTurnoAberto, intervaloAtivo, osEmAndamento]);

  // Chave para localStorage do início da ociosidade (inclui turno_id para ser único por turno)
  const OCIOSIDADE_KEY = turno?.id ? `ociosidade_inicio_${equipe?.id}_${turno.id}` : null;

  // Limpar ociosidade de turnos antigos quando um novo turno é aberto
  useEffect(() => {
    if (!equipe?.id) return;
    
    // Limpar todas as chaves de ociosidade antigas da equipe
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`ociosidade_inicio_${equipe.id}_`) && key !== OCIOSIDADE_KEY) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }, [equipe?.id, OCIOSIDADE_KEY]);

  // Gerenciar início da ociosidade com localStorage (persistente entre telas)
  // Só inicia a contagem quando há turno aberto (temTurnoAberto) e temos turno_id
  useEffect(() => {
    if (!equipe?.id || !temTurnoAberto || !OCIOSIDADE_KEY) return;
    
    if (estaOcioso) {
      // Verificar se já tem um início salvo para este turno
      const inicioSalvo = localStorage.getItem(OCIOSIDADE_KEY);
      if (!inicioSalvo) {
        localStorage.setItem(OCIOSIDADE_KEY, new Date().toISOString());
      }
    } else {
      localStorage.removeItem(OCIOSIDADE_KEY);
      setTempoOcioso(0);
    }
  }, [estaOcioso, equipe?.id, temTurnoAberto, OCIOSIDADE_KEY]);

  // Atualizar contador de ociosidade a cada segundo (lê do localStorage)
  // Só começa a mostrar após 1 minuto (60 segundos) de ociosidade
  useEffect(() => {
    if (!estaOcioso || !equipe?.id || !temTurnoAberto || !OCIOSIDADE_KEY) return;
    
    const atualizarTempo = () => {
      const inicioSalvo = localStorage.getItem(OCIOSIDADE_KEY);
      if (inicioSalvo) {
        const inicio = new Date(inicioSalvo);
        const agora = new Date();
        const diffMs = agora.getTime() - inicio.getTime();
        const segundos = Math.floor(diffMs / 1000);
        // Só atualiza se passou de 60 segundos (1 minuto)
        if (segundos >= 60) {
          setTempoOcioso(segundos - 60); // Conta a partir do primeiro minuto
        } else {
          setTempoOcioso(0);
        }
      }
    };
    
    atualizarTempo();
    const interval = setInterval(atualizarTempo, 1000);
    
    return () => clearInterval(interval);
  }, [estaOcioso, equipe?.id, temTurnoAberto, OCIOSIDADE_KEY]);

  // Limpar ociosidade quando o turno é encerrado
  useEffect(() => {
    if (!temTurnoAberto && OCIOSIDADE_KEY) {
      localStorage.removeItem(OCIOSIDADE_KEY);
      setTempoOcioso(0);
    }
  }, [temTurnoAberto, OCIOSIDADE_KEY]);

  // Formatar tempo de ociosidade
  const formatarTempoOcioso = (segundos: number) => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    
    if (horas > 0) {
      return `${horas}h ${minutos.toString().padStart(2, '0')}m ${segs.toString().padStart(2, '0')}s`;
    } else if (minutos > 0) {
      return `${minutos}m ${segs.toString().padStart(2, '0')}s`;
    }
    return `${segs}s`;
  };

  // Buscar produção e meta do ciclo (até hoje)
  const { data: producaoCiclo } = useQuery({
    queryKey: ["producao-ciclo", equipe?.id, periodoCiclo.inicio, periodoCiclo.fimAteHoje],
    queryFn: async () => {
      if (!equipe?.id) return { valor: 0, meta: 0 };
      
      const [prodRes, metaRes] = await Promise.all([
        supabase
          .from("producao_equipes")
          .select("valor_total")
          .eq("equipe_id", equipe.id)
          .gte("created_at", periodoCiclo.inicio + "T00:00:00")
          .lte("created_at", periodoCiclo.fimAteHoje + "T23:59:59"),
        supabase
          .from("metas")
          .select("valor_meta")
          .eq("equipe_id", equipe.id)
          .gte("data", periodoCiclo.inicio)
          .lte("data", periodoCiclo.fimAteHoje),
      ]);
      
      const valor = (prodRes.data || []).reduce((acc, p) => acc + (p.valor_total || 0), 0);
      const meta = (metaRes.data || []).reduce((acc, m) => acc + (m.valor_meta || 0), 0);
      
      return { valor, meta };
    },
    enabled: !!equipe?.id,
  });

  // Intervalo padrão separado do não padrão
  const intervalosPadrao = useMemo(() => 
    tiposIntervalo?.filter(i => i.tipo === "padrao") || [], 
    [tiposIntervalo]
  );
  const intervalosNaoPadrao = useMemo(() => 
    tiposIntervalo?.filter(i => i.tipo === "nao_padrao") || [], 
    [tiposIntervalo]
  );

  // Calcular % do dia e ciclo
  const percentualDia = metaHoje && metaHoje > 0 
    ? Math.min((producaoHoje?.valor || 0) / metaHoje * 100, 150) 
    : 0;
  
  const percentualCiclo = producaoCiclo?.meta && producaoCiclo.meta > 0 
    ? Math.min(producaoCiclo.valor / producaoCiclo.meta * 100, 150) 
    : 0;

  // Gerar nome para saudação
  const getUserName = () => {
    if (turno?.colaboradores && turno.colaboradores.length > 0) {
      const nomes = turno.colaboradores
        .slice(0, 2)
        .map(c => c.nome.split(" ")[0])
        .join(" e ");
      return nomes;
    }
    return equipe?.nome?.split("/")[0]?.trim() || equipeAuth?.nome?.split("/")[0]?.trim() || "Equipe";
  };
  const userName = getUserName();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Funções de intervalo
  const handleIniciarIntervalo = async () => {
    if (!selectedIntervalo || !equipe?.id) {
      toast.error("Selecione um tipo de intervalo");
      return;
    }
    
    // Verificar se há OS em andamento (apenas se tiver dados)
    if (osEmAndamento) {
      toast.error(`Finalize a OS ${osEmAndamento.numero || ""} antes de iniciar o intervalo!`, { duration: 4000 });
      return;
    }
    
    setIsStartingIntervalo(true);
    try {
      // Usar operação offline que funciona tanto online quanto offline
      const result = await iniciarIntervaloOffline(
        equipe.id,
        selectedIntervalo,
        turno?.id, // Passar turno_id para vincular o intervalo ao turno
        intervaloObs || undefined
      );
      
      if (result.success) {
        toast.success(result.offline ? "Intervalo iniciado (offline)!" : "Intervalo iniciado!");
        setIntervaloDialogOpen(false);
        setSelectedIntervalo("");
        setIntervaloObs("");
        refetchIntervalo();
        refetchIntervalosTurno();
      } else {
        toast.error("Erro ao iniciar intervalo");
      }
    } catch (error: any) {
      toast.error("Erro ao iniciar intervalo: " + error.message);
    } finally {
      setIsStartingIntervalo(false);
    }
  };

  const handleFinalizarIntervalo = async () => {
    if (!intervaloAtivo?.id || !equipe?.id) return;
    
    setIsEndingIntervalo(true);
    try {
      // Usar operação offline que funciona tanto online quanto offline
      const result = await encerrarIntervaloOffline(intervaloAtivo.id, equipe.id);
      
      if (result.success) {
        toast.success(result.offline ? "Intervalo finalizado (offline)!" : "Intervalo finalizado!");
        refetchIntervalo();
        refetchIntervalosTurno();
      } else {
        toast.error("Erro ao finalizar intervalo");
      }
    } catch (error: any) {
      toast.error("Erro ao finalizar intervalo: " + error.message);
    } finally {
      setIsEndingIntervalo(false);
    }
  };

  // Calcular duração do intervalo ativo
  const duracaoIntervalo = useMemo(() => {
    if (!intervaloAtivo?.hora_inicio) return "";
    const inicio = new Date(intervaloAtivo.hora_inicio);
    const agora = new Date();
    const diffMs = agora.getTime() - inicio.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const horas = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return horas > 0 ? `${horas}h ${mins}min` : `${mins}min`;
  }, [intervaloAtivo?.hora_inicio]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchProducao(), refetchIntervalo(), refetchIntervalosTurno()]);
      queryClient.invalidateQueries({ queryKey: ["producao-ciclo"] });
      queryClient.invalidateQueries({ queryKey: ["meta-hoje"] });
      toast.success("Dados atualizados!");
    } catch {
      toast.error("Erro ao atualizar dados");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFecharTurno = async () => {
    setIsClosingTurno(true);
    try {
      const km = kmFinal ? parseInt(kmFinal) : undefined;
      const result = await encerrarTurno(km);
      if (result.success) {
        toast.success("Turno encerrado com sucesso!");
        navigate("/app/login");
      } else {
        // Verificar se há OS em andamento
        if (result.osEmAndamento) {
          toast.error(result.message || "Erro ao encerrar turno", { duration: 6000 });
          // Navegar para a OS em questão
          navigate(`/app/ordens/${result.osEmAndamento.id}`);
        } else {
          toast.error(result.message || "Erro ao encerrar turno");
        }
      }
    } catch (error) {
      toast.error("Erro ao encerrar turno");
    } finally {
      setIsClosingTurno(false);
    }
  };

  // Loading state
  if (isLoadingEquipe) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  // Erro de equipe não encontrada
  if (equipeError) {
    return (
      <div className="p-4 space-y-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Equipe não vinculada</h2>
          <p className="text-muted-foreground mb-4">{equipeError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{greeting}, {userName}!</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {equipe && (
                <Badge variant="outline" className="text-xs">
                  <Route className="h-3 w-3 mr-1" />
                  {equipe.codigo}
                </Badge>
              )}
              {turno?.placa_veiculo && (
                <Badge variant="secondary" className="text-xs">
                  <Car className="h-3 w-3 mr-1" />
                  {turno.placa_veiculo}
                </Badge>
              )}
            </div>
          </div>
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

      {/* Conteúdo principal */}
      <div className="flex-1 p-4 space-y-4 pb-24">
        
        {/* Card de Produção do Dia - Destaque Principal */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className={cn(
            "p-5",
            percentualDia >= 100 
              ? "bg-gradient-to-br from-green-500 to-emerald-600"
              : percentualDia >= 70
                ? "bg-gradient-to-br from-amber-500 to-orange-600"
                : "bg-gradient-to-br from-primary to-blue-600"
          )}>
            <div className="flex items-center justify-between text-white mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <span className="font-medium">Produção Hoje</span>
              </div>
              {percentualDia >= 100 && <CheckCircle2 className="h-6 w-6" />}
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-bold text-white">
                {formatCurrency(producaoHoje?.valor || 0)}
              </div>
              {metaHoje > 0 && (
                <div className="mt-2">
                  <div className="text-white/80 text-sm">
                    Meta: {formatCurrency(metaHoje)}
                  </div>
                  <div className="mt-2 bg-white/20 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-white transition-all duration-500"
                      style={{ width: `${Math.min(percentualDia, 100)}%` }}
                    />
                  </div>
                  <div className="text-white font-semibold text-lg mt-1">
                    {percentualDia.toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Card de Ociosidade - Contador com destaque - só mostra após 1 minuto */}
        {estaOcioso && tempoOcioso > 0 && (
          <Card className={cn(
            "overflow-hidden border-0 shadow-md transition-all",
            tempoOcioso > 300 
              ? "bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 border border-red-500/30"
              : "bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/30"
          )}>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center relative",
                    tempoOcioso > 300 ? "bg-red-500/20" : "bg-amber-500/20"
                  )}>
                    <Timer className={cn(
                      "h-6 w-6",
                      tempoOcioso > 300 ? "text-red-600" : "text-amber-600"
                    )} />
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                      <span className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        tempoOcioso > 300 ? "bg-red-500" : "bg-amber-500"
                      )}></span>
                      <span className={cn(
                        "relative inline-flex rounded-full h-3 w-3",
                        tempoOcioso > 300 ? "bg-red-600" : "bg-amber-600"
                      )}></span>
                    </span>
                  </div>
                  <div>
                    <p className={cn(
                      "font-semibold",
                      tempoOcioso > 300 ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                    )}>
                      Equipe Ociosa
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Inicie uma OS ou intervalo
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-2xl font-bold tabular-nums",
                    tempoOcioso > 300 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                  )}>
                    {formatarTempoOcioso(tempoOcioso)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">tempo ocioso</p>
                </div>
              </div>
              {tempoOcioso > 300 && (
                <div className="mt-3 pt-3 border-t border-red-500/20">
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <Zap className="h-3 w-3" />
                    <span>Atenção: mais de 5 minutos sem atividade</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Controle de Intervalo */}
        <Card className={cn(
          "p-4",
          intervaloAtivo 
            ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30"
            : ""
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                intervaloAtivo 
                  ? "bg-amber-500/20" 
                  : "bg-muted"
              )}>
                {intervaloAtivo ? (
                  <Pause className="h-5 w-5 text-amber-600" />
                ) : (
                  <Coffee className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                {intervaloAtivo ? (
                  <>
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      Em Intervalo: {intervaloAtivo.tipo_intervalo?.nome || ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Iniciado às {format(new Date(intervaloAtivo.hora_inicio), "HH:mm")} • {duracaoIntervalo}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Intervalo</p>
                    <p className="text-xs text-muted-foreground">
                      Registre pausas e intervalos
                    </p>
                  </>
                )}
              </div>
            </div>
            
            {intervaloAtivo ? (
              <Button 
                onClick={handleFinalizarIntervalo}
                disabled={isEndingIntervalo}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isEndingIntervalo ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Retomar
              </Button>
            ) : (
              <Button 
                variant="outline"
                onClick={() => setIntervaloDialogOpen(true)}
              >
                <Coffee className="h-4 w-4 mr-2" />
                Iniciar
              </Button>
            )}
          </div>
        </Card>

        {/* Card do Turno */}
        {temTurnoAberto && turno && (
          <Card className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Turno ativo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {turno.colaboradores?.length || 0} colaborador(es) • Início: {format(new Date(turno.hora_inicio), "HH:mm")}
                  </p>
                </div>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
                    <Power className="h-4 w-4 mr-1" />
                    Encerrar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Encerrar Turno</AlertDialogTitle>
                    <AlertDialogDescription>
                      Confirma o encerramento do turno?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <Label htmlFor="kmFinal">KM Final (opcional)</Label>
                    <Input
                      id="kmFinal"
                      type="number"
                      placeholder="Ex: 45890"
                      value={kmFinal}
                      onChange={(e) => setKmFinal(e.target.value)}
                      className="mt-2"
                    />
                    {turno.km_inicial && (
                      <p className="text-xs text-muted-foreground mt-2">
                        KM inicial: {turno.km_inicial}
                      </p>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleFecharTurno}
                      disabled={isClosingTurno}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isClosingTurno ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Encerrar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        )}

      </div>

      {/* Dialog de Intervalo */}
      <Dialog open={intervaloDialogOpen} onOpenChange={setIntervaloDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar Intervalo</DialogTitle>
            <DialogDescription>
              Selecione o tipo de intervalo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Intervalos Padrão */}
            {intervalosPadrao.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Intervalos Padrão
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {intervalosPadrao.map(tipo => (
                    <Button
                      key={tipo.id}
                      variant={selectedIntervalo === tipo.id ? "default" : "outline"}
                      className={cn(
                        "h-auto py-3 flex-col",
                        selectedIntervalo === tipo.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedIntervalo(tipo.id)}
                    >
                      <Coffee className="h-5 w-5 mb-1" style={{ color: tipo.cor || undefined }} />
                      <span className="text-sm">{tipo.nome}</span>
                      {tipo.tempo_minutos > 0 && (
                        <span className="text-[10px] text-muted-foreground">{tipo.tempo_minutos} min</span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Intervalos Não Padrão */}
            {intervalosNaoPadrao.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-amber-500" />
                  Intervalos de Exceção
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {intervalosNaoPadrao.map(tipo => (
                    <Button
                      key={tipo.id}
                      variant={selectedIntervalo === tipo.id ? "default" : "outline"}
                      className={cn(
                        "h-auto py-3 flex-col border-dashed",
                        selectedIntervalo === tipo.id && "ring-2 ring-amber-500 border-solid"
                      )}
                      onClick={() => setSelectedIntervalo(tipo.id)}
                    >
                      <Wrench className="h-5 w-5 mb-1" style={{ color: tipo.cor || undefined }} />
                      <span className="text-sm">{tipo.nome}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Observação */}
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                placeholder="Descreva o motivo se necessário..."
                value={intervaloObs}
                onChange={(e) => setIntervaloObs(e.target.value)}
                rows={2}
              />
            </div>

            {/* Histórico de intervalos do turno */}
            {intervalosTurno && intervalosTurno.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Intervalos do Turno ({intervalosTurno.length})
                </p>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {intervalosTurno.map((intervalo: any) => {
                    const duracao = intervalo.hora_fim 
                      ? differenceInMinutes(parseISO(intervalo.hora_fim), parseISO(intervalo.hora_inicio))
                      : null;
                    const emAndamento = !intervalo.hora_fim;
                    
                    return (
                      <div 
                        key={intervalo.id} 
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg border text-sm",
                          emAndamento ? "bg-amber-50 border-amber-200" : "bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-2 w-2 rounded-full" 
                            style={{ backgroundColor: intervalo.tipo_intervalo?.cor || "#888" }}
                          />
                          <div>
                            <p className="font-medium text-xs">
                              {intervalo.tipo_intervalo?.nome || "Intervalo"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(parseISO(intervalo.hora_inicio), "HH:mm")}
                              {intervalo.hora_fim && ` - ${format(parseISO(intervalo.hora_fim), "HH:mm")}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {emAndamento ? (
                            <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-medium">
                              Em andamento
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {duracao}min
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Total de tempo em intervalos */}
                <div className="mt-2 pt-2 border-t flex justify-between text-xs text-muted-foreground">
                  <span>Tempo total:</span>
                  <span className="font-medium">
                    {Math.floor(intervalosTurno.reduce((acc: number, i: any) => {
                      if (i.hora_fim) {
                        return acc + differenceInMinutes(parseISO(i.hora_fim), parseISO(i.hora_inicio));
                      }
                      return acc;
                    }, 0) / 60)}h {intervalosTurno.reduce((acc: number, i: any) => {
                      if (i.hora_fim) {
                        return acc + differenceInMinutes(parseISO(i.hora_fim), parseISO(i.hora_inicio));
                      }
                      return acc;
                    }, 0) % 60}min
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIntervaloDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleIniciarIntervalo}
              disabled={!selectedIntervalo || isStartingIntervalo}
            >
              {isStartingIntervalo ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Pause className="h-4 w-4 mr-2" />
              )}
              Iniciar Intervalo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
