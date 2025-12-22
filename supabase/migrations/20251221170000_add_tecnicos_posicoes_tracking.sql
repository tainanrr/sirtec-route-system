-- Torre de Controle: Telemetria/Tracking de equipes
-- Objetivo:
-- - Armazenar posições (histórico) das equipes
-- - Expor a última posição por equipe (view)
-- - Permitir registro via RPC usando credenciais do `equipe_auth` (app sem Supabase Auth)
-- - Habilitar Realtime para a tabela de posições

CREATE TABLE IF NOT EXISTS public.tecnicos_posicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  accuracy_m DECIMAL(10,2),
  speed_mps DECIMAL(10,2),
  heading_deg DECIMAL(10,2),
  battery_pct INTEGER,
  gps_ativo BOOLEAN DEFAULT true,
  app_state TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tecnicos_posicoes_equipe_rec_at
  ON public.tecnicos_posicoes(equipe_id, recorded_at DESC);

-- RLS
ALTER TABLE public.tecnicos_posicoes ENABLE ROW LEVEL SECURITY;

-- Leitura liberada para painel (authenticated)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tecnicos_posicoes'
      AND policyname = 'Authenticated users can view tecnicos_posicoes'
  ) THEN
    CREATE POLICY "Authenticated users can view tecnicos_posicoes"
      ON public.tecnicos_posicoes
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

-- View: última posição por equipe
CREATE OR REPLACE VIEW public.vw_tecnicos_posicao_atual AS
SELECT DISTINCT ON (p.equipe_id)
  p.equipe_id,
  p.latitude,
  p.longitude,
  p.recorded_at,
  p.accuracy_m,
  p.speed_mps,
  p.heading_deg,
  p.battery_pct,
  p.gps_ativo,
  p.app_state
FROM public.tecnicos_posicoes p
ORDER BY p.equipe_id, p.recorded_at DESC;

-- RPC: registra posição usando credenciais do `equipe_auth`
-- (o app móvel faz login via RPC, então não depende de Supabase Auth)
CREATE OR REPLACE FUNCTION public.registrar_posicao_equipe(
  p_usuario VARCHAR(50),
  p_senha TEXT,
  p_lat DECIMAL(10,8),
  p_lng DECIMAL(11,8),
  p_accuracy_m DECIMAL(10,2) DEFAULT NULL,
  p_speed_mps DECIMAL(10,2) DEFAULT NULL,
  p_heading_deg DECIMAL(10,2) DEFAULT NULL,
  p_battery_pct INTEGER DEFAULT NULL,
  p_gps_ativo BOOLEAN DEFAULT true,
  p_app_state TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipe_auth RECORD;
BEGIN
  SELECT ea.*, t.id AS tecnico_id
  INTO v_equipe_auth
  FROM public.equipe_auth ea
  INNER JOIN public.tecnicos t ON t.id = ea.equipe_id
  WHERE ea.usuario = p_usuario;

  IF v_equipe_auth IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado');
  END IF;

  IF v_equipe_auth.senha_hash != crypt(p_senha, v_equipe_auth.senha_hash) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Senha incorreta');
  END IF;

  INSERT INTO public.tecnicos_posicoes (
    equipe_id,
    latitude,
    longitude,
    accuracy_m,
    speed_mps,
    heading_deg,
    battery_pct,
    gps_ativo,
    app_state
  )
  VALUES (
    v_equipe_auth.tecnico_id,
    p_lat,
    p_lng,
    p_accuracy_m,
    p_speed_mps,
    p_heading_deg,
    p_battery_pct,
    p_gps_ativo,
    p_app_state
  );

  RETURN jsonb_build_object(
    'success', true,
    'equipe_id', v_equipe_auth.tecnico_id,
    'recorded_at', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

COMMENT ON TABLE public.tecnicos_posicoes IS 'Histórico de posições das equipes (telemetria) para Torre de Controle.';
COMMENT ON VIEW public.vw_tecnicos_posicao_atual IS 'Última posição conhecida de cada equipe.';
COMMENT ON FUNCTION public.registrar_posicao_equipe IS 'Registra posição de equipe usando credenciais do equipe_auth (app).';

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tecnicos_posicoes;


