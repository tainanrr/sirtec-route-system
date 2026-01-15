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
TRUNCATE TABLE public.planejamento_logs CASCADE;
TRUNCATE TABLE public.planejamento_ordens CASCADE;
TRUNCATE TABLE public.planejamentos CASCADE;
TRUNCATE TABLE public.rotas CASCADE;

-- 1.2 Anexos e Materiais de OS
TRUNCATE TABLE public.ordem_anexos CASCADE;
TRUNCATE TABLE public.ordem_materiais CASCADE;

-- 1.3 Materiais aplicados em OS
TRUNCATE TABLE public.materiais_aplicados_os CASCADE;

-- 1.4 Ordens de Serviço
TRUNCATE TABLE public.ordens_servico CASCADE;

-- 1.5 Alertas
TRUNCATE TABLE public.alertas CASCADE;
TRUNCATE TABLE public.alertas_tratativas CASCADE;

-- =====================================================
-- PARTE 2: LIMPAR DADOS DE MATERIAIS
-- =====================================================

-- 2.1 Histórico e Rastreamento
TRUNCATE TABLE public.materiais_serializados_historico CASCADE;
TRUNCATE TABLE public.materiais_precos_historico CASCADE;
TRUNCATE TABLE public.materiais_recebimentos_itens_rastros CASCADE;
TRUNCATE TABLE public.materiais_devolucoes_itens_rastros CASCADE;

-- 2.2 Devoluções
TRUNCATE TABLE public.materiais_devolucoes_anexos CASCADE;
TRUNCATE TABLE public.materiais_devolucoes_itens CASCADE;
TRUNCATE TABLE public.materiais_devolucoes CASCADE;

-- 2.3 Entregas
TRUNCATE TABLE public.materiais_entregas_itens CASCADE;
TRUNCATE TABLE public.materiais_entregas CASCADE;

-- 2.4 Recebimentos
TRUNCATE TABLE public.materiais_recebimentos_anexos CASCADE;
TRUNCATE TABLE public.materiais_recebimentos_itens CASCADE;
TRUNCATE TABLE public.materiais_recebimentos CASCADE;

-- 2.5 Movimentações e Estoque (reset)
TRUNCATE TABLE public.materiais_movimentacoes CASCADE;
TRUNCATE TABLE public.materiais_estoque CASCADE;

-- 2.6 Materiais Serializados (apenas se quiser zerar medidores/equipamentos)
-- TRUNCATE TABLE public.materiais_serializados CASCADE;

-- =====================================================
-- PARTE 3: LIMPAR DADOS DE CHECKLISTS
-- =====================================================

TRUNCATE TABLE public.checklist_respostas CASCADE;

-- =====================================================
-- PARTE 4: LIMPAR OUTROS DADOS TRANSACIONAIS
-- =====================================================

-- 4.1 Logs do sistema (opcional - pode querer manter para auditoria)
TRUNCATE TABLE public.logs_sistema CASCADE;

-- 4.2 Posições de técnicos (GPS)
TRUNCATE TABLE public.tecnicos_posicoes CASCADE;

-- 4.3 Eventos de turno
TRUNCATE TABLE public.turno_eventos CASCADE;
TRUNCATE TABLE public.turno_paradas CASCADE;

-- 4.4 Histórico de coordenadores em equipes
-- TRUNCATE TABLE public.equipe_coordenador_historico CASCADE;

-- 4.5 Histórico de veículos
-- TRUNCATE TABLE public.veiculo_uso_historico CASCADE;

-- =====================================================
-- PARTE 5: RESETAR SEQUÊNCIAS (se houver)
-- =====================================================

-- Não há sequences explícitas, UUIDs são gerados automaticamente

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- =====================================================
-- VERIFICAÇÃO: Contar registros após limpeza
-- =====================================================

SELECT 'ordens_servico' as tabela, COUNT(*) as registros FROM public.ordens_servico
UNION ALL SELECT 'rotas', COUNT(*) FROM public.rotas
UNION ALL SELECT 'planejamentos', COUNT(*) FROM public.planejamentos
UNION ALL SELECT 'ordem_anexos', COUNT(*) FROM public.ordem_anexos
UNION ALL SELECT 'checklist_respostas', COUNT(*) FROM public.checklist_respostas
UNION ALL SELECT 'materiais_movimentacoes', COUNT(*) FROM public.materiais_movimentacoes
UNION ALL SELECT 'materiais_recebimentos', COUNT(*) FROM public.materiais_recebimentos
UNION ALL SELECT 'materiais_entregas', COUNT(*) FROM public.materiais_entregas
UNION ALL SELECT 'materiais_devolucoes', COUNT(*) FROM public.materiais_devolucoes
UNION ALL SELECT 'alertas', COUNT(*) FROM public.alertas
UNION ALL SELECT 'logs_sistema', COUNT(*) FROM public.logs_sistema
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
