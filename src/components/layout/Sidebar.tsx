import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MapPin,
  Radio,
  ClipboardList,
  Users,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Moon,
  Sun,
  Zap,
  CheckSquare,
  Menu,
  X,
  LogOut,
  Map,
  ListChecks,
  Package,
  Shield,
  Car,
  Target,
  UserCheck,
  Building2,
  Lock,
  Database,
  ScrollText,
  History,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { useWebAuth } from "@/contexts/WebAuthContext";

interface NavChild {
  icon: React.ElementType;
  label: string;
  href: string;
  permission?: string; // Permissão necessária
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  children?: NavChild[];
  type?: "divider";
  permission?: string; // Permissão necessária
  module?: string; // Módulo (para verificar acesso)
  requireAdmin?: boolean; // Se requer admin
}

// Definição dos itens de navegação com permissões
// NOTA: Os códigos de permissão devem corresponder aos cadastrados em Admin > Permissões
const navItemsConfig: NavItem[] = [
  // Dashboard - visível para todos autenticados (sem permissão específica = sempre visível)
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Target, label: "Produção x Meta", href: "/dashboard/producao-meta" },
  { icon: Zap, label: "Assertividade", href: "/dashboard/assertividade" },
  { icon: LayoutDashboard, label: "__divider_1__", type: "divider" },
  // Torre de Controle
  { icon: Radio, label: "Torre de Controle", href: "/torre-controle", permission: "roteirizacao.torre_controle" },
  { icon: LayoutDashboard, label: "__divider_2__", type: "divider" },
  // Roteirização - aceita "criar" OU "visualizar"
  { icon: MapPin, label: "Roteirização", href: "/roteirizacao", permission: "roteirizacao.visualizar" },
  { icon: ListChecks, label: "Acompanhamento de Roteirizações", href: "/acompanhamento-roteirizacoes", permission: "roteirizacao.acompanhar" },
  { icon: LayoutDashboard, label: "__divider_3__", type: "divider" },
  // Consulta de Serviços
  { icon: ClipboardList, label: "Consulta Serviços", href: "/ordens-servico", permission: "os.visualizar" },
  { icon: Clock, label: "Consulta Turnos", href: "/consulta-turnos", permission: "os.turnos" },
  { icon: CheckSquare, label: "Consulta Checklists", href: "/consulta-checklists", permission: "os.checklists" },
  { icon: LayoutDashboard, label: "__divider_4__", type: "divider" },
  // Materiais - verifica módulo (qualquer permissão do módulo materiais)
  { icon: Package, label: "Materiais", href: "/materiais", module: "materiais" },
  { icon: LayoutDashboard, label: "__divider_5__", type: "divider" },
  // Cadastros - menu pai visível se tiver qualquer permissão de cadastros
  {
    icon: FolderOpen,
    label: "Cadastros",
    // Sem module aqui - a visibilidade é controlada pelos children
    children: [
      { icon: Users, label: "Equipes", href: "/equipes", permission: "cadastros.equipes" },
      { icon: Map, label: "Territórios", href: "/territorios", permission: "cadastros.territorios" },
      { icon: UserCheck, label: "Coordenadores e Supervisores", href: "/cadastros/coordenadores", permission: "cadastros.coordenadores" },
      { icon: Car, label: "Veículos", href: "/cadastros/veiculos", permission: "cadastros.veiculos" },
      { icon: Target, label: "Metas", href: "/cadastros/metas", permission: "cadastros.metas" },
    ],
  },
  { icon: LayoutDashboard, label: "__divider_6__", type: "divider" },
  // Admin - visível se tiver qualquer permissão admin.* (controlado pelos children)
  {
    icon: Shield,
    label: "Admin",
    // Removido requireAdmin - agora é controlado pelas permissões dos itens filhos
    children: [
      { icon: Building2, label: "Contratos", href: "/admin/contratos", permission: "admin.contratos" },
      { icon: Users, label: "Usuários Web", href: "/admin/usuarios-web", permission: "admin.usuarios_web" },
      { icon: UserCheck, label: "Colaboradores", href: "/admin/colaboradores", permission: "admin.usuarios_app" },
      { icon: Lock, label: "Permissões", href: "/admin/permissoes", permission: "admin.permissoes" },
      { icon: Database, label: "Cadastros Base", href: "/admin/cadastros-base", permission: "admin.cadastros_base" },
      { icon: ScrollText, label: "Procedimentos", href: "/admin/procedimentos", permission: "admin.procedimentos" },
      { icon: ClipboardList, label: "Checklists", href: "/admin/checklists", permission: "admin.checklists" },
      { icon: History, label: "Logs", href: "/admin/logs", permission: "admin.logs" },
    ],
  },
];

