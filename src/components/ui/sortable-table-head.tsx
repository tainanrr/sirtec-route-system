import { useState, useMemo } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

interface SortableTableHeadProps {
  column: string;
  label: string;
  sortConfig: SortConfig | null;
  onSort: (column: string) => void;
  className?: string;
}

export function SortableTableHead({
  column,
  label,
  sortConfig,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = sortConfig?.column === column;
  const direction = isActive ? sortConfig.direction : null;

  return (
    <TableHead
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors select-none",
        className
      )}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className="ml-1">
          {direction === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          ) : direction === "desc" ? (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
        </span>
      </div>
    </TableHead>
  );
}

/**
 * Hook para gerenciar ordenação de tabelas
 */
export function useSortableTable<T>(
  data: T[] | undefined,
  defaultSort?: SortConfig
) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(defaultSort || null);

  const handleSort = (column: string) => {
    setSortConfig((current) => {
      if (current?.column === column) {
        // Ciclo: asc -> desc -> null
        if (current.direction === "asc") {
          return { column, direction: "desc" };
        } else if (current.direction === "desc") {
          return null;
        }
      }
      return { column, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    if (!data || !sortConfig || !sortConfig.direction) {
      return data;
    }

    return [...data].sort((a: any, b: any) => {
      const aValue = getNestedValue(a, sortConfig.column);
      const bValue = getNestedValue(b, sortConfig.column);

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === "asc" ? 1 : -1;
      if (bValue == null) return sortConfig.direction === "asc" ? -1 : 1;

      // Compare values
      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue, "pt-BR", { numeric: true });
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue), "pt-BR");
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  return { sortConfig, handleSort, sortedData };
}

/**
 * Helper para acessar valores aninhados (ex: "materiais.codigo")
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}


