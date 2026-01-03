import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Users,
  Zap,
  Calendar,
  FileText,
  PieChart,
  Boxes,
  Warehouse,
  ArrowLeftRight,
  PackageCheck,
  Undo2,
  Truck,
  ScanLine,
  Wrench,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export default function RelatoriosMateriais() {
  const [periodo, setPeriodo] = useState("30");
  const [tabAtiva, setTabAtiva] = useState("resumo");

  // ========================================
  // QUERY: Resumo Geral do Estoque
  // ========================================
  const { data: resumoGeral, isLoading: loadingResumo } = useQuery({
    queryKey: ["relatorio-resumo", periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(periodo));

      // Total de itens em estoque central
      const { data: estoqueCentral } = await supabase
        .from("materiais_estoque")
        .select("quantidade, materiais(valor_unitario, codigo, nome)")
        .eq("local_tipo", "central");

      const totalItensCentral = estoqueCentral?.reduce((acc: number, item: any) => acc + item.quantidade, 0) || 0;
      const valorEstoqueCentral = estoqueCentral?.reduce((acc: number, item: any) => {
        return acc + (item.quantidade * (item.materiais?.valor_unitario || 0));
      }, 0) || 0;

      // Total em estoque das equipes
      const { data: estoqueEquipes } = await supabase
        .from("materiais_estoque")
        .select("quantidade, materiais(valor_unitario)")
        .eq("local_tipo", "equipe");

      const totalItensEquipes = estoqueEquipes?.reduce((acc: number, item: any) => acc + item.quantidade, 0) || 0;
      const valorEstoqueEquipes = estoqueEquipes?.reduce((acc: number, item: any) => {
        return acc + (item.quantidade * (item.materiais?.valor_unitario || 0));
      }, 0) || 0;

      // Movimentações do período
      const { data: movimentacoes } = await supabase
        .from("materiais_movimentacoes")
        .select("tipo, quantidade")
        .gte("created_at", dataInicio.toISOString());

      const entradas = movimentacoes?.filter((m: any) => m.tipo === "entrada").reduce((acc, m) => acc + m.quantidade, 0) || 0;
      const saidas = movimentacoes?.filter((m: any) => m.tipo === "saida").reduce((acc, m) => acc + m.quantidade, 0) || 0;

      // Itens com estoque baixo
      const { data: estoqueBaixo } = await supabase
        .from("materiais_estoque")
        .select("quantidade, materiais!inner(estoque_minimo, codigo, nome)")
        .eq("local_tipo", "central");

      const itensCriticos = estoqueBaixo?.filter((item: any) => 
        item.quantidade <= (item.materiais?.estoque_minimo || 0) && item.materiais?.estoque_minimo > 0
      ) || [];

      // Medidores em estoque por status
      const { data: medidores } = await supabase
        .from("materiais_serializados")
        .select("status");

      const medidoresEmEstoque = medidores?.filter((m: any) => m.status === "em_estoque").length || 0;
      const medidoresEmUso = medidores?.filter((m: any) => m.status === "em_uso").length || 0;
      const medidoresInstalados = medidores?.filter((m: any) => m.status === "instalado").length || 0;

      // Recebimentos do período
      const { data: recebimentos } = await supabase
        .from("materiais_recebimentos")
        .select("id, status")
        .gte("created_at", dataInicio.toISOString());

      const recebimentosPendentes = recebimentos?.filter((r: any) => r.status === "pendente").length || 0;
      const recebimentosConferidos = recebimentos?.filter((r: any) => r.status === "conferido").length || 0;

      // Devoluções do período
      const { data: devolucoes } = await supabase
        .from("materiais_devolucoes")
        .select("id, status")
        .gte("created_at", dataInicio.toISOString());

      const devolucoesPendentes = devolucoes?.filter((d: any) => d.status === "pendente").length || 0;
      const devolucoesProcessadas = devolucoes?.filter((d: any) => d.status === "processado").length || 0;

      // Aplicações em OS no período
      const { data: aplicacoes } = await supabase
        .from("materiais_aplicados_os")
        .select("tipo, quantidade, materiais(valor_unitario)")
        .gte("created_at", dataInicio.toISOString());

      const totalAplicado = aplicacoes?.filter((a: any) => a.tipo === "aplicado").reduce((acc, a) => acc + a.quantidade, 0) || 0;
      const totalRetirado = aplicacoes?.filter((a: any) => a.tipo === "retirado").reduce((acc, a) => acc + a.quantidade, 0) || 0;
      const valorAplicado = aplicacoes?.filter((a: any) => a.tipo === "aplicado").reduce((acc: number, a: any) => {
        return acc + (a.quantidade * (a.materiais?.valor_unitario || 0));
      }, 0) || 0;

      return {
        totalItensCentral,
        valorEstoqueCentral,
        totalItensEquipes,
        valorEstoqueEquipes,
        entradas,
        saidas,
        itensCriticos,
        medidoresEmEstoque,
        medidoresEmUso,
        medidoresInstalados,
        recebimentosPendentes,
        recebimentosConferidos,
        devolucoesPendentes,
        devolucoesProcessadas,
        totalAplicado,
        totalRetirado,
        valorAplicado,
      };
    },
  });

  // ========================================
  // QUERY: Curva ABC de Materiais
  // ========================================
  const { data: curvaABC, isLoading: loadingCurvaABC } = useQuery({
    queryKey: ["relatorio-curva-abc"],
    queryFn: async () => {
      const { data: estoque } = await supabase
        .from("materiais_estoque")
        .select("quantidade, materiais(id, codigo, nome, valor_unitario, categoria)")
        .eq("local_tipo", "central");

      if (!estoque || estoque.length === 0) return { itensA: [], itensB: [], itensC: [], totais: { A: 0, B: 0, C: 0 } };

      // Calcular valor total de cada item
      const itensComValor = estoque
        .map((item: any) => ({
          material: item.materiais,
          quantidade: item.quantidade,
          valorTotal: item.quantidade * (item.materiais?.valor_unitario || 0),
        }))
        .filter((item: any) => item.valorTotal > 0)
        .sort((a: any, b: any) => b.valorTotal - a.valorTotal);

      const valorTotalEstoque = itensComValor.reduce((acc: number, item: any) => acc + item.valorTotal, 0);

      // Classificar em A, B, C
      let acumulado = 0;
      const classificados = itensComValor.map((item: any) => {
        acumulado += item.valorTotal;
        const percentual = (acumulado / valorTotalEstoque) * 100;
        let classificacao = "C";
        if (percentual <= 80) classificacao = "A";
        else if (percentual <= 95) classificacao = "B";
        return { ...item, classificacao, percentualAcumulado: percentual };
      });

      return {
        itensA: classificados.filter((i: any) => i.classificacao === "A").slice(0, 10),
        itensB: classificados.filter((i: any) => i.classificacao === "B").slice(0, 10),
        itensC: classificados.filter((i: any) => i.classificacao === "C").slice(0, 10),
        totais: {
          A: classificados.filter((i: any) => i.classificacao === "A").length,
          B: classificados.filter((i: any) => i.classificacao === "B").length,
          C: classificados.filter((i: any) => i.classificacao === "C").length,
        },
        valorTotal: valorTotalEstoque,
      };
    },
  });

  // ========================================
  // QUERY: Giro de Estoque
  // ========================================
  const { data: giroEstoque, isLoading: loadingGiro } = useQuery({
    queryKey: ["relatorio-giro-estoque", periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(periodo));
      const diasPeriodo = parseInt(periodo);

      // Buscar estoque atual e movimentações de saída
      const { data: estoque } = await supabase
        .from("materiais_estoque")
        .select("quantidade, material_id, materiais(id, codigo, nome, categoria)")
        .eq("local_tipo", "central");

      const { data: saidas } = await supabase
        .from("materiais_movimentacoes")
        .select("material_id, quantidade")
        .eq("tipo", "saida")
        .gte("created_at", dataInicio.toISOString());

      // Calcular giro por material
      const giroMap: Record<string, any> = {};

      estoque?.forEach((item: any) => {
        if (!giroMap[item.material_id]) {
          giroMap[item.material_id] = {
            material: item.materiais,
            estoqueAtual: item.quantidade,
            saidas: 0,
          };
        } else {
          giroMap[item.material_id].estoqueAtual += item.quantidade;
        }
      });

      saidas?.forEach((mov: any) => {
        if (giroMap[mov.material_id]) {
          giroMap[mov.material_id].saidas += mov.quantidade;
        }
      });

      // Calcular giro (saídas / estoque médio estimado)
      const itensComGiro = Object.values(giroMap)
        .map((item: any) => {
          const estoqueMedio = item.estoqueAtual + (item.saidas / 2); // Estimativa simples
          const giro = estoqueMedio > 0 ? (item.saidas / estoqueMedio) * (365 / diasPeriodo) : 0;
          const diasCobertura = item.saidas > 0 ? (item.estoqueAtual / (item.saidas / diasPeriodo)) : 999;
          return {
            ...item,
            giro: giro.toFixed(2),
            diasCobertura: Math.min(diasCobertura, 999).toFixed(0),
          };
        })
        .filter((item: any) => item.estoqueAtual > 0 || item.saidas > 0)
        .sort((a: any, b: any) => parseFloat(b.giro) - parseFloat(a.giro));

      const altaRotatividade = itensComGiro.filter((i: any) => parseFloat(i.giro) >= 4);
      const mediaRotatividade = itensComGiro.filter((i: any) => parseFloat(i.giro) >= 1 && parseFloat(i.giro) < 4);
      const baixaRotatividade = itensComGiro.filter((i: any) => parseFloat(i.giro) < 1);

      return {
        top10: itensComGiro.slice(0, 10),
        altaRotatividade: altaRotatividade.length,
        mediaRotatividade: mediaRotatividade.length,
        baixaRotatividade: baixaRotatividade.length,
        semMovimento: itensComGiro.filter((i: any) => parseFloat(i.giro) === 0).length,
      };
    },
  });

  // ========================================
  // QUERY: Materiais Mais Aplicados em OS
  // ========================================
  const { data: materiaisAplicados, isLoading: loadingAplicados } = useQuery({
    queryKey: ["relatorio-materiais-aplicados", periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(periodo));

      const { data } = await supabase
        .from("materiais_aplicados_os")
        .select(`
          material_id,
          tipo,
          quantidade,
          materiais(codigo, nome, unidade, valor_unitario, categoria),
          ordens_servico:ordem_servico_id(tipo)
        `)
        .eq("tipo", "aplicado")
        .gte("created_at", dataInicio.toISOString());

      // Agrupar por material
      const agrupado: Record<string, any> = {};
      data?.forEach((item: any) => {
        if (!agrupado[item.material_id]) {
          agrupado[item.material_id] = {
            material: item.materiais,
            quantidade: 0,
            valor: 0,
            tiposOS: new Set(),
          };
        }
        agrupado[item.material_id].quantidade += item.quantidade;
        agrupado[item.material_id].valor += item.quantidade * (item.materiais?.valor_unitario || 0);
        if (item.ordens_servico?.tipo) {
          agrupado[item.material_id].tiposOS.add(item.ordens_servico.tipo);
        }
      });

      return Object.values(agrupado)
        .map((item: any) => ({
          ...item,
          tiposOS: Array.from(item.tiposOS).slice(0, 3),
        }))
        .sort((a: any, b: any) => b.quantidade - a.quantidade)
        .slice(0, 15);
    },
  });

  // ========================================
  // QUERY: Estoque por Equipe
  // ========================================
  const { data: estoquePorEquipe, isLoading: loadingEquipes } = useQuery({
    queryKey: ["relatorio-estoque-equipes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("materiais_estoque")
        .select(`
          quantidade,
          local_id,
          materiais(valor_unitario, categoria),
          tecnicos:local_id(id, codigo, nome)
        `)
        .eq("local_tipo", "equipe");

      // Agrupar por equipe
      const agrupado: Record<string, any> = {};
      data?.forEach((item: any) => {
        const equipeId = item.local_id;
        if (!equipeId) return;

        if (!agrupado[equipeId]) {
          agrupado[equipeId] = {
            equipe: item.tecnicos,
            itens: 0,
            valor: 0,
            categorias: new Set(),
          };
        }
        agrupado[equipeId].itens += item.quantidade;
        agrupado[equipeId].valor += item.quantidade * (item.materiais?.valor_unitario || 0);
        if (item.materiais?.categoria) {
          agrupado[equipeId].categorias.add(item.materiais.categoria);
        }
      });

      return Object.values(agrupado)
        .map((item: any) => ({
          ...item,
          categorias: Array.from(item.categorias).length,
        }))
        .sort((a: any, b: any) => b.valor - a.valor);
    },
  });

  // ========================================
  // QUERY: Análise de Devoluções
  // ========================================
  const { data: analiseDevolucoes, isLoading: loadingDevolucoes } = useQuery({
    queryKey: ["relatorio-devolucoes", periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(periodo));

      const { data: devolucoes } = await supabase
        .from("materiais_devolucoes")
        .select(`
          id,
          status,
          observacao,
          created_at,
          tecnicos:tecnico_id(codigo, nome),
          materiais_devolucoes_itens(quantidade, materiais(valor_unitario))
        `)
        .gte("created_at", dataInicio.toISOString());

      const total = devolucoes?.length || 0;
      const pendentes = devolucoes?.filter((d: any) => d.status === "pendente").length || 0;
      const processadas = devolucoes?.filter((d: any) => d.status === "processado").length || 0;

      // Calcular valor total devolvido
      let valorTotal = 0;
      let itensTotal = 0;
      devolucoes?.forEach((dev: any) => {
        dev.materiais_devolucoes_itens?.forEach((item: any) => {
          valorTotal += item.quantidade * (item.materiais?.valor_unitario || 0);
          itensTotal += item.quantidade;
        });
      });

      // Top técnicos com devoluções
      const porTecnico: Record<string, any> = {};
      devolucoes?.forEach((dev: any) => {
        const tecId = dev.tecnicos?.codigo || "N/A";
        if (!porTecnico[tecId]) {
          porTecnico[tecId] = { tecnico: dev.tecnicos, count: 0 };
        }
        porTecnico[tecId].count++;
      });

      return {
        total,
        pendentes,
        processadas,
        valorTotal,
        itensTotal,
        porTecnico: Object.values(porTecnico).sort((a: any, b: any) => b.count - a.count).slice(0, 5),
      };
    },
  });

  // ========================================
  // QUERY: Análise de Recebimentos
  // ========================================
  const { data: analiseRecebimentos, isLoading: loadingRecebimentos } = useQuery({
    queryKey: ["relatorio-recebimentos", periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(periodo));

      const { data: recebimentos } = await supabase
        .from("materiais_recebimentos")
        .select(`
          id,
          numero_nota,
          status,
          created_at,
          data_conferencia,
          materiais_recebimentos_itens(quantidade, quantidade_conferida, materiais(valor_unitario))
        `)
        .gte("created_at", dataInicio.toISOString())
        .order("created_at", { ascending: false });

      const total = recebimentos?.length || 0;
      const pendentes = recebimentos?.filter((r: any) => r.status === "pendente").length || 0;
      const conferidos = recebimentos?.filter((r: any) => r.status === "conferido").length || 0;

      // Calcular estatísticas
      let valorTotalRecebido = 0;
      let itensTotal = 0;
      let itensDivergentes = 0;

      recebimentos?.forEach((rec: any) => {
        rec.materiais_recebimentos_itens?.forEach((item: any) => {
          valorTotalRecebido += (item.quantidade_conferida || item.quantidade) * (item.materiais?.valor_unitario || 0);
          itensTotal += item.quantidade;
          if (item.quantidade_conferida !== null && item.quantidade_conferida !== item.quantidade) {
            itensDivergentes++;
          }
        });
      });

      // Tempo médio de conferência
      const conferidosComData = recebimentos?.filter((r: any) => r.status === "conferido" && r.data_conferencia) || [];
      let tempoMedioConferencia = 0;
      if (conferidosComData.length > 0) {
        const somaTempos = conferidosComData.reduce((acc: number, r: any) => {
          return acc + differenceInDays(new Date(r.data_conferencia), new Date(r.created_at));
        }, 0);
        tempoMedioConferencia = somaTempos / conferidosComData.length;
      }

      return {
        total,
        pendentes,
        conferidos,
        valorTotalRecebido,
        itensTotal,
        itensDivergentes,
        tempoMedioConferencia: tempoMedioConferencia.toFixed(1),
        ultimos: recebimentos?.slice(0, 5) || [],
      };
    },
  });

  // ========================================
  // QUERY: Análise de Medidores/Serializados
  // ========================================
  const { data: analiseMedidores, isLoading: loadingMedidores } = useQuery({
    queryKey: ["relatorio-medidores"],
    queryFn: async () => {
      const { data: serializados } = await supabase
        .from("materiais_serializados")
        .select(`
          id,
          numero_serie,
          status,
          materiais(codigo, nome, categoria)
        `);

      const total = serializados?.length || 0;
      const emEstoque = serializados?.filter((s: any) => s.status === "em_estoque").length || 0;
      const emUso = serializados?.filter((s: any) => s.status === "em_uso").length || 0;
      const instalados = serializados?.filter((s: any) => s.status === "instalado").length || 0;
      const defeito = serializados?.filter((s: any) => s.status === "defeito").length || 0;

      // Por tipo de material
      const porTipo: Record<string, number> = {};
      serializados?.forEach((s: any) => {
        const tipo = s.materiais?.categoria || "Outros";
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
      });

      return {
        total,
        emEstoque,
        emUso,
        instalados,
        defeito,
        porTipo: Object.entries(porTipo).map(([tipo, count]) => ({ tipo, count })).sort((a, b) => b.count - a.count),
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Função de exportação para Excel
  const exportarRelatorio = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Aba Resumo
      if (resumoGeral) {
        const resumoData = [
          ["Relatório de Materiais - Resumo Geral"],
          ["Período:", `Últimos ${periodo} dias`],
          ["Data de Geração:", format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })],
          [],
          ["ESTOQUE"],
          ["Itens no Central", resumoGeral.totalItensCentral],
          ["Valor no Central", resumoGeral.valorEstoqueCentral],
          ["Itens nas Equipes", resumoGeral.totalItensEquipes],
          ["Valor nas Equipes", resumoGeral.valorEstoqueEquipes],
          [],
          ["MOVIMENTAÇÕES"],
          ["Entradas", resumoGeral.entradas],
          ["Saídas", resumoGeral.saidas],
          [],
          ["APLICAÇÕES EM OS"],
          ["Materiais Aplicados", resumoGeral.totalAplicado],
          ["Materiais Retirados", resumoGeral.totalRetirado],
          ["Valor Aplicado", resumoGeral.valorAplicado],
        ];
        const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
        XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
      }

      // Aba Curva ABC
      if (curvaABC?.itensA) {
        const abcData = [
          ["Curva ABC de Materiais"],
          [],
          ["Classificação A (80% do valor)"],
          ["Código", "Material", "Quantidade", "Valor Total"],
          ...curvaABC.itensA.map((i: any) => [
            i.material?.codigo,
            i.material?.nome,
            i.quantidade,
            i.valorTotal,
          ]),
        ];
        const wsABC = XLSX.utils.aoa_to_sheet(abcData);
        XLSX.utils.book_append_sheet(wb, wsABC, "Curva ABC");
      }

      // Aba Giro de Estoque
      if (giroEstoque?.top10) {
        const giroData = [
          ["Giro de Estoque - Top 10"],
          [],
          ["Código", "Material", "Estoque Atual", "Saídas", "Giro Anual", "Dias Cobertura"],
          ...giroEstoque.top10.map((i: any) => [
            i.material?.codigo,
            i.material?.nome,
            i.estoqueAtual,
            i.saidas,
            i.giro,
            i.diasCobertura,
          ]),
        ];
        const wsGiro = XLSX.utils.aoa_to_sheet(giroData);
        XLSX.utils.book_append_sheet(wb, wsGiro, "Giro Estoque");
      }

      // Aba Materiais Aplicados
      if (materiaisAplicados) {
        const aplicadosData = [
          ["Materiais Mais Aplicados em OS"],
          [],
          ["Código", "Material", "Quantidade", "Valor Total", "Tipos de OS"],
          ...materiaisAplicados.map((i: any) => [
            i.material?.codigo,
            i.material?.nome,
            i.quantidade,
            i.valor,
            i.tiposOS.join(", "),
          ]),
        ];
        const wsAplicados = XLSX.utils.aoa_to_sheet(aplicadosData);
        XLSX.utils.book_append_sheet(wb, wsAplicados, "Aplicações OS");
      }

      // Aba Estoque por Equipe
      if (estoquePorEquipe) {
        const equipesData = [
          ["Estoque por Equipe"],
          [],
          ["Código", "Equipe", "Itens", "Valor", "Categorias"],
          ...estoquePorEquipe.map((i: any) => [
            i.equipe?.codigo,
            i.equipe?.nome,
            i.itens,
            i.valor,
            i.categorias,
          ]),
        ];
        const wsEquipes = XLSX.utils.aoa_to_sheet(equipesData);
        XLSX.utils.book_append_sheet(wb, wsEquipes, "Estoque Equipes");
      }

      XLSX.writeFile(wb, `relatorio_materiais_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar relatório");
    }
  };

  return (
    <MainLayout title="Relatórios de Materiais">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link to="/materiais">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                Relatórios de Materiais
              </h1>
              <p className="text-muted-foreground text-sm">
                Análises gerenciais e indicadores de desempenho
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportarRelatorio} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* KPIs Principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground">Estoque Central</p>
                {loadingResumo ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className="text-lg font-bold">{resumoGeral?.totalItensCentral.toLocaleString()}</p>
                )}
                <p className="text-[10px] text-muted-foreground">itens</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col">
                <p className="text-xs text-emerald-100">Valor Total</p>
                {loadingResumo ? (
                  <Skeleton className="h-6 w-20 mt-1 bg-white/20" />
                ) : (
                  <p className="text-lg font-bold">{formatCurrency((resumoGeral?.valorEstoqueCentral || 0) + (resumoGeral?.valorEstoqueEquipes || 0))}</p>
                )}
                <p className="text-[10px] text-emerald-100">central + equipes</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground">Entradas</p>
                {loadingResumo ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className="text-lg font-bold text-green-600">+{resumoGeral?.entradas.toLocaleString()}</p>
                )}
                <p className="text-[10px] text-muted-foreground">no período</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground">Saídas</p>
                {loadingResumo ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className="text-lg font-bold text-red-600">-{resumoGeral?.saidas.toLocaleString()}</p>
                )}
                <p className="text-[10px] text-muted-foreground">no período</p>
              </div>
            </CardContent>
          </Card>

          <Card className={resumoGeral?.itensCriticos?.length > 0 ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : ""}>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground">Estoque Crítico</p>
                {loadingResumo ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className={`text-lg font-bold ${resumoGeral?.itensCriticos?.length > 0 ? 'text-amber-600' : ''}`}>
                    {resumoGeral?.itensCriticos?.length || 0}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">itens abaixo mínimo</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground">Medidores</p>
                {loadingResumo ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className="text-lg font-bold text-cyan-600">{resumoGeral?.medidoresEmEstoque}</p>
                )}
                <p className="text-[10px] text-muted-foreground">em estoque</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground">Aplicados OS</p>
                {loadingResumo ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className="text-lg font-bold text-purple-600">{resumoGeral?.totalAplicado.toLocaleString()}</p>
                )}
                <p className="text-[10px] text-muted-foreground">no período</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground">Recebimentos</p>
                {loadingResumo ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className="text-lg font-bold">
                    <span className="text-amber-600">{resumoGeral?.recebimentosPendentes}</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-green-600">{resumoGeral?.recebimentosConferidos}</span>
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">pend. / conf.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Relatórios Detalhados */}
        <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="resumo" className="gap-1.5">
              <PieChart className="h-3.5 w-3.5" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="curva-abc" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Curva ABC
            </TabsTrigger>
            <TabsTrigger value="giro" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Giro Estoque
            </TabsTrigger>
            <TabsTrigger value="aplicacoes" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              Aplicações OS
            </TabsTrigger>
            <TabsTrigger value="equipes" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Por Equipe
            </TabsTrigger>
            <TabsTrigger value="recebimentos" className="gap-1.5">
              <PackageCheck className="h-3.5 w-3.5" />
              Recebimentos
            </TabsTrigger>
            <TabsTrigger value="devolucoes" className="gap-1.5">
              <Undo2 className="h-3.5 w-3.5" />
              Devoluções
            </TabsTrigger>
            <TabsTrigger value="medidores" className="gap-1.5">
              <ScanLine className="h-3.5 w-3.5" />
              Medidores
            </TabsTrigger>
          </TabsList>

          {/* Tab: Resumo / Itens Críticos */}
          <TabsContent value="resumo" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Itens com Estoque Crítico */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Itens com Estoque Crítico
                  </CardTitle>
                  <CardDescription>
                    Materiais abaixo do estoque mínimo configurado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingResumo ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : resumoGeral?.itensCriticos && resumoGeral.itensCriticos.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {resumoGeral.itensCriticos.slice(0, 10).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                          <div>
                            <p className="font-medium text-sm">{item.materiais?.codigo}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.materiais?.nome}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="destructive" className="text-xs">
                              {item.quantidade} / {item.materiais?.estoque_minimo}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>Nenhum item com estoque crítico</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Distribuição de Medidores */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4 text-cyan-500" />
                    Distribuição de Medidores
                  </CardTitle>
                  <CardDescription>
                    Status atual dos itens serializados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingMedidores ? (
                    <Skeleton className="h-[200px] w-full" />
                  ) : analiseMedidores ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-600">{analiseMedidores.emEstoque}</p>
                          <p className="text-xs text-muted-foreground">Em Estoque</p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-amber-600">{analiseMedidores.emUso}</p>
                          <p className="text-xs text-muted-foreground">Em Uso</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600">{analiseMedidores.instalados}</p>
                          <p className="text-xs text-muted-foreground">Instalados</p>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-red-600">{analiseMedidores.defeito}</p>
                          <p className="text-xs text-muted-foreground">Com Defeito</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Total: {analiseMedidores.total} itens serializados</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ScanLine className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Nenhum item serializado cadastrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Curva ABC */}
          <TabsContent value="curva-abc">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Curva ABC de Materiais
                </CardTitle>
                <CardDescription>
                  Classificação por valor em estoque (A=80%, B=15%, C=5%)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCurvaABC ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : curvaABC ? (
                  <div className="space-y-6">
                    {/* Resumo */}
                    <div className="grid grid-cols-4 gap-4">
                      <Card className="bg-red-50 dark:bg-red-950/30 border-red-200">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-red-600">{curvaABC.totais.A}</p>
                          <p className="text-sm text-red-700">Classe A</p>
                          <p className="text-xs text-muted-foreground">80% do valor</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-amber-600">{curvaABC.totais.B}</p>
                          <p className="text-sm text-amber-700">Classe B</p>
                          <p className="text-xs text-muted-foreground">15% do valor</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50 dark:bg-green-950/30 border-green-200">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-green-600">{curvaABC.totais.C}</p>
                          <p className="text-sm text-green-700">Classe C</p>
                          <p className="text-xs text-muted-foreground">5% do valor</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-4 text-center">
                          <p className="text-2xl font-bold">{formatCurrency(curvaABC.valorTotal || 0)}</p>
                          <p className="text-sm text-muted-foreground">Valor Total</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Top 10 Classe A */}
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Badge className="bg-red-500">A</Badge>
                        Top 10 - Classe A (Alto Valor)
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Valor Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {curvaABC.itensA.map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.material?.codigo}</TableCell>
                              <TableCell className="max-w-[250px] truncate">{item.material?.nome}</TableCell>
                              <TableCell className="text-right">{item.quantidade}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(item.valorTotal)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Sem dados para análise ABC</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Giro de Estoque */}
          <TabsContent value="giro">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Análise de Giro de Estoque
                </CardTitle>
                <CardDescription>
                  Rotatividade dos materiais com base nas saídas do período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingGiro ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : giroEstoque ? (
                  <div className="space-y-6">
                    {/* Resumo de Rotatividade */}
                    <div className="grid grid-cols-4 gap-4">
                      <Card className="bg-green-50 dark:bg-green-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-green-600">{giroEstoque.altaRotatividade}</p>
                          <p className="text-sm text-green-700">Alta Rotatividade</p>
                          <p className="text-xs text-muted-foreground">Giro ≥ 4x/ano</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-blue-50 dark:bg-blue-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-blue-600">{giroEstoque.mediaRotatividade}</p>
                          <p className="text-sm text-blue-700">Média Rotatividade</p>
                          <p className="text-xs text-muted-foreground">Giro 1-4x/ano</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-amber-50 dark:bg-amber-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-amber-600">{giroEstoque.baixaRotatividade}</p>
                          <p className="text-sm text-amber-700">Baixa Rotatividade</p>
                          <p className="text-xs text-muted-foreground">Giro &lt; 1x/ano</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-red-50 dark:bg-red-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-red-600">{giroEstoque.semMovimento}</p>
                          <p className="text-sm text-red-700">Sem Movimento</p>
                          <p className="text-xs text-muted-foreground">Nenhuma saída</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Top 10 Maior Giro */}
                    <div>
                      <h4 className="font-semibold mb-2">Top 10 - Maior Rotatividade</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead className="text-right">Estoque</TableHead>
                            <TableHead className="text-right">Saídas</TableHead>
                            <TableHead className="text-right">Giro Anual</TableHead>
                            <TableHead className="text-right">Cobertura</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {giroEstoque.top10.map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.material?.codigo}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{item.material?.nome}</TableCell>
                              <TableCell className="text-right">{item.estoqueAtual}</TableCell>
                              <TableCell className="text-right">{item.saidas}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={parseFloat(item.giro) >= 4 ? "default" : "secondary"}>
                                  {item.giro}x
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={parseInt(item.diasCobertura) < 30 ? "text-red-600 font-medium" : ""}>
                                  {item.diasCobertura} dias
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Sem dados de movimentação</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Aplicações em OS */}
          <TabsContent value="aplicacoes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Materiais Mais Aplicados em OS
                </CardTitle>
                <CardDescription>
                  Top 15 materiais mais utilizados em ordens de serviço no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAplicados ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : materiaisAplicados && materiaisAplicados.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Qtd Aplicada</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead>Tipos de OS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materiaisAplicados.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.material?.codigo}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[250px]">{item.material?.nome}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">{item.quantidade} {item.material?.unidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.valor)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.tiposOS.map((tipo: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{tipo}</Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma aplicação no período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Por Equipe */}
          <TabsContent value="equipes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Estoque por Equipe
                </CardTitle>
                <CardDescription>
                  Distribuição de materiais entre os técnicos de campo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEquipes ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : estoquePorEquipe && estoquePorEquipe.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipe</TableHead>
                        <TableHead className="text-center">Itens</TableHead>
                        <TableHead className="text-center">Categorias</TableHead>
                        <TableHead className="text-right">Valor em Posse</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estoquePorEquipe.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-primary/10 rounded-full">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{item.equipe?.codigo || "N/A"}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {item.equipe?.nome || "Equipe não identificada"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{item.itens}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{item.categorias}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum material distribuído às equipes</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Recebimentos */}
          <TabsContent value="recebimentos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5" />
                  Análise de Recebimentos
                </CardTitle>
                <CardDescription>
                  Estatísticas de recebimentos da concessionária no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRecebimentos ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : analiseRecebimentos ? (
                  <div className="space-y-6">
                    {/* KPIs de Recebimento */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-blue-50 dark:bg-blue-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-blue-600">{analiseRecebimentos.total}</p>
                          <p className="text-sm text-muted-foreground">Total de Recebimentos</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-amber-50 dark:bg-amber-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-amber-600">{analiseRecebimentos.pendentes}</p>
                          <p className="text-sm text-muted-foreground">Pendentes</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50 dark:bg-green-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-green-600">{analiseRecebimentos.conferidos}</p>
                          <p className="text-sm text-muted-foreground">Conferidos</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                        <CardContent className="pt-4 text-center">
                          <p className="text-2xl font-bold">{formatCurrency(analiseRecebimentos.valorTotalRecebido)}</p>
                          <p className="text-sm text-emerald-100">Valor Recebido</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Indicadores */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Itens Recebidos</span>
                        </div>
                        <p className="text-2xl font-bold">{analiseRecebimentos.itensTotal}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-medium">Divergências</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">{analiseRecebimentos.itensDivergentes}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Tempo Médio Conferência</span>
                        </div>
                        <p className="text-2xl font-bold">{analiseRecebimentos.tempoMedioConferencia} dias</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <PackageCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum recebimento no período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Devoluções */}
          <TabsContent value="devolucoes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Undo2 className="h-5 w-5" />
                  Análise de Devoluções
                </CardTitle>
                <CardDescription>
                  Estatísticas de devoluções de materiais das equipes no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDevolucoes ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : analiseDevolucoes ? (
                  <div className="space-y-6">
                    {/* KPIs de Devolução */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-purple-50 dark:bg-purple-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-purple-600">{analiseDevolucoes.total}</p>
                          <p className="text-sm text-muted-foreground">Total de Devoluções</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-amber-50 dark:bg-amber-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-amber-600">{analiseDevolucoes.pendentes}</p>
                          <p className="text-sm text-muted-foreground">Pendentes</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50 dark:bg-green-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-green-600">{analiseDevolucoes.processadas}</p>
                          <p className="text-sm text-muted-foreground">Processadas</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                        <CardContent className="pt-4 text-center">
                          <p className="text-2xl font-bold">{formatCurrency(analiseDevolucoes.valorTotal)}</p>
                          <p className="text-sm text-purple-100">Valor Devolvido</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Top Técnicos com Devoluções */}
                    {analiseDevolucoes.porTecnico.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Técnicos com Mais Devoluções</h4>
                        <div className="space-y-2">
                          {analiseDevolucoes.porTecnico.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-full">
                                  <Users className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{item.tecnico?.codigo || "N/A"}</p>
                                  <p className="text-xs text-muted-foreground">{item.tecnico?.nome}</p>
                                </div>
                              </div>
                              <Badge>{item.count} devoluções</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Undo2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma devolução no período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Medidores */}
          <TabsContent value="medidores">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanLine className="h-5 w-5" />
                  Análise de Medidores e Serializados
                </CardTitle>
                <CardDescription>
                  Distribuição e status dos itens com rastreabilidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMedidores ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : analiseMedidores ? (
                  <div className="space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <Card className="bg-slate-100 dark:bg-slate-800">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold">{analiseMedidores.total}</p>
                          <p className="text-sm text-muted-foreground">Total</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-blue-50 dark:bg-blue-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-blue-600">{analiseMedidores.emEstoque}</p>
                          <p className="text-sm text-muted-foreground">Em Estoque</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-amber-50 dark:bg-amber-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-amber-600">{analiseMedidores.emUso}</p>
                          <p className="text-sm text-muted-foreground">Em Uso</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50 dark:bg-green-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-green-600">{analiseMedidores.instalados}</p>
                          <p className="text-sm text-muted-foreground">Instalados</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-red-50 dark:bg-red-950/30">
                        <CardContent className="pt-4 text-center">
                          <p className="text-3xl font-bold text-red-600">{analiseMedidores.defeito}</p>
                          <p className="text-sm text-muted-foreground">Defeito</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Por Tipo */}
                    {analiseMedidores.porTipo.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Distribuição por Categoria</h4>
                        <div className="space-y-2">
                          {analiseMedidores.porTipo.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium">{item.tipo}</span>
                                  <span className="text-sm text-muted-foreground">{item.count}</span>
                                </div>
                                <Progress value={(item.count / analiseMedidores.total) * 100} className="h-2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ScanLine className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum item serializado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
