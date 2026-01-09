import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WebAuthProvider } from "@/contexts/WebAuthContext";
import { EquipeAuthProvider, useEquipeAuth } from "@/contexts/EquipeAuthContext";
import { TecnicoProvider } from "@/contexts/TecnicoContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PermissoesProvider } from "@/hooks/usePermissoes";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roteirizacao from "./pages/Roteirizacao";
import Planejamentos from "./pages/Planejamentos";
import AcompanhamentoRoteirizacoes from "./pages/AcompanhamentoRoteirizacoes";
import AcompanhamentoTempoReal from "./pages/AcompanhamentoTempoReal";
import OrdensServico from "./pages/OrdensServico";
import Equipes from "./pages/Equipes";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";
import CadastroPontosSaida from "./pages/cadastros/CadastroPontosSaida";
import CadastroPoligonos from "./pages/cadastros/CadastroPoligonos";
import CadastroCoordenadores from "./pages/cadastros/CadastroCoordenadores";
import CadastroVeiculos from "./pages/cadastros/CadastroVeiculos";
import CadastroMetas from "./pages/cadastros/CadastroMetas";
import DashboardProducaoMeta from "./pages/DashboardProducaoMeta";
import DashboardAssertividade from "./pages/DashboardAssertividade";
import DashboardTempoOcioso from "./pages/DashboardTempoOcioso";
import ChecklistsAvancado from "./pages/ChecklistsAvancado";
// Skills foi migrado para Cadastros Base - Tipos de Serviço
import CadastroTerritorios from "./pages/CadastroTerritorios";
import ConsultaChecklists from "./pages/ConsultaChecklists";
import ChecklistDetalhes from "./pages/ChecklistDetalhes";
import ConsultaTurnos from "./pages/ConsultaTurnos";

// Módulo Admin
import {
  AdminLayout,
  AdminContratos,
  AdminUsuariosWeb,
  AdminUsuariosApp,
  AdminColaboradores,
  AdminPermissoes,
  AdminLogs,
  AdminCadastrosBase,
  AdminProcedimentos,
} from "./pages/admin";

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
import Devolucoes from "./pages/materiais/Devolucoes";

