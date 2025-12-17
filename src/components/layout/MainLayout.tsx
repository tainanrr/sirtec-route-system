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
}

export function MainLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  showDatePicker = true,
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
    <div className="min-h-screen bg-background">
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
        />
        <main className="p-6">{children}</main>
      </div>
      {/* Botão para colapsar/expandir sidebar */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed left-0 top-1/2 -translate-y-1/2 z-50 hidden lg:flex rounded-l-none rounded-r-lg border-l-0 shadow-lg",
          sidebarCollapsed ? "translate-x-0" : "translate-x-64"
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
