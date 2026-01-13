-- =====================================================
-- Adicionar coluna 'permite_durante_execucao' na tabela tipos_intervalo
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Adicionar coluna permite_durante_execucao (booleano, default false)
ALTER TABLE public.tipos_intervalo 
ADD COLUMN IF NOT EXISTS permite_durante_execucao BOOLEAN DEFAULT false;

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.tipos_intervalo.permite_durante_execucao IS 
'Permite iniciar este tipo de intervalo mesmo quando a equipe está com uma OS em execução (ex: chuva que pausa temporariamente a execução)';

-- Atualizar intervalos que tipicamente precisam dessa funcionalidade
-- Chuva/Intempéries - típico exemplo de intervalo durante execução
UPDATE public.tipos_intervalo 
SET permite_durante_execucao = true 
WHERE LOWER(nome) LIKE '%chuva%' 
   OR LOWER(nome) LIKE '%intemp%'
   OR LOWER(codigo) LIKE '%chuva%';

-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tipos_intervalo'
ORDER BY ordinal_position;

-- Verificar dados atualizados
SELECT id, codigo, nome, tipo, permite_durante_execucao, ativo
FROM public.tipos_intervalo
ORDER BY codigo;
