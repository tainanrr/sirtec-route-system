-- ==============================================================
-- SCRIPT DE CORREÇÃO DOS RETORNOS DE CAMPO - PARTE 3
-- Tipos: ENLACE, LIGACAO NOVA, LIGACAO PROVISORIA (LIGA/DESLIGA), MICROGERACAO
-- ==============================================================

-- ==============================================================
-- ENLACE -
-- ==============================================================
SELECT atualizar_retorno_atividade('ENLACE -', '95011', 'SDCLU6016II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ENLACE -', '95011', 'SDCLU6016RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ENLACE -', '95018', 'SDCLU6017II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ENLACE -', '95018', 'SDCLU6017RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ENLACE -', '96004', 'SDCCU6419SC', 'obrigatorio', 1, false, 3);

-- ==============================================================
-- LIGACAO NOVA -
-- ==============================================================
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95012', 'SDCLU6012II', 'opcional_nao_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95012', 'SDCLU6013II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95012', 'SDCLU6016II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95012', 'SDCLU6032II', 'opcional_nao_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95019', 'SDCLU6012II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95019', 'SDCLU6017II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95019', 'SDCLU6032II', 'opcional_nao_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95028', 'SDCLU6012II', 'opcional_nao_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95028', 'SDCLU6013II', 'opcional_nao_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95028', 'SDCLU6016II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95028', 'SDCLU6032II', 'opcional_nao_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95029', 'SDCLU6017II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95029', 'SDCLU6032II', 'opcional_nao_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '95029', 'SDCLU6012II', 'opcional_nao_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96004', 'SDCLU6019SC', 'obrigatorio', 1, false, 3);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96005', 'SDCLU6020SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96007', 'SDCLU6020SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96017', 'SDCLU6020SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96018', 'SDCLU6020SC', 'obrigatorio', 1, false, 3);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96021', 'SDCLU6020SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96029', 'SDCLU6020SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96030', 'SDCLU6020SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96031', 'SDCLU6020SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('LIGACAO NOVA -', '96032', 'SDCLU6020SC', 'obrigatorio', 1, false, 1);

-- ==============================================================
-- LIGACAO PROVISORIA DESLIGA -
-- ==============================================================
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95013', 'SDCLU6013II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95013', 'SDCLU6016II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95020', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95020', 'SDCLU6017II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95039', 'SDCLU6013RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95039', 'SDCLU6016RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95040', 'SDCLU6012RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95040', 'SDCLU6017RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96007', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96017', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96021', 'SDCLU6020SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96028', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96029', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);

-- ==============================================================
-- LIGACAO PROVISORIA LIGA -
-- ==============================================================
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95013', 'SDCLU6013II', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95013', 'SDCLU6016II', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95020', 'SDCLU6012II', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95020', 'SDCLU6017II', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95039', 'SDCLU6013RD', 'opcional_selecionado', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95039', 'SDCLU6016RD', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95040', 'SDCLU6012RD', 'opcional_selecionado', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95040', 'SDCLU6017RD', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96007', 'SDCLU6020SC', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96017', 'SDCLU6020SC', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96021', 'SDCLU6020SC', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96028', 'SDCLU6020SC', 'obrigatorio', 1, true, 0);
SELECT atualizar_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96029', 'SDCLU6020SC', 'obrigatorio', 1, true, 0);

-- ==============================================================
-- MICROGERACAO -
-- ==============================================================
SELECT atualizar_retorno_atividade('MICROGERACAO -', '95008', 'SDCLU6016RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '95008', 'SDCLU6033II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '95016', 'SDCLU6017RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '95016', 'SDCLU6034II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '95025', 'SDCCU6420SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96005', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96007', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96008', 'SDCCU6420SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96009', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MICROGERACAO -', '96024', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

SELECT 'Parte 3 executada com sucesso' as resultado;
