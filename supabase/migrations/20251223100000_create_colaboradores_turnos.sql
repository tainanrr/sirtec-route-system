-- =====================================================
-- NOVA ESTRUTURA: Colaboradores, Vínculos e Turnos
-- =====================================================
-- Esta migração cria a nova estrutura para:
-- 1. Colaboradores individuais (com CPF como identificador)
-- 2. Vínculo colaborador-equipe
-- 3. Turnos de trabalho
-- 4. Colaboradores que trabalharam em cada turno

-- =====================================================
-- 1. TABELA DE COLABORADORES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf VARCHAR(14) NOT NULL UNIQUE, -- CPF formatado: 000.000.000-00
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255),
  cargo VARCHAR(100), -- Ex: Eletricista, Ajudante, Motorista
  data_admissao DATE,
  data_demissao DATE,
  ativo BOOLEAN DEFAULT true,
  foto_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON public.colaboradores(cpf);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON public.colaboradores(nome);
CREATE INDEX IF NOT EXISTS idx_colaboradores_ativo ON public.colaboradores(ativo);

-- Comentários
COMMENT ON TABLE public.colaboradores IS 'Cadastro individual de colaboradores (usuários do app)';
COMMENT ON COLUMN public.colaboradores.cpf IS 'CPF do colaborador - usado como login no app';

