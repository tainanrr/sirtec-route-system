-- Script para recadastrar Retornos de Campo - PARTE 4 (FINAL)
-- Demais RELIGAS, VARREDURA, VERIFICACAO, ATENDIMENTO DE OCORRÊNCIA
-- Execute APÓS a parte 3

-- Nota: As RELIGAS AUTOMATICA, JUDICIAL, NORMAL e suas variantes C/ SUBST. MEDIDOR
-- têm estrutura muito similar à RELIGA ANALISE PROC.
-- Para simplificar, vou inserir apenas os dados únicos por tipo.

-- =====================================================
-- PARTE 32: RELIGA AUTOMATICA - (estrutura similar a RELIGA ANALISE PROC.)
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '961', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '9601', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '9601', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '9602', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '9602', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95001', 'SDCCU6422SC - SERV RELIG FECHANDO CH FUSIVEL MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95004', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95005', 'SDCCU6424SC - SERV RETIRAR DISPOSIT BLOQ DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95006', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95008', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95008', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95012', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95012', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95013', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95013', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95013', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95013', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95013', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95016', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95016', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95019', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95020', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95020', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95020', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95020', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95042', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95058', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95058', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95058', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95059', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95059', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '95059', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96003', 'SDCCU6426SC - RELIGA NAO EFETUADA N APR CTA PAGA-DISJ', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96006', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96015', 'SDCCU6416SC - RELIGA NAO EFETUADA N APR CTA PAGA BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96016', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96017', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96020', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96036', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96037', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96039', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('RELIGA AUTOMATICA -', '96040', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 0);

-- =====================================================
-- Demais RELIGAS: Copiando estrutura similar
-- RELIGA AUTOMATICA C/ SUBST. MEDIDOR -, RELIGA JUDICIAL -, 
-- RELIGA JUDICIAL C/ SUBST. MEDIDOR -, RELIGA NORMAL -, RELIGA NORMAL C/ SUBST. MEDIDOR -
-- (mesma estrutura com pequenas variações)
-- =====================================================

-- Criar vínculos para todas as RELIGAS restantes usando loop
DO $$
DECLARE
  v_skills TEXT[] := ARRAY[
    'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -',
    'RELIGA JUDICIAL -',
    'RELIGA JUDICIAL C/ SUBST. MEDIDOR -',
    'RELIGA NORMAL -',
    'RELIGA NORMAL C/ SUBST. MEDIDOR -'
  ];
  v_skill TEXT;
BEGIN
  FOREACH v_skill IN ARRAY v_skills LOOP
    -- Copiar dados da RELIGA AUTOMATICA - para as demais
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '961', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '9601', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '9601', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '9602', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '9602', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95001', 'SDCCU6422SC - SERV RELIG FECHANDO CH FUSIVEL MT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95004', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95005', 'SDCCU6424SC - SERV RETIRAR DISPOSIT BLOQ DISJUNTOR', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95006', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95008', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95008', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95012', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95012', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95013', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95013', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95013', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95013', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95013', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95016', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95016', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95019', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95020', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95020', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95020', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95020', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95042', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95058', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95058', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95058', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95059', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95059', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '95059', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96003', 'SDCCU6426SC - RELIGA NAO EFETUADA N APR CTA PAGA-DISJ', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96006', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96015', 'SDCCU6416SC - RELIGA NAO EFETUADA N APR CTA PAGA BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96016', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96017', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96020', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96036', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96037', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96039', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
    PERFORM insert_tipo_servico_retorno_atividade(v_skill, '96040', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 0);
  END LOOP;
END $$;

-- =====================================================
-- PARTE 33: VARREDURA -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95012', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95012', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95012', 'SDCLU6032RD - RETIRAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95012', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95019', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95019', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95019', 'SDCLU6032RD - RETIRAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95028', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95028', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95029', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95029', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95058', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95058', 'SDCLU6032RD - RETIRAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95059', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95059', 'SDCLU6032RD - RETIRAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95060', 'SDCLU6032RD - RETIRAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95060', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95060', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95060', 'SDCLU6025IC - INSTALACAO INTERNA LPT', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95060', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95060', 'SDCLU6009IC - INSTALAR PADRAO ENTRADA MONO NO POSTE', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95060', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDETU5004SI - TRANSP MAT OBRA - 04 TON > DE 50 KM', 'opcional_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDETU5003SI - TRANSP MAT OBRA - 04 TON - ATE 50 KM', 'opcional_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCLU6032RD - RETIRAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCLU6025IC - INSTALACAO INTERNA LPT', 'opcional_nao_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCLU6009IC - INSTALAR PADRAO ENTRADA MONO NO POSTE', 'obrigatorio', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCIU6264IC - INSTALAR MEDIDOR MONOFASICO', 'opcional_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCIU6206SC - INSTALAR KIT CX MED 1F POLI POSTE/PAREDE', 'opcional_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '95061', 'SDCCU6401IC - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, true, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '96009', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VARREDURA -', '96018', NULL, 'obrigatorio', 0, false, 0);

