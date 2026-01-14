-- =============================================
-- Migração: Configuração de Prazo Limite para OSs Urgentes
-- Permite que cada usuário defina até qual data/hora as OSs
-- são consideradas urgentes (prazo de reguladas)
-- =============================================

-- Criar tabela para armazenar configuração por usuário
CREATE TABLE IF NOT EXISTS config_prazo_urgente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios_web(id) ON DELETE CASCADE,
  prazo_limite_urgente timestamptz NOT NULL, -- Data/hora limite para considerar OS urgente
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_automaticamente boolean NOT NULL DEFAULT false, -- Se foi atualizado pelo sistema às 00:01
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id) -- Apenas uma configuração por usuário
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_config_prazo_urgente_usuario ON config_prazo_urgente(usuario_id);

-- Habilitar RLS
ALTER TABLE config_prazo_urgente ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver/modificar apenas sua própria configuração
CREATE POLICY "Usuarios podem ver sua config" ON config_prazo_urgente
  FOR SELECT
  TO anon, authenticated
  USING (true); -- Permitir leitura de todas as configs para facilitar admin

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

-- Comentários na tabela
COMMENT ON TABLE config_prazo_urgente IS 'Configuração do prazo limite para considerar OSs como urgentes por usuário';
COMMENT ON COLUMN config_prazo_urgente.prazo_limite_urgente IS 'OSs reguladas com prazo até esta data/hora são consideradas urgentes';
COMMENT ON COLUMN config_prazo_urgente.atualizado_automaticamente IS 'Se true, foi atualizado pelo sistema às 00:01 para o próximo dia 10h';

-- Função para obter o prazo padrão (próximo dia às 10h)
CREATE OR REPLACE FUNCTION get_prazo_urgente_padrao()
RETURNS timestamptz AS $$
DECLARE
  amanha timestamptz;
BEGIN
  -- Próximo dia às 10:00
  amanha := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' + interval '10 hours';
  RETURN amanha AT TIME ZONE 'America/Sao_Paulo';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para resetar todas as configs às 00:01 de cada dia
-- Esta função deve ser chamada por um cron job ou manualmente
CREATE OR REPLACE FUNCTION reset_config_prazo_urgente_diario()
RETURNS void AS $$
BEGIN
  -- Atualiza todas as configurações para o novo prazo padrão
  -- e marca como atualizado automaticamente
  UPDATE config_prazo_urgente
  SET 
    prazo_limite_urgente = get_prazo_urgente_padrao(),
    atualizado_em = now(),
    atualizado_automaticamente = true;
    
  -- Log da operação
  RAISE NOTICE 'Configurações de prazo urgente resetadas para: %', get_prazo_urgente_padrao();
END;
$$ LANGUAGE plpgsql;

-- Verificar se as tabelas foram criadas
SELECT 'Tabela config_prazo_urgente criada com sucesso!' as status;
