-- Script para recadastrar Retornos de Campo - PARTE 2
-- Continuação do arquivo recadastrar_retornos_todos_tipos_servico.sql
-- Execute APÓS a parte 1

-- =====================================================
-- PARTE 13: INSERIR DADOS - LIGACAO PROVISORIA DESLIGA -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95013', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95013', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95020', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95020', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95039', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95039', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95040', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '95040', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96007', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96017', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96021', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96028', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA DESLIGA -', '96029', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 14: INSERIR DADOS - LIGACAO PROVISORIA LIGA -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95013', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95013', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95020', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95020', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95039', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95039', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95040', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '95040', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96007', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96017', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96021', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96028', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO PROVISORIA LIGA -', '96029', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 0);

-- =====================================================
-- PARTE 15: INSERIR DADOS - MICROGERAÇÃO -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '95000', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '95008', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '95008', 'SDCLU6033II - INSTALAR MEDIDOR BIDIRECIONAL MONOFASICO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '95016', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '95016', 'SDCLU6034II - INSTALAR MEDIDOR BIDIRECIONAL POLIFASICO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '95025', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96008', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96011', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96021', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MICROGERAÇÃO -', '96024', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 16: INSERIR DADOS - MODIF-DESLIGAR MANUT -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '95007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96008', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96010', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96011', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96021', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-DESLIGAR MANUT -', '96028', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 17: INSERIR DADOS - MODIF-RELOCAR MEDIDOR -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95009', 'SDCLU6015SC - DESLOCAR MEDIDOR BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95010', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95010', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95012', 'SDCCU6401DC - DESLOCAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95012', 'SDCCU6401LI - REALOCAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95012', 'SDCCU6404DC - DESLOCAR RAMAL DE LIG POLI-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95014', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95014', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95014', 'SDCLU6016DC - DESLOCAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95015', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95015', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95015', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95015', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95015', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95015', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95015', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95017', 'SDCLU6015SC - DESLOCAR MEDIDOR BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95019', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95021', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95021', 'SDCLU6017DC - DESLOCAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95021', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95021', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95022', 'SDCCU6404DC - DESLOCAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95022', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95022', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95026', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '95026', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96008', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96010', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96011', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96021', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELOCAR MEDIDOR -', '96024', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 18: INSERIR DADOS - MODIF-SERVICO RAMAL -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '95012', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96008', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96010', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96011', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96021', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-SERVICO RAMAL -', '96024', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 19: INSERIR DADOS - MODIF-RELIGAR MANUT -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95012', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95013', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95013', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95013', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95013', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95020', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95020', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '95020', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96008', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96010', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96011', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('MODIF-RELIGAR MANUT -', '96021', NULL, 'obrigatorio', 0, false, 1);

-- =====================================================
-- PARTE 20: INSERIR DADOS - REATIVACAO -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '95012', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '95012', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '95019', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '95027', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '95028', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '95028', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '95029', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '95029', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '96004', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '96007', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '96017', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '96021', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '96028', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '96029', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('REATIVACAO -', '96031', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 21: INSERIR DADOS - RECORTE A -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '9801', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '9801', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '95004', 'SDCCU6409SC - CORTE NO SOLO -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '95006', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '95023', 'NDCCU0028SC - RETIRADA DE DESVIO DE ENERGIA COM RAMAL', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '95024', 'NDCCU0029SC - RETIRADA DE DESVIO DE ENERGIA SEM RAMAL', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '95043', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96008', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96010', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96011', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96017', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE A -', '96024', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 22: INSERIR DADOS - RECORTE B -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '9801', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '9801', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '95004', 'SDCCU6409SC - CORTE NO SOLO -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '95006', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '95023', 'NDCCU0028SC - RETIRADA DE DESVIO DE ENERGIA COM RAMAL', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '95024', 'NDCCU0029SC - RETIRADA DE DESVIO DE ENERGIA SEM RAMAL', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '95043', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96008', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96010', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96011', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96017', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE B -', '96024', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 23: INSERIR DADOS - RECORTE C -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '9801', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '9801', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'obrigatorio', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '95004', 'SDCCU6409SC - CORTE NO SOLO -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '95006', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '95023', 'NDCCU0028SC - RETIRADA DE DESVIO DE ENERGIA COM RAMAL', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '95024', 'NDCCU0029SC - RETIRADA DE DESVIO DE ENERGIA SEM RAMAL', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '95043', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96008', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96010', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96011', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96017', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RECORTE C -', '96024', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);

-- Continua na PARTE 3...
-- Veja: recadastrar_retornos_todos_tipos_servico_parte3.sql
