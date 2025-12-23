-- Criar APR Completa baseada no modelo fornecido
-- Execute este SQL no Supabase SQL Editor

-- Primeiro, deletar APR existente se houver (opcional - comente se quiser manter)
-- DELETE FROM public.checklists WHERE tipo = 'apr';

-- Inserir APR completa
INSERT INTO public.checklists (nome, descricao, tipo, versao, ativo, exige_localizacao, exige_assinatura, grupos) VALUES (
  'APR - Análise Preliminar de Riscos',
  'Checklist completo de análise preliminar de riscos para trabalhos em campo',
  'apr',
  '1.0',
  true,
  true,
  true,
  '[
    {
      "id": "sec-01",
      "nome": "01. AMBIENTE DE TRABALHO ANALISADO",
      "descricao": "Registro fotográfico do ambiente de trabalho",
      "ordem": 1,
      "perguntas": [
        {
          "id": "p-1-1",
          "texto": "Foto do ambiente de trabalho (foto geral do local)",
          "tipo": "foto",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-01"
        }
      ]
    },
    {
      "id": "sec-02",
      "nome": "02. RISCO ELÉTRICO",
      "descricao": "Identificação de riscos elétricos no ambiente",
      "ordem": 2,
      "perguntas": [
        {
          "id": "p-2-1",
          "texto": "Arco elétrico (operação de chaves grupo A)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-2",
          "texto": "Contato acidental com barramento/cabo energizados",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-3",
          "texto": "Curto Circuito (fase-terra / fase-fase)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-4",
          "texto": "Explosão de equipamentos",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-5",
          "texto": "Intervenção na rede por terceiros (geração)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-6",
          "texto": "Presença de tensão elétrica indevida",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 6,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-7",
          "texto": "Tensão de passo (subestação)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 7,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-8",
          "texto": "Medidas Adotadas - Risco Elétrico",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 8,
          "grupo_id": "sec-02",
          "opcoes": [
            {"id": "m2-1", "texto": "Sinalizar e delimitar a área de trabalho"},
            {"id": "m2-2", "texto": "Abrir com corte visível"},
            {"id": "m2-3", "texto": "Limitar mec - Instalar placa de sinalização"},
            {"id": "m2-4", "texto": "Verificar ausência de tensão"},
            {"id": "m2-5", "texto": "Aterrar (lado fonte - lado carga)"},
            {"id": "m2-6", "texto": "Manter distância de segurança"},
            {"id": "m2-7", "texto": "Proteger os pontos vivos"},
            {"id": "m2-8", "texto": "Utilização do loadbuster (manobra)"},
            {"id": "m2-9", "texto": "Utilizar EPCs específicos"},
            {"id": "m2-10", "texto": "Utilizar EPIs específicos"},
            {"id": "m2-11", "texto": "Utilizar placa de sinalização"},
            {"id": "m2-12", "texto": "Corte visível do circuito elétrico (DSV)"}
          ]
        },
        {
          "id": "p-2-9",
          "texto": "Observações - Risco Elétrico",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 9,
          "grupo_id": "sec-02"
        }
      ]
    },
    {
      "id": "sec-03",
      "nome": "03. RISCO DE QUEDAS",
      "descricao": "Identificação de riscos de queda",
      "ordem": 3,
      "perguntas": [
        {
          "id": "p-3-1",
          "texto": "Difícil posicionamento da escada / em má condição",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-2",
          "texto": "Estrutura (poste auxiliar, pontalete, etc) em condições precárias",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-3",
          "texto": "Queda com diferença de nível",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-4",
          "texto": "Queda de material/ferramenta",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-5",
          "texto": "Queda no mesmo nível",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-6",
          "texto": "Tombamento de cesto (ligações garnets)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 6,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-7",
          "texto": "Engastamento/Implantação inadequada do poste",
          "tipo": "selecao_unica",
          "obrigatoria": true,
          "ordem": 7,
          "grupo_id": "sec-03",
          "opcoes": [
            {"id": "e3-1", "texto": "Não"},
            {"id": "e3-2", "texto": "Sim"},
            {"id": "e3-3", "texto": "Não se aplica"}
          ]
        },
        {
          "id": "p-3-8",
          "texto": "Medidas Adotadas - Risco de Quedas",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 8,
          "grupo_id": "sec-03",
          "opcoes": [
            {"id": "m3-1", "texto": "Amarrar escada (topo e centro)"},
            {"id": "m3-2", "texto": "Analisar integridade de estrutura"},
            {"id": "m3-3", "texto": "Apoiar no solo a sapata da escada"},
            {"id": "m3-4", "texto": "Utilização da bolsa para içar materiais"},
            {"id": "m3-5", "texto": "Utilização da corda de serviço"},
            {"id": "m3-6", "texto": "Utilização da linha da vida"},
            {"id": "m3-7", "texto": "Utilizar EPIs específicos"},
            {"id": "m3-8", "texto": "Utilizar apoios de sapata adequados"},
            {"id": "m3-9", "texto": "Verificar capacidade do sky/veículo"},
            {"id": "m3-10", "texto": "Verificar marcação de limite de engaste"}
          ]
        },
        {
          "id": "p-3-9",
          "texto": "Observações - Risco de Quedas",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 9,
          "grupo_id": "sec-03"
        }
      ]
    },
    {
      "id": "sec-04",
      "nome": "04. RISCOS RELACIONADOS A FERRAMENTAS DE TRABALHO",
      "descricao": "Identificação de riscos com ferramentas",
      "ordem": 4,
      "perguntas": [
        {
          "id": "p-4-1",
          "texto": "Ausência de ferramentas (está faltando alguma ferramenta para execução da atividade)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-04"
        },
        {
          "id": "p-4-2",
          "texto": "Ferramenta em má condição de uso",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-04"
        },
        {
          "id": "p-4-3",
          "texto": "Ferramenta Inadequada",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-04"
        },
        {
          "id": "p-4-4",
          "texto": "Medidas Adotadas - Risco Ferramental",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-04",
          "opcoes": [
            {"id": "m4-1", "texto": "Verificar tipo/dimensionamento adequado"},
            {"id": "m4-2", "texto": "Manuseio correto e adequado da ferramenta"},
            {"id": "m4-3", "texto": "Realizar check-list antes de sair"},
            {"id": "m4-4", "texto": "Verificar / testar ferramentas"}
          ]
        },
        {
          "id": "p-4-5",
          "texto": "Observações - Risco Ferramental",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 5,
          "grupo_id": "sec-04"
        }
      ]
    },
    {
      "id": "sec-05",
      "nome": "05. RISCOS DE DESLOCAMENTO DE VEÍCULOS, MOVIMENTAÇÃO DE CARGAS E PEDESTRES",
      "descricao": "Riscos relacionados a veículos e pedestres",
      "ordem": 5,
      "perguntas": [
        {
          "id": "p-5-1",
          "texto": "Área de tráfego de pedestres (tráfego intenso ou leve)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-2",
          "texto": "Área de tráfego de veículos (pista rápida, pista lenta, etc)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-3",
          "texto": "Deslocamento acidental do veículo",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-4",
          "texto": "Local sem área para estacionar veículo",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-5",
          "texto": "Veículo em condições inadequadas",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-6",
          "texto": "Exposição de pedestres/transeuntes",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 6,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-7",
          "texto": "Medidas Adotadas - Risco Colisão/Cargas",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 7,
          "grupo_id": "sec-05",
          "opcoes": [
            {"id": "m5-1", "texto": "Acionar freio de mão do veículo"},
            {"id": "m5-2", "texto": "Analisar ambiente de trabalho"},
            {"id": "m5-3", "texto": "Calçar o veículo"},
            {"id": "m5-4", "texto": "Isolar a área de trabalho"},
            {"id": "m5-5", "texto": "Sinalizar e delimitar a área de trabalho"}
          ]
        },
        {
          "id": "p-5-8",
          "texto": "Observações - Risco Colisão/Cargas",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 8,
          "grupo_id": "sec-05"
        }
      ]
    },
    {
      "id": "sec-06",
      "nome": "06. RISCOS ERGONÔMICOS/TRAUMAS",
      "descricao": "Riscos ergonômicos e de traumas",
      "ordem": 6,
      "perguntas": [
        {
          "id": "p-6-1",
          "texto": "Condições de iluminação ruins",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-2",
          "texto": "Corte, pancada, machucado, lesão leve e fratura",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-3",
          "texto": "Lesão muscular / Articulação (ombro, lombar, pescoço)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-4",
          "texto": "Levantamento e transporte de peso",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-5",
          "texto": "Ventilação inadequada",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-6",
          "texto": "Medidas Adotadas - Risco Ergonômico",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 6,
          "grupo_id": "sec-06",
          "opcoes": [
            {"id": "m6-1", "texto": "Manuseio correto e adequado da ferramenta"},
            {"id": "m6-2", "texto": "Utilizar EPIs específicos"}
          ]
        },
        {
          "id": "p-6-7",
          "texto": "Observações - Risco Ergonômico",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 7,
          "grupo_id": "sec-06"
        }
      ]
    },
    {
      "id": "sec-07",
      "nome": "07. RISCOS DE TRABALHO COM LINHA VIVA - MT E AT",
      "descricao": "Riscos específicos de linha viva",
      "ordem": 7,
      "perguntas": [
        {
          "id": "p-7-1",
          "texto": "Intervenção em local indevido",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-07"
        },
        {
          "id": "p-7-2",
          "texto": "Observações - Linha Viva",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 2,
          "grupo_id": "sec-07"
        }
      ]
    },
    {
      "id": "sec-08",
      "nome": "08. DEMAIS RISCOS ENCONTRADOS",
      "descricao": "Outros riscos identificados",
      "ordem": 8,
      "perguntas": [
        {
          "id": "p-8-1",
          "texto": "Ataque de animais, insetos ou animais peçonhentos",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-08"
        },
        {
          "id": "p-8-2",
          "texto": "Condições climáticas adversas (chuva, ventos fortes, etc)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-08"
        },
        {
          "id": "p-8-3",
          "texto": "Ruído excessivo",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-08"
        },
        {
          "id": "p-8-4",
          "texto": "Radiação Solar",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-08"
        },
        {
          "id": "p-8-5",
          "texto": "Medidas Adotadas - Demais Riscos",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-08",
          "opcoes": [
            {"id": "m8-1", "texto": "Realizar check list do veículo"},
            {"id": "m8-2", "texto": "Usar perneiras"},
            {"id": "m8-3", "texto": "Usar protetor auricular"},
            {"id": "m8-4", "texto": "Usar vestimenta específica"},
            {"id": "m8-5", "texto": "Protetor Solar"},
            {"id": "m8-6", "texto": "Inspeção Visual"}
          ]
        },
        {
          "id": "p-8-6",
          "texto": "Observações - Demais Riscos",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 6,
          "grupo_id": "sec-08"
        }
      ]
    },
    {
      "id": "sec-09",
      "nome": "09. ANÁLISE GERAL",
      "descricao": "Análise final e decisão sobre execução",
      "ordem": 9,
      "perguntas": [
        {
          "id": "p-9-1",
          "texto": "Após a análise o serviço oferece segurança para ser executado?",
          "tipo": "selecao_unica",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-09",
          "opcoes": [
            {"id": "a9-1", "texto": "Sim"},
            {"id": "a9-2", "texto": "Não, direito de recusa - NR-10 (Justificar)", "exige_observacao": true}
          ]
        },
        {
          "id": "p-9-2",
          "texto": "Justificativa (caso direito de recusa)",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 2,
          "grupo_id": "sec-09"
        },
        {
          "id": "p-9-3",
          "texto": "Equipamentos de proteção utilizados",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-09",
          "opcoes": [
            {"id": "epi-1", "texto": "Aterramento"},
            {"id": "epi-2", "texto": "Botina de Segurança"},
            {"id": "epi-3", "texto": "Capacete de Segurança"},
            {"id": "epi-4", "texto": "Cinturão de segurança"},
            {"id": "epi-5", "texto": "Detector de tensão"},
            {"id": "epi-6", "texto": "Cobertura Isolante"},
            {"id": "epi-7", "texto": "Colete Refletivo"},
            {"id": "epi-8", "texto": "Colete Salva-Vidas"},
            {"id": "epi-9", "texto": "Fardamento Antichama"},
            {"id": "epi-10", "texto": "Luvas de Segurança"},
            {"id": "epi-11", "texto": "Manga de proteção"},
            {"id": "epi-12", "texto": "Óculos de proteção"},
            {"id": "epi-13", "texto": "Protetor Auricular"},
            {"id": "epi-14", "texto": "Protetor Facial"},
            {"id": "epi-15", "texto": "Respirador Descartável"}
          ]
        }
      ]
    },
    {
      "id": "sec-10",
      "nome": "10. ASSINATURAS",
      "descricao": "Assinaturas dos responsáveis",
      "ordem": 10,
      "perguntas": [
        {
          "id": "p-10-1",
          "texto": "Assinatura do Líder",
          "tipo": "assinatura",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-2",
          "texto": "Nome do Líder",
          "tipo": "texto",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-3",
          "texto": "Assinatura do Parceiro",
          "tipo": "assinatura",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-4",
          "texto": "Nome do Parceiro",
          "tipo": "texto",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-5",
          "texto": "Assinatura do Parceiro (2)",
          "tipo": "assinatura",
          "obrigatoria": false,
          "ordem": 5,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-6",
          "texto": "Nome do Parceiro (2)",
          "tipo": "texto",
          "obrigatoria": false,
          "ordem": 6,
          "grupo_id": "sec-10"
        }
      ]
    },
    {
      "id": "sec-11",
      "nome": "11. EVIDÊNCIAS",
      "descricao": "Fotos e evidências do trabalho",
      "ordem": 11,
      "perguntas": [
        {
          "id": "p-11-1",
          "texto": "Área de trabalho isolada (tirar foto da área isolada)",
          "tipo": "foto",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-11"
        },
        {
          "id": "p-11-2",
          "texto": "EPIs e EPCs utilizados (tirar foto utilizando EPI e EPC)",
          "tipo": "foto",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-11"
        },
        {
          "id": "p-11-3",
          "texto": "Realização do teste de esforço no pontalete",
          "tipo": "selecao_unica",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-11",
          "opcoes": [
            {"id": "te-1", "texto": "(C) Conforme"},
            {"id": "te-2", "texto": "(NA) Não Aplicável"}
          ]
        }
      ]
    }
  ]'::jsonb
);

