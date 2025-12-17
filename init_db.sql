-- ============================================================================
-- SCRIPT DE INICIALIZAÇÃO DO BANCO DE DADOS - SISTEMA DE ROTEIRIZAÇÃO
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para criar toda a estrutura
-- ============================================================================

-- ============================================================================
-- 1. LIMPEZA: Remover tabelas existentes (em ordem de dependência)
-- ============================================================================

DROP TABLE IF EXISTS public.alertas CASCADE;
DROP TABLE IF EXISTS public.rotas CASCADE;
DROP TABLE IF EXISTS public.ordens_servico CASCADE;
DROP TABLE IF EXISTS public.tecnicos CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Remover função de trigger se existir
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ============================================================================
-- 2. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Função para criar perfil automaticamente ao criar usuário
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

-- ============================================================================
-- 3. TABELA: profiles (Perfis de Usuários)
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  cargo TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles (acesso público durante desenvolvimento)
CREATE POLICY "Public access to profiles"
ON public.profiles FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. TABELA: tecnicos (Equipes/Técnicos)
-- ============================================================================

CREATE TABLE public.tecnicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  telefone TEXT,
  habilidades TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'disponivel',
  
  -- Configurações de Jornada e Roteirização
  hora_inicio TEXT DEFAULT '07:30',
  jornada_horas INTEGER DEFAULT 8,
  max_horas_trabalho INTEGER DEFAULT 10,
  
  -- Configuração de Almoço (JSONB)
  almoco JSONB DEFAULT '{"duracao": 60, "janelaInicio": "11:00", "janelaFim": "14:00"}'::jsonb,
  
  -- Localizações
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  local_partida JSONB, -- {lat: number, lng: number} - Casa do técnico
  local_chegada JSONB, -- {lat: number, lng: number} - Ponto de retorno
  
  -- Visualização
  color TEXT DEFAULT '#3b82f6',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tecnicos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tecnicos (acesso público durante desenvolvimento)
CREATE POLICY "Public access to tecnicos"
ON public.tecnicos FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_tecnicos_updated_at
  BEFORE UPDATE ON public.tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON COLUMN public.tecnicos.hora_inicio IS 'Horário de início do dia de trabalho (formato HH:mm)';
COMMENT ON COLUMN public.tecnicos.almoco IS 'Configuração de almoço: {duracao: minutos, janelaInicio: HH:mm, janelaFim: HH:mm}';
COMMENT ON COLUMN public.tecnicos.local_partida IS 'Localização de partida (casa do técnico): {lat: number, lng: number}';
COMMENT ON COLUMN public.tecnicos.local_chegada IS 'Localização de chegada (ponto de retorno): {lat: number, lng: number}';
COMMENT ON COLUMN public.tecnicos.latitude IS 'Latitude da base/escritório (usado se local_partida não definido)';
COMMENT ON COLUMN public.tecnicos.longitude IS 'Longitude da base/escritório (usado se local_partida não definido)';
COMMENT ON COLUMN public.tecnicos.jornada_horas IS 'Horas disponíveis por dia (padrão 8h)';
COMMENT ON COLUMN public.tecnicos.max_horas_trabalho IS 'Capacidade máxima de trabalho (ex: 10h)';
COMMENT ON COLUMN public.tecnicos.color IS 'Cor hexadecimal para visualização no mapa';

-- ============================================================================
-- 5. TABELA: ordens_servico (Ordens de Serviço)
-- ============================================================================

CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  endereco TEXT NOT NULL,
  
  -- Dados do Cliente
  cliente_nome TEXT,
  cliente_cpf TEXT,
  instalacao TEXT,
  medidor TEXT,
  
  -- Localização
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  
  -- Prioridade e Prazos
  prazo TIMESTAMP WITH TIME ZONE,
  prioridade TEXT DEFAULT 'NORMAL', -- 'ALTA' ou 'NORMAL'
  regulada BOOLEAN DEFAULT false,
  
  -- Janelas de Atendimento (opcional)
  janela_inicio TIMESTAMP WITH TIME ZONE,
  janela_fim TIMESTAMP WITH TIME ZONE,
  
  -- Execução
  duracao_estimada INTEGER DEFAULT 30, -- em minutos
  valor DECIMAL(10,2),
  tecnico_id UUID REFERENCES public.tecnicos(id) ON DELETE SET NULL,
  ordem_na_rota INTEGER, -- Posição na rota da equipe
  horario_agendado TIMESTAMP WITH TIME ZONE,
  
  -- Controle de Tempo Real
  iniciado_at TIMESTAMP WITH TIME ZONE,
  pausado_at TIMESTAMP WITH TIME ZONE,
  concluido_at TIMESTAMP WITH TIME ZONE,
  tempo_total_minutos INTEGER,
  
  -- Observações
  observacoes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ordens_servico (acesso público durante desenvolvimento)
CREATE POLICY "Public access to ordens_servico"
ON public.ordens_servico FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_ordens_servico_status ON public.ordens_servico(status);
CREATE INDEX idx_ordens_servico_tipo ON public.ordens_servico(tipo);
CREATE INDEX idx_ordens_servico_prazo ON public.ordens_servico(prazo);
CREATE INDEX idx_ordens_servico_tecnico_id ON public.ordens_servico(tecnico_id);

-- ============================================================================
-- 6. TABELA: rotas (Rotas Planejadas)
-- ============================================================================

CREATE TABLE public.rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  tecnico_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'planejada',
  distancia_km DECIMAL(10,2),
  duracao_estimada TEXT,
  faturamento_estimado DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para rotas (acesso público durante desenvolvimento)
CREATE POLICY "Public access to rotas"
ON public.rotas FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_rotas_updated_at
  BEFORE UPDATE ON public.rotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 7. TABELA: alertas (Alertas do Sistema)
-- ============================================================================

