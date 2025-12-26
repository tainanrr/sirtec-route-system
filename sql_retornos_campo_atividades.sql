-- ============================================
-- SISTEMA DE RETORNOS DE CAMPO E ATIVIDADES
-- Para medição de produção das equipes
-- ============================================

-- ============================================
-- 1. TABELA DE ATIVIDADES (Tabela de Preço)
-- ============================================
-- Cadastro geral de atividades que podem ser executadas
CREATE TABLE IF NOT EXISTS atividades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Identificação
    codigo VARCHAR(50) NOT NULL UNIQUE,
    descricao VARCHAR(255) NOT NULL,
    
    -- Valores e métricas
    valor_unitario DECIMAL(10, 2) DEFAULT 0,
    unidade VARCHAR(20) DEFAULT 'UN', -- UN, M, M2, M3, KG, etc.
    
    -- Categorização
    categoria VARCHAR(100), -- Ex: "Instalação", "Manutenção", "Remoção"
    grupo VARCHAR(100), -- Ex: "Ramal", "Medidor", "Poste"
    
    -- Configurações
    ativo BOOLEAN DEFAULT true,
    requer_foto BOOLEAN DEFAULT false,
    qtd_min_fotos INTEGER DEFAULT 0,
    
    -- Metadados
    observacoes TEXT
);

-- ============================================
-- 2. TABELA DE RETORNOS DE CAMPO
-- ============================================
-- Cadastro geral de possíveis retornos de campo
CREATE TABLE IF NOT EXISTS retornos_campo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Identificação
    codigo VARCHAR(50) NOT NULL UNIQUE,
    descricao VARCHAR(255) NOT NULL,
    
    -- Categorização
    tipo VARCHAR(50) DEFAULT 'executado', -- 'executado', 'impedimento', 'parcial'
    categoria VARCHAR(100), -- Ex: "Técnico", "Acesso", "Cliente"
    
    -- Configurações
    ativo BOOLEAN DEFAULT true,
    gera_producao BOOLEAN DEFAULT true, -- Se conta para produção
    finaliza_os BOOLEAN DEFAULT true, -- Se finaliza a OS
    requer_justificativa BOOLEAN DEFAULT false,
    
    -- Aparência
    cor VARCHAR(20), -- Cor para exibição no app/web
    icone VARCHAR(50), -- Ícone para exibição
    
    -- Metadados
    observacoes TEXT
);

-- ============================================
-- 3. TABELA DE VÍNCULO: TIPO SERVIÇO -> RETORNOS
-- ============================================
-- Quais retornos de campo estão disponíveis para cada tipo de serviço
-- OBS: A tabela de tipos de serviço no sistema se chama "skills"
CREATE TABLE IF NOT EXISTS tipo_servico_retornos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Relacionamentos
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    retorno_campo_id UUID NOT NULL REFERENCES retornos_campo(id) ON DELETE CASCADE,
    
    -- Configurações específicas para este tipo de serviço
    ordem INTEGER DEFAULT 0, -- Ordem de exibição
    ativo BOOLEAN DEFAULT true,
    padrao BOOLEAN DEFAULT false, -- Se é o retorno padrão sugerido
    
    UNIQUE(skill_id, retorno_campo_id)
);

-- ============================================
-- 4. TABELA DE VÍNCULO: RETORNO -> ATIVIDADES
-- ============================================
-- Quais atividades estão vinculadas a cada retorno de campo (por tipo de serviço)
CREATE TABLE IF NOT EXISTS tipo_servico_retorno_atividades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Relacionamentos
    tipo_servico_retorno_id UUID NOT NULL REFERENCES tipo_servico_retornos(id) ON DELETE CASCADE,
    atividade_id UUID NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    
    -- Configurações da atividade para este retorno
    situacao VARCHAR(30) DEFAULT 'opcional_nao_selecionado', 
    -- 'obrigatorio', 'opcional_selecionado', 'opcional_nao_selecionado'
    
    quantidade_padrao INTEGER DEFAULT 1,
    permite_alterar_qtd BOOLEAN DEFAULT true, -- Se pode alterar quantidade no PDA
    permite_alterar_valor BOOLEAN DEFAULT false, -- Se pode alterar valor no PDA
    qtd_min_fotos INTEGER DEFAULT 0,
    
    -- Limites
    qtd_minima INTEGER DEFAULT 0,
    qtd_maxima INTEGER DEFAULT 999,
    
    -- Ordem de exibição
    ordem INTEGER DEFAULT 0,
    
    UNIQUE(tipo_servico_retorno_id, atividade_id)
);

-- ============================================
-- GARANTIR COLUNAS (caso tabelas já existam)
-- ============================================
-- Adicionar colunas que podem não existir em tabelas pré-existentes

