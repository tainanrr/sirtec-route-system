-- ============================================
-- FIX: Habilitar Realtime para tabelas de chat
-- ============================================

-- Configurar Replica Identity FULL para as tabelas
-- Isso é necessário para o Realtime funcionar corretamente
ALTER TABLE chat_conversas REPLICA IDENTITY FULL;
ALTER TABLE chat_mensagens REPLICA IDENTITY FULL;

-- Verificar e adicionar à publicação supabase_realtime
DO $$
BEGIN
    -- Tentar adicionar chat_conversas
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversas;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'chat_conversas já está na publicação supabase_realtime';
    END;
    
    -- Tentar adicionar chat_mensagens
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_mensagens;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'chat_mensagens já está na publicação supabase_realtime';
    END;
END $$;

-- Verificar configuração atual
SELECT 
    schemaname,
    tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('chat_conversas', 'chat_mensagens');

SELECT 'Realtime configuration completed!' as status;











