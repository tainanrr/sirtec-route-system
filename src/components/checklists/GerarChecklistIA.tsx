import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  Upload,
  FileText,
  File,
  FileType,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Eye,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  GripVertical,
  Settings2,
  ChevronRight,
  Type,
  Hash,
  ToggleLeft,
  Camera,
  FileSignature,
  Calendar,
  ListChecks,
  Star,
  Info,
  Copy,
  RefreshCw,
  Zap,
  Brain,
  Target,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================
// TIPOS E INTERFACES
// ============================================

interface OpcaoSelecao {
  id: string;
  texto: string;
  valor?: string;
  exige_foto?: boolean;
  exige_observacao?: boolean;
}

interface Condicao {
  id: string;
  pergunta_origem_id: string;
  operador: string;
  valor?: string | number | string[];
  acao: string;
  acao_valor?: string;
}

interface Pergunta {
  id: string;
  texto: string;
  descricao?: string;
  tipo: string;
  obrigatoria: boolean;
  ordem: number;
  opcoes?: OpcaoSelecao[];
  foto_obrigatoria?: boolean;
  observacao_obrigatoria?: boolean;
  condicoes?: Condicao[];
  valor_min?: number;
  valor_max?: number;
  placeholder?: string;
  dica?: string;
}

interface GrupoPerguntas {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
  perguntas: Pergunta[];
}

interface ChecklistGerado {
  nome: string;
  descricao: string;
  tipo: string;
  grupos: GrupoPerguntas[];
  configuracoes?: {
    exige_localizacao?: boolean;
    exige_foto_inicial?: boolean;
    exige_foto_final?: boolean;
    exige_assinatura?: boolean;
    permite_salvar_rascunho?: boolean;
  };
}

// Tipos de pergunta disponíveis
const TIPOS_PERGUNTA: Record<string, { label: string; icon: any; description: string }> = {
  texto: { label: "Texto Curto", icon: Type, description: "Resposta em texto livre" },
  texto_longo: { label: "Texto Longo", icon: FileText, description: "Múltiplas linhas" },
  numero: { label: "Número", icon: Hash, description: "Apenas números" },
  sim_nao: { label: "Sim/Não", icon: ToggleLeft, description: "Resposta binária" },
  conforme_nao_conforme: { label: "Conforme/Não Conforme", icon: CheckCircle2, description: "Avaliação" },
  selecao_unica: { label: "Seleção Única", icon: Target, description: "Uma opção" },
  multipla_escolha: { label: "Múltipla Escolha", icon: ListChecks, description: "Várias opções" },
  escala: { label: "Escala (1-5)", icon: Star, description: "Avaliação em escala" },
  foto: { label: "Foto", icon: Camera, description: "Captura de imagem" },
  assinatura: { label: "Assinatura", icon: FileSignature, description: "Assinatura digital" },
  data: { label: "Data", icon: Calendar, description: "Seleção de data" },
  informativo: { label: "Informativo", icon: Info, description: "Apenas exibe texto" },
};

const TIPOS_CHECKLIST = [
  { value: "apr", label: "APR - Análise Preliminar de Risco" },
  { value: "inspecao", label: "Inspeção Técnica" },
  { value: "manutencao", label: "Manutenção" },
  { value: "recebimento_materiais", label: "Recebimento de Materiais" },
  { value: "seguranca", label: "Segurança do Trabalho" },
  { value: "qualidade", label: "Controle de Qualidade" },
  { value: "auditoria", label: "Auditoria" },
  { value: "outro", label: "Outro" },
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

interface GerarChecklistIAProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChecklistGerado: (checklist: ChecklistGerado) => void;
}

type AIProvider = "gemini" | "openai";

