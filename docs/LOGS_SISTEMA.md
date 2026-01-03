# Sistema de Logs - Guia de Implementação

## 1. Executar SQL no Supabase

Antes de usar os logs, execute o script SQL no Supabase SQL Editor:

```bash
# Arquivo: sql_logs_sistema.sql
```

Este script:
- Cria/atualiza a tabela `logs_sistema` com todos os campos necessários
- Cria índices para melhor performance
- Cria a função RPC `registrar_log` para inserções seguras

## 2. Uso em Componentes React (Web)

### Importar o hook

```typescript
import { useLogSistema } from "@/hooks/useLogSistema";
```

### Usar dentro do componente

```typescript
export default function MeuComponente() {
  const { logCriar, logEditar, logExcluir, logErro } = useLogSistema();

  // Ao criar um registro
  const handleCreate = async () => {
    const { data, error } = await supabase.from("tabela").insert(payload).select().single();
    
    if (!error && data) {
      logCriar("admin", "tabela", data.id, payload, `Criou registro ${payload.nome}`);
    }
  };

  // Ao editar um registro
  const handleEdit = async () => {
    const { error } = await supabase.from("tabela").update(payload).eq("id", id);
    
    if (!error) {
      logEditar("admin", "tabela", id, dadosAnteriores, payload, `Editou registro ${payload.nome}`);
    }
  };

  // Ao excluir um registro
  const handleDelete = async () => {
    const { error } = await supabase.from("tabela").delete().eq("id", id);
    
    if (!error) {
      logExcluir("admin", "tabela", id, dadosAnteriores, `Excluiu registro ${nome}`);
    }
  };
}
```

## 3. Uso Standalone (fora de componentes React)

```typescript
import { logCriar, logEditar, logExcluir, logLogin, logLogout } from "@/lib/logUtils";

// Registrar log diretamente
await logCriar("cadastros", "equipes", equipe.id, equipe, `Criou equipe ${equipe.codigo}`);
```

## 4. Uso com Wrapper Automático

```typescript
import { supabaseComLog } from "@/lib/logUtils";

// Insert com log automático
const { data, error } = await supabaseComLog.insert("contratos", payload, "admin", "Criou contrato");

// Update com log automático
const { data, error } = await supabaseComLog.update("contratos", id, payload, "admin", dadosAnteriores, "Editou contrato");

// Delete com log automático
const { error } = await supabaseComLog.delete("contratos", id, "admin", dadosAnteriores, "Excluiu contrato");
```

## 5. Módulos Disponíveis

```typescript
type ModuloLog = 
  | "admin"
  | "cadastros"
  | "roteirizacao"
  | "materiais"
  | "ordens"
  | "app"
  | "auth"
  | "checklists"
  | "procedimentos"
  | "turnos"
  | "equipes"
  | "colaboradores"
  | "dashboard"
  | "relatorios";
```

## 6. Ações Disponíveis

```typescript
type AcaoLog = 
  | "criar" 
  | "editar" 
  | "excluir" 
  | "login" 
  | "logout" 
  | "visualizar" 
  | "exportar" 
  | "importar"
  | "abrir_turno"
  | "fechar_turno"
  | "executar"
  | "aprovar"
  | "rejeitar"
  | "sincronizar";
```

## 7. Campos do Log

| Campo | Descrição |
|-------|-----------|
| `usuario_id` | ID do usuário (automático) |
| `usuario_nome` | Nome do usuário (automático) |
| `usuario_email` | Email do usuário (automático) |
| `equipe_id` | ID da equipe (app mobile) |
| `equipe_codigo` | Código da equipe (app mobile) |
| `acao` | Tipo de ação (criar, editar, etc) |
| `modulo` | Módulo do sistema |
| `tabela` | Tabela afetada |
| `registro_id` | ID do registro |
| `dados_anteriores` | JSON com dados antes da alteração |
| `dados_novos` | JSON com dados após alteração |
| `detalhes` | Descrição legível da ação |
| `plataforma` | web, app ou api |
| `latitude/longitude` | Coordenadas GPS (se disponível) |
| `user_agent` | Navegador/dispositivo |
| `duracao_ms` | Tempo de execução |
| `sucesso` | Se a operação teve sucesso |
| `erro_mensagem` | Mensagem de erro (se falhou) |

## 8. Páginas já Integradas

- ✅ Login/Logout Web (`WebAuthContext.tsx`)
- ✅ Login/Logout App (`EquipeAuthContext.tsx`)
- ✅ Abertura/Fechamento de Turno (`EquipeAuthContext.tsx`)
- ✅ Contratos (`AdminContratos.tsx`)

## 9. Páginas Pendentes de Integração

Para adicionar logs em outras páginas, siga o padrão do `AdminContratos.tsx`:

1. Importar `useLogSistema`
2. Extrair funções `logCriar`, `logEditar`, `logExcluir`
3. Chamar após cada operação CRUD bem-sucedida

### Páginas sugeridas para integrar:
- `AdminUsuariosWeb.tsx`
- `AdminUsuariosApp.tsx`
- `AdminColaboradores.tsx`
- `AdminCadastrosBase.tsx`
- `AdminProcedimentos.tsx`
- `ChecklistsAvancado.tsx`
- `Equipes.tsx`
- `OrdensServico.tsx`
- Páginas de materiais










