@echo off
rem CodeON - Erstinstallation fuer Windows
setlocal
cd /d "%~dp0"
set "NEUSTART_NOETIG="

echo.
echo  =========================================
echo   CodeON - Erstinstallation fuer Windows
echo  =========================================
echo.

rem Java pruefen und bei Bedarf ueber winget installieren.
java -version >nul 2>nul
if errorlevel 1 (
    echo  Java wurde nicht gefunden - Installation wird gestartet ...
    where winget >nul 2>nul
    if errorlevel 1 goto java_manuell
    winget install --id EclipseAdoptium.Temurin.21.JRE --exact --accept-source-agreements --accept-package-agreements --silent
    if errorlevel 1 goto java_manuell
    set "NEUSTART_NOETIG=1"
    echo  Java wurde installiert.
) else (
    echo  Java ist vorhanden - gut.
)

rem Erst den Windows-Python-Launcher, dann python.exe pruefen.
set "PYTHON_OK="
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON_OK=1"
)
if not defined PYTHON_OK (
    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON_OK=1"
)
if not defined PYTHON_OK (
    echo  Python 3.10+ wurde nicht gefunden - Installation wird gestartet ...
    where winget >nul 2>nul
    if errorlevel 1 goto python_manuell
    winget install --id Python.Python.3.12 --exact --accept-source-agreements --accept-package-agreements --silent
    if errorlevel 1 goto python_manuell
    set "NEUSTART_NOETIG=1"
    echo  Python wurde installiert.
) else (
    echo  Python ist vorhanden - gut.
)

echo.
call "RCX-Werkzeuge-installieren.cmd" /auto
if errorlevel 1 goto werkzeuge_fehler

echo.
echo  =========================================
if defined NEUSTART_NOETIG (
    echo   FAST GESCHAFFT!
    echo   Java oder Python wurde neu installiert.
    echo   Dieses Fenster bitte schliessen und danach
    echo   "CodeON-RCX-starten.cmd" doppelt anklicken.
) else (
    echo   FERTIG! CodeON ist eingerichtet.
    echo   Jetzt "CodeON-RCX-starten.cmd" doppelt anklicken.
)
echo  =========================================
echo.
pause
endlocal
exit /b 0

:java_manuell
echo.
echo  Java konnte nicht automatisch installiert werden.
echo  Download: https://adoptium.net/de/temurin/releases/
goto fehler

:python_manuell
echo.
echo  Python konnte nicht automatisch installiert werden.
echo  Download: https://www.python.org/downloads/
echo  Beim Setup "Add python.exe to PATH" aktivieren.
goto fehler

:werkzeuge_fehler
echo.
echo  Die RCX-Werkzeuge konnten nicht eingerichtet werden.
echo  Bitte die Fehlermeldung weiter oben beachten.

:fehler
echo.
pause
endlocal
exit /b 1
