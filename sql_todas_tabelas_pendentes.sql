-- ============================================================
-- SCRIPT COMPLETO PARA CRIAR TODAS AS TABELAS PENDENTES
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. TABELA: ordem_anexos (fotos e documentos)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ordem_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    equipe_id UUID REFERENCES public.tecnicos(id),
    tipo VARCHAR(50) NOT NULL DEFAULT 'foto',
    nome VARCHAR(255),
    descricao TEXT,
    url TEXT NOT NULL,
    storage_path TEXT,
    mime_type VARCHAR(100),
    tamanho_bytes BIGINT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    data_captura TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordem_anexos_ordem_servico_id 
ON public.ordem_anexos(ordem_servico_id);

CREATE INDEX IF NOT EXISTS idx_ordem_anexos_equipe_id 
ON public.ordem_anexos(equipe_id);

CREATE INDEX IF NOT EXISTS idx_ordem_anexos_tipo 
ON public.ordem_anexos(tipo);

ALTER TABLE public.ordem_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ordem_anexos_select" ON public.ordem_anexos;
CREATE POLICY "ordem_anexos_select" ON public.ordem_anexos FOR SELECT USING (true);

DROP POLICY IF EXISTS "ordem_anexos_insert" ON public.ordem_anexos;
CREATE POLICY "ordem_anexos_insert" ON public.ordem_anexos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ordem_anexos_update" ON public.ordem_anexos;
CREATE POLICY "ordem_anexos_update" ON public.ordem_anexos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "ordem_anexos_delete" ON public.ordem_anexos;
CREATE POLICY "ordem_anexos_delete" ON public.ordem_anexos FOR DELETE USING (true);

-- ============================================================
-- 2. TABELA: ordem_materiais_aplicados
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_ordem_materiais_aplicados_os_id 
ON public.ordem_materiais_aplicados(ordem_servico_id);

ALTER TABLE public.ordem_materiais_aplicados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ordem_materiais_aplicados_select" ON public.ordem_materiais_aplicados;
CREATE POLICY "ordem_materiais_aplicados_select" ON public.ordem_materiais_aplicados FOR SELECT USING (true);

DROP POLICY IF EXISTS "ordem_materiais_aplicados_insert" ON public.ordem_materiais_aplicados;
CREATE POLICY "ordem_materiais_aplicados_insert" ON public.ordem_materiais_aplicados FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ordem_materiais_aplicados_update" ON public.ordem_materiais_aplicados;
CREATE POLICY "ordem_materiais_aplicados_update" ON public.ordem_materiais_aplicados FOR UPDATE USING (true);

DROP POLICY IF EXISTS "ordem_materiais_aplicados_delete" ON public.ordem_materiais_aplicados;
CREATE POLICY "ordem_materiais_aplicados_delete" ON public.ordem_materiais_aplicados FOR DELETE USING (true);

-- ============================================================
-- 3. TABELA: ordem_materiais_retirados
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_ordem_materiais_retirados_os_id 
ON public.ordem_materiais_retirados(ordem_servico_id);

ALTER TABLE public.ordem_materiais_retirados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ordem_materiais_retirados_select" ON public.ordem_materiais_retirados;
CREATE POLICY "ordem_materiais_retirados_select" ON public.ordem_materiais_retirados FOR SELECT USING (true);

DROP POLICY IF EXISTS "ordem_materiais_retirados_insert" ON public.ordem_materiais_retirados;
CREATE POLICY "ordem_materiais_retirados_insert" ON public.ordem_materiais_retirados FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ordem_materiais_retirados_update" ON public.ordem_materiais_retirados;
CREATE POLICY "ordem_materiais_retirados_update" ON public.ordem_materiais_retirados FOR UPDATE USING (true);

DROP POLICY IF EXISTS "ordem_materiais_retirados_delete" ON public.ordem_materiais_retirados;
CREATE POLICY "ordem_materiais_retirados_delete" ON public.ordem_materiais_retirados FOR DELETE USING (true);

-- ============================================================
-- 4. ADICIONAR COLUNA retorno_campo_id em ordens_servico
-- ============================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ordens_servico' 
        AND column_name = 'retorno_campo_id'
    ) THEN
        ALTER TABLE public.ordens_servico 
        ADD COLUMN retorno_campo_id UUID REFERENCES public.retornos_campo(id);
        
        CREATE INDEX idx_ordens_servico_retorno_campo_id 
        ON public.ordens_servico(retorno_campo_id);
        
        RAISE NOTICE 'Coluna retorno_campo_id adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna retorno_campo_id já existe';
    END IF;
END $$;

-- ============================================================
-- 5. VERIFICAÇÃO FINAL
-- ============================================================

SELECT 
    'ordem_anexos' as tabela,
    COUNT(*) as registros
FROM public.ordem_anexos
UNION ALL
SELECT 
    'ordem_materiais_aplicados' as tabela,
    COUNT(*) as registros
FROM public.ordem_materiais_aplicados
UNION ALL
SELECT 
    'ordem_materiais_retirados' as tabela,
    COUNT(*) as registros
FROM public.ordem_materiais_retirados;

-- Verificar se a coluna retorno_campo_id existe
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'ordens_servico'
AND column_name = 'retorno_campo_id';


