-- =====================================================
-- EXECUTE ESTE SCRIPT NO SUPABASE DASHBOARD (SQL Editor)
-- Corrige as políticas RLS para permitir acesso com login web
-- =====================================================

-- =====================================================
-- 1. USUARIOS_WEB - Permitir SELECT para login
-- =====================================================
DROP POLICY IF EXISTS "usuarios_web_all" ON public.usuarios_web;
DROP POLICY IF EXISTS "usuarios_web_select_for_login" ON public.usuarios_web;
DROP POLICY IF EXISTS "usuarios_web_insert" ON public.usuarios_web;
DROP POLICY IF EXISTS "usuarios_web_update" ON public.usuarios_web;
DROP POLICY IF EXISTS "usuarios_web_delete" ON public.usuarios_web;

CREATE POLICY "usuarios_web_select_for_login" 
  ON public.usuarios_web FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "usuarios_web_insert" 
  ON public.usuarios_web FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "usuarios_web_update" 
  ON public.usuarios_web FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "usuarios_web_delete" 
  ON public.usuarios_web FOR DELETE TO anon, authenticated USING (true);

-- =====================================================
-- 2. PERFIS_PERMISSAO
-- =====================================================
DROP POLICY IF EXISTS "perfis_permissao_all" ON public.perfis_permissao;
DROP POLICY IF EXISTS "perfis_permissao_select" ON public.perfis_permissao;
DROP POLICY IF EXISTS "perfis_permissao_modify" ON public.perfis_permissao;

CREATE POLICY "perfis_permissao_select" 
  ON public.perfis_permissao FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "perfis_permissao_modify" 
  ON public.perfis_permissao FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 3. TERRITORIOS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view territorios" ON public.territorios;
DROP POLICY IF EXISTS "Authenticated users can manage territorios" ON public.territorios;
DROP POLICY IF EXISTS "territorios_select" ON public.territorios;
DROP POLICY IF EXISTS "territorios_all" ON public.territorios;

CREATE POLICY "territorios_select" 
  ON public.territorios FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "territorios_all" 
  ON public.territorios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 4. TECNICOS (Equipes)
-- =====================================================
DROP POLICY IF EXISTS "Todos podem ver tecnicos" ON public.tecnicos;
DROP POLICY IF EXISTS "Authenticated users can manage tecnicos" ON public.tecnicos;
DROP POLICY IF EXISTS "tecnicos_select" ON public.tecnicos;
DROP POLICY IF EXISTS "tecnicos_all" ON public.tecnicos;

CREATE POLICY "tecnicos_select" 
  ON public.tecnicos FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "tecnicos_all" 
  ON public.tecnicos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 5. SKILLS
-- =====================================================
DROP POLICY IF EXISTS "Enable read for all users" ON public.skills;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.skills;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.skills;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.skills;
DROP POLICY IF EXISTS "skills_select" ON public.skills;
DROP POLICY IF EXISTS "skills_all" ON public.skills;

CREATE POLICY "skills_select" 
  ON public.skills FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "skills_all" 
  ON public.skills FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 6. ORDENS_SERVICO
-- =====================================================
DROP POLICY IF EXISTS "Todos podem ver ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "Authenticated users can manage ordens" ON public.ordens_servico;
DROP POLICY IF EXISTS "ordens_servico_select" ON public.ordens_servico;
DROP POLICY IF EXISTS "ordens_servico_all" ON public.ordens_servico;

CREATE POLICY "ordens_servico_select" 
  ON public.ordens_servico FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "ordens_servico_all" 
  ON public.ordens_servico FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 7. CONTRATOS
-- =====================================================
DROP POLICY IF EXISTS "contratos_all" ON public.contratos;
DROP POLICY IF EXISTS "contratos_select" ON public.contratos;

CREATE POLICY "contratos_select" 
  ON public.contratos FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "contratos_all" 
  ON public.contratos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- TABELAS OPCIONAIS (verificam existência antes)
-- =====================================================

