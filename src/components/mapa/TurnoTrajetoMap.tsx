import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Target,
  CircleDot,
  RefreshCw,
  Route,
  Crosshair,
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

// Configuração visual dos tipos de ponto
const TIPOS_PONTO = {
  // OSs - pontos principais com coordenadas das ordens de serviço
  os_executada: { 
    label: "OS Executada", 
    cor: "#22c55e", 
    corBorda: "#16a34a",
    tamanho: 40,
    emoji: "✅",
    mostrarNumero: true,
  },
  os_pendente: { 
    label: "OS Pendente", 
    cor: "#f59e0b", 
    corBorda: "#d97706",
    tamanho: 40,
    emoji: "⏳",
    mostrarNumero: true,
  },
  os_impedida: { 
    label: "OS Impedida", 
    cor: "#ef4444", 
    corBorda: "#dc2626",
    tamanho: 40,
    emoji: "❌",
    mostrarNumero: true,
  },
  // Posições GPS - pontos do trajeto
  posicao_gps: { 
    label: "Posição GPS", 
    cor: "#3b82f6", 
    corBorda: "#2563eb",
    tamanho: 12,
    emoji: "📍",
    mostrarNumero: false,
  },
  // Intervalos
  intervalo: { 
    label: "Intervalo", 
    cor: "#ec4899", 
    corBorda: "#db2777",
    tamanho: 28,
    emoji: "☕",
    mostrarNumero: false,
  },
};

interface PontoMapa {
  id: string;
  tipo: keyof typeof TIPOS_PONTO;
  latitude: number;
  longitude: number;
  timestamp: string;
  label: string;
  detalhes?: {
    osNumero?: string;
    osTipo?: string;
    osEndereco?: string;
    osStatus?: string;
    nomeIntervalo?: string;
    velocidade?: number;
  };
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
  const [mapaInicializado, setMapaInicializado] = useState(false);
  
  // Estados de visualização
  const [mostrarTrajeto, setMostrarTrajeto] = useState(true);
  const [mostrarOSs, setMostrarOSs] = useState(true);
  const [mostrarIntervalos, setMostrarIntervalos] = useState(true);
  const [pontoSelecionado, setPontoSelecionado] = useState<string | null>(null);

  // Buscar dados do turno
  const { data: dadosTurno, isLoading, refetch } = useQuery({
    queryKey: ["turno-trajeto-completo", turnoId, equipeId],
    queryFn: async () => {
      const pontos: PontoMapa[] = [];
      const dataFimQuery = dataFim || new Date().toISOString();

      // 1. Buscar posições GPS
      const { data: posicoes } = await supabase
        .from("tecnicos_posicoes")
        .select("id, latitude, longitude, recorded_at, speed_mps")
        .eq("equipe_id", equipeId)
        .gte("recorded_at", dataInicio)
        .lte("recorded_at", dataFimQuery)
        .order("recorded_at");

      if (posicoes) {
        posicoes.forEach((p: any) => {
          if (p.latitude && p.longitude) {
            pontos.push({
              id: `gps-${p.id}`,
              tipo: "posicao_gps",
              latitude: p.latitude,
              longitude: p.longitude,
              timestamp: p.recorded_at,
              label: format(new Date(p.recorded_at), "HH:mm:ss"),
              detalhes: { velocidade: p.speed_mps },
            });
          }
        });
      }

      // 2. Buscar OSs planejadas para o dia
      const dataBase = dataInicio.substring(0, 10);
      const { data: osPlanejadas } = await supabase
        .from("planejamento_ordens")
        .select(`
          id,
          ordem_na_rota,
          ordens_servico:ordem_servico_id (
            id, numero, tipo, latitude, longitude, status, endereco, cliente_nome
          ),
          planejamentos!inner (data_planejamento)
        `)
        .eq("equipe_id", equipeId)
        .eq("planejamentos.data_planejamento", dataBase)
        .order("ordem_na_rota");

      if (osPlanejadas) {
        osPlanejadas.forEach((po: any) => {
          const os = po.ordens_servico;
          if (os && os.latitude && os.longitude) {
            let tipo: keyof typeof TIPOS_PONTO = "os_pendente";
            if (os.status === "concluida") {
              tipo = "os_executada";
            } else if (os.status === "impedida" || os.status === "cancelada") {
              tipo = "os_impedida";
            }

            pontos.push({
              id: `os-${os.id}`,
              tipo,
              latitude: os.latitude,
              longitude: os.longitude,
              timestamp: dataInicio,
              label: os.numero,
              detalhes: {
                osNumero: os.numero,
                osTipo: os.tipo,
                osEndereco: os.endereco,
                osStatus: os.status,
              },
            });
          }
        });
      }

      // 3. Buscar OSs executadas no turno (produções)
      const { data: producoes } = await supabase
        .from("producao_equipes")
        .select(`
          id,
          created_at,
          ordens_servico:ordem_servico_id (id, numero, tipo, latitude, longitude, endereco, status)
        `)
        .eq("turno_id", turnoId);

      if (producoes) {
        producoes.forEach((prod: any) => {
          const os = prod.ordens_servico;
          // Adicionar ponto da OS se ainda não existir (usa coordenadas da OS)
          if (os && os.latitude && os.longitude) {
            const osJaExiste = pontos.some(p => p.id === `os-${os.id}`);
            if (!osJaExiste) {
              pontos.push({
                id: `os-${os.id}`,
                tipo: os.status === "concluida" ? "os_executada" : "os_impedida",
                latitude: os.latitude,
                longitude: os.longitude,
                timestamp: prod.created_at || dataInicio,
                label: os.numero,
                detalhes: {
                  osNumero: os.numero,
                  osTipo: os.tipo,
                  osEndereco: os.endereco,
                  osStatus: os.status,
                },
              });
            }
          }
        });
      }

      // 4. Buscar intervalos (sem coordenadas, mas vamos tentar inferir da posição mais próxima)
      const { data: intervalos } = await supabase
        .from("intervalos_equipe")
        .select("id, hora_inicio, hora_fim, tipo_intervalo:tipo_intervalo_id(nome)")
        .eq("turno_id", turnoId)
        .order("hora_inicio");

      // Estatísticas
      const osExecutadas = pontos.filter(p => p.tipo === "os_executada").length;
      const osPendentes = pontos.filter(p => p.tipo === "os_pendente").length;
      const osImpedidas = pontos.filter(p => p.tipo === "os_impedida").length;
      const totalPosicoes = pontos.filter(p => p.tipo === "posicao_gps").length;
      const totalIntervalos = intervalos?.length || 0;

      return {
        pontos,
        intervalos: intervalos || [],
        estatisticas: {
          osExecutadas,
          osPendentes,
          osImpedidas,
          totalOSs: osExecutadas + osPendentes + osImpedidas,
          totalPosicoes,
          totalIntervalos,
        },
      };
    },
    enabled: !!turnoId && !!equipeId,
  });

