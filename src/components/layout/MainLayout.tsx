import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  showDatePicker?: boolean;
  /** Modo de destaque visual para telas de ação em tempo real */
  highlightMode?: "action" | "warning" | "none";
  /** Classe CSS customizada para o título do header */
  titleClassName?: string;
}

export function MainLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  showDatePicker = true,
  highlightMode = "none",
  titleClassName,
}: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sidebarCollapsed");
        return saved === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
      } catch {
        // Ignorar erro
      }
    }
  }, [sidebarCollapsed]);
  const [isDark, setIsDark] = useState(() => {
    // Inicializar com tema claro por padrão
    if (typeof window !== "undefined") {
      try {
        const savedTheme = localStorage.getItem("theme");
        return savedTheme === "dark";
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    // Aplicar tema inicial
    if (typeof window !== "undefined") {
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  useEffect(() => {
    // Salvar preferência quando mudar
    if (typeof window !== "undefined") {
      try {
        if (isDark) {
          document.documentElement.classList.add("dark");
          localStorage.setItem("theme", "dark");
        } else {
          document.documentElement.classList.remove("dark");
          localStorage.setItem("theme", "light");
        }
      } catch (error) {
        // Se houver erro ao salvar, apenas aplicar o tema
        console.warn("Erro ao salvar tema:", error);
        if (isDark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    }
  }, [isDark]);

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      highlightMode === "action" 
        ? "bg-gradient-to-br from-emerald-50/50 via-background to-teal-50/30 dark:from-emerald-950/20 dark:via-background dark:to-teal-950/10" 
        : highlightMode === "warning"
        ? "bg-gradient-to-br from-amber-50/50 via-background to-orange-50/30 dark:from-amber-950/20 dark:via-background dark:to-orange-950/10"
        : "bg-background"
    )}>
      <Sidebar isDark={isDark} setIsDark={setIsDark} collapsed={sidebarCollapsed} />
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        <Header
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          showDatePicker={showDatePicker}
          titleClassName={titleClassName}
          highlightMode={highlightMode}
        />
        <main className={cn(
          "p-6 transition-all duration-300",
          highlightMode === "action" && "border-l-4 border-emerald-500/50"
        )}>{children}</main>
      </div>
      {/* Botão para colapsar/expandir sidebar - posicionado na borda direita do sidebar */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-30 hidden lg:flex rounded-l-none rounded-r-lg border-l-0 shadow-lg bg-background/95 backdrop-blur-sm hover:bg-accent transition-all duration-300",
          sidebarCollapsed ? "left-16" : "left-64"
        )}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
