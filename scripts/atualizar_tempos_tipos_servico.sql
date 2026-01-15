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
-- PARTE 2: ATUALIZAR tempos_servico_centro_custo PARA EDIÇÃO MANUAL
-- Para cada tipo de serviço, atualizar tempo_automatico = false
-- em TODOS os registros existentes (todos contratos/centros de custo)
-- =====================================================

-- Atualizar todos os registros existentes para edição manual
UPDATE public.tempos_servico_centro_custo 
SET 
  tempo_automatico = false,
  updated_at = NOW()
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
);

-- Também atualizar os tempos em minutos na tabela tempos_servico_centro_custo
-- para cada skill_codigo (atualiza todos os contratos/centros de custo)

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
