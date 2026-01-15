-- Script para recadastrar Retornos de Campo de TODOS os Tipos de Serviço
-- Execute este script no SQL Editor do Supabase
-- Data: 15/01/2026
-- ATENÇÃO: Este script limpa e recadastra TODOS os dados de retornos de campo!

-- =====================================================
-- PARTE 1: LIMPAR TODOS OS DADOS EXISTENTES
-- =====================================================

-- Lista de tipos de serviço que serão reconfigurados
-- BAIXA A PEDIDO -, BAIXA ADM -, CORTE A -, CORTE B -, CORTE C -, CORTE TOP25 -,
-- ENLACE -, LIGACAO NOVA -, LIGACAO PROVISORIA DESLIGA -, LIGACAO PROVISORIA LIGA -,
-- MICROGERAÇÃO -, MODIF-DESLIGAR MANUT -, MODIF-RELOCAR MEDIDOR -, MODIF-SERVICO RAMAL -,
-- MODIF-RELIGAR MANUT -, REATIVACAO -, RECORTE A -, RECORTE B -, RECORTE C -,
-- RELIGA ANALISE PROC. -, RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -, RELIGA AUTOMATICA -,
-- RELIGA AUTOMATICA C/ SUBST. MEDIDOR -, RELIGA JUDICIAL -, RELIGA JUDICIAL C/ SUBST. MEDIDOR -,
-- RELIGA NORMAL -, RELIGA NORMAL C/ SUBST. MEDIDOR -, VARREDURA -, VERIFICACAO -,
-- ATENDIMENTO DE OCORRÊNCIA

-- 1.1 Excluir todas as atividades vinculadas aos retornos destes tipos de serviço
DELETE FROM public.tipo_servico_retorno_atividades
WHERE tipo_servico_retorno_id IN (
  SELECT tsr.id FROM public.tipo_servico_retornos tsr
  INNER JOIN public.skills s ON s.id = tsr.skill_id
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
);

-- 1.2 Excluir todos os retornos vinculados a estes tipos de serviço
DELETE FROM public.tipo_servico_retornos
WHERE skill_id IN (
  SELECT id FROM public.skills WHERE codigo IN (
    'BAIXA A PEDIDO -', 'BAIXA ADM -', 'CORTE A -', 'CORTE B -', 'CORTE C -', 'CORTE TOP25 -',
    'ENLACE -', 'LIGACAO NOVA -', 'LIGACAO PROVISORIA DESLIGA -', 'LIGACAO PROVISORIA LIGA -',
    'MICROGERAÇÃO -', 'MODIF-DESLIGAR MANUT -', 'MODIF-RELOCAR MEDIDOR -', 'MODIF-SERVICO RAMAL -',
    'MODIF-RELIGAR MANUT -', 'REATIVACAO -', 'RECORTE A -', 'RECORTE B -', 'RECORTE C -',
    'RELIGA ANALISE PROC. -', 'RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', 'RELIGA AUTOMATICA -',
    'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -', 'RELIGA JUDICIAL -', 'RELIGA JUDICIAL C/ SUBST. MEDIDOR -',
    'RELIGA NORMAL -', 'RELIGA NORMAL C/ SUBST. MEDIDOR -', 'VARREDURA -', 'VERIFICACAO -',
    'ATENDIMENTO DE OCORRÊNCIA'
  )
);

-- =====================================================
-- PARTE 2: CRIAR OS RETORNOS DE CAMPO (se não existirem)
-- =====================================================

