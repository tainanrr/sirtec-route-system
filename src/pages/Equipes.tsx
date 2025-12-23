import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Copy,
  Clock,
  User,
  X,
  Check,
  CheckCircle,
  XCircle,
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

// Interface para colaborador
interface Colaborador {
  id: string;
  cpf: string;
  nome: string;
  cargo: string | null;
  ativo: boolean;
}

// Interface para equipe com colaboradores
interface EquipeColaborador {
  id: string;
  colaborador_id: string;
  funcao: string;
  colaborador: Colaborador;
}

interface EquipeComColaboradores extends Tables<"tecnicos"> {
  colaboradores?: EquipeColaborador[];
}

const statusConfig = {
  disponivel: { label: "Ativa", icon: CheckCircle, color: "bg-success", dotColor: "bg-success" },
  offline: { label: "Inativa", icon: XCircle, color: "bg-muted", dotColor: "bg-muted-foreground" },
};

const Equipes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tecnicos, setTecnicos] = useState<EquipeComColaboradores[]>([]);
  const [todosColaboradores, setTodosColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tables<"tecnicos"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tecnicoToDelete, setTecnicoToDelete] = useState<Tables<"tecnicos"> | null>(null);
  
  // Estados para edição inline
  const [editingJornada, setEditingJornada] = useState<string | null>(null);
  const [jornadaValue, setJornadaValue] = useState("");

  // Buscar todos os colaboradores disponíveis
  const fetchTodosColaboradores = async () => {
    const { data, error } = await supabase
      .from("colaboradores")
      .select("id, cpf, nome, cargo, ativo")
      .eq("ativo", true)
      .order("nome");

    if (!error && data) {
      setTodosColaboradores(data);
    }
  };

  const fetchTecnicos = async () => {
    setLoading(true);
    
    // Buscar técnicos
    const { data: tecnicosData, error: tecnicosError } = await supabase
      .from("tecnicos")
      .select("*")
      .order("codigo");

    if (tecnicosError) {
      toast.error("Erro ao carregar técnicos");
      setLoading(false);
      return;
    }

    // Buscar colaboradores de cada equipe
    const { data: equipesColabs, error: colabsError } = await supabase
      .from("equipe_colaboradores")
      .select(`
        id,
        equipe_id,
        colaborador_id,
        funcao,
        ativo,
        colaboradores:colaborador_id (id, cpf, nome, cargo, ativo)
      `)
      .eq("ativo", true);

    if (colabsError) {
      console.error("Erro ao carregar colaboradores:", colabsError);
    }

    // Mapear colaboradores para cada equipe
    const tecnicosComColabs: EquipeComColaboradores[] = (tecnicosData || []).map(tecnico => {
      const colabs = (equipesColabs || [])
        .filter((ec: any) => ec.equipe_id === tecnico.id)
        .map((ec: any) => ({
          id: ec.id,
          colaborador_id: ec.colaborador_id,
          funcao: ec.funcao,
          colaborador: ec.colaboradores,
        }));

      return {
        ...tecnico,
        colaboradores: colabs,
      };
    });

    setTecnicos(tecnicosComColabs);
    setLoading(false);
  };

  useEffect(() => {
    fetchTecnicos();
    fetchTodosColaboradores();
  }, []);

  const handleEdit = (tecnico: Tables<"tecnicos">) => {
    setSelectedTecnico(tecnico);
    setFormOpen(true);
  };

  const handleDuplicate = (tecnico: Tables<"tecnicos">) => {
    let novoCodigo = `${tecnico.codigo}-Copy`;
    let contador = 1;
    
    while (tecnicos.some(t => t.codigo === novoCodigo && t.id !== tecnico.id)) {
      novoCodigo = `${tecnico.codigo}-Copy${contador > 1 ? contador : ''}`;
      contador++;
    }
    
    const tecnicoDuplicado: Tables<"tecnicos"> = {
      ...tecnico,
      id: `temp-duplicate-${Date.now()}`,
      codigo: novoCodigo,
      nome: `${tecnico.nome} (Cópia)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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

  // Atualizar jornada inline
  const handleSaveJornada = async (tecnicoId: string) => {
    if (!jornadaValue) return;

    const { error } = await supabase
      .from("tecnicos")
      .update({ hora_inicio: jornadaValue })
      .eq("id", tecnicoId);

    if (error) {
      toast.error("Erro ao atualizar jornada");
    } else {
      toast.success("Jornada atualizada");
      fetchTecnicos();
    }
    setEditingJornada(null);
  };

  // Atualizar status inline
  const handleToggleStatus = async (tecnicoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "disponivel" ? "offline" : "disponivel";
    
    const { error } = await supabase
      .from("tecnicos")
      .update({ status: newStatus })
      .eq("id", tecnicoId);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(newStatus === "disponivel" ? "Equipe ativada" : "Equipe inativada");
      fetchTecnicos();
    }
  };

  // Adicionar colaborador à equipe
  const handleAddColaborador = async (equipeId: string, colaboradorId: string, slotIndex: number) => {
    const equipe = tecnicos.find(t => t.id === equipeId);
    if (!equipe) return;

    // Verificar se já tem um colaborador no slot
    const colabNoSlot = equipe.colaboradores?.[slotIndex];
    
    if (colabNoSlot) {
      // Remover colaborador existente
      await supabase
        .from("equipe_colaboradores")
        .update({ ativo: false, data_fim: new Date().toISOString().split("T")[0] })
        .eq("id", colabNoSlot.id);
    }

    // Adicionar novo colaborador
    const { error } = await supabase
      .from("equipe_colaboradores")
      .insert({
        equipe_id: equipeId,
        colaborador_id: colaboradorId,
        funcao: slotIndex === 0 ? "lider" : "membro",
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("Colaborador já está vinculado a esta equipe");
      } else {
        toast.error("Erro ao adicionar colaborador");
      }
    } else {
      toast.success("Colaborador vinculado");
      fetchTecnicos();
    }
  };

  // Remover colaborador da equipe
  const handleRemoveColaborador = async (equipeColaboradorId: string) => {
    const { error } = await supabase
      .from("equipe_colaboradores")
      .update({ ativo: false, data_fim: new Date().toISOString().split("T")[0] })
      .eq("id", equipeColaboradorId);

    if (error) {
      toast.error("Erro ao remover colaborador");
    } else {
      toast.success("Colaborador removido");
      fetchTecnicos();
    }
  };

  // Colaboradores disponíveis (não vinculados à equipe)
  const getColaboradoresDisponiveis = (equipeId: string, searchTerm: string = "") => {
    const equipe = tecnicos.find(t => t.id === equipeId);
    const colabsEquipe = equipe?.colaboradores?.map(c => c.colaborador_id) || [];
    
    return todosColaboradores.filter(c => 
      !colabsEquipe.includes(c.id) &&
      (searchTerm === "" || 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cpf.includes(searchTerm))
    );
  };

  const filteredEquipes = tecnicos.filter((tecnico) => {
    const matchesSearch =
      tecnico.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tecnico.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tecnico.colaboradores?.some(c => 
        c.colaborador?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    // Normalizar status para filtro
    const normalizedStatus = tecnico.status === "offline" ? "offline" : "disponivel";
    const matchesStatus = statusFilter === "all" || normalizedStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Normalizar status para contagem (antigos status são considerados como "disponivel")
  const statusCounts = tecnicos.reduce((acc, eq) => {
    const normalizedStatus = eq.status === "offline" ? "offline" : "disponivel";
    acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Componente para célula de colaborador com edição inline
  const ColaboradorCell = ({ 
    equipe, 
    slotIndex, 
    label 
  }: { 
    equipe: EquipeComColaboradores; 
    slotIndex: number; 
    label: string;
  }) => {
    const colaborador = equipe.colaboradores?.[slotIndex];
    const [open, setOpen] = useState(false);
    const [localSearch, setLocalSearch] = useState("");

    const colaboradoresDisponiveis = getColaboradoresDisponiveis(equipe.id, localSearch);

    return (
      <Popover 
        open={open} 
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setLocalSearch("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <div 
            className={cn(
              "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors min-h-[40px]",
              colaborador 
                ? "bg-muted/50 hover:bg-muted" 
                : "border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
            )}
          >
            {colaborador ? (
              <>
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                  {colaborador.colaborador?.nome?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{colaborador.colaborador?.nome?.split(" ")[0]}</p>
                  <p className="text-xs text-muted-foreground capitalize">{colaborador.funcao}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveColaborador(colaborador.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-72 p-2" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="h-8 pl-7 text-sm"
                autoFocus
              />
            </div>
            <div className="text-xs text-muted-foreground px-1">
              {colaboradoresDisponiveis.length} colaborador(es) disponível(is)
            </div>
            <ScrollArea className="h-52">
              <div className="space-y-1">
                {colaboradoresDisponiveis.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                    onClick={() => {
                      handleAddColaborador(equipe.id, c.id, slotIndex);
                      setOpen(false);
                      setLocalSearch("");
                    }}
                  >
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                      {c.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">{c.cargo || "Sem cargo"}</p>
                    </div>
                  </div>
                ))}
                {colaboradoresDisponiveis.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum colaborador encontrado
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

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
              placeholder="Buscar equipe ou colaborador..."
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

      {/* Teams Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filteredEquipes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum técnico encontrado. Clique em "Nova Equipe" para cadastrar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead className="w-[100px]">Jornada</TableHead>
                  <TableHead className="w-[180px]">Colaborador 1</TableHead>
                  <TableHead className="w-[180px]">Colaborador 2</TableHead>
                  <TableHead className="w-[180px]">Colaborador 3</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Habilidades</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipes.map((tecnico) => {
                  // Normalizar status para exibição
                  const normalizedStatus = tecnico.status === "offline" ? "offline" : "disponivel";
                  const config = statusConfig[normalizedStatus as keyof typeof statusConfig];
                  const horaInicio = (tecnico as any).hora_inicio || "07:30";
                  const isAtivo = normalizedStatus === "disponivel";

                  return (
                    <TableRow key={tecnico.id} className="group">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                              {tecnico.codigo.slice(0, 2)}
                            </div>
                            <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card", config.dotColor)} />
                          </div>
                          <span>{tecnico.codigo}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingJornada === tecnico.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="time"
                              value={jornadaValue}
                              onChange={(e) => setJornadaValue(e.target.value)}
                              className="h-8 w-24 text-sm"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleSaveJornada(tecnico.id)}
                            >
                              <Check className="h-3 w-3 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setEditingJornada(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 p-1.5 rounded-md transition-colors"
                            onClick={() => {
                              setEditingJornada(tecnico.id);
                              setJornadaValue(horaInicio);
                            }}
                          >
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{horaInicio}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ColaboradorCell equipe={tecnico} slotIndex={0} label="Líder" />
                      </TableCell>
                      <TableCell>
                        <ColaboradorCell equipe={tecnico} slotIndex={1} label="Membro" />
                      </TableCell>
                      <TableCell>
                        <ColaboradorCell equipe={tecnico} slotIndex={2} label="Membro" />
                      </TableCell>
                      <TableCell>
                        <div 
                          className="cursor-pointer"
                          onClick={() => handleToggleStatus(tecnico.id, normalizedStatus)}
                          title="Clique para alternar status"
                        >
                          <Badge 
                            variant={isAtivo ? "success" : "secondary"}
                            className="gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            {isAtivo ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {config.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tecnico.habilidades && tecnico.habilidades.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tecnico.habilidades.slice(0, 2).map((hab) => (
                              <Badge key={hab} variant="outline" className="text-xs">
                                {hab}
                              </Badge>
                            ))}
                            {tecnico.habilidades.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{tecnico.habilidades.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleEdit(tecnico)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleDuplicate(tecnico)}
                            title="Duplicar equipe"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => { setTecnicoToDelete(tecnico); setDeleteDialogOpen(true); }}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

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
