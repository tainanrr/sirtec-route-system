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
  nomeServico?: string; // Nome do tipo de serviço (ex: "Corte A")
  prazo?: string; // Prazo formatado (ex: "04/01/2026, 23:59")
  cor: string; // Cor da borda baseada em prioridade (vermelho para regulada, etc)
  corMarcador?: string; // Cor de preenchimento do marcador (da skill)
  sigla?: string; // Sigla de até 3 caracteres (da skill)
  selecionado?: boolean;
  regulada?: boolean;
}

interface CanvasMarkersLayerOptions extends L.LayerOptions {
  markers: CanvasMarker[];
  onMarkerClick?: (marker: CanvasMarker) => void;
  onMarkerHover?: (marker: CanvasMarker | null) => void;
}

// Cores por GRUPO de serviço (baseado nos grupos cadastrados)
// Cada grupo tem uma cor distinta para fácil identificação visual
const CORES_GRUPO: Record<string, string> = {
  'cobranca': '#ef4444',        // Vermelho - Corte, Recorte (cobrança)
  'religacao': '#22c55e',       // Verde - Religa (reconexão)
  'ligacao': '#3b82f6',         // Azul - Ligação Nova, Alteração, Modificação
  'baixa_verificacao': '#f97316', // Laranja - Baixa, Verificação
  'enlace': '#06b6d4',          // Ciano - Enlace
  'varredura': '#8b5cf6',       // Roxo - Varredura
  'microgeracao': '#10b981',    // Esmeralda - Microgeração
  'default': '#6b7280',         // Cinza - Outros
};

// Mapeamento de tipos de serviço para grupos
function getGrupoServico(tipo: string): string {
  const tipoUpper = tipo.toUpperCase();
  
  // Grupo Cobrança: Corte, Recorte
  if (tipoUpper.includes('CORTE') || tipoUpper.includes('RECORTE')) {
    return 'cobranca';
  }
  
  // Grupo Religação: Religa, Reativação
  if (tipoUpper.includes('RELIGA') || tipoUpper.includes('REATIVACAO')) {
    return 'religacao';
  }
  
  // Grupo Ligação: Ligação Nova, Alteração, Modificação
  if (tipoUpper.includes('LIGACAO') || tipoUpper.includes('ALTERACAO') || tipoUpper.includes('MODIF')) {
    return 'ligacao';
  }
  
  // Grupo Baixa/Verificação
  if (tipoUpper.includes('BAIXA') || tipoUpper.includes('VERIFICACAO')) {
    return 'baixa_verificacao';
  }
  
  // Grupo Enlace
  if (tipoUpper.includes('ENLACE')) {
    return 'enlace';
  }
  
  // Grupo Varredura
  if (tipoUpper.includes('VARREDURA')) {
    return 'varredura';
  }
  
  // Grupo Microgeração
  if (tipoUpper.includes('MICROGER')) {
    return 'microgeracao';
  }
  
  return 'default';
}

// Obter cor baseada no tipo (usando grupo)
function getCorTipo(tipo: string): string {
  const grupo = getGrupoServico(tipo);
  return CORES_GRUPO[grupo] || CORES_GRUPO.default;
}

// Letras/símbolos para cada grupo de serviço (desenhados no canvas)
// Cada grupo tem uma letra distintiva além da cor para fácil identificação
const LETRAS_GRUPO: Record<string, string> = {
  'cobranca': 'C',        // C - Corte/Recorte (cobrança)
  'religacao': 'R',       // R - Religação/Religa
  'ligacao': 'L',         // L - Ligação
  'baixa_verificacao': 'B', // B - Baixa/Verificação
  'enlace': 'E',          // E - Enlace
  'varredura': 'V',       // V - Varredura
  'microgeracao': 'M',    // M - Microgeração
  'default': '?',         // ? - Outros
};

// Obter letra do grupo
function getLetraGrupo(tipo: string): string {
  const grupo = getGrupoServico(tipo);
  return LETRAS_GRUPO[grupo] || LETRAS_GRUPO.default;
}

// Classe da camada de canvas
export class CanvasMarkersLayer extends L.Layer {
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _markers: CanvasMarker[] = [];
  private _onMarkerClick?: (marker: CanvasMarker) => void;
  private _onMarkerHover?: (marker: CanvasMarker | null) => void;
  private _hoveredMarker: CanvasMarker | null = null;
  private _markerRadius = 14; // Raio base para detecção de clique
  private _bounds: L.LatLngBounds | null = null;
  private _pendingImages = new Set<string>(); // URLs de imagens sendo carregadas
  private _animationFrame: number | null = null;
  private _hasReguladas = false; // Flag para saber se precisa animar

  constructor(options: CanvasMarkersLayerOptions) {
    super(options);
    this._markers = options.markers || [];
    this._onMarkerClick = options.onMarkerClick;
    this._onMarkerHover = options.onMarkerHover;
    // Verificar se há marcadores regulados para iniciar animação
    this._hasReguladas = this._markers.some(m => m.regulada);
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
    
    // Parar animação
    this._stopAnimation();

    return this;
  }

  // Atualizar marcadores
  setMarkers(markers: CanvasMarker[]): void {
    this._markers = markers;
    this._hasReguladas = markers.some(m => m.regulada);
    this._draw();
    // Iniciar animação se houver reguladas (com intervalo otimizado)
    if (this._hasReguladas && !this._animationFrame) {
      this._startAnimation();
    } else if (!this._hasReguladas && this._animationFrame) {
      this._stopAnimation();
    }
  }

