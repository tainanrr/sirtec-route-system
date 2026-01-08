-- ==============================================================
-- SCRIPT DE CORREÇÃO DOS RETORNOS DE CAMPO - PARTE 1
-- Tipos: ALTERACAO CONTRATUAL, BAIXA A PEDIDO, BAIXA ADM
-- ==============================================================

-- Função auxiliar para atualizar atividades de retornos
CREATE OR REPLACE FUNCTION atualizar_retorno_atividade(
    p_skill_codigo TEXT,
    p_retorno_codigo TEXT,
    p_atividade_codigo TEXT,
    p_situacao TEXT,
    p_qtd_padrao INTEGER,
    p_permite_alterar BOOLEAN,
    p_qtd_min_fotos INTEGER
) RETURNS VOID AS $$
DECLARE
    v_tipo_servico_retorno_id UUID;
    v_atividade_id UUID;
BEGIN
    -- Buscar o ID do vínculo tipo_servico_retorno
    SELECT tsr.id INTO v_tipo_servico_retorno_id
    FROM tipo_servico_retornos tsr
    JOIN skills s ON s.id = tsr.skill_id
    JOIN retornos_campo rc ON rc.id = tsr.retorno_campo_id
    WHERE s.codigo = p_skill_codigo
    AND rc.codigo = p_retorno_codigo;
    
    -- Buscar o ID da atividade
    SELECT id INTO v_atividade_id FROM atividades WHERE codigo = p_atividade_codigo;
    
    -- Se ambos existem, atualizar
    IF v_tipo_servico_retorno_id IS NOT NULL AND v_atividade_id IS NOT NULL THEN
        UPDATE tipo_servico_retorno_atividades
        SET situacao = p_situacao,
            quantidade_padrao = p_qtd_padrao,
            permite_alterar_qtd = p_permite_alterar,
            qtd_min_fotos = p_qtd_min_fotos
        WHERE tipo_servico_retorno_id = v_tipo_servico_retorno_id
        AND atividade_id = v_atividade_id;
        
        -- Se não existe, inserir
        IF NOT FOUND THEN
            INSERT INTO tipo_servico_retorno_atividades (
                tipo_servico_retorno_id, atividade_id, situacao, quantidade_padrao, 
                permite_alterar_qtd, qtd_min_fotos, ordem
            ) VALUES (
                v_tipo_servico_retorno_id, v_atividade_id, p_situacao, p_qtd_padrao,
                p_permite_alterar, p_qtd_min_fotos, 0
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================
-- ALTERACAO CONTRATUAL
-- ==============================================================
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '9506', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '9506', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '9506', 'SDCLU6017II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '9506', 'SDCLU6017RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '9507', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '9507', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '9507', 'SDCLU6017II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '9507', 'SDCLU6017RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95034', 'SDCLU6012II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95034', 'SDCLU6016RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95034', 'SDCLU6017II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95035', 'SDCLU6016II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95035', 'SDCLU6017RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95036', 'SDCLU6013RD', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95036', 'SDCLU6017II', 'opcional_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95036', 'SDCLU6016RD', 'opcional_selecionado', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95036', 'SDCLU6012II', 'opcional_selecionado', 1, true, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95037', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95037', 'SDCLU6013II', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95037', 'SDCLU6016II', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '95037', 'SDCLU6017RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '96007', 'SDCLU6020SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '96017', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '96018', 'SDCCU6420SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '96028', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '96029', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '96030', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('ALTERACAO_CONTRATUAL', '96031', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);

-- ==============================================================
-- BAIXA A PEDIDO
-- ==============================================================
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '95008', 'SDCLU6016RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '95012', 'SDCLU6013RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '95013', 'SDCLU6013RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '95013', 'SDCLU6016RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '95016', 'SDCLU6017RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '95019', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '95020', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '95020', 'SDCLU6017RD', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '96005', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '96009', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '96012', 'SDCCU6420SC', 'obrigatorio', 1, false, 1);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '96013', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '96014', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('BAIXA_A_PEDIDO', '96017', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);

-- ==============================================================
-- BAIXA ADM
-- ==============================================================
SELECT atualizar_retorno_atividade('BAIXA_ADM', '9600', 'SDCCU6420SC', 'obrigatorio', 1, false, 2);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '95008', 'SDCLU6016RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '95012', 'SDCLU6013RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '95013', 'SDCLU6013RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '95013', 'SDCLU6016RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '95016', 'SDCLU6017RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '95019', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '95020', 'SDCLU6012RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '95020', 'SDCLU6017RD', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '96004', 'SDCCU6419SC', 'obrigatorio', 1, true, 3);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '96005', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '96009', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '96012', 'SDCCU6420SC', 'obrigatorio', 1, true, 1);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '96013', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '96014', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);
SELECT atualizar_retorno_atividade('BAIXA_ADM', '96017', 'SDCCU6420SC', 'obrigatorio', 1, true, 2);

-- Verificação
SELECT 'Parte 1 executada com sucesso' as resultado;

