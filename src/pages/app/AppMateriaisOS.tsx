import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useTecnico } from "@/contexts/TecnicoContext";
import { usePageState } from "@/contexts/ScrollRestoreContext";
import { getAppParentRoute } from "@/lib/appNavigation";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData, CACHE_KEYS } from "@/hooks/useOfflineData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  ArrowLeft,
  Plus,
  Minus,
  Zap,
  QrCode,
  CheckCircle,
  Trash2,
  Search,
  Pencil,
  AlertTriangle,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DiasRetencaoBadge, calcularDiasDesde, getNivelAlerta } from "@/components/materiais/DiasRetencaoBadge";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";

interface MaterialAplicado {
  id: string;
  material_id: string;
  quantidade: number;
  tipo: "aplicado" | "retirado";
  numero_serie: string | null;
  observacao: string | null;
  created_at: string;
  materiais: {
    codigo: string;
    nome: string;
    unidade: string;
    requer_serial: boolean;
  };
}

interface EstoqueItem {
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

interface RastroDisponivel {
  id: string;
  numero_serie: string;
  material_id: string;
  data_entrega_equipe: string | null;
  created_at: string;
  updated_at: string;
  materiais: {
    codigo: string;
    nome: string;
    dias_alerta_retencao: number | null;
  };
}

export default function AppMateriaisOS() {
  const { id: ordemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { equipe: equipeAuth } = useEquipeAuth();
  const { equipe } = useTecnico();
  const { isOnline, queueOperation, saveToCache, getFromCache } = useOfflineSyncContext();
  const { getEstoqueFromCache, getMateriaisSerializadosFromCache, getOrdensFromCache, getMateriaisCatalogoFromCache } = useOfflineData();

  const pageKey = `app-materiais-os-${ordemId || "sem-id"}`;
  const { getState, saveState } = usePageState<{
    dialogOpen?: boolean;
    tipoOperacao?: "aplicar" | "retirar";
    abaAtiva?: "aplicados" | "retirados";
    searchTerm?: string;
    searchRastro?: string;
    scannerOpen?: boolean;
    formData?: {
      material_id: string;
      quantidade: number;
      numero_serie: string;
      observacao: string;
    };
  }>(pageKey);
  const initialState = getState();

  const [dialogOpen, setDialogOpen] = useState(Boolean(initialState?.dialogOpen));
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [itemEditando, setItemEditando] = useState<MaterialAplicado | null>(null);
  const [novaQuantidade, setNovaQuantidade] = useState(1);
  const [tipoOperacao, setTipoOperacao] = useState<"aplicar" | "retirar">(initialState?.tipoOperacao || "aplicar");
  const [abaAtiva, setAbaAtiva] = useState<"aplicados" | "retirados">(initialState?.abaAtiva || "aplicados");
  const [searchTerm, setSearchTerm] = useState(initialState?.searchTerm || "");
  const [searchRastro, setSearchRastro] = useState(initialState?.searchRastro || ""); // Pesquisa de rastro
  const [scannerOpen, setScannerOpen] = useState(Boolean(initialState?.scannerOpen)); // Scanner de código de barras
  const [formData, setFormData] = useState({
    material_id: initialState?.formData?.material_id || "",
    quantidade: (initialState?.formData?.quantidade ?? ("" as unknown as number)), // Começa vazio
    numero_serie: initialState?.formData?.numero_serie || "",
    observacao: initialState?.formData?.observacao || "",
  });
  

  const equipeId = equipe?.id || equipeAuth?.id;

  const handleBack = () => {
    const parent = getAppParentRoute(location.pathname);
    navigate(parent || "/app");
  };

  // Persistir estado de UI desta tela (para voltar “intacta”)
  useEffect(() => {
    if (!ordemId) return;
    const t = window.setTimeout(() => {
      saveState({
        dialogOpen,
        tipoOperacao,
        abaAtiva,
        searchTerm,
        searchRastro,
        scannerOpen,
        formData: {
          material_id: formData.material_id,
          quantidade: Number(formData.quantidade) || 0,
          numero_serie: formData.numero_serie,
          observacao: formData.observacao,
        },
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [ordemId, dialogOpen, tipoOperacao, abaAtiva, searchTerm, searchRastro, scannerOpen, formData, saveState]);

  // Query para dados da OS
  const { data: ordem } = useQuery({
    queryKey: ["ordem-materiais", ordemId],
    queryFn: async () => {
      // Tentar buscar do cache se offline
      if (!isOnline && equipeId) {
        const ordens = await getOrdensFromCache(equipeId) as any[];
        if (ordens) {
          const ordemCached = ordens.find((o: any) => o.id === ordemId);
          if (ordemCached) {
            console.log("[AppMateriaisOS] Usando ordem do cache");
            return ordemCached;
          }
        }
        return null;
      }

      const { data, error } = await supabase
        .from("ordens_servico")
        .select("numero, tipo, endereco, cliente_nome")
        .eq("id", ordemId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ordemId,
  });

  // Query para materiais aplicados/retirados na OS
  const { data: materiaisOS, isLoading: loadingMateriaisOS } = useQuery({
    queryKey: ["materiais-os", ordemId],
    queryFn: async () => {
      // Tentar buscar do cache se offline
      if (!isOnline) {
        const cached = await getFromCache<MaterialAplicado[]>(`materiais_os_${ordemId}`);
        if (cached) {
          console.log("[AppMateriaisOS] Usando materiais da OS do cache:", cached.length);
          return cached;
        }
        return [];
      }

      const { data, error } = await supabase
        .from("materiais_aplicados_os")
        .select(`
          id,
          material_id,
          quantidade,
          tipo,
          numero_serie,
          observacao,
          created_at,
          materiais (codigo, nome, unidade, requer_serial)
        `)
        .eq("ordem_servico_id", ordemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Cachear para uso offline
      if (data) {
        await saveToCache(`materiais_os_${ordemId}`, data, 24);
      }
      
      return data as MaterialAplicado[];
    },
    enabled: !!ordemId,
  });

  // Query para estoque da equipe
  const { data: estoqueEquipe } = useQuery({
    queryKey: ["estoque-equipe-os", equipeId],
    queryFn: async () => {
      if (!equipeId) return [];

      // Tentar buscar do cache se offline
      if (!isOnline) {
        const cached = await getEstoqueFromCache(equipeId) as EstoqueItem[];
        if (cached) {
          console.log("[AppMateriaisOS] Usando estoque do cache:", cached.length);
          return cached;
        }
        return [];
      }

      const { data, error } = await supabase
        .from("materiais_estoque")
        .select(`
          material_id,
          quantidade,
          materiais!inner (
            id,
            codigo,
            nome,
            unidade,
            requer_serial
          )
        `)
        .eq("local_tipo", "equipe")
        .eq("local_id", equipeId)
        .gt("quantidade", 0);

      if (error) throw error;
      return data as EstoqueItem[];
    },
    enabled: !!equipeId,
  });

  // Query para todos os materiais (para retirar)
  const { data: todosMateriais } = useQuery({
    queryKey: ["todos-materiais-ativos"],
    queryFn: async () => {
      // Tentar buscar do cache se offline
      if (!isOnline) {
        const cached = await getMateriaisCatalogoFromCache();
        if (cached) {
          console.log("[AppMateriaisOS] Usando catálogo de materiais do cache:", (cached as any[]).length);
          return cached as { id: string; codigo: string; nome: string; unidade: string; requer_serial: boolean }[];
        }
        return [];
      }

      const { data, error } = await supabase
        .from("materiais")
        .select("id, codigo, nome, unidade, requer_serial")
        .eq("ativo", true)
        .order("codigo");

      if (error) throw error;
      return data;
    },
  });

  // Query para TODOS os rastros disponíveis da equipe (materiais serializados)
  // Usa a mesma lógica do AppEstoque - busca via entregas confirmadas
  const { data: rastrosDisponiveis } = useQuery({
    queryKey: ["rastros-disponiveis-equipe", equipeId],
    queryFn: async () => {
      if (!equipeId) return [];

      // Tentar buscar do cache se offline
      if (!isOnline) {
        const cached = await getMateriaisSerializadosFromCache(equipeId) as RastroDisponivel[];
        if (cached) {
          console.log("[AppMateriaisOS] Usando rastros do cache:", cached.length);
          return cached;
        }
        return [];
      }

      // Primeiro, buscar entregas confirmadas da equipe
      const { data: entregas, error: entregasError } = await supabase
        .from("materiais_entregas")
        .select("id, data_entrega, data_confirmacao")
        .eq("equipe_id", equipeId)
        .eq("status", "confirmado");

      if (entregasError) throw entregasError;
      if (!entregas || entregas.length === 0) return [];

      // Buscar itens das entregas que têm número de série
      const entregaIds = entregas.map((e: any) => e.id);
      const { data: itensEntrega, error: itensError } = await supabase
        .from("materiais_entregas_itens")
        .select(`
          id,
          entrega_id,
          numero_serie,
          material_id,
          materiais (
            codigo,
            nome,
            dias_alerta_retencao
          )
        `)
        .in("entrega_id", entregaIds)
        .not("numero_serie", "is", null);

      if (itensError) throw itensError;
      if (!itensEntrega || itensEntrega.length === 0) return [];

      // Verificar quais materiais ainda estão com a equipe (não foram aplicados)
      const numerosSerieEntregues = itensEntrega.map((i: any) => i.numero_serie).filter(Boolean);
      
      const { data: serializados, error: serializadosError } = await supabase
        .from("materiais_serializados")
        .select("numero_serie, status")
        .in("numero_serie", numerosSerieEntregues);

      if (serializadosError) throw serializadosError;

      // Filtrar apenas os que ainda não foram instalados/retirados
      const serializadosMap = new Map(
        (serializados || []).map((s: any) => [s.numero_serie, s.status])
      );

      // Montar resultado com data de entrega
      const entregasMap = new Map(
        entregas.map((e: any) => [e.id, e])
      );

      return itensEntrega
        .filter((item: any) => {
          const status = serializadosMap.get(item.numero_serie);
          // Manter se status é em_estoque (ainda não aplicado), com_equipe ou não existe registro
          return !status || status === "em_estoque" || status === "com_equipe";
        })
        .map((item: any) => {
          const entrega = entregasMap.get(item.entrega_id);
          return {
            id: item.id,
            numero_serie: item.numero_serie,
            material_id: item.material_id,
            data_entrega_equipe: entrega?.data_confirmacao || entrega?.data_entrega,
            created_at: entrega?.data_entrega,
            updated_at: entrega?.data_confirmacao,
            materiais: item.materiais,
          };
        }) as RastroDisponivel[];
    },
    enabled: !!equipeId,
  });
  
  // Agrupar rastros por material_id para fácil acesso
  const rastrosPorMaterial = (rastrosDisponiveis || []).reduce((acc, rastro) => {
    if (!acc[rastro.material_id]) {
      acc[rastro.material_id] = [];
    }
    acc[rastro.material_id].push(rastro);
    return acc;
  }, {} as Record<string, RastroDisponivel[]>);

  // Mutation para aplicar/retirar material
  const aplicarMutation = useMutation({
    mutationFn: async (data: typeof formData & { tipo: "aplicado" | "retirado" }) => {
      // Buscar material para obter info
      const materialInfo = data.tipo === "aplicado" 
        ? estoqueEquipe?.find((e) => e.material_id === data.material_id)?.materiais
        : todosMateriais?.find((m: any) => m.id === data.material_id);
      
      if (data.tipo === "aplicado") {
        const material = estoqueEquipe?.find((e) => e.material_id === data.material_id);
        
        // Verificar estoque
        if (!material) {
          throw new Error("Material não encontrado no seu estoque");
        }
        if (material.quantidade < data.quantidade) {
          throw new Error(`Quantidade insuficiente! Você tem apenas ${material.quantidade} ${material.materiais.unidade} em estoque.`);
        }
      }

      // Se offline, enfileirar operação e atualizar cache local
      if (!isOnline) {
        console.log("[AppMateriaisOS] Offline - enfileirando operação de material");
        
        const novoRegistroId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const novoRegistro: MaterialAplicado = {
          id: novoRegistroId,
          material_id: data.material_id,
          quantidade: data.quantidade,
          tipo: data.tipo,
          numero_serie: data.numero_serie || null,
          observacao: data.observacao || null,
          created_at: new Date().toISOString(),
          materiais: materialInfo || {
            codigo: "---",
            nome: "Material",
            unidade: "UN",
            requer_serial: false,
          },
        };
        
        // Atualizar cache local de materiais da OS
        const materiaisOSAtual = await getFromCache<MaterialAplicado[]>(`materiais_os_${ordemId}`) || [];
        await saveToCache(`materiais_os_${ordemId}`, [...materiaisOSAtual, novoRegistro], 24);
        
        // Atualizar cache local de estoque (se aplicando)
        if (data.tipo === "aplicado" && equipeId) {
          const estoqueAtual = await getEstoqueFromCache(equipeId) as EstoqueItem[] || [];
          const estoqueAtualizado = estoqueAtual.map(item => {
            if (item.material_id === data.material_id) {
              return { ...item, quantidade: Math.max(0, item.quantidade - data.quantidade) };
            }
            return item;
          });
          await saveToCache(`${CACHE_KEYS.MATERIAIS_ESTOQUE}_${equipeId}`, estoqueAtualizado, 24);
        }
        
        // Enfileirar operação para sincronização
        await queueOperation(
          "aplicar_material_os",
          "materiais_aplicados_os",
          "insert",
          {
            ordem_servico_id: ordemId,
            material_id: data.material_id,
            quantidade: data.quantidade,
            tipo: data.tipo,
            numero_serie: data.numero_serie || null,
            observacao: data.observacao || null,
            equipe_id: equipeId,
            numero_os: ordem?.numero, // Para exibição no indicador offline
          },
          2 // Prioridade média
        );
        
        toast.success(data.tipo === "aplicado" ? "Material aplicado (será sincronizado)!" : "Material retirado (será sincronizado)!");
        return;
      }

      // Online - executar normalmente
      if (data.tipo === "aplicado") {
        // Dar baixa no estoque da equipe
        const { data: estoqueAtual } = await supabase
          .from("materiais_estoque")
          .select("id, quantidade")
          .eq("material_id", data.material_id)
          .eq("local_tipo", "equipe")
          .eq("local_id", equipeId)
          .single();

        if (estoqueAtual) {
          await supabase
            .from("materiais_estoque")
            .update({ quantidade: estoqueAtual.quantidade - data.quantidade })
            .eq("id", estoqueAtual.id);
        }
      }

      // Registrar aplicação/retirada
      const { error } = await supabase.from("materiais_aplicados_os").insert({
        ordem_servico_id: ordemId,
        material_id: data.material_id,
        quantidade: data.quantidade,
        tipo: data.tipo,
        numero_serie: data.numero_serie || null,
        observacao: data.observacao || null,
        equipe_id: equipeId,
      });

      if (error) throw error;

      // Registrar movimentação
      await supabase.from("materiais_movimentacoes").insert({
        material_id: data.material_id,
        tipo: data.tipo === "aplicado" ? "saida" : "entrada",
        quantidade: data.quantidade,
        local_origem_tipo: data.tipo === "aplicado" ? "equipe" : "campo",
        local_origem_id: data.tipo === "aplicado" ? equipeId : ordemId,
        local_destino_tipo: data.tipo === "aplicado" ? "campo" : "equipe",
        local_destino_id: data.tipo === "aplicado" ? ordemId : equipeId,
        ordem_servico_id: ordemId,
        observacao: `${data.tipo === "aplicado" ? "Aplicado" : "Retirado"} na OS #${ordem?.numero}`,
      });

      // Se for item serializado, atualizar status
      if (data.numero_serie) {
        await supabase
          .from("materiais_serializados")
          .update({
            status: data.tipo === "aplicado" ? "instalado" : "retirado",
            localizacao_tipo: data.tipo === "aplicado" ? "campo" : "equipe",
            localizacao_id: data.tipo === "aplicado" ? ordemId : equipeId,
            ordem_servico_id: data.tipo === "aplicado" ? ordemId : null,
          })
          .eq("numero_serie", data.numero_serie);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["materiais-os", ordemId] });
      queryClient.invalidateQueries({ queryKey: ["estoque-equipe-os", equipeId] });
      queryClient.invalidateQueries({ queryKey: ["rastros-disponiveis-equipe", equipeId] });
      toast.success(variables.tipo === "aplicado" ? "Material aplicado!" : "Material retirado!");
      setDialogOpen(false);
      setFormData({ material_id: "", quantidade: "" as unknown as number, numero_serie: "", observacao: "" });
      // Mudar para a aba correspondente
      if (variables.tipo === "aplicado") {
        setAbaAtiva("aplicados");
      } else {
        setAbaAtiva("retirados");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao registrar material");
    },
  });

  // Mutation para editar quantidade
  const editarQuantidadeMutation = useMutation({
    mutationFn: async ({ item, novaQuantidade }: { item: MaterialAplicado; novaQuantidade: number }) => {
      if (novaQuantidade <= 0) {
        throw new Error("Quantidade deve ser maior que zero");
      }

      if (item.tipo === "aplicado") {
        // Verificar estoque disponível (considerando a quantidade atual)
        const material = estoqueEquipe?.find((e) => e.material_id === item.material_id);
        const diferenca = novaQuantidade - item.quantidade;
        
        if (material && diferenca > 0 && material.quantidade < diferenca) {
          throw new Error(`Quantidade insuficiente! Você tem apenas ${material.quantidade} ${material.materiais.unidade} em estoque.`);
        }

        // Ajustar estoque
        if (diferenca !== 0) {
          const { data: estoqueAtual } = await supabase
            .from("materiais_estoque")
            .select("id, quantidade")
            .eq("material_id", item.material_id)
            .eq("local_tipo", "equipe")
            .eq("local_id", equipeId)
            .maybeSingle();

          if (estoqueAtual) {
            await supabase
              .from("materiais_estoque")
              .update({ quantidade: estoqueAtual.quantidade - diferenca })
              .eq("id", estoqueAtual.id);
          }
        }
      }

      // Atualizar registro
      const { error } = await supabase
        .from("materiais_aplicados_os")
        .update({ quantidade: novaQuantidade })
        .eq("id", item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais-os", ordemId] });
      queryClient.invalidateQueries({ queryKey: ["estoque-equipe-os", equipeId] });
      toast.success("Quantidade atualizada!");
      setEditDialogOpen(false);
      setItemEditando(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar quantidade");
    },
  });

  // Mutation para remover registro
  const removerMutation = useMutation({
    mutationFn: async (item: MaterialAplicado) => {
      // Se foi aplicado, devolver ao estoque
      if (item.tipo === "aplicado") {
        const { data: estoqueAtual } = await supabase
          .from("materiais_estoque")
          .select("id, quantidade")
          .eq("material_id", item.material_id)
          .eq("local_tipo", "equipe")
          .eq("local_id", equipeId)
          .maybeSingle();

        if (estoqueAtual) {
          await supabase
            .from("materiais_estoque")
            .update({ quantidade: estoqueAtual.quantidade + item.quantidade })
            .eq("id", estoqueAtual.id);
        } else {
          await supabase.from("materiais_estoque").insert({
            material_id: item.material_id,
            quantidade: item.quantidade,
            local_tipo: "equipe",
            local_id: equipeId,
          });
        }
      }

      // Remover registro
      const { error } = await supabase
        .from("materiais_aplicados_os")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais-os", ordemId] });
      queryClient.invalidateQueries({ queryKey: ["estoque-equipe-os", equipeId] });
      toast.success("Registro removido!");
    },
    onError: () => {
      toast.error("Erro ao remover registro");
    },
  });

  const handleOpenDialog = (tipo: "aplicar" | "retirar") => {
    setTipoOperacao(tipo);
    setFormData({ material_id: "", quantidade: "" as unknown as number, numero_serie: "", observacao: "" });
    setSearchTerm("");
    setSearchRastro(""); // Limpar pesquisa de rastro
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[AppMateriaisOS] handleSubmit chamado", { formData, tipoOperacao });
    
    if (!formData.material_id) {
      console.log("[AppMateriaisOS] Erro: Material não selecionado");
      toast.error("Selecione um material");
      return;
    }

    // Buscar material (do estoque ou de todos os materiais)
    const materialInfo = tipoOperacao === "aplicar" 
      ? estoqueEquipe?.find((e) => e.material_id === formData.material_id)?.materiais
      : todosMateriais?.find((m: any) => m.id === formData.material_id);
    
    const requerSerial = materialInfo?.requer_serial || materialInfo?.unidade === "SR";
    
    // Para materiais com rastro, a quantidade é sempre 1
    const quantidadeFinal = requerSerial ? 1 : formData.quantidade;
    
    if (!quantidadeFinal || quantidadeFinal <= 0) {
      console.log("[AppMateriaisOS] Erro: Quantidade inválida");
      toast.error("Digite uma quantidade válida");
      return;
    }

    // Verificar se requer número de série
    if (requerSerial && !formData.numero_serie) {
      console.log("[AppMateriaisOS] Erro: Requer número de série");
      toast.error("Este material requer número de série/rastro único");
      return;
    }

    // Se for aplicar, verificar estoque ANTES de chamar a mutation
    if (tipoOperacao === "aplicar") {
      const itemEstoque = estoqueEquipe?.find((e) => e.material_id === formData.material_id);
      console.log("[AppMateriaisOS] Verificando estoque", { itemEstoque, quantidade: quantidadeFinal });
      
      if (!itemEstoque) {
        console.log("[AppMateriaisOS] Erro: Material não encontrado no estoque");
        toast.error("Material não encontrado no seu estoque");
        return;
      }
      if (itemEstoque.quantidade < quantidadeFinal) {
        const mensagem = `Quantidade insuficiente! Você tem apenas ${itemEstoque.quantidade} ${itemEstoque.materiais.unidade} em estoque.`;
        console.log("[AppMateriaisOS] Erro:", mensagem);
        toast.error(mensagem);
        return;
      }

      // Verificar se material já está aplicado (mesmo material_id, mesmo numero_serie se houver)
      const jaAplicado = materiaisOS?.find((m) => {
        if (m.material_id !== formData.material_id) return false;
        if (requerSerial && m.numero_serie !== formData.numero_serie) return false;
        if (!requerSerial && m.tipo === "aplicado") return true;
        return m.tipo === "aplicado";
      });

      if (jaAplicado) {
        const mensagem = "Este material já está aplicado nesta OS. Use o botão de editar para alterar a quantidade.";
        console.log("[AppMateriaisOS] Erro:", mensagem);
        toast.error(mensagem);
        return;
      }
    }

    console.log("[AppMateriaisOS] Chamando mutation com quantidade:", quantidadeFinal);
    aplicarMutation.mutate({
      ...formData,
      quantidade: quantidadeFinal,
      tipo: tipoOperacao === "aplicar" ? "aplicado" : "retirado",
    });
  };

  // Filtrar estoque para seleção (aplicar)
  // Para materiais com rastro, só mostrar se tiver rastros disponíveis
  const estoqueFiltrado = estoqueEquipe?.filter((item) => {
    const requerSerial = item.materiais.requer_serial || item.materiais.unidade === "SR";
    
    // Se requer serial, verificar se tem rastros disponíveis
    if (requerSerial) {
      const rastrosDoMaterial = rastrosPorMaterial[item.material_id] || [];
      if (rastrosDoMaterial.length === 0) {
        return false; // Não mostrar se não tem rastros disponíveis
      }
    }
    
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.materiais.codigo.toLowerCase().includes(term) ||
      item.materiais.nome.toLowerCase().includes(term)
    );
  });

  // Filtrar todos os materiais para seleção (retirar)
  const materiaisFiltrados = todosMateriais?.filter((item: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.codigo.toLowerCase().includes(term) ||
      item.nome.toLowerCase().includes(term)
    );
  });

  // Separar materiais aplicados e retirados
  const materiaisAplicados = materiaisOS?.filter((m) => m.tipo === "aplicado") || [];
  const materiaisRetirados = materiaisOS?.filter((m) => m.tipo === "retirado") || [];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-violet-600" />
              Materiais da OS
            </h1>
            {ordem && (
              <p className="text-xs text-muted-foreground">
                OS #{ordem.numero} - {ordem.tipo}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Botões de Ação */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-16 flex-col gap-1 border-green-200 hover:bg-green-50 hover:border-green-300"
            onClick={() => handleOpenDialog("aplicar")}
          >
            <Plus className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">Aplicar Material</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex-col gap-1 border-orange-200 hover:bg-orange-50 hover:border-orange-300"
            onClick={() => handleOpenDialog("retirar")}
          >
            <Minus className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-700">Retirar Material</span>
          </Button>
        </div>

        {/* Tabs de Materiais */}
        <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as "aplicados" | "retirados")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="aplicados" className="gap-2">
              <Plus className="h-4 w-4" />
              Aplicados ({materiaisAplicados.length})
            </TabsTrigger>
            <TabsTrigger value="retirados" className="gap-2">
              <Minus className="h-4 w-4" />
              Retirados ({materiaisRetirados.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="aplicados" className="mt-4">
            {loadingMateriaisOS ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : materiaisAplicados.length > 0 ? (
              <div className="space-y-2">
                {materiaisAplicados.map((item) => (
                  <Card key={item.id} className="border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            {item.materiais.requer_serial ? (
                              <Zap className="h-5 w-5 text-green-600" />
                            ) : (
                              <Package className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.materiais.codigo}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.materiais.nome}
                            </p>
                            {item.numero_serie && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                <QrCode className="h-3 w-3 mr-1" />
                                {item.numero_serie}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(item.created_at), "dd/MM HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-700 border-0">
                            {item.quantidade} {item.materiais.unidade}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600"
                            onClick={() => {
                              setItemEditando(item);
                              setNovaQuantidade(item.quantidade);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removerMutation.mutate(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum material aplicado</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="retirados" className="mt-4">
            {loadingMateriaisOS ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : materiaisRetirados.length > 0 ? (
              <div className="space-y-2">
                {materiaisRetirados.map((item) => (
                  <Card key={item.id} className="border-orange-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            {item.materiais.requer_serial ? (
                              <Zap className="h-5 w-5 text-orange-600" />
                            ) : (
                              <Package className="h-5 w-5 text-orange-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.materiais.codigo}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.materiais.nome}
                            </p>
                            {item.numero_serie && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                <QrCode className="h-3 w-3 mr-1" />
                                {item.numero_serie}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(item.created_at), "dd/MM HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-orange-100 text-orange-700 border-0">
                            {item.quantidade} {item.materiais.unidade}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removerMutation.mutate(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum material retirado</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de Aplicar/Retirar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tipoOperacao === "aplicar" ? (
                <>
                  <Plus className="h-5 w-5 text-green-600" />
                  Aplicar Material
                </>
              ) : (
                <>
                  <Minus className="h-5 w-5 text-orange-600" />
                  Retirar Material
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Busca de Material */}
            <div className="space-y-2">
              <Label>Material *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar material..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Lista de Materiais */}
            {tipoOperacao === "aplicar" ? (
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {estoqueFiltrado && estoqueFiltrado.length > 0 ? (
                  <div className="divide-y">
                    {estoqueFiltrado.map((item) => {
                      const requerSerial = item.materiais.requer_serial || item.materiais.unidade === "SR";
                      const rastrosDoMaterial = rastrosPorMaterial[item.material_id] || [];
                      
                      return (
                        <button
                          key={item.material_id}
                          type="button"
                          className={`w-full p-3 text-left hover:bg-muted/50 transition-all ${
                            formData.material_id === item.material_id 
                              ? "bg-violet-100 border-2 border-violet-500 rounded-lg font-semibold" 
                              : "border border-transparent"
                          }`}
                          onClick={() => {
                            if (requerSerial && rastrosDoMaterial.length === 1) {
                              // Se só tem 1 rastro, já seleciona automaticamente
                              setFormData({ 
                                ...formData, 
                                material_id: item.material_id,
                                numero_serie: rastrosDoMaterial[0].numero_serie,
                                quantidade: 1
                              });
                            } else {
                              setFormData({ ...formData, material_id: item.material_id });
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {requerSerial && (
                                <div className="p-1.5 bg-amber-100 rounded">
                                  <QrCode className="h-4 w-4 text-amber-600" />
                                </div>
                              )}
                              <div>
                                <p className={`text-sm ${formData.material_id === item.material_id ? "text-violet-700 font-bold" : "font-medium"}`}>
                                  {item.materiais.codigo}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.materiais.nome}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {requerSerial ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                  {rastrosDoMaterial.length} rastro{rastrosDoMaterial.length !== 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  {item.quantidade} {item.materiais.unidade}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {searchTerm ? "Nenhum material encontrado" : "Seu estoque está vazio"}
                  </div>
                )}
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {materiaisFiltrados && materiaisFiltrados.length > 0 ? (
                  <div className="divide-y">
                    {materiaisFiltrados.map((item: any) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full p-3 text-left hover:bg-muted/50 transition-all ${
                          formData.material_id === item.id 
                            ? "bg-orange-100 border-2 border-orange-500 rounded-lg font-semibold" 
                            : "border border-transparent"
                        }`}
                        onClick={() =>
                          setFormData({ ...formData, material_id: item.id })
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-sm ${formData.material_id === item.id ? "text-orange-700 font-bold" : "font-medium"}`}>
                              {item.codigo}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.nome}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {item.unidade}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {searchTerm ? "Nenhum material encontrado" : "Nenhum material disponível"}
                  </div>
                )}
              </div>
            )}

            {/* Quantidade e Número de Série (lógica condicional) */}
            {formData.material_id && (
              (() => {
                const estoqueItem = tipoOperacao === "aplicar"
                  ? estoqueEquipe?.find((e) => e.material_id === formData.material_id)
                  : null;
                const material = tipoOperacao === "aplicar"
                  ? estoqueItem?.materiais
                  : todosMateriais?.find((m: any) => m.id === formData.material_id);
                
                const requerSerial = material?.requer_serial || material?.unidade === "SR";
                
                // Se requer serial, mostrar seletor de rastro e ocultar quantidade
                if (requerSerial) {
                  // Para aplicar: mostrar rastros do estoque da equipe
                  // Para retirar: permitir digitar/escanear qualquer número de série
                  
                  if (tipoOperacao === "aplicar") {
                    // Filtrar rastros disponíveis para este material
                    const todosRastrosDoMaterial = (rastrosPorMaterial[formData.material_id] || [])
                    .sort((a, b) => {
                      // Ordenar por dias com equipe (mais antigos primeiro)
                      const diasA = a.data_entrega_equipe ? calcularDiasDesde(a.data_entrega_equipe) : 0;
                      const diasB = b.data_entrega_equipe ? calcularDiasDesde(b.data_entrega_equipe) : 0;
                      return diasB - diasA;
                    });
                  
                  // Aplicar filtro de pesquisa
                  const rastrosDoMaterial = searchRastro 
                    ? todosRastrosDoMaterial.filter(r => 
                        r.numero_serie.toLowerCase().includes(searchRastro.toLowerCase())
                      )
                    : todosRastrosDoMaterial;
                  
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Selecione o Rastro *</Label>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={() => setScannerOpen(true)}
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          Ler Código
                        </Button>
                      </div>
                      
                      {/* Campo de pesquisa */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Pesquisar por número de série..."
                          value={searchRastro}
                          onChange={(e) => setSearchRastro(e.target.value.toUpperCase())}
                          className="pl-10 pr-10"
                        />
                        {searchRastro && (
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setSearchRastro("")}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      
                      {/* Lista de rastros disponíveis */}
                      <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                        {rastrosDoMaterial.length > 0 ? (
                          rastrosDoMaterial.map((rastro) => {
                            const dias = rastro.data_entrega_equipe 
                              ? calcularDiasDesde(rastro.data_entrega_equipe) 
                              : 0;
                            const nivel = getNivelAlerta(dias, rastro.materiais?.dias_alerta_retencao || 7);
                            const isSelected = formData.numero_serie === rastro.numero_serie;
                            
                            return (
                              <button
                                key={rastro.id}
                                type="button"
                                className={`w-full p-3 text-left transition-all ${
                                  isSelected 
                                    ? "bg-violet-100 border-l-4 border-l-violet-500" 
                                    : "hover:bg-muted/50"
                                }`}
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    numero_serie: rastro.numero_serie,
                                    quantidade: 1,
                                  });
                                  setSearchRastro(""); // Limpar pesquisa após selecionar
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      nivel === "critico" ? "bg-red-500" :
                                      nivel === "alerta" ? "bg-orange-500" :
                                      nivel === "atencao" ? "bg-amber-500" :
                                      "bg-green-500"
                                    }`} />
                                    <span className={`font-mono text-sm ${isSelected ? "font-bold text-violet-700" : ""}`}>
                                      {rastro.numero_serie}
                                    </span>
                                  </div>
                                  <DiasRetencaoBadge
                                    dataEntregaEquipe={rastro.data_entrega_equipe}
                                    diasAlertaRetencao={rastro.materiais?.dias_alerta_retencao || 7}
                                    size="sm"
                                  />
                                </div>
                                {nivel !== "normal" && dias > 0 && (
                                  <p className={`text-xs mt-1 ${
                                    nivel === "critico" ? "text-red-600" :
                                    nivel === "alerta" ? "text-orange-600" :
                                    "text-amber-600"
                                  }`}>
                                    ⚠️ Priorize este - {dias} dias com a equipe
                                  </p>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            {searchRastro 
                              ? `Nenhum rastro encontrado com "${searchRastro}"` 
                              : "Nenhum rastro disponível"
                            }
                          </div>
                        )}
                      </div>
                      
                      {/* Contador de resultados */}
                      {todosRastrosDoMaterial.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {searchRastro 
                            ? `${rastrosDoMaterial.length} de ${todosRastrosDoMaterial.length} rastros`
                            : `${todosRastrosDoMaterial.length} rastro${todosRastrosDoMaterial.length !== 1 ? 's' : ''} disponível${todosRastrosDoMaterial.length !== 1 ? 'is' : ''}`
                          }
                        </p>
                      )}
                      
                      {formData.numero_serie && (
                        <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg text-sm">
                          <CheckCircle className="h-4 w-4 text-violet-600" />
                          <span className="text-violet-700">
                            Selecionado: <strong className="font-mono">{formData.numero_serie}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                  } else {
                    // Retirar material com rastro - permitir digitar/escanear
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Número de Série *</Label>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="h-8"
                            onClick={() => setScannerOpen(true)}
                          >
                            <Camera className="h-4 w-4 mr-1" />
                            Ler Código
                          </Button>
                        </div>
                        
                        {/* Campo para digitar o número de série */}
                        <div className="relative">
                          <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Digite ou escaneie o número de série..."
                            value={formData.numero_serie}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              numero_serie: e.target.value.toUpperCase(),
                              quantidade: 1 // Sempre 1 para materiais com rastro
                            })}
                            className="pl-10 font-mono"
                          />
                        </div>
                        
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Material com rastro - quantidade fixa: 1 unidade
                        </p>
                        
                        {formData.numero_serie && (
                          <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg text-sm">
                            <CheckCircle className="h-4 w-4 text-orange-600" />
                            <span className="text-orange-700">
                              Série: <strong className="font-mono">{formData.numero_serie}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                }
                
                // Material normal (sem rastro) - mostrar campo de quantidade
                return (
                  <div className="space-y-2">
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.quantidade || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, quantidade: e.target.value ? parseInt(e.target.value) : ("" as unknown as number) })
                      }
                      placeholder="Digite a quantidade"
                    />
                  </div>
                );
              })()
            )}
            
            {/* Campo de quantidade para quando não tem material selecionado ainda */}
            {!formData.material_id && (
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantidade || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, quantidade: e.target.value ? parseInt(e.target.value) : ("" as unknown as number) })
                  }
                  placeholder="Selecione um material primeiro"
                  disabled
                />
              </div>
            )}

            {/* Observação */}
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                placeholder="Observações..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={aplicarMutation.isPending}
                className={
                  tipoOperacao === "aplicar"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-orange-600 hover:bg-orange-700"
                }
              >
                {aplicarMutation.isPending
                  ? "Salvando..."
                  : tipoOperacao === "aplicar"
                  ? "Aplicar"
                  : "Retirar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Editar Quantidade */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Quantidade</DialogTitle>
          </DialogHeader>

          {itemEditando && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Material</p>
                <p className="font-medium">{itemEditando.materiais.codigo}</p>
                <p className="text-xs text-muted-foreground">{itemEditando.materiais.nome}</p>
              </div>

              <div className="space-y-2">
                <Label>Nova Quantidade *</Label>
                <Input
                  type="number"
                  min="1"
                  value={novaQuantidade}
                  onChange={(e) => setNovaQuantidade(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  Quantidade atual: {itemEditando.quantidade} {itemEditando.materiais.unidade}
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => editarQuantidadeMutation.mutate({ item: itemEditando, novaQuantidade })}
                  disabled={editarQuantidadeMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {editarQuantidadeMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Scanner de Código de Barras */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          // Verificar se o código escaneado está na lista de rastros disponíveis
          if (tipoOperacao === "aplicar") {
            const rastroEncontrado = rastrosDisponiveis?.find(
              r => r.numero_serie.toUpperCase() === code.toUpperCase() && 
                   r.material_id === formData.material_id
            );
            
            if (rastroEncontrado) {
              setFormData({
                ...formData,
                numero_serie: rastroEncontrado.numero_serie,
                quantidade: 1,
              });
              setSearchRastro("");
              toast.success(`Rastro encontrado: ${rastroEncontrado.numero_serie}`);
            } else if (formData.material_id) {
              // Rastro não encontrado para o material selecionado
              toast.error("Este código não corresponde a um rastro disponível para o material selecionado.");
            } else {
              // Nenhum material selecionado, tentar encontrar pelo código
              const rastroQualquer = rastrosDisponiveis?.find(
                r => r.numero_serie.toUpperCase() === code.toUpperCase()
              );
              if (rastroQualquer) {
                setFormData({
                  ...formData,
                  material_id: rastroQualquer.material_id,
                  numero_serie: rastroQualquer.numero_serie,
                  quantidade: 1,
                });
                toast.success(`Rastro encontrado: ${rastroQualquer.numero_serie}`);
              } else {
                toast.error("Código não encontrado no seu estoque.");
              }
            }
          } else {
            // Retirar - aceitar qualquer código
            setFormData({
              ...formData,
              numero_serie: code.toUpperCase(),
              quantidade: 1,
            });
          }
        }}
        title={tipoOperacao === "aplicar" ? "Ler Código do Material" : "Ler Código para Retirada"}
      />

    </div>
  );
}

