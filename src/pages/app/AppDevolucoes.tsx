import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { useLocation, useNavigate } from "react-router-dom";
import { getAppParentRoute } from "@/lib/appNavigation";
import { usePageState } from "@/contexts/ScrollRestoreContext";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData, CACHE_KEYS } from "@/hooks/useOfflineData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Package, Plus, QrCode, Trash2, CheckCircle, Clock, XCircle, Search, ChevronDown, ChevronUp } from "lucide-react";
import { SignatureFullScreen } from "@/components/app/SignatureFullScreen";
import { cn } from "@/lib/utils";

type DevolucaoStatus = "pendente" | "pendente_confirmacao_equipe" | "conferida" | "cancelada";

interface Devolucao {
  id: string;
  status: DevolucaoStatus;
  origem?: "equipe" | "almoxarifado" | string;
  observacao: string | null;
  created_at: string;
  data_conferencia: string | null;
  data_confirmacao_equipe?: string | null;
}

interface EstoqueItem {
  id: string;
  material_id: string;
  quantidade: number;
  materiais: {
    id: string;
    codigo: string;
    nome: string;
    unidade: string;
    requer_serial: boolean;
  };
}

interface SerializadoEquipe {
  id: string;
  material_id: string;
  numero_serie: string;
  data_entrega_equipe?: string | null;
  materiais: {
    codigo: string;
    nome: string;
  };
}

interface ItemDevolucaoDraft {
  material_id: string;
  codigo: string;
  nome: string;
  unidade: string;
  requer_serial: boolean;
  quantidade: number;
  serials: string[];
}

function statusBadge(status: DevolucaoStatus) {
  switch (status) {
    case "pendente":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-0">
          <Clock className="h-3 w-3 mr-1" /> Pendente
        </Badge>
      );
    case "pendente_confirmacao_equipe":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-0">
          <Clock className="h-3 w-3 mr-1" /> Confirmar no app
        </Badge>
      );
    case "conferida":
      return (
        <Badge className="bg-green-100 text-green-700 border-0">
          <CheckCircle className="h-3 w-3 mr-1" /> Conferida
        </Badge>
      );
    case "cancelada":
      return (
        <Badge className="bg-gray-100 text-gray-700 border-0">
          <XCircle className="h-3 w-3 mr-1" /> Cancelada
        </Badge>
      );
  }
}

