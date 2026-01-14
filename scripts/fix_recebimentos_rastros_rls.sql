-- =============================================================================
-- Script para corrigir permissões da tabela materiais_recebimentos_itens_rastros
-- Execute no Supabase Dashboard -> SQL Editor
-- =============================================================================

-- Garantir que RLS está habilitado
ALTER TABLE public.materiais_recebimentos_itens_rastros ENABLE ROW LEVEL SECURITY;

-- Remover policies existentes para recriar
DROP POLICY IF EXISTS "Authenticated users can view materiais_recebimentos_itens_rastros" ON public.materiais_recebimentos_itens_rastros;
DROP POLICY IF EXISTS "Authenticated users can manage materiais_recebimentos_itens_rastros" ON public.materiais_recebimentos_itens_rastros;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.materiais_recebimentos_itens_rastros;
DROP POLICY IF EXISTS "Allow all for anon" ON public.materiais_recebimentos_itens_rastros;

-- Criar policy para SELECT (todos autenticados podem ver)
CREATE POLICY "Authenticated users can view materiais_recebimentos_itens_rastros"
ON public.materiais_recebimentos_itens_rastros FOR SELECT
TO authenticated
USING (true);

-- Criar policy para INSERT/UPDATE/DELETE (todos autenticados podem gerenciar)
CREATE POLICY "Authenticated users can manage materiais_recebimentos_itens_rastros"
ON public.materiais_recebimentos_itens_rastros FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy para anon (caso necessário)
CREATE POLICY "Allow all for anon"
ON public.materiais_recebimentos_itens_rastros FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Verificar se as policies foram criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'materiais_recebimentos_itens_rastros';
