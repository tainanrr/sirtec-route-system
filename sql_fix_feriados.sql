-- =====================================================
-- FIX: Atualizar tabela de feriados existente
-- Adicionar suporte a Centro de Custo e Nacional
-- =====================================================

-- 1. Adicionar coluna centro_custo_id (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'feriados' 
                 AND column_name = 'centro_custo_id') THEN
    -- Primeiro criar a tabela centros_custo se não existir
    CREATE TABLE IF NOT EXISTS public.centros_custo (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      codigo VARCHAR(50),
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      contrato_id UUID,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Então adicionar a coluna com referência
    ALTER TABLE public.feriados ADD COLUMN centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Adicionar coluna nacional (se não existir)
ALTER TABLE public.feriados ADD COLUMN IF NOT EXISTS nacional BOOLEAN DEFAULT false;

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS idx_feriados_centro_custo ON public.feriados(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_feriados_nacional ON public.feriados(nacional) WHERE nacional = true;

-- 4. Migrar dados existentes: feriados nacionais (tipo nacional ou sem estado/cidade) marcados como nacional
UPDATE public.feriados 
SET nacional = true 
WHERE tipo = 'nacional' OR (estado IS NULL AND cidade IS NULL AND centro_custo_id IS NULL);

-- 5. Garantir que tecnicos tem centro_custo_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'tecnicos' 
                 AND column_name = 'centro_custo_id') THEN
    ALTER TABLE public.tecnicos ADD COLUMN centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tecnicos_centro_custo ON public.tecnicos(centro_custo_id);

-- 6. Garantir RLS está correto para centros_custo
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso total para autenticados" ON public.centros_custo;
CREATE POLICY "Permitir acesso total para autenticados" ON public.centros_custo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Comentários
COMMENT ON COLUMN public.feriados.centro_custo_id IS 'Centro de custo específico (NULL para nacionais ou todos)';
COMMENT ON COLUMN public.feriados.nacional IS 'Se true, aplica a todos os centros de custo';
COMMENT ON COLUMN public.tecnicos.centro_custo_id IS 'Centro de custo vinculado à equipe';

-- =====================================================
-- Ajustar tabela de metas
-- =====================================================

-- Garantir que meta_quantidade permite NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'metas' 
             AND column_name = 'meta_quantidade') THEN
    ALTER TABLE public.metas ALTER COLUMN meta_quantidade DROP NOT NULL;
    ALTER TABLE public.metas ALTER COLUMN meta_quantidade SET DEFAULT NULL;
  END IF;
END $$;

-- Garantir que meta_valor existe
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS meta_valor DECIMAL(12, 2);

-- =====================================================
-- Verificação final
-- =====================================================

-- Verificar colunas da tabela feriados
SELECT 'Colunas da tabela feriados:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'feriados' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar colunas da tabela tecnicos (centro_custo_id)
SELECT 'Verificando centro_custo_id em tecnicos:' as info;
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'tecnicos' AND column_name = 'centro_custo_id';
