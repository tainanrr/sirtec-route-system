@echo off
REM Backup Manual - Clique duplo para executar
cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File "%~dp0backup-auto.ps1" -Message "Backup manual"
pause

