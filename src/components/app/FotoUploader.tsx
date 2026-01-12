import { useState, useRef } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface FotoData {
  url: string;
  latitude?: number;
  longitude?: number;
  dataHora: string;
}

interface FotoUploaderProps {
  fotos: FotoData[];
  onFotosChange: (fotos: FotoData[]) => void;
  maxFotos?: number;
  disabled?: boolean;
  label?: string;
}

// Obter localização atual
const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("[FotoUploader] Geolocalização não suportada pelo navegador");
      resolve(null);
      return;
    }

    console.log("[FotoUploader] Solicitando localização...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("[FotoUploader] Localização obtida:", position.coords.latitude, position.coords.longitude);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("[FotoUploader] Erro ao obter localização:", error.code, error.message);
        // Tentar com menos precisão
        if (error.code === error.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log("[FotoUploader] Localização obtida (baixa precisão):", position.coords.latitude, position.coords.longitude);
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
          );
        } else {
          resolve(null);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
};

// Converter arquivo para base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Adicionar carimbo na imagem (data/hora e coordenadas)
const addImageStamp = (
  imageDataUrl: string,
  timestamp: string,
  coords: { latitude: number; longitude: number } | null
): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log("[FotoUploader] Adicionando carimbo - timestamp:", timestamp, "coords:", coords);
    
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      console.log("[FotoUploader] Imagem carregada - dimensões:", img.width, "x", img.height);
      
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        console.warn("[FotoUploader] Contexto 2D não disponível");
        resolve(imageDataUrl);
        return;
      }

      // Desenhar imagem original
      ctx.drawImage(img, 0, 0);

      // Configurar estilo do texto
      const fontSize = Math.max(16, Math.floor(img.width / 30));
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textBaseline = "top";

      // Preparar textos (sem emojis para melhor compatibilidade)
      const line1 = `Data: ${timestamp}`;
      const line2 = coords
        ? `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
        : "GPS: Indisponivel";

      console.log("[FotoUploader] Carimbo - linha1:", line1, "linha2:", line2);

      // Medir textos
      const metrics1 = ctx.measureText(line1);
      const metrics2 = ctx.measureText(line2);
      const maxWidth = Math.max(metrics1.width, metrics2.width);
      const lineHeight = fontSize * 1.4;
      const padding = fontSize * 0.6;
      const boxHeight = lineHeight * 2 + padding * 2.5;
      const boxWidth = maxWidth + padding * 2.5;

      // Desenhar fundo semi-transparente com borda arredondada
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.beginPath();
      ctx.roundRect(padding / 2, padding / 2, boxWidth, boxHeight, 8);
      ctx.fill();

      // Desenhar textos
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line1, padding * 1.5, padding * 1.5);
      ctx.fillText(line2, padding * 1.5, padding * 1.5 + lineHeight);

      // Converter para base64
      const result = canvas.toDataURL("image/jpeg", 0.85);
      console.log("[FotoUploader] Carimbo aplicado com sucesso");
      resolve(result);
    };

    img.onerror = (error) => {
      console.error("[FotoUploader] Erro ao carregar imagem para carimbo:", error);
      resolve(imageDataUrl);
    };

    img.src = imageDataUrl;
  });
};

export function FotoUploader({
  fotos,
  onFotosChange,
  maxFotos = 10,
  disabled = false,
  label = "Fotos",
}: FotoUploaderProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    setShowOptions(false);
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    setShowOptions(false);
    galleryInputRef.current?.click();
  };

  const processFiles = async (files: FileList) => {
    if (files.length === 0) return;

    const remainingSlots = maxFotos - fotos.length;
    if (remainingSlots <= 0) {
      toast.error(`Máximo de ${maxFotos} fotos permitidas`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    setProcessing(true);
    toast.loading(`Processando ${filesToProcess.length} foto(s)...`, { id: "foto-process" });

    try {
      // Obter localização uma vez para todas as fotos
      const coords = await getCurrentLocation();
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");

      const newFotos: FotoData[] = [];

      for (const file of filesToProcess) {
        try {
          const base64 = await fileToBase64(file);
          const stampedImage = await addImageStamp(base64, timestamp, coords);
          
          newFotos.push({
            url: stampedImage,
            latitude: coords?.latitude,
            longitude: coords?.longitude,
            dataHora: timestamp,
          });
        } catch (error) {
          console.error("[FotoUploader] Erro ao processar foto:", error);
        }
      }

      if (newFotos.length > 0) {
        onFotosChange([...fotos, ...newFotos]);
        setCurrentIndex(fotos.length); // Ir para a primeira nova foto
        toast.success(`${newFotos.length} foto(s) adicionada(s)!`, { id: "foto-process" });
      } else {
        toast.error("Erro ao processar fotos", { id: "foto-process" });
      }
    } catch (error) {
      console.error("[FotoUploader] Erro geral:", error);
      toast.error("Erro ao processar fotos", { id: "foto-process" });
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Evitar propagação de eventos
    const files = e.target.files;
    if (files) {
      processFiles(files);
    }
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = "";
  };

  const handleRemoveFoto = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Evitar propagação de eventos
    const newFotos = fotos.filter((_, i) => i !== index);
    onFotosChange(newFotos);
    if (currentIndex >= newFotos.length && newFotos.length > 0) {
      setCurrentIndex(newFotos.length - 1);
    } else if (newFotos.length === 0) {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
  };

  const canAddMore = fotos.length < maxFotos;

  return (
    <div className="space-y-2">
      {/* Visualização das fotos */}
      {fotos.length > 0 ? (
        <div className="space-y-2">
          {/* Carrossel de fotos */}
          <div className="relative bg-muted rounded-lg overflow-hidden">
            {/* Imagem atual */}
            <div 
              className="relative aspect-[4/3] cursor-pointer"
              onClick={() => setShowGallery(true)}
            >
              <img
                src={fotos[currentIndex]?.url}
                alt={`Foto ${currentIndex + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay com contador */}
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                {currentIndex + 1} / {fotos.length}
              </div>

              {/* Botão de remover */}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 left-2 h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFoto(currentIndex);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Navegação */}
            {fotos.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                >
                  <ChevronLeft className="h-5 w-5 text-white" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                >
                  <ChevronRight className="h-5 w-5 text-white" />
                </Button>
              </>
            )}
          </div>

          {/* Miniaturas */}
          {fotos.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
              {fotos.map((foto, index) => (
                <button
                  key={index}
                  className={`relative shrink-0 w-14 h-14 rounded overflow-hidden border-2 transition-all ${
                    index === currentIndex
                      ? "border-primary ring-1 ring-primary"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
                >
                  <img
                    src={foto.url}
                    alt={`Miniatura ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              
              {/* Botão de adicionar mais */}
              {canAddMore && !disabled && (
                <button
                  className="shrink-0 w-14 h-14 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-all"
                  onClick={(e) => { e.stopPropagation(); setShowOptions(true); }}
                  disabled={processing}
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          {/* Botão de adicionar quando só tem 1 foto */}
          {fotos.length === 1 && canAddMore && !disabled && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => { e.stopPropagation(); setShowOptions(true); }}
              disabled={processing}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar mais fotos
            </Button>
          )}
        </div>
      ) : (
        /* Botão inicial para adicionar fotos */
        <Button
          variant="outline"
          className="w-full h-24 flex flex-col gap-2"
          onClick={(e) => { e.stopPropagation(); setShowOptions(true); }}
          disabled={disabled || processing}
        >
          <Camera className="h-6 w-6" />
          <span className="text-sm">{processing ? "Processando..." : `Adicionar ${label}`}</span>
        </Button>
      )}

      {/* Dialog de opções (Câmera ou Galeria) */}
      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Adicionar Foto</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={handleCameraClick}
            >
              <Camera className="h-8 w-8" />
              <span className="text-sm">Câmera</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={handleGalleryClick}
            >
              <ImageIcon className="h-8 w-8" />
              <span className="text-sm">Galeria</span>
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Na galeria você pode selecionar múltiplas fotos
          </p>
        </DialogContent>
      </Dialog>

      {/* Dialog de galeria expandida */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-lg p-0">
          <div className="relative">
            {fotos.length > 0 && (
              <>
                <img
                  src={fotos[currentIndex]?.url}
                  alt={`Foto ${currentIndex + 1}`}
                  className="w-full max-h-[70vh] object-contain bg-black"
                />
                
                {/* Informações da foto */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="text-white text-sm">
                    <p className="font-medium">Foto {currentIndex + 1} de {fotos.length}</p>
                    {fotos[currentIndex]?.dataHora && (
                      <p className="text-xs opacity-80">{fotos[currentIndex].dataHora}</p>
                    )}
                    {fotos[currentIndex]?.latitude && fotos[currentIndex]?.longitude && (
                      <p className="text-xs opacity-80 font-mono">
                        {fotos[currentIndex].latitude?.toFixed(6)}, {fotos[currentIndex].longitude?.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Navegação */}
                {fotos.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70"
                      onClick={handlePrev}
                    >
                      <ChevronLeft className="h-6 w-6 text-white" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70"
                      onClick={handleNext}
                    >
                      <ChevronRight className="h-6 w-6 text-white" />
                    </Button>
                  </>
                )}

                {/* Fechar */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={() => setShowGallery(false)}
                >
                  <X className="h-4 w-4 text-white" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Inputs ocultos */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Input para galeria - sem capture para permitir seleção múltipla */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
        multiple={true}
        className="hidden"
        onChange={handleFileChange}
        // Não usar capture aqui para permitir acesso à galeria
      />
    </div>
  );
}


import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface FotoData {
  url: string;
  latitude?: number;
  longitude?: number;
  dataHora: string;
}

interface FotoUploaderProps {
  fotos: FotoData[];
  onFotosChange: (fotos: FotoData[]) => void;
  maxFotos?: number;
  disabled?: boolean;
  label?: string;
}

// Obter localização atual
const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("[FotoUploader] Geolocalização não suportada pelo navegador");
      resolve(null);
      return;
    }

    console.log("[FotoUploader] Solicitando localização...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("[FotoUploader] Localização obtida:", position.coords.latitude, position.coords.longitude);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("[FotoUploader] Erro ao obter localização:", error.code, error.message);
        // Tentar com menos precisão
        if (error.code === error.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log("[FotoUploader] Localização obtida (baixa precisão):", position.coords.latitude, position.coords.longitude);
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
          );
        } else {
          resolve(null);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
};

// Converter arquivo para base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Adicionar carimbo na imagem (data/hora e coordenadas)
const addImageStamp = (
  imageDataUrl: string,
  timestamp: string,
  coords: { latitude: number; longitude: number } | null
): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log("[FotoUploader] Adicionando carimbo - timestamp:", timestamp, "coords:", coords);
    
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      console.log("[FotoUploader] Imagem carregada - dimensões:", img.width, "x", img.height);
      
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        console.warn("[FotoUploader] Contexto 2D não disponível");
        resolve(imageDataUrl);
        return;
      }

      // Desenhar imagem original
      ctx.drawImage(img, 0, 0);

      // Configurar estilo do texto
      const fontSize = Math.max(16, Math.floor(img.width / 30));
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textBaseline = "top";

      // Preparar textos (sem emojis para melhor compatibilidade)
      const line1 = `Data: ${timestamp}`;
      const line2 = coords
        ? `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
        : "GPS: Indisponivel";

      console.log("[FotoUploader] Carimbo - linha1:", line1, "linha2:", line2);

      // Medir textos
      const metrics1 = ctx.measureText(line1);
      const metrics2 = ctx.measureText(line2);
      const maxWidth = Math.max(metrics1.width, metrics2.width);
      const lineHeight = fontSize * 1.4;
      const padding = fontSize * 0.6;
      const boxHeight = lineHeight * 2 + padding * 2.5;
      const boxWidth = maxWidth + padding * 2.5;

      // Desenhar fundo semi-transparente com borda arredondada
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.beginPath();
      ctx.roundRect(padding / 2, padding / 2, boxWidth, boxHeight, 8);
      ctx.fill();

      // Desenhar textos
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line1, padding * 1.5, padding * 1.5);
      ctx.fillText(line2, padding * 1.5, padding * 1.5 + lineHeight);

      // Converter para base64
      const result = canvas.toDataURL("image/jpeg", 0.85);
      console.log("[FotoUploader] Carimbo aplicado com sucesso");
      resolve(result);
    };

    img.onerror = (error) => {
      console.error("[FotoUploader] Erro ao carregar imagem para carimbo:", error);
      resolve(imageDataUrl);
    };

    img.src = imageDataUrl;
  });
};

export function FotoUploader({
  fotos,
  onFotosChange,
  maxFotos = 10,
  disabled = false,
  label = "Fotos",
}: FotoUploaderProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    setShowOptions(false);
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    setShowOptions(false);
    galleryInputRef.current?.click();
  };

  const processFiles = async (files: FileList) => {
    if (files.length === 0) return;

    const remainingSlots = maxFotos - fotos.length;
    if (remainingSlots <= 0) {
      toast.error(`Máximo de ${maxFotos} fotos permitidas`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    setProcessing(true);
    toast.loading(`Processando ${filesToProcess.length} foto(s)...`, { id: "foto-process" });

    try {
      // Obter localização uma vez para todas as fotos
      const coords = await getCurrentLocation();
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");

      const newFotos: FotoData[] = [];

      for (const file of filesToProcess) {
        try {
          const base64 = await fileToBase64(file);
          const stampedImage = await addImageStamp(base64, timestamp, coords);
          
          newFotos.push({
            url: stampedImage,
            latitude: coords?.latitude,
            longitude: coords?.longitude,
            dataHora: timestamp,
          });
        } catch (error) {
          console.error("[FotoUploader] Erro ao processar foto:", error);
        }
      }

      if (newFotos.length > 0) {
        onFotosChange([...fotos, ...newFotos]);
        setCurrentIndex(fotos.length); // Ir para a primeira nova foto
        toast.success(`${newFotos.length} foto(s) adicionada(s)!`, { id: "foto-process" });
      } else {
        toast.error("Erro ao processar fotos", { id: "foto-process" });
      }
    } catch (error) {
      console.error("[FotoUploader] Erro geral:", error);
      toast.error("Erro ao processar fotos", { id: "foto-process" });
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Evitar propagação de eventos
    const files = e.target.files;
    if (files) {
      processFiles(files);
    }
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = "";
  };

  const handleRemoveFoto = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Evitar propagação de eventos
    const newFotos = fotos.filter((_, i) => i !== index);
    onFotosChange(newFotos);
    if (currentIndex >= newFotos.length && newFotos.length > 0) {
      setCurrentIndex(newFotos.length - 1);
    } else if (newFotos.length === 0) {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
  };

  const canAddMore = fotos.length < maxFotos;

  return (
    <div className="space-y-2">
      {/* Visualização das fotos */}
      {fotos.length > 0 ? (
        <div className="space-y-2">
          {/* Carrossel de fotos */}
          <div className="relative bg-muted rounded-lg overflow-hidden">
            {/* Imagem atual */}
            <div 
              className="relative aspect-[4/3] cursor-pointer"
              onClick={() => setShowGallery(true)}
            >
              <img
                src={fotos[currentIndex]?.url}
                alt={`Foto ${currentIndex + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay com contador */}
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                {currentIndex + 1} / {fotos.length}
              </div>

              {/* Botão de remover */}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 left-2 h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFoto(currentIndex);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Navegação */}
            {fotos.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                >
                  <ChevronLeft className="h-5 w-5 text-white" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                >
                  <ChevronRight className="h-5 w-5 text-white" />
                </Button>
              </>
            )}
          </div>

          {/* Miniaturas */}
          {fotos.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
              {fotos.map((foto, index) => (
                <button
                  key={index}
                  className={`relative shrink-0 w-14 h-14 rounded overflow-hidden border-2 transition-all ${
                    index === currentIndex
                      ? "border-primary ring-1 ring-primary"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
                >
                  <img
                    src={foto.url}
                    alt={`Miniatura ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              
              {/* Botão de adicionar mais */}
              {canAddMore && !disabled && (
                <button
                  className="shrink-0 w-14 h-14 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-all"
                  onClick={(e) => { e.stopPropagation(); setShowOptions(true); }}
                  disabled={processing}
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          {/* Botão de adicionar quando só tem 1 foto */}
          {fotos.length === 1 && canAddMore && !disabled && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => { e.stopPropagation(); setShowOptions(true); }}
              disabled={processing}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar mais fotos
            </Button>
          )}
        </div>
      ) : (
        /* Botão inicial para adicionar fotos */
        <Button
          variant="outline"
          className="w-full h-24 flex flex-col gap-2"
          onClick={(e) => { e.stopPropagation(); setShowOptions(true); }}
          disabled={disabled || processing}
        >
          <Camera className="h-6 w-6" />
          <span className="text-sm">{processing ? "Processando..." : `Adicionar ${label}`}</span>
        </Button>
      )}

      {/* Dialog de opções (Câmera ou Galeria) */}
      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Adicionar Foto</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={handleCameraClick}
            >
              <Camera className="h-8 w-8" />
              <span className="text-sm">Câmera</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={handleGalleryClick}
            >
              <ImageIcon className="h-8 w-8" />
              <span className="text-sm">Galeria</span>
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Na galeria você pode selecionar múltiplas fotos
          </p>
        </DialogContent>
      </Dialog>

      {/* Dialog de galeria expandida */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-lg p-0">
          <div className="relative">
            {fotos.length > 0 && (
              <>
                <img
                  src={fotos[currentIndex]?.url}
                  alt={`Foto ${currentIndex + 1}`}
                  className="w-full max-h-[70vh] object-contain bg-black"
                />
                
                {/* Informações da foto */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="text-white text-sm">
                    <p className="font-medium">Foto {currentIndex + 1} de {fotos.length}</p>
                    {fotos[currentIndex]?.dataHora && (
                      <p className="text-xs opacity-80">{fotos[currentIndex].dataHora}</p>
                    )}
                    {fotos[currentIndex]?.latitude && fotos[currentIndex]?.longitude && (
                      <p className="text-xs opacity-80 font-mono">
                        {fotos[currentIndex].latitude?.toFixed(6)}, {fotos[currentIndex].longitude?.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Navegação */}
                {fotos.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70"
                      onClick={handlePrev}
                    >
                      <ChevronLeft className="h-6 w-6 text-white" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70"
                      onClick={handleNext}
                    >
                      <ChevronRight className="h-6 w-6 text-white" />
                    </Button>
                  </>
                )}

                {/* Fechar */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={() => setShowGallery(false)}
                >
                  <X className="h-4 w-4 text-white" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Inputs ocultos */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Input para galeria - sem capture para permitir seleção múltipla */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
        multiple={true}
        className="hidden"
        onChange={handleFileChange}
        // Não usar capture aqui para permitir acesso à galeria
      />
    </div>
  );
}

