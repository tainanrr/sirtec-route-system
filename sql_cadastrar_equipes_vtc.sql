-- ===========================================
-- Script para cadastrar equipes de Vitória da Conquista
-- ===========================================

-- Configurações:
-- Mínimo colaboradores: 1
-- Máximo colaboradores: 2
-- Tipo: normal
-- Jornada início: 07:30
-- Jornada horas: 8
-- Máximo horas trabalho: 10
-- Almoço: 90 minutos, entre 12:00 e 14:00
-- Localização: -14.91202219, -40.87104241

-- Primeiro, garantir que as colunas necessárias existem
ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS almoco JSONB DEFAULT '{"duracao": 60, "janelaInicio": "11:00", "janelaFim": "14:00"}';

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS login_ativo BOOLEAN DEFAULT true;

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS min_colaboradores INTEGER DEFAULT 1;

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS max_colaboradores INTEGER DEFAULT 2;

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS tipo_equipe TEXT DEFAULT 'normal';

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS hora_inicio TEXT DEFAULT '07:30';

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS jornada_horas INTEGER DEFAULT 8;

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS max_horas_trabalho INTEGER DEFAULT 10;

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS latitude NUMERIC;

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';

ALTER TABLE public.tecnicos 
ADD COLUMN IF NOT EXISTS placa_veiculo TEXT;

-- Função auxiliar para inserir ou atualizar equipe
CREATE OR REPLACE FUNCTION upsert_equipe(
  p_codigo TEXT,
  p_nome TEXT,
  p_color TEXT,
  p_placa TEXT,
  p_skills TEXT[]
) RETURNS VOID AS $$
BEGIN
  -- Tentar atualizar primeiro
  UPDATE public.tecnicos SET
    nome = p_nome,
    status = 'disponivel',
    tipo_equipe = 'normal',
    hora_inicio = '07:30',
    jornada_horas = 8,
    max_horas_trabalho = 10,
    latitude = -14.91202219,
    longitude = -40.87104241,
    color = p_color,
    placa_veiculo = p_placa,
    min_colaboradores = 1,
    max_colaboradores = 2,
    habilidades = p_skills,
    almoco = '{"duracao": 90, "janelaInicio": "12:00", "janelaFim": "14:00"}'::JSONB,
    login_ativo = true,
    updated_at = NOW()
  WHERE codigo = p_codigo;
  
  -- Se não atualizou nenhuma linha, inserir
  IF NOT FOUND THEN
    INSERT INTO public.tecnicos (codigo, nome, status, tipo_equipe, hora_inicio, jornada_horas, max_horas_trabalho, 
      latitude, longitude, color, placa_veiculo, min_colaboradores, max_colaboradores, habilidades, almoco, login_ativo)
    VALUES (p_codigo, p_nome, 'disponivel', 'normal', '07:30', 8, 10,
      -14.91202219, -40.87104241, p_color, p_placa, 1, 2, 
      p_skills, '{"duracao": 90, "janelaInicio": "12:00", "janelaFim": "14:00"}'::JSONB, true);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Cadastrar/Atualizar as equipes
DO $$
DECLARE
  v_skills TEXT[];
