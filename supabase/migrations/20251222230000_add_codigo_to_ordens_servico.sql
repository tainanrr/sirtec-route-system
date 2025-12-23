-- ============================================================================
-- Migration: Adicionar código único às Ordens de Serviço
-- ============================================================================
-- O campo 'numero' deixa de ser único pois a mesma OS pode ser reimportada
-- O campo 'codigo' será o identificador único interno do sistema
-- ============================================================================

-- 1. Remover a constraint UNIQUE do campo numero (tentar várias formas)
DO $$ 
BEGIN
    -- Tentar remover constraint pelo nome padrão
    ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_numero_key;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Também remover índice único se existir
DROP INDEX IF EXISTS ordens_servico_numero_key;
DROP INDEX IF EXISTS idx_ordens_servico_numero_unique;

-- 2. Adicionar campo codigo (identificador único interno)
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS codigo TEXT;

-- 3. Criar função para gerar código único de OS
CREATE OR REPLACE FUNCTION generate_os_codigo()
RETURNS TEXT AS $$
DECLARE
    ano TEXT;
    sequencial INTEGER;
    novo_codigo TEXT;
BEGIN
    ano := to_char(CURRENT_DATE, 'YYYY');
    
    -- Buscar o maior sequencial do ano atual
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

-- 4. Criar trigger para gerar código automaticamente
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

-- 5. Gerar códigos para OSs existentes que não têm código
UPDATE public.ordens_servico
SET codigo = 'OS-' || to_char(created_at, 'YYYY') || '-' || LPAD(
    (ROW_NUMBER() OVER (PARTITION BY to_char(created_at, 'YYYY') ORDER BY created_at))::TEXT, 
    6, '0'
)
WHERE codigo IS NULL OR codigo = '';

-- 6. Adicionar constraint UNIQUE ao campo codigo
ALTER TABLE public.ordens_servico 
ADD CONSTRAINT ordens_servico_codigo_key UNIQUE (codigo);

-- 7. Criar índice no campo numero para buscas rápidas (não único)
CREATE INDEX IF NOT EXISTS idx_ordens_servico_numero ON public.ordens_servico(numero);

-- 8. Criar índice no campo status para filtros rápidos
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON public.ordens_servico(status);

-- Comentários
COMMENT ON COLUMN public.ordens_servico.codigo IS 'Código único interno do sistema (ex: OS-2024-000001)';
COMMENT ON COLUMN public.ordens_servico.numero IS 'Número da OS no sistema externo (pode repetir para diferentes períodos)';
