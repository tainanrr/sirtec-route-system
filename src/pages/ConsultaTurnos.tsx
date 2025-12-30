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
  Truck,
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { verificarOsEmAndamento } from "@/lib/authUtils";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { OrdemServicoDetalhesDialog } from "@/components/ordens/OrdemServicoDetalhesDialog";
import { ChecklistDetalhesDialog } from "@/components/checklists/ChecklistDetalhesDialog";
import { TimelinePrevistoRealizado, type TimelineEquipeCompleta, type TimelineOrdemServico, type TimelineIntervalo } from "@/components/torre/TimelinePrevistoRealizado";

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

// Interface para OS Planejada no turno
interface OsPlanejadaTurno {
  id: string;
  ordem_na_rota: number;
  ordem_servico_id: string;
  ordens_servico: {
    id: string;
    numero: string;
    tipo: string;
    endereco: string;
    status: string;
    cliente_nome: string | null;
    concluido_at: string | null;
    prazo: string | null;
    updated_at: string | null;
    deslocamento_iniciado_at: string | null;
    chegada_local_at: string | null;
    execucao_iniciada_at: string | null;
    pausado_at: string | null;
  };
  // Info de execução
  executada: boolean;
  executadaNesteTurno: boolean;
  producao?: ProducaoTurno;
  // Info se executada em outro turno
  executadaEmOutroTurno?: {
    turnoId: string;
    data: string;
    equipeId: string;
    equipeCodigo: string;
  };
  // Último movimento específico desta OS (baseado nos timestamps da OS)
  ultimoMovimento?: string | null;
  // Posição de execução (ordem em que foi executada)
  posicaoExecutada?: number | null;
  // Indica se há quebra de sequência (pulou uma OS)
  quebraSequencia?: boolean;
  // Retorno de campo
  retornoCampo?: {
    codigo: string;
    descricao: string;
    tipo: string;
  } | null;
  // Indica se a conclusão foi em data diferente do turno
  concluidaForaDoTurno?: boolean;
  dataConclusao?: string | null;
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
  
  // Buscar tipos de serviço (skills) para exibir nome
  const { data: tiposServico } = useQuery({
    queryKey: ["tipos-servico-nome"],
    queryFn: async () => {
      const { data } = await supabase
        .from("skills")
        .select("codigo, nome");
      // Criar um Map para lookup rápido
      const map = new Map<string, string>();
      (data || []).forEach((s: { codigo: string; nome: string }) => {
        map.set(s.codigo, s.nome);
        map.set(s.codigo.toLowerCase(), s.nome);
        map.set(s.codigo.toUpperCase(), s.nome);
      });
      return map;
    },
  });

  // Criar mapa de equipes para lookup rápido
  const equipesMap = useMemo(() => {
    const map = new Map<string, { id: string; codigo: string; nome: string }>();
    (equipes || []).forEach(eq => {
      map.set(eq.id, eq);
    });
    return map;
  }, [equipes]);

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
      
      // Buscar produções, intervalos, checklists e OSs planejadas em paralelo
      const [producaoRes, intervalosRes, checklistsRes, osPlanejadaRes] = await Promise.all([
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
        // Buscar OSs planejadas para a equipe naquele dia
        supabase
          .from("planejamento_ordens")
          .select(`
            id,
            ordem_na_rota,
            ordem_servico_id,
            ordens_servico:ordem_servico_id (
              id, 
              numero, 
              tipo, 
              endereco, 
              status, 
              cliente_nome, 
              concluido_at,
              prazo,
              updated_at,
              deslocamento_iniciado_at,
              chegada_local_at,
              execucao_iniciada_at,
              pausado_at
            ),
            planejamentos!inner (id, data_planejamento)
          `)
          .eq("equipe_id", selectedTurno.equipe_id)
          .eq("planejamentos.data_planejamento", dataInicio)
          .order("ordem_na_rota"),
      ]);
      
      const producoes = (producaoRes.data || []) as ProducaoTurno[];
      const osPlanejadas = osPlanejadaRes.data || [];
      
      // Mapear produções por ordem_servico_id para fácil acesso
      const producoesPorOS = new Map<string, ProducaoTurno>();
      producoes.forEach(p => {
        producoesPorOS.set(p.ordem_servico_id, p);
      });
      
