import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, ChevronRight, AlertCircle, CheckCircle2, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AppHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("Olá");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Bom dia");
    else if (hour < 18) setGreeting("Boa tarde");
    else setGreeting("Boa noite");
  }, []);

  const { data: ordensHoje, isLoading } = useQuery({
    queryKey: ["ordens-hoje-app"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const stats = {
    total: ordensHoje?.length || 0,
    pendentes: ordensHoje?.filter((o) => o.status === "pendente").length || 0,
    emAndamento: ordensHoje?.filter((o) => o.status === "em_andamento").length || 0,
    concluidas: ordensHoje?.filter((o) => o.status === "concluida").length || 0,
  };

  const proximaOrdem = ordensHoje?.find((o) => o.status === "pendente" || o.status === "em_andamento");

  const userName = user?.user_metadata?.nome_completo || user?.email?.split("@")[0] || "Técnico";

  return (
    <div className="p-4 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting}, {userName}!</h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Hoje</p>
                <p className="text-2xl font-bold text-primary">{stats.total}</p>
              </div>
              <ClipboardIcon className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-warning/10 border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-warning">{stats.pendentes}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-warning/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-info/10 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-info">{stats.emAndamento}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-info/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold text-success">{stats.concluidas}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próxima Ordem */}
      {proximaOrdem && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Próxima Ordem</h2>
          <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate(`/app/ordens/${proximaOrdem.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={proximaOrdem.status === "em_andamento" ? "default" : "secondary"}>
                      {proximaOrdem.status === "em_andamento" ? "Em Andamento" : "Pendente"}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {proximaOrdem.numero}
                    </span>
                  </div>
                  <p className="font-medium text-foreground">{proximaOrdem.tipo}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{proximaOrdem.endereco}</span>
                  </div>
                  {proximaOrdem.cliente_nome && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Cliente: {proximaOrdem.cliente_nome}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
