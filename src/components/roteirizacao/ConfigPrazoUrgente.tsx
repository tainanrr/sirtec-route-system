import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Calendar, AlertTriangle, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useConfigUrgencia } from "@/hooks/useConfigUrgencia";

interface ConfigPrazoUrgenteProps {
  className?: string;
  /** Callback quando o prazo limite muda */
  onPrazoChange?: (novoPrazo: Date) => void;
  /** Modo compacto - apenas ícone */
  compact?: boolean;
}

/**
 * Componente para configurar o prazo limite para OSs urgentes.
 * OSs reguladas com prazo até esta data/hora são consideradas urgentes.
 * 
 * Funcionalidades:
 * - Edição de data e hora
 * - Reset para o padrão (próximo dia às 10h)
 * - Salva automaticamente no banco por usuário
 * - Reseta automaticamente às 00:01 de cada dia
 */
export function ConfigPrazoUrgente({ className, onPrazoChange, compact = false }: ConfigPrazoUrgenteProps) {
  const { 
    prazoLimiteDate, 
    isLoading, 
    isSaving, 
    salvarPrazoLimite, 
    resetarParaPadrao,
    config
  } = useConfigUrgencia();

  const [isOpen, setIsOpen] = useState(false);
  const [dataLocal, setDataLocal] = useState("");
  const [horaLocal, setHoraLocal] = useState("");

  // Sincronizar estado local com o prazo do hook
  useEffect(() => {
    if (prazoLimiteDate) {
      setDataLocal(format(prazoLimiteDate, "yyyy-MM-dd"));
      setHoraLocal(format(prazoLimiteDate, "HH:mm"));
    }
  }, [prazoLimiteDate]);

  // Calcular se o prazo é diferente do padrão
  const prazoPadrao = new Date();
  prazoPadrao.setDate(prazoPadrao.getDate() + 1);
  prazoPadrao.setHours(10, 0, 0, 0);
  const isPersonalizado = config && !config.atualizado_automaticamente;

  // Formatar data para exibição
  const formatarPrazoExibicao = () => {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const dataPrazo = new Date(prazoLimiteDate.getFullYear(), prazoLimiteDate.getMonth(), prazoLimiteDate.getDate());
    
    let dataStr: string;
    if (dataPrazo.getTime() === hoje.getTime()) {
      dataStr = "Hoje";
    } else if (dataPrazo.getTime() === amanha.getTime()) {
      dataStr = "Amanhã";
    } else {
      dataStr = format(prazoLimiteDate, "dd/MM", { locale: ptBR });
    }

    return `${dataStr} às ${format(prazoLimiteDate, "HH:mm")}`;
  };

  // Salvar alterações
  const handleSalvar = async () => {
    if (!dataLocal || !horaLocal) return;

    const [ano, mes, dia] = dataLocal.split("-").map(Number);
    const [hora, minuto] = horaLocal.split(":").map(Number);
    
    const novoPrazo = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
    
    const sucesso = await salvarPrazoLimite(novoPrazo);
    if (sucesso) {
      onPrazoChange?.(novoPrazo);
      setIsOpen(false);
    }
  };

  // Resetar para padrão
  const handleResetar = async () => {
    const sucesso = await resetarParaPadrao();
    if (sucesso) {
      onPrazoChange?.(prazoPadrao);
      setIsOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  }

  const triggerContent = compact ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1 h-8",
            isPersonalizado && "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
            className
          )}
        >
          <AlertTriangle className={cn(
            "h-3.5 w-3.5",
            isPersonalizado ? "text-amber-600" : "text-red-500"
          )} />
          <Clock className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Prazo Urgência: {formatarPrazoExibicao()}</p>
        {isPersonalizado && <p className="text-xs text-amber-500">Personalizado</p>}
      </TooltipContent>
    </Tooltip>
  ) : (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "gap-2 h-8 text-xs",
        isPersonalizado && "border-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
        className
      )}
    >
      <AlertTriangle className={cn(
        "h-3.5 w-3.5",
        isPersonalizado ? "text-amber-600" : "text-red-500"
      )} />
      <span className="font-medium">Urgente até:</span>
      <span className={cn(
        "font-semibold",
        isPersonalizado ? "text-amber-700 dark:text-amber-400" : ""
      )}>
        {formatarPrazoExibicao()}
      </span>
      {isPersonalizado && (
        <span className="text-[10px] text-amber-600 dark:text-amber-500 ml-1">(Personalizado)</span>
      )}
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {triggerContent}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Prazo Limite para OSs Urgentes
            </h4>
            <p className="text-xs text-muted-foreground">
              OSs reguladas com prazo até esta data/hora serão consideradas <strong>urgentes</strong>.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="data-urgente" className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Data
                </Label>
                <Input
                  id="data-urgente"
                  type="date"
                  value={dataLocal}
                  onChange={(e) => setDataLocal(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hora-urgente" className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Hora
                </Label>
                <Input
                  id="hora-urgente"
                  type="time"
                  value={horaLocal}
                  onChange={(e) => setHoraLocal(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Preview */}
            {dataLocal && horaLocal && (
              <div className="rounded-md bg-muted/50 p-2 text-xs">
                <span className="text-muted-foreground">Preview: </span>
                <span className="font-medium">
                  {format(
                    new Date(`${dataLocal}T${horaLocal}:00`),
                    "EEEE, dd 'de' MMMM 'às' HH:mm",
                    { locale: ptBR }
                  )}
                </span>
              </div>
            )}

            <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 rounded-md p-2 border border-amber-200 dark:border-amber-800">
              <strong>💡 Dica:</strong> Esta configuração é salva automaticamente e será resetada às 00:01 do próximo dia para o padrão (dia seguinte às 10h).
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetar}
              disabled={isSaving}
              className="gap-1 text-xs h-7"
            >
              <RotateCcw className="h-3 w-3" />
              Resetar Padrão
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSalvar}
                disabled={isSaving || !dataLocal || !horaLocal}
                className="gap-1 h-7 text-xs"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
