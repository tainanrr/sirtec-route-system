-- =====================================================
-- FIX: Adicionar colunas faltantes na tabela procedimentos
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Verificar se a tabela existe, se não, criar
CREATE TABLE IF NOT EXISTS procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    conteudo TEXT,
    categoria VARCHAR(50) DEFAULT 'operacional',
    arquivo_url TEXT,
    contrato_id UUID REFERENCES contratos(id),
    visivel_app BOOLEAN DEFAULT true,
    ativo BOOLEAN DEFAULT true,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas que podem estar faltando
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS visivel_app BOOLEAN DEFAULT true;
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'operacional';
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS conteudo TEXT;
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS arquivo_url TEXT;
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos(id);
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Corrigir coluna 'codigo' - tornar opcional (pode não existir em tabelas novas)
DO $$
BEGIN
    -- Verificar se a coluna 'codigo' existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'procedimentos' AND column_name = 'codigo'
    ) THEN
        -- Remover constraint NOT NULL da coluna 'codigo'
        ALTER TABLE procedimentos ALTER COLUMN codigo DROP NOT NULL;
        
        -- Remover constraint UNIQUE se existir
        ALTER TABLE procedimentos DROP CONSTRAINT IF EXISTS procedimentos_codigo_key;
    END IF;
END $$;

-- Desabilitar RLS para evitar problemas de permissão
ALTER TABLE procedimentos DISABLE ROW LEVEL SECURITY;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_procedimentos_categoria ON procedimentos(categoria);
CREATE INDEX IF NOT EXISTS idx_procedimentos_contrato ON procedimentos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_procedimentos_ativo ON procedimentos(ativo);
CREATE INDEX IF NOT EXISTS idx_procedimentos_ordem ON procedimentos(ordem);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_procedimentos_updated_at ON procedimentos;
CREATE TRIGGER update_procedimentos_updated_at
    BEFORE UPDATE ON procedimentos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verificar estrutura final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'procedimentos'
ORDER BY ordinal_position;


