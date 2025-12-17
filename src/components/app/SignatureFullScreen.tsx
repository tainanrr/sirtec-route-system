import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, RotateCcw, Maximize2 } from "lucide-react";

interface SignatureFullScreenProps {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  titulo?: string;
}

export function SignatureFullScreen({
  open,
  onClose,
  onSave,
  titulo = "Assinatura",
}: SignatureFullScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  // Configurar canvas quando abrir
  useEffect(() => {
    if (open && canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      
      // Aguardar um pouco para o DOM atualizar
      setTimeout(() => {
        const rect = container.getBoundingClientRect();
        
        // Usar devicePixelRatio para melhor qualidade em telas de alta resolução
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(dpr, dpr);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, rect.width, rect.height);
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
        }
        
        setHasDrawn(false);
      }, 100);
    }
  }, [open]);

  // Obter coordenadas do toque/mouse
  const getCoordinates = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, []);

  // Desenhar linha
  const drawLine = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }, []);

  // Início do desenho
  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (coords) {
      setIsDrawing(true);
      setLastPoint(coords);
      setHasDrawn(true);
    }
  }, [getCoordinates]);

  // Movimento durante o desenho
  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing || !lastPoint) return;

    const coords = getCoordinates(e);
    if (coords) {
      drawLine(lastPoint, coords);
      setLastPoint(coords);
    }
  }, [isDrawing, lastPoint, getCoordinates, drawLine]);

  // Fim do desenho
  const handleEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(false);
    setLastPoint(null);
  }, []);

  // Limpar canvas
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    setHasDrawn(false);
  }, []);

  // Salvar assinatura
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
    onClose();
  }, [hasDrawn, onSave, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-violet-50 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-600"
        >
          <X className="h-5 w-5 mr-1" />
          Cancelar
        </Button>
        <h2 className="font-semibold text-violet-800">{titulo}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="text-gray-600"
        >
          <RotateCcw className="h-5 w-5 mr-1" />
          Limpar
        </Button>
      </div>

      {/* Instruções */}
      <div className="text-center py-2 bg-violet-100 text-violet-700 text-sm shrink-0 font-medium">
        ✏️ Desenhe sua assinatura na área abaixo usando o dedo
      </div>

      {/* Área de assinatura */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-white"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          onTouchCancel={handleEnd}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          style={{ touchAction: "none" }}
        />

        {/* Linha guia */}
        <div className="absolute bottom-1/3 left-8 right-8 border-b-2 border-dashed border-gray-300 pointer-events-none" />

        {/* Placeholder quando vazio */}
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-400">
              <Maximize2 className="h-16 w-16 mx-auto mb-3 opacity-40" />
              <p className="text-xl font-medium">Assine aqui</p>
              <p className="text-sm mt-1">Use o dedo para desenhar</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer com botão de confirmar */}
      <div className="p-4 border-t bg-gray-50 shrink-0 safe-area-inset-bottom">
        <Button
          onClick={handleSave}
          disabled={!hasDrawn}
          className="w-full h-14 text-lg bg-violet-600 hover:bg-violet-700"
          size="lg"
        >
          <Check className="h-6 w-6 mr-2" />
          Confirmar Assinatura
        </Button>
      </div>
    </div>
  );
}
