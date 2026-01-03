-- ============================================
-- SISTEMA DE CHAT - TORRE DE CONTROLE <-> EQUIPES
-- ============================================

-- Tabela de conversas
CREATE TABLE IF NOT EXISTS chat_conversas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Tipo: 'direto' (1-1 com equipe), 'grupo' (broadcast), 'suporte' (atendimento)
    tipo VARCHAR(20) DEFAULT 'direto' CHECK (tipo IN ('direto', 'grupo', 'suporte')),
    
    -- Para conversas diretas
    equipe_id UUID REFERENCES tecnicos(id) ON DELETE CASCADE,
    
    -- Para grupos/broadcasts
    titulo VARCHAR(255),
    descricao TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'arquivado', 'fechado')),
    
    -- Última mensagem (para ordenação e preview)
    ultima_mensagem_id UUID,
    ultima_mensagem_at TIMESTAMP WITH TIME ZONE,
    ultima_mensagem_preview TEXT,
    
    -- Contador de mensagens não lidas por lado
    nao_lidas_torre INTEGER DEFAULT 0,
    nao_lidas_equipe INTEGER DEFAULT 0
);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS chat_mensagens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Conversa
    conversa_id UUID REFERENCES chat_conversas(id) ON DELETE CASCADE NOT NULL,
    
    -- Remetente
    remetente_tipo VARCHAR(20) NOT NULL CHECK (remetente_tipo IN ('torre', 'equipe')),
    remetente_id UUID, -- usuario_web_id ou equipe_id
    remetente_nome VARCHAR(255),
    
    -- Conteúdo
    tipo VARCHAR(20) DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'arquivo', 'localizacao', 'sistema')),
    conteudo TEXT,
    
    -- Para imagens/arquivos
    arquivo_url TEXT,
    arquivo_nome VARCHAR(255),
    arquivo_tipo VARCHAR(100),
    arquivo_tamanho INTEGER,
    
    -- Para localização
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Status da mensagem
    status VARCHAR(20) DEFAULT 'enviada' CHECK (status IN ('enviando', 'enviada', 'entregue', 'lida', 'erro')),
    lida_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados extras
    metadata JSONB DEFAULT '{}'
);

-- Tabela de participantes (para grupos/broadcasts)
CREATE TABLE IF NOT EXISTS chat_participantes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    conversa_id UUID REFERENCES chat_conversas(id) ON DELETE CASCADE NOT NULL,
    equipe_id UUID REFERENCES tecnicos(id) ON DELETE CASCADE NOT NULL,
    
    -- Permissões
    pode_enviar BOOLEAN DEFAULT true,
    silenciado BOOLEAN DEFAULT false,
    
    -- Última leitura
    ultima_leitura_at TIMESTAMP WITH TIME ZONE,
    mensagens_nao_lidas INTEGER DEFAULT 0,
    
    UNIQUE(conversa_id, equipe_id)
);

-- Tabela de notificações de chat
CREATE TABLE IF NOT EXISTS chat_notificacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    mensagem_id UUID REFERENCES chat_mensagens(id) ON DELETE CASCADE NOT NULL,
    destinatario_tipo VARCHAR(20) NOT NULL CHECK (destinatario_tipo IN ('torre', 'equipe')),
    destinatario_id UUID,
    
    -- Status
    visualizada BOOLEAN DEFAULT false,
    visualizada_at TIMESTAMP WITH TIME ZONE,
    
    -- Push notification
    push_enviado BOOLEAN DEFAULT false,
    push_enviado_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa ON chat_mensagens(conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_status ON chat_mensagens(status);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_equipe ON chat_conversas(equipe_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_ultima ON chat_conversas(ultima_mensagem_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_participantes_equipe ON chat_participantes(equipe_id);
CREATE INDEX IF NOT EXISTS idx_chat_notificacoes_dest ON chat_notificacoes(destinatario_tipo, destinatario_id, visualizada);

-- Função para atualizar conversa quando nova mensagem é enviada
CREATE OR REPLACE FUNCTION update_conversa_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversas
    SET 
        ultima_mensagem_id = NEW.id,
        ultima_mensagem_at = NEW.created_at,
        ultima_mensagem_preview = LEFT(NEW.conteudo, 100),
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

-- Trigger para atualizar conversa
DROP TRIGGER IF EXISTS trigger_update_conversa_on_message ON chat_mensagens;
CREATE TRIGGER trigger_update_conversa_on_message
    AFTER INSERT ON chat_mensagens
    FOR EACH ROW
    EXECUTE FUNCTION update_conversa_on_message();

-- Função para marcar mensagens como lidas
CREATE OR REPLACE FUNCTION marcar_mensagens_lidas(
    p_conversa_id UUID,
    p_tipo_leitor VARCHAR(20) -- 'torre' ou 'equipe'
)
RETURNS void AS $$
BEGIN
    -- Atualizar status das mensagens
    UPDATE chat_mensagens
    SET 
        status = 'lida',
        lida_at = NOW()
    WHERE conversa_id = p_conversa_id
      AND remetente_tipo != p_tipo_leitor
      AND status != 'lida';
    
    -- Zerar contador de não lidas
    IF p_tipo_leitor = 'torre' THEN
        UPDATE chat_conversas SET nao_lidas_torre = 0 WHERE id = p_conversa_id;
    ELSE
        UPDATE chat_conversas SET nao_lidas_equipe = 0 WHERE id = p_conversa_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security)
ALTER TABLE chat_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_notificacoes ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (ajustar conforme necessidade)
DROP POLICY IF EXISTS "Allow all chat_conversas" ON chat_conversas;
CREATE POLICY "Allow all chat_conversas" ON chat_conversas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all chat_mensagens" ON chat_mensagens;
CREATE POLICY "Allow all chat_mensagens" ON chat_mensagens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all chat_participantes" ON chat_participantes;
CREATE POLICY "Allow all chat_participantes" ON chat_participantes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all chat_notificacoes" ON chat_notificacoes;
CREATE POLICY "Allow all chat_notificacoes" ON chat_notificacoes FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para as tabelas de chat
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_mensagens;

-- Criar bucket de storage para arquivos do chat (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Política de storage
DROP POLICY IF EXISTS "Allow public access chat-attachments" ON storage.objects;
CREATE POLICY "Allow public access chat-attachments" ON storage.objects
    FOR ALL USING (bucket_id = 'chat-attachments')
    WITH CHECK (bucket_id = 'chat-attachments');

SELECT 'Chat tables created successfully!' as status;










