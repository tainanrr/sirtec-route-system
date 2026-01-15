/**
 * Utilitário para extração de contatos (telefones e nomes) de textos não estruturados
 * como observações da Coelba/sistema
 */

export interface ContatoExtraido {
  /** Número original encontrado no texto */
  numeroOriginal: string;
  /** Número formatado para exibição */
  numeroFormatado: string;
  /** Número limpo (apenas dígitos) para usar em links tel: e WhatsApp */
  numeroLimpo: string;
  /** Nome do contato se identificado */
  nome?: string;
  /** Contexto onde o número foi encontrado (para debug/referência) */
  contexto: string;
  /** Tipo estimado: celular ou fixo */
  tipo: "celular" | "fixo";
  /** Índice de confiança (0-100) - maior = mais provável ser válido */
  confianca: number;
}

export interface DadosOrdemServico {
  numero: string;
  endereco: string;
  tipoServico: string;
  clienteNome?: string;
}

/**
 * Expressões regulares para identificar padrões de telefone brasileiro
 * Suporta diversos formatos comuns em textos não estruturados
 */
const REGEX_TELEFONES = [
  // Com DDD entre parênteses: (71) 99999-9999 ou (71) 9999-9999 ou (71)999999999
  /\(?(\d{2})\)?[\s.-]?(\d{4,5})[\s.-]?(\d{4})/g,
  
  // DDD sem parênteses: 71 99999-9999 ou 71999999999
  /\b(\d{2})[\s.-]?(\d{4,5})[\s.-]?(\d{4})\b/g,
  
  // Sem DDD mas com 8 ou 9 dígitos: 99999-9999 ou 9999-9999
  /\b(\d{4,5})[\s.-]?(\d{4})\b/g,
  
  // Formato com prefixo: 0XX71 99999-9999
  /0?[xX]{0,2}(\d{2})[\s.-]?(\d{4,5})[\s.-]?(\d{4})/g,
];

/**
 * Palavras que indicam que um número provavelmente é telefone
 */
const INDICADORES_TELEFONE = [
  "tel", "telefone", "fone", "celular", "cel", "whats", "whatsapp", "zap",
  "ligar", "contato", "número", "numero", "liga", "chamar", "msg", "mensagem",
  "ligue", "falar", "conversar", "avisar", "comunicar"
];

/**
 * Palavras que indicam que um nome de pessoa pode vir antes/depois
 */
const PREFIXOS_NOME = [
  "sr.", "sr", "sra.", "sra", "dona", "d.", "seu", "senhor", "senhora",
  "cliente", "proprietário", "proprietario", "responsável", "responsavel",
  "morador", "moradora", "falar com", "perguntar por", "procurar",
  "contato:", "contato", "nome:", "nome"
];

/**
 * Normaliza um número de telefone para formato padrão com DDD 71 (Salvador/BA)
 */
