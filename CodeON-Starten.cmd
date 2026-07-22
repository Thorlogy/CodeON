@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)"
  if errorlevel 1 goto python_missing
  py -3 start-codeon-rcx.py
) else (
  where python >nul 2>nul
  if errorlevel 1 goto python_missing
  python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)"
  if errorlevel 1 goto python_missing
  python start-codeon-rcx.py
)
if %errorlevel% neq 0 pause
exit /b %errorlevel%

:python_missing
echo CodeON benoetigt Python 3.10 oder neuer.
echo Offizieller Download: https://www.python.org/downloads/
start "" "https://www.python.org/downloads/"
pause
exit /b 2
