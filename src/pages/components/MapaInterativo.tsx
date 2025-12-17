import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OrdemServico, Equipe } from "@/data/mockData";
import { RotaEquipe } from "@/lib/routingUtils";

// Função para inicializar ícones do Leaflet
function initLeafletIcons() {
  try {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  } catch (error) {
    console.warn("Erro ao inicializar ícones do Leaflet:", error);
  }
}

// Componente para ajustar o mapa quando as rotas mudam
function MapUpdater({ rotas }: { rotas: RotaEquipe[] }) {
  const map = useMap();

  useEffect(() => {
    if (rotas.length > 0 && rotas.some((r) => r.servicos.length > 0)) {
      const bounds: L.LatLngTuple[] = [];
      
      // Adicionar pontos das equipes
      rotas.forEach((rota) => {
        bounds.push([rota.equipe.latitude, rota.equipe.longitude]);
        rota.servicos.forEach((servico) => {
          bounds.push([
            servico.ordemServico.latitude,
            servico.ordemServico.longitude,
          ]);
        });
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
      }
    }
  }, [rotas, map]);

  return null;
}

interface MapaInterativoProps {
  rotas: RotaEquipe[];
  osPendentes: OrdemServico[];
  equipesMock: Equipe[];
}

export default function MapaInterativo({ 
  rotas, 
  osPendentes, 
  equipesMock 
}: MapaInterativoProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    try {
      initLeafletIcons();
      setIsMounted(true);
    } catch (error) {
      console.error("Erro ao montar mapa:", error);
      setHasError(true);
    }
  }, []);

  if (hasError) {
    return (
      <div className="relative h-[600px] bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto">
            <MapPin className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-sm text-destructive">Erro ao carregar mapa</p>
        </div>
      </div>
    );
  }

  if (!isMounted) {
    return (
      <div className="relative h-[600px] bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  const coresRotas = [
    "#3b82f6", // azul
    "#10b981", // verde
    "#f59e0b", // amarelo
    "#ef4444", // vermelho
    "#8b5cf6", // roxo
  ];

  return (
    <MapContainer
      center={[-14.8661, -40.8394]}  {/* Vitória da Conquista, BA */}
      zoom={12}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater rotas={rotas} />

      {/* Marcadores das Equipes (Pontos de Saída) */}
      {equipesMock.map((equipe) => (
        <Marker
          key={`equipe-${equipe.id}`}
          position={[equipe.latitude, equipe.longitude]}
          icon={L.divIcon({
            className: "custom-marker-base",
            html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })}
        >
          <Popup>
            <div className="text-sm">
              <strong>{equipe.codigo}</strong>
              <br />
              {equipe.tecnico}
              <br />
              <span className="text-muted-foreground">Base de Saída</span>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Marcadores das OS Pendentes (Amarelo) */}
      {osPendentes.map((os) => (
        <Marker
          key={`os-pendente-${os.id}`}
          position={[os.latitude, os.longitude]}
          icon={L.divIcon({
            className: "custom-marker-pendente",
            html: `<div style="background-color: #f59e0b; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })}
        >
          <Popup>
            <div className="text-sm">
              <strong>{os.numero}</strong>
              <br />
              {os.tipo}
              <br />
              {os.endereco}
              {os.regulada && (
                <>
                  <br />
                  <span className="text-red-600 font-bold text-xs">REGULADA</span>
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Marcadores das OS Alocadas e Rotas */}
      {rotas.map((rota, idxRota) => {
        const cor = coresRotas[idxRota % coresRotas.length];
        const pontos: L.LatLngTuple[] = [
          [rota.equipe.latitude, rota.equipe.longitude],
        ];

        rota.servicos.forEach((servico) => {
          pontos.push([
            servico.ordemServico.latitude,
            servico.ordemServico.longitude,
          ]);
        });

        return (
          <div key={`rota-${rota.equipe.id}`}>
            {/* Linha da rota */}
            {pontos.length > 1 && (
              <Polyline
                positions={pontos}
                pathOptions={{
                  color: cor,
                  weight: 3,
                  opacity: 0.7,
                }}
              />
            )}

            {/* Marcadores das OS alocadas */}
            {rota.servicos.map((servico) => (
              <Marker
                key={`os-alocada-${servico.ordemServico.id}`}
                position={[
                  servico.ordemServico.latitude,
                  servico.ordemServico.longitude,
                ]}
                icon={L.divIcon({
                  className: "custom-marker-alocada",
                  html: `<div style="background-color: ${cor}; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${servico.ordemNaRota}</div>`,
                  iconSize: [18, 18],
                  iconAnchor: [9, 9],
                })}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{servico.ordemServico.numero}</strong>
                    <br />
                    {servico.ordemServico.tipo}
                    <br />
                    Ordem: {servico.ordemNaRota}
                    <br />
                    Equipe: {rota.equipe.codigo}
                  </div>
                </Popup>
              </Marker>
            ))}
          </div>
        );
      })}
    </MapContainer>
  );
}



