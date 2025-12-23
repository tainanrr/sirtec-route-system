import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTelaPermissao } from "@/hooks/usePermissoes";
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

interface CoordenadorSupervisor {
  id: string;
  codigo: string;
  nome: string;
  tipo: "coordenador" | "supervisor";
  email: string | null;
  telefone: string | null;
  contrato_id: string | null;
  usuario_web_id: string | null;
  coordenador_id: string | null;
  ativo: boolean;
  created_at: string;
  contratos?: { codigo: string; nome: string } | null;
  usuarios_web?: { id: string; nome: string; email: string; telefone: string | null; contrato_id: string | null } | null;
  coordenador?: { id: string; nome: string } | null;
}

interface UsuarioWeb {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  contrato_id: string | null;
  ativo: boolean;
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
  // Permissões da tela
  const { podeEditar, apenasLeitura } = useTelaPermissao("coordenadores");

  const [coordenadores, setCoordenadores] = useState<CoordenadorSupervisor[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [usuariosWeb, setUsuariosWeb] = useState<UsuarioWeb[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CoordenadorSupervisor | null>(null);
  const [itemToDelete, setItemToDelete] = useState<CoordenadorSupervisor | null>(null);
  const [saving, setSaving] = useState(false);

  // Configuração dos filtros
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por nome ou email...",
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
    usuario_web_id: "",
    nome: "",
    tipo: "coordenador" as "coordenador" | "supervisor",
    email: "",
    telefone: "",
    contrato_id: "",
    coordenador_id: "",
    ativo: true,
  });

