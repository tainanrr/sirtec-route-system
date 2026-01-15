import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { obterNomesTerritorios } from "@/types/territorios";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  MapPin,
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  History,
  Truck,
  Play,
  Pause,
  Flag,
  Camera,
  DollarSign,
  Timer,
  Package,
  TrendingUp,
  Smartphone,
  Building2,
  Sparkles,
  Loader2,
  Phone,
  MessageCircle,
} from "lucide-react";
import { StreetViewImage } from "@/components/ui/street-view-image";
import { Button } from "@/components/ui/button";
import { extrairContatosComIA, gerarLinkTelefone, gerarLinkWhatsApp, type ContatoIA } from "@/lib/contatoExtractorIA";

interface OrdemServicoDetalhesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemId: string | null;
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

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  em_aberto: { label: "Em Aberto", color: "bg-gray-500", icon: Clock },
  planejada: { label: "Planejada", color: "bg-blue-500", icon: Calendar },
  em_deslocamento: { label: "Em Deslocamento", color: "bg-amber-500", icon: Truck },
  no_local: { label: "No Local", color: "bg-purple-500", icon: MapPin },
  em_execucao: { label: "Em Execução", color: "bg-orange-500", icon: Play },
  pausada: { label: "Pausada", color: "bg-yellow-500", icon: Pause },
  concluida: { label: "Concluída", color: "bg-green-500", icon: CheckCircle },
  cancelada: { label: "Cancelada", color: "bg-red-500", icon: XCircle },
};

