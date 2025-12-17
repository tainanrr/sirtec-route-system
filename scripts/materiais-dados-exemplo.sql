-- =====================================================
-- DADOS DE EXEMPLO PARA O MÓDULO DE MATERIAIS
-- Script para popular o sistema com materiais e simular operações
-- =====================================================

-- Inserir materiais de exemplo (selecionados de cada categoria)
INSERT INTO materiais (codigo, nome, descricao, categoria, unidade, valor_unitario, estoque_minimo, estoque_maximo, requer_serial, ativo) VALUES
-- Cabos e Fios
('2201008', 'FIO NU COBRE 10,00MM2', 'Fio nu de cobre 10mm²', 'cabos_condutores', 'M', 15.50, 100, 1000, false, true),
('2203016', 'CABO NU COBRE 35,00MM2 2A MD', 'Cabo nu de cobre 35mm²', 'cabos_condutores', 'M', 45.00, 50, 500, false, true),
('2227000', 'CABO POT CU CONC 1KV 2X 6,00', 'Cabo de potência cobre concêntrico 1KV 2x6mm²', 'cabos_condutores', 'M', 25.00, 80, 800, false, true),
('2230035', 'CABO AS AL 1KV 3X 10RC+1X 10 NI', 'Cabo aéreo simples alumínio 1KV 3x10mm²', 'cabos_condutores', 'M', 30.00, 60, 600, false, true),
('7709766', 'CABO MLP ALUM XLPE 3X1X16/16MM2 N ISO', 'Cabo multiplexado alumínio XLPE 3x16mm²', 'cabos_condutores', 'M', 55.00, 40, 400, false, true),

-- CCM-Alças/Emendas
('2454005', 'EMENDA PREF TOTAL AL CAA 336 LINNET', 'Emenda pré-formada total alumínio CAA 336', 'conectores', 'CDA', 120.00, 20, 200, false, true),
('3430001', 'ALCA PREF SERV AS COBRE 10-16MM2', 'Alça pré-formada serviço aéreo simples cobre 10-16mm²', 'conectores', 'CDA', 8.50, 50, 500, false, true),
('3430005', 'ALCA PREF SERV AS COBRE 25MM2', 'Alça pré-formada serviço aéreo simples cobre 25mm²', 'conectores', 'CDA', 12.00, 30, 300, false, true),

-- CCM-Trafos
('231007', 'TRAFO COR MED INTERNO 15KV 10-5A', 'Transformador de corrente média interna 15KV 10-5A', 'transformadores', 'SR', 850.00, 5, 50, true, true),

-- Conectores
('318', 'CONECTOR PERFURANTE - TIPO (MORCEGO)', 'Conector perfurante tipo morcego', 'conectores', 'UN', 15.00, 100, 1000, false, true),
('2401000', 'CONECTOR CUNHA EST CINZA', 'Conector cunha estriada cinza', 'conectores', 'UN', 3.50, 200, 2000, false, true),
('2412003', 'CONECTOR PERF 10,0- 35,0/ 1,5- 6,0', 'Conector perfurante 10-35mm² / 1,5-6mm²', 'conectores', 'UN', 8.00, 150, 1500, false, true),

-- Ferragens e Acessórios
('2660000', 'FITA ISOL EPR AUTO-FUSAO PRETA 19MMX10M', 'Fita isolante EPR auto-fusão preta 19mm x 10m', 'ferragens', 'M', 25.00, 30, 300, false, true),
('2660001', 'FITA ISOL PVC 19,0MM PRETA', 'Fita isolante PVC 19mm preta', 'ferragens', 'M', 5.00, 50, 500, false, true),
('300013', 'DISJUNTOR BT 1P 16A 230VCA 3KA B', 'Disjuntor baixa tensão 1 polo 16A 230V', 'chaves_fusíveis', 'UN', 45.00, 20, 200, false, true),
('300019', 'DISJUNTOR BT 1P 40A 230VCA 3KA', 'Disjuntor baixa tensão 1 polo 40A 230V', 'chaves_fusíveis', 'UN', 55.00, 15, 150, false, true),
('3221003', 'PADRAO ENTRADA ACO 5000MM SAÍDA AEREA', 'Padrão de entrada aço 5000mm saída aérea', 'postes_estruturas', 'UN', 180.00, 10, 100, false, true),
('3401016', 'CENTRO DISTRIBUICAO 1 DISJ 1P DIN', 'Centro de distribuição 1 disjuntor 1 polo DIN', 'equipamentos_protecao', 'UN', 120.00, 15, 150, false, true),