      // Buscar execuções em outros turnos para as OSs que não foram executadas neste turno
      const osIdsPlanejadas = osPlanejadas.map((op: any) => op.ordem_servico_id);
      const osIdsExecutadasNesteTurno = new Set(producoes.map(p => p.ordem_servico_id));
      const osIdsPendentesNesteTurno = osIdsPlanejadas.filter(id => !osIdsExecutadasNesteTurno.has(id));
      
      // Buscar se essas OSs foram executadas em outros turnos
      let execucoesOutrosTurnos: Map<string, { turnoId: string; data: string; equipeId: string; equipeCodigo: string }> = new Map();
      
      if (osIdsPendentesNesteTurno.length > 0) {
        const { data: outrasProd } = await supabase
          .from("producao_equipes")
          .select(`
            ordem_servico_id,
            equipe_id,
            turno_id,
            created_at,
            tecnicos:equipe_id (codigo)
          `)
          .in("ordem_servico_id", osIdsPendentesNesteTurno)
          .not("turno_id", "is", null);
        
        if (outrasProd) {
          outrasProd.forEach((prod: any) => {
            // Verificar se não é do turno atual
            if (prod.turno_id !== selectedTurno.id) {
              execucoesOutrosTurnos.set(prod.ordem_servico_id, {
                turnoId: prod.turno_id,
                data: prod.created_at?.substring(0, 10) || "",
                equipeId: prod.equipe_id,
                equipeCodigo: prod.tecnicos?.codigo || "N/A",
              });
            }
          });
        }
      }
      
      // Calcular posição de execução baseado na ordem de criação das produções
      // Ordenar produções por created_at para determinar a ordem real de execução
      const producoesOrdenadas = [...producoes].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      // Mapear OS -> posição de execução
      const posicaoExecucaoPorOS = new Map<string, number>();
      producoesOrdenadas.forEach((prod, index) => {
        posicaoExecucaoPorOS.set(prod.ordem_servico_id, index + 1);
      });
      
