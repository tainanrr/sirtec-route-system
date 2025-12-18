import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { getAppParentRoute } from "@/lib/appNavigation";
import { SignatureFullScreen } from "@/components/app/SignatureFullScreen";
import { DiasRetencaoBadge, calcularDiasDesde, getNivelAlerta } from "@/components/materiais/DiasRetencaoBadge";
import { usePageState } from "@/contexts/ScrollRestoreContext";

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

interface Pergunta {
  id: string;
  texto: string;
  tipo: string;
  obrigatorio?: boolean;
  obrigatoria?: boolean;
  opcoes?: any[];
  ordem?: number;
}

interface GrupoPerguntas {
  id: string;
  nome: string;
  ordem: number;
  perguntas: Pergunta[];
}

interface ChecklistRecebimento {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  perguntas?: Pergunta[];
  grupos?: GrupoPerguntas[];
}

interface Resposta {
  pergunta_id: string;
  resposta: any;
  foto_url?: string;
  fotos?: FotoData[];
  assinatura_url?: string;
  observacao?: string;
  foto_latitude?: number;
  foto_longitude?: number;
  foto_data_hora?: string;
  assinatura_latitude?: number;
  assinatura_longitude?: number;
  assinatura_data_hora?: string;
}

export default function AppEstoque() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const pageKey = "app-estoque";
  const { getState, saveState } = usePageState<{
    activeTab?: "estoque" | "serializados" | "historico";
    searchTerm?: string;
    dialogConfirmacao?: boolean;
    entregaSelecionada?: EntregaPendente | null;
    respostas?: Record<string, Resposta>;
    showSignatureScreen?: boolean;
    signaturePerguntaId?: string;
    fotoPreview?: string | null;
    fotoPerguntaAtual?: string;
  }>(pageKey);

  const initialState = getState();
  const [activeTab, setActiveTab] = useState<"estoque" | "serializados" | "historico">(
    initialState?.activeTab || "estoque"
  );
  const [searchTerm, setSearchTerm] = useState(initialState?.searchTerm || "");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleBack = () => {
    const parent = getAppParentRoute(location.pathname);
    navigate(parent || "/app");
  };
  
  // Estado para confirmação de entrega
  const [dialogConfirmacao, setDialogConfirmacao] = useState(Boolean(initialState?.dialogConfirmacao));
  const [entregaSelecionada, setEntregaSelecionada] = useState<EntregaPendente | null>(initialState?.entregaSelecionada || null);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>(initialState?.respostas || {});
  const [showSignatureScreen, setShowSignatureScreen] = useState(Boolean(initialState?.showSignatureScreen));
  const [signaturePerguntaId, setSignaturePerguntaId] = useState<string>(initialState?.signaturePerguntaId || "");
  const [fotoPreview, setFotoPreview] = useState<string | null>(initialState?.fotoPreview || null);
  const [fotoPerguntaAtual, setFotoPerguntaAtual] = useState<string>(initialState?.fotoPerguntaAtual || "");
  
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const equipeId = equipe?.id || equipeAuth?.id;

  // Persistir estado do Estoque (para voltar exatamente como estava)
  useEffect(() => {
    const t = window.setTimeout(() => {
      saveState({
        activeTab,
        searchTerm,
        dialogConfirmacao,
        entregaSelecionada,
        respostas,
        showSignatureScreen,
        signaturePerguntaId,
        fotoPreview,
        fotoPerguntaAtual,
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [
    activeTab,
    searchTerm,
    dialogConfirmacao,
    entregaSelecionada,
    respostas,
    showSignatureScreen,
    signaturePerguntaId,
    fotoPreview,
    fotoPerguntaAtual,
    saveState,
  ]);

  // Query para checklist de recebimento
  const { data: checklistRecebimento } = useQuery({
    queryKey: ["checklist-recebimento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .eq("tipo", "recebimento_materiais")
        .eq("ativo", true)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Normalizar estrutura de perguntas
        let perguntas: Pergunta[] = [];
        
        if (data.grupos && Array.isArray(data.grupos) && data.grupos.length > 0) {
          // Se tem grupos, extrair perguntas dos grupos
          perguntas = (data.grupos as GrupoPerguntas[]).flatMap(g => g.perguntas);
        } else if (data.perguntas && Array.isArray(data.perguntas)) {
          perguntas = data.perguntas as Pergunta[];
        }
        
        return { ...data, perguntasNormalizadas: perguntas } as ChecklistRecebimento & { perguntasNormalizadas: Pergunta[] };
      }
      return null;
    },
  });

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

  // Query para materiais serializados (com rastro) da equipe
  // Busca materiais que foram entregues para a equipe e ainda não foram aplicados/devolvidos
  const { data: materiaisSerializados } = useQuery({
    queryKey: ["materiais-serializados-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];

      // Primeiro, buscar entregas confirmadas da equipe
      const { data: entregas, error: entregasError } = await supabase
        .from("materiais_entregas")
        .select("id, data_entrega, data_confirmacao")
        .eq("equipe_id", equipeId)
        .eq("status", "confirmado");

      if (entregasError) throw entregasError;
      if (!entregas || entregas.length === 0) return [];

      // Buscar itens das entregas que têm número de série
      const entregaIds = entregas.map((e: any) => e.id);
      const { data: itensEntrega, error: itensError } = await supabase
        .from("materiais_entregas_itens")
        .select(`
          id,
          entrega_id,
          numero_serie,
          material_id,
          materiais (
            codigo,
            nome,
            dias_alerta_retencao
          )
        `)
        .in("entrega_id", entregaIds)
        .not("numero_serie", "is", null);

      if (itensError) throw itensError;
      if (!itensEntrega || itensEntrega.length === 0) return [];

      // Verificar quais materiais ainda estão com a equipe (não foram aplicados)
      const numerosSerieEntregues = itensEntrega.map((i: any) => i.numero_serie).filter(Boolean);
      
      const { data: serializados, error: serializadosError } = await supabase
        .from("materiais_serializados")
        .select("numero_serie, status")
        .in("numero_serie", numerosSerieEntregues);

      if (serializadosError) throw serializadosError;

      // Filtrar apenas os que ainda não foram instalados/retirados
      const serializadosMap = new Map(
        (serializados || []).map((s: any) => [s.numero_serie, s.status])
      );

      // Montar resultado com data de entrega
      const entregasMap = new Map(
        entregas.map((e: any) => [e.id, e])
      );

      return itensEntrega
        .filter((item: any) => {
          const status = serializadosMap.get(item.numero_serie);
          // Manter se status é em_estoque (ainda não aplicado) ou não existe registro
          return !status || status === "em_estoque" || status === "com_equipe";
        })
        .map((item: any) => {
          const entrega = entregasMap.get(item.entrega_id);
          return {
            id: item.id,
            numero_serie: item.numero_serie,
            data_entrega_equipe: entrega?.data_confirmacao || entrega?.data_entrega,
            created_at: entrega?.data_entrega,
            updated_at: entrega?.data_confirmacao,
            materiais: item.materiais,
          };
        });
    },
    enabled: !!equipeId,
  });

  // Mutation para confirmar recebimento
  const confirmarRecebimentoMutation = useMutation({
    mutationFn: async (data: {
      entrega_id: string;
      respostas: Record<string, Resposta>;
      checklist_id: string;
    }) => {
      // Extrair foto e assinatura das respostas
      const respostasArray = Object.values(data.respostas);
      const fotoResposta = respostasArray.find(r => r.fotos && r.fotos.length > 0);
      const assinaturaResposta = respostasArray.find(r => r.assinatura_url);
      
      const fotoPrincipal = fotoResposta?.fotos?.[0]?.url || null;
      const coordenadas = fotoResposta?.fotos?.[0] 
        ? `${fotoResposta.fotos[0].latitude || 0},${fotoResposta.fotos[0].longitude || 0}` 
        : null;

      const dataConfirmacao = new Date().toISOString();

      // Atualizar status da entrega
      const { error } = await supabase
        .from("materiais_entregas")
        .update({
          status: "confirmado",
          foto_recebimento: fotoPrincipal,
          assinatura_recebimento: assinaturaResposta?.assinatura_url || null,
          coordenadas_recebimento: coordenadas,
          data_confirmacao: dataConfirmacao,
        })
        .eq("id", data.entrega_id);

      // Buscar itens serializados da entrega e atualizar status
      const { data: itensEntrega } = await supabase
        .from("materiais_entregas_itens")
        .select("numero_serie")
        .eq("entrega_id", data.entrega_id)
        .not("numero_serie", "is", null);

      if (itensEntrega && itensEntrega.length > 0) {
        const numerosSerieEntregues = itensEntrega.map((i: any) => i.numero_serie).filter(Boolean);
        
        // Atualizar status dos materiais serializados para "com_equipe"
        await supabase
          .from("materiais_serializados")
          .update({
            status: "com_equipe",
            localizacao_tipo: "equipe",
            localizacao_id: equipeId,
            data_entrega_equipe: dataConfirmacao,
            equipe_atual_id: equipeId,
          })
          .in("numero_serie", numerosSerieEntregues);
      }

      if (error) throw error;

      // Criar registro no checklist
      await supabase.from("checklist_respostas").insert({
        checklist_id: data.checklist_id,
        equipe_id: equipeId,
        status: "completo",
        respostas: data.respostas,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas-pendentes-equipe"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-equipe"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-equipe"] });
      queryClient.invalidateQueries({ queryKey: ["materiais-serializados-equipe"] });
      toast.success("Recebimento confirmado com sucesso!");
      setDialogConfirmacao(false);
      resetFormConfirmacao();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao confirmar recebimento");
    },
  });

  // Obter localização atual
  const getCurrentLocation = useCallback((): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
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
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, []);

  // Adicionar carimbo na imagem
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

        ctx.drawImage(img, 0, 0);

        const fontSize = Math.max(14, Math.floor(img.width / 35));
        ctx.font = `bold ${fontSize}px Arial`;
        
        const line1 = `📅 ${timestamp}`;
        const line2 = coords ? `📍 ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` : "📍 Sem GPS";
        
        const metrics1 = ctx.measureText(line1);
        const metrics2 = ctx.measureText(line2);
        const maxWidth = Math.max(metrics1.width, metrics2.width);
        const lineHeight = fontSize * 1.4;
        const padding = fontSize * 0.6;
        const boxHeight = lineHeight * 2 + padding * 2;
        const boxWidth = maxWidth + padding * 2;

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, boxWidth, boxHeight);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(line1, padding, padding + fontSize);
        ctx.fillText(line2, padding, padding + fontSize + lineHeight);

        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      
      img.onerror = () => resolve(imageDataUrl);
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
    setRespostas({});
    setFotoPerguntaAtual("");
    setSignaturePerguntaId("");
  };

  const handleAbrirConfirmacao = async (entrega: EntregaPendente) => {
    setEntregaSelecionada(entrega);
    setRespostas({});
    setDialogConfirmacao(true);
  };

  // Atualizar resposta
  const updateResposta = (perguntaId: string, valor: any, campo: keyof Resposta = 'resposta') => {
    setRespostas(prev => {
      const respostaAtual = prev[perguntaId] || { pergunta_id: perguntaId };
      return {
        ...prev,
        [perguntaId]: {
          ...respostaAtual,
          pergunta_id: perguntaId,
          [campo]: valor,
        },
      };
    });
  };

  // Atualizar múltiplos campos de uma resposta
  const updateRespostaMultiplo = (perguntaId: string, campos: Partial<Resposta>) => {
    setRespostas(prev => {
      const respostaAtual = prev[perguntaId] || { pergunta_id: perguntaId };
      return {
        ...prev,
        [perguntaId]: {
          ...respostaAtual,
          pergunta_id: perguntaId,
          ...campos,
        },
      };
    });
  };

  // Handler para foto
  const handleTirarFoto = (perguntaId: string) => {
    setFotoPerguntaAtual(perguntaId);
    inputFotoRef.current?.click();
  };

  const handleFotoCapturada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fotoPerguntaAtual) return;

    toast.loading("Processando foto...", { id: "foto-upload" });

    try {
      const coords = await getCurrentLocation();
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
      const base64 = await fileToBase64(file);
      const stampedImage = await addImageStamp(base64, timestamp, coords);

      const novaFoto: FotoData = {
        url: stampedImage,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        data_hora: timestamp,
      };

      const respostaAtual = respostas[fotoPerguntaAtual];
      const fotosAtuais = respostaAtual?.fotos || [];
      
      updateResposta(fotoPerguntaAtual, [...fotosAtuais, novaFoto], 'fotos');
      toast.success("Foto adicionada!", { id: "foto-upload" });
    } catch (error) {
      console.error("Erro ao processar foto:", error);
      toast.error("Erro ao processar foto", { id: "foto-upload" });
    }
    
    e.target.value = "";
    setFotoPerguntaAtual("");
  };

  const handleRemoverFoto = (perguntaId: string, index: number) => {
    const respostaAtual = respostas[perguntaId];
    const fotosAtuais = respostaAtual?.fotos || [];
    updateResposta(perguntaId, fotosAtuais.filter((_, i) => i !== index), 'fotos');
  };

  // Handler para assinatura
  const handleAbrirAssinatura = (perguntaId: string) => {
    setSignaturePerguntaId(perguntaId);
    setDialogConfirmacao(false);
    setTimeout(() => setShowSignatureScreen(true), 100);
  };

  const handleAssinaturaSalva = async (dataUrl: string) => {
    if (!signaturePerguntaId) return;
    
    toast.loading("Processando assinatura...", { id: "assinatura" });
    
    try {
      const coords = await getCurrentLocation();
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
      const stampedSignature = await addImageStamp(dataUrl, timestamp, coords);
      
      updateRespostaMultiplo(signaturePerguntaId, {
        assinatura_url: stampedSignature,
        resposta: true,
        assinatura_latitude: coords?.latitude,
        assinatura_longitude: coords?.longitude,
        assinatura_data_hora: timestamp,
      });
      
      toast.success("Assinatura salva!", { id: "assinatura" });
    } catch (error) {
      updateRespostaMultiplo(signaturePerguntaId, {
        assinatura_url: dataUrl,
        resposta: true,
        assinatura_data_hora: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
      });
      toast.success("Assinatura salva!", { id: "assinatura" });
    }
  };

  const handleLimparAssinatura = (perguntaId: string) => {
    updateRespostaMultiplo(perguntaId, {
      assinatura_url: undefined,
      resposta: null,
      assinatura_latitude: undefined,
      assinatura_longitude: undefined,
      assinatura_data_hora: undefined,
    });
  };

  // Verificar pendências
  const verificarPendencias = (): string[] => {
    const pendencias: string[] = [];
    const perguntas = (checklistRecebimento as any)?.perguntasNormalizadas || [];
    
    for (const pergunta of perguntas) {
      const resposta = respostas[pergunta.id];
      const obrigatoria = pergunta.obrigatorio || pergunta.obrigatoria;
      
      if (obrigatoria) {
        if (pergunta.tipo === 'foto') {
          const fotos = resposta?.fotos || [];
          if (fotos.length === 0) {
            pendencias.push(pergunta.id);
          }
        } else if (pergunta.tipo === 'assinatura') {
          if (!resposta?.assinatura_url) {
            pendencias.push(pergunta.id);
          }
        } else {
          if (resposta?.resposta === null || resposta?.resposta === undefined || resposta?.resposta === '') {
            pendencias.push(pergunta.id);
          }
        }
      }
    }
    
    return pendencias;
  };

  const handleConfirmarRecebimento = () => {
    if (!entregaSelecionada || !checklistRecebimento) return;
    
    const pendencias = verificarPendencias();
    if (pendencias.length > 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    
    confirmarRecebimentoMutation.mutate({
      entrega_id: entregaSelecionada.id,
      respostas: respostas,
      checklist_id: checklistRecebimento.id,
    });
  };

  // Renderizar campo de pergunta (igual APR)
  const renderCampoPergunta = (pergunta: Pergunta) => {
    const resposta = respostas[pergunta.id];
    const obrigatoria = pergunta.obrigatorio || pergunta.obrigatoria;

    switch (pergunta.tipo) {
      case 'texto':
        return (
          <Input
            value={(resposta?.resposta as string) || ''}
            onChange={(e) => updateResposta(pergunta.id, e.target.value)}
            placeholder="Digite sua resposta..."
          />
        );

      case 'texto_longo':
        return (
          <Textarea
            value={(resposta?.resposta as string) || ''}
            onChange={(e) => updateResposta(pergunta.id, e.target.value)}
            placeholder="Digite sua resposta..."
            rows={3}
          />
        );

      case 'sim_nao':
        return (
          <RadioGroup
            value={resposta?.resposta as string || ''}
            onValueChange={(value) => updateResposta(pergunta.id, value)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sim" id={`${pergunta.id}-sim`} />
              <Label htmlFor={`${pergunta.id}-sim`} className="text-green-600 font-medium cursor-pointer">Sim</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="nao" id={`${pergunta.id}-nao`} />
              <Label htmlFor={`${pergunta.id}-nao`} className="text-red-600 font-medium cursor-pointer">Não</Label>
            </div>
          </RadioGroup>
        );

      case 'foto':
        const fotos = resposta?.fotos || [];
        return (
          <div className="space-y-3">
            {fotos.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {fotos.map((foto, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={foto.url}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-28 object-cover rounded-lg border cursor-pointer"
                      onClick={() => setFotoPreview(foto.url)}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoverFoto(pergunta.id, index)}
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
            
            <Button
              type="button"
              variant="outline"
              className={`w-full ${fotos.length === 0 ? 'h-28 border-dashed' : 'h-10'}`}
              onClick={() => handleTirarFoto(pergunta.id)}
            >
              <div className="flex items-center gap-2">
                {fotos.length === 0 ? (
                  <>
                    <Camera className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Tirar Foto</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Adicionar outra foto</span>
                  </>
                )}
              </div>
            </Button>
            
            {fotos.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {fotos.length} foto(s) • com data/hora e coordenadas
              </p>
            )}
          </div>
        );

      case 'assinatura':
        return (
          <div className="space-y-2">
            {resposta?.assinatura_url ? (
              <div className="relative">
                <div className="bg-white rounded-lg border-2 border-gray-200 p-2">
                  <img
                    src={resposta.assinatura_url}
                    alt="Assinatura"
                    className="w-full h-32 object-contain cursor-pointer"
                    onClick={() => setFotoPreview(resposta.assinatura_url!)}
                  />
                  {resposta.assinatura_data_hora && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      📅 {resposta.assinatura_data_hora}
                      {resposta.assinatura_latitude && resposta.assinatura_longitude && (
                        <> • 📍 {resposta.assinatura_latitude.toFixed(4)}, {resposta.assinatura_longitude.toFixed(4)}</>
                      )}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={() => handleLimparAssinatura(pergunta.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-28 border-dashed border-2"
                onClick={() => handleAbrirAssinatura(pergunta.id)}
              >
                <div className="flex flex-col items-center gap-2">
                  <FileSignature className="h-10 w-10 text-violet-500" />
                  <span className="text-sm text-muted-foreground">Toque para assinar</span>
                  <span className="text-xs text-muted-foreground">Abre em tela cheia</span>
                </div>
              </Button>
            )}
          </div>
        );

      default:
        return (
          <Input
            value={(resposta?.resposta as string) || ''}
            onChange={(e) => updateResposta(pergunta.id, e.target.value)}
            placeholder="Digite sua resposta..."
          />
        );
    }
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

  // Função auxiliar para obter data de entrega (usa created_at como fallback)
  const getDataEntrega = (item: any) => item.data_entrega_equipe || item.updated_at || item.created_at;

  // Calcular materiais serializados em alerta
  const materiaisEmAlerta = materiaisSerializados?.filter((item: any) => {
    const dataEntrega = getDataEntrega(item);
    const dias = calcularDiasDesde(dataEntrega);
    const diasAlerta = item.materiais?.dias_alerta_retencao || 7;
    const nivel = getNivelAlerta(dias, diasAlerta);
    return nivel === "alerta" || nivel === "critico";
  }) || [];

  const perguntas = (checklistRecebimento as any)?.perguntasNormalizadas || [];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
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

        {/* Alerta compacto de Materiais com Rastro */}
        {materiaisEmAlerta.length > 0 && (
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700">
                    {materiaisEmAlerta.length} material(is) com rastro em alerta
                  </span>
                </div>
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                  Ver em Rastro
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (v === "estoque" || v === "serializados" || v === "historico") {
              setActiveTab(v);
            }
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="estoque">Estoque</TabsTrigger>
            <TabsTrigger value="serializados">
              Rastro {materiaisSerializados?.length ? `(${materiaisSerializados.length})` : ""}
            </TabsTrigger>
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

          <TabsContent value="serializados" className="mt-4">
            {materiaisSerializados && materiaisSerializados.length > 0 ? (
              <div className="space-y-2">
                {materiaisSerializados.map((item: any) => {
                  const dataEntrega = getDataEntrega(item);
                  const dias = calcularDiasDesde(dataEntrega);
                  const diasAlerta = item.materiais?.dias_alerta_retencao || 7;
                  const nivel = getNivelAlerta(dias, diasAlerta);
                  const isAlerta = nivel === "alerta" || nivel === "critico";

                  return (
                    <Card
                      key={item.id}
                      className={isAlerta ? (nivel === "critico" ? "border-red-300 bg-red-50/50" : "border-orange-300 bg-orange-50/50") : ""}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              nivel === "critico" ? "bg-red-100" : 
                              nivel === "alerta" ? "bg-orange-100" : 
                              nivel === "atencao" ? "bg-amber-100" : "bg-violet-100"
                            }`}>
                              <Zap className={`h-5 w-5 ${
                                nivel === "critico" ? "text-red-600" : 
                                nivel === "alerta" ? "text-orange-600" : 
                                nivel === "atencao" ? "text-amber-600" : "text-violet-600"
                              }`} />
                            </div>
                            <div>
                              <p className="font-mono font-medium text-sm">{item.numero_serie}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.materiais?.codigo} - {item.materiais?.nome}
                              </p>
                            </div>
                          </div>
                          <DiasRetencaoBadge
                            dataEntregaEquipe={dataEntrega}
                            diasAlertaRetencao={diasAlerta}
                            size="sm"
                            showTooltip={false}
                          />
                        </div>
                        {isAlerta && (
                          <div className={`mt-2 flex items-center gap-1 ${nivel === "critico" ? "text-red-600" : "text-orange-600"}`}>
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-xs">
                              {nivel === "critico" ? "Situação crítica!" : "Ultrapassou prazo de alerta"}
                              {" - "}Aplique em uma OS ou devolva ao estoque
                            </span>
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
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">
                    Nenhum material com rastro em seu estoque
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Medidores e equipamentos serializados aparecerão aqui
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
              {checklistRecebimento?.nome || "Confirmar Recebimento"}
            </DialogTitle>
          </DialogHeader>

          {entregaSelecionada && (
            <div className="space-y-4">
              {/* Info da entrega */}
              <Card className="bg-muted/50">
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
                      <div key={idx} className="flex items-center justify-between p-2 bg-background rounded">
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

              {/* Perguntas do Checklist */}
              {perguntas.length > 0 ? (
                <div className="space-y-4">
                  {perguntas.map((pergunta: Pergunta, index: number) => {
                    const obrigatoria = pergunta.obrigatorio || pergunta.obrigatoria;
                    return (
                      <div key={pergunta.id} className="space-y-2">
                        <Label className="flex items-start gap-2 text-sm">
                          <Badge variant="outline" className="shrink-0 mt-0.5">
                            {index + 1}
                          </Badge>
                          <span>
                            {pergunta.texto}
                            {obrigatoria && <span className="text-red-500 ml-1">*</span>}
                          </span>
                        </Label>
                        {renderCampoPergunta(pergunta)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-3" />
                    <p className="text-muted-foreground">
                      Nenhum formulário de recebimento cadastrado.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configure um checklist do tipo "recebimento_materiais" em Cadastros &gt; Checklists
                    </p>
                  </CardContent>
                </Card>
              )}

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
                  disabled={confirmarRecebimentoMutation.isPending || perguntas.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {confirmarRecebimentoMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Confirmando...
                    </>
                  ) : (
                    "Confirmar Recebimento"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tela de Assinatura Full Screen */}
      <SignatureFullScreen
        open={showSignatureScreen}
        onClose={() => {
          setShowSignatureScreen(false);
          if (entregaSelecionada) {
            setTimeout(() => setDialogConfirmacao(true), 100);
          }
        }}
        onSave={(dataUrl) => {
          handleAssinaturaSalva(dataUrl);
          setShowSignatureScreen(false);
          if (entregaSelecionada) {
            setTimeout(() => setDialogConfirmacao(true), 100);
          }
        }}
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
