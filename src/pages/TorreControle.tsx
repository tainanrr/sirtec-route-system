import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Radio,
  ClipboardList,
  CheckCircle2,
  RefreshCcw,
  Clock,
  AlertTriangle,
  Car,
  MapPin,
  Phone,
  MessageSquare,
  Coffee,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Alerta {
  id: string;
  tipo: "critical" | "high" | "medium";
  titulo: string;
  descricao: string;
  equipe: string;
  tempo: string;
}

interface Equipe {
  id: string;
  codigo: string;
  tecnico: string;
  status: "em_rota" | "atendimento" | "pausa" | "offline" | "alerta";
  progresso: { atual: number; total: number };
  osAtual: string | null;
  proximaOs: string | null;
  eta: string | null;
}

interface Atividade {
  id: string;
  hora: string;
  tipo: "concluiu" | "iniciou" | "chegou" | "alerta" | "nova";
  mensagem: string;
  detalhes: string;
}

const alertas: Alerta[] = [
  { id: "1", tipo: "critical", titulo: "EQ-015 - Desvio de rota", descricao: "Equipe fora da rota há 12 minutos", equipe: "EQ-015", tempo: "há 2 min" },
  { id: "2", tipo: "high", titulo: "Regulada #45821 em risco", descricao: "Prazo: 17:00 - ETA atual: 17:25", equipe: "EQ-001", tempo: "há 5 min" },
  { id: "3", tipo: "medium", titulo: "EQ-023 - Parada não programada", descricao: "Parado há 8 minutos", equipe: "EQ-023", tempo: "há 8 min" },
];

const equipes: Equipe[] = [
  { id: "1", codigo: "EQ-001", tecnico: "João Silva", status: "em_rota", progresso: { atual: 12, total: 18 }, osAtual: "#45834", proximaOs: "#45845", eta: "10 min" },
  { id: "2", codigo: "EQ-002", tecnico: "Pedro Costa", status: "atendimento", progresso: { atual: 8, total: 15 }, osAtual: "#45819", proximaOs: null, eta: null },
  { id: "3", codigo: "EQ-003", tecnico: "Maria Santos", status: "pausa", progresso: { atual: 10, total: 16 }, osAtual: null, proximaOs: "#45850", eta: "13:30" },
  { id: "4", codigo: "EQ-015", tecnico: "Carlos Souza", status: "alerta", progresso: { atual: 5, total: 14 }, osAtual: "#45880", proximaOs: null, eta: null },
];

const atividades: Atividade[] = [
  { id: "1", hora: "14:32", tipo: "concluiu", mensagem: "EQ-007 concluiu OS #45856", detalhes: "Corte - Rua Industrial, 500" },
  { id: "2", hora: "14:30", tipo: "iniciou", mensagem: "EQ-012 iniciou deslocamento", detalhes: "Para OS #45843" },
  { id: "3", hora: "14:28", tipo: "chegou", mensagem: "EQ-001 chegou ao local", detalhes: "OS #45834 - Av. Brasil, 456" },
  { id: "4", hora: "14:25", tipo: "alerta", mensagem: "Alerta gerado", detalhes: "EQ-015 - Desvio de rota" },
  { id: "5", hora: "14:22", tipo: "concluiu", mensagem: "EQ-023 concluiu OS #45851", detalhes: "Religa - Rua Comercial, 78" },
  { id: "6", hora: "14:20", tipo: "nova", mensagem: "Nova religa adicionada", detalhes: "OS #45890 - Prioridade alta" },
];

const statusConfig = {
  em_rota: { label: "Em Rota", color: "bg-success", dotColor: "bg-success" },
  atendimento: { label: "Em Atendimento", color: "bg-primary", dotColor: "bg-primary" },
  pausa: { label: "Pausa", color: "bg-warning", dotColor: "bg-warning" },
  offline: { label: "Offline", color: "bg-muted", dotColor: "bg-muted-foreground" },
  alerta: { label: "Alerta", color: "bg-danger", dotColor: "bg-danger" },
};

const tipoIcone = {
  concluiu: <CheckCircle2 className="h-4 w-4 text-success" />,
  iniciou: <Car className="h-4 w-4 text-primary" />,
  chegou: <MapPin className="h-4 w-4 text-primary" />,
  alerta: <AlertTriangle className="h-4 w-4 text-warning" />,
  nova: <RefreshCcw className="h-4 w-4 text-info" />,
};

