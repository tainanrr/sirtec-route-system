-- Adicionar campos de usuário e senha para equipes
-- Permite login no aplicativo móvel usando credenciais da equipe

-- Adicionar coluna user_id (vinculação com auth.users)
ALTER TABLE public.tecnicos
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Adicionar coluna usuario (nome de usuário para login)
ALTER TABLE public.tecnicos
ADD COLUMN IF NOT EXISTS usuario VARCHAR(50) UNIQUE;

-- Criar índice para busca rápida por user_id
CREATE INDEX IF NOT EXISTS idx_tecnicos_user_id ON public.tecnicos(user_id);

-- Criar índice para busca rápida por usuario
CREATE INDEX IF NOT EXISTS idx_tecnicos_usuario ON public.tecnicos(usuario);

-- Comentários nas colunas
COMMENT ON COLUMN public.tecnicos.user_id IS 'ID do usuário no Supabase Auth vinculado a esta equipe';
COMMENT ON COLUMN public.tecnicos.usuario IS 'Nome de usuário para login no aplicativo móvel';


-- Permite login no aplicativo móvel usando credenciais da equipe

-- Adicionar coluna user_id (vinculação com auth.users)
ALTER TABLE public.tecnicos
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Adicionar coluna usuario (nome de usuário para login)
ALTER TABLE public.tecnicos
ADD COLUMN IF NOT EXISTS usuario VARCHAR(50) UNIQUE;

-- Criar índice para busca rápida por user_id
CREATE INDEX IF NOT EXISTS idx_tecnicos_user_id ON public.tecnicos(user_id);

-- Criar índice para busca rápida por usuario
CREATE INDEX IF NOT EXISTS idx_tecnicos_usuario ON public.tecnicos(usuario);

-- Comentários nas colunas
COMMENT ON COLUMN public.tecnicos.user_id IS 'ID do usuário no Supabase Auth vinculado a esta equipe';
COMMENT ON COLUMN public.tecnicos.usuario IS 'Nome de usuário para login no aplicativo móvel';









