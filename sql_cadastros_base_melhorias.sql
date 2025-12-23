-- =====================================================
-- SQL Script: Melhorias Cadastros Base
-- Autor: Sistema
-- Data: 2025
-- Descrição: Adiciona tabelas para Precificação de Serviços,
--            Unidades de Medida, Grupos de Serviço, Feriados,
--            e melhorias em Centros de Custo
-- =====================================================

-- =====================================================
-- 1. UNIDADES DE MEDIDA
-- =====================================================
CREATE TABLE IF NOT EXISTS public.unidades_medida (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(10) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    simbolo VARCHAR(10),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.unidades_medida IS 'Unidades de medida para serviços (UD, M, KM, H, etc)';

-- Inserir unidades padrão
INSERT INTO public.unidades_medida (codigo, nome, simbolo, ativo) VALUES
('UD', 'Unidade', 'ud', true),
('M', 'Metro', 'm', true),
('KM', 'Quilômetro', 'km', true),
('H', 'Hora', 'h', true),
('M2', 'Metro Quadrado', 'm²', true),
('M3', 'Metro Cúbico', 'm³', true),
('UN', 'Unidade', 'un', true),
('PC', 'Peça', 'pç', true),
('CJ', 'Conjunto', 'cj', true),
('VB', 'Verba', 'vb', true)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- 2. GRUPOS DE SERVIÇO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grupos_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    contrato_id UUID REFERENCES public.contratos(id),
    cor VARCHAR(7) DEFAULT '#3B82F6',
    ordem INT DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(codigo, contrato_id)
);

COMMENT ON TABLE public.grupos_servico IS 'Grupos para categorização de serviços';

-- =====================================================
-- 3. PRECIFICAÇÃO DE SERVIÇOS (Tabela Principal)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.precificacao_servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_servico VARCHAR(50) NOT NULL,
    codigo_referencia VARCHAR(50),
    descricao VARCHAR(500) NOT NULL,
    
    -- Valores
    fator_k DECIMAL(10, 6) DEFAULT 1.000000,
    valor_unitario DECIMAL(15, 6) NOT NULL,
    valor_total DECIMAL(15, 6) GENERATED ALWAYS AS (fator_k * valor_unitario) STORED,
    coeficiente DECIMAL(15, 7) DEFAULT 1.0000000,
    fracao_preco_pai DECIMAL(10, 7) DEFAULT 0.0000000,
    
    -- Referências
    unidade_id UUID REFERENCES public.unidades_medida(id),
    grupo_id UUID REFERENCES public.grupos_servico(id),
    contrato_id UUID REFERENCES public.contratos(id) NOT NULL,
    preco_pai_id UUID REFERENCES public.precificacao_servicos(id),
    territorio_id UUID REFERENCES public.territorios(id),
    
    -- Vigência
    data_inicio DATE NOT NULL,
    data_fim DATE,
    
    -- Configurações
    casas_decimais INT DEFAULT 2 CHECK (casas_decimais >= 0 AND casas_decimais <= 7),
    permite_maior_previsto BOOLEAN DEFAULT false,
    qtd_maior_previsto DECIMAL(15, 7) DEFAULT 999999.9999999,
    
    -- Status
    ativo BOOLEAN DEFAULT true,
    
    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.usuarios_web(id),
    updated_by UUID REFERENCES public.usuarios_web(id),
    
    UNIQUE(codigo_servico, contrato_id, data_inicio)
);

COMMENT ON TABLE public.precificacao_servicos IS 'Tabela de precificação de serviços por contrato com vigência';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_precificacao_contrato ON public.precificacao_servicos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_precificacao_vigencia ON public.precificacao_servicos(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_precificacao_codigo ON public.precificacao_servicos(codigo_servico);
CREATE INDEX IF NOT EXISTS idx_precificacao_ativo ON public.precificacao_servicos(ativo) WHERE ativo = true;

-- =====================================================
-- 4. HISTÓRICO DO FATOR K
-- =====================================================
CREATE TABLE IF NOT EXISTS public.historico_fator_k (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    precificacao_id UUID REFERENCES public.precificacao_servicos(id) ON DELETE CASCADE,
    contrato_id UUID REFERENCES public.contratos(id),
    ano INT NOT NULL,
    fator_k_anterior DECIMAL(10, 6),
    fator_k_novo DECIMAL(10, 6) NOT NULL,
    data_aplicacao DATE NOT NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.usuarios_web(id)
);

COMMENT ON TABLE public.historico_fator_k IS 'Histórico de atualizações do Fator K';

-- =====================================================
-- 5. FERIADOS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.feriados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    nome VARCHAR(200) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('nacional', 'estadual', 'municipal', 'ponto_facultativo')),
    estado VARCHAR(2),
    cidade VARCHAR(200),
    contrato_id UUID REFERENCES public.contratos(id),
    recorrente BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(data, contrato_id)
);

