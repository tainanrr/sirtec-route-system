-- CORREÇÃO: View de equipes com turno aberto
-- Problema: CURRENT_DATE usa UTC, não timezone do Brasil
-- Solução: Usar timezone 'America/Sao_Paulo' ou remover filtro de data

-- Opção 1: Usar timezone do Brasil
CREATE OR REPLACE VIEW public.vw_equipes_turno_aberto AS
SELECT 
  t.id AS turno_id,
  t.equipe_id,
  t.data_turno,
  t.hora_inicio,
  t.placa_veiculo,
  t.km_inicial,
  t.status AS turno_status,
  
  -- Dados da equipe
  eq.codigo AS equipe_codigo,
  eq.nome AS equipe_nome,
  eq.status AS equipe_status,
  
  -- Última posição conhecida
  pos.latitude AS ultima_latitude,
  pos.longitude AS ultima_longitude,
  pos.recorded_at AS ultima_posicao_at,
  pos.accuracy_m,
  pos.speed_mps,
  pos.battery_pct,
  pos.gps_ativo,
  
  -- Último evento do turno
  (
    SELECT tipo_evento 
    FROM public.turno_eventos te 
    WHERE te.turno_id = t.id 
    ORDER BY data_hora DESC 
    LIMIT 1
  ) AS ultimo_evento_tipo,
  (
    SELECT data_hora 
    FROM public.turno_eventos te 
    WHERE te.turno_id = t.id 
    ORDER BY data_hora DESC 
    LIMIT 1
  ) AS ultimo_evento_at,
  
  -- Colaboradores do turno (agregado como JSON)
  (
    SELECT json_agg(json_build_object(
      'id', c.id,
      'nome', c.nome,
      'funcao', tc.funcao_turno
    ))
    FROM public.turno_colaboradores tc
    JOIN public.colaboradores c ON c.id = tc.colaborador_id
    WHERE tc.turno_id = t.id
  ) AS colaboradores,
  
  -- OS atual (se houver em andamento)
  (
    SELECT json_build_object(
      'id', os.id,
      'numero', os.numero,
      'tipo', os.tipo,
      'status', os.status,
      'endereco', os.endereco
    )
    FROM public.ordens_servico os
    WHERE os.tecnico_id = t.equipe_id
      AND os.status IN ('em_deslocamento', 'no_local', 'em_execucao', 'em_andamento')
    ORDER BY os.updated_at DESC
    LIMIT 1
  ) AS os_atual
  
FROM public.turnos t
JOIN public.tecnicos eq ON eq.id = t.equipe_id
LEFT JOIN public.vw_tecnicos_posicao_atual pos ON pos.equipe_id = t.equipe_id
WHERE t.status = 'aberto';
-- REMOVIDO: AND t.data_turno = CURRENT_DATE
-- Motivo: Turnos abertos são sempre relevantes, independente da data

-- Verificar quantos turnos abertos existem agora
SELECT 
  t.id,
  t.data_turno,
  t.status,
  eq.codigo,
  eq.nome
FROM turnos t
JOIN tecnicos eq ON eq.id = t.equipe_id
WHERE t.status = 'aberto';

-- Verificar a view após correção
SELECT * FROM vw_equipes_turno_aberto;
