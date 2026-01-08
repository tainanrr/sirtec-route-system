-- ==============================================================
-- SCRIPT DE CORREÇÃO DOS RETORNOS DE CAMPO - PARTE 5
-- Tipos: REATIVACAO, RECORTE A, RECORTE B, RECORTE C
-- ==============================================================

-- ==============================================================
-- REATIVACAO
-- ==============================================================
SELECT atualizar_retorno_atividade('REATIVACAO', '95012', 'SDCLU6013II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '95012', 'SDCLU6016II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '95019', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '95019', 'SDCLU6017II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '95027', 'SDCLU6020SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '95028', 'SDCLU6012II', 'opcional_nao_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '95028', 'SDCLU6016II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '95029', 'SDCLU6012II', 'opcional_nao_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '95029', 'SDCLU6017II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '96004', 'SDCLU6019SC', 'obrigatorio', 1, false, 3);
SELECT atualizar_retorno_atividade('REATIVACAO', '96007', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('REATIVACAO', '96017', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('REATIVACAO', '96021', 'SDCLU6020SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('REATIVACAO', '96028', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('REATIVACAO', '96029', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('REATIVACAO', '96031', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);

-- ==============================================================
-- RECORTE A
-- ==============================================================
SELECT atualizar_retorno_atividade('RECORTE_A', '9801', 'SDCCU6432SC', 'obrigatorio', 1, false, 0);
SELECT atualizar_retorno_atividade('RECORTE_A', '9801', 'SDCCU6431SC', 'obrigatorio', 1, false, 0);
SELECT atualizar_retorno_atividade('RECORTE_A', '95004', 'SDCCU6409SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '95006', 'SDCCU6408SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '95012', 'SDCLU6013RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '95019', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '95023', 'NDCCU0028SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '95024', 'NDCCU0029SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '95043', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('RECORTE_A', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_A', '96008', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_A', '96010', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_A', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_A', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_A', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_A', '96017', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_A', '96024', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

-- ==============================================================
-- RECORTE B
-- ==============================================================
SELECT atualizar_retorno_atividade('RECORTE_B', '9801', 'SDCCU6432SC', 'obrigatorio', 1, false, 0);
SELECT atualizar_retorno_atividade('RECORTE_B', '9801', 'SDCCU6431SC', 'obrigatorio', 1, false, 0);
SELECT atualizar_retorno_atividade('RECORTE_B', '95004', 'SDCCU6409SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '95006', 'SDCCU6408SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '95012', 'SDCLU6013RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '95019', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '95023', 'NDCCU0028SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '95024', 'NDCCU0029SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '95043', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('RECORTE_B', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_B', '96008', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_B', '96010', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_B', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_B', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_B', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_B', '96017', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_B', '96024', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

-- ==============================================================
-- RECORTE C
-- ==============================================================
SELECT atualizar_retorno_atividade('RECORTE_C', '9801', 'SDCCU6432SC', 'obrigatorio', 1, false, 0);
SELECT atualizar_retorno_atividade('RECORTE_C', '9801', 'SDCCU6431SC', 'obrigatorio', 1, false, 0);
SELECT atualizar_retorno_atividade('RECORTE_C', '95004', 'SDCCU6409SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '95006', 'SDCCU6408SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '95012', 'SDCLU6013RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '95019', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '95023', 'NDCCU0028SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '95024', 'NDCCU0029SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '95043', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('RECORTE_C', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_C', '96008', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_C', '96010', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_C', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('RECORTE_C', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_C', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_C', '96017', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('RECORTE_C', '96024', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

-- Verificação
SELECT 'Parte 5 executada com sucesso' as resultado;


