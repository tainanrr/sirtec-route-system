-- Migration: Adicionar campo contrato_id na tabela ordens_servico
-- Vincula cada OS a um contrato para cálculos de valores

-- Adicionar coluna contrato_id
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos(id);

-- Criar índice para facilitar consultas por contrato
CREATE INDEX IF NOT EXISTS idx_ordens_servico_contrato_id ON ordens_servico(contrato_id);

-- Atualizar todas as OS existentes para o contrato 4600079169
-- Primeiro, buscar o ID do contrato pelo código
DO $$
DECLARE
  v_contrato_id UUID;
BEGIN
  SELECT id INTO v_contrato_id FROM contratos WHERE codigo = '4600079169' LIMIT 1;
  
  IF v_contrato_id IS NOT NULL THEN
    UPDATE ordens_servico SET contrato_id = v_contrato_id WHERE contrato_id IS NULL;
    RAISE NOTICE 'OSs atualizadas para o contrato %', v_contrato_id;
  ELSE
    RAISE NOTICE 'Contrato 4600079169 não encontrado';
  END IF;
END $$;

-- Comentário
COMMENT ON COLUMN ordens_servico.contrato_id IS 'Contrato ao qual a OS está vinculada';

