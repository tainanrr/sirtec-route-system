-- =====================================================
-- FIX: Políticas RLS para sistema de login web
-- Permitir acesso para role 'anon' (necessário antes de autenticar)
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
-- 8. PONTOS_SAIDA
-- =====================================================
DROP POLICY IF EXISTS "Todos podem ver pontos_saida" ON public.pontos_saida;
DROP POLICY IF EXISTS "Authenticated users can manage pontos_saida" ON public.pontos_saida;
DROP POLICY IF EXISTS "pontos_saida_select" ON public.pontos_saida;
DROP POLICY IF EXISTS "pontos_saida_all" ON public.pontos_saida;

CREATE POLICY "pontos_saida_select" 
  ON public.pontos_saida FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "pontos_saida_all" 
  ON public.pontos_saida FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 9. ROTEIRIZACOES
-- =====================================================
DROP POLICY IF EXISTS "Todos podem ver roteirizacoes" ON public.roteirizacoes;
DROP POLICY IF EXISTS "Authenticated users can manage roteirizacoes" ON public.roteirizacoes;
DROP POLICY IF EXISTS "roteirizacoes_select" ON public.roteirizacoes;
DROP POLICY IF EXISTS "roteirizacoes_all" ON public.roteirizacoes;

CREATE POLICY "roteirizacoes_select" 
  ON public.roteirizacoes FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "roteirizacoes_all" 
  ON public.roteirizacoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 10. PLANEJAMENTOS
-- =====================================================
DROP POLICY IF EXISTS "planejamentos_select" ON public.planejamentos;
DROP POLICY IF EXISTS "planejamentos_all" ON public.planejamentos;

CREATE POLICY "planejamentos_select" 
  ON public.planejamentos FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "planejamentos_all" 
  ON public.planejamentos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 11. PLANEJAMENTO_EQUIPES
-- =====================================================
DROP POLICY IF EXISTS "planejamento_equipes_select" ON public.planejamento_equipes;
DROP POLICY IF EXISTS "planejamento_equipes_all" ON public.planejamento_equipes;

CREATE POLICY "planejamento_equipes_select" 
  ON public.planejamento_equipes FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "planejamento_equipes_all" 
  ON public.planejamento_equipes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 12. CHECKLIST TABLES
-- =====================================================
DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
DROP POLICY IF EXISTS "checklists_all" ON public.checklists;
CREATE POLICY "checklists_select" ON public.checklists FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "checklists_all" ON public.checklists FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "checklist_itens_select" ON public.checklist_itens;
DROP POLICY IF EXISTS "checklist_itens_all" ON public.checklist_itens;
CREATE POLICY "checklist_itens_select" ON public.checklist_itens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "checklist_itens_all" ON public.checklist_itens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "checklist_respostas_select" ON public.checklist_respostas;
DROP POLICY IF EXISTS "checklist_respostas_all" ON public.checklist_respostas;
CREATE POLICY "checklist_respostas_select" ON public.checklist_respostas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "checklist_respostas_all" ON public.checklist_respostas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 13. MATERIAIS TABLES
-- =====================================================
DROP POLICY IF EXISTS "materiais_select" ON public.materiais;
DROP POLICY IF EXISTS "materiais_all" ON public.materiais;
CREATE POLICY "materiais_select" ON public.materiais FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "materiais_all" ON public.materiais FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "materiais_movimentacoes_select" ON public.materiais_movimentacoes;
DROP POLICY IF EXISTS "materiais_movimentacoes_all" ON public.materiais_movimentacoes;
CREATE POLICY "materiais_movimentacoes_select" ON public.materiais_movimentacoes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "materiais_movimentacoes_all" ON public.materiais_movimentacoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "materiais_rastro_select" ON public.materiais_rastro;
DROP POLICY IF EXISTS "materiais_rastro_all" ON public.materiais_rastro;
CREATE POLICY "materiais_rastro_select" ON public.materiais_rastro FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "materiais_rastro_all" ON public.materiais_rastro FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 14. LOGS DO SISTEMA
-- =====================================================
DROP POLICY IF EXISTS "system_logs_all" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_select" ON public.system_logs;
CREATE POLICY "system_logs_select" ON public.system_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "system_logs_all" ON public.system_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 15. VEICULOS
-- =====================================================
DROP POLICY IF EXISTS "veiculos_all" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_select" ON public.veiculos;
CREATE POLICY "veiculos_select" ON public.veiculos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "veiculos_all" ON public.veiculos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 16. METAS
-- =====================================================
DROP POLICY IF EXISTS "metas_all" ON public.metas;
DROP POLICY IF EXISTS "metas_select" ON public.metas;
CREATE POLICY "metas_select" ON public.metas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "metas_all" ON public.metas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 17. COORDENADORES_SUPERVISORES
-- =====================================================
DROP POLICY IF EXISTS "coordenadores_supervisores_all" ON public.coordenadores_supervisores;
DROP POLICY IF EXISTS "coordenadores_supervisores_select" ON public.coordenadores_supervisores;
CREATE POLICY "coordenadores_supervisores_select" ON public.coordenadores_supervisores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "coordenadores_supervisores_all" ON public.coordenadores_supervisores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
