-- Script para recadastrar Retornos de Campo do Tipo de Serviço "ALTERACAO CONTRATUAL -"
-- Execute este script no SQL Editor do Supabase
-- Data: 15/01/2026

-- =====================================================
-- PARTE 1: LIMPAR DADOS EXISTENTES
-- =====================================================

-- 1.1 Verificar se o Tipo de Serviço existe
DO $$
DECLARE
  v_skill_id UUID;
BEGIN
  SELECT id INTO v_skill_id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -';
  
  IF v_skill_id IS NULL THEN
    RAISE EXCEPTION 'Tipo de Serviço "ALTERACAO CONTRATUAL -" não encontrado!';
  END IF;
  
  RAISE NOTICE 'Tipo de Serviço encontrado: %', v_skill_id;
END $$;

-- 1.2 Excluir todas as atividades vinculadas aos retornos deste tipo de serviço
DELETE FROM public.tipo_servico_retorno_atividades
WHERE tipo_servico_retorno_id IN (
  SELECT id FROM public.tipo_servico_retornos
  WHERE skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
);

-- 1.3 Excluir todos os retornos vinculados a este tipo de serviço
DELETE FROM public.tipo_servico_retornos
WHERE skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -');

-- =====================================================
-- PARTE 2: CRIAR OS RETORNOS DE CAMPO (se não existirem)
-- =====================================================

-- 2.1 Inserir os retornos de campo que podem não existir
INSERT INTO public.retornos_campo (codigo, descricao, tipo, gera_producao, finaliza_os, ativo)
VALUES 
  ('9506', 'POLI para POLI-Multiplas UCs', 'executado', true, true, true),
  ('9507', 'POLI para POLI-Ramal', 'executado', true, true, true),
  ('95034', 'MONO para POLI-Multiplas UCs', 'executado', true, true, true),
  ('95035', 'POLI para MONO-Multiplas UCs', 'executado', true, true, true),
  ('95036', 'MONO para POLI-Ramal', 'executado', true, true, true),
  ('95037', 'POLI para MONO-Ramal', 'executado', true, true, true),
  ('96004', 'Impedimento - Deficiencia Tecnica', 'impedimento', false, true, true),
  ('96007', 'Impedimento - Local Fechado', 'impedimento', false, true, true),
  ('96017', 'Impedimento - Nao Localizado', 'impedimento', false, true, true),
  ('96018', 'Necessario Obra no Local', 'impedimento', false, true, true),
  ('96021', 'Servico Ja Realizado (Coletar Dados)', 'executado', true, true, true),
  ('96028', 'Cliente Ausente', 'impedimento', false, true, true),
  ('96029', 'Cliente Desistiu do Servico', 'impedimento', false, true, true),
  ('96030', 'Apresentar Projeto', 'impedimento', false, true, true),
  ('96031', 'Cadastro Incorreto', 'impedimento', false, true, true)
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo;

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
  ('SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'SDCLU6017II - INSTALAR MEDIDOR POLI-BT', 'Tabela de Preço', true),
  ('SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT', 'Tabela de Preço', true),
  ('SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT', 'Tabela de Preço', true),
  ('SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'SDCLU6016II - INSTALAR MEDIDOR MONO-BT', 'Tabela de Preço', true),
  ('SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT', 'Tabela de Preço', true),
  ('SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT', 'Tabela de Preço', true),
  ('SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT', 'Tabela de Preço', true),
  ('SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Tabela de Preço', true),
  ('SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT', 'Tabela de Preço', true)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- PARTE 4: VINCULAR RETORNOS AO TIPO DE SERVIÇO
-- =====================================================

-- 4.1 Vincular retornos do grupo "Executado"
INSERT INTO public.tipo_servico_retornos (skill_id, retorno_campo_id, ordem, padrao, ativo)
SELECT 
  (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -'),
  rc.id,
  ROW_NUMBER() OVER (ORDER BY rc.codigo) - 1,
  false,
  true
FROM public.retornos_campo rc
WHERE rc.codigo IN ('9506', '9507', '95034', '95035', '95036', '95037', '96021')
ON CONFLICT (skill_id, retorno_campo_id) DO NOTHING;

-- 4.2 Vincular retornos do grupo "Impedimento"
INSERT INTO public.tipo_servico_retornos (skill_id, retorno_campo_id, ordem, padrao, ativo)
SELECT 
  (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -'),
  rc.id,
  100 + ROW_NUMBER() OVER (ORDER BY rc.codigo),
  false,
  true
FROM public.retornos_campo rc
WHERE rc.codigo IN ('96004', '96007', '96017', '96018', '96028', '96029', '96030', '96031')
ON CONFLICT (skill_id, retorno_campo_id) DO NOTHING;

-- =====================================================
-- PARTE 5: VINCULAR ATIVIDADES AOS RETORNOS
-- =====================================================

-- 5.1 Retorno 9506 - POLI para POLI-Multiplas UCs
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  ROW_NUMBER() OVER (ORDER BY a.codigo) - 1
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '9506')
  AND a.codigo IN (
    'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT',
    'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT',
    'SDCLU6017II - INSTALAR MEDIDOR POLI-BT',
    'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT'
  )
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.2 Retorno 9507 - POLI para POLI-Ramal
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  ROW_NUMBER() OVER (ORDER BY a.codigo) - 1
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '9507')
  AND a.codigo IN (
    'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT',
    'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT',
    'SDCLU6017II - INSTALAR MEDIDOR POLI-BT',
    'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT'
  )
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.3 Retorno 95034 - MONO para POLI-Multiplas UCs
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  ROW_NUMBER() OVER (ORDER BY a.codigo) - 1
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '95034')
  AND a.codigo IN (
    'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT',
    'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT',
    'SDCLU6017II - INSTALAR MEDIDOR POLI-BT'
  )
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.4 Retorno 95035 - POLI para MONO-Multiplas UCs
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  ROW_NUMBER() OVER (ORDER BY a.codigo) - 1
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '95035')
  AND a.codigo IN (
    'SDCLU6016II - INSTALAR MEDIDOR MONO-BT',
    'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT'
  )
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.5 Retorno 95036 - MONO para POLI-Ramal (OPCIONAL SELECIONADO)
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'opcional_selecionado',
  1,
  false,
  1,
  ROW_NUMBER() OVER (ORDER BY a.codigo) - 1
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '95036')
  AND a.codigo IN (
    'SDCLU6013RD - RETIRAR RAMAL DE LIG MONO-BT',
    'SDCLU6017II - INSTALAR MEDIDOR POLI-BT',
    'SDCLU6016RD - RETIRAR MEDIDOR MONO-BT',
    'SDCLU6012II - INSTALAR RAMAL DE LIG POLI-BT'
  )
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.6 Retorno 95037 - POLI para MONO-Ramal
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  ROW_NUMBER() OVER (ORDER BY a.codigo) - 1
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '95037')
  AND a.codigo IN (
    'SDCLU6012RD - RETIRAR RAMAL DE LIG POLI-BT',
    'SDCLU6013II - INSTALAR RAMAL DE LIG-MONO-BT',
    'SDCLU6016II - INSTALAR MEDIDOR MONO-BT',
    'SDCLU6017RD - RETIRAR MEDIDOR POLI-BT'
  )
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.7 Retorno 96004 - Impedimento - Deficiencia Tecnica
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  0
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '96004')
  AND a.codigo = 'SDCCU6419SC - SERV NAO EFETUADA DEF TECNICA  PADRAO-BT'
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.8 Retorno 96007 - Impedimento - Local Fechado
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  0
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '96007')
  AND a.codigo = 'SDCLU6020SC - SERV NAO EFETUADO SEM ACESSO PAD-BT'
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.9 Retorno 96017 - Impedimento - Nao Localizado
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  0
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '96017')
  AND a.codigo = 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT'
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.10 Retorno 96018 - Necessario Obra no Local
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  0
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '96018')
  AND a.codigo = 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT'
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.11 Retorno 96021 - Servico Ja Realizado (Coletar Dados) - SEM ATIVIDADE/TABELA DE PREÇO
-- Este retorno não tem atividade vinculada (Tabela de Preço = "-")

