import { Search, Calendar, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useWebAuth } from "@/contexts/WebAuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { navItemsConfig, NavItem, NavChild } from "./Sidebar";

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  showDatePicker?: boolean;
}

export function Header({ title, subtitle, breadcrumbs, showDatePicker = true }: HeaderProps) {
  const navigate = useNavigate();
  const { isAdmin, hasPermission, hasModuleAccess } = useWebAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Filtrar e achatat todas as telas disponíveis baseado nas permissões
  const availablePages = useMemo(() => {
    const pages: Array<{ label: string; href: string; group: string; icon: React.ElementType }> = [];

    navItemsConfig.forEach((item: NavItem) => {
      // Pular divisores
      if (item.type === "divider") return;

      // Verificar se o item pai tem permissão
      if (item.requireAdmin && !isAdmin) return;
      if (item.permission && !hasPermission(item.permission)) return;
      if (item.module && !hasModuleAccess(item.module)) return;

      // Se tem children, adicionar cada child
      if (item.children) {
        item.children.forEach((child: NavChild) => {
          if (!child.permission || hasPermission(child.permission)) {
            pages.push({
              label: child.label,
              href: child.href,
              group: item.label,
              icon: child.icon,
            });
          }
        });
      } else if (item.href) {
        // Se não tem children mas tem href, adicionar o próprio item
        pages.push({
          label: item.label,
          href: item.href,
          group: item.label,
          icon: item.icon,
        });
      }
    });

    return pages;
  }, [isAdmin, hasPermission, hasModuleAccess]);

  const handleSelectPage = (href: string) => {
    navigate(href);
    setSearchOpen(false);
  };

  // Agrupar páginas por grupo
  const groupedPages = useMemo(() => {
    const grouped: Record<string, typeof availablePages> = {};
    availablePages.forEach((page) => {
      if (!grouped[page.group]) {
        grouped[page.group] = [];
      }
      grouped[page.group].push(page);
    });
    return grouped;
  }, [availablePages]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6">
          {/* Left Section */}
          <div className="flex flex-col">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                {breadcrumbs.map((crumb, index) => (
                  <span key={index} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="h-3 w-3" />}
                    {crumb.href ? (
                      <a href={crumb.href} className="hover:text-foreground transition-colors">
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="text-foreground">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <div>
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar telas..."
                className="w-64 pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-border cursor-pointer"
                readOnly
                onClick={() => setSearchOpen(true)}
              />
            </div>

            {/* Date Picker */}
            {showDatePicker && (
              <Button variant="outline" className="hidden sm:flex gap-2">
                <Calendar className="h-4 w-4" />
                <span className="capitalize">{today}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Command Dialog para busca de telas */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Buscar telas..." />
        <CommandList>
          <CommandEmpty>Nenhuma tela encontrada.</CommandEmpty>
          {Object.entries(groupedPages).map(([group, pages]) => (
            <CommandGroup key={group} heading={group}>
              {pages.map((page) => {
                const Icon = page.icon;
                return (
                  <CommandItem
                    key={page.href}
                    value={`${page.label} ${group}`}
                    onSelect={() => handleSelectPage(page.href)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{page.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
