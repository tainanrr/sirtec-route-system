import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { logApp } from "@/lib/logUtils";
import { usePageState } from "@/contexts/ScrollRestoreContext";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData, CACHE_KEYS } from "@/hooks/useOfflineData";
import { getAppParentRoute } from "@/lib/appNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardCheck,
  Camera,
  FileSignature,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Send,
  ChevronDown,
  ChevronRight,
  Trash2,
  X,
  Plus,
  Eye,
  Lock,
  AlertCircle,
} from "lucide-react";
import { SignatureFullScreen } from "@/components/app/SignatureFullScreen";

interface PerguntaConfig {
  placeholder?: string;
  foto_obrigatoria?: boolean;
  observacao_obrigatoria?: boolean;
  foto_se_sim?: boolean;
  observacao_se_sim?: boolean;
  alerta_se_sim?: string;
  alerta_se_nao?: string;
  dica?: string;
  condicional?: {
    pergunta_id: string;
    valor: string;
    torna_obrigatoria?: boolean;
  };
}

interface Opcao {
  id: string;
  texto: string;
  valor?: string;
  exige_foto?: boolean;
  exige_observacao?: boolean;
}

interface Pergunta {
  id: string;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  opcoes?: Opcao[] | string[];
  ordem: number;
  grupo_id?: string;
  config?: PerguntaConfig;
}

interface GrupoPerguntas {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
  perguntas: Pergunta[];
}

interface Checklist {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  grupos?: GrupoPerguntas[];
  perguntas?: Pergunta[];
  exige_assinatura?: boolean;
  exige_localizacao?: boolean;
}

interface FotoData {
  url: string;
  latitude?: number;
  longitude?: number;
  data_hora?: string;
}

interface Resposta {
  pergunta_id: string;
  resposta: string | string[] | boolean | number | null;
  foto_url?: string;
  fotos?: FotoData[]; // Múltiplas fotos
  assinatura_url?: string;
  observacao?: string;
  foto_latitude?: number;
  foto_longitude?: number;
  foto_data_hora?: string;
  assinatura_latitude?: number;
  assinatura_longitude?: number;
  assinatura_data_hora?: string;
}

