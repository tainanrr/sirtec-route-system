-- =====================================================
-- FIX: Criar/ajustar tabela tipos_intervalo completa
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Verificar se a tabela existe, se não, criar
CREATE TABLE IF NOT EXISTS tipos_intervalo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    tempo_minutos INTEGER DEFAULT 60,
    cor VARCHAR(20) DEFAULT '#3B82F6',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Se a tabela já existe, adicionar as colunas que podem estar faltando
ALTER TABLE tipos_intervalo ADD COLUMN IF NOT EXISTS tempo_minutos INTEGER DEFAULT 60;
ALTER TABLE tipos_intervalo ADD COLUMN IF NOT EXISTS cor VARCHAR(20) DEFAULT '#3B82F6';
ALTER TABLE tipos_intervalo ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
ALTER TABLE tipos_intervalo ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tipos_intervalo ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Desabilitar RLS para evitar problemas de permissão
ALTER TABLE tipos_intervalo DISABLE ROW LEVEL SECURITY;

-- Criar trigger para updated_at se não existir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tipos_intervalo_updated_at ON tipos_intervalo;
CREATE TRIGGER update_tipos_intervalo_updated_at
    BEFORE UPDATE ON tipos_intervalo
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verificar estrutura final da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tipos_intervalo'
ORDER BY ordinal_position;
