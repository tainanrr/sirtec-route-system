import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, Loader2, Smartphone, Car, Users, Clock, AlertTriangle, Calendar } from "lucide-react";
import { TurnoExistente } from "@/lib/authUtils";
import { format, parseISO, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AppLogin() {
  const navigate = useNavigate();
  const { loginEquipe, acessarTurnoExistente, isLoading } = useEquipeAuth();
  const [codigoEquipe, setCodigoEquipe] = useState("");
  const [placaVeiculo, setPlacaVeiculo] = useState("");
  
  // Estado para diálogo de turno existente
  const [turnoExistenteDialog, setTurnoExistenteDialog] = useState<{
    open: boolean;
    turno: TurnoExistente | null;
  }>({ open: false, turno: null });

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
      // Verificar se existe turno aberto
      if (result.turnoExistente) {
        setTurnoExistenteDialog({ open: true, turno: result.turnoExistente });
      } else {
        toast.success("Equipe validada!");
        navigate("/app/abrir-turno");
      }
    } else {
      toast.error(result.message || "Código ou placa incorretos");
    }
  };

  // Acessar turno existente
  const handleAcessarTurnoExistente = () => {
    if (turnoExistenteDialog.turno) {
      acessarTurnoExistente(turnoExistenteDialog.turno);
      setTurnoExistenteDialog({ open: false, turno: null });
      toast.success("Turno carregado!");
      navigate("/app");
    }
  };

  // Fechar diálogo e ir para abrir novo turno (não permitido se já tem turno)
  const handleAbrirNovoTurno = () => {
    toast.error("Não é possível abrir um novo turno enquanto há outro aberto. Feche o turno existente primeiro.");
  };

  // Formatar data do turno existente
  const formatarDataTurno = (turno: TurnoExistente) => {
    const data = parseISO(turno.hora_inicio);
    if (isToday(data)) {
      return `Hoje às ${format(data, "HH:mm")}`;
    }
    return format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  // Verificar se turno é de dia anterior
  const isTurnoDesatualizado = (turno: TurnoExistente) => {
    const dataTurno = startOfDay(parseISO(turno.hora_inicio));
    const hoje = startOfDay(new Date());
    return isBefore(dataTurno, hoje);
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

      {/* Dialog de Turno Existente */}
      <Dialog 
        open={turnoExistenteDialog.open} 
        onOpenChange={(open) => {
          if (!open) {
            setTurnoExistenteDialog({ open: false, turno: null });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-full ${
                turnoExistenteDialog.turno && isTurnoDesatualizado(turnoExistenteDialog.turno)
                  ? "bg-amber-100"
                  : "bg-blue-100"
              }`}>
                {turnoExistenteDialog.turno && isTurnoDesatualizado(turnoExistenteDialog.turno) ? (
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                ) : (
                  <Clock className="h-6 w-6 text-blue-600" />
                )}
              </div>
              <DialogTitle className="text-lg">Turno já aberto</DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Esta equipe já possui um turno aberto. Deseja acessar o turno existente?
                </p>

                {/* Info do turno */}
                {turnoExistenteDialog.turno && (
                  <div className={`rounded-lg border p-4 space-y-2 ${
                    isTurnoDesatualizado(turnoExistenteDialog.turno)
                      ? "border-amber-300 bg-amber-50"
                      : "border-blue-200 bg-blue-50"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {formatarDataTurno(turnoExistenteDialog.turno)}
                      </span>
                      {isTurnoDesatualizado(turnoExistenteDialog.turno) && (
                        <Badge variant="destructive" className="text-xs">
                          Dia anterior
                        </Badge>
                      )}
                    </div>
                    
                    {turnoExistenteDialog.turno.placa_veiculo && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Car className="h-4 w-4" />
                        <span>Placa: {turnoExistenteDialog.turno.placa_veiculo}</span>
                      </div>
                    )}
                    
                    {turnoExistenteDialog.turno.colaboradores && turnoExistenteDialog.turno.colaboradores.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {turnoExistenteDialog.turno.colaboradores.map(c => c.nome.split(" ")[0]).join(", ")}
                        </span>
                      </div>
                    )}

                    {isTurnoDesatualizado(turnoExistenteDialog.turno) && (
                      <div className="mt-3 p-2 rounded bg-amber-100 border border-amber-200">
                        <p className="text-xs text-amber-800">
                          <strong>⚠️ Atenção:</strong> Este turno é de um dia anterior. 
                          Após acessar, você verá um alerta para fechá-lo e abrir um novo turno com a data de hoje.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={handleAbrirNovoTurno}
              className="flex-1"
            >
              Abrir Novo
            </Button>
            <Button 
              onClick={handleAcessarTurnoExistente}
              className="flex-1"
            >
              <Clock className="h-4 w-4 mr-2" />
              Acessar Turno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
