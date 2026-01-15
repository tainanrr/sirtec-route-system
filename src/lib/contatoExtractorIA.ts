/**
 * Serviço de extração de contatos usando IA (Google Gemini)
 * Processa observações da Coelba para identificar telefones e nomes de contato
 */

// Chave API do Gemini
const GEMINI_API_KEY = "AIzaSyD_rFWa0Yv9PzEPi4SEeL4GGkpu9iOhEWg";

export interface ContatoIA {
  /** Nome do contato identificado pela IA */
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
  /** Se a IA processou com sucesso */
  sucesso: boolean;
  /** Mensagem de erro se houver */
  erro?: string;
}

/**
 * Prompt para o Gemini extrair contatos de forma estruturada
 */
function criarPromptExtracao(observacao: string): string {
  return `Analise o seguinte texto de observação de uma ordem de serviço da Coelba (concessionária de energia elétrica) e extraia TODOS os números de telefone encontrados junto com os nomes dos contatos associados.

TEXTO DA OBSERVAÇÃO:
"""
${observacao}
"""

INSTRUÇÕES:
1. Identifique TODOS os números de telefone no texto (celulares e fixos)
2. Para cada telefone, identifique o nome da pessoa associada (se mencionado)
3. Telefones brasileiros podem aparecer em diversos formatos: (71) 99999-9999, 71999999999, 9999-9999, etc.
4. Se um número não tiver DDD, assuma DDD 71 (Salvador/BA)
5. Identifique a relação da pessoa (cliente, vizinho, porteiro, responsável, etc.) se mencionada
6. Celulares têm 9 dígitos após o DDD e começam com 9
7. NÃO invente nomes ou números que não estejam no texto
8. Se não conseguir identificar o nome, deixe null

RESPONDA APENAS com um JSON válido no seguinte formato (sem markdown, sem explicações):
{
  "contatos": [
    {
      "nome": "Nome da Pessoa" ou null se não identificado,
      "telefone": "(71) 99999-9999",
      "tipo": "celular" ou "fixo",
      "relacao": "cliente" ou "vizinho" ou "porteiro" ou "responsável" ou null,
      "observacao": "qualquer contexto relevante sobre este contato" ou null
    }
  ]
}

Se não houver telefones no texto, retorne: {"contatos": []}`;
}

/**
 * Normaliza um número de telefone para formato padrão
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
 * Delay para aguardar antes de retry
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extrai contatos de uma observação usando IA (Gemini)
 * Implementa retry com backoff exponencial para erros 429
 */
