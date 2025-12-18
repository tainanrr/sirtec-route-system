-- Adicionar campo numero_serie na tabela materiais_entregas_itens
ALTER TABLE materiais_entregas_itens 
ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(100);

-- Comentário
COMMENT ON COLUMN materiais_entregas_itens.numero_serie IS 'Número de série/rastro único para materiais do tipo SR';



