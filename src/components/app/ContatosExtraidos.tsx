import { useMemo, useState } from "react";
import { Phone, MessageCircle, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  gerarLinkTelefone,
  gerarLinkWhatsApp,
  type ContatoIA,
} from "@/lib/contatoExtractorLocal";

interface ContatosExtraidosProps {
  /** Contatos pré-processados (do banco) */
  contatosExtraidos?: ContatoIA[] | null;
  /** Dados da ordem de serviço para mensagem do WhatsApp */
  dadosOrdem: {
    numero: string;
    endereco: string;
    tipoServico: string;
    clienteNome?: string;
  };
  /** Se deve mostrar sempre ou apenas quando há contatos */
  mostrarVazio?: boolean;
  /** Classe CSS adicional */
  className?: string;
}

function ContatoItem({ contato, dadosOrdem }: { contato: ContatoIA; dadosOrdem: { numero: string; endereco: string; tipoServico: string } }) {
  const [copiado, setCopiado] = useState(false);

  const handleCopiar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(contato.telefone);
      setCopiado(true);
      toast.success("Número copiado!");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleLigar = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = gerarLinkTelefone(contato.telefoneLimpo);
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(gerarLinkWhatsApp(contato.telefoneLimpo, dadosOrdem), "_blank");
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-3">
        <div className="flex items-center gap-3">
          {/* Ícone do tipo */}
          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            contato.tipo === "celular" 
              ? "bg-gradient-to-br from-green-400 to-emerald-500" 
              : "bg-gradient-to-br from-blue-400 to-indigo-500"
          }`}>
            <Phone className="h-5 w-5 text-white" />
          </div>

          {/* Número e tipo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className={`text-[10px] px-1.5 py-0 h-4 ${
                  contato.tipo === "celular" 
                    ? "bg-green-100 text-green-700" 
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {contato.tipo === "celular" ? "Celular" : "Fixo"}
              </Badge>
            </div>
            <p className="text-sm text-slate-900 font-mono font-medium mt-0.5">
              {contato.telefone}
            </p>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600"
              onClick={handleLigar}
              title="Ligar"
            >
              <Phone className="h-4 w-4" />
            </Button>
            
            {contato.tipo === "celular" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full bg-green-50 hover:bg-green-100 text-green-600"
                onClick={handleWhatsApp}
                title="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-600"
              onClick={handleCopiar}
              title="Copiar número"
            >
              {copiado ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContatosExtraidos({
  contatosExtraidos,
  dadosOrdem,
  mostrarVazio = false,
  className = "",
}: ContatosExtraidosProps) {
  // Usar contatos pré-processados e remover duplicatas
  const contatos = useMemo(() => {
    if (!contatosExtraidos || !Array.isArray(contatosExtraidos)) {
      return [];
    }

    // Remover duplicatas por telefoneLimpo
    const telefonesVistos = new Set<string>();
    const contatosUnicos: ContatoIA[] = [];

    for (const contato of contatosExtraidos) {
      // Garantir que o contato tem os campos necessários
      if (!contato.telefoneLimpo && !contato.telefone) continue;
      
      const telefoneChave = contato.telefoneLimpo || contato.telefone.replace(/\D/g, "");
      
      if (!telefonesVistos.has(telefoneChave)) {
        telefonesVistos.add(telefoneChave);
        contatosUnicos.push({
          ...contato,
          telefoneLimpo: telefoneChave,
        });
      }
    }

    // Ordenar: celulares primeiro
    return contatosUnicos.sort((a, b) => {
      if (a.tipo === "celular" && b.tipo !== "celular") return -1;
      if (a.tipo !== "celular" && b.tipo === "celular") return 1;
      return 0;
    });
  }, [contatosExtraidos]);

  // Se não há contatos e não deve mostrar vazio, não renderiza nada
  if (contatos.length === 0 && !mostrarVazio) {
    return null;
  }

  // Se não há contatos mas deve mostrar vazio
  if (contatos.length === 0 && mostrarVazio) {
    return (
      <div className={`p-3 bg-slate-50 rounded-lg border border-dashed border-slate-300 ${className}`}>
        <p className="text-xs text-slate-500 text-center">
          Nenhum telefone identificado nas observações
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-medium text-slate-700">
          {contatos.length > 1 
            ? `${contatos.length} possíveis telefones identificados nas Observações`
            : "Possível telefone identificado nas Observações"
          }
        </span>
      </div>

      {/* Lista de contatos */}
      <div className="space-y-2">
        {contatos.map((contato, index) => (
          <ContatoItem
            key={`${contato.telefoneLimpo}-${index}`}
            contato={contato}
            dadosOrdem={dadosOrdem}
          />
        ))}
      </div>
    </div>
  );
}
