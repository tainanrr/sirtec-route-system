import { useState, useRef, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
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
  X,
  Plus,
  Eye,
  AlertCircle,
} from "lucide-react";
import { SignatureFullScreen } from "@/components/app/SignatureFullScreen";
import { processImageWithStamp, getCurrentLocation } from "@/lib/imageUtils";

// ============================================
// TIPOS (copiados da APR)
// ============================================

interface PerguntaConfig {
  placeholder?: string;
  foto_obrigatoria?: boolean;
  observacao_obrigatoria?: boolean;
  foto_se_sim?: boolean;
  observacao_se_sim?: boolean;
  alerta_se_sim?: string;
  alerta_se_nao?: string;
  dica?: string;
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
  permite_nao_aplica?: boolean;
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
  fotos?: FotoData[];
  assinatura_url?: string;
  observacao?: string;
  foto_latitude?: number;
  foto_longitude?: number;
  foto_data_hora?: string;
  assinatura_latitude?: number;
  assinatura_longitude?: number;
  assinatura_data_hora?: string;
  nao_aplica?: boolean;
}

interface ChecklistRespostaResult {
  checklist_id: string;
  respostas: Record<string, Resposta>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId: string;
  grupoRetorno: string;
  ordemServicoId: string;
  equipeId?: string; // Opcional - para rastreamento
  onComplete: (checklists: ChecklistRespostaResult[]) => void;
  onSkip?: () => void;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ChecklistServicoSheet({
  open,
  onOpenChange,
  skillId,
  grupoRetorno,
  ordemServicoId,
  equipeId,
  onComplete,
  onSkip,
}: Props) {
  const { isOnline, queueOperation, getFromCache, saveToCache } = useOfflineSyncContext();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [currentChecklistIndex, setCurrentChecklistIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  
  // Estados de assinatura (igual APR)
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signaturePerguntaId, setSignaturePerguntaId] = useState<string>("");
  const [signatureTitulo, setSignatureTitulo] = useState<string>("");
  
  // Estados de foto
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [fotoViewer, setFotoViewer] = useState<{ open: boolean; fotos: FotoData[]; index: number }>({ 
    open: false, fotos: [], index: 0 
  });

  // Refs para controle de estado (evitar reset durante sincronização)
  const perguntaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const grupoRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasLoadedRef = useRef(false);
  const hasRestoredDraftRef = useRef(false);
  const wasOpenRef = useRef(false);

  const currentChecklist = checklists[currentChecklistIndex];
  
  // Chave para persistência do rascunho
  const draftKey = `checklist_servico_draft_${ordemServicoId}_${skillId}_${grupoRetorno}`;

  // Salvar rascunho localmente (debounced) para não perder durante sincronização
  useEffect(() => {
    if (!open || loading || !currentChecklist) return;
    
    const timer = setTimeout(() => {
      const draft = {
        respostas,
        currentChecklistIndex,
        gruposExpandidos: Array.from(gruposExpandidos),
        checklistId: currentChecklist.id,
      };
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(draft));
        console.log("[ChecklistServico] 💾 Rascunho salvo");
      } catch (e) {
        console.warn("[ChecklistServico] Erro ao salvar rascunho:", e);
      }
    }, 400);
    
    return () => clearTimeout(timer);
  }, [respostas, currentChecklistIndex, gruposExpandidos, open, loading, currentChecklist, draftKey]);

  // Restaurar rascunho ao abrir
  useEffect(() => {
    if (!open || hasRestoredDraftRef.current || loading) return;
    
    try {
      const draftStr = sessionStorage.getItem(draftKey);
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft.respostas && Object.keys(draft.respostas).length > 0) {
          console.log("[ChecklistServico] 📂 Restaurando rascunho...");
          setRespostas(draft.respostas);
          if (draft.gruposExpandidos) {
            setGruposExpandidos(new Set(draft.gruposExpandidos));
          }
          if (typeof draft.currentChecklistIndex === 'number') {
            setCurrentChecklistIndex(draft.currentChecklistIndex);
          }
          hasRestoredDraftRef.current = true;
        }
      }
    } catch (e) {
      console.warn("[ChecklistServico] Erro ao restaurar rascunho:", e);
    }
  }, [open, loading, draftKey]);

  // Limpar rascunho quando concluir com sucesso
  const limparRascunho = () => {
    try {
      sessionStorage.removeItem(draftKey);
      console.log("[ChecklistServico] 🗑️ Rascunho removido");
    } catch (e) {
      console.warn("[ChecklistServico] Erro ao limpar rascunho:", e);
    }
  };

  // Carregar checklists quando abrir (apenas na primeira vez ou quando realmente fechar)
  useEffect(() => {
    // Detectar abertura real (transição de false para true)
    if (open && !wasOpenRef.current) {
      console.log("[ChecklistServico] 🚀 Abrindo checklist...");
      hasLoadedRef.current = false;
      hasRestoredDraftRef.current = false;
      carregarChecklists();
    }
    
    // Detectar fechamento real (transição de true para false)
    if (!open && wasOpenRef.current) {
      console.log("[ChecklistServico] 🚪 Fechando checklist...");
      // Reset ao fechar (mas manter rascunho no sessionStorage)
      setChecklists([]);
      setCurrentChecklistIndex(0);
      setRespostas({});
      setGruposExpandidos(new Set());
      setLoading(true);
      hasLoadedRef.current = false;
      hasRestoredDraftRef.current = false;
    }
    
    wasOpenRef.current = open;
  }, [open]); // Não incluir skillId/grupoRetorno para evitar resets durante sincronização

  const carregarChecklists = async () => {
    // Evitar múltiplas chamadas
    if (hasLoadedRef.current) {
      console.log("[ChecklistServico] ⏭️ Já carregou, ignorando...");
      return;
    }
    
    console.log("[ChecklistServico] 📥 Carregando checklists...");
    setLoading(true);
    hasLoadedRef.current = true;
    const cacheKey = `checklists_servico_${skillId}_${grupoRetorno}`;
    
    try {
      // Sempre buscar do servidor para garantir dados atualizados
      // (o cache pode estar corrompido ou desatualizado)
      if (!isOnline) {
        // Tentar cache apenas se offline
        const cached = await getFromCache(cacheKey);
        
        if (cached && Array.isArray(cached) && cached.length > 0) {
          console.log("[ChecklistServico] OFFLINE - Usando cache:", cached.length, "checklists");
          console.log("[ChecklistServico] Primeiro checklist do cache:", {
            id: cached[0]?.id,
            nome: cached[0]?.nome,
            tipo: cached[0]?.tipo,
          });
          
          // Verificar se os checklists têm ID válido
          const checklistsValidos = cached.filter((c: any) => c && c.id);
          if (checklistsValidos.length > 0) {
            setChecklists(checklistsValidos);
            if (checklistsValidos[0]?.grupos?.length > 0) {
              setGruposExpandidos(new Set([checklistsValidos[0].grupos[0].id]));
            }
            setLoading(false);
            return;
          }
        }
        
        console.log("[ChecklistServico] Offline e sem cache válido");
        setChecklists([]);
        if (onSkip) {
          onSkip();
          onOpenChange(false);
        }
        return;
      }

      // Buscar vínculos (já estamos online neste ponto)
      const { data: vinculos, error: vinculosError } = await supabase
        .from("checklist_servico_vinculos")
        .select("checklist_id")
        .eq("skill_id", skillId)
        .eq("grupo_retorno", grupoRetorno)
        .eq("ativo", true);

      if (vinculosError || !vinculos || vinculos.length === 0) {
        console.log("[ChecklistServico] Nenhum vínculo encontrado");
        if (onSkip) {
          onSkip();
          onOpenChange(false);
        }
        return;
      }

      const checklistIds = vinculos.map(v => v.checklist_id);
      
      const { data: checklistsData, error: checklistsError } = await supabase
        .from("checklists")
        .select("*")
        .in("id", checklistIds)
        .eq("ativo", true);

      if (checklistsError || !checklistsData || checklistsData.length === 0) {
        console.log("[ChecklistServico] Nenhum checklist encontrado");
        if (onSkip) {
          onSkip();
          onOpenChange(false);
        }
        return;
      }

      // Parse e cache
      const checklistsParsed = checklistsData
        .filter(c => c && c.id) // Garantir que tem ID
        .map(c => ({
          ...c,
          grupos: typeof c.grupos === 'string' ? JSON.parse(c.grupos) : c.grupos,
          perguntas: typeof c.perguntas === 'string' ? JSON.parse(c.perguntas) : c.perguntas,
        }));

      console.log("[ChecklistServico] Checklists do banco:", checklistsParsed.map(c => ({
        id: c.id,
        nome: c.nome,
      })));

      if (checklistsParsed.length === 0) {
        console.log("[ChecklistServico] Nenhum checklist válido encontrado no banco");
        if (onSkip) {
          onSkip();
          onOpenChange(false);
        }
        return;
      }

      await saveToCache(cacheKey, checklistsParsed);
      setChecklists(checklistsParsed);
      
      if (checklistsParsed[0]?.grupos?.length > 0) {
        setGruposExpandidos(new Set([checklistsParsed[0].grupos[0].id]));
      }

    } catch (error: any) {
      console.error("[ChecklistServico] Erro:", error);
      toast.error("Erro ao carregar checklists");
      if (onSkip) {
        onSkip();
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HANDLERS DE RESPOSTAS (igual APR)
  // ============================================

  const updateResposta = (perguntaId: string, valor: any, campo: 'resposta' | 'observacao' = 'resposta') => {
    setRespostas(prev => ({
      ...prev,
      [perguntaId]: {
        ...prev[perguntaId],
        pergunta_id: perguntaId,
        [campo]: valor,
      }
    }));
  };

  const updateRespostaMultiplo = (perguntaId: string, dados: Partial<Resposta>) => {
    setRespostas(prev => ({
      ...prev,
      [perguntaId]: {
        ...prev[perguntaId],
        pergunta_id: perguntaId,
        ...dados,
      }
    }));
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

  // ============================================
  // UPLOAD DE FOTO (igual APR)
  // ============================================

  const handleFotoUpload = async (perguntaId: string, file: File, adicionarAoArray: boolean = false) => {
    setUploadingFoto(perguntaId);
    
    try {
      const location = await getCurrentLocation();
      const processedBlob = await processImageWithStamp(file, location);
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
      
      let fotoUrl = URL.createObjectURL(processedBlob); // Fallback local

      if (isOnline) {
        const fileName = `checklist_servico/${ordemServicoId}/${perguntaId}_${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("service-attachments")
          .upload(fileName, processedBlob, { contentType: "image/jpeg" });

        if (!error) {
          const { data: urlData } = supabase.storage
            .from("service-attachments")
            .getPublicUrl(fileName);
          fotoUrl = urlData.publicUrl;
        }
      }

      const novaFoto: FotoData = {
        url: fotoUrl,
        latitude: location?.latitude,
        longitude: location?.longitude,
        data_hora: timestamp,
      };

      const respostaAtual = respostas[perguntaId];
      
      if (adicionarAoArray) {
        const fotosAtuais = respostaAtual?.fotos || [];
        updateRespostaMultiplo(perguntaId, {
          fotos: [...fotosAtuais, novaFoto],
          foto_url: fotosAtuais.length === 0 ? fotoUrl : respostaAtual?.foto_url,
          resposta: "foto_capturada",
        });
      } else {
        updateRespostaMultiplo(perguntaId, {
          foto_url: fotoUrl,
          foto_latitude: location?.latitude,
          foto_longitude: location?.longitude,
          foto_data_hora: timestamp,
          resposta: "foto_capturada",
        });
      }

      toast.success("Foto adicionada!");
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao enviar foto");
    } finally {
      setUploadingFoto(null);
    }
  };

  const removerFoto = (perguntaId: string, index: number) => {
    const respostaAtual = respostas[perguntaId];
    if (!respostaAtual?.fotos) return;

    const novasFotos = respostaAtual.fotos.filter((_, i) => i !== index);
    updateRespostaMultiplo(perguntaId, {
      fotos: novasFotos,
      foto_url: novasFotos[0]?.url,
      resposta: novasFotos.length > 0 ? "foto_capturada" : null,
    });
  };

  // ============================================
  // ASSINATURA (IGUAL APR)
  // ============================================

  const handleSignatureSave = async (dataUrl: string) => {
    if (!signaturePerguntaId) return;
    
    console.log("[ChecklistServico] Salvando assinatura para pergunta:", signaturePerguntaId);
    toast.loading("Obtendo localização...", { id: "assinatura-upload" });
    
    try {
      const coords = await getCurrentLocation();
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
      console.log("[ChecklistServico] Coordenadas:", coords);

      let assinaturaUrl = dataUrl; // Fallback base64

      if (isOnline) {
        toast.loading("Salvando assinatura...", { id: "assinatura-upload" });
        
        try {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const fileName = `checklist_servico/${ordemServicoId}/assinatura_${signaturePerguntaId}_${Date.now()}.png`;

          const { error } = await supabase.storage
            .from("service-attachments")
            .upload(fileName, blob, { contentType: "image/png" });

          if (!error) {
            const { data: urlData } = supabase.storage
              .from("service-attachments")
              .getPublicUrl(fileName);
            assinaturaUrl = urlData.publicUrl;
          }
        } catch (uploadError) {
          console.warn("[ChecklistServico] Erro no upload, usando base64");
        }
      }

      updateRespostaMultiplo(signaturePerguntaId, { 
        assinatura_url: assinaturaUrl, 
        resposta: true,
        assinatura_latitude: coords?.latitude,
        assinatura_longitude: coords?.longitude,
        assinatura_data_hora: timestamp,
      });

      toast.success("Assinatura salva!", { id: "assinatura-upload" });
    } catch (error: any) {
      console.error("[ChecklistServico] Erro:", error);
      // Salvar mesmo sem localização
      updateRespostaMultiplo(signaturePerguntaId, { 
        assinatura_url: dataUrl, 
        resposta: true,
        assinatura_data_hora: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
      });
      toast.success("Assinatura salva!", { id: "assinatura-upload" });
    } finally {
      setSignatureOpen(false);
      setSignaturePerguntaId("");
    }
  };

  // ============================================
  // VALIDAÇÃO
  // ============================================

  const isPerguntaRespondida = (pergunta: Pergunta): boolean => {
    const resposta = respostas[pergunta.id];
    if (!resposta) return false;
    
    // Não se aplica
    if (resposta.nao_aplica) return true;
    
    if (pergunta.tipo === 'foto') {
      const fotos = resposta.fotos || [];
      return fotos.length > 0 || !!resposta.foto_url;
    }
    if (pergunta.tipo === 'assinatura') {
      return !!resposta.assinatura_url;
    }
    return resposta.resposta !== null && resposta.resposta !== undefined && resposta.resposta !== '';
  };

  const todasRespondidas = useMemo(() => {
    if (!currentChecklist) return false;

    const todasPerguntas = currentChecklist.grupos?.length > 0
      ? currentChecklist.grupos.flatMap(g => g.perguntas || [])
      : currentChecklist.perguntas || [];

    return todasPerguntas
      .filter(p => p.obrigatoria)
      .every(p => isPerguntaRespondida(p));
  }, [currentChecklist, respostas]);

  // ============================================
  // SALVAR
  // ============================================

  const salvarChecklistAtual = async () => {
    if (!currentChecklist) {
      toast.error("Nenhum checklist carregado");
      return;
    }

    // Verificar se o checklist tem ID válido
    if (!currentChecklist.id) {
      console.error("[ChecklistServico] Checklist sem ID:", currentChecklist);
      toast.error("Checklist inválido - ID não encontrado");
      return;
    }

    console.log("[ChecklistServico] Salvando checklist:", {
      id: currentChecklist.id,
      nome: currentChecklist.nome,
      ordemServicoId,
    });

    setSaving(true);
    try {
      const respostasParaSalvar: Record<string, any> = {};
      Object.entries(respostas).forEach(([key, val]) => {
        respostasParaSalvar[key] = {
          ...val,
          resposta: val.nao_aplica ? "N/A" : val.resposta,
        };
      });

      // Estrutura para salvar no banco
      const dados: Record<string, any> = {
        checklist_id: currentChecklist.id,
        ordem_servico_id: ordemServicoId,
        respostas: respostasParaSalvar,
      };

      // Adicionar grupo_retorno se a coluna existir
      if (grupoRetorno) {
        dados.grupo_retorno = grupoRetorno;
      }

      console.log("[ChecklistServico] Dados a salvar:", dados);

      if (isOnline) {
        const { error } = await supabase
          .from("checklist_respostas")
          .insert(dados);

        if (error) throw error;
      } else {
        // queueOperation(type, table, action, payload, priority)
        await queueOperation(
          "save_checklist", // type
          "checklist_respostas", // table
          "insert", // action
          dados, // payload
          2 // priority
        );
      }

      toast.success(isOnline ? "Checklist concluído!" : "Checklist salvo (sincronizará quando online)");

      // Limpar rascunho após salvar com sucesso
      limparRascunho();

      // Próximo checklist ou finalizar
      if (currentChecklistIndex < checklists.length - 1) {
        setCurrentChecklistIndex(prev => prev + 1);
        setRespostas({});
        setGruposExpandidos(new Set());
        hasRestoredDraftRef.current = false; // Permitir restaurar próximo rascunho se houver
      } else {
        onComplete([{ checklist_id: currentChecklist.id, respostas }]);
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("[ChecklistServico] Erro ao salvar:", error);
      toast.error("Erro ao salvar checklist");
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RENDER CAMPO RESPOSTA (IGUAL APR)
  // ============================================

  const renderCampoResposta = (pergunta: Pergunta) => {
    const resposta = respostas[pergunta.id];
    const isPendente = pergunta.obrigatoria && !isPerguntaRespondida(pergunta);
    const isNaoAplica = resposta?.nao_aplica === true;

    // Checkbox "Não se aplica"
    const renderNaoAplica = () => {
      if (!pergunta.permite_nao_aplica) return null;
      return (
        <div className="flex items-center space-x-2 mb-3 p-2 bg-gray-50 rounded-lg">
          <Checkbox
            id={`nao-aplica-${pergunta.id}`}
            checked={isNaoAplica}
            onCheckedChange={(checked) => {
              updateRespostaMultiplo(pergunta.id, {
                nao_aplica: checked === true,
                resposta: checked ? null : resposta?.resposta,
              });
            }}
          />
          <Label htmlFor={`nao-aplica-${pergunta.id}`} className="text-sm text-gray-600 cursor-pointer">
            Não se aplica
          </Label>
        </div>
      );
    };

    const campoBase = (() => {
      // Se marcou "Não se aplica", mostrar apenas o checkbox
      if (isNaoAplica) {
        return (
          <div className="p-3 bg-gray-100 rounded-lg text-center text-gray-500">
            <span className="text-sm">Marcado como "Não se aplica"</span>
          </div>
        );
      }

      switch (pergunta.tipo) {
        case 'texto_curto':
          return (
            <Input
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder={pergunta.config?.placeholder || "Digite sua resposta..."}
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
              className={isPendente ? "border-red-500 ring-2 ring-red-200" : ""}
            />
          );

        case 'numero':
          return (
            <Input
              type="number"
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder="0"
              className={`w-32 ${isPendente ? "border-red-500 ring-2 ring-red-200" : ""}`}
            />
          );

        case 'sim_nao':
          return (
            <RadioGroup
              value={resposta?.resposta as string || ''}
              onValueChange={(value) => updateResposta(pergunta.id, value)}
              className={`flex gap-4 ${isPendente ? "p-2 rounded-lg bg-red-50 border border-red-300" : ""}`}
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

        case 'selecao_unica':
          const opcoesUnica = getOpcoes(pergunta);
          return (
            <RadioGroup
              value={resposta?.resposta as string || ''}
              onValueChange={(value) => updateResposta(pergunta.id, value)}
              className={`space-y-2 ${isPendente ? "p-2 rounded-lg bg-red-50 border border-red-300" : ""}`}
            >
              {opcoesUnica.map((opcao) => (
                <div key={opcao.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={opcao.valor || opcao.texto} id={`${pergunta.id}-${opcao.id}`} />
                  <Label htmlFor={`${pergunta.id}-${opcao.id}`} className="cursor-pointer">{opcao.texto}</Label>
                </div>
              ))}
            </RadioGroup>
          );

        case 'selecao_multipla':
          const opcoesMultipla = getOpcoes(pergunta);
          const selecionados = (resposta?.resposta as string[]) || [];
          return (
            <div className={`space-y-2 ${isPendente ? "p-2 rounded-lg bg-red-50 border border-red-300" : ""}`}>
              {opcoesMultipla.map((opcao) => {
                const valor = opcao.valor || opcao.texto;
                const checked = selecionados.includes(valor);
                return (
                  <div key={opcao.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${pergunta.id}-${opcao.id}`}
                      checked={checked}
                      onCheckedChange={(c) => {
                        const novos = c
                          ? [...selecionados, valor]
                          : selecionados.filter(s => s !== valor);
                        updateResposta(pergunta.id, novos);
                      }}
                    />
                    <Label htmlFor={`${pergunta.id}-${opcao.id}`} className="cursor-pointer">{opcao.texto}</Label>
                  </div>
                );
              })}
            </div>
          );

        case 'foto':
          const inputId = `foto-input-${pergunta.id}`;
          const fotos = resposta?.fotos || [];
          const isUploading = uploadingFoto === pergunta.id;

          return (
            <div className="space-y-3">
              <input
                id={inputId}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFotoUpload(pergunta.id, file, true);
                  e.target.value = '';
                }}
              />
              
              {fotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((foto, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={foto.url}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg cursor-pointer"
                        onClick={() => setFotoViewer({ open: true, fotos, index })}
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removerFoto(pergunta.id, index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <label
                htmlFor={inputId}
                className={`flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isPendente ? "border-red-400 bg-red-50 hover:bg-red-100" : "border-violet-300 bg-violet-50/50 hover:bg-violet-100/50"
                } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                ) : (
                  <>
                    <Plus className={`h-8 w-8 ${isPendente ? "text-red-500" : "text-violet-500"}`} />
                    <span className={`text-sm ${isPendente ? "text-red-600" : "text-violet-600"}`}>
                      {fotos.length > 0 ? "Adicionar mais fotos" : "Adicionar foto"}
                    </span>
                  </>
                )}
              </label>
            </div>
          );

        case 'assinatura':
          return (
            <div className="space-y-3">
              {resposta?.assinatura_url ? (
                <div className="relative">
                  <img
                    src={resposta.assinatura_url}
                    alt="Assinatura"
                    className="w-full h-32 object-contain bg-white border rounded-lg"
                  />
                  <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    {resposta.assinatura_data_hora && (
                      <p>📅 {resposta.assinatura_data_hora}</p>
                    )}
                    {resposta.assinatura_latitude && resposta.assinatura_longitude && (
                      <p>📍 {resposta.assinatura_latitude.toFixed(6)}, {resposta.assinatura_longitude.toFixed(6)}</p>
                    )}
                  </div>
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
                </div>
              ) : (
                <Button
                  variant="outline"
                  className={`w-full h-36 border-dashed border-2 ${isPendente ? "border-red-400 bg-red-50" : ""}`}
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

        case 'data':
          return (
            <Input
              type="date"
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              className={`w-48 ${isPendente ? "border-red-500 ring-2 ring-red-200" : ""}`}
            />
          );

        case 'hora':
          return (
            <Input
              type="time"
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              className={`w-32 ${isPendente ? "border-red-500 ring-2 ring-red-200" : ""}`}
            />
          );

        default:
          return (
            <Input
              value={(resposta?.resposta as string) || ''}
              onChange={(e) => updateResposta(pergunta.id, e.target.value)}
              placeholder="Digite sua resposta..."
              className={isPendente ? "border-red-500 ring-2 ring-red-200" : ""}
            />
          );
      }
    })();

    return (
      <div className="space-y-2">
        {renderNaoAplica()}
        {campoBase}
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  if (!open) return null;

  return (
    <>
      {/* Tela principal - igual estrutura da APR */}
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col overflow-hidden">
        {/* Header - cores violeta como APR */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 text-white px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20 -ml-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg truncate flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Checklist de Serviço
              </h1>
              {currentChecklist && (
                <p className="text-sm text-violet-200 truncate">{currentChecklist.nome}</p>
              )}
            </div>
            {checklists.length > 1 && (
              <Badge variant="secondary" className="bg-white/20 text-white">
                {currentChecklistIndex + 1} de {checklists.length}
              </Badge>
            )}
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto pb-24">
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : !currentChecklist ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum checklist configurado</p>
              </div>
            ) : currentChecklist.grupos && currentChecklist.grupos.length > 0 ? (
              // Render com grupos
              currentChecklist.grupos
                .sort((a, b) => a.ordem - b.ordem)
                .map((grupo) => {
                  const isExpanded = gruposExpandidos.has(grupo.id);
                  const perguntas = grupo.perguntas || [];
                  const respondidas = perguntas.filter(p => isPerguntaRespondida(p)).length;
                  const obrigatorias = perguntas.filter(p => p.obrigatoria).length;
                  const todasGrupoRespondidas = perguntas
                    .filter(p => p.obrigatoria)
                    .every(p => isPerguntaRespondida(p));

                  return (
                    <Collapsible
                      key={grupo.id}
                      open={isExpanded}
                      onOpenChange={(open) => {
                        setGruposExpandidos(prev => {
                          const novo = new Set(prev);
                          if (open) novo.add(grupo.id);
                          else novo.delete(grupo.id);
                          return novo;
                        });
                      }}
                    >
                      <Card
                        ref={(el) => { grupoRefs.current[grupo.id] = el; }}
                        className={`overflow-hidden ${!todasGrupoRespondidas && obrigatorias > 0 ? "border-amber-300" : ""}`}
                      >
                        <CollapsibleTrigger asChild>
                          <CardHeader className={`cursor-pointer transition-colors ${
                            todasGrupoRespondidas ? "bg-green-50" : "bg-violet-50"
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-violet-600" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-violet-600" />
                                )}
                                <div>
                                  <CardTitle className="text-base text-violet-900">{grupo.nome}</CardTitle>
                                  {grupo.descricao && (
                                    <p className="text-xs text-violet-600 mt-0.5">{grupo.descricao}</p>
                                  )}
                                </div>
                              </div>
                              <Badge variant={todasGrupoRespondidas ? "default" : "secondary"} className={
                                todasGrupoRespondidas ? "bg-green-500" : ""
                              }>
                                {respondidas}/{perguntas.length}
                              </Badge>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-4 space-y-6">
                            {perguntas
                              .sort((a, b) => a.ordem - b.ordem)
                              .map((pergunta, index) => {
                                const isPendente = pergunta.obrigatoria && !isPerguntaRespondida(pergunta);
                                
                                return (
                                  <div
                                    key={pergunta.id}
                                    ref={(el) => { perguntaRefs.current[pergunta.id] = el; }}
                                    className={`space-y-2 p-3 rounded-lg transition-colors ${
                                      isPendente ? "bg-red-50 border border-red-200" : "bg-white border"
                                    }`}
                                  >
                                    <div className="flex items-start gap-2 mb-2">
                                      <Badge variant="outline" className={`shrink-0 ${isPendente ? "border-red-400 text-red-600" : "border-violet-300 text-violet-600"}`}>
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
                })
            ) : currentChecklist.perguntas && currentChecklist.perguntas.length > 0 ? (
              // Render sem grupos
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {currentChecklist.perguntas
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((pergunta, index) => {
                      const isPendente = pergunta.obrigatoria && !isPerguntaRespondida(pergunta);
                      
                      return (
                        <div
                          key={pergunta.id}
                          ref={(el) => { perguntaRefs.current[pergunta.id] = el; }}
                          className={`space-y-2 p-3 rounded-lg transition-colors ${
                            isPendente ? "bg-red-50 border border-red-200" : "bg-white border"
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <Badge variant="outline" className={`shrink-0 ${isPendente ? "border-red-400 text-red-600" : "border-violet-300 text-violet-600"}`}>
                              {index + 1}
                            </Badge>
                            <span className={`text-sm flex-1 ${isPendente ? "text-red-800 font-medium" : ""}`}>
                              {pergunta.texto}
                              {pergunta.obrigatoria && <span className="text-red-500 ml-1">*</span>}
                            </span>
                          </div>
                          {renderCampoResposta(pergunta)}
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Este checklist não possui perguntas</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer fixo - igual APR */}
        {currentChecklist && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
            <Button
              className="w-full bg-violet-600 hover:bg-violet-700"
              size="lg"
              onClick={salvarChecklistAtual}
              disabled={saving || !todasRespondidas}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Send className="h-5 w-5 mr-2" />
              )}
              {currentChecklistIndex < checklists.length - 1 ? "Próximo Checklist" : "Concluir Checklist"}
            </Button>
            {!todasRespondidas && (
              <p className="text-xs text-red-600 text-center mt-2">
                Responda todas as perguntas obrigatórias para continuar
              </p>
            )}
          </div>
        )}
      </div>

      {/* Dialog de Assinatura em Tela Cheia - IGUAL APR */}
      <SignatureFullScreen
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onSave={handleSignatureSave}
        titulo={signatureTitulo}
      />

      {/* Visualizador de Fotos - igual APR */}
      <Dialog open={fotoViewer.open} onOpenChange={(open) => setFotoViewer(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 bg-black/95">
          <div className="relative flex flex-col h-full min-h-[60vh]">
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

            <div className="flex-1 flex items-center justify-center p-4 pt-16 pb-20">
              {fotoViewer.fotos[fotoViewer.index]?.url && (
                <img
                  src={fotoViewer.fotos[fotoViewer.index].url}
                  alt={`Foto ${fotoViewer.index + 1}`}
                  className="max-w-full max-h-[60vh] object-contain rounded"
                />
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="text-white text-center space-y-1 text-sm">
                {fotoViewer.fotos[fotoViewer.index]?.data_hora && (
                  <p>📅 {fotoViewer.fotos[fotoViewer.index].data_hora}</p>
                )}
                {fotoViewer.fotos[fotoViewer.index]?.latitude && fotoViewer.fotos[fotoViewer.index]?.longitude && (
                  <p>📍 {fotoViewer.fotos[fotoViewer.index].latitude?.toFixed(6)}, {fotoViewer.fotos[fotoViewer.index].longitude?.toFixed(6)}</p>
                )}
              </div>
              
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
    </>
  );
}
