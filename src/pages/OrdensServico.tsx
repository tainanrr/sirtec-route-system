import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Download,
  Zap,
  MapPin,
  Edit,
  Trash2,
  Eye,
  Upload,
  FileText,
  Trash,
  Globe,
  Loader2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrdemServicoFormDialog } from "@/components/ordens/OrdemServicoFormDialog";
import { OrdemServicoDetalhesDialog } from "@/components/ordens/OrdemServicoDetalhesDialog";
import { ImportacaoOSDialog } from "@/components/ordens/ImportacaoOSDialog";
import type { Tables } from "@/integrations/supabase/types";
import * as XLSX from "xlsx";
import { fetchSkills } from "@/lib/skillsUtils";
import { geocodeAddress } from "@/lib/geocodingUtils";
import { Progress } from "@/components/ui/progress";
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

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  planejada: "Planejada",
  andamento: "Em Andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

const tipoLabels: Record<string, string> = {
  corte: "Corte",
  religa: "Religa",
  ligacao: "Ligação Nova",
  inspecao: "Inspeção",
  manutencao: "Manutenção",
  troca_medidor: "Troca de Medidor",
};

type OrdemWithTecnico = Tables<"ordens_servico"> & {
  tecnicos: Pick<Tables<"tecnicos">, "codigo" | "nome"> | null;
};

