-- Migration: Mover retornos do grupo "parcial" para "impedimento" e excluir grupo parcial
-- Data: 02/01/2026

-- 1. Atualizar todos os retornos_campo que estão no grupo "parcial" 
--    para apontar para "impedimento" (tanto tipo quanto grupo_id)
UPDATE public.retornos_campo 
SET tipo = 'impedimento',
    grupo_id = (SELECT id FROM public.grupos_retorno WHERE codigo = 'impedimento')
WHERE tipo = 'parcial' 
   OR grupo_id = (SELECT id FROM public.grupos_retorno WHERE codigo = 'parcial');

-- 2. Agora sim, excluir o grupo "parcial" da tabela grupos_retorno
DELETE FROM public.grupos_retorno 
WHERE codigo = 'parcial';

