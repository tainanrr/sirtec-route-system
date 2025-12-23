-- ===========================================
-- Script para adicionar limites de colaboradores nas equipes
-- ===========================================

-- Adicionar colunas de min/max colaboradores na tabela tecnicos
ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS min_colaboradores INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_colaboradores INTEGER DEFAULT 2;

-- Adicionar comentários
COMMENT ON COLUMN public.tecnicos.min_colaboradores IS 'Quantidade mínima de colaboradores para abrir turno';
COMMENT ON COLUMN public.tecnicos.max_colaboradores IS 'Quantidade máxima de colaboradores para abrir turno';

-- Atualizar todas as equipes existentes com min=1 e max=2
UPDATE public.tecnicos 
SET min_colaboradores = 1, max_colaboradores = 2
WHERE min_colaboradores IS NULL OR max_colaboradores IS NULL;

-- Adicionar constraint de validação
ALTER TABLE public.tecnicos 
DROP CONSTRAINT IF EXISTS chk_colaboradores_limites;

ALTER TABLE public.tecnicos 
ADD CONSTRAINT chk_colaboradores_limites 
CHECK (min_colaboradores >= 1 AND max_colaboradores >= min_colaboradores AND max_colaboradores <= 10);

-- Dropar função existente para recriar com novo tipo de retorno
DROP FUNCTION IF EXISTS public.validar_login_equipe(TEXT, TEXT);

-- Atualizar a função de validação de login para retornar os limites
CREATE OR REPLACE FUNCTION public.validar_login_equipe(
  p_codigo_equipe TEXT,
  p_placa_veiculo TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_equipe_id UUID;
  v_equipe_codigo TEXT;
  v_equipe_nome TEXT;
  v_min_colaboradores INTEGER;
  v_max_colaboradores INTEGER;
  v_colaboradores JSON;
BEGIN
  -- Buscar equipe pelo código (login_ativo = true)
  SELECT id, codigo, nome, 
         COALESCE(min_colaboradores, 1), 
         COALESCE(max_colaboradores, 2)
  INTO v_equipe_id, v_equipe_codigo, v_equipe_nome, v_min_colaboradores, v_max_colaboradores
  FROM public.tecnicos
  WHERE codigo = p_codigo_equipe
    AND (login_ativo = true OR login_ativo IS NULL)
    AND status != 'offline';

  IF v_equipe_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Equipe não encontrada ou inativa'
    );
  END IF;

  -- Buscar colaboradores vinculados à equipe
  SELECT json_agg(
    json_build_object(
      'id', c.id,
      'cpf', c.cpf,
      'nome', c.nome,
      'cargo', c.cargo,
      'funcao', ec.funcao
    )
  )
  INTO v_colaboradores
  FROM public.equipe_colaboradores ec
  INNER JOIN public.colaboradores c ON c.id = ec.colaborador_id
  WHERE ec.equipe_id = v_equipe_id
    AND ec.ativo = true
    AND c.ativo = true;

  RETURN json_build_object(
    'success', true,
    'equipe_id', v_equipe_id,
    'equipe_codigo', v_equipe_codigo,
    'equipe_nome', v_equipe_nome,
    'min_colaboradores', v_min_colaboradores,
    'max_colaboradores', v_max_colaboradores,
    'colaboradores', COALESCE(v_colaboradores, '[]'::json)
  );
END;
$$;

-- ===========================================
-- Adicionar coluna tipo_equipe
-- ===========================================

-- Adicionar coluna tipo_equipe na tabela tecnicos
ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS tipo_equipe TEXT DEFAULT 'normal';

-- Adicionar comentário
COMMENT ON COLUMN public.tecnicos.tipo_equipe IS 'Tipo da equipe: normal, gaviao, kit';

-- Atualizar todas as equipes existentes com tipo 'normal'
UPDATE public.tecnicos 
SET tipo_equipe = 'normal'
WHERE tipo_equipe IS NULL;

-- Adicionar constraint de validação
ALTER TABLE public.tecnicos 
DROP CONSTRAINT IF EXISTS chk_tipo_equipe;

ALTER TABLE public.tecnicos 
ADD CONSTRAINT chk_tipo_equipe 
CHECK (tipo_equipe IN ('normal', 'gaviao', 'kit'));

-- Verificar resultado
SELECT id, codigo, nome, min_colaboradores, max_colaboradores, tipo_equipe 
FROM public.tecnicos 
ORDER BY codigo;

-- ===========================================
-- Adicionar coluna usuario_web_id em coordenadores_supervisores
-- ===========================================

-- Adicionar coluna usuario_web_id para vincular ao usuário web
ALTER TABLE public.coordenadores_supervisores 
ADD COLUMN IF NOT EXISTS usuario_web_id UUID REFERENCES public.usuarios_web(id);

-- Adicionar comentário
COMMENT ON COLUMN public.coordenadores_supervisores.usuario_web_id IS 'ID do usuário web vinculado ao coordenador/supervisor';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_coordenadores_supervisores_usuario_web_id 
ON public.coordenadores_supervisores(usuario_web_id);

-- ===========================================
-- Adicionar coluna coordenador_id para vincular supervisores a coordenadores
-- ===========================================

-- Adicionar coluna coordenador_id (auto-referência)
ALTER TABLE public.coordenadores_supervisores 
ADD COLUMN IF NOT EXISTS coordenador_id UUID REFERENCES public.coordenadores_supervisores(id);

-- Adicionar comentário
COMMENT ON COLUMN public.coordenadores_supervisores.coordenador_id IS 'ID do coordenador responsável (apenas para supervisores)';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_coordenadores_supervisores_coordenador_id 
ON public.coordenadores_supervisores(coordenador_id);

-- ===========================================
-- Garantir coluna contrato_id em usuarios_web
-- ===========================================

-- Adicionar coluna contrato_id em usuarios_web se não existir
ALTER TABLE public.usuarios_web 
ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES public.contratos(id);

-- Adicionar comentário
COMMENT ON COLUMN public.usuarios_web.contrato_id IS 'Contrato vinculado ao usuário';

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_usuarios_web_contrato_id 
ON public.usuarios_web(contrato_id);

-- Verificar resultado
SELECT 
  cs.id, 
  cs.nome, 
  cs.tipo, 
  cs.usuario_web_id, 
  uw.nome as usuario_web_nome,
  cs.coordenador_id,
  coord.nome as coordenador_nome
FROM public.coordenadores_supervisores cs
LEFT JOIN public.usuarios_web uw ON cs.usuario_web_id = uw.id
LEFT JOIN public.coordenadores_supervisores coord ON cs.coordenador_id = coord.id
ORDER BY cs.tipo, cs.nome;

