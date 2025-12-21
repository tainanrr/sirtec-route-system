-- Script para criar usuário de equipe no Supabase Auth
-- IMPORTANTE: Execute este script no SQL Editor do Supabase

-- Este script cria um usuário no auth.users e vincula à equipe na tabela tecnicos
-- Substitua os valores abaixo pelos dados da sua equipe:

-- 1. PRIMEIRO: Crie o usuário manualmente no Supabase Dashboard:
--    - Vá em Authentication > Users > Add User
--    - Email: equipe1@equipe.local
--    - Password: 123456
--    - Auto Confirm User: SIM (marcar checkbox)
--    - Clique em "Create User"
--
-- 2. DEPOIS: Execute este SQL para vincular o user_id à equipe:

-- Substitua 'equipe1' pelo usuário da sua equipe
-- Substitua o UUID abaixo pelo ID do usuário criado no passo 1
-- Você pode encontrar o user_id em Authentication > Users > [seu usuário] > UUID

UPDATE public.tecnicos
SET user_id = 'SUBSTITUA_PELO_USER_ID_AQUI'::uuid
WHERE usuario = 'equipe1';

-- OU, se você já tem o email do usuário criado:
-- UPDATE public.tecnicos
-- SET user_id = (
--   SELECT id FROM auth.users 
--   WHERE email = 'equipe1@equipe.local'
-- )
-- WHERE usuario = 'equipe1';

-- Verificar se foi vinculado corretamente:
SELECT 
  t.id,
  t.codigo,
  t.nome,
  t.usuario,
  t.user_id,
  u.email as auth_email
FROM public.tecnicos t
LEFT JOIN auth.users u ON u.id = t.user_id
WHERE t.usuario = 'equipe1';


-- IMPORTANTE: Execute este script no SQL Editor do Supabase

-- Este script cria um usuário no auth.users e vincula à equipe na tabela tecnicos
-- Substitua os valores abaixo pelos dados da sua equipe:

-- 1. PRIMEIRO: Crie o usuário manualmente no Supabase Dashboard:
--    - Vá em Authentication > Users > Add User
--    - Email: equipe1@equipe.local
--    - Password: 123456
--    - Auto Confirm User: SIM (marcar checkbox)
--    - Clique em "Create User"
--
-- 2. DEPOIS: Execute este SQL para vincular o user_id à equipe:

-- Substitua 'equipe1' pelo usuário da sua equipe
-- Substitua o UUID abaixo pelo ID do usuário criado no passo 1
-- Você pode encontrar o user_id em Authentication > Users > [seu usuário] > UUID

UPDATE public.tecnicos
SET user_id = 'SUBSTITUA_PELO_USER_ID_AQUI'::uuid
WHERE usuario = 'equipe1';

-- OU, se você já tem o email do usuário criado:
-- UPDATE public.tecnicos
-- SET user_id = (
--   SELECT id FROM auth.users 
--   WHERE email = 'equipe1@equipe.local'
-- )
-- WHERE usuario = 'equipe1';

-- Verificar se foi vinculado corretamente:
SELECT 
  t.id,
  t.codigo,
  t.nome,
  t.usuario,
  t.user_id,
  u.email as auth_email
FROM public.tecnicos t
LEFT JOIN auth.users u ON u.id = t.user_id
WHERE t.usuario = 'equipe1';






