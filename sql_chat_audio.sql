-- ============================================
-- SUPORTE A MENSAGENS DE ÁUDIO NO CHAT
-- ============================================

-- Atualizar o check constraint da coluna tipo para incluir 'audio'
ALTER TABLE chat_mensagens DROP CONSTRAINT IF EXISTS chat_mensagens_tipo_check;
ALTER TABLE chat_mensagens ADD CONSTRAINT chat_mensagens_tipo_check 
    CHECK (tipo IN ('texto', 'imagem', 'arquivo', 'localizacao', 'audio', 'sistema'));

-- Adicionar coluna para duração do áudio (em segundos)
ALTER TABLE chat_mensagens ADD COLUMN IF NOT EXISTS audio_duracao INTEGER;

-- Criar index para filtrar mensagens de áudio se necessário
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_tipo ON chat_mensagens(tipo);

-- Atualizar a função de preview para mostrar ícone de áudio
CREATE OR REPLACE FUNCTION update_conversa_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversas
    SET 
        ultima_mensagem_id = NEW.id,
        ultima_mensagem_at = NEW.created_at,
        ultima_mensagem_preview = CASE 
            WHEN NEW.tipo = 'audio' THEN '🎤 Mensagem de voz'
            WHEN NEW.tipo = 'imagem' THEN '📷 Imagem'
            WHEN NEW.tipo = 'localizacao' THEN '📍 Localização'
            ELSE LEFT(NEW.conteudo, 100)
        END,
        updated_at = NOW(),
        -- Incrementar contador de não lidas
        nao_lidas_torre = CASE 
            WHEN NEW.remetente_tipo = 'equipe' THEN nao_lidas_torre + 1 
            ELSE nao_lidas_torre 
        END,
        nao_lidas_equipe = CASE 
            WHEN NEW.remetente_tipo = 'torre' THEN nao_lidas_equipe + 1 
            ELSE nao_lidas_equipe 
        END
    WHERE id = NEW.conversa_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SELECT 'Audio support added to chat!' as status;















