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
  MapPin,
  Monitor,
  Smartphone,
  Server,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Users,
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
import { cn } from "@/lib/utils";

interface LogSistema {
  id: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  equipe_id: string | null;
  equipe_codigo: string | null;
  acao: string;
  modulo: string;
  tabela: string | null;
  registro_id: string | null;
  dados_anteriores: any;
  dados_novos: any;
  detalhes: string | null;
  ip_address: string | null;
  user_agent: string | null;
  plataforma: string | null;
  latitude: number | null;
  longitude: number | null;
  duracao_ms: number | null;
  sucesso: boolean;
  erro_mensagem: string | null;
  created_at: string;
}

const acaoColors: Record<string, string> = {
  criar: "bg-green-500",
  editar: "bg-blue-500",
  excluir: "bg-red-500",
  login: "bg-purple-500",
  logout: "bg-gray-500",
  visualizar: "bg-cyan-500",
  exportar: "bg-orange-500",
  importar: "bg-teal-500",
  abrir_turno: "bg-indigo-500",
  fechar_turno: "bg-slate-500",
  executar: "bg-amber-500",
  aprovar: "bg-emerald-500",
  rejeitar: "bg-rose-500",
  sincronizar: "bg-violet-500",
};

const acaoOptions = [
  { value: "criar", label: "Criar", color: "bg-green-500" },
  { value: "editar", label: "Editar", color: "bg-blue-500" },
  { value: "excluir", label: "Excluir", color: "bg-red-500" },
  { value: "login", label: "Login", color: "bg-purple-500" },
  { value: "logout", label: "Logout", color: "bg-gray-500" },
  { value: "visualizar", label: "Visualizar", color: "bg-cyan-500" },
  { value: "exportar", label: "Exportar", color: "bg-orange-500" },
  { value: "abrir_turno", label: "Abrir Turno", color: "bg-indigo-500" },
  { value: "fechar_turno", label: "Fechar Turno", color: "bg-slate-500" },
];

const moduloOptions = [
  { value: "admin", label: "Admin" },
  { value: "roteirizacao", label: "Roteirização" },
  { value: "cadastros", label: "Cadastros" },
  { value: "materiais", label: "Materiais" },
  { value: "ordens", label: "Ordens" },
  { value: "auth", label: "Autenticação" },
  { value: "app", label: "App Mobile" },
  { value: "checklists", label: "Checklists" },
  { value: "procedimentos", label: "Procedimentos" },
  { value: "turnos", label: "Turnos" },
  { value: "equipes", label: "Equipes" },
  { value: "colaboradores", label: "Colaboradores" },
];

const plataformaOptions = [
  { value: "web", label: "Web", icon: Monitor },
  { value: "app", label: "App Mobile", icon: Smartphone },
  { value: "api", label: "API", icon: Server },
];

const statusOptions = [
  { value: "true", label: "Sucesso" },
  { value: "false", label: "Erro" },
];

