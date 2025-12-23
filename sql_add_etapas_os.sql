-- Adicionar campos de etapas na tabela ordens_servico
-- Execute este SQL no Supabase SQL Editor

-- Adicionar campos de timestamp para cada etapa do serviço
ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS deslocamento_iniciado_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS chegada_local_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS execucao_iniciada_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pausado_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tempo_execucao_minutos INTEGER;

-- Adicionar índice para status (para queries mais rápidas)
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON public.ordens_servico(status);

-- Comentários para documentação
COMMENT ON COLUMN public.ordens_servico.deslocamento_iniciado_at IS 'Data/hora que o técnico iniciou o deslocamento';
COMMENT ON COLUMN public.ordens_servico.chegada_local_at IS 'Data/hora que o técnico chegou no local';
COMMENT ON COLUMN public.ordens_servico.execucao_iniciada_at IS 'Data/hora que o técnico iniciou a execução do serviço';
COMMENT ON COLUMN public.ordens_servico.pausado_at IS 'Data/hora da última pausa';
COMMENT ON COLUMN public.ordens_servico.tempo_execucao_minutos IS 'Tempo total de execução em minutos (do início do serviço até conclusão)';


-- Execute este SQL no Supabase SQL Editor

-- Adicionar campos de timestamp para cada etapa do serviço
ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS deslocamento_iniciado_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS chegada_local_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS execucao_iniciada_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pausado_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tempo_execucao_minutos INTEGER;

-- Adicionar índice para status (para queries mais rápidas)
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON public.ordens_servico(status);

-- Comentários para documentação
COMMENT ON COLUMN public.ordens_servico.deslocamento_iniciado_at IS 'Data/hora que o técnico iniciou o deslocamento';
COMMENT ON COLUMN public.ordens_servico.chegada_local_at IS 'Data/hora que o técnico chegou no local';
COMMENT ON COLUMN public.ordens_servico.execucao_iniciada_at IS 'Data/hora que o técnico iniciou a execução do serviço';
COMMENT ON COLUMN public.ordens_servico.pausado_at IS 'Data/hora da última pausa';
COMMENT ON COLUMN public.ordens_servico.tempo_execucao_minutos IS 'Tempo total de execução em minutos (do início do serviço até conclusão)';








