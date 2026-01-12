/**
 * Testes básicos para imageUtils
 * Verifica se o construtor Image está disponível
 */

import { describe, it, expect } from 'vitest';
import { addImageStamp } from './imageUtils';

describe('imageUtils', () => {
  describe('addImageStamp', () => {
    it('deve usar window.Image e não conflitar com imports de componentes', async () => {
      // Verificar se window.Image está disponível
      expect(typeof window).not.toBe('undefined');
      expect(window.Image).toBeDefined();
      
      // Teste básico com uma imagem pequena (1x1 pixel PNG)
      const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const timestamp = '12/01/2026 10:00:00';
      const coords = { latitude: -14.9061632, longitude: -40.8715264 };

      const result = await addImageStamp(testImage, timestamp, coords);
      
      // Deve retornar uma string (data URL)
      expect(typeof result).toBe('string');
      expect(result.startsWith('data:image')).toBe(true);
    });

    it('deve retornar imagem original se window.Image não estiver disponível', async () => {
      const originalImage = window.Image;
      // @ts-ignore - Simulando ausência de Image
      delete (window as any).Image;
      
      const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = await addImageStamp(testImage, '12/01/2026 10:00:00', null);
      
      expect(result).toBe(testImage);
      
      // Restaurar
      (window as any).Image = originalImage;
    });
  });
});
