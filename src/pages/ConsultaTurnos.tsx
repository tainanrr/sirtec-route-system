import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTelaPermissao } from "@/hooks/usePermissoes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Users,
  Car,
  MapPin,
  DollarSign,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  Power,
  XCircle,
  Coffee,
  Loader2,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Route,
  Play,
  Pause,
  Target,
  TrendingUp,
  ExternalLink,
  X,
  Activity,
} from "lucide-react";
import { format, parseISO, differenceInMinutes, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { OrdemServicoDetalhesDialog } from "@/components/ordens/OrdemServicoDetalhesDialog";
import { ChecklistDetalhesDialog } from "@/components/checklists/ChecklistDetalhesDialog";

interface Turno {
  id: string;
  equipe_id: string;
  hora_inicio: string;
  hora_fim: string | null;
  km_inicial: number | null;
  km_final: number | null;
  placa_veiculo: string | null;
  status: string;
  created_at: string;
  tecnicos?: {
    id: string;
    codigo: string;
    nome: string;
    tipo_equipe: string | null;
    centro_custo_id: string | null;
  };
  turno_colaboradores?: {
    id: string;
    nome: string;
    funcao: string | null;
    responsavel: boolean;
  }[];
}

interface ProducaoTurno {
  id: string;
  ordem_servico_id: string;
  valor_total: number;
  created_at: string;
  ordens_servico?: {
    id: string;
    numero: string;
    tipo: string;
    endereco: string;
    status: string;
    cliente_nome: string | null;
  };
  retornos_campo?: {
    codigo: string;
    descricao: string;
    tipo: string;
  };
}

interface IntervaloTurno {
  id: string;
  hora_inicio: string;
  hora_fim: string | null;
  observacao: string | null;
  tipo_intervalo?: {
    nome: string;
    tipo: string;
    cor: string | null;
  };
}

interface ChecklistTurno {
  id: string;
  checklist_id: string;
  ordem_servico_id: string | null;
  created_at: string;
  checklists?: {
    nome: string;
    tipo: string;
  };
  ordens_servico?: {
    numero: string;
  };
}

// Constantes de paginação
const PAGE_SIZE = 50;

export default function ConsultaTurnos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { podeEditar } = useTelaPermissao("consulta_turnos");
  
  // Estados de filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [equipeFilter, setEquipeFilter] = useState<string>("all");
  
  // Estados de UI
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [encerrarDialogOpen, setEncerrarDialogOpen] = useState(false);
  const [cancelarDialogOpen, setCancelarDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);
  
  // Estados para visualizar OS e Checklist
  const [osDialogOpen, setOsDialogOpen] = useState(false);
  const [selectedOsId, setSelectedOsId] = useState<string | null>(null);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(0);
  
  // Buscar equipes para filtro
  const { data: equipes } = useQuery({
    queryKey: ["equipes-filtro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome")
        .order("codigo");
      return data || [];
    },
  });

  // Buscar turnos
  const { data: turnosData, isLoading, refetch } = useQuery({
    queryKey: ["turnos", statusFilter, dataInicio, dataFim, equipeFilter, searchTerm, currentPage],
    queryFn: async () => {
      // Primeiro buscar turnos básicos
      let query = supabase
        .from("turnos")
        .select(`
          *,
          tecnicos:equipe_id (id, codigo, nome, tipo_equipe, centro_custo_id)
        `, { count: "exact" })
        .order("hora_inicio", { ascending: false });
      
      // Aplicar filtros
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      if (dataInicio) {
        query = query.gte("hora_inicio", dataInicio + "T00:00:00");
      }
      
      if (dataFim) {
        query = query.lte("hora_inicio", dataFim + "T23:59:59");
      }
      
      if (equipeFilter !== "all") {
        query = query.eq("equipe_id", equipeFilter);
      }
      
      // Busca por placa
      if (searchTerm) {
        query = query.ilike("placa_veiculo", `%${searchTerm}%`);
      }
      
      // Paginação
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error("Erro ao buscar turnos:", error);
        throw error;
      }
      
      console.log("Turnos encontrados:", data?.length, data);
      
      // Buscar colaboradores dos turnos separadamente
      if (data && data.length > 0) {
        const turnoIds = data.map(t => t.id);
        const { data: colaboradoresData } = await supabase
          .from("turno_colaboradores")
          .select(`
            turno_id,
            colaborador_id,
            funcao_turno,
            hora_entrada,
            hora_saida,
            colaboradores:colaborador_id (id, nome, cpf, cargo)
          `)
          .in("turno_id", turnoIds);
        
        // Mapear colaboradores para cada turno
        const turnosComColaboradores = data.map(turno => {
          const colaboradoresTurno = (colaboradoresData || [])
            .filter(c => c.turno_id === turno.id)
            .map(c => ({
              id: c.colaborador_id,
              nome: (c.colaboradores as any)?.nome || "Desconhecido",
              funcao: c.funcao_turno || (c.colaboradores as any)?.cargo || "Membro",
              responsavel: c.funcao_turno === "lider"
            }));
          
          return {
            ...turno,
            turno_colaboradores: colaboradoresTurno
          };
        });
        
        return { turnos: turnosComColaboradores as Turno[], total: count || 0 };
      }
      
      return { turnos: (data || []) as Turno[], total: count || 0 };
    },
  });

  // Buscar detalhes do turno selecionado
  const { data: turnoDetalhes, isLoading: isLoadingDetalhes } = useQuery({
    queryKey: ["turno-detalhes", selectedTurno?.id],
    queryFn: async () => {
      if (!selectedTurno) return null;
      
      const dataInicio = selectedTurno.hora_inicio.substring(0, 10);
      const dataFim = selectedTurno.hora_fim?.substring(0, 10) || format(new Date(), "yyyy-MM-dd");
      
      // Buscar produções, intervalos e checklists em paralelo
      const [producaoRes, intervalosRes, checklistsRes] = await Promise.all([
        supabase
          .from("producao_equipes")
          .select(`
            *,
            ordens_servico:ordem_servico_id (id, numero, tipo, endereco, status, cliente_nome),
            retornos_campo:retorno_campo_id (codigo, descricao, tipo)
          `)
          .eq("equipe_id", selectedTurno.equipe_id)
          .gte("created_at", dataInicio + "T00:00:00")
          .lte("created_at", dataFim + "T23:59:59")
          .order("created_at"),
        supabase
          .from("intervalos_equipe")
          .select(`
            *,
            tipo_intervalo:tipo_intervalo_id (nome, tipo, cor)
          `)
          .eq("turno_id", selectedTurno.id)
          .order("hora_inicio"),
        supabase
          .from("checklist_respostas")
          .select(`
            id,
            checklist_id,
            ordem_servico_id,
            created_at,
            checklists:checklist_id (nome, tipo),
            ordens_servico:ordem_servico_id (numero)
          `)
          .eq("equipe_id", selectedTurno.equipe_id)
          .gte("created_at", dataInicio + "T00:00:00")
          .lte("created_at", dataFim + "T23:59:59")
          .order("created_at"),
      ]);
      
      return {
        producoes: (producaoRes.data || []) as ProducaoTurno[],
        intervalos: (intervalosRes.data || []) as IntervaloTurno[],
        checklists: (checklistsRes.data || []) as ChecklistTurno[],
      };
    },
    enabled: !!selectedTurno,
  });


  // Calcular estatísticas do turno
  const estatisticasTurno = useMemo(() => {
    if (!selectedTurno || !turnoDetalhes) return null;
    
    const producoes = turnoDetalhes.producoes;
    const intervalos = turnoDetalhes.intervalos;
    const checklists = turnoDetalhes.checklists;
    
    // Valor total produzido
    const valorTotal = producoes.reduce((acc, p) => acc + (p.valor_total || 0), 0);
    
    // Quantidade de OSs
    const qtdOSs = producoes.length;
    const osExecutadas = producoes.filter(p => p.retornos_campo?.tipo === "executado").length;
    const osImpedimentos = producoes.filter(p => p.retornos_campo?.tipo === "impedimento").length;
    
    // Tempo total de intervalos
    const tempoIntervalos = intervalos.reduce((acc, i) => {
      if (i.hora_inicio && i.hora_fim) {
        return acc + differenceInMinutes(parseISO(i.hora_fim), parseISO(i.hora_inicio));
      }
      return acc;
    }, 0);
    
    // Duração do turno
    const horaInicio = parseISO(selectedTurno.hora_inicio);
    const horaFim = selectedTurno.hora_fim ? parseISO(selectedTurno.hora_fim) : new Date();
    const duracaoTotal = differenceInMinutes(horaFim, horaInicio);
    const duracaoTrabalhada = duracaoTotal - tempoIntervalos;
    
    // KM percorridos
    const kmPercorridos = (selectedTurno.km_final || 0) - (selectedTurno.km_inicial || 0);
    
    // Cálculo de tempo ocioso
    // Tempo médio estimado por OS (execução + deslocamento): ~45 min por OS
    const tempoEstimadoOSs = qtdOSs * 45;
    // Tempo de APR: ~5 min por checklist APR
    const aprs = checklists.filter(c => c.checklists?.tipo === "apr");
    const tempoAPR = aprs.length * 5;
    
    // Tempo medido = tempo em OSs + intervalos + APRs
    const tempoMedido = tempoEstimadoOSs + tempoIntervalos + tempoAPR;
    
    // Tempo ocioso = tempo total - tempo medido (mínimo 0)
    const tempoOcioso = Math.max(0, duracaoTotal - tempoMedido);
    const percentualOcioso = duracaoTotal > 0 ? (tempoOcioso / duracaoTotal) * 100 : 0;
    const percentualProdutivo = 100 - percentualOcioso;
    
    return {
      valorTotal,
      qtdOSs,
      osExecutadas,
      osImpedimentos,
      tempoIntervalos,
      duracaoTotal,
      duracaoTrabalhada,
      kmPercorridos,
      assertividade: qtdOSs > 0 ? (osExecutadas / qtdOSs) * 100 : 0,
      // Novos campos de tempo ocioso
      tempoOcioso,
      percentualOcioso,
      percentualProdutivo,
      tempoAPR,
      tempoEstimadoOSs,
    };
  }, [selectedTurno, turnoDetalhes]);

  // Funções auxiliares
  const formatDuracao = (minutos: number) => {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h}h ${m}min`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      aberto: { label: "Em Andamento", variant: "default" },
      fechado: { label: "Finalizado", variant: "secondary" },
      cancelado: { label: "Cancelado", variant: "destructive" },
    };
    const c = config[status] || { label: status, variant: "outline" };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  // Limpar filtros
  const limparFiltros = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDataInicio("");
    setDataFim("");
    setEquipeFilter("all");
    setCurrentPage(0);
  };

  // Contar filtros ativos
  const filtrosAtivos = [
    statusFilter !== "all",
    dataInicio !== "",
    dataFim !== "",
    equipeFilter !== "all",
    searchTerm !== "",
  ].filter(Boolean).length;

  // Encerrar turno
  const handleEncerrarTurno = async () => {
    if (!selectedTurno) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("turnos")
        .update({
          status: "fechado",
          hora_fim: new Date().toISOString(),
        })
        .eq("id", selectedTurno.id);
      
      if (error) throw error;
      
      toast.success("Turno encerrado com sucesso!");
      setActionSuccess(true);
      setEncerrarDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast.error("Erro ao encerrar turno: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancelar turno
  const handleCancelarTurno = async () => {
    if (!selectedTurno) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("turnos")
        .update({
          status: "cancelado",
          hora_fim: new Date().toISOString(),
        })
        .eq("id", selectedTurno.id);
      
      if (error) throw error;
      
      toast.success("Turno cancelado!");
      setActionSuccess(true);
      setCancelarDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast.error("Erro ao cancelar turno: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Abrir detalhes
  const handleVerDetalhes = (turno: Turno) => {
    setSelectedTurno(turno);
    setDetalhesOpen(true);
  };

  return (
    <MainLayout title="Consulta de Turnos" breadcrumbs={[{ label: "Consulta de Turnos" }]}>
      <div className="space-y-6">
        {/* Ações */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Busca */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por equipe ou placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Status */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="aberto">Em Andamento</SelectItem>
                  <SelectItem value="fechado">Finalizados</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                </SelectContent>
              </Select>

              {/* Equipe */}
              <Select value={equipeFilter} onValueChange={setEquipeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Equipes</SelectItem>
                  {equipes?.map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>{eq.codigo} - {eq.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Período */}
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-[140px]"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-[140px]"
                />
              </div>

              {/* Limpar filtros */}
              {filtrosAtivos > 0 && (
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Limpar ({filtrosAtivos})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Turnos */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : turnosData?.turnos?.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhum turno encontrado</p>
                <p className="text-muted-foreground">Ajuste os filtros ou aguarde novos turnos</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Data/Hora Início</TableHead>
                    <TableHead>Data/Hora Fim</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Colaboradores</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turnosData?.turnos?.map((turno) => {
                    const duracao = turno.hora_fim 
                      ? differenceInMinutes(parseISO(turno.hora_fim), parseISO(turno.hora_inicio))
                      : differenceInMinutes(new Date(), parseISO(turno.hora_inicio));
                    
                    return (
                      <TableRow 
                        key={turno.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleVerDetalhes(turno)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{turno.tecnicos?.codigo || "-"}</p>
                              <p className="text-xs text-muted-foreground">{turno.tecnicos?.nome}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{format(parseISO(turno.hora_inicio), "dd/MM/yyyy")}</p>
                            <p className="text-xs text-muted-foreground">{format(parseISO(turno.hora_inicio), "HH:mm")}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {turno.hora_fim ? (
                            <div>
                              <p className="font-medium">{format(parseISO(turno.hora_fim), "dd/MM/yyyy")}</p>
                              <p className="text-xs text-muted-foreground">{format(parseISO(turno.hora_fim), "HH:mm")}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatDuracao(duracao)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span>{turno.turno_colaboradores?.length || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {turno.placa_veiculo ? (
                            <Badge variant="secondary">
                              <Car className="h-3 w-3 mr-1" />
                              {turno.placa_veiculo}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(turno.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Paginação */}
          {turnosData && turnosData.total > PAGE_SIZE && (
            <div className="border-t p-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {currentPage * PAGE_SIZE + 1} - {Math.min((currentPage + 1) * PAGE_SIZE, turnosData.total)} de {turnosData.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(currentPage + 1) * PAGE_SIZE >= turnosData.total}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Dialog de Detalhes do Turno */}
        <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">
                      Turno - {selectedTurno?.tecnicos?.codigo}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedTurno && format(parseISO(selectedTurno.hora_inicio), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </DialogDescription>
                  </div>
                </div>
                {selectedTurno && getStatusBadge(selectedTurno.status)}
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 -mx-6 px-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              {isLoadingDetalhes ? (
                <div className="space-y-4 py-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : selectedTurno && estatisticasTurno ? (
                <div className="space-y-6 py-4">
                  {/* Cards de Resumo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-xs font-medium">Valor Produzido</span>
                        </div>
                        <p className="text-2xl font-bold text-green-700">
                          {formatCurrency(estatisticasTurno.valorTotal)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                          <FileText className="h-4 w-4" />
                          <span className="text-xs font-medium">OSs Atendidas</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">
                          {estatisticasTurno.qtdOSs}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {estatisticasTurno.osExecutadas} exec. • {estatisticasTurno.osImpedimentos} imped.
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-purple-600 mb-1">
                          <Target className="h-4 w-4" />
                          <span className="text-xs font-medium">Assertividade</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-700">
                          {estatisticasTurno.assertividade.toFixed(0)}%
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-amber-600 mb-1">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs font-medium">Tempo Trabalhado</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-700">
                          {formatDuracao(estatisticasTurno.duracaoTrabalhada)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          de {formatDuracao(estatisticasTurno.duracaoTotal)} total
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Card de Eficiência / Tempo Ocioso */}
                  <Card className={cn(
                    "border-2 border-dashed",
                    estatisticasTurno.percentualProdutivo >= 80 
                      ? "border-green-500/50 bg-green-50/30" 
                      : estatisticasTurno.percentualProdutivo >= 60
                        ? "border-amber-500/50 bg-amber-50/30"
                        : "border-red-500/50 bg-red-50/30"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center",
                            estatisticasTurno.percentualProdutivo >= 80 
                              ? "bg-green-100 text-green-600" 
                              : estatisticasTurno.percentualProdutivo >= 60
                                ? "bg-amber-100 text-amber-600"
                                : "bg-red-100 text-red-600"
                          )}>
                            <Activity className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Eficiência do Turno</p>
                            <p className="text-2xl font-bold">
                              {estatisticasTurno.percentualProdutivo.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Tempo Ocioso</p>
                          <p className={cn(
                            "text-lg font-semibold",
                            estatisticasTurno.percentualOcioso > 30 ? "text-red-600" : 
                            estatisticasTurno.percentualOcioso > 20 ? "text-amber-600" : "text-green-600"
                          )}>
                            {formatDuracao(estatisticasTurno.tempoOcioso)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ({estatisticasTurno.percentualOcioso.toFixed(1)}% do turno)
                          </p>
                        </div>
                      </div>
                      <Progress 
                        value={estatisticasTurno.percentualProdutivo} 
                        className="h-2 mt-3"
                      />
                    </CardContent>
                  </Card>

                  {/* Informações Gerais */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Informações do Turno</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Equipe</p>
                          <p className="font-medium">{selectedTurno.tecnicos?.codigo} - {selectedTurno.tecnicos?.nome}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Início</p>
                          <p className="font-medium">{format(parseISO(selectedTurno.hora_inicio), "dd/MM/yyyy HH:mm")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Fim</p>
                          <p className="font-medium">
                            {selectedTurno.hora_fim 
                              ? format(parseISO(selectedTurno.hora_fim), "dd/MM/yyyy HH:mm")
                              : "Em andamento"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Veículo</p>
                          <p className="font-medium">{selectedTurno.placa_veiculo || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">KM Inicial</p>
                          <p className="font-medium">{selectedTurno.km_inicial?.toLocaleString() || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">KM Final</p>
                          <p className="font-medium">{selectedTurno.km_final?.toLocaleString() || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">KM Percorridos</p>
                          <p className="font-medium">{estatisticasTurno.kmPercorridos > 0 ? `${estatisticasTurno.kmPercorridos} km` : "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Tempo em Intervalos</p>
                          <p className="font-medium">{formatDuracao(estatisticasTurno.tempoIntervalos)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Colaboradores */}
                  {selectedTurno.turno_colaboradores && selectedTurno.turno_colaboradores.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Colaboradores ({selectedTurno.turno_colaboradores.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {selectedTurno.turno_colaboradores.map(colab => (
                            <Badge 
                              key={colab.id} 
                              variant={colab.responsavel ? "default" : "outline"}
                            >
                              {colab.nome}
                              {colab.responsavel && <CheckCircle2 className="h-3 w-3 ml-1" />}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tabs com detalhes */}
                  <Tabs defaultValue="producao" className="w-full">
                    <TabsList className="grid grid-cols-3">
                      <TabsTrigger value="producao" className="text-xs">
                        <DollarSign className="h-4 w-4 mr-1" />
                        Produção ({turnoDetalhes?.producoes.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="intervalos" className="text-xs">
                        <Coffee className="h-4 w-4 mr-1" />
                        Intervalos ({turnoDetalhes?.intervalos.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="checklists" className="text-xs">
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        Checklists ({turnoDetalhes?.checklists.length || 0})
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab Produção */}
                    <TabsContent value="producao" className="mt-4">
                      {turnoDetalhes?.producoes.length === 0 ? (
                        <Card className="p-8 text-center">
                          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Nenhuma produção registrada</p>
                        </Card>
                      ) : (
                        <Card>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Hora</TableHead>
                                <TableHead>OS</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Retorno</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {turnoDetalhes?.producoes.map(prod => (
                                <TableRow key={prod.id}>
                                  <TableCell className="text-xs">
                                    {format(parseISO(prod.created_at), "HH:mm")}
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-mono text-sm">{prod.ordens_servico?.numero || "-"}</span>
                                  </TableCell>
                                  <TableCell className="text-sm">{prod.ordens_servico?.tipo}</TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-xs",
                                        prod.retornos_campo?.tipo === "executado" && "border-green-500 text-green-700",
                                        prod.retornos_campo?.tipo === "impedimento" && "border-red-500 text-red-700"
                                      )}
                                    >
                                      {prod.retornos_campo?.descricao || "-"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(prod.valor_total || 0)}
                                  </TableCell>
                                  <TableCell>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => {
                                        setSelectedOsId(prod.ordem_servico_id);
                                        setOsDialogOpen(true);
                                      }}
                                      title="Ver OS"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Card>
                      )}
                    </TabsContent>

                    {/* Tab Intervalos */}
                    <TabsContent value="intervalos" className="mt-4">
                      {turnoDetalhes?.intervalos.length === 0 ? (
                        <Card className="p-8 text-center">
                          <Coffee className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Nenhum intervalo registrado</p>
                        </Card>
                      ) : (
                        <Card>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Início</TableHead>
                                <TableHead>Fim</TableHead>
                                <TableHead>Duração</TableHead>
                                <TableHead>Observação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {turnoDetalhes?.intervalos.map(int => {
                                const duracao = int.hora_fim 
                                  ? differenceInMinutes(parseISO(int.hora_fim), parseISO(int.hora_inicio))
                                  : null;
                                return (
                                  <TableRow key={int.id}>
                                    <TableCell>
                                      <Badge 
                                        variant={int.tipo_intervalo?.tipo === "padrao" ? "default" : "outline"}
                                        style={{ 
                                          backgroundColor: int.tipo_intervalo?.cor ? `${int.tipo_intervalo.cor}20` : undefined,
                                          borderColor: int.tipo_intervalo?.cor || undefined,
                                          color: int.tipo_intervalo?.cor || undefined,
                                        }}
                                      >
                                        {int.tipo_intervalo?.nome || "Intervalo"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{format(parseISO(int.hora_inicio), "HH:mm")}</TableCell>
                                    <TableCell>
                                      {int.hora_fim ? format(parseISO(int.hora_fim), "HH:mm") : (
                                        <Badge variant="destructive">Em andamento</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>{duracao ? formatDuracao(duracao) : "-"}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {int.observacao || "-"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Card>
                      )}
                    </TabsContent>

                    {/* Tab Checklists */}
                    <TabsContent value="checklists" className="mt-4">
                      {turnoDetalhes?.checklists.length === 0 ? (
                        <Card className="p-8 text-center">
                          <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Nenhum checklist preenchido</p>
                        </Card>
                      ) : (
                        <Card>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Hora</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Checklist</TableHead>
                                <TableHead>OS</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {turnoDetalhes?.checklists.map(check => (
                                <TableRow key={check.id}>
                                  <TableCell className="text-xs">
                                    {format(parseISO(check.created_at), "HH:mm")}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={check.checklists?.tipo === "apr" ? "default" : "outline"}>
                                      {check.checklists?.tipo?.toUpperCase() || "Checklist"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">{check.checklists?.nome || "-"}</TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {check.ordens_servico?.numero || "-"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                          setSelectedChecklistId(check.id);
                                          setChecklistDialogOpen(true);
                                        }}
                                        title="Ver Checklist"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                      {check.ordem_servico_id && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          onClick={() => {
                                            setSelectedOsId(check.ordem_servico_id!);
                                            setOsDialogOpen(true);
                                          }}
                                          title="Ver OS"
                                        >
                                          <FileText className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              ) : null}
            </ScrollArea>

            {/* Footer com ações */}
            {selectedTurno?.status === "aberto" && podeEditar && (
              <DialogFooter className="border-t pt-4 mt-4">
                <div className="flex gap-2 w-full justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetalhesOpen(false);
                      setTimeout(() => setCancelarDialogOpen(true), 100);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar Turno
                  </Button>
                  <Button onClick={() => {
                    setDetalhesOpen(false);
                    setTimeout(() => setEncerrarDialogOpen(true), 100);
                  }}>
                    <Power className="h-4 w-4 mr-2" />
                    Encerrar Turno
                  </Button>
                </div>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmar Encerramento */}
        <AlertDialog open={encerrarDialogOpen} onOpenChange={(open) => {
          setEncerrarDialogOpen(open);
          if (!open && !actionSuccess) {
            // Reabrir detalhes apenas se o usuário cancelou (não se foi sucesso)
            setTimeout(() => setDetalhesOpen(true), 100);
          }
          if (!open && actionSuccess) {
            setActionSuccess(false);
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Encerrar Turno</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja encerrar este turno? Esta ação registrará o horário atual como fim do turno.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleEncerrarTurno} disabled={isProcessing}>
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Encerrar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Confirmar Cancelamento */}
        <AlertDialog open={cancelarDialogOpen} onOpenChange={(open) => {
          setCancelarDialogOpen(open);
          if (!open && !actionSuccess) {
            // Reabrir detalhes apenas se o usuário cancelou (não se foi sucesso)
            setTimeout(() => setDetalhesOpen(true), 100);
          }
          if (!open && actionSuccess) {
            setActionSuccess(false);
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Turno</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja cancelar este turno? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleCancelarTurno} 
                disabled={isProcessing}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cancelar Turno
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Visualização da OS - usando componente completo */}
        <OrdemServicoDetalhesDialog
          open={osDialogOpen}
          onOpenChange={(open) => {
            setOsDialogOpen(open);
            if (!open) setSelectedOsId(null);
          }}
          ordemId={selectedOsId}
        />

        {/* Dialog de Visualização do Checklist - usando componente completo */}
        <ChecklistDetalhesDialog
          open={checklistDialogOpen}
          onOpenChange={(open) => {
            setChecklistDialogOpen(open);
            if (!open) setSelectedChecklistId(null);
          }}
          checklistId={selectedChecklistId}
        />
      </div>
    </MainLayout>
  );
}