-- Medidores (requerem serial)
('800000', 'MEDIDOR WH 1F 120V 15,0A 1EL', 'Medidor watt-hora monofásico 120V 15A 1 elemento', 'medidores', 'SR', 350.00, 10, 100, true, true),
('800001', 'MEDIDOR WH 1F 240V 15,0A 1EL', 'Medidor watt-hora monofásico 240V 15A 1 elemento', 'medidores', 'SR', 360.00, 10, 100, true, true),
('801000', 'MEDIDOR WH 3F 240V 15,0A 3EL', 'Medidor watt-hora trifásico 240V 15A 3 elementos', 'medidores', 'SR', 580.00, 5, 50, true, true),
('802058', 'MEDIDOR ELET WH 1F 240V 15/100A DY/B TS', 'Medidor eletrônico monofásico 240V 15/100A', 'medidores', 'SR', 420.00, 8, 80, true, true),

-- Poste/Cruzeta
('7709880', 'PADRAO ENTRADA FIBRA VIDRO 5000MM C/ATER', 'Padrão de entrada fibra de vidro 5000mm com aterramento', 'postes_estruturas', 'UN', 220.00, 8, 80, false, true),
('7709881', 'PADRAO ENTRADA FIBRA VIDRO 7000MM C/ATER', 'Padrão de entrada fibra de vidro 7000mm com aterramento', 'postes_estruturas', 'UN', 280.00, 5, 50, false, true),

-- Selos
('7709955', 'SELO POLICARBONATO VERDE - EQUIPE TERC.', 'Selo de policarbonato verde para equipe terceirizada', 'consumiveis', 'SR', 2.50, 500, 5000, false, true)

ON CONFLICT (codigo) DO NOTHING;

-- Criar estoque inicial no estoque central para alguns materiais
INSERT INTO materiais_estoque (material_id, quantidade, local_tipo, local_id)
SELECT 
  m.id,
  CASE 
    WHEN m.categoria = 'medidores' THEN 15
    WHEN m.categoria = 'cabos_condutores' THEN 200
    WHEN m.categoria = 'conectores' THEN 150
    WHEN m.categoria = 'ferragens' THEN 100
    WHEN m.categoria = 'postes_estruturas' THEN 12
    ELSE 50
  END,
  'central',
  NULL
FROM materiais m
WHERE m.codigo IN (
  '2201008', '2203016', '2227000', '2230035', '7709766',
  '2454005', '3430001', '3430005',
  '318', '2401000', '2412003',
  '2660000', '2660001', '300013', '300019', '3221003', '3401016',
  '800000', '800001', '801000', '802058',
  '7709880', '7709881',
  '7709955'
)
ON CONFLICT (material_id, local_tipo, local_id) DO NOTHING;

-- Simular algumas movimentações de entrada (recebimentos)
-- Recebimento 1: Cabos e conectores
DO $$
DECLARE
  rec_id UUID;
  mat_id UUID;
BEGIN
  -- Criar recebimento
  INSERT INTO materiais_recebimentos (numero_documento, fornecedor, status, data_recebimento)
  VALUES ('NF-2024-001234', 'CPFL Energia', 'finalizado', NOW() - INTERVAL '5 days')
  RETURNING id INTO rec_id;

  -- Itens do recebimento
  INSERT INTO materiais_recebimentos_itens (recebimento_id, material_id, quantidade_esperada, quantidade_recebida)
  SELECT rec_id, m.id, 100, 100
  FROM materiais m
  WHERE m.codigo IN ('2201008', '2227000', '318', '2401000');

  -- Registrar movimentações de entrada
  INSERT INTO materiais_movimentacoes (material_id, tipo, quantidade, quantidade_anterior, quantidade_nova, local_origem_tipo, local_destino_tipo, documento_referencia, observacao)
  SELECT 
    m.id,
    'entrada',
    100,
    COALESCE((SELECT quantidade FROM materiais_estoque WHERE material_id = m.id AND local_tipo = 'central' LIMIT 1), 0),
    COALESCE((SELECT quantidade FROM materiais_estoque WHERE material_id = m.id AND local_tipo = 'central' LIMIT 1), 0) + 100,
    'externo',
    'central',
    'NF-2024-001234',
    'Recebimento de materiais da CPFL'
  FROM materiais m
  WHERE m.codigo IN ('2201008', '2227000', '318', '2401000');
END $$;

-- Simular algumas movimentações de saída (entregas para equipes)
-- Assumindo que existe uma equipe com ID (você precisará ajustar)
DO $$
DECLARE
  entrega_id UUID;
  equipe_exemplo_id UUID;
  mat_id UUID;
