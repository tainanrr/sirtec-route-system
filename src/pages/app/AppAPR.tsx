import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
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
  DialogFooter,
} from "@/components/ui/dialog";
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
} from "lucide-react";

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

interface Resposta {
  pergunta_id: string;
  resposta: string | string[] | boolean | number | null;
  foto_url?: string;
  assinatura_url?: string;
  observacao?: string;
  foto_latitude?: number;
  foto_longitude?: number;
  foto_data_hora?: string;
  assinatura_latitude?: number;
  assinatura_longitude?: number;
  assinatura_data_hora?: string;
}

// Componente de Canvas para Assinatura
function SignatureCanvas({
  open,
  onClose,
  onSave,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  title: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (open && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Configurar canvas
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2; // Retina display
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      setHasDrawn(false);
    }
  }, [open]);

  const getCoordinates = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (!hasDrawn) {
      toast.error("Por favor, faça sua assinatura antes de salvar");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-lg p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Desenhe sua assinatura no campo abaixo usando o dedo ou caneta.
          </p>

          <div className="relative border-2 border-dashed rounded-lg bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-48 touch-none cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-sm">Assine aqui</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={clearCanvas} className="flex-1 sm:flex-none">
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button onClick={handleSave} className="flex-1 sm:flex-none bg-violet-600 hover:bg-violet-700">
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AppAPR() {
  const { id: ordemId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [signatureDialog, setSignatureDialog] = useState<{
    open: boolean;
    perguntaId: string;
    title: string;
  }>({ open: false, perguntaId: "", title: "" });

  // Buscar checklist de APR ativo
  const { data: checklist, isLoading: loadingChecklist } = useQuery({
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
  });

  // Buscar ordem de serviço
  const { data: ordem } = useQuery({
    queryKey: ["ordem-apr", ordemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("numero, tipo, endereco")
        .eq("id", ordemId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId,
  });

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

  // Carregar respostas existentes
  useEffect(() => {
    if (respostaExistente?.respostas) {
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
  
  // Atualizar múltiplos campos de uma resposta de uma vez
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

  // Converter arquivo para base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
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
        const fontSize = Math.max(12, Math.floor(img.width / 40));
        ctx.font = `bold ${fontSize}px Arial`;
        
        // Preparar textos
        const line1 = timestamp;
        const line2 = coords ? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` : "Sem GPS";
        
        // Medir textos
        const metrics1 = ctx.measureText(line1);
        const metrics2 = ctx.measureText(line2);
        const maxWidth = Math.max(metrics1.width, metrics2.width);
        const lineHeight = fontSize * 1.3;
        const padding = fontSize * 0.5;
        const boxHeight = lineHeight * 2 + padding * 2;
        const boxWidth = maxWidth + padding * 2;

        // Desenhar fundo semi-transparente
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, 0, boxWidth, boxHeight);

        // Desenhar textos
        ctx.fillStyle = "#ffffff";
        ctx.fillText(line1, padding, padding + fontSize);
        ctx.fillText(line2, padding, padding + fontSize + lineHeight);

        // Converter para base64
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      
      img.onerror = () => {
        console.error("[APR] Erro ao carregar imagem para carimbo");
        resolve(imageDataUrl);
      };
      
      img.src = imageDataUrl;
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

  // Upload de foto
  const handleFotoUpload = async (perguntaId: string, file: File) => {
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

      if (uploadError) {
        console.error("[APR] Erro no Storage, usando base64:", uploadError);
        // Fallback: salvar como base64 com coordenadas
        updateRespostaMultiplo(perguntaId, {
          foto_url: stampedImage,
          foto_latitude: coords?.latitude,
          foto_longitude: coords?.longitude,
          foto_data_hora: timestamp,
        });
        toast.success("Foto salva!", { id: "foto-upload" });
        return;
      }

      console.log("[APR] Upload bem sucedido:", uploadData);

      const { data: urlData } = supabase.storage
        .from("service-attachments")
        .getPublicUrl(fileName);

      console.log("[APR] URL pública:", urlData.publicUrl);

      // Atualiza foto_url e coordenadas
      updateRespostaMultiplo(perguntaId, {
        foto_url: urlData.publicUrl,
        foto_latitude: coords?.latitude,
        foto_longitude: coords?.longitude,
        foto_data_hora: timestamp,
      });
      toast.success("Foto enviada!", { id: "foto-upload" });
    } catch (error: any) {
      console.error("[APR] Erro ao enviar foto:", error);
      
      // Fallback: salvar como base64
      try {
        const coords = await getCurrentLocation();
        const { dataUrl: stampedImage, timestamp } = await processImageWithStamp(file, coords);
        updateRespostaMultiplo(perguntaId, {
          foto_url: stampedImage,
          foto_latitude: coords?.latitude,
          foto_longitude: coords?.longitude,
          foto_data_hora: timestamp,
        });
        toast.success("Foto salva localmente!", { id: "foto-upload" });
      } catch (base64Error) {
        console.error("[APR] Erro ao converter para base64:", base64Error);
        toast.error("Erro ao salvar foto", { id: "foto-upload" });
      }
    }
  };

  // Upload de assinatura
  const handleSignatureSave = async (perguntaId: string, dataUrl: string) => {
    console.log("[APR] Salvando assinatura para pergunta:", perguntaId);
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
      
      const fileName = `apr/${ordemId}/assinatura_${perguntaId}_${Date.now()}.png`;

      console.log("[APR] Tentando upload de assinatura para Storage:", fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("service-attachments")
        .upload(fileName, blob, { 
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error("[APR] Erro no Storage para assinatura, usando base64:", uploadError);
        // Fallback: salvar o dataUrl diretamente (já é base64)
        updateRespostaMultiplo(perguntaId, { 
          assinatura_url: dataUrl, 
          resposta: true,
          assinatura_latitude: coords?.latitude,
          assinatura_longitude: coords?.longitude,
          assinatura_data_hora: timestamp,
        });
        toast.success("Assinatura salva!", { id: "assinatura-upload" });
        return;
      }

      console.log("[APR] Upload de assinatura bem sucedido:", uploadData);

      const { data: urlData } = supabase.storage
        .from("service-attachments")
        .getPublicUrl(fileName);

      console.log("[APR] URL pública da assinatura:", urlData.publicUrl);

      // Atualiza assinatura_url, coordenadas e marca resposta como true
      updateRespostaMultiplo(perguntaId, { 
        assinatura_url: urlData.publicUrl, 
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
        updateRespostaMultiplo(perguntaId, { 
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

  // Salvar APR
  const salvarAPR = async () => {
    if (!checklist) return;

    // Validar perguntas obrigatórias
    const perguntasObrigatorias = todasPerguntas.filter(p => p.obrigatoria);
    const naoRespondidas = perguntasObrigatorias.filter(p => {
      const resposta = respostas[p.id];
      if (!resposta) return true;
      if (p.tipo === 'foto') return !resposta.foto_url;
      if (p.tipo === 'assinatura') return !resposta.assinatura_url;
      return resposta.resposta === null || resposta.resposta === undefined || resposta.resposta === '';
    });

    if (naoRespondidas.length > 0) {
      toast.error(`Responda todas as perguntas obrigatórias (${naoRespondidas.length} pendente(s))`);
      return;
    }

    // Validar fotos condicionais
    const fotosFaltando = todasPerguntas.filter(p => {
      if (perguntaExigeFoto(p)) {
        const resposta = respostas[p.id];
        return !resposta?.foto_url;
      }
      return false;
    });

    if (fotosFaltando.length > 0) {
      toast.error(`Adicione as fotos obrigatórias (${fotosFaltando.length} pendente(s))`);
      return;
    }

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

      if (respostaExistente) {
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
          descricao: `APR "${checklist.nome}" preenchida`,
          dados_novos: { checklist_id: checklist.id, respostas_count: respostasArray.length },
          created_by: equipeId,
        });
      }

      toast.success("APR salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["apr-existente", ordemId] });
      navigate(-1);
    } catch (error: any) {
      console.error("Erro ao salvar APR:", error);
      toast.error("Erro ao salvar APR");
    } finally {
      setSaving(false);
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

    const campoBase = (() => {
      switch (pergunta.tipo) {
        case 'texto':
          return (
            <Input
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder={pergunta.config?.placeholder || "Digite sua resposta..."}
            />
          );

        case 'texto_longo':
          return (
            <Textarea
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder={pergunta.config?.placeholder || "Digite sua resposta..."}
              rows={3}
            />
          );

        case 'numero':
          return (
            <Input
              type="number"
              value={(resposta?.resposta as number) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value ? Number(e.target.value) : null)}
              placeholder="0"
              className="w-32"
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
                <RadioGroupItem value="nao" id={`${pergunta.id}-nao`} />
                <Label htmlFor={`${pergunta.id}-nao`} className="text-green-600 font-medium cursor-pointer">Não</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sim" id={`${pergunta.id}-sim`} />
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
              className="space-y-2"
            >
              {opcoes.map((opcao) => (
                <div key={opcao.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={opcao.valor || opcao.texto} id={`${pergunta.id}-${opcao.id}`} />
                  <Label htmlFor={`${pergunta.id}-${opcao.id}`} className="cursor-pointer">{opcao.texto}</Label>
                </div>
              ))}
            </RadioGroup>
          );

        case 'multipla_escolha':
          const selecionados = (resposta?.resposta as string[]) || [];
          return (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {opcoes.map((opcao) => (
                <div key={opcao.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${pergunta.id}-${opcao.id}`}
                    checked={selecionados.includes(opcao.texto)}
                    onCheckedChange={(checked) => {
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
          const inputFotoId = `foto-input-${pergunta.id}`;
          
          return (
            <div className="space-y-2">
              <input
                id={inputFotoId}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  console.log("[APR] Arquivo selecionado:", e.target.files);
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFotoUpload(pergunta.id, file);
                  }
                  // Limpar o input para permitir selecionar o mesmo arquivo novamente
                  e.target.value = '';
                }}
              />
              {resposta?.foto_url ? (
                <div className="relative">
                  <img
                    src={resposta.foto_url}
                    alt="Foto"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <label
                    htmlFor={inputFotoId}
                    className="absolute bottom-2 right-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 cursor-pointer"
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    Trocar
                  </label>
                </div>
              ) : (
                <label
                  htmlFor={inputFotoId}
                  className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Tirar Foto</span>
                </label>
              )}
              {pergunta.config?.dica && (
                <p className="text-xs text-muted-foreground">{pergunta.config.dica}</p>
              )}
            </div>
          );

        case 'assinatura':
          return (
            <div className="space-y-2">
              {resposta?.assinatura_url ? (
                <div className="relative">
                  <img
                    src={resposta.assinatura_url}
                    alt="Assinatura"
                    className="w-full h-32 object-contain bg-white rounded-lg border"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      updateResposta(pergunta.id, null, 'assinatura_url');
                      updateResposta(pergunta.id, null, 'resposta');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-32 border-dashed border-2"
                  onClick={() => setSignatureDialog({
                    open: true,
                    perguntaId: pergunta.id,
                    title: pergunta.texto,
                  })}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileSignature className="h-8 w-8 text-violet-500" />
                    <span className="text-sm text-muted-foreground">Toque para assinar</span>
                  </div>
                </Button>
              )}
            </div>
          );

        case 'conforme_nao_conforme':
          return (
            <RadioGroup
              value={resposta?.resposta as string || ''}
              onValueChange={(value) => updateResposta(pergunta.id, value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="conforme" id={`${pergunta.id}-conforme`} />
                <Label htmlFor={`${pergunta.id}-conforme`} className="text-green-600 font-medium cursor-pointer">Conforme</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nao_conforme" id={`${pergunta.id}-nao_conforme`} />
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
              className="w-48"
            />
          );

        case 'hora':
          return (
            <Input
              type="time"
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              className="w-32"
            />
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
          
          return (
            <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Foto obrigatória para esta resposta
              </p>
              <input
                id={inputFotoCondId}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFotoUpload(pergunta.id, file);
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
                  <label
                    htmlFor={inputFotoCondId}
                    className="absolute bottom-2 right-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 cursor-pointer"
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    Trocar
                  </label>
                </div>
              ) : (
                <label
                  htmlFor={inputFotoCondId}
                  className="flex flex-col items-center justify-center gap-1 w-full h-24 border-2 border-dashed rounded-lg bg-white cursor-pointer hover:bg-red-100/50 transition-colors"
                >
                  <Camera className="h-6 w-6 text-red-500" />
                  <span className="text-xs text-red-600">Adicionar Foto</span>
                </label>
              )}
            </div>
          );
        })()}

        {/* Campo de observação condicional */}
        {exigeObservacao && (
          <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700 font-medium">
              Observação obrigatória para esta resposta
            </p>
            <Textarea
              value={resposta?.observacao || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value, 'observacao')}
              placeholder="Descreva a situação encontrada..."
              rows={2}
              className="bg-white"
            />
          </div>
        )}
      </div>
    );
  };

  const isPerguntaRespondida = (pergunta: Pergunta): boolean => {
    const resposta = respostas[pergunta.id];
    if (!resposta) return false;
    if (pergunta.tipo === 'foto') return !!resposta.foto_url;
    if (pergunta.tipo === 'assinatura') return !!resposta.assinatura_url;
    if (Array.isArray(resposta.resposta)) return resposta.resposta.length > 0;
    return resposta.resposta !== null && resposta.resposta !== undefined && resposta.resposta !== '';
  };

  const getProgressoGrupo = (grupo: GrupoPerguntas) => {
    const respondidas = grupo.perguntas.filter(p => isPerguntaRespondida(p)).length;
    return { respondidas, total: grupo.perguntas.length };
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
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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

  const perguntasRespondidas = todasPerguntas.filter(p => isPerguntaRespondida(p)).length;
  const totalPerguntas = todasPerguntas.length;
  const progresso = totalPerguntas > 0 ? Math.round((perguntasRespondidas / totalPerguntas) * 100) : 0;

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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
          {respostaExistente && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Preenchido
            </Badge>
          )}
        </div>

        {/* Barra de progresso */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{perguntasRespondidas} de {totalPerguntas} respondidas</span>
            <span>{progresso}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 transition-all duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </div>

      {/* Grupos e Perguntas */}
      <div className="p-4 space-y-3">
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
            const { respondidas, total } = getProgressoGrupo(grupo);
            const isExpanded = gruposExpandidos.has(grupo.id);
            const todasRespondidas = respondidas === total && total > 0;

            return (
              <Collapsible
                key={grupo.id}
                open={isExpanded}
                onOpenChange={() => toggleGrupo(grupo.id)}
              >
                <Card className={todasRespondidas ? 'border-green-300 bg-green-50/50' : ''}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <CardTitle className="text-sm font-semibold">{grupo.nome}</CardTitle>
                        </div>
                        <Badge 
                          variant={todasRespondidas ? "default" : "secondary"}
                          className={todasRespondidas ? "bg-green-600" : ""}
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

                          return (
                            <div 
                              key={pergunta.id} 
                              className={`p-3 rounded-lg border ${respondida ? 'border-green-200 bg-green-50/50' : 'border-muted bg-muted/20'}`}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <Badge 
                                  variant="outline" 
                                  className={`shrink-0 text-xs ${respondida ? 'bg-green-100 text-green-700 border-green-300' : ''}`}
                                >
                                  {grupo.ordem}.{index + 1}
                                </Badge>
                                <span className="text-sm flex-1">
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
        <Button
          className="w-full bg-violet-600 hover:bg-violet-700"
          size="lg"
          onClick={salvarAPR}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Send className="h-5 w-5 mr-2" />
          )}
          {respostaExistente ? 'Atualizar APR' : 'Enviar APR'}
        </Button>
      </div>

      {/* Dialog de Assinatura */}
      <SignatureCanvas
        open={signatureDialog.open}
        onClose={() => setSignatureDialog({ open: false, perguntaId: "", title: "" })}
        onSave={(dataUrl) => handleSignatureSave(signatureDialog.perguntaId, dataUrl)}
        title={signatureDialog.title}
      />
    </div>
  );
}
