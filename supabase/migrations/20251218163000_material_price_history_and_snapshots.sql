-- Histórico de preços e snapshots de valor em recebimentos/movimentações

-- 1) Histórico de preço por material
CREATE TABLE IF NOT EXISTS public.materiais_precos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
  valor_unitario_anterior NUMERIC(12,2),
  valor_unitario_novo NUMERIC(12,2) NOT NULL,
  origem TEXT NOT NULL DEFAULT 'sistema', -- 'catalogo', 'recebimento', etc.
  referencia TEXT, -- opcional: id/documento do recebimento, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_materiais_precos_historico_material_id_created_at
  ON public.materiais_precos_historico (material_id, created_at DESC);

ALTER TABLE public.materiais_precos_historico ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_precos_historico'
      AND policyname = 'Authenticated users can view materiais_precos_historico'
  ) THEN
    CREATE POLICY "Authenticated users can view materiais_precos_historico"
    ON public.materiais_precos_historico FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_precos_historico'
      AND policyname = 'Authenticated users can manage materiais_precos_historico'
  ) THEN
    CREATE POLICY "Authenticated users can manage materiais_precos_historico"
    ON public.materiais_precos_historico FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 2) Função RPC para atualizar preço atual e registrar histórico (uso pelo catálogo e recebimentos)
CREATE OR REPLACE FUNCTION public.update_material_price(
  p_material_id UUID,
  p_valor_unitario NUMERIC,
  p_origem TEXT DEFAULT 'sistema',
  p_referencia TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old NUMERIC(12,2);
BEGIN
  SELECT valor_unitario INTO v_old
  FROM public.materiais
  WHERE id = p_material_id
  FOR UPDATE;

  IF v_old IS DISTINCT FROM p_valor_unitario THEN
    INSERT INTO public.materiais_precos_historico (
      material_id,
      valor_unitario_anterior,
      valor_unitario_novo,
      origem,
      referencia,
      created_by
    ) VALUES (
      p_material_id,
      v_old,
      p_valor_unitario,
      COALESCE(p_origem, 'sistema'),
      p_referencia,
      auth.uid()
    );

    UPDATE public.materiais
    SET valor_unitario = p_valor_unitario
    WHERE id = p_material_id;
  END IF;
END;
$$;

-- 3) Snapshot de valor em movimentações (para não depender do valor atual do catálogo)
ALTER TABLE public.materiais_movimentacoes
ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS valor_total NUMERIC(14,2);

-- Backfill (congela valor_unitario atual para movimentações antigas; evita mudar no futuro)
UPDATE public.materiais_movimentacoes mm
SET valor_unitario = m.valor_unitario
FROM public.materiais m
WHERE mm.valor_unitario IS NULL
  AND mm.material_id = m.id;

UPDATE public.materiais_movimentacoes mm
SET valor_total = (mm.quantidade * mm.valor_unitario)
WHERE mm.valor_total IS NULL
  AND mm.valor_unitario IS NOT NULL;

-- 4) Snapshot de valor no item do recebimento (pendente/finalizado)
ALTER TABLE public.materiais_recebimentos_itens
ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC(12,2);

UPDATE public.materiais_recebimentos_itens ri
SET valor_unitario = m.valor_unitario
FROM public.materiais m
WHERE ri.valor_unitario IS NULL
  AND ri.material_id = m.id;


