import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  Eye,
  EyeOff,
  Car,
  CheckSquare,
  XSquare,
  FileCheck,
  Pause,
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

// Tipos de filtro disponíveis
type TipoFiltro = 
  | "trajeto_gps"
  | "os_executada"
  | "os_pendente"
  | "os_impedida"
  | "inicio_turno"
  | "fim_turno"
  | "intervalo"
  | "inicio_deslocamento"
  | "fim_deslocamento"
  | "inicio_servico"
  | "apr"
  | "fim_servico"
  | "os_prevista";

// Configuração visual dos tipos de ponto
const TIPOS_CONFIG: Record<TipoFiltro, {
  label: string;
  cor: string;
  corBorda: string;
  tamanho: number;
  icone: string;
  grupo: "os" | "evento" | "gps";
}> = {
  trajeto_gps: { 
    label: "Trajeto GPS", 
    cor: "#3b82f6", 
    corBorda: "#2563eb",
    tamanho: 10,
    icone: "📍",
    grupo: "gps",
  },
  os_executada: { 
    label: "OS Executada", 
    cor: "#22c55e", 
    corBorda: "#16a34a",
    tamanho: 28,
    icone: "✅",
    grupo: "os",
  },
  os_pendente: { 
    label: "OS Pendente", 
    cor: "#f59e0b", 
    corBorda: "#d97706",
    tamanho: 28,
    icone: "⏳",
    grupo: "os",
  },
  os_impedida: { 
    label: "OS Impedida", 
    cor: "#ef4444", 
    corBorda: "#dc2626",
    tamanho: 28,
    icone: "❌",
    grupo: "os",
  },
  os_prevista: { 
    label: "OS Prevista (Coord. Original)", 
    cor: "#8b5cf6", 
    corBorda: "#7c3aed",
    tamanho: 26,
    icone: "📌",
    grupo: "os",
  },
  inicio_turno: { 
    label: "Início Turno", 
    cor: "#10b981", 
    corBorda: "#059669",
    tamanho: 32,
    icone: "▶",
    grupo: "evento",
  },
  fim_turno: { 
    label: "Fim Turno", 
    cor: "#ef4444", 
    corBorda: "#dc2626",
    tamanho: 32,
    icone: "◼",
    grupo: "evento",
  },
  intervalo: { 
    label: "Intervalos", 
    cor: "#ec4899", 
    corBorda: "#db2777",
    tamanho: 28,
    icone: "☕",
    grupo: "evento",
  },
  inicio_deslocamento: { 
    label: "Início Deslocamento", 
    cor: "#06b6d4", 
    corBorda: "#0891b2",
    tamanho: 26,
    icone: "🚗",
    grupo: "evento",
  },
  fim_deslocamento: { 
    label: "Fim Deslocamento", 
    cor: "#0ea5e9", 
    corBorda: "#0284c7",
    tamanho: 26,
    icone: "🏁",
    grupo: "evento",
  },
  inicio_servico: { 
    label: "Início Serviço", 
    cor: "#f97316", 
    corBorda: "#ea580c",
    tamanho: 26,
    icone: "🔧",
    grupo: "evento",
  },
  apr: { 
    label: "APR", 
    cor: "#eab308", 
    corBorda: "#ca8a04",
    tamanho: 26,
    icone: "📋",
    grupo: "evento",
  },
  fim_servico: { 
    label: "Fim Serviço", 
    cor: "#84cc16", 
    corBorda: "#65a30d",
    tamanho: 26,
    icone: "✓",
    grupo: "evento",
  },
};

interface PontoMapa {
  id: string;
  tipo: TipoFiltro;
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
    eventoTipo?: string;
    sigla?: string;
  };
}

