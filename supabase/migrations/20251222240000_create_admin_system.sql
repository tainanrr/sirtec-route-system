-- =====================================================
-- SISTEMA DE ADMINISTRAÇÃO COMPLETO
-- Contratos, Usuários, Permissões, Logs, etc.
-- =====================================================

-- =====================================================
-- 1. CONTRATOS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  cliente VARCHAR(255),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'encerrado', 'suspenso')),
  valor_mensal DECIMAL(12,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_contratos_codigo ON public.contratos(codigo);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON public.contratos(status);

-- =====================================================
-- 2. TIPOS DE SERVIÇO POR CONTRATO (precificação)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tipos_servico_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES public.skills(id),
  codigo VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  tempo_estimado_minutos INTEGER DEFAULT 30,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contrato_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_tipos_servico_contrato_contrato ON public.tipos_servico_contrato(contrato_id);

-- =====================================================
-- 3. CENTRO DE CUSTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  codigo VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_centros_custo_contrato ON public.centros_custo(contrato_id);

-- =====================================================
-- 4. COORDENADORES E SUPERVISORES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.coordenadores_supervisores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('coordenador', 'supervisor')),
  email VARCHAR(255),
  telefone VARCHAR(20),
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coord_sup_tipo ON public.coordenadores_supervisores(tipo);
CREATE INDEX IF NOT EXISTS idx_coord_sup_contrato ON public.coordenadores_supervisores(contrato_id);

