@echo off
rem CodeON - NQC fuer Windows lokal einrichten
setlocal
cd /d "%~dp0"

set "NQC_URL=https://github.com/BrickBot/nqc/releases/download/v3.1-r6/nqc-win-3.1-r6.zip"
set "NQC_SHA256=fb34f75e45e60e36d4d77ff1a851869c9839c5e722a9e186e7a9d488cb7fa957"
set "ZIEL=RobotRCX\bin"
set "TMPZIP=%TEMP%\codeon-nqc-%RANDOM%.zip"
set "TMPDIR=%TEMP%\codeon-nqc-%RANDOM%-%RANDOM%"
set "RESULT=1"

echo.
echo  CodeON: RCX-Werkzeuge werden eingerichtet ...
echo.

if exist "%ZIEL%\nqc.exe" (
    echo  nqc.exe ist bereits vorhanden - gut.
    set "RESULT=0"
    goto tower_hinweis
)

where curl >nul 2>nul
if errorlevel 1 (
    echo  FEHLER: curl wurde nicht gefunden. Windows 10 oder neuer ist erforderlich.
    goto ende
)
where powershell >nul 2>nul
if errorlevel 1 (
    echo  FEHLER: PowerShell wurde nicht gefunden.
    goto ende
)
where tar >nul 2>nul
if errorlevel 1 (
    echo  FEHLER: tar wurde nicht gefunden. Windows 10 oder neuer ist erforderlich.
    goto ende
)

echo  Lade den NQC-Compiler vom BrickBot-Projekt herunter ...
curl -L --fail --silent --show-error -o "%TMPZIP%" "%NQC_URL%"
if errorlevel 1 (
    echo  FEHLER: Download fehlgeschlagen. Bitte die Internetverbindung pruefen.
    goto ende
)

echo  Pruefe die Datei mit SHA256 ...
set "CODEON_NQC_ZIP=%TMPZIP%"
set "HASHOK="
for /f "usebackq delims=" %%H in (`powershell -NoProfile -Command "(Get-FileHash -LiteralPath $env:CODEON_NQC_ZIP -Algorithm SHA256).Hash"`) do set "HASHOK=%%H"
if /i not "%HASHOK%"=="%NQC_SHA256%" (
    echo  FEHLER: Die heruntergeladene Datei ist beschaedigt oder veraendert.
    echo  Erwartet: %NQC_SHA256%
    echo  Erhalten: %HASHOK%
    goto ende
)

echo  Entpacke ...
mkdir "%TMPDIR%" >nul 2>nul
tar -xf "%TMPZIP%" -C "%TMPDIR%"
if errorlevel 1 goto archiv_fehler
if not exist "%TMPDIR%\nqc-win-3-1-r6\nqc.exe" goto archiv_fehler

if not exist "%ZIEL%" mkdir "%ZIEL%"
copy /y "%TMPDIR%\nqc-win-3-1-r6\nqc.exe" "%ZIEL%\nqc.exe" >nul
if errorlevel 1 (
    echo  FEHLER: nqc.exe konnte nicht nach %ZIEL% kopiert werden.
    goto ende
)
set "RESULT=0"
echo.
echo  ERLEDIGT: nqc.exe liegt jetzt unter %ZIEL%\nqc.exe
goto tower_hinweis

:archiv_fehler
echo  FEHLER: Das NQC-Archiv konnte nicht korrekt entpackt werden.
goto ende

:tower_hinweis
echo.
echo  ------------------------------------------------------------
echo  Infrarot-Turm unter Windows:
echo  Fuer einen seriellen Turm mit USB-Seriell-Adapter den COM-Port
echo  im Geraete-Manager ablesen und einmalig setzen, zum Beispiel:
echo      setx RCX_TOWER COM3
echo  CodeON danach neu starten.
echo.
echo  Der originale LEGO-USB-Turm benoetigt unter 64-Bit-Windows einen
echo  passenden Spezialtreiber und ist daher nicht der empfohlene Weg.
echo  ------------------------------------------------------------

:ende
if exist "%TMPZIP%" del "%TMPZIP%" >nul 2>nul
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%" >nul 2>nul
echo.
if /i not "%~1"=="/auto" pause
endlocal & exit /b %RESULT%
