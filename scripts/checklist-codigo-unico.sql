-- Script para adicionar código único sequencial para todos os checklists
-- Este código será usado para rastreabilidade e identificação única

-- Adicionar coluna de código único na tabela checklist_respostas
ALTER TABLE checklist_respostas 
ADD COLUMN IF NOT EXISTS codigo_unico SERIAL;

-- Criar índice único para o código
CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_respostas_codigo_unico 
ON checklist_respostas(codigo_unico);

-- Se já existem registros sem código, o SERIAL vai preencher automaticamente
-- Mas vamos garantir que todos tenham um código sequencial

-- Criar função para gerar próximo código (caso precise resetar ou iniciar de um valor específico)
CREATE OR REPLACE FUNCTION get_next_checklist_codigo()
RETURNS INTEGER AS $$
DECLARE
  next_codigo INTEGER;
BEGIN
  SELECT COALESCE(MAX(codigo_unico), 0) + 1 INTO next_codigo FROM checklist_respostas;
  RETURN next_codigo;
END;
$$ LANGUAGE plpgsql;

-- Comentário na coluna
COMMENT ON COLUMN checklist_respostas.codigo_unico IS 'Código único sequencial para identificação e rastreabilidade do checklist';

-- Verificar se existem registros sem código e atribuir
DO $$
DECLARE
  rec RECORD;
  next_code INTEGER := 1;
BEGIN
  -- Pegar o maior código existente
  SELECT COALESCE(MAX(codigo_unico), 0) INTO next_code FROM checklist_respostas;
  
  -- Se todos já têm código, não precisa fazer nada
  IF NOT EXISTS (SELECT 1 FROM checklist_respostas WHERE codigo_unico IS NULL) THEN
    RAISE NOTICE 'Todos os registros já possuem código único';
    RETURN;
  END IF;
  
  -- Atribuir códigos aos registros que não têm
  FOR rec IN 
    SELECT id FROM checklist_respostas 
    WHERE codigo_unico IS NULL 
    ORDER BY created_at ASC
  LOOP
    next_code := next_code + 1;
    UPDATE checklist_respostas SET codigo_unico = next_code WHERE id = rec.id;
  END LOOP;
  
  RAISE NOTICE 'Códigos únicos atribuídos com sucesso';
END $$;





