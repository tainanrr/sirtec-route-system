-- Migration: Criar tabela grupos_retorno para gerenciamento dinâmico de grupos
-- Data: 02/01/2026

-- Criar tabela grupos_retorno
CREATE TABLE IF NOT EXISTS public.grupos_retorno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  cor VARCHAR(7) DEFAULT '#6b7280',
  cor_fundo VARCHAR(7) DEFAULT '#f3f4f6',
  cor_texto VARCHAR(7) DEFAULT '#374151',
  cor_borda VARCHAR(7) DEFAULT '#e5e7eb',
  icone VARCHAR(50) DEFAULT 'circle',
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grupos_retorno_codigo ON public.grupos_retorno(codigo);
CREATE INDEX IF NOT EXISTS idx_grupos_retorno_ordem ON public.grupos_retorno(ordem);

-- Inserir grupos padrão
INSERT INTO public.grupos_retorno (codigo, nome, cor, cor_fundo, cor_texto, cor_borda, icone, ordem)
VALUES 
  ('executado', 'Executado', '#22c55e', '#f0fdf4', '#15803d', '#bbf7d0', 'check-circle', 0),
  ('impedimento', 'Impedimento', '#ef4444', '#fef2f2', '#b91c1c', '#fecaca', 'alert-triangle', 1),
  ('parcial', 'Parcial', '#eab308', '#fefce8', '#a16207', '#fef08a', 'clock', 2)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  cor = EXCLUDED.cor,
  cor_fundo = EXCLUDED.cor_fundo,
  cor_texto = EXCLUDED.cor_texto,
  cor_borda = EXCLUDED.cor_borda,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem;

-- Adicionar coluna grupo_id em retornos_campo se não existir (para referência)
-- Mantemos a coluna tipo para compatibilidade, mas adicionamos a FK
ALTER TABLE public.retornos_campo ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES public.grupos_retorno(id);

-- Popular grupo_id baseado no tipo existente
UPDATE public.retornos_campo rc
SET grupo_id = gr.id
FROM public.grupos_retorno gr
WHERE rc.tipo = gr.codigo AND rc.grupo_id IS NULL;

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_grupos_retorno_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_grupos_retorno_updated_at ON public.grupos_retorno;
CREATE TRIGGER trigger_grupos_retorno_updated_at
  BEFORE UPDATE ON public.grupos_retorno
  FOR EACH ROW
  EXECUTE FUNCTION update_grupos_retorno_updated_at();

-- Habilitar RLS
ALTER TABLE public.grupos_retorno ENABLE ROW LEVEL SECURITY;

-- Política de leitura para todos os usuários autenticados
DROP POLICY IF EXISTS "Permitir leitura de grupos_retorno para usuários autenticados" ON public.grupos_retorno;
CREATE POLICY "Permitir leitura de grupos_retorno para usuários autenticados"
  ON public.grupos_retorno FOR SELECT
  TO authenticated
  USING (true);

-- Política de inserção para usuários autenticados
DROP POLICY IF EXISTS "Permitir inserção de grupos_retorno para usuários autenticados" ON public.grupos_retorno;
CREATE POLICY "Permitir inserção de grupos_retorno para usuários autenticados"
  ON public.grupos_retorno FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política de atualização para usuários autenticados
DROP POLICY IF EXISTS "Permitir atualização de grupos_retorno para usuários autenticados" ON public.grupos_retorno;
CREATE POLICY "Permitir atualização de grupos_retorno para usuários autenticados"
  ON public.grupos_retorno FOR UPDATE
  TO authenticated
  USING (true);

-- Política de exclusão para usuários autenticados
DROP POLICY IF EXISTS "Permitir exclusão de grupos_retorno para usuários autenticados" ON public.grupos_retorno;
CREATE POLICY "Permitir exclusão de grupos_retorno para usuários autenticados"
  ON public.grupos_retorno FOR DELETE
  TO authenticated
  USING (true);

