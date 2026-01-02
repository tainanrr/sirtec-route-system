import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ImportacaoOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface LinhaImportacao {
  linha: number;
  dados: Record<string, any>;
  erros: string[];
  avisos: string[];
  valida: boolean;
  selecionada: boolean;
}

interface OSExistente {
  numero: string;
  status: string;
}

interface ResumoImportacao {
  total: number;
  validas: number;
  comErros: number;
  comAvisos: number;
}

// Mapeamento de tipos para códigos de Skills
const tipoParaSkillCodigo: Record<string, string> = {
  corte: "CORTE",
  religacao: "RELIG",
  inspecao: "INSP",
  vistoria: "VIST",
  troca_medidor: "TROCA_MED",
  leitura: "LEIT",
  entrega_fatura: "ENT_FAT",
};

const skillCodigoParaTipo = (codigo: string): string => {
  const mapeamentoInverso: Record<string, string> = {
    "CORTE": "corte",
    "RELIG": "religacao",
    "INSP": "inspecao",
    "VIST": "vistoria",
    "TROCA_MED": "troca_medidor",
    "LEIT": "leitura",
    "ENT_FAT": "entrega_fatura",
  };
  return mapeamentoInverso[codigo.toUpperCase()] || codigo.toLowerCase();
};

type FiltroStatus = "todos" | "validas" | "erros" | "avisos";

