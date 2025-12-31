-- Migration: Criar tabela valores_servico_contrato
-- Armazena valores de serviço por contrato com opção de cálculo automático ou manual

CREATE TABLE IF NOT EXISTS valores_servico_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_codigo VARCHAR(50) NOT NULL,
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_automatico BOOLEAN DEFAULT true,
  ultima_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  qtd_amostras INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(skill_codigo, contrato_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_valores_servico_contrato_skill ON valores_servico_contrato(skill_codigo);
CREATE INDEX IF NOT EXISTS idx_valores_servico_contrato_contrato ON valores_servico_contrato(contrato_id);

-- Comentários
COMMENT ON TABLE valores_servico_contrato IS 'Valores de tipos de serviço por contrato';
COMMENT ON COLUMN valores_servico_contrato.valor IS 'Valor do serviço para este contrato';
COMMENT ON COLUMN valores_servico_contrato.valor_automatico IS 'Se true, valor é atualizado automaticamente com base no histórico';
COMMENT ON COLUMN valores_servico_contrato.qtd_amostras IS 'Quantidade de amostras usadas no cálculo automático';

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_valores_servico_contrato_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_valores_servico_contrato ON valores_servico_contrato;
CREATE TRIGGER trigger_update_valores_servico_contrato
  BEFORE UPDATE ON valores_servico_contrato
  FOR EACH ROW
  EXECUTE FUNCTION update_valores_servico_contrato_updated_at();

