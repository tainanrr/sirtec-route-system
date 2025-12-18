import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiasRetencaoBadgeProps {
  dataEntregaEquipe: string | null;
  diasAlertaRetencao?: number;
  showIcon?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Calcula o número de dias desde uma data até agora
 */
export function calcularDiasDesde(data: string | Date | null): number {
  if (!data) return 0;
  const dataInicio = new Date(data);
  const agora = new Date();
  const diffTime = agora.getTime() - dataInicio.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Determina o nível de alerta baseado nos dias de retenção
 */
export function getNivelAlerta(dias: number, diasAlerta: number = 7): "normal" | "atencao" | "alerta" | "critico" {
  if (dias >= diasAlerta * 2) return "critico";
  if (dias >= diasAlerta) return "alerta";
  if (dias >= diasAlerta * 0.7) return "atencao";
  return "normal";
}

/**
 * Configuração visual para cada nível de alerta
 */
const NIVEL_CONFIG = {
  normal: {
    bgColor: "bg-slate-100 dark:bg-slate-800",
    textColor: "text-slate-600 dark:text-slate-300",
    borderColor: "border-slate-200 dark:border-slate-700",
    icon: Clock,
    label: "Normal",
  },
  atencao: {
    bgColor: "bg-amber-50 dark:bg-amber-900/30",
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-200 dark:border-amber-700",
    icon: Clock,
    label: "Atenção",
  },
  alerta: {
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    textColor: "text-orange-700 dark:text-orange-300",
    borderColor: "border-orange-300 dark:border-orange-700",
    icon: AlertTriangle,
    label: "Alerta",
  },
  critico: {
    bgColor: "bg-red-100 dark:bg-red-900/30",
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-300 dark:border-red-700",
    icon: AlertCircle,
    label: "Crítico",
  },
};

const SIZE_CONFIG = {
  sm: {
    badge: "text-[10px] px-1.5 py-0.5 whitespace-nowrap",
    icon: "h-3 w-3 shrink-0",
    gap: "gap-0.5",
  },
  md: {
    badge: "text-xs px-2 py-1 whitespace-nowrap",
    icon: "h-3.5 w-3.5 shrink-0",
    gap: "gap-1",
  },
  lg: {
    badge: "text-sm px-3 py-1.5 whitespace-nowrap",
    icon: "h-4 w-4 shrink-0",
    gap: "gap-1.5",
  },
};

/**
 * Badge que mostra quantos dias um material está com a equipe
 * Com indicação visual do nível de alerta baseado na configuração do material
 */
export function DiasRetencaoBadge({
  dataEntregaEquipe,
  diasAlertaRetencao = 7,
  showIcon = true,
  showTooltip = true,
  size = "md",
  className,
}: DiasRetencaoBadgeProps) {
  if (!dataEntregaEquipe) {
    return null;
  }

  const dias = calcularDiasDesde(dataEntregaEquipe);
  const nivel = getNivelAlerta(dias, diasAlertaRetencao);
  const config = NIVEL_CONFIG[nivel];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeConfig.badge,
        sizeConfig.gap,
        "inline-flex items-center",
        className
      )}
    >
      {showIcon && <Icon className={sizeConfig.icon} />}
      <span className="whitespace-nowrap">{dias}d</span>
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <p className="font-medium">
            {nivel === "normal" && "Material dentro do prazo"}
            {nivel === "atencao" && "Material próximo do prazo de alerta"}
            {nivel === "alerta" && "⚠️ Material ultrapassou o prazo de alerta"}
            {nivel === "critico" && "🚨 Material em situação crítica de retenção"}
          </p>
          <p className="text-muted-foreground mt-1">
            Entregue há {dias} dias • Alerta configurado: {diasAlertaRetencao} dias
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Componente compacto para uso em tabelas - mostra apenas o número de dias
 */
export function DiasRetencaoCompacto({
  dataEntregaEquipe,
  diasAlertaRetencao = 7,
  className,
}: {
  dataEntregaEquipe: string | null;
  diasAlertaRetencao?: number;
  className?: string;
}) {
  if (!dataEntregaEquipe) {
    return <span className="text-muted-foreground">-</span>;
  }

  const dias = calcularDiasDesde(dataEntregaEquipe);
  const nivel = getNivelAlerta(dias, diasAlertaRetencao);
  const config = NIVEL_CONFIG[nivel];

  return (
    <span className={cn("font-medium", config.textColor, className)}>
      {dias}d
    </span>
  );
}

/**
 * Card de resumo de alertas de retenção para dashboards
 */
export function ResumoAlertasRetencao({
  totalComEquipe,
  totalEmAlerta,
  totalCritico,
  totalAtencao,
  className,
}: {
  totalComEquipe: number;
  totalEmAlerta: number;
  totalCritico: number;
  totalAtencao: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-4 gap-4", className)}>
      <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
        <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
          {totalComEquipe}
        </div>
        <div className="text-xs text-muted-foreground">Com Equipes</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30">
        <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
          {totalAtencao}
        </div>
        <div className="text-xs text-amber-600 dark:text-amber-400">Atenção</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/30">
        <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
          {totalEmAlerta}
        </div>
        <div className="text-xs text-orange-600 dark:text-orange-400">Em Alerta</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/30">
        <div className="text-2xl font-bold text-red-700 dark:text-red-300">
          {totalCritico}
        </div>
        <div className="text-xs text-red-600 dark:text-red-400">Críticos</div>
      </div>
    </div>
  );
}

export default DiasRetencaoBadge;

