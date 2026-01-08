-- Adicionar campo bairros na tabela de territórios
-- Este campo armazena a lista de bairros/localidades que pertencem a cada território
-- Usado para validação de coordenadas: se uma OS tem bairro X mas coordenadas fora do território, é suspeita

ALTER TABLE territorios 
ADD COLUMN IF NOT EXISTS bairros TEXT[] DEFAULT '{}';

-- Comentário explicativo
COMMENT ON COLUMN territorios.bairros IS 'Lista de bairros/localidades que pertencem a este território. Usado para validação de coordenadas suspeitas.';

