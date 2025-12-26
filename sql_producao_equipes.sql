-- ============================================
-- SISTEMA DE PRODUÇÃO DAS EQUIPES
-- Registro de atividades executadas
-- ============================================

-- ============================================
-- 1. TABELA PRINCIPAL DE PRODUÇÃO
-- ============================================
CREATE TABLE IF NOT EXISTS producao_equipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Relacionamentos
    ordem_servico_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
    equipe_id UUID REFERENCES tecnicos(id) ON DELETE SET NULL, -- Tabela de equipes = tecnicos
    retorno_campo_id UUID REFERENCES retornos_campo(id) ON DELETE SET NULL,
    
    -- Dados do retorno
    retorno_codigo VARCHAR(50),
    retorno_descricao VARCHAR(255),
    gera_producao BOOLEAN DEFAULT true,
    
    -- Valores
    valor_total DECIMAL(10, 2) DEFAULT 0,
    
    -- Timestamps
    data_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadados
    observacoes TEXT,
    
    -- Localização (se disponível)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8)
);

-- ============================================
-- 2. TABELA DE ATIVIDADES DA PRODUÇÃO
-- ============================================
CREATE TABLE IF NOT EXISTS producao_atividades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Relacionamentos
    producao_id UUID NOT NULL REFERENCES producao_equipes(id) ON DELETE CASCADE,
    atividade_id UUID REFERENCES atividades(id) ON DELETE SET NULL,
    
    -- Dados da atividade
    atividade_codigo VARCHAR(50),
    atividade_descricao VARCHAR(255),
    
    -- Quantidades e valores
    quantidade INTEGER DEFAULT 1,
    valor_unitario DECIMAL(10, 2) DEFAULT 0,
    valor_total DECIMAL(10, 2) DEFAULT 0,
    
    -- Configurações
    qtd_min_fotos INTEGER DEFAULT 0,
    fotos_registradas INTEGER DEFAULT 0
);

-- ============================================
-- 3. ADICIONAR COLUNAS À TABELA ORDENS_SERVICO
-- ============================================
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS retorno_campo_codigo VARCHAR(50);
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS retorno_campo_descricao VARCHAR(255);
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS gera_producao BOOLEAN DEFAULT true;

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_producao_equipes_ordem ON producao_equipes(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_producao_equipes_equipe ON producao_equipes(equipe_id);
CREATE INDEX IF NOT EXISTS idx_producao_equipes_data ON producao_equipes(data_registro);
CREATE INDEX IF NOT EXISTS idx_producao_equipes_retorno ON producao_equipes(retorno_campo_id);

CREATE INDEX IF NOT EXISTS idx_producao_atividades_producao ON producao_atividades(producao_id);
CREATE INDEX IF NOT EXISTS idx_producao_atividades_atividade ON producao_atividades(atividade_id);

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================
DROP TRIGGER IF EXISTS trigger_producao_equipes_updated_at ON producao_equipes;
CREATE TRIGGER trigger_producao_equipes_updated_at
    BEFORE UPDATE ON producao_equipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE producao_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao_atividades ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas
DROP POLICY IF EXISTS "Allow all producao_equipes" ON producao_equipes;
CREATE POLICY "Allow all producao_equipes" ON producao_equipes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all producao_atividades" ON producao_atividades;
CREATE POLICY "Allow all producao_atividades" ON producao_atividades FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View de produção diária por equipe
CREATE OR REPLACE VIEW v_producao_diaria_equipe AS
SELECT 
    pe.equipe_id,
    t.codigo AS equipe_codigo,
    t.nome AS equipe_nome,
    DATE(pe.data_registro) AS data,
    COUNT(pe.id) AS total_servicos,
    SUM(CASE WHEN pe.gera_producao THEN 1 ELSE 0 END) AS servicos_produtivos,
    SUM(CASE WHEN NOT pe.gera_producao THEN 1 ELSE 0 END) AS servicos_improdutivos,
    SUM(pe.valor_total) AS valor_total
FROM producao_equipes pe
LEFT JOIN tecnicos t ON t.id = pe.equipe_id
GROUP BY pe.equipe_id, t.codigo, t.nome, DATE(pe.data_registro);

-- View de produção por retorno de campo
CREATE OR REPLACE VIEW v_producao_por_retorno AS
SELECT 
    pe.retorno_campo_id,
    pe.retorno_codigo,
    pe.retorno_descricao,
    rc.tipo AS retorno_tipo,
    COUNT(pe.id) AS total_ocorrencias,
    SUM(pe.valor_total) AS valor_total
FROM producao_equipes pe
LEFT JOIN retornos_campo rc ON rc.id = pe.retorno_campo_id
GROUP BY pe.retorno_campo_id, pe.retorno_codigo, pe.retorno_descricao, rc.tipo;

SELECT 'Tabelas de Produção das Equipes criadas com sucesso!' as status;

