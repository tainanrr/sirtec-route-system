-- Migration: Cadastro massivo de Retornos de Campo - PARTE 4 (RELIGIGAS)
-- Data: 31/12/2025

-- Template base para RELIGA (usado para copiar para os demais tipos)
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
-- RELIGA NORMAL -
('RELIGA NORMAL -', '961', 'Não realizado - Necessário Cartucho', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'Obrigatorio', 1, false, 2),
('RELIGA NORMAL -', '9601', 'MONO-Caixa e Ramal', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '9601', 'MONO-Caixa e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '9602', 'POLI-Caixa e Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '9602', 'POLI-Caixa e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95001', 'AT-Chave Fusivel', 'SDCCU6422SC - SERV RELIG FECHANDO CH FUSIVEL MT', 'Obrigatorio', 1, true, 1),
('RELIGA NORMAL -', '95004', 'BT-Caixa/Borne', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95005', 'GAVIAO Disjuntor', 'SDCCU6424SC - SERV RETIRAR DISPOSIT BLOQ DISJUNTOR', 'Obrigatorio', 1, true, 1),
('RELIGA NORMAL -', '95006', 'BT-Poste', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95008', 'MONO-Caixa e Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95008', 'MONO-Caixa e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95012', 'MONO-Poste e Ramal', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 1),
('RELIGA NORMAL -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95016', 'POLI-Caixa e Medidor', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, false, 1),
('RELIGA NORMAL -', '95016', 'POLI-Caixa e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, false, 1),
('RELIGA NORMAL -', '95019', 'POLI-Poste e Ramal', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('RELIGA NORMAL -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95042', 'GAVIAO Encontrado Ja Religado', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95058', 'MONO-Poste e Medidor', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95058', 'MONO-Poste e Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95058', 'MONO-Poste e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '95059', 'POLI-Poste e Medidor', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95059', 'POLI-Poste e Medidor', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '95059', 'POLI-Poste e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('RELIGA NORMAL -', '96003', 'GAVIAO Conta Paga', 'SDCCU6426SC - RELIGA NAO EFETUADA N APR CTA PAGA-DISJ', 'Obrigatorio', 1, false, 3),
('RELIGA NORMAL -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, false, 3),
('RELIGA NORMAL -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('RELIGA NORMAL -', '96006', 'Encontrado Ja Religado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '96007', 'Impedimento - Local Fechado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('RELIGA NORMAL -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('RELIGA NORMAL -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 1),
('RELIGA NORMAL -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('RELIGA NORMAL -', '96015', 'BT-Nao Apresentou Fatura', 'SDCCU6416SC - RELIGA NAO EFETUADA N APR CTA PAGA BT', 'Obrigatorio', 1, false, 3),
('RELIGA NORMAL -', '96016', 'GAVIAO Impedimento - Nao Apresentou Fatura', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, false, 3),
('RELIGA NORMAL -', '96017', 'Impedimento - Nao Localizado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('RELIGA NORMAL -', '96020', 'GAVIAO Sem Acesso ao Padrao', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, false, 2),
('RELIGA NORMAL -', '96036', 'GAVIAO Impedimento - Cliente', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, false, 2),
('RELIGA NORMAL -', '96037', 'GAVIAO Impedimento - Deficiencia Tecnica', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, false, 3),
('RELIGA NORMAL -', '96039', 'GAVIAO Impedimento - Disjuntor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('RELIGA NORMAL -', '96040', 'GAVIAO Impedimento - Dispositivo Nao Encaixa', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, false, 0)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- Copiar RELIGA NORMAL para os demais tipos de RELIGA (estrutura similar)
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos)
SELECT 'RELIGA AUTOMATICA -', retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos
FROM public.skill_retornos WHERE skill_codigo = 'RELIGA NORMAL -'
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO NOTHING;

INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos)
SELECT 'RELIGA JUDICIAL -', retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos
FROM public.skill_retornos WHERE skill_codigo = 'RELIGA NORMAL -'
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO NOTHING;

INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos)
SELECT 'RELIGA ANALISE PROC. -', retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos
FROM public.skill_retornos WHERE skill_codigo = 'RELIGA NORMAL -'
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO NOTHING;

-- Versões com substituição de medidor
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos)
SELECT 'RELIGA NORMAL C/ SUBST. MEDIDOR -', retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos
FROM public.skill_retornos WHERE skill_codigo = 'RELIGA NORMAL -'
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO NOTHING;

INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos)
SELECT 'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -', retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos
FROM public.skill_retornos WHERE skill_codigo = 'RELIGA NORMAL -'
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO NOTHING;

INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos)
SELECT 'RELIGA JUDICIAL C/ SUBST. MEDIDOR -', retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos
FROM public.skill_retornos WHERE skill_codigo = 'RELIGA NORMAL -'
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO NOTHING;

INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos)
SELECT 'RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos
FROM public.skill_retornos WHERE skill_codigo = 'RELIGA NORMAL -'
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO NOTHING;

-- MODIF-RELOCAR MEDIDOR - (estrutura completa devido à complexidade)
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('MODIF-RELOCAR MEDIDOR -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('MODIF-RELOCAR MEDIDOR -', '95009', 'MONO-Caixa e Medidor-Relocar', 'SDCLU6015SC - DESLOCAR MEDIDOR BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '95010', 'MONO-Caixa e Medidor-Trocar', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '95010', 'MONO-Caixa e Medidor-Trocar', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '95017', 'POLI-Caixa e Medidor-Relocar', 'SDCLU6015SC - DESLOCAR MEDIDOR BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '95026', 'POLI-Caixa e Medidor-Trocar', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '95026', 'POLI-Caixa e Medidor-Trocar', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('MODIF-RELOCAR MEDIDOR -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELOCAR MEDIDOR -', '96007', 'Impedimento - Local Fechado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELOCAR MEDIDOR -', '96008', 'Impedimento - Aparelhagem Medica', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELOCAR MEDIDOR -', '96010', 'Impedimento - Empresa', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '96011', 'Impedimento - Liminar Judicial', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELOCAR MEDIDOR -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '96013', 'Impedimento - Ligado com Outro Medidor', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELOCAR MEDIDOR -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('MODIF-RELOCAR MEDIDOR -', '96021', 'Servico Ja Realizado (Coletar Dados)', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('MODIF-RELOCAR MEDIDOR -', '96024', 'Impedimento - Imovel Demolido', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET retorno_descricao = EXCLUDED.retorno_descricao, situacao = EXCLUDED.situacao, qtd_padrao = EXCLUDED.qtd_padrao, alteracao_pda = EXCLUDED.alteracao_pda, qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- Criar índice adicional para performance
CREATE INDEX IF NOT EXISTS idx_skill_retornos_skill_ativo ON public.skill_retornos(skill_codigo) WHERE ativo = true;

