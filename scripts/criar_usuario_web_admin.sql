-- Script para criar usuário administrador na tabela usuarios_web
-- Execute este script no SQL Editor do Supabase

-- 1. Primeiro, verificar se existe um perfil admin
INSERT INTO public.perfis_permissao (nome, descricao, is_admin, ativo)
SELECT 'Administrador', 'Perfil com acesso total ao sistema', true, true
WHERE NOT EXISTS (
    SELECT 1 FROM public.perfis_permissao WHERE nome = 'Administrador'
);

-- 2. Criar usuário admin
INSERT INTO public.usuarios_web (
    email,
    senha_hash,
    nome,
    cargo,
    departamento,
    ativo,
    perfil_id
)
SELECT 
    'admin@sirtec.com.br',
    'admin123',
    'Administrador',
    'Administrador do Sistema',
    'TI',
    true,
    (SELECT id FROM public.perfis_permissao WHERE nome = 'Administrador' LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM public.usuarios_web WHERE email = 'admin@sirtec.com.br'
);

-- 3. Verificar se foi criado
SELECT 
    id,
    email,
    nome,
    cargo,
    ativo,
    perfil_id
FROM public.usuarios_web
WHERE email = 'admin@sirtec.com.br';

-- CREDENCIAIS PARA LOGIN:
-- Email: admin@sirtec.com.br
-- Senha: admin123
