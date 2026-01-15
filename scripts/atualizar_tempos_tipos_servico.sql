-- Script para atualizar Tempo de Execução Previsto dos Tipos de Serviço
-- Execute este script no SQL Editor do Supabase
-- Data: 15/01/2026

-- =====================================================
-- PARTE 1: ATUALIZAR tempo_execucao_minutos NA TABELA skills
-- =====================================================

UPDATE public.skills SET tempo_execucao_minutos = 52 WHERE codigo = 'ALTERACAO CONTRATUAL -';
UPDATE public.skills SET tempo_execucao_minutos = 22 WHERE codigo = 'ATENDIMENTO DE OCORRÊNCIA';
UPDATE public.skills SET tempo_execucao_minutos = 17 WHERE codigo = 'BAIXA A PEDIDO -';
UPDATE public.skills SET tempo_execucao_minutos = 17 WHERE codigo = 'BAIXA ADM -';
UPDATE public.skills SET tempo_execucao_minutos = 10 WHERE codigo = 'CORTE A -';
UPDATE public.skills SET tempo_execucao_minutos = 8 WHERE codigo = 'CORTE B -';
UPDATE public.skills SET tempo_execucao_minutos = 9 WHERE codigo = 'CORTE C -';
UPDATE public.skills SET tempo_execucao_minutos = 9 WHERE codigo = 'CORTE TOP25 -';
UPDATE public.skills SET tempo_execucao_minutos = 13 WHERE codigo = 'ENLACE -';
UPDATE public.skills SET tempo_execucao_minutos = 37 WHERE codigo = 'LIGACAO NOVA -';
UPDATE public.skills SET tempo_execucao_minutos = 22 WHERE codigo = 'LIGACAO PROVISORIA DESLIGA -';
UPDATE public.skills SET tempo_execucao_minutos = 41 WHERE codigo = 'LIGACAO PROVISORIA LIGA -';
UPDATE public.skills SET tempo_execucao_minutos = 16 WHERE codigo = 'MICROGERAÇÃO -';
UPDATE public.skills SET tempo_execucao_minutos = 19 WHERE codigo = 'MODIF-DESLIGAR MANUT -';
UPDATE public.skills SET tempo_execucao_minutos = 30 WHERE codigo = 'MODIF-RELIGAR MANUT -';
UPDATE public.skills SET tempo_execucao_minutos = 47 WHERE codigo = 'MODIF-RELOCAR MEDIDOR -';
UPDATE public.skills SET tempo_execucao_minutos = 67 WHERE codigo = 'MODIF-SERVICO RAMAL -';
UPDATE public.skills SET tempo_execucao_minutos = 31 WHERE codigo = 'REATIVACAO -';
UPDATE public.skills SET tempo_execucao_minutos = 12 WHERE codigo = 'RECORTE A -';
UPDATE public.skills SET tempo_execucao_minutos = 10 WHERE codigo = 'RECORTE B -';
UPDATE public.skills SET tempo_execucao_minutos = 11 WHERE codigo = 'RECORTE C -';
UPDATE public.skills SET tempo_execucao_minutos = 16 WHERE codigo = 'RELIGA ANALISE PROC. -';
UPDATE public.skills SET tempo_execucao_minutos = 15 WHERE codigo = 'RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -';
UPDATE public.skills SET tempo_execucao_minutos = 13 WHERE codigo = 'RELIGA AUTOMATICA -';
UPDATE public.skills SET tempo_execucao_minutos = 15 WHERE codigo = 'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -';
UPDATE public.skills SET tempo_execucao_minutos = 24 WHERE codigo = 'RELIGA JUDICIAL -';
UPDATE public.skills SET tempo_execucao_minutos = 14 WHERE codigo = 'RELIGA JUDICIAL C/ SUBST. MEDIDOR -';
UPDATE public.skills SET tempo_execucao_minutos = 13 WHERE codigo = 'RELIGA NORMAL -';
UPDATE public.skills SET tempo_execucao_minutos = 16 WHERE codigo = 'RELIGA NORMAL C/ SUBST. MEDIDOR -';
UPDATE public.skills SET tempo_execucao_minutos = 54 WHERE codigo = 'VARREDURA -';
UPDATE public.skills SET tempo_execucao_minutos = 16 WHERE codigo = 'VERIFICACAO -';

-- =====================================================
-- PARTE 2: CADASTRAR tempos_servico_centro_custo PARA EDIÇÃO MANUAL
-- Cadastrar tempos fixos para Centro de Custo "Vitória da Conquista" 
-- no Contrato "4600079169" - criando registros se não existirem
-- =====================================================

