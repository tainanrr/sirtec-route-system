-- ============================================
-- SISTEMA DE LOGS - CORREÇÃO URGENTE
-- Execute este script no Supabase SQL Editor
-- ============================================

-- 1. REMOVER FOREIGN KEY que está bloqueando as inserções
ALTER TABLE logs_sistema DROP CONSTRAINT IF EXISTS logs_sistema_usuario_id_fkey;
ALTER TABLE logs_sistema DROP CONSTRAINT IF EXISTS logs_sistema_equipe_id_fkey;

-- 2. Garantir que todas as colunas existem
DO $$
BEGIN
    -- usuario_email
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'usuario_email') THEN
        ALTER TABLE logs_sistema ADD COLUMN usuario_email TEXT;
    END IF;
    
    -- equipe_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'equipe_id') THEN
        ALTER TABLE logs_sistema ADD COLUMN equipe_id UUID;
    END IF;
    
    -- equipe_codigo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'equipe_codigo') THEN
        ALTER TABLE logs_sistema ADD COLUMN equipe_codigo TEXT;
    END IF;
    
    -- ip_address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'ip_address') THEN
        ALTER TABLE logs_sistema ADD COLUMN ip_address TEXT;
    END IF;
    
    -- user_agent
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'user_agent') THEN
        ALTER TABLE logs_sistema ADD COLUMN user_agent TEXT;
    END IF;
    
    -- plataforma
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'plataforma') THEN
        ALTER TABLE logs_sistema ADD COLUMN plataforma TEXT DEFAULT 'web';
    END IF;
    
    -- latitude
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'latitude') THEN
        ALTER TABLE logs_sistema ADD COLUMN latitude DECIMAL(10, 8);
    END IF;
    
    -- longitude
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'longitude') THEN
        ALTER TABLE logs_sistema ADD COLUMN longitude DECIMAL(11, 8);
    END IF;
    
    -- duracao_ms
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'duracao_ms') THEN
        ALTER TABLE logs_sistema ADD COLUMN duracao_ms INTEGER;
    END IF;
    
    -- sucesso
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'sucesso') THEN
        ALTER TABLE logs_sistema ADD COLUMN sucesso BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- erro_mensagem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'erro_mensagem') THEN
        ALTER TABLE logs_sistema ADD COLUMN erro_mensagem TEXT;
    END IF;
END $$;

-- 3. Alterar a coluna usuario_id para aceitar qualquer UUID (sem FK)
ALTER TABLE logs_sistema ALTER COLUMN usuario_id DROP NOT NULL;

-- 4. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_logs_sistema_created_at ON logs_sistema (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_acao ON logs_sistema (acao);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_modulo ON logs_sistema (modulo);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_tabela ON logs_sistema (tabela);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_usuario_id ON logs_sistema (usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_equipe_id ON logs_sistema (equipe_id);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_plataforma ON logs_sistema (plataforma);

-- 5. Garantir RLS habilitado mas permissivo
ALTER TABLE logs_sistema ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de segurança - TOTALMENTE PERMISSIVAS
DROP POLICY IF EXISTS "Permitir leitura de logs" ON logs_sistema;
CREATE POLICY "Permitir leitura de logs" ON logs_sistema
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de logs" ON logs_sistema;
CREATE POLICY "Permitir inserção de logs" ON logs_sistema
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir update de logs" ON logs_sistema;
CREATE POLICY "Permitir update de logs" ON logs_sistema
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir delete de logs" ON logs_sistema;
CREATE POLICY "Permitir delete de logs" ON logs_sistema
    FOR DELETE USING (true);

-- 7. Teste de inserção
INSERT INTO logs_sistema (acao, modulo, detalhes, plataforma, sucesso, usuario_nome)
VALUES ('criar', 'admin', 'Teste após remover FK - deve funcionar agora', 'web', true, 'Sistema');

-- 8. Verificar se funcionou
SELECT id, acao, modulo, detalhes, usuario_nome, created_at 
FROM logs_sistema 
ORDER BY created_at DESC 
LIMIT 5;
