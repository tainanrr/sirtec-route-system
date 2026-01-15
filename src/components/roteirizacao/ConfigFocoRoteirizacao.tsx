import { useState, useMemo } from "react";
import { Target, X, Check, ChevronDown, ChevronRight, Search, RotateCcw, FolderOpen, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TipoServico {
  codigo: string;
  nome: string;
  grupo?: string;
}

interface ConfigFocoRoteirizacaoProps {
  /** Lista de tipos de serviço disponíveis (código, nome e grupo) */
  tiposDisponiveis: TipoServico[];
  /** Tipos de serviço selecionados como prioritários */
  tiposSelecionados: string[];
  /** Callback quando a seleção muda */
  onChange: (tipos: string[]) => void;
  /** Classe CSS adicional */
  className?: string;
  /** Modo compacto - apenas ícone */
  compact?: boolean;
  /** Desabilitar o componente */
  disabled?: boolean;
}

/**
 * Componente para configurar os tipos de serviço com foco/prioridade na roteirização.
 * 
 * Funcionalidades:
 * - Seleção múltipla de tipos de serviço organizados por grupos
 * - Marcar/desmarcar grupo inteiro ou tipos individuais
 * - Busca/filtro nos tipos disponíveis
 * - Visualização dos tipos selecionados com badges
 * - Reset para limpar seleção
 * 
 * Quando tipos são selecionados, o roteirizador irá:
 * 1. Continuar garantindo OSs Reguladas/Urgentes (prioridade absoluta)
 * 2. Priorizar OSs dos tipos selecionados após as urgentes
 * 3. Só depois alocar os demais tipos normalmente
 */
export function ConfigFocoRoteirizacao({
  tiposDisponiveis,
  tiposSelecionados,
  onChange,
  className,
  compact = false,
  disabled = false,
}: ConfigFocoRoteirizacaoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set(["Sem grupo"]));

  // Agrupar tipos por grupo de serviço
  const tiposPorGrupo = useMemo(() => {
    const grupos = new Map<string, TipoServico[]>();
    
    tiposDisponiveis.forEach(tipo => {
      const grupo = tipo.grupo || "Sem grupo";
      if (!grupos.has(grupo)) {
        grupos.set(grupo, []);
      }
      grupos.get(grupo)!.push(tipo);
    });
    
    // Ordenar tipos dentro de cada grupo pelo nome
    grupos.forEach((tipos, grupo) => {
      tipos.sort((a, b) => a.nome.localeCompare(b.nome));
    });
    
    return grupos;
  }, [tiposDisponiveis]);

  // Ordenar grupos (Sem grupo vai por último)
  const gruposOrdenados = useMemo(() => {
    const grupos = Array.from(tiposPorGrupo.keys()).sort((a, b) => {
      if (a === "Sem grupo") return 1;
      if (b === "Sem grupo") return -1;
      return a.localeCompare(b);
    });
    return grupos;
  }, [tiposPorGrupo]);

  // Filtrar tipos pela busca
  const tiposFiltradosPorGrupo = useMemo(() => {
    if (!searchTerm) return tiposPorGrupo;
    
    const search = searchTerm.toLowerCase();
    const filtrados = new Map<string, TipoServico[]>();
    
    tiposPorGrupo.forEach((tipos, grupo) => {
      // Verificar se o grupo corresponde à busca
      const grupoMatch = grupo.toLowerCase().includes(search);
      
      // Filtrar tipos que correspondem à busca
      const tiposFiltrados = tipos.filter(tipo => 
        tipo.nome.toLowerCase().includes(search) ||
        tipo.codigo.toLowerCase().includes(search) ||
        grupoMatch
      );
      
      if (tiposFiltrados.length > 0) {
        filtrados.set(grupo, tiposFiltrados);
      }
    });
    
    return filtrados;
  }, [tiposPorGrupo, searchTerm]);

  // Toggle de um tipo
  const handleToggleTipo = (codigo: string) => {
    const codigoLower = codigo.toLowerCase();
    if (tiposSelecionados.includes(codigoLower)) {
      onChange(tiposSelecionados.filter(t => t !== codigoLower));
    } else {
      onChange([...tiposSelecionados, codigoLower]);
    }
  };

  // Toggle de um grupo inteiro
  const handleToggleGrupo = (grupo: string) => {
    const tiposDoGrupo = tiposPorGrupo.get(grupo) || [];
    const codigosDoGrupo = tiposDoGrupo.map(t => t.codigo.toLowerCase());
    
    // Verificar se todos os tipos do grupo estão selecionados
    const todosGrupoSelecionados = codigosDoGrupo.every(c => tiposSelecionados.includes(c));
    
    if (todosGrupoSelecionados) {
      // Desmarcar todos os tipos do grupo
      onChange(tiposSelecionados.filter(t => !codigosDoGrupo.includes(t)));
    } else {
      // Marcar todos os tipos do grupo
      const novosSelecioandos = [...tiposSelecionados];
      codigosDoGrupo.forEach(c => {
        if (!novosSelecioandos.includes(c)) {
          novosSelecioandos.push(c);
        }
      });
      onChange(novosSelecioandos);
    }
  };

  // Verificar estado do checkbox do grupo
  const getEstadoGrupo = (grupo: string): "checked" | "unchecked" | "indeterminate" => {
    const tiposDoGrupo = tiposPorGrupo.get(grupo) || [];
    const codigosDoGrupo = tiposDoGrupo.map(t => t.codigo.toLowerCase());
    
    const selecionadosNoGrupo = codigosDoGrupo.filter(c => tiposSelecionados.includes(c)).length;
    
    if (selecionadosNoGrupo === 0) return "unchecked";
    if (selecionadosNoGrupo === codigosDoGrupo.length) return "checked";
    return "indeterminate";
  };

  // Toggle expansão do grupo
  const toggleGrupoExpandido = (grupo: string) => {
    const novos = new Set(gruposExpandidos);
    if (novos.has(grupo)) {
      novos.delete(grupo);
    } else {
      novos.add(grupo);
    }
    setGruposExpandidos(novos);
  };

  // Limpar todos
  const handleLimpar = () => {
    onChange([]);
  };

  // Marcar todos os tipos (visíveis no filtro atual)
  const handleMarcarTodos = () => {
    const tiposVisiveis = Array.from(tiposFiltradosPorGrupo.values())
      .flat()
      .map(t => t.codigo.toLowerCase());
    
    const novosSelecioandos = [...tiposSelecionados];
    tiposVisiveis.forEach(c => {
      if (!novosSelecioandos.includes(c)) {
        novosSelecioandos.push(c);
      }
    });
    onChange(novosSelecioandos);
  };

  // Desmarcar todos os tipos (visíveis no filtro atual)
  const handleDesmarcarTodos = () => {
    if (searchTerm) {
      // Se há filtro, desmarcar apenas os tipos visíveis
      const tiposVisiveis = Array.from(tiposFiltradosPorGrupo.values())
        .flat()
        .map(t => t.codigo.toLowerCase());
      onChange(tiposSelecionados.filter(t => !tiposVisiveis.includes(t)));
    } else {
      // Se não há filtro, desmarcar tudo
      onChange([]);
    }
  };

  // Verificar se todos os tipos visíveis estão selecionados
  const todosVisivelSelecionados = useMemo(() => {
    const tiposVisiveis = Array.from(tiposFiltradosPorGrupo.values())
      .flat()
      .map(t => t.codigo.toLowerCase());
    return tiposVisiveis.length > 0 && tiposVisiveis.every(t => tiposSelecionados.includes(t));
  }, [tiposFiltradosPorGrupo, tiposSelecionados]);

  // Verificar se algum tipo visível está selecionado
  const algumVisivelSelecionado = useMemo(() => {
    const tiposVisiveis = Array.from(tiposFiltradosPorGrupo.values())
      .flat()
      .map(t => t.codigo.toLowerCase());
    return tiposVisiveis.some(t => tiposSelecionados.includes(t));
  }, [tiposFiltradosPorGrupo, tiposSelecionados]);

  // Obter nome do tipo pelo código
  const getNomeTipo = (codigo: string): string => {
    const tipo = tiposDisponiveis.find(t => t.codigo.toLowerCase() === codigo.toLowerCase());
    return tipo?.nome || codigo;
  };

  const temFoco = tiposSelecionados.length > 0;

  // Conteúdo do trigger
  const triggerContent = compact ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "gap-1 h-8",
            temFoco && "border-purple-400 bg-purple-50 dark:bg-purple-950/30",
            className
          )}
        >
          <Target className={cn(
            "h-3.5 w-3.5",
            temFoco ? "text-purple-600" : "text-muted-foreground"
          )} />
          {temFoco && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-purple-200 dark:bg-purple-800">
              {tiposSelecionados.length}
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Foco na Roteirização</p>
        {temFoco ? (
          <p className="text-xs text-purple-500">{tiposSelecionados.length} tipo(s) prioritário(s)</p>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum tipo prioritário</p>
        )}
      </TooltipContent>
    </Tooltip>
  ) : (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      className={cn(
        "gap-2 h-8 text-xs",
        temFoco && "border-purple-400 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-950/50",
        className
      )}
    >
      <Target className={cn(
        "h-3.5 w-3.5",
        temFoco ? "text-purple-600" : "text-muted-foreground"
      )} />
      <span className="font-medium">Foco:</span>
      {temFoco ? (
        <>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300">
            {tiposSelecionados.length} tipo(s)
          </Badge>
          <span className="text-[10px] text-purple-600 dark:text-purple-500">(Ativo)</span>
        </>
      ) : (
        <span className="text-muted-foreground">Nenhum</span>
      )}
      <ChevronDown className="h-3 w-3 ml-1" />
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {triggerContent}
      </PopoverTrigger>
      <PopoverContent className="w-[420px]" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              Foco da Roteirização
            </h4>
            <p className="text-xs text-muted-foreground">
              Selecione os tipos de serviço que devem ter <strong>prioridade</strong> na construção das rotas.
            </p>
          </div>

          {/* Explicação */}
          <div className="text-xs bg-purple-50 dark:bg-purple-950/30 rounded-md p-2 border border-purple-200 dark:border-purple-800">
            <strong>🎯 Como funciona:</strong>
            <ul className="mt-1 space-y-0.5 ml-3 list-disc">
              <li>OSs <strong>Reguladas/Urgentes</strong> continuam com prioridade absoluta</li>
              <li>Os tipos selecionados terão <strong>segunda prioridade</strong></li>
              <li>Demais tipos serão alocados normalmente (menor prioridade)</li>
            </ul>
          </div>

          {/* Tipos selecionados */}
          {temFoco && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-purple-700 dark:text-purple-400">
                Tipos prioritários selecionados:
              </div>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {tiposSelecionados.map(codigo => (
                  <Badge
                    key={codigo}
                    variant="outline"
                    className="gap-1 h-6 text-xs bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700"
                  >
                    {getNomeTipo(codigo)}
                    <button
                      onClick={() => handleToggleTipo(codigo)}
                      className="ml-0.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Busca e botões de seleção rápida */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar tipo ou grupo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 text-sm pl-8"
              />
            </div>
            
            {/* Botões de seleção rápida */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarcarTodos}
                disabled={todosVisivelSelecionados}
                className="gap-1.5 h-7 text-xs flex-1"
              >
                <CheckSquare className="h-3 w-3" />
                Marcar {searchTerm ? "Filtrados" : "Todos"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDesmarcarTodos}
                disabled={!algumVisivelSelecionado}
                className="gap-1.5 h-7 text-xs flex-1"
              >
                <Square className="h-3 w-3" />
                Desmarcar {searchTerm ? "Filtrados" : "Todos"}
              </Button>
            </div>
          </div>
          
          {/* Lista de grupos e tipos */}
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-2 space-y-1">
              {Array.from(tiposFiltradosPorGrupo.keys()).length === 0 ? (
                <div className="text-xs text-center text-muted-foreground py-4">
                  Nenhum tipo encontrado
                </div>
              ) : (
                gruposOrdenados
                  .filter(grupo => tiposFiltradosPorGrupo.has(grupo))
                  .map(grupo => {
                    const tipos = tiposFiltradosPorGrupo.get(grupo) || [];
                    const estadoGrupo = getEstadoGrupo(grupo);
                    const isExpanded = gruposExpandidos.has(grupo) || searchTerm.length > 0;
                    
                    return (
                      <Collapsible
                        key={grupo}
                        open={isExpanded}
                        onOpenChange={() => !searchTerm && toggleGrupoExpandido(grupo)}
                      >
                        {/* Header do grupo */}
                        <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                          <CollapsibleTrigger asChild>
                            <button 
                              className="p-0.5 hover:bg-muted-foreground/10 rounded"
                              disabled={!!searchTerm}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          </CollapsibleTrigger>
                          
                          <button
                            onClick={() => handleToggleGrupo(grupo)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            <Checkbox
                              checked={estadoGrupo === "checked"}
                              className={cn(
                                "h-3.5 w-3.5",
                                estadoGrupo === "checked" && "border-purple-600 data-[state=checked]:bg-purple-600",
                                estadoGrupo === "indeterminate" && "border-purple-400 bg-purple-200 dark:bg-purple-800"
                              )}
                              // @ts-ignore - indeterminate não é suportado nativamente mas funciona
                              data-state={estadoGrupo === "indeterminate" ? "indeterminate" : estadoGrupo === "checked" ? "checked" : "unchecked"}
                            />
                            <FolderOpen className="h-3.5 w-3.5 text-amber-600" />
                            <span className="font-medium text-xs">{grupo}</span>
                            <Badge variant="outline" className="h-4 px-1 text-[10px] ml-auto">
                              {tipos.length}
                            </Badge>
                          </button>
                        </div>
                        
                        {/* Tipos dentro do grupo */}
                        <CollapsibleContent>
                          <div className="ml-6 mt-1 space-y-0.5">
                            {tipos.map(tipo => {
                              const isSelected = tiposSelecionados.includes(tipo.codigo.toLowerCase());
                              return (
                                <button
                                  key={tipo.codigo}
                                  onClick={() => handleToggleTipo(tipo.codigo)}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors",
                                    isSelected 
                                      ? "bg-purple-100 dark:bg-purple-900/50 text-purple-900 dark:text-purple-100" 
                                      : "hover:bg-muted"
                                  )}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      isSelected && "border-purple-600 data-[state=checked]:bg-purple-600"
                                    )}
                                  />
                                  <span className="truncate">{tipo.nome}</span>
                                </button>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })
              )}
            </div>
          </ScrollArea>

          {/* Ações */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLimpar}
              disabled={!temFoco}
              className="gap-1 text-xs h-7"
            >
              <RotateCcw className="h-3 w-3" />
              Limpar Foco
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
              className="gap-1 h-7 text-xs bg-purple-600 hover:bg-purple-700"
            >
              <Check className="h-3 w-3" />
              Aplicar ({tiposSelecionados.length})
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
