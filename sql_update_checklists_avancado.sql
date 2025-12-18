-- Atualizar tabela de Checklists para suportar estrutura avançada
-- Execute este SQL no Supabase SQL Editor

-- Adicionar novos campos à tabela checklists
ALTER TABLE public.checklists
ADD COLUMN IF NOT EXISTS versao VARCHAR(20) DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS grupos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS permite_salvar_rascunho BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS exige_localizacao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exige_foto_inicial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exige_foto_final BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exige_assinatura BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tempo_limite_minutos INTEGER,
ADD COLUMN IF NOT EXISTS usa_pontuacao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pontuacao_minima_aprovacao INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Comentários para documentação
COMMENT ON COLUMN public.checklists.versao IS 'Versão do checklist (ex: 1.0, 1.1, 2.0)';
COMMENT ON COLUMN public.checklists.grupos IS 'Array JSON de grupos/seções com perguntas aninhadas';
COMMENT ON COLUMN public.checklists.permite_salvar_rascunho IS 'Se permite salvar parcialmente';
COMMENT ON COLUMN public.checklists.exige_localizacao IS 'Se exige captura de GPS ao iniciar';
COMMENT ON COLUMN public.checklists.exige_foto_inicial IS 'Se exige foto antes de começar';
COMMENT ON COLUMN public.checklists.exige_foto_final IS 'Se exige foto ao finalizar';
COMMENT ON COLUMN public.checklists.exige_assinatura IS 'Se exige assinatura digital';
COMMENT ON COLUMN public.checklists.tempo_limite_minutos IS 'Tempo máximo para preenchimento';
COMMENT ON COLUMN public.checklists.usa_pontuacao IS 'Se usa sistema de pontuação/score';
COMMENT ON COLUMN public.checklists.pontuacao_minima_aprovacao IS 'Porcentagem mínima para aprovação';

/*
Estrutura do campo "grupos" (JSONB):
[
  {
    "id": "uuid",
    "nome": "Nome da Seção",
    "descricao": "Descrição opcional",
    "ordem": 1,
    "cor": "#3b82f6",
    "icone": "folder",
    "colapsavel": true,
    "colapsado_inicial": false,
    "condicoes": [...],
    "perguntas": [
      {
        "id": "uuid",
        "texto": "Texto da pergunta",
        "descricao": "Texto de ajuda",
        "tipo": "sim_nao|texto|numero|selecao_unica|multipla_escolha|foto|assinatura|etc",
        "obrigatoria": true,
        "ordem": 1,
        "grupo_id": "uuid",
        
        // Para seleção
        "opcoes": [
          {
            "id": "uuid",
            "texto": "Opção 1",
            "valor": "opt1",
            "cor": "#22c55e",
            "icone": "check",
            "pontuacao": 10,
            "exige_foto": false,
            "exige_observacao": false
          }
        ],
        
        // Configurações de mídia
        "foto_obrigatoria": false,
        "max_fotos": 5,
        "observacao_obrigatoria": false,
        
        // Validações
        "validacoes": [
          {
            "tipo": "min|max|regex|tamanho_min|tamanho_max|formato",
            "valor": "valor",
            "mensagem": "Mensagem de erro"
          }
        ],
        
        // Condições (lógica condicional)
        "condicoes": [
          {
            "id": "uuid",
            "pergunta_origem_id": "uuid da pergunta que dispara",
            "operador": "igual|diferente|maior|menor|contem|vazio|preenchido|sim|nao|conforme|nao_conforme",
            "valor": "valor comparado",
            "valor_fim": 100, // para operador "entre"
            "acao": "mostrar|ocultar|obrigar|desobrigar|exigir_foto|exigir_observacao|pular_para|finalizar|alerta|bloquear",
            "acao_valor": "id da pergunta/seção ou texto do alerta"
          }
        ],
        
        // Configurações numéricas
        "valor_min": 0,
        "valor_max": 100,
        "casas_decimais": 2,
        "unidade": "kg",
        
        // Configurações de escala
        "escala_min": 1,
        "escala_max": 5,
        "escala_labels": ["Muito Ruim", "Ruim", "Regular", "Bom", "Muito Bom"],
        
        // Placeholder e valor padrão
        "placeholder": "Digite aqui...",
        "valor_padrao": "",
        
        // Pontuação
        "peso": 1,
        "pontuacao_maxima": 10,
        
        // Metadados
        "dica": "Dica de preenchimento",
        "referencia": "NR-35, ISO 9001"
      }
    ]
  }
]
*/

