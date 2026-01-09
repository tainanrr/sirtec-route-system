-- ============================================================
-- DIAGNÓSTICO E CORREÇÃO DE VALORES DE PRODUÇÃO
-- Execute este script para identificar e corrigir valores zerados
-- ============================================================

-- 1. Verificar atividades com valor_unitario zerado ou nulo
SELECT 
    id,
    codigo,
    descricao,
    valor_unitario,
    unidade
FROM public.atividades 
WHERE valor_unitario IS NULL OR valor_unitario = 0
ORDER BY codigo;

-- 2. Verificar produção registrada com valores
SELECT 
    pe.id,
    pe.ordem_servico_id,
    pe.retorno_codigo,
    pe.retorno_descricao,
    pe.valor_total as valor_producao,
    pe.data_registro,
    os.numero as numero_os,
    os.status
FROM public.producao_equipes pe
JOIN public.ordens_servico os ON os.id = pe.ordem_servico_id
ORDER BY pe.data_registro DESC
LIMIT 20;

-- 3. Verificar atividades da produção
SELECT 
    pa.id,
    pa.producao_id,
    pa.atividade_codigo,
    pa.atividade_descricao,
    pa.quantidade,
    pa.valor_unitario,
    pa.valor_total,
    pe.ordem_servico_id,
    os.numero as numero_os
FROM public.producao_atividades pa
JOIN public.producao_equipes pe ON pe.id = pa.producao_id
JOIN public.ordens_servico os ON os.id = pe.ordem_servico_id
ORDER BY pa.created_at DESC
LIMIT 20;

-- ============================================================
-- CORREÇÕES
-- ============================================================

-- 4. EXEMPLO: Atualizar valores unitários das atividades
-- DESCOMENTE e ajuste os valores conforme sua tabela de preços
/*
UPDATE public.atividades SET valor_unitario = 50.00 WHERE codigo = 'MONO-POSTE';
UPDATE public.atividades SET valor_unitario = 75.00 WHERE codigo = 'MONO-RAMAL';
UPDATE public.atividades SET valor_unitario = 100.00 WHERE codigo = 'MONO-POSTE-RAMAL';
-- etc...
*/

-- 5. Recalcular valor_total das produções baseado nas atividades
-- (use após atualizar os valores unitários das atividades)
/*
UPDATE public.producao_equipes pe
SET valor_total = (
    SELECT COALESCE(SUM(pa.valor_total), 0)
    FROM public.producao_atividades pa
    WHERE pa.producao_id = pe.id
)
WHERE pe.valor_total = 0 OR pe.valor_total IS NULL;
*/

-- 6. Recalcular valor_total das atividades de produção
-- (use após atualizar os valores unitários das atividades)
/*
UPDATE public.producao_atividades pa
SET 
    valor_unitario = a.valor_unitario,
    valor_total = pa.quantidade * a.valor_unitario
FROM public.atividades a
WHERE pa.atividade_id = a.id
AND (pa.valor_unitario = 0 OR pa.valor_unitario IS NULL);
*/

-- 7. Verificar configuração de atividades nos retornos de campo
SELECT 
    tsr.id as tipo_servico_retorno_id,
    rc.codigo as retorno_codigo,
    rc.descricao as retorno_descricao,
    tsra.id as config_atividade_id,
    a.codigo as atividade_codigo,
    a.descricao as atividade_descricao,
    a.valor_unitario,
    tsra.quantidade_padrao
FROM public.tipo_servico_retornos tsr
JOIN public.retornos_campo rc ON rc.id = tsr.retorno_campo_id
LEFT JOIN public.tipo_servico_retorno_atividades tsra ON tsra.tipo_servico_retorno_id = tsr.id
LEFT JOIN public.atividades a ON a.id = tsra.atividade_id
ORDER BY rc.codigo, a.codigo;

-- 8. Verificar se há OSs concluídas sem registro de produção
SELECT 
    os.id,
    os.numero,
    os.status,
    os.retorno_campo_codigo,
    os.concluido_at,
    pe.id as producao_id,
    pe.valor_total as valor_producao
FROM public.ordens_servico os
LEFT JOIN public.producao_equipes pe ON pe.ordem_servico_id = os.id
WHERE os.status = 'concluida'
AND os.concluido_at >= NOW() - INTERVAL '7 days'
ORDER BY os.concluido_at DESC;













