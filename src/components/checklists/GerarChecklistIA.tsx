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
  const [step, setStep] = useState<"input" | "processing" | "preview" | "editing">("input");
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
      return ['txt', 'pdf', 'doc', 'docx', 'md', 'rtf'].includes(ext || '');
    });

    if (validFiles.length !== files.length) {
      toast.warning("Alguns arquivos foram ignorados. Formatos aceitos: TXT, PDF, DOC, DOCX, MD, RTF");
    }

    setArquivos(prev => [...prev, ...validFiles]);
  }, []);

  // Remover arquivo
  const removeArquivo = (index: number) => {
    setArquivos(prev => prev.filter((_, i) => i !== index));
  };

  // Extrair texto de arquivos
  const extrairTextoArquivos = async (): Promise<string> => {
    let textoTotal = "";

    for (const arquivo of arquivos) {
      const ext = arquivo.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'txt' || ext === 'md') {
        textoTotal += await arquivo.text() + "\n\n";
      } else if (ext === 'pdf') {
        // Para PDF, vamos usar uma abordagem simplificada
        // Em produção, usar pdf.js ou similar
        textoTotal += `[Conteúdo do arquivo PDF: ${arquivo.name}]\n\n`;
        toast.info("PDFs serão processados pela IA com base no nome e contexto");
      } else if (ext === 'doc' || ext === 'docx') {
        textoTotal += `[Conteúdo do arquivo Word: ${arquivo.name}]\n\n`;
        toast.info("Arquivos Word serão processados pela IA com base no nome e contexto");
      }
    }

    return textoTotal;
  };

  // Gerar checklist com IA
  const gerarComIA = async () => {
    if (!apiKey) {
      setShowApiKeyInput(true);
      toast.error(`Configure sua chave da API ${aiProvider === "gemini" ? "Gemini" : "OpenAI"} primeiro`);
      return;
    }

    const textoParaProcessar = inputType === "text" 
      ? textoEntrada 
      : await extrairTextoArquivos();

    if (!textoParaProcessar.trim()) {
      toast.error("Forneça um texto ou arquivo para gerar o checklist");
      return;
    }

    setIsProcessing(true);
    setStep("processing");
    setProgressMessage(`Analisando conteúdo com ${aiProvider === "gemini" ? "Gemini" : "GPT-4"}...`);

    try {
      const prompt = `Você é um especialista em criar formulários de checklist para o setor elétrico e de serviços de campo.

Analise o seguinte conteúdo e crie um checklist completo e estruturado:

---
${textoParaProcessar}
---

INSTRUÇÕES:
1. Identifique o tipo/propósito do checklist
2. Organize as perguntas em grupos/seções lógicas
3. Para cada pergunta, determine:
   - Tipo mais adequado (texto, numero, sim_nao, conforme_nao_conforme, selecao_unica, multipla_escolha, escala, foto, assinatura, data, informativo)
   - Se é obrigatória
   - Opções de resposta (quando aplicável)
   - Condições/regras (ex: se responder "não", exigir foto)
   - Dicas ou instruções

4. Adicione regras inteligentes como:
   - Exigir foto quando houver não conformidade
   - Exigir observação para respostas negativas
   - Campos condicionais baseados em respostas anteriores

5. Inclua campos padrão relevantes como:
   - Identificação do responsável
   - Data/hora
   - Localização (se aplicável)
   - Assinatura de conclusão

RESPONDA APENAS COM JSON VÁLIDO no seguinte formato:
{
  "nome": "Nome do Checklist",
  "descricao": "Descrição breve do propósito",
  "tipo": "tipo_do_checklist",
  "grupos": [
    {
      "id": "grupo_1",
      "nome": "Nome do Grupo",
      "descricao": "Descrição do grupo",
      "ordem": 1,
      "perguntas": [
        {
          "id": "p1",
          "texto": "Texto da pergunta?",
          "descricao": "Instrução adicional",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "opcoes": [
            { "id": "op1", "texto": "Opção 1", "exige_foto": false }
          ],
          "foto_obrigatoria": false,
          "observacao_obrigatoria": false,
          "condicoes": [
            {
              "id": "c1",
              "pergunta_origem_id": "p1",
              "operador": "igual",
              "valor": "nao",
              "acao": "exigir_foto"
            }
          ],
          "dica": "Dica para o usuário"
        }
      ]
    }
  ],
  "configuracoes": {
    "exige_localizacao": true,
    "exige_foto_inicial": false,
    "exige_foto_final": false,
    "exige_assinatura": true,
    "permite_salvar_rascunho": true
  }
}

Tipos de checklist válidos: apr, inspecao, manutencao, recebimento_materiais, seguranca, qualidade, auditoria, outro

Tipos de pergunta válidos: texto, texto_longo, numero, sim_nao, conforme_nao_conforme, selecao_unica, multipla_escolha, escala, foto, assinatura, data, informativo

Operadores de condição: igual, diferente, contem, maior, menor, vazio, preenchido, sim, nao, conforme, nao_conforme

Ações de condição: mostrar, ocultar, obrigar, desobrigar, exigir_foto, exigir_observacao, alerta`;

      setProgressMessage(`Gerando checklist com ${aiProvider === "gemini" ? "Gemini" : "GPT-4"}...`);

      let conteudo: string;

      if (aiProvider === "gemini") {
        // Chamada para Google Gemini API
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
                responseMimeType: "application/json"
              }
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Erro na API Gemini");
        }

        const data = await response.json();
        conteudo = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!conteudo) {
          throw new Error("Resposta vazia do Gemini");
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

      const checklistData = JSON.parse(jsonStr.trim()) as ChecklistGerado;
      
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
      toast.error(error.message || "Erro ao gerar checklist");
      setStep("input");
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
                    accept=".txt,.pdf,.doc,.docx,.md,.rtf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium">Arraste arquivos ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formatos aceitos: TXT, PDF, DOC, DOCX, MD, RTF
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

