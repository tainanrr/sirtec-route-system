import { useState, useRef, useEffect } from "react";
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
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  
  // Usar refs para evitar problemas de closure stale
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Configurar contexto do canvas
  const setupCanvasContext = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  // Configurar canvas quando abrir
  useEffect(() => {
    if (!open) {
      setCanvasReady(false);
      setHasDrawn(false);
      isDrawingRef.current = false;
      lastPointRef.current = null;
      ctxRef.current = null;
      return;
    }

    const setupCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      
      if (!canvas || !container) {
        // Tentar novamente
        setTimeout(setupCanvas, 50);
        return;
      }

      const rect = container.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) {
        // Container ainda não tem dimensões, tentar novamente
        setTimeout(setupCanvas, 50);
        return;
      }
      
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
        setupCanvasContext(ctx);
        ctxRef.current = ctx;
        setCanvasReady(true);
      }
      
      setHasDrawn(false);
      isDrawingRef.current = false;
      lastPointRef.current = null;
    };

    // Aguardar um pouco para o DOM atualizar
    const timeoutId = setTimeout(setupCanvas, 100);

    return () => clearTimeout(timeoutId);
  }, [open]);

  // Adicionar event listeners nativos para melhor compatibilidade
  useEffect(() => {
    if (!open || !canvasReady) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCoordinates = (e: TouchEvent | MouseEvent): { x: number; y: number } | null => {
      const rect = canvas.getBoundingClientRect();
      
      if ("touches" in e && e.touches.length > 0) {
        const touch = e.touches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      } else if ("clientX" in e) {
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
      return null;
    };

    const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      // Garantir que o contexto está configurado
      setupCanvasContext(ctx);
      
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };

    const handleStart = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const coords = getCoordinates(e);
      if (coords) {
        isDrawingRef.current = true;
        lastPointRef.current = coords;
        setHasDrawn(true);
        
        // Desenhar um ponto inicial
        const ctx = ctxRef.current;
        if (ctx) {
          setupCanvasContext(ctx);
          ctx.beginPath();
          ctx.arc(coords.x, coords.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const handleMove = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isDrawingRef.current || !lastPointRef.current) return;

      const coords = getCoordinates(e);
      if (coords) {
        drawLine(lastPointRef.current, coords);
        lastPointRef.current = coords;
      }
    };

    const handleEnd = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      isDrawingRef.current = false;
      lastPointRef.current = null;
    };

    // Adicionar event listeners com passive: false para permitir preventDefault
    canvas.addEventListener("touchstart", handleStart, { passive: false });
    canvas.addEventListener("touchmove", handleMove, { passive: false });
    canvas.addEventListener("touchend", handleEnd, { passive: false });
    canvas.addEventListener("touchcancel", handleEnd, { passive: false });
    canvas.addEventListener("mousedown", handleStart);
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseup", handleEnd);
    canvas.addEventListener("mouseleave", handleEnd);

    return () => {
      canvas.removeEventListener("touchstart", handleStart);
      canvas.removeEventListener("touchmove", handleMove);
      canvas.removeEventListener("touchend", handleEnd);
      canvas.removeEventListener("touchcancel", handleEnd);
      canvas.removeEventListener("mousedown", handleStart);
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseup", handleEnd);
      canvas.removeEventListener("mouseleave", handleEnd);
    };
  }, [open, canvasReady]);

  // Limpar canvas
  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    setupCanvasContext(ctx); // Reconfigurar contexto após limpar
    
    setHasDrawn(false);
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  // Salvar assinatura
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
    onClose();
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-white flex flex-col"
      style={{ zIndex: 99999 }}
    >
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
        Desenhe sua assinatura na área abaixo usando o dedo
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
          style={{ touchAction: "none" }}
        />

        {/* Linha guia */}
        <div className="absolute bottom-1/3 left-8 right-8 border-b-2 border-dashed border-gray-300 pointer-events-none" />

        {/* Placeholder quando vazio */}
        {!hasDrawn && canvasReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-400">
              <Maximize2 className="h-16 w-16 mx-auto mb-3 opacity-40" />
              <p className="text-xl font-medium">Assine aqui</p>
              <p className="text-sm mt-1">Use o dedo para desenhar</p>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {!canvasReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-sm">Preparando área de assinatura...</p>
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
