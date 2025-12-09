import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const data = [
  { hour: "07h", servicos: 15, meta: 50 },
  { hour: "08h", servicos: 45, meta: 50 },
  { hour: "09h", servicos: 62, meta: 50 },
  { hour: "10h", servicos: 58, meta: 50 },
  { hour: "11h", servicos: 55, meta: 50 },
  { hour: "12h", servicos: 25, meta: 50 },
  { hour: "13h", servicos: 35, meta: 50 },
  { hour: "14h", servicos: 72, meta: 50 },
  { hour: "15h", servicos: 68, meta: 50 },
  { hour: "16h", servicos: 55, meta: 50 },
  { hour: "17h", servicos: 33, meta: 50 },
];

export function ProductivityChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Produtividade por Hora</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Serviços</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-6 bg-warning" />
            <span className="text-muted-foreground">Meta</span>
          </div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorServicos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="hour"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <ReferenceLine
              y={50}
              stroke="hsl(38, 92%, 50%)"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="servicos"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorServicos)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
