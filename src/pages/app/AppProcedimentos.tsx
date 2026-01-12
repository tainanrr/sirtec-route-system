import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { useOfflineCache, formatCacheSize } from "@/hooks/useOfflineCache";
import { useOfflineSyncContext } from "@/hooks/useOfflineSync";
import { useOfflineData } from "@/hooks/useOfflineData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  FileText,
  Search,
  ChevronRight,
  BookOpen,
  Shield,
  Wrench,
  Award,
  Briefcase,
  Settings,
  FolderOpen,
  Paperclip,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  Filter,
  X,
  CloudOff,
  HardDrive,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Anexo {
  id: string;
  nome: string;
  tipo_arquivo: string;
}

interface Procedimento {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  visivel_app: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
  anexos_count?: number;
}

// Configuração de categorias com cores e ícones
const categoriaConfig: Record<string, { 
  label: string; 
  icon: typeof FileText; 
  gradient: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  seguranca: {
    label: "Segurança",
    icon: Shield,
    gradient: "from-red-500 to-orange-500",
    bgColor: "bg-red-500/10",
    textColor: "text-red-600 dark:text-red-400",
    borderColor: "border-red-500/30",
  },
  tecnico: {
    label: "Técnico",
    icon: Wrench,
    gradient: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/30",
  },
  qualidade: {
    label: "Qualidade",
    icon: Award,
    gradient: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/30",
  },
  administrativo: {
    label: "Administrativo",
    icon: Briefcase,
    gradient: "from-amber-500 to-yellow-500",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500/30",
  },
  operacional: {
    label: "Operacional",
    icon: Settings,
    gradient: "from-green-500 to-emerald-500",
    bgColor: "bg-green-500/10",
    textColor: "text-green-600 dark:text-green-400",
    borderColor: "border-green-500/30",
  },
  outro: {
    label: "Outros",
    icon: FolderOpen,
    gradient: "from-slate-500 to-gray-500",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-600 dark:text-slate-400",
    borderColor: "border-slate-500/30",
  },
};

