-- =====================================================
-- FERIADOS 2026 - Nacionais, Bahia e Vitória da Conquista
-- Execute após rodar sql_fix_feriados.sql
-- =====================================================

-- Criar Centro de Custo de Vitória da Conquista se não existir
INSERT INTO public.centros_custo (codigo, nome, descricao, ativo)
SELECT 'VTC', 'Vitória da Conquista', 'Centro de Custo de Vitória da Conquista - BA', true
WHERE NOT EXISTS (SELECT 1 FROM public.centros_custo WHERE codigo = 'VTC');

-- =====================================================
-- FERIADOS NACIONAIS 2026
-- =====================================================

-- Limpar feriados nacionais de 2026 antes de inserir (evita duplicatas)
DELETE FROM public.feriados 
WHERE tipo = 'nacional' AND EXTRACT(YEAR FROM data) = 2026;

INSERT INTO public.feriados (data, nome, tipo, nacional, recorrente, ativo)
VALUES 
  ('2026-01-01', 'Confraternização Universal', 'nacional', true, true, true),
  ('2026-04-03', 'Sexta-feira Santa', 'nacional', true, true, true),
  ('2026-04-05', 'Páscoa', 'nacional', true, true, true),
  ('2026-04-21', 'Tiradentes', 'nacional', true, true, true),
  ('2026-05-01', 'Dia do Trabalho', 'nacional', true, true, true),
  ('2026-06-04', 'Corpus Christi', 'nacional', true, true, true),
  ('2026-09-07', 'Independência do Brasil', 'nacional', true, true, true),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional', true, true, true),
  ('2026-11-02', 'Finados', 'nacional', true, true, true),
  ('2026-11-15', 'Proclamação da República', 'nacional', true, true, true),
  ('2026-12-25', 'Natal', 'nacional', true, true, true);

-- =====================================================
-- FERIADOS ESTADUAIS DA BAHIA 2026
-- =====================================================

-- Limpar feriados estaduais BA de 2026
DELETE FROM public.feriados 
WHERE tipo = 'estadual' AND estado = 'BA' AND EXTRACT(YEAR FROM data) = 2026;

INSERT INTO public.feriados (data, nome, tipo, estado, nacional, recorrente, ativo)
VALUES 
  ('2026-07-02', 'Independência da Bahia', 'estadual', 'BA', false, true, true),
  ('2026-02-17', 'Carnaval (Terça)', 'estadual', 'BA', false, true, true),
  ('2026-02-16', 'Carnaval (Segunda)', 'estadual', 'BA', false, true, true),
  ('2026-02-18', 'Quarta-feira de Cinzas (até 12h)', 'ponto_facultativo', 'BA', false, true, true);

-- =====================================================
-- FERIADOS MUNICIPAIS DE VITÓRIA DA CONQUISTA 2026
-- =====================================================

-- Limpar feriados municipais de VTC de 2026
DELETE FROM public.feriados 
WHERE tipo = 'municipal' AND cidade = 'Vitória da Conquista' AND EXTRACT(YEAR FROM data) = 2026;

-- Inserir feriados municipais vinculados ao Centro de Custo
DO $$
DECLARE
  vtc_centro_id UUID;
BEGIN
  SELECT id INTO vtc_centro_id FROM public.centros_custo WHERE codigo = 'VTC' LIMIT 1;
  
  INSERT INTO public.feriados (data, nome, tipo, estado, cidade, centro_custo_id, nacional, recorrente, ativo)
  VALUES 
    ('2026-11-09', 'Aniversário de Vitória da Conquista', 'municipal', 'BA', 'Vitória da Conquista', vtc_centro_id, false, true, true),
    ('2026-06-24', 'São João', 'municipal', 'BA', 'Vitória da Conquista', vtc_centro_id, false, true, true),
    ('2026-06-29', 'São Pedro', 'municipal', 'BA', 'Vitória da Conquista', vtc_centro_id, false, true, true),
    ('2026-10-31', 'Dia do Evangélico', 'municipal', 'BA', 'Vitória da Conquista', vtc_centro_id, false, true, true),
    ('2026-08-15', 'Nossa Senhora das Vitórias (Padroeira)', 'municipal', 'BA', 'Vitória da Conquista', vtc_centro_id, false, true, true);
END $$;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Total de feriados cadastrados:' as info, COUNT(*) as total FROM public.feriados;

SELECT 'Feriados Nacionais 2026:' as info;
SELECT data, nome, tipo FROM public.feriados 
WHERE tipo = 'nacional' AND EXTRACT(YEAR FROM data) = 2026
ORDER BY data;

SELECT 'Feriados Estaduais BA 2026:' as info;
SELECT data, nome, tipo, estado FROM public.feriados 
WHERE tipo IN ('estadual', 'ponto_facultativo') AND estado = 'BA' AND EXTRACT(YEAR FROM data) = 2026
ORDER BY data;

SELECT 'Feriados Municipais VTC 2026:' as info;
SELECT data, nome, tipo, cidade, centro_custo_id FROM public.feriados 
WHERE tipo = 'municipal' AND cidade = 'Vitória da Conquista' AND EXTRACT(YEAR FROM data) = 2026
ORDER BY data;
