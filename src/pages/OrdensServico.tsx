import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTelaPermissao } from "@/hooks/usePermissoes";
import { useLogSistema } from "@/hooks/useLogSistema";
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
  Zap,
  MapPin,
  Edit,
  Trash2,
  Eye,
  Upload,
  FileText,
  Trash,
  Globe,
  Loader2,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrdemServicoFormDialog } from "@/components/ordens/OrdemServicoFormDialog";
import { OrdemServicoDetalhesDialog } from "@/components/ordens/OrdemServicoDetalhesDialog";
import { ImportacaoOSDialog } from "@/components/ordens/ImportacaoOSDialog";
import type { Tables } from "@/integrations/supabase/types";
import * as XLSX from "xlsx";
import { fetchSkills } from "@/lib/skillsUtils";
import { geocodeAddress } from "@/lib/geocodingUtils";
import { Progress } from "@/components/ui/progress";
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

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  planejada: "Planejada",
  andamento: "Em Andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

const tipoLabels: Record<string, string> = {
  corte: "Corte",
  religa: "Religa",
  ligacao: "Ligação Nova",
  inspecao: "Inspeção",
  manutencao: "Manutenção",
  troca_medidor: "Troca de Medidor",
};

type OrdemWithTecnico = Tables<"ordens_servico"> & {
  tecnicos: Pick<Tables<"tecnicos">, "codigo" | "nome"> | null;
  retornos_campo: { id: string; codigo: string; descricao: string; tipo: string; cor: string | null } | null;
  producao_equipes: { id: string; valor_total: number }[] | null;
  tipo_nome?: string;
};

// Constantes de paginação
const PAGE_SIZE = 100;

