import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  LogOut,
  Wrench,
  Map,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  children?: { icon: React.ElementType; label: string; href: string }[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: MapPin, label: "Roteirização", href: "/roteirizacao" },
  { icon: ListChecks, label: "Acompanhamento de Roteirizações", href: "/acompanhamento-roteirizacoes" },
  { icon: Radio, label: "Torre de Controle", href: "/torre-controle" },
  { icon: ClipboardList, label: "Ordens de Serviço", href: "/ordens-servico" },
  { icon: CheckSquare, label: "Consulta Checklists", href: "/consulta-checklists" },
  { icon: Users, label: "Equipes", href: "/equipes" },
  { icon: Map, label: "Territórios", href: "/territorios" },
  {
    icon: FolderOpen,
    label: "Cadastros",
    children: [
      { icon: Wrench, label: "Skills", href: "/cadastros/skills" },
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
  collapsed?: boolean;
}

export function Sidebar({ isDark, setIsDark, collapsed = false }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [openCadastros, setOpenCadastros] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Get user initials and display name
  const userEmail = user?.email || "";
  const userName = user?.user_metadata?.nome_completo || userEmail.split("@")[0];
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className={cn(
        "flex h-16 items-center border-b border-sidebar-border transition-all",
        collapsed ? "justify-center px-2" : "gap-2 px-6"
      )}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary flex-shrink-0">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
        <div className="flex flex-col">
          <span className="text-lg font-bold text-sidebar-foreground">SirtecRoute</span>
          <span className="text-[10px] text-muted-foreground -mt-1">Sistema de Roteirização</span>
        </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          if (item.children) {
            if (collapsed) {
              return (
                <button
                  key={item.label}
                  className={cn(
                    "nav-item w-full justify-center text-sidebar-foreground",
                    item.children.some((c) => isActive(c.href)) && "bg-sidebar-accent"
                  )}
                  title={item.label}
                >
                  <item.icon className="h-5 w-5" />
                </button>
              );
            }
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
                collapsed && "justify-center",
                isActive(item.href) && "active"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        "border-t border-sidebar-border space-y-3",
        collapsed ? "p-2" : "p-3"
      )}>
        <button
          onClick={() => setIsDark(!isDark)}
          className={cn(
            "nav-item w-full text-sidebar-foreground",
            collapsed && "justify-center"
          )}
          title={collapsed ? (isDark ? "Tema Claro" : "Tema Escuro") : undefined}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {!collapsed && (isDark ? "Tema Claro" : "Tema Escuro")}
        </button>
        
        <div className={cn(
          "flex items-center rounded-lg bg-sidebar-accent",
          collapsed ? "justify-center p-2" : "gap-3 p-3"
        )}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold flex-shrink-0">
            {userInitials}
          </div>
          {!collapsed && (
            <>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md hover:bg-sidebar-border transition-colors text-muted-foreground hover:text-danger"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
            </>
          )}
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
          "fixed left-0 top-0 z-40 h-screen transform border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:translate-x-0",
          collapsed ? "w-16" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>
    </>
  );
}