// Configuração dos filtros
const filterConfigs: FilterConfig[] = [
  {
    id: "search",
    label: "Buscar",
    type: "text",
    placeholder: "Buscar por usuário, tabela, detalhes ou equipe...",
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
  {
    id: "plataforma",
    label: "Plataforma",
    type: "select",
    options: plataformaOptions,
  },
  {
    id: "sucesso",
    label: "Status",
    type: "select",
    options: statusOptions,
  },
];

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogSistema | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
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
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      if (reset) {
        setLogs(data || []);
        setPage(0);
        setTotalCount(count || 0);
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
            item.usuario_email?.toLowerCase().includes(searchTerm) ||
            item.equipe_codigo?.toLowerCase().includes(searchTerm) ||
            item.tabela?.toLowerCase().includes(searchTerm) ||
            item.detalhes?.toLowerCase().includes(searchTerm) ||
            item.modulo.toLowerCase().includes(searchTerm) ||
            item.erro_mensagem?.toLowerCase().includes(searchTerm) ||
            false
          );
        },
        sucesso: (item, value) => {
          return String(item.sucesso) === value;
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

  // Estatísticas
  const stats = useMemo(() => {
    const hoje = new Date().toDateString();
    const logsHoje = logs.filter(l => new Date(l.created_at).toDateString() === hoje);
    const erros = logs.filter(l => !l.sucesso);
    const webLogs = logs.filter(l => l.plataforma === "web");
    const appLogs = logs.filter(l => l.plataforma === "app");

    return {
      total: totalCount,
      hoje: logsHoje.length,
      erros: erros.length,
      web: webLogs.length,
      app: appLogs.length
    };
  }, [logs, totalCount]);

  // Formatar user agent para exibição
  const formatUserAgent = (ua: string | null): string => {
    if (!ua) return "-";
    
    // Detectar navegador
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    if (ua.includes("Mobile")) return "Mobile Browser";
    
    return ua.substring(0, 30) + "...";
  };

  // Ícone da plataforma
  const PlataformaIcon = ({ plataforma }: { plataforma: string | null }) => {
    switch (plataforma) {
      case "app":
        return <Smartphone className="h-3 w-3" />;
      case "api":
        return <Server className="h-3 w-3" />;
      default:
        return <Monitor className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <History className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-blue-600">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Hoje</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.hoje}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Erros</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.erros}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-purple-600">
            <Monitor className="h-4 w-4" />
            <span className="text-sm">Web</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.web}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-green-600">
            <Smartphone className="h-4 w-4" />
            <span className="text-sm">App</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.app}</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-2">
        <ExportButton
          data={logs}
          filename="logs_sistema"
          columns={[
            { key: "created_at", label: "Data/Hora", format: (v) => v ? new Date(v).toLocaleString("pt-BR") : "" },
            { key: "usuario_nome", label: "Usuário" },
            { key: "usuario_email", label: "Email" },
            { key: "equipe_codigo", label: "Equipe" },
            { key: "acao", label: "Ação" },
            { key: "modulo", label: "Módulo" },
            { key: "tabela", label: "Tabela" },
            { key: "registro_id", label: "ID Registro" },
            { key: "detalhes", label: "Detalhes" },
            { key: "plataforma", label: "Plataforma" },
            { key: "sucesso", label: "Sucesso", format: (v) => v ? "Sim" : "Não" },
            { key: "erro_mensagem", label: "Erro" },
            { key: "latitude", label: "Latitude" },
            { key: "longitude", label: "Longitude" },
            { key: "duracao_ms", label: "Duração (ms)" },
            { key: "user_agent", label: "User Agent" },
            { key: "dados_anteriores", label: "Dados Anteriores", format: (v) => v ? JSON.stringify(v) : "" },
            { key: "dados_novos", label: "Dados Novos", format: (v) => v ? JSON.stringify(v) : "" },
          ]}
          disabled={loading}
        />
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

      {/* Filtro rápido por ação */}
      <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
        {acaoOptions.map((acao) => {
          const count = logs.filter((l) => l.acao === acao.value).length;
          return (
            <button
              key={acao.value}
              onClick={() => setFilterValues({ ...filterValues, acao: filterValues.acao === acao.value ? "" : acao.value })}
              className={cn(
                "p-2 rounded-lg border transition-all hover:shadow-md text-center",
                filterValues.acao === acao.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/30"
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${acao.color}`} />
                <span className="text-xs font-medium truncate">{acao.label}</span>
              </div>
              <p className="text-lg font-bold mt-0.5">{count}</p>
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
                label="Usuário/Equipe"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <TableHead>Plataforma</TableHead>
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
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sortedData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
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
                <TableRow key={log.id} className={cn("group", !log.sucesso && "bg-red-50/50")}>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(log.created_at), "HH:mm:ss")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {log.usuario_nome || "Sistema"}
                        </span>
                      </div>
                      {log.equipe_codigo && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Equipe: {log.equipe_codigo}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <PlataformaIcon plataforma={log.plataforma} />
                      {log.plataforma || "web"}
                    </Badge>
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
                  <TableCell>
                    {log.sucesso ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-xs text-red-600 max-w-[100px] truncate" title={log.erro_mensagem || undefined}>
                          {log.erro_mensagem?.substring(0, 20)}...
                        </span>
                      </div>
                    )}
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
            Mostrando {sortedData?.length || 0} de {logs.length} logs carregados ({totalCount} total)
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Detalhes do Log
            </DialogTitle>
            <DialogDescription>
              {selectedLog &&
                format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", {
                  locale: ptBR,
                })}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Status */}
              {!selectedLog.sucesso && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">Erro na operação</span>
                  </div>
                  {selectedLog.erro_mensagem && (
                    <p className="text-sm text-red-600 mt-1">{selectedLog.erro_mensagem}</p>
                  )}
                </div>
              )}

              {/* Informações Básicas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Usuário</p>
                  <p className="font-medium">{selectedLog.usuario_nome || "Sistema"}</p>
                  {selectedLog.usuario_email && (
                    <p className="text-xs text-muted-foreground">{selectedLog.usuario_email}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Ação</p>
                  <Badge
                    variant="secondary"
                    className={`${acaoColors[selectedLog.acao] || "bg-gray-500"} text-white`}
                  >
                    {selectedLog.acao}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Módulo</p>
                  <Badge variant="outline">{selectedLog.modulo}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Plataforma</p>
                  <Badge variant="outline" className="gap-1">
                    <PlataformaIcon plataforma={selectedLog.plataforma} />
                    {selectedLog.plataforma || "web"}
                  </Badge>
                </div>
              </div>

              {/* Equipe (se app) */}
              {selectedLog.equipe_codigo && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">Equipe: {selectedLog.equipe_codigo}</span>
                  </div>
                </div>
              )}

              {/* Tabela e Registro */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Tabela</p>
                  <p className="font-mono text-sm">{selectedLog.tabela || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">ID do Registro</p>
                  <p className="font-mono text-sm break-all">{selectedLog.registro_id || "-"}</p>
                </div>
              </div>

              {/* Detalhes */}
              {selectedLog.detalhes && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Detalhes</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedLog.detalhes}</p>
                </div>
              )}

              {/* Geolocalização */}
              {(selectedLog.latitude || selectedLog.longitude) && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Localização
                  </p>
                  <div className="flex items-center gap-4">
                    <p className="font-mono text-sm">
                      {selectedLog.latitude?.toFixed(6)}, {selectedLog.longitude?.toFixed(6)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${selectedLog.latitude},${selectedLog.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ver no mapa ↗
                    </a>
                  </div>
                </div>
              )}

              {/* Metadados Técnicos */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3 rounded-lg bg-muted/30">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Duração
                  </p>
                  <p className="text-sm font-mono">
                    {selectedLog.duracao_ms ? `${selectedLog.duracao_ms}ms` : "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    IP
                  </p>
                  <p className="text-sm font-mono">{selectedLog.ip_address || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Monitor className="h-3 w-3" />
                    Navegador
                  </p>
                  <p className="text-sm" title={selectedLog.user_agent || undefined}>
                    {formatUserAgent(selectedLog.user_agent)}
                  </p>
                </div>
              </div>

              {/* Dados Anteriores */}
              {selectedLog.dados_anteriores && Object.keys(selectedLog.dados_anteriores).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Dados Anteriores</p>
                  <pre className="bg-red-50 text-red-900 p-3 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
                    {JSON.stringify(selectedLog.dados_anteriores, null, 2)}
                  </pre>
                </div>
              )}

              {/* Dados Novos */}
              {selectedLog.dados_novos && Object.keys(selectedLog.dados_novos).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Dados Novos</p>
                  <pre className="bg-green-50 text-green-900 p-3 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
                    {JSON.stringify(selectedLog.dados_novos, null, 2)}
                  </pre>
                </div>
              )}

              {/* User Agent Completo */}
              {selectedLog.user_agent && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">User Agent Completo</p>
                  <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
