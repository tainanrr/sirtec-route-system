-- ============================================================================
-- CORRIGIR: Função de geração de código para suportar inserções em massa
-- ============================================================================

-- Opção 1: Usar SEQUENCE para garantir unicidade
CREATE SEQUENCE IF NOT EXISTS os_codigo_seq START 1;

-- Atualizar a sequência para o valor máximo atual
DO $$
DECLARE
    max_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN codigo ~ '^OS-[0-9]{4}-[0-9]+$' 
            THEN CAST(SUBSTRING(codigo FROM 'OS-[0-9]{4}-([0-9]+)$') AS INTEGER)
            ELSE 0 
        END
    ), 0) INTO max_seq
    FROM public.ordens_servico;
    
    PERFORM setval('os_codigo_seq', max_seq + 1, false);
END $$;

-- Recriar função usando sequence (muito mais rápido e seguro para inserções paralelas)
CREATE OR REPLACE FUNCTION generate_os_codigo()
RETURNS TEXT AS $$
DECLARE
    ano TEXT;
    seq_val INTEGER;
BEGIN
    ano := to_char(CURRENT_DATE, 'YYYY');
    seq_val := nextval('os_codigo_seq');
    RETURN 'OS-' || ano || '-' || LPAD(seq_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger
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

-- Verificar se há códigos duplicados e corrigir
UPDATE public.ordens_servico
SET codigo = generate_os_codigo()
WHERE codigo IN (
    SELECT codigo FROM public.ordens_servico 
    GROUP BY codigo HAVING COUNT(*) > 1
);

-- Verificar resultado
SELECT codigo, numero, COUNT(*) 
FROM public.ordens_servico 
GROUP BY codigo, numero 
HAVING COUNT(*) > 1;


