import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ClipboardCheck,
  GripVertical,
  Copy,
  Eye,
  ChevronDown,
  ChevronUp,
  Image,
  FileSignature,
  Type,
  ListChecks,
  ToggleLeft,
  Calendar,
  Hash,
  AlignLeft,
  Loader2,
  Link2,
  X,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useTelaPermissao } from "@/hooks/usePermissoes";

// Tipos de pergunta disponíveis
const tipoPerguntaConfig = {
  texto: { label: "Texto Curto", icon: Type, description: "Resposta em texto livre" },
  texto_longo: { label: "Texto Longo", icon: AlignLeft, description: "Resposta em múltiplas linhas" },
  numero: { label: "Número", icon: Hash, description: "Resposta numérica" },
  sim_nao: { label: "Sim/Não", icon: ToggleLeft, description: "Resposta binária" },
  multipla_escolha: { label: "Múltipla Escolha", icon: ListChecks, description: "Seleção de opções" },
  foto: { label: "Foto", icon: Image, description: "Upload de imagem" },
  assinatura: { label: "Assinatura", icon: FileSignature, description: "Captura de assinatura" },
  data: { label: "Data", icon: Calendar, description: "Seleção de data" },
};

type TipoPergunta = keyof typeof tipoPerguntaConfig;

interface Pergunta {
  id: string;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  opcoes?: string[]; // Para múltipla escolha
  ordem: number;
}

interface Checklist {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string; // APR, Qualidade, Segurança, etc.
  ativo: boolean;
  perguntas: Pergunta[];
  created_at: string;
  updated_at: string;
}

// Tipos do checklist
const tiposChecklist = [
  { value: "apr", label: "APR - Análise Preliminar de Riscos" },
  { value: "servico", label: "Checklist de Serviço" },
  { value: "qualidade", label: "Qualidade" },
  { value: "seguranca", label: "Segurança" },
  { value: "inspecao", label: "Inspeção" },
  { value: "manutencao", label: "Manutenção" },
  { value: "outro", label: "Outro" },
];

// Grupos de retorno para vincular checklists de serviço
const gruposRetorno = [
  { value: "todos", label: "Todos os Retornos" },
  { value: "executado", label: "Executado" },
  { value: "impedimento", label: "Impedimento" },
  { value: "parcial", label: "Parcial" },
];

// Interface para vínculos de checklist de serviço
interface ChecklistVinculo {
  id?: string;
  skill_id: string;
  skill_nome?: string;
  grupo_retorno: string;
  obrigatorio: boolean;
  ordem: number;
}

// Interface para Skills
interface Skill {
  id: string;
  codigo: string;
  nome: string;
}

