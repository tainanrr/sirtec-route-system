import { useState, useEffect } from "react";
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
import { Loader2, Smartphone, Car, Users, Clock, AlertTriangle, Calendar, Wifi, WifiOff, CloudOff } from "lucide-react";
import { TurnoExistente } from "@/lib/authUtils";
import { format, parseISO, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";

export default function AppLogin() {
  const navigate = useNavigate();
  const { loginEquipe, acessarTurnoExistente, isLoading, isOfflineLogin } = useEquipeAuth();
  const { isOnline } = useOfflineSyncContext();
  const [codigoEquipe, setCodigoEquipe] = useState("");
  const [placaVeiculo, setPlacaVeiculo] = useState("");
  const [loginOffline, setLoginOffline] = useState(false);
  
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
      // Registrar se foi login offline
      setLoginOffline(!!result.isOffline);
      
      // Verificar se existe turno aberto
      if (result.turnoExistente) {
        setTurnoExistenteDialog({ open: true, turno: result.turnoExistente });
      } else {
        if (result.isOffline) {
          toast.info("Login offline realizado! Dados carregados do cache.");
      } else {
        toast.success("Equipe validada!");
        }
        navigate("/app/abrir-turno");
      }
    } else {
      // Se está offline e falhou, mostrar mensagem específica
      if (result.isOffline) {
        toast.error(result.message || "Sem dados offline disponíveis. Conecte-se à internet para o primeiro acesso do dia.");
    } else {
      toast.error(result.message || "Código ou placa incorretos");
      }
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
      {/* Indicador de conexão no topo */}
      <div className="fixed top-0 left-0 right-0 z-50">
        {!isOnline && (
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-medium">
              <WifiOff className="h-4 w-4 animate-pulse" />
              <span>Modo offline</span>
            </div>
            <p className="text-xs text-white/80">
              Você pode acessar se já fez login hoje com internet
            </p>
          </div>
        )}
      </div>

      {/* Logo e Título */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4">
          <img 
            src="/logo-sirtec.svg" 
            alt="Sirtec" 
            className="h-20 w-auto"
          />
        </div>
        <h1 className="text-3xl font-bold text-foreground">SirtecRoute</h1>
        <p className="text-muted-foreground mt-1 flex items-center justify-center gap-2">
          <Smartphone className="h-4 w-4" />
          App do Técnico
        </p>
        {/* Status de conexão */}
        <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${
          isOnline 
            ? "bg-green-100 text-green-700" 
            : "bg-amber-100 text-amber-700"
        }`}>
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3" />
              <span>Online</span>
            </>
          ) : (
            <>
              <CloudOff className="h-3 w-3" />
              <span>Offline</span>
            </>
          )}
        </div>
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
              {isOnline 
                ? "Na próxima tela, você confirmará os colaboradores que vão trabalhar hoje."
                : "Se você já acessou hoje com internet, poderá entrar com os dados salvos."
              }
            </p>
          </div>
          
          {/* Info sobre funcionamento offline */}
          {!isOnline && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-800">
                    Primeiro acesso do dia requer internet
                  </p>
                  <p className="text-[10px] text-amber-700 mt-1">
                    Após o primeiro login online, você poderá acessar mesmo sem conexão.
                  </p>
                </div>
              </div>
            </div>
          )}
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
