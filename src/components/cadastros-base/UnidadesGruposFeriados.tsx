import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Loader2, Ruler, FolderTree, CalendarDays, XCircle, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import { ExportButton } from "@/components/ui/export-button";
import { format } from "date-fns";

// Interfaces
interface Unidade {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  simbolo: string | null;
  ativo: boolean;
}

interface Grupo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  contrato_id: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
  contratos?: { codigo: string; nome: string } | null;
}

interface Feriado {
  id: string;
  data: string;
  nome: string;
  tipo: string;
  estado: string | null;
  cidade: string | null;
  contrato_id: string | null;
  recorrente: boolean;
  ativo: boolean;
  contratos?: { codigo: string; nome: string } | null;
}

interface MotivoCancelamento {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  requer_justificativa: boolean;
  gera_reagendamento: boolean;
  ativo: boolean;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

const tipoFeriadoOptions = [
  { value: "nacional", label: "Nacional", color: "bg-blue-500" },
  { value: "estadual", label: "Estadual", color: "bg-green-500" },
  { value: "municipal", label: "Municipal", color: "bg-yellow-500" },
  { value: "ponto_facultativo", label: "Ponto Facultativo", color: "bg-gray-500" },
];

const tipoMotivoOptions = [
  { value: "os", label: "Ordem de Serviço", color: "bg-blue-500" },
  { value: "rota", label: "Rota", color: "bg-green-500" },
  { value: "agendamento", label: "Agendamento", color: "bg-yellow-500" },
  { value: "turno", label: "Turno", color: "bg-purple-500" },
  { value: "outro", label: "Outro", color: "bg-gray-500" },
];

export default function UnidadesGruposFeriados() {
  const [activeTab, setActiveTab] = useState("unidades");
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [motivosCancelamento, setMotivosCancelamento] = useState<MotivoCancelamento[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentType, setCurrentType] = useState<string>("");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Forms
  const [unidadeForm, setUnidadeForm] = useState({ codigo: "", nome: "", descricao: "", simbolo: "", ativo: true });
  const [grupoForm, setGrupoForm] = useState({ codigo: "", nome: "", descricao: "", contrato_id: "todos", cor: "#3B82F6", ordem: "0", ativo: true });
  const [feriadoForm, setFeriadoForm] = useState({ data: "", nome: "", tipo: "nacional", estado: "", cidade: "", contrato_id: "", recorrente: false, ativo: true });
  const [motivoForm, setMotivoForm] = useState({ codigo: "", nome: "", descricao: "", tipo: "os", requer_justificativa: false, gera_reagendamento: false, ativo: true });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [unidRes, grupoRes, ferRes, motivoRes, contRes] = await Promise.all([
        supabase.from("unidades_medida").select("*").order("codigo"),
        supabase.from("grupos_servico").select("*, contratos(codigo, nome)").order("codigo"),
        supabase.from("feriados").select("*, contratos(codigo, nome)").order("data", { ascending: false }),
        supabase.from("motivos_cancelamento").select("*").order("codigo"),
        supabase.from("contratos").select("id, codigo, nome").eq("status", "ativo").order("codigo"),
      ]);
      setUnidades(unidRes.data || []);
      setGrupos(grupoRes.data || []);
      setFeriados(ferRes.data || []);
      setMotivosCancelamento(motivoRes.data || []);
      setContratos(contRes.data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const { sortConfig: unidadeSortConfig, handleSort: handleUnidadeSort, sortedData: sortedUnidades } = useSortableTable(unidades, { column: "codigo", direction: "asc" });
  const { sortConfig: grupoSortConfig, handleSort: handleGrupoSort, sortedData: sortedGrupos } = useSortableTable(grupos, { column: "codigo", direction: "asc" });
  const { sortConfig: feriadoSortConfig, handleSort: handleFeriadoSort, sortedData: sortedFeriados } = useSortableTable(feriados, { column: "data", direction: "desc" });
  const { sortConfig: motivoSortConfig, handleSort: handleMotivoSort, sortedData: sortedMotivos } = useSortableTable(motivosCancelamento, { column: "codigo", direction: "asc" });

  const handleCreate = (type: string) => {
    setCurrentType(type);
    setEditingItem(null);
    if (type === "unidade") setUnidadeForm({ codigo: "", nome: "", descricao: "", simbolo: "", ativo: true });
    if (type === "grupo") setGrupoForm({ codigo: "", nome: "", descricao: "", contrato_id: "todos", cor: "#3B82F6", ordem: "0", ativo: true });
    if (type === "feriado") setFeriadoForm({ data: "", nome: "", tipo: "nacional", estado: "", cidade: "", contrato_id: "", recorrente: false, ativo: true });
    if (type === "motivo") setMotivoForm({ codigo: "", nome: "", descricao: "", tipo: "os", requer_justificativa: false, gera_reagendamento: false, ativo: true });
    setDialogOpen(true);
  };

  const handleEdit = (type: string, item: any) => {
    setCurrentType(type);
    setEditingItem(item);
    if (type === "unidade") setUnidadeForm({ codigo: item.codigo, nome: item.nome, descricao: item.descricao || "", simbolo: item.simbolo || "", ativo: item.ativo });
    if (type === "grupo") setGrupoForm({ codigo: item.codigo, nome: item.nome, descricao: item.descricao || "", contrato_id: item.contrato_id || "todos", cor: item.cor || "#3B82F6", ordem: item.ordem?.toString() || "0", ativo: item.ativo });
    if (type === "feriado") setFeriadoForm({ data: item.data, nome: item.nome, tipo: item.tipo, estado: item.estado || "", cidade: item.cidade || "", contrato_id: item.contrato_id || "", recorrente: item.recorrente, ativo: item.ativo });
    if (type === "motivo") setMotivoForm({ codigo: item.codigo, nome: item.nome, descricao: item.descricao || "", tipo: item.tipo, requer_justificativa: item.requer_justificativa, gera_reagendamento: item.gera_reagendamento, ativo: item.ativo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let table = "";
      let payload: any = {};

      if (currentType === "unidade") {
        if (!unidadeForm.codigo || !unidadeForm.nome) { toast.error("Preencha os campos obrigatórios"); setSaving(false); return; }
        table = "unidades_medida";
        payload = { ...unidadeForm, codigo: unidadeForm.codigo.toUpperCase() };
      }
      if (currentType === "grupo") {
        if (!grupoForm.codigo || !grupoForm.nome) { toast.error("Preencha os campos obrigatórios"); setSaving(false); return; }
        table = "grupos_servico";
        payload = { ...grupoForm, codigo: grupoForm.codigo.toUpperCase(), contrato_id: grupoForm.contrato_id && grupoForm.contrato_id !== "todos" ? grupoForm.contrato_id : null, ordem: parseInt(grupoForm.ordem) };
      }
      if (currentType === "feriado") {
        if (!feriadoForm.data || !feriadoForm.nome) { toast.error("Preencha os campos obrigatórios"); setSaving(false); return; }
        table = "feriados";
        payload = { ...feriadoForm, estado: feriadoForm.estado || null, cidade: feriadoForm.cidade || null, contrato_id: feriadoForm.contrato_id || null };
      }
      if (currentType === "motivo") {
        if (!motivoForm.codigo || !motivoForm.nome) { toast.error("Preencha os campos obrigatórios"); setSaving(false); return; }
        table = "motivos_cancelamento";
        payload = { ...motivoForm, codigo: motivoForm.codigo.toUpperCase(), descricao: motivoForm.descricao || null };
      }

      if (editingItem) {
        const { error } = await supabase.from(table).update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Registro atualizado");
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
        toast.success("Registro criado");
      }
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      let table = "";
      if (currentType === "unidade") table = "unidades_medida";
      if (currentType === "grupo") table = "grupos_servico";
      if (currentType === "feriado") table = "feriados";
      if (currentType === "motivo") table = "motivos_cancelamento";
      const { error } = await supabase.from(table).delete().eq("id", itemToDelete.id);
      if (error) throw error;
      toast.success("Registro excluído");
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="unidades" className="flex items-center gap-2"><Ruler className="h-4 w-4" />Unidades</TabsTrigger>
          <TabsTrigger value="grupos" className="flex items-center gap-2"><FolderTree className="h-4 w-4" />Grupos</TabsTrigger>
          <TabsTrigger value="feriados" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />Feriados</TabsTrigger>
          <TabsTrigger value="motivos" className="flex items-center gap-2"><XCircle className="h-4 w-4" />Motivos Cancel.</TabsTrigger>
        </TabsList>

        {/* Tab Unidades */}
        <TabsContent value="unidades" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <ExportButton data={unidades} filename="unidades_medida" columns={[
              { key: "codigo", label: "Código" }, { key: "nome", label: "Nome" }, { key: "simbolo", label: "Símbolo" }, { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
            ]} />
            <Button onClick={() => handleCreate("unidade")}><Plus className="h-4 w-4 mr-2" />Nova Unidade</Button>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="codigo" label="Código" sortConfig={unidadeSortConfig} onSort={handleUnidadeSort} />
                  <SortableTableHead column="nome" label="Nome" sortConfig={unidadeSortConfig} onSort={handleUnidadeSort} />
                  <TableHead>Símbolo</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={unidadeSortConfig} onSort={handleUnidadeSort} />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : sortedUnidades?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma unidade cadastrada</TableCell></TableRow>
                ) : (
                  sortedUnidades?.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-mono">{item.codigo}</TableCell>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell><Badge variant="outline">{item.simbolo || "-"}</Badge></TableCell>
                      <TableCell><Badge variant={item.ativo ? "default" : "secondary"}>{item.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit("unidade", item)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setCurrentType("unidade"); setItemToDelete(item); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab Grupos */}
        <TabsContent value="grupos" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <ExportButton data={grupos} filename="grupos_servico" columns={[
              { key: "codigo", label: "Código" }, { key: "nome", label: "Nome" }, { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
            ]} />
            <Button onClick={() => handleCreate("grupo")}><Plus className="h-4 w-4 mr-2" />Novo Grupo</Button>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="codigo" label="Código" sortConfig={grupoSortConfig} onSort={handleGrupoSort} />
                  <SortableTableHead column="nome" label="Nome" sortConfig={grupoSortConfig} onSort={handleGrupoSort} />
                  <TableHead>Cor</TableHead>
                  <TableHead>Contrato</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={grupoSortConfig} onSort={handleGrupoSort} />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : sortedGrupos?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum grupo cadastrado</TableCell></TableRow>
                ) : (
                  sortedGrupos?.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-mono">{item.codigo}</TableCell>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>{item.cor && <div className="w-6 h-6 rounded border" style={{ backgroundColor: item.cor }} />}</TableCell>
                      <TableCell>{item.contratos ? <Badge variant="secondary">{item.contratos.codigo}</Badge> : <span className="text-muted-foreground">Todos</span>}</TableCell>
                      <TableCell><Badge variant={item.ativo ? "default" : "secondary"}>{item.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit("grupo", item)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setCurrentType("grupo"); setItemToDelete(item); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab Feriados */}
        <TabsContent value="feriados" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <ExportButton data={feriados} filename="feriados" columns={[
              { key: "data", label: "Data" }, { key: "nome", label: "Nome" }, { key: "tipo", label: "Tipo" }, { key: "recorrente", label: "Recorrente", format: (v: any) => v ? "Sim" : "Não" },
            ]} />
            <Button onClick={() => handleCreate("feriado")}><Plus className="h-4 w-4 mr-2" />Novo Feriado</Button>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="data" label="Data" sortConfig={feriadoSortConfig} onSort={handleFeriadoSort} />
                  <SortableTableHead column="nome" label="Nome" sortConfig={feriadoSortConfig} onSort={handleFeriadoSort} />
                  <TableHead>Tipo</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Recorrente</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={feriadoSortConfig} onSort={handleFeriadoSort} />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : sortedFeriados?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum feriado cadastrado</TableCell></TableRow>
                ) : (
                  sortedFeriados?.map((item) => {
                    const tipoOpt = tipoFeriadoOptions.find(t => t.value === item.tipo);
                    return (
                      <TableRow key={item.id} className="group">
                        <TableCell className="font-mono">{format(new Date(item.data + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell><Badge className={`${tipoOpt?.color} text-white`}>{tipoOpt?.label}</Badge></TableCell>
                        <TableCell className="text-sm">{item.cidade && item.estado ? `${item.cidade}/${item.estado}` : item.estado || "-"}</TableCell>
                        <TableCell>{item.recorrente ? <Badge variant="outline">Anual</Badge> : "-"}</TableCell>
                        <TableCell><Badge variant={item.ativo ? "default" : "secondary"}>{item.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit("feriado", item)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => { setCurrentType("feriado"); setItemToDelete(item); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

        {/* Tab Motivos Cancelamento */}
        <TabsContent value="motivos" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <ExportButton data={motivosCancelamento} filename="motivos_cancelamento" columns={[
              { key: "codigo", label: "Código" }, { key: "nome", label: "Nome" }, { key: "tipo", label: "Tipo" }, { key: "ativo", label: "Ativo", format: (v: any) => v ? "Sim" : "Não" },
            ]} />
            <Button onClick={() => handleCreate("motivo")}><Plus className="h-4 w-4 mr-2" />Novo Motivo</Button>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="codigo" label="Código" sortConfig={motivoSortConfig} onSort={handleMotivoSort} />
                  <SortableTableHead column="nome" label="Nome" sortConfig={motivoSortConfig} onSort={handleMotivoSort} />
                  <TableHead>Tipo</TableHead>
                  <TableHead>Configurações</TableHead>
                  <SortableTableHead column="ativo" label="Status" sortConfig={motivoSortConfig} onSort={handleMotivoSort} />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : sortedMotivos?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum motivo cadastrado</TableCell></TableRow>
                ) : (
                  sortedMotivos?.map((item) => {
                    const tipoOpt = tipoMotivoOptions.find(t => t.value === item.tipo);
                    return (
                      <TableRow key={item.id} className="group">
                        <TableCell className="font-mono">{item.codigo}</TableCell>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell><Badge className={`${tipoOpt?.color} text-white`}>{tipoOpt?.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {item.requer_justificativa && <Badge variant="outline">📝 Justificativa</Badge>}
                            {item.gera_reagendamento && <Badge variant="outline">🔄 Reagenda</Badge>}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={item.ativo ? "default" : "secondary"}>{item.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit("motivo", item)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => { setCurrentType("motivo"); setItemToDelete(item); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
      </Tabs>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar" : "Novo"}{" "}
              {currentType === "unidade" && "Unidade de Medida"}
              {currentType === "grupo" && "Grupo de Serviço"}
              {currentType === "feriado" && "Feriado"}
              {currentType === "motivo" && "Motivo de Cancelamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {currentType === "unidade" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Código *</Label><Input value={unidadeForm.codigo} onChange={(e) => setUnidadeForm({ ...unidadeForm, codigo: e.target.value.toUpperCase() })} /></div>
                  <div className="space-y-2"><Label>Símbolo</Label><Input value={unidadeForm.simbolo} onChange={(e) => setUnidadeForm({ ...unidadeForm, simbolo: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Nome *</Label><Input value={unidadeForm.nome} onChange={(e) => setUnidadeForm({ ...unidadeForm, nome: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={unidadeForm.ativo} onCheckedChange={(v) => setUnidadeForm({ ...unidadeForm, ativo: v })} /><Label>Ativo</Label></div>
              </>
            )}
            {currentType === "grupo" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Código *</Label><Input value={grupoForm.codigo} onChange={(e) => setGrupoForm({ ...grupoForm, codigo: e.target.value.toUpperCase() })} /></div>
                  <div className="space-y-2"><Label>Cor</Label><Input type="color" value={grupoForm.cor} onChange={(e) => setGrupoForm({ ...grupoForm, cor: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Nome *</Label><Input value={grupoForm.nome} onChange={(e) => setGrupoForm({ ...grupoForm, nome: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Contrato</Label>
                  <Select value={grupoForm.contrato_id} onValueChange={(v) => setGrupoForm({ ...grupoForm, contrato_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent><SelectItem value="todos">Todos</SelectItem>{contratos.map((c) => (<SelectItem key={c.id} value={c.id}>{c.codigo}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2"><Switch checked={grupoForm.ativo} onCheckedChange={(v) => setGrupoForm({ ...grupoForm, ativo: v })} /><Label>Ativo</Label></div>
              </>
            )}
            {currentType === "feriado" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Data *</Label><Input type="date" value={feriadoForm.data} onChange={(e) => setFeriadoForm({ ...feriadoForm, data: e.target.value })} /></div>
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select value={feriadoForm.tipo} onValueChange={(v) => setFeriadoForm({ ...feriadoForm, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{tipoFeriadoOptions.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Nome *</Label><Input value={feriadoForm.nome} onChange={(e) => setFeriadoForm({ ...feriadoForm, nome: e.target.value })} /></div>
                {(feriadoForm.tipo === "estadual" || feriadoForm.tipo === "municipal") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Estado</Label><Input value={feriadoForm.estado} onChange={(e) => setFeriadoForm({ ...feriadoForm, estado: e.target.value.toUpperCase() })} maxLength={2} /></div>
                    {feriadoForm.tipo === "municipal" && <div className="space-y-2"><Label>Cidade</Label><Input value={feriadoForm.cidade} onChange={(e) => setFeriadoForm({ ...feriadoForm, cidade: e.target.value })} /></div>}
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2"><Switch checked={feriadoForm.recorrente} onCheckedChange={(v) => setFeriadoForm({ ...feriadoForm, recorrente: v })} /><Label>Recorrente (anual)</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={feriadoForm.ativo} onCheckedChange={(v) => setFeriadoForm({ ...feriadoForm, ativo: v })} /><Label>Ativo</Label></div>
                </div>
              </>
            )}
            {currentType === "motivo" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Código *</Label><Input value={motivoForm.codigo} onChange={(e) => setMotivoForm({ ...motivoForm, codigo: e.target.value.toUpperCase() })} /></div>
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select value={motivoForm.tipo} onValueChange={(v) => setMotivoForm({ ...motivoForm, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{tipoMotivoOptions.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Nome *</Label><Input value={motivoForm.nome} onChange={(e) => setMotivoForm({ ...motivoForm, nome: e.target.value })} /></div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2"><Switch checked={motivoForm.requer_justificativa} onCheckedChange={(v) => setMotivoForm({ ...motivoForm, requer_justificativa: v })} /><Label>Requer Justificativa</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={motivoForm.gera_reagendamento} onCheckedChange={(v) => setMotivoForm({ ...motivoForm, gera_reagendamento: v })} /><Label>Gera Reagendamento</Label></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={motivoForm.ativo} onCheckedChange={(v) => setMotivoForm({ ...motivoForm, ativo: v })} /><Label>Ativo</Label></div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" />Confirmar Exclusão</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir <strong>{itemToDelete?.nome || itemToDelete?.codigo}</strong>?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