export default function AppProcedimentos() {
  const navigate = useNavigate();
  const { equipe } = useEquipeAuth();
  const { hasCachedFiles, totalCacheSize, isSupported: offlineSupported } = useOfflineCache();
  const { isOnline } = useOfflineSyncContext();
  const { getProcedimentosFromCache } = useOfflineData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Buscar procedimentos
  const { data: procedimentos, isLoading, refetch, error } = useQuery({
    queryKey: ["procedimentos-app", equipe?.contrato_id],
    queryFn: async () => {
      // Se offline, buscar do cache
      if (!isOnline) {
        const cached = await getProcedimentosFromCache();
        if (cached) {
          console.log("[Procedimentos] Usando cache offline:", cached.length);
          return cached as Procedimento[];
        }
        return [];
      }

      let query = supabase
        .from("procedimentos")
        .select(`
          id,
          titulo,
          descricao,
          categoria,
          visivel_app,
          ativo,
          ordem,
          created_at,
          updated_at,
          procedimentos_anexos(count)
        `)
        .eq("ativo", true)
        .eq("visivel_app", true)
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });

      // Filtrar por contrato se a equipe tiver um
      if (equipe?.contrato_id) {
        query = query.or(`contrato_id.is.null,contrato_id.eq.${equipe.contrato_id}`);
      } else {
        query = query.is("contrato_id", null);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Processar contagem de anexos
      return (data || []).map((p: any) => ({
        ...p,
        anexos_count: p.procedimentos_anexos?.[0]?.count || 0,
      })) as Procedimento[];
    },
  });

  // Filtrar procedimentos
  const filteredProcedimentos = useMemo(() => {
    if (!procedimentos) return [];

    return procedimentos.filter((p) => {
      const matchesSearch =
        !searchTerm ||
        p.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.descricao?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategoria = !selectedCategoria || p.categoria === selectedCategoria;

      return matchesSearch && matchesCategoria;
    });
  }, [procedimentos, searchTerm, selectedCategoria]);

  // Agrupar por categoria para mostrar contadores
  const categoriasCounts = useMemo(() => {
    if (!procedimentos) return {};
    return procedimentos.reduce((acc, p) => {
      acc[p.categoria] = (acc[p.categoria] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [procedimentos]);

  // Categorias disponíveis (que têm procedimentos)
  const categoriasDisponiveis = useMemo(() => {
    return Object.keys(categoriasCounts).sort();
  }, [categoriasCounts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Procedimentos atualizados!");
    } catch {
      toast.error("Erro ao atualizar");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getCategoria = (cat: string) => {
    return categoriaConfig[cat] || categoriaConfig.outro;
  };

  // Loading
  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  // Erro
  if (error) {
    return (
      <div className="p-4">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <p className="font-medium text-red-700 dark:text-red-400">
              Erro ao carregar procedimentos
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error).message}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Procedimentos</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {procedimentos?.length || 0} disponíveis
                </p>
                {offlineSupported && totalCacheSize > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30">
                    <HardDrive className="h-2.5 w-2.5 mr-1" />
                    {formatCacheSize(totalCacheSize)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar procedimentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 bg-muted/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categorias Chips */}
      {categoriasDisponiveis.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCategoria(null)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 shrink-0",
                  !selectedCategoria
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Todos
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {procedimentos?.length || 0}
                </Badge>
              </button>
              
              {categoriasDisponiveis.map((cat) => {
                const config = getCategoria(cat);
                const Icon = config.icon;
                const isSelected = selectedCategoria === cat;
                
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoria(isSelected ? null : cat)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 shrink-0",
                      isSelected
                        ? `bg-gradient-to-r ${config.gradient} text-white shadow-md`
                        : `${config.bgColor} ${config.textColor} hover:opacity-80`
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "ml-1 h-5 px-1.5 text-xs",
                        isSelected && "bg-white/20 text-white border-white/30"
                      )}
                    >
                      {categoriasCounts[cat]}
                    </Badge>
                  </button>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>
      )}

      {/* Lista de Procedimentos */}
      <div className="p-4 space-y-3 pb-24">
        {filteredProcedimentos.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="p-8 text-center">
              <FileText className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <p className="font-medium text-muted-foreground">
                {searchTerm || selectedCategoria
                  ? "Nenhum procedimento encontrado"
                  : "Nenhum procedimento disponível"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm || selectedCategoria
                  ? "Tente ajustar os filtros"
                  : "Os procedimentos serão exibidos aqui"}
              </p>
              {(searchTerm || selectedCategoria) && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategoria(null);
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredProcedimentos.map((procedimento, index) => {
            const config = getCategoria(procedimento.categoria);
            const Icon = config.icon;

            return (
              <Card
                key={procedimento.id}
                className={cn(
                  "cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden group",
                  "border-l-4",
                  config.borderColor
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
                onClick={() => navigate(`/app/procedimentos/${procedimento.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Ícone da categoria */}
                    <div
                      className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                        `bg-gradient-to-br ${config.gradient}`
                      )}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                            {procedimento.titulo}
                          </h3>
                          {procedimento.descricao && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {procedimento.descricao}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:translate-x-1 transition-transform" />
                      </div>

                      {/* Meta info */}
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            config.bgColor,
                            config.textColor
                          )}
                        >
                          {config.label}
                        </Badge>

                        {procedimento.anexos_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" />
                            {procedimento.anexos_count} anexo{procedimento.anexos_count > 1 ? "s" : ""}
                          </span>
                        )}

                        {hasCachedFiles(procedimento.id) && (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <CloudOff className="h-3 w-3" />
                            Offline
                          </span>
                        )}

                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(procedimento.updated_at || procedimento.created_at), "dd/MM/yy", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

