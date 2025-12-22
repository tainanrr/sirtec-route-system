import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Fix para ícones padrão do Leaflet (CDN)
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

export type TorreOSStatus =
  | "pendente"
  | "planejada"
  | "em_deslocamento"
  | "no_local"
  | "em_execucao"
  | "em_andamento"
  | "pausada"
  | "concluida"
  | "cancelada"
  | string;

export type TorreMarkerKind = "os" | "equipe";

export interface TorreMapaOSPoint {
  kind: "os";
  id: string;
  equipeId: string;
  equipeCodigo: string;
  ordemNaRota: number;
  numero: string;
  tipo: string;
  status: TorreOSStatus;
  regulada: boolean;
  lat: number;
  lng: number;
  endereco?: string | null;
}

export interface TorreMapaEquipePoint {
  kind: "equipe";
  equipeId: string;
  equipeCodigo: string;
  equipeNome?: string | null;
  statusEquipe?: string | null;
  lat: number;
  lng: number;
  updatedAt?: string | null;
}

export type TorreMapaPoint = TorreMapaOSPoint | TorreMapaEquipePoint;

export interface TorreRouteGeometry {
  // GeoJSON coordinates [lon, lat]
  coordinates: [number, number][];
  distance?: number;
  duration?: number;
}

interface Props {
  points: TorreMapaPoint[];
  selectedEquipeId?: string | null;
  selectedOSId?: string | null;
  routeGeometry?: TorreRouteGeometry | null;
  executedGeometry?: TorreRouteGeometry | null;
  isRouteLoading?: boolean;
  onSelect?: (payload: { kind: TorreMarkerKind; id: string; equipeId?: string }) => void;
}

function statusToColor(status: TorreOSStatus): { fill: string; stroke: string } {
  switch (status) {
    case "concluida":
      return { fill: "#16a34a", stroke: "#14532d" };
    case "cancelada":
      return { fill: "#64748b", stroke: "#334155" };
    case "em_deslocamento":
      return { fill: "#0ea5e9", stroke: "#075985" };
    case "no_local":
      return { fill: "#2563eb", stroke: "#1e3a8a" };
    case "em_execucao":
    case "em_andamento":
      return { fill: "#7c3aed", stroke: "#4c1d95" };
    case "pausada":
      return { fill: "#f59e0b", stroke: "#92400e" };
    case "planejada":
    case "pendente":
    default:
      return { fill: "#94a3b8", stroke: "#334155" };
  }
}

function makeDivIcon(html: string, className: string, size: [number, number], anchor?: [number, number]) {
  return L.divIcon({
    className,
    html,
    iconSize: size,
    iconAnchor: anchor ?? [size[0] / 2, size[1] / 2],
  });
}