BEGIN
  -- Buscar todas as skills ativas
  SELECT ARRAY_AGG(codigo) INTO v_skills
  FROM public.skills
  WHERE ativo = true;
  
  IF v_skills IS NULL THEN
    v_skills := ARRAY[]::TEXT[];
  END IF;

  -- Equipe 1: 4ST002
  PERFORM upsert_equipe('4ST002', 'ALEX RODRIGUES DOS SANTOS SOUZA', '#E53935', 'JDC2G14', v_skills);
  
  -- Equipe 2: 4ST004
  PERFORM upsert_equipe('4ST004', 'GILDASIO RODRIGUES BRITO', '#D81B60', 'JCY6B00', v_skills);
  
  -- Equipe 3: 4ST005
  PERFORM upsert_equipe('4ST005', 'JORGE LIMA SANTOS', '#8E24AA', 'TID7C25', v_skills);
  
  -- Equipe 4: 4ST006
  PERFORM upsert_equipe('4ST006', 'RICARDO AZEVEDO SOUSA', '#5E35B1', 'QXG3A53', v_skills);
  
  -- Equipe 5: 4ST008
  PERFORM upsert_equipe('4ST008', 'ALESSANDRO DOS SANTOS CARMO MEIRA', '#3949AB', 'SBD4D83', v_skills);
  
  -- Equipe 6: 4ST009
  PERFORM upsert_equipe('4ST009', 'VANDERLEISON COSTA PEREIRA', '#1E88E5', 'GGI7E12', v_skills);
  
  -- Equipe 7: 4ST00C
  PERFORM upsert_equipe('4ST00C', 'AGNALDO NOVAES DOS SANTOS', '#039BE5', 'JCY7C91', v_skills);
  
  -- Equipe 8: 4ST00D
  PERFORM upsert_equipe('4ST00D', 'GERLAN VIEIRA SILVA', '#00ACC1', 'JCY7D61', v_skills);
  
  -- Equipe 9: 4ST00E
  PERFORM upsert_equipe('4ST00E', 'JOALISON DOS SANTOS FREITAS', '#00897B', 'IYM5232', v_skills);
  
  -- Equipe 10: 4ST00H
  PERFORM upsert_equipe('4ST00H', 'DURVALINO SALES DE OLIVEIRA', '#43A047', 'SAZ0F83', v_skills);
  
  -- Equipe 11: 4ST00I
  PERFORM upsert_equipe('4ST00I', 'REINALDO SANTOS FARIAS', '#7CB342', 'JCW3G31', v_skills);
  
  -- Equipe 12: 4ST00J
  PERFORM upsert_equipe('4ST00J', 'SILVONEI ANDRADE DE SOUZA', '#C0CA33', 'GFM9F71', v_skills);
  
  -- Equipe 13: 4ST00K
  PERFORM upsert_equipe('4ST00K', 'PAULO SERGIO ALVES DA SILVA', '#FDD835', 'JCY6A26', v_skills);
  
  -- Equipe 14: 4ST00M
  PERFORM upsert_equipe('4ST00M', 'RODRIGO LEAL DE SANTANA', '#FFB300', 'IZJ4D29', v_skills);
  
  -- Equipe 15: 4ST00O
  PERFORM upsert_equipe('4ST00O', 'GABRIEL BAHIA MONTEIRO', '#FB8C00', 'JCY6H48', v_skills);
  
  -- Equipe 16: 4ST00P
  PERFORM upsert_equipe('4ST00P', 'VICTOR VINICIUS DE OLIVEIRA SOUZA', '#F4511E', 'QTU9B58', v_skills);
  
  -- Equipe 17: 4ST01B
  PERFORM upsert_equipe('4ST01B', 'RICARDO VIEIRA DA GUARDA', '#6D4C41', 'JCW3H23', v_skills);
  
  -- Equipe 18: 4ST00Q
  PERFORM upsert_equipe('4ST00Q', 'GILBERTO CAMPOS DOS SANTOS JUNIOR', '#546E7A', 'POM2E79', v_skills);
  
  -- Equipe 19: 4ST00R
  PERFORM upsert_equipe('4ST00R', 'ROGERIO GONCALVES DA SILVA', '#455A64', 'THU3E52', v_skills);
  
  -- Equipe 20: 4ST00S
  PERFORM upsert_equipe('4ST00S', 'RICARDO BATISTA VIANA', '#EC407A', 'IXW6582', v_skills);
  
  -- Equipe 21: 4ST00W
  PERFORM upsert_equipe('4ST00W', 'NADSON SANTOS SILVA', '#AB47BC', 'IZS8C40', v_skills);
  
  -- Equipe 22: 4ST003
  PERFORM upsert_equipe('4ST003', 'ALESSANDRO GONCALVES DA SILVA', '#7E57C2', 'JCY6H67', v_skills);
  
  -- Equipe 23: 4ST00Z
  PERFORM upsert_equipe('4ST00Z', 'DIEGO SANTOS SENA', '#5C6BC0', 'SBD3G03', v_skills);
  
  -- Equipe 24: KT003
  PERFORM upsert_equipe('KT003', 'JAIMILSON NOVAIS PEREIRA', '#26A69A', 'JCY6D36', v_skills);

  RAISE NOTICE 'Equipes cadastradas/atualizadas com sucesso!';
END $$;

-- Remover função temporária
DROP FUNCTION IF EXISTS upsert_equipe(TEXT, TEXT, TEXT, TEXT, TEXT[]);


-- ===========================================
-- PARTE 2: Cadastrar os líderes como colaboradores
-- ===========================================

-- Garantir que a coluna cargo existe
ALTER TABLE public.colaboradores 
ADD COLUMN IF NOT EXISTS cargo TEXT DEFAULT 'Técnico';

-- Função auxiliar para inserir ou atualizar colaborador
CREATE OR REPLACE FUNCTION upsert_colaborador(
  p_cpf TEXT,
  p_nome TEXT
) RETURNS VOID AS $$
BEGIN
  -- Tentar atualizar primeiro
  UPDATE public.colaboradores SET
    nome = p_nome,
    cargo = 'Técnico Líder',
    ativo = true
  WHERE cpf = p_cpf;
  
  -- Se não atualizou nenhuma linha, inserir
  IF NOT FOUND THEN
    INSERT INTO public.colaboradores (cpf, nome, cargo, ativo)
    VALUES (p_cpf, p_nome, 'Técnico Líder', true);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Cadastrar colaboradores
