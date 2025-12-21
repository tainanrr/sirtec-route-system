-- Seed para testar a Torre de Controle (HOJE)
-- O que este script cria:
-- - Técnicos/equipes (se não existirem)
-- - Ordens de serviço (OS) com coordenadas
-- - Planejamento para CURRENT_DATE
-- - Planejamento_ordens (rotas por equipe, com horários)
-- - Logs (planejamento_logs) com timestamps distribuídos
-- - Telemetria (tecnicos_posicoes) com trilha executada
-- - Alertas manuais no banco (para demonstrar tratativas)
--
-- Como usar:
-- 1) Abra o SQL Editor do Supabase e rode este arquivo.
-- 2) Abra a Torre de Controle e selecione "Hoje".
--
-- Obs: o script é idempotente por dia (usa numero de OS com sufixo YYYYMMDD).

BEGIN;

-- Limpeza segura (somente seeds deste arquivo)
DELETE FROM public.alertas
WHERE created_at::date = current_date
  AND titulo LIKE 'Seed:%';

DELETE FROM public.planejamento_logs
WHERE created_at::date = current_date
  AND (descricao LIKE 'Evento seed:%');

-- 0) Garantir equipes mínimas
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.tecnicos;
  IF v_count = 0 THEN
    INSERT INTO public.tecnicos (codigo, nome, telefone, status, latitude, longitude, color)
    VALUES
      ('EQ-001', 'Equipe 01 - João', '77999990001', 'disponivel', -14.8661, -40.8394, '#2563eb'),
      ('EQ-002', 'Equipe 02 - Maria', '77999990002', 'disponivel', -14.8720, -40.8450, '#16a34a'),
      ('EQ-003', 'Equipe 03 - Pedro', '77999990003', 'disponivel', -14.8590, -40.8320, '#f59e0b'),
      ('EQ-004', 'Equipe 04 - Carlos', '77999990004', 'disponivel', -14.8800, -40.8500, '#7c3aed');
  END IF;
END $$;