-- Colunas da tabela atividades
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS valor_unitario DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS unidade VARCHAR(20) DEFAULT 'UN';
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS grupo VARCHAR(100);
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS requer_foto BOOLEAN DEFAULT false;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS qtd_min_fotos INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Colunas da tabela retornos_campo
ALTER TABLE retornos_campo ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'executado';
ALTER TABLE retornos_campo ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
ALTER TABLE retornos_campo ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
ALTER TABLE retornos_campo ADD COLUMN IF NOT EXISTS gera_producao BOOLEAN DEFAULT true;
ALTER TABLE retornos_campo ADD COLUMN IF NOT EXISTS finaliza_os BOOLEAN DEFAULT true;
ALTER TABLE retornos_campo ADD COLUMN IF NOT EXISTS requer_justificativa BOOLEAN DEFAULT false;
ALTER TABLE retornos_campo ADD COLUMN IF NOT EXISTS cor VARCHAR(20);
ALTER TABLE retornos_campo ADD COLUMN IF NOT EXISTS icone VARCHAR(50);
ALTER TABLE retornos_campo ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- ============================================
-- REMOVER CHECK CONSTRAINT ANTIGA (se existir)
-- ============================================
-- A constraint antiga pode ter valores diferentes ('sucesso' vs 'executado')
ALTER TABLE retornos_campo DROP CONSTRAINT IF EXISTS retornos_campo_tipo_check;

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_atividades_codigo ON atividades(codigo);
CREATE INDEX IF NOT EXISTS idx_atividades_ativo ON atividades(ativo);
CREATE INDEX IF NOT EXISTS idx_atividades_categoria ON atividades(categoria);

CREATE INDEX IF NOT EXISTS idx_retornos_campo_codigo ON retornos_campo(codigo);
CREATE INDEX IF NOT EXISTS idx_retornos_campo_ativo ON retornos_campo(ativo);
CREATE INDEX IF NOT EXISTS idx_retornos_campo_tipo ON retornos_campo(tipo);

CREATE INDEX IF NOT EXISTS idx_tipo_servico_retornos_skill ON tipo_servico_retornos(skill_id);
CREATE INDEX IF NOT EXISTS idx_tipo_servico_retornos_retorno ON tipo_servico_retornos(retorno_campo_id);

CREATE INDEX IF NOT EXISTS idx_retorno_atividades_retorno ON tipo_servico_retorno_atividades(tipo_servico_retorno_id);
CREATE INDEX IF NOT EXISTS idx_retorno_atividades_atividade ON tipo_servico_retorno_atividades(atividade_id);

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atividades_updated_at ON atividades;
CREATE TRIGGER trigger_atividades_updated_at
    BEFORE UPDATE ON atividades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_retornos_campo_updated_at ON retornos_campo;
CREATE TRIGGER trigger_retornos_campo_updated_at
    BEFORE UPDATE ON retornos_campo
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_retorno_atividades_updated_at ON tipo_servico_retorno_atividades;
CREATE TRIGGER trigger_retorno_atividades_updated_at
    BEFORE UPDATE ON tipo_servico_retorno_atividades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE retornos_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_servico_retornos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_servico_retorno_atividades ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas
DROP POLICY IF EXISTS "Allow all atividades" ON atividades;
CREATE POLICY "Allow all atividades" ON atividades FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all retornos_campo" ON retornos_campo;
CREATE POLICY "Allow all retornos_campo" ON retornos_campo FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all tipo_servico_retornos" ON tipo_servico_retornos;
CREATE POLICY "Allow all tipo_servico_retornos" ON tipo_servico_retornos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all tipo_servico_retorno_atividades" ON tipo_servico_retorno_atividades;
CREATE POLICY "Allow all tipo_servico_retorno_atividades" ON tipo_servico_retorno_atividades FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- DADOS DE EXEMPLO - RETORNOS DE CAMPO COMUNS
-- ============================================
-- Inserir apenas se não existir (sem depender de UNIQUE constraint)
INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '95012', 'MONO-Poste e Ramal', 'executado', 'Instalação', true, true, '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '95012');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '95019', 'POLI-Poste e Ramal', 'executado', 'Instalação', true, true, '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '95019');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '95028', 'MONO-Multiplas UCs', 'executado', 'Instalação', true, true, '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '95028');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '95029', 'POLI-Multiplas UCs', 'executado', 'Instalação', true, true, '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '95029');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '99', 'Impedimento - Deficiencia Tecnica - Falta Material', 'impedimento', 'Técnico', false, true, '#ef4444'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '99');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96004', 'Impedimento - Deficiencia Tecnica', 'impedimento', 'Técnico', false, true, '#ef4444'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96004');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96005', 'Impedimento - Dificil Acesso', 'impedimento', 'Acesso', false, true, '#f97316'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96005');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96007', 'Impedimento - Local Fechado', 'impedimento', 'Acesso', false, true, '#f97316'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96007');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96017', 'Impedimento - Nao Localizado', 'impedimento', 'Acesso', false, true, '#f97316'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96017');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96047', 'Impedimento - Dificil Acesso (Chuva)', 'impedimento', 'Clima', false, true, '#f97316'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96047');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96018', 'Necessario Obra no Local', 'impedimento', 'Técnico', false, true, '#eab308'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96018');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96021', 'Servico Ja Realizado (Coletar Dados)', 'parcial', 'Verificação', false, true, '#3b82f6'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96021');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96029', 'Cliente Desistiu do Servico', 'impedimento', 'Cliente', false, true, '#ef4444'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96029');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96030', 'Apresentar Projeto', 'impedimento', 'Documentação', false, true, '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96030');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96031', 'Cadastro Incorreto', 'impedimento', 'Documentação', false, true, '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96031');

