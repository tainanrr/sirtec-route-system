-- Solicitação de devolução criada pelo almoxarifado e confirmada pela equipe
-- Cenário: equipe entregou fisicamente sem registrar no app → almox registra → equipe confirma no app.

-- 1) Novos metadados e novo status
ALTER TABLE public.materiais_devolucoes
ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'equipe'; -- equipe | almoxarifado

ALTER TABLE public.materiais_devolucoes
ADD COLUMN IF NOT EXISTS data_confirmacao_equipe TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.materiais_devolucoes
ADD COLUMN IF NOT EXISTS confirmado_por UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_materiais_devolucoes_origem_status_created_at
  ON public.materiais_devolucoes (origem, status, created_at DESC);

-- 2) RPC: equipe confirma solicitação criada pelo almoxarifado
-- Regras:
-- - Só roda se status = 'pendente_confirmacao_equipe'
-- - Executa as mesmas movimentações de estoque/serializados que confirmar_devolucao
-- - Finaliza com status = 'conferida' e registra data_confirmacao_equipe/confirmado_por
CREATE OR REPLACE FUNCTION public.confirmar_solicitacao_devolucao_equipe(
  p_devolucao_id UUID
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
  IF v_dev.status <> 'pendente_confirmacao_equipe' THEN
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
      'Devolução confirmada pela equipe - ' || p_devolucao_id,
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
      'Devolução confirmada pela equipe - ' || p_devolucao_id,
      now(),
      auth.uid()
    FROM public.materiais_serializados ms
    WHERE ms.numero_serie = v_serial.numero_serie;
  END LOOP;

  -- Finalizar devolução
  UPDATE public.materiais_devolucoes
  SET status = 'conferida',
      data_confirmacao_equipe = now(),
      confirmado_por = auth.uid()
  WHERE id = p_devolucao_id;
END;
$$;