export default function MapaTorreControle({
  points,
  selectedEquipeId,
  selectedOSId,
  routeGeometry,
  executedGeometry,
  isRouteLoading,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    markers: L.Layer[];
    polyline?: L.Polyline | null;
    executedPolyline?: L.Polyline | null;
  }>({ markers: [], polyline: null });

  const [isFullscreen, setIsFullscreen] = useState(false);

  const bounds = useMemo(() => {
    const latlngs = points
      .map((p) => ("lat" in p ? [p.lat, p.lng] : null))
      .filter(Boolean) as [number, number][];
    if (latlngs.length === 0) return null;
    return L.latLngBounds(latlngs.map(([lat, lng]) => L.latLng(lat, lng)));
  }, [points]);

  // Init map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Default view: Vitória da Conquista (fallback)
    map.setView([-14.8661, -40.8394], 12);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fit bounds when data arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!bounds) return;
    map.fitBounds(bounds.pad(0.15), { animate: true });
  }, [bounds]);

  // Fullscreen invalidate size
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [isFullscreen]);

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous
    layersRef.current.markers.forEach((layer) => map.removeLayer(layer));
    layersRef.current.markers = [];

    const osPoints = points.filter((p) => p.kind === "os") as TorreMapaOSPoint[];
    const equipePoints = points.filter((p) => p.kind === "equipe") as TorreMapaEquipePoint[];

    // Equipes (círculo com código)
    for (const eq of equipePoints) {
      const isSelected = selectedEquipeId && eq.equipeId === selectedEquipeId;
      const icon = makeDivIcon(
        `
          <div style="
            width: ${isSelected ? 34 : 30}px;
            height: ${isSelected ? 34 : 30}px;
            border-radius: 9999px;
            background: ${isSelected ? "#111827" : "#0f172a"};
            border: 2px solid ${isSelected ? "#60a5fa" : "rgba(255,255,255,.85)"};
            box-shadow: 0 10px 25px rgba(0,0,0,.25);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: .2px;
          ">
            ${eq.equipeCodigo}
          </div>
        `,
        "tc-eq-marker",
        [isSelected ? 34 : 30, isSelected ? 34 : 30],
      );
      const m = L.marker([eq.lat, eq.lng], { icon, interactive: true });
      m.on("click", () => onSelect?.({ kind: "equipe", id: eq.equipeId, equipeId: eq.equipeId }));
      m.addTo(map);
      layersRef.current.markers.push(m);
    }

    // OS (bolinha com ordem na rota)
    for (const os of osPoints) {
      const isEquipeSelected = selectedEquipeId ? os.equipeId === selectedEquipeId : false;
      const isOSSelected = selectedOSId ? os.id === selectedOSId : false;
      const colors = statusToColor(os.status);

      const size = isOSSelected ? 30 : isEquipeSelected ? 26 : 22;
      const icon = makeDivIcon(
        `
          <div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 9999px;
            background: ${colors.fill};
            border: 2px solid ${isOSSelected ? "#f8fafc" : colors.stroke};
            box-shadow: 0 8px 18px rgba(0,0,0,.22);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #0b1220;
            font-size: 11px;
            font-weight: 800;
          ">
            <span style="
              background: rgba(255,255,255,.88);
              padding: 1px 6px;
              border-radius: 9999px;
              border: 1px solid rgba(0,0,0,.15);
            ">
              ${os.ordemNaRota}
            </span>
          </div>
        `,
        "tc-os-marker",
        [size, size],
      );

      const marker = L.marker([os.lat, os.lng], { icon, interactive: true, zIndexOffset: isOSSelected ? 1000 : 0 });
      marker.on("click", () => onSelect?.({ kind: "os", id: os.id, equipeId: os.equipeId }));
      marker.bindTooltip(
        `<div style="min-width: 180px">
          <div style="font-weight: 700; margin-bottom: 2px">${os.equipeCodigo} • #${os.ordemNaRota} • ${os.numero}</div>
          <div style="opacity: .9; font-size: 12px">${os.tipo}${os.regulada ? " • <b>REGULADA</b>" : ""}</div>
          <div style="opacity: .7; font-size: 12px; margin-top: 2px">${os.endereco ? os.endereco : ""}</div>
        </div>`,
        { direction: "top", sticky: true, opacity: 0.95 }
      );
      marker.addTo(map);
      layersRef.current.markers.push(marker);
    }
  }, [points, selectedEquipeId, selectedOSId, onSelect]);

  // Render selected route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layersRef.current.polyline) {
      map.removeLayer(layersRef.current.polyline);
      layersRef.current.polyline = null;
    }

    if (!routeGeometry?.coordinates || routeGeometry.coordinates.length < 2) return;

    const latlngs = routeGeometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
    const poly = L.polyline(latlngs, {
      color: "#2563eb",
      weight: 5,
      opacity: 0.9,
    });
    poly.addTo(map);
    layersRef.current.polyline = poly;
  }, [routeGeometry]);

  // Render executed track polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layersRef.current.executedPolyline) {
      map.removeLayer(layersRef.current.executedPolyline);
      layersRef.current.executedPolyline = null;
    }

    if (!executedGeometry?.coordinates || executedGeometry.coordinates.length < 2) return;

    const latlngs = executedGeometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
    const poly = L.polyline(latlngs, {
      color: "#0f172a",
      weight: 4,
      opacity: 0.55,
      dashArray: "8 10",
    });
    poly.addTo(map);
    layersRef.current.executedPolyline = poly;
  }, [executedGeometry]);

  return (
    <div
      className={cn(
        "relative w-full rounded-xl border border-border bg-card overflow-hidden",
        isFullscreen ? "fixed inset-2 z-[60] rounded-xl shadow-2xl" : "h-[520px]"
      )}
    >
      <div ref={containerRef} className={cn("h-full w-full", isFullscreen ? "rounded-xl" : "")} />

      {/* Overlay Top Left */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <Badge variant="secondary" className="bg-card/80 backdrop-blur border">
          Mapa ao vivo
        </Badge>
        {isRouteLoading ? (
          <Badge variant="secondary" className="bg-card/80 backdrop-blur border gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Calculando rota…
          </Badge>
        ) : routeGeometry?.distance != null ? (
          <Badge variant="secondary" className="bg-card/80 backdrop-blur border">
            Rota: {(routeGeometry.distance / 1000).toFixed(1)} km
          </Badge>
        ) : null}
      </div>

      {/* Controls */}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="h-9 w-9 bg-card/80 backdrop-blur border"
          onClick={() => setIsFullscreen((v) => !v)}
          title={isFullscreen ? "Sair do modo tela cheia" : "Tela cheia"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}


