-- Verificar estrutura da tabela checklists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'checklists' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar checklists existentes
SELECT 
    id, 
    nome, 
    tipo, 
    ativo,
    CASE 
        WHEN grupos IS NOT NULL AND jsonb_array_length(grupos) > 0 THEN 'grupos: ' || jsonb_array_length(grupos)::text
        WHEN perguntas IS NOT NULL THEN 'perguntas (estrutura antiga)'
        ELSE 'vazio'
    END as estrutura,
    created_at
FROM public.checklists 
ORDER BY created_at DESC;

-- Adicionar colunas que podem estar faltando
ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS grupos JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS perguntas JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS versao VARCHAR(20) DEFAULT '1.0';

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS permite_salvar_rascunho BOOLEAN DEFAULT true;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS exige_localizacao BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS exige_foto_inicial BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS exige_foto_final BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS exige_assinatura BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS usa_pontuacao BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS pontuacao_minima_aprovacao INTEGER;

-- Verificar RLS
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'checklists';

-- Garantir que RLS permita leitura para todos autenticados
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.checklists;
CREATE POLICY "Enable read access for all authenticated users"
ON public.checklists FOR SELECT
TO authenticated
USING (true);

-- Também permitir leitura anônima (para o app mobile sem auth)
DROP POLICY IF EXISTS "Enable read access for anon" ON public.checklists;
CREATE POLICY "Enable read access for anon"
ON public.checklists FOR SELECT
TO anon
USING (ativo = true);


SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'checklists' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar checklists existentes
SELECT 
    id, 
    nome, 
    tipo, 
    ativo,
    CASE 
        WHEN grupos IS NOT NULL AND jsonb_array_length(grupos) > 0 THEN 'grupos: ' || jsonb_array_length(grupos)::text
        WHEN perguntas IS NOT NULL THEN 'perguntas (estrutura antiga)'
        ELSE 'vazio'
    END as estrutura,
    created_at
FROM public.checklists 
ORDER BY created_at DESC;

-- Adicionar colunas que podem estar faltando
ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS grupos JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS perguntas JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS versao VARCHAR(20) DEFAULT '1.0';

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS permite_salvar_rascunho BOOLEAN DEFAULT true;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS exige_localizacao BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS exige_foto_inicial BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS exige_foto_final BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS exige_assinatura BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS usa_pontuacao BOOLEAN DEFAULT false;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS pontuacao_minima_aprovacao INTEGER;

-- Verificar RLS
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'checklists';

-- Garantir que RLS permita leitura para todos autenticados
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.checklists;
CREATE POLICY "Enable read access for all authenticated users"
ON public.checklists FOR SELECT
TO authenticated
USING (true);

-- Também permitir leitura anônima (para o app mobile sem auth)
DROP POLICY IF EXISTS "Enable read access for anon" ON public.checklists;
CREATE POLICY "Enable read access for anon"
ON public.checklists FOR SELECT
TO anon
USING (ativo = true);






