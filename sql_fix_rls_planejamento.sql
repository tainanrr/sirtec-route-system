-- ==========================================
-- SQL PARA CORRIGIR RLS DAS TABELAS DE PLANEJAMENTO
-- Execute no SQL Editor do Supabase
-- ==========================================

-- 1. Verificar políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('planejamentos', 'planejamento_ordens', 'planejamento_logs');

-- 2. Desabilitar RLS temporariamente para teste (ou criar políticas permissivas)
-- OPÇÃO A: Desabilitar RLS (mais simples para desenvolvimento)
ALTER TABLE public.planejamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_ordens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_logs DISABLE ROW LEVEL SECURITY;

-- OU

-- OPÇÃO B: Criar políticas permissivas (melhor para produção)
-- Primeiro, habilitar RLS
-- ALTER TABLE public.planejamentos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.planejamento_ordens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.planejamento_logs ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura pública
DROP POLICY IF EXISTS "Permitir leitura de planejamentos" ON public.planejamentos;
CREATE POLICY "Permitir leitura de planejamentos" ON public.planejamentos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de planejamentos" ON public.planejamentos;
CREATE POLICY "Permitir inserção de planejamentos" ON public.planejamentos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de planejamentos" ON public.planejamentos;
CREATE POLICY "Permitir atualização de planejamentos" ON public.planejamentos
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de planejamentos" ON public.planejamentos;
CREATE POLICY "Permitir exclusão de planejamentos" ON public.planejamentos
  FOR DELETE USING (true);

-- Políticas para planejamento_ordens
DROP POLICY IF EXISTS "Permitir leitura de planejamento_ordens" ON public.planejamento_ordens;
CREATE POLICY "Permitir leitura de planejamento_ordens" ON public.planejamento_ordens
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de planejamento_ordens" ON public.planejamento_ordens;
CREATE POLICY "Permitir inserção de planejamento_ordens" ON public.planejamento_ordens
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de planejamento_ordens" ON public.planejamento_ordens;
CREATE POLICY "Permitir atualização de planejamento_ordens" ON public.planejamento_ordens
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de planejamento_ordens" ON public.planejamento_ordens;
CREATE POLICY "Permitir exclusão de planejamento_ordens" ON public.planejamento_ordens
  FOR DELETE USING (true);

-- Políticas para planejamento_logs
DROP POLICY IF EXISTS "Permitir leitura de planejamento_logs" ON public.planejamento_logs;
CREATE POLICY "Permitir leitura de planejamento_logs" ON public.planejamento_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de planejamento_logs" ON public.planejamento_logs;
CREATE POLICY "Permitir inserção de planejamento_logs" ON public.planejamento_logs
  FOR INSERT WITH CHECK (true);

-- 3. Verificar se as políticas foram criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('planejamentos', 'planejamento_ordens', 'planejamento_logs');


-- SQL PARA CORRIGIR RLS DAS TABELAS DE PLANEJAMENTO
-- Execute no SQL Editor do Supabase
-- ==========================================

-- 1. Verificar políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('planejamentos', 'planejamento_ordens', 'planejamento_logs');

-- 2. Desabilitar RLS temporariamente para teste (ou criar políticas permissivas)
-- OPÇÃO A: Desabilitar RLS (mais simples para desenvolvimento)
ALTER TABLE public.planejamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_ordens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_logs DISABLE ROW LEVEL SECURITY;

-- OU

-- OPÇÃO B: Criar políticas permissivas (melhor para produção)
-- Primeiro, habilitar RLS
-- ALTER TABLE public.planejamentos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.planejamento_ordens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.planejamento_logs ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura pública
DROP POLICY IF EXISTS "Permitir leitura de planejamentos" ON public.planejamentos;
CREATE POLICY "Permitir leitura de planejamentos" ON public.planejamentos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de planejamentos" ON public.planejamentos;
CREATE POLICY "Permitir inserção de planejamentos" ON public.planejamentos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de planejamentos" ON public.planejamentos;
CREATE POLICY "Permitir atualização de planejamentos" ON public.planejamentos
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de planejamentos" ON public.planejamentos;
CREATE POLICY "Permitir exclusão de planejamentos" ON public.planejamentos
  FOR DELETE USING (true);

-- Políticas para planejamento_ordens
DROP POLICY IF EXISTS "Permitir leitura de planejamento_ordens" ON public.planejamento_ordens;
CREATE POLICY "Permitir leitura de planejamento_ordens" ON public.planejamento_ordens
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de planejamento_ordens" ON public.planejamento_ordens;
CREATE POLICY "Permitir inserção de planejamento_ordens" ON public.planejamento_ordens
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de planejamento_ordens" ON public.planejamento_ordens;
CREATE POLICY "Permitir atualização de planejamento_ordens" ON public.planejamento_ordens
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de planejamento_ordens" ON public.planejamento_ordens;
CREATE POLICY "Permitir exclusão de planejamento_ordens" ON public.planejamento_ordens
  FOR DELETE USING (true);

-- Políticas para planejamento_logs
DROP POLICY IF EXISTS "Permitir leitura de planejamento_logs" ON public.planejamento_logs;
CREATE POLICY "Permitir leitura de planejamento_logs" ON public.planejamento_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de planejamento_logs" ON public.planejamento_logs;
CREATE POLICY "Permitir inserção de planejamento_logs" ON public.planejamento_logs
  FOR INSERT WITH CHECK (true);

-- 3. Verificar se as políticas foram criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('planejamentos', 'planejamento_ordens', 'planejamento_logs');