-- 1) Selecionar equipes (4 primeiras por código)
WITH equipes AS (
  SELECT
    id,
    codigo,
    nome,
    (row_number() OVER (ORDER BY codigo) - 1) AS idx
  FROM public.tecnicos
  ORDER BY codigo
  LIMIT 4
),
suffix AS (
  SELECT to_char(current_date, 'YYYYMMDD') AS s
),
os_src AS (
  -- 16 OSs espalhadas (Vitória da Conquista - aproximado)
  SELECT
    -- números únicos por dia
    format('OS-%s-%03s', (SELECT s FROM suffix), i) AS numero,
    (ARRAY['RELIGA','CORTE','INSPECAO','LIGACAO','MANUTENCAO','TROCA_MEDIDOR'])[1 + (i % 6)] AS tipo,
    format('Rua %s, %s - VDC', (ARRAY['Brasil','Siqueira Campos','Crescêncio Silveira','Serrinha','Rosa Cruz','Olívia Flores'])[1 + (i % 6)], 100 + i) AS endereco,
    format('Cliente %s', i) AS cliente_nome,
    -- espalhar coords em torno do centro
    (-14.8661 + ((i % 8) - 4) * 0.004) AS lat,
    (-40.8394 + ((i % 7) - 3) * 0.0045) AS lng,
    CASE WHEN i IN (2, 7, 11) THEN true ELSE false END AS regulada
  FROM generate_series(1, 16) AS g(i)
),
upsert_os AS (
  INSERT INTO public.ordens_servico (numero, tipo, status, endereco, cliente_nome, latitude, longitude, regulada, prazo, valor)
  SELECT
    numero,
    lower(tipo),
    'planejada',
    endereco,
    cliente_nome,
    lat,
    lng,
    regulada,
    -- prazo = hoje 18:00 + offset
    (date_trunc('day', now()) + interval '18 hours' + (random() * interval '60 minutes')) AS prazo,
    (CASE WHEN regulada THEN 120 ELSE 60 END) AS valor
  FROM os_src
  ON CONFLICT (numero) DO UPDATE SET
    tipo = EXCLUDED.tipo,
    endereco = EXCLUDED.endereco,
    cliente_nome = EXCLUDED.cliente_nome,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    regulada = EXCLUDED.regulada,
    prazo = EXCLUDED.prazo,
    valor = EXCLUDED.valor
  RETURNING id, numero
),
os_ids AS (
  SELECT id, numero
  FROM upsert_os
),
plan_id AS (
  -- cria o planejamento do dia apenas se não existir
  INSERT INTO public.planejamentos (data_planejamento, status, total_equipes, total_ordens, observacoes)
  SELECT current_date, 'aberto', 0, 0, 'Seed Torre de Controle (HOJE)'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.planejamentos WHERE data_planejamento = current_date
  )
  RETURNING id
),
plan_pick AS (
  -- IMPORTANTE:
  -- Referenciar plan_id aqui garante que a inserção acima execute quando necessário.
  SELECT COALESCE(
    (SELECT id FROM plan_id LIMIT 1),
    (SELECT id FROM public.planejamentos WHERE data_planejamento = current_date ORDER BY created_at DESC LIMIT 1)
  ) AS id
),
alloc AS (
  -- distribuição de 16 OSs em 4 equipes (4 por equipe)
  SELECT
    (SELECT id FROM plan_pick) AS planejamento_id,
    e.id AS equipe_id,
    e.codigo AS equipe_codigo,
    o.id AS ordem_servico_id,
    row_number() OVER (PARTITION BY e.id ORDER BY o.numero) AS ordem_na_rota,
    -- horários base (08:00) com slots de 40 min
    (time '08:00' + (row_number() OVER (PARTITION BY e.id ORDER BY o.numero) - 1) * interval '40 minutes') AS hora_inicio_estimada,
    (time '08:35' + (row_number() OVER (PARTITION BY e.id ORDER BY o.numero) - 1) * interval '40 minutes') AS hora_fim_estimada
  FROM equipes e
  JOIN LATERAL (
    SELECT id, numero
    FROM os_ids
    WHERE (substring(numero from '([0-9]+)$'))::int % 4 = e.idx
    ORDER BY numero
    LIMIT 4
  ) o ON true
),
upsert_po AS (
  INSERT INTO public.planejamento_ordens (
    planejamento_id,
    ordem_servico_id,
    equipe_id,
    ordem_na_rota,
    distancia_km,
    tempo_estimado_minutos,
    hora_inicio_estimada,
    hora_fim_estimada
  )
  SELECT
    planejamento_id,
    ordem_servico_id,
    equipe_id,
    ordem_na_rota,
    (2 + random() * 6)::numeric(10,2) AS distancia_km,
    (25 + (random() * 25))::int AS tempo_estimado_minutos,
    hora_inicio_estimada,
    hora_fim_estimada
  FROM alloc
  ON CONFLICT (planejamento_id, ordem_servico_id) DO UPDATE SET
    equipe_id = EXCLUDED.equipe_id,
    ordem_na_rota = EXCLUDED.ordem_na_rota,
    distancia_km = EXCLUDED.distancia_km,
    tempo_estimado_minutos = EXCLUDED.tempo_estimado_minutos,
    hora_inicio_estimada = EXCLUDED.hora_inicio_estimada,
    hora_fim_estimada = EXCLUDED.hora_fim_estimada
  RETURNING id
)
SELECT 1;

-- 2) Ajustar status das OSs para criar "exceções"
-- Regras:
-- - EQ-001: 2 concluídas, 1 em execução, 1 planejada
-- - EQ-002: 1 concluída, 1 em deslocamento, 2 planejadas (uma atrasada pelo horário previsto)
-- - EQ-003: 1 pausada há 35 min (gera alerta de parada)
-- - EQ-004: 1 cancelada + (offline simulado por alerta manual no banco)

