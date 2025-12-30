import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Route, LogOut, Wifi, WifiOff, Package, MessageCircle, BarChart3, Timer, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { ScrollRestoreProvider } from "@/contexts/ScrollRestoreContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isBefore, startOfDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

type AppSection = "home" | "ordens" | "estoque" | "chat" | "resultados";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, temTurnoAberto, turno } = useEquipeAuth();
  const { equipe } = useTecnico();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [chatNaoLidas, setChatNaoLidas] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Estado para contador de ociosidade
  const [tempoOcioso, setTempoOcioso] = useState(0);
  
  const dataHoje = format(new Date(), "yyyy-MM-dd");
  const [alertaTurnoFechado, setAlertaTurnoFechado] = useState(false);

  // Verificar se o turno é de um dia anterior (desatualizado)
  const turnoDesatualizado = useMemo(() => {
    if (!turno?.hora_inicio) return false;
    const dataTurno = startOfDay(parseISO(turno.hora_inicio));
    const hoje = startOfDay(new Date());
    return isBefore(dataTurno, hoje);
  }, [turno?.hora_inicio]);

  // Data do turno formatada
  const dataTurnoFormatada = useMemo(() => {
    if (!turno?.hora_inicio) return "";
    const data = parseISO(turno.hora_inicio);
    if (isToday(data)) return "hoje";
    return format(data, "dd/MM/yyyy", { locale: ptBR });
  }, [turno?.hora_inicio]);

  // Buscar intervalo ativo (não finalizado)
  const { data: intervaloAtivo } = useQuery({
    queryKey: ["intervalo-ativo-layout", equipe?.id, turno?.id],
    queryFn: async () => {
      if (!equipe?.id) return null;
      
      const { data, error } = await supabase
        .from("intervalos_equipe")
        .select("id, hora_inicio")
        .eq("equipe_id", equipe.id)
        .is("hora_fim", null)
        .order("hora_inicio", { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!equipe?.id,
    refetchInterval: 15000,
  });

  // Verificar se há OS em andamento
  const { data: osEmAndamento } = useQuery({
    queryKey: ["os-em-andamento-layout", equipe?.id, dataHoje],
    queryFn: async () => {
      if (!equipe?.id) return null;
      
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          ordem_servico_id,
          ordens_servico:ordem_servico_id (id, status)
        `)
        .eq("equipe_id", equipe.id)
        .in("ordens_servico.status", ["em_deslocamento", "no_local", "em_andamento", "em_execucao"]);
      
      if (error) return null;
      
      const osAtivas = data?.filter(d => d.ordens_servico?.status) || [];
      return osAtivas.length > 0 ? osAtivas[0].ordens_servico : null;
    },
    enabled: !!equipe?.id,
    refetchInterval: 10000,
  });

  // Verificar se equipe está ociosa
  const estaOcioso = useMemo(() => {
    return temTurnoAberto && !intervaloAtivo && !osEmAndamento;
  }, [temTurnoAberto, intervaloAtivo, osEmAndamento]);

  // Chave para localStorage do início da ociosidade
  const OCIOSIDADE_KEY = `ociosidade_inicio_${equipe?.id}`;

  // Gerenciar início da ociosidade com localStorage
  useEffect(() => {
    if (!equipe?.id) return;
    
    if (estaOcioso) {
      // Verificar se já tem um início salvo
      const inicioSalvo = localStorage.getItem(OCIOSIDADE_KEY);
      if (!inicioSalvo) {
        // Salvar início da ociosidade
        localStorage.setItem(OCIOSIDADE_KEY, new Date().toISOString());
      }
    } else {
      // Limpar início da ociosidade
      localStorage.removeItem(OCIOSIDADE_KEY);
      setTempoOcioso(0);
    }
  }, [estaOcioso, equipe?.id, OCIOSIDADE_KEY]);

  // Atualizar contador de ociosidade a cada segundo
  useEffect(() => {
    if (!estaOcioso || !equipe?.id) return;
    
    const atualizarTempo = () => {
      const inicioSalvo = localStorage.getItem(OCIOSIDADE_KEY);
      if (inicioSalvo) {
        const inicio = new Date(inicioSalvo);
        const agora = new Date();
        const diffMs = agora.getTime() - inicio.getTime();
        setTempoOcioso(Math.floor(diffMs / 1000));
      }
    };
    
    // Atualizar imediatamente
    atualizarTempo();
    
    // Atualizar a cada segundo
    const interval = setInterval(atualizarTempo, 1000);
    
    return () => clearInterval(interval);
  }, [estaOcioso, equipe?.id, OCIOSIDADE_KEY]);

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

  // Buscar mensagens não lidas do chat
  const carregarMensagensNaoLidas = useCallback(async () => {
    if (!equipe?.id) return;
    
    try {
      const { data } = await supabase
        .from("chat_conversas")
        .select("nao_lidas_equipe")
        .eq("equipe_id", equipe.id)
        .eq("status", "ativo");
      
      const total = (data || []).reduce((acc, conv) => acc + (conv.nao_lidas_equipe || 0), 0);
      setChatNaoLidas(total);
    } catch (error) {
      console.error("Erro ao carregar mensagens não lidas:", error);
    }
  }, [equipe?.id]);

  // Carregar e escutar atualizações de chat
  useEffect(() => {
    if (!equipe?.id) return;

    // Carregar inicialmente
    carregarMensagensNaoLidas();

    // Limpar canal anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Escutar novas mensagens em tempo real
    channelRef.current = supabase
      .channel(`app-chat-badge-${equipe.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_conversas",
          filter: `equipe_id=eq.${equipe.id}`
        },
        () => {
          carregarMensagensNaoLidas();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_mensagens"
        },
        () => {
          carregarMensagensNaoLidas();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [equipe?.id, carregarMensagensNaoLidas]);

  const sectionKey = (section: AppSection) => `app_last_route_${section}`;

  const getSectionFromPath = (pathname: string): AppSection | null => {
    if (pathname === "/app") return "home";
    if (pathname.startsWith("/app/ordens")) return "ordens";
    if (pathname.startsWith("/app/estoque")) return "estoque";
    if (pathname.startsWith("/app/chat")) return "chat";
    if (pathname.startsWith("/app/resultados")) return "resultados";
    return null;
  };

  const getBaseHref = (section: AppSection) => {
    switch (section) {
      case "home":
        return "/app";
      case "ordens":
        return "/app/ordens";
      case "estoque":
        return "/app/estoque";
      case "chat":
        return "/app/chat";
      case "resultados":
        return "/app/resultados";
    }
  };

  const getRememberedHref = (section: AppSection) => {
    const base = getBaseHref(section);
    try {
      const remembered = sessionStorage.getItem(sectionKey(section));
      if (remembered) {
        // Validar para não navegar para fora da seção
        if (section === "home") {
          if (remembered === "/app") return "/app";
        } else {
          if (remembered.startsWith(base)) return remembered;
        }
      }
    } catch {
      // ignore
    }
    return base;
  };

  // Monitorar status de conexão
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Memorizar a última rota visitada dentro de cada aba/seção
  useEffect(() => {
    const section = getSectionFromPath(location.pathname);
    if (!section) return;
    try {
      sessionStorage.setItem(sectionKey(section), location.pathname);
    } catch {
      // ignore
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    try {
      sessionStorage.removeItem(sectionKey("home"));
      sessionStorage.removeItem(sectionKey("ordens"));
      sessionStorage.removeItem(sectionKey("estoque"));
      sessionStorage.removeItem(sectionKey("chat"));
      sessionStorage.removeItem(sectionKey("resultados"));
    } catch {
      // ignore
    }
    navigate("/app/login");
  };

  const navItems = [
    { icon: Home, label: "Início", section: "home" as const },
    { icon: Route, label: "Rota", section: "ordens" as const },
    { icon: Package, label: "Estoque", section: "estoque" as const },
    { icon: MessageCircle, label: "Chat", section: "chat" as const },
    { icon: BarChart3, label: "Resultados", section: "resultados" as const },
  ];

  const isActive = (section: AppSection) => {
    const base = getBaseHref(section);
    if (section === "home") return location.pathname === "/app";
    return location.pathname.startsWith(base);
  };

  return (
    <ScrollRestoreProvider>
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-inner">
              <span className="text-sm font-bold">SR</span>
            </div>
            <div>
              <span className="font-semibold text-lg">SirtecRoute</span>
              {equipe && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 bg-white/20 text-white border-white/30 text-xs"
                >
                  {equipe.codigo}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Indicador de conexão */}
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
              isOnline ? "bg-green-500/20 text-green-100" : "bg-red-500/20 text-red-100"
            )}>
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3" />
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Alerta de Offline */}
      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium">
          <WifiOff className="h-4 w-4 inline mr-2" />
          Você está offline. Algumas funcionalidades podem não estar disponíveis.
        </div>
      )}

      {/* Alerta de Turno Desatualizado - Destaque */}
      {turnoDesatualizado && !alertaTurnoFechado && (
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white px-4 py-3 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-white/20 rounded-full">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">
                ⚠️ Turno desatualizado!
              </p>
              <p className="text-xs text-white/90 mt-0.5">
                Você está logado em um turno de <strong>{dataTurnoFormatada}</strong>. 
                Feche este turno e abra um novo com a data de hoje.
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                  onClick={() => navigate("/app")}
                >
                  Ir para Início
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => setAlertaTurnoFechado(true)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Fechar alerta
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Ociosidade - Global sutil */}
      {estaOcioso && (
        <div className={cn(
          "px-4 py-1.5 text-center border-b transition-colors",
          tempoOcioso > 300 
            ? "bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 border-red-500/30"
            : "bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border-amber-500/30"
        )}>
          <div className="flex items-center justify-center gap-2">
            <div className="relative flex items-center">
              <Timer className={cn(
                "h-3.5 w-3.5",
                tempoOcioso > 300 ? "text-red-600" : "text-amber-600"
              )} />
              <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                <span className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  tempoOcioso > 300 ? "bg-red-500" : "bg-amber-500"
                )}></span>
                <span className={cn(
                  "relative inline-flex rounded-full h-1.5 w-1.5",
                  tempoOcioso > 300 ? "bg-red-600" : "bg-amber-600"
                )}></span>
              </span>
            </div>
            <span className={cn(
              "text-xs font-medium",
              tempoOcioso > 300 ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
            )}>
              Ocioso
            </span>
            <span className={cn(
              "text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-full",
              tempoOcioso > 300 
                ? "text-red-800 dark:text-red-300 bg-red-500/20" 
                : "text-amber-800 dark:text-amber-300 bg-amber-500/20"
            )}>
              {formatarTempoOcioso(tempoOcioso)}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-y-auto pb-20 overscroll-contain">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border z-40 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {navItems.map((item) => {
            const active = isActive(item.section);
            const to = getRememberedHref(item.section);
            const showBadge = item.section === "chat" && chatNaoLidas > 0;
            
            return (
              <Link
                key={item.section}
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-xl transition-all relative",
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <div className="relative">
                  <item.icon className={cn("h-5 w-5", active && "scale-110")} />
                  {showBadge && (
                    <span className={cn(
                      "absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center",
                      "bg-red-500 text-white text-[10px] font-bold rounded-full px-1",
                      "animate-pulse shadow-lg"
                    )}>
                      {chatNaoLidas > 99 ? "99+" : chatNaoLidas}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  active && "font-semibold",
                  showBadge && !active && "text-red-500 font-semibold"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </ScrollRestoreProvider>
  );
}