INSERT INTO retornos_campo (codigo, descricao, tipo, categoria, gera_producao, finaliza_os, cor)
SELECT '96032', 'Trata-se de Reativacao', 'impedimento', 'Documentação', false, true, '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM retornos_campo WHERE codigo = '96032');

-- ============================================
-- DADOS DE EXEMPLO - ATIVIDADES
-- ============================================
INSERT INTO atividades (codigo, descricao, categoria, grupo, requer_foto, qtd_min_fotos)
SELECT 'SDCLU6012II', 'INSTALAR RAMAL DE LIG POLI-BT', 'Instalação', 'Ramal', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atividades WHERE codigo = 'SDCLU6012II');

INSERT INTO atividades (codigo, descricao, categoria, grupo, requer_foto, qtd_min_fotos)
SELECT 'SDCLU6013II', 'INSTALAR RAMAL DE LIG-MONO-BT', 'Instalação', 'Ramal', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atividades WHERE codigo = 'SDCLU6013II');

INSERT INTO atividades (codigo, descricao, categoria, grupo, requer_foto, qtd_min_fotos)
SELECT 'SDCLU6016II', 'INSTALAR MEDIDOR MONO-BT', 'Instalação', 'Medidor', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atividades WHERE codigo = 'SDCLU6016II');

INSERT INTO atividades (codigo, descricao, categoria, grupo, requer_foto, qtd_min_fotos)
SELECT 'SDCLU6017II', 'INSTALAR MEDIDOR POLI-BT', 'Instalação', 'Medidor', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atividades WHERE codigo = 'SDCLU6017II');

INSERT INTO atividades (codigo, descricao, categoria, grupo, requer_foto, qtd_min_fotos)
SELECT 'SDCLU6032II', 'INSTALAR POSTE AUX 7M', 'Instalação', 'Poste', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atividades WHERE codigo = 'SDCLU6032II');

INSERT INTO atividades (codigo, descricao, categoria, grupo, requer_foto, qtd_min_fotos)
SELECT 'SDCLU6019SC', 'LIGACAO NAO EFET S/ACESSO PAD-BT-TECNICA', 'Impedimento', 'Sem Acesso', true, 3
WHERE NOT EXISTS (SELECT 1 FROM atividades WHERE codigo = 'SDCLU6019SC');

INSERT INTO atividades (codigo, descricao, categoria, grupo, requer_foto, qtd_min_fotos)
SELECT 'SDCLU6020SC', 'SERV NAO EFETUADO SEM ACESSO PAD-BT', 'Impedimento', 'Sem Acesso', true, 2
WHERE NOT EXISTS (SELECT 1 FROM atividades WHERE codigo = 'SDCLU6020SC');

-- ============================================
-- DADOS DE EXEMPLO - LIGAÇÃO NOVA
-- ============================================
-- Vincular retornos e atividades ao tipo de serviço "LIGACAO"

DO $$
DECLARE
    v_skill_id UUID;
    v_retorno_id UUID;
    v_vinculo_id UUID;
    v_atividade_id UUID;
