-- =====================================================
-- Adicionar coluna 'icone' na tabela tipos_intervalo
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Adicionar coluna icone (nome do ícone do Lucide React)
ALTER TABLE public.tipos_intervalo 
ADD COLUMN IF NOT EXISTS icone VARCHAR(50) NULL;

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.tipos_intervalo.icone IS 'Nome do ícone do Lucide React a ser exibido no aplicativo (ex: Coffee, Wrench, Clock, etc.)';

-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tipos_intervalo'
ORDER BY ordinal_position;
