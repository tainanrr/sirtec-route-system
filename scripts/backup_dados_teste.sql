-- =====================================================
-- BACKUP DOS DADOS DE TESTE
-- Cria tabelas de backup com prefixo "bkp_" 
-- Execute ANTES do script de limpeza!
-- =====================================================

-- =====================================================
-- PARTE 1: BACKUP DE ORDENS DE SERVIÇO
-- =====================================================

-- Backup das Ordens de Serviço
DROP TABLE IF EXISTS bkp_ordens_servico;
CREATE TABLE bkp_ordens_servico AS SELECT * FROM ordens_servico;

-- Backup das Rotas
DROP TABLE IF EXISTS bkp_rotas;
CREATE TABLE bkp_rotas AS SELECT * FROM rotas;

-- Backup dos Planejamentos
DROP TABLE IF EXISTS bkp_planejamentos;
CREATE TABLE bkp_planejamentos AS SELECT * FROM planejamentos;

DROP TABLE IF EXISTS bkp_planejamento_ordens;
CREATE TABLE bkp_planejamento_ordens AS SELECT * FROM planejamento_ordens;

DROP TABLE IF EXISTS bkp_planejamento_logs;
CREATE TABLE bkp_planejamento_logs AS SELECT * FROM planejamento_logs;

-- Backup dos Alertas
DROP TABLE IF EXISTS bkp_alertas;
CREATE TABLE bkp_alertas AS SELECT * FROM alertas;

-- =====================================================
-- PARTE 2: BACKUP DE CHECKLISTS (se existir)
-- =====================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checklist_respostas') THEN
    DROP TABLE IF EXISTS bkp_checklist_respostas;
    CREATE TABLE bkp_checklist_respostas AS SELECT * FROM checklist_respostas;
  END IF;
END $$;

-- =====================================================
-- PARTE 3: BACKUP DE MATERIAIS (se existir)
-- =====================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_movimentacoes') THEN
    DROP TABLE IF EXISTS bkp_materiais_movimentacoes;
    CREATE TABLE bkp_materiais_movimentacoes AS SELECT * FROM materiais_movimentacoes;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_estoque') THEN
    DROP TABLE IF EXISTS bkp_materiais_estoque;
    CREATE TABLE bkp_materiais_estoque AS SELECT * FROM materiais_estoque;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_recebimentos') THEN
    DROP TABLE IF EXISTS bkp_materiais_recebimentos;
    CREATE TABLE bkp_materiais_recebimentos AS SELECT * FROM materiais_recebimentos;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_recebimentos_itens') THEN
    DROP TABLE IF EXISTS bkp_materiais_recebimentos_itens;
    CREATE TABLE bkp_materiais_recebimentos_itens AS SELECT * FROM materiais_recebimentos_itens;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_entregas') THEN
    DROP TABLE IF EXISTS bkp_materiais_entregas;
    CREATE TABLE bkp_materiais_entregas AS SELECT * FROM materiais_entregas;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_entregas_itens') THEN
    DROP TABLE IF EXISTS bkp_materiais_entregas_itens;
    CREATE TABLE bkp_materiais_entregas_itens AS SELECT * FROM materiais_entregas_itens;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_devolucoes') THEN
    DROP TABLE IF EXISTS bkp_materiais_devolucoes;
    CREATE TABLE bkp_materiais_devolucoes AS SELECT * FROM materiais_devolucoes;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais_devolucoes_itens') THEN
    DROP TABLE IF EXISTS bkp_materiais_devolucoes_itens;
    CREATE TABLE bkp_materiais_devolucoes_itens AS SELECT * FROM materiais_devolucoes_itens;
  END IF;
END $$;

-- =====================================================
-- PARTE 4: BACKUP DE LOGS E RASTREAMENTO
-- =====================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logs_sistema') THEN
    DROP TABLE IF EXISTS bkp_logs_sistema;
    CREATE TABLE bkp_logs_sistema AS SELECT * FROM logs_sistema;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tecnicos_posicoes') THEN
    DROP TABLE IF EXISTS bkp_tecnicos_posicoes;
    CREATE TABLE bkp_tecnicos_posicoes AS SELECT * FROM tecnicos_posicoes;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turno_eventos') THEN
    DROP TABLE IF EXISTS bkp_turno_eventos;
    CREATE TABLE bkp_turno_eventos AS SELECT * FROM turno_eventos;
  END IF;
