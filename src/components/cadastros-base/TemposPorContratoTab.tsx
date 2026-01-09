import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  Calculator, 
  Lock, 
  AlertCircle,
  Loader2,
  Clock
} from "lucide-react";
import { toast } from "sonner";

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
}

interface TempoCentroCusto {
  id?: string;
  contrato_id: string;
  centro_custo_id: string;
  centro_custo_codigo: string;
  centro_custo_nome: string;
  tempo_minutos: number;
  tempo_automatico: boolean;
  ultima_atualizacao: string | null;
  qtd_amostras: number;
  tempo_calculado?: number;
  qtd_os_total: number;
}

interface ContratoComCentros {
  contrato: Contrato;
  centros_custo: TempoCentroCusto[];
  tempo_medio_total: number;
  qtd_os_total: number;
}

interface Props {
  skillCodigo: string;
  skillNome: string;
}

export default function TemposPorContratoTab({ skillCodigo, skillNome }: Props) {
  const [contratosComCentros, setContratosComCentros] = useState<ContratoComCentros[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [calculando, setCalculando] = useState<string | null>(null);

  // Carregar contratos, centros de custo com OSs e tempos existentes
  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar contratos ativos
      const { data: contratosData, error: contratosError } = await supabase
        .from("contratos")
        .select("id, codigo, nome")
        .eq("status", "ativo")
        .order("codigo");

      if (contratosError) throw contratosError;

      // Buscar centros de custo ativos
      const { data: centrosCustoData, error: centrosError } = await supabase
        .from("centros_custo")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("codigo");

      if (centrosError) throw centrosError;

      // Buscar todas as OSs deste tipo para identificar quais centros de custo têm dados
      const { data: osData, error: osError } = await supabase
        .from("ordens_servico")
        .select("id, contrato_id, centro_custo_id, status")
        .eq("tipo", skillCodigo.toLowerCase());

      if (osError) throw osError;

      // Buscar tempos existentes para este skill
      const { data: temposData, error: temposError } = await supabase
        .from("tempos_servico_centro_custo")
        .select("*")
        .eq("skill_codigo", skillCodigo);

      if (temposError) {
        // Se a tabela não existir ainda, continuar com array vazio
        console.log("Tabela tempos_servico_centro_custo pode não existir ainda:", temposError);
      }

      // Mapear tempos existentes por contrato_id + centro_custo_id
      const temposMap = new Map(
        (temposData || []).map(t => [`${t.contrato_id}_${t.centro_custo_id}`, t])
      );

      // Mapear centros de custo por ID
      const centrosCustoMap = new Map(
        (centrosCustoData || []).map(cc => [cc.id, cc])
      );

      // Agrupar OSs por contrato e centro de custo
      const osCountMap = new Map<string, { total: number; concluidas: number; abertas: number }>();
      (osData || []).forEach(os => {
        if (os.contrato_id && os.centro_custo_id) {
          const key = `${os.contrato_id}_${os.centro_custo_id}`;
          const current = osCountMap.get(key) || { total: 0, concluidas: 0, abertas: 0 };
          current.total++;
          if (os.status === "concluida") {
            current.concluidas++;
          } else if (os.status !== "cancelada") {
            current.abertas++;
          }
          osCountMap.set(key, current);
        }
      });

      // Criar estrutura de contratos com centros de custo
      const contratosResultado: ContratoComCentros[] = [];

      for (const contrato of (contratosData || [])) {
        // Encontrar centros de custo com OSs para este contrato
        const centrosComOS: TempoCentroCusto[] = [];

        osCountMap.forEach((counts, key) => {
          const [contratoId, centroCustoId] = key.split("_");
          if (contratoId === contrato.id) {
            const centroCusto = centrosCustoMap.get(centroCustoId);
            if (centroCusto) {
              const tempoKey = `${contratoId}_${centroCustoId}`;
              const tempoExistente = temposMap.get(tempoKey);

              centrosComOS.push({
                id: tempoExistente?.id,
                contrato_id: contrato.id,
                centro_custo_id: centroCusto.id,
                centro_custo_codigo: centroCusto.codigo,
                centro_custo_nome: centroCusto.nome,
                tempo_minutos: tempoExistente?.tempo_minutos || 0,
                tempo_automatico: tempoExistente?.tempo_automatico ?? true,
                ultima_atualizacao: tempoExistente?.ultima_atualizacao || null,
                qtd_amostras: tempoExistente?.qtd_amostras || 0,
                qtd_os_total: counts.total,
              });
            }
          }
        });

        if (centrosComOS.length > 0) {
          // Calcular tempo médio total do contrato (média dos tempos dos centros)
          const temposDefinidos = centrosComOS.filter(c => c.tempo_minutos > 0);
          const tempoMedioTotal = temposDefinidos.length > 0
            ? temposDefinidos.reduce((acc, c) => acc + c.tempo_minutos, 0) / temposDefinidos.length
            : 0;

          const qtdOsTotal = centrosComOS.reduce((acc, c) => acc + c.qtd_os_total, 0);

          contratosResultado.push({
            contrato,
            centros_custo: centrosComOS.sort((a, b) => a.centro_custo_codigo.localeCompare(b.centro_custo_codigo)),
            tempo_medio_total: tempoMedioTotal,
            qtd_os_total: qtdOsTotal,
          });
        }
      }

      setContratosComCentros(contratosResultado.sort((a, b) => 
        a.contrato.codigo.localeCompare(b.contrato.codigo)
      ));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [skillCodigo]);

  useEffect(() => {
    if (skillCodigo) {
      carregarDados();
    }
  }, [skillCodigo, carregarDados]);

  // Calcular tempo médio das últimas execuções para um centro de custo específico
  const calcularTempoMedio = async (contratoId: string, centroCustoId: string) => {
    const key = `${contratoId}_${centroCustoId}`;
    setCalculando(key);
    try {
      // Buscar produções com tempo de execução, filtrando por contrato e centro de custo
      const { data: producoes, error } = await supabase
        .from("producao_equipes")
        .select(`
          tempo_execucao_minutos,
          ordens_servico:ordem_servico_id (
            tipo,
            contrato_id,
            centro_custo_id
          )
        `)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;

      // Filtrar pelo tipo de serviço, contrato e centro de custo
      const skillCodigoLower = skillCodigo.toLowerCase();
      
      const producoesFiltradas = (producoes || []).filter((p: any) => {
        const tipoOS = (p.ordens_servico?.tipo || "").toLowerCase();
        const contratoOS = p.ordens_servico?.contrato_id;
        const centroOS = p.ordens_servico?.centro_custo_id;
        // Filtrar apenas produções com tempo válido (> 0)
        return tipoOS === skillCodigoLower && 
               contratoOS === contratoId && 
               centroOS === centroCustoId &&
               p.tempo_execucao_minutos > 0;
      }).slice(0, 1000);

      console.log(`[TemposPorCentroCusto] Produções filtradas para ${skillCodigo}/${contratoId}/${centroCustoId}: ${producoesFiltradas.length}`);

      if (producoesFiltradas.length === 0) {
        toast.info(`Nenhuma execução com tempo válido encontrada para este centro de custo`);
        setCalculando(null);
        return null;
      }

      // Calcular média do tempo de execução
      const soma = producoesFiltradas.reduce((acc: number, p: any) => acc + (p.tempo_execucao_minutos || 0), 0);
      const media = soma / producoesFiltradas.length;

      // Atualizar estado local
      setContratosComCentros(prev => prev.map(c => 
        c.contrato.id === contratoId 
          ? {
              ...c,
              centros_custo: c.centros_custo.map(cc => 
                cc.centro_custo_id === centroCustoId
                  ? { ...cc, tempo_calculado: media }
                  : cc
              )
            }
          : c
      ));

      toast.success(`Tempo médio: ${media.toFixed(0)} min (${producoesFiltradas.length} amostras)`);
      
      return { media, amostras: producoesFiltradas.length };
    } catch (error) {
      console.error("Erro ao calcular tempo médio:", error);
      toast.error("Erro ao calcular tempo médio");
      return null;
    } finally {
      setCalculando(null);
    }
  };

  // Atualizar tempo previsto das OSs em aberto
  const atualizarTempoOSsEmAberto = async (contratoId: string, centroCustoId: string, novoTempo: number) => {
    try {
      const statusEmAberto = ["pendente", "planejada", "andamento", "atrasada", "em_deslocamento", "no_local", "em_execucao", "pausada"];
      
      const { data, error } = await supabase
        .from("ordens_servico")
        .update({ tempo_execucao_previsto: novoTempo })
        .eq("tipo", skillCodigo.toLowerCase())
        .eq("contrato_id", contratoId)
        .eq("centro_custo_id", centroCustoId)
        .in("status", statusEmAberto)
        .select("id");

      if (error) {
        console.error("Erro ao atualizar tempo das OSs em aberto:", error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error("Erro ao atualizar tempo das OSs em aberto:", error);
      return 0;
    }
  };

  // Salvar tempo para um centro de custo
  const salvarTempo = async (contratoId: string, centroCustoId: string, novoTempo: number, automatico: boolean, qtdAmostras: number = 0) => {
    const key = `${contratoId}_${centroCustoId}`;
    setSaving(key);
    try {
      // Encontrar tempo existente
      const contratoAtual = contratosComCentros.find(c => c.contrato.id === contratoId);
      const tempoExistente = contratoAtual?.centros_custo.find(cc => cc.centro_custo_id === centroCustoId);

      const payload = {
        skill_codigo: skillCodigo,
        contrato_id: contratoId,
        centro_custo_id: centroCustoId,
        tempo_minutos: novoTempo,
        tempo_automatico: automatico,
        ultima_atualizacao: new Date().toISOString(),
        qtd_amostras: qtdAmostras,
      };

      let result;
      if (tempoExistente?.id) {
        result = await supabase
          .from("tempos_servico_centro_custo")
          .update(payload)
          .eq("id", tempoExistente.id);
      } else {
        result = await supabase
          .from("tempos_servico_centro_custo")
          .insert(payload);
      }

      if (result.error) throw result.error;

      // Atualizar tempo previsto das OSs em aberto
      const qtdOSsAtualizadas = await atualizarTempoOSsEmAberto(contratoId, centroCustoId, novoTempo);

      // Atualizar estado local
      setContratosComCentros(prev => prev.map(c => 
        c.contrato.id === contratoId 
          ? {
              ...c,
              centros_custo: c.centros_custo.map(cc => 
                cc.centro_custo_id === centroCustoId
                  ? { 
                      ...cc, 
                      tempo_minutos: novoTempo, 
                      tempo_automatico: automatico,
                      ultima_atualizacao: payload.ultima_atualizacao,
                      qtd_amostras: qtdAmostras,
                      tempo_calculado: undefined,
                    }
                  : cc
              )
            }
          : c
      ));

      if (qtdOSsAtualizadas > 0) {
        toast.success(`Tempo salvo! ${qtdOSsAtualizadas} OS(s) em aberto atualizadas.`);
      } else {
        toast.success("Tempo salvo com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao salvar tempo:", error);
      toast.error("Erro ao salvar tempo");
    } finally {
      setSaving(null);
    }
  };

  // Calcular e aplicar automaticamente
  const calcularEAplicar = async (contratoId: string, centroCustoId: string) => {
    const resultado = await calcularTempoMedio(contratoId, centroCustoId);
    if (resultado) {
      await salvarTempo(contratoId, centroCustoId, resultado.media, true, resultado.amostras);
    }
  };

  // Alternar modo automático/manual
  const alternarModo = async (contratoId: string, centroCustoId: string) => {
    const contratoAtual = contratosComCentros.find(c => c.contrato.id === contratoId);
    const tempoAtual = contratoAtual?.centros_custo.find(cc => cc.centro_custo_id === centroCustoId);
    if (!tempoAtual) return;

    const novoModo = !tempoAtual.tempo_automatico;
    
    // Atualizar estado local imediatamente
    setContratosComCentros(prev => prev.map(c => 
      c.contrato.id === contratoId 
        ? {
            ...c,
            centros_custo: c.centros_custo.map(cc => 
              cc.centro_custo_id === centroCustoId
                ? { ...cc, tempo_automatico: novoModo }
                : cc
            )
          }
        : c
    ));

    if (novoModo) {
      await calcularEAplicar(contratoId, centroCustoId);
    } else {
      await salvarTempo(contratoId, centroCustoId, tempoAtual.tempo_minutos, false, tempoAtual.qtd_amostras);
    }
  };

  // Atualizar tempo manual
  const atualizarTempoManual = (contratoId: string, centroCustoId: string, novoTempo: string) => {
    const tempo = parseFloat(novoTempo) || 0;
    setContratosComCentros(prev => prev.map(c => 
      c.contrato.id === contratoId 
        ? {
            ...c,
            centros_custo: c.centros_custo.map(cc => 
              cc.centro_custo_id === centroCustoId
                ? { ...cc, tempo_minutos: tempo }
                : cc
            )
          }
        : c
    ));
  };

  // Salvar tempo manual
  const salvarTempoManual = async (contratoId: string, centroCustoId: string) => {
    const contratoAtual = contratosComCentros.find(c => c.contrato.id === contratoId);
    const tempoAtual = contratoAtual?.centros_custo.find(cc => cc.centro_custo_id === centroCustoId);
    if (tempoAtual) {
      await salvarTempo(contratoId, centroCustoId, tempoAtual.tempo_minutos, false, 0);
    }
  };

  // Recalcular todos os tempos automáticos
  const recalcularTodos = async () => {
    for (const contrato of contratosComCentros) {
      for (const centro of contrato.centros_custo) {
        if (centro.tempo_automatico) {
          await calcularEAplicar(contrato.contrato.id, centro.centro_custo_id);
        }
      }
    }
    toast.success("Todos os tempos automáticos foram recalculados!");
  };

  const formatTempo = (minutos: number) => {
    if (minutos < 60) {
      return `${minutos.toFixed(0)} min`;
    }
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
  };

  // Estatísticas gerais
  const estatisticas = useMemo(() => {
    const totalCentros = contratosComCentros.reduce((acc, c) => acc + c.centros_custo.length, 0);
    const totalOSs = contratosComCentros.reduce((acc, c) => acc + c.qtd_os_total, 0);
    const centrosConfigurados = contratosComCentros.reduce((acc, c) => 
      acc + c.centros_custo.filter(cc => cc.tempo_minutos > 0).length, 0
    );
    return { totalCentros, totalOSs, centrosConfigurados };
  }, [contratosComCentros]);

  // Criar lista flat de todos os itens para exibir (deve ficar antes dos early returns)
  const listaFlat = useMemo(() => {
    const items: Array<{
      tipo: 'contrato' | 'centro';
      contrato: Contrato;
      centro?: TempoCentroCusto;
      qtdCentros?: number;
      qtdOSs?: number;
    }> = [];
    
    contratosComCentros.forEach(item => {
      // Adicionar header do contrato
      items.push({
        tipo: 'contrato',
        contrato: item.contrato,
        qtdCentros: item.centros_custo.length,
        qtdOSs: item.qtd_os_total,
      });
      // Adicionar centros de custo
      item.centros_custo.forEach(centro => {
        items.push({
          tipo: 'centro',
          contrato: item.contrato,
          centro,
        });
      });
    });
    
    return items;
  }, [contratosComCentros]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (contratosComCentros.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum centro de custo com OSs encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {contratosComCentros.length} contratos
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {estatisticas.centrosConfigurados}/{estatisticas.totalCentros} config.
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {estatisticas.totalOSs} OSs
          </Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={recalcularTodos}
          disabled={calculando !== null}
          className="h-7 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${calculando ? 'animate-spin' : ''}`} />
          Recalcular
        </Button>
      </div>

      {/* Lista compacta */}
      <div className="max-h-[280px] overflow-y-auto border rounded text-xs">
        {listaFlat.map((item, idx) => {
          if (item.tipo === 'contrato') {
            return (
              <div 
                key={`contrato-${item.contrato.id}`} 
                className="flex items-center justify-between px-2 py-1.5 bg-muted/50 border-b font-medium sticky top-0"
              >
                <span className="font-mono">{item.contrato.codigo}</span>
                <span className="text-muted-foreground text-[10px]">
                  {item.qtdCentros} CC · {item.qtdOSs} OSs
                </span>
              </div>
            );
          }

          const centro = item.centro!;
          const key = `${item.contrato.id}_${centro.centro_custo_id}`;
          const isLoading = calculando === key || saving === key;

          return (
            <div 
              key={key}
              className="flex items-center gap-2 px-2 py-1 border-b last:border-b-0 hover:bg-muted/30"
            >
              {/* Centro de Custo */}
              <div className="flex-1 min-w-0 pl-2">
                <span className="font-mono text-[11px]">{centro.centro_custo_codigo}</span>
                <span className="text-muted-foreground ml-1 truncate text-[10px]">
                  {centro.centro_custo_nome}
                </span>
              </div>

              {/* OSs */}
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">
                {centro.qtd_os_total}
              </Badge>

              {/* Switch Auto/Fix */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Switch
                  checked={centro.tempo_automatico}
                  onCheckedChange={() => alternarModo(item.contrato.id, centro.centro_custo_id)}
                  disabled={isLoading}
                  className="scale-[0.6]"
                />
                <span className={`text-[9px] w-6 ${centro.tempo_automatico ? 'text-blue-600' : 'text-gray-500'}`}>
                  {centro.tempo_automatico ? 'Auto' : 'Fix'}
                </span>
              </div>

              {/* Tempo */}
              <div className="w-16 text-right shrink-0">
                {centro.tempo_automatico ? (
                  <span className="font-mono text-orange-600 font-medium flex items-center justify-end gap-0.5">
                    <Clock className="h-3 w-3" />
                    {formatTempo(centro.tempo_minutos)}
                  </span>
                ) : (
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    value={centro.tempo_minutos}
                    onChange={(e) => atualizarTempoManual(item.contrato.id, centro.centro_custo_id, e.target.value)}
                    className="w-16 h-5 text-right font-mono text-[11px] px-1"
                    onBlur={() => salvarTempoManual(item.contrato.id, centro.centro_custo_id)}
                    disabled={isLoading}
                  />
                )}
              </div>

              {/* Botão recalcular */}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => calcularEAplicar(item.contrato.id, centro.centro_custo_id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        <strong>Auto</strong>: média das últimas 1000 execuções (tempo efetivo) | <strong>Fix</strong>: tempo manual
      </p>
    </div>
  );
}

