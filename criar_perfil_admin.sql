-- ============================================================================
-- Script para criar perfil do administrador após criar usuário via Dashboard
-- ============================================================================
-- 
-- INSTRUÇÕES:
-- 1. Primeiro, crie o usuário via Dashboard:
--    - Authentication > Users > Add User
--    - Email: admin@roteirizador.com
--    - Senha: admin123
--    - Marque "Auto Confirm User"
--
-- 2. Depois, execute este script para criar o perfil
-- ============================================================================

-- Criar perfil para o usuário admin (se não existir)
INSERT INTO public.profiles (user_id, nome_completo, cargo)
SELECT id, 'Administrador', 'Admin'
FROM auth.users
WHERE email = 'admin@roteirizador.com'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE user_id = auth.users.id
);

-- Verificar se foi criado
SELECT 
  u.email,
  p.nome_completo,
  p.cargo,
  p.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'admin@roteirizador.com';
















