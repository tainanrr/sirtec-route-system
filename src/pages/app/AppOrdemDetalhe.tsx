import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { logApp } from "@/lib/logUtils";
import { usePageState } from "@/contexts/ScrollRestoreContext";
import { getAppParentRoute } from "@/lib/appNavigation";
import { useRetornoCampo } from "@/hooks/useRetornoCampo";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData, CACHE_KEYS } from "@/hooks/useOfflineData";
import { useOfflineOperations } from "@/hooks/useOfflineOperations";
import RetornoCampoSelector from "@/components/app/RetornoCampoSelector";
import ChecklistServicoSheet from "@/components/app/ChecklistServicoSheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  User,
  Clock,
  Play,
  CheckCircle,
  CheckCircle2,
  Camera,
  Navigation,
  Package,
  Truck,
  AlertTriangle,
  Loader2,
  XCircle,
  ClipboardCheck,
  StopCircle,
  ChevronRight,
  List,
  Phone,
  Image as ImageIcon,
  MessageSquare,
  Info,
  Flag,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { processImageWithStamp, getCurrentLocation } from "@/lib/imageUtils";

// Configuração de status simplificada
const statusConfig: Record<string, { 
  label: string; 
  color: string; 
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  pendente: { label: "Pendente", color: "bg-slate-500", bgColor: "bg-slate-50", textColor: "text-slate-700", borderColor: "border-slate-200" },
  planejada: { label: "Planejada", color: "bg-blue-500", bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-blue-200" },
  em_deslocamento: { label: "Em Deslocamento", color: "bg-orange-500", bgColor: "bg-orange-50", textColor: "text-orange-700", borderColor: "border-orange-200" },
  no_local: { label: "No Local", color: "bg-purple-500", bgColor: "bg-purple-50", textColor: "text-purple-700", borderColor: "border-purple-200" },
  em_andamento: { label: "Em Execução", color: "bg-blue-600", bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-blue-200" },
  em_execucao: { label: "Em Execução", color: "bg-blue-600", bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-blue-200" },
  pausada: { label: "Pausada", color: "bg-amber-500", bgColor: "bg-amber-50", textColor: "text-amber-700", borderColor: "border-amber-200" },
  concluida: { label: "Concluída", color: "bg-green-500", bgColor: "bg-green-50", textColor: "text-green-700", borderColor: "border-green-200" },
  cancelada: { label: "Cancelada", color: "bg-red-500", bgColor: "bg-red-50", textColor: "text-red-700", borderColor: "border-red-200" },
};

// Fluxo de status
const statusFlow: Record<string, string[]> = {
  pendente: ["em_deslocamento"],
  planejada: ["em_deslocamento"],
  em_deslocamento: ["no_local"],
  no_local: ["em_execucao"],
  em_andamento: ["concluida"],
  em_execucao: ["concluida"],
  pausada: ["em_execucao", "em_deslocamento"],
  concluida: [],
  cancelada: [],
};

// Labels para botões de ação
const actionLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  em_deslocamento: { label: "Iniciar Deslocamento", icon: Truck, color: "bg-orange-500 hover:bg-orange-600" },
  no_local: { label: "Cheguei no Local", icon: MapPin, color: "bg-purple-600 hover:bg-purple-700" },
  em_execucao: { label: "Iniciar Serviço", icon: Play, color: "bg-blue-600 hover:bg-blue-700" },
  concluida: { label: "Concluir Serviço", icon: CheckCircle, color: "bg-green-600 hover:bg-green-700" },
};

export default function AppOrdemDetalhe() {
  const { id: rawId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const { isOnline, queueOperation, saveToCache, getFromCache, pendingOperations, resolveLocalId } = useOfflineSyncContext();
  const { updateOSStatus } = useOfflineOperations();
  
  // Resolver ID local para ID real (se foi sincronizado)
  const id = useMemo(() => {
    if (!rawId) return rawId;
    const resolvedId = resolveLocalId(rawId);
    return resolvedId;
  }, [rawId, resolveLocalId]);
  
  // Se o ID foi resolvido para um diferente, redirecionar para a URL correta
  useEffect(() => {
    if (rawId && id && rawId !== id) {
      console.log(`[AppOrdemDetalhe] 🔄 Redirecionando de ID local ${rawId} para ID real ${id}`);
      // Substituir a URL atual (sem adicionar ao histórico)
      navigate(`/app/ordens/${id}`, { replace: true });
    }
  }, [rawId, id, navigate]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [observacao, setObservacao] = useState("");
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);
  const { getState, saveState } = usePageState<{
    observacao?: string;
  }>(`app-ordem-detalhe-${id || "sem-id"}`);

  const initialState = getState();
  useEffect(() => {
    if (initialState?.observacao && !observacao) {
      setObservacao(initialState.observacao);
    }
  }, []);

  useEffect(() => {
    saveState({ observacao });
  }, [observacao, saveState]);

  const navegarComEstado = (path: string) => {
    saveState({ observacao });
    navigate(path);
  };

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; status: string; title: string; description: string }>({
    open: false,
    status: "",
    title: "",
    description: "",
  });
  
  // Estados para Retorno de Campo
  const [retornoCampoOpen, setRetornoCampoOpen] = useState(false);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [retornoSelecionado, setRetornoSelecionado] = useState<{
    retorno_campo_id: string;
    retorno_codigo: string;
    retorno_descricao: string;
    gera_producao: boolean;
    grupo_retorno?: string; // executado, impedimento, parcial
    atividades: Array<{
      atividade_id: string;
      quantidade: number;
      atividade: { id: string; codigo: string; descricao: string; valor_unitario: number; unidade: string };
      qtd_min_fotos: number;
    }>;
  } | null>(null);
  const [tentouIniciarSemApr, setTentouIniciarSemApr] = useState(false);
  const [aprOfflineCache, setAprOfflineCache] = useState<boolean>(false);
  const { buscarSkillId, registrarProducao, atualizarOrdemComRetorno } = useRetornoCampo();
  
  // Estados para Checklist de Serviço
  const [checklistServicoOpen, setChecklistServicoOpen] = useState(false);
  const [grupoRetornoSelecionado, setGrupoRetornoSelecionado] = useState<string>("executado");
  const checklistServicoCompletandoRef = useRef(false); // Ref para evitar problema de timing
  
  // Estado para diálogo de OS em andamento
  const [osEmAndamentoDialog, setOsEmAndamentoDialog] = useState<{
    open: boolean;
    os: { id: string; numero: string; tipo: string } | null;
  }>({ open: false, os: null });

  const handleBack = () => {
    saveState({ observacao });
    const parent = getAppParentRoute(location.pathname);
    navigate(parent || "/app");
  };

  // Determinar equipeId - priorizar equipeAuth que funciona offline
  const equipeIdParaUsar = equipeAuth?.id || equipe?.id;
  
  // Estado local para ordem offline
  const [ordemOfflineCache, setOrdemOfflineCache] = useState<any>(null);
  
  // Buscar ordem - só executa quando online
  const { data: ordemOnline, isLoading: isLoadingOnline } = useQuery({
    queryKey: ["ordem-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && isOnline,
    staleTime: 0,
    retry: 3,
  });

  // Buscar ordem do cache manualmente quando offline
  useEffect(() => {
    const buscarOrdemDoCache = async () => {
      if (!isOnline && id && equipeIdParaUsar && !ordemOfflineCache) {
        console.log("[AppOrdemDetalhe] 📦 Offline - buscando ordem do cache manualmente...");
        const dataHoje = format(new Date(), "yyyy-MM-dd");
        const cacheKey = `${CACHE_KEYS.PLANEJAMENTO_DIA}_${equipeIdParaUsar}_${dataHoje}`;
        
        // IDs para buscar: o ID resolvido e, se diferente, o ID original (local)
        const idsParaBuscar = [id];
        if (rawId && rawId !== id) {
          idsParaBuscar.push(rawId);
          console.log("[AppOrdemDetalhe] Cache key:", cacheKey, "IDs procurados:", idsParaBuscar);
        } else {
          console.log("[AppOrdemDetalhe] Cache key:", cacheKey, "ID procurado:", id);
        }
        
        try {
          // 1. Primeiro tentar buscar do cache de planejamento do dia
          const cachedPlanejamento = await getFromCache(cacheKey);
          console.log("[AppOrdemDetalhe] Cache planejamento encontrado:", cachedPlanejamento?.length || 0, "items");
          
          if (cachedPlanejamento && Array.isArray(cachedPlanejamento)) {
            const ordemEncontrada = (cachedPlanejamento as any[]).find(
              p => idsParaBuscar.includes(p.ordens_servico?.id)
            );
            
            if (ordemEncontrada?.ordens_servico) {
              console.log("[AppOrdemDetalhe] ✅ Ordem encontrada no cache planejamento:", ordemEncontrada.ordens_servico.numero);
              setOrdemOfflineCache(ordemEncontrada.ordens_servico);
              return;
            }
          }
          
          // 2. Se não encontrou, tentar o cache de ordens_planejadas (lista simples)
          const cacheKeyOrdens = `${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeIdParaUsar}`;
          const cachedOrdens = await getFromCache(cacheKeyOrdens);
          console.log("[AppOrdemDetalhe] Cache ordens encontrado:", cachedOrdens?.length || 0, "items");
          
          if (cachedOrdens && Array.isArray(cachedOrdens)) {
            const ordemEncontrada = (cachedOrdens as any[]).find(o => idsParaBuscar.includes(o.id));
            if (ordemEncontrada) {
              console.log("[AppOrdemDetalhe] ✅ Ordem encontrada no cache ordens:", ordemEncontrada.numero);
              setOrdemOfflineCache(ordemEncontrada);
              return;
            }
          }
          
          // 3. Último recurso: cache de todas as ordens (últimos 7 dias)
          const cacheKeyAll = `${CACHE_KEYS.ORDENS_PLANEJADAS}_${equipeIdParaUsar}_all`;
          const cachedOrdensAll = await getFromCache(cacheKeyAll);
          console.log("[AppOrdemDetalhe] Cache ordens_all encontrado:", cachedOrdensAll?.length || 0, "items");
          
          if (cachedOrdensAll && Array.isArray(cachedOrdensAll)) {
            const ordemEncontrada = (cachedOrdensAll as any[]).find(o => idsParaBuscar.includes(o.id));
            if (ordemEncontrada) {
              console.log("[AppOrdemDetalhe] ✅ Ordem encontrada no cache ordens_all:", ordemEncontrada.numero);
              setOrdemOfflineCache(ordemEncontrada);
              return;
            }
          }
          
          // Não encontrou em nenhum cache
          console.log("[AppOrdemDetalhe] ⚠️ Ordem não encontrada em nenhum cache. IDs disponíveis no planejamento:", 
            (cachedPlanejamento as any[] || []).map(p => p.ordens_servico?.id).filter(Boolean).slice(0, 5));
            
        } catch (error) {
          console.error("[AppOrdemDetalhe] ❌ Erro ao buscar cache:", error);
        }
      }
    };
    buscarOrdemDoCache();
  }, [isOnline, id, rawId, equipeIdParaUsar, ordemOfflineCache, getFromCache]);

  // Usar ordem do React Query ou do cache offline
  const ordem = isOnline ? ordemOnline : ordemOfflineCache;
  const isLoading = isOnline ? isLoadingOnline : (!ordemOfflineCache && !!id);

  // Buscar produção (valor produzido)
  const { data: producao } = useQuery({
    queryKey: ["ordem-producao", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_equipes")
        .select("valor_total")
        .eq("ordem_servico_id", id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!id,
  });

  // Estado local para skills offline
  const [skillsOfflineCache, setSkillsOfflineCache] = useState<any[]>([]);

  // Buscar skills (só online)
  const { data: skillsDataOnline } = useQuery({
    queryKey: ["skills-app-detalhe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("codigo, nome")
        .eq("ativo", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isOnline,
  });

  // Buscar skills do cache quando offline
  useEffect(() => {
    const buscarSkillsDoCache = async () => {
      if (!isOnline && skillsOfflineCache.length === 0) {
        console.log("[AppOrdemDetalhe] 📦 Buscando skills do cache...");
        try {
          const cachedSkills = await getFromCache(CACHE_KEYS.SKILLS);
          if (cachedSkills && Array.isArray(cachedSkills) && cachedSkills.length > 0) {
            console.log("[AppOrdemDetalhe] ✅ Skills do cache:", cachedSkills.length);
            setSkillsOfflineCache(cachedSkills);
          }
        } catch (error) {
          console.error("[AppOrdemDetalhe] ❌ Erro ao buscar skills:", error);
        }
      }
    };
    buscarSkillsDoCache();
  }, [isOnline, skillsOfflineCache.length, getFromCache]);

  // Usar skills do React Query ou do cache offline
  const skillsData = (skillsDataOnline && skillsDataOnline.length > 0) 
    ? skillsDataOnline 
    : skillsOfflineCache;

  const getTipoNome = (tipo: string | null | undefined): string => {
    if (!tipo) return "";
    if (!skillsData || skillsData.length === 0) return tipo;
    const skill = skillsData.find((s: { codigo: string; nome: string }) => 
      s.codigo?.toLowerCase() === tipo.toLowerCase() ||
      s.codigo === tipo
    );
    return skill?.nome || tipo;
  };

  // Buscar planejamento
  const { data: planejamento } = useQuery({
    queryKey: ["ordem-planejamento", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("planejamento_ordens")
        .select("ordem_na_rota, hora_inicio_estimada, distancia_km")
        .eq("ordem_servico_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Buscar anexos - NÃO incluir isOnline na queryKey para manter os dados quando a conexão mudar
  const { data: anexos } = useQuery({
    queryKey: ["ordem-anexos", id],
    queryFn: async () => {
      const cacheKey = `ordem_anexos_${id}`;
      
      // Se offline, buscar do cache
      if (!isOnline) {
        const cachedAnexos = await getFromCache<any[]>(cacheKey);
        if (cachedAnexos) {
          console.log("[AppOrdemDetalhe] Usando cache de anexos:", cachedAnexos.length);
          return cachedAnexos;
        }
        return [];
      }

      const { data, error } = await supabase
        .from("ordem_anexos")
        .select("*")
        .eq("ordem_servico_id", id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Salvar no cache para uso offline
      if (data && data.length > 0) {
        await saveToCache(cacheKey, data, 24);
      }
      
      return data;
    },
    enabled: !!id,
    // Não refetch automaticamente quando reconectar - manter dados em cache
    refetchOnReconnect: false,
  });

  // Buscar intervalo ativo (para bloquear início de serviço durante intervalo)
  const { data: intervaloAtivo } = useQuery({
    queryKey: ["intervalo-ativo-bloqueio", equipe?.id || equipeAuth?.id],
    queryFn: async () => {
      const equipeId = equipe?.id || equipeAuth?.id;
      if (!equipeId) return null;
      
      const { data, error } = await supabase
        .from("intervalos_equipe")
        .select(`*, tipo_intervalo:tipo_intervalo_id (nome)`)
        .eq("equipe_id", equipeId)
        .is("hora_fim", null)
        .order("hora_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") return null;
      return data;
    },
    enabled: !!(equipe?.id || equipeAuth?.id),
    refetchInterval: 10000,
  });

  // Buscar se há OUTRA OS em andamento (diferente da atual) - para bloquear início de múltiplas OS
  const { data: outraOsEmAndamento } = useQuery({
    queryKey: ["outra-os-em-andamento", equipe?.id || equipeAuth?.id, id],
    queryFn: async () => {
      const equipeId = equipe?.id || equipeAuth?.id;
      if (!equipeId) return null;
      
      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          ordem_servico_id,
          ordens_servico:ordem_servico_id (id, numero, tipo, status)
        `)
        .eq("equipe_id", equipeId)
        .neq("ordem_servico_id", id) // Excluir a OS atual
        .in("ordens_servico.status", ["em_deslocamento", "no_local", "em_andamento", "em_execucao"]);
      
      if (error) return null;
      
      // Filtrar apenas as que realmente estão em andamento
      const osAtivas = data?.filter(d => d.ordens_servico?.status) || [];
      return osAtivas.length > 0 ? osAtivas[0].ordens_servico : null;
    },
    enabled: !!(equipe?.id || equipeAuth?.id) && !!id,
    refetchInterval: 10000,
  });

  // Verificar APR no cache offline quando não há internet
  // Verificar se há APR pendente de sincronização para esta ordem
  const temAprPendente = id && pendingOperations.some(op => {
    if (op.type !== "save_apr" && op.type !== "update_apr") return false;
    const payload = op.payload;
    return payload && payload.ordem_servico_id === id;
  });

  // Buscar checklists/APRs (sempre, mesmo offline para verificar cache)
  const { data: checklistsPreenchidos, refetch: refetchChecklists } = useQuery({
    queryKey: ["ordem-checklists", id],
    queryFn: async () => {
      if (!id) return [];
      
      // Se offline, tentar buscar do cache primeiro
      if (!isOnline) {
        const cacheKey = `apr_resposta_${id}`;
        const aprCache = await getFromCache(cacheKey);
        if (aprCache) {
          console.log("[AppOrdemDetalhe] ✅ APR encontrada no cache");
          return [{ id: aprCache.id, checklist_id: aprCache.checklist_id, checklists: { tipo: 'apr' } }];
        }
        return [];
      }
      
      const { data } = await supabase
        .from("checklist_respostas")
        .select(`id, checklist_id, checklists:checklist_id (id, nome, tipo)`)
        .eq("ordem_servico_id", id);
      return data || [];
    },
    enabled: !!id,
    staleTime: 0, // Sempre considerar stale para refetch quando necessário
    refetchInterval: isOnline ? 5000 : false, // Refetch a cada 5s quando online para pegar APR recém salva
  });
  
  useEffect(() => {
    const verificarAprOffline = async () => {
      if (!isOnline && id) {
        console.log("[AppOrdemDetalhe] 📦 Verificando APR no cache offline...");
        
        // Primeiro verificar se há operação pendente de save_apr
        if (temAprPendente) {
          console.log("[AppOrdemDetalhe] ✅ APR encontrada nas operações pendentes de sincronização");
          setAprOfflineCache(true);
          return;
        }
        
        // Verificar cache específico de APR para esta ordem
        const cacheKey = `apr_resposta_${id}`;
        const aprCache = await getFromCache(cacheKey);
        
        if (aprCache) {
          console.log("[AppOrdemDetalhe] ✅ APR encontrada no cache offline");
          setAprOfflineCache(true);
          return;
        }
        
        console.log("[AppOrdemDetalhe] ❌ APR não encontrada no cache offline");
        setAprOfflineCache(false);
      } else if (isOnline && id) {
        // Quando online, verificar se há operação pendente
        if (temAprPendente) {
          console.log("[AppOrdemDetalhe] ✅ APR encontrada nas operações pendentes (online)");
          setAprOfflineCache(true);
        }
        // Se não há pendente mas há dados no checklistsPreenchidos, limpar cache
        if (!temAprPendente && checklistsPreenchidos?.length > 0) {
          setAprOfflineCache(false);
        }
      }
    };
    
    verificarAprOffline();
  }, [isOnline, id, getFromCache, temAprPendente, checklistsPreenchidos]); // Adiciona checklistsPreenchidos como dependência

  const temAprPreenchida = aprOfflineCache || temAprPendente || checklistsPreenchidos?.some(
    (c: any) => c.checklists?.tipo === "apr" || c.checklists?.nome?.toLowerCase().includes("apr")
  ) || false;

  // Verificar se tem checklist de serviço preenchido
  const temChecklistServicoPreenchido = checklistsPreenchidos?.some(
    (c: any) => c.checklists?.tipo === "servico"
  ) || false;

  // Buscar próxima OS
  const { data: proximaOS } = useQuery({
    queryKey: ["proxima-os", id, planejamento?.ordem_na_rota],
    queryFn: async () => {
      const equipeId = equipe?.id || equipeAuth?.id;
      if (!equipeId || !planejamento?.ordem_na_rota) return null;
      const { data } = await supabase
        .from("planejamento_ordens")
        .select(`ordem_na_rota, ordens_servico:ordem_servico_id (id, numero, tipo, status)`)
        .eq("equipe_id", equipeId)
        .gt("ordem_na_rota", planejamento.ordem_na_rota)
        .order("ordem_na_rota", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.ordens_servico && !["concluida", "cancelada"].includes(data.ordens_servico.status)) {
        return data;
      }
      return null;
    },
    enabled: !!planejamento?.ordem_na_rota && !!(equipe?.id || equipeAuth?.id),
  });

  // Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`ordem-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ordens_servico", filter: `id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ["ordem-detalhe", id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // Estado para controlar loading da mutation
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Função para atualizar status (funciona online e offline)
  const updateStatusMutation = {
    isPending: isUpdatingStatus,
    mutate: async (newStatus: string) => {
      setIsUpdatingStatus(true);
      
      try {
        const equipeId = equipeIdParaUsar;
        if (!equipeId || !id) {
          toast.error("Erro: equipe ou ordem não identificada");
          setIsUpdatingStatus(false);
          return;
        }

        const now = new Date().toISOString();
        const dadosAdicionais: Record<string, unknown> = {};
        let acaoDescricao = "";

        if (newStatus === "em_deslocamento") {
          acaoDescricao = "Deslocamento iniciado";
        } else if (newStatus === "no_local") {
          acaoDescricao = "Chegou no local";
        } else if (newStatus === "em_execucao" || newStatus === "em_andamento") {
          if (!ordem?.iniciado_at) dadosAdicionais.iniciado_at = now;
          acaoDescricao = "Serviço iniciado";
        } else if (newStatus === "concluida") {
          acaoDescricao = "Serviço concluído";
          if (ordem?.deslocamento_iniciado_at) {
            dadosAdicionais.tempo_total_minutos = Math.round((new Date().getTime() - new Date(ordem.deslocamento_iniciado_at).getTime()) / 60000);
          }
          if (ordem?.execucao_iniciada_at) {
            dadosAdicionais.tempo_execucao_minutos = Math.round((new Date().getTime() - new Date(ordem.execucao_iniciada_at).getTime()) / 60000);
          }
        } else if (newStatus === "planejada" || newStatus === "pendente") {
          // Cancelar ação - limpar timestamps de deslocamento/chegada
          acaoDescricao = "Ação cancelada pela equipe";
          dadosAdicionais.deslocamento_iniciado_at = null;
          dadosAdicionais.chegada_local_at = null;
        }

        if (observacao.trim()) {
          const novaObs = `[${format(new Date(), "dd/MM HH:mm")} - ${acaoDescricao}] ${observacao}`;
          const obsEquipeAtual = (ordem as any)?.observacoes_equipe || "";
          dadosAdicionais.observacoes_equipe = obsEquipeAtual ? `${obsEquipeAtual}\n\n${novaObs}` : novaObs;
        }

        console.log("[AppOrdemDetalhe] Atualizando status:", newStatus, "online:", isOnline);

        // Usar o hook de operações offline que funciona tanto online quanto offline
        // Passar o número da OS para exibição correta no indicador de sincronização offline
        const result = await updateOSStatus(id, newStatus, equipeId, dadosAdicionais, ordem?.numero);
        
        if (result.success) {
          // Atualizar o estado local da ordem para refletir mudança imediatamente
          if (ordemOfflineCache) {
            setOrdemOfflineCache({
              ...ordemOfflineCache,
              status: newStatus,
              ...dadosAdicionais,
            });
          }

          // Se online, fazer log no servidor
          if (isOnline) {
            try {
              await supabase.from("planejamento_logs").insert({
                ordem_servico_id: id,
                acao: `status_${newStatus}`,
                descricao: `${acaoDescricao}${observacao ? `: ${observacao}` : ""}`,
                dados_anteriores: { status: ordem?.status },
                dados_novos: { status: newStatus, timestamp: now },
                created_by: equipeId,
              });
              logApp("editar", "ordens", "ordens_servico", id,
                { id: equipeId, nome: equipe?.codigo || equipeAuth?.codigo || "", equipeId },
                { status: ordem?.status }, { status: newStatus, timestamp: now },
                `Alterou OS ${ordem?.numero || id} para ${statusConfig[newStatus]?.label || newStatus}`
              );
            } catch (logError) {
              console.warn("[AppOrdemDetalhe] Erro ao registrar log:", logError);
            }
          }

          // Invalidar queries se online
          if (isOnline) {
            queryClient.invalidateQueries({ queryKey: ["ordem-detalhe", id] });
            queryClient.invalidateQueries({ queryKey: ["ordens-planejadas"] });
            queryClient.invalidateQueries({ queryKey: ["ordem-historico", id] });
            queryClient.invalidateQueries({ queryKey: ["ordem-producao", id] });
            // Invalidar produção do dia na tela inicial
            queryClient.invalidateQueries({ queryKey: ["producao-hoje"] });
            queryClient.invalidateQueries({ queryKey: ["producoes-equipe"] });
          }

          setObservacao("");
          setConfirmDialog({ open: false, status: "", title: "", description: "" });
          
          const statusLabel = statusConfig[newStatus]?.label || "Status atualizado";
          if (result.offline) {
            toast.success(`${statusLabel} (salvo offline)`);
          } else {
            toast.success(statusLabel);
          }
        } else {
          toast.error("Erro ao atualizar status");
        }
      } catch (error) {
        console.error("[AppOrdemDetalhe] Erro na mutation:", error);
        toast.error("Erro ao atualizar status");
      } finally {
        setIsUpdatingStatus(false);
      }
    }
  };

  // Funções auxiliares agora importadas de @/lib/imageUtils

  // Upload de foto (agora suporta offline)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploadingFoto(true);
    console.log("[AppOrdemDetalhe] Iniciando upload de foto");
    toast.loading("Obtendo localização e processando foto...", { id: "foto-upload" });
    
    try {
      // Obter localização
      console.log("[AppOrdemDetalhe] Obtendo localização...");
      const coords = await getCurrentLocation();
      console.log("[AppOrdemDetalhe] Coordenadas obtidas:", coords);

      // Processar imagem com carimbo
      console.log("[AppOrdemDetalhe] Processando imagem com carimbo...");
      const { dataUrl: stampedImage, timestamp } = await processImageWithStamp(file, coords);
      console.log("[AppOrdemDetalhe] Imagem processada com sucesso, tamanho:", stampedImage.length);
      
      let fotoUrl = stampedImage; // Fallback para base64
      let storagePath: string | null = null;

      // Se online, tentar upload para Storage
      if (isOnline) {
        toast.loading("Enviando foto...", { id: "foto-upload" });

        try {
          // Converter dataUrl para blob
          const response = await fetch(stampedImage);
          const blob = await response.blob();

          const fileExt = file.name.split(".").pop() || "jpg";
          const fileName = `${id}/${Date.now()}.${fileExt}`;

          console.log("[AppOrdemDetalhe] Tentando upload para Storage:", fileName);

          // Tentar upload para Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("service-attachments")
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (!uploadError && uploadData) {
            console.log("[AppOrdemDetalhe] Upload bem sucedido:", uploadData);
            const { data: urlData } = supabase.storage
              .from("service-attachments")
              .getPublicUrl(fileName);
            fotoUrl = urlData.publicUrl;
            storagePath = fileName;
            console.log("[AppOrdemDetalhe] URL pública:", fotoUrl);
          } else {
            console.error("[AppOrdemDetalhe] Erro no Storage, usando base64:", uploadError);
            // Se deu erro mas ainda está online, continuar com base64
          }
        } catch (uploadError) {
          console.error("[AppOrdemDetalhe] Erro ao fazer upload, usando base64:", uploadError);
          // Continuar com base64 se upload falhar
        }
      } else {
        console.log("[AppOrdemDetalhe] Offline - usando base64 diretamente");
        // Se offline, usar base64 diretamente sem tentar upload
      }

      // Criar objeto de anexo
      const anexoData = {
        ordem_servico_id: id,
        tipo: "foto",
        url: fotoUrl,
        descricao: `Foto - ${format(new Date(), "dd/MM HH:mm")}`,
        storage_path: storagePath,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        data_captura: new Date().toISOString(),
        numero_os: ordem?.numero, // Para exibição no indicador de sincronização offline (será removido antes de enviar ao banco)
      };

      console.log("[AppOrdemDetalhe] Salvando anexo...");

      // Se online e upload foi bem-sucedido, inserir diretamente
      if (isOnline && storagePath) {
        try {
          // Remover campo auxiliar numero_os antes de inserir no banco (não existe na tabela)
          const { numero_os, ...anexoDataParaBanco } = anexoData;
          
          const { error: insertError } = await supabase.from("ordem_anexos").insert(anexoDataParaBanco);
          if (insertError) throw insertError;
          
          queryClient.invalidateQueries({ queryKey: ["ordem-anexos", id] });
          toast.success("Foto enviada!", { id: "foto-upload" });
          console.log("[AppOrdemDetalhe] Foto salva com sucesso");
        } catch (error) {
          console.error("[AppOrdemDetalhe] Erro ao inserir anexo, enfileirando:", error);
          // Se falhar, enfileirar operação (mantém numero_os para exibição no indicador offline)
          await queueOperation(
            "save_foto",
            "ordem_anexos",
            "insert",
            anexoData,
            2 // Prioridade média
          );
          toast.success("Foto salva localmente!", { id: "foto-upload" });
        }
      } else {
        // Se offline ou upload falhou, enfileirar operação
        console.log("[AppOrdemDetalhe] Enfileirando operação de salvar foto");
        await queueOperation(
          "save_foto",
          "ordem_anexos",
          "insert",
          anexoData,
          2 // Prioridade média
        );
        
        // Atualizar cache local de anexos E query do React Query
        const cacheKey = `ordem_anexos_${id}`;
        
        // IMPORTANTE: Buscar do cache E do estado atual da query para evitar sobrescrever dados
        const cachedAnexos = await getFromCache<any[]>(cacheKey) || [];
        const queryAnexos = queryClient.getQueryData<any[]>(["ordem-anexos", id]) || [];
        
        // Usar o array que tiver mais itens (mais atualizado)
        const anexosAtuais = cachedAnexos.length >= queryAnexos.length ? cachedAnexos : queryAnexos;
        console.log("[AppOrdemDetalhe] Anexos atuais - cache:", cachedAnexos.length, "query:", queryAnexos.length, "usando:", anexosAtuais.length);
        
        const novoAnexo = {
          id: `temp_${Date.now()}`,
          ...anexoData,
          created_at: new Date().toISOString(),
        };
        const anexosAtualizados = [novoAnexo, ...anexosAtuais]; // Novo anexo primeiro
        
        // Salvar no cache PRIMEIRO
        await saveToCache(cacheKey, anexosAtualizados, 24);
        console.log("[AppOrdemDetalhe] Cache salvo com", anexosAtualizados.length, "anexos");
        
        // Atualizar query diretamente para mostrar na UI imediatamente (NÃO usar invalidateQueries quando offline!)
        queryClient.setQueryData(["ordem-anexos", id], anexosAtualizados);
        
        toast.success("Foto salva localmente!", { id: "foto-upload" });
        console.log("[AppOrdemDetalhe] Foto salva localmente com sucesso - Total de anexos:", anexosAtualizados.length);
      }
    } catch (error: any) {
      console.error("[AppOrdemDetalhe] Erro ao enviar foto:", error);
      toast.error("Erro ao processar foto", { id: "foto-upload" });
    } finally {
      setIsUploadingFoto(false);
      // Limpar input
      e.target.value = "";
    }
  };

  // Deletar foto
  const deleteFotoMutation = useMutation({
    mutationFn: async (anexoId: string) => {
      if (isOnline) {
        const { error } = await supabase.from("ordem_anexos").delete().eq("id", anexoId);
        if (error) throw error;
      } else {
        // Offline: remover do cache local
        const cacheKey = `ordem_anexos_${id}`;
        const anexosAtuais = await getFromCache<any[]>(cacheKey) || [];
        const anexosAtualizados = anexosAtuais.filter(a => a.id !== anexoId);
        await saveToCache(cacheKey, anexosAtualizados, 24);
        
        // Atualizar query diretamente
        queryClient.setQueryData(["ordem-anexos", id], anexosAtualizados);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordem-anexos", id] });
      toast.success(isOnline ? "Foto removida!" : "Foto removida localmente!");
    },
    onError: () => toast.error("Erro ao remover foto"),
  });

  const handleDeleteFoto = (anexoId: string) => {
    if (window.confirm("Deseja remover esta foto?")) {
      deleteFotoMutation.mutate(anexoId);
    }
  };

  const openNavigation = () => {
    // Detectar se é mobile ou desktop
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (ordem?.latitude && ordem?.longitude) {
      if (isMobile) {
        // geo: URI scheme abre o seletor de apps de navegação no mobile
        const geoUri = `geo:${ordem.latitude},${ordem.longitude}?q=${ordem.latitude},${ordem.longitude}`;
        window.location.href = geoUri;
      } else {
        // No desktop, abrir Google Maps em nova aba
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${ordem.latitude},${ordem.longitude}`;
        window.open(googleMapsUrl, '_blank');
      }
    } else if (ordem?.endereco) {
      if (isMobile) {
        // Para endereço, usar geo: com query
        const geoUri = `geo:0,0?q=${encodeURIComponent(ordem.endereco)}`;
        window.location.href = geoUri;
      } else {
        // No desktop, abrir Google Maps com endereço
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ordem.endereco)}`;
        window.open(googleMapsUrl, '_blank');
      }
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    // Verificar se há intervalo em andamento (bloqueia início de deslocamento e serviço)
    if (intervaloAtivo && (newStatus === "em_deslocamento" || newStatus === "em_execucao")) {
      const nomeIntervalo = intervaloAtivo.tipo_intervalo?.nome || "Intervalo";
      toast.error(`Finalize o intervalo "${nomeIntervalo}" antes de continuar!`, { duration: 4000 });
      return;
    }

    // Verificar se há outra OS em andamento (impede iniciar múltiplas OS)
    if (outraOsEmAndamento && newStatus === "em_deslocamento") {
      setOsEmAndamentoDialog({
        open: true,
        os: {
          id: outraOsEmAndamento.id,
          numero: outraOsEmAndamento.numero,
          tipo: outraOsEmAndamento.tipo,
        },
      });
      return;
    }

    if (newStatus === "em_execucao" && !temAprPreenchida) {
      setTentouIniciarSemApr(true);
      toast.error("Preencha a APR antes de iniciar!", { duration: 4000 });
      return;
    }
    
    if (newStatus === "concluida") {
      // Se já tem retorno selecionado, verificar fotos e depois abrir checklist
      if (retornoSelecionado) {
        const qtdFotosExigidas = retornoSelecionado.atividades.reduce((t, a) => t + (a.qtd_min_fotos || 0), 0);
        const qtdFotosAnexadas = anexos?.filter(a => a.tipo === "foto").length || 0;
        if (qtdFotosExigidas > 0 && qtdFotosAnexadas < qtdFotosExigidas) {
          toast.error(`Faltam ${qtdFotosExigidas - qtdFotosAnexadas} foto(s)!`);
          return;
        }
        
        // Garantir que skillId está definido
        let currentSkillId = skillId;
        if (!currentSkillId && ordem?.tipo) {
          currentSkillId = await buscarSkillId(ordem.tipo);
          if (currentSkillId) {
            setSkillId(currentSkillId);
          }
        }
        
        // Fotos OK - Abrir checklist de serviço (se configurado)
        // O ChecklistServicoSheet vai verificar se há checklists obrigatórios
        // Se não houver, chama onSkip automaticamente que completa a conclusão
        const grupoRetorno = retornoSelecionado.grupo_retorno || 
          (retornoSelecionado.gera_producao ? "executado" : "impedimento");
        setGrupoRetornoSelecionado(grupoRetorno);
        setChecklistServicoOpen(true);
        return;
      }
      
      // Se não tem retorno selecionado, abrir seletor de retorno
      if (ordem?.tipo) {
        const foundSkillId = await buscarSkillId(ordem.tipo);
        if (foundSkillId) {
          setSkillId(foundSkillId);
          setRetornoCampoOpen(true);
          return;
        }
      }
      
      // Se não tem skill configurado, mostrar diálogo de confirmação simples
      setConfirmDialog({
        open: true,
        status: newStatus,
        title: "Concluir Serviço",
        description: "Confirma a conclusão deste serviço?",
      });
    } else {
      updateStatusMutation.mutate(newStatus);
    }
  };

  const handleRetornoCampoConfirm = async (result: any) => {
    const equipeId = equipe?.id || equipeAuth?.id;
    if (!equipeId || !ordem?.id) {
      toast.error("Erro ao identificar equipe");
      return;
    }
    const qtdFotosExigidas = result.atividades.reduce((t: number, a: any) => t + (a.qtd_min_fotos || 0), 0);
    const qtdFotosAnexadas = anexos?.filter(a => a.tipo === "foto").length || 0;
    if (qtdFotosExigidas > 0 && qtdFotosAnexadas < qtdFotosExigidas) {
      setRetornoSelecionado(result);
      toast.error(`Adicione ${qtdFotosExigidas - qtdFotosAnexadas} foto(s) para continuar`);
      setRetornoCampoOpen(false);
      return;
    }
    
    // Determinar grupo de retorno baseado no tipo do retorno
    // Os tipos podem ser: "executado", "impedimento", "parcial"
    const grupoRetorno = result.grupo_retorno || 
      (result.gera_producao ? "executado" : "impedimento");
    
    // Salvar o retorno selecionado e o grupo
    setRetornoSelecionado({ ...result, grupo_retorno: grupoRetorno });
    setGrupoRetornoSelecionado(grupoRetorno);
    setRetornoCampoOpen(false);
    
    // Abrir checklist de serviço (se houver configurado)
    // O componente ChecklistServicoSheet vai verificar se há checklists obrigatórios
    // Se não houver, vai chamar onSkip automaticamente
    setChecklistServicoOpen(true);
  };
  
  // Handler para quando checklists de serviço são concluídos (ou pulados)
  const handleChecklistServicoComplete = async (checklists?: any[]) => {
    // Marcar que está completando (síncrono, antes de qualquer await)
    checklistServicoCompletandoRef.current = true;
    
    const equipeId = equipe?.id || equipeAuth?.id;
    if (!equipeId || !ordem?.id || !retornoSelecionado) {
      toast.error("Erro ao identificar equipe ou retorno");
      checklistServicoCompletandoRef.current = false;
      return;
    }
    
    // Registrar produção e atualizar ordem com retorno
    try {
      await registrarProducao(ordem.id, equipeId, retornoSelecionado);
      await atualizarOrdemComRetorno(ordem.id, retornoSelecionado, ordem?.numero);
    } catch (error) {
      console.warn("[AppOrdemDetalhe] Erro ao registrar produção (será sincronizado depois):", error);
    }
    
    // Concluir a OS
    updateStatusMutation.mutate("concluida");
    setRetornoSelecionado(null);
    checklistServicoCompletandoRef.current = false;
  };
  
  // Handler para quando o ChecklistServicoSheet é fechado
  const handleChecklistServicoClose = () => {
    // Se está no processo de completar, apenas fechar normalmente
    if (checklistServicoCompletandoRef.current) {
      setChecklistServicoOpen(false);
      return;
    }
    
    // Se foi fechado sem completar, resetar o fluxo de conclusão
    if (retornoSelecionado) {
      setRetornoSelecionado(null);
      toast.warning("Checklist não preenchido. Selecione o retorno novamente para concluir a OS.");
    }
    setChecklistServicoOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  if (!ordem) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Ordem não encontrada</p>
        </div>
      </div>
    );
  }

  // Verificar se há operação pendente de sincronização com status mais recente
  // Isso é necessário porque o cache pode não ter sido atualizado ainda quando offline
  const statusPendente = (() => {
    if (!id || pendingOperations.length === 0) return null;
    
    // Buscar a operação mais recente de update_os_status para esta ordem
    const operacoesDestaOrdem = pendingOperations.filter(op => {
      if (op.type !== "update_os_status") return false;
      const payload = op.payload;
      return payload && (payload.id === id || payload.ordem_servico_id === id);
    });
    
    if (operacoesDestaOrdem.length === 0) return null;
    
    // Pegar a mais recente (última da lista)
    const operacaoMaisRecente = operacoesDestaOrdem[operacoesDestaOrdem.length - 1];
    const statusOp = operacaoMaisRecente?.payload?.status;
    
    if (statusOp && statusOp !== ordem.status) {
      console.log("[AppOrdemDetalhe] 📋 Status pendente de sincronização encontrado:", statusOp, "(atual no cache:", ordem.status, ")");
    }
    
    return statusOp;
  })();
  
  // Usar o status pendente se existir, senão usar o status da ordem
  const status = (statusPendente || ordem.status) as keyof typeof statusConfig;
  const config = statusConfig[status] || statusConfig.pendente;
  const nextStatuses = statusFlow[status] || [];
  const primaryAction = nextStatuses[0];
  const actionConfig = primaryAction ? actionLabels[primaryAction] : null;
  const ActionIcon = actionConfig?.icon || Play;
  const qtdFotos = anexos?.filter(a => a.tipo === "foto").length || 0;
  const isActive = !["concluida", "cancelada"].includes(status);

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      {/* Header Compacto */}
      <div className={`${config.bgColor} ${config.borderColor} border-b`}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0 -ml-2 h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{ordem.numero}</span>
                {ordem.regulada && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0.5">URGENTE</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{getTipoNome(ordem.tipo)}</p>
            </div>

            <div className={`${config.color} text-white px-3 py-1.5 rounded-full text-xs font-medium`}>
              {config.label}
            </div>
          </div>

          {/* Info rápida */}
          {planejamento && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground ml-10">
              <span className="font-bold text-foreground">#{planejamento.ordem_na_rota}</span>
              {planejamento.hora_inicio_estimada && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {planejamento.hora_inicio_estimada}
                </span>
              )}
              {planejamento.distancia_km && planejamento.distancia_km > 0 && (
                <span>{planejamento.distancia_km.toFixed(1)}km</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Card Endereço + Navegação */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-snug">{ordem.endereco}</p>
              {ordem.cliente_nome && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {ordem.cliente_nome}
                </p>
              )}
            </div>
          </div>
          <Button className="w-full mt-3 h-11 bg-blue-600 hover:bg-blue-700 text-base font-medium" onClick={openNavigation}>
            <Navigation className="h-5 w-5 mr-2" />
            Navegar
          </Button>
        </div>

        {/* Botões de Ação Secundários */}
        {isActive && (
          <div className="flex gap-2">
            {/* Fotos */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingFoto}
              className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm"
            >
              {isUploadingFoto ? (
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-emerald-600" />
              )}
              <span className="text-xs mt-1 font-medium">Fotos {qtdFotos > 0 && `(${qtdFotos})`}</span>
            </button>

            {/* APR */}
            <button
              onClick={() => {
                setTentouIniciarSemApr(false);
                navegarComEstado(`/app/ordens/${id}/apr`);
              }}
              className={`flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm ${
                tentouIniciarSemApr && !temAprPreenchida ? "ring-2 ring-red-500" : ""
              }`}
            >
              <ClipboardCheck className={`h-6 w-6 ${temAprPreenchida ? "text-green-600" : "text-violet-600"}`} />
              <span className="text-xs mt-1 font-medium">APR {temAprPreenchida && "✓"}</span>
            </button>

            {/* Encerrar OS */}
            <button
              onClick={async () => {
                if (ordem?.tipo) {
                  const foundSkillId = await buscarSkillId(ordem.tipo);
                  if (foundSkillId) {
                    setSkillId(foundSkillId);
                    setRetornoCampoOpen(true);
                  } else {
                    toast.error(`Tipo de serviço "${ordem.tipo}" não possui retornos configurados. Configure em Administração > Cadastros Base > Tipos de Serviços.`);
                  }
                } else {
                  toast.error("OS sem tipo de serviço definido");
                }
              }}
              className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm"
            >
              <StopCircle className="h-6 w-6 text-red-500" />
              <span className="text-xs mt-1 font-medium">Encerrar</span>
            </button>
          </div>
        )}

        {/* Linha extra de botões se necessário */}
        {isActive && (status === "em_andamento" || status === "em_execucao" || status === "no_local" || ordem.cliente_telefone) && (
          <div className="flex gap-2">
            {/* Materiais */}
            {(status === "em_andamento" || status === "em_execucao" || status === "no_local") && (
              <button
                onClick={() => navegarComEstado(`/app/ordens/${id}/materiais`)}
                className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm"
              >
                <Package className="h-6 w-6 text-teal-600" />
                <span className="text-xs mt-1 font-medium">Materiais</span>
              </button>
            )}

            {/* Ligar Cliente */}
            {ordem.cliente_telefone && (
              <a
                href={`tel:${ordem.cliente_telefone}`}
                className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border shadow-sm"
              >
                <Phone className="h-6 w-6 text-blue-500" />
                <span className="text-xs mt-1 font-medium">Ligar</span>
              </a>
            )}
          </div>
        )}

        {/* Consulta para OS concluída/cancelada - permitir ver APR e Fotos */}
        {!isActive && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-3">
            <p className="text-xs text-green-700 font-medium mb-3 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              OS {status === "concluida" ? "Concluída" : "Cancelada"} - Documentos disponíveis para consulta
            </p>
            <div className="flex gap-2">
              {/* Consultar APR */}
              <button
                onClick={() => navegarComEstado(`/app/ordens/${id}/apr`)}
                className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border border-green-200 shadow-sm hover:bg-green-50 transition-colors"
              >
                <ClipboardCheck className={`h-6 w-6 ${temAprPreenchida ? "text-green-600" : "text-gray-400"}`} />
                <span className="text-xs mt-1 font-medium">
                  {temAprPreenchida ? "Ver APR" : "APR"}
                </span>
              </button>

              {/* Consultar Checklist de Serviço */}
              {temChecklistServicoPreenchido && (
                <button
                  onClick={() => navegarComEstado(`/app/ordens/${id}/checklist-servico`)}
                  className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border border-green-200 shadow-sm hover:bg-green-50 transition-colors"
                >
                  <List className="h-6 w-6 text-green-600" />
                  <span className="text-xs mt-1 font-medium">Ver Checklist</span>
                </button>
              )}

              {/* Consultar Fotos */}
              <button
                onClick={() => {
                  const fotosSection = document.getElementById("fotos-section");
                  if (fotosSection) {
                    fotosSection.scrollIntoView({ behavior: "smooth", block: "start" });
                  } else if (qtdFotos === 0) {
                    toast.info("Nenhuma foto registrada para esta OS");
                  }
                }}
                className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border border-green-200 shadow-sm hover:bg-green-50 transition-colors"
              >
                <Camera className={`h-6 w-6 ${qtdFotos > 0 ? "text-emerald-600" : "text-gray-400"}`} />
                <span className="text-xs mt-1 font-medium">
                  Fotos {qtdFotos > 0 && `(${qtdFotos})`}
                </span>
              </button>

              {/* Consultar Materiais */}
              <button
                onClick={() => navegarComEstado(`/app/ordens/${id}/materiais`)}
                className="flex-1 flex flex-col items-center justify-center py-3 bg-white rounded-xl border border-green-200 shadow-sm hover:bg-green-50 transition-colors"
              >
                <Package className="h-6 w-6 text-teal-600" />
                <span className="text-xs mt-1 font-medium">Materiais</span>
              </button>
            </div>
          </div>
        )}

        {/* Retorno Selecionado (Pendente por fotos) */}
        {retornoSelecionado && isActive && (
          <div
            onClick={async () => {
              if (ordem?.tipo) {
                const foundSkillId = await buscarSkillId(ordem.tipo);
                if (foundSkillId) {
                  setSkillId(foundSkillId);
                  setRetornoCampoOpen(true);
                }
              }
            }}
            className="bg-amber-50 border border-amber-300 rounded-xl p-3 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flag className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900 text-sm">{retornoSelecionado.retorno_descricao}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Fotos: {qtdFotos}/{retornoSelecionado.atividades.reduce((t, a) => t + (a.qtd_min_fotos || 0), 0)}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        )}

        {/* Observações */}
        {isActive && (
          <div className="bg-white rounded-xl border p-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Observações</span>
            </div>
            <Textarea
              placeholder="Adicione observações..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="resize-none border-0 p-0 focus-visible:ring-0 text-sm min-h-[40px]"
            />
          </div>
        )}

        {/* Accordion com Detalhes */}
        <Accordion type="single" collapsible className="bg-white rounded-xl border overflow-hidden">
          <AccordionItem value="detalhes" className="border-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Detalhes do Serviço</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2 text-sm">
                {ordem.instalacao && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Instalação</span>
                    <span className="font-mono">{ordem.instalacao}</span>
                  </div>
                )}
                {ordem.medidor && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Medidor</span>
                    <span className="font-mono">{ordem.medidor}</span>
                  </div>
                )}
                {ordem.prazo && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Prazo</span>
                    <span className={ordem.regulada ? "text-red-600 font-medium" : ""}>
                      {format(new Date(ordem.prazo), "dd/MM/yy HH:mm")}
                    </span>
                  </div>
                )}
                {ordem.valor && ordem.valor > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Valor Prev.</span>
                    <span className="font-medium text-blue-600">R$ {ordem.valor.toFixed(2)}</span>
                  </div>
                )}
                {status === "concluida" && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Valor Prod.</span>
                    <span className="font-medium text-green-600">
                      R$ {(producao?.valor_total || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {ordem.observacoes && (
                  <div className="pt-2">
                    <p className="text-xs text-blue-600 font-medium">Obs. Coelba:</p>
                    <p className="text-xs bg-blue-50 p-2 rounded mt-1">{ordem.observacoes}</p>
                  </div>
                )}
                {(ordem as any).observacoes_equipe && (
                  <div className="pt-2">
                    <p className="text-xs text-emerald-600 font-medium">Obs. Equipe:</p>
                    <p className="text-xs bg-emerald-50 p-2 rounded mt-1">{(ordem as any).observacoes_equipe}</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Fotos */}
        {qtdFotos > 0 && (
          <div id="fotos-section" className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Fotos ({qtdFotos})</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {anexos?.filter(a => a.tipo === "foto").map((anexo) => (
                <div key={anexo.id} className="relative p-1">
                  <img
                    src={anexo.url}
                    alt=""
                    className="w-full aspect-square object-cover rounded-lg cursor-pointer border-2 border-gray-200"
                    onClick={() => window.open(anexo.url, "_blank")}
                  />
                  {isActive && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFoto(anexo.id);
                      }}
                      disabled={deleteFotoMutation.isPending}
                      className="absolute -top-1 -right-1 h-7 w-7 rounded-full shadow-lg"
                    >
                      {deleteFotoMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Concluído */}
        {status === "concluida" && (
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-center">
            <CheckCircle className="h-14 w-14 mx-auto mb-3 text-white" />
            <p className="font-bold text-xl text-white">Concluído! 🎉</p>
            {ordem.concluido_at && (
              <p className="text-sm text-white/90 mt-2">
                {format(new Date(ordem.concluido_at), "dd/MM 'às' HH:mm")}
              </p>
            )}
            
            <div className="mt-4 space-y-3">
              {proximaOS?.ordens_servico && (
                <Button
                  className="w-full h-12 bg-white text-green-700 hover:bg-green-50 text-base font-semibold"
                  onClick={() => navegarComEstado(`/app/ordens/${proximaOS.ordens_servico.id}`)}
                >
                  <ChevronRight className="h-5 w-5 mr-2" />
                  Próximo Serviço
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full h-11 text-sm font-semibold shadow-lg"
                style={{ 
                  backgroundColor: '#ffffff', 
                  color: '#065f46', 
                  borderColor: '#10b981',
                  borderWidth: '2px'
                }}
                onClick={() => navegarComEstado("/app/ordens")}
              >
                <List className="h-5 w-5 mr-2" />
                Ver Todas as OSs
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Botão de Ação Principal Fixo - ACIMA DA NAVEGAÇÃO */}
      {primaryAction && actionConfig && (
        <div className="fixed bottom-[70px] left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pt-6">
          <div className="flex gap-2">
            {/* Botão Cancelar - apenas para em_deslocamento e no_local */}
            {(status === "em_deslocamento" || status === "no_local") && (
              <Button
                variant="outline"
                className="h-14 px-4 rounded-xl shadow-lg border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={() => {
                  setConfirmDialog({
                    open: true,
                    status: "planejada",
                    title: "Cancelar Ação",
                    description: `Deseja cancelar e voltar a OS para "Planejada"? Isso permitirá iniciar outra OS.`,
                  });
                }}
                disabled={updateStatusMutation.isPending}
              >
                <X className="h-5 w-5" />
              </Button>
            )}
            
            {/* Botão de ação principal */}
            <Button
              className={`flex-1 h-14 text-base font-bold rounded-xl shadow-lg ${actionConfig.color}`}
              onClick={() => handleStatusChange(primaryAction)}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-6 w-6 mr-2 animate-spin" />
              ) : (
                <ActionIcon className="h-6 w-6 mr-2" />
              )}
              {actionConfig.label}
            </Button>
          </div>
        </div>
      )}

      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Dialog de Confirmação */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateStatusMutation.mutate(confirmDialog.status)}
              className="bg-green-600 hover:bg-green-700"
            >
              {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Seletor de Retorno de Campo */}
      {skillId && (
        <RetornoCampoSelector
          open={retornoCampoOpen}
          onOpenChange={setRetornoCampoOpen}
          skillId={skillId}
          onConfirm={handleRetornoCampoConfirm}
        />
      )}

      {/* Checklist de Serviço */}
      {skillId && (equipe?.id || equipeAuth?.id) && ordem?.id && (
        <ChecklistServicoSheet
          open={checklistServicoOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleChecklistServicoClose();
            } else {
              setChecklistServicoOpen(true);
            }
          }}
          skillId={skillId}
          grupoRetorno={grupoRetornoSelecionado}
          ordemServicoId={ordem.id}
          equipeId={(equipe?.id || equipeAuth?.id)!}
          onComplete={handleChecklistServicoComplete}
          onSkip={() => handleChecklistServicoComplete()}
        />
      )}

      {/* Dialog de OS em Andamento */}
      <Dialog 
        open={osEmAndamentoDialog.open} 
        onOpenChange={(open) => setOsEmAndamentoDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <DialogTitle className="text-lg">OS já em andamento</DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Você já possui uma Ordem de Serviço em andamento. 
                  Finalize o preenchimento dela antes de iniciar uma nova.
                </p>
                
                {osEmAndamentoDialog.os && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="font-semibold text-amber-900">
                      OS {osEmAndamentoDialog.os.numero}
                    </p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      {osEmAndamentoDialog.os.tipo}
                    </p>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setOsEmAndamentoDialog({ open: false, os: null })}
              className="flex-1"
            >
              Fechar
            </Button>
            <Button 
              onClick={() => {
                if (osEmAndamentoDialog.os) {
                  setOsEmAndamentoDialog({ open: false, os: null });
                  navigate(`/app/ordens/${osEmAndamentoDialog.os.id}`);
                }
              }}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Ir para OS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
