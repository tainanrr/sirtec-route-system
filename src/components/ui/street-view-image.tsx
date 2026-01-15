import { useState, useEffect } from "react";
import { Building2, MapPinOff, ExternalLink, Loader2, Eye, EyeOff, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStreetViewImageUrl, checkStreetViewAvailability, StreetViewOptions } from "@/lib/streetView";
import { getStreetViewFromCache } from "@/lib/streetViewCache";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog";

export interface StreetViewImageProps {
  /** Latitude da localização */
  latitude: number | null | undefined;
  /** Longitude da localização */
  longitude: number | null | undefined;
  /** Endereço para exibir quando não há coordenadas */
  endereco?: string;
  /** Classes CSS adicionais para o container */
  className?: string;
  /** Tamanho da imagem */
  size?: "sm" | "md" | "lg";
  /** Mostra botão para expandir em modal */
  showExpandButton?: boolean;
  /** Direção inicial da câmera (0-360) */
  heading?: number;
  /** Callback quando a imagem é carregada */
  onImageLoad?: () => void;
  /** Callback quando não há imagem disponível */
  onNoImage?: () => void;
  /** Label personalizado */
  label?: string;
  /** Se deve verificar disponibilidade antes de carregar */
  checkAvailability?: boolean;
  /** Permite toggle de visibilidade (para economizar requisições) */
  collapsible?: boolean;
  /** Estado inicial do collapse */
  defaultCollapsed?: boolean;
}

const sizeConfig = {
  sm: { width: 200, height: 150, className: "h-[100px]" },
  md: { width: 400, height: 250, className: "h-[150px]" },
  lg: { width: 600, height: 400, className: "h-[200px]" },
};

export function StreetViewImage({
  latitude,
  longitude,
  endereco,
  className,
  size = "md",
  showExpandButton = true,
  heading,
  onImageLoad,
  onNoImage,
  label = "Possível Fachada",
  checkAvailability = false,
  collapsible = false,
  defaultCollapsed = true,
}: StreetViewImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  
  const { width, height, className: sizeClassName } = sizeConfig[size];
  
  const hasCoordinates = latitude != null && longitude != null && 
    !isNaN(latitude) && !isNaN(longitude);
  
  const options: StreetViewOptions | null = hasCoordinates
    ? {
        latitude: latitude!,
        longitude: longitude!,
        width,
        height,
        heading: heading ?? 0,
        pitch: 0,
        fov: 90,
        radius: 100,
        source: "outdoor",
      }
    : null;
  
  const onlineImageUrl = options ? getStreetViewImageUrl(options) : null;
  
  // Verificar cache primeiro quando não está collapsed
  useEffect(() => {
    if (hasCoordinates && !isCollapsed && !cachedUrl) {
      getStreetViewFromCache(latitude!, longitude!).then((cached) => {
        if (cached) {
          console.log("[StreetView] ✅ Imagem encontrada no cache");
          setCachedUrl(cached);
          setIsFromCache(true);
        }
      });
    }
  }, [latitude, longitude, hasCoordinates, isCollapsed, cachedUrl]);
  
  // A URL a ser usada: cache primeiro, depois online
  const imageUrl = cachedUrl || onlineImageUrl;
  
  // Verificar disponibilidade se solicitado
  useEffect(() => {
    if (checkAvailability && hasCoordinates && !isCollapsed) {
      checkStreetViewAvailability(latitude!, longitude!).then((metadata) => {
        if (metadata?.status === "OK") {
          setIsAvailable(true);
        } else {
          setIsAvailable(false);
          onNoImage?.();
        }
      });
    }
  }, [latitude, longitude, checkAvailability, hasCoordinates, isCollapsed, onNoImage]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onImageLoad?.();
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
    onNoImage?.();
  };

  const openInGoogleMaps = () => {
    if (hasCoordinates) {
      const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`;
      window.open(url, "_blank");
    }
  };

  // Se collapsible, mostrar botão de toggle
  if (collapsible && isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        disabled={!hasCoordinates}
        className={cn(
          "w-full flex items-center gap-2 p-3 rounded-lg border transition-colors text-sm",
          hasCoordinates 
            ? "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700" 
            : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed",
          className
        )}
      >
        <Building2 className="h-4 w-4" />
        <span>
          {hasCoordinates 
            ? "🔍 Ver possível fachada (Street View)" 
            : "Sem coordenadas para Street View"}
        </span>
      </button>
    );
  }

  // Se não tem API key ou não tem coordenadas
  if (!imageUrl) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center bg-slate-100 rounded-lg border border-dashed border-slate-300 p-4",
          sizeClassName,
          className
        )}
      >
        <MapPinOff className="h-8 w-8 text-slate-400 mb-2" />
        <span className="text-xs text-slate-500 text-center">
          {!hasCoordinates
            ? "Coordenadas não disponíveis"
            : "API do Street View não configurada"}
        </span>
        {endereco && (
          <span className="text-xs text-slate-400 text-center mt-1 truncate max-w-full">
            {endereco}
          </span>
        )}
      </div>
    );
  }

  // Se verificou e não há imagem disponível
  if (checkAvailability && isAvailable === false) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center bg-slate-100 rounded-lg border border-dashed border-slate-300 p-4",
          sizeClassName,
          className
        )}
      >
        <Building2 className="h-8 w-8 text-slate-400 mb-2" />
        <span className="text-xs text-slate-500 text-center">
          Imagem de fachada não disponível
        </span>
        {endereco && (
          <span className="text-xs text-slate-400 text-center mt-1 truncate max-w-full">
            {endereco}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={cn("relative group", className)}>
        {/* Label */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>{label}</span>
            {isFromCache && !isLoading && !hasError && (
              <span className="flex items-center gap-1 text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-[10px]">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
          </div>
          {collapsible && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <EyeOff className="h-3 w-3" />
              Ocultar
            </button>
          )}
        </div>
        
        {/* Container da imagem */}
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border bg-slate-100",
            sizeClassName
          )}
        >
          {/* Loading state */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <span className="text-xs text-slate-500">Carregando...</span>
              </div>
            </div>
          )}
          
          {/* Error state */}
          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 z-10">
              <Building2 className="h-8 w-8 text-slate-400 mb-2" />
              <span className="text-xs text-slate-500 text-center px-2">
                Não foi possível carregar a imagem
              </span>
            </div>
          )}
          
          {/* Imagem */}
          <img
            src={imageUrl}
            alt={`Vista da fachada - ${endereco || "Localização"}`}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-300",
              isLoading || hasError ? "opacity-0" : "opacity-100"
            )}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
          
          {/* Overlay com ações */}
          {!isLoading && !hasError && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              {showExpandButton && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => setIsExpanded(true)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Expandir
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="h-8"
                onClick={openInGoogleMaps}
              >
                Ver no Maps
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal expandido */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {label}
            </DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video bg-slate-100">
            {options && (
              <img
                src={getStreetViewImageUrl({
                  ...options,
                  width: 1200,
                  height: 800,
                }) || ""}
                alt={`Vista da fachada - ${endereco || "Localização"}`}
                className="w-full h-full object-contain"
              />
            )}
          </div>
          <div className="p-4 pt-2 flex items-center justify-between border-t">
            <span className="text-sm text-muted-foreground truncate max-w-[60%]">
              {endereco || `${latitude}, ${longitude}`}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={openInGoogleMaps}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver no Google Maps
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
