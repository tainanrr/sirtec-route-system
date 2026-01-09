-- Migration: Criar tabela valores_servico_centro_custo
-- Armazena valores de serviço por contrato E centro de custo com opção de cálculo automático ou manual

CREATE TABLE IF NOT EXISTS valores_servico_centro_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_codigo VARCHAR(50) NOT NULL,
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  centro_custo_id UUID NOT NULL REFERENCES centros_custo(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_automatico BOOLEAN DEFAULT true,
  ultima_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  qtd_amostras INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(skill_codigo, contrato_id, centro_custo_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_valores_servico_cc_skill ON valores_servico_centro_custo(skill_codigo);
CREATE INDEX IF NOT EXISTS idx_valores_servico_cc_contrato ON valores_servico_centro_custo(contrato_id);
CREATE INDEX IF NOT EXISTS idx_valores_servico_cc_centro ON valores_servico_centro_custo(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_valores_servico_cc_skill_contrato ON valores_servico_centro_custo(skill_codigo, contrato_id);

-- Comentários
COMMENT ON TABLE valores_servico_centro_custo IS 'Valores de tipos de serviço por contrato e centro de custo';
COMMENT ON COLUMN valores_servico_centro_custo.valor IS 'Valor do serviço para este contrato e centro de custo';
COMMENT ON COLUMN valores_servico_centro_custo.valor_automatico IS 'Se true, valor é atualizado automaticamente com base no histórico';
COMMENT ON COLUMN valores_servico_centro_custo.qtd_amostras IS 'Quantidade de amostras usadas no cálculo automático';

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_valores_servico_centro_custo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_valores_servico_centro_custo ON valores_servico_centro_custo;
CREATE TRIGGER trigger_update_valores_servico_centro_custo
  BEFORE UPDATE ON valores_servico_centro_custo
  FOR EACH ROW
  EXECUTE FUNCTION update_valores_servico_centro_custo_updated_at();

-- Habilitar RLS
ALTER TABLE valores_servico_centro_custo ENABLE ROW LEVEL SECURITY;

-- Política RLS para permitir acesso total (ajustar conforme necessário)
CREATE POLICY "valores_servico_centro_custo_all" ON valores_servico_centro_custo
  FOR ALL
  USING (true)
  WITH CHECK (true);

