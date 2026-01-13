import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  ArrowLeft,
  Zap,
  Plus,
  QrCode,
  History,
  MapPin,
  User,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Barcode,
  Truck,
  Home,
  Clock,
  Filter,
  Scan,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { DiasRetencaoBadge, calcularDiasDesde, getNivelAlerta } from "@/components/materiais/DiasRetencaoBadge";
import { SortableTableHead, useSortableTable, SortConfig } from "@/components/ui/sortable-table-head";

interface MaterialSerializado {
  id: string;
  material_id: string;
  numero_serie: string;
  lote: string | null;
  data_fabricacao: string | null;
  data_validade: string | null;
  status: string;
  localizacao_tipo: string;
  localizacao_id: string | null;
  ordem_servico_id: string | null;
  observacao: string | null;
  data_entrega_equipe: string | null;
  equipe_atual_id: string | null;
  created_at: string;
  updated_at: string;
  materiais?: {
    codigo: string;
    nome: string;
    categoria: string;
    dias_alerta_retencao: number | null;
  };
  tecnicos?: {
    codigo: string;
    nome: string;
  };
  ordens_servico?: {
    numero: string;
    endereco: string;
    cliente_nome: string;
  };
}

interface HistoricoItem {
  id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string;
  localizacao_anterior: string | null;
  localizacao_nova: string | null;
  observacao: string | null;
  created_at: string;
  created_by: string | null;
}