export default function AppAPR() {
  const { id: ordemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const { isOnline } = useOfflineSyncContext();
  const { getFromCache } = useOfflineData();
  
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signaturePerguntaId, setSignaturePerguntaId] = useState<string>("");
  const [signatureTitulo, setSignatureTitulo] = useState<string>("");
  const [pendenciasHighlight, setPendenciasHighlight] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [fotoViewer, setFotoViewer] = useState<{ open: boolean; fotos: FotoData[]; index: number }>({ open: false, fotos: [], index: 0 });
  
  // Estado para checklist offline
  const [checklistOfflineCache, setChecklistOfflineCache] = useState<Checklist | null>(null);
  
  // Refs para scroll
  const perguntaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const grupoRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Persistência de rascunho do APR (para voltar exatamente onde estava)
  const pageKey = `app-apr-${ordemId || "sem-id"}`;
  const { getState, saveState } = usePageState<{
    respostas?: Record<string, Resposta>;
    gruposExpandidos?: string[];
  }>(pageKey);
  const hasRestoredDraftRef = useRef(false);

  // Buscar checklist de APR ativo (só online)
  const { data: checklistOnline, isLoading: loadingChecklist } = useQuery({
    queryKey: ["checklist-apr"],
    queryFn: async () => {
      console.log("[APR] Buscando checklist APR ativo...");
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .eq("tipo", "apr")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[APR] Erro ao buscar checklist:", error);
        throw error;
      }
      
      console.log("[APR] Checklist encontrado:", data);
      
      if (data) {
        let grupos: GrupoPerguntas[] = [];
        
        if (data.grupos && Array.isArray(data.grupos) && data.grupos.length > 0) {
          grupos = data.grupos as GrupoPerguntas[];
          console.log("[APR] Usando estrutura de grupos:", grupos.length, "grupos");
        } else if (data.perguntas && Array.isArray(data.perguntas) && data.perguntas.length > 0) {
          const perguntas = data.perguntas as Pergunta[];
          grupos = [{
            id: "grupo-unico",
            nome: "Perguntas",
            ordem: 1,
            perguntas: perguntas,
          }];
          console.log("[APR] Usando estrutura antiga de perguntas:", perguntas.length, "perguntas");
        }
        
        if (grupos.length > 0) {
          setGruposExpandidos(new Set([grupos[0].id]));
        }
        
        return { ...data, grupos } as Checklist;
      }
      return null;
    },
    enabled: isOnline,
  });

  // Buscar checklist do cache quando offline
  useEffect(() => {
    const buscarChecklistDoCache = async () => {
      if (!isOnline && !checklistOfflineCache) {
        console.log("[APR] 📦 Buscando checklists do cache...");
        try {
          const cachedChecklists = await getFromCache(CACHE_KEYS.CHECKLISTS);
          if (cachedChecklists && Array.isArray(cachedChecklists) && cachedChecklists.length > 0) {
            console.log("[APR] Cache encontrado:", cachedChecklists.length, "checklists");
            // Buscar o checklist de tipo APR
            const aprChecklist = cachedChecklists.find((c: any) => c.tipo === "apr" && c.ativo);
            if (aprChecklist) {
              console.log("[APR] ✅ APR encontrada no cache:", aprChecklist.nome);
              
              let grupos: GrupoPerguntas[] = [];
              if (aprChecklist.grupos && Array.isArray(aprChecklist.grupos) && aprChecklist.grupos.length > 0) {
                grupos = aprChecklist.grupos as GrupoPerguntas[];
                console.log("[APR] Usando estrutura de grupos:", grupos.length, "grupos");
              } else if (aprChecklist.perguntas && Array.isArray(aprChecklist.perguntas) && aprChecklist.perguntas.length > 0) {
                const perguntas = aprChecklist.perguntas as Pergunta[];
                grupos = [{
                  id: "grupo-unico",
                  nome: "Perguntas",
                  ordem: 1,
                  perguntas: perguntas,
                }];
                console.log("[APR] Usando estrutura antiga de perguntas:", perguntas.length, "perguntas");
              }
              
              if (grupos.length > 0) {
                setGruposExpandidos(new Set([grupos[0].id]));
              }
              
              setChecklistOfflineCache({ ...aprChecklist, grupos } as Checklist);
            } else {
              console.log("[APR] ❌ Nenhuma APR encontrada no cache");
            }
          }
        } catch (error) {
          console.error("[APR] ❌ Erro ao buscar do cache:", error);
        }
      }
    };
    buscarChecklistDoCache();
  }, [isOnline, checklistOfflineCache, getFromCache]);

  // Usar checklist do React Query ou do cache offline
  const checklist = checklistOnline || checklistOfflineCache;

  // Estado para ordem offline
  const [ordemOfflineCache, setOrdemOfflineCache] = useState<any>(null);

  // Buscar ordem de serviço (só online)
  const { data: ordemOnline } = useQuery({
    queryKey: ["ordem-apr", ordemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("numero, tipo, endereco, status, chegada_local_at")
        .eq("id", ordemId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && isOnline,
  });

  // Buscar ordem do cache quando offline
  useEffect(() => {
    const buscarOrdemDoCache = async () => {
      if (!isOnline && !ordemOfflineCache && ordemId) {
        console.log("[APR] 📦 Buscando ordem do cache...");
        const equipeId = equipe?.id || equipeAuth?.id;
        if (!equipeId) return;
        
        const dataHoje = format(new Date(), "yyyy-MM-dd");
        const cacheKey = `planejamento_dia_${equipeId}_${dataHoje}`;
        
        try {
          const cachedOrdens = await getFromCache(cacheKey);
          if (cachedOrdens && Array.isArray(cachedOrdens) && cachedOrdens.length > 0) {
            const ordemEncontrada = cachedOrdens.find((o: any) => {
              const id = o.id || o.ordem_servico_id || (o.ordens_servico && o.ordens_servico.id);
              return id === ordemId;
            });
            
            if (ordemEncontrada) {
              const dados = ordemEncontrada.ordens_servico || ordemEncontrada;
              console.log("[APR] ✅ Ordem encontrada no cache:", dados.numero);
              setOrdemOfflineCache(dados);
            }
          }
        } catch (error) {
          console.error("[APR] ❌ Erro ao buscar ordem do cache:", error);
        }
      }
    };
    buscarOrdemDoCache();
  }, [isOnline, ordemOfflineCache, ordemId, equipe?.id, equipeAuth?.id, getFromCache]);

  // Usar ordem do React Query ou do cache offline
  const ordem = ordemOnline || ordemOfflineCache;
  
  // Verificar se a equipe já chegou no local (permitir APR apenas após chegada)
  const chegouNoLocal = ordem?.chegada_local_at || 
    ordem?.status === "no_local" || 
    ordem?.status === "em_execucao" || 
    ordem?.status === "em_andamento" || 
    ordem?.status === "concluida" ||
    ordem?.status === "pausada";

  // Verificar se já existe APR preenchida para esta OS
  const { data: respostaExistente } = useQuery({
    queryKey: ["apr-existente", ordemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_respostas")
        .select("*")
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId,
  });

  // Verificar se a APR está concluída (não pode editar)
  const aprConcluida = respostaExistente?.status === 'completo';

  const handleBack = () => {
    const parent = getAppParentRoute(location.pathname);
    navigate(parent || "/app");
  };

  // Restaurar rascunho local (se existir)
  useEffect(() => {
    if (hasRestoredDraftRef.current) return;
    if (!ordemId) return;

    const draft = getState();
    if (draft?.respostas && Object.keys(draft.respostas).length > 0) {
      setRespostas(draft.respostas);
      setGruposExpandidos(new Set(draft.gruposExpandidos || []));
      hasRestoredDraftRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordemId]);

  // Se concluída, limpar rascunho local
  useEffect(() => {
    if (!ordemId) return;
    if (!aprConcluida) return;
    try {
      sessionStorage.removeItem(`page-state-${pageKey}`);
    } catch {
      // ignore
    }
  }, [aprConcluida, ordemId, pageKey]);

  // Salvar rascunho local (debounced) enquanto preenche
  useEffect(() => {
    if (!ordemId) return;
    if (aprConcluida) return;
    const t = window.setTimeout(() => {
      saveState({
        respostas,
        gruposExpandidos: Array.from(gruposExpandidos),
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [respostas, gruposExpandidos, saveState, ordemId, aprConcluida]);

  // Carregar respostas existentes
  useEffect(() => {
    if (respostaExistente?.respostas) {
      // Se já restauramos rascunho local, não sobrescrever automaticamente
      if (hasRestoredDraftRef.current) return;
      const respostasData = typeof respostaExistente.respostas === 'string'
        ? JSON.parse(respostaExistente.respostas)
        : respostaExistente.respostas;
      
      if (Array.isArray(respostasData)) {
        const respostasMap: Record<string, Resposta> = {};
        respostasData.forEach((r: Resposta) => {
          respostasMap[r.pergunta_id] = r;
        });
        setRespostas(respostasMap);
      } else {
        setRespostas(respostasData);
      }
    }
  }, [respostaExistente]);

  const toggleGrupo = (grupoId: string) => {
    setGruposExpandidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(grupoId)) {
        newSet.delete(grupoId);
      } else {
        newSet.add(grupoId);
      }
      return newSet;
    });
  };

  const updateResposta = (perguntaId: string, valor: any, campo: keyof Resposta = 'resposta') => {
    if (aprConcluida) return; // Não permite editar se concluída
    
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
    
    // Remover highlight de pendência quando responder
    setPendenciasHighlight(prev => {
      const newSet = new Set(prev);
      newSet.delete(perguntaId);
      return newSet;
    });
  };
  
  // Atualizar múltiplos campos de uma resposta de uma vez
  const updateRespostaMultiplo = (perguntaId: string, campos: Partial<Resposta>) => {
    if (aprConcluida) return; // Não permite editar se concluída
    
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
    
    // Remover highlight de pendência quando responder
    setPendenciasHighlight(prev => {
      const newSet = new Set(prev);
      newSet.delete(perguntaId);
      return newSet;
    });
  };

  // Obter localização atual
  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn("[APR] Geolocalização não suportada");
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
          console.warn("[APR] Erro ao obter localização:", error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  // Adicionar carimbo na imagem (data/hora e coordenadas)
  const addImageStamp = (
    imageDataUrl: string,
    timestamp: string,
    coords: { latitude: number; longitude: number } | null
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
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
        console.error("[APR] Erro ao carregar imagem para carimbo");
        resolve(imageDataUrl);
      };
      
      img.src = imageDataUrl;
    });
  };

  // Converter arquivo para base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Converter File para dataUrl e adicionar carimbo
  const processImageWithStamp = async (
    file: File,
    coords: { latitude: number; longitude: number } | null
  ): Promise<{ dataUrl: string; timestamp: string }> => {
    const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
    const base64 = await fileToBase64(file);
    const stampedImage = await addImageStamp(base64, timestamp, coords);
    return { dataUrl: stampedImage, timestamp };
  };

  // Upload de foto (agora suporta múltiplas fotos)
  const handleFotoUpload = async (perguntaId: string, file: File, isMultiple: boolean = false) => {
    if (aprConcluida) return; // Não permite editar se concluída
    
    console.log("[APR] Iniciando upload de foto para pergunta:", perguntaId);
    toast.loading("Obtendo localização e processando foto...", { id: "foto-upload" });
    
    try {
      // Obter localização
      const coords = await getCurrentLocation();
      console.log("[APR] Coordenadas obtidas:", coords);

      // Processar imagem com carimbo
      const { dataUrl: stampedImage, timestamp } = await processImageWithStamp(file, coords);
      
      toast.loading("Enviando foto...", { id: "foto-upload" });

      // Converter dataUrl para blob
      const response = await fetch(stampedImage);
      const blob = await response.blob();

      const fileName = `apr/${ordemId}/${perguntaId}_${Date.now()}.jpg`;

      console.log("[APR] Tentando upload para Storage:", fileName);

      // Tentar upload para Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("service-attachments")
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });

      let fotoUrl = stampedImage; // Fallback para base64

      if (!uploadError && uploadData) {
        console.log("[APR] Upload bem sucedido:", uploadData);
        const { data: urlData } = supabase.storage
          .from("service-attachments")
          .getPublicUrl(fileName);
        fotoUrl = urlData.publicUrl;
        console.log("[APR] URL pública:", fotoUrl);
      } else {
        console.error("[APR] Erro no Storage, usando base64:", uploadError);
      }

      const novaFoto: FotoData = {
        url: fotoUrl,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        data_hora: timestamp,
      };

      if (isMultiple) {
        // Adicionar às fotos existentes
        setRespostas(prev => {
          const respostaAtual = prev[perguntaId] || { pergunta_id: perguntaId };
          const fotosAtuais = respostaAtual.fotos || [];
          return {
            ...prev,
            [perguntaId]: {
              ...respostaAtual,
              pergunta_id: perguntaId,
              fotos: [...fotosAtuais, novaFoto],
              // Manter compatibilidade com foto_url para primeira foto
              foto_url: fotosAtuais.length === 0 ? fotoUrl : respostaAtual.foto_url,
              foto_latitude: fotosAtuais.length === 0 ? coords?.latitude : respostaAtual.foto_latitude,
              foto_longitude: fotosAtuais.length === 0 ? coords?.longitude : respostaAtual.foto_longitude,
              foto_data_hora: fotosAtuais.length === 0 ? timestamp : respostaAtual.foto_data_hora,
            },
          };
        });
      } else {
        // Substituir foto única (campos condicionais)
        updateRespostaMultiplo(perguntaId, {
          foto_url: fotoUrl,
          foto_latitude: coords?.latitude,
          foto_longitude: coords?.longitude,
          foto_data_hora: timestamp,
        });
      }

      // Remover highlight de pendência
      setPendenciasHighlight(prev => {
        const newSet = new Set(prev);
        newSet.delete(perguntaId);
        return newSet;
      });

      toast.success("Foto enviada!", { id: "foto-upload" });
    } catch (error: any) {
      console.error("[APR] Erro ao enviar foto:", error);
      
      // Fallback: salvar como base64
      try {
        const coords = await getCurrentLocation();
        const { dataUrl: stampedImage, timestamp } = await processImageWithStamp(file, coords);
        
        const novaFoto: FotoData = {
          url: stampedImage,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          data_hora: timestamp,
        };

        if (isMultiple) {
          setRespostas(prev => {
            const respostaAtual = prev[perguntaId] || { pergunta_id: perguntaId };
            const fotosAtuais = respostaAtual.fotos || [];
            return {
              ...prev,
              [perguntaId]: {
                ...respostaAtual,
                pergunta_id: perguntaId,
                fotos: [...fotosAtuais, novaFoto],
                foto_url: fotosAtuais.length === 0 ? stampedImage : respostaAtual.foto_url,
                foto_latitude: fotosAtuais.length === 0 ? coords?.latitude : respostaAtual.foto_latitude,
                foto_longitude: fotosAtuais.length === 0 ? coords?.longitude : respostaAtual.foto_longitude,
                foto_data_hora: fotosAtuais.length === 0 ? timestamp : respostaAtual.foto_data_hora,
              },
            };
          });
        } else {
          updateRespostaMultiplo(perguntaId, {
            foto_url: stampedImage,
            foto_latitude: coords?.latitude,
            foto_longitude: coords?.longitude,
            foto_data_hora: timestamp,
          });
        }

        toast.success("Foto salva localmente!", { id: "foto-upload" });
      } catch (base64Error) {
        console.error("[APR] Erro ao converter para base64:", base64Error);
        toast.error("Erro ao salvar foto", { id: "foto-upload" });
      }
    }
  };

  // Remover uma foto específica
  const removerFoto = (perguntaId: string, fotoIndex: number) => {
    if (aprConcluida) return;
    
    setRespostas(prev => {
      const respostaAtual = prev[perguntaId];
      if (!respostaAtual?.fotos) return prev;
      
      const novasFotos = respostaAtual.fotos.filter((_, i) => i !== fotoIndex);
      
      return {
        ...prev,
        [perguntaId]: {
          ...respostaAtual,
          fotos: novasFotos,
          // Atualizar foto_url para primeira foto ou null
          foto_url: novasFotos.length > 0 ? novasFotos[0].url : undefined,
          foto_latitude: novasFotos.length > 0 ? novasFotos[0].latitude : undefined,
          foto_longitude: novasFotos.length > 0 ? novasFotos[0].longitude : undefined,
          foto_data_hora: novasFotos.length > 0 ? novasFotos[0].data_hora : undefined,
        },
      };
    });
  };

  // Upload de assinatura
  const handleSignatureSave = async (dataUrl: string) => {
    if (aprConcluida || !signaturePerguntaId) return;
    
    console.log("[APR] Salvando assinatura para pergunta:", signaturePerguntaId);
    toast.loading("Obtendo localização...", { id: "assinatura-upload" });
    
    try {
      // Obter localização
      const coords = await getCurrentLocation();
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
      console.log("[APR] Coordenadas da assinatura:", coords);

      toast.loading("Salvando assinatura...", { id: "assinatura-upload" });

      // Tentar upload para Supabase Storage
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const fileName = `apr/${ordemId}/assinatura_${signaturePerguntaId}_${Date.now()}.png`;

      console.log("[APR] Tentando upload de assinatura para Storage:", fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("service-attachments")
        .upload(fileName, blob, { 
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true,
        });

      let assinaturaUrl = dataUrl; // Fallback para base64

      if (!uploadError && uploadData) {
        console.log("[APR] Upload de assinatura bem sucedido:", uploadData);
        const { data: urlData } = supabase.storage
          .from("service-attachments")
          .getPublicUrl(fileName);
        assinaturaUrl = urlData.publicUrl;
        console.log("[APR] URL pública da assinatura:", assinaturaUrl);
      } else {
        console.error("[APR] Erro no Storage para assinatura, usando base64:", uploadError);
      }

      // Atualiza assinatura_url, coordenadas e marca resposta como true
      updateRespostaMultiplo(signaturePerguntaId, { 
        assinatura_url: assinaturaUrl, 
        resposta: true,
        assinatura_latitude: coords?.latitude,
        assinatura_longitude: coords?.longitude,
        assinatura_data_hora: timestamp,
      });
      
      toast.success("Assinatura salva!", { id: "assinatura-upload" });
    } catch (error: any) {
      console.error("[APR] Erro ao salvar assinatura:", error);
      
      // Fallback: salvar o dataUrl diretamente
      try {
        const coords = await getCurrentLocation();
        const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
        updateRespostaMultiplo(signaturePerguntaId, { 
          assinatura_url: dataUrl, 
          resposta: true,
          assinatura_latitude: coords?.latitude,
          assinatura_longitude: coords?.longitude,
          assinatura_data_hora: timestamp,
        });
        toast.success("Assinatura salva localmente!", { id: "assinatura-upload" });
      } catch (fallbackError) {
        console.error("[APR] Erro no fallback:", fallbackError);
        toast.error("Erro ao salvar assinatura", { id: "assinatura-upload" });
      }
    }
  };

  // Verificar se pergunta exige foto baseado na resposta
  const perguntaExigeFoto = (pergunta: Pergunta): boolean => {
    const resposta = respostas[pergunta.id];
    if (!resposta) return false;

    // Verificar config.foto_se_sim
    if (pergunta.config?.foto_se_sim && resposta.resposta === "sim") {
      return true;
    }

    // Verificar opção selecionada
    if (pergunta.opcoes && resposta.resposta) {
      const opcoes = getOpcoes(pergunta);
      const opcaoSelecionada = opcoes.find(o => 
        o.valor === resposta.resposta || o.texto === resposta.resposta
      );
      if (opcaoSelecionada?.exige_foto) {
        return true;
      }
    }

    return false;
  };

  // Verificar se pergunta exige observação baseado na resposta
  const perguntaExigeObservacao = (pergunta: Pergunta): boolean => {
    const resposta = respostas[pergunta.id];
    if (!resposta) return false;

    if (pergunta.config?.observacao_se_sim && resposta.resposta === "sim") {
      return true;
    }

    if (pergunta.opcoes && resposta.resposta) {
      const opcoes = getOpcoes(pergunta);
      const opcaoSelecionada = opcoes.find(o => 
        o.valor === resposta.resposta || o.texto === resposta.resposta
      );
      if (opcaoSelecionada?.exige_observacao) {
        return true;
      }
    }

    return false;
  };

  // Obter alerta para a resposta atual
  const getAlertaResposta = (pergunta: Pergunta): string | null => {
    const resposta = respostas[pergunta.id];
    if (!resposta) return null;

    if (pergunta.config?.alerta_se_sim && resposta.resposta === "sim") {
      return pergunta.config.alerta_se_sim;
    }

    if (pergunta.config?.alerta_se_nao && resposta.resposta === "nao") {
      return pergunta.config.alerta_se_nao;
    }

    return null;
  };

  const todasPerguntas = checklist?.grupos?.flatMap(g => g.perguntas) || [];

  // Verificar pendências e retornar lista
  const verificarPendencias = (): { perguntaId: string; grupoId: string; tipo: string }[] => {
    const pendencias: { perguntaId: string; grupoId: string; tipo: string }[] = [];
    
    if (!checklist?.grupos) return pendencias;
    
    for (const grupo of checklist.grupos) {
      for (const pergunta of grupo.perguntas) {
        const resposta = respostas[pergunta.id];
        
        // Verificar obrigatórias
        if (pergunta.obrigatoria) {
          if (pergunta.tipo === 'foto') {
            const fotos = resposta?.fotos || [];
            if (fotos.length === 0 && !resposta?.foto_url) {
              pendencias.push({ perguntaId: pergunta.id, grupoId: grupo.id, tipo: 'foto_obrigatoria' });
            }
          } else if (pergunta.tipo === 'assinatura') {
            if (!resposta?.assinatura_url) {
              pendencias.push({ perguntaId: pergunta.id, grupoId: grupo.id, tipo: 'assinatura_obrigatoria' });
            }
          } else {
            if (resposta?.resposta === null || resposta?.resposta === undefined || resposta?.resposta === '') {
              pendencias.push({ perguntaId: pergunta.id, grupoId: grupo.id, tipo: 'resposta_obrigatoria' });
            }
          }
        }
        
        // Verificar fotos condicionais
        if (perguntaExigeFoto(pergunta) && !resposta?.foto_url) {
          pendencias.push({ perguntaId: pergunta.id, grupoId: grupo.id, tipo: 'foto_condicional' });
        }
        
        // Verificar observações condicionais
        if (perguntaExigeObservacao(pergunta) && !resposta?.observacao) {
          pendencias.push({ perguntaId: pergunta.id, grupoId: grupo.id, tipo: 'observacao_condicional' });
        }
      }
    }
    
    return pendencias;
  };

  // Scroll para primeira pendência
  const scrollParaPendencia = (pendencias: { perguntaId: string; grupoId: string; tipo: string }[]) => {
    if (pendencias.length === 0) return;
    
    const primeiraPendencia = pendencias[0];
    
    // Expandir o grupo
    setGruposExpandidos(prev => {
      const newSet = new Set(prev);
      newSet.add(primeiraPendencia.grupoId);
      return newSet;
    });
    
    // Aguardar expansão e fazer scroll
    setTimeout(() => {
      const element = perguntaRefs.current[primeiraPendencia.perguntaId];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  // Tentar salvar APR
  const tentarSalvarAPR = () => {
    if (aprConcluida) {
      toast.error("Esta APR já foi concluída e não pode ser editada.");
      return;
    }
    
    const pendencias = verificarPendencias();
    
    if (pendencias.length > 0) {
      // Destacar pendências
      const pendenciasIds = new Set(pendencias.map(p => p.perguntaId));
      setPendenciasHighlight(pendenciasIds);
      
      // Scroll para primeira pendência
      scrollParaPendencia(pendencias);
      
      // Mensagem de erro
      const tiposErro = new Set(pendencias.map(p => p.tipo));
      let mensagem = `Preencha todos os campos obrigatórios (${pendencias.length} pendência(s))`;
      
      if (tiposErro.has('foto_obrigatoria') || tiposErro.has('foto_condicional')) {
        mensagem = `Adicione as fotos obrigatórias (${pendencias.filter(p => p.tipo.includes('foto')).length} pendente(s))`;
      } else if (tiposErro.has('assinatura_obrigatoria')) {
        mensagem = `Adicione as assinaturas obrigatórias`;
      }
      
      toast.error(mensagem);
      return;
    }
    
    // Abrir dialog de confirmação
    setConfirmDialogOpen(true);
  };

  // Salvar APR
  const salvarAPR = async () => {
    if (!checklist) return;

    setSaving(true);
    try {
      const equipeId = equipe?.id || equipeAuth?.id;
      const respostasArray = Object.values(respostas);

      const payload = {
        checklist_id: checklist.id,
        ordem_servico_id: ordemId,
        equipe_id: equipeId,
        respostas: respostasArray,
        status: 'completo',
      };

      if (respostaExistente && !aprConcluida) {
        const { error } = await supabase
          .from("checklist_respostas")
          .update(payload)
          .eq("id", respostaExistente.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("checklist_respostas")
          .insert(payload);

        if (error) throw error;
      }

      if (equipeId) {
        await supabase.from("planejamento_logs").insert({
          ordem_servico_id: ordemId,
          acao: "apr_preenchida",
          descricao: `APR "${checklist.nome}" preenchida e concluída`,
          dados_novos: { checklist_id: checklist.id, respostas_count: respostasArray.length },
          created_by: equipeId,
        });
        
        // Log do sistema
        logApp(
          respostaExistente && !aprConcluida ? "editar" : "criar",
          "app",
          "checklist_respostas",
          respostaExistente?.id || "",
          {
            id: equipeId,
            nome: equipe?.codigo || equipeAuth?.codigo || "",
            equipeId,
            equipeCodigo: equipe?.codigo || equipeAuth?.codigo || ""
          },
          null,
          payload,
          `Preencheu APR "${checklist.nome}" para OS ${ordemId}`
        );
      }

      toast.success("APR concluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["apr-existente", ordemId] });
      handleBack();
    } catch (error: any) {
      console.error("Erro ao salvar APR:", error);
      toast.error("Erro ao salvar APR");
    } finally {
      setSaving(false);
      setConfirmDialogOpen(false);
    }
  };

  const getOpcoes = (pergunta: Pergunta): Opcao[] => {
    if (!pergunta.opcoes) return [];
    
    if (pergunta.opcoes.length > 0 && typeof pergunta.opcoes[0] === 'object') {
      return pergunta.opcoes as Opcao[];
    }
    
    return (pergunta.opcoes as string[]).map((texto, i) => ({
      id: `opt-${i}`,
      texto,
      valor: texto,
    }));
  };

  const renderCampoResposta = (pergunta: Pergunta) => {
    const resposta = respostas[pergunta.id];
    const opcoes = getOpcoes(pergunta);
    const exigeFoto = perguntaExigeFoto(pergunta);
    const exigeObservacao = perguntaExigeObservacao(pergunta);
    const alerta = getAlertaResposta(pergunta);
    const isPendente = pendenciasHighlight.has(pergunta.id);

    const campoBase = (() => {
      switch (pergunta.tipo) {
        case 'texto':
          return (
            <Input
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder={pergunta.config?.placeholder || "Digite sua resposta..."}
              disabled={aprConcluida}
              className={isPendente ? "border-red-500 ring-2 ring-red-200" : ""}
            />
          );

        case 'texto_longo':
          return (
            <Textarea
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder={pergunta.config?.placeholder || "Digite sua resposta..."}
              rows={3}
              disabled={aprConcluida}
              className={isPendente ? "border-red-500 ring-2 ring-red-200" : ""}
            />
          );

        case 'numero':
          return (
            <Input
              type="number"
              value={(resposta?.resposta as number) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value ? Number(e.target.value) : null)}
              placeholder="0"
              className={`w-32 ${isPendente ? "border-red-500 ring-2 ring-red-200" : ""}`}
              disabled={aprConcluida}
            />
          );

        case 'sim_nao':
          return (
            <RadioGroup
              value={resposta?.resposta as string || ''}
              onValueChange={(value) => updateResposta(pergunta.id, value)}
              className={`flex gap-4 ${isPendente ? "p-2 rounded-lg bg-red-50 border border-red-300" : ""}`}
              disabled={aprConcluida}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nao" id={`${pergunta.id}-nao`} disabled={aprConcluida} />
                <Label htmlFor={`${pergunta.id}-nao`} className="text-green-600 font-medium cursor-pointer">Não</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sim" id={`${pergunta.id}-sim`} disabled={aprConcluida} />
                <Label htmlFor={`${pergunta.id}-sim`} className="text-red-600 font-medium cursor-pointer">Sim</Label>
              </div>
            </RadioGroup>
          );

        case 'selecao_unica':
        case 'dropdown':
          return (
            <RadioGroup
              value={resposta?.resposta as string || ''}
              onValueChange={(value) => updateResposta(pergunta.id, value)}
              className={`space-y-2 ${isPendente ? "p-2 rounded-lg bg-red-50 border border-red-300" : ""}`}
              disabled={aprConcluida}
            >
              {opcoes.map((opcao) => (
                <div key={opcao.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={opcao.valor || opcao.texto} id={`${pergunta.id}-${opcao.id}`} disabled={aprConcluida} />
                  <Label htmlFor={`${pergunta.id}-${opcao.id}`} className="cursor-pointer">{opcao.texto}</Label>
                </div>
              ))}
            </RadioGroup>
          );

        case 'multipla_escolha':
          const selecionados = (resposta?.resposta as string[]) || [];
          return (
            <div className={`space-y-2 max-h-64 overflow-y-auto ${isPendente ? "p-2 rounded-lg bg-red-50 border border-red-300" : ""}`}>
              {opcoes.map((opcao) => (
                <div key={opcao.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${pergunta.id}-${opcao.id}`}
                    checked={selecionados.includes(opcao.texto)}
                    disabled={aprConcluida}
                    onCheckedChange={(checked) => {
                      if (aprConcluida) return;
                      const novos = checked
                        ? [...selecionados, opcao.texto]
                        : selecionados.filter(s => s !== opcao.texto);
                      updateResposta(pergunta.id, novos);
                    }}
                  />
                  <Label htmlFor={`${pergunta.id}-${opcao.id}`} className="text-sm cursor-pointer">{opcao.texto}</Label>
                </div>
              ))}
            </div>
          );

        case 'foto':
          // Tipo foto agora suporta múltiplas fotos e só aceita câmera
          const fotos = resposta?.fotos || [];
          
          return (
            <div className={`space-y-3 ${isPendente ? "p-3 rounded-lg bg-red-50 border-2 border-red-400" : ""}`}>
              {/* Grid de fotos existentes */}
              {fotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((foto, index) => (
                    <div key={index} className="relative group">
                      <button
                        type="button"
                        onClick={() => setFotoViewer({ open: true, fotos, index })}
                        className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-violet-400 transition-colors"
                      >
                        <img
                          src={foto.url}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {!aprConcluida && (
                        <button
                          type="button"
                          onClick={() => removerFoto(pergunta.id, index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Botão para adicionar mais fotos */}
              {!aprConcluida && (
                <div>
                  <input
                    id={`foto-input-${pergunta.id}`}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFotoUpload(pergunta.id, file, true);
                      }
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor={`foto-input-${pergunta.id}`}
                    className={`flex flex-col items-center justify-center gap-2 w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      fotos.length > 0 
                        ? "border-violet-300 bg-violet-50/50 hover:bg-violet-100/50" 
                        : "border-gray-300 hover:bg-muted/50"
                    }`}
                  >
                    {fotos.length > 0 ? (
                      <>
                        <Plus className="h-6 w-6 text-violet-500" />
                        <span className="text-sm text-violet-600 font-medium">Adicionar outra foto</span>
                      </>
                    ) : (
                      <>
                        <Camera className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Tirar Foto</span>
                        <span className="text-xs text-muted-foreground">(Apenas câmera)</span>
                      </>
                    )}
                  </label>
                </div>
              )}
              
              {fotos.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {fotos.length} foto(s) adicionada(s) • Toque para ampliar
                </p>
              )}
              
              {pergunta.config?.dica && (
                <p className="text-xs text-muted-foreground">{pergunta.config.dica}</p>
              )}
              
              {isPendente && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Foto obrigatória</span>
                </div>
              )}
            </div>
          );

        case 'assinatura':
          return (
            <div className={`space-y-2 ${isPendente ? "p-3 rounded-lg bg-red-50 border-2 border-red-400" : ""}`}>
              {resposta?.assinatura_url ? (
                <div className="relative">
                  <div className="bg-white rounded-lg border-2 border-gray-200 p-2">
                    <img
                      src={resposta.assinatura_url}
                      alt="Assinatura"
                      className="w-full h-40 object-contain"
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
                  {!aprConcluida && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        updateRespostaMultiplo(pergunta.id, {
                          assinatura_url: undefined,
                          resposta: null,
                          assinatura_latitude: undefined,
                          assinatura_longitude: undefined,
                          assinatura_data_hora: undefined,
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  variant="outline"
                  className={`w-full h-36 border-dashed border-2 ${isPendente ? "border-red-400 bg-red-50" : ""}`}
                  disabled={aprConcluida}
                  onClick={() => {
                    setSignaturePerguntaId(pergunta.id);
                    setSignatureTitulo(pergunta.texto);
                    setSignatureOpen(true);
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileSignature className={`h-10 w-10 ${isPendente ? "text-red-500" : "text-violet-500"}`} />
                    <span className={`text-sm ${isPendente ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                      {isPendente ? "Assinatura obrigatória" : "Toque para assinar"}
                    </span>
                    <span className="text-xs text-muted-foreground">Abre em tela cheia</span>
                  </div>
                </Button>
              )}
              
              {isPendente && !resposta?.assinatura_url && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Assinatura obrigatória</span>
                </div>
              )}
            </div>
          );

        case 'conforme_nao_conforme':
          return (
            <RadioGroup
              value={resposta?.resposta as string || ''}
              onValueChange={(value) => updateResposta(pergunta.id, value)}
              className={`flex gap-4 ${isPendente ? "p-2 rounded-lg bg-red-50 border border-red-300" : ""}`}
              disabled={aprConcluida}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="conforme" id={`${pergunta.id}-conforme`} disabled={aprConcluida} />
                <Label htmlFor={`${pergunta.id}-conforme`} className="text-green-600 font-medium cursor-pointer">Conforme</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nao_conforme" id={`${pergunta.id}-nao_conforme`} disabled={aprConcluida} />
                <Label htmlFor={`${pergunta.id}-nao_conforme`} className="text-red-600 font-medium cursor-pointer">Não Conforme</Label>
              </div>
            </RadioGroup>
          );

        case 'data':
          return (
            <Input
              type="date"
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              className={`w-48 ${isPendente ? "border-red-500 ring-2 ring-red-200" : ""}`}
              disabled={aprConcluida}
            />
          );

        case 'hora':
          return (
            <Input
              type="time"
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              className={`w-32 ${isPendente ? "border-red-500 ring-2 ring-red-200" : ""}`}
              disabled={aprConcluida}
            />
          );

        default:
          return (
            <Input
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder="Digite sua resposta..."
              disabled={aprConcluida}
              className={isPendente ? "border-red-500 ring-2 ring-red-200" : ""}
            />
          );
      }
    })();

    return (
      <div className="space-y-3">
        {campoBase}
        
        {/* Alerta condicional */}
        {alerta && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 font-medium">{alerta}</p>
          </div>
        )}

        {/* Campo de foto condicional */}
        {exigeFoto && pergunta.tipo !== 'foto' && (() => {
          const inputFotoCondId = `foto-cond-input-${pergunta.id}`;
          const fotoCondPendente = isPendente && !resposta?.foto_url;
          
          return (
            <div className={`space-y-2 p-3 rounded-lg ${fotoCondPendente ? "bg-red-100 border-2 border-red-400" : "bg-red-50 border border-red-200"}`}>
              <p className={`text-sm font-medium flex items-center gap-2 ${fotoCondPendente ? "text-red-700" : "text-red-700"}`}>
                <Camera className="h-4 w-4" />
                Foto obrigatória para esta resposta
              </p>
              <input
                id={inputFotoCondId}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={aprConcluida}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFotoUpload(pergunta.id, file, false);
                  e.target.value = '';
                }}
              />
              {resposta?.foto_url ? (
                <div className="relative">
                  <img
                    src={resposta.foto_url}
                    alt="Foto"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  {!aprConcluida && (
                    <label
                      htmlFor={inputFotoCondId}
                      className="absolute bottom-2 right-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 cursor-pointer"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Trocar
                    </label>
                  )}
                </div>
              ) : (
                <label
                  htmlFor={inputFotoCondId}
                  className={`flex flex-col items-center justify-center gap-1 w-full h-24 border-2 border-dashed rounded-lg bg-white cursor-pointer transition-colors ${
                    aprConcluida ? "opacity-50 cursor-not-allowed" : "hover:bg-red-100/50"
                  }`}
                >
                  <Camera className="h-6 w-6 text-red-500" />
                  <span className="text-xs text-red-600">Adicionar Foto (Câmera)</span>
                </label>
              )}
            </div>
          );
        })()}

        {/* Campo de observação condicional */}
        {exigeObservacao && (
          <div className={`space-y-2 p-3 rounded-lg ${isPendente && !resposta?.observacao ? "bg-amber-100 border-2 border-amber-400" : "bg-amber-50 border border-amber-200"}`}>
            <p className="text-sm text-amber-700 font-medium">
              Observação obrigatória para esta resposta
            </p>
            <Textarea
              value={resposta?.observacao || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value, 'observacao')}
              placeholder="Descreva a situação encontrada..."
              rows={2}
              className="bg-white"
              disabled={aprConcluida}
            />
          </div>
        )}
      </div>
    );
  };

  const isPerguntaRespondida = (pergunta: Pergunta): boolean => {
    const resposta = respostas[pergunta.id];
    if (!resposta) return false;
    if (pergunta.tipo === 'foto') {
      const fotos = resposta.fotos || [];
      return fotos.length > 0 || !!resposta.foto_url;
    }
    if (pergunta.tipo === 'assinatura') return !!resposta.assinatura_url;
    if (Array.isArray(resposta.resposta)) return resposta.resposta.length > 0;
    return resposta.resposta !== null && resposta.resposta !== undefined && resposta.resposta !== '';
  };
  
  // Verificar se uma pergunta condicional está visível (sua condição foi satisfeita)
  const isPerguntaCondicionalVisivel = (pergunta: Pergunta): boolean => {
    if (!pergunta.config?.condicional) return true; // Não é condicional, está sempre visível
    
    const { pergunta_id, valor } = pergunta.config.condicional;
    const respostaPerguntaOrigem = respostas[pergunta_id];
    
    if (!respostaPerguntaOrigem) return false;
    
    // Verificar se a resposta da pergunta de origem corresponde ao valor esperado
    const respostaValor = respostaPerguntaOrigem.resposta;
    if (Array.isArray(respostaValor)) {
      return respostaValor.includes(valor);
    }
    return String(respostaValor).toLowerCase() === String(valor).toLowerCase();
  };
  
  // Verificar se uma pergunta é efetivamente obrigatória 
  // (obrigatória nativa OU tornou-se obrigatória por condição e está visível)
  const isPerguntaEfetivamenteObrigatoria = (pergunta: Pergunta): boolean => {
    // Se é obrigatória nativa, sempre conta
    if (pergunta.obrigatoria) return true;
    
    // Se tem configuração condicional que a torna obrigatória e está visível
    if (pergunta.config?.condicional?.torna_obrigatoria && isPerguntaCondicionalVisivel(pergunta)) {
      return true;
    }
    
    return false;
  };

  const getProgressoGrupo = (grupo: GrupoPerguntas) => {
    // Contar perguntas efetivamente obrigatórias (incluindo condicionais visíveis)
    const perguntasObrigatoriasGrupo = grupo.perguntas.filter(p => isPerguntaEfetivamenteObrigatoria(p));
    const obrigatoriasRespondidas = perguntasObrigatoriasGrupo.filter(p => isPerguntaRespondida(p)).length;
    const totalObrigatorias = perguntasObrigatoriasGrupo.length;
    
    // Para exibição, mostrar total de perguntas respondidas vs total
    const respondidas = grupo.perguntas.filter(p => isPerguntaRespondida(p)).length;
    
    return { 
      respondidas, 
      total: grupo.perguntas.length,
      obrigatoriasCompletas: totalObrigatorias === 0 || obrigatoriasRespondidas === totalObrigatorias
    };
  };

  if (loadingChecklist) {
    return (
      <div className="pb-6">
        <div className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!checklist || !checklist.grupos || checklist.grupos.length === 0) {
    return (
      <div className="pb-6">
        <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold">APR</span>
          </div>
        </div>
        <div className="p-4">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
              <p className="font-medium text-amber-800">Nenhum checklist de APR configurado</p>
              <p className="text-sm text-amber-600 mt-1">
                Entre em contato com o administrador para configurar um checklist de APR.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Filtrar perguntas efetivamente obrigatórias (incluindo condicionais visíveis)
  const perguntasObrigatorias = todasPerguntas.filter(p => isPerguntaEfetivamenteObrigatoria(p));
  const perguntasObrigatoriasRespondidas = perguntasObrigatorias.filter(p => isPerguntaRespondida(p)).length;
  const totalPerguntasObrigatorias = perguntasObrigatorias.length;
  const progresso = totalPerguntasObrigatorias > 0 
    ? Math.round((perguntasObrigatoriasRespondidas / totalPerguntasObrigatorias) * 100) 
    : 0;
  
  // Manter contadores totais para exibição
  const perguntasRespondidas = todasPerguntas.filter(p => isPerguntaRespondida(p)).length;
  const totalPerguntas = todasPerguntas.length;

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-violet-600" />
              <span className="font-semibold text-sm">{checklist.nome}</span>
            </div>
            {ordem && (
              <p className="text-xs text-muted-foreground">
                OS #{ordem.numero} - {ordem.tipo}
              </p>
            )}
          </div>
          {aprConcluida ? (
            <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50">
              <Lock className="h-3 w-3 mr-1" />
              Concluída
            </Badge>
          ) : respostaExistente ? (
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Em andamento
            </Badge>
          ) : null}
        </div>

        {/* Barra de progresso */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{perguntasObrigatoriasRespondidas} de {totalPerguntasObrigatorias} obrigatórias respondidas</span>
            <span>{progresso}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${aprConcluida ? "bg-amber-500" : "bg-violet-600"}`}
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </div>

      {/* Aviso de APR concluída */}
      {aprConcluida && (
        <div className="mx-4 mt-4">
          <Card className="bg-amber-50 border-amber-300">
            <CardContent className="p-4 flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">APR Concluída</p>
                <p className="text-sm text-amber-700 mt-1">
                  Esta APR já foi concluída e não pode ser editada. Você pode apenas consultar as informações.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aviso de bloqueio - ainda não chegou no local */}
      {!chegouNoLocal && !aprConcluida && (
        <div className="mx-4 mt-4">
          <Card className="bg-orange-50 border-orange-300">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Aguardando Chegada no Local</p>
                <p className="text-sm text-orange-700 mt-1">
                  A APR só pode ser preenchida após a chegada no local da OS. 
                  Registre sua chegada antes de preencher a Análise Preliminar de Riscos.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grupos e Perguntas */}
      <div className={`p-4 space-y-3 ${!chegouNoLocal && !aprConcluida ? 'opacity-50 pointer-events-none' : ''}`}>
        {checklist.descricao && (
          <Card className="bg-violet-50 border-violet-200">
            <CardContent className="p-4">
              <p className="text-sm text-violet-800">{checklist.descricao}</p>
            </CardContent>
          </Card>
        )}

        {checklist.grupos
          .sort((a, b) => a.ordem - b.ordem)
          .map((grupo) => {
            const { respondidas, total, obrigatoriasCompletas } = getProgressoGrupo(grupo);
            const isExpanded = gruposExpandidos.has(grupo.id);
            // Grupo fica verde quando todas as obrigatórias estão preenchidas
            const grupoCompleto = obrigatoriasCompletas && total > 0;
            const temPendencia = grupo.perguntas.some(p => pendenciasHighlight.has(p.id));

            return (
              <Collapsible
                key={grupo.id}
                open={isExpanded}
                onOpenChange={() => toggleGrupo(grupo.id)}
              >
                <Card 
                  ref={(el) => grupoRefs.current[grupo.id] = el}
                  className={`${grupoCompleto ? 'border-green-300 bg-green-50/50' : ''} ${temPendencia ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <CardTitle className={`text-sm font-semibold ${temPendencia ? "text-red-700" : ""}`}>
                            {grupo.nome}
                          </CardTitle>
                          {temPendencia && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <Badge 
                          variant={grupoCompleto ? "default" : temPendencia ? "destructive" : "secondary"}
                          className={grupoCompleto ? "bg-green-600" : ""}
                        >
                          {respondidas}/{total}
                        </Badge>
                      </div>
                      {grupo.descricao && (
                        <p className="text-xs text-muted-foreground ml-6">{grupo.descricao}</p>
                      )}
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {grupo.perguntas
                        .sort((a, b) => a.ordem - b.ordem)
                        .map((pergunta, index) => {
                          const respondida = isPerguntaRespondida(pergunta);
                          const isPendente = pendenciasHighlight.has(pergunta.id);

                          return (
                            <div 
                              key={pergunta.id}
                              ref={(el) => perguntaRefs.current[pergunta.id] = el}
                              className={`p-3 rounded-lg border transition-all ${
                                isPendente 
                                  ? 'border-red-400 bg-red-50 ring-2 ring-red-200 animate-pulse' 
                                  : respondida 
                                    ? 'border-green-200 bg-green-50/50' 
                                    : 'border-muted bg-muted/20'
                              }`}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <Badge 
                                  variant="outline" 
                                  className={`shrink-0 text-xs ${
                                    isPendente 
                                      ? 'bg-red-100 text-red-700 border-red-300' 
                                      : respondida 
                                        ? 'bg-green-100 text-green-700 border-green-300' 
                                        : ''
                                  }`}
                                >
                                  {grupo.ordem}.{index + 1}
                                </Badge>
                                <span className={`text-sm flex-1 ${isPendente ? "text-red-800 font-medium" : ""}`}>
                                  {pergunta.texto}
                                  {pergunta.obrigatoria && <span className="text-red-500 ml-1">*</span>}
                                </span>
                              </div>
                              {pergunta.config?.dica && pergunta.tipo !== 'foto' && (
                                <p className="text-xs text-muted-foreground mb-2 ml-8">{pergunta.config.dica}</p>
                              )}
                              {renderCampoResposta(pergunta)}
                            </div>
                          );
                        })}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}

        {/* Botão Salvar */}
        {!aprConcluida && chegouNoLocal && (
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            size="lg"
            onClick={tentarSalvarAPR}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Send className="h-5 w-5 mr-2" />
            )}
            {respostaExistente ? 'Concluir APR' : 'Enviar APR'}
          </Button>
        )}
      </div>

      {/* Dialog de Assinatura em Tela Cheia */}
      <SignatureFullScreen
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onSave={handleSignatureSave}
        titulo={signatureTitulo}
      />

      {/* Dialog de Confirmação */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Conclusão da APR
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong className="text-foreground">Atenção:</strong> Após concluir a APR, ela <strong className="text-red-600">não poderá mais ser editada</strong>.
              </p>
              <p>
                Certifique-se de que todas as informações estão corretas antes de prosseguir.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={salvarAPR}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar e Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Visualizador de Fotos */}
      <Dialog open={fotoViewer.open} onOpenChange={(open) => setFotoViewer(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 bg-black/95">
          <div className="relative flex flex-col h-full min-h-[60vh]">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <p className="text-sm opacity-70">
                    Foto {fotoViewer.index + 1} de {fotoViewer.fotos.length}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setFotoViewer(prev => ({ ...prev, open: false }))}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Imagem */}
            <div className="flex-1 flex items-center justify-center p-4 pt-16 pb-20">
              {fotoViewer.fotos[fotoViewer.index]?.url && (
                <img
                  src={fotoViewer.fotos[fotoViewer.index].url}
                  alt={`Foto ${fotoViewer.index + 1}`}
                  className="max-w-full max-h-[60vh] object-contain rounded"
                />
              )}
            </div>

            {/* Footer com informações */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="text-white text-center space-y-1 text-sm">
                {fotoViewer.fotos[fotoViewer.index]?.data_hora && (
                  <p>📅 {fotoViewer.fotos[fotoViewer.index].data_hora}</p>
                )}
                {fotoViewer.fotos[fotoViewer.index]?.latitude && fotoViewer.fotos[fotoViewer.index]?.longitude && (
                  <p>📍 {fotoViewer.fotos[fotoViewer.index].latitude?.toFixed(6)}, {fotoViewer.fotos[fotoViewer.index].longitude?.toFixed(6)}</p>
                )}
              </div>
              
              {/* Navegação */}
              {fotoViewer.fotos.length > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                  {fotoViewer.fotos.map((_, index) => (
                    <button
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === fotoViewer.index
                          ? "bg-white w-4"
                          : "bg-white/50 hover:bg-white/80"
                      }`}
                      onClick={() => setFotoViewer(prev => ({ ...prev, index }))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
