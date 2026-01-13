import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Route, LogOut, Wifi, WifiOff, Package, MessageCircle, BarChart3, Timer, AlertTriangle, X, Cloud, CloudOff, RefreshCw, FileText } from "lucide-react";
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
import { OfflineSyncIndicator, OfflineStatusBanner } from "@/components/app/OfflineSyncIndicator";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData } from "@/hooks/useOfflineData";
import { useSyncProcedimentos } from "@/hooks/useSyncProcedimentos";

type AppSection = "home" | "ordens" | "estoque" | "chat" | "docs" | "resultados";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, temTurnoAberto, turno, isOfflineLogin } = useEquipeAuth();
  const { equipe } = useTecnico();
  const [chatNaoLidas, setChatNaoLidas] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Sistema de sincronização offline
  const { isOnline, pendingCount, isSyncing, syncPendingOperations, pendingOperations } = useOfflineSyncContext();
  const { preloadEssentialData } = useOfflineData();
  const { syncAll: syncProcedimentos } = useSyncProcedimentos(equipe?.contrato_id);
  const [hasPreloaded, setHasPreloaded] = useState(false);
  
  // Estado para contador de ociosidade
  const [tempoOcioso, setTempoOcioso] = useState(0);
  
  const dataHoje = format(new Date(), "yyyy-MM-dd");
  const [alertaTurnoFechado, setAlertaTurnoFechado] = useState(false);

  // Estado para controlar se estava offline antes
  const [wasOffline, setWasOffline] = useState(false);

  // Pré-carregar dados essenciais quando online (primeira vez)
  useEffect(() => {
    if (isOnline && equipe?.id && temTurnoAberto && !hasPreloaded) {
      console.log("[AppLayout] Iniciando pré-carregamento de dados...");
      preloadEssentialData(equipe.id).then(async (success) => {
        if (success) {
          setHasPreloaded(true);
          console.log("[AppLayout] Dados pré-carregados com sucesso!");
          
          // Também sincronizar procedimentos/documentos para acesso offline
          console.log("[AppLayout] 📄 Iniciando sync de documentos/procedimentos...");
          const syncResult = await syncProcedimentos(true); // forceSync para garantir
          if (syncResult.success) {
            console.log("[AppLayout] 📄 Documentos sincronizados:", syncResult.message);
          }
        }
      });
    }
  }, [isOnline, equipe?.id, temTurnoAberto, hasPreloaded, preloadEssentialData, syncProcedimentos]);

  // Rastrear se estávamos offline e se já sincronizamos
  const [pendingRefreshAfterSync, setPendingRefreshAfterSync] = useState(false);
  
  // Recarregar dados quando a internet voltar (após ter ficado offline)
  // IMPORTANTE: Aguardar a sincronização terminar COMPLETAMENTE antes de atualizar o cache
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && equipe?.id && temTurnoAberto) {
      console.log("[AppLayout] Internet restaurada - iniciando sincronização...");
      setWasOffline(false);
      setPendingRefreshAfterSync(true);
      
      // Disparar a sincronização (não esperar aqui pois o debounce pode retornar cedo)
      syncPendingOperations();
    }
  }, [isOnline, wasOffline, equipe?.id, temTurnoAberto, syncPendingOperations]);

  // Efeito separado para detectar quando a sincronização REALMENTE terminou
  // (quando pendingOperations.length === 0) e só então buscar dados do servidor
  useEffect(() => {
    if (pendingRefreshAfterSync && pendingOperations.length === 0 && isOnline && equipe?.id) {
      console.log("[AppLayout] ✅ Sincronização completada (0 operações pendentes) - atualizando dados do servidor...");
      setPendingRefreshAfterSync(false);
      
      // Pequeno delay para garantir que o servidor processou os dados
      const timeoutId = setTimeout(async () => {
        const success = await preloadEssentialData(equipe.id);
        if (success) {
          console.log("[AppLayout] ✅ Dados atualizados após reconexão!");
        }
        
        // Sincronizar documentos/procedimentos para acesso offline
        console.log("[AppLayout] 📄 Sincronizando documentos após reconexão...");
        await syncProcedimentos();
        
        // Também recarregar mensagens não lidas do chat
        // (mensagens que chegaram durante período offline não disparam eventos Realtime)
        console.log("[AppLayout] 🔔 Recarregando mensagens não lidas do chat após reconexão...");
        try {
          const { data } = await supabase
            .from("chat_conversas")
            .select("nao_lidas_equipe")
            .eq("equipe_id", equipe.id)
            .eq("status", "ativo");
          
          const total = (data || []).reduce((acc: number, conv: any) => acc + (conv.nao_lidas_equipe || 0), 0);
          setChatNaoLidas(total);
          console.log("[AppLayout] 🔔 Chat: " + total + " mensagens não lidas");
        } catch (error) {
          console.error("[AppLayout] Erro ao carregar mensagens não lidas:", error);
        }
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [pendingRefreshAfterSync, pendingOperations.length, isOnline, equipe?.id, preloadEssentialData]);

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

  // Chave para localStorage do início da ociosidade (inclui turno_id para ser único por turno)
  const OCIOSIDADE_KEY = turno?.id ? `ociosidade_inicio_${equipe?.id}_${turno.id}` : null;

  // Limpar ociosidade de turnos antigos quando um novo turno é aberto
  useEffect(() => {
    if (!equipe?.id) return;
    
    // Limpar todas as chaves de ociosidade antigas da equipe (incluindo formato antigo sem turno_id)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`ociosidade_inicio_${equipe.id}`) && key !== OCIOSIDADE_KEY) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }, [equipe?.id, OCIOSIDADE_KEY]);

  // Gerenciar início da ociosidade com localStorage
  // Só inicia a contagem quando há turno aberto (temTurnoAberto) e temos OCIOSIDADE_KEY
  useEffect(() => {
    if (!equipe?.id || !temTurnoAberto || !OCIOSIDADE_KEY) return;
    
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
  }, [estaOcioso, equipe?.id, temTurnoAberto, OCIOSIDADE_KEY]);

  // Limpar ociosidade quando o turno é encerrado
  useEffect(() => {
    if (!temTurnoAberto && OCIOSIDADE_KEY) {
      localStorage.removeItem(OCIOSIDADE_KEY);
      setTempoOcioso(0);
    }
  }, [temTurnoAberto, OCIOSIDADE_KEY]);

  // Atualizar contador de ociosidade a cada segundo
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
    
    // Atualizar imediatamente
    atualizarTempo();
    
    // Atualizar a cada segundo
    const interval = setInterval(atualizarTempo, 1000);
    
    return () => clearInterval(interval);
  }, [estaOcioso, equipe?.id, temTurnoAberto, OCIOSIDADE_KEY]);

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
    if (pathname.startsWith("/app/procedimentos")) return "docs";
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
      case "docs":
        return "/app/procedimentos";
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
          // IMPORTANTE: Quando offline e na seção "ordens", NÃO navegar para detalhes
          // de ordens que podem não estar no cache - ir direto para a lista
          if (section === "ordens" && !isOnline) {
            // Se a URL salva é um detalhe de ordem (tem UUID no path), ir para a lista
            const isDetalhePage = /\/app\/ordens\/[0-9a-f-]{36}$/i.test(remembered);
            if (isDetalhePage) {
              console.log("[AppLayout] Offline - ignorando URL de detalhe salva, indo para lista");
              return base;
            }
          }
          if (remembered.startsWith(base)) return remembered;
        }
      }
    } catch {
      // ignore
    }
    return base;
  };

  // O status de conexão agora vem do hook useOfflineSyncContext

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
      sessionStorage.removeItem(sectionKey("docs"));
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
    { icon: FileText, label: "Docs", section: "docs" as const },
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
            <img 
              src="/logo-sirtec.svg" 
              alt="Sirtec" 
              className="h-9 w-auto brightness-0 invert"
            />
            {equipe && (
              <Badge 
                variant="secondary" 
                className="bg-white/20 text-white border-white/30 text-xs"
              >
                {equipe.codigo}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Indicador de conexão e sincronização */}
            <OfflineSyncIndicator className="text-xs" />
            
            {/* Indicador de login offline */}
            {isOfflineLogin && (
              <div className="px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-100">
                <CloudOff className="h-3 w-3 inline mr-1" />
                <span className="hidden sm:inline">Modo local</span>
              </div>
            )}
            
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

      {/* Alerta de Offline / Sincronização */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <WifiOff className="h-4 w-4 animate-pulse" />
            <span>Modo offline ativo</span>
            {pendingCount > 0 && (
              <>
                <span>•</span>
                <span className="text-white/90">{pendingCount} ação(ões) pendente(s)</span>
              </>
            )}
          </div>
          <p className="text-xs text-center text-white/80 mt-1">
            Suas ações serão salvas e sincronizadas quando a conexão voltar.
          </p>
        </div>
      )}
      
      {/* Banner de sincronização em andamento */}
      {isOnline && isSyncing && pendingCount > 0 && (
        <div className="bg-blue-500 text-white px-4 py-2 text-center text-sm font-medium">
          <RefreshCw className="h-4 w-4 inline mr-2 animate-spin" />
          Sincronizando {pendingCount} operação(ões)...
        </div>
      )}

      {/* Alerta de Turno Desatualizado - Destaque */}
      {turnoDesatualizado && (
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Ociosidade - Global sutil - só mostra após 1 minuto */}
      {estaOcioso && tempoOcioso > 0 && (
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
        <div className="flex justify-around items-center h-16 px-1">
          {navItems.map((item) => {
            const active = isActive(item.section);
            const to = getRememberedHref(item.section);
            const showBadge = item.section === "chat" && chatNaoLidas > 0;
            
            return (
              <Link
                key={item.section}
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-all relative flex-1 min-w-0",
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <div className="relative">
                  <item.icon className={cn("h-5 w-5", active && "scale-110")} />
                  {showBadge && (
                    <span className={cn(
                      "absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] flex items-center justify-center",
                      "bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5",
                      "animate-pulse shadow-lg"
                    )}>
                      {chatNaoLidas > 99 ? "99+" : chatNaoLidas}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium truncate",
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
