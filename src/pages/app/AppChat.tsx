import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { useChat, ChatMensagem } from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageCircle,
  Send,
  Image as ImageIcon,
  MapPin,
  Check,
  CheckCheck,
  Loader2,
  Radio,
  RefreshCw,
  Mic,
} from "lucide-react";
import { AudioPlayer } from "@/components/chat/AudioPlayer";
import { AudioRecorder } from "@/components/chat/AudioRecorder";
import { cn } from "@/lib/utils";

// ============================================
// PÁGINA DE CHAT DO APP MOBILE
// ============================================

export default function AppChat() {
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  
  const equipeAtual = equipe || equipeAuth;
  const equipeId = equipeAtual?.id || "";
  const equipeCodigo = equipeAtual?.codigo || "";

  const [inputValue, setInputValue] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    mensagens,
    conversaAtiva,
    loading,
    enviando,
    obterOuCriarConversa,
    enviarMensagem,
    enviarImagem,
    enviarLocalizacao,
    enviarAudio,
    carregarConversas,
  } = useChat({
    tipoUsuario: "equipe",
    equipeId,
    equipeCodigo,
    onNovaMensagem: (msg) => {
      toast.info(`Nova mensagem de ${msg.remetente_nome || "Suporte"}`, {
        description: msg.conteudo?.substring(0, 50) || "Mensagem recebida",
      });
    }
  });

  // Auto-scroll quando novas mensagens chegam
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        } else {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [mensagens]);

  // Iniciar conversa automaticamente ao montar
  useEffect(() => {
    if (equipeId && !conversaAtiva) {
      obterOuCriarConversa({
        id: equipeId,
        codigo: equipeCodigo,
        nome: equipeCodigo
      });
    }
  }, [equipeId, equipeCodigo, conversaAtiva, obterOuCriarConversa]);

  const handleEnviar = async () => {
    if (selectedImage) {
      await enviarImagem(selectedImage);
      setSelectedImage(null);
      setImagePreview(null);
    } else if (inputValue.trim()) {
      await enviarMensagem(inputValue);
      setInputValue("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Imagem muito grande (máx. 10MB)");
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleEnviarLocalizacao = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não disponível");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        enviarLocalizacao(pos.coords.latitude, pos.coords.longitude);
        toast.success("Localização enviada!");
      },
      () => toast.error("Erro ao obter localização")
    );
  };

  const handleEnviarAudio = async (blob: Blob, duration: number) => {
    await enviarAudio(blob, duration);
    setIsRecordingAudio(false);
  };

  const formatarData = (data: string) => {
    const hoje = new Date();
    const msgDate = new Date(data);
    
    if (msgDate.toDateString() === hoje.toDateString()) {
      return "Hoje";
    }
    
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    if (msgDate.toDateString() === ontem.toDateString()) {
      return "Ontem";
    }
    
    return format(msgDate, "dd/MM/yyyy", { locale: ptBR });
  };

  // Agrupar mensagens por data
  const mensagensAgrupadas = mensagens.reduce((acc, msg) => {
    const data = formatarData(msg.created_at);
    if (!acc[data]) acc[data] = [];
    acc[data].push(msg);
    return acc;
  }, {} as Record<string, ChatMensagem[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Header do Chat */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12 border-2 border-white/30">
              <AvatarFallback className="bg-white/20 text-white">
                <Radio className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border-2 border-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Suporte</h1>
            <p className="text-xs text-blue-100">Atendimento em tempo real</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => carregarConversas()}
            className="text-white hover:bg-white/20"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Área de mensagens */}
      <ScrollArea 
        ref={scrollRef}
        className="flex-1 p-4 bg-gradient-to-b from-gray-50 to-white"
      >
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <Skeleton className="h-16 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="p-4 rounded-full bg-blue-100 mb-4">
              <MessageCircle className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Início da conversa</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-[250px]">
              Envie uma mensagem para o Suporte. Estamos aqui para ajudar!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(mensagensAgrupadas).map(([data, msgs]) => (
              <div key={data}>
                {/* Separador de data */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-100 rounded-full">
                    {data}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Mensagens do dia */}
                {msgs.map((msg) => (
                  <MensagemBubble key={msg.id} mensagem={msg} />
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Preview de imagem */}
      {imagePreview && (
        <div className="p-2 border-t bg-gray-50">
          <div className="relative inline-block">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="h-20 rounded-lg object-cover"
            />
            <Button
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={() => {
                setImagePreview(null);
                setSelectedImage(null);
              }}
            >
              ×
            </Button>
          </div>
        </div>
      )}

      {/* Input de mensagem */}
      <div className="p-3 border-t bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          
          {/* Se está gravando áudio, mostrar o gravador */}
          {isRecordingAudio ? (
            <div className="flex-1">
              <AudioRecorder
                onSend={handleEnviarAudio}
                onCancel={() => setIsRecordingAudio(false)}
                disabled={enviando}
                variant="blue"
              />
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={enviando}
                className="text-gray-500 hover:text-blue-600"
              >
                <ImageIcon className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleEnviarLocalizacao}
                disabled={enviando}
                className="text-gray-500 hover:text-blue-600"
              >
                <MapPin className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsRecordingAudio(true)}
                disabled={enviando}
                className="text-gray-500 hover:text-blue-600"
              >
                <Mic className="h-5 w-5" />
              </Button>

              <Input
                placeholder="Digite sua mensagem..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={enviando}
                className="flex-1 rounded-full border-gray-200 focus:border-blue-400"
              />

              <Button
                size="icon"
                onClick={handleEnviar}
                disabled={enviando || (!inputValue.trim() && !selectedImage)}
                className="rounded-full bg-blue-600 hover:bg-blue-700"
              >
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE DE BOLHA DE MENSAGEM
// ============================================

function MensagemBubble({ mensagem }: { mensagem: ChatMensagem }) {
  const [imageOpen, setImageOpen] = useState(false);
  const isMinha = mensagem.remetente_tipo === "equipe";

  const renderConteudo = () => {
    if (mensagem.tipo === "imagem" && mensagem.arquivo_url) {
      return (
        <>
          <img
            src={mensagem.arquivo_url}
            alt="Imagem"
            className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setImageOpen(true)}
          />
          <Dialog open={imageOpen} onOpenChange={setImageOpen}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
              <img
                src={mensagem.arquivo_url}
                alt="Imagem"
                className="w-full h-full object-contain"
              />
            </DialogContent>
          </Dialog>
        </>
      );
    }

    if (mensagem.tipo === "audio" && mensagem.arquivo_url) {
      return (
        <AudioPlayer
          src={mensagem.arquivo_url}
          duration={mensagem.audio_duracao}
          variant={isMinha ? "dark" : "light"}
        />
      );
    }

    if (mensagem.tipo === "localizacao" && mensagem.latitude && mensagem.longitude) {
      const mapsUrl = `https://www.google.com/maps?q=${mensagem.latitude},${mensagem.longitude}`;
      return (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-600 hover:underline"
        >
          <MapPin className="h-4 w-4" />
          <span>Ver no mapa</span>
        </a>
      );
    }

    return <p className="text-sm whitespace-pre-wrap">{mensagem.conteudo}</p>;
  };

  const renderStatus = () => {
    if (!isMinha) return null;

    switch (mensagem.status) {
      case "enviando":
        return <Loader2 className="h-3 w-3 animate-spin text-gray-400" />;
      case "enviada":
        return <Check className="h-3 w-3 text-gray-400" />;
      case "entregue":
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case "lida":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex mb-2", isMinha ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 shadow-sm",
          isMinha
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-white text-gray-900 rounded-bl-md border"
        )}
      >
        {!isMinha && mensagem.remetente_nome && (
          <p className="text-xs font-medium text-blue-600 mb-1">
            {mensagem.remetente_nome}
          </p>
        )}
        
        {renderConteudo()}
        
        <div className={cn(
          "flex items-center justify-end gap-1 mt-1",
          isMinha ? "text-blue-100" : "text-gray-400"
        )}>
          <span className="text-[10px]">
            {format(new Date(mensagem.created_at), "HH:mm")}
          </span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}


