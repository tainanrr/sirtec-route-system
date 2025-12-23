import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Shield,
  Building2,
  Mail,
  Eye,
  EyeOff,
  Key,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";

interface UsuarioWeb {
  id: string;
  auth_user_id: string | null;
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  departamento: string | null;
  centro_custo: string | null;
  perfil_id: string | null;
  ativo: boolean;
  ultimo_acesso: string | null;
  senha_hash: string | null;
  created_at: string;
  perfis_permissao?: {
    nome: string;
    is_admin: boolean;
  } | null;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

interface Perfil {
  id: string;
  nome: string;
  is_admin: boolean;
}

export default function AdminUsuariosWeb() {
  const [usuarios, setUsuarios] = useState<UsuarioWeb[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<UsuarioWeb | null>(null);
  const [usuarioToDelete, setUsuarioToDelete] = useState<UsuarioWeb | null>(null);
  const [saving, setSaving] = useState(false);
  const [usuarioContratos, setUsuarioContratos] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  // Configuração dos filtros
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por nome, email ou cargo...",
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
    {
      id: "perfil_id",
      label: "Perfil",
      type: "select",
      options: perfis.map((p) => ({
        value: p.id,
        label: p.nome,
        color: p.is_admin ? "bg-amber-500" : "bg-blue-500",
      })),
    },
  ], [perfis]);

  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    cargo: "",
    departamento: "",
    centro_custo: "",
    perfil_id: "",
    ativo: true,
    senha: "",
  });

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: usuariosData, error: usuariosError } = await supabase
        .from("usuarios_web")
        .select(`
          *,
          perfis_permissao (
            nome,
            is_admin
          )
        `)
        .order("nome", { ascending: true });

      if (usuariosError) throw usuariosError;
      setUsuarios(usuariosData || []);

      const { data: contratosData } = await supabase
        .from("contratos")
        .select("id, codigo, nome")
        .eq("status", "ativo")
        .order("codigo");
      setContratos(contratosData || []);

      const { data: perfisData } = await supabase
        .from("perfis_permissao")
        .select("id, nome, is_admin")
        .eq("ativo", true)
        .order("nome");
      setPerfis(perfisData || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarioContratos = async (usuarioId: string) => {
    const { data } = await supabase
      .from("usuario_contratos")
      .select("contrato_id")
      .eq("usuario_web_id", usuarioId);

    return data?.map((uc) => uc.contrato_id) || [];
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrar dados
  const filteredUsuarios = useMemo(() => {
    return filterData(
      usuarios,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.nome.toLowerCase().includes(searchTerm) ||
            item.email.toLowerCase().includes(searchTerm) ||
            item.cargo?.toLowerCase().includes(searchTerm) ||
            item.centro_custo?.toLowerCase().includes(searchTerm) ||
            false
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
      }
    );
  }, [usuarios, filterValues, filterConfigs]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredUsuarios,
    { column: "nome", direction: "asc" }
  );

  const handleCreate = () => {
    setEditingUsuario(null);
    setFormData({
      nome: "",
      email: "",
      telefone: "",
      cargo: "",
      departamento: "",
      centro_custo: "",
      perfil_id: "",
      ativo: true,
      senha: "",
    });
    setUsuarioContratos([]);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleEdit = async (usuario: UsuarioWeb) => {
    setEditingUsuario(usuario);
    setFormData({
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone || "",
      cargo: usuario.cargo || "",
      departamento: usuario.departamento || "",
      centro_custo: usuario.centro_custo || "",
      perfil_id: usuario.perfil_id || "",
      ativo: usuario.ativo,
      senha: "", // Não carrega a senha
    });

    const contratosUsuario = await fetchUsuarioContratos(usuario.id);
    setUsuarioContratos(contratosUsuario);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.email) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    // Se for novo usuário, exigir senha
    if (!editingUsuario && !formData.senha) {
      toast.error("A senha é obrigatória para novos usuários");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone || null,
        cargo: formData.cargo || null,
        departamento: formData.departamento || null,
        centro_custo: formData.centro_custo || null,
        perfil_id: formData.perfil_id || null,
        ativo: formData.ativo,
      };

      // Só atualiza senha se foi preenchida
      if (formData.senha) {
        payload.senha_hash = formData.senha;
      }

      let usuarioId: string;

      if (editingUsuario) {
        const { error } = await supabase
          .from("usuarios_web")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingUsuario.id);

        if (error) throw error;
        usuarioId = editingUsuario.id;
        toast.success("Usuário atualizado com sucesso");
      } else {
        const { data, error } = await supabase
          .from("usuarios_web")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        usuarioId = data.id;
        toast.success("Usuário criado com sucesso");
      }

      await supabase
        .from("usuario_contratos")
        .delete()
        .eq("usuario_web_id", usuarioId);

      if (usuarioContratos.length > 0) {
        const contratosInsert = usuarioContratos.map((contratoId, index) => ({
          usuario_web_id: usuarioId,
          contrato_id: contratoId,
          is_padrao: index === 0,
        }));

        const { error: contratosError } = await supabase
          .from("usuario_contratos")
          .insert(contratosInsert);

        if (contratosError) {
          console.error("Erro ao salvar contratos:", contratosError);
        }
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar usuário:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!usuarioToDelete) return;

    try {
      const { error } = await supabase
        .from("usuarios_web")
        .delete()
        .eq("id", usuarioToDelete.id);

      if (error) throw error;

      toast.success("Usuário excluído com sucesso");
      setDeleteDialogOpen(false);
      setUsuarioToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir usuário:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const toggleContrato = (contratoId: string) => {
    setUsuarioContratos((prev) =>
      prev.includes(contratoId)
        ? prev.filter((id) => id !== contratoId)
        : [...prev, contratoId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usuários Web</h2>
          <p className="text-muted-foreground">
            Gerencie os usuários do sistema web e seus acessos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
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

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{usuarios.length}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm">Ativos</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {usuarios.filter((u) => u.ativo).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-amber-600">
            <Shield className="h-4 w-4" />
            <span className="text-sm">Admins</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {usuarios.filter((u) => u.perfis_permissao?.is_admin).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-sm">Inativos</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {usuarios.filter((u) => !u.ativo).length}
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="nome"
                label="Usuário"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="cargo"
                label="Cargo"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="centro_custo"
                label="Centro de Custo"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="telefone"
                label="Telefone"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="perfis_permissao.nome"
                label="Perfil"
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
                  <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? "Nenhum usuário encontrado com os filtros aplicados"
                      : "Nenhum usuário cadastrado"}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                      Limpar filtros
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedData?.map((usuario) => (
                <TableRow key={usuario.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {usuario.nome
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{usuario.nome}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {usuario.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {usuario.cargo ? (
                      <span className="text-sm">{usuario.cargo}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {usuario.centro_custo ? (
                      <Badge variant="outline">{usuario.centro_custo}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {usuario.telefone ? (
                      <span className="text-sm flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {usuario.telefone}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {usuario.perfis_permissao ? (
                      <Badge
                        variant={usuario.perfis_permissao.is_admin ? "default" : "secondary"}
                        className="flex items-center gap-1 w-fit"
                      >
                        {usuario.perfis_permissao.is_admin && (
                          <Shield className="h-3 w-3" />
                        )}
                        {usuario.perfis_permissao.nome}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sem perfil</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={usuario.ativo ? "default" : "secondary"}>
                      {usuario.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(usuario)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUsuarioToDelete(usuario);
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
            Mostrando {sortedData.length} de {usuarios.length} usuários
          </div>
        )}
      </div>

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUsuario ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
            <DialogDescription>
              {editingUsuario
                ? "Atualize as informações do usuário"
                : "Preencha os dados para criar um novo usuário"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="acesso">Acesso</TabsTrigger>
              <TabsTrigger value="contratos">Contratos</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="nome">
                    Nome Completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    placeholder="Nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    E-mail <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) =>
                      setFormData({ ...formData, telefone: e.target.value })
                    }
                    placeholder="00 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    value={formData.cargo}
                    onChange={(e) =>
                      setFormData({ ...formData, cargo: e.target.value })
                    }
                    placeholder="Ex: ANALISTA DE PCP I"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="centro_custo">Centro de Custo</Label>
                  <Input
                    id="centro_custo"
                    value={formData.centro_custo}
                    onChange={(e) =>
                      setFormData({ ...formData, centro_custo: e.target.value })
                    }
                    placeholder="Ex: PCP PLA STC"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="departamento">Departamento</Label>
                  <Input
                    id="departamento"
                    value={formData.departamento}
                    onChange={(e) =>
                      setFormData({ ...formData, departamento: e.target.value })
                    }
                    placeholder="Ex: Operações, TI..."
                  />
                </div>

                <div className="flex items-center justify-between col-span-2 p-3 rounded-lg border border-border">
                  <div>
                    <Label>Usuário Ativo</Label>
                    <p className="text-xs text-muted-foreground">
                      Usuários inativos não podem acessar o sistema
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
            </TabsContent>

            <TabsContent value="acesso" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="perfil">Perfil de Acesso</Label>
                  <Select
                    value={formData.perfil_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, perfil_id: value })
                    }
                  >
                    <SelectTrigger id="perfil">
                      <SelectValue placeholder="Selecione um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {perfis.map((perfil) => (
                        <SelectItem key={perfil.id} value={perfil.id}>
                          <div className="flex items-center gap-2">
                            {perfil.is_admin && <Shield className="h-3 w-3" />}
                            {perfil.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha">
                    {editingUsuario ? "Nova Senha" : "Senha"}{" "}
                    {!editingUsuario && <span className="text-destructive">*</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showPassword ? "text" : "password"}
                      value={formData.senha}
                      onChange={(e) =>
                        setFormData({ ...formData, senha: e.target.value })
                      }
                      placeholder={editingUsuario ? "Deixe em branco para manter" : "Digite a senha"}
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
                  {editingUsuario && (
                    <p className="text-xs text-muted-foreground">
                      Deixe em branco para manter a senha atual
                    </p>
                  )}
                </div>

                {editingUsuario?.senha_hash && (
                  <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Este usuário já possui uma senha configurada
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contratos" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Contratos Permitidos</Label>
                    <p className="text-xs text-muted-foreground">
                      Selecione os contratos que este usuário poderá acessar
                    </p>
                  </div>
                  {contratos.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setUsuarioContratos(contratos.map((c) => c.id))}
                      >
                        Marcar Todos
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setUsuarioContratos([])}
                      >
                        Desmarcar Todos
                      </Button>
                    </div>
                  )}
                </div>
                {contratos.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {usuarioContratos.length} de {contratos.length} selecionado(s)
                  </p>
                )}
                <div className="border border-border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {contratos.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Building2 className="h-6 w-6 mx-auto mb-2" />
                      <p className="text-sm">Nenhum contrato cadastrado</p>
                    </div>
                  ) : (
                    contratos.map((contrato) => (
                      <div
                        key={contrato.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleContrato(contrato.id)}
                      >
                        <Checkbox
                          checked={usuarioContratos.includes(contrato.id)}
                          onCheckedChange={() => toggleContrato(contrato.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{contrato.codigo}</p>
                          <p className="text-xs text-muted-foreground">
                            {contrato.nome}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingUsuario ? "Salvar Alterações" : "Criar Usuário"}
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
              Tem certeza que deseja excluir o usuário{" "}
              <strong>{usuarioToDelete?.nome}</strong>?
              <br />
              Esta ação não pode ser desfeita.
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
