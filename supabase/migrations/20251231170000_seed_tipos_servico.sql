-- Migration: Cadastro massivo de Tipos de Serviço (Skills)
-- Data: 31/12/2025

-- Primeiro, desativar os tipos antigos que serão substituídos
UPDATE public.skills SET ativo = false WHERE codigo IN ('CORTE', 'RELIGA', 'INSPEÇÃO');

-- Inserir novos tipos de serviço
INSERT INTO public.skills (codigo, nome, tempo_execucao_minutos, permite_avulso, regulada, ativo, grupo_servico, valor) VALUES
-- Grupo: Ligação
('ALTERACAO CONTRATUAL -', 'Alteração Contratual', 90, false, true, true, 'Ligação', 194.64),
('LIGACAO NOVA -', 'Ligacao Nova', 80, false, true, true, 'Ligação', 131.37),
('LIGACAO PROVISORIA DESLIGA -', 'Ligacao Provisoria Desliga', 80, false, true, true, 'Ligação', 37.16),
('LIGACAO PROVISORIA LIGA -', 'Ligacao Provisoria Liga', 80, false, true, true, 'Ligação', 180.98),
('MODIF-DESLIGAR MANUT -', 'Modif-Desligar Manut', 35, false, true, true, 'Ligação', 31.82),
('MODIF-RELOCAR MEDIDOR -', 'Modif-Relocar Medidor', 42, false, true, true, 'Ligação', 189.37),
('MODIF-SERVICO RAMAL -', 'Modif-Servico Ramal', 42, false, true, true, 'Ligação', 93.90),
('MODIF-RELIGAR MANUT -', 'Modif-Religar Manut', 42, false, true, true, 'Ligação', 70.55),
('REATIVACAO -', 'Reativação', 31, false, true, true, 'Ligação', 120.96),

-- Grupo: Cobrança
('BAIXA ADM -', 'Baixa ADM', 25, false, false, true, 'Cobrança', 41.74),
('CORTE A -', 'Corte A', 20, false, false, true, 'Cobrança', 56.73),
('CORTE B -', 'Corte B', 20, false, false, true, 'Cobrança', 61.68),
('CORTE C -', 'Corte C', 20, false, false, true, 'Cobrança', 64.72),
('CORTE TOP25 -', 'Corte Top25', 20, false, false, true, 'Cobrança', 54.98),
('RECORTE A -', 'Recorte A', 15, false, false, true, 'Cobrança', 61.35),
('RECORTE B -', 'Recorte B', 15, false, false, true, 'Cobrança', 63.48),
('RECORTE C -', 'Recorte C', 15, false, false, true, 'Cobrança', 64.54),

-- Grupo: Baixa Ped./Verificação
('BAIXA A PEDIDO -', 'Baixa a Pedido', 25, false, true, true, 'Baixa Ped./Verificação', 52.71),
('VERIFICACAO -', 'Verificação', 14, false, true, true, 'Baixa Ped./Verificação', 52.13),

-- Grupo: Religação
('RELIGA ANALISE PROC. -', 'Religa Análise Proc.', 13, false, true, true, 'Religação', 74.54),
('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', 'Religa Análise Proc. C/ Subst. Medidor', 13, false, true, true, 'Religação', 132.75),
('RELIGA AUTOMATICA -', 'Religa Automática', 13, false, true, true, 'Religação', 52.25),
('RELIGA AUTOMATICA C/ SUBST. MEDIDOR -', 'Religa Automática C/ Subst. Medidor', 13, false, true, true, 'Religação', 82.77),
('RELIGA JUDICIAL -', 'Religa Judicial', 13, false, true, true, 'Religação', 54.86),
('RELIGA JUDICIAL C/ SUBST. MEDIDOR -', 'Religa Judicial C/ Subst. Medidor', 13, false, true, true, 'Religação', 159.43),
('RELIGA NORMAL -', 'Religa Normal', 13, false, true, true, 'Religação', 55.34),
('RELIGA NORMAL C/ SUBST. MEDIDOR -', 'Religa Normal C/ Subst. Medidor', 13, false, true, true, 'Religação', 132.75),

-- Grupo: Enlace
('ENLACE -', 'Enlace', 16, false, false, true, 'Enlace', 122.46),

-- Grupo: Microgeração
('MICROGERAÇÃO -', 'Microgeração', 17, false, true, true, 'Microgeração', 144.40),

-- Grupo: Varredura (único com permite_avulso = true)
('VARREDURA -', 'Varredura', 85, true, false, true, 'Varredura', 479.02)

ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  tempo_execucao_minutos = EXCLUDED.tempo_execucao_minutos,
  permite_avulso = EXCLUDED.permite_avulso,
  regulada = EXCLUDED.regulada,
  ativo = EXCLUDED.ativo,
  grupo_servico = EXCLUDED.grupo_servico,
  valor = EXCLUDED.valor;

-- Comentário sobre os tipos com "Regulada = Parcial"
-- BAIXA A PEDIDO e VERIFICACAO foram marcados como regulada = true
-- pois o campo é boolean. Se necessário um terceiro estado, 
-- seria preciso alterar a coluna para tipo enum ou varchar.