WITH base AS (
  SELECT
    po.equipe_id,
    t.codigo AS equipe_codigo,
    po.ordem_na_rota,
    po.ordem_servico_id,
    os.numero
  FROM public.planejamento_ordens po
  JOIN public.planejamentos p ON p.id = po.planejamento_id
  JOIN public.tecnicos t ON t.id = po.equipe_id
  JOIN public.ordens_servico os ON os.id = po.ordem_servico_id
  WHERE p.data_planejamento = current_date
),
pick AS (
  SELECT * FROM base
)
UPDATE public.ordens_servico os
SET
  status = CASE
    WHEN p.equipe_codigo = 'EQ-001' AND p.ordem_na_rota IN (1,2) THEN 'concluida'
    WHEN p.equipe_codigo = 'EQ-001' AND p.ordem_na_rota = 3 THEN 'em_execucao'
    WHEN p.equipe_codigo = 'EQ-002' AND p.ordem_na_rota = 1 THEN 'concluida'
    WHEN p.equipe_codigo = 'EQ-002' AND p.ordem_na_rota = 2 THEN 'em_deslocamento'
    WHEN p.equipe_codigo = 'EQ-003' AND p.ordem_na_rota = 2 THEN 'pausada'
    WHEN p.equipe_codigo = 'EQ-004' AND p.ordem_na_rota = 1 THEN 'cancelada'
    ELSE 'planejada'
  END,
  concluido_at = CASE
    WHEN (p.equipe_codigo = 'EQ-001' AND p.ordem_na_rota IN (1,2)) OR (p.equipe_codigo = 'EQ-002' AND p.ordem_na_rota = 1)
      THEN (now() - interval '60 minutes')
    ELSE os.concluido_at
  END,
  pausado_at = CASE
    WHEN p.equipe_codigo = 'EQ-003' AND p.ordem_na_rota = 2 THEN (now() - interval '35 minutes')
    ELSE os.pausado_at
  END,
  iniciado_at = CASE
    WHEN p.equipe_codigo = 'EQ-001' AND p.ordem_na_rota = 3 THEN (now() - interval '25 minutes')
    WHEN p.equipe_codigo = 'EQ-002' AND p.ordem_na_rota = 2 THEN (now() - interval '15 minutes')
    ELSE os.iniciado_at
  END
FROM pick p
WHERE os.id = p.ordem_servico_id;

-- 3) Forçar um atraso "visível": ajustar hora_fim_estimada de uma OS da EQ-002 para 2h atrás
WITH alvo AS (
  SELECT po.id
  FROM public.planejamento_ordens po
  JOIN public.planejamentos p ON p.id = po.planejamento_id
  JOIN public.tecnicos t ON t.id = po.equipe_id
  WHERE p.data_planejamento = current_date
    AND t.codigo = 'EQ-002'
    AND po.ordem_na_rota = 3
  LIMIT 1
)
UPDATE public.planejamento_ordens
SET
  hora_fim_estimada = (now() - interval '2 hours')::time,
  hora_inicio_estimada = (now() - interval '2 hours' - interval '35 minutes')::time
WHERE id IN (SELECT id FROM alvo);

-- 4) Logs (timeline) espalhados no dia
WITH plan_id AS (
  SELECT id FROM public.planejamentos WHERE data_planejamento = current_date ORDER BY created_at DESC LIMIT 1
),
os_pick AS (
  SELECT os.id, os.numero
  FROM public.ordens_servico os
  WHERE os.numero LIKE format('OS-%s-%%', to_char(current_date, 'YYYYMMDD'))
  ORDER BY os.numero
  LIMIT 6
)
INSERT INTO public.planejamento_logs (planejamento_id, ordem_servico_id, acao, descricao, created_at)
SELECT
  (SELECT id FROM plan_id),
  o.id,
  'status_update',
  format('Evento seed: %s', o.numero),
  now() - (g.i * interval '12 minutes')
