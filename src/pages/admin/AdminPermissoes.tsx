import { useState, useEffect, useMemo } from "react";
import { useLogSistema } from "@/hooks/useLogSistema";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Eye,
  Edit,
  Check,
  X,
  ChevronRight,
  LayoutDashboard,
  Map,
  Package,
  ClipboardList,
  Settings,
  BarChart3,
  Calendar,
  Truck,
  UserCog,
  FileText,
  Database,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import { ExportButton } from "@/components/ui/export-button";

interface PerfilPermissao {
  id: string;
  nome: string;
  descricao: string | null;
  is_admin: boolean;
  ativo: boolean;
  permissoes: Record<string, { editar: boolean; consultar: boolean }>;
  created_at: string;
}

// Estrutura de módulos e telas do sistema
// Estas são as telas usadas para controle de permissões
const sistemaTelas = [
  {
    modulo: "Dashboard",
    icon: LayoutDashboard,
    telas: [
      { id: "dashboard", nome: "Dashboard", descricao: "Visão geral do sistema" },
    ],
  },
  {
    modulo: "Operacional",
    icon: Map,
    telas: [
      { id: "torre_controle", nome: "Torre de Controle", descricao: "Central de monitoramento" },
      { id: "roteirizacao", nome: "Roteirização", descricao: "Criar e gerenciar rotas" },
      { id: "acompanhamento_rotas", nome: "Acompanhamento de Roteirizações", descricao: "Monitorar rotas em tempo real" },
    ],
  },
  {
    modulo: "Ordens de Serviço",
    icon: ClipboardList,
    telas: [
      { id: "ordens_servico", nome: "Ordens de Serviço", descricao: "Gerenciar OS" },
      { id: "consulta_checklists", nome: "Consulta Checklists", descricao: "Visualizar checklists preenchidos" },
    ],
  },
  {
    modulo: "Materiais",
    icon: Package,
    telas: [
      { id: "materiais", nome: "Materiais", descricao: "Gestão de materiais e estoque" },
    ],
  },
  {
    modulo: "Cadastros",
    icon: Database,
    telas: [
      { id: "equipes", nome: "Equipes", descricao: "Cadastro de equipes de campo" },
      { id: "skills", nome: "Skills", descricao: "Habilidades das equipes" },
      { id: "territorios", nome: "Territórios", descricao: "Zonas de atuação" },
      { id: "coordenadores", nome: "Coordenadores e Supervisores", descricao: "Gestão de supervisão" },
      { id: "veiculos", nome: "Veículos", descricao: "Frota de veículos" },
      { id: "metas", nome: "Metas", descricao: "Metas de equipes" },
    ],
  },
  {
    modulo: "Administração",
    icon: Settings,
    telas: [
      { id: "contratos", nome: "Contratos", descricao: "Contratos de clientes" },
      { id: "usuarios_web", nome: "Usuários Web", descricao: "Usuários do sistema web" },
      { id: "colaboradores", nome: "Colaboradores", descricao: "Colaboradores/Usuários do App" },
      { id: "permissoes", nome: "Permissões", descricao: "Controle de acesso" },
      { id: "cadastros_base", nome: "Cadastros Base", descricao: "Configurações do sistema" },
      { id: "procedimentos", nome: "Procedimentos", descricao: "Documentos e procedimentos" },
      { id: "checklists", nome: "Checklists", descricao: "Modelos de checklists" },
      { id: "logs", nome: "Logs", descricao: "Histórico de ações" },
    ],
  },
];

