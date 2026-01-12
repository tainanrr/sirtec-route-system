import { useState, useRef, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useWebAuth } from "@/contexts/WebAuthContext";
import { useChat, ChatMensagem, ChatConversa } from "@/hooks/useChat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import {
  MessageCircle,
  Send,
  Image as ImageIcon,
  MapPin,
  X,
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  Users,
  Search,
  Plus,
  Radio,
  Clock,
  Circle,
  MoreVertical,
  Archive,
  Trash2,
  ExternalLink,
  Mic,
} from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import { AudioRecorder } from "./AudioRecorder";
import { cn } from "@/lib/utils";

// ============================================
// TIPOS ADICIONAIS
// ============================================

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  color?: string;
  status?: string;
}

// ============================================
// COMPONENTE PRINCIPAL - CHAT TORRE DE CONTROLE
// ============================================

export function ChatTorreControle() {
  const { usuarioWeb: usuario } = useWebAuth();
  
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [novaConversaOpen, setNovaConversaOpen] = useState(false);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loadingEquipes, setLoadingEquipes] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Nome do usuário para exibir nas mensagens
  const nomeUsuario = usuario?.nome || usuario?.email?.split("@")[0] || "Suporte";

  const {
    conversas,
    mensagens,
    conversaAtiva,
    loading,
    enviando,
    totalNaoLidas,
    abrirConversa,
    obterOuCriarConversa,
    enviarMensagem,
    enviarImagem,
    enviarAudio,
    fecharConversa,
    carregarConversas,
  } = useChat({
    tipoUsuario: "torre",
    usuarioId: usuario?.id,
    usuarioNome: nomeUsuario,
    onNovaMensagem: (msg) => {
      if (!open) {
        toast.info(`Nova mensagem de ${msg.remetente_nome}`, {
          description: msg.conteudo?.substring(0, 50) || "Mensagem recebida",
          action: {
            label: "Ver",
            onClick: () => setOpen(true)
          }
        });
      }
    }
  });

  // Buscar equipes disponíveis
  const carregarEquipes = async () => {
    setLoadingEquipes(true);
    try {
      const { data } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome, color, status")
        .order("codigo");
      
      setEquipes(data || []);
    } catch (error) {
      console.error("Erro ao carregar equipes:", error);
    } finally {
      setLoadingEquipes(false);
    }
  };

  useEffect(() => {
    if (novaConversaOpen) {
      carregarEquipes();
    }
  }, [novaConversaOpen]);

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

  // Filtrar conversas
  const conversasFiltradas = useMemo(() => {
    if (!searchTerm.trim()) return conversas;
    const termo = searchTerm.toLowerCase();
    return conversas.filter(conv => 
      conv.equipe?.codigo?.toLowerCase().includes(termo) ||
      conv.equipe?.nome?.toLowerCase().includes(termo) ||
      conv.ultima_mensagem_preview?.toLowerCase().includes(termo)
    );
  }, [conversas, searchTerm]);

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

  const handleNovaConversa = async (equipe: Equipe) => {
    setNovaConversaOpen(false);
    await obterOuCriarConversa(equipe);
  };

  const handleEnviarAudio = async (blob: Blob, duration: number) => {
    await enviarAudio(blob, duration);
    setIsRecordingAudio(false);
  };

  const formatarHora = (data: string) => {
    const msgDate = new Date(data);
    const hoje = new Date();
    
    if (msgDate.toDateString() === hoje.toDateString()) {
      return format(msgDate, "HH:mm");
    }
    
    return format(msgDate, "dd/MM HH:mm");
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
    <>
      {/* Botão flutuante */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "fixed bottom-6 right-6 z-[100001] h-14 px-4 rounded-full shadow-lg gap-2",
              "bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800",
              "transition-all duration-300 hover:scale-105",
              totalNaoLidas > 0 && "animate-pulse"
            )}
          >
            <MessageCircle className="h-5 w-5" />
            <span className="font-medium">Chat</span>
            {totalNaoLidas > 0 && (
              <Badge 
                className="h-5 min-w-5 p-0 px-1.5 flex items-center justify-center bg-red-500 text-white"
              >
                {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
              </Badge>
            )}
          </Button>
        </SheetTrigger>

        <SheetContent 
          side="right" 
          className="w-[450px] sm:w-[500px] p-0 flex flex-col !z-[100002]"
        >
          {/* Se não tem conversa ativa, mostrar lista */}
          {!conversaAtiva ? (
            <>
              {/* Header da lista */}
              <SheetHeader className="p-4 border-b bg-gradient-to-r from-emerald-600 to-emerald-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-white/20">
                      <Radio className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <SheetTitle className="text-white text-lg">Central de Mensagens</SheetTitle>
                      <p className="text-xs text-emerald-100">{conversas.length} conversas ativas</p>
                    </div>
                  </div>
                  <Popover open={novaConversaOpen} onOpenChange={setNovaConversaOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white/20 hover:bg-white/30 text-white border-0"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Nova
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Buscar equipe..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma equipe encontrada.</CommandEmpty>
                          <CommandGroup heading="Equipes disponíveis">
                            {equipes.map(equipe => (
                              <CommandItem
                                key={equipe.id}
                                value={equipe.codigo}
                                onSelect={() => handleNovaConversa(equipe)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback 
                                      style={{ backgroundColor: equipe.color || "#6366f1" }}
                                      className="text-white text-xs"
                                    >
                                      {equipe.codigo.substring(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{equipe.codigo}</p>
                                    <p className="text-xs text-muted-foreground">{equipe.nome}</p>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </SheetHeader>

              {/* Busca */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar conversas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Lista de conversas */}
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : conversasFiltradas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                    <div className="p-4 rounded-full bg-gray-100 mb-4">
                      <MessageCircle className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Nenhuma conversa</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Clique em "Nova" para iniciar uma conversa com uma equipe.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {conversasFiltradas.map(conversa => (
                      <ConversaItem
                        key={conversa.id}
                        conversa={conversa}
                        onClick={() => abrirConversa(conversa)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <>
              {/* Header da conversa */}
              <SheetHeader className="p-4 border-b bg-gradient-to-r from-emerald-600 to-emerald-700">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={fecharConversa}
                    className="text-white hover:bg-white/20"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-10 w-10 border-2 border-white/30">
                    <AvatarFallback 
                      style={{ backgroundColor: conversaAtiva.equipe?.color || "#6366f1" }}
                      className="text-white"
                    >
                      {conversaAtiva.equipe?.codigo?.substring(0, 2) || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <SheetTitle className="text-white text-lg">
                      {conversaAtiva.equipe?.codigo || "Equipe"}
                    </SheetTitle>
                    <p className="text-xs text-emerald-100">
                      {conversaAtiva.equipe?.nome || ""}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              {/* Área de mensagens */}
              <ScrollArea 
                ref={scrollRef}
                className="flex-1 p-4 bg-gradient-to-b from-gray-50 to-white"
              >
                {mensagens.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="p-4 rounded-full bg-emerald-100 mb-4">
                      <MessageCircle className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Início da conversa</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-[250px]">
                      Envie uma mensagem para {conversaAtiva.equipe?.codigo}
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
                          <MensagemBubble key={msg.id} mensagem={msg} tipoUsuario="torre" />
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
                      <X className="h-3 w-3" />
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
                        variant="emerald"
                      />
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={enviando}
                        className="text-gray-500 hover:text-emerald-600"
                      >
                        <ImageIcon className="h-5 w-5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsRecordingAudio(true)}
                        disabled={enviando}
                        className="text-gray-500 hover:text-emerald-600"
                      >
                        <Mic className="h-5 w-5" />
                      </Button>

                      <Input
                        placeholder="Digite sua mensagem..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        disabled={enviando}
                        className="flex-1"
                      />

                      <Button
                        size="icon"
                        onClick={handleEnviar}
                        disabled={enviando || (!inputValue.trim() && !selectedImage)}
                        className="bg-emerald-600 hover:bg-emerald-700"
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
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ============================================
// COMPONENTE ITEM DE CONVERSA
// ============================================

function ConversaItem({ 
  conversa, 
  onClick 
}: { 
  conversa: ChatConversa; 
  onClick: () => void;
}) {
  const temNaoLidas = conversa.nao_lidas_torre > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left",
        temNaoLidas && "bg-emerald-50/50"
      )}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarFallback 
            style={{ backgroundColor: conversa.equipe?.color || "#6366f1" }}
            className="text-white"
          >
            {conversa.equipe?.codigo?.substring(0, 2) || "??"}
          </AvatarFallback>
        </Avatar>
        <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className={cn(
            "font-medium truncate",
            temNaoLidas && "text-emerald-700"
          )}>
            {conversa.equipe?.codigo || "Equipe"}
          </h4>
          {conversa.ultima_mensagem_at && (
            <span className="text-xs text-muted-foreground shrink-0">
              {format(new Date(conversa.ultima_mensagem_at), "HH:mm")}
            </span>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground truncate">
          {conversa.equipe?.nome || ""}
        </p>

        <div className="flex items-center justify-between gap-2 mt-1">
          <p className={cn(
            "text-sm truncate",
            temNaoLidas ? "font-medium text-gray-900" : "text-gray-500"
          )}>
            {conversa.ultima_mensagem_preview || "Sem mensagens"}
          </p>
          {temNaoLidas && (
            <Badge className="bg-emerald-600 text-white shrink-0 h-5 min-w-5 p-0 px-1.5 flex items-center justify-center">
              {conversa.nao_lidas_torre}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================
// COMPONENTE DE BOLHA DE MENSAGEM
// ============================================

function MensagemBubble({ 
  mensagem, 
  tipoUsuario 
}: { 
  mensagem: ChatMensagem;
  tipoUsuario: "torre" | "equipe";
}) {
  const [imageOpen, setImageOpen] = useState(false);
  const isMinha = mensagem.remetente_tipo === tipoUsuario;

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
          className={cn(
            "flex items-center gap-2 hover:underline",
            isMinha ? "text-emerald-100" : "text-emerald-600"
          )}
        >
          <MapPin className="h-4 w-4" />
          <span>Ver no mapa</span>
          <ExternalLink className="h-3 w-3" />
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
        return <CheckCheck className="h-3 w-3 text-emerald-400" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex", isMinha ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 shadow-sm",
          isMinha
            ? "bg-emerald-600 text-white rounded-br-md"
            : "bg-white text-gray-900 rounded-bl-md border"
        )}
      >
        {!isMinha && mensagem.remetente_nome && (
          <p className="text-xs font-medium text-emerald-600 mb-1">
            {mensagem.remetente_nome}
          </p>
        )}
        
        {renderConteudo()}
        
        <div className={cn(
          "flex items-center justify-end gap-1 mt-1",
          isMinha ? "text-emerald-100" : "text-gray-400"
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

export default ChatTorreControle;

