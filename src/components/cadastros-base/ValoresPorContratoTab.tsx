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
  Loader2
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

interface CentroCustoComOS extends CentroCusto {
  qtd_os_total: number;
  qtd_os_concluidas: number;
  qtd_os_abertas: number;
}

interface ValorCentroCusto {
  id?: string;
  contrato_id: string;
  centro_custo_id: string;
  centro_custo_codigo: string;
  centro_custo_nome: string;
  valor: number;
  valor_automatico: boolean;
  ultima_atualizacao: string | null;
  qtd_amostras: number;
  valor_calculado?: number;
  qtd_os_total: number;
}

interface ContratoComCentros {
  contrato: Contrato;
  centros_custo: ValorCentroCusto[];
  valor_medio_total: number;
  qtd_os_total: number;
}

interface Props {
  skillCodigo: string;
  skillNome: string;
}

export default function ValoresPorContratoTab({ skillCodigo, skillNome }: Props) {
  const [contratosComCentros, setContratosComCentros] = useState<ContratoComCentros[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [calculando, setCalculando] = useState<string | null>(null);

  // Carregar contratos, centros de custo com OSs e valores existentes
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

      // Buscar valores existentes para este skill
      const { data: valoresData, error: valoresError } = await supabase
        .from("valores_servico_centro_custo")
        .select("*")
        .eq("skill_codigo", skillCodigo);

      if (valoresError) {
        // Se a tabela não existir ainda, continuar com array vazio
        console.log("Tabela valores_servico_centro_custo pode não existir ainda:", valoresError);
      }

      // Mapear valores existentes por contrato_id + centro_custo_id
      const valoresMap = new Map(
        (valoresData || []).map(v => [`${v.contrato_id}_${v.centro_custo_id}`, v])
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
        const centrosComOS: ValorCentroCusto[] = [];
        const centrosJaAdicionados = new Set<string>();

        // Primeiro: adicionar centros que têm OSs
        osCountMap.forEach((counts, key) => {
          const [contratoId, centroCustoId] = key.split("_");
          if (contratoId === contrato.id) {
            const centroCusto = centrosCustoMap.get(centroCustoId);
            if (centroCusto) {
              const valorKey = `${contratoId}_${centroCustoId}`;
              const valorExistente = valoresMap.get(valorKey);

              centrosComOS.push({
                id: valorExistente?.id,
                contrato_id: contrato.id,
                centro_custo_id: centroCusto.id,
                centro_custo_codigo: centroCusto.codigo,
                centro_custo_nome: centroCusto.nome,
                valor: valorExistente?.valor || 0,
                valor_automatico: valorExistente?.valor_automatico ?? true,
                ultima_atualizacao: valorExistente?.ultima_atualizacao || null,
                qtd_amostras: valorExistente?.qtd_amostras || 0,
                qtd_os_total: counts.total,
              });
              centrosJaAdicionados.add(centroCustoId);
            }
          }
        });

        // Segundo: adicionar centros que têm valores configurados mas não têm OSs
        valoresMap.forEach((valorConfig, key) => {
          const [contratoId, centroCustoId] = key.split("_");
          if (contratoId === contrato.id && !centrosJaAdicionados.has(centroCustoId)) {
            const centroCusto = centrosCustoMap.get(centroCustoId);
            if (centroCusto) {
              centrosComOS.push({
                id: valorConfig.id,
                contrato_id: contrato.id,
                centro_custo_id: centroCusto.id,
                centro_custo_codigo: centroCusto.codigo,
                centro_custo_nome: centroCusto.nome,
                valor: valorConfig.valor || 0,
                valor_automatico: valorConfig.valor_automatico ?? true,
                ultima_atualizacao: valorConfig.ultima_atualizacao || null,
                qtd_amostras: valorConfig.qtd_amostras || 0,
                qtd_os_total: 0, // Sem OSs
              });
              centrosJaAdicionados.add(centroCustoId);
            }
          }
        });

        if (centrosComOS.length > 0) {
          // Calcular valor médio total do contrato (média dos valores dos centros)
          const valoresDefinidos = centrosComOS.filter(c => c.valor > 0);
          const valorMedioTotal = valoresDefinidos.length > 0
            ? valoresDefinidos.reduce((acc, c) => acc + c.valor, 0) / valoresDefinidos.length
            : 0;

          const qtdOsTotal = centrosComOS.reduce((acc, c) => acc + c.qtd_os_total, 0);

          contratosResultado.push({
            contrato,
            centros_custo: centrosComOS.sort((a, b) => a.centro_custo_codigo.localeCompare(b.centro_custo_codigo)),
            valor_medio_total: valorMedioTotal,
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

  // Calcular valor médio das últimas execuções para um centro de custo específico
  const calcularValorMedio = async (contratoId: string, centroCustoId: string) => {
    const key = `${contratoId}_${centroCustoId}`;
    setCalculando(key);
    try {
      // Buscar produções com seus tipos de OS, filtrando por contrato e centro de custo
      const { data: producoes, error } = await supabase
        .from("producao_equipes")
        .select(`
          valor_total,
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
        return tipoOS === skillCodigoLower && contratoOS === contratoId && centroOS === centroCustoId;
      }).slice(0, 1000);

      console.log(`[ValoresPorCentroCusto] Produções filtradas para ${skillCodigo}/${contratoId}/${centroCustoId}: ${producoesFiltradas.length}`);

      if (producoesFiltradas.length === 0) {
        toast.info(`Nenhuma execução encontrada para este centro de custo`);
        setCalculando(null);
        return null;
      }

      // Calcular média
      const soma = producoesFiltradas.reduce((acc: number, p: any) => acc + (p.valor_total || 0), 0);
      const media = soma / producoesFiltradas.length;

      // Atualizar estado local
      setContratosComCentros(prev => prev.map(c => 
        c.contrato.id === contratoId 
          ? {
              ...c,
              centros_custo: c.centros_custo.map(cc => 
                cc.centro_custo_id === centroCustoId
                  ? { ...cc, valor_calculado: media }
                  : cc
              )
            }
          : c
      ));

      const producoesComValor = producoesFiltradas.filter((p: any) => p.valor_total > 0);
      toast.success(`Valor médio: R$ ${media.toFixed(2)} (${producoesFiltradas.length} amostras)`);
      
      return { media, amostras: producoesFiltradas.length };
    } catch (error) {
      console.error("Erro ao calcular valor médio:", error);
      toast.error("Erro ao calcular valor médio");
      return null;
    } finally {
      setCalculando(null);
    }
  };

  // Atualizar valor previsto das OSs em aberto
  const atualizarValorOSsEmAberto = async (contratoId: string, centroCustoId: string, novoValor: number) => {
    try {
      const statusEmAberto = ["pendente", "planejada", "andamento", "atrasada", "em_deslocamento", "no_local", "em_execucao", "pausada"];
      
      const { data, error } = await supabase
        .from("ordens_servico")
        .update({ valor: novoValor })
        .eq("tipo", skillCodigo.toLowerCase())
        .eq("contrato_id", contratoId)
        .eq("centro_custo_id", centroCustoId)
        .in("status", statusEmAberto)
        .select("id");

      if (error) {
        console.error("Erro ao atualizar OSs em aberto:", error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error("Erro ao atualizar OSs em aberto:", error);
      return 0;
    }
  };

  // Salvar valor para um centro de custo
  const salvarValor = async (contratoId: string, centroCustoId: string, novoValor: number, automatico: boolean, qtdAmostras: number = 0) => {
    const key = `${contratoId}_${centroCustoId}`;
    setSaving(key);
    try {
      // Encontrar valor existente
      const contratoAtual = contratosComCentros.find(c => c.contrato.id === contratoId);
      const valorExistente = contratoAtual?.centros_custo.find(cc => cc.centro_custo_id === centroCustoId);

      const payload = {
        skill_codigo: skillCodigo,
        contrato_id: contratoId,
        centro_custo_id: centroCustoId,
        valor: novoValor,
        valor_automatico: automatico,
        ultima_atualizacao: new Date().toISOString(),
        qtd_amostras: qtdAmostras,
      };

      let result;
      if (valorExistente?.id) {
        result = await supabase
          .from("valores_servico_centro_custo")
          .update(payload)
          .eq("id", valorExistente.id);
      } else {
        result = await supabase
          .from("valores_servico_centro_custo")
          .insert(payload);
      }

      if (result.error) throw result.error;

      // Atualizar valor previsto das OSs em aberto
      const qtdOSsAtualizadas = await atualizarValorOSsEmAberto(contratoId, centroCustoId, novoValor);

      // Atualizar estado local
      setContratosComCentros(prev => prev.map(c => 
        c.contrato.id === contratoId 
          ? {
              ...c,
              centros_custo: c.centros_custo.map(cc => 
                cc.centro_custo_id === centroCustoId
                  ? { 
                      ...cc, 
                      valor: novoValor, 
                      valor_automatico: automatico,
                      ultima_atualizacao: payload.ultima_atualizacao,
                      qtd_amostras: qtdAmostras,
                      valor_calculado: undefined,
                    }
                  : cc
              )
            }
          : c
      ));

      if (qtdOSsAtualizadas > 0) {
        toast.success(`Valor salvo! ${qtdOSsAtualizadas} OS(s) em aberto atualizadas.`);
      } else {
        toast.success("Valor salvo com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao salvar valor:", error);
      toast.error("Erro ao salvar valor");
    } finally {
      setSaving(null);
    }
  };

  // Calcular e aplicar automaticamente
  const calcularEAplicar = async (contratoId: string, centroCustoId: string) => {
    const resultado = await calcularValorMedio(contratoId, centroCustoId);
    if (resultado) {
      await salvarValor(contratoId, centroCustoId, resultado.media, true, resultado.amostras);
    }
  };

  // Alternar modo automático/manual
  const alternarModo = async (contratoId: string, centroCustoId: string) => {
    const contratoAtual = contratosComCentros.find(c => c.contrato.id === contratoId);
    const valorAtual = contratoAtual?.centros_custo.find(cc => cc.centro_custo_id === centroCustoId);
    if (!valorAtual) return;

    const novoModo = !valorAtual.valor_automatico;
    
    // Atualizar estado local imediatamente
    setContratosComCentros(prev => prev.map(c => 
      c.contrato.id === contratoId 
        ? {
            ...c,
            centros_custo: c.centros_custo.map(cc => 
              cc.centro_custo_id === centroCustoId
                ? { ...cc, valor_automatico: novoModo }
                : cc
            )
          }
        : c
    ));

    if (novoModo) {
      await calcularEAplicar(contratoId, centroCustoId);
    } else {
      await salvarValor(contratoId, centroCustoId, valorAtual.valor, false, valorAtual.qtd_amostras);
    }
  };

  // Atualizar valor manual
  const atualizarValorManual = (contratoId: string, centroCustoId: string, novoValor: string) => {
    const valor = parseFloat(novoValor) || 0;
    setContratosComCentros(prev => prev.map(c => 
      c.contrato.id === contratoId 
        ? {
            ...c,
            centros_custo: c.centros_custo.map(cc => 
              cc.centro_custo_id === centroCustoId
                ? { ...cc, valor }
                : cc
            )
          }
        : c
    ));
  };

  // Salvar valor manual
  const salvarValorManual = async (contratoId: string, centroCustoId: string) => {
    const contratoAtual = contratosComCentros.find(c => c.contrato.id === contratoId);
    const valorAtual = contratoAtual?.centros_custo.find(cc => cc.centro_custo_id === centroCustoId);
    if (valorAtual) {
      await salvarValor(contratoId, centroCustoId, valorAtual.valor, false, 0);
    }
  };

  // Recalcular todos os valores automáticos
  const recalcularTodos = async () => {
    for (const contrato of contratosComCentros) {
      for (const centro of contrato.centros_custo) {
        if (centro.valor_automatico) {
          await calcularEAplicar(contrato.contrato.id, centro.centro_custo_id);
        }
      }
    }
    toast.success("Todos os valores automáticos foram recalculados!");
  };

  // Recalcular todos de um contrato específico
  const recalcularContrato = async (contratoId: string) => {
    const contrato = contratosComCentros.find(c => c.contrato.id === contratoId);
    if (!contrato) return;

    for (const centro of contrato.centros_custo) {
      if (centro.valor_automatico) {
        await calcularEAplicar(contratoId, centro.centro_custo_id);
      }
    }
    toast.success("Valores do contrato recalculados!");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Estatísticas gerais
  const estatisticas = useMemo(() => {
    const totalCentros = contratosComCentros.reduce((acc, c) => acc + c.centros_custo.length, 0);
    const totalOSs = contratosComCentros.reduce((acc, c) => acc + c.qtd_os_total, 0);
    const centrosConfigurados = contratosComCentros.reduce((acc, c) => 
      acc + c.centros_custo.filter(cc => cc.valor > 0).length, 0
    );
    return { totalCentros, totalOSs, centrosConfigurados };
  }, [contratosComCentros]);

  // Criar lista flat de todos os itens para exibir (deve ficar antes dos early returns)
  const listaFlat = useMemo(() => {
    const items: Array<{
      tipo: 'contrato' | 'centro';
      contrato: Contrato;
      centro?: ValorCentroCusto;
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
                  checked={centro.valor_automatico}
                  onCheckedChange={() => alternarModo(item.contrato.id, centro.centro_custo_id)}
                  disabled={isLoading}
                  className="scale-[0.6]"
                />
                <span className={`text-[9px] w-6 ${centro.valor_automatico ? 'text-blue-600' : 'text-gray-500'}`}>
                  {centro.valor_automatico ? 'Auto' : 'Fix'}
                </span>
              </div>

              {/* Valor */}
              <div className="w-20 text-right shrink-0">
                {centro.valor_automatico ? (
                  <span className="font-mono text-green-600 font-medium">
                    {formatCurrency(centro.valor)}
                  </span>
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={centro.valor}
                    onChange={(e) => atualizarValorManual(item.contrato.id, centro.centro_custo_id, e.target.value)}
                    className="w-20 h-5 text-right font-mono text-[11px] px-1"
                    onBlur={() => salvarValorManual(item.contrato.id, centro.centro_custo_id)}
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
        <strong>Auto</strong>: média das últimas 1000 execuções | <strong>Fix</strong>: valor manual
      </p>
    </div>
  );
}
