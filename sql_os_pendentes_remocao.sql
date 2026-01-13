-- =====================================================
-- Sistema de Controle de Remoção de OSs com Sincronização
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Tabela para controlar OSs pendentes de remoção
-- Quando uma OS é marcada para remoção em rota do dia atual,
-- ela fica "aguardando sinal" até confirmar que não está em execução
CREATE TABLE IF NOT EXISTS public.os_pendentes_remocao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id UUID NOT NULL REFERENCES planejamentos(id) ON DELETE CASCADE,
  planejamento_ordem_id UUID REFERENCES planejamento_ordens(id) ON DELETE SET NULL,
  ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES tecnicos(id) ON DELETE CASCADE,
  
  -- Status da solicitação de remoção
  status VARCHAR(50) NOT NULL DEFAULT 'aguardando_sinal' CHECK (status IN (
    'aguardando_sinal',       -- Aguardando equipe ficar online para confirmar
    'confirmado_remocao',     -- App confirmou que pode remover
    'removido',               -- Remoção efetivada
    'cancelado_em_execucao',  -- Não pode remover - OS estava em execução
    'cancelado_concluida'     -- Não pode remover - OS foi concluída
  )),
  
  -- Dados da OS no momento da solicitação (para auditoria)
  os_numero VARCHAR(50),
  os_status_original VARCHAR(50),
  
  -- Dados de rastreamento
  solicitado_por UUID REFERENCES usuarios_web(id),
  solicitado_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Dados de confirmação/cancelamento
  confirmado_at TIMESTAMPTZ,
  confirmado_status_app VARCHAR(50),  -- Status que o app reportou
  motivo_cancelamento TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_os_pendentes_remocao_planejamento ON public.os_pendentes_remocao(planejamento_id);
CREATE INDEX IF NOT EXISTS idx_os_pendentes_remocao_equipe ON public.os_pendentes_remocao(equipe_id);
CREATE INDEX IF NOT EXISTS idx_os_pendentes_remocao_ordem ON public.os_pendentes_remocao(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_os_pendentes_remocao_status ON public.os_pendentes_remocao(status);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_os_pendentes_remocao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_os_pendentes_remocao_timestamp ON public.os_pendentes_remocao;
CREATE TRIGGER update_os_pendentes_remocao_timestamp
    BEFORE UPDATE ON public.os_pendentes_remocao
    FOR EACH ROW
    EXECUTE FUNCTION update_os_pendentes_remocao_updated_at();

-- Adicionar campo na planejamento_ordens para rastrear sincronização com app
ALTER TABLE public.planejamento_ordens 
ADD COLUMN IF NOT EXISTS sincronizado_app BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sincronizado_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ultima_verificacao_app TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON TABLE public.os_pendentes_remocao IS 'Controla OSs que foram solicitadas para remoção mas aguardam confirmação do app';
COMMENT ON COLUMN public.os_pendentes_remocao.status IS 'Status da solicitação: aguardando_sinal, confirmado_remocao, removido, cancelado_em_execucao, cancelado_concluida';
COMMENT ON COLUMN public.planejamento_ordens.sincronizado_app IS 'Indica se esta OS foi recebida e confirmada pelo app da equipe';

-- RLS Policies
ALTER TABLE public.os_pendentes_remocao ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados (web)
CREATE POLICY "os_pendentes_remocao_authenticated_all" ON public.os_pendentes_remocao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Política para anon (app)
CREATE POLICY "os_pendentes_remocao_anon_all" ON public.os_pendentes_remocao
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- =====================================================
-- Função RPC para app confirmar status de OS
-- O app chama esta função para confirmar se pode remover
-- =====================================================
CREATE OR REPLACE FUNCTION confirmar_remocao_os(
  p_pendente_id UUID,
  p_status_atual VARCHAR(50),  -- Status atual da OS no app
  p_pode_remover BOOLEAN       -- Se o app autoriza a remoção
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pendente RECORD;
  v_resultado JSON;
BEGIN
  -- Buscar registro pendente
  SELECT * INTO v_pendente
  FROM os_pendentes_remocao
  WHERE id = p_pendente_id AND status = 'aguardando_sinal';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Solicitação não encontrada ou já processada');
  END IF;
  
  IF p_pode_remover THEN
    -- Atualizar para confirmado
    UPDATE os_pendentes_remocao
    SET status = 'confirmado_remocao',
        confirmado_at = NOW(),
        confirmado_status_app = p_status_atual
    WHERE id = p_pendente_id;
    
    -- Efetuar a remoção da OS do planejamento
    DELETE FROM planejamento_ordens WHERE id = v_pendente.planejamento_ordem_id;
    
    -- Reverter status da OS para pendente
    UPDATE ordens_servico
    SET status = 'pendente',
        equipe_planejada_id = NULL,
        data_planejada = NULL
    WHERE id = v_pendente.ordem_servico_id;
    
    -- Marcar como removido
    UPDATE os_pendentes_remocao
    SET status = 'removido'
    WHERE id = p_pendente_id;
    
    RETURN json_build_object('success', true, 'message', 'OS removida com sucesso');
  ELSE
    -- Cancelar a solicitação de remoção
    UPDATE os_pendentes_remocao
    SET status = CASE 
      WHEN p_status_atual IN ('em_execucao', 'em_deslocamento', 'no_local') THEN 'cancelado_em_execucao'
      WHEN p_status_atual = 'concluida' THEN 'cancelado_concluida'
      ELSE 'cancelado_em_execucao'
    END,
    confirmado_at = NOW(),
    confirmado_status_app = p_status_atual,
    motivo_cancelamento = 'OS já ' || p_status_atual || ' no momento da confirmação'
    WHERE id = p_pendente_id;
    
    RETURN json_build_object(
      'success', false, 
      'error', 'Não foi possível remover - OS está ' || p_status_atual,
      'status_os', p_status_atual
    );
  END IF;
END;
$$;

-- =====================================================
-- Função RPC para buscar OSs pendentes de uma equipe
-- =====================================================
CREATE OR REPLACE FUNCTION get_os_pendentes_remocao_equipe(p_equipe_id UUID)
RETURNS TABLE (
  id UUID,
  ordem_servico_id UUID,
  os_numero VARCHAR(50),
  status VARCHAR(50),
  solicitado_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    opr.id,
    opr.ordem_servico_id,
    opr.os_numero,
    opr.status,
    opr.solicitado_at
  FROM os_pendentes_remocao opr
  WHERE opr.equipe_id = p_equipe_id
    AND opr.status = 'aguardando_sinal'
  ORDER BY opr.solicitado_at DESC;
END;
$$;

-- Verificar estrutura
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'os_pendentes_remocao'
ORDER BY ordinal_position;