-- Atualizar tabela de respostas para suportar novos campos
ALTER TABLE public.checklist_respostas
ADD COLUMN IF NOT EXISTS versao_checklist VARCHAR(20),
ADD COLUMN IF NOT EXISTS tempo_preenchimento_segundos INTEGER,
ADD COLUMN IF NOT EXISTS pontuacao_obtida DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS pontuacao_maxima DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS aprovado BOOLEAN,
ADD COLUMN IF NOT EXISTS foto_inicial_url TEXT,
ADD COLUMN IF NOT EXISTS foto_final_url TEXT,
ADD COLUMN IF NOT EXISTS assinatura_url TEXT,
ADD COLUMN IF NOT EXISTS dispositivo_info JSONB;

-- Índices adicionais
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_aprovado ON public.checklist_respostas(aprovado);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_pontuacao ON public.checklist_respostas(pontuacao_obtida);

-- Comentários
COMMENT ON COLUMN public.checklist_respostas.versao_checklist IS 'Versão do checklist no momento do preenchimento';
COMMENT ON COLUMN public.checklist_respostas.tempo_preenchimento_segundos IS 'Tempo total de preenchimento';
COMMENT ON COLUMN public.checklist_respostas.pontuacao_obtida IS 'Score obtido (se usa pontuação)';
COMMENT ON COLUMN public.checklist_respostas.pontuacao_maxima IS 'Score máximo possível';
COMMENT ON COLUMN public.checklist_respostas.aprovado IS 'Se atingiu pontuação mínima';
COMMENT ON COLUMN public.checklist_respostas.dispositivo_info IS 'Info do dispositivo (modelo, SO, versão app)';

/*
Estrutura do campo "respostas" (JSONB):
[
  {
    "pergunta_id": "uuid",
    "grupo_id": "uuid",
    "resposta": "valor da resposta (string, number, boolean, array)",
    "foto_url": "url da foto (se houver)",
    "fotos_urls": ["url1", "url2"], // para múltiplas fotos
    "assinatura_url": "url da assinatura (se houver)",
    "observacao": "texto de observação (se houver)",
    "pontuacao": 8, // pontuação obtida nesta pergunta
    "respondido_em": "2025-01-01T10:00:00Z",
    "localizacao": {
      "latitude": -23.5505,
      "longitude": -46.6333,
      "precisao": 10
    }
  }
]
*/

