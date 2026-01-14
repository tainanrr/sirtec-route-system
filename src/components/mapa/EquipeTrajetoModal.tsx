import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Square,
  Navigation,
  MapPin,
  Flag,
  Wrench,
  CheckCircle,
  Coffee,
  Clock,
  AlertTriangle,
  ArrowRight,
  Route,
  List,
  MapIcon,
  Battery,
  Gauge,
  Users,
  Car,
  X,
  RefreshCw,
  Maximize2,
  Minimize2,
  Filter,
  Eye,
  EyeOff,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  EquipeTurnoAberto,
  TurnoEvento,
  useTurnoTrajeto,
  useHistoricoPosicoes,
  EVENTO_CONFIG,
} from "@/hooks/useEquipesRastreamento";

// =====================================================
// TIPOS
// =====================================================

interface EquipeTrajetoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipe: EquipeTurnoAberto | null;
}

// Mapeamento de ícones
const ICONES_EVENTO: Record<string, React.ComponentType<any>> = {
  Play,
  Square,
  Navigation,
  MapPin,
  Flag,
  ClipboardCheck: CheckCircle,
  ClipboardList: List,
  Wrench,
  CheckCircle,
  Coffee,
  Clock,
  AlertTriangle,
  ArrowRight,
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function EquipeTrajetoModal({
  open,
  onOpenChange,
  equipe,
}: EquipeTrajetoModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const trajetoLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(true);
  const [tiposEventosVisiveis, setTiposEventosVisiveis] = useState<Set<string>>(
    new Set(Object.keys(EVENTO_CONFIG))
  );
  const [mostrarTrajeto, setMostrarTrajeto] = useState(true);
  const [mostrarPosicoes, setMostrarPosicoes] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<string | null>(null);

  // Buscar dados do trajeto
  const {
    eventos,
    eventosComCoordenadas,
    duracaoTurno,
    resumoAtividades,
    isLoading: isLoadingEventos,
    refetch: refetchEventos,
  } = useTurnoTrajeto(equipe?.turno_id || null);

  // Buscar histórico de posições
  const {
    polylineCoords,
    isLoading: isLoadingPosicoes,
    refetch: refetchPosicoes,
  } = useHistoricoPosicoes(
    equipe?.equipe_id || null,
    equipe?.turno_id || null
  );

  // Filtrar eventos visíveis
  const eventosFiltrados = useMemo(() => {
    return eventosComCoordenadas.filter(e => tiposEventosVisiveis.has(e.tipo_evento));
  }, [eventosComCoordenadas, tiposEventosVisiveis]);

  // =====================================================
  // INICIALIZAR MAPA
  // =====================================================
  useEffect(() => {
    if (!open || !mapRef.current || mapInstanceRef.current) return;

    // Criar mapa
    const map = L.map(mapRef.current, {
      center: [-23.55, -46.63], // São Paulo como padrão
      zoom: 12,
      zoomControl: true,
    });

    // Adicionar tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // Criar layer group para marcadores
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Resize observer para ajustar mapa
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [open]);

  // Cleanup ao fechar
  useEffect(() => {
    if (!open && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      trajetoLayerRef.current = null;
      markersLayerRef.current = null;
    }
  }, [open]);

  // =====================================================
  // ATUALIZAR TRAJETO NO MAPA
  // =====================================================
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !open) return;

    // Remover trajeto anterior
    if (trajetoLayerRef.current) {
      map.removeLayer(trajetoLayerRef.current);
      trajetoLayerRef.current = null;
    }

    // Desenhar trajeto baseado nas posições
    if (mostrarTrajeto && polylineCoords.length > 1) {
      const trajeto = L.polyline(polylineCoords, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.8,
        dashArray: mostrarPosicoes ? "10, 10" : undefined,
      }).addTo(map);

      trajetoLayerRef.current = trajeto;

      // Ajustar bounds para mostrar todo o trajeto
      if (polylineCoords.length > 0) {
        const bounds = L.latLngBounds(polylineCoords);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [open, polylineCoords, mostrarTrajeto, mostrarPosicoes]);

  // =====================================================
  // ATUALIZAR MARCADORES DE EVENTOS
  // =====================================================
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer || !open) return;

    // Limpar marcadores anteriores
    markersLayer.clearLayers();

    // Adicionar marcadores dos eventos
    eventosFiltrados.forEach((evento, index) => {
      if (!evento.latitude || !evento.longitude) return;

      const config = EVENTO_CONFIG[evento.tipo_evento] || EVENTO_CONFIG.posicao_atualizada;
      const isSelecionado = eventoSelecionado === evento.evento_id;
      const tamanho = isSelecionado ? 36 : 28;

      // Criar ícone customizado
      const icon = L.divIcon({
        className: "custom-evento-marker",
        html: `
          <div style="
            width: ${tamanho}px;
            height: ${tamanho}px;
            background: ${config.cor};
            border: 3px solid ${isSelecionado ? '#ffffff' : config.cor + '80'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px ${config.cor}80;
            cursor: pointer;
            transition: all 0.2s;
            ${isSelecionado ? 'transform: scale(1.2);' : ''}
          ">
            <span style="color: white; font-size: ${tamanho * 0.45}px; font-weight: bold;">
              ${index + 1}
            </span>
          </div>
        `,
        iconSize: [tamanho, tamanho],
        iconAnchor: [tamanho / 2, tamanho / 2],
        popupAnchor: [0, -tamanho / 2],
      });

      // Criar marker
      const marker = L.marker([evento.latitude, evento.longitude], { icon });

      // Popup com detalhes
      const horaFormatada = format(new Date(evento.data_hora), "HH:mm:ss", { locale: ptBR });
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <div style="
            background: ${config.cor};
            color: white;
            padding: 8px 12px;
            margin: -10px -10px 10px -10px;
            border-radius: 4px 4px 0 0;
            font-weight: 600;
          ">
            ${config.label}
          </div>
          <div style="padding: 0 4px;">
            <div style="font-size: 13px; color: #374151; margin-bottom: 6px;">
              ⏰ ${horaFormatada}
            </div>
            ${evento.descricao ? `
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
                ${evento.descricao}
              </div>
            ` : ''}
            ${evento.os_numero ? `
              <div style="
                background: #f0f9ff;
                border: 1px solid #bae6fd;
                padding: 6px 8px;
                border-radius: 6px;
                font-size: 11px;
              ">
                <div style="font-weight: 600; color: #0369a1;">OS: ${evento.os_numero}</div>
                <div style="color: #0284c7;">${evento.os_tipo}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `, { maxWidth: 300 });

      marker.on("click", () => {
        setEventoSelecionado(evento.evento_id);
      });

      marker.addTo(markersLayer);
    });

    // Ajustar bounds se não houver trajeto
    if (!mostrarTrajeto && eventosFiltrados.length > 0) {
      const coords = eventosFiltrados
        .filter(e => e.latitude && e.longitude)
        .map(e => [e.latitude!, e.longitude!] as [number, number]);
      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [open, eventosFiltrados, eventoSelecionado, mostrarTrajeto]);

  // =====================================================
  // TOGGLE TIPO DE EVENTO
  // =====================================================
  const toggleTipoEvento = useCallback((tipo: string) => {
    setTiposEventosVisiveis(prev => {
      const next = new Set(prev);
      if (next.has(tipo)) {
        next.delete(tipo);
      } else {
        next.add(tipo);
      }
      return next;
    });
  }, []);

  const toggleTodosTipos = useCallback((visivel: boolean) => {
    if (visivel) {
      setTiposEventosVisiveis(new Set(Object.keys(EVENTO_CONFIG)));
    } else {
      setTiposEventosVisiveis(new Set());
    }
  }, []);

  // =====================================================
  // CENTRALIZAR NO EVENTO
  // =====================================================
  const centralizarNoEvento = useCallback((evento: TurnoEvento) => {
    const map = mapInstanceRef.current;
    if (!map || !evento.latitude || !evento.longitude) return;

    map.flyTo([evento.latitude, evento.longitude], 17, {
      animate: true,
      duration: 0.8,
    });
    setEventoSelecionado(evento.evento_id);
  }, []);

  // =====================================================
  // RENDER
  // =====================================================
  if (!equipe) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${isFullscreen ? "max-w-[95vw] max-h-[95vh] h-[95vh]" : "max-w-5xl max-h-[90vh]"} p-0 overflow-hidden`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">
                  {equipe.equipe_codigo}
                </DialogTitle>
                <p className="text-blue-100 text-sm">{equipe.equipe_nome}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {duracaoTurno && (
                <Badge className="bg-white/20 text-white border-0">
                  <Clock className="w-3 h-3 mr-1" />
                  {duracaoTurno.horas}h {duracaoTurno.minutos}m
                  {duracaoTurno.emAndamento && " (em andamento)"}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => {
                  refetchEventos();
                  refetchPosicoes();
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Resumo */}
          {resumoAtividades && (
            <div className="flex gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                <span>{resumoAtividades.osAtendidas} OS atendidas</span>
              </div>
              <div className="flex items-center gap-1">
                <Navigation className="w-4 h-4" />
                <span>{resumoAtividades.totalDeslocamentos} deslocamentos</span>
              </div>
              <div className="flex items-center gap-1">
                <Coffee className="w-4 h-4" />
                <span>{resumoAtividades.totalIntervalos} intervalos</span>
              </div>
              {resumoAtividades.totalParadas > 0 && (
                <div className="flex items-center gap-1 text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{resumoAtividades.totalParadas} paradas</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex h-[calc(100%-120px)]">
          {/* Painel Lateral */}
          <div className="w-80 border-r bg-gray-50 flex flex-col">
            <Tabs defaultValue="eventos" className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-2 m-2">
                <TabsTrigger value="eventos" className="text-xs">
                  <List className="w-3 h-3 mr-1" />
                  Eventos
                </TabsTrigger>
                <TabsTrigger value="filtros" className="text-xs">
                  <Filter className="w-3 h-3 mr-1" />
                  Filtros
                </TabsTrigger>
              </TabsList>

              <TabsContent value="eventos" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {isLoadingEventos ? (
                      <div className="p-4 text-center text-gray-500">
                        Carregando eventos...
                      </div>
                    ) : eventos.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        Nenhum evento registrado
                      </div>
                    ) : (
                      eventos.map((evento, index) => {
                        const config = EVENTO_CONFIG[evento.tipo_evento] || EVENTO_CONFIG.posicao_atualizada;
                        const isSelected = eventoSelecionado === evento.evento_id;
                        const temCoordenadas = !!evento.latitude && !!evento.longitude;

                        return (
                          <div
                            key={evento.evento_id}
                            className={`
                              p-2 rounded-lg cursor-pointer transition-all
                              ${isSelected ? "bg-blue-100 border-blue-300" : "bg-white hover:bg-gray-100"}
                              ${!tiposEventosVisiveis.has(evento.tipo_evento) ? "opacity-50" : ""}
                              border
                            `}
                            onClick={() => {
                              if (temCoordenadas) {
                                centralizarNoEvento(evento);
                              } else {
                                setEventoSelecionado(evento.evento_id);
                              }
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: config.cor }}
                              >
                                <span className="text-white text-xs font-bold">{index + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm text-gray-900">
                                    {config.label}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {format(new Date(evento.data_hora), "HH:mm")}
                                  </span>
                                </div>
                                {evento.os_numero && (
                                  <div className="text-xs text-blue-600 mt-0.5">
                                    OS: {evento.os_numero}
                                  </div>
                                )}
                                {evento.descricao && (
                                  <div className="text-xs text-gray-500 truncate mt-0.5">
                                    {evento.descricao}
                                  </div>
                                )}
                                {!temCoordenadas && (
                                  <div className="text-xs text-amber-600 mt-0.5">
                                    ⚠️ Sem coordenadas
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="filtros" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-4">
                    {/* Opções de visualização */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase">
                        Visualização
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="mostrar-trajeto"
                            checked={mostrarTrajeto}
                            onCheckedChange={(checked) => setMostrarTrajeto(!!checked)}
                          />
                          <label htmlFor="mostrar-trajeto" className="text-sm">
                            Mostrar linha do trajeto
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="mostrar-posicoes"
                            checked={mostrarPosicoes}
                            onCheckedChange={(checked) => setMostrarPosicoes(!!checked)}
                          />
                          <label htmlFor="mostrar-posicoes" className="text-sm">
                            Mostrar todas as posições
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Tipos de eventos */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-gray-700 uppercase">
                          Tipos de Eventos
                        </h4>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => toggleTodosTipos(true)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Todos
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => toggleTodosTipos(false)}
                          >
                            <EyeOff className="w-3 h-3 mr-1" />
                            Nenhum
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        {Object.entries(EVENTO_CONFIG).map(([tipo, config]) => (
                          <div
                            key={tipo}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-100"
                          >
                            <Checkbox
                              id={`tipo-${tipo}`}
                              checked={tiposEventosVisiveis.has(tipo)}
                              onCheckedChange={() => toggleTipoEvento(tipo)}
                            />
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: config.cor }}
                            />
                            <label
                              htmlFor={`tipo-${tipo}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {config.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Info da equipe */}
            <div className="p-3 border-t bg-white">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span>
                  {equipe.colaboradores?.length || 0} colaborador(es)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                <Car className="w-4 h-4" />
                <span>{equipe.placa_veiculo || "Sem placa"}</span>
              </div>
              {equipe.battery_pct !== null && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Battery className={`w-4 h-4 ${equipe.battery_pct < 20 ? "text-red-500" : "text-green-500"}`} />
                  <span className={equipe.battery_pct < 20 ? "text-red-500" : "text-gray-600"}>
                    {equipe.battery_pct}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Mapa */}
          <div className="flex-1 relative">
            <div ref={mapRef} className="w-full h-full" />
            
            {/* Loading overlay */}
            {(isLoadingEventos || isLoadingPosicoes) && (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-gray-700">Carregando trajeto...</span>
                </div>
              </div>
            )}

            {/* Legenda */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
              <div className="font-semibold text-gray-700 mb-2">Legenda</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {Array.from(tiposEventosVisiveis).slice(0, 6).map(tipo => {
                  const config = EVENTO_CONFIG[tipo];
                  if (!config) return null;
                  return (
                    <div key={tipo} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: config.cor }}
                      />
                      <span className="text-gray-600">{config.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info de posições */}
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 text-xs">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-blue-600" />
                <span className="text-gray-700">
                  {polylineCoords.length} posições registradas
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
