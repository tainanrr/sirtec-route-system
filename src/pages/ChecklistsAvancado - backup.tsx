import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ClipboardCheck,
  GripVertical,
  Copy,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Image,
  FileSignature,
  Type,
  ListChecks,
  ToggleLeft,
  Calendar,
  Hash,
  AlignLeft,
  Loader2,
  FolderPlus,
  Settings2,
  Link2,
  AlertCircle,
  Camera,
  Star,
  Zap,
  Layers,
  GitBranch,
  FileText,
  CircleDot,
  Square,
  CheckSquare,
  List,
  SlidersHorizontal,
  Clock,
  MapPin,
  Mail,
  Phone,
  Globe,
  Percent,
  DollarSign,
  Ruler,
  Thermometer,
  Droplets,
  Info,
  HelpCircle,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

// ============================================
// TIPOS E INTERFACES
// ============================================

// Tipos de pergunta disponíveis - expandido
const TIPOS_PERGUNTA = {
  // Texto
  texto: { label: "Texto Curto", icon: Type, category: "texto", description: "Resposta em texto livre (até 255 caracteres)" },
  texto_longo: { label: "Texto Longo", icon: AlignLeft, category: "texto", description: "Resposta em múltiplas linhas" },
  email: { label: "E-mail", icon: Mail, category: "texto", description: "Validação de e-mail" },
  telefone: { label: "Telefone", icon: Phone, category: "texto", description: "Formato de telefone" },
  url: { label: "URL/Link", icon: Globe, category: "texto", description: "Validação de URL" },
  
  // Numérico
  numero: { label: "Número Inteiro", icon: Hash, category: "numero", description: "Apenas números inteiros" },
  decimal: { label: "Número Decimal", icon: Percent, category: "numero", description: "Números com casas decimais" },
  moeda: { label: "Valor Monetário", icon: DollarSign, category: "numero", description: "Formato de moeda (R$)" },
  medida: { label: "Medida", icon: Ruler, category: "numero", description: "Valor com unidade de medida" },
  temperatura: { label: "Temperatura", icon: Thermometer, category: "numero", description: "Valor em °C" },
  porcentagem: { label: "Porcentagem", icon: Percent, category: "numero", description: "Valor em %" },
  
  // Seleção
  sim_nao: { label: "Sim/Não", icon: ToggleLeft, category: "selecao", description: "Resposta binária" },
  conforme_nao_conforme: { label: "Conforme/Não Conforme", icon: CheckSquare, category: "selecao", description: "Avaliação de conformidade" },
  escala: { label: "Escala (1-5)", icon: Star, category: "selecao", description: "Avaliação em escala" },
  escala_10: { label: "Escala (1-10)", icon: SlidersHorizontal, category: "selecao", description: "Avaliação em escala 1-10" },
  selecao_unica: { label: "Seleção Única", icon: CircleDot, category: "selecao", description: "Escolher uma opção" },
  multipla_escolha: { label: "Múltipla Escolha", icon: ListChecks, category: "selecao", description: "Escolher várias opções" },
  dropdown: { label: "Lista Suspensa", icon: List, category: "selecao", description: "Dropdown com opções" },
  
  // Mídia
  foto: { label: "Foto", icon: Camera, category: "midia", description: "Captura de imagem" },
  foto_multipla: { label: "Múltiplas Fotos", icon: Image, category: "midia", description: "Até 5 fotos" },
  assinatura: { label: "Assinatura", icon: FileSignature, category: "midia", description: "Captura de assinatura digital" },
  
  // Data/Hora
  data: { label: "Data", icon: Calendar, category: "data", description: "Seleção de data" },
  hora: { label: "Hora", icon: Clock, category: "data", description: "Seleção de hora" },
  data_hora: { label: "Data e Hora", icon: Calendar, category: "data", description: "Data e hora completa" },
  
  // Especiais
  localizacao: { label: "Localização GPS", icon: MapPin, category: "especial", description: "Captura coordenadas GPS" },
  informativo: { label: "Texto Informativo", icon: Info, category: "especial", description: "Apenas exibe informação (sem resposta)" },
  secao: { label: "Título de Seção", icon: FileText, category: "especial", description: "Separador visual" },
} as const;

type TipoPergunta = keyof typeof TIPOS_PERGUNTA;

// Operadores para condições
const OPERADORES_CONDICAO = {
  igual: { label: "É igual a", tipos: ["texto", "numero", "selecao"] },
  diferente: { label: "É diferente de", tipos: ["texto", "numero", "selecao"] },
  contem: { label: "Contém", tipos: ["texto"] },
  nao_contem: { label: "Não contém", tipos: ["texto"] },
  maior: { label: "É maior que", tipos: ["numero"] },
  menor: { label: "É menor que", tipos: ["numero"] },
  maior_igual: { label: "É maior ou igual a", tipos: ["numero"] },
  menor_igual: { label: "É menor ou igual a", tipos: ["numero"] },
  entre: { label: "Está entre", tipos: ["numero"] },
  vazio: { label: "Está vazio", tipos: ["texto", "numero", "selecao"] },
  preenchido: { label: "Está preenchido", tipos: ["texto", "numero", "selecao", "midia"] },
  sim: { label: "Respondeu SIM", tipos: ["selecao"] },
  nao: { label: "Respondeu NÃO", tipos: ["selecao"] },
  conforme: { label: "É CONFORME", tipos: ["selecao"] },
  nao_conforme: { label: "É NÃO CONFORME", tipos: ["selecao"] },
};

// Ações condicionais
const ACOES_CONDICAO = {
  mostrar: "Mostrar pergunta",
  ocultar: "Ocultar pergunta",
  obrigar: "Tornar obrigatória",
  desobrigar: "Tornar opcional",
  exigir_foto: "Exigir foto",
  exigir_observacao: "Exigir observação",
  pular_para: "Pular para pergunta/seção",
  finalizar: "Finalizar checklist",
  alerta: "Exibir alerta",
  bloquear: "Bloquear continuação",
};

// Interface para validação
interface Validacao {
  tipo: "min" | "max" | "regex" | "tamanho_min" | "tamanho_max" | "formato";
  valor: string | number;
  mensagem?: string;
}

// Interface para condição
interface Condicao {
  id: string;
  pergunta_origem_id: string;
  operador: keyof typeof OPERADORES_CONDICAO;
  valor?: string | number | string[];
  valor_fim?: number; // Para operador "entre"
  acao: keyof typeof ACOES_CONDICAO;
  acao_valor?: string; // ID da pergunta/seção para pular, ou texto do alerta
}

// Interface para opção de seleção
interface OpcaoSelecao {
  id: string;
  texto: string;
  valor?: string;
  cor?: string;
  icone?: string;
  pontuacao?: number;
  exige_foto?: boolean;
  exige_observacao?: boolean;
}

// Interface para pergunta - expandida
interface Pergunta {
  id: string;
  texto: string;
  descricao?: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  ordem: number;
  grupo_id?: string;
  
  // Opções para seleção
  opcoes?: OpcaoSelecao[];
  
  // Configurações de mídia
  foto_obrigatoria?: boolean;
  max_fotos?: number;
  observacao_obrigatoria?: boolean;
  
  // Validações
  validacoes?: Validacao[];
  
  // Condições
  condicoes?: Condicao[];
  visivel_se?: Condicao[]; // Condições para exibir esta pergunta
  
  // Configurações numéricas
  valor_min?: number;
  valor_max?: number;
  casas_decimais?: number;
  unidade?: string;
  
  // Configurações de escala
  escala_min?: number;
  escala_max?: number;
  escala_labels?: string[];
  
  // Placeholder e valor padrão
  placeholder?: string;
  valor_padrao?: string | number;
  
  // Pontuação (para checklists de avaliação)
  peso?: number;
  pontuacao_maxima?: number;
  
  // Metadados
  dica?: string;
  referencia?: string; // Norma técnica, procedimento, etc.
}

// Interface para grupo/seção
interface GrupoPerguntas {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
  cor?: string;
  icone?: string;
  colapsavel?: boolean;
  colapsado_inicial?: boolean;
  condicoes?: Condicao[]; // Condições para exibir o grupo
  perguntas: Pergunta[];
}

// Interface para checklist completo
interface ChecklistCompleto {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  versao: string;
  ativo: boolean;
  
  // Configurações gerais
  permite_salvar_rascunho?: boolean;
  exige_localizacao?: boolean;
  exige_foto_inicial?: boolean;
  exige_foto_final?: boolean;
  exige_assinatura?: boolean;
  tempo_limite_minutos?: number;
  
  // Pontuação
  usa_pontuacao?: boolean;
  pontuacao_minima_aprovacao?: number;
  
  // Grupos e perguntas
  grupos: GrupoPerguntas[];
  
  // Metadados
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// Tipos do checklist
const TIPOS_CHECKLIST = [
  { value: "apr", label: "APR - Análise Preliminar de Riscos", cor: "#ef4444" },
  { value: "qualidade", label: "Checklist de Qualidade", cor: "#3b82f6" },
  { value: "seguranca", label: "Checklist de Segurança", cor: "#f59e0b" },
  { value: "inspecao", label: "Inspeção Técnica", cor: "#8b5cf6" },
  { value: "manutencao", label: "Manutenção Preventiva", cor: "#10b981" },
  { value: "auditoria", label: "Auditoria", cor: "#6366f1" },
  { value: "vistoria", label: "Vistoria", cor: "#ec4899" },
  { value: "outro", label: "Outro", cor: "#6b7280" },
];

// Categorias de perguntas para o seletor
const CATEGORIAS_PERGUNTA = [
  { id: "texto", label: "Texto", icon: Type },
  { id: "numero", label: "Numérico", icon: Hash },
  { id: "selecao", label: "Seleção", icon: ListChecks },
  { id: "midia", label: "Mídia", icon: Camera },
  { id: "data", label: "Data/Hora", icon: Calendar },
  { id: "especial", label: "Especial", icon: Zap },
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ChecklistsAvancado() {
  // Estados principais
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [checklists, setChecklists] = useState<ChecklistCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistCompleto | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<ChecklistCompleto | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  // Estado do formulário
  const [formData, setFormData] = useState<Partial<ChecklistCompleto>>({
    nome: "",
    descricao: "",
    tipo: "apr",
    versao: "1.0",
    ativo: true,
    permite_salvar_rascunho: true,
    exige_localizacao: false,
    exige_foto_inicial: false,
    exige_foto_final: false,
    exige_assinatura: false,
    usa_pontuacao: false,
    grupos: [{
      id: crypto.randomUUID(),
      nome: "Perguntas Gerais",
      ordem: 1,
      perguntas: [],
    }],
  });

  // Estados para edição
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null);
  const [perguntaEditando, setPerguntaEditando] = useState<Pergunta | null>(null);
  const [grupoEditando, setGrupoEditando] = useState<GrupoPerguntas | null>(null);
  const [dialogPerguntaOpen, setDialogPerguntaOpen] = useState(false);
  const [dialogGrupoOpen, setDialogGrupoOpen] = useState(false);
  const [dialogCondicaoOpen, setDialogCondicaoOpen] = useState(false);

  // Carregar checklists
  const fetchChecklists = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const checklistsParsed = (data || []).map(c => {
        let grupos: GrupoPerguntas[] = [];
        
        // Priorizar a estrutura de grupos se existir
        if (c.grupos && (Array.isArray(c.grupos) ? c.grupos.length > 0 : Object.keys(c.grupos).length > 0)) {
          grupos = typeof c.grupos === 'string' ? JSON.parse(c.grupos) : c.grupos;
          
          // Garantir que cada pergunta tenha o grupo_id correto
          grupos = grupos.map(g => ({
            ...g,
            perguntas: (g.perguntas || []).map((p: Pergunta) => ({
              ...p,
              grupo_id: p.grupo_id || g.id,
            })),
          }));
        } else if (c.perguntas && Array.isArray(c.perguntas) && c.perguntas.length > 0) {
          // Converter estrutura antiga para nova
          const grupoId = `grupo-default-${c.id}`;
          grupos = [{
            id: grupoId,
            nome: "Perguntas Gerais",
            ordem: 1,
            perguntas: (c.perguntas as unknown as Pergunta[]).map((p, index) => ({
              ...p,
              grupo_id: grupoId,
              ordem: p.ordem || index + 1,
            })),
          }];
        }

        return {
          ...c,
          grupos,
          versao: c.versao || "1.0",
        } as ChecklistCompleto;
      });

      setChecklists(checklistsParsed);
    } catch (error: any) {
      console.error("Erro ao carregar checklists:", error);
      toast.error("Erro ao carregar checklists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklists();
  }, []);

  // Funções de manipulação
  const handleEdit = (checklist: ChecklistCompleto) => {
    setSelectedChecklist(checklist);
    
    // Garantir que os grupos tenham estrutura correta
    let grupos = checklist.grupos || [];
    
    if (grupos.length === 0) {
      grupos = [{
        id: crypto.randomUUID(),
        nome: "Perguntas Gerais",
        ordem: 1,
        perguntas: [],
      }];
    } else {
      // Garantir que cada grupo e pergunta tenha IDs válidos
      grupos = grupos.map((g, gIndex) => {
        const grupoId = g.id || crypto.randomUUID();
        return {
          ...g,
          id: grupoId,
          ordem: g.ordem || gIndex + 1,
          perguntas: (g.perguntas || []).map((p, pIndex) => ({
            ...p,
            id: p.id || crypto.randomUUID(),
            grupo_id: grupoId,
            ordem: p.ordem || pIndex + 1,
          })),
        };
      });
    }
    
    setFormData({
      ...checklist,
      grupos,
    });
    setActiveTab("info");
    setFormOpen(true);
  };

