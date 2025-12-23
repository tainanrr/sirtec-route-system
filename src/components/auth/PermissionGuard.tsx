import { ReactNode } from "react";
import { useWebAuth } from "@/contexts/WebAuthContext";
import { Shield, Lock } from "lucide-react";

interface PermissionGuardProps {
  children: ReactNode;
  /** Código da permissão necessária */
  permission?: string;
  /** Lista de códigos de permissão (basta ter uma delas) */
  anyPermission?: string[];
  /** Módulo que precisa ter acesso */
  module?: string;
  /** Requer que seja admin */
  requireAdmin?: boolean;
  /** Componente a exibir quando não autorizado (se não informado, exibe mensagem padrão) */
  fallback?: ReactNode;
  /** Se true, não renderiza nada quando não autorizado (em vez de mostrar mensagem) */
  hideWhenUnauthorized?: boolean;
}

/**
 * Componente para controlar acesso baseado em permissões
 * Exemplo de uso:
 * 
 * <PermissionGuard permission="admin.usuarios_web">
 *   <ComponenteRestrito />
 * </PermissionGuard>
 * 
 * <PermissionGuard module="admin">
 *   <MenuAdmin />
 * </PermissionGuard>
 * 
 * <PermissionGuard requireAdmin>
 *   <ConfiguracoesAvancadas />
 * </PermissionGuard>
 */
export function PermissionGuard({
  children,
  permission,
  anyPermission,
  module,
  requireAdmin,
  fallback,
  hideWhenUnauthorized = false,
}: PermissionGuardProps) {
  const { isAdmin, hasPermission, hasAnyPermission, hasModuleAccess, isAuthenticated } = useWebAuth();

  // Se não está autenticado, não renderiza nada
  if (!isAuthenticated) {
    return null;
  }

  // Verificar autorização
  let isAuthorized = true;

  if (requireAdmin) {
    isAuthorized = isAdmin;
  } else if (permission) {
    isAuthorized = hasPermission(permission);
  } else if (anyPermission && anyPermission.length > 0) {
    isAuthorized = hasAnyPermission(anyPermission);
  } else if (module) {
    isAuthorized = hasModuleAccess(module);
  }

  // Se autorizado, renderiza o conteúdo
  if (isAuthorized) {
    return <>{children}</>;
  }

  // Se não autorizado e deve esconder
  if (hideWhenUnauthorized) {
    return null;
  }

  // Se tem fallback customizado
  if (fallback) {
    return <>{fallback}</>;
  }

  // Fallback padrão - mensagem de acesso negado
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-red-100 p-4 mb-4">
        <Lock className="h-8 w-8 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Acesso Restrito
      </h3>
      <p className="text-gray-500 max-w-md">
        Você não tem permissão para acessar este conteúdo. 
        Entre em contato com o administrador se precisar de acesso.
      </p>
    </div>
  );
}

/**
 * Hook para usar verificação de permissão em qualquer lugar
 */
export function usePermission(permission: string): boolean {
  const { hasPermission } = useWebAuth();
  return hasPermission(permission);
}

/**
 * Hook para verificar se é admin
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = useWebAuth();
  return isAdmin;
}