-- Cor verde (#22c55e) para Executado, vermelho (#ef4444) para Impedimento
INSERT INTO public.retornos_campo (codigo, descricao, tipo, cor, gera_producao, finaliza_os, ativo)
VALUES 
  -- Retornos Executado (verde)
  ('591', 'OCORRÊNCIA ATENDIDA', 'executado', '#22c55e', true, true, true),
  ('961', 'Não realizado - Necessário Cartucho', 'impedimento', '#ef4444', false, true, true),
  ('9600', 'Medidor Extraviado', 'impedimento', '#ef4444', false, true, true),
  ('9601', 'MONO-Caixa e Ramal', 'executado', '#22c55e', true, true, true),
  ('9602', 'POLI-Caixa e Ramal', 'executado', '#22c55e', true, true, true),
  ('9801', 'Realizada arrecadação (Pagamento com maquininha)', 'executado', '#22c55e', true, true, true),
  ('95000', 'Visitado - Liberado para execução', 'executado', '#22c55e', true, true, true),
  ('95001', 'AT-Chave Fusivel', 'executado', '#22c55e', true, true, true),
  ('95004', 'BT-Caixa/Borne', 'executado', '#22c55e', true, true, true),
  ('95005', 'GAVIAO Disjuntor', 'executado', '#22c55e', true, true, true),
  ('95006', 'BT-Poste', 'executado', '#22c55e', true, true, true),
  ('95007', 'Demolido', 'impedimento', '#ef4444', false, true, true),
  ('95008', 'MONO-Caixa e Medidor', 'executado', '#22c55e', true, true, true),
  ('95009', 'MONO-Caixa e Medidor-Relocar', 'executado', '#22c55e', true, true, true),
  ('95010', 'MONO-Caixa e Medidor-Trocar', 'executado', '#22c55e', true, true, true),
  ('95011', 'MONO-Medidor', 'executado', '#22c55e', true, true, true),
  ('95012', 'MONO-Poste e Ramal', 'executado', '#22c55e', true, true, true),
  ('95013', 'MONO-Poste, Ramal e Medidor', 'executado', '#22c55e', true, true, true),
  ('95014', 'MONO-Poste, Ramal e Medidor-Relocar', 'executado', '#22c55e', true, true, true),
  ('95015', 'MONO-Poste, Ramal e Medidor-Trocar', 'executado', '#22c55e', true, true, true),
  ('95016', 'POLI-Caixa e Medidor', 'executado', '#22c55e', true, true, true),
  ('95017', 'POLI-Caixa e Medidor-Relocar', 'executado', '#22c55e', true, true, true),
  ('95018', 'POLI-Medidor', 'executado', '#22c55e', true, true, true),
  ('95019', 'POLI-Poste e Ramal', 'executado', '#22c55e', true, true, true),
  ('95020', 'POLI-Poste, Ramal e Medidor', 'executado', '#22c55e', true, true, true),
  ('95021', 'POLI-Poste, Ramal e Medidor-Relocar', 'executado', '#22c55e', true, true, true),
  ('95022', 'POLI-Poste, Ramal e Medidor-Trocar', 'executado', '#22c55e', true, true, true),
  ('95023', 'Retirar Desvio de Energia com Ramal', 'executado', '#22c55e', true, true, true),
  ('95024', 'Retirar Desvio de Energia sem Ramal', 'executado', '#22c55e', true, true, true),
  ('95025', 'Visita Tecnica-Equipamento Normal', 'executado', '#22c55e', true, true, true),
  ('95026', 'POLI-Caixa e Medidor-Trocar', 'executado', '#22c55e', true, true, true),
  ('95027', 'Levantamento de Dados', 'impedimento', '#ef4444', false, true, true),
  ('95028', 'MONO-Multiplas UCs', 'executado', '#22c55e', true, true, true),
  ('95029', 'POLI-Multiplas UCs', 'executado', '#22c55e', true, true, true),
  ('95039', 'MONO-Poste, Ramal e Medidor-Desliga', 'executado', '#22c55e', true, true, true),
  ('95040', 'POLI-Poste, Ramal e Medidor-Desliga', 'executado', '#22c55e', true, true, true),
  ('95042', 'GAVIAO Encontrado Ja Religado', 'executado', '#22c55e', true, true, true),
  ('95043', 'Encontrado Cortado', 'impedimento', '#ef4444', false, true, true),
  ('95058', 'MONO-Poste e Medidor', 'executado', '#22c55e', true, true, true),
  ('95059', 'POLI-Poste e Medidor', 'executado', '#22c55e', true, true, true),
  ('95060', 'KIT MONO- Ramal e Medidor', 'executado', '#22c55e', true, true, true),
  ('95061', 'KIT MONO- Medidor', 'executado', '#22c55e', true, true, true),
  -- Retornos Impedimento (vermelho)
  ('592', 'PASSAR PARA PRONTIDÃO', 'impedimento', '#ef4444', false, true, true),
  ('96001', 'AT-Conta Paga', 'executado', '#22c55e', true, true, true),
  ('96002', 'BT-Conta Paga', 'executado', '#22c55e', true, true, true),
  ('96003', 'GAVIAO Conta Paga', 'executado', '#22c55e', true, true, true),
  ('96004', 'Impedimento - Deficiencia Tecnica', 'impedimento', '#ef4444', false, true, true),
  ('96005', 'Impedimento - Dificil Acesso', 'impedimento', '#ef4444', false, true, true),
  ('96006', 'Encontrado Ja Religado', 'impedimento', '#ef4444', false, true, true),
  ('96007', 'Impedimento - Local Fechado', 'impedimento', '#ef4444', false, true, true),
  ('96008', 'Impedimento - Aparelhagem Medica', 'impedimento', '#ef4444', false, true, true),
  ('96009', 'Impedimento - Cliente', 'impedimento', '#ef4444', false, true, true),
  ('96010', 'Impedimento - Empresa', 'impedimento', '#ef4444', false, true, true),
  ('96011', 'Impedimento - Liminar Judicial', 'impedimento', '#ef4444', false, true, true),
  ('96012', 'Impedimento - Medidor Interno', 'impedimento', '#ef4444', false, true, true),
  ('96013', 'Impedimento - Ligado com Outro Medidor', 'impedimento', '#ef4444', false, true, true),
  ('96014', 'Impedimento - Medidor Nao Confere', 'impedimento', '#ef4444', false, true, true),
  ('96015', 'BT-Nao Apresentou Fatura', 'executado', '#22c55e', true, true, true),
  ('96016', 'GAVIAO Impedimento - Nao Apresentou Fatura', 'impedimento', '#ef4444', false, true, true),
  ('96017', 'Impedimento - Nao Localizado', 'impedimento', '#ef4444', false, true, true),
  ('96018', 'Necessario Obra no Local', 'impedimento', '#ef4444', false, true, true),
  ('96020', 'GAVIAO Sem Acesso ao Padrao', 'executado', '#22c55e', true, true, true),
  ('96021', 'Servico Ja Realizado (Coletar Dados)', 'executado', '#22c55e', true, true, true),
  ('96024', 'Impedimento - Imovel Demolido', 'impedimento', '#ef4444', false, true, true),
  ('96028', 'Cliente Ausente', 'impedimento', '#ef4444', false, true, true),
  ('96029', 'Cliente Desistiu do Servico', 'impedimento', '#ef4444', false, true, true),
  ('96030', 'Apresentar Projeto', 'impedimento', '#ef4444', false, true, true),
  ('96031', 'Cadastro Incorreto', 'impedimento', '#ef4444', false, true, true),
  ('96032', 'Trata-se de Reativacao', 'impedimento', '#ef4444', false, true, true),
  ('96036', 'GAVIAO Impedimento - Cliente', 'impedimento', '#ef4444', false, true, true),
  ('96037', 'GAVIAO Impedimento - Deficiencia Tecnica', 'impedimento', '#ef4444', false, true, true),
  ('96038', 'GAVIAO Impedimento - Disjuntor Com Cadeado/Grade', 'impedimento', '#ef4444', false, true, true),
  ('96039', 'GAVIAO Impedimento - Disjuntor Interno', 'impedimento', '#ef4444', false, true, true),
  ('96040', 'GAVIAO Impedimento - Dispositivo Nao Encaixa', 'impedimento', '#ef4444', false, true, true),
  ('96047', 'Impedimento - Dificil Acesso (Chuva)', 'impedimento', '#ef4444', false, true, true),
  ('960091', 'Impedimento - Saúde (COVID19)', 'impedimento', '#ef4444', false, true, true)
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo,
  cor = EXCLUDED.cor;

-- 2.2 Atualizar o grupo_id dos retornos de campo com base no tipo
UPDATE public.retornos_campo rc
SET grupo_id = gr.id
FROM public.grupos_retorno gr
WHERE rc.tipo = gr.codigo AND rc.grupo_id IS NULL;

-- =====================================================
-- PARTE 3: CRIAR AS ATIVIDADES/TABELAS DE PREÇO (se não existirem)
-- =====================================================

INSERT INTO public.atividades (codigo, descricao, categoria, ativo)
VALUES 
  ('SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'Tabela de Preço', true),
  ('SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'Tabela de Preço', true),
  ('SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Tabela de Preço', true),
  ('SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Tabela de Preço', true),
  ('SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Tabela de Preço', true),
  ('SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Tabela de Preço', true),
  ('SDCLU6016DC - DESLOCAR MEDIDOR MONO-BT', 'SDCLU6016DC - DESLOCAR MEDIDOR MONO-BT', 'Tabela de Preço', true),
  ('SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Tabela de Preço', true),
  ('SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Tabela de Preço', true),
  ('SDCLU6017DC - DESLOCAR MEDIDOR POLI-BT', 'SDCLU6017DC - DESLOCAR MEDIDOR POLI-BT', 'Tabela de Preço', true),
  ('SDCLU6015SC - DESLOCAR MEDIDOR BT', 'SDCLU6015SC - DESLOCAR MEDIDOR BT', 'Tabela de Preço', true),
  ('SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'Tabela de Preço', true),
  ('SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Tabela de Preço', true),
  ('SDCLU6032II - INSTALAR POSTE AUX 7M', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'Tabela de Preço', true),
  ('SDCLU6032RD - RETIRAR POSTE AUX 7M', 'SDCLU6032RD - RETIRAR POSTE AUX 7M', 'Tabela de Preço', true),
  ('SDCLU6033II - INSTALAR MEDIDOR BIDIRECIONAL MONOFASICO', 'SDCLU6033II - INSTALAR MEDIDOR BIDIRECIONAL MONOFASICO', 'Tabela de Preço', true),
  ('SDCLU6034II - INSTALAR MEDIDOR BIDIRECIONAL POLIFASICO', 'SDCLU6034II - INSTALAR MEDIDOR BIDIRECIONAL POLIFASICO', 'Tabela de Preço', true),
  ('SDCLU6025IC - INSTALACAO INTERNA LPT', 'SDCLU6025IC - INSTALACAO INTERNA LPT', 'Tabela de Preço', true),
  ('SDCLU6009IC - INSTALAR PADRAO ENTRADA MONO NO POSTE', 'SDCLU6009IC - INSTALAR PADRAO ENTRADA MONO NO POSTE', 'Tabela de Preço', true),
  ('SDCCU6401DC - DESLOCAR RAMAL DE LIG-MONO-BT', 'SDCCU6401DC - DESLOCAR RAMAL DE LIG-MONO-BT', 'Tabela de Preço', true),
  ('SDCCU6401IC - INSTALAR RAMAL DE LIG-MONO-BT', 'SDCCU6401IC - INSTALAR RAMAL DE LIG-MONO-BT', 'Tabela de Preço', true),
  ('SDCCU6401LI - REALOCAR RAMAL DE LIG-MONO-BT', 'SDCCU6401LI - REALOCAR RAMAL DE LIG-MONO-BT', 'Tabela de Preço', true),
  ('SDCCU6404DC - DESLOCAR RAMAL DE LIG POLI-BT', 'SDCCU6404DC - DESLOCAR RAMAL DE LIG POLI-BT', 'Tabela de Preço', true),
  ('SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'Tabela de Preço', true),
  ('SDCCU6408SC - CORTE NO POSTE -BT', 'SDCCU6408SC - CORTE NO POSTE -BT', 'Tabela de Preço', true),
  ('SDCCU6409SC - CORTE NO SOLO -BT', 'SDCCU6409SC - CORTE NO SOLO -BT', 'Tabela de Preço', true),
  ('SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'Tabela de Preço', true),
  ('SDCCU6414SC - RELIGA NO POSTE - BT', 'SDCCU6414SC - RELIGA NO POSTE - BT', 'Tabela de Preço', true),
  ('SDCCU6415SC - RELIGA NO SOLO - BT', 'SDCCU6415SC - RELIGA NO SOLO - BT', 'Tabela de Preço', true),
  ('SDCCU6416SC - RELIGA NAO EFETUADA N APR CTA PAGA BT', 'SDCCU6416SC - RELIGA NAO EFETUADA N APR CTA PAGA BT', 'Tabela de Preço', true),
  ('SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'Tabela de Preço', true),
  ('SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Tabela de Preço', true),
  ('SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICAPADRAO-BT', 'Tabela de Preço', true),
  ('SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Tabela de Preço', true),
  ('SDCCU6422SC - SERV RELIG FECHANDO CH FUSIVEL MT', 'SDCCU6422SC - SERV RELIG FECHANDO CH FUSIVEL MT', 'Tabela de Preço', true),
  ('SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'Tabela de Preço', true),
  ('SDCCU6424SC - SERV RETIRAR DISPOSIT BLOQ DISJUNTOR', 'SDCCU6424SC - SERV RETIRAR DISPOSIT BLOQ DISJUNTOR', 'Tabela de Preço', true),
  ('SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'Tabela de Preço', true),
  ('SDCCU6426SC - RELIGA NAO EFETUADA N APR CTA PAGA-DISJ', 'SDCCU6426SC - RELIGA NAO EFETUADA N APR CTA PAGA-DISJ', 'Tabela de Preço', true),
  ('SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'Tabela de Preço', true),
  ('SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'Tabela de Preço', true),
  ('SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'Tabela de Preço', true),
  ('NDCCU0017SC - CORTE NO SOLO-BT', 'NDCCU0017SC - CORTE NO SOLO-BT', 'Tabela de Preço', true),
  ('NDCCU0028SC - RETIRADA DE DESVIO DE ENERGIA COM RAMAL', 'NDCCU0028SC - RETIRADA DE DESVIO DE ENERGIA COM RAMAL', 'Tabela de Preço', true),
  ('NDCCU0029SC - RETIRADA DE DESVIO DE ENERGIA SEM RAMAL', 'NDCCU0029SC - RETIRADA DE DESVIO DE ENERGIA SEM RAMAL', 'Tabela de Preço', true),
  ('SDCIU6206SC - INSTALAR KIT CX MED 1F POLI POSTE/PAREDE', 'SDCIU6206SC - INSTALAR KIT CX MED 1F POLI POSTE/PAREDE', 'Tabela de Preço', true),
  ('SDCIU6264IC - INSTALAR MEDIDOR MONOFASICO', 'SDCIU6264IC - INSTALAR MEDIDOR MONOFASICO', 'Tabela de Preço', true),
  ('SDETU5003SI - TRANSP MAT OBRA - 04 TON - ATE 50 KM', 'SDETU5003SI - TRANSP MAT OBRA - 04 TON - ATE 50 KM', 'Tabela de Preço', true),
  ('SDETU5004SI - TRANSP MAT OBRA - 04 TON > DE 50 KM', 'SDETU5004SI - TRANSP MAT OBRA - 04 TON > DE 50 KM', 'Tabela de Preço', true),
  ('SDMOU4211SC - SERV FALTA LUZ INDIVIDUAL', 'SDMOU4211SC - SERV FALTA LUZ INDIVIDUAL', 'Tabela de Preço', true),
  ('SDMOU4212SC - SERV MEDIDOR', 'SDMOU4212SC - SERV MEDIDOR', 'Tabela de Preço', true),
  ('SDMOU4213SC - SERV OSCILACAO DE TENSAO', 'SDMOU4213SC - SERV OSCILACAO DE TENSAO', 'Tabela de Preço', true),
  ('SDMOU4214SC - RAMAL DE LIGACAO COM INSTALACAO', 'SDMOU4214SC - RAMAL DE LIGACAO COM INSTALACAO', 'Tabela de Preço', true),
  ('SDMOU4215SC - SERV RAMAL PARTIDO', 'SDMOU4215SC - SERV RAMAL PARTIDO', 'Tabela de Preço', true),
  ('SDMOU4216SC - SERV NAO EXECUTADO', 'SDMOU4216SC - SERV NAO EXECUTADO', 'Tabela de Preço', true),
  ('SDMOU4217SC - SERV SOLICITACAO DE RELIGAMENTO', 'SDMOU4217SC - SERV SOLICITACAO DE RELIGAMENTO', 'Tabela de Preço', true)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- PARTE 4: FUNÇÃO AUXILIAR PARA INSERIR DADOS
-- =====================================================

-- Criar função para facilitar as inserções
CREATE OR REPLACE FUNCTION insert_tipo_servico_retorno_atividade(
  p_skill_codigo VARCHAR,
  p_retorno_codigo VARCHAR,
  p_atividade_codigo VARCHAR,
  p_situacao VARCHAR,
  p_qtd_padrao INTEGER,
  p_permite_alterar BOOLEAN,
  p_qtd_min_fotos INTEGER
) RETURNS VOID AS $$
DECLARE
  v_skill_id UUID;
  v_retorno_id UUID;
  v_atividade_id UUID;
  v_tipo_servico_retorno_id UUID;
BEGIN
  -- Buscar IDs
  SELECT id INTO v_skill_id FROM public.skills WHERE codigo = p_skill_codigo;
  SELECT id INTO v_retorno_id FROM public.retornos_campo WHERE codigo = p_retorno_codigo;
  SELECT id INTO v_atividade_id FROM public.atividades WHERE codigo = p_atividade_codigo;
  
  IF v_skill_id IS NULL THEN
    RAISE NOTICE 'Skill não encontrado: %', p_skill_codigo;
    RETURN;
  END IF;
  
  IF v_retorno_id IS NULL THEN
    RAISE NOTICE 'Retorno não encontrado: %', p_retorno_codigo;
    RETURN;
  END IF;
  
  -- Criar vínculo tipo_servico_retornos se não existir
  INSERT INTO public.tipo_servico_retornos (skill_id, retorno_campo_id, ordem, padrao, ativo)
  VALUES (v_skill_id, v_retorno_id, 0, false, true)
  ON CONFLICT (skill_id, retorno_campo_id) DO NOTHING;
  
  -- Buscar o ID do tipo_servico_retorno
  SELECT id INTO v_tipo_servico_retorno_id 
  FROM public.tipo_servico_retornos 
  WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
  
  -- Se atividade foi especificada (não é "-" ou vazio)
  IF p_atividade_codigo IS NOT NULL AND p_atividade_codigo != '' AND p_atividade_codigo != '-' AND v_atividade_id IS NOT NULL THEN
    INSERT INTO public.tipo_servico_retorno_atividades (
      tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem
    )
    VALUES (
      v_tipo_servico_retorno_id, v_atividade_id, p_situacao, p_qtd_padrao, p_permite_alterar, p_qtd_min_fotos, 0
    )
    ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
      situacao = EXCLUDED.situacao,
      quantidade_padrao = EXCLUDED.quantidade_padrao,
      permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
      qtd_min_fotos = EXCLUDED.qtd_min_fotos;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTE 5: INSERIR DADOS - BAIXA A PEDIDO -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '95008', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '95013', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '95013', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '95016', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '95020', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '95020', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '96017', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA A PEDIDO -', '96021', NULL, 'obrigatorio', 0, false, 1);

-- =====================================================
-- PARTE 6: INSERIR DADOS - BAIXA ADM -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '9600', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '95008', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '95013', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '95013', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '95016', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '95020', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '95020', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '96013', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('BAIXA ADM -', '96017', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 7: INSERIR DADOS - CORTE A -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '9801', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '9801', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95001', 'SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95004', 'NDCCU0017SC - CORTE NO SOLO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95005', 'SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95006', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95012', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95019', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95042', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '95043', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96001', 'SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96002', 'SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96003', 'SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96004', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96020', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96036', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96037', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96038', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE A -', '96039', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 8: INSERIR DADOS - CORTE B -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '9801', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '9801', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95001', 'SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95004', 'NDCCU0017SC - CORTE NO SOLO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95005', 'SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95006', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95012', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95019', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95042', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '95043', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96001', 'SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96002', 'SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96003', 'SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96004', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96020', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96036', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96037', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96038', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE B -', '96039', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 9: INSERIR DADOS - CORTE C -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '9801', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '9801', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95001', 'SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95004', 'NDCCU0017SC - CORTE NO SOLO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95005', 'SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95006', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95012', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95019', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95042', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '95043', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96001', 'SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96002', 'SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96003', 'SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96004', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96020', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96036', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96037', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96038', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE C -', '96039', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 10: INSERIR DADOS - CORTE TOP25 -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '9801', 'SDCCU6432SC - ADICIONAL CORTE NAO EFETUADO - ARRECADAC', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '9801', 'SDCCU6431SC - CORTE NAO EFETUADO - ARRECADACAO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95001', 'SDCCU6418SC - SERV CORTE UC ABRIR CH FUS GRAMPO LV-MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95004', 'NDCCU0017SC - CORTE NO SOLO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95005', 'SDCCU6423SC - SERV SUSP FORNC DISPOST BLOQ DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95006', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95012', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95012', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95019', 'SDCCU6408SC - CORTE NO POSTE -BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95019', 'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95042', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '95043', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96001', 'SDCCU6407SC - CORTE UC NAO EFETUADO CONTA PAGA-MT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96002', 'SDCCU6410SC - CORTE NAO EFETUADO CONTA PAGA BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96003', 'SDCCU6425SC - SUSP NAO EFETUADO CONTA PAGA-DISJUNTOR', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96004', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96005', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96009', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96012', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96014', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96020', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96036', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96037', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96038', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('CORTE TOP25 -', '96039', 'SDCCU6427SC - SERV N EFETUADO S ACESSO PADRAO DISJUNTO', 'obrigatorio', 1, false, 1);

-- =====================================================
-- PARTE 11: INSERIR DADOS - ENLACE -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '95011', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '95011', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '95018', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '95018', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '96004', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '96005', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '96007', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '96009', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '96014', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '96017', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '96021', NULL, 'obrigatorio', 0, false, 1);
SELECT insert_tipo_servico_retorno_atividade('ENLACE -', '960091', NULL, 'obrigatorio', 0, false, 0);

-- =====================================================
-- PARTE 12: INSERIR DADOS - LIGACAO NOVA -
-- =====================================================

SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95012', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95012', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95012', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95012', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95019', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95019', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95019', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95028', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95028', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95028', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95028', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95029', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95029', 'SDCLU6032II - INSTALAR POSTE AUX 7M', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '95029', 'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT', 'opcional_nao_selecionado', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96004', 'SDCLU6019SC - LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96005', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96007', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96017', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96018', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96021', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96029', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96030', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96031', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96032', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'obrigatorio', 1, false, 1);
SELECT insert_tipo_servico_retorno_atividade('LIGACAO NOVA -', '96047', NULL, 'obrigatorio', 0, false, 0);

-- Continua no próximo arquivo devido ao tamanho...
-- Veja: recadastrar_retornos_todos_tipos_servico_parte2.sql
