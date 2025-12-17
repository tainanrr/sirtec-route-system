# Configurar Backup Agendado no Windows
# Execute este script como Administrador para criar a tarefa agendada

$projectPath = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $projectPath "scripts\backup-auto.ps1"

# Nome da tarefa
$taskName = "SirtecRoute-Backup-Auto"

# Verificar se ja existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Tarefa ja existe. Removendo..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Criar acao (executar PowerShell com o script)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -Message `"Backup agendado`""

# Criar gatilho (a cada 2 horas)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 365)

# Configuracoes
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Registrar tarefa
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Backup automatico do projeto SirtecRoute a cada 2 horas"

Write-Host ""
Write-Host "Tarefa de backup agendada criada com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "Detalhes:" -ForegroundColor Cyan
Write-Host "   Nome: $taskName"
Write-Host "   Intervalo: A cada 2 horas"
Write-Host "   Script: $scriptPath"
Write-Host ""
Write-Host "Para verificar: Get-ScheduledTask -TaskName $taskName" -ForegroundColor Gray
Write-Host "Para remover: Unregister-ScheduledTask -TaskName $taskName" -ForegroundColor Gray
