import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { 
  EquipeTurnoAberto, 
  useEquipesRastreamento,
  EVENTO_CONFIG 
} from "@/hooks/useEquipesRastreamento";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

// =====================================================
// TIPOS
// =====================================================

interface EquipesMapLayerProps {
  map: L.Map | null;
  visible?: boolean;
  onEquipeClick?: (equipe: EquipeTurnoAberto) => void;
  onVerTrajetoClick?: (equipe: EquipeTurnoAberto) => void;
  equipeSelecionada?: string | null;
}

// Cores por status do último evento
const STATUS_CORES: Record<string, { bg: string; border: string; pulse: boolean }> = {
  inicio_deslocamento: { bg: "#3b82f6", border: "#1d4ed8", pulse: true }, // Azul - em deslocamento
  chegada_local: { bg: "#8b5cf6", border: "#6d28d9", pulse: false }, // Roxo - no local
  inicio_servico: { bg: "#14b8a6", border: "#0d9488", pulse: true }, // Teal - em execução
  fim_servico: { bg: "#22c55e", border: "#16a34a", pulse: false }, // Verde - concluiu
  inicio_intervalo: { bg: "#ec4899", border: "#db2777", pulse: false }, // Rosa - intervalo
  parada_detectada: { bg: "#f43f5e", border: "#e11d48", pulse: true }, // Vermelho - parada
  inicio_turno: { bg: "#64748b", border: "#475569", pulse: false }, // Cinza - início
  default: { bg: "#6b7280", border: "#4b5563", pulse: false }, // Cinza padrão
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function EquipesMapLayer({
  map,
  visible = true,
  onEquipeClick,
  onVerTrajetoClick,
  equipeSelecionada,
}: EquipesMapLayerProps) {
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const pulseCirclesRef = useRef<Map<string, L.Circle>>(new Map());
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  
  const { equipesComTurno, isLoading, refetch } = useEquipesRastreamento({
    autoRefresh: true,
    refreshInterval: 15000, // Atualizar a cada 15 segundos
    enableRealtime: true,
  });

  // =====================================================
  // CRIAR ÍCONE DA EQUIPE (formato de carro/van)
  // =====================================================
  const criarIconeEquipe = useCallback((equipe: EquipeTurnoAberto, isSelecionada: boolean) => {
    const statusConfig = STATUS_CORES[equipe.ultimo_evento_tipo || "default"] || STATUS_CORES.default;
    const largura = isSelecionada ? 56 : 48;
    const altura = isSelecionada ? 32 : 28;
    const corFundo = statusConfig.bg;
    const corBorda = isSelecionada ? "#ffffff" : statusConfig.border;
    
    // Calcular tempo desde última posição
    let gpsStatus = "🟢";
    if (equipe.ultima_posicao_at) {
      const diffMinutos = (Date.now() - new Date(equipe.ultima_posicao_at).getTime()) / 60000;
      if (diffMinutos > 30) {
        gpsStatus = "🔴"; // Sem posição há muito tempo
      } else if (diffMinutos > 10) {
        gpsStatus = "🟡"; // Posição desatualizada
      }
    } else {
      gpsStatus = "⚫"; // Sem posição
    }

    // Pegar os 3 ÚLTIMOS caracteres do código da equipe
    const codigo = equipe.equipe_codigo || "EQP";
    const ultimos3 = codigo.slice(-3).toUpperCase();

    const html = `
      <div class="equipe-marker-car ${isSelecionada ? 'selecionada' : ''}" style="
        position: relative;
        width: ${largura}px;
        height: ${altura + 12}px;
        cursor: pointer;
        transition: all 0.2s ease;
      ">
        <!-- Corpo do carro/van -->
        <div style="
          width: ${largura}px;
          height: ${altura}px;
          background: linear-gradient(180deg, ${corFundo} 0%, ${statusConfig.border} 100%);
          border: ${isSelecionada ? '3px' : '2px'} solid ${corBorda};
          border-radius: 6px 6px 4px 4px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          position: relative;
          overflow: hidden;
        ">
          <!-- Janela do carro -->
          <div style="
            position: absolute;
            top: 3px;
            left: 4px;
            right: 4px;
            height: ${isSelecionada ? '10px' : '8px'};
            background: linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 100%);
            border-radius: 3px 3px 0 0;
          "></div>
          
          <!-- Código da equipe -->
          <div style="
            position: absolute;
            bottom: 2px;
            left: 0;
            right: 0;
            text-align: center;
            font-weight: 800;
            font-size: ${isSelecionada ? '13px' : '11px'};
            color: white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.6);
            letter-spacing: 0.5px;
          ">${ultimos3}</div>
        </div>
        
        <!-- Rodas -->
        <div style="
          position: absolute;
          bottom: 0;
          left: 6px;
          width: 8px;
          height: 8px;
          background: #1f2937;
          border-radius: 50%;
          border: 2px solid #374151;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
        <div style="
          position: absolute;
          bottom: 0;
          right: 6px;
          width: 8px;
          height: 8px;
          background: #1f2937;
          border-radius: 50%;
          border: 2px solid #374151;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
        
        <!-- Indicador de GPS -->
        <div style="
          position: absolute;
          top: -6px;
          right: -6px;
          font-size: 10px;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
        ">${gpsStatus}</div>
        
        ${statusConfig.pulse ? `
          <div style="
            position: absolute;
            top: -4px;
            left: -4px;
            right: -4px;
            bottom: 4px;
            border-radius: 8px;
            border: 2px solid ${corFundo};
            animation: pulse-car 2s infinite;
            pointer-events: none;
          "></div>
        ` : ''}
      </div>
      <style>
        @keyframes pulse-car {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.3); }
        }
        .equipe-marker-car:hover {
          transform: scale(1.1) translateY(-2px);
        }
        .equipe-marker-car.selecionada {
          z-index: 10000 !important;
        }
      </style>
    `;

    return L.divIcon({
      className: "custom-equipe-marker",
      html,
      iconSize: [largura, altura + 12],
      iconAnchor: [largura / 2, (altura + 12) / 2],
      popupAnchor: [0, -(altura / 2) - 10],
    });
  }, []);

  // =====================================================
  // CRIAR CONTEÚDO DO POPUP
  // =====================================================
  const criarPopupContent = useCallback((equipe: EquipeTurnoAberto): string => {
    const statusConfig = EVENTO_CONFIG[equipe.ultimo_evento_tipo || "inicio_turno"] || EVENTO_CONFIG.inicio_turno;
    
    // Formatar horários
    const horaInicio = equipe.hora_inicio 
      ? format(new Date(equipe.hora_inicio), "HH:mm", { locale: ptBR })
      : "N/A";
    
    const ultimaPosicaoFormatada = equipe.ultima_posicao_at
      ? formatDistanceToNow(new Date(equipe.ultima_posicao_at), { addSuffix: true, locale: ptBR })
      : "Sem posição";

    // Colaboradores
    const colaboradoresHtml = equipe.colaboradores?.length
      ? equipe.colaboradores.map(c => `
          <div style="display: flex; align-items: center; gap: 6px; padding: 3px 0;">
            <span style="
              width: 24px; height: 24px;
              background: #f1f5f9;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: 600;
              color: #475569;
            ">${c.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
            <span style="font-size: 12px; color: #374151;">${c.nome}</span>
            ${c.funcao === 'lider' ? '<span style="font-size: 10px; background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 4px;">Líder</span>' : ''}
          </div>
        `).join('')
      : '<span style="color: #9ca3af; font-size: 12px;">Nenhum colaborador registrado</span>';

    // OS Atual
    const osAtualHtml = equipe.os_atual
      ? `
        <div style="
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 10px;
          margin-top: 10px;
        ">
          <div style="font-size: 10px; color: #0369a1; font-weight: 600; margin-bottom: 4px;">
            📋 OS EM ATENDIMENTO
          </div>
          <div style="font-weight: 700; color: #0c4a6e; font-size: 13px;">
            ${equipe.os_atual.numero}
          </div>
          <div style="font-size: 11px; color: #075985;">
            ${equipe.os_atual.tipo}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            📍 ${equipe.os_atual.endereco?.substring(0, 50)}...
          </div>
        </div>
      `
      : '';

    // Bateria e velocidade
    const telemetriaHtml = `
      <div style="display: flex; gap: 12px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
        ${equipe.battery_pct !== null ? `
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 12px;">${equipe.battery_pct > 50 ? '🔋' : equipe.battery_pct > 20 ? '🪫' : '⚠️'}</span>
            <span style="font-size: 11px; color: ${equipe.battery_pct > 20 ? '#374151' : '#ef4444'};">${equipe.battery_pct}%</span>
          </div>
        ` : ''}
        ${equipe.speed_mps !== null ? `
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 12px;">🚗</span>
            <span style="font-size: 11px; color: #374151;">${Math.round(equipe.speed_mps * 3.6)} km/h</span>
          </div>
        ` : ''}
        ${equipe.gps_ativo !== null ? `
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 12px;">${equipe.gps_ativo ? '📡' : '📵'}</span>
            <span style="font-size: 11px; color: ${equipe.gps_ativo ? '#22c55e' : '#ef4444'};">GPS ${equipe.gps_ativo ? 'Ativo' : 'Inativo'}</span>
          </div>
        ` : ''}
      </div>
    `;

    return `
      <div style="min-width: 280px; max-width: 350px; font-family: system-ui, -apple-system, sans-serif;">
        <!-- Cabeçalho -->
        <div style="
          background: linear-gradient(135deg, ${statusConfig.cor} 0%, ${statusConfig.cor}dd 100%);
          color: white;
          padding: 12px 14px;
          margin: -10px -10px 12px -10px;
          border-radius: 4px 4px 0 0;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 700; font-size: 16px;">
                ${equipe.equipe_codigo}
              </div>
              <div style="font-size: 11px; opacity: 0.9;">
                ${equipe.equipe_nome}
              </div>
            </div>
            <div style="
              background: rgba(255,255,255,0.2);
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            ">
              ${statusConfig.label}
            </div>
          </div>
        </div>
        
        <!-- Informações do Turno -->
        <div style="padding: 0 4px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
            <div>
              <div style="font-size: 10px; color: #9ca3af; font-weight: 500;">INÍCIO TURNO</div>
              <div style="font-size: 13px; font-weight: 600; color: #1f2937;">${horaInicio}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: #9ca3af; font-weight: 500;">PLACA</div>
              <div style="font-size: 13px; font-weight: 600; color: #1f2937;">${equipe.placa_veiculo || 'N/A'}</div>
            </div>
          </div>
          
          <div style="margin-bottom: 10px;">
            <div style="font-size: 10px; color: #9ca3af; font-weight: 500;">ÚLTIMA POSIÇÃO</div>
            <div style="font-size: 12px; color: #374151;">${ultimaPosicaoFormatada}</div>
          </div>
          
          <!-- Colaboradores -->
          <div style="margin-bottom: 8px;">
            <div style="font-size: 10px; color: #9ca3af; font-weight: 500; margin-bottom: 6px;">COLABORADORES</div>
            ${colaboradoresHtml}
          </div>
          
          ${osAtualHtml}
          
          ${telemetriaHtml}
          
          <!-- Botão Ver Trajeto -->
          <button 
            onclick="window.dispatchEvent(new CustomEvent('verTrajetoEquipe', { detail: '${equipe.turno_id}' }))"
            style="
              width: 100%;
              margin-top: 12px;
              padding: 10px;
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 13px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
              transition: all 0.2s;
            "
            onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(59,130,246,0.4)'"
            onmouseout="this.style.transform='none'; this.style.boxShadow='none'"
          >
            🗺️ Ver Trajeto Completo
          </button>
        </div>
      </div>
    `;
  }, []);

  // =====================================================
  // ATUALIZAR MARCADORES NO MAPA
  // =====================================================
  useEffect(() => {
    if (!map || !visible) {
      // Limpar marcadores se não visível
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
      }
      return;
    }

    // Criar layer group se não existe
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    // Atualizar ou criar marcadores para cada equipe
    const equipesIds = new Set<string>();

    equipesComTurno.forEach(equipe => {
      // Só mostrar equipes com posição válida
      if (!equipe.ultima_latitude || !equipe.ultima_longitude) return;

      equipesIds.add(equipe.equipe_id);
      const isSelecionada = equipeSelecionada === equipe.equipe_id;
      const marker = markersRef.current.get(equipe.equipe_id);

      if (marker) {
        // Atualizar marcador existente
        marker.setLatLng([equipe.ultima_latitude, equipe.ultima_longitude]);
        marker.setIcon(criarIconeEquipe(equipe, isSelecionada));
        marker.getPopup()?.setContent(criarPopupContent(equipe));
      } else {
        // Criar novo marcador
        const novoMarker = L.marker(
          [equipe.ultima_latitude, equipe.ultima_longitude],
          {
            icon: criarIconeEquipe(equipe, isSelecionada),
            zIndexOffset: isSelecionada ? 1000 : 500,
          }
        );

        novoMarker.bindPopup(criarPopupContent(equipe), {
          maxWidth: 380,
          className: "equipe-popup",
        });

        novoMarker.on("click", () => {
          onEquipeClick?.(equipe);
        });

        novoMarker.addTo(layerGroupRef.current!);
        markersRef.current.set(equipe.equipe_id, novoMarker);
      }
    });

    // Remover marcadores de equipes que não estão mais na lista
    markersRef.current.forEach((marker, equipeId) => {
      if (!equipesIds.has(equipeId)) {
        layerGroupRef.current?.removeLayer(marker);
        markersRef.current.delete(equipeId);
      }
    });

  }, [map, visible, equipesComTurno, equipeSelecionada, criarIconeEquipe, criarPopupContent, onEquipeClick]);

  // =====================================================
  // EVENT LISTENER PARA VER TRAJETO
  // =====================================================
  useEffect(() => {
    const handleVerTrajeto = (event: CustomEvent) => {
      const turnoId = event.detail;
      const equipe = equipesComTurno.find(e => e.turno_id === turnoId);
      if (equipe && onVerTrajetoClick) {
        onVerTrajetoClick(equipe);
      }
    };

    window.addEventListener("verTrajetoEquipe", handleVerTrajeto as EventListener);
    return () => {
      window.removeEventListener("verTrajetoEquipe", handleVerTrajeto as EventListener);
    };
  }, [equipesComTurno, onVerTrajetoClick]);

  // =====================================================
  // CLEANUP
  // =====================================================
  useEffect(() => {
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
      }
      markersRef.current.clear();
      pulseCirclesRef.current.clear();
    };
  }, []);

  return null; // Componente não renderiza nada visível, apenas manipula o mapa
}