export default function AdminPermissoes() {
  const { logCriar, logEditar, logExcluir } = useLogSistema();
  const [perfis, setPerfis] = useState<PerfilPermissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<PerfilPermissao | null>(null);
  const [perfilToDelete, setPerfilToDelete] = useState<PerfilPermissao | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedModulos, setExpandedModulos] = useState<string[]>(sistemaTelas.map(m => m.modulo));

  // Form state para perfil
  const [perfilForm, setPerfilForm] = useState({
    nome: "",
    descricao: "",
    is_admin: false,
    ativo: true,
    permissoes: {} as Record<string, { editar: boolean; consultar: boolean }>,
  });

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("perfis_permissao")
        .select("*")
        .order("nome");

      if (error) throw error;

      // Processar perfis com permissões do campo JSON
      const perfisProcessados = (data || []).map(perfil => ({
        ...perfil,
        permissoes: (perfil as any).permissoes_json || {},
      }));

      setPerfis(perfisProcessados);
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

  // Ordenação de perfis
  const { sortConfig: perfilSortConfig, handleSort: handlePerfilSort, sortedData: sortedPerfis } =
    useSortableTable(perfis, { column: "nome", direction: "asc" });

  // Handlers para Perfil
  const handleCreatePerfil = () => {
    setEditingPerfil(null);
    // Inicializar permissões vazias para todas as telas
    const permissoesIniciais: Record<string, { editar: boolean; consultar: boolean }> = {};
    sistemaTelas.forEach(modulo => {
      modulo.telas.forEach(tela => {
        permissoesIniciais[tela.id] = { editar: false, consultar: false };
      });
    });
    setPerfilForm({
      nome: "",
      descricao: "",
      is_admin: false,
      ativo: true,
      permissoes: permissoesIniciais,
    });
    setPerfilDialogOpen(true);
  };

  const handleEditPerfil = (perfil: PerfilPermissao) => {
    setEditingPerfil(perfil);
    // Garantir que todas as telas tenham entrada de permissão
    const permissoesCompletas: Record<string, { editar: boolean; consultar: boolean }> = {};
    sistemaTelas.forEach(modulo => {
      modulo.telas.forEach(tela => {
        permissoesCompletas[tela.id] = perfil.permissoes[tela.id] || { editar: false, consultar: false };
      });
    });
    setPerfilForm({
      nome: perfil.nome,
      descricao: perfil.descricao || "",
      is_admin: perfil.is_admin,
      ativo: perfil.ativo,
      permissoes: permissoesCompletas,
    });
    setPerfilDialogOpen(true);
  };

  const handleSavePerfil = async () => {
    if (!perfilForm.nome) {
      toast.error("Preencha o nome do perfil");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: perfilForm.nome,
        descricao: perfilForm.descricao || null,
        is_admin: perfilForm.is_admin,
        ativo: perfilForm.ativo,
        permissoes_json: perfilForm.permissoes,
      };

      if (editingPerfil) {
        const { error } = await supabase
          .from("perfis_permissao")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingPerfil.id);

        if (error) throw error;
        
        // Log de edição
        logEditar("admin", "perfis_permissao", editingPerfil.id, editingPerfil, payload,
          `Editou perfil ${payload.nome}${payload.is_admin ? ' (Admin)' : ''}`);
        
        toast.success("Perfil atualizado com sucesso");
      } else {
        const { data: newData, error } = await supabase
          .from("perfis_permissao")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;
        
        // Log de criação
        logCriar("admin", "perfis_permissao", newData?.id || "", payload,
          `Criou perfil ${payload.nome}${payload.is_admin ? ' (Admin)' : ''}`);
        
        toast.success("Perfil criado com sucesso");
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
    if (!perfilToDelete) return;

    try {
      const { error } = await supabase
        .from("perfis_permissao")
        .delete()
        .eq("id", perfilToDelete.id);

      if (error) throw error;
      
      // Log de exclusão
      logExcluir("admin", "perfis_permissao", perfilToDelete.id, perfilToDelete,
        `Excluiu perfil ${perfilToDelete.nome}`);
      
      toast.success("Perfil excluído com sucesso");

      setDeleteDialogOpen(false);
      setPerfilToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  // Toggle permissão para uma tela
  const togglePermissao = (telaId: string, tipo: "editar" | "consultar") => {
    setPerfilForm(prev => {
      const current = prev.permissoes[telaId] || { editar: false, consultar: false };
      const newValue = !current[tipo];
      
      // Se marcar editar, marca consultar também
      // Se desmarcar consultar, desmarca editar também
      let newPermissoes = { ...current };
      if (tipo === "editar" && newValue) {
        newPermissoes = { editar: true, consultar: true };
      } else if (tipo === "consultar" && !newValue) {
        newPermissoes = { editar: false, consultar: false };
      } else {
        newPermissoes[tipo] = newValue;
      }

      return {
        ...prev,
        permissoes: {
          ...prev.permissoes,
          [telaId]: newPermissoes,
        },
      };
    });
  };

  // Marcar/desmarcar todas as telas de um módulo
  const toggleModulo = (modulo: typeof sistemaTelas[0], tipo: "editar" | "consultar" | "nenhum") => {
    setPerfilForm(prev => {
      const newPermissoes = { ...prev.permissoes };
      modulo.telas.forEach(tela => {
        if (tipo === "editar") {
          newPermissoes[tela.id] = { editar: true, consultar: true };
        } else if (tipo === "consultar") {
          newPermissoes[tela.id] = { editar: false, consultar: true };
        } else {
          newPermissoes[tela.id] = { editar: false, consultar: false };
        }
      });
      return { ...prev, permissoes: newPermissoes };
    });
  };

  // Marcar/desmarcar todas as telas
  const toggleTodas = (tipo: "editar" | "consultar" | "nenhum") => {
    setPerfilForm(prev => {
      const newPermissoes: Record<string, { editar: boolean; consultar: boolean }> = {};
      sistemaTelas.forEach(modulo => {
        modulo.telas.forEach(tela => {
          if (tipo === "editar") {
            newPermissoes[tela.id] = { editar: true, consultar: true };
          } else if (tipo === "consultar") {
            newPermissoes[tela.id] = { editar: false, consultar: true };
          } else {
            newPermissoes[tela.id] = { editar: false, consultar: false };
          }
        });
      });
      return { ...prev, permissoes: newPermissoes };
    });
  };

  // Contar permissões de um perfil
  const contarPermissoes = (permissoes: Record<string, { editar: boolean; consultar: boolean }>) => {
    let editar = 0;
    let consultar = 0;
    Object.values(permissoes || {}).forEach(p => {
      if (p.editar) editar++;
      if (p.consultar && !p.editar) consultar++;
    });
    return { editar, consultar, total: editar + consultar };
  };

  // Verificar status do módulo
  const getModuloStatus = (modulo: typeof sistemaTelas[0]) => {
    let todosEditar = true;
    let todosConsultar = true;
    let algumMarcado = false;

    modulo.telas.forEach(tela => {
      const perm = perfilForm.permissoes[tela.id];
      if (!perm?.editar) todosEditar = false;
      if (!perm?.consultar) todosConsultar = false;
      if (perm?.editar || perm?.consultar) algumMarcado = true;
    });

    if (todosEditar) return "editar";
    if (todosConsultar) return "consultar";
    if (algumMarcado) return "parcial";
    return "nenhum";
  };

  return (
    <div className="space-y-6">
      {/* Ações */}
      <div className="flex items-center justify-end gap-2">
        <ExportButton
          data={perfis}
          filename="perfis_permissao"
          columns={[
            { key: "nome", label: "Nome" },
            { key: "descricao", label: "Descrição" },
            { key: "is_admin", label: "Admin", format: (v) => v ? "Sim" : "Não" },
            { key: "ativo", label: "Ativo", format: (v) => v ? "Sim" : "Não" },
            { key: "created_at", label: "Criado em", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
          ]}
          disabled={loading}
        />
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button onClick={handleCreatePerfil}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Perfil
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span className="text-sm">Total Perfis</span>
            </div>
            <p className="text-2xl font-bold mt-1">{perfis.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600">
              <Shield className="h-4 w-4" />
              <span className="text-sm">Administradores</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {perfis.filter((p) => p.is_admin).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm">Ativos</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {perfis.filter((p) => p.ativo).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-sm">Total de Telas</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {sistemaTelas.reduce((acc, m) => acc + m.telas.length, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Perfis */}
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
                const stats = contarPermissoes(perfil.permissoes);
                return (
                  <TableRow key={perfil.id} className="group">
                    <TableCell className="font-medium">{perfil.nome}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {perfil.descricao || "-"}
                    </TableCell>
                    <TableCell>
                      {perfil.is_admin ? (
                        <Badge variant="default" className="flex items-center gap-1 w-fit bg-amber-600">
                          <Shield className="h-3 w-3" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Usuário</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {stats.editar > 0 && (
                          <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                            <Edit className="h-3 w-3" />
                            {stats.editar} editar
                          </Badge>
                        )}
                        {stats.consultar > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {stats.consultar} consultar
                          </Badge>
                        )}
                        {stats.total === 0 && (
                          <Badge variant="secondary">Sem permissões</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={perfil.ativo ? "default" : "secondary"}>
                        {perfil.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
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
                            setPerfilToDelete(perfil);
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

      {/* Dialog de Criar/Editar Perfil */}
      <Dialog open={perfilDialogOpen} onOpenChange={setPerfilDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[95vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {editingPerfil ? "Editar Perfil" : "Novo Perfil"}
            </DialogTitle>
            <DialogDescription>
              Configure as permissões de acesso para cada tela do sistema
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Dados básicos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Perfil *</Label>
                <Input
                  value={perfilForm.nome}
                  onChange={(e) =>
                    setPerfilForm({ ...perfilForm, nome: e.target.value })
                  }
                  placeholder="Ex: Operador, Supervisor, Gestor"
                />
              </div>
              <div className="flex items-center gap-6 pt-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={perfilForm.is_admin}
                    onCheckedChange={(v) =>
                      setPerfilForm({ ...perfilForm, is_admin: v })
                    }
                  />
                  <Label>Administrador (acesso total)</Label>
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

            {/* Ações em massa */}
            <div className="flex items-center gap-2 py-2 border-y">
              <span className="text-sm font-medium text-muted-foreground">Ações rápidas:</span>
              <Button size="sm" variant="outline" onClick={() => toggleTodas("editar")}>
                <Edit className="h-3 w-3 mr-1" />
                Liberar tudo (Editar)
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleTodas("consultar")}>
                <Eye className="h-3 w-3 mr-1" />
                Liberar tudo (Consultar)
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleTodas("nenhum")}>
                <X className="h-3 w-3 mr-1" />
                Remover todas
              </Button>
            </div>

            {/* Lista de permissões por módulo */}
            <div className="space-y-3">
                {sistemaTelas.map((modulo) => {
                  const ModuloIcon = modulo.icon;
                  const status = getModuloStatus(modulo);
                  
                  return (
                    <div key={modulo.modulo} className="border rounded-lg overflow-hidden">
                      {/* Header do módulo */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
                        <div className="flex items-center gap-3">
                          <ModuloIcon className="h-5 w-5 text-primary" />
                          <span className="font-medium">{modulo.modulo}</span>
                          <Badge variant="outline" className="text-xs">
                            {modulo.telas.length} telas
                          </Badge>
                          {status === "editar" && (
                            <Badge className="bg-green-600 text-xs">Edição total</Badge>
                          )}
                          {status === "consultar" && (
                            <Badge variant="outline" className="text-xs">Consulta total</Badge>
                          )}
                          {status === "parcial" && (
                            <Badge variant="secondary" className="text-xs">Parcial</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={status === "editar" ? "default" : "ghost"}
                            className="h-7 px-2"
                            onClick={() => toggleModulo(modulo, status === "editar" ? "nenhum" : "editar")}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={status === "consultar" ? "default" : "ghost"}
                            className="h-7 px-2"
                            onClick={() => toggleModulo(modulo, status === "consultar" ? "nenhum" : "consultar")}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Consultar
                          </Button>
                        </div>
                      </div>
                      
                      {/* Telas do módulo */}
                      <div className="divide-y">
                        {modulo.telas.map((tela) => {
                          const perm = perfilForm.permissoes[tela.id] || { editar: false, consultar: false };
                          
                          return (
                            <div
                              key={tela.id}
                              className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">{tela.nome}</p>
                                <p className="text-xs text-muted-foreground">{tela.descricao}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                {/* Consultar */}
                                <button
                                  type="button"
                                  onClick={() => togglePermissao(tela.id, "consultar")}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                                    perm.consultar
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Consultar
                                  {perm.consultar && <Check className="h-3.5 w-3.5" />}
                                </button>
                                
                                {/* Editar */}
                                <button
                                  type="button"
                                  onClick={() => togglePermissao(tela.id, "editar")}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                                    perm.editar
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                  Editar
                                  {perm.editar && <Check className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
              <span>
                Selecionadas: {Object.values(perfilForm.permissoes).filter(p => p.editar || p.consultar).length} telas
              </span>
            </div>
            <Button variant="outline" onClick={() => setPerfilDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePerfil} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Perfil
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
              Tem certeza que deseja excluir o perfil{" "}
              <strong>{perfilToDelete?.nome}</strong>?
              <br /><br />
              <span className="text-destructive">
                Usuários vinculados a este perfil perderão as permissões associadas.
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
