-- Adicionar campo para observações da equipe
-- O campo 'observacoes' existente será considerado como "Observações Coelba" (do sistema/importação)
-- O novo campo 'observacoes_equipe' será para observações inseridas pela equipe em campo

ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS observacoes_equipe TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.ordens_servico.observacoes IS 'Observações da Coelba/Sistema (importação ou cadastro)';
COMMENT ON COLUMN public.ordens_servico.observacoes_equipe IS 'Observações da equipe de campo';

-- Índice para buscas por observações (opcional)
-- CREATE INDEX IF NOT EXISTS idx_ordens_servico_obs_equipe ON public.ordens_servico(observacoes_equipe) WHERE observacoes_equipe IS NOT NULL;













