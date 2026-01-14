import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  Eye,
  EyeOff,
  Target,
  CircleDot,
  Car,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// =====================================================
// TIPOS E CONFIGURAÇÕES
// =====================================================

interface TurnoTrajetoMapProps {
  turnoId: string;
  equipeId: string;
  dataInicio: string;
  dataFim?: string | null;
}

// Configuração de eventos
const EVENTO_CONFIG: Record<string, { label: string; cor: string; icone: string }> = {
  inicio_turno: { label: "Início Turno", cor: "#22c55e", icone: "Play" },
  fim_turno: { label: "Fim Turno", cor: "#ef4444", icone: "Square" },
  inicio_deslocamento: { label: "Início Deslocamento", cor: "#3b82f6", icone: "Navigation" },
  fim_deslocamento: { label: "Chegada no Local", cor: "#8b5cf6", icone: "MapPin" },
  chegada_local: { label: "Chegada no Local", cor: "#8b5cf6", icone: "MapPin" },
  inicio_apr: { label: "Início APR", cor: "#f97316", icone: "CheckCircle" },
  fim_apr: { label: "Fim APR", cor: "#f97316", icone: "CheckCircle" },
  inicio_servico: { label: "Início Serviço", cor: "#14b8a6", icone: "Wrench" },
  fim_servico: { label: "Fim Serviço", cor: "#10b981", icone: "Flag" },
  inicio_intervalo: { label: "Início Intervalo", cor: "#ec4899", icone: "Coffee" },
  fim_intervalo: { label: "Fim Intervalo", cor: "#ec4899", icone: "Coffee" },
  parada_detectada: { label: "Parada Detectada", cor: "#f43f5e", icone: "AlertTriangle" },
  posicao_gps: { label: "Posição GPS", cor: "#64748b", icone: "CircleDot" },
  os_planejada: { label: "OS Planejada", cor: "#0ea5e9", icone: "Target" },
  os_nao_realizada: { label: "OS Não Realizada", cor: "#f59e0b", icone: "AlertTriangle" },
};

// Mapeamento de ícones Lucide
const ICONES: Record<string, React.ComponentType<any>> = {
  Play, Square, Navigation, MapPin, Flag, Wrench, CheckCircle, Coffee, Clock,
  AlertTriangle, ArrowRight, Route, List, Target, CircleDot, Car,
};

