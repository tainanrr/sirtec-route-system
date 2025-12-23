import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWebAuth } from "@/contexts/WebAuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { usuarioWeb, loading: webLoading } = useWebAuth();
  const location = useLocation();

  const loading = authLoading || webLoading;
  const isAuthenticated = !!user || !!usuarioWeb;

  console.log("[ProtectedRoute] Estado:", { 
    loading, 
    hasUser: !!user, 
    hasUsuarioWeb: !!usuarioWeb,
    isAuthenticated,
    path: location.pathname 
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Carregando...</p>
          <p className="text-xs text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
