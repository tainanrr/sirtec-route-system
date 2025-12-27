-- Criar tabela ordem_anexos para armazenar fotos e documentos das OSs
-- Esta tabela é usada pelo app para anexar fotos durante a execução

-- 1. Criar tabela ordem_anexos
CREATE TABLE IF NOT EXISTS public.ordem_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    equipe_id UUID REFERENCES public.tecnicos(id),
    tipo VARCHAR(50) NOT NULL DEFAULT 'foto', -- foto, documento, assinatura
    nome VARCHAR(255),
    descricao TEXT,
    url TEXT NOT NULL,
    storage_path TEXT, -- caminho no storage do Supabase
    mime_type VARCHAR(100),
    tamanho_bytes BIGINT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    data_captura TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_ordem_anexos_ordem_servico_id 
ON public.ordem_anexos(ordem_servico_id);

CREATE INDEX IF NOT EXISTS idx_ordem_anexos_equipe_id 
ON public.ordem_anexos(equipe_id);

CREATE INDEX IF NOT EXISTS idx_ordem_anexos_tipo 
ON public.ordem_anexos(tipo);

CREATE INDEX IF NOT EXISTS idx_ordem_anexos_created_at 
ON public.ordem_anexos(created_at DESC);

-- 3. Habilitar RLS
ALTER TABLE public.ordem_anexos ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de acesso
DROP POLICY IF EXISTS "Permitir leitura de anexos" ON public.ordem_anexos;
CREATE POLICY "Permitir leitura de anexos" ON public.ordem_anexos
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de anexos" ON public.ordem_anexos;
CREATE POLICY "Permitir inserção de anexos" ON public.ordem_anexos
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de anexos" ON public.ordem_anexos;
CREATE POLICY "Permitir atualização de anexos" ON public.ordem_anexos
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de anexos" ON public.ordem_anexos;
CREATE POLICY "Permitir exclusão de anexos" ON public.ordem_anexos
    FOR DELETE USING (true);

-- 5. Criar bucket de storage para os anexos (se não existir)
-- NOTA: Isso precisa ser feito via Dashboard do Supabase ou via API de Admin
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('ordem-anexos', 'ordem-anexos', true)
-- ON CONFLICT (id) DO NOTHING;

-- 6. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ordem_anexos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ordem_anexos_updated_at ON public.ordem_anexos;
CREATE TRIGGER trigger_update_ordem_anexos_updated_at
    BEFORE UPDATE ON public.ordem_anexos
    FOR EACH ROW
    EXECUTE FUNCTION update_ordem_anexos_updated_at();

-- 7. Comentários na tabela
COMMENT ON TABLE public.ordem_anexos IS 'Armazena fotos, documentos e assinaturas anexados às ordens de serviço';
COMMENT ON COLUMN public.ordem_anexos.tipo IS 'Tipo do anexo: foto, documento, assinatura';
COMMENT ON COLUMN public.ordem_anexos.storage_path IS 'Caminho do arquivo no Supabase Storage';
COMMENT ON COLUMN public.ordem_anexos.latitude IS 'Latitude onde a foto foi tirada (geolocalização)';
COMMENT ON COLUMN public.ordem_anexos.longitude IS 'Longitude onde a foto foi tirada (geolocalização)';





