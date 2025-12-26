-- Adicionar campo 'tipo' na tabela tipos_intervalo
-- Tipo 'padrao' = intervalos esperados (almoço)
-- Tipo 'nao_padrao' = intervalos não esperados (oficina, chuva, etc.)

ALTER TABLE tipos_intervalo 
ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'padrao' CHECK (tipo IN ('padrao', 'nao_padrao'));

-- Atualizar intervalos existentes (se houver)
-- Intervalos com nome contendo "almoço" ou "refeição" são padrão
UPDATE tipos_intervalo 
SET tipo = 'padrao' 
WHERE LOWER(nome) LIKE '%almoço%' 
   OR LOWER(nome) LIKE '%almoco%'
   OR LOWER(nome) LIKE '%refeição%'
   OR LOWER(nome) LIKE '%refeicao%'
   OR LOWER(nome) LIKE '%lanche%';

-- Demais intervalos são não padrão
UPDATE tipos_intervalo 
SET tipo = 'nao_padrao' 
WHERE LOWER(nome) LIKE '%oficina%' 
   OR LOWER(nome) LIKE '%chuva%'
   OR LOWER(nome) LIKE '%mecânico%'
   OR LOWER(nome) LIKE '%mecanico%'
   OR LOWER(nome) LIKE '%problema%'
   OR LOWER(nome) LIKE '%manutenção%'
   OR LOWER(nome) LIKE '%manutencao%';

-- Criar alguns intervalos padrão se não existirem
INSERT INTO tipos_intervalo (codigo, nome, tempo_minutos, tipo, cor, ativo)
SELECT 'ALMOCO', 'Almoço', 60, 'padrao', '#10B981', true
WHERE NOT EXISTS (SELECT 1 FROM tipos_intervalo WHERE LOWER(nome) LIKE '%almoço%' OR LOWER(nome) LIKE '%almoco%');

INSERT INTO tipos_intervalo (codigo, nome, tempo_minutos, tipo, cor, ativo)
SELECT 'LANCHE', 'Lanche', 15, 'padrao', '#3B82F6', true
WHERE NOT EXISTS (SELECT 1 FROM tipos_intervalo WHERE LOWER(nome) LIKE '%lanche%');

INSERT INTO tipos_intervalo (codigo, nome, tempo_minutos, tipo, cor, ativo)
SELECT 'OFICINA', 'Oficina/Manutenção', 0, 'nao_padrao', '#EF4444', true
WHERE NOT EXISTS (SELECT 1 FROM tipos_intervalo WHERE LOWER(nome) LIKE '%oficina%');

INSERT INTO tipos_intervalo (codigo, nome, tempo_minutos, tipo, cor, ativo)
SELECT 'CHUVA', 'Chuva/Intempéries', 0, 'nao_padrao', '#6366F1', true
WHERE NOT EXISTS (SELECT 1 FROM tipos_intervalo WHERE LOWER(nome) LIKE '%chuva%');

INSERT INTO tipos_intervalo (codigo, nome, tempo_minutos, tipo, cor, ativo)
SELECT 'OUTROS', 'Outros', 0, 'nao_padrao', '#8B5CF6', true
WHERE NOT EXISTS (SELECT 1 FROM tipos_intervalo WHERE codigo = 'OUTROS');

-- Criar tabela para registrar intervalos das equipes
CREATE TABLE IF NOT EXISTS intervalos_equipe (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipe_id UUID NOT NULL REFERENCES tecnicos(id) ON DELETE CASCADE,
  turno_id UUID REFERENCES turnos(id) ON DELETE SET NULL,
  tipo_intervalo_id UUID NOT NULL REFERENCES tipos_intervalo(id) ON DELETE CASCADE,
  hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  hora_fim TIMESTAMP WITH TIME ZONE,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_intervalos_equipe_equipe_id ON intervalos_equipe(equipe_id);
CREATE INDEX IF NOT EXISTS idx_intervalos_equipe_turno_id ON intervalos_equipe(turno_id);
CREATE INDEX IF NOT EXISTS idx_intervalos_equipe_tipo ON intervalos_equipe(tipo_intervalo_id);
CREATE INDEX IF NOT EXISTS idx_intervalos_equipe_data ON intervalos_equipe(hora_inicio);

-- RLS
ALTER TABLE intervalos_equipe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_intervalos_equipe" ON intervalos_equipe;
CREATE POLICY "allow_all_intervalos_equipe" ON intervalos_equipe FOR ALL USING (true) WITH CHECK (true);

