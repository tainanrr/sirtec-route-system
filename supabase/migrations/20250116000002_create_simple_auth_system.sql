-- Sistema de autenticação simples para equipes
-- Usuário/senha direto no banco, sem depender do Supabase Auth

-- Criar extensão para hash de senha (se não existir)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabela de autenticação das equipes
CREATE TABLE IF NOT EXISTS public.equipe_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL, -- Hash bcrypt da senha
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_equipe_auth_equipe FOREIGN KEY (equipe_id) REFERENCES public.tecnicos(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_equipe_auth_usuario ON public.equipe_auth(usuario);
CREATE INDEX IF NOT EXISTS idx_equipe_auth_equipe_id ON public.equipe_auth(equipe_id);

-- Função para criar/atualizar credenciais de equipe
CREATE OR REPLACE FUNCTION public.criar_credenciais_equipe(
  p_equipe_id UUID,
  p_usuario VARCHAR(50),
  p_senha TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_senha_hash TEXT;
  v_result JSONB;
BEGIN
  -- Gerar hash da senha usando crypt (bcrypt)
  v_senha_hash := crypt(p_senha, gen_salt('bf', 10));
  
  -- Inserir ou atualizar credenciais
  INSERT INTO public.equipe_auth (equipe_id, usuario, senha_hash)
  VALUES (p_equipe_id, p_usuario, v_senha_hash)
  ON CONFLICT (usuario) 
  DO UPDATE SET
    senha_hash = EXCLUDED.senha_hash,
    updated_at = NOW();
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Credenciais criadas/atualizadas com sucesso',
    'usuario', p_usuario
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
    RETURN v_result;
END;
$$;

-- Função para autenticar equipe
CREATE OR REPLACE FUNCTION public.autenticar_equipe(
  p_usuario VARCHAR(50),
  p_senha TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_equipe_auth RECORD;
  v_equipe RECORD;
  v_result JSONB;
BEGIN
  -- Buscar credenciais
  SELECT ea.*, t.id as tecnico_id, t.codigo, t.nome, t.status, t.habilidades
  INTO v_equipe_auth
  FROM public.equipe_auth ea
  INNER JOIN public.tecnicos t ON t.id = ea.equipe_id
  WHERE ea.usuario = p_usuario;
  
  -- Verificar se encontrou
  IF v_equipe_auth IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Usuário não encontrado'
    );
  END IF;
  
  -- Verificar senha
  IF v_equipe_auth.senha_hash != crypt(p_senha, v_equipe_auth.senha_hash) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Senha incorreta'
    );
  END IF;
  
  -- Verificar se equipe está ativa
  IF v_equipe_auth.status NOT IN ('ativo', 'disponivel', 'em_servico') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Equipe inativa'
    );
  END IF;
  
  -- Retornar dados da equipe
  RETURN jsonb_build_object(
    'success', true,
    'equipe', jsonb_build_object(
      'id', v_equipe_auth.tecnico_id,
      'codigo', v_equipe_auth.codigo,
      'nome', v_equipe_auth.nome,
      'status', v_equipe_auth.status,
      'habilidades', v_equipe_auth.habilidades,
      'usuario', v_equipe_auth.usuario
    )
  );
END;
$$;

