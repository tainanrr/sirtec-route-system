-- Migration: Adicionar campo permite_avulso na tabela skills
-- Permite que determinados tipos de serviço possam ser criados como OS avulsa pelo app

-- Adicionar coluna permite_avulso
ALTER TABLE skills ADD COLUMN IF NOT EXISTS permite_avulso BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN skills.permite_avulso IS 'Indica se este tipo de serviço permite criação de OS avulsa pelo app em campo';

-- Por padrão, nenhum serviço permite avulso (valor false)
-- O administrador deve habilitar manualmente os tipos desejados

