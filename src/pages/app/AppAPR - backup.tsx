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
import { FotoUploader } from "@/components/app/FotoUploader";
import { SignatureFullScreen } from "@/components/app/SignatureFullScreen";
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

interface FotoData {
  url: string;
  latitude?: number;
  longitude?: number;
  dataHora: string;
}

interface Resposta {
  pergunta_id: string;
  resposta: string | string[] | boolean | number | null;
  foto_url?: string;
  fotos?: FotoData[]; // Novo: suporte a múltiplas fotos
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
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [camposComErro, setCamposComErro] = useState<Set<string>>(new Set());
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
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

  const toggleGrupo = useCallback((grupoId: string) => {
    setGruposExpandidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(grupoId)) {
        newSet.delete(grupoId);
      } else {
        newSet.add(grupoId);
      }
      return newSet;
    });
  }, []);

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

  // Obter localização atual (usado para assinaturas)
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

  // Verificar se pergunta está respondida corretamente
  const isPerguntaValidaParaSalvar = (pergunta: Pergunta): boolean => {
    const resposta = respostas[pergunta.id];
    if (!resposta) return false;
    
    if (pergunta.tipo === 'foto') {
      return (resposta.fotos && resposta.fotos.length > 0) || !!resposta.foto_url;
    }
    if (pergunta.tipo === 'assinatura') {
      return !!resposta.assinatura_url;
    }
    
    // Verificar se a resposta exige foto
    if (perguntaExigeFoto(pergunta)) {
      const temFoto = (resposta.fotos && resposta.fotos.length > 0) || !!resposta.foto_url;
      if (!temFoto) return false;
    }
    
    return resposta.resposta !== null && resposta.resposta !== undefined && resposta.resposta !== '';
  };

  // Validar APR antes de salvar
  const validarAPR = (): { valido: boolean; erros: string[] } => {
    const erros: string[] = [];
    const novosErros = new Set<string>();
    
    // Validar perguntas obrigatórias
    const perguntasObrigatorias = todasPerguntas.filter(p => p.obrigatoria);
    
    for (const pergunta of perguntasObrigatorias) {
      if (!isPerguntaValidaParaSalvar(pergunta)) {
        novosErros.add(pergunta.id);
        erros.push(pergunta.texto);
      }
    }
    
    // Validar fotos condicionais
    for (const pergunta of todasPerguntas) {
      if (perguntaExigeFoto(pergunta)) {
        const resposta = respostas[pergunta.id];
        const temFoto = (resposta?.fotos && resposta.fotos.length > 0) || !!resposta?.foto_url;
        if (!temFoto) {
          novosErros.add(pergunta.id);
          if (!erros.includes(pergunta.texto)) {
            erros.push(`${pergunta.texto} (foto obrigatória)`);
          }
        }
      }
    }
    
    setCamposComErro(novosErros);
    
    return { valido: novosErros.size === 0, erros };
  };

  // Scroll para primeiro erro
  const scrollParaPrimeiroErro = () => {
    const primeiroErro = Array.from(camposComErro)[0];
    if (primeiroErro) {
      // Encontrar o grupo da pergunta
      const grupo = checklist?.grupos?.find(g => 
        g.perguntas.some(p => p.id === primeiroErro)
      );
      
      if (grupo && !gruposExpandidos.has(grupo.id)) {
        // Expandir o grupo
        setGruposExpandidos(prev => new Set([...prev, grupo.id]));
      }
      
      // Aguardar a expansão e fazer scroll
      setTimeout(() => {
        const element = document.getElementById(`pergunta-${primeiroErro}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Adicionar animação de destaque
          element.classList.add('animate-pulse');
          setTimeout(() => element.classList.remove('animate-pulse'), 2000);
        }
      }, 300);
    }
  };

  // Salvar APR
  const salvarAPR = async () => {
    if (!checklist) return;
    
    // Se já está concluída, não permite edição
    if (respostaExistente?.status === 'completo') {
      toast.error("Esta APR já foi concluída e não pode ser editada");
      return;
    }

    // Validar
    const { valido, erros } = validarAPR();
    
    if (!valido) {
      toast.error(
        <div>
          <p className="font-semibold">Preencha os campos obrigatórios:</p>
          <ul className="text-xs mt-1 list-disc pl-4">
            {erros.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
            {erros.length > 3 && <li>...e mais {erros.length - 3} campo(s)</li>}
          </ul>
        </div>,
        { duration: 5000 }
      );
      scrollParaPrimeiroErro();
      return;
    }

    // Mostrar confirmação antes de finalizar
    setShowConfirmFinish(true);
  };

  // Confirmar e salvar APR
  const confirmarSalvarAPR = async () => {
    if (!checklist) return;
    
    setShowConfirmFinish(false);
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

      toast.success("APR concluída com sucesso!");
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

  // Renderizar campo em modo visualização (somente leitura)
  const renderCampoVisualizacao = (pergunta: Pergunta, resposta: Resposta | undefined, opcoes: Opcao[]) => {
    const valor = resposta?.resposta;
    const fotos = resposta?.fotos || (resposta?.foto_url ? [{
      url: resposta.foto_url,
      latitude: resposta.foto_latitude,
      longitude: resposta.foto_longitude,
      dataHora: resposta.foto_data_hora || '',
    }] : []);
    
    return (
      <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
        {/* Valor da resposta */}
        {pergunta.tipo === 'foto' ? (
          fotos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fotos.map((foto, i) => (
                <div key={i} className="relative">
                  <img src={foto.url} alt={`Foto ${i + 1}`} className="w-20 h-20 object-cover rounded border" />
                  {foto.dataHora && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">📅 {foto.dataHora}</p>
                  )}
                  {foto.latitude && foto.longitude && (
                    <p className="text-[9px] text-muted-foreground">📍 {foto.latitude.toFixed(4)}, {foto.longitude.toFixed(4)}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground italic">Sem foto</span>
          )
        ) : pergunta.tipo === 'assinatura' ? (
          resposta?.assinatura_url ? (
            <div>
              <img src={resposta.assinatura_url} alt="Assinatura" className="w-full h-24 object-contain bg-white rounded border" />
              {resposta.assinatura_data_hora && (
                <p className="text-[9px] text-muted-foreground mt-1">📅 {resposta.assinatura_data_hora}</p>
              )}
              {resposta.assinatura_latitude && resposta.assinatura_longitude && (
                <p className="text-[9px] text-muted-foreground">📍 {resposta.assinatura_latitude.toFixed(4)}, {resposta.assinatura_longitude.toFixed(4)}</p>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground italic">Sem assinatura</span>
          )
        ) : pergunta.tipo === 'sim_nao' ? (
          valor === 'sim' ? (
            <Badge variant="destructive">Sim (Risco identificado)</Badge>
          ) : valor === 'nao' ? (
            <Badge className="bg-green-600">Não</Badge>
          ) : (
            <span className="text-muted-foreground italic">Não respondida</span>
          )
        ) : pergunta.tipo === 'multipla_escolha' && Array.isArray(valor) ? (
          <div className="flex flex-wrap gap-1">
            {valor.map((v, i) => (
              <Badge key={i} variant="secondary">{v}</Badge>
            ))}
          </div>
        ) : valor !== null && valor !== undefined && valor !== '' ? (
          <p className="text-sm font-medium">{String(valor)}</p>
        ) : (
          <span className="text-muted-foreground italic">Não respondida</span>
        )}

        {/* Fotos anexadas (para perguntas que não são do tipo foto) */}
        {pergunta.tipo !== 'foto' && fotos.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Fotos anexadas:</p>
            <div className="flex flex-wrap gap-2">
              {fotos.map((foto, i) => (
                <img key={i} src={foto.url} alt={`Foto ${i + 1}`} className="w-16 h-16 object-cover rounded border" />
              ))}
            </div>
          </div>
        )}

        {/* Observação */}
        {resposta?.observacao && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Observação:</p>
            <p className="text-sm">{resposta.observacao}</p>
          </div>
        )}
      </div>
    );
  };

  // Verificar se a APR está em modo somente leitura (concluída)
  const isAPRConcluida = respostaExistente?.status === 'completo';

  const renderCampoResposta = (pergunta: Pergunta) => {
    const resposta = respostas[pergunta.id];
    const opcoes = getOpcoes(pergunta);
    const exigeFoto = perguntaExigeFoto(pergunta);
    const exigeObservacao = perguntaExigeObservacao(pergunta);
    const alerta = getAlertaResposta(pergunta);

    // Se a APR está concluída, mostrar apenas visualização
    if (isAPRConcluida) {
      return renderCampoVisualizacao(pergunta, resposta, opcoes);
    }

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
          // Converter fotos antigas para o novo formato se necessário
          const fotosAtuais: FotoData[] = resposta?.fotos || (resposta?.foto_url ? [{
            url: resposta.foto_url,
            latitude: resposta.foto_latitude,
            longitude: resposta.foto_longitude,
            dataHora: resposta.foto_data_hora || '',
          }] : []);
          
          return (
            <div className="space-y-2">
              <FotoUploader
                fotos={fotosAtuais}
                onFotosChange={(novasFotos) => {
                  // Atualizar resposta com as novas fotos
                  updateRespostaMultiplo(pergunta.id, {
                    fotos: novasFotos,
                    foto_url: novasFotos.length > 0 ? novasFotos[0].url : undefined,
                    foto_latitude: novasFotos.length > 0 ? novasFotos[0].latitude : undefined,
                    foto_longitude: novasFotos.length > 0 ? novasFotos[0].longitude : undefined,
                    foto_data_hora: novasFotos.length > 0 ? novasFotos[0].dataHora : undefined,
                    resposta: novasFotos.length > 0 ? true : null,
                  });
                }}
                maxFotos={10}
                label="Foto"
              />
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
          // Converter fotos antigas para o novo formato se necessário
          const fotosCondicionais: FotoData[] = resposta?.fotos || (resposta?.foto_url ? [{
            url: resposta.foto_url,
            latitude: resposta.foto_latitude,
            longitude: resposta.foto_longitude,
            dataHora: resposta.foto_data_hora || '',
          }] : []);
          
          return (
            <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Foto obrigatória para esta resposta
              </p>
              <FotoUploader
                fotos={fotosCondicionais}
                onFotosChange={(novasFotos) => {
                  updateRespostaMultiplo(pergunta.id, {
                    fotos: novasFotos,
                    foto_url: novasFotos.length > 0 ? novasFotos[0].url : undefined,
                    foto_latitude: novasFotos.length > 0 ? novasFotos[0].latitude : undefined,
                    foto_longitude: novasFotos.length > 0 ? novasFotos[0].longitude : undefined,
                    foto_data_hora: novasFotos.length > 0 ? novasFotos[0].dataHora : undefined,
                  });
                }}
                maxFotos={10}
                label="Foto"
              />
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
    if (pergunta.tipo === 'foto') {
      // Verificar tanto o novo formato (fotos[]) quanto o antigo (foto_url)
      return (resposta.fotos && resposta.fotos.length > 0) || !!resposta.foto_url;
    }
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
            // Verificar se o grupo tem perguntas com erro
            const grupoTemErro = grupo.perguntas.some(p => camposComErro.has(p.id));

            return (
              <Collapsible
                key={grupo.id}
                open={isExpanded}
              >
                <Card 
                  id={`grupo-${grupo.id}`}
                  className={`transition-all ${
                    grupoTemErro 
                      ? 'border-red-400 bg-red-50/50 ring-2 ring-red-300' 
                      : todasRespondidas 
                        ? 'border-green-300 bg-green-50/50' 
                        : ''
                  }`}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader 
                      className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleGrupo(grupo.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <CardTitle className={`text-sm font-semibold ${grupoTemErro ? 'text-red-700' : ''}`}>
                            {grupo.nome}
                          </CardTitle>
                          {grupoTemErro && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <Badge 
                          variant={grupoTemErro ? "destructive" : todasRespondidas ? "default" : "secondary"}
                          className={todasRespondidas && !grupoTemErro ? "bg-green-600" : ""}
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
                          const temErro = camposComErro.has(pergunta.id);

                          return (
                            <div 
                              key={pergunta.id}
                              id={`pergunta-${pergunta.id}`}
                              className={`p-3 rounded-lg border transition-all ${
                                temErro 
                                  ? 'border-red-400 bg-red-50 ring-2 ring-red-300' 
                                  : respondida 
                                    ? 'border-green-200 bg-green-50/50' 
                                    : 'border-muted bg-muted/20'
                              }`}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <Badge 
                                  variant="outline" 
                                  className={`shrink-0 text-xs ${
                                    temErro 
                                      ? 'bg-red-100 text-red-700 border-red-400' 
                                      : respondida 
                                        ? 'bg-green-100 text-green-700 border-green-300' 
                                        : ''
                                  }`}
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

        {/* Botão Salvar - Apenas se não estiver concluída */}
        {respostaExistente?.status === 'completo' ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-green-800">APR Concluída</p>
            <p className="text-sm text-green-600">Esta APR já foi finalizada e não pode ser editada.</p>
          </div>
        ) : (
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
            {respostaExistente ? 'Atualizar APR' : 'Concluir APR'}
          </Button>
        )}
      </div>

      {/* Tela cheia de Assinatura */}
      <SignatureFullScreen
        open={signatureDialog.open}
        onClose={() => setSignatureDialog({ open: false, perguntaId: "", title: "" })}
        onSave={(dataUrl) => handleSignatureSave(signatureDialog.perguntaId, dataUrl)}
        titulo={signatureDialog.title}
      />

      {/* Dialog de confirmação para finalizar APR */}
      <AlertDialog open={showConfirmFinish} onOpenChange={setShowConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Conclusão da APR
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a <strong>concluir</strong> esta Análise Preliminar de Riscos.
              </p>
              <p className="text-amber-600 font-medium">
                ⚠️ Após a conclusão, a APR NÃO poderá ser editada. 
                Certifique-se de que todas as informações estão corretas.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarSalvarAPR}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Confirmar e Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
import { FotoUploader } from "@/components/app/FotoUploader";
import { SignatureFullScreen } from "@/components/app/SignatureFullScreen";
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

interface FotoData {
  url: string;
  latitude?: number;
  longitude?: number;
  dataHora: string;
}

interface Resposta {
  pergunta_id: string;
  resposta: string | string[] | boolean | number | null;
  foto_url?: string;
  fotos?: FotoData[]; // Novo: suporte a múltiplas fotos
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
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [camposComErro, setCamposComErro] = useState<Set<string>>(new Set());
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
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

  const toggleGrupo = useCallback((grupoId: string) => {
    setGruposExpandidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(grupoId)) {
        newSet.delete(grupoId);
      } else {
        newSet.add(grupoId);
      }
      return newSet;
    });
  }, []);

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

  // Obter localização atual (usado para assinaturas)
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

  // Verificar se pergunta está respondida corretamente
  const isPerguntaValidaParaSalvar = (pergunta: Pergunta): boolean => {
    const resposta = respostas[pergunta.id];
    if (!resposta) return false;
    
    if (pergunta.tipo === 'foto') {
      return (resposta.fotos && resposta.fotos.length > 0) || !!resposta.foto_url;
    }
    if (pergunta.tipo === 'assinatura') {
      return !!resposta.assinatura_url;
    }
    
    // Verificar se a resposta exige foto
    if (perguntaExigeFoto(pergunta)) {
      const temFoto = (resposta.fotos && resposta.fotos.length > 0) || !!resposta.foto_url;
      if (!temFoto) return false;
    }
    
    return resposta.resposta !== null && resposta.resposta !== undefined && resposta.resposta !== '';
  };

  // Validar APR antes de salvar
  const validarAPR = (): { valido: boolean; erros: string[] } => {
    const erros: string[] = [];
    const novosErros = new Set<string>();
    
    // Validar perguntas obrigatórias
    const perguntasObrigatorias = todasPerguntas.filter(p => p.obrigatoria);
    
    for (const pergunta of perguntasObrigatorias) {
      if (!isPerguntaValidaParaSalvar(pergunta)) {
        novosErros.add(pergunta.id);
        erros.push(pergunta.texto);
      }
    }
    
    // Validar fotos condicionais
    for (const pergunta of todasPerguntas) {
      if (perguntaExigeFoto(pergunta)) {
        const resposta = respostas[pergunta.id];
        const temFoto = (resposta?.fotos && resposta.fotos.length > 0) || !!resposta?.foto_url;
        if (!temFoto) {
          novosErros.add(pergunta.id);
          if (!erros.includes(pergunta.texto)) {
            erros.push(`${pergunta.texto} (foto obrigatória)`);
          }
        }
      }
    }
    
    setCamposComErro(novosErros);
    
    return { valido: novosErros.size === 0, erros };
  };

  // Scroll para primeiro erro
  const scrollParaPrimeiroErro = () => {
    const primeiroErro = Array.from(camposComErro)[0];
    if (primeiroErro) {
      // Encontrar o grupo da pergunta
      const grupo = checklist?.grupos?.find(g => 
        g.perguntas.some(p => p.id === primeiroErro)
      );
      
      if (grupo && !gruposExpandidos.has(grupo.id)) {
        // Expandir o grupo
        setGruposExpandidos(prev => new Set([...prev, grupo.id]));
      }
      
      // Aguardar a expansão e fazer scroll
      setTimeout(() => {
        const element = document.getElementById(`pergunta-${primeiroErro}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Adicionar animação de destaque
          element.classList.add('animate-pulse');
          setTimeout(() => element.classList.remove('animate-pulse'), 2000);
        }
      }, 300);
    }
  };

  // Salvar APR
  const salvarAPR = async () => {
    if (!checklist) return;
    
    // Se já está concluída, não permite edição
    if (respostaExistente?.status === 'completo') {
      toast.error("Esta APR já foi concluída e não pode ser editada");
      return;
    }

    // Validar
    const { valido, erros } = validarAPR();
    
    if (!valido) {
      toast.error(
        <div>
          <p className="font-semibold">Preencha os campos obrigatórios:</p>
          <ul className="text-xs mt-1 list-disc pl-4">
            {erros.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
            {erros.length > 3 && <li>...e mais {erros.length - 3} campo(s)</li>}
          </ul>
        </div>,
        { duration: 5000 }
      );
      scrollParaPrimeiroErro();
      return;
    }

    // Mostrar confirmação antes de finalizar
    setShowConfirmFinish(true);
  };

  // Confirmar e salvar APR
  const confirmarSalvarAPR = async () => {
    if (!checklist) return;
    
    setShowConfirmFinish(false);
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

      toast.success("APR concluída com sucesso!");
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

  // Renderizar campo em modo visualização (somente leitura)
  const renderCampoVisualizacao = (pergunta: Pergunta, resposta: Resposta | undefined, opcoes: Opcao[]) => {
    const valor = resposta?.resposta;
    const fotos = resposta?.fotos || (resposta?.foto_url ? [{
      url: resposta.foto_url,
      latitude: resposta.foto_latitude,
      longitude: resposta.foto_longitude,
      dataHora: resposta.foto_data_hora || '',
    }] : []);
    
    return (
      <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
        {/* Valor da resposta */}
        {pergunta.tipo === 'foto' ? (
          fotos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fotos.map((foto, i) => (
                <div key={i} className="relative">
                  <img src={foto.url} alt={`Foto ${i + 1}`} className="w-20 h-20 object-cover rounded border" />
                  {foto.dataHora && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">📅 {foto.dataHora}</p>
                  )}
                  {foto.latitude && foto.longitude && (
                    <p className="text-[9px] text-muted-foreground">📍 {foto.latitude.toFixed(4)}, {foto.longitude.toFixed(4)}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground italic">Sem foto</span>
          )
        ) : pergunta.tipo === 'assinatura' ? (
          resposta?.assinatura_url ? (
            <div>
              <img src={resposta.assinatura_url} alt="Assinatura" className="w-full h-24 object-contain bg-white rounded border" />
              {resposta.assinatura_data_hora && (
                <p className="text-[9px] text-muted-foreground mt-1">📅 {resposta.assinatura_data_hora}</p>
              )}
              {resposta.assinatura_latitude && resposta.assinatura_longitude && (
                <p className="text-[9px] text-muted-foreground">📍 {resposta.assinatura_latitude.toFixed(4)}, {resposta.assinatura_longitude.toFixed(4)}</p>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground italic">Sem assinatura</span>
          )
        ) : pergunta.tipo === 'sim_nao' ? (
          valor === 'sim' ? (
            <Badge variant="destructive">Sim (Risco identificado)</Badge>
          ) : valor === 'nao' ? (
            <Badge className="bg-green-600">Não</Badge>
          ) : (
            <span className="text-muted-foreground italic">Não respondida</span>
          )
        ) : pergunta.tipo === 'multipla_escolha' && Array.isArray(valor) ? (
          <div className="flex flex-wrap gap-1">
            {valor.map((v, i) => (
              <Badge key={i} variant="secondary">{v}</Badge>
            ))}
          </div>
        ) : valor !== null && valor !== undefined && valor !== '' ? (
          <p className="text-sm font-medium">{String(valor)}</p>
        ) : (
          <span className="text-muted-foreground italic">Não respondida</span>
        )}

        {/* Fotos anexadas (para perguntas que não são do tipo foto) */}
        {pergunta.tipo !== 'foto' && fotos.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Fotos anexadas:</p>
            <div className="flex flex-wrap gap-2">
              {fotos.map((foto, i) => (
                <img key={i} src={foto.url} alt={`Foto ${i + 1}`} className="w-16 h-16 object-cover rounded border" />
              ))}
            </div>
          </div>
        )}

        {/* Observação */}
        {resposta?.observacao && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Observação:</p>
            <p className="text-sm">{resposta.observacao}</p>
          </div>
        )}
      </div>
    );
  };

  // Verificar se a APR está em modo somente leitura (concluída)
  const isAPRConcluida = respostaExistente?.status === 'completo';

  const renderCampoResposta = (pergunta: Pergunta) => {
    const resposta = respostas[pergunta.id];
    const opcoes = getOpcoes(pergunta);
    const exigeFoto = perguntaExigeFoto(pergunta);
    const exigeObservacao = perguntaExigeObservacao(pergunta);
    const alerta = getAlertaResposta(pergunta);

    // Se a APR está concluída, mostrar apenas visualização
    if (isAPRConcluida) {
      return renderCampoVisualizacao(pergunta, resposta, opcoes);
    }

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
          // Converter fotos antigas para o novo formato se necessário
          const fotosAtuais: FotoData[] = resposta?.fotos || (resposta?.foto_url ? [{
            url: resposta.foto_url,
            latitude: resposta.foto_latitude,
            longitude: resposta.foto_longitude,
            dataHora: resposta.foto_data_hora || '',
          }] : []);
          
          return (
            <div className="space-y-2">
              <FotoUploader
                fotos={fotosAtuais}
                onFotosChange={(novasFotos) => {
                  // Atualizar resposta com as novas fotos
                  updateRespostaMultiplo(pergunta.id, {
                    fotos: novasFotos,
                    foto_url: novasFotos.length > 0 ? novasFotos[0].url : undefined,
                    foto_latitude: novasFotos.length > 0 ? novasFotos[0].latitude : undefined,
                    foto_longitude: novasFotos.length > 0 ? novasFotos[0].longitude : undefined,
                    foto_data_hora: novasFotos.length > 0 ? novasFotos[0].dataHora : undefined,
                    resposta: novasFotos.length > 0 ? true : null,
                  });
                }}
                maxFotos={10}
                label="Foto"
              />
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
          // Converter fotos antigas para o novo formato se necessário
          const fotosCondicionais: FotoData[] = resposta?.fotos || (resposta?.foto_url ? [{
            url: resposta.foto_url,
            latitude: resposta.foto_latitude,
            longitude: resposta.foto_longitude,
            dataHora: resposta.foto_data_hora || '',
          }] : []);
          
          return (
            <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Foto obrigatória para esta resposta
              </p>
              <FotoUploader
                fotos={fotosCondicionais}
                onFotosChange={(novasFotos) => {
                  updateRespostaMultiplo(pergunta.id, {
                    fotos: novasFotos,
                    foto_url: novasFotos.length > 0 ? novasFotos[0].url : undefined,
                    foto_latitude: novasFotos.length > 0 ? novasFotos[0].latitude : undefined,
                    foto_longitude: novasFotos.length > 0 ? novasFotos[0].longitude : undefined,
                    foto_data_hora: novasFotos.length > 0 ? novasFotos[0].dataHora : undefined,
                  });
                }}
                maxFotos={10}
                label="Foto"
              />
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
    if (pergunta.tipo === 'foto') {
      // Verificar tanto o novo formato (fotos[]) quanto o antigo (foto_url)
      return (resposta.fotos && resposta.fotos.length > 0) || !!resposta.foto_url;
    }
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
            // Verificar se o grupo tem perguntas com erro
            const grupoTemErro = grupo.perguntas.some(p => camposComErro.has(p.id));

            return (
              <Collapsible
                key={grupo.id}
                open={isExpanded}
              >
                <Card 
                  id={`grupo-${grupo.id}`}
                  className={`transition-all ${
                    grupoTemErro 
                      ? 'border-red-400 bg-red-50/50 ring-2 ring-red-300' 
                      : todasRespondidas 
                        ? 'border-green-300 bg-green-50/50' 
                        : ''
                  }`}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader 
                      className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleGrupo(grupo.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <CardTitle className={`text-sm font-semibold ${grupoTemErro ? 'text-red-700' : ''}`}>
                            {grupo.nome}
                          </CardTitle>
                          {grupoTemErro && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <Badge 
                          variant={grupoTemErro ? "destructive" : todasRespondidas ? "default" : "secondary"}
                          className={todasRespondidas && !grupoTemErro ? "bg-green-600" : ""}
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
                          const temErro = camposComErro.has(pergunta.id);

                          return (
                            <div 
                              key={pergunta.id}
                              id={`pergunta-${pergunta.id}`}
                              className={`p-3 rounded-lg border transition-all ${
                                temErro 
                                  ? 'border-red-400 bg-red-50 ring-2 ring-red-300' 
                                  : respondida 
                                    ? 'border-green-200 bg-green-50/50' 
                                    : 'border-muted bg-muted/20'
                              }`}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <Badge 
                                  variant="outline" 
                                  className={`shrink-0 text-xs ${
                                    temErro 
                                      ? 'bg-red-100 text-red-700 border-red-400' 
                                      : respondida 
                                        ? 'bg-green-100 text-green-700 border-green-300' 
                                        : ''
                                  }`}
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

        {/* Botão Salvar - Apenas se não estiver concluída */}
        {respostaExistente?.status === 'completo' ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-green-800">APR Concluída</p>
            <p className="text-sm text-green-600">Esta APR já foi finalizada e não pode ser editada.</p>
          </div>
        ) : (
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
            {respostaExistente ? 'Atualizar APR' : 'Concluir APR'}
          </Button>
        )}
      </div>

      {/* Tela cheia de Assinatura */}
      <SignatureFullScreen
        open={signatureDialog.open}
        onClose={() => setSignatureDialog({ open: false, perguntaId: "", title: "" })}
        onSave={(dataUrl) => handleSignatureSave(signatureDialog.perguntaId, dataUrl)}
        titulo={signatureDialog.title}
      />

      {/* Dialog de confirmação para finalizar APR */}
      <AlertDialog open={showConfirmFinish} onOpenChange={setShowConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Conclusão da APR
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a <strong>concluir</strong> esta Análise Preliminar de Riscos.
              </p>
              <p className="text-amber-600 font-medium">
                ⚠️ Após a conclusão, a APR NÃO poderá ser editada. 
                Certifique-se de que todas as informações estão corretas.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarSalvarAPR}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Confirmar e Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
