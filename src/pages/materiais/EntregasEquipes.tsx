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
import { SortableTableHead, SortConfig } from "@/components/ui/sortable-table-head";
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
  Users,
  Plus,
  Search,
  ArrowLeft,
  Package,
  FileSignature,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Truck,
  Calendar,
  User,
  Trash2,
  Printer,
  Download,
  QrCode,
  Check,
  MapPin,
  Image,
  X,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EntregaItem {
  material_id: string;
  quantidade: number;
  numero_serie?: string;
  material?: {
    codigo: string;
    nome: string;
    unidade: string;
  };
}

interface Entrega {
  id: string;
  equipe_id: string;
  data_entrega: string;
  status: string;
  observacao: string | null;
  assinatura_recebimento: string | null;
  foto_recebimento: string | null;
  coordenadas_recebimento: string | null;
  data_recebimento: string | null;
  data_confirmacao: string | null;
  recebido_por: string | null;
  created_at: string;
  created_by: string | null;
  tecnicos?: {
    codigo: string;
    nome: string;
  };
  itens?: EntregaItem[];
}

interface NovaEntregaForm {
  equipe_id: string;
  observacao: string;
  itens: EntregaItem[];
}

export default function EntregasEquipes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroEquipe, setFiltroEquipe] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [imagemViewer, setImagemViewer] = useState<{ open: boolean; src: string; titulo: string }>({ open: false, src: "", titulo: "" });
  const [checklistRespostas, setChecklistRespostas] = useState<any>(null);
  const [loadingRespostas, setLoadingRespostas] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Form para nova entrega
  const [novaEntrega, setNovaEntrega] = useState<NovaEntregaForm>({
    equipe_id: "",
    observacao: "",
    itens: [],
  });
  const [itemTemp, setItemTemp] = useState({ material_id: "", quantidade: 1, numero_serie: "" });
  const [buscaMaterial, setBuscaMaterial] = useState("");
  const [dialogRastros, setDialogRastros] = useState(false);
  const [buscaRastro, setBuscaRastro] = useState("");
  const [rastrosSelecionados, setRastrosSelecionados] = useState<string[]>([]);
  const [modoSelecaoRastros, setModoSelecaoRastros] = useState<"individual" | "multiplo" | "range" | "importar">("individual");
  const [rangeInicio, setRangeInicio] = useState("");
  const [rangeFim, setRangeFim] = useState("");
  const [importarTexto, setImportarTexto] = useState("");

  // Query para entregas
  const { data: entregas, isLoading } = useQuery({
    queryKey: ["entregas-equipes", filtroStatus, filtroEquipe, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("materiais_entregas")
        .select(`
          id,
          equipe_id,
          data_entrega,
          status,
          observacao,
          assinatura_recebimento,
          foto_recebimento,
          coordenadas_recebimento,
          data_recebimento,
          data_confirmacao,
          recebido_por,
          created_at,
          created_by,
          tecnicos:equipe_id (codigo, nome)
        `)
        .order("created_at", { ascending: false });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      if (filtroEquipe !== "todos") {
        query = query.eq("equipe_id", filtroEquipe);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Buscar itens de cada entrega
      const entregasComItens = await Promise.all(
        (data || []).map(async (entrega: any) => {
          const { data: itens } = await supabase
            .from("materiais_entregas_itens")
            .select(`
              material_id,
              quantidade,
              numero_serie,
              materiais (codigo, nome, unidade)
            `)
            .eq("entrega_id", entrega.id);

          return {
            ...entrega,
            itens: itens?.map((item: any) => ({
              material_id: item.material_id,
              quantidade: item.quantidade,
              numero_serie: item.numero_serie,
              material: item.materiais,
            })) || [],
          };
        })
      );

      // Filtrar por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return entregasComItens.filter(
          (e: any) =>
            e.tecnicos?.codigo?.toLowerCase().includes(term) ||
            e.tecnicos?.nome?.toLowerCase().includes(term) ||
            e.itens?.some((i: any) => 
              i.material?.codigo?.toLowerCase().includes(term) ||
              i.material?.nome?.toLowerCase().includes(term)
            )
        );
      }

      return entregasComItens as Entrega[];
    },
  });

  // Query para equipes
  const { data: equipes } = useQuery({
    queryKey: ["equipes-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome")
        .in("status", ["disponivel", "em_campo"])
        .order("codigo");

      if (error) throw error;
      return data;
    },
  });

  // Query para materiais
  const { data: materiais } = useQuery({
    queryKey: ["materiais-ativos-entrega"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, codigo, nome, unidade, requer_serial")
        .eq("ativo", true)
        .order("codigo");

      if (error) throw error;
      return data;
    },
  });

  // Query para estoque disponível
  const { data: estoqueDisponivel } = useQuery({
    queryKey: ["estoque-disponivel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_estoque")
        .select("material_id, quantidade")
        .eq("local_tipo", "central");

      if (error) throw error;

      const map: Record<string, number> = {};
      data?.forEach((item: any) => {
        map[item.material_id] = item.quantidade;
      });
      return map;
    },
  });

  // Query para rastros disponíveis do material selecionado
  const { data: rastrosDisponiveis } = useQuery({
    queryKey: ["rastros-disponiveis", itemTemp.material_id],
    queryFn: async () => {
      if (!itemTemp.material_id) return [];

      const { data, error } = await supabase
        .from("materiais_serializados")
        .select("id, numero_serie, lote, status, localizacao_tipo")
        .eq("material_id", itemTemp.material_id)
        .eq("status", "em_estoque")
        .eq("localizacao_tipo", "central")
        .order("numero_serie");

      if (error) throw error;
      return data || [];
    },
    enabled: !!itemTemp.material_id,
  });

  // Mutation para criar entrega
  const criarEntregaMutation = useMutation({
    mutationFn: async (form: NovaEntregaForm) => {
      // Verificar estoque
      for (const item of form.itens) {
        const disponivel = estoqueDisponivel?.[item.material_id] || 0;
        if (item.quantidade > disponivel) {
          const mat = materiais?.find((m: any) => m.id === item.material_id);
          throw new Error(`Estoque insuficiente para ${mat?.nome || "material"}`);
        }
      }

      // Criar entrega
      const { data: entrega, error: entregaError } = await supabase
        .from("materiais_entregas")
        .insert({
          equipe_id: form.equipe_id,
          data_entrega: new Date().toISOString(),
          status: "pendente",
          observacao: form.observacao || null,
        })
        .select()
        .single();

      if (entregaError) throw entregaError;

      // Criar itens da entrega
      const itensPayload = form.itens.map((item) => ({
        entrega_id: entrega.id,
        material_id: item.material_id,
        quantidade: item.quantidade,
        numero_serie: item.numero_serie || null,
      }));

      const { error: itensError } = await supabase
        .from("materiais_entregas_itens")
        .insert(itensPayload);

      if (itensError) throw itensError;

      // Dar baixa no estoque central e entrada no estoque da equipe
      for (const item of form.itens) {
        // Baixa no estoque central
        const { data: estoqueCentral } = await supabase
          .from("materiais_estoque")
          .select("id, quantidade")
          .eq("material_id", item.material_id)
          .eq("local_tipo", "central")
          .single();

        if (estoqueCentral) {
          await supabase
            .from("materiais_estoque")
            .update({ quantidade: estoqueCentral.quantidade - item.quantidade })
            .eq("id", estoqueCentral.id);
        }

        // Entrada no estoque da equipe
        const { data: estoqueEquipe } = await supabase
          .from("materiais_estoque")
          .select("id, quantidade")
          .eq("material_id", item.material_id)
          .eq("local_tipo", "equipe")
          .eq("local_id", form.equipe_id)
          .maybeSingle();

        if (estoqueEquipe) {
          await supabase
            .from("materiais_estoque")
            .update({ quantidade: estoqueEquipe.quantidade + item.quantidade })
            .eq("id", estoqueEquipe.id);
        } else {
          await supabase.from("materiais_estoque").insert({
            material_id: item.material_id,
            quantidade: item.quantidade,
            local_tipo: "equipe",
            local_id: form.equipe_id,
          });
        }

        // Registrar movimentação
        await supabase.from("materiais_movimentacoes").insert({
          material_id: item.material_id,
          tipo: "transferencia",
          quantidade: item.quantidade,
          local_origem_tipo: "central",
          local_destino_tipo: "equipe",
          local_destino_id: form.equipe_id,
          observacao: `Entrega para equipe - ${entrega.id}`,
          entrega_id: entrega.id,
        });
      }

      return entrega;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas-equipes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-disponivel"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-central"] });
      toast.success("Entrega registrada com sucesso!");
      setDialogOpen(false);
      setNovaEntrega({ equipe_id: "", observacao: "", itens: [] });
    },
    onError: (error: any) => {
      console.error("Erro ao criar entrega:", error);
      toast.error(error.message || "Erro ao criar entrega");
    },
  });

  // Mutation para cancelar entrega
  const cancelarEntregaMutation = useMutation({
    mutationFn: async (entrega: Entrega) => {
      if (entrega.status !== "pendente") {
        throw new Error("Apenas entregas pendentes podem ser canceladas");
      }

      // Reverter movimentações de estoque
      for (const item of entrega.itens || []) {
        // Devolver ao estoque central
        const { data: estoqueCentral } = await supabase
          .from("materiais_estoque")
          .select("id, quantidade")
          .eq("material_id", item.material_id)
          .eq("local_tipo", "central")
          .single();

        if (estoqueCentral) {
          await supabase
            .from("materiais_estoque")
            .update({ quantidade: estoqueCentral.quantidade + item.quantidade })
            .eq("id", estoqueCentral.id);
        }

        // Remover do estoque da equipe
        const { data: estoqueEquipe } = await supabase
          .from("materiais_estoque")
          .select("id, quantidade")
          .eq("material_id", item.material_id)
          .eq("local_tipo", "equipe")
          .eq("local_id", entrega.equipe_id)
          .maybeSingle();

        if (estoqueEquipe) {
          await supabase
            .from("materiais_estoque")
            .update({ quantidade: Math.max(0, estoqueEquipe.quantidade - item.quantidade) })
            .eq("id", estoqueEquipe.id);
        }
      }

      // Atualizar status da entrega
      const { error } = await supabase
        .from("materiais_entregas")
        .update({ status: "cancelada" })
        .eq("id", entrega.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas-equipes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-disponivel"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-central"] });
      toast.success("Entrega cancelada!");
      setCancelDialog(false);
      setSelectedEntrega(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao cancelar entrega");
    },
  });

  // Função para buscar respostas do checklist vinculadas à entrega
  const buscarRespostasChecklist = async (entrega: Entrega) => {
    setLoadingRespostas(true);
    setChecklistRespostas(null);
    
    try {
      // Buscar checklist de recebimento
      const { data: checklist } = await supabase
        .from("checklists")
        .select("id, nome, perguntas, grupos")
        .eq("tipo", "recebimento_materiais")
        .eq("ativo", true)
        .maybeSingle();

      if (!checklist) {
        setLoadingRespostas(false);
        return;
      }

      // Buscar respostas vinculadas a esta equipe e próximas da data de confirmação
      const { data: respostas } = await supabase
        .from("checklist_respostas")
        .select("id, codigo_unico, respostas, created_at, status, equipe_id")
        .eq("checklist_id", checklist.id)
        .eq("equipe_id", entrega.equipe_id)
        .order("created_at", { ascending: false });

      // Encontrar a resposta mais próxima da data de confirmação da entrega
      let respostaEncontrada = null;
      if (respostas && respostas.length > 0) {
        if (entrega.data_confirmacao) {
          const dataConfirmacao = new Date(entrega.data_confirmacao).getTime();
          let menorDiferenca = Infinity;
          
          for (const resp of respostas) {
            const dataResposta = new Date(resp.created_at).getTime();
            const diferenca = Math.abs(dataResposta - dataConfirmacao);
            
            // Aceitar respostas com até 5 minutos de diferença
            if (diferenca < menorDiferenca && diferenca < 5 * 60 * 1000) {
              menorDiferenca = diferenca;
              respostaEncontrada = resp;
            }
          }
        }
        
        // Se não encontrou por data, pegar a mais recente da equipe
        if (!respostaEncontrada) {
          respostaEncontrada = respostas[0];
        }
      }

      if (respostaEncontrada) {
        // Normalizar perguntas - manter grupos se existirem
        let perguntas: any[] = [];
        let grupos: any[] = [];
        
        if (checklist.grupos && Array.isArray(checklist.grupos) && checklist.grupos.length > 0) {
          grupos = checklist.grupos as any[];
          perguntas = grupos.flatMap(g => g.perguntas || []);
        } else if (checklist.perguntas && Array.isArray(checklist.perguntas)) {
          perguntas = checklist.perguntas as any[];
          grupos = [{
            id: "grupo-unico",
            nome: checklist.nome || "Perguntas",
            ordem: 1,
            perguntas: perguntas.map((p: any, idx: number) => ({
              id: p.id || String(idx + 1),
              texto: p.texto,
              tipo: p.tipo,
              obrigatoria: p.obrigatorio || p.obrigatoria || false,
              ordem: p.ordem || idx + 1,
            })),
          }];
        }

        setChecklistRespostas({
          checklist,
          respostas: respostaEncontrada,
          perguntas,
          grupos,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar respostas:", error);
    }
    
    setLoadingRespostas(false);
  };

  // Handler para abrir visualização
  const handleViewEntrega = async (entrega: Entrega) => {
    setSelectedEntrega(entrega);
    setViewDialog(true);
    
    // Se a entrega foi confirmada, buscar respostas do checklist
    if (entrega.status === "confirmado" || entrega.status === "recebida") {
      await buscarRespostasChecklist(entrega);
    }
  };

  const handleAddItem = () => {
    if (!itemTemp.material_id || itemTemp.quantidade <= 0) {
      toast.error("Selecione um material e quantidade válida");
      return;
    }

    const material = materiais?.find((m: any) => m.id === itemTemp.material_id);
    const requerSerial = material?.requer_serial || material?.unidade === "SR";
    
    if (requerSerial && !itemTemp.numero_serie) {
      toast.error("Este material requer número de série/rastro único");
      return;
    }

    // Se for material SR, validar se o rastro existe e está disponível
    if (requerSerial && itemTemp.numero_serie) {
      const rastroExiste = rastrosDisponiveis?.find((r: any) => r.numero_serie === itemTemp.numero_serie);
      if (!rastroExiste) {
        toast.error("Este rastro não está disponível em estoque. Selecione um rastro válido.");
        return;
      }
    }

    const disponivel = estoqueDisponivel?.[itemTemp.material_id] || 0;
    if (itemTemp.quantidade > disponivel) {
      toast.error("Quantidade maior que o disponível em estoque");
      return;
    }

    // Verificar se já existe (considerando número de série para materiais SR)
    const existe = novaEntrega.itens.find((i) => {
      if (i.material_id !== itemTemp.material_id) return false;
      if (requerSerial && i.numero_serie !== itemTemp.numero_serie) return false;
      return true;
    });
    
    if (existe) {
      toast.error("Material já adicionado" + (requerSerial ? " com este número de série" : ""));
      return;
    }

    setNovaEntrega({
      ...novaEntrega,
      itens: [
        ...novaEntrega.itens,
        {
          material_id: itemTemp.material_id,
          quantidade: itemTemp.quantidade,
          numero_serie: requerSerial ? itemTemp.numero_serie : undefined,
          material: material,
        },
      ],
    });
    setItemTemp({ material_id: "", quantidade: 1, numero_serie: "" });
    setBuscaMaterial("");
  };

  const handleRemoveItem = (item: EntregaItem) => {
    setNovaEntrega({
      ...novaEntrega,
      itens: novaEntrega.itens.filter((i) => {
        if (i.material_id !== item.material_id) return true;
        if (item.numero_serie && i.numero_serie !== item.numero_serie) return true;
        return false;
      }),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaEntrega.equipe_id) {
      toast.error("Selecione uma equipe");
      return;
    }
    if (novaEntrega.itens.length === 0) {
      toast.error("Adicione pelo menos um material");
      return;
    }
    criarEntregaMutation.mutate(novaEntrega);
  };

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

  // Ordenar entregas
  const entregasOrdenadas = useMemo(() => {
    if (!entregas || !sortConfig || !sortConfig.direction) {
      return entregas;
    }

    return [...entregas].sort((a: any, b: any) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.column) {
        case "created_at":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case "equipe":
          aValue = a.tecnicos?.codigo || "";
          bValue = b.tecnicos?.codigo || "";
          break;
        case "itens":
          aValue = a.itens?.length || 0;
          bValue = b.itens?.length || 0;
          break;
        case "status":
          const statusOrder = { pendente: 0, confirmado: 1, recebida: 1, cancelada: 2 };
          aValue = statusOrder[a.status as keyof typeof statusOrder] ?? 99;
          bValue = statusOrder[b.status as keyof typeof statusOrder] ?? 99;
          break;
        default:
          aValue = a[sortConfig.column];
          bValue = b[sortConfig.column];
      }

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === "asc" ? 1 : -1;
      if (bValue == null) return sortConfig.direction === "asc" ? -1 : 1;

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
  }, [entregas, sortConfig]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge className="bg-amber-100 text-amber-700 border-0"><Clock className="h-3 w-3 mr-1" />Aguardando Assinatura</Badge>;
      case "recebida":
      case "confirmado":
        return <Badge className="bg-green-100 text-green-700 border-0"><CheckCircle className="h-3 w-3 mr-1" />Confirmada</Badge>;
      case "cancelada":
        return <Badge className="bg-red-100 text-red-700 border-0"><XCircle className="h-3 w-3 mr-1" />Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <MainLayout title="Entregas às Equipes">
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
                <Users className="h-6 w-6 text-pink-600" />
                Entregas às Equipes
              </h1>
              <p className="text-muted-foreground text-sm">
                Distribua materiais para as equipes de campo
              </p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Entrega
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por equipe ou material..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="pendente">Aguardando Assinatura</SelectItem>
                  <SelectItem value="recebida">Recebida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Equipes</SelectItem>
                  {equipes?.map((eq: any) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.codigo} - {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Entregas */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : entregasOrdenadas && entregasOrdenadas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      column="created_at"
                      label="Data"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      column="equipe"
                      label="Equipe"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      column="itens"
                      label="Itens"
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
                    <TableHead>Recebimento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregasOrdenadas.map((entrega) => (
                    <TableRow key={entrega.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {format(new Date(entrega.created_at), "dd/MM/yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entrega.created_at), "HH:mm")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-pink-100 rounded-full">
                            <User className="h-4 w-4 text-pink-600" />
                          </div>
                          <div>
                            <p className="font-medium">{entrega.tecnicos?.codigo}</p>
                            <p className="text-xs text-muted-foreground">
                              {entrega.tecnicos?.nome}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {entrega.itens?.slice(0, 2).map((item, idx) => (
                            <p key={idx} className="text-sm">
                              {item.material?.codigo}: {item.quantidade} {item.material?.unidade}
                            </p>
                          ))}
                          {(entrega.itens?.length || 0) > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{(entrega.itens?.length || 0) - 2} itens
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(entrega.status)}
                      </TableCell>
                      <TableCell>
                        {(entrega.status === "recebida" || entrega.status === "confirmado") ? (
                          <div>
                            {entrega.data_confirmacao && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entrega.data_confirmacao), "dd/MM HH:mm")}
                              </p>
                            )}
                            <div className="flex gap-1 mt-1">
                              {entrega.assinatura_recebimento && (
                                <Badge variant="outline" className="text-xs">
                                  <FileSignature className="h-3 w-3 mr-1" />
                                  Assinado
                                </Badge>
                              )}
                              {entrega.foto_recebimento && (
                                <Badge variant="outline" className="text-xs">
                                  <Image className="h-3 w-3 mr-1" />
                                  Foto
                                </Badge>
                              )}
                              {entrega.coordenadas_recebimento && (
                                <Badge variant="outline" className="text-xs">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  GPS
                                </Badge>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              handleViewEntrega(entrega);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {entrega.status === "pendente" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedEntrega(entrega);
                                setCancelDialog(true);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma entrega encontrada</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Entrega
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Nova Entrega */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Entrega de Materiais</DialogTitle>
              <DialogDescription>
                Registre a entrega de materiais para uma equipe de campo
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Equipe *</Label>
                <Select
                  value={novaEntrega.equipe_id}
                  onValueChange={(value) =>
                    setNovaEntrega({ ...novaEntrega, equipe_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a equipe..." />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {equipes && equipes.length > 0 ? (
                      equipes.map((eq: any) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.codigo} - {eq.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhuma equipe disponível
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Adicionar itens */}
              <div className="space-y-4">
                <Label>Materiais</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar material por código ou nome..."
                      value={buscaMaterial}
                      onChange={(e) => setBuscaMaterial(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    {materiais?.filter((mat: any) => {
                      if (!buscaMaterial) return true;
                      const term = buscaMaterial.toLowerCase();
                      return (
                        mat.codigo.toLowerCase().includes(term) ||
                        mat.nome.toLowerCase().includes(term)
                      );
                    }).map((mat: any) => {
                      const disponivel = estoqueDisponivel?.[mat.id] || 0;
                      const requerSerial = mat.requer_serial || mat.unidade === "SR";
                      return (
                        <button
                          key={mat.id}
                          type="button"
                          className={`w-full p-3 text-left hover:bg-muted/50 transition-all border-b last:border-b-0 ${
                            itemTemp.material_id === mat.id
                              ? "bg-violet-100 border-2 border-violet-500 rounded-lg font-semibold"
                              : disponivel <= 0
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                          onClick={() => {
                            if (disponivel > 0) {
                              setItemTemp({ ...itemTemp, material_id: mat.id, numero_serie: "" });
                            }
                          }}
                          disabled={disponivel <= 0}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm ${itemTemp.material_id === mat.id ? "text-violet-700 font-bold" : "font-medium"}`}>
                                {mat.codigo}
                                {requerSerial && <Badge variant="outline" className="ml-2 text-xs">SR</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground">{mat.nome}</p>
                            </div>
                            <Badge variant={disponivel > 0 ? "secondary" : "destructive"}>
                              Disp: {disponivel}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={itemTemp.quantidade}
                    onChange={(e) =>
                      setItemTemp({ ...itemTemp, quantidade: parseInt(e.target.value) || 1 })
                    }
                    className="w-24"
                    placeholder="Qtd"
                  />
                  {itemTemp.material_id && (() => {
                    const material = materiais?.find((m: any) => m.id === itemTemp.material_id);
                    const requerSerial = material?.requer_serial || material?.unidade === "SR";
                    if (requerSerial) {
                      return (
                        <Button
                          type="button"
                          variant={itemTemp.numero_serie ? "default" : "outline"}
                          className="flex-1 justify-between"
                          onClick={() => setDialogRastros(true)}
                        >
                          <span className="flex items-center gap-2">
                            <QrCode className="h-4 w-4" />
                            {itemTemp.numero_serie || "Selecionar Rastro *"}
                          </span>
                          <Search className="h-4 w-4" />
                        </Button>
                      );
                    }
                    return null;
                  })()}
                  <Button type="button" onClick={handleAddItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Lista de itens */}
                {novaEntrega.itens.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-center">Quantidade</TableHead>
                          <TableHead>Nº Série</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {novaEntrega.itens.map((item, index) => (
                          <TableRow key={`${item.material_id}-${item.numero_serie || index}`}>
                            <TableCell>
                              <p className="font-medium">{item.material?.codigo}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.material?.nome}
                              </p>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.quantidade} {item.material?.unidade}
                            </TableCell>
                            <TableCell>
                              {item.numero_serie ? (
                                <Badge variant="outline" className="font-mono text-xs">
                                  <QrCode className="h-3 w-3 mr-1" />
                                  {item.numero_serie}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={novaEntrega.observacao}
                  onChange={(e) =>
                    setNovaEntrega({ ...novaEntrega, observacao: e.target.value })
                  }
                  placeholder="Observações sobre a entrega..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={criarEntregaMutation.isPending}>
                  {criarEntregaMutation.isPending ? "Salvando..." : "Registrar Entrega"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Visualização */}
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Entrega</DialogTitle>
            </DialogHeader>

            {selectedEntrega && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Data da Entrega</p>
                    <p className="font-medium">
                      {format(new Date(selectedEntrega.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedEntrega.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Equipe</p>
                    <p className="font-medium">
                      {selectedEntrega.tecnicos?.codigo} - {selectedEntrega.tecnicos?.nome}
                    </p>
                  </div>
                  {(selectedEntrega.status === "recebida" || selectedEntrega.status === "confirmado") && selectedEntrega.data_confirmacao && (
                    <div>
                      <p className="text-sm text-muted-foreground">Data Confirmação</p>
                      <p className="font-medium">
                        {format(new Date(selectedEntrega.data_confirmacao), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Itens</p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedEntrega.itens?.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <p className="font-medium">{item.material?.codigo}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.material?.nome}
                              </p>
                              {item.numero_serie && (
                                <Badge variant="outline" className="mt-1 text-xs font-mono">
                                  <QrCode className="h-3 w-3 mr-1" />
                                  {item.numero_serie}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantidade} {item.material?.unidade}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {selectedEntrega.observacao && (
                  <div>
                    <p className="text-sm text-muted-foreground">Observação</p>
                    <p className="text-sm">{selectedEntrega.observacao}</p>
                  </div>
                )}

                {/* Seção de Confirmação de Recebimento */}
                {(selectedEntrega.status === "recebida" || selectedEntrega.status === "confirmado") && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-green-700 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Confirmação de Recebimento
                    </h3>

                    {/* Coordenadas */}
                    {selectedEntrega.coordenadas_recebimento && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Localização do Recebimento</p>
                        <a
                          href={`https://www.google.com/maps?q=${selectedEntrega.coordenadas_recebimento}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <MapPin className="h-4 w-4" />
                          {selectedEntrega.coordenadas_recebimento}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    {/* Foto do Recebimento */}
                    {selectedEntrega.foto_recebimento && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Foto do Recebimento</p>
                        <div 
                          className="relative cursor-pointer group"
                          onClick={() => setImagemViewer({
                            open: true,
                            src: selectedEntrega.foto_recebimento!,
                            titulo: "Foto do Recebimento"
                          })}
                        >
                          <img
                            src={selectedEntrega.foto_recebimento}
                            alt="Foto do Recebimento"
                            className="w-full max-h-64 object-contain border rounded-lg bg-gray-50"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center rounded-lg">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-3 py-1 rounded-full text-sm font-medium">
                              Clique para ampliar
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Assinatura */}
                    {selectedEntrega.assinatura_recebimento && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Assinatura de Confirmação</p>
                        <div 
                          className="relative cursor-pointer group"
                          onClick={() => setImagemViewer({
                            open: true,
                            src: selectedEntrega.assinatura_recebimento!,
                            titulo: "Assinatura de Confirmação"
                          })}
                        >
                          <img
                            src={selectedEntrega.assinatura_recebimento}
                            alt="Assinatura"
                            className="w-full max-h-48 object-contain border rounded-lg bg-white p-2"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center rounded-lg">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-3 py-1 rounded-full text-sm font-medium">
                              Clique para ampliar
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Respostas do Checklist */}
                    {loadingRespostas ? (
                      <div className="py-4 text-center">
                        <p className="text-sm text-muted-foreground">Carregando respostas do checklist...</p>
                      </div>
                    ) : checklistRespostas && (checklistRespostas.grupos?.length > 0 || checklistRespostas.perguntas?.length > 0) && (
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <FileSignature className="h-4 w-4" />
                          Respostas do Formulário
                          {checklistRespostas.respostas?.codigo_unico && (
                            <Badge variant="outline" className="ml-2 font-mono bg-violet-50 text-violet-700 border-violet-200">
                              #{checklistRespostas.respostas.codigo_unico}
                            </Badge>
                          )}
                        </h4>
                        
                        {/* Renderizar por grupos */}
                        {checklistRespostas.grupos?.map((grupo: any, grupoIdx: number) => {
                          const respostasObj = checklistRespostas.respostas?.respostas as any;
                          
                          return (
                            <div key={grupo.id} className="mb-4 border rounded-lg overflow-hidden">
                              <div className="bg-gray-100 px-3 py-2 font-medium text-sm border-b">
                                {grupo.nome}
                              </div>
                              <div className="p-3 space-y-3">
                                {(grupo.perguntas || []).map((pergunta: any, idx: number) => {
                                  const resposta = respostasObj?.[pergunta.id];
                                  
                                  return (
                                    <div key={pergunta.id} className="border rounded-lg p-3 bg-gray-50">
                                      <div className="flex items-start gap-2 mb-2">
                                        <Badge variant="outline" className="shrink-0 text-xs">
                                          {grupoIdx + 1}.{idx + 1}
                                        </Badge>
                                        <p className="text-sm font-medium">{pergunta.texto}</p>
                                      </div>
                                      <div className="ml-8">
                                        {!resposta ? (
                                          <span className="text-sm text-muted-foreground italic">Não respondida</span>
                                        ) : pergunta.tipo === "foto" ? (
                                          resposta.fotos && resposta.fotos.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                              {resposta.fotos.map((foto: any, fotoIdx: number) => (
                                                <div 
                                                  key={fotoIdx}
                                                  className="relative cursor-pointer group"
                                                  onClick={() => setImagemViewer({
                                                    open: true,
                                                    src: foto.url,
                                                    titulo: `Foto ${fotoIdx + 1} - ${pergunta.texto}`
                                                  })}
                                                >
                                                  <img
                                                    src={foto.url}
                                                    alt={`Foto ${fotoIdx + 1}`}
                                                    className="w-24 h-20 object-cover rounded border"
                                                  />
                                                  {(foto.data_hora || foto.dataHora) && (
                                                    <p className="text-[9px] text-muted-foreground mt-1 truncate max-w-24">
                                                      📅 {foto.data_hora || foto.dataHora}
                                                    </p>
                                                  )}
                                                  {foto.latitude && foto.longitude && (
                                                    <p className="text-[9px] text-muted-foreground truncate max-w-24">
                                                      📍 {foto.latitude.toFixed(4)}, {foto.longitude.toFixed(4)}
                                                    </p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-sm text-muted-foreground italic">Sem foto</span>
                                          )
                                        ) : pergunta.tipo === "assinatura" ? (
                                          resposta.assinatura_url ? (
                                            <div 
                                              className="cursor-pointer"
                                              onClick={() => setImagemViewer({
                                                open: true,
                                                src: resposta.assinatura_url,
                                                titulo: "Assinatura"
                                              })}
                                            >
                                              <img
                                                src={resposta.assinatura_url}
                                                alt="Assinatura"
                                                className="w-40 h-20 object-contain bg-white border rounded"
                                              />
                                              {resposta.assinatura_data_hora && (
                                                <p className="text-[9px] text-muted-foreground mt-1">
                                                  📅 {resposta.assinatura_data_hora}
                                                </p>
                                              )}
                                              {resposta.assinatura_latitude && resposta.assinatura_longitude && (
                                                <p className="text-[9px] text-muted-foreground">
                                                  📍 {resposta.assinatura_latitude.toFixed(4)}, {resposta.assinatura_longitude.toFixed(4)}
                                                </p>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-sm text-muted-foreground italic">Sem assinatura</span>
                                          )
                                        ) : pergunta.tipo === "sim_nao" ? (
                                          resposta.resposta === "sim" ? (
                                            <Badge className="bg-green-600">Sim</Badge>
                                          ) : resposta.resposta === "nao" ? (
                                            <Badge variant="secondary">Não</Badge>
                                          ) : (
                                            <span className="text-sm">{String(resposta.resposta || '-')}</span>
                                          )
                                        ) : (
                                          <span className="text-sm">{String(resposta.resposta || '-')}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog Visualizador de Imagem */}
        <Dialog open={imagemViewer.open} onOpenChange={(open) => setImagemViewer(prev => ({ ...prev, open }))}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95">
            <div className="relative flex flex-col h-full min-h-[70vh]">
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    <p className="font-medium">{imagemViewer.titulo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20"
                      onClick={() => {
                        if (imagemViewer.src) {
                          // Abrir em nova guia
                          if (imagemViewer.src.startsWith('data:')) {
                            const newWindow = window.open('', '_blank');
                            if (newWindow) {
                              newWindow.document.write(`
                                <html>
                                  <head><title>${imagemViewer.titulo}</title></head>
                                  <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a;">
                                    <img src="${imagemViewer.src}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
                                  </body>
                                </html>
                              `);
                              newWindow.document.close();
                            }
                          } else {
                            window.open(imagemViewer.src, '_blank');
                          }
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Nova guia
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20"
                      onClick={() => {
                        if (imagemViewer.src) {
                          const link = document.createElement('a');
                          link.href = imagemViewer.src;
                          link.download = `${imagemViewer.titulo.replace(/\s+/g, '_')}_${Date.now()}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      onClick={() => setImagemViewer(prev => ({ ...prev, open: false }))}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Imagem */}
              <div className="flex-1 flex items-center justify-center p-4 pt-20 pb-8">
                {imagemViewer.src && (
                  <img
                    src={imagemViewer.src}
                    alt={imagemViewer.titulo}
                    className="max-w-full max-h-[75vh] object-contain rounded-lg"
                  />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Seleção de Rastros - Robusto com múltiplas opções */}
        <Dialog open={dialogRastros} onOpenChange={(open) => {
          setDialogRastros(open);
          if (!open) {
            setBuscaRastro("");
            setRastrosSelecionados([]);
            setModoSelecaoRastros("individual");
            setRangeInicio("");
            setRangeFim("");
            setImportarTexto("");
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Selecionar Rastros
              </DialogTitle>
              <DialogDescription>
                Selecione os rastros disponíveis em estoque para este material
              </DialogDescription>
            </DialogHeader>

            {itemTemp.material_id && (() => {
              const material = materiais?.find((m: any) => m.id === itemTemp.material_id);
              
              // Filtrar rastros que já estão na entrega
              const rastrosJaAdicionados = novaEntrega.itens
                .filter(i => i.material_id === itemTemp.material_id && i.numero_serie)
                .map(i => i.numero_serie);
              
              const rastrosDisponiveisFiltrados = rastrosDisponiveis?.filter(
                (r: any) => !rastrosJaAdicionados.includes(r.numero_serie)
              ) || [];
              
              const handleAdicionarRastros = () => {
                if (rastrosSelecionados.length === 0) {
                  toast.error("Selecione pelo menos um rastro");
                  return;
                }

                // Verificar se algum rastro já está na lista
                const duplicados = rastrosSelecionados.filter(rs => 
                  novaEntrega.itens.some(i => i.numero_serie === rs)
                );
                
                if (duplicados.length > 0) {
                  toast.error(`Rastro(s) já adicionado(s): ${duplicados.join(", ")}`);
                  return;
                }

                // Adicionar todos os rastros selecionados
                const novosItens = rastrosSelecionados.map(ns => ({
                  material_id: itemTemp.material_id,
                  quantidade: 1,
                  numero_serie: ns,
                  material: material,
                }));

                setNovaEntrega({
                  ...novaEntrega,
                  itens: [...novaEntrega.itens, ...novosItens],
                });

                toast.success(`${rastrosSelecionados.length} rastro(s) adicionado(s)`);
                setDialogRastros(false);
                setRastrosSelecionados([]);
                setItemTemp({ material_id: "", quantidade: 1, numero_serie: "" });
                setBuscaMaterial("");
              };

              const handleSelecionarRange = () => {
                if (!rangeInicio || !rangeFim) {
                  toast.error("Preencha o início e fim do range");
                  return;
                }

                const disponiveis = rastrosDisponiveisFiltrados.map((r: any) => r.numero_serie).sort();
                const inicioIdx = disponiveis.findIndex((ns: string) => ns >= rangeInicio);
                const fimIdx = disponiveis.findIndex((ns: string) => ns > rangeFim);
                
                if (inicioIdx === -1) {
                  toast.error("Nenhum rastro encontrado no range especificado");
                  return;
                }

                const rastrosNoRange = disponiveis.slice(
                  inicioIdx, 
                  fimIdx === -1 ? undefined : fimIdx
                );

                if (rastrosNoRange.length === 0) {
                  toast.error("Nenhum rastro encontrado no range especificado");
                  return;
                }

                setRastrosSelecionados(prev => {
                  const novos = rastrosNoRange.filter((r: string) => !prev.includes(r));
                  return [...prev, ...novos];
                });

                toast.success(`${rastrosNoRange.length} rastro(s) selecionado(s) do range`);
              };

              const handleImportarRastros = () => {
                if (!importarTexto.trim()) {
                  toast.error("Cole os números de série para importar");
                  return;
                }

                // Separar por vírgula, ponto-e-vírgula, tab ou quebra de linha
                const rastrosImportados = importarTexto
                  .split(/[,;\t\n]+/)
                  .map(r => r.trim().toUpperCase())
                  .filter(r => r.length > 0);

                const disponiveis = rastrosDisponiveisFiltrados.map((r: any) => r.numero_serie);
                const validos: string[] = [];
                const invalidos: string[] = [];

                rastrosImportados.forEach(r => {
                  if (disponiveis.includes(r)) {
                    if (!rastrosSelecionados.includes(r)) {
                      validos.push(r);
                    }
                  } else {
                    invalidos.push(r);
                  }
                });

                if (invalidos.length > 0) {
                  toast.error(`Rastros não encontrados em estoque: ${invalidos.slice(0, 3).join(", ")}${invalidos.length > 3 ? ` e mais ${invalidos.length - 3}` : ""}`);
                }

                if (validos.length > 0) {
                  setRastrosSelecionados(prev => [...prev, ...validos]);
                  toast.success(`${validos.length} rastro(s) importado(s)`);
                  setImportarTexto("");
                }
              };

              const toggleRastro = (numeroSerie: string) => {
                setRastrosSelecionados(prev => 
                  prev.includes(numeroSerie)
                    ? prev.filter(r => r !== numeroSerie)
                    : [...prev, numeroSerie]
                );
              };

              const selecionarTodos = () => {
                const filtrados = rastrosDisponiveisFiltrados
                  .filter((rastro: any) => {
                    if (!buscaRastro) return true;
                    const term = buscaRastro.toLowerCase();
                    return (
                      rastro.numero_serie.toLowerCase().includes(term) ||
                      rastro.lote?.toLowerCase().includes(term)
                    );
                  })
                  .map((r: any) => r.numero_serie);
                
                setRastrosSelecionados(filtrados);
              };

              const deselecionarTodos = () => {
                setRastrosSelecionados([]);
              };
              
              return (
                <div className="space-y-4">
                  {/* Info do material */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{material?.codigo}</p>
                      <p className="text-xs text-muted-foreground">{material?.nome}</p>
                    </div>
                    <Badge variant="secondary">
                      {rastrosDisponiveisFiltrados.length} disponíveis
                    </Badge>
                  </div>

                  {/* Tabs de modo de seleção */}
                  <div className="flex gap-1 p-1 bg-muted rounded-lg">
                    <Button
                      type="button"
                      variant={modoSelecaoRastros === "individual" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setModoSelecaoRastros("individual")}
                    >
                      Individual
                    </Button>
                    <Button
                      type="button"
                      variant={modoSelecaoRastros === "multiplo" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setModoSelecaoRastros("multiplo")}
                    >
                      Múltiplo
                    </Button>
                    <Button
                      type="button"
                      variant={modoSelecaoRastros === "range" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setModoSelecaoRastros("range")}
                    >
                      Range
                    </Button>
                    <Button
                      type="button"
                      variant={modoSelecaoRastros === "importar" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setModoSelecaoRastros("importar")}
                    >
                      Importar
                    </Button>
                  </div>

                  {/* Modo Range */}
                  {modoSelecaoRastros === "range" && (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <p className="text-sm font-medium">Selecionar por Range</p>
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="Início (ex: MED001)"
                          value={rangeInicio}
                          onChange={(e) => setRangeInicio(e.target.value.toUpperCase())}
                          className="flex-1"
                        />
                        <span className="text-muted-foreground">até</span>
                        <Input
                          placeholder="Fim (ex: MED010)"
                          value={rangeFim}
                          onChange={(e) => setRangeFim(e.target.value.toUpperCase())}
                          className="flex-1"
                        />
                        <Button type="button" onClick={handleSelecionarRange}>
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Seleciona todos os rastros disponíveis entre o início e fim especificados
                      </p>
                    </div>
                  )}

                  {/* Modo Importar */}
                  {modoSelecaoRastros === "importar" && (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <p className="text-sm font-medium">Importar Lista de Rastros</p>
                      <Textarea
                        placeholder="Cole aqui os números de série separados por vírgula, ponto-e-vírgula, tab ou quebra de linha..."
                        value={importarTexto}
                        onChange={(e) => setImportarTexto(e.target.value)}
                        rows={4}
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">
                          Ex: MED001, MED002, MED003 ou um por linha
                        </p>
                        <Button type="button" onClick={handleImportarRastros}>
                          Importar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Lista de rastros (Individual/Múltiplo) */}
                  {(modoSelecaoRastros === "individual" || modoSelecaoRastros === "multiplo") && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar por número de série ou lote..."
                            value={buscaRastro}
                            onChange={(e) => setBuscaRastro(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        {modoSelecaoRastros === "multiplo" && (
                          <div className="flex gap-1">
                            <Button type="button" variant="outline" size="sm" onClick={selecionarTodos}>
                              Todos
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={deselecionarTodos}>
                              Limpar
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="max-h-64 overflow-y-auto border rounded-lg">
                        {rastrosDisponiveisFiltrados && rastrosDisponiveisFiltrados.length > 0 ? (
                          <div className="divide-y">
                            {rastrosDisponiveisFiltrados
                              .filter((rastro: any) => {
                                if (!buscaRastro) return true;
                                const term = buscaRastro.toLowerCase();
                                return (
                                  rastro.numero_serie.toLowerCase().includes(term) ||
                                  rastro.lote?.toLowerCase().includes(term)
                                );
                              })
                              .map((rastro: any) => {
                                const selecionado = rastrosSelecionados.includes(rastro.numero_serie);
                                return (
                                  <button
                                    key={rastro.id}
                                    type="button"
                                    className={`w-full p-3 text-left hover:bg-muted/50 transition-all ${
                                      selecionado
                                        ? "bg-violet-100 border-l-4 border-l-violet-500"
                                        : ""
                                    }`}
                                    onClick={() => {
                                      if (modoSelecaoRastros === "individual") {
                                        // Modo individual: seleciona e fecha
                                        setItemTemp({ ...itemTemp, numero_serie: rastro.numero_serie });
                                        setDialogRastros(false);
                                        setBuscaRastro("");
                                      } else {
                                        // Modo múltiplo: toggle seleção
                                        toggleRastro(rastro.numero_serie);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        {modoSelecaoRastros === "multiplo" && (
                                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                            selecionado ? "bg-violet-500 border-violet-500" : "border-gray-300"
                                          }`}>
                                            {selecionado && <CheckCircle className="h-3 w-3 text-white" />}
                                          </div>
                                        )}
                                        <div>
                                          <p className={`text-sm font-mono ${selecionado ? "text-violet-700 font-bold" : "font-medium"}`}>
                                            {rastro.numero_serie}
                                          </p>
                                          {rastro.lote && (
                                            <p className="text-xs text-muted-foreground">Lote: {rastro.lote}</p>
                                          )}
                                        </div>
                                      </div>
                                      <QrCode className={`h-4 w-4 ${selecionado ? "text-violet-600" : "text-muted-foreground"}`} />
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            {buscaRastro ? "Nenhum rastro encontrado" : "Nenhum rastro disponível em estoque"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rastros selecionados (modo múltiplo, range ou importar) */}
                  {(modoSelecaoRastros !== "individual" && rastrosSelecionados.length > 0) && (
                    <div className="p-3 border rounded-lg bg-green-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-green-700">
                          {rastrosSelecionados.length} rastro(s) selecionado(s)
                        </p>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 h-6"
                          onClick={deselecionarTodos}
                        >
                          Limpar
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {rastrosSelecionados.slice(0, 10).map(rs => (
                          <Badge key={rs} variant="secondary" className="text-xs">
                            {rs}
                            <button
                              type="button"
                              className="ml-1 hover:text-red-600"
                              onClick={() => toggleRastro(rs)}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                        {rastrosSelecionados.length > 10 && (
                          <Badge variant="outline" className="text-xs">
                            +{rastrosSelecionados.length - 10} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setDialogRastros(false);
                      setBuscaRastro("");
                      setRastrosSelecionados([]);
                    }}>
                      Cancelar
                    </Button>
                    {modoSelecaoRastros !== "individual" && (
                      <Button 
                        type="button"
                        onClick={handleAdicionarRastros}
                        disabled={rastrosSelecionados.length === 0}
                      >
                        Adicionar {rastrosSelecionados.length > 0 ? `(${rastrosSelecionados.length})` : ""}
                      </Button>
                    )}
                  </DialogFooter>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Dialog de Cancelamento */}
        <AlertDialog open={cancelDialog} onOpenChange={setCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Entrega</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja cancelar esta entrega? Os materiais serão devolvidos ao
                estoque central.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Não</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedEntrega && cancelarEntregaMutation.mutate(selectedEntrega)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sim, Cancelar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}

