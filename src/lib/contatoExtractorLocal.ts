/**
 * Extração de contatos usando REGEX - 100% local, sem API, funciona offline
 * Identifica telefones e tenta associar nomes baseado em contexto
 */

export interface ContatoIA {
  /** Nome do contato identificado */
  nome: string | null;
  /** Número de telefone formatado */
  telefone: string;
  /** Número limpo (apenas dígitos com DDD) */
  telefoneLimpo: string;
  /** Tipo: celular ou fixo */
  tipo: "celular" | "fixo";
  /** Relação do contato (cliente, vizinho, porteiro, etc.) */
  relacao?: string;
  /** Contexto/observação sobre o contato */
  observacao?: string;
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

// Palavras que indicam relação com o contato
const PALAVRAS_RELACAO: Record<string, string> = {
  'cliente': 'cliente',
  'proprietario': 'proprietário',
  'proprietária': 'proprietária',
  'morador': 'morador',
  'moradora': 'moradora',
  'vizinho': 'vizinho',
  'vizinha': 'vizinha',
  'porteiro': 'porteiro',
  'porteira': 'porteira',
  'sindico': 'síndico',
  'sindica': 'síndica',
  'zelador': 'zelador',
  'zeladora': 'zeladora',
  'responsavel': 'responsável',
  'esposa': 'esposa',
  'esposo': 'esposo',
  'marido': 'marido',
  'filho': 'filho',
  'filha': 'filha',
  'mae': 'mãe',
  'pai': 'pai',
  'irmao': 'irmão',
  'irma': 'irmã',
  'inquilino': 'inquilino',
  'inquilina': 'inquilina',
  'locatario': 'locatário',
  'locataria': 'locatária',
  'contato': 'contato',
  'falar': 'contato',
  'ligar': 'contato',
  'celular': 'contato',
  'telefone': 'contato',
  'whatsapp': 'contato',
  'whats': 'contato',
  'zap': 'contato',
};

// Padrões de nomes (palavras capitalizadas ou em maiúsculo)
const PADRAO_NOME = /\b([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ][a-záàâãéèêíïóôõöúçñ]+(?:\s+(?:da|de|do|dos|das|e)?\s*[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ][a-záàâãéèêíïóôõöúçñ]+)*)\b/g;
const PADRAO_NOME_MAIUSCULO = /\b([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]{2,}(?:\s+(?:DA|DE|DO|DOS|DAS|E)?\s*[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]{2,})*)\b/g;

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
 * Encontra nomes próximos a um telefone no texto
 */
function encontrarNomeProximo(texto: string, posicaoTelefone: number): string | null {
  // Pegar contexto ao redor do telefone (100 chars antes e depois)
  const inicio = Math.max(0, posicaoTelefone - 100);
  const fim = Math.min(texto.length, posicaoTelefone + 50);
  const contexto = texto.substring(inicio, fim);
  
  // Procurar nomes no contexto (priorizar antes do número)
  const nomesMaiusculo = contexto.match(PADRAO_NOME_MAIUSCULO) || [];
  const nomesNormais = contexto.match(PADRAO_NOME) || [];
  
  // Filtrar nomes muito curtos ou que são palavras comuns
  const palavrasIgnorar = new Set([
    'COELBA', 'BAHIA', 'SALVADOR', 'RUA', 'AV', 'AVENIDA', 'TRAVESSA', 
    'CONTATO', 'TELEFONE', 'CELULAR', 'WHATSAPP', 'LIGAR', 'FALAR',
    'CLIENTE', 'MORADOR', 'VIZINHO', 'OBS', 'OBSERVACAO', 'ORDEM',
    'SERVICO', 'COM', 'PARA', 'QUE', 'NAO', 'SIM', 'OU', 'DE', 'DA', 'DO',
    'Coelba', 'Bahia', 'Salvador', 'Rua', 'Av', 'Avenida', 'Travessa',
    'Contato', 'Telefone', 'Celular', 'Whatsapp', 'Ligar', 'Falar',
    'Cliente', 'Morador', 'Vizinho', 'Obs', 'Observacao', 'Ordem',
    'Servico', 'Com', 'Para', 'Que', 'Nao', 'Sim', 'Ou', 'De', 'Da', 'Do',
  ]);
  
  const todosNomes = [...nomesMaiusculo, ...nomesNormais];
  
  for (const nome of todosNomes) {
    const nomeNormalizado = nome.trim();
    if (nomeNormalizado.length >= 3 && !palavrasIgnorar.has(nomeNormalizado)) {
      // Capitalizar corretamente
      return nomeNormalizado.split(' ').map(p => 
        p.length <= 3 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
      ).join(' ');
    }
  }
  
  return null;
}

/**
 * Encontra relação do contato no contexto
 */
function encontrarRelacao(texto: string, posicaoTelefone: number): string | undefined {
  const inicio = Math.max(0, posicaoTelefone - 80);
  const fim = Math.min(texto.length, posicaoTelefone + 30);
  const contexto = texto.substring(inicio, fim).toLowerCase();
  
  // Normalizar acentos para comparação
  const contextoNorm = contexto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (const [palavra, relacao] of Object.entries(PALAVRAS_RELACAO)) {
    if (contextoNorm.includes(palavra)) {
      return relacao;
    }
  }
  
  return undefined;
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
    
    for (const [limpo, { posicao, original }] of telefonesEncontrados) {
      const normalizado = normalizarTelefone(original);
      if (!normalizado) continue;
      
      const nome = encontrarNomeProximo(observacao, posicao);
      const relacao = encontrarRelacao(observacao, posicao);
      
      contatos.push({
        nome,
        telefone: normalizado.formatado,
        telefoneLimpo: normalizado.limpo,
        tipo: normalizado.tipo,
        relacao,
        observacao: undefined,
      });
    }
    
    // Ordenar: celulares primeiro, depois com nome
    contatos.sort((a, b) => {
      if (a.tipo === "celular" && b.tipo !== "celular") return -1;
      if (a.tipo !== "celular" && b.tipo === "celular") return 1;
      if (a.nome && !b.nome) return -1;
      if (!a.nome && b.nome) return 1;
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
