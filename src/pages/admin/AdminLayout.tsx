import { Outlet, useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";

// Mapeamento de paths para labels de breadcrumb
const pathLabels: Record<string, string> = {
  "contratos": "Contratos",
  "usuarios-web": "Usuários Web",
  "usuarios-app": "Usuários App",
  "permissoes": "Permissões",
  "cadastros-base": "Cadastros Base",
  "procedimentos": "Procedimentos",
  "checklists": "Checklists",
  "logs": "Logs",
};

export default function AdminLayout() {
  const location = useLocation();

  // Extrair a subpágina atual do path
  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentPage = pathParts.length > 1 ? pathParts[1] : null;
  const pageLabel = currentPage ? pathLabels[currentPage] : null;

  return (
    <MainLayout
      title={pageLabel || "Administração"}
      subtitle={pageLabel ? "Configurações avançadas do sistema" : "Selecione uma opção no menu"}
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        ...(pageLabel ? [{ label: pageLabel }] : []),
      ]}
    >
      <Outlet />
    </MainLayout>
  );
}

