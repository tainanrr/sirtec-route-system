-- Criar tabela de Checklists
-- Execute este SQL no Supabase SQL Editor

-- Tabela principal de checklists
CREATE TABLE IF NOT EXISTS public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL DEFAULT 'apr', -- apr, qualidade, seguranca, inspecao, manutencao, outro
  ativo BOOLEAN DEFAULT true,
  perguntas JSONB DEFAULT '[]'::jsonb, -- Array de perguntas com estrutura flexível
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_checklists_tipo ON public.checklists(tipo);
CREATE INDEX IF NOT EXISTS idx_checklists_ativo ON public.checklists(ativo);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_checklists_updated_at ON public.checklists;
CREATE TRIGGER trigger_checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_checklists_updated_at();

-- RLS
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.checklists;
CREATE POLICY "Enable read access for authenticated users"
ON public.checklists FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.checklists;
CREATE POLICY "Enable insert for authenticated users"
ON public.checklists FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.checklists;
CREATE POLICY "Enable update for authenticated users"
ON public.checklists FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.checklists;
CREATE POLICY "Enable delete for authenticated users"
ON public.checklists FOR DELETE
TO authenticated
USING (true);

-- Tabela de respostas de checklists (preenchimentos)
CREATE TABLE IF NOT EXISTS public.checklist_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  equipe_id UUID REFERENCES public.tecnicos(id) ON DELETE SET NULL,
  respostas JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array com as respostas de cada pergunta
  status VARCHAR(50) DEFAULT 'completo', -- completo, incompleto, pendente
  observacoes TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para respostas
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_checklist_id ON public.checklist_respostas(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_ordem_servico_id ON public.checklist_respostas(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_equipe_id ON public.checklist_respostas(equipe_id);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_created_at ON public.checklist_respostas(created_at);

-- Trigger para updated_at nas respostas
DROP TRIGGER IF EXISTS trigger_checklist_respostas_updated_at ON public.checklist_respostas;
CREATE TRIGGER trigger_checklist_respostas_updated_at
  BEFORE UPDATE ON public.checklist_respostas
  FOR EACH ROW
  EXECUTE FUNCTION update_checklists_updated_at();

-- RLS para respostas
ALTER TABLE public.checklist_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.checklist_respostas;
CREATE POLICY "Enable read access for authenticated users"
ON public.checklist_respostas FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.checklist_respostas;
CREATE POLICY "Enable insert for authenticated users"
ON public.checklist_respostas FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.checklist_respostas;
CREATE POLICY "Enable update for authenticated users"
ON public.checklist_respostas FOR UPDATE
TO authenticated
USING (true);

-- Comentários
COMMENT ON TABLE public.checklists IS 'Definições de checklists (APR, qualidade, etc)';
COMMENT ON COLUMN public.checklists.perguntas IS 'Array JSON com perguntas: [{id, texto, tipo, obrigatoria, opcoes, ordem}]';
COMMENT ON TABLE public.checklist_respostas IS 'Respostas/preenchimentos de checklists';
COMMENT ON COLUMN public.checklist_respostas.respostas IS 'Array JSON com respostas: [{pergunta_id, resposta, foto_url, assinatura_url}]';

-- Inserir checklist de APR padrão
INSERT INTO public.checklists (nome, descricao, tipo, ativo, perguntas) VALUES (
  'APR - Análise Preliminar de Riscos',
  'Checklist padrão de análise de riscos antes de iniciar o serviço',
  'apr',
  true,
  '[
    {"id": "1", "texto": "O local de trabalho está limpo e organizado?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 1},
    {"id": "2", "texto": "Há sinalização adequada no local?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 2},
    {"id": "3", "texto": "Os EPIs necessários estão disponíveis e em bom estado?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 3},
    {"id": "4", "texto": "Quais EPIs estão sendo utilizados?", "tipo": "multipla_escolha", "obrigatoria": true, "ordem": 4, "opcoes": ["Capacete", "Óculos de proteção", "Luvas", "Botina", "Colete refletivo", "Protetor auricular"]},
    {"id": "5", "texto": "Há risco de queda de altura?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 5},
    {"id": "6", "texto": "Há risco de choque elétrico?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 6},
    {"id": "7", "texto": "O local possui condições climáticas adequadas para o trabalho?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 7},
    {"id": "8", "texto": "Descreva as condições gerais do local:", "tipo": "texto_longo", "obrigatoria": false, "ordem": 8},
    {"id": "9", "texto": "Foto do local de trabalho:", "tipo": "foto", "obrigatoria": true, "ordem": 9},
    {"id": "10", "texto": "Assinatura do responsável:", "tipo": "assinatura", "obrigatoria": true, "ordem": 10}
  ]'::jsonb
) ON CONFLICT DO NOTHING;


-- Execute este SQL no Supabase SQL Editor

-- Tabela principal de checklists
CREATE TABLE IF NOT EXISTS public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL DEFAULT 'apr', -- apr, qualidade, seguranca, inspecao, manutencao, outro
  ativo BOOLEAN DEFAULT true,
  perguntas JSONB DEFAULT '[]'::jsonb, -- Array de perguntas com estrutura flexível
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_checklists_tipo ON public.checklists(tipo);
CREATE INDEX IF NOT EXISTS idx_checklists_ativo ON public.checklists(ativo);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_checklists_updated_at ON public.checklists;
CREATE TRIGGER trigger_checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_checklists_updated_at();

-- RLS
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.checklists;
CREATE POLICY "Enable read access for authenticated users"
ON public.checklists FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.checklists;
CREATE POLICY "Enable insert for authenticated users"
ON public.checklists FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.checklists;
CREATE POLICY "Enable update for authenticated users"
ON public.checklists FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.checklists;
CREATE POLICY "Enable delete for authenticated users"
ON public.checklists FOR DELETE
TO authenticated
USING (true);

-- Tabela de respostas de checklists (preenchimentos)
CREATE TABLE IF NOT EXISTS public.checklist_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  equipe_id UUID REFERENCES public.tecnicos(id) ON DELETE SET NULL,
  respostas JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array com as respostas de cada pergunta
  status VARCHAR(50) DEFAULT 'completo', -- completo, incompleto, pendente
  observacoes TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para respostas
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_checklist_id ON public.checklist_respostas(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_ordem_servico_id ON public.checklist_respostas(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_equipe_id ON public.checklist_respostas(equipe_id);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_created_at ON public.checklist_respostas(created_at);

-- Trigger para updated_at nas respostas
DROP TRIGGER IF EXISTS trigger_checklist_respostas_updated_at ON public.checklist_respostas;
CREATE TRIGGER trigger_checklist_respostas_updated_at
  BEFORE UPDATE ON public.checklist_respostas
  FOR EACH ROW
  EXECUTE FUNCTION update_checklists_updated_at();

-- RLS para respostas
ALTER TABLE public.checklist_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.checklist_respostas;
CREATE POLICY "Enable read access for authenticated users"
ON public.checklist_respostas FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.checklist_respostas;
CREATE POLICY "Enable insert for authenticated users"
ON public.checklist_respostas FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.checklist_respostas;
CREATE POLICY "Enable update for authenticated users"
ON public.checklist_respostas FOR UPDATE
TO authenticated
USING (true);

-- Comentários
COMMENT ON TABLE public.checklists IS 'Definições de checklists (APR, qualidade, etc)';
COMMENT ON COLUMN public.checklists.perguntas IS 'Array JSON com perguntas: [{id, texto, tipo, obrigatoria, opcoes, ordem}]';
COMMENT ON TABLE public.checklist_respostas IS 'Respostas/preenchimentos de checklists';
COMMENT ON COLUMN public.checklist_respostas.respostas IS 'Array JSON com respostas: [{pergunta_id, resposta, foto_url, assinatura_url}]';

-- Inserir checklist de APR padrão
INSERT INTO public.checklists (nome, descricao, tipo, ativo, perguntas) VALUES (
  'APR - Análise Preliminar de Riscos',
  'Checklist padrão de análise de riscos antes de iniciar o serviço',
  'apr',
  true,
  '[
    {"id": "1", "texto": "O local de trabalho está limpo e organizado?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 1},
    {"id": "2", "texto": "Há sinalização adequada no local?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 2},
    {"id": "3", "texto": "Os EPIs necessários estão disponíveis e em bom estado?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 3},
    {"id": "4", "texto": "Quais EPIs estão sendo utilizados?", "tipo": "multipla_escolha", "obrigatoria": true, "ordem": 4, "opcoes": ["Capacete", "Óculos de proteção", "Luvas", "Botina", "Colete refletivo", "Protetor auricular"]},
    {"id": "5", "texto": "Há risco de queda de altura?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 5},
    {"id": "6", "texto": "Há risco de choque elétrico?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 6},
    {"id": "7", "texto": "O local possui condições climáticas adequadas para o trabalho?", "tipo": "sim_nao", "obrigatoria": true, "ordem": 7},
    {"id": "8", "texto": "Descreva as condições gerais do local:", "tipo": "texto_longo", "obrigatoria": false, "ordem": 8},
    {"id": "9", "texto": "Foto do local de trabalho:", "tipo": "foto", "obrigatoria": true, "ordem": 9},
    {"id": "10", "texto": "Assinatura do responsável:", "tipo": "assinatura", "obrigatoria": true, "ordem": 10}
  ]'::jsonb
) ON CONFLICT DO NOTHING;