DO $$
BEGIN
  PERFORM upsert_colaborador('00000000001', 'ALEX RODRIGUES DOS SANTOS SOUZA');
  PERFORM upsert_colaborador('00000000002', 'GILDASIO RODRIGUES BRITO');
  PERFORM upsert_colaborador('00000000003', 'JORGE LIMA SANTOS');
  PERFORM upsert_colaborador('00000000004', 'RICARDO AZEVEDO SOUSA');
  PERFORM upsert_colaborador('00000000005', 'ALESSANDRO DOS SANTOS CARMO MEIRA');
  PERFORM upsert_colaborador('00000000006', 'VANDERLEISON COSTA PEREIRA');
  PERFORM upsert_colaborador('00000000007', 'AGNALDO NOVAES DOS SANTOS');
  PERFORM upsert_colaborador('00000000008', 'GERLAN VIEIRA SILVA');
  PERFORM upsert_colaborador('00000000009', 'JOALISON DOS SANTOS FREITAS');
  PERFORM upsert_colaborador('00000000010', 'DURVALINO SALES DE OLIVEIRA');
  PERFORM upsert_colaborador('00000000011', 'REINALDO SANTOS FARIAS');
  PERFORM upsert_colaborador('00000000012', 'SILVONEI ANDRADE DE SOUZA');
  PERFORM upsert_colaborador('00000000013', 'PAULO SERGIO ALVES DA SILVA');
  PERFORM upsert_colaborador('00000000014', 'RODRIGO LEAL DE SANTANA');
  PERFORM upsert_colaborador('00000000015', 'GABRIEL BAHIA MONTEIRO');
  PERFORM upsert_colaborador('00000000016', 'VICTOR VINICIUS DE OLIVEIRA SOUZA');
  PERFORM upsert_colaborador('00000000017', 'RICARDO VIEIRA DA GUARDA');
  PERFORM upsert_colaborador('00000000018', 'GILBERTO CAMPOS DOS SANTOS JUNIOR');
  PERFORM upsert_colaborador('00000000019', 'ROGERIO GONCALVES DA SILVA');
  PERFORM upsert_colaborador('00000000020', 'RICARDO BATISTA VIANA');
  PERFORM upsert_colaborador('00000000021', 'NADSON SANTOS SILVA');
  PERFORM upsert_colaborador('00000000022', 'ALESSANDRO GONCALVES DA SILVA');
  PERFORM upsert_colaborador('00000000023', 'DIEGO SANTOS SENA');
  PERFORM upsert_colaborador('00000000024', 'JAIMILSON NOVAIS PEREIRA');

  RAISE NOTICE 'Colaboradores cadastrados com sucesso!';
END $$;

-- Remover função temporária
DROP FUNCTION IF EXISTS upsert_colaborador(TEXT, TEXT);


-- ===========================================
-- PARTE 3: Vincular colaboradores às equipes
-- ===========================================

-- Garantir que a tabela equipe_colaboradores existe
CREATE TABLE IF NOT EXISTS public.equipe_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  funcao TEXT DEFAULT 'membro',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Função para vincular colaborador à equipe
CREATE OR REPLACE FUNCTION vincular_colaborador_equipe(
  p_equipe_codigo TEXT,
  p_colaborador_nome TEXT
) RETURNS VOID AS $$
DECLARE
  v_equipe_id UUID;
  v_colab_id UUID;
BEGIN
  SELECT id INTO v_equipe_id FROM public.tecnicos WHERE codigo = p_equipe_codigo;
  SELECT id INTO v_colab_id FROM public.colaboradores WHERE nome = p_colaborador_nome LIMIT 1;
  
  IF v_equipe_id IS NOT NULL AND v_colab_id IS NOT NULL THEN
    -- Verificar se já existe
    IF EXISTS (SELECT 1 FROM public.equipe_colaboradores WHERE equipe_id = v_equipe_id AND colaborador_id = v_colab_id) THEN
      -- Atualizar
      UPDATE public.equipe_colaboradores 
      SET funcao = 'lider', ativo = true
      WHERE equipe_id = v_equipe_id AND colaborador_id = v_colab_id;
    ELSE
      -- Inserir
      INSERT INTO public.equipe_colaboradores (equipe_id, colaborador_id, funcao, ativo)
      VALUES (v_equipe_id, v_colab_id, 'lider', true);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Vincular cada líder à sua equipe
