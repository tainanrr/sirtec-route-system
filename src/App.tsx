import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { EquipeAuthProvider, useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { TecnicoProvider } from "@/contexts/TecnicoContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roteirizacao from "./pages/Roteirizacao";
import Planejamentos from "./pages/Planejamentos";
import AcompanhamentoRoteirizacoes from "./pages/AcompanhamentoRoteirizacoes";
import TorreControle from "./pages/TorreControle";
import OrdensServico from "./pages/OrdensServico";
import Equipes from "./pages/Equipes";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";
import CadastroPontosSaida from "./pages/cadastros/CadastroPontosSaida";
import CadastroPoligonos from "./pages/cadastros/CadastroPoligonos";
import ChecklistsAvancado from "./pages/ChecklistsAvancado";
import Skills from "./pages/cadastros/Skills";
import CadastroTerritorios from "./pages/CadastroTerritorios";
import ConsultaChecklists from "./pages/ConsultaChecklists";
import ChecklistDetalhes from "./pages/ChecklistDetalhes";

// Módulo de Materiais
import MateriaisDashboard from "./pages/materiais/MateriaisDashboard";
import CatalogoMateriais from "./pages/materiais/CatalogoMateriais";
import EstoqueCentral from "./pages/materiais/EstoqueCentral";
import EntregasEquipes from "./pages/materiais/EntregasEquipes";
import Rastreabilidade from "./pages/materiais/Rastreabilidade";
import Movimentacoes from "./pages/materiais/Movimentacoes";
import RelatoriosMateriais from "./pages/materiais/RelatoriosMateriais";
import Recebimentos from "./pages/materiais/Recebimentos";
import AplicacoesOS from "./pages/materiais/AplicacoesOS";

// App Mobile
import AppLayout from "./pages/app/AppLayout";
import AppHome from "./pages/app/AppHome";
import AppOrdens from "./pages/app/AppOrdens";
import AppOrdemDetalhe from "./pages/app/AppOrdemDetalhe";
import AppAPR from "./pages/app/AppAPR";
import AppPerfil from "./pages/app/AppPerfil";
import AppLogin from "./pages/app/AppLogin";
import AppEstoque from "./pages/app/AppEstoque";
import AppMateriaisOS from "./pages/app/AppMateriaisOS";

const queryClient = new QueryClient();

// Componente para proteger rotas do app móvel
function AppProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useEquipeAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/app/login" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
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
            <Route path="/planejamentos" element={<ProtectedRoute><Planejamentos /></ProtectedRoute>} />
            <Route path="/acompanhamento-roteirizacoes" element={<ProtectedRoute><AcompanhamentoRoteirizacoes /></ProtectedRoute>} />
            <Route path="/torre-controle" element={<ProtectedRoute><TorreControle /></ProtectedRoute>} />
            <Route path="/ordens-servico" element={<ProtectedRoute><OrdensServico /></ProtectedRoute>} />
            <Route path="/equipes" element={<ProtectedRoute><Equipes /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/cadastros/pontos-saida" element={<ProtectedRoute><CadastroPontosSaida /></ProtectedRoute>} />
            <Route path="/cadastros/poligonos" element={<ProtectedRoute><CadastroPoligonos /></ProtectedRoute>} />
            <Route path="/cadastros/checklists" element={<ProtectedRoute><ChecklistsAvancado /></ProtectedRoute>} />
            <Route path="/cadastros/skills" element={<ProtectedRoute><Skills /></ProtectedRoute>} />
            <Route path="/territorios" element={<ProtectedRoute><CadastroTerritorios /></ProtectedRoute>} />
            <Route path="/consulta-checklists" element={<ProtectedRoute><ConsultaChecklists /></ProtectedRoute>} />
            <Route path="/consulta-checklists/:id" element={<ProtectedRoute><ChecklistDetalhes /></ProtectedRoute>} />

            {/* Rotas do Módulo de Materiais */}
            <Route path="/materiais" element={<ProtectedRoute><MateriaisDashboard /></ProtectedRoute>} />
            <Route path="/materiais/catalogo" element={<ProtectedRoute><CatalogoMateriais /></ProtectedRoute>} />
            <Route path="/materiais/estoque" element={<ProtectedRoute><EstoqueCentral /></ProtectedRoute>} />
            <Route path="/materiais/entregas" element={<ProtectedRoute><EntregasEquipes /></ProtectedRoute>} />
            <Route path="/materiais/rastreabilidade" element={<ProtectedRoute><Rastreabilidade /></ProtectedRoute>} />
            <Route path="/materiais/movimentacoes" element={<ProtectedRoute><Movimentacoes /></ProtectedRoute>} />
            <Route path="/materiais/recebimentos" element={<ProtectedRoute><Recebimentos /></ProtectedRoute>} />
            <Route path="/materiais/aplicacoes" element={<ProtectedRoute><AplicacoesOS /></ProtectedRoute>} />
            <Route path="/materiais/relatorios" element={<ProtectedRoute><RelatoriosMateriais /></ProtectedRoute>} />

            {/* Rotas do App Móvel */}
            <Route path="/app/login" element={
              <EquipeAuthProvider>
                <AppLogin />
              </EquipeAuthProvider>
            } />
            <Route path="/app" element={
              <EquipeAuthProvider>
                <AppProtectedRoute>
                  <TecnicoProvider>
                    <AppLayout />
                  </TecnicoProvider>
                </AppProtectedRoute>
              </EquipeAuthProvider>
            }>
              <Route index element={<AppHome />} />
              <Route path="ordens" element={<AppOrdens />} />
              <Route path="ordens/:id" element={<AppOrdemDetalhe />} />
              <Route path="ordens/:id/apr" element={<AppAPR />} />
              <Route path="ordens/:id/materiais" element={<AppMateriaisOS />} />
              <Route path="estoque" element={<AppEstoque />} />
              <Route path="perfil" element={<AppPerfil />} />
            </Route>

            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
