/**
 * Canvas Markers Layer para Leaflet
 * 
 * Desenha milhares de marcadores em um único canvas, similar ao OpenLayers.
 * Muito mais performático que criar elementos DOM individuais.
 */

import L from "leaflet";

// Polyfill para roundRect (não existe em todos os browsers)
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(
    x: number, y: number, w: number, h: number, r: number | number[]
  ) {
    const radius = typeof r === 'number' ? r : r[0] || 0;
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + w - radius, y);
    this.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.lineTo(x + w, y + h - radius);
    this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.lineTo(x + radius, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
    return this;
  };
}

export interface CanvasMarker {
  id: string;
  lat: number;
  lng: number;
  numero: string;
  tipo: string;
  cor: string; // Cor da borda/fundo baseada em prioridade
  selecionado?: boolean;
  regulada?: boolean;
  icone_url?: string; // URL da imagem personalizada
}

interface CanvasMarkersLayerOptions extends L.LayerOptions {
  markers: CanvasMarker[];
  onMarkerClick?: (marker: CanvasMarker) => void;
  onMarkerHover?: (marker: CanvasMarker | null) => void;
}

// Cores por tipo de serviço
const CORES_TIPO: Record<string, string> = {
  'corte': '#ef4444',      // vermelho
  'religa': '#22c55e',     // verde
  'ligacao': '#3b82f6',    // azul
  'verificacao': '#f97316', // laranja
  'baixa': '#8b5cf6',      // roxo
  'enlace': '#06b6d4',     // ciano
  'recorte': '#ec4899',    // rosa
  'default': '#6b7280',    // cinza
};

// Obter cor baseada no tipo
function getCorTipo(tipo: string): string {
  const tipoLower = tipo.toLowerCase();
  for (const [key, cor] of Object.entries(CORES_TIPO)) {
    if (tipoLower.includes(key)) return cor;
  }
  return CORES_TIPO.default;
}

// Cache global de imagens para evitar recarregamento
const imageCache = new Map<string, HTMLImageElement>();

// Função para pré-carregar imagens
async function preloadImage(url: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      console.warn(`[CanvasMarkers] Erro ao carregar imagem: ${url}`);
      resolve(null);
    };
    img.src = url;
  });
}

// Classe da camada de canvas
export class CanvasMarkersLayer extends L.Layer {
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _markers: CanvasMarker[] = [];
  private _onMarkerClick?: (marker: CanvasMarker) => void;
  private _onMarkerHover?: (marker: CanvasMarker | null) => void;
  private _hoveredMarker: CanvasMarker | null = null;
  private _markerRadius = 12; // Raio base maior para melhor visualização
  private _bounds: L.LatLngBounds | null = null;
  private _pendingImages = new Set<string>(); // URLs de imagens sendo carregadas

  constructor(options: CanvasMarkersLayerOptions) {
    super(options);
    this._markers = options.markers || [];
    this._onMarkerClick = options.onMarkerClick;
    this._onMarkerHover = options.onMarkerHover;
    
    // Pré-carregar imagens únicas
    this._preloadMarkerImages();
  }
  
  // Pré-carregar todas as imagens dos marcadores
  private async _preloadMarkerImages(): Promise<void> {
    const uniqueUrls = new Set<string>();
    this._markers.forEach(m => {
      if (m.icone_url) uniqueUrls.add(m.icone_url);
    });
    
    const loadPromises = Array.from(uniqueUrls).map(url => preloadImage(url));
    await Promise.all(loadPromises);
    
    // Redesenhar após carregar imagens
    if (this._map) {
      this._draw();
    }
  }

  onAdd(map: L.Map): this {
    // Criar canvas
    this._canvas = L.DomUtil.create('canvas', 'leaflet-canvas-markers-layer') as HTMLCanvasElement;
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
    
    // Configurar estilo do canvas
    // z-index: 450 para ficar abaixo do popup-pane (700) mas acima de outros layers
    this._canvas.style.position = 'absolute';
    this._canvas.style.top = '0';
    this._canvas.style.left = '0';
    this._canvas.style.pointerEvents = 'auto';
    this._canvas.style.zIndex = '450';
    this._canvas.style.cursor = 'grab';

    // Adicionar ao pane de overlay
    const pane = map.getPane('overlayPane');
    if (pane) {
      pane.appendChild(this._canvas);
    }

    // Configurar tamanho
    this._updateCanvasSize();

    // Bindear eventos
    map.on('move', this._onMapMove, this);
    map.on('moveend', this._onMapMoveEnd, this);
    map.on('zoom', this._onMapZoom, this);
    map.on('zoomend', this._onMapZoomEnd, this);
    map.on('resize', this._onResize, this);

    // Eventos de mouse no canvas
    this._canvas.addEventListener('click', this._onClick.bind(this));
    this._canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
    this._canvas.addEventListener('mouseout', this._onMouseOut.bind(this));

    // Desenhar inicial
    this._draw();

    return this;
  }

