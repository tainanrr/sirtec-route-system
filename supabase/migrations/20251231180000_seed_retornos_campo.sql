-- Migration: Cadastro massivo de Retornos de Campo
-- Data: 31/12/2025
-- PARTE 1: Criar tabela de relacionamento entre Skills e Retornos

-- Criar tabela de relacionamento skill_retornos
CREATE TABLE IF NOT EXISTS public.skill_retornos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_codigo VARCHAR(100) NOT NULL,
  retorno_codigo VARCHAR(50) NOT NULL,
  retorno_descricao VARCHAR(255) NOT NULL,
  tabela_preco VARCHAR(255),
  situacao VARCHAR(50) DEFAULT 'Obrigatorio',
  qtd_padrao INTEGER DEFAULT 1,
  alteracao_pda BOOLEAN DEFAULT false,
  qtd_min_fotos INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_codigo, retorno_codigo, tabela_preco)
);

CREATE INDEX IF NOT EXISTS idx_skill_retornos_skill ON public.skill_retornos(skill_codigo);
CREATE INDEX IF NOT EXISTS idx_skill_retornos_retorno ON public.skill_retornos(retorno_codigo);

-- PARTE 2: Inserir retornos de campo únicos na tabela principal
-- Usando INSERT com verificação de existência para evitar duplicatas
INSERT INTO public.retornos_campo (codigo, descricao, tipo, ativo)
SELECT v.codigo, v.descricao, v.tipo, v.ativo
FROM (VALUES
  ('99', 'Impedimento - Deficiencia Tecnica - Falta Material', 'impedimento', true),
  ('961', 'Não realizado - Necessário Cartucho', 'impedimento', true),
  ('9506', 'POLI para POLI-Multiplas UCs', 'outro', true),
  ('9507', 'POLI para POLI-Ramal', 'outro', true),
  ('9600', 'Medidor Extraviado', 'impedimento', true),
  ('9601', 'MONO-Caixa e Ramal', 'outro', true),
  ('9602', 'POLI-Caixa e Ramal', 'outro', true),
  ('9801', 'Realizada arrecadação (Pagamento com maquininha)', 'outro', true),
  ('95000', 'Visitado - Liberado para execução', 'outro', true),
  ('95001', 'AT-Chave Fusivel', 'outro', true),
  ('95004', 'BT-Caixa/Borne', 'outro', true),
  ('95005', 'GAVIAO Disjuntor', 'outro', true),
  ('95006', 'BT-Poste', 'outro', true),
  ('95007', 'Demolido', 'impedimento', true),
  ('95008', 'MONO-Caixa e Medidor', 'outro', true),
  ('95009', 'MONO-Caixa e Medidor-Relocar', 'outro', true),
  ('95010', 'MONO-Caixa e Medidor-Trocar', 'outro', true),
  ('95011', 'MONO-Medidor', 'outro', true),
  ('95012', 'MONO-Poste e Ramal', 'outro', true),
  ('95013', 'MONO-Poste, Ramal e Medidor', 'outro', true),
  ('95014', 'MONO-Poste, Ramal e Medidor-Relocar', 'outro', true),
  ('95015', 'MONO-Poste, Ramal e Medidor-Trocar', 'outro', true),
  ('95016', 'POLI-Caixa e Medidor', 'outro', true),
  ('95017', 'POLI-Caixa e Medidor-Relocar', 'outro', true),
  ('95018', 'POLI-Medidor', 'outro', true),
  ('95019', 'POLI-Poste e Ramal', 'outro', true),
  ('95020', 'POLI-Poste, Ramal e Medidor', 'outro', true),
  ('95021', 'POLI-Poste, Ramal e Medidor-Relocar', 'outro', true),
  ('95022', 'POLI-Poste, Ramal e Medidor-Trocar', 'outro', true),
  ('95023', 'Retirar Desvio de Energia com Ramal', 'outro', true),
  ('95024', 'Retirar Desvio de Energia sem Ramal', 'outro', true),
  ('95025', 'Visita Tecnica-Equipamento Normal', 'outro', true),
  ('95026', 'POLI-Caixa e Medidor-Trocar', 'outro', true),
  ('95027', 'Levantamento de Dados', 'outro', true),
  ('95028', 'MONO-Multiplas UCs', 'outro', true),
  ('95029', 'POLI-Multiplas UCs', 'outro', true),
  ('95034', 'MONO para POLI-Multiplas UCs', 'outro', true),
  ('95035', 'POLI para MONO-Multiplas UCs', 'outro', true),
  ('95036', 'MONO para POLI-Ramal', 'outro', true),
  ('95037', 'POLI para MONO-Ramal', 'outro', true),
  ('95039', 'MONO-Poste, Ramal e Medidor-Desliga', 'outro', true),
  ('95040', 'POLI-Poste, Ramal e Medidor-Desliga', 'outro', true),
  ('95042', 'GAVIAO Encontrado Ja Religado', 'outro', true),
  ('95043', 'Encontrado Cortado', 'outro', true),
  ('95058', 'MONO-Poste e Medidor', 'outro', true),
  ('95059', 'POLI-Poste e Medidor', 'outro', true),
  ('95060', 'KIT MONO- Ramal e Medidor', 'outro', true),
  ('95061', 'KIT MONO- Medidor', 'outro', true),
  ('96001', 'AT-Conta Paga', 'impedimento', true),
  ('96002', 'BT-Conta Paga', 'impedimento', true),
  ('96003', 'GAVIAO Conta Paga', 'impedimento', true),
  ('96004', 'Impedimento - Deficiencia Tecnica', 'impedimento', true),
  ('96005', 'Impedimento - Dificil Acesso', 'impedimento', true),
  ('96006', 'Encontrado Ja Religado', 'outro', true),
  ('96007', 'Impedimento - Local Fechado', 'impedimento', true),
  ('96008', 'Impedimento - Aparelhagem Medica', 'impedimento', true),
  ('96009', 'Impedimento - Cliente', 'impedimento', true),
  ('96010', 'Impedimento - Empresa', 'impedimento', true),
  ('96011', 'Impedimento - Liminar Judicial', 'impedimento', true),
  ('96012', 'Impedimento - Medidor Interno', 'impedimento', true),
  ('96013', 'Impedimento - Ligado com Outro Medidor', 'impedimento', true),
  ('96014', 'Impedimento - Medidor Nao Confere', 'impedimento', true),
  ('96015', 'BT-Nao Apresentou Fatura', 'impedimento', true),
  ('96016', 'GAVIAO Impedimento - Nao Apresentou Fatura', 'impedimento', true),
  ('96017', 'Impedimento - Nao Localizado', 'impedimento', true),
  ('96018', 'Necessario Obra no Local', 'impedimento', true),
  ('96020', 'GAVIAO Sem Acesso ao Padrao', 'impedimento', true),
  ('96021', 'Servico Ja Realizado (Coletar Dados)', 'outro', true),
  ('96024', 'Impedimento - Imovel Demolido', 'impedimento', true),
  ('96028', 'Cliente Ausente', 'impedimento', true),
  ('96029', 'Cliente Desistiu do Servico', 'impedimento', true),
  ('96030', 'Apresentar Projeto', 'impedimento', true),
  ('96031', 'Cadastro Incorreto', 'impedimento', true),
  ('96032', 'Trata-se de Reativacao', 'outro', true),
  ('96036', 'GAVIAO Impedimento - Cliente', 'impedimento', true),
  ('96037', 'GAVIAO Impedimento - Deficiencia Tecnica', 'impedimento', true),
  ('96038', 'GAVIAO Impedimento - Disjuntor Com Cadeado/Grade', 'impedimento', true),
  ('96039', 'GAVIAO Impedimento - Disjuntor Interno', 'impedimento', true),
  ('96040', 'GAVIAO Impedimento - Dispositivo Nao Encaixa', 'impedimento', true),
  ('96047', 'Impedimento - Dificil Acesso (Chuva)', 'impedimento', true),
  ('960091', 'Impedimento - Saúde (COVID19)', 'impedimento', true)
) AS v(codigo, descricao, tipo, ativo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.retornos_campo r WHERE r.codigo = v.codigo
);

