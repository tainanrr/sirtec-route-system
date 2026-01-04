-- Script para atualizar siglas e cores dos tipos de serviço
-- Execute este script no Supabase Dashboard > SQL Editor
-- IMPORTANTE: Execute primeiro o script add_sigla_skills.sql para criar a coluna sigla

-- Grupo Baixa Ped./Verificação (Cinza)
UPDATE public.skills SET sigla = 'BAP', cor = '#9ca3af' WHERE codigo = 'BAIXA A PEDIDO -';
UPDATE public.skills SET sigla = 'VER', cor = '#9ca3af' WHERE codigo = 'VERIFICACAO -';

-- Grupo Cobrança - Baixa ADM (Verde claro)
UPDATE public.skills SET sigla = 'BAA', cor = '#86efac' WHERE codigo = 'BAIXA ADM -';

-- Grupo Cobrança - Cortes (Verde)
UPDATE public.skills SET sigla = 'COA', cor = '#22c55e' WHERE codigo = 'CORTE A -';
UPDATE public.skills SET sigla = 'COB', cor = '#22c55e' WHERE codigo = 'CORTE B -';
UPDATE public.skills SET sigla = 'COC', cor = '#22c55e' WHERE codigo = 'CORTE C -';

-- Grupo Cobrança - Corte Top (Verde fluorescente)
UPDATE public.skills SET sigla = 'COT', cor = '#4ade80' WHERE codigo = 'CORTE TOP25 -';

-- Grupo Cobrança - Recortes (Verde escuro)
UPDATE public.skills SET sigla = 'REA', cor = '#166534' WHERE codigo = 'RECORTE A -';
UPDATE public.skills SET sigla = 'REB', cor = '#166534' WHERE codigo = 'RECORTE B -';
UPDATE public.skills SET sigla = 'REC', cor = '#166534' WHERE codigo = 'RECORTE C -';

-- Grupo Enlace (Azul)
UPDATE public.skills SET sigla = 'E', cor = '#3b82f6' WHERE codigo = 'ENLACE -';

-- Grupo Ligação (Laranja)
UPDATE public.skills SET sigla = 'AC', cor = '#f97316' WHERE codigo = 'ALTERACAO CONTRATUAL -';
UPDATE public.skills SET sigla = 'LN', cor = '#f97316' WHERE codigo = 'LIGACAO NOVA -';
UPDATE public.skills SET sigla = 'LPD', cor = '#f97316' WHERE codigo = 'LIGACAO PROVISORIA DESLIGA -';
UPDATE public.skills SET sigla = 'LPL', cor = '#f97316' WHERE codigo = 'LIGACAO PROVISORIA LIGA -';
UPDATE public.skills SET sigla = 'MOD', cor = '#f97316' WHERE codigo = 'MODIF-DESLIGAR MANUT -';
UPDATE public.skills SET sigla = 'MOD', cor = '#f97316' WHERE codigo = 'MODIF-RELIGAR MANUT -';
UPDATE public.skills SET sigla = 'MOD', cor = '#f97316' WHERE codigo = 'MODIF-RELOCAR MEDIDOR -';
UPDATE public.skills SET sigla = 'MOD', cor = '#f97316' WHERE codigo = 'MODIF-SERVICO RAMAL -';
UPDATE public.skills SET sigla = 'REA', cor = '#f97316' WHERE codigo = 'REATIVACAO -';

-- Grupo Microgeração (Ciano)
UPDATE public.skills SET sigla = 'MIC', cor = '#06b6d4' WHERE codigo = 'MICROGERACAO -';

-- Grupo Religação (Vermelho)
UPDATE public.skills SET sigla = 'RP', cor = '#ef4444' WHERE codigo = 'RELIGA ANALISE PROC. -';
UPDATE public.skills SET sigla = 'RPM', cor = '#ef4444' WHERE codigo = 'RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -';
UPDATE public.skills SET sigla = 'RA', cor = '#ef4444' WHERE codigo = 'RELIGA AUTOMATICA -';
UPDATE public.skills SET sigla = 'RAM', cor = '#ef4444' WHERE codigo = 'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -';
UPDATE public.skills SET sigla = 'RJ', cor = '#ef4444' WHERE codigo = 'RELIGA JUDICIAL -';
UPDATE public.skills SET sigla = 'RJM', cor = '#ef4444' WHERE codigo = 'RELIGA JUDICIAL C/ SUBST. MEDIDOR -';
UPDATE public.skills SET sigla = 'RN', cor = '#ef4444' WHERE codigo = 'RELIGA NORMAL -';
UPDATE public.skills SET sigla = 'RNM', cor = '#ef4444' WHERE codigo = 'RELIGA NORMAL C/ SUBST. MEDIDOR -';

-- Grupo Varredura (Roxo)
UPDATE public.skills SET sigla = 'VAR', cor = '#8b5cf6' WHERE codigo = 'VARREDURA -';

-- Para tipos não listados, gerar sigla automática baseada nas 3 primeiras letras do código
UPDATE public.skills 
SET sigla = UPPER(LEFT(REPLACE(codigo, ' -', ''), 3))
WHERE sigla IS NULL;

-- Verificar resultado
SELECT codigo, nome, sigla, cor, grupo_servico
FROM public.skills
ORDER BY codigo;