-- Inserir ou atualizar tempos para Vitória da Conquista / Contrato 4600079169
-- Usando INSERT ... ON CONFLICT para fazer upsert

INSERT INTO public.tempos_servico_centro_custo (skill_codigo, contrato_id, centro_custo_id, tempo_minutos, tempo_automatico, qtd_amostras)
SELECT 
  dados.skill_codigo,
  c.id as contrato_id,
  cc.id as centro_custo_id,
  dados.tempo_minutos,
  false as tempo_automatico,
  0 as qtd_amostras
FROM (
  VALUES
    ('ALTERACAO CONTRATUAL -', 52),
    ('ATENDIMENTO DE OCORRÊNCIA', 22),
    ('BAIXA A PEDIDO -', 17),
    ('BAIXA ADM -', 17),
    ('CORTE A -', 10),
    ('CORTE B -', 8),
    ('CORTE C -', 9),
    ('CORTE TOP25 -', 9),
    ('ENLACE -', 13),
    ('LIGACAO NOVA -', 37),
    ('LIGACAO PROVISORIA DESLIGA -', 22),
    ('LIGACAO PROVISORIA LIGA -', 41),
    ('MICROGERAÇÃO -', 16),
    ('MODIF-DESLIGAR MANUT -', 19),
    ('MODIF-RELIGAR MANUT -', 30),
    ('MODIF-RELOCAR MEDIDOR -', 47),
    ('MODIF-SERVICO RAMAL -', 67),
    ('REATIVACAO -', 31),
    ('RECORTE A -', 12),
    ('RECORTE B -', 10),
    ('RECORTE C -', 11),
    ('RELIGA ANALISE PROC. -', 16),
    ('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', 15),
    ('RELIGA AUTOMATICA -', 13),
    ('RELIGA AUTOMATICA C/ SUBST. MEDIDOR -', 15),
    ('RELIGA JUDICIAL -', 24),
    ('RELIGA JUDICIAL C/ SUBST. MEDIDOR -', 14),
    ('RELIGA NORMAL -', 13),
    ('RELIGA NORMAL C/ SUBST. MEDIDOR -', 16),
    ('VARREDURA -', 54),
    ('VERIFICACAO -', 16)
) AS dados(skill_codigo, tempo_minutos)
CROSS JOIN (SELECT id FROM public.contratos WHERE numero = '4600079169') c
CROSS JOIN (SELECT id FROM public.centros_custo WHERE nome ILIKE '%Vitória da Conquista%' OR nome ILIKE '%Vitoria da Conquista%') cc
ON CONFLICT (skill_codigo, contrato_id, centro_custo_id) 
DO UPDATE SET 
  tempo_minutos = EXCLUDED.tempo_minutos,
  tempo_automatico = false,
  updated_at = NOW();

-- Também atualizar registros existentes em outros contratos/centros de custo
-- para manter consistência (opcional)
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 52, tempo_automatico = false WHERE skill_codigo = 'ALTERACAO CONTRATUAL -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 22, tempo_automatico = false WHERE skill_codigo = 'ATENDIMENTO DE OCORRÊNCIA';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 17, tempo_automatico = false WHERE skill_codigo = 'BAIXA A PEDIDO -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 17, tempo_automatico = false WHERE skill_codigo = 'BAIXA ADM -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 10, tempo_automatico = false WHERE skill_codigo = 'CORTE A -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 8, tempo_automatico = false WHERE skill_codigo = 'CORTE B -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 9, tempo_automatico = false WHERE skill_codigo = 'CORTE C -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 9, tempo_automatico = false WHERE skill_codigo = 'CORTE TOP25 -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 13, tempo_automatico = false WHERE skill_codigo = 'ENLACE -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 37, tempo_automatico = false WHERE skill_codigo = 'LIGACAO NOVA -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 22, tempo_automatico = false WHERE skill_codigo = 'LIGACAO PROVISORIA DESLIGA -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 41, tempo_automatico = false WHERE skill_codigo = 'LIGACAO PROVISORIA LIGA -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 16, tempo_automatico = false WHERE skill_codigo = 'MICROGERAÇÃO -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 19, tempo_automatico = false WHERE skill_codigo = 'MODIF-DESLIGAR MANUT -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 30, tempo_automatico = false WHERE skill_codigo = 'MODIF-RELIGAR MANUT -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 47, tempo_automatico = false WHERE skill_codigo = 'MODIF-RELOCAR MEDIDOR -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 67, tempo_automatico = false WHERE skill_codigo = 'MODIF-SERVICO RAMAL -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 31, tempo_automatico = false WHERE skill_codigo = 'REATIVACAO -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 12, tempo_automatico = false WHERE skill_codigo = 'RECORTE A -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 10, tempo_automatico = false WHERE skill_codigo = 'RECORTE B -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 11, tempo_automatico = false WHERE skill_codigo = 'RECORTE C -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 16, tempo_automatico = false WHERE skill_codigo = 'RELIGA ANALISE PROC. -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 15, tempo_automatico = false WHERE skill_codigo = 'RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 13, tempo_automatico = false WHERE skill_codigo = 'RELIGA AUTOMATICA -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 15, tempo_automatico = false WHERE skill_codigo = 'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 24, tempo_automatico = false WHERE skill_codigo = 'RELIGA JUDICIAL -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 14, tempo_automatico = false WHERE skill_codigo = 'RELIGA JUDICIAL C/ SUBST. MEDIDOR -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 13, tempo_automatico = false WHERE skill_codigo = 'RELIGA NORMAL -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 16, tempo_automatico = false WHERE skill_codigo = 'RELIGA NORMAL C/ SUBST. MEDIDOR -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 54, tempo_automatico = false WHERE skill_codigo = 'VARREDURA -';
UPDATE public.tempos_servico_centro_custo SET tempo_minutos = 16, tempo_automatico = false WHERE skill_codigo = 'VERIFICACAO -';

