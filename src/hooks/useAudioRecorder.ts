import { useState, useRef, useCallback, useEffect } from "react";

interface UseAudioRecorderOptions {
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  maxDuration?: number; // em segundos
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  isSupported: boolean;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const { onRecordingComplete, maxDuration = 300 } = options; // 5 min default

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Verificar suporte a gravação de áudio
  const isSupported = typeof navigator !== "undefined" && 
    navigator.mediaDevices && 
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined";

  // Limpar recursos
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  // Atualizar duração enquanto grava
  const updateDuration = useCallback(() => {
    if (!isPaused && startTimeRef.current) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000 + pausedDurationRef.current;
      setDuration(Math.floor(elapsed));

      // Parar automaticamente se atingir duração máxima
      if (elapsed >= maxDuration) {
        mediaRecorderRef.current?.stop();
      }
    }
  }, [isPaused, maxDuration]);

  // Iniciar gravação
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      throw new Error("Gravação de áudio não suportada neste navegador");
    }

    try {
      cleanup();
      chunksRef.current = [];
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);
      pausedDurationRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      streamRef.current = stream;

      // Tentar usar codec mais compatível
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "audio/ogg";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const finalDuration = Math.floor(
          (Date.now() - startTimeRef.current) / 1000 + pausedDurationRef.current
        );
        
        setAudioBlob(blob);
        setAudioUrl(url);
        setIsRecording(false);
        setIsPaused(false);

        cleanup();
        
        onRecordingComplete?.(blob, finalDuration);
      };

      mediaRecorder.start(100); // Capturar dados a cada 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);

      // Timer para atualizar duração
      timerRef.current = window.setInterval(updateDuration, 100);

    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      cleanup();
      throw error;
    }
  }, [isSupported, cleanup, updateDuration, onRecordingComplete]);

  // Parar gravação
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  // Pausar gravação
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      pausedDurationRef.current = duration;
      setIsPaused(true);
    }
  }, [isRecording, isPaused, duration]);

  // Retomar gravação
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      startTimeRef.current = Date.now();
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  // Cancelar gravação
  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    
    cleanup();
    chunksRef.current = [];
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setIsRecording(false);
    setIsPaused(false);
    pausedDurationRef.current = 0;
  }, [isRecording, cleanup]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    isSupported
  };
}

// Utilitário para formatar duração
export function formatAudioDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default useAudioRecorder;







