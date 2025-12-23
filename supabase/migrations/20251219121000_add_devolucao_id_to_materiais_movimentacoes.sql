-- Vincular movimentações à devolução (para auditoria/export)
ALTER TABLE public.materiais_movimentacoes
ADD COLUMN IF NOT EXISTS devolucao_id UUID
REFERENCES public.materiais_devolucoes(id)
ON DELETE SET NULL;