  onRemove(map: L.Map): this {
    // Remover eventos
    map.off('move', this._onMapMove, this);
    map.off('moveend', this._onMapMoveEnd, this);
    map.off('zoom', this._onMapZoom, this);
    map.off('zoomend', this._onMapZoomEnd, this);
    map.off('resize', this._onResize, this);

    // Remover canvas
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    this._canvas = null;
    this._ctx = null;

    return this;
  }

  // Atualizar marcadores
  setMarkers(markers: CanvasMarker[]): void {
    this._markers = markers;
    this._preloadMarkerImages().then(() => {
      this._draw();
    });
  }

  // Atualizar tamanho do canvas
  private _updateCanvasSize(): void {
    if (!this._canvas || !this._map) return;
    
    const size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    
    // Atualizar posição
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
  }

  // Eventos do mapa
  private _onMapMove(): void {
    this._updatePosition();
  }

  private _onMapMoveEnd(): void {
    this._updateCanvasSize();
    this._draw();
  }

  private _onMapZoom(): void {
    this._updatePosition();
  }

  private _onMapZoomEnd(): void {
    this._updateCanvasSize();
    this._draw();
  }

  private _onResize(): void {
    this._updateCanvasSize();
    this._draw();
  }

  private _updatePosition(): void {
    if (!this._canvas || !this._map) return;
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    this._draw();
  }

  // Encontrar marcador sob o cursor
  private _findMarkerAtPoint(x: number, y: number): CanvasMarker | null {
    if (!this._map) return null;
    
    const containerPoint = L.point(x, y);
    const clickRadius = this._markerRadius + 4; // Margem de clique
    
    // Buscar de trás para frente (marcadores no topo primeiro)
    for (let i = this._markers.length - 1; i >= 0; i--) {
      const marker = this._markers[i];
      const point = this._map.latLngToContainerPoint([marker.lat, marker.lng]);
      
      const dx = containerPoint.x - point.x;
      const dy = containerPoint.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= clickRadius) {
        return marker;
      }
    }
    
