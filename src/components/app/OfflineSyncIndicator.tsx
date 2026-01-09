import { useState, useEffect } from "react";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { 
  WifiOff, 
  Wifi, 
  CloudOff, 
  Cloud, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  X,
  Upload
} from "lucide-react";
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
  } = useOfflineSyncContext();

  const [showSheet, setShowSheet] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

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
      start_turno: "Iniciar turno",
      end_turno: "Encerrar turno",
      start_intervalo: "Iniciar intervalo",
      end_intervalo: "Encerrar intervalo",
      update_localizacao: "Atualizar localização",
      send_chat_message: "Enviar mensagem",
      save_checklist: "Salvar checklist",
      save_foto: "Salvar foto",
      movimentar_material: "Movimentar material",
    };
    return descriptions[type] || type;
  };

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
    <Sheet open={showSheet} onOpenChange={setShowSheet}>
      <SheetTrigger asChild>
        <button 
          className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
            isOnline 
              ? pendingCount > 0 
                ? "bg-yellow-100 hover:bg-yellow-200" 
                : "bg-green-100 hover:bg-green-200"
              : "bg-red-100 hover:bg-red-200"
          } ${className}`}
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
              <span className="text-xs font-medium text-blue-700">Sincronizando...</span>
            </>
          ) : isOnline ? (
            pendingCount > 0 ? (
              <>
                <Cloud className="h-4 w-4 text-yellow-600" />
                <span className="text-xs font-medium text-yellow-700">
                  {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Online</span>
              </>
            )
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-600 animate-pulse" />
              <span className="text-xs font-medium text-red-700">Offline</span>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-red-200 text-red-700">
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
            </div>
          </div>

          {/* Lista de operações pendentes */}
          {pendingCount > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Operações pendentes</h4>
              <ScrollArea className="h-[200px] rounded border">
                <div className="p-2 space-y-2">
                  {pendingOperations.map((op) => (
                    <div 
                      key={op.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {op.retries > 0 ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Cloud className="h-4 w-4 text-gray-400" />
                        )}
                        <div>
                          <p className="font-medium">{getOperationDescription(op.type)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(op.created_at), "HH:mm:ss", { locale: ptBR })}
                            {op.retries > 0 && ` · ${op.retries} tentativa(s)`}
                          </p>
                        </div>
                      </div>
                      {op.retries >= 5 && (
                        <Badge variant="destructive" className="text-[10px]">
                          Falhou
                        </Badge>
                      )}
                    </div>
                  ))}
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

