import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Zap, 
  Loader2, 
  Users, 
  Car, 
  Play, 
  ChevronLeft,
  UserPlus,
  AlertCircle,
  Gauge,
  Crown,
  Trash2,
  AlertTriangle,
  Phone,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ColaboradorEquipe } from "@/lib/authUtils";

interface ColaboradorDisponivel {
  id: string;
  cpf: string;
  nome: string;
  cargo: string | null;
}

export default function AppAbrirTurno() {
  const navigate = useNavigate();
  const { equipe, colaboradoresPendentes, iniciarTurno, isLoading, logout } = useEquipeAuth();
  
  // Lista local de colaboradores do turno (pendentes + adicionados manualmente)
  const [colaboradoresTurno, setColaboradoresTurno] = useState<ColaboradorEquipe[]>([]);
  const [kmInicial, setKmInicial] = useState<string>("");
  const [colaboradoresDisponiveis, setColaboradoresDisponiveis] = useState<ColaboradorDisponivel[]>([]);
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [showAddColaborador, setShowAddColaborador] = useState(false);
  const [loadingColaboradores, setLoadingColaboradores] = useState(false);
  
  // Estado para dialog de erro
  const [erroDialog, setErroDialog] = useState<{ open: boolean; titulo: string; mensagem: string }>({
    open: false,
    titulo: "",
    mensagem: ""
  });

  // Redirecionar se não estiver logado
  useEffect(() => {
    if (!equipe) {
      navigate("/app/login");
    }
  }, [equipe, navigate]);

  // Inicializar colaboradores com os pendentes
  useEffect(() => {
    if (colaboradoresPendentes.length > 0 && colaboradoresTurno.length === 0) {
      setColaboradoresTurno([...colaboradoresPendentes]);
    }
  }, [colaboradoresPendentes]);

  // Carregar colaboradores disponíveis para adicionar
  const fetchColaboradoresDisponiveis = async () => {
    setLoadingColaboradores(true);
    try {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, cpf, nome, cargo")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      
      // Filtrar os que já estão na lista do turno
      const idsJaNaLista = colaboradoresTurno.map(c => c.id);
      const disponiveis = (data || []).filter(c => !idsJaNaLista.includes(c.id));
      setColaboradoresDisponiveis(disponiveis);
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
    } finally {
      setLoadingColaboradores(false);
    }
  };

  // Definir como líder
  const definirLider = (colaboradorId: string) => {
    setColaboradoresTurno(prev => prev.map(c => ({
      ...c,
      funcao: c.id === colaboradorId ? "lider" : "membro"
    })));
  };

  // Remover colaborador da lista
  const removerColaborador = (colaboradorId: string) => {
    setColaboradoresTurno(prev => prev.filter(c => c.id !== colaboradorId));
    toast.success("Colaborador removido");
  };

  // Adicionar colaborador extra
  const adicionarColaborador = (colaborador: ColaboradorDisponivel) => {
    // Verificar se já existe na lista
    if (colaboradoresTurno.some(c => c.id === colaborador.id)) {
      toast.error("Colaborador já está na lista");
      return;
    }

    // Adicionar à lista do turno
    const novoColaborador: ColaboradorEquipe = {
      id: colaborador.id,
      cpf: colaborador.cpf,
      nome: colaborador.nome,
      cargo: colaborador.cargo,
      funcao: colaboradoresTurno.length === 0 ? "lider" : "membro", // Primeiro é líder
    };
    
    setColaboradoresTurno(prev => [...prev, novoColaborador]);
    
    // Atualizar colaboradores disponíveis
    setColaboradoresDisponiveis(prev => prev.filter(c => c.id !== colaborador.id));
    
    // Fechar busca
    setShowAddColaborador(false);
    setBuscaColaborador("");
    
    toast.success(`${colaborador.nome} adicionado`);
  };

  // Limites de colaboradores da equipe
  const minColaboradores = equipe?.min_colaboradores || 1;
  const maxColaboradores = equipe?.max_colaboradores || 2;

  // Iniciar turno
  const handleIniciarTurno = async () => {
    // Validar KM inicial (obrigatório)
    if (!kmInicial || kmInicial.trim() === "") {
      toast.error("Informe o KM inicial do veículo");
      return;
    }

    const km = parseInt(kmInicial);
    if (isNaN(km) || km < 0) {
      toast.error("KM inicial inválido");
      return;
    }

    // Validar quantidade de colaboradores
    if (colaboradoresTurno.length < minColaboradores) {
      toast.error(`Mínimo de ${minColaboradores} colaborador(es) necessário(s) para abrir turno`);
      return;
    }

    if (colaboradoresTurno.length > maxColaboradores) {
      toast.error(`Máximo de ${maxColaboradores} colaborador(es) permitido(s) para esta equipe`);
      return;
    }

    // Verificar se algum colaborador já tem turno aberto em outra equipe
    const colaboradoresIds = colaboradoresTurno.map(c => c.id);
    
    try {
      // Buscar turnos abertos de outras equipes através da tabela turno_colaboradores
      const { data: turnosColaboradores, error: erroVerificacao } = await supabase
        .from("turno_colaboradores")
        .select(`
          turno_id,
          colaborador_id,
          turnos!inner (id, equipe_id, status)
        `)
        .in("colaborador_id", colaboradoresIds)
        .eq("turnos.status", "aberto")
        .neq("turnos.equipe_id", equipe?.id);

      if (erroVerificacao) {
        // Se a tabela não existir ou der erro, apenas logar e continuar
        console.log("Verificação de colaboradores em outros turnos não disponível:", erroVerificacao.message);
      } else if (turnosColaboradores && turnosColaboradores.length > 0) {
        // Colaborador já está em outro turno
        const colaboradorEmOutroTurno = colaboradoresTurno.find(
          c => turnosColaboradores.some(tc => tc.colaborador_id === c.id)
        );
        
        if (colaboradorEmOutroTurno) {
          const turnoInfo = turnosColaboradores.find(tc => tc.colaborador_id === colaboradorEmOutroTurno.id);
          const equipeId = (turnoInfo?.turnos as any)?.equipe_id;
          
          // Buscar nome da equipe
          if (equipeId) {
            const { data: equipeData } = await supabase
              .from("equipes")
              .select("codigo, nome")
              .eq("id", equipeId)
              .single();
            
            toast.error(
              `${colaboradorEmOutroTurno.nome} já está com turno aberto na equipe ${equipeData?.codigo || ''} (${equipeData?.nome || ''})`,
              { duration: 5000 }
            );
            return;
          }
        }
      }
    } catch (error) {
      // Não bloquear a abertura de turno por erro na verificação
      console.log("Erro na verificação de turnos (não bloqueante):", error);
    }

    // Passar a lista completa de colaboradores para o contexto
    const result = await iniciarTurno(colaboradoresIds, km, colaboradoresTurno);

    if (result.success) {
      toast.success("Turno iniciado com sucesso!");
      navigate("/app");
    } else {
      // Tratar mensagens de erro específicas
      const mensagemErro = result.message || "Erro ao iniciar turno";
      
      if (mensagemErro.toLowerCase().includes("já existe um turno aberto")) {
        setErroDialog({
          open: true,
          titulo: "Turno já em andamento",
          mensagem: "Identificamos que já existe um turno aberto para esta equipe hoje. Isso pode acontecer quando o turno anterior não foi fechado corretamente.\n\nPor favor, entre em contato com o suporte para verificar a situação e liberar o acesso."
        });
      } else if (mensagemErro.toLowerCase().includes("colaborador") && mensagemErro.toLowerCase().includes("turno aberto")) {
        setErroDialog({
          open: true,
          titulo: "Colaborador em outro turno",
          mensagem: mensagemErro + "\n\nVerifique se o colaborador encerrou o turno anterior ou entre em contato com o suporte."
        });
      } else {
        setErroDialog({
          open: true,
          titulo: "Não foi possível abrir o turno",
          mensagem: mensagemErro + "\n\nSe o problema persistir, entre em contato com o suporte."
        });
      }
    }
  };

  // Voltar para login
  const handleVoltar = () => {
    logout();
    navigate("/app/login");
  };

  // Colaboradores filtrados na busca
  const colaboradoresFiltrados = colaboradoresDisponiveis.filter(c =>
    buscaColaborador === "" ||
    c.nome.toLowerCase().includes(buscaColaborador.toLowerCase()) ||
    c.cpf.includes(buscaColaborador)
  );

  // Verificar se tem líder definido
  const temLider = colaboradoresTurno.some(c => c.funcao === "lider");

  if (!equipe) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-primary/10 flex flex-col items-center justify-start p-2 sm:p-4 overflow-x-hidden">
      {/* Header */}
      <div className="w-full max-w-lg mb-2 sm:mb-4">
        <Button 
          variant="ghost" 
          onClick={handleVoltar}
          className="text-muted-foreground"
          size="sm"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
      </div>

      {/* Card Principal */}
      <Card className="w-full max-w-lg shadow-2xl border-0 bg-card/80 backdrop-blur overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{equipe.nome}</CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {equipe.codigo}
                </Badge>
                <span className="flex items-center gap-1">
                  <Car className="h-3 w-3" />
                  {equipe.placa_veiculo}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
          {/* Colaboradores da Equipe */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Colaboradores do Turno
              </Label>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={
                    colaboradoresTurno.length < minColaboradores ? "destructive" :
                    colaboradoresTurno.length > maxColaboradores ? "destructive" :
                    "secondary"
                  }
                >
                  {colaboradoresTurno.length}/{minColaboradores}-{maxColaboradores}
                </Badge>
              </div>
            </div>
            
            {colaboradoresTurno.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-lg">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm text-muted-foreground">
                  Nenhum colaborador adicionado ao turno
                </p>
                <Button 
                  variant="link" 
                  size="sm"
                  onClick={() => {
                    setShowAddColaborador(true);
                    fetchColaboradoresDisponiveis();
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Adicionar colaboradores
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {colaboradoresTurno.map((colaborador) => (
                    <div
                      key={colaborador.id}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                    >
                      {/* Conteúdo do colaborador */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1 flex-wrap">
                          <p className="font-medium text-sm truncate max-w-[120px]">{colaborador.nome}</p>
                          {colaborador.funcao === "lider" && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-600 flex-shrink-0">
                              <Crown className="h-2.5 w-2.5 mr-0.5" />
                              Líder
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {colaborador.cargo || "Colaborador"} • {colaborador.cpf}
                        </p>
                      </div>
                      
                      {/* Botões de ação - sempre visíveis */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* Botão definir líder */}
                        {colaborador.funcao !== "lider" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                            onClick={() => definirLider(colaborador.id)}
                            title="Definir como Líder"
                          >
                            <Crown className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        
                        {/* Botão remover */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-100"
                          onClick={() => removerColaborador(colaborador.id)}
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Aviso se não tem líder */}
            {colaboradoresTurno.length > 0 && !temLider && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <Crown className="h-4 w-4" />
                <span>Defina um líder clicando no ícone de coroa</span>
              </div>
            )}

            {/* Botão para adicionar mais colaboradores */}
            {!showAddColaborador && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setShowAddColaborador(true);
                  fetchColaboradoresDisponiveis();
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar colaborador
              </Button>
            )}

            {/* Busca de colaboradores */}
            {showAddColaborador && (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                <Label className="text-sm">Buscar colaborador</Label>
                <Input
                  placeholder="Nome ou CPF..."
                  value={buscaColaborador}
                  onChange={(e) => setBuscaColaborador(e.target.value)}
                  autoFocus
                />
                
                {loadingColaboradores ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : (
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {colaboradoresFiltrados.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Nenhum colaborador encontrado
                        </p>
                      ) : (
                        colaboradoresFiltrados.slice(0, 5).map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
                            onClick={() => adicionarColaborador(c)}
                          >
                            <div>
                              <p className="text-sm font-medium">{c.nome}</p>
                              <p className="text-xs text-muted-foreground">{c.cpf}</p>
                            </div>
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setShowAddColaborador(false);
                    setBuscaColaborador("");
                  }}
                >
                  Fechar
                </Button>
              </div>
            )}
          </div>

          {/* KM Inicial */}
          <div className="space-y-2">
            <Label htmlFor="kmInicial" className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              KM Inicial <span className="text-red-500">*</span>
            </Label>
            <Input
              id="kmInicial"
              type="number"
              placeholder="Ex: 45230"
              value={kmInicial}
              onChange={(e) => setKmInicial(e.target.value)}
              className="h-12"
              disabled={isLoading}
              required
            />
            <p className="text-xs text-muted-foreground">
              Informe o hodômetro atual do veículo
            </p>
          </div>

          {/* Botão Iniciar Turno */}
          <Button 
            onClick={handleIniciarTurno}
            className="w-full h-14 text-lg font-semibold" 
            disabled={
              isLoading || 
              colaboradoresTurno.length < minColaboradores || 
              colaboradoresTurno.length > maxColaboradores ||
              !kmInicial
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Iniciar Turno
              </>
            )}
          </Button>

          {/* Mensagens de validação */}
          {colaboradoresTurno.length < minColaboradores && (
            <p className="text-xs text-red-600 text-center">
              Mínimo de {minColaboradores} colaborador(es) necessário(s)
            </p>
          )}
          {colaboradoresTurno.length > maxColaboradores && (
            <p className="text-xs text-red-600 text-center">
              Máximo de {maxColaboradores} colaborador(es) permitido(s)
            </p>
          )}
          {!kmInicial && colaboradoresTurno.length >= minColaboradores && colaboradoresTurno.length <= maxColaboradores && (
            <p className="text-xs text-amber-600 text-center">
              Informe o KM inicial para continuar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Versão */}
      <p className="text-xs text-muted-foreground mt-8">
        v1.0.0 • © {new Date().getFullYear()} Sirtec
      </p>

      {/* Dialog de Erro */}
      <Dialog open={erroDialog.open} onOpenChange={(open) => setErroDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-lg">{erroDialog.titulo}</DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {erroDialog.mensagem}
                </p>
                
                {/* Card de Contato Suporte */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Contato Suporte</span>
                  </div>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p>📞 WhatsApp: <strong>(11) 99999-9999</strong></p>
                    <p>📧 Email: <strong>suporte@sirtec.com.br</strong></p>
                  </div>
                </div>

                {/* Botão Fechar */}
                <Button 
                  onClick={() => setErroDialog(prev => ({ ...prev, open: false }))}
                  className="w-full"
                  variant="outline"
                >
                  Entendi
                </Button>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

