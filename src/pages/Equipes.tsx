import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Phone,
  MessageSquare,
  Car,
  Coffee,
  AlertTriangle,
  Wifi,
  WifiOff,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Equipe {
  id: string;
  codigo: string;
  tecnico: string;
  status: "em_rota" | "em_atendimento" | "pausa" | "offline" | "alerta";
  progresso: { atual: number; total: number };
  osAtual: string | null;
  proximaOs: string | null;
  ultimoContato: string;
  kmRodados: number;
}

const equipes: Equipe[] = [
  { id: "1", codigo: "EQ-001", tecnico: "João Silva", status: "em_rota", progresso: { atual: 12, total: 18 }, osAtual: "#45834", proximaOs: "#45845", ultimoContato: "agora", kmRodados: 32.5 },
  { id: "2", codigo: "EQ-002", tecnico: "Pedro Costa", status: "em_atendimento", progresso: { atual: 8, total: 15 }, osAtual: "#45819", proximaOs: "#45820", ultimoContato: "2 min", kmRodados: 28.3 },
  { id: "3", codigo: "EQ-003", tecnico: "Maria Santos", status: "pausa", progresso: { atual: 10, total: 16 }, osAtual: null, proximaOs: "#45850", ultimoContato: "5 min", kmRodados: 25.1 },
  { id: "4", codigo: "EQ-007", tecnico: "Carlos Santos", status: "em_rota", progresso: { atual: 18, total: 18 }, osAtual: null, proximaOs: null, ultimoContato: "agora", kmRodados: 45.2 },
  { id: "5", codigo: "EQ-009", tecnico: "Ana Lima", status: "em_atendimento", progresso: { atual: 6, total: 14 }, osAtual: "#45856", proximaOs: "#45857", ultimoContato: "1 min", kmRodados: 18.7 },
  { id: "6", codigo: "EQ-012", tecnico: "Roberto Alves", status: "em_rota", progresso: { atual: 9, total: 15 }, osAtual: "#45870", proximaOs: "#45871", ultimoContato: "agora", kmRodados: 22.4 },
  { id: "7", codigo: "EQ-015", tecnico: "Carlos Souza", status: "alerta", progresso: { atual: 5, total: 14 }, osAtual: "#45880", proximaOs: "#45881", ultimoContato: "12 min", kmRodados: 15.8 },
  { id: "8", codigo: "EQ-023", tecnico: "Fernanda Lima", status: "offline", progresso: { atual: 0, total: 12 }, osAtual: null, proximaOs: "#45900", ultimoContato: "30 min", kmRodados: 0 },
];

const statusConfig = {
  em_rota: { label: "Em Rota", icon: Car, color: "bg-success", dotColor: "bg-success" },
  em_atendimento: { label: "Em Atendimento", icon: MapPin, color: "bg-primary", dotColor: "bg-primary" },
  pausa: { label: "Pausa", icon: Coffee, color: "bg-warning", dotColor: "bg-warning" },
  offline: { label: "Offline", icon: WifiOff, color: "bg-muted", dotColor: "bg-muted-foreground" },
  alerta: { label: "Alerta", icon: AlertTriangle, color: "bg-danger", dotColor: "bg-danger" },
};

const Equipes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredEquipes = equipes.filter((equipe) => {
    const matchesSearch =
      equipe.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      equipe.tecnico.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || equipe.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = equipes.reduce((acc, eq) => {
    acc[eq.status] = (acc[eq.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <MainLayout
      title="Equipes"
      subtitle="Monitoramento e gestão das equipes de campo"
      breadcrumbs={[{ label: "Equipes" }]}
    >
      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = statusCounts[key] || 0;
          return (
            <div
              key={key}
              className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}
            >
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", config.color + "/10")}>
                <config.icon className={cn("h-5 w-5", config.color.replace("bg-", "text-"))} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar equipe ou técnico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Equipe
          </Button>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEquipes.map((equipe) => {
          const config = statusConfig[equipe.status];
          const progressPercent = Math.round((equipe.progresso.atual / equipe.progresso.total) * 100);

          return (
            <div
              key={equipe.id}
              className={cn(
                "rounded-xl border bg-card p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
                equipe.status === "alerta" ? "border-danger/50" : "border-border"
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {equipe.tecnico.split(" ").map(n => n[0]).join("")}
                    </div>
                    <span className={cn("absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card", config.dotColor)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{equipe.codigo}</h3>
                      {equipe.status === "alerta" && (
                        <Badge variant="danger" className="text-[10px] px-1.5">ALERTA</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{equipe.tecnico}</p>
                  </div>
                </div>
                <Badge variant={equipe.status === "em_rota" || equipe.status === "em_atendimento" ? "success" : "secondary"}>
                  {config.label}
                </Badge>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium text-foreground">
                    {equipe.progresso.atual}/{equipe.progresso.total} ({progressPercent}%)
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm mb-4">
                {equipe.osAtual && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OS Atual:</span>
                    <span className="font-medium text-foreground">{equipe.osAtual}</span>
                  </div>
                )}
                {equipe.proximaOs && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Próxima:</span>
                    <span className="text-foreground">{equipe.proximaOs}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Km rodados:</span>
                  <span className="text-foreground">{equipe.kmRodados.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último contato:</span>
                  <span className={cn(
                    "text-foreground",
                    equipe.ultimoContato.includes("min") && parseInt(equipe.ultimoContato) > 10 && "text-warning"
                  )}>
                    {equipe.ultimoContato}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1 gap-1">
                  <MapPin className="h-4 w-4" />
                  Ver Rota
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </MainLayout>
  );
};

export default Equipes;
