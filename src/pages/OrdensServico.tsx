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
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [ordens, setOrdens] = useState<OrdemWithTecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedOrdem, setSelectedOrdem] = useState<Tables<"ordens_servico"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ordemToDelete, setOrdemToDelete] = useState<Tables<"ordens_servico"> | null>(null);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Estados para seleção de OSs
  const [selectedOsIds, setSelectedOsIds] = useState<Set<string>>(new Set());
  const [cancelConfirmText, setCancelConfirmText] = useState("");
  
  // Filtros avançados (arrays para multi-seleção)
  const [showFilters, setShowFilters] = useState(false);
  const [execucaoInicio, setExecucaoInicio] = useState("");
  const [execucaoFim, setExecucaoFim] = useState("");
  const [prazoInicio, setPrazoInicio] = useState("");
  const [prazoFim, setPrazoFim] = useState("");
  const [equipeFilter, setEquipeFilter] = useState<string[]>([]);
  const [retornoFilter, setRetornoFilter] = useState<string[]>([]);
  const [coordenadasFilter, setCoordenadasFilter] = useState<string>("all");
  const [producaoFilter, setProducaoFilter] = useState<string>("all");
  const [territorioFilter, setTerritorioFilter] = useState<string[]>([]);
  const [centroCustoFilter, setCentroCustoFilter] = useState<string[]>([]);
  const [coordenadorFilter, setCoordenadorFilter] = useState<string[]>([]);
  const [supervisorFilter, setSupervisorFilter] = useState<string[]>([]);
  const [municipioFilter, setMunicipioFilter] = useState<string[]>([]);
  const [bairroFilter, setBairroFilter] = useState<string[]>([]);
  
  // Estados para controlar popovers dos filtros
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [tipoFilterOpen, setTipoFilterOpen] = useState(false);
  const [equipeFilterOpen, setEquipeFilterOpen] = useState(false);
  const [retornoFilterOpen, setRetornoFilterOpen] = useState(false);
  const [territorioFilterOpen, setTerritorioFilterOpen] = useState(false);
  const [centroCustoFilterOpen, setCentroCustoFilterOpen] = useState(false);
  const [coordenadorFilterOpen, setCoordenadorFilterOpen] = useState(false);
  const [supervisorFilterOpen, setSupervisorFilterOpen] = useState(false);
  const [municipioFilterOpen, setMunicipioFilterOpen] = useState(false);
  const [municipioSearchTerm, setMunicipioSearchTerm] = useState("");
  const [bairroFilterOpen, setBairroFilterOpen] = useState(false);
  const [bairroSearchTerm, setBairroSearchTerm] = useState("");
  
  // Opções dinâmicas para filtros (dependentes dos outros filtros)
  const [availableMunicipios, setAvailableMunicipios] = useState<string[]>([]);
  const [availableBairros, setAvailableBairros] = useState<string[]>([]);
  const [availableStatus, setAvailableStatus] = useState<string[]>([]);
  const [availableTipos, setAvailableTipos] = useState<string[]>([]);
  const [availableRetornos, setAvailableRetornos] = useState<string[]>([]);
  const [availableTerritorios, setAvailableTerritorios] = useState<string[]>([]);
  const [availableCentrosCusto, setAvailableCentrosCusto] = useState<string[]>([]);
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(false);
  
  // Dados para filtros
  const [equipes, setEquipes] = useState<{ id: string; codigo: string; nome: string; supervisor_id?: string; coordenador_id?: string; centro_custo_id?: string }[]>([]);
  const [retornos, setRetornos] = useState<{ id: string; codigo: string; descricao: string; tipo: string }[]>([]);
  const [skills, setSkills] = useState<{ codigo: string; nome: string }[]>([]);
  const [territorios, setTerritorios] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<{ id: string; codigo: string; nome: string }[]>([]);
  const [coordenadores, setCoordenadores] = useState<{ id: string; codigo: string; nome: string }[]>([]);
  const [supervisores, setSupervisores] = useState<{ id: string; codigo: string; nome: string; coordenador_id?: string }[]>([]);
  
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
  
  // Estados para exportação
  const [exportando, setExportando] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, fase: "" });

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
    // Status (multi-select)
    if (statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }
    
    // Tipo (multi-select)
    if (tipoFilter.length > 0) {
      query = query.in("tipo", tipoFilter);
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
    
    // Retorno de campo (multi-select)
    if (retornoFilter.length > 0) {
      if (retornoFilter.includes("sem_retorno")) {
        const outrosRetornos = retornoFilter.filter(r => r !== "sem_retorno");
        if (outrosRetornos.length > 0) {
          query = query.or(`retorno_campo_id.is.null,retorno_campo_id.in.(${outrosRetornos.join(",")})`);
        } else {
          query = query.is("retorno_campo_id", null);
        }
      } else {
        query = query.in("retorno_campo_id", retornoFilter);
      }
    }
    
    // Busca textual
    if (debouncedSearchTerm) {
      const term = `%${debouncedSearchTerm}%`;
      query = query.or(`numero.ilike.${term},endereco.ilike.${term},cliente_nome.ilike.${term},cliente_cpf.ilike.${term},instalacao.ilike.${term}`);
    }
    
    // Território (multi-select)
    if (territorioFilter.length > 0) {
      query = query.overlaps("territorios", territorioFilter);
    }
    
    // Município (multi-select)
    if (municipioFilter.length > 0) {
      query = query.in("municipio", municipioFilter);
    }
    
    // Bairro (multi-select)
    if (bairroFilter.length > 0) {
      query = query.in("bairro", bairroFilter);
    }
    
    // Centro de Custos (multi-select) - campo direto na tabela ordens_servico
    if (centroCustoFilter.length > 0) {
      query = query.in("centro_custo_id", centroCustoFilter);
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
    const activeEquipeFilter = equipeFilterParam !== undefined ? equipeFilterParam : equipeFilter;
    const activeProducaoFilter = producaoFilterParam || producaoFilter;
    
    // Filtro de equipe (multi-select array)
    if (Array.isArray(activeEquipeFilter) && activeEquipeFilter.length > 0) {
      ordensComProducao = ordensComProducao.filter(os => 
        os.tecnicos?.codigo && activeEquipeFilter.includes(os.tecnicos.codigo)
      );
    }
    
    // Filtro por Coordenador (filtra equipes que têm o coordenador selecionado)
    if (coordenadorFilter.length > 0) {
      // Buscar os IDs das equipes que têm os coordenadores selecionados
      // A relação pode ser direta (coordenador_id) ou via supervisor (supervisor -> coordenador_id)
      const equipesComCoordenador = equipes.filter(eq => 
        // Equipe tem coordenador direto selecionado
        eq.coordenador_id && coordenadorFilter.includes(eq.coordenador_id) ||
        // Ou equipe tem supervisor que está vinculado a um coordenador selecionado
        (eq.supervisor_id && supervisores.find(sup => 
          sup.id === eq.supervisor_id && sup.coordenador_id && coordenadorFilter.includes(sup.coordenador_id)
        ))
      ).map(eq => eq.codigo);
      
      if (equipesComCoordenador.length > 0) {
        ordensComProducao = ordensComProducao.filter(os => 
          os.tecnicos?.codigo && equipesComCoordenador.includes(os.tecnicos.codigo)
        );
      } else {
        // Se nenhuma equipe tem o coordenador, retorna vazio
        ordensComProducao = [];
      }
    }
    
    // Filtro por Supervisor (filtra equipes que têm o supervisor selecionado)
    if (supervisorFilter.length > 0) {
      const equipesComSupervisor = equipes.filter(eq => 
        eq.supervisor_id && supervisorFilter.includes(eq.supervisor_id)
      ).map(eq => eq.codigo);
      
      if (equipesComSupervisor.length > 0) {
        ordensComProducao = ordensComProducao.filter(os => 
          os.tecnicos?.codigo && equipesComSupervisor.includes(os.tecnicos.codigo)
        );
      } else {
        // Se nenhuma equipe tem o supervisor, retorna vazio
        ordensComProducao = [];
      }
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
    const [equipesRes, retornosRes, skillsRes, territoriosRes, centrosCustoRes, coordSupRes] = await Promise.all([
      supabase.from("tecnicos").select("id, codigo, nome, supervisor_id, coordenador_id, centro_custo_id").neq("status", "offline").order("codigo"),
      supabase.from("retornos_campo").select("id, codigo, descricao, tipo").eq("ativo", true).order("descricao"),
      supabase.from("skills").select("codigo, nome").eq("ativo", true).order("nome"),
      supabase.from("territorios").select("id, nome, cor").eq("ativo", true).order("nome"),
      supabase.from("centros_custo").select("id, codigo, nome").eq("ativo", true).order("nome"),
      supabase.from("coordenadores_supervisores").select("id, codigo, nome, tipo, coordenador_id").eq("ativo", true).order("nome"),
    ]);
    
    if (equipesRes.data) setEquipes(equipesRes.data);
    if (retornosRes.data) setRetornos(retornosRes.data);
    if (skillsRes.data) setSkills(skillsRes.data);
    if (territoriosRes.data) setTerritorios(territoriosRes.data);
    if (centrosCustoRes.data) setCentrosCusto(centrosCustoRes.data);
    if (coordSupRes.data) {
      setCoordenadores(coordSupRes.data.filter((cs: any) => cs.tipo === "coordenador"));
      setSupervisores(coordSupRes.data.filter((cs: any) => cs.tipo === "supervisor"));
    }
  };

  // Buscar opções dinâmicas para filtros - DEPENDENTES dos outros filtros ativos
  // Similar à tela de Roteirização: cada filtro considera os outros filtros
  const fetchDynamicFilterOptions = async () => {
    setLoadingFilterOptions(true);
    try {
      const PAGE_SIZE_FILTER = 1000;
      
      // Função auxiliar para aplicar TODOS os filtros a uma query (exceto o filtro especificado)
      const applyOtherFilters = (query: any, excludeFilter: string) => {
        // Filtros de array (multi-select)
        if (excludeFilter !== "status" && statusFilter.length > 0) {
          query = query.in("status", statusFilter);
        }
        if (excludeFilter !== "tipo" && tipoFilter.length > 0) {
          query = query.in("tipo", tipoFilter);
        }
        if (excludeFilter !== "municipio" && municipioFilter.length > 0) {
          query = query.in("municipio", municipioFilter);
        }
        if (excludeFilter !== "bairro" && bairroFilter.length > 0) {
          query = query.in("bairro", bairroFilter);
        }
        if (excludeFilter !== "retorno" && retornoFilter.length > 0 && !retornoFilter.includes("sem_retorno")) {
          query = query.in("retorno_campo_id", retornoFilter);
        }
        if (excludeFilter !== "territorio" && territorioFilter.length > 0) {
          query = query.overlaps("territorios", territorioFilter);
        }
        if (excludeFilter !== "centroCusto" && centroCustoFilter.length > 0) {
          query = query.in("centro_custo_id", centroCustoFilter);
        }
        // Filtros de data
        if (prazoInicio) {
          query = query.gte("prazo", prazoInicio);
        }
        if (prazoFim) {
          query = query.lte("prazo", prazoFim + "T23:59:59");
        }
        if (execucaoInicio) {
          query = query.gte("concluido_at", execucaoInicio);
        }
        if (execucaoFim) {
          query = query.lte("concluido_at", execucaoFim + "T23:59:59");
        }
        // Filtro de coordenadas
        if (coordenadasFilter === "com") {
          query = query.not("latitude", "is", null).not("longitude", "is", null);
        } else if (coordenadasFilter === "sem") {
          query = query.or("latitude.is.null,longitude.is.null");
        }
        return query;
      };
      
      // Função auxiliar para buscar todos os registros de um campo com paginação e filtros
      const fetchAllDistinct = async (field: string, excludeFilter: string, isUuid: boolean = false): Promise<any[]> => {
        let allData: any[] = [];
        let page = 0;
        let hasMore = true;
        
        while (hasMore) {
          const from = page * PAGE_SIZE_FILTER;
          const to = from + PAGE_SIZE_FILTER - 1;
          
          let query = supabase
            .from("ordens_servico")
            .select(field)
            .not(field, "is", null);
          
          // Só aplica neq vazio para campos de texto (não UUID)
          if (!isUuid) {
            query = query.neq(field, "");
          }
          
          query = applyOtherFilters(query, excludeFilter);
          query = query.range(from, to);
          
          const { data, error } = await query;
          
          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            hasMore = data.length === PAGE_SIZE_FILTER;
            page++;
          } else {
            hasMore = false;
          }
        }
        
        return allData;
      };
      
      // Função especial para territorios (é um array, não pode usar neq)
      const fetchAllTerritorios = async (): Promise<any[]> => {
        let allData: any[] = [];
        let page = 0;
        let hasMore = true;
        
        while (hasMore) {
          const from = page * PAGE_SIZE_FILTER;
          const to = from + PAGE_SIZE_FILTER - 1;
          
          let query = supabase
            .from("ordens_servico")
            .select("territorios")
            .not("territorios", "is", null);
          
          query = applyOtherFilters(query, "territorio");
          query = query.range(from, to);
          
          const { data, error } = await query;
          
          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            hasMore = data.length === PAGE_SIZE_FILTER;
            page++;
          } else {
            hasMore = false;
          }
        }
        
        return allData;
      };

      // Buscar todos os dados em paralelo - cada filtro exclui a si mesmo
      // Usar Promise.allSettled para não interromper se uma falhar
      const results = await Promise.allSettled([
        fetchAllDistinct("municipio", "municipio", false),
        fetchAllDistinct("bairro", "bairro", false),
        fetchAllDistinct("status", "status", false),
        fetchAllDistinct("tipo", "tipo", false),
        fetchAllDistinct("retorno_campo_id", "retorno", true), // UUID - não pode usar neq vazio
        fetchAllTerritorios(),
        fetchAllDistinct("centro_custo_id", "centroCusto", true), // UUID
      ]);
      
      const dataMunicipio = results[0].status === "fulfilled" ? results[0].value : [];
      const dataBairro = results[1].status === "fulfilled" ? results[1].value : [];
      const dataStatus = results[2].status === "fulfilled" ? results[2].value : [];
      const dataTipo = results[3].status === "fulfilled" ? results[3].value : [];
      const dataRetorno = results[4].status === "fulfilled" ? results[4].value : [];
      const dataTerritorio = results[5].status === "fulfilled" ? results[5].value : [];
      const dataCentroCusto = results[6].status === "fulfilled" ? results[6].value : [];

      // Extrair valores únicos (filtrando strings vazias)
      const setMunicipio = new Set<string>();
      dataMunicipio.forEach((os: any) => { 
        if (os.municipio && os.municipio.trim()) setMunicipio.add(os.municipio.trim()); 
      });
      setAvailableMunicipios(Array.from(setMunicipio).sort());

      const setBairro = new Set<string>();
      dataBairro.forEach((os: any) => { 
        if (os.bairro && os.bairro.trim()) setBairro.add(os.bairro.trim()); 
      });
      setAvailableBairros(Array.from(setBairro).sort());

      const setStatus = new Set<string>();
      dataStatus.forEach((os: any) => { if (os.status) setStatus.add(os.status); });
      setAvailableStatus(Array.from(setStatus));

      const setTipo = new Set<string>();
      dataTipo.forEach((os: any) => { if (os.tipo) setTipo.add(os.tipo); });
      setAvailableTipos(Array.from(setTipo));

      const setRetorno = new Set<string>();
      dataRetorno.forEach((os: any) => { if (os.retorno_campo_id) setRetorno.add(os.retorno_campo_id); });
      setAvailableRetornos(Array.from(setRetorno));

      const setTerritorio = new Set<string>();
      dataTerritorio.forEach((os: any) => { 
        if (os.territorios && Array.isArray(os.territorios)) {
          os.territorios.forEach((t: string) => { if (t && t.trim()) setTerritorio.add(t); });
        }
      });
      setAvailableTerritorios(Array.from(setTerritorio));

      const setCentroCusto = new Set<string>();
      dataCentroCusto.forEach((os: any) => { if (os.centro_custo_id) setCentroCusto.add(os.centro_custo_id); });
      setAvailableCentrosCusto(Array.from(setCentroCusto));
    } catch (err) {
      console.error("Erro ao buscar opções de filtros:", err);
    } finally {
      setLoadingFilterOptions(false);
    }
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
    fetchDynamicFilterOptions();
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
    producaoFilter,
    territorioFilter,
    centroCustoFilter,
    coordenadorFilter,
    supervisorFilter,
    municipioFilter,
    bairroFilter
  ]);
  
  // Atualizar opções dos filtros quando QUALQUER filtro mudar (todos são dependentes)
  useEffect(() => {
    fetchDynamicFilterOptions();
  }, [
    statusFilter,
    tipoFilter,
    retornoFilter,
    territorioFilter,
    centroCustoFilter,
    municipioFilter,
    bairroFilter,
    prazoInicio,
    prazoFim,
    execucaoInicio,
    execucaoFim,
    coordenadasFilter
  ]);
  
  // Limpar filtros
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter([]);
    setTipoFilter([]);
    setExecucaoInicio("");
    setExecucaoFim("");
    setPrazoInicio("");
    setPrazoFim("");
    setEquipeFilter([]);
    setRetornoFilter([]);
    setCoordenadasFilter("all");
    setProducaoFilter("all");
    setTerritorioFilter([]);
    setCentroCustoFilter([]);
    setCoordenadorFilter([]);
    setSupervisorFilter([]);
    setMunicipioFilter([]);
    setBairroFilter([]);
  };
  
  // Contar filtros ativos
  const activeFiltersCount = [
    statusFilter.length > 0,
    tipoFilter.length > 0,
    execucaoInicio !== "",
    execucaoFim !== "",
    prazoInicio !== "",
    prazoFim !== "",
    equipeFilter.length > 0,
    retornoFilter.length > 0,
    coordenadasFilter !== "all",
    producaoFilter !== "all",
    territorioFilter.length > 0,
    centroCustoFilter.length > 0,
    coordenadorFilter.length > 0,
    supervisorFilter.length > 0,
    municipioFilter.length > 0,
    bairroFilter.length > 0,
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

  // Função para exportar TODAS as OSs filtradas em CSV (mais rápido e menor)
  const handleExportar = async () => {
    try {
      setExportando(true);
      setExportProgress({ current: 0, total: totalCount, fase: "Preparando exportação..." });
      
      const PAGE_SIZE_EXPORT = 1000;
      let allOrdens: any[] = [];
      let page = 0;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE_EXPORT);
      
      setExportProgress({ current: 0, total: totalCount, fase: "Buscando ordens de serviço..." });
      
      // Buscar TODOS os campos
      while (page < totalPages) {
        const from = page * PAGE_SIZE_EXPORT;
        const to = from + PAGE_SIZE_EXPORT - 1;
        
        let query = supabase
          .from("ordens_servico")
          .select(`
            *,
            tecnicos:tecnico_id(codigo,nome),
            retornos_campo:retorno_campo_id(codigo,descricao,tipo),
            centros_custo:centro_custo_id(codigo,nome),
            contratos:contrato_id(codigo,nome)
          `);
        
        query = applyFiltersToQuery(query);
        query = query.order("created_at", { ascending: false }).range(from, to);
        
        const { data, error } = await query;
        
        if (error) {
          console.error("Erro ao buscar OSs:", error);
          toast.error("Erro ao exportar");
          setExportando(false);
          return;
        }
        
        if (data && data.length > 0) {
          allOrdens = allOrdens.concat(data);
          setExportProgress({ 
            current: allOrdens.length, 
            total: totalCount, 
            fase: `Carregando (${allOrdens.length.toLocaleString()}/${totalCount.toLocaleString()})...` 
          });
        }
        
        page++;
        if (!data || data.length === 0) break;
      }
      
      if (allOrdens.length === 0) {
        toast.warning("Nenhuma OS encontrada");
        setExportando(false);
        return;
      }
      
      // Buscar produção em lotes (batch menor para evitar URL muito grande com UUIDs)
      setExportProgress({ current: 0, total: allOrdens.length, fase: "Buscando produção..." });
      const ordensIds = allOrdens.map(o => o.id);
      const producaoMap = new Map<string, any>();
      const BATCH_SIZE = 100; // Reduzido de 1000 para 100 - UUIDs são grandes (36 chars cada)
      
      for (let i = 0; i < ordensIds.length; i += BATCH_SIZE) {
        const batchIds = ordensIds.slice(i, i + BATCH_SIZE);
        try {
          const { data: producaoData, error: producaoError } = await supabase
            .from("producao_equipes")
            .select(`ordem_servico_id,valor_total,created_at,tecnicos:equipe_id(codigo,nome)`)
            .in("ordem_servico_id", batchIds);
          
          if (producaoError) {
            console.error(`[Exportar] Erro ao buscar produção (lote ${i}-${i+BATCH_SIZE}):`, producaoError);
          }
          
          if (producaoData && producaoData.length > 0) {
            producaoData.forEach(p => {
              producaoMap.set(p.ordem_servico_id, p);
            });
          }
        } catch (err) {
          console.error(`[Exportar] Exceção ao buscar produção (lote ${i}-${i+BATCH_SIZE}):`, err);
        }
        
        if (i % 500 === 0 || i + BATCH_SIZE >= ordensIds.length) {
          setExportProgress({ 
            current: Math.min(i + BATCH_SIZE, ordensIds.length), 
            total: ordensIds.length, 
            fase: `Produção (${Math.min(i + BATCH_SIZE, ordensIds.length).toLocaleString()}/${ordensIds.length.toLocaleString()})...` 
          });
        }
      }
      
      console.log(`[Exportar] Total de produções mapeadas: ${producaoMap.size} de ${ordensIds.length} OSs`);
      
      // Buscar planejamentos em lotes (usa mesmo BATCH_SIZE)
      setExportProgress({ current: 0, total: allOrdens.length, fase: "Buscando planejamentos..." });
      const planejamentoMap = new Map<string, any>();
      
      for (let i = 0; i < ordensIds.length; i += BATCH_SIZE) {
        const batchIds = ordensIds.slice(i, i + BATCH_SIZE);
        try {
          const { data: planejamentoData, error: planejamentoError } = await supabase
            .from("planejamento_ordens")
            .select(`ordem_servico_id,ordem_na_rota,planejamentos:planejamento_id(data_planejamento),tecnicos:equipe_id(codigo,nome)`)
            .in("ordem_servico_id", batchIds);
          
          if (planejamentoError) {
            console.error(`[Exportar] Erro ao buscar planejamento (lote ${i}-${i+BATCH_SIZE}):`, planejamentoError);
          }
          
          if (planejamentoData && planejamentoData.length > 0) {
            planejamentoData.forEach(p => planejamentoMap.set(p.ordem_servico_id, p));
          }
        } catch (err) {
          console.error(`[Exportar] Exceção ao buscar planejamento (lote ${i}-${i+BATCH_SIZE}):`, err);
        }
        
        if (i % 500 === 0 || i + BATCH_SIZE >= ordensIds.length) {
          setExportProgress({ 
            current: Math.min(i + BATCH_SIZE, ordensIds.length), 
            total: ordensIds.length, 
            fase: `Planejamentos (${Math.min(i + BATCH_SIZE, ordensIds.length).toLocaleString()}/${ordensIds.length.toLocaleString()})...` 
          });
        }
      }
      
      // Gerar CSV (muito mais leve que XLSX)
      setExportProgress({ current: 0, total: allOrdens.length, fase: "Gerando CSV..." });
      
      const formatarData = (data: string | null) => {
        if (!data) return "";
        return new Date(data).toLocaleString("pt-BR");
      };
      
      // Headers completos
      const headers = [
        "Codigo","Numero","Tipo","Nome_Tipo","Grupo_Servico","Status","Prioridade","Avulsa",
        "Cliente_Nome","Cliente_CPF","Cliente_Telefone","Instalacao","Medidor","Tensao_Medicao",
        "Endereco","Numero_End","Complemento","Bairro","Municipio","UF","CEP","Zona_Cadastral",
        "Latitude","Longitude","Territorios",
        "Prazo","Data_Geracao","Data_Criacao","Data_Inicio","Data_Conclusao","Data_Atualizacao",
        "Tempo_Estimado_Min","Tempo_Total_Min","Valor_OS","Regulada",
        "Contrato_Codigo","Contrato_Nome","CC_Codigo","CC_Nome",
        "Tecnico_Codigo","Tecnico_Nome",
        "Equipe_Plan_Codigo","Equipe_Plan_Nome","Data_Planejamento","Ordem_Rota",
        "Equipe_Exec_Codigo","Equipe_Exec_Nome","Data_Execucao","Valor_Producao",
        "Retorno_Codigo","Retorno_Descricao","Retorno_Tipo",
        "Observacoes"
      ];
      
      // Função para escapar campos CSV
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      // Montar linhas CSV
      const linhas: string[] = [headers.join(";")];
      
      allOrdens.forEach((os, index) => {
        if (index % 2000 === 0) {
          setExportProgress({ 
            current: index, 
            total: allOrdens.length, 
            fase: `Processando (${index.toLocaleString()}/${allOrdens.length.toLocaleString()})...` 
          });
        }
        
        const producao = producaoMap.get(os.id);
        const planejamento = planejamentoMap.get(os.id);
        
        const linha = [
          os.codigo || "",
          os.numero || "",
          os.tipo || "",
          skillsMap[os.tipo?.toLowerCase()] || skillsMap[os.tipo?.toUpperCase()] || "",
          os.grupo_servico || "",
          os.status || "",
          os.prioridade || "",
          os.avulsa ? "Sim" : "Não",
          os.cliente_nome || "",
          os.cliente_cpf || "",
          os.cliente_telefone || "",
          os.instalacao || "",
          os.medidor || "",
          os.tensao_medicao || "",
          os.endereco || "",
          os.numero_endereco || "",
          os.complemento || "",
          os.bairro || "",
          os.municipio || "",
          os.uf || "",
          os.cep || "",
          os.zona_cadastral || "",
          os.latitude || "",
          os.longitude || "",
          os.territorios?.join(", ") || "",
          formatarData(os.prazo),
          formatarData(os.data_geracao),
          formatarData(os.created_at),
          formatarData(os.iniciado_at),
          formatarData(os.concluido_at),
          formatarData(os.updated_at),
          os.duracao_estimada || "",
          os.tempo_total_minutos || "",
          os.valor ? String(os.valor).replace(".", ",") : "",
          os.regulada ? "Sim" : "Não",
          os.contratos?.codigo || "",
          os.contratos?.nome || "",
          os.centros_custo?.codigo || "",
          os.centros_custo?.nome || "",
          os.tecnicos?.codigo || "",
          os.tecnicos?.nome || "",
          planejamento?.tecnicos?.codigo || "",
          planejamento?.tecnicos?.nome || "",
          planejamento?.planejamentos?.data_planejamento ? new Date(planejamento.planejamentos.data_planejamento).toLocaleDateString("pt-BR") : "",
          planejamento?.ordem_na_rota || "",
          producao?.tecnicos?.codigo || "",
          producao?.tecnicos?.nome || "",
          producao?.created_at ? new Date(producao.created_at).toLocaleDateString("pt-BR") : "",
          producao?.valor_total !== undefined && producao?.valor_total !== null ? String(producao.valor_total).replace(".", ",") : "",
          os.retornos_campo?.codigo || "",
          os.retornos_campo?.descricao || "",
          os.retornos_campo?.tipo || "",
          os.observacoes || ""
        ].map(escapeCsv);
        
        linhas.push(linha.join(";"));
      });
      
      setExportProgress({ current: allOrdens.length, total: allOrdens.length, fase: "Baixando arquivo..." });
      
      // Criar e baixar CSV
      const csvContent = "\uFEFF" + linhas.join("\n"); // BOM para UTF-8
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ordens_servico_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`${allOrdens.length.toLocaleString()} OSs exportadas!`);
      
    } catch (error: any) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar: " + (error.message || "Erro desconhecido"));
    } finally {
      setExportando(false);
      setExportProgress({ current: 0, total: 0, fase: "" });
    }
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
      // Montar endereço completo para exibição
      const enderecoCompleto = [
        os.endereco,
        (os as any).bairro,
        (os as any).municipio
      ].filter(Boolean).join(', ');
      
      setGeocodingProgress({ 
        current: i + 1, 
        total: ordensSemCoordenadas.length, 
        endereco: enderecoCompleto 
      });

      try {
        // Passa endereço, bairro e município para melhor precisão
        const result = await geocodeAddress(
          os.endereco, 
          (os as any).bairro, 
          (os as any).municipio
        );
        
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

  // Funções de seleção de OSs
  const selectAllVisible = () => {
    const newSelected = new Set(selectedOsIds);
    sortedOrdens.forEach(os => newSelected.add(os.id));
    setSelectedOsIds(newSelected);
  };

  const selectAllFiltered = async () => {
    // Buscar todos os IDs filtrados com paginação (não só os visíveis)
    const PAGE_SIZE_SELECT = 1000;
    let allIds: string[] = [];
    let page = 0;
    let hasMore = true;
    
    toast.info("Buscando todas as OSs filtradas...");
    
    while (hasMore) {
      const from = page * PAGE_SIZE_SELECT;
      const to = from + PAGE_SIZE_SELECT - 1;
      
      let query = supabase.from("ordens_servico").select("id");
      query = applyFiltersToQuery(query);
      query = query.range(from, to);
      
      const { data, error } = await query;
      
      if (error) {
        toast.error("Erro ao buscar OSs");
        console.error(error);
        return;
      }
      
      if (data && data.length > 0) {
        allIds = [...allIds, ...data.map((os: any) => os.id)];
        hasMore = data.length === PAGE_SIZE_SELECT;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    if (allIds.length > 0) {
      const newSelected = new Set(selectedOsIds);
      allIds.forEach(id => newSelected.add(id));
      setSelectedOsIds(newSelected);
      toast.success(`${allIds.length} OSs selecionadas`);
    }
  };

  const clearSelection = () => {
    setSelectedOsIds(new Set());
  };

  const toggleOsSelection = (osId: string) => {
    const newSelected = new Set(selectedOsIds);
    if (newSelected.has(osId)) {
      newSelected.delete(osId);
    } else {
      newSelected.add(osId);
    }
    setSelectedOsIds(newSelected);
  };

  const isAllVisibleSelected = sortedOrdens.length > 0 && sortedOrdens.every(os => selectedOsIds.has(os.id));

  // Cancelar OSs selecionadas (updates individuais em paralelo)
  const handleCancelSelectedOs = async () => {
    if (selectedOsIds.size === 0) return;
    
    const idsArray = Array.from(selectedOsIds);
    const CONCURRENT_LIMIT = 10; // Limite de requisições simultâneas
    let totalCanceladas = 0;
    let hasError = false;
    
    toast.info(`Cancelando ${idsArray.length} OSs...`);
    
    // Processar em grupos de CONCURRENT_LIMIT requisições simultâneas
    for (let i = 0; i < idsArray.length; i += CONCURRENT_LIMIT) {
      const batch = idsArray.slice(i, i + CONCURRENT_LIMIT);
      
      const results = await Promise.allSettled(
        batch.map(id => 
          supabase
            .from("ordens_servico")
            .update({ status: "cancelada" })
            .eq("id", id)
        )
      );
      
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && !result.value.error) {
          totalCanceladas++;
        } else {
          console.error("Erro ao cancelar OS:", batch[index], result);
          hasError = true;
        }
      });
    }

    if (hasError) {
      toast.error(`Erro ao cancelar algumas ordens. ${totalCanceladas} foram canceladas.`);
    } else {
      toast.success(`${totalCanceladas} ordem(ns) de serviço cancelada(s)`);
    }
    
    setSelectedOsIds(new Set());
    setClearAllDialogOpen(false);
    setCancelConfirmText("");
    fetchOrdens(0, false);
  };

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
    >
      {/* Actions Bar */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        {/* Linha 1: Busca */}
        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, código, endereço, cliente, CPF, instalação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button 
            className="gap-1.5" 
            onClick={() => { setSelectedOrdem(null); setFormOpen(true); }}
            disabled={!podeEditar}
            title={!podeEditar ? "Você não tem permissão para criar" : undefined}
          >
            <Plus className="h-4 w-4" />
            Nova OS
          </Button>
        </div>

        {/* Linha 2: Todos os botões de ação */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <Button 
            variant={showFilters ? "default" : "outline"} 
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
          
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1 px-2">
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}

          <div className="w-px h-6 bg-border mx-1" />

          <Button 
            variant="outline" 
            size="sm"
            className="gap-1.5"
            onClick={handleExportar}
            disabled={exportando || totalCount === 0}
            title={`Exportar ${totalCount.toLocaleString()} OS(s)`}
          >
            {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadModel}>
            <FileText className="h-3.5 w-3.5" />
            Modelo
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="gap-1.5" 
            onClick={() => setImportDialogOpen(true)}
            disabled={!podeEditar}
            title={!podeEditar ? "Sem permissão" : "Importar OSs"}
          >
            <Upload className="h-3.5 w-3.5" />
            Importar
          </Button>
          {ordensSemCoordenadas.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              className="gap-1.5" 
              onClick={handleGeocodeAll}
              disabled={geocodingInProgress}
            >
              {geocodingInProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
              Geo ({ordensSemCoordenadas.length})
            </Button>
          )}

          <div className="w-px h-6 bg-border mx-1" />

          <Button 
            variant="outline" 
            size="sm"
            className="gap-1.5"
            onClick={selectAllVisible}
            title="Selecionar OSs visíveis"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Visíveis
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="gap-1.5"
            onClick={selectAllFiltered}
            title={`Selecionar todas ${totalCount.toLocaleString()} OSs filtradas`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Todas ({totalCount.toLocaleString()})
          </Button>
          {selectedOsIds.size > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              className="gap-1 px-2"
              onClick={clearSelection}
            >
              <Square className="h-3.5 w-3.5" />
              Limpar ({selectedOsIds.size})
            </Button>
          )}
          <Button 
            variant="destructive" 
            size="sm"
            className="gap-1.5" 
            onClick={() => setClearAllDialogOpen(true)}
            disabled={!podeEditar || selectedOsIds.size === 0}
            title={selectedOsIds.size === 0 ? "Selecione OSs" : `Cancelar ${selectedOsIds.size} OS(s)`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Cancelar ({selectedOsIds.size})
          </Button>
        </div>

        {/* Painel de filtros avançados */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {/* Status - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {statusFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todos</span>
                      ) : statusFilter.length === 1 ? (
                        statusLabels[statusFilter[0]] || statusFilter[0]
                      ) : (
                        `${statusFilter.length} selecionados`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar status..." />
                      <CommandList>
                        <CommandEmpty>Nenhum status encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setStatusFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          {Object.entries(statusLabels).filter(([key]) => availableStatus.length === 0 || availableStatus.includes(key)).map(([key, label]) => {
                            const isSelected = statusFilter.includes(key);
                            return (
                              <CommandItem key={key} onSelect={() => {
                                if (isSelected) {
                                  setStatusFilter(statusFilter.filter(s => s !== key));
                                } else {
                                  setStatusFilter([...statusFilter, key]);
                                }
                              }}>
                                <Checkbox checked={isSelected} className="mr-2" />
                                {label}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Tipo de Serviço - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo de Serviço</label>
                <Popover open={tipoFilterOpen} onOpenChange={setTipoFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {tipoFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todos</span>
                      ) : tipoFilter.length === 1 ? (
                        skills.find(s => s.codigo.toLowerCase() === tipoFilter[0])?.nome || tipoFilter[0]
                      ) : (
                        `${tipoFilter.length} selecionados`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar tipo..." />
                      <CommandList>
                        <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setTipoFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          {skills.filter(skill => availableTipos.length === 0 || availableTipos.includes(skill.codigo.toLowerCase())).map((skill) => {
                            const isSelected = tipoFilter.includes(skill.codigo.toLowerCase());
                            return (
                              <CommandItem key={skill.codigo} onSelect={() => {
                                const val = skill.codigo.toLowerCase();
                                if (isSelected) {
                                  setTipoFilter(tipoFilter.filter(t => t !== val));
                                } else {
                                  setTipoFilter([...tipoFilter, val]);
                                }
                              }}>
                                <Checkbox checked={isSelected} className="mr-2" />
                                {skill.nome}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Equipe - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Equipe
                </label>
                <Popover open={equipeFilterOpen} onOpenChange={setEquipeFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {equipeFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todas</span>
                      ) : equipeFilter.length === 1 ? (
                        equipes.find(e => e.codigo === equipeFilter[0])?.codigo || equipeFilter[0]
                      ) : (
                        `${equipeFilter.length} selecionadas`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar equipe..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma equipe encontrada.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setEquipeFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          {equipes.map((equipe) => {
                            const isSelected = equipeFilter.includes(equipe.codigo);
                            return (
                              <CommandItem key={equipe.id} onSelect={() => {
                                if (isSelected) {
                                  setEquipeFilter(equipeFilter.filter(e => e !== equipe.codigo));
                                } else {
                                  setEquipeFilter([...equipeFilter, equipe.codigo]);
                                }
                              }}>
                                <Checkbox checked={isSelected} className="mr-2" />
                                {equipe.codigo} - {equipe.nome}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Retorno de Campo - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Retorno de Campo</label>
                <Popover open={retornoFilterOpen} onOpenChange={setRetornoFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {retornoFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todos</span>
                      ) : retornoFilter.length === 1 ? (
                        retornoFilter[0] === "sem_retorno" ? "Sem Retorno" : 
                        retornos.find(r => r.id === retornoFilter[0])?.descricao || retornoFilter[0]
                      ) : (
                        `${retornoFilter.length} selecionados`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar retorno..." />
                      <CommandList>
                        <CommandEmpty>Nenhum retorno encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setRetornoFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          <CommandItem onSelect={() => {
                            if (retornoFilter.includes("sem_retorno")) {
                              setRetornoFilter(retornoFilter.filter(r => r !== "sem_retorno"));
                            } else {
                              setRetornoFilter([...retornoFilter, "sem_retorno"]);
                            }
                          }}>
                            <Checkbox checked={retornoFilter.includes("sem_retorno")} className="mr-2" />
                            Sem Retorno
                          </CommandItem>
                          {retornos.filter(ret => availableRetornos.length === 0 || availableRetornos.includes(ret.id)).map((retorno) => {
                            const isSelected = retornoFilter.includes(retorno.id);
                            return (
                              <CommandItem key={retorno.id} onSelect={() => {
                                if (isSelected) {
                                  setRetornoFilter(retornoFilter.filter(r => r !== retorno.id));
                                } else {
                                  setRetornoFilter([...retornoFilter, retorno.id]);
                                }
                              }}>
                                <Checkbox checked={isSelected} className="mr-2" />
                                {retorno.descricao}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                    <SelectItem value="all"><span className="text-muted-foreground">Todas</span></SelectItem>
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
                    <SelectItem value="all"><span className="text-muted-foreground">Todas</span></SelectItem>
                    <SelectItem value="com">Com Produção</SelectItem>
                    <SelectItem value="sem">Sem Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Território - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Território</label>
                <Popover open={territorioFilterOpen} onOpenChange={setTerritorioFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {territorioFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todos</span>
                      ) : territorioFilter.length === 1 ? (
                        territorios.find(t => t.id === territorioFilter[0])?.nome || territorioFilter[0]
                      ) : (
                        `${territorioFilter.length} selecionados`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar território..." />
                      <CommandList>
                        <CommandEmpty>Nenhum território encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setTerritorioFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          {territorios.filter(ter => availableTerritorios.length === 0 || availableTerritorios.includes(ter.id)).map((territorio) => {
                            const isSelected = territorioFilter.includes(territorio.id);
                            return (
                              <CommandItem key={territorio.id} onSelect={() => {
                                if (isSelected) {
                                  setTerritorioFilter(territorioFilter.filter(t => t !== territorio.id));
                                } else {
                                  setTerritorioFilter([...territorioFilter, territorio.id]);
                                }
                              }}>
                                <Checkbox checked={isSelected} className="mr-2" />
                                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: territorio.cor }} />
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

              {/* Município - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Município</label>
                <Popover open={municipioFilterOpen} onOpenChange={(open) => {
                  setMunicipioFilterOpen(open);
                  if (!open) setMunicipioSearchTerm("");
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {municipioFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todos</span>
                      ) : municipioFilter.length === 1 ? (
                        municipioFilter[0]
                      ) : (
                        `${municipioFilter.length} selecionados`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Buscar município..." 
                        value={municipioSearchTerm}
                        onValueChange={setMunicipioSearchTerm}
                      />
                      <CommandList className="max-h-[400px]">
                        <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setMunicipioFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          {availableMunicipios
                            .filter(m => m.toLowerCase().includes(municipioSearchTerm.toLowerCase()))
                            .map((municipio) => {
                            const isSelected = municipioFilter.includes(municipio);
                            return (
                              <CommandItem key={municipio} onSelect={() => {
                                if (isSelected) {
                                  setMunicipioFilter(municipioFilter.filter(m => m !== municipio));
                                } else {
                                  setMunicipioFilter([...municipioFilter, municipio]);
                                }
                              }}>
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

              {/* Bairro - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Bairro</label>
                <Popover open={bairroFilterOpen} onOpenChange={(open) => {
                  setBairroFilterOpen(open);
                  if (!open) setBairroSearchTerm("");
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {bairroFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todos</span>
                      ) : bairroFilter.length === 1 ? (
                        bairroFilter[0]
                      ) : (
                        `${bairroFilter.length} selecionados`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Buscar bairro..." 
                        value={bairroSearchTerm}
                        onValueChange={setBairroSearchTerm}
                      />
                      <CommandList className="max-h-[400px]">
                        <CommandEmpty>Nenhum bairro encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setBairroFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          {availableBairros
                            .filter(b => b.toLowerCase().includes(bairroSearchTerm.toLowerCase()))
                            .map((bairro) => {
                            const isSelected = bairroFilter.includes(bairro);
                            return (
                              <CommandItem key={bairro} onSelect={() => {
                                if (isSelected) {
                                  setBairroFilter(bairroFilter.filter(b => b !== bairro));
                                } else {
                                  setBairroFilter([...bairroFilter, bairro]);
                                }
                              }}>
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

              {/* Centro de Custos - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Centro de Custos</label>
                <Popover open={centroCustoFilterOpen} onOpenChange={setCentroCustoFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {centroCustoFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todos</span>
                      ) : centroCustoFilter.length === 1 ? (
                        centrosCusto.find(cc => cc.id === centroCustoFilter[0])?.nome || centroCustoFilter[0]
                      ) : (
                        `${centroCustoFilter.length} selecionados`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar centro de custos..." />
                      <CommandList>
                        <CommandEmpty>Nenhum centro de custos encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setCentroCustoFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          {centrosCusto
                            .filter(cc => availableCentrosCusto.length === 0 || availableCentrosCusto.includes(cc.id))
                            .map((cc) => {
                            const isSelected = centroCustoFilter.includes(cc.id);
                            return (
                              <CommandItem key={cc.id} onSelect={() => {
                                if (isSelected) {
                                  setCentroCustoFilter(centroCustoFilter.filter(c => c !== cc.id));
                                } else {
                                  setCentroCustoFilter([...centroCustoFilter, cc.id]);
                                }
                              }}>
                                <Checkbox checked={isSelected} className="mr-2" />
                                {cc.codigo} - {cc.nome}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Coordenador - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Coordenador</label>
                <Popover open={coordenadorFilterOpen} onOpenChange={setCoordenadorFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {coordenadorFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todos</span>
                      ) : coordenadorFilter.length === 1 ? (
                        coordenadores.find(c => c.id === coordenadorFilter[0])?.nome || coordenadorFilter[0]
                      ) : (
                        `${coordenadorFilter.length} selecionados`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar coordenador..." />
                      <CommandList>
                        <CommandEmpty>Nenhum coordenador encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setCoordenadorFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          {coordenadores.map((coord) => {
                            const isSelected = coordenadorFilter.includes(coord.id);
                            return (
                              <CommandItem key={coord.id} onSelect={() => {
                                if (isSelected) {
                                  setCoordenadorFilter(coordenadorFilter.filter(c => c !== coord.id));
                                } else {
                                  setCoordenadorFilter([...coordenadorFilter, coord.id]);
                                }
                              }}>
                                <Checkbox checked={isSelected} className="mr-2" />
                                {coord.nome}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Supervisor - Multi-select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Supervisor</label>
                <Popover open={supervisorFilterOpen} onOpenChange={setSupervisorFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between text-left font-normal">
                      {supervisorFilter.length === 0 ? (
                        <span className="text-muted-foreground">Todos</span>
                      ) : supervisorFilter.length === 1 ? (
                        supervisores.find(s => s.id === supervisorFilter[0])?.nome || supervisorFilter[0]
                      ) : (
                        `${supervisorFilter.length} selecionados`
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar supervisor..." />
                      <CommandList>
                        <CommandEmpty>Nenhum supervisor encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setSupervisorFilter([])}>
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          {supervisores.map((sup) => {
                            const isSelected = supervisorFilter.includes(sup.id);
                            return (
                              <CommandItem key={sup.id} onSelect={() => {
                                if (isSelected) {
                                  setSupervisorFilter(supervisorFilter.filter(s => s !== sup.id));
                                } else {
                                  setSupervisorFilter([...supervisorFilter, sup.id]);
                                }
                              }}>
                                <Checkbox checked={isSelected} className="mr-2" />
                                {sup.nome}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
            {selectedOsIds.size > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                • {selectedOsIds.size} OS(s) selecionada(s)
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

        {/* Barra de progresso de exportação */}
        {exportando && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-green-600" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Exportando ordens de serviço...
              </span>
              {exportProgress.total > 0 && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  {exportProgress.current} de {exportProgress.total}
                </span>
              )}
            </div>
            <Progress 
              value={exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0} 
              className="h-2"
            />
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              {exportProgress.fase}
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
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={isAllVisibleSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllVisible();
                      } else {
                        // Desmarcar apenas as visíveis
                        const visibleIds = new Set(sortedOrdens.map(os => os.id));
                        setSelectedOsIds(new Set([...selectedOsIds].filter(id => !visibleIds.has(id))));
                      }
                    }}
                  />
                </TableHead>
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
                <TableRow 
                  key={os.id} 
                  className={`hover:bg-muted/50 transition-colors ${selectedOsIds.has(os.id) ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                >
                  <TableCell>
                    <Checkbox 
                      checked={selectedOsIds.has(os.id)}
                      onCheckedChange={() => toggleOsSelection(os.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {(os as any).codigo || "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {os.regulada && <Zap className="h-4 w-4 text-danger" />}
                      {os.numero}
                      {((os as any).avulsa || os.numero.startsWith("AVL-")) && (
                        <Badge className="text-[10px] bg-violet-600 hover:bg-violet-700 px-1">AVULSA</Badge>
                      )}
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
                      <div className="flex flex-col">
                        <span className="truncate max-w-[200px]">{os.endereco}</span>
                        {((os as any).bairro || (os as any).municipio) && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {(os as any).bairro}{(os as any).bairro && (os as any).municipio && " - "}{(os as any).municipio}
                          </span>
                        )}
                      </div>
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

      <AlertDialog open={clearAllDialogOpen} onOpenChange={(open) => {
        setClearAllDialogOpen(open);
        if (!open) setCancelConfirmText("");
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Cancelar ordens de serviço selecionadas
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-base">
                  Você está prestes a cancelar <strong className="text-red-600">{selectedOsIds.size}</strong> ordem(ns) de serviço.
                </p>
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                    ⚠️ ATENÇÃO: Esta ação NÃO pode ser desfeita!
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    As ordens canceladas permanecerão no histórico mas não estarão disponíveis para roteirização.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Para confirmar, digite <strong className="text-red-600">CONFIRMAR</strong> abaixo:
                  </label>
                  <Input
                    value={cancelConfirmText}
                    onChange={(e) => setCancelConfirmText(e.target.value)}
                    placeholder="Digite CONFIRMAR"
                    className="border-red-300 focus:border-red-500"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleCancelSelectedOs}
              disabled={cancelConfirmText !== "CONFIRMAR"}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar Cancelamento
            </Button>
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
