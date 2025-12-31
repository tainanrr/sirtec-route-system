import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Unlock, 
  DollarSign,
  History,
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
      // Buscar OSs concluídas deste tipo de serviço para este contrato
      // Usando producao_equipes que tem valor_total e está vinculado a OS
      const { data: producoes, error } = await supabase
        .from("producao_equipes")
        .select(`
          valor_total,
          ordens_servico:ordem_servico_id (
            tipo,
            contrato_id
          )
        `)
        .not("valor_total", "is", null)
        .order("created_at", { ascending: false })
        .limit(5000); // Buscar mais para filtrar depois

      if (error) throw error;

      // Filtrar pelo tipo de serviço e contrato
      const producoesFiltradas = (producoes || [])
        .filter((p: any) => 
          p.ordens_servico?.tipo === skillCodigo && 
          p.ordens_servico?.contrato_id === contratoId &&
          p.valor_total > 0
        )
        .slice(0, 1000); // Pegar apenas as últimas 1000

      if (producoesFiltradas.length === 0) {
        toast.info(`Nenhuma execução encontrada para ${skillNome} neste contrato`);
        setCalculando(null);
        return null;
      }

      // Calcular média
      const soma = producoesFiltradas.reduce((acc: number, p: any) => acc + (p.valor_total || 0), 0);
      const media = soma / producoesFiltradas.length;

      // Atualizar estado local
      setValores(prev => prev.map(v => 
        v.contrato_id === contratoId 
          ? { ...v, valor_calculado: media }
          : v
      ));

      toast.success(`Valor médio calculado: R$ ${media.toFixed(2)} (${producoesFiltradas.length} amostras)`);
      
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Valores por Contrato</h4>
          <p className="text-sm text-muted-foreground">
            Configure o valor do serviço para cada contrato. Valores automáticos são calculados 
            com base nas últimas 1000 execuções.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={recalcularTodos}
          disabled={calculando !== null}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Recalcular Todos
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contrato</TableHead>
              <TableHead className="text-center w-32">Modo</TableHead>
              <TableHead className="text-center w-40">Valor (R$)</TableHead>
              <TableHead className="text-center w-24">Amostras</TableHead>
              <TableHead className="text-center w-40">Última Atualização</TableHead>
              <TableHead className="text-right w-32">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {valores.map((valor) => (
              <TableRow key={valor.contrato_id} className="group">
                <TableCell>
                  <div>
                    <span className="font-medium">{valor.contrato_codigo}</span>
                    <p className="text-sm text-muted-foreground">{valor.contrato_nome}</p>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Switch
                      checked={valor.valor_automatico}
                      onCheckedChange={() => alternarModo(valor.contrato_id)}
                      disabled={calculando === valor.contrato_id || saving === valor.contrato_id}
                    />
                    <Badge 
                      variant={valor.valor_automatico ? "default" : "outline"}
                      className={valor.valor_automatico ? "bg-blue-100 text-blue-700" : ""}
                    >
                      {valor.valor_automatico ? (
                        <><Calculator className="h-3 w-3 mr-1" />Auto</>
                      ) : (
                        <><Lock className="h-3 w-3 mr-1" />Manual</>
                      )}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {valor.valor_automatico ? (
                    <div className="flex items-center justify-center">
                      <span className="font-mono font-medium text-green-600">
                        {formatCurrency(valor.valor)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={valor.valor}
                        onChange={(e) => atualizarValorManual(valor.contrato_id, e.target.value)}
                        className="w-28 text-right font-mono"
                        onBlur={() => salvarValorManual(valor.contrato_id)}
                        disabled={saving === valor.contrato_id}
                      />
                    </div>
                  )}
                  {valor.valor_calculado && valor.valor_calculado !== valor.valor && (
                    <div className="text-xs text-orange-600 mt-1">
                      Sugestão: {formatCurrency(valor.valor_calculado)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {valor.qtd_amostras > 0 ? (
                    <Badge variant="secondary" className="font-mono">
                      <History className="h-3 w-3 mr-1" />
                      {valor.qtd_amostras}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {valor.ultima_atualizacao ? (
                    format(new Date(valor.ultima_atualizacao), "dd/MM/yy HH:mm", { locale: ptBR })
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => calcularEAplicar(valor.contrato_id)}
                    disabled={calculando === valor.contrato_id || saving === valor.contrato_id}
                    title="Calcular valor médio"
                  >
                    {calculando === valor.contrato_id || saving === valor.contrato_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-sm">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 text-blue-500" />
          <div className="space-y-1">
            <p className="font-medium">Como funciona o cálculo automático:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Busca as últimas 1000 execuções deste tipo de serviço para cada contrato</li>
              <li>Calcula a média dos valores registrados na produção</li>
              <li>Valores em modo <strong>Auto</strong> são atualizados automaticamente</li>
              <li>Valores em modo <strong>Manual</strong> são preservados até você alterá-los</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

