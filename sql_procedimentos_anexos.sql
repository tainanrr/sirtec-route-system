-- =====================================================
-- Procedimentos: Sistema de Anexos (PDFs e documentos)
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- 1. Criar tabela de anexos de procedimentos
CREATE TABLE IF NOT EXISTS procedimentos_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedimento_id UUID NOT NULL REFERENCES procedimentos(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    tipo_arquivo VARCHAR(100) DEFAULT 'application/pdf',
    tamanho_bytes BIGINT DEFAULT 0,
    storage_path VARCHAR(500) NOT NULL,
    url_publica TEXT,
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_procedimentos_anexos_procedimento ON procedimentos_anexos(procedimento_id);
CREATE INDEX IF NOT EXISTS idx_procedimentos_anexos_ativo ON procedimentos_anexos(ativo);

-- 3. Trigger para updated_at
DROP TRIGGER IF EXISTS update_procedimentos_anexos_updated_at ON procedimentos_anexos;
CREATE TRIGGER update_procedimentos_anexos_updated_at
    BEFORE UPDATE ON procedimentos_anexos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Desabilitar RLS para simplicidade
ALTER TABLE procedimentos_anexos DISABLE ROW LEVEL SECURITY;

-- 5. Criar bucket de storage para procedimentos
-- NOTA: Isso precisa ser feito via API ou dashboard do Supabase
-- O código abaixo é para referência - execute no dashboard Storage

-- No Supabase Dashboard:
-- 1. Vá em Storage
-- 2. Crie um novo bucket chamado "procedimentos" 
-- 3. Marque como PUBLIC
-- 4. Adicione as políticas abaixo

-- =====================================================
-- POLÍTICAS DE STORAGE (execute no SQL Editor)
-- =====================================================

-- Criar bucket se não existir (via SQL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'procedimentos',
    'procedimentos',
    true,
    52428800, -- 50MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800;

-- Política para permitir SELECT público
DROP POLICY IF EXISTS "Permitir leitura pública de procedimentos" ON storage.objects;
CREATE POLICY "Permitir leitura pública de procedimentos"
ON storage.objects FOR SELECT
USING (bucket_id = 'procedimentos');

-- Política para permitir INSERT para usuários autenticados
DROP POLICY IF EXISTS "Permitir upload para autenticados" ON storage.objects;
CREATE POLICY "Permitir upload para autenticados"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'procedimentos');

-- Política para permitir UPDATE para usuários autenticados
DROP POLICY IF EXISTS "Permitir update para autenticados" ON storage.objects;
CREATE POLICY "Permitir update para autenticados"
ON storage.objects FOR UPDATE
USING (bucket_id = 'procedimentos');

-- Política para permitir DELETE para usuários autenticados
DROP POLICY IF EXISTS "Permitir delete para autenticados" ON storage.objects;
CREATE POLICY "Permitir delete para autenticados"
ON storage.objects FOR DELETE
USING (bucket_id = 'procedimentos');

-- =====================================================
-- Verificações
-- =====================================================

-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'procedimentos_anexos'
ORDER BY ordinal_position;

-- Verificar bucket criado
SELECT * FROM storage.buckets WHERE id = 'procedimentos';
