const TorreControle = () => {
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const [equipeFilter, setEquipeFilter] = useState<string>("all");

  return (
    <MainLayout
      title="Torre de Controle"
      subtitle="Monitoramento em tempo real"
      breadcrumbs={[{ label: "Torre de Controle" }]}
    >
      {/* Live Indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-danger/10 border border-danger/20">
            <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
            <span className="text-sm font-medium text-danger">AO VIVO</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR")} {new Date().toLocaleTimeString("pt-BR")}
          </span>
        </div>
        <Badge variant="danger" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {alertas.length} alertas ativos
        </Badge>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          { icon: ClipboardList, label: "Total", value: "847", color: "text-foreground" },
          { icon: CheckCircle2, label: "Feitos", value: "523", sub: "61.7%", color: "text-success" },
          { icon: RefreshCcw, label: "Fazendo", value: "89", sub: "10.5%", color: "text-primary" },
          { icon: Clock, label: "Restam", value: "235", sub: "27.7%", color: "text-muted-foreground" },
          { icon: AlertTriangle, label: "Atraso", value: "23", sub: "2.7%", color: "text-danger" },
          { icon: Car, label: "Em Rota", value: "42", sub: "93.3%", color: "text-success" },
        ].map((metric, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <metric.icon className={cn("h-5 w-5", metric.color)} />
              <span className="text-xs text-muted-foreground">{metric.label}</span>
            </div>
            <p className={cn("text-2xl font-bold", metric.color)}>{metric.value}</p>
            {metric.sub && <p className="text-xs text-muted-foreground">{metric.sub}</p>}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map */}
        <div className="lg:col-span-8 rounded-xl border border-border bg-card overflow-hidden">
          <div className="relative h-[500px] bg-muted/30">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mx-auto">
                  <Radio className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">Mapa em Tempo Real</p>
                  <p className="text-sm text-muted-foreground">Acompanhe todas as equipes</p>
                </div>
              </div>
            </div>

            {/* Simulated moving markers */}
            <div className="absolute top-1/4 left-1/4 h-5 w-5 rounded-full bg-success border-2 border-card shadow-lg animate-pulse flex items-center justify-center">
              <Car className="h-3 w-3 text-success-foreground" />
            </div>
            <div className="absolute top-1/3 left-1/2 h-5 w-5 rounded-full bg-primary border-2 border-card shadow-lg flex items-center justify-center">
              <MapPin className="h-3 w-3 text-primary-foreground" />
            </div>
            <div className="absolute top-1/2 right-1/3 h-5 w-5 rounded-full bg-warning border-2 border-card shadow-lg flex items-center justify-center">
              <Coffee className="h-3 w-3 text-warning-foreground" />
            </div>
            <div className="absolute top-2/3 left-1/3 h-5 w-5 rounded-full bg-danger border-2 border-card shadow-lg animate-pulse flex items-center justify-center">
              <AlertTriangle className="h-3 w-3 text-danger-foreground" />
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-success" /> Em deslocamento
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-primary" /> Em atendimento
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-warning" /> Pausa
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-danger" /> Alerta
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button size="icon" variant="secondary" className="h-8 w-8">+</Button>
              <Button size="icon" variant="secondary" className="h-8 w-8">-</Button>
            </div>

            <div className="absolute top-4 left-4 flex items-center gap-2">
              <Badge className="bg-success/90">
                <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
                Auto-refresh: ON
              </Badge>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card overflow-hidden">
          <Tabs defaultValue="alertas" className="h-full flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0">
              <TabsTrigger value="alertas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-3">
                Alertas
              </TabsTrigger>
              <TabsTrigger value="equipes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-3">
                Equipes
              </TabsTrigger>
              <TabsTrigger value="atividade" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-3">
                Atividade
              </TabsTrigger>
            </TabsList>

            <TabsContent value="alertas" className="flex-1 overflow-hidden m-0">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-danger" />
                    Alertas Ativos
                  </h4>
                  <Badge variant="danger">{alertas.length}</Badge>
                </div>
                <Select value={alertFilter} onValueChange={setAlertFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="critical">Críticos</SelectItem>
                    <SelectItem value="high">Altos</SelectItem>
                    <SelectItem value="medium">Médios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-[380px] overflow-y-auto p-2 space-y-2">
                {alertas.map((alerta) => (
                  <div
                    key={alerta.id}
                    className={cn(
                      "rounded-lg border-l-4 p-3 bg-card",
                      alerta.tipo === "critical" && "border-l-danger bg-danger/5",
                      alerta.tipo === "high" && "border-l-warning bg-warning/5",
                      alerta.tipo === "medium" && "border-l-info bg-info/5"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm text-foreground">{alerta.titulo}</span>
                      <span className="text-xs text-muted-foreground">{alerta.tempo}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{alerta.descricao}</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 text-xs gap-1">
                        <MapPin className="h-3 w-3" /> Ver
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Resolver
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs gap-1">
                        <Phone className="h-3 w-3" /> Ligar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="equipes" className="flex-1 overflow-hidden m-0">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-foreground">Equipes</h4>
                  <Badge variant="secondary">{equipes.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar equipe..." className="pl-9" />
                </div>
              </div>
              <div className="max-h-[380px] overflow-y-auto p-2 space-y-2">
                {equipes.map((equipe) => {
                  const config = statusConfig[equipe.status];
                  return (
                    <div
                      key={equipe.id}
                      className={cn(
                        "rounded-lg border p-3",
                        equipe.status === "alerta" ? "border-danger/50" : "border-border"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", config.dotColor)} />
                          <span className="font-medium text-foreground">{equipe.codigo}</span>
                          {equipe.status === "alerta" && (
                            <Badge variant="danger" className="text-[10px]">ALERTA</Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{config.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{equipe.tecnico}</p>
                      <div className="mb-2">
                        <Progress value={(equipe.progresso.atual / equipe.progresso.total) * 100} className="h-1" />
                        <span className="text-[10px] text-muted-foreground">
                          {equipe.progresso.atual}/{equipe.progresso.total}
                        </span>
                      </div>
                      {equipe.osAtual && (
                        <p className="text-xs text-muted-foreground">
                          Atual: <span className="text-foreground">{equipe.osAtual}</span>
                          {equipe.eta && <span className="ml-2">ETA: {equipe.eta}</span>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="atividade" className="flex-1 overflow-hidden m-0">
              <div className="p-4 border-b border-border">
                <h4 className="font-medium text-foreground">Atividade Recente</h4>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-2 space-y-1">
                {atividades.map((ativ) => (
                  <div key={ativ.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-xs text-muted-foreground w-10 flex-shrink-0">{ativ.hora}</span>
                    {tipoIcone[ativ.tipo]}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{ativ.mensagem}</p>
                      <p className="text-xs text-muted-foreground truncate">{ativ.detalhes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
};

export default TorreControle;
