-- Adicionar campos de configuração de jornada e roteirização na tabela tecnicos

ALTER TABLE public.tecnicos
ADD COLUMN IF NOT EXISTS hora_inicio TEXT DEFAULT '07:30',
ADD COLUMN IF NOT EXISTS almoco JSONB DEFAULT '{"duracao": 60, "janelaInicio": "11:00", "janelaFim": "14:00"}'::jsonb,
ADD COLUMN IF NOT EXISTS local_partida JSONB,
ADD COLUMN IF NOT EXISTS local_chegada JSONB,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8),
ADD COLUMN IF NOT EXISTS jornada_horas INTEGER DEFAULT 8,
ADD COLUMN IF NOT EXISTS max_horas_trabalho INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';

-- Comentários para documentação
COMMENT ON COLUMN public.tecnicos.hora_inicio IS 'Horário de início do dia de trabalho (formato HH:mm)';
COMMENT ON COLUMN public.tecnicos.almoco IS 'Configuração de almoço: {duracao: minutos, janelaInicio: HH:mm, janelaFim: HH:mm}';
COMMENT ON COLUMN public.tecnicos.local_partida IS 'Localização de partida (casa do técnico): {lat: number, lng: number}';
COMMENT ON COLUMN public.tecnicos.local_chegada IS 'Localização de chegada (ponto de retorno): {lat: number, lng: number}';
COMMENT ON COLUMN public.tecnicos.latitude IS 'Latitude da base/escritório (usado se local_partida não definido)';
COMMENT ON COLUMN public.tecnicos.longitude IS 'Longitude da base/escritório (usado se local_partida não definido)';
COMMENT ON COLUMN public.tecnicos.jornada_horas IS 'Horas disponíveis por dia (padrão 8h)';
COMMENT ON COLUMN public.tecnicos.max_horas_trabalho IS 'Capacidade máxima de trabalho (ex: 10h)';
COMMENT ON COLUMN public.tecnicos.color IS 'Cor hexadecimal para visualização no mapa';











