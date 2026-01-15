import { useMemo, useState } from "react";
import { Phone, MessageCircle, User, ChevronDown, ChevronUp, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  extrairContatos,
  gerarLinkTelefone,
  gerarLinkWhatsApp,
  type ContatoExtraido,
  type DadosOrdemServico,
} from "@/lib/contatoExtractor";

interface ContatosExtraidosProps {
  /** Texto da observação Coelba para extrair contatos */
  observacoes: string | null | undefined;
  /** Dados da ordem de serviço para mensagem do WhatsApp */
  dadosOrdem: DadosOrdemServico;
  /** Se deve mostrar sempre ou apenas quando há contatos */
  mostrarVazio?: boolean;
  /** Classe CSS adicional */
  className?: string;
}

interface ContatoItemProps {
  contato: ContatoExtraido;
  dadosOrdem: DadosOrdemServico;
  isExpanded: boolean;
  onToggle: () => void;
}

function ContatoItem({ contato, dadosOrdem, isExpanded, onToggle }: ContatoItemProps) {
  const [copiado, setCopiado] = useState(false);

  const handleCopiar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(contato.numeroFormatado);
      setCopiado(true);
      toast.success("Número copiado!");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleLigar = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = gerarLinkTelefone(contato.numeroLimpo);
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(gerarLinkWhatsApp(contato.numeroLimpo, dadosOrdem), "_blank");
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
      {/* Header do contato */}
      <div
        className="p-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {/* Avatar/Ícone */}
          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            contato.tipo === "celular" 
              ? "bg-gradient-to-br from-green-400 to-emerald-500" 
              : "bg-gradient-to-br from-blue-400 to-indigo-500"
          }`}>
            {contato.nome ? (
              <span className="text-white font-bold text-sm">
                {contato.nome.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User className="h-5 w-5 text-white" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 truncate">
                {contato.nome || "Contato"}
              </span>
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
            <p className="text-sm text-slate-600 font-mono">
              {contato.numeroFormatado}
            </p>
          </div>

          {/* Botões de ação rápida */}
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
              onClick={onToggle}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo expandido */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-100 bg-slate-50/50">
          {/* Contexto onde foi encontrado */}
          {contato.contexto && (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">
                Trecho da observação
              </p>
              <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200 italic">
                "...{contato.contexto}..."
              </p>
            </div>
          )}

          {/* Botões de ação completos */}
          <div className="flex gap-2 mt-3">
            <Button
              className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              onClick={handleLigar}
            >
              <Phone className="h-4 w-4 mr-2" />
              Ligar
            </Button>
            
            {contato.tipo === "celular" && (
              <Button
                className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white font-medium"
                onClick={handleWhatsApp}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            )}

            <Button
              variant="outline"
              className="h-10 px-3"
              onClick={handleCopiar}
            >
              {copiado ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContatosExtraidos({
  observacoes,
  dadosOrdem,
  mostrarVazio = false,
  className = "",
}: ContatosExtraidosProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  // Extrai contatos da observação
  const contatos = useMemo(() => {
    return extrairContatos(observacoes);
  }, [observacoes]);

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

  const handleToggle = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-medium text-slate-700">
          {contatos.length} contato{contatos.length > 1 ? "s" : ""} identificado{contatos.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Lista de contatos */}
      <div className="space-y-2">
        {contatos.map((contato, index) => (
          <ContatoItem
            key={`${contato.numeroLimpo}-${index}`}
            contato={contato}
            dadosOrdem={dadosOrdem}
            isExpanded={expandedIndex === index}
            onToggle={() => handleToggle(index)}
          />
        ))}
      </div>
    </div>
  );
}
