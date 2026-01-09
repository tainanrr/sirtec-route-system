import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  RefreshCw, 
  Calculator, 
  Lock, 
  AlertCircle,
  Loader2,
  Building,
  ChevronRight,
  FileText,
  DollarSign
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
  const [expandedContratos, setExpandedContratos] = useState<string[]>([]);

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
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum centro de custo com OSs encontrado.</p>
        <p className="text-sm mt-2">
          Para configurar valores, é necessário que existam Ordens de Serviço do tipo <strong>{skillNome}</strong> 
          {" "}vinculadas a contratos e centros de custo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header com estatísticas e ações */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Building className="h-3 w-3 mr-1" />
            {contratosComCentros.length} contratos
          </Badge>
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <DollarSign className="h-3 w-3 mr-1" />
            {estatisticas.centrosConfigurados}/{estatisticas.totalCentros} configurados
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <FileText className="h-3 w-3 mr-1" />
            {estatisticas.totalOSs} OSs
          </Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={recalcularTodos}
          disabled={calculando !== null}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${calculando ? 'animate-spin' : ''}`} />
          Recalcular Todos
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 Configure valores por <strong>Centro de Custo</strong> dentro de cada <strong>Contrato</strong>. 
        Apenas centros de custo com OSs cadastradas são exibidos.
      </p>

      {/* Lista de contratos com accordion */}
      <div className="max-h-[420px] overflow-y-auto rounded-md border">
        <Accordion 
          type="multiple" 
          value={expandedContratos}
          onValueChange={setExpandedContratos}
          className="w-full"
        >
          {contratosComCentros.map((item) => (
            <AccordionItem key={item.contrato.id} value={item.contrato.id} className="border-b last:border-b-0">
              <AccordionTrigger className="px-4 py-3 hover:bg-muted/50">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-start">
                      <span className="font-mono text-sm font-semibold">{item.contrato.codigo}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {item.contrato.nome}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.centros_custo.length} CC
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-slate-50">
                      {item.qtd_os_total} OSs
                    </Badge>
                    {item.valor_medio_total > 0 && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                        Média: {formatCurrency(item.valor_medio_total)}
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="border-t">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[200px] pl-6">Centro de Custo</TableHead>
                        <TableHead className="text-center w-[60px]">OSs</TableHead>
                        <TableHead className="text-center w-[90px]">Modo</TableHead>
                        <TableHead className="text-center w-[110px]">Valor</TableHead>
                        <TableHead className="text-center w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.centros_custo.map((centro) => {
                        const key = `${item.contrato.id}_${centro.centro_custo_id}`;
                        const isCalculando = calculando === key;
                        const isSaving = saving === key;
                        const isLoading = isCalculando || isSaving;

                        return (
                          <TableRow key={centro.centro_custo_id} className="group">
                            <TableCell className="py-2 pl-6">
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                <div className="truncate max-w-[180px]" title={`${centro.centro_custo_codigo} - ${centro.centro_custo_nome}`}>
                                  <span className="font-mono text-xs">{centro.centro_custo_codigo}</span>
                                  <p className="text-xs text-muted-foreground truncate">{centro.centro_custo_nome}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <Badge variant="secondary" className="text-xs">
                                {centro.qtd_os_total}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <div className="flex items-center justify-center gap-1">
                                <Switch
                                  checked={centro.valor_automatico}
                                  onCheckedChange={() => alternarModo(item.contrato.id, centro.centro_custo_id)}
                                  disabled={isLoading}
                                  className="scale-75"
                                />
                                <Badge 
                                  variant={centro.valor_automatico ? "default" : "outline"}
                                  className={`text-[10px] px-1 ${centro.valor_automatico ? "bg-blue-100 text-blue-700" : ""}`}
                                >
                                  {centro.valor_automatico ? (
                                    <><Calculator className="h-2.5 w-2.5 mr-0.5" />Auto</>
                                  ) : (
                                    <><Lock className="h-2.5 w-2.5 mr-0.5" />Fix</>
                                  )}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              {centro.valor_automatico ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-mono text-sm font-medium text-green-600">
                                    {formatCurrency(centro.valor)}
                                  </span>
                                  {centro.qtd_amostras > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      ({centro.qtd_amostras} amostras)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={centro.valor}
                                  onChange={(e) => atualizarValorManual(item.contrato.id, centro.centro_custo_id, e.target.value)}
                                  className="w-24 h-7 text-right font-mono text-sm mx-auto"
                                  onBlur={() => salvarValorManual(item.contrato.id, centro.centro_custo_id)}
                                  disabled={isLoading}
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => calcularEAplicar(item.contrato.id, centro.centro_custo_id)}
                                disabled={isLoading}
                                title="Recalcular valor"
                              >
                                {isLoading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {/* Ação para recalcular todo o contrato */}
                  <div className="px-4 py-2 bg-muted/20 border-t flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => recalcularContrato(item.contrato.id)}
                      disabled={calculando !== null}
                      className="text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Recalcular Contrato
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Auto</strong>: valor atualizado automaticamente com base nas últimas 1000 execuções | <strong>Fix</strong>: valor manual fixo
      </p>
    </div>
  );
}
