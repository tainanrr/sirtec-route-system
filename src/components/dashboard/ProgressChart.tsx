import { Progress } from "@/components/ui/progress";

interface ProgressChartProps {
  title: string;
  current: number;
  goal: number;
  unit?: string;
}

export function ProgressChart({ title, current, goal, unit = "serviços" }: ProgressChartProps) {
  const percentage = Math.round((current / goal) * 100);
  const remaining = goal - current;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-6">{title}</h3>
      
      <div className="space-y-6">
        <div className="relative">
          <Progress value={percentage} className="h-4" />
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-bold text-foreground pr-2">
            {percentage}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-2xl font-bold text-foreground">{goal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Meta</p>
          </div>
          <div className="rounded-lg bg-success/10 p-3">
            <p className="text-2xl font-bold text-success">{current.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Atual</p>
          </div>
          <div className="rounded-lg bg-warning/10 p-3">
            <p className="text-2xl font-bold text-warning">{remaining.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Faltam</p>
          </div>
        </div>
      </div>
    </div>
  );
}
