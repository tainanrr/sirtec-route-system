-- =============================================================================
-- Script para corrigir foreign key da tabela turno_colaboradores
-- Permite excluir colaboradores mesmo que tenham registros em turnos
-- Execute no Supabase Dashboard -> SQL Editor
-- =============================================================================

-- Remover a constraint antiga
ALTER TABLE public.turno_colaboradores 
DROP CONSTRAINT IF EXISTS turno_colaboradores_colaborador_id_fkey;

-- Recriar com ON DELETE CASCADE
ALTER TABLE public.turno_colaboradores 
ADD CONSTRAINT turno_colaboradores_colaborador_id_fkey 
FOREIGN KEY (colaborador_id) 
REFERENCES public.colaboradores(id) 
ON DELETE CASCADE;

-- Verificar se a constraint foi criada corretamente
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'turno_colaboradores'
    AND kcu.column_name = 'colaborador_id';