  const handlePreview = (checklist: ChecklistCompleto) => {
    setSelectedChecklist(checklist);
    setPreviewOpen(true);
  };

  const handleDuplicate = async (checklist: ChecklistCompleto) => {
    try {
      const novoChecklist = {
        nome: `${checklist.nome} (Cópia)`,
        descricao: checklist.descricao,
        tipo: checklist.tipo,
        versao: "1.0",
        ativo: false,
        grupos: checklist.grupos,
        permite_salvar_rascunho: checklist.permite_salvar_rascunho,
        exige_localizacao: checklist.exige_localizacao,
        exige_foto_inicial: checklist.exige_foto_inicial,
        exige_foto_final: checklist.exige_foto_final,
        exige_assinatura: checklist.exige_assinatura,
        usa_pontuacao: checklist.usa_pontuacao,
        pontuacao_minima_aprovacao: checklist.pontuacao_minima_aprovacao,
      };

      const { error } = await supabase.from("checklists").insert(novoChecklist);
      if (error) throw error;

      toast.success("Checklist duplicado com sucesso!");
      fetchChecklists();
    } catch (error: any) {
      console.error("Erro ao duplicar:", error);
      toast.error("Erro ao duplicar checklist");
    }
  };

  const handleDelete = async () => {
    if (!checklistToDelete) return;

    try {
      const { error } = await supabase
        .from("checklists")
        .delete()
        .eq("id", checklistToDelete.id);

      if (error) throw error;

      toast.success("Checklist excluído!");
      fetchChecklists();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir checklist");
    } finally {
      setDeleteDialogOpen(false);
      setChecklistToDelete(null);
    }
  };

