import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roteirizacao from "./pages/Roteirizacao";
import TorreControle from "./pages/TorreControle";
import OrdensServico from "./pages/OrdensServico";
import Equipes from "./pages/Equipes";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";
import CadastroTecnicos from "./pages/cadastros/CadastroTecnicos";
import CadastroPontosSaida from "./pages/cadastros/CadastroPontosSaida";
import CadastroPoligonos from "./pages/cadastros/CadastroPoligonos";
import CadastroChecklists from "./pages/cadastros/CadastroChecklists";

// App Mobile
import AppLayout from "./pages/app/AppLayout";
import AppHome from "./pages/app/AppHome";
import AppOrdens from "./pages/app/AppOrdens";
import AppOrdemDetalhe from "./pages/app/AppOrdemDetalhe";
import AppPerfil from "./pages/app/AppPerfil";
import AppLogin from "./pages/app/AppLogin";

const queryClient = new QueryClient();

// Componente para proteger rotas do app móvel
function AppProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/app/login" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rotas do Painel Admin */}
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/roteirizacao" element={<ProtectedRoute><Roteirizacao /></ProtectedRoute>} />
            <Route path="/torre-controle" element={<ProtectedRoute><TorreControle /></ProtectedRoute>} />
            <Route path="/ordens-servico" element={<ProtectedRoute><OrdensServico /></ProtectedRoute>} />
            <Route path="/equipes" element={<ProtectedRoute><Equipes /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/cadastros/tecnicos" element={<ProtectedRoute><CadastroTecnicos /></ProtectedRoute>} />
            <Route path="/cadastros/pontos-saida" element={<ProtectedRoute><CadastroPontosSaida /></ProtectedRoute>} />
            <Route path="/cadastros/poligonos" element={<ProtectedRoute><CadastroPoligonos /></ProtectedRoute>} />
            <Route path="/cadastros/checklists" element={<ProtectedRoute><CadastroChecklists /></ProtectedRoute>} />

            {/* Rotas do App Móvel */}
            <Route path="/app/login" element={<AppLogin />} />
            <Route path="/app" element={<AppProtectedRoute><AppLayout /></AppProtectedRoute>}>
              <Route index element={<AppHome />} />
              <Route path="ordens" element={<AppOrdens />} />
              <Route path="ordens/:id" element={<AppOrdemDetalhe />} />
              <Route path="perfil" element={<AppPerfil />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
