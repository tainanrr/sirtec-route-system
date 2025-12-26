-- =============================================
-- CORRIGIR CONSTRAINT DA TABELA METAS
-- Execute este script no Supabase SQL Editor
-- =============================================

-- 1. Verificar a constraint atual
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'metas'::regclass AND contype = 'c';

-- 2. Remover a constraint existente
ALTER TABLE metas DROP CONSTRAINT IF EXISTS metas_tipo_meta_check;

-- 3. Adicionar nova constraint com os valores corretos
ALTER TABLE metas ADD CONSTRAINT metas_tipo_meta_check 
CHECK (tipo_meta IN ('producao', 'faturamento', 'diaria', 'mensal'));

-- 4. Verificar se a coluna valor_meta existe (pode ser meta_valor)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'metas';

-- 5. Se a coluna se chama meta_valor no banco, renomear para valor_meta
-- (Descomente se necessário)
-- ALTER TABLE metas RENAME COLUMN meta_valor TO valor_meta;

-- 6. Verificar novamente
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'metas'::regclass AND contype = 'c';