COMMENT ON TABLE public.feriados IS 'Cadastro de feriados para cálculo de prazos';

-- Inserir feriados nacionais 2025
INSERT INTO public.feriados (data, nome, tipo, recorrente, ativo) VALUES
('2025-01-01', 'Confraternização Universal', 'nacional', true, true),
('2025-04-18', 'Sexta-feira Santa', 'nacional', false, true),
('2025-04-21', 'Tiradentes', 'nacional', true, true),
('2025-05-01', 'Dia do Trabalho', 'nacional', true, true),
('2025-09-07', 'Independência do Brasil', 'nacional', true, true),
('2025-10-12', 'Nossa Senhora Aparecida', 'nacional', true, true),
('2025-11-02', 'Finados', 'nacional', true, true),
('2025-11-15', 'Proclamação da República', 'nacional', true, true),
('2025-12-25', 'Natal', 'nacional', true, true)
ON CONFLICT (data, contrato_id) DO NOTHING;

-- =====================================================
-- 6. MOTIVOS DE CANCELAMENTO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.motivos_cancelamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('os', 'rota', 'agendamento', 'turno', 'outro')),
    requer_justificativa BOOLEAN DEFAULT false,
    gera_reagendamento BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.motivos_cancelamento IS 'Motivos padrão para cancelamentos';

-- Inserir motivos padrão
INSERT INTO public.motivos_cancelamento (codigo, nome, tipo, requer_justificativa, gera_reagendamento, ativo) VALUES
('CLI_AUSENTE', 'Cliente Ausente', 'os', false, true, true),
('END_NAO_LOC', 'Endereço Não Localizado', 'os', true, false, true),
('RECUSA_CLI', 'Recusa do Cliente', 'os', true, false, true),
('IMP_ACESSO', 'Impedimento de Acesso', 'os', true, true, true),
('FALTA_MAT', 'Falta de Material', 'os', true, true, true),
('PROB_VEIC', 'Problema com Veículo', 'rota', true, true, true),
('PROB_EQUIPE', 'Problema com Equipe', 'rota', true, true, true),
('CHUVA', 'Chuva Forte', 'rota', false, true, true),
('DUPLICIDADE', 'OS Duplicada', 'os', false, false, true),
('CANC_SOLIC', 'Cancelado pelo Solicitante', 'os', true, false, true)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- 7. MELHORIAS NA TABELA CENTROS DE CUSTO
-- =====================================================
ALTER TABLE public.centros_custo 
ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES public.usuarios_web(id),
ADD COLUMN IF NOT EXISTS orcamento_previsto DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS orcamento_utilizado DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS centro_pai_id UUID REFERENCES public.centros_custo(id),
ADD COLUMN IF NOT EXISTS nivel INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- =====================================================
-- 8. TIPOS DE OCORRÊNCIA
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tipos_ocorrencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    severidade VARCHAR(20) CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
    requer_acao BOOLEAN DEFAULT false,
    prazo_resolucao_horas INT,
    cor VARCHAR(7) DEFAULT '#3B82F6',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.tipos_ocorrencia IS 'Tipos de ocorrências do sistema';

-- =====================================================
-- 9. PARÂMETROS DE SLA
-- =====================================================
CREATE TABLE IF NOT EXISTS public.parametros_sla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(200) NOT NULL,
    contrato_id UUID REFERENCES public.contratos(id),
    tipo_servico_id UUID REFERENCES public.tipos_servico_contrato(id),
    prioridade VARCHAR(20) CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente', 'emergencia')),
    tempo_limite_minutos INT NOT NULL,
    permite_extensao BOOLEAN DEFAULT false,
    max_extensoes INT DEFAULT 0,
    tempo_extensao_minutos INT DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(codigo, contrato_id)
);

