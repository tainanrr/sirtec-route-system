import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MapPin,
  Radio,
  ClipboardList,
  Users,
  FolderOpen,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Moon,
  Sun,
  Zap,
  UserCircle,
  MapPinned,
  Pentagon,
  CheckSquare,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  children?: { icon: React.ElementType; label: string; href: string }[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: MapPin, label: "Roteirização", href: "/roteirizacao" },
  { icon: Radio, label: "Torre de Controle", href: "/torre-controle" },
  { icon: ClipboardList, label: "Ordens de Serviço", href: "/ordens-servico" },
  { icon: Users, label: "Equipes", href: "/equipes" },
  {
    icon: FolderOpen,
    label: "Cadastros",
    children: [
      { icon: UserCircle, label: "Técnicos", href: "/cadastros/tecnicos" },
      { icon: MapPinned, label: "Pontos de Saída", href: "/cadastros/pontos-saida" },
      { icon: Pentagon, label: "Polígonos", href: "/cadastros/poligonos" },
      { icon: CheckSquare, label: "Checklists", href: "/cadastros/checklists" },
    ],
  },
  { icon: BarChart3, label: "Relatórios", href: "/relatorios" },
  { icon: Settings, label: "Configurações", href: "/configuracoes" },
];

interface SidebarProps {
  isDark: boolean;
  setIsDark: (value: boolean) => void;
}

export function Sidebar({ isDark, setIsDark }: SidebarProps) {
  const location = useLocation();
  const [openCadastros, setOpenCadastros] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold text-sidebar-foreground">SirtecRoute</span>
          <span className="text-[10px] text-muted-foreground -mt-1">Sistema de Roteirização</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          if (item.children) {
            return (
              <Collapsible
                key={item.label}
                open={openCadastros}
                onOpenChange={setOpenCadastros}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "nav-item w-full justify-between text-sidebar-foreground",
                      item.children.some((c) => isActive(c.href)) && "bg-sidebar-accent"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </span>
                    {openCadastros ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 ml-4 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      to={child.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "nav-item text-sidebar-foreground",
                        isActive(child.href) && "active"
                      )}
                    >
                      <child.icon className="h-4 w-4" />
                      {child.label}
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href!}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "nav-item text-sidebar-foreground",
                isActive(item.href) && "active"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-3">
        <button
          onClick={() => setIsDark(!isDark)}
          className="nav-item w-full text-sidebar-foreground"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {isDark ? "Tema Claro" : "Tema Escuro"}
        </button>
        
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            JS
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">João Silva</p>
            <p className="text-xs text-muted-foreground truncate">Gestor Operacional</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 transform border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
