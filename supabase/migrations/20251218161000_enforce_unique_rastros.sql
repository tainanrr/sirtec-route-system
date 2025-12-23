-- Garantir unicidade de rastros (número de série) no sistema.
-- 1) Não permitir cadastrar o mesmo número de série duas vezes na tabela principal.
CREATE UNIQUE INDEX IF NOT EXISTS ux_materiais_serializados_numero_serie
  ON public.materiais_serializados (numero_serie);

-- 2) Não permitir que o mesmo rastro seja "reservado" em mais de um recebimento.
CREATE UNIQUE INDEX IF NOT EXISTS ux_materiais_recebimentos_rastros_numero_serie
  ON public.materiais_recebimentos_itens_rastros (numero_serie);





