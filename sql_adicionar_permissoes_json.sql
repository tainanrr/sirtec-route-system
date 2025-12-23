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
  v_permissoes := '{
    "dashboard": {"editar": true, "consultar": true},
    "roteirizacao": {"editar": true, "consultar": true},
    "acompanhamento_rotas": {"editar": true, "consultar": true},
    "torre_controle": {"editar": true, "consultar": true},
    "ordens_servico": {"editar": true, "consultar": true},
    "importar_os": {"editar": true, "consultar": true},
    "equipes": {"editar": true, "consultar": true},
    "colaboradores": {"editar": true, "consultar": true},
    "coordenadores": {"editar": true, "consultar": true},
    "skills": {"editar": true, "consultar": true},
    "veiculos": {"editar": true, "consultar": true},
    "territorios": {"editar": true, "consultar": true},
    "pontos_saida": {"editar": true, "consultar": true},
    "poligonos": {"editar": true, "consultar": true},
    "checklists": {"editar": true, "consultar": true},
    "metas": {"editar": true, "consultar": true},
    "materiais_dashboard": {"editar": true, "consultar": true},
    "catalogo_materiais": {"editar": true, "consultar": true},
    "estoque_central": {"editar": true, "consultar": true},
    "movimentacoes": {"editar": true, "consultar": true},
    "recebimentos": {"editar": true, "consultar": true},
    "entregas_equipes": {"editar": true, "consultar": true},
    "devolucoes": {"editar": true, "consultar": true},
    "aplicacoes_os": {"editar": true, "consultar": true},
    "rastreabilidade": {"editar": true, "consultar": true},
    "planejamento_diario": {"editar": true, "consultar": true},
    "agenda": {"editar": true, "consultar": true},
    "relatorios_produtividade": {"editar": true, "consultar": true},
    "relatorios_materiais": {"editar": true, "consultar": true},
    "relatorios_financeiro": {"editar": true, "consultar": true},
    "relatorios_kpis": {"editar": true, "consultar": true},
    "usuarios_web": {"editar": true, "consultar": true},
    "usuarios_app": {"editar": true, "consultar": true},
    "contratos": {"editar": true, "consultar": true},
    "permissoes": {"editar": true, "consultar": true},
    "cadastros_base": {"editar": true, "consultar": true},
    "procedimentos": {"editar": true, "consultar": true},
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
      "roteirizacao": {"editar": true, "consultar": true},
      "acompanhamento_rotas": {"editar": true, "consultar": true},
      "torre_controle": {"editar": false, "consultar": true},
      "ordens_servico": {"editar": true, "consultar": true},
      "equipes": {"editar": true, "consultar": true},
      "colaboradores": {"editar": true, "consultar": true},
      "metas": {"editar": true, "consultar": true},
      "relatorios_produtividade": {"editar": false, "consultar": true}
    }'::JSONB);
    RAISE NOTICE 'Perfil Supervisor criado';
  END IF;

  -- Criar perfil de Visualizador (apenas consulta em todas as telas)
  IF NOT EXISTS (SELECT 1 FROM public.perfis_permissao WHERE nome = 'Visualizador') THEN
    INSERT INTO public.perfis_permissao (nome, descricao, is_admin, ativo, permissoes_json)
    VALUES ('Visualizador', 'Acesso somente leitura a todas as telas', false, true, '{
      "dashboard": {"editar": false, "consultar": true},
      "roteirizacao": {"editar": false, "consultar": true},
      "acompanhamento_rotas": {"editar": false, "consultar": true},
      "torre_controle": {"editar": false, "consultar": true},
      "ordens_servico": {"editar": false, "consultar": true},
      "importar_os": {"editar": false, "consultar": true},
      "equipes": {"editar": false, "consultar": true},
      "colaboradores": {"editar": false, "consultar": true},
      "coordenadores": {"editar": false, "consultar": true},
      "skills": {"editar": false, "consultar": true},
      "veiculos": {"editar": false, "consultar": true},
      "territorios": {"editar": false, "consultar": true},
      "pontos_saida": {"editar": false, "consultar": true},
      "poligonos": {"editar": false, "consultar": true},
      "checklists": {"editar": false, "consultar": true},
      "metas": {"editar": false, "consultar": true},
      "materiais_dashboard": {"editar": false, "consultar": true},
      "catalogo_materiais": {"editar": false, "consultar": true},
      "estoque_central": {"editar": false, "consultar": true},
      "movimentacoes": {"editar": false, "consultar": true},
      "recebimentos": {"editar": false, "consultar": true},
      "entregas_equipes": {"editar": false, "consultar": true},
      "devolucoes": {"editar": false, "consultar": true},
      "aplicacoes_os": {"editar": false, "consultar": true},
      "rastreabilidade": {"editar": false, "consultar": true},
      "planejamento_diario": {"editar": false, "consultar": true},
      "agenda": {"editar": false, "consultar": true},
      "relatorios_produtividade": {"editar": false, "consultar": true},
      "relatorios_materiais": {"editar": false, "consultar": true},
      "relatorios_financeiro": {"editar": false, "consultar": true},
      "relatorios_kpis": {"editar": false, "consultar": true},
      "usuarios_web": {"editar": false, "consultar": true},
      "usuarios_app": {"editar": false, "consultar": true},
      "contratos": {"editar": false, "consultar": true},
      "permissoes": {"editar": false, "consultar": true},
      "cadastros_base": {"editar": false, "consultar": true},
      "procedimentos": {"editar": false, "consultar": true},
      "logs": {"editar": false, "consultar": true}
    }'::JSONB);
    RAISE NOTICE 'Perfil Visualizador criado';
  END IF;

END $$;

-- Verificar resultado
SELECT 
  id,
  nome,
  descricao,
  is_admin,
  ativo,
  jsonb_object_keys(permissoes_json) as telas_com_permissao
FROM public.perfis_permissao
ORDER BY nome;

-- Mostrar estrutura de uma permissão
SELECT 
  nome,
  permissoes_json
FROM public.perfis_permissao
WHERE nome = 'Administrador';

