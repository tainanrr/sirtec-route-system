-- Adicionar coluna retorno_campo_id na tabela ordens_servico
-- para permitir fazer o relacionamento correto com a tabela retornos_campo

-- 1. Adicionar a coluna se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ordens_servico' 
        AND column_name = 'retorno_campo_id'
    ) THEN
        ALTER TABLE public.ordens_servico 
        ADD COLUMN retorno_campo_id UUID REFERENCES public.retornos_campo(id);
        
        RAISE NOTICE 'Coluna retorno_campo_id adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna retorno_campo_id já existe';
    END IF;
END $$;

-- 2. Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_ordens_servico_retorno_campo_id 
ON public.ordens_servico(retorno_campo_id);

-- 3. Atualizar ordens existentes que têm retorno_campo_codigo mas não têm retorno_campo_id
UPDATE public.ordens_servico os
SET retorno_campo_id = rc.id
FROM public.retornos_campo rc
WHERE os.retorno_campo_codigo = rc.codigo
AND os.retorno_campo_id IS NULL
AND os.retorno_campo_codigo IS NOT NULL;

-- 4. Verificar se existem registros em producao_equipes que podem atualizar as ordens
UPDATE public.ordens_servico os
SET retorno_campo_id = pe.retorno_campo_id
FROM public.producao_equipes pe
WHERE os.id = pe.ordem_servico_id
AND os.retorno_campo_id IS NULL
AND pe.retorno_campo_id IS NOT NULL;

-- 5. Mostrar quantas ordens foram atualizadas
SELECT 
    COUNT(*) FILTER (WHERE retorno_campo_id IS NOT NULL) as com_retorno_campo_id,
    COUNT(*) FILTER (WHERE retorno_campo_codigo IS NOT NULL) as com_retorno_codigo,
    COUNT(*) FILTER (WHERE status = 'concluida') as concluidas,
    COUNT(*) as total
FROM public.ordens_servico;












