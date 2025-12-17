import { useState } from "react";
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
  data_recebimento: string | null;
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

  // Form para nova entrega
  const [novaEntrega, setNovaEntrega] = useState<NovaEntregaForm>({
    equipe_id: "",
    observacao: "",
    itens: [],
  });
  const [itemTemp, setItemTemp] = useState({ material_id: "", quantidade: 1, numero_serie: "" });
  const [buscaMaterial, setBuscaMaterial] = useState("");

  // Query para entregas
  const { data: entregas, isLoading } = useQuery({
    queryKey: ["entregas-equipes", filtroStatus, filtroEquipe, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("materiais_entregas")
        .select(`
          *,
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
              materiais (codigo, nome, unidade)
            `)
            .eq("entrega_id", entrega.id);

          return {
            ...entrega,
            itens: itens?.map((item: any) => ({
              material_id: item.material_id,
              quantidade: item.quantidade,
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
        .select("id, codigo, nome, unidade")
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge className="bg-amber-100 text-amber-700 border-0"><Clock className="h-3 w-3 mr-1" />Aguardando Assinatura</Badge>;
      case "recebida":
        return <Badge className="bg-green-100 text-green-700 border-0"><CheckCircle className="h-3 w-3 mr-1" />Recebida</Badge>;
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
            ) : entregas && entregas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Recebimento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregas.map((entrega) => (
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
                        {entrega.status === "recebida" ? (
                          <div>
                            <p className="text-sm">{entrega.recebido_por}</p>
                            <p className="text-xs text-muted-foreground">
                              {entrega.data_recebimento &&
                                format(new Date(entrega.data_recebimento), "dd/MM HH:mm")}
                            </p>
                            {entrega.assinatura_recebimento && (
                              <Badge variant="outline" className="mt-1">
                                <FileSignature className="h-3 w-3 mr-1" />
                                Assinado
                              </Badge>
                            )}
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
                              setSelectedEntrega(entrega);
                              setViewDialog(true);
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
                  <SelectContent className="z-[100]">
                    {equipes?.map((eq: any) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.codigo} - {eq.nome}
                      </SelectItem>
                    ))}
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
                        <Input
                          placeholder="Nº Série/Rastro *"
                          value={itemTemp.numero_serie}
                          onChange={(e) =>
                            setItemTemp({ ...itemTemp, numero_serie: e.target.value.toUpperCase() })
                          }
                          className="flex-1"
                        />
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes da Entrega</DialogTitle>
            </DialogHeader>

            {selectedEntrega && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Data</p>
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
                  {selectedEntrega.status === "recebida" && (
                    <div>
                      <p className="text-sm text-muted-foreground">Recebido por</p>
                      <p className="font-medium">{selectedEntrega.recebido_por}</p>
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

                {selectedEntrega.assinatura_recebimento && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Assinatura</p>
                    <img
                      src={selectedEntrega.assinatura_recebimento}
                      alt="Assinatura"
                      className="max-h-32 border rounded"
                    />
                  </div>
                )}
              </div>
            )}
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

