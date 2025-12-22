-- Garantir que a tela "Consulta checklists" consiga listar devoluções
-- Observação: com RLS ativo, ausência de policy pode resultar em lista vazia (sem erro).

-- 1) materiais_devolucoes
ALTER TABLE public.materiais_devolucoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes'
      AND policyname = 'Consulta can view materiais_devolucoes'
  ) THEN
    CREATE POLICY "Consulta can view materiais_devolucoes"
    ON public.materiais_devolucoes FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

-- 2) materiais_devolucoes_itens
ALTER TABLE public.materiais_devolucoes_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes_itens'
      AND policyname = 'Consulta can view materiais_devolucoes_itens'
  ) THEN
    CREATE POLICY "Consulta can view materiais_devolucoes_itens"
    ON public.materiais_devolucoes_itens FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

-- 3) materiais_devolucoes_itens_rastros
ALTER TABLE public.materiais_devolucoes_itens_rastros ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes_itens_rastros'
      AND policyname = 'Consulta can view materiais_devolucoes_itens_rastros'
  ) THEN
    CREATE POLICY "Consulta can view materiais_devolucoes_itens_rastros"
    ON public.materiais_devolucoes_itens_rastros FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;


