-- =============================================
-- SQL COMPLETO PARA CORRIGIR TODOS OS PROBLEMAS
-- Execute este script no Supabase SQL Editor
-- =============================================

-- 1. FERIADOS - Adicionar colunas necessárias
DO $$
BEGIN
    -- Adicionar coluna centro_custo_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feriados' AND column_name = 'centro_custo_id') THEN
        ALTER TABLE feriados ADD COLUMN centro_custo_id UUID REFERENCES centros_custo(id);
    END IF;
    
    -- Adicionar coluna nacional se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feriados' AND column_name = 'nacional') THEN
        ALTER TABLE feriados ADD COLUMN nacional BOOLEAN DEFAULT false;
    END IF;
    
    -- Adicionar coluna recorrente se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feriados' AND column_name = 'recorrente') THEN
        ALTER TABLE feriados ADD COLUMN recorrente BOOLEAN DEFAULT true;
    END IF;
    
    -- Adicionar coluna nome se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feriados' AND column_name = 'nome') THEN
        ALTER TABLE feriados ADD COLUMN nome TEXT;
    END IF;
END $$;

-- Atualizar feriados existentes para terem nomes
UPDATE feriados SET nome = 'Feriado' WHERE nome IS NULL;
UPDATE feriados SET nacional = true WHERE nacional IS NULL AND centro_custo_id IS NULL;

-- 2. METAS - Verificar e ajustar tabela
DO $$
BEGIN
    -- Adicionar coluna meta_valor se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metas' AND column_name = 'meta_valor') THEN
        ALTER TABLE metas ADD COLUMN meta_valor NUMERIC(12,2);
    END IF;
END $$;

-- 3. TECNICOS - Adicionar centro_custo_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tecnicos' AND column_name = 'centro_custo_id') THEN
        ALTER TABLE tecnicos ADD COLUMN centro_custo_id UUID REFERENCES centros_custo(id);
    END IF;
END $$;

-- 4. CENTROS_CUSTO - Corrigir RLS
DO $$
BEGIN
    -- Dropar políticas existentes (ignorar erro se não existir)
    DROP POLICY IF EXISTS "allow_all_centros_custo" ON centros_custo;
    DROP POLICY IF EXISTS "centros_custo_full_access" ON centros_custo;
    DROP POLICY IF EXISTS "Permitir leitura para todos" ON centros_custo;
    DROP POLICY IF EXISTS "Permitir todas operações" ON centros_custo;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Criar política permissiva
CREATE POLICY "centros_custo_acesso_total" ON centros_custo
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Limpar feriados duplicados de 2026
DELETE FROM feriados WHERE EXTRACT(YEAR FROM data) = 2026;

-- 6. Inserir feriados NACIONAIS de 2026
INSERT INTO feriados (data, nome, tipo, nacional, recorrente) VALUES
('2026-01-01', 'Confraternização Universal', 'nacional', true, true),
('2026-02-16', 'Carnaval', 'nacional', true, false),
('2026-02-17', 'Carnaval', 'nacional', true, false),
('2026-04-03', 'Sexta-feira Santa', 'nacional', true, false),
('2026-04-21', 'Tiradentes', 'nacional', true, true),
('2026-05-01', 'Dia do Trabalho', 'nacional', true, true),
('2026-06-04', 'Corpus Christi', 'nacional', true, false),
('2026-09-07', 'Independência do Brasil', 'nacional', true, true),
('2026-10-12', 'Nossa Senhora Aparecida', 'nacional', true, true),
('2026-11-02', 'Finados', 'nacional', true, true),
('2026-11-15', 'Proclamação da República', 'nacional', true, true),
('2026-12-25', 'Natal', 'nacional', true, true);

-- 7. Inserir feriados ESTADUAIS da Bahia
INSERT INTO feriados (data, nome, tipo, nacional, recorrente) VALUES
('2026-07-02', 'Independência da Bahia', 'estadual', false, true);

-- 8. Feriados municipais de Vitória da Conquista
DO $$
DECLARE
    vtc_centro_custo_id UUID;
BEGIN
    SELECT id INTO vtc_centro_custo_id 
    FROM centros_custo 
    WHERE LOWER(nome) LIKE '%vit%ria%conquista%' 
       OR LOWER(nome) LIKE '%vtc%'
    LIMIT 1;
    
    IF vtc_centro_custo_id IS NOT NULL THEN
        INSERT INTO feriados (data, nome, tipo, nacional, recorrente, centro_custo_id) VALUES
        ('2026-11-09', 'Aniversário de Vitória da Conquista', 'municipal', false, true, vtc_centro_custo_id),
        ('2026-08-15', 'Nossa Senhora da Vitória', 'municipal', false, true, vtc_centro_custo_id);
    ELSE
        INSERT INTO feriados (data, nome, tipo, nacional, recorrente) VALUES
        ('2026-11-09', 'Aniversário de Vitória da Conquista', 'municipal', false, true),
        ('2026-08-15', 'Nossa Senhora da Vitória', 'municipal', false, true);
    END IF;
END $$;

-- 9. Verificar resultado
SELECT 'Feriados cadastrados:' as info, COUNT(*) as total FROM feriados WHERE EXTRACT(YEAR FROM data) = 2026;
SELECT id, data, nome, tipo, nacional, centro_custo_id FROM feriados WHERE EXTRACT(YEAR FROM data) = 2026 ORDER BY data;









