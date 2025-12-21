-- Corrigir RLS para checklist_respostas
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar políticas atuais
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'checklist_respostas';

-- 2. Remover políticas antigas
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.checklist_respostas;
DROP POLICY IF EXISTS "Enable insert for authenticated teams" ON public.checklist_respostas;
DROP POLICY IF EXISTS "Enable select for authenticated teams" ON public.checklist_respostas;
DROP POLICY IF EXISTS "Enable update for authenticated teams" ON public.checklist_respostas;
DROP POLICY IF EXISTS "Enable delete for authenticated teams" ON public.checklist_respostas;

-- 3. Criar políticas permissivas para o app mobile
-- Permitir SELECT para todos autenticados
CREATE POLICY "Allow select for authenticated"
ON public.checklist_respostas FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT para todos autenticados
CREATE POLICY "Allow insert for authenticated"
ON public.checklist_respostas FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE para todos autenticados
CREATE POLICY "Allow update for authenticated"
ON public.checklist_respostas FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Permitir DELETE para todos autenticados
CREATE POLICY "Allow delete for authenticated"
ON public.checklist_respostas FOR DELETE
TO authenticated
USING (true);

-- 4. Também permitir para anon (caso o app mobile não esteja autenticado no Supabase Auth)
CREATE POLICY "Allow select for anon"
ON public.checklist_respostas FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow insert for anon"
ON public.checklist_respostas FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow update for anon"
ON public.checklist_respostas FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- 5. Verificar se RLS está habilitado
ALTER TABLE public.checklist_respostas ENABLE ROW LEVEL SECURITY;

-- 6. Verificar novas políticas
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'checklist_respostas';

-- 7. Também corrigir RLS para checklists (leitura)
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.checklists;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.checklists;
DROP POLICY IF EXISTS "Enable read access for anon" ON public.checklists;

CREATE POLICY "Allow select for all"
ON public.checklists FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow insert for authenticated"
ON public.checklists FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow update for authenticated"
ON public.checklists FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated"
ON public.checklists FOR DELETE
TO authenticated
USING (true);

-- 8. Verificar estrutura da tabela checklist_respostas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'checklist_respostas' 
AND table_schema = 'public'
ORDER BY ordinal_position;


-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar políticas atuais
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'checklist_respostas';

-- 2. Remover políticas antigas
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.checklist_respostas;
DROP POLICY IF EXISTS "Enable insert for authenticated teams" ON public.checklist_respostas;
DROP POLICY IF EXISTS "Enable select for authenticated teams" ON public.checklist_respostas;
DROP POLICY IF EXISTS "Enable update for authenticated teams" ON public.checklist_respostas;
DROP POLICY IF EXISTS "Enable delete for authenticated teams" ON public.checklist_respostas;

-- 3. Criar políticas permissivas para o app mobile
-- Permitir SELECT para todos autenticados
CREATE POLICY "Allow select for authenticated"
ON public.checklist_respostas FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT para todos autenticados
CREATE POLICY "Allow insert for authenticated"
ON public.checklist_respostas FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE para todos autenticados
CREATE POLICY "Allow update for authenticated"
ON public.checklist_respostas FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Permitir DELETE para todos autenticados
CREATE POLICY "Allow delete for authenticated"
ON public.checklist_respostas FOR DELETE
TO authenticated
USING (true);

-- 4. Também permitir para anon (caso o app mobile não esteja autenticado no Supabase Auth)
CREATE POLICY "Allow select for anon"
ON public.checklist_respostas FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow insert for anon"
ON public.checklist_respostas FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow update for anon"
ON public.checklist_respostas FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- 5. Verificar se RLS está habilitado
ALTER TABLE public.checklist_respostas ENABLE ROW LEVEL SECURITY;

-- 6. Verificar novas políticas
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'checklist_respostas';

-- 7. Também corrigir RLS para checklists (leitura)
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.checklists;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.checklists;
DROP POLICY IF EXISTS "Enable read access for anon" ON public.checklists;

CREATE POLICY "Allow select for all"
ON public.checklists FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow insert for authenticated"
ON public.checklists FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow update for authenticated"
ON public.checklists FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated"
ON public.checklists FOR DELETE
TO authenticated
USING (true);

-- 8. Verificar estrutura da tabela checklist_respostas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'checklist_respostas' 
AND table_schema = 'public'
ORDER BY ordinal_position;






