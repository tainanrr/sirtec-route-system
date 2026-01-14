import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Truck,
  Navigation,
  MapPin,
  Wrench,
  Coffee,
  AlertTriangle,
  Battery,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  Clock,
  Map,
  Route,
  Signal,
  SignalZero,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  EquipeTurnoAberto,
  useEquipesRastreamento,
  EVENTO_CONFIG,
} from "@/hooks/useEquipesRastreamento";
import EquipeTrajetoModal from "./EquipeTrajetoModal";

// =====================================================
// TIPOS
// =====================================================

interface PainelEquipesRastreamentoProps {
  onCentralizarEquipe?: (lat: number, lng: number, equipeId: string) => void;
  mostrarEquipesNoMapa: boolean;
  onToggleMostrarEquipes: (mostrar: boolean) => void;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function PainelEquipesRastreamento({
  onCentralizarEquipe,
  mostrarEquipesNoMapa,
  onToggleMostrarEquipes,
}: PainelEquipesRastreamentoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [equipesExpandidas, setEquipesExpandidas] = useState<Set<string>>(new Set());
  const [equipeSelecionadaTrajeto, setEquipeSelecionadaTrajeto] = useState<EquipeTurnoAberto | null>(null);
  const [modalTrajetoOpen, setModalTrajetoOpen] = useState(false);

  const {
    equipesComTurno,
    estatisticas,
    isLoading,
    refetch,
    isRealtimeActive,
  } = useEquipesRastreamento({
    autoRefresh: true,
    refreshInterval: 15000,
    enableRealtime: true,
  });

  // Toggle expandir equipe
  const toggleExpandirEquipe = useCallback((equipeId: string) => {
    setEquipesExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(equipeId)) {
        next.delete(equipeId);
      } else {
        next.add(equipeId);
      }
      return next;
    });
  }, []);

  // Abrir modal de trajeto
  const abrirModalTrajeto = useCallback((equipe: EquipeTurnoAberto) => {
    setEquipeSelecionadaTrajeto(equipe);
    setModalTrajetoOpen(true);
  }, []);

  // Centralizar no mapa
  const centralizarNoMapa = useCallback((equipe: EquipeTurnoAberto) => {
    if (equipe.ultima_latitude && equipe.ultima_longitude && onCentralizarEquipe) {
      onCentralizarEquipe(equipe.ultima_latitude, equipe.ultima_longitude, equipe.equipe_id);
    }
  }, [onCentralizarEquipe]);

  // Obter ícone e cor do status
  const getStatusInfo = (ultimoEvento: string | null) => {
    const config = EVENTO_CONFIG[ultimoEvento || "inicio_turno"] || EVENTO_CONFIG.inicio_turno;
    
    let Icone = MapPin;
    switch (ultimoEvento) {
      case "inicio_deslocamento": Icone = Navigation; break;
      case "chegada_local": Icone = MapPin; break;
      case "inicio_servico": case "fim_servico": Icone = Wrench; break;
      case "inicio_intervalo": Icone = Coffee; break;
      case "parada_detectada": Icone = AlertTriangle; break;
      default: Icone = Truck;
    }

    return { Icone, cor: config.cor, label: config.label };
  };

  // Calcular tempo desde última posição
  const getTempoUltimaPosicao = (dataStr: string | null) => {
    if (!dataStr) return { texto: "Sem posição", status: "offline" as const };
    
    const diffMinutos = (Date.now() - new Date(dataStr).getTime()) / 60000;
    
    if (diffMinutos > 30) {
      return { texto: `Há ${Math.floor(diffMinutos)} min`, status: "offline" as const };
    } else if (diffMinutos > 10) {
      return { texto: `Há ${Math.floor(diffMinutos)} min`, status: "warning" as const };
    } else {
      return { texto: formatDistanceToNow(new Date(dataStr), { addSuffix: true, locale: ptBR }), status: "online" as const };
    }
  };

  return (
    <>
      {/* Botão flutuante para abrir painel */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="fixed bottom-4 right-4 z-[1000] bg-blue-600 hover:bg-blue-700 shadow-lg gap-2"
          >
            <Truck className="h-4 w-4" />
            <span>Equipes</span>
            {equipesComTurno.length > 0 && (
              <Badge variant="secondary" className="bg-white/20 text-white">
                {equipesComTurno.length}
              </Badge>
            )}
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0">
          <SheetHeader className="p-4 pb-2 border-b bg-gradient-to-r from-blue-600 to-blue-700">
            <SheetTitle className="text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                <span>Equipes em Campo</span>
              </div>
              <div className="flex items-center gap-2">
                {isRealtimeActive && (
                  <Badge variant="secondary" className="bg-green-500/20 text-green-100 text-xs">
                    <Signal className="h-3 w-3 mr-1" />
                    Tempo Real
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </SheetTitle>
          </SheetHeader>

          {/* Estatísticas */}
          {estatisticas && (
            <div className="grid grid-cols-4 gap-2 p-3 bg-gray-50 border-b">
              <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                <div className="text-lg font-bold text-blue-600">{estatisticas.emDeslocamento}</div>
                <div className="text-xs text-gray-500">Deslocando</div>
              </div>
              <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                <div className="text-lg font-bold text-teal-600">{estatisticas.emServico}</div>
                <div className="text-xs text-gray-500">Em Serviço</div>
              </div>
              <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                <div className="text-lg font-bold text-pink-600">{estatisticas.emIntervalo}</div>
                <div className="text-xs text-gray-500">Intervalo</div>
              </div>
              <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                <div className="text-lg font-bold text-gray-600">{estatisticas.ociosas}</div>
                <div className="text-xs text-gray-500">Ociosas</div>
              </div>
            </div>
          )}

          {/* Toggle mostrar no mapa */}
          <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
            <Label htmlFor="mostrar-equipes" className="flex items-center gap-2 text-sm">
              <Map className="h-4 w-4 text-gray-500" />
              Mostrar equipes no mapa
            </Label>
            <Switch
              id="mostrar-equipes"
              checked={mostrarEquipesNoMapa}
              onCheckedChange={onToggleMostrarEquipes}
            />
          </div>

          {/* Lista de equipes */}
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-2 space-y-2">
              {isLoading && equipesComTurno.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                  <p>Carregando equipes...</p>
                </div>
              ) : equipesComTurno.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>Nenhuma equipe com turno aberto</p>
                </div>
              ) : (
                equipesComTurno.map(equipe => {
                  const isExpandida = equipesExpandidas.has(equipe.equipe_id);
                  const statusInfo = getStatusInfo(equipe.ultimo_evento_tipo);
                  const tempoInfo = getTempoUltimaPosicao(equipe.ultima_posicao_at);

                  return (
                    <Collapsible
                      key={equipe.equipe_id}
                      open={isExpandida}
                      onOpenChange={() => toggleExpandirEquipe(equipe.equipe_id)}
                    >
                      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        {/* Cabeçalho da equipe */}
                        <CollapsibleTrigger className="w-full">
                          <div className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: statusInfo.cor }}
                              >
                                <statusInfo.Icone className="h-5 w-5 text-white" />
                              </div>
                              <div className="text-left">
                                <div className="font-semibold text-gray-900">
                                  {equipe.equipe_codigo}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {statusInfo.label}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {/* Indicador de posição */}
                              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                tempoInfo.status === "online" ? "bg-green-100 text-green-700" :
                                tempoInfo.status === "warning" ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {tempoInfo.status === "online" ? (
                                  <Signal className="h-3 w-3" />
                                ) : (
                                  <SignalZero className="h-3 w-3" />
                                )}
                                {tempoInfo.texto}
                              </div>
                              
                              {isExpandida ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        {/* Conteúdo expandido */}
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-0 border-t bg-gray-50">
                            {/* Informações do turno */}
                            <div className="grid grid-cols-2 gap-2 py-2 text-sm">
                              <div>
                                <span className="text-gray-500">Início:</span>
                                <span className="ml-1 font-medium">
                                  {format(new Date(equipe.hora_inicio), "HH:mm")}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Placa:</span>
                                <span className="ml-1 font-medium">{equipe.placa_veiculo || "N/A"}</span>
                              </div>
                            </div>

                            {/* Bateria e velocidade */}
                            <div className="flex gap-3 py-2 border-t">
                              {equipe.battery_pct !== null && (
                                <div className="flex items-center gap-1 text-xs">
                                  <Battery className={`h-3 w-3 ${
                                    equipe.battery_pct < 20 ? "text-red-500" :
                                    equipe.battery_pct < 50 ? "text-amber-500" :
                                    "text-green-500"
                                  }`} />
                                  <span>{equipe.battery_pct}%</span>
                                </div>
                              )}
                              {equipe.speed_mps !== null && (
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <Navigation className="h-3 w-3" />
                                  <span>{Math.round(equipe.speed_mps * 3.6)} km/h</span>
                                </div>
                              )}
                            </div>

                            {/* Colaboradores */}
                            {equipe.colaboradores && equipe.colaboradores.length > 0 && (
                              <div className="py-2 border-t">
                                <div className="text-xs text-gray-500 mb-1">Colaboradores:</div>
                                <div className="flex flex-wrap gap-1">
                                  {equipe.colaboradores.map(c => (
                                    <Badge
                                      key={c.id}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {c.nome.split(" ")[0]}
                                      {c.funcao === "lider" && " ⭐"}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* OS Atual */}
                            {equipe.os_atual && (
                              <div className="py-2 border-t">
                                <div className="text-xs text-gray-500 mb-1">OS em atendimento:</div>
                                <div className="bg-blue-50 rounded p-2 text-xs">
                                  <div className="font-semibold text-blue-900">
                                    {equipe.os_atual.numero}
                                  </div>
                                  <div className="text-blue-700">{equipe.os_atual.tipo}</div>
                                </div>
                              </div>
                            )}

                            {/* Botões de ação */}
                            <div className="flex gap-2 pt-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => centralizarNoMapa(equipe)}
                                disabled={!equipe.ultima_latitude || !equipe.ultima_longitude}
                              >
                                <MapPin className="h-3 w-3 mr-1" />
                                Localizar
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700"
                                onClick={() => abrirModalTrajeto(equipe)}
                              >
                                <Route className="h-3 w-3 mr-1" />
                                Ver Trajeto
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Alertas */}
          {estatisticas && estatisticas.semPosicaoRecente > 0 && (
            <div className="p-3 border-t bg-amber-50">
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {estatisticas.semPosicaoRecente} equipe(s) sem posição há mais de 10 min
                </span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal de Trajeto */}
      <EquipeTrajetoModal
        open={modalTrajetoOpen}
        onOpenChange={setModalTrajetoOpen}
        equipe={equipeSelecionadaTrajeto}
      />
    </>
  );
}
