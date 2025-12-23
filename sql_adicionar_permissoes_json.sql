-- ===========================================
-- Script para adicionar coluna de permissões JSON
-- Execute este script no SQL Editor do Supabase
-- ===========================================

-- Adicionar coluna permissoes_json na tabela perfis_permissao
ALTER TABLE public.perfis_permissao 
ADD COLUMN IF NOT EXISTS permissoes_json JSONB DEFAULT '{}'::JSONB;

-- Adicionar comentário
COMMENT ON COLUMN public.perfis_permissao.permissoes_json IS 'Permissões por tela no formato {"tela_id": {"editar": boolean, "consultar": boolean}}';

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_perfis_permissao_permissoes_json ON public.perfis_permissao USING gin (permissoes_json);

-- Migrar dados existentes (se houver permissões antigas na tabela perfil_permissoes)
-- Criar um perfil padrão de Admin com todas as permissões
DO $$
DECLARE
  v_admin_id UUID;
  v_permissoes JSONB;
BEGIN
  -- Buscar perfil Admin existente
  SELECT id INTO v_admin_id 
  FROM public.perfis_permissao 
  WHERE is_admin = true 
  LIMIT 1;

  -- Criar estrutura de permissões padrão com todas as telas liberadas para edição
  -- Lista de telas utilizadas no sistema:
  -- Dashboard: dashboard
  -- Operacional: torre_controle, roteirizacao, acompanhamento_rotas
  -- Ordens de Serviço: ordens_servico, consulta_checklists
  -- Materiais: materiais
  -- Cadastros: equipes, skills, territorios, coordenadores, veiculos, metas
  -- Admin: contratos, usuarios_web, colaboradores, permissoes, cadastros_base, procedimentos, checklists, logs
  -- Cadastros Base: precificacao, centros_custo, unidades_medida, grupos_servico, feriados, motivos_cancelamento
  v_permissoes := '{
    "dashboard": {"editar": true, "consultar": true},
    "torre_controle": {"editar": true, "consultar": true},
    "roteirizacao": {"editar": true, "consultar": true},
    "acompanhamento_rotas": {"editar": true, "consultar": true},
    "ordens_servico": {"editar": true, "consultar": true},
    "consulta_checklists": {"editar": true, "consultar": true},
    "materiais": {"editar": true, "consultar": true},
    "equipes": {"editar": true, "consultar": true},
    "skills": {"editar": true, "consultar": true},
    "territorios": {"editar": true, "consultar": true},
    "coordenadores": {"editar": true, "consultar": true},
    "veiculos": {"editar": true, "consultar": true},
    "metas": {"editar": true, "consultar": true},
    "contratos": {"editar": true, "consultar": true},
    "usuarios_web": {"editar": true, "consultar": true},
    "colaboradores": {"editar": true, "consultar": true},
    "permissoes": {"editar": true, "consultar": true},
    "cadastros_base": {"editar": true, "consultar": true},
    "precificacao": {"editar": true, "consultar": true},
    "centros_custo": {"editar": true, "consultar": true},
    "procedimentos": {"editar": true, "consultar": true},
    "checklists": {"editar": true, "consultar": true},
    "logs": {"editar": true, "consultar": true}
  }'::JSONB;

  -- Atualizar perfil Admin se existir
  IF v_admin_id IS NOT NULL THEN
    UPDATE public.perfis_permissao 
    SET permissoes_json = v_permissoes
    WHERE id = v_admin_id;
    RAISE NOTICE 'Perfil Admin atualizado com todas as permissões';
  ELSE
    -- Criar perfil Admin se não existir
    INSERT INTO public.perfis_permissao (nome, descricao, is_admin, ativo, permissoes_json)
    VALUES ('Administrador', 'Acesso total ao sistema', true, true, v_permissoes);
    RAISE NOTICE 'Perfil Admin criado com todas as permissões';
  END IF;

  -- Criar perfil de Operador (apenas consulta)
  IF NOT EXISTS (SELECT 1 FROM public.perfis_permissao WHERE nome = 'Operador') THEN
    INSERT INTO public.perfis_permissao (nome, descricao, is_admin, ativo, permissoes_json)
    VALUES ('Operador', 'Acesso básico para operações de campo', false, true, '{
      "dashboard": {"editar": false, "consultar": true},
      "torre_controle": {"editar": false, "consultar": true},
      "roteirizacao": {"editar": false, "consultar": true},
      "acompanhamento_rotas": {"editar": false, "consultar": true},
      "ordens_servico": {"editar": false, "consultar": true},
      "equipes": {"editar": false, "consultar": true}
    }'::JSONB);
    RAISE NOTICE 'Perfil Operador criado';
  END IF;

  -- Criar perfil de Supervisor (edição em algumas telas)
  IF NOT EXISTS (SELECT 1 FROM public.perfis_permissao WHERE nome = 'Supervisor') THEN
    INSERT INTO public.perfis_permissao (nome, descricao, is_admin, ativo, permissoes_json)
    VALUES ('Supervisor', 'Acesso para supervisão de equipes', false, true, '{
      "dashboard": {"editar": false, "consultar": true},
      "torre_controle": {"editar": false, "consultar": true},
      "roteirizacao": {"editar": true, "consultar": true},
      "acompanhamento_rotas": {"editar": true, "consultar": true},
      "ordens_servico": {"editar": true, "consultar": true},
      "equipes": {"editar": true, "consultar": true},
      "colaboradores": {"editar": true, "consultar": true},
      "metas": {"editar": true, "consultar": true}
    }'::JSONB);
    RAISE NOTICE 'Perfil Supervisor criado';
  END IF;

  -- Criar perfil de Visualizador (apenas consulta em todas as telas)
  IF NOT EXISTS (SELECT 1 FROM public.perfis_permissao WHERE nome = 'Visualizador') THEN
    INSERT INTO public.perfis_permissao (nome, descricao, is_admin, ativo, permissoes_json)
    VALUES ('Visualizador', 'Acesso somente leitura a todas as telas', false, true, '{
      "dashboard": {"editar": false, "consultar": true},
      "torre_controle": {"editar": false, "consultar": true},
      "roteirizacao": {"editar": false, "consultar": true},
      "acompanhamento_rotas": {"editar": false, "consultar": true},
      "ordens_servico": {"editar": false, "consultar": true},
      "consulta_checklists": {"editar": false, "consultar": true},
      "materiais": {"editar": false, "consultar": true},
      "equipes": {"editar": false, "consultar": true},
      "skills": {"editar": false, "consultar": true},
      "territorios": {"editar": false, "consultar": true},
      "coordenadores": {"editar": false, "consultar": true},
      "veiculos": {"editar": false, "consultar": true},
      "metas": {"editar": false, "consultar": true},
      "contratos": {"editar": false, "consultar": true},
      "usuarios_web": {"editar": false, "consultar": true},
      "colaboradores": {"editar": false, "consultar": true},
      "permissoes": {"editar": false, "consultar": true},
      "cadastros_base": {"editar": false, "consultar": true},
      "precificacao": {"editar": false, "consultar": true},
      "centros_custo": {"editar": false, "consultar": true},
      "procedimentos": {"editar": false, "consultar": true},
      "checklists": {"editar": false, "consultar": true},
      "logs": {"editar": false, "consultar": true}
    }'::JSONB);
    RAISE NOTICE 'Perfil Visualizador criado';
  END IF;

