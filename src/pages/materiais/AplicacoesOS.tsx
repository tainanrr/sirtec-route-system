import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardCheck,
  Search,
  ArrowLeft,
  Plus,
  Minus,
  Package,
  FileText,
  Calendar,
  User,
  MapPin,
  QrCode,
  Eye,
  Download,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, subDays, startOfDay } from "date-fns";

interface AplicacaoOS {
  id: string;
  ordem_servico_id: string;
  material_id: string;
  quantidade: number;
  tipo: string;
  numero_serie: string | null;
  observacao: string | null;
  created_at: string;
  materiais: {
    codigo: string;
    nome: string;
    unidade: string;
  };
  ordens_servico?: {
    numero: string;
    tipo: string;
    endereco: string;
    cliente_nome: string;
  };
  tecnicos?: {
    codigo: string;
    nome: string;
  };
}

export default function AplicacoesOS() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("30");
  const [currentPage, setCurrentPage] = useState(0);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedOS, setSelectedOS] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 50;

  // Query para aplicações
  const { data: aplicacoes, isLoading } = useQuery({
    queryKey: ["aplicacoes-os", filtroTipo, filtroPeriodo, searchTerm, currentPage],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(filtroPeriodo));

      let query = supabase
        .from("materiais_aplicados_os")
        .select(`
          id,
          ordem_servico_id,
          material_id,
          quantidade,
          tipo,
          numero_serie,
          observacao,
          created_at,
          materiais (codigo, nome, unidade),
          ordens_servico:ordem_servico_id (numero, tipo, endereco, cliente_nome),
          tecnicos:equipe_id (codigo, nome)
        `)
        .gte("created_at", startOfDay(dataInicio).toISOString())
        .order("created_at", { ascending: false })
        .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

      if (filtroTipo !== "todos") {
        query = query.eq("tipo", filtroTipo);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filtrar por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (data as AplicacaoOS[]).filter(
          (app) =>
            app.materiais?.codigo.toLowerCase().includes(term) ||
            app.materiais?.nome.toLowerCase().includes(term) ||
            app.ordens_servico?.numero.toLowerCase().includes(term) ||
            app.numero_serie?.toLowerCase().includes(term)
        );
      }

      return data as AplicacaoOS[];
    },
  });

  // Query para contagem total
  const { data: totalCount } = useQuery({
    queryKey: ["aplicacoes-os-count", filtroTipo, filtroPeriodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(filtroPeriodo));

      let query = supabase
        .from("materiais_aplicados_os")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfDay(dataInicio).toISOString());

      if (filtroTipo !== "todos") {
        query = query.eq("tipo", filtroTipo);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Query para estatísticas
  const { data: stats } = useQuery({
    queryKey: ["aplicacoes-os-stats", filtroPeriodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), parseInt(filtroPeriodo));

      const { data, error } = await supabase
        .from("materiais_aplicados_os")
        .select(`
          tipo,
          quantidade,
          ordem_servico_id,
          materiais (valor_unitario)
        `)
        .gte("created_at", startOfDay(dataInicio).toISOString());

      if (error) throw error;

      const aplicados = data?.filter((m: any) => m.tipo === "aplicado") || [];
      const retirados = data?.filter((m: any) => m.tipo === "retirado") || [];

      const totalAplicado = aplicados.reduce((acc: number, m: any) => acc + m.quantidade, 0);
      const totalRetirado = retirados.reduce((acc: number, m: any) => acc + m.quantidade, 0);
      const valorAplicado = aplicados.reduce((acc: number, m: any) => {
        return acc + (m.quantidade * (m.materiais?.valor_unitario || 0));
      }, 0);

      const osUnicas = new Set(data?.map((m: any) => m.ordem_servico_id));

      return {
        totalAplicado,
        totalRetirado,
        valorAplicado,
        totalOS: osUnicas.size,
        total: data?.length || 0,
      };
    },
  });

  // Query para detalhes de uma OS específica
  const { data: detalhesOS, isLoading: loadingDetalhes } = useQuery({
    queryKey: ["aplicacoes-os-detalhes", selectedOS],
    queryFn: async () => {
      if (!selectedOS) return null;

      const { data, error } = await supabase
        .from("materiais_aplicados_os")
        .select(`
          id,
          quantidade,
          tipo,
          numero_serie,
          observacao,
          created_at,
          materiais (codigo, nome, unidade)
        `)
        .eq("ordem_servico_id", selectedOS)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar dados da OS
      const { data: os } = await supabase
        .from("ordens_servico")
        .select("numero, tipo, endereco, cliente_nome")
        .eq("id", selectedOS)
        .single();

      return { itens: data, os };
    },
    enabled: !!selectedOS,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  return (
    <MainLayout title="Aplicações em OS">
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
                <ClipboardCheck className="h-6 w-6 text-cyan-600" />
                Aplicações em OS
              </h1>
              <p className="text-muted-foreground text-sm">
                Materiais aplicados e retirados em ordens de serviço
              </p>
            </div>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Registros</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <ClipboardCheck className="h-8 w-8 text-cyan-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aplicados</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.totalAplicado || 0}</p>
                </div>
                <Plus className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Retirados</p>
                  <p className="text-2xl font-bold text-orange-600">{stats?.totalRetirado || 0}</p>
                </div>
                <Minus className="h-8 w-8 text-orange-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">OSs Atendidas</p>
                  <p className="text-2xl font-bold text-blue-600">{stats?.totalOS || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500 to-teal-600 text-white">
            <CardContent className="pt-4">
              <div>
                <p className="text-xs text-cyan-100">Valor Aplicado</p>
                <p className="text-xl font-bold">{formatCurrency(stats?.valorAplicado || 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por material, OS ou número de série..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="aplicado">Aplicado</SelectItem>
                  <SelectItem value="retirado">Retirado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="15">Últimos 15 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : aplicacoes && aplicacoes.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-center">Quantidade</TableHead>
                      <TableHead>Nº Série</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aplicacoes.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {format(new Date(app.created_at), "dd/MM/yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(app.created_at), "HH:mm")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">#{app.ordens_servico?.numero}</p>
                            <p className="text-xs text-muted-foreground">
                              {app.ordens_servico?.tipo}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{app.materiais?.codigo}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {app.materiais?.nome}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`border-0 ${
                            app.tipo === "aplicado"
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          }`}>
                            {app.tipo === "aplicado" ? (
                              <Plus className="h-3 w-3 mr-1" />
                            ) : (
                              <Minus className="h-3 w-3 mr-1" />
                            )}
                            {app.tipo === "aplicado" ? "Aplicado" : "Retirado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {app.quantidade} {app.materiais?.unidade}
                        </TableCell>
                        <TableCell>
                          {app.numero_serie ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              <QrCode className="h-3 w-3 mr-1" />
                              {app.numero_serie}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {app.tecnicos ? (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{app.tecnicos.codigo}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedOS(app.ordem_servico_id);
                              setViewDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {currentPage * ITEMS_PER_PAGE + 1} a{" "}
                      {Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalCount || 0)} de{" "}
                      {totalCount} registros
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage((p) => p - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma aplicação encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Detalhes da OS */}
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Materiais da OS</DialogTitle>
            </DialogHeader>

            {loadingDetalhes ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : detalhesOS ? (
              <div className="space-y-4">
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">OS #{detalhesOS.os?.numero}</p>
                        <p className="text-sm text-muted-foreground">{detalhesOS.os?.tipo}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {detalhesOS.os?.endereco}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-center">Tipo</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalhesOS.itens?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.materiais?.codigo}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.materiais?.nome}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`border-0 ${
                              item.tipo === "aplicado"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }`}>
                              {item.tipo === "aplicado" ? "Aplicado" : "Retirado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {item.quantidade} {item.materiais?.unidade}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}







