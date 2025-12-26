import { useState, useMemo } from "react";
import { format, parseISO, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  GripVertical,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Route,
  Search,
  Shield,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export interface OSParaAdicionar {
  id: string;
  numero: string;
  tipo: string;
  endereco: string;
  cliente?: string;
  regulada: boolean;
  prazo?: string;
  latitude?: number;
  longitude?: number;
}

export interface OSNaRota {
  id: string;
  numero: string;
  tipo: string;
  status: string;
  endereco: string;
  regulada: boolean;
  prazo?: string;
  ordemNaRota: number;
  horaInicioEstimada?: string;
  horaFimEstimada?: string;
}

export interface EquipeRota {
  id: string;
  codigo: string;
  nome: string;
  ordens: OSNaRota[];
}

export interface ImpactoIntervencao {
  osReguladasAfetadas: number;
  osUrgentesForaDaRota: string[];
  novaOrdemEstimada: OSNaRota[];
  alertas: string[];
}

interface Props {
  equipe: EquipeRota;
  osDisponiveis: OSParaAdicionar[];
  // Preview: calcular impacto (não deve alterar banco)
  onPreviewAdicionarOS: (osId: string, posicao: number, motivo: string) => Promise<ImpactoIntervencao>;
  onAplicarAdicionarOS: (osId: string, posicao: number, motivo: string) => Promise<void>;
  onPreviewRemoverOS: (osId: string, motivo: string) => Promise<ImpactoIntervencao>;
  onAplicarRemoverOS: (osId: string, motivo: string) => Promise<void>;
  onReordenar: (novaOrdem: string[]) => Promise<void>;
  isProcessing?: boolean;
}

export function IntervencaoRota({
  equipe,
  osDisponiveis,
  onPreviewAdicionarOS,
  onAplicarAdicionarOS,
  onPreviewRemoverOS,
  onAplicarRemoverOS,
  onReordenar,
  isProcessing,
}: Props) {
  const [dialogAdicionar, setDialogAdicionar] = useState<{
    open: boolean;
    os: OSParaAdicionar | null;
    posicao: number;
    motivo: string;
  }>({ open: false, os: null, posicao: 1, motivo: "" });

  const [dialogRemover, setDialogRemover] = useState<{
    open: boolean;
    os: OSNaRota | null;
    motivo: string;
  }>({ open: false, os: null, motivo: "" });

  const [dialogImpacto, setDialogImpacto] = useState<{
    open: boolean;
    impacto: ImpactoIntervencao | null;
    acao: "adicionar" | "remover";
    confirmar: () => void;
    cancelar: () => void;
  }>({ open: false, impacto: null, acao: "adicionar", confirmar: () => {}, cancelar: () => {} });

  const [buscaOS, setBuscaOS] = useState("");
  const [modoReordenar, setModoReordenar] = useState(false);
  const [ordemLocal, setOrdemLocal] = useState<OSNaRota[]>([]);
  const [aplicandoImpacto, setAplicandoImpacto] = useState(false);

  // OSs filtradas pela busca
  const osFiltradas = useMemo(() => {
    const termo = buscaOS.toLowerCase().trim();
    if (!termo) return osDisponiveis.slice(0, 20);
    return osDisponiveis.filter(os =>
      os.numero.toLowerCase().includes(termo) ||
      os.endereco.toLowerCase().includes(termo) ||
      os.tipo.toLowerCase().includes(termo) ||
      os.cliente?.toLowerCase().includes(termo)
    ).slice(0, 20);
  }, [osDisponiveis, buscaOS]);

  // Iniciar reordenação
  const iniciarReordenacao = () => {
    setOrdemLocal([...equipe.ordens]);
    setModoReordenar(true);
  };

  // Mover OS na ordem
  const moverOS = (index: number, direcao: "up" | "down") => {
    const novaOrdem = [...ordemLocal];
    const novoIndex = direcao === "up" ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= novaOrdem.length) return;
    [novaOrdem[index], novaOrdem[novoIndex]] = [novaOrdem[novoIndex], novaOrdem[index]];
    setOrdemLocal(novaOrdem);
  };

  // Salvar reordenação
  const salvarReordenacao = async () => {
    await onReordenar(ordemLocal.map(os => os.id));
    setModoReordenar(false);
  };

  // Verificar impacto antes de adicionar
  const verificarImpactoAdicionar = async () => {
    if (!dialogAdicionar.os) return;

    try {
      const impacto = await onPreviewAdicionarOS(dialogAdicionar.os.id, dialogAdicionar.posicao, dialogAdicionar.motivo);

      // IMPORTANTE: fechar o dialog atual antes de abrir o AlertDialog (senão fica "atrás")
      const snapshot = { ...dialogAdicionar };
      setDialogAdicionar((prev) => ({ ...prev, open: false }));

      // Sempre mostrar o resumo/confirmacão (melhor UX: o botão "Verificar impacto" precisa "fazer algo")
      setDialogImpacto({
        open: true,
        impacto,
        acao: "adicionar",
        confirmar: async () => {
          try {
            setAplicandoImpacto(true);
            await onAplicarAdicionarOS(snapshot.os!.id, snapshot.posicao, snapshot.motivo);
            setDialogImpacto({ open: false, impacto: null, acao: "adicionar", confirmar: () => {}, cancelar: () => {} });
            setDialogAdicionar({ open: false, os: null, posicao: 1, motivo: "" });
          } finally {
            setAplicandoImpacto(false);
          }
        },
        cancelar: () => {
          setDialogImpacto({ open: false, impacto: null, acao: "adicionar", confirmar: () => {}, cancelar: () => {} });
          setDialogAdicionar(snapshot);
        },
      });
    } catch (e: any) {
      console.error(e);
      // Mantém o dialog aberto para o usuário tentar outra OS/motivo
      toast.error(e?.message ? `Erro ao verificar impacto: ${e.message}` : "Erro ao verificar impacto.");
    }
  };

  // Verificar impacto antes de remover
  const verificarImpactoRemover = async () => {
    if (!dialogRemover.os) return;

    try {
      const impacto = await onPreviewRemoverOS(dialogRemover.os.id, dialogRemover.motivo);
      const snapshot = { ...dialogRemover };
      setDialogRemover((prev) => ({ ...prev, open: false }));

      setDialogImpacto({
        open: true,
        impacto,
        acao: "remover",
        confirmar: async () => {
          try {
            setAplicandoImpacto(true);
            await onAplicarRemoverOS(snapshot.os!.id, snapshot.motivo);
            setDialogImpacto({ open: false, impacto: null, acao: "remover", confirmar: () => {}, cancelar: () => {} });
            setDialogRemover({ open: false, os: null, motivo: "" });
          } finally {
            setAplicandoImpacto(false);
          }
        },
        cancelar: () => {
          setDialogImpacto({ open: false, impacto: null, acao: "remover", confirmar: () => {}, cancelar: () => {} });
          setDialogRemover(snapshot);
        },
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Erro ao verificar impacto: ${e.message}` : "Erro ao verificar impacto.");
    }
  };

  const ordensParaExibir = modoReordenar ? ordemLocal : equipe.ordens;

  return (
    <>
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              Rota: {equipe.codigo}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {equipe.ordens.length} OS{equipe.ordens.length !== 1 ? "s" : ""}
              </Badge>
              {!modoReordenar ? (
                <Button size="sm" variant="outline" onClick={iniciarReordenacao}>
                  <GripVertical className="h-4 w-4 mr-1" />
                  Reordenar
                </Button>
              ) : (
                <>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setModoReordenar(false)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={salvarReordenacao}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Salvar
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {/* Busca para adicionar OS */}
          {!modoReordenar && (
            <div className="p-3 border-b bg-muted/30">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Adicionar OS à rota
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={buscaOS}
                  onChange={(e) => setBuscaOS(e.target.value)}
                  placeholder="Buscar OS por número, endereço, tipo..."
                  className="pl-9"
                />
              </div>
              
              {buscaOS && osFiltradas.length > 0 && (
                <ScrollArea className="h-40 mt-2 rounded-lg border bg-card">
                  <div className="divide-y">
                    {osFiltradas.map((os) => (
                      <button
                        key={os.id}
                        className="w-full text-left p-2 hover:bg-muted/50 transition"
                        onClick={() => setDialogAdicionar({
                          open: true,
                          os,
                          posicao: equipe.ordens.length + 1,
                          motivo: "",
                        })}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{os.numero}</span>
                            {os.regulada && (
                              <Badge variant="destructive" className="text-[10px] h-4">
                                <Shield className="h-2.5 w-2.5 mr-0.5" />
                                Regulada
                              </Badge>
                            )}
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {os.tipo} • {os.endereco}
                        </div>
                        {os.prazo && (
                          <div className={cn(
                            "text-[10px] mt-0.5",
                            isPast(parseISO(os.prazo)) ? "text-red-600" : "text-muted-foreground"
                          )}>
                            <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                            Prazo: {format(parseISO(os.prazo), "dd/MM HH:mm")}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Lista de OS na rota */}
          <ScrollArea className="h-[350px]">
            <div className="divide-y">
              {ordensParaExibir.map((os, index) => {
                const isPrazoPast = os.prazo && isPast(parseISO(os.prazo));
                const isExecutando = ["em_deslocamento", "no_local", "em_execucao", "em_andamento"].includes(os.status);
                const isConcluida = os.status === "concluida";
                const isCancelada = os.status === "cancelada";

                return (
                  <div
                    key={os.id}
                    className={cn(
                      "p-3 transition-all",
                      isConcluida && "bg-green-500/5",
                      isCancelada && "bg-slate-500/5 opacity-60",
                      isExecutando && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Número da ordem */}
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm",
                        isConcluida ? "bg-green-500/20 text-green-700" :
                        isCancelada ? "bg-slate-500/20 text-slate-500" :
                        isExecutando ? "bg-primary/20 text-primary" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>

                      {/* Info da OS */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{os.numero}</span>
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {os.tipo}
                          </Badge>
                          {os.regulada && (
                            <Badge variant="destructive" className="text-[10px] h-4">
                              <Shield className="h-2.5 w-2.5 mr-0.5" />
                              Regulada
                            </Badge>
                          )}
                          {isExecutando && (
                            <Badge className="text-[10px] h-4 bg-primary/20 text-primary border-primary/30">
                              <Zap className="h-2.5 w-2.5 mr-0.5" />
                              Em andamento
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {os.endereco}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          {os.horaInicioEstimada && os.horaFimEstimada && (
                            <span>
                              <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                              {os.horaInicioEstimada.slice(0, 5)} - {os.horaFimEstimada.slice(0, 5)}
                            </span>
                          )}
                          {os.prazo && (
                            <span className={isPrazoPast ? "text-red-600 font-medium" : ""}>
                              Prazo: {format(parseISO(os.prazo), "dd/MM HH:mm")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 shrink-0">
                        {modoReordenar && !isConcluida && !isCancelada && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => moverOS(index, "up")}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => moverOS(index, "down")}
                              disabled={index === ordensParaExibir.length - 1}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {!modoReordenar && !isConcluida && !isCancelada && !isExecutando && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDialogRemover({ open: true, os, motivo: "" })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {equipe.ordens.length === 0 && (
                <div className="p-8 text-center">
                  <Route className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma OS na rota desta equipe
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog Adicionar */}
      <Dialog 
        open={dialogAdicionar.open} 
        onOpenChange={(open) => setDialogAdicionar(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar OS à Rota</DialogTitle>
            <DialogDescription>
              OS {dialogAdicionar.os?.numero} será adicionada à rota de {equipe.codigo}
            </DialogDescription>
          </DialogHeader>
          
          {dialogAdicionar.os?.regulada && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium">
                <Shield className="h-4 w-4" />
                OS Regulada
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Esta é uma OS com prazo regulatório. Certifique-se de que será atendida.
              </p>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Posição na rota</Label>
              <Select
                value={String(dialogAdicionar.posicao)}
                onValueChange={(v) => setDialogAdicionar(prev => ({ ...prev, posicao: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: equipe.ordens.length + 1 }, (_, i) => i + 1).map(pos => (
                    <SelectItem key={pos} value={String(pos)}>
                      Posição {pos} {pos === equipe.ordens.length + 1 ? "(final)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Motivo da intervenção *</Label>
              <Textarea
                value={dialogAdicionar.motivo}
                onChange={(e) => setDialogAdicionar(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Explique o motivo de adicionar esta OS..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDialogAdicionar({ open: false, os: null, posicao: 1, motivo: "" })}
            >
              Cancelar
            </Button>
            <Button 
              onClick={verificarImpactoAdicionar}
              disabled={!dialogAdicionar.motivo.trim() || isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verificar Impacto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Remover */}
      <Dialog 
        open={dialogRemover.open} 
        onOpenChange={(open) => setDialogRemover(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover OS da Rota</DialogTitle>
            <DialogDescription>
              OS {dialogRemover.os?.numero} será removida da rota de {equipe.codigo}
            </DialogDescription>
          </DialogHeader>
          
          {dialogRemover.os?.regulada && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Atenção: OS Regulada!
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Remover esta OS pode causar perda de prazo regulatório.
              </p>
            </div>
          )}

          <div className="space-y-2 py-2">
            <Label>Motivo da remoção *</Label>
            <Textarea
              value={dialogRemover.motivo}
              onChange={(e) => setDialogRemover(prev => ({ ...prev, motivo: e.target.value }))}
              placeholder="Explique o motivo de remover esta OS..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDialogRemover({ open: false, os: null, motivo: "" })}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={verificarImpactoRemover}
              disabled={!dialogRemover.motivo.trim() || isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verificar Impacto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert de Impacto */}
      <AlertDialog open={dialogImpacto.open} onOpenChange={(open) => {
        // Se fechar via ESC/clique fora, reabre o diálogo anterior (comportamento mais previsível)
        if (!open && dialogImpacto.open) {
          dialogImpacto.cancelar?.();
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Atenção: Impacto Detectado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta ação pode impactar o atendimento de OSs importantes:
                </p>
                
                {dialogImpacto.impacto?.osReguladasAfetadas! > 0 && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium">
                      <Shield className="h-4 w-4" />
                      {dialogImpacto.impacto?.osReguladasAfetadas} OS(s) regulada(s) afetada(s)
                    </div>
                  </div>
                )}

                {dialogImpacto.impacto?.osUrgentesForaDaRota.length! > 0 && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      OSs urgentes que ficarão sem atendimento:
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {dialogImpacto.impacto?.osUrgentesForaDaRota.map((os, i) => (
                        <li key={i}>• {os}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {dialogImpacto.impacto?.alertas.map((alerta, i) => (
                  <div key={i} className="rounded-lg bg-muted p-3 text-sm">
                    {alerta}
                  </div>
                ))}

                <p className="font-medium">Deseja continuar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => dialogImpacto.cancelar()}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={dialogImpacto.confirmar}
              className="bg-destructive hover:bg-destructive/90"
              disabled={aplicandoImpacto}
            >
              {aplicandoImpacto ? "Aplicando..." : "Confirmar e Aplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

