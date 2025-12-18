-- Melhor rastreabilidade: vincular movimentações ao recebimento
ALTER TABLE public.materiais_movimentacoes
ADD COLUMN IF NOT EXISTS recebimento_id UUID REFERENCES public.materiais_recebimentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_materiais_movimentacoes_recebimento_id
  ON public.materiais_movimentacoes (recebimento_id);


