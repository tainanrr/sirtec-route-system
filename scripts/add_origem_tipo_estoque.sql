-- =====================================================
-- Migration: Adicionar campo origem_tipo na tabela materiais_estoque
-- Objetivo: Diferenciar materiais que vieram de entregas normais
-- dos que foram retirados em campo
-- =====================================================

-- Adicionar coluna origem_tipo
ALTER TABLE public.materiais_estoque
ADD COLUMN IF NOT EXISTS origem_tipo VARCHAR(50) DEFAULT 'entrega';

-- Comentário explicativo
COMMENT ON COLUMN public.materiais_estoque.origem_tipo IS 
'Origem do material no estoque: entrega (recebido via entrega normal), retirado_campo (retirado de uma OS em campo)';

-- Índice para busca por origem
CREATE INDEX IF NOT EXISTS idx_estoque_origem_tipo ON public.materiais_estoque(origem_tipo);

-- Garantir que registros existentes tenham valor padrão
UPDATE public.materiais_estoque
SET origem_tipo = 'entrega'
WHERE origem_tipo IS NULL;
