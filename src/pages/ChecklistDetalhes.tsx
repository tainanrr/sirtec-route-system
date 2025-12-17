import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  ClipboardCheck,
  ArrowLeft,
  Calendar,
  User,
  FileText,
  CheckCircle,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ZoomIn,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Pergunta {
  id: string;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  ordem: number;
}

interface GrupoPerguntas {
  id: string;
  nome: string;
  ordem: number;
  perguntas: Pergunta[];
}

interface FotoData {
  url: string;
  latitude?: number;
  longitude?: number;
  dataHora?: string;
}

interface FotoViewer {
  open: boolean;
  fotos: FotoData[];
  currentIndex: number;
  titulo?: string;
}

export default function ChecklistDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [fotoViewer, setFotoViewer] = useState<FotoViewer>({
    open: false,
    fotos: [],
    currentIndex: 0,
  });

  // Buscar detalhes do checklist
  const { data: resposta, isLoading } = useQuery({
    queryKey: ["checklist-detalhes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_respostas")
        .select(`
          *,
          checklists (id, nome, tipo, grupos),
          ordens_servico (id, numero, tipo, endereco, cliente_nome),
          tecnicos:equipe_id (id, codigo, nome)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Abrir visualizador de fotos
  const abrirFotoViewer = (fotos: any[], index: number = 0, titulo?: string) => {
    if (!fotos || fotos.length === 0) {
      toast.error("Nenhuma foto disponível");
      return;
    }
    
    setFotoViewer({
      open: true,
      fotos: fotos.map((f: any) => ({
        url: f.url || f,
        latitude: f.latitude,
        longitude: f.longitude,
        dataHora: f.dataHora,
      })),
      currentIndex: index,
      titulo,
    });
  };

  // Renderizar coordenadas copiáveis
  const renderCoordenadasCopiavel = (lat?: number, lng?: number, dataHora?: string) => {
    if (!lat && !lng && !dataHora) return null;
    
    const coordsText = lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;
    
    const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success("Copiado!");
    };

    return (
      <div className="mt-1 space-y-0.5">
        {dataHora && (
          <p 
            className="text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-foreground"
            onClick={() => handleCopy(dataHora)}
            title="Clique para copiar"
          >
            📅 {dataHora}
          </p>
        )}
        {coordsText && (
          <p 
            className="text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-foreground"
            onClick={() => handleCopy(coordsText)}
            title="Clique para copiar"
          >
            📍 {coordsText}
          </p>
        )}
      </div>
    );
  };

  // Renderizar valor da resposta
  const renderValorResposta = (pergunta: Pergunta, respostaItem: any) => {
    if (!respostaItem) return <span className="text-muted-foreground">Não respondida</span>;

    const valor = respostaItem.resposta;
    const fotoUrl = respostaItem.foto_url;
    const fotos = respostaItem.fotos;
    const assinaturaUrl = respostaItem.assinatura_url;
    const observacao = respostaItem.observacao;
    const fotoLat = respostaItem.foto_latitude;
    const fotoLng = respostaItem.foto_longitude;
    const fotoDataHora = respostaItem.foto_data_hora;
    const assLat = respostaItem.assinatura_latitude;
    const assLng = respostaItem.assinatura_longitude;
    const assDataHora = respostaItem.assinatura_data_hora;

    return (
      <div className="space-y-2">
        {/* Valor principal */}
        {pergunta.tipo === "foto" ? (
          fotos && fotos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fotos.map((foto: any, index: number) => (
                <div key={index} className="relative group">
                  <img 
                    src={foto.url} 
                    alt={`Foto ${index + 1}`} 
                    className="w-24 h-20 object-cover rounded cursor-pointer hover:opacity-80 border transition-all" 
                    onClick={() => abrirFotoViewer(fotos, index, pergunta.texto)} 
                  />
                  <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">
                    {index + 1}
                  </span>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded flex items-center justify-center">
                    <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          ) : fotoUrl ? (
            <div className="relative group inline-block">
              <img 
                src={fotoUrl} 
                alt="Foto" 
                className="w-32 h-24 object-cover rounded cursor-pointer hover:opacity-80" 
                onClick={() => abrirFotoViewer([{ url: fotoUrl, latitude: fotoLat, longitude: fotoLng, dataHora: fotoDataHora }], 0, pergunta.texto)} 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-all" />
              </div>
              {renderCoordenadasCopiavel(fotoLat, fotoLng, fotoDataHora)}
            </div>
          ) : (
            <span className="text-muted-foreground">Sem foto</span>
          )
        ) : pergunta.tipo === "assinatura" ? (
          assinaturaUrl ? (
            <div className="relative group inline-block">
              <img 
                src={assinaturaUrl} 
                alt="Assinatura" 
                className="w-40 h-20 object-contain bg-white border rounded cursor-pointer" 
                onClick={() => abrirFotoViewer([{ url: assinaturaUrl, latitude: assLat, longitude: assLng, dataHora: assDataHora }], 0, "Assinatura")}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-4 w-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
              {renderCoordenadasCopiavel(assLat, assLng, assDataHora)}
            </div>
          ) : (
            <span className="text-muted-foreground">Sem assinatura</span>
          )
        ) : pergunta.tipo === "sim_nao" ? (
          valor === "sim" ? (
            <Badge variant="destructive">Sim (Risco identificado)</Badge>
          ) : valor === "nao" ? (
            <Badge className="bg-green-600">Não</Badge>
          ) : (
            <span className="text-muted-foreground">{String(valor)}</span>
          )
        ) : pergunta.tipo === "multipla_escolha" && Array.isArray(valor) ? (
          <div className="flex flex-wrap gap-1">
            {valor.map((v: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">{v}</Badge>
            ))}
          </div>
        ) : pergunta.tipo === "conforme_nao_conforme" ? (
          valor === "conforme" ? (
            <Badge className="bg-green-600">Conforme</Badge>
          ) : (
            <Badge variant="destructive">Não Conforme</Badge>
          )
        ) : (
          <span>{String(valor)}</span>
        )}

        {/* Foto adicional (para perguntas que exigem foto) */}
        {pergunta.tipo !== "foto" && (fotos && fotos.length > 0 ? (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">Fotos anexadas:</p>
            <div className="flex flex-wrap gap-2">
              {fotos.map((foto: any, index: number) => (
                <div key={index} className="relative group">
                  <img 
                    src={foto.url} 
                    alt={`Foto ${index + 1}`} 
                    className="w-20 h-16 object-cover rounded cursor-pointer hover:opacity-80 border" 
                    onClick={() => abrirFotoViewer(fotos, index, `${pergunta.texto} - Fotos`)} 
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded flex items-center justify-center">
                    <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : fotoUrl && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">Foto anexada:</p>
            <div className="relative group inline-block">
              <img 
                src={fotoUrl} 
                alt="Foto anexada" 
                className="w-24 h-18 object-cover rounded cursor-pointer hover:opacity-80" 
                onClick={() => abrirFotoViewer([{ url: fotoUrl, latitude: fotoLat, longitude: fotoLng, dataHora: fotoDataHora }], 0, `${pergunta.texto} - Foto`)} 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            </div>
            {renderCoordenadasCopiavel(fotoLat, fotoLng, fotoDataHora)}
          </div>
        ))}

        {/* Observação */}
        {observacao && (
          <div className="mt-2 p-2 bg-muted rounded text-sm">
            <p className="text-xs text-muted-foreground mb-1">Observação:</p>
            <p>{observacao}</p>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </MainLayout>
    );
  }

  if (!resposta) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6">
          <div className="text-center py-12">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Checklist não encontrado</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/consulta-checklists")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const respostasMap = Array.isArray(resposta.respostas)
    ? resposta.respostas.reduce((acc: any, r: any) => ({ ...acc, [r.pergunta_id]: r }), {})
    : resposta.respostas || {};

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => window.close()}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardCheck className="h-7 w-7 text-violet-600" />
                {resposta.checklists?.nome || "Checklist"}
              </h1>
              <p className="text-muted-foreground">
                {resposta.checklists?.tipo?.toUpperCase()} - Preenchido em {format(new Date(resposta.created_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>
          </div>
          <Badge className={resposta.status === "completo" ? "bg-green-600" : ""}>
            {resposta.status === "completo" ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Completo
              </>
            ) : (
              "Rascunho"
            )}
          </Badge>
        </div>

        {/* Informações Gerais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                Ordem de Serviço
              </div>
              <p className="font-semibold">
                {resposta.ordens_servico ? (
                  <>#{resposta.ordens_servico.numero}</>
                ) : (
                  "-"
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <User className="h-4 w-4" />
                Equipe
              </div>
              <p className="font-semibold">
                {resposta.tecnicos?.codigo || "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                Data
              </div>
              <p className="font-semibold">
                {format(new Date(resposta.created_at), "dd/MM/yyyy HH:mm")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" />
                Status
              </div>
              <Badge className={resposta.status === "completo" ? "bg-green-600" : ""}>
                {resposta.status === "completo" ? "Completo" : "Rascunho"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Endereço da OS */}
        {resposta.ordens_servico?.endereco && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                Endereço
              </div>
              <p>{resposta.ordens_servico.endereco}</p>
              {resposta.ordens_servico.cliente_nome && (
                <p className="text-sm text-muted-foreground mt-1">
                  Cliente: {resposta.ordens_servico.cliente_nome}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Respostas por Grupo */}
        {resposta.checklists?.grupos?.map((grupo: GrupoPerguntas) => (
          <Card key={grupo.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{grupo.nome}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {grupo.perguntas
                  ?.sort((a, b) => a.ordem - b.ordem)
                  .map((pergunta, index) => {
                    const respostaItem = respostasMap[pergunta.id];
                    return (
                      <div key={pergunta.id} className="border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex items-start gap-2 mb-2">
                          <Badge variant="outline" className="shrink-0">
                            {grupo.ordem}.{index + 1}
                          </Badge>
                          <p className="text-sm font-medium">
                            {pergunta.texto}
                            {pergunta.obrigatoria && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </p>
                        </div>
                        <div className="ml-10">
                          {renderValorResposta(pergunta, respostaItem)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Visualizador de Fotos */}
      <Dialog open={fotoViewer.open} onOpenChange={(open) => setFotoViewer(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl p-0 bg-black/95">
          <div className="relative min-h-[60vh] flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  {fotoViewer.titulo && (
                    <p className="font-medium text-sm">{fotoViewer.titulo}</p>
                  )}
                  <p className="text-xs opacity-70">
                    {fotoViewer.currentIndex + 1} de {fotoViewer.fotos.length}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {fotoViewer.fotos[fotoViewer.currentIndex]?.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20"
                      onClick={() => window.open(fotoViewer.fotos[fotoViewer.currentIndex].url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir em nova guia
                    </Button>
                  )}
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
            </div>

            {/* Imagem */}
            <div className="flex-1 flex items-center justify-center p-4 pt-16 pb-24">
              {fotoViewer.fotos[fotoViewer.currentIndex]?.url && (
                <img
                  src={fotoViewer.fotos[fotoViewer.currentIndex].url}
                  alt={`Foto ${fotoViewer.currentIndex + 1}`}
                  className="max-w-full max-h-[60vh] object-contain rounded"
                />
              )}
            </div>

            {/* Navegação */}
            {fotoViewer.fotos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => setFotoViewer(prev => ({
                    ...prev,
                    currentIndex: prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.fotos.length - 1
                  }))}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => setFotoViewer(prev => ({
                    ...prev,
                    currentIndex: prev.currentIndex < prev.fotos.length - 1 ? prev.currentIndex + 1 : 0
                  }))}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Footer com informações */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="text-white text-center space-y-1">
                {fotoViewer.fotos[fotoViewer.currentIndex]?.dataHora && (
                  <p className="text-sm">
                    📅 {fotoViewer.fotos[fotoViewer.currentIndex].dataHora}
                  </p>
                )}
                {fotoViewer.fotos[fotoViewer.currentIndex]?.latitude && fotoViewer.fotos[fotoViewer.currentIndex]?.longitude && (
                  <p 
                    className="text-xs font-mono cursor-pointer hover:underline"
                    onClick={() => {
                      const foto = fotoViewer.fotos[fotoViewer.currentIndex];
                      navigator.clipboard.writeText(`${foto.latitude?.toFixed(6)}, ${foto.longitude?.toFixed(6)}`);
                      toast.success("Coordenadas copiadas!");
                    }}
                  >
                    📍 {fotoViewer.fotos[fotoViewer.currentIndex].latitude?.toFixed(6)}, {fotoViewer.fotos[fotoViewer.currentIndex].longitude?.toFixed(6)}
                  </p>
                )}
              </div>

              {/* Miniaturas */}
              {fotoViewer.fotos.length > 1 && (
                <div className="flex justify-center gap-2 mt-3 overflow-x-auto pb-1">
                  {fotoViewer.fotos.map((foto, index) => (
                    <button
                      key={index}
                      className={`shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all ${
                        index === fotoViewer.currentIndex
                          ? "border-white ring-1 ring-white"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                      onClick={() => setFotoViewer(prev => ({ ...prev, currentIndex: index }))}
                    >
                      <img
                        src={foto.url}
                        alt={`Miniatura ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

