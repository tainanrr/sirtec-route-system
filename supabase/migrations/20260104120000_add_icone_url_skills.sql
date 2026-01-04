-- ============================================================================
-- MIGRATION: Adicionar campo icone_url na tabela skills
-- ============================================================================
-- Este campo permite armazenar uma URL de imagem personalizada para cada skill
-- que será usada como ícone no mapa de roteirização
-- ============================================================================

-- Adicionar coluna icone_url se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'skills' AND column_name = 'icone_url'
  ) THEN
    ALTER TABLE public.skills ADD COLUMN icone_url TEXT;
    COMMENT ON COLUMN public.skills.icone_url IS 'URL da imagem personalizada do ícone para exibição no mapa';
  END IF;
END $$;

-- Criar bucket para armazenar ícones de skills (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'skill-icons',
  'skill-icons',
  true,
  1048576, -- 1MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
DROP POLICY IF EXISTS "Public read access to skill icons" ON storage.objects;
CREATE POLICY "Public read access to skill icons"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'skill-icons');

DROP POLICY IF EXISTS "Authenticated users can upload skill icons" ON storage.objects;
CREATE POLICY "Authenticated users can upload skill icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'skill-icons');

DROP POLICY IF EXISTS "Authenticated users can update skill icons" ON storage.objects;
CREATE POLICY "Authenticated users can update skill icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'skill-icons');

DROP POLICY IF EXISTS "Authenticated users can delete skill icons" ON storage.objects;
CREATE POLICY "Authenticated users can delete skill icons"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'skill-icons');