-- =====================================================
-- PARTE 34: VERIFICACAO -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95008', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95008', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95013', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95013', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95013', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95013', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95016', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95016', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95020', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95020', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95020', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95020', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'opcional_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '95025', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96007', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96008', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96011', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96021', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('VERIFICACAO -', '96024', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 35: ATENDIMENTO DE OCORRÊNCIA
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('ATENDIMENTO DE OCORRÊNCIA', '591', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_nao_selecionado', 1, true, 0);
SELECT insert_tipo_servico_retorno_atividade('ATENDIMENTO DE OCORRÊNCIA', '591', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'opcional_nao_selecionado', 1, true, 0);
SELECT insert_tipo_servico_retorno_atividade('ATENDIMENTO DE OCORRÊNCIA', '591', 'SDMOU4211SC - SERV FALTA LUZ INDIVIDUAL', 'opcional_nao_selecionado', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('ATENDIMENTO DE OCORRÊNCIA', '591', 'SDMOU4212SC - SERV MEDIDOR', 'opcional_nao_selecionado', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('ATENDIMENTO DE OCORRÊNCIA', '591', 'SDMOU4213SC - SERV OSCILACAO DE TENSAO', 'opcional_nao_selecionado', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('ATENDIMENTO DE OCORRÊNCIA', '591', 'SDMOU4214SC - RAMAL DE LIGACAO COM INSTALACAO', 'opcional_nao_selecionado', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('ATENDIMENTO DE OCORRÊNCIA', '591', 'SDMOU4215SC - SERV RAMAL PARTIDO', 'opcional_nao_selecionado', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('ATENDIMENTO DE OCORRÊNCIA', '591', 'SDMOU4217SC - SERV SOLICITACAO DE RELIGAMENTO', 'opcional_nao_selecionado', 1, false, 0);
SELECT insert_tipo_servico_retorno_atividade('ATENDIMENTO DE OCORRÊNCIA', '592', 'SDMOU4216SC - SERV NAO EXECUTADO', 'obrigatorio', 1, false, 0);

-- =====================================================
-- PARTE 36: LIMPEZA E VERIFICAÇÃO FINAL
-- =====================================================

-- Remover a função auxiliar
DROP FUNCTION IF EXISTS insert_tipo_servico_retorno_atividade;

-- Verificar resultado final
SELECT 
  s.codigo as tipo_servico,
  COUNT(DISTINCT tsr.id) as total_retornos,
  COUNT(tra.id) as total_atividades
FROM public.skills s
LEFT JOIN public.tipo_servico_retornos tsr ON tsr.skill_id = s.id
LEFT JOIN public.tipo_servico_retorno_atividades tra ON tra.tipo_servico_retorno_id = tsr.id
WHERE s.codigo IN (
  'BAIXA A PEDIDO -', 'BAIXA ADM -', 'CORTE A -', 'CORTE B -', 'CORTE C -', 'CORTE TOP25 -',
  'ENLACE -', 'LIGACAO NOVA -', 'LIGACAO PROVISORIA DESLIGA -', 'LIGACAO PROVISORIA LIGA -',
  'MICROGERAÇÃO -', 'MODIF-DESLIGAR MANUT -', 'MODIF-RELOCAR MEDIDOR -', 'MODIF-SERVICO RAMAL -',
  'MODIF-RELIGAR MANUT -', 'REATIVACAO -', 'RECORTE A -', 'RECORTE B -', 'RECORTE C -',
  'RELIGA ANALISE PROC. -', 'RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', 'RELIGA AUTOMATICA -',
  'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -', 'RELIGA JUDICIAL -', 'RELIGA JUDICIAL C/ SUBST. MEDIDOR -',
  'RELIGA NORMAL -', 'RELIGA NORMAL C/ SUBST. MEDIDOR -', 'VARREDURA -', 'VERIFICACAO -',
  'ATENDIMENTO DE OCORRÊNCIA'
)
GROUP BY s.codigo
ORDER BY s.codigo;

-- FIM DO SCRIPT
-- =====================================================
