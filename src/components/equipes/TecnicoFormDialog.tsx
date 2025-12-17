import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { X, MapPin, Clock, Coffee, Settings, User, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { criarCredenciaisEquipe } from "@/lib/authUtils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const tecnicoSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório").max(20),
  colaborador1: z.string().min(2, "Colaborador 1 é obrigatório").max(100),
  colaborador2: z.string().max(100).optional(),
  telefone: z.string().max(20).optional(),
  status: z.enum(["disponivel", "em_servico", "pausa", "offline"]),
  hora_inicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (use HH:mm)"),
  jornada_horas: z.number().min(1).max(24),
  max_horas_trabalho: z.number().min(1).max(24),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida (use formato hexadecimal)"),
  usuario: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres").max(50),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
});

type TecnicoFormData = z.infer<typeof tecnicoSchema>;

interface TecnicoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tecnico?: Tables<"tecnicos"> | null;
  onSuccess: () => void;
}

// Mapeamento de habilidades para tipos de OS
const habilidadesDisponiveis = [
  { label: "Corte", value: "CORTE" },
  { label: "Religa", value: "RELIGA" },
  { label: "Inspeção", value: "INSPEÇÃO" },
  { label: "Ligação Nova", value: "LIGAÇÃO NOVA" },
  { label: "Manutenção", value: "MANUTENÇÃO" },
  { label: "Troca de Medidor", value: "TROCA DE MEDIDOR" },
  { label: "Vistoria", value: "VISTORIA" },
];

