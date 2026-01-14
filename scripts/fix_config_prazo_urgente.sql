-- =============================================
-- Script para corrigir/recriar tabela config_prazo_urgente
-- Dropa políticas existentes antes de recriar
-- =============================================

-- Dropar políticas existentes (se existirem)
DROP POLICY IF EXISTS "Usuarios podem ver sua config" ON config_prazo_urgente;
DROP POLICY IF EXISTS "Usuarios podem inserir sua config" ON config_prazo_urgente;
DROP POLICY IF EXISTS "Usuarios podem atualizar sua config" ON config_prazo_urgente;
DROP POLICY IF EXISTS "Usuarios podem deletar sua config" ON config_prazo_urgente;

-- Dropar funções existentes (se existirem)
DROP FUNCTION IF EXISTS get_prazo_urgente_padrao();
DROP FUNCTION IF EXISTS reset_config_prazo_urgente_diario();

-- Dropar tabela se existir (CUIDADO: isso apaga dados existentes)
-- DROP TABLE IF EXISTS config_prazo_urgente;

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS config_prazo_urgente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios_web(id) ON DELETE CASCADE,
  prazo_limite_urgente timestamptz NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_automaticamente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id)
);

-- Criar índice se não existir
CREATE INDEX IF NOT EXISTS idx_config_prazo_urgente_usuario ON config_prazo_urgente(usuario_id);

-- Habilitar RLS
ALTER TABLE config_prazo_urgente ENABLE ROW LEVEL SECURITY;

-- Recriar políticas
CREATE POLICY "Usuarios podem ver sua config" ON config_prazo_urgente
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Usuarios podem inserir sua config" ON config_prazo_urgente
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios podem atualizar sua config" ON config_prazo_urgente
  FOR UPDATE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Usuarios podem deletar sua config" ON config_prazo_urgente
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Comentários
COMMENT ON TABLE config_prazo_urgente IS 'Configuração do prazo limite para considerar OSs como urgentes por usuário';
COMMENT ON COLUMN config_prazo_urgente.prazo_limite_urgente IS 'OSs reguladas com prazo até esta data/hora são consideradas urgentes';
COMMENT ON COLUMN config_prazo_urgente.atualizado_automaticamente IS 'Se true, foi atualizado pelo sistema às 00:01 para o próximo dia 10h';

-- Função para obter o prazo padrão (próximo dia às 10h)
CREATE OR REPLACE FUNCTION get_prazo_urgente_padrao()
RETURNS timestamptz AS $$
DECLARE
  amanha timestamptz;
BEGIN
  amanha := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' + interval '10 hours';
  RETURN amanha AT TIME ZONE 'America/Sao_Paulo';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para resetar todas as configs às 00:01 de cada dia
CREATE OR REPLACE FUNCTION reset_config_prazo_urgente_diario()
RETURNS void AS $$
BEGIN
  UPDATE config_prazo_urgente
  SET 
    prazo_limite_urgente = get_prazo_urgente_padrao(),
    atualizado_em = now(),
    atualizado_automaticamente = true;
    
  RAISE NOTICE 'Configurações de prazo urgente resetadas para: %', get_prazo_urgente_padrao();
END;
$$ LANGUAGE plpgsql;

-- Verificar resultado
SELECT 'Tabela config_prazo_urgente configurada com sucesso!' as status;
SELECT * FROM pg_policies WHERE tablename = 'config_prazo_urgente';