// Função para obter sigla do tipo de serviço
const obterSiglaTipo = (tipo: string): string => {
  const tipoUpper = (tipo || "").toUpperCase();
  
  // Grupo Cobrança: Corte, Recorte
  if (tipoUpper.includes('CORTE') || tipoUpper.includes('RECORTE')) {
    return 'C';
  }
  // Grupo Religação: Religa
  if (tipoUpper.includes('RELIGA')) {
    return 'R';
  }
  // Grupo Ligação: Ligação nova
  if (tipoUpper.includes('LIGACAO') || tipoUpper.includes('LIGAÇÃO')) {
    return 'L';
  }
  // Grupo Manutenção: Manutenção, Reparo, Conserto
  if (tipoUpper.includes('MANUTEN') || tipoUpper.includes('REPARO') || tipoUpper.includes('CONSERTO')) {
    return 'M';
  }
  // Grupo Vistoria: Vistoria, Inspeção
  if (tipoUpper.includes('VISTORIA') || tipoUpper.includes('INSPEC')) {
    return 'V';
  }
  // Grupo Instalação: Instalar, Troca
  if (tipoUpper.includes('INSTALA') || tipoUpper.includes('TROCA')) {
    return 'I';
  }
  // Grupo Análise: Análise, Verificação
  if (tipoUpper.includes('ANALISE') || tipoUpper.includes('ANÁLISE') || tipoUpper.includes('VERIFIC')) {
    return 'A';
  }
  // Default: primeira letra do tipo
  return tipo ? tipo.charAt(0).toUpperCase() : '?';
};

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
  const [pontoSelecionado, setPontoSelecionado] = useState<string | null>(null);

  // Estados de filtro - todos marcados por padrão
  const [filtrosVisiveis, setFiltrosVisiveis] = useState<Record<TipoFiltro, boolean>>({
    trajeto_gps: true,
    os_executada: true,
    os_pendente: true,
    os_impedida: true,
    os_prevista: true,
    inicio_turno: true,
    fim_turno: true,
    intervalo: true,
    inicio_deslocamento: true,
    fim_deslocamento: true,
    inicio_servico: true,
    apr: true,
    fim_servico: true,
  });

  // Função para alternar filtro individual
  const toggleFiltro = useCallback((tipo: TipoFiltro) => {
    setFiltrosVisiveis(prev => ({ ...prev, [tipo]: !prev[tipo] }));
  }, []);

  // Função para marcar/desmarcar todos
  const toggleTodosFiltros = useCallback((marcar: boolean) => {
    const novosFiltros: Record<TipoFiltro, boolean> = {} as Record<TipoFiltro, boolean>;
    Object.keys(filtrosVisiveis).forEach(key => {
      novosFiltros[key as TipoFiltro] = marcar;
    });
    setFiltrosVisiveis(novosFiltros);
  }, [filtrosVisiveis]);

  // Verificar se todos estão marcados ou desmarcados
  const todosAtivos = useMemo(() => 
    Object.values(filtrosVisiveis).every(v => v), [filtrosVisiveis]);
  const todosInativos = useMemo(() => 
    Object.values(filtrosVisiveis).every(v => !v), [filtrosVisiveis]);

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
              tipo: "trajeto_gps",
              latitude: p.latitude,
              longitude: p.longitude,
              timestamp: p.recorded_at,
              label: format(new Date(p.recorded_at), "HH:mm:ss"),
              detalhes: { velocidade: p.speed_mps },
            });
          }
        });
      }

      // 2. Buscar OSs planejadas para o dia (coordenadas previstas originais)
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

      const osIdsAdicionadas = new Set<string>();

      if (osPlanejadas) {
        osPlanejadas.forEach((po: any) => {
          const os = po.ordens_servico;
          if (os && os.latitude && os.longitude) {
            let tipoOS: TipoFiltro = "os_pendente";
            if (os.status === "concluida") {
              tipoOS = "os_executada";
            } else if (os.status === "impedida" || os.status === "cancelada") {
              tipoOS = "os_impedida";
            }

            // Adicionar como OS (status atual)
            pontos.push({
              id: `os-${os.id}`,
              tipo: tipoOS,
              latitude: os.latitude,
              longitude: os.longitude,
              timestamp: dataInicio,
              label: os.numero,
              detalhes: {
                osNumero: os.numero,
                osTipo: os.tipo,
                osEndereco: os.endereco,
                osStatus: os.status,
                sigla: obterSiglaTipo(os.tipo),
              },
            });
            osIdsAdicionadas.add(os.id);

            // Adicionar também como OS Prevista (para mostrar coordenadas originais)
            pontos.push({
              id: `os-prevista-${os.id}`,
              tipo: "os_prevista",
              latitude: os.latitude,
              longitude: os.longitude,
              timestamp: dataInicio,
              label: `Prevista: ${os.numero}`,
              detalhes: {
                osNumero: os.numero,
                osTipo: os.tipo,
                osEndereco: os.endereco,
                osStatus: "planejada",
                sigla: obterSiglaTipo(os.tipo),
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
          if (os && os.latitude && os.longitude && !osIdsAdicionadas.has(os.id)) {
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
                sigla: obterSiglaTipo(os.tipo),
              },
            });
            osIdsAdicionadas.add(os.id);
          }
        });
      }

      // 4. Buscar eventos do turno (início/fim turno, serviços, etc.)
      try {
        const { data: eventos } = await supabase
          .from("turno_eventos")
          .select("*")
          .eq("turno_id", turnoId)
          .order("created_at");

        if (eventos) {
          eventos.forEach((evento: any) => {
            if (evento.latitude && evento.longitude) {
              let tipoEvento: TipoFiltro | null = null;
              
              switch (evento.tipo_evento) {
                case "inicio_turno":
                  tipoEvento = "inicio_turno";
                  break;
                case "fim_turno":
                  tipoEvento = "fim_turno";
                  break;
                case "inicio_intervalo":
                case "fim_intervalo":
                  tipoEvento = "intervalo";
                  break;
                case "inicio_deslocamento":
                  tipoEvento = "inicio_deslocamento";
                  break;
                case "fim_deslocamento":
                  tipoEvento = "fim_deslocamento";
                  break;
                case "inicio_servico":
                  tipoEvento = "inicio_servico";
                  break;
                case "apr":
                  tipoEvento = "apr";
                  break;
                case "fim_servico":
                  tipoEvento = "fim_servico";
                  break;
              }

              if (tipoEvento) {
                pontos.push({
                  id: `evento-${evento.id}`,
                  tipo: tipoEvento,
                  latitude: evento.latitude,
                  longitude: evento.longitude,
                  timestamp: evento.created_at,
                  label: TIPOS_CONFIG[tipoEvento].label,
                  detalhes: {
                    eventoTipo: evento.tipo_evento,
                    osNumero: evento.os_numero,
                  },
                });
              }
            }
          });
        }
      } catch (e) {
        console.log("[TurnoTrajetoMap] turno_eventos não disponível:", e);
      }

      // 5. Buscar intervalos
      const { data: intervalos } = await supabase
        .from("intervalos_equipe")
        .select("id, hora_inicio, hora_fim, tipo_intervalo:tipo_intervalo_id(nome)")
        .eq("turno_id", turnoId)
        .order("hora_inicio");

      // Estatísticas
      const osExecutadas = pontos.filter(p => p.tipo === "os_executada").length;
      const osPendentes = pontos.filter(p => p.tipo === "os_pendente").length;
      const osImpedidas = pontos.filter(p => p.tipo === "os_impedida").length;
      const totalPosicoes = pontos.filter(p => p.tipo === "trajeto_gps").length;
      const totalIntervalos = intervalos?.length || 0;
      const totalEventos = pontos.filter(p => TIPOS_CONFIG[p.tipo].grupo === "evento").length;

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
          totalEventos,
        },
      };
    },
    enabled: !!turnoId && !!equipeId,
  });

  // Pontos filtrados para exibição
  const pontosFiltrados = useMemo(() => {
    if (!dadosTurno?.pontos) return [];
    
    return dadosTurno.pontos.filter(ponto => {
      return filtrosVisiveis[ponto.tipo];
    });
  }, [dadosTurno?.pontos, filtrosVisiveis]);

  // Coordenadas do trajeto (apenas GPS)
  const coordenadasTrajeto = useMemo(() => {
    if (!dadosTurno?.pontos || !filtrosVisiveis.trajeto_gps) return [];
    return dadosTurno.pontos
      .filter(p => p.tipo === "trajeto_gps")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(p => [p.latitude, p.longitude] as [number, number]);
  }, [dadosTurno?.pontos, filtrosVisiveis.trajeto_gps]);

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
    if (filtrosVisiveis.trajeto_gps && coordenadasTrajeto.length > 1) {
      trajetoLayerRef.current = L.polyline(coordenadasTrajeto, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
    }

    // Adicionar marcadores
    const bounds: [number, number][] = [];

    // Primeiro, adicionar OSs com ícones CIRCULARES como no MapaLeaflet
    pontosFiltrados
      .filter(p => p.tipo.startsWith("os_") && p.tipo !== "os_prevista")
      .forEach(ponto => {
        const config = TIPOS_CONFIG[ponto.tipo as TipoFiltro];
        const isSelected = pontoSelecionado === ponto.id;
        const tamanho = isSelected ? config.tamanho + 8 : config.tamanho;
        const sigla = ponto.detalhes?.sigla || ponto.detalhes?.osNumero?.slice(-3) || "?";

        // Ícone CIRCULAR como no MapaLeaflet
        const icon = L.divIcon({
          className: "custom-os-marker",
          html: `
            <div style="
              width: ${tamanho}px;
              height: ${tamanho}px;
              background-color: ${config.cor};
              border: ${isSelected ? '3px solid #000' : `2px solid ${config.corBorda}`};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: ${isSelected ? '0 4px 12px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.3)'};
              font-weight: bold;
              font-size: ${sigla.length > 2 ? '10px' : '11px'};
              color: white;
              text-shadow: 0 1px 2px rgba(0,0,0,0.5);
              ${isSelected ? 'transform: scale(1.1); z-index: 9999;' : ''}
            ">
              ${sigla}
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
              <span style="font-size: 20px;">${config.icone}</span>
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

    // Adicionar OSs Previstas (coordenadas originais) - ícone diferente com borda tracejada
    pontosFiltrados
      .filter(p => p.tipo === "os_prevista")
      .forEach(ponto => {
        const config = TIPOS_CONFIG.os_prevista;
        const tamanho = config.tamanho;
        const sigla = ponto.detalhes?.sigla || "?";

        const icon = L.divIcon({
          className: "custom-os-prevista-marker",
          html: `
            <div style="
              width: ${tamanho}px;
              height: ${tamanho}px;
              background-color: ${config.cor}40;
              border: 2px dashed ${config.corBorda};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 10px;
              color: ${config.corBorda};
            ">
              ${sigla}
            </div>
          `,
          iconSize: [tamanho, tamanho],
          iconAnchor: [tamanho / 2, tamanho / 2],
        });

        const marker = L.marker([ponto.latitude, ponto.longitude], { icon });
        marker.bindPopup(`
          <div style="font-family: system-ui; padding: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px; color: ${config.corBorda};">
              📌 Coordenada Prevista
            </div>
            <div style="font-size: 12px;">OS: ${ponto.detalhes?.osNumero}</div>
            <div style="font-size: 11px; color: #6b7280;">${ponto.detalhes?.osTipo}</div>
          </div>
        `);

        marker.addTo(markersLayerRef.current!);
      });

    // Adicionar eventos (início/fim turno, serviços, intervalos, etc.)
    pontosFiltrados
      .filter(p => TIPOS_CONFIG[p.tipo].grupo === "evento")
      .forEach(ponto => {
        const config = TIPOS_CONFIG[ponto.tipo as TipoFiltro];
        const isSelected = pontoSelecionado === ponto.id;
        const tamanho = isSelected ? config.tamanho + 6 : config.tamanho;

        const icon = L.divIcon({
          className: "custom-evento-marker",
          html: `
            <div style="
              width: ${tamanho}px;
              height: ${tamanho}px;
              background: linear-gradient(135deg, ${config.cor} 0%, ${config.corBorda} 100%);
              border: ${isSelected ? '3px solid #000' : '2px solid white'};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: ${isSelected ? '0 4px 12px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.3)'};
              font-size: ${tamanho > 28 ? '14px' : '12px'};
              ${isSelected ? 'transform: scale(1.1); z-index: 9999;' : ''}
            ">
              ${config.icone}
            </div>
          `,
          iconSize: [tamanho, tamanho],
          iconAnchor: [tamanho / 2, tamanho / 2],
        });

        const marker = L.marker([ponto.latitude, ponto.longitude], { icon });
        marker.bindPopup(`
          <div style="font-family: system-ui; padding: 4px;">
            <div style="
              display: flex;
              align-items: center;
              gap: 8px;
              font-weight: 600;
              margin-bottom: 6px;
              color: ${config.corBorda};
            ">
              <span style="font-size: 18px;">${config.icone}</span>
              ${config.label}
            </div>
            <div style="font-size: 12px; color: #6b7280;">
              ${format(new Date(ponto.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
            </div>
            ${ponto.detalhes?.osNumero ? `
              <div style="font-size: 11px; margin-top: 4px;">
                OS: ${ponto.detalhes.osNumero}
              </div>
            ` : ''}
          </div>
        `);

        marker.on("click", () => {
          setPontoSelecionado(ponto.id);
        });

        marker.addTo(markersLayerRef.current!);
        bounds.push([ponto.latitude, ponto.longitude]);
      });

    // Adicionar pontos GPS (menores, apenas para referência visual)
    if (filtrosVisiveis.trajeto_gps) {
      const pontosGPS = pontosFiltrados.filter(p => p.tipo === "trajeto_gps");
      const step = Math.max(1, Math.floor(pontosGPS.length / 20));

      pontosGPS.forEach((ponto, index) => {
        if (index !== 0 && index !== pontosGPS.length - 1 && index % step !== 0) return;

        const config = TIPOS_CONFIG.trajeto_gps;
        const isFirst = index === 0;
        const isLast = index === pontosGPS.length - 1;
        const tamanho = isFirst || isLast ? 22 : config.tamanho;
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
              ${isFirst ? '<span style="font-size: 10px; color: white;">▶</span>' : ''}
              ${isLast ? '<span style="font-size: 10px; color: white;">◼</span>' : ''}
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
  }, [pontosFiltrados, coordenadasTrajeto, pontoSelecionado, mapaInicializado, filtrosVisiveis]);

  // Função para centralizar em um ponto
  const centralizarEmPonto = useCallback((ponto: PontoMapa) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    setPontoSelecionado(ponto.id);
    map.setView([ponto.latitude, ponto.longitude], 17, { animate: true });
  }, []);

  // Contar pontos por tipo
  const contagemPorTipo = useMemo(() => {
    if (!dadosTurno?.pontos) return {} as Record<TipoFiltro, number>;
    
    const contagem: Partial<Record<TipoFiltro, number>> = {};
    dadosTurno.pontos.forEach(p => {
      contagem[p.tipo] = (contagem[p.tipo] || 0) + 1;
    });
    return contagem as Record<TipoFiltro, number>;
  }, [dadosTurno?.pontos]);

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

  // Agrupar filtros por categoria
  const filtrosOS: TipoFiltro[] = ["os_executada", "os_pendente", "os_impedida", "os_prevista"];
  const filtrosEventos: TipoFiltro[] = ["inicio_turno", "fim_turno", "intervalo", "inicio_deslocamento", "fim_deslocamento", "inicio_servico", "apr", "fim_servico"];

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
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{estatisticas?.totalEventos || 0}</div>
            <div className="text-xs text-purple-600">📋 Eventos</div>
          </CardContent>
        </Card>
      </div>

      {/* Painel de Filtros */}
      <div className="border rounded-lg bg-muted/30">
        <div className="p-3 border-b flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Filtros de Visualização
          </h4>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => toggleTodosFiltros(true)}
              disabled={todosAtivos}
              className="text-xs"
            >
              <CheckSquare className="h-3 w-3 mr-1" />
              Marcar Tudo
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => toggleTodosFiltros(false)}
              disabled={todosInativos}
              className="text-xs"
            >
              <XSquare className="h-3 w-3 mr-1" />
              Desmarcar Tudo
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              Atualizar
            </Button>
          </div>
        </div>
        
        <div className="p-3 space-y-4">
          {/* GPS */}
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Route className="h-3 w-3" />
              TRAJETO
            </h5>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={filtrosVisiveis.trajeto_gps}
                  onCheckedChange={() => toggleFiltro("trajeto_gps")}
                />
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: TIPOS_CONFIG.trajeto_gps.cor }}
                />
                <span className="text-sm">Trajeto GPS</span>
                <Badge variant="secondary" className="text-xs">
                  {contagemPorTipo.trajeto_gps || 0}
                </Badge>
              </label>
            </div>
          </div>

          {/* OSs */}
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Target className="h-3 w-3" />
              ORDENS DE SERVIÇO
            </h5>
            <div className="flex flex-wrap gap-3">
              {filtrosOS.map(tipo => (
                <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox 
                    checked={filtrosVisiveis[tipo]}
                    onCheckedChange={() => toggleFiltro(tipo)}
                  />
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ 
                      backgroundColor: tipo === "os_prevista" ? `${TIPOS_CONFIG[tipo].cor}40` : TIPOS_CONFIG[tipo].cor,
                      border: tipo === "os_prevista" ? `2px dashed ${TIPOS_CONFIG[tipo].corBorda}` : undefined,
                    }}
                  />
                  <span className="text-sm">{TIPOS_CONFIG[tipo].label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {contagemPorTipo[tipo] || 0}
                  </Badge>
                </label>
              ))}
            </div>
          </div>

          {/* Eventos */}
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              EVENTOS DO TURNO
            </h5>
            <div className="flex flex-wrap gap-3">
              {filtrosEventos.map(tipo => (
                <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox 
                    checked={filtrosVisiveis[tipo]}
                    onCheckedChange={() => toggleFiltro(tipo)}
                  />
                  <div 
                    className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: TIPOS_CONFIG[tipo].cor }}
                  >
                    {TIPOS_CONFIG[tipo].icone}
                  </div>
                  <span className="text-sm">{TIPOS_CONFIG[tipo].label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {contagemPorTipo[tipo] || 0}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legenda compacta */}
      <div className="flex flex-wrap gap-3 px-2 text-xs">
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
        <div className="flex items-center gap-1 border-l pl-3">
          <span className="text-muted-foreground">Círculos: OSs com sigla do tipo</span>
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
              .filter(p => p.tipo.startsWith("os_") && p.tipo !== "os_prevista")
              .map(ponto => {
                const config = TIPOS_CONFIG[ponto.tipo as TipoFiltro];
                const isSelected = pontoSelecionado === ponto.id;
                const sigla = ponto.detalhes?.sigla || ponto.detalhes?.osNumero?.slice(-3) || "?";
                
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
                      className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                      style={{ backgroundColor: config.cor }}
                    >
                      {sigla}
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
            
            {pontosFiltrados.filter(p => p.tipo.startsWith("os_") && p.tipo !== "os_prevista").length === 0 && (
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
