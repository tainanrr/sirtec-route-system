-- =====================================================
-- EXECUTE ESTE SCRIPT NO SUPABASE DASHBOARD (SQL Editor)
-- Corrige RLS para tabelas de permissões
-- =====================================================

-- 1. Permissões (tabela de permissões do sistema)
DROP POLICY IF EXISTS "permissoes_select" ON public.permissoes;
DROP POLICY IF EXISTS "permissoes_all" ON public.permissoes;
CREATE POLICY "permissoes_select" ON public.permissoes FOR SELECT TO anon, authenticated USING (true);

-- 2. Perfis de Permissão
DROP POLICY IF EXISTS "perfis_permissao_select" ON public.perfis_permissao;
DROP POLICY IF EXISTS "perfis_permissao_all" ON public.perfis_permissao;
CREATE POLICY "perfis_permissao_select" ON public.perfis_permissao FOR SELECT TO anon, authenticated USING (true);

-- 3. Vínculo Perfil-Permissões (CRUCIAL para carregar permissões do usuário)
DROP POLICY IF EXISTS "perfil_permissoes_select" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "perfil_permissoes_all" ON public.perfil_permissoes;
CREATE POLICY "perfil_permissoes_select" ON public.perfil_permissoes FOR SELECT TO anon, authenticated USING (true);

-- 4. Usuário Permissões (permissões específicas do usuário)
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuario_permissoes') THEN
  EXECUTE 'DROP POLICY IF EXISTS "usuario_permissoes_select" ON public.usuario_permissoes';
  EXECUTE 'DROP POLICY IF EXISTS "usuario_permissoes_all" ON public.usuario_permissoes';
  EXECUTE 'CREATE POLICY "usuario_permissoes_select" ON public.usuario_permissoes FOR SELECT TO anon, authenticated USING (true)';
END IF;
END $$;

-- Verificar
SELECT 'RLS de permissões configurado!' as status;

-- Testar se consegue ler as permissões
SELECT COUNT(*) as total_permissoes FROM public.permissoes;
SELECT COUNT(*) as total_perfis FROM public.perfis_permissao;
SELECT COUNT(*) as total_vinculados FROM public.perfil_permissoes;

-- Ver permissões do Visualizador
SELECT 
  pp.nome as perfil,
  p.codigo,
  p.modulo
FROM public.perfil_permissoes pfp
JOIN public.perfis_permissao pp ON pp.id = pfp.perfil_id
JOIN public.permissoes p ON p.id = pfp.permissao_id
WHERE pp.nome = 'Visualizador';

