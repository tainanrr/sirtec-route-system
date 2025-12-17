# Script de Backup Automatico - SirtecRoute
# Este script faz commit automatico das alteracoes a cada execucao

param(
    [string]$Message = "Backup automatico"
)

$projectPath = Split-Path -Parent $PSScriptRoot

Set-Location $projectPath

# Verificar se ha alteracoes
$status = git status --porcelain

if ($status) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $commitMessage = "$Message - $timestamp"
    
    Write-Host "Criando backup: $commitMessage" -ForegroundColor Cyan
    
    # Adicionar todas as alteracoes
    git add -A
    
    # Fazer commit
    git commit -m $commitMessage
    
    # Tentar push para o GitHub (se configurado)
    $remotes = git remote
    if ($remotes -contains "origin") {
        Write-Host "Enviando para GitHub..." -ForegroundColor Yellow
        git push origin main 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Backup enviado para GitHub com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "Backup local criado, mas falhou ao enviar para GitHub" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Backup local criado com sucesso!" -ForegroundColor Green
        Write-Host "Configure o GitHub para backups na nuvem" -ForegroundColor Gray
    }
} else {
    Write-Host "Nenhuma alteracao para backup" -ForegroundColor Gray
}
