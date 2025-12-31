-- Migration: Adicionar campo grupo_servico na tabela skills
-- Permite categorizar tipos de serviço em grupos para filtros

-- Adicionar coluna grupo_servico
ALTER TABLE skills ADD COLUMN IF NOT EXISTS grupo_servico VARCHAR(100);

-- Comentário explicativo
COMMENT ON COLUMN skills.grupo_servico IS 'Grupo de serviço para categorização e filtros';

-- Criar índice para facilitar consultas por grupo
CREATE INDEX IF NOT EXISTS idx_skills_grupo_servico ON skills(grupo_servico);

