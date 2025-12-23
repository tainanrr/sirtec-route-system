-- Guardar assinatura da equipe ao confirmar devolução solicitada pelo almoxarifado

ALTER TABLE public.materiais_devolucoes
ADD COLUMN IF NOT EXISTS assinatura_confirmacao_equipe TEXT;




