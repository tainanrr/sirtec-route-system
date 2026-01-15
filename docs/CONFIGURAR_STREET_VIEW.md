# Configuração do Google Street View

Este documento explica como configurar a API do Google Street View para exibir imagens de fachadas dos endereços nas ordens de serviço.

## Visão Geral

O sistema utiliza a **Google Street View Static API** para obter imagens de fachadas baseadas nas coordenadas geográficas dos endereços. Essas imagens são exibidas:

- Na **página web** de detalhes da Ordem de Serviço
- No **aplicativo móvel** da equipe, na tela de detalhes da OS

## Pré-requisitos

1. Uma conta Google Cloud Platform (GCP)
2. Um projeto no Google Cloud Console
3. Faturamento ativado no projeto (necessário para usar as APIs do Google Maps)

## Passo a Passo para Configuração

### 1. Criar ou Acessar um Projeto no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Anote o **ID do Projeto**

### 2. Ativar a Street View Static API

1. No menu lateral, vá em **APIs e Serviços** > **Biblioteca**
2. Pesquise por **"Street View Static API"**
3. Clique na API e depois em **Ativar**

### 3. Criar uma Chave de API

1. No menu lateral, vá em **APIs e Serviços** > **Credenciais**
2. Clique em **+ Criar Credenciais** > **Chave de API**
3. Uma nova chave será gerada. **Copie-a imediatamente**

### 4. Restringir a Chave de API (Recomendado)

Para segurança, é importante restringir o uso da chave:

1. Clique na chave recém-criada para editá-la
2. Em **Restrições de aplicativo**, selecione:
   - **Referenciadores HTTP** para uso em websites
   - Adicione os domínios permitidos (ex: `https://seudominio.com/*`)
3. Em **Restrições de API**, selecione:
   - **Restringir chave**
   - Marque apenas **Street View Static API**
4. Clique em **Salvar**

### 5. Configurar a Variável de Ambiente

Adicione a chave de API no arquivo `.env` do projeto:

```env
VITE_GOOGLE_MAPS_API_KEY=sua_chave_de_api_aqui
```

**Importante:** Nunca commite o arquivo `.env` com a chave real no repositório. Use `.env.example` como template.

### 6. Reiniciar o Servidor de Desenvolvimento

Após configurar a variável de ambiente, reinicie o servidor:

```bash
npm run dev
```

## Custos e Limites

### Preços (Janeiro 2026)

| Recurso | Custo |
|---------|-------|
| Street View Static API | $7.00 por 1.000 requisições |
| Crédito mensal gratuito | $200.00 |

Com o crédito gratuito, você pode fazer aproximadamente **28.500 requisições por mês** sem custo.

### Limites de Uso

- **Tamanho máximo da imagem:** 640x640 pixels (plano gratuito)
- **Requisições por segundo:** 100 QPS por projeto
- **Requisições por dia:** Ilimitado (sujeito a faturamento)

## Comportamento do Sistema

### Quando há imagem disponível

O componente exibe a imagem do Street View com opções para:
- **Expandir** a imagem em um modal maior
- **Ver no Google Maps** para navegação 360°

### Quando NÃO há imagem disponível

O componente exibe uma mensagem informativa indicando que:
- As coordenadas não estão disponíveis, ou
- Não há cobertura do Street View para aquela localização

### Modo Collapsible (App Mobile)

No aplicativo móvel, a imagem é carregada sob demanda para economizar dados e requisições. O usuário precisa clicar em "Carregar imagem da fachada" para visualizar.

## Parâmetros Configuráveis

O componente `StreetViewImage` aceita os seguintes parâmetros:

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `latitude` | number | - | Latitude da localização |
| `longitude` | number | - | Longitude da localização |
| `endereco` | string | - | Endereço para exibir quando não há coordenadas |
| `size` | "sm" \| "md" \| "lg" | "md" | Tamanho da imagem |
| `heading` | number | 0 | Direção da câmera (0-360°) |
| `showExpandButton` | boolean | true | Mostra botão para expandir |
| `collapsible` | boolean | false | Permite toggle de visibilidade |
| `defaultCollapsed` | boolean | true | Estado inicial do collapse |

## Solução de Problemas

### "API Key não configurada"

Verifique se:
1. A variável `VITE_GOOGLE_MAPS_API_KEY` está definida no `.env`
2. O servidor foi reiniciado após a configuração
3. A chave não contém espaços ou caracteres especiais

### "Imagem não carrega"

Verifique se:
1. A Street View Static API está ativada no projeto
2. A chave de API não está restrita demais
3. O faturamento está ativo no projeto GCP
4. As coordenadas são válidas

### "Erro 403 - REQUEST_DENIED"

Isso geralmente indica:
1. A API não está ativada
2. A chave está restrita a outros domínios
3. Problemas de faturamento

### "Erro 400 - INVALID_REQUEST"

Verifique se:
1. As coordenadas estão no formato correto (números decimais)
2. Os parâmetros da URL estão corretos

## Links Úteis

- [Documentação oficial da Street View Static API](https://developers.google.com/maps/documentation/streetview/overview)
- [Console do Google Cloud](https://console.cloud.google.com/)
- [Preços do Google Maps Platform](https://cloud.google.com/maps-platform/pricing)
- [Melhores práticas de segurança para chaves de API](https://developers.google.com/maps/api-security-best-practices)