  const handleSave = async () => {
    if (!formData.nome?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const totalPerguntas = formData.grupos?.reduce((acc, g) => acc + g.perguntas.length, 0) || 0;
    if (totalPerguntas === 0) {
      toast.error("Adicione pelo menos uma pergunta");
      return;
    }

    setSaving(true);
    try {
      // Preparar payload - converter grupos para o formato correto
      // A tabela pode ter coluna "perguntas" (antiga) ou "grupos" (nova)
      const payload: Record<string, unknown> = {
        nome: formData.nome?.trim(),
        descricao: formData.descricao?.trim() || null,
        tipo: formData.tipo,
        ativo: formData.ativo,
      };

      // Verificar se a tabela suporta a nova estrutura (grupos) ou antiga (perguntas)
      // Por segurança, salvamos em ambos os formatos
      if (formData.grupos && formData.grupos.length > 0) {
        // Salvar no formato novo (grupos)
        payload.grupos = formData.grupos;
        
        // Também salvar no formato antigo (perguntas) para compatibilidade
        // Flatten todas as perguntas de todos os grupos
        const todasPerguntas = formData.grupos.flatMap(g => g.perguntas);
        payload.perguntas = todasPerguntas;
      }

      // Campos opcionais que podem não existir na tabela
      if (formData.versao) payload.versao = formData.versao;
      if (formData.permite_salvar_rascunho !== undefined) payload.permite_salvar_rascunho = formData.permite_salvar_rascunho;
      if (formData.exige_localizacao !== undefined) payload.exige_localizacao = formData.exige_localizacao;
      if (formData.exige_foto_inicial !== undefined) payload.exige_foto_inicial = formData.exige_foto_inicial;
      if (formData.exige_foto_final !== undefined) payload.exige_foto_final = formData.exige_foto_final;
      if (formData.exige_assinatura !== undefined) payload.exige_assinatura = formData.exige_assinatura;
      if (formData.usa_pontuacao !== undefined) payload.usa_pontuacao = formData.usa_pontuacao;
      if (formData.pontuacao_minima_aprovacao !== undefined) payload.pontuacao_minima_aprovacao = formData.pontuacao_minima_aprovacao;

      console.log("[DEBUG] Salvando checklist:", {
        isUpdate: !!selectedChecklist,
        id: selectedChecklist?.id,
        payload,
        grupos: formData.grupos,
      });

      if (selectedChecklist) {
        const { data, error } = await supabase
          .from("checklists")
          .update(payload)
          .eq("id", selectedChecklist.id)
          .select();

        console.log("[DEBUG] Resultado update:", { data, error });

        if (error) throw error;
        toast.success("Checklist atualizado!");
      } else {
        const { data, error } = await supabase
          .from("checklists")
          .insert(payload)
          .select();

        console.log("[DEBUG] Resultado insert:", { data, error });

        if (error) throw error;
        toast.success("Checklist criado!");
      }

      setFormOpen(false);
      resetForm();
      fetchChecklists();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar checklist: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedChecklist(null);
    setFormData({
      nome: "",
      descricao: "",
      tipo: "apr",
      versao: "1.0",
      ativo: true,
      permite_salvar_rascunho: true,
      grupos: [{
        id: crypto.randomUUID(),
        nome: "Perguntas Gerais",
        ordem: 1,
        perguntas: [],
      }],
    });
    setActiveTab("info");
    setGrupoExpandido(null);
  };

  // Funções para grupos
  const adicionarGrupo = () => {
    const novoGrupo: GrupoPerguntas = {
      id: crypto.randomUUID(),
      nome: `Seção ${(formData.grupos?.length || 0) + 1}`,
      ordem: (formData.grupos?.length || 0) + 1,
      perguntas: [],
    };

    setFormData(prev => ({
      ...prev,
      grupos: [...(prev.grupos || []), novoGrupo],
    }));

    setGrupoExpandido(novoGrupo.id);
  };

  const removerGrupo = (grupoId: string) => {
    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.filter(g => g.id !== grupoId).map((g, i) => ({ ...g, ordem: i + 1 })),
    }));
  };

  const atualizarGrupo = (grupoId: string, dados: Partial<GrupoPerguntas>) => {
    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.map(g => g.id === grupoId ? { ...g, ...dados } : g),
    }));
  };

  // Funções para perguntas
  const adicionarPergunta = (grupoId: string, tipo: TipoPergunta) => {
    const grupo = formData.grupos?.find(g => g.id === grupoId);
    if (!grupo) return;

    const novaPergunta: Pergunta = {
      id: crypto.randomUUID(),
      texto: "",
      tipo,
      obrigatoria: true,
      ordem: grupo.perguntas.length + 1,
      grupo_id: grupoId,
    };

    // Configurações padrão por tipo
    if (tipo === "escala") {
      novaPergunta.escala_min = 1;
      novaPergunta.escala_max = 5;
    } else if (tipo === "escala_10") {
      novaPergunta.escala_min = 1;
      novaPergunta.escala_max = 10;
    } else if (tipo === "foto_multipla") {
      novaPergunta.max_fotos = 5;
    } else if (["selecao_unica", "multipla_escolha", "dropdown"].includes(tipo)) {
      novaPergunta.opcoes = [
        { id: crypto.randomUUID(), texto: "Opção 1" },
        { id: crypto.randomUUID(), texto: "Opção 2" },
      ];
    }

    setPerguntaEditando(novaPergunta);
    setDialogPerguntaOpen(true);
  };

  const salvarPergunta = (pergunta: Pergunta) => {
    // Encontrar o grupo_id da pergunta
    let grupoId = pergunta.grupo_id;
    
    // Se não tiver grupo_id, procurar em qual grupo a pergunta está
    if (!grupoId) {
      const grupoEncontrado = formData.grupos?.find(g => 
        g.perguntas.some(p => p.id === pergunta.id)
      );
      grupoId = grupoEncontrado?.id;
    }
    
    // Se ainda não encontrou, usar o primeiro grupo
    if (!grupoId && formData.grupos && formData.grupos.length > 0) {
      grupoId = formData.grupos[0].id;
    }
    
    if (!grupoId) {
      console.error("Não foi possível encontrar o grupo para salvar a pergunta");
      return;
    }

    // Atualizar o grupo_id na pergunta
    const perguntaAtualizada = { ...pergunta, grupo_id: grupoId };

    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.map(g => {
        if (g.id !== grupoId) return g;

        const perguntaExistente = g.perguntas.find(p => p.id === perguntaAtualizada.id);
        if (perguntaExistente) {
          return {
            ...g,
            perguntas: g.perguntas.map(p => p.id === perguntaAtualizada.id ? perguntaAtualizada : p),
          };
        } else {
          return {
            ...g,
            perguntas: [...g.perguntas, perguntaAtualizada],
          };
        }
      }),
    }));

    setDialogPerguntaOpen(false);
    setPerguntaEditando(null);
    toast.success("Pergunta salva!");
  };

  const removerPergunta = (grupoId: string, perguntaId: string) => {
    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.map(g => {
        if (g.id !== grupoId) return g;
        return {
          ...g,
          perguntas: g.perguntas
            .filter(p => p.id !== perguntaId)
            .map((p, i) => ({ ...p, ordem: i + 1 })),
        };
      }),
    }));
  };

  const editarPergunta = (pergunta: Pergunta) => {
    setPerguntaEditando({ ...pergunta });
    setDialogPerguntaOpen(true);
  };

  const duplicarPergunta = (grupoId: string, pergunta: Pergunta) => {
    const novaPergunta: Pergunta = {
      ...pergunta,
      id: crypto.randomUUID(),
      texto: `${pergunta.texto} (Cópia)`,
    };

    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.map(g => {
        if (g.id !== grupoId) return g;
        const perguntas = [...g.perguntas, novaPergunta].map((p, i) => ({ ...p, ordem: i + 1 }));
        return { ...g, perguntas };
      }),
    }));
  };

  // Drag and Drop
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "grupo") {
      const grupos = Array.from(formData.grupos || []);
      const [removed] = grupos.splice(source.index, 1);
      grupos.splice(destination.index, 0, removed);
      
      setFormData(prev => ({
        ...prev,
        grupos: grupos.map((g, i) => ({ ...g, ordem: i + 1 })),
      }));
    } else if (type === "pergunta") {
      const sourceGrupoId = source.droppableId;
      const destGrupoId = destination.droppableId;

      setFormData(prev => {
        const grupos = [...(prev.grupos || [])];
        const sourceGrupo = grupos.find(g => g.id === sourceGrupoId);
        const destGrupo = grupos.find(g => g.id === destGrupoId);

        if (!sourceGrupo || !destGrupo) return prev;

        const [movedPergunta] = sourceGrupo.perguntas.splice(source.index, 1);
        movedPergunta.grupo_id = destGrupoId;
        destGrupo.perguntas.splice(destination.index, 0, movedPergunta);

        // Reordenar
        sourceGrupo.perguntas = sourceGrupo.perguntas.map((p, i) => ({ ...p, ordem: i + 1 }));
        destGrupo.perguntas = destGrupo.perguntas.map((p, i) => ({ ...p, ordem: i + 1 }));

        return { ...prev, grupos };
      });
    }
  };

  // Filtro
  const filteredChecklists = checklists.filter((c) => {
    const matchesSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = tipoFilter === "all" || c.tipo === tipoFilter;
    return matchesSearch && matchesTipo;
  });

  // Contagem de perguntas
  const getTotalPerguntas = (checklist: ChecklistCompleto) => {
    return checklist.grupos?.reduce((acc, g) => acc + g.perguntas.length, 0) || 0;
  };

  return (
    <MainLayout
      title="Checklists Avançado"
      subtitle="Sistema completo de criação de formulários e checklists"
      breadcrumbs={[{ label: "Cadastros" }, { label: "Checklists" }]}
    >
      {/* Barra de Ações */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar checklist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {TIPOS_CHECKLIST.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tipo.cor }} />
                      {tipo.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="gap-2"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo Checklist
            </Button>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          {filteredChecklists.length} checklist(s) encontrado(s)
        </div>
      </div>

      {/* Lista de Checklists */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          Carregando...
        </div>
      ) : filteredChecklists.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum checklist encontrado.</p>
          <p className="text-sm">Clique em "Novo Checklist" para criar.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredChecklists.map((checklist) => {
            const tipoConfig = TIPOS_CHECKLIST.find(t => t.value === checklist.tipo);
            const totalPerguntas = getTotalPerguntas(checklist);
            const totalGrupos = checklist.grupos?.length || 0;

            return (
              <Card key={checklist.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: tipoConfig?.cor || "#6b7280" }} 
                        />
                        <Badge variant="outline" className="text-xs">
                          v{checklist.versao}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{checklist.nome}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {checklist.descricao || "Sem descrição"}
                      </CardDescription>
                    </div>
                    <Badge variant={checklist.ativo ? "default" : "secondary"}>
                      {checklist.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tipo:</span>
                      <Badge variant="outline">{tipoConfig?.label || checklist.tipo}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Seções:</span>
                      <span className="font-medium">{totalGrupos}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Perguntas:</span>
                      <span className="font-medium">{totalPerguntas}</span>
                    </div>

                    {/* Indicadores de recursos */}
                    <div className="flex flex-wrap gap-1 pt-2">
                      {checklist.exige_localizacao && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />GPS
                        </Badge>
                      )}
                      {checklist.exige_assinatura && (
                        <Badge variant="outline" className="text-xs">
                          <FileSignature className="h-3 w-3 mr-1" />Assinatura
                        </Badge>
                      )}
                      {checklist.usa_pontuacao && (
                        <Badge variant="outline" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />Pontuação
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handlePreview(checklist)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(checklist)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(checklist)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setChecklistToDelete(checklist);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de Formulário Principal */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) resetForm(); setFormOpen(open); }}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {selectedChecklist ? "Editar Checklist" : "Novo Checklist"}
            </DialogTitle>
            <DialogDescription>
              Configure o checklist com grupos, perguntas e condições
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Informações
                </TabsTrigger>
                <TabsTrigger value="perguntas" className="gap-2">
                  <ListChecks className="h-4 w-4" />
                  Perguntas
                </TabsTrigger>
                <TabsTrigger value="config" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Configurações
                </TabsTrigger>
                <TabsTrigger value="logica" className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  Lógica
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 h-[calc(95vh-220px)]">
              {/* Tab: Informações Básicas */}
              <TabsContent value="info" className="p-6 pt-4 m-0">
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome do Checklist *</Label>
                      <Input
                        id="nome"
                        value={formData.nome || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Ex: APR - Trabalho em Altura"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tipo">Tipo *</Label>
                        <Select
                          value={formData.tipo}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_CHECKLIST.map((tipo) => (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tipo.cor }} />
                                  {tipo.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="versao">Versão</Label>
                        <Input
                          id="versao"
                          value={formData.versao || "1.0"}
                          onChange={(e) => setFormData(prev => ({ ...prev, versao: e.target.value }))}
                          placeholder="1.0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descreva o objetivo e quando este checklist deve ser utilizado..."
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="ativo"
                        checked={formData.ativo}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                      />
                      <Label htmlFor="ativo">Checklist ativo</Label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Perguntas e Grupos */}
              <TabsContent value="perguntas" className="p-6 pt-4 m-0">
                <div className="space-y-4">
                  {/* Botão adicionar grupo */}
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={adicionarGrupo} className="gap-2">
                      <FolderPlus className="h-4 w-4" />
                      Nova Seção
                    </Button>
                  </div>

                  {/* Lista de grupos */}
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="grupos" type="grupo">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                          {formData.grupos?.map((grupo, grupoIndex) => (
                            <Draggable key={grupo.id} draggableId={grupo.id} index={grupoIndex}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    "transition-shadow",
                                    snapshot.isDragging && "shadow-lg"
                                  )}
                                >
                                  <Collapsible
                                    open={grupoExpandido === grupo.id}
                                    onOpenChange={(open) => setGrupoExpandido(open ? grupo.id : null)}
                                  >
                                    <CardHeader className="pb-2">
                                      <div className="flex items-center gap-2">
                                        <div {...provided.dragHandleProps} className="cursor-grab">
                                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <CollapsibleTrigger asChild>
                                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                                            {grupoExpandido === grupo.id ? (
                                              <ChevronDown className="h-4 w-4" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </CollapsibleTrigger>
                                        <div className="flex-1">
                                          <Input
                                            value={grupo.nome}
                                            onChange={(e) => atualizarGrupo(grupo.id, { nome: e.target.value })}
                                            className="font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                                            placeholder="Nome da seção"
                                          />
                                        </div>
                                        <Badge variant="secondary">
                                          {grupo.perguntas.length} pergunta(s)
                                        </Badge>
                                        {formData.grupos && formData.grupos.length > 1 && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => removerGrupo(grupo.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </CardHeader>

                                    <CollapsibleContent>
                                      <CardContent className="pt-0">
                                        {/* Descrição do grupo */}
                                        <Input
                                          value={grupo.descricao || ""}
                                          onChange={(e) => atualizarGrupo(grupo.id, { descricao: e.target.value })}
                                          placeholder="Descrição da seção (opcional)"
                                          className="mb-4 text-sm"
                                        />

                                        {/* Lista de perguntas */}
                                        <Droppable droppableId={grupo.id} type="pergunta">
                                          {(provided) => (
                                            <div
                                              {...provided.droppableProps}
                                              ref={provided.innerRef}
                                              className="space-y-2 min-h-[50px]"
                                            >
                                              {grupo.perguntas.map((pergunta, perguntaIndex) => {
                                                const tipoConfig = TIPOS_PERGUNTA[pergunta.tipo];
                                                const TipoIcon = tipoConfig?.icon || Type;

                                                return (
                                                  <Draggable
                                                    key={pergunta.id}
                                                    draggableId={pergunta.id}
                                                    index={perguntaIndex}
                                                  >
                                                    {(provided, snapshot) => (
                                                      <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={cn(
                                                          "flex items-center gap-2 p-3 rounded-lg border bg-background",
                                                          snapshot.isDragging && "shadow-lg"
                                                        )}
                                                      >
                                                        <div {...provided.dragHandleProps} className="cursor-grab">
                                                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                        <Badge variant="outline" className="shrink-0">
                                                          {pergunta.ordem}
                                                        </Badge>
                                                        <TipoIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                          <p className="text-sm font-medium truncate">
                                                            {pergunta.texto || "(Sem texto)"}
                                                          </p>
                                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span>{tipoConfig?.label}</span>
                                                            {pergunta.obrigatoria && (
                                                              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                                                Obrigatória
                                                              </Badge>
                                                            )}
                                                            {pergunta.foto_obrigatoria && (
                                                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                                <Camera className="h-2 w-2 mr-0.5" />Foto
                                                              </Badge>
                                                            )}
                                                            {pergunta.condicoes && pergunta.condicoes.length > 0 && (
                                                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                                <GitBranch className="h-2 w-2 mr-0.5" />Condicional
                                                              </Badge>
                                                            )}
                                                          </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => editarPergunta(pergunta)}
                                                          >
                                                            <Edit className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => duplicarPergunta(grupo.id, pergunta)}
                                                          >
                                                            <Copy className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                                            onClick={() => removerPergunta(grupo.id, pergunta.id)}
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </Draggable>
                                                );
                                              })}
                                              {provided.placeholder}
                                            </div>
                                          )}
                                        </Droppable>

                                        {/* Botões para adicionar pergunta */}
                                        <div className="mt-4 pt-4 border-t">
                                          <p className="text-sm text-muted-foreground mb-2">Adicionar pergunta:</p>
                                          <div className="flex flex-wrap gap-2">
                                            {CATEGORIAS_PERGUNTA.map((cat) => {
                                              const perguntas = Object.entries(TIPOS_PERGUNTA)
                                                .filter(([_, v]) => v.category === cat.id);
                                              
                                              return (
                                                <Select
                                                  key={cat.id}
                                                  onValueChange={(tipo) => adicionarPergunta(grupo.id, tipo as TipoPergunta)}
                                                >
                                                  <SelectTrigger className="w-auto gap-2">
                                                    <cat.icon className="h-4 w-4" />
                                                    {cat.label}
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {perguntas.map(([key, config]) => {
                                                      const Icon = config.icon;
                                                      return (
                                                        <SelectItem key={key} value={key}>
                                                          <div className="flex items-center gap-2">
                                                            <Icon className="h-4 w-4" />
                                                            <span>{config.label}</span>
                                                          </div>
                                                        </SelectItem>
                                                      );
                                                    })}
                                                  </SelectContent>
                                                </Select>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              </TabsContent>

              {/* Tab: Configurações */}
              <TabsContent value="config" className="p-6 pt-4 m-0">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Requisitos de Preenchimento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Permitir salvar rascunho</Label>
                          <p className="text-xs text-muted-foreground">
                            Usuário pode salvar e continuar depois
                          </p>
                        </div>
                        <Switch
                          checked={formData.permite_salvar_rascunho}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, permite_salvar_rascunho: checked }))
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Exigir localização GPS</Label>
                          <p className="text-xs text-muted-foreground">
                            Captura coordenadas ao iniciar
                          </p>
                        </div>
                        <Switch
                          checked={formData.exige_localizacao}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, exige_localizacao: checked }))
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Exigir foto inicial</Label>
                          <p className="text-xs text-muted-foreground">
                            Foto obrigatória antes de começar
                          </p>
                        </div>
                        <Switch
                          checked={formData.exige_foto_inicial}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, exige_foto_inicial: checked }))
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Exigir foto final</Label>
                          <p className="text-xs text-muted-foreground">
                            Foto obrigatória ao finalizar
                          </p>
                        </div>
                        <Switch
                          checked={formData.exige_foto_final}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, exige_foto_final: checked }))
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Exigir assinatura</Label>
                          <p className="text-xs text-muted-foreground">
                            Assinatura digital ao finalizar
                          </p>
                        </div>
                        <Switch
                          checked={formData.exige_assinatura}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, exige_assinatura: checked }))
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sistema de Pontuação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Usar sistema de pontuação</Label>
                          <p className="text-xs text-muted-foreground">
                            Calcular score baseado nas respostas
                          </p>
                        </div>
                        <Switch
                          checked={formData.usa_pontuacao}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, usa_pontuacao: checked }))
                          }
                        />
                      </div>
                      {formData.usa_pontuacao && (
                        <div className="space-y-2">
                          <Label>Pontuação mínima para aprovação (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={formData.pontuacao_minima_aprovacao || 70}
                            onChange={(e) => 
                              setFormData(prev => ({ 
                                ...prev, 
                                pontuacao_minima_aprovacao: Number(e.target.value) 
                              }))
                            }
                            className="w-32"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tempo Limite</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label>Tempo limite para preenchimento (minutos)</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Deixe em branco para sem limite
                        </p>
                        <Input
                          type="number"
                          min={1}
                          value={formData.tempo_limite_minutos || ""}
                          onChange={(e) => 
                            setFormData(prev => ({ 
                              ...prev, 
                              tempo_limite_minutos: e.target.value ? Number(e.target.value) : undefined 
                            }))
                          }
                          placeholder="Sem limite"
                          className="w-32"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab: Lógica Condicional */}
              <TabsContent value="logica" className="p-6 pt-4 m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      Regras Condicionais
                    </CardTitle>
                    <CardDescription>
                      Configure regras para mostrar/ocultar perguntas baseado em respostas anteriores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Configure as condições diretamente em cada pergunta</p>
                      <p className="text-sm mt-1">
                        Clique em editar uma pergunta e vá até a aba "Condições"
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="p-6 pt-4 border-t">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                {formData.grupos?.reduce((acc, g) => acc + g.perguntas.length, 0) || 0} pergunta(s) em {formData.grupos?.length || 0} seção(ões)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { resetForm(); setFormOpen(false); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {selectedChecklist ? "Salvar Alterações" : "Criar Checklist"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Pergunta */}
      <PerguntaDialog
        open={dialogPerguntaOpen}
        onOpenChange={setDialogPerguntaOpen}
        pergunta={perguntaEditando}
        onSave={salvarPergunta}
        todasPerguntas={formData.grupos?.flatMap(g => g.perguntas) || []}
      />

      {/* Dialog de Preview */}
      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        checklist={selectedChecklist}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Checklist</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o checklist "{checklistToDelete?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

// ============================================
// COMPONENTE: Dialog de Edição de Pergunta
// ============================================

interface PerguntaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pergunta: Pergunta | null;
  onSave: (pergunta: Pergunta) => void;
  todasPerguntas: Pergunta[];
}

function PerguntaDialog({ open, onOpenChange, pergunta, onSave, todasPerguntas }: PerguntaDialogProps) {
  const [formPergunta, setFormPergunta] = useState<Pergunta | null>(null);
  const [activeTab, setActiveTab] = useState("geral");

  useEffect(() => {
    if (pergunta) {
      setFormPergunta({ ...pergunta });
      setActiveTab("geral");
    }
  }, [pergunta]);

  if (!formPergunta) return null;

  const tipoConfig = TIPOS_PERGUNTA[formPergunta.tipo];
  const TipoIcon = tipoConfig?.icon || Type;
  const isSelecao = ["selecao_unica", "multipla_escolha", "dropdown"].includes(formPergunta.tipo);
  const isNumerico = ["numero", "decimal", "moeda", "medida", "temperatura", "porcentagem"].includes(formPergunta.tipo);
  const isEscala = ["escala", "escala_10"].includes(formPergunta.tipo);

  const adicionarOpcao = () => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        opcoes: [...(prev.opcoes || []), { id: crypto.randomUUID(), texto: "" }],
      };
    });
  };

  const atualizarOpcao = (id: string, dados: Partial<OpcaoSelecao>) => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        opcoes: prev.opcoes?.map(o => o.id === id ? { ...o, ...dados } : o),
      };
    });
  };

  const removerOpcao = (id: string) => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        opcoes: prev.opcoes?.filter(o => o.id !== id),
      };
    });
  };

  const adicionarCondicao = () => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      const novaCondicao: Condicao = {
        id: crypto.randomUUID(),
        pergunta_origem_id: "",
        operador: "igual",
        acao: "mostrar",
      };
      return {
        ...prev,
        condicoes: [...(prev.condicoes || []), novaCondicao],
      };
    });
  };

  const atualizarCondicao = (id: string, dados: Partial<Condicao>) => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        condicoes: prev.condicoes?.map(c => c.id === id ? { ...c, ...dados } : c),
      };
    });
  };

  const removerCondicao = (id: string) => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        condicoes: prev.condicoes?.filter(c => c.id !== id),
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TipoIcon className="h-5 w-5" />
            Editar Pergunta - {tipoConfig?.label}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="opcoes" disabled={!isSelecao && !isEscala}>
              Opções
            </TabsTrigger>
            <TabsTrigger value="validacao">Validação</TabsTrigger>
            <TabsTrigger value="condicoes">Condições</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            {/* Tab Geral */}
            <TabsContent value="geral" className="space-y-4 m-0">
              {/* Tipo da Pergunta */}
              <div className="space-y-2">
                <Label>Tipo da Pergunta *</Label>
                <Select
                  value={formPergunta.tipo}
                  onValueChange={(value: TipoPergunta) => {
                    setFormPergunta(prev => {
                      if (!prev) return prev;
                      const novoTipo = value;
                      const updates: Partial<Pergunta> = { tipo: novoTipo };
                      
                      // Configurações padrão por tipo
                      if (novoTipo === "escala") {
                        updates.escala_min = 1;
                        updates.escala_max = 5;
                      } else if (novoTipo === "escala_10") {
                        updates.escala_min = 1;
                        updates.escala_max = 10;
                      } else if (novoTipo === "foto_multipla") {
                        updates.max_fotos = 5;
                      } else if (["selecao_unica", "multipla_escolha", "dropdown"].includes(novoTipo)) {
                        if (!prev.opcoes || prev.opcoes.length === 0) {
                          updates.opcoes = [
                            { id: crypto.randomUUID(), texto: "Opção 1" },
                            { id: crypto.randomUUID(), texto: "Opção 2" },
                          ];
                        }
                      }
                      
                      return { ...prev, ...updates };
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <TipoIcon className="h-4 w-4" />
                        <span>{tipoConfig?.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {CATEGORIAS_PERGUNTA.map((cat) => {
                      const perguntas = Object.entries(TIPOS_PERGUNTA)
                        .filter(([_, v]) => v.category === cat.id);
                      
                      return (
                        <div key={cat.id}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                            {cat.label}
                          </div>
                          {perguntas.map(([key, config]) => {
                            const Icon = config.icon;
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{config.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </div>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Texto da Pergunta *</Label>
                <Input
                  value={formPergunta.texto}
                  onChange={(e) => setFormPergunta(prev => prev ? { ...prev, texto: e.target.value } : prev)}
                  placeholder="Digite a pergunta..."
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição/Ajuda</Label>
                <Textarea
                  value={formPergunta.descricao || ""}
                  onChange={(e) => setFormPergunta(prev => prev ? { ...prev, descricao: e.target.value } : prev)}
                  placeholder="Texto de ajuda para o usuário..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Placeholder</Label>
                  <Input
                    value={formPergunta.placeholder || ""}
                    onChange={(e) => setFormPergunta(prev => prev ? { ...prev, placeholder: e.target.value } : prev)}
                    placeholder="Texto de exemplo..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Referência/Norma</Label>
                  <Input
                    value={formPergunta.referencia || ""}
                    onChange={(e) => setFormPergunta(prev => prev ? { ...prev, referencia: e.target.value } : prev)}
                    placeholder="Ex: NR-35, ISO 9001..."
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Pergunta obrigatória</Label>
                    <p className="text-xs text-muted-foreground">
                      Deve ser respondida para enviar
                    </p>
                  </div>
                  <Switch
                    checked={formPergunta.obrigatoria}
                    onCheckedChange={(checked) => 
                      setFormPergunta(prev => prev ? { ...prev, obrigatoria: checked } : prev)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Exigir foto</Label>
                    <p className="text-xs text-muted-foreground">
                      Foto obrigatória junto com a resposta
                    </p>
                  </div>
                  <Switch
                    checked={formPergunta.foto_obrigatoria}
                    onCheckedChange={(checked) => 
                      setFormPergunta(prev => prev ? { ...prev, foto_obrigatoria: checked } : prev)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Exigir observação</Label>
                    <p className="text-xs text-muted-foreground">
                      Campo de texto adicional obrigatório
                    </p>
                  </div>
                  <Switch
                    checked={formPergunta.observacao_obrigatoria}
                    onCheckedChange={(checked) => 
                      setFormPergunta(prev => prev ? { ...prev, observacao_obrigatoria: checked } : prev)
                    }
                  />
                </div>
              </div>

              {isNumerico && (
                <>
                  <Separator />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Valor mínimo</Label>
                      <Input
                        type="number"
                        value={formPergunta.valor_min ?? ""}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { 
                            ...prev, 
                            valor_min: e.target.value ? Number(e.target.value) : undefined 
                          } : prev)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor máximo</Label>
                      <Input
                        type="number"
                        value={formPergunta.valor_max ?? ""}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { 
                            ...prev, 
                            valor_max: e.target.value ? Number(e.target.value) : undefined 
                          } : prev)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade</Label>
                      <Input
                        value={formPergunta.unidade || ""}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { ...prev, unidade: e.target.value } : prev)
                        }
                        placeholder="m, kg, °C..."
                      />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Tab Opções */}
            <TabsContent value="opcoes" className="space-y-4 m-0">
              {isSelecao && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Opções de Resposta</Label>
                    <Button size="sm" variant="outline" onClick={adicionarOpcao}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {formPergunta.opcoes?.map((opcao, index) => (
                      <Card key={opcao.id} className="p-3">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="shrink-0 mt-2">
                            {index + 1}
                          </Badge>
                          <div className="flex-1 space-y-2">
                            <Input
                              value={opcao.texto}
                              onChange={(e) => atualizarOpcao(opcao.id, { texto: e.target.value })}
                              placeholder="Texto da opção"
                            />
                            <div className="flex gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`foto-${opcao.id}`}
                                  checked={opcao.exige_foto}
                                  onCheckedChange={(checked) => 
                                    atualizarOpcao(opcao.id, { exige_foto: checked as boolean })
                                  }
                                />
                                <Label htmlFor={`foto-${opcao.id}`} className="text-xs">
                                  Exige foto
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`obs-${opcao.id}`}
                                  checked={opcao.exige_observacao}
                                  onCheckedChange={(checked) => 
                                    atualizarOpcao(opcao.id, { exige_observacao: checked as boolean })
                                  }
                                />
                                <Label htmlFor={`obs-${opcao.id}`} className="text-xs">
                                  Exige observação
                                </Label>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removerOpcao(opcao.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {isEscala && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor mínimo da escala</Label>
                      <Input
                        type="number"
                        value={formPergunta.escala_min ?? 1}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { 
                            ...prev, 
                            escala_min: Number(e.target.value) 
                          } : prev)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor máximo da escala</Label>
                      <Input
                        type="number"
                        value={formPergunta.escala_max ?? 5}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { 
                            ...prev, 
                            escala_max: Number(e.target.value) 
                          } : prev)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab Validação */}
            <TabsContent value="validacao" className="space-y-4 m-0">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">
                  Configure validações adicionais para esta pergunta
                </p>
              </Card>
            </TabsContent>

            {/* Tab Condições */}
            <TabsContent value="condicoes" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Condições para esta pergunta</Label>
                  <p className="text-xs text-muted-foreground">
                    Defina quando esta pergunta deve aparecer ou ações baseadas em respostas
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={adicionarCondicao}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Condição
                </Button>
              </div>

              {formPergunta.condicoes?.map((condicao) => (
                <Card key={condicao.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        <GitBranch className="h-3 w-3 mr-1" />
                        Condição
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removerCondicao(condicao.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={condicao.pergunta_origem_id}
                        onValueChange={(value) => atualizarCondicao(condicao.id, { pergunta_origem_id: value })}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Pergunta..." />
                        </SelectTrigger>
                        <SelectContent>
                          {todasPerguntas
                            .filter(p => p.id !== formPergunta.id)
                            .map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.texto.slice(0, 30)}...
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>

                      <Select
                        value={condicao.operador}
                        onValueChange={(value) => 
                          atualizarCondicao(condicao.id, { operador: value as keyof typeof OPERADORES_CONDICAO })
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(OPERADORES_CONDICAO).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        value={condicao.valor as string || ""}
                        onChange={(e) => atualizarCondicao(condicao.id, { valor: e.target.value })}
                        placeholder="Valor..."
                        className="text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Então:</span>
                      <Select
                        value={condicao.acao}
                        onValueChange={(value) => 
                          atualizarCondicao(condicao.id, { acao: value as keyof typeof ACOES_CONDICAO })
                        }
                      >
                        <SelectTrigger className="text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ACOES_CONDICAO).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}

              {(!formPergunta.condicoes || formPergunta.condicoes.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma condição configurada</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => formPergunta && onSave(formPergunta)}>
            Salvar Pergunta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// COMPONENTE: Dialog de Preview
// ============================================

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklist: ChecklistCompleto | null;
}

function PreviewDialog({ open, onOpenChange, checklist }: PreviewDialogProps) {
  if (!checklist) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview: {checklist.nome}
          </DialogTitle>
          <DialogDescription>
            {checklist.descricao || "Visualização do checklist como aparecerá no app"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {checklist.grupos?.map((grupo) => (
              <div key={grupo.id} className="space-y-3">
                <div className="sticky top-0 bg-background py-2">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    {grupo.nome}
                  </h3>
                  {grupo.descricao && (
                    <p className="text-sm text-muted-foreground">{grupo.descricao}</p>
                  )}
                </div>

                {grupo.perguntas.map((pergunta) => {
                  const tipoConfig = TIPOS_PERGUNTA[pergunta.tipo];
                  const TipoIcon = tipoConfig?.icon || Type;

                  return (
                    <Card key={pergunta.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="shrink-0 mt-0.5">
                            {pergunta.ordem}
                          </Badge>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <TipoIcon className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium">
                                {pergunta.texto}
                                {pergunta.obrigatoria && <span className="text-destructive ml-1">*</span>}
                              </p>
                            </div>
                            {pergunta.descricao && (
                              <p className="text-xs text-muted-foreground">{pergunta.descricao}</p>
                            )}

                            {/* Preview do campo */}
                            <div className="mt-2 opacity-60">
                              {pergunta.tipo === "texto" && (
                                <Input placeholder={pergunta.placeholder || "Resposta..."} disabled />
                              )}
                              {pergunta.tipo === "texto_longo" && (
                                <Textarea placeholder={pergunta.placeholder || "Resposta..."} rows={2} disabled />
                              )}
                              {["numero", "decimal", "moeda", "medida"].includes(pergunta.tipo) && (
                                <div className="flex items-center gap-2">
                                  <Input type="number" placeholder="0" disabled className="w-32" />
                                  {pergunta.unidade && <span className="text-sm">{pergunta.unidade}</span>}
                                </div>
                              )}
                              {pergunta.tipo === "sim_nao" && (
                                <div className="flex gap-4">
                                  <label key="sim" className="flex items-center gap-2">
                                    <input type="radio" disabled />
                                    <span>Sim</span>
                                  </label>
                                  <label key="nao" className="flex items-center gap-2">
                                    <input type="radio" disabled />
                                    <span>Não</span>
                                  </label>
                                </div>
                              )}
                              {["selecao_unica", "multipla_escolha", "dropdown"].includes(pergunta.tipo) && pergunta.opcoes && (
                                <div className="space-y-1">
                                  {pergunta.opcoes.map((opcao) => (
                                    <label key={opcao.id} className="flex items-center gap-2">
                                      <Checkbox disabled />
                                      <span className="text-sm">{opcao.texto}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              {["escala", "escala_10"].includes(pergunta.tipo) && (
                                <div className="flex gap-2">
                                  {Array.from(
                                    { length: (pergunta.escala_max || 5) - (pergunta.escala_min || 1) + 1 },
                                    (_, i) => (pergunta.escala_min || 1) + i
                                  ).map((n) => (
                                    <Button key={n} variant="outline" size="sm" disabled>
                                      {n}
                                    </Button>
                                  ))}
                                </div>
                              )}
                              {pergunta.tipo === "foto" && (
                                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                  <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Tirar foto</p>
                                </div>
                              )}
                              {pergunta.tipo === "assinatura" && (
                                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                  <FileSignature className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Área de assinatura</p>
                                </div>
                              )}
                              {pergunta.tipo === "data" && (
                                <Input type="date" disabled className="w-48" />
                              )}
                            </div>

                            {/* Indicadores */}
                            <div className="flex gap-2 mt-2">
                              {pergunta.foto_obrigatoria && (
                                <Badge variant="outline" className="text-xs">
                                  <Camera className="h-3 w-3 mr-1" />
                                  Foto obrigatória
                                </Badge>
                              )}
                              {pergunta.observacao_obrigatoria && (
                                <Badge variant="outline" className="text-xs">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Observação obrigatória
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ClipboardCheck,
  GripVertical,
  Copy,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Image,
  FileSignature,
  Type,
  ListChecks,
  ToggleLeft,
  Calendar,
  Hash,
  AlignLeft,
  Loader2,
  FolderPlus,
  Settings2,
  Link2,
  AlertCircle,
  Camera,
  Star,
  Zap,
  Layers,
  GitBranch,
  FileText,
  CircleDot,
  Square,
  CheckSquare,
  List,
  SlidersHorizontal,
  Clock,
  MapPin,
  Mail,
  Phone,
  Globe,
  Percent,
  DollarSign,
  Ruler,
  Thermometer,
  Droplets,
  Info,
  HelpCircle,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

// ============================================
// TIPOS E INTERFACES
// ============================================

// Tipos de pergunta disponíveis - expandido
const TIPOS_PERGUNTA = {
  // Texto
  texto: { label: "Texto Curto", icon: Type, category: "texto", description: "Resposta em texto livre (até 255 caracteres)" },
  texto_longo: { label: "Texto Longo", icon: AlignLeft, category: "texto", description: "Resposta em múltiplas linhas" },
  email: { label: "E-mail", icon: Mail, category: "texto", description: "Validação de e-mail" },
  telefone: { label: "Telefone", icon: Phone, category: "texto", description: "Formato de telefone" },
  url: { label: "URL/Link", icon: Globe, category: "texto", description: "Validação de URL" },
  
  // Numérico
  numero: { label: "Número Inteiro", icon: Hash, category: "numero", description: "Apenas números inteiros" },
  decimal: { label: "Número Decimal", icon: Percent, category: "numero", description: "Números com casas decimais" },
  moeda: { label: "Valor Monetário", icon: DollarSign, category: "numero", description: "Formato de moeda (R$)" },
  medida: { label: "Medida", icon: Ruler, category: "numero", description: "Valor com unidade de medida" },
  temperatura: { label: "Temperatura", icon: Thermometer, category: "numero", description: "Valor em °C" },
  porcentagem: { label: "Porcentagem", icon: Percent, category: "numero", description: "Valor em %" },
  
  // Seleção
  sim_nao: { label: "Sim/Não", icon: ToggleLeft, category: "selecao", description: "Resposta binária" },
  conforme_nao_conforme: { label: "Conforme/Não Conforme", icon: CheckSquare, category: "selecao", description: "Avaliação de conformidade" },
  escala: { label: "Escala (1-5)", icon: Star, category: "selecao", description: "Avaliação em escala" },
  escala_10: { label: "Escala (1-10)", icon: SlidersHorizontal, category: "selecao", description: "Avaliação em escala 1-10" },
  selecao_unica: { label: "Seleção Única", icon: CircleDot, category: "selecao", description: "Escolher uma opção" },
  multipla_escolha: { label: "Múltipla Escolha", icon: ListChecks, category: "selecao", description: "Escolher várias opções" },
  dropdown: { label: "Lista Suspensa", icon: List, category: "selecao", description: "Dropdown com opções" },
  
  // Mídia
  foto: { label: "Foto", icon: Camera, category: "midia", description: "Captura de imagem" },
  foto_multipla: { label: "Múltiplas Fotos", icon: Image, category: "midia", description: "Até 5 fotos" },
  assinatura: { label: "Assinatura", icon: FileSignature, category: "midia", description: "Captura de assinatura digital" },
  
  // Data/Hora
  data: { label: "Data", icon: Calendar, category: "data", description: "Seleção de data" },
  hora: { label: "Hora", icon: Clock, category: "data", description: "Seleção de hora" },
  data_hora: { label: "Data e Hora", icon: Calendar, category: "data", description: "Data e hora completa" },
  
  // Especiais
  localizacao: { label: "Localização GPS", icon: MapPin, category: "especial", description: "Captura coordenadas GPS" },
  informativo: { label: "Texto Informativo", icon: Info, category: "especial", description: "Apenas exibe informação (sem resposta)" },
  secao: { label: "Título de Seção", icon: FileText, category: "especial", description: "Separador visual" },
} as const;

type TipoPergunta = keyof typeof TIPOS_PERGUNTA;

// Operadores para condições
const OPERADORES_CONDICAO = {
  igual: { label: "É igual a", tipos: ["texto", "numero", "selecao"] },
  diferente: { label: "É diferente de", tipos: ["texto", "numero", "selecao"] },
  contem: { label: "Contém", tipos: ["texto"] },
  nao_contem: { label: "Não contém", tipos: ["texto"] },
  maior: { label: "É maior que", tipos: ["numero"] },
  menor: { label: "É menor que", tipos: ["numero"] },
  maior_igual: { label: "É maior ou igual a", tipos: ["numero"] },
  menor_igual: { label: "É menor ou igual a", tipos: ["numero"] },
  entre: { label: "Está entre", tipos: ["numero"] },
  vazio: { label: "Está vazio", tipos: ["texto", "numero", "selecao"] },
  preenchido: { label: "Está preenchido", tipos: ["texto", "numero", "selecao", "midia"] },
  sim: { label: "Respondeu SIM", tipos: ["selecao"] },
  nao: { label: "Respondeu NÃO", tipos: ["selecao"] },
  conforme: { label: "É CONFORME", tipos: ["selecao"] },
  nao_conforme: { label: "É NÃO CONFORME", tipos: ["selecao"] },
};

// Ações condicionais
const ACOES_CONDICAO = {
  mostrar: "Mostrar pergunta",
  ocultar: "Ocultar pergunta",
  obrigar: "Tornar obrigatória",
  desobrigar: "Tornar opcional",
  exigir_foto: "Exigir foto",
  exigir_observacao: "Exigir observação",
  pular_para: "Pular para pergunta/seção",
  finalizar: "Finalizar checklist",
  alerta: "Exibir alerta",
  bloquear: "Bloquear continuação",
};

// Interface para validação
interface Validacao {
  tipo: "min" | "max" | "regex" | "tamanho_min" | "tamanho_max" | "formato";
  valor: string | number;
  mensagem?: string;
}

// Interface para condição
interface Condicao {
  id: string;
  pergunta_origem_id: string;
  operador: keyof typeof OPERADORES_CONDICAO;
  valor?: string | number | string[];
  valor_fim?: number; // Para operador "entre"
  acao: keyof typeof ACOES_CONDICAO;
  acao_valor?: string; // ID da pergunta/seção para pular, ou texto do alerta
}

// Interface para opção de seleção
interface OpcaoSelecao {
  id: string;
  texto: string;
  valor?: string;
  cor?: string;
  icone?: string;
  pontuacao?: number;
  exige_foto?: boolean;
  exige_observacao?: boolean;
}

// Interface para pergunta - expandida
interface Pergunta {
  id: string;
  texto: string;
  descricao?: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  ordem: number;
  grupo_id?: string;
  
  // Opções para seleção
  opcoes?: OpcaoSelecao[];
  
  // Configurações de mídia
  foto_obrigatoria?: boolean;
  max_fotos?: number;
  observacao_obrigatoria?: boolean;
  
  // Validações
  validacoes?: Validacao[];
  
  // Condições
  condicoes?: Condicao[];
  visivel_se?: Condicao[]; // Condições para exibir esta pergunta
  
  // Configurações numéricas
  valor_min?: number;
  valor_max?: number;
  casas_decimais?: number;
  unidade?: string;
  
  // Configurações de escala
  escala_min?: number;
  escala_max?: number;
  escala_labels?: string[];
  
  // Placeholder e valor padrão
  placeholder?: string;
  valor_padrao?: string | number;
  
  // Pontuação (para checklists de avaliação)
  peso?: number;
  pontuacao_maxima?: number;
  
  // Metadados
  dica?: string;
  referencia?: string; // Norma técnica, procedimento, etc.
}

// Interface para grupo/seção
interface GrupoPerguntas {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
  cor?: string;
  icone?: string;
  colapsavel?: boolean;
  colapsado_inicial?: boolean;
  condicoes?: Condicao[]; // Condições para exibir o grupo
  perguntas: Pergunta[];
}

// Interface para checklist completo
interface ChecklistCompleto {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  versao: string;
  ativo: boolean;
  
  // Configurações gerais
  permite_salvar_rascunho?: boolean;
  exige_localizacao?: boolean;
  exige_foto_inicial?: boolean;
  exige_foto_final?: boolean;
  exige_assinatura?: boolean;
  tempo_limite_minutos?: number;
  
  // Pontuação
  usa_pontuacao?: boolean;
  pontuacao_minima_aprovacao?: number;
  
  // Grupos e perguntas
  grupos: GrupoPerguntas[];
  
  // Metadados
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// Tipos do checklist
const TIPOS_CHECKLIST = [
  { value: "apr", label: "APR - Análise Preliminar de Riscos", cor: "#ef4444" },
  { value: "qualidade", label: "Checklist de Qualidade", cor: "#3b82f6" },
  { value: "seguranca", label: "Checklist de Segurança", cor: "#f59e0b" },
  { value: "inspecao", label: "Inspeção Técnica", cor: "#8b5cf6" },
  { value: "manutencao", label: "Manutenção Preventiva", cor: "#10b981" },
  { value: "auditoria", label: "Auditoria", cor: "#6366f1" },
  { value: "vistoria", label: "Vistoria", cor: "#ec4899" },
  { value: "outro", label: "Outro", cor: "#6b7280" },
];

// Categorias de perguntas para o seletor
const CATEGORIAS_PERGUNTA = [
  { id: "texto", label: "Texto", icon: Type },
  { id: "numero", label: "Numérico", icon: Hash },
  { id: "selecao", label: "Seleção", icon: ListChecks },
  { id: "midia", label: "Mídia", icon: Camera },
  { id: "data", label: "Data/Hora", icon: Calendar },
  { id: "especial", label: "Especial", icon: Zap },
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ChecklistsAvancado() {
  // Estados principais
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [checklists, setChecklists] = useState<ChecklistCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistCompleto | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<ChecklistCompleto | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  // Estado do formulário
  const [formData, setFormData] = useState<Partial<ChecklistCompleto>>({
    nome: "",
    descricao: "",
    tipo: "apr",
    versao: "1.0",
    ativo: true,
    permite_salvar_rascunho: true,
    exige_localizacao: false,
    exige_foto_inicial: false,
    exige_foto_final: false,
    exige_assinatura: false,
    usa_pontuacao: false,
    grupos: [{
      id: crypto.randomUUID(),
      nome: "Perguntas Gerais",
      ordem: 1,
      perguntas: [],
    }],
  });

  // Estados para edição
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null);
  const [perguntaEditando, setPerguntaEditando] = useState<Pergunta | null>(null);
  const [grupoEditando, setGrupoEditando] = useState<GrupoPerguntas | null>(null);
  const [dialogPerguntaOpen, setDialogPerguntaOpen] = useState(false);
  const [dialogGrupoOpen, setDialogGrupoOpen] = useState(false);
  const [dialogCondicaoOpen, setDialogCondicaoOpen] = useState(false);

  // Carregar checklists
  const fetchChecklists = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const checklistsParsed = (data || []).map(c => {
        let grupos: GrupoPerguntas[] = [];
        
        // Priorizar a estrutura de grupos se existir
        if (c.grupos && (Array.isArray(c.grupos) ? c.grupos.length > 0 : Object.keys(c.grupos).length > 0)) {
          grupos = typeof c.grupos === 'string' ? JSON.parse(c.grupos) : c.grupos;
          
          // Garantir que cada pergunta tenha o grupo_id correto
          grupos = grupos.map(g => ({
            ...g,
            perguntas: (g.perguntas || []).map((p: Pergunta) => ({
              ...p,
              grupo_id: p.grupo_id || g.id,
            })),
          }));
        } else if (c.perguntas && Array.isArray(c.perguntas) && c.perguntas.length > 0) {
          // Converter estrutura antiga para nova
          const grupoId = `grupo-default-${c.id}`;
          grupos = [{
            id: grupoId,
            nome: "Perguntas Gerais",
            ordem: 1,
            perguntas: (c.perguntas as unknown as Pergunta[]).map((p, index) => ({
              ...p,
              grupo_id: grupoId,
              ordem: p.ordem || index + 1,
            })),
          }];
        }

        return {
          ...c,
          grupos,
          versao: c.versao || "1.0",
        } as ChecklistCompleto;
      });

      setChecklists(checklistsParsed);
    } catch (error: any) {
      console.error("Erro ao carregar checklists:", error);
      toast.error("Erro ao carregar checklists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklists();
  }, []);

  // Funções de manipulação
  const handleEdit = (checklist: ChecklistCompleto) => {
    setSelectedChecklist(checklist);
    
    // Garantir que os grupos tenham estrutura correta
    let grupos = checklist.grupos || [];
    
    if (grupos.length === 0) {
      grupos = [{
        id: crypto.randomUUID(),
        nome: "Perguntas Gerais",
        ordem: 1,
        perguntas: [],
      }];
    } else {
      // Garantir que cada grupo e pergunta tenha IDs válidos
      grupos = grupos.map((g, gIndex) => {
        const grupoId = g.id || crypto.randomUUID();
        return {
          ...g,
          id: grupoId,
          ordem: g.ordem || gIndex + 1,
          perguntas: (g.perguntas || []).map((p, pIndex) => ({
            ...p,
            id: p.id || crypto.randomUUID(),
            grupo_id: grupoId,
            ordem: p.ordem || pIndex + 1,
          })),
        };
      });
    }
    
    setFormData({
      ...checklist,
      grupos,
    });
    setActiveTab("info");
    setFormOpen(true);
  };

  const handlePreview = (checklist: ChecklistCompleto) => {
    setSelectedChecklist(checklist);
    setPreviewOpen(true);
  };

  const handleDuplicate = async (checklist: ChecklistCompleto) => {
    try {
      const novoChecklist = {
        nome: `${checklist.nome} (Cópia)`,
        descricao: checklist.descricao,
        tipo: checklist.tipo,
        versao: "1.0",
        ativo: false,
        grupos: checklist.grupos,
        permite_salvar_rascunho: checklist.permite_salvar_rascunho,
        exige_localizacao: checklist.exige_localizacao,
        exige_foto_inicial: checklist.exige_foto_inicial,
        exige_foto_final: checklist.exige_foto_final,
        exige_assinatura: checklist.exige_assinatura,
        usa_pontuacao: checklist.usa_pontuacao,
        pontuacao_minima_aprovacao: checklist.pontuacao_minima_aprovacao,
      };

      const { error } = await supabase.from("checklists").insert(novoChecklist);
      if (error) throw error;

      toast.success("Checklist duplicado com sucesso!");
      fetchChecklists();
    } catch (error: any) {
      console.error("Erro ao duplicar:", error);
      toast.error("Erro ao duplicar checklist");
    }
  };

  const handleDelete = async () => {
    if (!checklistToDelete) return;

    try {
      const { error } = await supabase
        .from("checklists")
        .delete()
        .eq("id", checklistToDelete.id);

      if (error) throw error;

      toast.success("Checklist excluído!");
      fetchChecklists();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir checklist");
    } finally {
      setDeleteDialogOpen(false);
      setChecklistToDelete(null);
    }
  };

  const handleSave = async () => {
    if (!formData.nome?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const totalPerguntas = formData.grupos?.reduce((acc, g) => acc + g.perguntas.length, 0) || 0;
    if (totalPerguntas === 0) {
      toast.error("Adicione pelo menos uma pergunta");
      return;
    }

    setSaving(true);
    try {
      // Preparar payload - converter grupos para o formato correto
      // A tabela pode ter coluna "perguntas" (antiga) ou "grupos" (nova)
      const payload: Record<string, unknown> = {
        nome: formData.nome?.trim(),
        descricao: formData.descricao?.trim() || null,
        tipo: formData.tipo,
        ativo: formData.ativo,
      };

      // Verificar se a tabela suporta a nova estrutura (grupos) ou antiga (perguntas)
      // Por segurança, salvamos em ambos os formatos
      if (formData.grupos && formData.grupos.length > 0) {
        // Salvar no formato novo (grupos)
        payload.grupos = formData.grupos;
        
        // Também salvar no formato antigo (perguntas) para compatibilidade
        // Flatten todas as perguntas de todos os grupos
        const todasPerguntas = formData.grupos.flatMap(g => g.perguntas);
        payload.perguntas = todasPerguntas;
      }

      // Campos opcionais que podem não existir na tabela
      if (formData.versao) payload.versao = formData.versao;
      if (formData.permite_salvar_rascunho !== undefined) payload.permite_salvar_rascunho = formData.permite_salvar_rascunho;
      if (formData.exige_localizacao !== undefined) payload.exige_localizacao = formData.exige_localizacao;
      if (formData.exige_foto_inicial !== undefined) payload.exige_foto_inicial = formData.exige_foto_inicial;
      if (formData.exige_foto_final !== undefined) payload.exige_foto_final = formData.exige_foto_final;
      if (formData.exige_assinatura !== undefined) payload.exige_assinatura = formData.exige_assinatura;
      if (formData.usa_pontuacao !== undefined) payload.usa_pontuacao = formData.usa_pontuacao;
      if (formData.pontuacao_minima_aprovacao !== undefined) payload.pontuacao_minima_aprovacao = formData.pontuacao_minima_aprovacao;

      console.log("[DEBUG] Salvando checklist:", {
        isUpdate: !!selectedChecklist,
        id: selectedChecklist?.id,
        payload,
        grupos: formData.grupos,
      });

      if (selectedChecklist) {
        const { data, error } = await supabase
          .from("checklists")
          .update(payload)
          .eq("id", selectedChecklist.id)
          .select();

        console.log("[DEBUG] Resultado update:", { data, error });

        if (error) throw error;
        toast.success("Checklist atualizado!");
      } else {
        const { data, error } = await supabase
          .from("checklists")
          .insert(payload)
          .select();

        console.log("[DEBUG] Resultado insert:", { data, error });

        if (error) throw error;
        toast.success("Checklist criado!");
      }

      setFormOpen(false);
      resetForm();
      fetchChecklists();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar checklist: ${error.message || "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedChecklist(null);
    setFormData({
      nome: "",
      descricao: "",
      tipo: "apr",
      versao: "1.0",
      ativo: true,
      permite_salvar_rascunho: true,
      grupos: [{
        id: crypto.randomUUID(),
        nome: "Perguntas Gerais",
        ordem: 1,
        perguntas: [],
      }],
    });
    setActiveTab("info");
    setGrupoExpandido(null);
  };

  // Funções para grupos
  const adicionarGrupo = () => {
    const novoGrupo: GrupoPerguntas = {
      id: crypto.randomUUID(),
      nome: `Seção ${(formData.grupos?.length || 0) + 1}`,
      ordem: (formData.grupos?.length || 0) + 1,
      perguntas: [],
    };

    setFormData(prev => ({
      ...prev,
      grupos: [...(prev.grupos || []), novoGrupo],
    }));

    setGrupoExpandido(novoGrupo.id);
  };

  const removerGrupo = (grupoId: string) => {
    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.filter(g => g.id !== grupoId).map((g, i) => ({ ...g, ordem: i + 1 })),
    }));
  };

  const atualizarGrupo = (grupoId: string, dados: Partial<GrupoPerguntas>) => {
    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.map(g => g.id === grupoId ? { ...g, ...dados } : g),
    }));
  };

  // Funções para perguntas
  const adicionarPergunta = (grupoId: string, tipo: TipoPergunta) => {
    const grupo = formData.grupos?.find(g => g.id === grupoId);
    if (!grupo) return;

    const novaPergunta: Pergunta = {
      id: crypto.randomUUID(),
      texto: "",
      tipo,
      obrigatoria: true,
      ordem: grupo.perguntas.length + 1,
      grupo_id: grupoId,
    };

    // Configurações padrão por tipo
    if (tipo === "escala") {
      novaPergunta.escala_min = 1;
      novaPergunta.escala_max = 5;
    } else if (tipo === "escala_10") {
      novaPergunta.escala_min = 1;
      novaPergunta.escala_max = 10;
    } else if (tipo === "foto_multipla") {
      novaPergunta.max_fotos = 5;
    } else if (["selecao_unica", "multipla_escolha", "dropdown"].includes(tipo)) {
      novaPergunta.opcoes = [
        { id: crypto.randomUUID(), texto: "Opção 1" },
        { id: crypto.randomUUID(), texto: "Opção 2" },
      ];
    }

    setPerguntaEditando(novaPergunta);
    setDialogPerguntaOpen(true);
  };

  const salvarPergunta = (pergunta: Pergunta) => {
    // Encontrar o grupo_id da pergunta
    let grupoId = pergunta.grupo_id;
    
    // Se não tiver grupo_id, procurar em qual grupo a pergunta está
    if (!grupoId) {
      const grupoEncontrado = formData.grupos?.find(g => 
        g.perguntas.some(p => p.id === pergunta.id)
      );
      grupoId = grupoEncontrado?.id;
    }
    
    // Se ainda não encontrou, usar o primeiro grupo
    if (!grupoId && formData.grupos && formData.grupos.length > 0) {
      grupoId = formData.grupos[0].id;
    }
    
    if (!grupoId) {
      console.error("Não foi possível encontrar o grupo para salvar a pergunta");
      return;
    }

    // Atualizar o grupo_id na pergunta
    const perguntaAtualizada = { ...pergunta, grupo_id: grupoId };

    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.map(g => {
        if (g.id !== grupoId) return g;

        const perguntaExistente = g.perguntas.find(p => p.id === perguntaAtualizada.id);
        if (perguntaExistente) {
          return {
            ...g,
            perguntas: g.perguntas.map(p => p.id === perguntaAtualizada.id ? perguntaAtualizada : p),
          };
        } else {
          return {
            ...g,
            perguntas: [...g.perguntas, perguntaAtualizada],
          };
        }
      }),
    }));

    setDialogPerguntaOpen(false);
    setPerguntaEditando(null);
    toast.success("Pergunta salva!");
  };

  const removerPergunta = (grupoId: string, perguntaId: string) => {
    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.map(g => {
        if (g.id !== grupoId) return g;
        return {
          ...g,
          perguntas: g.perguntas
            .filter(p => p.id !== perguntaId)
            .map((p, i) => ({ ...p, ordem: i + 1 })),
        };
      }),
    }));
  };

  const editarPergunta = (pergunta: Pergunta) => {
    setPerguntaEditando({ ...pergunta });
    setDialogPerguntaOpen(true);
  };

  const duplicarPergunta = (grupoId: string, pergunta: Pergunta) => {
    const novaPergunta: Pergunta = {
      ...pergunta,
      id: crypto.randomUUID(),
      texto: `${pergunta.texto} (Cópia)`,
    };

    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos?.map(g => {
        if (g.id !== grupoId) return g;
        const perguntas = [...g.perguntas, novaPergunta].map((p, i) => ({ ...p, ordem: i + 1 }));
        return { ...g, perguntas };
      }),
    }));
  };

  // Drag and Drop
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "grupo") {
      const grupos = Array.from(formData.grupos || []);
      const [removed] = grupos.splice(source.index, 1);
      grupos.splice(destination.index, 0, removed);
      
      setFormData(prev => ({
        ...prev,
        grupos: grupos.map((g, i) => ({ ...g, ordem: i + 1 })),
      }));
    } else if (type === "pergunta") {
      const sourceGrupoId = source.droppableId;
      const destGrupoId = destination.droppableId;

      setFormData(prev => {
        const grupos = [...(prev.grupos || [])];
        const sourceGrupo = grupos.find(g => g.id === sourceGrupoId);
        const destGrupo = grupos.find(g => g.id === destGrupoId);

        if (!sourceGrupo || !destGrupo) return prev;

        const [movedPergunta] = sourceGrupo.perguntas.splice(source.index, 1);
        movedPergunta.grupo_id = destGrupoId;
        destGrupo.perguntas.splice(destination.index, 0, movedPergunta);

        // Reordenar
        sourceGrupo.perguntas = sourceGrupo.perguntas.map((p, i) => ({ ...p, ordem: i + 1 }));
        destGrupo.perguntas = destGrupo.perguntas.map((p, i) => ({ ...p, ordem: i + 1 }));

        return { ...prev, grupos };
      });
    }
  };

  // Filtro
  const filteredChecklists = checklists.filter((c) => {
    const matchesSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = tipoFilter === "all" || c.tipo === tipoFilter;
    return matchesSearch && matchesTipo;
  });

  // Contagem de perguntas
  const getTotalPerguntas = (checklist: ChecklistCompleto) => {
    return checklist.grupos?.reduce((acc, g) => acc + g.perguntas.length, 0) || 0;
  };

  return (
    <MainLayout
      title="Checklists Avançado"
      subtitle="Sistema completo de criação de formulários e checklists"
      breadcrumbs={[{ label: "Cadastros" }, { label: "Checklists" }]}
    >
      {/* Barra de Ações */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar checklist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {TIPOS_CHECKLIST.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tipo.cor }} />
                      {tipo.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="gap-2"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo Checklist
            </Button>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          {filteredChecklists.length} checklist(s) encontrado(s)
        </div>
      </div>

      {/* Lista de Checklists */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          Carregando...
        </div>
      ) : filteredChecklists.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum checklist encontrado.</p>
          <p className="text-sm">Clique em "Novo Checklist" para criar.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredChecklists.map((checklist) => {
            const tipoConfig = TIPOS_CHECKLIST.find(t => t.value === checklist.tipo);
            const totalPerguntas = getTotalPerguntas(checklist);
            const totalGrupos = checklist.grupos?.length || 0;

            return (
              <Card key={checklist.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: tipoConfig?.cor || "#6b7280" }} 
                        />
                        <Badge variant="outline" className="text-xs">
                          v{checklist.versao}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{checklist.nome}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {checklist.descricao || "Sem descrição"}
                      </CardDescription>
                    </div>
                    <Badge variant={checklist.ativo ? "default" : "secondary"}>
                      {checklist.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tipo:</span>
                      <Badge variant="outline">{tipoConfig?.label || checklist.tipo}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Seções:</span>
                      <span className="font-medium">{totalGrupos}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Perguntas:</span>
                      <span className="font-medium">{totalPerguntas}</span>
                    </div>

                    {/* Indicadores de recursos */}
                    <div className="flex flex-wrap gap-1 pt-2">
                      {checklist.exige_localizacao && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />GPS
                        </Badge>
                      )}
                      {checklist.exige_assinatura && (
                        <Badge variant="outline" className="text-xs">
                          <FileSignature className="h-3 w-3 mr-1" />Assinatura
                        </Badge>
                      )}
                      {checklist.usa_pontuacao && (
                        <Badge variant="outline" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />Pontuação
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handlePreview(checklist)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(checklist)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(checklist)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setChecklistToDelete(checklist);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de Formulário Principal */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) resetForm(); setFormOpen(open); }}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {selectedChecklist ? "Editar Checklist" : "Novo Checklist"}
            </DialogTitle>
            <DialogDescription>
              Configure o checklist com grupos, perguntas e condições
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Informações
                </TabsTrigger>
                <TabsTrigger value="perguntas" className="gap-2">
                  <ListChecks className="h-4 w-4" />
                  Perguntas
                </TabsTrigger>
                <TabsTrigger value="config" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Configurações
                </TabsTrigger>
                <TabsTrigger value="logica" className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  Lógica
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 h-[calc(95vh-220px)]">
              {/* Tab: Informações Básicas */}
              <TabsContent value="info" className="p-6 pt-4 m-0">
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome do Checklist *</Label>
                      <Input
                        id="nome"
                        value={formData.nome || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Ex: APR - Trabalho em Altura"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tipo">Tipo *</Label>
                        <Select
                          value={formData.tipo}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_CHECKLIST.map((tipo) => (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tipo.cor }} />
                                  {tipo.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="versao">Versão</Label>
                        <Input
                          id="versao"
                          value={formData.versao || "1.0"}
                          onChange={(e) => setFormData(prev => ({ ...prev, versao: e.target.value }))}
                          placeholder="1.0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descreva o objetivo e quando este checklist deve ser utilizado..."
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="ativo"
                        checked={formData.ativo}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                      />
                      <Label htmlFor="ativo">Checklist ativo</Label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Perguntas e Grupos */}
              <TabsContent value="perguntas" className="p-6 pt-4 m-0">
                <div className="space-y-4">
                  {/* Botão adicionar grupo */}
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={adicionarGrupo} className="gap-2">
                      <FolderPlus className="h-4 w-4" />
                      Nova Seção
                    </Button>
                  </div>

                  {/* Lista de grupos */}
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="grupos" type="grupo">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                          {formData.grupos?.map((grupo, grupoIndex) => (
                            <Draggable key={grupo.id} draggableId={grupo.id} index={grupoIndex}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    "transition-shadow",
                                    snapshot.isDragging && "shadow-lg"
                                  )}
                                >
                                  <Collapsible
                                    open={grupoExpandido === grupo.id}
                                    onOpenChange={(open) => setGrupoExpandido(open ? grupo.id : null)}
                                  >
                                    <CardHeader className="pb-2">
                                      <div className="flex items-center gap-2">
                                        <div {...provided.dragHandleProps} className="cursor-grab">
                                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <CollapsibleTrigger asChild>
                                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                                            {grupoExpandido === grupo.id ? (
                                              <ChevronDown className="h-4 w-4" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </CollapsibleTrigger>
                                        <div className="flex-1">
                                          <Input
                                            value={grupo.nome}
                                            onChange={(e) => atualizarGrupo(grupo.id, { nome: e.target.value })}
                                            className="font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                                            placeholder="Nome da seção"
                                          />
                                        </div>
                                        <Badge variant="secondary">
                                          {grupo.perguntas.length} pergunta(s)
                                        </Badge>
                                        {formData.grupos && formData.grupos.length > 1 && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => removerGrupo(grupo.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </CardHeader>

                                    <CollapsibleContent>
                                      <CardContent className="pt-0">
                                        {/* Descrição do grupo */}
                                        <Input
                                          value={grupo.descricao || ""}
                                          onChange={(e) => atualizarGrupo(grupo.id, { descricao: e.target.value })}
                                          placeholder="Descrição da seção (opcional)"
                                          className="mb-4 text-sm"
                                        />

                                        {/* Lista de perguntas */}
                                        <Droppable droppableId={grupo.id} type="pergunta">
                                          {(provided) => (
                                            <div
                                              {...provided.droppableProps}
                                              ref={provided.innerRef}
                                              className="space-y-2 min-h-[50px]"
                                            >
                                              {grupo.perguntas.map((pergunta, perguntaIndex) => {
                                                const tipoConfig = TIPOS_PERGUNTA[pergunta.tipo];
                                                const TipoIcon = tipoConfig?.icon || Type;

                                                return (
                                                  <Draggable
                                                    key={pergunta.id}
                                                    draggableId={pergunta.id}
                                                    index={perguntaIndex}
                                                  >
                                                    {(provided, snapshot) => (
                                                      <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={cn(
                                                          "flex items-center gap-2 p-3 rounded-lg border bg-background",
                                                          snapshot.isDragging && "shadow-lg"
                                                        )}
                                                      >
                                                        <div {...provided.dragHandleProps} className="cursor-grab">
                                                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                        <Badge variant="outline" className="shrink-0">
                                                          {pergunta.ordem}
                                                        </Badge>
                                                        <TipoIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                          <p className="text-sm font-medium truncate">
                                                            {pergunta.texto || "(Sem texto)"}
                                                          </p>
                                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span>{tipoConfig?.label}</span>
                                                            {pergunta.obrigatoria && (
                                                              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                                                Obrigatória
                                                              </Badge>
                                                            )}
                                                            {pergunta.foto_obrigatoria && (
                                                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                                <Camera className="h-2 w-2 mr-0.5" />Foto
                                                              </Badge>
                                                            )}
                                                            {pergunta.condicoes && pergunta.condicoes.length > 0 && (
                                                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                                <GitBranch className="h-2 w-2 mr-0.5" />Condicional
                                                              </Badge>
                                                            )}
                                                          </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => editarPergunta(pergunta)}
                                                          >
                                                            <Edit className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => duplicarPergunta(grupo.id, pergunta)}
                                                          >
                                                            <Copy className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                                            onClick={() => removerPergunta(grupo.id, pergunta.id)}
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </Draggable>
                                                );
                                              })}
                                              {provided.placeholder}
                                            </div>
                                          )}
                                        </Droppable>

                                        {/* Botões para adicionar pergunta */}
                                        <div className="mt-4 pt-4 border-t">
                                          <p className="text-sm text-muted-foreground mb-2">Adicionar pergunta:</p>
                                          <div className="flex flex-wrap gap-2">
                                            {CATEGORIAS_PERGUNTA.map((cat) => {
                                              const perguntas = Object.entries(TIPOS_PERGUNTA)
                                                .filter(([_, v]) => v.category === cat.id);
                                              
                                              return (
                                                <Select
                                                  key={cat.id}
                                                  onValueChange={(tipo) => adicionarPergunta(grupo.id, tipo as TipoPergunta)}
                                                >
                                                  <SelectTrigger className="w-auto gap-2">
                                                    <cat.icon className="h-4 w-4" />
                                                    {cat.label}
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {perguntas.map(([key, config]) => {
                                                      const Icon = config.icon;
                                                      return (
                                                        <SelectItem key={key} value={key}>
                                                          <div className="flex items-center gap-2">
                                                            <Icon className="h-4 w-4" />
                                                            <span>{config.label}</span>
                                                          </div>
                                                        </SelectItem>
                                                      );
                                                    })}
                                                  </SelectContent>
                                                </Select>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              </TabsContent>

              {/* Tab: Configurações */}
              <TabsContent value="config" className="p-6 pt-4 m-0">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Requisitos de Preenchimento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Permitir salvar rascunho</Label>
                          <p className="text-xs text-muted-foreground">
                            Usuário pode salvar e continuar depois
                          </p>
                        </div>
                        <Switch
                          checked={formData.permite_salvar_rascunho}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, permite_salvar_rascunho: checked }))
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Exigir localização GPS</Label>
                          <p className="text-xs text-muted-foreground">
                            Captura coordenadas ao iniciar
                          </p>
                        </div>
                        <Switch
                          checked={formData.exige_localizacao}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, exige_localizacao: checked }))
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Exigir foto inicial</Label>
                          <p className="text-xs text-muted-foreground">
                            Foto obrigatória antes de começar
                          </p>
                        </div>
                        <Switch
                          checked={formData.exige_foto_inicial}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, exige_foto_inicial: checked }))
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Exigir foto final</Label>
                          <p className="text-xs text-muted-foreground">
                            Foto obrigatória ao finalizar
                          </p>
                        </div>
                        <Switch
                          checked={formData.exige_foto_final}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, exige_foto_final: checked }))
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Exigir assinatura</Label>
                          <p className="text-xs text-muted-foreground">
                            Assinatura digital ao finalizar
                          </p>
                        </div>
                        <Switch
                          checked={formData.exige_assinatura}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, exige_assinatura: checked }))
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sistema de Pontuação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Usar sistema de pontuação</Label>
                          <p className="text-xs text-muted-foreground">
                            Calcular score baseado nas respostas
                          </p>
                        </div>
                        <Switch
                          checked={formData.usa_pontuacao}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, usa_pontuacao: checked }))
                          }
                        />
                      </div>
                      {formData.usa_pontuacao && (
                        <div className="space-y-2">
                          <Label>Pontuação mínima para aprovação (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={formData.pontuacao_minima_aprovacao || 70}
                            onChange={(e) => 
                              setFormData(prev => ({ 
                                ...prev, 
                                pontuacao_minima_aprovacao: Number(e.target.value) 
                              }))
                            }
                            className="w-32"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tempo Limite</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label>Tempo limite para preenchimento (minutos)</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Deixe em branco para sem limite
                        </p>
                        <Input
                          type="number"
                          min={1}
                          value={formData.tempo_limite_minutos || ""}
                          onChange={(e) => 
                            setFormData(prev => ({ 
                              ...prev, 
                              tempo_limite_minutos: e.target.value ? Number(e.target.value) : undefined 
                            }))
                          }
                          placeholder="Sem limite"
                          className="w-32"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab: Lógica Condicional */}
              <TabsContent value="logica" className="p-6 pt-4 m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      Regras Condicionais
                    </CardTitle>
                    <CardDescription>
                      Configure regras para mostrar/ocultar perguntas baseado em respostas anteriores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Configure as condições diretamente em cada pergunta</p>
                      <p className="text-sm mt-1">
                        Clique em editar uma pergunta e vá até a aba "Condições"
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="p-6 pt-4 border-t">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                {formData.grupos?.reduce((acc, g) => acc + g.perguntas.length, 0) || 0} pergunta(s) em {formData.grupos?.length || 0} seção(ões)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { resetForm(); setFormOpen(false); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {selectedChecklist ? "Salvar Alterações" : "Criar Checklist"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Pergunta */}
      <PerguntaDialog
        open={dialogPerguntaOpen}
        onOpenChange={setDialogPerguntaOpen}
        pergunta={perguntaEditando}
        onSave={salvarPergunta}
        todasPerguntas={formData.grupos?.flatMap(g => g.perguntas) || []}
      />

      {/* Dialog de Preview */}
      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        checklist={selectedChecklist}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Checklist</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o checklist "{checklistToDelete?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

// ============================================
// COMPONENTE: Dialog de Edição de Pergunta
// ============================================

interface PerguntaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pergunta: Pergunta | null;
  onSave: (pergunta: Pergunta) => void;
  todasPerguntas: Pergunta[];
}

function PerguntaDialog({ open, onOpenChange, pergunta, onSave, todasPerguntas }: PerguntaDialogProps) {
  const [formPergunta, setFormPergunta] = useState<Pergunta | null>(null);
  const [activeTab, setActiveTab] = useState("geral");

  useEffect(() => {
    if (pergunta) {
      setFormPergunta({ ...pergunta });
      setActiveTab("geral");
    }
  }, [pergunta]);

  if (!formPergunta) return null;

  const tipoConfig = TIPOS_PERGUNTA[formPergunta.tipo];
  const TipoIcon = tipoConfig?.icon || Type;
  const isSelecao = ["selecao_unica", "multipla_escolha", "dropdown"].includes(formPergunta.tipo);
  const isNumerico = ["numero", "decimal", "moeda", "medida", "temperatura", "porcentagem"].includes(formPergunta.tipo);
  const isEscala = ["escala", "escala_10"].includes(formPergunta.tipo);

  const adicionarOpcao = () => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        opcoes: [...(prev.opcoes || []), { id: crypto.randomUUID(), texto: "" }],
      };
    });
  };

  const atualizarOpcao = (id: string, dados: Partial<OpcaoSelecao>) => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        opcoes: prev.opcoes?.map(o => o.id === id ? { ...o, ...dados } : o),
      };
    });
  };

  const removerOpcao = (id: string) => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        opcoes: prev.opcoes?.filter(o => o.id !== id),
      };
    });
  };

  const adicionarCondicao = () => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      const novaCondicao: Condicao = {
        id: crypto.randomUUID(),
        pergunta_origem_id: "",
        operador: "igual",
        acao: "mostrar",
      };
      return {
        ...prev,
        condicoes: [...(prev.condicoes || []), novaCondicao],
      };
    });
  };

  const atualizarCondicao = (id: string, dados: Partial<Condicao>) => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        condicoes: prev.condicoes?.map(c => c.id === id ? { ...c, ...dados } : c),
      };
    });
  };

  const removerCondicao = (id: string) => {
    setFormPergunta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        condicoes: prev.condicoes?.filter(c => c.id !== id),
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TipoIcon className="h-5 w-5" />
            Editar Pergunta - {tipoConfig?.label}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="opcoes" disabled={!isSelecao && !isEscala}>
              Opções
            </TabsTrigger>
            <TabsTrigger value="validacao">Validação</TabsTrigger>
            <TabsTrigger value="condicoes">Condições</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            {/* Tab Geral */}
            <TabsContent value="geral" className="space-y-4 m-0">
              {/* Tipo da Pergunta */}
              <div className="space-y-2">
                <Label>Tipo da Pergunta *</Label>
                <Select
                  value={formPergunta.tipo}
                  onValueChange={(value: TipoPergunta) => {
                    setFormPergunta(prev => {
                      if (!prev) return prev;
                      const novoTipo = value;
                      const updates: Partial<Pergunta> = { tipo: novoTipo };
                      
                      // Configurações padrão por tipo
                      if (novoTipo === "escala") {
                        updates.escala_min = 1;
                        updates.escala_max = 5;
                      } else if (novoTipo === "escala_10") {
                        updates.escala_min = 1;
                        updates.escala_max = 10;
                      } else if (novoTipo === "foto_multipla") {
                        updates.max_fotos = 5;
                      } else if (["selecao_unica", "multipla_escolha", "dropdown"].includes(novoTipo)) {
                        if (!prev.opcoes || prev.opcoes.length === 0) {
                          updates.opcoes = [
                            { id: crypto.randomUUID(), texto: "Opção 1" },
                            { id: crypto.randomUUID(), texto: "Opção 2" },
                          ];
                        }
                      }
                      
                      return { ...prev, ...updates };
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <TipoIcon className="h-4 w-4" />
                        <span>{tipoConfig?.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {CATEGORIAS_PERGUNTA.map((cat) => {
                      const perguntas = Object.entries(TIPOS_PERGUNTA)
                        .filter(([_, v]) => v.category === cat.id);
                      
                      return (
                        <div key={cat.id}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                            {cat.label}
                          </div>
                          {perguntas.map(([key, config]) => {
                            const Icon = config.icon;
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{config.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </div>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Texto da Pergunta *</Label>
                <Input
                  value={formPergunta.texto}
                  onChange={(e) => setFormPergunta(prev => prev ? { ...prev, texto: e.target.value } : prev)}
                  placeholder="Digite a pergunta..."
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição/Ajuda</Label>
                <Textarea
                  value={formPergunta.descricao || ""}
                  onChange={(e) => setFormPergunta(prev => prev ? { ...prev, descricao: e.target.value } : prev)}
                  placeholder="Texto de ajuda para o usuário..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Placeholder</Label>
                  <Input
                    value={formPergunta.placeholder || ""}
                    onChange={(e) => setFormPergunta(prev => prev ? { ...prev, placeholder: e.target.value } : prev)}
                    placeholder="Texto de exemplo..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Referência/Norma</Label>
                  <Input
                    value={formPergunta.referencia || ""}
                    onChange={(e) => setFormPergunta(prev => prev ? { ...prev, referencia: e.target.value } : prev)}
                    placeholder="Ex: NR-35, ISO 9001..."
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Pergunta obrigatória</Label>
                    <p className="text-xs text-muted-foreground">
                      Deve ser respondida para enviar
                    </p>
                  </div>
                  <Switch
                    checked={formPergunta.obrigatoria}
                    onCheckedChange={(checked) => 
                      setFormPergunta(prev => prev ? { ...prev, obrigatoria: checked } : prev)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Exigir foto</Label>
                    <p className="text-xs text-muted-foreground">
                      Foto obrigatória junto com a resposta
                    </p>
                  </div>
                  <Switch
                    checked={formPergunta.foto_obrigatoria}
                    onCheckedChange={(checked) => 
                      setFormPergunta(prev => prev ? { ...prev, foto_obrigatoria: checked } : prev)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Exigir observação</Label>
                    <p className="text-xs text-muted-foreground">
                      Campo de texto adicional obrigatório
                    </p>
                  </div>
                  <Switch
                    checked={formPergunta.observacao_obrigatoria}
                    onCheckedChange={(checked) => 
                      setFormPergunta(prev => prev ? { ...prev, observacao_obrigatoria: checked } : prev)
                    }
                  />
                </div>
              </div>

              {isNumerico && (
                <>
                  <Separator />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Valor mínimo</Label>
                      <Input
                        type="number"
                        value={formPergunta.valor_min ?? ""}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { 
                            ...prev, 
                            valor_min: e.target.value ? Number(e.target.value) : undefined 
                          } : prev)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor máximo</Label>
                      <Input
                        type="number"
                        value={formPergunta.valor_max ?? ""}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { 
                            ...prev, 
                            valor_max: e.target.value ? Number(e.target.value) : undefined 
                          } : prev)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade</Label>
                      <Input
                        value={formPergunta.unidade || ""}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { ...prev, unidade: e.target.value } : prev)
                        }
                        placeholder="m, kg, °C..."
                      />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Tab Opções */}
            <TabsContent value="opcoes" className="space-y-4 m-0">
              {isSelecao && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Opções de Resposta</Label>
                    <Button size="sm" variant="outline" onClick={adicionarOpcao}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {formPergunta.opcoes?.map((opcao, index) => (
                      <Card key={opcao.id} className="p-3">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="shrink-0 mt-2">
                            {index + 1}
                          </Badge>
                          <div className="flex-1 space-y-2">
                            <Input
                              value={opcao.texto}
                              onChange={(e) => atualizarOpcao(opcao.id, { texto: e.target.value })}
                              placeholder="Texto da opção"
                            />
                            <div className="flex gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`foto-${opcao.id}`}
                                  checked={opcao.exige_foto}
                                  onCheckedChange={(checked) => 
                                    atualizarOpcao(opcao.id, { exige_foto: checked as boolean })
                                  }
                                />
                                <Label htmlFor={`foto-${opcao.id}`} className="text-xs">
                                  Exige foto
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`obs-${opcao.id}`}
                                  checked={opcao.exige_observacao}
                                  onCheckedChange={(checked) => 
                                    atualizarOpcao(opcao.id, { exige_observacao: checked as boolean })
                                  }
                                />
                                <Label htmlFor={`obs-${opcao.id}`} className="text-xs">
                                  Exige observação
                                </Label>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removerOpcao(opcao.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {isEscala && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor mínimo da escala</Label>
                      <Input
                        type="number"
                        value={formPergunta.escala_min ?? 1}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { 
                            ...prev, 
                            escala_min: Number(e.target.value) 
                          } : prev)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor máximo da escala</Label>
                      <Input
                        type="number"
                        value={formPergunta.escala_max ?? 5}
                        onChange={(e) => 
                          setFormPergunta(prev => prev ? { 
                            ...prev, 
                            escala_max: Number(e.target.value) 
                          } : prev)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab Validação */}
            <TabsContent value="validacao" className="space-y-4 m-0">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">
                  Configure validações adicionais para esta pergunta
                </p>
              </Card>
            </TabsContent>

            {/* Tab Condições */}
            <TabsContent value="condicoes" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Condições para esta pergunta</Label>
                  <p className="text-xs text-muted-foreground">
                    Defina quando esta pergunta deve aparecer ou ações baseadas em respostas
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={adicionarCondicao}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Condição
                </Button>
              </div>

              {formPergunta.condicoes?.map((condicao) => (
                <Card key={condicao.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        <GitBranch className="h-3 w-3 mr-1" />
                        Condição
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removerCondicao(condicao.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={condicao.pergunta_origem_id}
                        onValueChange={(value) => atualizarCondicao(condicao.id, { pergunta_origem_id: value })}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Pergunta..." />
                        </SelectTrigger>
                        <SelectContent>
                          {todasPerguntas
                            .filter(p => p.id !== formPergunta.id)
                            .map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.texto.slice(0, 30)}...
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>

                      <Select
                        value={condicao.operador}
                        onValueChange={(value) => 
                          atualizarCondicao(condicao.id, { operador: value as keyof typeof OPERADORES_CONDICAO })
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(OPERADORES_CONDICAO).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        value={condicao.valor as string || ""}
                        onChange={(e) => atualizarCondicao(condicao.id, { valor: e.target.value })}
                        placeholder="Valor..."
                        className="text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Então:</span>
                      <Select
                        value={condicao.acao}
                        onValueChange={(value) => 
                          atualizarCondicao(condicao.id, { acao: value as keyof typeof ACOES_CONDICAO })
                        }
                      >
                        <SelectTrigger className="text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ACOES_CONDICAO).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}

              {(!formPergunta.condicoes || formPergunta.condicoes.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma condição configurada</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => formPergunta && onSave(formPergunta)}>
            Salvar Pergunta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// COMPONENTE: Dialog de Preview
// ============================================

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklist: ChecklistCompleto | null;
}

function PreviewDialog({ open, onOpenChange, checklist }: PreviewDialogProps) {
  if (!checklist) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview: {checklist.nome}
          </DialogTitle>
          <DialogDescription>
            {checklist.descricao || "Visualização do checklist como aparecerá no app"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {checklist.grupos?.map((grupo) => (
              <div key={grupo.id} className="space-y-3">
                <div className="sticky top-0 bg-background py-2">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    {grupo.nome}
                  </h3>
                  {grupo.descricao && (
                    <p className="text-sm text-muted-foreground">{grupo.descricao}</p>
                  )}
                </div>

                {grupo.perguntas.map((pergunta) => {
                  const tipoConfig = TIPOS_PERGUNTA[pergunta.tipo];
                  const TipoIcon = tipoConfig?.icon || Type;

                  return (
                    <Card key={pergunta.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="shrink-0 mt-0.5">
                            {pergunta.ordem}
                          </Badge>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <TipoIcon className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium">
                                {pergunta.texto}
                                {pergunta.obrigatoria && <span className="text-destructive ml-1">*</span>}
                              </p>
                            </div>
                            {pergunta.descricao && (
                              <p className="text-xs text-muted-foreground">{pergunta.descricao}</p>
                            )}

                            {/* Preview do campo */}
                            <div className="mt-2 opacity-60">
                              {pergunta.tipo === "texto" && (
                                <Input placeholder={pergunta.placeholder || "Resposta..."} disabled />
                              )}
                              {pergunta.tipo === "texto_longo" && (
                                <Textarea placeholder={pergunta.placeholder || "Resposta..."} rows={2} disabled />
                              )}
                              {["numero", "decimal", "moeda", "medida"].includes(pergunta.tipo) && (
                                <div className="flex items-center gap-2">
                                  <Input type="number" placeholder="0" disabled className="w-32" />
                                  {pergunta.unidade && <span className="text-sm">{pergunta.unidade}</span>}
                                </div>
                              )}
                              {pergunta.tipo === "sim_nao" && (
                                <div className="flex gap-4">
                                  <label key="sim" className="flex items-center gap-2">
                                    <input type="radio" disabled />
                                    <span>Sim</span>
                                  </label>
                                  <label key="nao" className="flex items-center gap-2">
                                    <input type="radio" disabled />
                                    <span>Não</span>
                                  </label>
                                </div>
                              )}
                              {["selecao_unica", "multipla_escolha", "dropdown"].includes(pergunta.tipo) && pergunta.opcoes && (
                                <div className="space-y-1">
                                  {pergunta.opcoes.map((opcao) => (
                                    <label key={opcao.id} className="flex items-center gap-2">
                                      <Checkbox disabled />
                                      <span className="text-sm">{opcao.texto}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              {["escala", "escala_10"].includes(pergunta.tipo) && (
                                <div className="flex gap-2">
                                  {Array.from(
                                    { length: (pergunta.escala_max || 5) - (pergunta.escala_min || 1) + 1 },
                                    (_, i) => (pergunta.escala_min || 1) + i
                                  ).map((n) => (
                                    <Button key={n} variant="outline" size="sm" disabled>
                                      {n}
                                    </Button>
                                  ))}
                                </div>
                              )}
                              {pergunta.tipo === "foto" && (
                                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                  <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Tirar foto</p>
                                </div>
                              )}
                              {pergunta.tipo === "assinatura" && (
                                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                  <FileSignature className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Área de assinatura</p>
                                </div>
                              )}
                              {pergunta.tipo === "data" && (
                                <Input type="date" disabled className="w-48" />
                              )}
                            </div>

                            {/* Indicadores */}
                            <div className="flex gap-2 mt-2">
                              {pergunta.foto_obrigatoria && (
                                <Badge variant="outline" className="text-xs">
                                  <Camera className="h-3 w-3 mr-1" />
                                  Foto obrigatória
                                </Badge>
                              )}
                              {pergunta.observacao_obrigatoria && (
                                <Badge variant="outline" className="text-xs">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Observação obrigatória
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

