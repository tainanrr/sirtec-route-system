import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft,
  ClipboardCheck,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Camera,
  FileSignature,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  descricao?: string;
  ordem: number;
  perguntas: Pergunta[];
}

interface Resposta {
  pergunta_id: string;
  resposta: any;
  foto_url?: string;
  fotos?: { url: string }[];
  assinatura_url?: string;
  nao_aplica?: boolean;
}

interface ChecklistResposta {
  id: string;
  checklist_id: string;
  respostas: Resposta[];
  status: string;
  created_at: string;
  grupo_retorno?: string;
  checklists: {
    id: string;
    nome: string;
    descricao?: string;
    tipo?: string;
    grupos?: GrupoPerguntas[];
    perguntas?: Pergunta[];
  };
}

export default function AppChecklistServico() {
  const { id: ordemId } = useParams();
  const navigate = useNavigate();
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());

  // Buscar checklists de serviço preenchidos para esta OS
  const { data: checklistsServico, isLoading } = useQuery({
    queryKey: ["checklists-servico", ordemId],
    queryFn: async () => {
      console.log("[ChecklistServico] Buscando checklists para OS:", ordemId);
      
      const { data, error } = await supabase
        .from("checklist_respostas")
        .select(`
          id,
          checklist_id,
          respostas,
          status,
          created_at,
          grupo_retorno,
          checklists:checklist_id (id, nome, descricao, tipo, grupos, perguntas)
        `)
        .eq("ordem_servico_id", ordemId);

      if (error) {
        console.error("[ChecklistServico] Erro ao buscar:", error);
        throw error;
      }
      
      console.log("[ChecklistServico] Respostas encontradas:", data?.length);
      
      // Filtrar apenas checklists do tipo serviço (não APR)
      const checklistsServicoFiltrados = (data || []).filter((c: any) => {
        const temChecklist = c.checklists?.id;
        const tipoServico = c.checklists?.tipo === 'servico';
        const temGrupoRetorno = !!c.grupo_retorno;
        
        // É checklist de serviço se: tipo é 'servico' OU tem grupo_retorno preenchido
        return temChecklist && (tipoServico || temGrupoRetorno);
      }) as ChecklistResposta[];
      
      console.log("[ChecklistServico] Checklists de serviço:", checklistsServicoFiltrados.length);
      
      return checklistsServicoFiltrados;
    },
    enabled: !!ordemId,
  });

  // Expandir todos os grupos quando carregar
  useEffect(() => {
    if (checklistsServico && checklistsServico.length > 0) {
      const todosGrupos = new Set<string>();
      checklistsServico.forEach(checklist => {
        const grupos = checklist.checklists?.grupos;
        if (grupos) {
          grupos.forEach(g => todosGrupos.add(`${checklist.id}-${g.id}`));
        }
      });
      setGruposExpandidos(todosGrupos);
    }
  }, [checklistsServico]);

  const toggleGrupo = (checklistId: string, grupoId: string) => {
    const key = `${checklistId}-${grupoId}`;
    setGruposExpandidos(prev => {
      const novo = new Set(prev);
      if (novo.has(key)) {
        novo.delete(key);
      } else {
        novo.add(key);
      }
      return novo;
    });
  };

  const getRespostaFormatada = (pergunta: Pergunta, resposta?: Resposta) => {
    if (!resposta) return <span className="text-muted-foreground italic">Não respondida</span>;
    
    if (resposta.nao_aplica) {
      return <Badge variant="secondary">Não se aplica</Badge>;
    }

    const valor = resposta.resposta;

    switch (pergunta.tipo) {
      case "sim_nao":
        if (valor === "sim" || valor === true) {
          return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" /> Sim</Badge>;
        } else if (valor === "nao" || valor === false) {
          return <Badge className="bg-red-500"><X className="h-3 w-3 mr-1" /> Não</Badge>;
        }
        return <span className="text-muted-foreground italic">-</span>;

      case "multipla_escolha":
        if (Array.isArray(valor) && valor.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {valor.map((v: string, i: number) => (
                <Badge key={i} variant="outline">{v}</Badge>
              ))}
            </div>
          );
        }
        return <span className="text-muted-foreground italic">-</span>;

      case "foto":
        const fotos = resposta.fotos || (resposta.foto_url ? [{ url: resposta.foto_url }] : []);
        if (fotos.length > 0) {
          return (
            <div className="flex gap-2 flex-wrap">
              {fotos.map((foto, i) => (
                <button
                  key={i}
                  onClick={() => window.open(foto.url, "_blank")}
                  className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-green-400 transition-colors"
                >
                  <img src={foto.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Camera className="h-4 w-4" />
            <span className="text-sm italic">Nenhuma foto</span>
          </div>
        );

      case "assinatura":
        if (resposta.assinatura_url) {
          return (
            <button
              onClick={() => window.open(resposta.assinatura_url, "_blank")}
              className="w-32 h-20 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-green-400 transition-colors bg-white"
            >
              <img src={resposta.assinatura_url} alt="Assinatura" className="w-full h-full object-contain" />
            </button>
          );
        }
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileSignature className="h-4 w-4" />
            <span className="text-sm italic">Sem assinatura</span>
          </div>
        );

      default:
        if (valor !== null && valor !== undefined && valor !== "") {
          return <span className="text-sm">{String(valor)}</span>;
        }
        return <span className="text-muted-foreground italic">-</span>;
    }
  };

  const renderPergunta = (pergunta: Pergunta, resposta?: Resposta, index?: number) => {
    return (
      <div key={pergunta.id} className="p-3 rounded-lg bg-muted/30 border">
        <div className="flex items-start gap-3 mb-2">
          {index !== undefined && (
            <Badge variant="outline" className="shrink-0 mt-0.5">{index + 1}</Badge>
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {pergunta.texto}
              {pergunta.obrigatoria && <span className="text-destructive ml-1">*</span>}
            </p>
          </div>
        </div>
        <div className="ml-9">
          {getRespostaFormatada(pergunta, resposta)}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-green-600 to-green-700 text-white">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              <span className="font-semibold">Checklist de Serviço</span>
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!checklistsServico || checklistsServico.length === 0) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-green-600 to-green-700 text-white">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              <span className="font-semibold">Checklist de Serviço</span>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <ClipboardCheck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum checklist preenchido</p>
            <p className="text-sm text-muted-foreground mt-1">
              Esta OS não possui checklists de serviço preenchidos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-green-600 to-green-700 text-white shrink-0">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            <span className="font-semibold">Checklist de Serviço</span>
          </div>
          <p className="text-xs text-green-100">
            {checklistsServico.length} checklist(s) preenchido(s)
          </p>
        </div>
        <Badge variant="secondary" className="bg-white/20 text-white">
          <Lock className="h-3 w-3 mr-1" />
          Somente Leitura
        </Badge>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {checklistsServico.map((checklistResposta) => {
            const checklist = checklistResposta.checklists;
            const respostasMap = new Map<string, Resposta>();
            
            // Parsear respostas (pode vir como objeto ou array)
            const respostasData = typeof checklistResposta.respostas === "string"
              ? JSON.parse(checklistResposta.respostas)
              : checklistResposta.respostas;
            
            if (Array.isArray(respostasData)) {
              // Array de respostas
              respostasData.forEach((r: Resposta) => {
                respostasMap.set(r.pergunta_id, r);
              });
            } else if (respostasData && typeof respostasData === "object") {
              // Objeto com pergunta_id como chave
              Object.entries(respostasData).forEach(([key, r]: [string, any]) => {
                respostasMap.set(key, r as Resposta);
              });
            }

            // Parsear grupos/perguntas
            const grupos = typeof checklist.grupos === "string"
              ? JSON.parse(checklist.grupos)
              : checklist.grupos;
            const perguntas = typeof checklist.perguntas === "string"
              ? JSON.parse(checklist.perguntas)
              : checklist.perguntas;

            return (
              <Card key={checklistResposta.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-green-600" />
                      {checklist.nome}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {checklistResposta.grupo_retorno && (
                        <Badge variant="outline" className="capitalize">
                          {checklistResposta.grupo_retorno}
                        </Badge>
                      )}
                      <Badge className="bg-green-500">
                        <Check className="h-3 w-3 mr-1" />
                        Concluído
                      </Badge>
                    </div>
                  </div>
                  {checklist.descricao && (
                    <p className="text-xs text-muted-foreground">{checklist.descricao}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Preenchido em {format(new Date(checklistResposta.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {grupos && grupos.length > 0 ? (
                    // Renderizar com grupos
                    grupos
                      .sort((a: GrupoPerguntas, b: GrupoPerguntas) => a.ordem - b.ordem)
                      .map((grupo: GrupoPerguntas) => {
                        const grupoKey = `${checklistResposta.id}-${grupo.id}`;
                        const isExpanded = gruposExpandidos.has(grupoKey);
                        const perguntasGrupo = grupo.perguntas || [];

                        return (
                          <Collapsible
                            key={grupo.id}
                            open={isExpanded}
                            onOpenChange={() => toggleGrupo(checklistResposta.id, grupo.id)}
                          >
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <span className="font-medium text-sm">{grupo.nome}</span>
                                </div>
                                <Badge variant="secondary">{perguntasGrupo.length} perguntas</Badge>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-2 mt-2">
                              {perguntasGrupo
                                .sort((a: Pergunta, b: Pergunta) => a.ordem - b.ordem)
                                .map((pergunta: Pergunta, pIndex: number) => 
                                  renderPergunta(pergunta, respostasMap.get(pergunta.id), pIndex)
                                )}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })
                  ) : perguntas && perguntas.length > 0 ? (
                    // Renderizar sem grupos
                    <div className="space-y-2">
                      {perguntas
                        .sort((a: Pergunta, b: Pergunta) => a.ordem - b.ordem)
                        .map((pergunta: Pergunta, index: number) =>
                          renderPergunta(pergunta, respostasMap.get(pergunta.id), index)
                        )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma pergunta encontrada
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
