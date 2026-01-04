import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { MapPin, Loader2, Maximize2, Minimize2, Filter, X, Edit, Save, XCircle } from "lucide-react";

// Função de debounce para otimização de performance
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrdemServico, Equipe } from "@/data/mockData";
import { RotaEquipe, calcularExpectativaEquipesPorTerritorio, ExpectativaTerritorio } from "@/lib/routingUtils";
import { buscarRotaOSRM, RouteGeometry } from "@/services/osrm";
import { getDadosSkills } from "@/lib/skillsUtils";
import { pontoNoPoligono } from "@/types/territorios";

// Importar Leaflet diretamente (não dinâmico)
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Importar camada de canvas para renderização ultra-performática
import { CanvasMarkersLayer, CanvasMarker, createCanvasMarkersLayer } from "@/lib/canvasMarkersLayer";

// Fix para ícones
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

// Constantes de otimização - carregamento em chunks para não travar a UI
const CHUNK_SIZE = 500; // Marcadores por chunk
const CHUNK_DELAY = 10; // ms entre chunks

import { Territorio } from "@/types/territorios";

interface MapaLeafletProps {
  rotas: RotaEquipe[];
  osPendentes: OrdemServico[];
  equipesMock: Equipe[];
  equipeHovered?: string | null; // ID da equipe em hover
  equipeEditando?: string | null; // ID da equipe sendo editada (destacar no mapa)
  osSelecionada?: string | null; // ID da OS selecionada no mapa
  osSelecionadaNoEditor?: string | null; // ID da OS selecionada no editor de rotas
  onOSSelecionada?: (osId: string | null) => void; // Callback quando OS é selecionada no mapa
  territorios?: Territorio[]; // Territórios para mostrar no mapa
  onTerritorioEditado?: (territorioId: string, novoPoligono: { lat: number; lng: number }[]) => void; // Callback para salvar território editado
  osUrgenteDestaque?: OrdemServico | null; // V19.6: OS urgente fora do território para destacar (única)
  osUrgentesDestaque?: OrdemServico[]; // V19.7: Array de OSs urgentes fora do território para destacar (múltiplas)
  onOsUrgenteDestaqueClear?: () => void; // V19.6: Callback para limpar destaque
}

interface RouteGeometryData {
  [equipeId: string]: RouteGeometry | null; // null = ainda carregando
}

/**
 * Obtém o SVG do ícone Lucide React como string
 * Usa uma abordagem de renderização temporária
 */
function getLucideIconSVG(iconName: string | undefined, color: string, size: number = 16): string {
  // Mapeamento de alguns ícones comuns para seus paths SVG
  const iconPaths: Record<string, string> = {
    MapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>',
    Zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
    Wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>',
    Scissors: '<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>',
    CheckCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    AlertCircle: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
    Wifi: '<path d="M12 20h.01"></path><path d="M8.5 16.429a5 5 0 0 1 7 0"></path><path d="M5 12.859a10 10 0 0 1 5.17-2.69"></path><path d="M19 12.859a10 10 0 0 0-2.007-1.523"></path><path d="M2 8.82a15 15 0 0 1 4.177-1.889"></path><path d="M22 8.82a15 15 0 0 0-11.288-3.764"></path>',
    Power: '<path d="M12 2v10"></path><path d="M18.364 5.636a9 9 0 1 1-12.728 0"></path>',
    Plug: '<path d="M12 22v-4"></path><path d="M9 2v4"></path><path d="M15 2v4"></path><path d="M6 8h12"></path><path d="M6 12h12"></path><path d="M6 16h12"></path>',
    Droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-2.5-5.5S13 6 12 6s-2.5 1.5-4.5 3.5S5 13 5 15a7 7 0 0 0 7 7z"></path>',
    Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    Settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>',
  };
  
  const path = iconPaths[iconName || 'MapPin'] || iconPaths.MapPin;
  
  // Usar a cor fornecida ao invés de sempre branco
  return `
    <svg width="${size * 0.8}" height="${size * 0.8}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      ${path}
    </svg>
  `;
}

