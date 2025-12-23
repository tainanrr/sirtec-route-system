import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, X, Loader2, AlertTriangle, Keyboard } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  open: boolean;
  title?: string;
}

// Verificar se BarcodeDetector está disponível
const isBarcodeDetectorSupported = () => {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
};

export function BarcodeScanner({ onScan, onClose, open, title = "Ler Código de Barras" }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setIsScanning(true);

    try {
      // Verificar se a câmera está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraSupported(false);
        setShowManualInput(true);
        setIsScanning(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment", // Câmera traseira
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Iniciar detecção de código de barras
        if (isBarcodeDetectorSupported()) {
          startBarcodeDetection();
        } else {
          // Fallback: mostrar input manual
          setError("Detecção automática não suportada neste navegador. Use a entrada manual.");
          setShowManualInput(true);
        }
      }
    } catch (err: any) {
      console.error("Erro ao acessar câmera:", err);
      setCameraSupported(false);
      setShowManualInput(true);
      setIsScanning(false);
      
      if (err.name === "NotAllowedError") {
        setError("Permissão de câmera negada. Por favor, permita o acesso à câmera.");
      } else if (err.name === "NotFoundError") {
        setError("Nenhuma câmera encontrada no dispositivo.");
      } else {
        setError("Erro ao acessar a câmera. Use a entrada manual.");
      }
    }
  }, []);

  const startBarcodeDetection = useCallback(async () => {
    if (!videoRef.current || !isBarcodeDetectorSupported()) return;

    try {
      // @ts-ignore - BarcodeDetector é uma API experimental
      const barcodeDetector = new BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "data_matrix", "codabar"]
      });

      const detectBarcode = async () => {
        if (!videoRef.current || !streamRef.current) return;

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
              // Código detectado!
              toast.success(`Código lido: ${code}`);
              stopCamera();
              onScan(code);
              onClose();
              return;
            }
          }

          // Continuar detectando
          if (streamRef.current) {
            requestAnimationFrame(detectBarcode);
          }
        } catch (err) {
          console.error("Erro na detecção:", err);
          if (streamRef.current) {
            requestAnimationFrame(detectBarcode);
          }
        }
      };

      detectBarcode();
    } catch (err) {
      console.error("Erro ao criar BarcodeDetector:", err);
      setError("Erro na detecção automática. Use a entrada manual.");
      setShowManualInput(true);
    }
  }, [onScan, onClose, stopCamera]);

  // Iniciar câmera quando o dialog abrir
  useEffect(() => {
    if (open && !showManualInput) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [open, showManualInput, startCamera, stopCamera]);

  // Limpar ao fechar
  useEffect(() => {
    if (!open) {
      stopCamera();
      setManualInput("");
      setShowManualInput(false);
      setError(null);
    }
  }, [open, stopCamera]);

  const handleManualSubmit = () => {
    const code = manualInput.trim().toUpperCase();
    if (code) {
      onScan(code);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-violet-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Área da câmera */}
          {!showManualInput && cameraSupported && (
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              
              {/* Overlay de scanning */}
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-32 border-2 border-violet-500 rounded-lg relative">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-violet-500 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                        Posicione o código de barras aqui
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading */}
              {isScanning && !videoRef.current?.srcObject && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Input manual */}
          {showManualInput && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Digite o número de série manualmente:
              </p>
              <div className="flex gap-2">
                <Input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                  placeholder="Ex: MED2024001"
                  className="font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  autoFocus
                />
                <Button onClick={handleManualSubmit} disabled={!manualInput.trim()}>
                  OK
                </Button>
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex gap-2">
            {!showManualInput && cameraSupported && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  stopCamera();
                  setShowManualInput(true);
                }}
              >
                <Keyboard className="h-4 w-4 mr-2" />
                Digitar Manualmente
              </Button>
            )}
            
            {showManualInput && cameraSupported && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowManualInput(false);
                  setError(null);
                  startCamera();
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Usar Câmera
              </Button>
            )}
            
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}





