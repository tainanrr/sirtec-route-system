-- ==============================================================
-- SCRIPT DE CORREÇÃO DOS RETORNOS DE CAMPO - PARTE 4
-- Tipos: MODIF-DESLIGAR MANUT, MODIF-RELOCAR MEDIDOR, MODIF-SERVICO RAMAL, MODIF-RELIGAR MANUT
-- ==============================================================

-- ==============================================================
-- MODIF-DESLIGAR MANUT
-- ==============================================================
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '95007', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '95012', 'SDCLU6013RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '95019', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96007', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96008', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96010', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_DESLIGAR_MANUT', '96028', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

-- ==============================================================
-- MODIF-RELOCAR MEDIDOR
-- ==============================================================
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95009', 'SDCLU6015SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95010', 'SDCLU6016II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95010', 'SDCLU6016RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95012', 'SDCCU6401DC', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95012', 'SDCCU6401LI', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95012', 'SDCCU6404DC', 'opcional_nao_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95014', 'SDCLU6013II', 'opcional_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95014', 'SDCLU6013RD', 'opcional_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95014', 'SDCLU6016DC', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95015', 'SDCLU6012RD', 'opcional_nao_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95015', 'SDCLU6017II', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95015', 'SDCLU6016RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95015', 'SDCLU6016II', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95015', 'SDCLU6013RD', 'opcional_nao_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95015', 'SDCLU6013II', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95015', 'SDCLU6012II', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95017', 'SDCLU6015SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95019', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95019', 'SDCLU6012RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95019', 'SDCLU6013RD', 'opcional_nao_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95021', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95021', 'SDCLU6017DC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95021', 'SDCLU6012RD', 'opcional_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95021', 'SDCLU6016RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95022', 'SDCCU6404DC', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95022', 'SDCLU6017II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95022', 'SDCLU6017RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95026', 'SDCLU6017II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '95026', 'SDCLU6017RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96007', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96008', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96010', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96021', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELOCAR_MEDIDOR', '96024', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

-- ==============================================================
-- MODIF-SERVICO RAMAL
-- ==============================================================
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '95012', 'SDCLU6013II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '95012', 'SDCLU6013RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '95019', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '95019', 'SDCLU6012RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96007', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96008', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96010', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_SERVICO_RAMAL', '96024', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

-- ==============================================================
-- MODIF-RELIGAR MANUT
-- ==============================================================
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95007', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95012', 'SDCLU6013II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95013', 'SDCLU6012II', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95013', 'SDCLU6013II', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95013', 'SDCLU6016II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95013', 'SDCLU6016RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95019', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95020', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95020', 'SDCLU6017II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '95020', 'SDCLU6017RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96007', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96008', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96010', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96011', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('MODIF_RELIGAR_MANUT', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

-- Verificação
SELECT 'Parte 4 executada com sucesso' as resultado;

