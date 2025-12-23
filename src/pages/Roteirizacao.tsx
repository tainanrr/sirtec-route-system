import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
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
  Trash2,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
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
} from "@/lib/routingUtils";
import { getDadosSkills } from "@/lib/skillsUtils";
import { tecnicosParaEquipes } from "@/lib/equipeUtils";
import { mapSupabaseOrdensServicoToOrdemServico } from "@/lib/ordemServicoUtils";
import type { Tables } from "@/integrations/supabase/types";
import MapaLeaflet from "./components/MapaLeaflet";
import { carregarTerritorios, salvarTerritorios, Territorio, pontoNoPoligono } from "@/types/territorios";
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
import ExpectativaEquipesDialog from "./components/ExpectativaEquipesDialog";
import SelecaoTerritoriosDialog from "./components/SelecaoTerritoriosDialog";
import SelecaoOpcoesRoteiroDialog from "./components/SelecaoOpcoesRoteiroDialog";

const tipoLabels: Record<string, string> = {
  // Formato do banco (minúsculas, sem acento)
  corte: "Corte",
  religa: "Religa",
  ligacao: "Ligação Nova",
  inspecao: "Inspeção",
  inspeção: "Inspeção",
  manutencao: "Manutenção",
  manutenção: "Manutenção",
  troca_medidor: "Troca de Medidor",
  // Formato normalizado (maiúsculas, com acento)
  CORTE: "Corte",
  RELIGA: "Religa",
  LIGAÇÃO: "Ligação Nova",
  LIGACAO: "Ligação Nova", // Variação sem acento em maiúsculas
  INSPEÇÃO: "Inspeção",
  INSPECAO: "Inspeção", // Variação sem acento em maiúsculas
  MANUTENÇÃO: "Manutenção",
  MANUTENCAO: "Manutenção", // Variação sem acento em maiúsculas
  TROCA_MEDIDOR: "Troca de Medidor",
};

/**
 * Obtém o label formatado para um tipo de OS
 */
function obterLabelTipo(tipo: string): string {
  // Tentar primeiro com o tipo exato
  if (tipoLabels[tipo]) return tipoLabels[tipo];
  
  // Tentar com lowercase
  const tipoLower = tipo.toLowerCase();
  if (tipoLabels[tipoLower]) return tipoLabels[tipoLower];
  
  // Tentar com uppercase
  const tipoUpper = tipo.toUpperCase();
  if (tipoLabels[tipoUpper]) return tipoLabels[tipoUpper];
  
  // Fallback: retornar o tipo original
  return tipo;
}

