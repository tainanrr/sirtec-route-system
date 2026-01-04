-- ============================================================================
-- SCRIPT: Adicionar campo icone_url na tabela skills + configurar Storage
-- ============================================================================
-- Execute este script no SQL Editor do Supabase Dashboard
-- ============================================================================

-- 1. Adicionar coluna icone_url se não existir
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS icone_url TEXT;
COMMENT ON COLUMN public.skills.icone_url IS 'URL da imagem personalizada do ícone para exibição no mapa';

-- 2. Criar bucket para armazenar ícones de skills
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'skill-icons',
  'skill-icons',
  true,
  1048576,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];

-- 3. IMPORTANTE: Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Public read access to skill icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload skill icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update skill icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete skill icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read skill icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload skill icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update skill icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete skill icons" ON storage.objects;

-- 4. Criar políticas de acesso PÚBLICAS para o bucket skill-icons
-- Leitura pública
CREATE POLICY "Anyone can read skill icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'skill-icons');

-- Upload público (ou use 'authenticated' se quiser restringir a usuários logados)
CREATE POLICY "Anyone can upload skill icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'skill-icons');

-- Atualização pública
CREATE POLICY "Anyone can update skill icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'skill-icons');

-- Exclusão pública
CREATE POLICY "Anyone can delete skill icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'skill-icons');

-- 5. Verificar se funcionou
SELECT 
  'Coluna icone_url' as verificacao,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'skills' AND column_name = 'icone_url'
  ) THEN '✅ OK' ELSE '❌ ERRO' END as status
UNION ALL
SELECT 
  'Bucket skill-icons',
  CASE WHEN EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'skill-icons'
  ) THEN '✅ OK' ELSE '❌ ERRO' END
UNION ALL
SELECT 
  'Políticas de storage',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname LIKE '%skill icons%'
  ) THEN '✅ OK' ELSE '❌ ERRO' END;
