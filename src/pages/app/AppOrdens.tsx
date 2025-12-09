import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, ChevronRight, Search, Clock } from "lucide-react";
import { format } from "date-fns";

const statusConfig = {
  pendente: { label: "Pendente", variant: "secondary" as const },
  em_andamento: { label: "Em Andamento", variant: "default" as const },
  concluida: { label: "Concluída", variant: "outline" as const },
  cancelada: { label: "Cancelada", variant: "destructive" as const },
};

export default function AppOrdens() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todas");

  const { data: ordens, isLoading } = useQuery({
    queryKey: ["ordens-app"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredOrdens = ordens?.filter((ordem) => {
    const matchesSearch =
      ordem.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ordem.endereco.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ordem.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ordem.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    if (activeTab === "todas") return matchesSearch;
    if (activeTab === "pendentes") return matchesSearch && ordem.status === "pendente";
    if (activeTab === "andamento") return matchesSearch && ordem.status === "em_andamento";
    if (activeTab === "concluidas") return matchesSearch && ordem.status === "concluida";

    return matchesSearch;
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Minhas Ordens</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por número, endereço..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todas" className="text-xs">Todas</TabsTrigger>
          <TabsTrigger value="pendentes" className="text-xs">Pendentes</TabsTrigger>
          <TabsTrigger value="andamento" className="text-xs">Andamento</TabsTrigger>
          <TabsTrigger value="concluidas" className="text-xs">Concluídas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lista */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredOrdens?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma ordem encontrada
          </div>
        ) : (
          filteredOrdens?.map((ordem) => (
            <Card
              key={ordem.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/app/ordens/${ordem.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={statusConfig[ordem.status as keyof typeof statusConfig]?.variant || "secondary"}>
                        {statusConfig[ordem.status as keyof typeof statusConfig]?.label || ordem.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {ordem.numero}
                      </span>
                    </div>
                    <p className="font-medium text-foreground">{ordem.tipo}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{ordem.endereco}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(ordem.created_at), "dd/MM HH:mm")}
                      </span>
                      {ordem.cliente_nome && (
                        <span className="truncate">{ordem.cliente_nome}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
