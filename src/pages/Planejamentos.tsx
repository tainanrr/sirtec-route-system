import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Search,
  Eye,
  X,
  Calendar,
  Car,
  MapPin,
  DollarSign,
  Clock,
  AlertTriangle,
  Download,
  Upload,
  CheckSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { tecnicosParaEquipes } from "@/lib/equipeUtils";
import type { Equipe } from "@/data/mockData";
import * as XLSX from "xlsx";

interface Planejamento {
  id: string;
  data_planejamento: string;
  status: string;
  total_equipes: number;
  total_ordens: number;
  distancia_total_km: number;
  tempo_total_minutos: number;
  faturamento_total: number;
  created_at: string;
  observacoes?: string;
  planejamento_ordens?: any[];
}

// Função para extrair a unidade do código da equipe (ex: "4ST" de "4ST002")
const extrairUnidade = (codigo: string): string => {
  // Pegar os primeiros caracteres antes dos números finais
  const match = codigo.match(/^([A-Za-z0-9]+?)(\d{2,})$/);
  if (match) {
    return match[1];
  }
  // Se não tiver padrão, pegar os 3 primeiros caracteres
  return codigo.substring(0, 3).toUpperCase();
};

const Planejamentos = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("aberto");
  const [dataFilter, setDataFilter] = useState<string>("");
  const [equipeFilter, setEquipeFilter] = useState<string>("all");
  const [unidadeFilter, setUnidadeFilter] = useState<string>("all");
  const [planejamentos, setPlanejamentos] = useState<Planejamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [planejamentoSelecionado, setPlanejamentoSelecionado] = useState<Planejamento | null>(null);
  const [detalhesDialogOpen, setDetalhesDialogOpen] = useState(false);
  const [cancelarDialogOpen, setCancelarDialogOpen] = useState(false);
  const [planejamentoParaCancelar, setPlanejamentoParaCancelar] = useState<Planejamento | null>(null);
  const [planejamentosSelecionados, setPlanejamentosSelecionados] = useState<string[]>([]);

  // Extrair unidades únicas das equipes
  const unidadesDisponiveis = useMemo(() => {
    const unidades = new Set<string>();
    equipes.forEach(equipe => {
      const unidade = extrairUnidade(equipe.codigo);
      if (unidade) unidades.add(unidade);
    });
    return Array.from(unidades).sort();
  }, [equipes]);

  // Carregar equipes
  useEffect(() => {
    const fetchEquipes = async () => {
      try {
        const { data, error } = await supabase
          .from("tecnicos")
          .select("*")
          .order("codigo");

        if (error) throw error;

        const equipesConvertidas = tecnicosParaEquipes(data || []);
        setEquipes(equipesConvertidas);
      } catch (error: any) {
        console.error("Erro ao carregar equipes:", error);
      }
    };

    fetchEquipes();
  }, []);

  // Carregar planejamentos
  const fetchPlanejamentos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("planejamentos")
        .select(`
          *,
          planejamento_ordens (
            id,
            ordem_na_rota,
            distancia_km,
            tempo_estimado_minutos,
            hora_inicio_estimada,
            hora_fim_estimada,
            ordem_servico_id,
            equipe_id,
            ordens_servico:ordem_servico_id (
              numero,
              tipo,
              endereco,
              cliente_nome,
              prazo,
              regulada,
              valor
            ),
            tecnicos:equipe_id (
              codigo,
              nome
            )
          )
        `)
        .order("data_planejamento", { ascending: false })
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (dataFilter) {
        query = query.eq("data_planejamento", dataFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let planejamentosFiltrados = (data || []) as Planejamento[];

      // Filtrar por equipe se necessário
      if (equipeFilter !== "all") {
        planejamentosFiltrados = planejamentosFiltrados.filter(p => {
          const ordens = p.planejamento_ordens || [];
          return ordens.some((po: any) => po.equipe_id === equipeFilter);
        });
      }

      // Filtrar por unidade se necessário
      if (unidadeFilter !== "all") {
        planejamentosFiltrados = planejamentosFiltrados.filter(p => {
          const ordens = p.planejamento_ordens || [];
          return ordens.some((po: any) => {
            const tecnico = po.tecnicos;
            if (!tecnico?.codigo) return false;
            const unidade = extrairUnidade(tecnico.codigo);
            return unidade === unidadeFilter;
          });
        });
      }

      // Filtrar por termo de busca
      if (searchTerm) {
        const termoLower = searchTerm.toLowerCase();
        planejamentosFiltrados = planejamentosFiltrados.filter(p => {
          const ordens = p.planejamento_ordens || [];
          return ordens.some((po: any) => {
            const os = po.ordens_servico;
            if (!os) return false;
            return (
              os.numero?.toLowerCase().includes(termoLower) ||
              os.endereco?.toLowerCase().includes(termoLower) ||
              os.cliente_nome?.toLowerCase().includes(termoLower)
            );
          });
        });
      }

      setPlanejamentos(planejamentosFiltrados);
    } catch (error: any) {
      console.error("Erro ao carregar planejamentos:", error);
      toast.error("Erro ao carregar planejamentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanejamentos();
  }, [statusFilter, dataFilter, equipeFilter, unidadeFilter]);

  const handleCancelarPlanejamento = async () => {
    if (!planejamentoParaCancelar) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar ordens do planejamento
      const { data: ordensPlanejamento } = await supabase
        .from("planejamento_ordens")
        .select("ordem_servico_id")
        .eq("planejamento_id", planejamentoParaCancelar.id);

      // Atualizar status do planejamento
      const { error: erroUpdate } = await supabase
        .from("planejamentos")
        .update({
          status: "cancelado",
          canceled_at: new Date().toISOString(),
          canceled_by: user.id,
        })
        .eq("id", planejamentoParaCancelar.id);

      if (erroUpdate) throw erroUpdate;

      // Reverter status das OSs para "pendente"
      if (ordensPlanejamento && ordensPlanejamento.length > 0) {
        const osIds = ordensPlanejamento.map(po => po.ordem_servico_id);
        
        const { error: erroOSs } = await supabase
          .from("ordens_servico")
          .update({
            status: "pendente",
            equipe_planejada_id: null,
            data_planejada: null,
          })
          .in("id", osIds);

        if (erroOSs) throw erroOSs;
      }

      // Criar log
      await supabase.from("planejamento_logs").insert({
        planejamento_id: planejamentoParaCancelar.id,
        acao: "cancelado",
        descricao: "Planejamento cancelado",
        created_by: user.id,
      });

      toast.success("Planejamento cancelado com sucesso");
      setCancelarDialogOpen(false);
      setPlanejamentoParaCancelar(null);
      fetchPlanejamentos();
    } catch (error: any) {
      console.error("Erro ao cancelar planejamento:", error);
      toast.error(`Erro ao cancelar planejamento: ${error.message}`);
    }
  };

  const handleExportarPlanejamento = (planejamento: Planejamento) => {
    try {
      const dadosExportacao: any[] = [];

      if (planejamento.planejamento_ordens) {
        // Agrupar por equipe
        const ordensPorEquipe = new Map<string, any[]>();
        
        planejamento.planejamento_ordens.forEach((po: any) => {
          const equipeId = po.equipe_id;
          if (!ordensPorEquipe.has(equipeId)) {
            ordensPorEquipe.set(equipeId, []);
          }
          ordensPorEquipe.get(equipeId)!.push(po);
        });

        ordensPorEquipe.forEach((ordens, equipeId) => {
          const primeiraOrdem = ordens[0];
          const equipe = primeiraOrdem.tecnicos;
          
          ordens.sort((a, b) => a.ordem_na_rota - b.ordem_na_rota);

          ordens.forEach((po: any, index: number) => {
            const os = po.ordens_servico;
            dadosExportacao.push({
              "Data Planejamento": (() => {
                const data = new Date(planejamento.data_planejamento + 'T12:00:00');
                return data.toLocaleDateString('pt-BR');
              })(),
              "Equipe": equipe?.codigo || "-",
              "Técnico": equipe?.nome || "-",
              "Ordem na Rota": po.ordem_na_rota,
              "Número OS": os?.numero || "-",
              "Tipo": os?.tipo || "-",
              "Endereço": os?.endereco || "-",
              "Cliente": os?.cliente_nome || "-",
              "Prazo": os?.prazo ? new Date(os.prazo).toLocaleString('pt-BR') : "-",
              "Regulada": os?.regulada ? "Sim" : "Não",
              "Valor": os?.valor || 0,
              "Distância (km)": po.distancia_km || 0,
              "Tempo Estimado (min)": po.tempo_estimado_minutos || 0,
              "Hora Início": po.hora_inicio_estimada || "-",
              "Hora Fim": po.hora_fim_estimada || "-",
            });
          });
        });
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExportacao);
      XLSX.utils.book_append_sheet(wb, ws, "Planejamento");

      const nomeArquivo = `Planejamento_${new Date(planejamento.data_planejamento).toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);
      toast.success("Planejamento exportado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao exportar planejamento:", error);
      toast.error("Erro ao exportar planejamento");
    }
  };

  return (
    <MainLayout
      title="Planejamentos"
    >
      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="OS, endereço, cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="executado">Executado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Data</label>
            <Input
              type="date"
              value={dataFilter}
              onChange={(e) => setDataFilter(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Unidade</label>
            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {unidadesDisponiveis.map(unidade => (
                  <SelectItem key={unidade} value={unidade}>
                    {unidade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Equipe</label>
            <Select value={equipeFilter} onValueChange={setEquipeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {equipes
                  .filter(equipe => unidadeFilter === "all" || extrairUnidade(equipe.codigo) === unidadeFilter)
                  .map(equipe => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.codigo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabela de Planejamentos */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Planejamentos</h3>
              <Badge variant="secondary">{planejamentos.length}</Badge>
              {planejamentosSelecionados.length > 0 && (
                <Badge variant="default" className="bg-blue-600">
                  {planejamentosSelecionados.length} selecionado(s)
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {planejamentosSelecionados.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // Carregar todos os planejamentos selecionados na roteirização
                    const ids = planejamentosSelecionados.join(',');
                    navigate(`/roteirizacao?planejamentos=${ids}`);
                  }}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Carregar {planejamentosSelecionados.length} na Roteirização
                </Button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : planejamentos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum planejamento encontrado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={planejamentosSelecionados.length === planejamentos.length && planejamentos.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setPlanejamentosSelecionados(planejamentos.map(p => p.id));
                      } else {
                        setPlanejamentosSelecionados([]);
                      }
                    }}
                    title="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Equipes</TableHead>
                <TableHead>OSs</TableHead>
                <TableHead>Distância</TableHead>
                <TableHead>Faturamento</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planejamentos.map((planejamento) => {
                const isSelected = planejamentosSelecionados.includes(planejamento.id);
                
                // Extrair as equipes do planejamento para mostrar
                const equipesDoPlano = Array.from(new Set(
                  (planejamento.planejamento_ordens || [])
                    .map((po: any) => po.tecnicos?.codigo)
                    .filter(Boolean)
                ));
                
                return (
                  <TableRow 
                    key={planejamento.id}
                    className={isSelected ? "bg-blue-50 dark:bg-blue-950/30" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setPlanejamentosSelecionados(prev => [...prev, planejamento.id]);
                          } else {
                            setPlanejamentosSelecionados(prev => prev.filter(id => id !== planejamento.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // Corrigir timezone: adicionar um dia se necessário
                        const data = new Date(planejamento.data_planejamento + 'T12:00:00');
                        return data.toLocaleDateString('pt-BR');
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          planejamento.status === "aberto"
                            ? "default"
                            : planejamento.status === "cancelado"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {planejamento.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {equipesDoPlano.slice(0, 3).map((codigo: string) => (
                          <Badge key={codigo} variant="outline" className="text-xs">
                            {codigo}
                          </Badge>
                        ))}
                        {equipesDoPlano.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{equipesDoPlano.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{planejamento.total_ordens}</TableCell>
                    <TableCell>{planejamento.distancia_total_km?.toFixed(1)} km</TableCell>
                    <TableCell>R$ {planejamento.faturamento_total?.toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(planejamento.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Navegar para tela de roteirização com o ID do planejamento
                            navigate(`/roteirizacao?planejamento=${planejamento.id}`);
                          }}
                          title="Ver no mapa"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportarPlanejamento(planejamento)}
                          title="Exportar Excel"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {planejamento.status === "aberto" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPlanejamentoParaCancelar(planejamento);
                              setCancelarDialogOpen(true);
                            }}
                            title="Cancelar planejamento"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog de Detalhes */}
      <Dialog open={detalhesDialogOpen} onOpenChange={setDetalhesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes do Planejamento - {planejamentoSelecionado && (() => {
                // Corrigir timezone: adicionar um dia se necessário
                const data = new Date(planejamentoSelecionado.data_planejamento + 'T12:00:00');
                return data.toLocaleDateString('pt-BR');
              })()}
            </DialogTitle>
            <DialogDescription>
              Visualize todas as ordens de serviço planejadas neste planejamento.
            </DialogDescription>
          </DialogHeader>

          {planejamentoSelecionado && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-4 gap-4 p-4 rounded-lg border border-border bg-muted/50">
                <div>
                  <div className="text-sm text-muted-foreground">Equipes</div>
                  <div className="text-lg font-semibold">{planejamentoSelecionado.total_equipes}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">OSs</div>
                  <div className="text-lg font-semibold">{planejamentoSelecionado.total_ordens}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Distância</div>
                  <div className="text-lg font-semibold">{planejamentoSelecionado.distancia_total_km?.toFixed(1)} km</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Faturamento</div>
                  <div className="text-lg font-semibold">R$ {planejamentoSelecionado.faturamento_total?.toFixed(2)}</div>
                </div>
              </div>

              {/* Ordens por Equipe */}
              {planejamentoSelecionado.planejamento_ordens && (
                <div className="space-y-4">
                  {Array.from(
                    new Map(
                      planejamentoSelecionado.planejamento_ordens.map((po: any) => [
                        po.equipe_id,
                        { equipe: po.tecnicos, ordens: [] }
                      ])
                    ).entries()
                  ).map(([equipeId, data]: [string, any]) => {
                    const ordensEquipe = planejamentoSelecionado.planejamento_ordens!
                      .filter((po: any) => po.equipe_id === equipeId)
                      .sort((a: any, b: any) => a.ordem_na_rota - b.ordem_na_rota);

                    return (
                      <div key={equipeId} className="rounded-lg border border-border p-4">
                        <div className="font-semibold mb-3">
                          {data.equipe?.codigo} - {data.equipe?.nome}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ordem</TableHead>
                              <TableHead>OS</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Endereço</TableHead>
                              <TableHead>Hora Início</TableHead>
                              <TableHead>Hora Fim</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ordensEquipe.map((po: any) => {
                              const os = po.ordens_servico;
                              return (
                                <TableRow key={po.id}>
                                  <TableCell>{po.ordem_na_rota}</TableCell>
                                  <TableCell>{os?.numero || "-"}</TableCell>
                                  <TableCell>{os?.tipo || "-"}</TableCell>
                                  <TableCell className="max-w-xs truncate">{os?.endereco || "-"}</TableCell>
                                  <TableCell>{po.hora_inicio_estimada || "-"}</TableCell>
                                  <TableCell>{po.hora_fim_estimada || "-"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setDetalhesDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Cancelamento */}
      <AlertDialog open={cancelarDialogOpen} onOpenChange={setCancelarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Planejamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este planejamento? 
              Todas as ordens de serviço voltarão para o status "pendente" e 
              os dados de planejamento serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarPlanejamento}>
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Planejamentos;

