-- =====================================================
-- FIX: RLS Policy para centros_custo
-- =====================================================

-- Desabilitar RLS temporariamente
ALTER TABLE public.centros_custo DISABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas existentes
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'centros_custo' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.centros_custo', pol.policyname);
    END LOOP;
END $$;

-- Criar política única e permissiva
CREATE POLICY "centros_custo_all_access" ON public.centros_custo
  FOR ALL 
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Habilitar RLS com a nova política
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

-- Verificar status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'centros_custo';

SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'centros_custo';