export function TecnicoFormDialog({
  open,
  onOpenChange,
  tecnico,
  onSuccess,
}: TecnicoFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [habilidades, setHabilidades] = useState<string[]>([]);
  const [almoco, setAlmoco] = useState({
    duracao: 60,
    janelaInicio: "11:00",
    janelaFim: "14:00",
  });
  const [localPartida, setLocalPartida] = useState<{ lat: number; lng: number } | null>(null);
  const [localChegada, setLocalChegada] = useState<{ lat: number; lng: number } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isEditing = !!tecnico && tecnico.id && !tecnico.id.startsWith("temp-");

  const form = useForm<TecnicoFormData>({
    resolver: zodResolver(tecnicoSchema),
    defaultValues: {
      codigo: "",
      colaborador1: "",
      colaborador2: "",
      telefone: "",
      status: "disponivel",
      hora_inicio: "07:30",
      jornada_horas: 8,
      max_horas_trabalho: 10,
      latitude: undefined,
      longitude: undefined,
      color: "#3b82f6",
      usuario: "",
      senha: "",
    },
  });

  useEffect(() => {
    if (tecnico) {
      // Separar nome em colaborador1 e colaborador2 se houver "/" ou ","
      const nomeCompleto = tecnico.nome || "";
      const partes = nomeCompleto.split(/[\/,]/).map(p => p.trim());
      
      form.reset({
        codigo: tecnico.codigo,
        colaborador1: partes[0] || "",
        colaborador2: partes[1] || "",
        telefone: tecnico.telefone || "",
        status: tecnico.status as TecnicoFormData["status"],
        hora_inicio: (tecnico as any).hora_inicio || "07:30",
        jornada_horas: (tecnico as any).jornada_horas || 8,
        max_horas_trabalho: (tecnico as any).max_horas_trabalho || 10,
        latitude: (tecnico as any).latitude ? Number((tecnico as any).latitude) : undefined,
        longitude: (tecnico as any).longitude ? Number((tecnico as any).longitude) : undefined,
        color: (tecnico as any).color || "#3b82f6",
        usuario: (tecnico as any).usuario || "",
        senha: "", // Não carregar senha por segurança
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
    } else {
      form.reset({
        codigo: "",
        colaborador1: "",
        colaborador2: "",
        telefone: "",
        status: "disponivel",
        hora_inicio: "07:30",
        jornada_horas: 8,
        max_horas_trabalho: 10,
        latitude: undefined,
        longitude: undefined,
        color: "#3b82f6",
        usuario: "",
        senha: "",
      });
      setHabilidades([]);
      setAlmoco({ duracao: 60, janelaInicio: "11:00", janelaFim: "14:00" });
      setLocalPartida(null);
      setLocalChegada(null);
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
      // Montar nome completo (colaborador1 / colaborador2)
      const nomeCompleto = data.colaborador2 
        ? `${data.colaborador1} / ${data.colaborador2}`
        : data.colaborador1;

      const updateData: any = {
        codigo: data.codigo,
        nome: nomeCompleto,
        telefone: data.telefone || null,
        status: data.status,
        habilidades,
        hora_inicio: data.hora_inicio,
        jornada_horas: data.jornada_horas,
        max_horas_trabalho: data.max_horas_trabalho,
        almoco,
        color: data.color,
        usuario: data.usuario,
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

        // Se senha foi fornecida, atualizar credenciais
        if (data.senha && data.senha.length >= 6) {
          const credenciaisResult = await criarCredenciaisEquipe(
            tecnico.id,
            data.usuario,
            data.senha
          );
          
          if (!credenciaisResult.success) {
            toast.warning(
              "Equipe atualizada, mas houve erro ao atualizar credenciais",
              { description: credenciaisResult.message }
            );
          }
        }

        toast.success("Equipe atualizada com sucesso!");
      } else {
        // Criar nova equipe
        // Inserir equipe no banco
        const { data: equipeCriada, error } = await supabase
          .from("tecnicos")
          .insert(updateData)
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Criar credenciais automaticamente
        if (equipeCriada && data.senha && data.senha.length >= 6) {
          const credenciaisResult = await criarCredenciaisEquipe(
            equipeCriada.id,
            data.usuario,
            data.senha
          );

          if (credenciaisResult.success) {
            toast.success("Equipe e credenciais criadas com sucesso!");
          } else {
            toast.warning(
              "Equipe criada, mas houve erro ao criar credenciais",
              {
                description: credenciaisResult.message || "Tente criar manualmente usando a função criar_credenciais_equipe",
                duration: 8000,
              }
            );
          }
        } else {
          toast.success("Equipe criada! Configure as credenciais depois.");
        }
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
                <TabsTrigger value="acesso" className="text-xs">
                  <Lock className="h-4 w-4 mr-1" />
                  Acesso
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
                  Localização
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
                            <SelectItem value="disponivel">Disponível</SelectItem>
                            <SelectItem value="em_servico">Em Serviço</SelectItem>
                            <SelectItem value="pausa">Pausa</SelectItem>
                            <SelectItem value="offline">Offline</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="colaborador1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colaborador 1 *</FormLabel>
                      <FormControl>
                        <Input placeholder="João da Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="colaborador2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colaborador 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Maria Santos (opcional)" {...field} />
                      </FormControl>
                      <FormDescription>
                        Opcional: Nome do segundo colaborador da dupla
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Habilidades / Skills</FormLabel>
                  <FormDescription>
                    Selecione as habilidades que esta equipe possui
                  </FormDescription>
                  <div className="flex flex-wrap gap-2">
                    {habilidadesDisponiveis.map((hab) => (
                      <Badge
                        key={hab.value}
                        variant={habilidades.includes(hab.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleHabilidade(hab.value)}
                      >
                        {hab.label}
                        {habilidades.includes(hab.value) && (
                          <X className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ABA: Acesso ao App */}
              <TabsContent value="acesso" className="space-y-4 mt-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Credenciais para acesso ao aplicativo móvel</strong>
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    O usuário e senha serão usados para login no app do técnico
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="usuario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuário *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="equipe001" 
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Usuário único para login no app
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="senha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {isEditing ? "Nova Senha (deixe em branco para manter)" : "Senha *"}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"}
                            placeholder={isEditing ? "••••••••" : "Mínimo 6 caracteres"} 
                            {...field}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        {isEditing 
                          ? "Preencha apenas se desejar alterar a senha"
                          : "Senha para acesso ao aplicativo móvel"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