  // Estado para busca de usuários web
  const [usuarioSearch, setUsuarioSearch] = useState("");

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coordenadores_supervisores")
        .select(`
          *,
          contratos (codigo, nome),
          usuarios_web (id, nome, email, telefone, contrato_id),
          coordenador:coordenadores_supervisores!coordenador_id (id, nome)
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
        .select("id, codigo, nome, supervisor_id, coordenador_id")
        .order("codigo");
      setEquipes(equipesData || []);

      // Carregar usuários web ativos
      const { data: usuariosData } = await supabase
        .from("usuarios_web")
        .select("id, nome, email, telefone, cargo, contrato_id, ativo")
        .eq("ativo", true)
        .order("nome");
      setUsuariosWeb(usuariosData || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Obter supervisores vinculados a um coordenador
  const getSupervisoresVinculados = (coordenadorId: string) => {
    return coordenadores.filter(c => c.tipo === "supervisor" && c.coordenador_id === coordenadorId);
  };

  // Obter equipes vinculadas a um supervisor
  const getEquipesVinculadas = (supervisorId: string) => {
    return equipes.filter((e: any) => e.supervisor_id === supervisorId);
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
      usuario_web_id: "",
      nome: "",
      tipo: "coordenador",
      email: "",
      telefone: "",
      contrato_id: "",
      coordenador_id: "",
      ativo: true,
    });
    setUsuarioSearch("");
    setDialogOpen(true);
  };

  const handleEdit = (item: CoordenadorSupervisor) => {
    setEditingItem(item);
    setFormData({
      usuario_web_id: item.usuario_web_id || "",
      nome: item.nome,
      tipo: item.tipo,
      email: item.email || "",
      telefone: item.telefone || "",
      contrato_id: item.contrato_id || "",
      coordenador_id: item.coordenador_id || "",
      ativo: item.ativo,
    });
    setUsuarioSearch("");
    setDialogOpen(true);
  };

  // Quando selecionar um usuário web, preencher os dados
  const handleUsuarioWebChange = (usuarioId: string) => {
    const usuario = usuariosWeb.find(u => u.id === usuarioId);
    console.log("Usuario selecionado:", usuario); // Debug
    if (usuario) {
      // Buscar contrato_id do usuário (pode estar em usuario_contratos)
      setFormData(prev => ({
        ...prev,
        usuario_web_id: usuarioId,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone || "",
        contrato_id: usuario.contrato_id || "",
      }));
      setUsuarioSearch("");
      
      // Se o usuário não tem contrato_id, tentar buscar de usuario_contratos
      if (!usuario.contrato_id) {
        supabase
          .from("usuario_contratos")
          .select("contrato_id")
          .eq("usuario_web_id", usuarioId)
          .limit(1)
          .then(({ data }) => {
            if (data && data.length > 0) {
              setFormData(prev => ({
                ...prev,
                contrato_id: data[0].contrato_id,
              }));
            }
          });
      }
    }
  };

  // Filtrar usuários web disponíveis (não vinculados a outros coordenadores/supervisores)
  const usuariosDisponiveis = useMemo(() => {
    const vinculados = coordenadores
      .filter(c => c.usuario_web_id && c.id !== editingItem?.id)
      .map(c => c.usuario_web_id);
    return usuariosWeb.filter(u => !vinculados.includes(u.id));
  }, [usuariosWeb, coordenadores, editingItem]);

  // Filtrar usuários pela busca
  const usuariosFiltrados = useMemo(() => {
    if (!usuarioSearch) return usuariosDisponiveis;
    const search = usuarioSearch.toLowerCase();
    return usuariosDisponiveis.filter(u => 
      u.nome.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search)
    );
  }, [usuariosDisponiveis, usuarioSearch]);

  // Lista de coordenadores ativos (para vincular supervisores)
  const coordenadoresAtivos = useMemo(() => {
    return coordenadores.filter(c => c.tipo === "coordenador" && c.ativo);
  }, [coordenadores]);

  const handleSave = async () => {
    if (!formData.usuario_web_id) {
      toast.error("Selecione um usuário web");
      return;
    }

    // Validar que supervisores precisam ter coordenador vinculado
    if (formData.tipo === "supervisor" && !formData.coordenador_id) {
      toast.error("Supervisor precisa estar vinculado a um coordenador");
      return;
    }

    setSaving(true);
    try {
      // Gerar código automaticamente baseado no tipo e nome
      const codigo = `${formData.tipo === "coordenador" ? "COORD" : "SUP"}-${formData.nome.split(" ")[0].toUpperCase().slice(0, 6)}`;
      
      const payload: any = {
        codigo: codigo,
        nome: formData.nome,
        tipo: formData.tipo,
        email: formData.email || null,
        telefone: formData.telefone || null,
        contrato_id: formData.contrato_id || null,
        usuario_web_id: formData.usuario_web_id,
        coordenador_id: formData.tipo === "supervisor" ? formData.coordenador_id : null,
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

      // Sincronizar contrato com o usuário web (se alterou o contrato)
      if (formData.contrato_id) {
        const usuario = usuariosWeb.find(u => u.id === formData.usuario_web_id);
        if (usuario && usuario.contrato_id !== formData.contrato_id) {
          await supabase
            .from("usuarios_web")
            .update({ contrato_id: formData.contrato_id })
            .eq("id", formData.usuario_web_id);
        }
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
      // Verificar se há OSs atendidas vinculadas a este coordenador/supervisor
      // Buscar em ordens_servico onde coordenador_id ou supervisor_id = itemToDelete.id
      const { data: osVinculadas, error: osError } = await supabase
        .from("ordens_servico")
        .select("id")
        .or(`coordenador_id.eq.${itemToDelete.id},supervisor_id.eq.${itemToDelete.id}`)
        .limit(1);

      if (osError) {
        console.error("Erro ao verificar OSs:", osError);
        // Se não conseguir verificar, apenas desativa por segurança
      }

      const temOsVinculada = osVinculadas && osVinculadas.length > 0;

      if (temOsVinculada) {
        // Apenas desativar
        const { error } = await supabase
          .from("coordenadores_supervisores")
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq("id", itemToDelete.id);

        if (error) throw error;

        toast.success("Registro desativado (possui OSs vinculadas)");
      } else {
        // Pode excluir
        const { error } = await supabase
          .from("coordenadores_supervisores")
          .delete()
          .eq("id", itemToDelete.id);

        if (error) throw error;

        toast.success("Registro excluído com sucesso");
      }

      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir/desativar:", error);
      toast.error(`Erro: ${error.message}`);
    }
  };

  return (
    <MainLayout
      title="Coordenadores e Supervisores"
      subtitle="Gerencie os coordenadores e supervisores das equipes"
      breadcrumbs={[
        { label: "Cadastros", href: "/cadastros" },
        { label: "Coordenadores e Supervisores" },
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
            <ExportButton
              data={coordenadores}
              filename="coordenadores_supervisores"
              columns={[
                { key: "codigo", label: "Código" },
                { key: "nome", label: "Nome" },
                { key: "tipo", label: "Tipo", format: (v) => v === "coordenador" ? "Coordenador" : "Supervisor" },
                { key: "email", label: "Email" },
                { key: "telefone", label: "Telefone" },
                { key: "contratos.codigo", label: "Contrato Código" },
                { key: "contratos.nome", label: "Contrato Nome" },
                { key: "coordenador.nome", label: "Coordenador Responsável" },
                { key: "ativo", label: "Ativo", format: (v) => v ? "Sim" : "Não" },
                { key: "usuario_web_id", label: "ID Usuário Web" },
                { key: "created_at", label: "Criado em", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
              ]}
              disabled={loading}
            />
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!podeEditar}
              title={!podeEditar ? "Você não tem permissão para criar" : undefined}
            >
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
                <TableHead>Vínculos</TableHead>
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
                sortedData?.map((item) => {
                  // Para coordenadores: mostrar supervisores vinculados
                  // Para supervisores: mostrar equipes vinculadas
                  const supervisoresVinculados = item.tipo === "coordenador" 
                    ? getSupervisoresVinculados(item.id) 
                    : [];
                  const equipesVinculadas = item.tipo === "supervisor" 
                    ? getEquipesVinculadas(item.id) 
                    : [];

                  return (
                    <TableRow key={item.id}>
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
                        {item.tipo === "coordenador" ? (
                          <div className="space-y-1">
                            {supervisoresVinculados.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {supervisoresVinculados.map(sup => (
                                  <Badge key={sup.id} variant="outline" className="text-xs bg-purple-50">
                                    {sup.nome.split(" ")[0]}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem supervisores</span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {/* Mostrar coordenador responsável */}
                            {item.coordenador && (
                              <div className="text-xs text-muted-foreground mb-1">
                                Coord: <span className="font-medium">{(item.coordenador as any).nome}</span>
                              </div>
                            )}
                            {/* Mostrar equipes */}
                            {equipesVinculadas.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {equipesVinculadas.slice(0, 3).map((eq: any) => (
                                  <Badge key={eq.id} variant="outline" className="text-xs bg-blue-50">
                                    {eq.codigo}
                                  </Badge>
                                ))}
                                {equipesVinculadas.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{equipesVinculadas.length - 3}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem equipes</span>
                            )}
                          </div>
                        )}
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
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            title={podeEditar ? "Editar" : "Você não tem permissão para editar"}
                            disabled={!podeEditar}
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
                            title={podeEditar ? "Desativar" : "Você não tem permissão para desativar"}
                            disabled={!podeEditar}
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
              <DialogDescription>
                {!editingItem && "Selecione um usuário web cadastrado para vincular como coordenador ou supervisor."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Seleção de Usuário Web com busca */}
              <div className="space-y-2">
                <Label>Usuário Web *</Label>
                
                {/* Usuário selecionado */}
                {formData.usuario_web_id && (
                  <div className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                    <div>
                      <div className="font-medium text-sm">{formData.nome}</div>
                      <div className="text-xs text-muted-foreground">{formData.email}</div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          usuario_web_id: "",
                          nome: "",
                          email: "",
                          telefone: "",
                          contrato_id: "",
                        }));
                        setUsuarioSearch("");
                      }}
                    >
                      Alterar
                    </Button>
                  </div>
                )}

                {/* Campo de busca (só mostra se não tem usuário selecionado) */}
                {!formData.usuario_web_id && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Digite para pesquisar por nome ou email..."
                      value={usuarioSearch}
                      onChange={(e) => setUsuarioSearch(e.target.value)}
                    />
                    
                    {/* Lista de usuários */}
                    <div className="border rounded-md max-h-[200px] overflow-y-auto">
                      {usuariosFiltrados.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          {usuariosDisponiveis.length === 0 
                            ? "Nenhum usuário disponível" 
                            : usuarioSearch 
                              ? "Nenhum usuário encontrado" 
                              : "Digite para pesquisar..."}
                        </div>
                      ) : (
                        <div className="divide-y">
                          {usuariosFiltrados.slice(0, 10).map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                              onClick={() => handleUsuarioWebChange(u.id)}
                            >
                              <div className="font-medium text-sm">{u.nome}</div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                              {u.cargo && (
                                <div className="text-xs text-muted-foreground">{u.cargo}</div>
                              )}
                            </button>
                          ))}
                          {usuariosFiltrados.length > 10 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                              +{usuariosFiltrados.length - 10} usuários (refine a busca)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {usuariosDisponiveis.length === 0 && !editingItem && (
                  <p className="text-xs text-amber-600">
                    Cadastre primeiro um usuário em "Usuários Web" para poder vincular.
                  </p>
                )}
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v: "coordenador" | "supervisor") =>
                    setFormData({ ...formData, tipo: v, coordenador_id: "" })
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

              {/* Coordenador vinculado (apenas para supervisores) */}
              {formData.tipo === "supervisor" && (
                <div className="space-y-2">
                  <Label>Coordenador Responsável *</Label>
                  <Select
                    value={formData.coordenador_id || "none"}
                    onValueChange={(v) => setFormData({ ...formData, coordenador_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger className={!formData.coordenador_id ? "border-amber-500" : ""}>
                      <SelectValue placeholder="Selecione o coordenador" />
                    </SelectTrigger>
                    <SelectContent>
                      {coordenadoresAtivos.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhum coordenador ativo
                        </div>
                      ) : (
                        coordenadoresAtivos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {!formData.coordenador_id && (
                    <p className="text-xs text-amber-600">
                      Supervisores precisam estar vinculados a um coordenador.
                    </p>
                  )}
                </div>
              )}

              {/* Dados do usuário selecionado (somente leitura) */}
              {formData.usuario_web_id && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Dados do Usuário</p>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{formData.nome}</span>
                    </div>
                    {formData.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{formData.email}</span>
                      </div>
                    )}
                    {formData.telefone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{formData.telefone}</span>
                      </div>
                    )}
                    {formData.contrato_id && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Contrato: {contratos.find(c => c.id === formData.contrato_id)?.codigo || formData.contrato_id}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contrato */}
              <div className="space-y-2">
                <Label>Contrato</Label>
                <Select
                  value={formData.contrato_id || "none"}
                  onValueChange={(v) => setFormData({ ...formData, contrato_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Ao alterar, será sincronizado com o cadastro do Usuário Web.
                </p>
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
              <Button 
                onClick={handleSave} 
                disabled={
                  saving || 
                  !formData.usuario_web_id || 
                  (formData.tipo === "supervisor" && !formData.coordenador_id)
                }
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão/Desativação */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Confirmar Remoção
              </DialogTitle>
              <DialogDescription className="space-y-2">
                <p>
                  Tem certeza que deseja remover o{" "}
                  {itemToDelete?.tipo === "coordenador" ? "coordenador" : "supervisor"}{" "}
                  <strong>{itemToDelete?.nome}</strong>?
                </p>
                <p className="text-xs text-muted-foreground">
                  Se houver OSs vinculadas, o registro será apenas desativado.
                  Caso contrário, será excluído permanentemente.
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Remover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