export function GerarChecklistIA({ open, onOpenChange, onChecklistGerado }: GerarChecklistIAProps) {
  const [step, setStep] = useState<"input" | "processing" | "preview" | "editing" | "error">("input");
  const [inputType, setInputType] = useState<"text" | "file">("text");
  const [textoEntrada, setTextoEntrada] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checklistGerado, setChecklistGerado] = useState<ChecklistGerado | null>(null);
  const [aiProvider, setAiProvider] = useState<AIProvider>(() => 
    (localStorage.getItem("ai_provider") as AIProvider) || "gemini"
  );
  const [apiKey, setApiKey] = useState(() => 
    localStorage.getItem(aiProvider === "gemini" ? "gemini_api_key" : "openai_api_key") || ""
  );
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Atualizar API key quando mudar provider
  const handleProviderChange = (provider: AIProvider) => {
    setAiProvider(provider);
    localStorage.setItem("ai_provider", provider);
    setApiKey(localStorage.getItem(provider === "gemini" ? "gemini_api_key" : "openai_api_key") || "");
  };

  // Resetar estado ao fechar
  const handleClose = () => {
    setStep("input");
    setTextoEntrada("");
    setArquivos([]);
    setChecklistGerado(null);
    setProgressMessage("");
    setErrorMessage("");
    onOpenChange(false);
  };

  // Salvar API key
  const handleSaveApiKey = () => {
    const keyName = aiProvider === "gemini" ? "gemini_api_key" : "openai_api_key";
    localStorage.setItem(keyName, apiKey);
    setShowApiKeyInput(false);
    toast.success("Chave da API salva com sucesso!");
  };

  // Upload de arquivos
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const mimeType = file.type;
      // Aceitar arquivos de texto, PDF e imagens
      return ['txt', 'pdf', 'doc', 'docx', 'md', 'rtf', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '') ||
             mimeType.startsWith('image/') ||
             mimeType === 'application/pdf';
    });

    if (validFiles.length !== files.length) {
      toast.warning("Alguns arquivos foram ignorados. Formatos aceitos: TXT, PDF, DOC, DOCX, MD, RTF, JPG, PNG, GIF, WEBP");
    }

    setArquivos(prev => [...prev, ...validFiles]);
  }, []);

  // Remover arquivo
  const removeArquivo = (index: number) => {
    setArquivos(prev => prev.filter((_, i) => i !== index));
  };

  // Converter arquivo para base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remover o prefixo "data:mime/type;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Verificar se arquivo é imagem ou PDF (suportado pelo Gemini diretamente)
  const isFileSuportadoPeloGemini = (file: File): boolean => {
    const mimeType = file.type;
    return mimeType.startsWith('image/') || mimeType === 'application/pdf';
  };

  // Extrair texto de arquivos (para arquivos de texto simples)
  const extrairTextoArquivos = async (): Promise<string> => {
    let textoTotal = "";

    for (const arquivo of arquivos) {
      const ext = arquivo.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'txt' || ext === 'md') {
        textoTotal += await arquivo.text() + "\n\n";
      } else if (ext === 'doc' || ext === 'docx') {
        textoTotal += `[Conteúdo do arquivo Word: ${arquivo.name}]\n\n`;
        toast.info("Arquivos Word serão processados pela IA com base no nome e contexto");
      }
      // PDF e imagens serão enviados diretamente para o Gemini
    }

    return textoTotal;
  };

  // Preparar partes do conteúdo para o Gemini (incluindo arquivos binários)
  const prepararPartesGemini = async (prompt: string): Promise<any[]> => {
    const parts: any[] = [];
    
    // Adicionar arquivos binários (PDF e imagens) primeiro
    for (const arquivo of arquivos) {
      if (isFileSuportadoPeloGemini(arquivo)) {
        try {
          const base64Data = await fileToBase64(arquivo);
          parts.push({
            inline_data: {
              mime_type: arquivo.type,
              data: base64Data
            }
          });
        } catch (error) {
          console.error(`Erro ao processar arquivo ${arquivo.name}:`, error);
        }
      }
    }
    
    // Adicionar o prompt de texto por último
    parts.push({ text: prompt });
    
    return parts;
  };

  // Gerar checklist com IA
  const gerarComIA = async () => {
    if (!apiKey) {
      setShowApiKeyInput(true);
      toast.error(`Configure sua chave da API ${aiProvider === "gemini" ? "Gemini" : "OpenAI"} primeiro`);
      return;
    }

    // Verificar se há arquivos binários (PDF/imagens) para enviar diretamente ao Gemini
    const temArquivosBinarios = arquivos.some(isFileSuportadoPeloGemini);
    
    const textoParaProcessar = inputType === "text" 
      ? textoEntrada 
      : await extrairTextoArquivos();

    // Se não tem texto E não tem arquivos binários, erro
    if (!textoParaProcessar.trim() && !temArquivosBinarios) {
      toast.error("Forneça um texto ou arquivo para gerar o checklist");
      return;
    }

    setIsProcessing(true);
    setStep("processing");
    setProgressMessage(`Analisando conteúdo com ${aiProvider === "gemini" ? "Gemini" : "GPT-4"}...`);

    try {
      // Construir contexto adicional baseado nos arquivos
      const contextoBinarios = temArquivosBinarios 
        ? `\n\nARQUIVOS ANEXADOS: ${arquivos.filter(isFileSuportadoPeloGemini).map(f => f.name).join(', ')}
INSTRUÇÕES ESPECIAIS PARA ARQUIVOS:
- Analise COMPLETAMENTE o conteúdo do(s) arquivo(s) anexado(s)
- Extraia TODAS as perguntas, itens, campos e seções do documento
- NÃO PULE NENHUMA PERGUNTA OU ITEM - o formulário deve ser uma réplica EXATA do original
- Se o documento tiver múltiplas páginas, processe TODAS elas
- Mantenha a numeração e organização original do documento`
        : '';

      const prompt = `Você é um especialista em criar formulários de checklist para o setor elétrico e de serviços de campo.

TAREFA CRÍTICA: Converter o conteúdo fornecido em um checklist estruturado em JSON, incluindo ABSOLUTAMENTE TODOS os itens.

⚠️ REGRAS OBRIGATÓRIAS - LEIA COM ATENÇÃO:
1. INCLUA 100% DOS ITENS/PERGUNTAS do documento - NÃO RESUMA, NÃO OMITA NADA, NÃO SIMPLIFIQUE
2. CADA linha, item, pergunta, campo ou checkbox do original DEVE virar uma pergunta no JSON
3. Se houver 50 itens no original, o JSON DEVE ter 50 perguntas. Se houver 100, deve ter 100.
4. Mantenha a ORDEM EXATA dos itens como aparecem no documento
5. Se houver seções/grupos/categorias, mantenha essa organização
6. NUNCA agrupe múltiplos itens em uma única pergunta
7. Preserve o texto EXATO de cada item (não parafraseie)
8. Se um item tiver sub-itens, crie perguntas separadas para cada sub-item

${textoParaProcessar ? `TEXTO ADICIONAL:\n---\n${textoParaProcessar}\n---` : ''}${contextoBinarios}

FORMATO JSON OBRIGATÓRIO:
{
  "nome": "Nome do Checklist (extraído do título do documento)",
  "descricao": "Descrição breve do propósito do checklist",
  "tipo": "apr|inspecao|manutencao|recebimento_materiais|seguranca|qualidade|auditoria|outro",
  "grupos": [
    {
      "id": "g1",
      "nome": "Nome do Grupo/Seção (extraído do documento)",
      "descricao": "Descrição da seção se houver",
      "ordem": 1,
      "perguntas": [
        {
          "id": "p1",
          "texto": "Texto EXATO da pergunta/item como está no documento",
          "tipo": "sim_nao|conforme_nao_conforme|texto|texto_longo|numero|selecao_unica|multipla_escolha|foto|assinatura|data|escala|informativo",
          "obrigatoria": true,
          "ordem": 1,
          "opcoes": [{"id":"op1","texto":"Opção 1"}]
        }
      ]
    }
  ],
  "configuracoes": {
    "exige_assinatura": true,
    "exige_localizacao": false,
    "exige_foto_inicial": false,
    "exige_foto_final": false
  }
}

TIPOS DE PERGUNTA - USE O MAIS APROPRIADO:
- sim_nao → Para verificações simples (Sim/Não)
- conforme_nao_conforme → Para avaliações de conformidade
- texto → Campos de texto curto (nome, número, etc)
- texto_longo → Campos de texto extenso (observações, descrições)
- numero → Apenas valores numéricos
- selecao_unica → Escolha uma opção (adicione campo "opcoes")
- multipla_escolha → Escolha várias opções (adicione campo "opcoes")
- foto → Captura de imagem/evidência
- assinatura → Assinatura digital
- data → Seleção de data
- escala → Avaliação de 1 a 5
- informativo → Texto informativo (não requer resposta)

VALIDAÇÃO FINAL:
Antes de retornar, conte quantos itens/perguntas existem no documento original e confirme que seu JSON tem a MESMA quantidade.

RETORNE APENAS O JSON VÁLIDO, SEM EXPLICAÇÕES OU MARKDOWN.`;

      setProgressMessage(`Gerando checklist com ${aiProvider === "gemini" ? "Gemini" : "GPT-4"}...`);

      let conteudo: string;

      if (aiProvider === "gemini") {
        // Preparar partes do conteúdo (incluindo arquivos binários se houver)
        let contentParts: any[];
        
        if (temArquivosBinarios) {
          setProgressMessage("Processando arquivos anexados...");
          contentParts = await prepararPartesGemini(prompt);
        } else {
          contentParts = [{ text: prompt }];
        }

        // Primeiro, listar modelos disponíveis para debug
        try {
          const listResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          );
          if (listResponse.ok) {
            const modelsData = await listResponse.json();
            console.log("Modelos disponíveis:", modelsData.models?.map((m: any) => m.name));
          }
        } catch (e) {
          console.log("Não foi possível listar modelos:", e);
        }

        // Chamada para Google Gemini API
        // Usar modelos disponíveis na conta (baseado na listagem)
        const tentativas = [
          "gemini-2.0-flash",
          "gemini-2.5-flash",
          "gemini-2.5-pro",
          "gemini-2.0-flash-exp",
          "gemini-2.0-flash-001",
          "gemini-flash-latest",
        ];
        let response: Response | null = null;
        let ultimoErro = "";

        for (const modelo of tentativas) {
          try {
            setProgressMessage(`Tentando ${modelo}...`);
            
            // Construir URL com o nome completo do modelo
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
            
            console.log(`Tentando URL: ${url}`);
            
            response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: contentParts
                  }
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 65536, // Aumentado para formulários grandes
                  }
              }),
            });

            if (response.ok) {
              console.log(`Modelo ${modelo} funcionou!`);
              break;
            } else {
              const errorData = await response.json();
              ultimoErro = errorData.error?.message || `Erro com modelo ${modelo}`;
              console.log(`Modelo ${modelo} falhou:`, ultimoErro);
              response = null;
            }
          } catch (e: any) {
            ultimoErro = e.message;
            console.log(`Exceção com modelo ${modelo}:`, ultimoErro);
            response = null;
          }
        }

        if (!response || !response.ok) {
          throw new Error(`Nenhum modelo Gemini disponível. Último erro: ${ultimoErro}`);
        }

        const data = await response.json();
        conteudo = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!conteudo) {
          throw new Error("Resposta vazia do Gemini. Verifique se sua chave API está correta.");
        }
      } else {
        // Chamada para OpenAI API
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "Você é um assistente especializado em criar checklists estruturados. Responda APENAS com JSON válido, sem markdown ou explicações."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Erro na API OpenAI");
        }

        const data = await response.json();
        conteudo = data.choices[0]?.message?.content;

        if (!conteudo) {
          throw new Error("Resposta vazia da IA");
        }
      }

      setProgressMessage("Processando resultado...");

      // Extrair JSON da resposta (pode vir com markdown)
      let jsonStr = conteudo;
      if (conteudo.includes("```json")) {
        jsonStr = conteudo.split("```json")[1].split("```")[0];
      } else if (conteudo.includes("```")) {
        jsonStr = conteudo.split("```")[1].split("```")[0];
      }

      // Limpar caracteres problemáticos
      jsonStr = jsonStr.trim();
      
      // Função para corrigir JSON truncado de forma mais robusta
      const corrigirJsonTruncado = (json: string): string => {
        let corrigido = json;
        
        // Remover texto antes do primeiro {
        const primeiraChave = corrigido.indexOf('{');
        if (primeiraChave > 0) {
          corrigido = corrigido.substring(primeiraChave);
        }
        
        // Função auxiliar para verificar se estamos dentro de uma string
        const encontrarUltimoObjetoCompleto = (str: string): string => {
          let dentroString = false;
          let escapeNext = false;
          let nivel = 0;
          let ultimaPosicaoValida = -1;
          
          for (let i = 0; i < str.length; i++) {
            const char = str[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"') {
              dentroString = !dentroString;
              continue;
            }
            
            if (!dentroString) {
              if (char === '{' || char === '[') {
                nivel++;
              } else if (char === '}' || char === ']') {
                nivel--;
                if (nivel === 0) {
                  ultimaPosicaoValida = i;
                }
              }
            }
          }
          
          if (ultimaPosicaoValida > 0) {
            return str.substring(0, ultimaPosicaoValida + 1);
          }
          return str;
        };
        
        // Tentar encontrar o último objeto/array completo
        const jsonCompleto = encontrarUltimoObjetoCompleto(corrigido);
        if (jsonCompleto.length > 100) {
          try {
            JSON.parse(jsonCompleto);
            return jsonCompleto;
          } catch (e) {
            // Continuar com a correção manual
          }
        }
        
        // Estratégia alternativa: encontrar o último grupo/pergunta completo
        // Procurar pelo último "}" que fecha um objeto de pergunta
        const regexUltimaPerguntaCompleta = /("ordem"\s*:\s*\d+\s*})\s*\]/g;
        let match;
        let ultimaMatch = null;
        while ((match = regexUltimaPerguntaCompleta.exec(corrigido)) !== null) {
          ultimaMatch = match;
        }
        
        if (ultimaMatch) {
          const posicaoCorte = ultimaMatch.index + ultimaMatch[0].length;
          corrigido = corrigido.substring(0, posicaoCorte);
        } else {
          // Se não encontrou, tentar cortar na última estrutura válida
          // Procurar por padrões como "}," ou "}]" que indicam fim de objeto
          const regexFimObjeto = /}\s*[,\]]/g;
          let ultimoFim = null;
          while ((match = regexFimObjeto.exec(corrigido)) !== null) {
            ultimoFim = match;
          }
          if (ultimoFim) {
            corrigido = corrigido.substring(0, ultimoFim.index + 1);
          }
        }
        
        // Remover vírgulas finais e espaços
        corrigido = corrigido.replace(/,\s*$/, '');
        corrigido = corrigido.replace(/,(\s*[}\]])/g, '$1');
        
        // Contar estruturas abertas/fechadas
        let aberturas = 0, fechamentos = 0, colchetesAbertos = 0, colchetesFechados = 0;
        let dentroString = false;
        let escapeNext = false;
        
        for (let i = 0; i < corrigido.length; i++) {
          const char = corrigido[i];
          if (escapeNext) { escapeNext = false; continue; }
          if (char === '\\') { escapeNext = true; continue; }
          if (char === '"') { dentroString = !dentroString; continue; }
          if (!dentroString) {
            if (char === '{') aberturas++;
            else if (char === '}') fechamentos++;
            else if (char === '[') colchetesAbertos++;
            else if (char === ']') colchetesFechados++;
          }
        }
        
        // Fechar estruturas na ordem correta
        // Precisamos fechar arrays de perguntas, depois objetos de grupo, depois array de grupos, depois objeto principal
        const arraysFaltando = colchetesAbertos - colchetesFechados;
        const objetosFaltando = aberturas - fechamentos;
        
        // Intercalar fechamentos de forma inteligente
        for (let i = 0; i < arraysFaltando; i++) {
          corrigido += ']';
        }
        for (let i = 0; i < objetosFaltando; i++) {
          corrigido += '}';
        }
        
        return corrigido;
      };
      
      // Tentar parsear JSON
      let checklistData: ChecklistGerado;
      try {
        checklistData = JSON.parse(jsonStr) as ChecklistGerado;
      } catch (parseError: any) {
        console.error("Erro ao parsear JSON:", parseError);
        console.log("JSON recebido (primeiros 1000 chars):", jsonStr.substring(0, 1000));
        console.log("JSON recebido (últimos 500 chars):", jsonStr.substring(jsonStr.length - 500));
        
        // Tentar corrigir JSON incompleto
        const jsonCorrigido = corrigirJsonTruncado(jsonStr);
        console.log("JSON corrigido (últimos 200 chars):", jsonCorrigido.substring(jsonCorrigido.length - 200));
        
        try {
          checklistData = JSON.parse(jsonCorrigido) as ChecklistGerado;
          console.log("JSON corrigido com sucesso!");
          toast.info("O checklist foi parcialmente recuperado. Alguns itens podem estar faltando.");
        } catch (e: any) {
          console.error("Falha ao corrigir JSON:", e);
          // Última tentativa: tentar extrair o que for possível
          throw new Error(`JSON incompleto da IA. O formulário é muito grande. Tente dividir em partes menores ou simplificar. Erro técnico: ${parseError.message}`);
        }
      }
      
      // Validar e ajustar IDs
      checklistData.grupos = checklistData.grupos.map((grupo, gIdx) => ({
        ...grupo,
        id: grupo.id || `grupo_${gIdx + 1}`,
        ordem: gIdx + 1,
        perguntas: grupo.perguntas.map((pergunta, pIdx) => ({
          ...pergunta,
          id: pergunta.id || `p_${gIdx + 1}_${pIdx + 1}`,
          ordem: pIdx + 1,
        }))
      }));

      setChecklistGerado(checklistData);
      setStep("preview");
      toast.success("Checklist gerado com sucesso!");

    } catch (error: any) {
      console.error("Erro ao gerar checklist:", error);
      const mensagemErro = error.message || "Erro desconhecido ao gerar checklist";
      setErrorMessage(mensagemErro);
      setStep("error");
    } finally {
      setIsProcessing(false);
      setProgressMessage("");
    }
  };

  // Gerar ID único
  const gerarId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Adicionar grupo
  const adicionarGrupo = () => {
    if (!checklistGerado) return;
    const novoGrupo: GrupoPerguntas = {
      id: gerarId(),
      nome: "Novo Grupo",
      descricao: "",
      ordem: checklistGerado.grupos.length + 1,
      perguntas: []
    };
    setChecklistGerado({
      ...checklistGerado,
      grupos: [...checklistGerado.grupos, novoGrupo]
    });
  };

  // Remover grupo
  const removerGrupo = (grupoId: string) => {
    if (!checklistGerado) return;
    setChecklistGerado({
      ...checklistGerado,
      grupos: checklistGerado.grupos.filter(g => g.id !== grupoId)
    });
  };

  // Adicionar pergunta
  const adicionarPergunta = (grupoId: string) => {
    if (!checklistGerado) return;
    const novaPergunta: Pergunta = {
      id: gerarId(),
      texto: "Nova pergunta",
      tipo: "texto",
      obrigatoria: false,
      ordem: 1
    };
    setChecklistGerado({
      ...checklistGerado,
      grupos: checklistGerado.grupos.map(g => 
        g.id === grupoId 
          ? { ...g, perguntas: [...g.perguntas, { ...novaPergunta, ordem: g.perguntas.length + 1 }] }
          : g
      )
    });
  };

  // Remover pergunta
  const removerPergunta = (grupoId: string, perguntaId: string) => {
    if (!checklistGerado) return;
    setChecklistGerado({
      ...checklistGerado,
      grupos: checklistGerado.grupos.map(g => 
        g.id === grupoId 
          ? { ...g, perguntas: g.perguntas.filter(p => p.id !== perguntaId) }
          : g
      )
    });
  };

  // Atualizar pergunta
  const atualizarPergunta = (grupoId: string, perguntaId: string, updates: Partial<Pergunta>) => {
    if (!checklistGerado) return;
    setChecklistGerado({
      ...checklistGerado,
      grupos: checklistGerado.grupos.map(g => 
        g.id === grupoId 
          ? { 
              ...g, 
              perguntas: g.perguntas.map(p => 
                p.id === perguntaId ? { ...p, ...updates } : p
              ) 
            }
          : g
      )
    });
  };

  // Atualizar grupo
  const atualizarGrupo = (grupoId: string, updates: Partial<GrupoPerguntas>) => {
    if (!checklistGerado) return;
    setChecklistGerado({
      ...checklistGerado,
      grupos: checklistGerado.grupos.map(g => 
        g.id === grupoId ? { ...g, ...updates } : g
      )
    });
  };

  // Confirmar e salvar
  const handleConfirmar = () => {
    if (!checklistGerado) return;
    onChecklistGerado(checklistGerado);
    handleClose();
  };

  // Contar total de perguntas
  const totalPerguntas = checklistGerado?.grupos.reduce((acc, g) => acc + g.perguntas.length, 0) || 0;

  // Renderizar ícone do tipo de pergunta
  const renderTipoIcon = (tipo: string) => {
    const config = TIPOS_PERGUNTA[tipo];
    if (!config) return <Type className="h-4 w-4" />;
    const Icon = config.icon;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Gerar Checklist com IA
          </DialogTitle>
          <DialogDescription>
            Cole um texto, procedimento ou anexe um documento para gerar automaticamente um checklist estruturado
          </DialogDescription>
        </DialogHeader>

        {/* Configuração da API Key */}
        {showApiKeyInput && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Configure sua chave da API</span>
                </div>
                
                {/* Seletor de Provider */}
                <div className="flex gap-2">
                  <Button
                    variant={aiProvider === "gemini" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleProviderChange("gemini")}
                    className={aiProvider === "gemini" ? "bg-blue-600 hover:bg-blue-700" : ""}
                  >
                    🔷 Google Gemini
                  </Button>
                  <Button
                    variant={aiProvider === "openai" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleProviderChange("openai")}
                    className={aiProvider === "openai" ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    🟢 OpenAI GPT-4
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={aiProvider === "gemini" ? "AIza..." : "sk-..."}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleSaveApiKey} disabled={!apiKey}>
                    Salvar
                  </Button>
                  <Button variant="ghost" onClick={() => setShowApiKeyInput(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-amber-600">
                  {aiProvider === "gemini" 
                    ? "Obtenha sua chave em: https://aistudio.google.com/app/apikey"
                    : "Obtenha sua chave em: https://platform.openai.com/api-keys"
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  Sua chave é armazenada localmente no navegador e usada apenas para gerar checklists.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Input */}
        {step === "input" && (
          <div className="flex-1 overflow-auto space-y-4">
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as "text" | "file")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Colar Texto
                </TabsTrigger>
                <TabsTrigger value="file" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Anexar Arquivo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Cole aqui o procedimento, norma ou texto base</Label>
                  <Textarea
                    placeholder="Ex: Procedimento de inspeção de medidores de energia...

1. Verificar lacre do medidor
2. Conferir número de série
3. Verificar se há sinais de violação
4. Fotografar o medidor
..."
                    value={textoEntrada}
                    onChange={(e) => setTextoEntrada(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Quanto mais detalhado o texto, melhor será o checklist gerado</span>
                </div>
              </TabsContent>

              <TabsContent value="file" className="space-y-4 mt-4">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    "hover:border-violet-400 hover:bg-violet-50/50",
                    arquivos.length > 0 ? "border-green-300 bg-green-50/50" : "border-gray-300"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.pdf,.doc,.docx,.md,.rtf,.jpg,.jpeg,.png,.gif,.webp,image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium">Arraste arquivos ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formatos aceitos: TXT, PDF, DOC, DOCX, MD, RTF, JPG, PNG, GIF, WEBP
                  </p>
                  <p className="text-xs text-violet-600 mt-2">
                    💡 PDFs e imagens são processados diretamente pela IA para extrair TODAS as perguntas
                  </p>
                </div>

                {arquivos.length > 0 && (
                  <div className="space-y-2">
                    <Label>Arquivos selecionados ({arquivos.length})</Label>
                    <div className="space-y-2">
                      {arquivos.map((arquivo, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <FileText className="h-5 w-5 text-violet-500" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{arquivo.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(arquivo.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeArquivo(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setShowApiKeyInput(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Configurar API
                </Button>
                <Badge variant="outline" className={aiProvider === "gemini" ? "border-blue-300 text-blue-700" : "border-green-300 text-green-700"}>
                  {aiProvider === "gemini" ? "🔷 Gemini" : "🟢 GPT-4"}
                  {apiKey ? " ✓" : ""}
                </Badge>
              </div>
              <Button 
                onClick={gerarComIA}
                disabled={
                  (inputType === "text" && !textoEntrada.trim()) ||
                  (inputType === "file" && arquivos.length === 0)
                }
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Gerar com IA
              </Button>
            </div>
          </div>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 animate-ping">
                <Brain className="h-16 w-16 text-violet-300" />
              </div>
              <Brain className="h-16 w-16 text-violet-500 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Processando com IA...</h3>
              <p className="text-muted-foreground">{progressMessage}</p>
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              <span className="text-sm text-muted-foreground">Isso pode levar alguns segundos</span>
            </div>
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-red-800">Erro ao Gerar Checklist</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Ocorreu um erro durante a geração. Veja os detalhes abaixo:
                </p>
              </div>
            </div>

            <Card className="w-full max-w-2xl border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-red-700 font-medium">Mensagem de Erro:</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(errorMessage);
                        toast.success("Erro copiado para a área de transferência!");
                      }}
                      className="text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar
                    </Button>
                  </div>
                  <div className="bg-white border border-red-200 rounded-md p-3 max-h-48 overflow-auto">
                    <pre className="text-sm text-red-800 whitespace-pre-wrap break-words font-mono">
                      {errorMessage}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center space-y-2 text-sm text-muted-foreground">
              <p>Possíveis soluções:</p>
              <ul className="list-disc list-inside text-left">
                <li>Verifique se a chave da API está correta</li>
                <li>Verifique se você tem créditos/quota disponível</li>
                <li>Tente novamente em alguns segundos</li>
                <li>Tente com um texto menor ou mais simples</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowApiKeyInput(true)}>
                <Settings2 className="h-4 w-4 mr-2" />
                Verificar API
              </Button>
              <Button onClick={() => setStep("input")}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && checklistGerado && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{checklistGerado.nome}</h3>
                <p className="text-sm text-muted-foreground">{checklistGerado.descricao}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{checklistGerado.tipo}</Badge>
                <Badge>{checklistGerado.grupos.length} grupos</Badge>
                <Badge>{totalPerguntas} perguntas</Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 mt-4">
              <Accordion type="multiple" defaultValue={checklistGerado.grupos.map(g => g.id)} className="space-y-2">
                {checklistGerado.grupos.map((grupo) => (
                  <AccordionItem key={grupo.id} value={grupo.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Layers className="h-4 w-4 text-violet-500" />
                        <div className="text-left">
                          <p className="font-medium">{grupo.nome}</p>
                          {grupo.descricao && (
                            <p className="text-xs text-muted-foreground">{grupo.descricao}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {grupo.perguntas.length} perguntas
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
                        {grupo.perguntas.map((pergunta, idx) => (
                          <div
                            key={pergunta.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-violet-100 text-violet-600 text-xs font-medium">
                              {idx + 1}
                            </span>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                {renderTipoIcon(pergunta.tipo)}
                                <span className="font-medium text-sm">{pergunta.texto}</span>
                                {pergunta.obrigatoria && (
                                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                                )}
                              </div>
                              {pergunta.descricao && (
                                <p className="text-xs text-muted-foreground">{pergunta.descricao}</p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {TIPOS_PERGUNTA[pergunta.tipo]?.label || pergunta.tipo}
                                </Badge>
                                {pergunta.foto_obrigatoria && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Camera className="h-3 w-3 mr-1" />
                                    Foto obrigatória
                                  </Badge>
                                )}
                                {pergunta.condicoes && pergunta.condicoes.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Zap className="h-3 w-3 mr-1" />
                                    {pergunta.condicoes.length} regra(s)
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {/* Configurações */}
              {checklistGerado.configuracoes && (
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      Configurações Gerais
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={cn(
                          "h-4 w-4",
                          checklistGerado.configuracoes.exige_localizacao ? "text-green-500" : "text-gray-300"
                        )} />
                        <span>Exige localização GPS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={cn(
                          "h-4 w-4",
                          checklistGerado.configuracoes.exige_assinatura ? "text-green-500" : "text-gray-300"
                        )} />
                        <span>Exige assinatura</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={cn(
                          "h-4 w-4",
                          checklistGerado.configuracoes.exige_foto_inicial ? "text-green-500" : "text-gray-300"
                        )} />
                        <span>Foto inicial</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={cn(
                          "h-4 w-4",
                          checklistGerado.configuracoes.exige_foto_final ? "text-green-500" : "text-gray-300"
                        )} />
                        <span>Foto final</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </ScrollArea>

            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("input")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Gerar Novamente
                </Button>
                <Button variant="outline" onClick={() => setStep("editing")}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </div>
              <Button onClick={handleConfirmar} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Usar este Checklist
              </Button>
            </div>
          </div>
        )}

        {/* Step: Editing */}
        {step === "editing" && checklistGerado && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="space-y-4 pb-4 border-b">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Checklist</Label>
                  <Input
                    value={checklistGerado.nome}
                    onChange={(e) => setChecklistGerado({ ...checklistGerado, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={checklistGerado.tipo}
                    onValueChange={(v) => setChecklistGerado({ ...checklistGerado, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CHECKLIST.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={checklistGerado.descricao}
                  onChange={(e) => setChecklistGerado({ ...checklistGerado, descricao: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <ScrollArea className="flex-1 mt-4">
              <div className="space-y-4">
                {checklistGerado.grupos.map((grupo, gIdx) => (
                  <Card key={grupo.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <Input
                          value={grupo.nome}
                          onChange={(e) => atualizarGrupo(grupo.id, { nome: e.target.value })}
                          className="font-semibold"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removerGrupo(grupo.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {grupo.perguntas.map((pergunta, pIdx) => (
                        <div key={pergunta.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                          <GripVertical className="h-4 w-4 text-gray-400 mt-2" />
                          <div className="flex-1 space-y-2">
                            <Input
                              value={pergunta.texto}
                              onChange={(e) => atualizarPergunta(grupo.id, pergunta.id, { texto: e.target.value })}
                              placeholder="Texto da pergunta"
                            />
                            <div className="flex items-center gap-2">
                              <Select
                                value={pergunta.tipo}
                                onValueChange={(v) => atualizarPergunta(grupo.id, pergunta.id, { tipo: v })}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(TIPOS_PERGUNTA).map(([key, val]) => (
                                    <SelectItem key={key} value={key}>
                                      <div className="flex items-center gap-2">
                                        <val.icon className="h-4 w-4" />
                                        {val.label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={pergunta.obrigatoria}
                                  onCheckedChange={(v) => atualizarPergunta(grupo.id, pergunta.id, { obrigatoria: v })}
                                />
                                <Label className="text-xs">Obrigatória</Label>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removerPergunta(grupo.id, pergunta.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => adicionarPergunta(grupo.id)}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Pergunta
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  onClick={adicionarGrupo}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Grupo
                </Button>
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setStep("preview")}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Button>
              <Button onClick={handleConfirmar} className="bg-green-600 hover:bg-green-700">
                <Save className="h-4 w-4 mr-2" />
                Salvar Checklist
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