export default function AppDevolucoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const equipeId = equipe?.id || equipeAuth?.id;
  const { isOnline, saveToCache, getFromCache } = useOfflineSyncContext();
  const { getEstoqueFromCache, getMateriaisSerializadosFromCache, getDevolucoesPendentesFromCache } = useOfflineData();

  const pageKey = "app-devolucoes";
  const { getState, saveState } = usePageState<{
    searchTerm?: string;
    dialogNova?: boolean;
    observacao?: string;
    itens?: ItemDevolucaoDraft[];
    buscaMaterial?: string;
    materialSelecionadoId?: string;
    quantidadeTemp?: number;
    searchSerial?: string;
    serialsSelecionados?: string[];
    cancelDialog?: boolean;
    devolucaoCancelando?: Devolucao | null;
    confirmDialog?: boolean;
    devolucaoConfirmando?: Devolucao | null;
  }>(pageKey);

  const initial = getState();
  const [searchTerm, setSearchTerm] = useState(initial?.searchTerm || "");
  const [dialogNova, setDialogNova] = useState(Boolean(initial?.dialogNova));
  const [observacao, setObservacao] = useState(initial?.observacao || "");
  const [itens, setItens] = useState<ItemDevolucaoDraft[]>(initial?.itens || []);
  const [buscaMaterial, setBuscaMaterial] = useState(initial?.buscaMaterial || "");
  const [materialSelecionadoId, setMaterialSelecionadoId] = useState(initial?.materialSelecionadoId || "");
  const [quantidadeTemp, setQuantidadeTemp] = useState<number>(initial?.quantidadeTemp ?? 1);
  const [searchSerial, setSearchSerial] = useState(initial?.searchSerial || "");
  const [serialsSelecionados, setSerialsSelecionados] = useState<string[]>(initial?.serialsSelecionados || []);
  const [mostrarTodosMateriais, setMostrarTodosMateriais] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(Boolean(initial?.cancelDialog));
  const [devolucaoCancelando, setDevolucaoCancelando] = useState<Devolucao | null>(initial?.devolucaoCancelando || null);
  const [confirmDialog, setConfirmDialog] = useState(Boolean(initial?.confirmDialog));
  const [devolucaoConfirmando, setDevolucaoConfirmando] = useState<Devolucao | null>(initial?.devolucaoConfirmando || null);
  const [showSignatureScreen, setShowSignatureScreen] = useState(false);
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState<string | null>(null);
  const closingForSignatureRef = useRef(false);

  const fecharConfirmacao = () => {
    setConfirmDialog(false);
    setDevolucaoConfirmando(null);
    setAssinaturaDataUrl(null);
    setShowSignatureScreen(false);
    closingForSignatureRef.current = false;
  };

  const abrirAssinatura = () => {
    // Mesmo padrão do recebimento (AppEstoque): fechar o dialog e abrir a tela full-screen
    closingForSignatureRef.current = true;
    setConfirmDialog(false);
    setTimeout(() => {
      closingForSignatureRef.current = false;
      setShowSignatureScreen(true);
    }, 100);
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveState({
        searchTerm,
        dialogNova,
        observacao,
        itens,
        buscaMaterial,
        materialSelecionadoId,
        quantidadeTemp,
        searchSerial,
        serialsSelecionados,
        // não persistir mostrarTodosMateriais para evitar “explodir” a UI ao voltar
        cancelDialog,
        devolucaoCancelando,
        confirmDialog,
        devolucaoConfirmando,
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [
    searchTerm,
    dialogNova,
    observacao,
    itens,
    buscaMaterial,
    materialSelecionadoId,
    quantidadeTemp,
    searchSerial,
    serialsSelecionados,
    cancelDialog,
    devolucaoCancelando,
    confirmDialog,
    devolucaoConfirmando,
    saveState,
  ]);

  const handleBack = () => {
    const parent = getAppParentRoute(location.pathname);
    navigate(parent || "/app/estoque");
  };

  const { data: devolucoes, isLoading: loadingDevolucoes } = useQuery({
    queryKey: ["app-devolucoes", equipeId],
    enabled: !!equipeId,
    queryFn: async () => {
      // Tentar buscar do cache se offline
      if (!isOnline && equipeId) {
        const cached = await getFromCache<Devolucao[]>(`devolucoes_${equipeId}`);
        if (cached) {
          console.log("[AppDevolucoes] Usando devoluções do cache:", cached.length);
          return cached;
        }
        return [];
      }

      const { data, error } = await (supabase as any)
        .from("materiais_devolucoes")
        .select("id, status, origem, observacao, created_at, data_conferencia, data_confirmacao_equipe")
        .eq("equipe_id", equipeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      
      // Cachear para uso offline
      if (data && equipeId) {
        await saveToCache(`devolucoes_${equipeId}`, data, 24);
      }
      
      return (data || []) as Devolucao[];
    },
  });

  const devolucoesFiltradas = useMemo(() => {
    if (!devolucoes) return [];
    if (!searchTerm) return devolucoes;
    const term = searchTerm.toLowerCase();
    return devolucoes.filter((d) => d.id.toLowerCase().includes(term) || d.observacao?.toLowerCase().includes(term));
  }, [devolucoes, searchTerm]);

  const { data: itensConfirmacao, isLoading: loadingItensConfirmacao } = useQuery({
    queryKey: ["app-devolucoes-itens", devolucaoConfirmando?.id],
    enabled: !!devolucaoConfirmando?.id && confirmDialog,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais_devolucoes_itens")
        .select(`
          devolucao_id,
          material_id,
          quantidade_solicitada,
          quantidade_conferida,
          materiais (codigo, nome, unidade, requer_serial)
        `)
        .eq("devolucao_id", devolucaoConfirmando!.id);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: rastrosConfirmacao } = useQuery({
    queryKey: ["app-devolucoes-rastros", devolucaoConfirmando?.id],
    enabled: !!devolucaoConfirmando?.id && confirmDialog,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais_devolucoes_itens_rastros")
        .select("devolucao_id, material_id, numero_serie, conferido")
        .eq("devolucao_id", devolucaoConfirmando!.id);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: estoqueEquipe } = useQuery({
    queryKey: ["app-estoque-equipe", equipeId],
    enabled: !!equipeId,
    queryFn: async () => {
      // Tentar buscar do cache se offline
      if (!isOnline && equipeId) {
        const cached = await getEstoqueFromCache(equipeId) as EstoqueItem[];
        if (cached) {
          console.log("[AppDevolucoes] Usando estoque do cache:", cached.length);
          return cached;
        }
        return [];
      }

      const { data, error } = await (supabase as any)
        .from("materiais_estoque")
        .select(`
          id,
          material_id,
          quantidade,
          materiais!inner (id, codigo, nome, unidade, requer_serial)
        `)
        .eq("local_tipo", "equipe")
        .eq("local_id", equipeId)
        .gt("quantidade", 0)
        .order("materiais(codigo)");
      if (error) throw error;
      return (data || []) as EstoqueItem[];
    },
  });

  const { data: serializadosEquipe } = useQuery({
    queryKey: ["app-serializados-equipe", equipeId],
    enabled: !!equipeId,
    queryFn: async () => {
      if (!equipeId) return [];

      // Tentar buscar do cache se offline
      if (!isOnline) {
        const cached = await getMateriaisSerializadosFromCache(equipeId) as SerializadoEquipe[];
        if (cached) {
          console.log("[AppDevolucoes] Usando serializados do cache:", cached.length);
          return cached;
        }
        return [];
      }

      // Mesmo padrão robusto do AppEstoque: basear em entregas confirmadas
      const { data: entregas, error: entregasError } = await (supabase as any)
        .from("materiais_entregas")
        .select("id, data_entrega, data_confirmacao")
        .eq("equipe_id", equipeId)
        .eq("status", "confirmado");
      if (entregasError) throw entregasError;
      if (!entregas?.length) return [];

      const entregaIds = entregas.map((e: any) => e.id);
      const { data: itensEntrega, error: itensError } = await (supabase as any)
        .from("materiais_entregas_itens")
        .select(`
          id,
          entrega_id,
          numero_serie,
          material_id,
          materiais (codigo, nome)
        `)
        .in("entrega_id", entregaIds)
        .not("numero_serie", "is", null);
      if (itensError) throw itensError;
      if (!itensEntrega?.length) return [];

      // Filtrar os que não foram instalados/retirados
      const numerosSerie = itensEntrega.map((i: any) => i.numero_serie).filter(Boolean);
      const { data: serializados, error: serializadosError } = await (supabase as any)
        .from("materiais_serializados")
        .select("numero_serie, status")
        .in("numero_serie", numerosSerie);
      if (serializadosError) throw serializadosError;
      const statusMap = new Map((serializados || []).map((s: any) => [String(s.numero_serie).toUpperCase(), s.status]));

      const entregasMap = new Map(entregas.map((e: any) => [e.id, e]));

      return (itensEntrega as any[])
        .filter((it) => {
          const st = statusMap.get(String(it.numero_serie).toUpperCase());
          return !st || st === "em_estoque" || st === "com_equipe";
        })
        .map((it) => {
          const ent = entregasMap.get(it.entrega_id);
          return {
            id: it.id,
            material_id: it.material_id,
            numero_serie: String(it.numero_serie).toUpperCase(),
            data_entrega_equipe: ent?.data_confirmacao || ent?.data_entrega,
            materiais: it.materiais,
          } as SerializadoEquipe;
        });
    },
  });

  const materiaisDisponiveis = useMemo(() => {
    const nonSerial = (estoqueEquipe || [])
      .filter((e) => !e.materiais.requer_serial)
      .map((e) => ({
        material_id: e.material_id,
        codigo: e.materiais.codigo,
        nome: e.materiais.nome,
        unidade: e.materiais.unidade,
        requer_serial: false,
        disponivel: e.quantidade,
      }));

    // Serializados: agrupar por material_id
    const serialGroup = new Map<string, { material_id: string; codigo: string; nome: string; unidade: string; requer_serial: true; disponivel: number }>();
    (serializadosEquipe || []).forEach((s) => {
      const current = serialGroup.get(s.material_id);
      if (!current) {
        serialGroup.set(s.material_id, {
          material_id: s.material_id,
          codigo: s.materiais.codigo,
          nome: s.materiais.nome,
          unidade: "UN",
          requer_serial: true,
          disponivel: 1,
        });
      } else {
        current.disponivel += 1;
      }
    });

    const serial = [...serialGroup.values()];
    const all = [...nonSerial, ...serial].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));

    if (!buscaMaterial) return all;
    const term = buscaMaterial.toLowerCase();
    return all.filter((m) => m.codigo.toLowerCase().includes(term) || m.nome.toLowerCase().includes(term));
  }, [estoqueEquipe, serializadosEquipe, buscaMaterial]);

  const materiaisParaListar = useMemo(() => {
    const term = buscaMaterial.trim();
    // Se não está buscando, mostramos poucos por padrão (para não ficar “comprida”)
    if (!term && !mostrarTodosMateriais) return materiaisDisponiveis.slice(0, 6);
    // Se está buscando, limita a um número razoável
    return materiaisDisponiveis.slice(0, 40);
  }, [buscaMaterial, mostrarTodosMateriais, materiaisDisponiveis]);

  const materialSelecionado = useMemo(() => {
    return materiaisDisponiveis.find((m) => m.material_id === materialSelecionadoId) || null;
  }, [materiaisDisponiveis, materialSelecionadoId]);

  const serialsDisponiveisMaterial = useMemo(() => {
    if (!materialSelecionado || !materialSelecionado.requer_serial) return [];
    const all = (serializadosEquipe || []).filter((s) => s.material_id === materialSelecionado.material_id);
    const term = searchSerial.trim().toLowerCase();
    const filtered = term ? all.filter((s) => s.numero_serie.toLowerCase().includes(term)) : all;
    // ordenar para facilitar conferência
    return filtered.sort((a, b) => a.numero_serie.localeCompare(b.numero_serie, "pt-BR", { numeric: true }));
  }, [materialSelecionado, serializadosEquipe, searchSerial]);

  const toggleSerial = (ns: string, checked: boolean) => {
    const serial = String(ns).toUpperCase();
    setSerialsSelecionados((prev) => {
      if (checked) return Array.from(new Set([...prev, serial]));
      return prev.filter((x) => x !== serial);
    });
  };

  const addItem = () => {
    if (!materialSelecionado) {
      toast.error("Selecione um material");
      return;
    }

    if (materialSelecionado.requer_serial) {
      const serials = [...new Set(serialsSelecionados.map((s) => String(s).toUpperCase()))];
      if (!serials.length) {
        toast.error("Selecione ao menos um rastro/serial");
        return;
      }
      setItens((prev) => {
        const exists = prev.find((p) => p.material_id === materialSelecionado.material_id);
        const merged = exists ? Array.from(new Set([...(exists.serials || []), ...serials])) : serials;
        const next = prev.filter((p) => p.material_id !== materialSelecionado.material_id);
        next.push({
          material_id: materialSelecionado.material_id,
          codigo: materialSelecionado.codigo,
          nome: materialSelecionado.nome,
          unidade: materialSelecionado.unidade,
          requer_serial: true,
          quantidade: merged.length,
          serials: merged,
        });
        return next.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
      });
    } else {
      const disponivel = materialSelecionado.disponivel;
      const qtd = Math.max(1, Math.min(Number(quantidadeTemp || 1), disponivel));
      setItens((prev) => {
        const next = prev.filter((p) => p.material_id !== materialSelecionado.material_id);
        next.push({
          material_id: materialSelecionado.material_id,
          codigo: materialSelecionado.codigo,
          nome: materialSelecionado.nome,
          unidade: materialSelecionado.unidade,
          requer_serial: false,
          quantidade: qtd,
          serials: [],
        });
        return next.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
      });
    }

    // reset seleções
    setMaterialSelecionadoId("");
    setQuantidadeTemp(1);
    setSearchSerial("");
    setSerialsSelecionados([]);
    setBuscaMaterial("");
    setMostrarTodosMateriais(false);
  };

  const removeItem = (materialId: string) => {
    setItens((prev) => prev.filter((p) => p.material_id !== materialId));
  };

  const criarDevolucaoMutation = useMutation({
    mutationFn: async () => {
      if (!equipeId) throw new Error("Equipe não identificada");
      if (!itens.length) throw new Error("Adicione ao menos um item");

      // validação
      for (const it of itens) {
        if (it.requer_serial) {
          if (!it.serials.length) throw new Error(`Informe os rastros para ${it.codigo}`);
          if (it.quantidade !== it.serials.length) throw new Error(`Quantidade divergente em ${it.codigo}`);
        } else {
          if (it.quantidade <= 0) throw new Error(`Quantidade inválida em ${it.codigo}`);
        }
      }

      // Criar devolução
      const { data: dev, error: devErr } = await (supabase as any)
        .from("materiais_devolucoes")
        .insert({
          equipe_id: equipeId,
          status: "pendente",
          observacao: observacao || null,
        })
        .select()
        .single();
      if (devErr) throw devErr;

      // Itens
      const itensPayload = itens.map((i) => ({
        devolucao_id: dev.id,
        material_id: i.material_id,
        quantidade_solicitada: i.quantidade,
        quantidade_conferida: null,
        observacao: null,
      }));
      const { error: itensErr } = await (supabase as any).from("materiais_devolucoes_itens").insert(itensPayload);
      if (itensErr) throw itensErr;

      // Rastros
      const rastrosPayload = itens
        .filter((i) => i.requer_serial)
        .flatMap((i) =>
          i.serials.map((ns) => ({
            devolucao_id: dev.id,
            material_id: i.material_id,
            numero_serie: String(ns).toUpperCase(),
            conferido: true,
          }))
        );
      if (rastrosPayload.length) {
        const { error: rastrosErr } = await (supabase as any)
          .from("materiais_devolucoes_itens_rastros")
          .insert(rastrosPayload);
        if (rastrosErr) throw rastrosErr;
      }

      return dev as Devolucao;
    },
    onSuccess: () => {
      toast.success("Devolução enviada para conferência!");
      queryClient.invalidateQueries({ queryKey: ["app-devolucoes", equipeId] });
      setDialogNova(false);
      setObservacao("");
      setItens([]);
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message || "Erro ao criar devolução");
    },
  });

  const cancelarDevolucaoMutation = useMutation({
    mutationFn: async (dev: Devolucao) => {
      if (dev.status !== "pendente" && dev.status !== "pendente_confirmacao_equipe") {
        throw new Error("Apenas devoluções pendentes podem ser canceladas");
      }
      const { error } = await (supabase as any)
        .from("materiais_devolucoes")
        .update({ status: "cancelada" })
        .eq("id", dev.id)
        .eq("equipe_id", equipeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devolução cancelada.");
      queryClient.invalidateQueries({ queryKey: ["app-devolucoes", equipeId] });
      setCancelDialog(false);
      setDevolucaoCancelando(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao cancelar"),
  });

  const confirmarSolicitacaoMutation = useMutation({
    mutationFn: async () => {
      if (!devolucaoConfirmando?.id) throw new Error("Selecione uma solicitação");
      if (devolucaoConfirmando.status !== "pendente_confirmacao_equipe") {
        throw new Error("Esta devolução não está aguardando confirmação");
      }
      if (!assinaturaDataUrl) {
        throw new Error("Assinatura obrigatória para confirmar a devolução");
      }

      // Persistir assinatura antes de confirmar (a RPC finaliza status/estoque)
      const { error: signErr } = await (supabase as any)
        .from("materiais_devolucoes")
        .update({ assinatura_confirmacao_equipe: assinaturaDataUrl })
        .eq("id", devolucaoConfirmando.id)
        .eq("equipe_id", equipeId);
      if (signErr) throw signErr;

      const { error } = await (supabase as any).rpc("confirmar_solicitacao_devolucao_equipe", {
        p_devolucao_id: devolucaoConfirmando.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devolução confirmada!");
      queryClient.invalidateQueries({ queryKey: ["app-devolucoes", equipeId] });
      queryClient.invalidateQueries({ queryKey: ["app-estoque-equipe", equipeId] });
      setConfirmDialog(false);
      setDevolucaoConfirmando(null);
      setAssinaturaDataUrl(null);
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message || "Erro ao confirmar devolução");
    },
  });

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Devoluções</h1>
            <p className="text-xs text-muted-foreground">Envie devoluções ou confirme solicitações do almoxarifado</p>
          </div>
        </div>
        <Button onClick={() => setDialogNova(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar devolução..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista */}
      {loadingDevolucoes ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : devolucoesFiltradas.length ? (
        <div className="space-y-2">
          {devolucoesFiltradas.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge(d.status)}
                      <Badge variant="outline" className="text-xs font-mono">
                        {d.id.slice(0, 8).toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(d.created_at), "dd/MM/yyyy HH:mm")}
                      {d.data_confirmacao_equipe
                        ? ` • Confirmada por você em ${format(new Date(d.data_confirmacao_equipe), "dd/MM/yyyy HH:mm")}`
                        : d.data_conferencia
                        ? ` • Conferida em ${format(new Date(d.data_conferencia), "dd/MM/yyyy HH:mm")}`
                        : ""}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                      {d.observacao || "Sem observação"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {d.status === "pendente_confirmacao_equipe" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setDevolucaoConfirmando(d);
                          setConfirmDialog(true);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Confirmar
                      </Button>
                    )}
                    {(d.status === "pendente" || d.status === "pendente_confirmacao_equipe") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          setDevolucaoCancelando(d);
                          setCancelDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {searchTerm ? "Nenhuma devolução encontrada" : "Você ainda não enviou devoluções"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tela Nova Devolução - Full Screen */}
      {dialogNova && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setDialogNova(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Nova Devolução</h1>
                <p className="text-xs text-muted-foreground">
                  {itens.length === 0 ? "Selecione os materiais" : `${itens.length} item(ns) selecionado(s)`}
                </p>
              </div>
            </div>
            {itens.length > 0 && (
              <Badge className="bg-primary text-primary-foreground">
                {itens.reduce((sum, it) => sum + it.quantidade, 0)} un
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Observação */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Observação (opcional)</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: sobra de obra, material com defeito..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Busca de Material */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={buscaMaterial}
                    onChange={(e) => {
                      setBuscaMaterial(e.target.value);
                      setMaterialSelecionadoId("");
                    }}
                    placeholder="Buscar material por código ou nome..."
                    className="pl-10"
                  />
                </div>

                {/* Lista de Materiais */}
                <div className="space-y-2">
                  {materiaisParaListar.slice(0, buscaMaterial ? 20 : 8).map((m) => {
                    const isSelected = materialSelecionadoId === m.material_id;
                    const jaAdicionado = itens.some(it => it.material_id === m.material_id);
                    
                    return (
                      <div
                        key={m.material_id}
                        onClick={() => {
                          if (!jaAdicionado) {
                            setMaterialSelecionadoId(isSelected ? "" : m.material_id);
                            setQuantidadeTemp(1);
                            setSearchSerial("");
                            setSerialsSelecionados([]);
                          }
                        }}
                        className={cn(
                          "p-3 rounded-xl border-2 transition-all",
                          jaAdicionado 
                            ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                            : isSelected 
                              ? "bg-primary/5 border-primary shadow-sm" 
                              : "bg-card border-border hover:border-primary/50 cursor-pointer"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-sm">{m.codigo}</span>
                              {jaAdicionado && (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate mt-0.5">{m.nome}</p>
                          </div>
                          <Badge variant={m.requer_serial ? "secondary" : "outline"} className="shrink-0">
                            {m.requer_serial ? (
                              <><QrCode className="h-3 w-3 mr-1" />{m.disponivel}</>
                            ) : (
                              <>{m.disponivel} {m.unidade}</>
                            )}
                          </Badge>
                        </div>

                        {/* Expandido quando selecionado */}
                        {isSelected && !jaAdicionado && (
                          <div className="mt-3 pt-3 border-t space-y-3">
                            {m.requer_serial ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Selecione os seriais:</span>
                                  <Badge variant="outline">{serialsSelecionados.length} selecionado(s)</Badge>
                                </div>
                                <Input
                                  placeholder="Filtrar serial..."
                                  value={searchSerial}
                                  onChange={(e) => setSearchSerial(e.target.value)}
                                  className="h-9"
                                />
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                  {serialsDisponiveisMaterial.map((s) => {
                                    const checked = serialsSelecionados.includes(s.numero_serie);
                                    return (
                                      <div
                                        key={s.numero_serie}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSerial(s.numero_serie, !checked);
                                        }}
                                        className={cn(
                                          "flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors",
                                          checked 
                                            ? "bg-primary/10 border-primary" 
                                            : "bg-muted/50 border-transparent hover:bg-muted"
                                        )}
                                      >
                                        <Checkbox checked={checked} />
                                        <span className="font-mono text-sm">{s.numero_serie}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-sm font-medium">Quantidade:</span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuantidadeTemp(Math.max(1, quantidadeTemp - 1));
                                    }}
                                  >
                                    -
                                  </Button>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={m.disponivel}
                                    value={quantidadeTemp}
                                    onChange={(e) => setQuantidadeTemp(Math.min(m.disponivel, Math.max(1, Number(e.target.value || 1))))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-20 text-center h-10 font-semibold"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuantidadeTemp(Math.min(m.disponivel, quantidadeTemp + 1));
                                    }}
                                  >
                                    +
                                  </Button>
                                </div>
                              </div>
                            )}

                            <Button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addItem();
                              }}
                              className="w-full"
                              disabled={m.requer_serial && serialsSelecionados.length === 0}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar à devolução
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {materiaisParaListar.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Nenhum material encontrado</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Resumo dos Itens Adicionados */}
              {itens.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Itens para devolver</h3>
                    <Badge variant="secondary">{itens.length} item(ns)</Badge>
                  </div>
                  <div className="space-y-2">
                    {itens.map((it) => (
                      <div
                        key={it.material_id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                            <span className="font-mono font-semibold text-sm">{it.codigo}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{it.nome}</p>
                          <p className="text-xs font-medium text-green-700 dark:text-green-400 mt-1">
                            {it.requer_serial ? `${it.serials.length} serial(is)` : `${it.quantidade} ${it.unidade}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(it.material_id)}
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Fixo */}
          <div className="border-t bg-background p-4 space-y-3">
            <Button
              onClick={() => criarDevolucaoMutation.mutate()}
              disabled={itens.length === 0 || criarDevolucaoMutation.isPending}
              className="w-full h-12 text-base font-semibold"
            >
              {criarDevolucaoMutation.isPending ? (
                <>Enviando...</>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Enviar para conferência
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              O almoxarifado irá conferir os materiais
            </p>
          </div>
        </div>
      )}

      {/* Cancelar devolução */}
      <AlertDialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar devolução?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apenas cancela a solicitação (não altera o estoque). Você pode criar outra devolução depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelarDevolucaoMutation.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!devolucaoCancelando || cancelarDevolucaoMutation.isPending}
              onClick={() => devolucaoCancelando && cancelarDevolucaoMutation.mutate(devolucaoCancelando)}
            >
              {cancelarDevolucaoMutation.isPending ? "Cancelando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar solicitação do almoxarifado */}
      <Dialog
        open={confirmDialog}
        onOpenChange={(open) => {
          // Se estamos fechando apenas para abrir a assinatura, não limpar estado.
          if (!open && closingForSignatureRef.current) {
            setConfirmDialog(false);
            return;
          }
          if (open) {
            setConfirmDialog(true);
            return;
          }
          fecharConfirmacao();
        }}
      >
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar devolução</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {devolucaoConfirmando?.status ? statusBadge(devolucaoConfirmando.status) : null}
              {devolucaoConfirmando?.id ? (
                <Badge variant="outline" className="text-xs font-mono">
                  {devolucaoConfirmando.id.slice(0, 8).toUpperCase()}
                </Badge>
              ) : null}
            </div>

            <div className="text-sm text-muted-foreground">
              Confira os itens abaixo. Ao confirmar, o estoque será atualizado e a devolução ficará finalizada.
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Assinatura da equipe (obrigatória)</p>
                  <p className="text-xs text-muted-foreground">
                    A equipe confirma que está devolvendo os materiais listados.
                  </p>
                </div>
                <Button type="button" variant={assinaturaDataUrl ? "outline" : "default"} onClick={abrirAssinatura}>
                  {assinaturaDataUrl ? "Refazer assinatura" : "Assinar"}
                </Button>
              </div>

              {assinaturaDataUrl ? (
                <div className="border rounded-md bg-white p-2">
                  <img
                    src={assinaturaDataUrl}
                    alt="Assinatura"
                    className="w-full max-h-40 object-contain"
                  />
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Assinatura pendente. Toque em “Assinar” para continuar.
                </div>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-3">Material</th>
                      <th className="text-center p-3">Qtd</th>
                      <th className="text-center p-3">Seriais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingItensConfirmacao ? (
                      <tr>
                        <td className="p-3" colSpan={3}>
                          <Skeleton className="h-10 w-full" />
                        </td>
                      </tr>
                    ) : (itensConfirmacao || []).map((it: any) => {
                      const isSerial = Boolean(it.materiais?.requer_serial);
                      const rs = (rastrosConfirmacao || []).filter((r: any) => r.material_id === it.material_id && r.conferido);
                      return (
                        <tr key={it.material_id} className="border-t">
                          <td className="p-3">
                            <div className="min-w-0">
                              <div className="font-medium">{it.materiais?.codigo || "-"}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">{it.materiais?.nome || ""}</div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {it.quantidade_solicitada} {it.materiais?.unidade || ""}
                          </td>
                          <td className="p-3 text-center">
                            {isSerial ? (
                              <Badge variant="outline" className="text-xs">
                                <QrCode className="h-3 w-3 mr-1" /> {rs.length}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2">
            <Button type="button" variant="outline" onClick={fecharConfirmacao} disabled={confirmarSolicitacaoMutation.isPending}>
              Voltar
            </Button>
            <Button
              onClick={() => confirmarSolicitacaoMutation.mutate()}
              disabled={!devolucaoConfirmando || !assinaturaDataUrl || confirmarSolicitacaoMutation.isPending}
            >
              {confirmarSolicitacaoMutation.isPending ? "Confirmando..." : "Confirmar devolução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tela de assinatura */}
      <SignatureFullScreen
        open={showSignatureScreen}
        onClose={() => {
          setShowSignatureScreen(false);
          if (devolucaoConfirmando) {
            setTimeout(() => setConfirmDialog(true), 100);
          }
        }}
        onSave={(dataUrl) => {
          setAssinaturaDataUrl(dataUrl);
          setShowSignatureScreen(false);
          if (devolucaoConfirmando) {
            setTimeout(() => setConfirmDialog(true), 100);
          }
        }}
        titulo="Assinatura - Confirmação de Devolução"
      />
    </div>
  );
}


