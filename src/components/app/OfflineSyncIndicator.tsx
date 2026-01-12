import { useState, useEffect, useMemo } from "react";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData } from "@/hooks/useOfflineData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  WifiOff, 
  Wifi, 
  CloudOff, 
  Cloud, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  X,
  Upload,
  Trash2,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OfflineSyncIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function OfflineSyncIndicator({ className = "", showDetails = true }: OfflineSyncIndicatorProps) {
  const {
    isOnline,
    isSyncing,
    pendingOperations,
    pendingCount,
    lastSyncTime,
    syncPendingOperations,
    clearQueue,
    clearFailedOperations,
    refreshPendingOperations,
  } = useOfflineSyncContext();

  const { getFromCache } = useOfflineData();
  const [showSheet, setShowSheet] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  
  // Contar operações com erro
  const failedCount = pendingOperations.filter(op => op.retries >= 5).length;
  
  // Extrair ordem_servico_id do payload da operação
  const getOrdemServicoId = (op: typeof pendingOperations[0]): string | null => {
    const payload = op.payload;
    if (!payload) return null;
    
    // Diferentes operações têm o OS ID em campos diferentes
    if (payload.ordem_servico_id) return payload.ordem_servico_id;
    if (op.type === "update_os_status" && payload.id) return payload.id;
    if (op.type === "update_ordem_retorno" && payload.id) return payload.id;
    
    return null;
  };

  // Extrair número da OS diretamente do payload da operação (se disponível)
  const getNumeroOsFromPayload = (op: typeof pendingOperations[0]): string | null => {
    const payload = op.payload;
    if (!payload) return null;
    
    // O número pode estar em campos diferentes dependendo da operação
    return payload.numero_os || payload.numero || null;
  };
  
  // Extrair IDs das OSs das operações pendentes
  const osIds = useMemo(() => {
    const ids = new Set<string>();
    pendingOperations.forEach(op => {
      const osId = getOrdemServicoId(op);
      if (osId) {
        ids.add(osId);
      }
    });
    return Array.from(ids);
  }, [pendingOperations]);
  
  // Estado para cache offline de números de OSs
  const [osNumbersCache, setOsNumbersCache] = useState<Record<string, string>>({});
  
  // Carregar números das OSs do cache offline e também das operações pendentes
  useEffect(() => {
    const carregarCacheOffline = async () => {
      const map: Record<string, string> = {};
      
      // 1. Primeiro extrair números diretamente dos payloads das operações
      pendingOperations.forEach(op => {
        const osId = getOrdemServicoId(op);
        const numero = getNumeroOsFromPayload(op);
        if (osId && numero) {
          map[osId] = numero;
        }
      });
      
      // 2. Se ainda faltam IDs, buscar do cache
      const idsRestantes = osIds.filter(id => !map[id]);
      
      if (idsRestantes.length === 0) {
        setOsNumbersCache(map);
        return;
      }
      
      try {
        // Tentar o cache de planejamento do dia
        const equipeId = localStorage.getItem("equipe_id");
        const hoje = new Date().toISOString().split("T")[0];
        
        // Tentar múltiplas fontes de cache
        const cachesToTry = [
          equipeId ? `planejamento_dia_${equipeId}_${hoje}` : null,
          equipeId ? `ordens_planejadas_${equipeId}_all` : null,
          equipeId ? `ordens_planejadas_${equipeId}` : null,
        ].filter(Boolean) as string[];
        
        for (const cacheKey of cachesToTry) {
          const cache = await getFromCache<any[]>(cacheKey);
          if (cache && Array.isArray(cache)) {
            cache.forEach((item: any) => {
              // Verificar se é uma ordem de serviço direta ou dentro de planejamento
              const osData = item.ordens_servico || item;
              const osId = osData.id;
              const numero = osData.numero || osData.numero_os;
              
              if (osId && numero && !map[osId]) {
                map[osId] = numero;
              }
            });
          }
        }
        
        setOsNumbersCache(map);
      } catch (error) {
        console.error("[OfflineSyncIndicator] Erro ao carregar cache offline:", error);
        setOsNumbersCache(map);
      }
    };
    
    carregarCacheOffline();
  }, [osIds, pendingOperations, getFromCache]);
  
  // Buscar números das OSs do Supabase (quando online)
  const { data: osNumbersOnline } = useQuery({
    queryKey: ["os-numbers-sync", osIds.join(",")],
    queryFn: async () => {
      if (osIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero")
        .in("id", osIds);
      
      if (error) {
        console.error("[OfflineSyncIndicator] Erro ao buscar números das OSs:", error);
        return {};
      }
      
      const map: Record<string, string> = {};
      data?.forEach(os => {
        if (os.id && os.numero) {
          map[os.id] = os.numero;
        }
      });
      
      return map;
    },
    enabled: osIds.length > 0 && isOnline,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
  
  // Combinar números online e offline (priorizar online, depois cache)
  const osNumbers = useMemo(() => {
    const combined: Record<string, string> = { ...osNumbersCache };
    if (osNumbersOnline) {
      Object.assign(combined, osNumbersOnline);
    }
    return combined;
  }, [osNumbersOnline, osNumbersCache]);
  
  // Função para limpar operações com erro
  const handleClearFailed = async () => {
    if (failedCount === 0) {
      toast.info("Não há operações com erro para limpar");
      return;
    }
    
    if (!window.confirm(`Deseja remover ${failedCount} operação(ões) com erro da fila?`)) {
      return;
    }
    
    try {
      const removed = await clearFailedOperations();
      refreshPendingOperations();
      toast.success(`${removed} operação(ões) com erro removida(s)`);
    } catch (error) {
      console.error("Erro ao limpar operações com erro:", error);
      toast.error("Erro ao limpar operações com erro");
    }
  };

  // Detectar quando volta online para mostrar notificação
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && pendingCount > 0) {
      // Voltou online com pendências - sincronizar automaticamente
      syncPendingOperations();
      setWasOffline(false);
    }
  }, [isOnline, wasOffline, pendingCount, syncPendingOperations]);

  // Mapear tipos de operação para descrições amigáveis
  const getOperationDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      update_os_status: "Atualizar status de OS",
      register_producao: "Registrar produção",
      register_producao_completa: "Registrar produção completa",
      start_turno: "Iniciar turno",
      end_turno: "Encerrar turno",
      start_intervalo: "Iniciar intervalo",
      end_intervalo: "Encerrar intervalo",
      update_localizacao: "Atualizar localização",
      send_chat_message: "Enviar mensagem",
      save_checklist: "Salvar checklist",
      save_apr: "Salvar APR",
      update_apr: "Atualizar APR",
      save_foto: "Salvar foto",
      movimentar_material: "Movimentar material",
      update_ordem_retorno: "Atualizar retorno de OS",
    };
    return descriptions[type] || type;
  };

  // Agrupar operações por OS
  const groupedOperations = (() => {
    const groups: Record<string, typeof pendingOperations> = {};
    const semOS: typeof pendingOperations = [];
    
    pendingOperations.forEach(op => {
      const osId = getOrdemServicoId(op);
      if (osId) {
        if (!groups[osId]) {
          groups[osId] = [];
        }
        groups[osId].push(op);
      } else {
        semOS.push(op);
      }
    });
    
    return { groups, semOS };
  })();

  // Indicador simples sem detalhes
  if (!showDetails) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500 animate-pulse" />
        )}
        {pendingCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-yellow-100 text-yellow-700">
            {pendingCount}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Sheet open={showSheet} onOpenChange={(open) => {
      console.log("[OfflineSyncIndicator] Sheet open change:", open);
      setShowSheet(open);
    }}>
      <SheetTrigger asChild>
        <button 
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs cursor-pointer transition-colors",
            isSyncing 
              ? "bg-blue-500/20 text-blue-100" 
              : isOnline 
                ? pendingCount > 0
                  ? "bg-yellow-500/20 text-yellow-100 hover:bg-yellow-500/30"
                  : "bg-green-500/20 text-green-100"
                : "bg-red-500/20 text-red-100",
            className
          )}
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline font-medium">Sincronizando</span>
            </>
          ) : isOnline ? (
            pendingCount > 0 ? (
              <>
                <Cloud className="h-3 w-3" />
                <span className="font-medium">{pendingCount}</span>
                <span className="hidden sm:inline">pendente{pendingCount > 1 ? "s" : ""}</span>
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3" />
                <span className="hidden sm:inline font-medium">Online</span>
              </>
            )
          ) : (
            <>
              <WifiOff className="h-3 w-3 animate-pulse" />
              <span className="hidden sm:inline font-medium">Offline</span>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-white/20 text-white">
                  {pendingCount}
                </Badge>
              )}
            </>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[60vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="h-5 w-5 text-green-500" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-red-500" />
                Modo Offline
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {isOnline 
              ? "Suas alterações estão sendo sincronizadas automaticamente."
              : "Suas alterações serão sincronizadas quando a conexão for restaurada."
            }
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Status e ações */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">
                {pendingCount === 0 
                  ? "Tudo sincronizado!" 
                  : `${pendingCount} operação(ões) pendente(s)`
                }
              </p>
              {lastSyncTime && (
                <p className="text-xs text-muted-foreground">
                  Última sincronização: {format(lastSyncTime, "HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {pendingCount > 0 && isOnline && (
                <Button 
                  size="sm" 
                  onClick={() => syncPendingOperations()}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Sincronizar
                </Button>
              )}
              {failedCount > 0 && (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={handleClearFailed}
                  disabled={isSyncing}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar Erros ({failedCount})
                </Button>
              )}
            </div>
          </div>

          {/* Lista de operações pendentes agrupadas por OS */}
          {pendingCount > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Operações pendentes</h4>
              <ScrollArea className="h-[300px] rounded border">
                <div className="p-2 space-y-3">
                  {/* Operações agrupadas por OS */}
                  {Object.entries(groupedOperations.groups).map(([osId, ops]) => {
                    // Buscar número da OS (prioriza online, depois cache offline, depois fallback)
                    const osNumero = osNumbers?.[osId] || osId.substring(0, 8);
                    const opsComErro = ops.filter(op => op.retries >= 5);
                    
                    return (
                      <div key={osId} className="space-y-1.5">
                        <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold text-primary">
                            OS {osNumero}
                          </span>
                          <Badge variant="secondary" className="text-[10px] ml-auto">
                            {ops.length} {ops.length === 1 ? 'operação' : 'operações'}
                          </Badge>
                        </div>
                        <div className="pl-4 space-y-1">
                          {ops.map((op) => (
                            <div 
                              key={op.id}
                              className={cn(
                                "flex items-center justify-between p-2 rounded text-sm",
                                op.retries >= 5 
                                  ? "bg-destructive/10 border border-destructive/20" 
                                  : "bg-muted/50"
                              )}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {op.retries > 0 ? (
                                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                                ) : (
                                  <Cloud className="h-4 w-4 text-gray-400 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{getOperationDescription(op.type)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(op.created_at), "HH:mm:ss", { locale: ptBR })}
                                    {op.retries > 0 && ` · ${op.retries} tentativa(s)`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {op.retries >= 5 && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Falhou
                                  </Badge>
                                )}
                                {op.last_error && (
                                  <span 
                                    className="text-[10px] text-muted-foreground max-w-[150px] truncate" 
                                    title={op.last_error}
                                  >
                                    {op.last_error.substring(0, 30)}...
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Operações sem vínculo com OS */}
                  {groupedOperations.semOS.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded">
                        <Cloud className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-muted-foreground">
                          Outras operações
                        </span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">
                          {groupedOperations.semOS.length}
                        </Badge>
                      </div>
                      <div className="pl-4 space-y-1">
                        {groupedOperations.semOS.map((op) => (
                          <div 
                            key={op.id}
                            className={cn(
                              "flex items-center justify-between p-2 rounded text-sm",
                              op.retries >= 5 
                                ? "bg-destructive/10 border border-destructive/20" 
                                : "bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {op.retries > 0 ? (
                                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                              ) : (
                                <Cloud className="h-4 w-4 text-gray-400 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{getOperationDescription(op.type)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(op.created_at), "HH:mm:ss", { locale: ptBR })}
                                  {op.retries > 0 && ` · ${op.retries} tentativa(s)`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {op.retries >= 5 && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Falhou
                                </Badge>
                              )}
                              {op.last_error && (
                                <span 
                                  className="text-[10px] text-muted-foreground max-w-[150px] truncate" 
                                  title={op.last_error}
                                >
                                  {op.last_error.substring(0, 30)}...
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Info sobre modo offline */}
          {!isOnline && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Você está trabalhando offline
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Todas as suas ações estão sendo salvas localmente e serão 
                    sincronizadas automaticamente quando a conexão for restaurada.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tudo sincronizado */}
          {isOnline && pendingCount === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-700">
                Tudo sincronizado!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Seus dados estão atualizados com o servidor.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Componente de banner de status (para topo da tela)
export function OfflineStatusBanner() {
  const { isOnline, pendingCount, isSyncing } = useOfflineSyncContext();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div 
      className={`px-4 py-2 text-center text-sm font-medium ${
        isOnline 
          ? isSyncing 
            ? "bg-blue-500 text-white"
            : "bg-yellow-500 text-white"
          : "bg-red-500 text-white"
      }`}
    >
      {isSyncing ? (
        <span className="flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Sincronizando {pendingCount} operação(ões)...
        </span>
      ) : isOnline ? (
        <span className="flex items-center justify-center gap-2">
          <CloudOff className="h-4 w-4" />
          {pendingCount} operação(ões) pendente(s) de sincronização
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          Sem conexão - Modo offline ativo
        </span>
      )}
    </div>
  );
}

