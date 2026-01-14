import { useState, useEffect, useRef } from "react";
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
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";

// Função para normalizar código (remover acentos, uppercase, sem espaços)
const normalizarCodigo = (codigo: string): string => {
  return codigo
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^A-Z0-9_]/g, '_') // Substitui caracteres especiais por underscore
    .replace(/_+/g, '_') // Remove underscores duplicados
    .replace(/^_|_$/g, ''); // Remove underscores no início e fim
};

const skillSchema = z.object({
  codigo: z.string()
    .min(1, "Código é obrigatório")
    .max(50)
    .refine(
      (val) => /^[A-Z0-9_]+$/.test(val),
      "Código deve conter apenas letras maiúsculas, números e underscore (sem acentos ou espaços)"
    ),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  descricao: z.string().max(500).optional(),
  tempo_execucao_minutos: z.number().min(1, "Tempo mínimo é 1 minuto").max(1440, "Tempo máximo é 1440 minutos (24h)"),
  valor: z.number().min(0, "Valor não pode ser negativo").default(0),
  regulada: z.boolean().default(false),
  icone: z.string().optional().nullable(),
  icone_url: z.string().optional().nullable(),
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
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      icone_url: undefined,
      ativo: true,
      cor: "#3b82f6",
    },
  });

  useEffect(() => {
    if (skill) {
      const iconeUrl = (skill as any).icone_url;
      form.reset({
        codigo: skill.codigo,
        nome: skill.nome,
        descricao: skill.descricao || "",
        tempo_execucao_minutos: skill.tempo_execucao_minutos,
        valor: skill.valor || 0,
        regulada: skill.regulada || false,
        icone: skill.icone || undefined,
        icone_url: iconeUrl || undefined,
        ativo: skill.ativo,
        cor: skill.cor || "#3b82f6",
      });
      setPreviewUrl(iconeUrl || null);
    } else {
      form.reset({
        codigo: "",
        nome: "",
        descricao: "",
        tempo_execucao_minutos: 15,
        valor: 0,
        regulada: false,
        icone: undefined,
        icone_url: undefined,
        ativo: true,
        cor: "#3b82f6",
      });
      setPreviewUrl(null);
    }
  }, [skill, form, open]);

  // Upload de imagem para o Supabase Storage
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Use PNG, JPG, GIF, SVG ou WebP.");
      return;
    }

    // Validar tamanho (max 1MB)
    if (file.size > 1048576) {
      toast.error("Arquivo muito grande. Máximo 1MB.");
      return;
    }

    setIsUploading(true);
    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `icons/${fileName}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('skill-icons')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('skill-icons')
        .getPublicUrl(filePath);

      // Atualizar form e preview
      form.setValue('icone_url', publicUrl);
      setPreviewUrl(publicUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao enviar imagem:", error);
      toast.error("Erro ao enviar imagem: " + (error.message || "Tente novamente"));
    } finally {
      setIsUploading(false);
    }
  };

  // Remover imagem
  const handleRemoveImage = () => {
    form.setValue('icone_url', undefined);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: SkillFormData) => {
    setIsLoading(true);
    try {
      const skillData = {
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao || null,
        tempo_execucao_minutos: data.tempo_execucao_minutos,
        valor: data.valor,
        regulada: data.regulada,
        icone: data.icone || null,
        icone_url: data.icone_url || null,
        ativo: data.ativo,
        cor: data.cor,
      };

      if (isEditing && skill) {
        const { error } = await supabase
          .from("skills")
          .update({
            ...skillData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", skill.id);

        if (error) throw error;
        toast.success("Skill atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("skills").insert(skillData);

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
                        className="font-mono uppercase"
                        onChange={(e) => {
                          // Normalizar em tempo real: uppercase, sem acentos, sem espaços
                          const valor = e.target.value
                            .toUpperCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                            .replace(/[^A-Z0-9_]/g, '_') // Caracteres especiais viram underscore
                            .replace(/_+/g, '_') // Remove underscores duplicados
                            .replace(/^_/, ''); // Remove underscore no início
                          field.onChange(valor);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Código único da skill. Apenas letras maiúsculas, números e underscore. Não pode ser alterado após criação.
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

            {/* Upload de Ícone Personalizado */}
            <FormField
              control={form.control}
              name="icone_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ícone Personalizado (Imagem)</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      {/* Preview */}
                      {previewUrl ? (
                        <div className="relative inline-block">
                          <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                            <img 
                              src={previewUrl} 
                              alt="Preview do ícone" 
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={handleRemoveImage}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-border bg-muted/50 flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {isUploading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                      )}

                      {/* Botão de upload */}
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          {previewUrl ? "Alterar imagem" : "Enviar imagem"}
                        </Button>
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Imagem personalizada para o ícone no mapa (PNG, JPG, GIF, SVG, WebP - máx 1MB). 
                    Se não definida, será usado o ícone padrão.
                  </FormDescription>
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

