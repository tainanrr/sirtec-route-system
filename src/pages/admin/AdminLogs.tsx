import { useState, useEffect, useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  History,
  RefreshCcw,
  Loader2,
  Eye,
  Calendar,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import {
  DataTableFilters,
  useDataTableFilters,
  filterData,
  FilterConfig,
} from "@/components/ui/data-table-filters";

interface LogSistema {
  id: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  acao: string;
  modulo: string;
  tabela: string | null;
  registro_id: string | null;
  dados_anteriores: any;
  dados_novos: any;
  detalhes: string | null;
  created_at: string;
}

const acaoColors: Record<string, string> = {
  criar: "bg-green-500",
  editar: "bg-blue-500",
  excluir: "bg-red-500",
  login: "bg-purple-500",
  logout: "bg-gray-500",
  visualizar: "bg-cyan-500",
};

const acaoOptions = [
  { value: "criar", label: "Criar", color: "bg-green-500" },
  { value: "editar", label: "Editar", color: "bg-blue-500" },
  { value: "excluir", label: "Excluir", color: "bg-red-500" },
  { value: "login", label: "Login", color: "bg-purple-500" },
  { value: "logout", label: "Logout", color: "bg-gray-500" },
  { value: "visualizar", label: "Visualizar", color: "bg-cyan-500" },
];

const moduloOptions = [
  { value: "admin", label: "Admin" },
  { value: "roteirizacao", label: "Roteirização" },
  { value: "cadastros", label: "Cadastros" },
  { value: "materiais", label: "Materiais" },
  { value: "ordens", label: "Ordens" },
  { value: "auth", label: "Autenticação" },
];

// Configuração dos filtros
const filterConfigs: FilterConfig[] = [
  {
    id: "search",
    label: "Buscar",
    type: "text",
    placeholder: "Buscar por usuário, tabela ou detalhes...",
  },
  {
    id: "acao",
    label: "Ação",
    type: "select",
    options: acaoOptions,
  },
  {
    id: "modulo",
    label: "Módulo",
    type: "select",
    options: moduloOptions,
  },
];

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogSistema | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 100;

  const { filterValues, setFilterValues, clearFilters, hasActiveFilters } =
    useDataTableFilters(filterConfigs);

  // Carregar logs
  const fetchLogs = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      
      let query = supabase
        .from("logs_sistema")
        .select("*")
        .order("created_at", { ascending: false })
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      const { data, error } = await query;

      if (error) throw error;

      if (reset) {
        setLogs(data || []);
        setPage(0);
      } else {
        setLogs((prev) => [...prev, ...(data || [])]);
      }

      setHasMore((data || []).length === pageSize);
    } catch (error: any) {
      console.error("Erro ao carregar logs:", error);
      toast.error("Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, []);

  // Filtrar dados
  const filteredLogs = useMemo(() => {
    return filterData(
      logs,
      filterValues,
      filterConfigs,
      {
        search: (item, value) => {
          const searchTerm = value.toLowerCase();
          return (
            item.usuario_nome?.toLowerCase().includes(searchTerm) ||
            item.tabela?.toLowerCase().includes(searchTerm) ||
            item.detalhes?.toLowerCase().includes(searchTerm) ||
            item.modulo.toLowerCase().includes(searchTerm) ||
            false
          );
        },
      }
    );
  }, [logs, filterValues]);

  // Ordenação
  const { sortConfig, handleSort, sortedData } = useSortableTable(
    filteredLogs,
    { column: "created_at", direction: "desc" }
  );

  const handleViewDetails = (log: LogSistema) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const loadMore = () => {
    setPage((prev) => prev + 1);
    fetchLogs(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Logs do Sistema</h2>
          <p className="text-muted-foreground">
            Histórico de todas as ações realizadas no sistema
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchLogs(true)} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
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

      {/* Estatísticas por ação */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {acaoOptions.map((acao) => {
          const count = logs.filter((l) => l.acao === acao.value).length;
          return (
            <button
              key={acao.value}
              onClick={() => setFilterValues({ ...filterValues, acao: acao.value })}
              className={`p-3 rounded-lg border transition-all hover:shadow-md ${
                filterValues.acao === acao.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${acao.color}`} />
                <span className="text-xs font-medium">{acao.label}</span>
              </div>
              <p className="text-xl font-bold mt-1">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Tabela de Logs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="created_at"
                label="Data/Hora"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="usuario_nome"
                label="Usuário"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="acao"
                label="Ação"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="modulo"
                label="Módulo"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                column="tabela"
                label="Tabela"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <TableHead>Detalhes</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sortedData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <History className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? "Nenhum log encontrado com os filtros aplicados"
                      : "Nenhum log registrado"}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                      Limpar filtros
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedData?.map((log) => (
                <TableRow key={log.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", {
                        locale: ptBR,
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">
                        {log.usuario_nome || "Sistema"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`${acaoColors[log.acao] || "bg-gray-500"} text-white`}
                    >
                      {log.acao}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.modulo}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.tabela || "-"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {log.detalhes || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(log)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando {sortedData?.length || 0} de {logs.length} logs
          </span>
          {hasMore && !loading && (
            <Button variant="outline" size="sm" onClick={loadMore}>
              Carregar mais
            </Button>
          )}
          {loading && logs.length > 0 && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Dialog de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Log</DialogTitle>
            <DialogDescription>
              {selectedLog &&
                format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", {
                  locale: ptBR,
                })}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Usuário</p>
                  <p className="font-medium">{selectedLog.usuario_nome || "Sistema"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Ação</p>
                  <Badge
                    variant="secondary"
                    className={`${acaoColors[selectedLog.acao] || "bg-gray-500"} text-white`}
                  >
                    {selectedLog.acao}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Módulo</p>
                  <p className="font-medium">{selectedLog.modulo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tabela</p>
                  <p className="font-mono">{selectedLog.tabela || "-"}</p>
                </div>
              </div>

              {selectedLog.registro_id && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">ID do Registro</p>
                  <p className="font-mono text-sm">{selectedLog.registro_id}</p>
                </div>
              )}

              {selectedLog.detalhes && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Detalhes</p>
                  <p className="text-sm">{selectedLog.detalhes}</p>
                </div>
              )}

              {selectedLog.dados_anteriores && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Dados Anteriores</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.dados_anteriores, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.dados_novos && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Dados Novos</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.dados_novos, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

