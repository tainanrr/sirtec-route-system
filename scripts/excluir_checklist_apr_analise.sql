-- Script para excluir o checklist "APR - Análise Preliminar de Riscos"
-- Execute este script no SQL Editor do Supabase
-- ATENÇÃO: Este script exclui APENAS o checklist com nome EXATO "APR - Análise Preliminar de Riscos"
-- NÃO confundir com o checklist chamado apenas "APR"

-- 1. Primeiro, verificar se o checklist existe e qual é o ID dele
SELECT id, nome, ativo, created_at 
FROM public.checklists 
WHERE nome = 'APR - Análise Preliminar de Riscos';

-- 2. Verificar se existem respostas associadas a este checklist
SELECT COUNT(*) as total_respostas
FROM public.checklist_respostas cr
INNER JOIN public.checklists c ON c.id = cr.checklist_id
WHERE c.nome = 'APR - Análise Preliminar de Riscos';

-- 3. Excluir as respostas de checklist associadas (se houver)
DELETE FROM public.checklist_respostas
WHERE checklist_id IN (
    SELECT id FROM public.checklists 
    WHERE nome = 'APR - Análise Preliminar de Riscos'
);

-- 4. Excluir o checklist
DELETE FROM public.checklists 
WHERE nome = 'APR - Análise Preliminar de Riscos';

-- 5. Confirmar que foi excluído
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.checklists WHERE nome = 'APR - Análise Preliminar de Riscos')
        THEN 'ERRO: Checklist ainda existe!'
        ELSE 'SUCESSO: Checklist excluído com sucesso!'
    END as resultado;

-- 6. Listar checklists restantes para confirmar (opcional)
SELECT id, nome, ativo 
FROM public.checklists 
ORDER BY nome;
