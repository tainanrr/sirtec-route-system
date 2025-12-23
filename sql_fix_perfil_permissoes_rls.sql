-- =====================================================
-- EXECUTE ESTE SCRIPT NO SUPABASE DASHBOARD (SQL Editor)
-- Corrige RLS para permitir edição de perfil_permissoes
-- =====================================================

-- 1. Ver políticas atuais
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'perfil_permissoes';

-- 2. Remover políticas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "perfil_permissoes_select" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "perfil_permissoes_all" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "perfil_permissoes_insert" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "perfil_permissoes_delete" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "perfil_permissoes_update" ON public.perfil_permissoes;

-- 3. Criar política que permite TUDO para anon e authenticated
-- (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "perfil_permissoes_all_access" 
ON public.perfil_permissoes 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Verificar se a tabela tem RLS habilitado
ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;

-- 5. Verificar novamente as políticas
SELECT 'Políticas após correção:' as info;
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'perfil_permissoes';

-- 6. Testar se consegue fazer operações
SELECT 'Teste de leitura:' as info;
SELECT COUNT(*) as total FROM public.perfil_permissoes;

-- 7. Também garantir que permissoes e perfis_permissao podem ser lidos
DROP POLICY IF EXISTS "permissoes_all_access" ON public.permissoes;
CREATE POLICY "permissoes_all_access" 
ON public.permissoes 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "perfis_permissao_all_access" ON public.perfis_permissao;
CREATE POLICY "perfis_permissao_all_access" 
ON public.perfis_permissao 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

SELECT 'RLS corrigido com sucesso!' as status;

