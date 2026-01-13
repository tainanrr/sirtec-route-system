-- =====================================================
-- Adicionar campo 'contrato_padrao_avulsas' na tabela tecnicos (equipes)
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Adicionar coluna contrato_padrao_avulsas (contrato padrão para OSs avulsas criadas pela equipe)
ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS contrato_padrao_avulsas UUID REFERENCES public.contratos(id) ON DELETE SET NULL;

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.tecnicos.contrato_padrao_avulsas IS 'Contrato padrão utilizado para calcular valores de produção quando a equipe cria uma OS avulsa';

-- Atualizar todas as equipes existentes com o contrato 4600079169
-- Primeiro, buscar o ID do contrato pelo código
DO $$
DECLARE
    contrato_id_valor UUID;
    equipes_atualizadas INTEGER;
BEGIN
    -- Buscar o ID do contrato pelo código
    SELECT id INTO contrato_id_valor
    FROM public.contratos
    WHERE codigo = '4600079169'
    LIMIT 1;
    
    -- Se encontrou o contrato, atualizar todas as equipes (mesmo as que já têm valor)
    IF contrato_id_valor IS NOT NULL THEN
        UPDATE public.tecnicos
        SET contrato_padrao_avulsas = contrato_id_valor;
        
        GET DIAGNOSTICS equipes_atualizadas = ROW_COUNT;
        
        RAISE NOTICE 'Atualizadas % equipe(s) com contrato padrão: % (ID: %)', equipes_atualizadas, '4600079169', contrato_id_valor;
    ELSE
        RAISE WARNING 'Contrato 4600079169 não encontrado. Verifique se o código está correto na tabela contratos.';
    END IF;
END $$;

-- Verificar estrutura da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tecnicos'
  AND column_name = 'contrato_padrao_avulsas';

-- Verificar quantas equipes foram atualizadas
SELECT 
    COUNT(*) as total_equipes,
    COUNT(contrato_padrao_avulsas) as equipes_com_contrato_padrao
FROM public.tecnicos;
