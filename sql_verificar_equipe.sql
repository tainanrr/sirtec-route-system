-- ==========================================
-- SQL PARA VERIFICAR EQUIPE E PLANEJAMENTOS
-- Execute no SQL Editor do Supabase
-- ==========================================

-- 1. Verificar a equipe EQ-001 e seu ID
SELECT 
  id,
  codigo,
  nome,
  usuario
FROM public.tecnicos
WHERE codigo = 'EQ-001';

-- 2. Verificar credenciais da equipe
SELECT 
  ea.id,
  ea.equipe_id,
  ea.usuario,
  t.codigo,
  t.nome
FROM public.equipe_auth ea
JOIN public.tecnicos t ON t.id = ea.equipe_id
WHERE ea.usuario = 'equipe1';

-- 3. Verificar planejamentos existentes
SELECT 
  id,
  data_planejamento,
  status,
  total_equipes,
  total_ordens,
  created_at
FROM public.planejamentos
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verificar planejamento_ordens e suas equipes
SELECT 
  po.id,
  po.planejamento_id,
  po.equipe_id,
  t.codigo as equipe_codigo,
  po.ordem_na_rota,
  p.data_planejamento,
  p.status as planejamento_status
FROM public.planejamento_ordens po
JOIN public.tecnicos t ON t.id = po.equipe_id
JOIN public.planejamentos p ON p.id = po.planejamento_id
ORDER BY po.created_at DESC
LIMIT 20;

-- 5. Verificar se a equipe 628daa5f-7c9b-45a1-b00d-e947a922c7d4 existe
SELECT 
  id,
  codigo,
  nome,
  usuario
FROM public.tecnicos
WHERE id = '628daa5f-7c9b-45a1-b00d-e947a922c7d4';


-- SQL PARA VERIFICAR EQUIPE E PLANEJAMENTOS
-- Execute no SQL Editor do Supabase
-- ==========================================

-- 1. Verificar a equipe EQ-001 e seu ID
SELECT 
  id,
  codigo,
  nome,
  usuario
FROM public.tecnicos
WHERE codigo = 'EQ-001';

-- 2. Verificar credenciais da equipe
SELECT 
  ea.id,
  ea.equipe_id,
  ea.usuario,
  t.codigo,
  t.nome
FROM public.equipe_auth ea
JOIN public.tecnicos t ON t.id = ea.equipe_id
WHERE ea.usuario = 'equipe1';

-- 3. Verificar planejamentos existentes
SELECT 
  id,
  data_planejamento,
  status,
  total_equipes,
  total_ordens,
  created_at
FROM public.planejamentos
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verificar planejamento_ordens e suas equipes
SELECT 
  po.id,
  po.planejamento_id,
  po.equipe_id,
  t.codigo as equipe_codigo,
  po.ordem_na_rota,
  p.data_planejamento,
  p.status as planejamento_status
FROM public.planejamento_ordens po
JOIN public.tecnicos t ON t.id = po.equipe_id
JOIN public.planejamentos p ON p.id = po.planejamento_id
ORDER BY po.created_at DESC
LIMIT 20;

-- 5. Verificar se a equipe 628daa5f-7c9b-45a1-b00d-e947a922c7d4 existe
SELECT 
  id,
  codigo,
  nome,
  usuario
FROM public.tecnicos
WHERE id = '628daa5f-7c9b-45a1-b00d-e947a922c7d4';







