-- Configurar Storage para APR
-- Execute este SQL no Supabase SQL Editor

-- 1. Criar o bucket se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-attachments',
  'service-attachments',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 2. Remover políticas antigas
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view" ON storage.objects;

-- 3. Criar políticas de acesso permissivas
-- Permitir leitura pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'service-attachments');

-- Permitir upload para todos (incluindo anon para o app mobile)
CREATE POLICY "Allow uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'service-attachments');

-- Permitir update para todos
CREATE POLICY "Allow updates"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'service-attachments')
WITH CHECK (bucket_id = 'service-attachments');

-- Permitir delete para todos
CREATE POLICY "Allow deletes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'service-attachments');

-- 4. Verificar se o bucket foi criado
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'service-attachments';

-- 5. Verificar políticas
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';


-- Execute este SQL no Supabase SQL Editor

-- 1. Criar o bucket se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-attachments',
  'service-attachments',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 2. Remover políticas antigas
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view" ON storage.objects;

-- 3. Criar políticas de acesso permissivas
-- Permitir leitura pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'service-attachments');

-- Permitir upload para todos (incluindo anon para o app mobile)
CREATE POLICY "Allow uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'service-attachments');

-- Permitir update para todos
CREATE POLICY "Allow updates"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'service-attachments')
WITH CHECK (bucket_id = 'service-attachments');

-- Permitir delete para todos
CREATE POLICY "Allow deletes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'service-attachments');

-- 4. Verificar se o bucket foi criado
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'service-attachments';

-- 5. Verificar políticas
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';