-- Inserir/Atualizar checklist de APR padrão com estrutura avançada
INSERT INTO public.checklists (nome, descricao, tipo, versao, ativo, grupos, exige_localizacao, exige_assinatura) VALUES (
  'APR - Análise Preliminar de Riscos (Avançado)',
  'Checklist completo de análise de riscos antes de iniciar o serviço em campo',
  'apr',
  '2.0',
  true,
  '[
    {
      "id": "grupo-1",
      "nome": "Identificação",
      "descricao": "Informações básicas do local e serviço",
      "ordem": 1,
      "perguntas": [
        {
          "id": "p1",
          "texto": "Local de trabalho",
          "tipo": "texto",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "grupo-1",
          "placeholder": "Descreva o local..."
        },
        {
          "id": "p2",
          "texto": "Foto do local",
          "tipo": "foto",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "grupo-1"
        }
      ]
    },
    {
      "id": "grupo-2",
      "nome": "Condições do Ambiente",
      "descricao": "Avalie as condições do ambiente de trabalho",
      "ordem": 2,
      "perguntas": [
        {
          "id": "p3",
          "texto": "O local está limpo e organizado?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "grupo-2",
          "condicoes": [
            {
              "id": "c1",
              "pergunta_origem_id": "p3",
              "operador": "nao",
              "acao": "exigir_foto"
            },
            {
              "id": "c2",
              "pergunta_origem_id": "p3",
              "operador": "nao",
              "acao": "exigir_observacao"
            }
          ]
        },
        {
          "id": "p4",
          "texto": "Há sinalização adequada?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "grupo-2"
        },
        {
          "id": "p5",
          "texto": "Condições climáticas adequadas?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "grupo-2"
        }
      ]
    },
    {
      "id": "grupo-3",
      "nome": "Equipamentos de Proteção",
      "descricao": "Verifique os EPIs disponíveis e em uso",
      "ordem": 3,
      "perguntas": [
        {
          "id": "p6",
          "texto": "EPIs em bom estado de conservação?",
          "tipo": "conforme_nao_conforme",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "grupo-3",
          "foto_obrigatoria": true
        },
        {
          "id": "p7",
          "texto": "Quais EPIs estão sendo utilizados?",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "grupo-3",
          "opcoes": [
            {"id": "epi1", "texto": "Capacete"},
            {"id": "epi2", "texto": "Óculos de proteção"},
            {"id": "epi3", "texto": "Luvas"},
            {"id": "epi4", "texto": "Botina de segurança"},
            {"id": "epi5", "texto": "Colete refletivo"},
            {"id": "epi6", "texto": "Protetor auricular"},
            {"id": "epi7", "texto": "Cinto de segurança", "exige_foto": true}
          ]
        }
      ]
    },
    {
      "id": "grupo-4",
      "nome": "Identificação de Riscos",
      "descricao": "Identifique os riscos presentes no local",
      "ordem": 4,
      "perguntas": [
        {
          "id": "p8",
          "texto": "Há risco de queda de altura?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "grupo-4",
          "condicoes": [
            {
              "id": "c3",
              "pergunta_origem_id": "p8",
              "operador": "sim",
              "acao": "mostrar",
              "acao_valor": "p8a"
            }
          ]
        },
        {
          "id": "p8a",
          "texto": "Altura aproximada (metros)",
          "tipo": "numero",
          "obrigatoria": false,
          "ordem": 2,
          "grupo_id": "grupo-4",
          "unidade": "m",
          "valor_min": 0,
          "valor_max": 100,
          "visivel_se": [
            {
              "id": "v1",
              "pergunta_origem_id": "p8",
              "operador": "sim",
              "acao": "mostrar"
            }
          ]
        },
        {
          "id": "p9",
          "texto": "Há risco de choque elétrico?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "grupo-4"
        },
        {
          "id": "p10",
          "texto": "Nível geral de risco",
          "tipo": "escala",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "grupo-4",
          "escala_min": 1,
          "escala_max": 5,
          "escala_labels": ["Muito Baixo", "Baixo", "Médio", "Alto", "Muito Alto"]
        }
      ]
    },
    {
      "id": "grupo-5",
      "nome": "Observações e Assinatura",
      "descricao": "Finalize a APR",
      "ordem": 5,
      "perguntas": [
        {
          "id": "p11",
          "texto": "Observações gerais",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 1,
          "grupo_id": "grupo-5",
          "placeholder": "Descreva quaisquer observações adicionais..."
        },
        {
          "id": "p12",
          "texto": "Assinatura do responsável",
          "tipo": "assinatura",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "grupo-5"
        }
      ]
    }
  ]'::jsonb,
  true,
  true
) ON CONFLICT DO NOTHING;


-- Execute este SQL no Supabase SQL Editor

-- Adicionar novos campos à tabela checklists
ALTER TABLE public.checklists
ADD COLUMN IF NOT EXISTS versao VARCHAR(20) DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS grupos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS permite_salvar_rascunho BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS exige_localizacao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exige_foto_inicial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exige_foto_final BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exige_assinatura BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tempo_limite_minutos INTEGER,
ADD COLUMN IF NOT EXISTS usa_pontuacao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pontuacao_minima_aprovacao INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Comentários para documentação
COMMENT ON COLUMN public.checklists.versao IS 'Versão do checklist (ex: 1.0, 1.1, 2.0)';
COMMENT ON COLUMN public.checklists.grupos IS 'Array JSON de grupos/seções com perguntas aninhadas';
COMMENT ON COLUMN public.checklists.permite_salvar_rascunho IS 'Se permite salvar parcialmente';
COMMENT ON COLUMN public.checklists.exige_localizacao IS 'Se exige captura de GPS ao iniciar';
COMMENT ON COLUMN public.checklists.exige_foto_inicial IS 'Se exige foto antes de começar';
COMMENT ON COLUMN public.checklists.exige_foto_final IS 'Se exige foto ao finalizar';
COMMENT ON COLUMN public.checklists.exige_assinatura IS 'Se exige assinatura digital';
COMMENT ON COLUMN public.checklists.tempo_limite_minutos IS 'Tempo máximo para preenchimento';
COMMENT ON COLUMN public.checklists.usa_pontuacao IS 'Se usa sistema de pontuação/score';
COMMENT ON COLUMN public.checklists.pontuacao_minima_aprovacao IS 'Porcentagem mínima para aprovação';