-- ROTEIRIZACOES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roteirizacoes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Todos podem ver roteirizacoes" ON public.roteirizacoes';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can manage roteirizacoes" ON public.roteirizacoes';
    EXECUTE 'DROP POLICY IF EXISTS "roteirizacoes_select" ON public.roteirizacoes';
    EXECUTE 'DROP POLICY IF EXISTS "roteirizacoes_all" ON public.roteirizacoes';
    EXECUTE 'CREATE POLICY "roteirizacoes_select" ON public.roteirizacoes FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "roteirizacoes_all" ON public.roteirizacoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- PLANEJAMENTOS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'planejamentos') THEN
    EXECUTE 'DROP POLICY IF EXISTS "planejamentos_select" ON public.planejamentos';
    EXECUTE 'DROP POLICY IF EXISTS "planejamentos_all" ON public.planejamentos';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view planejamentos" ON public.planejamentos';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can manage planejamentos" ON public.planejamentos';
    EXECUTE 'CREATE POLICY "planejamentos_select" ON public.planejamentos FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "planejamentos_all" ON public.planejamentos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- PLANEJAMENTO_EQUIPES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'planejamento_equipes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "planejamento_equipes_select" ON public.planejamento_equipes';
    EXECUTE 'DROP POLICY IF EXISTS "planejamento_equipes_all" ON public.planejamento_equipes';
    EXECUTE 'CREATE POLICY "planejamento_equipes_select" ON public.planejamento_equipes FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "planejamento_equipes_all" ON public.planejamento_equipes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- CHECKLISTS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checklists') THEN
    EXECUTE 'DROP POLICY IF EXISTS "checklists_select" ON public.checklists';
    EXECUTE 'DROP POLICY IF EXISTS "checklists_all" ON public.checklists';
    EXECUTE 'CREATE POLICY "checklists_select" ON public.checklists FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "checklists_all" ON public.checklists FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- CHECKLIST_ITENS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checklist_itens') THEN
    EXECUTE 'DROP POLICY IF EXISTS "checklist_itens_select" ON public.checklist_itens';
    EXECUTE 'DROP POLICY IF EXISTS "checklist_itens_all" ON public.checklist_itens';
    EXECUTE 'CREATE POLICY "checklist_itens_select" ON public.checklist_itens FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "checklist_itens_all" ON public.checklist_itens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- CHECKLIST_RESPOSTAS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checklist_respostas') THEN
    EXECUTE 'DROP POLICY IF EXISTS "checklist_respostas_select" ON public.checklist_respostas';
    EXECUTE 'DROP POLICY IF EXISTS "checklist_respostas_all" ON public.checklist_respostas';
    EXECUTE 'DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.checklist_respostas';
    EXECUTE 'DROP POLICY IF EXISTS "Allow select for authenticated" ON public.checklist_respostas';
    EXECUTE 'DROP POLICY IF EXISTS "Allow update for authenticated" ON public.checklist_respostas';
    EXECUTE 'CREATE POLICY "checklist_respostas_select" ON public.checklist_respostas FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "checklist_respostas_all" ON public.checklist_respostas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- MATERIAIS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais') THEN
    EXECUTE 'DROP POLICY IF EXISTS "materiais_select" ON public.materiais';
    EXECUTE 'DROP POLICY IF EXISTS "materiais_all" ON public.materiais';
    EXECUTE 'CREATE POLICY "materiais_select" ON public.materiais FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "materiais_all" ON public.materiais FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- MATERIAIS_MOVIMENTACOES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_movimentacoes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "materiais_movimentacoes_select" ON public.materiais_movimentacoes';
    EXECUTE 'DROP POLICY IF EXISTS "materiais_movimentacoes_all" ON public.materiais_movimentacoes';
    EXECUTE 'CREATE POLICY "materiais_movimentacoes_select" ON public.materiais_movimentacoes FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "materiais_movimentacoes_all" ON public.materiais_movimentacoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- MATERIAIS_RASTRO
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_rastro') THEN
    EXECUTE 'DROP POLICY IF EXISTS "materiais_rastro_select" ON public.materiais_rastro';
    EXECUTE 'DROP POLICY IF EXISTS "materiais_rastro_all" ON public.materiais_rastro';
    EXECUTE 'CREATE POLICY "materiais_rastro_select" ON public.materiais_rastro FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "materiais_rastro_all" ON public.materiais_rastro FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- SYSTEM_LOGS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "system_logs_all" ON public.system_logs';
    EXECUTE 'DROP POLICY IF EXISTS "system_logs_select" ON public.system_logs';
    EXECUTE 'CREATE POLICY "system_logs_select" ON public.system_logs FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "system_logs_all" ON public.system_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- VEICULOS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'veiculos') THEN
    EXECUTE 'DROP POLICY IF EXISTS "veiculos_all" ON public.veiculos';
    EXECUTE 'DROP POLICY IF EXISTS "veiculos_select" ON public.veiculos';
    EXECUTE 'CREATE POLICY "veiculos_select" ON public.veiculos FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "veiculos_all" ON public.veiculos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- METAS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'metas') THEN
    EXECUTE 'DROP POLICY IF EXISTS "metas_all" ON public.metas';
    EXECUTE 'DROP POLICY IF EXISTS "metas_select" ON public.metas';
    EXECUTE 'CREATE POLICY "metas_select" ON public.metas FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "metas_all" ON public.metas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- COORDENADORES_SUPERVISORES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coordenadores_supervisores') THEN
    EXECUTE 'DROP POLICY IF EXISTS "coordenadores_supervisores_all" ON public.coordenadores_supervisores';
    EXECUTE 'DROP POLICY IF EXISTS "coordenadores_supervisores_select" ON public.coordenadores_supervisores';
    EXECUTE 'CREATE POLICY "coordenadores_supervisores_select" ON public.coordenadores_supervisores FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "coordenadores_supervisores_all" ON public.coordenadores_supervisores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- PONTOS_SAIDA
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pontos_saida') THEN
    EXECUTE 'DROP POLICY IF EXISTS "pontos_saida_select" ON public.pontos_saida';
    EXECUTE 'DROP POLICY IF EXISTS "pontos_saida_all" ON public.pontos_saida';
    EXECUTE 'CREATE POLICY "pontos_saida_select" ON public.pontos_saida FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "pontos_saida_all" ON public.pontos_saida FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- TECNICO_SKILLS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tecnico_skills') THEN
    EXECUTE 'DROP POLICY IF EXISTS "tecnico_skills_select" ON public.tecnico_skills';
    EXECUTE 'DROP POLICY IF EXISTS "tecnico_skills_all" ON public.tecnico_skills';
    EXECUTE 'CREATE POLICY "tecnico_skills_select" ON public.tecnico_skills FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "tecnico_skills_all" ON public.tecnico_skills FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- RECEBIMENTOS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recebimentos') THEN
    EXECUTE 'DROP POLICY IF EXISTS "recebimentos_select" ON public.recebimentos';
    EXECUTE 'DROP POLICY IF EXISTS "recebimentos_all" ON public.recebimentos';
    EXECUTE 'CREATE POLICY "recebimentos_select" ON public.recebimentos FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "recebimentos_all" ON public.recebimentos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- DEVOLUCOES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'devolucoes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "devolucoes_select" ON public.devolucoes';
    EXECUTE 'DROP POLICY IF EXISTS "devolucoes_all" ON public.devolucoes';
    EXECUTE 'CREATE POLICY "devolucoes_select" ON public.devolucoes FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "devolucoes_all" ON public.devolucoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- USUARIO_CONTRATOS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuario_contratos') THEN
    EXECUTE 'DROP POLICY IF EXISTS "usuario_contratos_select" ON public.usuario_contratos';
    EXECUTE 'DROP POLICY IF EXISTS "usuario_contratos_all" ON public.usuario_contratos';
    EXECUTE 'CREATE POLICY "usuario_contratos_select" ON public.usuario_contratos FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "usuario_contratos_all" ON public.usuario_contratos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- PERMISSOES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissoes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "permissoes_select" ON public.permissoes';
    EXECUTE 'DROP POLICY IF EXISTS "permissoes_all" ON public.permissoes';
    EXECUTE 'CREATE POLICY "permissoes_select" ON public.permissoes FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "permissoes_all" ON public.permissoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Políticas RLS atualizadas com sucesso!' as status;
SELECT COUNT(*) as total_usuarios FROM public.usuarios_web;
SELECT COUNT(*) as total_territorios FROM public.territorios;
