import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Download,
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

  // Query 1: Dados básicos (RÁPIDA) - carrega primeiro para mostrar o header
  const { data: dadosBasicos, isLoading: loadingBasicos } = useQuery({
    queryKey: ["checklist-basico", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_respostas")
        .select(`
          id,
          status,
          created_at,
          checklist_id,
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

  // Query 2: Só as respostas (o mais pesado)
  const { data: respostasData, isLoading: loadingRespostas } = useQuery({
    queryKey: ["checklist-respostas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_respostas")
        .select("respostas")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data?.respostas;
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

  // Renderizar coordenadas clicáveis (abre no Google Maps)
  const renderCoordenadasCopiavel = (lat?: number, lng?: number, dataHora?: string) => {
    if (!lat && !lng && !dataHora) return null;
    
    const coordsText = lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;
    
    const handleCopy = (e: React.MouseEvent, text: string) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(text);
      toast.success("Copiado!");
    };

    const abrirNoMaps = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (lat && lng) {
        // Abre o Google Maps com o ponto marcado
        const url = `https://www.google.com/maps?q=${lat},${lng}&z=18`;
        window.open(url, '_blank');
      }
    };

    return (
      <div className="mt-1 space-y-0.5" onClick={(e) => e.stopPropagation()}>
        {dataHora && (
          <p 
            className="text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-foreground"
            onClick={(e) => handleCopy(e, dataHora)}
            title="Clique para copiar"
          >
            📅 {dataHora}
          </p>
        )}
        {coordsText && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-[10px] text-blue-600 font-mono cursor-pointer hover:text-blue-800 hover:underline flex items-center gap-1"
              onClick={abrirNoMaps}
              title="Abrir no Google Maps"
            >
              📍 {coordsText}
            </button>
            <button
              type="button"
              className="text-[9px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted"
              onClick={(e) => handleCopy(e, coordsText)}
              title="Copiar coordenadas"
            >
              📋
            </button>
          </div>
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

    // Handler para abrir foto
    const handleFotoClick = (e: React.MouseEvent, fotosArray: any[], index: number, titulo: string) => {
      e.preventDefault();
      e.stopPropagation();
      abrirFotoViewer(fotosArray, index, titulo);
    };

    return (
      <div className="space-y-2">
        {/* Valor principal */}
        {pergunta.tipo === "foto" ? (
          fotos && fotos.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {fotos.map((foto: any, index: number) => (
                <button
                  key={index}
                  type="button"
                  className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
                  onClick={(e) => handleFotoClick(e, fotos, index, pergunta.texto)}
                >
                  <img 
                    src={foto.url} 
                    alt={`Foto ${index + 1}`} 
                    className="w-32 h-28 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                    loading="lazy"
                  />
                  <span className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                    {index + 1}
                  </span>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
                  </div>
                </button>
              ))}
            </div>
          ) : fotoUrl ? (
            <button
              type="button"
              className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
              onClick={(e) => handleFotoClick(e, [{ url: fotoUrl, latitude: fotoLat, longitude: fotoLng, dataHora: fotoDataHora }], 0, pergunta.texto)}
            >
              <img 
                src={fotoUrl} 
                alt="Foto" 
                className="w-40 h-32 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
              </div>
              {renderCoordenadasCopiavel(fotoLat, fotoLng, fotoDataHora)}
            </button>
          ) : (
            <span className="text-muted-foreground">Sem foto</span>
          )
        ) : pergunta.tipo === "assinatura" ? (
          assinaturaUrl ? (
            <button
              type="button"
              className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
              onClick={(e) => handleFotoClick(e, [{ url: assinaturaUrl, latitude: assLat, longitude: assLng, dataHora: assDataHora }], 0, "Assinatura")}
            >
              <img 
                src={assinaturaUrl} 
                alt="Assinatura" 
                className="w-56 h-28 object-contain bg-white border-2 border-gray-200 hover:border-violet-500 rounded transition-all shadow-sm hover:shadow-md p-2" 
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-5 w-5 text-gray-600 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
              {renderCoordenadasCopiavel(assLat, assLng, assDataHora)}
            </button>
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
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">📷 Fotos anexadas:</p>
            <div className="flex flex-wrap gap-3">
              {fotos.map((foto: any, index: number) => (
                <button
                  key={index}
                  type="button"
                  className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
                  onClick={(e) => handleFotoClick(e, fotos, index, `${pergunta.texto} - Fotos`)}
                >
                  <img 
                    src={foto.url} 
                    alt={`Foto ${index + 1}`} 
                    className="w-28 h-24 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                    <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : fotoUrl && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">📷 Foto anexada:</p>
            <button
              type="button"
              className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
              onClick={(e) => handleFotoClick(e, [{ url: fotoUrl, latitude: fotoLat, longitude: fotoLng, dataHora: fotoDataHora }], 0, `${pergunta.texto} - Foto`)}
            >
              <img 
                src={fotoUrl} 
                alt="Foto anexada" 
                className="w-32 h-28 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
              </div>
            </button>
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

  // Loading inicial - só mostra skeleton se os dados básicos estão carregando
  if (loadingBasicos) {
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
        </div>
      </MainLayout>
    );
  }

  if (!dadosBasicos) {
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

  // Preparar mapa de respostas
  const respostasMap = respostasData 
    ? (Array.isArray(respostasData) 
        ? respostasData.reduce((acc: any, r: any) => ({ ...acc, [r.pergunta_id]: r }), {})
        : respostasData)
    : {};

  const grupos = dadosBasicos?.checklists?.grupos as GrupoPerguntas[] | undefined;

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header - Carrega imediatamente */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                if (window.history.length <= 1) {
                  window.close();
                } else {
                  navigate("/consulta-checklists");
                }
              }}
              title="Fechar / Voltar"
            >
              <X className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardCheck className="h-7 w-7 text-violet-600" />
                {dadosBasicos.checklists?.nome || "Checklist"}
              </h1>
              <p className="text-muted-foreground">
                {dadosBasicos.checklists?.tipo?.toUpperCase()} - Preenchido em {format(new Date(dadosBasicos.created_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>
          </div>
          <Badge className={dadosBasicos.status === "completo" ? "bg-green-600" : ""}>
            {dadosBasicos.status === "completo" ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Completo
              </>
            ) : (
              "Rascunho"
            )}
          </Badge>
        </div>

        {/* Informações Gerais - Carrega imediatamente */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                Ordem de Serviço
              </div>
              <p className="font-semibold">
                {dadosBasicos.ordens_servico ? (
                  <>#{dadosBasicos.ordens_servico.numero}</>
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
                {dadosBasicos.tecnicos?.codigo || "-"}
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
                {format(new Date(dadosBasicos.created_at), "dd/MM/yyyy HH:mm")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" />
                Status
              </div>
              <Badge className={dadosBasicos.status === "completo" ? "bg-green-600" : ""}>
                {dadosBasicos.status === "completo" ? "Completo" : "Rascunho"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Endereço da OS */}
        {dadosBasicos.ordens_servico?.endereco && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                Endereço
              </div>
              <p>{dadosBasicos.ordens_servico.endereco}</p>
              {dadosBasicos.ordens_servico.cliente_nome && (
                <p className="text-sm text-muted-foreground mt-1">
                  Cliente: {dadosBasicos.ordens_servico.cliente_nome}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Respostas por Grupo - Carrega depois */}
        {loadingRespostas ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                <p className="text-muted-foreground">Carregando respostas...</p>
              </div>
            </CardContent>
          </Card>
        ) : grupos && grupos.length > 0 ? (
          grupos.map((grupo: GrupoPerguntas) => (
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
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                Nenhuma pergunta encontrada neste checklist
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Visualizador de Fotos */}
      <Dialog open={fotoViewer.open} onOpenChange={(open) => setFotoViewer(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 max-h-[95vh] overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header - fixo no topo */}
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="text-white">
                {fotoViewer.titulo && (
                  <p className="font-medium text-sm">{fotoViewer.titulo}</p>
                )}
                <p className="text-xs opacity-70">
                  {fotoViewer.currentIndex + 1} de {fotoViewer.fotos.length}
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

            {/* Área da imagem com navegação */}
            <div className="relative flex-1 flex items-center justify-center p-4 min-h-[300px]">
              {fotoViewer.fotos[fotoViewer.currentIndex]?.url && (
                <img
                  src={fotoViewer.fotos[fotoViewer.currentIndex].url}
                  alt={`Foto ${fotoViewer.currentIndex + 1}`}
                  className="max-w-full max-h-[50vh] object-contain rounded"
                />
              )}

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
            </div>

            {/* Footer com informações - fixo na parte inferior */}
            <div className="border-t border-white/10 p-4 bg-black/50">
              <div className="text-white text-center space-y-3">
                {/* Data e hora */}
                {fotoViewer.fotos[fotoViewer.currentIndex]?.dataHora && (
                  <p className="text-sm">
                    📅 {fotoViewer.fotos[fotoViewer.currentIndex].dataHora}
                  </p>
                )}

                {/* Coordenadas */}
                {fotoViewer.fotos[fotoViewer.currentIndex]?.latitude && fotoViewer.fotos[fotoViewer.currentIndex]?.longitude && (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      className="text-sm font-mono cursor-pointer hover:underline text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      onClick={() => {
                        const foto = fotoViewer.fotos[fotoViewer.currentIndex];
                        const url = `https://www.google.com/maps?q=${foto.latitude},${foto.longitude}&z=18`;
                        window.open(url, '_blank');
                      }}
                      title="Abrir no Google Maps"
                    >
                      📍 {fotoViewer.fotos[fotoViewer.currentIndex].latitude?.toFixed(6)}, {fotoViewer.fotos[fotoViewer.currentIndex].longitude?.toFixed(6)}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/20"
                      onClick={() => {
                        const foto = fotoViewer.fotos[fotoViewer.currentIndex];
                        navigator.clipboard.writeText(`${foto.latitude?.toFixed(6)}, ${foto.longitude?.toFixed(6)}`);
                        toast.success("Coordenadas copiadas!");
                      }}
                      title="Copiar coordenadas"
                    >
                      📋 Copiar
                    </button>
                  </div>
                )}

                {/* Botões de ação */}
                {fotoViewer.fotos[fotoViewer.currentIndex]?.url && (
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white border-0"
                      onClick={() => {
                        const url = fotoViewer.fotos[fotoViewer.currentIndex]?.url;
                        if (url) {
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `foto_${fotoViewer.currentIndex + 1}_${Date.now()}.jpg`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          toast.success("Download iniciado!");
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar imagem
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white border-0"
                      onClick={() => {
                        const url = fotoViewer.fotos[fotoViewer.currentIndex]?.url;
                        if (url) {
                          const newWindow = window.open('', '_blank');
                          if (newWindow) {
                            newWindow.document.write(`
                              <!DOCTYPE html>
                              <html>
                                <head>
                                  <title>Imagem - Checklist</title>
                                  <style>
                                    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a1a; }
                                    img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                                  </style>
                                </head>
                                <body>
                                  <img src="${url}" alt="Imagem do checklist" />
                                </body>
                              </html>
                            `);
                            newWindow.document.close();
                          }
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir em nova guia
                    </Button>
                  </div>
                )}

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
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
