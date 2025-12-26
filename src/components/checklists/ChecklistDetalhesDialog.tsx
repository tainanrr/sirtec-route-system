import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  Calendar,
  User,
  FileText,
  CheckCircle,
  MapPin,
  Hash,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  X,
  Package,
  ExternalLink,
} from "lucide-react";

interface ChecklistDetalhesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId: string | null;
}

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
  data_hora?: string;
}

interface FotoViewer {
  open: boolean;
  fotos: FotoData[];
  currentIndex: number;
  titulo?: string;
}

export function ChecklistDetalhesDialog({
  open,
  onOpenChange,
  checklistId,
}: ChecklistDetalhesDialogProps) {
  const [fotoViewer, setFotoViewer] = useState<FotoViewer>({
    open: false,
    fotos: [],
    currentIndex: 0,
  });

  // Query 1: Dados básicos
  const { data: dadosBasicos, isLoading: loadingBasicos } = useQuery({
    queryKey: ["checklist-dialog-basico", checklistId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checklist_respostas")
        .select(`
          id,
          status,
          created_at,
          checklist_id,
          codigo_unico,
          checklists (id, nome, tipo, grupos, perguntas, descricao),
          ordens_servico (id, numero, tipo, endereco, cliente_nome),
          tecnicos:equipe_id (id, codigo, nome)
        `)
        .eq("id", checklistId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!checklistId && open,
  });

  // Query 2: Respostas
  const { data: respostasData, isLoading: loadingRespostas } = useQuery({
    queryKey: ["checklist-dialog-respostas", checklistId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checklist_respostas")
        .select("respostas")
        .eq("id", checklistId)
        .single();

      if (error) throw error;
      return data?.respostas;
    },
    enabled: !!checklistId && open,
  });

  // Preparar dados
  const respostasMap = respostasData 
    ? (Array.isArray(respostasData) 
        ? respostasData.reduce((acc: any, r: any) => ({ ...acc, [r.pergunta_id]: r }), {})
        : respostasData)
    : {};

  const dadosAny = dadosBasicos as any;
  const gruposOriginais = dadosAny?.checklists?.grupos as GrupoPerguntas[] | undefined;
  const perguntasOriginais = dadosAny?.checklists?.perguntas as Pergunta[] | undefined;
  
  const grupos: GrupoPerguntas[] | undefined = gruposOriginais && gruposOriginais.length > 0
    ? gruposOriginais
    : perguntasOriginais && perguntasOriginais.length > 0
      ? [{
          id: "grupo-unico",
          nome: dadosAny?.checklists?.nome || "Perguntas",
          ordem: 1,
          perguntas: perguntasOriginais.map((p: any, idx: number) => ({
            id: p.id || String(idx + 1),
            texto: p.texto,
            tipo: p.tipo,
            obrigatoria: p.obrigatorio || p.obrigatoria || false,
            ordem: p.ordem || idx + 1,
          })),
        }]
      : undefined;

  const codigoUnico = dadosAny?.codigo_unico;

  // Abrir visualizador de fotos
  const abrirFotoViewer = (fotos: any[], index: number = 0, titulo?: string) => {
    if (!fotos || fotos.length === 0) return;
    
    setFotoViewer({
      open: true,
      fotos: fotos.map((f: any) => ({
        url: f.url || f,
        latitude: f.latitude,
        longitude: f.longitude,
        dataHora: f.dataHora || f.data_hora,
      })),
      currentIndex: index,
      titulo,
    });
  };

  // Renderizar coordenadas
  const renderCoordenadasCopiavel = (lat?: number, lng?: number, dataHora?: string) => {
    if (!lat && !lng && !dataHora) return null;
    
    const coordsText = lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;

    return (
      <div className="mt-1 space-y-0.5">
        {dataHora && (
          <p className="text-[10px] text-muted-foreground font-mono">
            📅 {dataHora}
          </p>
        )}
        {coordsText && (
          <button
            type="button"
            className="text-[10px] text-blue-600 font-mono cursor-pointer hover:text-blue-800 hover:underline flex items-center gap-1"
            onClick={() => {
              const url = `https://www.google.com/maps?q=${lat},${lng}&z=18`;
              window.open(url, '_blank');
            }}
            title="Abrir no Google Maps"
          >
            📍 {coordsText}
          </button>
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
        {pergunta.tipo === "foto" ? (
          fotos && fotos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fotos.map((foto: any, index: number) => (
                <div key={index} className="flex flex-col">
                  <button
                    type="button"
                    className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
                    onClick={() => abrirFotoViewer(fotos, index, pergunta.texto)}
                  >
                    <img 
                      src={foto.url} 
                      alt={`Foto ${index + 1}`} 
                      className="w-24 h-20 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                      loading="lazy"
                    />
                    <span className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded font-medium">
                      {index + 1}
                    </span>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                      <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
                    </div>
                  </button>
                  {renderCoordenadasCopiavel(foto.latitude, foto.longitude, foto.data_hora || foto.dataHora)}
                </div>
              ))}
            </div>
          ) : fotoUrl ? (
            <button
              type="button"
              className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
              onClick={() => abrirFotoViewer([{ url: fotoUrl, latitude: fotoLat, longitude: fotoLng, dataHora: fotoDataHora }], 0, pergunta.texto)}
            >
              <img 
                src={fotoUrl} 
                alt="Foto" 
                className="w-32 h-24 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
              </div>
              {renderCoordenadasCopiavel(fotoLat, fotoLng, fotoDataHora)}
            </button>
          ) : (
            <span className="text-muted-foreground">Sem foto</span>
          )
        ) : pergunta.tipo === "assinatura" ? (
          assinaturaUrl ? (
            <div>
              <img 
                src={assinaturaUrl} 
                alt="Assinatura" 
                className="w-48 h-20 object-contain bg-white border-2 border-gray-200 rounded p-2" 
                loading="lazy"
              />
              {renderCoordenadasCopiavel(assLat, assLng, assDataHora)}
            </div>
          ) : (
            <span className="text-muted-foreground">Sem assinatura</span>
          )
        ) : pergunta.tipo === "sim_nao" ? (
          valor === "sim" ? (
            <Badge className="bg-green-600">Sim</Badge>
          ) : valor === "nao" ? (
            <Badge variant="secondary">Não</Badge>
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
          <span>{String(valor || '-')}</span>
        )}

        {/* Fotos anexadas em outros tipos de pergunta */}
        {pergunta.tipo !== "foto" && fotos && fotos.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">📷 Fotos anexadas:</p>
            <div className="flex flex-wrap gap-2">
              {fotos.map((foto: any, index: number) => (
                <button
                  key={index}
                  type="button"
                  className="relative group block focus:outline-none rounded"
                  onClick={() => abrirFotoViewer(fotos, index, `${pergunta.texto} - Fotos`)}
                >
                  <img 
                    src={foto.url} 
                    alt={`Foto ${index + 1}`} 
                    className="w-20 h-16 object-cover rounded border hover:border-violet-500 transition-all" 
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {observacao && (
          <div className="mt-2 p-2 bg-muted rounded text-sm">
            <p className="text-xs text-muted-foreground mb-1">Observação:</p>
            <p>{observacao}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-violet-600" />
              {dadosAny?.checklists?.nome || "Detalhes do Checklist"}
              {codigoUnico && (
                <Badge variant="outline" className="ml-2 bg-violet-100 text-violet-700 border-violet-300 font-mono">
                  <Hash className="h-3 w-3 mr-1" />
                  {codigoUnico}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loadingBasicos ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : dadosBasicos ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                {/* Informações Gerais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Hash className="h-4 w-4" />
                        Código
                      </div>
                      <p className="font-semibold text-violet-700 font-mono">
                        #{codigoUnico || "-"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <FileText className="h-4 w-4" />
                        OS
                      </div>
                      <p className="font-semibold">
                        {dadosAny.ordens_servico?.numero ? `#${dadosAny.ordens_servico.numero}` : "-"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <User className="h-4 w-4" />
                        Equipe
                      </div>
                      <p className="font-semibold">{dadosAny.tecnicos?.codigo || "-"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        Data
                      </div>
                      <p className="font-semibold text-sm">
                        {format(new Date(dadosAny.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Status e Tipo */}
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="uppercase">
                    {dadosAny.checklists?.tipo}
                  </Badge>
                  <Badge className={dadosAny.status === "completo" ? "bg-green-600" : ""}>
                    {dadosAny.status === "completo" ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completo
                      </>
                    ) : (
                      "Rascunho"
                    )}
                  </Badge>
                </div>

                {/* Descrição do Checklist */}
                {dadosAny.checklists?.descricao && (
                  <p className="text-sm text-muted-foreground">{dadosAny.checklists.descricao}</p>
                )}

                {/* Endereço da OS */}
                {dadosAny.ordens_servico?.endereco && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <MapPin className="h-4 w-4" />
                        Endereço
                      </div>
                      <p className="text-sm">{dadosAny.ordens_servico.endereco}</p>
                      {dadosAny.ordens_servico.cliente_nome && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Cliente: {dadosAny.ordens_servico.cliente_nome}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Separator />

                {/* Respostas por Grupo */}
                {loadingRespostas ? (
                  <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : grupos && grupos.length > 0 ? (
                  grupos.map((grupo: GrupoPerguntas) => (
                    <Card key={grupo.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{grupo.nome}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {grupo.perguntas
                            ?.sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                            .map((pergunta, index) => {
                              const respostaItem = respostasMap[pergunta.id];
                              return (
                                <div key={pergunta.id} className="border-b pb-4 last:border-0 last:pb-0">
                                  <div className="flex items-start gap-2 mb-2">
                                    <Badge variant="outline" className="shrink-0">
                                      {grupo.ordem || 1}.{index + 1}
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
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground">
                        Nenhuma pergunta encontrada neste checklist
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Checklist não encontrado</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Visualizador de Fotos */}
      <Dialog open={fotoViewer.open} onOpenChange={(open) => setFotoViewer(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 max-h-[95vh] overflow-hidden">
          <div className="flex flex-col h-full">
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

            <div className="relative flex-1 flex items-center justify-center p-4 min-h-[300px]">
              {fotoViewer.fotos[fotoViewer.currentIndex]?.url && (
                <img
                  src={fotoViewer.fotos[fotoViewer.currentIndex].url}
                  alt={`Foto ${fotoViewer.currentIndex + 1}`}
                  className="max-w-full max-h-[50vh] object-contain rounded"
                />
              )}

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

            <div className="border-t border-white/10 p-4 bg-black/50">
              <div className="text-white text-center space-y-2">
                {fotoViewer.fotos[fotoViewer.currentIndex]?.dataHora && (
                  <p className="text-sm">
                    📅 {fotoViewer.fotos[fotoViewer.currentIndex].dataHora}
                  </p>
                )}

                {fotoViewer.fotos[fotoViewer.currentIndex]?.latitude && fotoViewer.fotos[fotoViewer.currentIndex]?.longitude && (
                  <button
                    type="button"
                    className="text-sm font-mono cursor-pointer hover:underline text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto"
                    onClick={() => {
                      const foto = fotoViewer.fotos[fotoViewer.currentIndex];
                      const url = `https://www.google.com/maps?q=${foto.latitude},${foto.longitude}&z=18`;
                      window.open(url, '_blank');
                    }}
                  >
                    📍 {fotoViewer.fotos[fotoViewer.currentIndex].latitude?.toFixed(6)}, {fotoViewer.fotos[fotoViewer.currentIndex].longitude?.toFixed(6)}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}

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
    </>
  );
}

