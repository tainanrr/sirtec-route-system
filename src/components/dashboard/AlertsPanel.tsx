import { AlertTriangle, MapPin, Phone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: "critical" | "high" | "medium";
  title: string;
  description: string;
  time: string;
}

const alerts: Alert[] = [
  {
    id: "1",
    type: "critical",
    title: "EQ-015 - Desvio de rota",
    description: "Equipe fora da rota há 12 minutos",
    time: "há 12 min",
  },
  {
    id: "2",
    type: "high",
    title: "Regulada #45821 em risco",
    description: "Prazo: 17:00 - ETA atual: 17:25",
    time: "há 5 min",
  },
  {
    id: "3",
    type: "medium",
    title: "EQ-023 - Parada não programada",
    description: "Parado há 8 minutos sem justificativa",
    time: "há 8 min",
  },
];

const typeClasses = {
  critical: "border-l-danger bg-danger/5",
  high: "border-l-warning bg-warning/5",
  medium: "border-l-info bg-info/5",
};

const dotClasses = {
  critical: "bg-danger",
  high: "bg-warning",
  medium: "bg-info",
};

export function AlertsPanel() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <h3 className="text-lg font-semibold text-foreground">Alertas Recentes</h3>
        </div>
        <span className="text-sm text-muted-foreground">{alerts.length} ativos</span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "rounded-lg border-l-4 p-4 transition-colors hover:bg-muted/50",
              typeClasses[alert.type]
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full animate-pulse", dotClasses[alert.type])} />
                <span className="font-medium text-foreground text-sm">{alert.title}</span>
              </div>
              <span className="text-xs text-muted-foreground">{alert.time}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 ml-4">{alert.description}</p>
            <div className="flex gap-2 mt-3 ml-4">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <MapPin className="h-3 w-3" />
                Ver no mapa
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <CheckCircle className="h-3 w-3" />
                Resolver
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="ghost" className="w-full mt-4 text-sm">
        Ver todos os alertas →
      </Button>
    </div>
  );
}
