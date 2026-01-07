-- ============================================================================
-- ATUALIZAR VALORES DAS ATIVIDADES
-- Execute este SQL no SQL Editor do Supabase para definir os valores unitários
-- ============================================================================

-- Atualizar valor da atividade SDCLU6020SC (Serviço não efetuado sem acesso)
-- Defina o valor correto de acordo com sua tabela de preços
UPDATE atividades 
SET valor_unitario = 15.00  -- Ajuste este valor conforme necessário
WHERE codigo = 'SDCLU6020SC';

-- Atualizar valor da atividade SDCLU6019SC (Ligação não efetuada técnica)
UPDATE atividades 
SET valor_unitario = 15.00  -- Ajuste este valor conforme necessário
WHERE codigo = 'SDCLU6019SC';

-- Atualizar valores das atividades de instalação (exemplos)
UPDATE atividades SET valor_unitario = 85.00 WHERE codigo = 'SDCLU6012II'; -- Ramal poli
UPDATE atividades SET valor_unitario = 75.00 WHERE codigo = 'SDCLU6013II'; -- Ramal mono
UPDATE atividades SET valor_unitario = 120.00 WHERE codigo = 'SDCLU6016II'; -- Medidor mono
UPDATE atividades SET valor_unitario = 150.00 WHERE codigo = 'SDCLU6017II'; -- Medidor poli
UPDATE atividades SET valor_unitario = 250.00 WHERE codigo = 'SDCLU6032II'; -- Poste aux 7m

-- ============================================================================
-- VERIFICAR ATIVIDADES SEM VALOR
-- ============================================================================
-- Execute esta query para ver quais atividades estão sem valor definido:

-- SELECT codigo, descricao, valor_unitario 
-- FROM atividades 
-- WHERE valor_unitario = 0 OR valor_unitario IS NULL
-- ORDER BY codigo;

-- ============================================================================
-- VERIFICAR TODAS AS ATIVIDADES COM SEUS VALORES
-- ============================================================================
-- SELECT codigo, descricao, valor_unitario, unidade 
-- FROM atividades 
-- WHERE ativo = true
-- ORDER BY codigo;

-- ============================================================================
-- Após executar este script, os valores devem aparecer corretamente na produção
-- ============================================================================