CREATE TABLE public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL DEFAULT 'medium',
  titulo TEXT NOT NULL,
  descricao TEXT,
  tecnico_id UUID REFERENCES public.tecnicos(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  resolvido BOOLEAN DEFAULT false,
  resolvido_at TIMESTAMP WITH TIME ZONE,
  resolvido_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para alertas (acesso público durante desenvolvimento)
CREATE POLICY "Public access to alertas"
ON public.alertas FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 8. DADOS INICIAIS (SEED DATA)
-- ============================================================================

-- Coordenadas base (Vitória da Conquista, BA)
-- BASE_LAT = -14.8661
-- BASE_LNG = -40.8394

-- Inserir 3 Equipes com configurações diferentes para testar setorização
-- Nota: IDs serão gerados automaticamente pelo banco (gen_random_uuid())
INSERT INTO public.tecnicos (codigo, nome, habilidades, status, hora_inicio, jornada_horas, max_horas_trabalho, latitude, longitude, local_partida, local_chegada, almoco, color) VALUES
-- Equipe 1: Centro (com todas as habilidades)
('EQ-001', 'João Silva', ARRAY['CORTE', 'RELIGA', 'INSPEÇÃO'], 'disponivel', '07:30', 8, 10, 
 -14.8661, -40.8394,
 '{"lat": -14.8661, "lng": -40.8394}'::jsonb,
 NULL,
 '{"duracao": 60, "janelaInicio": "11:00", "janelaFim": "14:00"}'::jsonb,
 '#3b82f6'),

-- Equipe 2: Norte (CORTE e RELIGA apenas)
('EQ-002', 'Pedro Costa', ARRAY['CORTE', 'RELIGA'], 'disponivel', '07:30', 8, 10,
 -14.8500, -40.8300,
 '{"lat": -14.8500, "lng": -40.8300}'::jsonb,
 NULL,
 '{"duracao": 60, "janelaInicio": "12:00", "janelaFim": "14:00"}'::jsonb,
 '#10b981'),

-- Equipe 3: Sul (CORTE e INSPEÇÃO)
('EQ-003', 'Maria Santos', ARRAY['CORTE', 'INSPEÇÃO'], 'disponivel', '08:00', 8, 10,
 -14.8800, -40.8500,
 '{"lat": -14.8800, "lng": -40.8500}'::jsonb,
 NULL,
 '{"duracao": 45, "janelaInicio": "11:30", "janelaFim": "13:30"}'::jsonb,
 '#f59e0b');

-- Inserir 50 Ordens de Serviço
-- 10 com prazo para hoje, 40 normais
-- Coordenadas aleatórias em Vitória da Conquista, BA
-- Centro: -14.8661, -40.8394 | Área: ~15km de raio (0.135 graus)
INSERT INTO public.ordens_servico (numero, tipo, status, endereco, latitude, longitude, prazo, prioridade, regulada, duracao_estimada, valor, cliente_nome) VALUES
-- 10 Ordens Urgentes (com prazo aleatório entre 8h e 20h)
-- Nota: Os prazos serão gerados aleatoriamente entre 8h e 20h usando random()
-- Coordenadas aleatórias em Vitória da Conquista
('#45821', 'CORTE', 'pendente', 'Rua das Flores, 123 - Centro', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 15, 60.00, 'Cliente Urgente 1'),
('#45822', 'RELIGA', 'pendente', 'Av. Paulista, 456 - Bela Vista', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 10, 50.00, 'Cliente Urgente 2'),
('#45823', 'INSPEÇÃO', 'pendente', 'Rua Augusta, 789 - Consolação', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 30, 80.00, 'Cliente Urgente 3'),
('#45824', 'CORTE', 'pendente', 'Rua Haddock Lobo, 321 - Cerqueira César', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 15, 65.00, 'Cliente Urgente 4'),
('#45825', 'RELIGA', 'pendente', 'Av. Rebouças, 654 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 10, 55.00, 'Cliente Urgente 5'),
('#45826', 'INSPEÇÃO', 'pendente', 'Rua dos Pinheiros, 987 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 30, 85.00, 'Cliente Urgente 6'),
('#45827', 'CORTE', 'pendente', 'Rua Teodoro Sampaio, 147 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 15, 70.00, 'Cliente Urgente 7'),
('#45828', 'RELIGA', 'pendente', 'Av. Faria Lima, 258 - Itaim Bibi', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 10, 60.00, 'Cliente Urgente 8'),
('#45829', 'INSPEÇÃO', 'pendente', 'Rua Bandeira Paulista, 369 - Itaim Bibi', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 30, 90.00, 'Cliente Urgente 9'),
('#45830', 'CORTE', 'pendente', 'Av. Brigadeiro Faria Lima, 741 - Jardim Paulistano', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, CURRENT_DATE + INTERVAL '1 hour' * (8 + FLOOR(RANDOM() * 13)::INTEGER), 'ALTA', true, 15, 75.00, 'Cliente Urgente 10'),

-- 40 Ordens Normais (sem prazo, coordenadas aleatórias em Vitória da Conquista)
('#45831', 'RELIGA', 'pendente', 'Rua dos Três Irmãos, 111 - Vila Progredior', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 50.00, 'Cliente Normal 1'),
('#45832', 'CORTE', 'pendente', 'Rua Harmonia, 222 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 60.00, 'Cliente Normal 2'),
('#45833', 'INSPEÇÃO', 'pendente', 'Rua Aspicuelta, 333 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 80.00, 'Cliente Normal 3'),
('#45834', 'RELIGA', 'pendente', 'Rua Fradique Coutinho, 444 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 52.00, 'Cliente Normal 4'),
('#45835', 'CORTE', 'pendente', 'Rua Cardeal Arcoverde, 555 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 62.00, 'Cliente Normal 5'),
('#45836', 'INSPEÇÃO', 'pendente', 'Rua dos Pinheiros, 666 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 82.00, 'Cliente Normal 6'),
('#45837', 'RELIGA', 'pendente', 'Rua Henrique Schaumann, 777 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 54.00, 'Cliente Normal 7'),
('#45838', 'CORTE', 'pendente', 'Rua Pais Leme, 888 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 64.00, 'Cliente Normal 8'),
('#45839', 'INSPEÇÃO', 'pendente', 'Rua dos Pinheiros, 999 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 84.00, 'Cliente Normal 9'),
('#45840', 'RELIGA', 'pendente', 'Rua Teodoro Sampaio, 1010 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 56.00, 'Cliente Normal 10'),

('#45841', 'CORTE', 'pendente', 'Rua dos Pinheiros, 1111 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 66.00, 'Cliente Normal 11'),
('#45842', 'INSPEÇÃO', 'pendente', 'Rua Cardeal Arcoverde, 1212 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 86.00, 'Cliente Normal 12'),
('#45843', 'RELIGA', 'pendente', 'Rua Fradique Coutinho, 1313 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 58.00, 'Cliente Normal 13'),
('#45844', 'CORTE', 'pendente', 'Rua Aspicuelta, 1414 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 68.00, 'Cliente Normal 14'),
('#45845', 'INSPEÇÃO', 'pendente', 'Rua Harmonia, 1515 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 88.00, 'Cliente Normal 15'),
('#45846', 'RELIGA', 'pendente', 'Rua dos Três Irmãos, 1616 - Vila Progredior', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 60.00, 'Cliente Normal 16'),
('#45847', 'CORTE', 'pendente', 'Rua Teodoro Sampaio, 1717 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 70.00, 'Cliente Normal 17'),
('#45848', 'INSPEÇÃO', 'pendente', 'Rua dos Pinheiros, 1818 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 90.00, 'Cliente Normal 18'),
('#45849', 'RELIGA', 'pendente', 'Rua Cardeal Arcoverde, 1919 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 62.00, 'Cliente Normal 19'),
('#45850', 'CORTE', 'pendente', 'Rua Fradique Coutinho, 2020 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 72.00, 'Cliente Normal 20'),

('#45851', 'INSPEÇÃO', 'pendente', 'Rua Aspicuelta, 2121 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 92.00, 'Cliente Normal 21'),
('#45852', 'RELIGA', 'pendente', 'Rua Harmonia, 2222 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 64.00, 'Cliente Normal 22'),
('#45853', 'CORTE', 'pendente', 'Rua dos Três Irmãos, 2323 - Vila Progredior', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 74.00, 'Cliente Normal 23'),
('#45854', 'INSPEÇÃO', 'pendente', 'Rua Teodoro Sampaio, 2424 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 94.00, 'Cliente Normal 24'),
('#45855', 'RELIGA', 'pendente', 'Rua dos Pinheiros, 2525 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 66.00, 'Cliente Normal 25'),
('#45856', 'CORTE', 'pendente', 'Rua Cardeal Arcoverde, 2626 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 76.00, 'Cliente Normal 26'),
('#45857', 'INSPEÇÃO', 'pendente', 'Rua Fradique Coutinho, 2727 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 96.00, 'Cliente Normal 27'),
('#45858', 'RELIGA', 'pendente', 'Rua Aspicuelta, 2828 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 68.00, 'Cliente Normal 28'),
('#45859', 'CORTE', 'pendente', 'Rua Harmonia, 2929 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 78.00, 'Cliente Normal 29'),
('#45860', 'INSPEÇÃO', 'pendente', 'Rua dos Três Irmãos, 3030 - Vila Progredior', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 98.00, 'Cliente Normal 30'),

('#45861', 'RELIGA', 'pendente', 'Rua Teodoro Sampaio, 3131 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 70.00, 'Cliente Normal 31'),
('#45862', 'CORTE', 'pendente', 'Rua dos Pinheiros, 3232 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 80.00, 'Cliente Normal 32'),
('#45863', 'INSPEÇÃO', 'pendente', 'Rua Cardeal Arcoverde, 3333 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 100.00, 'Cliente Normal 33'),
('#45864', 'RELIGA', 'pendente', 'Rua Fradique Coutinho, 3434 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 72.00, 'Cliente Normal 34'),
('#45865', 'CORTE', 'pendente', 'Rua Aspicuelta, 3535 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 82.00, 'Cliente Normal 35'),
('#45866', 'INSPEÇÃO', 'pendente', 'Rua Harmonia, 3636 - Vila Madalena', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 102.00, 'Cliente Normal 36'),
('#45867', 'RELIGA', 'pendente', 'Rua dos Três Irmãos, 3737 - Vila Progredior', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 74.00, 'Cliente Normal 37'),
('#45868', 'CORTE', 'pendente', 'Rua Teodoro Sampaio, 3838 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 15, 84.00, 'Cliente Normal 38'),
('#45869', 'INSPEÇÃO', 'pendente', 'Rua dos Pinheiros, 3939 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 30, 104.00, 'Cliente Normal 39'),
('#45870', 'RELIGA', 'pendente', 'Rua Cardeal Arcoverde, 4040 - Pinheiros', -14.8661 + (RANDOM() - 0.5) * 0.135, -40.8394 + (RANDOM() - 0.5) * 0.135, NULL, 'NORMAL', false, 10, 76.00, 'Cliente Normal 40');

-- Adicionar algumas ordens com janelas de atendimento restritas
UPDATE public.ordens_servico 
SET janela_inicio = NOW() + INTERVAL '1 hour',
    janela_fim = NOW() + INTERVAL '3 hours'
WHERE numero IN ('#45821', '#45822', '#45823');

UPDATE public.ordens_servico 
SET janela_inicio = NOW() + INTERVAL '2 hours',
    janela_fim = NOW() + INTERVAL '5 hours'
WHERE numero IN ('#45824', '#45825', '#45826');

-- ============================================================================
-- 9. CRIAR USUÁRIO DE TESTE
-- ============================================================================
-- 
-- IMPORTANTE: No Supabase, usuários devem ser criados via Dashboard ou API
-- O método SQL direto não funciona por questões de segurança.
--
-- OPÇÃO 1: Via Dashboard do Supabase (RECOMENDADO):
-- ====================================================
-- 1. Acesse: https://app.supabase.com > Seu Projeto
-- 2. Vá em: Authentication > Users
-- 3. Clique em: "Add User" > "Create new user"
-- 4. Preencha:
--    - Email: admin@roteirizador.com
--    - Password: admin123
--    - Marque: "Auto Confirm User" (importante!)
-- 5. Clique em: "Create User"
--
-- OPÇÃO 2: Via SQL (após criar usuário no Dashboard):
-- ====================================================
-- Se você já criou o usuário via Dashboard, execute este SQL para criar o perfil:
-- (Substitua USER_ID pelo ID do usuário criado)
--
-- INSERT INTO public.profiles (user_id, nome_completo, cargo)
-- SELECT id, 'Administrador', 'Admin'
-- FROM auth.users
-- WHERE email = 'admin@roteirizador.com';
--
-- ============================================================================
-- CREDENCIAIS DE TESTE:
-- ============================================================================
-- Email: admin@roteirizador.com
-- Senha: admin123
-- ============================================================================

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
-- Verificação: Execute estas queries para confirmar que tudo foi criado:
-- SELECT COUNT(*) FROM public.tecnicos; -- Deve retornar 3
-- SELECT COUNT(*) FROM public.ordens_servico; -- Deve retornar 50
-- SELECT COUNT(*) FROM public.ordens_servico WHERE prazo IS NOT NULL; -- Deve retornar 10
-- SELECT email FROM auth.users; -- Deve mostrar o usuário criado
-- ============================================================================

