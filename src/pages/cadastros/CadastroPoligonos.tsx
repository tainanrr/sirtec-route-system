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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { ExportButton } from "@/components/ui/export-button";
import type { Json } from "@/integrations/supabase/types";

interface Poligono {
  id: string;
  nome: string;
  cor: string | null;
  coordenadas: Json;
  ativo: boolean | null;
  created_at: string;
  updated_at: string;
}

export default function CadastroPoligonos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPoligono, setSelectedPoligono] = useState<Poligono | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    cor: "#3B82F6",
    coordenadas: "",
    ativo: true,
  });
  const queryClient = useQueryClient();

  const { data: poligonos, isLoading } = useQuery({
    queryKey: ["poligonos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("poligonos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Poligono[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let coordenadas: Json = [];
      try {
        if (data.coordenadas) {
          coordenadas = JSON.parse(data.coordenadas);
        }
      } catch {
        throw new Error("Coordenadas inválidas. Use formato JSON.");
      }

      const payload = {
        nome: data.nome,
        cor: data.cor,
        coordenadas,
        ativo: data.ativo,
      };

      if (selectedPoligono) {
        const { error } = await supabase
          .from("poligonos")
          .update(payload)
          .eq("id", selectedPoligono.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("poligonos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poligonos"] });
      toast.success(selectedPoligono ? "Polígono atualizado!" : "Polígono criado!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao salvar polígono");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("poligonos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poligonos"] });
      toast.success("Polígono excluído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir polígono");
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", cor: "#3B82F6", coordenadas: "", ativo: true });
    setSelectedPoligono(null);
  };

  const handleEdit = (poligono: Poligono) => {
    setSelectedPoligono(poligono);
    setFormData({
      nome: poligono.nome,
      cor: poligono.cor || "#3B82F6",
      coordenadas: JSON.stringify(poligono.coordenadas, null, 2),
      ativo: poligono.ativo ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const filteredPoligonos = poligonos?.filter((p) =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCoordCount = (coordenadas: Json): number => {
    if (Array.isArray(coordenadas)) {
      return coordenadas.length;
    }
    return 0;
  };

  return (
    <MainLayout title="Polígonos" subtitle="Gerencie as áreas de atuação">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <ExportButton
              data={poligonos || []}
              filename="poligonos"
              columns={[
                { key: "nome", label: "Nome" },
                { key: "cor", label: "Cor" },
                { key: "coordenadas", label: "Coordenadas", format: (v) => v ? JSON.stringify(v) : "" },
                { key: "ativo", label: "Ativo", format: (v) => v ? "Sim" : "Não" },
                { key: "created_at", label: "Criado em", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
              ]}
              disabled={isLoading}
            />
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Polígono
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
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
                <TableHead>Cor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredPoligonos?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum polígono encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredPoligonos?.map((poligono) => (
                  <TableRow key={poligono.id}>
                    <TableCell>
                      <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: poligono.cor || "#3B82F6" }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{poligono.nome}</TableCell>
                    <TableCell>{getCoordCount(poligono.coordenadas)} pontos</TableCell>
                    <TableCell>
                      <Badge variant={poligono.ativo ? "default" : "secondary"}>
                        {poligono.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(poligono)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(poligono.id)}
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
              {selectedPoligono ? "Editar Polígono" : "Novo Polígono"}
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
              <Label htmlFor="cor">Cor</Label>
              <div className="flex gap-2">
                <Input
                  id="cor"
                  type="color"
                  value={formData.cor}
                  onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={formData.cor}
                  onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordenadas">Coordenadas (JSON)</Label>
              <Textarea
                id="coordenadas"
                value={formData.coordenadas}
                onChange={(e) => setFormData({ ...formData, coordenadas: e.target.value })}
                placeholder='[{"lat": -23.5505, "lng": -46.6333}, ...]'
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Array de objetos com lat e lng. Ex: [{`{"lat": -23.5, "lng": -46.6}`}]
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="ativo">Ativo</Label>
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
