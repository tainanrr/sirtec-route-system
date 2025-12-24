import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any, row: any) => string;
}

interface ExportButtonProps {
  data: any[];
  columns: ExportColumn[];
  filename: string;
  disabled?: boolean;
}

// Função para formatar valores para exportação
const formatValue = (value: any, column: ExportColumn, row: any): string => {
  if (column.format) {
    return column.format(value, row);
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return value.toString();
  }

  return String(value);
};

// Função para acessar propriedades aninhadas (ex: "contratos.codigo")
const getNestedValue = (obj: any, path: string): any => {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
};

// Exportar para CSV
const exportToCSV = (data: any[], columns: ExportColumn[], filename: string) => {
  // Cabeçalho
  const header = columns.map((col) => `"${col.label}"`).join(";");

  // Linhas
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = getNestedValue(row, col.key);
        const formatted = formatValue(value, col, row);
        // Escapar aspas duplas e envolver em aspas
        return `"${formatted.replace(/"/g, '""')}"`;
      })
      .join(";")
  );

  const csv = [header, ...rows].join("\n");
  
  // Adicionar BOM para UTF-8
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  
  downloadBlob(blob, `${filename}.csv`);
};

// Exportar para Excel (XLSX simples via CSV com extensão xlsx)
const exportToExcel = (data: any[], columns: ExportColumn[], filename: string) => {
  // Criar conteúdo HTML de tabela para Excel
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Dados</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; }
        th { background-color: #4472C4; color: white; font-weight: bold; padding: 8px; border: 1px solid #000; }
        td { padding: 6px; border: 1px solid #ccc; }
        tr:nth-child(even) { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            ${columns.map((col) => `<th>${col.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach((row) => {
    html += "<tr>";
    columns.forEach((col) => {
      const value = getNestedValue(row, col.key);
      const formatted = formatValue(value, col, row);
      html += `<td>${formatted}</td>`;
    });
    html += "</tr>";
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  downloadBlob(blob, `${filename}.xls`);
};

// Exportar para JSON
const exportToJSON = (data: any[], columns: ExportColumn[], filename: string) => {
  // Exportar dados completos
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, `${filename}.json`);
};

// Função auxiliar para download
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export function ExportButton({ data, columns, filename, disabled }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "csv" | "excel" | "json") => {
    if (!data || data.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    setExporting(true);
    try {
      const timestamp = new Date().toISOString().split("T")[0];
      const fullFilename = `${filename}_${timestamp}`;

      switch (format) {
        case "csv":
          exportToCSV(data, columns, fullFilename);
          toast.success(`Exportado ${data.length} registros para CSV`);
          break;
        case "excel":
          exportToExcel(data, columns, fullFilename);
          toast.success(`Exportado ${data.length} registros para Excel`);
          break;
        case "json":
          exportToJSON(data, columns, fullFilename);
          toast.success(`Exportado ${data.length} registros para JSON`);
          break;
      }
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar dados");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || exporting || !data?.length}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
          Excel (.xls)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileText className="h-4 w-4 mr-2 text-blue-600" />
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          <FileText className="h-4 w-4 mr-2 text-amber-600" />
          JSON (.json)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Hook para facilitar a criação de colunas de exportação
export function useExportColumns(columns: ExportColumn[]): ExportColumn[] {
  return columns;
}



