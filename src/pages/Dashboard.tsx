import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProgressChart } from "@/components/dashboard/ProgressChart";
import { ServiceTypeChart } from "@/components/dashboard/ServiceTypeChart";
import { ProductivityChart } from "@/components/dashboard/ProductivityChart";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { TopTeamsPanel } from "@/components/dashboard/TopTeamsPanel";
import { MapOverview } from "@/components/dashboard/MapOverview";
import {
  ClipboardList,
  CheckCircle2,
  RefreshCcw,
  AlertTriangle,
} from "lucide-react";

const Dashboard = () => {
  return (
    <MainLayout
      title="Dashboard"
      subtitle="Visão geral da operação"
      breadcrumbs={[{ label: "Dashboard" }]}
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon={ClipboardList}
          title="Total OS"
          value="847"
          trend="up"
          trendValue="12% vs ontem"
          color="primary"
        />
        <MetricCard
          icon={CheckCircle2}
          title="Concluídas"
          value="523"
          subtitle="61.7% do total"
          color="success"
        />
        <MetricCard
          icon={RefreshCcw}
          title="Em Andamento"
          value="89"
          subtitle="45 equipes ativas"
          color="secondary"
        />
        <MetricCard
          icon={AlertTriangle}
          title="Atrasadas"
          value="23"
          trend="down"
          trendValue="5% vs ontem"
          color="danger"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ProgressChart title="Progresso do Dia" current={523} goal={800} />
        <ServiceTypeChart />
      </div>

      {/* Productivity Chart */}
      <div className="mb-6">
        <ProductivityChart />
      </div>

      {/* Alerts & Ranking Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AlertsPanel />
        <TopTeamsPanel />
      </div>

      {/* Map Overview */}
      <MapOverview />
    </MainLayout>
  );
};

export default Dashboard;
