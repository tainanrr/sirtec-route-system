import { useState, useRef, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Package,
  Search,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Zap,
  RefreshCw,
  History,
  ChevronRight,
  Camera,
  FileSignature,
  X,
  Trash2,
  MapPin,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";

interface EstoqueItem {
  id: string;
  material_id: string;
  quantidade: number;
  materiais: {
    id: string;
    codigo: string;
    nome: string;
    unidade: string;
    categoria: string;
    estoque_minimo: number;
    requer_serial: boolean;
  };
}

interface MovimentacaoRecente {
  id: string;
  tipo: string;
  quantidade: number;
  observacao: string | null;
  created_at: string;
  materiais: {
    codigo: string;
    nome: string;
    unidade: string;
  };
}

interface EntregaPendente {
  id: string;
  data_entrega: string;
  status: string;
  observacao: string | null;
  itens?: {
    material_id: string;
    quantidade: number;
    numero_serie?: string;
    materiais: {
      codigo: string;
      nome: string;
      unidade: string;
    };
  }[];
}

export default function AppEstoque() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Estado para confirmação de entrega
  const [dialogConfirmacao, setDialogConfirmacao] = useState(false);
  const [entregaSelecionada, setEntregaSelecionada] = useState<EntregaPendente | null>(null);
  const [fotoRecebimento, setFotoRecebimento] = useState<string | null>(null);
  const [assinaturaRecebimento, setAssinaturaRecebimento] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const equipeId = equipe?.id || equipeAuth?.id;

  // Query para estoque da equipe
  const { data: estoqueEquipe, isLoading } = useQuery({
    queryKey: ["estoque-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];

      const { data, error } = await supabase
        .from("materiais_estoque")
        .select(`
          id,
          material_id,
          quantidade,
          materiais!inner (
            id,
            codigo,
            nome,
            unidade,
            categoria,
            estoque_minimo,
            requer_serial
          )
        `)
        .eq("local_tipo", "equipe")
        .eq("local_id", equipeId)
        .gt("quantidade", 0)
        .order("materiais(codigo)");

      if (error) throw error;
      return data as EstoqueItem[];
    },
    enabled: !!equipeId,
  });

  // Query para movimentações recentes
  const { data: movimentacoesRecentes } = useQuery({
    queryKey: ["movimentacoes-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];

      const { data, error } = await supabase
        .from("materiais_movimentacoes")
        .select(`
          id,
          tipo,
          quantidade,
          observacao,
          created_at,
          materiais (codigo, nome, unidade)
        `)
        .or(`local_origem_id.eq.${equipeId},local_destino_id.eq.${equipeId}`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as MovimentacaoRecente[];
    },
    enabled: !!equipeId,
  });

  // Query para entregas pendentes com itens
  const { data: entregasPendentes } = useQuery({
    queryKey: ["entregas-pendentes-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];

      const { data, error } = await supabase
        .from("materiais_entregas")
        .select(`
          id,
          data_entrega,
          status,
          observacao
        `)
        .eq("equipe_id", equipeId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

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
            itens: itens || [],
          };
        })
      );

      return entregasComItens as EntregaPendente[];
    },
    enabled: !!equipeId,
  });

  // Mutation para confirmar recebimento
  const confirmarRecebimentoMutation = useMutation({
    mutationFn: async (data: {
      entrega_id: string;
      foto: string;
      assinatura: string;
      coordenadas: { lat: number; lng: number } | null;
    }) => {
      // Atualizar status da entrega
      const { error } = await supabase
        .from("materiais_entregas")
        .update({
          status: "confirmado",
          foto_recebimento: data.foto,
          assinatura_recebimento: data.assinatura,
          coordenadas_recebimento: data.coordenadas ? `${data.coordenadas.lat},${data.coordenadas.lng}` : null,
          data_confirmacao: new Date().toISOString(),
        })
        .eq("id", data.entrega_id);

      if (error) throw error;

      // Criar registro no checklist (se existir checklist de recebimento)
      const { data: checklistRecebimento } = await supabase
        .from("checklists")
        .select("id")
        .eq("tipo", "recebimento_materiais")
        .eq("ativo", true)
        .maybeSingle();

      if (checklistRecebimento) {
        await supabase.from("checklist_respostas").insert({
          checklist_id: checklistRecebimento.id,
          equipe_id: equipeId,
          status: "concluido",
          respostas: {
            entrega_id: data.entrega_id,
            foto_recebimento: data.foto,
            assinatura: data.assinatura,
            coordenadas: data.coordenadas,
            data_recebimento: new Date().toISOString(),
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas-pendentes-equipe"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-equipe"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-equipe"] });
      toast.success("Recebimento confirmado com sucesso!");
      setDialogConfirmacao(false);
      resetFormConfirmacao();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao confirmar recebimento");
    },
  });

  // Funções auxiliares
  const resetFormConfirmacao = () => {
    setEntregaSelecionada(null);
    setFotoRecebimento(null);
    setAssinaturaRecebimento(null);
    setCoordenadas(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleAbrirConfirmacao = async (entrega: EntregaPendente) => {
    setEntregaSelecionada(entrega);
    setDialogConfirmacao(true);
    
    // Capturar coordenadas
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoordenadas({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Não foi possível obter localização")
      );
    }
  };

  const handleTirarFoto = () => {
    inputFotoRef.current?.click();
  };

  const handleFotoCapturada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      
      // Adicionar data/hora e coordenadas na foto
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          // Adicionar texto
          const fontSize = Math.max(16, img.width / 40);
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.fillStyle = "white";
          ctx.strokeStyle = "black";
          ctx.lineWidth = 2;
          
          const dataHora = format(new Date(), "dd/MM/yyyy HH:mm:ss");
          const texto = coordenadas 
            ? `${dataHora} | ${coordenadas.lat.toFixed(6)}, ${coordenadas.lng.toFixed(6)}`
            : dataHora;
          
          const x = 10;
          const y = img.height - 10;
          
          ctx.strokeText(texto, x, y);
          ctx.fillText(texto, x, y);
          
          setFotoRecebimento(canvas.toDataURL("image/jpeg", 0.8));
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
    
    // Limpar input
    e.target.value = "";
  };

  // Funções de assinatura
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  useEffect(() => {
    if (dialogConfirmacao && canvasRef.current) {
      setTimeout(initCanvas, 100);
    }
  }, [dialogConfirmacao]);

  const getCanvasCoords = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const limparAssinatura = () => {
    initCanvas();
    setAssinaturaRecebimento(null);
  };

  const salvarAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Adicionar data/hora e coordenadas
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const fontSize = 10;
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = "#666";
      
      const dataHora = format(new Date(), "dd/MM/yyyy HH:mm:ss");
      const texto = coordenadas 
        ? `${dataHora} | ${coordenadas.lat.toFixed(6)}, ${coordenadas.lng.toFixed(6)}`
        : dataHora;
      
      ctx.fillText(texto, 5, canvas.height / (window.devicePixelRatio || 1) - 5);
    }
    
    setAssinaturaRecebimento(canvas.toDataURL("image/png"));
    toast.success("Assinatura salva!");
  };

  const handleConfirmarRecebimento = () => {
    if (!entregaSelecionada) return;
    
    if (!fotoRecebimento) {
      toast.error("Tire uma foto do recebimento");
      return;
    }
    
    if (!assinaturaRecebimento) {
      toast.error("Assine para confirmar o recebimento");
      return;
    }
    
    confirmarRecebimentoMutation.mutate({
      entrega_id: entregaSelecionada.id,
      foto: fotoRecebimento,
      assinatura: assinaturaRecebimento,
      coordenadas,
    });
  };

  // Filtrar estoque por busca
  const estoqueFiltrado = estoqueEquipe?.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.materiais.codigo.toLowerCase().includes(term) ||
      item.materiais.nome.toLowerCase().includes(term)
    );
  });

  // Calcular estatísticas
  const totalItens = estoqueEquipe?.length || 0;
  const itensBaixos = estoqueEquipe?.filter(
    (item) => item.quantidade <= item.materiais.estoque_minimo
  ).length || 0;

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
              <Package className="h-5 w-5 text-emerald-600" />
              Meu Estoque
            </h1>
            <p className="text-xs text-muted-foreground">
              Materiais disponíveis para uso
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Alertas de Entregas Pendentes */}
        {entregasPendentes && entregasPendentes.length > 0 && (
          <div className="space-y-2">
            {entregasPendentes.map((entrega) => (
              <Card 
                key={entrega.id}
                className="bg-amber-50 border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={() => handleAbrirConfirmacao(entrega)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <Package className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-800">
                        Entrega de {entrega.itens?.length || 0} material(is)
                      </p>
                      <p className="text-sm text-amber-700">
                        {format(new Date(entrega.data_entrega), "dd/MM/yyyy")} - Toque para confirmar
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Itens em Estoque</p>
                  <p className="text-2xl font-bold">{totalItens}</p>
                </div>
                <Package className="h-8 w-8 text-emerald-500 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className={itensBaixos > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Estoque Baixo</p>
                  <p className={`text-2xl font-bold ${itensBaixos > 0 ? "text-amber-600" : ""}`}>
                    {itensBaixos}
                  </p>
                </div>
                <AlertTriangle className={`h-8 w-8 ${itensBaixos > 0 ? "text-amber-500" : "text-gray-300"}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="estoque" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="estoque">Estoque</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="estoque" className="mt-4 space-y-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Lista de Materiais */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : estoqueFiltrado && estoqueFiltrado.length > 0 ? (
              <div className="space-y-2">
                {estoqueFiltrado.map((item) => {
                  const isBaixo = item.quantidade <= item.materiais.estoque_minimo;

                  return (
                    <Card
                      key={item.id}
                      className={isBaixo ? "border-amber-300 bg-amber-50/50" : ""}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isBaixo ? "bg-amber-100" : "bg-emerald-100"}`}>
                              {item.materiais.requer_serial ? (
                                <Zap className={`h-5 w-5 ${isBaixo ? "text-amber-600" : "text-emerald-600"}`} />
                              ) : (
                                <Package className={`h-5 w-5 ${isBaixo ? "text-amber-600" : "text-emerald-600"}`} />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{item.materiais.codigo}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {item.materiais.nome}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xl font-bold ${isBaixo ? "text-amber-600" : ""}`}>
                              {item.quantidade}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.materiais.unidade}
                            </p>
                          </div>
                        </div>
                        {isBaixo && (
                          <div className="mt-2 flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-xs">Estoque baixo (mín: {item.materiais.estoque_minimo})</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">
                    {searchTerm ? "Nenhum material encontrado" : "Seu estoque está vazio"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {movimentacoesRecentes && movimentacoesRecentes.length > 0 ? (
              <div className="space-y-2">
                {movimentacoesRecentes.map((mov) => (
                  <Card key={mov.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          mov.tipo === "entrada" || mov.tipo === "transferencia"
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}>
                          {mov.tipo === "entrada" || mov.tipo === "transferencia" ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Package className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {mov.materiais?.codigo} - {mov.materiais?.nome}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {mov.observacao || (mov.tipo === "entrada" ? "Recebimento" : "Aplicação/Saída")}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={mov.tipo === "entrada" || mov.tipo === "transferencia" ? "default" : "destructive"}>
                            {mov.tipo === "entrada" || mov.tipo === "transferencia" ? "+" : "-"}
                            {mov.quantidade}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(mov.created_at), "dd/MM HH:mm")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <History className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhuma movimentação recente</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Input oculto para foto */}
      <input
        ref={inputFotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFotoCapturada}
      />

      {/* Dialog de Confirmação de Recebimento */}
      <Dialog open={dialogConfirmacao} onOpenChange={(open) => {
        if (!open) resetFormConfirmacao();
        setDialogConfirmacao(open);
      }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-600" />
              Confirmar Recebimento
            </DialogTitle>
          </DialogHeader>

          {entregaSelecionada && (
            <div className="space-y-4">
              {/* Info da entrega */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Data: {format(new Date(entregaSelecionada.data_entrega), "dd/MM/yyyy")}
                    </span>
                  </div>
                  
                  <p className="text-sm font-medium mb-2">Materiais:</p>
                  <div className="space-y-2">
                    {entregaSelecionada.itens?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <p className="text-sm font-medium">{item.materiais?.codigo}</p>
                          <p className="text-xs text-muted-foreground">{item.materiais?.nome}</p>
                          {item.numero_serie && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              SN: {item.numero_serie}
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {item.quantidade} {item.materiais?.unidade}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  
                  {entregaSelecionada.observacao && (
                    <p className="text-sm text-muted-foreground mt-3">
                      Obs: {entregaSelecionada.observacao}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Coordenadas */}
              {coordenadas && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{coordenadas.lat.toFixed(6)}, {coordenadas.lng.toFixed(6)}</span>
                </div>
              )}

              {/* Foto do recebimento */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Foto do Recebimento *
                </Label>
                
                {fotoRecebimento ? (
                  <div className="relative">
                    <img 
                      src={fotoRecebimento} 
                      alt="Foto do recebimento" 
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => setFotoRecebimento(null)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-32 border-dashed"
                    onClick={handleTirarFoto}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tirar foto do recebimento</span>
                    </div>
                  </Button>
                )}
              </div>

              {/* Assinatura */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4" />
                  Assinatura *
                </Label>
                
                <div className="border rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    className="w-full touch-none"
                    style={{ height: "150px" }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={limparAssinatura}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={salvarAssinatura}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Salvar Assinatura
                  </Button>
                </div>
                
                {assinaturaRecebimento && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Assinatura salva
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    resetFormConfirmacao();
                    setDialogConfirmacao(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarRecebimento}
                  disabled={confirmarRecebimentoMutation.isPending || !fotoRecebimento || !assinaturaRecebimento}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {confirmarRecebimentoMutation.isPending ? "Confirmando..." : "Confirmar Recebimento"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

