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

const ordemSchema = z.object({
  numero: z.string().min(1, "Número é obrigatório").max(50),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  status: z.enum(["pendente", "andamento", "concluida", "atrasada", "cancelada"]),
  endereco: z.string().min(5, "Endereço é obrigatório").max(255),
  cliente_nome: z.string().max(100).optional(),
  cliente_cpf: z.string().max(14).optional(),
  instalacao: z.string().max(50).optional(),
  medidor: z.string().max(50).optional(),
  duracao_estimada: z.coerce.number().min(5).max(480).optional(),
  valor: z.coerce.number().min(0).optional(),
  regulada: z.boolean(),
  observacoes: z.string().max(500).optional(),
  tecnico_id: z.string().optional(),
});

type OrdemFormData = z.infer<typeof ordemSchema>;

interface OrdemServicoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem?: Tables<"ordens_servico"> | null;
  onSuccess: () => void;
}

export function OrdemServicoFormDialog({
  open,
  onOpenChange,
  ordem,
  onSuccess,
}: OrdemServicoFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tecnicos, setTecnicos] = useState<Tables<"tecnicos">[]>([]);
  const isEditing = !!ordem;

  const form = useForm<OrdemFormData>({
    resolver: zodResolver(ordemSchema),
    defaultValues: {
      numero: "",
      tipo: "corte",
      status: "pendente",
      endereco: "",
      cliente_nome: "",
      cliente_cpf: "",
      instalacao: "",
      medidor: "",
      duracao_estimada: 30,
      valor: 0,
      regulada: false,
      observacoes: "",
      tecnico_id: "",
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
    if (ordem) {
      form.reset({
        numero: ordem.numero,
        tipo: ordem.tipo,
        status: ordem.status as OrdemFormData["status"],
        endereco: ordem.endereco,
        cliente_nome: ordem.cliente_nome || "",
        cliente_cpf: ordem.cliente_cpf || "",
        instalacao: ordem.instalacao || "",
        medidor: ordem.medidor || "",
        duracao_estimada: ordem.duracao_estimada || 30,
        valor: Number(ordem.valor) || 0,
        regulada: ordem.regulada || false,
        observacoes: ordem.observacoes || "",
        tecnico_id: ordem.tecnico_id || "",
      });
    } else {
      form.reset({
        numero: "",
        tipo: "corte",
        status: "pendente",
        endereco: "",
        cliente_nome: "",
        cliente_cpf: "",
        instalacao: "",
        medidor: "",
        duracao_estimada: 30,
        valor: 0,
        regulada: false,
        observacoes: "",
        tecnico_id: "",
      });
    }
  }, [ordem, form]);

  const onSubmit = async (data: OrdemFormData) => {
    setIsLoading(true);
    try {
      const payload = {
        numero: data.numero,
        tipo: data.tipo,
        status: data.status,
        endereco: data.endereco,
        cliente_nome: data.cliente_nome || null,
        cliente_cpf: data.cliente_cpf || null,
        instalacao: data.instalacao || null,
        medidor: data.medidor || null,
        observacoes: data.observacoes || null,
        tecnico_id: data.tecnico_id || null,
        valor: data.valor || null,
        duracao_estimada: data.duracao_estimada || null,
        regulada: data.regulada,
      };

      if (isEditing && ordem) {
        const { error } = await supabase
          .from("ordens_servico")
          .update(payload)
          .eq("id", ordem.id);

        if (error) throw error;
        toast.success("Ordem de serviço atualizada!");
      } else {
        const { error } = await supabase.from("ordens_servico").insert(payload);

        if (error) throw error;
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
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="corte">Corte</SelectItem>
                        <SelectItem value="religa">Religa</SelectItem>
                        <SelectItem value="ligacao">Ligação Nova</SelectItem>
                        <SelectItem value="inspecao">Inspeção</SelectItem>
                        <SelectItem value="manutencao">Manutenção</SelectItem>
                        <SelectItem value="troca_medidor">Troca de Medidor</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar equipe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Não atribuída</SelectItem>
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

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações adicionais..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
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
