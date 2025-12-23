# Como Criar Usuário de Teste no Supabase

## Credenciais de Acesso

- **Email:** `admin@roteirizador.com`
- **Senha:** `admin123`

## Método 1: Via Dashboard do Supabase (Recomendado)

1. Acesse o [Dashboard do Supabase](https://app.supabase.com)
2. Selecione seu projeto
3. No menu lateral, vá em **Authentication** > **Users**
4. Clique no botão **"Add User"** (canto superior direito)
5. Selecione **"Create new user"**
6. Preencha os campos:
   - **Email:** `admin@roteirizador.com`
   - **Password:** `admin123`
   - **Auto Confirm User:** ✅ Marque esta opção (importante!)
7. Clique em **"Create User"**

## Método 2: Criar Perfil Após Criar Usuário

Após criar o usuário via Dashboard, execute este SQL no SQL Editor para criar o perfil automaticamente:

```sql
-- Criar perfil para o usuário admin
INSERT INTO public.profiles (user_id, nome_completo, cargo)
SELECT id, 'Administrador', 'Admin'
FROM auth.users
WHERE email = 'admin@roteirizador.com';
```

## Verificação

Para verificar se o usuário foi criado corretamente:

```sql
-- Ver usuários criados
SELECT id, email, created_at FROM auth.users;

-- Ver perfis criados
SELECT p.*, u.email 
FROM public.profiles p
JOIN auth.users u ON p.user_id = u.id;
```

## Pronto!

Agora você pode fazer login no sistema usando:
- Email: `admin@roteirizador.com`
- Senha: `admin123`
















