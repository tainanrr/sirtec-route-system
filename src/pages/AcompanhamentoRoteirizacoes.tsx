import { useState, useEffect, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTelaPermissao } from "@/hooks/usePermissoes";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Eye,
  Calendar,
  Car,
  MapPin,
  DollarSign,
  Clock,
  Filter,
  Download,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  Trash2,
  FilterX,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
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
import { tecnicosParaEquipes } from "@/lib/equipeUtils";
import type { Equipe } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { OrdemServicoDetalhesDialog } from "@/components/ordens/OrdemServicoDetalhesDialog";
import { getDadosSkills } from "@/lib/skillsUtils";

interface PlanejamentoCompleto {
  id: string;
  data_planejamento: string;
  status: string;
  total_equipes: number;
  total_ordens: number;
  distancia_total_km: number;
  tempo_total_minutos: number;
  faturamento_total: number;
  created_at: string;
  planejamento_ordens?: Array<{
    id: string;
    ordem_na_rota: number;
    distancia_km: number;
    tempo_estimado_minutos: number;
    hora_inicio_estimada: string;
    hora_fim_estimada: string;
    ordem_servico_id: string;
    equipe_id: string;
    ordens_servico?: any;
    tecnicos?: any;
  }>;
}

const AcompanhamentoRoteirizacoes = () => {
  // Permissões da tela
  const { podeEditar } = useTelaPermissao("acompanhamento_rotas");

  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("aberto");
  const [dataInicioFilter, setDataInicioFilter] = useState<string>("");
  const [dataFimFilter, setDataFimFilter] = useState<string>("");
  const [equipeFilter, setEquipeFilter] = useState<string>("all");
  const [planejamentos, setPlanejamentos] = useState<PlanejamentoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [skills, setSkills] = useState<any[]>([]);
  const [cancelarDialogOpen, setCancelarDialogOpen] = useState(false);
  const [cancelarOSDialogOpen, setCancelarOSDialogOpen] = useState(false);
  const [planejamentoParaCancelar, setPlanejamentoParaCancelar] = useState<PlanejamentoCompleto | null>(null);
  const [osParaCancelar, setOsParaCancelar] = useState<{ ordemId: string; osNumero: string; planejamentoId: string } | null>(null);
  const [rotaParaCancelar, setRotaParaCancelar] = useState<{ planejamentoId: string; equipeId: string; dataPlanejamento: string } | null>(null);
  const [cancelarRotaDialogOpen, setCancelarRotaDialogOpen] = useState(false);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [ordemDetalhesId, setOrdemDetalhesId] = useState<string | null>(null);
  const [producaoMap, setProducaoMap] = useState<Record<string, number>>({});

  // Debounce do termo de busca para evitar muitas requisições
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Verificar se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return searchTerm !== "" || 
           statusFilter !== "aberto" || 
           dataInicioFilter !== "" || 
           dataFimFilter !== "" || 
           equipeFilter !== "all";
  }, [searchTerm, statusFilter, dataInicioFilter, dataFimFilter, equipeFilter]);

  // Limpar todos os filtros
  const clearAllFilters = useCallback(() => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setStatusFilter("aberto");
    setDataInicioFilter("");
    setDataFimFilter("");
    setEquipeFilter("all");
  }, []);

  // Carregar equipes e skills
  useEffect(() => {
    const fetchEquipes = async () => {
      try {
        const { data, error } = await supabase
          .from("tecnicos")
          .select("*")
          .order("codigo");

        if (error) throw error;

        const equipesConvertidas = tecnicosParaEquipes(data || []);
        setEquipes(equipesConvertidas);
      } catch (error: any) {
        console.error("Erro ao carregar equipes:", error);
      }
    };

    const fetchSkills = async () => {
      try {
        const { data, error } = await supabase
          .from("skills")
          .select("*")
          .eq("ativo", true);

        if (error) throw error;
        setSkills(data || []);
      } catch (error: any) {
        console.error("Erro ao carregar skills:", error);
      }
    };

    fetchEquipes();
    fetchSkills();
  }, []);

  // Carregar planejamentos
  const fetchPlanejamentos = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("planejamentos")
        .select(`
          *,
          planejamento_ordens (
            id,
            ordem_na_rota,
            distancia_km,
            tempo_estimado_minutos,
            hora_inicio_estimada,
            hora_fim_estimada,
            ordem_servico_id,
            equipe_id,
            ordens_servico:ordem_servico_id (
              numero,
              tipo,
              endereco,
              cliente_nome,
              prazo,
              regulada,
              valor,
              status
            ),
            tecnicos:equipe_id (
              codigo,
              nome
            )
          )
        `)
        .order("data_planejamento", { ascending: false })
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (dataInicioFilter) {
        query = query.gte("data_planejamento", dataInicioFilter);
      }

      if (dataFimFilter) {
        query = query.lte("data_planejamento", dataFimFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar produções para todas as OSs dos planejamentos
      const todasOSIds: string[] = [];
      (data || []).forEach((p: any) => {
        p.planejamento_ordens?.forEach((po: any) => {
          if (po.ordem_servico_id) {
            todasOSIds.push(po.ordem_servico_id);
          }
        });
      });

      // Buscar produções em lotes de 100
      const producaoMapTemp: Record<string, number> = {};
      const chunkSize = 100;
      for (let i = 0; i < todasOSIds.length; i += chunkSize) {
        const chunk = todasOSIds.slice(i, i + chunkSize);
        const { data: producaoData } = await supabase
          .from("producao_equipes")
          .select("ordem_servico_id, valor_total")
          .in("ordem_servico_id", chunk);

        if (producaoData) {
          producaoData.forEach((p: any) => {
            producaoMapTemp[p.ordem_servico_id] = p.valor_total || 0;
          });
        }
      }
      setProducaoMap(producaoMapTemp);

      // Os filtros de equipe e busca são aplicados no getGroupedData() para filtrar as OSs individualmente
      setPlanejamentos((data || []) as PlanejamentoCompleto[]);
    } catch (error: any) {
      console.error("Erro ao carregar planejamentos:", error);
      toast.error("Erro ao carregar planejamentos");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dataInicioFilter, dataFimFilter]);

  useEffect(() => {
    fetchPlanejamentos();
  }, [fetchPlanejamentos]);

  // Função para agrupar dados por equipe e data (aplicando filtros de equipe e busca)
  const getGroupedData = useCallback(() => {
    const grouped = new Map<string, {
      dataPlanejamento: string;
      equipeId: string;
      equipeCodigo: string;
      equipeNome: string;
      planejamentoId: string;
      ordens: any[];
    }>();

    const termoLower = debouncedSearchTerm?.toLowerCase() || "";

    planejamentos.forEach((planejamento) => {
      if (!planejamento.planejamento_ordens) return;

      const ordensPorEquipe = new Map<string, any[]>();
      
      planejamento.planejamento_ordens.forEach((po: any) => {
        const equipeId = po.equipe_id;
        
        // Filtrar por equipe se necessário
        if (equipeFilter !== "all" && equipeId !== equipeFilter) {
          return;
        }
        
        // Filtrar por termo de busca se necessário
        if (termoLower) {
          const os = po.ordens_servico;
          const equipe = po.tecnicos;
          
          const matchesSearch = 
            os?.numero?.toLowerCase().includes(termoLower) ||
            os?.endereco?.toLowerCase().includes(termoLower) ||
            os?.cliente_nome?.toLowerCase().includes(termoLower) ||
            os?.tipo?.toLowerCase().includes(termoLower) ||
            equipe?.codigo?.toLowerCase().includes(termoLower) ||
            equipe?.nome?.toLowerCase().includes(termoLower);
          
          if (!matchesSearch) {
            return;
          }
        }
        
        if (!ordensPorEquipe.has(equipeId)) {
          ordensPorEquipe.set(equipeId, []);
        }
        ordensPorEquipe.get(equipeId)!.push(po);
      });

      ordensPorEquipe.forEach((ordens, equipeId) => {
        if (ordens.length === 0) return;
        
        const primeiraOrdem = ordens[0];
        const equipe = primeiraOrdem.tecnicos;
        const groupKey = `${planejamento.data_planejamento}-${equipeId}`;

        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, {
            dataPlanejamento: planejamento.data_planejamento,
            equipeId,
            equipeCodigo: equipe?.codigo || "-",
            equipeNome: equipe?.nome || "-",
            planejamentoId: planejamento.id,
            ordens: [],
          });
        }

        grouped.get(groupKey)!.ordens.push(...ordens);
      });
    });

    // Converter para array e ordenar por data (mais recente primeiro) e depois por código da equipe
    return Array.from(grouped.values()).sort((a, b) => {
      const dateCompare = new Date(b.dataPlanejamento).getTime() - new Date(a.dataPlanejamento).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.equipeCodigo.localeCompare(b.equipeCodigo);
    });
  }, [planejamentos, equipeFilter, debouncedSearchTerm]);

  // Função para obter total de grupos (baseado nos dados já filtrados)
  const getTotalGroups = useCallback(() => {
    const groupedData = getGroupedData();
    return new Set(groupedData.map(g => `${g.dataPlanejamento}-${g.equipeId}`));
  }, [getGroupedData]);

  // Função para cancelar planejamento
  const handleCancelarPlanejamento = async () => {
    if (!planejamentoParaCancelar || !user) return;

    try {
      // Buscar todas as OSs do planejamento
      const { data: ordensPlanejamento } = await supabase
        .from("planejamento_ordens")
        .select("ordem_servico_id")
        .eq("planejamento_id", planejamentoParaCancelar.id);

      // Atualizar status do planejamento
      const { error: erroUpdate } = await supabase
        .from("planejamentos")
        .update({
          status: "cancelado",
          canceled_at: new Date().toISOString(),
          canceled_by: user.id,
        })
        .eq("id", planejamentoParaCancelar.id);

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
        planejamento_id: planejamentoParaCancelar.id,
        acao: "cancelado",
        descricao: "Planejamento cancelado",
        created_by: user.id,
      });

      toast.success("Planejamento cancelado com sucesso");
      setCancelarDialogOpen(false);
      setPlanejamentoParaCancelar(null);
      fetchPlanejamentos();
    } catch (error: any) {
      console.error("Erro ao cancelar planejamento:", error);
      toast.error(`Erro ao cancelar planejamento: ${error.message}`);
    }
  };

  // Função para cancelar OS específica de um planejamento
  const handleCancelarOS = async () => {
    if (!osParaCancelar || !user) return;

    try {
      // Buscar o registro de planejamento_ordens para obter o ID correto
      const { data: planejamentoOrdem, error: erroBuscar } = await supabase
        .from("planejamento_ordens")
        .select("id, ordem_servico_id")
        .eq("planejamento_id", osParaCancelar.planejamentoId)
        .eq("ordem_servico_id", osParaCancelar.ordemId)
        .single();

      if (erroBuscar || !planejamentoOrdem) {
        throw new Error("Registro de planejamento não encontrado");
      }

      // Remover a OS do planejamento_ordens
      const { error: erroRemover } = await supabase
        .from("planejamento_ordens")
        .delete()
        .eq("id", planejamentoOrdem.id);

      if (erroRemover) throw erroRemover;

      // Atualizar status da OS para "pendente"
      const { error: erroOS } = await supabase
        .from("ordens_servico")
        .update({
          status: "pendente",
          equipe_planejada_id: null,
          data_planejada: null,
        })
        .eq("id", osParaCancelar.ordemId);

      if (erroOS) throw erroOS;

      // Criar log
      await supabase.from("planejamento_logs").insert({
        planejamento_id: osParaCancelar.planejamentoId,
        ordem_servico_id: osParaCancelar.ordemId,
        acao: "os_removida",
        descricao: `OS ${osParaCancelar.osNumero} removida do planejamento`,
        created_by: user.id,
      });

      toast.success(`OS ${osParaCancelar.osNumero} removida do planejamento com sucesso`);
      setCancelarOSDialogOpen(false);
      setOsParaCancelar(null);
      fetchPlanejamentos();
    } catch (error: any) {
      console.error("Erro ao cancelar OS:", error);
      toast.error(`Erro ao cancelar OS: ${error.message}`);
    }
  };

  // Função para cancelar toda a rota (todas as OSs de uma equipe/data)
  const handleCancelarRota = async () => {
    if (!rotaParaCancelar || !user) {
      console.error("[CANCELAR ROTA] Dados faltando:", { rotaParaCancelar, user });
      toast.error("Dados insuficientes para cancelar a rota");
      return;
    }

    try {
      console.log("[CANCELAR ROTA] Iniciando cancelamento:", rotaParaCancelar);
      
      // Buscar todas as OSs da rota (equipe/data específica)
      const { data: ordensRota, error: erroBuscar } = await supabase
        .from("planejamento_ordens")
        .select("id, ordem_servico_id")
        .eq("planejamento_id", rotaParaCancelar.planejamentoId)
        .eq("equipe_id", rotaParaCancelar.equipeId);

      if (erroBuscar) {
        console.error("[CANCELAR ROTA] Erro ao buscar ordens:", erroBuscar);
        throw erroBuscar;
      }

      console.log("[CANCELAR ROTA] Ordens encontradas:", ordensRota);

      if (!ordensRota || ordensRota.length === 0) {
        toast.error("Nenhuma OS encontrada nesta rota");
        setCancelarRotaDialogOpen(false);
        setRotaParaCancelar(null);
        return;
      }

      // Atualizar status das OSs para "pendente" PRIMEIRO
      const osIds = ordensRota.map(po => po.ordem_servico_id);
      console.log("[CANCELAR ROTA] OS IDs para atualizar:", osIds);
      
      const { error: erroOSs, data: dataOSs } = await supabase
        .from("ordens_servico")
        .update({
          status: "pendente",
          equipe_planejada_id: null,
          data_planejada: null,
        })
        .in("id", osIds)
        .select();

      if (erroOSs) {
        console.error("[CANCELAR ROTA] Erro ao atualizar OSs:", erroOSs);
        throw erroOSs;
      }

      console.log("[CANCELAR ROTA] OSs atualizadas:", dataOSs);

      // Remover todas as OSs do planejamento_ordens DEPOIS
      const ordemIds = ordensRota.map(po => po.id);
      console.log("[CANCELAR ROTA] IDs para remover:", ordemIds);
      
      const { error: erroRemover, data: dataRemover } = await supabase
        .from("planejamento_ordens")
        .delete()
        .in("id", ordemIds)
        .select();

      if (erroRemover) {
        console.error("[CANCELAR ROTA] Erro ao remover ordens:", erroRemover);
        throw erroRemover;
      }

      console.log("[CANCELAR ROTA] Ordens removidas:", dataRemover);

      // Criar log
      const { error: erroLog } = await supabase.from("planejamento_logs").insert({
        planejamento_id: rotaParaCancelar.planejamentoId,
        acao: "rota_cancelada",
        descricao: `Rota completa cancelada (equipe: ${rotaParaCancelar.equipeId}, data: ${rotaParaCancelar.dataPlanejamento})`,
        created_by: user.id,
      });

      if (erroLog) {
        console.error("[CANCELAR ROTA] Erro ao criar log (não crítico):", erroLog);
      }

      toast.success(`Rota cancelada com sucesso! ${ordensRota.length} OS(s) revertida(s) para pendente`);
      setCancelarRotaDialogOpen(false);
      setRotaParaCancelar(null);
      
      // Recarregar dados
      await fetchPlanejamentos();
    } catch (error: any) {
      console.error("[CANCELAR ROTA] Erro completo:", error);
      toast.error(`Erro ao cancelar rota: ${error.message || "Erro desconhecido"}`, {
        description: error.details || error.hint || "",
        duration: 30000,
      });
    }
  };

  // Função auxiliar para obter valor da OS (com fallback para Skill)
  const obterValorOS = (os: any): number => {
    let valor = Number(os?.valor) || 0;
    
    // Se não tiver valor na OS, buscar da Skill
    if (valor === 0 && os?.tipo && skills.length > 0) {
      const tipoParaCodigo: Record<string, string> = {
        "ligacao": "LIGACAO",
        "ligação": "LIGACAO",
        "corte": "CORTE",
        "religa": "RELIGA",
        "inspecao": "INSPECAO",
        "inspeção": "INSPECAO",
        "manutencao": "MANUTENCAO",
        "manutenção": "MANUTENCAO",
        "troca_medidor": "TROCA_MEDIDOR",
      };
      
      const tipoLower = os.tipo.toLowerCase();
      const codigoSkill = tipoParaCodigo[tipoLower] || os.tipo.toUpperCase();
      
      const skill = skills.find(s => {
        const codigoUpper = (s.codigo || "").toUpperCase();
        return codigoUpper === codigoSkill;
      });
      
      if (skill?.valor) {
        valor = Number(skill.valor);
      }
    }
    
    return valor;
  };

  // Função auxiliar para obter tempo em minutos (converte segundos se necessário)
  const obterTempoMinutos = (tempo: any): number => {
    if (tempo == null || tempo === undefined || isNaN(Number(tempo))) {
      return 0;
    }
    const tempoNum = Number(tempo);
    // Se o valor for muito grande (> 1000), provavelmente está em segundos
    if (tempoNum > 1000) {
      return tempoNum / 60; // Converter segundos para minutos
    }
    return tempoNum;
  };

  const handleExportar = () => {
    try {
      const dadosExportacao: any[] = [];

      planejamentos.forEach((planejamento) => {
        if (planejamento.planejamento_ordens) {
          const ordensPorEquipe = new Map<string, any[]>();
          
          planejamento.planejamento_ordens.forEach((po: any) => {
            const equipeId = po.equipe_id;
            if (!ordensPorEquipe.has(equipeId)) {
              ordensPorEquipe.set(equipeId, []);
            }
            ordensPorEquipe.get(equipeId)!.push(po);
          });

          ordensPorEquipe.forEach((ordens, equipeId) => {
            const primeiraOrdem = ordens[0];
            const equipe = primeiraOrdem.tecnicos;
            
            ordens.sort((a, b) => a.ordem_na_rota - b.ordem_na_rota);

            ordens.forEach((po: any) => {
              const os = po.ordens_servico;
              const dataFormatada = new Date(planejamento.data_planejamento + 'T12:00:00').toLocaleDateString('pt-BR');
              const valorOS = obterValorOS(os);
              const tempoMinutos = obterTempoMinutos(po.tempo_estimado_minutos);
              const distancia = po.distancia_km != null && po.distancia_km !== undefined && po.distancia_km !== "" && String(po.distancia_km) !== "0" ? parseFloat(String(po.distancia_km)) : 0;
              
              dadosExportacao.push({
                "Data Planejamento": dataFormatada,
                "Status": planejamento.status,
                "Equipe": equipe?.codigo || "-",
                "Técnico": equipe?.nome || "-",
                "Ordem na Rota": po.ordem_na_rota,
                "Número OS": os?.numero || "-",
                "Tipo": os?.tipo || "-",
                "Endereço": os?.endereco || "-",
                "Cliente": os?.cliente_nome || "-",
                "Status OS": os?.status || "-",
                "Prazo": os?.prazo ? new Date(os.prazo).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : "-",
                "Regulada": os?.regulada ? "Sim" : "Não",
                "Valor Prev.": valorOS,
                "Valor Prod.": producaoMap[po.ordem_servico_id] || 0,
                "Distância (km)": distancia,
                "Tempo Estimado (min)": Math.round(tempoMinutos),
                "Hora Início": po.hora_inicio_estimada || "-",
                "Hora Fim": po.hora_fim_estimada || "-",
              });
            });
          });
        }
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExportacao);
      XLSX.utils.book_append_sheet(wb, ws, "Acompanhamento");

      const nomeArquivo = `Acompanhamento_Roteirizacoes_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);
      toast.success("Dados exportados com sucesso!");
    } catch (error: any) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  return (
    <MainLayout
      title="Acompanhamento de Roteirizações"
      subtitle="Acompanhe e gerencie todas as roteirizações planejadas"
      breadcrumbs={[{ label: "Acompanhamento de Roteirizações" }]}
    >
      {/* Filtros e Estatísticas - Layout compacto */}
      <div className="flex items-center gap-2 mb-3 p-2 rounded-lg border bg-card flex-wrap">
        {/* Filtros */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 w-28 pl-7 text-xs"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 w-[85px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
            <SelectItem value="executado">Executado</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dataInicioFilter}
          onChange={(e) => setDataInicioFilter(e.target.value)}
          className="h-7 w-[120px] text-xs"
        />
        <span className="text-xs text-muted-foreground">-</span>
        <Input
          type="date"
          value={dataFimFilter}
          onChange={(e) => setDataFimFilter(e.target.value)}
          className="h-7 w-[120px] text-xs"
        />

        <Select value={equipeFilter} onValueChange={setEquipeFilter}>
          <SelectTrigger className="h-7 w-[90px] text-xs">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {equipes.map(equipe => (
              <SelectItem key={equipe.id} value={equipe.id}>
                {equipe.codigo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5 border-l pl-2">
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => {
            const hoje = new Date().toISOString().split('T')[0];
            setDataInicioFilter(hoje);
            setDataFimFilter(hoje);
          }}>Hoje</Button>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => {
            const hoje = new Date();
            const ontem = new Date(hoje);
            ontem.setDate(ontem.getDate() - 1);
            setDataInicioFilter(ontem.toISOString().split('T')[0]);
            setDataFimFilter(ontem.toISOString().split('T')[0]);
          }}>Ontem</Button>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => {
            const hoje = new Date();
            const ultimos7 = new Date(hoje);
            ultimos7.setDate(ultimos7.getDate() - 7);
            setDataInicioFilter(ultimos7.toISOString().split('T')[0]);
            setDataFimFilter(hoje.toISOString().split('T')[0]);
          }}>7d</Button>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-6 px-1" onClick={clearAllFilters}>
            <X className="h-3 w-3" />
          </Button>
        )}

        {/* Separador */}
        <div className="h-5 w-px bg-border mx-1" />

        {/* Estatísticas inline */}
        <div className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3 text-primary" />
          <span className="font-bold">{planejamentos.length}</span>
        </div>
        
        <div className="flex items-center gap-1 text-xs">
          <Car className="h-3 w-3 text-blue-500" />
          <span className="font-bold">{getGroupedData().length}</span>
        </div>
        
        <div className="flex items-center gap-1 text-xs">
          <MapPin className="h-3 w-3 text-green-500" />
          <span className="font-bold">{planejamentos.reduce((acc, p) => acc + p.total_ordens, 0)}</span>
          <span className="text-muted-foreground">OSs</span>
        </div>
        
        <div className="flex items-center gap-1 text-xs">
          <DollarSign className="h-3 w-3 text-amber-500" />
          <span className="text-muted-foreground">Prev:</span>
          <span className="font-bold text-green-600">
            R$ {planejamentos.reduce((acc, p) => acc + (p.faturamento_total || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
        
        <div className="flex items-center gap-1 text-xs">
          <DollarSign className="h-3 w-3 text-green-600" />
          <span className="text-muted-foreground">Prod:</span>
          <span className="font-bold text-green-600">
            R$ {Object.values(producaoMap).reduce((acc, val) => acc + val, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
        
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={fetchPlanejamentos} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={handleExportar}
            disabled={planejamentos.length === 0}
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Lista de Rotas */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Rotas por Equipe/Data</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (expandedGroups.size === getTotalGroups().size) {
                      setExpandedGroups(new Set());
                    } else {
                      setExpandedGroups(new Set(getTotalGroups()));
                    }
                  }}
                >
                  {expandedGroups.size === getTotalGroups().size ? (
                    <>
                      <Minimize2 className="h-4 w-4 mr-2" />
                      Recolher Tudo
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Expandir Tudo
                    </>
                  )}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Carregando planejamentos...</p>
              </div>
            ) : getGroupedData().length === 0 ? (
              <div className="p-12 text-center">
                <Filter className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  Nenhum resultado encontrado
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {(equipeFilter !== "all" || debouncedSearchTerm)
                    ? `Nenhuma OS corresponde aos filtros aplicados${debouncedSearchTerm ? ` (busca: "${debouncedSearchTerm}")` : ""}${equipeFilter !== "all" ? " para a equipe selecionada" : ""}`
                    : planejamentos.length === 0 
                      ? "Não há planejamentos com os critérios de data/status selecionados"
                      : "Tente ajustar os filtros para ver mais resultados"
                  }
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    <FilterX className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {getGroupedData().map((group) => {
                  const groupKey = `${group.dataPlanejamento}-${group.equipeId}`;
                  const isExpanded = expandedGroups.has(groupKey);
                  
                  // Encontrar o planejamento correspondente usando o ID
                  const planejamento = planejamentos.find(p => p.id === group.planejamentoId);
                  
                  return (
                    <Collapsible
                      key={groupKey}
                      open={isExpanded}
                      onOpenChange={(open) => {
                        const newExpanded = new Set(expandedGroups);
                        if (open) {
                          newExpanded.add(groupKey);
                        } else {
                          newExpanded.delete(groupKey);
                        }
                        setExpandedGroups(newExpanded);
                      }}
                    >
                      <div className="relative">
                        <CollapsibleTrigger className="w-full">
                          <div className="p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 grid grid-cols-8 gap-4 pr-32">
                                <div>
                                  <div className="text-sm text-muted-foreground">Data</div>
                                  <div className="font-medium">
                                    {new Date(group.dataPlanejamento + 'T12:00:00').toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Equipe</div>
                                  <div className="font-medium">{group.equipeCodigo}</div>
                                  <div className="text-xs text-muted-foreground">{group.equipeNome}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Status</div>
                                  <div className="font-medium">
                                    {planejamento && (
                                      <Badge
                                        variant={
                                          planejamento.status === "aberto"
                                            ? "default"
                                            : planejamento.status === "cancelado"
                                            ? "destructive"
                                            : "secondary"
                                        }
                                      >
                                        {planejamento.status}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">OSs</div>
                                  <div className="font-medium">{group.ordens.length}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Distância</div>
                                  <div className="font-medium">
                                    {(() => {
                                      let totalDist = 0;
                                      for (const o of group.ordens) {
                                        // Pegar distancia_km diretamente (vem de planejamento_ordens)
                                        const dist = o.distancia_km;
                                        
                                        // Converter e somar
                                        if (dist !== null && dist !== undefined && dist !== 0) {
                                          const distNum = typeof dist === 'number' ? dist : parseFloat(String(dist));
                                          if (!isNaN(distNum) && distNum > 0) {
                                            totalDist += distNum;
                                          }
                                        }
                                      }
                                      return totalDist > 0 ? `${totalDist.toFixed(1)} km` : "-";
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Tempo</div>
                                  <div className="font-medium">
                                    {(() => {
                                      // Ordenar ordens por ordem_na_rota
                                      const ordensOrdenadas = [...group.ordens].sort((a, b) => 
                                        (a.ordem_na_rota || 0) - (b.ordem_na_rota || 0)
                                      );
                                      
                                      // Pegar primeira e última OS
                                      const primeiraOS = ordensOrdenadas[0];
                                      const ultimaOS = ordensOrdenadas[ordensOrdenadas.length - 1];
                                      
                                      if (!primeiraOS || !ultimaOS) return "-";
                                      
                                      const horaInicio = primeiraOS.hora_inicio_estimada;
                                      const horaFim = ultimaOS.hora_fim_estimada;
                                      
                                      if (!horaInicio || !horaFim) return "-";
                                      
                                      // Converter HH:MM para minutos
                                      const converterHoraParaMinutos = (hora: string): number => {
                                        const [h, m] = hora.split(':').map(Number);
                                        return (h || 0) * 60 + (m || 0);
                                      };
                                      
                                      const minutosInicio = converterHoraParaMinutos(horaInicio);
                                      const minutosFim = converterHoraParaMinutos(horaFim);
                                      
                                      // Calcular diferença
                                      let totalMin = minutosFim - minutosInicio;
                                      
                                      // Se o fim for menor que o início, pode ser que passou da meia-noite
                                      // Nesse caso, assumir que é no mesmo dia (não tratar virada de dia)
                                      if (totalMin < 0) {
                                        // Se negativo, pode ser erro nos dados, usar 0 ou calcular como se fosse no mesmo dia
                                        totalMin = 0;
                                      }
                                      
                                      const horas = Math.floor(totalMin / 60);
                                      const minutos = totalMin % 60;
                                      return totalMin > 0 ? `${horas}h ${minutos.toString().padStart(2, '0')}min` : "-";
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Valor Prev.</div>
                                  <div className="font-medium">
                                    {(() => {
                                      const totalValor = group.ordens.reduce((acc, o) => {
                                        const os = o.ordens_servico;
                                        // Primeiro tentar pegar o valor da OS
                                        let valor = Number(os?.valor) || 0;
                                        
                                        // Se não tiver valor na OS, buscar da Skill
                                        if (valor === 0 && os?.tipo && skills.length > 0) {
                                          // Mapear tipo para código de skill
                                          const tipoParaCodigo: Record<string, string> = {
                                            "ligacao": "LIGACAO",
                                            "ligação": "LIGACAO",
                                            "corte": "CORTE",
                                            "religa": "RELIGA",
                                            "inspecao": "INSPECAO",
                                            "inspeção": "INSPECAO",
                                            "manutencao": "MANUTENCAO",
                                            "manutenção": "MANUTENCAO",
                                            "troca_medidor": "TROCA_MEDIDOR",
                                          };
                                          
                                          const tipoLower = os.tipo.toLowerCase();
                                          const codigoSkill = tipoParaCodigo[tipoLower] || os.tipo.toUpperCase();
                                          
                                          const skill = skills.find(s => {
                                            const codigoUpper = (s.codigo || "").toUpperCase();
                                            return codigoUpper === codigoSkill;
                                          });
                                          
                                          if (skill?.valor) {
                                            valor = Number(skill.valor);
                                          }
                                        }
                                        
                                        return acc + valor;
                                      }, 0);
                                      return totalValor > 0 ? `R$ ${totalValor.toFixed(2)}` : "-";
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Valor Prod.</div>
                                  <div className="font-medium">
                                    {(() => {
                                      const totalValorProd = group.ordens.reduce((acc, o) => {
                                        return acc + (producaoMap[o.ordem_servico_id] || 0);
                                      }, 0);
                                      return totalValorProd > 0 ? `R$ ${totalValorProd.toFixed(2)}` : "-";
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      {planejamento && planejamento.status === "aberto" && podeEditar && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log("[CANCELAR ROTA] Botão clicado:", {
                                planejamentoId: group.planejamentoId || planejamento.id,
                                equipeId: group.equipeId,
                                dataPlanejamento: group.dataPlanejamento,
                              });
                              setRotaParaCancelar({
                                planejamentoId: group.planejamentoId || planejamento.id,
                                equipeId: group.equipeId,
                                dataPlanejamento: group.dataPlanejamento,
                              });
                              setCancelarRotaDialogOpen(true);
                            }}
                          >
                            <X className="h-4 w-4 text-destructive mr-1" />
                            Cancelar Rota
                          </Button>
                        </div>
                      )}
                      </div>
                      <CollapsibleContent>
                        <div className="px-4 pb-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ordem</TableHead>
                                <TableHead>Número OS</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Endereço</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Prazo</TableHead>
                                <TableHead>Distância</TableHead>
                                <TableHead>Hora Início</TableHead>
                                <TableHead>Hora Fim</TableHead>
                                <TableHead>Valor Prev.</TableHead>
                                <TableHead>Valor Prod.</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.ordens
                                .sort((a, b) => a.ordem_na_rota - b.ordem_na_rota)
                                .map((ordem) => {
                                  const os = ordem.ordens_servico;
                                  return (
                                    <TableRow key={ordem.id}>
                                      <TableCell className="font-medium">{ordem.ordem_na_rota}</TableCell>
                                      <TableCell>{os?.numero || "-"}</TableCell>
                                      <TableCell>{os?.tipo || "-"}</TableCell>
                                      <TableCell>{os?.cliente_nome || "-"}</TableCell>
                                      <TableCell className="max-w-xs truncate">{os?.endereco || "-"}</TableCell>
                                      <TableCell>
                                        <Badge variant={os?.status === "planejada" ? "default" : "secondary"}>
                                          {os?.status || "-"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        {os?.prazo ? (() => {
                                          const prazoDate = new Date(os.prazo);
                                          return prazoDate.toLocaleString('pt-BR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          });
                                        })() : "-"}
                                      </TableCell>
                                      <TableCell>
                                        {(() => {
                                          // Tentar pegar distancia_km de várias formas
                                          let dist = ordem.distancia_km;
                                          
                                          // Se não tiver, tentar do objeto ordens_servico
                                          if ((dist === null || dist === undefined || dist === 0) && ordem.ordens_servico) {
                                            dist = ordem.ordens_servico.distancia_km;
                                          }
                                          
                                          if (dist !== null && dist !== undefined) {
                                            const distNum = parseFloat(String(dist));
                                            if (!isNaN(distNum) && distNum > 0) {
                                              return `${distNum.toFixed(1)} km`;
                                            }
                                          }
                                          return "-";
                                        })()}
                                      </TableCell>
                                      <TableCell>{ordem.hora_inicio_estimada || "-"}</TableCell>
                                      <TableCell>{ordem.hora_fim_estimada || "-"}</TableCell>
                                      <TableCell>
                                        {(() => {
                                          // Primeiro tentar pegar o valor da OS
                                          let valor = Number(os?.valor) || 0;
                                          
                                          // Se não tiver valor na OS, buscar da Skill
                                          if (valor === 0 && os?.tipo && skills.length > 0) {
                                            // Mapear tipo para código de skill
                                            const tipoParaCodigo: Record<string, string> = {
                                              "ligacao": "LIGACAO",
                                              "ligação": "LIGACAO",
                                              "corte": "CORTE",
                                              "religa": "RELIGA",
                                              "inspecao": "INSPECAO",
                                              "inspeção": "INSPECAO",
                                              "manutencao": "MANUTENCAO",
                                              "manutenção": "MANUTENCAO",
                                              "troca_medidor": "TROCA_MEDIDOR",
                                            };
                                            
                                            const tipoLower = os.tipo.toLowerCase();
                                            const codigoSkill = tipoParaCodigo[tipoLower] || os.tipo.toUpperCase();
                                            
                                            const skill = skills.find(s => {
                                              const codigoUpper = (s.codigo || "").toUpperCase();
                                              return codigoUpper === codigoSkill;
                                            });
                                            
                                            if (skill?.valor) {
                                              valor = Number(skill.valor);
                                            }
                                          }
                                          
                                          return `R$ ${valor.toFixed(2)}`;
                                        })()}
                                      </TableCell>
                                      <TableCell>
                                        {producaoMap[ordem.ordem_servico_id] ? `R$ ${Number(producaoMap[ordem.ordem_servico_id]).toFixed(2)}` : "-"}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex gap-1 justify-end">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setOrdemDetalhesId(ordem.ordem_servico_id);
                                              setDetalhesOpen(true);
                                            }}
                                            title="Ver detalhes"
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                          {planejamento && planejamento.status === "aberto" && podeEditar && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setOsParaCancelar({
                                                  ordemId: ordem.ordem_servico_id,
                                                  osNumero: os?.numero || "-",
                                                  planejamentoId: planejamento.id,
                                                });
                                                setCancelarOSDialogOpen(true);
                                              }}
                                              title="Cancelar OS"
                                            >
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>

      {/* Dialog de Confirmação de Cancelamento de Planejamento */}
      <AlertDialog open={cancelarDialogOpen} onOpenChange={setCancelarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Planejamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este planejamento? 
              Todas as OSs serão revertidas para o status "Pendente".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarPlanejamento} className="bg-destructive text-destructive-foreground">
              Sim, Cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação de Cancelamento de OS */}
      <AlertDialog open={cancelarOSDialogOpen} onOpenChange={setCancelarOSDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover OS do Planejamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a OS {osParaCancelar?.osNumero} deste planejamento? 
              A OS será revertida para o status "Pendente".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarOS} className="bg-destructive text-destructive-foreground">
              Sim, Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação de Cancelamento de Rota */}
      <AlertDialog open={cancelarRotaDialogOpen} onOpenChange={setCancelarRotaDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Rota Completa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar toda a rota desta equipe/data? 
              Todas as OSs desta rota serão revertidas para o status "Pendente".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarRota} className="bg-destructive text-destructive-foreground">
              Sim, Cancelar Rota
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Detalhes da OS */}
      <OrdemServicoDetalhesDialog
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        ordemId={ordemDetalhesId}
      />
    </MainLayout>
  );
};

export default AcompanhamentoRoteirizacoes;

