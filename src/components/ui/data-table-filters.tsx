import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Search,
  X,
  Filter,
  Calendar as CalendarIcon,
  FilterX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface FilterConfig {
  id: string;
  label: string;
  type: "text" | "select" | "date" | "dateRange";
  placeholder?: string;
  options?: { value: string; label: string; color?: string }[];
  defaultValue?: string;
}

export interface FilterValues {
  [key: string]: string | Date | null;
}

interface DataTableFiltersProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onClear: () => void;
  className?: string;
}

export function DataTableFilters({
  filters,
  values,
  onChange,
  onClear,
  className,
}: DataTableFiltersProps) {
  const [debouncedText, setDebouncedText] = useState<Record<string, string>>({});

  // Debounce para campos de texto
  useEffect(() => {
    const textFilters = filters.filter((f) => f.type === "text");
    const timers: NodeJS.Timeout[] = [];

    textFilters.forEach((filter) => {
      if (debouncedText[filter.id] !== undefined) {
        const timer = setTimeout(() => {
          onChange({ ...values, [filter.id]: debouncedText[filter.id] });
        }, 300);
        timers.push(timer);
      }
    });

    return () => timers.forEach((t) => clearTimeout(t));
  }, [debouncedText]);

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(values).filter(([_, value]) => {
      if (value === null || value === undefined || value === "" || value === "all") return false;
      return true;
    }).length;
  }, [values]);

  const handleTextChange = (id: string, value: string) => {
    setDebouncedText((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: string, value: string) => {
    onChange({ ...values, [id]: value });
  };

  const handleDateChange = (id: string, date: Date | undefined) => {
    onChange({ ...values, [id]: date || null });
  };

  const clearFilter = (id: string) => {
    const filter = filters.find((f) => f.id === id);
    if (filter?.type === "text") {
      setDebouncedText((prev) => ({ ...prev, [id]: "" }));
    }
    onChange({ ...values, [id]: filter?.type === "select" ? "all" : "" });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header dos filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeFiltersCount} ativo{activeFiltersCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <FilterX className="h-3.5 w-3.5 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Campos de filtro */}
      <div className="flex flex-wrap items-center gap-3">
        {filters.map((filter) => {
          const value = values[filter.id];
          const hasValue = value !== null && value !== undefined && value !== "" && value !== "all";

          switch (filter.type) {
            case "text":
              return (
                <div key={filter.id} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={debouncedText[filter.id] ?? (value as string) ?? ""}
                    onChange={(e) => handleTextChange(filter.id, e.target.value)}
                    placeholder={filter.placeholder || filter.label}
                    className={cn(
                      "pl-9 pr-8 h-9 w-64 transition-all",
                      hasValue && "border-primary/50 bg-primary/5"
                    )}
                  />
                  {hasValue && (
                    <button
                      onClick={() => clearFilter(filter.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              );

            case "select":
              const selectedOption = filter.options?.find((o) => o.value === value);
              return (
                <Select
                  key={filter.id}
                  value={(value as string) || "all"}
                  onValueChange={(v) => handleSelectChange(filter.id, v)}
                >
                  <SelectTrigger
                    className={cn(
                      "h-9 w-44 transition-all",
                      hasValue && "border-primary/50 bg-primary/5"
                    )}
                  >
                    <SelectValue placeholder={filter.placeholder || filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="text-muted-foreground">Todos</span>
                    </SelectItem>
                    {filter.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.color && (
                            <div className={cn("w-2 h-2 rounded-full", option.color)} />
                          )}
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );

            case "date":
              return (
                <Popover key={filter.id}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 w-40 justify-start text-left font-normal",
                        !value && "text-muted-foreground",
                        hasValue && "border-primary/50 bg-primary/5"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {value ? (
                        format(value as Date, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>{filter.placeholder || filter.label}</span>
                      )}
                      {hasValue && (
                        <X
                          className="ml-auto h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearFilter(filter.id);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={value as Date}
                      onSelect={(date) => handleDateChange(filter.id, date)}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

/**
 * Hook para gerenciar estado de filtros
 */
export function useDataTableFilters(
  initialFilters: FilterConfig[],
  initialValues?: FilterValues
) {
  const defaultValues = useMemo(() => {
    const values: FilterValues = {};
    initialFilters.forEach((filter) => {
      if (filter.type === "select") {
        values[filter.id] = filter.defaultValue || "all";
      } else {
        values[filter.id] = filter.defaultValue || "";
      }
    });
    return { ...values, ...initialValues };
  }, [initialFilters, initialValues]);

  const [filterValues, setFilterValues] = useState<FilterValues>(defaultValues);

  const clearFilters = () => {
    setFilterValues(defaultValues);
  };

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filterValues).some(([key, value]) => {
      const filter = initialFilters.find((f) => f.id === key);
      if (filter?.type === "select") {
        return value !== "all" && value !== "";
      }
      return value !== null && value !== undefined && value !== "";
    });
  }, [filterValues, initialFilters]);

  return {
    filterValues,
    setFilterValues,
    clearFilters,
    hasActiveFilters,
  };
}

/**
 * Função auxiliar para filtrar dados
 */
export function filterData<T>(
  data: T[],
  filterValues: FilterValues,
  filterConfig: FilterConfig[],
  customMatchers?: Record<string, (item: T, value: any) => boolean>
): T[] {
  return data.filter((item) => {
    return filterConfig.every((filter) => {
      const value = filterValues[filter.id];
      
      // Ignorar filtros vazios
      if (value === null || value === undefined || value === "" || value === "all") {
        return true;
      }

      // Usar matcher customizado se existir
      if (customMatchers?.[filter.id]) {
        return customMatchers[filter.id](item, value);
      }

      // Matcher padrão para texto
      if (filter.type === "text") {
        const itemValue = getNestedValue(item, filter.id);
        if (itemValue === null || itemValue === undefined) return false;
        return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
      }

      // Matcher padrão para select
      if (filter.type === "select") {
        const itemValue = getNestedValue(item, filter.id);
        return itemValue === value;
      }

      return true;
    });
  });
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}
