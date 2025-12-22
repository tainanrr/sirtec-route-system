import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RelatoriosMateriais() {
  const [periodo, setPeriodo] = useState("30");
  const [mesReferencia, setMesReferencia] = useState(() => format(new Date(), "yyyy-MM"));

  // Query para resumo geral
  const { data: resumoGeral, isLoading: loadingResumo } = useQuery({
    queryKey: ["relatorio-resumo", periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(periodo));

      // Total de itens em estoque
      const { data: estoque } = await supabase
        .from("materiais_estoque")
        .select("quantidade, materiais(valor_unitario)")
        .eq("local_tipo", "central");

      const totalItens = estoque?.reduce((acc: number, item: any) => acc + item.quantidade, 0) || 0;
      const valorEstoque = estoque?.reduce((acc: number, item: any) => {
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
        .select("quantidade, materiais!inner(estoque_minimo)")
        .eq("local_tipo", "central");

      const itensBaixos = estoqueBaixo?.filter((item: any) => 
        item.quantidade <= (item.materiais?.estoque_minimo || 0)
      ).length || 0;

      // Medidores em estoque
      const { count: medidores } = await supabase
        .from("materiais_serializados")
        .select("*", { count: "exact", head: true })
        .eq("status", "em_estoque");

      return {
        totalItens,
        valorEstoque,
        entradas,
        saidas,
        itensBaixos,
        medidores: medidores || 0,
      };
    },
  });

  // Query para materiais mais movimentados
  const { data: maisMovimentados, isLoading: loadingMovimentados } = useQuery({
    queryKey: ["relatorio-mais-movimentados", periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(periodo));

      const { data, error } = await supabase
        .from("materiais_movimentacoes")
        .select(`
          material_id,
          tipo,
          quantidade,
          materiais (codigo, nome, unidade)
        `)
        .gte("created_at", dataInicio.toISOString());

      if (error) throw error;

      // Agrupar por material
      const agrupado: Record<string, { material: any; entradas: number; saidas: number; total: number }> = {};

      data?.forEach((mov: any) => {
        if (!agrupado[mov.material_id]) {
          agrupado[mov.material_id] = {
            material: mov.materiais,
            entradas: 0,
            saidas: 0,
            total: 0,
          };
        }

        if (mov.tipo === "entrada") {
          agrupado[mov.material_id].entradas += mov.quantidade;
        } else if (mov.tipo === "saida") {
          agrupado[mov.material_id].saidas += mov.quantidade;
        }
        agrupado[mov.material_id].total += mov.quantidade;
      });

      // Ordenar por total de movimentações
      return Object.values(agrupado)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
  });

  // Query para estoque por equipe
  const { data: estoquePorEquipe, isLoading: loadingEquipes } = useQuery({
    queryKey: ["relatorio-estoque-equipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_estoque")
        .select(`
          quantidade,
          local_id,
          materiais (valor_unitario),
          tecnicos:local_id (codigo, nome)
        `)
        .eq("local_tipo", "equipe");

      if (error) throw error;

      // Agrupar por equipe
      const agrupado: Record<string, { equipe: any; itens: number; valor: number }> = {};

      data?.forEach((item: any) => {
        const equipeId = item.local_id;
        if (!equipeId) return;

        if (!agrupado[equipeId]) {
          agrupado[equipeId] = {
            equipe: item.tecnicos,
            itens: 0,
            valor: 0,
          };
        }

        agrupado[equipeId].itens += item.quantidade;
        agrupado[equipeId].valor += item.quantidade * (item.materiais?.valor_unitario || 0);
      });

      return Object.values(agrupado).sort((a, b) => b.valor - a.valor);
    },
  });

  // Query para aplicações em OS
  const { data: aplicacoesOS, isLoading: loadingAplicacoes } = useQuery({
    queryKey: ["relatorio-aplicacoes-os", periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(periodo));

      const { data, error } = await supabase
        .from("materiais_aplicados_os")
        .select(`
          tipo,
          quantidade,
          created_at,
          materiais (codigo, nome, unidade, valor_unitario)
        `)
        .gte("created_at", dataInicio.toISOString());

      if (error) throw error;

      const aplicados = data?.filter((m: any) => m.tipo === "aplicado") || [];
      const retirados = data?.filter((m: any) => m.tipo === "retirado") || [];

      const totalAplicado = aplicados.reduce((acc: number, m: any) => acc + m.quantidade, 0);
      const totalRetirado = retirados.reduce((acc: number, m: any) => acc + m.quantidade, 0);
      const valorAplicado = aplicados.reduce((acc: number, m: any) => {
        return acc + (m.quantidade * (m.materiais?.valor_unitario || 0));
      }, 0);

      return {
        totalAplicado,
        totalRetirado,
        valorAplicado,
        quantidadeOS: new Set(data?.map((m: any) => m.ordem_servico_id)).size,
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <MainLayout title="Relatórios de Materiais">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link to="/materiais">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-slate-600" />
                Relatórios de Materiais
              </h1>
              <p className="text-muted-foreground text-sm">
                Análises e indicadores do estoque
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
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* KPIs Principais */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Itens em Estoque</p>
                  {loadingResumo ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-xl font-bold">{resumoGeral?.totalItens.toLocaleString()}</p>
                  )}
                </div>
                <Package className="h-6 w-6 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <CardContent className="pt-4">
              <div>
                <p className="text-xs text-emerald-100">Valor em Estoque</p>
                {loadingResumo ? (
                  <Skeleton className="h-7 w-24 mt-1 bg-white/20" />
                ) : (
                  <p className="text-xl font-bold">{formatCurrency(resumoGeral?.valorEstoque || 0)}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Entradas</p>
                  {loadingResumo ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-green-600">+{resumoGeral?.entradas.toLocaleString()}</p>
                  )}
                </div>
                <TrendingUp className="h-6 w-6 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Saídas</p>
                  {loadingResumo ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-red-600">-{resumoGeral?.saidas.toLocaleString()}</p>
                  )}
                </div>
                <TrendingDown className="h-6 w-6 text-red-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Estoque Baixo</p>
                  {loadingResumo ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-amber-600">{resumoGeral?.itensBaixos}</p>
                  )}
                </div>
                <AlertTriangle className="h-6 w-6 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Medidores</p>
                  {loadingResumo ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-cyan-600">{resumoGeral?.medidores}</p>
                  )}
                </div>
                <Zap className="h-6 w-6 text-cyan-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Relatórios */}
        <Tabs defaultValue="movimentados" className="space-y-4">
          <TabsList>
            <TabsTrigger value="movimentados">Mais Movimentados</TabsTrigger>
            <TabsTrigger value="equipes">Por Equipe</TabsTrigger>
            <TabsTrigger value="aplicacoes">Aplicações em OS</TabsTrigger>
          </TabsList>

          <TabsContent value="movimentados">
            <Card>
              <CardHeader>
                <CardTitle>Materiais Mais Movimentados</CardTitle>
                <CardDescription>
                  Top 10 materiais com maior volume de movimentação no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMovimentados ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : maisMovimentados && maisMovimentados.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-center">Entradas</TableHead>
                        <TableHead className="text-center">Saídas</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maisMovimentados.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.material.codigo}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.material.nome}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-700 border-0">
                              +{item.entradas}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-100 text-red-700 border-0">
                              -{item.saidas}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {item.total} {item.material.unidade}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma movimentação no período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipes">
            <Card>
              <CardHeader>
                <CardTitle>Estoque por Equipe</CardTitle>
                <CardDescription>
                  Distribuição de materiais entre as equipes de campo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEquipes ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : estoquePorEquipe && estoquePorEquipe.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipe</TableHead>
                        <TableHead className="text-center">Itens</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estoquePorEquipe.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-pink-100 rounded-full">
                                <Users className="h-4 w-4 text-pink-600" />
                              </div>
                              <div>
                                <p className="font-medium">{item.equipe?.codigo || "N/A"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.equipe?.nome || "Equipe não identificada"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{item.itens}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.valor)}
                          </TableCell>
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

          <TabsContent value="aplicacoes">
            <Card>
              <CardHeader>
                <CardTitle>Aplicações em Ordens de Serviço</CardTitle>
                <CardDescription>
                  Resumo de materiais aplicados e retirados em OS no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAplicacoes ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : aplicacoesOS ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <p className="text-sm text-green-700">Materiais Aplicados</p>
                          <p className="text-3xl font-bold text-green-600">
                            {aplicacoesOS.totalAplicado}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <p className="text-sm text-orange-700">Materiais Retirados</p>
                          <p className="text-3xl font-bold text-orange-600">
                            {aplicacoesOS.totalRetirado}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <p className="text-sm text-blue-700">Valor Aplicado</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(aplicacoesOS.valorAplicado)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <p className="text-sm text-purple-700">OSs Atendidas</p>
                          <p className="text-3xl font-bold text-purple-600">
                            {aplicacoesOS.quantidadeOS}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma aplicação no período</p>
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