FROM os_pick o
CROSS JOIN generate_series(1, 6) g(i)
ON CONFLICT DO NOTHING;

-- 5) Telemetria (trilha executada) para EQ-001 e EQ-002
DELETE FROM public.tecnicos_posicoes
WHERE recorded_at::date = current_date
  AND equipe_id IN (SELECT id FROM public.tecnicos WHERE codigo IN ('EQ-001','EQ-002'));

WITH eq AS (
  SELECT id, codigo FROM public.tecnicos WHERE codigo IN ('EQ-001','EQ-002')
),
pts AS (
  SELECT
    e.id AS equipe_id,
    (now() - (g.i * interval '6 minutes')) AS recorded_at,
    (-14.8661 + (g.i * 0.001)) AS lat,
    (-40.8394 + (g.i * 0.0012)) AS lng,
    (15 + (g.i % 10))::int AS battery_pct
  FROM eq e
  CROSS JOIN generate_series(1, 18) g(i)
)
INSERT INTO public.tecnicos_posicoes (equipe_id, recorded_at, latitude, longitude, accuracy_m, speed_mps, heading_deg, battery_pct, gps_ativo, app_state)
SELECT
  equipe_id,
  recorded_at,
  lat,
  lng,
  12,
  3.2,
  90,
  battery_pct,
  true,
  'foreground'
FROM pts
;

-- 6) Alertas manuais no banco (para demonstrar tratativas e exceções)
-- (a Torre também gera alertas por engine, mas estes garantem visual imediato)
WITH eq AS (
  SELECT id, codigo FROM public.tecnicos WHERE codigo IN ('EQ-002','EQ-004') ORDER BY codigo
),
plan_os AS (
  SELECT po.ordem_servico_id, t.codigo
  FROM public.planejamento_ordens po
  JOIN public.planejamentos p ON p.id = po.planejamento_id
  JOIN public.tecnicos t ON t.id = po.equipe_id
  WHERE p.data_planejamento = current_date
    AND t.codigo IN ('EQ-002','EQ-003')
  ORDER BY t.codigo, po.ordem_na_rota
)
INSERT INTO public.alertas (tipo, severidade, titulo, descricao, tecnico_id, ordem_servico_id, resolvido, status, created_at)
SELECT
  'manual',
  'high',
  'Seed: Exceção operacional',
  'Alerta manual para testar tratativas (assumir/comentar/silenciar/resolver).',
  (SELECT id FROM eq WHERE codigo='EQ-004' LIMIT 1),
  NULL,
  false,
  'open',
  now() - interval '5 minutes'
UNION ALL
SELECT
  'rota_atrasada',
  'critical',
  'Seed: Rota atrasada (EQ-002)',
  'Rota com OS prevista no passado para simular atraso.',
  (SELECT id FROM eq WHERE codigo='EQ-002' LIMIT 1),
  (SELECT ordem_servico_id FROM plan_os WHERE codigo='EQ-002' LIMIT 1),
  false,
  'open',
  now() - interval '12 minutes'
UNION ALL
SELECT
  'offline',
  'high',
  'Seed: Equipe offline (EQ-004)',
  'Equipe sem atualização (alerta manual para demonstrar fluxo).',
  (SELECT id FROM eq WHERE codigo='EQ-004' LIMIT 1),
  NULL,
  false,
  'open',
  now() - interval '20 minutes'
;

COMMIT;

-- Pronto.
-- Agora abra a Torre de Controle e use:
-- - Centro de Ação > Alertas: testar Reconhecer/Assumir/Silenciar/Comentar/Resolver
-- - Linha do Tempo: ver blocos, eventos e exceções
-- - Mapa: ver rota planejada + trilha executada (EQ-001/EQ-002)

