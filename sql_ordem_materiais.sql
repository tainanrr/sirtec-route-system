-- Criar tabelas para materiais aplicados e retirados nas OSs
-- Estas tabelas armazenam os materiais usados durante a execução do serviço

-- 1. Criar tabela de materiais aplicados
CREATE TABLE IF NOT EXISTS public.ordem_materiais_aplicados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    equipe_id UUID REFERENCES public.tecnicos(id),
    material_id UUID REFERENCES public.materiais(id),
    codigo VARCHAR(100),
    descricao VARCHAR(500),
    quantidade DECIMAL(10, 3) NOT NULL DEFAULT 1,
    unidade VARCHAR(20) DEFAULT 'UN',
    numero_serie VARCHAR(100),
    observacao TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar tabela de materiais retirados
CREATE TABLE IF NOT EXISTS public.ordem_materiais_retirados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    equipe_id UUID REFERENCES public.tecnicos(id),
    material_id UUID REFERENCES public.materiais(id),
    codigo VARCHAR(100),
    descricao VARCHAR(500),
    quantidade DECIMAL(10, 3) NOT NULL DEFAULT 1,
    unidade VARCHAR(20) DEFAULT 'UN',
    numero_serie VARCHAR(100),
    motivo_retirada VARCHAR(255),
    observacao TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_ordem_materiais_aplicados_os_id 
ON public.ordem_materiais_aplicados(ordem_servico_id);

CREATE INDEX IF NOT EXISTS idx_ordem_materiais_aplicados_equipe_id 
ON public.ordem_materiais_aplicados(equipe_id);

CREATE INDEX IF NOT EXISTS idx_ordem_materiais_aplicados_material_id 
ON public.ordem_materiais_aplicados(material_id);

CREATE INDEX IF NOT EXISTS idx_ordem_materiais_retirados_os_id 
ON public.ordem_materiais_retirados(ordem_servico_id);

CREATE INDEX IF NOT EXISTS idx_ordem_materiais_retirados_equipe_id 
ON public.ordem_materiais_retirados(equipe_id);

CREATE INDEX IF NOT EXISTS idx_ordem_materiais_retirados_material_id 
ON public.ordem_materiais_retirados(material_id);

-- 4. Habilitar RLS
ALTER TABLE public.ordem_materiais_aplicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_materiais_retirados ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas de acesso - Materiais Aplicados
DROP POLICY IF EXISTS "Permitir leitura de materiais aplicados" ON public.ordem_materiais_aplicados;
CREATE POLICY "Permitir leitura de materiais aplicados" ON public.ordem_materiais_aplicados
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de materiais aplicados" ON public.ordem_materiais_aplicados;
CREATE POLICY "Permitir inserção de materiais aplicados" ON public.ordem_materiais_aplicados
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de materiais aplicados" ON public.ordem_materiais_aplicados;
CREATE POLICY "Permitir atualização de materiais aplicados" ON public.ordem_materiais_aplicados
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de materiais aplicados" ON public.ordem_materiais_aplicados;
CREATE POLICY "Permitir exclusão de materiais aplicados" ON public.ordem_materiais_aplicados
    FOR DELETE USING (true);

-- 6. Criar políticas de acesso - Materiais Retirados
DROP POLICY IF EXISTS "Permitir leitura de materiais retirados" ON public.ordem_materiais_retirados;
CREATE POLICY "Permitir leitura de materiais retirados" ON public.ordem_materiais_retirados
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de materiais retirados" ON public.ordem_materiais_retirados;
CREATE POLICY "Permitir inserção de materiais retirados" ON public.ordem_materiais_retirados
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de materiais retirados" ON public.ordem_materiais_retirados;
CREATE POLICY "Permitir atualização de materiais retirados" ON public.ordem_materiais_retirados
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de materiais retirados" ON public.ordem_materiais_retirados;
CREATE POLICY "Permitir exclusão de materiais retirados" ON public.ordem_materiais_retirados
    FOR DELETE USING (true);

-- 7. Triggers para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ordem_materiais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ordem_materiais_aplicados_updated_at ON public.ordem_materiais_aplicados;
CREATE TRIGGER trigger_update_ordem_materiais_aplicados_updated_at
    BEFORE UPDATE ON public.ordem_materiais_aplicados
    FOR EACH ROW
    EXECUTE FUNCTION update_ordem_materiais_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ordem_materiais_retirados_updated_at ON public.ordem_materiais_retirados;
CREATE TRIGGER trigger_update_ordem_materiais_retirados_updated_at
    BEFORE UPDATE ON public.ordem_materiais_retirados
    FOR EACH ROW
    EXECUTE FUNCTION update_ordem_materiais_updated_at();

-- 8. Comentários nas tabelas
COMMENT ON TABLE public.ordem_materiais_aplicados IS 'Armazena materiais aplicados/instalados durante a execução da OS';
COMMENT ON TABLE public.ordem_materiais_retirados IS 'Armazena materiais retirados durante a execução da OS';
COMMENT ON COLUMN public.ordem_materiais_aplicados.numero_serie IS 'Número de série do material (para rastreabilidade)';
COMMENT ON COLUMN public.ordem_materiais_retirados.motivo_retirada IS 'Motivo da retirada (defeito, substituição, etc.)';











