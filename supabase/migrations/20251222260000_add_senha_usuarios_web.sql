-- =====================================================
-- Adicionar campo senha_hash na tabela usuarios_web
-- =====================================================

-- Adicionar campo de senha
ALTER TABLE public.usuarios_web ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255);

-- Adicionar campo centro_custo
ALTER TABLE public.usuarios_web ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(100);

-- Comentários
COMMENT ON COLUMN public.usuarios_web.senha_hash IS 'Hash da senha do usuário (para login simples sem auth.users)';
COMMENT ON COLUMN public.usuarios_web.centro_custo IS 'Centro de custo associado ao usuário';
