import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  FileText,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Eye,
  Download,
  Smartphone,
  Link,
  Upload,
  File,
  FileImage,
  X,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import { ExportButton } from "@/components/ui/export-button";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";

interface Anexo {
  id: string;
  procedimento_id: string;
  nome: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tamanho_bytes: number;
  storage_path: string;
  url_publica: string | null;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

interface Procedimento {
  id: string;
  titulo: string;
  descricao: string | null;
  conteudo: string | null;
  categoria: string;
  arquivo_url: string | null;
  contrato_id: string | null;
  visivel_app: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
  contratos?: { codigo: string; nome: string } | null;
  anexos?: Anexo[];
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

const categoriaOptions = [
  { value: "seguranca", label: "Segurança" },
  { value: "tecnico", label: "Técnico" },
  { value: "qualidade", label: "Qualidade" },
  { value: "administrativo", label: "Administrativo" },
  { value: "operacional", label: "Operacional" },
  { value: "outro", label: "Outro" },
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (tipo: string) => {
  if (tipo.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
  if (tipo.includes('image')) return <FileImage className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-gray-500" />;
};

export default function AdminProcedimentos() {
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [editingProcedimento, setEditingProcedimento] = useState<Procedimento | null>(null);
  const [viewingProcedimento, setViewingProcedimento] = useState<Procedimento | null>(null);
  const [procedimentoToDelete, setProcedimentoToDelete] = useState<Procedimento | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingPdfName, setViewingPdfName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuração dos filtros
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: "search",
      label: "Buscar",
      type: "text",
      placeholder: "Buscar por título ou descrição...",
    },
    {
      id: "categoria",
      label: "Categoria",
      type: "select",
      options: categoriaOptions,
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
      id: "visivel_app",
      label: "Visível no App",
      type: "select",
      options: [
        { value: "sim", label: "Sim", color: "bg-blue-500" },
        { value: "nao", label: "Não", color: "bg-gray-500" },
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
    titulo: "",
    descricao: "",
    conteudo: "",
    categoria: "operacional",
    arquivo_url: "",
    contrato_id: "todos",
    visivel_app: true,
    ativo: true,
    ordem: 0,
  });

  // Carregar dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("procedimentos")
        .select(`
          *,
          contratos (codigo, nome)
        `)
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });

      if (error) throw error;
      setProcedimentos(data || []);

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

  // Carregar anexos de um procedimento
  const fetchAnexos = async (procedimentoId: string) => {
    try {
      const { data, error } = await supabase
        .from("procedimentos_anexos")
        .select("*")
        .eq("procedimento_id", procedimentoId)
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (error) throw error;
      setAnexos(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar anexos:", error);
      setAnexos([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrar dados
  const filteredProcedimentos = useMemo(() => {
    return filterData(
      procedimentos,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.titulo.toLowerCase().includes(searchTerm) ||
            item.descricao?.toLowerCase().includes(searchTerm) || false
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
        visivel_app: (item, value) => {
          if (value === "sim") return item.visivel_app;
          if (value === "nao") return !item.visivel_app;
          return true;
        },
      }
    );
  }, [procedimentos, filterValues, filterConfigs]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredProcedimentos,
    { column: "ordem", direction: "asc" }
  );

  const handleCreate = () => {
    setEditingProcedimento(null);
    const maxOrdem = Math.max(...procedimentos.map((p) => p.ordem), 0);
    setFormData({
      titulo: "",
      descricao: "",
      conteudo: "",
      categoria: "operacional",
      arquivo_url: "",
      contrato_id: "todos",
      visivel_app: true,
      ativo: true,
      ordem: maxOrdem + 1,
    });
    setAnexos([]);
    setPendingFiles([]);
    setDialogOpen(true);
  };

  const handleEdit = async (procedimento: Procedimento) => {
    setEditingProcedimento(procedimento);
    setFormData({
      titulo: procedimento.titulo,
      descricao: procedimento.descricao || "",
      conteudo: procedimento.conteudo || "",
      categoria: procedimento.categoria,
      arquivo_url: procedimento.arquivo_url || "",
      contrato_id: procedimento.contrato_id || "todos",
      visivel_app: procedimento.visivel_app,
      ativo: procedimento.ativo,
      ordem: procedimento.ordem,
    });
    setPendingFiles([]);
    await fetchAnexos(procedimento.id);
    setDialogOpen(true);
  };

  const handleView = async (procedimento: Procedimento) => {
    setViewingProcedimento(procedimento);
    await fetchAnexos(procedimento.id);
    setViewDialogOpen(true);
  };

  // Upload de arquivos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    Array.from(files).forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Tipo de arquivo não permitido: ${file.name}`);
        return;
      }
      if (file.size > maxSize) {
        toast.error(`Arquivo muito grande (máx 50MB): ${file.name}`);
        return;
      }
      validFiles.push(file);
    });

    setPendingFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File, procedimentoId: string): Promise<Anexo | null> => {
    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${procedimentoId}/${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('procedimentos')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('procedimentos')
        .getPublicUrl(storagePath);

      const anexoData = {
        procedimento_id: procedimentoId,
        nome: file.name.replace(`.${ext}`, ''),
        nome_arquivo: file.name,
        tipo_arquivo: file.type,
        tamanho_bytes: file.size,
        storage_path: storagePath,
        url_publica: urlData.publicUrl,
        ordem: anexos.length + 1,
      };

      const { data: insertedAnexo, error: insertError } = await supabase
        .from('procedimentos_anexos')
        .insert(anexoData)
        .select()
        .single();

      if (insertError) throw insertError;
      return insertedAnexo;
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(`Erro ao enviar ${file.name}: ${error.message}`);
      return null;
    }
  };

