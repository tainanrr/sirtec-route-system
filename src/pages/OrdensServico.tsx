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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrdemServicoFormDialog } from "@/components/ordens/OrdemServicoFormDialog";
import { OrdemServicoDetalhesDialog } from "@/components/ordens/OrdemServicoDetalhesDialog";
import type { Tables } from "@/integrations/supabase/types";
import * as XLSX from "xlsx";
import { getDadosSkill, fetchSkills } from "@/lib/skillsUtils";
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

  const handleClearAll = async () => {
    try {
      // Buscar todos os IDs primeiro
      const { data: ordensData, error: fetchError } = await supabase
        .from("ordens_servico")
        .select("id");

      if (fetchError) {
        toast.error("Erro ao buscar ordens de serviço");
        setClearAllDialogOpen(false);
        return;
      }

      if (!ordensData || ordensData.length === 0) {
        toast.info("Não há ordens de serviço para excluir");
        setClearAllDialogOpen(false);
        return;
      }

      // Deletar em lotes para evitar problemas com muitas linhas
      const batchSize = 100;
      const ids = ordensData.map(os => os.id);
      let deleted = 0;
      let errors = 0;

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await supabase
          .from("ordens_servico")
          .delete()
          .in("id", batch);

        if (error) {
          console.error("Erro ao excluir lote:", error);
          errors += batch.length;
        } else {
          deleted += batch.length;
        }
      }

      if (errors > 0) {
        toast.error(`Erro ao excluir ${errors} ordem(ns) de serviço`);
      } else {
        toast.success(`${deleted} ordem(ns) de serviço excluída(s) com sucesso!`);
      }

      fetchOrdens();
    } catch (error: any) {
      console.error("Erro ao excluir ordens:", error);
      toast.error(`Erro ao excluir ordens de serviço: ${error.message}`);
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

  const handleImportExcel = async (file: File) => {
    try {
      // Buscar skills disponíveis do banco
      const skillsDisponiveis = await fetchSkills();
      const codigosSkillsValidos = new Set(skillsDisponiveis.map(s => s.codigo.toUpperCase()));
      const tiposValidos = new Set(skillsDisponiveis.map(s => skillCodigoParaTipo(s.codigo)));

      // Ler arquivo Excel
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      
      // Pegar primeira planilha
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Converter para JSON com raw: false para obter datas como strings formatadas
      // Isso evita problemas de timezone ao processar datas
      const rows = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false,
        defval: ""
      }) as Record<string, any>[];

      if (rows.length === 0) {
        toast.error("Nenhuma linha válida encontrada no arquivo Excel.");
        return;
      }

      // Validar tipos antes de processar
      const tiposInvalidos: string[] = [];
      const tiposEncontrados = new Set<string>();
      
      rows.forEach((row, index) => {
        const tipo = (row.tipo || "").toString().toLowerCase().trim();
        if (!tipo) {
          tiposInvalidos.push(`Linha ${index + 2}: Tipo vazio`);
          return;
        }
        
        tiposEncontrados.add(tipo);
        
        // Verificar se o tipo existe no cadastro de Skills
        if (!tiposValidos.has(tipo)) {
          tiposInvalidos.push(`Linha ${index + 2}: Tipo "${tipo}" não encontrado no cadastro de Skills`);
        }
      });

      if (tiposInvalidos.length > 0) {
        toast.error(
          `Erro de validação: ${tiposInvalidos.length} tipo(s) inválido(s). ` +
          `Tipos válidos: ${Array.from(tiposValidos).join(", ")}`,
          { duration: 10000 }
        );
        console.error("Tipos inválidos:", tiposInvalidos);
        return;
      }

      // Buscar todos os tipos únicos para obter dados das Skills em lote
      const tiposUnicos = new Set<string>();
      rows.forEach(row => {
        const tipo = (row.tipo || "").toString().toLowerCase().trim();
        const skillCodigo = tipoParaSkillCodigo(tipo);
        tiposUnicos.add(skillCodigo);
      });

      // Buscar dados das Skills
      const skillsData = new Map<string, { tempoExecucao: number; valor: number; regulada: boolean }>();
      for (const tipoSkill of tiposUnicos) {
        try {
          const dados = await getDadosSkill(tipoSkill);
          skillsData.set(tipoSkill, dados);
        } catch (error) {
          console.warn(`[IMPORT] Skill "${tipoSkill}" não encontrada, usando valores padrão`);
          skillsData.set(tipoSkill, { tempoExecucao: 15, valor: 0, regulada: false });
        }
      }

      // Converter para formato do banco
      const ordensToInsert = rows.map(row => {
        const tipo = (row.tipo || "corte").toString().toLowerCase().trim();
        const skillCodigo = tipoParaSkillCodigo[tipo] || tipo.toUpperCase();
        const skillDados = skillsData.get(skillCodigo) || { tempoExecucao: 15, valor: 0, regulada: false };

        // Processar prazo - IMPORTANTE: Preservar exatamente a data/hora digitada
        // O Excel retorna como string formatada quando raw: false
        let prazo: string | null = null;
        if (row.prazo) {
          const prazoValue = row.prazo;
          
          // Se for string (formato brasileiro ou outro), processar diretamente
          if (typeof prazoValue === "string" && prazoValue.trim()) {
            const prazoStr = prazoValue.trim();
            // Tentar parsear formato brasileiro DD/MM/YYYY HH:mm ou DD/MM/YYYY HH:MM
            const brasileiroMatch = prazoStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
            if (brasileiroMatch) {
              const [, dia, mes, ano, hora = "0", minuto = "0"] = brasileiroMatch;
              // Criar data no timezone local com os valores exatos digitados
              const dateLocal = new Date(
                parseInt(ano),
                parseInt(mes) - 1,
                parseInt(dia),
                parseInt(hora),
                parseInt(minuto),
                0,
                0
              );
              
              if (!isNaN(dateLocal.getTime())) {
                // Converter para ISO (UTC) - isso preserva o momento correto
                prazo = dateLocal.toISOString();
              }
            } else {
              // Tentar parsear outros formatos
              const date = new Date(prazoStr);
              if (!isNaN(date.getTime())) {
                prazo = date.toISOString();
              }
            }
          } else if (prazoValue instanceof Date) {
            // Se ainda for Date object, extrair componentes locais e recriar
            const dateLocal = new Date(
              prazoValue.getFullYear(),
              prazoValue.getMonth(),
              prazoValue.getDate(),
              prazoValue.getHours(),
              prazoValue.getMinutes(),
              0,
              0
            );
            if (!isNaN(dateLocal.getTime())) {
              prazo = dateLocal.toISOString();
            }
          } else if (typeof prazoValue === "number") {
            // Excel serial date - converter para local primeiro
            const excelEpoch = new Date(1899, 11, 30);
            const dateLocal = new Date(excelEpoch.getTime() + prazoValue * 86400000);
            // Recriar com componentes locais para evitar problemas de timezone
            const dateRecriada = new Date(
              dateLocal.getFullYear(),
              dateLocal.getMonth(),
              dateLocal.getDate(),
              dateLocal.getHours(),
              dateLocal.getMinutes(),
              0,
              0
            );
            if (!isNaN(dateRecriada.getTime())) {
              prazo = dateRecriada.toISOString();
            }
          }
        }

        // Regulada sempre vem do cadastro de Skills
        return {
          numero: (row.numero || "").toString().trim(),
          tipo: tipo,
          status: (row.status || "pendente").toString().toLowerCase(),
          endereco: (row.endereco || "").toString().trim(),
          cliente_nome: row.cliente_nome ? row.cliente_nome.toString().trim() : null,
          cliente_cpf: row.cliente_cpf ? row.cliente_cpf.toString().trim() : null,
          instalacao: row.instalacao ? row.instalacao.toString().trim() : null,
          medidor: row.medidor ? row.medidor.toString().trim() : null,
          duracao_estimada: skillDados.tempoExecucao,
          valor: skillDados.valor,
          regulada: skillDados.regulada,
          prazo: prazo,
          latitude: row.latitude ? (() => {
            if (typeof row.latitude === "number") return row.latitude;
            const latStr = row.latitude.toString().trim();
            // Se contém vírgula, substituir por ponto (formato brasileiro)
            const latNormalized = latStr.includes(",") ? latStr.replace(",", ".") : latStr;
            const latNum = parseFloat(latNormalized);
            return isNaN(latNum) ? null : latNum;
          })() : null,
          longitude: row.longitude ? (() => {
            if (typeof row.longitude === "number") return row.longitude;
            const lngStr = row.longitude.toString().trim();
            // Se contém vírgula, substituir por ponto (formato brasileiro)
            const lngNormalized = lngStr.includes(",") ? lngStr.replace(",", ".") : lngStr;
            const lngNum = parseFloat(lngNormalized);
            return isNaN(lngNum) ? null : lngNum;
          })() : null,
          observacoes: row.observacoes ? row.observacoes.toString().trim() : null,
        };
      });

      // Inserir no banco em lotes
      const batchSize = 100;
      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < ordensToInsert.length; i += batchSize) {
        const batch = ordensToInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from("ordens_servico")
          .insert(batch);

        if (error) {
          console.error("Erro ao inserir lote:", error);
          errors += batch.length;
        } else {
          inserted += batch.length;
        }
      }

      if (inserted > 0) {
        toast.success(`${inserted} ordem(ns) de serviço importada(s) com sucesso!`);
        fetchOrdens();
      }
      
      if (errors > 0) {
        toast.error(`${errors} ordem(ns) não puderam ser importadas. Verifique o console para detalhes.`);
      }

      setImportDialogOpen(false);
    } catch (error: any) {
      console.error("Erro ao processar Excel:", error);
      toast.error(`Erro ao importar Excel: ${error.message}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast.error("Por favor, selecione um arquivo Excel (.xlsx ou .xls).");
        return;
      }
      handleImportExcel(file);
    }
    // Resetar o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = "";
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
            <Button variant="destructive" className="gap-2" onClick={() => setClearAllDialogOpen(true)}>
              <Trash className="h-4 w-4" />
              Limpar Tudo
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
                <TableHead className="w-[120px]">OS</TableHead>
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
            <AlertDialogTitle>Limpar todas as ordens de serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir TODAS as {ordens.length} ordem(ns) de serviço? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Limpar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar Ordens de Serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione um arquivo Excel (.xlsx) com as ordens de serviço para importação em massa.
              Use o botão "Modelo de Importação" para baixar um exemplo do formato esperado.
              <br />
              <strong>Nota:</strong> Os campos "duracao_estimada", "valor" e "regulada" serão preenchidos automaticamente com base no cadastro de Skills.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
