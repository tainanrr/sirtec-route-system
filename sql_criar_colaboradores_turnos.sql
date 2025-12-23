-- =====================================================
-- EXECUTE ESTE SCRIPT NO SUPABASE DASHBOARD (SQL Editor)
-- Cria estrutura de Colaboradores e Turnos
-- =====================================================

-- 1. TABELA DE COLABORADORES
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf VARCHAR(14) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255),
  cargo VARCHAR(100),
  data_admissao DATE,
  data_demissao DATE,
  ativo BOOLEAN DEFAULT true,
  foto_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON public.colaboradores(cpf);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON public.colaboradores(nome);
CREATE INDEX IF NOT EXISTS idx_colaboradores_ativo ON public.colaboradores(ativo);

-- 2. VÍNCULO COLABORADOR-EQUIPE
CREATE TABLE IF NOT EXISTS public.equipe_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  funcao VARCHAR(50) DEFAULT 'membro',
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(equipe_id, colaborador_id, data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_equipe_colaboradores_equipe ON public.equipe_colaboradores(equipe_id);
CREATE INDEX IF NOT EXISTS idx_equipe_colaboradores_colaborador ON public.equipe_colaboradores(colaborador_id);

-- 3. ADICIONAR CAMPOS NA TABELA DE EQUIPES
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS placa_veiculo VARCHAR(10);
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS login_ativo BOOLEAN DEFAULT true;

-- 4. TABELA DE TURNOS
CREATE TABLE IF NOT EXISTS public.turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id),
  data_turno DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_fim TIMESTAMPTZ,
  placa_veiculo VARCHAR(10) NOT NULL,
  km_inicial INTEGER,
  km_final INTEGER,
  status VARCHAR(20) DEFAULT 'aberto',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_equipe ON public.turnos(equipe_id);
CREATE INDEX IF NOT EXISTS idx_turnos_data ON public.turnos(data_turno);
CREATE INDEX IF NOT EXISTS idx_turnos_status ON public.turnos(status);

-- 5. COLABORADORES DO TURNO
CREATE TABLE IF NOT EXISTS public.turno_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
  funcao_turno VARCHAR(50),
  hora_entrada TIMESTAMPTZ DEFAULT NOW(),
  hora_saida TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(turno_id, colaborador_id)
);

CREATE INDEX IF NOT EXISTS idx_turno_colaboradores_turno ON public.turno_colaboradores(turno_id);
CREATE INDEX IF NOT EXISTS idx_turno_colaboradores_colaborador ON public.turno_colaboradores(colaborador_id);

-- 6. RLS POLICIES
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colaboradores_all_access" ON public.colaboradores;
CREATE POLICY "colaboradores_all_access" ON public.colaboradores 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.equipe_colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipe_colaboradores_all_access" ON public.equipe_colaboradores;
CREATE POLICY "equipe_colaboradores_all_access" ON public.equipe_colaboradores 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "turnos_all_access" ON public.turnos;
CREATE POLICY "turnos_all_access" ON public.turnos 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.turno_colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "turno_colaboradores_all_access" ON public.turno_colaboradores;
CREATE POLICY "turno_colaboradores_all_access" ON public.turno_colaboradores 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. FUNÇÃO PARA VALIDAR LOGIN DA EQUIPE
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

-- 8. FUNÇÃO PARA ABRIR TURNO
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
  IF EXISTS (
    SELECT 1 FROM public.turnos 
    WHERE equipe_id = p_equipe_id 
      AND data_turno = CURRENT_DATE 
      AND status = 'aberto'
  ) THEN
    RAISE EXCEPTION 'Já existe um turno aberto para esta equipe hoje';
  END IF;

  INSERT INTO public.turnos (equipe_id, placa_veiculo, km_inicial, status)
  VALUES (p_equipe_id, p_placa_veiculo, p_km_inicial, 'aberto')
  RETURNING id INTO v_turno_id;

  FOREACH v_colaborador_id IN ARRAY p_colaboradores_ids
  LOOP
    INSERT INTO public.turno_colaboradores (turno_id, colaborador_id)
    VALUES (v_turno_id, v_colaborador_id);
  END LOOP;

  UPDATE public.tecnicos 
  SET status = 'em_rota', updated_at = NOW()
  WHERE id = p_equipe_id;

  RETURN v_turno_id;
END;
$$ LANGUAGE plpgsql;

-- 9. FUNÇÃO PARA FECHAR TURNO
CREATE OR REPLACE FUNCTION public.fechar_turno(
  p_turno_id UUID,
  p_km_final INTEGER DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_equipe_id UUID;
BEGIN
  SELECT equipe_id INTO v_equipe_id 
  FROM public.turnos 
  WHERE id = p_turno_id AND status = 'aberto';

  IF v_equipe_id IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado ou já fechado';
  END IF;

  UPDATE public.turnos
  SET 
    status = 'fechado',
    hora_fim = NOW(),
    km_final = p_km_final,
    observacoes = COALESCE(p_observacoes, observacoes),
    updated_at = NOW()
  WHERE id = p_turno_id;

  UPDATE public.turno_colaboradores
  SET hora_saida = NOW()
  WHERE turno_id = p_turno_id AND hora_saida IS NULL;

  UPDATE public.tecnicos 
  SET status = 'disponivel', updated_at = NOW()
  WHERE id = v_equipe_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 10. PERMISSÕES
INSERT INTO public.permissoes (codigo, nome, modulo, tipo) VALUES
('cadastros.colaboradores', 'Cadastro de Colaboradores', 'cadastros', 'tela'),
('app.turnos', 'Gerenciar Turnos', 'app', 'funcao')
ON CONFLICT (codigo) DO NOTHING;

-- Verificar
SELECT 'Estrutura criada com sucesso!' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('colaboradores', 'equipe_colaboradores', 'turnos', 'turno_colaboradores');

