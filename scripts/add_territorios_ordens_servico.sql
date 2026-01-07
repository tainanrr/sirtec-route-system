-- Script para adicionar campo territorios na tabela ordens_servico
-- Este campo armazena os IDs dos territórios onde a OS está localizada (calculado automaticamente)

-- Adicionar coluna territorios como array de UUIDs
ALTER TABLE ordens_servico
ADD COLUMN IF NOT EXISTS territorios UUID[] DEFAULT '{}';

-- Criar índice para buscas por território
CREATE INDEX IF NOT EXISTS idx_ordens_servico_territorios ON ordens_servico USING GIN (territorios);

-- Comentário explicativo
COMMENT ON COLUMN ordens_servico.territorios IS 'Array de IDs dos territórios onde esta OS está localizada. Calculado automaticamente com base nas coordenadas da OS e nos polígonos dos territórios.';

-- Função para verificar se um ponto está dentro de um polígono (ray casting algorithm)
-- Esta função é executada no frontend, mas deixamos aqui como referência
/*
Para verificar se uma OS está dentro de um território:
1. Obter latitude e longitude da OS
2. Para cada território, verificar se o ponto está dentro do polígono
3. Se estiver, adicionar o ID do território ao array territorios
*/

