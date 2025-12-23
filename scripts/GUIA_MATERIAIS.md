# 📦 Guia Rápido - Módulo de Gestão de Materiais

## 🚀 Passo a Passo para Começar

### 1. Executar Scripts SQL no Supabase

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Execute primeiro: `scripts/materiais-schema.sql` (cria as tabelas)
3. Execute depois: `scripts/materiais-dados-exemplo.sql` (insere dados de exemplo)

### 2. Acessar o Módulo

- **Web**: Acesse `/materiais` no navegador
- **App Mobile**: Toque em "Estoque" na navegação inferior

---

## 📋 Fluxo de Operações Básicas

### **1. Cadastrar Material** (`/materiais/catalogo`)

1. Clique em **"Novo Material"**
2. Preencha:
   - **Código**: Ex: `2201008`
   - **Nome**: Ex: `FIO NU COBRE 10,00MM2`
   - **Categoria**: Selecione (ex: `cabos_condutores`)
   - **Unidade**: Ex: `M` (metro), `UN` (unidade), `SR` (sem referência)
   - **Valor Unitário**: Opcional
   - **Estoque Mínimo**: Ex: `100`
   - **Requer Serial**: Marque apenas para medidores
3. Clique em **"Cadastrar"**

### **2. Registrar Recebimento** (`/materiais/recebimentos`)

1. Clique em **"Novo Recebimento"**
2. Preencha:
   - **Nº Documento**: Ex: `NF-2024-001234`
   - **Fornecedor**: Ex: `CPFL Energia`
   - Adicione os materiais recebidos com quantidades
3. Clique em **"Registrar"**
4. Após receber fisicamente, clique em **"Conferir"** para dar entrada no estoque

### **3. Entregar para Equipe** (`/materiais/entregas`)

1. Clique em **"Nova Entrega"**
2. Selecione a **Equipe**
3. Adicione os materiais a entregar
4. Clique em **"Registrar Entrega"**
5. A equipe receberá no app e precisará assinar digitalmente

### **4. Aplicar Material em OS** (App Mobile)

1. Na OS, toque em **"Materiais Aplicados/Retirados"**
2. Toque em **"Aplicar Material"**
3. Selecione o material e quantidade
4. Se for medidor, informe o **número de série**
5. Confirme

### **5. Consultar Estoque** (`/materiais/estoque`)

- Visualize todos os itens em estoque central
- Veja indicadores de nível (OK, Baixo, Zerado)
- Faça entradas/saídas rápidas clicando nos ícones ➕➖

### **6. Rastrear Medidores** (`/materiais/rastreabilidade`)

1. Cadastre medidores com número de série
2. Acompanhe status: Em Estoque → Com Equipe → Instalado
3. Veja histórico completo de movimentações

---

## 📊 Categorias de Materiais Disponíveis

- `medidores` - Medidores de Energia (requerem serial)
- `cabos_condutores` - Cabos e Condutores
- `conectores` - Conectores e Terminais
- `postes_estruturas` - Postes e Estruturas
- `transformadores` - Transformadores
- `chaves_fusíveis` - Chaves e Fusíveis
- `isoladores` - Isoladores
- `ferragens` - Ferragens
- `equipamentos_protecao` - Equipamentos de Proteção
- `ferramentas` - Ferramentas
- `consumiveis` - Consumíveis
- `outros` - Outros

---

## 🔍 Dados de Exemplo Incluídos

O script `materiais-dados-exemplo.sql` cria:

- ✅ **24 materiais** de diferentes categorias
- ✅ **Estoque inicial** no estoque central
- ✅ **1 recebimento** simulado (NF-2024-001234)
- ✅ **1 entrega** para equipe simulada
- ✅ **1 aplicação** em OS simulada
- ✅ **10 medidores** serializados cadastrados

---

## 💡 Dicas Importantes

1. **Medidores**: Sempre marque "Requer Serial" e cadastre o número de série ao aplicar
2. **Estoque Baixo**: O sistema alerta automaticamente quando o estoque está abaixo do mínimo
3. **Assinaturas**: Entregas para equipes requerem assinatura digital no app
4. **Rastreabilidade**: Medidores podem ser rastreados desde o estoque até a instalação
5. **Movimentações**: Todas as operações geram histórico automático em `/materiais/movimentacoes`

---

## 🎯 Próximos Passos

Após executar os scripts de exemplo:

1. Acesse `/materiais` e explore o dashboard
2. Veja os materiais cadastrados em `/materiais/catalogo`
3. Verifique o estoque em `/materiais/estoque`
4. Consulte as movimentações em `/materiais/movimentacoes`
5. Teste no app mobile a visualização do estoque da equipe

---

## ⚠️ Observações

- Os scripts usam `ON CONFLICT DO NOTHING` para evitar erros se executados múltiplas vezes
- Ajuste os IDs de equipes e OSs conforme seu banco de dados
- Os valores unitários são exemplos - ajuste conforme sua realidade






