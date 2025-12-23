# Configuração de Envio de Email - SirtecRoute

Este guia explica como configurar o envio de emails para recuperação de senha usando o **Resend** (gratuito: 100 emails/dia).

## Passo 1: Criar conta no Resend

1. Acesse [https://resend.com](https://resend.com)
2. Crie uma conta gratuita
3. Verifique seu email

## Passo 2: Obter API Key

1. No dashboard do Resend, vá em **API Keys**
2. Clique em **Create API Key**
3. Dê um nome (ex: "SirtecRoute")
4. Copie a chave gerada (começa com `re_`)

## Passo 3: Configurar Domínio (Opcional mas Recomendado)

Para enviar emails de um domínio próprio (ex: `noreply@sirtecroute.com.br`):

1. No Resend, vá em **Domains**
2. Adicione seu domínio
3. Configure os registros DNS conforme instruções
4. Aguarde verificação

**Sem domínio próprio:** Use `onboarding@resend.dev` (limite de 100 emails/dia e alguns filtros de spam)

## Passo 4: Configurar no Supabase

### Via Dashboard:

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Vá em **Project Settings** > **Edge Functions**
3. Adicione o secret: `RESEND_API_KEY` com o valor da sua API key

### Via CLI (se preferir):

```bash
supabase secrets set RESEND_API_KEY=re_sua_chave_aqui
```

## Passo 5: Deploy da Edge Function

### Opção A: Via Supabase CLI

```bash
# Instalar CLI (se não tiver)
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref SEU_PROJECT_REF

# Deploy
supabase functions deploy send-recovery-email
```

### Opção B: Manualmente pelo Dashboard

1. Vá em **Edge Functions** no Supabase Dashboard
2. Clique em **New Function**
3. Nome: `send-recovery-email`
4. Cole o código de `supabase/functions/send-recovery-email/index.ts`
5. Deploy

## Passo 6: Atualizar o domínio no código (se necessário)

Se você configurou um domínio próprio no Resend, edite o arquivo:
`supabase/functions/send-recovery-email/index.ts`

Altere a linha:
```typescript
from: "SirtecRoute <noreply@sirtecroute.com.br>",
```

Para seu domínio verificado:
```typescript
from: "SirtecRoute <noreply@seudominio.com.br>",
```

## Testando

1. Acesse a tela de login
2. Clique em "Esqueci a senha"
3. Informe um email cadastrado
4. Se tudo estiver configurado, o email será enviado
5. Se não estiver configurado, o código aparecerá na tela (modo desenvolvimento)

## Troubleshooting

### Email não chega
- Verifique a pasta de spam
- Confirme que a API Key está correta
- Verifique os logs da Edge Function no Supabase Dashboard

### Erro "Serviço de email não configurado"
- A Edge Function não foi deployada ou a RESEND_API_KEY não foi configurada

### Erro de CORS
- Verifique se a Edge Function está com os headers CORS corretos

## Custos

- **Resend Free**: 100 emails/dia, 3.000/mês
- **Resend Pro**: $20/mês para 50.000 emails
- **Supabase Edge Functions**: Incluídas no plano gratuito (500.000 invocações/mês)

## Alternativas

Se preferir outros serviços:
- **SendGrid**: Plano gratuito com 100 emails/dia
- **Mailgun**: Plano gratuito com 5.000 emails/mês (3 meses)
- **Amazon SES**: ~$0.10 por 1.000 emails

Para usar outro serviço, basta alterar a chamada à API na Edge Function.

