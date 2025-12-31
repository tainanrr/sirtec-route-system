-- Migration: Cadastro massivo de Retornos de Campo - PARTE 3
-- Data: 31/12/2025

-- LIGACAO PROVISORIA DESLIGA -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('LIGACAO PROVISORIA DESLIGA -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('LIGACAO PROVISORIA DESLIGA -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 1),
('LIGACAO PROVISORIA DESLIGA -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('LIGACAO PROVISORIA DESLIGA -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('LIGACAO PROVISORIA DESLIGA -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('LIGACAO PROVISORIA DESLIGA -', '95039', 'MONO-Poste, Ramal e Medidor-Desliga', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('LIGACAO PROVISORIA DESLIGA -', '95039', 'MONO-Poste, Ramal e Medidor-Desliga', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('LIGACAO PROVISORIA DESLIGA -', '95040', 'POLI-Poste, Ramal e Medidor-Desliga', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('LIGACAO PROVISORIA DESLIGA -', '95040', 'POLI-Poste, Ramal e Medidor-Desliga', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('LIGACAO PROVISORIA DESLIGA -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('LIGACAO PROVISORIA DESLIGA -', '96007', 'Impedimento - Local Fechado', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2),
('LIGACAO PROVISORIA DESLIGA -', '96017', 'Impedimento - Nao Localizado', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2),
('LIGACAO PROVISORIA DESLIGA -', '96021', 'Servico Ja Realizado (Coletar Dados)', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 1),
('LIGACAO PROVISORIA DESLIGA -', '96028', 'Cliente Ausente', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2),
('LIGACAO PROVISORIA DESLIGA -', '96029', 'Cliente Desistiu do Servico', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- LIGACAO PROVISORIA LIGA -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('LIGACAO PROVISORIA LIGA -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('LIGACAO PROVISORIA LIGA -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '95039', 'MONO-Poste, Ramal e Medidor-Desliga', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Opcional (selecionado)', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '95039', 'MONO-Poste, Ramal e Medidor-Desliga', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '95040', 'POLI-Poste, Ramal e Medidor-Desliga', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Opcional (selecionado)', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '95040', 'POLI-Poste, Ramal e Medidor-Desliga', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '96007', 'Impedimento - Local Fechado', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '96017', 'Impedimento - Nao Localizado', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '96021', 'Servico Ja Realizado (Coletar Dados)', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '96028', 'Cliente Ausente', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 0),
('LIGACAO PROVISORIA LIGA -', '96029', 'Cliente Desistiu do Servico', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 0)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- MICROGERAÇÃO -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('MICROGERAÇÃO -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('MICROGERAÇÃO -', '95000', 'Visitado - Liberado para execução', NULL, 'Obrigatorio', 0, false, 1),
('MICROGERAÇÃO -', '95008', 'MONO-Caixa e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('MICROGERAÇÃO -', '95008', 'MONO-Caixa e Medidor', 'SDCLU6033II - INSTALAR MEDIDOR BIDIRECIONAL MONOFASICO', 'Obrigatorio', 1, false, 1),
('MICROGERAÇÃO -', '95016', 'POLI-Caixa e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('MICROGERAÇÃO -', '95016', 'POLI-Caixa e Medidor', 'SDCLU6034II - INSTALAR MEDIDOR BIDIRECIONAL POLIFASICO', 'Obrigatorio', 1, false, 1),
('MICROGERAÇÃO -', '95025', 'Visita Tecnica-Equipamento Normal', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 1),
('MICROGERAÇÃO -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('MICROGERAÇÃO -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('MICROGERAÇÃO -', '96007', 'Impedimento - Local Fechado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('MICROGERAÇÃO -', '96008', 'Impedimento - Aparelhagem Medica', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 1),
('MICROGERAÇÃO -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('MICROGERAÇÃO -', '96011', 'Impedimento - Liminar Judicial', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MICROGERAÇÃO -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MICROGERAÇÃO -', '96013', 'Impedimento - Ligado com Outro Medidor', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MICROGERAÇÃO -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MICROGERAÇÃO -', '96021', 'Servico Ja Realizado (Coletar Dados)', NULL, 'Obrigatorio', 0, false, 1),
('MICROGERAÇÃO -', '96024', 'Impedimento - Imovel Demolido', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- MODIF-DESLIGAR MANUT -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('MODIF-DESLIGAR MANUT -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('MODIF-DESLIGAR MANUT -', '95007', 'Demolido', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-DESLIGAR MANUT -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-DESLIGAR MANUT -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('MODIF-DESLIGAR MANUT -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('MODIF-DESLIGAR MANUT -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-DESLIGAR MANUT -', '96007', 'Impedimento - Local Fechado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-DESLIGAR MANUT -', '96008', 'Impedimento - Aparelhagem Medica', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-DESLIGAR MANUT -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-DESLIGAR MANUT -', '96010', 'Impedimento - Empresa', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-DESLIGAR MANUT -', '96011', 'Impedimento - Liminar Judicial', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-DESLIGAR MANUT -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-DESLIGAR MANUT -', '96013', 'Impedimento - Ligado com Outro Medidor', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-DESLIGAR MANUT -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-DESLIGAR MANUT -', '96021', 'Servico Ja Realizado (Coletar Dados)', NULL, 'Obrigatorio', 0, false, 1),
('MODIF-DESLIGAR MANUT -', '96028', 'Cliente Ausente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- MODIF-SERVICO RAMAL -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('MODIF-SERVICO RAMAL -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('MODIF-SERVICO RAMAL -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-SERVICO RAMAL -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('MODIF-SERVICO RAMAL -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('MODIF-SERVICO RAMAL -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('MODIF-SERVICO RAMAL -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('MODIF-SERVICO RAMAL -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-SERVICO RAMAL -', '96007', 'Impedimento - Local Fechado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-SERVICO RAMAL -', '96008', 'Impedimento - Aparelhagem Medica', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-SERVICO RAMAL -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-SERVICO RAMAL -', '96010', 'Impedimento - Empresa', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-SERVICO RAMAL -', '96011', 'Impedimento - Liminar Judicial', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-SERVICO RAMAL -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-SERVICO RAMAL -', '96013', 'Impedimento - Ligado com Outro Medidor', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-SERVICO RAMAL -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-SERVICO RAMAL -', '96021', 'Servico Ja Realizado (Coletar Dados)', NULL, 'Obrigatorio', 0, false, 1),
('MODIF-SERVICO RAMAL -', '96024', 'Impedimento - Imovel Demolido', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- MODIF-RELIGAR MANUT -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('MODIF-RELIGAR MANUT -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('MODIF-RELIGAR MANUT -', '95007', 'Demolido', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELIGAR MANUT -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELIGAR MANUT -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('MODIF-RELIGAR MANUT -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('MODIF-RELIGAR MANUT -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELIGAR MANUT -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('MODIF-RELIGAR MANUT -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELIGAR MANUT -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELIGAR MANUT -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELIGAR MANUT -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('MODIF-RELIGAR MANUT -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('MODIF-RELIGAR MANUT -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELIGAR MANUT -', '96007', 'Impedimento - Local Fechado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELIGAR MANUT -', '96008', 'Impedimento - Aparelhagem Medica', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELIGAR MANUT -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELIGAR MANUT -', '96010', 'Impedimento - Empresa', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELIGAR MANUT -', '96011', 'Impedimento - Liminar Judicial', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELIGAR MANUT -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELIGAR MANUT -', '96013', 'Impedimento - Ligado com Outro Medidor', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELIGAR MANUT -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELIGAR MANUT -', '96021', 'Servico Ja Realizado (Coletar Dados)', NULL, 'Obrigatorio', 0, false, 1)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- REATIVACAO -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('REATIVACAO -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('REATIVACAO -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, false, 1),
('REATIVACAO -', '95012', 'MONO-Poste e Ramal', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('REATIVACAO -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('REATIVACAO -', '95019', 'POLI-Poste e Ramal', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('REATIVACAO -', '95027', 'Levantamento de Dados', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 1),
('REATIVACAO -', '95028', 'MONO-Multiplas UCs', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Opcional (nao selecionado)', 1, true, 1),
('REATIVACAO -', '95028', 'MONO-Multiplas UCs', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('REATIVACAO -', '95029', 'POLI-Multiplas UCs', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Opcional (nao selecionado)', 1, true, 1),
('REATIVACAO -', '95029', 'POLI-Multiplas UCs', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('REATIVACAO -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'Obrigatorio', 1, false, 3),
('REATIVACAO -', '96007', 'Impedimento - Local Fechado', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2),
('REATIVACAO -', '96017', 'Impedimento - Nao Localizado', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2),
('REATIVACAO -', '96021', 'Servico Ja Realizado (Coletar Dados)', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 1),
('REATIVACAO -', '96028', 'Cliente Ausente', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2),
('REATIVACAO -', '96029', 'Cliente Desistiu do Servico', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2),
('REATIVACAO -', '96031', 'Cadastro Incorreto', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- RECORTE A/B/C (estrutura similar)
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('RECORTE A -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'Obrigatorio', 1, false, 0),
('RECORTE A -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'Obrigatorio', 1, false, 0),
('RECORTE A -', '95004', 'BT-Caixa/Borne', 'SDCCU6409SC - CORTE NO SOLO -BT', 'Obrigatorio', 1, false, 1),
('RECORTE A -', '95006', 'BT-Poste', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, false, 1),
('RECORTE A -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('RECORTE A -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('RECORTE A -', '95023', 'Retirar Desvio de Energia com Ramal', 'NDCCU0028SC - RETIRADA DE DESVIO DE ENERGIA COM RAMAL', 'Obrigatorio', 1, true, 1),
('RECORTE A -', '95024', 'Retirar Desvio de Energia sem Ramal', 'NDCCU0029SC - RETIRADA DE DESVIO DE ENERGIA SEM RAMAL', 'Obrigatorio', 1, true, 1),
('RECORTE A -', '95043', 'Encontrado Cortado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('RECORTE A -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'Obrigatorio', 1, true, 3),
('RECORTE A -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('RECORTE A -', '96008', 'Impedimento - Aparelhagem Medica', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('RECORTE A -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('RECORTE A -', '96010', 'Impedimento - Empresa', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('RECORTE A -', '96011', 'Impedimento - Liminar Judicial', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('RECORTE A -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('RECORTE A -', '96013', 'Impedimento - Ligado com Outro Medidor', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('RECORTE A -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('RECORTE A -', '96017', 'Impedimento - Nao Localizado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('RECORTE A -', '96024', 'Impedimento - Imovel Demolido', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- Copia RECORTE A para RECORTE B e C
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos)
SELECT 'RECORTE B -', retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos
FROM public.skill_retornos WHERE skill_codigo = 'RECORTE A -'
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO NOTHING;

INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos)
SELECT 'RECORTE C -', retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos
FROM public.skill_retornos WHERE skill_codigo = 'RECORTE A -'
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO NOTHING;

-- VARREDURA -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('VARREDURA -', '95012', 'MONO-Poste e Ramal', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95012', 'MONO-Poste e Ramal', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'Opcional (nao selecionado)', 1, true, 1),
('VARREDURA -', '95012', 'MONO-Poste e Ramal', 'SDCLU6032RD - RETIRAR POSTE AUX 7M', 'Opcional (nao selecionado)', 1, true, 1),
('VARREDURA -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95019', 'POLI-Poste e Ramal', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95019', 'POLI-Poste e Ramal', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'Opcional (nao selecionado)', 1, true, 1),
('VARREDURA -', '95019', 'POLI-Poste e Ramal', 'SDCLU6032RD - RETIRAR POSTE AUX 7M', 'Opcional (nao selecionado)', 1, true, 1),
('VARREDURA -', '95028', 'MONO-Multiplas UCs', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95028', 'MONO-Multiplas UCs', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95029', 'POLI-Multiplas UCs', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95029', 'POLI-Multiplas UCs', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95060', 'KIT MONO- Ramal e Medidor', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95060', 'KIT MONO- Ramal e Medidor', 'SDCLU6009IC - INSTALAR PADRAO ENTRADA MONO NO POSTE', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95060', 'KIT MONO- Ramal e Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95061', 'KIT MONO- Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95061', 'KIT MONO- Medidor', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '95061', 'KIT MONO- Medidor', 'SDCLU6009IC - INSTALAR PADRAO ENTRADA MONO NO POSTE', 'Obrigatorio', 1, true, 1),
('VARREDURA -', '96009', 'Impedimento - Cliente', NULL, 'Obrigatorio', 0, false, 2),
('VARREDURA -', '96018', 'Necessario Obra no Local', NULL, 'Obrigatorio', 0, false, 0)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- VERIFICACAO -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('VERIFICACAO -', '95008', 'MONO-Caixa e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, false, 1),
('VERIFICACAO -', '95008', 'MONO-Caixa e Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('VERIFICACAO -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('VERIFICACAO -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('VERIFICACAO -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('VERIFICACAO -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('VERIFICACAO -', '95016', 'POLI-Caixa e Medidor', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('VERIFICACAO -', '95016', 'POLI-Caixa e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, false, 1),
('VERIFICACAO -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('VERIFICACAO -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('VERIFICACAO -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('VERIFICACAO -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('VERIFICACAO -', '95025', 'Visita Tecnica-Equipamento Normal', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('VERIFICACAO -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('VERIFICACAO -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('VERIFICACAO -', '96007', 'Impedimento - Local Fechado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('VERIFICACAO -', '96008', 'Impedimento - Aparelhagem Medica', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('VERIFICACAO -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('VERIFICACAO -', '96011', 'Impedimento - Liminar Judicial', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('VERIFICACAO -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('VERIFICACAO -', '96013', 'Impedimento - Ligado com Outro Medidor', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('VERIFICACAO -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('VERIFICACAO -', '96021', 'Servico Ja Realizado (Coletar Dados)', NULL, 'Obrigatorio', 0, false, 1),
('VERIFICACAO -', '96024', 'Impedimento - Imovel Demolido', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- Continua no próximo arquivo para os tipos RELIGA...