-- =====================================================
-- 2. VÍNCULO COLABORADOR-EQUIPE (MEMBROS DA EQUIPE)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.equipe_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  funcao VARCHAR(50) DEFAULT 'membro', -- 'lider', 'membro', 'motorista'
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(equipe_id, colaborador_id, data_inicio) -- Evita duplicatas
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_equipe_colaboradores_equipe ON public.equipe_colaboradores(equipe_id);
CREATE INDEX IF NOT EXISTS idx_equipe_colaboradores_colaborador ON public.equipe_colaboradores(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_equipe_colaboradores_ativo ON public.equipe_colaboradores(ativo);

COMMENT ON TABLE public.equipe_colaboradores IS 'Vínculo entre colaboradores e equipes';

-- =====================================================
-- 3. ADICIONAR CAMPOS NA TABELA DE EQUIPES (tecnicos)
-- =====================================================
-- Placa padrão do veículo (pode ser alterada na abertura do turno)
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS placa_veiculo VARCHAR(10);
-- Senha removida - login será apenas por código da equipe + placa
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS login_ativo BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.tecnicos.placa_veiculo IS 'Placa padrão do veículo da equipe';
COMMENT ON COLUMN public.tecnicos.login_ativo IS 'Se a equipe pode fazer login no app';

-- =====================================================
-- 4. TABELA DE TURNOS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id),
  data_turno DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_fim TIMESTAMPTZ,
  placa_veiculo VARCHAR(10) NOT NULL, -- Placa informada na abertura
  km_inicial INTEGER,
  km_final INTEGER,
  status VARCHAR(20) DEFAULT 'aberto', -- 'aberto', 'fechado', 'cancelado'
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Evitar múltiplos turnos abertos para mesma equipe
  CONSTRAINT uq_turno_equipe_aberto UNIQUE (equipe_id, data_turno, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_turnos_equipe ON public.turnos(equipe_id);
CREATE INDEX IF NOT EXISTS idx_turnos_data ON public.turnos(data_turno);
CREATE INDEX IF NOT EXISTS idx_turnos_status ON public.turnos(status);

COMMENT ON TABLE public.turnos IS 'Registro de turnos de trabalho das equipes';

-- =====================================================
-- 5. COLABORADORES DO TURNO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.turno_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
  funcao_turno VARCHAR(50), -- Função específica neste turno
  hora_entrada TIMESTAMPTZ DEFAULT NOW(),
  hora_saida TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(turno_id, colaborador_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_turno_colaboradores_turno ON public.turno_colaboradores(turno_id);
CREATE INDEX IF NOT EXISTS idx_turno_colaboradores_colaborador ON public.turno_colaboradores(colaborador_id);

COMMENT ON TABLE public.turno_colaboradores IS 'Colaboradores que trabalharam em cada turno';

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

-- Colaboradores
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colaboradores_select" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_all" ON public.colaboradores;
CREATE POLICY "colaboradores_all_access" ON public.colaboradores 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Equipe Colaboradores
ALTER TABLE public.equipe_colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipe_colaboradores_select" ON public.equipe_colaboradores;
DROP POLICY IF EXISTS "equipe_colaboradores_all" ON public.equipe_colaboradores;
CREATE POLICY "equipe_colaboradores_all_access" ON public.equipe_colaboradores 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Turnos
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "turnos_select" ON public.turnos;
DROP POLICY IF EXISTS "turnos_all" ON public.turnos;
CREATE POLICY "turnos_all_access" ON public.turnos 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Turno Colaboradores
ALTER TABLE public.turno_colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "turno_colaboradores_select" ON public.turno_colaboradores;
DROP POLICY IF EXISTS "turno_colaboradores_all" ON public.turno_colaboradores;
CREATE POLICY "turno_colaboradores_all_access" ON public.turno_colaboradores 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 7. FUNÇÃO PARA VALIDAR LOGIN DA EQUIPE
-- =====================================================
CREATE OR REPLACE FUNCTION public.validar_login_equipe(
  p_codigo_equipe TEXT,
  p_placa_veiculo TEXT
)
RETURNS TABLE (
  equipe_id UUID,
  equipe_nome TEXT,
  equipe_codigo TEXT,
  placa_informada TEXT,
  colaboradores JSON
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as equipe_id,
    t.nome as equipe_nome,
    t.codigo as equipe_codigo,
    p_placa_veiculo as placa_informada,
    COALESCE(
      (SELECT json_agg(json_build_object(
        'id', c.id,
        'cpf', c.cpf,
        'nome', c.nome,
        'cargo', c.cargo,
        'funcao', ec.funcao
      ))
      FROM public.equipe_colaboradores ec
      JOIN public.colaboradores c ON c.id = ec.colaborador_id
      WHERE ec.equipe_id = t.id 
        AND ec.ativo = true 
        AND c.ativo = true),
      '[]'::json
    ) as colaboradores
  FROM public.tecnicos t
  WHERE t.codigo = p_codigo_equipe
    AND t.login_ativo = true
    AND (t.status = 'disponivel' OR t.status = 'em_rota');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.validar_login_equipe IS 'Valida login da equipe e retorna colaboradores vinculados';

-- =====================================================
-- 8. FUNÇÃO PARA ABRIR TURNO
-- =====================================================
CREATE OR REPLACE FUNCTION public.abrir_turno(
  p_equipe_id UUID,
  p_placa_veiculo TEXT,
  p_colaboradores_ids UUID[],
  p_km_inicial INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_turno_id UUID;
  v_colaborador_id UUID;
BEGIN
  -- Verificar se já existe turno aberto para esta equipe hoje
  IF EXISTS (
    SELECT 1 FROM public.turnos 
    WHERE equipe_id = p_equipe_id 
      AND data_turno = CURRENT_DATE 
      AND status = 'aberto'
  ) THEN
    RAISE EXCEPTION 'Já existe um turno aberto para esta equipe hoje';
  END IF;

  -- Criar o turno
  INSERT INTO public.turnos (equipe_id, placa_veiculo, km_inicial, status)
  VALUES (p_equipe_id, p_placa_veiculo, p_km_inicial, 'aberto')
  RETURNING id INTO v_turno_id;

  -- Adicionar colaboradores ao turno
  FOREACH v_colaborador_id IN ARRAY p_colaboradores_ids
  LOOP
    INSERT INTO public.turno_colaboradores (turno_id, colaborador_id)
    VALUES (v_turno_id, v_colaborador_id);
  END LOOP;

  -- Atualizar status da equipe
  UPDATE public.tecnicos 
  SET status = 'em_rota', updated_at = NOW()
  WHERE id = p_equipe_id;

  RETURN v_turno_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.abrir_turno IS 'Abre um novo turno para a equipe com os colaboradores selecionados';

-- =====================================================
-- 9. FUNÇÃO PARA FECHAR TURNO
-- =====================================================
CREATE OR REPLACE FUNCTION public.fechar_turno(
  p_turno_id UUID,
  p_km_final INTEGER DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_equipe_id UUID;
BEGIN
  -- Buscar equipe do turno
  SELECT equipe_id INTO v_equipe_id 
  FROM public.turnos 
  WHERE id = p_turno_id AND status = 'aberto';

  IF v_equipe_id IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado ou já fechado';
  END IF;

  -- Fechar o turno
  UPDATE public.turnos
  SET 
    status = 'fechado',
    hora_fim = NOW(),
    km_final = p_km_final,
    observacoes = COALESCE(p_observacoes, observacoes),
    updated_at = NOW()
  WHERE id = p_turno_id;

  -- Registrar hora de saída dos colaboradores
  UPDATE public.turno_colaboradores
  SET hora_saida = NOW()
  WHERE turno_id = p_turno_id AND hora_saida IS NULL;

  -- Atualizar status da equipe
  UPDATE public.tecnicos 
  SET status = 'disponivel', updated_at = NOW()
  WHERE id = v_equipe_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.fechar_turno IS 'Fecha um turno aberto';

-- =====================================================
-- 10. PERMISSÕES PARA O SISTEMA
-- =====================================================
INSERT INTO public.permissoes (codigo, nome, modulo, tipo) VALUES
('cadastros.colaboradores', 'Cadastro de Colaboradores', 'cadastros', 'tela'),
('app.turnos', 'Gerenciar Turnos', 'app', 'funcao')
ON CONFLICT (codigo) DO NOTHING;

