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
import {
  UserCog,
  Pencil,
  RefreshCcw,
  Loader2,
  Smartphone,
  Key,
  Eye,
  EyeOff,
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
import { ExportButton } from "@/components/ui/export-button";

interface EquipeUsuario {
  id: string;
  codigo: string;
  nome: string;
  usuario: string | null;
  senha_hash: string | null;
  ativo: boolean;
  contrato_id: string | null;
  contratos?: { codigo: string; nome: string } | null;
}

export default function AdminUsuariosApp() {
  const [equipes, setEquipes] = useState<EquipeUsuario[]>([]);
  const [contratos, setContratos] = useState<{ id: string; codigo: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEquipe, setEditingEquipe] = useState<EquipeUsuario | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Configuração dos filtros
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por código, nome ou usuário...",
    },
    {
      id: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "ativo", label: "Ativos", color: "bg-green-500" },
        { value: "inativo", label: "Inativos", color: "bg-gray-500" },
        { value: "com_usuario", label: "Com usuário", color: "bg-blue-500" },
        { value: "sem_usuario", label: "Sem usuário", color: "bg-amber-500" },
      ],
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
    usuario: "",
    senha: "",
    contrato_id: "nenhum",
    ativo: true,
  });

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tecnicos")
        .select(`
          id, codigo, nome, usuario, senha_hash, ativo, contrato_id,
          contratos (codigo, nome)
        `)
        .order("codigo", { ascending: true });

      if (error) throw error;
      setEquipes(data || []);

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
  const filteredEquipes = useMemo(() => {
    return filterData(
      equipes,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm) ||
            item.usuario?.toLowerCase().includes(searchTerm) || false
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          if (value === "com_usuario") return !!item.usuario;
          if (value === "sem_usuario") return !item.usuario;
          return true;
        },
      }
    );
  }, [equipes, filterValues, filterConfigs]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredEquipes,
    { column: "codigo", direction: "asc" }
  );

  const handleEdit = (equipe: EquipeUsuario) => {
    setEditingEquipe(equipe);
    setFormData({
      usuario: equipe.usuario || "",
      senha: "",
      contrato_id: equipe.contrato_id || "nenhum",
      ativo: equipe.ativo,
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingEquipe) return;

    setSaving(true);
    try {
      const payload: any = {
        usuario: formData.usuario || null,
        contrato_id: formData.contrato_id && formData.contrato_id !== "nenhum" ? formData.contrato_id : null,
        ativo: formData.ativo,
      };

      if (formData.senha) {
        payload.senha_hash = formData.senha;
      }

      const { error } = await supabase
        .from("tecnicos")
        .update(payload)
        .eq("id", editingEquipe.id);

      if (error) throw error;

      toast.success("Usuário atualizado com sucesso");
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usuários App</h2>
          <p className="text-muted-foreground">
            Configure os usuários do aplicativo móvel (equipes de campo)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={equipes}
            filename="usuarios_app"
            columns={[
              { key: "codigo", label: "Código" },
              { key: "nome", label: "Nome" },
              { key: "usuario", label: "Usuário" },
              { key: "contratos.codigo", label: "Contrato" },
              { key: "ativo", label: "Ativo", format: (v) => v ? "Sim" : "Não" },
            ]}
            disabled={loading}
          />
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <Smartphone className="h-5 w-5 text-blue-600 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900">Usuários do Aplicativo</p>
          <p className="text-sm text-blue-700">
            Os usuários do app são vinculados às equipes. Configure aqui o login, 
            senha e contrato de cada equipe para acesso ao aplicativo de campo.
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
            <UserCog className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{equipes.length}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-blue-600">
            <Key className="h-4 w-4" />
            <span className="text-sm">Com usuário</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {equipes.filter((e) => e.usuario).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm">Ativos</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {equipes.filter((e) => e.ativo).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-amber-600">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm">Sem usuário</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {equipes.filter((e) => !e.usuario).length}
          </p>
        </div>
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
                label="Nome da Equipe"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="usuario"
                label="Usuário App"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <TableHead>Senha</TableHead>
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
                  <UserCog className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? "Nenhuma equipe encontrada com os filtros aplicados"
                      : "Nenhuma equipe cadastrada"}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                      Limpar filtros
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedData?.map((equipe) => (
                <TableRow key={equipe.id} className="group">
                  <TableCell className="font-mono font-medium">
                    {equipe.codigo}
                  </TableCell>
                  <TableCell className="font-medium">{equipe.nome}</TableCell>
                  <TableCell>
                    {equipe.usuario ? (
                      <span className="font-mono text-sm">{equipe.usuario}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {equipe.senha_hash ? (
                      <Badge variant="outline" className="text-xs">
                        <Key className="h-3 w-3 mr-1" />
                        Configurada
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {equipe.contratos ? (
                      <Badge variant="secondary">
                        {equipe.contratos.codigo}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={equipe.ativo ? "default" : "secondary"}>
                      {equipe.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(equipe)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {sortedData && sortedData.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
            Mostrando {sortedData.length} de {equipes.length} equipes
          </div>
        )}
      </div>

      {/* Dialog de Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Usuário App</DialogTitle>
            <DialogDescription>
              Configure o acesso ao aplicativo para a equipe{" "}
              <strong>{editingEquipe?.codigo} - {editingEquipe?.nome}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="usuario">Usuário</Label>
              <Input
                id="usuario"
                value={formData.usuario}
                onChange={(e) =>
                  setFormData({ ...formData, usuario: e.target.value })
                }
                placeholder="Nome de usuário para login"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">
                {editingEquipe?.senha_hash ? "Nova Senha (deixe em branco para manter)" : "Senha"}
              </Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  value={formData.senha}
                  onChange={(e) =>
                    setFormData({ ...formData, senha: e.target.value })
                  }
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrato">Contrato</Label>
              <Select
                value={formData.contrato_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, contrato_id: value })
                }
              >
                <SelectTrigger id="contrato">
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {contratos.map((contrato) => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.codigo} - {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <Label>Usuário Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Usuários inativos não podem acessar o app
                </p>
              </div>
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, ativo: checked })
                }
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
    </div>
  );
}

