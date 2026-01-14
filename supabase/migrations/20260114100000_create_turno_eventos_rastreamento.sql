-- =====================================================
-- RASTREAMENTO DE EQUIPES E EVENTOS DE TURNO
-- =====================================================
-- Esta migração cria a estrutura para:
-- 1. Registrar eventos detalhados do turno (início, deslocamentos, execuções, intervalos, etc.)
-- 2. Detectar paradas prolongadas automaticamente
-- 3. Views otimizadas para consulta em tempo real

-- =====================================================
-- 1. TABELA DE EVENTOS DO TURNO
-- =====================================================
-- Registra todos os eventos que acontecem durante um turno
CREATE TABLE IF NOT EXISTS public.turno_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  
  -- Tipo do evento
  tipo_evento VARCHAR(50) NOT NULL,
  -- Tipos possíveis:
  -- 'inicio_turno', 'fim_turno'
  -- 'inicio_deslocamento', 'fim_deslocamento'
  -- 'chegada_local'
  -- 'inicio_apr', 'fim_apr'
  -- 'inicio_servico', 'fim_servico'
  -- 'inicio_intervalo', 'fim_intervalo'
  -- 'parada_detectada', 'movimento_retomado'
  -- 'posicao_atualizada'
  
  -- Dados do evento
  descricao TEXT,
  metadata JSONB DEFAULT '{}', -- Dados adicionais (tipo intervalo, motivo parada, etc.)
  
  -- Localização no momento do evento
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  accuracy_m DECIMAL(10,2),
  
  -- Timestamps
  data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_turno_eventos_turno ON public.turno_eventos(turno_id);