BEGIN
  -- Buscar primeira equipe disponível (ajuste conforme necessário)
  SELECT id INTO equipe_exemplo_id FROM tecnicos WHERE status = 'disponivel' LIMIT 1;
  
  IF equipe_exemplo_id IS NOT NULL THEN
    -- Criar entrega
    INSERT INTO materiais_entregas (equipe_id, data_entrega, status, observacao)
    VALUES (equipe_exemplo_id, NOW() - INTERVAL '3 days', 'recebida', 'Entrega inicial de materiais')
    RETURNING id INTO entrega_id;

    -- Itens da entrega
    INSERT INTO materiais_entregas_itens (entrega_id, material_id, quantidade)
    SELECT entrega_id, m.id, 20
    FROM materiais m
    WHERE m.codigo IN ('2201008', '318', '2401000', '2660001', '300013');

    -- Atualizar estoque (baixa do central, entrada na equipe)
    FOR mat_id IN 
      SELECT m.id FROM materiais m WHERE m.codigo IN ('2201008', '318', '2401000', '2660001', '300013')
    LOOP
      -- Baixa do estoque central
      UPDATE materiais_estoque 
      SET quantidade = quantidade - 20
      WHERE material_id = mat_id AND local_tipo = 'central';

      -- Entrada no estoque da equipe
      INSERT INTO materiais_estoque (material_id, quantidade, local_tipo, local_id)
      VALUES (mat_id, 20, 'equipe', equipe_exemplo_id)
      ON CONFLICT (material_id, local_tipo, local_id) 
      DO UPDATE SET quantidade = materiais_estoque.quantidade + 20;

      -- Registrar movimentação
      INSERT INTO materiais_movimentacoes (material_id, tipo, quantidade, local_origem_tipo, local_destino_tipo, local_destino_id, entrega_id, observacao)
      VALUES (mat_id, 'transferencia', 20, 'central', 'equipe', equipe_exemplo_id, entrega_id, 'Entrega para equipe de campo');
    END LOOP;
  END IF;
END $$;

-- Cadastrar alguns medidores serializados
INSERT INTO materiais_serializados (material_id, numero_serie, status, localizacao_tipo, observacao)
SELECT 
  m.id,
  'MED' || LPAD(ROW_NUMBER() OVER ()::text, 8, '0'),
  'em_estoque',
  'central',
  'Medidor cadastrado para estoque'
FROM materiais m
WHERE m.categoria = 'medidores' AND m.requer_serial = true
LIMIT 10
ON CONFLICT (numero_serie) DO NOTHING;

-- Simular uma aplicação de material em OS (se existir uma OS)
DO $$
DECLARE
  os_id UUID;
  mat_id UUID;
  equipe_id UUID;
BEGIN
  -- Buscar primeira OS em andamento (ajuste conforme necessário)
  SELECT id INTO os_id FROM ordens_servico WHERE status IN ('em_andamento', 'em_execucao', 'no_local') LIMIT 1;
  
  -- Buscar primeira equipe disponível
  SELECT id INTO equipe_id FROM tecnicos WHERE status = 'disponivel' LIMIT 1;
  
  IF os_id IS NOT NULL AND equipe_id IS NOT NULL THEN
    -- Buscar material de cabo
    SELECT id INTO mat_id FROM materiais WHERE codigo = '2201008' LIMIT 1;
    
    IF mat_id IS NOT NULL THEN
      -- Aplicar material na OS
      INSERT INTO materiais_aplicados_os (ordem_servico_id, material_id, quantidade, tipo, equipe_id, observacao)
      VALUES (os_id, mat_id, 15, 'aplicado', equipe_id, 'Cabo aplicado para instalação');

      -- Baixa do estoque da equipe
      UPDATE materiais_estoque 
      SET quantidade = quantidade - 15
      WHERE material_id = mat_id AND local_tipo = 'equipe' AND local_id = equipe_id;

      -- Registrar movimentação
      INSERT INTO materiais_movimentacoes (material_id, tipo, quantidade, local_origem_tipo, local_origem_id, local_destino_tipo, local_destino_id, ordem_servico_id, observacao)
      VALUES (mat_id, 'saida', 15, 'equipe', equipe_id, 'campo', os_id, os_id, 'Material aplicado na OS');
    END IF;
  END IF;
END $$;

-- Atualizar timestamps
UPDATE materiais SET updated_at = NOW() WHERE codigo IN (
  '2201008', '2203016', '2227000', '2230035', '7709766',
  '2454005', '3430001', '3430005',
  '318', '2401000', '2412003',
  '2660000', '2660001', '300013', '300019', '3221003', '3401016',
  '800000', '800001', '801000', '802058',
  '7709880', '7709881',
  '7709955'
);

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Dados de exemplo inseridos com sucesso!';
  RAISE NOTICE 'Materiais cadastrados: 24 itens';
  RAISE NOTICE 'Estoque inicial criado no estoque central';
  RAISE NOTICE 'Movimentações simuladas: recebimentos, entregas e aplicações';
  RAISE NOTICE 'Medidores serializados cadastrados: 10 unidades';
END $$;