/*
Estrutura do campo "grupos" (JSONB):
[
  {
    "id": "uuid",
    "nome": "Nome da Seção",
    "descricao": "Descrição opcional",
    "ordem": 1,
    "cor": "#3b82f6",
    "icone": "folder",
    "colapsavel": true,
    "colapsado_inicial": false,
    "condicoes": [...],
    "perguntas": [
      {
        "id": "uuid",
        "texto": "Texto da pergunta",
        "descricao": "Texto de ajuda",
        "tipo": "sim_nao|texto|numero|selecao_unica|multipla_escolha|foto|assinatura|etc",
        "obrigatoria": true,
        "ordem": 1,
        "grupo_id": "uuid",
        
        // Para seleção
        "opcoes": [
          {
            "id": "uuid",
            "texto": "Opção 1",
            "valor": "opt1",
            "cor": "#22c55e",
            "icone": "check",
            "pontuacao": 10,
            "exige_foto": false,
            "exige_observacao": false
          }
        ],
        
        // Configurações de mídia
        "foto_obrigatoria": false,
        "max_fotos": 5,
        "observacao_obrigatoria": false,
        
        // Validações
        "validacoes": [
          {
            "tipo": "min|max|regex|tamanho_min|tamanho_max|formato",
            "valor": "valor",
            "mensagem": "Mensagem de erro"
          }
        ],
        
        // Condições (lógica condicional)
        "condicoes": [
          {
            "id": "uuid",
            "pergunta_origem_id": "uuid da pergunta que dispara",
            "operador": "igual|diferente|maior|menor|contem|vazio|preenchido|sim|nao|conforme|nao_conforme",
            "valor": "valor comparado",
            "valor_fim": 100, // para operador "entre"
            "acao": "mostrar|ocultar|obrigar|desobrigar|exigir_foto|exigir_observacao|pular_para|finalizar|alerta|bloquear",
            "acao_valor": "id da pergunta/seção ou texto do alerta"
          }
        ],
        
        // Configurações numéricas
        "valor_min": 0,
        "valor_max": 100,
        "casas_decimais": 2,
        "unidade": "kg",
        
        // Configurações de escala
        "escala_min": 1,
        "escala_max": 5,
        "escala_labels": ["Muito Ruim", "Ruim", "Regular", "Bom", "Muito Bom"],
        
        // Placeholder e valor padrão
        "placeholder": "Digite aqui...",
        "valor_padrao": "",
        
        // Pontuação
        "peso": 1,
        "pontuacao_maxima": 10,
        
        // Metadados
        "dica": "Dica de preenchimento",
        "referencia": "NR-35, ISO 9001"
      }
    ]
  }
]
*/

-- Atualizar tabela de respostas para suportar novos campos
ALTER TABLE public.checklist_respostas
ADD COLUMN IF NOT EXISTS versao_checklist VARCHAR(20),
ADD COLUMN IF NOT EXISTS tempo_preenchimento_segundos INTEGER,
ADD COLUMN IF NOT EXISTS pontuacao_obtida DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS pontuacao_maxima DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS aprovado BOOLEAN,
ADD COLUMN IF NOT EXISTS foto_inicial_url TEXT,
ADD COLUMN IF NOT EXISTS foto_final_url TEXT,
ADD COLUMN IF NOT EXISTS assinatura_url TEXT,
ADD COLUMN IF NOT EXISTS dispositivo_info JSONB;

-- Índices adicionais
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_aprovado ON public.checklist_respostas(aprovado);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_pontuacao ON public.checklist_respostas(pontuacao_obtida);

-- Comentários
COMMENT ON COLUMN public.checklist_respostas.versao_checklist IS 'Versão do checklist no momento do preenchimento';
COMMENT ON COLUMN public.checklist_respostas.tempo_preenchimento_segundos IS 'Tempo total de preenchimento';
COMMENT ON COLUMN public.checklist_respostas.pontuacao_obtida IS 'Score obtido (se usa pontuação)';
COMMENT ON COLUMN public.checklist_respostas.pontuacao_maxima IS 'Score máximo possível';
COMMENT ON COLUMN public.checklist_respostas.aprovado IS 'Se atingiu pontuação mínima';
COMMENT ON COLUMN public.checklist_respostas.dispositivo_info IS 'Info do dispositivo (modelo, SO, versão app)';

/*
Estrutura do campo "respostas" (JSONB):
[
  {
    "pergunta_id": "uuid",
    "grupo_id": "uuid",
    "resposta": "valor da resposta (string, number, boolean, array)",
    "foto_url": "url da foto (se houver)",
    "fotos_urls": ["url1", "url2"], // para múltiplas fotos
    "assinatura_url": "url da assinatura (se houver)",
    "observacao": "texto de observação (se houver)",
    "pontuacao": 8, // pontuação obtida nesta pergunta
    "respondido_em": "2025-01-01T10:00:00Z",
    "localizacao": {
      "latitude": -23.5505,
      "longitude": -46.6333,
      "precisao": 10
    }
  }
]
*/

