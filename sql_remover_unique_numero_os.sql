-- ============================================================================
-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- Objetivo: Permitir números de OS duplicados e adicionar código único
-- ============================================================================

-- PASSO 1: Remover constraint UNIQUE do campo numero
-- (pode dar erro se não existir, ignore)
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_numero_key;

-- PASSO 2: Remover índice único do numero se existir
DROP INDEX IF EXISTS ordens_servico_numero_key;

-- PASSO 3: Adicionar campo codigo se não existir
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS codigo TEXT;

-- PASSO 4: Criar função para gerar código único
CREATE OR REPLACE FUNCTION generate_os_codigo()
RETURNS TEXT AS $$
DECLARE
    ano TEXT;
    sequencial INTEGER;
    novo_codigo TEXT;
BEGIN
    ano := to_char(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN codigo ~ ('^OS-' || ano || '-[0-9]+$') 
            THEN CAST(SUBSTRING(codigo FROM 'OS-' || ano || '-([0-9]+)$') AS INTEGER)
            ELSE 0 
        END
    ), 0) + 1 INTO sequencial
    FROM public.ordens_servico
    WHERE codigo LIKE 'OS-' || ano || '-%';
    
    novo_codigo := 'OS-' || ano || '-' || LPAD(sequencial::TEXT, 6, '0');
    
    RETURN novo_codigo;
END;
$$ LANGUAGE plpgsql;

-- PASSO 5: Criar trigger para gerar código automaticamente
CREATE OR REPLACE FUNCTION set_os_codigo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
        NEW.codigo := generate_os_codigo();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_os_codigo ON public.ordens_servico;
CREATE TRIGGER trigger_set_os_codigo
    BEFORE INSERT ON public.ordens_servico
    FOR EACH ROW
    EXECUTE FUNCTION set_os_codigo();

-- PASSO 6: Gerar códigos para OSs existentes
WITH ranked AS (
    SELECT id, created_at,
           ROW_NUMBER() OVER (PARTITION BY to_char(created_at, 'YYYY') ORDER BY created_at) as rn,
           to_char(created_at, 'YYYY') as ano
    FROM public.ordens_servico
    WHERE codigo IS NULL OR codigo = ''
)
UPDATE public.ordens_servico os
SET codigo = 'OS-' || r.ano || '-' || LPAD(r.rn::TEXT, 6, '0')
FROM ranked r
WHERE os.id = r.id;

-- PASSO 7: Criar constraint UNIQUE no codigo (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ordens_servico_codigo_key'
    ) THEN
        ALTER TABLE public.ordens_servico 
        ADD CONSTRAINT ordens_servico_codigo_key UNIQUE (codigo);
    END IF;
END $$;

-- PASSO 8: Criar índice no numero (não único) para buscas
CREATE INDEX IF NOT EXISTS idx_ordens_servico_numero ON public.ordens_servico(numero);

-- VERIFICAR: Listar OSs com seus códigos
SELECT codigo, numero, status, created_at 
FROM public.ordens_servico 
ORDER BY created_at DESC 
LIMIT 10;