  // Iniciar animação de pulso para marcadores regulados
  // Usa setInterval com taxa muito reduzida para não sobrecarregar
  private _startAnimation(): void {
    // Usar setInterval com 200ms (5fps) - suficiente para efeito de pulso
    // E muito mais leve que requestAnimationFrame (60fps)
    this._animationFrame = window.setInterval(() => {
      if (this._hasReguladas && this._map && this._ctx) {
        this._draw();
      }
    }, 200) as unknown as number; // 200ms = 5fps
  }

  // Parar animação
  private _stopAnimation(): void {
    if (this._animationFrame) {
      clearInterval(this._animationFrame);
      this._animationFrame = null;
    }
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
    const zoom = this._map?.getZoom() || 12;
    // Usar cor e sigla do marcador se disponível, senão usar valores calculados
    const corMarcador = marker.corMarcador || getCorTipo(marker.tipo);
    const sigla = marker.sigla || getLetraGrupo(marker.tipo);
    
    // Raio baseado no zoom para melhor visualização
    const baseRadius = marker.selecionado ? 18 : (zoom >= 15 ? 16 : zoom >= 13 ? 14 : 12);
    
    // Efeito de pulso para reguladas (usando tempo atual)
    // Pulso mais lento (500ms) para funcionar bem com animação de 5fps
    const time = Date.now();
    const pulsePhase = (Math.sin(time / 500) + 1) / 2; // Valor entre 0 e 1, pulsa a cada ~1s
    
    // Para reguladas: desenhar anel de pulso externo primeiro
    if (marker.regulada) {
      const pulseRadius = baseRadius + 3 + (pulsePhase * 5); // Expande de 3 a 8 pixels além
      const pulseOpacity = 0.5 - (pulsePhase * 0.4); // Opacidade diminui conforme expande
      
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 0, 0, ${pulseOpacity})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Sombra suave (mais forte para reguladas)
    if (marker.regulada) {
      ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
      ctx.shadowBlur = 10;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 4;
    }
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    // Círculo principal preenchido com a cor do marcador
    ctx.beginPath();
    ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
    
    if (marker.selecionado) {
      // Selecionado: fundo azul brilhante
      ctx.fillStyle = '#3b82f6';
    } else {
      // Normal: cor da skill
      ctx.fillStyle = corMarcador;
    }
    ctx.fill();
    
    // Borda externa
    if (marker.regulada) {
      // Regulada urgente: borda vermelha VIVA e grossa
      ctx.strokeStyle = '#ff0000'; // Vermelho puro e vivo
      ctx.lineWidth = 4; // Mais grossa
    } else if (marker.selecionado) {
      // Selecionado: borda azul escura
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 3;
    } else {
      // Normal: borda branca para contraste
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
    }
    ctx.stroke();
    
    // Resetar sombra
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // Sigla no centro (apenas se zoom suficiente para ver)
    if (zoom >= 12) {
      // Ajustar tamanho da fonte baseado no tamanho da sigla
      const siglaLen = sigla.length;
      const baseFontSize = marker.selecionado ? 13 : (zoom >= 15 ? 12 : zoom >= 13 ? 11 : 10);
      const fontSize = siglaLen > 2 ? baseFontSize - 2 : baseFontSize;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sigla, x, y);
    }
    
    // Número da OS abaixo do marcador (apenas se zoom alto)
    if (zoom >= 16) {
      ctx.font = 'bold 9px Arial';
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      // Mostrar últimos 4 dígitos do número
      const shortNum = marker.numero.slice(-4);
      ctx.fillText(shortNum, x, y + baseRadius + 4);
    }
  }

  // Desenhar marcador com hover
  private _drawMarkerHover(ctx: CanvasRenderingContext2D, x: number, y: number, marker: CanvasMarker): void {
    const zoom = this._map?.getZoom() || 12;
    // Hover deve ser maior que o marcador normal
    const radius = zoom >= 15 ? 20 : zoom >= 13 ? 18 : 16;
    // Usar cor e sigla do marcador se disponível
    const corMarcador = marker.corMarcador || getCorTipo(marker.tipo);
    const sigla = marker.sigla || getLetraGrupo(marker.tipo);
    
    // Efeito de pulso para reguladas (usando tempo atual)
    // Pulso mais lento (500ms) para funcionar bem com animação de 5fps
    const time = Date.now();
    const pulsePhase = (Math.sin(time / 500) + 1) / 2;
    
    // Para reguladas: desenhar anel de pulso externo primeiro
    if (marker.regulada) {
      const pulseRadius = radius + 4 + (pulsePhase * 6);
      const pulseOpacity = 0.6 - (pulsePhase * 0.4);
      
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 0, 0, ${pulseOpacity})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Sombra (mais forte para reguladas)
    if (marker.regulada) {
      ctx.shadowColor = 'rgba(255, 0, 0, 0.6)';
      ctx.shadowBlur = 12;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 8;
    }
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    // Fundo
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = corMarcador;
    ctx.fill();
    
    // Borda - VERMELHA para reguladas, branca para outras
    if (marker.regulada) {
      ctx.strokeStyle = '#ff0000'; // Vermelho vivo mantido no hover
      ctx.lineWidth = 4;
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
    }
    ctx.stroke();
    
    // Resetar sombra
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // Sigla no centro (hover)
    const siglaLen = sigla.length;
    const fontSize = siglaLen > 2 ? 11 : 13;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sigla, x, y);
    
    // Tooltip com número, nome do serviço e prazo (se regulada)
    const tooltipY = y - radius - 25;
    const nomeServico = marker.nomeServico || marker.tipo;
    // Formato: "Numero | Nome" ou "Numero | Nome | Prazo" para reguladas
    let tooltipText = `${marker.numero} | ${nomeServico}`;
    if (marker.regulada && marker.prazo) {
      tooltipText += ` | ${marker.prazo}`;
    }
    
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

