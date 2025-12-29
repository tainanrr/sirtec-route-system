-- ============================================
-- IMPORTAÇÃO DE RETORNOS DE CAMPO E ATIVIDADES
-- Tipo de Serviço: Religação de Energia
-- ============================================

-- ============================================
-- 0. GARANTIR QUE CONSTRAINTS ÚNICAS EXISTEM
-- ============================================
-- Criar constraints se não existirem (ignorar erro se já existir)
DO $$
BEGIN
    -- Constraint para atividades
    BEGIN
        ALTER TABLE atividades ADD CONSTRAINT atividades_codigo_unique UNIQUE (codigo);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN
        -- Constraint já existe, ignorar
    END;
    
    -- Constraint para retornos_campo
    BEGIN
        ALTER TABLE retornos_campo ADD CONSTRAINT retornos_campo_codigo_unique UNIQUE (codigo);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN
        -- Constraint já existe, ignorar
    END;
    
    -- Constraint para skills (se não existir)
    BEGIN
        ALTER TABLE skills ADD CONSTRAINT skills_codigo_unique UNIQUE (codigo);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN
        -- Constraint já existe, ignorar
    END;
    
    -- Constraint para tipo_servico_retornos
    BEGIN
        ALTER TABLE tipo_servico_retornos ADD CONSTRAINT tipo_servico_retornos_unique UNIQUE (skill_id, retorno_campo_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN
        -- Constraint já existe, ignorar
    END;
    
    -- Constraint para tipo_servico_retorno_atividades
    BEGIN
        ALTER TABLE tipo_servico_retorno_atividades ADD CONSTRAINT tipo_servico_retorno_atividades_unique UNIQUE (tipo_servico_retorno_id, atividade_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN
        -- Constraint já existe, ignorar
    END;
END $$;

-- ============================================
-- 1. INSERIR ATIVIDADES (Tabela de Preço)
-- ============================================
INSERT INTO atividades (codigo, descricao, ativo)
VALUES 
    ('SDCCU6419SC', 'SERV NAO EFETUADA DEF TECNICA PADRAO-BT', true),
    ('SDCLU6013II', 'INSTALAR RAMAL DE LIG-MONO-BT', true),
    ('SDCLU6013RD', 'RETIRAR RAMAL DE LIG MONO-BT', true),
    ('SDCLU6012II', 'INSTALAR RAMAL DE LIG POLI-BT', true),
    ('SDCLU6012RD', 'RETIRAR RAMAL DE LIG POLI-BT', true),
    ('SDCCU6422SC', 'SERV RELIG FECHANDO CH FUSIVEL MT', true),
    ('SDCCU6415SC', 'RELIGA NO SOLO - BT', true),
    ('SDCCU6424SC', 'SERV RETIRAR DISPOSIT BLOQ DISJUNTOR', true),
    ('SDCCU6414SC', 'RELIGA NO POSTE - BT', true),
    ('SDCLU6016II', 'INSTALAR MEDIDOR MONO-BT', true),
    ('SDCLU6016RD', 'RETIRAR MEDIDOR MONO-BT', true),
    ('SDCLU6017II', 'INSTALAR MEDIDOR POLI-BT', true),
    ('SDCLU6017RD', 'RETIRAR MEDIDOR POLI-BT', true),
    ('SDCCU6427SC', 'SERV N EFETUADO S ACESSO PADRAO DISJUNTO', true),
    ('SDCCU6426SC', 'RELIGA NAO EFETUADA N APR CTA PAGA-DISJ', true),
    ('SDCCU6420SC', 'SERV NAO EFETUADO SEM ACESSO PADRAO-BT', true),
    ('SDCCU6416SC', 'RELIGA NAO EFETUADA N APR CTA PAGA BT', true)
ON CONFLICT ON CONSTRAINT atividades_codigo_unique DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    ativo = true;

-- ============================================
-- 2. INSERIR RETORNOS DE CAMPO
-- ============================================
INSERT INTO retornos_campo (codigo, descricao, tipo, ativo, gera_producao, finaliza_os)
VALUES 
    ('961', 'Não realizado - Necessário Cartucho', 'impedimento', true, false, true),
    ('96003', 'GAVIAO Conta Paga', 'impedimento', true, false, true),
    ('96004', 'Impedimento - Deficiencia Tecnica', 'impedimento', true, false, true),
    ('96005', 'Impedimento - Dificil Acesso', 'impedimento', true, false, true),
    ('96006', 'Encontrado Ja Religado', 'executado', true, false, true),
    ('96007', 'Impedimento - Local Fechado', 'impedimento', true, false, true),
    ('96009', 'Impedimento - Cliente', 'impedimento', true, false, true),
    ('96012', 'Impedimento - Medidor Interno', 'impedimento', true, false, true),
    ('96014', 'Impedimento - Medidor Nao Confere', 'impedimento', true, false, true),
    ('96015', 'BT-Nao Apresentou Fatura', 'impedimento', true, false, true),
    ('96016', 'GAVIAO Impedimento - Nao Apresentou Fatura', 'impedimento', true, false, true),
    ('96017', 'Impedimento - Nao Localizado', 'impedimento', true, false, true),
    ('96020', 'GAVIAO Sem Acesso ao Padrao', 'impedimento', true, false, true),
    ('96036', 'GAVIAO Impedimento - Cliente', 'impedimento', true, false, true),
    ('96037', 'GAVIAO Impedimento - Deficiencia Tecnica', 'impedimento', true, false, true),
    ('96039', 'GAVIAO Impedimento - Disjuntor Interno', 'impedimento', true, false, true),
    ('96040', 'GAVIAO Impedimento - Dispositivo Nao Encaixa', 'impedimento', true, false, true),
    ('95042', 'GAVIAO Encontrado Ja Religado', 'executado', true, false, true),
    ('9601', 'MONO-Caixa e Ramal', 'executado', true, true, true),
    ('9602', 'POLI-Caixa e Ramal', 'executado', true, true, true),
    ('95001', 'AT-Chave Fusivel', 'executado', true, true, true),
    ('95004', 'BT-Caixa/Borne', 'executado', true, true, true),
    ('95005', 'GAVIAO Disjuntor', 'executado', true, true, true),
    ('95006', 'BT-Poste', 'executado', true, true, true),
    ('95008', 'MONO-Caixa e Medidor', 'executado', true, true, true),
    ('95012', 'MONO-Poste e Ramal', 'executado', true, true, true),
    ('95013', 'MONO-Poste, Ramal e Medidor', 'executado', true, true, true),
    ('95016', 'POLI-Caixa e Medidor', 'executado', true, true, true),
    ('95019', 'POLI-Poste e Ramal', 'executado', true, true, true),
    ('95020', 'POLI-Poste, Ramal e Medidor', 'executado', true, true, true),
    ('95058', 'MONO-Poste e Medidor', 'executado', true, true, true),
    ('95059', 'POLI-Poste e Medidor', 'executado', true, true, true)
ON CONFLICT ON CONSTRAINT retornos_campo_codigo_unique DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tipo = EXCLUDED.tipo,
    gera_producao = EXCLUDED.gera_producao,
    ativo = true;

-- ============================================
-- 3. VINCULAR RETORNOS AO TIPO DE SERVIÇO
-- ============================================
DO $$
DECLARE
    v_skill_id UUID;
BEGIN
    -- Buscar o skill de Religação
    SELECT id INTO v_skill_id FROM skills 
    WHERE UPPER(codigo) IN ('RELIGA', 'RELIGACAO', 'RELIGAÇÃO', 'RELIGACAO_ENERGIA')
       OR UPPER(nome) LIKE '%RELIGA%ENERGIA%'
       OR UPPER(nome) = 'RELIGAÇÃO DE ENERGIA'
    LIMIT 1;
    
    IF v_skill_id IS NULL THEN
        RAISE EXCEPTION 'Skill de Religação de Energia não encontrado! Verifique o nome/código do tipo de serviço.';
    END IF;
    
    RAISE NOTICE 'Skill ID encontrado: %', v_skill_id;
    
    -- Inserir vínculos tipo_servico_retornos
    INSERT INTO tipo_servico_retornos (skill_id, retorno_campo_id, ordem, ativo)
    SELECT v_skill_id, r.id, ROW_NUMBER() OVER (ORDER BY r.codigo), true
    FROM retornos_campo r
    WHERE r.codigo IN ('961','9601','9602','95001','95004','95005','95006','95008','95012','95013','95016','95019','95020','95042','95058','95059','96003','96004','96005','96006','96007','96009','96012','96014','96015','96016','96017','96020','96036','96037','96039','96040')
    ON CONFLICT ON CONSTRAINT tipo_servico_retornos_unique DO UPDATE SET ativo = true;
    
    RAISE NOTICE 'Vínculos de retornos criados com sucesso!';
END $$;

-- ============================================
-- 4. VINCULAR ATIVIDADES AOS RETORNOS
-- ============================================
DO $$
DECLARE
    v_skill_id UUID;
    v_tsr_id UUID;
    v_atv_id UUID;
BEGIN
    -- Buscar o skill de Religação
    SELECT id INTO v_skill_id FROM skills 
    WHERE UPPER(codigo) IN ('RELIGA', 'RELIGACAO', 'RELIGAÇÃO', 'RELIGACAO_ENERGIA')
       OR UPPER(nome) LIKE '%RELIGA%ENERGIA%'
       OR UPPER(nome) = 'RELIGAÇÃO DE ENERGIA'
    LIMIT 1;
    
    -- =============================================
    -- Retorno 961 - Não realizado - Necessário Cartucho
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '961';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6419SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 2, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = false, qtd_min_fotos = 2;
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 9601 - MONO-Caixa e Ramal
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '9601';
    
    IF v_tsr_id IS NOT NULL THEN
        -- SDCLU6013II - Obrigatorio
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6013II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = false, qtd_min_fotos = 1;
        END IF;
        -- SDCLU6013RD - Opcional (selecionado)
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6013RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'opcional_selecionado', 1, true, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'opcional_selecionado', quantidade_padrao = 1, permite_alterar_qtd = true, qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 9602 - POLI-Caixa e Ramal
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '9602';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6012II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = false, qtd_min_fotos = 1;
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6012RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'opcional_selecionado', 1, true, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'opcional_selecionado', quantidade_padrao = 1, permite_alterar_qtd = true, qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95001 - AT-Chave Fusivel
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95001';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6422SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = true, qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95004 - BT-Caixa/Borne
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95004';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6415SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = false, qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95005 - GAVIAO Disjuntor
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95005';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6424SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = false, qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95006 - BT-Poste
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95006';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6414SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = false, qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95008 - MONO-Caixa e Medidor
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95008';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6016II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = true, qtd_min_fotos = 1;
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6016RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'opcional_selecionado', 1, true, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'opcional_selecionado', quantidade_padrao = 1, permite_alterar_qtd = true, qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95012 - MONO-Poste e Ramal
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95012';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6414SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = false, qtd_min_fotos = 1;
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6013II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', quantidade_padrao = 1, permite_alterar_qtd = true, qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95013 - MONO-Poste, Ramal e Medidor
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95013';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6414SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6016RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'opcional_selecionado', 1, true, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'opcional_selecionado';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6016II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 3)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6013RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'opcional_selecionado', 1, true, 1, 4)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'opcional_selecionado';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6013II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 5)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95016 - POLI-Caixa e Medidor
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95016';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6017II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6017RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'opcional_selecionado', 1, true, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'opcional_selecionado';
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95019 - POLI-Poste e Ramal
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95019';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6414SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6012II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95020 - POLI-Poste, Ramal e Medidor
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95020';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6017RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'opcional_selecionado', 1, true, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'opcional_selecionado';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6017II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6012II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 3)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6414SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 4)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6012RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 5)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95042 - GAVIAO Encontrado Ja Religado
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95042';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6427SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95058 - MONO-Poste e Medidor
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95058';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6414SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6016II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6016RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'opcional_selecionado', 1, true, 1, 3)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'opcional_selecionado';
        END IF;
    END IF;
    
    -- =============================================
    -- Retorno 95059 - POLI-Poste e Medidor
    -- =============================================
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '95059';
    
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6414SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6017II';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 2)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio';
        END IF;
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCLU6017RD';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'opcional_selecionado', 1, true, 1, 3)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'opcional_selecionado';
        END IF;
    END IF;
    
    -- =============================================
    -- RETORNOS DE IMPEDIMENTO
    -- =============================================
    
    -- 96003 - GAVIAO Conta Paga
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96003';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6426SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 3, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 3;
        END IF;
    END IF;
    
    -- 96004 - Impedimento - Deficiencia Tecnica
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96004';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6419SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 3, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 3;
        END IF;
    END IF;
    
    -- 96005 - Impedimento - Dificil Acesso
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96005';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6420SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 2, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 2;
        END IF;
    END IF;
    
    -- 96006 - Encontrado Ja Religado
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96006';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6420SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, true, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- 96007 - Impedimento - Local Fechado
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96007';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6420SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 2, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 2;
        END IF;
    END IF;
    
    -- 96009 - Impedimento - Cliente
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96009';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6420SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 2, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 2;
        END IF;
    END IF;
    
    -- 96012 - Impedimento - Medidor Interno
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96012';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6420SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 1, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 1;
        END IF;
    END IF;
    
    -- 96014 - Impedimento - Medidor Nao Confere
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96014';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6420SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 2, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 2;
        END IF;
    END IF;
    
    -- 96015 - BT-Nao Apresentou Fatura
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96015';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6416SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 3, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 3;
        END IF;
    END IF;
    
    -- 96016 - GAVIAO Impedimento - Nao Apresentou Fatura
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96016';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6427SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 3, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 3;
        END IF;
    END IF;
    
    -- 96017 - Impedimento - Nao Localizado
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96017';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6420SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 2, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 2;
        END IF;
    END IF;
    
    -- 96020 - GAVIAO Sem Acesso ao Padrao
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96020';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6427SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 2, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 2;
        END IF;
    END IF;
    
    -- 96036 - GAVIAO Impedimento - Cliente
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96036';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6427SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 2, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 2;
        END IF;
    END IF;
    
    -- 96037 - GAVIAO Impedimento - Deficiencia Tecnica
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96037';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6427SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 3, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 3;
        END IF;
    END IF;
    
    -- 96039 - GAVIAO Impedimento - Disjuntor Interno
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96039';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6427SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 2, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 2;
        END IF;
    END IF;
    
    -- 96040 - GAVIAO Impedimento - Dispositivo Nao Encaixa
    SELECT tsr.id INTO v_tsr_id FROM tipo_servico_retornos tsr
    JOIN retornos_campo r ON r.id = tsr.retorno_campo_id
    WHERE tsr.skill_id = v_skill_id AND r.codigo = '96040';
    IF v_tsr_id IS NOT NULL THEN
        SELECT id INTO v_atv_id FROM atividades WHERE codigo = 'SDCCU6427SC';
        IF v_atv_id IS NOT NULL THEN
            INSERT INTO tipo_servico_retorno_atividades (tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, permite_alterar_qtd, qtd_min_fotos, ordem)
            VALUES (v_tsr_id, v_atv_id, 'obrigatorio', 1, false, 0, 1)
            ON CONFLICT ON CONSTRAINT tipo_servico_retorno_atividades_unique 
            DO UPDATE SET situacao = 'obrigatorio', qtd_min_fotos = 0;
        END IF;
    END IF;
    
    RAISE NOTICE 'Importação concluída com sucesso!';
END $$;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
SELECT 
    s.codigo as tipo_servico,
    s.nome as nome_servico,
    COUNT(DISTINCT tsr.id) as total_retornos,
    COUNT(DISTINCT tsra.id) as total_atividades
FROM skills s
LEFT JOIN tipo_servico_retornos tsr ON s.id = tsr.skill_id
LEFT JOIN tipo_servico_retorno_atividades tsra ON tsr.id = tsra.tipo_servico_retorno_id
WHERE UPPER(s.codigo) IN ('RELIGA', 'RELIGACAO', 'RELIGAÇÃO')
   OR UPPER(s.nome) LIKE '%RELIGA%'
GROUP BY s.codigo, s.nome;
