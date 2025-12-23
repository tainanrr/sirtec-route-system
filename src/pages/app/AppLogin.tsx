import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Zap, Loader2, Smartphone, Car, Users } from "lucide-react";

export default function AppLogin() {
  const navigate = useNavigate();
  const { loginEquipe, isLoading } = useEquipeAuth();
  const [codigoEquipe, setCodigoEquipe] = useState("");
  const [placaVeiculo, setPlacaVeiculo] = useState("");

  const handlePlacaChange = (value: string) => {
    // Formatar placa: remover caracteres especiais e converter para maiúsculo
    const formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
    setPlacaVeiculo(formatted);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!codigoEquipe.trim()) {
      toast.error("Informe o código da equipe");
      return;
    }

    if (!placaVeiculo.trim()) {
      toast.error("Informe a placa do veículo");
      return;
    }

    const result = await loginEquipe(codigoEquipe.trim(), placaVeiculo.trim());

    if (result.success) {
      toast.success("Equipe validada!");
      // Navegar para tela de abertura de turno
      navigate("/app/abrir-turno");
    } else {
      toast.error(result.message || "Código ou placa incorretos");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-primary/10 flex flex-col items-center justify-center p-4">
      {/* Logo e Título */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/30 mb-4">
          <Zap className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">SirtecRoute</h1>
        <p className="text-muted-foreground mt-1 flex items-center justify-center gap-2">
          <Smartphone className="h-4 w-4" />
          App do Técnico
        </p>
      </div>

      {/* Card de Login */}
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/80 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Iniciar Jornada</CardTitle>
          <CardDescription>
            Informe o código da equipe e a placa do veículo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigoEquipe" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Código da Equipe
              </Label>
              <Input
                id="codigoEquipe"
                type="text"
                placeholder="Ex: EQ-001"
                value={codigoEquipe}
                onChange={(e) => setCodigoEquipe(e.target.value.toUpperCase())}
                required
                autoComplete="off"
                className="h-14 text-lg text-center font-mono tracking-wider"
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="placaVeiculo" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Placa do Veículo
              </Label>
              <Input
                id="placaVeiculo"
                type="text"
                placeholder="ABC1234"
                value={placaVeiculo}
                onChange={(e) => handlePlacaChange(e.target.value)}
                required
                autoComplete="off"
                className="h-14 text-lg text-center font-mono tracking-wider"
                disabled={isLoading}
                maxLength={7}
              />
              <p className="text-xs text-muted-foreground text-center">
                Placa do veículo utilizado hoje
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-semibold mt-6" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 mr-2" />
                  Continuar
                </>
              )}
            </Button>
          </form>
          
          {/* Info sobre próximo passo */}
          <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground text-center">
              Na próxima tela, você confirmará os colaboradores que vão trabalhar hoje.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Versão */}
      <p className="text-xs text-muted-foreground mt-8">
        v1.0.0 • © {new Date().getFullYear()} Sirtec
      </p>
    </div>
  );
}