END $$;

-- =============================================
-- Comando para atualizar perfil existente
-- Use este comando se você já tem um perfil "Visualizador" 
-- e precisa configurar as permissões corretamente
-- =============================================

-- Para atualizar um perfil específico com permissões de apenas visualização:
-- UPDATE public.perfis_permissao 
-- SET permissoes_json = '{
--   "dashboard": {"editar": false, "consultar": true},
--   "torre_controle": {"editar": false, "consultar": true},
--   "roteirizacao": {"editar": false, "consultar": true},
--   "acompanhamento_rotas": {"editar": false, "consultar": true},
--   "ordens_servico": {"editar": false, "consultar": true},
--   "consulta_checklists": {"editar": false, "consultar": true},
--   "materiais": {"editar": false, "consultar": true},
--   "equipes": {"editar": false, "consultar": true},
--   "skills": {"editar": false, "consultar": true},
--   "territorios": {"editar": false, "consultar": true},
--   "coordenadores": {"editar": false, "consultar": true},
--   "veiculos": {"editar": false, "consultar": true},
--   "metas": {"editar": false, "consultar": true},
--   "contratos": {"editar": false, "consultar": true},
--   "usuarios_web": {"editar": false, "consultar": true},
--   "colaboradores": {"editar": false, "consultar": true},
--   "permissoes": {"editar": false, "consultar": true},
--   "cadastros_base": {"editar": false, "consultar": true},
--   "procedimentos": {"editar": false, "consultar": true},
--   "checklists": {"editar": false, "consultar": true},
--   "logs": {"editar": false, "consultar": true}
-- }'::JSONB
-- WHERE nome = 'NOME_DO_SEU_PERFIL';

-- Verificar resultado
SELECT 
  id,
  nome,
  descricao,
  is_admin,
  ativo,
  permissoes_json
FROM public.perfis_permissao
ORDER BY nome;

