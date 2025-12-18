import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
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
import {
  Truck,
  Plus,
  Search,
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  Eye,
  Trash2,
  ClipboardCheck,
  Upload,
  Sparkles,
  Download,
  Paperclip,
  X,
  QrCode,
  FileDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import { useAuth } from "@/contexts/AuthContext";

interface RecebimentoItem {
  material_id: string;
  quantidade_esperada: number;
  quantidade_recebida?: number;
  observacao?: string;
  rastros?: string[];
  valor_unitario?: number | null;
  material?: {
    codigo: string;
    nome: string;
    unidade: string;
    requer_serial?: boolean;
    valor_unitario?: number | null;
  };
}

interface Recebimento {
  id: string;
  numero_documento: string | null;
  data_recebimento: string;
  fornecedor: string | null;
  observacao: string | null;
  status: string;
  conferido_por: string | null;
  data_conferencia: string | null;
  recebido_por?: string | null;
  recebido_por_user_id?: string | null;
  canal_entrada?: string | null;
  chave_nfe?: string | null;
  created_at: string;
  itens?: RecebimentoItem[];
}

interface RecebimentoAnexo {
  id: string;
  recebimento_id: string;
  tipo: string;
  nome_arquivo: string | null;
  url: string;
  created_at: string;
  created_by: string | null;
}

interface NovoRecebimentoForm {
  numero_documento: string;
  fornecedor: string;
  recebido_por: string;
  chave_nfe: string;
  canal_entrada: "manual" | "planilha" | "nf_ia" | "nf_xml";
  observacao: string;
  itens: RecebimentoItem[];
}

type ImportRow = {
  rowIndex: number;
  origens?: number[];
  codigo: string;
  quantidade: number;
  observacao?: string;
  rastros?: string[];
  valor_unitario?: number | null;
  material_id?: string;
  materialLabel?: string;
  error?: string;
};

type NFParseResult = {
  numero_documento?: string;
  fornecedor?: string;
  chave_nfe?: string;
  data_emissao?: string;
  itens: Array<{
    codigo?: string;
    descricao?: string;
    quantidade?: number;
    unidade?: string;
  }>;
};

function getUserDisplayName(user: any): string {
  const metaName = user?.user_metadata?.nome_completo || user?.user_metadata?.name;
  return (metaName || user?.email || "").toString();
}

function guessAnexoTipo(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xml")) return "xml";
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) return "planilha";
  if (name.endsWith(".pdf")) return "nf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".webp")) return "foto";
  return "outro";
}

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseNumero(value: any): number | null {
  if (value == null) return null;
  const str = String(value).trim().replace(",", ".");
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractJsonFromText<T>(text: string): T | null {
  const trimmed = text.trim();
  const direct = safeJsonParse<T>(trimmed);
  if (direct) return direct;
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return safeJsonParse<T>(trimmed.slice(firstBrace, lastBrace + 1));
  }
  return null;
}

function parseNFeXml(xmlText: string): NFParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const getText = (selector: string) => doc.querySelector(selector)?.textContent?.trim() || "";

  const numero = getText("ide > nNF") || getText("nNF");
  const emitente = getText("emit > xNome") || getText("xNome");
  const chave = getText("protNFe > infProt > chNFe") || getText("chNFe");
  const dataEmissao = getText("ide > dhEmi") || getText("dhEmi") || getText("dEmi");

  const itens: NFParseResult["itens"] = [];
  doc.querySelectorAll("det").forEach((det) => {
    const cProd = det.querySelector("prod > cProd")?.textContent?.trim();
    const xProd = det.querySelector("prod > xProd")?.textContent?.trim();
    const qCom = det.querySelector("prod > qCom")?.textContent?.trim();
    const uCom = det.querySelector("prod > uCom")?.textContent?.trim();
    itens.push({
      codigo: cProd || undefined,
      descricao: xProd || undefined,
      quantidade: qCom ? parseNumero(qCom) ?? undefined : undefined,
      unidade: uCom || undefined,
    });
  });

  return {
    numero_documento: numero || undefined,
    fornecedor: emitente || undefined,
    chave_nfe: chave || undefined,
    data_emissao: dataEmissao || undefined,
    itens,
  };
}

function isSerialMaterial(material: any): boolean {
  return !!(material?.requer_serial || material?.unidade === "SR");
}

function parseRastrosText(text: string): string[] {
  if (!text?.trim()) return [];
  const tokens = text
    .split(/[\n,; \t]+/g)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.toUpperCase());

  // remover duplicados mantendo ordem
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(t);
    }
  }
  return unique;
}

function expandSerialRange(inicio: string, fim: string, maxItems: number = 500): string[] {
  const a = (inicio || "").trim().toUpperCase();
  const b = (fim || "").trim().toUpperCase();
  if (!a || !b) return [];

  const ma = a.match(/^(.*?)(\d+)$/);
  const mb = b.match(/^(.*?)(\d+)$/);
  if (!ma || !mb) {
    throw new Error("Range inválido: os rastros devem terminar com números (ex: MED2024001).");
  }

  const prefixA = ma[1];
  const prefixB = mb[1];
  if (prefixA !== prefixB) {
    throw new Error("Range inválido: os rastros devem ter o mesmo prefixo.");
  }

  const numA = Number(ma[2]);
  const numB = Number(mb[2]);
  if (!Number.isFinite(numA) || !Number.isFinite(numB)) {
    throw new Error("Range inválido: numeração não reconhecida.");
  }

  const start = Math.min(numA, numB);
  const end = Math.max(numA, numB);
  const pad = Math.max(ma[2].length, mb[2].length);
  const count = end - start + 1;
  if (count <= 0) return [];
  if (count > maxItems) {
    throw new Error(`Range muito grande (${count}). Limite: ${maxItems}.`);
  }

  const list: string[] = [];
  for (let i = start; i <= end; i++) {
    list.push(`${prefixA}${String(i).padStart(pad, "0")}`);
  }
  return list;
}

async function insertMovimentacaoSafe(payload: any) {
  // Compatibilidade: se a coluna recebimento_id ainda não existir no banco, tenta sem ela.
  const { error } = await supabase.from("materiais_movimentacoes").insert(payload as any);
  if (!error) return;

  const msg = String((error as any)?.message || "");
  if (msg.toLowerCase().includes("recebimento_id") && msg.toLowerCase().includes("column")) {
    const { recebimento_id, ...rest } = payload || {};
    const { error: retryError } = await supabase.from("materiais_movimentacoes").insert(rest as any);
    if (retryError) throw retryError;
    return;
  }

  throw error;
}

