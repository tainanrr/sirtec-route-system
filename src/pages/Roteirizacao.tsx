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
  Download,
  Upload,
  RefreshCcw,
  MapPin,
  Clock,
  Zap,
  DollarSign,
  Car,
  CheckCircle,
  FileText,
  Trash2,
  Edit,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServicoDisponivel {
  id: string;
  numero: string;
  tipo: string;
  endereco: string;
  prazo: string | null;
  duracao: number;
  valor: number;
  regulada: boolean;
}

interface RotaEquipe {
  id: string;
  codigo: string;
  tecnico: string;
  servicos: number;
  progresso: number;
  distancia: number;
  duracao: string;
  faturamento: number;
}

const servicosDisponiveis: ServicoDisponivel[] = [
  { id: "1", numero: "#45821", tipo: "CORTE", endereco: "Rua das Flores, 123 - Centro", prazo: "Hoje 17:00", duracao: 30, valor: 45, regulada: true },
  { id: "2", numero: "#45822", tipo: "CORTE", endereco: "Av. Brasil, 456 - Industrial", prazo: "Hoje 17:00", duracao: 30, valor: 45, regulada: true },
  { id: "3", numero: "#45823", tipo: "RELIGA", endereco: "Rua Comercial, 789 - Centro", prazo: null, duracao: 20, valor: 35, regulada: false },
  { id: "4", numero: "#45824", tipo: "CORTE", endereco: "Rua XV, 234 - Zona Sul", prazo: "Hoje 16:00", duracao: 30, valor: 45, regulada: true },
  { id: "5", numero: "#45825", tipo: "INSPEÇÃO", endereco: "Av. Central, 100 - Centro", prazo: null, duracao: 45, valor: 60, regulada: false },
];

const rotasGeradas: RotaEquipe[] = [
  { id: "1", codigo: "EQ-001", tecnico: "João Silva", servicos: 18, progresso: 100, distancia: 45.2, duracao: "7h 30min", faturamento: 810 },
  { id: "2", codigo: "EQ-002", tecnico: "Pedro Costa", servicos: 15, progresso: 85, distancia: 38.7, duracao: "6h 45min", faturamento: 675 },
  { id: "3", codigo: "EQ-003", tecnico: "Maria Santos", servicos: 16, progresso: 90, distancia: 42.1, duracao: "7h 00min", faturamento: 720 },
  { id: "4", codigo: "EQ-007", tecnico: "Carlos Santos", servicos: 14, progresso: 78, distancia: 35.5, duracao: "6h 15min", faturamento: 630 },
];

