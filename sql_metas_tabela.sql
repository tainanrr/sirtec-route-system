-- Criar ou atualizar a tabela 'metas' com a estrutura correta
-- Esta tabela armazena as metas de produção das equipes

-- Primeiro, verificar se a tabela existe e tem a estrutura correta
-- Se não existir, criar do zero

CREATE TABLE IF NOT EXISTS public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  meta_quantidade INTEGER NOT NULL DEFAULT 0,
  meta_valor DECIMAL(12, 2),
  tipo_meta VARCHAR(50) NOT NULL DEFAULT 'producao',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint para evitar duplicação (uma meta por equipe por dia)
  CONSTRAINT metas_equipe_data_unique UNIQUE (equipe_id, data)
);

-- Adicionar colunas caso a tabela já exista mas esteja incompleta
DO $$
BEGIN
  -- Adicionar meta_quantidade se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'metas' 
                 AND column_name = 'meta_quantidade') THEN
    ALTER TABLE public.metas ADD COLUMN meta_quantidade INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- Adicionar meta_valor se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'metas' 
                 AND column_name = 'meta_valor') THEN
    ALTER TABLE public.metas ADD COLUMN meta_valor DECIMAL(12, 2);
  END IF;

  -- Adicionar tipo_meta se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'metas' 
                 AND column_name = 'tipo_meta') THEN
    ALTER TABLE public.metas ADD COLUMN tipo_meta VARCHAR(50) NOT NULL DEFAULT 'producao';
  END IF;

  -- Adicionar data se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'metas' 
                 AND column_name = 'data') THEN
    ALTER TABLE public.metas ADD COLUMN data DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  -- Adicionar contrato_id se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'metas' 
                 AND column_name = 'contrato_id') THEN
    ALTER TABLE public.metas ADD COLUMN contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL;
  END IF;

  -- Adicionar updated_at se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'metas' 
                 AND column_name = 'updated_at') THEN
    ALTER TABLE public.metas ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_metas_equipe_id ON public.metas(equipe_id);
CREATE INDEX IF NOT EXISTS idx_metas_data ON public.metas(data);
CREATE INDEX IF NOT EXISTS idx_metas_contrato_id ON public.metas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_metas_equipe_data ON public.metas(equipe_id, data);

-- Adicionar constraint UNIQUE se não existir (pode falhar se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'metas_equipe_data_unique'
  ) THEN
    ALTER TABLE public.metas ADD CONSTRAINT metas_equipe_data_unique UNIQUE (equipe_id, data);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso (permitir tudo para usuários autenticados)
DROP POLICY IF EXISTS "Permitir acesso total para autenticados" ON public.metas;
CREATE POLICY "Permitir acesso total para autenticados" ON public.metas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.metas IS 'Tabela de metas de produção das equipes';
COMMENT ON COLUMN public.metas.equipe_id IS 'ID da equipe (referência para tecnicos)';
COMMENT ON COLUMN public.metas.contrato_id IS 'ID do contrato (opcional)';
COMMENT ON COLUMN public.metas.data IS 'Data da meta';
COMMENT ON COLUMN public.metas.meta_quantidade IS 'Meta de quantidade (número de OSs)';
COMMENT ON COLUMN public.metas.meta_valor IS 'Meta de valor (R$)';
COMMENT ON COLUMN public.metas.tipo_meta IS 'Tipo da meta: producao, qualidade, faturamento';