COMMENT ON TABLE public.parametros_sla IS 'Parâmetros de SLA por tipo de serviço e contrato';

-- =====================================================
-- 10. VIEWS ÚTEIS
-- =====================================================

-- View de Precificação com detalhes
CREATE OR REPLACE VIEW public.vw_precificacao_detalhada AS
SELECT 
    p.id,
    p.codigo_servico,
    p.codigo_referencia,
    p.descricao,
    p.fator_k,
    p.valor_unitario,
    p.valor_total,
    p.coeficiente,
    p.data_inicio,
    p.data_fim,
    p.casas_decimais,
    p.permite_maior_previsto,
    p.qtd_maior_previsto,
    p.fracao_preco_pai,
    p.ativo,
    u.codigo AS unidade_codigo,
    u.nome AS unidade_nome,
    g.codigo AS grupo_codigo,
    g.nome AS grupo_nome,
    c.codigo AS contrato_codigo,
    c.nome AS contrato_nome,
    pp.codigo_servico AS preco_pai_codigo,
    pp.descricao AS preco_pai_descricao,
    t.nome AS territorio_nome
FROM public.precificacao_servicos p
LEFT JOIN public.unidades_medida u ON p.unidade_id = u.id
LEFT JOIN public.grupos_servico g ON p.grupo_id = g.id
LEFT JOIN public.contratos c ON p.contrato_id = c.id
LEFT JOIN public.precificacao_servicos pp ON p.preco_pai_id = pp.id
LEFT JOIN public.territorios t ON p.territorio_id = t.id;

-- View de Centros de Custo com hierarquia
CREATE OR REPLACE VIEW public.vw_centros_custo_hierarquia AS
SELECT 
    cc.id,
    cc.codigo,
    cc.nome,
    cc.descricao,
    cc.nivel,
    cc.orcamento_previsto,
    cc.orcamento_utilizado,
    cc.ativo,
    c.codigo AS contrato_codigo,
    c.nome AS contrato_nome,
    u.nome AS responsavel_nome,
    pai.codigo AS centro_pai_codigo,
    pai.nome AS centro_pai_nome
FROM public.centros_custo cc
LEFT JOIN public.contratos c ON cc.contrato_id = c.id
LEFT JOIN public.usuarios_web u ON cc.responsavel_id = u.id
LEFT JOIN public.centros_custo pai ON cc.centro_pai_id = pai.id;

-- =====================================================
-- 11. FUNÇÃO PARA ATUALIZAR FATOR K EM MASSA
-- =====================================================
CREATE OR REPLACE FUNCTION public.atualizar_fator_k_contrato(
    p_contrato_id UUID,
    p_novo_fator_k DECIMAL(10, 6),
    p_data_aplicacao DATE,
    p_usuario_id UUID,
    p_observacao TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT := 0;
    v_preco RECORD;
BEGIN
    -- Para cada preço do contrato
    FOR v_preco IN 
        SELECT id, fator_k 
        FROM public.precificacao_servicos 
        WHERE contrato_id = p_contrato_id 
        AND ativo = true
        AND (data_fim IS NULL OR data_fim >= p_data_aplicacao)
    LOOP
        -- Registrar histórico
        INSERT INTO public.historico_fator_k (
            precificacao_id,
            contrato_id,
            ano,
            fator_k_anterior,
            fator_k_novo,
            data_aplicacao,
            observacao,
            created_by
        ) VALUES (
            v_preco.id,
            p_contrato_id,
            EXTRACT(YEAR FROM p_data_aplicacao),
            v_preco.fator_k,
            p_novo_fator_k,
            p_data_aplicacao,
            p_observacao,
            p_usuario_id
        );
        
        -- Atualizar fator K
        UPDATE public.precificacao_servicos
        SET fator_k = p_novo_fator_k, updated_at = now(), updated_by = p_usuario_id
        WHERE id = v_preco.id;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- =====================================================
-- 12. TRIGGER PARA UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas novas tabelas
DROP TRIGGER IF EXISTS set_updated_at ON public.unidades_medida;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.unidades_medida
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.grupos_servico;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.grupos_servico
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.precificacao_servicos;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.precificacao_servicos
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.feriados;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.feriados
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.motivos_cancelamento;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.motivos_cancelamento
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.tipos_ocorrencia;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tipos_ocorrencia
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.parametros_sla;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.parametros_sla
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

