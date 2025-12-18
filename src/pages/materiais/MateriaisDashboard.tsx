import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  Warehouse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Truck,
  ClipboardCheck,
  BarChart3,
  History,
  Zap,
  Settings,
  FileText,
  Search,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResumoAlertasRetencao, calcularDiasDesde, getNivelAlerta } from "@/components/materiais/DiasRetencaoBadge";

// Cards de navegação rápida
const quickAccessCards = [
  {
    title: "Catálogo de Materiais",
    description: "Gerenciar itens e categorias",
    icon: Package,
    href: "/materiais/catalogo",
    color: "bg-blue-500",
  },
  {
    title: "Estoque Central",
    description: "Controle de estoque físico",
    icon: Warehouse,
    href: "/materiais/estoque",
    color: "bg-emerald-500",
  },
  {
    title: "Movimentações",
    description: "Histórico de entradas/saídas",
    icon: History,
    href: "/materiais/movimentacoes",
    color: "bg-violet-500",
  },
  {
    title: "Recebimentos",
    description: "Materiais da concessionária",
    icon: Truck,
    href: "/materiais/recebimentos",
    color: "bg-orange-500",
  },
  {
    title: "Entregas às Equipes",
    description: "Distribuição para técnicos",
    icon: Users,
    href: "/materiais/entregas",
    color: "bg-pink-500",
  },
  {
    title: "Rastreabilidade",
    description: "Medidores e itens serializados",
    icon: Search,
    href: "/materiais/rastreabilidade",
    color: "bg-amber-500",
  },
  {
    title: "Aplicações em OS",
    description: "Materiais aplicados/retirados",
    icon: ClipboardCheck,
    href: "/materiais/aplicacoes",
    color: "bg-cyan-500",
  },
  {
    title: "Relatórios",
    description: "Análises e exportações",
    icon: BarChart3,
    href: "/materiais/relatorios",
    color: "bg-slate-500",
  },
];

