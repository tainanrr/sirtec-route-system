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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { getDadosSkill, fetchSkills } from "@/lib/skillsUtils";
import { useLogSistema } from "@/hooks/useLogSistema";
import { obterNomesTerritorios } from "@/types/territorios";

/**
 * Converte código da skill (ex: "CORTE") para formato tipo usado no banco (ex: "corte")
 * Deve ser igual à função usada na ImportacaoOSDialog
 */
function skillCodigoParaTipo(codigo: string): string {
  const mapeamentoInverso: Record<string, string> = {
    "CORTE": "corte",
    "RELIG": "religacao",
    "INSP": "inspecao",
    "VIST": "vistoria",
    "TROCA_MED": "troca_medidor",
    "LEIT": "leitura",
    "ENT_FAT": "entrega_fatura",
  };
  return mapeamentoInverso[codigo.toUpperCase()] || codigo.toLowerCase();
}

/**
 * Converte tipo do banco (ex: "corte") para código da skill (ex: "CORTE")
 */
function tipoParaSkillCodigo(tipo: string): string {
  // Mapeamento direto para casos conhecidos
  const mapeamento: Record<string, string> = {
    corte: "CORTE",
    religa: "RELIGA",
    inspecao: "INSPEÇÃO",
    inspeção: "INSPEÇÃO",
    ligacao: "LIGAÇÃO",
    ligação: "LIGAÇÃO",
    manutencao: "MANUTENÇÃO",
    manutenção: "MANUTENÇÃO",
    troca_medidor: "TROCA_MEDIDOR",
  };
  
  if (mapeamento[tipo.toLowerCase()]) {
    return mapeamento[tipo.toLowerCase()];
  }
  
  // Tentar converter diretamente
  return tipo.toUpperCase();
}

const ordemSchema = z.object({
  numero: z.string().min(1, "Número é obrigatório").max(50),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  contrato_id: z.string().min(1, "Contrato é obrigatório"),
  centro_custo_id: z.string().optional(),
  status: z.enum(["pendente", "planejada", "andamento", "concluida", "atrasada", "cancelada"]),
  endereco: z.string().min(5, "Endereço é obrigatório").max(255),
  municipio: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cliente_nome: z.string().max(100).optional(),
  cliente_cpf: z.string().max(14).optional(),
  instalacao: z.string().max(50).optional(),
  medidor: z.string().max(50).optional(),
  tensao_medicao: z.string().max(50).optional(),
  duracao_estimada: z.coerce.number().min(5).max(480).optional(),
  valor: z.coerce.number().min(0).optional(),
  regulada: z.boolean(),
  observacoes: z.string().max(500).optional(),
  tecnico_id: z.string().optional(),
  prazo: z.string().optional(),
  data_geracao: z.string().optional(),
  zona_cadastral: z.enum(["Urbana", "Rural", "Indefinida"]).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  prioridade: z.enum(["ALTA", "NORMAL"]).optional(),
});

type OrdemFormData = z.infer<typeof ordemSchema>;

interface OrdemServicoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem?: Tables<"ordens_servico"> | null;
  onSuccess: () => void;
}

interface Contrato {
  id: string;
  codigo: string;
  nome: string;
}

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
}