const OrdensServico = () => {
  // Permissões da tela
  const { podeEditar } = useTelaPermissao("ordens_servico");
  const { logCriar, logEditar, logExcluir } = useLogSistema();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [ordens, setOrdens] = useState<OrdemWithTecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedOrdem, setSelectedOrdem] = useState<Tables<"ordens_servico"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ordemToDelete, setOrdemToDelete] = useState<Tables<"ordens_servico"> | null>(null);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Filtros avançados
  const [showFilters, setShowFilters] = useState(false);
  const [execucaoInicio, setExecucaoInicio] = useState("");
  const [execucaoFim, setExecucaoFim] = useState("");
  const [prazoInicio, setPrazoInicio] = useState("");
  const [prazoFim, setPrazoFim] = useState("");
  const [equipeFilter, setEquipeFilter] = useState<string>("all");
  const [retornoFilter, setRetornoFilter] = useState<string>("all");
  const [coordenadasFilter, setCoordenadasFilter] = useState<string>("all");
  const [producaoFilter, setProducaoFilter] = useState<string>("all");
  
  // Dados para filtros
  const [equipes, setEquipes] = useState<{ id: string; codigo: string; nome: string }[]>([]);
  const [retornos, setRetornos] = useState<{ id: string; codigo: string; descricao: string; tipo: string }[]>([]);
  const [skills, setSkills] = useState<{ codigo: string; nome: string }[]>([]);
  
  // Paginação e contagem
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // Cache de skills (busca uma vez)
  const [skillsMap, setSkillsMap] = useState<Record<string, string>>({});
  
  // Estado para ordenação
  type SortColumn = "codigo" | "numero" | "tipo" | "status" | "endereco" | "prazo" | "concluido_at" | "equipe" | "retorno" | "valor_prod" | "cliente" | null;
  type SortDirection = "asc" | "desc";
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Função para alternar ordenação
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Se já está ordenando por esta coluna, alterna a direção
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      // Nova coluna, começa em ascendente
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Componente para cabeçalho ordenável
  const SortableHeader = ({ column, children, className = "" }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/80 select-none ${className}`}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );
  const [geocodingInProgress, setGeocodingInProgress] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0, endereco: "" });
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [ordemDetalhesId, setOrdemDetalhesId] = useState<string | null>(null);

  // Buscar skills uma vez e cachear
  const fetchSkillsOnce = async () => {
    if (Object.keys(skillsMap).length > 0) return skillsMap;
    
    const { data: skillsData } = await supabase
      .from("skills")
      .select("codigo, nome")
      .eq("ativo", true);

    const map: Record<string, string> = {};
    if (skillsData) {
      skillsData.forEach((skill: any) => {
        map[skill.codigo?.toLowerCase()] = skill.nome;
        map[skill.codigo?.toUpperCase()] = skill.nome;
        const normalizado = skill.codigo?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        map[normalizado] = skill.nome;
      });
    }
    setSkillsMap(map);
    return map;
  };

  // Aplicar filtros na query do Supabase
  const applyFiltersToQuery = (query: any) => {
    // Status
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    
    // Tipo
    if (tipoFilter !== "all") {
      query = query.eq("tipo", tipoFilter);
    }
    
    // Prazo - início
    if (prazoInicio) {
      query = query.gte("prazo", prazoInicio);
    }
    
    // Prazo - fim
    if (prazoFim) {
      query = query.lte("prazo", prazoFim + "T23:59:59");
    }
    
    // Data de execução - início
    if (execucaoInicio) {
      query = query.gte("concluido_at", execucaoInicio);
    }
    
    // Data de execução - fim
    if (execucaoFim) {
      query = query.lte("concluido_at", execucaoFim + "T23:59:59");
    }
    
    // Coordenadas
    if (coordenadasFilter === "com") {
      query = query.not("latitude", "is", null).not("longitude", "is", null);
    } else if (coordenadasFilter === "sem") {
      query = query.or("latitude.is.null,longitude.is.null");
    }
    
    // Retorno de campo
    if (retornoFilter === "sem_retorno") {
      query = query.is("retorno_campo_id", null);
    } else if (retornoFilter !== "all") {
      query = query.eq("retorno_campo_id", retornoFilter);
    }
    
    // Busca textual (aplicada via ilike em múltiplos campos)
    if (debouncedSearchTerm) {
      const term = `%${debouncedSearchTerm}%`;
      query = query.or(`numero.ilike.${term},endereco.ilike.${term},cliente_nome.ilike.${term},cliente_cpf.ilike.${term},instalacao.ilike.${term}`);
    }
    
    return query;
  };

  // Buscar contagem total COM filtros
  const fetchTotalCountWithFilters = async () => {
    let query = supabase
      .from("ordens_servico")
      .select("*", { count: "exact", head: true });
    
    query = applyFiltersToQuery(query);
    
    const { count } = await query;
    setTotalCount(count || 0);
    return count || 0;
  };

  const fetchOrdens = async (page = 0, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setOrdens([]);
    }
    
    try {
      // Buscar skills em paralelo com a contagem (apenas na primeira carga)
      const [skills, totalWithFilters] = await Promise.all([
        fetchSkillsOnce(),
        page === 0 ? fetchTotalCountWithFilters() : Promise.resolve(totalCount)
      ]);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Query principal com paginação e filtros
      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          tecnicos:tecnico_id (codigo, nome),
          retornos_campo:retorno_campo_id (id, codigo, descricao, tipo, cor)
        `);
      
      // Aplicar filtros
      query = applyFiltersToQuery(query);
      
      // Ordenação e paginação
      query = query.order("created_at", { ascending: false }).range(from, to);
      
      const { data, error } = await query;

      if (error) {
        console.error("Erro ao carregar ordens:", error);
        toast.error("Erro ao carregar ordens de serviço");
        return;
      }

      const newData = data || [];
      setHasMore(newData.length === PAGE_SIZE);
      setCurrentPage(page);

      // Processar com skills já carregadas
      await processarOrdens(newData, skills, append, equipeFilter, producaoFilter);
    } catch (err) {
      console.error("Erro ao carregar ordens:", err);
      toast.error("Erro ao carregar ordens de serviço");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchOrdens(currentPage + 1, true);
    }
  };

  const processarOrdens = async (data: any[], skills: Record<string, string>, append = false, equipeFilterParam?: string, producaoFilterParam?: string) => {
    if (data.length === 0) {
      if (!append) setOrdens([]);
      return;
    }

    // Buscar produção e planejamento em paralelo (apenas para os IDs desta página)
    const ordensIds = data.map(o => o.id);
    
    const [producaoResult, planejamentoResult] = await Promise.all([
      supabase
        .from("producao_equipes")
        .select(`
          ordem_servico_id,
          valor_total,
          equipe_id,
          retornos_campo:retorno_campo_id (id, codigo, descricao, tipo, cor),
          tecnicos:equipe_id (codigo, nome)
        `)
        .in("ordem_servico_id", ordensIds),
      supabase
        .from("planejamento_ordens")
        .select(`
          ordem_servico_id,
          tecnicos:equipe_id (codigo, nome)
        `)
        .in("ordem_servico_id", ordensIds)
    ]);

    // Mapear produção
    const producaoMap: Record<string, { retorno: any; valor_total: number; equipe_id: string | null }> = {};
    const equipeMap: Record<string, { codigo: string; nome: string }> = {};

    if (producaoResult.data) {
      producaoResult.data.forEach((p: any) => {
        producaoMap[p.ordem_servico_id] = {
          retorno: p.retornos_campo,
          valor_total: p.valor_total || 0,
          equipe_id: p.equipe_id
        };
        if (p.tecnicos) {
          equipeMap[p.ordem_servico_id] = p.tecnicos;
        }
      });
    }

    // Mapear planejamento (apenas se não tiver equipe da produção)
    if (planejamentoResult.data) {
      planejamentoResult.data.forEach((p: any) => {
        if (!equipeMap[p.ordem_servico_id] && p.tecnicos) {
          equipeMap[p.ordem_servico_id] = p.tecnicos;
        }
      });
    }

    // Combinar dados
    let ordensComProducao = data.map(ordem => {
      const producao = producaoMap[ordem.id];
      const equipeExecutora = equipeMap[ordem.id];

      return {
        ...ordem,
        tipo_nome: skills[ordem.tipo?.toLowerCase()] || skills[ordem.tipo?.toUpperCase()] || ordem.tipo,
        retornos_campo: ordem.retornos_campo || producao?.retorno || null,
        producao_equipes: producao ? [{ id: ordem.id, valor_total: producao.valor_total }] : null,
        tecnicos: ordem.tecnicos || equipeExecutora || null
      };
    });

    // Aplicar filtros que dependem de dados relacionados (equipe e produção)
    // Esses filtros são aplicados após o processamento porque dependem de joins
    const activeEquipeFilter = equipeFilterParam || equipeFilter;
    const activeProducaoFilter = producaoFilterParam || producaoFilter;
    
    if (activeEquipeFilter !== "all") {
      ordensComProducao = ordensComProducao.filter(os => os.tecnicos?.codigo === activeEquipeFilter);
    }
    
    if (activeProducaoFilter !== "all") {
      if (activeProducaoFilter === "com") {
        ordensComProducao = ordensComProducao.filter(os => 
          os.producao_equipes && os.producao_equipes.length > 0 && os.producao_equipes[0].valor_total > 0
        );
      } else if (activeProducaoFilter === "sem") {
        ordensComProducao = ordensComProducao.filter(os => 
          !os.producao_equipes || os.producao_equipes.length === 0 || !os.producao_equipes[0].valor_total
        );
      }
    }

    if (append) {
      setOrdens(prev => [...prev, ...ordensComProducao as OrdemWithTecnico[]]);
    } else {
      setOrdens(ordensComProducao as OrdemWithTecnico[]);
    }
  };

  // Buscar dados para os filtros
  const fetchFilterData = async () => {
    const [equipesRes, retornosRes, skillsRes] = await Promise.all([
      supabase.from("tecnicos").select("id, codigo, nome").neq("status", "offline").order("codigo"),
      supabase.from("retornos_campo").select("id, codigo, descricao, tipo").eq("ativo", true).order("descricao"),
      supabase.from("skills").select("codigo, nome").eq("ativo", true).order("nome"),
    ]);
    
    if (equipesRes.data) setEquipes(equipesRes.data);
    if (retornosRes.data) setRetornos(retornosRes.data);
    if (skillsRes.data) setSkills(skillsRes.data);
  };

  // Estado para controlar debounce do searchTerm
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  
  // Debounce para o termo de busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms de delay
    
    return () => clearTimeout(handler);
  }, [searchTerm]);
  
  // Carregamento inicial e dados para filtros
  useEffect(() => {
    fetchFilterData();
  }, []);
  
  // Refazer busca quando filtros mudarem (incluindo debouncedSearchTerm)
  useEffect(() => {
    fetchOrdens(0, false);
  }, [
    debouncedSearchTerm,
    statusFilter,
    tipoFilter,
    execucaoInicio,
    execucaoFim,
    prazoInicio,
    prazoFim,
    equipeFilter,
    retornoFilter,
    coordenadasFilter,
    producaoFilter
  ]);
  
  // Limpar filtros
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTipoFilter("all");
    setExecucaoInicio("");
    setExecucaoFim("");
    setPrazoInicio("");
    setPrazoFim("");
    setEquipeFilter("all");
    setRetornoFilter("all");
    setCoordenadasFilter("all");
    setProducaoFilter("all");
  };
  
  // Contar filtros ativos
  const activeFiltersCount = [
    statusFilter !== "all",
    tipoFilter !== "all",
    execucaoInicio !== "",
    execucaoFim !== "",
    prazoInicio !== "",
    prazoFim !== "",
    equipeFilter !== "all",
    retornoFilter !== "all",
    coordenadasFilter !== "all",
    producaoFilter !== "all",
  ].filter(Boolean).length;

  const handleEdit = (ordem: Tables<"ordens_servico">) => {
    setSelectedOrdem(ordem);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!ordemToDelete) return;

    const { error } = await supabase
      .from("ordens_servico")
      .delete()
      .eq("id", ordemToDelete.id);

    if (error) {
      toast.error("Erro ao excluir ordem de serviço");
    } else {
      // Log de exclusão
      logExcluir("ordens", "ordens_servico", ordemToDelete.id, ordemToDelete, 
        `Excluiu OS ${ordemToDelete.numero} - ${ordemToDelete.tipo} - ${ordemToDelete.cliente_nome || 'Sem cliente'}`);
      
      toast.success("Ordem de serviço excluída");
      fetchOrdens(0, false);
    }
    setDeleteDialogOpen(false);
    setOrdemToDelete(null);
  };

  const handleCancelAll = async () => {
    try {
      // Contar quantas ordens não estão canceladas
      const { count, error: countError } = await supabase
        .from("ordens_servico")
        .select("*", { count: "exact", head: true })
        .neq("status", "cancelada");

      if (countError) {
        toast.error("Erro ao buscar ordens de serviço");
        setClearAllDialogOpen(false);
        return;
      }

      if (!count || count === 0) {
        toast.info("Não há ordens de serviço para cancelar (todas já estão canceladas)");
        setClearAllDialogOpen(false);
        return;
      }

      toast.info(`Cancelando ${count} ordens de serviço...`);

      // Atualizar todas as ordens não canceladas de uma vez (sem filtro por ID)
      const { error: updateError } = await supabase
        .from("ordens_servico")
        .update({ 
          status: "cancelada",
          equipe_planejada_id: null,
          data_planejada: null
        })
        .neq("status", "cancelada");

      if (updateError) {
        console.error("Erro ao cancelar ordens:", updateError);
        toast.error(`Erro ao cancelar ordens de serviço: ${updateError.message}`);
      } else {
        // Limpar todos os planejamentos de ordens
        await supabase
          .from("planejamento_ordens")
          .delete()
          .not("ordem_servico_id", "is", null);

        // Log de cancelamento em massa
        logEditar("ordens", "ordens_servico", "all", null, { status: "cancelada" }, 
          `Cancelou todas as ${count} ordens de serviço em massa`);

        toast.success(`${count} ordem(ns) de serviço cancelada(s) com sucesso!`);
      }

      fetchOrdens(0, false);
    } catch (error: any) {
      console.error("Erro ao cancelar ordens:", error);
      toast.error(`Erro ao cancelar ordens de serviço: ${error.message}`);
    }
    
    setClearAllDialogOpen(false);
  };

  const handleDownloadModel = async () => {
    try {
      // Buscar skills disponíveis do banco
      const skillsDisponiveis = await fetchSkills();
      
      if (skillsDisponiveis.length === 0) {
        toast.error("Nenhum tipo cadastrado em Skills. Cadastre pelo menos um tipo antes de gerar o modelo.");
        return;
      }

      // Cabeçalhos do Excel (sem duracao_estimada, valor e regulada - preenchidos automaticamente pelo cadastro de Skills)
      const headers = [
        "numero",
        "tipo",
        "status",
        "endereco",
        "cliente_nome",
        "cliente_cpf",
        "instalacao",
        "medidor",
        "prazo",
        "latitude",
        "longitude",
        "observacoes"
      ];

      // Criar exemplos usando os tipos reais do cadastro de Skills
      const examplesRaw = skillsDisponiveis.slice(0, 5).map((skill, index) => {
        const tipo = skillCodigoParaTipo(skill.codigo);
        return {
          numero: `OS-${String(index + 1).padStart(3, "0")}`,
          tipo: tipo,
          status: "pendente",
          endereco: `Rua Exemplo ${index + 1}, ${100 + index} - Centro`,
          cliente_nome: `Cliente ${index + 1}`,
          cliente_cpf: `${String(100 + index).padStart(3, "0")}.${String(200 + index).padStart(3, "0")}.${String(300 + index).padStart(3, "0")}-00`,
          instalacao: `${100000000 + index}`,
          medidor: `M${String(10000000 + index)}`,
          prazo: index === 0 ? "16/12/2025 23:59" : "",
          latitude: `-14,${8661 + index}`,
          longitude: `-40,${8394 + index}`,
          observacoes: skill.descricao || `Exemplo de ${skill.nome}`
        };
      });

      // Garantir pelo menos 5 exemplos (repetir se necessário)
      while (examplesRaw.length < 5 && skillsDisponiveis.length > 0) {
        const skill = skillsDisponiveis[examplesRaw.length % skillsDisponiveis.length];
        const tipo = skillCodigoParaTipo(skill.codigo);
        examplesRaw.push({
          numero: `OS-${String(examplesRaw.length + 1).padStart(3, "0")}`,
          tipo: tipo,
          status: "pendente",
          endereco: `Rua Exemplo ${examplesRaw.length + 1}, ${100 + examplesRaw.length} - Centro`,
          cliente_nome: `Cliente ${examplesRaw.length + 1}`,
          cliente_cpf: `${String(100 + examplesRaw.length).padStart(3, "0")}.${String(200 + examplesRaw.length).padStart(3, "0")}.${String(300 + examplesRaw.length).padStart(3, "0")}-00`,
          instalacao: `${100000000 + examplesRaw.length}`,
          medidor: `M${String(10000000 + examplesRaw.length)}`,
          prazo: "",
          latitude: `-14,${8661 + examplesRaw.length}`,
          longitude: `-40,${8394 + examplesRaw.length}`,
          observacoes: skill.descricao || `Exemplo de ${skill.nome}`
        });
      }


      // Converter para formato Excel: datas como Date objects, números como números
      const examples = examplesRaw.map((ex) => {
      const converted: any = { ...ex };
      
      // Converter latitude e longitude: vírgula para ponto e depois para número
      if (converted.latitude && typeof converted.latitude === "string") {
        converted.latitude = parseFloat(converted.latitude.replace(",", "."));
      }
      if (converted.longitude && typeof converted.longitude === "string") {
        converted.longitude = parseFloat(converted.longitude.replace(",", "."));
      }
      
      // Converter prazo: formato brasileiro DD/MM/YYYY HH:mm para Date
      if (converted.prazo && converted.prazo.trim()) {
        const match = converted.prazo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
        if (match) {
          const [, dia, mes, ano, hora = "0", minuto = "0"] = match;
          converted.prazo = new Date(
            parseInt(ano),
            parseInt(mes) - 1,
            parseInt(dia),
            parseInt(hora),
            parseInt(minuto)
          );
        } else {
          converted.prazo = null;
        }
      } else {
        converted.prazo = null;
      }
      
      return converted;
    });

    // Criar workbook Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(examples, { header: headers });
    
    // Configurar formato de células
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    const latCol = headers.indexOf("latitude");
    const lngCol = headers.indexOf("longitude");
    const prazoCol = headers.indexOf("prazo");
    
    for (let row = 1; row <= range.e.r; row++) {
      // Formato de latitude e longitude com vírgula como separador decimal
      if (latCol >= 0) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: latCol });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].z = "#,##0.0000";
        }
      }
      if (lngCol >= 0) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: lngCol });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].z = "#,##0.0000";
        }
      }
      // Formato de data brasileira para prazo
      if (prazoCol >= 0) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: prazoCol });
        if (worksheet[cellAddress] && worksheet[cellAddress].v) {
          worksheet[cellAddress].z = "dd/mm/yyyy hh:mm";
        }
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ordens de Serviço");

    // Fazer download
    XLSX.writeFile(workbook, "modelo_importacao_oss.xlsx");
    
    toast.success("Modelo de importação baixado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao gerar modelo:", error);
      toast.error(error.message || "Erro ao gerar modelo de importação");
    }
  };

  /**
   * Converte código da skill (ex: "CORTE") para formato tipo usado no banco (ex: "corte")
   */
  const skillCodigoParaTipo = (codigo: string): string => {
    return codigo.toLowerCase().replace(/[^a-z0-9]/g, "_");
  };

  /**
   * Converte tipo do banco (ex: "corte") para código da skill (ex: "CORTE")
   */
  const tipoParaSkillCodigo = (tipo: string): string => {
    // Mapeamento direto para casos conhecidos
    const mapeamento: Record<string, string> = {
      corte: "CORTE",
      religa: "RELIGA",
      inspecao: "INSPEÇÃO",
      inspeção: "INSPEÇÃO",
      ligacao: "LIGAÇÃO",
      ligação: "LIGAÇÃO",
      manutencao: "MANUTENÇÃO",
      manutenção: "MANUTENÇÃO",
      troca_medidor: "TROCA_MEDIDOR",
    };
    
    if (mapeamento[tipo.toLowerCase()]) {
      return mapeamento[tipo.toLowerCase()];
    }
    
    // Tentar converter diretamente
    return tipo.toUpperCase();
  };

  // Contar OSs sem coordenadas
  const ordensSemCoordenadas = ordens.filter(os => !os.latitude || !os.longitude);

  // Função para geocodificar OSs sem coordenadas
  const handleGeocodeAll = async () => {
    if (ordensSemCoordenadas.length === 0) {
      toast.info("Todas as OSs já possuem coordenadas!");
      return;
    }

    setGeocodingInProgress(true);
    setGeocodingProgress({ current: 0, total: ordensSemCoordenadas.length, endereco: "" });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < ordensSemCoordenadas.length; i++) {
      const os = ordensSemCoordenadas[i];
      setGeocodingProgress({ 
        current: i + 1, 
        total: ordensSemCoordenadas.length, 
        endereco: os.endereco 
      });

      try {
        const result = await geocodeAddress(os.endereco);
        
        if (result) {
          // Atualizar no banco
          const { error } = await supabase
            .from("ordens_servico")
            .update({
              latitude: result.latitude,
              longitude: result.longitude,
            })
            .eq("id", os.id);

          if (error) {
            console.error(`Erro ao atualizar OS ${os.numero}:`, error);
            failed++;
          } else {
            success++;
          }
        } else {
          console.warn(`Não foi possível geocodificar: ${os.endereco}`);
          failed++;
        }
      } catch (error) {
        console.error(`Erro ao geocodificar OS ${os.numero}:`, error);
        failed++;
      }
    }

    setGeocodingInProgress(false);
    setGeocodingProgress({ current: 0, total: 0, endereco: "" });

    if (success > 0) {
      toast.success(`${success} OS(s) geocodificada(s) com sucesso!`);
      fetchOrdens(0, false); // Recarregar lista
    }
    
    if (failed > 0) {
      toast.warning(`${failed} OS(s) não puderam ser geocodificadas. Verifique os endereços.`);
    }
  };

  // Filtros já aplicados no servidor - apenas busca local para feedback imediato durante digitação
  const filteredOrdens = ordens.filter((os) => {
    // Aplicar busca local apenas se searchTerm diferente do debouncedSearchTerm (digitando)
    if (searchTerm !== debouncedSearchTerm && searchTerm) {
      return os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ((os as any).codigo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        os.endereco.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (os.cliente_nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (os.cliente_cpf || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (os.instalacao || "").toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  // Ordenar as ordens filtradas
  const sortedOrdens = [...filteredOrdens].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let valueA: any;
    let valueB: any;
    
    switch (sortColumn) {
      case "codigo":
        valueA = (a as any).codigo || "";
        valueB = (b as any).codigo || "";
        break;
      case "numero":
        valueA = a.numero || "";
        valueB = b.numero || "";
        break;
      case "tipo":
        valueA = a.tipo_nome || tipoLabels[a.tipo] || a.tipo || "";
        valueB = b.tipo_nome || tipoLabels[b.tipo] || b.tipo || "";
        break;
      case "status":
        valueA = statusLabels[a.status] || a.status || "";
        valueB = statusLabels[b.status] || b.status || "";
        break;
      case "endereco":
        valueA = a.endereco || "";
        valueB = b.endereco || "";
        break;
      case "prazo":
        valueA = a.prazo ? new Date(a.prazo).getTime() : 0;
        valueB = b.prazo ? new Date(b.prazo).getTime() : 0;
        break;
      case "concluido_at":
        valueA = a.concluido_at ? new Date(a.concluido_at).getTime() : 0;
        valueB = b.concluido_at ? new Date(b.concluido_at).getTime() : 0;
        break;
      case "equipe":
        valueA = a.tecnicos?.codigo || "";
        valueB = b.tecnicos?.codigo || "";
        break;
      case "retorno":
        valueA = a.retornos_campo?.descricao || "";
        valueB = b.retornos_campo?.descricao || "";
        break;
      case "valor_prod":
        valueA = a.producao_equipes?.[0]?.valor_total || 0;
        valueB = b.producao_equipes?.[0]?.valor_total || 0;
        break;
      case "cliente":
        valueA = a.cliente_nome || "";
        valueB = b.cliente_nome || "";
        break;
      default:
        return 0;
    }
    
    // Comparação
    if (typeof valueA === "number" && typeof valueB === "number") {
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    }
    
    // Comparação de strings
    const strA = String(valueA).toLowerCase();
    const strB = String(valueB).toLowerCase();
    
    if (strA < strB) return sortDirection === "asc" ? -1 : 1;
    if (strA > strB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "concluida": return "success";
      case "andamento": return "default";
      case "atrasada": return "danger";
      case "cancelada": return "secondary";
      default: return "warning";
    }
  };

  return (
    <MainLayout
      title="Ordens de Serviço"
      subtitle="Gestão completa das ordens de serviço"
      breadcrumbs={[{ label: "Ordens de Serviço" }]}
    >
      {/* Actions Bar */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        {/* Linha principal de busca e ações */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, código, endereço, cliente, CPF, instalação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button 
              variant={showFilters ? "default" : "outline"} 
              className="gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <RotateCcw className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleDownloadModel}>
              <FileText className="h-4 w-4" />
              Modelo de Importação
            </Button>
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={() => setImportDialogOpen(true)}
              disabled={!podeEditar}
              title={!podeEditar ? "Você não tem permissão para importar" : undefined}
            >
              <Upload className="h-4 w-4" />
              Importar OSS
            </Button>
            {ordensSemCoordenadas.length > 0 && (
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={handleGeocodeAll}
                disabled={geocodingInProgress}
              >
                {geocodingInProgress ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                Geocodificar ({ordensSemCoordenadas.length})
              </Button>
            )}
            <Button 
              variant="outline" 
              className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700" 
              onClick={() => setClearAllDialogOpen(true)}
              disabled={!podeEditar}
              title={!podeEditar ? "Você não tem permissão para cancelar" : undefined}
            >
              <X className="h-4 w-4" />
              Cancelar Todas
            </Button>
            <Button 
              className="gap-2" 
              onClick={() => { setSelectedOrdem(null); setFormOpen(true); }}
              disabled={!podeEditar}
              title={!podeEditar ? "Você não tem permissão para criar" : undefined}
            >
              <Plus className="h-4 w-4" />
              Nova OS
            </Button>
          </div>
        </div>

        {/* Painel de filtros avançados */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Serviço */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo de Serviço</label>
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Tipos</SelectItem>
                    {skills.map((skill) => (
                      <SelectItem key={skill.codigo} value={skill.codigo.toLowerCase()}>
                        {skill.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Equipe */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Equipe
                </label>
                <Select value={equipeFilter} onValueChange={setEquipeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Equipes</SelectItem>
                    {equipes.map((equipe) => (
                      <SelectItem key={equipe.id} value={equipe.codigo}>
                        {equipe.codigo} - {equipe.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Retorno de Campo */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Retorno de Campo</label>
                <Select value={retornoFilter} onValueChange={setRetornoFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Retornos</SelectItem>
                    <SelectItem value="sem_retorno">Sem Retorno</SelectItem>
                    {retornos.map((retorno) => (
                      <SelectItem key={retorno.id} value={retorno.id}>
                        {retorno.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Coordenadas */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
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

              {/* Produção */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Produção</label>
                <Select value={producaoFilter} onValueChange={setProducaoFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="com">Com Produção</SelectItem>
                    <SelectItem value="sem">Sem Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha de filtros por data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
              {/* Data de Execução */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Data de Execução (Conclusão)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={execucaoInicio}
                    onChange={(e) => setExecucaoInicio(e.target.value)}
                    className="h-9"
                    placeholder="De"
                  />
                  <span className="text-muted-foreground text-sm">até</span>
                  <Input
                    type="date"
                    value={execucaoFim}
                    onChange={(e) => setExecucaoFim(e.target.value)}
                    className="h-9"
                    placeholder="Até"
                  />
                </div>
              </div>

              {/* Data de Prazo */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
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
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-muted-foreground flex items-center justify-between">
          <div>
            Mostrando {sortedOrdens.length} de {totalCount > 0 ? totalCount : ordens.length} resultados
            {activeFiltersCount > 0 && (
              <span className="ml-2 text-primary font-medium">
                ({activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""} ativo{activeFiltersCount > 1 ? "s" : ""})
              </span>
            )}
            {ordensSemCoordenadas.length > 0 && !geocodingInProgress && (
              <span className="ml-2 text-orange-500">
                • {ordensSemCoordenadas.length} OS(s) sem coordenadas
              </span>
            )}
          </div>
          {hasMore && ordens.length < totalCount && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadMore}
              disabled={loadingMore}
              className="gap-2"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  Carregar mais ({totalCount - ordens.length} restantes)
                </>
              )}
            </Button>
          )}
        </div>

        {/* Barra de progresso de geocodificação */}
        {geocodingInProgress && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Geocodificando endereços...
              </span>
              <span className="text-sm text-blue-600 dark:text-blue-400">
                {geocodingProgress.current} de {geocodingProgress.total}
              </span>
            </div>
            <Progress 
              value={(geocodingProgress.current / geocodingProgress.total) * 100} 
              className="h-2"
            />
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 truncate">
              {geocodingProgress.endereco}
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : sortedOrdens.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma ordem de serviço encontrada. Clique em "Nova OS" para cadastrar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <SortableHeader column="codigo" className="w-[150px]">Código</SortableHeader>
                <SortableHeader column="numero" className="w-[120px]">Número OS</SortableHeader>
                <SortableHeader column="tipo">Tipo</SortableHeader>
                <SortableHeader column="status">Status</SortableHeader>
                <SortableHeader column="endereco" className="hidden md:table-cell">Endereço</SortableHeader>
                <SortableHeader column="prazo">Prazo</SortableHeader>
                <SortableHeader column="concluido_at" className="hidden md:table-cell">Dt. Execução</SortableHeader>
                <SortableHeader column="equipe">Equipe</SortableHeader>
                <SortableHeader column="retorno" className="hidden lg:table-cell">Retorno</SortableHeader>
                <SortableHeader column="valor_prod" className="hidden lg:table-cell text-right">Valor Prod.</SortableHeader>
                <SortableHeader column="cliente" className="hidden sm:table-cell">Cliente</SortableHeader>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOrdens.map((os) => (
                <TableRow key={os.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {(os as any).codigo || "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {os.regulada && <Zap className="h-4 w-4 text-danger" />}
                      {os.numero}
                    </div>
                  </TableCell>
                  <TableCell>{os.tipo_nome || tipoLabels[os.tipo] || os.tipo}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(os.status) as any}>
                      {statusLabels[os.status] || os.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin 
                        className={`h-4 w-4 flex-shrink-0 ${
                          os.latitude && os.longitude 
                            ? "text-green-500" 
                            : "text-orange-500"
                        }`} 
                        title={os.latitude && os.longitude ? "Com coordenadas" : "Sem coordenadas - clique em Geocodificar"}
                      />
                      <span className="truncate max-w-[200px]">{os.endereco}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {os.prazo ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {new Date(os.prazo).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(os.prazo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {os.concluido_at ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-green-600">
                          {new Date(os.concluido_at).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(os.concluido_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {os.tecnicos ? (
                      <span className="font-medium">{os.tecnicos.codigo}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {os.retornos_campo ? (
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: os.retornos_campo.cor || "#6b7280" }}
                        />
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            os.retornos_campo.tipo === 'executado' 
                              ? 'border-green-500 text-green-700 bg-green-50' 
                              : os.retornos_campo.tipo === 'impedimento'
                                ? 'border-red-500 text-red-700 bg-red-50'
                                : 'border-yellow-500 text-yellow-700 bg-yellow-50'
                          }`}
                          title={os.retornos_campo.descricao}
                        >
                          {os.retornos_campo.descricao.length > 20 
                            ? os.retornos_campo.descricao.substring(0, 20) + "..."
                            : os.retornos_campo.descricao
                          }
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right">
                    {os.producao_equipes && os.producao_equipes.length > 0 ? (
                      <span className="font-medium text-green-600">
                        R$ {Number(os.producao_equipes[0].valor_total || 0).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {os.cliente_nome || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => { setOrdemDetalhesId(os.id); setDetalhesOpen(true); }}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => handleEdit(os)} 
                        title={podeEditar ? "Editar" : "Você não tem permissão para editar"}
                        disabled={!podeEditar}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { setOrdemToDelete(os); setDeleteDialogOpen(true); }}
                        title={podeEditar ? "Excluir" : "Você não tem permissão para excluir"}
                        disabled={!podeEditar}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <OrdemServicoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        ordem={selectedOrdem}
        onSuccess={fetchOrdens}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a OS {ordemToDelete?.numero}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar todas as ordens de serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar TODAS as {ordens.filter(o => o.status !== "cancelada").length} ordem(ns) de serviço ativas?
              <br /><br />
              <span className="text-muted-foreground">
                As ordens canceladas ficarão no histórico mas não aparecerão para roteirização.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAll} className="bg-orange-600 text-white hover:bg-orange-700">
              Cancelar Todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportacaoOSDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={fetchOrdens}
      />

      {/* Dialog de Detalhes da OS */}
      <OrdemServicoDetalhesDialog
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        ordemId={ordemDetalhesId}
      />
    </MainLayout>
  );
};

export default OrdensServico;
