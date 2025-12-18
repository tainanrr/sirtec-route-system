-- ============================================================================
-- MIGRAÇÃO: Sistema de Rastreamento de Retenção de Materiais com Rastro
-- ============================================================================
-- Objetivo: Garantir que materiais com rastro entregues às equipes não fiquem
-- esquecidos nos carros/estoques. Cada material terá um contador de dias
-- desde a entrega e alertas configuráveis por material.
-- ============================================================================

-- 1. Adicionar campo de configuração de dias de alerta no catálogo de materiais
-- Este campo define após quantos dias um material com rastro deve gerar alerta
ALTER TABLE public.materiais 
ADD COLUMN IF NOT EXISTS dias_alerta_retencao INTEGER DEFAULT 7;

COMMENT ON COLUMN public.materiais.dias_alerta_retencao IS 
'Número de dias após entrega para equipe que o material deve gerar alerta de retenção. Padrão: 7 dias.';

-- 2. Adicionar campo de data de entrega para equipe nos materiais serializados
-- Isso permite calcular há quantos dias o material está com a equipe
ALTER TABLE public.materiais_serializados 
ADD COLUMN IF NOT EXISTS data_entrega_equipe TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.materiais_serializados.data_entrega_equipe IS 
'Data em que o material foi entregue para a equipe atual. Usado para calcular dias de retenção.';

-- 3. Adicionar campo de equipe atual para facilitar consultas
ALTER TABLE public.materiais_serializados 
ADD COLUMN IF NOT EXISTS equipe_atual_id UUID REFERENCES public.tecnicos(id);

COMMENT ON COLUMN public.materiais_serializados.equipe_atual_id IS 
'ID da equipe que está atualmente com o material. Atualizado automaticamente nas movimentações.';

-- 4. Criar índice para consultas de materiais retidos
CREATE INDEX IF NOT EXISTS idx_materiais_serializados_retencao 
ON public.materiais_serializados(status, data_entrega_equipe, equipe_atual_id)
WHERE status = 'com_equipe' AND data_entrega_equipe IS NOT NULL;

-- 5. Criar view para materiais com alerta de retenção
CREATE OR REPLACE VIEW public.vw_materiais_alerta_retencao AS
SELECT 
  ms.id,
  ms.numero_serie,
  ms.material_id,
  m.codigo AS material_codigo,
  m.nome AS material_nome,
  m.categoria AS material_categoria,
  m.dias_alerta_retencao,
  ms.status,
  ms.equipe_atual_id,
  t.codigo AS equipe_codigo,
  t.nome AS equipe_nome,
  ms.data_entrega_equipe,
  EXTRACT(DAY FROM (NOW() - ms.data_entrega_equipe))::INTEGER AS dias_com_equipe,
  CASE 
    WHEN EXTRACT(DAY FROM (NOW() - ms.data_entrega_equipe)) >= m.dias_alerta_retencao THEN true
    ELSE false
  END AS em_alerta,
  CASE 
    WHEN EXTRACT(DAY FROM (NOW() - ms.data_entrega_equipe)) >= m.dias_alerta_retencao * 2 THEN 'critico'
    WHEN EXTRACT(DAY FROM (NOW() - ms.data_entrega_equipe)) >= m.dias_alerta_retencao THEN 'alerta'
    WHEN EXTRACT(DAY FROM (NOW() - ms.data_entrega_equipe)) >= m.dias_alerta_retencao * 0.7 THEN 'atencao'
    ELSE 'normal'
  END AS nivel_alerta
FROM public.materiais_serializados ms
JOIN public.materiais m ON m.id = ms.material_id
LEFT JOIN public.tecnicos t ON t.id = ms.equipe_atual_id
WHERE ms.status = 'com_equipe' 
  AND ms.data_entrega_equipe IS NOT NULL;

-- 6. Criar função para atualizar data_entrega_equipe automaticamente
CREATE OR REPLACE FUNCTION public.atualizar_data_entrega_equipe()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudou para 'com_equipe', registrar a data de entrega
  IF NEW.status = 'com_equipe' AND (OLD.status IS NULL OR OLD.status != 'com_equipe') THEN
    NEW.data_entrega_equipe := NOW();
    -- Se localizacao_id é um UUID válido de equipe, atualizar equipe_atual_id
    IF NEW.localizacao_tipo = 'equipe' AND NEW.localizacao_id IS NOT NULL THEN
      NEW.equipe_atual_id := NEW.localizacao_id::UUID;
    END IF;
  END IF;
  
  -- Se o status saiu de 'com_equipe', limpar a data de entrega e equipe
  IF OLD.status = 'com_equipe' AND NEW.status != 'com_equipe' THEN
    NEW.data_entrega_equipe := NULL;
    NEW.equipe_atual_id := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Criar trigger para automatizar atualização
DROP TRIGGER IF EXISTS trg_atualizar_data_entrega_equipe ON public.materiais_serializados;
CREATE TRIGGER trg_atualizar_data_entrega_equipe
  BEFORE UPDATE ON public.materiais_serializados
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_data_entrega_equipe();

-- 8. Criar função para obter resumo de alertas de retenção
CREATE OR REPLACE FUNCTION public.get_resumo_alertas_retencao()
RETURNS TABLE (
  total_com_equipe BIGINT,
  total_em_alerta BIGINT,
  total_critico BIGINT,
  total_atencao BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_com_equipe,
    COUNT(*) FILTER (WHERE em_alerta = true)::BIGINT AS total_em_alerta,
    COUNT(*) FILTER (WHERE nivel_alerta = 'critico')::BIGINT AS total_critico,
    COUNT(*) FILTER (WHERE nivel_alerta = 'atencao')::BIGINT AS total_atencao
  FROM public.vw_materiais_alerta_retencao;
END;
$$ LANGUAGE plpgsql;

-- 9. Atualizar materiais existentes que já estão com equipe
-- Definir data_entrega_equipe como a data da última movimentação para 'com_equipe'
UPDATE public.materiais_serializados ms
SET 
  data_entrega_equipe = COALESCE(
    (SELECT MAX(mh.created_at) 
     FROM public.materiais_historico mh 
     WHERE mh.material_serializado_id = ms.id 
       AND mh.status_novo = 'com_equipe'),
    ms.updated_at,
    ms.created_at
  ),
  equipe_atual_id = CASE 
    WHEN ms.localizacao_tipo = 'equipe' AND ms.localizacao_id IS NOT NULL 
    THEN ms.localizacao_id::UUID 
    ELSE NULL 
  END
WHERE ms.status = 'com_equipe' 
  AND ms.data_entrega_equipe IS NULL;

-- 10. Habilitar RLS na view (se necessário)
-- Views herdam as políticas das tabelas base, então não é necessário criar políticas específicas

COMMENT ON VIEW public.vw_materiais_alerta_retencao IS 
'View que mostra todos os materiais com rastro que estão com equipes, incluindo dias de retenção e nível de alerta.';