export default function Recebimentos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [nfDialogOpen, setNfDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [conferirDialog, setConferirDialog] = useState(false);
  const [selectedRecebimento, setSelectedRecebimento] = useState<Recebimento | null>(null);

  // Form para novo recebimento
  const [novoRecebimento, setNovoRecebimento] = useState<NovoRecebimentoForm>({
    numero_documento: "",
    fornecedor: "",
    recebido_por: "",
    chave_nfe: "",
    canal_entrada: "manual",
    observacao: "",
    itens: [],
  });
  const [itemTemp, setItemTemp] = useState({ material_id: "", quantidade: 1 });
  const [anexosTemp, setAnexosTemp] = useState<File[]>([]);
  const [buscaMaterial, setBuscaMaterial] = useState("");

  // Rastros (para item SR no recebimento manual)
  const [dialogRastros, setDialogRastros] = useState(false);
  const [modoSelecaoRastros, setModoSelecaoRastros] = useState<"individual" | "range" | "importar">("individual");
  const [rastroDigitado, setRastroDigitado] = useState("");
  const [rangeInicio, setRangeInicio] = useState("");
  const [rangeFim, setRangeFim] = useState("");
  const [importarTexto, setImportarTexto] = useState("");
  const [rastrosSelecionados, setRastrosSelecionados] = useState<string[]>([]);
  const [valorUnitarioTemp, setValorUnitarioTemp] = useState<number | null>(null);

  // Form para conferência
  const [conferencia, setConferencia] = useState<Record<string, number>>({});

  // Importação por planilha
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importHeader, setImportHeader] = useState<Partial<NovoRecebimentoForm>>({});
  const [importAnexos, setImportAnexos] = useState<File[]>([]);
  const [editImportRastrosOpen, setEditImportRastrosOpen] = useState(false);
  const [editImportRowKey, setEditImportRowKey] = useState<string | null>(null);
  const [editImportRastrosText, setEditImportRastrosText] = useState("");

  // Leitura de NF (IA/XML)
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [nfParsed, setNfParsed] = useState<NFParseResult | null>(null);
  const [nfAnexos, setNfAnexos] = useState<File[]>([]);
  const [nfLoading, setNfLoading] = useState(false);

  // Cancelamento/Exclusão
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [recebimentoParaExcluir, setRecebimentoParaExcluir] = useState<Recebimento | null>(null);

  useEffect(() => {
    const display = getUserDisplayName(user);
    if (display && !novoRecebimento.recebido_por) {
      setNovoRecebimento((prev) => ({ ...prev, recebido_por: display }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Query para recebimentos
  const { data: recebimentos, isLoading } = useQuery({
    queryKey: ["recebimentos", filtroStatus, searchTerm, dataIni, dataFim],
    queryFn: async () => {
      let query = supabase
        .from("materiais_recebimentos")
        .select("*")
        .order("created_at", { ascending: false });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      const recebimentosBase = (data || []) as any[];

      // Filtro por período (client-side para evitar dependência de colunas/formatos)
      let filtrados = recebimentosBase;
      if (dataIni) {
        const ini = new Date(`${dataIni}T00:00:00`);
        filtrados = filtrados.filter((r) => new Date(r.data_recebimento || r.created_at) >= ini);
      }
      if (dataFim) {
        const fim = new Date(`${dataFim}T23:59:59`);
        filtrados = filtrados.filter((r) => new Date(r.data_recebimento || r.created_at) <= fim);
      }

      // Buscar itens em lote (evita N+1)
      const ids = filtrados.map((r) => r.id);
      const itensPorRecebimento = new Map<string, RecebimentoItem[]>();

      if (ids.length > 0) {
        const { data: itensData, error: itensError } = await supabase
          .from("materiais_recebimentos_itens")
          .select(`
            recebimento_id,
            material_id,
            quantidade_esperada,
            quantidade_recebida,
            valor_unitario,
            observacao,
            materiais (codigo, nome, unidade, requer_serial, valor_unitario)
          `)
          .in("recebimento_id", ids);

        if (itensError) throw itensError;

        (itensData || []).forEach((item: any) => {
          const arr = itensPorRecebimento.get(item.recebimento_id) || [];
          arr.push({
            material_id: item.material_id,
            quantidade_esperada: item.quantidade_esperada,
            quantidade_recebida: item.quantidade_recebida,
            valor_unitario: item.valor_unitario,
            observacao: item.observacao,
            material: item.materiais,
          });
          itensPorRecebimento.set(item.recebimento_id, arr);
        });
      }

      const recebimentosComItens = filtrados.map((rec: any) => ({
        ...rec,
        itens: itensPorRecebimento.get(rec.id) || [],
      }));

      // Filtrar por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return recebimentosComItens.filter(
          (r: any) =>
            r.numero_documento?.toLowerCase().includes(term) ||
            r.fornecedor?.toLowerCase().includes(term) ||
            r.recebido_por?.toLowerCase().includes(term)
        );
      }

      return recebimentosComItens as Recebimento[];
    },
  });

  // Query para materiais
  const { data: materiais } = useQuery({
    queryKey: ["materiais-ativos-recebimento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, codigo, nome, unidade, requer_serial, valor_unitario")
        .eq("ativo", true)
        .order("codigo");

      if (error) throw error;
      return data;
    },
  });

  const materiaisByCodigo = useMemo(() => {
    const map = new Map<string, any>();
    (materiais || []).forEach((m: any) => {
      map.set(String(m.codigo || "").trim().toUpperCase(), m);
    });
    return map;
  }, [materiais]);

  // Query para anexos (somente quando abre o detalhe)
  const { data: anexosRecebimento } = useQuery({
    queryKey: ["recebimentos-anexos", selectedRecebimento?.id],
    enabled: !!selectedRecebimento?.id && viewDialog,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_recebimentos_anexos")
        .select("*")
        .eq("recebimento_id", selectedRecebimento!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as RecebimentoAnexo[];
    },
  });

  const { data: rastrosRecebimento } = useQuery({
    queryKey: ["recebimentos-rastros", selectedRecebimento?.id],
    enabled: !!selectedRecebimento?.id && viewDialog,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_recebimentos_itens_rastros")
        .select("material_id, numero_serie")
        .eq("recebimento_id", selectedRecebimento!.id)
        .order("numero_serie", { ascending: true });

      if (error) throw error;
      return (data || []) as Array<{ material_id: string; numero_serie: string }>;
    },
  });

  const rastrosMap = useMemo(() => {
    const map = new Map<string, string[]>();
    (rastrosRecebimento || []).forEach((r) => {
      const arr = map.get(r.material_id) || [];
      arr.push(String(r.numero_serie || "").toUpperCase());
      map.set(r.material_id, arr);
    });
    return map;
  }, [rastrosRecebimento]);

  const [viewRastrosOpen, setViewRastrosOpen] = useState(false);
  const [viewRastrosMaterialId, setViewRastrosMaterialId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const list = recebimentos || [];
    const pendentes = list.filter((r) => r.status === "pendente").length;
    const finalizados = list.filter((r) => r.status === "finalizado").length;
    const totalItens = list.reduce((acc, r) => acc + (r.itens?.length || 0), 0);
    return { pendentes, finalizados, total: list.length, totalItens };
  }, [recebimentos]);

  const { sortConfig, handleSort, sortedData } = useSortableTable<Recebimento>(
    recebimentos,
    { column: "data_recebimento", direction: "desc" }
  );

  const handleDownloadTemplate = () => {
    const rows = [
      [
        "Documento",
        "Fornecedor",
        "Recebido Por",
        "Chave NF-e",
        "Data Recebimento (YYYY-MM-DD)",
        "Código Material",
        "Quantidade",
        "Rastros",
        "Observação Item",
      ],
      ["NF-123456", "CONCESSIONÁRIA X", "João da Silva", "3519... (opcional)", format(new Date(), "yyyy-MM-dd"), "MAT0001", 10, "", ""],
      ["NF-123456", "CONCESSIONÁRIA X", "João da Silva", "3519... (opcional)", format(new Date(), "yyyy-MM-dd"), "MED-MONO-01", "", "MED2024001\\nMED2024002\\nMED2024003", "Material com rastro: preencher 'Rastros'"],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Recebimento");
    XLSX.writeFile(wb, `template-recebimento-${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportRows([]);
    setImportHeader({});
    setImportAnexos([]);
  };

  const resetNFState = () => {
    setNfFile(null);
    setNfParsed(null);
    setNfAnexos([]);
    setNfLoading(false);
  };

  const handleImportFile = async (file: File) => {
    setImportFile(file);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      if (!json.length) {
        toast.error("Planilha vazia");
        return;
      }

      const keys = Object.keys(json[0] || {});
      const keyMap = new Map<string, string>();
      keys.forEach((k) => keyMap.set(normalizeHeader(k), k));

      const colDocumento = keyMap.get("documento") || keyMap.get("numerodocumento") || keyMap.get("nf");
      const colFornecedor = keyMap.get("fornecedor") || keyMap.get("origem");
      const colRecebidoPor = keyMap.get("recebidopor") || keyMap.get("recebedor");
      const colChave = keyMap.get("chavenfe") || keyMap.get("chave");
      const colCodigo = keyMap.get("codigomaterial") || keyMap.get("codigo") || keyMap.get("materialcodigo");
      const colQtd = keyMap.get("quantidade") || keyMap.get("qtd");
      const colObs = keyMap.get("observacaoitem") || keyMap.get("observacao") || keyMap.get("obs");
      const colRastros = keyMap.get("rastros") || keyMap.get("numeroserie") || keyMap.get("numero_serie") || keyMap.get("serial") || keyMap.get("series");
      const colValor = keyMap.get("valorunitario") || keyMap.get("valor") || keyMap.get("preco") || keyMap.get("preco_unitario") || keyMap.get("preçounitario");

      if (!colCodigo || !colQtd) {
        toast.error('Template inválido: colunas obrigatórias "Código Material" e "Quantidade" não encontradas.');
        return;
      }

      const headerFromFirst = json[0];
      const header: Partial<NovoRecebimentoForm> = {
        numero_documento: colDocumento ? String(headerFromFirst[colDocumento] || "") : "",
        fornecedor: colFornecedor ? String(headerFromFirst[colFornecedor] || "") : "",
        recebido_por: colRecebidoPor ? String(headerFromFirst[colRecebidoPor] || "") : getUserDisplayName(user),
        chave_nfe: colChave ? String(headerFromFirst[colChave] || "") : "",
        canal_entrada: "planilha",
        observacao: "",
      };
      setImportHeader(header);

      const rows: ImportRow[] = json.map((row, idx) => {
        const codigo = String(row[colCodigo] || "").trim().toUpperCase();
        const qtd = parseNumero(row[colQtd]);
        const obs = colObs ? String(row[colObs] || "").trim() : "";
        const rastrosRaw = colRastros ? String(row[colRastros] || "").trim() : "";
        const valorRaw = colValor ? row[colValor] : "";

        if (!codigo) {
          return { rowIndex: idx + 2, codigo: "", quantidade: 0, observacao: obs, error: "Código do material vazio" };
        }

        const material = materiaisByCodigo.get(codigo);
        if (!material) {
          return { rowIndex: idx + 2, codigo, quantidade: qtd || 0, observacao: obs, error: "Código não encontrado no catálogo" };
        }

        const valorDefault = typeof material.valor_unitario === "number" ? material.valor_unitario : null;
        const valorPlanilha = colValor ? parseNumero(valorRaw) : null;
        const valorUnitario = valorPlanilha != null ? valorPlanilha : valorDefault;

        const requerSerial = isSerialMaterial(material);
        const rastros = rastrosRaw ? parseRastrosText(rastrosRaw) : [];

        if (requerSerial) {
          if (rastros.length === 0) {
            return {
              rowIndex: idx + 2,
              codigo,
              quantidade: 0,
              observacao: obs,
              error: "Material com rastro: preencha a coluna 'Rastros'",
            };
          }
          // Quantidade: pode ser calculada pelos rastros. Se veio na planilha, deve bater.
          if (qtd && qtd > 0 && qtd !== rastros.length) {
            return {
              rowIndex: idx + 2,
              codigo,
              quantidade: qtd,
              rastros,
              observacao: obs,
              error: `Quantidade (${qtd}) diferente da quantidade de rastros (${rastros.length})`,
            };
          }
          return {
            rowIndex: idx + 2,
            codigo,
            quantidade: rastros.length,
            rastros,
            valor_unitario: valorUnitario,
            observacao: obs,
            material_id: material.id,
            materialLabel: `${material.codigo} - ${material.nome}`,
          };
        }

        if (!qtd || qtd <= 0) {
          return { rowIndex: idx + 2, codigo, quantidade: 0, observacao: obs, error: "Quantidade inválida" };
        }

        return {
          rowIndex: idx + 2,
          codigo,
          quantidade: qtd,
          observacao: obs,
          valor_unitario: valorUnitario,
          material_id: material.id,
          materialLabel: `${material.codigo} - ${material.nome}`,
        };
      });

      // Consolidar linhas duplicadas (mesmo material) para evitar criar 2 itens iguais
      const consolidadasMap = new Map<string, ImportRow>();
      const naoConsolidaveis: ImportRow[] = [];

      for (const r of rows) {
        if (!r.material_id || r.error) {
          naoConsolidaveis.push(r);
          continue;
        }

        const key = r.material_id;
        const atual = consolidadasMap.get(key);
        const material = materiais?.find((m: any) => m.id === r.material_id);
        const requerSerial = isSerialMaterial(material);

        if (!atual) {
          consolidadasMap.set(key, { ...r, origens: [r.rowIndex] });
          continue;
        }

        const origens = Array.from(new Set([...(atual.origens || [atual.rowIndex]), r.rowIndex]));

        if (requerSerial) {
          const rastros = Array.from(
            new Set([...(atual.rastros || []), ...(r.rastros || [])].map((x) => String(x).toUpperCase()))
          );
          const valor_unitario = (r.valor_unitario != null ? r.valor_unitario : atual.valor_unitario) ?? null;
          const merged: ImportRow = {
            ...atual,
            origens,
            rastros,
            quantidade: rastros.length,
            valor_unitario,
          };
          if (!rastros.length) {
            merged.error = "Material com rastro: preencha a coluna 'Rastros'";
          } else {
            merged.error = undefined;
          }
          consolidadasMap.set(key, merged);
        } else {
          const merged: ImportRow = {
            ...atual,
            origens,
            quantidade: (atual.quantidade || 0) + (r.quantidade || 0),
            observacao: [atual.observacao, r.observacao].filter(Boolean).join(" | ").slice(0, 500),
            valor_unitario: (r.valor_unitario != null ? r.valor_unitario : atual.valor_unitario) ?? null,
          };
          consolidadasMap.set(key, merged);
        }
      }

      const consolidadas = [...consolidadasMap.values()];
      const finalRows = [...consolidadas, ...naoConsolidaveis].sort((a, b) => a.rowIndex - b.rowIndex);

      setImportRows(finalRows);
      toast.success(`Planilha carregada: ${finalRows.length} item(ns) após consolidação`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao ler planilha");
    }
  };

  const buildFormFromImport = (): { form: NovoRecebimentoForm; anexos: File[] } | null => {
    const invalid = importRows.filter((r) => !r.material_id || !!r.error);
    if (invalid.length) {
      toast.error("Corrija as linhas com erro antes de criar o recebimento.");
      return null;
    }

    const itens: RecebimentoItem[] = importRows.map((r) => ({
      material_id: r.material_id!,
      quantidade_esperada: r.quantidade,
      observacao: r.observacao,
      rastros: r.rastros,
      valor_unitario: r.valor_unitario ?? null,
      material: materiais?.find((m: any) => m.id === r.material_id),
    }));

    const form: NovoRecebimentoForm = {
      numero_documento: String((importHeader as any).numero_documento || ""),
      fornecedor: String((importHeader as any).fornecedor || ""),
      recebido_por: String((importHeader as any).recebido_por || getUserDisplayName(user)),
      chave_nfe: String((importHeader as any).chave_nfe || ""),
      canal_entrada: "planilha",
      observacao: "",
      itens,
    };

    return { form, anexos: importAnexos };
  };

  const openEditImportRastros = (row: ImportRow) => {
    const key = `${row.rowIndex}-${row.codigo}`;
    setEditImportRowKey(key);
    setEditImportRastrosText((row.rastros || []).join("\n"));
    setEditImportRastrosOpen(true);
  };

  const saveEditImportRastros = () => {
    if (!editImportRowKey) return;
    const list = parseRastrosText(editImportRastrosText);

    setImportRows((prev) =>
      prev.map((r) => {
        const key = `${r.rowIndex}-${r.codigo}`;
        if (key !== editImportRowKey) return r;

        const material = r.material_id ? materiais?.find((m: any) => m.id === r.material_id) : null;
        const requerSerial = isSerialMaterial(material);

        if (!requerSerial) {
          return { ...r, rastros: [] };
        }

        if (!list.length) {
          return { ...r, rastros: [], quantidade: 0, error: "Material com rastro: preencha a lista de rastros" };
        }

        // Atualiza quantidade para bater com rastros
        return { ...r, rastros: list, quantidade: list.length, error: undefined };
      })
    );

    setEditImportRastrosOpen(false);
    setEditImportRowKey(null);
  };

  const callGeminiNF = async (file: File): Promise<NFParseResult> => {
    if (!geminiApiKey.trim()) {
      throw new Error("Informe a chave da API do Gemini para usar a leitura automática.");
    }
    localStorage.setItem("gemini_api_key", geminiApiKey.trim());

    const model = "gemini-2.5-flash";
    const base64 = await fileToBase64(file);
    const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    const prompt = `Você é um assistente que extrai dados de Nota Fiscal (NF-e/NF) para lançamento de recebimento de materiais.
Retorne SOMENTE um JSON válido (sem markdown) com este formato:
{
  "numero_documento": "string | null",
  "fornecedor": "string | null",
  "chave_nfe": "string | null",
  "data_emissao": "string | null",
  "itens": [
    { "codigo": "string | null", "descricao": "string | null", "quantidade": number | null, "unidade": "string | null" }
  ]
}
Regras:
- Não invente valores. Se não encontrar, use null.
- Quantidade deve ser número.
- Se houver mais de um tipo de código, prefira o código do item na NF (cProd).
`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64.split(",")[1],
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        geminiApiKey.trim()
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini: falha ao ler NF (${resp.status}). ${errText}`);
    }

    const data = await resp.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        .filter(Boolean)
        .join("\n") || "";

    const parsed = extractJsonFromText<NFParseResult>(text);
    if (!parsed || !Array.isArray(parsed.itens)) {
      throw new Error("Não foi possível interpretar a NF (JSON inválido).");
    }
    return parsed;
  };

  const buildFormFromNF = (): { form: NovoRecebimentoForm; anexos: File[] } | null => {
    if (!nfParsed) return null;

    const mapped = (nfParsed.itens || []).map((it, idx) => {
      const codigo = String(it.codigo || "").trim().toUpperCase();
      const qtd = it.quantidade ?? null;
      if (!codigo) return { idx, error: "Item sem código" };
      if (!qtd || qtd <= 0) return { idx, error: "Quantidade inválida" };
      const material = materiaisByCodigo.get(codigo);
      if (!material) return { idx, error: "Código não encontrado no catálogo" };
      if (isSerialMaterial(material)) return { idx, error: "Material com rastro: informe os rastros via Importação/Manual" };
      return { idx, codigo, qtd, material };
    });

    const invalid = mapped.find((m: any) => m?.error);
    if (invalid) {
      toast.error("NF lida, mas existem itens sem mapeamento no catálogo. Ajuste os códigos ou use importação manual.");
      return null;
    }

    const itens: RecebimentoItem[] = (mapped as any[]).map((m) => ({
      material_id: m.material.id,
      quantidade_esperada: m.qtd,
      material: m.material,
    }));

    const form: NovoRecebimentoForm = {
      numero_documento: nfParsed.numero_documento || "",
      fornecedor: nfParsed.fornecedor || "",
      recebido_por: getUserDisplayName(user),
      chave_nfe: nfParsed.chave_nfe || "",
      canal_entrada: nfFile?.name.toLowerCase().endsWith(".xml") ? "nf_xml" : "nf_ia",
      observacao: "",
      itens,
    };

    const anexos = [...(nfFile ? [nfFile] : []), ...nfAnexos];
    return { form, anexos };
  };

  // Mutation para criar recebimento
  const criarRecebimentoMutation = useMutation({
    mutationFn: async (args: { form: NovoRecebimentoForm; anexos: File[] }) => {
      const { form, anexos } = args;

      // Pré-validações (ANTES de inserir qualquer coisa) para evitar recebimentos “parciais”
      const itensComRastro = form.itens.filter((i) => (i.rastros?.length || 0) > 0);
      if (itensComRastro.length) {
        const all = itensComRastro.flatMap((i) => (i.rastros || []).map((r) => r.toUpperCase()));
        const dup = all.filter((r, idx) => all.indexOf(r) !== idx);
        if (dup.length) {
          throw new Error(`Rastros duplicados no arquivo: ${Array.from(new Set(dup)).slice(0, 10).join(", ")}`);
        }

        // 1) Já cadastrado como serializado
        const { data: existentes, error: existError } = await supabase
          .from("materiais_serializados")
          .select("numero_serie, material_id")
          .in("numero_serie", all);
        if (existError) throw existError;
        if (existentes && existentes.length) {
          const list = existentes.map((e: any) => e.numero_serie).slice(0, 10).join(", ");
          throw new Error(
            `Rastro(s) já cadastrados no sistema (duplicidade não permitida): ${list}. ` +
            `Cada rastro deve ser único.`
          );
        }

        // 2) Já reservado em outro recebimento
        const { data: reservados, error: resError } = await supabase
          .from("materiais_recebimentos_itens_rastros")
          .select("recebimento_id, material_id, numero_serie")
          .in("numero_serie", all);
        if (resError) throw resError;
        if (reservados && reservados.length) {
          const recebIds = Array.from(new Set(reservados.map((r: any) => r.recebimento_id)));
          const { data: recsInfo } = await supabase
            .from("materiais_recebimentos")
            .select("id, numero_documento, fornecedor, status, data_recebimento")
            .in("id", recebIds);

          const recMap = new Map<string, any>();
          (recsInfo || []).forEach((r: any) => recMap.set(r.id, r));

          const exemplos = reservados
            .slice(0, 10)
            .map((r: any) => {
              const info = recMap.get(r.recebimento_id);
              const doc = info?.numero_documento ? `Doc ${info.numero_documento}` : `Recebimento ${r.recebimento_id}`;
              const status = info?.status ? ` (${info.status})` : "";
              return `${String(r.numero_serie).toUpperCase()} → ${doc}${status}`;
            })
            .join(" | ");

          throw new Error(
            `Rastro(s) já informados em outro recebimento (duplicidade não permitida). ` +
            `Exemplos: ${exemplos}`
          );
        }
      }

      let recebimentoIdCriado: string | null = null;
      try {
        // Criar recebimento
        const { data: recebimento, error: recError } = await supabase
          .from("materiais_recebimentos")
          .insert({
            numero_documento: form.numero_documento || null,
            fornecedor: form.fornecedor || null,
            recebido_por: form.recebido_por || null,
            recebido_por_user_id: user?.id || null,
            canal_entrada: form.canal_entrada || "manual",
            chave_nfe: form.chave_nfe || null,
            observacao: form.observacao || null,
            status: "pendente",
          })
          .select()
          .single();

        if (recError) throw recError;
        recebimentoIdCriado = recebimento.id;

      // Atualizar preço no catálogo se o importador alterou (histórico via RPC)
      const precosAlterados = new Map<string, number>();
      for (const item of form.itens) {
        const v = item.valor_unitario;
        if (v == null) continue;
        const current = (item.material?.valor_unitario ?? null) as number | null;
        if (current == null) continue;
        if (Number(current) !== Number(v)) {
          precosAlterados.set(item.material_id, Number(v));
        }
      }
      for (const [materialId, valor] of precosAlterados.entries()) {
        const { error: rpcErr } = await supabase.rpc("update_material_price", {
          p_material_id: materialId,
          p_valor_unitario: valor,
          p_origem: "recebimento",
          p_referencia: form.numero_documento || null,
        });
        if (rpcErr) throw rpcErr;
      }

      // Criar itens
        const itensPayload = form.itens.map((item) => ({
          recebimento_id: recebimento.id,
          material_id: item.material_id,
          quantidade_esperada: item.quantidade_esperada,
        valor_unitario: item.valor_unitario ?? item.material?.valor_unitario ?? null,
        }));

        const { error: itensError } = await supabase
          .from("materiais_recebimentos_itens")
          .insert(itensPayload);

        if (itensError) throw itensError;

        // Persistir rastros (materiais serializados)
        if (itensComRastro.length) {
          const rastrosPayload = itensComRastro.flatMap((i) =>
            (i.rastros || []).map((numero_serie) => ({
              recebimento_id: recebimento.id,
              material_id: i.material_id,
              numero_serie: numero_serie.toUpperCase(),
              created_by: user?.id || null,
            }))
          );

          const { error: rastrosError } = await supabase
            .from("materiais_recebimentos_itens_rastros")
            .insert(rastrosPayload);
          if (rastrosError) throw rastrosError;
        }

        // Upload de anexos (opcional)
        if (anexos?.length) {
          for (const file of anexos) {
            const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
            const fileName = `recebimentos/${recebimento.id}/${Date.now()}_${safeName}`;

            const { error: uploadError } = await supabase.storage
              .from("service-attachments")
              .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
              .from("service-attachments")
              .getPublicUrl(fileName);

            const { error: insertError } = await supabase
              .from("materiais_recebimentos_anexos")
              .insert({
                recebimento_id: recebimento.id,
                tipo: guessAnexoTipo(file),
                nome_arquivo: safeName,
                url: urlData.publicUrl,
                created_by: user?.id || null,
              });

            if (insertError) throw insertError;
          }
        }

        return recebimento;
      } catch (e) {
        // Rollback: se criou o cabeçalho e falhou depois, apaga o recebimento para não ficar “pendente fantasma”
        if (recebimentoIdCriado) {
          await supabase.from("materiais_recebimentos").delete().eq("id", recebimentoIdCriado);
        }
        throw e;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      toast.success("Recebimento registrado!");
      setDialogOpen(false);
      setNovoRecebimento({
        numero_documento: "",
        fornecedor: "",
        recebido_por: getUserDisplayName(user),
        chave_nfe: "",
        canal_entrada: "manual",
        observacao: "",
        itens: [],
      });
      setAnexosTemp([]);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao registrar recebimento");
    },
  });

  // Mutation para conferir recebimento
  const conferirMutation = useMutation({
    mutationFn: async ({ recebimento, quantidades }: { recebimento: Recebimento; quantidades: Record<string, number> }) => {
      // Se houver itens serializados, validar/usar os rastros informados no recebimento
      const { data: rastrosData, error: rastrosError } = await supabase
        .from("materiais_recebimentos_itens_rastros")
        .select("material_id, numero_serie")
        .eq("recebimento_id", recebimento.id);

      if (rastrosError) throw rastrosError;

      const rastrosPorMaterial = new Map<string, string[]>();
      (rastrosData || []).forEach((r: any) => {
        const arr = rastrosPorMaterial.get(r.material_id) || [];
        arr.push(String(r.numero_serie || "").toUpperCase());
        rastrosPorMaterial.set(r.material_id, arr);
      });

      // Atualizar quantidades recebidas
      for (const item of recebimento.itens || []) {
        const qtdRecebida = quantidades[item.material_id] || 0;

        await supabase
          .from("materiais_recebimentos_itens")
          .update({ quantidade_recebida: qtdRecebida })
          .eq("recebimento_id", recebimento.id)
          .eq("material_id", item.material_id);

        // Dar entrada no estoque
        if (qtdRecebida > 0) {
          const { data: estoqueAtual } = await supabase
            .from("materiais_estoque")
            .select("id, quantidade")
            .eq("material_id", item.material_id)
            .eq("local_tipo", "central")
            .maybeSingle();

          if (estoqueAtual) {
            await supabase
              .from("materiais_estoque")
              .update({ quantidade: estoqueAtual.quantidade + qtdRecebida })
              .eq("id", estoqueAtual.id);
          } else {
            await supabase.from("materiais_estoque").insert({
              material_id: item.material_id,
              quantidade: qtdRecebida,
              local_tipo: "central",
            });
          }

          // Registrar movimentação
          const valorUnitario = item.valor_unitario ?? item.material?.valor_unitario ?? null;
          await insertMovimentacaoSafe({
            material_id: item.material_id,
            tipo: "entrada",
            quantidade: qtdRecebida,
            quantidade_anterior: estoqueAtual?.quantidade || 0,
            quantidade_nova: (estoqueAtual?.quantidade || 0) + qtdRecebida,
            local_origem_tipo: "externo",
            local_destino_tipo: "central",
            documento_referencia: recebimento.numero_documento,
            observacao: `Recebimento ${recebimento.fornecedor || ""}`,
            recebimento_id: recebimento.id,
            valor_unitario: valorUnitario,
            valor_total: valorUnitario != null ? Number(valorUnitario) * qtdRecebida : null,
          });
        }

        // Se o material requer serial, criar os itens serializados em estoque central
        const requerSerial = isSerialMaterial(item.material);
        if (requerSerial) {
          const rastros = rastrosPorMaterial.get(item.material_id) || [];
          if (qtdRecebida > 0 && rastros.length !== qtdRecebida) {
            throw new Error(
              `Material ${item.material?.codigo || ""}: quantidade recebida (${qtdRecebida}) diferente da quantidade de rastros (${rastros.length}).`
            );
          }

          if (qtdRecebida > 0) {
            // Garantir que nenhum rastro já existe (validação extra no momento da conferência)
            const { data: existentes, error: existError } = await supabase
              .from("materiais_serializados")
              .select("numero_serie")
              .in("numero_serie", rastros);
            if (existError) throw existError;
            if (existentes && existentes.length) {
              const list = existentes.map((e: any) => e.numero_serie).slice(0, 10).join(", ");
              throw new Error(`Alguns rastros já existem no sistema: ${list}`);
            }

            // Inserir serializados
            const serialPayload = rastros.map((numero_serie) => ({
              material_id: item.material_id,
              numero_serie,
              status: "em_estoque",
              localizacao_tipo: "central",
              observacao: `Recebimento ${recebimento.id}`,
            }));

            const { data: novosSerializados, error: serialError } = await supabase
              .from("materiais_serializados")
              .insert(serialPayload)
              .select("id, numero_serie");

            if (serialError) throw serialError;

            // Registrar histórico
            if (novosSerializados?.length) {
              const histPayload = novosSerializados.map((s: any) => ({
                serializado_id: s.id,
                acao: "cadastro",
                status_novo: "em_estoque",
                localizacao_nova: "central",
                observacao: `Cadastro via recebimento ${recebimento.id}`,
              }));

              const { error: histError } = await supabase
                .from("materiais_serializados_historico")
                .insert(histPayload);

              if (histError) throw histError;
            }
          }
        }
      }

      // Atualizar status do recebimento
      const { error: statusError } = await supabase
        .from("materiais_recebimentos")
        .update({
          status: "finalizado",
          data_conferencia: new Date().toISOString(),
          conferido_por: getUserDisplayName(user) || null,
        })
        .eq("id", recebimento.id);

      if (statusError) throw statusError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-central"] });
      toast.success("Recebimento conferido e estoque atualizado!");
      setConferirDialog(false);
      setSelectedRecebimento(null);
      setConferencia({});
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao conferir recebimento");
    },
  });

  const excluirRecebimentoMutation = useMutation({
    mutationFn: async (rec: Recebimento) => {
      // Carregar itens e rastros do recebimento
      const { data: itensData, error: itensError } = await supabase
        .from("materiais_recebimentos_itens")
        .select(`
          material_id,
          quantidade_esperada,
          quantidade_recebida,
          materiais (codigo, nome, unidade, requer_serial)
        `)
        .eq("recebimento_id", rec.id);

      if (itensError) throw itensError;

      const itens = (itensData || []).map((i: any) => ({
        material_id: i.material_id,
        quantidade_esperada: i.quantidade_esperada,
        quantidade_recebida: i.quantidade_recebida,
        material: i.materiais,
      })) as RecebimentoItem[];

      const { data: rastrosData, error: rastrosError } = await supabase
        .from("materiais_recebimentos_itens_rastros")
        .select("material_id, numero_serie")
        .eq("recebimento_id", rec.id);

      if (rastrosError) throw rastrosError;

      const rastrosPorMaterial = new Map<string, string[]>();
      (rastrosData || []).forEach((r: any) => {
        const arr = rastrosPorMaterial.get(r.material_id) || [];
        arr.push(String(r.numero_serie || "").toUpperCase());
        rastrosPorMaterial.set(r.material_id, arr);
      });

      // Se foi finalizado, reverter entrada
      if (rec.status === "finalizado") {
        for (const item of itens) {
          const qtd = (item.quantidade_recebida ?? item.quantidade_esperada) || 0;
          if (qtd <= 0) continue;

          // Validar estoque suficiente para estornar
          const { data: estoqueAtual, error: estError } = await supabase
            .from("materiais_estoque")
            .select("id, quantidade")
            .eq("material_id", item.material_id)
            .eq("local_tipo", "central")
            .maybeSingle();

          if (estError) throw estError;

          const atual = estoqueAtual?.quantidade || 0;
          if (atual < qtd) {
            throw new Error(
              `Não é possível excluir: estoque central insuficiente para estornar ${item.material?.codigo || ""} (precisa ${qtd}, tem ${atual}).`
            );
          }

          // Se for serializado, validar que os rastros ainda estão em estoque central
          const requerSerial = isSerialMaterial(item.material);
          if (requerSerial) {
            const rastros = rastrosPorMaterial.get(item.material_id) || [];
            if (rastros.length !== qtd) {
              throw new Error(
                `Não é possível excluir: quantidade (${qtd}) diferente dos rastros (${rastros.length}) para ${item.material?.codigo || ""}.`
              );
            }

            const { data: serials, error: serialErr } = await supabase
              .from("materiais_serializados")
              .select("id, numero_serie, status, localizacao_tipo")
              .in("numero_serie", rastros);

            if (serialErr) throw serialErr;

            const fora = (serials || []).filter((s: any) => s.status !== "em_estoque" || s.localizacao_tipo !== "central");
            if (fora.length) {
              const list = fora.map((s: any) => s.numero_serie).slice(0, 10).join(", ");
              throw new Error(
                `Não é possível excluir: alguns rastros já foram movimentados/instalados. Ex: ${list}`
              );
            }

            const ids = (serials || []).map((s: any) => s.id);
            if (ids.length) {
              // apagar histórico e depois serializados
              await supabase
                .from("materiais_serializados_historico")
                .delete()
                .in("serializado_id", ids);

              await supabase
                .from("materiais_serializados")
                .delete()
                .in("id", ids);
            }
          }

          // Estornar estoque
          await supabase
            .from("materiais_estoque")
            .update({ quantidade: atual - qtd })
            .eq("id", estoqueAtual!.id);

          // Registrar movimentação de estorno
          const valorUnitario = item.valor_unitario ?? item.material?.valor_unitario ?? null;
          await insertMovimentacaoSafe({
            material_id: item.material_id,
            tipo: "saida",
            quantidade: qtd,
            quantidade_anterior: atual,
            quantidade_nova: atual - qtd,
            local_origem_tipo: "central",
            local_destino_tipo: "externo",
            documento_referencia: rec.numero_documento,
            observacao: `Estorno recebimento ${rec.id}`,
            recebimento_id: rec.id,
            valor_unitario: valorUnitario,
            valor_total: valorUnitario != null ? Number(valorUnitario) * qtd : null,
          });
        }
      }

      // Excluir o recebimento (itens/rastros/anexos em cascata se FK existir; rastros/anexos têm CASCADE)
      const { error: delError } = await supabase
        .from("materiais_recebimentos")
        .delete()
        .eq("id", rec.id);

      if (delError) throw delError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-central"] });
      queryClient.invalidateQueries({ queryKey: ["materiais-serializados"] });
      toast.success("Recebimento excluído e estoque estornado!");
      setDeleteDialog(false);
      setRecebimentoParaExcluir(null);
      setViewDialog(false);
      setSelectedRecebimento(null);
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error.message || "Erro ao excluir recebimento");
    },
  });

  const handleAddItem = () => {
    if (!itemTemp.material_id) {
      toast.error("Selecione um material");
      return;
    }

    const existe = novoRecebimento.itens.find((i) => i.material_id === itemTemp.material_id);
    if (existe) {
      toast.error("Material já adicionado");
      return;
    }

    const material = materiais?.find((m: any) => m.id === itemTemp.material_id);
    const requerSerial = isSerialMaterial(material);
    if (requerSerial) {
      if (!rastrosSelecionados.length) {
        toast.error("Este material requer rastros (números de série).");
        return;
      }
    } else {
      if (itemTemp.quantidade <= 0) {
        toast.error("Informe uma quantidade válida");
        return;
      }
    }

    setNovoRecebimento({
      ...novoRecebimento,
      itens: [
        ...novoRecebimento.itens,
        {
          material_id: itemTemp.material_id,
          quantidade_esperada: requerSerial ? rastrosSelecionados.length : itemTemp.quantidade,
          rastros: requerSerial ? rastrosSelecionados : undefined,
          valor_unitario: valorUnitarioTemp ?? material?.valor_unitario ?? null,
          material,
        },
      ],
    });
    setItemTemp({ material_id: "", quantidade: 1 });
    setBuscaMaterial("");
    setRastrosSelecionados([]);
    setRastroDigitado("");
    setRangeInicio("");
    setRangeFim("");
    setImportarTexto("");
    setValorUnitarioTemp(null);
  };

  const handleRemoveItem = (materialId: string) => {
    setNovoRecebimento({
      ...novoRecebimento,
      itens: novoRecebimento.itens.filter((i) => i.material_id !== materialId),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (novoRecebimento.itens.length === 0) {
      toast.error("Adicione pelo menos um material");
      return;
    }
    criarRecebimentoMutation.mutate({ form: novoRecebimento, anexos: anexosTemp });
  };

  const handleOpenConferir = (rec: Recebimento) => {
    setSelectedRecebimento(rec);
    const initialConf: Record<string, number> = {};
    rec.itens?.forEach((item) => {
      initialConf[item.material_id] = item.quantidade_esperada;
    });
    setConferencia(initialConf);
    setConferirDialog(true);
  };

  const handleConferir = () => {
    if (!selectedRecebimento) return;
    conferirMutation.mutate({ recebimento: selectedRecebimento, quantidades: conferencia });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge className="bg-amber-100 text-amber-700 border-0"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "conferido":
        return <Badge className="bg-blue-100 text-blue-700 border-0"><ClipboardCheck className="h-3 w-3 mr-1" />Conferido</Badge>;
      case "finalizado":
        return <Badge className="bg-green-100 text-green-700 border-0"><CheckCircle className="h-3 w-3 mr-1" />Finalizado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <MainLayout title="Recebimentos">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link to="/materiais">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Truck className="h-6 w-6 text-orange-600" />
                Recebimentos
              </h1>
              <p className="text-muted-foreground text-sm">
                Materiais recebidos da concessionária e fornecedores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const recs = sortedData || [];
                  if (!recs.length) {
                    toast.error("Nada para exportar com os filtros atuais.");
                    return;
                  }

                  const recebimentosSheet = recs.map((r) => ({
                    id: r.id,
                    data_recebimento: r.data_recebimento,
                    numero_documento: r.numero_documento,
                    fornecedor: r.fornecedor,
                    recebido_por: r.recebido_por,
                    chave_nfe: r.chave_nfe,
                    status: r.status,
                    total_itens: r.itens?.length || 0,
                  }));

                  const itensSheet = recs.flatMap((r) =>
                    (r.itens || []).map((i) => ({
                      recebimento_id: r.id,
                      documento: r.numero_documento,
                      material_id: i.material_id,
                      material_codigo: i.material?.codigo,
                      material_nome: i.material?.nome,
                      unidade: i.material?.unidade,
                      quantidade_esperada: i.quantidade_esperada,
                      quantidade_recebida: i.quantidade_recebida ?? null,
                      valor_unitario: i.valor_unitario ?? i.material?.valor_unitario ?? null,
                      valor_total:
                        (i.valor_unitario ?? i.material?.valor_unitario) != null
                          ? Number(i.valor_unitario ?? i.material?.valor_unitario) * Number(i.quantidade_recebida ?? i.quantidade_esperada)
                          : null,
                      observacao: i.observacao ?? null,
                      requer_serial: isSerialMaterial(i.material),
                    }))
                  );

                  const ids = recs.map((r) => r.id);

                  const { data: rastrosData } = await supabase
                    .from("materiais_recebimentos_itens_rastros")
                    .select("recebimento_id, material_id, numero_serie")
                    .in("recebimento_id", ids);

                  const rastrosSheet = (rastrosData || []).map((x: any) => ({
                    recebimento_id: x.recebimento_id,
                    material_id: x.material_id,
                    numero_serie: x.numero_serie,
                  }));

                  // Itens detalhados: 1 linha por rastro (quando houver)
                  const rastrosByRecMat = new Map<string, string[]>();
                  (rastrosData || []).forEach((x: any) => {
                    const key = `${x.recebimento_id}::${x.material_id}`;
                    const arr = rastrosByRecMat.get(key) || [];
                    arr.push(String(x.numero_serie || "").toUpperCase());
                    rastrosByRecMat.set(key, arr);
                  });

                  const itensDetalhadosSheet = recs.flatMap((r) =>
                    (r.itens || []).flatMap((i) => {
                      const key = `${r.id}::${i.material_id}`;
                      const rastros = rastrosByRecMat.get(key) || [];
                      const isSerial = isSerialMaterial(i.material);

                      if (isSerial) {
                        // 1 linha por rastro (quantidade 1)
                        return (rastros.length ? rastros : ["(SEM RASTROS)"]).map((ns) => ({
                          recebimento_id: r.id,
                          documento: r.numero_documento,
                          fornecedor: r.fornecedor,
                          status: r.status,
                          material_id: i.material_id,
                          material_codigo: i.material?.codigo,
                          material_nome: i.material?.nome,
                          unidade: i.material?.unidade,
                          numero_serie: ns,
                          quantidade: 1,
                          valor_unitario: i.valor_unitario ?? i.material?.valor_unitario ?? null,
                          valor_total: (i.valor_unitario ?? i.material?.valor_unitario) != null ? Number(i.valor_unitario ?? i.material?.valor_unitario) : null,
                        }));
                      }

                      return [{
                        recebimento_id: r.id,
                        documento: r.numero_documento,
                        fornecedor: r.fornecedor,
                        status: r.status,
                        material_id: i.material_id,
                        material_codigo: i.material?.codigo,
                        material_nome: i.material?.nome,
                        unidade: i.material?.unidade,
                        numero_serie: null,
                        quantidade: i.quantidade_recebida ?? i.quantidade_esperada,
                        valor_unitario: i.valor_unitario ?? i.material?.valor_unitario ?? null,
                        valor_total:
                          (i.valor_unitario ?? i.material?.valor_unitario) != null
                            ? Number(i.valor_unitario ?? i.material?.valor_unitario) * Number(i.quantidade_recebida ?? i.quantidade_esperada)
                            : null,
                      }];
                    })
                  );

                  // Movimentações: preferencialmente via recebimento_id (migration adiciona)
                  let movsSheet: any[] = [];
                  try {
                    const { data: movs, error: movsErr } = await supabase
                      .from("materiais_movimentacoes")
                      .select("*")
                      .in("recebimento_id", ids)
                      .order("created_at", { ascending: true });
                    if (movsErr) throw movsErr;
                    movsSheet = (movs || []) as any[];
                  } catch {
                    // fallback: gerar “movimentos esperados”
                    movsSheet = recs.flatMap((r) =>
                      (r.itens || []).map((i) => ({
                        recebimento_id: r.id,
                        material_id: i.material_id,
                        tipo: "entrada (estimada)",
                        quantidade: i.quantidade_recebida ?? null,
                        documento_referencia: r.numero_documento,
                        observacao: `Recebimento ${r.fornecedor || ""}`,
                        created_at: r.data_recebimento,
                      }))
                    );
                  }

                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recebimentosSheet), "Recebimentos");
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itensSheet), "Itens");
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itensDetalhadosSheet), "ItensDetalhados");
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rastrosSheet), "Rastros");
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movsSheet), "Movimentacoes");

                  XLSX.writeFile(wb, `recebimentos-export-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
                } catch (e: any) {
                  console.error(e);
                  toast.error(e.message || "Erro ao exportar");
                }
              }}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Template Excel
            </Button>
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button variant="outline" onClick={() => setNfDialogOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Ler NF (IA/XML)
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-2xl">{stats.pendentes}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Finalizados</CardDescription>
              <CardTitle className="text-2xl">{stats.finalizados}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Itens</CardDescription>
              <CardTitle className="text-2xl">{stats.totalItens}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por documento, fornecedor ou recebido por..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">De</Label>
                  <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="w-[170px]" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Até</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[170px]" />
                </div>
                {(dataIni || dataFim) && (
                  <Button variant="ghost" onClick={() => { setDataIni(""); setDataFim(""); }} className="justify-start">
                    <X className="h-4 w-4 mr-2" />
                    Limpar período
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : sortedData && sortedData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead column="data_recebimento" label="Data" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableTableHead column="numero_documento" label="Documento" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableTableHead column="fornecedor" label="Fornecedor" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableTableHead column="recebido_por" label="Recebido por" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableTableHead
                      column="itens.length"
                      label="Itens"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      className="text-center"
                    />
                    <SortableTableHead column="status" label="Status" sortConfig={sortConfig} onSort={handleSort} className="text-center" />
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {format(new Date(rec.data_recebimento), "dd/MM/yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(rec.data_recebimento), "HH:mm")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rec.numero_documento ? (
                          <Badge variant="outline">
                            <FileText className="h-3 w-3 mr-1" />
                            {rec.numero_documento}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rec.fornecedor || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {rec.recebido_por || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{rec.itens?.length || 0} itens</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(rec.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedRecebimento(rec);
                              setViewDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {rec.status === "pendente" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => handleOpenConferir(rec)}
                            >
                              <ClipboardCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              setRecebimentoParaExcluir(rec);
                              setDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum recebimento encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Recebimento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog Novo Recebimento */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Recebimento de Materiais</DialogTitle>
              <DialogDescription>
                Registro manual. Para volumes grandes, use Importação ou Leitura de NF.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº Documento / NF</Label>
                  <Input
                    value={novoRecebimento.numero_documento}
                    onChange={(e) =>
                      setNovoRecebimento({ ...novoRecebimento, numero_documento: e.target.value })
                    }
                    placeholder="Ex: NF-123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor / Origem</Label>
                  <Input
                    value={novoRecebimento.fornecedor}
                    onChange={(e) =>
                      setNovoRecebimento({ ...novoRecebimento, fornecedor: e.target.value })
                    }
                    placeholder="Ex: CPFL, Elektro..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Recebido por</Label>
                  <Input
                    value={novoRecebimento.recebido_por}
                    onChange={(e) =>
                      setNovoRecebimento({ ...novoRecebimento, recebido_por: e.target.value })
                    }
                    placeholder="Nome de quem recebeu a NF/mercadoria"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Chave NF-e (opcional)</Label>
                  <Input
                    value={novoRecebimento.chave_nfe}
                    onChange={(e) =>
                      setNovoRecebimento({ ...novoRecebimento, chave_nfe: e.target.value })
                    }
                    placeholder="Ex: 3519..."
                  />
                </div>
              </div>

              {/* Adicionar itens */}
              <div className="space-y-4">
                <Label>Materiais</Label>
                <div className="flex gap-2">
                  <div className="w-full space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar material por código ou nome..."
                        value={buscaMaterial}
                        onChange={(e) => setBuscaMaterial(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      {materiais?.filter((mat: any) => {
                        if (!buscaMaterial) return true;
                        const term = buscaMaterial.toLowerCase();
                        return (
                          String(mat.codigo || "").toLowerCase().includes(term) ||
                          String(mat.nome || "").toLowerCase().includes(term)
                        );
                      }).map((mat: any) => {
                        const requerSerial = isSerialMaterial(mat);
                        const isSelected = itemTemp.material_id === mat.id;
                        return (
                          <button
                            key={mat.id}
                            type="button"
                            className={`w-full p-3 text-left hover:bg-muted/50 transition-all border-b last:border-b-0 ${
                              isSelected ? "bg-violet-100 border-2 border-violet-500 rounded-lg font-semibold" : ""
                            }`}
                            onClick={() => {
                              setItemTemp({ ...itemTemp, material_id: mat.id });
                              setValorUnitarioTemp(typeof mat.valor_unitario === "number" ? mat.valor_unitario : null);
                              setRastrosSelecionados([]);
                              setRastroDigitado("");
                              setRangeInicio("");
                              setRangeFim("");
                              setImportarTexto("");
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className={`text-sm ${isSelected ? "text-violet-700 font-bold" : "font-medium"}`}>
                                  {mat.codigo}
                                  {requerSerial && <Badge variant="outline" className="ml-2 text-xs">SR</Badge>}
                                </p>
                                <p className="text-xs text-muted-foreground">{mat.nome}</p>
                              </div>
                              <Badge variant="secondary">{mat.unidade}</Badge>
                            </div>
                          </button>
                        );
                      })}
                      {!materiais?.length && (
                        <div className="p-3 text-sm text-muted-foreground">Nenhum material encontrado</div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {itemTemp.material_id && (() => {
                        const material = materiais?.find((m: any) => m.id === itemTemp.material_id);
                        const requerSerial = isSerialMaterial(material);
                        if (requerSerial) {
                          return (
                            <Button
                              type="button"
                              variant={rastrosSelecionados.length ? "default" : "outline"}
                              className="flex-1 justify-between"
                              onClick={() => setDialogRastros(true)}
                            >
                              <span className="flex items-center gap-2">
                                <QrCode className="h-4 w-4" />
                                {rastrosSelecionados.length ? `${rastrosSelecionados.length} rastro(s)` : "Selecionar Rastros *"}
                              </span>
                              <Search className="h-4 w-4" />
                            </Button>
                          );
                        }
                        return (
                          <Input
                            type="number"
                            min="1"
                            value={itemTemp.quantidade}
                            onChange={(e) =>
                              setItemTemp({ ...itemTemp, quantidade: parseInt(e.target.value) || 1 })
                            }
                            className="w-28"
                            placeholder="Qtd"
                          />
                        );
                      })()}
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-36"
                        placeholder="Valor (R$)"
                        value={valorUnitarioTemp ?? ""}
                        onChange={(e) => setValorUnitarioTemp(e.target.value === "" ? null : Number(e.target.value))}
                      />
                      <Button type="button" onClick={handleAddItem}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {novoRecebimento.itens.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-center">Quantidade</TableHead>
                          <TableHead>Rastros</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {novoRecebimento.itens.map((item) => (
                          <TableRow key={item.material_id}>
                            <TableCell>
                              <p className="font-medium">{item.material?.codigo}</p>
                              <p className="text-xs text-muted-foreground">{item.material?.nome}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.quantidade_esperada} {item.material?.unidade}
                            </TableCell>
                            <TableCell>
                              {item.rastros?.length ? (
                                <Badge variant="outline" className="font-mono text-xs">
                                  <QrCode className="h-3 w-3 mr-1" />
                                  {item.rastros.length} rastro(s)
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.material_id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Dialog Rastros (materiais SR) */}
              <Dialog
                open={dialogRastros}
                onOpenChange={(open) => {
                  setDialogRastros(open);
                  if (open) {
                    setModoSelecaoRastros("individual");
                    setRastroDigitado("");
                    setRangeInicio("");
                    setRangeFim("");
                    setImportarTexto("");
                  }
                }}
              >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Selecionar Rastros</DialogTitle>
                    <DialogDescription>
                      Adicione os números de série/rastros deste recebimento. Você pode colar uma lista ou usar range.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={modoSelecaoRastros === "individual" ? "default" : "outline"}
                        onClick={() => setModoSelecaoRastros("individual")}
                      >
                        Individual
                      </Button>
                      <Button
                        type="button"
                        variant={modoSelecaoRastros === "range" ? "default" : "outline"}
                        onClick={() => setModoSelecaoRastros("range")}
                      >
                        Range
                      </Button>
                      <Button
                        type="button"
                        variant={modoSelecaoRastros === "importar" ? "default" : "outline"}
                        onClick={() => setModoSelecaoRastros("importar")}
                      >
                        Colar lista
                      </Button>
                    </div>

                    {modoSelecaoRastros === "individual" && (
                      <div className="space-y-2">
                        <Label>Rastro</Label>
                        <div className="flex gap-2">
                          <Input
                            value={rastroDigitado}
                            onChange={(e) => setRastroDigitado(e.target.value.toUpperCase())}
                            placeholder="Ex: MED2024001"
                            className="font-mono"
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              const val = rastroDigitado.trim().toUpperCase();
                              if (!val) {
                                toast.error("Digite um rastro");
                                return;
                              }
                              setRastrosSelecionados((prev) => (prev.includes(val) ? prev : [...prev, val]));
                              setRastroDigitado("");
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    )}

                    {modoSelecaoRastros === "range" && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Selecionar por Range</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label>Início</Label>
                            <Input
                              value={rangeInicio}
                              onChange={(e) => setRangeInicio(e.target.value.toUpperCase())}
                              placeholder="Ex: MED2024001"
                              className="font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Fim</Label>
                            <Input
                              value={rangeFim}
                              onChange={(e) => setRangeFim(e.target.value.toUpperCase())}
                              placeholder="Ex: MED2024010"
                              className="font-mono"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            try {
                              const list = expandSerialRange(rangeInicio, rangeFim);
                              if (!list.length) {
                                toast.error("Range inválido");
                                return;
                              }
                              setRastrosSelecionados((prev) => {
                                const set = new Set(prev);
                                list.forEach((x) => set.add(x));
                                return Array.from(set);
                              });
                              toast.success(`${list.length} rastro(s) adicionados`);
                            } catch (e: any) {
                              toast.error(e.message || "Erro ao gerar range");
                            }
                          }}
                        >
                          Gerar e adicionar
                        </Button>
                      </div>
                    )}

                    {modoSelecaoRastros === "importar" && (
                      <div className="space-y-2">
                        <Label>Colar lista de rastros</Label>
                        <Textarea
                          value={importarTexto}
                          onChange={(e) => setImportarTexto(e.target.value)}
                          placeholder="Cole aqui (um por linha, ou separado por vírgula/espaco)..."
                          rows={6}
                          className="font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const list = parseRastrosText(importarTexto);
                            if (!list.length) {
                              toast.error("Cole ao menos 1 rastro");
                              return;
                            }
                            setRastrosSelecionados((prev) => {
                              const set = new Set(prev);
                              list.forEach((x) => set.add(x));
                              return Array.from(set);
                            });
                            toast.success(`${list.length} rastro(s) importados`);
                          }}
                        >
                          Importar
                        </Button>
                      </div>
                    )}

                    <div className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">
                          Selecionados: {rastrosSelecionados.length}
                        </p>
                        <Button type="button" variant="ghost" onClick={() => setRastrosSelecionados([])}>
                          <X className="h-4 w-4 mr-2" />
                          Limpar
                        </Button>
                      </div>
                      {rastrosSelecionados.length ? (
                        <div className="flex flex-wrap gap-2">
                          {rastrosSelecionados.slice(0, 50).map((r) => (
                            <Badge key={r} variant="secondary" className="font-mono">
                              {r}
                              <button
                                type="button"
                                className="ml-2 opacity-70 hover:opacity-100"
                                onClick={() => setRastrosSelecionados((prev) => prev.filter((x) => x !== r))}
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                          {rastrosSelecionados.length > 50 && (
                            <span className="text-xs text-muted-foreground">
                              +{rastrosSelecionados.length - 50}...
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum rastro selecionado.</p>
                      )}
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogRastros(false)}>
                        Fechar
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Anexos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Anexos (opcional)
                  </Label>
                  <Button asChild variant="outline" size="sm">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length) setAnexosTemp((prev) => [...prev, ...files]);
                          e.currentTarget.value = "";
                        }}
                      />
                      <Upload className="h-4 w-4 mr-2" />
                      Adicionar
                    </label>
                  </Button>
                </div>
                {anexosTemp.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    {anexosTemp.map((f, idx) => (
                      <div key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{guessAnexoTipo(f)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setAnexosTemp((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={novoRecebimento.observacao}
                  onChange={(e) =>
                    setNovoRecebimento({ ...novoRecebimento, observacao: e.target.value })
                  }
                  placeholder="Observações..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={criarRecebimentoMutation.isPending}>
                  {criarRecebimentoMutation.isPending ? "Salvando..." : "Registrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Importar */}
        <Dialog
          open={importDialogOpen}
          onOpenChange={(open) => {
            setImportDialogOpen(open);
            if (!open) resetImportState();
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Importar Recebimento (Excel)</DialogTitle>
              <DialogDescription>
                Envie uma planilha no padrão do template. O sistema valida códigos e quantidades e cria um recebimento pendente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
                <div className="space-y-2">
                  <Label>Planilha (.xlsx)</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) void handleImportFile(file);
                      e.currentTarget.value = "";
                    }}
                  />
                  {importFile && (
                    <p className="text-xs text-muted-foreground">Arquivo: {importFile.name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleDownloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar template
                  </Button>
                </div>
              </div>

              {importRows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pré-visualização</CardTitle>
                    <CardDescription>
                      Linhas com erro precisam ser corrigidas (catálogo/código). Se o código da NF for diferente do seu catálogo, padronize no catálogo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Documento</Label>
                        <Input
                          value={String((importHeader as any).numero_documento || "")}
                          onChange={(e) => setImportHeader((prev) => ({ ...prev, numero_documento: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fornecedor</Label>
                        <Input
                          value={String((importHeader as any).fornecedor || "")}
                          onChange={(e) => setImportHeader((prev) => ({ ...prev, fornecedor: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Recebido por</Label>
                        <Input
                          value={String((importHeader as any).recebido_por || "")}
                          onChange={(e) => setImportHeader((prev) => ({ ...prev, recebido_por: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Chave NF-e</Label>
                        <Input
                          value={String((importHeader as any).chave_nfe || "")}
                          onChange={(e) => setImportHeader((prev) => ({ ...prev, chave_nfe: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Linha</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead className="text-center">Qtd</TableHead>
                            <TableHead className="text-right">Valor Unit.</TableHead>
                            <TableHead className="text-center">Rastros</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead>Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importRows.map((r) => (
                            <TableRow key={`${r.rowIndex}-${r.codigo}`}>
                              <TableCell className="text-muted-foreground">
                                {r.origens && r.origens.length > 1 ? r.origens.join(",") : r.rowIndex}
                              </TableCell>
                              <TableCell className="font-medium">{r.codigo || "-"}</TableCell>
                              <TableCell className="text-center">{r.quantidade}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="w-28 text-right"
                                  value={r.valor_unitario ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value === "" ? null : Number(e.target.value);
                                    setImportRows((prev) =>
                                      prev.map((x) =>
                                        x.rowIndex === r.rowIndex && x.codigo === r.codigo
                                          ? { ...x, valor_unitario: v }
                                          : x
                                      )
                                    );
                                  }}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                {(() => {
                                  const material = r.material_id ? materiais?.find((m: any) => m.id === r.material_id) : null;
                                  const requerSerial = isSerialMaterial(material);
                                  if (!requerSerial) return <span className="text-muted-foreground text-xs">-</span>;

                                  return (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 font-mono"
                                      onClick={() => openEditImportRastros(r)}
                                    >
                                      <QrCode className="h-3 w-3 mr-1" />
                                      {r.rastros?.length ? r.rastros.length : "Editar"}
                                    </Button>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>{r.materialLabel || <span className="text-muted-foreground">-</span>}</TableCell>
                              <TableCell>
                                {r.error ? <Badge variant="destructive">{r.error}</Badge> : <Badge variant="secondary">OK</Badge>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          Anexos (opcional)
                        </Label>
                        <Button asChild variant="outline" size="sm">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length) setImportAnexos((prev) => [...prev, ...files]);
                                e.currentTarget.value = "";
                              }}
                            />
                            <Upload className="h-4 w-4 mr-2" />
                            Adicionar
                          </label>
                        </Button>
                      </div>
                      {importAnexos.length > 0 && (
                        <div className="border rounded-lg p-3 space-y-2">
                          {importAnexos.map((f, idx) => (
                            <div key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{f.name}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setImportAnexos((prev) => prev.filter((_, i) => i !== idx))}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
                      <Button
                        onClick={() => {
                          const built = buildFormFromImport();
                          if (!built) return;
                          criarRecebimentoMutation.mutate(built, {
                            onSuccess: () => {
                              setImportDialogOpen(false);
                              resetImportState();
                            },
                          });
                        }}
                        disabled={criarRecebimentoMutation.isPending}
                      >
                        {criarRecebimentoMutation.isPending ? "Criando..." : "Criar recebimento"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Editar Rastros (Importação) */}
        <Dialog
          open={editImportRastrosOpen}
          onOpenChange={(open) => {
            setEditImportRastrosOpen(open);
            if (!open) {
              setEditImportRowKey(null);
              setEditImportRastrosText("");
            }
          }}
        >
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar rastros da linha</DialogTitle>
              <DialogDescription>
                Cole/edite os rastros (um por linha ou separados por vírgula/espaço). A quantidade será recalculada automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Textarea
                value={editImportRastrosText}
                onChange={(e) => setEditImportRastrosText(e.target.value)}
                rows={10}
                className="font-mono"
                placeholder="Ex:\nMED2024001\nMED2024002\nMED2024003"
              />
              <div className="text-xs text-muted-foreground">
                Total detectado: {parseRastrosText(editImportRastrosText).length}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditImportRastrosOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={saveEditImportRastros}>
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Ler NF */}
        <Dialog
          open={nfDialogOpen}
          onOpenChange={(open) => {
            setNfDialogOpen(open);
            if (!open) resetNFState();
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ler NF (IA) / Importar XML</DialogTitle>
              <DialogDescription>
                Envie uma foto/PDF da NF para leitura por IA (Gemini) ou envie o XML da NF-e para leitura direta.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Arquivo da NF (PDF/Imagem/XML)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setNfFile(file);
                      setNfParsed(null);
                      if (file && file.name.toLowerCase().endsWith(".xml")) {
                        file.text()
                          .then((txt) => setNfParsed(parseNFeXml(txt)))
                          .catch(() => toast.error("Erro ao ler XML"));
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                  {nfFile && <p className="text-xs text-muted-foreground">Arquivo: {nfFile.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Chave API Gemini (apenas para foto/PDF)</Label>
                  <Input
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Cole sua chave do Gemini"
                  />
                  <p className="text-xs text-muted-foreground">
                    A chave fica salva no navegador em `localStorage` (mesmo padrão do “Gerar com IA”).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!nfFile || nfFile.name.toLowerCase().endsWith(".xml") || nfLoading}
                  onClick={async () => {
                    if (!nfFile) return;
                    try {
                      setNfLoading(true);
                      const parsed = await callGeminiNF(nfFile);
                      setNfParsed(parsed);
                      toast.success("NF interpretada. Revise os dados e crie o recebimento.");
                    } catch (e: any) {
                      console.error(e);
                      toast.error(e.message || "Erro ao ler NF com IA");
                    } finally {
                      setNfLoading(false);
                    }
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {nfLoading ? "Lendo..." : "Ler com IA"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNfFile(null);
                    setNfParsed(null);
                    setNfAnexos([]);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              </div>

              {nfParsed && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Prévia da NF</CardTitle>
                    <CardDescription>
                      O recebimento só será criado se todos os itens estiverem mapeados por código no catálogo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Documento</Label>
                        <Input
                          value={nfParsed.numero_documento || ""}
                          onChange={(e) => setNfParsed((prev) => prev ? ({ ...prev, numero_documento: e.target.value }) : prev)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fornecedor</Label>
                        <Input
                          value={nfParsed.fornecedor || ""}
                          onChange={(e) => setNfParsed((prev) => prev ? ({ ...prev, fornecedor: e.target.value }) : prev)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Chave NF-e</Label>
                        <Input
                          value={nfParsed.chave_nfe || ""}
                          onChange={(e) => setNfParsed((prev) => prev ? ({ ...prev, chave_nfe: e.target.value }) : prev)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data emissão</Label>
                        <Input value={nfParsed.data_emissao || ""} readOnly />
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-center">Qtd</TableHead>
                            <TableHead>Un</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nfParsed.itens.map((it, idx) => {
                            const codigo = String(it.codigo || "").trim().toUpperCase();
                            const material = codigo ? materiaisByCodigo.get(codigo) : null;
                            const ok = !!material && !!it.quantidade && (it.quantidade as number) > 0;
                            return (
                              <TableRow key={idx}>
                                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell className="font-medium">{codigo || "-"}</TableCell>
                                <TableCell className="max-w-[380px] truncate">{it.descricao || "-"}</TableCell>
                                <TableCell className="text-center">{it.quantidade ?? "-"}</TableCell>
                                <TableCell>{it.unidade || "-"}</TableCell>
                                <TableCell>
                                  {ok ? <Badge variant="secondary">OK</Badge> : <Badge variant="destructive">Sem mapeamento</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          Anexos extras (opcional)
                        </Label>
                        <Button asChild variant="outline" size="sm">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length) setNfAnexos((prev) => [...prev, ...files]);
                                e.currentTarget.value = "";
                              }}
                            />
                            <Upload className="h-4 w-4 mr-2" />
                            Adicionar
                          </label>
                        </Button>
                      </div>
                      {nfAnexos.length > 0 && (
                        <div className="border rounded-lg p-3 space-y-2">
                          {nfAnexos.map((f, idx) => (
                            <div key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{f.name}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setNfAnexos((prev) => prev.filter((_, i) => i !== idx))}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setNfDialogOpen(false)}>Cancelar</Button>
                      <Button
                        onClick={() => {
                          const built = buildFormFromNF();
                          if (!built) return;
                          criarRecebimentoMutation.mutate(built, {
                            onSuccess: () => {
                              setNfDialogOpen(false);
                              resetNFState();
                            },
                          });
                        }}
                        disabled={criarRecebimentoMutation.isPending}
                      >
                        {criarRecebimentoMutation.isPending ? "Criando..." : "Criar recebimento"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Visualização */}
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Recebimento</DialogTitle>
            </DialogHeader>

            {selectedRecebimento && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-medium">
                      {format(new Date(selectedRecebimento.data_recebimento), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedRecebimento.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recebido por</p>
                    <p className="font-medium">{selectedRecebimento.recebido_por || "-"}</p>
                  </div>
                  {selectedRecebimento.numero_documento && (
                    <div>
                      <p className="text-sm text-muted-foreground">Documento</p>
                      <p className="font-medium">{selectedRecebimento.numero_documento}</p>
                    </div>
                  )}
                  {selectedRecebimento.fornecedor && (
                    <div>
                      <p className="text-sm text-muted-foreground">Fornecedor</p>
                      <p className="font-medium">{selectedRecebimento.fornecedor}</p>
                    </div>
                  )}
                  {selectedRecebimento.chave_nfe && (
                    <div>
                      <p className="text-sm text-muted-foreground">Chave NF-e</p>
                      <p className="font-medium break-all">{selectedRecebimento.chave_nfe}</p>
                    </div>
                  )}
                </div>

                <Tabs defaultValue="itens">
                  <TabsList>
                    <TabsTrigger value="itens">Itens</TabsTrigger>
                    <TabsTrigger value="anexos">Anexos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="itens" className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Itens</p>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead className="text-center">Esperado</TableHead>
                            <TableHead className="text-center">Recebido</TableHead>
                            <TableHead>Rastros</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedRecebimento.itens?.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <p className="font-medium">{item.material?.codigo}</p>
                                <p className="text-xs text-muted-foreground">{item.material?.nome}</p>
                              </TableCell>
                              <TableCell className="text-center">
                                {item.quantidade_esperada} {item.material?.unidade}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.quantidade_recebida !== undefined ? (
                                  <Badge variant={item.quantidade_recebida === item.quantidade_esperada ? "default" : "destructive"}>
                                    {item.quantidade_recebida} {item.material?.unidade}
                                  </Badge>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const rastros = rastrosMap.get(item.material_id) || [];
                                  if (!rastros.length) return <span className="text-muted-foreground text-xs">-</span>;
                                  return (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2"
                                      onClick={() => {
                                        setViewRastrosMaterialId(item.material_id);
                                        setViewRastrosOpen(true);
                                      }}
                                    >
                                      <QrCode className="h-3 w-3 mr-1" />
                                      Ver ({rastros.length})
                                    </Button>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="anexos" className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Anexos</p>
                      <Button asChild variant="outline" size="sm">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              if (!files.length || !selectedRecebimento) return;
                              try {
                                toast.loading("Enviando anexos...", { id: "rec-anexos" });
                                for (const file of files) {
                                  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
                                  const fileName = `recebimentos/${selectedRecebimento.id}/${Date.now()}_${safeName}`;

                                  const { error: uploadError } = await supabase.storage
                                    .from("service-attachments")
                                    .upload(fileName, file, { upsert: true });
                                  if (uploadError) throw uploadError;

                                  const { data: urlData } = supabase.storage
                                    .from("service-attachments")
                                    .getPublicUrl(fileName);

                                  const { error: insertError } = await supabase
                                    .from("materiais_recebimentos_anexos")
                                    .insert({
                                      recebimento_id: selectedRecebimento.id,
                                      tipo: guessAnexoTipo(file),
                                      nome_arquivo: safeName,
                                      url: urlData.publicUrl,
                                      created_by: user?.id || null,
                                    });
                                  if (insertError) throw insertError;
                                }

                                queryClient.invalidateQueries({ queryKey: ["recebimentos-anexos", selectedRecebimento.id] });
                                toast.success("Anexos enviados!", { id: "rec-anexos" });
                              } catch (err: any) {
                                console.error(err);
                                toast.error(err.message || "Erro ao enviar anexos", { id: "rec-anexos" });
                              } finally {
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                          <Upload className="h-4 w-4 mr-2" />
                          Adicionar
                        </label>
                      </Button>
                    </div>

                    {anexosRecebimento && anexosRecebimento.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Arquivo</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Data</TableHead>
                              <TableHead className="text-right">Abrir</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {anexosRecebimento.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">{a.nome_arquivo || "Anexo"}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{a.tipo}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={a.url} target="_blank" rel="noreferrer">
                                      Abrir
                                    </a>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground border rounded-lg p-4">
                        Nenhum anexo neste recebimento.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog Ver Rastros (Detalhe) */}
        <Dialog open={viewRastrosOpen} onOpenChange={setViewRastrosOpen}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Rastros do item</DialogTitle>
              <DialogDescription>
                Lista de números de série/rastros vinculados a este recebimento.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Textarea
                value={(viewRastrosMaterialId ? (rastrosMap.get(viewRastrosMaterialId) || []) : []).join("\n")}
                readOnly
                rows={12}
                className="font-mono"
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setViewRastrosOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Conferência */}
        <Dialog open={conferirDialog} onOpenChange={setConferirDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Conferir Recebimento</DialogTitle>
              <DialogDescription>
                Informe as quantidades efetivamente recebidas para dar entrada no estoque
              </DialogDescription>
            </DialogHeader>

            {selectedRecebimento && (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-center">Esperado</TableHead>
                        <TableHead className="text-center">Recebido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRecebimento.itens?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <p className="font-medium">{item.material?.codigo}</p>
                            <p className="text-xs text-muted-foreground">{item.material?.nome}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantidade_esperada}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={conferencia[item.material_id] || 0}
                              onChange={(e) =>
                                setConferencia({
                                  ...conferencia,
                                  [item.material_id]: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-20 mx-auto text-center"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setConferirDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConferir}
                    disabled={conferirMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {conferirMutation.isPending ? "Processando..." : "Confirmar Conferência"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* AlertDialog Excluir */}
        <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir recebimento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação vai remover o recebimento.
                {recebimentoParaExcluir?.status === "finalizado"
                  ? " Como ele já foi finalizado, o sistema vai estornar o estoque e remover os rastros criados (se ainda estiverem no estoque central)."
                  : " Como ele está pendente, apenas será excluído (sem movimentações)."
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={excluirRecebimentoMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!recebimentoParaExcluir) return;
                  excluirRecebimentoMutation.mutate(recebimentoParaExcluir);
                }}
                disabled={excluirRecebimentoMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {excluirRecebimentoMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}