export default function MateriaisDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Query para estatísticas gerais
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["materiais-stats", refreshKey],
    queryFn: async () => {
      // Buscar totais de materiais
      const { count: totalMateriais } = await supabase
        .from("materiais")
        .select("*", { count: "exact", head: true })
        .eq("ativo", true);

      // Buscar itens em estoque baixo
      const { data: estoqueBaixo } = await supabase
        .from("materiais_estoque")
        .select(`
          quantidade,
          materiais!inner (
            id,
            nome,
            estoque_minimo
          )
        `)
        .eq("local_tipo", "central");

      const itensBaixoEstoque = estoqueBaixo?.filter((item: any) => 
        item.quantidade <= (item.materiais?.estoque_minimo || 0)
      ).length || 0;

      // Buscar movimentações do mês
      const inicioMes = startOfMonth(new Date());
      const fimMes = endOfMonth(new Date());

      const { data: movimentacoesMes } = await supabase
        .from("materiais_movimentacoes")
        .select("tipo, quantidade")
        .gte("created_at", inicioMes.toISOString())
        .lte("created_at", fimMes.toISOString());

      const entradas = movimentacoesMes?.filter(m => m.tipo === "entrada").reduce((acc, m) => acc + m.quantidade, 0) || 0;
      const saidas = movimentacoesMes?.filter(m => m.tipo === "saida").reduce((acc, m) => acc + m.quantidade, 0) || 0;

      // Buscar entregas pendentes de assinatura
      const { count: entregasPendentes } = await supabase
        .from("materiais_entregas")
        .select("*", { count: "exact", head: true })
        .is("assinatura_recebimento", null)
        .eq("status", "pendente");

      // Buscar medidores em estoque
      const { count: medidoresEstoque } = await supabase
        .from("materiais_serializados")
        .select("*", { count: "exact", head: true })
        .eq("status", "em_estoque");

      // Valor total em estoque (estimado)
      const { data: valorEstoque } = await supabase
        .from("materiais_estoque")
        .select(`
          quantidade,
          materiais (valor_unitario)
        `)
        .eq("local_tipo", "central");

      const valorTotal = valorEstoque?.reduce((acc: number, item: any) => {
        return acc + (item.quantidade * (item.materiais?.valor_unitario || 0));
      }, 0) || 0;

      return {
        totalMateriais: totalMateriais || 0,
        itensBaixoEstoque,
        entradas,
        saidas,
        entregasPendentes: entregasPendentes || 0,
        medidoresEstoque: medidoresEstoque || 0,
        valorTotal,
      };
    },
  });

  // Query para últimas movimentações
  const { data: ultimasMovimentacoes, isLoading: loadingMovimentacoes } = useQuery({
    queryKey: ["ultimas-movimentacoes", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_movimentacoes")
        .select(`
          id,
          tipo,
          quantidade,
          observacao,
          created_at,
          materiais (nome, codigo, unidade)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Query para alertas
  const { data: alertas, isLoading: loadingAlertas } = useQuery({
    queryKey: ["materiais-alertas", refreshKey],
    queryFn: async () => {
      const alertasList: { tipo: string; mensagem: string; severidade: "warning" | "error" | "info" }[] = [];

      // Itens com estoque baixo
      const { data: estoqueBaixo } = await supabase
        .from("materiais_estoque")
        .select(`
          quantidade,
          materiais!inner (
            id,
            nome,
            codigo,
            estoque_minimo
          )
        `)
        .eq("local_tipo", "central");

      estoqueBaixo?.forEach((item: any) => {
        if (item.quantidade <= 0) {
          alertasList.push({
            tipo: "estoque_zerado",
            mensagem: `${item.materiais.codigo} - ${item.materiais.nome} está sem estoque!`,
            severidade: "error",
          });
        } else if (item.quantidade <= (item.materiais.estoque_minimo || 0)) {
          alertasList.push({
            tipo: "estoque_baixo",
            mensagem: `${item.materiais.codigo} - ${item.materiais.nome} está abaixo do mínimo`,
            severidade: "warning",
          });
        }
      });

      // Entregas pendentes há mais de 24h
      const ontem = subDays(new Date(), 1);
      const { count: entregasAtrasadas } = await supabase
        .from("materiais_entregas")
        .select("*", { count: "exact", head: true })
        .is("assinatura_recebimento", null)
        .lt("created_at", ontem.toISOString());

      if (entregasAtrasadas && entregasAtrasadas > 0) {
        alertasList.push({
          tipo: "entregas_atrasadas",
          mensagem: `${entregasAtrasadas} entrega(s) aguardando assinatura há mais de 24h`,
          severidade: "warning",
        });
      }

      return alertasList.slice(0, 5);
    },
  });

  // Query para alertas de retenção de materiais com rastro
  const { data: alertasRetencao, isLoading: loadingRetencao } = useQuery({
    queryKey: ["materiais-alertas-retencao", refreshKey],
    queryFn: async () => {
      // Buscar materiais com rastro que estão com equipes
      const { data: materiaisComEquipe } = await supabase
        .from("materiais_serializados")
        .select(`
          id,
          numero_serie,
          data_entrega_equipe,
          equipe_atual_id,
          materiais (
            codigo,
            nome,
            dias_alerta_retencao
          ),
          tecnicos:equipe_atual_id (
            codigo,
            nome
          )
        `)
        .eq("status", "com_equipe")
        .not("data_entrega_equipe", "is", null);

      if (!materiaisComEquipe) {
        return { totalComEquipe: 0, totalEmAlerta: 0, totalCritico: 0, totalAtencao: 0, itensEmAlerta: [] };
      }

      let totalEmAlerta = 0;
      let totalCritico = 0;
      let totalAtencao = 0;
      const itensEmAlerta: any[] = [];

      materiaisComEquipe.forEach((item: any) => {
        const dias = calcularDiasDesde(item.data_entrega_equipe);
        const diasAlerta = item.materiais?.dias_alerta_retencao || 7;
        const nivel = getNivelAlerta(dias, diasAlerta);

        if (nivel === "critico") {
          totalCritico++;
          totalEmAlerta++;
          itensEmAlerta.push({ ...item, dias, nivel });
        } else if (nivel === "alerta") {
          totalEmAlerta++;
          itensEmAlerta.push({ ...item, dias, nivel });
        } else if (nivel === "atencao") {
          totalAtencao++;
        }
      });

      // Ordenar por dias (mais críticos primeiro)
      itensEmAlerta.sort((a, b) => b.dias - a.dias);

      return {
        totalComEquipe: materiaisComEquipe.length,
        totalEmAlerta,
        totalCritico,
        totalAtencao,
        itensEmAlerta: itensEmAlerta.slice(0, 5), // Top 5 mais críticos
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <MainLayout title="Gestão de Materiais">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Package className="h-8 w-8 text-violet-600" />
              </div>
              Gestão de Materiais
            </h1>
            <p className="text-muted-foreground mt-1">
              Controle completo de estoque, movimentações e rastreabilidade
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button asChild>
              <Link to="/materiais/catalogo">
                <Plus className="h-4 w-4 mr-2" />
                Novo Material
              </Link>
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Itens</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalMateriais}</p>
                  )}
                </div>
                <Package className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-amber-600">{stats?.itensBaixoEstoque}</p>
                  )}
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entradas (Mês)</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-green-600">{stats?.entradas}</p>
                  )}
                </div>
                <ArrowUpRight className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saídas (Mês)</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-red-600">{stats?.saidas}</p>
                  )}
                </div>
                <ArrowDownRight className="h-8 w-8 text-red-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entregas Pend.</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-orange-600">{stats?.entregasPendentes}</p>
                  )}
                </div>
                <Users className="h-8 w-8 text-orange-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Medidores</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-cyan-600">{stats?.medidoresEstoque}</p>
                  )}
                </div>
                <Zap className="h-8 w-8 text-cyan-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Valor em Estoque e Alertas de Retenção */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-r from-violet-500 to-purple-600 text-white">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-violet-100">Valor Total em Estoque</p>
                  {loadingStats ? (
                    <Skeleton className="h-10 w-40 mt-1 bg-white/20" />
                  ) : (
                    <p className="text-4xl font-bold">{formatCurrency(stats?.valorTotal || 0)}</p>
                  )}
                </div>
                <Warehouse className="h-16 w-16 text-white/30" />
              </div>
            </CardContent>
          </Card>

          {/* Card de Alertas de Retenção */}
          <Card className={alertasRetencao?.totalEmAlerta ? "border-orange-200 bg-orange-50/50" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className={`h-5 w-5 ${alertasRetencao?.totalCritico ? "text-red-500" : alertasRetencao?.totalEmAlerta ? "text-orange-500" : "text-muted-foreground"}`} />
                  Materiais com Equipes
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/materiais/rastreabilidade?status=com_equipe">
                    Ver todos
                  </Link>
                </Button>
              </div>
              <CardDescription>
                Materiais com rastro entregues às equipes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRetencao ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <ResumoAlertasRetencao
                    totalComEquipe={alertasRetencao?.totalComEquipe || 0}
                    totalEmAlerta={alertasRetencao?.totalEmAlerta || 0}
                    totalCritico={alertasRetencao?.totalCritico || 0}
                    totalAtencao={alertasRetencao?.totalAtencao || 0}
                  />
                  
                  {alertasRetencao?.itensEmAlerta && alertasRetencao.itensEmAlerta.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Materiais em alerta:</p>
                      {alertasRetencao.itensEmAlerta.map((item: any) => (
                        <div 
                          key={item.id} 
                          className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                            item.nivel === "critico" ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            <span className="font-mono">{item.numero_serie}</span>
                            <span className="text-xs opacity-70">
                              ({item.materiais?.codigo})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.dias} dias</span>
                            <span className="text-xs opacity-70">
                              {item.tecnicos?.codigo}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Acesso Rápido */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Acesso Rápido</CardTitle>
                <CardDescription>Navegue pelos módulos do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {quickAccessCards.map((card) => (
                    <Link
                      key={card.href}
                      to={card.href}
                      className="group p-4 rounded-lg border hover:border-violet-300 hover:bg-violet-50/50 transition-all"
                    >
                      <div className={`${card.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <card.icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-medium text-sm">{card.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alertas */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Alertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAlertas ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : alertas && alertas.length > 0 ? (
                  <div className="space-y-3">
                    {alertas.map((alerta, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg text-sm ${
                          alerta.severidade === "error"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : alerta.severidade === "warning"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {alerta.mensagem}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum alerta no momento</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Últimas Movimentações */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Últimas Movimentações</CardTitle>
              <CardDescription>Atividade recente no estoque</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/materiais/movimentacoes">
                Ver todas
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingMovimentacoes ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : ultimasMovimentacoes && ultimasMovimentacoes.length > 0 ? (
              <div className="space-y-3">
                {ultimasMovimentacoes.map((mov: any) => (
                  <div
                    key={mov.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        mov.tipo === "entrada" ? "bg-green-100" : "bg-red-100"
                      }`}>
                        {mov.tipo === "entrada" ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {mov.materiais?.codigo} - {mov.materiais?.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mov.observacao || (mov.tipo === "entrada" ? "Entrada em estoque" : "Saída de estoque")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={mov.tipo === "entrada" ? "default" : "destructive"}>
                        {mov.tipo === "entrada" ? "+" : "-"}{mov.quantidade} {mov.materiais?.unidade}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(mov.created_at), "dd/MM HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma movimentação registrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}



