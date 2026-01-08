import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTelaPermissao } from "@/hooks/usePermissoes";
import { useQuery } from "@tanstack/react-query";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  RefreshCcw,
  MapPin,
  Clock,
  Zap,
  DollarSign,
  Car,
  CheckCircle,
  GripVertical,
  Download,
  Map as MapIcon,
  Eye,
  EyeOff,
  Settings,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Copy,
  Trash2,
  ArrowUpDown,
  AlertTriangle,
  Filter,
  ChevronUp,
  ChevronDown,
  Calendar,
  PlusCircle,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrdemServico, Equipe } from "@/data/mockData";
import {
  otimizarRotas,
  RotaEquipe,
  RotaServico,
  ResultadoOtimizacao,
  OpcaoRoteiro,
  calcularDistancia,
  formatarTempo,
  formatarData,
  recalcularRota,
  calcularExpectativaEquipesPorTerritorio,
  ExpectativaTerritorio,
  type ResultadoRecalculo,
  type InconformidadeRota,
  ParametrosRoteirizacao,
  PARAMETROS_PADRAO,
  PARAMETROS_DESCRICOES,
} from "@/lib/routingUtils";
import { getDadosSkills } from "@/lib/skillsUtils";
import { tecnicosParaEquipes } from "@/lib/equipeUtils";
import { mapSupabaseOrdensServicoToOrdemServico } from "@/lib/ordemServicoUtils";
import type { Tables } from "@/integrations/supabase/types";
import MapaLeaflet from "./components/MapaLeaflet";
import { carregarTerritorios, salvarTerritorios, salvarTerritorio, Territorio, pontoNoPoligono, atualizarTerritoriosOSs, CORES_TERRITORIOS } from "@/types/territorios";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import ExpectativaEquipesDialog from "./components/ExpectativaEquipesDialog";
import SelecaoTerritoriosDialog from "./components/SelecaoTerritoriosDialog";
import SelecaoOpcoesRoteiroDialog from "./components/SelecaoOpcoesRoteiroDialog";
import { OrdemServicoDetalhesDialog } from "@/components/ordens/OrdemServicoDetalhesDialog";

// Mapa dinâmico de tipo -> nome (preenchido com dados do banco)
let skillsNomesMap: Map<string, string> = new Map();
// Mapa dinâmico de tipo -> grupo_servico (preenchido com dados do banco)
let skillsGruposMap: Map<string, string> = new Map();

/**
 * Obtém o label formatado para um tipo de OS usando o nome da skill do banco
 */