-- PARTE 3: Inserir vínculos entre Skills e Retornos
-- Usando INSERT com ON CONFLICT para evitar duplicatas

-- ALTERACAO CONTRATUAL -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('ALTERACAO CONTRATUAL -', '99', 'Impedimento - Deficiencia Tecnica - Falta Material', NULL, 'Obrigatorio', 0, false, 0),
('ALTERACAO CONTRATUAL -', '9506', 'POLI para POLI-Multiplas UCs', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('ALTERACAO CONTRATUAL -', '9506', 'POLI para POLI-Multiplas UCs', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('ALTERACAO CONTRATUAL -', '9506', 'POLI para POLI-Multiplas UCs', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '9506', 'POLI para POLI-Multiplas UCs', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '9507', 'POLI para POLI-Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('ALTERACAO CONTRATUAL -', '9507', 'POLI para POLI-Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('ALTERACAO CONTRATUAL -', '9507', 'POLI para POLI-Ramal', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '9507', 'POLI para POLI-Ramal', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '95034', 'MONO para POLI-Multiplas UCs', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('ALTERACAO CONTRATUAL -', '95034', 'MONO para POLI-Multiplas UCs', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '95034', 'MONO para POLI-Multiplas UCs', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '95035', 'POLI para MONO-Multiplas UCs', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '95035', 'POLI para MONO-Multiplas UCs', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '95036', 'MONO para POLI-Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Opcional (selecionado)', 1, true, 1),
('ALTERACAO CONTRATUAL -', '95036', 'MONO para POLI-Ramal', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Opcional (selecionado)', 1, false, 1),
('ALTERACAO CONTRATUAL -', '95036', 'MONO para POLI-Ramal', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Opcional (selecionado)', 1, false, 1),
('ALTERACAO CONTRATUAL -', '95036', 'MONO para POLI-Ramal', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Opcional (selecionado)', 1, true, 1),
('ALTERACAO CONTRATUAL -', '95037', 'POLI para MONO-Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('ALTERACAO CONTRATUAL -', '95037', 'POLI para MONO-Ramal', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Obrigatorio', 1, true, 1),
('ALTERACAO CONTRATUAL -', '95037', 'POLI para MONO-Ramal', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '95037', 'POLI para MONO-Ramal', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('ALTERACAO CONTRATUAL -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('ALTERACAO CONTRATUAL -', '96007', 'Impedimento - Local Fechado', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Obrigatorio', 1, true, 2),
('ALTERACAO CONTRATUAL -', '96017', 'Impedimento - Nao Localizado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('ALTERACAO CONTRATUAL -', '96018', 'Necessario Obra no Local', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 3),
('ALTERACAO CONTRATUAL -', '96021', 'Servico Ja Realizado (Coletar Dados)', NULL, 'Obrigatorio', 0, false, 1),
('ALTERACAO CONTRATUAL -', '96028', 'Cliente Ausente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('ALTERACAO CONTRATUAL -', '96029', 'Cliente Desistiu do Servico', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('ALTERACAO CONTRATUAL -', '96030', 'Apresentar Projeto', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('ALTERACAO CONTRATUAL -', '96031', 'Cadastro Incorreto', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET
  retorno_descricao = EXCLUDED.retorno_descricao,
  situacao = EXCLUDED.situacao,
  qtd_padrao = EXCLUDED.qtd_padrao,
  alteracao_pda = EXCLUDED.alteracao_pda,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- BAIXA A PEDIDO -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('BAIXA A PEDIDO -', '95008', 'MONO-Caixa e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('BAIXA A PEDIDO -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('BAIXA A PEDIDO -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('BAIXA A PEDIDO -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, false, 1),
('BAIXA A PEDIDO -', '95016', 'POLI-Caixa e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('BAIXA A PEDIDO -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('BAIXA A PEDIDO -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('BAIXA A PEDIDO -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, false, 1),
('BAIXA A PEDIDO -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('BAIXA A PEDIDO -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('BAIXA A PEDIDO -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('BAIXA A PEDIDO -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 1),
('BAIXA A PEDIDO -', '96013', 'Impedimento - Ligado com Outro Medidor', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('BAIXA A PEDIDO -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('BAIXA A PEDIDO -', '96017', 'Impedimento - Nao Localizado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('BAIXA A PEDIDO -', '96021', 'Servico Ja Realizado (Coletar Dados)', NULL, 'Obrigatorio', 0, false, 1)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET
  retorno_descricao = EXCLUDED.retorno_descricao,
  situacao = EXCLUDED.situacao,
  qtd_padrao = EXCLUDED.qtd_padrao,
  alteracao_pda = EXCLUDED.alteracao_pda,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- BAIXA ADM -
INSERT INTO public.skill_retornos (skill_codigo, retorno_codigo, retorno_descricao, tabela_preco, situacao, qtd_padrao, alteracao_pda, qtd_min_fotos) VALUES
('BAIXA ADM -', '9600', 'Medidor Extraviado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, false, 2),
('BAIXA ADM -', '95008', 'MONO-Caixa e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('BAIXA ADM -', '95012', 'MONO-Poste e Ramal', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('BAIXA ADM -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Obrigatorio', 1, true, 1),
('BAIXA ADM -', '95013', 'MONO-Poste, Ramal e Medidor', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Obrigatorio', 1, true, 1),
('BAIXA ADM -', '95016', 'POLI-Caixa e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('BAIXA ADM -', '95019', 'POLI-Poste e Ramal', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('BAIXA ADM -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Obrigatorio', 1, true, 1),
('BAIXA ADM -', '95020', 'POLI-Poste, Ramal e Medidor', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Obrigatorio', 1, true, 1),
('BAIXA ADM -', '96004', 'Impedimento - Deficiencia Tecnica', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Obrigatorio', 1, true, 3),
('BAIXA ADM -', '96005', 'Impedimento - Dificil Acesso', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('BAIXA ADM -', '96009', 'Impedimento - Cliente', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('BAIXA ADM -', '96012', 'Impedimento - Medidor Interno', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 1),
('BAIXA ADM -', '96013', 'Impedimento - Ligado com Outro Medidor', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('BAIXA ADM -', '96014', 'Impedimento - Medidor Nao Confere', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2),
('BAIXA ADM -', '96017', 'Impedimento - Nao Localizado', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Obrigatorio', 1, true, 2)
ON CONFLICT (skill_codigo, retorno_codigo, tabela_preco) DO UPDATE SET
  retorno_descricao = EXCLUDED.retorno_descricao,
  situacao = EXCLUDED.situacao,
  qtd_padrao = EXCLUDED.qtd_padrao,
  alteracao_pda = EXCLUDED.alteracao_pda,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- Continua no próximo arquivo devido ao tamanho...
-- Ver arquivo 20251231180001_seed_retornos_campo_parte2.sql

