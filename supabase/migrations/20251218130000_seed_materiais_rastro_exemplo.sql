-- ============================================================================
-- SEED: Dados de Exemplo para Materiais com Rastro
-- ============================================================================
-- Este script cria dados de exemplo para testar as funcionalidades de
-- rastreamento de materiais serializados e alertas de retenção.
-- ============================================================================

-- 1. Criar materiais com rastro (se não existirem)
INSERT INTO public.materiais (id, codigo, nome, unidade, categoria, estoque_minimo, requer_serial, dias_alerta_retencao, ativo)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'MED-MONO-01', 'Medidor Monofásico Digital', 'UN', 'Medidores', 5, true, 7, true),
  ('a2222222-2222-2222-2222-222222222222', 'MED-TRIF-01', 'Medidor Trifásico Digital', 'UN', 'Medidores', 3, true, 5, true),
  ('a3333333-3333-3333-3333-333333333333', 'TC-100A', 'Transformador de Corrente 100A', 'UN', 'Transformadores', 2, true, 10, true),
  ('a4444444-4444-4444-4444-444444444444', 'DISJUNTOR-100A', 'Disjuntor 100A', 'UN', 'Proteção', 10, true, 14, true)
ON CONFLICT (id) DO UPDATE SET
  dias_alerta_retencao = EXCLUDED.dias_alerta_retencao,
  requer_serial = EXCLUDED.requer_serial;

-- 2. Criar materiais serializados e entregas para a equipe EQ-001
DO $$
DECLARE
  v_equipe_id UUID;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_entrega_id_1 UUID;
  v_entrega_id_2 UUID;
  v_entrega_id_3 UUID;
  v_entrega_id_4 UUID;
  v_entrega_id_5 UUID;
