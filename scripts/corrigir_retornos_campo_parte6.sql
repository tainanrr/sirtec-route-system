-- ==============================================================
-- SCRIPT DE CORREÇÃO DOS RETORNOS DE CAMPO - PARTE 6
-- Tipos: VISTORIA TECNICA, VISTORIA INSPECAO
-- ==============================================================

-- ==============================================================
-- VISTORIA TECNICA -
-- ==============================================================
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '9600', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96007', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96008', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96017', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96022', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96023', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96024', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96026', 'SDCCU6420SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('VISTORIA TECNICA -', '96027', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

-- ==============================================================
-- VISTORIA INSPECAO -
-- ==============================================================
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '9600', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96007', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96008', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96017', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96022', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96023', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96024', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96026', 'SDCCU6420SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('VISTORIA INSPECAO -', '96027', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

SELECT 'Parte 6 executada com sucesso' as resultado;

-- ==============================================================
-- LIMPEZA: Remover função temporária (opcional)
-- ==============================================================
-- DROP FUNCTION IF EXISTS atualizar_retorno_atividade;

