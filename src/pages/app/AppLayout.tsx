import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ClipboardList, User, LogOut, Wifi, WifiOff, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useRef, useCallback } from "react";
import { ScrollRestoreProvider } from "@/contexts/ScrollRestoreContext";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useEquipeAuth();
  const { equipe } = useTecnico();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  const handleLogout = () => {
    logout();
    navigate("/app/login");
  };

  const navItems = [
    { icon: Home, label: "Início", href: "/app" },
    { icon: ClipboardList, label: "Minhas OS", href: "/app/ordens" },
    { icon: Package, label: "Estoque", href: "/app/estoque" },
    { icon: User, label: "Perfil", href: "/app/perfil" },
  ];

  const isActive = (href: string) => {
    if (href === "/app") return location.pathname === "/app";
    return location.pathname.startsWith(href);
  };

  return (
    <ScrollRestoreProvider>
    <div className="min-h-screen bg-background flex flex-col">
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
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border z-40 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-xl transition-all",
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "scale-110")} />
                <span className={cn(
                  "text-xs font-medium",
                  active && "font-semibold"
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
