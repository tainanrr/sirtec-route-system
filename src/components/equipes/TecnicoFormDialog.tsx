import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogSistema } from "@/hooks/useLogSistema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, MapPin, Clock, Coffee, Settings, Users, Car, Search, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

// Tipos para colaboradores
interface Colaborador {
  id: string;
  cpf: string;
  nome: string;
  cargo: string | null;
  ativo: boolean;
}

interface EquipeColaborador {
  id: string;
  colaborador_id: string;
  funcao: string;
  ativo: boolean;
  colaborador?: Colaborador;
}

const tecnicoSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório").max(20),
  nome: z.string().max(200).optional(), // Nome será gerado automaticamente dos colaboradores
  status: z.enum(["disponivel", "offline"]),
  tipo_equipe: z.enum(["normal", "gaviao", "kit"]),
  hora_inicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (use HH:mm)"),
  jornada_horas: z.number().min(1).max(24),
  max_horas_trabalho: z.number().min(1).max(24),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida (use formato hexadecimal)"),
  placa_veiculo: z.string().max(10).optional(),
  min_colaboradores: z.number().min(1).max(10),
  max_colaboradores: z.number().min(1).max(10),
  centro_custo_id: z.string().optional(),
}).refine(data => data.max_colaboradores >= data.min_colaboradores, {
  message: "Máximo deve ser maior ou igual ao mínimo",
  path: ["max_colaboradores"],
});

// Interface para Centro de Custo
interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
}

// Tipos de equipe disponíveis
const tiposEquipeDisponiveis = [
  { value: "normal", label: "Normal", description: "Equipe padrão de campo" },
  { value: "gaviao", label: "Gavião", description: "Equipe especializada em corte/religa" },
  { value: "kit", label: "Kit", description: "Equipe de instalação de kit" },
];

type TecnicoFormData = z.infer<typeof tecnicoSchema>;

interface TecnicoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tecnico?: Tables<"tecnicos"> | null;
  onSuccess: () => void;
}

