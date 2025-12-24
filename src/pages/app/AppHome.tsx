import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { usePageState } from "@/contexts/ScrollRestoreContext";
import { useSyncProcedimentos } from "@/hooks/useSyncProcedimentos";
import { formatCacheSize } from "@/hooks/useOfflineCache";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, 
  Clock, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  PlayCircle,
  Navigation,
  RefreshCw,
  Calendar,
  Route,
  Timer,
  AlertTriangle,
  Loader2,
  Power,
  Users,
  Car,
  BookOpen,
  CloudOff,
  Download,
  Check,
  HardDrive,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
  ordens_servico: {
    id: string;
    numero: string;
    tipo: string;
    endereco: string;
    cliente_nome: string | null;
    status: string;
    prazo: string | null;
    regulada: boolean | null;
    latitude: number | null;
    longitude: number | null;
    observacoes: string | null;
    instalacao: string | null;
    medidor: string | null;
  } | null;
}

export default function AppHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth, turno, encerrarTurno, temTurnoAberto } = useEquipeAuth();
  const { equipe, isLoading: isLoadingEquipe, error: equipeError } = useTecnico();
  const { getState, saveState } = usePageState<{ isRefreshing?: boolean }>("app-home");
  const initialState = getState();
  const [greeting, setGreeting] = useState("Olá");
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initialState?.isRefreshing));
  const [kmFinal, setKmFinal] = useState("");
  const [isClosingTurno, setIsClosingTurno] = useState(false);

  // Sincronização automática de procedimentos
  const { status: syncStatus, startAutoSync, isSupported: syncSupported } = useSyncProcedimentos(
    equipe?.contrato_id || equipeAuth?.contrato_id
  );

  // Iniciar sincronização automática quando a equipe estiver carregada
  useEffect(() => {
    if ((equipe?.id || equipeAuth?.id) && syncSupported) {
      console.log("[SYNC] Iniciando sincronização automática de procedimentos...");
      const cleanup = startAutoSync();
      return cleanup;
    }
  }, [equipe?.id, equipeAuth?.id, syncSupported, startAutoSync]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveState({ isRefreshing });
    }, 300);
    return () => window.clearTimeout(t);
  }, [isRefreshing, saveState]);

  // Definir saudação baseada na hora
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Bom dia");
    else if (hour < 18) setGreeting("Boa tarde");
    else setGreeting("Boa noite");
  }, []);

  // Buscar ordens planejadas para hoje para a equipe do técnico
  const { data: ordensPlanejadas, isLoading: isLoadingOrdens, refetch } = useQuery({
    queryKey: ["ordens-planejadas-hoje", equipe?.id, equipeAuth?.id],
    queryFn: async () => {
      const equipeId = equipe?.id || equipeAuth?.id;
      if (!equipeId) {
        console.log("[DEBUG AppHome] Nenhuma equipe encontrada");
        return [];
      }

      const hoje = new Date();
      const dataHoje = format(hoje, "yyyy-MM-dd");

      console.log("[DEBUG AppHome] Buscando ordens para equipe:", equipeId, "data:", dataHoje);

      // Primeiro, buscar todos os planejamentos de hoje para debug
      const { data: planejamentosHoje, error: errPlan } = await supabase
        .from("planejamentos")
        .select("*")
        .eq("data_planejamento", dataHoje);
      
      console.log("[DEBUG AppHome] Planejamentos de hoje:", planejamentosHoje);
      
      // Buscar todas as ordens da equipe para debug
      const { data: todasOrdens, error: errOrdens } = await supabase
        .from("planejamento_ordens")
        .select("*, planejamentos(*)")
        .eq("equipe_id", equipeId);
      
      console.log("[DEBUG AppHome] Todas ordens da equipe:", todasOrdens);

      // Buscar do planejamento_ordens
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          id,
          ordem_na_rota,
          hora_inicio_estimada,
          hora_fim_estimada,
          distancia_km,
          tempo_estimado_minutos,
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
            latitude,
            longitude,
            observacoes,
            instalacao,
            medidor
          ),
          planejamentos!inner (
            id,
            data_planejamento,
            status
          )
        `)
        .eq("equipe_id", equipeId)
        .eq("planejamentos.data_planejamento", dataHoje)
        .eq("planejamentos.status", "aberto")
        .order("ordem_na_rota", { ascending: true });

      if (error) {
        console.error("[DEBUG AppHome] Erro ao buscar ordens planejadas:", error);
        throw error;
      }

      console.log("[DEBUG AppHome] Ordens encontradas (filtradas):", data?.length || 0, data);
      return (data || []) as OrdemPlanejada[];
    },
    enabled: !!(equipe?.id || equipeAuth?.id),
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Configurar realtime subscription
  useEffect(() => {
    if (!equipe?.id) return;

    const channel = supabase
      .channel("ordens-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ordens_servico",
        },
        () => {
          // Recarregar dados quando houver mudança
          queryClient.invalidateQueries({ queryKey: ["ordens-planejadas-hoje"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [equipe?.id, queryClient]);

  // Calcular estatísticas
  const stats = {
    total: ordensPlanejadas?.length || 0,
    pendentes: ordensPlanejadas?.filter((o) => 
      o.ordens_servico?.status === "planejada" || o.ordens_servico?.status === "pendente"
    ).length || 0,
    emAndamento: ordensPlanejadas?.filter((o) => 
      o.ordens_servico?.status === "em_deslocamento" || 
      o.ordens_servico?.status === "em_andamento" ||
      o.ordens_servico?.status === "em_execucao"
    ).length || 0,
    concluidas: ordensPlanejadas?.filter((o) => 
      o.ordens_servico?.status === "concluida"
    ).length || 0,
    urgentes: ordensPlanejadas?.filter((o) => o.ordens_servico?.regulada).length || 0,
  };

  // Encontrar próxima ordem (primeira não concluída)
  const proximaOrdem = ordensPlanejadas?.find((o) => 
    o.ordens_servico?.status !== "concluida" && 
    o.ordens_servico?.status !== "cancelada"
  );

  // Calcular progresso
  const progresso = stats.total > 0 ? Math.round((stats.concluidas / stats.total) * 100) : 0;

  // Função para atualizar dados
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Dados atualizados!");
    } catch {
      toast.error("Erro ao atualizar dados");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Gerar nome para saudação baseado nos colaboradores do turno
  const getUserName = () => {
    // Se tem turno aberto com colaboradores, usar os nomes deles
    if (turno?.colaboradores && turno.colaboradores.length > 0) {
      const nomes = turno.colaboradores
        .slice(0, 2)
        .map(c => c.nome.split(" ")[0]) // Primeiro nome de cada
        .join(" e ");
      return nomes;
    }
    // Fallback para nome da equipe
    return equipe?.nome?.split("/")[0]?.trim() || equipeAuth?.nome?.split("/")[0]?.trim() || "Equipe";
  };
  const userName = getUserName();

  // Função para fechar turno
  const handleFecharTurno = async () => {
    setIsClosingTurno(true);
    try {
      const km = kmFinal ? parseInt(kmFinal) : undefined;
      const success = await encerrarTurno(km);
      if (success) {
        toast.success("Turno encerrado com sucesso!");
        navigate("/app/login");
      } else {
        toast.error("Erro ao encerrar turno");
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
      <div className="p-4 space-y-6">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-32" />
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
          <p className="text-sm text-muted-foreground">
            Entre em contato com o administrador para vincular seu usuário a uma equipe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header com Greeting e Refresh */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}, {userName}!</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {equipe && (
              <Badge variant="outline">
                <Route className="h-3 w-3 mr-1" />
                Equipe {equipe.codigo}
              </Badge>
            )}
            {turno?.placa_veiculo && (
              <Badge variant="secondary">
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

      {/* Card do Turno Aberto */}
      {temTurnoAberto && turno && (
        <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Turno em andamento
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {turno.colaboradores?.length || 0} colaborador(es) • Iniciado às {format(new Date(turno.hora_inicio), "HH:mm")}
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
                      Tem certeza que deseja encerrar o turno? Informe o KM final do veículo (opcional).
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
                        KM inicial registrado: {turno.km_inicial}
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
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Encerrando...
                        </>
                      ) : (
                        "Encerrar Turno"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barra de Progresso */}
      {stats.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso do dia</span>
            <span className="font-medium">{progresso}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-500"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {stats.concluidas} de {stats.total} ordens concluídas
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Hoje</p>
                <p className="text-3xl font-bold text-primary">{stats.total}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pendentes}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-500/40" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
                <p className="text-3xl font-bold text-blue-600">{stats.emAndamento}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-blue-500/40" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Concluídas</p>
                <p className="text-3xl font-bold text-green-600">{stats.concluidas}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Urgentes */}
      {stats.urgentes > 0 && (
        <Card className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">
                {stats.urgentes} {stats.urgentes === 1 ? "ordem urgente" : "ordens urgentes"}
              </p>
              <p className="text-xs text-muted-foreground">Priorize o atendimento</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Próxima Ordem */}
      {isLoadingOrdens ? (
        <Skeleton className="h-32" />
      ) : proximaOrdem?.ordens_servico ? (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            Próxima Ordem
          </h2>
          <Card
            className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-primary"
            onClick={() => navigate(`/app/ordens/${proximaOrdem.ordens_servico!.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      #{proximaOrdem.ordem_na_rota}
                    </Badge>
                    {proximaOrdem.ordens_servico.regulada && (
                      <Badge variant="destructive" className="text-xs">
                        URGENTE
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">
                      {proximaOrdem.ordens_servico.numero}
                    </span>
                  </div>
                  
                  <p className="font-semibold text-foreground text-lg">
                    {proximaOrdem.ordens_servico.tipo}
                  </p>
                  
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{proximaOrdem.ordens_servico.endereco}</span>
                  </div>
                  
                  {proximaOrdem.ordens_servico.cliente_nome && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Cliente: {proximaOrdem.ordens_servico.cliente_nome}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    {proximaOrdem.hora_inicio_estimada && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ETA: {proximaOrdem.hora_inicio_estimada}
                      </span>
                    )}
                    {proximaOrdem.tempo_estimado_minutos && proximaOrdem.tempo_estimado_minutos > 0 && (
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        ~{formatarTempo(proximaOrdem.tempo_estimado_minutos)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : stats.total === 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="p-6 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">Nenhuma ordem para hoje</p>
            <p className="text-sm text-muted-foreground mt-1">
              Aguarde o planejamento ou entre em contato com a central.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="font-medium text-green-700 dark:text-green-400">
              Todas as ordens concluídas! 🎉
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Excelente trabalho hoje!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Card de Procedimentos com Status de Sync */}
      <Card 
        className="cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/30 overflow-hidden"
        onClick={() => navigate("/app/procedimentos")}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg relative">
              <BookOpen className="h-6 w-6 text-white" />
              {/* Indicador de offline */}
              {syncStatus.totalCached > 0 && !syncStatus.issyncing && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center border-2 border-background">
                  <CloudOff className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Procedimentos</p>
              <div className="flex items-center gap-2 flex-wrap">
                {syncStatus.issyncing ? (
                  <span className="text-sm text-violet-600 dark:text-violet-400 flex items-center gap-1">
                    <Download className="h-3 w-3 animate-bounce" />
                    Baixando {syncStatus.progress.current}/{syncStatus.progress.total}...
                  </span>
                ) : syncStatus.totalCached > 0 ? (
                  <>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30">
                      <Check className="h-2.5 w-2.5 mr-0.5" />
                      Offline
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {syncStatus.totalCached} arquivos • {formatCacheSize(syncStatus.totalSize)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Acesse manuais e documentos
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
          
          {/* Barra de progresso durante sincronização */}
          {syncStatus.issyncing && (
            <div className="mt-3 space-y-1">
              <Progress 
                value={(syncStatus.progress.current / Math.max(syncStatus.progress.total, 1)) * 100} 
                className="h-1.5" 
              />
              {syncStatus.progress.currentFile && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {syncStatus.progress.currentFile}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ver Todas */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => navigate("/app/ordens")}
      >
        Ver todas as ordens
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}
