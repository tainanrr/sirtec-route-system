-- =====================================================
-- EXECUTE ESTE SCRIPT NO SUPABASE DASHBOARD (SQL Editor)
-- Configura permissões para o perfil "Visualizador"
-- =====================================================

-- Primeiro, garantir que as permissões existam
INSERT INTO public.permissoes (codigo, nome, modulo, tipo) VALUES
-- Dashboard (todos podem ver)
('dashboard.visualizar', 'Visualizar Dashboard', 'dashboard', 'tela'),
-- Visualização básica de OS
('os.visualizar', 'Visualizar Ordens de Serviço', 'os', 'tela'),
('os.checklists', 'Visualizar Checklists', 'os', 'tela'),
-- Roteirização (apenas visualização)
('roteirizacao.visualizar', 'Visualizar Roteirizações', 'roteirizacao', 'tela'),
('roteirizacao.acompanhar', 'Acompanhar Roteirizações', 'roteirizacao', 'tela'),
-- Cadastros (apenas visualização)
('cadastros.visualizar', 'Visualizar Cadastros', 'cadastros', 'tela'),
('cadastros.equipes', 'Visualizar Equipes', 'cadastros', 'tela')
ON CONFLICT (codigo) DO NOTHING;

-- Limpar permissões antigas do perfil Visualizador
DELETE FROM public.perfil_permissoes 
WHERE perfil_id = (SELECT id FROM public.perfis_permissao WHERE nome = 'Visualizador');

-- Inserir permissões do Visualizador (apenas visualização)
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
  'cadastros.visualizar',
  'cadastros.equipes'
);

-- Configurar permissões para o perfil "Gestor" (mais acesso)
DELETE FROM public.perfil_permissoes 
WHERE perfil_id = (SELECT id FROM public.perfis_permissao WHERE nome = 'Gestor');

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT 
  (SELECT id FROM public.perfis_permissao WHERE nome = 'Gestor'),
  id
FROM public.permissoes
WHERE modulo IN ('dashboard', 'roteirizacao', 'os', 'cadastros', 'materiais');

-- Configurar permissões para o perfil "Operador" (acesso básico)
DELETE FROM public.perfil_permissoes 
WHERE perfil_id = (SELECT id FROM public.perfis_permissao WHERE nome = 'Operador');

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT 
  (SELECT id FROM public.perfis_permissao WHERE nome = 'Operador'),
  id
FROM public.permissoes
WHERE modulo IN ('dashboard', 'roteirizacao', 'os');

-- Verificar configuração
SELECT 'Permissões configuradas!' as status;

SELECT 
  pp.nome as perfil,
  pp.is_admin,
  COUNT(pfp.id) as total_permissoes
FROM public.perfis_permissao pp
LEFT JOIN public.perfil_permissoes pfp ON pfp.perfil_id = pp.id
GROUP BY pp.id, pp.nome, pp.is_admin
ORDER BY pp.nome;

-- Ver permissões do Visualizador
SELECT 
  'Visualizador' as perfil,
  p.codigo,
  p.nome,
  p.modulo
FROM public.perfil_permissoes pfp
JOIN public.permissoes p ON p.id = pfp.permissao_id
WHERE pfp.perfil_id = (SELECT id FROM public.perfis_permissao WHERE nome = 'Visualizador');

