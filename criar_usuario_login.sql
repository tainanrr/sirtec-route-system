-- ============================================================================
-- CRIAR USUÁRIO PARA LOGIN NO SISTEMA
-- ============================================================================
-- 
-- CREDENCIAIS:
-- Email: admin@roteirizador.com
-- Senha: admin123
--
-- IMPORTANTE: No Supabase, usuários devem ser criados via Dashboard.
-- Este script cria o perfil após você criar o usuário no Dashboard.
-- ============================================================================

-- ============================================================================
-- MÉTODO RECOMENDADO: Via Dashboard do Supabase
-- ============================================================================
-- 1. Acesse: https://app.supabase.com > Seu Projeto
-- 2. Vá em: Authentication > Users
-- 3. Clique em: "Add User" > "Create new user"
-- 4. Preencha:
--    - Email: admin@roteirizador.com
--    - Password: admin123
--    - ✅ Marque: "Auto Confirm User" (IMPORTANTE!)
-- 5. Clique em: "Create User"
-- ============================================================================

-- ============================================================================
-- Após criar o usuário via Dashboard, execute este SQL para criar o perfil:
-- ============================================================================

-- Criar perfil para o usuário admin
INSERT INTO public.profiles (user_id, nome_completo, cargo)
SELECT id, 'Administrador', 'Admin'
FROM auth.users
WHERE email = 'admin@roteirizador.com'
ON CONFLICT (user_id) DO NOTHING;

-- Verificar se foi criado corretamente
SELECT 
  u.email,
  u.email_confirmed_at,
  p.nome_completo,
  p.cargo,
  p.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'admin@roteirizador.com';

-- ============================================================================
-- ALTERNATIVA: Se você já tem um usuário criado, apenas atualize o email:
-- ============================================================================
-- UPDATE auth.users 
-- SET email = 'admin@roteirizador.com'
-- WHERE email = 'seu-email-atual@exemplo.com';
-- ============================================================================

















