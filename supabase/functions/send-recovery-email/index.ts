// Supabase Edge Function para enviar email de recuperação de senha
// Usa Resend (https://resend.com) - plano gratuito: 100 emails/dia

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  nome: string;
  codigo: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar se tem API key configurada
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY não configurada");
      return new Response(
        JSON.stringify({ 
          error: "Serviço de email não configurado",
          details: "Configure RESEND_API_KEY nas variáveis de ambiente" 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { to, nome, codigo }: EmailRequest = await req.json();

    if (!to || !codigo) {
      return new Response(
        JSON.stringify({ error: "Email e código são obrigatórios" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Enviar email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SirtecRoute <noreply@sirtecroute.com.br>", // Configure seu domínio no Resend
        to: [to],
        subject: "Código de Recuperação de Senha - SirtecRoute",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .logo { text-align: center; margin-bottom: 20px; }
              .logo h1 { color: #3b82f6; margin: 0; }
              .code { background: #f0f9ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
              .code-number { font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 8px; }
              .message { color: #64748b; line-height: 1.6; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; text-align: center; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 15px; margin: 20px 0; color: #92400e; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <h1>⚡ SirtecRoute</h1>
                <p style="color: #64748b; margin: 5px 0;">Sistema de Roteirização</p>
              </div>
              
              <p class="message">Olá, <strong>${nome || "Usuário"}</strong>!</p>
              
              <p class="message">Você solicitou a recuperação de senha da sua conta. Use o código abaixo para redefinir sua senha:</p>
              
              <div class="code">
                <div class="code-number">${codigo}</div>
              </div>
              
              <div class="warning">
                ⚠️ Este código é válido por <strong>15 minutos</strong>. Se você não solicitou esta recuperação, ignore este email.
              </div>
              
              <p class="message">Se você não reconhece esta solicitação, por favor entre em contato com o administrador do sistema.</p>
              
              <div class="footer">
                <p>Este é um email automático, por favor não responda.</p>
                <p>© ${new Date().getFullYear()} SirtecRoute - Sistema de Roteirização</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Erro Resend:", data);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao enviar email",
          details: data 
        }),
        { 
          status: res.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("Email enviado com sucesso:", data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email enviado com sucesso",
        id: data.id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Erro interno do servidor",
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