export function OrdemServicoDetalhesDialog({
  open,
  onOpenChange,
  ordemId,
}: OrdemServicoDetalhesDialogProps) {
  // Buscar skills para mapear código -> nome
  const { data: skillsData } = useQuery({
    queryKey: ["skills-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("codigo, nome")
        .eq("ativo", true);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  // Criar mapa de códigos para nomes
  const skillsMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (skillsData) {
      skillsData.forEach((skill: any) => {
        if (skill.codigo) {
          map[skill.codigo.toLowerCase()] = skill.nome;
          map[skill.codigo.toUpperCase()] = skill.nome;
          // Normalizar sem acentos
          const normalizado = skill.codigo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          map[normalizado] = skill.nome;
        }
      });
    }
    return map;
  }, [skillsData]);

  // Estados para extração de contatos com IA
  const [contatosExtraidos, setContatosExtraidos] = useState<ContatoIA[]>([]);
  const [extraindoContatos, setExtraindoContatos] = useState(false);
  const queryClient = useQueryClient();

  // Buscar detalhes da OS
  const { data: ordem, isLoading: loadingOrdem } = useQuery({
    queryKey: ["ordem-detalhes", ordemId],
    queryFn: async () => {
      if (!ordemId) return null;

      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          tecnicos:tecnico_id (id, codigo, nome),
          equipe_planejada:equipe_planejada_id (id, codigo, nome),
          contratos:contrato_id (id, codigo, nome),
          centros_custo:centro_custo_id (id, codigo, nome)
        `)
        .eq("id", ordemId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && open,
  });

  // Buscar checklists preenchidos para esta OS
  const { data: checklists, isLoading: loadingChecklists } = useQuery({
    queryKey: ["ordem-checklists", ordemId],
    queryFn: async () => {
      if (!ordemId) return [];

      const { data, error } = await supabase
        .from("checklist_respostas")
        .select(`
          *,
          checklists (id, nome, tipo, grupos)
        `)
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && open,
  });

  // Buscar logs/histórico da OS
  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["ordem-logs", ordemId],
    queryFn: async () => {
      if (!ordemId) return [];

      const { data, error } = await supabase
        .from("planejamento_logs")
        .select("*")
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && open,
  });

  // Buscar planejamento da OS
  const { data: planejamento } = useQuery({
    queryKey: ["ordem-planejamento", ordemId],
    queryFn: async () => {
      if (!ordemId) return null;

      const { data, error } = await supabase
        .from("planejamento_ordens")
        .select(`
          *,
          planejamentos (id, data_planejamento, status),
          tecnicos:equipe_id (id, codigo, nome, color)
        `)
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && open,
  });

  // Buscar retorno de campo da OS
  const { data: retornoCampo } = useQuery({
    queryKey: ["ordem-retorno-campo", ordemId],
    queryFn: async () => {
      if (!ordemId) return null;

      // Buscar retorno vinculado à OS
      const { data: ordem } = await supabase
        .from("ordens_servico")
        .select("retorno_campo_id")
        .eq("id", ordemId)
        .single();

      if (!ordem?.retorno_campo_id) return null;

      const { data, error } = await supabase
        .from("retornos_campo")
        .select("*")
        .eq("id", ordem.retorno_campo_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId && open,
  });

  // Buscar produção da OS
  const { data: producao, isLoading: loadingProducao } = useQuery({
    queryKey: ["ordem-producao", ordemId],
    queryFn: async () => {
      if (!ordemId) return null;

      const { data, error } = await supabase
        .from("producao_equipes")
        .select(`
          *,
          retornos_campo (id, codigo, descricao, tipo, cor, gera_producao),
          producao_atividades (
            id,
            quantidade,
            valor_total,
            atividades (id, codigo, descricao, valor_unitario, unidade)
          )
        `)
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar produção:", error);
        return null;
      }
      return data;
    },
    enabled: !!ordemId && open,
  });

  // Buscar materiais da OS
  const { data: materiais, isLoading: loadingMateriais } = useQuery({
    queryKey: ["ordem-materiais", ordemId],
    queryFn: async () => {
      if (!ordemId) return { aplicados: [], retirados: [] };

      // Buscar materiais aplicados/retirados (mesma tabela, diferenciados por tipo)
      const { data, error } = await supabase
        .from("materiais_aplicados_os")
        .select(`
          *,
          materiais:material_id (id, codigo, nome, unidade)
        `)
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar materiais:", error);
        return { aplicados: [], retirados: [] };
      }

      // Separar por tipo
      const aplicados = (data || []).filter((m: any) => m.tipo === "aplicado");
      const retirados = (data || []).filter((m: any) => m.tipo === "retirado");

      return { aplicados, retirados };
    },
    enabled: !!ordemId && open,
  });

  // Buscar anexos/fotos da OS
  const { data: anexos, isLoading: loadingAnexos } = useQuery({
    queryKey: ["ordem-anexos-detalhes", ordemId],
    queryFn: async () => {
      if (!ordemId) return [];

      const { data, error } = await supabase
        .from("ordem_anexos")
        .select("*")
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar anexos:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!ordemId && open,
  });

  // Buscar nomes dos territórios da OS
  const { data: territoriosNomes } = useQuery({
    queryKey: ["ordem-territorios-nomes", ordemId, (ordem as any)?.territorios],
    queryFn: async () => {
      const territorioIds = (ordem as any)?.territorios;
      if (!territorioIds || territorioIds.length === 0) return [];
      return await obterNomesTerritorios(territorioIds);
    },
    enabled: !!ordemId && open && !!(ordem as any)?.territorios?.length,
  });

  // Função para extrair contatos com IA
  const handleExtrairContatos = async () => {
    if (!ordem?.observacoes) {
      toast.error("Esta OS não possui observações para analisar");
      return;
    }

    setExtraindoContatos(true);
    
    try {
      const resultado = await extrairContatosComIA(ordem.observacoes);
      
      if (resultado.sucesso) {
        if (resultado.contatos.length > 0) {
          setContatosExtraidos(resultado.contatos);
          
          // Salvar no banco para uso futuro (offline no app)
          const { error } = await supabase
            .from("ordens_servico")
            .update({ contatos_extraidos: resultado.contatos })
            .eq("id", ordemId);
          
          if (error) {
            console.error("Erro ao salvar contatos:", error);
            toast.warning(`${resultado.contatos.length} contato(s) identificado(s) (não salvos no banco)`);
          } else {
            toast.success(`${resultado.contatos.length} contato(s) identificado(s) e salvos!`);
            // Invalidar query para atualizar dados
            queryClient.invalidateQueries({ queryKey: ["ordem-detalhes", ordemId] });
          }
        } else {
          toast.info("Nenhum contato identificado nas observações");
        }
      } else {
        toast.error(resultado.erro || "Erro ao processar observações");
      }
    } catch (error: any) {
      console.error("Erro ao extrair contatos:", error);
      toast.error("Erro ao identificar contatos");
    } finally {
      setExtraindoContatos(false);
    }
  };

  // Determinar contatos a exibir: do banco ou extraídos manualmente
  const contatosParaExibir = useMemo(() => {
    const contatosDoBanco = (ordem as any)?.contatos_extraidos;
    if (contatosDoBanco && Array.isArray(contatosDoBanco) && contatosDoBanco.length > 0) {
      return contatosDoBanco;
    }
    return contatosExtraidos;
  }, [ordem, contatosExtraidos]);

  const statusInfo = ordem ? statusConfig[ordem.status] || statusConfig.em_aberto : null;
  const StatusIcon = statusInfo?.icon || Clock;

  // Renderizar coordenadas copiáveis
  const renderCoordenadasCopiavel = (lat?: number, lng?: number, dataHora?: string) => {
    if (!lat && !lng && !dataHora) return null;
    
    const coordsText = lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;

    return (
      <div className="mt-0.5 space-y-0">
        {dataHora && (
          <p 
            className="text-[9px] text-muted-foreground font-mono cursor-pointer hover:text-foreground select-all"
            title="Clique para selecionar"
          >
            {dataHora}
          </p>
        )}
        {coordsText && (
          <p 
            className="text-[9px] text-muted-foreground font-mono cursor-pointer hover:text-foreground select-all"
            title="Clique para selecionar"
          >
            {coordsText}
          </p>
        )}
      </div>
    );
  };

  // Renderizar valor da resposta do checklist
  const renderValorResposta = (pergunta: Pergunta, resposta: any) => {
    if (!resposta) return <span className="text-muted-foreground text-sm">-</span>;

    const valor = resposta.resposta;
    const fotoUrl = resposta.foto_url;
    const assinaturaUrl = resposta.assinatura_url;
    const fotoLat = resposta.foto_latitude;
    const fotoLng = resposta.foto_longitude;
    const fotoDataHora = resposta.foto_data_hora;
    const assLat = resposta.assinatura_latitude;
    const assLng = resposta.assinatura_longitude;
    const assDataHora = resposta.assinatura_data_hora;

    if (pergunta.tipo === "foto") {
      return fotoUrl ? (
        <div>
          <img src={fotoUrl} alt="Foto" className="w-20 h-16 object-cover rounded cursor-pointer hover:opacity-80" onClick={() => window.open(fotoUrl, '_blank')} />
          {renderCoordenadasCopiavel(fotoLat, fotoLng, fotoDataHora)}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">Sem foto</span>
      );
    }

    if (pergunta.tipo === "assinatura") {
      return assinaturaUrl ? (
        <div>
          <img src={assinaturaUrl} alt="Assinatura" className="w-32 h-16 object-contain bg-white border rounded" />
          {renderCoordenadasCopiavel(assLat, assLng, assDataHora)}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">-</span>
      );
    }

    if (pergunta.tipo === "sim_nao") {
      return valor === "sim" ? (
        <Badge variant="destructive" className="text-xs">Sim</Badge>
      ) : valor === "nao" ? (
        <Badge className="bg-green-600 text-xs">Não</Badge>
      ) : (
        <span className="text-sm">{String(valor)}</span>
      );
    }

    if (pergunta.tipo === "multipla_escolha" && Array.isArray(valor)) {
      return (
        <div className="flex flex-wrap gap-1">
          {valor.slice(0, 3).map((v: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-xs">{v}</Badge>
          ))}
          {valor.length > 3 && (
            <Badge variant="outline" className="text-xs">+{valor.length - 3}</Badge>
          )}
        </div>
      );
    }

    return <span className="text-sm">{String(valor)}</span>;
  };

  // Formatar tempo em minutos para exibição
  const formatarTempo = (minutos: number | null | undefined): string => {
    if (!minutos) return "-";
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
      return `${horas}h ${mins}min`;
    }
    return `${mins}min`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {ordem ? `OS #${ordem.numero}` : "Detalhes da OS"}
          </DialogTitle>
        </DialogHeader>

        {loadingOrdem ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : ordem ? (
          <ScrollArea className="max-h-[70vh] pr-4">
            <Tabs defaultValue="detalhes" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="execucao">Execução</TabsTrigger>
                <TabsTrigger value="producao">
                  Produção
                  {producao && (
                    <Badge variant="secondary" className="ml-1 bg-green-500 text-white h-5 px-1">
                      ✓
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="materiais">
                  Materiais
                  {materiais && (materiais.aplicados?.length > 0 || materiais.retirados?.length > 0) && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                      {(materiais.aplicados?.length || 0) + (materiais.retirados?.length || 0)}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="checklists">
                  Checklists
                  {checklists && checklists.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                      {checklists.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>

              {/* Tab Detalhes */}
              <TabsContent value="detalhes" className="space-y-4 mt-4">
                {/* Status e Informações Principais */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <Badge className={statusInfo?.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo?.label}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-1">Tipo</p>
                      <p className="font-semibold text-sm">
                        {skillsMap[ordem.tipo?.toLowerCase()] || 
                         skillsMap[ordem.tipo?.toUpperCase()] || 
                         ordem.tipo}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-1">Prazo</p>
                      <p className="font-semibold text-sm">
                        {ordem.prazo ? format(new Date(ordem.prazo), "dd/MM/yyyy HH:mm") : "-"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-1">Dt. Execução</p>
                      <p className={`font-semibold text-sm ${ordem.concluido_at ? "text-green-600" : ""}`}>
                        {ordem.concluido_at 
                          ? format(new Date(ordem.concluido_at), "dd/MM/yyyy HH:mm") 
                          : ordem.execucao_iniciada_at 
                            ? format(new Date(ordem.execucao_iniciada_at), "dd/MM/yyyy HH:mm")
                            : "-"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-1">Regulada</p>
                      {ordem.regulada ? (
                        <Badge variant="destructive">Sim</Badge>
                      ) : (
                        <Badge variant="outline">Não</Badge>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Endereço, Cliente e Fachada */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <MapPin className="h-4 w-4" />
                          Endereço
                        </div>
                        <p className="font-medium">{ordem.endereco}</p>
                        {((ordem as any).bairro || (ordem as any).municipio) && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {(ordem as any).bairro && <span>{(ordem as any).bairro}</span>}
                            {(ordem as any).bairro && (ordem as any).municipio && <span> - </span>}
                            {(ordem as any).municipio && <span>{(ordem as any).municipio}</span>}
                          </p>
                        )}
                        {ordem.latitude && ordem.longitude && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {ordem.latitude}, {ordem.longitude}
                          </p>
                        )}
                        {/* Campo Territórios - sempre exibido */}
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">Territórios: </span>
                          <span className="text-xs font-medium">
                            {territoriosNomes && territoriosNomes.length > 0 
                              ? territoriosNomes.join(", ") 
                              : <span className="text-muted-foreground italic">Nenhum território</span>}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <User className="h-4 w-4" />
                          Cliente
                        </div>
                        <p className="font-medium">{ordem.cliente_nome || "-"}</p>
                        {ordem.cliente_cpf && (
                          <p className="text-sm text-muted-foreground">CPF: {ordem.cliente_cpf}</p>
                        )}
                        {ordem.cliente_telefone && (
                          <p className="text-sm text-muted-foreground">{ordem.cliente_telefone}</p>
                        )}
                      </div>
                      {/* Imagem Street View da Fachada - Sob Demanda */}
                      <div>
                        <StreetViewImage
                          latitude={ordem.latitude}
                          longitude={ordem.longitude}
                          endereco={ordem.endereco}
                          size="md"
                          showExpandButton={true}
                          collapsible={true}
                          defaultCollapsed={true}
                          label="Possível Fachada"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Instalação, Medidor e outras informações */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Instalação</p>
                        <p className="font-mono font-medium">{ordem.instalacao || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Medidor</p>
                        <p className="font-mono font-medium">{ordem.medidor || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Duração Estimada</p>
                        <p className="font-medium">{ordem.duracao_estimada ? `${ordem.duracao_estimada} min` : "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Prioridade</p>
                        <Badge variant={(ordem as any).prioridade === "ALTA" ? "destructive" : "outline"}>
                          {(ordem as any).prioridade || "NORMAL"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Planejamento */}
                {planejamento && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Planejamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Equipe</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: planejamento.tecnicos?.color || "#666" }}
                            />
                            <span className="font-medium">{planejamento.tecnicos?.codigo}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Data</p>
                          <p className="font-medium mt-1">
                            {planejamento.planejamentos?.data_planejamento
                              ? format(new Date(planejamento.planejamentos.data_planejamento + 'T12:00:00'), "dd/MM/yyyy")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Horário Previsto</p>
                          <p className="font-medium mt-1">
                            {planejamento.hora_inicio_estimada} - {planejamento.hora_fim_estimada}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ordem na Rota</p>
                          <Badge variant="outline" className="mt-1">#{planejamento.ordem_na_rota}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Valores */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" />
                          Valor Previsto
                        </div>
                        <p className="font-semibold text-lg">
                          {ordem.valor ? `R$ ${Number(ordem.valor).toFixed(2)}` : "-"}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          Valor Prod.
                        </div>
                        <p className="font-semibold text-lg text-green-600">
                          {producao?.valor_total ? `R$ ${Number(producao.valor_total).toFixed(2)}` : "-"}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Timer className="h-4 w-4" />
                          Tempo Execução
                        </div>
                        <p className="font-semibold">
                          {ordem.tempo_execucao 
                            ? formatarTempo(ordem.tempo_execucao)
                            : ordem.execucao_iniciada_at && ordem.concluido_at
                              ? formatarTempo(Math.round((new Date(ordem.concluido_at).getTime() - new Date(ordem.execucao_iniciada_at).getTime()) / 60000))
                              : "-"}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Clock className="h-4 w-4" />
                          Tempo Total
                        </div>
                        <p className="font-semibold">
                          {ordem.tempo_total_minutos 
                            ? formatarTempo(ordem.tempo_total_minutos)
                            : ordem.deslocamento_iniciado_at && ordem.concluido_at
                              ? formatarTempo(Math.round((new Date(ordem.concluido_at).getTime() - new Date(ordem.deslocamento_iniciado_at).getTime()) / 60000))
                              : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Informações Adicionais - Novos Campos */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Informações Adicionais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Contrato</p>
                        {(ordem as any).contratos ? (
                          <Badge variant="outline" className="font-mono">
                            {(ordem as any).contratos.codigo}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Centro de Custo</p>
                        {(ordem as any).centros_custo ? (
                          <p className="font-medium text-sm">{(ordem as any).centros_custo.nome}</p>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Tensão Medição</p>
                        {(ordem as any).tensao_medicao ? (
                          <p className="font-medium text-sm">{(ordem as any).tensao_medicao}</p>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Data Geração</p>
                        {(ordem as any).data_geracao ? (
                          <p className="font-medium text-sm">
                            {format(new Date((ordem as any).data_geracao), "dd/MM/yyyy HH:mm")}
                          </p>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Zona Cadastral</p>
                        {(ordem as any).zona_cadastral ? (
                          <Badge 
                            variant="outline" 
                            className={
                              (ordem as any).zona_cadastral === "Urbana" 
                                ? "bg-blue-50 text-blue-700 border-blue-200" 
                                : (ordem as any).zona_cadastral === "Rural"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-gray-50 text-gray-700 border-gray-200"
                            }
                          >
                            {(ordem as any).zona_cadastral}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Observações - Separadas em Coelba e Equipe */}
                {(ordem.observacoes || (ordem as any).observacoes_equipe) && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Observações Coelba */}
                    <Card className="border-blue-200 bg-blue-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-blue-700">Observações Coelba</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {ordem.observacoes || <span className="text-muted-foreground italic">Sem observações</span>}
                        </p>
                        
                        {/* Botão para extrair contatos com IA */}
                        {ordem.observacoes && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={handleExtrairContatos}
                            disabled={extraindoContatos}
                          >
                            {extraindoContatos ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            {extraindoContatos ? "Identificando..." : "Identificar contatos com IA"}
                          </Button>
                        )}
                        
                        {/* Contatos extraídos */}
                        {contatosParaExibir && contatosParaExibir.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-blue-200">
                            <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contatosParaExibir.length} contato(s) identificado(s)
                            </p>
                            <div className="space-y-2">
                              {contatosParaExibir.map((contato: ContatoIA, idx: number) => (
                                <div key={idx} className="bg-white rounded-lg border border-blue-200 p-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      {contato.nome && (
                                        <span className="font-medium text-slate-900">{contato.nome}</span>
                                      )}
                                      {contato.relacao && (
                                        <span className="text-muted-foreground ml-1">({contato.relacao})</span>
                                      )}
                                      <div className="font-mono text-slate-700">{contato.telefone}</div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600"
                                        onClick={() => window.location.href = gerarLinkTelefone(contato.telefoneLimpo)}
                                        title="Ligar"
                                      >
                                        <Phone className="h-3 w-3" />
                                      </Button>
                                      {contato.tipo === "celular" && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 rounded-full bg-green-50 hover:bg-green-100 text-green-600"
                                          onClick={() => window.open(gerarLinkWhatsApp(contato.telefoneLimpo, {
                                            numero: ordem.numero,
                                            endereco: ordem.endereco || "",
                                            tipoServico: skillsMap[ordem.tipo?.toLowerCase() || ""] || ordem.tipo || "serviço",
                                          }), "_blank")}
                                          title="WhatsApp"
                                        >
                                          <MessageCircle className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* Observações Equipe */}
                    <Card className="border-emerald-200 bg-emerald-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-emerald-700">Observações Equipe</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">
                          {(ordem as any).observacoes_equipe || <span className="text-muted-foreground italic">Sem observações</span>}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Fotos/Anexos */}
                {anexos && anexos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        Fotos ({anexos.filter((a: any) => a.tipo === "foto").length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                        {anexos.filter((a: any) => a.tipo === "foto").map((foto: any) => (
                          <div key={foto.id} className="relative aspect-square rounded-lg overflow-hidden border">
                            <img
                              src={foto.url}
                              alt={foto.nome || "Foto"}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(foto.url, "_blank")}
                            />
                            {foto.created_at && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                                {format(new Date(foto.created_at), "dd/MM HH:mm")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Execução */}
              <TabsContent value="execucao" className="space-y-4 mt-4">
                {/* Timeline de Execução */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Etapas da Execução
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Deslocamento Iniciado */}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ordem.deslocamento_iniciado_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Truck className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Deslocamento Iniciado</p>
                          <p className="text-xs text-muted-foreground">
                            {ordem.deslocamento_iniciado_at
                              ? format(new Date(ordem.deslocamento_iniciado_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : "Aguardando"}
                          </p>
                        </div>
                      </div>

                      {/* Chegada no Local */}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ordem.chegada_local_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Chegada no Local</p>
                          <p className="text-xs text-muted-foreground">
                            {ordem.chegada_local_at
                              ? format(new Date(ordem.chegada_local_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : "Aguardando"}
                          </p>
                        </div>
                      </div>

                      {/* Execução Iniciada */}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ordem.execucao_iniciada_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Play className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Execução Iniciada</p>
                          <p className="text-xs text-muted-foreground">
                            {ordem.execucao_iniciada_at
                              ? format(new Date(ordem.execucao_iniciada_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : "Aguardando"}
                          </p>
                        </div>
                      </div>

                      {/* Pausado (se aplicável) */}
                      {ordem.pausado_at && (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-100 text-yellow-600">
                            <Pause className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">Pausado</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(ordem.pausado_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Concluído */}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ordem.concluido_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Flag className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Concluído</p>
                          <p className="text-xs text-muted-foreground">
                            {ordem.concluido_at
                              ? format(new Date(ordem.concluido_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : "Aguardando"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Métricas de Tempo */}
                {(ordem.deslocamento_iniciado_at || ordem.concluido_at) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        Métricas de Tempo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Tempo Deslocamento</p>
                          <p className="font-semibold">
                            {ordem.deslocamento_iniciado_at && ordem.chegada_local_at
                              ? formatarTempo(Math.round((new Date(ordem.chegada_local_at).getTime() - new Date(ordem.deslocamento_iniciado_at).getTime()) / 60000))
                              : "-"}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Tempo Execução</p>
                          <p className="font-semibold">
                            {ordem.execucao_iniciada_at && ordem.concluido_at
                              ? formatarTempo(Math.round((new Date(ordem.concluido_at).getTime() - new Date(ordem.execucao_iniciada_at).getTime()) / 60000))
                              : "-"}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Tempo Total</p>
                          <p className="font-semibold">
                            {ordem.deslocamento_iniciado_at && ordem.concluido_at
                              ? formatarTempo(Math.round((new Date(ordem.concluido_at).getTime() - new Date(ordem.deslocamento_iniciado_at).getTime()) / 60000))
                              : formatarTempo(ordem.tempo_total_minutos)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Produção */}
              <TabsContent value="producao" className="space-y-4 mt-4">
                {loadingProducao ? (
                  <Skeleton className="h-48 w-full" />
                ) : producao || retornoCampo ? (
                  <>
                    {/* Retorno de Campo - Destaque */}
                    <Card className={`border-2 ${
                      (producao?.retornos_campo?.tipo || retornoCampo?.tipo) === 'executado' 
                        ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                        : (producao?.retornos_campo?.tipo || retornoCampo?.tipo) === 'impedimento'
                          ? 'border-red-500 bg-red-50 dark:bg-red-950'
                          : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
                    }`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Flag className="h-4 w-4" />
                          Retorno de Campo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: producao?.retornos_campo?.cor || retornoCampo?.cor || "#6b7280" }}
                          />
                          <div>
                            <p className="font-semibold text-lg">
                              {producao?.retornos_campo?.descricao || retornoCampo?.descricao || "-"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="font-mono text-xs">
                                {producao?.retornos_campo?.codigo || retornoCampo?.codigo}
                              </Badge>
                              <Badge className={`text-xs ${
                                (producao?.retornos_campo?.tipo || retornoCampo?.tipo) === 'executado'
                                  ? 'bg-green-600'
                                  : (producao?.retornos_campo?.tipo || retornoCampo?.tipo) === 'impedimento'
                                    ? 'bg-red-600'
                                    : 'bg-yellow-600'
                              }`}>
                                {(producao?.retornos_campo?.tipo || retornoCampo?.tipo)?.toUpperCase()}
                              </Badge>
                              {(producao?.retornos_campo?.gera_producao || retornoCampo?.gera_producao) && (
                                <Badge className="bg-blue-600 text-xs">Gera Produção</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Valor Total Produzido */}
                    {producao && (
                      <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                        <CardContent className="pt-6 pb-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm opacity-90">Valor Total Produzido</p>
                              <p className="text-3xl font-bold">
                                R$ {Number(producao.valor_total || 0).toFixed(2)}
                              </p>
                            </div>
                            <TrendingUp className="h-12 w-12 opacity-50" />
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Atividades Realizadas */}
                    {producao?.producao_atividades && producao.producao_atividades.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Atividades Realizadas ({producao.producao_atividades.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {producao.producao_atividades.map((atv: any) => (
                              <div
                                key={atv.id}
                                className="flex items-center justify-between p-3 bg-muted rounded-lg"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {atv.atividades?.descricao}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="font-mono text-xs">
                                      {atv.atividades?.codigo}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Qtd: {atv.quantidade} {atv.atividades?.unidade}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-green-600">
                                    R$ {Number(atv.valor_total || 0).toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    @ R$ {Number(atv.atividades?.valor_unitario || 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        Nenhum retorno de campo registrado para esta OS
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        A produção será registrada quando a equipe encerrar o serviço
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Materiais */}
              <TabsContent value="materiais" className="space-y-4 mt-4">
                {loadingMateriais ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="space-y-4">
                    {/* Materiais Aplicados */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                          <Package className="h-4 w-4" />
                          Materiais Aplicados ({materiais?.aplicados?.length || 0})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {materiais?.aplicados && materiais.aplicados.length > 0 ? (
                          <div className="space-y-2">
                            {materiais.aplicados.map((item: any) => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-100"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {item.materiais?.nome || item.descricao || "Material"}
                                  </p>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {item.materiais?.codigo || item.codigo}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-emerald-700">
                                    {item.quantidade} {item.materiais?.unidade || "UN"}
                                  </p>
                                  {item.created_at && (
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(item.created_at), "dd/MM HH:mm")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum material aplicado
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Materiais Retirados */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                          <Package className="h-4 w-4" />
                          Materiais Retirados ({materiais?.retirados?.length || 0})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {materiais?.retirados && materiais.retirados.length > 0 ? (
                          <div className="space-y-2">
                            {materiais.retirados.map((item: any) => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-100"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {item.materiais?.nome || item.descricao || "Material"}
                                  </p>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {item.materiais?.codigo || item.codigo}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-orange-700">
                                    {item.quantidade} {item.materiais?.unidade || "UN"}
                                  </p>
                                  {item.created_at && (
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(item.created_at), "dd/MM HH:mm")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum material retirado
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              {/* Tab Checklists */}
              <TabsContent value="checklists" className="space-y-4 mt-4">
                {loadingChecklists ? (
                  <Skeleton className="h-48 w-full" />
                ) : checklists && checklists.length > 0 ? (
                  checklists.map((checklist: any) => (
                    <Card key={checklist.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-violet-600" />
                            {checklist.checklists?.nome}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs uppercase">
                              {checklist.checklists?.tipo}
                            </Badge>
                            {checklist.status === "completo" ? (
                              <Badge className="bg-green-600 text-xs">Completo</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Rascunho</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Preenchido em {format(new Date(checklist.created_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </CardHeader>
                      <CardContent>
                        {checklist.checklists?.grupos?.map((grupo: GrupoPerguntas) => {
                          const respostasMap = Array.isArray(checklist.respostas)
                            ? checklist.respostas.reduce((acc: any, r: any) => ({ ...acc, [r.pergunta_id]: r }), {})
                            : checklist.respostas || {};

                          // Contar riscos no grupo
                          const riscosGrupo = grupo.perguntas?.filter(p => {
                            if (p.tipo !== "sim_nao") return false;
                            return respostasMap[p.id]?.resposta === "sim";
                          }).length || 0;

                          return (
                            <div key={grupo.id} className="mb-4 last:mb-0">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium text-sm">{grupo.nome}</p>
                                {riscosGrupo > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {riscosGrupo} risco(s)
                                  </Badge>
                                )}
                              </div>
                              <div className="grid gap-2">
                                {grupo.perguntas?.slice(0, 5).map((pergunta) => {
                                  const resposta = respostasMap[pergunta.id];
                                  return (
                                    <div key={pergunta.id} className="flex items-center justify-between py-1 border-b last:border-0">
                                      <span className="text-xs text-muted-foreground truncate max-w-[60%]">
                                        {pergunta.texto}
                                      </span>
                                      {renderValorResposta(pergunta, resposta)}
                                    </div>
                                  );
                                })}
                                {grupo.perguntas && grupo.perguntas.length > 5 && (
                                  <p className="text-xs text-muted-foreground text-center">
                                    +{grupo.perguntas.length - 5} perguntas
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhum checklist preenchido para esta OS</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Histórico */}
              <TabsContent value="historico" className="space-y-4 mt-4">
                {loadingLogs ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="space-y-0">
                        {/* Timeline vertical */}
                        {(() => {
                          // Construir histórico completo a partir dos campos de data da OS
                          const historicoCompleto: { data: Date; descricao: string; tipo: string; icon: React.ReactNode; cor: string }[] = [];

                          // Cadastro no sistema
                          if (ordem.created_at) {
                            historicoCompleto.push({
                              data: new Date(ordem.created_at),
                              descricao: "OS cadastrada no sistema",
                              tipo: "cadastro",
                              icon: <FileText className="h-4 w-4" />,
                              cor: "bg-blue-100 text-blue-600"
                            });
                          }

                          // Roteirização/Planejamento
                          if (planejamento?.planejamentos?.data_planejamento) {
                            historicoCompleto.push({
                              data: new Date(planejamento.created_at || planejamento.planejamentos.data_planejamento + 'T08:00:00'),
                              descricao: `Roteirizada para equipe ${planejamento.tecnicos?.codigo || ''} - Data: ${format(new Date(planejamento.planejamentos.data_planejamento + 'T12:00:00'), "dd/MM/yyyy")}`,
                              tipo: "roteirizacao",
                              icon: <MapPin className="h-4 w-4" />,
                              cor: "bg-purple-100 text-purple-600"
                            });
                          }

                          // Atribuição a técnico
                          if (ordem.atribuido_at) {
                            historicoCompleto.push({
                              data: new Date(ordem.atribuido_at),
                              descricao: "Atribuída ao técnico/equipe",
                              tipo: "atribuicao",
                              icon: <User className="h-4 w-4" />,
                              cor: "bg-indigo-100 text-indigo-600"
                            });
                          }

                          // Recebimento no aplicativo
                          if (ordem.recebido_at) {
                            historicoCompleto.push({
                              data: new Date(ordem.recebido_at),
                              descricao: "Recebida no aplicativo em campo",
                              tipo: "recebimento",
                              icon: <Smartphone className="h-4 w-4" />,
                              cor: "bg-cyan-100 text-cyan-600"
                            });
                          }

                          // Início do deslocamento
                          if (ordem.deslocamento_iniciado_at) {
                            historicoCompleto.push({
                              data: new Date(ordem.deslocamento_iniciado_at),
                              descricao: "Deslocamento iniciado",
                              tipo: "deslocamento",
                              icon: <Truck className="h-4 w-4" />,
                              cor: "bg-amber-100 text-amber-600"
                            });
                          }

                          // Chegada no local
                          if (ordem.chegada_local_at) {
                            historicoCompleto.push({
                              data: new Date(ordem.chegada_local_at),
                              descricao: "Chegou no local",
                              tipo: "chegada",
                              icon: <MapPin className="h-4 w-4" />,
                              cor: "bg-orange-100 text-orange-600"
                            });
                          }

                          // Início da execução
                          if (ordem.execucao_iniciada_at) {
                            historicoCompleto.push({
                              data: new Date(ordem.execucao_iniciada_at),
                              descricao: "Execução iniciada",
                              tipo: "execucao",
                              icon: <Play className="h-4 w-4" />,
                              cor: "bg-emerald-100 text-emerald-600"
                            });
                          }

                          // Pausas (se houver campo)
                          if ((ordem as any).pausado_at) {
                            historicoCompleto.push({
                              data: new Date((ordem as any).pausado_at),
                              descricao: "Serviço pausado",
                              tipo: "pausa",
                              icon: <Pause className="h-4 w-4" />,
                              cor: "bg-yellow-100 text-yellow-600"
                            });
                          }

                          // Conclusão
                          if (ordem.concluido_at) {
                            const retornoDesc = ordem.retorno_campo_descricao 
                              ? ` - Retorno: ${ordem.retorno_campo_descricao}` 
                              : "";
                            historicoCompleto.push({
                              data: new Date(ordem.concluido_at),
                              descricao: `Serviço concluído${retornoDesc}`,
                              tipo: "conclusao",
                              icon: <CheckCircle className="h-4 w-4" />,
                              cor: "bg-green-100 text-green-600"
                            });
                          }

                          // Cancelamento
                          if (ordem.cancelado_at) {
                            historicoCompleto.push({
                              data: new Date(ordem.cancelado_at),
                              descricao: `Serviço cancelado${ordem.motivo_cancelamento ? `: ${ordem.motivo_cancelamento}` : ''}`,
                              tipo: "cancelamento",
                              icon: <XCircle className="h-4 w-4" />,
                              cor: "bg-red-100 text-red-600"
                            });
                          }

                          // Adicionar logs do planejamento
                          if (logs && logs.length > 0) {
                            logs.forEach((log: any) => {
                              historicoCompleto.push({
                                data: new Date(log.created_at),
                                descricao: log.descricao,
                                tipo: "log",
                                icon: <History className="h-4 w-4" />,
                                cor: "bg-gray-100 text-gray-600"
                              });
                            });
                          }

                          // Ordenar por data (mais recente primeiro)
                          historicoCompleto.sort((a, b) => b.data.getTime() - a.data.getTime());

                          if (historicoCompleto.length === 0) {
                            return (
                              <div className="py-8 text-center">
                                <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">Nenhum registro no histórico</p>
                            </div>
                            );
                          }

                          return historicoCompleto.map((item, index) => (
                            <div key={index} className="flex items-start gap-3 relative">
                              {/* Linha vertical conectando os eventos */}
                              {index < historicoCompleto.length - 1 && (
                                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" style={{ height: "calc(100% - 8px)" }} />
                              )}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${item.cor}`}>
                                {item.icon}
                              </div>
                              <div className="flex-1 min-w-0 pb-4">
                                <p className="text-sm font-medium">{item.descricao}</p>
                              <p className="text-xs text-muted-foreground">
                                  {format(item.data, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          ));
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Ordem de serviço não encontrada</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

