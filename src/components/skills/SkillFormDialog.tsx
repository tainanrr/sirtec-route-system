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
import * as LucideIcons from "lucide-react";
import { clearSkillsCache } from "@/lib/skillsUtils";

const skillSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório").max(50),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  descricao: z.string().max(500).optional(),
  tempo_execucao_minutos: z.number().min(1, "Tempo mínimo é 1 minuto").max(1440, "Tempo máximo é 1440 minutos (24h)"),
  valor: z.number().min(0, "Valor não pode ser negativo").default(0),
  regulada: z.boolean().default(false),
  icone: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida (use formato hexadecimal)").default("#3b82f6"),
});

// Lista de ícones disponíveis do Lucide React
const iconesDisponiveis = [
  { value: "Zap", label: "⚡ Zap (Raio)" },
  { value: "Power", label: "🔌 Power (Energia)" },
  { value: "AlertCircle", label: "⚠️ AlertCircle (Alerta)" },
  { value: "CheckCircle", label: "✅ CheckCircle (Concluído)" },
  { value: "Wrench", label: "🔧 Wrench (Ferramenta)" },
  { value: "Settings", label: "⚙️ Settings (Configurações)" },
  { value: "Search", label: "🔍 Search (Busca/Inspeção)" },
  { value: "Clipboard", label: "📋 Clipboard (Checklist)" },
  { value: "FileText", label: "📄 FileText (Documento)" },
  { value: "MapPin", label: "📍 MapPin (Localização)" },
  { value: "Home", label: "🏠 Home (Casa)" },
  { value: "Building", label: "🏢 Building (Prédio)" },
  { value: "Tool", label: "🛠️ Tool (Ferramenta)" },
  { value: "Plug", label: "🔌 Plug (Tomada)" },
  { value: "Bolt", label: "⚡ Bolt (Relâmpago)" },
  { value: "Shield", label: "🛡️ Shield (Proteção)" },
  { value: "AlertTriangle", label: "⚠️ AlertTriangle (Atenção)" },
  { value: "Info", label: "ℹ️ Info (Informação)" },
];

type SkillFormData = z.infer<typeof skillSchema>;

interface SkillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill?: Tables<"skills"> | null;
  onSuccess: () => void;
}

export function SkillFormDialog({
  open,
  onOpenChange,
  skill,
  onSuccess,
}: SkillFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!skill;

  const form = useForm<SkillFormData>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      codigo: "",
      nome: "",
      descricao: "",
      tempo_execucao_minutos: 15,
      valor: 0,
      regulada: false,
      icone: undefined,
      ativo: true,
      cor: "#3b82f6",
    },
  });

  useEffect(() => {
    if (skill) {
      form.reset({
        codigo: skill.codigo,
        nome: skill.nome,
        descricao: skill.descricao || "",
        tempo_execucao_minutos: skill.tempo_execucao_minutos,
        valor: skill.valor || 0,
        regulada: skill.regulada || false,
        icone: skill.icone || undefined,
        ativo: skill.ativo,
        cor: skill.cor || "#3b82f6",
      });
    } else {
      form.reset({
        codigo: "",
        nome: "",
        descricao: "",
        tempo_execucao_minutos: 15,
        valor: 0,
        regulada: false,
        icone: undefined,
        ativo: true,
        cor: "#3b82f6",
      });
    }
  }, [skill, form, open]);

  const onSubmit = async (data: SkillFormData) => {
    setIsLoading(true);
    try {
      if (isEditing && skill) {
        const { error } = await supabase
          .from("skills")
          .update({
            codigo: data.codigo,
            nome: data.nome,
            descricao: data.descricao || null,
            tempo_execucao_minutos: data.tempo_execucao_minutos,
            valor: data.valor,
            regulada: data.regulada,
            icone: data.icone || null,
            ativo: data.ativo,
            cor: data.cor,
            updated_at: new Date().toISOString(),
          })
          .eq("id", skill.id);

        if (error) throw error;
        toast.success("Skill atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("skills").insert({
          codigo: data.codigo,
          nome: data.nome,
          descricao: data.descricao || null,
          tempo_execucao_minutos: data.tempo_execucao_minutos,
          valor: data.valor,
          regulada: data.regulada,
          icone: data.icone || null,
          ativo: data.ativo,
          cor: data.cor,
        });

        if (error) throw error;
        toast.success("Skill criada com sucesso!");
      }

      // Limpar cache de skills para forçar atualização
      clearSkillsCache();
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar skill:", error);
      toast.error(error.message || "Erro ao salvar skill");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Skill" : "Nova Skill"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: CORTE, RELIGA"
                        {...field}
                        disabled={isEditing}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      Código único da skill (não pode ser alterado após criação)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Corte de Energia" {...field} />
                    </FormControl>
                    <FormDescription>Nome completo da skill</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o que esta skill representa..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>Descrição opcional da skill</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tempo_execucao_minutos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tempo de Execução (minutos) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Tempo médio de execução em minutos. Este tempo será usado na roteirização.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </FormControl>
                    <FormDescription>
                      Valor padrão da skill em reais. Este valor pode ser usado como referência na criação de OSs.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="regulada"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Nota Regulada</FormLabel>
                      <FormDescription>
                        Marque se esta skill representa uma nota regulada
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="icone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ícone</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        // Converter "none" para undefined/null
                        field.onChange(value === "none" ? undefined : value);
                      }} 
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um ícone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {iconesDisponiveis.map((icone) => (
                          <SelectItem key={icone.value} value={icone.value}>
                            {icone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Ícone para visualização da skill na interface
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="cor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        {...field}
                        className="w-20 h-10"
                      />
                      <Input
                        placeholder="#3b82f6"
                        {...field}
                        className="font-mono"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Cor para visualização no mapa/UI</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Skill Ativa</FormLabel>
                    <FormDescription>
                      Skills inativas não aparecerão nas opções de seleção
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