// Interface para histórico completo (inclui movimentações e entregas)
interface HistoricoCompleto {
  id: string;
  tipo: "criacao" | "movimentacao" | "entrega" | "status" | "aplicacao";
  descricao: string;
  detalhes?: string;
  status_anterior?: string;
  status_novo?: string;
  localizacao_anterior?: string;
  localizacao_nova?: string;
  observacao?: string;
  created_at: string;
  icone: "plus" | "truck" | "user" | "check" | "arrow" | "package";
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  em_estoque: { label: "Em Estoque", color: "bg-blue-100 text-blue-700", icon: Package },
  em_transito: { label: "Em Trânsito", color: "bg-amber-100 text-amber-700", icon: Truck },
  com_equipe: { label: "Com Equipe", color: "bg-purple-100 text-purple-700", icon: User },
  instalado: { label: "Instalado", color: "bg-green-100 text-green-700", icon: CheckCircle },
  retirado: { label: "Retirado", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  defeito: { label: "Defeito", color: "bg-red-100 text-red-700", icon: XCircle },
  descartado: { label: "Descartado", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

// Configurações de filtros rápidos por nível de alerta
const FILTROS_ALERTA = [
  { id: "todos", label: "Todos", color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  { id: "normal", label: "Normal", color: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
  { id: "atencao", label: "Atenção", color: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { id: "alerta", label: "Em Alerta", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  { id: "critico", label: "Crítico", color: "bg-red-100 text-red-700 hover:bg-red-200" },
];

export default function Rastreabilidade() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  // Sempre iniciar sem filtros (todos)
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroMaterial, setFiltroMaterial] = useState("todos");
  const [filtroAlerta, setFiltroAlerta] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MaterialSerializado | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoCompleto, setHistoricoCompleto] = useState<HistoricoCompleto[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  
  // Estados para busca por código de rastro
  const [buscaRastroDialog, setBuscaRastroDialog] = useState(false);
  const [codigoRastro, setCodigoRastro] = useState("");
  const [rastroEncontrado, setRastroEncontrado] = useState<MaterialSerializado | null>(null);
  const [buscandoRastro, setBuscandoRastro] = useState(false);
  const [erroRastro, setErroRastro] = useState("");

  // Form para novo item serializado
  const [formData, setFormData] = useState({
    material_id: "",
    numero_serie: "",
    lote: "",
    data_fabricacao: "",
    data_validade: "",
    observacao: "",
  });

  // Query para itens serializados (otimizada)
  const { data: itens, isLoading } = useQuery({
    queryKey: ["materiais-serializados", filtroStatus, filtroMaterial, searchTerm],
    queryFn: async () => {
      // Primeiro buscar apenas os dados básicos (mais rápido)
      let query = supabase
        .from("materiais_serializados")
        .select(`
          id,
          material_id,
          numero_serie,
          lote,
          data_fabricacao,
          data_validade,
          status,
          localizacao_tipo,
          localizacao_id,
          ordem_servico_id,
          observacao,
          data_entrega_equipe,
          equipe_atual_id,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false })
        .limit(500); // Limitar para performance

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      if (filtroMaterial !== "todos") {
        query = query.eq("material_id", filtroMaterial);
      }

      // Filtrar por busca no número de série ou lote (mais rápido que join)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        query = query.or(`numero_serie.ilike.%${term}%,lote.ilike.%${term}%`);
      }

      const { data: serializados, error } = await query;
      if (error) throw error;

      if (!serializados || serializados.length === 0) return [];

      // Buscar dados relacionados em paralelo (mais eficiente)
      const materialIds = [...new Set(serializados.map((s: any) => s.material_id))];
      const osIds = serializados.filter((s: any) => s.ordem_servico_id).map((s: any) => s.ordem_servico_id);
      const equipeIds = serializados.filter((s: any) => s.localizacao_tipo === "equipe" && s.localizacao_id).map((s: any) => s.localizacao_id);

      const [materiaisData, osData, equipesData] = await Promise.all([
        supabase.from("materiais").select("id, codigo, nome, categoria, dias_alerta_retencao").in("id", materialIds),
        osIds.length > 0 ? supabase.from("ordens_servico").select("id, numero, endereco, cliente_nome").in("id", osIds) : Promise.resolve({ data: [] }),
        equipeIds.length > 0 ? supabase.from("tecnicos").select("id, codigo, nome").in("id", equipeIds) : Promise.resolve({ data: [] }),
      ]);

      // Montar resultado com joins
      const materiaisMap = new Map((materiaisData.data || []).map((m: any) => [m.id, m]));
      const osMap = new Map((osData.data || []).map((os: any) => [os.id, os]));
      const equipesMap = new Map((equipesData.data || []).map((eq: any) => [eq.id, eq]));

      return serializados.map((item: any) => ({
        ...item,
        materiais: materiaisMap.get(item.material_id),
        ordens_servico: item.ordem_servico_id ? osMap.get(item.ordem_servico_id) : null,
        tecnicos: item.localizacao_tipo === "equipe" && item.localizacao_id ? equipesMap.get(item.localizacao_id) : null,
      })) as MaterialSerializado[];
    },
  });

  // Filtrar e ordenar itens
  const itensFiltradosEOrdenados = useMemo(() => {
    if (!itens) return [];

    let resultado = [...itens];

    // Filtrar por nível de alerta (apenas para itens com equipe)
    if (filtroAlerta !== "todos") {
      resultado = resultado.filter((item) => {
        if (item.status !== "com_equipe") return false;
        const dataEntrega = item.data_entrega_equipe || item.updated_at || item.created_at;
        const dias = calcularDiasDesde(dataEntrega);
        const diasAlerta = item.materiais?.dias_alerta_retencao || 7;
        const nivel = getNivelAlerta(dias, diasAlerta);
        return nivel === filtroAlerta;
      });
    }

    // Ordenar
    if (sortConfig && sortConfig.direction) {
      resultado.sort((a: any, b: any) => {
        let aValue: any;
        let bValue: any;

        // Tratamento especial para campos aninhados e calculados
        switch (sortConfig.column) {
          case "numero_serie":
            aValue = a.numero_serie;
            bValue = b.numero_serie;
            break;
          case "material":
            aValue = a.materiais?.codigo || "";
            bValue = b.materiais?.codigo || "";
            break;
          case "lote":
            aValue = a.lote || "";
            bValue = b.lote || "";
            break;
          case "status":
            aValue = a.status;
            bValue = b.status;
            break;
          case "localizacao":
            aValue = a.localizacao_tipo;
            bValue = b.localizacao_tipo;
            break;
          case "dias":
            const aDataEntrega = a.data_entrega_equipe || a.updated_at || a.created_at;
            const bDataEntrega = b.data_entrega_equipe || b.updated_at || b.created_at;
            aValue = a.status === "com_equipe" ? calcularDiasDesde(aDataEntrega) : -1;
            bValue = b.status === "com_equipe" ? calcularDiasDesde(bDataEntrega) : -1;
            break;
          case "updated_at":
            aValue = new Date(a.updated_at).getTime();
            bValue = new Date(b.updated_at).getTime();
            break;
          default:
            aValue = a[sortConfig.column];
            bValue = b[sortConfig.column];
        }

        // Handle null/undefined
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortConfig.direction === "asc" ? 1 : -1;
        if (bValue == null) return sortConfig.direction === "asc" ? -1 : 1;

        // Compare
        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue, "pt-BR", { numeric: true });
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue), "pt-BR");
        }

        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    return resultado;
  }, [itens, filtroAlerta, sortConfig]);

  // Handler de ordenação
  const handleSort = (column: string) => {
    setSortConfig((current) => {
      if (current?.column === column) {
        if (current.direction === "asc") {
          return { column, direction: "desc" };
        } else if (current.direction === "desc") {
          return null;
        }
      }
      return { column, direction: "asc" };
    });
  };

  // Query para materiais que requerem serial (requer_serial = true OU unidade = 'SR')
  const { data: materiaisSeriais } = useQuery({
    queryKey: ["materiais-com-serial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, codigo, nome, unidade")
        .eq("ativo", true)
        .or("requer_serial.eq.true,unidade.eq.SR")
        .order("codigo");

      if (error) throw error;
      return data;
    },
  });

  // Query para estatísticas
  const { data: stats } = useQuery({
    queryKey: ["serializados-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_serializados")
        .select("status");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((item: any) => {
        counts[item.status] = (counts[item.status] || 0) + 1;
      });

      return {
        total: data?.length || 0,
        em_estoque: counts.em_estoque || 0,
        com_equipe: counts.com_equipe || 0,
        instalado: counts.instalado || 0,
        defeito: counts.defeito || 0,
      };
    },
  });

  // Mutation para cadastrar item serializado
  const cadastrarMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Verificar se número de série já existe
      const { data: existente } = await supabase
        .from("materiais_serializados")
        .select("id")
        .eq("numero_serie", data.numero_serie)
        .maybeSingle();

      if (existente) {
        throw new Error("Número de série já cadastrado");
      }

      const { data: novoItem, error } = await supabase
        .from("materiais_serializados")
        .insert({
          material_id: data.material_id,
          numero_serie: data.numero_serie.toUpperCase(),
          lote: data.lote || null,
          data_fabricacao: data.data_fabricacao || null,
          data_validade: data.data_validade || null,
          status: "em_estoque",
          localizacao_tipo: "central",
          observacao: data.observacao || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico usando o ID do item criado
      if (novoItem) {
        await supabase.from("materiais_serializados_historico").insert({
          serializado_id: novoItem.id,
          acao: "cadastro",
          status_novo: "em_estoque",
          localizacao_nova: "central",
          observacao: "Cadastro inicial",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais-serializados"] });
      queryClient.invalidateQueries({ queryKey: ["serializados-stats"] });
      toast.success("Item cadastrado com sucesso!");
      setDialogOpen(false);
      setFormData({
        material_id: "",
        numero_serie: "",
        lote: "",
        data_fabricacao: "",
        data_validade: "",
        observacao: "",
      });
    },
    onError: (error: any) => {
      console.log("[Rastreabilidade] Erro na mutation:", error);
      toast.error(error.message || "Erro ao cadastrar item");
    },
  });

  // Carregar histórico completo do item (de múltiplas fontes)
  const loadHistoricoCompleto = async (item: MaterialSerializado) => {
    setLoadingHistorico(true);
    const historicoItems: HistoricoCompleto[] = [];

    try {
      // 1. Buscar histórico da tabela materiais_serializados_historico
      const { data: historicoData } = await supabase
        .from("materiais_serializados_historico")
        .select("*")
        .eq("serializado_id", item.id)
        .order("created_at", { ascending: false });

      if (historicoData) {
        historicoData.forEach((h: any) => {
          historicoItems.push({
            id: h.id,
            tipo: "status",
            descricao: h.acao || "Alteração de status",
            status_anterior: h.status_anterior,
            status_novo: h.status_novo,
            localizacao_anterior: h.localizacao_anterior,
            localizacao_nova: h.localizacao_nova,
            observacao: h.observacao,
            created_at: h.created_at,
            icone: "arrow",
          });
        });
      }

      // 2. Buscar entregas que contêm este número de série
      const { data: entregasItens } = await supabase
        .from("materiais_entregas_itens")
        .select(`
          id,
          entrega_id,
          created_at,
          materiais_entregas (
            id,
            data_entrega,
            data_confirmacao,
            status,
            observacao,
            tecnicos:equipe_id (codigo, nome)
          )
        `)
        .eq("numero_serie", item.numero_serie);

      if (entregasItens) {
        entregasItens.forEach((ei: any) => {
          const entrega = ei.materiais_entregas;
          if (entrega) {
            // Registro de entrega criada
            historicoItems.push({
              id: `entrega-${ei.id}`,
              tipo: "entrega",
              descricao: `Entrega para equipe ${entrega.tecnicos?.codigo || ""}`,
              detalhes: entrega.tecnicos?.nome,
              observacao: entrega.observacao,
              created_at: entrega.data_entrega || ei.created_at,
              icone: "truck",
            });

            // Se foi confirmada, adicionar registro de confirmação
            if (entrega.status === "confirmado" && entrega.data_confirmacao) {
              historicoItems.push({
                id: `confirmacao-${ei.id}`,
                tipo: "entrega",
                descricao: `Recebimento confirmado pela equipe ${entrega.tecnicos?.codigo || ""}`,
                detalhes: "Material recebido pela equipe",
                created_at: entrega.data_confirmacao,
                icone: "check",
              });
            }
          }
        });
      }

      // 3. Buscar movimentações do material
      const { data: movimentacoes } = await supabase
        .from("materiais_movimentacoes")
        .select("*")
        .eq("numero_serie", item.numero_serie)
        .order("created_at", { ascending: false });

      if (movimentacoes) {
        movimentacoes.forEach((mov: any) => {
          let descricao = "";
          let icone: HistoricoCompleto["icone"] = "arrow";
          
          switch (mov.tipo) {
            case "entrada":
              descricao = "Entrada em estoque";
              icone = "plus";
              break;
            case "saida":
              descricao = "Saída de estoque";
              icone = "arrow";
              break;
            case "transferencia":
              descricao = "Transferência";
              icone = "truck";
              break;
            case "ajuste":
              descricao = "Ajuste de estoque";
              icone = "package";
              break;
            default:
              descricao = mov.tipo;
          }

          historicoItems.push({
            id: `mov-${mov.id}`,
            tipo: "movimentacao",
            descricao,
            detalhes: mov.documento_referencia ? `Documento: ${mov.documento_referencia}` : undefined,
            localizacao_anterior: mov.local_origem_tipo,
            localizacao_nova: mov.local_destino_tipo,
            observacao: mov.observacao,
            created_at: mov.created_at,
            icone,
          });
        });
      }

      // 4. Buscar aplicações em OS (tabela ordem_materiais)
      const { data: aplicacoes } = await supabase
        .from("ordem_materiais")
        .select(`
          id,
          tipo,
          quantidade,
          created_at,
          observacao,
          ordens_servico (numero, endereco, cliente_nome)
        `)
        .eq("numero_serie", item.numero_serie);

      if (aplicacoes) {
        aplicacoes.forEach((ap: any) => {
          const os = ap.ordens_servico;
          historicoItems.push({
            id: `aplicacao-${ap.id}`,
            tipo: "aplicacao",
            descricao: ap.tipo === "aplicado" ? "Aplicado em OS" : "Retirado de OS",
            detalhes: os ? `OS #${os.numero} - ${os.endereco}` : undefined,
            observacao: ap.observacao,
            created_at: ap.created_at,
            icone: ap.tipo === "aplicado" ? "check" : "arrow",
          });
        });
      }
      
      // 4b. Buscar aplicações em OS (tabela materiais_aplicados_os - usada pelo app móvel)
      try {
        const { data: aplicacoesApp, error: erroApp } = await supabase
          .from("materiais_aplicados_os")
          .select(`
            id,
            tipo,
            quantidade,
            created_at,
            observacao,
            ordem_servico_id
          `)
          .eq("numero_serie", item.numero_serie);

        if (!erroApp && aplicacoesApp && aplicacoesApp.length > 0) {
          // Buscar dados das OS separadamente
          const osIds = aplicacoesApp.map((ap: any) => ap.ordem_servico_id).filter(Boolean);
          
          let osMap: Record<string, any> = {};
          if (osIds.length > 0) {
            const { data: osData } = await supabase
              .from("ordens_servico")
              .select("id, numero, endereco, cliente_nome")
              .in("id", osIds);
            
            if (osData) {
              osData.forEach((os: any) => {
                osMap[os.id] = os;
              });
            }
          }

          aplicacoesApp.forEach((ap: any) => {
            const os = osMap[ap.ordem_servico_id];
            // Evitar duplicatas (caso o mesmo registro exista nas duas tabelas)
            const jaExiste = historicoItems.some(h => 
              h.tipo === "aplicacao" && 
              Math.abs(new Date(h.created_at).getTime() - new Date(ap.created_at).getTime()) < 60000 // Menos de 1 minuto de diferença
            );
            
            if (!jaExiste) {
              historicoItems.push({
                id: `aplicacao-app-${ap.id}`,
                tipo: "aplicacao",
                descricao: ap.tipo === "aplicado" 
                  ? `Material aplicado em campo` 
                  : `Material retirado em campo`,
                detalhes: os ? `OS #${os.numero} - ${os.endereco}${os.cliente_nome ? `\nCliente: ${os.cliente_nome}` : ""}` : undefined,
                observacao: ap.observacao,
                created_at: ap.created_at,
                icone: ap.tipo === "aplicado" ? "check" : "arrow",
              });
            }
          });
        }
      } catch (e) {
        console.error("Erro ao buscar aplicações do app:", e);
      }

      // 5. Adicionar registro de criação do item
      historicoItems.push({
        id: `criacao-${item.id}`,
        tipo: "criacao",
        descricao: "Item cadastrado no sistema",
        detalhes: `Número de série: ${item.numero_serie}`,
        created_at: item.created_at,
        icone: "plus",
      });

      // Ordenar por data (mais recente primeiro)
      historicoItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setHistoricoCompleto(historicoItems);
      setHistorico(historicoData || []);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // Buscar rastro por código
  const buscarRastro = async () => {
    if (!codigoRastro.trim()) {
      setErroRastro("Digite um código de rastro");
      return;
    }

    setBuscandoRastro(true);
    setErroRastro("");
    setRastroEncontrado(null);

    try {
      // Buscar o item serializado pelo número de série
      const { data: serializado, error } = await supabase
        .from("materiais_serializados")
        .select(`
          id,
          material_id,
          numero_serie,
          lote,
          data_fabricacao,
          data_validade,
          status,
          localizacao_tipo,
          localizacao_id,
          ordem_servico_id,
          observacao,
          data_entrega_equipe,
          equipe_atual_id,
          created_at,
          updated_at
        `)
        .ilike("numero_serie", `%${codigoRastro.trim()}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!serializado) {
        setErroRastro("Nenhum rastro encontrado com este código");
        return;
      }

      // Buscar dados relacionados
      const [materiaisRes, equipesRes, osRes] = await Promise.all([
        supabase.from("materiais").select("codigo, nome, categoria, dias_alerta_retencao").eq("id", serializado.material_id).single(),
        serializado.localizacao_tipo === "equipe" && serializado.localizacao_id
          ? supabase.from("tecnicos").select("codigo, nome").eq("id", serializado.localizacao_id).single()
          : Promise.resolve({ data: null }),
        serializado.ordem_servico_id
          ? supabase.from("ordens_servico").select("numero, endereco, cliente_nome").eq("id", serializado.ordem_servico_id).single()
          : Promise.resolve({ data: null }),
      ]);

      const itemCompleto: MaterialSerializado = {
        ...serializado,
        materiais: materiaisRes.data,
        tecnicos: equipesRes.data,
        ordens_servico: osRes.data,
      };

      setRastroEncontrado(itemCompleto);
      await loadHistoricoCompleto(itemCompleto);
    } catch (error: any) {
      console.error("Erro ao buscar rastro:", error);
      setErroRastro("Erro ao buscar rastro. Tente novamente.");
    } finally {
      setBuscandoRastro(false);
    }
  };

  const handleViewItem = async (item: MaterialSerializado) => {
    setSelectedItem(item);
    setHistoricoCompleto([]);
    await loadHistoricoCompleto(item);
    setViewDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Rastreabilidade] handleSubmit", formData);
    
    if (!formData.material_id || !formData.numero_serie) {
      console.log("[Rastreabilidade] Erro: Campos obrigatórios não preenchidos");
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    
    console.log("[Rastreabilidade] Chamando mutation");
    cadastrarMutation.mutate(formData);
  };

  const getLocalizacaoLabel = (item: MaterialSerializado) => {
    if (item.localizacao_tipo === "central") return "Estoque Central";
    if (item.localizacao_tipo === "equipe" && item.tecnicos) {
      return `Equipe ${item.tecnicos.codigo}`;
    }
    if (item.localizacao_tipo === "campo" && item.ordens_servico) {
      return `OS #${item.ordens_servico.numero}`;
    }
    return item.localizacao_tipo;
  };

  return (
    <MainLayout title="Rastreabilidade" breadcrumbs={[{ label: "Materiais" }, { label: "Rastreabilidade" }]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link to="/materiais">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Search className="h-6 w-6 text-amber-600" />
                Rastreabilidade
              </h1>
              <p className="text-muted-foreground text-sm">
                Controle de medidores e itens com número de série
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBuscaRastroDialog(true)}>
              <Scan className="h-4 w-4 mr-2" />
              Rastro por Código
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Serial
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <Zap className="h-8 w-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Estoque</p>
                  <p className="text-2xl font-bold text-blue-600">{stats?.em_estoque || 0}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Com Equipes</p>
                  <p className="text-2xl font-bold text-purple-600">{stats?.com_equipe || 0}</p>
                </div>
                <User className="h-8 w-8 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Instalados</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.instalado || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Com Defeito</p>
                  <p className="text-2xl font-bold text-red-600">{stats?.defeito || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros Rápidos */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Grupo 1: Filtros por Nível de Alerta (Dias com Equipe) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 mr-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Dias com Equipe:</span>
                </div>
                {FILTROS_ALERTA.map((filtro) => (
                  <Button
                    key={filtro.id}
                    variant="outline"
                    size="sm"
                    className={`${
                      filtroAlerta === filtro.id
                        ? filtro.color + " border-2 border-current"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => setFiltroAlerta(filtro.id)}
                  >
                    {filtro.id === "critico" && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {filtro.id === "alerta" && <Clock className="h-3 w-3 mr-1" />}
                    {filtro.label}
                  </Button>
                ))}
              </div>
              
              {/* Separador Visual */}
              <div className="hidden lg:block w-px bg-border" />
              <div className="lg:hidden h-px bg-border" />
              
              {/* Grupo 2: Filtros por Status */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 mr-1">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Status:</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    filtroStatus === "todos"
                      ? "bg-gray-100 text-gray-700 border-2 border-current"
                      : "bg-background hover:bg-muted"
                  }`}
                  onClick={() => setFiltroStatus("todos")}
                >
                  Todos
                </Button>
                {Object.entries(STATUS_CONFIG).slice(0, 4).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      className={`${
                        filtroStatus === key
                          ? config.color + " border-2 border-current"
                          : "bg-background hover:bg-muted"
                      }`}
                      onClick={() => setFiltroStatus(key)}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filtros Detalhados */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número de série, lote ou OS..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroMaterial} onValueChange={setFiltroMaterial}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Materiais</SelectItem>
                  {materiaisSeriais?.map((mat: any) => (
                    <SelectItem key={mat.id} value={mat.id}>
                      {mat.codigo} - {mat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filtroAlerta !== "todos" || filtroStatus !== "todos" || filtroMaterial !== "todos" || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiltroAlerta("todos");
                    setFiltroStatus("todos");
                    setFiltroMaterial("todos");
                    setSearchTerm("");
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : itensFiltradosEOrdenados && itensFiltradosEOrdenados.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      column="numero_serie"
                      label="Nº Série"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      column="material"
                      label="Material"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      column="lote"
                      label="Lote"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      column="status"
                      label="Status"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      className="text-center"
                    />
                    <SortableTableHead
                      column="localizacao"
                      label="Localização"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      column="dias"
                      label="Dias"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      className="text-center"
                    />
                    <SortableTableHead
                      column="updated_at"
                      label="Última Atualização"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensFiltradosEOrdenados.map((item) => {
                    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.em_estoque;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <QrCode className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono font-medium">{item.numero_serie}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.materiais?.codigo}</p>
                            <p className="text-xs text-muted-foreground">{item.materiais?.nome}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.lote || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${statusConfig.color} border-0`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.localizacao_tipo === "central" && <Home className="h-4 w-4 text-muted-foreground" />}
                            {item.localizacao_tipo === "equipe" && <User className="h-4 w-4 text-muted-foreground" />}
                            {item.localizacao_tipo === "campo" && <MapPin className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm">{getLocalizacaoLabel(item)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.status === "com_equipe" && item.data_entrega_equipe ? (
                            <DiasRetencaoBadge
                              dataEntregaEquipe={item.data_entrega_equipe}
                              diasAlertaRetencao={item.materiais?.dias_alerta_retencao || 7}
                              size="sm"
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {format(new Date(item.updated_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewItem(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {filtroAlerta !== "todos" || filtroStatus !== "todos" || filtroMaterial !== "todos" || searchTerm
                    ? "Nenhum item encontrado com os filtros aplicados"
                    : "Nenhum item serializado encontrado"}
                </p>
                {filtroAlerta !== "todos" || filtroStatus !== "todos" || filtroMaterial !== "todos" || searchTerm ? (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setFiltroAlerta("todos");
                      setFiltroStatus("todos");
                      setFiltroMaterial("todos");
                      setSearchTerm("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                ) : (
                  <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar Serial
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Cadastro */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Item Serializado</DialogTitle>
              <DialogDescription>
                Registre um novo medidor ou equipamento com número de série
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Material *</Label>
                <Select
                  value={formData.material_id}
                  onValueChange={(value) => setFormData({ ...formData, material_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o material..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materiaisSeriais?.map((mat: any) => (
                      <SelectItem key={mat.id} value={mat.id}>
                        {mat.codigo} - {mat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Número de Série *</Label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.numero_serie}
                    onChange={(e) =>
                      setFormData({ ...formData, numero_serie: e.target.value.toUpperCase() })
                    }
                    placeholder="Ex: MED2024001234"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lote</Label>
                <Input
                  value={formData.lote}
                  onChange={(e) => setFormData({ ...formData, lote: e.target.value })}
                  placeholder="Número do lote"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Fabricação</Label>
                  <Input
                    type="date"
                    value={formData.data_fabricacao}
                    onChange={(e) =>
                      setFormData({ ...formData, data_fabricacao: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Validade</Label>
                  <Input
                    type="date"
                    value={formData.data_validade}
                    onChange={(e) =>
                      setFormData({ ...formData, data_validade: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                  placeholder="Observações..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={cadastrarMutation.isPending}>
                  {cadastrarMutation.isPending ? "Salvando..." : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Visualização */}
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                {selectedItem?.numero_serie}
              </DialogTitle>
            </DialogHeader>

            {selectedItem && (
              <Tabs defaultValue="detalhes" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="detalhes" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Material</p>
                      <p className="font-medium">
                        {selectedItem.materiais?.codigo} - {selectedItem.materiais?.nome}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className={`${STATUS_CONFIG[selectedItem.status]?.color || ""} border-0`}>
                        {STATUS_CONFIG[selectedItem.status]?.label || selectedItem.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lote</p>
                      <p className="font-medium">{selectedItem.lote || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Localização</p>
                      <p className="font-medium">{getLocalizacaoLabel(selectedItem)}</p>
                    </div>
                    {selectedItem.data_fabricacao && (
                      <div>
                        <p className="text-sm text-muted-foreground">Data de Fabricação</p>
                        <p className="font-medium">
                          {format(new Date(selectedItem.data_fabricacao), "dd/MM/yyyy")}
                        </p>
                      </div>
                    )}
                    {selectedItem.data_validade && (
                      <div>
                        <p className="text-sm text-muted-foreground">Data de Validade</p>
                        <p className="font-medium">
                          {format(new Date(selectedItem.data_validade), "dd/MM/yyyy")}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedItem.ordens_servico && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Instalado em</p>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-medium">OS #{selectedItem.ordens_servico.numero}</p>
                          <p className="text-sm">{selectedItem.ordens_servico.endereco}</p>
                          {selectedItem.ordens_servico.cliente_nome && (
                            <p className="text-sm text-muted-foreground">
                              Cliente: {selectedItem.ordens_servico.cliente_nome}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedItem.observacao && (
                    <div>
                      <p className="text-sm text-muted-foreground">Observação</p>
                      <p className="text-sm">{selectedItem.observacao}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="historico" className="mt-4">
                  {loadingHistorico ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Carregando histórico...</span>
                    </div>
                  ) : historicoCompleto.length > 0 ? (
                    <div className="relative">
                      {/* Linha do tempo */}
                      <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />
                      
                      <div className="space-y-4">
                        {historicoCompleto.map((item, index) => {
                          const getIcone = () => {
                            switch (item.icone) {
                              case "plus":
                                return <Plus className="h-4 w-4" />;
                              case "truck":
                                return <Truck className="h-4 w-4" />;
                              case "user":
                                return <User className="h-4 w-4" />;
                              case "check":
                                return <CheckCircle className="h-4 w-4" />;
                              case "package":
                                return <Package className="h-4 w-4" />;
                              default:
                                return <ArrowRight className="h-4 w-4" />;
                            }
                          };

                          const getCorFundo = () => {
                            switch (item.tipo) {
                              case "criacao":
                                return "bg-blue-100 text-blue-700";
                              case "entrega":
                                return "bg-pink-100 text-pink-700";
                              case "movimentacao":
                                return "bg-violet-100 text-violet-700";
                              case "aplicacao":
                                return "bg-green-100 text-green-700";
                              default:
                                return "bg-amber-100 text-amber-700";
                            }
                          };

                          return (
                            <div key={item.id} className="flex gap-3 relative">
                              {/* Ícone na linha do tempo */}
                              <div className={`p-2 rounded-full z-10 ${getCorFundo()}`}>
                                {getIcone()}
                              </div>
                              
                              {/* Conteúdo */}
                              <div className="flex-1 pb-4">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{item.descricao}</p>
                                    {item.detalhes && (
                                      <p className="text-sm text-muted-foreground">{item.detalhes}</p>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                    {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
                                  </p>
                                </div>
                                
                                {/* Status change */}
                                {item.status_anterior && item.status_novo && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {STATUS_CONFIG[item.status_anterior]?.label || item.status_anterior}
                                    </Badge>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <Badge variant="outline" className="text-xs">
                                      {STATUS_CONFIG[item.status_novo]?.label || item.status_novo}
                                    </Badge>
                                  </div>
                                )}
                                
                                {/* Localização */}
                                {(item.localizacao_anterior || item.localizacao_nova) && (
                                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {item.localizacao_anterior && (
                                      <span>{item.localizacao_anterior}</span>
                                    )}
                                    {item.localizacao_anterior && item.localizacao_nova && (
                                      <ArrowRight className="h-3 w-3" />
                                    )}
                                    {item.localizacao_nova && (
                                      <span>{item.localizacao_nova}</span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Observação */}
                                {item.observacao && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">
                                    "{item.observacao}"
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum histórico disponível</p>
                      <p className="text-xs mt-1">O histórico será registrado a partir das próximas movimentações</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Busca por Código de Rastro */}
        <Dialog open={buscaRastroDialog} onOpenChange={(open) => {
          setBuscaRastroDialog(open);
          if (!open) {
            setCodigoRastro("");
            setRastroEncontrado(null);
            setErroRastro("");
            setHistoricoCompleto([]);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scan className="h-5 w-5 text-amber-600" />
                Rastro por Código
              </DialogTitle>
              <DialogDescription>
                Digite o número de série para visualizar todo o histórico do material
              </DialogDescription>
            </DialogHeader>

            {/* Campo de busca */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={codigoRastro}
                  onChange={(e) => setCodigoRastro(e.target.value.toUpperCase())}
                  placeholder="Digite o número de série (ex: MED2024001)"
                  className="pl-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      buscarRastro();
                    }
                  }}
                />
              </div>
              <Button onClick={buscarRastro} disabled={buscandoRastro}>
                {buscandoRastro ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Erro */}
            {erroRastro && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {erroRastro}
              </div>
            )}

            {/* Resultado da busca */}
            {rastroEncontrado && (
              <div className="space-y-4">
                {/* Informações do item */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <QrCode className="h-4 w-4" />
                      {rastroEncontrado.numero_serie}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Material</p>
                        <p className="font-medium">
                          {rastroEncontrado.materiais?.codigo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {rastroEncontrado.materiais?.nome}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge className={`${STATUS_CONFIG[rastroEncontrado.status]?.color || ""} border-0 mt-1`}>
                          {STATUS_CONFIG[rastroEncontrado.status]?.label || rastroEncontrado.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Localização</p>
                        <p className="font-medium">{getLocalizacaoLabel(rastroEncontrado)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cadastrado em</p>
                        <p className="font-medium">
                          {format(new Date(rastroEncontrado.created_at), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>

                    {/* Se está com equipe, mostrar dias */}
                    {rastroEncontrado.status === "com_equipe" && rastroEncontrado.data_entrega_equipe && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-purple-600" />
                            <span className="text-sm">
                              Com equipe {rastroEncontrado.tecnicos?.codigo || ""} há{" "}
                              <strong>
                                {Math.floor(
                                  (new Date().getTime() - new Date(rastroEncontrado.data_entrega_equipe).getTime()) /
                                    (1000 * 60 * 60 * 24)
                                )}{" "}
                                dias
                              </strong>
                            </span>
                          </div>
                          <DiasRetencaoBadge
                            dataEntregaEquipe={rastroEncontrado.data_entrega_equipe}
                            diasAlertaRetencao={rastroEncontrado.materiais?.dias_alerta_retencao || 7}
                          />
                        </div>
                      </div>
                    )}

                    {/* Se está instalado, mostrar OS */}
                    {rastroEncontrado.ordens_servico && (
                      <div className="mt-4 p-3 bg-green-50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-green-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">
                              Instalado na OS #{rastroEncontrado.ordens_servico.numero}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {rastroEncontrado.ordens_servico.endereco}
                            </p>
                            {rastroEncontrado.ordens_servico.cliente_nome && (
                              <p className="text-xs text-muted-foreground">
                                Cliente: {rastroEncontrado.ordens_servico.cliente_nome}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Histórico completo */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Histórico Completo
                    </CardTitle>
                    <CardDescription>
                      Todas as movimentações e eventos deste material
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingHistorico ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Carregando histórico...</span>
                      </div>
                    ) : historicoCompleto.length > 0 ? (
                      <div className="relative">
                        {/* Linha do tempo */}
                        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />
                        
                        <div className="space-y-4">
                          {historicoCompleto.map((item) => {
                            const getIcone = () => {
                              switch (item.icone) {
                                case "plus":
                                  return <Plus className="h-4 w-4" />;
                                case "truck":
                                  return <Truck className="h-4 w-4" />;
                                case "user":
                                  return <User className="h-4 w-4" />;
                                case "check":
                                  return <CheckCircle className="h-4 w-4" />;
                                case "package":
                                  return <Package className="h-4 w-4" />;
                                default:
                                  return <ArrowRight className="h-4 w-4" />;
                              }
                            };

                            const getCorFundo = () => {
                              switch (item.tipo) {
                                case "criacao":
                                  return "bg-blue-100 text-blue-700";
                                case "entrega":
                                  return "bg-pink-100 text-pink-700";
                                case "movimentacao":
                                  return "bg-violet-100 text-violet-700";
                                case "aplicacao":
                                  return "bg-green-100 text-green-700";
                                default:
                                  return "bg-amber-100 text-amber-700";
                              }
                            };

                            return (
                              <div key={item.id} className="flex gap-3 relative">
                                {/* Ícone na linha do tempo */}
                                <div className={`p-2 rounded-full z-10 ${getCorFundo()}`}>
                                  {getIcone()}
                                </div>
                                
                                {/* Conteúdo */}
                                <div className="flex-1 pb-4">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-medium text-sm">{item.descricao}</p>
                                      {item.detalhes && (
                                        <p className="text-sm text-muted-foreground">{item.detalhes}</p>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
                                    </p>
                                  </div>
                                  
                                  {/* Status change */}
                                  {item.status_anterior && item.status_novo && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {STATUS_CONFIG[item.status_anterior]?.label || item.status_anterior}
                                      </Badge>
                                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                      <Badge variant="outline" className="text-xs">
                                        {STATUS_CONFIG[item.status_novo]?.label || item.status_novo}
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {/* Localização */}
                                  {(item.localizacao_anterior || item.localizacao_nova) && (
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                      <MapPin className="h-3 w-3" />
                                      {item.localizacao_anterior && (
                                        <span>{item.localizacao_anterior}</span>
                                      )}
                                      {item.localizacao_anterior && item.localizacao_nova && (
                                        <ArrowRight className="h-3 w-3" />
                                      )}
                                      {item.localizacao_nova && (
                                        <span>{item.localizacao_nova}</span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Observação */}
                                  {item.observacao && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">
                                      "{item.observacao}"
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum histórico disponível</p>
                        <p className="text-xs mt-1">O histórico será registrado a partir das próximas movimentações</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setBuscaRastroDialog(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

