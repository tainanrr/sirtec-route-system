-- Script para criar estrutura de Checklists de Serviço
-- Execute este SQL no Supabase SQL Editor

-- ============================================
-- 1. ADICIONAR TIPO "servico" AOS TIPOS DE CHECKLIST
-- ============================================

-- Atualizar comentário para documentar o novo tipo
COMMENT ON COLUMN public.checklists.tipo IS 'Tipo do checklist: apr, qualidade, seguranca, inspecao, manutencao, servico, outro';

-- ============================================
-- 2. CRIAR TABELA DE VÍNCULO: CHECKLIST <-> TIPO DE SERVIÇO + GRUPO DE RETORNO
-- ============================================

-- Tabela para vincular checklists de serviço aos tipos de serviço (skills) e grupos de retorno
CREATE TABLE IF NOT EXISTS public.checklist_servico_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  grupo_retorno VARCHAR(50) NOT NULL, -- 'executado', 'impedimento', 'parcial', 'todos'
  obrigatorio BOOLEAN DEFAULT true, -- Se é obrigatório preencher para concluir a OS
  ordem INTEGER DEFAULT 0, -- Ordem de exibição quando houver múltiplos checklists
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint única para evitar duplicatas
  CONSTRAINT unique_checklist_skill_grupo UNIQUE (checklist_id, skill_id, grupo_retorno)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_checklist_servico_vinculos_checklist_id 
  ON public.checklist_servico_vinculos(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_servico_vinculos_skill_id 
  ON public.checklist_servico_vinculos(skill_id);
CREATE INDEX IF NOT EXISTS idx_checklist_servico_vinculos_grupo_retorno 
  ON public.checklist_servico_vinculos(grupo_retorno);
CREATE INDEX IF NOT EXISTS idx_checklist_servico_vinculos_ativo 
  ON public.checklist_servico_vinculos(ativo);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_checklist_servico_vinculos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_checklist_servico_vinculos_updated_at 
  ON public.checklist_servico_vinculos;
CREATE TRIGGER trigger_checklist_servico_vinculos_updated_at
  BEFORE UPDATE ON public.checklist_servico_vinculos
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_servico_vinculos_updated_at();

-- Comentários
COMMENT ON TABLE public.checklist_servico_vinculos IS 'Vínculos entre checklists de serviço e tipos de serviço/grupos de retorno';
COMMENT ON COLUMN public.checklist_servico_vinculos.skill_id IS 'ID do tipo de serviço (skill)';
COMMENT ON COLUMN public.checklist_servico_vinculos.grupo_retorno IS 'Grupo de retorno: executado, impedimento, parcial ou todos';
COMMENT ON COLUMN public.checklist_servico_vinculos.obrigatorio IS 'Se o checklist é obrigatório para conclusão da OS';

-- ============================================
-- 3. ADICIONAR CAMPOS NECESSÁRIOS NA TABELA checklist_respostas
-- ============================================

-- Adicionar coluna grupo_retorno para registrar qual grupo de retorno foi selecionado
ALTER TABLE public.checklist_respostas
ADD COLUMN IF NOT EXISTS grupo_retorno VARCHAR(50);

-- Adicionar coluna equipe_id para rastreamento
ALTER TABLE public.checklist_respostas
ADD COLUMN IF NOT EXISTS equipe_id UUID REFERENCES public.tecnicos(id) ON DELETE SET NULL;

-- Adicionar coluna status para checklists de serviço
ALTER TABLE public.checklist_respostas
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completo';

COMMENT ON COLUMN public.checklist_respostas.grupo_retorno IS 'Grupo de retorno selecionado ao preencher o checklist (executado, impedimento, parcial)';
COMMENT ON COLUMN public.checklist_respostas.equipe_id IS 'ID da equipe que preencheu o checklist';
COMMENT ON COLUMN public.checklist_respostas.status IS 'Status do preenchimento: completo, incompleto, pendente';

-- ============================================
-- 4. RLS PARA A NOVA TABELA
-- ============================================

ALTER TABLE public.checklist_servico_vinculos ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários autenticados
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.checklist_servico_vinculos;
CREATE POLICY "Enable read access for authenticated users"
ON public.checklist_servico_vinculos FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.checklist_servico_vinculos;
CREATE POLICY "Enable insert for authenticated users"
ON public.checklist_servico_vinculos FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.checklist_servico_vinculos;
CREATE POLICY "Enable update for authenticated users"
ON public.checklist_servico_vinculos FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.checklist_servico_vinculos;
CREATE POLICY "Enable delete for authenticated users"
ON public.checklist_servico_vinculos FOR DELETE
TO authenticated
USING (true);

-- Políticas para usuários anônimos (para acesso via service_role ou chave anon)
DROP POLICY IF EXISTS "Enable read access for anon users" ON public.checklist_servico_vinculos;
CREATE POLICY "Enable read access for anon users"
ON public.checklist_servico_vinculos FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Enable insert for anon users" ON public.checklist_servico_vinculos;
CREATE POLICY "Enable insert for anon users"
ON public.checklist_servico_vinculos FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for anon users" ON public.checklist_servico_vinculos;
CREATE POLICY "Enable update for anon users"
ON public.checklist_servico_vinculos FOR UPDATE
TO anon
USING (true);

DROP POLICY IF EXISTS "Enable delete for anon users" ON public.checklist_servico_vinculos;
CREATE POLICY "Enable delete for anon users"
ON public.checklist_servico_vinculos FOR DELETE
TO anon
USING (true);

-- ============================================
-- 5. FUNÇÃO PARA BUSCAR CHECKLISTS DE SERVIÇO PARA UMA OS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_checklists_servico_para_os(
  p_skill_id UUID,
  p_grupo_retorno VARCHAR(50)
)
RETURNS TABLE (
  checklist_id UUID,
  checklist_nome VARCHAR(200),
  checklist_descricao TEXT,
  obrigatorio BOOLEAN,
  perguntas JSONB,
  grupos JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS checklist_id,
    c.nome AS checklist_nome,
    c.descricao AS checklist_descricao,
    csv.obrigatorio,
    c.perguntas,
    c.grupos
  FROM public.checklist_servico_vinculos csv
  INNER JOIN public.checklists c ON c.id = csv.checklist_id
  WHERE csv.skill_id = p_skill_id
    AND csv.ativo = true
    AND c.ativo = true
    AND c.tipo = 'servico'
    AND (csv.grupo_retorno = p_grupo_retorno OR csv.grupo_retorno = 'todos')
  ORDER BY csv.ordem, c.nome;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_checklists_servico_para_os IS 'Retorna checklists de serviço vinculados a um tipo de serviço e grupo de retorno';

-- ============================================
-- 6. INSERIR CHECKLIST DE SERVIÇO DE EXEMPLO
-- ============================================

-- Inserir um checklist de serviço de exemplo
INSERT INTO public.checklists (nome, descricao, tipo, ativo, perguntas) VALUES (
  'Checklist de Serviço - Geral',
  'Checklist padrão a ser preenchido ao concluir um serviço',
  'servico',
  true,
  '[
    {
      "id": "p1",
      "texto": "O serviço foi executado conforme solicitado?",
      "tipo": "sim_nao",
      "obrigatoria": true,
      "ordem": 1
    },
    {
      "id": "p2",
      "texto": "Cliente/responsável presente no local?",
      "tipo": "sim_nao",
      "obrigatoria": true,
      "ordem": 2
    },
    {
      "id": "p3",
      "texto": "O local foi deixado limpo e organizado?",
      "tipo": "sim_nao",
      "obrigatoria": true,
      "ordem": 3
    },
    {
      "id": "p4",
      "texto": "Observações do serviço",
      "tipo": "texto_longo",
      "obrigatoria": false,
      "ordem": 4
    },
    {
      "id": "p5",
      "texto": "Foto final do serviço",
      "tipo": "foto",
      "obrigatoria": false,
      "ordem": 5
    }
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- Inserir checklist de impedimento
INSERT INTO public.checklists (nome, descricao, tipo, ativo, perguntas) VALUES (
  'Checklist de Impedimento',
  'Checklist para registrar detalhes quando o serviço não pode ser executado',
  'servico',
  true,
  '[
    {
      "id": "p1",
      "texto": "Houve tentativa de contato com o cliente?",
      "tipo": "sim_nao",
      "obrigatoria": true,
      "ordem": 1
    },
    {
      "id": "p2",
      "texto": "Motivo detalhado do impedimento",
      "tipo": "texto_longo",
      "obrigatoria": true,
      "ordem": 2
    },
    {
      "id": "p3",
      "texto": "Foto comprovando o impedimento",
      "tipo": "foto",
      "obrigatoria": true,
      "ordem": 3
    }
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar se as tabelas foram criadas corretamente
SELECT 'Tabela checklist_servico_vinculos criada' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklist_servico_vinculos');

SELECT 'Coluna grupo_retorno adicionada em checklist_respostas' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'checklist_respostas' AND column_name = 'grupo_retorno');

-- Listar checklists de serviço criados
SELECT id, nome, tipo FROM public.checklists WHERE tipo = 'servico';
