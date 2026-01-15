import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Phone, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extrairContatosComIA, type ContatoIA } from "@/lib/contatoExtractorIA";

interface ProcessarContatosIAProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ResultadoProcessamento {
  total: number;
  processadas: number;
  comContatos: number;
  erros: number;
}

export function ProcessarContatosIA({ open, onOpenChange, onSuccess }: ProcessarContatosIAProps) {
  const [etapa, setEtapa] = useState<"inicial" | "processando" | "concluido">("inicial");
  const [progresso, setProgresso] = useState(0);
  const [mensagemProgresso, setMensagemProgresso] = useState("");
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null);
  const [processarTodas, setProcessarTodas] = useState(false);

  const resetDialog = () => {
    setEtapa("inicial");
    setProgresso(0);
    setMensagemProgresso("");
    setResultado(null);
    setProcessarTodas(false);
  };

  const handleClose = () => {
    if (etapa === "processando") {
      toast.warning("Aguarde o processamento finalizar");
      return;
    }
    resetDialog();
    onOpenChange(false);
  };

  const processarContatos = async () => {
    setEtapa("processando");
    setProgresso(0);
    setMensagemProgresso("Buscando ordens de serviço...");

    try {
      // Buscar OSs que precisam de processamento
      let query = supabase
        .from("ordens_servico")
        .select("id, observacoes")
        .not("observacoes", "is", null)
        .neq("observacoes", "");

      // Se não for processar todas, apenas as sem contatos_extraidos
      if (!processarTodas) {
        query = query.is("contatos_extraidos", null);
      }

      const { data: ordens, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`Erro ao buscar OSs: ${fetchError.message}`);
      }

      if (!ordens || ordens.length === 0) {
        setMensagemProgresso("Nenhuma OS para processar");
        setResultado({ total: 0, processadas: 0, comContatos: 0, erros: 0 });
        setEtapa("concluido");
        return;
      }

      const total = ordens.length;
      let processadas = 0;
      let comContatos = 0;
      let erros = 0;

      setMensagemProgresso(`Processando ${total} ordens de serviço...`);

      // Processar em batches de 5 para não sobrecarregar
      const BATCH_SIZE = 5;
      for (let i = 0; i < ordens.length; i += BATCH_SIZE) {
        const batch = ordens.slice(i, i + BATCH_SIZE);
        
        const promises = batch.map(async (ordem) => {
          try {
            if (!ordem.observacoes) {
              return { id: ordem.id, contatos: [], sucesso: true };
            }

            const resultado = await extrairContatosComIA(ordem.observacoes);
            
            if (!resultado.sucesso) {
              console.error(`Erro ao processar OS ${ordem.id}:`, resultado.erro);
              return { id: ordem.id, contatos: [], sucesso: false };
            }

            return { id: ordem.id, contatos: resultado.contatos, sucesso: true };
          } catch (err) {
            console.error(`Erro ao processar OS ${ordem.id}:`, err);
            return { id: ordem.id, contatos: [], sucesso: false };
          }
        });

        const resultados = await Promise.all(promises);

        // Atualizar no banco em batch
        for (const res of resultados) {
          if (res.sucesso) {
            // Só salva se encontrou contatos ou se estamos reprocessando
            if (res.contatos.length > 0 || processarTodas) {
              const { error: updateError } = await supabase
                .from("ordens_servico")
                .update({ contatos_extraidos: res.contatos.length > 0 ? res.contatos : [] })
                .eq("id", res.id);

              if (updateError) {
                console.error(`Erro ao salvar contatos da OS ${res.id}:`, updateError);
                erros++;
              } else {
                processadas++;
                if (res.contatos.length > 0) {
                  comContatos++;
                }
              }
            } else {
              processadas++;
            }
          } else {
            erros++;
          }
        }

        // Atualizar progresso
        const progressoAtual = Math.round(((i + batch.length) / total) * 100);
        setProgresso(progressoAtual);
        setMensagemProgresso(`Processando... ${i + batch.length} de ${total} OSs`);

        // Pequena pausa entre batches
        if (i + BATCH_SIZE < ordens.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      setResultado({ total, processadas, comContatos, erros });
      setMensagemProgresso("Processamento concluído!");
      setEtapa("concluido");
      
      if (processadas > 0 && onSuccess) {
        onSuccess();
      }

      toast.success(`${comContatos} OSs com contatos identificados`);

    } catch (error: any) {
      console.error("Erro no processamento:", error);
      toast.error(error.message || "Erro ao processar contatos");
      setEtapa("inicial");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Extrair Contatos com IA
          </DialogTitle>
          <DialogDescription>
            Usa inteligência artificial (Gemini) para identificar telefones e nomes de contato nas observações das OSs.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {etapa === "inicial" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  A IA irá analisar as observações e extrair automaticamente:
                </p>
                <ul className="text-sm text-amber-700 mt-2 space-y-1">
                  <li className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    Números de telefone (celular e fixo)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" />
                    Nomes dos contatos
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" />
                    Relação (cliente, vizinho, porteiro, etc.)
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="processarTodas"
                  checked={processarTodas}
                  onChange={(e) => setProcessarTodas(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="processarTodas" className="text-sm text-gray-600">
                  Reprocessar OSs que já foram analisadas
                </label>
              </div>
            </div>
          )}

          {etapa === "processando" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                <span className="text-sm text-muted-foreground">{mensagemProgresso}</span>
              </div>
              <Progress value={progresso} className="h-2" />
              <p className="text-center text-xs text-muted-foreground">
                {progresso}% concluído
              </p>
            </div>
          )}

          {etapa === "concluido" && resultado && (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-slate-900">{resultado.total}</div>
                  <div className="text-xs text-muted-foreground">Total de OSs</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{resultado.comContatos}</div>
                  <div className="text-xs text-muted-foreground">Com contatos</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{resultado.processadas}</div>
                  <div className="text-xs text-muted-foreground">Processadas</div>
                </div>
                {resultado.erros > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{resultado.erros}</div>
                    <div className="text-xs text-muted-foreground">Erros</div>
                  </div>
                )}
              </div>

              {resultado.comContatos > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Os contatos extraídos estarão disponíveis no app, inclusive offline!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {etapa === "inicial" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={processarContatos} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Iniciar Processamento
              </Button>
            </>
          )}

          {etapa === "concluido" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
              {resultado && resultado.total > 0 && (
                <Button onClick={() => { resetDialog(); setEtapa("inicial"); }} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Processar Novamente
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
