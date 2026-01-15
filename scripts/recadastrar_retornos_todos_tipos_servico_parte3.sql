-- Script para recadastrar Retornos de Campo - PARTE 3
-- Continuação - RELIGAS, VARREDURA, VERIFICACAO, ATENDIMENTO DE OCORRÊNCIA
-- Execute APÓS a parte 2

-- =====================================================
-- PARTE 24: RELIGA ANALISE PROC. -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '961', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '9601', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '9601', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '9601', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '9602', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '9602', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '9602', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95001', 'SDCCU6422SC - SERV RELIG FECHANDO CH FUSIVEL MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95004', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95005', 'SDCCU6424SC - SERV RETIRAR DISPOSIT BLOQ DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95006', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95008', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95008', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95008', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95012', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95012', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95013', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95013', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95013', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95013', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95013', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95016', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95016', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95016', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95019', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95020', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95020', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95020', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95020', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95042', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95058', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95058', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95058', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95059', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95059', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '95059', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96003', 'SDCCU6426SC - RELIGA NAO EFETUADA N APR CTA PAGA-DISJ', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96006', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96015', 'SDCCU6416SC - RELIGA NAO EFETUADA N APR CTA PAGA BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96016', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96017', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96020', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96036', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96037', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96039', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. -', '96040', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 0);

-- =====================================================
-- PARTE 25-31: Demais RELIGAS (mesma estrutura)
-- Copiar da RELIGA ANALISE PROC. para as variantes:
-- =====================================================

-- RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '961', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '9601', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '9601', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '9601', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '9602', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '9602', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '9602', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95001', 'SDCCU6422SC - SERV RELIG FECHANDO CH FUSIVEL MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95004', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95005', 'SDCCU6424SC - SERV RETIRAR DISPOSIT BLOQ DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95006', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95008', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95008', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95008', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95012', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95012', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95013', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95013', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95013', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95013', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95013', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95016', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95016', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95016', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95019', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95020', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95020', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95020', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95042', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95058', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95058', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95058', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95059', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95059', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '95059', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96003', 'SDCCU6426SC - RELIGA NAO EFETUADA N APR CTA PAGA-DISJ', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96006', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96015', 'SDCCU6416SC - RELIGA NAO EFETUADA N APR CTA PAGA BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96016', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96017', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96020', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96036', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96037', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96039', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', '96040', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 0);

-- Continua na PARTE 4 com as demais RELIGAS...
-- Veja: recadastrar_retornos_todos_tipos_servico_parte4.sql
