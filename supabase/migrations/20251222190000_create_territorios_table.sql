-- Tabela de territórios
CREATE TABLE public.territorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3B82F6',
  poligono JSONB NOT NULL DEFAULT '[]',
  equipe_ids UUID[] DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_territorios_ativo ON public.territorios(ativo);
CREATE INDEX idx_territorios_equipe_ids ON public.territorios USING GIN(equipe_ids);

-- Enable RLS
ALTER TABLE public.territorios ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view territorios" 
ON public.territorios FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage territorios" 
ON public.territorios FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_territorios_updated_at
  BEFORE UPDATE ON public.territorios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.territorios IS 'Territórios/áreas geográficas para roteirização';
COMMENT ON COLUMN public.territorios.poligono IS 'Array de coordenadas [{lat, lng}, ...] em JSONB';
COMMENT ON COLUMN public.territorios.equipe_ids IS 'Array de UUIDs das equipes vinculadas ao território';

