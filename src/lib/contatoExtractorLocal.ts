/**
 * Extração de contatos usando REGEX - 100% local, sem API, funciona offline
 * Identifica telefones e tenta associar nomes baseado em contexto
 */

export interface ContatoIA {
  /** Número de telefone formatado */
  telefone: string;
  /** Número limpo (apenas dígitos com DDD) */
  telefoneLimpo: string;
  /** Tipo: celular ou fixo */
  tipo: "celular" | "fixo";
}

export interface ResultadoExtracaoIA {
  /** Contatos identificados */
  contatos: ContatoIA[];
  /** Se processou com sucesso */
  sucesso: boolean;
  /** Mensagem de erro se houver */
  erro?: string;
}

// Padrões de telefone brasileiro
const PADROES_TELEFONE = [
  // (71) 99999-9999 ou (71) 9999-9999
  /\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/g,
  // 71 99999-9999 ou 71 9999-9999
  /\b\d{2}\s+9?\d{4}[-.\s]?\d{4}\b/g,
  // 99999-9999 ou 9999-9999 (sem DDD)
  /\b9?\d{4}[-.\s]?\d{4}\b/g,
  // 71999999999 ou 7199999999 (tudo junto)
  /\b\d{10,11}\b/g,
];


/**
 * Normaliza um número de telefone
 */
function normalizarTelefone(numero: string): { limpo: string; formatado: string; tipo: "celular" | "fixo" } | null {
  // Remove tudo que não é dígito
  let limpo = numero.replace(/\D/g, "");
  
  // Remove 0 inicial se existir (prefixo de discagem)
  if (limpo.startsWith("0") && limpo.length > 10) {
    limpo = limpo.substring(1);
  }
  
  // Se tem 55 no início (código do país), remove
  if (limpo.startsWith("55") && limpo.length > 11) {
    limpo = limpo.substring(2);
  }
  
  // Se não tem DDD, adiciona 71 (Salvador/BA) como padrão
  if (limpo.length === 8 || limpo.length === 9) {
    limpo = "71" + limpo;
  }
  
  // Validar tamanho (10 ou 11 dígitos)
  if (limpo.length < 10 || limpo.length > 11) {
    return null;
  }
  
  // Validar DDD (11-99)
  const ddd = parseInt(limpo.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return null;
  }
  
  // Determina se é celular ou fixo
  const tipo: "celular" | "fixo" = limpo.length === 11 && limpo[2] === "9" ? "celular" : "fixo";
  
  // Formata para exibição
  let formatado = limpo;
  if (limpo.length === 11) {
    formatado = `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  } else if (limpo.length === 10) {
    formatado = `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  
  return { limpo, formatado, tipo };
}


/**
 * Extrai contatos de uma observação usando REGEX (100% local)
 */
export function extrairContatosComIA(observacao: string): ResultadoExtracaoIA {
  if (!observacao || observacao.trim().length < 5) {
    return { contatos: [], sucesso: true };
  }

  try {
    const telefonesEncontrados = new Map<string, { posicao: number; original: string }>();
    
    // Aplicar todos os padrões de telefone
    for (const padrao of PADROES_TELEFONE) {
      let match;
      const regex = new RegExp(padrao.source, padrao.flags);
      while ((match = regex.exec(observacao)) !== null) {
        const numeroOriginal = match[0];
        const normalizado = normalizarTelefone(numeroOriginal);
        
        if (normalizado && !telefonesEncontrados.has(normalizado.limpo)) {
          telefonesEncontrados.set(normalizado.limpo, {
            posicao: match.index,
            original: numeroOriginal,
          });
        }
      }
    }
    
    // Processar cada telefone encontrado
    const contatos: ContatoIA[] = [];
    
    for (const [limpo, { original }] of telefonesEncontrados) {
      const normalizado = normalizarTelefone(original);
      if (!normalizado) continue;
      
      contatos.push({
        telefone: normalizado.formatado,
        telefoneLimpo: normalizado.limpo,
        tipo: normalizado.tipo,
      });
    }
    
    // Ordenar: celulares primeiro
    contatos.sort((a, b) => {
      if (a.tipo === "celular" && b.tipo !== "celular") return -1;
      if (a.tipo !== "celular" && b.tipo === "celular") return 1;
      return 0;
    });
    
    return { contatos, sucesso: true };
  } catch (error: any) {
    console.error("[ContatoExtractorLocal] Erro:", error);
    return { 
      contatos: [], 
      sucesso: false, 
      erro: error.message || "Erro ao processar" 
    };
  }
}

/**
 * Gera link para ligação telefônica
 */
export function gerarLinkTelefone(numero: string): string {
  const limpo = numero.replace(/\D/g, "");
  return `tel:+55${limpo}`;
}

/**
 * Gera link para WhatsApp com mensagem pré-preenchida
 */
export function gerarLinkWhatsApp(
  numero: string, 
  dados: { numero: string; endereco: string; tipoServico: string }
): string {
  const limpo = numero.replace(/\D/g, "");
  
  const mensagem = `Bom dia! Meu nome é técnico da empresa *SIRTEC*, prestadora de serviços da *COELBA*.

Estou entrando em contato referente à Ordem de Serviço nº *${dados.numero}*, agendada para o endereço *${dados.endereco}*.

O serviço a ser realizado é: *${dados.tipoServico}*.

Por gentileza, haverá alguém no local para nos receber? Caso não seja possível, poderia indicar um contato alternativo?

Agradeço desde já pela atenção.`;
  
  const mensagemCodificada = encodeURIComponent(mensagem);
  return `https://wa.me/55${limpo}?text=${mensagemCodificada}`;
}
