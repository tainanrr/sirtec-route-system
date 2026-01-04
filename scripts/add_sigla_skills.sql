-- Script para adicionar coluna sigla na tabela skills
-- Execute este script no Supabase Dashboard > SQL Editor

-- Adicionar coluna sigla (máximo 3 caracteres)
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS sigla VARCHAR(3);

-- Comentário na coluna
COMMENT ON COLUMN public.skills.sigla IS 'Sigla de até 3 caracteres exibida no mapa de roteirização';

