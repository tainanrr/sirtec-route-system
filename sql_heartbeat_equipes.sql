-- =====================================================
-- Sistema de Heartbeat para Detecção de Conectividade das Equipes
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Tabela para armazenar heartbeats (pings) das equipes
-- O app envia um ping a cada 2 minutos quando está online
CREATE TABLE IF NOT EXISTS public.equipe_heartbeat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES tecnicos(id) ON DELETE CASCADE,
  ultimo_ping TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  app_version VARCHAR(50),
  plataforma VARCHAR(50), -- 'android', 'ios', 'web'
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  bateria_nivel INTEGER, -- 0-100
  conexao_tipo VARCHAR(50), -- 'wifi', '4g', '3g', 'offline'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Garantir apenas um registro por equipe (upsert)
  CONSTRAINT equipe_heartbeat_equipe_unique UNIQUE (equipe_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_equipe_heartbeat_equipe ON public.equipe_heartbeat(equipe_id);
CREATE INDEX IF NOT EXISTS idx_equipe_heartbeat_ultimo_ping ON public.equipe_heartbeat(ultimo_ping);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_equipe_heartbeat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_equipe_heartbeat_timestamp ON public.equipe_heartbeat;
CREATE TRIGGER update_equipe_heartbeat_timestamp
    BEFORE UPDATE ON public.equipe_heartbeat
    FOR EACH ROW
    EXECUTE FUNCTION update_equipe_heartbeat_updated_at();

-- RLS Policies
ALTER TABLE public.equipe_heartbeat ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados (web) - pode ler todos
CREATE POLICY "equipe_heartbeat_authenticated_select" ON public.equipe_heartbeat
  FOR SELECT TO authenticated USING (true);

-- Política para anon (app) - pode inserir/atualizar/ler
CREATE POLICY "equipe_heartbeat_anon_all" ON public.equipe_heartbeat
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Função para registrar heartbeat (upsert)
CREATE OR REPLACE FUNCTION registrar_heartbeat(
  p_equipe_id UUID,
  p_app_version VARCHAR DEFAULT NULL,
  p_plataforma VARCHAR DEFAULT NULL,
  p_latitude DECIMAL DEFAULT NULL,
  p_longitude DECIMAL DEFAULT NULL,
  p_bateria_nivel INTEGER DEFAULT NULL,
  p_conexao_tipo VARCHAR DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.equipe_heartbeat (
    equipe_id,
    ultimo_ping,
    app_version,
    plataforma,
    latitude,
    longitude,
    bateria_nivel,
    conexao_tipo
  ) VALUES (
    p_equipe_id,
    NOW(),
    p_app_version,
    p_plataforma,
    p_latitude,
    p_longitude,
    p_bateria_nivel,
    p_conexao_tipo
  )
  ON CONFLICT (equipe_id) DO UPDATE SET
    ultimo_ping = NOW(),
    app_version = COALESCE(EXCLUDED.app_version, equipe_heartbeat.app_version),
    plataforma = COALESCE(EXCLUDED.plataforma, equipe_heartbeat.plataforma),
    latitude = COALESCE(EXCLUDED.latitude, equipe_heartbeat.latitude),
    longitude = COALESCE(EXCLUDED.longitude, equipe_heartbeat.longitude),
    bateria_nivel = COALESCE(EXCLUDED.bateria_nivel, equipe_heartbeat.bateria_nivel),
    conexao_tipo = COALESCE(EXCLUDED.conexao_tipo, equipe_heartbeat.conexao_tipo);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View para consultar status de conectividade das equipes
CREATE OR REPLACE VIEW v_equipes_conectividade AS
SELECT 
  t.id as equipe_id,
  t.codigo as equipe_codigo,
  t.nome as equipe_nome,
  h.ultimo_ping,
  h.plataforma,
  h.conexao_tipo,
  h.bateria_nivel,
  h.latitude,
  h.longitude,
  EXTRACT(EPOCH FROM (NOW() - h.ultimo_ping)) / 60 as minutos_desde_ultimo_ping,
  CASE 
    WHEN h.ultimo_ping IS NULL THEN 'nunca_conectou'
    WHEN EXTRACT(EPOCH FROM (NOW() - h.ultimo_ping)) / 60 <= 3 THEN 'online'
    WHEN EXTRACT(EPOCH FROM (NOW() - h.ultimo_ping)) / 60 <= 10 THEN 'instavel'
    ELSE 'offline'
  END as status_conexao
FROM tecnicos t
LEFT JOIN equipe_heartbeat h ON h.equipe_id = t.id;

-- Comentários para documentação
COMMENT ON TABLE public.equipe_heartbeat IS 'Armazena heartbeats (pings) das equipes para detectar conectividade em tempo real';
COMMENT ON COLUMN public.equipe_heartbeat.ultimo_ping IS 'Data/hora do último ping recebido do app';
COMMENT ON COLUMN public.equipe_heartbeat.conexao_tipo IS 'Tipo de conexão: wifi, 4g, 3g, etc';
COMMENT ON FUNCTION registrar_heartbeat IS 'Registra ou atualiza heartbeat de uma equipe (upsert)';

SELECT 'Tabela equipe_heartbeat criada com sucesso!' as status;
