import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Clock, DollarSign, CheckCircle, XCircle, Loader2, RefreshCcw, Wrench } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { SkillFormDialog } from "@/components/skills/SkillFormDialog";
import type { Tables } from "@/integrations/supabase/types";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";

type Skill = Tables<"skills">;

// Configuração dos filtros
const filterConfigs: FilterConfig[] = [
  {
    id: "search",
    label: "Buscar",
    type: "text",
    placeholder: "Buscar por código, nome ou descrição...",
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "ativo", label: "Ativas", color: "bg-green-500" },
      { value: "inativo", label: "Inativas", color: "bg-gray-500" },
    ],
  },
  {
    id: "regulada",
    label: "Regulada",
    type: "select",
    options: [
      { value: "sim", label: "Sim", color: "bg-green-500" },
      { value: "nao", label: "Não", color: "bg-gray-500" },
    ],
  },
];

export default function Skills() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const queryClient = useQueryClient();

  // Filtros
  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  const { data: skills, isLoading, refetch } = useQuery({
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

  // Filtrar dados
  const filteredSkills = useMemo(() => {
    if (!skills) return [];
    return filterData(
      skills,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm) ||
            item.descricao?.toLowerCase().includes(searchTerm) || false
          );
        },
        status: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
        regulada: (item, value) => {
          if (value === "sim") return item.regulada === true;
          if (value === "nao") return item.regulada === false || item.regulada === null;
          return true;
        },
      }
    );
  }, [skills, filterValues]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredSkills,
    { column: "codigo", direction: "asc" }
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
    <MainLayout
      title="Cadastro de Skills"
      subtitle="Gerencie as habilidades e tempos de execução"
      breadcrumbs={[
        { label: "Cadastros", href: "/cadastros" },
        { label: "Skills" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              {skills?.filter((s) => s.ativo).length || 0} Ativas
            </Badge>
            <Badge variant="outline" className="text-sm">
              {skills?.filter((s) => !s.ativo).length || 0} Inativas
            </Badge>
            <Badge variant="outline" className="text-sm">
              {skills?.filter((s) => s.regulada).length || 0} Reguladas
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Skill
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
                  column="codigo"
                  label="Código"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="nome"
                  label="Nome"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <TableHead>Descrição</TableHead>
                <SortableTableHead
                  column="tempo_execucao_minutos"
                  label="Tempo (min)"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  className="text-center"
                />
                <SortableTableHead
                  column="valor"
                  label="Valor (R$)"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  className="text-center"
                />
                <SortableTableHead
                  column="regulada"
                  label="Regulada"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  className="text-center"
                />
                <TableHead className="text-center">Ícone</TableHead>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : sortedData?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Wrench className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      {hasActiveFilters
                        ? "Nenhuma skill encontrada com os filtros aplicados"
                        : "Nenhuma skill cadastrada"}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                        Limpar filtros
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData?.map((skill) => (
                  <TableRow key={skill.id} className="group">
                    <TableCell className="font-mono font-semibold">{skill.codigo}</TableCell>
                    <TableCell className="font-medium">{skill.nome}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {skill.descricao || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        <Clock className="h-3 w-3 mr-1" />
                        {skill.tempo_execucao_minutos} min
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono text-green-600">
                        <DollarSign className="h-3 w-3 mr-0.5" />
                        {Number(skill.valor || 0).toFixed(2)}
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
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(skill)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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

          {sortedData && sortedData.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
              Mostrando {sortedData.length} de {skills?.length || 0} skills
            </div>
          )}
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
