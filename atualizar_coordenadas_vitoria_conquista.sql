-- ============================================================================
-- SCRIPT: Atualizar coordenadas para Vitória da Conquista (aleatórias)
-- ============================================================================
-- Este script atualiza as coordenadas das OSs para valores aleatórios
-- dentro da área urbana de Vitória da Conquista, BA
-- ============================================================================
-- Centro de Vitória da Conquista: -14.8661, -40.8394
-- Área aproximada: ~15km de raio (0.135 graus de latitude/longitude)
-- ============================================================================

-- Função para gerar coordenadas aleatórias dentro de Vitória da Conquista
DO $$
DECLARE
  base_lat DECIMAL := -14.8661;  -- Centro de Vitória da Conquista
  base_lng DECIMAL := -40.8394;
  raio_lat DECIMAL := 0.135;     -- ~15km em latitude
  raio_lng DECIMAL := 0.135;     -- ~15km em longitude
  os_record RECORD;
  nova_lat DECIMAL;
  nova_lng DECIMAL;
  total_atualizadas INTEGER := 0;
BEGIN
  -- Atualizar coordenadas de TODAS as OSs (independente do status)
  FOR os_record IN 
    SELECT id, numero FROM public.ordens_servico
  LOOP
    -- Gerar coordenadas aleatórias dentro da área da cidade
    -- Usando random() que retorna valores entre 0 e 1
    nova_lat := base_lat + (random() - 0.5) * raio_lat;
    nova_lng := base_lng + (random() - 0.5) * raio_lng;
    
    -- Arredondar para 6 casas decimais (precisão suficiente)
    nova_lat := ROUND(nova_lat::numeric, 6)::DECIMAL;
    nova_lng := ROUND(nova_lng::numeric, 6)::DECIMAL;
    
    -- Atualizar a OS
    UPDATE public.ordens_servico
    SET latitude = nova_lat,
        longitude = nova_lng
    WHERE id = os_record.id;
    
    total_atualizadas := total_atualizadas + 1;
    
    -- Log a cada 10 OSs atualizadas
    IF total_atualizadas % 10 = 0 THEN
      RAISE NOTICE 'Atualizadas % OSs...', total_atualizadas;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de OSs atualizadas: %', total_atualizadas;
  RAISE NOTICE 'Coordenadas atualizadas para Vitória da Conquista!';
  RAISE NOTICE '========================================';
END $$;

-- Atualizar também as coordenadas das equipes para Vitória da Conquista
-- Equipe 1: Centro
UPDATE public.tecnicos
SET latitude = -14.8661,
    longitude = -40.8394,
    local_partida = '{"lat": -14.8661, "lng": -40.8394}'::jsonb
WHERE codigo = 'EQ-001';

-- Equipe 2: Norte
UPDATE public.tecnicos
SET latitude = -14.8500,
    longitude = -40.8300,
    local_partida = '{"lat": -14.8500, "lng": -40.8300}'::jsonb
WHERE codigo = 'EQ-002';

-- Equipe 3: Sul
UPDATE public.tecnicos
SET latitude = -14.8800,
    longitude = -40.8500,
    local_partida = '{"lat": -14.8800, "lng": -40.8500}'::jsonb
WHERE codigo = 'EQ-003';

-- Verificar resultado
SELECT 
  numero,
  tipo,
  latitude,
  longitude,
  ROUND(
    (
      SQRT(
        POWER((latitude - (-14.8661)) * 111, 2) + 
        POWER((longitude - (-40.8394)) * 111 * COS(RADIANS(-14.8661)), 2)
      )
    )::numeric, 
    2
  ) AS distancia_km_do_centro
FROM public.ordens_servico
ORDER BY numero
LIMIT 20;

-- Estatísticas por status
SELECT 
  status,
  COUNT(*) as total,
  ROUND(AVG(latitude)::numeric, 6) as lat_media,
  ROUND(AVG(longitude)::numeric, 6) as lng_media
FROM public.ordens_servico
GROUP BY status
ORDER BY status;

-- Verificar equipes
SELECT codigo, nome, latitude, longitude, local_partida
FROM public.tecnicos
ORDER BY codigo;

