-- Devoluções de materiais pelas equipes (solicitação no app + conferência no almoxarifado)

-- 1) Cabeçalho da devolução
CREATE TABLE IF NOT EXISTS public.materiais_devolucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id),
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | conferida | cancelada
  observacao TEXT,
  data_solicitacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_conferencia TIMESTAMP WITH TIME ZONE,
  conferido_por UUID REFERENCES auth.users(id),
  recebido_por TEXT,
  recebido_por_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_materiais_devolucoes_equipe_id_created_at
  ON public.materiais_devolucoes (equipe_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_materiais_devolucoes_status_created_at
  ON public.materiais_devolucoes (status, created_at DESC);

ALTER TABLE public.materiais_devolucoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes'
      AND policyname = 'Authenticated users can view materiais_devolucoes'
  ) THEN
    CREATE POLICY "Authenticated users can view materiais_devolucoes"
    ON public.materiais_devolucoes FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes'
      AND policyname = 'Authenticated users can manage materiais_devolucoes'
  ) THEN
    CREATE POLICY "Authenticated users can manage materiais_devolucoes"
    ON public.materiais_devolucoes FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 2) Itens da devolução (quantidade solicitada e conferida)
CREATE TABLE IF NOT EXISTS public.materiais_devolucoes_itens (
  devolucao_id UUID NOT NULL REFERENCES public.materiais_devolucoes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materiais(id),
  quantidade_solicitada INTEGER NOT NULL CHECK (quantidade_solicitada > 0),
  quantidade_conferida INTEGER CHECK (quantidade_conferida >= 0),
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (devolucao_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_materiais_devolucoes_itens_material_id
  ON public.materiais_devolucoes_itens (material_id);

ALTER TABLE public.materiais_devolucoes_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes_itens'
      AND policyname = 'Authenticated users can view materiais_devolucoes_itens'
  ) THEN
    CREATE POLICY "Authenticated users can view materiais_devolucoes_itens"
    ON public.materiais_devolucoes_itens FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes_itens'
      AND policyname = 'Authenticated users can manage materiais_devolucoes_itens'
  ) THEN
    CREATE POLICY "Authenticated users can manage materiais_devolucoes_itens"
    ON public.materiais_devolucoes_itens FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 3) Rastros/seriais por item (quando material requer_serial)
CREATE TABLE IF NOT EXISTS public.materiais_devolucoes_itens_rastros (
  devolucao_id UUID NOT NULL REFERENCES public.materiais_devolucoes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materiais(id),
  numero_serie TEXT NOT NULL,
  conferido BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (devolucao_id, material_id, numero_serie)
);

CREATE INDEX IF NOT EXISTS idx_materiais_devolucoes_rastros_numero_serie
  ON public.materiais_devolucoes_itens_rastros (numero_serie);

ALTER TABLE public.materiais_devolucoes_itens_rastros ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes_itens_rastros'
      AND policyname = 'Authenticated users can view materiais_devolucoes_itens_rastros'
  ) THEN
    CREATE POLICY "Authenticated users can view materiais_devolucoes_itens_rastros"
    ON public.materiais_devolucoes_itens_rastros FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes_itens_rastros'
      AND policyname = 'Authenticated users can manage materiais_devolucoes_itens_rastros'
  ) THEN
    CREATE POLICY "Authenticated users can manage materiais_devolucoes_itens_rastros"
    ON public.materiais_devolucoes_itens_rastros FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 4) Anexos (opcional): fotos/documentos da devolução
CREATE TABLE IF NOT EXISTS public.materiais_devolucoes_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucao_id UUID NOT NULL REFERENCES public.materiais_devolucoes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_materiais_devolucoes_anexos_devolucao_id_created_at
  ON public.materiais_devolucoes_anexos (devolucao_id, created_at DESC);

ALTER TABLE public.materiais_devolucoes_anexos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes_anexos'
      AND policyname = 'Authenticated users can view materiais_devolucoes_anexos'
  ) THEN
    CREATE POLICY "Authenticated users can view materiais_devolucoes_anexos"
    ON public.materiais_devolucoes_anexos FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materiais_devolucoes_anexos'
      AND policyname = 'Authenticated users can manage materiais_devolucoes_anexos'
  ) THEN
    CREATE POLICY "Authenticated users can manage materiais_devolucoes_anexos"
    ON public.materiais_devolucoes_anexos FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 5) RPC: confirmar devolução (idempotente) + atualiza estoques + serializados + movimentações
