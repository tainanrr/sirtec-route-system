import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  ArrowLeft,
  Zap,
  Plus,
  QrCode,
  History,
  MapPin,
  User,
  Calendar,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Barcode,
  FileText,
  Truck,
  Home,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

interface MaterialSerializado {
  id: string;
  material_id: string;
  numero_serie: string;
  lote: string | null;
  data_fabricacao: string | null;
  data_validade: string | null;
  status: string;
  localizacao_tipo: string;
  localizacao_id: string | null;
  ordem_servico_id: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  materiais?: {
    codigo: string;
    nome: string;
    categoria: string;
  };
  tecnicos?: {
    codigo: string;
    nome: string;
  };
  ordens_servico?: {
    numero: string;
    endereco: string;
    cliente_nome: string;
  };
}

interface HistoricoItem {
  id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string;
  localizacao_anterior: string | null;
  localizacao_nova: string | null;
  observacao: string | null;
  created_at: string;
  created_by: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  em_estoque: { label: "Em Estoque", color: "bg-blue-100 text-blue-700", icon: Package },
  em_transito: { label: "Em Trânsito", color: "bg-amber-100 text-amber-700", icon: Truck },
  com_equipe: { label: "Com Equipe", color: "bg-purple-100 text-purple-700", icon: User },
  instalado: { label: "Instalado", color: "bg-green-100 text-green-700", icon: CheckCircle },
  retirado: { label: "Retirado", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  defeito: { label: "Defeito", color: "bg-red-100 text-red-700", icon: XCircle },
  descartado: { label: "Descartado", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

export default function Rastreabilidade() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroMaterial, setFiltroMaterial] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MaterialSerializado | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  // Form para novo item serializado
  const [formData, setFormData] = useState({
    material_id: "",
    numero_serie: "",
    lote: "",
    data_fabricacao: "",
    data_validade: "",
    observacao: "",
  });

  // Query para itens serializados (otimizada)
  const { data: itens, isLoading } = useQuery({
    queryKey: ["materiais-serializados", filtroStatus, filtroMaterial, searchTerm],
    queryFn: async () => {
      // Primeiro buscar apenas os dados básicos (mais rápido)
      let query = supabase
        .from("materiais_serializados")
        .select(`
          id,
          material_id,
          numero_serie,
          lote,
          data_fabricacao,
          data_validade,
          status,
          localizacao_tipo,
          localizacao_id,
          ordem_servico_id,
          observacao,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false })
        .limit(500); // Limitar para performance

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      if (filtroMaterial !== "todos") {
        query = query.eq("material_id", filtroMaterial);
      }

      // Filtrar por busca no número de série ou lote (mais rápido que join)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        query = query.or(`numero_serie.ilike.%${term}%,lote.ilike.%${term}%`);
      }

      const { data: serializados, error } = await query;
      if (error) throw error;

      if (!serializados || serializados.length === 0) return [];

      // Buscar dados relacionados em paralelo (mais eficiente)
      const materialIds = [...new Set(serializados.map((s: any) => s.material_id))];
      const osIds = serializados.filter((s: any) => s.ordem_servico_id).map((s: any) => s.ordem_servico_id);
      const equipeIds = serializados.filter((s: any) => s.localizacao_tipo === "equipe" && s.localizacao_id).map((s: any) => s.localizacao_id);

      const [materiaisData, osData, equipesData] = await Promise.all([
        supabase.from("materiais").select("id, codigo, nome, categoria").in("id", materialIds),
        osIds.length > 0 ? supabase.from("ordens_servico").select("id, numero, endereco, cliente_nome").in("id", osIds) : Promise.resolve({ data: [] }),
        equipeIds.length > 0 ? supabase.from("tecnicos").select("id, codigo, nome").in("id", equipeIds) : Promise.resolve({ data: [] }),
      ]);

      // Montar resultado com joins
      const materiaisMap = new Map((materiaisData.data || []).map((m: any) => [m.id, m]));
      const osMap = new Map((osData.data || []).map((os: any) => [os.id, os]));
      const equipesMap = new Map((equipesData.data || []).map((eq: any) => [eq.id, eq]));

      return serializados.map((item: any) => ({
        ...item,
        materiais: materiaisMap.get(item.material_id),
        ordens_servico: item.ordem_servico_id ? osMap.get(item.ordem_servico_id) : null,
        tecnicos: item.localizacao_tipo === "equipe" && item.localizacao_id ? equipesMap.get(item.localizacao_id) : null,
      })) as MaterialSerializado[];
    },
  });

  // Query para materiais que requerem serial (requer_serial = true OU unidade = 'SR')
  const { data: materiaisSeriais } = useQuery({
    queryKey: ["materiais-com-serial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, codigo, nome, unidade")
        .eq("ativo", true)
        .or("requer_serial.eq.true,unidade.eq.SR")
        .order("codigo");

      if (error) throw error;
      return data;
    },
  });

  // Query para estatísticas
  const { data: stats } = useQuery({
    queryKey: ["serializados-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_serializados")
        .select("status");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((item: any) => {
        counts[item.status] = (counts[item.status] || 0) + 1;
      });

      return {
        total: data?.length || 0,
        em_estoque: counts.em_estoque || 0,
        com_equipe: counts.com_equipe || 0,
        instalado: counts.instalado || 0,
        defeito: counts.defeito || 0,
      };
    },
  });

  // Mutation para cadastrar item serializado
  const cadastrarMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Verificar se número de série já existe
      const { data: existente } = await supabase
        .from("materiais_serializados")
        .select("id")
        .eq("numero_serie", data.numero_serie)
        .maybeSingle();

      if (existente) {
        throw new Error("Número de série já cadastrado");
      }

      const { data: novoItem, error } = await supabase
        .from("materiais_serializados")
        .insert({
          material_id: data.material_id,
          numero_serie: data.numero_serie.toUpperCase(),
          lote: data.lote || null,
          data_fabricacao: data.data_fabricacao || null,
          data_validade: data.data_validade || null,
          status: "em_estoque",
          localizacao_tipo: "central",
          observacao: data.observacao || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico usando o ID do item criado
      if (novoItem) {
        await supabase.from("materiais_serializados_historico").insert({
          serializado_id: novoItem.id,
          acao: "cadastro",
          status_novo: "em_estoque",
          localizacao_nova: "central",
          observacao: "Cadastro inicial",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais-serializados"] });
      queryClient.invalidateQueries({ queryKey: ["serializados-stats"] });
      toast.success("Item cadastrado com sucesso!");
      setDialogOpen(false);
      setFormData({
        material_id: "",
        numero_serie: "",
        lote: "",
        data_fabricacao: "",
        data_validade: "",
        observacao: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao cadastrar item");
    },
  });

  // Carregar histórico do item
  const loadHistorico = async (itemId: string) => {
    const { data, error } = await supabase
      .from("materiais_serializados_historico")
      .select("*")
      .eq("serializado_id", itemId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setHistorico(data as HistoricoItem[]);
    }
  };

  const handleViewItem = async (item: MaterialSerializado) => {
    setSelectedItem(item);
    await loadHistorico(item.id);
    setViewDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material_id || !formData.numero_serie) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    cadastrarMutation.mutate(formData);
  };

  const getLocalizacaoLabel = (item: MaterialSerializado) => {
    if (item.localizacao_tipo === "central") return "Estoque Central";
    if (item.localizacao_tipo === "equipe" && item.tecnicos) {
      return `Equipe ${item.tecnicos.codigo}`;
    }
    if (item.localizacao_tipo === "campo" && item.ordens_servico) {
      return `OS #${item.ordens_servico.numero}`;
    }
    return item.localizacao_tipo;
  };

  return (
    <MainLayout title="Rastreabilidade">
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
                <Search className="h-6 w-6 text-amber-600" />
                Rastreabilidade
              </h1>
              <p className="text-muted-foreground text-sm">
                Controle de medidores e itens com número de série
              </p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Serial
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <Zap className="h-8 w-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Estoque</p>
                  <p className="text-2xl font-bold text-blue-600">{stats?.em_estoque || 0}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Com Equipes</p>
                  <p className="text-2xl font-bold text-purple-600">{stats?.com_equipe || 0}</p>
                </div>
                <User className="h-8 w-8 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Instalados</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.instalado || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Com Defeito</p>
                  <p className="text-2xl font-bold text-red-600">{stats?.defeito || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500 opacity-80" />
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
                    placeholder="Buscar por número de série, lote ou OS..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroMaterial} onValueChange={setFiltroMaterial}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Materiais</SelectItem>
                  {materiaisSeriais?.map((mat: any) => (
                    <SelectItem key={mat.id} value={mat.id}>
                      {mat.codigo} - {mat.nome}
                    </SelectItem>
                  ))}
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
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : itens && itens.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Série</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Última Atualização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item) => {
                    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.em_estoque;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <QrCode className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono font-medium">{item.numero_serie}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.materiais?.codigo}</p>
                            <p className="text-xs text-muted-foreground">{item.materiais?.nome}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.lote || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${statusConfig.color} border-0`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.localizacao_tipo === "central" && <Home className="h-4 w-4 text-muted-foreground" />}
                            {item.localizacao_tipo === "equipe" && <User className="h-4 w-4 text-muted-foreground" />}
                            {item.localizacao_tipo === "campo" && <MapPin className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm">{getLocalizacaoLabel(item)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {format(new Date(item.updated_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewItem(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum item serializado encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Serial
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Cadastro */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Item Serializado</DialogTitle>
              <DialogDescription>
                Registre um novo medidor ou equipamento com número de série
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Material *</Label>
                <Select
                  value={formData.material_id}
                  onValueChange={(value) => setFormData({ ...formData, material_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o material..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materiaisSeriais?.map((mat: any) => (
                      <SelectItem key={mat.id} value={mat.id}>
                        {mat.codigo} - {mat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Número de Série *</Label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.numero_serie}
                    onChange={(e) =>
                      setFormData({ ...formData, numero_serie: e.target.value.toUpperCase() })
                    }
                    placeholder="Ex: MED2024001234"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lote</Label>
                <Input
                  value={formData.lote}
                  onChange={(e) => setFormData({ ...formData, lote: e.target.value })}
                  placeholder="Número do lote"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Fabricação</Label>
                  <Input
                    type="date"
                    value={formData.data_fabricacao}
                    onChange={(e) =>
                      setFormData({ ...formData, data_fabricacao: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Validade</Label>
                  <Input
                    type="date"
                    value={formData.data_validade}
                    onChange={(e) =>
                      setFormData({ ...formData, data_validade: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                  placeholder="Observações..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={cadastrarMutation.isPending}>
                  {cadastrarMutation.isPending ? "Salvando..." : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Visualização */}
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                {selectedItem?.numero_serie}
              </DialogTitle>
            </DialogHeader>

            {selectedItem && (
              <Tabs defaultValue="detalhes" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="detalhes" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Material</p>
                      <p className="font-medium">
                        {selectedItem.materiais?.codigo} - {selectedItem.materiais?.nome}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className={`${STATUS_CONFIG[selectedItem.status]?.color || ""} border-0`}>
                        {STATUS_CONFIG[selectedItem.status]?.label || selectedItem.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lote</p>
                      <p className="font-medium">{selectedItem.lote || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Localização</p>
                      <p className="font-medium">{getLocalizacaoLabel(selectedItem)}</p>
                    </div>
                    {selectedItem.data_fabricacao && (
                      <div>
                        <p className="text-sm text-muted-foreground">Data de Fabricação</p>
                        <p className="font-medium">
                          {format(new Date(selectedItem.data_fabricacao), "dd/MM/yyyy")}
                        </p>
                      </div>
                    )}
                    {selectedItem.data_validade && (
                      <div>
                        <p className="text-sm text-muted-foreground">Data de Validade</p>
                        <p className="font-medium">
                          {format(new Date(selectedItem.data_validade), "dd/MM/yyyy")}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedItem.ordens_servico && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Instalado em</p>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-medium">OS #{selectedItem.ordens_servico.numero}</p>
                          <p className="text-sm">{selectedItem.ordens_servico.endereco}</p>
                          {selectedItem.ordens_servico.cliente_nome && (
                            <p className="text-sm text-muted-foreground">
                              Cliente: {selectedItem.ordens_servico.cliente_nome}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedItem.observacao && (
                    <div>
                      <p className="text-sm text-muted-foreground">Observação</p>
                      <p className="text-sm">{selectedItem.observacao}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="historico" className="mt-4">
                  {historico.length > 0 ? (
                    <div className="space-y-3">
                      {historico.map((item) => (
                        <div key={item.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="p-2 bg-background rounded-full h-fit">
                            <History className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm capitalize">{item.acao}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
                              </p>
                            </div>
                            {item.status_anterior && item.status_novo && (
                              <p className="text-sm text-muted-foreground">
                                {STATUS_CONFIG[item.status_anterior]?.label} → {STATUS_CONFIG[item.status_novo]?.label}
                              </p>
                            )}
                            {item.localizacao_nova && (
                              <p className="text-sm text-muted-foreground">
                                Localização: {item.localizacao_nova}
                              </p>
                            )}
                            {item.observacao && (
                              <p className="text-sm mt-1">{item.observacao}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum histórico disponível</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

