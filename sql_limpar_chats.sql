-- =============================================
-- LIMPAR TODAS AS CONVERSAS E MENSAGENS DO CHAT
-- Execute este script no Supabase SQL Editor
-- =============================================

-- 1. Deletar todas as mensagens
DELETE FROM chat_mensagens;

-- 2. Deletar todas as conversas
DELETE FROM chat_conversas;

-- 3. Verificar se limpou
SELECT 'Mensagens restantes:' as info, COUNT(*) as total FROM chat_mensagens;
SELECT 'Conversas restantes:' as info, COUNT(*) as total FROM chat_conversas;

-- Pronto! Agora as equipes podem iniciar novas conversas limpas.












