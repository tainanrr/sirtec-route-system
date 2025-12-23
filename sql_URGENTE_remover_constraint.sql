-- ============================================================================
-- EXECUTE ESTE SQL NO SUPABASE AGORA!
-- ============================================================================

-- Primeiro, vamos ver todas as constraints da tabela ordens_servico
SELECT 
    conname as constraint_name,
    contype as type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.ordens_servico'::regclass;

-- Agora vamos remover TODAS as constraints relacionadas ao campo "numero"
-- Execute cada linha separadamente se der erro

-- Opção 1: Nome padrão
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_numero_key;

-- Opção 2: Outro nome comum
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_numero_unique;

-- Opção 3: Nome com underscore
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS unique_numero;

-- Opção 4: Índice único (não constraint)
DROP INDEX IF EXISTS ordens_servico_numero_key;
DROP INDEX IF EXISTS ordens_servico_numero_idx;
DROP INDEX IF EXISTS idx_ordens_servico_numero;

-- ============================================================================
-- SE NENHUMA DAS OPÇÕES ACIMA FUNCIONAR, USE ESTE COMANDO PARA FORÇAR:
-- ============================================================================

-- Este comando lista o nome exato da constraint unique no campo numero:
SELECT conname 
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.conrelid = 'public.ordens_servico'::regclass 
  AND a.attname = 'numero'
  AND c.contype = 'u';

-- Depois de encontrar o nome, execute:
-- ALTER TABLE public.ordens_servico DROP CONSTRAINT "NOME_ENCONTRADO";