-- 5.12 Retorno 96028 - Cliente Ausente
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  0
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '96028')
  AND a.codigo = 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT'
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.13 Retorno 96029 - Cliente Desistiu do Servico
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  0
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '96029')
  AND a.codigo = 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT'
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.14 Retorno 96030 - Apresentar Projeto
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  0
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '96030')
  AND a.codigo = 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT'
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- 5.15 Retorno 96031 - Cadastro Incorreto
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
SELECT 
  tsr.id,
  a.id,
  'obrigatorio',
  1,
  false,
  1,
  0
FROM public.tipo_servico_retornos tsr
CROSS JOIN public.atividades a
WHERE tsr.skill_id = (SELECT id FROM public.skills WHERE codigo = 'ALTERACAO CONTRATUAL -')
  AND tsr.retorno_campo_id = (SELECT id FROM public.retornos_campo WHERE codigo = '96031')
  AND a.codigo = 'SDCCU6420SC - SERV NAO EFETUADO SEM ACESSO PADRAO-BT'
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO UPDATE SET
  situacao = EXCLUDED.situacao,
  quantidade_padrao = EXCLUDED.quantidade_padrao,
  permite_alterar_qtd = EXCLUDED.permite_alterar_qtd,
  qtd_min_fotos = EXCLUDED.qtd_min_fotos;

-- =====================================================
-- PARTE 6: VERIFICAR RESULTADO
-- =====================================================

-- 6.1 Contar retornos vinculados
SELECT 'Retornos vinculados ao ALTERACAO CONTRATUAL -:' as info, COUNT(*) as total
FROM public.tipo_servico_retornos tsr
INNER JOIN public.skills s ON s.id = tsr.skill_id
WHERE s.codigo = 'ALTERACAO CONTRATUAL -';

-- 6.2 Listar retornos com suas atividades
SELECT 
  rc.codigo as codigo_retorno,
  rc.descricao as retorno,
  rc.tipo as grupo,
  a.codigo as tabela_preco,
  tra.situacao,
  tra.quantidade_padrao as qtd_padrao,
  CASE WHEN tra.permite_alterar_qtd THEN 'SIM' ELSE 'NÃO' END as alteracao_pda,
  tra.qtd_min_fotos
FROM public.tipo_servico_retornos tsr
INNER JOIN public.skills s ON s.id = tsr.skill_id
INNER JOIN public.retornos_campo rc ON rc.id = tsr.retorno_campo_id
LEFT JOIN public.tipo_servico_retorno_atividades tra ON tra.tipo_servico_retorno_id = tsr.id
LEFT JOIN public.atividades a ON a.id = tra.atividade_id
WHERE s.codigo = 'ALTERACAO CONTRATUAL -'
ORDER BY rc.tipo, rc.codigo, a.codigo;
