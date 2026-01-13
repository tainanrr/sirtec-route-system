import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { logApp } from "@/lib/logUtils";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { CACHE_KEYS } from "@/hooks/useOfflineData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MapPin,
  Loader2,
  Navigation,
  AlertTriangle,
  CheckCircle,
  FileText,
  User,
  Home,
  Crosshair,
} from "lucide-react";
import { format } from "date-fns";

interface TipoServicoAvulso {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  tempo_execucao_minutos: number;
  valor: number | null;
}

interface CriarOSAvulsaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (osId: string) => void;
}

export default function CriarOSAvulsaDialog({
  open,
  onOpenChange,
  onSuccess,
}: CriarOSAvulsaDialogProps) {
  const queryClient = useQueryClient();
  const { equipe: equipeAuth, turno } = useEquipeAuth();
  const { equipe } = useTecnico();
  const { isOnline, getFromCache, queueOperation, saveToCache } = useOfflineSyncContext();

  // Estado do formulário
  const [tipoServico, setTipoServico] = useState<string>("");
  const [endereco, setEndereco] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [instalacao, setInstalacao] = useState("");
  const [medidor, setMedidor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  
  // Estado de localização
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [capturandoGPS, setCapturandoGPS] = useState(false);
  const [erroGPS, setErroGPS] = useState<string | null>(null);
  const [gpsCapturado, setGpsCapturado] = useState(false);

  // Resetar formulário quando abrir
  useEffect(() => {
    if (open) {
      setTipoServico("");
      setEndereco("");
      setClienteNome("");
      setInstalacao("");
      setMedidor("");
      setObservacoes("");
      setLatitude(null);
      setLongitude(null);
      setGpsCapturado(false);
      setErroGPS(null);
    }
  }, [open]);

  // Buscar tipos de serviço que permitem avulso (com suporte offline)
  const { data: tiposServico, isLoading: isLoadingTipos } = useQuery({
    queryKey: ["tipos-servico-avulso", isOnline],
    queryFn: async () => {
      // Se offline, buscar do cache
      if (!isOnline) {
        console.log("[CriarOSAvulsa] 📦 Offline - buscando skills do cache...");
        const skillsCache = await getFromCache<any[]>(CACHE_KEYS.SKILLS);
        
        if (skillsCache && skillsCache.length > 0) {
          // Filtrar apenas os que permitem avulso
          const skillsAvulso = skillsCache
            .filter((s: any) => s.ativo && s.permite_avulso)
            .map((s: any) => ({
              id: s.id,
              codigo: s.codigo,
              nome: s.nome,
              descricao: s.descricao,
              tempo_execucao_minutos: s.tempo_execucao_minutos || 30,
              valor: s.valor,
            }))
            .sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""));
          
          console.log("[CriarOSAvulsa] ✅ Skills do cache:", skillsAvulso.length);
          return skillsAvulso as TipoServicoAvulso[];
        }
        
        console.log("[CriarOSAvulsa] ⚠️ Cache de skills vazio");
        return [] as TipoServicoAvulso[];
      }
      
      // Se online, buscar do servidor
      const { data, error } = await supabase
        .from("skills")
        .select("id, codigo, nome, descricao, tempo_execucao_minutos, valor")
        .eq("ativo", true)
        .eq("permite_avulso", true)
        .order("nome");

      if (error) throw error;
      return (data || []) as TipoServicoAvulso[];
    },
    enabled: open,
    networkMode: "always", // Permite executar offline
  });

  // Gerar número de OS avulsa único
  const gerarNumeroOS = () => {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const equipeCodigo = equipe?.codigo || equipeAuth?.codigo || "AVL";
    return `AVL-${equipeCodigo}-${timestamp}${random}`;
  };

  // Capturar GPS
  const capturarGPS = () => {
    if (!navigator.geolocation) {
      setErroGPS("Geolocalização não é suportada neste dispositivo");
      toast.error("Geolocalização não suportada");
      return;
    }

    setCapturandoGPS(true);
    setErroGPS(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGpsCapturado(true);
        setCapturandoGPS(false);
        toast.success("Localização capturada com sucesso!");
      },
      (error) => {
        setCapturandoGPS(false);
        let mensagemErro = "Erro ao obter localização";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            mensagemErro = "Permissão de localização negada. Habilite nas configurações.";
            break;
          case error.POSITION_UNAVAILABLE:
            mensagemErro = "Localização indisponível. Verifique o GPS.";
            break;
          case error.TIMEOUT:
            mensagemErro = "Tempo esgotado ao obter localização. Tente novamente.";
            break;
        }
        
        setErroGPS(mensagemErro);
        toast.error(mensagemErro);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // Mutation para criar OS (com suporte offline)
  const criarOSMutation = useMutation({
    mutationFn: async () => {
      const equipeId = equipe?.id || equipeAuth?.id;
      const turnoId = turno?.id;

      if (!equipeId) {
        throw new Error("Equipe não identificada");
      }

      if (!turnoId) {
        throw new Error("Nenhum turno aberto. Abra um turno antes de criar OSs avulsas.");
      }

      if (!tipoServico) {
        throw new Error("Selecione o tipo de serviço");
      }

      if (!endereco.trim()) {
        throw new Error("Informe o endereço");
      }

      if (!latitude || !longitude) {
        throw new Error("Capture a localização GPS antes de criar a OS");
      }

      const tipoSelecionado = tiposServico?.find(t => t.codigo === tipoServico);
      if (!tipoSelecionado) {
        throw new Error("Tipo de serviço inválido");
      }

      const numeroOS = gerarNumeroOS();
      const agora = new Date().toISOString();
      const dataHoje = format(new Date(), "yyyy-MM-dd");

      // ============ MODO OFFLINE ============
      if (!isOnline) {
        console.log("[CriarOSAvulsa] 📦 Modo offline - criando OS localmente...");
        
        // Gerar ID local para a OS
        const osIdLocal = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Buscar contrato padrão do cache da equipe
        let contratoPadraoId = null;
        try {
          const equipeCache = await getFromCache<any>(`equipe_auth`);
          contratoPadraoId = equipeCache?.contrato_padrao_avulsas || null;
          console.log("[CriarOSAvulsa] Contrato do cache:", contratoPadraoId);
        } catch (error) {
          console.warn("[CriarOSAvulsa] Erro ao buscar contrato do cache:", error);
        }
        
        // Dados da OS para criar
        const novaOSData = {
          id: osIdLocal,
          numero: numeroOS,
          tipo: tipoSelecionado.codigo,
          status: "no_local",
          endereco: endereco.trim(),
          cliente_nome: clienteNome.trim() || null,
          instalacao: instalacao.trim() || null,
          medidor: medidor.trim() || null,
          observacoes: observacoes.trim() || `OS Avulsa criada pela equipe ${equipe?.codigo || equipeAuth?.codigo}`,
          latitude,
          longitude,
          duracao_estimada: tipoSelecionado.tempo_execucao_minutos,
          valor: tipoSelecionado.valor,
          tecnico_id: equipeId,
          contrato_id: contratoPadraoId,
          prazo: null,
          regulada: false,
          avulsa: true,
          deslocamento_iniciado_at: agora,
          chegada_local_at: agora,
          created_at: agora,
          pendente_sync: true, // Marca como pendente de sincronização
        };
        
        // Salvar no cache do planejamento
        const cacheKey = `planejamento_dia_${equipeId}_${dataHoje}`;
        const planejamentoCache = await getFromCache<any[]>(cacheKey) || [];
        
        // Adicionar a nova OS ao cache no formato esperado
        const novaEntrada = {
          id: `local_planejamento_${Date.now()}`,
          ordens_servico: novaOSData,
          ordem_na_rota: planejamentoCache.length + 1,
          hora_inicio_estimada: format(new Date(), "HH:mm"),
          tempo_estimado_minutos: tipoSelecionado.tempo_execucao_minutos,
        };
        
        planejamentoCache.push(novaEntrada);
        await saveToCache(cacheKey, planejamentoCache, 24);
        console.log("[CriarOSAvulsa] ✅ OS salva no cache local:", numeroOS);
        
        // Enfileirar operação para sincronização
        await queueOperation({
          type: "create_os_avulsa",
          payload: {
            ...novaOSData,
            id: undefined, // Remove ID local para o servidor gerar um novo
            osIdLocal, // Mantém referência ao ID local
          },
          metadata: {
            equipeId,
            turnoId,
            dataHoje,
            tipoSelecionadoCodigo: tipoSelecionado.codigo,
            tipoSelecionadoNome: tipoSelecionado.nome,
          },
        });
        
        console.log("[CriarOSAvulsa] ✅ Operação enfileirada para sincronização");
        
        return { osId: osIdLocal, numero: numeroOS, offline: true };
      }

      // ============ MODO ONLINE ============
      // Buscar contrato padrão da equipe para OSs avulsas
      let contratoPadraoId = null;
      try {
        const { data: equipeData } = await supabase
          .from("tecnicos")
          .select("contrato_padrao_avulsas")
          .eq("id", equipeId)
          .single();
        
        contratoPadraoId = equipeData?.contrato_padrao_avulsas || null;
        console.log("[CriarOSAvulsa] Contrato padrão da equipe:", contratoPadraoId);
      } catch (error) {
        console.warn("[CriarOSAvulsa] Erro ao buscar contrato padrão da equipe:", error);
      }

      // Criar a OS
      const { data: novaOS, error: erroOS } = await supabase
        .from("ordens_servico")
        .insert({
          numero: numeroOS,
          tipo: tipoSelecionado.codigo,
          status: "no_local", // Inicia como "no local" - equipe precisa fazer APR antes de iniciar
          endereco: endereco.trim(),
          cliente_nome: clienteNome.trim() || null,
          instalacao: instalacao.trim() || null,
          medidor: medidor.trim() || null,
          observacoes: observacoes.trim() || `OS Avulsa criada pela equipe ${equipe?.codigo || equipeAuth?.codigo}`,
          latitude,
          longitude,
          duracao_estimada: tipoSelecionado.tempo_execucao_minutos,
          valor: tipoSelecionado.valor,
          tecnico_id: equipeId,
          contrato_id: contratoPadraoId, // Usar contrato padrão da equipe para OSs avulsas
          prazo: null, // OS avulsa não tem prazo
          regulada: false,
          avulsa: true, // Marca como OS avulsa
          deslocamento_iniciado_at: agora,
          chegada_local_at: agora,
        })
        .select("id")
        .single();

      if (erroOS) {
        console.error("[CriarOSAvulsa] Erro ao criar OS:", erroOS);
        throw new Error(`Erro ao criar OS: ${erroOS.message}`);
      }

      // Registrar na tabela de planejamento_ordens para aparecer na lista
      const { data: planejamentoAtivo } = await supabase
        .from("planejamentos")
        .select("id")
        .eq("equipe_id", equipeId)
        .eq("data_planejamento", dataHoje)
        .eq("status", "aberto")
        .single();

      if (planejamentoAtivo) {
        // Buscar a maior ordem_na_rota atual
        const { data: maxOrdem } = await supabase
          .from("planejamento_ordens")
          .select("ordem_na_rota")
          .eq("planejamento_id", planejamentoAtivo.id)
          .order("ordem_na_rota", { ascending: false })
          .limit(1)
          .single();

        const novaOrdem = (maxOrdem?.ordem_na_rota || 0) + 1;

        await supabase.from("planejamento_ordens").insert({
          planejamento_id: planejamentoAtivo.id,
          ordem_servico_id: novaOS.id,
          equipe_id: equipeId,
          ordem_na_rota: novaOrdem,
          hora_inicio_estimada: format(new Date(), "HH:mm"),
          tempo_estimado_minutos: tipoSelecionado.tempo_execucao_minutos,
        });
      }

      // Registrar log
      logApp(
        "criar_os_avulsa",
        "ordens_servico",
        `OS Avulsa criada: ${numeroOS} - ${tipoSelecionado.nome} em ${endereco}`,
        {
          id: turno?.colaboradores?.[0]?.id,
          nome: turno?.colaboradores?.[0]?.nome || equipe?.codigo,
          equipeId,
          equipeCodigo: equipe?.codigo || equipeAuth?.codigo,
        },
        {
          equipeId,
          equipeCodigo: equipe?.codigo || equipeAuth?.codigo,
          tabela: "ordens_servico",
          registroId: novaOS.id,
          dadosNovos: {
            numero: numeroOS,
            tipo: tipoSelecionado.codigo,
            endereco,
            latitude,
            longitude,
          },
        }
      );

      return { osId: novaOS.id, numero: numeroOS, offline: false };
    },
    onSuccess: (data) => {
      if (data.offline) {
        toast.success(`OS ${data.numero} criada localmente! Será sincronizada quando houver conexão.`);
      } else {
        toast.success(`OS ${data.numero} criada com sucesso!`);
      }
      queryClient.invalidateQueries({ queryKey: ["ordens-planejadas"] });
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(data.osId);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const tipoSelecionado = tiposServico?.find(t => t.codigo === tipoServico);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            Criar OS Avulsa
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar uma nova ordem de serviço avulsa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tipo de Serviço */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Serviço *</Label>
            <Select value={tipoServico} onValueChange={setTipoServico}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de serviço" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingTipos ? (
                  <div className="p-2 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : tiposServico?.length === 0 ? (
                  <div className="p-2 text-center text-muted-foreground text-sm">
                    Nenhum tipo de serviço habilitado para avulso
                  </div>
                ) : (
                  tiposServico?.map((tipo) => (
                    <SelectItem key={tipo.codigo} value={tipo.codigo}>
                      <div className="flex flex-col">
                        <span className="font-medium">{tipo.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {tipo.codigo} • ~{tipo.tempo_execucao_minutos}min
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {tipoSelecionado?.descricao && (
              <p className="text-xs text-muted-foreground">{tipoSelecionado.descricao}</p>
            )}
          </div>

          {/* Localização GPS */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Crosshair className="h-4 w-4" />
              Localização GPS *
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={gpsCapturado ? "outline" : "default"}
                className={gpsCapturado ? "border-green-500 text-green-700" : ""}
                onClick={capturarGPS}
                disabled={capturandoGPS}
              >
                {capturandoGPS ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Capturando...
                  </>
                ) : gpsCapturado ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    GPS Capturado
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    Capturar Localização
                  </>
                )}
              </Button>
              {gpsCapturado && (
                <Badge variant="outline" className="text-xs bg-green-50">
                  {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                </Badge>
              )}
            </div>
            {erroGPS && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {erroGPS}
              </p>
            )}
            {!gpsCapturado && !erroGPS && (
              <p className="text-xs text-muted-foreground">
                Capture a localização atual para registrar as coordenadas da OS
              </p>
            )}
          </div>

          {/* Endereço */}
          <div className="space-y-2">
            <Label htmlFor="endereco" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço *
            </Label>
            <Input
              id="endereco"
              placeholder="Rua, número, bairro, cidade"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="cliente" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nome do Cliente
            </Label>
            <Input
              id="cliente"
              placeholder="Nome do cliente (opcional)"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
            />
          </div>

          {/* Instalação e Medidor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="instalacao" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Instalação
              </Label>
              <Input
                id="instalacao"
                placeholder="Nº instalação"
                value={instalacao}
                onChange={(e) => setInstalacao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medidor">Medidor</Label>
              <Input
                id="medidor"
                placeholder="Nº medidor"
                value={medidor}
                onChange={(e) => setMedidor(e.target.value)}
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações adicionais sobre o serviço..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Resumo */}
          {tipoSelecionado && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-1">
              <p className="font-medium text-sm text-violet-800">Resumo da OS Avulsa</p>
              <div className="text-xs text-violet-600 space-y-0.5">
                <p>• Tipo: {tipoSelecionado.nome}</p>
                <p>• Tempo estimado: ~{tipoSelecionado.tempo_execucao_minutos} minutos</p>
                {tipoSelecionado.valor && <p>• Valor Prev.: R$ {tipoSelecionado.valor.toFixed(2)}</p>}
                <p>• Status inicial: No Local (faça a APR para iniciar)</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => criarOSMutation.mutate()}
            disabled={criarOSMutation.isPending || !tipoServico || !endereco.trim() || !gpsCapturado}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {criarOSMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Criar OS Avulsa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

