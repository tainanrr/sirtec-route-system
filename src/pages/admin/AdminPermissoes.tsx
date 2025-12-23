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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lock,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Shield,
  Users,
  Key,
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

interface Permissao {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  modulo: string;
  ativo: boolean;
  created_at: string;
}

interface PerfilPermissao {
  id: string;
  nome: string;
  descricao: string | null;
  is_admin: boolean;
  ativo: boolean;
  created_at: string;
}

interface PerfilPermissaoLink {
  perfil_id: string;
  permissao_id: string;
}

const moduloOptions = [
  { value: "admin", label: "Admin" },
  { value: "roteirizacao", label: "Roteirização" },
  { value: "cadastros", label: "Cadastros" },
  { value: "materiais", label: "Materiais" },
  { value: "ordens", label: "Ordens" },
  { value: "planejamento", label: "Planejamento" },
  { value: "relatorios", label: "Relatórios" },
];

export default function AdminPermissoes() {
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [perfis, setPerfis] = useState<PerfilPermissao[]>([]);
  const [perfilPermissoes, setPerfilPermissoes] = useState<PerfilPermissaoLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissaoDialogOpen, setPermissaoDialogOpen] = useState(false);
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPermissao, setEditingPermissao] = useState<Permissao | null>(null);
  const [editingPerfil, setEditingPerfil] = useState<PerfilPermissao | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ type: "permissao" | "perfil"; item: any } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPerfilId, setSelectedPerfilId] = useState<string | null>(null);

  // Configuração dos filtros para permissões
  const permissaoFilterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por código, nome ou descrição...",
    },
    {
      id: "modulo",
      label: "Módulo",
      type: "select",
      options: moduloOptions,
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
    useDataTableFilters(permissaoFilterConfigs);

  // Form state para permissão
  const [permissaoForm, setPermissaoForm] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    modulo: "admin",
    ativo: true,
  });

  // Form state para perfil
  const [perfilForm, setPerfilForm] = useState({
    nome: "",
    descricao: "",
    is_admin: false,
    ativo: true,
    permissoes_ids: [] as string[],
  });

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const [permissoesRes, perfisRes, perfilPermissoesRes] = await Promise.all([
        supabase.from("permissoes").select("*").order("modulo").order("nome"),
        supabase.from("perfis_permissao").select("*").order("nome"),
        supabase.from("perfil_permissoes").select("perfil_id, permissao_id"),
      ]);

      if (permissoesRes.error) throw permissoesRes.error;
      if (perfisRes.error) throw perfisRes.error;
      if (perfilPermissoesRes.error) throw perfilPermissoesRes.error;

      setPermissoes(permissoesRes.data || []);
      setPerfis(perfisRes.data || []);
      setPerfilPermissoes(perfilPermissoesRes.data || []);
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

  // Filtrar permissões
  const filteredPermissoes = useMemo(() => {
    return filterData(
      permissoes,
      filterValues,
      permissaoFilterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm) ||
            item.descricao?.toLowerCase().includes(searchTerm) || false
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
      }
    );
  }, [permissoes, filterValues, permissaoFilterConfigs]);

  // Ordenação de permissões
  const { sortConfig: permissaoSortConfig, handleSort: handlePermissaoSort, sortedData: sortedPermissoes } =
    useSortableTable(filteredPermissoes, { column: "modulo", direction: "asc" });

  // Ordenação de perfis
  const { sortConfig: perfilSortConfig, handleSort: handlePerfilSort, sortedData: sortedPerfis } =
    useSortableTable(perfis, { column: "nome", direction: "asc" });

  // Obter permissões de um perfil
  const getPerfilPermissoes = (perfilId: string) => {
    return perfilPermissoes
      .filter((pp) => pp.perfil_id === perfilId)
      .map((pp) => pp.permissao_id);
  };

  // Handlers para Permissão
  const handleCreatePermissao = () => {
    setEditingPermissao(null);
    setPermissaoForm({
      codigo: "",
      nome: "",
      descricao: "",
      modulo: "admin",
      ativo: true,
    });
    setPermissaoDialogOpen(true);
  };

  const handleEditPermissao = (permissao: Permissao) => {
    setEditingPermissao(permissao);
    setPermissaoForm({
      codigo: permissao.codigo,
      nome: permissao.nome,
      descricao: permissao.descricao || "",
      modulo: permissao.modulo,
      ativo: permissao.ativo,
    });
    setPermissaoDialogOpen(true);
  };

  const handleSavePermissao = async () => {
    if (!permissaoForm.codigo || !permissaoForm.nome) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: permissaoForm.codigo,
        nome: permissaoForm.nome,
        descricao: permissaoForm.descricao || null,
        modulo: permissaoForm.modulo,
        ativo: permissaoForm.ativo,
      };

      if (editingPermissao) {
        const { error } = await supabase
          .from("permissoes")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingPermissao.id);

        if (error) throw error;
        toast.success("Permissão atualizada com sucesso");
      } else {
        const { error } = await supabase.from("permissoes").insert(payload);

        if (error) throw error;
        toast.success("Permissão criada com sucesso");
      }

      setPermissaoDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handlers para Perfil
  const handleCreatePerfil = () => {
    setEditingPerfil(null);
    setPerfilForm({
      nome: "",
      descricao: "",
      is_admin: false,
      ativo: true,
      permissoes_ids: [],
    });
    setPerfilDialogOpen(true);
  };

  const handleEditPerfil = (perfil: PerfilPermissao) => {
    setEditingPerfil(perfil);
    const perfilPerms = getPerfilPermissoes(perfil.id);
    setPerfilForm({
      nome: perfil.nome,
      descricao: perfil.descricao || "",
      is_admin: perfil.is_admin,
      ativo: perfil.ativo,
      permissoes_ids: perfilPerms,
    });
    setPerfilDialogOpen(true);
  };

  const handleSavePerfil = async () => {
    if (!perfilForm.nome) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: perfilForm.nome,
        descricao: perfilForm.descricao || null,
        is_admin: perfilForm.is_admin,
        ativo: perfilForm.ativo,
      };

      let perfilId: string;

      if (editingPerfil) {
        const { error } = await supabase
          .from("perfis_permissao")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingPerfil.id);

        if (error) throw error;
        perfilId = editingPerfil.id;
        toast.success("Perfil atualizado com sucesso");
      } else {
        const { data, error } = await supabase
          .from("perfis_permissao")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        perfilId = data.id;
        toast.success("Perfil criado com sucesso");
      }

      // Atualizar permissões do perfil
      console.log("[AdminPermissoes] Deletando permissões antigas do perfil:", perfilId);
      const { error: deleteError } = await supabase
        .from("perfil_permissoes")
        .delete()
        .eq("perfil_id", perfilId);

      if (deleteError) {
        console.error("[AdminPermissoes] Erro ao deletar permissões antigas:", deleteError);
        toast.error(`Erro ao atualizar permissões: ${deleteError.message}`);
        return;
      }

      console.log("[AdminPermissoes] Inserindo novas permissões:", perfilForm.permissoes_ids);
      if (perfilForm.permissoes_ids.length > 0) {
        const permsToInsert = perfilForm.permissoes_ids.map((permId) => ({
          perfil_id: perfilId,
          permissao_id: permId,
        }));

        const { error: permsError } = await supabase
          .from("perfil_permissoes")
          .insert(permsToInsert);

        if (permsError) {
          console.error("[AdminPermissoes] Erro ao inserir permissões:", permsError);
          toast.error(`Erro ao salvar permissões: ${permsError.message}`);
          return;
        }
        
        console.log("[AdminPermissoes] Permissões salvas com sucesso!");
      }

      setPerfilDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handler para exclusão
  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === "permissao") {
        const { error } = await supabase
          .from("permissoes")
          .delete()
          .eq("id", itemToDelete.item.id);

        if (error) throw error;
        toast.success("Permissão excluída com sucesso");
      } else {
        const { error } = await supabase
          .from("perfis_permissao")
          .delete()
          .eq("id", itemToDelete.item.id);

        if (error) throw error;
        toast.success("Perfil excluído com sucesso");
      }

      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const togglePermissaoInPerfil = (permissaoId: string) => {
    setPerfilForm((prev) => ({
      ...prev,
      permissoes_ids: prev.permissoes_ids.includes(permissaoId)
        ? prev.permissoes_ids.filter((id) => id !== permissaoId)
        : [...prev.permissoes_ids, permissaoId],
    }));
  };

  // Agrupar permissões por módulo
  const permissoesPorModulo = useMemo(() => {
    const grupos: Record<string, Permissao[]> = {};
    permissoes.forEach((p) => {
      if (!grupos[p.modulo]) grupos[p.modulo] = [];
      grupos[p.modulo].push(p);
    });
    return grupos;
  }, [permissoes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Permissões e Perfis</h2>
          <p className="text-muted-foreground">
            Gerencie as permissões do sistema e perfis de acesso
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="perfis" className="w-full">
        <TabsList>
          <TabsTrigger value="perfis" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Perfis de Acesso
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Permissões do Sistema
          </TabsTrigger>
        </TabsList>

        {/* Tab de Perfis */}
        <TabsContent value="perfis" className="space-y-4 mt-6">
          <div className="flex justify-end">
            <Button onClick={handleCreatePerfil}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Perfil
            </Button>
          </div>

          {/* Estatísticas de perfis */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span className="text-sm">Total Perfis</span>
              </div>
              <p className="text-2xl font-bold mt-1">{perfis.length}</p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 text-amber-600">
                <Shield className="h-4 w-4" />
                <span className="text-sm">Administradores</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {perfis.filter((p) => p.is_admin).length}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm">Ativos</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {perfis.filter((p) => p.ativo).length}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Key className="h-4 w-4" />
                <span className="text-sm">Total Permissões</span>
              </div>
              <p className="text-2xl font-bold mt-1">{permissoes.length}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="nome"
                    label="Nome"
                    sortConfig={perfilSortConfig}
                    onSort={handlePerfilSort}
                  />
                  <TableHead>Descrição</TableHead>
                  <SortableTableHead
                    column="is_admin"
                    label="Tipo"
                    sortConfig={perfilSortConfig}
                    onSort={handlePerfilSort}
                  />
                  <TableHead>Permissões</TableHead>
                  <SortableTableHead
                    column="ativo"
                    label="Status"
                    sortConfig={perfilSortConfig}
                    onSort={handlePerfilSort}
                  />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : sortedPerfis?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Shield className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Nenhum perfil cadastrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPerfis?.map((perfil) => {
                    const perfilPerms = getPerfilPermissoes(perfil.id);
                    return (
                      <TableRow key={perfil.id} className="group">
                        <TableCell className="font-medium">{perfil.nome}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {perfil.descricao || "-"}
                        </TableCell>
                        <TableCell>
                          {perfil.is_admin ? (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Usuário</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{perfilPerms.length} permissões</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={perfil.ativo ? "default" : "secondary"}>
                            {perfil.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPerfil(perfil)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setItemToDelete({ type: "perfil", item: perfil });
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
          </div>
        </TabsContent>

        {/* Tab de Permissões */}
        <TabsContent value="permissoes" className="space-y-4 mt-6">
          <div className="flex justify-end">
            <Button onClick={handleCreatePermissao}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Permissão
            </Button>
          </div>

          {/* Filtros */}
          <div className="rounded-xl border border-border bg-card p-4">
            <DataTableFilters
              filters={permissaoFilterConfigs}
              values={filterValues}
              onChange={setFilterValues}
              onClear={clearFilters}
            />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="codigo"
                    label="Código"
                    sortConfig={permissaoSortConfig}
                    onSort={handlePermissaoSort}
                  />
                  <SortableTableHead
                    column="nome"
                    label="Nome"
                    sortConfig={permissaoSortConfig}
                    onSort={handlePermissaoSort}
                  />
                  <SortableTableHead
                    column="modulo"
                    label="Módulo"
                    sortConfig={permissaoSortConfig}
                    onSort={handlePermissaoSort}
                  />
                  <TableHead>Descrição</TableHead>
                  <SortableTableHead
                    column="ativo"
                    label="Status"
                    sortConfig={permissaoSortConfig}
                    onSort={handlePermissaoSort}
                  />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : sortedPermissoes?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Key className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {hasActiveFilters
                          ? "Nenhuma permissão encontrada com os filtros aplicados"
                          : "Nenhuma permissão cadastrada"}
                      </p>
                      {hasActiveFilters && (
                        <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                          Limpar filtros
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPermissoes?.map((permissao) => (
                    <TableRow key={permissao.id} className="group">
                      <TableCell className="font-mono text-sm">
                        {permissao.codigo}
                      </TableCell>
                      <TableCell className="font-medium">{permissao.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {moduloOptions.find((m) => m.value === permissao.modulo)?.label ||
                            permissao.modulo}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {permissao.descricao || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={permissao.ativo ? "default" : "secondary"}>
                          {permissao.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPermissao(permissao)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setItemToDelete({ type: "permissao", item: permissao });
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

            {sortedPermissoes && sortedPermissoes.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
                Mostrando {sortedPermissoes.length} de {permissoes.length} permissões
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de Criar/Editar Permissão */}
      <Dialog open={permissaoDialogOpen} onOpenChange={setPermissaoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPermissao ? "Editar Permissão" : "Nova Permissão"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={permissaoForm.codigo}
                  onChange={(e) =>
                    setPermissaoForm({
                      ...permissaoForm,
                      codigo: e.target.value.toUpperCase().replace(/\s/g, "_"),
                    })
                  }
                  placeholder="Ex: ADMIN_USERS"
                />
              </div>
              <div className="space-y-2">
                <Label>Módulo</Label>
                <select
                  value={permissaoForm.modulo}
                  onChange={(e) =>
                    setPermissaoForm({ ...permissaoForm, modulo: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {moduloOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={permissaoForm.nome}
                onChange={(e) =>
                  setPermissaoForm({ ...permissaoForm, nome: e.target.value })
                }
                placeholder="Nome da permissão"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={permissaoForm.descricao}
                onChange={(e) =>
                  setPermissaoForm({ ...permissaoForm, descricao: e.target.value })
                }
                placeholder="Descrição da permissão..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={permissaoForm.ativo}
                onCheckedChange={(v) =>
                  setPermissaoForm({ ...permissaoForm, ativo: v })
                }
              />
              <Label>Ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissaoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissao} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Criar/Editar Perfil */}
      <Dialog open={perfilDialogOpen} onOpenChange={setPerfilDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPerfil ? "Editar Perfil" : "Novo Perfil"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={perfilForm.nome}
                  onChange={(e) =>
                    setPerfilForm({ ...perfilForm, nome: e.target.value })
                  }
                  placeholder="Nome do perfil"
                />
              </div>
              <div className="flex items-center gap-4 pt-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={perfilForm.is_admin}
                    onCheckedChange={(v) =>
                      setPerfilForm({ ...perfilForm, is_admin: v })
                    }
                  />
                  <Label>Administrador</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={perfilForm.ativo}
                    onCheckedChange={(v) =>
                      setPerfilForm({ ...perfilForm, ativo: v })
                    }
                  />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={perfilForm.descricao}
                onChange={(e) =>
                  setPerfilForm({ ...perfilForm, descricao: e.target.value })
                }
                placeholder="Descrição do perfil..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Permissões</Label>
              <p className="text-xs text-muted-foreground">
                Selecione as permissões que este perfil terá acesso
              </p>

              <div className="border rounded-lg max-h-72 overflow-y-auto">
                {Object.entries(permissoesPorModulo).map(([modulo, perms]) => (
                  <div key={modulo} className="border-b last:border-b-0">
                    <div className="px-3 py-2 bg-muted/50 font-medium text-sm">
                      {moduloOptions.find((m) => m.value === modulo)?.label || modulo}
                    </div>
                    <div className="divide-y">
                      {perms
                        .filter((p) => p.ativo)
                        .map((perm) => (
                          <div
                            key={perm.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer"
                            onClick={() => togglePermissaoInPerfil(perm.id)}
                          >
                            <Checkbox
                              checked={perfilForm.permissoes_ids.includes(perm.id)}
                              onCheckedChange={() => togglePermissaoInPerfil(perm.id)}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{perm.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {perm.codigo}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPerfilDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePerfil} disabled={saving}>
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
              Tem certeza que deseja excluir{" "}
              {itemToDelete?.type === "permissao" ? "a permissão" : "o perfil"}{" "}
              <strong>
                {itemToDelete?.type === "permissao"
                  ? itemToDelete?.item.nome
                  : itemToDelete?.item.nome}
              </strong>
              ?
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

