-- ============================================================================
-- SCRIPT: Adicionar campo VALOR à tabela SKILLS
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para adicionar o campo valor
-- Este script é seguro para executar múltiplas vezes (idempotente)
-- ============================================================================

-- Verificar e adicionar a coluna VALOR se não existir
DO $$
BEGIN
  -- Verificar se a coluna já existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'skills' 
    AND column_name = 'valor'
  ) THEN
    -- Adicionar a coluna valor
    ALTER TABLE public.skills 
    ADD COLUMN valor DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
    
    RAISE NOTICE 'Coluna VALOR adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna VALOR já existe na tabela skills.';
  END IF;
END $$;

-- Atualizar valores padrão das skills existentes (apenas se ainda estiverem com valor 0)
UPDATE public.skills 
SET valor = 60.00 
WHERE codigo = 'CORTE' AND (valor IS NULL OR valor = 0);

UPDATE public.skills 
SET valor = 50.00 
WHERE codigo = 'RELIGA' AND (valor IS NULL OR valor = 0);

UPDATE public.skills 
SET valor = 80.00 
WHERE codigo = 'INSPEÇÃO' AND (valor IS NULL OR valor = 0);

-- Adicionar comentário na coluna (se ainda não existir)
COMMENT ON COLUMN public.skills.valor IS 'Valor padrão da skill em reais (R$)';

-- Verificar resultado
SELECT 
  codigo,
  nome,
  tempo_execucao_minutos,
  valor,
  ativo
FROM public.skills
ORDER BY codigo;















