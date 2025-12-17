-- ============================================================================
-- SCRIPT: Ajustar Prazos das OSs Urgentes (Aleatórios entre 8h e 20h)
-- ============================================================================
-- Este script atualiza as 10 OSs que possuem prazos para terem vencimento
-- aleatório entre 8h e 20h do dia atual
-- ============================================================================

-- Atualizar prazos das 10 OSs urgentes com valores aleatórios entre 8h e 20h
-- Usando random() para gerar valores entre 0 e 1, depois multiplicando por 12 (20-8) e somando 8

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45821';

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45822';

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45823';

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45824';

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45825';

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45826';

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45827';

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45828';

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45829';

UPDATE public.ordens_servico 
SET prazo = CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER)
WHERE numero = '#45830';

-- Verificar resultado
SELECT 
  numero,
  tipo,
  prazo,
  EXTRACT(HOUR FROM prazo) as hora_vencimento,
  CASE 
    WHEN prazo < NOW() THEN 'VENCIDO'
    WHEN EXTRACT(HOUR FROM prazo) < 12 THEN 'MANHÃ'
    ELSE 'TARDE'
  END as status_prazo
FROM public.ordens_servico
WHERE prazo IS NOT NULL
ORDER BY numero;

