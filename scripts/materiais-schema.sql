-- =====================================================
-- MÓDULO DE GESTÃO DE MATERIAIS - SETOR ELÉTRICO
-- Script de criação das tabelas
-- =====================================================

-- Tabela principal de materiais (catálogo)
CREATE TABLE IF NOT EXISTS materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(100) NOT NULL,
  unidade VARCHAR(10) NOT NULL DEFAULT 'UN',
  valor_unitario DECIMAL(12, 2),
  estoque_minimo INTEGER DEFAULT 0,
  estoque_maximo INTEGER,
  localizacao VARCHAR(255),
  codigo_barras VARCHAR(100),
  codigo_concessionaria VARCHAR(100),
  requer_serial BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para materiais
CREATE INDEX IF NOT EXISTS idx_materiais_codigo ON materiais(codigo);
CREATE INDEX IF NOT EXISTS idx_materiais_categoria ON materiais(categoria);
CREATE INDEX IF NOT EXISTS idx_materiais_ativo ON materiais(ativo);
CREATE INDEX IF NOT EXISTS idx_materiais_codigo_barras ON materiais(codigo_barras);

-- Tabela de estoque (posições)
CREATE TABLE IF NOT EXISTS materiais_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0,
  local_tipo VARCHAR(50) NOT NULL, -- 'central', 'equipe', 'veiculo'
  local_id UUID, -- ID da equipe/veículo se aplicável
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(material_id, local_tipo, local_id)
);

-- Índices para estoque
CREATE INDEX IF NOT EXISTS idx_estoque_material ON materiais_estoque(material_id);
CREATE INDEX IF NOT EXISTS idx_estoque_local ON materiais_estoque(local_tipo, local_id);

-- Tabela de movimentações
CREATE TABLE IF NOT EXISTS materiais_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL, -- 'entrada', 'saida', 'transferencia', 'ajuste'
  quantidade INTEGER NOT NULL,
  quantidade_anterior INTEGER,
  quantidade_nova INTEGER,
  local_origem_tipo VARCHAR(50),
  local_origem_id UUID,
  local_destino_tipo VARCHAR(50),
  local_destino_id UUID,
  ordem_servico_id UUID REFERENCES ordens_servico(id),
  entrega_id UUID,
  documento_referencia VARCHAR(100),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Índices para movimentações