// =====================================================
// COMPONENTE: PAINEL DE ESTATÍSTICAS DAS EQUIPES
// =====================================================
export function EquipesRastreamentoStats() {
  const { estatisticas, equipesComTurno, isLoading } = useEquipesRastreamento();

  if (isLoading) {
    return (
      <div className="p-4 bg-white/90 backdrop-blur rounded-lg shadow-lg">
        <div className="animate-pulse flex space-x-4">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
    );
  }

  if (!estatisticas) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚛</span>
            <span className="font-semibold text-white">Equipes em Campo</span>
          </div>
          <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-bold">
            {estatisticas.total}
          </span>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="p-3 grid grid-cols-4 gap-2 text-center">
        <div className="p-2 rounded-lg bg-blue-50">
          <div className="text-lg font-bold text-blue-600">{estatisticas.emDeslocamento}</div>
          <div className="text-xs text-blue-700">Deslocando</div>
        </div>
        <div className="p-2 rounded-lg bg-teal-50">
          <div className="text-lg font-bold text-teal-600">{estatisticas.emServico}</div>
          <div className="text-xs text-teal-700">Em Serviço</div>
        </div>
        <div className="p-2 rounded-lg bg-pink-50">
          <div className="text-lg font-bold text-pink-600">{estatisticas.emIntervalo}</div>
          <div className="text-xs text-pink-700">Intervalo</div>
        </div>
        <div className="p-2 rounded-lg bg-gray-50">
          <div className="text-lg font-bold text-gray-600">{estatisticas.ociosas}</div>
          <div className="text-xs text-gray-700">Ociosas</div>
        </div>
      </div>

      {/* Alertas */}
      {estatisticas.semPosicaoRecente > 0 && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-amber-500">⚠️</span>
            <span className="text-xs text-amber-700">
              {estatisticas.semPosicaoRecente} equipe(s) sem posição há mais de 10 min
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
