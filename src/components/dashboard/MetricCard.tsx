import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "primary" | "success" | "warning" | "danger" | "info" | "secondary";
  className?: string;
}

const colorClasses = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  secondary: "bg-secondary/10 text-secondary",
};

const trendColors = {
  up: "text-success",
  down: "text-danger",
  neutral: "text-muted-foreground",
};

export function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  trendValue,
  color = "primary",
  className,
}: MetricCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className={cn("metric-card animate-fade-in", className)}>
      <div className="flex items-start justify-between">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && trendValue && (
          <div className={cn("flex items-center gap-1 text-sm font-medium", trendColors[trend])}>
            <TrendIcon className="h-4 w-4" />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-3xl font-bold text-foreground">{value}</h3>
        <p className="text-sm font-medium text-muted-foreground mt-1">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
