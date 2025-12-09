-- Criar bucket para fotos e anexos dos serviços
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-attachments', 'service-attachments', true);

-- Políticas para upload de anexos
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-attachments');

CREATE POLICY "Authenticated users can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'service-attachments');

CREATE POLICY "Authenticated users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'service-attachments');

-- Tabela para anexos das ordens de serviço
CREATE TABLE public.ordem_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'foto', 'assinatura', 'documento'
  url TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.ordem_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view anexos"
ON public.ordem_anexos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage anexos"
ON public.ordem_anexos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Tabela para respostas de checklist
CREATE TABLE public.checklist_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  checklist_id UUID NOT NULL REFERENCES public.checklists(id),
  respostas JSONB NOT NULL DEFAULT '[]',
  concluido BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist_respostas"
ON public.checklist_respostas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage checklist_respostas"
ON public.checklist_respostas FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_checklist_respostas_updated_at
  BEFORE UPDATE ON public.checklist_respostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para registro de materiais usados
CREATE TABLE public.ordem_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'lacre', 'medidor', 'cabo', etc
  codigo TEXT,
  quantidade INTEGER DEFAULT 1,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ordem_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ordem_materiais"
ON public.ordem_materiais FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage ordem_materiais"
ON public.ordem_materiais FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Adicionar campos extras na tabela de ordens para tracking de tempo
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS iniciado_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS concluido_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pausado_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tempo_total_minutos INTEGER DEFAULT 0;

-- Habilitar realtime para ordens
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_servico;