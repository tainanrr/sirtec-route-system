import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const [hasDrawn, setHasDrawn] = useState(false);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Reset estado quando fecha
  useEffect(() => {
    if (!open) {
      setHasDrawn(false);
      isDrawingRef.current = false;
      lastPosRef.current = null;
    }
  }, [open]);

  // Configurar canvas e event listeners
  useEffect(() => {
    if (!open) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Função para configurar o canvas
    const setupCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        setTimeout(setupCanvas, 50);
        return;
      }

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
        console.log("[Signature] Canvas configurado:", rect.width, "x", rect.height);
      }
    };

    // Obter coordenadas do evento
    const getCoords = (e: TouchEvent | MouseEvent): { x: number; y: number } | null => {
      const rect = canvas.getBoundingClientRect();
      
      if (e instanceof TouchEvent && e.touches.length > 0) {
        const touch = e.touches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      } else if (e instanceof MouseEvent) {
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
      return null;
    };

    // Desenhar linha
    const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };

    // Handler de início
    const handleStart = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const coords = getCoords(e);
      console.log("[Signature] handleStart, coords:", coords);
      
      if (coords) {
        isDrawingRef.current = true;
        lastPosRef.current = coords;
        setHasDrawn(true);

        // Desenhar ponto inicial
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.arc(coords.x, coords.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // Handler de movimento
    const handleMove = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isDrawingRef.current || !lastPosRef.current) return;

      const coords = getCoords(e);
      if (coords) {
        drawLine(lastPosRef.current, coords);
        lastPosRef.current = coords;
      }
    };

    // Handler de fim
    const handleEnd = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log("[Signature] handleEnd");
      isDrawingRef.current = false;
      lastPosRef.current = null;
    };

    // Aguardar um pouco e configurar
    const timeoutId = setTimeout(() => {
      setupCanvas();

      // Adicionar event listeners com passive: false
      console.log("[Signature] Adicionando event listeners ao canvas");
      canvas.addEventListener("touchstart", handleStart, { passive: false });
      canvas.addEventListener("touchmove", handleMove, { passive: false });
      canvas.addEventListener("touchend", handleEnd, { passive: false });
      canvas.addEventListener("touchcancel", handleEnd, { passive: false });
      canvas.addEventListener("mousedown", handleStart, { passive: false });
      canvas.addEventListener("mousemove", handleMove, { passive: false });
      canvas.addEventListener("mouseup", handleEnd, { passive: false });
      canvas.addEventListener("mouseleave", handleEnd, { passive: false });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      console.log("[Signature] Removendo event listeners");
      canvas.removeEventListener("touchstart", handleStart);
      canvas.removeEventListener("touchmove", handleMove);
      canvas.removeEventListener("touchend", handleEnd);
      canvas.removeEventListener("touchcancel", handleEnd);
      canvas.removeEventListener("mousedown", handleStart);
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseup", handleEnd);
      canvas.removeEventListener("mouseleave", handleEnd);
    };
  }, [open]);

  // Limpar canvas
  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    setHasDrawn(false);
    isDrawingRef.current = false;
    lastPosRef.current = null;
    console.log("[Signature] Canvas limpo");
  };

  // Salvar assinatura
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    const dataUrl = canvas.toDataURL("image/png");
    console.log("[Signature] Salvando assinatura");
    onSave(dataUrl);
    onClose();
  };

  if (!open) return null;

  const content = (
    <div 
      className="fixed inset-0 bg-white flex flex-col"
      style={{ zIndex: 2147483647 }} // Máximo z-index possível
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-violet-50 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-600"
          type="button"
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
          type="button"
        >
          <RotateCcw className="h-5 w-5 mr-1" />
          Limpar
        </Button>
      </div>

      {/* Instruções */}
      <div className="text-center py-2 bg-violet-100 text-violet-700 text-sm shrink-0 font-medium">
        Desenhe sua assinatura na área abaixo usando o dedo
      </div>

      {/* Área de assinatura - SEM elementos por cima do canvas */}
      <div 
        className="flex-1 relative bg-white"
        style={{ touchAction: "none", overflow: "hidden" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
          style={{ 
            touchAction: "none",
            cursor: "crosshair",
          }}
        />

        {/* Linha guia - DEPOIS do canvas e com pointer-events-none */}
        <div 
          className="absolute bottom-1/3 left-8 right-8 border-b-2 border-dashed border-gray-300"
          style={{ pointerEvents: "none" }}
        />

        {/* Placeholder - DEPOIS do canvas e com pointer-events-none */}
        {!hasDrawn && (
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{ pointerEvents: "none" }}
          >
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
          type="button"
        >
          <Check className="h-6 w-6 mr-2" />
          Confirmar Assinatura
        </Button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