END $$;

-- =====================================================
-- PARTE 5: BACKUP DE TURNOS
-- =====================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos') THEN
    DROP TABLE IF EXISTS bkp_turnos;
    CREATE TABLE bkp_turnos AS SELECT * FROM turnos;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turno_colaboradores') THEN
    DROP TABLE IF EXISTS bkp_turno_colaboradores;
    CREATE TABLE bkp_turno_colaboradores AS SELECT * FROM turno_colaboradores;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'producao_equipes') THEN
    DROP TABLE IF EXISTS bkp_producao_equipes;
    CREATE TABLE bkp_producao_equipes AS SELECT * FROM producao_equipes;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'intervalos_equipe') THEN
    DROP TABLE IF EXISTS bkp_intervalos_equipe;
    CREATE TABLE bkp_intervalos_equipe AS SELECT * FROM intervalos_equipe;
  END IF;
END $$;

-- =====================================================
-- VERIFICAÇÃO: Listar tabelas de backup criadas
-- =====================================================

SELECT 
    table_name as tabela_backup,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as colunas
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name LIKE 'bkp_%'
ORDER BY table_name;

-- =====================================================
-- CONTAGEM DE REGISTROS NAS TABELAS DE BACKUP
-- =====================================================

SELECT 'bkp_ordens_servico' as tabela, COUNT(*) as registros FROM bkp_ordens_servico
UNION ALL SELECT 'bkp_rotas', COUNT(*) FROM bkp_rotas
UNION ALL SELECT 'bkp_planejamentos', COUNT(*) FROM bkp_planejamentos
UNION ALL SELECT 'bkp_alertas', COUNT(*) FROM bkp_alertas
ORDER BY tabela;

-- =====================================================
-- PARA RESTAURAR OS DADOS (se precisar):
-- =====================================================
-- INSERT INTO ordens_servico SELECT * FROM bkp_ordens_servico;
-- INSERT INTO rotas SELECT * FROM bkp_rotas;
-- etc...

-- =====================================================
-- PARA REMOVER AS TABELAS DE BACKUP (após confirmar que não precisa mais):
-- =====================================================
-- DROP TABLE IF EXISTS bkp_ordens_servico;
-- DROP TABLE IF EXISTS bkp_rotas;
-- DROP TABLE IF EXISTS bkp_planejamentos;
-- DROP TABLE IF EXISTS bkp_planejamento_ordens;
-- DROP TABLE IF EXISTS bkp_planejamento_logs;
-- DROP TABLE IF EXISTS bkp_alertas;
-- DROP TABLE IF EXISTS bkp_checklist_respostas;
-- DROP TABLE IF EXISTS bkp_materiais_movimentacoes;
-- DROP TABLE IF EXISTS bkp_materiais_estoque;
-- DROP TABLE IF EXISTS bkp_materiais_recebimentos;
-- DROP TABLE IF EXISTS bkp_materiais_recebimentos_itens;
-- DROP TABLE IF EXISTS bkp_materiais_entregas;
-- DROP TABLE IF EXISTS bkp_materiais_entregas_itens;
-- DROP TABLE IF EXISTS bkp_materiais_devolucoes;
-- DROP TABLE IF EXISTS bkp_materiais_devolucoes_itens;
-- DROP TABLE IF EXISTS bkp_logs_sistema;
-- DROP TABLE IF EXISTS bkp_tecnicos_posicoes;
-- DROP TABLE IF EXISTS bkp_turno_eventos;
-- DROP TABLE IF EXISTS bkp_turnos;
-- DROP TABLE IF EXISTS bkp_turno_colaboradores;
-- DROP TABLE IF EXISTS bkp_producao_equipes;
-- DROP TABLE IF EXISTS bkp_intervalos_equipe;