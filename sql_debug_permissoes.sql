-- =====================================================
-- SCRIPT DE DEBUG - Execute no Supabase SQL Editor
-- Verifica se as permissões estão configuradas corretamente
-- =====================================================

-- 1. Ver todos os perfis
SELECT '=== PERFIS ===' as secao;
SELECT id, nome, is_admin FROM public.perfis_permissao ORDER BY nome;

-- 2. Ver todas as permissões disponíveis
SELECT '=== PERMISSÕES DISPONÍVEIS ===' as secao;
SELECT id, codigo, nome, modulo FROM public.permissoes ORDER BY modulo, codigo;

-- 3. Ver o que está vinculado em perfil_permissoes
SELECT '=== VÍNCULOS PERFIL-PERMISSÃO ===' as secao;
SELECT 
  pfp.id as vinculo_id,
  pp.nome as perfil,
  pp.id as perfil_id,
  p.codigo as permissao_codigo,
  p.modulo
FROM public.perfil_permissoes pfp
JOIN public.perfis_permissao pp ON pp.id = pfp.perfil_id
JOIN public.permissoes p ON p.id = pfp.permissao_id
ORDER BY pp.nome, p.modulo, p.codigo;

-- 4. Ver especificamente o Visualizador
SELECT '=== PERMISSÕES DO VISUALIZADOR ===' as secao;
SELECT 
  pp.nome as perfil,
  pp.id as perfil_id,
  p.codigo,
  p.nome as permissao_nome,
  p.modulo
FROM public.perfil_permissoes pfp
JOIN public.perfis_permissao pp ON pp.id = pfp.perfil_id
JOIN public.permissoes p ON p.id = pfp.permissao_id
WHERE pp.nome = 'Visualizador'
ORDER BY p.modulo, p.codigo;

-- 5. Contar permissões por perfil
SELECT '=== CONTAGEM POR PERFIL ===' as secao;
SELECT 
  pp.nome as perfil,
  pp.id as perfil_id,
  COUNT(pfp.id) as total_permissoes
FROM public.perfis_permissao pp
LEFT JOIN public.perfil_permissoes pfp ON pfp.perfil_id = pp.id
GROUP BY pp.id, pp.nome
ORDER BY pp.nome;

-- 6. Ver usuários e seus perfis
SELECT '=== USUÁRIOS E SEUS PERFIS ===' as secao;
SELECT 
  uw.nome as usuario,
  uw.email,
  uw.perfil_id,
  pp.nome as perfil_nome,
  pp.is_admin
FROM public.usuarios_web uw
LEFT JOIN public.perfis_permissao pp ON pp.id = uw.perfil_id
ORDER BY uw.nome;

-- 7. Verificar RLS das tabelas de permissões
SELECT '=== POLÍTICAS RLS ===' as secao;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('permissoes', 'perfis_permissao', 'perfil_permissoes')
ORDER BY tablename, policyname;

