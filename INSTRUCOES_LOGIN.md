# 🔐 Como Criar Usuário para Login

## Credenciais de Acesso

- **Email:** `admin@roteirizador.com`
- **Senha:** `admin123`

## ⚡ Método Rápido (Via Dashboard)

### Passo a Passo:

1. **Acesse o Dashboard do Supabase**
   - Vá para: https://app.supabase.com
   - Selecione seu projeto

2. **Navegue até Authentication**
   - No menu lateral, clique em **"Authentication"**
   - Depois clique em **"Users"**

3. **Crie o Usuário**
   - Clique no botão **"Add User"** (canto superior direito)
   - Selecione **"Create new user"**
   - Preencha os campos:
     ```
     Email: admin@roteirizador.com
     Password: admin123
     ```
   - ✅ **IMPORTANTE:** Marque a opção **"Auto Confirm User"**
   - Clique em **"Create User"**

4. **Criar Perfil (Opcional)**
   - Execute o script `criar_usuario_login.sql` no SQL Editor
   - Ou aguarde - o perfil será criado automaticamente pelo trigger

## ✅ Pronto!

Agora você pode fazer login em `http://localhost:8080/login` usando:
- **Email:** `admin@roteirizador.com`
- **Senha:** `admin123`

## 🔍 Verificar se Funcionou

Execute no SQL Editor:

```sql
-- Ver usuário criado
SELECT email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'admin@roteirizador.com';

-- Ver perfil criado
SELECT p.*, u.email 
FROM public.profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'admin@roteirizador.com';
```

## ⚠️ Problemas Comuns

**Erro: "Email not confirmed"**
- Solução: Marque "Auto Confirm User" ao criar o usuário

**Erro: "Invalid login credentials"**
- Solução: Verifique se o email e senha estão corretos

**Não consegue criar usuário via Dashboard**
- Solução: Verifique se você tem permissões de administrador no projeto