      // Processar OSs planejadas
      const osPlanejadaProcessadas: OsPlanejadaTurno[] = osPlanejadas
        .filter((op: any) => op.ordens_servico)
        .map((op: any) => {
          const osId = op.ordem_servico_id;
          const executadaNesteTurno = osIdsExecutadasNesteTurno.has(osId);
          const producao = producoesPorOS.get(osId);
          const executadaEmOutroTurno = execucoesOutrosTurnos.get(osId);
          
          // Calcular último movimento específico desta OS
          // Usar apenas os campos que têm valor (indicando que a OS passou por esse estado)
          const movimentos: { tipo: string; data: string }[] = [];
          if (op.ordens_servico.deslocamento_iniciado_at) {
            movimentos.push({ tipo: "deslocamento", data: op.ordens_servico.deslocamento_iniciado_at });
          }
          if (op.ordens_servico.chegada_local_at) {
            movimentos.push({ tipo: "chegada", data: op.ordens_servico.chegada_local_at });
          }
          if (op.ordens_servico.execucao_iniciada_at) {
            movimentos.push({ tipo: "execucao", data: op.ordens_servico.execucao_iniciada_at });
          }
          if (op.ordens_servico.pausado_at) {
            movimentos.push({ tipo: "pausa", data: op.ordens_servico.pausado_at });
          }
          if (op.ordens_servico.concluido_at) {
            movimentos.push({ tipo: "conclusao", data: op.ordens_servico.concluido_at });
          }
          
          // Pegar o movimento mais recente (não usar updated_at pois é genérico)
          const ultimoMovimento = movimentos.length > 0 
            ? movimentos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0].data
            : null;
          
          // Posição de execução
          const posicaoExecutada = posicaoExecucaoPorOS.get(osId) || null;
          
          // Retorno de campo (da produção)
          const retornoCampo = producao?.retornos_campo || null;
          
          // Verificar se foi concluída em data diferente do turno
          const dataTurno = dataInicio;
          const dataConclusao = op.ordens_servico.concluido_at 
            ? op.ordens_servico.concluido_at.substring(0, 10) 
            : null;
          const concluidaForaDoTurno = dataConclusao && dataConclusao !== dataTurno;
          
          return {
            id: op.id,
            ordem_na_rota: op.ordem_na_rota,
            ordem_servico_id: osId,
            ordens_servico: op.ordens_servico,
            executada: executadaNesteTurno || !!executadaEmOutroTurno || op.ordens_servico.status === "concluida",
            executadaNesteTurno,
            producao,
            executadaEmOutroTurno,
            ultimoMovimento,
            posicaoExecutada,
            quebraSequencia: false, // Será calculado depois
            retornoCampo,
            concluidaForaDoTurno,
            dataConclusao,
          };
        });
      
      // Calcular quebras de sequência
      // Uma quebra ocorre quando uma OS é executada fora da ordem planejada
      // Exemplo: Se executou a OS planejada como 4ª em 1º lugar (pulando 1, 2, 3), é uma quebra
      // Exemplo: Se executou a OS planejada como 1ª em 1º, e depois a 4ª em 2º (pulando 2, 3), a 4ª tem quebra
      const osExecutadasOrdenadas = osPlanejadaProcessadas
        .filter(os => os.posicaoExecutada !== null)
        .sort((a, b) => (a.posicaoExecutada || 0) - (b.posicaoExecutada || 0));
      
      let menorPosicaoNaoExecutada = 1; // A menor posição planejada que ainda não foi executada
      const posicoesExecutadas = new Set<number>();
      
      osExecutadasOrdenadas.forEach((os) => {
        const posicaoPlanejada = os.ordem_na_rota;
        
        // Verificar se há alguma OS com posição planejada menor que esta que não foi executada ainda
        // Se sim, esta OS "pulou" na sequência
        let temOsAnteriorNaoExecutada = false;
        for (let i = menorPosicaoNaoExecutada; i < posicaoPlanejada; i++) {
          // Verificar se existe uma OS planejada com essa posição que não foi executada
          const osPosicao = osPlanejadaProcessadas.find(o => o.ordem_na_rota === i);
          if (osPosicao && !posicoesExecutadas.has(i)) {
            temOsAnteriorNaoExecutada = true;
            break;
          }
        }
        
        if (temOsAnteriorNaoExecutada) {
          const osOriginal = osPlanejadaProcessadas.find(o => o.ordem_servico_id === os.ordem_servico_id);
          if (osOriginal) osOriginal.quebraSequencia = true;
        }
        
        posicoesExecutadas.add(posicaoPlanejada);
        
        // Atualizar a menor posição não executada
        while (posicoesExecutadas.has(menorPosicaoNaoExecutada)) {
          menorPosicaoNaoExecutada++;
        }
      });
      
      return {
        producoes,
        intervalos: (intervalosRes.data || []) as IntervaloTurno[],
        checklists: (checklistsRes.data || []) as ChecklistTurno[],
        osPlanejadas: osPlanejadaProcessadas,
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
    const osPlanejadas = turnoDetalhes.osPlanejadas || [];
    
    // Valor total produzido
    const valorTotal = producoes.reduce((acc, p) => acc + (p.valor_total || 0), 0);
    
    // Quantidade de OSs (produção registrada neste turno)
    const qtdOSs = producoes.length;
    const osExecutadas = producoes.filter(p => p.retornos_campo?.tipo === "executado").length;
    const osImpedimentos = producoes.filter(p => p.retornos_campo?.tipo === "impedimento").length;
    
    // Estatísticas das OSs planejadas
    const qtdOsPlanejadas = osPlanejadas.length;
    const osExecutadasNesteTurno = osPlanejadas.filter(os => os.executadaNesteTurno).length;
    const osExecutadasOutroTurno = osPlanejadas.filter(os => os.executadaEmOutroTurno).length;
    const osPendentes = osPlanejadas.filter(os => !os.executadaNesteTurno && !os.executadaEmOutroTurno && os.ordens_servico.status !== "concluida").length;
    
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
      // Estatísticas de OSs planejadas
      qtdOsPlanejadas,
      osExecutadasNesteTurno,
      osExecutadasOutroTurno,
      osPendentes,
      taxaExecucao: qtdOsPlanejadas > 0 ? (osExecutadasNesteTurno / qtdOsPlanejadas) * 100 : 0,
    };
  }, [selectedTurno, turnoDetalhes]);

  // Converter dados do turno para formato da Timeline
  const timelineEquipes = useMemo((): TimelineEquipeCompleta[] => {
    if (!selectedTurno || !turnoDetalhes) return [];
    
    const equipe = equipesMap.get(selectedTurno.equipe_id);
    if (!equipe) return [];
    
    const osPlanejadas = turnoDetalhes.osPlanejadas || [];
    const intervalos = turnoDetalhes.intervalos || [];
    
    // Extrair hora do timestamp ISO
    const extractTime = (isoString?: string | null): string | undefined => {
      if (!isoString) return undefined;
      try {
        return format(parseISO(isoString), "HH:mm:ss");
      } catch {
        return undefined;
      }
    };
    
    // Determinar status da equipe baseado no turno
    let status: "normal" | "atrasada" | "adiantada" | "ociosa" | "offline" | "em_intervalo" = "normal";
    if (!selectedTurno.hora_fim) {
      // Turno ainda aberto - verificar se há intervalo ativo
      const intervaloAtivo = intervalos.some(i => i.hora_inicio && !i.hora_fim);
      if (intervaloAtivo) {
        status = "em_intervalo";
      }
    } else {
      status = "offline"; // Turno fechado
    }
    
    // Converter intervalos
    const intervalosTimeline: TimelineIntervalo[] = intervalos.map(i => ({
      id: i.id,
      tipo: i.tipo_intervalo?.nome || "Intervalo",
      horaInicio: extractTime(i.hora_inicio) || "",
      horaFim: extractTime(i.hora_fim),
      previsto: false,
    }));
    
    // Converter OSs planejadas
    const ordensTimeline: TimelineOrdemServico[] = osPlanejadas.map(os => ({
      id: os.ordens_servico.id,
      numero: os.ordens_servico.numero,
      tipo: os.ordens_servico.tipo,
      tipoDescricao: tiposServico?.get(os.ordens_servico.tipo) || os.ordens_servico.tipo,
      status: (os.ordens_servico.status as any) || "planejada",
      regulada: false,
      prazo: os.ordens_servico.prazo || undefined,
      ordemNaRota: os.ordem_na_rota,
      endereco: os.ordens_servico.endereco || undefined,
      // Horários realizados
      deslocamentoIniciadoAt: extractTime(os.ordens_servico.deslocamento_iniciado_at),
      chegadaLocalAt: extractTime(os.ordens_servico.chegada_local_at),
      execucaoIniciadaAt: extractTime(os.ordens_servico.execucao_iniciada_at),
      concluidoAt: extractTime(os.ordens_servico.concluido_at),
      pausadoAt: extractTime(os.ordens_servico.pausado_at),
    }));
    
    return [{
      id: equipe.id,
      codigo: equipe.codigo,
      nome: equipe.nome,
      ordens: ordensTimeline,
      intervalos: intervalosTimeline,
      turnoInicio: extractTime(selectedTurno.hora_inicio),
      turnoFim: extractTime(selectedTurno.hora_fim),
      status,
      turnoAberto: !selectedTurno.hora_fim,
    }];
  }, [selectedTurno, turnoDetalhes, equipesMap, tiposServico]);

  // Data do turno selecionado (para a timeline)
  const dataTurnoSelecionado = useMemo(() => {
    if (!selectedTurno?.hora_inicio) return "";
    return selectedTurno.hora_inicio.substring(0, 10);
  }, [selectedTurno]);

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
      // Verificar se há OS em andamento antes de encerrar
      const verificacao = await verificarOsEmAndamento(selectedTurno.equipe_id);
      if (verificacao.temOsEmAndamento && verificacao.osEmAndamento) {
        toast.error(
          `Não é possível fechar o turno. A OS ${verificacao.osEmAndamento.numero} está com preenchimento em andamento. Finalize ou cancele a OS antes de encerrar o turno.`,
          { duration: 6000 }
        );
        setEncerrarDialogOpen(false);
        return;
      }

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
                          <span className="text-xs font-medium">OSs Planejadas</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">
                          {estatisticasTurno.osExecutadasNesteTurno}/{estatisticasTurno.qtdOsPlanejadas}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {estatisticasTurno.osPendentes > 0 && <span className="text-amber-600">{estatisticasTurno.osPendentes} pend.</span>}
                          {estatisticasTurno.osExecutadasOutroTurno > 0 && <span className="text-blue-500 ml-1">{estatisticasTurno.osExecutadasOutroTurno} outro turno</span>}
                          {estatisticasTurno.osPendentes === 0 && estatisticasTurno.osExecutadasOutroTurno === 0 && (
                            <span className="text-green-600">Todas executadas</span>
                          )}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-purple-600 mb-1">
                          <Target className="h-4 w-4" />
                          <span className="text-xs font-medium">Taxa Execução</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-700">
                          {estatisticasTurno.taxaExecucao?.toFixed(0) || 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          do planejado
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
                  <Tabs defaultValue="os-planejadas" className="w-full">
                    <TabsList className="grid grid-cols-3">
                      <TabsTrigger value="os-planejadas" className="text-xs">
                        <Route className="h-4 w-4 mr-1" />
                        Planejado x Executado ({turnoDetalhes?.osPlanejadas?.length || 0})
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

                    {/* Tab OSs Planejadas */}
                    <TabsContent value="os-planejadas" className="mt-4">
                      {!turnoDetalhes?.osPlanejadas || turnoDetalhes.osPlanejadas.length === 0 ? (
                        <Card className="p-8 text-center">
                          <Route className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Nenhuma OS planejada encontrada para este dia</p>
                        </Card>
                      ) : (
                        <Card>
                          {/* Resumo das OSs */}
                          <div className="p-3 border-b bg-muted/30">
                            <div className="flex flex-wrap gap-3 text-xs">
                              <span className="flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                Executadas neste turno: <strong>{estatisticasTurno?.osExecutadasNesteTurno || 0}</strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                Executadas em outro turno: <strong>{estatisticasTurno?.osExecutadasOutroTurno || 0}</strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-amber-500" />
                                Pendentes: <strong>{estatisticasTurno?.osPendentes || 0}</strong>
                              </span>
                              <span className="ml-auto font-medium">
                                Taxa de execução: {estatisticasTurno?.taxaExecucao?.toFixed(0) || 0}%
                              </span>
                            </div>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[60px]">Plan.</TableHead>
                                <TableHead className="w-[60px]">Exec.</TableHead>
                                <TableHead>OS</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Retorno</TableHead>
                                <TableHead>Último Movimento</TableHead>
                                <TableHead>Prazo</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {turnoDetalhes.osPlanejadas.map(os => {
                                // Determinar o status visual baseado no status real da OS
                                let statusBadge;
                                let statusInfo = "";
                                
                                // Usar o status real da OS, não apenas se foi executada
                                const statusReal = os.ordens_servico.status;
                                
                                if (statusReal === "concluida") {
                                  statusBadge = (
                                    <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Concluída
                                    </Badge>
                                  );
                                } else if (statusReal === "cancelada") {
                                  statusBadge = (
                                    <Badge variant="destructive" className="text-xs">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Cancelada
                                    </Badge>
                                  );
                                } else if (statusReal === "em_execucao" || statusReal === "em_andamento") {
                                  statusBadge = (
                                    <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">
                                      <Play className="h-3 w-3 mr-1" />
                                      Em Execução
                                    </Badge>
                                  );
                                } else if (statusReal === "em_deslocamento") {
                                  statusBadge = (
                                    <Badge className="bg-orange-500 hover:bg-orange-600 text-xs">
                                      <Truck className="h-3 w-3 mr-1" />
                                      Em Deslocamento
                                    </Badge>
                                  );
                                } else if (statusReal === "no_local") {
                                  statusBadge = (
                                    <Badge className="bg-cyan-500 hover:bg-cyan-600 text-xs">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      No Local
                                    </Badge>
                                  );
                                } else if (statusReal === "pausada") {
                                  statusBadge = (
                                    <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">
                                      <Pause className="h-3 w-3 mr-1" />
                                      Pausada
                                    </Badge>
                                  );
                                } else if (os.executadaNesteTurno) {
                                  statusBadge = (
                                    <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Executada
                                    </Badge>
                                  );
                                } else if (os.executadaEmOutroTurno) {
                                  statusBadge = (
                                    <Badge variant="outline" className="border-blue-500 text-blue-700 text-xs">
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Outro Turno
                                    </Badge>
                                  );
                                  statusInfo = `Executada em ${os.executadaEmOutroTurno.data} pela equipe ${os.executadaEmOutroTurno.equipeCodigo}`;
                                } else {
                                  statusBadge = (
                                    <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pendente
                                    </Badge>
                                  );
                                }
                                
                                return (
                                  <TableRow 
                                    key={os.id}
                                    className={cn(
                                      os.executadaNesteTurno && "bg-green-50/50",
                                      os.executadaEmOutroTurno && "bg-blue-50/50",
                                      !os.executadaNesteTurno && !os.executadaEmOutroTurno && os.ordens_servico.status !== "concluida" && os.ordens_servico.status !== "cancelada" && "bg-amber-50/30",
                                      os.quebraSequencia && "ring-2 ring-orange-400"
                                    )}
                                  >
                                    <TableCell>
                                      <Badge variant="outline" className="font-mono">
                                        {os.ordem_na_rota}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {os.posicaoExecutada ? (
                                        <Badge 
                                          variant={os.quebraSequencia ? "destructive" : "default"}
                                          className={cn(
                                            "font-mono",
                                            os.quebraSequencia 
                                              ? "bg-orange-500 hover:bg-orange-600" 
                                              : "bg-green-600 hover:bg-green-700"
                                          )}
                                        >
                                          {os.posicaoExecutada}
                                        </Badge>
                                      ) : (
                                        <span className="text-muted-foreground text-xs">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-mono text-sm">{os.ordens_servico.numero}</span>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {tiposServico?.get(os.ordens_servico.tipo) || os.ordens_servico.tipo}
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        {statusBadge}
                                        {statusInfo && (
                                          <p className="text-[10px] text-muted-foreground">{statusInfo}</p>
                                        )}
                                        {os.concluidaForaDoTurno && (
                                          <Badge variant="outline" className="border-purple-500 text-purple-700 text-[10px]">
                                            Concl. {os.dataConclusao ? format(parseISO(os.dataConclusao), "dd/MM") : ""}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {os.retornoCampo ? (
                                        <Badge 
                                          variant="outline" 
                                          className={cn(
                                            "text-xs",
                                            os.retornoCampo.tipo === "executado" && "border-green-500 text-green-700 bg-green-50",
                                            os.retornoCampo.tipo === "impedimento" && "border-red-500 text-red-700 bg-red-50"
                                          )}
                                        >
                                          {os.retornoCampo.descricao || os.retornoCampo.codigo}
                                        </Badge>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {os.ultimoMovimento ? (
                                        <div className="text-xs">
                                          <div className="font-medium">
                                            {format(parseISO(os.ultimoMovimento), "dd/MM/yyyy")}
                                          </div>
                                          <div className="text-muted-foreground">
                                            {format(parseISO(os.ultimoMovimento), "HH:mm")}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {os.ordens_servico.prazo ? (
                                        <div className="text-xs">
                                          <div className="font-medium">
                                            {format(parseISO(os.ordens_servico.prazo), "dd/MM/yyyy")}
                                          </div>
                                          <div className="text-muted-foreground">
                                            {format(parseISO(os.ordens_servico.prazo), "HH:mm")}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {os.producao?.valor_total ? formatCurrency(os.producao.valor_total) : "-"}
                                    </TableCell>
                                    <TableCell>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                          setSelectedOsId(os.ordem_servico_id);
                                          setOsDialogOpen(true);
                                        }}
                                        title="Ver OS"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Card>
                      )}

                      {/* Timeline Planejado x Executado */}
                      {turnoDetalhes?.osPlanejadas && turnoDetalhes.osPlanejadas.length > 0 && timelineEquipes.length > 0 && dataTurnoSelecionado && (
                        <div className="mt-6">
                          <TimelinePrevistoRealizado
                            dateISO={dataTurnoSelecionado}
                            equipes={timelineEquipes}
                            onSelectEquipe={() => {}}
                            onSelectOS={(osId) => {
                              setSelectedOsId(osId);
                              setOsDialogOpen(true);
                            }}
                            selectedEquipeId={selectedTurno?.equipe_id}
                          />
                        </div>
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