export function OrdemServicoFormDialog({
  open,
  onOpenChange,
  ordem,
  onSuccess,
}: OrdemServicoFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tecnicos, setTecnicos] = useState<Tables<"tecnicos">[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [territoriosNomes, setTerritoriosNomes] = useState<string[]>([]);
  const isEditing = !!ordem;
  const { logCriar, logEditar } = useLogSistema();

  const form = useForm<OrdemFormData>({
    resolver: zodResolver(ordemSchema),
    defaultValues: {
      numero: "",
      tipo: "",
      contrato_id: "",
      centro_custo_id: "",
      status: "pendente",
      endereco: "",
      municipio: "",
      bairro: "",
      cliente_nome: "",
      cliente_cpf: "",
      instalacao: "",
      medidor: "",
      tensao_medicao: "",
      duracao_estimada: 30,
      valor: 0,
      regulada: false,
      observacoes: "",
      tecnico_id: "",
      prazo: "",
      data_geracao: "",
      zona_cadastral: "Indefinida",
      latitude: undefined,
      longitude: undefined,
      prioridade: "NORMAL",
    },
  });

  useEffect(() => {
    const fetchTecnicos = async () => {
      const { data } = await supabase
        .from("tecnicos")
        .select("*")
        .order("nome");
      if (data) setTecnicos(data);
    };
    fetchTecnicos();
  }, []);

  useEffect(() => {
    const fetchContratos = async () => {
      const { data } = await (supabase as any)
        .from("contratos")
        .select("id, codigo, nome")
        .eq("status", "ativo")
        .order("codigo");
      if (data) setContratos(data as Contrato[]);
    };
    fetchContratos();
  }, []);

  useEffect(() => {
    const fetchCentrosCusto = async () => {
      const { data } = await (supabase as any)
        .from("centros_custo")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("nome");
      if (data) setCentrosCusto(data as CentroCusto[]);
    };
    fetchCentrosCusto();
  }, []);

  useEffect(() => {
    const carregarSkills = async () => {
      try {
        const skillsData = await fetchSkills();
        setSkills(skillsData);
      } catch (error) {
        console.error("Erro ao buscar skills:", error);
        toast.error("Erro ao carregar tipos disponíveis");
      }
    };
    carregarSkills();
  }, []);

  // Buscar dados da skill quando o tipo mudar
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Só atualizar quando o campo "tipo" mudar
      if (name === "tipo" && value.tipo) {
        const carregarDadosSkill = async () => {
          try {
            // Mapear o tipo do formulário para o código da skill
            const skillCodigo = tipoParaSkillCodigo(value.tipo);
            const dadosSkill = await getDadosSkill(skillCodigo);
            
            // Sempre atualizar com dados da skill quando o tipo mudar
            // Isso garante que os valores sempre reflitam a configuração atual da skill
            form.setValue("duracao_estimada", dadosSkill.tempoExecucao);
            form.setValue("valor", dadosSkill.valor);
            form.setValue("regulada", dadosSkill.regulada);
          } catch (error) {
            console.error("Erro ao carregar dados da skill:", error);
            // Não mostrar erro ao usuário, apenas usar valores padrão
          }
        };

        carregarDadosSkill();
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isEditing]);

  // Efeito para resetar o formulário quando a ordem muda (apenas quando ordem é definida/alterada)
  useEffect(() => {
    if (ordem) {
      // Formatar prazo para input datetime-local
      const prazoFormatted = ordem.prazo 
        ? new Date(ordem.prazo).toISOString().slice(0, 16)
        : "";
      
      // Formatar data_geracao para input datetime-local
      const dataGeracaoFormatted = (ordem as any).data_geracao 
        ? new Date((ordem as any).data_geracao).toISOString().slice(0, 16)
        : "";
      
      console.log("[FormDialog] Carregando OS para edição:", {
        numero: ordem.numero,
        tipo: ordem.tipo,
        contrato_id: (ordem as any).contrato_id,
        centro_custo_id: (ordem as any).centro_custo_id,
        tensao_medicao: (ordem as any).tensao_medicao,
        data_geracao: (ordem as any).data_geracao,
        zona_cadastral: (ordem as any).zona_cadastral,
      });
      
      form.reset({
        numero: ordem.numero,
        tipo: ordem.tipo,
        contrato_id: (ordem as any).contrato_id || "",
        centro_custo_id: (ordem as any).centro_custo_id || "",
        status: ordem.status as OrdemFormData["status"],
        endereco: ordem.endereco,
        municipio: (ordem as any).municipio || "",
        bairro: (ordem as any).bairro || "",
        cliente_nome: ordem.cliente_nome || "",
        cliente_cpf: ordem.cliente_cpf || "",
        instalacao: ordem.instalacao || "",
        medidor: ordem.medidor || "",
        tensao_medicao: (ordem as any).tensao_medicao || "",
        duracao_estimada: ordem.duracao_estimada || 30,
        valor: Number(ordem.valor) || 0,
        regulada: ordem.regulada || false,
        observacoes: ordem.observacoes || "",
        tecnico_id: ordem.tecnico_id || "",
        prazo: prazoFormatted,
        data_geracao: dataGeracaoFormatted,
        zona_cadastral: ((ordem as any).zona_cadastral as "Urbana" | "Rural" | "Indefinida") || "Indefinida",
        latitude: ordem.latitude ? Number(ordem.latitude) : undefined,
        longitude: ordem.longitude ? Number(ordem.longitude) : undefined,
        prioridade: ((ordem as any).prioridade as "ALTA" | "NORMAL") || "NORMAL",
      });
      
      // Carregar nomes dos territórios
      const territorioIds = (ordem as any).territorios;
      if (territorioIds && territorioIds.length > 0) {
        obterNomesTerritorios(territorioIds).then(nomes => setTerritoriosNomes(nomes));
      } else {
        setTerritoriosNomes([]);
      }

      // Carregar dados da skill após resetar o formulário
      // Atualizar apenas se os valores estão vazios ou são padrão
      const carregarDadosSkillAoEditar = async () => {
        try {
          const skillCodigo = tipoParaSkillCodigo(ordem.tipo);
          const dadosSkill = await getDadosSkill(skillCodigo);
          
          // Atualizar com dados da skill se os valores estão vazios ou são padrão
          const duracaoAtual = ordem.duracao_estimada;
          const valorAtual = Number(ordem.valor);
          
          // Se não tem duração ou valor definidos, ou se são valores padrão, atualizar com dados da skill
          if (!duracaoAtual || duracaoAtual === 30 || !valorAtual || valorAtual === 0) {
            form.setValue("duracao_estimada", dadosSkill.tempoExecucao);
            form.setValue("valor", dadosSkill.valor);
            // Só atualizar regulada se não estiver definida
            if (ordem.regulada === undefined || ordem.regulada === null) {
              form.setValue("regulada", dadosSkill.regulada);
            }
          }
        } catch (error) {
          console.error("Erro ao carregar dados da skill ao editar:", error);
        }
      };

      carregarDadosSkillAoEditar();
    }
  }, [ordem, form]);
  
  // Efeito separado para inicializar o formulário quando é uma nova OS
  useEffect(() => {
    if (!ordem && skills.length > 0) {
      const tipoPadrao = skillCodigoParaTipo(skills[0].codigo);
      const duracaoPadrao = skills[0].tempo_execucao_minutos || 30;
      const valorPadrao = Number(skills[0].valor || 0);
      const reguladaPadrao = skills[0].regulada || false;
      const contratoPadrao = contratos.length > 0 ? contratos[0].id : "";

      form.reset({
        numero: "",
        tipo: tipoPadrao,
        contrato_id: contratoPadrao,
        centro_custo_id: "",
        status: "pendente",
        endereco: "",
        municipio: "",
        bairro: "",
        cliente_nome: "",
        cliente_cpf: "",
        instalacao: "",
        medidor: "",
        tensao_medicao: "",
        duracao_estimada: duracaoPadrao,
        valor: valorPadrao,
        regulada: reguladaPadrao,
        observacoes: "",
        tecnico_id: "",
        prazo: "",
        data_geracao: "",
        zona_cadastral: "Indefinida",
        latitude: undefined,
        longitude: undefined,
        prioridade: "NORMAL",
      });
    }
  }, [ordem, skills, contratos, form]);

  const onSubmit = async (data: OrdemFormData) => {
    setIsLoading(true);
    try {
      // Converter prazo de string para timestamp se fornecido
      const prazoTimestamp = data.prazo 
        ? new Date(data.prazo).toISOString()
        : null;
      
      // Converter data_geracao de string para timestamp se fornecido
      const dataGeracaoTimestamp = data.data_geracao 
        ? new Date(data.data_geracao).toISOString()
        : null;
      
      // Converter tecnico_id vazio ou "none" para null
      const tecnicoId = !data.tecnico_id || data.tecnico_id === "none" ? null : data.tecnico_id;
      
      // Converter centro_custo_id vazio ou "none" para null
      const centroCustoId = !data.centro_custo_id || data.centro_custo_id === "none" ? null : data.centro_custo_id;
      
      const payload = {
        numero: data.numero,
        tipo: data.tipo,
        contrato_id: data.contrato_id || null,
        centro_custo_id: centroCustoId,
        status: data.status,
        endereco: data.endereco,
        municipio: data.municipio || null,
        bairro: data.bairro || null,
        cliente_nome: data.cliente_nome || null,
        cliente_cpf: data.cliente_cpf || null,
        instalacao: data.instalacao || null,
        medidor: data.medidor || null,
        tensao_medicao: data.tensao_medicao || null,
        observacoes: data.observacoes || null,
        tecnico_id: tecnicoId,
        valor: data.valor || null,
        duracao_estimada: data.duracao_estimada || null,
        regulada: data.regulada,
        prazo: prazoTimestamp,
        data_geracao: dataGeracaoTimestamp,
        zona_cadastral: data.zona_cadastral || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        prioridade: data.prioridade || "NORMAL",
      };

      if (isEditing && ordem) {
        const { error } = await supabase
          .from("ordens_servico")
          .update(payload)
          .eq("id", ordem.id);

        if (error) throw error;
        
        // Log de edição
        logEditar("ordens", "ordens_servico", ordem.id, ordem, payload,
          `Editou OS ${payload.numero} - ${payload.tipo} - ${payload.cliente_nome || 'Sem cliente'}`);
        
        toast.success("Ordem de serviço atualizada!");
      } else {
        const { data: newData, error } = await supabase
          .from("ordens_servico")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;
        
        // Log de criação
        logCriar("ordens", "ordens_servico", newData?.id || "", payload,
          `Criou OS ${payload.numero} - ${payload.tipo} - ${payload.cliente_nome || 'Sem cliente'}`);
        
        toast.success("Ordem de serviço cadastrada!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar ordem de serviço");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número OS</FormLabel>
                    <FormControl>
                      <Input placeholder="#45821" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {!skills || skills.length === 0 ? (
                          <SelectItem value="_loading" disabled>
                            Carregando tipos...
                          </SelectItem>
                        ) : (
                          skills.map((skill) => (
                            <SelectItem 
                              key={skill.id} 
                              value={skillCodigoParaTipo(skill.codigo)}
                            >
                              {skill.nome}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contrato_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contrato *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um contrato" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contratos.length === 0 ? (
                        <SelectItem value="_loading" disabled>
                          Carregando contratos...
                        </SelectItem>
                      ) : (
                        contratos.map((contrato) => (
                          <SelectItem key={contrato.id} value={contrato.id}>
                            {contrato.codigo} - {contrato.nome}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                        <SelectItem value="atrasada">Atrasada</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tecnico_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipe</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar equipe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Não atribuída</SelectItem>
                        {tecnicos.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.codigo} - {t.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua das Flores, 123 - Centro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="municipio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Município</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Centro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Campo de Territórios - somente leitura */}
            {isEditing && territoriosNomes.length > 0 && (
              <div className="space-y-2">
                <FormLabel className="text-sm font-medium">Territórios</FormLabel>
                <Input 
                  value={territoriosNomes.join(", ")} 
                  disabled 
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Calculado automaticamente com base na localização da OS
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cliente_nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Maria Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cliente_cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="instalacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instalação</FormLabel>
                    <FormControl>
                      <Input placeholder="123456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="medidor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medidor</FormLabel>
                    <FormControl>
                      <Input placeholder="M12345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tensao_medicao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tensão de Medição</FormLabel>
                    <FormControl>
                      <Input placeholder="220V, 380V..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zona_cadastral"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zona Cadastral</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Indefinida"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Urbana">Urbana</SelectItem>
                        <SelectItem value="Rural">Rural</SelectItem>
                        <SelectItem value="Indefinida">Indefinida</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="centro_custo_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Centro de Custo</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um centro de custo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Não definido</SelectItem>
                      {centrosCusto.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="duracao_estimada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (min)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="regulada"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Regulada</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-2"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="prazo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_geracao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Geração</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "NORMAL"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="ALTA">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
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
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações Coelba</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações do sistema/Coelba..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Observações da Coelba/Sistema. As observações da equipe são inseridas via app.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
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