  const handleDeleteAnexo = async (anexo: Anexo) => {
    try {
      // Remover do storage
      const { error: storageError } = await supabase.storage
        .from('procedimentos')
        .remove([anexo.storage_path]);

      if (storageError) {
        console.warn('Erro ao remover do storage:', storageError);
      }

      // Remover do banco
      const { error: dbError } = await supabase
        .from('procedimentos_anexos')
        .delete()
        .eq('id', anexo.id);

      if (dbError) throw dbError;

      setAnexos(prev => prev.filter(a => a.id !== anexo.id));
      toast.success('Anexo removido com sucesso');
    } catch (error: any) {
      console.error('Erro ao remover anexo:', error);
      toast.error(`Erro ao remover anexo: ${error.message}`);
    }
  };

  const handleSave = async () => {
    if (!formData.titulo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        titulo: formData.titulo,
        descricao: formData.descricao || null,
        conteudo: formData.conteudo || null,
        categoria: formData.categoria,
        arquivo_url: formData.arquivo_url || null,
        contrato_id: formData.contrato_id && formData.contrato_id !== "todos" ? formData.contrato_id : null,
        visivel_app: formData.visivel_app,
        ativo: formData.ativo,
        ordem: formData.ordem,
      };

      let procedimentoId: string;

      if (editingProcedimento) {
        const { error } = await supabase
          .from("procedimentos")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingProcedimento.id);

        if (error) throw error;
        procedimentoId = editingProcedimento.id;
        toast.success("Procedimento atualizado com sucesso");
      } else {
        const { data, error } = await supabase
          .from("procedimentos")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        procedimentoId = data.id;
        toast.success("Procedimento criado com sucesso");
      }

