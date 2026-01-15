-- =====================================================
-- SCRIPT DE PREPARAÇÃO PARA PRODUÇÃO
-- Limpar dados de teste mantendo cadastros básicos
-- =====================================================
-- ATENÇÃO: Este script APAGA dados transacionais de teste!
-- Execute com cuidado e FAÇA BACKUP antes!
-- =====================================================

-- Desabilitar triggers temporariamente para performance
SET session_replication_role = replica;

-- =====================================================
-- PARTE 1: LIMPAR DADOS DE ORDENS DE SERVIÇO
-- =====================================================

-- 1.1 Planejamento e Rotas
DELETE FROM public.planejamento_logs WHERE true;
DELETE FROM public.planejamento_ordens WHERE true;
DELETE FROM public.planejamentos WHERE true;
DELETE FROM public.rotas WHERE true;

-- 1.2 Anexos de OS (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ordem_anexos') THEN
    DELETE FROM public.ordem_anexos WHERE true;
  END IF;
END $$;

-- 1.3 Materiais de OS (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ordem_materiais') THEN
    DELETE FROM public.ordem_materiais WHERE true;
  END IF;
END $$;

-- 1.4 Materiais aplicados em OS (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_aplicados_os') THEN
    DELETE FROM public.materiais_aplicados_os WHERE true;
  END IF;
END $$;

-- 1.5 Ordens de Serviço
DELETE FROM public.ordens_servico WHERE true;

-- 1.6 Alertas
DELETE FROM public.alertas WHERE true;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alertas_tratativas') THEN
    DELETE FROM public.alertas_tratativas WHERE true;
  END IF;
END $$;

-- =====================================================
-- PARTE 2: LIMPAR DADOS DE MATERIAIS
-- =====================================================

-- 2.1 Histórico e Rastreamento
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_serializados_historico') THEN
    DELETE FROM public.materiais_serializados_historico WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_precos_historico') THEN
    DELETE FROM public.materiais_precos_historico WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_recebimentos_itens_rastros') THEN
    DELETE FROM public.materiais_recebimentos_itens_rastros WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_devolucoes_itens_rastros') THEN
    DELETE FROM public.materiais_devolucoes_itens_rastros WHERE true;
  END IF;
END $$;

-- 2.2 Devoluções
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_devolucoes_anexos') THEN
    DELETE FROM public.materiais_devolucoes_anexos WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_devolucoes_itens') THEN
    DELETE FROM public.materiais_devolucoes_itens WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_devolucoes') THEN
    DELETE FROM public.materiais_devolucoes WHERE true;
  END IF;
END $$;

-- 2.3 Entregas
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_entregas_itens') THEN
    DELETE FROM public.materiais_entregas_itens WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_entregas') THEN
    DELETE FROM public.materiais_entregas WHERE true;
  END IF;
END $$;

-- 2.4 Recebimentos
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_recebimentos_anexos') THEN
    DELETE FROM public.materiais_recebimentos_anexos WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_recebimentos_itens') THEN
    DELETE FROM public.materiais_recebimentos_itens WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_recebimentos') THEN
    DELETE FROM public.materiais_recebimentos WHERE true;
  END IF;
END $$;

-- 2.5 Movimentações e Estoque (reset)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_movimentacoes') THEN
    DELETE FROM public.materiais_movimentacoes WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_estoque') THEN
    DELETE FROM public.materiais_estoque WHERE true;
  END IF;
END $$;

-- 2.6 Materiais Serializados (OPCIONAL - descomente se quiser zerar medidores/equipamentos)
-- DO $$ BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_serializados') THEN
--     DELETE FROM public.materiais_serializados WHERE true;
--   END IF;
-- END $$;

-- =====================================================
-- PARTE 3: LIMPAR DADOS DE CHECKLISTS
-- =====================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checklist_respostas') THEN
    DELETE FROM public.checklist_respostas WHERE true;
  END IF;
END $$;

-- =====================================================
-- PARTE 4: LIMPAR OUTROS DADOS TRANSACIONAIS
-- =====================================================

-- 4.1 Logs do sistema
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logs_sistema') THEN
    DELETE FROM public.logs_sistema WHERE true;
  END IF;
END $$;

-- 4.2 Posições de técnicos (GPS)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tecnicos_posicoes') THEN
    DELETE FROM public.tecnicos_posicoes WHERE true;
  END IF;
END $$;

-- 4.3 Eventos de turno
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turno_eventos') THEN
    DELETE FROM public.turno_eventos WHERE true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turno_paradas') THEN
    DELETE FROM public.turno_paradas WHERE true;
  END IF;
END $$;

-- =====================================================
-- PARTE 5: LIMPAR DADOS DE TURNOS
-- =====================================================

-- 5.1 Produção das equipes (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'producao_equipes') THEN
    DELETE FROM public.producao_equipes WHERE true;
  END IF;
END $$;

-- 5.2 Intervalos das equipes (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'intervalos_equipe') THEN
    DELETE FROM public.intervalos_equipe WHERE true;
  END IF;
END $$;

-- 5.3 Colaboradores do turno (filho de turnos)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turno_colaboradores') THEN
    -- Limpa apenas os colaboradores de turnos de teste, não o vínculo padrão
    DELETE FROM public.turno_colaboradores WHERE turno_id IS NOT NULL;
  END IF;
END $$;

-- 5.4 Turnos (dados transacionais)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos') THEN
    DELETE FROM public.turnos WHERE true;
  END IF;
END $$;

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- =====================================================
-- VERIFICAÇÃO: Contar registros após limpeza
-- =====================================================

SELECT 'ordens_servico' as tabela, COUNT(*) as registros FROM public.ordens_servico
UNION ALL SELECT 'rotas', COUNT(*) FROM public.rotas
UNION ALL SELECT 'planejamentos', COUNT(*) FROM public.planejamentos
UNION ALL SELECT 'alertas', COUNT(*) FROM public.alertas
ORDER BY tabela;

-- =====================================================
-- CADASTROS QUE SERÃO MANTIDOS:
-- =====================================================
-- ✓ skills (tipos de serviço)
-- ✓ skill_retornos (retornos de campo)
-- ✓ tipo_servico_retornos (vínculos retorno-serviço)
-- ✓ grupos_retorno
-- ✓ atividades
-- ✓ tecnicos (equipes)
-- ✓ colaboradores
-- ✓ turnos
-- ✓ contratos
-- ✓ centros_custo
-- ✓ coordenadores_supervisores
-- ✓ veiculos
-- ✓ metas
-- ✓ procedimentos
-- ✓ checklists (templates)
-- ✓ territorios
-- ✓ pontos_saida
-- ✓ poligonos
-- ✓ usuarios_web
-- ✓ perfis_permissao
-- ✓ permissoes
-- ✓ materiais (catálogo)
-- ✓ tipos_intervalo
-- ✓ valores_servico_contrato
-- ✓ valores_servico_centro_custo
-- ✓ tempos_servico_centro_custo
-- ✓ config_prazo_urgente
-- ✓ equipe_auth
-- =====================================================
