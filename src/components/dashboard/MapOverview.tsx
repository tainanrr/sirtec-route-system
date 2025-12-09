import { MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function MapOverview() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Visão Geral das Equipes</h3>
        </div>
        <Button variant="ghost" size="sm" className="gap-1" asChild>
          <Link to="/torre-controle">
            Abrir Torre
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Map Placeholder */}
      <div className="relative h-64 bg-muted/30">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Mapa interativo</p>
            <p className="text-xs text-muted-foreground">Clique em "Abrir Torre" para visualizar</p>
          </div>
        </div>
        
        {/* Simulated markers */}
        <div className="absolute top-1/4 left-1/4 h-3 w-3 rounded-full bg-success animate-pulse" />
        <div className="absolute top-1/3 left-1/2 h-3 w-3 rounded-full bg-success animate-pulse" />
        <div className="absolute top-1/2 left-1/3 h-3 w-3 rounded-full bg-warning animate-pulse" />
        <div className="absolute top-2/3 right-1/4 h-3 w-3 rounded-full bg-danger animate-pulse" />
        <div className="absolute bottom-1/4 left-1/2 h-3 w-3 rounded-full bg-success animate-pulse" />
      </div>

      <div className="flex items-center justify-center gap-6 p-4 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-success" />
          <span className="text-sm text-muted-foreground">32 em rota</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-warning" />
          <span className="text-sm text-muted-foreground">8 em pausa</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-danger" />
          <span className="text-sm text-muted-foreground">5 com alertas</span>
        </div>
      </div>
    </div>
  );
}
