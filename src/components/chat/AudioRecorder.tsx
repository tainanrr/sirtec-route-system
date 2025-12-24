import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder, formatAudioDuration } from "@/hooks/useAudioRecorder";
import { 
  Mic, 
  Send, 
  Trash2, 
  Loader2,
  MicOff 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AudioRecorderProps {
  onSend: (blob: Blob, duration: number) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
  variant?: "blue" | "emerald";
  className?: string;
}

export function AudioRecorder({ 
  onSend, 
  onCancel, 
  disabled,
  variant = "blue",
  className 
}: AudioRecorderProps) {
  const [sending, setSending] = useState(false);
  const [waveformKey, setWaveformKey] = useState(0);
  const hasStartedRef = useRef(false);
  const pendingSendRef = useRef(false);

  const handleSendAudio = useCallback(async (blob: Blob, dur: number) => {
    setSending(true);
    try {
      await onSend(blob, dur);
    } catch (error) {
      console.error("Erro ao enviar áudio:", error);
      toast.error("Erro ao enviar áudio");
    } finally {
      setSending(false);
    }
  }, [onSend]);

  const {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported
  } = useAudioRecorder({
    onRecordingComplete: (blob, dur) => {
      // Se tinha um envio pendente, envia automaticamente
      if (pendingSendRef.current) {
        pendingSendRef.current = false;
        handleSendAudio(blob, dur);
      }
    },
    maxDuration: 300 // 5 minutos
  });

  // Iniciar gravação automaticamente ao montar
  useEffect(() => {
    if (!hasStartedRef.current && isSupported && !disabled) {
      hasStartedRef.current = true;
      startRecording().catch((error) => {
        console.error("Erro ao iniciar gravação:", error);
        toast.error("Não foi possível acessar o microfone");
        onCancel?.();
      });
    }
  }, [isSupported, disabled, startRecording, onCancel]);

  // Animar waveform enquanto grava
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setWaveformKey(k => k + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleCancel = () => {
    pendingSendRef.current = false;
    cancelRecording();
    onCancel?.();
  };

  // Parar e enviar em uma única ação
  const handleStopAndSend = () => {
    if (isRecording) {
      pendingSendRef.current = true;
      stopRecording();
    }
  };

  // Se não suporta gravação
  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <MicOff className="h-4 w-4" />
        <span>Gravação não suportada</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCancel?.()}
          className="h-6 px-2"
        >
          Fechar
        </Button>
      </div>
    );
  }

  const colorClasses = {
    blue: {
      primary: "bg-blue-600 hover:bg-blue-700",
      recording: "bg-red-500",
      waveform: "bg-blue-500",
      waveformBg: "bg-blue-200"
    },
    emerald: {
      primary: "bg-emerald-600 hover:bg-emerald-700",
      recording: "bg-red-500",
      waveform: "bg-emerald-500",
      waveformBg: "bg-emerald-200"
    }
  };

  const colors = colorClasses[variant];

  // Interface de gravação
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-full bg-gray-100 animate-in fade-in slide-in-from-right-2 duration-200",
      className
    )}>
      {/* Botão cancelar/lixeira */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCancel}
        disabled={sending}
        className="h-9 w-9 text-gray-500 hover:text-red-500 hover:bg-red-50 shrink-0"
        title="Cancelar gravação"
      >
        <Trash2 className="h-5 w-5" />
      </Button>

      {/* Se está gravando */}
      {isRecording && (
        <>
          {/* Indicador de gravação com waveform */}
          <div className="flex items-center gap-3 flex-1">
            <span className={cn(
              "h-3 w-3 rounded-full animate-pulse shrink-0",
              colors.recording
            )} />
            
            {/* Waveform animada */}
            <div className="flex items-center gap-[2px] h-6 flex-1 max-w-[120px]">
              {[...Array(20)].map((_, i) => {
                // Usar waveformKey para forçar re-render com novos valores
                const height = 20 + Math.sin(waveformKey / 2 + i * 0.5) * 30 + Math.random() * 30;
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-[3px] rounded-full",
                      colors.waveform
                    )}
                    style={{
                      height: `${height}%`,
                      minHeight: "15%",
                      transition: "height 0.1s ease-out"
                    }}
                  />
                );
              })}
            </div>

            <span className="text-sm font-mono font-medium text-gray-700 min-w-[45px] shrink-0">
              {formatAudioDuration(duration)}
            </span>
          </div>

          {/* Botão parar e enviar direto */}
          <Button
            size="icon"
            onClick={handleStopAndSend}
            disabled={sending}
            className={cn("h-10 w-10 rounded-full shrink-0", colors.primary)}
            title="Enviar áudio"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </>
      )}

      {/* Se está enviando (após parar) */}
      {!isRecording && sending && (
        <div className="flex items-center gap-3 flex-1">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          <span className="text-sm text-gray-500">Enviando...</span>
        </div>
      )}

      {/* Se ainda está iniciando */}
      {!isRecording && !sending && (
        <div className="flex items-center gap-2 flex-1">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          <span className="text-sm text-gray-500">Iniciando...</span>
        </div>
      )}
    </div>
  );
}

// Componente do botão de microfone (para uso externo)
export function AudioRecorderButton({
  onClick,
  disabled,
  variant = "blue",
  className
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "blue" | "emerald";
  className?: string;
}) {
  const colorClasses = {
    blue: "text-gray-500 hover:text-blue-600",
    emerald: "text-gray-500 hover:text-emerald-600"
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className={cn(colorClasses[variant], className)}
      title="Gravar mensagem de voz"
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}

export default AudioRecorder;

