-- Migration: Sistema de Planejamento de Rotas
-- Adiciona campos de planejamento na tabela ordens_servico
-- Cria tabela de planejamentos
-- Cria tabela de relacionamento planejamento_ordens

-- Adicionar campos de planejamento na tabela ordens_servico
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS equipe_planejada_id UUID REFERENCES public.tecnicos(id),
ADD COLUMN IF NOT EXISTS data_planejada DATE;

-- Criar tabela de planejamentos
CREATE TABLE IF NOT EXISTS public.planejamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_planejamento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto', -- 'aberto', 'cancelado', 'executado'
  total_equipes INTEGER DEFAULT 0,
  total_ordens INTEGER DEFAULT 0,
  distancia_total_km DECIMAL(10,2) DEFAULT 0,
  tempo_total_minutos INTEGER DEFAULT 0,
  faturamento_total DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  canceled_at TIMESTAMP WITH TIME ZONE,
  canceled_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de relacionamento entre planejamentos e ordens de serviço
CREATE TABLE IF NOT EXISTS public.planejamento_ordens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id UUID NOT NULL REFERENCES public.planejamentos(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id),
  ordem_na_rota INTEGER NOT NULL,
  distancia_km DECIMAL(10,2) DEFAULT 0,
  tempo_estimado_minutos INTEGER DEFAULT 0,
  hora_inicio_estimada TIME,
  hora_fim_estimada TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(planejamento_id, ordem_servico_id)
);

-- Criar tabela de histórico/log de planejamentos
CREATE TABLE IF NOT EXISTS public.planejamento_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id UUID NOT NULL REFERENCES public.planejamentos(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  acao TEXT NOT NULL, -- 'criado', 'atualizado', 'cancelado', 'ordem_adicionada', 'ordem_removida', 'status_alterado'
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.planejamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_ordens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para planejamentos
CREATE POLICY "Authenticated users can view planejamentos"
ON public.planejamentos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage planejamentos"
ON public.planejamentos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Políticas de segurança para planejamento_ordens
CREATE POLICY "Authenticated users can view planejamento_ordens"
ON public.planejamento_ordens FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage planejamento_ordens"
ON public.planejamento_ordens FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Políticas de segurança para planejamento_logs
CREATE POLICY "Authenticated users can view planejamento_logs"
ON public.planejamento_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert planejamento_logs"
ON public.planejamento_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_planejamentos_data ON public.planejamentos(data_planejamento);
CREATE INDEX IF NOT EXISTS idx_planejamentos_status ON public.planejamentos(status);
CREATE INDEX IF NOT EXISTS idx_planejamento_ordens_planejamento ON public.planejamento_ordens(planejamento_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_ordens_ordem ON public.planejamento_ordens(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_ordens_equipe ON public.planejamento_ordens(equipe_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_logs_planejamento ON public.planejamento_logs(planejamento_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_equipe_planejada ON public.ordens_servico(equipe_planejada_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_data_planejada ON public.ordens_servico(data_planejada);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_planejamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_planejamentos_updated_at
  BEFORE UPDATE ON public.planejamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_planejamento_updated_at();


-- Adiciona campos de planejamento na tabela ordens_servico
-- Cria tabela de planejamentos
-- Cria tabela de relacionamento planejamento_ordens

-- Adicionar campos de planejamento na tabela ordens_servico
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS equipe_planejada_id UUID REFERENCES public.tecnicos(id),
ADD COLUMN IF NOT EXISTS data_planejada DATE;

-- Criar tabela de planejamentos
CREATE TABLE IF NOT EXISTS public.planejamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_planejamento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto', -- 'aberto', 'cancelado', 'executado'
  total_equipes INTEGER DEFAULT 0,
  total_ordens INTEGER DEFAULT 0,
  distancia_total_km DECIMAL(10,2) DEFAULT 0,
  tempo_total_minutos INTEGER DEFAULT 0,
  faturamento_total DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  canceled_at TIMESTAMP WITH TIME ZONE,
  canceled_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de relacionamento entre planejamentos e ordens de serviço
CREATE TABLE IF NOT EXISTS public.planejamento_ordens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id UUID NOT NULL REFERENCES public.planejamentos(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id),
  ordem_na_rota INTEGER NOT NULL,
  distancia_km DECIMAL(10,2) DEFAULT 0,
  tempo_estimado_minutos INTEGER DEFAULT 0,
  hora_inicio_estimada TIME,
  hora_fim_estimada TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(planejamento_id, ordem_servico_id)
);

-- Criar tabela de histórico/log de planejamentos
CREATE TABLE IF NOT EXISTS public.planejamento_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id UUID NOT NULL REFERENCES public.planejamentos(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  acao TEXT NOT NULL, -- 'criado', 'atualizado', 'cancelado', 'ordem_adicionada', 'ordem_removida', 'status_alterado'
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.planejamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_ordens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para planejamentos
CREATE POLICY "Authenticated users can view planejamentos"
ON public.planejamentos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage planejamentos"
ON public.planejamentos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Políticas de segurança para planejamento_ordens
CREATE POLICY "Authenticated users can view planejamento_ordens"
ON public.planejamento_ordens FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage planejamento_ordens"
ON public.planejamento_ordens FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Políticas de segurança para planejamento_logs
CREATE POLICY "Authenticated users can view planejamento_logs"
ON public.planejamento_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert planejamento_logs"
ON public.planejamento_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_planejamentos_data ON public.planejamentos(data_planejamento);
CREATE INDEX IF NOT EXISTS idx_planejamentos_status ON public.planejamentos(status);
CREATE INDEX IF NOT EXISTS idx_planejamento_ordens_planejamento ON public.planejamento_ordens(planejamento_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_ordens_ordem ON public.planejamento_ordens(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_ordens_equipe ON public.planejamento_ordens(equipe_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_logs_planejamento ON public.planejamento_logs(planejamento_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_equipe_planejada ON public.ordens_servico(equipe_planejada_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_data_planejada ON public.ordens_servico(data_planejada);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_planejamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_planejamentos_updated_at
  BEFORE UPDATE ON public.planejamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_planejamento_updated_at();



