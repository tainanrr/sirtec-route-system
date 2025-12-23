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
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  Users,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";

interface CoordenadorSupervisor {
  id: string;
  codigo: string;
  nome: string;
  tipo: "coordenador" | "supervisor";
  email: string | null;
  telefone: string | null;
  contrato_id: string | null;
  ativo: boolean;
  created_at: string;
  contratos?: { codigo: string; nome: string } | null;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
}

const tipoOptions = [
  { value: "coordenador", label: "Coordenador", color: "bg-blue-500" },
  { value: "supervisor", label: "Supervisor", color: "bg-purple-500" },
];

export default function CadastroCoordenadores() {
  const [coordenadores, setCoordenadores] = useState<CoordenadorSupervisor[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vinculoDialogOpen, setVinculoDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CoordenadorSupervisor | null>(null);
  const [itemToDelete, setItemToDelete] = useState<CoordenadorSupervisor | null>(null);
  const [selectedCoordForVinculo, setSelectedCoordForVinculo] = useState<CoordenadorSupervisor | null>(null);
  const [saving, setSaving] = useState(false);

  // Configuração dos filtros
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por código, nome ou email...",
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
      options: [
        { value: "ativo", label: "Ativos", color: "bg-green-500" },
        { value: "inativo", label: "Inativos", color: "bg-gray-500" },
      ],
    },
  ], []);

  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  // Form state
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    tipo: "coordenador" as "coordenador" | "supervisor",
    email: "",
    telefone: "",
    contrato_id: "",
    ativo: true,
  });

  // Estado para vínculo
  const [vinculoEquipeId, setVinculoEquipeId] = useState("");
  const [vinculoDataInicio, setVinculoDataInicio] = useState(new Date().toISOString().split("T")[0]);

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coordenadores_supervisores")
        .select(`
          *,
          contratos (codigo, nome)
        `)
        .order("tipo", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;
      setCoordenadores(data || []);

      const { data: contratosData } = await supabase
        .from("contratos")
        .select("id, codigo, nome")
        .eq("status", "ativo")
        .order("codigo");
      setContratos(contratosData || []);

      const { data: equipesData } = await supabase
        .from("tecnicos")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("codigo");
      setEquipes(equipesData || []);
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
  const filteredCoordenadores = useMemo(() => {
    return filterData(
      coordenadores,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm) ||
            item.email?.toLowerCase().includes(searchTerm) || false
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
      }
    );
  }, [coordenadores, filterValues, filterConfigs]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredCoordenadores,
    { column: "nome", direction: "asc" }
  );

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({
      codigo: "",
      nome: "",
      tipo: "coordenador",
      email: "",
      telefone: "",
      contrato_id: "",
      ativo: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (item: CoordenadorSupervisor) => {
    setEditingItem(item);
    setFormData({
      codigo: item.codigo,
      nome: item.nome,
      tipo: item.tipo,
      email: item.email || "",
      telefone: item.telefone || "",
      contrato_id: item.contrato_id || "",
      ativo: item.ativo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.codigo || !formData.nome) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: formData.codigo,
        nome: formData.nome,
        tipo: formData.tipo,
        email: formData.email || null,
        telefone: formData.telefone || null,
        contrato_id: formData.contrato_id || null,
        ativo: formData.ativo,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("coordenadores_supervisores")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Registro atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("coordenadores_supervisores")
          .insert(payload);

        if (error) throw error;
        toast.success("Registro criado com sucesso");
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
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from("coordenadores_supervisores")
        .delete()
        .eq("id", itemToDelete.id);

      if (error) throw error;

      toast.success("Registro excluído com sucesso");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const handleVincularEquipe = async () => {
    if (!selectedCoordForVinculo || !vinculoEquipeId || !vinculoDataInicio) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from("equipe_coordenador_historico")
        .update({ data_fim: vinculoDataInicio })
        .eq("equipe_id", vinculoEquipeId)
        .is("data_fim", null);

      const { error } = await supabase
        .from("equipe_coordenador_historico")
        .insert({
          equipe_id: vinculoEquipeId,
          coordenador_supervisor_id: selectedCoordForVinculo.id,
          data_inicio: vinculoDataInicio,
        });

      if (error) throw error;

      const fieldToUpdate = selectedCoordForVinculo.tipo === "coordenador" 
        ? "coordenador_id" 
        : "supervisor_id";

      await supabase
        .from("tecnicos")
        .update({ [fieldToUpdate]: selectedCoordForVinculo.id })
        .eq("id", vinculoEquipeId);

      toast.success("Equipe vinculada com sucesso");
      setVinculoDialogOpen(false);
      setVinculoEquipeId("");
    } catch (error: any) {
      console.error("Erro ao vincular:", error);
      toast.error(`Erro ao vincular: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout
      title="Coordenadores e Supervisores"
      subtitle="Gerencie os coordenadores e supervisores das equipes"
      breadcrumbs={[
        { label: "Cadastros", href: "/cadastros" },
        { label: "Coordenadores" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              {coordenadores.filter((c) => c.tipo === "coordenador").length} Coordenadores
            </Badge>
            <Badge variant="outline" className="text-sm">
              {coordenadores.filter((c) => c.tipo === "supervisor").length} Supervisores
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo
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
                  column="codigo"
                  label="Código"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="nome"
                  label="Nome"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="tipo"
                  label="Tipo"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <TableHead>Contato</TableHead>
                <SortableTableHead
                  column="contratos.codigo"
                  label="Contrato"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="ativo"
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
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : sortedData?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <UserCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      {hasActiveFilters
                        ? "Nenhum registro encontrado com os filtros aplicados"
                        : "Nenhum coordenador/supervisor cadastrado"}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                        Limpar filtros
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData?.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-mono font-medium">
                      {item.codigo}
                    </TableCell>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell>
                      <Badge
                        variant={item.tipo === "coordenador" ? "default" : "secondary"}
                      >
                        {item.tipo === "coordenador" ? "Coordenador" : "Supervisor"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {item.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {item.email}
                          </div>
                        )}
                        {item.telefone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {item.telefone}
                          </div>
                        )}
                        {!item.email && !item.telefone && (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.contratos ? (
                        <Badge variant="outline">{item.contratos.codigo}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.ativo ? "default" : "secondary"}>
                        {item.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCoordForVinculo(item);
                            setVinculoDialogOpen(true);
                          }}
                          title="Vincular Equipe"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setItemToDelete(item);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {sortedData && sortedData.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
              Mostrando {sortedData.length} de {coordenadores.length} registros
            </div>
          )}
        </div>

        {/* Dialog de Criar/Editar */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Editar" : "Novo"}{" "}
                {formData.tipo === "coordenador" ? "Coordenador" : "Supervisor"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input
                    value={formData.codigo}
                    onChange={(e) =>
                      setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                    }
                    placeholder="Ex: COORD-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(v: "coordenador" | "supervisor") =>
                      setFormData({ ...formData, tipo: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coordenador">Coordenador</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-2">
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

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
                />
                <Label>Ativo</Label>
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

        {/* Dialog de Vincular Equipe */}
        <Dialog open={vinculoDialogOpen} onOpenChange={setVinculoDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Vincular Equipe</DialogTitle>
              <DialogDescription>
                Vincular equipe ao{" "}
                {selectedCoordForVinculo?.tipo === "coordenador"
                  ? "coordenador"
                  : "supervisor"}{" "}
                <strong>{selectedCoordForVinculo?.nome}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Equipe *</Label>
                <Select
                  value={vinculoEquipeId}
                  onValueChange={setVinculoEquipeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipes.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.codigo} - {eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={vinculoDataInicio}
                  onChange={(e) => setVinculoDataInicio(e.target.value)}
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                <History className="h-4 w-4 inline mr-2" />
                O vínculo anterior da equipe (se houver) será encerrado automaticamente
                na data informada.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setVinculoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleVincularEquipe} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Vincular
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
                Tem certeza que deseja excluir o{" "}
                {itemToDelete?.tipo === "coordenador" ? "coordenador" : "supervisor"}{" "}
                <strong>{itemToDelete?.nome}</strong>?
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