export default function MapaLeaflet({ rotas, osPendentes, equipesMock, equipeHovered, equipeEditando, osSelecionada, osSelecionadaNoEditor, onOSSelecionada, territorios = [], onTerritorioEditado, osUrgenteDestaque, osUrgentesDestaque, onOsUrgenteDestaqueClear }: MapaLeafletProps) {
  // Debug: log quando rotas mudarem
  useEffect(() => {
    console.log('[MAPA] Props recebidas - Rotas:', rotas.length, 'OSs Pendentes:', osPendentes.length);
    if (rotas.length > 0) {
      console.log('[MAPA] Primeira rota:', {
        equipe: rotas[0].equipe.codigo,
        servicos: rotas[0].servicos.length,
        servicosValidos: rotas[0].servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico).length
      });
    }
  }, [rotas, osPendentes]);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const territoriosLayersRef = useRef<L.Polygon[]>([]);
  const expectativasMarkersRef = useRef<L.Marker[]>([]);
  
  // Ref para camada de canvas (renderização ultra-performática)
  const canvasLayerRef = useRef<CanvasMarkersLayer | null>(null);
  const [erro, setErro] = useState(false);
  const [erroMsg, setErroMsg] = useState("");
  const [routesGeometry, setRoutesGeometry] = useState<RouteGeometryData>({});
  const [calculandoRotas, setCalculandoRotas] = useState(false);
  const [skillsIcons, setSkillsIcons] = useState<Map<string, string>>(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEquipe, setFiltroEquipe] = useState<string>("todos");
  const [filtroRegulada, setFiltroRegulada] = useState<string>("todos");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [selectAberto, setSelectAberto] = useState<string | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const osSequenciaRef = useRef<Array<{ os: OrdemServico; rota?: RotaEquipe; servico?: any; index: number }>>([]);
  
  // Estados para edição de polígonos
  const [modoEdicao, setModoEdicao] = useState(false);
  const [territorioEditando, setTerritorioEditando] = useState<string | null>(null);
  const verticesEditaveisRef = useRef<L.Marker[]>([]);
  const polygonEditandoRef = useRef<L.Polygon | null>(null);
  const territorioOriginalRef = useRef<Territorio | null>(null);
  
  // V19.7: Estado para controlar se o mapa foi inicializado
  const [mapaInicializado, setMapaInicializado] = useState(false);
  
  // OTIMIZAÇÃO: Debounce nas OSs pendentes para evitar re-renderizações frequentes
  // Quando há 8000+ OSs, cada mudança pequena causaria re-renderização pesada
  const osPendentesDebounced = useDebounce(osPendentes, 300);
  
  // V19.6: Ref para o marker da OS urgente destacada
  const osUrgenteMarkerRef = useRef<L.Marker | null>(null);
  const osUrgenteCircleRef = useRef<L.Circle | null>(null);
  
  // V19.7: Refs para múltiplas OSs urgentes destacadas
  const osUrgentesMarkersRef = useRef<L.Marker[]>([]);
  const osUrgentesCirclesRef = useRef<L.Circle[]>([]);
  
  // V19.6: Efeito para centralizar e destacar OS urgente quando selecionada
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapaInicializado) return;
    
    // Limpar destaque anterior
    if (osUrgenteMarkerRef.current) {
      map.removeLayer(osUrgenteMarkerRef.current);
      osUrgenteMarkerRef.current = null;
    }
    if (osUrgenteCircleRef.current) {
      map.removeLayer(osUrgenteCircleRef.current);
      osUrgenteCircleRef.current = null;
    }
    
    if (osUrgenteDestaque) {
      console.log('[MAPA] Destacando OS urgente:', osUrgenteDestaque.numero);
      
      // Criar círculo pulsante ao redor da OS
      const circle = L.circle([osUrgenteDestaque.latitude, osUrgenteDestaque.longitude], {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.2,
        radius: 500,
        weight: 3,
        dashArray: '10, 5',
        className: 'pulse-animation'
      }).addTo(map);
      osUrgenteCircleRef.current = circle;
      
      // Criar ícone especial para a OS urgente
      const urgentIcon = L.divIcon({
        className: 'custom-urgent-marker',
        html: `
          <div style="
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bounce 1s ease infinite;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      });
      
      // Criar marker especial
      const marker = L.marker([osUrgenteDestaque.latitude, osUrgenteDestaque.longitude], {
        icon: urgentIcon,
        zIndexOffset: 10000
      }).addTo(map);
      
      // Adicionar popup com informações
      const ehReliga = osUrgenteDestaque.tipo.toUpperCase() === 'RELIGA';
      const ehRegulada = osUrgenteDestaque.regulada === true;
      const prazoStr = osUrgenteDestaque.prazo 
        ? new Date(osUrgenteDestaque.prazo).toLocaleString("pt-BR")
        : 'N/A';
      
      marker.bindPopup(`
        <div style="min-width: 280px; font-family: system-ui;">
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 12px; margin: -10px -10px 10px -10px; border-radius: 4px 4px 0 0;">
            <div style="font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px;">
              ⚠️ OS URGENTE FORA DO TERRITÓRIO
            </div>
          </div>
          <div style="padding: 0 4px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-weight: 700; font-size: 16px;">${osUrgenteDestaque.numero}</span>
              <span style="background: ${ehReliga ? '#9333ea' : ehRegulada ? '#f97316' : '#ef4444'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                ${ehReliga ? 'RELIGA' : ehRegulada ? 'REGULADA' : osUrgenteDestaque.tipo}
              </span>
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 6px;">
              📍 ${osUrgenteDestaque.endereco}
            </div>
            <div style="font-size: 12px; color: #ef4444; font-weight: 600; margin-bottom: 8px;">
              ⏰ Prazo: ${prazoStr}
            </div>
            <div style="font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 8px;">
              Coordenadas: ${osUrgenteDestaque.latitude.toFixed(5)}, ${osUrgenteDestaque.longitude.toFixed(5)}
            </div>
          </div>
        </div>
      `, {
        maxWidth: 350,
        className: 'urgent-popup'
      }).openPopup();
      
      osUrgenteMarkerRef.current = marker;
      
      // Centralizar mapa na OS com zoom adequado
      map.flyTo([osUrgenteDestaque.latitude, osUrgenteDestaque.longitude], 16, {
        animate: true,
        duration: 1.5
      });
    }
  }, [osUrgenteDestaque, mapaInicializado]);

  // V19.7: Efeito para destacar MÚLTIPLAS OSs urgentes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapaInicializado) return;
    
    // Limpar destaques anteriores de múltiplas OSs
    osUrgentesMarkersRef.current.forEach(marker => {
      try { map.removeLayer(marker); } catch(e) {}
    });
    osUrgentesMarkersRef.current = [];
    
    osUrgentesCirclesRef.current.forEach(circle => {
      try { map.removeLayer(circle); } catch(e) {}
    });
    osUrgentesCirclesRef.current = [];
    
    // Se temos múltiplas OSs para destacar (e não há uma única OS selecionada)
    if (osUrgentesDestaque && osUrgentesDestaque.length > 0 && !osUrgenteDestaque) {
      const markers: L.Marker[] = [];
      const circles: L.Circle[] = [];
      
      // Filtrar OSs com coordenadas válidas
      const ossValidas = osUrgentesDestaque.filter(os => 
        os.latitude && os.longitude && !isNaN(os.latitude) && !isNaN(os.longitude)
      );
      
      ossValidas.forEach((os, index) => {
        const ehReliga = os.tipo.toUpperCase() === 'RELIGA';
        const ehRegulada = os.regulada === true;
        const cor = ehReliga ? '#9333ea' : ehRegulada ? '#f97316' : '#ef4444';
        
        // Criar círculo pulsante
        const circle = L.circle([os.latitude, os.longitude], {
          color: cor,
          fillColor: cor,
          fillOpacity: 0.2,
          radius: 300,
          weight: 3,
          dashArray: '8, 4'
        }).addTo(map);
        circles.push(circle);
        
        // Criar ícone especial
        const urgentIcon = L.divIcon({
          className: '',
          html: `
            <div style="
              background: ${cor};
              width: 32px;
              height: 32px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <div style="
                position: absolute;
                top: -6px;
                right: -6px;
                background: white;
                color: ${cor};
                border-radius: 50%;
                width: 16px;
                height: 16px;
                font-size: 9px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ">${index + 1}</div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });
        
        // Criar marker
        const marker = L.marker([os.latitude, os.longitude], {
          icon: urgentIcon,
          zIndexOffset: 8000 + index
        }).addTo(map);
        
        // Popup simples
        const prazoStr = os.prazo ? new Date(os.prazo).toLocaleString("pt-BR") : 'N/A';
        marker.bindPopup(`
          <div style="font-family: system-ui; min-width: 200px;">
            <div style="background: ${cor}; color: white; padding: 8px; margin: -10px -10px 8px; border-radius: 4px 4px 0 0; font-weight: 600;">
              ⚠️ OS #${index + 1} - FORA DO TERRITÓRIO
            </div>
            <div style="font-weight: 700;">${os.numero}</div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">📍 ${os.endereco}</div>
            <div style="font-size: 12px; color: ${cor}; font-weight: 600; margin-top: 4px;">⏰ Prazo: ${prazoStr}</div>
          </div>
        `);
        
        markers.push(marker);
      });
      
      osUrgentesMarkersRef.current = markers;
      osUrgentesCirclesRef.current = circles;
      
      // Ajustar zoom
      if (ossValidas.length === 1) {
        map.flyTo([ossValidas[0].latitude, ossValidas[0].longitude], 16, { duration: 1 });
      } else if (ossValidas.length > 1) {
        const bounds = L.latLngBounds(ossValidas.map(os => [os.latitude, os.longitude] as [number, number]));
        map.flyToBounds(bounds.pad(0.2), { duration: 1, maxZoom: 15 });
      }
    }
  }, [osUrgentesDestaque, osUrgenteDestaque, mapaInicializado]);

  // Função para limpar edição atual
  const limparEdicao = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remover marcadores de vértices
    verticesEditaveisRef.current.forEach((marker) => {
      map.removeLayer(marker);
    });
    verticesEditaveisRef.current = [];

    // Restaurar polígono original se existir
    if (polygonEditandoRef.current && territorioOriginalRef.current) {
      map.removeLayer(polygonEditandoRef.current);
      polygonEditandoRef.current = null;
      territorioOriginalRef.current = null;
    }

    setTerritorioEditando(null);
  };

  // Função para entrar em modo de edição
  const iniciarEdicao = (territorio: Territorio) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Limpar edição anterior se houver
    limparEdicao();

    // Salvar referência do território original
    territorioOriginalRef.current = territorio;
    setTerritorioEditando(territorio.id);

    // Criar polígono editável com estilo destacado
    const latlngs = territorio.poligono.map(
      (coord) => [coord.lat, coord.lng] as [number, number]
    );

    const polygon = L.polygon(latlngs, {
      color: territorio.cor,
      fillColor: territorio.cor,
      fillOpacity: 0.3,
      weight: 3,
      dashArray: "10, 5",
    });

    polygon.addTo(map);
    polygonEditandoRef.current = polygon;

    // Criar marcadores editáveis nos vértices
    territorio.poligono.forEach((coord, index) => {
      const vertexMarker = L.marker([coord.lat, coord.lng], {
        icon: L.divIcon({
          className: "custom-vertex-marker",
          html: `
            <div style="
              background-color: ${territorio.cor};
              width: 12px;
              height: 12px;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.5);
              cursor: move;
            "></div>
          `,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
        draggable: true,
      });

      // Atualizar polígono quando vértice é arrastado
      vertexMarker.on("drag", () => {
        if (!polygonEditandoRef.current) return;
        const newLatLng = vertexMarker.getLatLng();
        const currentLatlngs = polygonEditandoRef.current.getLatLngs()[0] as L.LatLng[];
        const newLatlngs = currentLatlngs.map((ll, i) => 
          i === index ? [newLatLng.lat, newLatLng.lng] as [number, number] : [ll.lat, ll.lng] as [number, number]
        );
        polygonEditandoRef.current.setLatLngs(newLatlngs);
      });

      vertexMarker.addTo(map);
      verticesEditaveisRef.current.push(vertexMarker);
    });
  };

  // Função para salvar edição
  const salvarEdicao = () => {
    const map = mapInstanceRef.current;
    if (!map || !polygonEditandoRef.current || !territorioOriginalRef.current || !onTerritorioEditado) return;

    const latlngs = polygonEditandoRef.current.getLatLngs()[0] as L.LatLng[];
    const novoPoligono = latlngs.map((ll) => ({
      lat: ll.lat,
      lng: ll.lng,
    }));

    // Chamar callback para salvar
    onTerritorioEditado(territorioOriginalRef.current.id, novoPoligono);

    // Limpar edição
    limparEdicao();
    setModoEdicao(false);
  };

  // Função para cancelar edição
  const cancelarEdicao = () => {
    limparEdicao();
    setModoEdicao(false);
  };

  // Adicionar animações CSS e estilos para tooltips otimizados
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.id = 'leaflet-custom-animations';
    styleTag.innerHTML = `
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
        }
        50% {
          transform: scale(1.05);
          box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
        }
      }
      @keyframes pulse-blue {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.8);
        }
        50% {
          transform: scale(1.08);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 1);
        }
      }
      /* Estilos otimizados para tooltips de OSs */
      .os-tooltip {
        background: rgba(0,0,0,0.85);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      }
      .os-tooltip::before {
        border-top-color: rgba(0,0,0,0.85);
      }
      /* Marcadores pendentes */
      .custom-marker-pendente {
        background: transparent !important;
      }
    `;
    if (!document.getElementById('leaflet-custom-animations')) {
      document.head.appendChild(styleTag);
    }
    return () => {
      const existingTag = document.getElementById('leaflet-custom-animations');
      if (existingTag) existingTag.remove();
    };
  }, []);

  // useEffect para inicializar o mapa (apenas uma vez)
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      // Criar mapa com preferCanvas para melhor performance
      const map = L.map(mapRef.current, {
        center: [-14.8661, -40.8394], // Vitória da Conquista, BA
        zoom: 12,
        preferCanvas: true, // Usar canvas ao invés de SVG (muito mais rápido)
      });

      // Adicionar tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapaInicializado(true); // V19.7: Marcar mapa como inicializado
    } catch (error) {
      console.error("Erro ao criar mapa:", error);
      setErroMsg(error instanceof Error ? error.message : String(error));
      setErro(true);
    }

    return () => {
      // Limpar camada de canvas
      if (canvasLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(canvasLayerRef.current);
        canvasLayerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapaInicializado(false);
      }
    };
  }, []);

  // Função auxiliar para classificar prazo
  const classificarPrazo = (prazo: Date | null | undefined): 'sem_prazo' | 'futuro' | 'amanha' | 'hoje' | 'passado' => {
    if (!prazo) return 'sem_prazo';
    
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const prazoDia = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
    
    const diffDias = Math.floor((prazoDia.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDias < 0) return 'passado';
    if (diffDias === 0) return 'hoje';
    if (diffDias === 1) return 'amanha';
    return 'futuro';
  };

  // Função auxiliar para verificar se é regulada
  const ehOSRegulada = (os: OrdemServico): boolean => {
    const tipoUpper = os.tipo.toUpperCase();
    const tiposRegulados = ['CORTE', 'RELIGA', 'LIGACAO', 'LIGAÇÃO'];
    return tiposRegulados.some(t => tipoUpper.includes(t)) || os.regulada === true;
  };

  // Função auxiliar para verificar se é emergência
  const ehEmergencia = (os: OrdemServico): boolean => {
    const tipoUpper = os.tipo.toUpperCase();
    const tiposEmergencia = ['CORTE', 'RELIGA'];
    return tiposEmergencia.some(t => tipoUpper.includes(t));
  };

  // Função auxiliar para verificar se é regulada urgente
  const ehReguladaUrgente = (os: OrdemServico): boolean => {
    const classificacao = classificarPrazo(os.prazo);
    const regulada = ehOSRegulada(os);
    return regulada && ['hoje', 'passado'].includes(classificacao);
  };

  // Função auxiliar para determinar a cor da borda baseada na prioridade
  const obterCorBordaPrioridade = (os: OrdemServico): string => {
    const classificacao = classificarPrazo(os.prazo);
    const regulada = ehOSRegulada(os);
    const emergencia = ehEmergencia(os);
    const urgente = ehReguladaUrgente(os);
    
    // Urgentes: vermelho - reguladas vencidas ou vencendo hoje, ou emergências vencidas/vencendo hoje
    if (urgente) {
      return '#dc2626'; // Vermelho
    }
    
    // Emergências vencidas ou vencendo hoje também são urgentes
    if (emergencia && ['hoje', 'passado'].includes(classificacao)) {
      return '#dc2626'; // Vermelho
    }
    
    // Alta: preto - OSs com prazo de amanhã para frente (qualquer prazo futuro)
    if (os.prazo) {
      const agora = new Date();
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      const prazoDia = new Date(os.prazo.getFullYear(), os.prazo.getMonth(), os.prazo.getDate());
      const diffDias = Math.floor((prazoDia.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      // Se tem prazo futuro (amanhã ou qualquer dia no futuro)
      if (diffDias >= 1) {
        return '#000000'; // Preto para alta prioridade
      }
    }
    
    // Também incluir OSs não reguladas vencendo hoje/passado como alta
    if (!regulada && ['hoje', 'passado'].includes(classificacao)) {
      return '#000000'; // Preto
    }
    
    // Normal: cinza claro - OSs sem prazo ou com prazo muito distante
    return '#9ca3af'; // Cinza mais claro
  };

  // Função auxiliar para obter label formatado do tipo
  const obterLabelTipo = (tipo: string): string => {
    const tipoLabels: Record<string, string> = {
      corte: "Corte",
      religa: "Religa",
      ligacao: "Ligação Nova",
      inspecao: "Inspeção",
      inspeção: "Inspeção",
      manutencao: "Manutenção",
      manutenção: "Manutenção",
      troca_medidor: "Troca de Medidor",
      CORTE: "Corte",
      RELIGA: "Religa",
      LIGAÇÃO: "Ligação Nova",
      LIGACAO: "Ligação Nova",
      INSPEÇÃO: "Inspeção",
      INSPECAO: "Inspeção",
      MANUTENÇÃO: "Manutenção",
      MANUTENCAO: "Manutenção",
      TROCA_MEDIDOR: "Troca de Medidor",
    };
    
    if (tipoLabels[tipo]) return tipoLabels[tipo];
    const tipoLower = tipo.toLowerCase();
    if (tipoLabels[tipoLower]) return tipoLabels[tipoLower];
    const tipoUpper = tipo.toUpperCase();
    if (tipoLabels[tipoUpper]) return tipoLabels[tipoUpper];
    return tipo;
  };

  // Função auxiliar para converter tipo de OS para código de skill
  const tipoParaSkillCodigo = (tipo: string): string => {
    // Normalizar tipo para lowercase primeiro
    const tipoLower = tipo.toLowerCase();
    
    // Mapeamento direto de tipos comuns (usando códigos do banco sem acentos)
    const mapeamento: Record<string, string> = {
      'corte': 'CORTE',
      'religa': 'RELIGA',
      'ligacao': 'LIGACAO',
      'ligação': 'LIGACAO',
      'inspecao': 'INSPECAO',
      'inspeção': 'INSPECAO',
      'manutencao': 'MANUTENCAO',
      'manutenção': 'MANUTENCAO',
      'troca_medidor': 'TROCA_MEDIDOR',
    };
    
    if (mapeamento[tipoLower]) {
      return mapeamento[tipoLower];
    }
    
    // Se não encontrou no mapeamento, normalizar para uppercase e remover acentos
    return tipo.toUpperCase()
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÕÖ]/g, 'O')
      .replace(/[ÙÚÛÜ]/g, 'U')
      .replace(/[Ç]/g, 'C')
      .replace(/[Ñ]/g, 'N');
  };

  // Buscar ícones das Skills quando o componente montar
  useEffect(() => {
    const fetchSkillsIcons = async () => {
      try {
        // Coletar todos os tipos únicos de OSs (pendentes e alocadas)
        const tiposUnicos = new Set<string>();
        osPendentes.forEach(os => tiposUnicos.add(os.tipo));
        rotas.forEach(rota => {
          rota.servicos.forEach(servico => {
            if (servico.ordemServico) {
              tiposUnicos.add(servico.ordemServico.tipo);
            }
          });
        });
        
        if (tiposUnicos.size === 0) return;
        
        // Converter tipos para códigos de skills
        const codigosSkills = Array.from(tiposUnicos).map(tipo => tipoParaSkillCodigo(tipo));
        
        // Buscar dados das Skills usando códigos
        const dadosSkills = await getDadosSkills(codigosSkills);
        
        // Criar mapa de tipo -> ícone
        const iconsMap = new Map<string, string>();
        tiposUnicos.forEach(tipo => {
          const codigoSkill = tipoParaSkillCodigo(tipo);
          const dados = dadosSkills.get(codigoSkill);
          if (dados?.icone) {
            iconsMap.set(tipo, dados.icone);
          }
        });
        
        setSkillsIcons(iconsMap);
      } catch (error) {
        console.error("[MAPA] Erro ao buscar ícones das Skills:", error);
      }
    };
    
    fetchSkillsIcons();
  }, [osPendentes, rotas]);

  // useEffect para buscar rotas reais do OSRM quando as rotas mudarem
  useEffect(() => {
    if (rotas.length === 0) {
      setRoutesGeometry({});
      setCalculandoRotas(false);
      return;
    }

    let isMounted = true;
    setCalculandoRotas(true);

    const buscarRotas = async () => {
      const novasGeometrias: RouteGeometryData = {};

      // Buscar rota para cada equipe
      for (const rota of rotas) {
        if (rota.servicos.length === 0) {
          novasGeometrias[rota.equipe.id] = null;
          continue;
        }

        try {
          // Construir array de coordenadas: base + todos os serviços na ordem (ignorar ALMOCO)
          const coords: [number, number][] = [
            [rota.equipe.latitude, rota.equipe.longitude], // Base
            ...rota.servicos
              .filter((s) => s.tipo === "SERVICO" && s.ordemServico)
              .map((s) => [s.ordemServico!.latitude, s.ordemServico!.longitude]),
          ];

          const geometry = await buscarRotaOSRM(coords);
          
          if (isMounted) {
            novasGeometrias[rota.equipe.id] = geometry;
          }
        } catch (error) {
          console.error(`[MAPA] Erro ao buscar rota para equipe ${rota.equipe.codigo}:`, error);
          if (isMounted) {
            novasGeometrias[rota.equipe.id] = null; // Usar linha reta como fallback
          }
        }
      }

      if (isMounted) {
        setRoutesGeometry(novasGeometrias);
        setCalculandoRotas(false);
      }
    };

    buscarRotas();

    return () => {
      isMounted = false;
    };
  }, [rotas]);

  // Filtrar dados baseado nos filtros selecionados
  const dadosFiltrados = useMemo(() => {
    let osPendentesFiltradas = osPendentes;
    let rotasFiltradas = rotas;

    // Filtro por tipo
    if (filtroTipo !== "todos") {
      osPendentesFiltradas = osPendentesFiltradas.filter(os => os.tipo === filtroTipo);
      rotasFiltradas = rotasFiltradas.map(rota => ({
        ...rota,
        servicos: rota.servicos.filter(servico => 
          servico.tipo === "ALMOCO" || servico.ordemServico?.tipo === filtroTipo
        )
      })).filter(rota => rota.servicos.some(s => s.tipo === "SERVICO"));
    }

    // Filtro por equipe - mas se equipeEditando estiver definida, mostrar todas mas destacar a selecionada
    if (filtroEquipe !== "todos" && !equipeEditando) {
      rotasFiltradas = rotasFiltradas.filter(rota => rota.equipe.id === filtroEquipe);
    }

    // Filtro por regulada
    if (filtroRegulada !== "todos") {
      const isRegulada = filtroRegulada === "sim";
      osPendentesFiltradas = osPendentesFiltradas.filter(os => os.regulada === isRegulada);
      rotasFiltradas = rotasFiltradas.map(rota => ({
        ...rota,
        servicos: rota.servicos.filter(servico => 
          servico.tipo === "ALMOCO" || servico.ordemServico?.regulada === isRegulada
        )
      })).filter(rota => rota.servicos.some(s => s.tipo === "SERVICO"));
    }

    return { osPendentesFiltradas, rotasFiltradas };
  }, [osPendentes, rotas, filtroTipo, filtroEquipe, filtroRegulada, equipeEditando]);

  // Obter tipos únicos e equipes únicas para os filtros
  const tiposDisponiveis = useMemo(() => {
    const tipos = new Set<string>();
    osPendentes.forEach(os => tipos.add(os.tipo));
    rotas.forEach(rota => {
      rota.servicos.forEach(servico => {
        if (servico.ordemServico) {
          tipos.add(servico.ordemServico.tipo);
        }
      });
    });
    return Array.from(tipos).sort();
  }, [osPendentes, rotas]);

  // Função para entrar/sair de tela cheia
  const toggleFullscreen = () => {
    if (!mapContainerRef.current) return;

    if (!isFullscreen) {
      if (mapContainerRef.current.requestFullscreen) {
        mapContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Listener para mudanças de tela cheia
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Ajustar tamanho do mapa quando entrar/sair de tela cheia
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Desabilitar interação do mapa quando os filtros estão abertos ou um select está aberto
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    if (mostrarFiltros || selectAberto !== null) {
      // Desabilitar interação do mapa temporariamente
      mapInstanceRef.current.dragging.disable();
      mapInstanceRef.current.touchZoom.disable();
      mapInstanceRef.current.doubleClickZoom.disable();
      mapInstanceRef.current.scrollWheelZoom.disable();
      mapInstanceRef.current.boxZoom.disable();
      mapInstanceRef.current.keyboard.disable();
    } else {
      // Reabilitar interação do mapa
      mapInstanceRef.current.dragging.enable();
      mapInstanceRef.current.touchZoom.enable();
      mapInstanceRef.current.doubleClickZoom.enable();
      mapInstanceRef.current.scrollWheelZoom.enable();
      mapInstanceRef.current.boxZoom.enable();
      mapInstanceRef.current.keyboard.enable();
    }
  }, [mostrarFiltros, selectAberto]);

  // Criar sequência ordenada de OSs para navegação
  const criarSequenciaOS = useMemo(() => {
    const sequencia: Array<{ os: OrdemServico; rota?: RotaEquipe; servico?: any; index: number }> = [];
    
    // Primeiro, adicionar OSs alocadas ordenadas por rota e ordem
    rotas.forEach((rota) => {
      rota.servicos.forEach((servico) => {
        if (servico.tipo === "SERVICO" && servico.ordemServico) {
          sequencia.push({
            os: servico.ordemServico,
            rota,
            servico,
            index: sequencia.length
          });
        }
      });
    });
    
    // Depois, adicionar OSs pendentes
    osPendentes.forEach((os) => {
      sequencia.push({
        os,
        index: sequencia.length
      });
    });
    
    return sequencia;
  }, [rotas, osPendentes]);

  // useEffect para atualizar marcadores e rotas quando os dados mudarem
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    try {
      const map = mapInstanceRef.current;
      const { osPendentesFiltradas, rotasFiltradas } = dadosFiltrados;

      // Atualizar sequência de OSs
      osSequenciaRef.current = criarSequenciaOS || [];
      
      // Atualizar mapeamento de marcadores
      markersMapRef.current.clear();
      
      // Limpar marcadores anteriores
      markersRef.current.forEach((marker) => {
        map.removeLayer(marker);
      });
      markersRef.current = [];
      markersMapRef.current.clear();

      polylinesRef.current.forEach((polyline) => {
        map.removeLayer(polyline);
      });
      polylinesRef.current = [];

      // Adicionar marcadores das equipes (bases) - apenas se não houver filtro de equipe ou se a equipe estiver selecionada
      equipesMock.forEach((equipe) => {
        if (filtroEquipe === "todos" || filtroEquipe === equipe.id) {
          const marker = L.marker([equipe.latitude, equipe.longitude], {
            icon: L.divIcon({
              className: "custom-marker-base",
              html: `<div style="background-color: ${equipe.color || "#3b82f6"}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
          });
          marker.bindPopup(`<strong>${equipe.codigo}</strong><br>${equipe.tecnico}<br><span style="color: #666;">Base de Saída</span>`);
          marker.addTo(map);
          markersRef.current.push(marker);
        }
      });

      // ========== RENDERIZAÇÃO CANVAS - ULTRA PERFORMÁTICA ==========
      // Similar ao OpenLayers usado no sistema GPM
      // Todos os marcadores são desenhados em um ÚNICO canvas
      // Isso é MUITO mais rápido que criar milhares de elementos DOM
      
      console.log('[MAPA] Total de OSs pendentes para renderização canvas:', osPendentesDebounced.length);
      
      // Remover camada de canvas anterior se existir
      if (canvasLayerRef.current) {
        map.removeLayer(canvasLayerRef.current);
        canvasLayerRef.current = null;
      }
      
      // Preparar marcadores para o canvas
      const canvasMarkers: CanvasMarker[] = [];
      let contadorOSsValidas = 0;
      let contadorOSsCoordenadasInvalidas = 0;
      
      osPendentesDebounced.forEach((os) => {
        // Validar coordenadas
        const latValida = typeof os.latitude === 'number' && !isNaN(os.latitude) && os.latitude >= -35 && os.latitude <= 5;
        const lngValida = typeof os.longitude === 'number' && !isNaN(os.longitude) && os.longitude >= -75 && os.longitude <= -32;
        
        if (!latValida || !lngValida) {
          contadorOSsCoordenadasInvalidas++;
          return;
        }
        
        contadorOSsValidas++;
        
        canvasMarkers.push({
          id: os.id,
          lat: os.latitude,
          lng: os.longitude,
          numero: os.numero,
          tipo: os.tipo,
          cor: obterCorBordaPrioridade(os),
          selecionado: osSelecionada === os.id,
          regulada: os.regulada,
        });
      });
      
      console.log('[MAPA] Canvas: OSs válidas para desenho:', contadorOSsValidas);
      console.log('[MAPA] Canvas: OSs com coordenadas inválidas:', contadorOSsCoordenadasInvalidas);
      
      // Criar camada de canvas com todos os marcadores
      const canvasLayer = createCanvasMarkersLayer({
        markers: canvasMarkers,
        onMarkerClick: (marker) => {
          // Encontrar a OS completa
          const os = osPendentesDebounced.find(o => o.id === marker.id);
          if (!os) return;
          
          // Criar popup na posição do marcador
          const prazoFormatado = os.prazo 
            ? new Date(os.prazo).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
            : "Sem prazo";
          
          const popupHTML = `
            <div style="min-width:180px;font-family:system-ui,sans-serif;">
              <div style="margin-bottom:6px;"><b>Número:</b> ${os.numero}</div>
              <div style="margin-bottom:6px;"><b>Tipo:</b> ${obterLabelTipo(os.tipo)}</div>
              <div style="margin-bottom:6px;"><b>Prazo:</b> <span style="${os.prazo ? 'color:#dc2626;font-weight:600' : 'color:#6b7280'}">${prazoFormatado}</span></div>
              <div style="margin-bottom:6px;"><b>Equipe:</b> <span style="color:#6b7280">Não alocada</span></div>
              ${os.regulada ? '<div style="margin-top:6px;padding:3px 6px;background:#fee2e2;border-radius:4px;display:inline-block;color:#dc2626;font-weight:bold;font-size:11px">REGULADA</div>' : ''}
              ${equipeEditando ? `<div style="margin-top:10px;text-align:center"><button onclick="window.selecionarOSParaIncluir('${os.id}')" style="padding:6px 12px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:600">+ Incluir na Rota</button></div>` : ''}
            </div>
          `;
          
          L.popup()
            .setLatLng([os.latitude, os.longitude])
            .setContent(popupHTML)
            .openOn(map);
          
          // Configurar função global para seleção
          (window as any).selecionarOSParaIncluir = (osId: string) => {
            if (onOSSelecionada) onOSSelecionada(osId);
          };
          
          // Se equipe está sendo editada, selecionar a OS
          if (equipeEditando && onOSSelecionada) {
            onOSSelecionada(marker.selecionado ? null : os.id);
          }
        },
      });
      
      canvasLayer.addTo(map);
      canvasLayerRef.current = canvasLayer;

      // Adicionar marcadores e rotas das OS alocadas (filtradas)
      // Se equipeEditando estiver definida, mostrar todas as rotas mas destacar a selecionada
      // IMPORTANTE: Sempre mostrar todas as rotas que têm serviços, mas aplicar filtros quando não há equipe sendo editada
      let rotasParaMostrar: RotaEquipe[];
      if (equipeEditando) {
        // Quando uma equipe está sendo editada, mostrar todas as rotas (para contexto visual)
        rotasParaMostrar = rotas.filter(r => r.servicos.length > 0);
      } else {
        // Quando não há equipe sendo editada, usar rotas filtradas se disponíveis, senão todas as rotas
        rotasParaMostrar = rotasFiltradas.length > 0 ? rotasFiltradas : rotas.filter(r => r.servicos.length > 0);
      }
      
      console.log('[MAPA] Rotas para mostrar:', rotasParaMostrar.length, 'de', rotas.length, 'rotas totais');
      console.log('[MAPA] Rotas filtradas:', rotasFiltradas.length);
      console.log('[MAPA] Equipe editando:', equipeEditando);
      console.log('[MAPA] OSs pendentes filtradas:', osPendentesFiltradas.length, 'de', osPendentes.length);
      console.log('[MAPA] Primeira rota detalhes:', rotasParaMostrar[0] ? {
        equipe: rotasParaMostrar[0].equipe.codigo,
        servicos: rotasParaMostrar[0].servicos.length,
        servicosValidos: rotasParaMostrar[0].servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico).length
      } : 'Nenhuma rota');
      
      if (rotasParaMostrar.length === 0 && rotas.length > 0) {
        console.warn('[MAPA] AVISO: Há rotas mas nenhuma está sendo exibida!');
        console.warn('[MAPA] Rotas originais:', rotas.map(r => ({
          equipe: r.equipe.codigo,
          servicos: r.servicos.length,
          servicosValidos: r.servicos.filter(s => s.tipo === 'SERVICO' && s.ordemServico).length
        })));
        // Se não há rotas para mostrar mas há rotas disponíveis, usar todas as rotas como fallback
        rotasParaMostrar = rotas.filter(r => r.servicos.length > 0);
      }
      
      rotasParaMostrar.forEach((rota) => {
        const cor = rota.equipe.color || "#3b82f6";
        const isHovered = equipeHovered === rota.equipe.id;
        const isEditando = equipeEditando === rota.equipe.id;
        const geometry = routesGeometry[rota.equipe.id];
        
        // Se uma equipe está sendo editada, reduzir opacidade das outras
        const opacidadeReduzida = equipeEditando && !isEditando ? 0.3 : 1;

        // Adicionar marcadores (apenas serviços, não almoço)
        const servicosValidos = rota.servicos.filter(s => s.tipo === "SERVICO" && s.ordemServico);
        console.log(`[MAPA] Rota ${rota.equipe.codigo}: ${servicosValidos.length} serviços válidos de ${rota.servicos.length} total`);
        
        servicosValidos.forEach((servico) => {
          if (!servico.ordemServico) {
            console.warn(`[MAPA] Serviço sem ordemServico na rota ${rota.equipe.codigo}`);
            return;
          }
          
          const lat = servico.ordemServico.latitude;
          const lng = servico.ordemServico.longitude;
          
          // Verificar se esta OS está selecionada no editor
          const isSelecionadaNoEditor = osSelecionadaNoEditor === servico.ordemServico.id;
          
          // Obter ícone da Skill correspondente ao tipo da OS
          const iconName = skillsIcons.get(servico.ordemServico.tipo);
          
          // Obter cor da borda baseada na prioridade
          const corBorda = obterCorBordaPrioridade(servico.ordemServico);
          
          // Criar ícone SVG com a cor da equipe, ícone da skill e número da ordem
          // Se equipe está sendo editada, destacar marcadores dela e reduzir um pouco os outros (mesmo tamanho das OSs não roteirizadas)
          const tamanhoMarker = isEditando ? 40 : (equipeEditando ? 24 : 32);
          const tamanhoIcone = isEditando ? 32 : (equipeEditando ? 20 : 20);
          const opacidadeMarker = opacidadeReduzida < 1 ? opacidadeReduzida : 1;
          
          const iconSVGContent = iconName ? getLucideIconSVG(iconName, "#000000", tamanhoIcone) : '';
          const iconSVG = `
            <div style="
              background-color: ${cor}; 
              width: ${tamanhoMarker}px; 
              height: ${tamanhoMarker}px; 
              border-radius: 50%; 
              border: ${isSelecionadaNoEditor ? '4px solid #3b82f6' : (isEditando ? '3px' : '2px')} solid ${isSelecionadaNoEditor ? '#3b82f6' : corBorda}; 
              box-shadow: ${isSelecionadaNoEditor ? '0 6px 16px rgba(59, 130, 246, 0.8)' : (isEditando ? '0 4px 12px rgba(0,0,0,0.6)' : '0 2px 6px rgba(0,0,0,0.4)')};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              position: relative;
              opacity: ${opacidadeMarker};
              ${isSelecionadaNoEditor ? 'animation: pulse-blue 1.5s infinite;' : (isEditando ? 'animation: pulse 2s infinite;' : '')}
            ">
              ${iconSVGContent}
              <div style="
                position: absolute;
                bottom: -2px;
                right: -2px;
                background-color: rgba(0,0,0,0.8);
                color: white;
                border-radius: 50%;
                width: ${isEditando ? '20px' : (equipeEditando ? '16px' : '18px')};
                height: ${isEditando ? '20px' : (equipeEditando ? '16px' : '18px')};
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isEditando ? '11px' : (equipeEditando ? '9px' : '10px')};
                font-weight: bold;
                border: 1.5px solid white;
                z-index: 10;
              ">${servico.ordemNaRota}</div>
            </div>
          `;

          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "custom-marker-alocada",
              html: iconSVG,
              iconSize: [tamanhoMarker, tamanhoMarker],
              iconAnchor: [tamanhoMarker / 2, tamanhoMarker / 2],
            }),
          });
          // Encontrar índice na sequência
          const sequenciaIndex = osSequenciaRef.current.findIndex(item => item.os.id === servico.ordemServico.id);
          const temAnterior = sequenciaIndex > 0;
          const temProximo = sequenciaIndex < osSequenciaRef.current.length - 1;
          
          // Formatar prazo se existir
          const prazoFormatado = servico.ordemServico.prazo 
            ? new Date(servico.ordemServico.prazo).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })
            : "Sem prazo";
          
          const popupContent = `
            <div style="min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
              <div style="margin-bottom: 8px;">
                <strong style="font-size: 14px; color: #1f2937;">Número:</strong>
                <span style="margin-left: 8px; font-weight: 600;">${servico.ordemServico.numero}</span>
              </div>
              <div style="margin-bottom: 8px;">
                <strong style="font-size: 14px; color: #1f2937;">Tipo:</strong>
                <span style="margin-left: 8px;">${obterLabelTipo(servico.ordemServico.tipo)}</span>
              </div>
              <div style="margin-bottom: 8px;">
                <strong style="font-size: 14px; color: #1f2937;">Prazo:</strong>
                <span style="margin-left: 8px; ${servico.ordemServico.prazo ? 'color: #dc2626; font-weight: 600;' : 'color: #6b7280;'}">${prazoFormatado}</span>
              </div>
              <div style="margin-bottom: 8px;">
                <strong style="font-size: 14px; color: #1f2937;">Equipe:</strong>
                <span style="margin-left: 8px; color: ${cor}; font-weight: 600;">${rota.equipe.codigo}</span>
              </div>
              <div style="margin-bottom: 8px;">
                <strong style="font-size: 14px; color: #1f2937;">Ordem:</strong>
                <span style="margin-left: 8px; background-color: ${cor}; color: white; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 12px;">${servico.ordemNaRota}</span>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                <div style="font-size: 12px; color: #6b7280;">
                  <strong>ETA:</strong> ${servico.eta || servico.horaInicio}
                  ${servico.horaFim ? `<br><strong>Fim:</strong> ${servico.horaFim}` : ''}
                </div>
              </div>
              ${servico.ordemServico.regulada ? '<div style="margin-top: 8px; padding: 4px 8px; background-color: #fee2e2; border-radius: 4px; display: inline-block;"><span style="color: #dc2626; font-weight: bold; font-size: 12px;">REGULADA</span></div>' : ""}
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; justify-content: center;">
                <button 
                  id="btn-anterior-${servico.ordemServico.id}" 
                  onclick="window.navegarOS('anterior', '${servico.ordemServico.id}')"
                  style="
                    padding: 6px 12px;
                    background-color: ${temAnterior ? '#3b82f6' : '#9ca3af'};
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: ${temAnterior ? 'pointer' : 'not-allowed'};
                    font-size: 12px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    opacity: ${temAnterior ? '1' : '0.5'};
                  "
                  ${!temAnterior ? 'disabled' : ''}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                  Anterior
                </button>
                <button 
                  id="btn-proximo-${servico.ordemServico.id}" 
                  onclick="window.navegarOS('proximo', '${servico.ordemServico.id}')"
                  style="
                    padding: 6px 12px;
                    background-color: ${temProximo ? '#3b82f6' : '#9ca3af'};
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: ${temProximo ? 'pointer' : 'not-allowed'};
                    font-size: 12px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    opacity: ${temProximo ? '1' : '0.5'};
                  "
                  ${!temProximo ? 'disabled' : ''}
                >
                  Próxima
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>
          `;
          
          const popup = L.popup().setContent(popupContent);
          marker.bindPopup(popup);
          marker.addTo(map);
          markersRef.current.push(marker);
          markersMapRef.current.set(servico.ordemServico.id, marker);
        }); // Fim do forEach de servicosValidos

        // Desenhar rota real do OSRM ou linha provisória
        // Sempre mostrar todas as rotas, apenas com tamanhos diferentes
        if (rota.servicos.length > 0) {
          if (geometry && geometry.coordinates.length > 0) {
            // Converter coordenadas OSRM (lon, lat) para Leaflet (lat, lon)
            const leafletCoords = geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
            
            // Desenhar rota real usando GeoJSON
            const polyline = L.polyline(leafletCoords, {
              color: cor,
              weight: isEditando ? 8 : (isHovered ? 6 : (equipeEditando ? 2 : 4)), // Mais fino se outra equipe está sendo editada
              opacity: isEditando ? 1 : (isHovered ? 1 : (opacidadeReduzida < 1 ? opacidadeReduzida : 0.9)),
              className: isEditando ? "route-editing" : (isHovered ? "route-highlighted" : ""),
            });
            polyline.addTo(map);
            polylinesRef.current.push(polyline);
          } else {
            // Linha provisória (reta) enquanto carrega ou em caso de erro
            const pontos: [number, number][] = [
              [rota.equipe.latitude, rota.equipe.longitude],
              ...rota.servicos
                .filter((s) => s.tipo === "SERVICO" && s.ordemServico)
                .map((s) => [s.ordemServico!.latitude, s.ordemServico!.longitude]),
            ];
            
            const polyline = L.polyline(pontos, {
              color: cor,
              weight: isEditando ? 8 : (isHovered ? 5 : (equipeEditando ? 2 : 4)),
              opacity: isEditando ? 1 : (isHovered ? 0.8 : (opacidadeReduzida < 1 ? opacidadeReduzida * 0.6 : 0.6)),
              dashArray: "10, 5",
              className: isEditando ? "route-editing" : (isHovered ? "route-highlighted" : ""),
            });
            polyline.addTo(map);
            polylinesRef.current.push(polyline);
          }
        }
      });

      // Ajustar zoom para mostrar todos os pontos (filtrados)
      const bounds: [number, number][] = [];
      if (equipeEditando) {
        // Se uma equipe está sendo editada, focar nela mas incluir outras rotas
        const equipeEditandoObj = equipesMock.find(e => e.id === equipeEditando);
        if (equipeEditandoObj) {
          bounds.push([equipeEditandoObj.latitude, equipeEditandoObj.longitude]);
        }
        rotasParaMostrar.forEach((rota) => {
          if (rota.equipe.id === equipeEditando) {
            rota.servicos
              .filter((s) => s.tipo === "SERVICO" && s.ordemServico)
              .forEach((s) => bounds.push([s.ordemServico!.latitude, s.ordemServico!.longitude]));
          }
        });
      } else if (filtroEquipe === "todos") {
        equipesMock.forEach((e) => bounds.push([e.latitude, e.longitude]));
        // IMPORTANTE: Usar osPendentes (todas) e não osPendentesFiltradas para incluir OSs fora dos territórios
        osPendentes.forEach((os) => bounds.push([os.latitude, os.longitude]));
        rotasParaMostrar.forEach((rota) => {
          rota.servicos
            .filter((s) => s.tipo === "SERVICO" && s.ordemServico)
            .forEach((s) => bounds.push([s.ordemServico!.latitude, s.ordemServico!.longitude]));
        });
      } else {
        const equipeSelecionada = equipesMock.find(e => e.id === filtroEquipe);
        if (equipeSelecionada) {
          bounds.push([equipeSelecionada.latitude, equipeSelecionada.longitude]);
        }
        // IMPORTANTE: Usar osPendentes (todas) e não osPendentesFiltradas para incluir OSs fora dos territórios
        osPendentes.forEach((os) => bounds.push([os.latitude, os.longitude]));
        rotasParaMostrar.forEach((rota) => {
        rota.servicos
          .filter((s) => s.tipo === "SERVICO" && s.ordemServico)
          .forEach((s) => bounds.push([s.ordemServico!.latitude, s.ordemServico!.longitude]));
      });
      }
      if (bounds.length > 0) {
        map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
      }
      
      // Configurar função global para navegação entre OSs
      if (typeof window !== 'undefined') {
        (window as any).navegarOS = (direcao: 'anterior' | 'proximo', osIdAtual: string) => {
          try {
            const sequencia = osSequenciaRef.current;
            if (!sequencia || sequencia.length === 0) return;
            
            const indexAtual = sequencia.findIndex(item => item.os.id === osIdAtual);
            
            if (indexAtual === -1) return;
            
            let novoIndex: number;
            if (direcao === 'anterior' && indexAtual > 0) {
              novoIndex = indexAtual - 1;
            } else if (direcao === 'proximo' && indexAtual < sequencia.length - 1) {
              novoIndex = indexAtual + 1;
            } else {
              return;
            }
            
            const novaOS = sequencia[novoIndex];
            if (!novaOS || !novaOS.os) return;
            
            const marker = markersMapRef.current.get(novaOS.os.id);
            
            if (marker && mapInstanceRef.current) {
              // Fechar popup atual
              mapInstanceRef.current.closePopup();
              
              // Abrir popup da nova OS
              marker.openPopup();
              
              // Centralizar mapa na nova OS
              mapInstanceRef.current.setView([novaOS.os.latitude, novaOS.os.longitude], mapInstanceRef.current.getZoom(), {
                animate: true,
                duration: 0.5
              });
            }
          } catch (error) {
            console.error('[MAP] Erro ao navegar entre OSs:', error);
          }
        };
      }
    } catch (error) {
      console.error("Erro ao atualizar mapa:", error);
      setErroMsg(error instanceof Error ? error.message : String(error));
      // Não definir erro como true para não quebrar o mapa completamente
      // setErro(true);
    } finally {
      // Garantir que o mapa seja atualizado após mudanças
      if (mapInstanceRef.current) {
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 100);
      }
    }
  }, [dadosFiltrados, equipesMock, equipeHovered, equipeEditando, osSelecionada, osSelecionadaNoEditor, routesGeometry, skillsIcons, filtroEquipe, criarSequenciaOS, osPendentesDebounced]);

  // Função auxiliar para calcular centroide
  const calcularCentroide = (poligono: { lat: number; lng: number }[]): { lat: number; lng: number } => {
    if (poligono.length === 0) {
      return { lat: 0, lng: 0 };
    }
    
    let somaLat = 0;
    let somaLng = 0;
    
    for (const ponto of poligono) {
      somaLat += ponto.lat;
      somaLng += ponto.lng;
    }
    
    return {
      lat: somaLat / poligono.length,
      lng: somaLng / poligono.length
    };
  };

  // useEffect para atualizar territórios no mapa e expectativas
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Limpar territórios anteriores
    territoriosLayersRef.current.forEach((layer) => {
      map.removeLayer(layer);
    });
    territoriosLayersRef.current = [];

    // Limpar marcadores de expectativa anteriores
    expectativasMarkersRef.current.forEach((marker) => {
      map.removeLayer(marker);
    });
    expectativasMarkersRef.current = [];

    // Calcular expectativas de equipes para os territórios
    const territoriosAtivos = territorios.filter((t) => t.ativo && t.poligono.length >= 3);
    const expectativas = calcularExpectativaEquipesPorTerritorio(osPendentes, equipesMock, territoriosAtivos);
    const expectativasMap = new Map<string, ExpectativaTerritorio>();
    expectativas.forEach(exp => expectativasMap.set(exp.territorioId, exp));

    // Adicionar territórios ativos ao mapa
    territoriosAtivos.forEach((territorio) => {
        const latlngs = territorio.poligono.map(
          (coord) => [coord.lat, coord.lng] as [number, number]
        );

        const polygon = L.polygon(latlngs, {
          color: territorio.cor,
          fillColor: territorio.cor,
          fillOpacity: 0.2,
          weight: 2,
          dashArray: "5, 5",
        });

      // Encontrar nomes das equipes vinculadas
      const equipesVinculadas = territorio.equipeIds
        .map(id => equipesMock.find(e => e.id === id))
        .filter(e => e !== undefined);
      const nomesEquipes = equipesVinculadas.length > 0
        ? equipesVinculadas.map(e => `${e!.codigo}`).join(", ")
        : "Sem equipes";

        polygon.bindTooltip(
        `<strong>${territorio.nome}</strong><br>Equipes: ${nomesEquipes}${modoEdicao ? '<br><small>Clique para editar</small>' : ''}`,
          { permanent: false }
        );

      // Adicionar evento de clique para edição quando em modo de edição
      if (modoEdicao && territorioEditando !== territorio.id) {
        const handleClick = () => {
          iniciarEdicao(territorio);
        };
        polygon.on("click", handleClick);
        polygon.setStyle({
          cursor: "pointer",
          opacity: 0.7,
        });
        // Armazenar handler para poder removê-lo depois
        (polygon as any)._editClickHandler = handleClick;
      } else {
        // Remover handler se existir
        if ((polygon as any)._editClickHandler) {
          polygon.off("click", (polygon as any)._editClickHandler);
          delete (polygon as any)._editClickHandler;
        }
        polygon.setStyle({
          cursor: "",
          opacity: 1,
        });
      }

        polygon.addTo(map);
        territoriosLayersRef.current.push(polygon);

      // Adicionar marcador de expectativa no centroide (só mostrar quando nenhuma equipe está sendo editada)
      if (!equipeEditando) {
        const expectativa = expectativasMap.get(territorio.id);
        const centroide = calcularCentroide(territorio.poligono);
        const valorFormatado = expectativa 
          ? expectativa.equipesNecessariasUrgentes.toFixed(1).replace('.', ',')
          : '0,0';
        
        // Usar a cor do território para o marcador
        const corTerritorio = territorio.cor || '#3b82f6';
        
        // Criar marcador grande com o número
        const markerHTML = `
          <div style="
            background-color: ${corTerritorio};
            color: white;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            line-height: 1;
          ">
            ${valorFormatado}
          </div>
        `;

        const marker = L.marker([centroide.lat, centroide.lng], {
          icon: L.divIcon({
            className: "custom-marker-expectativa",
            html: markerHTML,
            iconSize: [60, 60],
            iconAnchor: [30, 30],
          }),
          zIndexOffset: 1000, // Garantir que fique acima dos outros marcadores
        });

        const totalUrgentes = expectativa?.totalUrgentes || 0;
        marker.bindTooltip(
          `<strong>${territorio.nome}</strong><br>Equipes necessárias para urgentes: <strong>${valorFormatado}</strong><br>Total de urgentes: ${totalUrgentes}`,
          { permanent: false, direction: 'top', offset: [0, -35] }
        );

        marker.addTo(map);
        expectativasMarkersRef.current.push(marker);
      }
    });
  }, [territorios, equipesMock, osPendentes, modoEdicao, territorioEditando, equipeEditando]);

  // Error boundary adicional para capturar erros não tratados
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[MAP] Erro não tratado:', event.error);
      setErro(true);
      setErroMsg(event.error?.message || 'Erro desconhecido');
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[MAP] Promise rejeitada:', event.reason);
      setErro(true);
      setErroMsg(event.reason?.message || 'Erro na promise');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Tratamento de erro com fallback
  // Não bloquear renderização do mapa por erros menores
  // if (erro) {
  //   return (
  //     <div className="relative h-[600px] bg-muted/30 flex items-center justify-center">
  //       <div className="text-center space-y-2">
  //         <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto">
  //           <MapPin className="h-8 w-8 text-destructive" />
  //         </div>
  //         <p className="text-sm text-destructive">Erro ao carregar mapa</p>
  //         {erroMsg && <p className="text-xs text-muted-foreground mt-2">{erroMsg}</p>}
  //         <Button 
  //           onClick={() => {
  //             setErro(false);
  //             setErroMsg("");
  //           }}
  //           className="mt-4"
  //         >
  //           Tentar Novamente
  //         </Button>
  //       </div>
  //     </div>
  //   );
  // }
  
  // Mostrar aviso de erro se houver, mas não bloquear o mapa
  if (erro && erroMsg) {
    console.warn("Aviso no mapa:", erroMsg);
  }

  return (
    <div ref={mapContainerRef} className={`relative h-full w-full ${isFullscreen ? 'fixed inset-0 z-[9999] bg-background' : ''}`}>
      <div ref={mapRef} className="h-full w-full rounded-lg" style={{ minHeight: "600px" }} />
      
      {/* Overlay para bloquear interação do mapa quando filtros estão abertos */}
      {mostrarFiltros && (
        <div 
          className="absolute inset-0 z-[9998]"
          style={{ pointerEvents: 'none' }}
          onClick={() => setMostrarFiltros(false)}
        />
      )}
      
      {/* Botões de controle */}
      <div 
        className="absolute top-4 right-4 flex flex-col gap-2"
        style={{ 
          zIndex: isFullscreen ? 100000 : 1000,
          pointerEvents: 'auto'
        }}
      >
        {/* Botão de edição de polígonos */}
        {!modoEdicao ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModoEdicao(true)}
            className="bg-card/90 backdrop-blur-sm shadow-lg"
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar Polígonos
          </Button>
        ) : (
          <>
            {territorioEditando ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={salvarEdicao}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={cancelarEdicao}
                  className="shadow-lg"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModoEdicao(false)}
                className="bg-card/90 backdrop-blur-sm shadow-lg"
              >
                <X className="h-4 w-4 mr-2" />
                Sair da Edição
              </Button>
            )}
          </>
        )}

        {/* Botão de filtros */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className="bg-card/90 backdrop-blur-sm shadow-lg"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
        </Button>
        
        {/* Botão de tela cheia */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFullscreen}
          className="bg-card/90 backdrop-blur-sm shadow-lg"
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="h-4 w-4 mr-2" />
              Sair
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4 mr-2" />
              Tela Cheia
            </>
          )}
        </Button>
      </div>

      {/* Painel de filtros */}
      {mostrarFiltros && (
        <div 
          className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-4 border border-border shadow-lg min-w-[280px]"
          style={{ 
            pointerEvents: 'auto',
            zIndex: isFullscreen ? 100000 : 10000
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Filtros do Mapa</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMostrarFiltros(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-4">
            {/* Filtro por Tipo */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Tipo de OS
              </label>
              <Select 
                value={filtroTipo} 
                onValueChange={(value) => {
                  setFiltroTipo(value);
                  setSelectAberto(null);
                }}
                onOpenChange={(open) => setSelectAberto(open ? 'tipo' : null)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  className="z-[99999] !z-[99999]" 
                  style={{ 
                    zIndex: isFullscreen ? 100001 : 99999, 
                    pointerEvents: 'auto'
                  }}
                  onPointerDownOutside={(e) => {
                    e.preventDefault();
                    setSelectAberto(null);
                  }}
                >
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {tiposDisponiveis.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Equipe */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Equipe
              </label>
              <Select 
                value={filtroEquipe} 
                onValueChange={(value) => {
                  setFiltroEquipe(value);
                  setSelectAberto(null);
                }}
                onOpenChange={(open) => setSelectAberto(open ? 'equipe' : null)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  className="z-[99999] !z-[99999]" 
                  style={{ 
                    zIndex: isFullscreen ? 100001 : 99999, 
                    pointerEvents: 'auto'
                  }}
                  onPointerDownOutside={(e) => {
                    e.preventDefault();
                    setSelectAberto(null);
                  }}
                >
                  <SelectItem value="todos">Todas as equipes</SelectItem>
                  {equipesMock.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.codigo} - {equipe.tecnico}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Regulada */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Regulada
              </label>
              <Select 
                value={filtroRegulada} 
                onValueChange={(value) => {
                  setFiltroRegulada(value);
                  setSelectAberto(null);
                }}
                onOpenChange={(open) => setSelectAberto(open ? 'regulada' : null)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  className="z-[99999] !z-[99999]" 
                  style={{ 
                    zIndex: isFullscreen ? 100001 : 99999, 
                    pointerEvents: 'auto'
                  }}
                  onPointerDownOutside={(e) => {
                    e.preventDefault();
                    setSelectAberto(null);
                  }}
                >
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="sim">Apenas Reguladas</SelectItem>
                  <SelectItem value="nao">Apenas Não Reguladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão limpar filtros */}
            {(filtroTipo !== "todos" || filtroEquipe !== "todos" || filtroRegulada !== "todos") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiltroTipo("todos");
                  setFiltroEquipe("todos");
                  setFiltroRegulada("todos");
                }}
                className="w-full"
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Indicador de carregamento */}
      {calculandoRotas && (
        <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border z-[1000] flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-foreground">Calculando rotas...</span>
        </div>
      )}
    </div>
  );
}

