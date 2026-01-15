# Checklist de Preparação para Produção

## 📋 Resumo Executivo

Este documento lista todas as tarefas necessárias para preparar o sistema SirtecRoute para o ambiente de produção.

---

## 🔴 CRÍTICO - Antes de Subir para Produção

### 1. Backup e Limpeza de Dados

- [ ] **Fazer backup completo do banco de dados atual** (para referência/histórico de testes)
- [ ] **Executar script de limpeza de dados de teste**: `scripts/preparacao_producao.sql`
  - Zera: Ordens de Serviço, Rotas, Planejamentos
  - Zera: Movimentações de Materiais, Recebimentos, Entregas, Devoluções
  - Zera: Respostas de Checklists
  - Zera: Logs do sistema, Posições GPS, Alertas
  - Mantém: Todos os cadastros base (skills, equipes, contratos, etc.)

### 2. Configurações de Ambiente

- [ ] **Criar projeto Supabase de produção** (separado do desenvolvimento)
- [ ] **Configurar variáveis de ambiente de produção**:
  ```env
  VITE_SUPABASE_URL=https://[projeto-producao].supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=[chave-producao]
  ```
- [ ] **Executar todas as migrations no banco de produção**
- [ ] **Configurar chave da API do Google Street View** (se usar em produção)

### 3. Segurança

- [ ] **Trocar senhas dos usuários administrativos**
  - Atualizar senha do usuário admin web
  - Gerar novas senhas para coordenadores/supervisores
- [ ] **Revisar permissões e perfis de acesso**
- [ ] **Verificar políticas RLS (Row Level Security)** estão ativas
- [ ] **Remover logs de debug do código**:
  - Arquivo `src/integrations/supabase/client.ts` - remover console.logs
  - Buscar outros `console.log` que possam expor dados sensíveis

### 4. Cadastros Iniciais de Produção

- [ ] **Verificar/atualizar dados de contratos**
- [ ] **Verificar/atualizar centros de custo**
- [ ] **Verificar/atualizar tipos de serviço (skills)**
- [ ] **Verificar/atualizar retornos de campo**
- [ ] **Verificar/atualizar templates de checklists**
- [ ] **Cadastrar equipes/técnicos reais**
- [ ] **Cadastrar colaboradores reais**
- [ ] **Cadastrar veículos reais**
- [ ] **Cadastrar territórios reais**
- [ ] **Cadastrar pontos de saída reais**
- [ ] **Definir metas de produção**

---

## 🟡 IMPORTANTE - Configurações Técnicas

### 5. Build de Produção

- [ ] **Gerar build otimizado**: `npm run build`
- [ ] **Testar build localmente**: `npm run preview`
- [ ] **Verificar tamanho dos bundles** (idealmente < 500KB para chunk principal)
- [ ] **Verificar PWA funcionando** (manifest, service worker)

### 6. Infraestrutura

- [ ] **Definir servidor de hospedagem** (Vercel, Netlify, servidor próprio)
- [ ] **Configurar domínio/subdomínio**
- [ ] **Configurar HTTPS/SSL**
- [ ] **Configurar CDN** (se necessário)
- [ ] **Configurar CORS no Supabase** para domínio de produção

### 7. Monitoramento

- [ ] **Configurar alertas de erro** (Sentry, LogRocket, ou similar)
- [ ] **Configurar monitoramento de uptime**
- [ ] **Configurar backup automático do banco Supabase**
- [ ] **Documentar procedimento de restore**

### 8. PWA - App Mobile

- [ ] **Verificar manifest.json** tem informações corretas
- [ ] **Testar instalação do PWA** em dispositivos Android
- [ ] **Testar funcionamento offline**
- [ ] **Configurar ícones de produção** (se diferentes)

---

## 🟢 RECOMENDADO - Melhorias

### 9. Performance

- [ ] **Configurar cache de queries** (React Query já configurado)
- [ ] **Verificar índices do banco de dados**
- [ ] **Otimizar imagens** (se houver)
- [ ] **Configurar compressão gzip/brotli**

### 10. Documentação

- [ ] **Atualizar README.md** com instruções de produção
- [ ] **Documentar API de integração** (se houver)
- [ ] **Criar manual do usuário**
- [ ] **Documentar procedimentos de suporte**

### 11. Testes

- [ ] **Executar suite de testes**: `npm run test`
- [ ] **Teste manual das funcionalidades críticas**:
  - Login de equipes
  - Login administrativo
  - Importação de OSs
  - Roteirização
  - Execução de OS pelo app
  - Checklists
  - Materiais

---

## 📝 Scripts Úteis

### Limpar dados de teste
```bash
# No Supabase SQL Editor, executar:
scripts/preparacao_producao.sql
```

### Build de produção
```bash
npm run build
```

### Testar build
```bash
npm run preview
```

---

## 🔐 Credenciais para Trocar

| Item | Localização | Ação |
|------|-------------|------|
| Admin Web | `usuarios_web` tabela | Trocar senha |
| Chaves Supabase | Variáveis de ambiente | Usar chaves de produção |
| API Google Maps | Variáveis de ambiente | Trocar para chave de produção |

---

## 📊 Tabelas que Serão Limpas

| Categoria | Tabelas |
|-----------|---------|
| **Ordens de Serviço** | `ordens_servico`, `ordem_anexos`, `ordem_materiais` |
| **Planejamento** | `planejamentos`, `planejamento_ordens`, `planejamento_logs` |
| **Rotas** | `rotas` |
| **Checklists** | `checklist_respostas` |
| **Materiais** | `materiais_movimentacoes`, `materiais_estoque`, `materiais_recebimentos`, `materiais_recebimentos_itens`, `materiais_entregas`, `materiais_entregas_itens`, `materiais_devolucoes`, `materiais_devolucoes_itens` |
| **Rastreamento** | `materiais_serializados_historico`, `materiais_recebimentos_itens_rastros`, `materiais_devolucoes_itens_rastros` |
| **Sistema** | `logs_sistema`, `alertas`, `alertas_tratativas`, `tecnicos_posicoes`, `turno_eventos`, `turno_paradas` |

---

## 📊 Cadastros que Serão Mantidos

| Categoria | Tabelas |
|-----------|---------|
| **Serviços** | `skills`, `skill_retornos`, `tipo_servico_retornos`, `grupos_retorno`, `atividades` |
| **Equipes** | `tecnicos`, `colaboradores`, `equipe_colaboradores`, `equipe_auth` |
| **Contratos** | `contratos`, `centros_custo`, `valores_servico_contrato`, `valores_servico_centro_custo`, `tempos_servico_centro_custo` |
| **Usuários** | `usuarios_web`, `perfis_permissao`, `permissoes`, `usuario_permissoes` |
| **Administrativo** | `coordenadores_supervisores`, `veiculos`, `metas`, `procedimentos` |
| **Localização** | `territorios`, `pontos_saida`, `poligonos` |
| **Templates** | `checklists`, `tipos_intervalo`, `config_prazo_urgente` |
| **Materiais** | `materiais` (catálogo), `materiais_serializados` (opcional manter) |
| **Turnos** | `turnos`, `turno_colaboradores` |

---

## ✅ Checklist Final

Antes de liberar para os usuários:

- [ ] Todos os itens CRÍTICOS concluídos
- [ ] Build de produção funcionando
- [ ] Testes manuais aprovados
- [ ] Backup do banco configurado
- [ ] Equipe de suporte treinada
- [ ] Usuários de produção cadastrados
- [ ] Monitoramento ativo

---

**Data de criação**: Janeiro/2026  
**Última atualização**: _________________  
**Responsável**: _________________