const OrdensServico = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [ordens, setOrdens] = useState<OrdemWithTecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedOrdem, setSelectedOrdem] = useState<Tables<"ordens_servico"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ordemToDelete, setOrdemToDelete] = useState<Tables<"ordens_servico"> | null>(null);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [geocodingInProgress, setGeocodingInProgress] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0, endereco: "" });
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [ordemDetalhesId, setOrdemDetalhesId] = useState<string | null>(null);

  const fetchOrdens = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`
        *,
        tecnicos:tecnico_id (codigo, nome)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar ordens de serviço");
    } else {
      setOrdens((data as OrdemWithTecnico[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrdens();
  }, []);

  const handleEdit = (ordem: Tables<"ordens_servico">) => {
    setSelectedOrdem(ordem);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!ordemToDelete) return;

    const { error } = await supabase
      .from("ordens_servico")
      .delete()
      .eq("id", ordemToDelete.id);

    if (error) {
      toast.error("Erro ao excluir ordem de serviço");
    } else {
      toast.success("Ordem de serviço excluída");
      fetchOrdens();
    }
    setDeleteDialogOpen(false);
    setOrdemToDelete(null);
  };

  const handleCancelAll = async () => {
    try {
      // Contar quantas ordens não estão canceladas
      const { count, error: countError } = await supabase
        .from("ordens_servico")
        .select("*", { count: "exact", head: true })
        .neq("status", "cancelada");

      if (countError) {
        toast.error("Erro ao buscar ordens de serviço");
        setClearAllDialogOpen(false);
        return;
      }

      if (!count || count === 0) {
        toast.info("Não há ordens de serviço para cancelar (todas já estão canceladas)");
        setClearAllDialogOpen(false);
        return;
      }

      toast.info(`Cancelando ${count} ordens de serviço...`);

      // Atualizar todas as ordens não canceladas de uma vez (sem filtro por ID)
      const { error: updateError } = await supabase
        .from("ordens_servico")
        .update({ 
          status: "cancelada",
          equipe_planejada_id: null,
          data_planejada: null
        })
        .neq("status", "cancelada");

      if (updateError) {
        console.error("Erro ao cancelar ordens:", updateError);
        toast.error(`Erro ao cancelar ordens de serviço: ${updateError.message}`);
      } else {
        // Limpar todos os planejamentos de ordens
        await supabase
          .from("planejamento_ordens")
          .delete()
          .not("ordem_servico_id", "is", null);

        toast.success(`${count} ordem(ns) de serviço cancelada(s) com sucesso!`);
      }

      fetchOrdens();
    } catch (error: any) {
      console.error("Erro ao cancelar ordens:", error);
      toast.error(`Erro ao cancelar ordens de serviço: ${error.message}`);
    }
    
    setClearAllDialogOpen(false);
  };

  const handleDownloadModel = async () => {
    try {
      // Buscar skills disponíveis do banco
      const skillsDisponiveis = await fetchSkills();
      
      if (skillsDisponiveis.length === 0) {
        toast.error("Nenhum tipo cadastrado em Skills. Cadastre pelo menos um tipo antes de gerar o modelo.");
        return;
      }

      // Cabeçalhos do Excel (sem duracao_estimada, valor e regulada - preenchidos automaticamente pelo cadastro de Skills)
      const headers = [
        "numero",
        "tipo",
        "status",
        "endereco",
        "cliente_nome",
        "cliente_cpf",
        "instalacao",
        "medidor",
        "prazo",
        "latitude",
        "longitude",
        "observacoes"
      ];

      // Criar exemplos usando os tipos reais do cadastro de Skills
      const examplesRaw = skillsDisponiveis.slice(0, 5).map((skill, index) => {
        const tipo = skillCodigoParaTipo(skill.codigo);
        return {
          numero: `OS-${String(index + 1).padStart(3, "0")}`,
          tipo: tipo,
          status: "pendente",
          endereco: `Rua Exemplo ${index + 1}, ${100 + index} - Centro`,
          cliente_nome: `Cliente ${index + 1}`,
          cliente_cpf: `${String(100 + index).padStart(3, "0")}.${String(200 + index).padStart(3, "0")}.${String(300 + index).padStart(3, "0")}-00`,
          instalacao: `${100000000 + index}`,
          medidor: `M${String(10000000 + index)}`,
          prazo: index === 0 ? "16/12/2025 23:59" : "",
          latitude: `-14,${8661 + index}`,
          longitude: `-40,${8394 + index}`,
          observacoes: skill.descricao || `Exemplo de ${skill.nome}`
        };
      });

      // Garantir pelo menos 5 exemplos (repetir se necessário)
      while (examplesRaw.length < 5 && skillsDisponiveis.length > 0) {
        const skill = skillsDisponiveis[examplesRaw.length % skillsDisponiveis.length];
        const tipo = skillCodigoParaTipo(skill.codigo);
        examplesRaw.push({
          numero: `OS-${String(examplesRaw.length + 1).padStart(3, "0")}`,
          tipo: tipo,
          status: "pendente",
          endereco: `Rua Exemplo ${examplesRaw.length + 1}, ${100 + examplesRaw.length} - Centro`,
          cliente_nome: `Cliente ${examplesRaw.length + 1}`,
          cliente_cpf: `${String(100 + examplesRaw.length).padStart(3, "0")}.${String(200 + examplesRaw.length).padStart(3, "0")}.${String(300 + examplesRaw.length).padStart(3, "0")}-00`,
          instalacao: `${100000000 + examplesRaw.length}`,
          medidor: `M${String(10000000 + examplesRaw.length)}`,
          prazo: "",
          latitude: `-14,${8661 + examplesRaw.length}`,
          longitude: `-40,${8394 + examplesRaw.length}`,
          observacoes: skill.descricao || `Exemplo de ${skill.nome}`
        });
      }


      // Converter para formato Excel: datas como Date objects, números como números
      const examples = examplesRaw.map((ex) => {
      const converted: any = { ...ex };
      
      // Converter latitude e longitude: vírgula para ponto e depois para número
      if (converted.latitude && typeof converted.latitude === "string") {
        converted.latitude = parseFloat(converted.latitude.replace(",", "."));
      }
      if (converted.longitude && typeof converted.longitude === "string") {
        converted.longitude = parseFloat(converted.longitude.replace(",", "."));
      }
      
      // Converter prazo: formato brasileiro DD/MM/YYYY HH:mm para Date
      if (converted.prazo && converted.prazo.trim()) {
        const match = converted.prazo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
        if (match) {
          const [, dia, mes, ano, hora = "0", minuto = "0"] = match;
          converted.prazo = new Date(
            parseInt(ano),
            parseInt(mes) - 1,
            parseInt(dia),
            parseInt(hora),
            parseInt(minuto)
          );
        } else {
          converted.prazo = null;
        }
      } else {
        converted.prazo = null;
      }
      
      return converted;
    });

    // Criar workbook Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(examples, { header: headers });
    
    // Configurar formato de células
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    const latCol = headers.indexOf("latitude");
    const lngCol = headers.indexOf("longitude");
    const prazoCol = headers.indexOf("prazo");
    
    for (let row = 1; row <= range.e.r; row++) {
      // Formato de latitude e longitude com vírgula como separador decimal
      if (latCol >= 0) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: latCol });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].z = "#,##0.0000";
        }
      }
      if (lngCol >= 0) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: lngCol });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].z = "#,##0.0000";
        }
      }
      // Formato de data brasileira para prazo
      if (prazoCol >= 0) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: prazoCol });
        if (worksheet[cellAddress] && worksheet[cellAddress].v) {
          worksheet[cellAddress].z = "dd/mm/yyyy hh:mm";
        }
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ordens de Serviço");

    // Fazer download
    XLSX.writeFile(workbook, "modelo_importacao_oss.xlsx");
    
    toast.success("Modelo de importação baixado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao gerar modelo:", error);
      toast.error(error.message || "Erro ao gerar modelo de importação");
    }
  };

  /**
   * Converte código da skill (ex: "CORTE") para formato tipo usado no banco (ex: "corte")
   */
  const skillCodigoParaTipo = (codigo: string): string => {
    return codigo.toLowerCase().replace(/[^a-z0-9]/g, "_");
  };

  /**
   * Converte tipo do banco (ex: "corte") para código da skill (ex: "CORTE")
   */
  const tipoParaSkillCodigo = (tipo: string): string => {
    // Mapeamento direto para casos conhecidos
    const mapeamento: Record<string, string> = {
      corte: "CORTE",
      religa: "RELIGA",
      inspecao: "INSPEÇÃO",
      inspeção: "INSPEÇÃO",
      ligacao: "LIGAÇÃO",
      ligação: "LIGAÇÃO",
      manutencao: "MANUTENÇÃO",
      manutenção: "MANUTENÇÃO",
      troca_medidor: "TROCA_MEDIDOR",
    };
    
    if (mapeamento[tipo.toLowerCase()]) {
      return mapeamento[tipo.toLowerCase()];
    }
    
    // Tentar converter diretamente
    return tipo.toUpperCase();
  };

  // Contar OSs sem coordenadas
  const ordensSemCoordenadas = ordens.filter(os => !os.latitude || !os.longitude);

  // Função para geocodificar OSs sem coordenadas
  const handleGeocodeAll = async () => {
    if (ordensSemCoordenadas.length === 0) {
      toast.info("Todas as OSs já possuem coordenadas!");
      return;
    }

    setGeocodingInProgress(true);
    setGeocodingProgress({ current: 0, total: ordensSemCoordenadas.length, endereco: "" });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < ordensSemCoordenadas.length; i++) {
      const os = ordensSemCoordenadas[i];
      setGeocodingProgress({ 
        current: i + 1, 
        total: ordensSemCoordenadas.length, 
        endereco: os.endereco 
      });

      try {
        const result = await geocodeAddress(os.endereco);
        
        if (result) {
          // Atualizar no banco
          const { error } = await supabase
            .from("ordens_servico")
            .update({
              latitude: result.latitude,
              longitude: result.longitude,
            })
            .eq("id", os.id);

          if (error) {
            console.error(`Erro ao atualizar OS ${os.numero}:`, error);
            failed++;
          } else {
            success++;
          }
        } else {
          console.warn(`Não foi possível geocodificar: ${os.endereco}`);
          failed++;
        }
      } catch (error) {
        console.error(`Erro ao geocodificar OS ${os.numero}:`, error);
        failed++;
      }
    }

    setGeocodingInProgress(false);
    setGeocodingProgress({ current: 0, total: 0, endereco: "" });

    if (success > 0) {
      toast.success(`${success} OS(s) geocodificada(s) com sucesso!`);
      fetchOrdens(); // Recarregar lista
    }
    
    if (failed > 0) {
      toast.warning(`${failed} OS(s) não puderam ser geocodificadas. Verifique os endereços.`);
    }
  };

  const filteredOrdens = ordens.filter((os) => {
    const matchesSearch =
      os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((os as any).codigo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.endereco.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (os.cliente_nome || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || os.status === statusFilter;
    const matchesTipo = tipoFilter === "all" || os.tipo === tipoFilter;
    return matchesSearch && matchesStatus && matchesTipo;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "concluida": return "success";
      case "andamento": return "default";
      case "atrasada": return "danger";
      case "cancelada": return "secondary";
      default: return "warning";
    }
  };

  return (
    <MainLayout
      title="Ordens de Serviço"
      subtitle="Gestão completa das ordens de serviço"
      breadcrumbs={[{ label: "Ordens de Serviço" }]}
    >
      {/* Actions Bar */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, endereço, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                {Object.entries(tipoLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleDownloadModel}>
              <FileText className="h-4 w-4" />
              Modelo de Importação
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar OSS
            </Button>
            {ordensSemCoordenadas.length > 0 && (
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={handleGeocodeAll}
                disabled={geocodingInProgress}
              >
                {geocodingInProgress ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                Geocodificar ({ordensSemCoordenadas.length})
              </Button>
            )}
            <Button variant="outline" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700" onClick={() => setClearAllDialogOpen(true)}>
              <X className="h-4 w-4" />
              Cancelar Todas
            </Button>
            <Button className="gap-2" onClick={() => { setSelectedOrdem(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nova OS
            </Button>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Mostrando {filteredOrdens.length} de {ordens.length} resultados
          {ordensSemCoordenadas.length > 0 && !geocodingInProgress && (
            <span className="ml-2 text-orange-500">
              • {ordensSemCoordenadas.length} OS(s) sem coordenadas
            </span>
          )}
        </div>

        {/* Barra de progresso de geocodificação */}
        {geocodingInProgress && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Geocodificando endereços...
              </span>
              <span className="text-sm text-blue-600 dark:text-blue-400">
                {geocodingProgress.current} de {geocodingProgress.total}
              </span>
            </div>
            <Progress 
              value={(geocodingProgress.current / geocodingProgress.total) * 100} 
              className="h-2"
            />
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 truncate">
              {geocodingProgress.endereco}
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filteredOrdens.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma ordem de serviço encontrada. Clique em "Nova OS" para cadastrar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[150px]">Código</TableHead>
                <TableHead className="w-[120px]">Número OS</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Endereço</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrdens.map((os) => (
                <TableRow key={os.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {(os as any).codigo || "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {os.regulada && <Zap className="h-4 w-4 text-danger" />}
                      {os.numero}
                    </div>
                  </TableCell>
                  <TableCell>{tipoLabels[os.tipo] || os.tipo}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(os.status) as any}>
                      {statusLabels[os.status] || os.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin 
                        className={`h-4 w-4 flex-shrink-0 ${
                          os.latitude && os.longitude 
                            ? "text-green-500" 
                            : "text-orange-500"
                        }`} 
                        title={os.latitude && os.longitude ? "Com coordenadas" : "Sem coordenadas - clique em Geocodificar"}
                      />
                      <span className="truncate max-w-[200px]">{os.endereco}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {os.prazo ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {new Date(os.prazo).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(os.prazo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {os.tecnicos ? (
                      <span className="font-medium">{os.tecnicos.codigo}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {os.cliente_nome || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => { setOrdemDetalhesId(os.id); setDetalhesOpen(true); }}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(os)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { setOrdemToDelete(os); setDeleteDialogOpen(true); }}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <OrdemServicoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        ordem={selectedOrdem}
        onSuccess={fetchOrdens}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a OS {ordemToDelete?.numero}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar todas as ordens de serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar TODAS as {ordens.filter(o => o.status !== "cancelada").length} ordem(ns) de serviço ativas?
              <br /><br />
              <span className="text-muted-foreground">
                As ordens canceladas ficarão no histórico mas não aparecerão para roteirização.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAll} className="bg-orange-600 text-white hover:bg-orange-700">
              Cancelar Todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportacaoOSDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={fetchOrdens}
      />

      {/* Dialog de Detalhes da OS */}
      <OrdemServicoDetalhesDialog
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        ordemId={ordemDetalhesId}
      />
    </MainLayout>
  );
};

export default OrdensServico;