interface EventoTrajeto {
  id: string;
  tipo: string;
  latitude: number | null;
  longitude: number | null;
  recorded_at: string;
  ordem_servico_id?: string | null;
  os_numero?: string | null;
  detalhes?: any;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function TurnoTrajetoMap({
  turnoId,
  equipeId,
  dataInicio,
  dataFim,
}: TurnoTrajetoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const trajetoLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  
  const [tiposVisiveis, setTiposVisiveis] = useState<Set<string>>(
    new Set(Object.keys(EVENTO_CONFIG))
  );
  const [mostrarTrajeto, setMostrarTrajeto] = useState(true);
  const [eventoSelecionado, setEventoSelecionado] = useState<string | null>(null);

  // Buscar eventos do turno
  const { data: eventos, isLoading: loadingEventos, refetch } = useQuery({
    queryKey: ["turno-trajeto-eventos", turnoId, equipeId],
    queryFn: async () => {
      const todosEventos: EventoTrajeto[] = [];
      
      // 1. Buscar eventos da tabela turno_eventos (se existir)
      try {
        const { data: turnoEventos } = await supabase
          .from("turno_eventos")
          .select("*")
          .eq("turno_id", turnoId)
          .order("recorded_at");
        
        if (turnoEventos) {
          turnoEventos.forEach((e: any) => {
            todosEventos.push({
              id: e.id,
              tipo: e.evento_tipo,
              latitude: e.latitude,
              longitude: e.longitude,
              recorded_at: e.recorded_at,
              ordem_servico_id: e.ordem_servico_id,
              os_numero: null,
              detalhes: e.detalhes,
            });
          });
        }
      } catch (e) {
        console.log("[TurnoTrajeto] turno_eventos não disponível");
      }

      // 2. Buscar posições GPS
      const dataFimQuery = dataFim || new Date().toISOString();
      const { data: posicoes } = await supabase
        .from("tecnicos_posicoes")
        .select("id, latitude, longitude, recorded_at, speed_mps, accuracy_m")
        .eq("equipe_id", equipeId)
        .gte("recorded_at", dataInicio)
        .lte("recorded_at", dataFimQuery)
        .order("recorded_at");

      if (posicoes) {
        posicoes.forEach((p: any) => {
          todosEventos.push({
            id: `pos-${p.id}`,
            tipo: "posicao_gps",
            latitude: p.latitude,
            longitude: p.longitude,
            recorded_at: p.recorded_at,
            detalhes: { speed: p.speed_mps, accuracy: p.accuracy_m },
          });
        });
      }

      // 3. Buscar intervalos
      const { data: intervalos } = await supabase
        .from("intervalos_equipe")
        .select("id, hora_inicio, hora_fim, tipo_intervalo:tipo_intervalo_id(nome)")
        .eq("turno_id", turnoId)
        .order("hora_inicio");

      if (intervalos) {
        intervalos.forEach((i: any) => {
          // Início do intervalo (sem coordenadas neste caso)
          todosEventos.push({
            id: `int-inicio-${i.id}`,
            tipo: "inicio_intervalo",
            latitude: null,
            longitude: null,
            recorded_at: i.hora_inicio,
            detalhes: { nome: i.tipo_intervalo?.nome },
          });
          if (i.hora_fim) {
            todosEventos.push({
              id: `int-fim-${i.id}`,
              tipo: "fim_intervalo",
              latitude: null,
              longitude: null,
              recorded_at: i.hora_fim,
              detalhes: { nome: i.tipo_intervalo?.nome },
            });
          }
        });
      }

      // 4. Buscar OSs planejadas
      const { data: osPlanejadas } = await supabase
        .from("planejamento_ordens")
        .select(`
          id,
          ordem_na_rota,
          ordens_servico:ordem_servico_id (
            id,
            numero,
            tipo,
            latitude,
            longitude,
            status,
            endereco
          )
        `)
        .eq("equipe_id", equipeId)
        .gte("created_at", dataInicio.substring(0, 10))
        .lte("created_at", (dataFim || new Date().toISOString()).substring(0, 10));

      if (osPlanejadas) {
        osPlanejadas.forEach((po: any) => {
          const os = po.ordens_servico;
          if (os && os.latitude && os.longitude) {
            const foiRealizada = os.status === "concluida";
            todosEventos.push({
              id: `os-${os.id}`,
              tipo: foiRealizada ? "os_planejada" : "os_nao_realizada",
              latitude: os.latitude,
              longitude: os.longitude,
              recorded_at: dataInicio, // Usar data início como referência
              os_numero: os.numero,
              ordem_servico_id: os.id,
              detalhes: {
                tipo: os.tipo,
                status: os.status,
                endereco: os.endereco,
                ordem_na_rota: po.ordem_na_rota,
              },
            });
          }
        });
      }

      // 5. Buscar produções (execuções de OS) com coordenadas
      const { data: producoes } = await supabase
        .from("producao_equipes")
        .select(`
          id,
          created_at,
          iniciado_at,
          concluido_at,
          latitude_inicio,
          longitude_inicio,
          latitude_fim,
          longitude_fim,
          ordens_servico:ordem_servico_id (numero, tipo)
        `)
        .eq("turno_id", turnoId)
        .order("created_at");

      if (producoes) {
        producoes.forEach((p: any) => {
          // Início do serviço
          if (p.latitude_inicio && p.longitude_inicio && p.iniciado_at) {
            todosEventos.push({
              id: `prod-inicio-${p.id}`,
              tipo: "inicio_servico",
              latitude: p.latitude_inicio,
              longitude: p.longitude_inicio,
              recorded_at: p.iniciado_at,
              os_numero: p.ordens_servico?.numero,
              ordem_servico_id: p.ordem_servico_id,
              detalhes: { tipo_os: p.ordens_servico?.tipo },
            });
          }
          // Fim do serviço
          if (p.latitude_fim && p.longitude_fim && p.concluido_at) {
            todosEventos.push({
              id: `prod-fim-${p.id}`,
              tipo: "fim_servico",
              latitude: p.latitude_fim,
              longitude: p.longitude_fim,
              recorded_at: p.concluido_at,
              os_numero: p.ordens_servico?.numero,
              ordem_servico_id: p.ordem_servico_id,
              detalhes: { tipo_os: p.ordens_servico?.tipo },
            });
          }
        });
      }

      // Ordenar todos os eventos por data
      return todosEventos.sort((a, b) => 
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      );
    },
    enabled: !!turnoId && !!equipeId,
  });

  // Eventos filtrados
  const eventosFiltrados = useMemo(() => {
    if (!eventos) return [];
    return eventos.filter(e => tiposVisiveis.has(e.tipo));
  }, [eventos, tiposVisiveis]);

  // Coordenadas válidas para trajeto
  const coordenadasTrajeto = useMemo(() => {
    if (!eventos) return [];
    return eventos
      .filter(e => e.latitude && e.longitude && e.tipo === "posicao_gps")
      .map(e => [e.latitude!, e.longitude!] as [number, number]);
  }, [eventos]);

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [-14.235, -51.925], // Centro do Brasil
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Atualizar trajeto e marcadores
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current) return;

