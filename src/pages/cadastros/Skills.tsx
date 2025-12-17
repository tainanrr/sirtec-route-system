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
import { Plus, Pencil, Trash2, Search, Clock, DollarSign, CheckCircle, XCircle } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { SkillFormDialog } from "@/components/skills/SkillFormDialog";
import type { Tables } from "@/integrations/supabase/types";

type Skill = Tables<"skills">;

export default function Skills() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const queryClient = useQueryClient();

  const { data: skills, isLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return data as Skill[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("skills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      toast.success("Skill excluída com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir skill");
    },
  });

  const filteredSkills = skills?.filter(
    (s) =>
      s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (skill: Skill) => {
    setSelectedSkill(skill);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedSkill(null);
    setIsDialogOpen(true);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["skills"] });
  };

  return (
    <MainLayout title="Cadastro de Skills" subtitle="Gerencie as habilidades e tempos de execução">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Skill
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, nome ou descrição..."
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
                <TableHead>Descrição</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-4 w-4" />
                    Tempo (min)
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Valor (R$)
                  </div>
                </TableHead>
                <TableHead className="text-center">Regulada</TableHead>
                <TableHead className="text-center">Ícone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredSkills?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma skill encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredSkills?.map((skill) => (
                  <TableRow key={skill.id}>
                    <TableCell className="font-mono font-semibold">{skill.codigo}</TableCell>
                    <TableCell className="font-medium">{skill.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {skill.descricao || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {skill.tempo_execucao_minutos} min
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        R$ {Number(skill.valor || 0).toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {skill.regulada ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Sim
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Não
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {skill.icone ? (
                        (() => {
                          const IconComponent = (LucideIcons as any)[skill.icone];
                          return IconComponent ? (
                            <IconComponent className="h-5 w-5 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground text-xs">{skill.icone}</span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={skill.ativo ? "default" : "secondary"}>
                        {skill.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(skill)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(skill.id)}
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

      <SkillFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        skill={selectedSkill}
        onSuccess={handleSuccess}
      />
    </MainLayout>
  );
}

