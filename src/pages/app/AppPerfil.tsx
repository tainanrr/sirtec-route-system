import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, 
  Mail, 
  Shield, 
  Smartphone, 
  Route,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  Phone,
  Wrench,
  RefreshCw,
  Loader2
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePageState } from "@/contexts/ScrollRestoreContext";

export default function AppPerfil() {
  const { equipe: equipeAuth, logout } = useEquipeAuth();
  const { equipe, isLoading: isLoadingEquipe, refetch: refetchEquipe } = useTecnico();
  const { getState, saveState } = usePageState<{ isRefreshing?: boolean }>("app-perfil");
  const initialState = getState();
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initialState?.isRefreshing));

  // Persistir UI desta tela
  useEffect(() => {
    const t = window.setTimeout(() => {
      saveState({ isRefreshing });
    }, 300);
    return () => window.clearTimeout(t);
  }, [isRefreshing, saveState]);

  // Buscar estatísticas do mês
  const { data: estatisticas, isLoading: isLoadingStats, refetch: refetchStats } = useQuery({
    queryKey: ["estatisticas-tecnico", equipe?.id],
    queryFn: async () => {
      if (!equipe?.id) return null;

      const inicioMes = startOfMonth(new Date());
      const fimMes = endOfMonth(new Date());

      // Buscar ordens concluídas no mês
      const { data: ordensConcluidasData, error: ordensError } = await supabase
        .from("planejamento_ordens")
        .select(`
          id,
          ordens_servico:ordem_servico_id (
            id,
            status,
            concluido_at,
            tempo_total_minutos,
            valor
          )
        `)
        .eq("equipe_id", equipe.id)
        .gte("created_at", inicioMes.toISOString())
        .lte("created_at", fimMes.toISOString());

      if (ordensError) {
        console.error("Erro ao buscar estatísticas:", ordensError);
        return null;
      }

      const ordensConcluidas = ordensConcluidasData?.filter(
        (o) => o.ordens_servico?.status === "concluida"
      ) || [];

      const totalOrdens = ordensConcluidasData?.length || 0;
      const totalConcluidas = ordensConcluidas.length;
      const tempoTotal = ordensConcluidas.reduce(
        (acc, o) => acc + (o.ordens_servico?.tempo_total_minutos || 0),
        0
      );
      const valorTotal = ordensConcluidas.reduce(
        (acc, o) => acc + (o.ordens_servico?.valor || 0),
        0
      );

      // Buscar ordens de hoje
      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const fimHoje = new Date(inicioHoje);
      fimHoje.setDate(fimHoje.getDate() + 1);

      const { data: ordensHojeData } = await supabase
        .from("planejamento_ordens")
        .select(`
          id,
          ordens_servico:ordem_servico_id (
            id,
            status
          ),
          planejamentos!inner (
            data_planejamento
          )
        `)
        .eq("equipe_id", equipe.id)
        .eq("planejamentos.data_planejamento", format(hoje, "yyyy-MM-dd"));

      const ordensHoje = ordensHojeData?.length || 0;
      const concluidasHoje = ordensHojeData?.filter(
        (o) => o.ordens_servico?.status === "concluida"
      ).length || 0;

      return {
        totalOrdens,
        totalConcluidas,
        tempoTotalMinutos: tempoTotal,
        valorTotal,
        ordensHoje,
        concluidasHoje,
        taxaConclusao: totalOrdens > 0 ? Math.round((totalConcluidas / totalOrdens) * 100) : 0,
      };
    },
    enabled: !!equipe?.id,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchEquipe(), refetchStats()]);
      toast.success("Dados atualizados!");
    } catch {
      toast.error("Erro ao atualizar dados");
    } finally {
      setIsRefreshing(false);
    }
  };

  const userName = equipe?.nome || equipeAuth?.nome || "Equipe";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (isLoadingEquipe) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex flex-col items-center">
          <Skeleton className="h-24 w-24 rounded-full mb-4" />
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Avatar e Nome */}
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-lg">
            {userInitials}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background shadow"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <h1 className="text-xl font-bold mt-4">{userName}</h1>
        <p className="text-muted-foreground text-sm">{equipeAuth?.usuario || equipe?.usuario || ""}</p>
        
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            Técnico de Campo
          </Badge>
          {equipe && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Route className="h-3 w-3" />
              {equipe.codigo}
            </Badge>
          )}
        </div>
      </div>

      {/* Estatísticas Rápidas */}
      {estatisticas && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-600">{estatisticas.concluidasHoje}</p>
              <p className="text-xs text-muted-foreground">Concluídas Hoje</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-4 text-center">
              <Calendar className="h-6 w-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-600">{estatisticas.ordensHoje}</p>
              <p className="text-xs text-muted-foreground">Total Hoje</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Estatísticas do Mês */}
      {estatisticas && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Desempenho - {format(new Date(), "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Ordens Concluídas
              </span>
              <span className="font-semibold">{estatisticas.totalConcluidas}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Award className="h-4 w-4" />
                Taxa de Conclusão
              </span>
              <span className="font-semibold text-green-600">{estatisticas.taxaConclusao}%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tempo Total Trabalhado
              </span>
              <span className="font-semibold">
                {Math.floor(estatisticas.tempoTotalMinutos / 60)}h {estatisticas.tempoTotalMinutos % 60}min
              </span>
            </div>
            
            {estatisticas.valorTotal > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Faturamento Gerado</span>
                <span className="font-semibold text-green-600">
                  R$ {estatisticas.valorTotal.toFixed(2)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações da Equipe */}
      {equipe && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="h-4 w-4" />
              Minha Equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Route className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Código</p>
                <p className="font-medium font-mono">{equipe.codigo}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{equipe.nome}</p>
              </div>
            </div>

            {equipe.telefone && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{equipe.telefone}</p>
                </div>
              </div>
            )}

            {equipe.habilidades && equipe.habilidades.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-2">Habilidades</p>
                <div className="flex flex-wrap gap-1">
                  {equipe.habilidades.map((hab) => (
                    <Badge key={hab} variant="secondary" className="text-xs">
                      {hab}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações da Conta */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Informações da Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p className="font-medium text-sm">{equipeAuth?.usuario || equipe?.usuario || ""}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ID do Usuário</p>
              <p className="font-mono text-xs truncate max-w-[200px]">{equipe?.id || equipeAuth?.id || ""}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instalação PWA */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Instalar Aplicativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Instale o app na tela inicial do seu celular para acesso rápido e melhor experiência.
          </p>
          <div className="text-sm space-y-2 bg-background/50 p-3 rounded-lg">
            <p><strong>iPhone:</strong> Toque em "Compartilhar" - "Adicionar à Tela de Início"</p>
            <p><strong>Android:</strong> Menu - "Instalar app" ou "Adicionar à tela inicial"</p>
          </div>
        </CardContent>
      </Card>

      {/* Versão e Logout */}
      <div className="space-y-4">
        <Button 
          variant="outline" 
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          Sair da Conta
        </Button>
        
        <div className="text-center text-xs text-muted-foreground">
          <p>SirtecRoute App v1.0.0</p>
          <p className="mt-1">© {new Date().getFullYear()} - Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
}
