-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  cargo TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view all profiles" 
ON public.profiles FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome_completo)
  VALUES (new.id, new.raw_user_meta_data ->> 'nome_completo');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tabela de técnicos/equipes
CREATE TABLE public.tecnicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  telefone TEXT,
  habilidades TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'disponivel',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tecnicos" 
ON public.tecnicos FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage tecnicos" 
ON public.tecnicos FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Tabela de ordens de serviço
CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  endereco TEXT NOT NULL,
  cliente_nome TEXT,
  cliente_cpf TEXT,
  instalacao TEXT,
  medidor TEXT,
  prazo TIMESTAMP WITH TIME ZONE,
  duracao_estimada INTEGER DEFAULT 30,
  valor DECIMAL(10,2),
  regulada BOOLEAN DEFAULT false,
  tecnico_id UUID REFERENCES public.tecnicos(id),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ordens" 
ON public.ordens_servico FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage ordens" 
ON public.ordens_servico FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Tabela de rotas
CREATE TABLE public.rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  tecnico_id UUID NOT NULL REFERENCES public.tecnicos(id),
  status TEXT NOT NULL DEFAULT 'planejada',
  distancia_km DECIMAL(10,2),
  duracao_estimada TEXT,
  faturamento_estimado DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rotas" 
ON public.rotas FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage rotas" 
ON public.rotas FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Tabela de alertas
CREATE TABLE public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL DEFAULT 'medium',
  titulo TEXT NOT NULL,
  descricao TEXT,
  tecnico_id UUID REFERENCES public.tecnicos(id),
  ordem_servico_id UUID REFERENCES public.ordens_servico(id),
  resolvido BOOLEAN DEFAULT false,
  resolvido_at TIMESTAMP WITH TIME ZONE,
  resolvido_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view alertas" 
ON public.alertas FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage alertas" 
ON public.alertas FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tecnicos_updated_at
  BEFORE UPDATE ON public.tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rotas_updated_at
  BEFORE UPDATE ON public.rotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();