-- Migration: Mover retornos do grupo "parcial" para "impedimento" e excluir grupo parcial
-- Data: 02/01/2026

-- 1. Atualizar todos os retornos_campo que estão no grupo "parcial" para "impedimento"
UPDATE public.retornos_campo 
SET tipo = 'impedimento'
WHERE tipo = 'parcial';

-- 2. Excluir o grupo "parcial" da tabela grupos_retorno
DELETE FROM public.grupos_retorno 
WHERE codigo = 'parcial';