BEGIN
  -- Buscar equipe EQ-001 especificamente
  SELECT id INTO v_equipe_id FROM public.tecnicos WHERE codigo = 'EQ-001' LIMIT 1;
  
  -- Se não encontrar EQ-001, buscar qualquer equipe disponível
  IF v_equipe_id IS NULL THEN
    SELECT id INTO v_equipe_id FROM public.tecnicos WHERE status = 'disponivel' LIMIT 1;
  END IF;
  
  -- Se ainda não encontrar, buscar qualquer equipe
  IF v_equipe_id IS NULL THEN
    SELECT id INTO v_equipe_id FROM public.tecnicos LIMIT 1;
  END IF;
  
  IF v_equipe_id IS NULL THEN
    RAISE NOTICE 'Nenhuma equipe encontrada. Criando equipe EQ-001...';
    INSERT INTO public.tecnicos (id, codigo, nome, status)
    VALUES (gen_random_uuid(), 'EQ-001', 'Equipe Exemplo', 'disponivel')
    RETURNING id INTO v_equipe_id;
  END IF;

  RAISE NOTICE 'Usando equipe: %', v_equipe_id;

  -- 3. Criar materiais serializados com diferentes datas de entrega
  -- Material entregue hoje (0 dias) - Normal
  INSERT INTO public.materiais_serializados (id, material_id, numero_serie, status, localizacao_tipo, localizacao_id, data_entrega_equipe, equipe_atual_id, created_at, updated_at)
  VALUES (
    'b1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'MED2024001',
    'com_equipe',
    'equipe',
    v_equipe_id,
    v_now,
    v_equipe_id,
    v_now,
    v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'com_equipe',
    localizacao_tipo = 'equipe',
    localizacao_id = v_equipe_id,
    data_entrega_equipe = v_now,
    equipe_atual_id = v_equipe_id;

  -- Material entregue há 3 dias - Normal
  INSERT INTO public.materiais_serializados (id, material_id, numero_serie, status, localizacao_tipo, localizacao_id, data_entrega_equipe, equipe_atual_id, created_at, updated_at)
  VALUES (
    'b2222222-2222-2222-2222-222222222222',
    'a1111111-1111-1111-1111-111111111111',
    'MED2024002',
    'com_equipe',
    'equipe',
    v_equipe_id,
    v_now - INTERVAL '3 days',
    v_equipe_id,
    v_now - INTERVAL '3 days',
    v_now - INTERVAL '3 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'com_equipe',
    localizacao_tipo = 'equipe',
    localizacao_id = v_equipe_id,
    data_entrega_equipe = v_now - INTERVAL '3 days',
    equipe_atual_id = v_equipe_id;

  -- Material entregue há 5 dias - Atenção (70% do alerta de 5 dias do trifásico = já em alerta)
  INSERT INTO public.materiais_serializados (id, material_id, numero_serie, status, localizacao_tipo, localizacao_id, data_entrega_equipe, equipe_atual_id, created_at, updated_at)
  VALUES (
    'b3333333-3333-3333-3333-333333333333',
    'a2222222-2222-2222-2222-222222222222',
    'MED2024003',
    'com_equipe',
    'equipe',
    v_equipe_id,
    v_now - INTERVAL '5 days',
    v_equipe_id,
    v_now - INTERVAL '5 days',
    v_now - INTERVAL '5 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'com_equipe',
    localizacao_tipo = 'equipe',
    localizacao_id = v_equipe_id,
    data_entrega_equipe = v_now - INTERVAL '5 days',
    equipe_atual_id = v_equipe_id;

  -- Material entregue há 8 dias - Alerta (passou 7 dias)
  INSERT INTO public.materiais_serializados (id, material_id, numero_serie, status, localizacao_tipo, localizacao_id, data_entrega_equipe, equipe_atual_id, created_at, updated_at)
  VALUES (
    'b4444444-4444-4444-4444-444444444444',
    'a1111111-1111-1111-1111-111111111111',
    'MED2024004',
    'com_equipe',
    'equipe',
    v_equipe_id,
    v_now - INTERVAL '8 days',
    v_equipe_id,
    v_now - INTERVAL '8 days',
    v_now - INTERVAL '8 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'com_equipe',
    localizacao_tipo = 'equipe',
    localizacao_id = v_equipe_id,
    data_entrega_equipe = v_now - INTERVAL '8 days',
    equipe_atual_id = v_equipe_id;

  -- Material entregue há 12 dias - Alerta (passou 10 dias do TC)
  INSERT INTO public.materiais_serializados (id, material_id, numero_serie, status, localizacao_tipo, localizacao_id, data_entrega_equipe, equipe_atual_id, created_at, updated_at)
  VALUES (
    'b5555555-5555-5555-5555-555555555555',
    'a3333333-3333-3333-3333-333333333333',
    'TC2024001',
    'com_equipe',
    'equipe',
    v_equipe_id,
    v_now - INTERVAL '12 days',
    v_equipe_id,
    v_now - INTERVAL '12 days',
    v_now - INTERVAL '12 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'com_equipe',
    localizacao_tipo = 'equipe',
    localizacao_id = v_equipe_id,
    data_entrega_equipe = v_now - INTERVAL '12 days',
    equipe_atual_id = v_equipe_id;

  -- Material entregue há 15 dias - Crítico (2x o alerta de 7 dias)
  INSERT INTO public.materiais_serializados (id, material_id, numero_serie, status, localizacao_tipo, localizacao_id, data_entrega_equipe, equipe_atual_id, created_at, updated_at)
  VALUES (
    'b6666666-6666-6666-6666-666666666666',
    'a1111111-1111-1111-1111-111111111111',
    'MED2024005',
    'com_equipe',
    'equipe',
    v_equipe_id,
    v_now - INTERVAL '15 days',
    v_equipe_id,
    v_now - INTERVAL '15 days',
    v_now - INTERVAL '15 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'com_equipe',
    localizacao_tipo = 'equipe',
    localizacao_id = v_equipe_id,
    data_entrega_equipe = v_now - INTERVAL '15 days',
    equipe_atual_id = v_equipe_id;

  -- Material entregue há 20 dias - Crítico
  INSERT INTO public.materiais_serializados (id, material_id, numero_serie, status, localizacao_tipo, localizacao_id, data_entrega_equipe, equipe_atual_id, created_at, updated_at)
  VALUES (
    'b7777777-7777-7777-7777-777777777777',
    'a2222222-2222-2222-2222-222222222222',
    'MED2024006',
    'com_equipe',
    'equipe',
    v_equipe_id,
    v_now - INTERVAL '20 days',
    v_equipe_id,
    v_now - INTERVAL '20 days',
    v_now - INTERVAL '20 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'com_equipe',
    localizacao_tipo = 'equipe',
    localizacao_id = v_equipe_id,
    data_entrega_equipe = v_now - INTERVAL '20 days',
    equipe_atual_id = v_equipe_id;

  -- Material em estoque central (para comparação)
  INSERT INTO public.materiais_serializados (id, material_id, numero_serie, status, localizacao_tipo, localizacao_id, created_at, updated_at)
  VALUES (
    'b8888888-8888-8888-8888-888888888888',
    'a4444444-4444-4444-4444-444444444444',
    'DISJ2024001',
    'em_estoque',
    'central',
    NULL,
    v_now,
    v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'em_estoque',
    localizacao_tipo = 'central';

  RAISE NOTICE 'Materiais serializados criados com sucesso!';

  -- 4. Criar entregas de exemplo (para o app mostrar os materiais)
  -- Entrega confirmada há 15 dias
  INSERT INTO public.materiais_entregas (id, equipe_id, data_entrega, status, data_confirmacao, observacao)
  VALUES (
    'c1111111-1111-1111-1111-111111111111',
    v_equipe_id,
    v_now - INTERVAL '15 days',
    'confirmado',
    v_now - INTERVAL '15 days',
    'Entrega de medidores - Exemplo'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'confirmado',
    data_confirmacao = v_now - INTERVAL '15 days'
  RETURNING id INTO v_entrega_id_1;

  -- Itens da entrega 1
  INSERT INTO public.materiais_entregas_itens (id, entrega_id, material_id, quantidade, numero_serie)
  VALUES 
    ('d1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 1, 'MED2024005'),
    ('d1111111-1111-1111-1111-222222222222', 'c1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 1, 'MED2024006')
  ON CONFLICT (id) DO NOTHING;

  -- Entrega confirmada há 8 dias
  INSERT INTO public.materiais_entregas (id, equipe_id, data_entrega, status, data_confirmacao, observacao)
  VALUES (
    'c2222222-2222-2222-2222-222222222222',
    v_equipe_id,
    v_now - INTERVAL '8 days',
    'confirmado',
    v_now - INTERVAL '8 days',
    'Entrega de medidores - Exemplo 2'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'confirmado',
    data_confirmacao = v_now - INTERVAL '8 days';

  -- Itens da entrega 2
  INSERT INTO public.materiais_entregas_itens (id, entrega_id, material_id, quantidade, numero_serie)
  VALUES 
    ('d2222222-2222-2222-2222-111111111111', 'c2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 1, 'MED2024004'),
    ('d2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 1, 'TC2024001')
  ON CONFLICT (id) DO NOTHING;

  -- Entrega confirmada há 5 dias
  INSERT INTO public.materiais_entregas (id, equipe_id, data_entrega, status, data_confirmacao, observacao)
  VALUES (
    'c3333333-3333-3333-3333-333333333333',
    v_equipe_id,
    v_now - INTERVAL '5 days',
    'confirmado',
    v_now - INTERVAL '5 days',
    'Entrega de medidor trifásico'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'confirmado',
    data_confirmacao = v_now - INTERVAL '5 days';

  -- Itens da entrega 3
  INSERT INTO public.materiais_entregas_itens (id, entrega_id, material_id, quantidade, numero_serie)
  VALUES 
    ('d3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', 1, 'MED2024003')
  ON CONFLICT (id) DO NOTHING;

  -- Entrega confirmada há 3 dias
  INSERT INTO public.materiais_entregas (id, equipe_id, data_entrega, status, data_confirmacao, observacao)
  VALUES (
    'c4444444-4444-4444-4444-444444444444',
    v_equipe_id,
    v_now - INTERVAL '3 days',
    'confirmado',
    v_now - INTERVAL '3 days',
    'Entrega recente'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'confirmado',
    data_confirmacao = v_now - INTERVAL '3 days';

  -- Itens da entrega 4
  INSERT INTO public.materiais_entregas_itens (id, entrega_id, material_id, quantidade, numero_serie)
  VALUES 
    ('d4444444-4444-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111', 1, 'MED2024002')
  ON CONFLICT (id) DO NOTHING;

  -- Entrega confirmada hoje
  INSERT INTO public.materiais_entregas (id, equipe_id, data_entrega, status, data_confirmacao, observacao)
  VALUES (
    'c5555555-5555-5555-5555-555555555555',
    v_equipe_id,
    v_now,
    'confirmado',
    v_now,
    'Entrega de hoje'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'confirmado',
    data_confirmacao = v_now;

  -- Itens da entrega 5
  INSERT INTO public.materiais_entregas_itens (id, entrega_id, material_id, quantidade, numero_serie)
  VALUES 
    ('d5555555-5555-5555-5555-555555555555', 'c5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 1, 'MED2024001')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Entregas de exemplo criadas com sucesso!';
END $$;

-- 5. Resumo dos dados criados
SELECT 
  'Materiais com Rastro' as tipo,
  COUNT(*) as quantidade
FROM public.materiais_serializados
WHERE status = 'com_equipe'
UNION ALL
SELECT 
  'Em Alerta (>= dias_alerta)' as tipo,
  COUNT(*) as quantidade
FROM public.materiais_serializados ms
JOIN public.materiais m ON m.id = ms.material_id
WHERE ms.status = 'com_equipe'
  AND ms.data_entrega_equipe IS NOT NULL
  AND EXTRACT(DAY FROM (NOW() - ms.data_entrega_equipe)) >= COALESCE(m.dias_alerta_retencao, 7)
UNION ALL
SELECT 
  'Críticos (>= 2x dias_alerta)' as tipo,
  COUNT(*) as quantidade
FROM public.materiais_serializados ms
JOIN public.materiais m ON m.id = ms.material_id
WHERE ms.status = 'com_equipe'
  AND ms.data_entrega_equipe IS NOT NULL
  AND EXTRACT(DAY FROM (NOW() - ms.data_entrega_equipe)) >= COALESCE(m.dias_alerta_retencao, 7) * 2;