export function ImportacaoOSDialog({ open, onOpenChange, onSuccess }: ImportacaoOSDialogProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<"upload" | "validacao" | "importando" | "resultado">("upload");
  const [linhas, setLinhas] = useState<LinhaImportacao[]>([]);
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [skillsDisponiveis, setSkillsDisponiveis] = useState<any[]>([]);
  const [osExistentesMap, setOsExistentesMap] = useState<Map<string, OSExistente>>(new Map());
  const [expandirErros, setExpandirErros] = useState<Set<number>>(new Set());
  const [resultadoFinal, setResultadoFinal] = useState<{ importadas: number; atualizadas: number; erros: number; detalhesErros: string[] }>({ importadas: 0, atualizadas: 0, erros: 0, detalhesErros: [] });
  
  // Estados para filtros e paginação
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);

  const resetDialog = useCallback(() => {
    setArquivo(null);
    setEtapa("upload");
    setLinhas([]);
    setResumo(null);
    setProcessando(false);
    setProgresso({ atual: 0, total: 0 });
    setExpandirErros(new Set());
    setResultadoFinal({ importadas: 0, atualizadas: 0, erros: 0, detalhesErros: [] });
    setFiltroStatus("todos");
    setFiltroBusca("");
    setPaginaAtual(1);
  }, []);

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  // Estados para validação de contrato e centro de custo
  const [contratosMap, setContratosMap] = useState<Map<string, string>>(new Map());
  const [centrosCustoMap, setCentrosCustoMap] = useState<Map<string, string>>(new Map());

  const carregarDadosReferencia = async () => {
    const [skillsRes, osRes, contratosRes, centrosCustoRes] = await Promise.all([
      supabase.from("skills").select("*").eq("ativo", true),
      supabase.from("ordens_servico").select("numero, status").not("status", "in", "(concluida,cancelada)"),
      supabase.from("contratos").select("id, codigo").eq("status", "ativo"),
      supabase.from("centros_custo").select("id, nome").eq("ativo", true),
    ]);

    const skills = skillsRes.data || [];
    setSkillsDisponiveis(skills);

    // Mapa de OSs existentes
    const osMap = new Map<string, OSExistente>();
    (osRes.data || []).forEach(os => {
      if (!osMap.has(os.numero)) {
        osMap.set(os.numero, { numero: os.numero, status: os.status });
      }
    });
    setOsExistentesMap(osMap);

    // Mapa de contratos (código -> id)
    const contMap = new Map<string, string>();
    (contratosRes.data || []).forEach(c => {
      contMap.set(c.codigo.toUpperCase(), c.id);
    });
    setContratosMap(contMap);

    // Mapa de centros de custo (nome -> id)
    const ccMap = new Map<string, string>();
    (centrosCustoRes.data || []).forEach(cc => {
      ccMap.set(cc.nome.toUpperCase(), cc.id);
    });
    setCentrosCustoMap(ccMap);

    return { 
      skills, 
      osExistentesMap: osMap,
      contratosMap: contMap,
      centrosCustoMap: ccMap,
    };
  };

  const validarLinha = (
    row: Record<string, any>, 
    index: number, 
    skills: any[], 
    osExistentesMap: Map<string, OSExistente>,
    contratosMap: Map<string, string>,
    centrosCustoMap: Map<string, string>
  ): LinhaImportacao => {
    const erros: string[] = [];
    const avisos: string[] = [];

    const numero = (row.numero || "").toString().trim();
    if (!numero) {
      erros.push("Número da OS é obrigatório");
    } else {
      const osExistente = osExistentesMap.get(numero);
      if (osExistente) {
        if (osExistente.status === "concluida" || osExistente.status === "cancelada") {
          avisos.push(`Existe OS "${numero}" (${osExistente.status}) - será criada nova OS com código único`);
        } else {
          erros.push(`Número "${numero}" já existe com status "${osExistente.status}"`);
        }
      }
    }

    const tipo = (row.tipo || "").toString().toLowerCase().trim();
    if (!tipo) {
      erros.push("Tipo é obrigatório");
    } else {
      const tiposValidos = new Set(skills.map(s => skillCodigoParaTipo(s.codigo)));
      if (!tiposValidos.has(tipo)) {
        erros.push(`Tipo "${tipo}" não cadastrado em Skills. Tipos válidos: ${Array.from(tiposValidos).join(", ")}`);
      }
    }

    const endereco = (row.endereco || "").toString().trim();
    if (!endereco) {
      erros.push("Endereço é obrigatório");
    }

    // Validar Contrato (se informado)
    const contrato = (row.contrato || "").toString().trim().toUpperCase();
    if (contrato) {
      if (!contratosMap.has(contrato)) {
        erros.push(`Contrato "${contrato}" não cadastrado ou inativo`);
      }
    }

    // Validar Centro de Custo (se informado)
    const centroCusto = (row.centro_custo || row.centro_custos || "").toString().trim().toUpperCase();
    if (centroCusto) {
      if (!centrosCustoMap.has(centroCusto)) {
        erros.push(`Centro de Custo "${centroCusto}" não cadastrado ou inativo`);
      }
    }

    // Validar Zona Cadastral (se informado)
    const zonaCadastral = (row.zona_cadastral || "").toString().trim();
    if (zonaCadastral) {
      const zonasValidas = ["urbana", "rural", "indefinida"];
      if (!zonasValidas.includes(zonaCadastral.toLowerCase())) {
        avisos.push(`Zona cadastral "${zonaCadastral}" inválida. Valores válidos: Urbana, Rural, Indefinida`);
      }
    }

    // Validar prazo
    if (row.prazo) {
      const prazoStr = row.prazo.toString().trim();
      const brasileiroMatch = prazoStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
      if (!brasileiroMatch) {
        const date = new Date(prazoStr);
        if (isNaN(date.getTime())) {
          avisos.push(`Formato de prazo inválido: "${prazoStr}". Use DD/MM/YYYY ou DD/MM/YYYY HH:mm`);
        }
      }
    }

    // Validar data_geracao
    if (row.data_geracao) {
      const dataGeracaoStr = row.data_geracao.toString().trim();
      const brasileiroMatch = dataGeracaoStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
      if (!brasileiroMatch) {
        const date = new Date(dataGeracaoStr);
        if (isNaN(date.getTime())) {
          avisos.push(`Formato de data_geracao inválido: "${dataGeracaoStr}". Use DD/MM/YYYY ou DD/MM/YYYY HH:mm`);
        }
      }
    }

    if (row.latitude) {
      const lat = parseFloat(row.latitude.toString().replace(",", "."));
      if (isNaN(lat) || lat < -90 || lat > 90) {
        avisos.push(`Latitude inválida: "${row.latitude}"`);
      }
    }
    if (row.longitude) {
      const lng = parseFloat(row.longitude.toString().replace(",", "."));
      if (isNaN(lng) || lng < -180 || lng > 180) {
        avisos.push(`Longitude inválida: "${row.longitude}"`);
      }
    }

    if (!row.cliente_nome) {
      avisos.push("Nome do cliente não informado");
    }

    return {
      linha: index + 2,
      dados: row,
      erros,
      avisos,
      valida: erros.length === 0,
      selecionada: erros.length === 0,
    };
  };

  const processarArquivo = async (file: File) => {
    setProcessando(true);
    setProgresso({ atual: 0, total: 100 });

    try {
      setProgresso({ atual: 10, total: 100 });
      const { skills, osExistentesMap: osMap, contratosMap: contMap, centrosCustoMap: ccMap } = await carregarDadosReferencia();

      setProgresso({ atual: 30, total: 100 });
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const rows = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false,
        defval: ""
      }) as Record<string, any>[];

      if (rows.length === 0) {
        toast.error("Nenhuma linha encontrada no arquivo Excel.");
        setEtapa("upload");
        setProcessando(false);
        return;
      }


      setProgresso({ atual: 50, total: 100 });
      const numerosNoArquivo = new Set<string>();
      const linhasValidadas: LinhaImportacao[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const linha = validarLinha(row, i, skills, osMap, contMap, ccMap);

        const numero = (row.numero || "").toString().trim();
        if (numero && numerosNoArquivo.has(numero)) {
          linha.erros.push(`Número "${numero}" duplicado neste arquivo`);
          linha.valida = false;
          linha.selecionada = false;
        }
        if (numero) {
          numerosNoArquivo.add(numero);
        }

        linhasValidadas.push(linha);
        
        if (i % 50 === 0) {
          setProgresso({ atual: 50 + Math.floor((i / rows.length) * 40), total: 100 });
        }
      }

      setLinhas(linhasValidadas);
      setResumo({
        total: linhasValidadas.length,
        validas: linhasValidadas.filter(l => l.valida).length,
        comErros: linhasValidadas.filter(l => l.erros.length > 0).length,
        comAvisos: linhasValidadas.filter(l => l.avisos.length > 0 && l.valida).length,
      });

      setProgresso({ atual: 100, total: 100 });
      setEtapa("validacao");
    } catch (error: any) {
      console.error("Erro ao processar arquivo:", error);
      toast.error(`Erro ao processar arquivo: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast.error("Por favor, selecione um arquivo Excel (.xlsx ou .xls).");
        return;
      }
      setArquivo(file);
      processarArquivo(file);
    }
    e.target.value = "";
  };

  const toggleSelecionarLinha = (index: number) => {
    setLinhas(prev => prev.map((l, i) => 
      i === index ? { ...l, selecionada: !l.selecionada } : l
    ));
  };

  const selecionarTodas = (selecionar: boolean) => {
    setLinhas(prev => prev.map(l => ({ ...l, selecionada: l.valida && selecionar })));
  };

  const toggleExpandirErros = (linha: number) => {
    setExpandirErros(prev => {
      const novo = new Set(prev);
      if (novo.has(linha)) {
        novo.delete(linha);
      } else {
        novo.add(linha);
      }
      return novo;
    });
  };

  const processarPrazo = (prazoValue: any): string | null => {
    if (!prazoValue) return null;
    
    if (typeof prazoValue === "string" && prazoValue.trim()) {
      const prazoStr = prazoValue.trim();
      const brasileiroMatch = prazoStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
      if (brasileiroMatch) {
        const [, dia, mes, ano, hora = "0", minuto = "0"] = brasileiroMatch;
        const dateLocal = new Date(
          parseInt(ano),
          parseInt(mes) - 1,
          parseInt(dia),
          parseInt(hora),
          parseInt(minuto),
          0, 0
        );
        if (!isNaN(dateLocal.getTime())) {
          return dateLocal.toISOString();
        }
      } else {
        const date = new Date(prazoStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    return null;
  };

  const executarImportacao = async () => {
    const linhasSelecionadas = linhas.filter(l => l.selecionada && l.valida);
    
    if (linhasSelecionadas.length === 0) {
      toast.error("Nenhuma linha válida selecionada para importação.");
      return;
    }

    setEtapa("importando");
    setProcessando(true);
    
    const total = linhasSelecionadas.length;
    setProgresso({ atual: 0, total });

    // Criar mapa de skills uma vez
    const skillsMap = new Map<string, { tempoExecucao: number; valor: number; regulada: boolean }>();
    for (const skill of skillsDisponiveis) {
      const tipo = skillCodigoParaTipo(skill.codigo);
      skillsMap.set(tipo, {
        tempoExecucao: skill.tempo_execucao || 15,
        valor: skill.valor || 0,
        regulada: skill.regulada || false,
      });
    }

    // Preparar todas as OSs para inserção
    const ordensParaInserir: any[] = [];

    for (const linha of linhasSelecionadas) {
      const row = linha.dados;
      const tipo = (row.tipo || "").toString().toLowerCase().trim();
      const skillDados = skillsMap.get(tipo) || { tempoExecucao: 15, valor: 0, regulada: false };

      // Buscar IDs de contrato e centro de custo
      const contratoCodigo = (row.contrato || "").toString().trim().toUpperCase();
      const centroCustoNome = (row.centro_custo || row.centro_custos || "").toString().trim().toUpperCase();
      
      // Processar zona cadastral
      const zonaCadastralRaw = (row.zona_cadastral || "").toString().trim().toLowerCase();
      let zonaCadastral: string | null = null;
      if (zonaCadastralRaw === "urbana") zonaCadastral = "Urbana";
      else if (zonaCadastralRaw === "rural") zonaCadastral = "Rural";
      else if (zonaCadastralRaw === "indefinida" || zonaCadastralRaw) zonaCadastral = "Indefinida";

      ordensParaInserir.push({
        numero: (row.numero || "").toString().trim(),
        tipo,
        status: "pendente",
        endereco: (row.endereco || "").toString().trim(),
        cliente_nome: row.cliente_nome ? row.cliente_nome.toString().trim() : null,
        cliente_cpf: row.cliente_cpf ? row.cliente_cpf.toString().trim() : null,
        instalacao: row.instalacao ? row.instalacao.toString().trim() : null,
        medidor: row.medidor ? row.medidor.toString().trim() : null,
        duracao_estimada: skillDados.tempoExecucao,
        valor: skillDados.valor,
        regulada: skillDados.regulada,
        prazo: processarPrazo(row.prazo),
        latitude: row.latitude ? parseFloat(row.latitude.toString().replace(",", ".")) : null,
        longitude: row.longitude ? parseFloat(row.longitude.toString().replace(",", ".")) : null,
        observacoes: row.observacoes ? row.observacoes.toString().trim() : null,
        // Novos campos
        contrato_id: contratoCodigo ? contratosMap.get(contratoCodigo) : null,
        centro_custo_id: centroCustoNome ? centrosCustoMap.get(centroCustoNome) : null,
        tensao_medicao: row.tensao_medicao ? row.tensao_medicao.toString().trim() : null,
        data_geracao: processarPrazo(row.data_geracao),
        zona_cadastral: zonaCadastral,
        // codigo será gerado automaticamente pelo trigger no banco
      });
    }

    setProgresso({ atual: Math.floor(total * 0.2), total });

    let importadas = 0;
    let erros = 0;
    const detalhesErros: string[] = [];

    // INSERÇÃO EM MASSA - lotes de 500, paralelo
    const BATCH_SIZE = 500;
    const batches: any[][] = [];
    
    for (let i = 0; i < ordensParaInserir.length; i += BATCH_SIZE) {
      batches.push(ordensParaInserir.slice(i, i + BATCH_SIZE));
    }

    const batchPromises = batches.map(async (batch) => {
      try {
        const { error } = await supabase
          .from("ordens_servico")
          .insert(batch);

        if (error) {
          return { success: 0, failed: batch.length, errorMsg: error.message, batch };
        }
        return { success: batch.length, failed: 0, errorMsg: null, batch: null };
      } catch (err: any) {
        return { success: 0, failed: batch.length, errorMsg: err.message, batch };
      }
    });

    const results = await Promise.all(batchPromises);
    
    setProgresso({ atual: Math.floor(total * 0.9), total });

    for (const result of results) {
      importadas += result.success;
      erros += result.failed;
      
      if (result.errorMsg && result.batch) {
        const primeirosNumeros = result.batch.slice(0, 3).map((o: any) => o.numero).join(", ");
        detalhesErros.push(`Lote falhou (${primeirosNumeros}...): ${result.errorMsg}`);
      }
    }

    setProgresso({ atual: total, total });
    setResultadoFinal({ 
      importadas, 
      atualizadas: 0,
      erros, 
      detalhesErros 
    });
    setProcessando(false);
    setEtapa("resultado");

    if (importadas > 0) {
      onSuccess();
    }
  };

  // Filtrar linhas
  const linhasFiltradas = useMemo(() => {
    return linhas.filter(linha => {
      // Filtro por status
      if (filtroStatus === "validas" && !linha.valida) return false;
      if (filtroStatus === "erros" && linha.erros.length === 0) return false;
      if (filtroStatus === "avisos" && (linha.avisos.length === 0 || !linha.valida)) return false;

      // Filtro por busca
      if (filtroBusca) {
        const busca = filtroBusca.toLowerCase();
        const numero = (linha.dados.numero || "").toLowerCase();
        const endereco = (linha.dados.endereco || "").toLowerCase();
        const tipo = (linha.dados.tipo || "").toLowerCase();
        const cliente = (linha.dados.cliente_nome || "").toLowerCase();
        
        if (!numero.includes(busca) && !endereco.includes(busca) && !tipo.includes(busca) && !cliente.includes(busca)) {
          return false;
        }
      }

      return true;
    });
  }, [linhas, filtroStatus, filtroBusca]);

  // Paginação
  const totalPaginas = Math.ceil(linhasFiltradas.length / itensPorPagina);
  const linhasPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return linhasFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [linhasFiltradas, paginaAtual, itensPorPagina]);

  // Resetar página quando filtros mudam
  const handleFiltroChange = (novoFiltro: FiltroStatus) => {
    setFiltroStatus(novoFiltro);
    setPaginaAtual(1);
  };

  const handleBuscaChange = (busca: string) => {
    setFiltroBusca(busca);
    setPaginaAtual(1);
  };

  const linhasSelecionadasCount = linhas.filter(l => l.selecionada && l.valida).length;

  // Encontrar índice original da linha para toggle
  const getIndiceOriginal = (linhaNumero: number) => {
    return linhas.findIndex(l => l.linha === linhaNumero);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Ordens de Serviço
          </DialogTitle>
          <DialogDescription>
            {etapa === "upload" && "Selecione um arquivo Excel (.xlsx) com as ordens de serviço para importação."}
            {etapa === "validacao" && "Revise as linhas e corrija os erros antes de importar."}
            {etapa === "importando" && "Importando ordens de serviço..."}
            {etapa === "resultado" && "Resultado da importação"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* ETAPA 1: Upload */}
          {etapa === "upload" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              {processando ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Processando arquivo...</p>
                  <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progresso.atual}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Arraste um arquivo Excel aqui ou clique para selecionar
                    </p>
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground max-w-lg text-center">
                    Colunas esperadas: numero, tipo, endereco, cliente_nome, cliente_cpf, instalacao, medidor, prazo, latitude, longitude, observacoes, <strong>contrato</strong>, <strong>centro_custo</strong>, <strong>tensao_medicao</strong>, <strong>data_geracao</strong>, <strong>zona_cadastral</strong>
                  </p>
                </>
              )}
            </div>
          )}

          {/* ETAPA 2: Validação */}
          {etapa === "validacao" && resumo && (
            <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden">
              {/* Resumo - Clicável para filtrar */}
              <div className="grid grid-cols-4 gap-2 flex-shrink-0">
                <button 
                  onClick={() => handleFiltroChange("todos")}
                  className={`p-2 rounded-lg transition-all text-center ${filtroStatus === "todos" ? "ring-2 ring-primary bg-muted" : "bg-muted/50 hover:bg-muted"}`}
                >
                  <div className="text-xl font-bold">{resumo.total}</div>
                  <div className="text-[10px] text-muted-foreground">Total</div>
                </button>
                <button 
                  onClick={() => handleFiltroChange("validas")}
                  className={`p-2 rounded-lg transition-all text-center ${filtroStatus === "validas" ? "ring-2 ring-green-500 bg-green-500/20" : "bg-green-500/10 hover:bg-green-500/20"}`}
                >
                  <div className="text-xl font-bold text-green-600">{resumo.validas}</div>
                  <div className="text-[10px] text-muted-foreground">Válidas</div>
                </button>
                <button 
                  onClick={() => handleFiltroChange("erros")}
                  className={`p-2 rounded-lg transition-all text-center ${filtroStatus === "erros" ? "ring-2 ring-red-500 bg-red-500/20" : "bg-red-500/10 hover:bg-red-500/20"}`}
                >
                  <div className="text-xl font-bold text-red-600">{resumo.comErros}</div>
                  <div className="text-[10px] text-muted-foreground">Erros</div>
                </button>
                <button 
                  onClick={() => handleFiltroChange("avisos")}
                  className={`p-2 rounded-lg transition-all text-center ${filtroStatus === "avisos" ? "ring-2 ring-yellow-500 bg-yellow-500/20" : "bg-yellow-500/10 hover:bg-yellow-500/20"}`}
                >
                  <div className="text-xl font-bold text-yellow-600">{resumo.comAvisos}</div>
                  <div className="text-[10px] text-muted-foreground">Avisos</div>
                </button>
              </div>

              {/* Barra de filtros e controles */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={filtroBusca}
                    onChange={(e) => handleBuscaChange(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="selectAll"
                    checked={linhas.filter(l => l.valida).length > 0 && linhas.filter(l => l.valida).every(l => l.selecionada)}
                    onCheckedChange={(checked) => selecionarTodas(!!checked)}
                  />
                  <label htmlFor="selectAll" className="text-xs whitespace-nowrap">Todas válidas</label>
                </div>
                <Badge variant="outline" className="whitespace-nowrap text-xs">
                  {linhasSelecionadasCount} selecionada(s)
                </Badge>
              </div>

              {/* Info de filtro */}
              {(filtroStatus !== "todos" || filtroBusca) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                  <Filter className="h-3 w-3" />
                  <span>
                    {linhasFiltradas.length}/{linhas.length}
                    {filtroStatus !== "todos" && ` (${filtroStatus})`}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setFiltroStatus("todos"); setFiltroBusca(""); }}
                    className="h-5 px-1.5 text-xs"
                  >
                    Limpar
                  </Button>
                </div>
              )}

              {/* Tabela de linhas */}
              <div className="flex-1 border rounded-lg overflow-hidden flex flex-col min-h-0">
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 sticky top-0 bg-background"></TableHead>
                        <TableHead className="w-16 sticky top-0 bg-background">Linha</TableHead>
                        <TableHead className="w-20 sticky top-0 bg-background">Status</TableHead>
                        <TableHead className="sticky top-0 bg-background">Número</TableHead>
                        <TableHead className="sticky top-0 bg-background">Tipo</TableHead>
                        <TableHead className="sticky top-0 bg-background">Endereço</TableHead>
                        <TableHead className="sticky top-0 bg-background">Cliente</TableHead>
                        <TableHead className="w-24 sticky top-0 bg-background">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhasPaginadas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            Nenhuma linha encontrada com os filtros aplicados
                          </TableCell>
                        </TableRow>
                      ) : (
                        linhasPaginadas.map((linha) => {
                          const indiceOriginal = getIndiceOriginal(linha.linha);
                          return (
                            <>
                              <TableRow 
                                key={linha.linha}
                                className={linha.erros.length > 0 ? "bg-red-500/5" : linha.avisos.length > 0 ? "bg-yellow-500/5" : ""}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={linha.selecionada}
                                    disabled={!linha.valida}
                                    onCheckedChange={() => toggleSelecionarLinha(indiceOriginal)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs">{linha.linha}</TableCell>
                                <TableCell>
                                  {linha.erros.length > 0 ? (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  ) : linha.avisos.length > 0 ? (
                                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{linha.dados.numero || "-"}</TableCell>
                                <TableCell>{linha.dados.tipo || "-"}</TableCell>
                                <TableCell className="max-w-[180px] truncate" title={linha.dados.endereco}>
                                  {linha.dados.endereco || "-"}
                                </TableCell>
                                <TableCell className="max-w-[120px] truncate" title={linha.dados.cliente_nome}>
                                  {linha.dados.cliente_nome || "-"}
                                </TableCell>
                                <TableCell>
                                  {(linha.erros.length > 0 || linha.avisos.length > 0) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleExpandirErros(linha.linha)}
                                      className="h-7 px-2"
                                    >
                                      {expandirErros.has(linha.linha) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                      {linha.erros.length > 0 && (
                                        <Badge variant="destructive" className="ml-1 h-5 px-1.5">{linha.erros.length}</Badge>
                                      )}
                                      {linha.avisos.length > 0 && (
                                        <Badge variant="outline" className="ml-1 h-5 px-1.5 text-yellow-600">{linha.avisos.length}</Badge>
                                      )}
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                              {expandirErros.has(linha.linha) && (
                                <TableRow>
                                  <TableCell colSpan={8} className="bg-muted/50 p-3">
                                    <div className="space-y-1">
                                      {linha.erros.map((erro, i) => (
                                        <div key={`erro-${i}`} className="flex items-start gap-2 text-sm text-red-600">
                                          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                          {erro}
                                        </div>
                                      ))}
                                      {linha.avisos.map((aviso, i) => (
                                        <div key={`aviso-${i}`} className="flex items-start gap-2 text-sm text-yellow-600">
                                          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                          {aviso}
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 flex-shrink-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Select value={itensPorPagina.toString()} onValueChange={(v) => { setItensPorPagina(Number(v)); setPaginaAtual(1); }}>
                      <SelectTrigger className="w-[65px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>por pág.</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPaginaAtual(1)}
                      disabled={paginaAtual === 1}
                    >
                      <ChevronsLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                      disabled={paginaAtual === 1}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span className="px-2 text-xs">
                      {paginaAtual}/{totalPaginas || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaAtual === totalPaginas || totalPaginas === 0}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPaginaAtual(totalPaginas)}
                      disabled={paginaAtual === totalPaginas || totalPaginas === 0}
                    >
                      <ChevronsRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex justify-between flex-shrink-0 pt-2 gap-2">
                <Button variant="outline" size="sm" onClick={resetDialog}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Novo
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={executarImportacao}
                    disabled={linhasSelecionadasCount === 0}
                    size="sm"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Importar ({linhasSelecionadasCount})
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 3: Importando */}
          {etapa === "importando" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Importando ordens de serviço...</p>
              <div className="w-64">
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>{progresso.atual} de {progresso.total}</span>
                  <span>{Math.round((progresso.atual / progresso.total) * 100)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(progresso.atual / progresso.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 4: Resultado */}
          {etapa === "resultado" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-green-500/10 rounded-lg text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <div className="text-3xl font-bold text-green-600">{resultadoFinal.importadas}</div>
                  <div className="text-sm text-muted-foreground">OSs importadas</div>
                </div>
                <div className="p-6 bg-red-500/10 rounded-lg text-center">
                  <XCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
                  <div className="text-3xl font-bold text-red-600">{resultadoFinal.erros}</div>
                  <div className="text-sm text-muted-foreground">Erros</div>
                </div>
              </div>

              {resultadoFinal.detalhesErros.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Detalhes dos erros ({resultadoFinal.detalhesErros.length})
                  </h4>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {resultadoFinal.detalhesErros.map((erro, i) => (
                        <div key={i} className="text-sm text-red-600 py-1 border-b last:border-0">
                          {erro}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetDialog}>
                  Importar mais
                </Button>
                <Button onClick={handleClose}>
                  Concluir
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


