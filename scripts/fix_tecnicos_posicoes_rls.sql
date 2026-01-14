-- =============================================
-- Script para corrigir RLS da tabela tecnicos_posicoes
-- Permite que equipes enviem suas posições GPS
-- =============================================

-- Verificar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'tecnicos_posicoes';

-- Habilitar RLS se não estiver habilitado
ALTER TABLE tecnicos_posicoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas que possam estar conflitando
DROP POLICY IF EXISTS "Equipes podem inserir suas posições" ON tecnicos_posicoes;
DROP POLICY IF EXISTS "Admins podem ver todas as posições" ON tecnicos_posicoes;
DROP POLICY IF EXISTS "Equipes podem ver suas posições" ON tecnicos_posicoes;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON tecnicos_posicoes;
DROP POLICY IF EXISTS "Allow select for authenticated" ON tecnicos_posicoes;
DROP POLICY IF EXISTS "anon_insert_tecnicos_posicoes" ON tecnicos_posicoes;
DROP POLICY IF EXISTS "anon_select_tecnicos_posicoes" ON tecnicos_posicoes;

-- Política para permitir INSERT por qualquer um (anon) 
-- O app de equipes não usa Supabase Auth, usa login próprio
CREATE POLICY "anon_insert_tecnicos_posicoes" ON tecnicos_posicoes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Verifica se o equipe_id existe na tabela tecnicos
    EXISTS (SELECT 1 FROM tecnicos WHERE id = equipe_id)
  );

-- Política para permitir SELECT (leitura) - para o painel de rastreamento
CREATE POLICY "anon_select_tecnicos_posicoes" ON tecnicos_posicoes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Verificar se as políticas foram criadas
SELECT * FROM pg_policies WHERE tablename = 'tecnicos_posicoes';