export default function Checklists() {
  const { podeEditar } = useTelaPermissao("checklists");
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<Checklist | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Estados para checklists de serviço
  const [skills, setSkills] = useState<Skill[]>([]);
  const [vinculos, setVinculos] = useState<ChecklistVinculo[]>([]);

  // Estado do formulário
  const [formData, setFormData] = useState<{
    nome: string;
    descricao: string;
    tipo: string;
    ativo: boolean;
    perguntas: Pergunta[];
  }>({
    nome: "",
    descricao: "",
    tipo: "apr",
    ativo: true,
    perguntas: [],
  });

  // Estado para nova pergunta
  const [novaPergunta, setNovaPergunta] = useState<{
    texto: string;
    tipo: TipoPergunta;
    obrigatoria: boolean;
    opcoes: string;
  }>({
    texto: "",
    tipo: "texto",
    obrigatoria: true,
    opcoes: "",
  });

  const fetchChecklists = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Parsear perguntas JSON
      const checklistsParsed = (data || []).map(c => ({
        ...c,
        perguntas: typeof c.perguntas === 'string' ? JSON.parse(c.perguntas) : (c.perguntas || [])
      }));

      setChecklists(checklistsParsed);
    } catch (error: any) {
      console.error("Erro ao carregar checklists:", error);
      toast.error("Erro ao carregar checklists");
    } finally {
      setLoading(false);
    }
  };

  const fetchSkills = async () => {
    try {
      const { data, error } = await supabase
        .from("skills")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setSkills(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar skills:", error);
    }
  };

  const fetchVinculos = async (checklistId: string) => {
    try {
      const { data, error } = await supabase
        .from("checklist_servico_vinculos")
        .select(`
          id,
          skill_id,
          grupo_retorno,
          obrigatorio,
          ordem,
          skills:skill_id (nome)
        `)
        .eq("checklist_id", checklistId)
        .order("ordem");

      if (error) throw error;
      
      const vinculosParsed = (data || []).map(v => ({
        id: v.id,
        skill_id: v.skill_id,
        skill_nome: (v.skills as any)?.nome || "",
        grupo_retorno: v.grupo_retorno,
        obrigatorio: v.obrigatorio,
        ordem: v.ordem,
      }));
      
      setVinculos(vinculosParsed);
    } catch (error: any) {
      console.error("Erro ao carregar vínculos:", error);
      setVinculos([]);
    }
  };

  useEffect(() => {
    fetchChecklists();
    fetchSkills();
  }, []);

  const handleEdit = async (checklist: Checklist) => {
    setSelectedChecklist(checklist);
    setFormData({
      nome: checklist.nome,
      descricao: checklist.descricao || "",
      tipo: checklist.tipo,
      ativo: checklist.ativo,
      perguntas: checklist.perguntas || [],
    });
    
    // Carregar vínculos se for checklist de serviço
    if (checklist.tipo === "servico") {
      await fetchVinculos(checklist.id);
    } else {
      setVinculos([]);
    }
    
    setFormOpen(true);
  };

  const handlePreview = (checklist: Checklist) => {
    setSelectedChecklist(checklist);
    setPreviewOpen(true);
  };

  const handleDuplicate = async (checklist: Checklist) => {
    try {
      const { error } = await supabase.from("checklists").insert({
        nome: `${checklist.nome} (Cópia)`,
        descricao: checklist.descricao,
        tipo: checklist.tipo,
        ativo: false,
        perguntas: checklist.perguntas,
      });

      if (error) throw error;

      toast.success("Checklist duplicado com sucesso!");
      fetchChecklists();
    } catch (error: any) {
      console.error("Erro ao duplicar:", error);
      toast.error("Erro ao duplicar checklist");
    }
  };

  const handleDelete = async () => {
    if (!checklistToDelete) return;

    try {
      const { error } = await supabase
        .from("checklists")
        .delete()
        .eq("id", checklistToDelete.id);

      if (error) throw error;

      toast.success("Checklist excluído!");
      fetchChecklists();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir checklist");
    } finally {
      setDeleteDialogOpen(false);
      setChecklistToDelete(null);
    }
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (formData.perguntas.length === 0) {
      toast.error("Adicione pelo menos uma pergunta");
      return;
    }

    // Validar vínculos para checklist de serviço
    if (formData.tipo === "servico" && vinculos.length === 0) {
      toast.error("Adicione pelo menos um vínculo com tipo de serviço");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        tipo: formData.tipo,
        ativo: formData.ativo,
        perguntas: formData.perguntas,
      };

      let checklistId: string;

      if (selectedChecklist) {
        const { error } = await supabase
          .from("checklists")
          .update(payload)
          .eq("id", selectedChecklist.id);

        if (error) throw error;
        checklistId = selectedChecklist.id;
      } else {
        const { data, error } = await supabase
          .from("checklists")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;
        checklistId = data.id;
      }

      // Salvar vínculos para checklist de serviço
      if (formData.tipo === "servico") {
        // Remover vínculos existentes
        await supabase
          .from("checklist_servico_vinculos")
          .delete()
          .eq("checklist_id", checklistId);

        // Inserir novos vínculos
        if (vinculos.length > 0) {
          const vinculosPayload = vinculos.map((v, index) => ({
            checklist_id: checklistId,
            skill_id: v.skill_id,
            grupo_retorno: v.grupo_retorno,
            obrigatorio: v.obrigatorio,
            ordem: index,
            ativo: true,
          }));

          const { error: vinculosError } = await supabase
            .from("checklist_servico_vinculos")
            .insert(vinculosPayload);

          if (vinculosError) {
            console.error("Erro ao salvar vínculos:", vinculosError);
            toast.error("Checklist salvo, mas erro ao salvar vínculos");
      }
        }
      }

      toast.success(selectedChecklist ? "Checklist atualizado!" : "Checklist criado!");
      setFormOpen(false);
      resetForm();
      fetchChecklists();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar checklist");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedChecklist(null);
    setFormData({
      nome: "",
      descricao: "",
      tipo: "apr",
      ativo: true,
      perguntas: [],
    });
    setNovaPergunta({
      texto: "",
      tipo: "texto",
      obrigatoria: true,
      opcoes: "",
    });
    setVinculos([]);
  };

  // Funções para gerenciar vínculos
  const adicionarVinculo = () => {
    if (skills.length === 0) {
      toast.error("Nenhum tipo de serviço disponível");
      return;
    }
    
    setVinculos(prev => [
      ...prev,
      {
        skill_id: skills[0].id,
        skill_nome: skills[0].nome,
        grupo_retorno: "todos",
        obrigatorio: true,
        ordem: prev.length,
      },
    ]);
  };

  const removerVinculo = (index: number) => {
    setVinculos(prev => prev.filter((_, i) => i !== index));
  };

  const atualizarVinculo = (index: number, field: keyof ChecklistVinculo, value: any) => {
    setVinculos(prev => {
      const novos = [...prev];
      novos[index] = { ...novos[index], [field]: value };
      
      // Atualizar nome do skill se mudou o skill_id
      if (field === "skill_id") {
        const skill = skills.find(s => s.id === value);
        novos[index].skill_nome = skill?.nome || "";
      }
      
      return novos;
    });
  };

  const adicionarPergunta = () => {
    if (!novaPergunta.texto.trim()) {
      toast.error("Digite o texto da pergunta");
      return;
    }

    const pergunta: Pergunta = {
      id: crypto.randomUUID(),
      texto: novaPergunta.texto.trim(),
      tipo: novaPergunta.tipo,
      obrigatoria: novaPergunta.obrigatoria,
      ordem: formData.perguntas.length + 1,
    };

    // Adicionar opções se for múltipla escolha
    if (novaPergunta.tipo === "multipla_escolha" && novaPergunta.opcoes.trim()) {
      pergunta.opcoes = novaPergunta.opcoes.split("\n").filter(o => o.trim());
    }

    setFormData(prev => ({
      ...prev,
      perguntas: [...prev.perguntas, pergunta],
    }));

    // Limpar formulário de pergunta
    setNovaPergunta({
      texto: "",
      tipo: "texto",
      obrigatoria: true,
      opcoes: "",
    });
  };

  const removerPergunta = (id: string) => {
    setFormData(prev => ({
      ...prev,
      perguntas: prev.perguntas
        .filter(p => p.id !== id)
        .map((p, index) => ({ ...p, ordem: index + 1 })),
    }));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(formData.perguntas);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Atualizar ordem
    const reordered = items.map((item, index) => ({
      ...item,
      ordem: index + 1,
    }));

    setFormData(prev => ({ ...prev, perguntas: reordered }));
  };

  const filteredChecklists = checklists.filter((c) => {
    const matchesSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = tipoFilter === "all" || c.tipo === tipoFilter;
    return matchesSearch && matchesTipo;
  });

  return (
    <MainLayout
      title="Checklists"
      breadcrumbs={[{ label: "Admin" }, { label: "Checklists" }]}
    >
      {/* Actions Bar */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar checklist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {tiposChecklist.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="gap-2"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
              disabled={!podeEditar}
            >
              <Plus className="h-4 w-4" />
              Novo Checklist
            </Button>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          {filteredChecklists.length} checklist(s) encontrado(s)
        </div>
      </div>

      {/* Cards de Checklists */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filteredChecklists.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum checklist encontrado.</p>
          <p className="text-sm">Clique em "Novo Checklist" para criar.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredChecklists.map((checklist) => {
            const tipoConfig = tiposChecklist.find(t => t.value === checklist.tipo);
            return (
              <Card key={checklist.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                        {checklist.nome}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {checklist.descricao || "Sem descrição"}
                      </CardDescription>
                    </div>
                    <Badge variant={checklist.ativo ? "default" : "secondary"}>
                      {checklist.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tipo:</span>
                      <Badge variant="outline">{tipoConfig?.label || checklist.tipo}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Perguntas:</span>
                      <span className="font-medium">{checklist.perguntas?.length || 0}</span>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handlePreview(checklist)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Visualizar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(checklist)}
                        disabled={!podeEditar}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(checklist)}
                        disabled={!podeEditar}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setChecklistToDelete(checklist);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={!podeEditar}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de Formulário */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) resetForm(); setFormOpen(open); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedChecklist ? "Editar Checklist" : "Novo Checklist"}
            </DialogTitle>
            <DialogDescription>
              Configure as informações e perguntas do checklist
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações Básicas */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: APR - Trabalho em Altura"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposChecklist.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva o objetivo deste checklist..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
              />
              <Label htmlFor="ativo">Checklist ativo</Label>
            </div>

            {/* Vínculos para Checklist de Serviço */}
            {formData.tipo === "servico" && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Vínculos com Tipos de Serviço ({vinculos.length})
                  </h3>
                  <Button onClick={adicionarVinculo} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Vínculo
                  </Button>
                </div>

                {vinculos.length === 0 ? (
                  <div className="text-center py-6 bg-muted/30 rounded-lg border border-dashed">
                    <Wrench className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum vínculo configurado.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure para quais tipos de serviço e grupos de retorno este checklist será exibido.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vinculos.map((vinculo, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                        <div className="flex-1 grid gap-2 md:grid-cols-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Tipo de Serviço</Label>
                            <Select
                              value={vinculo.skill_id}
                              onValueChange={(value) => atualizarVinculo(index, "skill_id", value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {skills.map((skill) => (
                                  <SelectItem key={skill.id} value={skill.id}>
                                    {skill.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Grupo de Retorno</Label>
                            <Select
                              value={vinculo.grupo_retorno}
                              onValueChange={(value) => atualizarVinculo(index, "grupo_retorno", value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {gruposRetorno.map((grupo) => (
                                  <SelectItem key={grupo.value} value={grupo.value}>
                                    {grupo.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`obrigatorio-${index}`}
                                checked={vinculo.obrigatorio}
                                onCheckedChange={(checked) =>
                                  atualizarVinculo(index, "obrigatorio", checked as boolean)
                                }
                              />
                              <Label htmlFor={`obrigatorio-${index}`} className="text-sm">
                                Obrigatório
                              </Label>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          onClick={() => removerVinculo(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-3">
                  💡 Configure os tipos de serviço e grupos de retorno onde este checklist será exibido ao concluir uma OS.
                </p>
              </div>
            )}

            {/* Perguntas */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Perguntas ({formData.perguntas.length})
              </h3>

              {/* Lista de perguntas */}
              {formData.perguntas.length > 0 && (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="perguntas">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2 mb-4"
                      >
                        {formData.perguntas.map((pergunta, index) => {
                          const tipoConfig = tipoPerguntaConfig[pergunta.tipo];
                          const TipoIcon = tipoConfig?.icon || Type;

                          return (
                            <Draggable key={pergunta.id} draggableId={pergunta.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center gap-2 p-3 rounded-lg border ${
                                    snapshot.isDragging ? "bg-muted shadow-lg" : "bg-card"
                                  }`}
                                >
                                  <div {...provided.dragHandleProps} className="cursor-grab">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <Badge variant="outline" className="shrink-0">
                                    {pergunta.ordem}
                                  </Badge>
                                  <TipoIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{pergunta.texto}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {tipoConfig?.label}
                                      {pergunta.obrigatoria && " • Obrigatória"}
                                      {pergunta.opcoes && ` • ${pergunta.opcoes.length} opções`}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => removerPergunta(pergunta.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {/* Adicionar nova pergunta */}
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Adicionar Pergunta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Texto da Pergunta *</Label>
                      <Input
                        value={novaPergunta.texto}
                        onChange={(e) => setNovaPergunta(prev => ({ ...prev, texto: e.target.value }))}
                        placeholder="Ex: O local está sinalizado?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Resposta</Label>
                      <Select
                        value={novaPergunta.tipo}
                        onValueChange={(value: TipoPergunta) => setNovaPergunta(prev => ({ ...prev, tipo: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(tipoPerguntaConfig).map(([key, config]) => {
                            const Icon = config.icon;
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{config.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Opções para múltipla escolha */}
                  {novaPergunta.tipo === "multipla_escolha" && (
                    <div className="space-y-2">
                      <Label>Opções (uma por linha)</Label>
                      <Textarea
                        value={novaPergunta.opcoes}
                        onChange={(e) => setNovaPergunta(prev => ({ ...prev, opcoes: e.target.value }))}
                        placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                        rows={3}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="obrigatoria"
                        checked={novaPergunta.obrigatoria}
                        onCheckedChange={(checked) => 
                          setNovaPergunta(prev => ({ ...prev, obrigatoria: checked as boolean }))
                        }
                      />
                      <Label htmlFor="obrigatoria" className="text-sm">Resposta obrigatória</Label>
                    </div>
                    <Button onClick={adicionarPergunta} size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setFormOpen(false); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedChecklist ? "Salvar Alterações" : "Criar Checklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {selectedChecklist?.nome}
            </DialogTitle>
            <DialogDescription>
              {selectedChecklist?.descricao || "Visualização do checklist"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedChecklist?.perguntas.map((pergunta, index) => {
              const tipoConfig = tipoPerguntaConfig[pergunta.tipo];
              const TipoIcon = tipoConfig?.icon || Type;

              return (
                <Card key={pergunta.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="shrink-0 mt-0.5">
                        {index + 1}
                      </Badge>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <TipoIcon className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">
                            {pergunta.texto}
                            {pergunta.obrigatoria && <span className="text-destructive ml-1">*</span>}
                          </p>
                        </div>

                        {/* Preview do campo de resposta */}
                        <div className="mt-2">
                          {pergunta.tipo === "texto" && (
                            <Input placeholder="Resposta..." disabled />
                          )}
                          {pergunta.tipo === "texto_longo" && (
                            <Textarea placeholder="Resposta..." rows={2} disabled />
                          )}
                          {pergunta.tipo === "numero" && (
                            <Input type="number" placeholder="0" disabled className="w-32" />
                          )}
                          {pergunta.tipo === "sim_nao" && (
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2">
                                <input type="radio" name={`preview-${pergunta.id}`} disabled />
                                <span>Sim</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input type="radio" name={`preview-${pergunta.id}`} disabled />
                                <span>Não</span>
                              </label>
                            </div>
                          )}
                          {pergunta.tipo === "multipla_escolha" && pergunta.opcoes && (
                            <div className="space-y-2">
                              {pergunta.opcoes.map((opcao, i) => (
                                <label key={i} className="flex items-center gap-2">
                                  <Checkbox disabled />
                                  <span className="text-sm">{opcao}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {pergunta.tipo === "foto" && (
                            <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground">
                              <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">Clique para tirar foto</p>
                            </div>
                          )}
                          {pergunta.tipo === "assinatura" && (
                            <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground">
                              <FileSignature className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">Área de assinatura</p>
                            </div>
                          )}
                          {pergunta.tipo === "data" && (
                            <Input type="date" disabled className="w-48" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Checklist</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o checklist "{checklistToDelete?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}