const Roteirizacao = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [rotas, setRotas] = useState<RotaEquipe[]>([]);
  const [isOtimizando, setIsOtimizando] = useState(false);
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

  // Carregar equipes do Supabase
  useEffect(() => {
    const fetchEquipes = async () => {
      setLoadingEquipes(true);
      try {
        const { data, error } = await supabase
          .from("tecnicos")
          .select("*")
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

  // Carregar territórios do Supabase
  useEffect(() => {
    const loadTerritorios = async () => {
      const loaded = await carregarTerritorios();
      setTerritorios(loaded);
      // Marcar todos os territórios ativos por padrão
      const territoriosAtivos = loaded.filter(t => t.ativo && t.equipeIds && t.equipeIds.length > 0);
      if (territoriosAtivos.length > 0) {
        setTerritoriosSelecionados(territoriosAtivos.map(t => t.id));
      }
    };
    loadTerritorios();
  }, []);

  // Carregar ordens de serviço do Supabase
  useEffect(() => {
    const fetchOrdensServico = async () => {
      setLoadingOrdens(true);
      try {
        const { data, error } = await supabase
          .from("ordens_servico")
          .select("*")
          .in("status", ["pendente"]) // Apenas OSs pendentes (não planejadas)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Converter para formato OrdemServico e aplicar dados das skills
        // Isso garante que valores, regulada e tempoExecucao venham das skills
        const ordensConvertidas = await mapSupabaseOrdensServicoToOrdemServico(data || []);
        setOrdensServico(ordensConvertidas);
      } catch (error: any) {
        console.error("Erro ao carregar ordens de serviço:", error);
        toast.error("Erro ao carregar ordens de serviço");
      } finally {
        setLoadingOrdens(false);
      }
    };

    fetchOrdensServico();
    
    // Recarregar quando a página receber foco (para atualizar após editar skills)
    const handleFocus = () => {
      fetchOrdensServico();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Carregar planejamento se houver ID nos parâmetros da URL
  useEffect(() => {
    const planejamentoId = searchParams.get('planejamento');
    if (planejamentoId && rotas.length === 0) {
      handleCarregarPlanejamento(planejamentoId);
    }
  }, [searchParams]);

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

  // Obter tipos únicos de TODAS as OSs (não apenas pendentes) para o filtro
  const todosTiposDisponiveis = useMemo(() => {
    const tipos = new Set(ordensServico.map(os => os.tipo.toLowerCase()));
    return Array.from(tipos).sort();
  }, [ordensServico]);

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
  const tiposDisponiveis = useMemo(() => {
    const tipos = new Set(osPendentes.map(os => os.tipo.toLowerCase()));
    return Array.from(tipos).sort();
  }, [osPendentes]);

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

  const filteredServicos = osPendentes.filter((s) => {
    const matchesSearch =
      s.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.endereco.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = tipoFilter === "all" || s.tipo.toLowerCase() === tipoFilter.toLowerCase();
    return matchesSearch && matchesTipo;
  });

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
      // Obter usuário atual
      console.log("[PLANEJAMENTO] Obtendo usuário...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

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
      console.log("[PLANEJAMENTO] Recarregando OSs...");
      const { data: dataOSs } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("status", "pendente") // Apenas OSs pendentes (não planejadas)
        .order("created_at", { ascending: false });
      
      if (dataOSs) {
        const ordensConvertidas = await mapSupabaseOrdensServicoToOrdemServico(dataOSs);
        setOrdensServico(ordensConvertidas);
      }

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
      
      // Recarregar OSs (apenas pendentes, não planejadas)
      const { data: dataOSs } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("status", "pendente") // Apenas OSs pendentes (não planejadas)
        .order("created_at", { ascending: false });
      
      if (dataOSs) {
        const ordensConvertidas = await mapSupabaseOrdensServicoToOrdemServico(dataOSs);
        setOrdensServico(ordensConvertidas);
      }
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

      console.log('[ROTEIRIZAÇÃO] Iniciando otimização com tempos reais de trânsito...');
      const resultado: ResultadoOtimizacao = await otimizarRotas(
        osPendentes, 
        equipesAtivas, 
        usarTerritorios,
        usarTerritorios ? territoriosSelecionados : undefined
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
      console.log('[ROTEIRIZAÇÃO] Otimização concluída');
    } catch (error) {
      console.error("Erro ao otimizar rotas:", error);
      // Em caso de erro, a função otimizarRotas já faz fallback para Haversine
      // Mas vamos tentar novamente para garantir
      try {
        const resultadoFallback = await otimizarRotas(osPendentes, equipesAtivas, usarTerritorios);
        setRotas(resultadoFallback.rotas);
        const mapaNaoAlocadas = resultadoFallback.naoAlocadas.reduce((acc, item) => {
          acc[item.os.id] = item.motivo;
          return acc;
        }, {} as Record<string, string>);
        setNaoAlocadas(mapaNaoAlocadas);
      } catch (fallbackError) {
        console.error("Erro no fallback:", fallbackError);
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
    
    console.log("Total de linhas para exportar:", dadosExportacao.length);
    
    // Criar workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    console.log("Worksheet criado");
    console.log("Worksheet criado");

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
              onClick={handleOtimizarRotas}
              disabled={isOtimizando || osPendentes.length === 0}
              className="gap-2"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Configuração de Territórios */}
          <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="usar-territorios" className="text-sm font-medium text-foreground cursor-pointer">
                  Usar Territórios
                  </Label>
                </div>
                <Switch
                  id="usar-territorios"
                  checked={usarTerritorios}
                  onCheckedChange={setUsarTerritorios}
                />
              </div>
            {usarTerritorios && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-2">
                  {territoriosSelecionados.length} de {territorios.filter(t => t.ativo && t.equipeIds && t.equipeIds.length > 0 && t.poligono.length >= 3).length} selecionados
                </div>
                <div className="space-y-2 max-h-[120px] overflow-y-auto">
                  {territorios.filter(t => t.ativo && t.equipeIds && t.equipeIds.length > 0 && t.poligono.length >= 3).map((territorio) => {
                    const checked = territoriosSelecionados.includes(territorio.id);
                    const equipesVinculadas = territorio.equipeIds
                      .map(id => equipes.find(e => e.id === id))
                      .filter(e => e !== undefined);
                    return (
                      <label key={territorio.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTerritoriosSelecionados((prev) => [...prev, territorio.id]);
                            } else {
                              setTerritoriosSelecionados((prev) => prev.filter((id) => id !== territorio.id));
                            }
                          }}
                          className="h-3 w-3"
                        />
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: territorio.cor }}
                        />
                        <span className="font-medium truncate">{territorio.nome}</span>
                        {equipesVinculadas.length > 0 && (
                          <span className="text-muted-foreground text-[10px] truncate">
                            {equipesVinculadas.map(e => e?.codigo).join(", ")}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const ativos = territorios.filter(t => t.ativo && t.equipeIds && t.equipeIds.length > 0 && t.poligono.length >= 3);
                      if (territoriosSelecionados.length === ativos.length) {
                        setTerritoriosSelecionados([]);
                      } else {
                        setTerritoriosSelecionados(ativos.map(t => t.id));
                      }
                    }}
                    className="flex-1 text-xs h-7"
                  >
                    {territoriosSelecionados.length === territorios.filter(t => t.ativo && t.equipeIds && t.equipeIds.length > 0 && t.poligono.length >= 3).length ? "Desselecionar Todos" : "Selecionar Todos"}
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
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm font-medium mb-3 text-foreground">Equipes</div>
            {loadingEquipes ? (
              <div className="text-xs text-muted-foreground">Carregando...</div>
            ) : equipes.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Nenhuma equipe cadastrada
              </div>
            ) : (
              <div className="space-y-2 max-h-[120px] overflow-y-auto">
                {equipes.map((eq) => {
                  const checked = equipesSelecionadas.includes(eq.id);
                  return (
                    <label key={eq.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer hover:bg-muted/50 p-1 rounded">
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
                        className="h-3 w-3"
                      />
                      <span className="font-medium">{eq.codigo}</span>
                      <span className="text-muted-foreground truncate">{eq.tecnico}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="mt-2 pt-2 border-t">
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

          {/* Estatísticas Rápidas */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm font-medium mb-3 text-foreground">Resumo</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">OSs Pendentes:</span>
                <span className="font-medium">{osPendentes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Equipes Selecionadas:</span>
                <span className="font-medium">{equipesSelecionadas.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rotas Geradas:</span>
                <span className="font-medium">{rotas.filter(r => r.servicos.length > 0).length}</span>
              </div>
              {usarTerritorios && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Territórios:</span>
                  <span className="font-medium">{territoriosSelecionados.length}</span>
            </div>
              )}
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
                          {os.latitude.toFixed(5)}, {os.longitude.toFixed(5)}
                        </div>
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
              <MapaLeaflet
                rotas={rotas}
                osPendentes={osPendentesTodas}
                equipesMock={equipesAtivas}
                equipeHovered={equipeHovered}
                equipeEditando={equipeEditando}
                osSelecionada={osSelecionadaNoMapa}
                osSelecionadaNoEditor={osSelecionadaNoEditor}
                onOSSelecionada={setOsSelecionadaNoMapa}
                osUrgenteDestaque={osUrgenteSelecionadaNoMapa}
                osUrgentesDestaque={osUrgentesTodasNoMapa}
                onOsUrgenteDestaqueClear={() => {
                  setOsUrgenteSelecionadaNoMapa(null);
                  setOsUrgentesTodasNoMapa([]);
                }}
                key={`mapa-${rotas.length}-${equipeEditando || 'none'}`}
                territorios={mostrarTerritoriosNoMapa
                  ? (usarTerritorios && territoriosSelecionados.length > 0
                      ? territorios.filter(t => territoriosSelecionados.includes(t.id))
                      : territorios)
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
                    }
                  }
                }}
              />

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
          <div className="lg:col-span-4 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
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
                            {osPendentes.find(os => os.id === osSelecionadaNoMapa)?.numero || osSelecionadaNoMapa}
                          </Badge>
                        </div>
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => {
                            const os = osPendentes.find(os => os.id === osSelecionadaNoMapa);
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
                              "grid grid-cols-4 gap-1 min-h-[200px]",
                              snapshot.isDraggingOver && "bg-primary/5 rounded-lg p-2"
                            )}
                          >
                            {servicosComAlmoco.length === 0 ? (
                              <div className="col-span-4 text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
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
                                            "group flex items-center gap-1 p-1 rounded border bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 transition-all",
                                            snapshot.isDragging && "shadow-lg ring-2 ring-primary z-50"
                                          )}
                                        >
                                          {/* Ícone de Almoço */}
                                          <div
                                            className="flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white bg-amber-500"
                                          >
                                            🍽️
                                          </div>

                                          {/* Informações do Almoço */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-0.5">
                                              <span className="font-medium text-[9px] text-foreground">Almoço</span>
                                              {servico.horaInicio && servico.horaFim && (
                                                <span className="text-[8px] text-muted-foreground">
                                                  {servico.horaInicio} - {servico.horaFim}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                }
                                
                                // Se for SERVICO, renderizar normalmente
                                const os = servico.ordemServico!;
                                const foraDoPrazo = estaForaDoPrazo(os, servico.horaFim);
                                      
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
                                              onClick={(e) => {
                                                // Não selecionar se estiver editando posição
                                                if (osEditandoPosicao !== os.id) {
                                                  setOsSelecionadaNoEditor(os.id);
                                                }
                                              }}
                                              className={cn(
                                                "group flex flex-col gap-0.5 p-1 rounded border bg-card transition-all",
                                                snapshot.isDragging && "shadow-lg ring-2 ring-primary z-50 cursor-grabbing",
                                                !snapshot.isDragging && "hover:bg-muted/50 cursor-grab",
                                                foraDoPrazo && "border-danger/50 bg-danger/5",
                                                osSelecionadaNoEditor === os.id && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950"
                                              )}
                                            >
                                              {/* Linha superior: Número da ordem */}
                                              <div className="flex items-center gap-0.5">
                                                {/* Número da ordem - Clicável para editar posição */}
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
                                                        // Encontrar índice atual da OS na lista completa
                                                        const servicosComAlmocoAtual = rotaEditando.servicos.filter(s => (s.tipo === 'SERVICO' && s.ordemServico) || s.tipo === 'ALMOCO');
                                                        const indiceAtual = servicosComAlmocoAtual.findIndex(s => s.tipo === 'SERVICO' && s.ordemServico?.id === os.id);
                                                        
                                                        // Calcular posição atual (considerando apenas OSs)
                                                        const osIndexAtual = servicosComAlmocoAtual.slice(0, indiceAtual).filter(s => s.tipo === 'SERVICO').length + 1;
                                                        
                                                        if (osIndexAtual !== novaPos) {
                                                          // Encontrar índice real no array completo
                                                          const indiceRealAtual = rotaEditando.servicos.findIndex(s => s.tipo === 'SERVICO' && s.ordemServico?.id === os.id);
                                                          
                                                          // Encontrar onde colocar a OS para que ela fique na posição novaPos (considerando apenas OSs)
                                                          // novaPos é 1-indexed: posição 1, 2, 3, 4, 5...
                                                          // Estratégia: contar quantas OSs devem vir ANTES da posição novaPos
                                                          // Se queremos posição 5, precisamos que 4 OSs venham antes (posições 1-4)
                                                          
                                                          const servicosValidos = servicosComAlmocoAtual.filter(s => s.tipo === 'SERVICO');
                                                          
                                                          let indiceRealDestino: number;
                                                          
                                                          if (novaPos === 1) {
                                                            // Colocar na primeira posição: antes da primeira OS
                                                            const primeiraOS = servicosValidos[0];
                                                            if (primeiraOS && primeiraOS.ordemServico?.id !== os.id) {
                                                              indiceRealDestino = rotaEditando.servicos.findIndex(s => 
                                                                s.tipo === 'SERVICO' && s.ordemServico?.id === primeiraOS.ordemServico?.id
                                                              );
                                                            } else {
                                                              // Se a primeira OS é a atual ou não existe, colocar no início
                                                              indiceRealDestino = 0;
                                                            }
                                                          } else if (novaPos > servicosValidos.length) {
                                                            // Colocar após a última OS: no final do array
                                                            indiceRealDestino = rotaEditando.servicos.length;
                                                          } else {
                                                            // Para colocar na posição novaPos (1-indexed), precisamos que (novaPos - 1) OSs venham antes
                                                            // Exemplo: para posição 5, precisamos que 4 OSs venham antes
                                                            // Estratégia: encontrar onde colocar no array completo para que, após a inserção,
                                                            // exatamente (novaPos - 1) OSs venham antes da nossa OS
                                                            const servicosValidos = servicosComAlmocoAtual.filter(s => s.tipo === 'SERVICO' && s.ordemServico?.id !== os.id);
                                                            
                                                            if (novaPos - 1 >= servicosValidos.length) {
                                                              // Colocar no final: após todas as outras OSs
                                                              indiceRealDestino = rotaEditando.servicos.length;
                                                            } else {
                                                              // Encontrar a OS que deve ficar na posição novaPos após a inserção
                                                              // Isso é a OS que está atualmente na posição novaPos (considerando apenas outras OSs)
                                                              const servicoNaPosicaoDesejada = servicosValidos[novaPos - 1];
                                                              
                                                              if (servicoNaPosicaoDesejada) {
                                                                // Encontrar o índice dessa OS no array completo
                                                                indiceRealDestino = rotaEditando.servicos.findIndex(s => 
                                                                  s.tipo === 'SERVICO' && s.ordemServico?.id === servicoNaPosicaoDesejada.ordemServico?.id
                                                                );
                                                                
                                                                if (indiceRealDestino === -1) {
                                                                  indiceRealDestino = rotaEditando.servicos.length;
                                                                }
                                                              } else {
                                                                indiceRealDestino = rotaEditando.servicos.length;
                                                              }
                                                            }
                                                          }
                                                            
                                                          if (indiceRealAtual !== -1 && indiceRealDestino !== -1) {
                                                            const novasRotas = rotas.map(r => {
                                                              if (r.equipe.id === equipeEditando) {
                                                                const novosServicos = [...r.servicos];
                                                                const [removido] = novosServicos.splice(indiceRealAtual, 1);
                                                                // Ajustar índice de destino se necessário
                                                                // Se estamos movendo para frente (índice atual < destino), 
                                                                // o destino diminui em 1 porque removemos um elemento antes dele
                                                                const indiceDestinoAjustado = indiceRealAtual < indiceRealDestino 
                                                                  ? indiceRealDestino - 1 
                                                                  : indiceRealDestino;
                                                                novosServicos.splice(indiceDestinoAjustado, 0, removido);
                                                                const rotaAtualizada = { ...r, servicos: novosServicos };
                                                                return recalcularRota(rotaAtualizada).rota;
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
                                                      if (e.key === 'Enter') {
                                                        e.currentTarget.blur();
                                                      } else if (e.key === 'Escape') {
                                                        setOsEditandoPosicao(null);
                                                        setNovaPosicaoInput("");
                                                      }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="h-4 w-8 text-[8px] p-0 text-center"
                                                    autoFocus
                                                  />
                                                ) : (
                                                  <div
                                                    onDoubleClick={(e) => {
                                                      e.stopPropagation();
                                                      setOsEditandoPosicao(os.id);
                                                      const posicaoAtual = servicosComAlmoco.slice(0, index).filter(s => s.tipo === 'SERVICO').length + 1;
                                                      setNovaPosicaoInput(posicaoAtual.toString());
                                                    }}
                                                    className="flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity"
                                                    style={{ backgroundColor: cor }}
                                                    title="Arraste para mover ou duplo clique para editar posição"
                                                  >
                                                    {servicosComAlmoco.slice(0, index).filter(s => s.tipo === 'SERVICO').length + 1}
                                                  </div>
                                                )}

                                                {/* Informações da OS */}
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-0.5">
                                                    <span className="font-medium text-[9px] text-foreground truncate">{os.numero}</span>
                                                    {os.regulada && <Zap className="h-2 w-2 text-danger flex-shrink-0" />}
                                                    {foraDoPrazo && (
                                                      <Badge variant="destructive" className="text-[7px] px-0.5 py-0">
                                                        FORA
                                                      </Badge>
                                                    )}
                                                  </div>
                                                  {servico.horaInicio && (
                                                    <div className="text-[8px] text-muted-foreground">
                                                      {servico.horaInicio} - {servico.horaFim}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Linha inferior: Endereço */}
                                              <div className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
                                                <MapPin className="h-1.5 w-1.5 flex-shrink-0" />
                                                <span className="truncate">{os.endereco}</span>
                                              </div>

                                              {/* Botões de Ação */}
                                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                          {index > 0 && servico.tipo === 'SERVICO' && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-5 w-5 p-0"
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
                                              <ArrowUp className="h-3 w-3" />
                                            </Button>
                                          )}
                                          {index < servicosComAlmoco.length - 1 && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-5 w-5 p-0"
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
                                              <ArrowDown className="h-3 w-3" />
                                            </Button>
                                          )}
                                          {servico.tipo === 'SERVICO' && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0 text-destructive hover:text-destructive"
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
                                            <X className="h-3 w-3" />
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
              disabled={rotas.length === 0 || salvandoPlanejamento}
            >
              {salvandoPlanejamento ? "Salvando..." : "Salvar Rascunho"}
            </Button>
            <Button 
              className="gap-2" 
              disabled={rotas.length === 0 || salvandoPlanejamento}
              onClick={() => {
                // Definir data padrão como hoje
                const hoje = new Date().toISOString().split('T')[0];
                setDataPlanejamento(hoje);
                setConfirmarPlanejamentoDialogOpen(true);
              }}
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

        {/* Backlog de Serviços - Movido para o final */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Backlog de Serviços</h3>
            <Badge variant="secondary">{osPendentes.length}</Badge>
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
                {tiposDisponiveis.map((tipo) => {
                  return (
                    <SelectItem key={tipo} value={tipo}>
                      {obterLabelTipo(tipo)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
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
              {filteredServicos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum serviço pendente
                </div>
              ) : (
                filteredServicos.map((servico, index) => {
                  const motivoNaoAlocada = naoAlocadas[servico.id];
                  return (
                    <Draggable key={servico.id} draggableId={servico.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md",
                            servico.regulada
                              ? "border-danger/30 bg-danger/5"
                              : "border-border bg-card",
                            snapshot.isDragging && "shadow-lg ring-2 ring-primary"
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1">
                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              {servico.regulada && <Zap className="h-4 w-4 text-danger" />}
                              <span className="font-medium text-foreground">{servico.numero}</span>
                              <Badge
                                variant={servico.regulada ? "regulada" : "secondary"}
                                className="text-[10px]"
                              >
                                {obterLabelTipo(servico.tipo)}
                              </Badge>
                            </div>
                            {servico.regulada && (
                              <Badge variant="regulada" className="text-[10px]">
                                REGULADA
                              </Badge>
                            )}
                            {motivoNaoAlocada && (
                              <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-500">
                                {motivoNaoAlocada}
                              </Badge>
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
                                  {new Date(servico.prazo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              <span>{servico.tempoExecucao} min</span>
                            </div>
                            <span className="text-success font-medium">R$ {servico.valor}</span>
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
    </MainLayout>
  );
};

export default Roteirizacao;