    // Limpar layers
    markersLayerRef.current.clearLayers();
    if (trajetoLayerRef.current) {
      map.removeLayer(trajetoLayerRef.current);
      trajetoLayerRef.current = null;
    }

    // Desenhar linha do trajeto
    if (mostrarTrajeto && coordenadasTrajeto.length > 1) {
      trajetoLayerRef.current = L.polyline(coordenadasTrajeto, {
        color: "#3b82f6",
        weight: 3,
        opacity: 0.7,
        dashArray: "5, 5",
      }).addTo(map);
    }

    // Adicionar marcadores para eventos
    const bounds: [number, number][] = [];

    eventosFiltrados.forEach((evento, index) => {
      if (!evento.latitude || !evento.longitude) return;
      
      // Não mostrar todos os pontos GPS, apenas alguns selecionados
      if (evento.tipo === "posicao_gps" && index % 10 !== 0) return;

      const config = EVENTO_CONFIG[evento.tipo] || EVENTO_CONFIG.posicao_gps;
      const IconComponent = ICONES[config.icone] || CircleDot;
      const isSelected = eventoSelecionado === evento.id;
      const tamanho = isSelected ? 36 : 28;

      const icon = L.divIcon({
        className: "custom-evento-marker",
        html: `
          <div style="
            width: ${tamanho}px;
            height: ${tamanho}px;
            background: ${config.cor};
            border: ${isSelected ? '3px' : '2px'} solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ${isSelected ? 'transform: scale(1.2);' : ''}
          ">
            <span style="color: white; font-size: ${isSelected ? '16px' : '12px'}; font-weight: bold;">
              ${evento.os_numero ? evento.os_numero.slice(-3) : (index + 1)}
            </span>
          </div>
        `,
        iconSize: [tamanho, tamanho],
        iconAnchor: [tamanho / 2, tamanho / 2],
      });

      const marker = L.marker([evento.latitude, evento.longitude], { icon });
      
      // Popup
      const horaFormatada = format(new Date(evento.recorded_at), "HH:mm:ss", { locale: ptBR });
      const dataFormatada = format(new Date(evento.recorded_at), "dd/MM/yyyy", { locale: ptBR });
      
      marker.bindPopup(`
        <div style="min-width: 180px; font-family: system-ui;">
          <div style="
            background: ${config.cor};
            color: white;
            padding: 8px;
            margin: -10px -10px 8px -10px;
            border-radius: 4px 4px 0 0;
            font-weight: 600;
          ">
            ${config.label}
          </div>
          <div style="padding: 0 4px;">
            <div style="font-size: 12px; margin-bottom: 4px;">
              <strong>📅</strong> ${dataFormatada} às ${horaFormatada}
            </div>
            ${evento.os_numero ? `
              <div style="font-size: 12px; margin-bottom: 4px;">
                <strong>📋</strong> OS: ${evento.os_numero}
              </div>
            ` : ''}
            ${evento.detalhes?.tipo ? `
              <div style="font-size: 11px; color: #6b7280;">
                ${evento.detalhes.tipo}
              </div>
            ` : ''}
            ${evento.detalhes?.endereco ? `
              <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                📍 ${evento.detalhes.endereco.substring(0, 50)}...
              </div>
            ` : ''}
          </div>
        </div>
      `);

      marker.on("click", () => {
        setEventoSelecionado(evento.id);
      });

      marker.addTo(markersLayerRef.current!);
      bounds.push([evento.latitude, evento.longitude]);
    });

