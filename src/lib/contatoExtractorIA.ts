/**
 * Serviço de extração de contatos usando IA (Google Gemini)
 * Processa observações da Coelba para identificar telefones e nomes de contato
 */

// Chave API padrão (fallback)
const GEMINI_API_KEY_DEFAULT = "AIzaSyD_rFWa0Yv9PzEPi4SEeL4GGkpu9iOhEWg";

/**
 * Obtém a chave API do Gemini - prioriza a configurada pelo usuário nos Checklists
 */
function getGeminiApiKey(): string {
  // Tentar buscar a chave configurada pelo usuário na tela de Checklists
  if (typeof localStorage !== "undefined") {
    const userKey = localStorage.getItem("gemini_api_key");
    if (userKey && userKey.trim().length > 0) {
      return userKey.trim();
    }
  }
  // Se não tiver, usar a chave padrão
  return GEMINI_API_KEY_DEFAULT;
}

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
 * Lista de modelos Gemini para tentar (mesma lista usada em GerarChecklistIA)
 * Ordem de prioridade: modelos mais estáveis primeiro
 */
const MODELOS_GEMINI = [
  "gemini-1.5-flash-latest", // Mais estável e disponível no tier gratuito
  "gemini-1.5-flash",        // Versão estável
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-1.5-pro",          // Pro como fallback
];

/**
 * Extrai contatos de uma observação usando IA (Gemini)
 * Tenta múltiplos modelos até encontrar um que funcione
 */
export async function extrairContatosComIA(observacao: string): Promise<ResultadoExtracaoIA> {
  if (!observacao || observacao.trim().length < 5) {
    return { contatos: [], sucesso: true };
  }

  try {
    const prompt = criarPromptExtracao(observacao);
    
    // Tentar cada modelo até encontrar um que funcione
    let response: Response | null = null;
    let ultimoErro = "";

    const apiKey = getGeminiApiKey();
    console.log(`[ContatoExtractorIA] Usando chave API: ${apiKey.substring(0, 10)}...`);

    for (const modelo of MODELOS_GEMINI) {
      try {
        console.log(`[ContatoExtractorIA] Tentando modelo: ${modelo}`);
        
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096, // Aumentado para evitar respostas truncadas
              },
            }),
          }
        );

        // Se deu certo (200) ou erro de conteúdo (não 404/429), usar esta resposta
        if (response.ok) {
          console.log(`[ContatoExtractorIA] ✅ Modelo ${modelo} funcionou!`);
          break;
        }

        // Se for 404 (modelo não encontrado), tentar próximo
        if (response.status === 404) {
          console.log(`[ContatoExtractorIA] Modelo ${modelo} não disponível, tentando próximo...`);
          continue;
        }

        // Se for 429 (rate limit), aguardar e tentar mesmo modelo novamente
        if (response.status === 429) {
          console.warn(`[ContatoExtractorIA] Rate limit no modelo ${modelo}, aguardando 15s...`);
          await delay(15000);
          // Tentar mesmo modelo novamente
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
              }),
            }
          );
          if (response.ok) {
            console.log(`[ContatoExtractorIA] ✅ Modelo ${modelo} funcionou após retry!`);
            break;
          }
        }

        ultimoErro = `${modelo}: ${response.status}`;
      } catch (fetchError: any) {
        ultimoErro = `${modelo}: ${fetchError.message}`;
        console.error(`[ContatoExtractorIA] Erro no modelo ${modelo}:`, fetchError);
      }
    }

    if (!response || !response.ok) {
      console.error("[ContatoExtractorIA] Nenhum modelo Gemini funcionou. Último erro:", ultimoErro);
      return { 
        contatos: [], 
        sucesso: false, 
        erro: `Nenhum modelo disponível. Último erro: ${ultimoErro}` 
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

      // Tentar corrigir JSON truncado - fechar estruturas abertas
      if (!jsonStr.endsWith("}")) {
        // Encontrar última estrutura completa
        const lastCompleteIndex = jsonStr.lastIndexOf("},");
        if (lastCompleteIndex > 0) {
          jsonStr = jsonStr.substring(0, lastCompleteIndex + 1) + "]}";
          console.warn("[ContatoExtractorIA] JSON truncado - tentando recuperar contatos completos");
        } else {
          // Se não tem nenhum contato completo, retornar vazio
          console.warn("[ContatoExtractorIA] JSON muito truncado, não foi possível recuperar");
          return { contatos: [], sucesso: true };
        }
      }

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
  
  const mensagem = `Bom dia! Meu nome é técnico da empresa *SIRTEC*, prestadora de serviços da *COELBA*.

Estou entrando em contato referente à Ordem de Serviço nº *${dados.numero}*, agendada para o endereço *${dados.endereco}*.

O serviço a ser realizado é: *${dados.tipoServico}*.

Por gentileza, haverá alguém no local para nos receber? Caso não seja possível, poderia indicar um contato alternativo?

Agradeço desde já pela atenção.`;
  
  const mensagemCodificada = encodeURIComponent(mensagem);
  return `https://wa.me/55${limpo}?text=${mensagemCodificada}`;
}
