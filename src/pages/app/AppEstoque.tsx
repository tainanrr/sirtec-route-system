import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  Search,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Zap,
  RefreshCw,
  History,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface EstoqueItem {
  id: string;
  material_id: string;
  quantidade: number;
  materiais: {
    id: string;
    codigo: string;
    nome: string;
    unidade: string;
    categoria: string;
    estoque_minimo: number;
    requer_serial: boolean;
  };
}

interface MovimentacaoRecente {
  id: string;
  tipo: string;
  quantidade: number;
  observacao: string | null;
  created_at: string;
  materiais: {
    codigo: string;
    nome: string;
    unidade: string;
  };
}

export default function AppEstoque() {
  const navigate = useNavigate();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const equipeId = equipe?.id || equipeAuth?.id;

  // Query para estoque da equipe
  const { data: estoqueEquipe, isLoading } = useQuery({
    queryKey: ["estoque-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];

      const { data, error } = await supabase
        .from("materiais_estoque")
        .select(`
          id,
          material_id,
          quantidade,
          materiais!inner (
            id,
            codigo,
            nome,
            unidade,
            categoria,
            estoque_minimo,
            requer_serial
          )
        `)
        .eq("local_tipo", "equipe")
        .eq("local_id", equipeId)
        .gt("quantidade", 0)
        .order("materiais(codigo)");

      if (error) throw error;
      return data as EstoqueItem[];
    },
    enabled: !!equipeId,
  });

  // Query para movimentações recentes
  const { data: movimentacoesRecentes } = useQuery({
    queryKey: ["movimentacoes-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];

      const { data, error } = await supabase
        .from("materiais_movimentacoes")
        .select(`
          id,
          tipo,
          quantidade,
          observacao,
          created_at,
          materiais (codigo, nome, unidade)
        `)
        .or(`local_origem_id.eq.${equipeId},local_destino_id.eq.${equipeId}`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as MovimentacaoRecente[];
    },
    enabled: !!equipeId,
  });

  // Query para entregas pendentes
  const { data: entregasPendentes } = useQuery({
    queryKey: ["entregas-pendentes-equipe", equipeId, refreshKey],
    queryFn: async () => {
      if (!equipeId) return [];

      const { data, error } = await supabase
        .from("materiais_entregas")
        .select(`
          id,
          data_entrega,
          status,
          observacao
        `)
        .eq("equipe_id", equipeId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!equipeId,
  });

  // Filtrar estoque por busca
  const estoqueFiltrado = estoqueEquipe?.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.materiais.codigo.toLowerCase().includes(term) ||
      item.materiais.nome.toLowerCase().includes(term)
    );
  });

  // Calcular estatísticas
  const totalItens = estoqueEquipe?.length || 0;
  const itensBaixos = estoqueEquipe?.filter(
    (item) => item.quantidade <= item.materiais.estoque_minimo
  ).length || 0;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              Meu Estoque
            </h1>
            <p className="text-xs text-muted-foreground">
              Materiais disponíveis para uso
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Alertas de Entregas Pendentes */}
        {entregasPendentes && entregasPendentes.length > 0 && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-amber-800">
                    {entregasPendentes.length} entrega(s) aguardando sua assinatura
                  </p>
                  <p className="text-sm text-amber-700">
                    Toque para confirmar o recebimento
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Itens em Estoque</p>
                  <p className="text-2xl font-bold">{totalItens}</p>
                </div>
                <Package className="h-8 w-8 text-emerald-500 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className={itensBaixos > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Estoque Baixo</p>
                  <p className={`text-2xl font-bold ${itensBaixos > 0 ? "text-amber-600" : ""}`}>
                    {itensBaixos}
                  </p>
                </div>
                <AlertTriangle className={`h-8 w-8 ${itensBaixos > 0 ? "text-amber-500" : "text-gray-300"}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="estoque" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="estoque">Estoque</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="estoque" className="mt-4 space-y-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Lista de Materiais */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : estoqueFiltrado && estoqueFiltrado.length > 0 ? (
              <div className="space-y-2">
                {estoqueFiltrado.map((item) => {
                  const isBaixo = item.quantidade <= item.materiais.estoque_minimo;

                  return (
                    <Card
                      key={item.id}
                      className={isBaixo ? "border-amber-300 bg-amber-50/50" : ""}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isBaixo ? "bg-amber-100" : "bg-emerald-100"}`}>
                              {item.materiais.requer_serial ? (
                                <Zap className={`h-5 w-5 ${isBaixo ? "text-amber-600" : "text-emerald-600"}`} />
                              ) : (
                                <Package className={`h-5 w-5 ${isBaixo ? "text-amber-600" : "text-emerald-600"}`} />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{item.materiais.codigo}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {item.materiais.nome}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xl font-bold ${isBaixo ? "text-amber-600" : ""}`}>
                              {item.quantidade}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.materiais.unidade}
                            </p>
                          </div>
                        </div>
                        {isBaixo && (
                          <div className="mt-2 flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-xs">Estoque baixo (mín: {item.materiais.estoque_minimo})</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">
                    {searchTerm ? "Nenhum material encontrado" : "Seu estoque está vazio"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {movimentacoesRecentes && movimentacoesRecentes.length > 0 ? (
              <div className="space-y-2">
                {movimentacoesRecentes.map((mov) => (
                  <Card key={mov.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          mov.tipo === "entrada" || mov.tipo === "transferencia"
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}>
                          {mov.tipo === "entrada" || mov.tipo === "transferencia" ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Package className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {mov.materiais?.codigo} - {mov.materiais?.nome}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {mov.observacao || (mov.tipo === "entrada" ? "Recebimento" : "Aplicação/Saída")}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={mov.tipo === "entrada" || mov.tipo === "transferencia" ? "default" : "destructive"}>
                            {mov.tipo === "entrada" || mov.tipo === "transferencia" ? "+" : "-"}
                            {mov.quantidade}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(mov.created_at), "dd/MM HH:mm")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <History className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhuma movimentação recente</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

