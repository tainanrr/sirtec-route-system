import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

interface ChecklistRespostaSimples {
  id: string;
  status: string;
  created_at: string;
  checklists?: {
    nome: string;
    tipo: string;
  } | null;
  ordens_servico?: {
    numero: string;
    tipo: string;
  } | null;
  tecnicos?: {
    codigo: string;
    nome: string;
  } | null;
}

export default function ConsultaChecklists() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(0);

  // Buscar contagem total de registros
  const { data: totalCount } = useQuery({
    queryKey: ["checklist-respostas-count", filtroStatus],
    queryFn: async () => {
      let query = supabase
        .from("checklist_respostas")
        .select("id", { count: "exact", head: true });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Buscar respostas de checklists com paginação - QUERY LEVE
  const { data: respostas, isLoading } = useQuery({
    queryKey: ["checklist-respostas", filtroTipo, filtroStatus, currentPage],
    queryFn: async () => {
      // Query simplificada - só campos necessários para a listagem
      let query = supabase
        .from("checklist_respostas")
        .select(`
          id,
          status,
          created_at,
          checklists (nome, tipo),
          ordens_servico (numero, tipo),
          tecnicos:equipe_id (codigo, nome)
        `)
        .order("created_at", { ascending: false })
        .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtrar por tipo de checklist (client-side já que é só 20 registros)
      let resultado = data as ChecklistRespostaSimples[];
      if (filtroTipo !== "todos") {
        resultado = resultado.filter(r => r.checklists?.tipo === filtroTipo);
      }

      return resultado;
    },
  });

  // Buscar tipos de checklists disponíveis
  const { data: tiposChecklists } = useQuery({
    queryKey: ["tipos-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("tipo")
        .order("tipo");

      if (error) throw error;

      const tipos = [...new Set(data.map(c => c.tipo))];
      return tipos;
    },
  });

  // Filtrar por termo de busca (client-side)
  const respostasFiltradas = respostas?.filter(r => {
    if (!searchTerm) return true;
    const termo = searchTerm.toLowerCase();
    return (
      r.checklists?.nome?.toLowerCase().includes(termo) ||
      r.ordens_servico?.numero?.toLowerCase().includes(termo) ||
      r.tecnicos?.codigo?.toLowerCase().includes(termo) ||
      r.tecnicos?.nome?.toLowerCase().includes(termo)
    );
  });

  // Abrir detalhes em nova guia
  const abrirNovaGuia = (id: string) => {
    window.open(`/consulta-checklists/${id}`, '_blank');
  };

  // Abrir detalhes na guia atual
  const abrirGuiaAtual = (id: string) => {
    navigate(`/consulta-checklists/${id}`);
  };

  // Calcular total de páginas
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  // Resetar página quando filtros mudam
  const handleFiltroChange = (tipo: "tipo" | "status", valor: string) => {
    setCurrentPage(0);
    if (tipo === "tipo") {
      setFiltroTipo(valor);
    } else {
      setFiltroStatus(valor);
    }
  };

  return (
    <MainLayout>
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-violet-600" />
            Consulta de Checklists
          </h1>
          <p className="text-muted-foreground">
            Visualize e analise os checklists preenchidos pelas equipes
          </p>
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
                  placeholder="Buscar por OS, equipe, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filtroTipo} onValueChange={(v) => handleFiltroChange("tipo", v)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tiposChecklists?.map(tipo => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={(v) => handleFiltroChange("status", v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="completo">Completo</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Respostas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Checklists Preenchidos
              {totalCount !== undefined && (
                <Badge variant="secondary" className="ml-2">
                  {totalCount}
                </Badge>
              )}
            </CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Página {currentPage + 1} de {totalPages}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : respostasFiltradas && respostasFiltradas.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checklist</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {respostasFiltradas.map((resposta) => (
                    <TableRow key={resposta.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-violet-600" />
                          <div>
                            <p className="font-medium">{resposta.checklists?.nome || "Checklist"}</p>
                            <p className="text-xs text-muted-foreground uppercase">
                              {resposta.checklists?.tipo}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {resposta.ordens_servico ? (
                          <div>
                            <p className="font-medium">#{resposta.ordens_servico.numero}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {resposta.ordens_servico.tipo}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {resposta.tecnicos ? (
                          <div>
                            <p className="font-medium">{resposta.tecnicos.codigo}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {resposta.tecnicos.nome}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(resposta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {resposta.status === "completo" ? (
                          <Badge className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Rascunho
                          </Badge>
                        )}
                      </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirGuiaAtual(resposta.id)}
                              title="Abrir nesta guia"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirNovaGuia(resposta.id)}
                              title="Abrir em nova guia"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {currentPage * ITEMS_PER_PAGE + 1} - {Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalCount || 0)} de {totalCount} registros
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i;
                        } else if (currentPage < 3) {
                          pageNum = i;
                        } else if (currentPage > totalPages - 4) {
                          pageNum = totalPages - 5 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum + 1}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum checklist encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </MainLayout>
  );
}