const Roteirizacao = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");

  const filteredServicos = servicosDisponiveis.filter((s) => {
    const matchesSearch = s.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.endereco.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = tipoFilter === "all" || s.tipo.toLowerCase() === tipoFilter;
    return matchesSearch && matchesTipo;
  });

  const totalAlocados = 844;
  const totalServicos = 847;
  const totalReguladas = 156;
  const totalKm = 1247;

  return (
    <MainLayout
      title="Roteirização"
      subtitle="Planejamento e otimização de rotas"
      breadcrumbs={[{ label: "Roteirização" }]}
    >
      {/* Actions Bar */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar OS
          </Button>
          
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Regiões</SelectItem>
              <SelectItem value="norte">Norte</SelectItem>
              <SelectItem value="sul">Sul</SelectItem>
              <SelectItem value="leste">Leste</SelectItem>
              <SelectItem value="oeste">Oeste</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Equipes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas (45/45)</SelectItem>
              <SelectItem value="disponiveis">Disponíveis (42)</SelectItem>
              <SelectItem value="alocadas">Alocadas (38)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Otimizar Rotas
          </Button>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Left - Service List */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Serviços Disponíveis</h3>
              <Badge variant="secondary">{servicosDisponiveis.length}</Badge>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar OS, endereço..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="corte">Corte</SelectItem>
                  <SelectItem value="religa">Religa</SelectItem>
                  <SelectItem value="inspeção">Inspeção</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="regulada">Reguladas</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto p-2 space-y-2">
            {filteredServicos.map((servico) => (
              <div
                key={servico.id}
                className={cn(
                  "rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md",
                  servico.regulada ? "border-danger/30 bg-danger/5" : "border-border bg-card"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {servico.regulada && <Zap className="h-4 w-4 text-danger" />}
                    <span className="font-medium text-foreground">{servico.numero}</span>
                    <Badge variant={servico.regulada ? "regulada" : "secondary"} className="text-[10px]">
                      {servico.tipo}
                    </Badge>
                  </div>
                  {servico.regulada && (
                    <Badge variant="danger" className="text-[10px]">REGULADA</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{servico.endereco}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {servico.prazo && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {servico.prazo}
                      </span>
                    )}
                    <span>{servico.duracao} min</span>
                  </div>
                  <span className="text-success font-medium">R$ {servico.valor}</span>
                </div>
                <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs">
                  Alocar →
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Center - Map */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-card overflow-hidden">
          <div className="relative h-[580px] bg-muted/30">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mx-auto">
                  <MapPin className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">Mapa de Roteirização</p>
                  <p className="text-sm text-muted-foreground">Visualize serviços e rotas</p>
                </div>
              </div>
            </div>
            
            {/* Simulated markers */}
            <div className="absolute top-1/4 left-1/4 h-4 w-4 rounded-full bg-danger border-2 border-card animate-pulse" />
            <div className="absolute top-1/3 left-1/2 h-4 w-4 rounded-full bg-danger border-2 border-card animate-pulse" />
            <div className="absolute top-1/2 left-1/3 h-4 w-4 rounded-full bg-warning border-2 border-card" />
            <div className="absolute top-2/3 right-1/4 h-4 w-4 rounded-full bg-success border-2 border-card" />
            <div className="absolute bottom-1/3 left-1/2 h-4 w-4 rounded-full bg-success border-2 border-card" />

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border">
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-danger" /> Reguladas
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-warning" /> Pendentes
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-success" /> Alocadas
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Routes */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Rotas do Dia</h3>
              <Badge variant="secondary">{rotasGeradas.length}</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar equipe..." className="pl-9" />
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto p-2 space-y-2">
            {rotasGeradas.map((rota) => (
              <div key={rota.id} className="rounded-lg border border-border p-3 bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">{rota.codigo}</span>
                  </div>
                  <Badge variant="secondary">{rota.servicos} OS</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{rota.tecnico}</p>
                
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Capacidade</span>
                    <span className="text-foreground">{rota.progresso}%</span>
                  </div>
                  <Progress value={rota.progresso} className="h-1.5" />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {rota.distancia} km
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {rota.duracao}
                  </span>
                  <span className="flex items-center gap-1 text-success">
                    <DollarSign className="h-3 w-3" />
                    R$ {rota.faturamento}
                  </span>
                </div>

                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs gap-1">
                    <FileText className="h-3 w-3" />
                    Detalhes
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-danger">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="text-muted-foreground">Alocados:</span>
              <span className="font-semibold text-foreground">{totalAlocados}/{totalServicos} ({((totalAlocados/totalServicos)*100).toFixed(1)}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-danger" />
              <span className="text-muted-foreground">Reguladas:</span>
              <span className="font-semibold text-foreground">{totalReguladas} (100%)</span>
            </div>
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              <span className="text-muted-foreground">Km total:</span>
              <span className="font-semibold text-foreground">{totalKm.toLocaleString()} km</span>
            </div>
          </div>

          {totalServicos - totalAlocados > 0 && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <span>⚠️ {totalServicos - totalAlocados} serviços não alocados</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline">Cancelar</Button>
            <Button variant="outline">Salvar Rascunho</Button>
            <Button className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Confirmar Rotas
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Roteirizacao;