-- =====================================================
-- 5. HISTÓRICO DE COORDENADOR/SUPERVISOR DAS EQUIPES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.equipe_coordenador_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  coordenador_supervisor_id UUID NOT NULL REFERENCES public.coordenadores_supervisores(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_equipe_coord_hist_equipe ON public.equipe_coordenador_historico(equipe_id);
CREATE INDEX IF NOT EXISTS idx_equipe_coord_hist_coord ON public.equipe_coordenador_historico(coordenador_supervisor_id);

-- =====================================================
-- 6. VEÍCULOS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa VARCHAR(10) NOT NULL UNIQUE,
  modelo VARCHAR(100),
  marca VARCHAR(50),
  ano INTEGER,
  cor VARCHAR(30),
  tipo VARCHAR(30) DEFAULT 'carro' CHECK (tipo IN ('carro', 'moto', 'van', 'caminhao', 'outro')),
  quilometragem_atual INTEGER,
  status VARCHAR(20) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_uso', 'manutencao', 'inativo')),
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON public.veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON public.veiculos(status);
CREATE INDEX IF NOT EXISTS idx_veiculos_contrato ON public.veiculos(contrato_id);

-- =====================================================
-- 7. HISTÓRICO DE USO DE VEÍCULOS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.veiculo_uso_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_fim TIMESTAMPTZ,
  km_inicial INTEGER,
  km_final INTEGER,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_veiculo_uso_veiculo ON public.veiculo_uso_historico(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_veiculo_uso_equipe ON public.veiculo_uso_historico(equipe_id);
CREATE INDEX IF NOT EXISTS idx_veiculo_uso_data ON public.veiculo_uso_historico(data_inicio);

-- =====================================================
-- 8. METAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  equipe_id UUID REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo_meta VARCHAR(30) NOT NULL CHECK (tipo_meta IN ('quantidade', 'faturamento', 'produtividade')),
  skill_id UUID REFERENCES public.skills(id),
  valor_meta DECIMAL(12,2) NOT NULL,
  valor_realizado DECIMAL(12,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_metas_contrato ON public.metas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_metas_equipe ON public.metas(equipe_id);
CREATE INDEX IF NOT EXISTS idx_metas_data ON public.metas(data);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_unique ON public.metas(contrato_id, equipe_id, data, tipo_meta, COALESCE(skill_id, '00000000-0000-0000-0000-000000000000'::UUID));

-- =====================================================
-- 9. PROCEDIMENTOS (para equipes baixarem no app)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.procedimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  conteudo TEXT, -- Pode ser markdown ou HTML
  categoria VARCHAR(100),
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  arquivo_url TEXT, -- URL do arquivo PDF/DOC se houver
  arquivo_nome VARCHAR(255),
  versao VARCHAR(20) DEFAULT '1.0',
  ativo BOOLEAN DEFAULT true,
  visivel_app BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_procedimentos_categoria ON public.procedimentos(categoria);
CREATE INDEX IF NOT EXISTS idx_procedimentos_contrato ON public.procedimentos(contrato_id);

-- =====================================================
-- 10. PERMISSÕES DO SISTEMA
-- =====================================================
CREATE TABLE IF NOT EXISTS public.permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(100) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  modulo VARCHAR(50) NOT NULL, -- 'admin', 'roteirizacao', 'materiais', 'cadastros', 'app'
  tipo VARCHAR(30) DEFAULT 'tela' CHECK (tipo IN ('tela', 'funcao', 'acao')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir permissões padrão
INSERT INTO public.permissoes (codigo, nome, modulo, tipo) VALUES
-- Admin
('admin.acessar', 'Acessar módulo Admin', 'admin', 'tela'),
('admin.contratos', 'Gerenciar Contratos', 'admin', 'tela'),
('admin.usuarios_web', 'Gerenciar Usuários Web', 'admin', 'tela'),
('admin.usuarios_app', 'Gerenciar Usuários App', 'admin', 'tela'),
('admin.permissoes', 'Gerenciar Permissões', 'admin', 'tela'),
('admin.logs', 'Visualizar Logs', 'admin', 'tela'),
('admin.checklists', 'Gerenciar Checklists', 'admin', 'tela'),
('admin.procedimentos', 'Gerenciar Procedimentos', 'admin', 'tela'),
('admin.cadastros_base', 'Cadastros Base', 'admin', 'tela'),
-- Roteirização
('roteirizacao.acessar', 'Acessar Roteirização', 'roteirizacao', 'tela'),
('roteirizacao.criar', 'Criar Roteiros', 'roteirizacao', 'funcao'),
('roteirizacao.editar', 'Editar Roteiros', 'roteirizacao', 'funcao'),
('roteirizacao.cancelar', 'Cancelar Roteiros', 'roteirizacao', 'funcao'),
('roteirizacao.acompanhamento', 'Acompanhamento de Roteiros', 'roteirizacao', 'tela'),
-- Cadastros
('cadastros.acessar', 'Acessar Cadastros', 'cadastros', 'tela'),
('cadastros.equipes', 'Gerenciar Equipes', 'cadastros', 'tela'),
('cadastros.skills', 'Gerenciar Skills', 'cadastros', 'tela'),
('cadastros.territorios', 'Gerenciar Territórios', 'cadastros', 'tela'),
('cadastros.coordenadores', 'Gerenciar Coordenadores/Supervisores', 'cadastros', 'tela'),
('cadastros.veiculos', 'Gerenciar Veículos', 'cadastros', 'tela'),
('cadastros.metas', 'Gerenciar Metas', 'cadastros', 'tela'),
-- Materiais
('materiais.acessar', 'Acessar Materiais', 'materiais', 'tela'),
('materiais.recebimentos', 'Recebimentos de Materiais', 'materiais', 'tela'),
('materiais.estoque', 'Estoque Central', 'materiais', 'tela'),
('materiais.movimentacoes', 'Movimentações', 'materiais', 'tela'),
('materiais.devolucoes', 'Devoluções', 'materiais', 'tela'),
-- Ordens de Serviço
('ordens.acessar', 'Acessar Ordens de Serviço', 'ordens', 'tela'),
('ordens.importar', 'Importar OSs', 'ordens', 'funcao'),
('ordens.editar', 'Editar OSs', 'ordens', 'funcao'),
('ordens.excluir', 'Excluir OSs', 'ordens', 'funcao'),
-- Torre de Controle
('torre.acessar', 'Acessar Torre de Controle', 'torre', 'tela'),
-- Dashboard
('dashboard.acessar', 'Acessar Dashboard', 'dashboard', 'tela')
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- 11. USUÁRIOS WEB (perfis de acesso)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.usuarios_web (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  telefone VARCHAR(20),
  cargo VARCHAR(100),
  departamento VARCHAR(100),
  avatar_url TEXT,
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_web_email ON public.usuarios_web(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_web_auth ON public.usuarios_web(auth_user_id);

-- =====================================================
-- 12. CONTRATOS DOS USUÁRIOS WEB (multi-contrato)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.usuario_contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_web_id UUID NOT NULL REFERENCES public.usuarios_web(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  is_padrao BOOLEAN DEFAULT false, -- Contrato padrão ao logar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_web_id, contrato_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_contratos_usuario ON public.usuario_contratos(usuario_web_id);
CREATE INDEX IF NOT EXISTS idx_usuario_contratos_contrato ON public.usuario_contratos(contrato_id);

-- =====================================================
-- 13. PERMISSÕES DOS USUÁRIOS WEB
-- =====================================================
CREATE TABLE IF NOT EXISTS public.usuario_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_web_id UUID NOT NULL REFERENCES public.usuarios_web(id) ON DELETE CASCADE,
  permissao_id UUID NOT NULL REFERENCES public.permissoes(id) ON DELETE CASCADE,
  concedido BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(usuario_web_id, permissao_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_permissoes_usuario ON public.usuario_permissoes(usuario_web_id);

-- =====================================================
-- 14. PERFIS DE PERMISSÃO (templates)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.perfis_permissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  is_admin BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir perfis padrão
INSERT INTO public.perfis_permissao (nome, descricao, is_admin) VALUES
('Administrador', 'Acesso total ao sistema', true),
('Gestor', 'Acesso a roteirização e cadastros', false),
('Operador', 'Acesso básico a ordens e roteirização', false),
('Visualizador', 'Apenas visualização', false)
ON CONFLICT (nome) DO NOTHING;

-- =====================================================
-- 15. PERMISSÕES DOS PERFIS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.perfil_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES public.perfis_permissao(id) ON DELETE CASCADE,
  permissao_id UUID NOT NULL REFERENCES public.permissoes(id) ON DELETE CASCADE,
  UNIQUE(perfil_id, permissao_id)
);

-- =====================================================
-- 16. PERFIL DO USUÁRIO
-- =====================================================
ALTER TABLE public.usuarios_web ADD COLUMN IF NOT EXISTS perfil_id UUID REFERENCES public.perfis_permissao(id);

-- =====================================================
-- 17. LOGS DO SISTEMA (auditoria completa)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.logs_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome VARCHAR(255),
  acao VARCHAR(100) NOT NULL, -- 'criar', 'editar', 'excluir', 'login', 'logout', 'visualizar', etc
  modulo VARCHAR(50) NOT NULL, -- 'admin', 'roteirizacao', 'materiais', etc
  tabela VARCHAR(100), -- nome da tabela afetada
  registro_id UUID, -- id do registro afetado
  dados_anteriores JSONB, -- snapshot antes da alteração
  dados_novos JSONB, -- snapshot depois da alteração
  ip_address VARCHAR(45),
  user_agent TEXT,
  detalhes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_sistema_usuario ON public.logs_sistema(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_acao ON public.logs_sistema(acao);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_modulo ON public.logs_sistema(modulo);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_tabela ON public.logs_sistema(tabela);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_data ON public.logs_sistema(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_registro ON public.logs_sistema(registro_id);

-- =====================================================
-- 18. VINCULAR EQUIPE AO CONTRATO
-- =====================================================
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES public.contratos(id);
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS coordenador_id UUID REFERENCES public.coordenadores_supervisores(id);
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.coordenadores_supervisores(id);
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS veiculo_atual_id UUID REFERENCES public.veiculos(id);

CREATE INDEX IF NOT EXISTS idx_tecnicos_contrato ON public.tecnicos(contrato_id);

-- =====================================================
-- 19. VINCULAR OS AO CONTRATO
-- =====================================================
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES public.contratos(id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_contrato ON public.ordens_servico(contrato_id);

-- =====================================================
-- 20. RETORNOS DE CAMPO (motivos de não execução)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.retornos_campo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  tipo VARCHAR(30) DEFAULT 'impedimento' CHECK (tipo IN ('impedimento', 'reagendamento', 'cancelamento', 'outro')),
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  gera_revisita BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contrato_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_retornos_campo_contrato ON public.retornos_campo(contrato_id);

-- =====================================================
-- 21. INTERVALOS (almoço, descanso, etc)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tipos_intervalo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  obrigatorio BOOLEAN DEFAULT false,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir intervalos padrão
INSERT INTO public.tipos_intervalo (codigo, nome, duracao_minutos, obrigatorio) VALUES
('ALMOCO', 'Almoço', 60, true),
('CAFE', 'Café/Lanche', 15, false),
('DESCANSO', 'Descanso', 10, false)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- 22. FUNÇÃO PARA REGISTRAR LOG
-- =====================================================
CREATE OR REPLACE FUNCTION public.registrar_log(
  p_usuario_id UUID,
  p_usuario_nome VARCHAR,
  p_acao VARCHAR,
  p_modulo VARCHAR,
  p_tabela VARCHAR DEFAULT NULL,
  p_registro_id UUID DEFAULT NULL,
  p_dados_anteriores JSONB DEFAULT NULL,
  p_dados_novos JSONB DEFAULT NULL,
  p_detalhes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.logs_sistema (
    usuario_id,
    usuario_nome,
    acao,
    modulo,
    tabela,
    registro_id,
    dados_anteriores,
    dados_novos,
    detalhes
  ) VALUES (
    p_usuario_id,
    p_usuario_nome,
    p_acao,
    p_modulo,
    p_tabela,
    p_registro_id,
    p_dados_anteriores,
    p_dados_novos,
    p_detalhes
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- =====================================================
-- 23. RLS POLICIES
-- =====================================================
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_servico_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordenadores_supervisores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_web ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_permissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retornos_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_intervalo ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (permitir tudo para usuários autenticados - ajustar conforme necessário)
CREATE POLICY "contratos_all" ON public.contratos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tipos_servico_contrato_all" ON public.tipos_servico_contrato FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "centros_custo_all" ON public.centros_custo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "coordenadores_supervisores_all" ON public.coordenadores_supervisores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "veiculos_all" ON public.veiculos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "metas_all" ON public.metas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "procedimentos_all" ON public.procedimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "permissoes_all" ON public.permissoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios_web_all" ON public.usuarios_web FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuario_contratos_all" ON public.usuario_contratos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuario_permissoes_all" ON public.usuario_permissoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "perfis_permissao_all" ON public.perfis_permissao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "perfil_permissoes_all" ON public.perfil_permissoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logs_sistema_all" ON public.logs_sistema FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "retornos_campo_all" ON public.retornos_campo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tipos_intervalo_all" ON public.tipos_intervalo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 24. COMENTÁRIOS
-- =====================================================
COMMENT ON TABLE public.contratos IS 'Contratos de prestação de serviço';
COMMENT ON TABLE public.tipos_servico_contrato IS 'Tipos de serviço e precificação por contrato';
COMMENT ON TABLE public.coordenadores_supervisores IS 'Coordenadores e supervisores das equipes';
COMMENT ON TABLE public.veiculos IS 'Cadastro de veículos';
COMMENT ON TABLE public.metas IS 'Metas de produção por equipe/data';
COMMENT ON TABLE public.procedimentos IS 'Procedimentos operacionais para download no app';
COMMENT ON TABLE public.permissoes IS 'Permissões do sistema (telas/funções)';
COMMENT ON TABLE public.usuarios_web IS 'Usuários do sistema web';
COMMENT ON TABLE public.logs_sistema IS 'Logs de auditoria do sistema';
