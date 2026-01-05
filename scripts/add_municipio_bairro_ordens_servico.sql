-- Script para adicionar campos municipio e bairro na tabela ordens_servico
-- Esses campos serão preenchidos via importação junto com o campo endereco

-- 1. Adicionar coluna municipio
ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS municipio VARCHAR(255);

-- 2. Adicionar coluna bairro
ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS bairro VARCHAR(255);

-- 3. Criar índices para melhorar performance nas consultas e filtros
CREATE INDEX IF NOT EXISTS idx_ordens_servico_municipio ON ordens_servico(municipio);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_bairro ON ordens_servico(bairro);

-- 4. Comentários nas colunas para documentação
COMMENT ON COLUMN ordens_servico.municipio IS 'Município onde o serviço será executado';
COMMENT ON COLUMN ordens_servico.bairro IS 'Bairro onde o serviço será executado';

-- Verificar se as colunas foram criadas corretamente
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'ordens_servico' 
AND column_name IN ('municipio', 'bairro');

