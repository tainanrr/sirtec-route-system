import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface Checklist {
  id: string;
  nome: string;
  tipo_servico: string;
  itens: Json;
  obrigatorio: boolean | null;
  ativo: boolean | null;
  created_at: string;
  updated_at: string;
}

const TIPOS_SERVICO = [
  "Ligação Nova",
  "Religação",
  "Corte",
  "Inspeção",
  "Manutenção",
  "Troca de Medidor",
  "Verificação",
  "Outros",
];

export default function CadastroChecklists() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    tipo_servico: "",
    itens: [] as string[],
    obrigatorio: true,
    ativo: true,
  });
  const [novoItem, setNovoItem] = useState("");
  const queryClient = useQueryClient();

  const { data: checklists, isLoading } = useQuery({
    queryKey: ["checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Checklist[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        nome: data.nome,
        tipo_servico: data.tipo_servico,
        itens: data.itens as unknown as Json,
        obrigatorio: data.obrigatorio,
        ativo: data.ativo,
      };

      if (selectedChecklist) {
        const { error } = await supabase
          .from("checklists")
          .update(payload)
          .eq("id", selectedChecklist.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("checklists").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      toast.success(selectedChecklist ? "Checklist atualizado!" : "Checklist criado!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao salvar checklist");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      toast.success("Checklist excluído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir checklist");
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", tipo_servico: "", itens: [], obrigatorio: true, ativo: true });
    setSelectedChecklist(null);
    setNovoItem("");
  };

  const handleEdit = (checklist: Checklist) => {
    setSelectedChecklist(checklist);
    const itens = Array.isArray(checklist.itens) ? (checklist.itens as string[]) : [];
    setFormData({
      nome: checklist.nome,
      tipo_servico: checklist.tipo_servico,
      itens,
      obrigatorio: checklist.obrigatorio ?? true,
      ativo: checklist.ativo ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const addItem = () => {
    if (novoItem.trim()) {
      setFormData({ ...formData, itens: [...formData.itens, novoItem.trim()] });
      setNovoItem("");
    }
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      itens: formData.itens.filter((_, i) => i !== index),
    });
  };

  const filteredChecklists = checklists?.filter(
    (c) =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.tipo_servico.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getItemCount = (itens: Json): number => {
    if (Array.isArray(itens)) {
      return itens.length;
    }
    return 0;
  };

  return (
    <MainLayout title="Checklists" subtitle="Gerencie os checklists por tipo de serviço">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Checklist
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo de Serviço</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Obrigatório</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredChecklists?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum checklist encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredChecklists?.map((checklist) => (
                  <TableRow key={checklist.id}>
                    <TableCell className="font-medium">{checklist.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{checklist.tipo_servico}</Badge>
                    </TableCell>
                    <TableCell>{getItemCount(checklist.itens)} itens</TableCell>
                    <TableCell>
                      <Badge variant={checklist.obrigatorio ? "default" : "secondary"}>
                        {checklist.obrigatorio ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={checklist.ativo ? "default" : "secondary"}>
                        {checklist.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(checklist)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(checklist.id)}
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
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedChecklist ? "Editar Checklist" : "Novo Checklist"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo_servico">Tipo de Serviço *</Label>
              <Select
                value={formData.tipo_servico}
                onValueChange={(value) => setFormData({ ...formData, tipo_servico: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_SERVICO.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Itens do Checklist</Label>
              <div className="flex gap-2">
                <Input
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  placeholder="Digite um item..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                />
                <Button type="button" onClick={addItem} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {formData.itens.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-muted px-3 py-2 rounded-md text-sm"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="obrigatorio"
                  checked={formData.obrigatorio}
                  onCheckedChange={(checked) => setFormData({ ...formData, obrigatorio: checked })}
                />
                <Label htmlFor="obrigatorio">Obrigatório</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