interface SidebarProps {
  isDark: boolean;
  setIsDark: (value: boolean) => void;
  collapsed?: boolean;
}

export function Sidebar({ isDark, setIsDark, collapsed = false }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut: authSignOut } = useAuth();
  const { usuarioWeb, signOut: webSignOut, isAdmin, hasPermission, hasModuleAccess } = useWebAuth();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Filtrar itens de navegação baseado nas permissões
  const navItems = useMemo(() => {
    return navItemsConfig.filter((item) => {
      // Divisores sempre aparecem (serão filtrados depois se não tiverem itens adjacentes)
      if (item.type === "divider") return true;
      
      // Se requer admin e não é admin, esconde
      if (item.requireAdmin && !isAdmin) return false;
      
      // Se tem permissão específica, verificar
      if (item.permission && !hasPermission(item.permission)) return false;
      
      // Se tem módulo, verificar acesso ao módulo
      if (item.module && !hasModuleAccess(item.module)) return false;
      
      // Se tem children, filtrar os children também
      if (item.children) {
        const visibleChildren = item.children.filter((child) => {
          if (child.permission && !hasPermission(child.permission)) return false;
          return true;
        });
        // Se não sobrar nenhum child visível, esconde o menu pai
        if (visibleChildren.length === 0) return false;
      }
      
      return true;
    }).map((item) => {
      // Filtrar children das permissões também
      if (item.children) {
        return {
          ...item,
          children: item.children.filter((child) => {
            if (child.permission && !hasPermission(child.permission)) return false;
            return true;
          }),
        };
      }
      return item;
    });
  }, [isAdmin, hasPermission, hasModuleAccess]);

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  // Toggle de menu expansível
  const toggleMenu = (menuLabel: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuLabel]: !prev[menuLabel],
    }));
  };

  // Manter menus abertos se algum item filho estiver ativo
  useEffect(() => {
    const menusWithChildren = navItems.filter((item) => item.children);
    menusWithChildren.forEach((menu) => {
      if (menu.children) {
        const hasActiveChild = menu.children.some((child) => {
          if (!child.href) return false;
          if (child.href === "/") return location.pathname === "/";
          return location.pathname.startsWith(child.href);
        });
        if (hasActiveChild) {
          setOpenMenus((prev) => ({ ...prev, [menu.label]: true }));
        }
      }
    });
  }, [location.pathname, navItems]);

  const handleLogout = async () => {
    // Faz logout de ambos os sistemas
    webSignOut();
    await authSignOut();
    navigate("/login");
  };

  // Get user initials and display name - prioriza usuário web
  const userEmail = usuarioWeb?.email || user?.email || "";
  const userName = usuarioWeb?.nome || user?.user_metadata?.nome_completo || userEmail.split("@")[0];
  const userCargo = usuarioWeb?.cargo || "";
  const userPerfil = usuarioWeb?.perfil?.nome || "";
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
        {navItems.map((item, index) => {
          if (item.type === "divider") {
            // Verificar se há itens visíveis antes e depois do divisor
            const prevItem = navItems[index - 1];
            const nextItem = navItems[index + 1];
            
            // Esconder divisor se não há itens adjacentes visíveis
            if (!prevItem || prevItem.type === "divider" || !nextItem || nextItem.type === "divider") {
              return null;
            }
            
            return (
              <div
                key={item.label}
                className={cn(
                  "my-4 h-[1px] bg-sidebar-border",
                  collapsed ? "mx-2" : "mx-3"
                )}
              />
            );
          }

          if (item.children) {
            const isOpen = openMenus[item.label] || false;
            
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
                open={isOpen}
                onOpenChange={() => toggleMenu(item.label)}
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
                    {isOpen ? (
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

          if (collapsed) {
            return (
              <Link
                key={item.href}
                to={item.href || "/"}
                className={cn(
                  "nav-item justify-center text-sidebar-foreground",
                  isActive(item.href) && "active"
                )}
                title={item.label}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              to={item.href || "/"}
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
      <div className={cn(
        "border-t border-sidebar-border p-3 space-y-3",
        collapsed && "flex flex-col items-center"
      )}>
        <button
          onClick={() => setIsDark(!isDark)}
          className={cn(
            "nav-item text-sidebar-foreground w-full",
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
            <p className="text-xs text-muted-foreground truncate">{userPerfil || userCargo || userEmail}</p>
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
