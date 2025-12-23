-- ============================================================================
-- SCRIPT: Adicionar campos REGULADA e ICONE à tabela SKILLS
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para adicionar os campos
-- Este script é seguro para executar múltiplas vezes (idempotente)
-- ============================================================================

-- Verificar e adicionar a coluna REGULADA se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'skills' 
    AND column_name = 'regulada'
  ) THEN
    ALTER TABLE public.skills 
    ADD COLUMN regulada BOOLEAN NOT NULL DEFAULT false;
    
    RAISE NOTICE 'Coluna REGULADA adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna REGULADA já existe na tabela skills.';
  END IF;
END $$;

-- Verificar e adicionar a coluna ICONE se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'skills' 
    AND column_name = 'icone'
  ) THEN
    ALTER TABLE public.skills 
    ADD COLUMN icone TEXT;
    
    RAISE NOTICE 'Coluna ICONE adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna ICONE já existe na tabela skills.';
  END IF;
END $$;

-- Atualizar valores padrão das skills existentes
UPDATE public.skills 
SET regulada = true, icone = 'Search'
WHERE codigo = 'INSPEÇÃO' AND (regulada IS NULL OR icone IS NULL);

UPDATE public.skills 
SET regulada = false, icone = 'Power'
WHERE codigo = 'CORTE' AND (regulada IS NULL OR icone IS NULL);

UPDATE public.skills 
SET regulada = false, icone = 'Zap'
WHERE codigo = 'RELIGA' AND (regulada IS NULL OR icone IS NULL);

-- Adicionar comentários nas colunas (se ainda não existirem)
COMMENT ON COLUMN public.skills.regulada IS 'Indica se a skill é regulada (true) ou não regulada (false)';
COMMENT ON COLUMN public.skills.icone IS 'Nome do ícone do Lucide React para visualização (ex: Zap, AlertCircle, Wrench)';

-- Verificar resultado
SELECT 
  codigo,
  nome,
  tempo_execucao_minutos,
  valor,
  regulada,
  icone,
  ativo
FROM public.skills
ORDER BY codigo;

