CREATE OR REPLACE FUNCTION public.confirmar_devolucao(
  p_devolucao_id UUID,
  p_recebido_por TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev RECORD;
  v_item RECORD;
  v_qty INTEGER;
  v_serial RECORD;
  v_old_status TEXT;
  v_old_loc TEXT;
BEGIN
  SELECT * INTO v_dev
  FROM public.materiais_devolucoes
  WHERE id = p_devolucao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devolução não encontrada';
  END IF;

  -- idempotente
  IF v_dev.status <> 'pendente' THEN
    RETURN;
  END IF;

  -- Validar e movimentar estoque por item
  FOR v_item IN
    SELECT * FROM public.materiais_devolucoes_itens
    WHERE devolucao_id = p_devolucao_id
  LOOP
    v_qty := COALESCE(v_item.quantidade_conferida, v_item.quantidade_solicitada);

    -- Validar estoque da equipe
    PERFORM 1
    FROM public.materiais_estoque me
    WHERE me.material_id = v_item.material_id
      AND me.local_tipo = 'equipe'
      AND me.local_id = v_dev.equipe_id
      AND me.quantidade >= v_qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Estoque insuficiente na equipe para material_id=% (qtd=%)', v_item.material_id, v_qty;
    END IF;

    -- Baixa no estoque da equipe
    UPDATE public.materiais_estoque
    SET quantidade = quantidade - v_qty
    WHERE material_id = v_item.material_id
      AND local_tipo = 'equipe'
      AND local_id = v_dev.equipe_id;

    -- Entrada no estoque central (upsert)
    INSERT INTO public.materiais_estoque (material_id, quantidade, local_tipo, local_id)
    VALUES (v_item.material_id, v_qty, 'central', NULL)
    ON CONFLICT (material_id, local_tipo, local_id)
    DO UPDATE SET quantidade = public.materiais_estoque.quantidade + EXCLUDED.quantidade;

    -- Registrar movimentação
    INSERT INTO public.materiais_movimentacoes (
      material_id,
      tipo,
      quantidade,
      local_origem_tipo,
      local_origem_id,
      local_destino_tipo,
      local_destino_id,
      documento_referencia,
      observacao,
      devolucao_id,
      created_by
    ) VALUES (
      v_item.material_id,
      'transferencia',
      v_qty,
      'equipe',
      v_dev.equipe_id,
      'central',
      NULL,
      NULL,
      'Devolução confirmada - ' || p_devolucao_id,
      p_devolucao_id,
      auth.uid()
    );
  END LOOP;

  -- Atualizar serializados (quando existirem rastros vinculados)
  FOR v_serial IN
    SELECT numero_serie
    FROM public.materiais_devolucoes_itens_rastros
    WHERE devolucao_id = p_devolucao_id
      AND conferido = true
  LOOP
    SELECT status, localizacao_tipo INTO v_old_status, v_old_loc
    FROM public.materiais_serializados
    WHERE numero_serie = v_serial.numero_serie
    FOR UPDATE;

    UPDATE public.materiais_serializados
    SET status = 'em_estoque',
        localizacao_tipo = 'central',
        localizacao_id = NULL,
        ordem_servico_id = NULL,
        updated_at = now()
    WHERE numero_serie = v_serial.numero_serie;

    -- histórico (tabela já existente no sistema)
    INSERT INTO public.materiais_serializados_historico (
      id,
      material_serializado_id,
      acao,
      status_anterior,
      status_novo,
      localizacao_anterior,
      localizacao_nova,
      observacao,
      created_at,
      created_by
    )
    SELECT
      gen_random_uuid(),
      ms.id,
      'devolucao',
      v_old_status,
      'em_estoque',
      v_old_loc,
      'central',
      'Devolução confirmada - ' || p_devolucao_id,
      now(),
      auth.uid()
    FROM public.materiais_serializados ms
    WHERE ms.numero_serie = v_serial.numero_serie;
  END LOOP;

  -- Finalizar devolução
  UPDATE public.materiais_devolucoes
  SET status = 'conferida',
      data_conferencia = now(),
      conferido_por = auth.uid(),
      recebido_por = COALESCE(p_recebido_por, recebido_por),
      recebido_por_user_id = auth.uid()
  WHERE id = p_devolucao_id;
END;
$$;


