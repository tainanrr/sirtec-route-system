-- Migration: Adicionar campo avulsa na tabela ordens_servico
-- Indica que a OS foi criada diretamente pelo app em campo

-- Adicionar coluna avulsa
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS avulsa BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN ordens_servico.avulsa IS 'Indica se a OS foi criada de forma avulsa pelo app em campo';

-- Criar índice para facilitar consultas
CREATE INDEX IF NOT EXISTS idx_ordens_servico_avulsa ON ordens_servico(avulsa) WHERE avulsa = true;

-- Atualizar OSs existentes que têm número começando com "AVL-" como avulsas
UPDATE ordens_servico SET avulsa = true WHERE numero LIKE 'AVL-%';

