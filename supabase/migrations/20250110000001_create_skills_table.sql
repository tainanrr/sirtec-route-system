-- ============================================================================
-- MIGRATION: Criar tabela de Skills (Habilidades/Tipos de OS)
-- ============================================================================
-- Esta tabela armazena os tipos de habilidades/skills disponíveis no sistema
-- e seus respectivos tempos de execução em minutos
-- ============================================================================

-- Remover tabela se existir (para recriação)
DROP TABLE IF EXISTS public.skills CASCADE;

-- Criar tabela skills
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tempo_execucao_minutos INTEGER NOT NULL DEFAULT 15,
  valor DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  regulada BOOLEAN NOT NULL DEFAULT false,
  icone TEXT, -- Nome do ícone (ex: 'Zap', 'AlertCircle', 'Wrench')
  ativo BOOLEAN NOT NULL DEFAULT true,
  cor TEXT DEFAULT '#3b82f6', -- Cor para visualização no mapa/UI
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_skills_codigo ON public.skills(codigo);
CREATE INDEX idx_skills_ativo ON public.skills(ativo);

-- Habilitar RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acesso público durante desenvolvimento)
CREATE POLICY "Public access to skills"
ON public.skills FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_skills_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.skills IS 'Tabela de habilidades/skills disponíveis no sistema';
COMMENT ON COLUMN public.skills.codigo IS 'Código único da skill (ex: CORTE, RELIGA, INSPEÇÃO)';
COMMENT ON COLUMN public.skills.nome IS 'Nome da skill (ex: Corte de Energia)';
COMMENT ON COLUMN public.skills.tempo_execucao_minutos IS 'Tempo médio de execução em minutos';
COMMENT ON COLUMN public.skills.valor IS 'Valor padrão da skill em reais (R$)';
COMMENT ON COLUMN public.skills.regulada IS 'Indica se a skill é regulada (true) ou não regulada (false)';
COMMENT ON COLUMN public.skills.icone IS 'Nome do ícone do Lucide React para visualização (ex: Zap, AlertCircle, Wrench)';
COMMENT ON COLUMN public.skills.ativo IS 'Indica se a skill está ativa e disponível para uso';
COMMENT ON COLUMN public.skills.cor IS 'Cor hexadecimal para visualização no mapa/UI';

-- Inserir dados iniciais (skills padrão)
INSERT INTO public.skills (codigo, nome, descricao, tempo_execucao_minutos, valor, regulada, icone, cor) VALUES
  ('CORTE', 'Corte de Energia', 'Corte de fornecimento de energia elétrica', 15, 60.00, false, 'Power', '#ef4444'),
  ('RELIGA', 'Religação de Energia', 'Religação de fornecimento de energia elétrica', 10, 50.00, false, 'Zap', '#10b981'),
  ('INSPEÇÃO', 'Inspeção Técnica', 'Inspeção técnica em instalações elétricas', 30, 80.00, true, 'Search', '#3b82f6');

