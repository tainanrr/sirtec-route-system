-- Refatoração da tela de Recebimentos: campos de "Recebido por", canal de entrada,
-- chave NF-e e anexos por recebimento.

-- 1) Campos extras no cabeçalho do recebimento
ALTER TABLE public.materiais_recebimentos
ADD COLUMN IF NOT EXISTS recebido_por TEXT,
ADD COLUMN IF NOT EXISTS recebido_por_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS canal_entrada TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS chave_nfe TEXT;

-- 2) Tabela de anexos do recebimento
CREATE TABLE IF NOT EXISTS public.materiais_recebimentos_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id UUID NOT NULL REFERENCES public.materiais_recebimentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'nf', 'foto', 'xml', 'planilha', 'outro'
  nome_arquivo TEXT,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_materiais_recebimentos_anexos_recebimento_id
  ON public.materiais_recebimentos_anexos (recebimento_id);

ALTER TABLE public.materiais_recebimentos_anexos ENABLE ROW LEVEL SECURITY;

-- Políticas (mesmo padrão de outras tabelas do sistema: authenticated pode ver/gerenciar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_recebimentos_anexos'
      AND policyname = 'Authenticated users can view materiais_recebimentos_anexos'
  ) THEN
    CREATE POLICY "Authenticated users can view materiais_recebimentos_anexos"
    ON public.materiais_recebimentos_anexos FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_recebimentos_anexos'
      AND policyname = 'Authenticated users can manage materiais_recebimentos_anexos'
  ) THEN
    CREATE POLICY "Authenticated users can manage materiais_recebimentos_anexos"
    ON public.materiais_recebimentos_anexos FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;



