import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData } from "@/hooks/useOfflineData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  ArrowLeft,
  Download,
  ExternalLink,
  File,
  FileImage,
  Clock,
  Shield,
  Wrench,
  Award,
  Briefcase,
  Settings,
  FolderOpen,
  Paperclip,
  Eye,
  AlertCircle,
  Share2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Link2,
  CloudOff,
  Loader2,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Anexo {
  id: string;
  nome: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tamanho_bytes: number;
  storage_path: string;
  url_publica: string | null;
  descricao: string | null;
  ordem: number;
}

interface Procedimento {
  id: string;
  titulo: string;
  descricao: string | null;
  conteudo: string | null;
  categoria: string;
  arquivo_url: string | null;
  visivel_app: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

// Configuração de categorias
const categoriaConfig: Record<string, {
  label: string;
  icon: typeof FileText;
  gradient: string;
  bgColor: string;
  textColor: string;
}> = {
  seguranca: {
    label: "Segurança",
    icon: Shield,
    gradient: "from-red-500 to-orange-500",
    bgColor: "bg-red-500/10",
    textColor: "text-red-600 dark:text-red-400",
  },
  tecnico: {
    label: "Técnico",
    icon: Wrench,
    gradient: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  qualidade: {
    label: "Qualidade",
    icon: Award,
    gradient: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-600 dark:text-purple-400",
  },
  administrativo: {
    label: "Administrativo",
    icon: Briefcase,
    gradient: "from-amber-500 to-yellow-500",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  operacional: {
    label: "Operacional",
    icon: Settings,
    gradient: "from-green-500 to-emerald-500",
    bgColor: "bg-green-500/10",
    textColor: "text-green-600 dark:text-green-400",
  },
  outro: {
    label: "Outros",
    icon: FolderOpen,
    gradient: "from-slate-500 to-gray-500",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-600 dark:text-slate-400",
  },
};

// Formatar tamanho de arquivo
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Ícone baseado no tipo de arquivo
const getFileIcon = (tipo: string) => {
  if (tipo.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  if (tipo.includes("image")) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (tipo.includes("word") || tipo.includes("document")) return <FileText className="h-5 w-5 text-blue-600" />;
  return <File className="h-5 w-5 text-gray-500" />;
};

export default function AppProcedimentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    isSupported: offlineSupported, 
    isInCache, 
    isInCacheAsync,
    removeFromCache, 
    getFromCache,
    getCachedByProcedimento,
    refreshCache,
  } = useOfflineCache();
  const { isOnline } = useOfflineSyncContext();
  const { getProcedimentosFromCache, saveToCache, getFromCache: getDataFromCache } = useOfflineData();
  
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [pdfViewerTitle, setPdfViewerTitle] = useState("");
  const [showFullContent, setShowFullContent] = useState(false);

  // Atualizar cache quando componente montar ou quando ficar offline
  // para garantir que temos a lista atualizada de arquivos em cache
  useEffect(() => {
    if (!isOnline && offlineSupported) {
      refreshCache();
    }
  }, [isOnline, offlineSupported, refreshCache]);

  // Buscar procedimento
  const { data: procedimento, isLoading, error } = useQuery({
    queryKey: ["procedimento-detalhe", id],
    queryFn: async () => {
      // Se offline, buscar do cache de procedimentos
      if (!isOnline) {
        // Primeiro tentar cache específico do procedimento
        const cachedProcedimento = await getDataFromCache<Procedimento>(`procedimento_${id}`);
        if (cachedProcedimento) {
          console.log("[ProcedimentoDetalhe] Usando cache específico do procedimento");
          return cachedProcedimento;
        }
        
        // Senão, buscar da lista de procedimentos
        const procedimentos = await getProcedimentosFromCache();
        if (procedimentos) {
          const found = (procedimentos as Procedimento[]).find(p => p.id === id);
          if (found) {
            console.log("[ProcedimentoDetalhe] Encontrado na lista de procedimentos em cache");
            return found;
          }
        }
        return null;
      }

      const { data, error } = await supabase
        .from("procedimentos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Salvar no cache para uso offline
      await saveToCache(`procedimento_${id}`, data, 24);
      
      return data as Procedimento;
    },
    enabled: !!id,
  });

  // Buscar anexos
  const { data: anexos, isLoading: isLoadingAnexos } = useQuery({
    queryKey: ["procedimento-anexos", id],
    queryFn: async () => {
      // Se offline, buscar do cache
      if (!isOnline) {
        const cachedAnexos = await getDataFromCache<Anexo[]>(`procedimento_anexos_${id}`);
        if (cachedAnexos) {
          console.log("[ProcedimentoDetalhe] Usando cache de anexos:", cachedAnexos.length);
          return cachedAnexos;
        }
        return [];
      }

      const { data, error } = await supabase
        .from("procedimentos_anexos")
        .select("*")
        .eq("procedimento_id", id)
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (error) throw error;
      
      // Salvar no cache para uso offline
      if (data && data.length > 0) {
        await saveToCache(`procedimento_anexos_${id}`, data, 24);
      }
      
      return data as Anexo[];
    },
    enabled: !!id,
  });

  const getCategoria = (cat: string) => {
    return categoriaConfig[cat] || categoriaConfig.outro;
  };

  // Obter URL do arquivo (do cache ou online)
  const getFileUrl = async (anexo: Anexo): Promise<string | null> => {
    // Tentar buscar do cache primeiro (sempre, independente do estado isInCache)
    // Isso garante que funciona offline mesmo se o estado não estiver atualizado
    try {
      const blob = await getFromCache(anexo.id);
      if (blob) {
        console.log("[ProcedimentoDetalhe] Arquivo carregado do cache:", anexo.nome);
        return URL.createObjectURL(blob);
      }
    } catch (error) {
      console.warn("[ProcedimentoDetalhe] Erro ao buscar do cache:", error);
    }

    // Se não estiver no cache e estiver offline, não há como buscar
    if (!isOnline) {
      console.warn("[ProcedimentoDetalhe] Arquivo não disponível offline:", anexo.nome);
      return null;
    }

    // Se não estiver no cache, buscar online
    let url = anexo.url_publica;
    if (!url && anexo.storage_path) {
      const { data } = await supabase.storage
        .from("procedimentos")
        .getPublicUrl(anexo.storage_path);
      url = data.publicUrl;
    }
    return url;
  };

  // Abrir arquivo
  const handleOpenFile = async (anexo: Anexo) => {
    try {
      const url = await getFileUrl(anexo);

      if (!url) {
        if (!isOnline) {
          toast.error("Arquivo não disponível offline. Sincronize enquanto estiver conectado.");
        } else {
          toast.error("URL do arquivo não disponível");
        }
        return;
      }

      // Se for PDF, abrir no visualizador
      if (anexo.tipo_arquivo.includes("pdf")) {
        setPdfViewerUrl(url);
        setPdfViewerTitle(anexo.nome);
      } else {
        // Outros arquivos, abrir em nova aba
        window.open(url, "_blank");
      }
    } catch (error) {
      console.error("Erro ao abrir arquivo:", error);
      toast.error("Erro ao abrir arquivo");
    }
  };

  // Verificar quantos arquivos estão em cache
  const cachedFilesCount = id ? getCachedByProcedimento(id).length : 0;
  const allFilesCached = anexos && anexos.length > 0 && cachedFilesCount === anexos.length;

  // Download de arquivo
  const handleDownload = async (anexo: Anexo) => {
    try {
      let url = anexo.url_publica;

      if (!url && anexo.storage_path) {
        const { data } = await supabase.storage
          .from("procedimentos")
          .getPublicUrl(anexo.storage_path);
        url = data.publicUrl;
      }

      if (!url) {
        toast.error("URL do arquivo não disponível");
        return;
      }

      // Criar link de download
      const link = document.createElement("a");
      link.href = url;
      link.download = anexo.nome_arquivo;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Download iniciado!");
    } catch (error) {
      console.error("Erro ao fazer download:", error);
      toast.error("Erro ao fazer download");
    }
  };

  // Compartilhar
  const handleShare = async () => {
    if (navigator.share && procedimento) {
      try {
        await navigator.share({
          title: procedimento.titulo,
          text: procedimento.descricao || "Procedimento",
          url: window.location.href,
        });
      } catch (error) {
        // Ignorar erro de cancelamento
      }
    } else {
      // Fallback: copiar link
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado!");
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  // Erro
  if (error || !procedimento) {
    return (
      <div className="p-4">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <p className="font-medium text-red-700 dark:text-red-400">
              Procedimento não encontrado
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/app/procedimentos")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = getCategoria(procedimento.categoria);
  const Icon = config.icon;
  const hasContent = procedimento.conteudo && procedimento.conteudo.trim().length > 0;
  const contentPreviewLength = 500;
  const isContentLong = hasContent && procedimento.conteudo!.length > contentPreviewLength;

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/30 pb-24">
      {/* Header com gradiente */}
      <div className={cn("bg-gradient-to-r p-6 pb-16 relative", config.gradient)}>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 rounded-full"
            onClick={() => navigate("/app/procedimentos")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 rounded-full"
            onClick={handleShare}
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-4 flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Icon className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <Badge className="bg-white/20 text-white border-white/30 mb-2">
              {config.label}
            </Badge>
            <h1 className="text-xl font-bold text-white leading-tight">
              {procedimento.titulo}
            </h1>
          </div>
        </div>
      </div>

      {/* Conteúdo sobreposto */}
      <div className="px-4 -mt-10 space-y-4">
        {/* Card de descrição */}
        {procedimento.descricao && (
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <p className="text-muted-foreground">{procedimento.descricao}</p>
            </CardContent>
          </Card>
        )}

        {/* Card de conteúdo */}
        {hasContent && (
          <Card className="shadow-lg overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Conteúdo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div
                className={cn(
                  "prose prose-sm dark:prose-invert max-w-none transition-all duration-300",
                  !showFullContent && isContentLong && "max-h-48 overflow-hidden relative"
                )}
              >
                <div
                  className="whitespace-pre-wrap text-sm text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: procedimento.conteudo!.replace(/\n/g, "<br />"),
                  }}
                />
                {!showFullContent && isContentLong && (
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
                )}
              </div>
              {isContentLong && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => setShowFullContent(!showFullContent)}
                >
                  {showFullContent ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Ver mais
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Link externo */}
        {procedimento.arquivo_url && (
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Link2 className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Link externo</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {procedimento.arquivo_url}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(procedimento.arquivo_url!, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Anexos */}
        {((anexos && anexos.length > 0) || isLoadingAnexos) && (
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Anexos
                  {anexos && (
                    <Badge variant="secondary" className="ml-2">
                      {anexos.length}
                    </Badge>
                  )}
                </CardTitle>
                
                {/* Indicador de Status Offline */}
                {offlineSupported && anexos && anexos.length > 0 && (
                  <div className="flex items-center gap-2">
                    {allFilesCached ? (
                      <Badge variant="outline" className="gap-1.5 text-green-600 border-green-500/30 bg-green-500/10">
                        <Check className="h-3 w-3" />
                        Disponível offline
                      </Badge>
                    ) : cachedFilesCount > 0 ? (
                      <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-500/30 bg-amber-500/10">
                        <CloudOff className="h-3 w-3" />
                        {cachedFilesCount}/{anexos.length} offline
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Sincronizando...
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoadingAnexos ? (
                <div className="space-y-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : (
                <div className="space-y-3">
                  {anexos?.map((anexo) => {
                    const isCached = isInCache(anexo.id);
                    
                    return (
                      <div
                        key={anexo.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl transition-colors",
                          isCached 
                            ? "bg-green-500/10 border border-green-500/20" 
                            : "bg-muted/50 hover:bg-muted"
                        )}
                      >
                        <div className="h-12 w-12 rounded-lg bg-background flex items-center justify-center border relative">
                          {getFileIcon(anexo.tipo_arquivo)}
                          {isCached && (
                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                              <CloudOff className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{anexo.nome}</p>
                            {isCached && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30">
                                Offline
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(anexo.tamanho_bytes)}
                            {anexo.descricao && ` • ${anexo.descricao}`}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9"
                            onClick={() => handleOpenFile(anexo)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9"
                            onClick={() => handleDownload(anexo)}
                            disabled={!isOnline && !isCached}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Meta informações */}
        <Card className="shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Atualizado em{" "}
                {format(
                  new Date(procedimento.updated_at || procedimento.created_at),
                  "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                  { locale: ptBR }
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal visualizador de PDF */}
      <Dialog open={!!pdfViewerUrl} onOpenChange={() => setPdfViewerUrl(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-red-500" />
              {pdfViewerTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full min-h-0">
            {pdfViewerUrl && (
              <iframe
                src={`${pdfViewerUrl}#toolbar=0&navpanes=0`}
                className="w-full h-[calc(90vh-60px)]"
                title={pdfViewerTitle}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

