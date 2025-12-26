-- ============================================================================
-- CORREÇÃO DAS FOREIGN KEYS DO SISTEMA DE PLANEJAMENTO
-- Remover foreign keys problemáticas - campos ficam como UUID sem restrição
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================================

-- 1. Remover TODAS as foreign keys de created_by e canceled_by
ALTER TABLE public.planejamentos 
DROP CONSTRAINT IF EXISTS planejamentos_created_by_fkey;

ALTER TABLE public.planejamentos 
DROP CONSTRAINT IF EXISTS planejamentos_canceled_by_fkey;

ALTER TABLE public.planejamento_logs 
DROP CONSTRAINT IF EXISTS planejamento_logs_created_by_fkey;

-- 2. Garantir que os campos existem e são do tipo correto (sem foreign key)
-- Não adicionar novas foreign keys - campos ficam livres para receber qualquer UUID

-- 3. Confirmar alterações
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Foreign keys removidas com sucesso!';
  RAISE NOTICE 'Os campos created_by e canceled_by agora são UUIDs livres';
  RAISE NOTICE 'sem restrição de foreign key.';
  RAISE NOTICE '==============================================';
END $$;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
