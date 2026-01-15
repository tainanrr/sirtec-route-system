-- Script para atualizar os valores dos tipos de serviço
-- Este script atualiza:
-- 1. O campo 'valor' na tabela public.skills (Valor Previsto padrão)
-- 2. A tabela public.valores_servico_centro_custo (Valores por Unidade - Vitória da Conquista / 4600079169)
-- Todos os valores serão definidos como edição manual (valor_automatico = false)

-- ===========================================
-- PARTE 1: Atualizar campo valor na tabela skills
-- ===========================================

UPDATE public.skills SET valor = 208 WHERE codigo = 'ALTERACAO CONTRATUAL -';
UPDATE public.skills SET valor = 192 WHERE codigo = 'ATENDIMENTO DE OCORRÊNCIA';
UPDATE public.skills SET valor = 48 WHERE codigo = 'BAIXA A PEDIDO -';
UPDATE public.skills SET valor = 55 WHERE codigo = 'BAIXA ADM -';
UPDATE public.skills SET valor = 48 WHERE codigo = 'CORTE A -';
UPDATE public.skills SET valor = 43 WHERE codigo = 'CORTE B -';
UPDATE public.skills SET valor = 54 WHERE codigo = 'CORTE C -';
UPDATE public.skills SET valor = 49 WHERE codigo = 'CORTE TOP25 -';
UPDATE public.skills SET valor = 116 WHERE codigo = 'ENLACE -';
UPDATE public.skills SET valor = 148 WHERE codigo = 'LIGACAO NOVA -';
UPDATE public.skills SET valor = 70 WHERE codigo = 'LIGACAO PROVISORIA DESLIGA -';
UPDATE public.skills SET valor = 204 WHERE codigo = 'LIGACAO PROVISORIA LIGA -';
UPDATE public.skills SET valor = 161 WHERE codigo = 'MICROGERAÇÃO -';
UPDATE public.skills SET valor = 31 WHERE codigo = 'MODIF-DESLIGAR MANUT -';
UPDATE public.skills SET valor = 185 WHERE codigo = 'MODIF-RELIGAR MANUT -';
UPDATE public.skills SET valor = 219 WHERE codigo = 'MODIF-RELOCAR MEDIDOR -';
UPDATE public.skills SET valor = 108 WHERE codigo = 'MODIF-SERVICO RAMAL -';
UPDATE public.skills SET valor = 137 WHERE codigo = 'REATIVACAO -';
UPDATE public.skills SET valor = 50 WHERE codigo = 'RECORTE A -';
UPDATE public.skills SET valor = 56 WHERE codigo = 'RECORTE B -';
UPDATE public.skills SET valor = 56 WHERE codigo = 'RECORTE C -';
UPDATE public.skills SET valor = 60 WHERE codigo = 'RELIGA ANALISE PROC. -';
UPDATE public.skills SET valor = 91 WHERE codigo = 'RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -';
UPDATE public.skills SET valor = 53 WHERE codigo = 'RELIGA AUTOMATICA -';
UPDATE public.skills SET valor = 91 WHERE codigo = 'RELIGA AUTOMATICA C/ SUBST. MEDIDOR -';
UPDATE public.skills SET valor = 78 WHERE codigo = 'RELIGA JUDICIAL -';
UPDATE public.skills SET valor = 159 WHERE codigo = 'RELIGA JUDICIAL C/ SUBST. MEDIDOR -';
UPDATE public.skills SET valor = 52 WHERE codigo = 'RELIGA NORMAL -';
UPDATE public.skills SET valor = 107 WHERE codigo = 'RELIGA NORMAL C/ SUBST. MEDIDOR -';
UPDATE public.skills SET valor = 476 WHERE codigo = 'VARREDURA -';
UPDATE public.skills SET valor = 53 WHERE codigo = 'VERIFICACAO -';

-- ===========================================
-- PARTE 2: Inserir/Atualizar valores na tabela valores_servico_centro_custo
-- Centro de Custo: Vitória da Conquista
-- Contrato: 4600079169
-- Modo: Edição manual (valor_automatico = false)
-- ===========================================

-- Inserir ou atualizar registros para cada tipo de serviço
INSERT INTO public.valores_servico_centro_custo (skill_codigo, contrato_id, centro_custo_id, valor, valor_automatico, qtd_amostras)
SELECT 
    dados.skill_codigo,
    c.id as contrato_id,
    cc.id as centro_custo_id,
    dados.valor,
    false as valor_automatico,
    0 as qtd_amostras
FROM (VALUES
    ('ALTERACAO CONTRATUAL -', 208),
    ('ATENDIMENTO DE OCORRÊNCIA', 192),
    ('BAIXA A PEDIDO -', 48),
    ('BAIXA ADM -', 55),
    ('CORTE A -', 48),
    ('CORTE B -', 43),
    ('CORTE C -', 54),
    ('CORTE TOP25 -', 49),
    ('ENLACE -', 116),
    ('LIGACAO NOVA -', 148),
    ('LIGACAO PROVISORIA DESLIGA -', 70),
    ('LIGACAO PROVISORIA LIGA -', 204),
    ('MICROGERAÇÃO -', 161),
    ('MODIF-DESLIGAR MANUT -', 31),
    ('MODIF-RELIGAR MANUT -', 185),
    ('MODIF-RELOCAR MEDIDOR -', 219),
    ('MODIF-SERVICO RAMAL -', 108),
    ('REATIVACAO -', 137),
    ('RECORTE A -', 50),
    ('RECORTE B -', 56),
    ('RECORTE C -', 56),
    ('RELIGA ANALISE PROC. -', 60),
    ('RELIGA ANALISE PROC. C/ SUBST. MEDIDOR -', 91),
    ('RELIGA AUTOMATICA -', 53),
    ('RELIGA AUTOMATICA C/ SUBST. MEDIDOR -', 91),
    ('RELIGA JUDICIAL -', 78),
    ('RELIGA JUDICIAL C/ SUBST. MEDIDOR -', 159),
    ('RELIGA NORMAL -', 52),
    ('RELIGA NORMAL C/ SUBST. MEDIDOR -', 107),
    ('VARREDURA -', 476),
    ('VERIFICACAO -', 53)
) AS dados(skill_codigo, valor)
CROSS JOIN (SELECT id FROM public.contratos WHERE codigo = '4600079169') c
CROSS JOIN (SELECT id FROM public.centros_custo WHERE nome = 'Vitória da Conquista') cc
ON CONFLICT (skill_codigo, contrato_id, centro_custo_id) 
DO UPDATE SET
    valor = EXCLUDED.valor,
    valor_automatico = EXCLUDED.valor_automatico,
    ultima_atualizacao = NOW(),
    updated_at = NOW();

-- ===========================================
-- VERIFICAÇÃO: Consultar os registros atualizados
-- ===========================================

-- Verificar valores na tabela skills
SELECT codigo, nome, valor
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

-- Verificar registros na tabela valores_servico_centro_custo
SELECT 
    v.skill_codigo,
    v.valor,
    v.valor_automatico,
    c.codigo as contrato_codigo,
    cc.nome as centro_custo_nome
FROM public.valores_servico_centro_custo v
INNER JOIN public.contratos c ON c.id = v.contrato_id
INNER JOIN public.centros_custo cc ON cc.id = v.centro_custo_id
WHERE c.codigo = '4600079169'
  AND cc.nome = 'Vitória da Conquista'
ORDER BY v.skill_codigo;
