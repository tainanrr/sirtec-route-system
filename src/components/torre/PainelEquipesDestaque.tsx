import { useMemo } from "react";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  Coffee,
  MessageCircle,
  Phone,
  Timer,
  Users,
  Zap,
  Eye,
  TrendingDown,
  TrendingUp,
  Activity,
  Pause,
  WifiOff,
} from "lucide-react";

export interface EquipeDestaque {
  id: string;
  codigo: string;
  nome: string;
  telefone?: string | null;
  status: "ociosa" | "atrasada" | "offline" | "problema" | "normal" | "em_intervalo";
  temTurnoAberto: boolean;
  tempoOcioso?: number; // em minutos
  tempoIntervalo?: number; // em minutos
  tipoIntervalo?: string;
  osAtrasadas?: number;
  osTotal?: number;
  osConcluidas?: number;
  osEmAndamento?: number;
  ultimaAtualizacao?: string;
  tendencia?: "adiantado" | "atrasado" | "no_prazo";
  minutosDesvio?: number;
}

interface Props {
  equipes: EquipeDestaque[];
  onSelectEquipe: (equipeId: string) => void;
  onOpenChat: (equipeId: string) => void;
  onLigar: (telefone: string) => void;
}

const STATUS_CONFIG = {
  ociosa: {
    label: "Ociosa",
    color: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400",
    icon: Timer,
    severity: 2,
  },
  atrasada: {
    label: "Atrasada",
    color: "bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400",
    icon: TrendingDown,
    severity: 3,
  },
  offline: {
    label: "Sem conexão",
    color: "bg-slate-500/15 border-slate-500/40 text-slate-700 dark:text-slate-400",
    icon: WifiOff,
    severity: 4,
  },
  problema: {
    label: "Problema",
    color: "bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400",
    icon: AlertTriangle,
    severity: 3,
  },
  em_intervalo: {
    label: "Em intervalo",
    color: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-400",
    icon: Coffee,
    severity: 1,
  },
  normal: {
    label: "Normal",
    color: "bg-green-500/15 border-green-500/40 text-green-700 dark:text-green-400",
    icon: Activity,
    severity: 0,
  },
};

