import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Phone,
  MessageSquare,
  Car,
  Coffee,
  AlertTriangle,
  WifiOff,
  MapPin,
  Edit,
  Trash2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TecnicoFormDialog } from "@/components/equipes/TecnicoFormDialog";
import type { Tables } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusConfig = {
  disponivel: { label: "Disponível", icon: Car, color: "bg-success", dotColor: "bg-success" },
  em_servico: { label: "Em Serviço", icon: MapPin, color: "bg-primary", dotColor: "bg-primary" },
  pausa: { label: "Pausa", icon: Coffee, color: "bg-warning", dotColor: "bg-warning" },
  offline: { label: "Offline", icon: WifiOff, color: "bg-muted", dotColor: "bg-muted-foreground" },
};

const Equipes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tecnicos, setTecnicos] = useState<Tables<"tecnicos">[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tables<"tecnicos"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tecnicoToDelete, setTecnicoToDelete] = useState<Tables<"tecnicos"> | null>(null);

  const fetchTecnicos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tecnicos")
      .select("*")
      .order("codigo");

    if (error) {
      toast.error("Erro ao carregar técnicos");
    } else {
      setTecnicos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTecnicos();
  }, []);

  const handleEdit = (tecnico: Tables<"tecnicos">) => {
    setSelectedTecnico(tecnico);
    setFormOpen(true);
  };

  const handleDuplicate = (tecnico: Tables<"tecnicos">) => {
    // Gerar código único para a cópia
    let novoCodigo = `${tecnico.codigo}-Copy`;
    let contador = 1;
    
    // Verificar se o código já existe e incrementar se necessário
    while (tecnicos.some(t => t.codigo === novoCodigo && t.id !== tecnico.id)) {
      novoCodigo = `${tecnico.codigo}-Copy${contador > 1 ? contador : ''}`;
      contador++;
    }
    
    // Criar uma cópia da equipe com código modificado
    // Criar um novo objeto com ID inválido para forçar criação de nova equipe
    const tecnicoDuplicado: Tables<"tecnicos"> = {
      ...tecnico,
      id: `temp-duplicate-${Date.now()}`, // ID temporário único que não existe no banco
      codigo: novoCodigo, // Código único
      nome: `${tecnico.nome} (Cópia)`, // Adicionar sufixo ao nome
      created_at: new Date().toISOString(), // Atualizar timestamp
      updated_at: new Date().toISOString(), // Atualizar timestamp
    };
    
    setSelectedTecnico(tecnicoDuplicado);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!tecnicoToDelete) return;

    const { error } = await supabase
      .from("tecnicos")
      .delete()
      .eq("id", tecnicoToDelete.id);

    if (error) {
      toast.error("Erro ao excluir técnico");
    } else {
      toast.success("Técnico excluído com sucesso");
      fetchTecnicos();
    }
    setDeleteDialogOpen(false);
    setTecnicoToDelete(null);
  };

  const filteredEquipes = tecnicos.filter((tecnico) => {
    const matchesSearch =
      tecnico.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tecnico.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || tecnico.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = tecnicos.reduce((acc, eq) => {
    acc[eq.status] = (acc[eq.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <MainLayout
      title="Equipes"
      subtitle="Monitoramento e gestão das equipes de campo"
      breadcrumbs={[{ label: "Equipes" }]}
    >
      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = statusCounts[key] || 0;
          return (
            <div
              key={key}
              className={cn(
                "rounded-xl border border-border bg-card p-4 flex items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors",
                statusFilter === key && "border-primary"
              )}
              onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}
            >
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", config.color + "/10")}>
                <config.icon className={cn("h-5 w-5", config.color.replace("bg-", "text-"))} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar equipe ou técnico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button className="gap-2" onClick={() => { setSelectedTecnico(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nova Equipe
          </Button>
        </div>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filteredEquipes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum técnico encontrado. Clique em "Nova Equipe" para cadastrar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEquipes.map((tecnico) => {
            const config = statusConfig[tecnico.status as keyof typeof statusConfig] || statusConfig.offline;

            return (
              <div
                key={tecnico.id}
                className="rounded-xl border bg-card p-5 transition-all hover:shadow-lg border-border"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        {tecnico.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className={cn("absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card", config.dotColor)} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{tecnico.codigo}</h3>
                      <p className="text-sm text-muted-foreground">
                        {tecnico.nome.split(/[\/,]/).map((nome, idx) => (
                          <span key={idx}>
                            {nome.trim()}
                            {idx === 0 && tecnico.nome.includes("/") && " / "}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                  <Badge variant={tecnico.status === "disponivel" || tecnico.status === "em_servico" ? "success" : "secondary"}>
                    {config.label}
                  </Badge>
                </div>

                {/* Info */}
                <div className="space-y-2 text-sm mb-4">
                  {tecnico.telefone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Telefone:</span>
                      <span className="text-foreground">{tecnico.telefone}</span>
                    </div>
                  )}
                  {tecnico.habilidades && tecnico.habilidades.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tecnico.habilidades.slice(0, 3).map((hab) => (
                        <Badge key={hab} variant="outline" className="text-xs">
                          {hab}
                        </Badge>
                      ))}
                      {tecnico.habilidades.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{tecnico.habilidades.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-border">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => handleEdit(tecnico)}>
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1" 
                    onClick={() => handleDuplicate(tecnico)}
                    title="Duplicar equipe"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicar
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => { setTecnicoToDelete(tecnico); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TecnicoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tecnico={selectedTecnico}
        onSuccess={fetchTecnicos}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir técnico</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o técnico {tecnicoToDelete?.nome}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Equipes;

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => { setTecnicoToDelete(tecnico); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TecnicoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tecnico={selectedTecnico}
        onSuccess={fetchTecnicos}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir técnico</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o técnico {tecnicoToDelete?.nome}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Equipes;
