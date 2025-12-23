import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Car,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Gauge,
  Palette,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  ano: number | null;
  cor: string | null;
  tipo: string;
  quilometragem: number | null;
  status: string;
  contrato_id: string | null;
  created_at: string;
  contratos?: { codigo: string; nome: string } | null;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

const tipoOptions = [
  { value: "carro", label: "Carro" },
  { value: "moto", label: "Moto" },
  { value: "van", label: "Van" },
  { value: "caminhao", label: "Caminhão" },
  { value: "outro", label: "Outro" },
];

const statusOptions = [
  { value: "disponivel", label: "Disponível", color: "bg-green-500" },
  { value: "em_uso", label: "Em Uso", color: "bg-blue-500" },
  { value: "manutencao", label: "Manutenção", color: "bg-amber-500" },
  { value: "inativo", label: "Inativo", color: "bg-gray-500" },
];

export default function CadastroVeiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | null>(null);
  const [veiculoToDelete, setVeiculoToDelete] = useState<Veiculo | null>(null);
  const [saving, setSaving] = useState(false);

  // Configuração dos filtros
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por placa, modelo ou marca...",
    },
    {
      id: "tipo",
      label: "Tipo",
      type: "select",
      options: tipoOptions,
    },
    {
      id: "status",
      label: "Status",
      type: "select",
      options: statusOptions,
    },
    {
      id: "contrato_id",
      label: "Contrato",
      type: "select",
      options: contratos.map((c) => ({
        value: c.id,
        label: `${c.codigo} - ${c.nome}`,
      })),
    },
  ], [contratos]);

  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  // Form state
  const [formData, setFormData] = useState({
    placa: "",
    modelo: "",
    marca: "",
    ano: "",
    cor: "",
    tipo: "carro",
    quilometragem: "",
    status: "disponivel",
    contrato_id: "",
  });

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("veiculos")
        .select(`
          *,
          contratos (codigo, nome)
        `)
        .order("placa", { ascending: true });

      if (error) throw error;
      setVeiculos(data || []);

      const { data: contratosData } = await supabase
        .from("contratos")
        .select("id, codigo, nome")
        .eq("status", "ativo")
        .order("codigo");
      setContratos(contratosData || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrar dados
  const filteredVeiculos = useMemo(() => {
    return filterData(
      veiculos,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.placa.toLowerCase().includes(searchTerm) ||
            item.modelo.toLowerCase().includes(searchTerm) ||
            item.marca.toLowerCase().includes(searchTerm)
          );
        },
      }
    );
  }, [veiculos, filterValues, filterConfigs]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredVeiculos,
    { column: "placa", direction: "asc" }
  );

  const handleCreate = () => {
    setEditingVeiculo(null);
    setFormData({
      placa: "",
      modelo: "",
      marca: "",
      ano: "",
      cor: "",
      tipo: "carro",
      quilometragem: "",
      status: "disponivel",
      contrato_id: "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (veiculo: Veiculo) => {
    setEditingVeiculo(veiculo);
    setFormData({
      placa: veiculo.placa,
      modelo: veiculo.modelo,
      marca: veiculo.marca,
      ano: veiculo.ano?.toString() || "",
      cor: veiculo.cor || "",
      tipo: veiculo.tipo,
      quilometragem: veiculo.quilometragem?.toString() || "",
      status: veiculo.status,
      contrato_id: veiculo.contrato_id || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.placa || !formData.modelo || !formData.marca) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        placa: formData.placa.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        modelo: formData.modelo,
        marca: formData.marca,
        ano: formData.ano ? parseInt(formData.ano) : null,
        cor: formData.cor || null,
        tipo: formData.tipo,
        quilometragem: formData.quilometragem ? parseFloat(formData.quilometragem) : null,
        status: formData.status,
        contrato_id: formData.contrato_id || null,
      };

      if (editingVeiculo) {
        const { error } = await supabase
          .from("veiculos")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingVeiculo.id);

        if (error) throw error;
        toast.success("Veículo atualizado com sucesso");
      } else {
        const { error } = await supabase.from("veiculos").insert(payload);

        if (error) throw error;
        toast.success("Veículo criado com sucesso");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!veiculoToDelete) return;

    try {
      const { error } = await supabase
        .from("veiculos")
        .delete()
        .eq("id", veiculoToDelete.id);

      if (error) throw error;

      toast.success("Veículo excluído com sucesso");
      setDeleteDialogOpen(false);
      setVeiculoToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const formatPlaca = (placa: string) => {
    if (placa.length === 7) {
      return `${placa.slice(0, 3)}-${placa.slice(3)}`;
    }
    return placa;
  };

  return (
    <MainLayout
      title="Veículos"
      subtitle="Gerencie a frota de veículos"
      breadcrumbs={[
        { label: "Cadastros", href: "/cadastros" },
        { label: "Veículos" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {statusOptions.map((status) => {
              const count = veiculos.filter((v) => v.status === status.value).length;
              return (
                <button
                  key={status.value}
                  onClick={() => setFilterValues({ ...filterValues, status: status.value })}
                  className={`px-3 py-1.5 rounded-lg border transition-all text-sm ${
                    filterValues.status === status.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                    <span>{status.label}</span>
                    <Badge variant="secondary" className="ml-1">{count}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Veículo
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-border bg-card p-4">
          <DataTableFilters
            filters={filterConfigs}
            values={filterValues}
            onChange={setFilterValues}
            onClear={clearFilters}
          />
        </div>

        {/* Tabela */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  column="placa"
                  label="Placa"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="modelo"
                  label="Modelo / Marca"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="tipo"
                  label="Tipo"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="ano"
                  label="Ano / Cor"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="quilometragem"
                  label="Km"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="contratos.codigo"
                  label="Contrato"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="status"
                  label="Status"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : sortedData?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Car className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      {hasActiveFilters
                        ? "Nenhum veículo encontrado com os filtros aplicados"
                        : "Nenhum veículo cadastrado"}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                        Limpar filtros
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData?.map((veiculo) => {
                  const statusOpt = statusOptions.find((s) => s.value === veiculo.status);
                  return (
                    <TableRow key={veiculo.id} className="group">
                      <TableCell className="font-mono font-bold text-primary">
                        {formatPlaca(veiculo.placa)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{veiculo.modelo}</p>
                        <p className="text-sm text-muted-foreground">{veiculo.marca}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tipoOptions.find((t) => t.value === veiculo.tipo)?.label || veiculo.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {veiculo.ano && (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {veiculo.ano}
                            </div>
                          )}
                          {veiculo.cor && (
                            <div className="flex items-center gap-1 text-sm">
                              <Palette className="h-3 w-3 text-muted-foreground" />
                              {veiculo.cor}
                            </div>
                          )}
                          {!veiculo.ano && !veiculo.cor && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {veiculo.quilometragem ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Gauge className="h-3 w-3 text-muted-foreground" />
                            {veiculo.quilometragem.toLocaleString("pt-BR")} km
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {veiculo.contratos ? (
                          <Badge variant="secondary">{veiculo.contratos.codigo}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusOpt?.color} text-white`}>
                          {statusOpt?.label || veiculo.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(veiculo)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setVeiculoToDelete(veiculo);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {sortedData && sortedData.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
              Mostrando {sortedData.length} de {veiculos.length} veículos
            </div>
          )}
        </div>

        {/* Dialog de Criar/Editar */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingVeiculo ? "Editar Veículo" : "Novo Veículo"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Placa *</Label>
                <Input
                  value={formData.placa}
                  onChange={(e) =>
                    setFormData({ ...formData, placa: e.target.value.toUpperCase() })
                  }
                  placeholder="ABC1D23"
                  maxLength={7}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modelo *</Label>
                <Input
                  value={formData.modelo}
                  onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  placeholder="Ex: Gol, Strada..."
                />
              </div>

              <div className="space-y-2">
                <Label>Marca *</Label>
                <Input
                  value={formData.marca}
                  onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                  placeholder="Ex: Volkswagen, Fiat..."
                />
              </div>

              <div className="space-y-2">
                <Label>Ano</Label>
                <Input
                  type="number"
                  value={formData.ano}
                  onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                  placeholder="Ex: 2023"
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <Input
                  value={formData.cor}
                  onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                  placeholder="Ex: Branco"
                />
              </div>

              <div className="space-y-2">
                <Label>Quilometragem</Label>
                <Input
                  type="number"
                  value={formData.quilometragem}
                  onChange={(e) =>
                    setFormData({ ...formData, quilometragem: e.target.value })
                  }
                  placeholder="Ex: 50000"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${s.color}`} />
                          {s.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Contrato</Label>
                <Select
                  value={formData.contrato_id}
                  onValueChange={(v) => setFormData({ ...formData, contrato_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o veículo{" "}
                <strong>{veiculoToDelete?.placa}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
