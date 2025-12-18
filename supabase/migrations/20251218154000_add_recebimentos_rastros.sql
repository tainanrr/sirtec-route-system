-- Suporte a materiais com rastro (número de série) em recebimentos:
-- armazena quais rastros pertencem a cada item do recebimento.

CREATE TABLE IF NOT EXISTS public.materiais_recebimentos_itens_rastros (
  recebimento_id UUID NOT NULL REFERENCES public.materiais_recebimentos(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materiais(id),
  numero_serie TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (recebimento_id, material_id, numero_serie)
);

CREATE INDEX IF NOT EXISTS idx_materiais_receb_rec_mat
  ON public.materiais_recebimentos_itens_rastros (recebimento_id, material_id);

CREATE INDEX IF NOT EXISTS idx_materiais_receb_rastros_numero_serie
  ON public.materiais_recebimentos_itens_rastros (numero_serie);

ALTER TABLE public.materiais_recebimentos_itens_rastros ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_recebimentos_itens_rastros'
      AND policyname = 'Authenticated users can view materiais_recebimentos_itens_rastros'
  ) THEN
    CREATE POLICY "Authenticated users can view materiais_recebimentos_itens_rastros"
    ON public.materiais_recebimentos_itens_rastros FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_recebimentos_itens_rastros'
      AND policyname = 'Authenticated users can manage materiais_recebimentos_itens_rastros'
  ) THEN
    CREATE POLICY "Authenticated users can manage materiais_recebimentos_itens_rastros"
    ON public.materiais_recebimentos_itens_rastros FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;