      // Upload de arquivos pendentes
      if (pendingFiles.length > 0) {
        setUploading(true);
        let uploadedCount = 0;
        for (const file of pendingFiles) {
          const result = await uploadFile(file, procedimentoId);
          if (result) uploadedCount++;
        }
        if (uploadedCount > 0) {
          toast.success(`${uploadedCount} arquivo(s) anexado(s)`);
        }
        setUploading(false);
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
    if (!procedimentoToDelete) return;

    try {
      // Primeiro, buscar e remover anexos do storage
      const { data: anexosData } = await supabase
        .from('procedimentos_anexos')
        .select('storage_path')
        .eq('procedimento_id', procedimentoToDelete.id);

      if (anexosData && anexosData.length > 0) {
        const paths = anexosData.map(a => a.storage_path);
        await supabase.storage.from('procedimentos').remove(paths);
      }

      const { error } = await supabase
        .from("procedimentos")
        .delete()
        .eq("id", procedimentoToDelete.id);

      if (error) throw error;

      toast.success("Procedimento excluído com sucesso");
      setDeleteDialogOpen(false);
      setProcedimentoToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const handleViewPdf = (url: string, nome: string) => {
    setViewingPdfUrl(url);
    setViewingPdfName(nome);
    setPdfViewerOpen(true);
  };

  const handleDownloadFile = (url: string, nome: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Procedimentos</h2>
          <p className="text-muted-foreground">
            Gerencie os procedimentos operacionais disponíveis no aplicativo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={procedimentos}
            filename="procedimentos"
            columns={[
              { key: "codigo", label: "Código" },
              { key: "titulo", label: "Título" },
              { key: "descricao", label: "Descrição" },
              { key: "categoria", label: "Categoria" },
              { key: "aplicavel_app", label: "App", format: (v) => v ? "Sim" : "Não" },
              { key: "aplicavel_web", label: "Web", format: (v) => v ? "Sim" : "Não" },
              { key: "url_documento", label: "URL Documento" },
              { key: "ativo", label: "Ativo", format: (v) => v ? "Sim" : "Não" },
              { key: "created_at", label: "Criado em", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
            ]}
            disabled={loading}
          />
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Procedimento
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

      {/* Estatísticas por categoria */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {categoriaOptions.map((cat) => {
          const count = procedimentos.filter((p) => p.categoria === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterValues({ ...filterValues, categoria: cat.value })}
              className={`p-3 rounded-lg border transition-all hover:shadow-md ${
                filterValues.categoria === cat.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <span className="text-xs font-medium">{cat.label}</span>
              <p className="text-xl font-bold mt-1">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="ordem"
                label="#"
                sortConfig={sortConfig}
                onSort={handleSort}
                className="w-16"
              />
              <SortableTableHead
                column="titulo"
                label="Título"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="categoria"
                label="Categoria"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="contratos.codigo"
                label="Contrato"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <TableHead>Anexos</TableHead>
              <SortableTableHead
                column="visivel_app"
                label="App"
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
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sortedData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? "Nenhum procedimento encontrado com os filtros aplicados"
                      : "Nenhum procedimento cadastrado"}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                      Limpar filtros
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedData?.map((proc) => (
                <TableRow key={proc.id} className="group">
                  <TableCell className="font-mono text-muted-foreground">
                    {proc.ordem}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{proc.titulo}</p>
                      {proc.descricao && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {proc.descricao}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {categoriaOptions.find((c) => c.value === proc.categoria)?.label ||
                        proc.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {proc.contratos ? (
                      <Badge variant="secondary">{proc.contratos.codigo}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Todos</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {proc.arquivo_url ? (
                      <Badge variant="secondary" className="gap-1">
                        <Paperclip className="h-3 w-3" />
                        Link
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {proc.visivel_app ? (
                      <Badge variant="default" className="bg-blue-500">
                        <Smartphone className="h-3 w-3 mr-1" />
                        Sim
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={proc.ativo ? "default" : "secondary"}>
                      {proc.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(proc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(proc)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setProcedimentoToDelete(proc);
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
            Mostrando {sortedData.length} de {procedimentos.length} procedimentos
          </div>
        )}
      </div>

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProcedimento ? "Editar Procedimento" : "Novo Procedimento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Título *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) =>
                    setFormData({ ...formData, titulo: e.target.value })
                  }
                  placeholder="Título do procedimento"
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(v) => setFormData({ ...formData, categoria: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriaOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={formData.ordem}
                  onChange={(e) =>
                    setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                  placeholder="Descrição breve"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Conteúdo</Label>
                <Textarea
                  value={formData.conteudo}
                  onChange={(e) =>
                    setFormData({ ...formData, conteudo: e.target.value })
                  }
                  placeholder="Conteúdo completo do procedimento..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label>URL do Arquivo (opcional)</Label>
                <Input
                  value={formData.arquivo_url}
                  onChange={(e) =>
                    setFormData({ ...formData, arquivo_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>Contrato</Label>
                <Select
                  value={formData.contrato_id}
                  onValueChange={(v) => setFormData({ ...formData, contrato_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os contratos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seção de Anexos */}
              <div className="col-span-2 space-y-3">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Documentos Anexos (PDFs, Imagens, Word)
                </Label>
                
                {/* Área de upload */}
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Clique para selecionar ou arraste arquivos aqui
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Imagens, Word (máx. 50MB cada)
                  </p>
                </div>

                {/* Arquivos pendentes para upload */}
                {pendingFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Arquivos a enviar ({pendingFiles.length}):
                    </p>
                    <div className="space-y-1">
                      {pendingFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            {getFileIcon(file.type)}
                            <span className="text-sm truncate max-w-[300px]">
                              {file.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(file.size)})
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removePendingFile(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Anexos já salvos */}
                {anexos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Anexos salvos ({anexos.length}):
                    </p>
                    <div className="space-y-1">
                      {anexos.map((anexo) => (
                        <div
                          key={anexo.id}
                          className="flex items-center justify-between p-2 bg-green-500/10 border border-green-500/20 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            {getFileIcon(anexo.tipo_arquivo)}
                            <span className="text-sm truncate max-w-[250px]">
                              {anexo.nome_arquivo}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(anexo.tamanho_bytes)})
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {anexo.tipo_arquivo.includes('pdf') && anexo.url_publica && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewPdf(anexo.url_publica!, anexo.nome_arquivo)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {anexo.url_publica && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadFile(anexo.url_publica!, anexo.nome_arquivo)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAnexo(anexo)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6 col-span-2 p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.visivel_app}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, visivel_app: v })
                    }
                  />
                  <div>
                    <Label>Visível no App</Label>
                    <p className="text-xs text-muted-foreground">
                      Disponível para visualização no aplicativo móvel
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.ativo}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, ativo: v })
                    }
                  />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {(saving || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {uploading ? "Enviando arquivos..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Visualização */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingProcedimento?.titulo}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">
                  {categoriaOptions.find((c) => c.value === viewingProcedimento?.categoria)
                    ?.label || viewingProcedimento?.categoria}
                </Badge>
                {viewingProcedimento?.visivel_app && (
                  <Badge variant="default" className="bg-blue-500">
                    <Smartphone className="h-3 w-3 mr-1" />
                    Visível no App
                  </Badge>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {viewingProcedimento && (
            <div className="space-y-4">
              {viewingProcedimento.descricao && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    Descrição
                  </p>
                  <p className="text-sm">{viewingProcedimento.descricao}</p>
                </div>
              )}

              {viewingProcedimento.conteudo && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    Conteúdo
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg text-sm whitespace-pre-wrap">
                    {viewingProcedimento.conteudo}
                  </div>
                </div>
              )}

              {viewingProcedimento.arquivo_url && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    Link Externo
                  </p>
                  <a
                    href={viewingProcedimento.arquivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir link
                  </a>
                </div>
              )}

              {/* Anexos na visualização */}
              {anexos.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-2">
                    Documentos Anexos ({anexos.length})
                  </p>
                  <div className="grid gap-2">
                    {anexos.map((anexo) => (
                      <div
                        key={anexo.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          {getFileIcon(anexo.tipo_arquivo)}
                          <div>
                            <p className="text-sm font-medium">{anexo.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {anexo.nome_arquivo} • {formatFileSize(anexo.tamanho_bytes)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {anexo.tipo_arquivo.includes('pdf') && anexo.url_publica && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPdf(anexo.url_publica!, anexo.nome_arquivo)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Visualizar
                            </Button>
                          )}
                          {anexo.url_publica && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadFile(anexo.url_publica!, anexo.nome_arquivo)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Baixar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-4 border-t">
                Criado em{" "}
                {format(new Date(viewingProcedimento.created_at), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Visualização de PDF */}
      <Dialog open={pdfViewerOpen} onOpenChange={setPdfViewerOpen}>
        <DialogContent className="max-w-5xl h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-500" />
              {viewingPdfName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-0">
            {viewingPdfUrl && (
              <iframe
                src={viewingPdfUrl}
                className="w-full h-[calc(90vh-120px)] rounded-lg border"
                title={viewingPdfName}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => viewingPdfUrl && handleDownloadFile(viewingPdfUrl, viewingPdfName)}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            <Button
              variant="outline"
              onClick={() => viewingPdfUrl && window.open(viewingPdfUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir em nova aba
            </Button>
            <Button onClick={() => setPdfViewerOpen(false)}>
              Fechar
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
              Tem certeza que deseja excluir o procedimento{" "}
              <strong>{procedimentoToDelete?.titulo}</strong>?
              <br />
              <span className="text-destructive">
                Todos os anexos também serão removidos.
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
