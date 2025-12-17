-- Script para adicionar campos de confirmação de recebimento na tabela materiais_entregas
-- e criar o checklist de recebimento de materiais

-- Adicionar campos de confirmação na tabela materiais_entregas
ALTER TABLE materiais_entregas 
ADD COLUMN IF NOT EXISTS foto_recebimento TEXT,
ADD COLUMN IF NOT EXISTS assinatura_recebimento TEXT,
ADD COLUMN IF NOT EXISTS coordenadas_recebimento VARCHAR(100),
ADD COLUMN IF NOT EXISTS data_confirmacao TIMESTAMPTZ;

-- Criar checklist de recebimento de materiais (se não existir)
INSERT INTO checklists (nome, descricao, tipo, ativo, perguntas)
SELECT 
  'Recebimento de Materiais',
  'Checklist para confirmação de recebimento de materiais pela equipe',
  'recebimento_materiais',
  true,
  '[
    {
      "id": "1",
      "texto": "Todos os materiais foram recebidos conforme a lista?",
      "tipo": "sim_nao",
      "obrigatorio": true
    },
    {
      "id": "2",
      "texto": "Os materiais estão em bom estado?",
      "tipo": "sim_nao",
      "obrigatorio": true
    },
    {
      "id": "3",
      "texto": "Foto do recebimento",
      "tipo": "foto",
      "obrigatorio": true
    },
    {
      "id": "4",
      "texto": "Assinatura de confirmação",
      "tipo": "assinatura",
      "obrigatorio": true
    },
    {
      "id": "5",
      "texto": "Observações adicionais",
      "tipo": "texto",
      "obrigatorio": false
    }
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM checklists WHERE tipo = 'recebimento_materiais'
);

-- Atualizar status 'confirmado' se não existir no enum (caso seja enum)
-- Se status for VARCHAR, não precisa fazer nada

COMMENT ON COLUMN materiais_entregas.foto_recebimento IS 'Foto tirada no momento do recebimento (base64)';
COMMENT ON COLUMN materiais_entregas.assinatura_recebimento IS 'Assinatura digital do recebedor (base64)';
COMMENT ON COLUMN materiais_entregas.coordenadas_recebimento IS 'Coordenadas GPS no momento do recebimento';
COMMENT ON COLUMN materiais_entregas.data_confirmacao IS 'Data/hora da confirmação do recebimento';

