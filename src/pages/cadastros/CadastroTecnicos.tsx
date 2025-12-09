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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { TecnicoFormDialog } from "@/components/equipes/TecnicoFormDialog";
import type { Tables } from "@/integrations/supabase/types";

type Tecnico = Tables<"tecnicos">;

export default function CadastroTecnicos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  const queryClient = useQueryClient();

  const { data: tecnicos, isLoading } = useQuery({
    queryKey: ["tecnicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Tecnico[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tecnicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tecnicos"] });
      toast.success("Técnico excluído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir técnico");
    },
  });

  const filteredTecnicos = tecnicos?.filter(
    (t) =>
      t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (tecnico: Tecnico) => {
    setSelectedTecnico(tecnico);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedTecnico(null);
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      disponivel: "default",
      em_campo: "secondary",
      indisponivel: "destructive",
    };
    const labels: Record<string, string> = {
      disponivel: "Disponível",
      em_campo: "Em Campo",
      indisponivel: "Indisponível",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["tecnicos"] });
  };

  return (
    <MainLayout title="Cadastro de Técnicos" subtitle="Gerencie os técnicos da equipe">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Técnico
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
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
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Habilidades</TableHead>
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
              ) : filteredTecnicos?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum técnico encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredTecnicos?.map((tecnico) => (
                  <TableRow key={tecnico.id}>
                    <TableCell className="font-mono">{tecnico.codigo}</TableCell>
                    <TableCell className="font-medium">{tecnico.nome}</TableCell>
                    <TableCell>{tecnico.telefone || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tecnico.habilidades?.slice(0, 2).map((h) => (
                          <Badge key={h} variant="outline" className="text-xs">
                            {h}
                          </Badge>
                        ))}
                        {(tecnico.habilidades?.length || 0) > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{(tecnico.habilidades?.length || 0) - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(tecnico.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(tecnico)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(tecnico.id)}
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

      <TecnicoFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        tecnico={selectedTecnico}
        onSuccess={handleSuccess}
      />
    </MainLayout>
  );
}
