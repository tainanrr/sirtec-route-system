import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

interface ValorContrato {
  id?: string;
  contrato_id: string;
  contrato_codigo: string;
  contrato_nome: string;
  valor: number;
  valor_automatico: boolean;
  ultima_atualizacao: string | null;
  qtd_amostras: number;
  valor_calculado?: number;
  carregando?: boolean;
}

interface Props {
  skillCodigo: string;
  skillNome: string;
}

export default function ValoresPorContratoTab({ skillCodigo, skillNome }: Props) {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [valores, setValores] = useState<ValorContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [calculando, setCalculando] = useState<string | null>(null);

  // Carregar contratos ativos e valores existentes
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

      // Buscar valores existentes para este skill
      const { data: valoresData, error: valoresError } = await supabase
        .from("valores_servico_contrato")
        .select("*")
        .eq("skill_codigo", skillCodigo);

      if (valoresError) throw valoresError;

      // Mapear valores existentes por contrato_id
      const valoresMap = new Map(
        (valoresData || []).map(v => [v.contrato_id, v])
      );

      // Criar lista de valores para cada contrato
      const valoresCompletos: ValorContrato[] = (contratosData || []).map(contrato => {
        const valorExistente = valoresMap.get(contrato.id);
        return {
          id: valorExistente?.id,
          contrato_id: contrato.id,
          contrato_codigo: contrato.codigo,
          contrato_nome: contrato.nome,
          valor: valorExistente?.valor || 0,
          valor_automatico: valorExistente?.valor_automatico ?? true,
          ultima_atualizacao: valorExistente?.ultima_atualizacao || null,
          qtd_amostras: valorExistente?.qtd_amostras || 0,
        };
      });

      setContratos(contratosData || []);
      setValores(valoresCompletos);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar contratos e valores");
    } finally {
      setLoading(false);
    }
  }, [skillCodigo]);

  useEffect(() => {
    if (skillCodigo) {
      carregarDados();
    }
  }, [skillCodigo, carregarDados]);

  // Calcular valor médio das últimas 1000 execuções para um contrato
  const calcularValorMedio = async (contratoId: string) => {
    setCalculando(contratoId);
    try {
      // Buscar TODAS as produções com seus tipos de OS
      const { data: producoes, error } = await supabase
        .from("producao_equipes")
        .select(`
          valor_total,
          ordens_servico:ordem_servico_id (
            tipo,
            contrato_id
          )
        `)
        .order("created_at", { ascending: false })
        .limit(5000); // Buscar mais para filtrar depois

      if (error) throw error;

      // Debug: mostrar no console quantas produções foram encontradas
      console.log(`[ValoresPorContrato] Total de produções carregadas: ${producoes?.length || 0}`);
      console.log(`[ValoresPorContrato] Buscando tipo: "${skillCodigo}" (lowercase: "${skillCodigo.toLowerCase()}")`);
      console.log(`[ValoresPorContrato] Buscando contrato: "${contratoId}"`);

      // Filtrar pelo tipo de serviço e contrato
      // Comparação EXATA do tipo (apenas normaliza case para lowercase)
      const skillCodigoLower = skillCodigo.toLowerCase();
      
      // Primeiro, filtrar apenas pelo tipo para debug
      const producoesPorTipo = (producoes || []).filter((p: any) => {
        const tipoOS = (p.ordens_servico?.tipo || "").toLowerCase();
        return tipoOS === skillCodigoLower;
      });
      console.log(`[ValoresPorContrato] Produções do tipo "${skillCodigo}": ${producoesPorTipo.length}`);
      
      // Agora filtrar por contrato
      const producoesPorTipoEContrato = producoesPorTipo.filter((p: any) => {
        const contratoOS = p.ordens_servico?.contrato_id;
        return contratoOS === contratoId;
      });
      console.log(`[ValoresPorContrato] Produções do tipo "${skillCodigo}" COM contrato "${contratoId}": ${producoesPorTipoEContrato.length}`);
      
      // Verificar quantas OSs desse tipo NÃO tem contrato
      const producoesSemContrato = producoesPorTipo.filter((p: any) => !p.ordens_servico?.contrato_id);
      if (producoesSemContrato.length > 0) {
        console.log(`[ValoresPorContrato] ATENÇÃO: ${producoesSemContrato.length} produções do tipo "${skillCodigo}" NÃO têm contrato vinculado!`);
      }

      // Considerar TODAS as produções (inclusive com valor 0)
      // OSs com valor 0 devem ser consideradas na média pois representam execuções reais
      const producoesFiltradas = producoesPorTipoEContrato.slice(0, 1000);
      
      // Estatísticas para informação
      const producoesComValor = producoesFiltradas.filter((p: any) => p.valor_total > 0);
      const producoesZeradas = producoesFiltradas.filter((p: any) => p.valor_total === 0 || p.valor_total === null);
      
      console.log(`[ValoresPorContrato] Total de produções para cálculo: ${producoesFiltradas.length}`);
      console.log(`[ValoresPorContrato] - Com valor > 0: ${producoesComValor.length}`);
      console.log(`[ValoresPorContrato] - Com valor = 0: ${producoesZeradas.length}`);

      if (producoesFiltradas.length === 0) {
        // Verificar se há produções sem contrato
        if (producoesSemContrato.length > 0) {
          toast.warning(`Encontradas ${producoesSemContrato.length} execuções de ${skillNome}, mas SEM contrato vinculado. Execute a migration para vincular contratos às OSs.`);
        } else if (producoesPorTipo.length === 0) {
          toast.info(`Nenhuma execução encontrada para ${skillNome}`);
        } else {
          toast.info(`Nenhuma execução de ${skillNome} encontrada para este contrato`);
        }
        setCalculando(null);
        return null;
      }

      // Calcular média considerando TODAS as produções (inclusive zeradas)
      const soma = producoesFiltradas.reduce((acc: number, p: any) => acc + (p.valor_total || 0), 0);
      const media = soma / producoesFiltradas.length;

      // Atualizar estado local
      setValores(prev => prev.map(v => 
        v.contrato_id === contratoId 
          ? { ...v, valor_calculado: media }
          : v
      ));

      toast.success(`Valor médio: R$ ${media.toFixed(2)} (${producoesFiltradas.length} amostras - ${producoesComValor.length} com valor, ${producoesZeradas.length} zeradas)`);
      
      return { media, amostras: producoesFiltradas.length };
    } catch (error) {
      console.error("Erro ao calcular valor médio:", error);
      toast.error("Erro ao calcular valor médio");
      return null;
    } finally {
      setCalculando(null);
    }
  };

  // Salvar valor para um contrato
  const salvarValor = async (contratoId: string, novoValor: number, automatico: boolean, qtdAmostras: number = 0) => {
    setSaving(contratoId);
    try {
      const valorExistente = valores.find(v => v.contrato_id === contratoId);

      const payload = {
        skill_codigo: skillCodigo,
        contrato_id: contratoId,
        valor: novoValor,
        valor_automatico: automatico,
        ultima_atualizacao: new Date().toISOString(),
        qtd_amostras: qtdAmostras,
      };

      let result;
      if (valorExistente?.id) {
        // Atualizar existente
        result = await supabase
          .from("valores_servico_contrato")
          .update(payload)
          .eq("id", valorExistente.id);
      } else {
        // Inserir novo
        result = await supabase
          .from("valores_servico_contrato")
          .insert(payload);
      }

      if (result.error) throw result.error;

      // Atualizar estado local
      setValores(prev => prev.map(v => 
        v.contrato_id === contratoId 
          ? { 
              ...v, 
              valor: novoValor, 
              valor_automatico: automatico,
              ultima_atualizacao: payload.ultima_atualizacao,
              qtd_amostras: qtdAmostras,
              valor_calculado: undefined,
            }
          : v
      ));

      toast.success("Valor salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar valor:", error);
      toast.error("Erro ao salvar valor");
    } finally {
      setSaving(null);
    }
  };

  // Aplicar valor calculado
  const aplicarValorCalculado = async (contratoId: string) => {
    const valorAtual = valores.find(v => v.contrato_id === contratoId);
    if (valorAtual?.valor_calculado) {
      await salvarValor(contratoId, valorAtual.valor_calculado, true, valorAtual.qtd_amostras);
    }
  };

  // Calcular e aplicar automaticamente
  const calcularEAplicar = async (contratoId: string) => {
    const resultado = await calcularValorMedio(contratoId);
    if (resultado) {
      await salvarValor(contratoId, resultado.media, true, resultado.amostras);
    }
  };

  // Alternar modo automático/manual
  const alternarModo = async (contratoId: string) => {
    const valorAtual = valores.find(v => v.contrato_id === contratoId);
    if (!valorAtual) return;

    const novoModo = !valorAtual.valor_automatico;
    
    // Atualizar estado local imediatamente
    setValores(prev => prev.map(v => 
      v.contrato_id === contratoId 
        ? { ...v, valor_automatico: novoModo }
        : v
    ));

    // Se está ativando o modo automático, calcular e aplicar
    if (novoModo) {
      await calcularEAplicar(contratoId);
    } else {
      // Se está desativando, apenas salvar o modo
      await salvarValor(contratoId, valorAtual.valor, false, valorAtual.qtd_amostras);
    }
  };

  // Atualizar valor manual
  const atualizarValorManual = (contratoId: string, novoValor: string) => {
    const valor = parseFloat(novoValor) || 0;
    setValores(prev => prev.map(v => 
      v.contrato_id === contratoId 
        ? { ...v, valor }
        : v
    ));
  };

  // Salvar valor manual
  const salvarValorManual = async (contratoId: string) => {
    const valorAtual = valores.find(v => v.contrato_id === contratoId);
    if (valorAtual) {
      await salvarValor(contratoId, valorAtual.valor, false, 0);
    }
  };

  // Recalcular todos os valores automáticos
  const recalcularTodos = async () => {
    const valoresAutomaticos = valores.filter(v => v.valor_automatico);
    for (const valor of valoresAutomaticos) {
      await calcularEAplicar(valor.contrato_id);
    }
    toast.success("Todos os valores automáticos foram recalculados!");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (contratos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum contrato ativo encontrado.</p>
        <p className="text-sm">Cadastre contratos ativos para configurar valores por contrato.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Configure valores por contrato. <strong>Auto</strong> = média das últimas 1000 execuções.
        </p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={recalcularTodos}
          disabled={calculando !== null}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Recalcular
        </Button>
      </div>

      <div className="max-h-[400px] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[180px]">Contrato</TableHead>
              <TableHead className="text-center w-[90px]">Modo</TableHead>
              <TableHead className="text-center w-[100px]">Valor</TableHead>
              <TableHead className="text-center w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {valores.map((valor) => (
              <TableRow key={valor.contrato_id} className="group">
                <TableCell className="py-2">
                  <div className="truncate max-w-[170px]" title={`${valor.contrato_codigo} - ${valor.contrato_nome}`}>
                    <span className="font-mono text-xs">{valor.contrato_codigo}</span>
                    <p className="text-xs text-muted-foreground truncate">{valor.contrato_nome}</p>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Switch
                      checked={valor.valor_automatico}
                      onCheckedChange={() => alternarModo(valor.contrato_id)}
                      disabled={calculando === valor.contrato_id || saving === valor.contrato_id}
                      className="scale-75"
                    />
                    <Badge 
                      variant={valor.valor_automatico ? "default" : "outline"}
                      className={`text-[10px] px-1 ${valor.valor_automatico ? "bg-blue-100 text-blue-700" : ""}`}
                    >
                      {valor.valor_automatico ? (
                        <><Calculator className="h-2.5 w-2.5 mr-0.5" />Auto</>
                      ) : (
                        <><Lock className="h-2.5 w-2.5 mr-0.5" />Fix</>
                      )}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  {valor.valor_automatico ? (
                    <span className="font-mono text-sm font-medium text-green-600">
                      {formatCurrency(valor.valor)}
                    </span>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={valor.valor}
                      onChange={(e) => atualizarValorManual(valor.contrato_id, e.target.value)}
                      className="w-24 h-7 text-right font-mono text-sm"
                      onBlur={() => salvarValorManual(valor.contrato_id)}
                      disabled={saving === valor.contrato_id}
                    />
                  )}
                  {valor.qtd_amostras > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ({valor.qtd_amostras} amostras)
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => calcularEAplicar(valor.contrato_id)}
                    disabled={calculando === valor.contrato_id || saving === valor.contrato_id}
                    title="Recalcular valor"
                  >
                    {calculando === valor.contrato_id || saving === valor.contrato_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 <strong>Auto</strong>: valor atualizado automaticamente | <strong>Fix</strong>: valor manual fixo
      </p>
    </div>
  );
}

