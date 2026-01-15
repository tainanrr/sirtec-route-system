-- =====================================================
-- Migration: Adicionar campo contatos_extraidos na tabela ordens_servico
-- Objetivo: Armazenar contatos extraídos das observações usando IA
-- para disponibilizar offline no app
-- =====================================================

-- Adicionar coluna contatos_extraidos (JSONB para armazenar array de contatos)
ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS contatos_extraidos JSONB;

-- Comentário explicativo
COMMENT ON COLUMN public.ordens_servico.contatos_extraidos IS 
'Contatos extraídos das observações usando IA. Formato: [{nome, telefone, telefoneLimpo, tipo, relacao, observacao}]';

-- Índice GIN para busca eficiente em JSONB
CREATE INDEX IF NOT EXISTS idx_os_contatos_extraidos ON public.ordens_servico USING GIN (contatos_extraidos);

-- Exemplo de estrutura do JSON:
-- [
--   {
--     "nome": "João Silva",
--     "telefone": "(71) 99999-9999",
--     "telefoneLimpo": "71999999999",
--     "tipo": "celular",
--     "relacao": "cliente",
--     "observacao": "ligar após 14h"
--   }
-- ]
