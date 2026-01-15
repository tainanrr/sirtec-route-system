# 🧪 Guia Completo: Criando Ambiente de Testes

Este guia detalha todos os passos necessários para criar uma cópia completa do sistema como **ambiente de testes**, separado do ambiente de **produção**.

---

## 📋 Visão Geral

Você precisará configurar os seguintes serviços:

| Serviço | Produção | Testes |
|---------|----------|--------|
| GitHub | `sirtec-route-system` | `sirtec-route-system-staging` |
| Supabase | Projeto atual | Novo projeto de testes |
| Hospedagem | URL de produção | URL de staging |

---

## 1️⃣ GITHUB - Criar Repositório de Testes

### Opção A: Criar Novo Repositório (Recomendado)

1. Acesse [github.com/new](https://github.com/new)

2. Crie um novo repositório:
   - **Nome:** `sirtec-route-system-staging`
   - **Descrição:** `[STAGING/TESTES] Sistema de Configuração de Roteirização`
   - **Visibilidade:** Privado (recomendado)
   - **NÃO** inicialize com README

3. No seu terminal local, clone o projeto atual em uma nova pasta:

```powershell
# Criar pasta para ambiente de testes
cd C:\Projetos_Roteirizador
mkdir pixel-perfect-staging
cd pixel-perfect-staging

# Clonar o repositório de produção
git clone https://github.com/tainanrr/sirtec-route-system.git .

# Remover o remote de produção
git remote remove origin

# Adicionar o novo remote de staging
git remote add origin https://github.com/tainanrr/sirtec-route-system-staging.git

# Push para o novo repositório
git push -u origin main
```

### Opção B: Usar Branches (Alternativa mais simples)

Se preferir manter tudo no mesmo repositório:

```powershell
cd C:\Projetos_Roteirizador\pixel-perfect-replication

# Criar branch de staging
git checkout -b staging

# Push do branch
git push -u origin staging
```

---

## 2️⃣ SUPABASE - Criar Projeto de Testes

### Passo 1: Criar Novo Projeto

1. Acesse [app.supabase.com](https://app.supabase.com)

2. Clique em **"New Project"**

3. Configure o projeto:
   - **Nome:** `sirtec-route-system-staging` ou `roteirizacao-testes`
   - **Senha do Database:** Crie uma senha forte (anote-a!)
   - **Região:** Escolha a mesma do projeto de produção (South America - São Paulo)
   - **Plano:** Free (para testes)

4. Aguarde a criação do projeto (pode levar alguns minutos)

### Passo 2: Obter Credenciais

Após o projeto ser criado:

1. Vá em **Settings** > **API**

2. Anote as seguintes informações:
   - **Project URL:** `https://XXXXX.supabase.co`
   - **anon/public key:** `eyJhbGciOiJIUzI1NiIs...`

### Passo 3: Copiar Estrutura do Banco de Dados

Você tem duas opções:

#### Opção A: Via Supabase CLI (Recomendado)

```powershell
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# No projeto de produção, exportar esquema
cd C:\Projetos_Roteirizador\pixel-perfect-replication
supabase db dump --project-ref soluhzhmrsongjyrolpa > database_schema.sql

# Linkar ao projeto de staging
supabase link --project-ref SEU_PROJECT_REF_STAGING

# Aplicar esquema no staging
supabase db push
```

#### Opção B: Via SQL Editor (Manual)

1. No projeto de **PRODUÇÃO**:
   - Vá em **SQL Editor**
   - Execute: 
   ```sql
   -- Exportar estrutura (sem dados)
   -- Copie o resultado de cada tabela
   ```
   - Ou vá em **Table Editor** > Clique na tabela > **Definition** > Copie o SQL

2. No projeto de **TESTES**:
   - Vá em **SQL Editor**
   - Cole e execute os scripts de criação

#### Opção C: Usar os Scripts de Migração do Projeto

O projeto já tem scripts SQL prontos em `supabase/migrations/`. Execute-os na ordem:

1. No Supabase do ambiente de testes, vá em **SQL Editor**

2. Execute os arquivos na pasta `supabase/migrations/` na ordem numérica:
   - `20240101...`
   - `20240102...`
   - etc.

### Passo 4: Copiar Políticas RLS (Row Level Security)

1. No projeto de produção, vá em **Authentication** > **Policies**

2. Para cada tabela, copie as políticas

3. Replique no projeto de testes

### Passo 5: Configurar Autenticação

1. Vá em **Authentication** > **Settings**

2. Configure:
   - **Site URL:** URL do seu ambiente de staging
   - **Redirect URLs:** Adicione as URLs de staging

3. Se usar email, configure o SMTP igual ao de produção (ou use um diferente para testes)

---

## 3️⃣ CONFIGURAR VARIÁVEIS DE AMBIENTE

### No projeto de testes, crie o arquivo `.env`:

```env
# .env para ambiente de TESTES/STAGING
# ⚠️ NÃO COMMITAR ESTE ARQUIVO!

# Supabase - Projeto de TESTES
VITE_SUPABASE_URL=https://SEU_PROJETO_STAGING.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Identificador do ambiente
VITE_APP_ENV=staging
```

### Criar arquivo `.env.example` (pode commitar):

```env
# Exemplo de configuração - copie para .env e preencha os valores
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-aqui
VITE_APP_ENV=staging
```

---

## 4️⃣ HOSPEDAGEM (VERCEL/NETLIFY/ETC)

### Usando Vercel

1. Acesse [vercel.com](https://vercel.com)

2. Clique em **"Add New Project"**

3. Importe o repositório de staging do GitHub

4. Configure:
   - **Project Name:** `sirtec-staging`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

5. Configure as **Environment Variables**:
   ```
   VITE_SUPABASE_URL = https://seu-projeto-staging.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY = sua-chave-staging
   VITE_APP_ENV = staging
   ```

6. Clique em **Deploy**

### Usando Netlify

1. Acesse [app.netlify.com](https://app.netlify.com)

2. Clique em **"Add new site"** > **"Import an existing project"**

3. Conecte ao GitHub e selecione o repositório de staging

4. Configure:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`

5. Vá em **Site settings** > **Environment variables**
   - Adicione as mesmas variáveis do Vercel

---

## 5️⃣ IDENTIFICADOR VISUAL DE AMBIENTE

Para evitar confusão entre produção e testes, adicione um indicador visual.

### Criar componente de banner:

Crie o arquivo `src/components/EnvironmentBanner.tsx`:

```tsx
import { AlertTriangle } from "lucide-react";

export const EnvironmentBanner = () => {
  const env = import.meta.env.VITE_APP_ENV;
  
  if (env === 'production' || !env) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center py-1 text-sm font-bold z-[9999] flex items-center justify-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      AMBIENTE DE TESTES - Dados não são reais
      <AlertTriangle className="h-4 w-4" />
    </div>
  );
};
```

### Adicionar no App.tsx:

```tsx
import { EnvironmentBanner } from "./components/EnvironmentBanner";

function App() {
  return (
    <>
      <EnvironmentBanner />
      {/* ... resto do app */}
    </>
  );
}
```

---

## 6️⃣ CHECKLIST FINAL

### GitHub
- [ ] Novo repositório criado (ou branch staging)
- [ ] Código enviado para o novo repositório
- [ ] README atualizado indicando que é ambiente de testes

### Supabase
- [ ] Novo projeto criado
- [ ] Estrutura do banco replicada (tabelas)
- [ ] Políticas RLS configuradas
- [ ] Funções/Triggers copiados
- [ ] Configurações de auth ajustadas
- [ ] Edge Functions deployadas (se houver)

### Hospedagem
- [ ] Novo deploy configurado
- [ ] Variáveis de ambiente setadas
- [ ] Build funcionando
- [ ] URL de staging acessível

### Código
- [ ] Variáveis de ambiente configuradas (.env)
- [ ] Banner de ambiente adicionado (opcional)
- [ ] Teste de conexão com Supabase OK

---

## 7️⃣ COMANDOS ÚTEIS

### Mudar entre ambientes no terminal:

```powershell
# Ir para produção
cd C:\Projetos_Roteirizador\pixel-perfect-replication

# Ir para staging/testes
cd C:\Projetos_Roteirizador\pixel-perfect-staging
```

### Rodar localmente cada ambiente:

```powershell
# Cada pasta terá seu próprio .env apontando para o Supabase correto
npm run dev
```

---

## ⚠️ IMPORTANTE: Boas Práticas

1. **NUNCA** use dados reais de clientes no ambiente de testes
2. **NUNCA** aponte o ambiente de testes para o banco de produção
3. **SEMPRE** identifique visualmente em qual ambiente você está
4. **SEMPRE** teste novas features primeiro no staging antes de ir para produção
5. **MANTENHA** os ambientes sincronizados (estrutura do banco, não os dados)

---

## 📞 Suporte

Se tiver dúvidas durante a configuração:
1. Verifique os logs do console do navegador
2. Verifique os logs do Supabase (Database > Logs)
3. Teste a conexão com o Supabase no ambiente correto

---

*Documento criado em: Janeiro/2026*
*Versão: 1.0*
