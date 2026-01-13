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
import { Plus, Pencil, Trash2, Users, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { TecnicoFormDialog } from "@/components/equipes/TecnicoFormDialog";
import type { Tables } from "@/integrations/supabase/types";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";
import { ExportButton } from "@/components/ui/export-button";

type Tecnico = Tables<"tecnicos">;

const statusOptions = [
  { value: "disponivel", label: "Disponível", color: "bg-green-500" },
  { value: "em_campo", label: "Em Campo", color: "bg-blue-500" },
  { value: "indisponivel", label: "Indisponível", color: "bg-red-500" },
];

// Configuração dos filtros
const filterConfigs: FilterConfig[] = [
  {
    id: "search",
    label: "Buscar",
    type: "text",
    placeholder: "Buscar por código, nome ou telefone...",
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: statusOptions,
  },
  {
    id: "ativo",
    label: "Situação",
    type: "select",
    options: [
      { value: "ativo", label: "Ativos", color: "bg-green-500" },
      { value: "inativo", label: "Inativos", color: "bg-gray-500" },
    ],
  },
];

export default function CadastroTecnicos() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  const queryClient = useQueryClient();

  // Filtros
  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  const { data: tecnicos, isLoading, refetch } = useQuery({
    queryKey: ["tecnicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("*")
        .order("codigo");
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

  // Filtrar dados
  const filteredTecnicos = useMemo(() => {
    if (!tecnicos) return [];
    return filterData(
      tecnicos,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.nome.toLowerCase().includes(searchTerm) ||
            item.telefone?.toLowerCase().includes(searchTerm) || false
          );
        },
        ativo: (item, value) => {
          if (value === "ativo") return item.ativo;
          if (value === "inativo") return !item.ativo;
          return true;
        },
      }
    );
  }, [tecnicos, filterValues]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredTecnicos,
    { column: "codigo", direction: "asc" }
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
    const statusOpt = statusOptions.find((s) => s.value === status);
    return (
      <Badge className={`${statusOpt?.color || "bg-gray-500"} text-white`}>
        {statusOpt?.label || status}
      </Badge>
    );
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["tecnicos"] });
  };

  return (
    <MainLayout
      title="Técnicos"
      breadcrumbs={[
        { label: "Cadastros" },
        { label: "Técnicos" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {statusOptions.map((status) => {
              const count = tecnicos?.filter((t) => t.status === status.value).length || 0;
              return (
                <button
                  key={status.value}
                  onClick={() => setFilterValues({ ...filterValues, status: status.value })}
                  className={`px-3 py-1.5 rounded-lg border transition-all text-sm ${
                    filterValues.status === status.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                    <span>{status.label}</span>
                    <Badge variant="secondary" className="ml-1">{count}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              data={tecnicos || []}
              filename="tecnicos"
              columns={[
                { key: "codigo", label: "Código" },
                { key: "nome", label: "Nome" },
                { key: "telefone", label: "Telefone" },
                { key: "status", label: "Status" },
                { key: "hora_inicio", label: "Hora Início" },
                { key: "jornada_horas", label: "Jornada (horas)" },
                { key: "max_horas_trabalho", label: "Máx Horas Trabalho" },
                { key: "habilidades", label: "Habilidades", format: (v) => Array.isArray(v) ? v.join(", ") : "" },
                { key: "color", label: "Cor" },
                { key: "placa_veiculo", label: "Placa Veículo" },
                { key: "ativo", label: "Ativo", format: (v) => v ? "Sim" : "Não" },
              ]}
              disabled={isLoading}
            />
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Técnico
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
                <SortableTableHead
                  column="telefone"
                  label="Telefone"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <TableHead>Habilidades</TableHead>
                <SortableTableHead
                  column="status"
                  label="Status"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableTableHead
                  column="ativo"
                  label="Ativo"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : sortedData?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      {hasActiveFilters
                        ? "Nenhum técnico encontrado com os filtros aplicados"
                        : "Nenhum técnico cadastrado"}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                        Limpar filtros
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData?.map((tecnico) => (
                  <TableRow key={tecnico.id} className="group">
                    <TableCell className="font-mono font-medium">{tecnico.codigo}</TableCell>
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
                        {(!tecnico.habilidades || tecnico.habilidades.length === 0) && (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(tecnico.status)}</TableCell>
                    <TableCell>
                      <Badge variant={tecnico.ativo ? "default" : "secondary"}>
                        {tecnico.ativo ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(tecnico)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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

          {sortedData && sortedData.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
              Mostrando {sortedData.length} de {tecnicos?.length || 0} técnicos
            </div>
          )}
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