-- =====================================================
-- PARTE 3: VERIFICAÇÃO FINAL
-- =====================================================

-- Verificar tempo de execução na tabela skills
SELECT 
  codigo,
  nome,
  tempo_execucao_minutos
FROM public.skills
WHERE codigo IN (
  'ALTERACAO CONTRATUAL -',
  'ATENDIMENTO DE OCORRÊNCIA',
  'BAIXA A PEDIDO -',
  'BAIXA ADM -',
  'CORTE A -',
  'CORTE B -',
  'CORTE C -',
  'CORTE TOP25 -',
  'ENLACE -',
  'LIGACAO NOVA -',
  'LIGACAO PROVISORIA DESLIGA -',
  'LIGACAO PROVISORIA LIGA -',
  'MICROGERAÇÃO -',
  'MODIF-DESLIGAR MANUT -',
  'MODIF-RELIGAR MANUT -',
  'MODIF-RELOCAR MEDIDOR -',
  'MODIF-SERVICO RAMAL -',
  'REATIVACAO -',
  'RECORTE A -',
  'RECORTE B -',
  'RECORTE C -',
  'RELIGA ANALISE PROC. -',
  'RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -',
  'RELIGA AUTOMATICA -',
  'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -',
  'RELIGA JUDICIAL -',
  'RELIGA JUDICIAL C/ SUBST. MEDIDOR -',
  'RELIGA NORMAL -',
  'RELIGA NORMAL C/ SUBST. MEDIDOR -',
  'VARREDURA -',
  'VERIFICACAO -'
)
ORDER BY codigo;

-- Verificar tempos por centro de custo (modo manual)
SELECT 
  skill_codigo,
  tempo_minutos,
  tempo_automatico,
  COUNT(*) as qtd_registros
FROM public.tempos_servico_centro_custo
WHERE skill_codigo IN (
  'ALTERACAO CONTRATUAL -',
  'ATENDIMENTO DE OCORRÊNCIA',
  'BAIXA A PEDIDO -',
  'BAIXA ADM -',
  'CORTE A -',
  'CORTE B -',
  'CORTE C -',
  'CORTE TOP25 -',
  'ENLACE -',
  'LIGACAO NOVA -',
  'LIGACAO PROVISORIA DESLIGA -',
  'LIGACAO PROVISORIA LIGA -',
  'MICROGERAÇÃO -',
  'MODIF-DESLIGAR MANUT -',
  'MODIF-RELIGAR MANUT -',
  'MODIF-RELOCAR MEDIDOR -',
  'MODIF-SERVICO RAMAL -',
  'REATIVACAO -',
  'RECORTE A -',
  'RECORTE B -',
  'RECORTE C -',
  'RELIGA ANALISE PROC. -',
  'RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -',
  'RELIGA AUTOMATICA -',
  'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -',
  'RELIGA JUDICIAL -',
  'RELIGA JUDICIAL C/ SUBST. MEDIDOR -',
  'RELIGA NORMAL -',
  'RELIGA NORMAL C/ SUBST. MEDIDOR -',
  'VARREDURA -',
  'VERIFICACAO -'
)
GROUP BY skill_codigo, tempo_minutos, tempo_automatico
ORDER BY skill_codigo;

-- FIM DO SCRIPT