function formatMinutes(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ""}`;
}

export function PainelEquipesDestaque({ equipes, onSelectEquipe, onOpenChat, onLigar }: Props) {
  // Ordenar por severidade (problemas primeiro)
  const equipesOrdenadas = useMemo(() => {
    return [...equipes]
      .filter(e => e.temTurnoAberto)
      .sort((a, b) => {
        const sevA = STATUS_CONFIG[a.status]?.severity ?? 0;
        const sevB = STATUS_CONFIG[b.status]?.severity ?? 0;
        return sevB - sevA;
      });
  }, [equipes]);

  const equipesComProblema = equipesOrdenadas.filter(e => 
    e.status !== "normal" && e.status !== "em_intervalo"
  );

  const equipesEmIntervalo = equipesOrdenadas.filter(e => e.status === "em_intervalo");
  const equipesNormais = equipesOrdenadas.filter(e => e.status === "normal");

  const totalEquipesAtivas = equipesOrdenadas.length;
  const totalComProblema = equipesComProblema.length;

  if (totalEquipesAtivas === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhuma equipe com turno aberto</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 border-b bg-gradient-to-r from-card to-muted/30">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Equipes em Campo
          </span>
          <div className="flex items-center gap-2">
            {totalComProblema > 0 && (
              <Badge variant="destructive" className="gap-1 animate-pulse">
                <AlertTriangle className="h-3 w-3" />
                {totalComProblema} {totalComProblema === 1 ? "alerta" : "alertas"}
              </Badge>
            )}
            <Badge variant="secondary">
              {totalEquipesAtivas} {totalEquipesAtivas === 1 ? "equipe" : "equipes"}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {/* Equipes com problemas - Destaque */}
          {equipesComProblema.length > 0 && (
            <div className="p-3 border-b bg-destructive/5">
              <div className="text-xs font-semibold text-destructive mb-2 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                ATENÇÃO NECESSÁRIA
              </div>
              <div className="space-y-2">
                {equipesComProblema.map((equipe) => (
                  <EquipeCard
                    key={equipe.id}
                    equipe={equipe}
                    onSelect={() => onSelectEquipe(equipe.id)}
                    onChat={() => onOpenChat(equipe.id)}
                    onLigar={() => equipe.telefone && onLigar(equipe.telefone)}
                    destaque
                  />
                ))}
              </div>
            </div>
          )}

          {/* Equipes em intervalo */}
          {equipesEmIntervalo.length > 0 && (
            <div className="p-3 border-b">
              <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Coffee className="h-3.5 w-3.5" />
                EM INTERVALO ({equipesEmIntervalo.length})
              </div>
              <div className="space-y-2">
                {equipesEmIntervalo.map((equipe) => (
                  <EquipeCard
                    key={equipe.id}
                    equipe={equipe}
                    onSelect={() => onSelectEquipe(equipe.id)}
                    onChat={() => onOpenChat(equipe.id)}
                    onLigar={() => equipe.telefone && onLigar(equipe.telefone)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Equipes normais */}
          {equipesNormais.length > 0 && (
            <div className="p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5" />
                OPERANDO NORMALMENTE ({equipesNormais.length})
              </div>
              <div className="space-y-2">
                {equipesNormais.map((equipe) => (
                  <EquipeCard
                    key={equipe.id}
                    equipe={equipe}
                    onSelect={() => onSelectEquipe(equipe.id)}
                    onChat={() => onOpenChat(equipe.id)}
                    onLigar={() => equipe.telefone && onLigar(equipe.telefone)}
                  />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface EquipeCardProps {
  equipe: EquipeDestaque;
  onSelect: () => void;
  onChat: () => void;
  onLigar: () => void;
  destaque?: boolean;
}

function EquipeCard({ equipe, onSelect, onChat, onLigar, destaque }: EquipeCardProps) {
  const config = STATUS_CONFIG[equipe.status];
  const Icon = config.icon;
  const progresso = equipe.osTotal 
    ? Math.round((equipe.osConcluidas || 0) / equipe.osTotal * 100) 
    : 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md",
        config.color,
        destaque && "ring-1 ring-destructive/50"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center",
            equipe.status === "ociosa" && "bg-amber-500/20",
            equipe.status === "atrasada" && "bg-red-500/20",
            equipe.status === "offline" && "bg-slate-500/20",
            equipe.status === "problema" && "bg-red-500/20",
            equipe.status === "em_intervalo" && "bg-blue-500/20",
            equipe.status === "normal" && "bg-green-500/20"
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">{equipe.codigo}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[120px]">
              {equipe.nome}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onChat(); }}
            title="Abrir chat"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </Button>
          {equipe.telefone && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onLigar(); }}
              title="Ligar"
            >
              <Phone className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            title="Ver detalhes"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Info específica do status */}
      <div className="mt-2 space-y-2">
        {equipe.status === "ociosa" && equipe.tempoOcioso != null && (
          <div className="flex items-center gap-2 text-xs">
            <Timer className="h-3 w-3" />
            <span className="font-medium">Ociosa há {formatMinutes(equipe.tempoOcioso)}</span>
            {equipe.tempoOcioso >= 10 && (
              <Badge variant="destructive" className="text-[10px] h-4">
                Crítico
              </Badge>
            )}
          </div>
        )}

        {equipe.status === "em_intervalo" && (
          <div className="flex items-center gap-2 text-xs">
            <Coffee className="h-3 w-3" />
            <span>{equipe.tipoIntervalo || "Intervalo"}</span>
            {equipe.tempoIntervalo != null && (
              <span className="text-muted-foreground">
                há {formatMinutes(equipe.tempoIntervalo)}
              </span>
            )}
          </div>
        )}

        {equipe.status === "atrasada" && equipe.minutosDesvio != null && (
          <div className="flex items-center gap-2 text-xs">
            <TrendingDown className="h-3 w-3" />
            <span className="font-medium">
              {formatMinutes(Math.abs(equipe.minutosDesvio))} de atraso
            </span>
          </div>
        )}

        {/* Barra de progresso */}
        {equipe.osTotal != null && equipe.osTotal > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">
                {equipe.osConcluidas}/{equipe.osTotal} OS
              </span>
              <span className="font-medium">{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-1.5" />
          </div>
        )}

        {/* Tendência */}
        {equipe.tendencia && equipe.tendencia !== "no_prazo" && (
          <div className={cn(
            "flex items-center gap-1.5 text-[10px] font-medium",
            equipe.tendencia === "adiantado" ? "text-green-600" : "text-red-600"
          )}>
            {equipe.tendencia === "adiantado" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {equipe.tendencia === "adiantado" ? "Adiantada" : "Atrasada"}
          </div>
        )}
      </div>
    </div>
  );
}

