@echo off
REM =====================================================
REM BACKUP DO SUPABASE - Dados de Teste
REM =====================================================
REM Antes de executar, substitua:
REM   - [sua-senha] pela senha do banco
REM   - O host já está configurado para o projeto atual
REM =====================================================

SET PGPASSWORD=[sua-senha]
SET DATA=%date:~6,4%-%date:~3,2%-%date:~0,2%_%time:~0,2%-%time:~3,2%
SET DATA=%DATA: =0%

echo =====================================================
echo BACKUP DO SUPABASE
echo Data: %DATA%
echo =====================================================
echo.

REM Criar pasta de backups se não existir
if not exist "backups" mkdir backups

REM Backup completo (schema + dados)
echo Fazendo backup completo...
pg_dump -h aws-0-sa-east-1.pooler.supabase.com -p 6543 -U postgres.soluhzhmrsongjyrolpa -d postgres -F c -f "backups\backup_completo_%DATA%.dump"

echo.
echo Backup concluido: backups\backup_completo_%DATA%.dump
echo.
pause
