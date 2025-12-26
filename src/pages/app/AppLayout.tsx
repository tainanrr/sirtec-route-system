import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Route, LogOut, Wifi, WifiOff, Package, MessageCircle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useCallback, useRef } from "react";
import { ScrollRestoreProvider } from "@/contexts/ScrollRestoreContext";
import { supabase } from "@/integrations/supabase/client";

type AppSection = "home" | "ordens" | "estoque" | "chat" | "resultados";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useEquipeAuth();
  const { equipe } = useTecnico();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [chatNaoLidas, setChatNaoLidas] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
