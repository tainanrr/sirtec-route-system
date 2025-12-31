-- Migration: Cadastro massivo de Retornos de Campo - PARTE 2
-- Data: 31/12/2025

-- CORTE A -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('CORTE A -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'Obrigatorio', 1, false, 1),
('CORTE A -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'Obrigatorio', 1, false, 1),
('CORTE A -', '95001', 'AT-Chave Fusivel', 'SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'Obrigatorio', 1, false, 1),
('CORTE A -', '95004', 'BT-Caixa/Borne', 'NDCCU0017SC - CORTE NO SOLO-BT', 'Obrigatorio', 1, false, 1),
('CORTE A -', '95005', 'GAVIAO Disjuntor', 'SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'Obrigatorio', 1, false, 1),
('CORTE A -', '95006', 'BT-Poste', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, false, 1),
('CORTE A -', '95012', 'MONO-Poste e Ramal', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, true, 1),
('CORTE A -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('CORTE A -', '95019', 'POLI-Poste e Ramal', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, true, 1),
('CORTE A -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('CORTE A -', '95042', 'GAVIAO Encontrado Ja Religado', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 1),
('CORTE A -', '95043', 'Encontrado Cortado', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 1),
('CORTE A -', '96001', 'AT-Conta Paga', 'SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'Obrigatorio', 1, true, 3),
('CORTE A -', '96002', 'BT-Conta Paga', 'SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'Obrigatorio', 1, true, 3),
('CORTE A -', '96003', 'GAVIAO Conta Paga', 'SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'Obrigatorio', 1, true, 3),
('CORTE A -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'Obrigatorio', 1, true, 3),
('CORTE A -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE A -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE A -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('CORTE A -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE A -', '96020', 'GAVIAO Sem Acesso ao Padrao', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2),
('CORTE A -', '96036', 'GAVIAO Impedimento - Cliente', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2),
('CORTE A -', '96037', 'GAVIAO Impedimento - Deficiencia Tecnica', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 3),
('CORTE A -', '96038', 'GAVIAO Impedimento - Disjuntor Com Cadeado/Grade', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 3),
('CORTE A -', '96039', 'GAVIAO Impedimento - Disjuntor Interno', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET
  retorno_descricao = EXCLUDED.retorno_descricao,
  situacao = EXCLUDED.situacao,
  qtd_padrao = EXCLUDED.qtd_padrao,
  alteracao_pda = EXCLUDED.alteracao_pda,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- CORTE B - (mesma estrutura que CORTE A)
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('CORTE B -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'Obrigatorio', 1, false, 1),
('CORTE B -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'Obrigatorio', 1, false, 1),
('CORTE B -', '95001', 'AT-Chave Fusivel', 'SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'Obrigatorio', 1, false, 1),
('CORTE B -', '95004', 'BT-Caixa/Borne', 'NDCCU0017SC - CORTE NO SOLO-BT', 'Obrigatorio', 1, false, 1),
('CORTE B -', '95005', 'GAVIAO Disjuntor', 'SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'Obrigatorio', 1, false, 1),
('CORTE B -', '95006', 'BT-Poste', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, false, 1),
('CORTE B -', '95012', 'MONO-Poste e Ramal', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, true, 1),
('CORTE B -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('CORTE B -', '95019', 'POLI-Poste e Ramal', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, true, 1),
('CORTE B -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('CORTE B -', '95042', 'GAVIAO Encontrado Ja Religado', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 1),
('CORTE B -', '95043', 'Encontrado Cortado', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 1),
('CORTE B -', '96001', 'AT-Conta Paga', 'SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'Obrigatorio', 1, true, 3),
('CORTE B -', '96002', 'BT-Conta Paga', 'SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'Obrigatorio', 1, true, 3),
('CORTE B -', '96003', 'GAVIAO Conta Paga', 'SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'Obrigatorio', 1, true, 3),
('CORTE B -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'Obrigatorio', 1, true, 3),
('CORTE B -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE B -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE B -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('CORTE B -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE B -', '96020', 'GAVIAO Sem Acesso ao Padrao', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2),
('CORTE B -', '96036', 'GAVIAO Impedimento - Cliente', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2),
('CORTE B -', '96037', 'GAVIAO Impedimento - Deficiencia Tecnica', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 3),
('CORTE B -', '96038', 'GAVIAO Impedimento - Disjuntor Com Cadeado/Grade', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 3),
('CORTE B -', '96039', 'GAVIAO Impedimento - Disjuntor Interno', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET
  retorno_descricao = EXCLUDED.retorno_descricao,
  situacao = EXCLUDED.situacao,
  qtd_padrao = EXCLUDED.qtd_padrao,
  alteracao_pda = EXCLUDED.alteracao_pda,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- CORTE C - (mesma estrutura que CORTE A)
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('CORTE C -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'Obrigatorio', 1, false, 1),
('CORTE C -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'Obrigatorio', 1, false, 1),
('CORTE C -', '95001', 'AT-Chave Fusivel', 'SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'Obrigatorio', 1, false, 1),
('CORTE C -', '95004', 'BT-Caixa/Borne', 'NDCCU0017SC - CORTE NO SOLO-BT', 'Obrigatorio', 1, false, 1),
('CORTE C -', '95005', 'GAVIAO Disjuntor', 'SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'Obrigatorio', 1, false, 1),
('CORTE C -', '95006', 'BT-Poste', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, false, 1),
('CORTE C -', '95012', 'MONO-Poste e Ramal', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, true, 1),
('CORTE C -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('CORTE C -', '95019', 'POLI-Poste e Ramal', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, true, 1),
('CORTE C -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('CORTE C -', '95042', 'GAVIAO Encontrado Ja Religado', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 1),
('CORTE C -', '95043', 'Encontrado Cortado', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 1),
('CORTE C -', '96001', 'AT-Conta Paga', 'SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'Obrigatorio', 1, true, 3),
('CORTE C -', '96002', 'BT-Conta Paga', 'SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'Obrigatorio', 1, true, 3),
('CORTE C -', '96003', 'GAVIAO Conta Paga', 'SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'Obrigatorio', 1, true, 3),
('CORTE C -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'Obrigatorio', 1, true, 3),
('CORTE C -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE C -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE C -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('CORTE C -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE C -', '96020', 'GAVIAO Sem Acesso ao Padrao', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2),
('CORTE C -', '96036', 'GAVIAO Impedimento - Cliente', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2),
('CORTE C -', '96037', 'GAVIAO Impedimento - Deficiencia Tecnica', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 3),
('CORTE C -', '96038', 'GAVIAO Impedimento - Disjuntor Com Cadeado/Grade', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 3),
('CORTE C -', '96039', 'GAVIAO Impedimento - Disjuntor Interno', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET
  retorno_descricao = EXCLUDED.retorno_descricao,
  situacao = EXCLUDED.situacao,
  qtd_padrao = EXCLUDED.qtd_padrao,
  alteracao_pda = EXCLUDED.alteracao_pda,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- CORTE TOP25 - (mesma estrutura que CORTE A)
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('CORTE TOP25 -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'Obrigatorio', 1, false, 1),
('CORTE TOP25 -', '9801', 'Realizada arrecadação (Pagamento com maquininha)', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'Obrigatorio', 1, false, 1),
('CORTE TOP25 -', '95001', 'AT-Chave Fusivel', 'SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'Obrigatorio', 1, false, 1),
('CORTE TOP25 -', '95004', 'BT-Caixa/Borne', 'NDCCU0017SC - CORTE NO SOLO-BT', 'Obrigatorio', 1, false, 1),
('CORTE TOP25 -', '95005', 'GAVIAO Disjuntor', 'SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'Obrigatorio', 1, false, 1),
('CORTE TOP25 -', '95006', 'BT-Poste', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, false, 1),
('CORTE TOP25 -', '95012', 'MONO-Poste e Ramal', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, true, 1),
('CORTE TOP25 -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('CORTE TOP25 -', '95019', 'POLI-Poste e Ramal', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Obrigatorio', 1, true, 1),
('CORTE TOP25 -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('CORTE TOP25 -', '95042', 'GAVIAO Encontrado Ja Religado', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 1),
('CORTE TOP25 -', '95043', 'Encontrado Cortado', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 1),
('CORTE TOP25 -', '96001', 'AT-Conta Paga', 'SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'Obrigatorio', 1, true, 3),
('CORTE TOP25 -', '96002', 'BT-Conta Paga', 'SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'Obrigatorio', 1, true, 3),
('CORTE TOP25 -', '96003', 'GAVIAO Conta Paga', 'SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'Obrigatorio', 1, true, 3),
('CORTE TOP25 -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'Obrigatorio', 1, true, 3),
('CORTE TOP25 -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE TOP25 -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE TOP25 -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('CORTE TOP25 -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('CORTE TOP25 -', '96020', 'GAVIAO Sem Acesso ao Padrao', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2),
('CORTE TOP25 -', '96036', 'GAVIAO Impedimento - Cliente', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2),
('CORTE TOP25 -', '96037', 'GAVIAO Impedimento - Deficiencia Tecnica', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 3),
('CORTE TOP25 -', '96038', 'GAVIAO Impedimento - Disjuntor Com Cadeado/Grade', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 3),
('CORTE TOP25 -', '96039', 'GAVIAO Impedimento - Disjuntor Interno', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET
  retorno_descricao = EXCLUDED.retorno_descricao,
  situacao = EXCLUDED.situacao,
  qtd_padrao = EXCLUDED.qtd_padrao,
  alteracao_pda = EXCLUDED.alteracao_pda,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- ENLACE -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('ENLACE -', '95011', 'MONO-Medidor', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('ENLACE -', '95011', 'MONO-Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('ENLACE -', '95018', 'POLI-Medidor', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('ENLACE -', '95018', 'POLI-Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('ENLACE -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, false, 3),
('ENLACE -', '96005', 'Impedimento - Dificil Acesso', NULL, 'Obrigatorio', 0, false, 2),
('ENLACE -', '96007', 'Impedimento - Local Fechado', NULL, 'Obrigatorio', 0, false, 2),
('ENLACE -', '96009', 'Impedimento - Cliente', NULL, 'Obrigatorio', 0, false, 2),
('ENLACE -', '96014', 'Impedimento - Medidor Nao Confere', NULL, 'Obrigatorio', 0, false, 2),
('ENLACE -', '96017', 'Impedimento - Nao Localizado', NULL, 'Obrigatorio', 0, false, 2),
('ENLACE -', '96021', 'Servico Ja Realizado (Coletar Dados)', NULL, 'Obrigatorio', 0, false, 1),
('ENLACE -', '960091', 'Impedimento - Saúde (COVID19)', NULL, 'Obrigatorio', 0, false, 0)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET
  retorno_descricao = EXCLUDED.retorno_descricao,
  situacao = EXCLUDED.situacao,
  qtd_padrao = EXCLUDED.qtd_padrao,
  alteracao_pda = EXCLUDED.alteracao_pda,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- LIGACAO NOVA -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('LIGACAO NOVA -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('LIGACAO NOVA -', '95012', 'MONO-Poste e Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Opcional (nao selecionado)', 1, false, 1),
('LIGACAO NOVA -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, false, 1),
('LIGACAO NOVA -', '95012', 'MONO-Poste e Ramal', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('LIGACAO NOVA -', '95012', 'MONO-Poste e Ramal', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'Opcional (nao selecionado)', 1, false, 1),
('LIGACAO NOVA -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, false, 1),
('LIGACAO NOVA -', '95019', 'POLI-Poste e Ramal', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('LIGACAO NOVA -', '95019', 'POLI-Poste e Ramal', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'Opcional (nao selecionado)', 1, false, 1),
('LIGACAO NOVA -', '95028', 'MONO-Multiplas UCs', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Opcional (nao selecionado)', 1, false, 1),
('LIGACAO NOVA -', '95028', 'MONO-Multiplas UCs', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Opcional (nao selecionado)', 1, false, 1),
('LIGACAO NOVA -', '95028', 'MONO-Multiplas UCs', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('LIGACAO NOVA -', '95028', 'MONO-Multiplas UCs', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'Opcional (nao selecionado)', 1, false, 1),
('LIGACAO NOVA -', '95029', 'POLI-Multiplas UCs', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('LIGACAO NOVA -', '95029', 'POLI-Multiplas UCs', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'Opcional (nao selecionado)', 1, false, 1),
('LIGACAO NOVA -', '95029', 'POLI-Multiplas UCs', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Opcional (nao selecionado)', 1, false, 1),
('LIGACAO NOVA -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'Obrigatorio', 1, false, 3),
('LIGACAO NOVA -', '96005', 'Impedimento - Dificil Acesso', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, false, 2),
('LIGACAO NOVA -', '96007', 'Impedimento - Local Fechado', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, false, 2),
('LIGACAO NOVA -', '96017', 'Impedimento - Nao Localizado', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, false, 2),
('LIGACAO NOVA -', '96018', 'Necessario Obra no Local', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, false, 3),
('LIGACAO NOVA -', '96021', 'Servico Ja Realizado (Coletar Dados)', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, false, 1),
('LIGACAO NOVA -', '96029', 'Cliente Desistiu do Servico', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, false, 2),
('LIGACAO NOVA -', '96030', 'Apresentar Projeto', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, false, 2),
('LIGACAO NOVA -', '96031', 'Cadastro Incorreto', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, false, 2),
('LIGACAO NOVA -', '96032', 'Trata-se de Reativacao', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, false, 1),
('LIGACAO NOVA -', '96047', 'Impedimento - Dificil Acesso (Chuva)', NULL, 'Obrigatorio', 0, false, 0)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET
  retorno_descricao = EXCLUDED.retorno_descricao,
  situacao = EXCLUDED.situacao,
  qtd_padrao = EXCLUDED.qtd_padrao,
  alteracao_pda = EXCLUDED.alteracao_pda,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- Continua no próximo arquivo...

