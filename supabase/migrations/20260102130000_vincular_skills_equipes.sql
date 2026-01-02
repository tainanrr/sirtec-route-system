-- ===========================================
-- Script para vincular TODOS os tipos de serviço (skills)
-- a TODAS as equipes ativas
-- ===========================================

-- 1. Verificar as skills existentes
SELECT codigo, nome, ativo FROM public.skills WHERE ativo = true ORDER BY nome;

-- 2. Verificar as equipes existentes
SELECT codigo, nome, habilidades FROM public.tecnicos ORDER BY codigo;

-- 3. Atualizar TODAS as equipes para ter TODAS as skills ativas
DO $$
DECLARE
  v_skills TEXT[];
  v_count INTEGER;
BEGIN
  -- Buscar todas as skills ativas
  SELECT ARRAY_AGG(codigo ORDER BY nome) INTO v_skills
  FROM public.skills
  WHERE ativo = true;
  
  IF v_skills IS NULL OR ARRAY_LENGTH(v_skills, 1) = 0 THEN
    RAISE NOTICE 'ERRO: Nenhuma skill ativa encontrada!';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Skills encontradas (%): %', ARRAY_LENGTH(v_skills, 1), v_skills;
  
  -- Atualizar TODAS as equipes com TODAS as skills
  UPDATE public.tecnicos
  SET habilidades = v_skills,
      updated_at = NOW()
  WHERE true; -- Atualiza todas as equipes
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RAISE NOTICE 'Total de equipes atualizadas: %', v_count;
  RAISE NOTICE 'Cada equipe agora possui % tipos de serviço vinculados', ARRAY_LENGTH(v_skills, 1);
END $$;

-- 4. Verificar resultado final
SELECT 
  codigo AS equipe, 
  nome,
  ARRAY_LENGTH(habilidades, 1) as qtd_habilidades,
  habilidades
FROM public.tecnicos
ORDER BY codigo;

