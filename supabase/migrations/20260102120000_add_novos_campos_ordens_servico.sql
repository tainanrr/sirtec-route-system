-- Migration: Adicionar novos campos na tabela ordens_servico
-- Data: 02/01/2026
-- Campos: tensao_medicao, centro_custo_id, data_geracao, zona_cadastral

-- 1. Tensão de medição (texto livre)
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS tensao_medicao VARCHAR(50);
COMMENT ON COLUMN ordens_servico.tensao_medicao IS 'Tensão de medição da instalação';

-- 2. Centro de Custo (FK para centros_custo)
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES centros_custo(id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_centro_custo_id ON ordens_servico(centro_custo_id);
COMMENT ON COLUMN ordens_servico.centro_custo_id IS 'Centro de custo ao qual a OS está vinculada';

-- 3. Data de geração (timestamp)
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_geracao TIMESTAMPTZ;
COMMENT ON COLUMN ordens_servico.data_geracao IS 'Data/hora de geração da ordem de serviço';

-- 4. Zona cadastral (enum: Urbana, Rural, Indefinida)
-- Primeiro criar o tipo enum se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zona_cadastral_enum') THEN
    CREATE TYPE zona_cadastral_enum AS ENUM ('Urbana', 'Rural', 'Indefinida');
  END IF;
END $$;

-- Adicionar a coluna usando o enum
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS zona_cadastral zona_cadastral_enum DEFAULT 'Indefinida';
COMMENT ON COLUMN ordens_servico.zona_cadastral IS 'Zona cadastral da instalação: Urbana, Rural ou Indefinida';