-- Função para atualizar senha
CREATE OR REPLACE FUNCTION public.atualizar_senha_equipe(
  p_usuario VARCHAR(50),
  p_senha_antiga TEXT,
  p_senha_nova TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_equipe_auth RECORD;
  v_senha_hash TEXT;
  v_result JSONB;
BEGIN
  -- Buscar credenciais
  SELECT * INTO v_equipe_auth
  FROM public.equipe_auth
  WHERE usuario = p_usuario;
  
  IF v_equipe_auth IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado');
  END IF;
  
  -- Verificar senha antiga
  IF v_equipe_auth.senha_hash != crypt(p_senha_antiga, v_equipe_auth.senha_hash) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Senha atual incorreta');
  END IF;
  
  -- Gerar novo hash
  v_senha_hash := crypt(p_senha_nova, gen_salt('bf', 10));
  
  -- Atualizar
  UPDATE public.equipe_auth
  SET senha_hash = v_senha_hash, updated_at = NOW()
  WHERE usuario = p_usuario;
  
  RETURN jsonb_build_object('success', true, 'message', 'Senha atualizada com sucesso');
END;
$$;

-- Habilitar RLS
ALTER TABLE public.equipe_auth ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode autenticar (função já é SECURITY DEFINER)
CREATE POLICY "Permitir autenticação pública"
ON public.equipe_auth
FOR SELECT
USING (true);

-- Comentários
COMMENT ON TABLE public.equipe_auth IS 'Credenciais de autenticação das equipes';
COMMENT ON FUNCTION public.criar_credenciais_equipe IS 'Cria ou atualiza credenciais de uma equipe';
COMMENT ON FUNCTION public.autenticar_equipe IS 'Autentica uma equipe e retorna seus dados';
COMMENT ON FUNCTION public.atualizar_senha_equipe IS 'Atualiza a senha de uma equipe';



-- Usuário/senha direto no banco, sem depender do Supabase Auth

-- Criar extensão para hash de senha (se não existir)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabela de autenticação das equipes
CREATE TABLE IF NOT EXISTS public.equipe_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL, -- Hash bcrypt da senha
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_equipe_auth_equipe FOREIGN KEY (equipe_id) REFERENCES public.tecnicos(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_equipe_auth_usuario ON public.equipe_auth(usuario);
CREATE INDEX IF NOT EXISTS idx_equipe_auth_equipe_id ON public.equipe_auth(equipe_id);

-- Função para criar/atualizar credenciais de equipe
CREATE OR REPLACE FUNCTION public.criar_credenciais_equipe(
  p_equipe_id UUID,
  p_usuario VARCHAR(50),
  p_senha TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_senha_hash TEXT;
  v_result JSONB;
BEGIN
  -- Gerar hash da senha usando crypt (bcrypt)
  v_senha_hash := crypt(p_senha, gen_salt('bf', 10));
  
  -- Inserir ou atualizar credenciais
  INSERT INTO public.equipe_auth (equipe_id, usuario, senha_hash)
  VALUES (p_equipe_id, p_usuario, v_senha_hash)
  ON CONFLICT (usuario) 
  DO UPDATE SET
    senha_hash = EXCLUDED.senha_hash,
    updated_at = NOW();
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Credenciais criadas/atualizadas com sucesso',
    'usuario', p_usuario
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
    RETURN v_result;
END;
$$;

-- Função para autenticar equipe
CREATE OR REPLACE FUNCTION public.autenticar_equipe(
  p_usuario VARCHAR(50),
  p_senha TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_equipe_auth RECORD;
  v_equipe RECORD;
  v_result JSONB;
BEGIN
  -- Buscar credenciais
  SELECT ea.*, t.id as tecnico_id, t.codigo, t.nome, t.status, t.habilidades
  INTO v_equipe_auth
  FROM public.equipe_auth ea
  INNER JOIN public.tecnicos t ON t.id = ea.equipe_id
  WHERE ea.usuario = p_usuario;
  
  -- Verificar se encontrou
  IF v_equipe_auth IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Usuário não encontrado'
    );
  END IF;
  
  -- Verificar senha
  IF v_equipe_auth.senha_hash != crypt(p_senha, v_equipe_auth.senha_hash) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Senha incorreta'
    );
  END IF;
  
  -- Verificar se equipe está ativa
  IF v_equipe_auth.status NOT IN ('ativo', 'disponivel', 'em_servico') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Equipe inativa'
    );
  END IF;
  
  -- Retornar dados da equipe
  RETURN jsonb_build_object(
    'success', true,
    'equipe', jsonb_build_object(
      'id', v_equipe_auth.tecnico_id,
      'codigo', v_equipe_auth.codigo,
      'nome', v_equipe_auth.nome,
      'status', v_equipe_auth.status,
      'habilidades', v_equipe_auth.habilidades,
      'usuario', v_equipe_auth.usuario
    )
  );
END;
$$;

-- Função para atualizar senha
CREATE OR REPLACE FUNCTION public.atualizar_senha_equipe(
  p_usuario VARCHAR(50),
  p_senha_antiga TEXT,
  p_senha_nova TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_equipe_auth RECORD;
  v_senha_hash TEXT;
  v_result JSONB;
BEGIN
  -- Buscar credenciais
  SELECT * INTO v_equipe_auth
  FROM public.equipe_auth
  WHERE usuario = p_usuario;
  
  IF v_equipe_auth IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado');
  END IF;
  
  -- Verificar senha antiga
  IF v_equipe_auth.senha_hash != crypt(p_senha_antiga, v_equipe_auth.senha_hash) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Senha atual incorreta');
  END IF;
  
  -- Gerar novo hash
  v_senha_hash := crypt(p_senha_nova, gen_salt('bf', 10));
  
  -- Atualizar
  UPDATE public.equipe_auth
  SET senha_hash = v_senha_hash, updated_at = NOW()
  WHERE usuario = p_usuario;
  
  RETURN jsonb_build_object('success', true, 'message', 'Senha atualizada com sucesso');
END;
$$;

-- Habilitar RLS
ALTER TABLE public.equipe_auth ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode autenticar (função já é SECURITY DEFINER)
CREATE POLICY "Permitir autenticação pública"
ON public.equipe_auth
FOR SELECT
USING (true);

-- Comentários
COMMENT ON TABLE public.equipe_auth IS 'Credenciais de autenticação das equipes';
COMMENT ON FUNCTION public.criar_credenciais_equipe IS 'Cria ou atualiza credenciais de uma equipe';
COMMENT ON FUNCTION public.autenticar_equipe IS 'Autentica uma equipe e retorna seus dados';
COMMENT ON FUNCTION public.atualizar_senha_equipe IS 'Atualiza a senha de uma equipe';