    return null;
  }

  // Eventos de mouse
  private _onClick(e: MouseEvent): void {
    const rect = this._canvas?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const marker = this._findMarkerAtPoint(x, y);
    
    if (marker && this._onMarkerClick) {
      // Parar propagação para evitar que o mapa capture o evento
      e.stopPropagation();
      this._onMarkerClick(marker);
    }
  }

  private _onMouseMove(e: MouseEvent): void {
    const rect = this._canvas?.getBoundingClientRect();
    if (!rect || !this._canvas) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const marker = this._findMarkerAtPoint(x, y);
    
    if (marker !== this._hoveredMarker) {
      this._hoveredMarker = marker;
      this._canvas.style.cursor = marker ? 'pointer' : 'grab';
      
      if (this._onMarkerHover) {
        this._onMarkerHover(marker);
      }
      
      // Redesenhar para mostrar hover
      this._draw();
    }
  }

  private _onMouseOut(): void {
    if (this._hoveredMarker) {
      this._hoveredMarker = null;
      if (this._canvas) {
        this._canvas.style.cursor = 'grab';
      }
      if (this._onMarkerHover) {
        this._onMarkerHover(null);
      }
      this._draw();
    }
  }

  // Desenhar todos os marcadores
  private _draw(): void {
    if (!this._ctx || !this._canvas || !this._map) return;
    
    const ctx = this._ctx;
    const map = this._map;
    
    // Limpar canvas
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    
    // Obter bounds visíveis com margem
    const bounds = map.getBounds().pad(0.1);
    
    // Filtrar marcadores visíveis
    const visibleMarkers = this._markers.filter(m => 
      bounds.contains([m.lat, m.lng])
    );
    
    // Desenhar cada marcador
    visibleMarkers.forEach(marker => {
      const point = map.latLngToContainerPoint([marker.lat, marker.lng]);
      this._drawMarker(ctx, point.x, point.y, marker);
    });
    
    // Desenhar marcador hover por último (no topo)
    if (this._hoveredMarker && bounds.contains([this._hoveredMarker.lat, this._hoveredMarker.lng])) {
      const point = map.latLngToContainerPoint([this._hoveredMarker.lat, this._hoveredMarker.lng]);
      this._drawMarkerHover(ctx, point.x, point.y, this._hoveredMarker);
    }
  }

  // Desenhar um marcador individual
  private _drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, marker: CanvasMarker): void {
    const radius = marker.selecionado ? this._markerRadius + 4 : this._markerRadius;
    const corTipo = getCorTipo(marker.tipo);
    const corBorda = marker.cor || corTipo;
    const zoom = this._map?.getZoom() || 12;
    
    // Se tem imagem personalizada, desenhar ela
    if (marker.icone_url && imageCache.has(marker.icone_url)) {
      const img = imageCache.get(marker.icone_url)!;
      // Tamanhos maiores para melhor visualização
      const imgSize = marker.selecionado ? 40 : (zoom >= 15 ? 32 : zoom >= 13 ? 28 : 24);
      const imgX = x - imgSize / 2;
      const imgY = y - imgSize / 2;
      
      // Sombra suave
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      
      // Desenhar fundo circular branco
      ctx.beginPath();
      ctx.arc(x, y, imgSize / 2 + 3, 0, Math.PI * 2);
      ctx.fillStyle = marker.selecionado ? '#3b82f6' : '#ffffff';
      ctx.fill();
      
      // Borda colorida
      ctx.strokeStyle = marker.selecionado ? '#1e40af' : corBorda;
      ctx.lineWidth = marker.selecionado ? 3 : 2;
      ctx.stroke();
      
      // Resetar sombra
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Criar clip circular para a imagem
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, imgSize / 2, 0, Math.PI * 2);
      ctx.clip();
      
      // Desenhar imagem
      ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
      ctx.restore();
      
      // Se for regulada urgente, redesenhar borda vermelha por cima
      if (marker.regulada) {
        ctx.beginPath();
        ctx.arc(x, y, imgSize / 2 + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    } else {
      // Fallback: desenhar círculo colorido padrão (tamanhos maiores)
      const fallbackRadius = marker.selecionado ? 16 : (zoom >= 15 ? 14 : zoom >= 13 ? 12 : 10);
      
      // Sombra suave
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      
      // Fundo branco
      ctx.beginPath();
      ctx.arc(x, y, fallbackRadius, 0, Math.PI * 2);
      ctx.fillStyle = marker.selecionado ? '#3b82f6' : '#ffffff';
      ctx.fill();
      
      // Borda colorida
      ctx.strokeStyle = marker.selecionado ? '#1e40af' : corBorda;
      ctx.lineWidth = marker.selecionado ? 3 : 2;
      ctx.stroke();
      
      // Resetar sombra
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Se for regulada urgente, redesenhar borda vermelha por cima
      if (marker.regulada) {
        ctx.beginPath();
        ctx.arc(x, y, fallbackRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    
    // Número da OS (apenas se zoom suficiente)
    if (zoom >= 15) {
      ctx.font = 'bold 9px Arial';
      ctx.fillStyle = marker.selecionado ? '#ffffff' : '#374151';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Mostrar últimos 4 dígitos do número
      const shortNum = marker.numero.slice(-4);
      const imgSize = marker.icone_url && imageCache.has(marker.icone_url) ? (marker.selecionado ? 32 : 24) : radius * 2;
      ctx.fillText(shortNum, x, y + imgSize / 2 + 10);
    }
  }

  // Desenhar marcador com hover
  private _drawMarkerHover(ctx: CanvasRenderingContext2D, x: number, y: number, marker: CanvasMarker): void {
    const zoom = this._map?.getZoom() || 12;
    // Hover deve ser maior que o marcador normal
    const radius = marker.icone_url && imageCache.has(marker.icone_url) 
      ? (zoom >= 15 ? 20 : zoom >= 13 ? 18 : 16)
      : (zoom >= 15 ? 18 : zoom >= 13 ? 16 : 14);
    const corTipo = getCorTipo(marker.tipo);
    
    // Sombra
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    // Fundo
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = corTipo;
    ctx.fill();
    
    // Borda branca
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Resetar sombra
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // Tooltip com número completo
    const tooltipY = y - radius - 25;
    const tooltipText = `${marker.numero} - ${marker.tipo}`;
    
    ctx.font = 'bold 11px Arial';
    const textWidth = ctx.measureText(tooltipText).width;
    
    // Background do tooltip
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    const padding = 6;
    const tooltipWidth = textWidth + padding * 2;
    const tooltipHeight = 20;
    const tooltipX = x - tooltipWidth / 2;
    
    // Retângulo arredondado
    ctx.beginPath();
    ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
    ctx.fill();
    
    // Seta do tooltip
    ctx.beginPath();
    ctx.moveTo(x - 6, tooltipY + tooltipHeight);
    ctx.lineTo(x, tooltipY + tooltipHeight + 6);
    ctx.lineTo(x + 6, tooltipY + tooltipHeight);
    ctx.fill();
    
    // Texto do tooltip
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tooltipText, x, tooltipY + tooltipHeight / 2);
  }

  // Forçar redesenho
  redraw(): void {
    this._draw();
  }
  
  // Simular clique em um marcador específico pelo ID
  triggerMarkerClick(markerId: string): void {
    const marker = this._markers.find(m => m.id === markerId);
    if (marker && this._onMarkerClick) {
      this._onMarkerClick(marker);
    }
  }
}

// Factory function para criar a camada
export function createCanvasMarkersLayer(options: CanvasMarkersLayerOptions): CanvasMarkersLayer {
  return new CanvasMarkersLayer(options);
}