    // Ajustar bounds
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [eventosFiltrados, mostrarTrajeto, coordenadasTrajeto, eventoSelecionado]);

  // Toggle tipo de evento
  const toggleTipoEvento = useCallback((tipo: string) => {
    setTiposVisiveis(prev => {
      const next = new Set(prev);
      if (next.has(tipo)) {
        next.delete(tipo);
      } else {
        next.add(tipo);
      }
      return next;
    });
  }, []);

  // Estatísticas
  const estatisticas = useMemo(() => {
    if (!eventos) return null;
    
    const stats = {
      totalPosicoes: eventos.filter(e => e.tipo === "posicao_gps").length,
      osRealizadas: eventos.filter(e => e.tipo === "os_planejada").length,
      osNaoRealizadas: eventos.filter(e => e.tipo === "os_nao_realizada").length,
      intervalos: eventos.filter(e => e.tipo === "inicio_intervalo").length,
      servicosIniciados: eventos.filter(e => e.tipo === "inicio_servico").length,
      servicosFinalizados: eventos.filter(e => e.tipo === "fim_servico").length,
    };

    return stats;
  }, [eventos]);

  if (loadingEventos) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{estatisticas?.totalPosicoes || 0}</div>
            <div className="text-xs text-blue-600">Posições GPS</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{estatisticas?.servicosFinalizados || 0}</div>
            <div className="text-xs text-green-600">Serviços Realizados</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{estatisticas?.osNaoRealizadas || 0}</div>
            <div className="text-xs text-amber-600">OSs Não Realizadas</div>
          </CardContent>
        </Card>
        <Card className="bg-pink-50 border-pink-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-pink-700">{estatisticas?.intervalos || 0}</div>
            <div className="text-xs text-pink-600">Intervalos</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros de eventos */}
      <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
        <Button
          variant={mostrarTrajeto ? "default" : "outline"}
          size="sm"
          onClick={() => setMostrarTrajeto(!mostrarTrajeto)}
          className="h-7 text-xs"
        >
          <Route className="h-3 w-3 mr-1" />
          Trajeto
        </Button>
        
        {Object.entries(EVENTO_CONFIG)
          .filter(([tipo]) => tipo !== "posicao_gps")
          .map(([tipo, config]) => (
            <Button
              key={tipo}
              variant={tiposVisiveis.has(tipo) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleTipoEvento(tipo)}
              className="h-7 text-xs"
              style={{
                backgroundColor: tiposVisiveis.has(tipo) ? config.cor : undefined,
                borderColor: config.cor,
              }}
            >
              {tiposVisiveis.has(tipo) ? (
                <Eye className="h-3 w-3 mr-1" />
              ) : (
                <EyeOff className="h-3 w-3 mr-1" />
              )}
              {config.label}
            </Button>
          ))}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="h-7 text-xs ml-auto"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Atualizar
        </Button>
      </div>

      {/* Mapa */}
      <div 
        ref={mapRef} 
        className="w-full h-[400px] rounded-lg border shadow-sm"
        style={{ background: "#f0f0f0" }}
      />

      {/* Lista de eventos */}
      <div className="border rounded-lg">
        <div className="p-3 border-b bg-muted/30">
          <h4 className="font-semibold text-sm">Timeline de Eventos ({eventosFiltrados.length})</h4>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-1">
            {eventosFiltrados.map((evento, index) => {
              const config = EVENTO_CONFIG[evento.tipo] || EVENTO_CONFIG.posicao_gps;
              const IconComponent = ICONES[config.icone] || CircleDot;
              const isSelected = eventoSelecionado === evento.id;
              
              // Pular a maioria das posições GPS na lista
              if (evento.tipo === "posicao_gps" && index % 20 !== 0) return null;
              
              return (
                <div
                  key={evento.id}
                  className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                  }`}
                  onClick={() => {
                    setEventoSelecionado(evento.id);
                    // Centralizar no mapa se tiver coordenadas
                    if (evento.latitude && evento.longitude && mapInstanceRef.current) {
                      mapInstanceRef.current.setView([evento.latitude, evento.longitude], 16);
                    }
                  }}
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: config.cor }}
                  >
                    <IconComponent className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{config.label}</span>
                      {evento.os_numero && (
                        <Badge variant="secondary" className="text-xs">
                          OS: {evento.os_numero}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(evento.recorded_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </div>
                  </div>
                  {evento.latitude && evento.longitude && (
                    <Badge variant="outline" className="text-xs">
                      📍
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
