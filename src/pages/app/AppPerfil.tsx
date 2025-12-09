import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield, Smartphone } from "lucide-react";

export default function AppPerfil() {
  const { user } = useAuth();

  const userName = user?.user_metadata?.nome_completo || user?.email?.split("@")[0] || "Usuário";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-4 space-y-6">
      {/* Avatar e Nome */}
      <div className="flex flex-col items-center text-center">
        <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold mb-4">
          {userInitials}
        </div>
        <h1 className="text-xl font-bold">{userName}</h1>
        <p className="text-muted-foreground">{user?.email}</p>
        <Badge variant="secondary" className="mt-2">
          Técnico de Campo
        </Badge>
      </div>

      {/* Informações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium">{userName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ID do Usuário</p>
              <p className="font-mono text-xs">{user?.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instalação PWA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Instalar Aplicativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Instale o app na tela inicial do seu celular para acesso rápido e funcionamento offline.
          </p>
          <div className="text-sm space-y-2">
            <p><strong>No iPhone:</strong> Toque em "Compartilhar" e depois "Adicionar à Tela de Início"</p>
            <p><strong>No Android:</strong> Toque no menu ⋮ e depois "Instalar app" ou "Adicionar à tela inicial"</p>
          </div>
        </CardContent>
      </Card>

      {/* Versão */}
      <div className="text-center text-xs text-muted-foreground">
        SirtecRoute App v1.0.0
      </div>
    </div>
  );
}