  // Pontos filtrados para exibição
  const pontosFiltrados = useMemo(() => {
    if (!dadosTurno?.pontos) return [];
    
    return dadosTurno.pontos.filter(ponto => {
      if (ponto.tipo === "posicao_gps") return mostrarTrajeto;
      if (ponto.tipo.startsWith("os_")) return mostrarOSs;
      if (ponto.tipo === "intervalo") return mostrarIntervalos;
      return true;
    });
  }, [dadosTurno?.pontos, mostrarTrajeto, mostrarOSs, mostrarIntervalos]);

  // Coordenadas do trajeto (apenas GPS)
  const coordenadasTrajeto = useMemo(() => {
    if (!dadosTurno?.pontos) return [];
    return dadosTurno.pontos
      .filter(p => p.tipo === "posicao_gps")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(p => [p.latitude, p.longitude] as [number, number]);
  }, [dadosTurno?.pontos]);

  // Inicializar mapa
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!mapRef.current || mapInstanceRef.current) return;

      try {
        const map = L.map(mapRef.current, {
          center: [-14.235, -51.925],
          zoom: 5,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        mapInstanceRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);
        setMapaInicializado(true);

        setTimeout(() => map.invalidateSize(), 100);
      } catch (error) {
        console.error("[TurnoTrajetoMap] Erro ao inicializar mapa:", error);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapaInicializado(false);
      }
    };
  }, []);

  // Atualizar mapa quando dados mudam
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !mapaInicializado) return;

    // Limpar
    markersLayerRef.current.clearLayers();
    if (trajetoLayerRef.current) {
      map.removeLayer(trajetoLayerRef.current);
      trajetoLayerRef.current = null;
    }

    // Desenhar linha do trajeto
    if (mostrarTrajeto && coordenadasTrajeto.length > 1) {
      trajetoLayerRef.current = L.polyline(coordenadasTrajeto, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
    }

    // Adicionar marcadores
    const bounds: [number, number][] = [];

    // Primeiro, adicionar OSs (mais importantes)
    pontosFiltrados
      .filter(p => p.tipo.startsWith("os_"))
      .forEach(ponto => {
        const config = TIPOS_PONTO[ponto.tipo];
        const isSelected = pontoSelecionado === ponto.id;
        const tamanho = isSelected ? config.tamanho + 10 : config.tamanho;

        const icon = L.divIcon({
          className: "custom-os-marker",
          html: `
            <div style="
              width: ${tamanho}px;
              height: ${tamanho}px;
              background: ${config.cor};
              border: 3px solid ${isSelected ? '#000' : config.corBorda};
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
              font-weight: bold;
              font-size: ${isSelected ? '14px' : '11px'};
              color: white;
              text-shadow: 0 1px 2px rgba(0,0,0,0.5);
              ${isSelected ? 'transform: scale(1.1); z-index: 9999;' : ''}
            ">
              ${ponto.detalhes?.osNumero?.slice(-3) || '?'}
            </div>
          `,
          iconSize: [tamanho, tamanho],
          iconAnchor: [tamanho / 2, tamanho / 2],
        });

        const marker = L.marker([ponto.latitude, ponto.longitude], { icon });
        
        marker.bindPopup(`
          <div style="min-width: 200px; font-family: system-ui;">
            <div style="
              background: ${config.cor};
              color: white;
              padding: 10px;
              margin: -10px -10px 10px -10px;
              border-radius: 4px 4px 0 0;
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              <span style="font-size: 20px;">${config.emoji}</span>
              <div>
                <div style="font-weight: 700;">${ponto.detalhes?.osNumero || 'N/A'}</div>
                <div style="font-size: 11px; opacity: 0.9;">${config.label}</div>
              </div>
            </div>
            <div style="padding: 0 4px;">
              <div style="font-size: 12px; margin-bottom: 4px;">
                <strong>Tipo:</strong> ${ponto.detalhes?.osTipo || 'N/A'}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <strong>Status:</strong> ${ponto.detalhes?.osStatus || 'N/A'}
              </div>
              ${ponto.detalhes?.osEndereco ? `
                <div style="font-size: 11px; color: #6b7280; margin-top: 6px;">
                  📍 ${ponto.detalhes.osEndereco.substring(0, 60)}...
                </div>
              ` : ''}
            </div>
          </div>
        `);

        marker.on("click", () => {
          setPontoSelecionado(ponto.id);
        });

        marker.addTo(markersLayerRef.current!);
        bounds.push([ponto.latitude, ponto.longitude]);
      });

    // Depois, adicionar pontos GPS (menores, apenas para referência visual)
    if (mostrarTrajeto) {
      // Mostrar apenas alguns pontos GPS para não poluir o mapa
      const pontosGPS = pontosFiltrados.filter(p => p.tipo === "posicao_gps");
      const step = Math.max(1, Math.floor(pontosGPS.length / 20)); // Máximo 20 pontos

      pontosGPS.forEach((ponto, index) => {
        // Mostrar primeiro, último e a cada N pontos
        if (index !== 0 && index !== pontosGPS.length - 1 && index % step !== 0) return;

        const config = TIPOS_PONTO.posicao_gps;
        const isFirst = index === 0;
        const isLast = index === pontosGPS.length - 1;
        const tamanho = isFirst || isLast ? 24 : config.tamanho;
        const cor = isFirst ? "#22c55e" : isLast ? "#ef4444" : config.cor;

        const icon = L.divIcon({
          className: "custom-gps-marker",
          html: `
            <div style="
              width: ${tamanho}px;
              height: ${tamanho}px;
              background: ${cor};
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              ${isFirst ? '<span style="font-size: 12px;">▶</span>' : ''}
              ${isLast ? '<span style="font-size: 12px;">◼</span>' : ''}
            </div>
          `,
          iconSize: [tamanho, tamanho],
          iconAnchor: [tamanho / 2, tamanho / 2],
        });

        const marker = L.marker([ponto.latitude, ponto.longitude], { icon });
        marker.bindPopup(`
          <div style="font-family: system-ui; padding: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px;">
              ${isFirst ? '🟢 Início do Trajeto' : isLast ? '🔴 Fim do Trajeto' : '📍 Posição GPS'}
            </div>
            <div style="font-size: 12px; color: #6b7280;">
              ${format(new Date(ponto.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
            </div>
            ${ponto.detalhes?.velocidade ? `
              <div style="font-size: 11px; color: #6b7280;">
                🚗 ${Math.round((ponto.detalhes.velocidade || 0) * 3.6)} km/h
              </div>
            ` : ''}
          </div>
        `);

        marker.addTo(markersLayerRef.current!);
        if (isFirst || isLast) {
          bounds.push([ponto.latitude, ponto.longitude]);
        }
      });
    }

    // Ajustar bounds
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [pontosFiltrados, mostrarTrajeto, coordenadasTrajeto, pontoSelecionado, mapaInicializado]);

  // Função para centralizar em um ponto
  const centralizarEmPonto = useCallback((ponto: PontoMapa) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    setPontoSelecionado(ponto.id);
    map.setView([ponto.latitude, ponto.longitude], 17, { animate: true });
  }, []);

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  const estatisticas = dadosTurno?.estatisticas;

  return (
    <div className="space-y-4">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{estatisticas?.osExecutadas || 0}</div>
            <div className="text-xs text-green-600">✅ OSs Executadas</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{estatisticas?.osPendentes || 0}</div>
            <div className="text-xs text-amber-600">⏳ OSs Pendentes</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{estatisticas?.osImpedidas || 0}</div>
            <div className="text-xs text-red-600">❌ OSs Impedidas</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{estatisticas?.totalPosicoes || 0}</div>
            <div className="text-xs text-blue-600">📍 Posições GPS</div>
          </CardContent>
        </Card>
        <Card className="bg-pink-50 border-pink-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-pink-700">{estatisticas?.totalIntervalos || 0}</div>
            <div className="text-xs text-pink-600">☕ Intervalos</div>
          </CardContent>
        </Card>
      </div>

      {/* Controles de visualização */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Switch id="trajeto" checked={mostrarTrajeto} onCheckedChange={setMostrarTrajeto} />
          <Label htmlFor="trajeto" className="text-sm flex items-center gap-1">
            <Route className="h-4 w-4 text-blue-500" />
            Trajeto GPS
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="oss" checked={mostrarOSs} onCheckedChange={setMostrarOSs} />
          <Label htmlFor="oss" className="text-sm flex items-center gap-1">
            <Target className="h-4 w-4 text-green-500" />
            OSs no Mapa
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="intervalos" checked={mostrarIntervalos} onCheckedChange={setMostrarIntervalos} />
          <Label htmlFor="intervalos" className="text-sm flex items-center gap-1">
            <Coffee className="h-4 w-4 text-pink-500" />
            Intervalos
          </Label>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 px-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span>OS Executada</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-amber-500 rounded" />
          <span>OS Pendente</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span>OS Impedida</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-full" />
          <span>Início Trajeto</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <span>Fim Trajeto</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
          <span>Posição GPS</span>
        </div>
      </div>

      {/* Mapa */}
      <div 
        ref={mapRef} 
        className="w-full h-[450px] rounded-lg border shadow-sm"
        style={{ background: "#e5e7eb" }}
      />

      {/* Lista de OSs clicáveis */}
      <div className="border rounded-lg">
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
          <h4 className="font-semibold text-sm">
            📋 OSs do Turno ({estatisticas?.totalOSs || 0})
          </h4>
          <span className="text-xs text-muted-foreground">
            Clique para localizar no mapa
          </span>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-1">
            {pontosFiltrados
              .filter(p => p.tipo.startsWith("os_"))
              .map(ponto => {
                const config = TIPOS_PONTO[ponto.tipo];
                const isSelected = pontoSelecionado === ponto.id;
                
                return (
                  <div
                    key={ponto.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected 
                        ? "bg-primary/10 border-2 border-primary shadow-sm" 
                        : "hover:bg-muted border border-transparent"
                    }`}
                    onClick={() => centralizarEmPonto(ponto)}
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ backgroundColor: config.cor }}
                    >
                      {config.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{ponto.detalhes?.osNumero}</span>
                        <Badge 
                          variant="secondary" 
                          className="text-xs"
                          style={{ backgroundColor: `${config.cor}20`, color: config.cor }}
                        >
                          {config.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {ponto.detalhes?.osTipo} • {ponto.detalhes?.osEndereco?.substring(0, 40)}...
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        centralizarEmPonto(ponto);
                      }}
                    >
                      <Crosshair className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            
            {pontosFiltrados.filter(p => p.tipo.startsWith("os_")).length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma OS encontrada para este turno</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Lista de Intervalos */}
      {dadosTurno?.intervalos && dadosTurno.intervalos.length > 0 && (
        <div className="border rounded-lg">
          <div className="p-3 border-b bg-muted/30">
            <h4 className="font-semibold text-sm">
              ☕ Intervalos ({dadosTurno.intervalos.length})
            </h4>
          </div>
          <div className="p-2 space-y-1">
            {dadosTurno.intervalos.map((intervalo: any) => (
              <div
                key={intervalo.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted"
              >
                <div className="h-8 w-8 rounded-full bg-pink-500 flex items-center justify-center text-white">
                  ☕
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {intervalo.tipo_intervalo?.nome || "Intervalo"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(intervalo.hora_inicio), "HH:mm", { locale: ptBR })}
                    {intervalo.hora_fim && ` - ${format(new Date(intervalo.hora_fim), "HH:mm", { locale: ptBR })}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
