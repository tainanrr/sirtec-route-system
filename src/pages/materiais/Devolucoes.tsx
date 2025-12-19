import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SortableTableHead, SortConfig } from "@/components/ui/sortable-table-head";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  Package,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  ClipboardCheck,
  QrCode,
} from "lucide-react";

type DevolucaoStatus = "pendente" | "conferida" | "cancelada";

interface Devolucao {
  id: string;
  equipe_id: string;
  status: DevolucaoStatus;
  observacao: string | null;
  data_solicitacao: string;
  data_conferencia: string | null;
  recebido_por: string | null;
  created_at: string;
  tecnicos?: { codigo: string; nome: string } | null;
}

interface DevolucaoItem {
  devolucao_id: string;
  material_id: string;
  quantidade_solicitada: number;
  quantidade_conferida: number | null;
  observacao: string | null;
  materiais?: { codigo: string; nome: string; unidade: string; requer_serial?: boolean } | null;
}

interface DevolucaoRastro {
  devolucao_id: string;
  material_id: string;
  numero_serie: string;
  conferido: boolean;
}

function statusBadge(status: DevolucaoStatus) {
  switch (status) {
    case "pendente":
      return <Badge className="bg-amber-100 text-amber-700 border-0">Pendente</Badge>;
    case "conferida":
      return <Badge className="bg-green-100 text-green-700 border-0">Conferida</Badge>;
    case "cancelada":
      return <Badge className="bg-gray-100 text-gray-700 border-0">Cancelada</Badge>;
  }
}

function safeUpperList(text: string) {
  return text
    .split(/\r?\n|,|;|\t/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toUpperCase());
}