-- Inserir/Atualizar checklist de APR padrão com estrutura avançada
INSERT INTO public.checklists (nome, descricao, tipo, versao, ativo, grupos, exige_localizacao, exige_assinatura) VALUES (
  'APR - Análise Preliminar de Riscos (Avançado)',
  'Checklist completo de análise de riscos antes de iniciar o serviço em campo',
  'apr',
  '2.0',
  true,
  '[
    {
      "id": "grupo-1",
      "nome": "Identificação",
      "descricao": "Informações básicas do local e serviço",
      "ordem": 1,
      "perguntas": [
        {
          "id": "p1",
          "texto": "Local de trabalho",
          "tipo": "texto",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "grupo-1",
          "placeholder": "Descreva o local..."
        },
        {
          "id": "p2",
          "texto": "Foto do local",
          "tipo": "foto",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "grupo-1"
        }
      ]
    },
    {
      "id": "grupo-2",
      "nome": "Condições do Ambiente",
      "descricao": "Avalie as condições do ambiente de trabalho",
      "ordem": 2,
      "perguntas": [
        {
          "id": "p3",
          "texto": "O local está limpo e organizado?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "grupo-2",
          "condicoes": [
            {
              "id": "c1",
              "pergunta_origem_id": "p3",
              "operador": "nao",
              "acao": "exigir_foto"
            },
            {
              "id": "c2",
              "pergunta_origem_id": "p3",
              "operador": "nao",
              "acao": "exigir_observacao"
            }
          ]
        },
        {
          "id": "p4",
          "texto": "Há sinalização adequada?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "grupo-2"
        },
        {
          "id": "p5",
          "texto": "Condições climáticas adequadas?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "grupo-2"
        }
      ]
    },
    {
      "id": "grupo-3",
      "nome": "Equipamentos de Proteção",
      "descricao": "Verifique os EPIs disponíveis e em uso",
      "ordem": 3,
      "perguntas": [
        {
          "id": "p6",
          "texto": "EPIs em bom estado de conservação?",
          "tipo": "conforme_nao_conforme",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "grupo-3",
          "foto_obrigatoria": true
        },
        {
          "id": "p7",
          "texto": "Quais EPIs estão sendo utilizados?",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "grupo-3",
          "opcoes": [
            {"id": "epi1", "texto": "Capacete"},
            {"id": "epi2", "texto": "Óculos de proteção"},
            {"id": "epi3", "texto": "Luvas"},
            {"id": "epi4", "texto": "Botina de segurança"},
            {"id": "epi5", "texto": "Colete refletivo"},
            {"id": "epi6", "texto": "Protetor auricular"},
            {"id": "epi7", "texto": "Cinto de segurança", "exige_foto": true}
          ]
        }
      ]
    },
    {
      "id": "grupo-4",
      "nome": "Identificação de Riscos",
      "descricao": "Identifique os riscos presentes no local",
      "ordem": 4,
      "perguntas": [
        {
          "id": "p8",
          "texto": "Há risco de queda de altura?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "grupo-4",
          "condicoes": [
            {
              "id": "c3",
              "pergunta_origem_id": "p8",
              "operador": "sim",
              "acao": "mostrar",
              "acao_valor": "p8a"
            }
          ]
        },
        {
          "id": "p8a",
          "texto": "Altura aproximada (metros)",
          "tipo": "numero",
          "obrigatoria": false,
          "ordem": 2,
          "grupo_id": "grupo-4",
          "unidade": "m",
          "valor_min": 0,
          "valor_max": 100,
          "visivel_se": [
            {
              "id": "v1",
              "pergunta_origem_id": "p8",
              "operador": "sim",
              "acao": "mostrar"
            }
          ]
        },
        {
          "id": "p9",
          "texto": "Há risco de choque elétrico?",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "grupo-4"
        },
        {
          "id": "p10",
          "texto": "Nível geral de risco",
          "tipo": "escala",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "grupo-4",
          "escala_min": 1,
          "escala_max": 5,
          "escala_labels": ["Muito Baixo", "Baixo", "Médio", "Alto", "Muito Alto"]
        }
      ]
    },
    {
      "id": "grupo-5",
      "nome": "Observações e Assinatura",
      "descricao": "Finalize a APR",
      "ordem": 5,
      "perguntas": [
        {
          "id": "p11",
          "texto": "Observações gerais",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 1,
          "grupo_id": "grupo-5",
          "placeholder": "Descreva quaisquer observações adicionais..."
        },
        {
          "id": "p12",
          "texto": "Assinatura do responsável",
          "tipo": "assinatura",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "grupo-5"
        }
      ]
    }
  ]'::jsonb,
  true,
  true
) ON CONFLICT DO NOTHING;





