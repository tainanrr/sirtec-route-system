-- ===========================================
-- Script para atribuir ícones e cores para cada tipo de serviço (skill)
-- ===========================================

-- Atualizar ícones para cada tipo de serviço
UPDATE public.skills SET icone = 'FileText', cor = '#6366f1' WHERE nome ILIKE '%Alteração Contratual%';
UPDATE public.skills SET icone = 'FileX', cor = '#ef4444' WHERE nome ILIKE '%Baixa a Pedido%';
UPDATE public.skills SET icone = 'FileX2', cor = '#dc2626' WHERE nome ILIKE '%Baixa ADM%';

-- Cortes
UPDATE public.skills SET icone = 'Power', cor = '#ef4444' WHERE nome ILIKE '%Corte A%';
UPDATE public.skills SET icone = 'PowerOff', cor = '#dc2626' WHERE nome ILIKE '%Corte B%';
UPDATE public.skills SET icone = 'Scissors', cor = '#b91c1c' WHERE nome ILIKE '%Corte C%';
UPDATE public.skills SET icone = 'AlertTriangle', cor = '#f97316' WHERE nome ILIKE '%Corte Top25%';

-- Enlace e Ligações
UPDATE public.skills SET icone = 'Link', cor = '#8b5cf6' WHERE nome ILIKE '%Enlace%';
UPDATE public.skills SET icone = 'Plug', cor = '#22c55e' WHERE nome ILIKE '%Ligacao Nova%' OR nome ILIKE '%Ligação Nova%';
UPDATE public.skills SET icone = 'PlugZap', cor = '#84cc16' WHERE nome ILIKE '%Ligacao Provisoria Liga%' OR nome ILIKE '%Ligação Provisória Liga%';
UPDATE public.skills SET icone = 'Unplug', cor = '#eab308' WHERE nome ILIKE '%Ligacao Provisoria Desliga%' OR nome ILIKE '%Ligação Provisória Desliga%';

-- Microgeração
UPDATE public.skills SET icone = 'Sun', cor = '#f59e0b' WHERE nome ILIKE '%Microgeração%' OR nome ILIKE '%Microgeracao%';

-- Modificações
UPDATE public.skills SET icone = 'Wrench', cor = '#0ea5e9' WHERE nome ILIKE '%Modif-Desligar Manut%';
UPDATE public.skills SET icone = 'WrenchIcon', cor = '#0284c7' WHERE nome ILIKE '%Modif-Religar Manut%';
UPDATE public.skills SET icone = 'Move', cor = '#06b6d4' WHERE nome ILIKE '%Modif-Relocar Medidor%';
UPDATE public.skills SET icone = 'Cable', cor = '#14b8a6' WHERE nome ILIKE '%Modif-Servico Ramal%' OR nome ILIKE '%Modif-Serviço Ramal%';

-- Reativação
UPDATE public.skills SET icone = 'RefreshCw', cor = '#10b981' WHERE nome ILIKE '%Reativação%' OR nome ILIKE '%Reativacao%';

-- Recortes
UPDATE public.skills SET icone = 'Repeat', cor = '#f43f5e' WHERE nome ILIKE '%Recorte A%';
UPDATE public.skills SET icone = 'Repeat1', cor = '#e11d48' WHERE nome ILIKE '%Recorte B%';
UPDATE public.skills SET icone = 'Repeat2', cor = '#be123c' WHERE nome ILIKE '%Recorte C%';

-- Religações
UPDATE public.skills SET icone = 'Zap', cor = '#22c55e' WHERE nome ILIKE '%Religa Análise Proc.%' AND nome NOT ILIKE '%Subst%';
UPDATE public.skills SET icone = 'ZapOff', cor = '#16a34a' WHERE nome ILIKE '%Religa Análise Proc.%' AND nome ILIKE '%Subst%';
UPDATE public.skills SET icone = 'BatteryCharging', cor = '#4ade80' WHERE nome ILIKE '%Religa Automática%' AND nome NOT ILIKE '%Subst%';
UPDATE public.skills SET icone = 'Battery', cor = '#22c55e' WHERE nome ILIKE '%Religa Automática%' AND nome ILIKE '%Subst%';
UPDATE public.skills SET icone = 'Scale', cor = '#3b82f6' WHERE nome ILIKE '%Religa Judicial%' AND nome NOT ILIKE '%Subst%';
UPDATE public.skills SET icone = 'Gavel', cor = '#2563eb' WHERE nome ILIKE '%Religa Judicial%' AND nome ILIKE '%Subst%';
UPDATE public.skills SET icone = 'PlugZap2', cor = '#10b981' WHERE nome ILIKE '%Religa Normal%' AND nome NOT ILIKE '%Subst%';
UPDATE public.skills SET icone = 'Replace', cor = '#059669' WHERE nome ILIKE '%Religa Normal%' AND nome ILIKE '%Subst%';

-- Varredura e Verificação
UPDATE public.skills SET icone = 'ScanSearch', cor = '#8b5cf6' WHERE nome ILIKE '%Varredura%';
UPDATE public.skills SET icone = 'Search', cor = '#6366f1' WHERE nome ILIKE '%Verificação%' OR nome ILIKE '%Verificacao%';

-- Verificar resultado
SELECT 
  codigo,
  nome,
  icone,
  cor
FROM public.skills 
WHERE ativo = true
ORDER BY nome;