export default function Devolucoes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<DevolucaoStatus | "todos">("todos");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const [viewDialog, setViewDialog] = useState(false);
  const [conferirDialog, setConferirDialog] = useState(false);
  const [selected, setSelected] = useState<Devolucao | null>(null);
  const [cancelDialog, setCancelDialog] = useState(false);

  const [recebidoPor, setRecebidoPor] = useState("");
  const [itensConferencia, setItensConferencia] = useState<Record<string, number>>({});
  const [rastrosTexto, setRastrosTexto] = useState<Record<string, string>>({}); // key material_id -> textarea
  const [editarRastros, setEditarRastros] = useState<{ open: boolean; materialId: string; titulo: string }>({
    open: false,
    materialId: "",
    titulo: "",
  });

  const { data: devolucoes, isLoading } = useQuery({
    queryKey: ["materiais-devolucoes", filtroStatus, searchTerm],
    queryFn: async () => {
      let query = (supabase as any)
        .from("materiais_devolucoes")
        .select(`
          id,
          equipe_id,
          status,
          observacao,
          data_solicitacao,
          data_conferencia,
          recebido_por,
          created_at,
          tecnicos:equipe_id (codigo, nome)
        `)
        .order("created_at", { ascending: false });

      if (filtroStatus !== "todos") query = query.eq("status", filtroStatus);

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data || []) as Devolucao[];
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        rows = rows.filter(
          (d) =>
            d.tecnicos?.codigo?.toLowerCase().includes(term) ||
            d.tecnicos?.nome?.toLowerCase().includes(term) ||
            d.observacao?.toLowerCase().includes(term)
        );
      }
      return rows;
    },
  });

  const devolucoesOrdenadas = useMemo(() => {
    if (!devolucoes || !sortConfig || !sortConfig.direction) return devolucoes;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    return [...devolucoes].sort((a: any, b: any) => {
      let av: any = null;
      let bv: any = null;
      switch (sortConfig.column) {
        case "created_at":
          av = new Date(a.created_at).getTime();
          bv = new Date(b.created_at).getTime();
          break;
        case "equipe":
          av = a.tecnicos?.codigo || "";
          bv = b.tecnicos?.codigo || "";
          break;
        case "status":
          av = a.status || "";
          bv = b.status || "";
          break;
        default:
          av = a[sortConfig.column];
          bv = b[sortConfig.column];
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1 * dir;
      if (bv == null) return -1 * dir;
      return String(av).localeCompare(String(bv), "pt-BR", { numeric: true }) * dir;
    });
  }, [devolucoes, sortConfig]);

  const { data: itens, isLoading: loadingItens } = useQuery({
    queryKey: ["materiais-devolucao-itens", selected?.id],
    enabled: !!selected?.id && (viewDialog || conferirDialog),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais_devolucoes_itens")
        .select(`
          devolucao_id,
          material_id,
          quantidade_solicitada,
          quantidade_conferida,
          observacao,
          materiais (codigo, nome, unidade, requer_serial)
        `)
        .eq("devolucao_id", selected!.id);
      if (error) throw error;
      return (data || []) as DevolucaoItem[];
    },
  });

  const { data: rastros } = useQuery({
    queryKey: ["materiais-devolucao-rastros", selected?.id],
    enabled: !!selected?.id && (viewDialog || conferirDialog),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais_devolucoes_itens_rastros")
        .select("devolucao_id, material_id, numero_serie, conferido")
        .eq("devolucao_id", selected!.id);
      if (error) throw error;
      return (data || []) as DevolucaoRastro[];
    },
  });

  const iniciarConferencia = () => {
    if (!itens?.length) return;
    const map: Record<string, number> = {};
    itens.forEach((i) => {
      map[i.material_id] = i.quantidade_conferida ?? i.quantidade_solicitada;
    });
    setItensConferencia(map);

    const rMap: Record<string, string> = {};
    (rastros || []).forEach((r) => {
      if (!rMap[r.material_id]) rMap[r.material_id] = "";
      if (r.conferido) rMap[r.material_id] += `${String(r.numero_serie).toUpperCase()}\n`;
    });
    setRastrosTexto(rMap);
  };

  const cancelarMutation = useMutation({
    mutationFn: async (dev: Devolucao) => {
      const { error } = await (supabase as any)
        .from("materiais_devolucoes")
        .update({ status: "cancelada" })
        .eq("id", dev.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devolução cancelada.");
      queryClient.invalidateQueries({ queryKey: ["materiais-devolucoes"] });
      setCancelDialog(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao cancelar devolução"),
  });

  const confirmarMutation = useMutation({
    mutationFn: async () => {
      if (!selected?.id) throw new Error("Selecione uma devolução");
      if (selected.status !== "pendente") throw new Error("Apenas devoluções pendentes podem ser conferidas");

      // 1) Persistir quantidades conferidas
      if (itens?.length) {
        for (const item of itens) {
          const qtd = itensConferencia[item.material_id];
          const { error } = await (supabase as any)
            .from("materiais_devolucoes_itens")
            .update({ quantidade_conferida: qtd })
            .eq("devolucao_id", selected.id)
            .eq("material_id", item.material_id);
          if (error) throw error;
        }
      }

      // 2) Persistir rastros conferidos (best-effort)
      // - se usuário editou lista: marca conferido=true para os presentes, false para os ausentes
      if (rastros?.length || Object.keys(rastrosTexto).length) {
        const existentes = rastros || [];
        const porMat = new Map<string, DevolucaoRastro[]>();
        existentes.forEach((r) => {
          const arr = porMat.get(r.material_id) || [];
          arr.push(r);
          porMat.set(r.material_id, arr);
        });

        for (const [materialId, texto] of Object.entries(rastrosTexto)) {
          const lista = new Set(safeUpperList(texto));
          const atuais = porMat.get(materialId) || [];

          // atualizar os existentes
          for (const r of atuais) {
            const should = lista.has(String(r.numero_serie).toUpperCase());
            if (Boolean(r.conferido) !== should) {
              const { error } = await (supabase as any)
                .from("materiais_devolucoes_itens_rastros")
                .update({ conferido: should })
                .eq("devolucao_id", selected.id)
                .eq("material_id", materialId)
                .eq("numero_serie", r.numero_serie);
              if (error) throw error;
            }
          }

          // inserir novos digitados (se houver)
          const existentesUpper = new Set(atuais.map((r) => String(r.numero_serie).toUpperCase()));
          const novos = [...lista].filter((ns) => !existentesUpper.has(ns));
          if (novos.length) {
            const payload = novos.map((ns) => ({
              devolucao_id: selected.id,
              material_id: materialId,
              numero_serie: ns,
              conferido: true,
            }));
            const { error } = await (supabase as any)
              .from("materiais_devolucoes_itens_rastros")
              .insert(payload);
            if (error) throw error;
          }
        }
      }

      // 3) Confirmar via RPC (atômico / idempotente)
      const { error } = await (supabase as any).rpc("confirmar_devolucao", {
        p_devolucao_id: selected.id,
        p_recebido_por: recebidoPor || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devolução conferida e confirmada!");
      queryClient.invalidateQueries({ queryKey: ["materiais-devolucoes"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["materiais-serializados"] });
      setConferirDialog(false);
      setViewDialog(false);
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message || "Erro ao confirmar devolução");
    },
  });

  return (
    <MainLayout title="Devoluções">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link to="/materiais">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-violet-600" />
                Devoluções
              </h1>
              <p className="text-muted-foreground text-sm">
                Materiais devolvidos pelas equipes (pendente de conferência no almoxarifado)
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por equipe ou observação..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="conferida">Conferida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : devolucoesOrdenadas?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      column="created_at"
                      label="Data"
                      sortConfig={sortConfig}
                      onSort={(c) =>
                        setSortConfig((cur) => {
                          if (cur?.column === c) {
                            if (cur.direction === "asc") return { column: c, direction: "desc" };
                            if (cur.direction === "desc") return null;
                          }
                          return { column: c, direction: "asc" };
                        })
                      }
                    />
                    <SortableTableHead
                      column="equipe"
                      label="Equipe"
                      sortConfig={sortConfig}
                      onSort={(c) =>
                        setSortConfig((cur) => {
                          if (cur?.column === c) {
                            if (cur.direction === "asc") return { column: c, direction: "desc" };
                            if (cur.direction === "desc") return null;
                          }
                          return { column: c, direction: "asc" };
                        })
                      }
                    />
                    <SortableTableHead
                      column="status"
                      label="Status"
                      sortConfig={sortConfig}
                      onSort={(c) =>
                        setSortConfig((cur) => {
                          if (cur?.column === c) {
                            if (cur.direction === "asc") return { column: c, direction: "desc" };
                            if (cur.direction === "desc") return null;
                          }
                          return { column: c, direction: "asc" };
                        })
                      }
                      className="text-center"
                    />
                    <TableHead>Observação</TableHead>
                    <TableHead className="text-right w-[160px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devolucoesOrdenadas.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {format(new Date(d.created_at), "dd/MM/yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(d.created_at), "HH:mm")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{d.tecnicos?.codigo || "-"}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{d.tecnicos?.nome || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{statusBadge(d.status)}</TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground line-clamp-1 max-w-[380px]">
                          {d.observacao || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelected(d);
                              setViewDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                          {d.status === "pendente" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelected(d);
                                setConferirDialog(true);
                              }}
                            >
                              <ClipboardCheck className="h-4 w-4 mr-1" />
                              Conferir
                            </Button>
                          )}
                          {d.status === "pendente" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                setSelected(d);
                                setCancelDialog(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma devolução encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ver detalhes */}
        <Dialog
          open={viewDialog}
          onOpenChange={(open) => {
            setViewDialog(open);
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className="w-[98vw] max-w-5xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Detalhes da devolução</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {!selected ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Equipe</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="font-semibold">{selected.tecnicos?.codigo || "-"}</p>
                        <p className="text-xs text-muted-foreground">{selected.tecnicos?.nome || ""}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
                      </CardHeader>
                      <CardContent>{statusBadge(selected.status)}</CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Solicitada em</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium">{format(new Date(selected.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <Label>Observação</Label>
                    <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                      {selected.observacao || "-"}
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[900px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead className="text-center">Solicitado</TableHead>
                            <TableHead className="text-center">Conferido</TableHead>
                            <TableHead className="text-center">Rastros</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingItens ? (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <Skeleton className="h-10 w-full" />
                              </TableCell>
                            </TableRow>
                          ) : (itens || []).map((i) => {
                            const rs = (rastros || []).filter((r) => r.material_id === i.material_id && r.conferido);
                            return (
                              <TableRow key={i.material_id}>
                                <TableCell>
                                  <p className="font-medium">{i.materiais?.codigo || "-"}</p>
                                  <p className="text-xs text-muted-foreground">{i.materiais?.nome || ""}</p>
                                </TableCell>
                                <TableCell className="text-center">
                                  {i.quantidade_solicitada} {i.materiais?.unidade || ""}
                                </TableCell>
                                <TableCell className="text-center">
                                  {i.quantidade_conferida ?? "-"}
                                </TableCell>
                                <TableCell className="text-center">
                                  {i.materiais?.requer_serial ? (
                                    <Badge variant="outline" className="text-xs">
                                      <QrCode className="h-3 w-3 mr-1" /> {rs.length}
                                    </Badge>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialog(false)}>
                Fechar
              </Button>
              {selected?.status === "pendente" && (
                <Button
                  onClick={() => {
                    setViewDialog(false);
                    setConferirDialog(true);
                  }}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Conferir devolução
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Conferir/Confirmar */}
        <Dialog
          open={conferirDialog}
          onOpenChange={(open) => {
            setConferirDialog(open);
            if (open) {
              // pré-carregar estado assim que dados estiverem disponíveis
              window.setTimeout(iniciarConferencia, 0);
            } else {
              setRecebidoPor("");
              setItensConferencia({});
              setRastrosTexto({});
              setEditarRastros({ open: false, materialId: "", titulo: "" });
            }
          }}
        >
          <DialogContent className="w-[98vw] max-w-6xl max-h-[92vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Conferir devolução</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {!selected ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Equipe</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="font-semibold">{selected.tecnicos?.codigo || "-"}</p>
                        <p className="text-xs text-muted-foreground">{selected.tecnicos?.nome || ""}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Recebido por</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Input
                          placeholder="Nome do almoxarife (opcional)"
                          value={recebidoPor}
                          onChange={(e) => setRecebidoPor(e.target.value)}
                        />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
                      </CardHeader>
                      <CardContent>{statusBadge(selected.status)}</CardContent>
                    </Card>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[1050px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead className="text-center">Solicitado</TableHead>
                            <TableHead className="text-center">Conferido</TableHead>
                            <TableHead className="text-center">Rastros/Seriais</TableHead>
                            <TableHead>Obs.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingItens ? (
                            <TableRow>
                              <TableCell colSpan={5}>
                                <Skeleton className="h-10 w-full" />
                              </TableCell>
                            </TableRow>
                          ) : (itens || []).map((i) => {
                            const rs = (rastros || []).filter((r) => r.material_id === i.material_id);
                            const conferidos = rs.filter((r) => r.conferido);
                            const isSerial = Boolean(i.materiais?.requer_serial);
                            return (
                              <TableRow key={i.material_id}>
                                <TableCell>
                                  <p className="font-medium">{i.materiais?.codigo || "-"}</p>
                                  <p className="text-xs text-muted-foreground">{i.materiais?.nome || ""}</p>
                                </TableCell>
                                <TableCell className="text-center">
                                  {i.quantidade_solicitada} {i.materiais?.unidade || ""}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    className="w-24 mx-auto text-center"
                                    value={itensConferencia[i.material_id] ?? i.quantidade_conferida ?? i.quantidade_solicitada}
                                    onChange={(e) =>
                                      setItensConferencia((p) => ({
                                        ...p,
                                        [i.material_id]: Math.max(0, Number(e.target.value || 0)),
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  {isSerial ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        <QrCode className="h-3 w-3 mr-1" />
                                        {conferidos.length || 0}
                                      </Badge>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => {
                                          const codigo = i.materiais?.codigo || "Material";
                                          setEditarRastros({ open: true, materialId: i.material_id, titulo: `Rastros - ${codigo}` });
                                        }}
                                      >
                                        Editar
                                      </Button>
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell>
                                  <p className="text-xs text-muted-foreground line-clamp-1 max-w-[320px]">
                                    {i.observacao || "-"}
                                  </p>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setConferirDialog(false)} disabled={confirmarMutation.isPending}>
                Voltar
              </Button>
              <Button onClick={() => confirmarMutation.mutate()} disabled={!selected || confirmarMutation.isPending}>
                {confirmarMutation.isPending ? (
                  "Confirmando..."
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar devolução
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Editor de rastros */}
        <Dialog
          open={editarRastros.open}
          onOpenChange={(open) => setEditarRastros((p) => ({ ...p, open }))}
        >
          <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editarRastros.titulo}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Seriais conferidos (1 por linha)</Label>
              <Textarea
                rows={12}
                className="font-mono"
                value={rastrosTexto[editarRastros.materialId] || ""}
                onChange={(e) => setRastrosTexto((p) => ({ ...p, [editarRastros.materialId]: e.target.value }))}
                placeholder="Cole ou digite os seriais aqui..."
              />
              <p className="text-xs text-muted-foreground">
                Dica: você pode colar uma lista com quebras de linha, vírgulas ou ponto-e-vírgula.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditarRastros({ open: false, materialId: "", titulo: "" })}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancelar */}
        <AlertDialog open={cancelDialog} onOpenChange={setCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar devolução?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso marca a devolução como cancelada. Não haverá movimentação de estoque.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelarMutation.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!selected || cancelarMutation.isPending}
                onClick={() => selected && cancelarMutation.mutate(selected)}
              >
                {cancelarMutation.isPending ? "Cancelando..." : "Confirmar cancelamento"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}


