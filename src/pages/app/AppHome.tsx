import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
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
import { format, subMonths, setDate, getDate, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Função para calcular período do ciclo (26 a 25)
const calcularPeriodoCiclo = () => {
  const hoje = new Date();
  const diaAtual = getDate(hoje);
  
  let inicio: Date;
  let fim: Date;
  
  if (diaAtual >= 26) {
    inicio = setDate(hoje, 26);
    fim = setDate(addMonths(hoje, 1), 25);
  } else {
    inicio = setDate(subMonths(hoje, 1), 26);
    fim = setDate(hoje, 25);
  }
  
  return {
    inicio: format(inicio, "yyyy-MM-dd"),
    fim: format(fim, "yyyy-MM-dd"),
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

  // Buscar tipos de intervalo
  const { data: tiposIntervalo } = useQuery({
    queryKey: ["tipos-intervalo"],
    queryFn: async () => {
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
    refetchInterval: 30000,
  });

  // Buscar produção do dia
  const { data: producaoHoje, refetch: refetchProducao } = useQuery({
    queryKey: ["producao-hoje", equipe?.id, dataHoje],
    queryFn: async () => {
      if (!equipe?.id) return { valor: 0, quantidade: 0 };
      
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
    refetchInterval: 30000,
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

  // Buscar produção e meta do ciclo
  const { data: producaoCiclo } = useQuery({
    queryKey: ["producao-ciclo", equipe?.id, periodoCiclo.inicio, periodoCiclo.fim],
    queryFn: async () => {
      if (!equipe?.id) return { valor: 0, meta: 0 };
      
      const [prodRes, metaRes] = await Promise.all([
        supabase
          .from("producao_equipes")
          .select("valor_total")
          .eq("equipe_id", equipe.id)
          .gte("created_at", periodoCiclo.inicio + "T00:00:00")
          .lte("created_at", periodoCiclo.fim + "T23:59:59"),
        supabase
          .from("metas")
          .select("valor_meta")
          .eq("equipe_id", equipe.id)
          .gte("data", periodoCiclo.inicio)
          .lte("data", periodoCiclo.fim),
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
    
    setIsStartingIntervalo(true);
    try {
      const { error } = await supabase
        .from("intervalos_equipe")
        .insert({
          equipe_id: equipe.id,
          turno_id: turno?.id || null,
          tipo_intervalo_id: selectedIntervalo,
          hora_inicio: new Date().toISOString(),
          observacao: intervaloObs || null,
        });
      
      if (error) throw error;
      
      toast.success("Intervalo iniciado!");
      setIntervaloDialogOpen(false);
      setSelectedIntervalo("");
      setIntervaloObs("");
      refetchIntervalo();
    } catch (error: any) {
      toast.error("Erro ao iniciar intervalo: " + error.message);
    } finally {
      setIsStartingIntervalo(false);
    }
  };

  const handleFinalizarIntervalo = async () => {
    if (!intervaloAtivo?.id) return;
    
    setIsEndingIntervalo(true);
    try {
      const { error } = await supabase
        .from("intervalos_equipe")
        .update({ hora_fim: new Date().toISOString() })
        .eq("id", intervaloAtivo.id);
      
      if (error) throw error;
      
      toast.success("Intervalo finalizado!");
      refetchIntervalo();
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
      await Promise.all([refetchProducao(), refetchIntervalo()]);
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

        {/* Card Ciclo Resumido */}
        <Card className="p-4 bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ciclo {format(parseISO(periodoCiclo.inicio), "dd/MM")} - {format(parseISO(periodoCiclo.fim), "dd/MM")}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Produzido</p>
                <p className="font-bold text-sm">{formatCurrency(producaoCiclo?.valor || 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Meta</p>
                <p className="font-medium text-sm">{formatCurrency(producaoCiclo?.meta || 0)}</p>
              </div>
              <Badge variant={percentualCiclo >= 100 ? "default" : "outline"} className={cn(
                "text-sm",
                percentualCiclo >= 100 ? "bg-green-500" : ""
              )}>
                {percentualCiclo.toFixed(0)}%
              </Badge>
            </div>
          </div>
        </Card>

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

        {/* Botão Ver Rota do Dia */}
        <Button
          className="w-full h-12 text-base"
          onClick={() => navigate("/app/ordens")}
        >
          <Route className="h-5 w-5 mr-2" />
          Ver Rota do Dia
          <ChevronRight className="h-5 w-5 ml-auto" />
        </Button>
      </div>

      {/* Rodapé fixo com botão de sair */}
      <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-background via-background to-transparent pt-6">
        <Button 
          variant="outline" 
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair do Aplicativo
        </Button>
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
