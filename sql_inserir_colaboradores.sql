-- =====================================================
-- INSERIR COLABORADORES - Contrato 4600079169 (VDC STC)
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- Função para formatar CPF (adicionar zeros à esquerda e pontuação)
CREATE OR REPLACE FUNCTION format_cpf(cpf_raw TEXT) 
RETURNS TEXT AS $$
DECLARE
  cpf_padded TEXT;
BEGIN
  -- Adicionar zeros à esquerda para ter 11 dígitos
  cpf_padded := LPAD(cpf_raw, 11, '0');
  -- Formatar com pontuação: 000.000.000-00
  RETURN SUBSTRING(cpf_padded, 1, 3) || '.' || 
         SUBSTRING(cpf_padded, 4, 3) || '.' || 
         SUBSTRING(cpf_padded, 7, 3) || '-' || 
         SUBSTRING(cpf_padded, 10, 2);
END;
$$ LANGUAGE plpgsql;

-- Inserir colaboradores
INSERT INTO public.colaboradores (cpf, nome, cargo, data_admissao, observacoes, ativo) VALUES
(format_cpf('62422286534'), 'IRENIO FERREIRA PACHECO', 'ELET REDE DISTRIB II', '2015-12-19', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('3982258502'), 'JOADSON LIMA BORGES', 'ELET LINHA MORTA I', '2016-01-19', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('2540801544'), 'VAILSON DE OLIVEIRA REIS', 'ELET REDE DISTRIB I', '2016-02-03', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('3121236555'), 'GILBERTO CAMPOS DOS SANTOS JUNIOR', 'ELETR LIG/COR III', '2016-03-19', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('82929602520'), 'GILDASIO RODRIGUES BRITO', 'ELETRICISTA DE STC I', '2016-03-19', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('65623223591'), 'DURVALINO SALES DE OLIVEIRA', 'ELETR LIG/COR II', '2016-03-19', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('65696999549'), 'GILMAR AGNELO DIAS', 'ELET LINHA MORTA I', '2016-03-24', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('1502505509'), 'RICARDO AZEVEDO SOUSA', 'ELETR LIG/COR II', '2016-06-13', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('52597040534'), 'RICARDO VIEIRA DA GUARDA', 'ASSISTENTE II', '2016-06-27', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('270118527'), 'REINALDO SANTOS FARIAS', 'ELETR LIG/COR I', '2016-07-21', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('6956927551'), 'VANDERLEISON COSTA PEREIRA', 'ELETRICISTA DE STC I', '2016-07-21', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('4898374506'), 'MAURICIO DOS SANTOS COSTA', 'ELETRICISTA DE STC I', '2017-02-01', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('4663426590'), 'SIDNY SILVA PRADO', 'ELET LINHA MORTA I', '2017-02-06', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('2341981500'), 'RODRIGO LEAL DE SANTANA', 'ELET LINHA MORTA I', '2017-05-03', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('7567581574'), 'CAIQUE OLIVEIRA SANTOS', 'ELETRICISTA DE STC I', '2017-05-26', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('11892475774'), 'JORGE LIMA SANTOS', 'ELETR LIG/COR II', '2017-07-20', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('6259439539'), 'VICTOR VINICIUS DE OLIVEIRA SOUZA', 'ELET LINHA MORTA I', '2017-08-24', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('6074666504'), 'RICARDO BATISTA VIANA', 'ELETRICISTA DE STC I', '2018-08-09', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('31343682851'), 'AGNALDO NOVAES DOS SANTOS', 'ELETRICISTA DE STC I', '2019-05-02', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('8258081543'), 'GUILHERME SANTOS DA SILVA', 'ELET LINHA MORTA I', '2019-05-02', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('86011118585'), 'DIEGO SANTOS SENA', 'ELETRICISTA DE STC I', '2020-03-05', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('82547394553'), 'JAIMILSON NOVAIS PEREIRA', 'ELET LINHA MORTA I', '2020-03-05', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('5205012501'), 'ROJERIO MOREIRA BOMFIM DA SILVA', 'ELET REDE DISTRIB I', '2020-09-02', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('1938980557'), 'ANDERSON RUAS DA CRUZ', 'ELETRICISTA DE STC I', '2020-09-10', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('85807597575'), 'SILVONEI ANDRADE DE SOUZA', 'ELETRICISTA DE STC I', '2020-09-10', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('5500115529'), 'ALEX RODRIGUES DOS SANTOS SOUZA', 'ELET LINHA MORTA I', '2020-09-21', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('5155811511'), 'WESLEY MOTA SILVA', 'ELETRICISTA DE STC I', '2020-09-25', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('6884839503'), 'ROGERIO GONCALVES DA SILVA', 'ELETR LIG/COR I', '2022-06-01', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('183761502'), 'FABIO SANTOS DE JESUS', 'ELETR LIG/COR I', '2022-07-11', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('60643900187'), 'ADRIANO CLEBER DOS SANTOS', 'ELETRICISTA DE STC I', '2022-08-02', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('8237637577'), 'ALEX GONCALVES DA SILVA', 'ELETR LIG/COR I', '2022-09-02', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('9899666580'), 'GERLAN VIEIRA SILVA', 'ELETR LIG/COR I', '2022-09-02', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('4328111507'), 'EDIVAN SANTOS PRADO', 'ELETR LIG/COR I', '2022-09-22', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('9194767599'), 'PAULO SERGIO ALVES DA SILVA', 'ELETR LIG/COR I', '2022-09-23', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('7598096589'), 'ANDERSON SILVA SANTOS AMARAL', 'ELETR LIG/COR I', '2022-09-23', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('9534073571'), 'DAVID DA ROCHA BRITO', 'ELETR LIG/COR I', '2022-09-23', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('7459927570'), 'IGOR COSTA PRATES', 'ELET REDE DISTRIB I', '2022-09-23', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('9814522562'), 'EDILAN MOREIRA SILVA', 'ELETR LIG/COR I', '2022-12-12', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('5283583597'), 'UILC OLIVEIRA SANTOS', 'ELETR LIG/COR I', '2023-01-12', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('85907586567'), 'JOALISON DOS SANTOS FREITAS', 'ELETR LIG/COR I', '2023-04-03', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('1308323590'), 'KLEBER BARBOSA LIMA', 'ELETR LIG/COR I', '2023-04-03', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('3435703512'), 'ERASMO VIANA DA SILVA', 'ELETR LIG/COR I', '2023-05-11', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('3093725500'), 'NADSON SANTOS SILVA', 'ELETR LIG/COR I', '2020-08-21', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('41747420816'), 'ALESSANDRO DOS SANTOS CARMO MEIRA', 'ELET REDE DISTRIB I', '2023-10-10', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('86500418506'), 'GABRIEL BAHIA MONTEIRO', 'ELETR LIG/COR I', '2023-10-10', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('14891442778'), 'ALTAMIRO SANTANA SANTOS', 'ELETR LIG/COR I', '2023-10-10', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('4816521593'), 'GIVALDO MOREIRA SANTOS DE JESUS', 'ELET REDE DISTRIB I', '2024-04-10', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('8157887542'), 'WELLINGTON DIAS DOS SANTOS', 'ELETR LIG/COR I', '2024-04-24', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('3330531509'), 'JAIRO RODRIGUES LOBO', 'ELET REDE DISTRIB I', '2024-05-13', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('86180669589'), 'ANDERSON SANTOS VELOZO MENDES', 'ELET REDE DISTRIB I', '2024-05-22', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('10014190575'), 'ALESSANDRO GONCALVES DA SILVA', 'ELET LINHA MORTA I', '2025-04-01', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('9665636545'), 'ALEX QUEIROZ DE OLIVEIRA', 'ELETRICISTA DE STC I', '2025-08-12', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('8593887511'), 'LEONARDO GOMES BITENCORTH', 'ELETRICISTA DE STC I', '2025-08-12', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('6609154562'), 'CAIQUE ALMEIDA DOS SANTOS', 'ELETRICISTA DE STC I', '2025-08-12', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('6621012519'), 'RONALDO SANTOS SILVA', 'ELETRICISTA DE STC I', '2025-08-12', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('4329888580'), 'DEIVID SANTOS MOREIRA', 'ELETRICISTA DE STC I', '2025-10-01', 'Contrato: 4600079169 - VDC STC', true),
(format_cpf('81835000568'), 'MARCOS ALVES DOS SANTOS', 'ELETRICISTA DE STC I', '2025-10-01', 'Contrato: 4600079169 - VDC STC', true)
ON CONFLICT (cpf) DO UPDATE SET
  nome = EXCLUDED.nome,
  cargo = EXCLUDED.cargo,
  data_admissao = EXCLUDED.data_admissao,
  observacoes = EXCLUDED.observacoes,
  updated_at = NOW();

-- Verificar inserção
SELECT 
  'Total de colaboradores inseridos: ' || COUNT(*)::text as resultado
FROM public.colaboradores;

-- Listar colaboradores inseridos
SELECT 
  cpf, 
  nome, 
  cargo, 
  data_admissao,
  CASE WHEN ativo THEN 'Ativo' ELSE 'Inativo' END as status
FROM public.colaboradores 
ORDER BY nome
LIMIT 20;

