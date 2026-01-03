import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAudioDuration } from "@/hooks/useAudioRecorder";

interface AudioPlayerProps {
  src: string;
  duration?: number | null;
  className?: string;
  variant?: "light" | "dark";
}

export function AudioPlayer({ src, duration: initialDuration, className, variant = "light" }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    
    const newTime = (value[0] / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const isDark = variant === "dark";

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-lg min-w-[180px]",
      isDark ? "bg-white/10" : "bg-gray-100",
      className
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <Button
        size="icon"
        variant="ghost"
        onClick={togglePlayPause}
        className={cn(
          "h-8 w-8 shrink-0",
          isDark 
            ? "text-white hover:bg-white/20" 
            : "text-gray-700 hover:bg-gray-200"
        )}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </Button>

      <div className="flex-1 flex flex-col gap-1">
        <Slider
          value={[progress]}
          max={100}
          step={0.1}
          onValueChange={handleSliderChange}
          className={cn(
            "cursor-pointer",
            isDark && "[&_[role=slider]]:bg-white [&_[role=slider]]:border-white/50"
          )}
        />
        <div className={cn(
          "flex justify-between text-[10px]",
          isDark ? "text-white/70" : "text-gray-500"
        )}>
          <span>{formatAudioDuration(Math.floor(currentTime))}</span>
          <span>{formatAudioDuration(Math.floor(duration || 0))}</span>
        </div>
      </div>

      <Volume2 className={cn(
        "h-4 w-4 shrink-0",
        isDark ? "text-white/50" : "text-gray-400"
      )} />
    </div>
  );
}

export default AudioPlayer;