function obterLabelTipo(tipo: string): string {
  if (!tipo) return "";
  
  // Normalizar o tipo para comparação
  const tipoNorm = tipo.toLowerCase().trim();
  
  // Buscar no mapa de skills
  if (skillsNomesMap.has(tipoNorm)) {
    return skillsNomesMap.get(tipoNorm)!;
  }
  
  // Tentar variações
  for (const [key, value] of skillsNomesMap.entries()) {
    if (key.toLowerCase() === tipoNorm) {
      return value;
    }
  }
  
  // Fallback: formatar o tipo removendo sufixos e capitalizando
  return tipo
    .replace(/ -$/, "") // Remove sufixo " -"
    .split(/[\s_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Formata a data do prazo para exibição
 */
function formatarDataPrazo(prazo: Date): string {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dataPrazo = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
  
  const diffDias = Math.floor((dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDias < 0) {
    return `Vencido há ${Math.abs(diffDias)} dia${Math.abs(diffDias) > 1 ? 's' : ''}`;
  } else if (diffDias === 0) {
    return "HOJE";
  } else if (diffDias === 1) {
    return "Amanhã";
  } else if (diffDias <= 7) {
    return `Em ${diffDias} dias`;
  } else {
    return prazo.toLocaleDateString('pt-BR');
  }
}

const Roteirizacao = () => {
  // Permissões da tela
  const { podeEditar } = useTelaPermissao("roteirizacao");

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [tiposFilter, setTiposFilter] = useState<string[]>([]); // Array para seleção múltipla
  const [tiposFilterOpen, setTiposFilterOpen] = useState(false); // Controle do popover
  
  // Novos filtros multi-seleção
  const [contratosFilter, setContratosFilter] = useState<string[]>([]);
  const [contratosFilterOpen, setContratosFilterOpen] = useState(false);
  const [centrosCustoFilter, setCentrosCustoFilter] = useState<string[]>([]);
  const [centrosCustoFilterOpen, setCentrosCustoFilterOpen] = useState(false);
  const [municipiosFilter, setMunicipiosFilter] = useState<string[]>([]);
  const [municipiosFilterOpen, setMunicipiosFilterOpen] = useState(false);
  const [bairrosFilter, setBairrosFilter] = useState<string[]>([]);
  const [bairrosFilterOpen, setBairrosFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [gruposFilter, setGruposFilter] = useState<string[]>([]);
  const [gruposFilterOpen, setGruposFilterOpen] = useState(false);
  const [territoriosFilter, setTerritoriosFilter] = useState<string[]>([]);
  const [territoriosFilterOpen, setTerritoriosFilterOpen] = useState(false);
  
  // Filtros avançados do Backlog
  const [showFiltersBacklog, setShowFiltersBacklog] = useState(true);
  const [prazoInicio, setPrazoInicio] = useState("");
  const [prazoFim, setPrazoFim] = useState("");
  const [coordenadasFilter, setCoordenadasFilter] = useState<string>("all");
  const [reguladaFilter, setReguladaFilter] = useState<string>("all");
  const [backlogLimit, setBacklogLimit] = useState(50); // Limite de itens exibidos no backlog
  
  // Dialog de detalhes da OS
  const [detalhesOSOpen, setDetalhesOSOpen] = useState(false);
  const [detalhesOSId, setDetalhesOSId] = useState<string | null>(null);
  
  // Dialog de edição rápida de coordenadas
  const [editarCoordsOpen, setEditarCoordsOpen] = useState(false);
  const [editarCoordsOS, setEditarCoordsOS] = useState<OrdemServico | null>(null);
  const [editarCoordsLat, setEditarCoordsLat] = useState("");
  const [editarCoordsLng, setEditarCoordsLng] = useState("");
  const [salvandoCoords, setSalvandoCoords] = useState(false);
  const [selecionandoCoordNoMapa, setSelecionandoCoordNoMapa] = useState(false);
  
  // Dialog de criação de polígono/território
  const [criandoPoligono, setCriandoPoligono] = useState(false);
  const [novoPoligono, setNovoPoligono] = useState<{ lat: number; lng: number }[] | null>(null);
  const [criarTerritorioOpen, setCriarTerritorioOpen] = useState(false);
  const [novoTerritorioNome, setNovoTerritorioNome] = useState("");
  const [novoTerritorioCor, setNovoTerritorioCor] = useState("#3b82f6");
  const [novoTerritorioEquipes, setNovoTerritorioEquipes] = useState<string[]>([]);
  const [salvandoTerritorio, setSalvandoTerritorio] = useState(false);
  
  const [rotas, setRotas] = useState<RotaEquipe[]>([]);
  const [isOtimizando, setIsOtimizando] = useState(false);
  
  // Estado para parâmetros de roteirização
  const [parametrosModalOpen, setParametrosModalOpen] = useState(false);
  const [parametros, setParametros] = useState<ParametrosRoteirizacao>({ ...PARAMETROS_PADRAO });
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loadingEquipes, setLoadingEquipes] = useState(true);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [loadingOrdens, setLoadingOrdens] = useState(true);
  const [equipesSelecionadas, setEquipesSelecionadas] = useState<string[]>([]);
  const [naoAlocadas, setNaoAlocadas] = useState<Record<string, string>>({});
  const [equipeHovered, setEquipeHovered] = useState<string | null>(null);
  const [usarTerritorios, setUsarTerritorios] = useState(true); // V16: Padrão habilitado
  const [mostrarTerritoriosNoMapa, setMostrarTerritoriosNoMapa] = useState(true); // V16: Padrão habilitado
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [territoriosSelecionados, setTerritoriosSelecionados] = useState<string[]>([]);
  const [territoriosVisiveis, setTerritoriosVisiveis] = useState<string[]>([]); // Territórios visíveis no mapa (botão olho)
  const [expectativaDialogOpen, setExpectativaDialogOpen] = useState(false);
  const [expectativas, setExpectativas] = useState<ExpectativaTerritorio[]>([]);
  const [selecaoTerritoriosDialogOpen, setSelecaoTerritoriosDialogOpen] = useState(false);
  const [opcoesRoteiros, setOpcoesRoteiros] = useState<OpcaoRoteiro[]>([]);
  const [opcaoRoteiroSelecionada, setOpcaoRoteiroSelecionada] = useState<string | null>(null);
  const [mostrarOpcoesDialog, setMostrarOpcoesDialog] = useState(false);
  // V20: Mapeamento de território -> opção selecionada (permite seleção individual por território)
  const [selecaoIndividualTerritorios, setSelecaoIndividualTerritorios] = useState<Map<string, string>>(new Map());
  // Editor de Rotas: Equipe selecionada para edição
  const [equipeEditando, setEquipeEditando] = useState<string | null>(null);
  const [osSelecionadaNoMapa, setOsSelecionadaNoMapa] = useState<string | null>(null);
  const [osSelecionadaNoEditor, setOsSelecionadaNoEditor] = useState<string | null>(null);
  const [focarOSNoMapa, setFocarOSNoMapa] = useState(false); // Controla se deve centralizar mapa na OS
  const [osEditandoPosicao, setOsEditandoPosicao] = useState<string | null>(null);
  const [novaPosicaoInput, setNovaPosicaoInput] = useState<string>("");
  const [metricasAntesEdicao, setMetricasAntesEdicao] = useState<{
    distancia: number;
    tempo: number;
    faturamento: number;
    urgentes: number;
  } | null>(null);
  
  // Filtros de tipos de serviços
  interface FiltroTipoServico {
    tipo: string;
    considerar: boolean;
    prazoLimite: string; // formato: "YYYY-MM-DDTHH:mm"
  }
  const [filtrosTiposServicos, setFiltrosTiposServicos] = useState<Map<string, FiltroTipoServico>>(new Map());
  const [selecaoServicosDialogOpen, setSelecaoServicosDialogOpen] = useState(false);
  
  // Estados para confirmação de planejamento
  const [confirmarPlanejamentoDialogOpen, setConfirmarPlanejamentoDialogOpen] = useState(false);
  const [dataPlanejamento, setDataPlanejamento] = useState<string>("");
  const [salvandoPlanejamento, setSalvandoPlanejamento] = useState(false);
  
  // Estados para consulta de planejamentos
  const [consultarPlanejamentosDialogOpen, setConsultarPlanejamentosDialogOpen] = useState(false);
  const [filtroEquipeConsulta, setFiltroEquipeConsulta] = useState<string>("all");
  const [filtroDataConsulta, setFiltroDataConsulta] = useState<string>("");
  const [planejamentosEncontrados, setPlanejamentosEncontrados] = useState<any[]>([]);
  const [carregandoPlanejamentos, setCarregandoPlanejamentos] = useState(false);

  // Buscar OSs em andamento para destacar na lista
  // Polling otimizado: 60 segundos + staleTime para evitar refetch desnecessário
  const { data: osEmAndamento } = useQuery({
    queryKey: ["os-em-andamento-roteirizacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          ordem_servico_id,
          equipe_id,
          ordens_servico:ordem_servico_id (id, numero, status)
        `)
        .in("ordens_servico.status", ["em_deslocamento", "no_local", "em_andamento", "em_execucao"]);
      
      if (error) {
        console.error("Erro ao buscar OSs em andamento:", error);
        return [];
      }
      
      // Retornar um Set com os IDs das OSs em andamento
      return new Set((data || []).map((d: any) => d.ordem_servico_id).filter(Boolean));
    },
    staleTime: 60000, // Dados são considerados frescos por 60 segundos
    refetchInterval: 60000, // Atualizar a cada 60 segundos (antes era 10)
    refetchOnWindowFocus: false, // Evitar refetch ao voltar para a aba
  });

  // Carregar equipes do Supabase (apenas ativas)
  useEffect(() => {
    const fetchEquipes = async () => {
      setLoadingEquipes(true);
      try {
        const { data, error } = await supabase
          .from("tecnicos")
          .select("*")
          .neq("status", "offline") // Apenas equipes ativas
          .order("codigo");

        if (error) throw error;

        const equipesConvertidas = tecnicosParaEquipes(data || []);
        setEquipes(equipesConvertidas);
        
        // Selecionar todas as equipes por padrão
        if (equipesConvertidas.length > 0) {
          setEquipesSelecionadas(equipesConvertidas.map((e) => e.id));
        }
      } catch (error: any) {
        console.error("Erro ao carregar equipes:", error);
        toast.error("Erro ao carregar equipes");
      } finally {
        setLoadingEquipes(false);
      }
    };

    fetchEquipes();
  }, []);

  // Carregar nomes e grupos das skills para exibição
  useEffect(() => {
    const fetchSkillsNomes = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("skills")
          .select("codigo, nome, grupo_servico")
          .eq("ativo", true);
        
        if (error) throw error;
        
        // Preencher o mapa de nomes e grupos
        const novoMapaNomes = new Map<string, string>();
        const novoMapaGrupos = new Map<string, string>();
        (data || []).forEach((skill: any) => {
          // Mapear código normalizado (minúsculo, sem " -") para nome
          const codigoNorm = skill.codigo.toLowerCase().replace(/ -$/, "").trim();
          novoMapaNomes.set(codigoNorm, skill.nome);
          
          // Também mapear o código exato
          novoMapaNomes.set(skill.codigo.toLowerCase(), skill.nome);
          
          // Mapear grupo de serviço (se existir)
          if (skill.grupo_servico) {
            novoMapaGrupos.set(codigoNorm, skill.grupo_servico);
            novoMapaGrupos.set(skill.codigo.toLowerCase(), skill.grupo_servico);
          }
        });
        
        skillsNomesMap = novoMapaNomes;
        skillsGruposMap = novoMapaGrupos;
        console.log("[Roteirização] Skills carregadas para exibição:", novoMapaNomes.size, "grupos:", novoMapaGrupos.size);
      } catch (error) {
        console.error("Erro ao carregar nomes das skills:", error);
      }
    };
    
    fetchSkillsNomes();
  }, []);

  // Carregar territórios do Supabase
  useEffect(() => {
    const loadTerritorios = async () => {
      const loaded = await carregarTerritorios();
      setTerritorios(loaded);
      // Marcar todos os territórios ativos por padrão (com polígono válido)
      const territoriosAtivos = loaded.filter(t => t.ativo && t.poligono.length >= 3);
      if (territoriosAtivos.length > 0) {
        const ids = territoriosAtivos.map(t => t.id);
        setTerritoriosSelecionados(ids);
        setTerritoriosVisiveis(ids); // Todos visíveis por padrão
      }
    };
    loadTerritorios();
  }, []);

  // Estado para progresso de carregamento
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });

  // Carregar ordens de serviço do Supabase - OTIMIZADO
  // Usa query paralela e seleciona apenas campos necessários
  useEffect(() => {
    let isCancelled = false; // Flag para evitar atualizações após unmount ou re-execução
    
    const fetchOrdensServico = async () => {
      setLoadingOrdens(true);
      setLoadingProgress({ loaded: 0, total: 0 });
      
      const startTime = performance.now();
      
      try {
        console.log(`[Roteirização] Iniciando carregamento otimizado...`);
        
        // Passo 1: Obter contagem total e pre-carregar skills
        const [countResult] = await Promise.all([
          supabase
            .from("ordens_servico")
            .select("id", { count: "exact", head: true })
            .in("status", ["pendente", "atrasada"]),
          getDadosSkills([]) // Pre-carregar dados de skills
        ]);

        if (countResult.error) throw countResult.error;
        if (isCancelled) return;
        
        const totalCount = countResult.count || 0;
        console.log(`[Roteirização] Total de OSs: ${totalCount} (contagem em ${(performance.now() - startTime).toFixed(0)}ms)`);
        
        if (totalCount === 0) {
          setOrdensServico([]);
          setLoadingProgress({ loaded: 0, total: 0 });
          return;
        }
        
        setLoadingProgress({ loaded: 0, total: totalCount });

        // Passo 2: Carregar dados em lotes paralelos
        // IMPORTANTE: O Supabase tem limite padrão de 1000 registros por requisição
        // O .range() especifica o intervalo mas o limite ainda se aplica
        const PAGE_SIZE = 1000; // Limite máximo do Supabase por requisição
        const dataMap = new Map<string, Tables<"ordens_servico">>(); // Usar Map para evitar duplicatas
        
        // Calcular quantas páginas precisamos
        const totalPages = Math.ceil(totalCount / PAGE_SIZE);
        const PARALLEL_REQUESTS = 5; // Aumentado para compensar páginas menores
        
        console.log(`[Roteirização] Carregando ${totalPages} páginas de ${PAGE_SIZE} registros em lotes de ${PARALLEL_REQUESTS}...`);
        
        for (let pageStart = 0; pageStart < totalPages; pageStart += PARALLEL_REQUESTS) {
          if (isCancelled) return;
          
          const batchPromises = [];
          
          // Criar requisições para este lote de páginas
          for (let i = 0; i < PARALLEL_REQUESTS && (pageStart + i) < totalPages; i++) {
            const pageIndex = pageStart + i;
            const currentOffset = pageIndex * PAGE_SIZE;
            
            batchPromises.push(
              supabase
                .from("ordens_servico")
                .select(`
                  id, numero, tipo, endereco, municipio, bairro, latitude, longitude, prazo, valor, duracao_estimada, regulada, status,
                  contrato_id, centro_custo_id,
                  contratos:contrato_id (codigo, nome),
                  centros_custo:centro_custo_id (codigo, nome)
                `)
                .in("status", ["pendente", "atrasada"])
                .order("created_at", { ascending: false })
                .range(currentOffset, currentOffset + PAGE_SIZE - 1)
                .then(result => ({ pageIndex, offset: currentOffset, ...result }))
            );
          }

          if (batchPromises.length === 0) break;

          const results = await Promise.all(batchPromises);
          
          if (isCancelled) return;
          
          for (const result of results) {
            if (result.error) {
              console.error(`[Roteirização] Erro na página ${result.pageIndex} (offset ${result.offset}):`, result.error);
              throw result.error;
            }
            if (result.data && result.data.length > 0) {
              console.log(`[Roteirização] Página ${result.pageIndex}: ${result.data.length} registros`);
              for (const item of result.data) {
                dataMap.set(item.id, item); // Usar Map para garantir unicidade
              }
            }
          }
          
          setLoadingProgress({ loaded: dataMap.size, total: totalCount });
          console.log(`[Roteirização] Progresso: ${dataMap.size}/${totalCount} OSs carregadas`);
        }

        if (isCancelled) return;
        
        const allData = Array.from(dataMap.values());
        console.log(`[Roteirização] Dados carregados: ${allData.length} em ${(performance.now() - startTime).toFixed(0)}ms`);

        // Passo 3: Converter usando skills já carregadas
        const conversionStart = performance.now();
        const ordensConvertidas = await mapSupabaseOrdensServicoToOrdemServico(allData as any);
        console.log(`[Roteirização] Conversão em ${(performance.now() - conversionStart).toFixed(0)}ms`);
        
        if (isCancelled) return;
        
        setOrdensServico(ordensConvertidas);
        setLoadingProgress({ loaded: ordensConvertidas.length, total: totalCount });
        console.log(`[Roteirização] ✅ Completo: ${ordensConvertidas.length} OSs em ${(performance.now() - startTime).toFixed(0)}ms`);
        
      } catch (error: any) {
        if (!isCancelled) {
          console.error("Erro ao carregar ordens de serviço:", error);
          toast.error("Erro ao carregar ordens de serviço");
        }
      } finally {
        console.log(`[Roteirização] Finally - isCancelled: ${isCancelled}`);
        if (!isCancelled) {
          console.log(`[Roteirização] Setando loadingOrdens para false`);
          setLoadingOrdens(false);
        }
      }
    };

    fetchOrdensServico();
    
    return () => {
      isCancelled = true; // Cancelar operações pendentes ao desmontar/re-executar
    };
  }, []);

  // Resetar limite do backlog quando filtros mudarem
  useEffect(() => {
    setBacklogLimit(50);
  }, [searchTerm, tiposFilter, contratosFilter, centrosCustoFilter, municipiosFilter, bairrosFilter, statusFilter, prazoInicio, prazoFim, coordenadasFilter, reguladaFilter]);

  // Carregar planejamento se houver ID nos parâmetros da URL
  useEffect(() => {
    const planejamentoId = searchParams.get('planejamento');
    if (planejamentoId && rotas.length === 0) {
      handleCarregarPlanejamento(planejamentoId);
    }
  }, [searchParams]);

  // Scroll para a OS selecionada no Editor quando mudada pelo mapa
  useEffect(() => {
    if (osSelecionadaNoEditor) {
      // Encontrar o elemento no DOM
      const elemento = document.querySelector(`[data-os-id="${osSelecionadaNoEditor}"]`) as HTMLElement;
      if (elemento) {
        // Encontrar o container scrollável (pai com overflow-y-auto)
        const container = elemento.closest('.overflow-y-auto') as HTMLElement;
        if (container) {
          // Calcular posição do elemento dentro do container
          const containerRect = container.getBoundingClientRect();
          const elementoRect = elemento.getBoundingClientRect();
          
          // Calcular se o elemento está visível no container
          const isVisible = elementoRect.top >= containerRect.top && 
                           elementoRect.bottom <= containerRect.bottom;
          
          // Só fazer scroll se não estiver visível
          if (!isVisible) {
            const scrollTop = elemento.offsetTop - container.offsetTop - (container.clientHeight / 2) + (elemento.clientHeight / 2);
            container.scrollTo({ top: scrollTop, behavior: 'smooth' });
          }
        }
      }
    }
  }, [osSelecionadaNoEditor]);

  // Função para carregar planejamento na tela de roteirização
  const handleCarregarPlanejamento = async (planejamentoId: string) => {
    try {
      console.log("[ROTEIRIZAÇÃO] Carregando planejamento:", planejamentoId);
      setLoadingOrdens(true);
      
      // Buscar planejamento com todas as informações
      const { data: planejamento, error: erroPlanejamento } = await supabase
        .from("planejamentos")
        .select(`
          *,
          planejamento_ordens (
            *,
            ordens_servico:ordem_servico_id (*),
            tecnicos:equipe_id (*)
          )
        `)
        .eq("id", planejamentoId)
        .single();

      if (erroPlanejamento) throw erroPlanejamento;
      if (!planejamento) throw new Error("Planejamento não encontrado");

      // Buscar todas as equipes se ainda não foram carregadas
      let equipesDisponiveis = equipes;
      if (equipesDisponiveis.length === 0) {
        const { data: tecnicosData } = await supabase
          .from("tecnicos")
          .select("*");

        if (tecnicosData) {
          equipesDisponiveis = tecnicosParaEquipes(tecnicosData);
          setEquipes(equipesDisponiveis);
        }
      }

      // Reconstruir rotas a partir do planejamento
      const rotasReconstruidas: RotaEquipe[] = [];
      const ordensPorEquipe = new Map<string, any[]>();

      // Agrupar ordens por equipe
      if (planejamento.planejamento_ordens) {
        for (const po of planejamento.planejamento_ordens) {
          if (!ordensPorEquipe.has(po.equipe_id)) {
            ordensPorEquipe.set(po.equipe_id, []);
          }
          ordensPorEquipe.get(po.equipe_id)!.push(po);
        }
      }

      // Criar rotas para cada equipe
      for (const [equipeId, ordens] of ordensPorEquipe.entries()) {
        let equipe = equipesDisponiveis.find(e => e.id === equipeId);
        
        // Se não encontrou a equipe, tentar usar dados do relacionamento
        if (!equipe && ordens.length > 0 && ordens[0].tecnicos) {
          const equipesTemp = tecnicosParaEquipes([ordens[0].tecnicos]);
          if (equipesTemp.length > 0) {
            equipe = equipesTemp[0];
          }
        }
        
        if (!equipe) {
          console.warn(`[ROTEIRIZAÇÃO] Equipe ${equipeId} não encontrada`);
          continue;
        }

        // Ordenar ordens por ordem_na_rota
        ordens.sort((a, b) => a.ordem_na_rota - b.ordem_na_rota);

        const servicos: RotaServico[] = [];
        let distanciaTotal = 0;
        let tempoTotal = 0;
        let faturamentoTotal = 0;

        for (const po of ordens) {
          if (po.ordens_servico) {
            const osArray = await mapSupabaseOrdensServicoToOrdemServico([po.ordens_servico]);
            if (osArray && osArray.length > 0) {
              const os = osArray[0];
              servicos.push({
                tipo: "SERVICO",
                ordemServico: os,
                ordemNaRota: po.ordem_na_rota,
                distancia: po.distancia_km || 0,
                tempoTotal: po.tempo_estimado_minutos || 0,
                horaInicio: po.hora_inicio_estimada || "",
                horaFim: po.hora_fim_estimada || "",
                eta: po.hora_inicio_estimada || "",
              });
              distanciaTotal += po.distancia_km || 0;
              tempoTotal += po.tempo_estimado_minutos || 0;
              faturamentoTotal += os.valor || 0;
            }
          }
        }

        rotasReconstruidas.push({
          equipe,
          servicos,
          distanciaTotal,
          tempoTotal,
          faturamentoTotal,
          progresso: 0,
        });
      }

      setRotas(rotasReconstruidas);
      const dataExibicao = new Date(planejamento.data_planejamento + 'T12:00:00');
      toast.success(`Planejamento carregado: ${dataExibicao.toLocaleDateString('pt-BR')}`);
      
      // Limpar parâmetro da URL
      setSearchParams({});
    } catch (error: any) {
      console.error("Erro ao carregar planejamento:", error);
      toast.error("Erro ao carregar planejamento", {
        description: error.message || "Erro desconhecido",
        duration: 30000,
      });
    } finally {
      setLoadingOrdens(false);
    }
  };

  // Função para salvar rascunho (sem data específica, apenas salva as rotas)
  const handleSalvarRascunho = async () => {
    if (rotas.length === 0) {
      toast.error("Não há rotas para salvar");
      return;
    }

    setSalvandoPlanejamento(true);
    console.log("[RASCUNHO] Iniciando salvamento de rascunho...");

    try {
      // Salvar rascunho no localStorage por enquanto
      // TODO: Implementar salvamento de rascunho no banco se necessário
      const rascunho = {
        rotas: rotas.map(rota => ({
          equipeId: rota.equipe.id,
          servicos: rota.servicos.map(s => ({
            tipo: s.tipo,
            ordemServicoId: s.ordemServico?.id,
            ordemNaRota: s.ordemNaRota,
            distancia: s.distancia,
            tempoTotal: s.tempoTotal,
            horaInicio: s.horaInicio,
            horaFim: s.horaFim,
          })),
          distanciaTotal: rota.distanciaTotal,
          tempoTotal: rota.tempoTotal,
          faturamentoTotal: rota.faturamentoTotal,
        })),
        dataSalvamento: new Date().toISOString(),
      };

      localStorage.setItem("roteirizacao_rascunho", JSON.stringify(rascunho));
      toast.success("Rascunho salvo com sucesso!");
    } catch (error: any) {
      console.error("[RASCUNHO] Erro ao salvar rascunho:", error);
      toast.error("Erro ao salvar rascunho", {
        description: error.message || "Erro desconhecido",
        duration: 30000,
      });
    } finally {
      setSalvandoPlanejamento(false);
    }
  };

  // Filtrar OS não alocadas (que não estão em nenhuma rota)
  const osAlocadas = useMemo(() => {
    return new Set(
      rotas.flatMap((rota) => 
        rota.servicos
          .filter((s) => s.tipo === "SERVICO" && s.ordemServico)
          .map((s) => s.ordemServico!.id)
      )
    );
  }, [rotas]);

  const equipesAtivas = useMemo(
    () => equipes.filter((e) => equipesSelecionadas.includes(e.id)),
    [equipes, equipesSelecionadas]
  );

  // TODAS as OSs não alocadas (para exibição no mapa - SEM filtro de território)
  const osPendentesTodas = useMemo(() => {
    return ordensServico.filter((os) => !osAlocadas.has(os.id));
  }, [ordensServico, osAlocadas]);

  // Filtrar OSs pendentes considerando territórios selecionados e filtros de tipos (para lista e roteirização)
  const osPendentes = useMemo(() => {
    let filtradas = osPendentesTodas;
    
    // Aplicar filtros de tipos de serviços
    if (filtrosTiposServicos.size > 0) {
      filtradas = filtradas.filter(os => {
        const tipoLower = os.tipo.toLowerCase();
        const filtro = filtrosTiposServicos.get(tipoLower);
        
        // Se não há filtro para este tipo, não considerar (por segurança)
        if (!filtro) return false;
        
        // Se não está marcado para considerar, excluir
        if (!filtro.considerar) return false;
        
        // Se há prazo limite definido, verificar se a OS está dentro do prazo
        if (filtro.prazoLimite && os.prazo) {
          const prazoLimiteDate = new Date(filtro.prazoLimite);
          const prazoOS = new Date(os.prazo);
          
          // Se o prazo da OS é depois do prazo limite, excluir
          if (prazoOS > prazoLimiteDate) return false;
        }
        
        return true;
      });
    }
    
    // Se usar territórios e houver territórios selecionados, filtrar apenas OSs dentro desses territórios
    if (usarTerritorios && territoriosSelecionados.length > 0) {
      const territoriosSelecionadosObjs = territorios.filter(t => territoriosSelecionados.includes(t.id));
      filtradas = filtradas.filter(os => {
        return territoriosSelecionadosObjs.some(t => 
          t.ativo && t.poligono.length >= 3 && pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, t.poligono)
        );
      });
    }
    
    return filtradas;
  }, [osPendentesTodas, usarTerritorios, territoriosSelecionados, territorios, filtrosTiposServicos]);

  // Buscar todos os tipos de serviços (skills) cadastrados e ativos
  const { data: tiposServicosCadastrados } = useQuery({
    queryKey: ["skills-ativos-roteirizacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("codigo, nome")
        .eq("ativo", true)
        .order("nome");
      
      if (error) {
        console.error("Erro ao buscar tipos de serviços:", error);
        return [];
      }
      
      return data || [];
    },
  });

  // Obter tipos únicos de TODOS os tipos de serviços cadastrados (não apenas das OSs carregadas)
  const todosTiposDisponiveis = useMemo(() => {
    // Usar os tipos de serviços cadastrados no banco de dados
    if (tiposServicosCadastrados && tiposServicosCadastrados.length > 0) {
      return tiposServicosCadastrados.map(skill => skill.codigo.toLowerCase()).sort();
    }
    // Fallback: usar tipos das OSs se não houver skills cadastrados
    const tipos = new Set(ordensServico.map(os => os.tipo.toLowerCase()));
    return Array.from(tipos).sort();
  }, [tiposServicosCadastrados, ordensServico]);

  // V19.6/V19.7: Calcular OSs URGENTES que NÃO estão em nenhum território selecionado
  // Urgente = RELIGA OU (Regulada com prazo vencido ou vencendo hoje)
  const osUrgentesForaTerritorios = useMemo(() => {
    if (!usarTerritorios || territoriosSelecionados.length === 0) {
      return [];
    }

    const agora = new Date();
    const fimDoDia = new Date();
    fimDoDia.setHours(23, 59, 59, 999);

    const territoriosSelecionadosObjs = territorios.filter(t => territoriosSelecionados.includes(t.id));

    return osPendentesTodas.filter(os => {
      // RELIGA é sempre urgente
      const ehReliga = os.tipo.toUpperCase() === 'RELIGA';
      if (ehReliga) {
        // Verificar se está FORA de todos os territórios selecionados
        const estaEmAlgumTerritorio = territoriosSelecionadosObjs.some(t =>
          t.ativo && t.poligono.length >= 3 && pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, t.poligono)
        );
        return !estaEmAlgumTerritorio;
      }

      // Para reguladas: só é urgente se o prazo está vencido ou vence hoje
      const ehRegulada = os.regulada === true;
      if (ehRegulada && os.prazo) {
        const prazoDate = new Date(os.prazo);
        // Prazo vencido (passou) ou vence até o fim de hoje
        const prazoVencidoOuHoje = prazoDate <= fimDoDia;
        
        if (prazoVencidoOuHoje) {
          const estaEmAlgumTerritorio = territoriosSelecionadosObjs.some(t =>
            t.ativo && t.poligono.length >= 3 && pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, t.poligono)
          );
          return !estaEmAlgumTerritorio;
        }
      }

      // Não é urgente
      return false;
    });
  }, [osPendentesTodas, usarTerritorios, territoriosSelecionados, territorios]);
  
  // Estado para controlar exibição do dialog de OSs urgentes fora de territórios
  const [mostrarOsUrgentesForaDialog, setMostrarOsUrgentesForaDialog] = useState(false);
  const [osUrgenteSelecionadaNoMapa, setOsUrgenteSelecionadaNoMapa] = useState<OrdemServico | null>(null);
  const [osUrgentesTodasNoMapa, setOsUrgentesTodasNoMapa] = useState<OrdemServico[]>([]); // V19.7: Para destacar todas as OSs urgentes de uma vez

  // Obter tipos únicos das OSs pendentes para o filtro
  // ============================================
  // FILTROS DEPENDENTES - cada filtro considera os outros filtros ativos
  // ============================================

  // Função auxiliar para verificar se uma OS passa nos filtros (exceto o filtro especificado)
  const osPassaFiltros = (os: OrdemServico, excluirFiltro: string) => {
    // Filtros de seleção múltipla
    const matchesTipo = excluirFiltro === 'tipo' || tiposFilter.length === 0 || tiposFilter.some(tipo => os.tipo.toLowerCase() === tipo.toLowerCase());
    const matchesContrato = excluirFiltro === 'contrato' || contratosFilter.length === 0 || (os.contrato_codigo && contratosFilter.includes(os.contrato_codigo));
    const matchesCentroCusto = excluirFiltro === 'centroCusto' || centrosCustoFilter.length === 0 || (os.centro_custo_codigo && centrosCustoFilter.includes(os.centro_custo_codigo));
    const matchesMunicipio = excluirFiltro === 'municipio' || municipiosFilter.length === 0 || (os.municipio && municipiosFilter.includes(os.municipio));
    const matchesBairro = excluirFiltro === 'bairro' || bairrosFilter.length === 0 || (os.bairro && bairrosFilter.includes(os.bairro));
    const matchesStatus = excluirFiltro === 'status' || statusFilter.length === 0 || statusFilter.some(status => os.status.toLowerCase() === status.toLowerCase());
    
    // Filtro de Regulada
    let matchesRegulada = true;
    if (excluirFiltro !== 'regulada') {
      if (reguladaFilter === "sim") {
        matchesRegulada = os.regulada === true;
      } else if (reguladaFilter === "nao") {
        matchesRegulada = os.regulada === false;
      }
    }
    
    // Filtro de Coordenadas
    let matchesCoordenadas = true;
    if (excluirFiltro !== 'coordenadas') {
      if (coordenadasFilter === "com") {
        matchesCoordenadas = os.latitude !== null && os.longitude !== null;
      } else if (coordenadasFilter === "sem") {
        matchesCoordenadas = os.latitude === null || os.longitude === null;
      }
    }
    
    // Filtro de Data de Prazo
    let matchesPrazoInicio = true;
    let matchesPrazoFim = true;
    if (excluirFiltro !== 'prazo') {
      if (prazoInicio && os.prazo) {
        const prazoDate = new Date(os.prazo);
        const inicioDate = new Date(prazoInicio);
        inicioDate.setHours(0, 0, 0, 0);
        matchesPrazoInicio = prazoDate >= inicioDate;
      }
      if (prazoFim && os.prazo) {
        const prazoDate = new Date(os.prazo);
        const fimDate = new Date(prazoFim);
        fimDate.setHours(23, 59, 59, 999);
        matchesPrazoFim = prazoDate <= fimDate;
      }
    }
    
    // Filtro de Grupo de Serviço
    const matchesGrupo = excluirFiltro === 'grupo' || gruposFilter.length === 0 || gruposFilter.includes(obterGrupoServico(os.tipo));
    
    // Filtro de Territórios (OSs dentro dos territórios ativos selecionados OU com bairro cadastrado no território)
    let matchesTerritorio = true;
    if (excluirFiltro !== 'territorio' && territoriosFilter.length > 0) {
      const territoriosFiltrados = territorios.filter(t => territoriosFilter.includes(t.id));
      
      // Verificar se a OS está DENTRO de algum dos territórios selecionados (por coordenadas)
      const dentroDoTerritorio = territoriosFiltrados.some(t => 
        t.ativo && t.poligono.length >= 3 && 
        os.latitude !== null && os.longitude !== null &&
        pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, t.poligono)
      );
      
      // Verificar se o BAIRRO da OS está cadastrado em algum dos territórios selecionados
      // (isso inclui OSs com coordenadas suspeitas - bairro pertence ao território mas coordenadas não)
      const bairroCadastradoNoTerritorio = os.bairro ? territoriosFiltrados.some(t => 
        t.ativo && t.bairros && t.bairros.some(b => 
          b.toLowerCase().trim() === os.bairro?.toLowerCase().trim()
        )
      ) : false;
      
      matchesTerritorio = dentroDoTerritorio || bairroCadastradoNoTerritorio;
    }
    
    return matchesTipo && matchesContrato && matchesCentroCusto && matchesMunicipio && 
           matchesBairro && matchesStatus && matchesRegulada && matchesCoordenadas && 
           matchesPrazoInicio && matchesPrazoFim && matchesGrupo && matchesTerritorio;
  };

  // Função para obter o grupo de um tipo de serviço (usando cadastro da skill)
  const obterGrupoServico = (tipo: string): string => {
    // Normalizar o tipo para buscar no mapa
    const tipoNorm = tipo.toLowerCase().replace(/ -$/, "").trim();
    
    // Buscar no mapa de grupos (cadastrado em Tipos de Serviço)
    if (skillsGruposMap.has(tipoNorm)) {
      return skillsGruposMap.get(tipoNorm)!;
    }
    
    // Buscar também pelo código exato
    if (skillsGruposMap.has(tipo.toLowerCase())) {
      return skillsGruposMap.get(tipo.toLowerCase())!;
    }
    
    // Tentar variações
    for (const [key, value] of skillsGruposMap.entries()) {
      if (key.toLowerCase() === tipoNorm || key.includes(tipoNorm) || tipoNorm.includes(key)) {
        return value;
      }
    }
    
    // Fallback: se não encontrar no cadastro, retornar "Sem grupo"
    return 'Sem grupo';
  };

  // Grupos de serviço disponíveis (considerando todos os outros filtros)
  const gruposDisponiveis = useMemo(() => {
    const grupos = new Set<string>();
    osPendentesTodas.forEach(os => {
      if (osPassaFiltros(os, 'grupo')) {
        grupos.add(obterGrupoServico(os.tipo));
      }
    });
    return Array.from(grupos).sort();
  }, [osPendentesTodas, tiposFilter, contratosFilter, centrosCustoFilter, municipiosFilter, bairrosFilter, statusFilter, territoriosFilter, reguladaFilter, coordenadasFilter, prazoInicio, prazoFim, gruposFilter]);

  // Territórios disponíveis para filtro (apenas os que contêm OSs que passam nos demais filtros)
  // Considera tanto OSs dentro do polígono quanto OSs com bairro cadastrado no território
  const territoriosDisponiveis = useMemo(() => {
    const territoriosAtivos = territorios.filter(t => t.ativo);
    
    // Filtrar apenas territórios que contêm pelo menos uma OS que passa nos filtros
    return territoriosAtivos.filter(territorio => {
      return osPendentesTodas.some(os => {
        // Verificar se a OS passa nos demais filtros (exceto território)
        if (!osPassaFiltros(os, 'territorio')) return false;
        
        // Verificar se a OS está DENTRO deste território (por coordenadas)
        const dentroDoPoligono = territorio.poligono.length >= 3 && 
          os.latitude !== null && os.longitude !== null &&
          pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, territorio.poligono);
        
        // Verificar se o BAIRRO da OS está cadastrado neste território
        const bairroCadastrado = os.bairro && territorio.bairros && 
          territorio.bairros.some(b => b.toLowerCase().trim() === os.bairro?.toLowerCase().trim());
        
        return dentroDoPoligono || bairroCadastrado;
      });
    });
  }, [territorios, osPendentesTodas, tiposFilter, contratosFilter, centrosCustoFilter, municipiosFilter, bairrosFilter, statusFilter, gruposFilter, reguladaFilter, coordenadasFilter, prazoInicio, prazoFim, territoriosFilter]);

  const tiposDisponiveis = useMemo(() => {
    const tipos = new Set<string>();
    osPendentesTodas.forEach(os => {
      if (osPassaFiltros(os, 'tipo')) {
        tipos.add(os.tipo.toLowerCase());
      }
    });
    return Array.from(tipos).sort();
  }, [osPendentesTodas, contratosFilter, centrosCustoFilter, municipiosFilter, bairrosFilter, statusFilter, gruposFilter, territoriosFilter, reguladaFilter, coordenadasFilter, prazoInicio, prazoFim]);

  const contratosDisponiveis = useMemo(() => {
    const contratos = new Map<string, string>();
    osPendentesTodas.forEach(os => {
      if (os.contrato_codigo && os.contrato_nome && osPassaFiltros(os, 'contrato')) {
        contratos.set(os.contrato_codigo, os.contrato_nome);
      }
    });
    return Array.from(contratos.entries())
      .map(([codigo, nome]) => ({ codigo, nome }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [osPendentesTodas, tiposFilter, centrosCustoFilter, municipiosFilter, bairrosFilter, statusFilter, gruposFilter, territoriosFilter, reguladaFilter, coordenadasFilter, prazoInicio, prazoFim]);

  const centrosCustoDisponiveis = useMemo(() => {
    const centros = new Map<string, string>();
    osPendentesTodas.forEach(os => {
      if (os.centro_custo_codigo && os.centro_custo_nome && osPassaFiltros(os, 'centroCusto')) {
        centros.set(os.centro_custo_codigo, os.centro_custo_nome);
      }
    });
    return Array.from(centros.entries())
      .map(([codigo, nome]) => ({ codigo, nome }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [osPendentesTodas, tiposFilter, contratosFilter, municipiosFilter, bairrosFilter, statusFilter, gruposFilter, territoriosFilter, reguladaFilter, coordenadasFilter, prazoInicio, prazoFim]);

  const municipiosDisponiveis = useMemo(() => {
    const municipios = new Set<string>();
    osPendentesTodas.forEach(os => {
      if (os.municipio && osPassaFiltros(os, 'municipio')) {
        municipios.add(os.municipio);
      }
    });
    return Array.from(municipios).sort();
  }, [osPendentesTodas, tiposFilter, contratosFilter, centrosCustoFilter, bairrosFilter, statusFilter, gruposFilter, territoriosFilter, reguladaFilter, coordenadasFilter, prazoInicio, prazoFim]);

  const bairrosDisponiveis = useMemo(() => {
    const bairros = new Set<string>();
    osPendentesTodas.forEach(os => {
      if (os.bairro && osPassaFiltros(os, 'bairro')) {
        bairros.add(os.bairro);
      }
    });
    return Array.from(bairros).sort();
  }, [osPendentesTodas, tiposFilter, contratosFilter, centrosCustoFilter, municipiosFilter, statusFilter, gruposFilter, territoriosFilter, reguladaFilter, coordenadasFilter, prazoInicio, prazoFim]);

  const statusDisponiveis = useMemo(() => {
    const statusSet = new Set<string>();
    osPendentesTodas.forEach(os => {
      if (os.status && osPassaFiltros(os, 'status')) {
        statusSet.add(os.status);
      }
    });
    return Array.from(statusSet).sort();
  }, [osPendentesTodas, tiposFilter, contratosFilter, centrosCustoFilter, municipiosFilter, bairrosFilter, gruposFilter, territoriosFilter, reguladaFilter, coordenadasFilter, prazoInicio, prazoFim]);

  // Inicializar e atualizar filtros de tipos de serviços com todos os tipos selecionados por padrão
  useEffect(() => {
    if (todosTiposDisponiveis.length > 0) {
      setFiltrosTiposServicos(prev => {
        const novosFiltros = new Map(prev);
        let atualizado = false;
        
        // Adicionar novos tipos que ainda não estão nos filtros
        todosTiposDisponiveis.forEach(tipo => {
          if (!novosFiltros.has(tipo)) {
            novosFiltros.set(tipo, {
              tipo,
              considerar: true,
              prazoLimite: "",
            });
            atualizado = true;
          }
        });
        
        // Remover tipos que não existem mais
        const tiposParaRemover: string[] = [];
        novosFiltros.forEach((_, tipo) => {
          if (!todosTiposDisponiveis.includes(tipo)) {
            tiposParaRemover.push(tipo);
          }
        });
        tiposParaRemover.forEach(tipo => {
          novosFiltros.delete(tipo);
          atualizado = true;
        });
        
        // Só atualizar se houver mudanças ou se estiver vazio
        if (atualizado || prev.size === 0) {
          return novosFiltros;
        }
        
        return prev;
      });
    }
  }, [todosTiposDisponiveis]);

  // Limpar filtros do Backlog
  const clearFiltersBacklog = () => {
    setSearchTerm("");
    setTiposFilter([]);
    setContratosFilter([]);
    setCentrosCustoFilter([]);
    setMunicipiosFilter([]);
    setBairrosFilter([]);
    setStatusFilter([]);
    setGruposFilter([]);
    setTerritoriosFilter([]);
    setPrazoInicio("");
    setPrazoFim("");
    setCoordenadasFilter("all");
    setReguladaFilter("all");
  };

  // Contar filtros ativos do Backlog
  const activeFiltersBacklogCount = [
    tiposFilter.length > 0,
    contratosFilter.length > 0,
    centrosCustoFilter.length > 0,
    municipiosFilter.length > 0,
    bairrosFilter.length > 0,
    statusFilter.length > 0,
    gruposFilter.length > 0,
    territoriosFilter.length > 0,
    prazoInicio !== "",
    prazoFim !== "",
    coordenadasFilter !== "all",
    reguladaFilter !== "all",
  ].filter(Boolean).length;

  // Usar osPendentesTodas para mostrar TODAS as OSs no Backlog (sem filtro de território)
  console.log("[Roteirização] ordensServico:", ordensServico.length, "osAlocadas:", osAlocadas.size, "osPendentesTodas:", osPendentesTodas.length, "loadingOrdens:", loadingOrdens);
  
  // Verificar se há pelo menos um filtro ativo - SE NÃO, retorna array vazio
  // Isso evita carregar todas as OSs de uma vez e travar a tela
  const hasAnyFilter = activeFiltersBacklogCount > 0 || searchTerm.trim() !== "";
  
  const filteredServicos = hasAnyFilter ? osPendentesTodas.filter((s) => {
    // Busca textual - inclui número, endereço, bairro e município
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      s.numero.toLowerCase().includes(searchLower) ||
      s.endereco.toLowerCase().includes(searchLower) ||
      (s.bairro && s.bairro.toLowerCase().includes(searchLower)) ||
      (s.municipio && s.municipio.toLowerCase().includes(searchLower));
    
    // Tipo de serviço - seleção múltipla
    const matchesTipo = tiposFilter.length === 0 || tiposFilter.some(tipo => s.tipo.toLowerCase() === tipo.toLowerCase());
    
    // Contrato - seleção múltipla
    const matchesContrato = contratosFilter.length === 0 || 
      (s.contrato_codigo && contratosFilter.includes(s.contrato_codigo));
    
    // Centro de Custo - seleção múltipla
    const matchesCentroCusto = centrosCustoFilter.length === 0 || 
      (s.centro_custo_codigo && centrosCustoFilter.includes(s.centro_custo_codigo));
    
    // Município - seleção múltipla
    const matchesMunicipio = municipiosFilter.length === 0 || 
      (s.municipio && municipiosFilter.includes(s.municipio));
    
    // Bairro - seleção múltipla
    const matchesBairro = bairrosFilter.length === 0 || 
      (s.bairro && bairrosFilter.includes(s.bairro));
    
    // Status - seleção múltipla
    const matchesStatus = statusFilter.length === 0 || 
      (s.status && statusFilter.includes(s.status));
    
    // Prazo - início (só filtra se tiver prazo definido na OS)
    let matchesPrazoInicio = true;
    if (prazoInicio && s.prazo) {
      const prazoOS = new Date(s.prazo);
      const prazoInicioDate = new Date(prazoInicio);
      matchesPrazoInicio = prazoOS >= prazoInicioDate;
    }
    
    // Prazo - fim (só filtra se tiver prazo definido na OS)
    let matchesPrazoFim = true;
    if (prazoFim && s.prazo) {
      const prazoOS = new Date(s.prazo);
      const prazoFimDate = new Date(prazoFim + "T23:59:59");
      matchesPrazoFim = prazoOS <= prazoFimDate;
    }
    
    // Coordenadas
    let matchesCoordenadas = true;
    if (coordenadasFilter === "com") {
      matchesCoordenadas = s.latitude !== 0 && s.longitude !== 0 && s.latitude !== null && s.longitude !== null;
    } else if (coordenadasFilter === "sem") {
      matchesCoordenadas = s.latitude === 0 || s.longitude === 0 || s.latitude === null || s.longitude === null;
    }
    
    // Regulada
    let matchesRegulada = true;
    if (reguladaFilter === "sim") {
      matchesRegulada = s.regulada === true;
    } else if (reguladaFilter === "nao") {
      matchesRegulada = s.regulada !== true;
    }
    
    // Grupo de Serviço - seleção múltipla
    const matchesGrupo = gruposFilter.length === 0 || gruposFilter.includes(obterGrupoServico(s.tipo));
    
    // Territórios - verifica se a OS está dentro dos territórios selecionados OU se o bairro está cadastrado
    let matchesTerritorio = true;
    if (territoriosFilter.length > 0) {
      const territoriosFiltrados = territorios.filter(t => territoriosFilter.includes(t.id));
      
      // Verificar se está DENTRO do polígono
      const dentroDoPoligono = territoriosFiltrados.some(t => 
        t.ativo && t.poligono.length >= 3 && 
        s.latitude !== null && s.longitude !== null &&
        pontoNoPoligono({ lat: s.latitude, lng: s.longitude }, t.poligono)
      );
      
      // Verificar se o BAIRRO da OS está cadastrado em algum dos territórios selecionados
      const bairroCadastrado = s.bairro ? territoriosFiltrados.some(t => 
        t.ativo && t.bairros && t.bairros.some(b => 
          b.toLowerCase().trim() === s.bairro?.toLowerCase().trim()
        )
      ) : false;
      
      matchesTerritorio = dentroDoPoligono || bairroCadastrado;
    }
    
    return matchesSearch && matchesTipo && matchesContrato && matchesCentroCusto && 
           matchesMunicipio && matchesBairro && matchesStatus && 
           matchesPrazoInicio && matchesPrazoFim && matchesCoordenadas && matchesRegulada &&
           matchesGrupo && matchesTerritorio;
  }) : []; // Retorna array vazio se nenhum filtro ativo

  // OSs sem coordenadas (aplicando os mesmos filtros do backlog, exceto coordenadas)
  // Ordenadas: reguladas primeiro, depois não reguladas
  const osSemCoordenadas = useMemo(() => {
    if (!hasAnyFilter) return []; // Não mostrar se não há filtros ativos
    
    // Filtrar OSs sem coordenadas válidas que passam nos demais filtros
    const semCoord = osPendentesTodas.filter(os => {
      // Deve ser sem coordenadas
      if (os.latitude !== null && os.longitude !== null) return false;
      
      // Aplicar os mesmos filtros do backlog (exceto coordenadas e territórios que dependem de coordenadas)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm.trim() === "" ||
        os.numero.toLowerCase().includes(searchLower) ||
        os.endereco.toLowerCase().includes(searchLower) ||
        (os.bairro && os.bairro.toLowerCase().includes(searchLower)) ||
        (os.municipio && os.municipio.toLowerCase().includes(searchLower));
      
      const matchesTipo = tiposFilter.length === 0 || tiposFilter.some(tipo => os.tipo.toLowerCase() === tipo.toLowerCase());
      const matchesContrato = contratosFilter.length === 0 || (os.contrato_codigo && contratosFilter.includes(os.contrato_codigo));
      const matchesCentroCusto = centrosCustoFilter.length === 0 || (os.centro_custo_codigo && centrosCustoFilter.includes(os.centro_custo_codigo));
      const matchesMunicipio = municipiosFilter.length === 0 || (os.municipio && municipiosFilter.includes(os.municipio));
      const matchesBairro = bairrosFilter.length === 0 || (os.bairro && bairrosFilter.includes(os.bairro));
      const matchesStatus = statusFilter.length === 0 || (os.status && statusFilter.includes(os.status));
      const matchesGrupo = gruposFilter.length === 0 || gruposFilter.includes(obterGrupoServico(os.tipo));
      
      let matchesPrazoInicio = true;
      if (prazoInicio && os.prazo) {
        const prazoOS = new Date(os.prazo);
        const prazoInicioDate = new Date(prazoInicio);
        matchesPrazoInicio = prazoOS >= prazoInicioDate;
      }
      
      let matchesPrazoFim = true;
      if (prazoFim && os.prazo) {
        const prazoOS = new Date(os.prazo);
        const prazoFimDate = new Date(prazoFim + "T23:59:59");
        matchesPrazoFim = prazoOS <= prazoFimDate;
      }
      
      let matchesRegulada = true;
      if (reguladaFilter === "sim") {
        matchesRegulada = os.regulada === true;
      } else if (reguladaFilter === "nao") {
        matchesRegulada = os.regulada !== true;
      }
      
      return matchesSearch && matchesTipo && matchesContrato && matchesCentroCusto && 
             matchesMunicipio && matchesBairro && matchesStatus && matchesGrupo &&
             matchesPrazoInicio && matchesPrazoFim && matchesRegulada;
    });
    
    // Ordenar: reguladas primeiro, depois por prazo (mais urgentes primeiro)
    return semCoord.sort((a, b) => {
      // Reguladas primeiro
      if (a.regulada && !b.regulada) return -1;
      if (!a.regulada && b.regulada) return 1;
      
      // Dentro do mesmo grupo, ordenar por prazo (mais urgentes primeiro)
      if (a.prazo && b.prazo) {
        return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
      }
      if (a.prazo && !b.prazo) return -1;
      if (!a.prazo && b.prazo) return 1;
      
      return 0;
    });
  }, [osPendentesTodas, hasAnyFilter, searchTerm, tiposFilter, contratosFilter, centrosCustoFilter, 
      municipiosFilter, bairrosFilter, statusFilter, gruposFilter, prazoInicio, prazoFim, reguladaFilter]);

  // OSs com coordenadas suspeitas (bairro pertence a um território mas coordenadas estão fora dele)
  const osCoordenadasSuspeitas = useMemo(() => {
    if (!hasAnyFilter) return []; // Não mostrar se não há filtros ativos
    
    // Filtrar apenas territórios ativos que têm bairros cadastrados
    const territoriosComBairros = territorios.filter(t => t.ativo && t.bairros && t.bairros.length > 0);
    
    if (territoriosComBairros.length === 0) return [];
    
    // Criar mapa de bairro -> território esperado
    const bairroParaTerritorio = new Map<string, Territorio>();
    territoriosComBairros.forEach(territorio => {
      territorio.bairros.forEach(bairro => {
        // Normalizar bairro para comparação case-insensitive
        bairroParaTerritorio.set(bairro.toLowerCase().trim(), territorio);
      });
    });
    
    // Filtrar OSs que têm coordenadas válidas
    const suspeitas = filteredServicos.filter(os => {
      if (os.latitude === null || os.longitude === null) return false;
      if (!os.bairro) return false;
      
      const bairroNormalizado = os.bairro.toLowerCase().trim();
      const territorioEsperado = bairroParaTerritorio.get(bairroNormalizado);
      
      if (!territorioEsperado) return false; // Bairro não está cadastrado em nenhum território
      
      // Verificar se as coordenadas estão DENTRO do território esperado
      const coordenadaNoTerritorio = territorioEsperado.poligono.length >= 3 && 
        pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, territorioEsperado.poligono);
      
      // Se NÃO está dentro do território esperado → suspeita!
      return !coordenadaNoTerritorio;
    });
    
    // Ordenar: reguladas primeiro, depois por prazo
    return suspeitas.sort((a, b) => {
      if (a.regulada && !b.regulada) return -1;
      if (!a.regulada && b.regulada) return 1;
      if (a.prazo && b.prazo) return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
      return 0;
    }).map(os => {
      // Adicionar informação do território esperado
      const bairroNormalizado = os.bairro?.toLowerCase().trim() || '';
      const territorioEsperado = bairroParaTerritorio.get(bairroNormalizado);
      
      // Verificar em qual território a coordenada realmente está
      let territorioReal: Territorio | null = null;
      if (os.latitude !== null && os.longitude !== null) {
        for (const t of territoriosComBairros) {
          if (t.poligono.length >= 3 && pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, t.poligono)) {
            territorioReal = t;
            break;
          }
        }
      }
      
      return {
        ...os,
        territorioEsperado: territorioEsperado?.nome || 'Desconhecido',
        territorioReal: territorioReal?.nome || 'Fora de territórios',
      };
    });
  }, [filteredServicos, territorios, hasAnyFilter]);

  // Função auxiliar para validar hora
  const validarHora = (hora: string | null): string | null => {
    if (!hora) return null;
    // Verificar formato HH:MM
    const match = hora.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) {
      console.warn(`Formato de hora inválido: ${hora}`);
      return null;
    }
    
    let horas = parseInt(match[1], 10);
    let minutos = parseInt(match[2], 10);
    
    // Se minutos >= 60, ajustar
    if (minutos >= 60) {
      horas += Math.floor(minutos / 60);
      minutos = minutos % 60;
    }
    
    // Garantir que horas não excedam 23 (formato TIME do PostgreSQL)
    if (horas >= 24) {
      horas = horas % 24;
    }
    
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
  };

  // Função para salvar planejamento
  const handleSalvarPlanejamento = async () => {
    if (!dataPlanejamento) {
      toast.error("Por favor, selecione uma data para o planejamento");
      return;
    }

    if (rotas.length === 0) {
      toast.error("Não há rotas para salvar");
      return;
    }

    setSalvandoPlanejamento(true);
    console.log("[PLANEJAMENTO] Iniciando salvamento...");

    try {
      // Obter usuário atual do localStorage (sistema usa sessão própria, não Supabase Auth)
      console.log("[PLANEJAMENTO] Obtendo usuário...");
      const STORAGE_KEY = "usuario_web_session";
      const sessionStr = localStorage.getItem(STORAGE_KEY);
      if (!sessionStr) {
        throw new Error("Usuário não autenticado");
      }
      const session = JSON.parse(sessionStr);
      const user = { id: session.id };
      if (!user.id) {
        throw new Error("Usuário não autenticado");
      }
      console.log("[PLANEJAMENTO] Usuário encontrado:", user.id);

      // Calcular totais
      console.log("[PLANEJAMENTO] Calculando totais...");
      const totalEquipes = rotas.length;
      const totalOrdens = rotas.reduce((acc, rota) => 
        acc + rota.servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico).length, 0
      );
      const distanciaTotal = rotas.reduce((acc, rota) => acc + rota.distanciaTotal, 0);
      const tempoTotal = rotas.reduce((acc, rota) => acc + rota.tempoTotal, 0);
      const faturamentoTotal = rotas.reduce((acc, rota) => acc + rota.faturamentoTotal, 0);

      console.log("[PLANEJAMENTO] Totais:", { totalEquipes, totalOrdens, distanciaTotal, tempoTotal, faturamentoTotal });

      // Criar planejamento
      // CORREÇÃO: Ajustar data para evitar problemas de timezone
      // Converter data de YYYY-MM-DD para Date e depois formatar corretamente
      const dataPlanejamentoDate = new Date(dataPlanejamento + 'T12:00:00'); // Usar meio-dia para evitar problemas de timezone
      const dataPlanejamentoFormatada = dataPlanejamentoDate.toISOString().split('T')[0];
      
      console.log("[PLANEJAMENTO] Criando registro de planejamento...");
      console.log("[PLANEJAMENTO] Data original:", dataPlanejamento);
      console.log("[PLANEJAMENTO] Data formatada:", dataPlanejamentoFormatada);
      
      const { data: planejamento, error: erroPlanejamento } = await supabase
        .from("planejamentos")
        .insert({
          data_planejamento: dataPlanejamentoFormatada, // Usar data formatada
          status: "aberto",
          total_equipes: totalEquipes,
          total_ordens: totalOrdens,
          distancia_total_km: Number(distanciaTotal.toFixed(2)),
          tempo_total_minutos: Math.round(tempoTotal),
          faturamento_total: Number(faturamentoTotal.toFixed(2)),
          created_by: user.id,
        })
        .select()
        .single();

      if (erroPlanejamento) {
        console.error("[PLANEJAMENTO] Erro ao criar planejamento:", erroPlanejamento);
        throw erroPlanejamento;
      }
      if (!planejamento) {
        throw new Error("Erro ao criar planejamento");
      }

      console.log("[PLANEJAMENTO] Planejamento criado:", planejamento.id);

      // Criar log de criação (não bloquear se falhar)
      try {
        await supabase.from("planejamento_logs").insert({
          planejamento_id: planejamento.id,
          acao: "criado",
          descricao: `Planejamento criado para ${new Date(dataPlanejamento).toLocaleDateString('pt-BR')}`,
          dados_novos: {
            total_equipes: totalEquipes,
            total_ordens: totalOrdens,
            distancia_total_km: distanciaTotal,
          },
          created_by: user.id,
        });
      } catch (logError) {
        console.warn("[PLANEJAMENTO] Erro ao criar log (não crítico):", logError);
      }

      // Processar cada rota e preparar dados
      console.log("[PLANEJAMENTO] Processando rotas e preparando dados...");
      const planejamentoOrdens: any[] = [];
      const osUpdates: Map<string, { equipe_id: string; data_planejada: string }> = new Map();
      const logsParaInserir: any[] = [];

      for (const rota of rotas) {
        let ordemNaRota = 1;
        
        for (const servico of rota.servicos) {
          if (servico.tipo === 'SERVICO' && servico.ordemServico) {
            const os = servico.ordemServico;
            
            // Preparar dados para planejamento_ordens
            planejamentoOrdens.push({
              planejamento_id: planejamento.id,
              ordem_servico_id: os.id,
              equipe_id: rota.equipe.id,
              ordem_na_rota: ordemNaRota,
              distancia_km: Number((servico.distancia || 0).toFixed(2)),
              tempo_estimado_minutos: Math.round(servico.tempoTotal || 0),
              hora_inicio_estimada: validarHora(servico.horaInicio),
              hora_fim_estimada: validarHora(servico.horaFim),
            });

            // Preparar atualização de OS
            osUpdates.set(os.id, {
              equipe_id: rota.equipe.id,
              data_planejada: dataPlanejamento,
            });

            // Preparar log
            logsParaInserir.push({
              planejamento_id: planejamento.id,
              ordem_servico_id: os.id,
              acao: "ordem_adicionada",
              descricao: `OS ${os.numero} adicionada ao planejamento`,
              dados_novos: {
                equipe_id: rota.equipe.id,
                data_planejamento: dataPlanejamento,
              },
              created_by: user.id,
            });

            ordemNaRota++;
          }
        }
      }

      console.log("[PLANEJAMENTO] Dados preparados:", {
        planejamentoOrdens: planejamentoOrdens.length,
        osUpdates: osUpdates.size,
        logs: logsParaInserir.length,
      });

      // Inserir relacionamentos planejamento_ordens em batch
      if (planejamentoOrdens.length > 0) {
        console.log("[PLANEJAMENTO] Inserindo relacionamentos planejamento_ordens...");
        const { error: erroRelacionamentos } = await supabase
          .from("planejamento_ordens")
          .insert(planejamentoOrdens);

        if (erroRelacionamentos) {
          console.error("[PLANEJAMENTO] Erro ao inserir relacionamentos:", erroRelacionamentos);
          throw erroRelacionamentos;
        }
        console.log("[PLANEJAMENTO] Relacionamentos inseridos com sucesso");
      }

      // Atualizar OSs em batch
      if (osUpdates.size > 0) {
        console.log("[PLANEJAMENTO] Atualizando OSs...");
        const osIds = Array.from(osUpdates.keys());
        
        // Atualizar todas as OSs de uma vez
        for (const osId of osIds) {
          const update = osUpdates.get(osId);
          if (update) {
            const { error: erroUpdate } = await supabase
              .from("ordens_servico")
              .update({
                status: "planejada",
                equipe_planejada_id: update.equipe_id,
                data_planejada: update.data_planejada,
              })
              .eq("id", osId);

            if (erroUpdate) {
              console.error(`[PLANEJAMENTO] Erro ao atualizar OS ${osId}:`, erroUpdate);
            }
          }
        }
        console.log("[PLANEJAMENTO] OSs atualizadas");
      }

      // Inserir logs em batch (não bloquear se falhar)
      if (logsParaInserir.length > 0) {
        try {
          console.log("[PLANEJAMENTO] Inserindo logs...");
          await supabase.from("planejamento_logs").insert(logsParaInserir);
          console.log("[PLANEJAMENTO] Logs inseridos");
        } catch (logError) {
          console.warn("[PLANEJAMENTO] Erro ao inserir logs (não crítico):", logError);
        }
      }

      console.log("[PLANEJAMENTO] Salvamento concluído com sucesso!");
      // Corrigir timezone na exibição
      const dataExibicao = new Date(dataPlanejamentoFormatada + 'T12:00:00');
      toast.success(`Planejamento salvo com sucesso! ${totalOrdens} OSs planejadas para ${dataExibicao.toLocaleDateString('pt-BR')}`);
      
      // Fechar dialog e limpar
      setConfirmarPlanejamentoDialogOpen(false);
      setDataPlanejamento("");
      
      // Recarregar OSs para refletir mudanças (apenas pendentes, não planejadas)
      // Usar paginação para carregar todas as OSs
      console.log("[PLANEJAMENTO] Recarregando OSs com paginação...");
      const PAGE_SIZE = 1000;
      let allOSs: Tables<"ordens_servico">[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data: dataOSs } = await supabase
          .from("ordens_servico")
          .select("*")
          .in("status", ["pendente", "atrasada"])
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        
        if (dataOSs && dataOSs.length > 0) {
          allOSs = [...allOSs, ...dataOSs];
          offset += PAGE_SIZE;
          if (dataOSs.length < PAGE_SIZE) hasMore = false;
        } else {
          hasMore = false;
        }
        if (allOSs.length >= 100000) hasMore = false;
      }
      
      console.log(`[PLANEJAMENTO] Recarregadas ${allOSs.length} OSs`);
      const ordensConvertidas = await mapSupabaseOrdensServicoToOrdemServico(allOSs);
      setOrdensServico(ordensConvertidas);

    } catch (error: any) {
      console.error("[PLANEJAMENTO] Erro ao salvar planejamento:", error);
      const errorMessage = error.message || error.toString() || "Erro desconhecido";
      const errorDetails = error.details || error.hint || "";
      const fullError = errorDetails ? `${errorMessage}\n\nDetalhes: ${errorDetails}` : errorMessage;
      
      toast.error("Erro ao salvar planejamento", {
        description: fullError,
        duration: 30000,
        action: {
          label: "Copiar Erro",
          onClick: () => {
            navigator.clipboard.writeText(`Erro ao salvar planejamento:\n${fullError}\n\nStack: ${error.stack || "N/A"}`);
            toast.success("Erro copiado para a área de transferência!");
          },
        },
      });
    } finally {
      console.log("[PLANEJAMENTO] Finalizando (finally)...");
      setSalvandoPlanejamento(false);
    }
  };

  // Função para consultar planejamentos
  const handleConsultarPlanejamentos = useCallback(async () => {
    setCarregandoPlanejamentos(true);
    try {
      let query = supabase
        .from("planejamentos")
        .select(`
          *,
          planejamento_ordens (
            ordem_servico_id,
            equipe_id,
            ordem_na_rota,
            tecnicos:equipe_id (codigo, nome)
          )
        `)
        .eq("status", "aberto")
        .order("data_planejamento", { ascending: false });

      if (filtroDataConsulta) {
        query = query.eq("data_planejamento", filtroDataConsulta);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtrar por equipe se necessário
      let planejamentosFiltrados = (data || []) as any[];
      
      if (filtroEquipeConsulta !== "all") {
        planejamentosFiltrados = planejamentosFiltrados.filter(p => {
          const ordens = p.planejamento_ordens || [];
          return ordens.some((po: any) => po.equipe_id === filtroEquipeConsulta);
        });
      }

      setPlanejamentosEncontrados(planejamentosFiltrados);
    } catch (error: any) {
      console.error("Erro ao consultar planejamentos:", error);
      const errorMessage = error.message || error.toString() || "Erro desconhecido";
      toast.error("Erro ao consultar planejamentos", {
        description: errorMessage,
        duration: 30000,
      });
    } finally {
      setCarregandoPlanejamentos(false);
    }
  }, [filtroDataConsulta, filtroEquipeConsulta, equipes]);

  // Carregar planejamentos quando o dialog abrir
  useEffect(() => {
    if (consultarPlanejamentosDialogOpen) {
      handleConsultarPlanejamentos();
    }
  }, [consultarPlanejamentosDialogOpen, handleConsultarPlanejamentos]);

  // Função para cancelar planejamento
  const handleCancelarPlanejamento = async (planejamentoId: string) => {
    if (!confirm("Tem certeza que deseja cancelar este planejamento? As OSs voltarão para o status 'pendente'.")) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar ordens do planejamento
      const { data: ordensPlanejamento } = await supabase
        .from("planejamento_ordens")
        .select("ordem_servico_id")
        .eq("planejamento_id", planejamentoId);

      // Atualizar status do planejamento
      const { error: erroUpdate } = await supabase
        .from("planejamentos")
        .update({
          status: "cancelado",
          canceled_at: new Date().toISOString(),
          canceled_by: user.id,
        })
        .eq("id", planejamentoId);

      if (erroUpdate) throw erroUpdate;

      // Reverter status das OSs para "pendente"
      if (ordensPlanejamento && ordensPlanejamento.length > 0) {
        const osIds = ordensPlanejamento.map(po => po.ordem_servico_id);
        
        const { error: erroOSs } = await supabase
          .from("ordens_servico")
          .update({
            status: "pendente",
            equipe_planejada_id: null,
            data_planejada: null,
          })
          .in("id", osIds);

        if (erroOSs) throw erroOSs;
      }

      // Criar log
      await supabase.from("planejamento_logs").insert({
        planejamento_id: planejamentoId,
        acao: "cancelado",
        descricao: "Planejamento cancelado",
        created_by: user.id,
      });

      toast.success("Planejamento cancelado com sucesso");
      
      // Recarregar planejamentos
      handleConsultarPlanejamentos();
      
      // Recarregar OSs (apenas pendentes, não planejadas) - com paginação
      console.log("[CANCELAR] Recarregando OSs com paginação...");
      const PAGE_SIZE = 1000;
      let allOSs: Tables<"ordens_servico">[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data: dataOSs } = await supabase
          .from("ordens_servico")
          .select("*")
          .in("status", ["pendente", "atrasada"])
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        
        if (dataOSs && dataOSs.length > 0) {
          allOSs = [...allOSs, ...dataOSs];
          offset += PAGE_SIZE;
          if (dataOSs.length < PAGE_SIZE) hasMore = false;
        } else {
          hasMore = false;
        }
        if (allOSs.length >= 100000) hasMore = false;
      }
      
      console.log(`[CANCELAR] Recarregadas ${allOSs.length} OSs`);
      const ordensConvertidas = await mapSupabaseOrdensServicoToOrdemServico(allOSs);
      setOrdensServico(ordensConvertidas);
    } catch (error: any) {
      console.error("Erro ao cancelar planejamento:", error);
      const errorMessage = error.message || error.toString() || "Erro desconhecido";
      toast.error("Erro ao cancelar planejamento", {
        description: errorMessage,
        duration: 30000,
      });
    }
  };

  const handleOtimizarRotas = async () => {
    setIsOtimizando(true);
    
    try {
      if (equipesAtivas.length === 0) {
        alert("Selecione ao menos uma equipe para otimizar.");
        return;
      }

      // Usar OSs filtradas do backlog (respeitando todos os filtros ativos)
      // Se não houver filtros, filteredServicos será vazio
      const osParaRoteirizar = hasAnyFilter ? filteredServicos : osPendentes;
      
      if (osParaRoteirizar.length === 0) {
        toast.warning("Nenhuma OS disponível para roteirização. Aplique filtros ou verifique os dados.");
        setIsOtimizando(false);
        return;
      }

      console.log(`[ROTEIRIZAÇÃO] Iniciando otimização com ${osParaRoteirizar.length} OSs filtradas...`);
      
      // Verificar se há parâmetros customizados (diferentes dos padrão)
      const parametrosCustomizados: Partial<ParametrosRoteirizacao> = {};
      Object.keys(parametros).forEach((key) => {
        const k = key as keyof ParametrosRoteirizacao;
        if (parametros[k] !== PARAMETROS_PADRAO[k]) {
          (parametrosCustomizados as any)[k] = parametros[k];
        }
      });
      
      const resultado: ResultadoOtimizacao = await otimizarRotas(
        osParaRoteirizar, 
        equipesAtivas, 
        usarTerritorios,
        usarTerritorios ? territoriosSelecionados : undefined,
        undefined, // estrategia
        Object.keys(parametrosCustomizados).length > 0 ? parametrosCustomizados : undefined
      );

      // V20: Se há múltiplas opções de roteiros, mostrar dialog de seleção
      if (resultado.opcoesRoteiros && resultado.opcoesRoteiros.length > 0) {
        setOpcoesRoteiros(resultado.opcoesRoteiros);
        setMostrarOpcoesDialog(true);
        // Por padrão, selecionar a primeira opção para todos os territórios
        const opcaoPadrao = resultado.opcoesRoteiros[0].id;
        setOpcaoRoteiroSelecionada(opcaoPadrao);
        
        // Inicializar seleção individual: todos os territórios com a primeira opção
        const selecaoInicial = new Map<string, string>();
        territoriosSelecionados.forEach(territorioId => {
          selecaoInicial.set(territorioId, opcaoPadrao);
        });
        setSelecaoIndividualTerritorios(selecaoInicial);
        
        setRotas(resultado.opcoesRoteiros[0].rotas);
        const mapaNaoAlocadas = resultado.opcoesRoteiros[0].naoAlocadas.reduce((acc, item) => {
          acc[item.os.id] = item.motivo;
          return acc;
        }, {} as Record<string, string>);
        setNaoAlocadas(mapaNaoAlocadas);
      } else {
      // Mapear motivos de não alocação
      const mapaNaoAlocadas = resultado.naoAlocadas.reduce((acc, item) => {
        acc[item.os.id] = item.motivo;
        return acc;
      }, {} as Record<string, string>);

      // Usar as rotas diretamente (já contêm todas as informações necessárias)
      setRotas(resultado.rotas);
      setNaoAlocadas(mapaNaoAlocadas);
      }
      // Verificar se há OSs não alocadas e mostrar resumo
      const totalNaoAlocadas = Object.keys(naoAlocadas).length;
      if (totalNaoAlocadas > 0) {
        // Agrupar erros por motivo
        const errosPorMotivo = resultado.naoAlocadas?.reduce((acc, item) => {
          const motivo = item.motivo;
          if (!acc[motivo]) acc[motivo] = 0;
          acc[motivo]++;
          return acc;
        }, {} as Record<string, number>) || {};
        
        const resumoErros = Object.entries(errosPorMotivo)
          .map(([motivo, count]) => `${count} OSs: ${motivo}`)
          .join('\n');
        
        toast.warning(`${totalNaoAlocadas} OSs não puderam ser roteirizadas`, {
          description: resumoErros.substring(0, 200) + (resumoErros.length > 200 ? '...' : ''),
          duration: 8000,
        });
      }
      
      console.log('[ROTEIRIZAÇÃO] Otimização concluída');
    } catch (error: any) {
      console.error("Erro ao otimizar rotas:", error);
      
      const mensagemErro = error?.message || 'Erro desconhecido';
      
      // Verificar se é erro de skills
      if (mensagemErro.includes('skill') || mensagemErro.includes('Skill')) {
        toast.error("Erro de Skills na Roteirização", {
          description: mensagemErro,
          duration: 10000,
        });
      } else {
        toast.error("Erro na Roteirização", {
          description: mensagemErro.substring(0, 150),
          duration: 8000,
        });
      }
      
      // Em caso de erro, a função otimizarRotas já faz fallback para Haversine
      // Mas vamos tentar novamente para garantir
      try {
        const osParaFallback = hasAnyFilter ? filteredServicos : osPendentes;
        const resultadoFallback = await otimizarRotas(osParaFallback, equipesAtivas, usarTerritorios);
        setRotas(resultadoFallback.rotas);
        const mapaNaoAlocadas = resultadoFallback.naoAlocadas.reduce((acc, item) => {
          acc[item.os.id] = item.motivo;
          return acc;
        }, {} as Record<string, string>);
        setNaoAlocadas(mapaNaoAlocadas);
        
        if (resultadoFallback.naoAlocadas.length > 0) {
          toast.info(`Roteirização com fallback: ${resultadoFallback.rotas.reduce((sum, r) => sum + r.servicos.filter(s => s.tipo === 'SERVICO').length, 0)} OSs alocadas, ${resultadoFallback.naoAlocadas.length} não alocadas`);
        }
      } catch (fallbackError) {
        console.error("Erro no fallback:", fallbackError);
        toast.error("Falha total na roteirização. Verifique os logs do console.");
      }
    } finally {
      setIsOtimizando(false);
    }
  };

  // Handler para drag-and-drop
  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    // Se não há destino, cancelar
    if (!destination) return;

    // Se soltou no mesmo lugar, não fazer nada
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Encontrar a OS sendo arrastada
    let osMovida: OrdemServico | null = null;
    let servicoMovido: RotaServico | null = null;

    // Se veio do backlog
    if (source.droppableId === "backlog") {
      osMovida = osPendentes[source.index];
    } else if (source.droppableId.startsWith("equipe-")) {
      // Se veio de uma equipe
      const equipeIdOrigem = source.droppableId.replace("equipe-", "");
      const rotaOrigem = rotas.find((r) => r.equipe.id === equipeIdOrigem);
      if (rotaOrigem) {
        servicoMovido = rotaOrigem.servicos[source.index];
        osMovida = servicoMovido.ordemServico;
      }
    }

    if (!osMovida) return;

    // Criar cópia profunda das rotas para garantir novas referências
    const novasRotas = rotas.map((rota) => ({
      ...rota,
      servicos: [...rota.servicos], // Nova referência do array
    }));

    // CASO 1: Reordenação dentro da mesma equipe
    if (
      source.droppableId.startsWith("equipe-") &&
      destination.droppableId.startsWith("equipe-") &&
      source.droppableId === destination.droppableId
    ) {
      const equipeId = source.droppableId.replace("equipe-", "");
      const rota = novasRotas.find((r) => r.equipe.id === equipeId);
      
      if (rota && servicoMovido) {
        // Criar lista de serviços com almoço para mapear índices corretamente
        const servicosComAlmoco = rota.servicos.filter(s => (s.tipo === 'SERVICO' && s.ordemServico) || s.tipo === 'ALMOCO');
        
        // Encontrar o serviço que está sendo movido na lista completa
        const servicoOrigem = servicosComAlmoco[source.index];
        if (!servicoOrigem) return;
        
        // Encontrar o índice real no array completo de serviços
        const indiceRealOrigem = rota.servicos.findIndex(s => {
          if (servicoOrigem.tipo === 'ALMOCO') {
            return s.tipo === 'ALMOCO' && s.horaInicio === servicoOrigem.horaInicio;
          }
          return s.tipo === 'SERVICO' && s.ordemServico?.id === servicoOrigem.ordemServico?.id;
        });
        
        // Encontrar o índice de destino no array completo
        // CORREÇÃO: O destination.index do react-beautiful-dnd já considera a posição linear no array,
        // então precisamos mapear corretamente para o array completo de serviços
        let indiceRealDestino: number;
        if (destination.index >= servicosComAlmoco.length) {
          // Se o destino está além do array, colocar no final
          indiceRealDestino = rota.servicos.length;
        } else {
          // Encontrar o serviço que está na posição de destino
          const servicoDestino = servicosComAlmoco[destination.index];
          if (!servicoDestino) return;
          
          // Encontrar o índice real deste serviço no array completo
          indiceRealDestino = rota.servicos.findIndex(s => {
            if (servicoDestino.tipo === 'ALMOCO') {
              return s.tipo === 'ALMOCO' && s.horaInicio === servicoDestino.horaInicio;
            }
            return s.tipo === 'SERVICO' && s.ordemServico?.id === servicoDestino.ordemServico?.id;
          });
          
          // Se não encontrou, tentar encontrar pela posição relativa
          if (indiceRealDestino === -1) {
            // Contar quantos serviços válidos existem antes do índice de destino
            let contador = 0;
            for (let i = 0; i < destination.index && i < servicosComAlmoco.length; i++) {
              const servico = servicosComAlmoco[i];
              if (servico.tipo === 'SERVICO' || servico.tipo === 'ALMOCO') {
                contador++;
              }
            }
            // Encontrar a posição correspondente no array completo
            let encontrados = 0;
            for (let i = 0; i < rota.servicos.length; i++) {
              const servico = rota.servicos[i];
              if ((servico.tipo === 'SERVICO' && servico.ordemServico) || servico.tipo === 'ALMOCO') {
                if (encontrados === contador) {
                  indiceRealDestino = i;
                  break;
                }
                encontrados++;
              }
            }
            // Se ainda não encontrou, colocar no final
            if (indiceRealDestino === -1) {
              indiceRealDestino = rota.servicos.length;
            }
          }
        }
        
        if (indiceRealOrigem === -1 || indiceRealDestino === -1) return;
        
        // Criar novo array com a ordem correta
        const novosServicos = [...rota.servicos];
        const [removido] = novosServicos.splice(indiceRealOrigem, 1);
        
        // Ajustar índice de destino se necessário
        // Se estamos movendo para frente (índice atual < destino), 
        // o destino diminui em 1 porque removemos um elemento antes dele
        const indiceDestinoAjustado = indiceRealOrigem < indiceRealDestino 
          ? indiceRealDestino - 1 
          : indiceRealDestino;
        
        novosServicos.splice(indiceDestinoAjustado, 0, removido);
        
        // Criar nova rota com novo array de serviços
        const rotaAtualizada = {
          ...rota,
          servicos: novosServicos,
        };
        
        // Recalcular a rota
        const resultado = recalcularRota(rotaAtualizada);
        const index = novasRotas.findIndex((r) => r.equipe.id === equipeId);
        novasRotas[index] = resultado.rota;
      }
    }
    // CASO 2: Mover de backlog para equipe
    else if (source.droppableId === "backlog" && destination.droppableId.startsWith("equipe-")) {
      const equipeId = destination.droppableId.replace("equipe-", "");
      const rota = novasRotas.find((r) => r.equipe.id === equipeId);
      
      if (!rota) return;

      // Verificar se a equipe tem a skill necessária
      const equipe = equipes.find((e) => e.id === equipeId);
      if (equipe && !(equipe.skills || equipe.habilidades).includes(osMovida.tipo)) {
        alert(`A equipe ${equipe.codigo} não possui a habilidade necessária para ${osMovida.tipo}`);
        return;
      }

      // Criar novo serviço
      const novoServico: RotaServico = {
        tipo: "SERVICO",
        ordemServico: osMovida,
        ordemNaRota: destination.index + 1,
        tempoDeslocamento: 0,
        distancia: 0,
        tempoTotal: 0,
        horaInicio: "",
        horaFim: "",
        eta: "",
      };
      
      // Criar novo array com o serviço inserido
      const novosServicos = [...rota.servicos];
      novosServicos.splice(destination.index, 0, novoServico);
      
      const rotaAtualizada = {
        ...rota,
        servicos: novosServicos,
      };
      
      // Recalcular a rota
      const resultado = recalcularRota(rotaAtualizada);
      const index = novasRotas.findIndex((r) => r.equipe.id === equipeId);
      novasRotas[index] = resultado.rota;
    }
    // CASO 3: Mover de uma equipe para outra equipe
    else if (
      source.droppableId.startsWith("equipe-") &&
      destination.droppableId.startsWith("equipe-") &&
      source.droppableId !== destination.droppableId
    ) {
      const equipeIdOrigem = source.droppableId.replace("equipe-", "");
      const equipeIdDestino = destination.droppableId.replace("equipe-", "");
      
      const rotaOrigem = novasRotas.find((r) => r.equipe.id === equipeIdOrigem);
      const rotaDestino = novasRotas.find((r) => r.equipe.id === equipeIdDestino);
      
      if (!rotaOrigem || !rotaDestino || !servicoMovido) return;

      // Verificar se a equipe destino tem a skill necessária
      const equipe = equipes.find((e) => e.id === equipeIdDestino);
      if (equipe && !(equipe.skills || equipe.habilidades).includes(osMovida.tipo)) {
        alert(`A equipe ${equipe.codigo} não possui a habilidade necessária para ${osMovida.tipo}`);
        return;
      }

      // Remover da origem (criar novo array)
      const novosServicosOrigem = [...rotaOrigem.servicos];
      novosServicosOrigem.splice(source.index, 1);
      
      const rotaOrigemAtualizada = {
        ...rotaOrigem,
        servicos: novosServicosOrigem,
      };
      
      // Recalcular rota de origem
      const rotaOrigemRecalculada = recalcularRota(rotaOrigemAtualizada);
      const indexOrigem = novasRotas.findIndex((r) => r.equipe.id === equipeIdOrigem);
      novasRotas[indexOrigem] = rotaOrigemRecalculada;

      // Adicionar no destino (criar novo array)
      const novoServico: RotaServico = {
        tipo: "SERVICO",
        ordemServico: osMovida,
        ordemNaRota: destination.index + 1,
        tempoDeslocamento: 0,
        distancia: 0,
        tempoTotal: 0,
        horaInicio: "",
        horaFim: "",
        eta: "",
      };
      
      const novosServicosDestino = [...rotaDestino.servicos];
      novosServicosDestino.splice(destination.index, 0, novoServico);
      
      const rotaDestinoAtualizada = {
        ...rotaDestino,
        servicos: novosServicosDestino,
      };
      
      // Recalcular rota de destino
      const resultadoDestino = recalcularRota(rotaDestinoAtualizada);
      const indexDestino = novasRotas.findIndex((r) => r.equipe.id === equipeIdDestino);
      novasRotas[indexDestino] = resultadoDestino.rota;
    }
    // CASO 4: Mover de equipe para backlog
    else if (source.droppableId.startsWith("equipe-") && destination.droppableId === "backlog") {
      const equipeIdOrigem = source.droppableId.replace("equipe-", "");
      const rotaOrigem = novasRotas.find((r) => r.equipe.id === equipeIdOrigem);
      
      if (!rotaOrigem) return;

      // Remover da origem (criar novo array)
      const novosServicos = [...rotaOrigem.servicos];
      novosServicos.splice(source.index, 1);
      
      const rotaAtualizada = {
        ...rotaOrigem,
        servicos: novosServicos,
      };
      
      // Recalcular a rota
      const resultado = recalcularRota(rotaAtualizada);
      const index = novasRotas.findIndex((r) => r.equipe.id === equipeIdOrigem);
      novasRotas[index] = resultado.rota;
    }

    // Atualizar estado com novas referências
    setRotas(novasRotas);
  };

  // Calcular estatísticas
  const totalAlocados = rotas.reduce((acc, rota) => acc + rota.servicos.length, 0);
  const totalServicos = ordensServico.length;
  const totalReguladas = ordensServico.filter((os) => os.regulada).length;
  const totalReguladasAlocadas = rotas.reduce(
    (acc, rota) =>
      acc + rota.servicos.filter((s) => s.tipo === "SERVICO" && s.ordemServico && s.ordemServico.regulada).length,
    0
  );
  const totalKm = rotas.reduce((acc, rota) => acc + rota.distanciaTotal, 0);

  // Função auxiliar para verificar se está fora do prazo
  const estaForaDoPrazo = (os: OrdemServico, horaFim: string): boolean => {
    if (!os.prazo) return false;
    
    // Converter horaFim para minutos desde meia-noite
    const [horaFimH, horaFimM] = horaFim.split(":").map(Number);
    const fimMinutos = horaFimH * 60 + horaFimM;
    
    // Converter prazo para minutos desde meia-noite
    const prazoDate = new Date(os.prazo);
    const prazoMinutos = prazoDate.getHours() * 60 + prazoDate.getMinutes();
    
    // Verificar se está no mesmo dia
    const hoje = new Date();
    const prazoDia = new Date(prazoDate.getFullYear(), prazoDate.getMonth(), prazoDate.getDate());
    const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    
    // Se o prazo é para hoje e termina após o horário do prazo, está fora
    if (prazoDia.getTime() === hojeDia.getTime()) {
      return fimMinutos > prazoMinutos;
    }
    
    // Se o prazo é passado e ainda não foi atendida hoje, está fora
    if (prazoDia.getTime() < hojeDia.getTime()) {
      return true;
    }
    
    return false;
  };

  // Função auxiliar para encontrar todos os territórios onde uma OS está
  const encontrarTerritoriosOS = (os: OrdemServico): string[] => {
    const territoriosEncontrados: string[] = [];
    const territoriosAtivos = territorios.filter(t => t.ativo && t.poligono.length >= 3);
    
    for (const territorio of territoriosAtivos) {
      if (pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, territorio.poligono)) {
        territoriosEncontrados.push(territorio.nome);
      }
    }
    
    return territoriosEncontrados;
  };

  // Função auxiliar para calcular prioridade baseada no prazo
  const calcularPrioridadeExportacao = (os: OrdemServico): "URGENTE" | "ALTA" | "NORMAL" => {
    if (!os.prazo) {
      return os.prioridade === "ALTA" ? "ALTA" : "NORMAL";
    }

    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const fimDoDia = new Date(hoje);
    fimDoDia.setHours(23, 59, 59, 999);
    
    const prazoDate = new Date(os.prazo);
    
    // Se o prazo já passou (vencida)
    if (prazoDate < agora) {
      return "URGENTE";
    }
    
    // Se o prazo vence até o final do dia de hoje
    if (prazoDate <= fimDoDia) {
      return "URGENTE";
    }
    
    // Se tem prazo mas é futuro, usar a prioridade original
    return os.prioridade === "ALTA" ? "ALTA" : "NORMAL";
  };

  // Função auxiliar para normalizar tipo para código da skill
  const tipoParaSkillCodigo = (tipo: string): string => {
    const tipoLower = tipo.toLowerCase().trim();
    const mapeamento: Record<string, string> = {
      'corte': 'CORTE',
      'religa': 'RELIGA',
      'inspecao': 'INSPECAO',
      'inspeção': 'INSPECAO',
      'ligacao': 'LIGACAO',
      'ligação': 'LIGACAO',
      'manutencao': 'MANUTENCAO',
      'manutenção': 'MANUTENCAO',
      'troca_medidor': 'TROCA_MEDIDOR',
    };
    
    if (mapeamento[tipoLower]) {
      return mapeamento[tipoLower];
    }
    
    return tipo.toUpperCase()
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÕÖ]/g, 'O')
      .replace(/[ÙÚÛÜ]/g, 'U')
      .replace(/[Ç]/g, 'C')
      .trim();
  };

  // Função para abrir edição de coordenadas
  const handleAbrirEditarCoords = (os: OrdemServico) => {
    setEditarCoordsOS(os);
    setEditarCoordsLat(os.latitude !== null ? String(os.latitude) : "");
    setEditarCoordsLng(os.longitude !== null ? String(os.longitude) : "");
    setEditarCoordsOpen(true);
  };

  // Função para salvar coordenadas editadas
  const handleSalvarCoords = async () => {
    if (!editarCoordsOS) return;
    
    setSalvandoCoords(true);
    try {
      const lat = editarCoordsLat.trim() ? parseFloat(editarCoordsLat.replace(',', '.')) : null;
      const lng = editarCoordsLng.trim() ? parseFloat(editarCoordsLng.replace(',', '.')) : null;
      
      // Validar coordenadas se fornecidas
      if (lat !== null && (isNaN(lat) || lat < -35 || lat > 5)) {
        toast.error("Latitude inválida. Deve estar entre -35 e 5.");
        setSalvandoCoords(false);
        return;
      }
      if (lng !== null && (isNaN(lng) || lng < -75 || lng > -32)) {
        toast.error("Longitude inválida. Deve estar entre -75 e -32.");
        setSalvandoCoords(false);
        return;
      }
      
      const { error } = await supabase
        .from("ordens_servico")
        .update({ latitude: lat, longitude: lng })
        .eq("id", editarCoordsOS.id);
      
      if (error) throw error;
      
      // Atualizar estado local
      setOrdensServico(prev => prev.map(os => 
        os.id === editarCoordsOS.id 
          ? { ...os, latitude: lat, longitude: lng }
          : os
      ));
      
      toast.success("Coordenadas atualizadas com sucesso!");
      setEditarCoordsOpen(false);
      setEditarCoordsOS(null);
    } catch (error) {
      console.error("Erro ao salvar coordenadas:", error);
      toast.error("Erro ao salvar coordenadas");
    } finally {
      setSalvandoCoords(false);
    }
  };

  // Função para salvar novo território criado no mapa
  const handleSalvarNovoTerritorio = async () => {
    if (!novoPoligono || novoPoligono.length < 3) {
      toast.error("Polígono inválido");
      return;
    }
    
    if (!novoTerritorioNome.trim()) {
      toast.error("Informe o nome do território");
      return;
    }
    
    setSalvandoTerritorio(true);
    try {
      const novoTerritorio: Territorio = {
        id: `territorio-${Date.now()}`,
        nome: novoTerritorioNome.trim(),
        cor: novoTerritorioCor,
        poligono: novoPoligono,
        equipeIds: novoTerritorioEquipes,
        bairros: [],
        ativo: true,
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      };
      
      const saved = await salvarTerritorio(novoTerritorio);
      if (!saved) {
        toast.error("Erro ao salvar território");
        return;
      }
      
      // Recarregar territórios
      const updated = await carregarTerritorios();
      setTerritorios(updated);
      
      // Encontrar o novo território pelo nome e adicionar aos selecionados e visíveis automaticamente
      const novoTerritorioSalvo = updated.find(t => t.nome === novoTerritorioNome.trim() && t.ativo);
      if (novoTerritorioSalvo) {
        setTerritoriosSelecionados(prev => {
          if (!prev.includes(novoTerritorioSalvo.id)) {
            return [...prev, novoTerritorioSalvo.id];
          }
          return prev;
        });
        setTerritoriosVisiveis(prev => {
          if (!prev.includes(novoTerritorioSalvo.id)) {
            return [...prev, novoTerritorioSalvo.id];
          }
          return prev;
        });
      }
      
      // Atualizar territórios das OSs
      atualizarTerritoriosOSs().then(({ atualizadas }) => {
        if (atualizadas > 0) {
          toast.info(`${atualizadas} OSs tiveram seus territórios atualizados`);
        }
      });
      
      toast.success(`Território "${novoTerritorioNome}" criado com sucesso!`);
      
      // Limpar estados
      setCriarTerritorioOpen(false);
      setNovoPoligono(null);
      setNovoTerritorioNome("");
      setNovoTerritorioCor("#3b82f6");
      setNovoTerritorioEquipes([]);
    } catch (error) {
      console.error("Erro ao criar território:", error);
      toast.error("Erro ao criar território");
    } finally {
      setSalvandoTerritorio(false);
    }
  };

  // Função para incluir OS diretamente na rota (chamada do mapa)
  // Usa osPendentesTodas para permitir inclusão manual de OSs fora do território
  const handleIncluirOSNaRota = (osId: string) => {
    if (!equipeEditando) {
      toast.error("Selecione uma equipe para editar primeiro");
      return;
    }
    
    // Buscar em osPendentesTodas para permitir inclusão manual de OSs fora do território
    const os = osPendentesTodas.find(o => o.id === osId);
    if (!os) {
      toast.error("OS não encontrada");
      return;
    }
    
    const equipe = equipes.find(e => e.id === equipeEditando);
    if (equipe && !(equipe.skills || equipe.habilidades).includes(os.tipo)) {
      toast.error(`A equipe ${equipe.codigo} não possui a habilidade necessária para ${obterLabelTipo(os.tipo)}`);
      return;
    }
    
    const novasRotas = rotas.map(r => {
      if (r.equipe.id === equipeEditando) {
        const novoServico: RotaServico = {
          tipo: "SERVICO",
          ordemServico: os,
          ordemNaRota: r.servicos.length + 1,
          tempoDeslocamento: 0,
          distancia: 0,
          tempoTotal: 0,
          horaInicio: "",
          horaFim: "",
          eta: "",
        };
        const novosServicos = [...r.servicos, novoServico];
        const rotaAtualizada = { ...r, servicos: novosServicos };
        return recalcularRota(rotaAtualizada).rota;
      }
      return r;
    });
    
    setRotas(novasRotas);
    setOsSelecionadaNoMapa(null);
    toast.success(`OS ${os.numero} adicionada à rota`);
  };

  // Função para calcular e exibir expectativa de equipes
  const handleCalcularExpectativa = () => {
    // Filtrar apenas territórios selecionados se usar territórios
    const territoriosParaCalculo = usarTerritorios && territoriosSelecionados.length > 0
      ? territorios.filter(t => territoriosSelecionados.includes(t.id))
      : territorios;
    
    const expectativasCalculadas = calcularExpectativaEquipesPorTerritorio(
      osPendentes,
      equipes,
      territoriosParaCalculo
    );
    setExpectativas(expectativasCalculadas);
    setExpectativaDialogOpen(true);
  };

  // Função para exportar rotas para Excel
  const handleExportarRotas = async () => {
    console.log("handleExportarRotas chamada");
    try {
      console.log("Rotas:", rotas.length, "OSs pendentes:", osPendentes.length, "Equipes selecionadas:", equipesSelecionadas.length);
      
      if (rotas.length === 0 && osPendentes.length === 0 && equipesSelecionadas.length === 0) {
        alert("Não há rotas ou OSs para exportar.");
        return;
      }
      
      console.log("Iniciando busca de skills...");

      // V17: Buscar todas as skills de uma vez para otimizar
      const todasOSs = [
        ...rotas.flatMap(r => r.servicos.filter(s => s.ordemServico).map(s => s.ordemServico!)),
        ...osPendentes
      ];
      console.log("Total de OSs para processar:", todasOSs.length);
      const codigosSkillsUnicos = [...new Set(todasOSs.map(os => tipoParaSkillCodigo(os.tipo)))];
      console.log("Códigos de skills únicos:", codigosSkillsUnicos);
      const dadosSkillsMap = await getDadosSkills(codigosSkillsUnicos);
      console.log("Skills carregadas:", dadosSkillsMap.size);

      // Preparar dados para exportação
      const dadosExportacao: any[] = [];

    // V16: Adicionar linhas no início para equipes selecionadas sem OSs
    const equipesComRotas = new Set(rotas.map(r => r.equipe.id));
    const equipesSemOSs = equipesSelecionadas.filter(eqId => !equipesComRotas.has(eqId));
    
    if (equipesSemOSs.length > 0) {
      equipesSemOSs.forEach(equipeId => {
        const equipe = equipes.find(e => e.id === equipeId);
        if (!equipe) return;
        
        // Verificar se a equipe tem território
        const territorioEquipe = territorios.find(t => t.equipeIds && t.equipeIds.includes(equipeId) && t.ativo);
        let motivo = "";
        
        if (usarTerritorios) {
          motivo = territorioEquipe 
            ? `Nenhuma OS apta dentro do território "${territorioEquipe.nome}"`
            : `Equipe não possui território cadastrado`;
        } else {
          motivo = "Nenhuma OS alocada para esta equipe";
        }
        
        dadosExportacao.push({
          "Equipe": equipe.codigo,
          "Técnico": equipe.tecnico,
          "Ordem na Rota": "-",
          "Número OS": "-",
          "Tipo": "-",
          "Endereço": "-",
          "Latitude": equipe.latitude,
          "Longitude": equipe.longitude,
          "Origem": "-",
          "Origem Latitude": "-",
          "Origem Longitude": "-",
          "Distância Segmento (km)": "-",
          "Distância Acumulada (km)": "-",
          "Prazo": "-",
          "Regulada": "-",
          "Prioridade": "-",
          "Duração Serviço (min)": "-",
          "Valor (R$)": "-",
          "Tempo Deslocamento (min)": "-",
          "Hora Início": "-",
          "Hora Fim": "-",
          "ETA": "-",
          "Fora do Prazo": "-",
          "Status": "Equipe sem OSs",
          "Motivo Não Alocada": motivo,
          "Territórios": territorioEquipe ? territorioEquipe.nome : "-",
          "Distância Total (km)": "-",
          "Tempo Total (min)": "-",
          "Faturamento Total (R$)": "-",
          "Progresso (%)": "-",
        });
      });
    }

    // Para cada equipe com rotas
    for (const rota of rotas) {
      if (rota.servicos.length === 0) {
        // Equipe sem serviços
        dadosExportacao.push({
          "Equipe": rota.equipe.codigo,
          "Técnico": rota.equipe.tecnico,
          "Ordem na Rota": "-",
          "Número OS": "-",
          "Tipo": "-",
          "Endereço": "-",
          "Latitude": rota.equipe.latitude,
          "Longitude": rota.equipe.longitude,
          "Origem": "-",
          "Origem Latitude": "-",
          "Origem Longitude": "-",
          "Distância Segmento (km)": "-",
          "Distância Acumulada (km)": "-",
          "Prazo": "-",
          "Regulada": "-",
          "Prioridade": "-",
          "Duração Serviço (min)": "-",
          "Valor (R$)": "-",
          "Tempo Deslocamento (min)": "-",
          "Hora Início": "-",
          "Hora Fim": "-",
          "ETA": "-",
          "Status": "-",
          "Motivo Não Alocada": "-",
          "Territórios": "-",
          "Distância Total (km)": rota.distanciaTotal.toFixed(2),
          "Tempo Total (min)": formatarTempo(rota.tempoTotal),
          "Faturamento Total (R$)": rota.faturamentoTotal,
          "Progresso (%)": rota.progresso.toFixed(1),
        });
      } else {
        // Para cada serviço da equipe (incluir ALMOCO)
        let distanciaAcumulada = 0;
        const servicosValidos = rota.servicos.filter(s => s.tipo === "SERVICO" && s.ordemServico);
        let servicosProcessados = 0;
        
        for (let index = 0; index < rota.servicos.length; index++) {
          const servico = rota.servicos[index];
          // Tratar serviços do tipo ALMOCO
          if (servico.tipo === "ALMOCO") {
            // Determinar origem (ponto anterior ou base)
            let origemLat = rota.equipe.latitude;
            let origemLng = rota.equipe.longitude;
            let origemDesc = `${rota.equipe.codigo} (Base)`;
            
            // Encontrar serviço anterior válido
            let idxAnterior = index - 1;
            while (idxAnterior >= 0) {
              if (rota.servicos[idxAnterior].tipo === "SERVICO" && rota.servicos[idxAnterior].ordemServico) {
                origemLat = rota.servicos[idxAnterior].ordemServico.latitude;
                origemLng = rota.servicos[idxAnterior].ordemServico.longitude;
                origemDesc = `OS ${rota.servicos[idxAnterior].ordemServico.numero}`;
                break;
              }
              idxAnterior--;
            }
            
            // Adicionar linha de almoço
            dadosExportacao.push({
              "Equipe": rota.equipe.codigo,
              "Técnico": rota.equipe.tecnico,
              "Ordem na Rota": "-",
              "Número OS": "ALMOÇO",
              "Tipo": "ALMOÇO",
              "Endereço": "Intervalo para Almoço",
              "Latitude": origemLat,
              "Longitude": origemLng,
              "Origem": origemDesc,
              "Origem Latitude": origemLat,
              "Origem Longitude": origemLng,
              "Distância Segmento (km)": "0.00",
              "Distância Acumulada (km)": distanciaAcumulada.toFixed(2),
              "Prazo": "-",
              "Regulada": "-",
              "Prioridade": "-",
              "Duração Serviço (min)": rota.equipe.almoco?.duracao || 60,
              "Valor (R$)": "0.00",
              "Tempo Deslocamento (min)": "0.00",
              "Hora Início": servico.horaInicio,
              "Hora Fim": servico.horaFim,
              "ETA": servico.eta || servico.horaInicio,
              "Fora do Prazo": "-",
              "Status": "Almoço",
              "Motivo Não Alocada": "-",
              "Territórios": "-",
              "Distância Total (km)": "-",
              "Tempo Total (min)": "-",
              "Faturamento Total (R$)": "-",
              "Progresso (%)": "-",
            });
            continue;
          }
          
          // Pular se não tiver ordemServico
          if (!servico.ordemServico) {
            continue;
          }
          
          const os = servico.ordemServico;
          
          // Determinar origem (ponto anterior ou base)
          let origemLat = rota.equipe.latitude;
          let origemLng = rota.equipe.longitude;
          let origemDesc = `${rota.equipe.codigo} (Base)`;
          
          // Encontrar serviço anterior válido (pode ter ALMOCO no meio)
          let idxAnterior = index - 1;
          while (idxAnterior >= 0) {
            if (rota.servicos[idxAnterior].tipo === "SERVICO" && rota.servicos[idxAnterior].ordemServico) {
              origemLat = rota.servicos[idxAnterior].ordemServico.latitude;
              origemLng = rota.servicos[idxAnterior].ordemServico.longitude;
              origemDesc = `OS ${rota.servicos[idxAnterior].ordemServico.numero}`;
              break;
            }
            idxAnterior--;
          }
          
          // Calcular distância do segmento
          const distanciaSegmento = calcularDistancia(
            origemLat, origemLng,
            os.latitude, os.longitude
          );
          distanciaAcumulada += distanciaSegmento;
          servicosProcessados++;
          
          const isUltimoServico = servicosProcessados === servicosValidos.length;
          
          const foraDoPrazo = estaForaDoPrazo(os, servico.horaFim);
          
          // V16: Encontrar territórios onde a OS está
          const territoriosOS = encontrarTerritoriosOS(os);
          const territoriosStr = territoriosOS.length > 0 
            ? territoriosOS.join("; ") 
            : "Fora de territórios";
          
          // V17: Calcular prioridade e regulada corretamente
          const prioridadeCalculada = calcularPrioridadeExportacao(os);
          const codigoSkill = tipoParaSkillCodigo(os.tipo);
          const skillData = dadosSkillsMap.get(codigoSkill);
          const reguladaVerificada = skillData?.regulada ?? os.regulada ?? false;
          
          dadosExportacao.push({
            "Equipe": rota.equipe.codigo,
            "Técnico": rota.equipe.tecnico,
            "Ordem na Rota": servico.ordemNaRota,
            "Número OS": os.numero,
            "Tipo": os.tipo,
            "Endereço": os.endereco,
            "Latitude": os.latitude,
            "Longitude": os.longitude,
            "Origem": origemDesc,
            "Origem Latitude": origemLat,
            "Origem Longitude": origemLng,
            "Distância Segmento (km)": distanciaSegmento.toFixed(2),
            "Distância Acumulada (km)": distanciaAcumulada.toFixed(2),
            "Prazo": os.prazo ? new Date(os.prazo).toLocaleString("pt-BR") : "-",
            "Regulada": reguladaVerificada ? "Sim" : "Não",
            "Prioridade": prioridadeCalculada,
            "Duração Serviço (min)": os.tempoExecucao,
            "Valor (R$)": os.valor,
            "Tempo Deslocamento (min)": servico.tempoDeslocamento.toFixed(2),
            "Hora Início": servico.horaInicio,
            "Hora Fim": servico.horaFim,
            "ETA": servico.eta || servico.horaInicio,
            "Fora do Prazo": foraDoPrazo ? "SIM ⚠️" : "Não",
            "Status": "Alocada",
            "Motivo Não Alocada": "-",
            "Territórios": territoriosStr,
            "Distância Total (km)": isUltimoServico ? rota.distanciaTotal.toFixed(2) : "-",
            "Tempo Total (min)": isUltimoServico ? formatarTempo(rota.tempoTotal) : "-",
            "Faturamento Total (R$)": isUltimoServico ? rota.faturamentoTotal : "-",
            "Progresso (%)": isUltimoServico ? rota.progresso.toFixed(1) : "-",
          });
        }
      }
    }

    // Adicionar OSs não roteirizadas (backlog)
    if (osPendentes.length > 0) {
      for (const os of osPendentes) {
        const motivo = naoAlocadas[os.id] || "Não alocada";
        
        // V16: Encontrar territórios onde a OS está
        const territoriosOS = encontrarTerritoriosOS(os);
        const territoriosStr = territoriosOS.length > 0 
          ? territoriosOS.join("; ") 
          : "Fora de territórios";
        
        // V17: Calcular prioridade e regulada corretamente
        const prioridadeCalculada = calcularPrioridadeExportacao(os);
        const codigoSkill = tipoParaSkillCodigo(os.tipo);
        const skillData = dadosSkillsMap.get(codigoSkill);
        const reguladaVerificada = skillData?.regulada ?? os.regulada ?? false;
        
        dadosExportacao.push({
          "Equipe": "-",
          "Técnico": "-",
          "Ordem na Rota": "-",
          "Número OS": os.numero,
          "Tipo": os.tipo,
          "Endereço": os.endereco,
          "Latitude": os.latitude,
          "Longitude": os.longitude,
          "Origem": "-",
          "Origem Latitude": "-",
          "Origem Longitude": "-",
          "Distância Segmento (km)": "-",
          "Distância Acumulada (km)": "-",
          "Prazo": os.prazo ? new Date(os.prazo).toLocaleString("pt-BR") : "-",
          "Regulada": reguladaVerificada ? "Sim" : "Não",
          "Prioridade": prioridadeCalculada,
          "Duração Serviço (min)": os.tempoExecucao,
          "Valor (R$)": os.valor,
          "Tempo Deslocamento (min)": "-",
          "Hora Início": "-",
          "Hora Fim": "-",
          "ETA": "-",
          "Fora do Prazo": "-",
          "Status": "Não Alocada",
          "Motivo Não Alocada": motivo,
          "Territórios": territoriosStr,
          "Distância Total (km)": "-",
          "Tempo Total (min)": "-",
          "Faturamento Total (R$)": "-",
          "Progresso (%)": "-",
        });
      }
    }

    console.log("Total de linhas para exportar:", dadosExportacao.length);
    
    // Identificar linhas de ALMOÇO (índice baseado em 0, +1 para header)
    const linhasAlmoco: number[] = [];
    dadosExportacao.forEach((linha, idx) => {
      if (linha["Número OS"] === "ALMOÇO") {
        linhasAlmoco.push(idx + 2); // +2 porque row 1 é header, e xlsx é 1-indexed
      }
    });
    console.log("Linhas de ALMOÇO identificadas:", linhasAlmoco);
    
    // Criar workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    console.log("Worksheet criado");
    
    // Aplicar estilo laranja nas linhas de ALMOÇO
    const estiloAlmoco = {
      fill: {
        fgColor: { rgb: "FFA500" } // Laranja
      },
      font: {
        bold: true,
        color: { rgb: "000000" }
      }
    };
    
    // Obter range do worksheet
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    const numColunas = range.e.c + 1;
    
    // Aplicar estilo a todas as células das linhas de ALMOÇO
    linhasAlmoco.forEach(rowNum => {
      for (let col = 0; col < numColunas; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum - 1, c: col });
        if (ws[cellAddress]) {
          ws[cellAddress].s = estiloAlmoco;
        }
      }
    });

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 12 }, // Equipe
      { wch: 20 }, // Técnico
      { wch: 15 }, // Ordem na Rota
      { wch: 12 }, // Número OS
      { wch: 12 }, // Tipo
      { wch: 40 }, // Endereço
      { wch: 12 }, // Latitude
      { wch: 12 }, // Longitude
      { wch: 25 }, // Origem (NOVA)
      { wch: 12 }, // Origem Latitude (NOVA)
      { wch: 12 }, // Origem Longitude (NOVA)
      { wch: 20 }, // Distância Segmento (NOVA)
      { wch: 20 }, // Distância Acumulada (NOVA)
      { wch: 15 }, // Prazo
      { wch: 10 }, // Regulada
      { wch: 12 }, // Prioridade
      { wch: 20 }, // Duração Serviço
      { wch: 12 }, // Valor
      { wch: 25 }, // Tempo Deslocamento
      { wch: 12 }, // Hora Início
      { wch: 12 }, // Hora Fim
      { wch: 12 }, // ETA
      { wch: 15 }, // Fora do Prazo
      { wch: 15 }, // Status
      { wch: 25 }, // Motivo Não Alocada
      { wch: 20 }, // Distância Total
      { wch: 18 }, // Tempo Total
      { wch: 20 }, // Faturamento Total
      { wch: 15 }, // Progresso
    ];
    ws["!cols"] = colWidths;

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, "Rotas");

    // Gerar nome do arquivo com data e hora
    const agora = new Date();
    const dataHora = agora.toLocaleString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(/[\/\s:]/g, "_");

    const nomeArquivo = `Rotas_${dataHora}.xlsx`;
    console.log("Nome do arquivo:", nomeArquivo);

    // Baixar arquivo
    console.log("Iniciando download do arquivo...");
    XLSX.writeFile(wb, nomeArquivo);
    console.log("Arquivo baixado com sucesso!");
    toast.success("Rotas exportadas com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar rotas:", error);
      toast.error("Erro ao exportar rotas. Verifique o console para mais detalhes.");
    }
  };

  return (
    <MainLayout
      title="Roteirização"
      subtitle="Planejamento e otimização de rotas"
      breadcrumbs={[{ label: "Roteirização" }]}
    >
      {/* Header com Data e Ações */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Roteirização do Dia</h2>
            <p className="text-sm text-muted-foreground">{formatarData()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setSelecaoServicosDialogOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Selecionar Serviços
            </Button>
            <Button
              onClick={handleCalcularExpectativa}
              disabled={osPendentes.length === 0 || (usarTerritorios && territoriosSelecionados.length === 0)}
              variant="outline"
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Expectativa de Equipes
            </Button>
            <Button
              onClick={() => setParametrosModalOpen(true)}
              variant="outline"
              className="gap-2"
              title="Ajustar parâmetros de roteirização"
            >
              <Settings className="h-4 w-4" />
              Parâmetros
            </Button>
            <Button
              onClick={handleOtimizarRotas}
              disabled={isOtimizando || filteredServicos.length === 0 || !podeEditar}
              className="gap-2"
              title={!podeEditar ? "Você não tem permissão para otimizar rotas" : undefined}
            >
              <RefreshCcw className={cn("h-4 w-4", isOtimizando && "animate-spin")} />
              {isOtimizando ? "Calculando rotas..." : "Otimizar Rotas"}
            </Button>
            <Button
              onClick={() => {
                console.log("Botão de exportar clicado");
                handleExportarRotas().catch(err => {
                  console.error("Erro ao executar exportação:", err);
                  toast.error("Erro ao exportar. Verifique o console.");
                });
              }}
              disabled={rotas.length === 0 && osPendentes.length === 0}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Configurações Compactas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Configuração de Territórios */}
          <div className="rounded-lg border border-border bg-card p-4 flex flex-col min-h-[200px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapIcon className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="usar-territorios" className="text-sm font-medium text-foreground cursor-pointer">
                    Territórios
                  </Label>
                  <Switch
                    id="usar-territorios"
                    checked={usarTerritorios}
                    onCheckedChange={setUsarTerritorios}
                    className="ml-2"
                  />
                </div>
                {usarTerritorios && (
                  <span className="text-xs text-muted-foreground">
                    {territoriosSelecionados.length} de {territorios.filter(t => t.ativo && t.poligono.length >= 3).length} selecionados
                    {territorios.filter(t => t.ativo && t.poligono.length >= 3 && (!t.equipeIds || t.equipeIds.length === 0)).length > 0 && (
                      <span className="text-orange-500 ml-1">
                        ({territorios.filter(t => t.ativo && t.poligono.length >= 3 && (!t.equipeIds || t.equipeIds.length === 0)).length} sem equipes)
                      </span>
                    )}
                  </span>
                )}
              </div>
            {usarTerritorios && (
              <div className="flex flex-col flex-1">
                <div className="grid grid-cols-3 lg:grid-cols-4 gap-1 max-h-[280px] overflow-y-auto flex-1">
                  {territorios.filter(t => t.ativo && t.poligono.length >= 3).map((territorio) => {
                    const checked = territoriosSelecionados.includes(territorio.id);
                    const visivel = territoriosVisiveis.includes(territorio.id);
                    const equipesVinculadas = (territorio.equipeIds || [])
                      .map(id => equipes.find(e => e.id === id))
                      .filter(e => e !== undefined);
                    const temEquipes = equipesVinculadas.length > 0;
                    return (
                      <div 
                        key={territorio.id} 
                        className={`flex items-center gap-1 text-xs text-foreground p-1 rounded border ${
                          temEquipes 
                            ? 'border-transparent' 
                            : 'border-dashed border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20'
                        }`}
                      >
                        <label 
                          className="flex items-center gap-1 flex-1 cursor-pointer hover:bg-muted/50 rounded px-0.5"
                          title={temEquipes ? `Equipes: ${equipesVinculadas.map(e => e?.codigo).join(", ")}` : '⚠️ Sem equipes vinculadas - vincule equipes em Cadastros → Territórios'}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              // Permitir selecionar territórios mesmo sem equipes vinculadas
                              if (e.target.checked) {
                                setTerritoriosSelecionados((prev) => [...prev, territorio.id]);
                                // Ao selecionar, também torna visível automaticamente
                                if (!visivel) {
                                  setTerritoriosVisiveis((prev) => [...prev, territorio.id]);
                                }
                              } else {
                                setTerritoriosSelecionados((prev) => prev.filter((id) => id !== territorio.id));
                                // Ao desselecionar, também oculta
                                setTerritoriosVisiveis((prev) => prev.filter((id) => id !== territorio.id));
                              }
                            }}
                            className="h-3 w-3 flex-shrink-0"
                          />
                          <div
                            className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${!temEquipes ? 'border border-dashed border-orange-400' : ''}`}
                            style={{ backgroundColor: temEquipes ? territorio.cor : 'transparent' }}
                          />
                          <span className="font-medium truncate text-[11px]">{territorio.nome}</span>
                          {temEquipes ? (
                            <span className="text-muted-foreground text-[9px] truncate">
                              {equipesVinculadas.map(e => e?.codigo).join(", ")}
                            </span>
                          ) : (
                            <span className="text-orange-500 text-[9px] truncate">
                              (sem equipes)
                            </span>
                          )}
                        </label>
                        {/* Botão de visibilidade no mapa */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (visivel) {
                              setTerritoriosVisiveis((prev) => prev.filter((id) => id !== territorio.id));
                            } else {
                              setTerritoriosVisiveis((prev) => [...prev, territorio.id]);
                            }
                          }}
                          className={`p-0.5 rounded hover:bg-muted flex-shrink-0 transition-colors ${
                            visivel ? 'text-foreground' : 'text-muted-foreground/50'
                          }`}
                          title={visivel ? 'Ocultar no mapa' : 'Mostrar no mapa'}
                        >
                          {visivel ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-2 border-t mt-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Selecionar todos os territórios ativos
                      const ativos = territorios.filter(t => t.ativo && t.poligono.length >= 3);
                      if (territoriosSelecionados.length === ativos.length) {
                        setTerritoriosSelecionados([]);
                        setTerritoriosVisiveis([]);
                      } else {
                        const ids = ativos.map(t => t.id);
                        setTerritoriosSelecionados(ids);
                        setTerritoriosVisiveis(ids);
                      }
                    }}
                    className="flex-1 text-xs h-7"
                  >
                    {territoriosSelecionados.length === territorios.filter(t => t.ativo && t.poligono.length >= 3 && t.equipeIds && t.equipeIds.length > 0).length ? "Desselecionar Todos" : "Selecionar Todos"}
                  </Button>
                <Button
                  variant="outline"
                    size="sm"
                    onClick={() => setSelecaoTerritoriosDialogOpen(true)}
                    className="gap-1 text-xs h-7"
                    title="Opções avançadas"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                  size="sm"
                  onClick={() => setMostrarTerritoriosNoMapa(!mostrarTerritoriosNoMapa)}
                    className="gap-1 text-xs h-7"
                    title={mostrarTerritoriosNoMapa ? "Ocultar territórios no mapa" : "Mostrar territórios no mapa"}
                >
                  {mostrarTerritoriosNoMapa ? (
                      <EyeOff className="h-3 w-3" />
                  ) : (
                      <Eye className="h-3 w-3" />
                  )}
                </Button>
              </div>
              </div>
            )}
            </div>

          {/* Seleção de Equipes */}
          <div className="rounded-lg border border-border bg-card p-4 flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-foreground">Equipes</div>
              <span className="text-xs text-muted-foreground">{equipesSelecionadas.length} de {equipes.length} selecionadas</span>
            </div>
            <div className="flex flex-col flex-1">
              {loadingEquipes ? (
                <div className="text-xs text-muted-foreground">Carregando...</div>
              ) : equipes.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Nenhuma equipe ativa cadastrada
                </div>
              ) : (
                <div className="grid grid-cols-3 lg:grid-cols-4 gap-1 max-h-[280px] overflow-y-auto flex-1">
                {equipes.map((eq) => {
                  const checked = equipesSelecionadas.includes(eq.id);
                  // Verificar se equipe está vinculada a algum território ativo
                  const territorioVinculado = territorios.find(t => 
                    t.ativo && t.equipeIds && t.equipeIds.includes(eq.id)
                  );
                  return (
                    <label 
                      key={eq.id} 
                      className={`flex items-center gap-1.5 text-xs text-foreground cursor-pointer hover:bg-muted/50 p-1 rounded border ${
                        territorioVinculado 
                          ? 'border-transparent' 
                          : 'border-dashed border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20'
                      }`}
                      title={territorioVinculado ? `Vinculada a: ${territorioVinculado.nome}` : 'Sem território vinculado'}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEquipesSelecionadas((prev) => [...prev, eq.id]);
                          } else {
                            setEquipesSelecionadas((prev) => prev.filter((id) => id !== eq.id));
                          }
                        }}
                        className="h-3 w-3 flex-shrink-0"
                      />
                      {territorioVinculado && (
                        <div 
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: territorioVinculado.cor }}
                          title={territorioVinculado.nome}
                        />
                      )}
                      {!territorioVinculado && (
                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0 border border-dashed border-orange-400" title="Sem território" />
                      )}
                      <span className="font-medium truncate text-[11px]">{eq.codigo}</span>
                    </label>
                  );
                })}
              </div>
              )}
              <div className="mt-auto pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (equipesSelecionadas.length === equipes.length) {
                      setEquipesSelecionadas([]);
                    } else {
                      setEquipesSelecionadas(equipes.map(e => e.id));
                    }
                  }}
                  className="w-full text-xs h-7"
                >
                  {equipesSelecionadas.length === equipes.length ? "Desselecionar Todas" : "Selecionar Todas"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* V19.6: Alerta de OSs Urgentes fora dos Territórios */}
      {usarTerritorios && osUrgentesForaTerritorios.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                  ⚠️ {osUrgentesForaTerritorios.length} OS(s) Urgente(s) Fora dos Territórios Selecionados
                </h3>
                <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                  Existem ordens de serviço com prazo urgente (RELIGA, Reguladas, ou prazo para hoje) que estão localizadas 
                  <strong> fora </strong> dos territórios selecionados e <strong>não serão roteirizadas</strong>.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                    onClick={() => setMostrarOsUrgentesForaDialog(true)}
                  >
                    <Eye className="h-4 w-4" />
                    Ver Lista ({osUrgentesForaTerritorios.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50"
                    onClick={() => {
                      // V19.7: Destacar TODAS as OSs urgentes fora do território no mapa
                      if (osUrgentesForaTerritorios.length > 0) {
                        setOsUrgenteSelecionadaNoMapa(null); // Limpar seleção única
                        setOsUrgentesTodasNoMapa([...osUrgentesForaTerritorios]); // Passar cópia do array
                      }
                    }}
                  >
                    <MapPin className="h-4 w-4" />
                    Ver Todas no Mapa
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/50"
              onClick={() => {
                // Esconder o alerta temporariamente (pode ser persistido em localStorage se desejado)
                // Por enquanto apenas fecha
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog para listar OSs Urgentes fora dos Territórios */}
      <Dialog open={mostrarOsUrgentesForaDialog} onOpenChange={setMostrarOsUrgentesForaDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              OSs Urgentes Fora dos Territórios ({osUrgentesForaTerritorios.length})
            </DialogTitle>
            <DialogDescription>
              Estas ordens de serviço são urgentes (<strong>RELIGA</strong> ou <strong>Reguladas vencidas/vencendo hoje</strong>) mas estão localizadas
              fora dos territórios selecionados para roteirização. Considere adicionar novos territórios ou expandir os existentes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              {osUrgentesForaTerritorios.map((os) => {
                const ehReliga = os.tipo.toUpperCase() === 'RELIGA';
                const ehRegulada = os.regulada === true;
                const prazoDate = os.prazo ? new Date(os.prazo) : null;
                
                return (
                  <div
                    key={os.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all",
                      ehReliga ? "border-purple-300 bg-purple-50 dark:bg-purple-950/30" :
                      ehRegulada ? "border-orange-300 bg-orange-50 dark:bg-orange-950/30" :
                      "border-red-300 bg-red-50 dark:bg-red-950/30"
                    )}
                    onClick={() => {
                      setOsUrgentesTodasNoMapa([]); // V19.7: Limpar visualização de todas
                      setOsUrgenteSelecionadaNoMapa(os);
                      setMostrarOsUrgentesForaDialog(false);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{os.numero}</span>
                          <Badge variant={ehReliga ? "default" : ehRegulada ? "regulada" : "destructive"} className="text-xs">
                            {obterLabelTipo(os.tipo)}
                          </Badge>
                          {ehReliga && (
                            <Badge variant="default" className="text-xs bg-purple-600">
                              <Zap className="h-3 w-3 mr-1" />
                              RELIGA
                            </Badge>
                          )}
                          {ehRegulada && (
                            <Badge variant="regulada" className="text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              REGULADA
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {os.endereco}
                        </div>
                        {prazoDate && (
                          <div className="text-sm mt-1 flex items-center gap-1 text-red-600 dark:text-red-400">
                            <Clock className="h-3 w-3" />
                            Prazo: {prazoDate.toLocaleString("pt-BR")}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-xs text-muted-foreground">
                          {os.latitude !== null && os.longitude !== null 
                            ? `${os.latitude.toFixed(5)}, ${os.longitude.toFixed(5)}`
                            : "Sem coordenadas"}
                        </div>
                        {os.latitude !== null && os.longitude !== null && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOsUrgentesTodasNoMapa([]); // V19.7: Limpar visualização de todas
                              setOsUrgenteSelecionadaNoMapa(os);
                              setMostrarOsUrgentesForaDialog(false);
                            }}
                          >
                            <MapIcon className="h-3 w-3" />
                            Mapa
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setMostrarOsUrgentesForaDialog(false)}>
              Fechar
            </Button>
            <Button 
              onClick={() => navigate("/cadastro-territorios")}
              className="gap-2"
            >
              <MapIcon className="h-4 w-4" />
              Gerenciar Territórios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content - Layout com Mapa Maior */}
      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Cabeçalho do Editor de Rotas - Acima do Mapa */}
        {equipeEditando && (() => {
          const rotaEditando = rotas.find(r => r.equipe.id === equipeEditando);
          if (!rotaEditando) return null;
          
          const cor = rotaEditando.equipe.color || "#3b82f6";
          const servicosValidos = rotaEditando.servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico);
          const urgentes = servicosValidos.filter(s => s.ordemServico?.regulada).length;
          
          return (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Informações da Equipe */}
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: cor }}
                  >
                    {rotaEditando.equipe.codigo}
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{rotaEditando.equipe.codigo}</div>
                    <div className="text-sm text-muted-foreground">{rotaEditando.equipe.tecnico}</div>
                    <div className="text-xs text-muted-foreground mt-1">{servicosValidos.length} OSs</div>
                  </div>
                </div>
                
                {/* Métricas */}
                <div className="flex-1 grid grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Distância</div>
                    <div className="font-semibold text-sm">{rotaEditando.distanciaTotal.toFixed(1)} km</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Tempo</div>
                    <div className="font-semibold text-sm">{formatarTempo(rotaEditando.tempoTotal)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Faturamento</div>
                    <div className="font-semibold text-sm text-success">R$ {rotaEditando.faturamentoTotal.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Urgentes</div>
                    <div className="font-semibold text-sm text-danger">{urgentes}/{servicosValidos.length}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Intervalo</div>
                    <div className="font-semibold text-sm">
                      {(() => {
                        const primeiroServico = rotaEditando.servicos.find(s => s.tipo === 'SERVICO' && s.horaInicio);
                        const ultimoServico = [...rotaEditando.servicos].reverse().find(s => s.tipo === 'SERVICO' && s.horaFim);
                        if (primeiroServico && ultimoServico) {
                          return `${primeiroServico.horaInicio} - ${ultimoServico.horaFim}`;
                        }
                        if (rotaEditando.equipe.horaInicio) {
                          return `${rotaEditando.equipe.horaInicio} - ${rotaEditando.equipe.horaFim || '--:--'}`;
                        }
                        return '--:-- - --:--';
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Botões de Ação */}
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const rotaAtual = rotas.find(r => r.equipe.id === equipeEditando);
                      if (!rotaAtual) return;
                      
                      const resultado: ResultadoRecalculo = recalcularRota(rotaAtual);
                      const rotaRecalculada = resultado.rota;
                      const inconformidades = resultado.inconformidades;
                      
                      const novasRotas = rotas.map(r => {
                        if (r.equipe.id === equipeEditando) {
                          return rotaRecalculada;
                        }
                        return r;
                      });
                      const servicosValidosRecalc = rotaRecalculada.servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico);
                      const urgentesRecalc = servicosValidosRecalc.filter(s => s.ordemServico?.regulada).length;
                      
                      setRotas(novasRotas);
                      
                      if (metricasAntesEdicao) {
                        setMetricasAntesEdicao({
                          distancia: rotaRecalculada.distanciaTotal,
                          tempo: rotaRecalculada.tempoTotal,
                          faturamento: rotaRecalculada.faturamentoTotal,
                          urgentes: urgentesRecalc
                        });
                      }
                      
                      if (metricasAntesEdicao) {
                        const diffDistancia = rotaRecalculada.distanciaTotal - metricasAntesEdicao.distancia;
                        const diffTempo = rotaRecalculada.tempoTotal - metricasAntesEdicao.tempo;
                        const diffFaturamento = rotaRecalculada.faturamentoTotal - metricasAntesEdicao.faturamento;
                        
                        toast.success(
                          `Rota recalculada! ` +
                          `Distância: ${diffDistancia >= 0 ? '+' : ''}${diffDistancia.toFixed(1)} km, ` +
                          `Tempo: ${diffTempo >= 0 ? '+' : ''}${formatarTempo(diffTempo)}, ` +
                          `Faturamento: ${diffFaturamento >= 0 ? '+' : ''}R$ ${diffFaturamento.toFixed(2)}`
                        );
                      } else {
                        toast.success("Rota recalculada com sucesso!");
                      }
                    }}
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Recalcular
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Deseja remover todas as OSs da equipe ${rotaEditando.equipe.codigo}?`)) {
                        const novasRotas = rotas.map(r => {
                          if (r.equipe.id === equipeEditando) {
                            const rotaAtualizada = { ...r, servicos: [] };
                            return recalcularRota(rotaAtualizada).rota;
                          }
                          return r;
                        });
                        setRotas(novasRotas);
                        toast.success("Rota limpa");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                </div>
              </div>
              
              {/* Inconformidades */}
              {(() => {
                const resultado = recalcularRota(rotaEditando);
                const inconformidades = resultado.inconformidades;
                
                if (inconformidades.length > 0) {
                  return (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg border-2 border-red-500">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-semibold text-red-900 dark:text-red-100">
                          Inconformidades Detectadas
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {inconformidades.map((inc, idx) => (
                          <div key={idx} className="text-red-800 dark:text-red-200">
                            {inc.tipo === 'urgente_fora_prazo' ? (
                              <span>⚠️ OS <strong>{inc.osNumero}</strong> fora do prazo</span>
                            ) : (
                              <span>⚠️ {inc.mensagem}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          );
        })()}
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Coluna 1 (Esquerda - 66%): Mapa Interativo */}
          <div className="lg:col-span-8 rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Mapa Interativo</h3>
            </div>
            <div className="relative h-[700px]">
              {/* Banner de seleção de coordenadas */}
              {selecionandoCoordNoMapa && (
                <div className="absolute top-0 left-0 right-0 z-[1000] bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 animate-pulse" />
                    <span className="font-medium">
                      Clique no mapa para definir a coordenada da OS: <strong>{editarCoordsOS?.numero}</strong>
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-blue-700"
                    onClick={() => {
                      setSelecionandoCoordNoMapa(false);
                      setEditarCoordsOpen(true);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              )}
              <MapaLeaflet
                rotas={rotas}
                osPendentes={filteredServicos}
                equipesMock={equipesAtivas}
                equipeHovered={equipeHovered}
                equipeEditando={equipeEditando}
                osSelecionada={osSelecionadaNoMapa}
                osSelecionadaNoEditor={osSelecionadaNoEditor}
                focarOSNoMapa={focarOSNoMapa}
                onOSSelecionada={(osId) => {
                  setOsSelecionadaNoMapa(osId);
                  // Também destacar no Editor de Rotas (sem focar no mapa)
                  if (osId) {
                    setFocarOSNoMapa(false); // Não centralizar mapa pois o clique veio do mapa
                    setOsSelecionadaNoEditor(osId);
                  }
                }}
                onIncluirOSNaRota={handleIncluirOSNaRota}
                selecionandoCoordNoMapa={selecionandoCoordNoMapa}
                onMapClick={(lat, lng) => {
                  if (selecionandoCoordNoMapa && editarCoordsOS) {
                    setEditarCoordsLat(lat.toFixed(6));
                    setEditarCoordsLng(lng.toFixed(6));
                    setSelecionandoCoordNoMapa(false);
                    setEditarCoordsOpen(true);
                    toast.success(`Coordenadas selecionadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                  }
                }}
                osUrgenteDestaque={osUrgenteSelecionadaNoMapa}
                osUrgentesDestaque={osUrgentesTodasNoMapa}
                onOsUrgenteDestaqueClear={() => {
                  setOsUrgenteSelecionadaNoMapa(null);
                  setOsUrgentesTodasNoMapa([]);
                }}
                key={`mapa-${rotas.length}-${equipeEditando || 'none'}`}
                territorios={mostrarTerritoriosNoMapa
                  ? (usarTerritorios && territoriosVisiveis.length > 0
                      ? territorios.filter(t => territoriosVisiveis.includes(t.id))
                      : [])
                  : []}
                onTerritorioEditado={async (territorioId, novoPoligono) => {
                  const territorio = territorios.find(t => t.id === territorioId);
                  if (territorio) {
                    const territorioAtualizado = { 
                      ...territorio, 
                      poligono: novoPoligono, 
                      atualizadoEm: new Date() 
                    };
                    const { salvarTerritorio } = await import("@/types/territorios");
                    const saved = await salvarTerritorio(territorioAtualizado);
                    if (saved) {
                      const updated = await carregarTerritorios();
                      setTerritorios(updated);
                      toast.success("Polígono atualizado com sucesso!");
                      
                      // Atualizar campo territorios das OSs pendentes/atrasadas
                      atualizarTerritoriosOSs().then(({ atualizadas }) => {
                        if (atualizadas > 0) {
                          toast.info(`${atualizadas} OSs tiveram seus territórios atualizados`);
                        }
                      });
                    }
                  }
                }}
                osCoordenadasSuspeitas={osCoordenadasSuspeitas}
                criandoPoligono={criandoPoligono}
                onPoligonoCriado={(poligono) => {
                  setNovoPoligono(poligono);
                  setCriandoPoligono(false);
                  setCriarTerritorioOpen(true);
                }}
                onCriacaoCancelada={() => {
                  setCriandoPoligono(false);
                  setNovoPoligono(null);
                }}
              />

              {/* Botão Criar Polígono no mapa */}
              {!criandoPoligono && (
                <div className="absolute top-4 left-4 z-[1000]">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setCriandoPoligono(true)}
                    className="bg-green-600 hover:bg-green-700 shadow-lg gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Criar Polígono
                  </Button>
                </div>
              )}
              
              {criandoPoligono && (
                <div className="absolute top-4 left-4 z-[1000] bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 animate-pulse" />
                    <span className="text-sm font-medium">
                      Clique no mapa para desenhar o polígono. Duplo clique para finalizar.
                    </span>
                  </div>
                </div>
              )}

              {/* Legenda */}
              <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border z-[1000]">
                <div className="flex flex-col gap-2 text-xs">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-warning border-2 border-white" />
                    Pendentes
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-primary border-2 border-white" />
                    Alocadas
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-blue-500 border-2 border-white" />
                    Base/Equipe
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 2 (Direita - 33%): Lista de OSs */}
          <div className="lg:col-span-4 rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ height: 'calc(700px + 57px)' }}>
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Editor de Rotas
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecione uma equipe para editar sua rota
                  </p>
                </div>
                <Badge variant="secondary">{rotas.filter((r) => r.servicos.length > 0).length}</Badge>
              </div>
              
              {/* Seletor de Equipe */}
              {rotas.filter(r => r.servicos.length > 0).length > 0 ? (
                <Select
                  value={equipeEditando || "todas"}
                  onValueChange={(value) => {
                    if (value === "todas") {
                      setEquipeEditando(null);
                      setMetricasAntesEdicao(null);
                      setOsSelecionadaNoMapa(null);
                    } else {
                      setEquipeEditando(value);
                      const rota = rotas.find(r => r.equipe.id === value);
                      if (rota) {
                        // Salvar métricas antes da edição
                        const servicosValidos = rota.servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico);
                        const urgentes = servicosValidos.filter(s => s.ordemServico?.regulada).length;
                        setMetricasAntesEdicao({
                          distancia: rota.distanciaTotal,
                          tempo: rota.tempoTotal,
                          faturamento: rota.faturamentoTotal,
                          urgentes: urgentes
                        });
                      }
                      setOsSelecionadaNoMapa(null);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma equipe para editar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-muted" />
                        <span>Todas as equipes</span>
                        <span className="text-muted-foreground text-xs">
                          (Ver todas as rotas)
                        </span>
                      </div>
                    </SelectItem>
                    {rotas
                      .filter(r => r.servicos.length > 0)
                      .map((rota) => {
                        const servicosValidos = rota.servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico);
                        return (
                          <SelectItem key={rota.equipe.id} value={rota.equipe.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: rota.equipe.color || "#3b82f6" }}
                              />
                              <span>{rota.equipe.codigo}</span>
                              <span className="text-muted-foreground text-xs">
                                ({servicosValidos.length} OSs)
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Nenhuma rota gerada. Clique em "Otimizar Rotas" para começar.
                </div>
              )}
            </div>

            {/* Lista de OSs */}
            <div className="flex-1 overflow-y-auto p-4">
              {!equipeEditando ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Selecione uma equipe acima para editar sua rota</p>
                </div>
              ) : (() => {
                const rotaEditando = rotas.find(r => r.equipe.id === equipeEditando);
                if (!rotaEditando) return null;
                
                const cor = rotaEditando.equipe.color || "#3b82f6";
                const servicosValidos = rotaEditando.servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico);
                const servicosComAlmoco = rotaEditando.servicos.filter(s => (s.tipo === 'SERVICO' && s.ordemServico) || s.tipo === 'ALMOCO');

                return (
                  <div className="space-y-3">
                    {/* Botão para Incluir OS Selecionada */}
                    {osSelecionadaNoMapa && equipeEditando && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                              OS Selecionada no Mapa
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {osPendentesTodas.find(os => os.id === osSelecionadaNoMapa)?.numero || osSelecionadaNoMapa}
                          </Badge>
                        </div>
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => {
                            // Buscar em osPendentesTodas para permitir inclusão manual de OSs fora do território
                            const os = osPendentesTodas.find(os => os.id === osSelecionadaNoMapa);
                            if (!os) {
                              toast.error("OS não encontrada");
                              return;
                            }
                            
                            const equipe = equipes.find(e => e.id === equipeEditando);
                            if (equipe && !(equipe.skills || equipe.habilidades).includes(os.tipo)) {
                              toast.error(`A equipe ${equipe.codigo} não possui a habilidade necessária para ${obterLabelTipo(os.tipo)}`);
                              return;
                            }
                            
                            const novasRotas = rotas.map(r => {
                              if (r.equipe.id === equipeEditando) {
                                const novoServico: RotaServico = {
                                  tipo: "SERVICO",
                                  ordemServico: os,
                                  ordemNaRota: r.servicos.length + 1,
                                  tempoDeslocamento: 0,
                                  distancia: 0,
                                  tempoTotal: 0,
                                  horaInicio: "",
                                  horaFim: "",
                                  eta: "",
                                };
                                const novosServicos = [...r.servicos, novoServico];
                                const rotaAtualizada = { ...r, servicos: novosServicos };
                                return recalcularRota(rotaAtualizada).rota;
                              }
                              return r;
                            });
                            
                            setRotas(novasRotas);
                            setOsSelecionadaNoMapa(null);
                            toast.success(`OS ${os.numero} adicionada à rota`);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Incluir OS
                        </Button>
                      </div>
                    )}

                    {/* Lista de OSs com Drag and Drop - Duas Colunas */}
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">
                        Sequência de OSs (arraste para reordenar):
                      </div>
                      <Droppable droppableId={`equipe-${rotaEditando.equipe.id}`}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex flex-col gap-0.5 min-h-[200px] flex-1 overflow-y-auto pr-1",
                              snapshot.isDraggingOver && "bg-primary/5 rounded-lg p-2"
                            )}
                          >
                            {servicosComAlmoco.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                <p>Nenhuma OS nesta rota</p>
                                <p className="text-xs mt-1">Arraste OSs do backlog ou clique em uma OS no mapa</p>
                              </div>
                            ) : (
                              servicosComAlmoco.map((servico, index) => {
                                // Se for ALMOCO, renderizar item especial
                                if (servico.tipo === 'ALMOCO') {
                                        return (
                                    <Draggable
                                      key={`almoco-${servico.horaInicio}`}
                                      draggableId={`almoco-${servico.horaInicio}`}
                                      index={index}
                                      isDragDisabled={true}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className={cn(
                                            "flex items-center gap-1.5 px-1.5 py-1 rounded border bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 transition-all text-xs",
                                            snapshot.isDragging && "shadow-lg ring-2 ring-primary z-50"
                                          )}
                                        >
                                          <div className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs bg-amber-500">
                                            🍽️
                                          </div>
                                          <span className="font-medium text-foreground">ALMOÇO</span>
                                          {servico.horaInicio && servico.horaFim && (
                                            <span className="text-muted-foreground">
                                              {servico.horaInicio} - {servico.horaFim}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                }
                                
                                // Se for SERVICO, renderizar normalmente
                                const os = servico.ordemServico!;
                                const foraDoPrazo = estaForaDoPrazo(os, servico.horaFim);
                                const estaEmAndamento = osEmAndamento?.has(os.id) || false;
                                      
                                      return (
                                        <Draggable
                                    key={os.id}
                                    draggableId={os.id}
                                          index={index}
                                        >
                                          {(provided, snapshot) => (
                                            <div
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              {...provided.dragHandleProps}
                                              data-os-id={os.id}
                                              onClick={(e) => {
                                                // Não selecionar se estiver editando posição
                                                if (osEditandoPosicao !== os.id) {
                                                  setFocarOSNoMapa(true); // Centralizar mapa pois o clique veio do Editor
                                                  setOsSelecionadaNoEditor(os.id);
                                                }
                                              }}
                                              className={cn(
                                                "group flex items-center gap-1.5 px-1.5 py-1 rounded border bg-card transition-all text-xs",
                                                snapshot.isDragging && "shadow-lg ring-2 ring-primary z-50 cursor-grabbing",
                                                !snapshot.isDragging && "hover:bg-muted/50 cursor-grab",
                                                foraDoPrazo && "border-danger/50 bg-danger/5",
                                                osSelecionadaNoEditor === os.id && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950",
                                                estaEmAndamento && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700"
                                              )}
                                            >
                                              {/* Número da ordem */}
                                              {osEditandoPosicao === os.id ? (
                                                <Input
                                                  type="number"
                                                  min={1}
                                                  max={servicosComAlmoco.filter(s => s.tipo === 'SERVICO').length}
                                                  value={novaPosicaoInput}
                                                  onChange={(e) => setNovaPosicaoInput(e.target.value)}
                                                  onBlur={() => {
                                                    const novaPos = parseInt(novaPosicaoInput);
                                                    const totalOSs = servicosComAlmoco.filter(s => s.tipo === 'SERVICO').length;
                                                    if (!isNaN(novaPos) && novaPos >= 1 && novaPos <= totalOSs) {
                                                      const servicosComAlmocoAtual = rotaEditando.servicos.filter(s => (s.tipo === 'SERVICO' && s.ordemServico) || s.tipo === 'ALMOCO');
                                                      const indiceAtual = servicosComAlmocoAtual.findIndex(s => s.tipo === 'SERVICO' && s.ordemServico?.id === os.id);
                                                      const osIndexAtual = servicosComAlmocoAtual.slice(0, indiceAtual).filter(s => s.tipo === 'SERVICO').length + 1;
                                                      if (osIndexAtual !== novaPos) {
                                                        const indiceRealAtual = rotaEditando.servicos.findIndex(s => s.tipo === 'SERVICO' && s.ordemServico?.id === os.id);
                                                        const servicosValidos = servicosComAlmocoAtual.filter(s => s.tipo === 'SERVICO');
                                                        let indiceRealDestino: number;
                                                        if (novaPos === 1) {
                                                          const primeiraOS = servicosValidos[0];
                                                          indiceRealDestino = primeiraOS && primeiraOS.ordemServico?.id !== os.id
                                                            ? rotaEditando.servicos.findIndex(s => s.tipo === 'SERVICO' && s.ordemServico?.id === primeiraOS.ordemServico?.id)
                                                            : 0;
                                                        } else if (novaPos > servicosValidos.length) {
                                                          indiceRealDestino = rotaEditando.servicos.length;
                                                        } else {
                                                          const servicosValidosSemAtual = servicosComAlmocoAtual.filter(s => s.tipo === 'SERVICO' && s.ordemServico?.id !== os.id);
                                                          if (novaPos - 1 >= servicosValidosSemAtual.length) {
                                                            indiceRealDestino = rotaEditando.servicos.length;
                                                          } else {
                                                            const servicoNaPosicaoDesejada = servicosValidosSemAtual[novaPos - 1];
                                                            indiceRealDestino = servicoNaPosicaoDesejada
                                                              ? rotaEditando.servicos.findIndex(s => s.tipo === 'SERVICO' && s.ordemServico?.id === servicoNaPosicaoDesejada.ordemServico?.id)
                                                              : rotaEditando.servicos.length;
                                                            if (indiceRealDestino === -1) indiceRealDestino = rotaEditando.servicos.length;
                                                          }
                                                        }
                                                        if (indiceRealAtual !== -1 && indiceRealDestino !== -1) {
                                                          const novasRotas = rotas.map(r => {
                                                            if (r.equipe.id === equipeEditando) {
                                                              const novosServicos = [...r.servicos];
                                                              const [removido] = novosServicos.splice(indiceRealAtual, 1);
                                                              const indiceDestinoAjustado = indiceRealAtual < indiceRealDestino ? indiceRealDestino - 1 : indiceRealDestino;
                                                              novosServicos.splice(indiceDestinoAjustado, 0, removido);
                                                              return recalcularRota({ ...r, servicos: novosServicos }).rota;
                                                            }
                                                            return r;
                                                          });
                                                          setRotas(novasRotas);
                                                          toast.success(`OS ${os.numero} movida para posição ${novaPos}`);
                                                        }
                                                      }
                                                    }
                                                    setOsEditandoPosicao(null);
                                                    setNovaPosicaoInput("");
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') e.currentTarget.blur();
                                                    else if (e.key === 'Escape') { setOsEditandoPosicao(null); setNovaPosicaoInput(""); }
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="h-5 w-8 text-xs p-0 text-center flex-shrink-0"
                                                  autoFocus
                                                />
                                              ) : (
                                                <div
                                                  onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    setOsEditandoPosicao(os.id);
                                                    setNovaPosicaoInput((servicosComAlmoco.slice(0, index).filter(s => s.tipo === 'SERVICO').length + 1).toString());
                                                  }}
                                                  className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                                  style={{ backgroundColor: cor }}
                                                  title="Duplo clique para editar posição"
                                                >
                                                  {servicosComAlmoco.slice(0, index).filter(s => s.tipo === 'SERVICO').length + 1}
                                                </div>
                                              )}

                                              {/* Número OS */}
                                              <span className="font-mono font-semibold flex-shrink-0">{os.numero}</span>
                                              {os.regulada && <Zap className="h-3 w-3 text-danger flex-shrink-0" />}

                                              {/* Tipo */}
                                              <span className="text-muted-foreground truncate max-w-[80px] flex-shrink-0" title={os.tipo}>{os.tipo}</span>

                                              {/* Horário */}
                                              <span className="text-muted-foreground flex-shrink-0">
                                                {servico.horaInicio}{servico.horaFim && `-${servico.horaFim}`}
                                              </span>

                                              {/* Endereço */}
                                              <div className="flex-1 min-w-0 flex items-center gap-0.5 text-muted-foreground">
                                                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                                <span className="truncate">{os.endereco}</span>
                                              </div>

                                              {/* Badges */}
                                              {estaEmAndamento && (
                                                <Badge className="bg-green-500 hover:bg-green-600 text-[8px] px-1 py-0 h-4">
                                                  ANDANDO
                                                </Badge>
                                              )}
                                              {foraDoPrazo && (
                                                <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4">
                                                  FORA
                                                </Badge>
                                              )}

                                              {/* Botões de Ação */}
                                              <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {index > 0 && servico.tipo === 'SERVICO' && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-4 w-4 p-0"
                                              title="Mover para cima"
                                              onClick={() => {
                                                const novasRotas = rotas.map(r => {
                                                  if (r.equipe.id === equipeEditando) {
                                                    const novosServicos = [...r.servicos];
                                                    // Encontrar o índice real no array de serviços
                                                    const servicosComAlmocoAtual = r.servicos.filter(s => (s.tipo === 'SERVICO' && s.ordemServico) || s.tipo === 'ALMOCO');
                                                    const servicoAtual = servicosComAlmocoAtual[index];
                                                    const indiceReal = r.servicos.findIndex(s => 
                                                      s.tipo === 'SERVICO' && s.ordemServico?.id === servico.ordemServico?.id
                                                    );
                                                    const indiceAnterior = r.servicos.findIndex(s => 
                                                      servicosComAlmocoAtual[index - 1].tipo === 'ALMOCO'
                                                        ? (s.tipo === 'ALMOCO' && s.horaInicio === servicosComAlmocoAtual[index - 1].horaInicio)
                                                        : (s.tipo === 'SERVICO' && s.ordemServico?.id === servicosComAlmocoAtual[index - 1].ordemServico?.id)
                                                    );
                                                    if (indiceReal >= 0 && indiceAnterior >= 0) {
                                                      novosServicos[indiceReal] = novosServicos[indiceAnterior];
                                                      novosServicos[indiceAnterior] = servicoAtual;
                                                    }
                                                    const rotaAtualizada = { ...r, servicos: novosServicos };
                                                    return recalcularRota(rotaAtualizada).rota;
                                                  }
                                                  return r;
                                                });
                                                setRotas(novasRotas);
                                              }}
                                            >
                                              <ArrowUp className="h-2.5 w-2.5" />
                                            </Button>
                                          )}
                                          {index < servicosComAlmoco.length - 1 && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-4 w-4 p-0"
                                              title="Mover para baixo"
                                              onClick={() => {
                                                const novasRotas = rotas.map(r => {
                                                  if (r.equipe.id === equipeEditando) {
                                                    const novosServicos = [...r.servicos];
                                                    // Encontrar o índice real no array de serviços
                                                    const servicosComAlmocoAtual = r.servicos.filter(s => (s.tipo === 'SERVICO' && s.ordemServico) || s.tipo === 'ALMOCO');
                                                    const servicoAtual = servicosComAlmocoAtual[index];
                                                    const indiceReal = r.servicos.findIndex(s => 
                                                      servico.tipo === 'ALMOCO' 
                                                        ? (s.tipo === 'ALMOCO' && s.horaInicio === servico.horaInicio)
                                                        : (s.tipo === 'SERVICO' && s.ordemServico?.id === servico.ordemServico?.id)
                                                    );
                                                    const indiceProximo = r.servicos.findIndex(s => 
                                                      servicosComAlmocoAtual[index + 1].tipo === 'ALMOCO'
                                                        ? (s.tipo === 'ALMOCO' && s.horaInicio === servicosComAlmocoAtual[index + 1].horaInicio)
                                                        : (s.tipo === 'SERVICO' && s.ordemServico?.id === servicosComAlmocoAtual[index + 1].ordemServico?.id)
                                                    );
                                                    if (indiceReal >= 0 && indiceProximo >= 0) {
                                                      novosServicos[indiceReal] = novosServicos[indiceProximo];
                                                      novosServicos[indiceProximo] = servicoAtual;
                                                    }
                                                    const rotaAtualizada = { ...r, servicos: novosServicos };
                                                    return recalcularRota(rotaAtualizada).rota;
                                                  }
                                                  return r;
                                                });
                                                setRotas(novasRotas);
                                              }}
                                            >
                                              <ArrowDown className="h-2.5 w-2.5" />
                                            </Button>
                                          )}
                                          {servico.tipo === 'SERVICO' && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 w-4 p-0 text-destructive hover:text-destructive"
                                            title="Remover da rota"
                                            onClick={() => {
                                              const novasRotas = rotas.map(r => {
                                                if (r.equipe.id === equipeEditando) {
                                                  const novosServicos = r.servicos.filter((_, i) => i !== index);
                                                  const rotaAtualizada = { ...r, servicos: novosServicos };
                                                  return recalcularRota(rotaAtualizada).rota;
                                                }
                                                return r;
                                              });
                                              setRotas(novasRotas);
                                              toast.success(`OS ${os.numero} removida`);
                                            }}
                                          >
                                            <X className="h-2.5 w-2.5" />
                                          </Button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                    );
                              })
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

      {/* Footer Summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="text-muted-foreground">Alocados:</span>
              <span className="font-semibold text-foreground">
                {totalAlocados}/{totalServicos} ({((totalAlocados / totalServicos) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-danger" />
              <span className="text-muted-foreground">Reguladas:</span>
              <span className="font-semibold text-foreground">
                {totalReguladasAlocadas}/{totalReguladas} (
                {totalReguladas > 0
                  ? ((totalReguladasAlocadas / totalReguladas) * 100).toFixed(1)
                  : 0}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              <span className="text-muted-foreground">Km total:</span>
              <span className="font-semibold text-foreground">
                {totalKm.toFixed(1)} km
              </span>
            </div>
          </div>

          {totalServicos - totalAlocados > 0 && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <span>⚠️ {totalServicos - totalAlocados} serviços não alocados</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={handleSalvarRascunho}
              disabled={rotas.length === 0 || salvandoPlanejamento || !podeEditar}
              title={!podeEditar ? "Você não tem permissão para salvar" : undefined}
            >
              {salvandoPlanejamento ? "Salvando..." : "Salvar Rascunho"}
            </Button>
            <Button 
              className="gap-2" 
              disabled={rotas.length === 0 || salvandoPlanejamento || !podeEditar}
              onClick={() => {
                // Definir data padrão como hoje
                const hoje = new Date().toISOString().split('T')[0];
                setDataPlanejamento(hoje);
                setConfirmarPlanejamentoDialogOpen(true);
              }}
              title={!podeEditar ? "Você não tem permissão para confirmar rotas" : undefined}
            >
              <CheckCircle className="h-4 w-4" />
              Confirmar Rotas
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setConsultarPlanejamentosDialogOpen(true);
                handleConsultarPlanejamentos();
              }}
            >
              <Eye className="h-4 w-4" />
              Consultar Planejamentos
            </Button>
          </div>
        </div>
      </div>

        {/* Backlog de Serviços */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Backlog de Serviços</h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {loadingOrdens ? (
                    loadingProgress.total > 0 
                      ? `${loadingProgress.loaded.toLocaleString()}/${loadingProgress.total.toLocaleString()}`
                      : "..."
                  ) : (
                    filteredServicos.length !== osPendentesTodas.length 
                      ? `${filteredServicos.length.toLocaleString()} de ${osPendentesTodas.length.toLocaleString()}`
                      : osPendentesTodas.length.toLocaleString()
                  )}
                </Badge>
              </div>
            </div>
            
            {/* Linha de busca e botão de filtros */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar OS, endereço..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant={showFiltersBacklog ? "default" : "outline"} 
                className="gap-2"
                onClick={() => setShowFiltersBacklog(!showFiltersBacklog)}
              >
                <Filter className="h-4 w-4" />
                Filtros
                {activeFiltersBacklogCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {activeFiltersBacklogCount}
                  </Badge>
                )}
                {showFiltersBacklog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              {activeFiltersBacklogCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFiltersBacklog} className="text-muted-foreground">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Painel de filtros avançados */}
            {showFiltersBacklog && (
              <div className="pt-3 border-t border-border/50">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Tipo de Serviço - Multi-select com busca */}
                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <label className="text-xs font-medium">Tipo de Serviço</label>
                    <Popover open={tiposFilterOpen} onOpenChange={setTiposFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={tiposFilterOpen}
                          className="w-full h-9 justify-between text-left font-normal"
                        >
                          {tiposFilter.length === 0 ? (
                            <span>Todos os tipos</span>
                          ) : tiposFilter.length === 1 ? (
                            <span className="truncate">{obterLabelTipo(tiposFilter[0])}</span>
                          ) : (
                            <span className="truncate">{tiposFilter.length} tipos selecionados</span>
                          )}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar tipo de serviço..." />
                          <CommandList>
                            <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                            <CommandGroup>
                              {/* Opção para limpar seleção */}
                              {tiposFilter.length > 0 && (
                                <CommandItem
                                  onSelect={() => setTiposFilter([])}
                                  className="text-muted-foreground"
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Limpar seleção
                                </CommandItem>
                              )}
                              {tiposDisponiveis.map((tipo) => {
                                const isSelected = tiposFilter.includes(tipo);
                                return (
                                  <CommandItem
                                    key={tipo}
                                    value={obterLabelTipo(tipo)}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setTiposFilter(tiposFilter.filter(t => t !== tipo));
                                      } else {
                                        setTiposFilter([...tiposFilter, tipo]);
                                      }
                                    }}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      className="mr-2"
                                    />
                                    {obterLabelTipo(tipo)}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Contrato - Multi-select com busca */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Contrato</label>
                    <Popover open={contratosFilterOpen} onOpenChange={setContratosFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={contratosFilterOpen}
                          className="w-full h-9 justify-between text-left font-normal"
                        >
                          {contratosFilter.length === 0 ? (
                            <span>Todos</span>
                          ) : contratosFilter.length === 1 ? (
                            <span className="truncate">{contratosFilter[0]}</span>
                          ) : (
                            <span className="truncate">{contratosFilter.length} selecionados</span>
                          )}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[250px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar contrato..." />
                          <CommandList>
                            <CommandEmpty>Nenhum contrato encontrado.</CommandEmpty>
                            <CommandGroup>
                              {contratosFilter.length > 0 && (
                                <CommandItem onSelect={() => setContratosFilter([])} className="text-muted-foreground">
                                  <X className="mr-2 h-4 w-4" />
                                  Limpar seleção
                                </CommandItem>
                              )}
                              {contratosDisponiveis.map((contrato) => {
                                const isSelected = contratosFilter.includes(contrato.codigo);
                                return (
                                  <CommandItem
                                    key={contrato.codigo}
                                    value={`${contrato.codigo} ${contrato.nome}`}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setContratosFilter(contratosFilter.filter(c => c !== contrato.codigo));
                                      } else {
                                        setContratosFilter([...contratosFilter, contrato.codigo]);
                                      }
                                    }}
                                  >
                                    <Checkbox checked={isSelected} className="mr-2" />
                                    <span className="font-mono text-xs mr-2">{contrato.codigo}</span>
                                    <span className="truncate">{contrato.nome}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Centro de Custo - Multi-select com busca */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Centro de Custo</label>
                    <Popover open={centrosCustoFilterOpen} onOpenChange={setCentrosCustoFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={centrosCustoFilterOpen}
                          className="w-full h-9 justify-between text-left font-normal"
                        >
                          {centrosCustoFilter.length === 0 ? (
                            <span>Todos</span>
                          ) : centrosCustoFilter.length === 1 ? (
                            <span className="truncate">{centrosCustoFilter[0]}</span>
                          ) : (
                            <span className="truncate">{centrosCustoFilter.length} selecionados</span>
                          )}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[250px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar centro de custo..." />
                          <CommandList>
                            <CommandEmpty>Nenhum centro de custo encontrado.</CommandEmpty>
                            <CommandGroup>
                              {centrosCustoFilter.length > 0 && (
                                <CommandItem onSelect={() => setCentrosCustoFilter([])} className="text-muted-foreground">
                                  <X className="mr-2 h-4 w-4" />
                                  Limpar seleção
                                </CommandItem>
                              )}
                              {centrosCustoDisponiveis.map((centro) => {
                                const isSelected = centrosCustoFilter.includes(centro.codigo);
                                return (
                                  <CommandItem
                                    key={centro.codigo}
                                    value={`${centro.codigo} ${centro.nome}`}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setCentrosCustoFilter(centrosCustoFilter.filter(c => c !== centro.codigo));
                                      } else {
                                        setCentrosCustoFilter([...centrosCustoFilter, centro.codigo]);
                                      }
                                    }}
                                  >
                                    <Checkbox checked={isSelected} className="mr-2" />
                                    <span className="font-mono text-xs mr-2">{centro.codigo}</span>
                                    <span className="truncate">{centro.nome}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Município - Multi-select com busca */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Município</label>
                    <Popover open={municipiosFilterOpen} onOpenChange={setMunicipiosFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={municipiosFilterOpen}
                          className="w-full h-9 justify-between text-left font-normal"
                        >
                          {municipiosFilter.length === 0 ? (
                            <span>Todos</span>
                          ) : municipiosFilter.length === 1 ? (
                            <span className="truncate">{municipiosFilter[0]}</span>
                          ) : (
                            <span className="truncate">{municipiosFilter.length} selecionados</span>
                          )}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[250px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar município..." />
                          <CommandList>
                            <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                            <CommandGroup>
                              {municipiosFilter.length > 0 && (
                                <CommandItem onSelect={() => setMunicipiosFilter([])} className="text-muted-foreground">
                                  <X className="mr-2 h-4 w-4" />
                                  Limpar seleção
                                </CommandItem>
                              )}
                              {municipiosDisponiveis.map((municipio) => {
                                const isSelected = municipiosFilter.includes(municipio);
                                return (
                                  <CommandItem
                                    key={municipio}
                                    value={municipio}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setMunicipiosFilter(municipiosFilter.filter(m => m !== municipio));
                                      } else {
                                        setMunicipiosFilter([...municipiosFilter, municipio]);
                                      }
                                    }}
                                  >
                                    <Checkbox checked={isSelected} className="mr-2" />
                                    {municipio}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Bairro - Multi-select com busca */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Bairro</label>
                    <Popover open={bairrosFilterOpen} onOpenChange={setBairrosFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={bairrosFilterOpen}
                          className="w-full h-9 justify-between text-left font-normal"
                        >
                          {bairrosFilter.length === 0 ? (
                            <span>Todos</span>
                          ) : bairrosFilter.length === 1 ? (
                            <span className="truncate">{bairrosFilter[0]}</span>
                          ) : (
                            <span className="truncate">{bairrosFilter.length} selecionados</span>
                          )}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[250px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar bairro..." />
                          <CommandList>
                            <CommandEmpty>Nenhum bairro encontrado.</CommandEmpty>
                            <CommandGroup>
                              {bairrosFilter.length > 0 && (
                                <CommandItem onSelect={() => setBairrosFilter([])} className="text-muted-foreground">
                                  <X className="mr-2 h-4 w-4" />
                                  Limpar seleção
                                </CommandItem>
                              )}
                              {bairrosDisponiveis.map((bairro) => {
                                const isSelected = bairrosFilter.includes(bairro);
                                return (
                                  <CommandItem
                                    key={bairro}
                                    value={bairro}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setBairrosFilter(bairrosFilter.filter(b => b !== bairro));
                                      } else {
                                        setBairrosFilter([...bairrosFilter, bairro]);
                                      }
                                    }}
                                  >
                                    <Checkbox checked={isSelected} className="mr-2" />
                                    {bairro}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Status - Multi-select com busca */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Status</label>
                    <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={statusFilterOpen}
                          className="w-full h-9 justify-between text-left font-normal"
                        >
                          {statusFilter.length === 0 ? (
                            <span>Todos</span>
                          ) : statusFilter.length === 1 ? (
                            <span className="truncate">{statusFilter[0]}</span>
                          ) : (
                            <span className="truncate">{statusFilter.length} selecionados</span>
                          )}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar status..." />
                          <CommandList>
                            <CommandEmpty>Nenhum status encontrado.</CommandEmpty>
                            <CommandGroup>
                              {statusFilter.length > 0 && (
                                <CommandItem onSelect={() => setStatusFilter([])} className="text-muted-foreground">
                                  <X className="mr-2 h-4 w-4" />
                                  Limpar seleção
                                </CommandItem>
                              )}
                              {statusDisponiveis.map((status) => {
                                const isSelected = statusFilter.includes(status);
                                return (
                                  <CommandItem
                                    key={status}
                                    value={status}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setStatusFilter(statusFilter.filter(s => s !== status));
                                      } else {
                                        setStatusFilter([...statusFilter, status]);
                                      }
                                    }}
                                  >
                                    <Checkbox checked={isSelected} className="mr-2" />
                                    {status}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Grupo de Serviço - Multi-select */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Grupo de Serviço</label>
                    <Popover open={gruposFilterOpen} onOpenChange={setGruposFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-9 text-left font-normal"
                        >
                          <span className="truncate">
                            {gruposFilter.length === 0
                              ? "Todos"
                              : gruposFilter.length === 1
                              ? gruposFilter[0]
                              : `${gruposFilter.length} selecionados`}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar grupo..." />
                          <CommandList>
                            <CommandEmpty>Nenhum grupo encontrado.</CommandEmpty>
                            <CommandGroup>
                              {gruposFilter.length > 0 && (
                                <CommandItem
                                  onSelect={() => setGruposFilter([])}
                                  className="text-muted-foreground"
                                >
                                  Limpar seleção
                                </CommandItem>
                              )}
                              {gruposDisponiveis.map((grupo) => {
                                const isSelected = gruposFilter.includes(grupo);
                                return (
                                  <CommandItem
                                    key={grupo}
                                    value={grupo}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setGruposFilter(gruposFilter.filter(g => g !== grupo));
                                      } else {
                                        setGruposFilter([...gruposFilter, grupo]);
                                      }
                                    }}
                                  >
                                    <Checkbox checked={isSelected} className="mr-2" />
                                    {grupo}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Territórios - Multi-select */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Territórios</label>
                    <Popover open={territoriosFilterOpen} onOpenChange={setTerritoriosFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-9 text-left font-normal"
                        >
                          <span className="truncate">
                            {territoriosFilter.length === 0
                              ? "Todos"
                              : territoriosFilter.length === 1
                              ? territoriosDisponiveis.find(t => t.id === territoriosFilter[0])?.nome || "1 selecionado"
                              : `${territoriosFilter.length} selecionados`}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar território..." />
                          <CommandList>
                            <CommandEmpty>Nenhum território encontrado.</CommandEmpty>
                            <CommandGroup>
                              {territoriosFilter.length > 0 && (
                                <CommandItem
                                  onSelect={() => setTerritoriosFilter([])}
                                  className="text-muted-foreground"
                                >
                                  Limpar seleção
                                </CommandItem>
                              )}
                              {territoriosDisponiveis.map((territorio) => {
                                const isSelected = territoriosFilter.includes(territorio.id);
                                return (
                                  <CommandItem
                                    key={territorio.id}
                                    value={territorio.nome}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setTerritoriosFilter(territoriosFilter.filter(t => t !== territorio.id));
                                      } else {
                                        setTerritoriosFilter([...territoriosFilter, territorio.id]);
                                      }
                                    }}
                                  >
                                    <Checkbox checked={isSelected} className="mr-2" />
                                    <span 
                                      className="w-3 h-3 rounded-full mr-2" 
                                      style={{ backgroundColor: territorio.cor }}
                                    />
                                    {territorio.nome}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Regulada */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Regulada
                    </label>
                    <Select value={reguladaFilter} onValueChange={setReguladaFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="sim">Apenas Reguladas</SelectItem>
                        <SelectItem value="nao">Apenas Não Reguladas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Coordenadas */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Coordenadas
                    </label>
                    <Select value={coordenadasFilter} onValueChange={setCoordenadasFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="com">Com Coordenadas</SelectItem>
                        <SelectItem value="sem">Sem Coordenadas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Linha de filtros por data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-border/50">
                  {/* Data de Prazo */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Data de Prazo
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={prazoInicio}
                        onChange={(e) => setPrazoInicio(e.target.value)}
                        className="h-9"
                        placeholder="De"
                      />
                      <span className="text-muted-foreground text-sm">até</span>
                      <Input
                        type="date"
                        value={prazoFim}
                        onChange={(e) => setPrazoFim(e.target.value)}
                        className="h-9"
                        placeholder="Até"
                      />
                    </div>
                  </div>

                  {/* Resumo dos filtros + Botão Copiar */}
                  <div className="flex items-center justify-end gap-2">
                    {activeFiltersBacklogCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {activeFiltersBacklogCount} filtro{activeFiltersBacklogCount > 1 ? "s" : ""} ativo{activeFiltersBacklogCount > 1 ? "s" : ""}
                        {filteredServicos.length !== osPendentesTodas.length && (
                          <span className="ml-1">
                            • Exibindo {filteredServicos.length} de {osPendentesTodas.length} OSs
                          </span>
                        )}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        // Copiar todos os dados das OSs filtradas (com e sem coordenadas)
                        const todasOSsFiltradas = [...filteredServicos, ...osSemCoordenadas];
                        const header = "Número\tTipo\tStatus\tEndereço\tBairro\tMunicípio\tPrazo\tTempo Exec.\tValor\tRegulada\tLatitude\tLongitude\tContrato\tCentro Custo";
                        const rows = todasOSsFiltradas.map(os => {
                          return [
                            os.numero,
                            obterLabelTipo(os.tipo),
                            os.status || "",
                            os.endereco,
                            os.bairro || "",
                            os.municipio || "",
                            os.prazo ? new Date(os.prazo).toLocaleString("pt-BR") : "",
                            os.tempoExecucao || "",
                            os.valor || "",
                            os.regulada ? "Sim" : "Não",
                            os.latitude !== null ? os.latitude : "",
                            os.longitude !== null ? os.longitude : "",
                            os.contrato_codigo || "",
                            os.centro_custo_codigo || ""
                          ].join("\t");
                        });
                        const texto = header + "\n" + rows.join("\n");
                        navigator.clipboard.writeText(texto).then(() => {
                          toast.success(`${todasOSsFiltradas.length} OSs copiadas para a área de transferência! (${filteredServicos.length} com coords + ${osSemCoordenadas.length} sem coords)`);
                        }).catch(() => {
                          toast.error("Erro ao copiar");
                        });
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar {filteredServicos.length + osSemCoordenadas.length} OSs
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* OSs com Coordenadas Suspeitas - Bairro não bate com território */}
            {osCoordenadasSuspeitas.length > 0 && (
              <div className="mt-3 rounded-lg border-2 border-purple-500/50 bg-purple-500/5 overflow-hidden">
                <div className="p-2 border-b border-purple-500/30 bg-purple-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-purple-500" />
                      <span className="font-semibold text-sm text-purple-700 dark:text-purple-400">OSs com Coordenadas Suspeitas</span>
                      <Badge variant="outline" className="border-purple-500 text-purple-600 dark:text-purple-400 h-5 text-xs">
                        {osCoordenadasSuspeitas.length}
                      </Badge>
                    </div>
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      ⚠️ Bairro não corresponde ao território
                    </span>
                  </div>
                </div>
                <div className="p-2 max-h-[180px] overflow-y-auto">
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    {osCoordenadasSuspeitas.slice(0, 40).map((os) => {
                      const nomeServico = obterLabelTipo(os.tipo);
                      
                      return (
                        <div
                          key={os.id}
                          className={cn(
                            "p-1.5 rounded border cursor-pointer hover:bg-muted/50 transition-colors select-text",
                            os.regulada 
                              ? "border-purple-400/50 bg-purple-500/10" 
                              : "border-purple-300/30 bg-purple-500/5"
                          )}
                          onDoubleClick={() => handleAbrirEditarCoords(os)}
                          title={`Duplo clique para editar coordenadas\nBairro: ${os.bairro}\nTerritório esperado: ${os.territorioEsperado}\nTerritório atual: ${os.territorioReal}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-mono font-semibold truncate text-[10px]">{os.numero}</span>
                            {os.regulada && (
                              <Badge variant="destructive" className="h-3.5 px-1 text-[8px]">REG</Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground truncate text-[9px]" title={nomeServico}>
                            {nomeServico}
                          </div>
                          <div className="text-purple-600 dark:text-purple-400 truncate text-[9px]">
                            📍 Bairro: {os.bairro}
                          </div>
                          <div className="text-[8px] mt-0.5">
                            <span className="text-green-600">Esperado: {os.territorioEsperado}</span>
                          </div>
                          <div className="text-[8px]">
                            <span className="text-red-500">Atual: {os.territorioReal}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {osCoordenadasSuspeitas.length > 40 && (
                    <div className="text-center py-1 text-xs text-purple-600">
                      ... e mais {osCoordenadasSuspeitas.length - 40} OSs com coordenadas suspeitas
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OSs Sem Coordenadas - Entre filtros e tabela */}
            {osSemCoordenadas.length > 0 && (
              <div className="mt-3 rounded-lg border-2 border-amber-500/50 bg-amber-500/5 overflow-hidden">
                <div className="p-2 border-b border-amber-500/30 bg-amber-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-sm text-amber-700 dark:text-amber-400">OSs Sem Coordenadas</span>
                      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 h-5 text-xs">
                        {osSemCoordenadas.length}
                      </Badge>
                    </div>
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Não serão roteirizadas
                    </span>
                  </div>
                </div>
                <div className="p-2 max-h-[180px] overflow-y-auto">
                  <div className="grid grid-cols-5 gap-1 text-xs">
                    {osSemCoordenadas.slice(0, 50).map((os) => {
                      const nomeServico = obterLabelTipo(os.tipo);
                      const prazoInfo = os.prazo ? formatarDataPrazo(new Date(os.prazo)) : null;
                      
                      return (
                        <div
                          key={os.id}
                          className={cn(
                            "p-1.5 rounded border cursor-pointer hover:bg-muted/50 transition-colors select-text",
                            os.regulada 
                              ? "border-red-400/50 bg-red-500/10" 
                              : "border-border bg-card"
                          )}
                          onDoubleClick={() => handleAbrirEditarCoords(os)}
                          title="Duplo clique para editar coordenadas"
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-mono font-semibold truncate text-[10px]">{os.numero}</span>
                            {os.regulada && (
                              <Badge variant="destructive" className="h-3.5 px-1 text-[8px]">REG</Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground truncate text-[9px]" title={nomeServico}>
                            {nomeServico}
                          </div>
                          {os.prazo && (
                            <div className={cn(
                              "text-[9px] truncate",
                              os.regulada && prazoInfo && (prazoInfo.includes("Vencid") || prazoInfo.includes("HOJE")) ? "text-red-500 font-medium" : "text-muted-foreground"
                            )}>
                              ⏰ {new Date(os.prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {new Date(os.prazo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              {os.regulada && prazoInfo && ` (${prazoInfo})`}
                            </div>
                          )}
                          <div className="text-muted-foreground truncate text-[8px] mt-0.5" title={os.endereco}>
                            📍 {os.endereco.substring(0, 20)}...
                          </div>
                          {(os.bairro || os.municipio) && (
                            <div className="text-muted-foreground/70 truncate text-[7px]">
                              {os.bairro}{os.bairro && os.municipio && ' - '}{os.municipio}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {osSemCoordenadas.length > 50 && (
                    <div className="text-center py-1 text-xs text-amber-600">
                      ... e mais {osSemCoordenadas.length - 50} OSs sem coordenadas
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Droppable droppableId="backlog">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "max-h-[400px] overflow-y-auto p-2 space-y-2",
                snapshot.isDraggingOver && "bg-primary/5"
              )}
            >
              {loadingOrdens ? (
                <div className="text-center py-8 space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground">
                    Carregando serviços...
                  </p>
                  {loadingProgress.total > 0 && (
                    <div className="px-4">
                      <Progress value={(loadingProgress.loaded / loadingProgress.total) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {loadingProgress.loaded.toLocaleString()} de {loadingProgress.total.toLocaleString()} ({Math.round((loadingProgress.loaded / loadingProgress.total) * 100)}%)
                      </p>
                    </div>
                  )}
                </div>
              ) : !hasAnyFilter ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="text-sm font-medium mb-2">🔍 Aplique um filtro para visualizar as OSs</div>
                  <div className="text-xs">
                    São {osPendentesTodas.length.toLocaleString()} OSs pendentes. Use os filtros acima para selecionar quais deseja visualizar.
                  </div>
                </div>
              ) : filteredServicos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma OS encontrada com os filtros aplicados
                </div>
              ) : (
                <>
                {/* Grid de 5 colunas compacto - sem drag and drop */}
                <div className="grid grid-cols-5 gap-1 select-text">
                  {filteredServicos.slice(0, backlogLimit).map((servico) => {
                    const motivoNaoAlocada = naoAlocadas[servico.id];
                    return (
                      <div
                        key={servico.id}
                        onDoubleClick={() => handleAbrirEditarCoords(servico)}
                        className={cn(
                          "p-1.5 rounded border cursor-pointer transition-all hover:bg-muted/50 hover:shadow-sm",
                          servico.regulada ? "border-danger/40 bg-danger/5" : "border-border/50 bg-card"
                        )}
                        title="Duplo clique para editar coordenadas"
                      >
                        {/* Linha 1: Número + Indicadores */}
                        <div className="flex items-center gap-0.5 mb-0.5">
                          {servico.regulada && <Zap className="h-2.5 w-2.5 text-danger flex-shrink-0" />}
                          <span className="font-semibold text-[10px] text-foreground truncate">{servico.numero}</span>
                          {motivoNaoAlocada && (
                            <span className="text-[7px] text-orange-500 truncate" title={motivoNaoAlocada}>⚠</span>
                          )}
                        </div>
                        
                        {/* Linha 2: Tipo */}
                        <div className="mb-0.5">
                          <Badge
                            variant={servico.regulada ? "regulada" : "secondary"}
                            className="text-[8px] px-1 py-0 h-3.5 truncate max-w-full"
                          >
                            {obterLabelTipo(servico.tipo)}
                          </Badge>
                        </div>
                        
                        {/* Linha 3: Endereço */}
                        <div className="flex items-center gap-0.5 text-[8px] text-muted-foreground mb-0.5">
                          <MapPin className="h-2 w-2 flex-shrink-0" />
                          <span className="truncate" title={servico.endereco}>{servico.endereco}</span>
                        </div>
                        
                        {/* Linha 4: Bairro/Município */}
                        {(servico.bairro || servico.municipio) && (
                          <div className="text-[7px] text-muted-foreground/70 truncate mb-0.5">
                            {servico.bairro}{servico.bairro && servico.municipio && " - "}{servico.municipio}
                          </div>
                        )}
                        
                        {/* Linha 5: Prazo + Valor */}
                        <div className="flex items-center justify-between text-[8px]">
                          <span className="text-muted-foreground">
                            {servico.prazo 
                              ? `${new Date(servico.prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${new Date(servico.prazo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                              : "-"
                            }
                          </span>
                          <span className="text-success font-medium">R${servico.valor}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {filteredServicos.length > backlogLimit && (
                  <div className="text-center py-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBacklogLimit(prev => prev + 100)}
                      className="w-full"
                    >
                      Carregar mais ({Math.min(100, filteredServicos.length - backlogLimit)} de {filteredServicos.length - backlogLimit} restantes)
                    </Button>
                  </div>
                )}
                </>
              )}
              {provided.placeholder}
            </div>
          )}
          </Droppable>
        </div>
      </DragDropContext>

      {/* Seção de Seleção de Cenário por Território - Movida para baixo */}
      {opcoesRoteiros.length > 0 && usarTerritorios && territoriosSelecionados.length > 0 && (
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground">Cenários por Território</h4>
            <Badge variant="outline" className="text-xs">
              {territoriosSelecionados.length} território(s)
            </Badge>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {territoriosSelecionados.map(territorioId => {
              const territorio = territorios.find(t => t.id === territorioId);
              if (!territorio) return null;
              
              const opcaoAtual = selecaoIndividualTerritorios.get(territorioId) || opcaoRoteiroSelecionada || opcoesRoteiros[0].id;
              const opcaoSelecionada = opcoesRoteiros.find(o => o.id === opcaoAtual);
              
              return (
                <div key={territorioId} className="flex items-center justify-between p-2 bg-background rounded border border-border">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div 
                      className="h-3 w-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: territorio.cor }}
                      title={territorio.nome}
                    />
                    <span className="text-sm font-medium truncate">{territorio.nome}</span>
                  </div>
                  <Select
                    value={opcaoAtual}
                    onValueChange={(value) => {
                      const novaSelecao = new Map(selecaoIndividualTerritorios);
                      novaSelecao.set(territorioId, value);
                      setSelecaoIndividualTerritorios(novaSelecao);
                      
                      // Combinar rotas: pegar rotas de todas as equipes de todos os territórios baseado na seleção
                      const rotasCombinadas: RotaEquipe[] = [];
                      const todasOSsAlocadas = new Set<string>();
                      const equipesProcessadas = new Set<string>();
                      
                      // Para cada território, pegar as rotas da opção selecionada
                      territoriosSelecionados.forEach(tId => {
                        const t = territorios.find(tt => tt.id === tId);
                        if (!t) return;
                        
                        const opcaoTerritorio = novaSelecao.get(tId) || opcoesRoteiros[0].id;
                        const opcao = opcoesRoteiros.find(o => o.id === opcaoTerritorio);
                        if (!opcao) return;
                        
                        // Pegar rotas das equipes deste território
                        const equipesT = t.equipeIds || [];
                        opcao.rotas.forEach(rota => {
                          if (equipesT.includes(rota.equipe.id) && !equipesProcessadas.has(rota.equipe.id)) {
                            rotasCombinadas.push(rota);
                            equipesProcessadas.add(rota.equipe.id);
                            rota.servicos.forEach(s => {
                              if (s.tipo === 'SERVICO' && s.ordemServico) {
                                todasOSsAlocadas.add(s.ordemServico.id);
                              }
                            });
                          }
                        });
                      });
                      
                      // Adicionar não alocadas (usar da primeira opção como base)
                      const naoAlocadasCombinadas: Record<string, string> = {};
                      opcoesRoteiros[0].naoAlocadas.forEach(item => {
                        if (!todasOSsAlocadas.has(item.os.id)) {
                          naoAlocadasCombinadas[item.os.id] = item.motivo;
                        }
                      });
                      
                      setRotas(rotasCombinadas);
                      setNaoAlocadas(naoAlocadasCombinadas);
                      
                      toast.success(`Território "${territorio.nome}" agora usa "${opcaoSelecionada?.nome || 'opção'}"`);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesRoteiros.map((opcao) => (
                        <SelectItem key={opcao.id} value={opcao.id}>
                          {opcao.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog de Expectativa de Equipes */}
      <ExpectativaEquipesDialog
        open={expectativaDialogOpen}
        onOpenChange={setExpectativaDialogOpen}
        expectativas={expectativas}
        territorios={territorios}
        equipes={equipes}
      />

      {/* Dialog de Seleção de Territórios */}
      <SelecaoTerritoriosDialog
        open={selecaoTerritoriosDialogOpen}
        onOpenChange={setSelecaoTerritoriosDialogOpen}
        territorios={territorios}
        equipes={equipes}
        territoriosSelecionados={territoriosSelecionados}
        onTerritoriosChange={setTerritoriosSelecionados}
        onTerritoriosUpdate={(territoriosAtualizados) => {
          setTerritorios(territoriosAtualizados);
        }}
      />

      {/* Dialog de Seleção de Opções de Roteiro */}
      <SelecaoOpcoesRoteiroDialog
        open={mostrarOpcoesDialog}
        onOpenChange={setMostrarOpcoesDialog}
        opcoes={opcoesRoteiros}
        opcaoSelecionada={opcaoRoteiroSelecionada}
        selecaoIndividualEquipes={selecaoIndividualTerritorios}
        onSelecionarOpcao={(opcaoId) => {
          const opcao = opcoesRoteiros.find(o => o.id === opcaoId);
          if (opcao) {
            setOpcaoRoteiroSelecionada(opcaoId);
            // Atualizar todos os territórios para usar esta opção
            const novaSelecao = new Map<string, string>();
            territoriosSelecionados.forEach(territorioId => {
              novaSelecao.set(territorioId, opcaoId);
            });
            setSelecaoIndividualTerritorios(novaSelecao);
            
            // Se usar territórios, filtrar apenas rotas dos territórios selecionados
            let rotasParaExibir = opcao.rotas;
            if (usarTerritorios && territoriosSelecionados.length > 0) {
              const equipesDosTerritorios = new Set<string>();
              territoriosSelecionados.forEach(territorioId => {
                const territorio = territorios.find(t => t.id === territorioId);
                if (territorio && territorio.equipeIds) {
                  territorio.equipeIds.forEach(equipeId => equipesDosTerritorios.add(equipeId));
                }
              });
              rotasParaExibir = opcao.rotas.filter(rota => equipesDosTerritorios.has(rota.equipe.id));
            }
            
            setRotas(rotasParaExibir);
            const mapaNaoAlocadas = opcao.naoAlocadas.reduce((acc, item) => {
              acc[item.os.id] = item.motivo;
              return acc;
            }, {} as Record<string, string>);
            setNaoAlocadas(mapaNaoAlocadas);
            toast.success(`Roteiro "${opcao.nome}" selecionado para todos os territórios!`);
          }
        }}
        onSelecionarOpcaoEquipe={(equipeId, opcaoId) => {
          // Esta função não é mais usada (mantida para compatibilidade)
          // A seleção agora é feita por território na seção "Cenários por Território"
        }}
      />

      {/* Dialog de Seleção de Serviços */}
      <Dialog open={selecaoServicosDialogOpen} onOpenChange={setSelecaoServicosDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar Tipos de Serviços</DialogTitle>
            <DialogDescription>
              Selecione quais tipos de serviços serão considerados no planejamento. 
              Você pode definir um prazo limite para cada tipo (opcional).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {todosTiposDisponiveis.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum tipo de serviço encontrado.</p>
                <p className="text-xs mt-2">Carregue ordens de serviço primeiro.</p>
              </div>
            ) : (
              todosTiposDisponiveis.map((tipo) => {
                const filtro = filtrosTiposServicos.get(tipo) || {
                  tipo,
                  considerar: true,
                  prazoLimite: "",
                };
                
                return (
                  <div
                    key={tipo}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Switch
                        checked={filtro.considerar}
                        onCheckedChange={(checked) => {
                          const novosFiltros = new Map(filtrosTiposServicos);
                          novosFiltros.set(tipo, {
                            ...filtro,
                            considerar: checked,
                          });
                          setFiltrosTiposServicos(novosFiltros);
                        }}
                      />
                      <Label className="font-medium min-w-[150px] cursor-pointer" htmlFor={`tipo-${tipo}`}>
                        {obterLabelTipo(tipo)}
                      </Label>
                    </div>
                    
                    <div className="flex-1">
                      <Label htmlFor={`prazo-${tipo}`} className="text-xs text-muted-foreground mb-1 block">
                        Prazo Limite (opcional)
                      </Label>
                      <Input
                        id={`prazo-${tipo}`}
                        type="datetime-local"
                        value={filtro.prazoLimite}
                        onChange={(e) => {
                          const novosFiltros = new Map(filtrosTiposServicos);
                          novosFiltros.set(tipo, {
                            ...filtro,
                            prazoLimite: e.target.value,
                          });
                          setFiltrosTiposServicos(novosFiltros);
                        }}
                        disabled={!filtro.considerar}
                        className="w-full"
                        placeholder="Deixe em branco para aceitar qualquer prazo"
                      />
                      {filtro.prazoLimite && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Apenas OSs com prazo até {new Date(filtro.prazoLimite).toLocaleString('pt-BR')} serão consideradas
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                // Resetar para padrão: todos selecionados, sem prazo
                const filtrosPadrao = new Map<string, FiltroTipoServico>();
                todosTiposDisponiveis.forEach(tipo => {
                  filtrosPadrao.set(tipo, {
                    tipo,
                    considerar: true,
                    prazoLimite: "",
                  });
                });
                setFiltrosTiposServicos(filtrosPadrao);
              }}
            >
              Restaurar Padrão
            </Button>
            <Button onClick={() => setSelecaoServicosDialogOpen(false)}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Planejamento */}
      <Dialog open={confirmarPlanejamentoDialogOpen} onOpenChange={setConfirmarPlanejamentoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Planejamento de Rotas</DialogTitle>
            <DialogDescription>
              Selecione a data para a qual este planejamento será realizado. 
              As OSs serão marcadas como "Planejadas" e associadas às equipes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="data-planejamento">Data do Planejamento</Label>
              <Input
                id="data-planejamento"
                type="date"
                value={dataPlanejamento}
                onChange={(e) => setDataPlanejamento(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="mt-2"
              />
            </div>
            
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="text-sm font-medium mb-2">Resumo do Planejamento:</div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>• {rotas.length} equipe(s)</div>
                <div>• {rotas.reduce((acc, r) => acc + r.servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico).length, 0)} ordem(ns) de serviço</div>
                <div>• {rotas.reduce((acc, r) => acc + r.distanciaTotal, 0).toFixed(1)} km total</div>
                <div>• R$ {rotas.reduce((acc, r) => acc + r.faturamentoTotal, 0).toFixed(2)} faturamento estimado</div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              onClick={handleSalvarPlanejamento}
              disabled={!dataPlanejamento || salvandoPlanejamento}
            >
              {salvandoPlanejamento ? "Salvando..." : "Confirmar Planejamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Consulta de Planejamentos */}
      <Dialog open={consultarPlanejamentosDialogOpen} onOpenChange={setConsultarPlanejamentosDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Consultar Planejamentos</DialogTitle>
            <DialogDescription>
              Consulte e gerencie os planejamentos de rotas em aberto.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Filtros */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="filtro-equipe-consulta">Equipe</Label>
                <Select value={filtroEquipeConsulta} onValueChange={setFiltroEquipeConsulta}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Todas as equipes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as equipes</SelectItem>
                    {equipes.map(equipe => (
                      <SelectItem key={equipe.id} value={equipe.id}>
                        {equipe.codigo} - {equipe.tecnico}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="filtro-data-consulta">Data</Label>
                <Input
                  id="filtro-data-consulta"
                  type="date"
                  value={filtroDataConsulta}
                  onChange={(e) => setFiltroDataConsulta(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            
            <Button
              onClick={handleConsultarPlanejamentos}
              disabled={carregandoPlanejamentos}
              className="w-full"
            >
              {carregandoPlanejamentos ? "Carregando..." : "Buscar Planejamentos"}
            </Button>

            {/* Lista de Planejamentos */}
            {planejamentosEncontrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum planejamento encontrado.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {planejamentosEncontrados.map((planejamento: any) => (
                  <div
                    key={planejamento.id}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold">
                          Planejamento para {(() => {
                          const data = new Date(planejamento.data_planejamento + 'T12:00:00');
                          return data.toLocaleDateString('pt-BR');
                        })()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Criado em {new Date(planejamento.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <Badge variant="secondary">{planejamento.status}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mb-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Equipes</div>
                        <div className="font-semibold">{planejamento.total_equipes}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">OSs</div>
                        <div className="font-semibold">{planejamento.total_ordens}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Distância</div>
                        <div className="font-semibold">{planejamento.distancia_total_km?.toFixed(1)} km</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Faturamento</div>
                        <div className="font-semibold">R$ {planejamento.faturamento_total?.toFixed(2)}</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigate(`/roteirizacao?planejamento=${planejamento.id}`);
                          setConsultarPlanejamentosDialogOpen(false);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Detalhes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelarPlanejamento(planejamento.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setConsultarPlanejamentosDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalhes da OS */}
      <OrdemServicoDetalhesDialog
        open={detalhesOSOpen}
        onOpenChange={setDetalhesOSOpen}
        ordemId={detalhesOSId}
      />
      
      {/* Modal de Edição de Coordenadas */}
      <Dialog open={editarCoordsOpen} onOpenChange={setEditarCoordsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Editar Coordenadas - {editarCoordsOS?.numero}
            </DialogTitle>
          </DialogHeader>
          
          {editarCoordsOS && (
            <div className="space-y-4">
              {/* Informações da OS */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
                <div><strong>Tipo:</strong> {obterLabelTipo(editarCoordsOS.tipo)}</div>
                <div><strong>Endereço:</strong> {editarCoordsOS.endereco}</div>
                {(editarCoordsOS.bairro || editarCoordsOS.municipio) && (
                  <div><strong>Local:</strong> {editarCoordsOS.bairro}{editarCoordsOS.bairro && editarCoordsOS.municipio && ' - '}{editarCoordsOS.municipio}</div>
                )}
                {editarCoordsOS.regulada && (
                  <Badge variant="destructive" className="mt-2">REGULADA</Badge>
                )}
              </div>
              
              {/* Campos de Coordenadas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Latitude</label>
                  <Input
                    type="text"
                    placeholder="-14.86610"
                    value={editarCoordsLat}
                    onChange={(e) => setEditarCoordsLat(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Entre -35 e 5</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Longitude</label>
                  <Input
                    type="text"
                    placeholder="-40.83940"
                    value={editarCoordsLng}
                    onChange={(e) => setEditarCoordsLng(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Entre -75 e -32</p>
                </div>
              </div>
              
              {/* Coordenadas atuais */}
              <div className="text-xs text-muted-foreground">
                <strong>Coordenadas atuais:</strong>{' '}
                {editarCoordsOS.latitude !== null && editarCoordsOS.longitude !== null
                  ? `${editarCoordsOS.latitude}, ${editarCoordsOS.longitude}`
                  : 'Sem coordenadas'}
              </div>
              
              {/* Botão Posicionar no Mapa */}
              <Button
                variant="outline"
                className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                onClick={() => {
                  setEditarCoordsOpen(false);
                  setSelecionandoCoordNoMapa(true);
                  toast.info("Clique no mapa para definir a coordenada da OS", { duration: 5000 });
                }}
              >
                <MapPin className="h-4 w-4" />
                Posicionar no Mapa
              </Button>
              
              {/* Botões */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditarCoordsOpen(false);
                    // Abrir detalhes completos
                    setDetalhesOSId(editarCoordsOS.id);
                    setDetalhesOSOpen(true);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Detalhes
                </Button>
                <Button
                  onClick={handleSalvarCoords}
                  disabled={salvandoCoords}
                >
                  {salvandoCoords ? "Salvando..." : "Salvar Coordenadas"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Modal de Parâmetros de Roteirização */}
      <Dialog open={parametrosModalOpen} onOpenChange={setParametrosModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Parâmetros de Roteirização
            </DialogTitle>
            <DialogDescription>
              Ajuste os parâmetros para simular diferentes cenários de roteirização.
              Os valores de referência (padrão) são exibidos ao lado de cada campo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Seção: Velocidade e Tempo */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                Velocidade e Tempo
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">{PARAMETROS_DESCRICOES.velocidadeMediaKmh.nome}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={parametros.velocidadeMediaKmh}
                      onChange={(e) => setParametros({ ...parametros, velocidadeMediaKmh: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Ref: {PARAMETROS_PADRAO.velocidadeMediaKmh} {PARAMETROS_DESCRICOES.velocidadeMediaKmh.unidade}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{PARAMETROS_DESCRICOES.velocidadeMediaKmh.descricao}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">{PARAMETROS_DESCRICOES.tempoMedioDeslocamentoMin.nome}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={parametros.tempoMedioDeslocamentoMin}
                      onChange={(e) => setParametros({ ...parametros, tempoMedioDeslocamentoMin: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Ref: {PARAMETROS_PADRAO.tempoMedioDeslocamentoMin} {PARAMETROS_DESCRICOES.tempoMedioDeslocamentoMin.unidade}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{PARAMETROS_DESCRICOES.tempoMedioDeslocamentoMin.descricao}</p>
                </div>
              </div>
            </div>
            
            {/* Seção: Distâncias Máximas */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                Distâncias Máximas (km)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  'distanciaMaximaEmergenciaKm',
                  'distanciaMaximaZonaKm',
                  'distanciaMaximaNormalKm',
                  'distanciaMaximaBalanceamentoKm',
                  'distanciaMaximaSaturacaoKm',
                  'distanciaConsolidacaoKm',
                  'distanciaMaximaReguladaUrgenteKm',
                  'distanciaMaximaReguladaGlobalKm',
                  'distanciaMaximaTerritorioKm',
                ].map((key) => {
                  const k = key as keyof ParametrosRoteirizacao;
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm">{PARAMETROS_DESCRICOES[k].nome}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          value={parametros[k]}
                          onChange={(e) => setParametros({ ...parametros, [k]: Number(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Ref: {PARAMETROS_PADRAO[k]} {PARAMETROS_DESCRICOES[k].unidade}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{PARAMETROS_DESCRICOES[k].descricao}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Seção: Raios Rurais */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                Raios Rurais
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {['raioRuralKm', 'raioRuralReguladaKm'].map((key) => {
                  const k = key as keyof ParametrosRoteirizacao;
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm">{PARAMETROS_DESCRICOES[k].nome}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={parametros[k]}
                          onChange={(e) => setParametros({ ...parametros, [k]: Number(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Ref: {PARAMETROS_PADRAO[k]} {PARAMETROS_DESCRICOES[k].unidade}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{PARAMETROS_DESCRICOES[k].descricao}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Seção: Limiares */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                Limiares e Limites
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {['thresholdSaturacao', 'atrasoMaximoReguladaHojeMin'].map((key) => {
                  const k = key as keyof ParametrosRoteirizacao;
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm">{PARAMETROS_DESCRICOES[k].nome}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={parametros[k]}
                          onChange={(e) => setParametros({ ...parametros, [k]: Number(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Ref: {PARAMETROS_PADRAO[k]} {PARAMETROS_DESCRICOES[k].unidade}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{PARAMETROS_DESCRICOES[k].descricao}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Seção: Otimização Genética */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                Algoritmo Genético
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {['populacaoGenetica', 'geracoesGenetica', 'taxaMutacao'].map((key) => {
                  const k = key as keyof ParametrosRoteirizacao;
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm">{PARAMETROS_DESCRICOES[k].nome}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step={k === 'taxaMutacao' ? '0.1' : '1'}
                          value={parametros[k]}
                          onChange={(e) => setParametros({ ...parametros, [k]: Number(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Ref: {PARAMETROS_PADRAO[k]} {PARAMETROS_DESCRICOES[k].unidade}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{PARAMETROS_DESCRICOES[k].descricao}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Seção: Iterações */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                Limites de Iteração
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {['maxIteracoes2opt', 'maxIteracoes3opt', 'maxIteracoesLK', 'maxTentativasRemocao'].map((key) => {
                  const k = key as keyof ParametrosRoteirizacao;
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm">{PARAMETROS_DESCRICOES[k].nome}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={parametros[k]}
                          onChange={(e) => setParametros({ ...parametros, [k]: Number(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Ref: {PARAMETROS_PADRAO[k]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{PARAMETROS_DESCRICOES[k].descricao}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setParametros({ ...PARAMETROS_PADRAO })}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar Padrão
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setParametrosModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setParametrosModalOpen(false);
                  toast.success("Parâmetros atualizados! Clique em 'Otimizar Rotas' para aplicar.");
                }}
              >
                Aplicar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Criação de Território */}
      <Dialog open={criarTerritorioOpen} onOpenChange={(open) => {
        if (!open && !salvandoTerritorio) {
          setCriarTerritorioOpen(false);
          setNovoPoligono(null);
          setNovoTerritorioNome("");
          setNovoTerritorioCor("#3b82f6");
          setNovoTerritorioEquipes([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              Novo Território
            </DialogTitle>
            <DialogDescription>
              Configure os dados do novo território criado no mapa.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Preview do polígono */}
            {novoPoligono && (
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-sm text-green-700 dark:text-green-300">
                  ✓ Polígono criado com {novoPoligono.length} vértices
                </div>
              </div>
            )}
            
            {/* Nome do território */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Território *</label>
              <Input
                placeholder="Ex: Zona Norte, Região Central..."
                value={novoTerritorioNome}
                onChange={(e) => setNovoTerritorioNome(e.target.value)}
              />
            </div>
            
            {/* Cor do território */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cor</label>
              {/* Paleta de cores predefinidas */}
              <div className="grid grid-cols-8 gap-1.5 max-h-[100px] overflow-y-auto border rounded-lg p-2">
                {CORES_TERRITORIOS.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setNovoTerritorioCor(cor)}
                    className={cn(
                      "w-6 h-6 rounded border-2 transition-all",
                      novoTerritorioCor === cor 
                        ? "border-foreground scale-110 ring-2 ring-offset-1 ring-blue-500" 
                        : "border-muted hover:border-foreground hover:scale-105"
                    )}
                    style={{ backgroundColor: cor }}
                    title={cor}
                  />
                ))}
              </div>
              {/* Input de cor personalizada */}
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={novoTerritorioCor}
                  onChange={(e) => setNovoTerritorioCor(e.target.value)}
                  className="h-8 w-12 p-0.5 cursor-pointer border border-border rounded bg-background"
                  title="Selecione uma cor personalizada"
                />
                <Input
                  placeholder="#3b82f6"
                  value={novoTerritorioCor}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                      setNovoTerritorioCor(value || "#3b82f6");
                    }
                  }}
                  className="flex-1 h-8 text-sm"
                />
                <div
                  className="w-10 h-8 rounded border border-border flex-shrink-0"
                  style={{ backgroundColor: novoTerritorioCor }}
                  title="Preview da cor"
                />
              </div>
            </div>
            
            {/* Equipes vinculadas */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipes Vinculadas</label>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {equipes.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-2">
                    Nenhuma equipe disponível
                  </p>
                ) : (
                  equipes.map((equipe) => {
                    const estaSelecionada = novoTerritorioEquipes.includes(equipe.id);
                    return (
                      <label
                        key={equipe.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={estaSelecionada}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNovoTerritorioEquipes([...novoTerritorioEquipes, equipe.id]);
                            } else {
                              setNovoTerritorioEquipes(novoTerritorioEquipes.filter(id => id !== equipe.id));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{equipe.codigo} - {equipe.tecnico}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {novoTerritorioEquipes.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  {novoTerritorioEquipes.length} equipe(s) selecionada(s)
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCriarTerritorioOpen(false);
                setNovoPoligono(null);
                setNovoTerritorioNome("");
                setNovoTerritorioCor("#3b82f6");
                setNovoTerritorioEquipes([]);
              }}
              disabled={salvandoTerritorio}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarNovoTerritorio}
              disabled={salvandoTerritorio || !novoTerritorioNome.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {salvandoTerritorio ? "Salvando..." : "Criar Território"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Roteirizacao;
