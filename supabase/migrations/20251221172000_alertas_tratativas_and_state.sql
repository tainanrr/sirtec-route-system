-- Torre de Controle: Tratativas de Alertas (auditável)
-- Objetivo:
-- - Tornar alertas "tratáveis" (reconhecer / assumir / silenciar / comentar / resolver / reabrir)
-- - Registrar todas as tratativas em uma tabela de auditoria
-- - Manter compatibilidade com a coluna `resolvido` já existente

-- Campos adicionais no alerta para estado operacional
ALTER TABLE public.alertas
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open', -- open | acknowledged | assigned | snoozed | resolved
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolved_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Trigger de updated_at (reaproveita função existente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_alertas_updated_at'
  ) THEN
    CREATE TRIGGER update_alertas_updated_at
      BEFORE UPDATE ON public.alertas
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- Tabela de tratativas
CREATE TABLE IF NOT EXISTS public.alertas_tratativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id UUID NOT NULL REFERENCES public.alertas(id) ON DELETE CASCADE,
  acao TEXT NOT NULL, -- acknowledge | assign | snooze | resolve | reopen | comment
  comentario TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_tratativas_alerta ON public.alertas_tratativas(alerta_id);
CREATE INDEX IF NOT EXISTS idx_alertas_tratativas_created_at ON public.alertas_tratativas(created_at DESC);

-- RLS
ALTER TABLE public.alertas_tratativas ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alertas_tratativas'
      AND policyname = 'Authenticated users can view alertas_tratativas'
  ) THEN
    CREATE POLICY "Authenticated users can view alertas_tratativas"
      ON public.alertas_tratativas
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alertas_tratativas'
      AND policyname = 'Authenticated users can insert alertas_tratativas'
  ) THEN
    CREATE POLICY "Authenticated users can insert alertas_tratativas"
      ON public.alertas_tratativas
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END
$$;

-- Realtime (opcional, mas útil para a torre)
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_tratativas;

COMMENT ON TABLE public.alertas_tratativas IS 'Auditoria de tratativas feitas em alertas (Torre de Controle).';
COMMENT ON COLUMN public.alertas.status IS 'Estado operacional do alerta (open/acknowledged/assigned/snoozed/resolved).';
COMMENT ON COLUMN public.alertas.snoozed_until IS 'Quando o alerta volta a ficar ativo (se silenciado).';