CREATE INDEX IF NOT EXISTS idx_movimentacoes_material ON materiais_movimentacoes(material_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON materiais_movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON materiais_movimentacoes(created_at);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_os ON materiais_movimentacoes(ordem_servico_id);

-- Tabela de recebimentos (da concessionária)
CREATE TABLE IF NOT EXISTS materiais_recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_documento VARCHAR(100),
  data_recebimento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fornecedor VARCHAR(255),
  observacao TEXT,
  status VARCHAR(50) DEFAULT 'pendente', -- 'pendente', 'conferido', 'finalizado'
  conferido_por UUID,
  data_conferencia TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Tabela de itens do recebimento
CREATE TABLE IF NOT EXISTS materiais_recebimentos_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id UUID NOT NULL REFERENCES materiais_recebimentos(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materiais(id),
  quantidade_esperada INTEGER NOT NULL,
  quantidade_recebida INTEGER,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de entregas às equipes
CREATE TABLE IF NOT EXISTS materiais_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES tecnicos(id),
  data_entrega TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'pendente', -- 'pendente', 'recebida', 'cancelada'
  observacao TEXT,
  assinatura_recebimento TEXT, -- Base64 da assinatura
  data_recebimento TIMESTAMPTZ,
  recebido_por VARCHAR(255),
  latitude_recebimento DECIMAL(10, 8),
  longitude_recebimento DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Índices para entregas
CREATE INDEX IF NOT EXISTS idx_entregas_equipe ON materiais_entregas(equipe_id);
CREATE INDEX IF NOT EXISTS idx_entregas_status ON materiais_entregas(status);
CREATE INDEX IF NOT EXISTS idx_entregas_data ON materiais_entregas(data_entrega);

-- Tabela de itens da entrega
CREATE TABLE IF NOT EXISTS materiais_entregas_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id UUID NOT NULL REFERENCES materiais_entregas(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materiais(id),
  quantidade INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de materiais serializados (medidores, etc.)
CREATE TABLE IF NOT EXISTS materiais_serializados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materiais(id),
  numero_serie VARCHAR(100) UNIQUE NOT NULL,
  lote VARCHAR(100),
  data_fabricacao DATE,
  data_validade DATE,
  status VARCHAR(50) DEFAULT 'em_estoque', -- 'em_estoque', 'em_transito', 'com_equipe', 'instalado', 'retirado', 'defeito', 'descartado'
  localizacao_tipo VARCHAR(50) DEFAULT 'central', -- 'central', 'equipe', 'campo'
  localizacao_id UUID,
  ordem_servico_id UUID REFERENCES ordens_servico(id),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para serializados
CREATE INDEX IF NOT EXISTS idx_serializados_numero ON materiais_serializados(numero_serie);
CREATE INDEX IF NOT EXISTS idx_serializados_material ON materiais_serializados(material_id);
CREATE INDEX IF NOT EXISTS idx_serializados_status ON materiais_serializados(status);
CREATE INDEX IF NOT EXISTS idx_serializados_os ON materiais_serializados(ordem_servico_id);

-- Tabela de histórico de serializados
CREATE TABLE IF NOT EXISTS materiais_serializados_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serializado_id UUID NOT NULL REFERENCES materiais_serializados(id) ON DELETE CASCADE,
  acao VARCHAR(100) NOT NULL,
  status_anterior VARCHAR(50),
  status_novo VARCHAR(50),
  localizacao_anterior VARCHAR(255),
  localizacao_nova VARCHAR(255),
  ordem_servico_id UUID REFERENCES ordens_servico(id),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Tabela de materiais aplicados/retirados em OS
CREATE TABLE IF NOT EXISTS materiais_aplicados_os (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id),
  material_id UUID NOT NULL REFERENCES materiais(id),
  quantidade INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- 'aplicado', 'retirado'
  numero_serie VARCHAR(100),
  observacao TEXT,
  equipe_id UUID REFERENCES tecnicos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para aplicados
CREATE INDEX IF NOT EXISTS idx_aplicados_os ON materiais_aplicados_os(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_aplicados_material ON materiais_aplicados_os(material_id);
CREATE INDEX IF NOT EXISTS idx_aplicados_tipo ON materiais_aplicados_os(tipo);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar triggers
DROP TRIGGER IF EXISTS update_materiais_updated_at ON materiais;
CREATE TRIGGER update_materiais_updated_at
    BEFORE UPDATE ON materiais
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estoque_updated_at ON materiais_estoque;
CREATE TRIGGER update_estoque_updated_at
    BEFORE UPDATE ON materiais_estoque
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_serializados_updated_at ON materiais_serializados;
CREATE TRIGGER update_serializados_updated_at
    BEFORE UPDATE ON materiais_serializados
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_recebimentos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_entregas_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_serializados ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_serializados_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_aplicados_os ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permitir tudo para usuários autenticados)
CREATE POLICY "Allow all for authenticated users" ON materiais FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON materiais_estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON materiais_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON materiais_recebimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON materiais_recebimentos_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON materiais_entregas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON materiais_entregas_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON materiais_serializados FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON materiais_serializados_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON materiais_aplicados_os FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permitir acesso anônimo também (para o app mobile)
CREATE POLICY "Allow all for anon" ON materiais FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON materiais_estoque FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON materiais_movimentacoes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON materiais_recebimentos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON materiais_recebimentos_itens FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON materiais_entregas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON materiais_entregas_itens FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON materiais_serializados FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON materiais_serializados_historico FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON materiais_aplicados_os FOR ALL TO anon USING (true) WITH CHECK (true);

-- Dados de exemplo (categorias comuns do setor elétrico)
-- INSERT INTO materiais (codigo, nome, categoria, unidade, estoque_minimo, requer_serial) VALUES
-- ('MED001', 'Medidor Monofásico Digital', 'medidores', 'UN', 10, true),
-- ('MED002', 'Medidor Trifásico Digital', 'medidores', 'UN', 5, true),
-- ('CAB001', 'Cabo Flexível 10mm²', 'cabos_condutores', 'M', 100, false),
-- ('CAB002', 'Cabo Flexível 16mm²', 'cabos_condutores', 'M', 50, false),
-- ('CON001', 'Conector Perfurante', 'conectores', 'UN', 50, false),
-- ('FUS001', 'Fusível NH 100A', 'chaves_fusíveis', 'UN', 20, false);

COMMENT ON TABLE materiais IS 'Catálogo de materiais do setor elétrico';
COMMENT ON TABLE materiais_estoque IS 'Posições de estoque (central, equipes, veículos)';
COMMENT ON TABLE materiais_movimentacoes IS 'Histórico de todas as movimentações';
COMMENT ON TABLE materiais_recebimentos IS 'Recebimentos de materiais da concessionária';
COMMENT ON TABLE materiais_entregas IS 'Entregas de materiais às equipes de campo';
COMMENT ON TABLE materiais_serializados IS 'Itens com número de série (medidores, etc.)';
COMMENT ON TABLE materiais_aplicados_os IS 'Materiais aplicados/retirados em ordens de serviço';







