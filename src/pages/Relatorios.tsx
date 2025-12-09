import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Zap,
  DollarSign,
  Car,
  Download,
  FileText,
  TrendingUp,
  Clock,
  Target,
  Award,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const evolutionData = [
  { data: "01/12", servicos: 520, meta: 500 },
  { data: "02/12", servicos: 485, meta: 500 },
  { data: "03/12", servicos: 540, meta: 500 },
  { data: "04/12", servicos: 510, meta: 500 },
  { data: "05/12", servicos: 620, meta: 550 },
  { data: "06/12", servicos: 580, meta: 550 },
  { data: "07/12", servicos: 490, meta: 550 },
  { data: "08/12", servicos: 610, meta: 550 },
  { data: "09/12", servicos: 523, meta: 550 },
];

const tipoServicoData = [
  { tipo: "Corte", quantidade: 2450, faturamento: 110250 },
  { tipo: "Religa", quantidade: 1820, faturamento: 63700 },
  { tipo: "Inspeção", quantidade: 980, faturamento: 58800 },
  { tipo: "Ligação Nova", quantidade: 597, faturamento: 44775 },
];

const rankingEquipes = [
  { rank: 1, equipe: "EQ-007", tecnico: "Carlos Santos", totalOs: 189, media: 21.0, conclusao: 94.2, tempoMedio: "28 min" },
  { rank: 2, equipe: "EQ-001", tecnico: "João Silva", totalOs: 175, media: 19.4, conclusao: 92.8, tempoMedio: "30 min" },
  { rank: 3, equipe: "EQ-023", tecnico: "Ana Costa", totalOs: 168, media: 18.7, conclusao: 91.5, tempoMedio: "32 min" },
  { rank: 4, equipe: "EQ-002", tecnico: "Pedro Costa", totalOs: 162, media: 18.0, conclusao: 90.1, tempoMedio: "33 min" },
  { rank: 5, equipe: "EQ-009", tecnico: "Maria Santos", totalOs: 155, media: 17.2, conclusao: 88.5, tempoMedio: "35 min" },
];

const reportTypes = [
  { icon: BarChart3, title: "Produtividade", description: "Análise de produtividade por equipe", active: true },
  { icon: Zap, title: "Reguladas", description: "Cumprimento de prazos legais", active: false },
  { icon: DollarSign, title: "Faturamento", description: "Análise de receita por período", active: false },
  { icon: Car, title: "Rotas", description: "Eficiência de deslocamento", active: false },
];

const Relatorios = () => {
  return (
    <MainLayout
      title="Relatórios"
      subtitle="Análise de desempenho e produtividade"
      breadcrumbs={[{ label: "Relatórios" }]}
    >
      {/* Report Type Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {reportTypes.map((report, i) => (
          <div
            key={i}
            className={`rounded-xl border p-4 cursor-pointer transition-all ${
              report.active
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                report.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                <report.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">{report.title}</h3>
                <p className="text-xs text-muted-foreground">{report.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            <input
              type="date"
              defaultValue="2025-12-01"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="text-muted-foreground">até</span>
            <input
              type="date"
              defaultValue="2025-12-09"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Equipes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Equipes</SelectItem>
              <SelectItem value="eq-001">EQ-001</SelectItem>
              <SelectItem value="eq-007">EQ-007</SelectItem>
              <SelectItem value="eq-023">EQ-023</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Atualizar
          </Button>
          <div className="flex-1" />
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Total de OS</span>
          </div>
          <p className="text-3xl font-bold text-foreground">5.847</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-5 w-5 text-success" />
            <span className="text-sm text-muted-foreground">Concluídas</span>
          </div>
          <p className="text-3xl font-bold text-success">5.234</p>
          <p className="text-sm text-muted-foreground">89.5%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-secondary" />
            <span className="text-sm text-muted-foreground">Média/Equipe/Dia</span>
          </div>
          <p className="text-3xl font-bold text-foreground">14.2</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-warning" />
            <span className="text-sm text-muted-foreground">Tempo Médio</span>
          </div>
          <p className="text-3xl font-bold text-foreground">31 min</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Evolution Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Evolução de Serviços</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData}>
                <defs>
                  <linearGradient id="colorServicos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="servicos"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorServicos)"
                  name="Serviços"
                />
                <Area
                  type="monotone"
                  dataKey="meta"
                  stroke="hsl(38, 92%, 50%)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="transparent"
                  name="Meta"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Service Type Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Serviços por Tipo</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tipoServicoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="tipo" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="quantidade" fill="hsl(217, 91%, 60%)" name="Quantidade" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Ranking Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Ranking de Equipes</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-16">#</TableHead>
              <TableHead>Equipe</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead className="text-right">Total OS</TableHead>
              <TableHead className="text-right">Média/dia</TableHead>
              <TableHead className="text-right">% Conclusão</TableHead>
              <TableHead className="text-right">Tempo Médio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankingEquipes.map((eq) => (
              <TableRow key={eq.rank}>
                <TableCell>
                  <span className={`font-bold ${
                    eq.rank === 1 ? "text-warning" :
                    eq.rank === 2 ? "text-muted-foreground" :
                    eq.rank === 3 ? "text-amber-600" :
                    "text-muted-foreground"
                  }`}>
                    {eq.rank}.
                  </span>
                </TableCell>
                <TableCell className="font-medium">{eq.equipe}</TableCell>
                <TableCell>{eq.tecnico}</TableCell>
                <TableCell className="text-right font-medium">{eq.totalOs}</TableCell>
                <TableCell className="text-right">{eq.media}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={eq.conclusao >= 90 ? "success" : eq.conclusao >= 85 ? "warning" : "danger"}>
                    {eq.conclusao}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{eq.tempoMedio}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </MainLayout>
  );
};

export default Relatorios;