CREATE INDEX IF NOT EXISTS idx_turno_eventos_equipe ON public.turno_eventos(equipe_id);
CREATE INDEX IF NOT EXISTS idx_turno_eventos_os ON public.turno_eventos(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_turno_eventos_tipo ON public.turno_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_turno_eventos_data ON public.turno_eventos(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_turno_eventos_equipe_data ON public.turno_eventos(equipe_id, data_hora DESC);

COMMENT ON TABLE public.turno_eventos IS 'Registro detalhado de eventos durante o turno para rastreamento';

-- =====================================================
-- 2. TABELA DE PARADAS PROLONGADAS (DETECTADAS AUTOMATICAMENTE)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.turno_paradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  
  -- Localização da parada
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  endereco TEXT, -- Endereço reverso (se disponível)
  
  -- Período da parada
  inicio_parada TIMESTAMPTZ NOT NULL,
  fim_parada TIMESTAMPTZ,
  duracao_minutos INTEGER, -- Calculado no fim
  
  -- Classificação
  tipo_parada VARCHAR(50), -- 'justificada', 'injustificada', 'intervalo', 'aguardando_cliente'
  justificativa TEXT,
  
  -- Se vinculada a uma OS
  ordem_servico_id UUID REFERENCES public.ordens_servico(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turno_paradas_turno ON public.turno_paradas(turno_id);
CREATE INDEX IF NOT EXISTS idx_turno_paradas_equipe ON public.turno_paradas(equipe_id);
CREATE INDEX IF NOT EXISTS idx_turno_paradas_periodo ON public.turno_paradas(inicio_parada, fim_parada);

COMMENT ON TABLE public.turno_paradas IS 'Registro de paradas prolongadas detectadas durante o turno';

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================
ALTER TABLE public.turno_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "turno_eventos_all_access" ON public.turno_eventos;
CREATE POLICY "turno_eventos_all_access" ON public.turno_eventos 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.turno_paradas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "turno_paradas_all_access" ON public.turno_paradas;
CREATE POLICY "turno_paradas_all_access" ON public.turno_paradas 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 4. VIEW: EQUIPES COM TURNO ABERTO E ÚLTIMA POSIÇÃO
-- =====================================================
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
-- Nota: Removido filtro de data para evitar problemas de timezone
-- Turnos abertos são sempre relevantes independente da data

COMMENT ON VIEW public.vw_equipes_turno_aberto IS 'Equipes com turno aberto hoje e suas últimas posições';

-- =====================================================
-- 5. VIEW: TRAJETO COMPLETO DO TURNO COM EVENTOS
-- =====================================================
CREATE OR REPLACE VIEW public.vw_turno_trajeto AS
SELECT 
  te.id AS evento_id,
  te.turno_id,
  te.equipe_id,
  te.ordem_servico_id,
  te.tipo_evento,
  te.descricao,
  te.metadata,
  te.latitude,
  te.longitude,
  te.accuracy_m,
  te.data_hora,
  
  -- Dados da OS relacionada (se houver)
  os.numero AS os_numero,
  os.tipo AS os_tipo,
  os.endereco AS os_endereco,
  os.status AS os_status,
  
  -- Dados do turno
  t.data_turno,
  t.placa_veiculo,
  
  -- Dados da equipe
  eq.codigo AS equipe_codigo,
  eq.nome AS equipe_nome

FROM public.turno_eventos te
JOIN public.turnos t ON t.id = te.turno_id
JOIN public.tecnicos eq ON eq.id = te.equipe_id
LEFT JOIN public.ordens_servico os ON os.id = te.ordem_servico_id
ORDER BY te.data_hora ASC;

COMMENT ON VIEW public.vw_turno_trajeto IS 'Trajeto completo do turno com todos os eventos em ordem cronológica';

-- =====================================================
-- 6. FUNÇÃO: REGISTRAR EVENTO DO TURNO
-- =====================================================
CREATE OR REPLACE FUNCTION public.registrar_evento_turno(
  p_turno_id UUID,
  p_equipe_id UUID,
  p_tipo_evento VARCHAR(50),
  p_ordem_servico_id UUID DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_latitude DECIMAL(10,8) DEFAULT NULL,
  p_longitude DECIMAL(11,8) DEFAULT NULL,
  p_accuracy_m DECIMAL(10,2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_evento_id UUID;
BEGIN
  INSERT INTO public.turno_eventos (
    turno_id,
    equipe_id,
    ordem_servico_id,
    tipo_evento,
    descricao,
    metadata,
    latitude,
    longitude,
    accuracy_m
  )
  VALUES (
    p_turno_id,
    p_equipe_id,
    p_ordem_servico_id,
    p_tipo_evento,
    p_descricao,
    p_metadata,
    p_latitude,
    p_longitude,
    p_accuracy_m
  )
  RETURNING id INTO v_evento_id;
  
  RETURN v_evento_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.registrar_evento_turno IS 'Registra um evento durante o turno da equipe';

-- =====================================================
-- 7. FUNÇÃO: DETECTAR E REGISTRAR PARADA PROLONGADA
-- =====================================================
CREATE OR REPLACE FUNCTION public.detectar_parada_prolongada(
  p_equipe_id UUID,
  p_turno_id UUID,
  p_latitude DECIMAL(10,8),
  p_longitude DECIMAL(11,8),
  p_minutos_parada INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
  v_ultima_posicao RECORD;
  v_distancia_metros FLOAT;
  v_minutos_desde_ultima INTEGER;
  v_parada_ativa UUID;
BEGIN
  -- Buscar última posição registrada
  SELECT latitude, longitude, recorded_at
  INTO v_ultima_posicao
  FROM public.tecnicos_posicoes
  WHERE equipe_id = p_equipe_id
  ORDER BY recorded_at DESC
  LIMIT 1;
  
  IF v_ultima_posicao IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Calcular distância em metros usando fórmula de Haversine simplificada
  v_distancia_metros := 111320 * SQRT(
    POW(p_latitude - v_ultima_posicao.latitude, 2) +
    POW(COS(RADIANS(p_latitude)) * (p_longitude - v_ultima_posicao.longitude), 2)
  );
  
  -- Calcular minutos desde última posição
  v_minutos_desde_ultima := EXTRACT(EPOCH FROM (NOW() - v_ultima_posicao.recorded_at)) / 60;
  
  -- Se está parado há mais de X minutos (distância < 50m)
  IF v_distancia_metros < 50 AND v_minutos_desde_ultima >= p_minutos_parada THEN
    -- Verificar se já existe parada ativa
    SELECT id INTO v_parada_ativa
    FROM public.turno_paradas
    WHERE turno_id = p_turno_id
      AND equipe_id = p_equipe_id
      AND fim_parada IS NULL
    LIMIT 1;
    
    -- Se não existe parada ativa, criar uma
    IF v_parada_ativa IS NULL THEN
      INSERT INTO public.turno_paradas (
        turno_id,
        equipe_id,
        latitude,
        longitude,
        inicio_parada
      )
      VALUES (
        p_turno_id,
        p_equipe_id,
        p_latitude,
        p_longitude,
        v_ultima_posicao.recorded_at
      );
      
      -- Registrar evento
      PERFORM public.registrar_evento_turno(
        p_turno_id,
        p_equipe_id,
        'parada_detectada',
        NULL,
        'Parada prolongada detectada automaticamente',
        jsonb_build_object('duracao_minutos', v_minutos_desde_ultima),
        p_latitude,
        p_longitude,
        NULL
      );
      
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Se estava parado e voltou a se mover
  IF v_distancia_metros > 50 THEN
    UPDATE public.turno_paradas
    SET 
      fim_parada = NOW(),
      duracao_minutos = EXTRACT(EPOCH FROM (NOW() - inicio_parada)) / 60,
      updated_at = NOW()
    WHERE turno_id = p_turno_id
      AND equipe_id = p_equipe_id
      AND fim_parada IS NULL;
    
    IF FOUND THEN
      -- Registrar evento de retomada
      PERFORM public.registrar_evento_turno(
        p_turno_id,
        p_equipe_id,
        'movimento_retomado',
        NULL,
        'Equipe retomou movimentação',
        '{}',
        p_latitude,
        p_longitude,
        NULL
      );
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.detectar_parada_prolongada IS 'Detecta e registra paradas prolongadas da equipe';

-- =====================================================
-- 8. HABILITAR REALTIME (idempotente)
-- =====================================================
DO $$
BEGIN
  -- Adicionar turno_eventos ao realtime se ainda não estiver
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'turno_eventos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.turno_eventos;
  END IF;
  
  -- Adicionar turno_paradas ao realtime se ainda não estiver
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'turno_paradas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.turno_paradas;
  END IF;
END
$$;

-- =====================================================
-- 9. TRIGGER PARA REGISTRAR EVENTOS AUTOMATICAMENTE
-- =====================================================
-- Trigger para registrar evento quando turno é aberto
CREATE OR REPLACE FUNCTION public.trigger_turno_aberto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aberto' AND (OLD IS NULL OR OLD.status != 'aberto') THEN
    PERFORM public.registrar_evento_turno(
      NEW.id,
      NEW.equipe_id,
      'inicio_turno',
      NULL,
      'Turno iniciado',
      jsonb_build_object(
        'placa_veiculo', NEW.placa_veiculo,
        'km_inicial', NEW.km_inicial
      ),
      NULL,
      NULL,
      NULL
    );
  END IF;
  
  IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
    PERFORM public.registrar_evento_turno(
      NEW.id,
      NEW.equipe_id,
      'fim_turno',
      NULL,
      'Turno encerrado',
      jsonb_build_object(
        'km_final', NEW.km_final,
        'observacoes', NEW.observacoes
      ),
      NULL,
      NULL,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_turno_eventos_status ON public.turnos;
CREATE TRIGGER trg_turno_eventos_status
  AFTER INSERT OR UPDATE OF status ON public.turnos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_turno_aberto();

-- Trigger para registrar evento quando OS muda de status
CREATE OR REPLACE FUNCTION public.trigger_os_status_evento()
RETURNS TRIGGER AS $$
DECLARE
  v_turno_id UUID;
  v_tipo_evento VARCHAR(50);
  v_descricao TEXT;
BEGIN
  -- Buscar turno aberto da equipe
  SELECT id INTO v_turno_id
  FROM public.turnos
  WHERE equipe_id = NEW.tecnico_id
    AND data_turno = CURRENT_DATE
    AND status = 'aberto'
  LIMIT 1;
  
  -- Se não tem turno aberto, não registra evento
  IF v_turno_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Determinar tipo de evento baseado no status
  IF NEW.status = 'em_deslocamento' AND (OLD IS NULL OR OLD.status != 'em_deslocamento') THEN
    v_tipo_evento := 'inicio_deslocamento';
    v_descricao := 'Deslocamento para OS ' || NEW.numero;
  ELSIF NEW.status = 'no_local' AND OLD.status = 'em_deslocamento' THEN
    v_tipo_evento := 'chegada_local';
    v_descricao := 'Chegada no local da OS ' || NEW.numero;
  ELSIF NEW.status IN ('em_execucao', 'em_andamento') AND OLD.status IN ('no_local', 'em_deslocamento', 'planejada', 'pendente') THEN
    v_tipo_evento := 'inicio_servico';
    v_descricao := 'Início da execução da OS ' || NEW.numero;
  ELSIF NEW.status = 'concluida' AND OLD.status IN ('em_execucao', 'em_andamento') THEN
    v_tipo_evento := 'fim_servico';
    v_descricao := 'Conclusão da OS ' || NEW.numero;
  ELSE
    RETURN NEW; -- Não registrar outros tipos de mudança
  END IF;
  
  -- Registrar evento
  PERFORM public.registrar_evento_turno(
    v_turno_id,
    NEW.tecnico_id,
    v_tipo_evento,
    NEW.id,
    v_descricao,
    jsonb_build_object(
      'status_anterior', OLD.status,
      'status_novo', NEW.status,
      'numero_os', NEW.numero,
      'tipo_os', NEW.tipo
    ),
    NEW.latitude,
    NEW.longitude,
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_os_status_evento ON public.ordens_servico;
CREATE TRIGGER trg_os_status_evento
  AFTER UPDATE OF status ON public.ordens_servico
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.tecnico_id IS NOT NULL)
  EXECUTE FUNCTION public.trigger_os_status_evento();

-- Trigger para registrar evento de intervalo
CREATE OR REPLACE FUNCTION public.trigger_intervalo_evento()
RETURNS TRIGGER AS $$
DECLARE
  v_turno_id UUID;
  v_tipo_intervalo_nome TEXT;
BEGIN
  -- Buscar turno aberto da equipe
  SELECT id INTO v_turno_id
  FROM public.turnos
  WHERE equipe_id = NEW.equipe_id
    AND data_turno = CURRENT_DATE
    AND status = 'aberto'
  LIMIT 1;
  
  IF v_turno_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar nome do tipo de intervalo
  SELECT nome INTO v_tipo_intervalo_nome
  FROM public.tipos_intervalo
  WHERE id = NEW.tipo_intervalo_id;
  
  -- Registrar início ou fim do intervalo
  IF TG_OP = 'INSERT' THEN
    PERFORM public.registrar_evento_turno(
      v_turno_id,
      NEW.equipe_id,
      'inicio_intervalo',
      NULL,
      'Início do intervalo: ' || COALESCE(v_tipo_intervalo_nome, 'Intervalo'),
      jsonb_build_object(
        'tipo_intervalo_id', NEW.tipo_intervalo_id,
        'tipo_intervalo_nome', v_tipo_intervalo_nome,
        'observacao', NEW.observacao
      ),
      NULL,
      NULL,
      NULL
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.hora_fim IS NOT NULL AND OLD.hora_fim IS NULL THEN
    PERFORM public.registrar_evento_turno(
      v_turno_id,
      NEW.equipe_id,
      'fim_intervalo',
      NULL,
      'Fim do intervalo: ' || COALESCE(v_tipo_intervalo_nome, 'Intervalo'),
      jsonb_build_object(
        'tipo_intervalo_id', NEW.tipo_intervalo_id,
        'tipo_intervalo_nome', v_tipo_intervalo_nome,
        'duracao_minutos', EXTRACT(EPOCH FROM (NEW.hora_fim - NEW.hora_inicio)) / 60
      ),
      NULL,
      NULL,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verificar se a tabela intervalos_equipe existe e criar trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intervalos_equipe') THEN
    DROP TRIGGER IF EXISTS trg_intervalo_evento ON public.intervalos_equipe;
    CREATE TRIGGER trg_intervalo_evento
      AFTER INSERT OR UPDATE OF hora_fim ON public.intervalos_equipe
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_intervalo_evento();
  END IF;
END
$$;

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turno_eventos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turno_paradas TO anon, authenticated;
GRANT SELECT ON public.vw_equipes_turno_aberto TO anon, authenticated;
GRANT SELECT ON public.vw_turno_trajeto TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_evento_turno TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detectar_parada_prolongada TO anon, authenticated;