-- Verificar se foi criado
SELECT id, nome, tipo, ativo, 
       jsonb_array_length(grupos) as total_secoes
FROM public.checklists 
WHERE tipo = 'apr' 
ORDER BY created_at DESC 
LIMIT 1;


-- Execute este SQL no Supabase SQL Editor

-- Primeiro, deletar APR existente se houver (opcional - comente se quiser manter)
-- DELETE FROM public.checklists WHERE tipo = 'apr';

-- Inserir APR completa
INSERT INTO public.checklists (nome, descricao, tipo, versao, ativo, exige_localizacao, exige_assinatura, grupos) VALUES (
  'APR - Análise Preliminar de Riscos',
  'Checklist completo de análise preliminar de riscos para trabalhos em campo',
  'apr',
  '1.0',
  true,
  true,
  true,
  '[
    {
      "id": "sec-01",
      "nome": "01. AMBIENTE DE TRABALHO ANALISADO",
      "descricao": "Registro fotográfico do ambiente de trabalho",
      "ordem": 1,
      "perguntas": [
        {
          "id": "p-1-1",
          "texto": "Foto do ambiente de trabalho (foto geral do local)",
          "tipo": "foto",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-01"
        }
      ]
    },
    {
      "id": "sec-02",
      "nome": "02. RISCO ELÉTRICO",
      "descricao": "Identificação de riscos elétricos no ambiente",
      "ordem": 2,
      "perguntas": [
        {
          "id": "p-2-1",
          "texto": "Arco elétrico (operação de chaves grupo A)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-2",
          "texto": "Contato acidental com barramento/cabo energizados",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-3",
          "texto": "Curto Circuito (fase-terra / fase-fase)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-4",
          "texto": "Explosão de equipamentos",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-5",
          "texto": "Intervenção na rede por terceiros (geração)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-6",
          "texto": "Presença de tensão elétrica indevida",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 6,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-7",
          "texto": "Tensão de passo (subestação)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 7,
          "grupo_id": "sec-02"
        },
        {
          "id": "p-2-8",
          "texto": "Medidas Adotadas - Risco Elétrico",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 8,
          "grupo_id": "sec-02",
          "opcoes": [
            {"id": "m2-1", "texto": "Sinalizar e delimitar a área de trabalho"},
            {"id": "m2-2", "texto": "Abrir com corte visível"},
            {"id": "m2-3", "texto": "Limitar mec - Instalar placa de sinalização"},
            {"id": "m2-4", "texto": "Verificar ausência de tensão"},
            {"id": "m2-5", "texto": "Aterrar (lado fonte - lado carga)"},
            {"id": "m2-6", "texto": "Manter distância de segurança"},
            {"id": "m2-7", "texto": "Proteger os pontos vivos"},
            {"id": "m2-8", "texto": "Utilização do loadbuster (manobra)"},
            {"id": "m2-9", "texto": "Utilizar EPCs específicos"},
            {"id": "m2-10", "texto": "Utilizar EPIs específicos"},
            {"id": "m2-11", "texto": "Utilizar placa de sinalização"},
            {"id": "m2-12", "texto": "Corte visível do circuito elétrico (DSV)"}
          ]
        },
        {
          "id": "p-2-9",
          "texto": "Observações - Risco Elétrico",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 9,
          "grupo_id": "sec-02"
        }
      ]
    },
    {
      "id": "sec-03",
      "nome": "03. RISCO DE QUEDAS",
      "descricao": "Identificação de riscos de queda",
      "ordem": 3,
      "perguntas": [
        {
          "id": "p-3-1",
          "texto": "Difícil posicionamento da escada / em má condição",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-2",
          "texto": "Estrutura (poste auxiliar, pontalete, etc) em condições precárias",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-3",
          "texto": "Queda com diferença de nível",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-4",
          "texto": "Queda de material/ferramenta",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-5",
          "texto": "Queda no mesmo nível",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-6",
          "texto": "Tombamento de cesto (ligações garnets)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 6,
          "grupo_id": "sec-03"
        },
        {
          "id": "p-3-7",
          "texto": "Engastamento/Implantação inadequada do poste",
          "tipo": "selecao_unica",
          "obrigatoria": true,
          "ordem": 7,
          "grupo_id": "sec-03",
          "opcoes": [
            {"id": "e3-1", "texto": "Não"},
            {"id": "e3-2", "texto": "Sim"},
            {"id": "e3-3", "texto": "Não se aplica"}
          ]
        },
        {
          "id": "p-3-8",
          "texto": "Medidas Adotadas - Risco de Quedas",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 8,
          "grupo_id": "sec-03",
          "opcoes": [
            {"id": "m3-1", "texto": "Amarrar escada (topo e centro)"},
            {"id": "m3-2", "texto": "Analisar integridade de estrutura"},
            {"id": "m3-3", "texto": "Apoiar no solo a sapata da escada"},
            {"id": "m3-4", "texto": "Utilização da bolsa para içar materiais"},
            {"id": "m3-5", "texto": "Utilização da corda de serviço"},
            {"id": "m3-6", "texto": "Utilização da linha da vida"},
            {"id": "m3-7", "texto": "Utilizar EPIs específicos"},
            {"id": "m3-8", "texto": "Utilizar apoios de sapata adequados"},
            {"id": "m3-9", "texto": "Verificar capacidade do sky/veículo"},
            {"id": "m3-10", "texto": "Verificar marcação de limite de engaste"}
          ]
        },
        {
          "id": "p-3-9",
          "texto": "Observações - Risco de Quedas",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 9,
          "grupo_id": "sec-03"
        }
      ]
    },
    {
      "id": "sec-04",
      "nome": "04. RISCOS RELACIONADOS A FERRAMENTAS DE TRABALHO",
      "descricao": "Identificação de riscos com ferramentas",
      "ordem": 4,
      "perguntas": [
        {
          "id": "p-4-1",
          "texto": "Ausência de ferramentas (está faltando alguma ferramenta para execução da atividade)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-04"
        },
        {
          "id": "p-4-2",
          "texto": "Ferramenta em má condição de uso",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-04"
        },
        {
          "id": "p-4-3",
          "texto": "Ferramenta Inadequada",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-04"
        },
        {
          "id": "p-4-4",
          "texto": "Medidas Adotadas - Risco Ferramental",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-04",
          "opcoes": [
            {"id": "m4-1", "texto": "Verificar tipo/dimensionamento adequado"},
            {"id": "m4-2", "texto": "Manuseio correto e adequado da ferramenta"},
            {"id": "m4-3", "texto": "Realizar check-list antes de sair"},
            {"id": "m4-4", "texto": "Verificar / testar ferramentas"}
          ]
        },
        {
          "id": "p-4-5",
          "texto": "Observações - Risco Ferramental",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 5,
          "grupo_id": "sec-04"
        }
      ]
    },
    {
      "id": "sec-05",
      "nome": "05. RISCOS DE DESLOCAMENTO DE VEÍCULOS, MOVIMENTAÇÃO DE CARGAS E PEDESTRES",
      "descricao": "Riscos relacionados a veículos e pedestres",
      "ordem": 5,
      "perguntas": [
        {
          "id": "p-5-1",
          "texto": "Área de tráfego de pedestres (tráfego intenso ou leve)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-2",
          "texto": "Área de tráfego de veículos (pista rápida, pista lenta, etc)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-3",
          "texto": "Deslocamento acidental do veículo",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-4",
          "texto": "Local sem área para estacionar veículo",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-5",
          "texto": "Veículo em condições inadequadas",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-6",
          "texto": "Exposição de pedestres/transeuntes",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 6,
          "grupo_id": "sec-05"
        },
        {
          "id": "p-5-7",
          "texto": "Medidas Adotadas - Risco Colisão/Cargas",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 7,
          "grupo_id": "sec-05",
          "opcoes": [
            {"id": "m5-1", "texto": "Acionar freio de mão do veículo"},
            {"id": "m5-2", "texto": "Analisar ambiente de trabalho"},
            {"id": "m5-3", "texto": "Calçar o veículo"},
            {"id": "m5-4", "texto": "Isolar a área de trabalho"},
            {"id": "m5-5", "texto": "Sinalizar e delimitar a área de trabalho"}
          ]
        },
        {
          "id": "p-5-8",
          "texto": "Observações - Risco Colisão/Cargas",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 8,
          "grupo_id": "sec-05"
        }
      ]
    },
    {
      "id": "sec-06",
      "nome": "06. RISCOS ERGONÔMICOS/TRAUMAS",
      "descricao": "Riscos ergonômicos e de traumas",
      "ordem": 6,
      "perguntas": [
        {
          "id": "p-6-1",
          "texto": "Condições de iluminação ruins",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-2",
          "texto": "Corte, pancada, machucado, lesão leve e fratura",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-3",
          "texto": "Lesão muscular / Articulação (ombro, lombar, pescoço)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-4",
          "texto": "Levantamento e transporte de peso",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-5",
          "texto": "Ventilação inadequada",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-06"
        },
        {
          "id": "p-6-6",
          "texto": "Medidas Adotadas - Risco Ergonômico",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 6,
          "grupo_id": "sec-06",
          "opcoes": [
            {"id": "m6-1", "texto": "Manuseio correto e adequado da ferramenta"},
            {"id": "m6-2", "texto": "Utilizar EPIs específicos"}
          ]
        },
        {
          "id": "p-6-7",
          "texto": "Observações - Risco Ergonômico",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 7,
          "grupo_id": "sec-06"
        }
      ]
    },
    {
      "id": "sec-07",
      "nome": "07. RISCOS DE TRABALHO COM LINHA VIVA - MT E AT",
      "descricao": "Riscos específicos de linha viva",
      "ordem": 7,
      "perguntas": [
        {
          "id": "p-7-1",
          "texto": "Intervenção em local indevido",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-07"
        },
        {
          "id": "p-7-2",
          "texto": "Observações - Linha Viva",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 2,
          "grupo_id": "sec-07"
        }
      ]
    },
    {
      "id": "sec-08",
      "nome": "08. DEMAIS RISCOS ENCONTRADOS",
      "descricao": "Outros riscos identificados",
      "ordem": 8,
      "perguntas": [
        {
          "id": "p-8-1",
          "texto": "Ataque de animais, insetos ou animais peçonhentos",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-08"
        },
        {
          "id": "p-8-2",
          "texto": "Condições climáticas adversas (chuva, ventos fortes, etc)",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-08"
        },
        {
          "id": "p-8-3",
          "texto": "Ruído excessivo",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-08"
        },
        {
          "id": "p-8-4",
          "texto": "Radiação Solar",
          "tipo": "sim_nao",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-08"
        },
        {
          "id": "p-8-5",
          "texto": "Medidas Adotadas - Demais Riscos",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 5,
          "grupo_id": "sec-08",
          "opcoes": [
            {"id": "m8-1", "texto": "Realizar check list do veículo"},
            {"id": "m8-2", "texto": "Usar perneiras"},
            {"id": "m8-3", "texto": "Usar protetor auricular"},
            {"id": "m8-4", "texto": "Usar vestimenta específica"},
            {"id": "m8-5", "texto": "Protetor Solar"},
            {"id": "m8-6", "texto": "Inspeção Visual"}
          ]
        },
        {
          "id": "p-8-6",
          "texto": "Observações - Demais Riscos",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 6,
          "grupo_id": "sec-08"
        }
      ]
    },
    {
      "id": "sec-09",
      "nome": "09. ANÁLISE GERAL",
      "descricao": "Análise final e decisão sobre execução",
      "ordem": 9,
      "perguntas": [
        {
          "id": "p-9-1",
          "texto": "Após a análise o serviço oferece segurança para ser executado?",
          "tipo": "selecao_unica",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-09",
          "opcoes": [
            {"id": "a9-1", "texto": "Sim"},
            {"id": "a9-2", "texto": "Não, direito de recusa - NR-10 (Justificar)", "exige_observacao": true}
          ]
        },
        {
          "id": "p-9-2",
          "texto": "Justificativa (caso direito de recusa)",
          "tipo": "texto_longo",
          "obrigatoria": false,
          "ordem": 2,
          "grupo_id": "sec-09"
        },
        {
          "id": "p-9-3",
          "texto": "Equipamentos de proteção utilizados",
          "tipo": "multipla_escolha",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-09",
          "opcoes": [
            {"id": "epi-1", "texto": "Aterramento"},
            {"id": "epi-2", "texto": "Botina de Segurança"},
            {"id": "epi-3", "texto": "Capacete de Segurança"},
            {"id": "epi-4", "texto": "Cinturão de segurança"},
            {"id": "epi-5", "texto": "Detector de tensão"},
            {"id": "epi-6", "texto": "Cobertura Isolante"},
            {"id": "epi-7", "texto": "Colete Refletivo"},
            {"id": "epi-8", "texto": "Colete Salva-Vidas"},
            {"id": "epi-9", "texto": "Fardamento Antichama"},
            {"id": "epi-10", "texto": "Luvas de Segurança"},
            {"id": "epi-11", "texto": "Manga de proteção"},
            {"id": "epi-12", "texto": "Óculos de proteção"},
            {"id": "epi-13", "texto": "Protetor Auricular"},
            {"id": "epi-14", "texto": "Protetor Facial"},
            {"id": "epi-15", "texto": "Respirador Descartável"}
          ]
        }
      ]
    },
    {
      "id": "sec-10",
      "nome": "10. ASSINATURAS",
      "descricao": "Assinaturas dos responsáveis",
      "ordem": 10,
      "perguntas": [
        {
          "id": "p-10-1",
          "texto": "Assinatura do Líder",
          "tipo": "assinatura",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-2",
          "texto": "Nome do Líder",
          "tipo": "texto",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-3",
          "texto": "Assinatura do Parceiro",
          "tipo": "assinatura",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-4",
          "texto": "Nome do Parceiro",
          "tipo": "texto",
          "obrigatoria": true,
          "ordem": 4,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-5",
          "texto": "Assinatura do Parceiro (2)",
          "tipo": "assinatura",
          "obrigatoria": false,
          "ordem": 5,
          "grupo_id": "sec-10"
        },
        {
          "id": "p-10-6",
          "texto": "Nome do Parceiro (2)",
          "tipo": "texto",
          "obrigatoria": false,
          "ordem": 6,
          "grupo_id": "sec-10"
        }
      ]
    },
    {
      "id": "sec-11",
      "nome": "11. EVIDÊNCIAS",
      "descricao": "Fotos e evidências do trabalho",
      "ordem": 11,
      "perguntas": [
        {
          "id": "p-11-1",
          "texto": "Área de trabalho isolada (tirar foto da área isolada)",
          "tipo": "foto",
          "obrigatoria": true,
          "ordem": 1,
          "grupo_id": "sec-11"
        },
        {
          "id": "p-11-2",
          "texto": "EPIs e EPCs utilizados (tirar foto utilizando EPI e EPC)",
          "tipo": "foto",
          "obrigatoria": true,
          "ordem": 2,
          "grupo_id": "sec-11"
        },
        {
          "id": "p-11-3",
          "texto": "Realização do teste de esforço no pontalete",
          "tipo": "selecao_unica",
          "obrigatoria": true,
          "ordem": 3,
          "grupo_id": "sec-11",
          "opcoes": [
            {"id": "te-1", "texto": "(C) Conforme"},
            {"id": "te-2", "texto": "(NA) Não Aplicável"}
          ]
        }
      ]
    }
  ]'::jsonb
);

-- Verificar se foi criado
SELECT id, nome, tipo, ativo, 
       jsonb_array_length(grupos) as total_secoes
FROM public.checklists 
WHERE tipo = 'apr' 
ORDER BY created_at DESC 
LIMIT 1;








