-- Verificar estrutura atual da tabela feriados
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'feriados'
ORDER BY ordinal_position;







