-- Tabela de pontos de saída
CREATE TABLE public.pontos_saida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pontos_saida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pontos_saida" 
ON public.pontos_saida FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage pontos_saida" 
ON public.pontos_saida FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Tabela de polígonos/áreas
CREATE TABLE public.poligonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#3B82F6',
  coordenadas JSONB NOT NULL DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.poligonos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view poligonos" 
ON public.poligonos FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage poligonos" 
ON public.poligonos FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Tabela de checklists
CREATE TABLE public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo_servico TEXT NOT NULL,
  itens JSONB NOT NULL DEFAULT '[]',
  obrigatorio BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklists" 
ON public.checklists FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage checklists" 
ON public.checklists FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_pontos_saida_updated_at
  BEFORE UPDATE ON public.pontos_saida
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_poligonos_updated_at
  BEFORE UPDATE ON public.poligonos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();