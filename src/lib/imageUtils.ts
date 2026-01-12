/**
 * Utilitários para processamento de imagens
 * Garante que sempre usamos window.Image para evitar conflitos com imports de componentes
 */

import { format } from "date-fns";

/**
 * Converte arquivo para base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    
    const resolveOnce = (result: string) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };
    
    const rejectOnce = (error: any) => {
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    };
    
    // Timeout de segurança (15 segundos)
    const timeout = setTimeout(() => {
      console.error("[imageUtils] Timeout ao converter arquivo para base64");
      rejectOnce(new Error("Timeout ao converter arquivo"));
    }, 15000);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      clearTimeout(timeout);
      resolveOnce(reader.result as string);
    };
    reader.onerror = (error) => {
      clearTimeout(timeout);
      rejectOnce(error);
    };
  });
}

/**
 * Adiciona carimbo na imagem (data/hora e coordenadas)
 * IMPORTANTE: Sempre usa window.Image para evitar conflitos com imports de componentes
 */
export function addImageStamp(
  imageDataUrl: string,
  timestamp: string,
  coords: { latitude: number; longitude: number } | null
): Promise<string> {
  return new Promise((resolve) => {
    let resolved = false;
    
    const resolveOnce = (result: string) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };
    
    // Verificar se window.Image está disponível
    if (typeof window === 'undefined' || !window.Image) {
      console.warn("[imageUtils] window.Image não disponível, retornando imagem original");
      resolveOnce(imageDataUrl);
      return;
    }
    
    // Timeout de segurança (10 segundos)
    const timeout = setTimeout(() => {
      console.warn("[imageUtils] Timeout ao processar imagem com carimbo, usando imagem original");
      resolveOnce(imageDataUrl);
    }, 10000);
    
    // SEMPRE usar window.Image para evitar conflitos
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          clearTimeout(timeout);
          resolveOnce(imageDataUrl);
          return;
        }

        // Desenhar imagem original
        ctx.drawImage(img, 0, 0);

        // Configurar estilo do texto
        const fontSize = Math.max(14, Math.floor(img.width / 35));
        ctx.font = `bold ${fontSize}px Arial`;
        
        // Preparar textos
        const line1 = `📅 ${timestamp}`;
        const line2 = coords ? `📍 ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` : "📍 Sem GPS";
        
        // Medir textos
        const metrics1 = ctx.measureText(line1);
        const metrics2 = ctx.measureText(line2);
        const maxWidth = Math.max(metrics1.width, metrics2.width);
        const lineHeight = fontSize * 1.4;
        const padding = fontSize * 0.6;
        const boxHeight = lineHeight * 2 + padding * 2;
        const boxWidth = maxWidth + padding * 2;

        // Desenhar fundo semi-transparente no canto superior esquerdo
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, boxWidth, boxHeight);

        // Desenhar textos
        ctx.fillStyle = "#ffffff";
        ctx.fillText(line1, padding, padding + fontSize);
        ctx.fillText(line2, padding, padding + fontSize + lineHeight);

        // Converter para base64
        const result = canvas.toDataURL("image/jpeg", 0.85);
        clearTimeout(timeout);
        resolveOnce(result);
      } catch (error) {
        console.error("[imageUtils] Erro ao processar carimbo:", error);
        clearTimeout(timeout);
        resolveOnce(imageDataUrl);
      }
    };
    
    img.onerror = () => {
      console.error("[imageUtils] Erro ao carregar imagem para carimbo");
      clearTimeout(timeout);
      resolveOnce(imageDataUrl);
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Processa imagem com carimbo (converte para base64 e adiciona carimbo)
 */
export async function processImageWithStamp(
  file: File,
  coords: { latitude: number; longitude: number } | null,
  timestamp?: string
): Promise<{ dataUrl: string; timestamp: string }> {
  const finalTimestamp = timestamp || format(new Date(), "dd/MM/yyyy HH:mm:ss");
  const base64 = await fileToBase64(file);
  const stampedImage = await addImageStamp(base64, finalTimestamp, coords);
  return { dataUrl: stampedImage, timestamp: finalTimestamp };
}

/**
 * Obtém localização atual do dispositivo
 */
export function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("[imageUtils] Geolocalização não suportada");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("[imageUtils] Erro ao obter localização:", error);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}