BEGIN
    -- Buscar o skill "LIGACAO" (Ligação Nova)
    SELECT id INTO v_skill_id FROM skills WHERE codigo = 'LIGACAO' LIMIT 1;
    
    IF v_skill_id IS NULL THEN
        RAISE NOTICE 'Skill LIGACAO não encontrada. Pulando inserção de dados de exemplo.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Configurando retornos para skill LIGACAO (ID: %)', v_skill_id;

    -- ============================================
    -- 1. RETORNO: 99 - Impedimento - Deficiencia Tecnica - Falta Material
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '99' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 0, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        -- Sem atividades vinculadas
    END IF;

    -- ============================================
    -- 2. RETORNO: 95012 - MONO-Poste e Ramal
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '95012' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 1, true, true
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6012II - Opcional não selecionado
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6012II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'opcional_nao_selecionado', 1, true, 1, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6013II - Obrigatório
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6013II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 1, 1
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6016II - Obrigatório
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6016II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 1, 2
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6032II - Opcional não selecionado
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6032II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'opcional_nao_selecionado', 1, true, 1, 3
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 3. RETORNO: 95019 - POLI-Poste e Ramal
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '95019' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 2, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6012II - Obrigatório
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6012II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 1, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6017II - Obrigatório
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6017II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 1, 1
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6032II - Opcional não selecionado
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6032II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'opcional_nao_selecionado', 1, true, 1, 2
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 4. RETORNO: 95028 - MONO-Multiplas UCs
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '95028' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 3, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6012II - Opcional não selecionado
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6012II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'opcional_nao_selecionado', 1, true, 1, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6013II - Opcional não selecionado
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6013II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'opcional_nao_selecionado', 1, true, 1, 1
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6016II - Obrigatório
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6016II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, true, 1, 2
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6032II - Opcional não selecionado
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6032II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'opcional_nao_selecionado', 1, true, 1, 3
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 5. RETORNO: 95029 - POLI-Multiplas UCs
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '95029' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 4, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6017II - Obrigatório
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6017II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, true, 1, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6032II - Opcional não selecionado
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6032II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'opcional_nao_selecionado', 1, true, 1, 1
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
            
            -- SDCLU6012II - Opcional não selecionado
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6012II';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'opcional_nao_selecionado', 1, false, 1, 2
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 6. RETORNO: 96004 - Impedimento - Deficiencia Tecnica
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96004' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 5, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6019SC - Obrigatório, 3 fotos
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6019SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 3, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 7. RETORNO: 96005 - Impedimento - Dificil Acesso
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96005' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 6, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6020SC - Obrigatório, 2 fotos
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6020SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, true, 2, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 8. RETORNO: 96007 - Impedimento - Local Fechado
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96007' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 7, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6020SC - Obrigatório, 2 fotos
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6020SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 2, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 9. RETORNO: 96017 - Impedimento - Nao Localizado
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96017' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 8, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6020SC - Obrigatório, 2 fotos
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6020SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 2, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 10. RETORNO: 96018 - Necessario Obra no Local
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96018' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 9, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6020SC - Obrigatório, 3 fotos
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6020SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 3, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 11. RETORNO: 96021 - Servico Ja Realizado
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96021' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 10, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6020SC - Obrigatório, 1 foto
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6020SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 1, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 12. RETORNO: 96029 - Cliente Desistiu do Servico
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96029' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 11, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6020SC - Obrigatório, 2 fotos
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6020SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 2, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 13. RETORNO: 96030 - Apresentar Projeto
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96030' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 12, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6020SC - Obrigatório, 2 fotos
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6020SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 2, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 14. RETORNO: 96031 - Cadastro Incorreto
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96031' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 13, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6020SC - Obrigatório, 2 fotos
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6020SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 2, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 15. RETORNO: 96032 - Trata-se de Reativacao
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96032' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 14, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        
        SELECT id INTO v_vinculo_id FROM tipo_servico_retornos 
        WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id;
        
        IF v_vinculo_id IS NOT NULL THEN
            -- SDCLU6020SC - Obrigatório, 1 foto
            SELECT id INTO v_atividade_id FROM atividades WHERE codigo = 'SDCLU6020SC';
            IF v_atividade_id IS NOT NULL THEN
                INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
                SELECT v_vinculo_id, v_atividade_id, 'obrigatorio', 1, false, 1, 0
                WHERE NOT EXISTS (SELECT 1 FROM tipo_servico_retorno_atividades WHERE tipo_servico_retorno_id = v_vinculo_id AND atividade_id = v_atividade_id);
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- 16. RETORNO: 96047 - Impedimento - Dificil Acesso (Chuva)
    -- ============================================
    SELECT id INTO v_retorno_id FROM retornos_campo WHERE codigo = '96047' LIMIT 1;
    IF v_retorno_id IS NOT NULL THEN
        INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo, padrao)
        SELECT v_skill_id, v_retorno_id, 15, true, false
        WHERE NOT EXISTS (
            SELECT 1 FROM tipo_servico_retornos 
            WHERE skill_id = v_skill_id AND retorno_campo_id = v_retorno_id
        );
        -- Sem atividades vinculadas
    END IF;

    RAISE NOTICE 'Dados de exemplo para LIGACAO inseridos com sucesso!';
END $$;

SELECT 'Tabelas de Retornos de Campo e Atividades criadas com sucesso!' as status;

