-- =====================================================
-- EXECUTE ESTE SCRIPT NO SUPABASE DASHBOARD (SQL Editor)
-- Configura TODAS as permissões do sistema corretamente
-- =====================================================

-- 1. LIMPAR E RECRIAR PERMISSÕES BASE
DELETE FROM public.perfil_permissoes;
DELETE FROM public.permissoes;

-- 2. INSERIR TODAS AS PERMISSÕES DO SISTEMA
INSERT INTO public.permissoes (codigo, nome, modulo, tipo) VALUES
-- Dashboard
('dashboard.visualizar', 'Visualizar Dashboard', 'dashboard', 'tela'),

-- Torre de Controle
('roteirizacao.torre_controle', 'Torre de Controle', 'roteirizacao', 'tela'),

-- Roteirização
('roteirizacao.criar', 'Criar Roteirização', 'roteirizacao', 'tela'),
('roteirizacao.acompanhar', 'Acompanhar Roteirizações', 'roteirizacao', 'tela'),
('roteirizacao.visualizar', 'Visualizar Roteirizações', 'roteirizacao', 'tela'),

-- Ordens de Serviço
('os.visualizar', 'Visualizar Ordens de Serviço', 'os', 'tela'),
('os.checklists', 'Consultar Checklists', 'os', 'tela'),
('os.editar', 'Editar Ordens de Serviço', 'os', 'funcao'),

-- Materiais
('materiais.visualizar', 'Visualizar Materiais', 'materiais', 'tela'),
('materiais.movimentar', 'Movimentar Materiais', 'materiais', 'funcao'),
('materiais.recebimentos', 'Recebimentos', 'materiais', 'tela'),
('materiais.devolucoes', 'Devoluções', 'materiais', 'tela'),

-- Cadastros
('cadastros.equipes', 'Cadastro de Equipes', 'cadastros', 'tela'),
('cadastros.skills', 'Cadastro de Skills', 'cadastros', 'tela'),
('cadastros.territorios', 'Cadastro de Territórios', 'cadastros', 'tela'),
('cadastros.coordenadores', 'Cadastro de Coordenadores', 'cadastros', 'tela'),
('cadastros.veiculos', 'Cadastro de Veículos', 'cadastros', 'tela'),
('cadastros.metas', 'Cadastro de Metas', 'cadastros', 'tela'),

-- Admin
('admin.acessar', 'Acessar módulo Admin', 'admin', 'tela'),
('admin.contratos', 'Gerenciar Contratos', 'admin', 'tela'),
('admin.usuarios_web', 'Gerenciar Usuários Web', 'admin', 'tela'),
('admin.usuarios_app', 'Gerenciar Usuários App', 'admin', 'tela'),
('admin.permissoes', 'Gerenciar Permissões', 'admin', 'tela'),
('admin.cadastros_base', 'Cadastros Base', 'admin', 'tela'),
('admin.procedimentos', 'Gerenciar Procedimentos', 'admin', 'tela'),
('admin.checklists', 'Gerenciar Checklists', 'admin', 'tela'),
('admin.logs', 'Visualizar Logs', 'admin', 'tela');

-- 3. CONFIGURAR PERFIL VISUALIZADOR (apenas visualização básica)
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT 
  (SELECT id FROM public.perfis_permissao WHERE nome = 'Visualizador'),
  id
FROM public.permissoes
WHERE codigo IN (
  'dashboard.visualizar',
  'os.visualizar',
  'os.checklists',
  'roteirizacao.visualizar',
  'roteirizacao.acompanhar',
  'cadastros.equipes'
);

-- 4. CONFIGURAR PERFIL OPERADOR (acesso operacional)
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT 
  (SELECT id FROM public.perfis_permissao WHERE nome = 'Operador'),
  id
FROM public.permissoes
WHERE codigo IN (
  'dashboard.visualizar',
  'roteirizacao.torre_controle',
  'roteirizacao.criar',
  'roteirizacao.acompanhar',
  'roteirizacao.visualizar',
  'os.visualizar',
  'os.checklists',
  'os.editar',
  'materiais.visualizar'
);

-- 5. CONFIGURAR PERFIL GESTOR (acesso amplo, menos admin)
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT 
  (SELECT id FROM public.perfis_permissao WHERE nome = 'Gestor'),
  id
FROM public.permissoes
WHERE modulo IN ('dashboard', 'roteirizacao', 'os', 'materiais', 'cadastros');

-- 6. VERIFICAR CONFIGURAÇÃO
SELECT 'Permissões configuradas com sucesso!' as status;

-- Resumo por perfil
SELECT 
  pp.nome as perfil,
  pp.is_admin,
  COUNT(pfp.id) as total_permissoes
FROM public.perfis_permissao pp
LEFT JOIN public.perfil_permissoes pfp ON pfp.perfil_id = pp.id
GROUP BY pp.id, pp.nome, pp.is_admin
ORDER BY pp.nome;

-- Detalhes do Visualizador
SELECT 
  'VISUALIZADOR' as perfil,
  p.codigo,
  p.nome,
  p.modulo
FROM public.perfil_permissoes pfp
JOIN public.permissoes p ON p.id = pfp.permissao_id
WHERE pfp.perfil_id = (SELECT id FROM public.perfis_permissao WHERE nome = 'Visualizador')
ORDER BY p.modulo, p.codigo;

-- Detalhes do Operador
SELECT 
  'OPERADOR' as perfil,
  p.codigo,
  p.nome,
  p.modulo
FROM public.perfil_permissoes pfp
JOIN public.permissoes p ON p.id = pfp.permissao_id
WHERE pfp.perfil_id = (SELECT id FROM public.perfis_permissao WHERE nome = 'Operador')
ORDER BY p.modulo, p.codigo;

-- Detalhes do Gestor
SELECT 
  'GESTOR' as perfil,
  p.codigo,
  p.nome,
  p.modulo
FROM public.perfil_permissoes pfp
JOIN public.permissoes p ON p.id = pfp.permissao_id
WHERE pfp.perfil_id = (SELECT id FROM public.perfis_permissao WHERE nome = 'Gestor')
ORDER BY p.modulo, p.codigo;

