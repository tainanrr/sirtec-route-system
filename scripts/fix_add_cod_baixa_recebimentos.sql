-- =============================================================================
-- Script para adicionar campo cod_baixa na tabela materiais_recebimentos
-- Execute este script no Supabase Dashboard -> SQL Editor
-- =============================================================================

-- Adicionar coluna cod_baixa
ALTER TABLE public.materiais_recebimentos
ADD COLUMN IF NOT EXISTS cod_baixa VARCHAR(100);

-- Criar índice para busca rápida por cod_baixa
CREATE INDEX IF NOT EXISTS idx_materiais_recebimentos_cod_baixa 
ON public.materiais_recebimentos(cod_baixa);

-- Comentário para documentação
COMMENT ON COLUMN public.materiais_recebimentos.cod_baixa IS 'Código de baixa do sistema externo (COELBA) para rastreabilidade';
