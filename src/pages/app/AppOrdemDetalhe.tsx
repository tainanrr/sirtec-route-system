import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  User,
  Phone,
  Clock,
  Play,
  Pause,
  CheckCircle,
  Camera,
  Navigation,
  FileText,
  Package,
} from "lucide-react";
import { format } from "date-fns";

export default function AppOrdemDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [observacao, setObservacao] = useState("");

  const { data: ordem, isLoading } = useQuery({
    queryKey: ["ordem-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: anexos } = useQuery({
    queryKey: ["ordem-anexos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordem_anexos")
        .select("*")
        .eq("ordem_servico_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const updates: Record<string, unknown> = { status: newStatus };

      if (newStatus === "em_andamento" && ordem?.status === "pendente") {
        updates.iniciado_at = new Date().toISOString();
      } else if (newStatus === "concluida") {
        updates.concluido_at = new Date().toISOString();
        if (ordem?.iniciado_at) {
          const inicio = new Date(ordem.iniciado_at);
          const fim = new Date();
          updates.tempo_total_minutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);
        }
      }

      if (observacao) {
        updates.observacoes = ordem?.observacoes
          ? `${ordem.observacoes}\n\n[${format(new Date(), "dd/MM HH:mm")}] ${observacao}`
          : `[${format(new Date(), "dd/MM HH:mm")}] ${observacao}`;
      }

      const { error } = await supabase
        .from("ordens_servico")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["ordem-detalhe", id] });
      queryClient.invalidateQueries({ queryKey: ["ordens-app"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-hoje-app"] });
      setObservacao("");

      const messages: Record<string, string> = {
        em_andamento: "Serviço iniciado!",
        pausado: "Serviço pausado",
        concluida: "Serviço concluído com sucesso!",
      };
      toast.success(messages[newStatus] || "Status atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("service-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("service-attachments")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("ordem_anexos").insert({
        ordem_servico_id: id,
        tipo: "foto",
        url: urlData.publicUrl,
        descricao: "Foto do serviço",
      });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordem-anexos", id] });
      toast.success("Foto enviada!");
    },
    onError: () => {
      toast.error("Erro ao enviar foto");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const openNavigation = () => {
    if (ordem?.latitude && ordem?.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${ordem.latitude},${ordem.longitude}`,
        "_blank"
      );
    } else if (ordem?.endereco) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ordem.endereco)}`,
        "_blank"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!ordem) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="text-center py-8 text-muted-foreground">
          Ordem não encontrada
        </div>
      </div>
    );
  }

  const statusConfig = {
    pendente: { label: "Pendente", variant: "secondary" as const },
    em_andamento: { label: "Em Andamento", variant: "default" as const },
    concluida: { label: "Concluída", variant: "outline" as const },
    cancelada: { label: "Cancelada", variant: "destructive" as const },
  };

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{ordem.numero}</span>
            <Badge variant={statusConfig[ordem.status as keyof typeof statusConfig]?.variant}>
              {statusConfig[ordem.status as keyof typeof statusConfig]?.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{ordem.tipo}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Endereço e Navegação */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{ordem.endereco}</p>
                {ordem.cliente_nome && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <User className="h-3 w-3 inline mr-1" />
                    {ordem.cliente_nome}
                  </p>
                )}
              </div>
            </div>
            <Button className="w-full mt-3" variant="outline" onClick={openNavigation}>
              <Navigation className="h-4 w-4 mr-2" />
              Navegar até o local
            </Button>
          </CardContent>
        </Card>

        {/* Detalhes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {ordem.instalacao && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Instalação:</span>
                <span className="font-mono">{ordem.instalacao}</span>
              </div>
            )}
            {ordem.medidor && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Medidor:</span>
                <span className="font-mono">{ordem.medidor}</span>
              </div>
            )}
            {ordem.duracao_estimada && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duração estimada:</span>
                <span>{ordem.duracao_estimada} min</span>
              </div>
            )}
            {ordem.prazo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prazo:</span>
                <span>{format(new Date(ordem.prazo), "dd/MM/yyyy HH:mm")}</span>
              </div>
            )}
            {ordem.observacoes && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground mb-1">Observações:</p>
                <p className="whitespace-pre-wrap">{ordem.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fotos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Fotos ({anexos?.length || 0})</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                <Camera className="h-4 w-4 mr-1" />
                {uploadMutation.isPending ? "Enviando..." : "Adicionar"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            {anexos && anexos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {anexos.map((anexo) => (
                  <img
                    key={anexo.id}
                    src={anexo.url}
                    alt={anexo.descricao || "Foto"}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma foto adicionada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Observação */}
        {ordem.status !== "concluida" && ordem.status !== "cancelada" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Observações do Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Adicione observações sobre o serviço..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        )}

        {/* Ações */}
        {ordem.status !== "concluida" && ordem.status !== "cancelada" && (
          <div className="space-y-2">
            {ordem.status === "pendente" && (
              <Button
                className="w-full"
                size="lg"
                onClick={() => updateStatusMutation.mutate("em_andamento")}
                disabled={updateStatusMutation.isPending}
              >
                <Play className="h-5 w-5 mr-2" />
                Iniciar Serviço
              </Button>
            )}

            {ordem.status === "em_andamento" && (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => updateStatusMutation.mutate("concluida")}
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Concluir Serviço
                </Button>
              </>
            )}
          </div>
        )}

        {/* Status Concluído */}
        {ordem.status === "concluida" && (
          <Card className="bg-success/10 border-success/20">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-2" />
              <p className="font-medium text-success">Serviço Concluído</p>
              {ordem.tempo_total_minutos && (
                <p className="text-sm text-muted-foreground">
                  Tempo total: {ordem.tempo_total_minutos} minutos
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