export async function extrairContatosComIA(observacao: string, tentativa: number = 1): Promise<ResultadoExtracaoIA> {
  if (!observacao || observacao.trim().length < 5) {
    return { contatos: [], sucesso: true };
  }

  const MAX_TENTATIVAS = 3;
  const DELAY_BASE = 8000; // 8 segundos (Gemini pede ~7s no erro)

  try {
    const prompt = criarPromptExtracao(observacao);
    
    // Chamar API do Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, // Baixa temperatura para respostas mais precisas
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    // Se for erro 429 (rate limit), fazer retry com backoff
    if (response.status === 429) {
      if (tentativa < MAX_TENTATIVAS) {
        const delayMs = DELAY_BASE * tentativa; // 8s, 16s, 24s
        console.warn(`[ContatoExtractorIA] Rate limit (429) - aguardando ${delayMs/1000}s antes de retry ${tentativa + 1}/${MAX_TENTATIVAS}`);
        await delay(delayMs);
        return extrairContatosComIA(observacao, tentativa + 1);
      } else {
        console.error("[ContatoExtractorIA] Rate limit excedido após todas as tentativas");
        return { 
          contatos: [], 
          sucesso: false, 
          erro: "Limite de requisições da API excedido. Tente novamente em alguns minutos." 
        };
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ContatoExtractorIA] Erro na API Gemini:", errorText);
      return { 
        contatos: [], 
        sucesso: false, 
        erro: `Erro na API: ${response.status}` 
      };
    }

    const data = await response.json();
    const textoResposta = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textoResposta) {
      return { contatos: [], sucesso: true };
    }

    // Tentar fazer parse do JSON
    try {
      // Limpar possíveis markdown code blocks
      let jsonStr = textoResposta.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const resultado = JSON.parse(jsonStr);
      
      // Processar e normalizar contatos
      const contatosProcessados: ContatoIA[] = [];
      const telefonesJaAdicionados = new Set<string>();

      for (const contato of resultado.contatos || []) {
        if (!contato.telefone) continue;

        const { limpo, formatado, tipo } = normalizarTelefone(contato.telefone);
        
        // Pular se já adicionamos esse telefone (evita duplicados)
        if (telefonesJaAdicionados.has(limpo)) continue;
        
        // Validar se é um número válido (10 ou 11 dígitos)
        if (limpo.length < 10 || limpo.length > 11) continue;

        // Validar DDD (11-99)
        const ddd = parseInt(limpo.substring(0, 2));
        if (ddd < 11 || ddd > 99) continue;

        telefonesJaAdicionados.add(limpo);

        contatosProcessados.push({
          nome: contato.nome || null,
          telefone: formatado,
          telefoneLimpo: limpo,
          tipo: contato.tipo === "fixo" ? "fixo" : tipo, // Usa o tipo da IA se for fixo, senão calcula
          relacao: contato.relacao || undefined,
          observacao: contato.observacao || undefined,
        });
      }

      return { contatos: contatosProcessados, sucesso: true };
    } catch (parseError) {
      console.error("[ContatoExtractorIA] Erro ao fazer parse da resposta:", parseError);
      console.error("[ContatoExtractorIA] Resposta recebida:", textoResposta);
      return { 
        contatos: [], 
        sucesso: false, 
        erro: "Erro ao processar resposta da IA" 
      };
    }
  } catch (error: any) {
    console.error("[ContatoExtractorIA] Erro ao chamar IA:", error);
    return { 
      contatos: [], 
      sucesso: false, 
      erro: error.message || "Erro desconhecido" 
    };
  }
}

/**
 * Processa múltiplas observações em lote (para importação de OS)
 * @param observacoes Array de objetos com id e observacao
 * @returns Map de id para contatos extraídos
 */
export async function extrairContatosEmLote(
  observacoes: Array<{ id: string; observacao: string | null }>
): Promise<Map<string, ContatoIA[]>> {
  const resultado = new Map<string, ContatoIA[]>();
  
  // Filtrar apenas os que têm observações
  const comObservacao = observacoes.filter(o => o.observacao && o.observacao.trim().length > 5);
  
  if (comObservacao.length === 0) {
    return resultado;
  }

  // Processar em paralelo com limite de concorrência (5 por vez)
  const BATCH_SIZE = 5;
  for (let i = 0; i < comObservacao.length; i += BATCH_SIZE) {
    const batch = comObservacao.slice(i, i + BATCH_SIZE);
    
    const promises = batch.map(async ({ id, observacao }) => {
      const extracao = await extrairContatosComIA(observacao!);
      return { id, contatos: extracao.contatos };
    });

    const resultados = await Promise.all(promises);
    
    for (const { id, contatos } of resultados) {
      if (contatos.length > 0) {
        resultado.set(id, contatos);
      }
    }

    // Pequena pausa entre batches para não sobrecarregar a API
    if (i + BATCH_SIZE < comObservacao.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return resultado;
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
  
  const mensagem = `Olá! Estou a serviço da Coelba, no endereço *${dados.endereco}*, para atendimento da Ordem de Serviço *${dados.numero}*, aqui para realizar o seu serviço de *${dados.tipoServico}*.

Está disponível no momento? Se não, pode me passar o contato de alguém que esteja?`;
  
  const mensagemCodificada = encodeURIComponent(mensagem);
  return `https://wa.me/55${limpo}?text=${mensagemCodificada}`;
}
