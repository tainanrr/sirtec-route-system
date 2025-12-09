import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Team {
  rank: number;
  code: string;
  name: string;
  completed: number;
  total: number;
}

const teams: Team[] = [
  { rank: 1, code: "EQ-007", name: "Carlos Santos", completed: 18, total: 18 },
  { rank: 2, code: "EQ-023", name: "Ana Costa", completed: 16, total: 18 },
  { rank: 3, code: "EQ-001", name: "João Silva", completed: 14, total: 17 },
  { rank: 4, code: "EQ-015", name: "Pedro Lima", completed: 12, total: 16 },
  { rank: 5, code: "EQ-009", name: "Maria Souza", completed: 10, total: 15 },
];

const rankColors = ["text-warning", "text-muted-foreground", "text-amber-600"];

export function TopTeamsPanel() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-warning" />
        <h3 className="text-lg font-semibold text-foreground">Top Equipes do Dia</h3>
      </div>

      <div className="space-y-4">
        {teams.map((team) => (
          <div key={team.code} className="flex items-center gap-4">
            <span
              className={`text-lg font-bold w-6 ${
                team.rank <= 3 ? rankColors[team.rank - 1] : "text-muted-foreground"
              }`}
            >
              {team.rank}.
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-foreground text-sm">{team.code}</span>
                <span className="text-sm text-muted-foreground">{team.completed} OS</span>
              </div>
              <Progress
                value={(team.completed / team.total) * 100}
                className="h-2"
              />
            </div>
          </div>
        ))}
      </div>

      <Button variant="ghost" className="w-full mt-4 text-sm">
        Ver ranking completo →
      </Button>
    </div>
  );
}
