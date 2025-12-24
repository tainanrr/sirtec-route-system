-- =====================================================
-- FIX: Desabilitar RLS para tabela centros_custo
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- OPÇÃO 1: Desabilitar RLS completamente para esta tabela
ALTER TABLE centros_custo DISABLE ROW LEVEL SECURITY;

-- OPÇÃO 2: Se preferir manter RLS, use as políticas abaixo
-- (descomente se a opção 1 não funcionar ou se quiser RLS)

/*
-- Habilitar RLS
ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;

-- Forçar RLS para o owner também
ALTER TABLE centros_custo FORCE ROW LEVEL SECURITY;

-- Remover TODAS as políticas existentes
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'centros_custo'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON centros_custo', pol.policyname);
    END LOOP;
END $$;

-- Criar política única que permite tudo para authenticated
CREATE POLICY "allow_all_authenticated" ON centros_custo
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Criar política para anon também (se necessário)
CREATE POLICY "allow_all_anon" ON centros_custo
    FOR ALL 
    TO anon
    USING (true)
    WITH CHECK (true);
*/

-- Garantir que campos removidos do formulário são opcionais
ALTER TABLE centros_custo ALTER COLUMN codigo DROP NOT NULL;
ALTER TABLE centros_custo ALTER COLUMN contrato_id DROP NOT NULL;
ALTER TABLE centros_custo ALTER COLUMN responsavel_id DROP NOT NULL;
ALTER TABLE centros_custo ALTER COLUMN orcamento_previsto DROP NOT NULL;
ALTER TABLE centros_custo ALTER COLUMN centro_pai_id DROP NOT NULL;

-- Definir valor padrão para código se não existir
ALTER TABLE centros_custo ALTER COLUMN codigo SET DEFAULT NULL;

-- Verificar status do RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'centros_custo';

-- Listar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'centros_custo';

-- Mostrar estrutura da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'centros_custo'
ORDER BY ordinal_position;



