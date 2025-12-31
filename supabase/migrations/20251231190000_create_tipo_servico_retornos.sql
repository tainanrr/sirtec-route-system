-- Migration: Criar tabela tipo_servico_retornos e migrar dados
-- Data: 31/12/2025

-- Criar tabela tipo_servico_retornos se não existir
CREATE TABLE IF NOT EXISTS public.tipo_servico_retornos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  retorno_campo_id UUID NOT NULL REFERENCES public.retornos_campo(id) ON DELETE CASCADE,
  ordem INTEGER DEFAULT 0,
  padrao BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, retorno_campo_id)
);

CREATE INDEX IF NOT EXISTS idx_tipo_servico_retornos_skill ON public.tipo_servico_retornos(skill_id);
CREATE INDEX IF NOT EXISTS idx_tipo_servico_retornos_retorno ON public.tipo_servico_retornos(retorno_campo_id);

-- Criar tabela tipo_servico_retorno_atividades se não existir
CREATE TABLE IF NOT EXISTS public.tipo_servico_retorno_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_servico_retorno_id UUID NOT NULL REFERENCES public.tipo_servico_retornos(id) ON DELETE CASCADE,
  atividade_id UUID NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  ordem INTEGER DEFAULT 0,
  obrigatorio BOOLEAN DEFAULT false,
  selecionado_padrao BOOLEAN DEFAULT false,
  qtd_padrao INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tipo_servico_retorno_id, atividade_id)
);

CREATE INDEX IF NOT EXISTS idx_tipo_servico_retorno_atividades_retorno ON public.tipo_servico_retorno_atividades(tipo_servico_retorno_id);

-- Criar tabela de atividades se não existir (para as tabelas de preço)
CREATE TABLE IF NOT EXISTS public.atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(255) NOT NULL UNIQUE,
  descricao VARCHAR(500) NOT NULL,
  categoria VARCHAR(100),
  grupo VARCHAR(100),
  valor_unitario NUMERIC(10, 2) DEFAULT 0,
  unidade VARCHAR(20) DEFAULT 'UN',
  requer_foto BOOLEAN DEFAULT false,
  qtd_min_fotos INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caso a tabela já exista, ajustar o tamanho dos campos
ALTER TABLE public.atividades ALTER COLUMN codigo TYPE VARCHAR(255);
ALTER TABLE public.atividades ALTER COLUMN descricao TYPE VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_atividades_codigo ON public.atividades(codigo);

-- Inserir atividades (tabelas de preço) que ainda não existem
INSERT INTO public.atividades (codigo, descricao, categoria, ativo)
SELECT DISTINCT sr.tabela_preco, sr.tabela_preco, 'Tabela de Preço', true
FROM public.skill_retornos sr
WHERE sr.tabela_preco IS NOT NULL 
  AND sr.tabela_preco != ''
  AND NOT EXISTS (SELECT 1 FROM public.atividades a WHERE a.codigo = sr.tabela_preco)
ON CONFLICT (codigo) DO NOTHING;

-- Migrar dados da skill_retornos para tipo_servico_retornos
-- Primeiro, criar os vínculos únicos entre skill e retorno
INSERT INTO public.tipo_servico_retornos (skill_id, retorno_campo_id, ordem, padrao, ativo)
SELECT DISTINCT
  s.id as skill_id,
  r.id as retorno_campo_id,
  ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY sr.retorno_codigo) - 1 as ordem,
  false as padrao,
  true as ativo
FROM public.skill_retornos sr
INNER JOIN public.skills s ON s.codigo = sr.skill_codigo
INNER JOIN public.retornos_campo r ON r.codigo = sr.retorno_codigo
WHERE sr.ativo = true
ON CONFLICT (skill_id, retorno_campo_id) DO NOTHING;

-- Agora, vincular as atividades (tabelas de preço) aos retornos
INSERT INTO public.tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, ordem, obrigatorio, selecionado_padrao, qtd_padrao, ativo)
SELECT 
  tsr.id as tipo_servico_retorno_id,
  a.id as atividade_id,
  ROW_NUMBER() OVER (PARTITION BY tsr.id ORDER BY sr.tabela_preco) - 1 as ordem,
  CASE WHEN sr.situacao = 'Obrigatorio' THEN true ELSE false END as obrigatorio,
  CASE WHEN sr.situacao LIKE '%selecionado%' THEN true ELSE false END as selecionado_padrao,
  COALESCE(sr.qtd_padrao, 1) as qtd_padrao,
  true as ativo
FROM public.skill_retornos sr
INNER JOIN public.skills s ON s.codigo = sr.skill_codigo
INNER JOIN public.retornos_campo r ON r.codigo = sr.retorno_codigo
INNER JOIN public.tipo_servico_retornos tsr ON tsr.skill_id = s.id AND tsr.retorno_campo_id = r.id
INNER JOIN public.atividades a ON a.codigo = sr.tabela_preco
WHERE sr.tabela_preco IS NOT NULL AND sr.tabela_preco != ''
ON CONFLICT (tipo_servico_retorno_id, atividade_id) DO NOTHING;

-- Definir o primeiro retorno de cada skill como padrão
WITH first_retornos AS (
  SELECT DISTINCT ON (skill_id) id
  FROM public.tipo_servico_retornos
  ORDER BY skill_id, ordem
)
UPDATE public.tipo_servico_retornos 
SET padrao = true
WHERE id IN (SELECT id FROM first_retornos);

