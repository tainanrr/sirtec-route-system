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
  Truck,
  Plus,
  Search,
  ArrowLeft,
  Package,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Calendar,
  Trash2,
  ClipboardCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

interface RecebimentoItem {
  material_id: string;
  quantidade_esperada: number;
  quantidade_recebida?: number;
  observacao?: string;
  material?: {
    codigo: string;
    nome: string;
    unidade: string;
  };
}

interface Recebimento {
  id: string;
  numero_documento: string | null;
  data_recebimento: string;
  fornecedor: string | null;
  observacao: string | null;
  status: string;
  conferido_por: string | null;
  data_conferencia: string | null;
  created_at: string;
  itens?: RecebimentoItem[];
}

interface NovoRecebimentoForm {
  numero_documento: string;
  fornecedor: string;
  observacao: string;
  itens: RecebimentoItem[];
}

export default function Recebimentos() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [conferirDialog, setConferirDialog] = useState(false);
  const [selectedRecebimento, setSelectedRecebimento] = useState<Recebimento | null>(null);

  // Form para novo recebimento
  const [novoRecebimento, setNovoRecebimento] = useState<NovoRecebimentoForm>({
    numero_documento: "",
    fornecedor: "",
    observacao: "",
    itens: [],
  });
  const [itemTemp, setItemTemp] = useState({ material_id: "", quantidade: 1 });

  // Form para conferência
  const [conferencia, setConferencia] = useState<Record<string, number>>({});

  // Query para recebimentos
  const { data: recebimentos, isLoading } = useQuery({
    queryKey: ["recebimentos", filtroStatus, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("materiais_recebimentos")
        .select("*")
        .order("created_at", { ascending: false });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Buscar itens de cada recebimento
      const recebimentosComItens = await Promise.all(
        (data || []).map(async (rec: any) => {
          const { data: itens } = await supabase
            .from("materiais_recebimentos_itens")
            .select(`
              material_id,
              quantidade_esperada,
              quantidade_recebida,
              observacao,
              materiais (codigo, nome, unidade)
            `)
            .eq("recebimento_id", rec.id);

          return {
            ...rec,
            itens: itens?.map((item: any) => ({
              material_id: item.material_id,
              quantidade_esperada: item.quantidade_esperada,
              quantidade_recebida: item.quantidade_recebida,
              observacao: item.observacao,
              material: item.materiais,
            })) || [],
          };
        })
      );

      // Filtrar por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return recebimentosComItens.filter(
          (r: any) =>
            r.numero_documento?.toLowerCase().includes(term) ||
            r.fornecedor?.toLowerCase().includes(term)
        );
      }

      return recebimentosComItens as Recebimento[];
    },
  });

  // Query para materiais
  const { data: materiais } = useQuery({
    queryKey: ["materiais-ativos-recebimento"],
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

  // Mutation para criar recebimento
  const criarRecebimentoMutation = useMutation({
    mutationFn: async (form: NovoRecebimentoForm) => {
      // Criar recebimento
      const { data: recebimento, error: recError } = await supabase
        .from("materiais_recebimentos")
        .insert({
          numero_documento: form.numero_documento || null,
          fornecedor: form.fornecedor || null,
          observacao: form.observacao || null,
          status: "pendente",
        })
        .select()
        .single();

      if (recError) throw recError;

      // Criar itens
      const itensPayload = form.itens.map((item) => ({
        recebimento_id: recebimento.id,
        material_id: item.material_id,
        quantidade_esperada: item.quantidade_esperada,
      }));

      const { error: itensError } = await supabase
        .from("materiais_recebimentos_itens")
        .insert(itensPayload);

      if (itensError) throw itensError;

      return recebimento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      toast.success("Recebimento registrado!");
      setDialogOpen(false);
      setNovoRecebimento({ numero_documento: "", fornecedor: "", observacao: "", itens: [] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao registrar recebimento");
    },
  });

  // Mutation para conferir recebimento
  const conferirMutation = useMutation({
    mutationFn: async ({ recebimento, quantidades }: { recebimento: Recebimento; quantidades: Record<string, number> }) => {
      // Atualizar quantidades recebidas
      for (const item of recebimento.itens || []) {
        const qtdRecebida = quantidades[item.material_id] || 0;

        await supabase
          .from("materiais_recebimentos_itens")
          .update({ quantidade_recebida: qtdRecebida })
          .eq("recebimento_id", recebimento.id)
          .eq("material_id", item.material_id);

        // Dar entrada no estoque
        if (qtdRecebida > 0) {
          const { data: estoqueAtual } = await supabase
            .from("materiais_estoque")
            .select("id, quantidade")
            .eq("material_id", item.material_id)
            .eq("local_tipo", "central")
            .maybeSingle();

          if (estoqueAtual) {
            await supabase
              .from("materiais_estoque")
              .update({ quantidade: estoqueAtual.quantidade + qtdRecebida })
              .eq("id", estoqueAtual.id);
          } else {
            await supabase.from("materiais_estoque").insert({
              material_id: item.material_id,
              quantidade: qtdRecebida,
              local_tipo: "central",
            });
          }

          // Registrar movimentação
          await supabase.from("materiais_movimentacoes").insert({
            material_id: item.material_id,
            tipo: "entrada",
            quantidade: qtdRecebida,
            quantidade_anterior: estoqueAtual?.quantidade || 0,
            quantidade_nova: (estoqueAtual?.quantidade || 0) + qtdRecebida,
            local_origem_tipo: "externo",
            local_destino_tipo: "central",
            documento_referencia: recebimento.numero_documento,
            observacao: `Recebimento ${recebimento.fornecedor || ""}`,
          });
        }
      }

      // Atualizar status do recebimento
      await supabase
        .from("materiais_recebimentos")
        .update({
          status: "finalizado",
          data_conferencia: new Date().toISOString(),
        })
        .eq("id", recebimento.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-central"] });
      toast.success("Recebimento conferido e estoque atualizado!");
      setConferirDialog(false);
      setSelectedRecebimento(null);
      setConferencia({});
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao conferir recebimento");
    },
  });

  const handleAddItem = () => {
    if (!itemTemp.material_id || itemTemp.quantidade <= 0) {
      toast.error("Selecione um material e quantidade válida");
      return;
    }

    const existe = novoRecebimento.itens.find((i) => i.material_id === itemTemp.material_id);
    if (existe) {
      toast.error("Material já adicionado");
      return;
    }

    const material = materiais?.find((m: any) => m.id === itemTemp.material_id);

    setNovoRecebimento({
      ...novoRecebimento,
      itens: [
        ...novoRecebimento.itens,
        {
          material_id: itemTemp.material_id,
          quantidade_esperada: itemTemp.quantidade,
          material,
        },
      ],
    });
    setItemTemp({ material_id: "", quantidade: 1 });
  };

  const handleRemoveItem = (materialId: string) => {
    setNovoRecebimento({
      ...novoRecebimento,
      itens: novoRecebimento.itens.filter((i) => i.material_id !== materialId),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (novoRecebimento.itens.length === 0) {
      toast.error("Adicione pelo menos um material");
      return;
    }
    criarRecebimentoMutation.mutate(novoRecebimento);
  };

  const handleOpenConferir = (rec: Recebimento) => {
    setSelectedRecebimento(rec);
    const initialConf: Record<string, number> = {};
    rec.itens?.forEach((item) => {
      initialConf[item.material_id] = item.quantidade_esperada;
    });
    setConferencia(initialConf);
    setConferirDialog(true);
  };

  const handleConferir = () => {
    if (!selectedRecebimento) return;
    conferirMutation.mutate({ recebimento: selectedRecebimento, quantidades: conferencia });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge className="bg-amber-100 text-amber-700 border-0"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "conferido":
        return <Badge className="bg-blue-100 text-blue-700 border-0"><ClipboardCheck className="h-3 w-3 mr-1" />Conferido</Badge>;
      case "finalizado":
        return <Badge className="bg-green-100 text-green-700 border-0"><CheckCircle className="h-3 w-3 mr-1" />Finalizado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <MainLayout title="Recebimentos">
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
                <Truck className="h-6 w-6 text-orange-600" />
                Recebimentos
              </h1>
              <p className="text-muted-foreground text-sm">
                Materiais recebidos da concessionária e fornecedores
              </p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Recebimento
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
                    placeholder="Buscar por documento ou fornecedor..."
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
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : recebimentos && recebimentos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recebimentos.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {format(new Date(rec.data_recebimento), "dd/MM/yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(rec.data_recebimento), "HH:mm")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rec.numero_documento ? (
                          <Badge variant="outline">
                            <FileText className="h-3 w-3 mr-1" />
                            {rec.numero_documento}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rec.fornecedor || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{rec.itens?.length || 0} itens</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(rec.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedRecebimento(rec);
                              setViewDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {rec.status === "pendente" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => handleOpenConferir(rec)}
                            >
                              <ClipboardCheck className="h-4 w-4" />
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
                <p className="text-muted-foreground">Nenhum recebimento encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Recebimento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog Novo Recebimento */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Recebimento de Materiais</DialogTitle>
              <DialogDescription>
                Registre o recebimento de materiais da concessionária ou fornecedor
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº Documento / NF</Label>
                  <Input
                    value={novoRecebimento.numero_documento}
                    onChange={(e) =>
                      setNovoRecebimento({ ...novoRecebimento, numero_documento: e.target.value })
                    }
                    placeholder="Ex: NF-123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor / Origem</Label>
                  <Input
                    value={novoRecebimento.fornecedor}
                    onChange={(e) =>
                      setNovoRecebimento({ ...novoRecebimento, fornecedor: e.target.value })
                    }
                    placeholder="Ex: CPFL, Elektro..."
                  />
                </div>
              </div>

              {/* Adicionar itens */}
              <div className="space-y-4">
                <Label>Materiais</Label>
                <div className="flex gap-2">
                  <Select
                    value={itemTemp.material_id}
                    onValueChange={(value) => setItemTemp({ ...itemTemp, material_id: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione o material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materiais?.map((mat: any) => (
                        <SelectItem key={mat.id} value={mat.id}>
                          {mat.codigo} - {mat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Button type="button" onClick={handleAddItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {novoRecebimento.itens.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-center">Quantidade</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {novoRecebimento.itens.map((item) => (
                          <TableRow key={item.material_id}>
                            <TableCell>
                              <p className="font-medium">{item.material?.codigo}</p>
                              <p className="text-xs text-muted-foreground">{item.material?.nome}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.quantidade_esperada} {item.material?.unidade}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.material_id)}
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
                  value={novoRecebimento.observacao}
                  onChange={(e) =>
                    setNovoRecebimento({ ...novoRecebimento, observacao: e.target.value })
                  }
                  placeholder="Observações..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={criarRecebimentoMutation.isPending}>
                  {criarRecebimentoMutation.isPending ? "Salvando..." : "Registrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Visualização */}
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Recebimento</DialogTitle>
            </DialogHeader>

            {selectedRecebimento && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-medium">
                      {format(new Date(selectedRecebimento.data_recebimento), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedRecebimento.status)}
                  </div>
                  {selectedRecebimento.numero_documento && (
                    <div>
                      <p className="text-sm text-muted-foreground">Documento</p>
                      <p className="font-medium">{selectedRecebimento.numero_documento}</p>
                    </div>
                  )}
                  {selectedRecebimento.fornecedor && (
                    <div>
                      <p className="text-sm text-muted-foreground">Fornecedor</p>
                      <p className="font-medium">{selectedRecebimento.fornecedor}</p>
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
                          <TableHead className="text-center">Esperado</TableHead>
                          <TableHead className="text-center">Recebido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRecebimento.itens?.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <p className="font-medium">{item.material?.codigo}</p>
                              <p className="text-xs text-muted-foreground">{item.material?.nome}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.quantidade_esperada} {item.material?.unidade}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.quantidade_recebida !== undefined ? (
                                <Badge variant={item.quantidade_recebida === item.quantidade_esperada ? "default" : "destructive"}>
                                  {item.quantidade_recebida} {item.material?.unidade}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog Conferência */}
        <Dialog open={conferirDialog} onOpenChange={setConferirDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Conferir Recebimento</DialogTitle>
              <DialogDescription>
                Informe as quantidades efetivamente recebidas para dar entrada no estoque
              </DialogDescription>
            </DialogHeader>

            {selectedRecebimento && (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-center">Esperado</TableHead>
                        <TableHead className="text-center">Recebido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRecebimento.itens?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <p className="font-medium">{item.material?.codigo}</p>
                            <p className="text-xs text-muted-foreground">{item.material?.nome}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantidade_esperada}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={conferencia[item.material_id] || 0}
                              onChange={(e) =>
                                setConferencia({
                                  ...conferencia,
                                  [item.material_id]: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-20 mx-auto text-center"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setConferirDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConferir}
                    disabled={conferirMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {conferirMutation.isPending ? "Processando..." : "Confirmar Conferência"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

