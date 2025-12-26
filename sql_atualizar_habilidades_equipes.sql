-- ===========================================
-- Script para atualizar habilidades das equipes
-- Substitui os códigos antigos pelos códigos das skills cadastradas
-- ===========================================

-- Primeiro, vamos ver quais skills existem no banco
SELECT codigo, nome FROM public.skills WHERE ativo = true ORDER BY nome;

-- Atualizar todas as equipes para usar todas as skills ativas
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
    RAISE NOTICE 'Nenhuma skill encontrada!';
  ELSE
    RAISE NOTICE 'Skills encontradas: %', v_skills;
  END IF;

  -- Atualizar todas as equipes com as skills corretas
  UPDATE public.tecnicos
  SET habilidades = v_skills
  WHERE habilidades IS NOT NULL 
     OR habilidades = ARRAY[]::TEXT[];

  RAISE NOTICE 'Habilidades atualizadas em todas as equipes!';
END $$;

-- Verificar resultado
SELECT 
  codigo, 
  nome, 
  habilidades,
  ARRAY_LENGTH(habilidades, 1) as qtd_habilidades
FROM public.tecnicos
ORDER BY codigo;






