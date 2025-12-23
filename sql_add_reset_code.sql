-- =====================================================
-- EXECUTE ESTE SCRIPT NO SUPABASE DASHBOARD (SQL Editor)
-- Adiciona campos para recuperação de senha
-- =====================================================

-- Adicionar campo de código de reset
ALTER TABLE public.usuarios_web ADD COLUMN IF NOT EXISTS reset_code VARCHAR(10);

-- Adicionar campo de expiração do código
ALTER TABLE public.usuarios_web ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMPTZ;

-- Comentários
COMMENT ON COLUMN public.usuarios_web.reset_code IS 'Código de recuperação de senha (6 dígitos)';
COMMENT ON COLUMN public.usuarios_web.reset_code_expires IS 'Data/hora de expiração do código de reset';

-- Verificar
SELECT 'Campos adicionados com sucesso!' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'usuarios_web' 
AND column_name IN ('reset_code', 'reset_code_expires');

