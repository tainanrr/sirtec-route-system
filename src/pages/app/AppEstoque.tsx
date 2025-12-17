import { useState, useRef, useEffect, useCallback } from "react";
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
  Plus,
  Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { SignatureFullScreen } from "@/components/app/SignatureFullScreen";

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

interface FotoData {
  url: string;
  latitude?: number;
  longitude?: number;
  data_hora: string;
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
  const [fotosRecebimento, setFotosRecebimento] = useState<FotoData[]>([]);
  const [assinaturaRecebimento, setAssinaturaRecebimento] = useState<string | null>(null);
  const [assinaturaData, setAssinaturaData] = useState<{ data_hora: string; latitude?: number; longitude?: number } | null>(null);
  const [showSignatureScreen, setShowSignatureScreen] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  
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
      fotos: FotoData[];
      assinatura: string;
      assinatura_data: { data_hora: string; latitude?: number; longitude?: number } | null;
    }) => {
      // Preparar dados da foto (primeira foto como principal)
      const fotoPrincipal = data.fotos[0]?.url || null;
      const coordenadas = data.fotos[0] 
        ? `${data.fotos[0].latitude || 0},${data.fotos[0].longitude || 0}` 
        : null;

      // Atualizar status da entrega
      const { error } = await supabase
        .from("materiais_entregas")
        .update({
          status: "confirmado",
          foto_recebimento: fotoPrincipal,
          assinatura_recebimento: data.assinatura,
          coordenadas_recebimento: coordenadas,
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
            fotos: data.fotos,
            assinatura: data.assinatura,
            assinatura_data: data.assinatura_data,
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

  // Obter localização atual (mesmo padrão da APR)
  const getCurrentLocation = useCallback((): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn("[Estoque] Geolocalização não suportada");
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("[Estoque] Erro ao obter localização:", error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, []);

  // Adicionar carimbo na imagem (mesmo padrão da APR)
  const addImageStamp = useCallback((
    imageDataUrl: string,
    timestamp: string,
    coords: { latitude: number; longitude: number } | null
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        // Desenhar imagem original
        ctx.drawImage(img, 0, 0);

        // Configurar estilo do texto
        const fontSize = Math.max(14, Math.floor(img.width / 35));
        ctx.font = `bold ${fontSize}px Arial`;
        
        // Preparar textos
        const line1 = `📅 ${timestamp}`;
        const line2 = coords ? `📍 ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` : "📍 Sem GPS";
        
        // Medir textos
        const metrics1 = ctx.measureText(line1);
        const metrics2 = ctx.measureText(line2);
        const maxWidth = Math.max(metrics1.width, metrics2.width);
        const lineHeight = fontSize * 1.4;
        const padding = fontSize * 0.6;
        const boxHeight = lineHeight * 2 + padding * 2;
        const boxWidth = maxWidth + padding * 2;

        // Desenhar fundo semi-transparente no canto superior esquerdo
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, boxWidth, boxHeight);

        // Desenhar textos
        ctx.fillStyle = "#ffffff";
        ctx.fillText(line1, padding, padding + fontSize);
        ctx.fillText(line2, padding, padding + fontSize + lineHeight);

        // Converter para base64
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      
      img.onerror = () => {
        console.error("[Estoque] Erro ao carregar imagem para carimbo");
        resolve(imageDataUrl);
      };
      
      img.src = imageDataUrl;
    });
  }, []);

  // Converter arquivo para base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  // Funções auxiliares
  const resetFormConfirmacao = () => {
    setEntregaSelecionada(null);
    setFotosRecebimento([]);
    setAssinaturaRecebimento(null);
    setAssinaturaData(null);
  };

  const handleAbrirConfirmacao = async (entrega: EntregaPendente) => {
    setEntregaSelecionada(entrega);
    setDialogConfirmacao(true);
  };

  const handleTirarFoto = () => {
    inputFotoRef.current?.click();
  };

  const handleFotoCapturada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.loading("Obtendo localização e processando foto...", { id: "foto-upload" });

    try {
      // Obter localização
      const coords = await getCurrentLocation();
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
      
      // Converter para base64
      const base64 = await fileToBase64(file);
      
      // Adicionar carimbo
      const stampedImage = await addImageStamp(base64, timestamp, coords);

      const novaFoto: FotoData = {
        url: stampedImage,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        data_hora: timestamp,
      };

      setFotosRecebimento(prev => [...prev, novaFoto]);
      toast.success("Foto adicionada!", { id: "foto-upload" });
    } catch (error) {
      console.error("[Estoque] Erro ao processar foto:", error);
      toast.error("Erro ao processar foto", { id: "foto-upload" });
    }
    
    // Limpar input
    e.target.value = "";
  };

  const handleRemoverFoto = (index: number) => {
    setFotosRecebimento(prev => prev.filter((_, i) => i !== index));
  };

  // Handler para assinatura (usando SignatureFullScreen)
  const handleAssinaturaSalva = async (dataUrl: string) => {
    toast.loading("Processando assinatura...", { id: "assinatura" });
    
    try {
      const coords = await getCurrentLocation();
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
      
      // Adicionar carimbo na assinatura também
      const stampedSignature = await addImageStamp(dataUrl, timestamp, coords);
      
      setAssinaturaRecebimento(stampedSignature);
      setAssinaturaData({
        data_hora: timestamp,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      
      toast.success("Assinatura salva!", { id: "assinatura" });
    } catch (error) {
      console.error("[Estoque] Erro ao processar assinatura:", error);
      setAssinaturaRecebimento(dataUrl);
      setAssinaturaData({
        data_hora: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
      });
      toast.success("Assinatura salva!", { id: "assinatura" });
    }
  };

  const handleConfirmarRecebimento = () => {
    if (!entregaSelecionada) return;
    
    if (fotosRecebimento.length === 0) {
      toast.error("Tire pelo menos uma foto do recebimento");
      return;
    }
    
    if (!assinaturaRecebimento) {
      toast.error("Assine para confirmar o recebimento");
      return;
    }
    
    confirmarRecebimentoMutation.mutate({
      entrega_id: entregaSelecionada.id,
      fotos: fotosRecebimento,
      assinatura: assinaturaRecebimento,
      assinatura_data: assinaturaData,
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

              {/* Fotos do recebimento (múltiplas) */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Fotos do Recebimento * (pode tirar várias)
                </Label>
                
                {/* Grid de fotos */}
                {fotosRecebimento.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {fotosRecebimento.map((foto, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={foto.url} 
                          alt={`Foto ${index + 1}`} 
                          className="w-full h-32 object-cover rounded-lg border cursor-pointer"
                          onClick={() => setFotoPreview(foto.url)}
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoverFoto(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded truncate">
                          📅 {foto.data_hora}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Botão para tirar mais fotos */}
                <Button
                  type="button"
                  variant="outline"
                  className={`w-full ${fotosRecebimento.length === 0 ? 'h-32 border-dashed' : 'h-12'}`}
                  onClick={handleTirarFoto}
                >
                  <div className="flex items-center gap-2">
                    {fotosRecebimento.length === 0 ? (
                      <>
                        <Camera className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Tirar foto do recebimento</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Adicionar mais fotos</span>
                      </>
                    )}
                  </div>
                </Button>
                
                {fotosRecebimento.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {fotosRecebimento.length} foto(s) adicionada(s) - com data/hora e coordenadas
                  </p>
                )}
              </div>

              {/* Assinatura (usando SignatureFullScreen) */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4" />
                  Assinatura *
                </Label>
                
                {assinaturaRecebimento ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <img 
                        src={assinaturaRecebimento} 
                        alt="Assinatura" 
                        className="w-full h-32 object-contain rounded-lg border bg-white cursor-pointer"
                        onClick={() => setFotoPreview(assinaturaRecebimento)}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => {
                          setAssinaturaRecebimento(null);
                          setAssinaturaData(null);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Assinatura salva
                      {assinaturaData && (
                        <span className="text-muted-foreground ml-1">
                          - {assinaturaData.data_hora}
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-24 border-dashed"
                    onClick={() => setShowSignatureScreen(true)}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileSignature className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Toque para assinar (tela cheia)</span>
                    </div>
                  </Button>
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
                  disabled={confirmarRecebimentoMutation.isPending || fotosRecebimento.length === 0 || !assinaturaRecebimento}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {confirmarRecebimentoMutation.isPending ? "Confirmando..." : "Confirmar Recebimento"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tela de Assinatura Full Screen */}
      <SignatureFullScreen
        open={showSignatureScreen}
        onClose={() => setShowSignatureScreen(false)}
        onSave={handleAssinaturaSalva}
        titulo="Assinatura de Recebimento"
      />

      {/* Dialog de Preview de Foto */}
      <Dialog open={!!fotoPreview} onOpenChange={() => setFotoPreview(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Visualizar Imagem</DialogTitle>
          </DialogHeader>
          {fotoPreview && (
            <div className="relative">
              <img 
                src={fotoPreview} 
                alt="Preview" 
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => setFotoPreview(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

