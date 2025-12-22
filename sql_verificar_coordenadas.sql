-- Verificar coordenadas das OSs que estão planejadas
-- Execute este SQL no Supabase SQL Editor para diagnosticar o problema

-- 1. Verificar OSs planejadas e suas coordenadas
SELECT 
  os.numero,
  os.tipo,
  os.endereco,
  os.latitude,
  os.longitude,
  po.ordem_na_rota,
  t.codigo as equipe
FROM planejamento_ordens po
JOIN ordens_servico os ON os.id = po.ordem_servico_id
JOIN tecnicos t ON t.id = po.equipe_id
JOIN planejamentos p ON p.id = po.planejamento_id
WHERE p.status = 'aberto'
ORDER BY t.codigo, po.ordem_na_rota;

-- 2. Contar OSs com e sem coordenadas
SELECT 
  CASE 
    WHEN os.latitude IS NULL OR os.longitude IS NULL THEN 'SEM COORDENADAS'
    ELSE 'COM COORDENADAS'
  END as status_coordenadas,
  COUNT(*) as quantidade
FROM planejamento_ordens po
JOIN ordens_servico os ON os.id = po.ordem_servico_id
JOIN planejamentos p ON p.id = po.planejamento_id
WHERE p.status = 'aberto'
GROUP BY 1;

-- 3. Listar OSs sem coordenadas
SELECT 
  os.id,
  os.numero,
  os.tipo,
  os.endereco,
  os.latitude,
  os.longitude,
  po.ordem_na_rota
FROM planejamento_ordens po
JOIN ordens_servico os ON os.id = po.ordem_servico_id
JOIN planejamentos p ON p.id = po.planejamento_id
WHERE p.status = 'aberto'
  AND (os.latitude IS NULL OR os.longitude IS NULL)
ORDER BY po.ordem_na_rota;


-- Execute este SQL no Supabase SQL Editor para diagnosticar o problema

-- 1. Verificar OSs planejadas e suas coordenadas
SELECT 
  os.numero,
  os.tipo,
  os.endereco,
  os.latitude,
  os.longitude,
  po.ordem_na_rota,
  t.codigo as equipe
FROM planejamento_ordens po
JOIN ordens_servico os ON os.id = po.ordem_servico_id
JOIN tecnicos t ON t.id = po.equipe_id
JOIN planejamentos p ON p.id = po.planejamento_id
WHERE p.status = 'aberto'
ORDER BY t.codigo, po.ordem_na_rota;

-- 2. Contar OSs com e sem coordenadas
SELECT 
  CASE 
    WHEN os.latitude IS NULL OR os.longitude IS NULL THEN 'SEM COORDENADAS'
    ELSE 'COM COORDENADAS'
  END as status_coordenadas,
  COUNT(*) as quantidade
FROM planejamento_ordens po
JOIN ordens_servico os ON os.id = po.ordem_servico_id
JOIN planejamentos p ON p.id = po.planejamento_id
WHERE p.status = 'aberto'
GROUP BY 1;

-- 3. Listar OSs sem coordenadas
SELECT 
  os.id,
  os.numero,
  os.tipo,
  os.endereco,
  os.latitude,
  os.longitude,
  po.ordem_na_rota
FROM planejamento_ordens po
JOIN ordens_servico os ON os.id = po.ordem_servico_id
JOIN planejamentos p ON p.id = po.planejamento_id
WHERE p.status = 'aberto'
  AND (os.latitude IS NULL OR os.longitude IS NULL)
ORDER BY po.ordem_na_rota;







