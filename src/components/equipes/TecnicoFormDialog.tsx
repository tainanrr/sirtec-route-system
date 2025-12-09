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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const tecnicoSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório").max(20),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  telefone: z.string().max(20).optional(),
  status: z.enum(["disponivel", "em_servico", "pausa", "offline"]),
});

type TecnicoFormData = z.infer<typeof tecnicoSchema>;

interface TecnicoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tecnico?: Tables<"tecnicos"> | null;
  onSuccess: () => void;
}

const habilidadesDisponiveis = [
  "Corte",
  "Religa",
  "Ligação Nova",
  "Inspeção",
  "Manutenção",
  "Troca de Medidor",
  "Vistoria",
];

export function TecnicoFormDialog({
  open,
  onOpenChange,
  tecnico,
  onSuccess,
}: TecnicoFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [habilidades, setHabilidades] = useState<string[]>([]);
  const isEditing = !!tecnico;

  const form = useForm<TecnicoFormData>({
    resolver: zodResolver(tecnicoSchema),
    defaultValues: {
      codigo: "",
      nome: "",
      telefone: "",
      status: "disponivel",
    },
  });

  useEffect(() => {
    if (tecnico) {
      form.reset({
        codigo: tecnico.codigo,
        nome: tecnico.nome,
        telefone: tecnico.telefone || "",
        status: tecnico.status as TecnicoFormData["status"],
      });
      setHabilidades(tecnico.habilidades || []);
    } else {
      form.reset({
        codigo: "",
        nome: "",
        telefone: "",
        status: "disponivel",
      });
      setHabilidades([]);
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
      if (isEditing && tecnico) {
        const { error } = await supabase
          .from("tecnicos")
          .update({
            codigo: data.codigo,
            nome: data.nome,
            telefone: data.telefone || null,
            status: data.status,
            habilidades,
          })
          .eq("id", tecnico.id);

        if (error) throw error;
        toast.success("Técnico atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("tecnicos").insert({
          codigo: data.codigo,
          nome: data.nome,
          telefone: data.telefone || null,
          status: data.status,
          habilidades,
        });

        if (error) throw error;
        toast.success("Técnico cadastrado com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar técnico");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Técnico" : "Novo Técnico"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="João da Silva" {...field} />
                  </FormControl>
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
              <FormLabel>Habilidades</FormLabel>
              <div className="flex flex-wrap gap-2">
                {habilidadesDisponiveis.map((hab) => (
                  <Badge
                    key={hab}
                    variant={habilidades.includes(hab) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleHabilidade(hab)}
                  >
                    {hab}
                    {habilidades.includes(hab) && (
                      <X className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>

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
