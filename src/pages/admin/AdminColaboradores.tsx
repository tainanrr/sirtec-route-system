import { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  UserPlus,
  Phone,
  Mail,
  Briefcase,
  Calendar,
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
import { format } from "date-fns";

interface Colaborador {
  id: string;
  cpf: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cargo: string | null;
  data_admissao: string | null;
  data_demissao: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  // Equipes vinculadas
  equipe_colaboradores?: {
    id: string;
    equipe_id: string;
    funcao: string;
    ativo: boolean;
    tecnicos: { codigo: string; nome: string } | null;
  }[];
}

const cargoOptions = [
  { value: "eletricista", label: "Eletricista" },
  { value: "ajudante", label: "Ajudante" },
  { value: "motorista", label: "Motorista" },
  { value: "lider", label: "Líder de Equipe" },
  { value: "supervisor", label: "Supervisor" },
  { value: "tecnico", label: "Técnico" },
];

// Função para formatar CPF
const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9)
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
};

// Validar CPF
const validateCPF = (cpf: string): boolean => {
  const numbers = cpf.replace(/\D/g, "");
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[10])) return false;

  return true;
};

export default function AdminColaboradores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null);
  const [colaboradorToDelete, setColaboradorToDelete] = useState<Colaborador | null>(null);
  const [saving, setSaving] = useState(false);

  // Configuração dos filtros
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "search",
        label: "Buscar",
        type: "text",
        placeholder: "Buscar por CPF, nome ou cargo...",
      },
      {
        id: "cargo",
        label: "Cargo",
        type: "select",
        options: cargoOptions,
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
    ],
    []
  );

  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  // Form state
  const [formData, setFormData] = useState({
    cpf: "",
    nome: "",
    telefone: "",
    email: "",
    cargo: "",
    data_admissao: "",
    observacoes: "",
    ativo: true,
  });

  const [cpfError, setCpfError] = useState("");

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("colaboradores")
        .select(`
          *,
          equipe_colaboradores (
            id,
            equipe_id,
            funcao,
            ativo,
            tecnicos (codigo, nome)
          )
        `)
        .order("nome", { ascending: true });

      if (error) throw error;
      setColaboradores(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar colaboradores:", error);
      toast.error("Erro ao carregar colaboradores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrar dados
  const filteredColaboradores = useMemo(() => {
    return filterData(colaboradores, filterValues, filterConfigs, {
      search: (item, value) => {
        const searchTerm = value.toLowerCase();
        return (
          item.cpf.toLowerCase().includes(searchTerm) ||
          item.nome.toLowerCase().includes(searchTerm) ||
          item.cargo?.toLowerCase().includes(searchTerm) ||
          false
        );
      },
      status: (item, value) => {
        if (value === "ativo") return item.ativo;
        if (value === "inativo") return !item.ativo;
        return true;
      },
    });
  }, [colaboradores, filterValues, filterConfigs]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(filteredColaboradores, {
    column: "nome",
    direction: "asc",
  });

  // Handlers
  const handleCreate = () => {
    setEditingColaborador(null);
    setFormData({
      cpf: "",
      nome: "",
      telefone: "",
      email: "",
      cargo: "",
      data_admissao: "",
      observacoes: "",
      ativo: true,
    });
    setCpfError("");
    setDialogOpen(true);
  };

  const handleEdit = (colaborador: Colaborador) => {
    setEditingColaborador(colaborador);
    setFormData({
      cpf: colaborador.cpf,
      nome: colaborador.nome,
      telefone: colaborador.telefone || "",
      email: colaborador.email || "",
      cargo: colaborador.cargo || "",
      data_admissao: colaborador.data_admissao || "",
      observacoes: colaborador.observacoes || "",
      ativo: colaborador.ativo,
    });
    setCpfError("");
    setDialogOpen(true);
  };

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    setFormData({ ...formData, cpf: formatted });

    if (formatted.length === 14) {
      if (!validateCPF(formatted)) {
        setCpfError("CPF inválido");
      } else {
        setCpfError("");
      }
    } else {
      setCpfError("");
    }
  };

  const handleSave = async () => {
    if (!formData.cpf || !formData.nome) {
      toast.error("CPF e nome são obrigatórios");
      return;
    }

    if (!validateCPF(formData.cpf)) {
      toast.error("CPF inválido");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        cpf: formData.cpf,
        nome: formData.nome.toUpperCase(),
        telefone: formData.telefone || null,
        email: formData.email || null,
        cargo: formData.cargo || null,
        data_admissao: formData.data_admissao || null,
        observacoes: formData.observacoes || null,
        ativo: formData.ativo,
        updated_at: new Date().toISOString(),
      };

      if (editingColaborador) {
        const { error } = await supabase
          .from("colaboradores")
          .update(payload)
          .eq("id", editingColaborador.id);

        if (error) throw error;
        toast.success("Colaborador atualizado com sucesso");
      } else {
        const { error } = await supabase.from("colaboradores").insert(payload);

        if (error) {
          if (error.code === "23505") {
            toast.error("Já existe um colaborador com este CPF");
            return;
          }
          throw error;
        }
        toast.success("Colaborador cadastrado com sucesso");
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
    if (!colaboradorToDelete) return;

    try {
      const { error } = await supabase
        .from("colaboradores")
        .delete()
        .eq("id", colaboradorToDelete.id);

      if (error) throw error;
      toast.success("Colaborador excluído com sucesso");
      setDeleteDialogOpen(false);
      setColaboradorToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  // Obter equipes do colaborador
  const getEquipesColaborador = (colaborador: Colaborador) => {
    const equipes = colaborador.equipe_colaboradores?.filter((ec) => ec.ativo) || [];
    return equipes;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Colaboradores</h2>
          <p className="text-muted-foreground">
            Cadastro de colaboradores (usuários do aplicativo de campo)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Colaborador
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <UserPlus className="h-5 w-5 text-blue-600 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900">Colaboradores do App</p>
          <p className="text-sm text-blue-700">
            Cada colaborador é identificado pelo CPF. Vincule-os às equipes para que
            apareçam na abertura de turno do aplicativo.
          </p>
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

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{colaboradores.length}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm">Ativos</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {colaboradores.filter((c) => c.ativo).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-blue-600">
            <Briefcase className="h-4 w-4" />
            <span className="text-sm">Eletricistas</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {colaboradores.filter((c) => c.cargo === "eletricista").length}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-amber-600">
            <Users className="h-4 w-4" />
            <span className="text-sm">Ajudantes</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {colaboradores.filter((c) => c.cargo === "ajudante").length}
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="cpf"
                label="CPF"
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
                column="cargo"
                label="Cargo"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <TableHead>Contato</TableHead>
              <TableHead>Equipes</TableHead>
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
                  <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? "Nenhum colaborador encontrado com os filtros aplicados"
                      : "Nenhum colaborador cadastrado"}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                      Limpar filtros
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedData?.map((colaborador) => {
                const equipes = getEquipesColaborador(colaborador);
                return (
                  <TableRow key={colaborador.id} className="group">
                    <TableCell className="font-mono text-sm">{colaborador.cpf}</TableCell>
                    <TableCell className="font-medium">{colaborador.nome}</TableCell>
                    <TableCell>
                      {colaborador.cargo ? (
                        <Badge variant="outline">
                          {cargoOptions.find((c) => c.value === colaborador.cargo)?.label ||
                            colaborador.cargo}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                        {colaborador.telefone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {colaborador.telefone}
                          </span>
                        )}
                        {colaborador.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {colaborador.email}
                          </span>
                        )}
                        {!colaborador.telefone && !colaborador.email && "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {equipes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {equipes.slice(0, 2).map((ec) => (
                            <Badge key={ec.id} variant="secondary" className="text-xs">
                              {ec.tecnicos?.codigo}
                            </Badge>
                          ))}
                          {equipes.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{equipes.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sem equipe</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={colaborador.ativo ? "default" : "secondary"}>
                        {colaborador.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(colaborador)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setColaboradorToDelete(colaborador);
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
            Mostrando {sortedData.length} de {colaboradores.length} colaboradores
          </div>
        )}
      </div>

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingColaborador ? "Editar Colaborador" : "Novo Colaborador"}
            </DialogTitle>
            <DialogDescription>
              {editingColaborador
                ? "Atualize os dados do colaborador"
                : "Preencha os dados do novo colaborador"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => handleCPFChange(e.target.value)}
                  placeholder="000.000.000-00"
                  className={cpfError ? "border-red-500" : ""}
                  disabled={!!editingColaborador}
                />
                {cpfError && <p className="text-xs text-red-500">{cpfError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo</Label>
                <Select
                  value={formData.cargo}
                  onValueChange={(value) => setFormData({ ...formData, cargo: value })}
                >
                  <SelectTrigger id="cargo">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cargoOptions.map((cargo) => (
                      <SelectItem key={cargo.value} value={cargo.value}>
                        {cargo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome completo do colaborador"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_admissao">Data de Admissão</Label>
              <Input
                id="data_admissao"
                type="date"
                value={formData.data_admissao}
                onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre o colaborador..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <Label>Colaborador Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Colaboradores inativos não aparecem na abertura de turno
                </p>
              </div>
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
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
              Tem certeza que deseja excluir o colaborador{" "}
              <strong>{colaboradorToDelete?.nome}</strong> (CPF: {colaboradorToDelete?.cpf})?
              <br />
              <span className="text-amber-600">
                Esta ação também removerá os vínculos com equipes.
              </span>
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
  );
}

