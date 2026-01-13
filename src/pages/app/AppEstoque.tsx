import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { logApp } from "@/lib/logUtils";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData } from "@/hooks/useOfflineData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  History,
  ChevronRight,
  Camera,
  FileSignature,
  X,
  Plus,
  AlertCircle,
  Loader2,
  BoxesIcon,
  TrendingDown,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { getAppParentRoute } from "@/lib/appNavigation";
import { SignatureFullScreen } from "@/components/app/SignatureFullScreen";
import { DiasRetencaoBadge, calcularDiasDesde, getNivelAlerta } from "@/components/materiais/DiasRetencaoBadge";
import { usePageState } from "@/contexts/ScrollRestoreContext";
import { cn } from "@/lib/utils";

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

type TabType = "estoque" | "serializados" | "historico";

export default function AppEstoque() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const { isOnline, queueOperation } = useOfflineSyncContext();
  const { 
    getEstoqueFromCache, 
    getEntregasPendentesFromCache, 
    getDevolucoesPendentesFromCache, 
    getMovimentacoesFromCache,
    getMateriaisSerializadosFromCache,
    getChecklistsFromCache,
  } = useOfflineData();
  const pageKey = "app-estoque";
  const { getState, saveState } = usePageState<{
    activeTab?: TabType;
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
  const [activeTab, setActiveTab] = useState<TabType>(initialState?.activeTab || "estoque");
  const [searchTerm, setSearchTerm] = useState(initialState?.searchTerm || "");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

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

  // Persistir estado
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
  }, [activeTab, searchTerm, dialogConfirmacao, entregaSelecionada, respostas, showSignatureScreen, signaturePerguntaId, fotoPreview, fotoPerguntaAtual, saveState]);

  // Query para checklist de recebimento
  const { data: checklistRecebimento } = useQuery({
    queryKey: ["checklist-recebimento"],
    queryFn: async () => {
      if (!isOnline) {
        const checklists = await getChecklistsFromCache() as any[];
        if (checklists) {
          const checklist = checklists.find(c => c.tipo === "recebimento_materiais" && c.ativo);
          if (checklist) {
            let perguntas: Pergunta[] = [];
            if (checklist.grupos && Array.isArray(checklist.grupos) && checklist.grupos.length > 0) {
              perguntas = (checklist.grupos as GrupoPerguntas[]).flatMap(g => g.perguntas);
            } else if (checklist.perguntas && Array.isArray(checklist.perguntas)) {
              perguntas = checklist.perguntas as Pergunta[];
            }
            return { ...checklist, perguntasNormalizadas: perguntas } as ChecklistRecebimento & { perguntasNormalizadas: Pergunta[] };
          }
        }
        return null;
      }

      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .eq("tipo", "recebimento_materiais")
        .eq("ativo", true)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        let perguntas: Pergunta[] = [];
        if (data.grupos && Array.isArray(data.grupos) && data.grupos.length > 0) {
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

      if (!isOnline) {
        const cached = await getEstoqueFromCache(equipeId) as EstoqueItem[];
        if (cached && cached.length > 0) {
          return cached;
        }
        return [];
      }

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

      if (!isOnline) {
        const cached = await getMovimentacoesFromCache(equipeId) as MovimentacaoRecente[];
        if (cached) return cached;
        return [];
      }

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
        .limit(20);

      if (error) throw error;
      return data as MovimentacaoRecente[];
    },
    enabled: !!equipeId,
  });

  // Query para entregas pendentes
  const { data: entregasPendentes } = useQuery({
    queryKey: ["entregas-pendentes-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];

      if (!isOnline) {
        const cached = await getEntregasPendentesFromCache(equipeId) as EntregaPendente[];
        if (cached) return cached;
        return [];
      }

      const { data, error } = await supabase
        .from("materiais_entregas")
        .select(`id, data_entrega, status, observacao`)
        .eq("equipe_id", equipeId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const entregasComItens = await Promise.all(
        (data || []).map(async (entrega: any) => {
          const { data: itens } = await supabase
            .from("materiais_entregas_itens")
            .select(`material_id, quantidade, numero_serie, materiais (codigo, nome, unidade)`)
            .eq("entrega_id", entrega.id);
          return { ...entrega, itens: itens || [] };
        })
      );

      return entregasComItens as EntregaPendente[];
    },
    enabled: !!equipeId,
  });

  // Query para devoluções pendentes
  const { data: devolucoesPendentesConfirmacao } = useQuery({
    queryKey: ["devolucoes-pendentes-confirmacao-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];
      
      if (!isOnline) {
        const cached = await getDevolucoesPendentesFromCache(equipeId) as any[];
        if (cached) return cached;
        return [];
      }
      
      const { data, error } = await (supabase as any)
        .from("materiais_devolucoes")
        .select("id, status, created_at, observacao")
        .eq("equipe_id", equipeId)
        .eq("status", "pendente_confirmacao_equipe")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!equipeId,
  });

  // Query para materiais serializados
  const { data: materiaisSerializados } = useQuery({
    queryKey: ["materiais-serializados-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];

      if (!isOnline) {
        const cached = await getMateriaisSerializadosFromCache(equipeId) as any[];
        if (cached) return cached;
        return [];
      }

      const { data: entregas, error: entregasError } = await supabase
        .from("materiais_entregas")
        .select("id, data_entrega, data_confirmacao")
        .eq("equipe_id", equipeId)
        .eq("status", "confirmado");

      if (entregasError) throw entregasError;
      if (!entregas || entregas.length === 0) return [];

      const entregaIds = entregas.map((e: any) => e.id);
      const { data: itensEntrega, error: itensError } = await supabase
        .from("materiais_entregas_itens")
        .select(`id, entrega_id, numero_serie, material_id, materiais (codigo, nome, dias_alerta_retencao)`)
        .in("entrega_id", entregaIds)
        .not("numero_serie", "is", null);

      if (itensError) throw itensError;
      if (!itensEntrega || itensEntrega.length === 0) return [];

      const numerosSerieEntregues = itensEntrega.map((i: any) => i.numero_serie).filter(Boolean);
      
      const { data: serializados, error: serializadosError } = await supabase
        .from("materiais_serializados")
        .select("numero_serie, status")
        .in("numero_serie", numerosSerieEntregues);

      if (serializadosError) throw serializadosError;

      const serializadosMap = new Map((serializados || []).map((s: any) => [s.numero_serie, s.status]));
      const entregasMap = new Map(entregas.map((e: any) => [e.id, e]));

      return itensEntrega
        .filter((item: any) => {
          const status = serializadosMap.get(item.numero_serie);
          return !status || status === "em_estoque" || status === "com_equipe";
        })
        .map((item: any) => {
          const entrega = entregasMap.get(item.entrega_id);
          return {
            id: item.id,
            numero_serie: item.numero_serie,
            data_entrega_equipe: (entrega as any)?.data_confirmacao || (entrega as any)?.data_entrega,
            created_at: (entrega as any)?.data_entrega,
            updated_at: (entrega as any)?.data_confirmacao,
            materiais: item.materiais,
          };
        });
    },
    enabled: !!equipeId,
  });

  // Mutation para confirmar recebimento
  const confirmarRecebimentoMutation = useMutation({
    mutationFn: async (data: { entrega_id: string; respostas: Record<string, Resposta>; checklist_id: string }) => {
      const respostasArray = Object.values(data.respostas);
      const fotoResposta = respostasArray.find(r => r.fotos && r.fotos.length > 0);
      const assinaturaResposta = respostasArray.find(r => r.assinatura_url);
      
      const fotoPrincipal = fotoResposta?.fotos?.[0]?.url || null;
      const coordenadas = fotoResposta?.fotos?.[0] 
        ? `${fotoResposta.fotos[0].latitude || 0},${fotoResposta.fotos[0].longitude || 0}` 
        : null;

      const dataConfirmacao = new Date().toISOString();

      if (!isOnline) {
        await queueOperation("confirmar_recebimento", "materiais_entregas", "update", {
          id: data.entrega_id,
          status: "confirmado",
          foto_recebimento: fotoPrincipal,
          assinatura_recebimento: assinaturaResposta?.assinatura_url || null,
          coordenadas_recebimento: coordenadas,
          data_confirmacao: dataConfirmacao,
        }, 2);
        
        await queueOperation("save_checklist", "checklist_respostas", "insert", {
          checklist_id: data.checklist_id,
          equipe_id: equipeId,
          status: "completo",
          respostas: data.respostas,
        }, 2);
        
        toast.success("Confirmação salva! Será sincronizada quando houver internet.");
        return;
      }

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

      const { data: itensEntrega } = await supabase
        .from("materiais_entregas_itens")
        .select("numero_serie")
        .eq("entrega_id", data.entrega_id)
        .not("numero_serie", "is", null);

      if (itensEntrega && itensEntrega.length > 0) {
        const numerosSerieEntregues = itensEntrega.map((i: any) => i.numero_serie).filter(Boolean);
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

      await supabase.from("checklist_respostas").insert({
        checklist_id: data.checklist_id,
        equipe_id: equipeId,
        status: "completo",
        respostas: data.respostas,
      });
      
      logApp("criar", "app", "materiais_entregas", data.entrega_id, {
        id: equipeId || "",
        nome: equipe?.codigo || equipeAuth?.codigo || "",
        equipeId: equipeId || "",
        equipeCodigo: equipe?.codigo || equipeAuth?.codigo || ""
      }, null, { status: "confirmado", data_confirmacao: dataConfirmacao },
        `Confirmou recebimento de materiais (entrega ${data.entrega_id})`
      );
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

  // Helpers
  const getCurrentLocation = useCallback((): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, []);

  const addImageStamp = useCallback((imageDataUrl: string, timestamp: string, coords: { latitude: number; longitude: number } | null): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(imageDataUrl); return; }
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

  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }, []);

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

  const updateResposta = (perguntaId: string, valor: any, campo: keyof Resposta = 'resposta') => {
    setRespostas(prev => ({
      ...prev,
      [perguntaId]: { ...prev[perguntaId], pergunta_id: perguntaId, [campo]: valor },
    }));
  };

  const updateRespostaMultiplo = (perguntaId: string, campos: Partial<Resposta>) => {
    setRespostas(prev => ({
      ...prev,
      [perguntaId]: { ...prev[perguntaId], pergunta_id: perguntaId, ...campos },
    }));
  };

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

  const verificarPendencias = (): string[] => {
    const pendencias: string[] = [];
    const perguntas = (checklistRecebimento as any)?.perguntasNormalizadas || [];
    for (const pergunta of perguntas) {
      const resposta = respostas[pergunta.id];
      const obrigatoria = pergunta.obrigatorio || pergunta.obrigatoria;
      if (obrigatoria) {
        if (pergunta.tipo === 'foto') {
          if (!(resposta?.fotos?.length > 0)) pendencias.push(pergunta.id);
        } else if (pergunta.tipo === 'assinatura') {
          if (!resposta?.assinatura_url) pendencias.push(pergunta.id);
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

  // Render campo pergunta
  const renderCampoPergunta = (pergunta: Pergunta) => {
    const resposta = respostas[pergunta.id];

    switch (pergunta.tipo) {
      case 'texto':
        return <Input value={(resposta?.resposta as string) || ''} onChange={(e) => updateResposta(pergunta.id, e.target.value)} placeholder="Digite..." />;
      case 'texto_longo':
        return <Textarea value={(resposta?.resposta as string) || ''} onChange={(e) => updateResposta(pergunta.id, e.target.value)} placeholder="Digite..." rows={3} />;
      case 'sim_nao':
        return (
          <RadioGroup value={resposta?.resposta as string || ''} onValueChange={(value) => updateResposta(pergunta.id, value)} className="flex gap-4">
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
                    <img src={foto.url} alt={`Foto ${index + 1}`} className="w-full h-28 object-cover rounded-lg border cursor-pointer" onClick={() => setFotoPreview(foto.url)} />
                    <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoverFoto(pergunta.id, index)}>
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded truncate">📅 {foto.data_hora}</div>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" className={`w-full ${fotos.length === 0 ? 'h-24 border-dashed' : 'h-10'}`} onClick={() => handleTirarFoto(pergunta.id)}>
              <div className="flex items-center gap-2">
                {fotos.length === 0 ? (<><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">Tirar Foto</span></>) : (<><Plus className="h-4 w-4" /><span>Adicionar foto</span></>)}
              </div>
            </Button>
          </div>
        );
      case 'assinatura':
        return (
          <div className="space-y-2">
            {resposta?.assinatura_url ? (
              <div className="relative">
                <div className="bg-white rounded-lg border-2 border-gray-200 p-2">
                  <img src={resposta.assinatura_url} alt="Assinatura" className="w-full h-28 object-contain cursor-pointer" onClick={() => setFotoPreview(resposta.assinatura_url!)} />
                  {resposta.assinatura_data_hora && <p className="text-xs text-muted-foreground text-center mt-2">📅 {resposta.assinatura_data_hora}</p>}
                </div>
                <Button size="sm" variant="destructive" className="absolute top-2 right-2" onClick={() => handleLimparAssinatura(pergunta.id)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full h-24 border-dashed border-2" onClick={() => handleAbrirAssinatura(pergunta.id)}>
                <div className="flex flex-col items-center gap-2">
                  <FileSignature className="h-8 w-8 text-violet-500" />
                  <span className="text-sm text-muted-foreground">Toque para assinar</span>
                </div>
              </Button>
            )}
          </div>
        );
      default:
        return <Input value={(resposta?.resposta as string) || ''} onChange={(e) => updateResposta(pergunta.id, e.target.value)} placeholder="Digite..." />;
    }
  };

  // Filtragem e agrupamento
  const estoqueFiltrado = estoqueEquipe?.filter((item) => {
    const isBaixo = item.quantidade <= item.materiais.estoque_minimo;
    if (showOnlyLowStock && !isBaixo) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.materiais.codigo.toLowerCase().includes(term) || item.materiais.nome.toLowerCase().includes(term);
  });

  const estoqueAgrupado = useMemo(() => {
    const map = new Map<string, EstoqueItem[]>();
    (estoqueFiltrado || []).forEach((item) => {
      const cat = item.materiais.categoria?.trim() || "Outros";
      const list = map.get(cat) || [];
      list.push(item);
      map.set(cat, list);
    });
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b, "pt-BR")).map((categoria) => ({
      categoria,
      itens: (map.get(categoria) || []).sort((a, b) => a.materiais.codigo.localeCompare(b.materiais.codigo, "pt-BR", { numeric: true })),
    }));
  }, [estoqueFiltrado]);

  // Estatísticas
  const totalItens = estoqueEquipe?.length || 0;
  const totalQuantidade = estoqueEquipe?.reduce((acc, item) => acc + item.quantidade, 0) || 0;
  const itensBaixos = estoqueEquipe?.filter((item) => item.quantidade <= item.materiais.estoque_minimo).length || 0;
  const getDataEntrega = (item: any) => item.data_entrega_equipe || item.updated_at || item.created_at;
  const materiaisEmAlerta = materiaisSerializados?.filter((item: any) => {
    const dataEntrega = getDataEntrega(item);
    const dias = calcularDiasDesde(dataEntrega);
    const diasAlerta = item.materiais?.dias_alerta_retencao || 7;
    const nivel = getNivelAlerta(dias, diasAlerta);
    return nivel === "alerta" || nivel === "critico";
  }) || [];

  const perguntas = (checklistRecebimento as any)?.perguntasNormalizadas || [];

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Tabs config
  const tabs: { id: TabType; label: string; icon: any; count?: number; alert?: boolean }[] = [
    { id: "estoque", label: "Estoque", icon: BoxesIcon, count: totalItens },
    { id: "serializados", label: "Rastro", icon: Zap, count: materiaisSerializados?.length || 0, alert: materiaisEmAlerta.length > 0 },
    { id: "historico", label: "Histórico", icon: History },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-background pb-24">
      {/* Header com gradiente */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 pt-4 pb-20">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="text-white hover:bg-white/20 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="h-5 w-5" />
              Meu Estoque
            </h1>
            <p className="text-emerald-100 text-xs">
              {equipe?.codigo || equipeAuth?.codigo}
            </p>
          </div>
          {!isOnline && (
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              Offline
            </Badge>
          )}
        </div>
      </div>

      {/* Cards de resumo flutuantes */}
      <div className="px-4 -mt-14">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Card Total */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total de Itens</p>
                  <p className="text-2xl font-bold text-emerald-700">{totalItens}</p>
                  <p className="text-[10px] text-muted-foreground">{totalQuantidade} unidades</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <BoxesIcon className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Alertas */}
          <Card 
            className={cn("shadow-lg border-0 cursor-pointer transition-all", itensBaixos > 0 && "ring-2 ring-amber-400 bg-amber-50")}
            onClick={() => { setActiveTab("estoque"); setShowOnlyLowStock(true); }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Estoque Baixo</p>
                  <p className={cn("text-2xl font-bold", itensBaixos > 0 ? "text-amber-600" : "text-gray-400")}>{itensBaixos}</p>
                  <p className="text-[10px] text-muted-foreground">itens críticos</p>
                </div>
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", itensBaixos > 0 ? "bg-amber-100" : "bg-gray-100")}>
                  <TrendingDown className={cn("h-5 w-5", itensBaixos > 0 ? "text-amber-600" : "text-gray-400")} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas de pendências */}
        {(entregasPendentes && entregasPendentes.length > 0) && (
          <Card className="shadow-lg border-0 mb-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <CardContent className="p-4">
              <button 
                className="w-full flex items-center justify-between"
                onClick={() => handleAbrirConfirmacao(entregasPendentes[0])}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                    <ArrowDownCircle className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Recebimento Pendente</p>
                    <p className="text-xs text-white/80">{entregasPendentes.length} entrega(s) aguardando confirmação</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </button>
            </CardContent>
          </Card>
        )}

        {(devolucoesPendentesConfirmacao && devolucoesPendentesConfirmacao.length > 0) && (
          <Card className="shadow-lg border-0 mb-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white">
            <CardContent className="p-4">
              <button 
                className="w-full flex items-center justify-between"
                onClick={() => navigate("/app/estoque/devolucoes")}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                    <ArrowUpCircle className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Devolução Pendente</p>
                    <p className="text-xs text-white/80">{devolucoesPendentesConfirmacao.length} solicitação(ões) para confirmar</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Tabs customizadas */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-emerald-600 text-white shadow-md" 
                  : "bg-white text-gray-600 hover:bg-gray-50 shadow"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-white/20" : "bg-gray-100"
                )}>
                  {tab.count}
                </span>
              )}
              {tab.alert && (
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo das tabs */}
        {activeTab === "estoque" && (
          <div className="space-y-3">
            {/* Barra de busca e ações */}
            <Card className="shadow-md border-0">
              <CardContent className="p-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código ou nome..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10"
                    />
                  </div>
                  <Button
                    variant={showOnlyLowStock ? "default" : "outline"}
                    size="icon"
                    onClick={() => setShowOnlyLowStock(v => !v)}
                    className={cn("h-10 w-10 shrink-0", showOnlyLowStock && "bg-amber-500 hover:bg-amber-600")}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      if (!isOnline) {
                        toast.error("Você precisa estar online para criar devoluções");
                        return;
                      }
                      navigate("/app/estoque/devolucoes");
                    }}
                    className="h-10 bg-emerald-600 hover:bg-emerald-700"
                    disabled={!isOnline}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    Devolver
                  </Button>
                </div>
                {showOnlyLowStock && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                    <AlertTriangle className="h-3 w-3" />
                    Mostrando apenas itens com estoque baixo
                    <button onClick={() => setShowOnlyLowStock(false)} className="ml-auto text-amber-800 hover:underline">Limpar</button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lista de materiais */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : estoqueAgrupado.length > 0 ? (
              <div className="space-y-3">
                {estoqueAgrupado.map((grupo) => (
                  <Card key={grupo.categoria} className="shadow-md border-0 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(grupo.categoria)}
                      className="w-full p-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">{grupo.categoria}</span>
                        <Badge variant="secondary" className="text-xs">{grupo.itens.length}</Badge>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 text-gray-500 transition-transform", expandedCategories.has(grupo.categoria) && "rotate-180")} />
                    </button>
                    
                    {(expandedCategories.size === 0 || expandedCategories.has(grupo.categoria)) && (
                      <div className="divide-y">
                        {grupo.itens.map((item) => {
                          const isBaixo = item.quantidade <= item.materiais.estoque_minimo;
                          return (
                            <div key={item.id} className={cn("p-3 flex items-center gap-3", isBaixo && "bg-amber-50/50")}>
                              <div className={cn(
                                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                                isBaixo ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                              )}>
                                {item.quantidade}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-semibold">{item.materiais.codigo}</span>
                                  {item.materiais.requer_serial && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0">SR</Badge>
                                  )}
                                  {isBaixo && (
                                    <Badge className="bg-amber-500 text-white text-[9px] px-1 py-0">Baixo</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{item.materiais.nome}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[10px] text-muted-foreground">{item.materiais.unidade}</p>
                                {isBaixo && (
                                  <p className="text-[9px] text-amber-600">Mín: {item.materiais.estoque_minimo}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="shadow-md border-0">
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">
                    {searchTerm || showOnlyLowStock ? "Nenhum material encontrado" : "Estoque vazio"}
                  </p>
                  {(searchTerm || showOnlyLowStock) && (
                    <Button variant="outline" className="mt-3" onClick={() => { setSearchTerm(""); setShowOnlyLowStock(false); }}>
                      Limpar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "serializados" && (
          <div className="space-y-3">
            {materiaisSerializados && materiaisSerializados.length > 0 ? (
              materiaisSerializados.map((item: any) => {
                const dataEntrega = getDataEntrega(item);
                const dias = calcularDiasDesde(dataEntrega);
                const diasAlerta = item.materiais?.dias_alerta_retencao || 7;
                const nivel = getNivelAlerta(dias, diasAlerta);
                const isAlerta = nivel === "alerta" || nivel === "critico";

                return (
                  <Card key={item.id} className={cn(
                    "shadow-md border-0 overflow-hidden",
                    nivel === "critico" && "ring-2 ring-red-400",
                    nivel === "alerta" && "ring-2 ring-orange-400"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                          nivel === "critico" ? "bg-red-100" : 
                          nivel === "alerta" ? "bg-orange-100" : 
                          nivel === "atencao" ? "bg-amber-100" : "bg-violet-100"
                        )}>
                          <Zap className={cn(
                            "h-6 w-6",
                            nivel === "critico" ? "text-red-600" : 
                            nivel === "alerta" ? "text-orange-600" : 
                            nivel === "atencao" ? "text-amber-600" : "text-violet-600"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-bold text-sm">{item.numero_serie}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.materiais?.codigo} • {item.materiais?.nome}
                          </p>
                        </div>
                        <DiasRetencaoBadge
                          dataEntregaEquipe={dataEntrega}
                          diasAlertaRetencao={diasAlerta}
                          size="sm"
                          showTooltip={false}
                        />
                      </div>
                      {isAlerta && (
                        <div className={cn(
                          "mt-3 flex items-center gap-2 p-2 rounded-lg text-xs",
                          nivel === "critico" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"
                        )}>
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>{nivel === "critico" ? "Situação crítica!" : "Ultrapassou prazo"} - Aplique ou devolva</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="shadow-md border-0">
                <CardContent className="p-8 text-center">
                  <Zap className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Nenhum material com rastro</p>
                  <p className="text-xs text-gray-400 mt-1">Medidores e equipamentos serializados aparecerão aqui</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "historico" && (
          <div className="space-y-3">
            {movimentacoesRecentes && movimentacoesRecentes.length > 0 ? (
              movimentacoesRecentes.map((mov) => {
                const isEntrada = mov.tipo === "entrada" || mov.tipo === "transferencia";
                return (
                  <Card key={mov.id} className="shadow-md border-0">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                        isEntrada ? "bg-green-100" : "bg-red-100"
                      )}>
                        {isEntrada ? (
                          <ArrowDownCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <ArrowUpCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {mov.materiais?.codigo} • {mov.materiais?.nome}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {mov.observacao || (isEntrada ? "Recebimento" : "Aplicação/Saída")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={isEntrada ? "default" : "destructive"} className={cn(isEntrada && "bg-green-600")}>
                          {isEntrada ? "+" : "-"}{mov.quantidade}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(mov.created_at), "dd/MM HH:mm")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="shadow-md border-0">
                <CardContent className="p-8 text-center">
                  <History className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Nenhuma movimentação recente</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Input oculto para foto */}
      <input ref={inputFotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoCapturada} />

      {/* Dialog de Confirmação de Recebimento */}
      <Dialog open={dialogConfirmacao} onOpenChange={(open) => { if (!open) resetFormConfirmacao(); setDialogConfirmacao(open); }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-600" />
              {checklistRecebimento?.nome || "Confirmar Recebimento"}
            </DialogTitle>
          </DialogHeader>

          {entregaSelecionada && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    📅 {format(new Date(entregaSelecionada.data_entrega), "dd/MM/yyyy")}
                  </p>
                  <div className="space-y-2">
                    {entregaSelecionada.itens?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-background rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{item.materiais?.codigo}</p>
                          <p className="text-xs text-muted-foreground">{item.materiais?.nome}</p>
                          {item.numero_serie && <Badge variant="outline" className="mt-1 text-xs">SN: {item.numero_serie}</Badge>}
                        </div>
                        <Badge variant="secondary">{item.quantidade} {item.materiais?.unidade}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {perguntas.length > 0 ? (
                <div className="space-y-4">
                  {perguntas.map((pergunta: Pergunta, index: number) => {
                    const obrigatoria = pergunta.obrigatorio || pergunta.obrigatoria;
                    return (
                      <div key={pergunta.id} className="space-y-2">
                        <Label className="flex items-start gap-2 text-sm">
                          <Badge variant="outline" className="shrink-0 mt-0.5">{index + 1}</Badge>
                          <span>{pergunta.texto}{obrigatoria && <span className="text-red-500 ml-1">*</span>}</span>
                        </Label>
                        {renderCampoPergunta(pergunta)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
                    <p className="text-muted-foreground text-sm">Nenhum formulário de recebimento cadastrado.</p>
                  </CardContent>
                </Card>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { resetFormConfirmacao(); setDialogConfirmacao(false); }}>Cancelar</Button>
                <Button onClick={handleConfirmarRecebimento} disabled={confirmarRecebimentoMutation.isPending || perguntas.length === 0} className="bg-green-600 hover:bg-green-700">
                  {confirmarRecebimentoMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirmando...</> : "Confirmar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tela de Assinatura */}
      <SignatureFullScreen
        open={showSignatureScreen}
        onClose={() => { setShowSignatureScreen(false); if (entregaSelecionada) setTimeout(() => setDialogConfirmacao(true), 100); }}
        onSave={(dataUrl) => { handleAssinaturaSalva(dataUrl); setShowSignatureScreen(false); if (entregaSelecionada) setTimeout(() => setDialogConfirmacao(true), 100); }}
        titulo="Assinatura de Recebimento"
      />

      {/* Preview de Foto */}
      <Dialog open={!!fotoPreview} onOpenChange={() => setFotoPreview(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-2">
          <DialogHeader className="sr-only"><DialogTitle>Visualizar</DialogTitle></DialogHeader>
          {fotoPreview && (
            <div className="relative">
              <img src={fotoPreview} alt="Preview" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
              <Button variant="secondary" size="icon" className="absolute top-2 right-2" onClick={() => setFotoPreview(null)}><X className="h-4 w-4" /></Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
