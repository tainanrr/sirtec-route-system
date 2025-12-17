import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Package,
  ArrowLeft,
  Plus,
  Minus,
  Zap,
  QrCode,
  Camera,
  CheckCircle,
  Trash2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MaterialAplicado {
  id: string;
  material_id: string;
  quantidade: number;
  tipo: "aplicado" | "retirado";
  numero_serie: string | null;
  observacao: string | null;
  created_at: string;
  materiais: {
    codigo: string;
    nome: string;
    unidade: string;
    requer_serial: boolean;
  };
}

interface EstoqueItem {
  material_id: string;
  quantidade: number;
  materiais: {
    id: string;
    codigo: string;
    nome: string;
    unidade: string;
    requer_serial: boolean;
  };
}

export default function AppMateriaisOS() {
  const { id: ordemId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoOperacao, setTipoOperacao] = useState<"aplicar" | "retirar">("aplicar");
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    material_id: "",
    quantidade: 1,
    numero_serie: "",
    observacao: "",
  });

  const equipeId = equipe?.id || equipeAuth?.id;

  // Query para dados da OS
  const { data: ordem } = useQuery({
    queryKey: ["ordem-materiais", ordemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("numero, tipo, endereco, cliente_nome")
        .eq("id", ordemId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId,
  });

  // Query para materiais aplicados/retirados na OS
  const { data: materiaisOS, isLoading: loadingMateriaisOS } = useQuery({
    queryKey: ["materiais-os", ordemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_aplicados_os")
        .select(`
          id,
          material_id,
          quantidade,
          tipo,
          numero_serie,
          observacao,
          created_at,
          materiais (codigo, nome, unidade, requer_serial)
        `)
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MaterialAplicado[];
    },
    enabled: !!ordemId,
  });

  // Query para estoque da equipe
  const { data: estoqueEquipe } = useQuery({
    queryKey: ["estoque-equipe-os", equipeId],
    queryFn: async () => {
      if (!equipeId) return [];

      const { data, error } = await supabase
        .from("materiais_estoque")
        .select(`
          material_id,
          quantidade,
          materiais!inner (
            id,
            codigo,
            nome,
            unidade,
            requer_serial
          )
        `)
        .eq("local_tipo", "equipe")
        .eq("local_id", equipeId)
        .gt("quantidade", 0);

      if (error) throw error;
      return data as EstoqueItem[];
    },
    enabled: !!equipeId,
  });

  // Mutation para aplicar/retirar material
  const aplicarMutation = useMutation({
    mutationFn: async (data: typeof formData & { tipo: "aplicado" | "retirado" }) => {
      const material = estoqueEquipe?.find((e) => e.material_id === data.material_id);
      
      if (data.tipo === "aplicado") {
        // Verificar estoque
        if (!material || material.quantidade < data.quantidade) {
          throw new Error("Quantidade insuficiente em estoque");
        }

        // Dar baixa no estoque da equipe
        const { data: estoqueAtual } = await supabase
          .from("materiais_estoque")
          .select("id, quantidade")
          .eq("material_id", data.material_id)
          .eq("local_tipo", "equipe")
          .eq("local_id", equipeId)
          .single();

        if (estoqueAtual) {
          await supabase
            .from("materiais_estoque")
            .update({ quantidade: estoqueAtual.quantidade - data.quantidade })
            .eq("id", estoqueAtual.id);
        }
      }

      // Registrar aplicação/retirada
      const { error } = await supabase.from("materiais_aplicados_os").insert({
        ordem_servico_id: ordemId,
        material_id: data.material_id,
        quantidade: data.quantidade,
        tipo: data.tipo,
        numero_serie: data.numero_serie || null,
        observacao: data.observacao || null,
        equipe_id: equipeId,
      });

      if (error) throw error;

      // Registrar movimentação
      await supabase.from("materiais_movimentacoes").insert({
        material_id: data.material_id,
        tipo: data.tipo === "aplicado" ? "saida" : "entrada",
        quantidade: data.quantidade,
        local_origem_tipo: data.tipo === "aplicado" ? "equipe" : "campo",
        local_origem_id: data.tipo === "aplicado" ? equipeId : ordemId,
        local_destino_tipo: data.tipo === "aplicado" ? "campo" : "equipe",
        local_destino_id: data.tipo === "aplicado" ? ordemId : equipeId,
        ordem_servico_id: ordemId,
        observacao: `${data.tipo === "aplicado" ? "Aplicado" : "Retirado"} na OS #${ordem?.numero}`,
      });

      // Se for item serializado, atualizar status
      if (data.numero_serie) {
        await supabase
          .from("materiais_serializados")
          .update({
            status: data.tipo === "aplicado" ? "instalado" : "retirado",
            localizacao_tipo: data.tipo === "aplicado" ? "campo" : "equipe",
            localizacao_id: data.tipo === "aplicado" ? ordemId : equipeId,
            ordem_servico_id: data.tipo === "aplicado" ? ordemId : null,
          })
          .eq("numero_serie", data.numero_serie);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais-os", ordemId] });
      queryClient.invalidateQueries({ queryKey: ["estoque-equipe-os", equipeId] });
      toast.success(tipoOperacao === "aplicar" ? "Material aplicado!" : "Material retirado!");
      setDialogOpen(false);
      setFormData({ material_id: "", quantidade: 1, numero_serie: "", observacao: "" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao registrar material");
    },
  });

  // Mutation para remover registro
  const removerMutation = useMutation({
    mutationFn: async (item: MaterialAplicado) => {
      // Se foi aplicado, devolver ao estoque
      if (item.tipo === "aplicado") {
        const { data: estoqueAtual } = await supabase
          .from("materiais_estoque")
          .select("id, quantidade")
          .eq("material_id", item.material_id)
          .eq("local_tipo", "equipe")
          .eq("local_id", equipeId)
          .maybeSingle();

        if (estoqueAtual) {
          await supabase
            .from("materiais_estoque")
            .update({ quantidade: estoqueAtual.quantidade + item.quantidade })
            .eq("id", estoqueAtual.id);
        } else {
          await supabase.from("materiais_estoque").insert({
            material_id: item.material_id,
            quantidade: item.quantidade,
            local_tipo: "equipe",
            local_id: equipeId,
          });
        }
      }

      // Remover registro
      const { error } = await supabase
        .from("materiais_aplicados_os")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais-os", ordemId] });
      queryClient.invalidateQueries({ queryKey: ["estoque-equipe-os", equipeId] });
      toast.success("Registro removido!");
    },
    onError: () => {
      toast.error("Erro ao remover registro");
    },
  });

  const handleOpenDialog = (tipo: "aplicar" | "retirar") => {
    setTipoOperacao(tipo);
    setFormData({ material_id: "", quantidade: 1, numero_serie: "", observacao: "" });
    setSearchTerm("");
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material_id) {
      toast.error("Selecione um material");
      return;
    }
    if (formData.quantidade <= 0) {
      toast.error("Quantidade inválida");
      return;
    }

    const material = estoqueEquipe?.find((e) => e.material_id === formData.material_id);
    if (material?.materiais.requer_serial && !formData.numero_serie) {
      toast.error("Este material requer número de série");
      return;
    }

    aplicarMutation.mutate({
      ...formData,
      tipo: tipoOperacao === "aplicar" ? "aplicado" : "retirado",
    });
  };

  // Filtrar estoque para seleção
  const estoqueFiltrado = estoqueEquipe?.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.materiais.codigo.toLowerCase().includes(term) ||
      item.materiais.nome.toLowerCase().includes(term)
    );
  });

  // Separar materiais aplicados e retirados
  const materiaisAplicados = materiaisOS?.filter((m) => m.tipo === "aplicado") || [];
  const materiaisRetirados = materiaisOS?.filter((m) => m.tipo === "retirado") || [];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-violet-600" />
              Materiais da OS
            </h1>
            {ordem && (
              <p className="text-xs text-muted-foreground">
                OS #{ordem.numero} - {ordem.tipo}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Botões de Ação */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-16 flex-col gap-1 border-green-200 hover:bg-green-50 hover:border-green-300"
            onClick={() => handleOpenDialog("aplicar")}
          >
            <Plus className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">Aplicar Material</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex-col gap-1 border-orange-200 hover:bg-orange-50 hover:border-orange-300"
            onClick={() => handleOpenDialog("retirar")}
          >
            <Minus className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-700">Retirar Material</span>
          </Button>
        </div>

        {/* Tabs de Materiais */}
        <Tabs defaultValue="aplicados" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="aplicados" className="gap-2">
              <Plus className="h-4 w-4" />
              Aplicados ({materiaisAplicados.length})
            </TabsTrigger>
            <TabsTrigger value="retirados" className="gap-2">
              <Minus className="h-4 w-4" />
              Retirados ({materiaisRetirados.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="aplicados" className="mt-4">
            {loadingMateriaisOS ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : materiaisAplicados.length > 0 ? (
              <div className="space-y-2">
                {materiaisAplicados.map((item) => (
                  <Card key={item.id} className="border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            {item.materiais.requer_serial ? (
                              <Zap className="h-5 w-5 text-green-600" />
                            ) : (
                              <Package className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.materiais.codigo}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.materiais.nome}
                            </p>
                            {item.numero_serie && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                <QrCode className="h-3 w-3 mr-1" />
                                {item.numero_serie}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(item.created_at), "dd/MM HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-700 border-0">
                            {item.quantidade} {item.materiais.unidade}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removerMutation.mutate(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum material aplicado</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="retirados" className="mt-4">
            {loadingMateriaisOS ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : materiaisRetirados.length > 0 ? (
              <div className="space-y-2">
                {materiaisRetirados.map((item) => (
                  <Card key={item.id} className="border-orange-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            {item.materiais.requer_serial ? (
                              <Zap className="h-5 w-5 text-orange-600" />
                            ) : (
                              <Package className="h-5 w-5 text-orange-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.materiais.codigo}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.materiais.nome}
                            </p>
                            {item.numero_serie && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                <QrCode className="h-3 w-3 mr-1" />
                                {item.numero_serie}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(item.created_at), "dd/MM HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-orange-100 text-orange-700 border-0">
                            {item.quantidade} {item.materiais.unidade}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removerMutation.mutate(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum material retirado</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de Aplicar/Retirar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tipoOperacao === "aplicar" ? (
                <>
                  <Plus className="h-5 w-5 text-green-600" />
                  Aplicar Material
                </>
              ) : (
                <>
                  <Minus className="h-5 w-5 text-orange-600" />
                  Retirar Material
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Busca de Material */}
            <div className="space-y-2">
              <Label>Material *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar material..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Lista de Materiais */}
            {tipoOperacao === "aplicar" && (
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {estoqueFiltrado && estoqueFiltrado.length > 0 ? (
                  <div className="divide-y">
                    {estoqueFiltrado.map((item) => (
                      <button
                        key={item.material_id}
                        type="button"
                        className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                          formData.material_id === item.material_id ? "bg-violet-50" : ""
                        }`}
                        onClick={() =>
                          setFormData({ ...formData, material_id: item.material_id })
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{item.materiais.codigo}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.materiais.nome}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {item.quantidade} {item.materiais.unidade}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {searchTerm ? "Nenhum material encontrado" : "Seu estoque está vazio"}
                  </div>
                )}
              </div>
            )}

            {/* Quantidade */}
            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantidade}
                onChange={(e) =>
                  setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })
                }
              />
            </div>

            {/* Número de Série (se necessário) */}
            {formData.material_id && (
              (() => {
                const material = estoqueEquipe?.find(
                  (e) => e.material_id === formData.material_id
                );
                if (material?.materiais.requer_serial) {
                  return (
                    <div className="space-y-2">
                      <Label>Número de Série *</Label>
                      <div className="flex gap-2">
                        <Input
                          value={formData.numero_serie}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              numero_serie: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="Ex: MED2024001234"
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" size="icon">
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()
            )}

            {/* Observação */}
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
              <Button
                type="submit"
                disabled={aplicarMutation.isPending}
                className={
                  tipoOperacao === "aplicar"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-orange-600 hover:bg-orange-700"
                }
              >
                {aplicarMutation.isPending
                  ? "Salvando..."
                  : tipoOperacao === "aplicar"
                  ? "Aplicar"
                  : "Retirar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

