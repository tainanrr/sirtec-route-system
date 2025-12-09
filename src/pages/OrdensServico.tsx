import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Download,
  Filter,
  Zap,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface OrdemServico {
  id: string;
  numero: string;
  tipo: string;
  status: "pendente" | "andamento" | "concluida" | "atrasada" | "cancelada";
  endereco: string;
  equipe: string | null;
  prazo: string | null;
  regulada: boolean;
}

const ordensServico: OrdemServico[] = [
  { id: "1", numero: "#45821", tipo: "Corte", status: "andamento", endereco: "Rua das Flores, 123 - Centro", equipe: "EQ-001", prazo: "17:00", regulada: true },
  { id: "2", numero: "#45822", tipo: "Corte", status: "concluida", endereco: "Av. Brasil, 456 - Industrial", equipe: "EQ-001", prazo: "17:00", regulada: true },
  { id: "3", numero: "#45823", tipo: "Religa", status: "pendente", endereco: "Rua Comercial, 789 - Centro", equipe: "EQ-002", prazo: null, regulada: false },
  { id: "4", numero: "#45824", tipo: "Corte", status: "atrasada", endereco: "Rua XV, 234 - Zona Sul", equipe: "EQ-015", prazo: "14:00", regulada: true },
  { id: "5", numero: "#45825", tipo: "Inspeção", status: "pendente", endereco: "Av. Central, 100 - Centro", equipe: null, prazo: null, regulada: false },
  { id: "6", numero: "#45826", tipo: "Ligação", status: "concluida", endereco: "Rua Nova, 50 - Residencial", equipe: "EQ-007", prazo: null, regulada: false },
  { id: "7", numero: "#45827", tipo: "Corte", status: "pendente", endereco: "Rua Industrial, 500 - Distrito", equipe: "EQ-003", prazo: "16:00", regulada: true },
  { id: "8", numero: "#45828", tipo: "Religa", status: "andamento", endereco: "Av. Principal, 1200 - Centro", equipe: "EQ-009", prazo: null, regulada: false },
  { id: "9", numero: "#45829", tipo: "Inspeção", status: "concluida", endereco: "Rua Secundária, 80 - Jardim", equipe: "EQ-012", prazo: null, regulada: false },
  { id: "10", numero: "#45830", tipo: "Corte", status: "pendente", endereco: "Rua Terceira, 300 - Vila Nova", equipe: null, prazo: "18:00", regulada: true },
];

const statusLabels = {
  pendente: "Pendente",
  andamento: "Em Andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

const OrdensServico = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");

  const filteredOrdens = ordensServico.filter((os) => {
    const matchesSearch =
      os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.endereco.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || os.status === statusFilter;
    const matchesTipo = tipoFilter === "all" || os.tipo.toLowerCase() === tipoFilter;
    return matchesSearch && matchesStatus && matchesTipo;
  });

  return (
    <MainLayout
      title="Ordens de Serviço"
      subtitle="Gestão completa das ordens de serviço"
      breadcrumbs={[{ label: "Ordens de Serviço" }]}
    >
      {/* Actions Bar */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, endereço, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="atrasada">Atrasada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                <SelectItem value="corte">Corte</SelectItem>
                <SelectItem value="religa">Religa</SelectItem>
                <SelectItem value="inspeção">Inspeção</SelectItem>
                <SelectItem value="ligação">Ligação</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Mais filtros
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova OS
            </Button>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Mostrando {filteredOrdens.length} de {ordensServico.length} resultados
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">OS</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Endereço</TableHead>
              <TableHead>Equipe</TableHead>
              <TableHead className="hidden sm:table-cell">Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrdens.map((os) => (
              <TableRow
                key={os.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {os.regulada && <Zap className="h-4 w-4 text-danger" />}
                    {os.numero}
                  </div>
                </TableCell>
                <TableCell>{os.tipo}</TableCell>
                <TableCell>
                  <Badge variant={os.status}>{statusLabels[os.status]}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate max-w-[200px]">{os.endereco}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {os.equipe ? (
                    <span className="font-medium">{os.equipe}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {os.prazo ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {os.prazo}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Mostrando 1-{filteredOrdens.length} de {ordensServico.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button variant="outline" size="sm" className="w-8 p-0 bg-primary text-primary-foreground">
              1
            </Button>
            <Button variant="outline" size="sm" className="w-8 p-0">
              2
            </Button>
            <Button variant="outline" size="sm" className="w-8 p-0">
              3
            </Button>
            <Button variant="outline" size="sm">
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default OrdensServico;