function normalizarTelefone(numero: string): { limpo: string; formatado: string; tipo: "celular" | "fixo" } {
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
  
  // Determina se é celular ou fixo
  // Celular: começa com 9 após o DDD e tem 9 dígitos no número
  const tipo: "celular" | "fixo" = limpo.length === 11 && limpo[2] === "9" ? "celular" : "fixo";
  
  // Formata para exibição
  let formatado = limpo;
  if (limpo.length === 11) {
    // Celular: (71) 99999-9999
    formatado = `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  } else if (limpo.length === 10) {
    // Fixo: (71) 9999-9999
    formatado = `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  
  return { limpo, formatado, tipo };
}

/**
 * Tenta extrair o nome do contato a partir do contexto em volta do número
 */
function extrairNomeDoContexto(texto: string, posicaoNumero: number, tamanhoNumero: number): string | undefined {
  // Pega contexto de 100 caracteres antes e depois do número
  const inicioContexto = Math.max(0, posicaoNumero - 100);
  const fimContexto = Math.min(texto.length, posicaoNumero + tamanhoNumero + 100);
  const contexto = texto.substring(inicioContexto, fimContexto);
  
  // Procura por padrões de nome
  for (const prefixo of PREFIXOS_NOME) {
    const regexNome = new RegExp(
      prefixo + "[:\\s]+([A-ZÀ-Ü][a-zà-ü]+(?:\\s+[A-ZÀ-Ü][a-zà-ü]+)?)",
      "i"
    );
    const match = contexto.match(regexNome);
    if (match && match[1]) {
      const nome = match[1].trim();
      // Valida se parece um nome real (não é uma palavra comum)
      if (nome.length >= 3 && !palavraComum(nome)) {
        return nome;
      }
    }
  }
  
  // Procura por nomes em maiúsculas próximos (padrão comum em sistemas)
  const regexNomeMaiusculo = /\b([A-ZÀ-Ü]{2,}(?:\s+[A-ZÀ-Ü]{2,})*)\b/g;
  let matchMaiusculo;
  while ((matchMaiusculo = regexNomeMaiusculo.exec(contexto)) !== null) {
    const possvelNome = matchMaiusculo[1];
    // Ignora siglas muito curtas ou palavras comuns em maiúsculas
    if (possvelNome.length >= 4 && !palavraComunMaiuscula(possvelNome)) {
      // Capitaliza corretamente
      return possvelNome.split(" ")
        .map(p => p.charAt(0) + p.slice(1).toLowerCase())
        .join(" ");
    }
  }
  
  return undefined;
}

/**
 * Lista de palavras comuns que não são nomes
 */
const PALAVRAS_COMUNS = new Set([
  "para", "pelo", "pela", "com", "sem", "sobre", "entre", "ate", "desde",
  "cliente", "contato", "telefone", "numero", "ligar", "falar", "local",
  "casa", "empresa", "loja", "apartamento", "residencia", "comercial"
]);

function palavraComum(palavra: string): boolean {
  return PALAVRAS_COMUNS.has(palavra.toLowerCase());
}

const PALAVRAS_COMUNS_MAIUSCULAS = new Set([
  "COELBA", "NEOENERGIA", "SIRTEC", "CPF", "RG", "CNPJ", "OS", "CEP",
  "OBS", "OBSERVACAO", "TELEFONE", "TEL", "CONTATO", "URGENTE", "ATENCAO",
  "IMPORTANTE", "FAVOR", "CLIENTE", "ENDERECO", "LOCAL", "INSTALACAO"
]);

function palavraComunMaiuscula(palavra: string): boolean {
  return PALAVRAS_COMUNS_MAIUSCULAS.has(palavra.toUpperCase());
}

/**
 * Calcula índice de confiança baseado no contexto
 */
function calcularConfianca(contexto: string, tipo: "celular" | "fixo"): number {
  let confianca = tipo === "celular" ? 70 : 50; // Celulares têm maior base
  
  const contextoLower = contexto.toLowerCase();
  
  // Aumenta confiança se houver indicadores de telefone no contexto
  for (const indicador of INDICADORES_TELEFONE) {
    if (contextoLower.includes(indicador)) {
      confianca += 10;
      break;
    }
  }
  
  // Aumenta se houver nome associado
  for (const prefixo of PREFIXOS_NOME) {
    if (contextoLower.includes(prefixo)) {
      confianca += 5;
      break;
    }
  }
  
  return Math.min(100, confianca);
}

/**
 * Extrai todos os contatos de um texto de observação
 */
export function extrairContatos(texto: string | null | undefined): ContatoExtraido[] {
  if (!texto || typeof texto !== "string") return [];
  
  const contatos: ContatoExtraido[] = [];
  const numerosJaEncontrados = new Set<string>();
  
  // Tenta cada padrão de regex
  for (const regex of REGEX_TELEFONES) {
    // Reseta o regex para busca do início
    const regexClone = new RegExp(regex.source, regex.flags);
    let match;
    
    while ((match = regexClone.exec(texto)) !== null) {
      const numeroOriginal = match[0];
      const { limpo, formatado, tipo } = normalizarTelefone(numeroOriginal);
      
      // Pula se já encontramos esse número ou se é muito curto/longo
      if (numerosJaEncontrados.has(limpo) || limpo.length < 10 || limpo.length > 11) {
        continue;
      }
      
      // Pula números que parecem ser outras coisas (CPF, CNPJ, códigos)
      // CPF tem 11 dígitos mas não começa com DDD válido (11-99)
      const ddd = parseInt(limpo.substring(0, 2));
      if (ddd < 11 || ddd > 99) continue;
      
      numerosJaEncontrados.add(limpo);
      
      // Extrai contexto para buscar nome
      const inicioContexto = Math.max(0, match.index - 50);
      const fimContexto = Math.min(texto.length, match.index + numeroOriginal.length + 50);
      const contexto = texto.substring(inicioContexto, fimContexto);
      
      // Tenta encontrar nome associado
      const nome = extrairNomeDoContexto(texto, match.index, numeroOriginal.length);
      
      // Calcula confiança
      const confianca = calcularConfianca(contexto, tipo);
      
      contatos.push({
        numeroOriginal,
        numeroFormatado: formatado,
        numeroLimpo: limpo,
        nome,
        contexto: contexto.trim(),
        tipo,
        confianca,
      });
    }
  }
  
  // Ordena por confiança (maior primeiro) e depois por tipo (celular primeiro)
  contatos.sort((a, b) => {
    if (b.confianca !== a.confianca) return b.confianca - a.confianca;
    if (a.tipo === "celular" && b.tipo === "fixo") return -1;
    if (a.tipo === "fixo" && b.tipo === "celular") return 1;
    return 0;
  });
  
  return contatos;
}

/**
 * Gera o link para ligação telefônica
 */
export function gerarLinkTelefone(numero: string): string {
  const limpo = numero.replace(/\D/g, "");
  return `tel:+55${limpo}`;
}

/**
 * Gera o link para WhatsApp com mensagem pré-preenchida
 */
export function gerarLinkWhatsApp(numero: string, dados: DadosOrdemServico): string {
  const limpo = numero.replace(/\D/g, "");
  
  const mensagem = `Olá! Estou a serviço da Coelba, no endereço *${dados.endereco}*, para atendimento da Ordem de Serviço *${dados.numero}*, aqui para realizar o seu serviço de *${dados.tipoServico}*.

Está disponível no momento? Se não, pode me passar o contato de alguém que esteja?`;
  
  // Codifica a mensagem para URL
  const mensagemCodificada = encodeURIComponent(mensagem);
  
  // Link do WhatsApp (funciona em mobile e desktop)
  return `https://wa.me/55${limpo}?text=${mensagemCodificada}`;
}

/**
 * Formata número para exibição amigável
 */
export function formatarNumeroExibicao(numero: string): string {
  const { formatado } = normalizarTelefone(numero);
  return formatado;
}