// Interface para skills do banco
interface Skill {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export function TecnicoFormDialog({
  open,
  onOpenChange,
  tecnico,
  onSuccess,
}: TecnicoFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [habilidades, setHabilidades] = useState<string[]>([]);
  const { logCriar, logEditar } = useLogSistema();
  const [skillsDisponiveis, setSkillsDisponiveis] = useState<Skill[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [almoco, setAlmoco] = useState({
    duracao: 60,
    janelaInicio: "11:00",
    janelaFim: "14:00",
  });
  const [localPartida, setLocalPartida] = useState<{ lat: number; lng: number } | null>(null);
  const [localChegada, setLocalChegada] = useState<{ lat: number; lng: number } | null>(null);
  const isEditing = !!tecnico && tecnico.id && !tecnico.id.startsWith("temp-");

  // Estados para colaboradores
  const [todosColaboradores, setTodosColaboradores] = useState<Colaborador[]>([]);
  const [colaboradoresEquipe, setColaboradoresEquipe] = useState<EquipeColaborador[]>([]);
  const [colaboradorSearch, setColaboradorSearch] = useState("");
  const [loadingColaboradores, setLoadingColaboradores] = useState(false);

  const form = useForm<TecnicoFormData>({
    resolver: zodResolver(tecnicoSchema),
    defaultValues: {
      codigo: "",
      nome: "",
      status: "disponivel",
      tipo_equipe: "normal",
      hora_inicio: "07:30",
      jornada_horas: 8,
      max_horas_trabalho: 10,
      latitude: undefined,
      longitude: undefined,
      color: "#3b82f6",
      placa_veiculo: "",
      min_colaboradores: 1,
      max_colaboradores: 2,
      centro_custo_id: "",
    },
  });

  // Carregar skills disponíveis do banco de dados
  const fetchSkills = async () => {
    try {
      const { data, error } = await supabase
        .from("skills")
        .select("id, codigo, nome, ativo")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setSkillsDisponiveis(data || []);
    } catch (error) {
      console.error("Erro ao carregar skills:", error);
    }
  };

  // Carregar centros de custo
  const fetchCentrosCusto = async () => {
    try {
      const { data, error } = await supabase
        .from("centros_custo")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setCentrosCusto(data || []);
    } catch (error) {
      console.error("Erro ao carregar centros de custo:", error);
    }
  };

  // Carregar todos os colaboradores disponíveis
  const fetchColaboradores = async () => {
    try {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, cpf, nome, cargo, ativo")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setTodosColaboradores(data || []);
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
    }
  };

  // Carregar colaboradores da equipe
  const fetchColaboradoresEquipe = async (equipeId: string) => {
    if (!equipeId || equipeId.startsWith("temp-")) return;
    
    setLoadingColaboradores(true);
    try {
      const { data, error } = await supabase
        .from("equipe_colaboradores")
        .select(`
          id,
          colaborador_id,
          funcao,
          ativo,
          colaboradores:colaborador_id (id, cpf, nome, cargo, ativo)
        `)
        .eq("equipe_id", equipeId)
        .eq("ativo", true);

      if (error) throw error;
      
      const mapped = (data || []).map((item: any) => ({
        id: item.id,
        colaborador_id: item.colaborador_id,
        funcao: item.funcao,
        ativo: item.ativo,
        colaborador: item.colaboradores,
      }));
      
      setColaboradoresEquipe(mapped);
    } catch (error) {
      console.error("Erro ao carregar colaboradores da equipe:", error);
    } finally {
      setLoadingColaboradores(false);
    }
  };

  // Adicionar colaborador à equipe
  const addColaborador = async (colaboradorId: string, funcao: string = "membro") => {
    const colaborador = todosColaboradores.find(c => c.id === colaboradorId);
    
    // Verificar se o colaborador já está ativo em outra equipe
    const { data: vinculoExistente, error: erroVerificacao } = await supabase
      .from("equipe_colaboradores")
      .select(`
        id,
        equipe_id,
        tecnicos:equipe_id (codigo, nome)
      `)
      .eq("colaborador_id", colaboradorId)
      .eq("ativo", true)
      .single();

    if (vinculoExistente && vinculoExistente.equipe_id !== tecnico?.id) {
      const equipeAtual = (vinculoExistente as any).tecnicos;
      toast.error(`Colaborador já está vinculado à equipe ${equipeAtual?.codigo || ''} (${equipeAtual?.nome || ''})`);
      return;
    }

    if (!tecnico?.id || tecnico.id.startsWith("temp-")) {
      // Se é nova equipe, apenas adicionar na lista local
      if (colaborador && !colaboradoresEquipe.some(ec => ec.colaborador_id === colaboradorId)) {
        setColaboradoresEquipe(prev => [...prev, {
          id: `temp-${Date.now()}`,
          colaborador_id: colaboradorId,
          funcao,
          ativo: true,
          colaborador,
        }]);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("equipe_colaboradores")
        .insert({
          equipe_id: tecnico.id,
          colaborador_id: colaboradorId,
          funcao,
        })
        .select(`
          id,
          colaborador_id,
          funcao,
          ativo,
          colaboradores:colaborador_id (id, cpf, nome, cargo, ativo)
        `)
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Colaborador já está vinculado a esta equipe");
        } else {
          throw error;
        }
        return;
      }

      setColaboradoresEquipe(prev => [...prev, {
        id: data.id,
        colaborador_id: data.colaborador_id,
        funcao: data.funcao,
        ativo: data.ativo,
        colaborador: (data as any).colaboradores,
      }]);
      
      toast.success("Colaborador adicionado à equipe");
    } catch (error: any) {
      toast.error("Erro ao adicionar colaborador");
      console.error(error);
    }
  };

  // Remover colaborador da equipe
  const removeColaborador = async (equipeColaboradorId: string) => {
    if (equipeColaboradorId.startsWith("temp-")) {
      setColaboradoresEquipe(prev => prev.filter(ec => ec.id !== equipeColaboradorId));
      return;
    }

    try {
      const { error } = await supabase
        .from("equipe_colaboradores")
        .update({ ativo: false, data_fim: new Date().toISOString().split("T")[0] })
        .eq("id", equipeColaboradorId);

      if (error) throw error;

      setColaboradoresEquipe(prev => prev.filter(ec => ec.id !== equipeColaboradorId));
      toast.success("Colaborador removido da equipe");
    } catch (error) {
      toast.error("Erro ao remover colaborador");
      console.error(error);
    }
  };

  // Atualizar função do colaborador
  const updateFuncaoColaborador = async (equipeColaboradorId: string, novaFuncao: string) => {
    if (equipeColaboradorId.startsWith("temp-")) {
      setColaboradoresEquipe(prev => prev.map(ec => 
        ec.id === equipeColaboradorId ? { ...ec, funcao: novaFuncao } : ec
      ));
      return;
    }

    try {
      const { error } = await supabase
        .from("equipe_colaboradores")
        .update({ funcao: novaFuncao })
        .eq("id", equipeColaboradorId);

      if (error) throw error;

      setColaboradoresEquipe(prev => prev.map(ec => 
        ec.id === equipeColaboradorId ? { ...ec, funcao: novaFuncao } : ec
      ));
    } catch (error) {
      toast.error("Erro ao atualizar função");
      console.error(error);
    }
  };

  // Colaboradores filtrados (não vinculados à equipe)
  const colaboradoresDisponiveis = todosColaboradores.filter(c => 
    !colaboradoresEquipe.some(ec => ec.colaborador_id === c.id) &&
    (colaboradorSearch === "" || 
      c.nome.toLowerCase().includes(colaboradorSearch.toLowerCase()) ||
      c.cpf.includes(colaboradorSearch))
  );

  // Carregar colaboradores quando o dialog abrir
  useEffect(() => {
    if (open) {
      fetchColaboradores();
      fetchSkills();
      fetchCentrosCusto();
    }
  }, [open]);

  useEffect(() => {
    if (tecnico) {
      // Normalizar status antigos (em_servico, pausa) para "disponivel"
      const normalizedStatus = tecnico.status === "offline" ? "offline" : "disponivel";
      // Normalizar tipo_equipe
      const tipoEquipe = (tecnico as any).tipo_equipe || "normal";
      
      form.reset({
        codigo: tecnico.codigo,
        nome: tecnico.nome || "",
        status: normalizedStatus as TecnicoFormData["status"],
        tipo_equipe: tipoEquipe as TecnicoFormData["tipo_equipe"],
        hora_inicio: (tecnico as any).hora_inicio || "07:30",
        jornada_horas: (tecnico as any).jornada_horas || 8,
        max_horas_trabalho: (tecnico as any).max_horas_trabalho || 10,
        latitude: (tecnico as any).latitude ? Number((tecnico as any).latitude) : undefined,
        longitude: (tecnico as any).longitude ? Number((tecnico as any).longitude) : undefined,
        color: (tecnico as any).color || "#3b82f6",
        placa_veiculo: (tecnico as any).placa_veiculo || "",
        min_colaboradores: (tecnico as any).min_colaboradores || 1,
        max_colaboradores: (tecnico as any).max_colaboradores || 2,
        centro_custo_id: (tecnico as any).centro_custo_id || "",
      });
      setHabilidades(tecnico.habilidades || []);
      
      // Carregar configuração de almoço
      if ((tecnico as any).almoco) {
        setAlmoco((tecnico as any).almoco);
      }
      
      // Carregar localizações
      if ((tecnico as any).local_partida) {
        setLocalPartida((tecnico as any).local_partida);
      }
      if ((tecnico as any).local_chegada) {
        setLocalChegada((tecnico as any).local_chegada);
      }

      // Carregar colaboradores da equipe
      if (tecnico.id && !tecnico.id.startsWith("temp-")) {
        fetchColaboradoresEquipe(tecnico.id);
      } else {
        setColaboradoresEquipe([]);
      }
    } else {
      form.reset({
        codigo: "",
        nome: "",
        status: "disponivel",
        tipo_equipe: "normal",
        hora_inicio: "07:30",
        jornada_horas: 8,
        max_horas_trabalho: 10,
        latitude: undefined,
        longitude: undefined,
        color: "#3b82f6",
        placa_veiculo: "",
        min_colaboradores: 1,
        max_colaboradores: 2,
        centro_custo_id: "",
      });
      setHabilidades([]);
      setAlmoco({ duracao: 60, janelaInicio: "11:00", janelaFim: "14:00" });
      setLocalPartida(null);
      setLocalChegada(null);
      setColaboradoresEquipe([]);
    }
  }, [tecnico, form]);

  const toggleHabilidade = (hab: string) => {
    setHabilidades((prev) =>
      prev.includes(hab) ? prev.filter((h) => h !== hab) : [...prev, hab]
    );
  };

  const onSubmit = async (data: TecnicoFormData) => {
    setIsLoading(true);
    try {
      // Gerar nome da equipe automaticamente dos colaboradores vinculados
      let nomeEquipe = data.nome || data.codigo;
      if (colaboradoresEquipe.length > 0) {
        const nomes = colaboradoresEquipe
          .slice(0, 2)
          .map(ec => {
            const nome = ec.colaborador?.nome || "";
            // Pegar apenas o primeiro nome
            return nome.split(" ")[0];
          })
          .filter(n => n);
        if (nomes.length > 0) {
          nomeEquipe = nomes.join(" / ");
        }
      }

      const updateData: any = {
        codigo: data.codigo,
        nome: nomeEquipe,
        status: data.status,
        tipo_equipe: data.tipo_equipe,
        habilidades,
        hora_inicio: data.hora_inicio,
        jornada_horas: data.jornada_horas,
        max_horas_trabalho: data.max_horas_trabalho,
        almoco,
        color: data.color,
        placa_veiculo: data.placa_veiculo || null,
        login_ativo: true, // Habilitar login por código
        min_colaboradores: data.min_colaboradores,
        max_colaboradores: data.max_colaboradores,
        centro_custo_id: data.centro_custo_id || null,
      };

      // Adicionar coordenadas se fornecidas
      if (data.latitude !== undefined && data.longitude !== undefined) {
        updateData.latitude = data.latitude;
        updateData.longitude = data.longitude;
      }

      // Adicionar localizações se fornecidas
      if (localPartida) {
        updateData.local_partida = localPartida;
      }
      if (localChegada) {
        updateData.local_chegada = localChegada;
      }

      const isNewTeam = !tecnico || tecnico.id.startsWith("temp-") || !tecnico.id;
      
      if (!isNewTeam && tecnico) {
        // Atualizar equipe existente
        const { error } = await supabase
          .from("tecnicos")
          .update(updateData)
          .eq("id", tecnico.id);

        if (error) throw error;
        
        // Log de edição
        logEditar("equipes", "tecnicos", tecnico.id, tecnico, updateData,
          `Editou equipe ${updateData.codigo} - ${updateData.nome}`);
        
        toast.success("Equipe atualizada com sucesso!");
      } else {
        // Criar nova equipe
        const { data: equipeCriada, error } = await supabase
          .from("tecnicos")
          .insert(updateData)
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Se tem colaboradores temporários, vincular à equipe criada
        if (equipeCriada && colaboradoresEquipe.length > 0) {
          const colaboradoresParaVincular = colaboradoresEquipe
            .filter(ec => ec.id.startsWith("temp-"))
            .map(ec => ({
              equipe_id: equipeCriada.id,
              colaborador_id: ec.colaborador_id,
              funcao: ec.funcao,
            }));

          if (colaboradoresParaVincular.length > 0) {
            await supabase
              .from("equipe_colaboradores")
              .insert(colaboradoresParaVincular);
          }
        }

        // Log de criação
        logCriar("equipes", "tecnicos", equipeCriada?.id || "", updateData,
          `Criou equipe ${updateData.codigo} - ${updateData.nome}`);

        toast.success("Equipe criada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar equipe:", error);
      toast.error(error.message || "Erro ao salvar equipe");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing 
              ? "Configurar Equipe" 
              : tecnico?.nome?.includes("(Cópia)") || tecnico?.id?.startsWith("temp-")
                ? "Duplicar Equipe"
                : "Nova Equipe"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basico" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basico" className="text-xs">
                  <Settings className="h-4 w-4 mr-1" />
                  Básico
                </TabsTrigger>
                <TabsTrigger value="colaboradores" className="text-xs">
                  <Users className="h-4 w-4 mr-1" />
                  Equipe
                </TabsTrigger>
                <TabsTrigger value="jornada" className="text-xs">
                  <Clock className="h-4 w-4 mr-1" />
                  Jornada
                </TabsTrigger>
                <TabsTrigger value="almoco" className="text-xs">
                  <Coffee className="h-4 w-4 mr-1" />
                  Almoço
                </TabsTrigger>
                <TabsTrigger value="localizacao" className="text-xs">
                  <MapPin className="h-4 w-4 mr-1" />
                  Local
                </TabsTrigger>
              </TabsList>

              {/* ABA: Informações Básicas */}
              <TabsContent value="basico" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="codigo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <Input placeholder="EQ-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="disponivel">Ativa</SelectItem>
                            <SelectItem value="offline">Inativa</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipo_equipe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Equipe</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposEquipeDisponiveis.map((tipo) => (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                <div className="flex flex-col">
                                  <span>{tipo.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {tiposEquipeDisponiveis.find(t => t.value === field.value)?.description}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Informação sobre colaboradores */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-900">
                    <strong>Colaboradores:</strong> Vincule os membros da equipe na aba "Equipe".
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    O nome da equipe será gerado automaticamente a partir dos colaboradores vinculados.
                  </p>
                </div>

                <div className="space-y-2">
                  <FormLabel>Habilidades / Skills</FormLabel>
                  <FormDescription>
                    Selecione as habilidades que esta equipe possui
                  </FormDescription>
                  <div className="flex flex-wrap gap-2">
                    {skillsDisponiveis.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma skill cadastrada. Cadastre skills em "Cadastrar &gt; Skills".</p>
                    ) : (
                      skillsDisponiveis.map((skill) => (
                        <Badge
                          key={skill.codigo}
                          variant={habilidades.includes(skill.codigo) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleHabilidade(skill.codigo)}
                        >
                          {skill.nome}
                          {habilidades.includes(skill.codigo) && (
                            <X className="h-3 w-3 ml-1" />
                          )}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                {/* Campo de Placa do Veículo */}
                <FormField
                  control={form.control}
                  name="placa_veiculo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        Placa do Veículo
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="ABC-1234" 
                          {...field} 
                          className="uppercase"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormDescription>
                        Placa padrão do veículo da equipe (pode ser alterada na abertura do turno)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Campo de Centro de Custo */}
                <FormField
                  control={form.control}
                  name="centro_custo_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Custo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um centro de custo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Nenhum</SelectItem>
                          {centrosCusto.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.codigo ? `${cc.codigo} - ` : ""}{cc.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Vincula a equipe a um centro de custo para controle de metas e feriados
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Limites de Colaboradores */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="min_colaboradores"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Mín. Colaboradores
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min={1}
                            max={10}
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormDescription>
                          Mínimo para abrir turno
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_colaboradores"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Máx. Colaboradores
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min={1}
                            max={10}
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 2)}
                          />
                        </FormControl>
                        <FormDescription>
                          Máximo para abrir turno
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* ABA: Colaboradores da Equipe */}
              <TabsContent value="colaboradores" className="space-y-4 mt-4">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-amber-900 dark:text-amber-100">
                    <strong>Colaboradores da Equipe</strong>
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Vincule os colaboradores que fazem parte desta equipe. Eles aparecerão na abertura de turno do aplicativo.
                  </p>
                </div>

                {/* Lista de colaboradores da equipe */}
                <div className="space-y-2">
                  <FormLabel>Membros da Equipe ({colaboradoresEquipe.length})</FormLabel>
                  {loadingColaboradores ? (
                    <div className="text-center py-4 text-muted-foreground">Carregando...</div>
                  ) : colaboradoresEquipe.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum colaborador vinculado</p>
                      <p className="text-xs">Use a busca abaixo para adicionar</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {colaboradoresEquipe.map((ec) => (
                        <div
                          key={ec.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{ec.colaborador?.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              CPF: {ec.colaborador?.cpf} • {ec.colaborador?.cargo || "Sem cargo"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <Select
                              value={ec.funcao}
                              onValueChange={(value) => updateFuncaoColaborador(ec.id, value)}
                            >
                              <SelectTrigger className="w-28 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="membro">Membro</SelectItem>
                                <SelectItem value="lider">Líder</SelectItem>
                                <SelectItem value="motorista">Motorista</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeColaborador(ec.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Buscar e adicionar colaboradores */}
                <div className="space-y-2 pt-4 border-t">
                  <FormLabel>Adicionar Colaborador</FormLabel>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CPF..."
                      value={colaboradorSearch}
                      onChange={(e) => setColaboradorSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  {colaboradorSearch && (
                    <ScrollArea className="h-40 border rounded-lg">
                      <div className="p-2 space-y-1">
                        {colaboradoresDisponiveis.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum colaborador encontrado
                          </p>
                        ) : (
                          colaboradoresDisponiveis.slice(0, 10).map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
                              onClick={() => {
                                addColaborador(c.id);
                                setColaboradorSearch("");
                              }}
                            >
                              <div>
                                <p className="text-sm font-medium">{c.nome}</p>
                                <p className="text-xs text-muted-foreground">
                                  {c.cpf} • {c.cargo || "Sem cargo"}
                                </p>
                              </div>
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>

              {/* ABA: Jornada de Trabalho */}
              <TabsContent value="jornada" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="hora_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de Início</FormLabel>
                      <FormDescription>
                        Horário que a equipe inicia o trabalho (formato HH:mm)
                      </FormDescription>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jornada_horas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jornada (horas)</FormLabel>
                        <FormDescription>
                          Horas disponíveis por dia
                        </FormDescription>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="24"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_horas_trabalho"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Máx. Horas Trabalho</FormLabel>
                        <FormDescription>
                          Capacidade máxima (ex: 10h)
                        </FormDescription>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="24"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* ABA: Configuração de Almoço */}
              <TabsContent value="almoco" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <FormLabel>Duração do Almoço (minutos)</FormLabel>
                  <Input
                    type="number"
                    min="15"
                    max="120"
                    value={almoco.duracao}
                    onChange={(e) =>
                      setAlmoco({ ...almoco, duracao: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FormLabel>Janela Início</FormLabel>
                    <FormDescription>Horário mínimo para iniciar almoço</FormDescription>
                    <Input
                      type="time"
                      value={almoco.janelaInicio}
                      onChange={(e) =>
                        setAlmoco({ ...almoco, janelaInicio: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <FormLabel>Janela Fim</FormLabel>
                    <FormDescription>Horário máximo para terminar almoço</FormDescription>
                    <Input
                      type="time"
                      value={almoco.janelaFim}
                      onChange={(e) =>
                        setAlmoco({ ...almoco, janelaFim: e.target.value })
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ABA: Localização */}
              <TabsContent value="localizacao" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <FormLabel>Base / Escritório</FormLabel>
                    <FormDescription>
                      Coordenadas da base (usadas se local de partida não definido)
                    </FormDescription>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <FormField
                        control={form.control}
                        name="latitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Latitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                placeholder="-14.8661"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="longitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Longitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                placeholder="-40.8394"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <FormLabel>Local de Partida (Casa do Técnico)</FormLabel>
                    <FormDescription>
                      Opcional: Coordenadas da casa do técnico (sobrescreve base)
                    </FormDescription>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <Input
                        type="number"
                        step="any"
                        placeholder="Latitude"
                        value={localPartida?.lat || ""}
                        onChange={(e) =>
                          setLocalPartida({
                            lat: Number(e.target.value),
                            lng: localPartida?.lng || 0,
                          })
                        }
                      />
                      <Input
                        type="number"
                        step="any"
                        placeholder="Longitude"
                        value={localPartida?.lng || ""}
                        onChange={(e) =>
                          setLocalPartida({
                            lat: localPartida?.lat || 0,
                            lng: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    {localPartida && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setLocalPartida(null)}
                      >
                        Remover Local de Partida
                      </Button>
                    )}
                  </div>

                  <div>
                    <FormLabel>Local de Chegada (Ponto de Retorno)</FormLabel>
                    <FormDescription>
                      Opcional: Coordenadas do ponto de retorno (usa local de partida se não definido)
                    </FormDescription>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <Input
                        type="number"
                        step="any"
                        placeholder="Latitude"
                        value={localChegada?.lat || ""}
                        onChange={(e) =>
                          setLocalChegada({
                            lat: Number(e.target.value),
                            lng: localChegada?.lng || 0,
                          })
                        }
                      />
                      <Input
                        type="number"
                        step="any"
                        placeholder="Longitude"
                        value={localChegada?.lng || ""}
                        onChange={(e) =>
                          setLocalChegada({
                            lat: localChegada?.lat || 0,
                            lng: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    {localChegada && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setLocalChegada(null)}
                      >
                        Remover Local de Chegada
                      </Button>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor no Mapa</FormLabel>
                        <FormDescription>
                          Cor hexadecimal para visualização da rota no mapa
                        </FormDescription>
                        <div className="flex gap-2 items-center">
                          <FormControl>
                            <Input
                              type="color"
                              value={field.value || "#3b82f6"}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="h-10 w-16 p-1 cursor-pointer border-border"
                              title="Selecione uma cor"
                            />
                          </FormControl>
                          <FormControl>
                            <Input
                              placeholder="#3b82f6"
                              value={field.value || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === "" || /^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                                  field.onChange(value);
                                }
                              }}
                              className="flex-1"
                            />
                          </FormControl>
                          <div
                            className="w-12 h-10 rounded border border-border flex-shrink-0"
                            style={{ backgroundColor: field.value || "#3b82f6" }}
                            title="Preview da cor"
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : isEditing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
