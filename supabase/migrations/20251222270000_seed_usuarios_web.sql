-- =====================================================
-- SEED: Usuários Web Iniciais
-- =====================================================

-- Inserir usuários web com perfil Administrador
INSERT INTO public.usuarios_web (nome, email, cargo, centro_custo, telefone, ativo, senha_hash, perfil_id)
SELECT 
  nome_val,
  email_val,
  cargo_val,
  centro_custo_val,
  telefone_val,
  true,
  '123456', -- Senha inicial simples (em produção seria um hash)
  (SELECT id FROM public.perfis_permissao WHERE nome = 'Administrador' LIMIT 1)
FROM (VALUES
  ('JUNIA SUANE DE CASTRO HEDLUND', 'junia.hedlund@sirtec.com.br', 'COORDENADOR DE PCP I', 'PCP PLA STC', '55 99667-7406'),
  ('RICARDO FARIAS BATISTA', 'ricardo.batista@sirtec.com.br', 'SUPERVISOR PCP I', 'PCP PLA STC', '54 99962-8583'),
  ('GABRIEL LEAO GARIBALDI', 'gabriel.garibaldi@sirtec.com.br', 'ANALISTA INOVACAO I', 'INOVACAO E CONTRATOS', '51 99338-9879'),
  ('TAINAN RAMOS RODRIGUES', 'tainan.rodrigues@sirtec.com.br', 'ENGENH ELETRICISTA I', 'GERENCIA DE PCP RS', '55 99951-1009'),
  ('CALINE RODRIGUES SOUZA DA SILVA', 'caline.silva@sirtec.com.br', 'ANALISTA DE PCP I', 'PCP PLA STC', '74 99811-0295')
) AS t(nome_val, email_val, cargo_val, centro_custo_val, telefone_val)
ON CONFLICT (email) DO UPDATE SET
  nome = EXCLUDED.nome,
  cargo = EXCLUDED.cargo,
  centro_custo = EXCLUDED.centro_custo,
  telefone = EXCLUDED.telefone,
  senha_hash = EXCLUDED.senha_hash,
  perfil_id = EXCLUDED.perfil_id,
  updated_at = NOW();