DO $$
BEGIN
  PERFORM vincular_colaborador_equipe('4ST002', 'ALEX RODRIGUES DOS SANTOS SOUZA');
  PERFORM vincular_colaborador_equipe('4ST004', 'GILDASIO RODRIGUES BRITO');
  PERFORM vincular_colaborador_equipe('4ST005', 'JORGE LIMA SANTOS');
  PERFORM vincular_colaborador_equipe('4ST006', 'RICARDO AZEVEDO SOUSA');
  PERFORM vincular_colaborador_equipe('4ST008', 'ALESSANDRO DOS SANTOS CARMO MEIRA');
  PERFORM vincular_colaborador_equipe('4ST009', 'VANDERLEISON COSTA PEREIRA');
  PERFORM vincular_colaborador_equipe('4ST00C', 'AGNALDO NOVAES DOS SANTOS');
  PERFORM vincular_colaborador_equipe('4ST00D', 'GERLAN VIEIRA SILVA');
  PERFORM vincular_colaborador_equipe('4ST00E', 'JOALISON DOS SANTOS FREITAS');
  PERFORM vincular_colaborador_equipe('4ST00H', 'DURVALINO SALES DE OLIVEIRA');
  PERFORM vincular_colaborador_equipe('4ST00I', 'REINALDO SANTOS FARIAS');
  PERFORM vincular_colaborador_equipe('4ST00J', 'SILVONEI ANDRADE DE SOUZA');
  PERFORM vincular_colaborador_equipe('4ST00K', 'PAULO SERGIO ALVES DA SILVA');
  PERFORM vincular_colaborador_equipe('4ST00M', 'RODRIGO LEAL DE SANTANA');
  PERFORM vincular_colaborador_equipe('4ST00O', 'GABRIEL BAHIA MONTEIRO');
  PERFORM vincular_colaborador_equipe('4ST00P', 'VICTOR VINICIUS DE OLIVEIRA SOUZA');
  PERFORM vincular_colaborador_equipe('4ST01B', 'RICARDO VIEIRA DA GUARDA');
  PERFORM vincular_colaborador_equipe('4ST00Q', 'GILBERTO CAMPOS DOS SANTOS JUNIOR');
  PERFORM vincular_colaborador_equipe('4ST00R', 'ROGERIO GONCALVES DA SILVA');
  PERFORM vincular_colaborador_equipe('4ST00S', 'RICARDO BATISTA VIANA');
  PERFORM vincular_colaborador_equipe('4ST00W', 'NADSON SANTOS SILVA');
  PERFORM vincular_colaborador_equipe('4ST003', 'ALESSANDRO GONCALVES DA SILVA');
  PERFORM vincular_colaborador_equipe('4ST00Z', 'DIEGO SANTOS SENA');
  PERFORM vincular_colaborador_equipe('KT003', 'JAIMILSON NOVAIS PEREIRA');

  RAISE NOTICE 'Vínculos criados com sucesso!';
END $$;

-- Remover função temporária
DROP FUNCTION IF EXISTS vincular_colaborador_equipe(TEXT, TEXT);


-- ===========================================
-- Verificar resultado
-- ===========================================
SELECT 
  t.codigo,
  t.nome,
  t.status,
  t.tipo_equipe,
  t.hora_inicio,
  t.jornada_horas,
  t.max_horas_trabalho,
  t.placa_veiculo,
  t.color,
  t.min_colaboradores,
  t.max_colaboradores,
  COALESCE(ARRAY_LENGTH(t.habilidades, 1), 0) as qtd_habilidades,
  t.almoco->>'duracao' as almoco_duracao,
  (SELECT COUNT(*) FROM public.equipe_colaboradores ec WHERE ec.equipe_id = t.id AND ec.ativo = true) as colaboradores_vinculados
FROM public.tecnicos t
WHERE t.codigo IN ('4ST002', '4ST004', '4ST005', '4ST006', '4ST008', '4ST009', '4ST00C', '4ST00D', 
                   '4ST00E', '4ST00H', '4ST00I', '4ST00J', '4ST00K', '4ST00M', '4ST00O', '4ST00P',
                   '4ST01B', '4ST00Q', '4ST00R', '4ST00S', '4ST00W', '4ST003', '4ST00Z', 'KT003')
ORDER BY t.codigo;

-- Mostrar resumo
SELECT 'Total de equipes: ' || COUNT(*)::TEXT as resumo
FROM public.tecnicos
WHERE codigo IN ('4ST002', '4ST004', '4ST005', '4ST006', '4ST008', '4ST009', '4ST00C', '4ST00D', 
                 '4ST00E', '4ST00H', '4ST00I', '4ST00J', '4ST00K', '4ST00M', '4ST00O', '4ST00P',
                 '4ST01B', '4ST00Q', '4ST00R', '4ST00S', '4ST00W', '4ST003', '4ST00Z', 'KT003');
