import { useState, useEffect } from "react";
import { Target, X, Check, ChevronDown, Search, RotateCcw } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TipoServico {
  codigo: string;
  nome: string;
}

interface ConfigFocoRoteirizacaoProps {
  /** Lista de tipos de serviço disponíveis (código e nome) */
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
 * - Seleção múltipla de tipos de serviço
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

  // Filtrar tipos pela busca
  const tiposFiltrados = tiposDisponiveis.filter(tipo => {
    const search = searchTerm.toLowerCase();
    return (
      tipo.codigo.toLowerCase().includes(search) ||
      tipo.nome.toLowerCase().includes(search)
    );
  });

  // Toggle de um tipo
  const handleToggle = (codigo: string) => {
    const codigoLower = codigo.toLowerCase();
    if (tiposSelecionados.includes(codigoLower)) {
      onChange(tiposSelecionados.filter(t => t !== codigoLower));
    } else {
      onChange([...tiposSelecionados, codigoLower]);
    }
  };

  // Limpar todos
  const handleLimpar = () => {
    onChange([]);
  };

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
      <PopoverContent className="w-96" align="end">
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
              <div className="flex flex-wrap gap-1">
                {tiposSelecionados.map(codigo => (
                  <Badge
                    key={codigo}
                    variant="outline"
                    className="gap-1 h-6 text-xs bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700"
                  >
                    {getNomeTipo(codigo)}
                    <button
                      onClick={() => handleToggle(codigo)}
                      className="ml-0.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Busca e lista */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar tipo de serviço..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 text-sm pl-8"
              />
            </div>
            
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {tiposFiltrados.length === 0 ? (
                  <div className="text-xs text-center text-muted-foreground py-4">
                    Nenhum tipo encontrado
                  </div>
                ) : (
                  tiposFiltrados.map(tipo => {
                    const isSelected = tiposSelecionados.includes(tipo.codigo.toLowerCase());
                    return (
                      <button
                        key={tipo.codigo}
                        onClick={() => handleToggle(tipo.codigo)}
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
                        <span className="font-medium">{tipo.nome}</span>
                        <span className="text-muted-foreground">({tipo.codigo})</span>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

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