// App Mobile
import AppLayout from "./pages/app/AppLayout";
import AppHome from "./pages/app/AppHome";
import AppOrdens from "./pages/app/AppOrdens";
import AppOrdemDetalhe from "./pages/app/AppOrdemDetalhe";
import AppAPR from "./pages/app/AppAPR";
import AppResultados from "./pages/app/AppResultados";
import AppLogin from "./pages/app/AppLogin";
import AppAbrirTurno from "./pages/app/AppAbrirTurno";
import AppEstoque from "./pages/app/AppEstoque";
import AppMateriaisOS from "./pages/app/AppMateriaisOS";
import AppDevolucoes from "./pages/app/AppDevolucoes";
import AppProcedimentos from "./pages/app/AppProcedimentos";
import AppProcedimentoDetalhe from "./pages/app/AppProcedimentoDetalhe";
import AppChat from "./pages/app/AppChat";

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
        <WebAuthProvider>
          <PermissoesProvider>
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
            <Route path="/acompanhamento-tempo-real" element={<ProtectedRoute><AcompanhamentoTempoReal /></ProtectedRoute>} />
            <Route path="/ordens-servico" element={<ProtectedRoute><OrdensServico /></ProtectedRoute>} />
            <Route path="/consulta-turnos" element={<ProtectedRoute><ConsultaTurnos /></ProtectedRoute>} />
            <Route path="/equipes" element={<ProtectedRoute><Equipes /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/cadastros/pontos-saida" element={<ProtectedRoute><CadastroPontosSaida /></ProtectedRoute>} />
            <Route path="/cadastros/poligonos" element={<ProtectedRoute><CadastroPoligonos /></ProtectedRoute>} />
            <Route path="/cadastros/checklists" element={<ProtectedRoute><ChecklistsAvancado /></ProtectedRoute>} />
            <Route path="/cadastros/skills" element={<Navigate to="/admin/cadastros-base?tab=tipos-servico" replace />} />
            <Route path="/territorios" element={<ProtectedRoute><CadastroTerritorios /></ProtectedRoute>} />
            <Route path="/cadastros/coordenadores" element={<ProtectedRoute><CadastroCoordenadores /></ProtectedRoute>} />
            <Route path="/cadastros/veiculos" element={<ProtectedRoute><CadastroVeiculos /></ProtectedRoute>} />
            <Route path="/cadastros/metas" element={<ProtectedRoute><CadastroMetas /></ProtectedRoute>} />
            <Route path="/dashboard/producao-meta" element={<ProtectedRoute><DashboardProducaoMeta /></ProtectedRoute>} />
            <Route path="/dashboard/assertividade" element={<ProtectedRoute><DashboardAssertividade /></ProtectedRoute>} />
            <Route path="/dashboard/tempo-ocioso" element={<ProtectedRoute><DashboardTempoOcioso /></ProtectedRoute>} />
            <Route path="/consulta-checklists" element={<ProtectedRoute><ConsultaChecklists /></ProtectedRoute>} />
            <Route path="/consulta-checklists/:id" element={<ProtectedRoute><ChecklistDetalhes /></ProtectedRoute>} />

            {/* Rotas do Módulo Admin */}
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={null} />
              <Route path="contratos" element={<AdminContratos />} />
              <Route path="usuarios-web" element={<AdminUsuariosWeb />} />
              <Route path="usuarios-app" element={<AdminUsuariosApp />} />
              <Route path="colaboradores" element={<AdminColaboradores />} />
              <Route path="permissoes" element={<AdminPermissoes />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="cadastros-base" element={<AdminCadastrosBase />} />
              <Route path="procedimentos" element={<AdminProcedimentos />} />
              <Route path="checklists" element={<ChecklistsAvancado />} />
            </Route>

            {/* Rotas do Módulo de Materiais */}
            <Route path="/materiais" element={<ProtectedRoute><MateriaisDashboard /></ProtectedRoute>} />
            <Route path="/materiais/catalogo" element={<ProtectedRoute><CatalogoMateriais /></ProtectedRoute>} />
            <Route path="/materiais/estoque" element={<ProtectedRoute><EstoqueCentral /></ProtectedRoute>} />
            <Route path="/materiais/entregas" element={<ProtectedRoute><EntregasEquipes /></ProtectedRoute>} />
            <Route path="/materiais/rastreabilidade" element={<ProtectedRoute><Rastreabilidade /></ProtectedRoute>} />
            <Route path="/materiais/movimentacoes" element={<ProtectedRoute><Movimentacoes /></ProtectedRoute>} />
            <Route path="/materiais/recebimentos" element={<ProtectedRoute><Recebimentos /></ProtectedRoute>} />
            <Route path="/materiais/devolucoes" element={<ProtectedRoute><Devolucoes /></ProtectedRoute>} />
            <Route path="/materiais/aplicacoes" element={<ProtectedRoute><AplicacoesOS /></ProtectedRoute>} />
            <Route path="/materiais/relatorios" element={<ProtectedRoute><RelatoriosMateriais /></ProtectedRoute>} />

            {/* Rotas do App Móvel */}
            <Route path="/app/login" element={
              <EquipeAuthProvider>
                <AppLogin />
              </EquipeAuthProvider>
            } />
            <Route path="/app/abrir-turno" element={
              <EquipeAuthProvider>
                <AppAbrirTurno />
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
              <Route path="estoque/devolucoes" element={<AppDevolucoes />} />
              <Route path="procedimentos" element={<AppProcedimentos />} />
              <Route path="procedimentos/:id" element={<AppProcedimentoDetalhe />} />
              <Route path="chat" element={<AppChat />} />
              <Route path="resultados" element={<AppResultados />} />
            </Route>

            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
          </PermissoesProvider>
        </WebAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
