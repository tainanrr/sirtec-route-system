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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { ExportButton } from "@/components/ui/export-button";

interface PontoSaida {
  id: string;
  nome: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean | null;
  created_at: string;
  updated_at: string;
}

export default function CadastroPontosSaida() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPonto, setSelectedPonto] = useState<PontoSaida | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    endereco: "",
    latitude: "",
    longitude: "",
    ativo: true,
  });
  const queryClient = useQueryClient();

  const { data: pontos, isLoading } = useQuery({
    queryKey: ["pontos_saida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pontos_saida")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as PontoSaida[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        nome: data.nome,
        endereco: data.endereco,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        ativo: data.ativo,
      };

      if (selectedPonto) {
        const { error } = await supabase
          .from("pontos_saida")
          .update(payload)
          .eq("id", selectedPonto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pontos_saida").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pontos_saida"] });
      toast.success(selectedPonto ? "Ponto atualizado!" : "Ponto criado!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao salvar ponto de saída");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pontos_saida").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pontos_saida"] });
      toast.success("Ponto excluído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir ponto");
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", endereco: "", latitude: "", longitude: "", ativo: true });
    setSelectedPonto(null);
  };

  const handleEdit = (ponto: PontoSaida) => {
    setSelectedPonto(ponto);
    setFormData({
      nome: ponto.nome,
      endereco: ponto.endereco,
      latitude: ponto.latitude?.toString() || "",
      longitude: ponto.longitude?.toString() || "",
      ativo: ponto.ativo ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const filteredPontos = pontos?.filter(
    (p) =>
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.endereco.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout title="Pontos de Saída" breadcrumbs={[{ label: "Cadastros" }, { label: "Pontos de Saída" }]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <ExportButton
              data={pontos || []}
              filename="pontos_saida"
              columns={[
                { key: "nome", label: "Nome" },
                { key: "endereco", label: "Endereço" },
                { key: "latitude", label: "Latitude" },
                { key: "longitude", label: "Longitude" },
                { key: "ativo", label: "Ativo", format: (v) => v ? "Sim" : "Não" },
                { key: "created_at", label: "Criado em", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
              ]}
              disabled={isLoading}
            />
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Ponto
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou endereço..."
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
                <TableHead>Endereço</TableHead>
                <TableHead>Coordenadas</TableHead>
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
              ) : filteredPontos?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum ponto de saída encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredPontos?.map((ponto) => (
                  <TableRow key={ponto.id}>
                    <TableCell className="font-medium">{ponto.nome}</TableCell>
                    <TableCell>{ponto.endereco}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {ponto.latitude && ponto.longitude
                        ? `${ponto.latitude}, ${ponto.longitude}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ponto.ativo ? "default" : "secondary"}>
                        {ponto.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(ponto)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(ponto.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPonto ? "Editar Ponto de Saída" : "Novo Ponto de Saída"}
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
              <Label htmlFor="endereco">Endereço *</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                />
              </div>
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
