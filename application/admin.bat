@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Direct administrator entry point for the packaged Windows runtime.
rem Keep this file byte-identical with application\admin.bat.
set "ADMIN_DIR=.\admin"
set "DB_PARENTDIR=db-embedded"
set "DB_NAME=openroberta-db"
set "JAVA_LIB_DIR=.\lib"
set "MODE=start-server"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="-admin-dir" (
    if "%~2"=="" goto missing_value
    set "ADMIN_DIR=%~2"
    shift
    shift
    goto parse_args
)
if /I "%~1"=="-db-parentdir" (
    if "%~2"=="" goto missing_value
    set "DB_PARENTDIR=%~2"
    shift
    shift
    goto parse_args
)
if /I "%~1"=="-java-lib-dir" (
    if "%~2"=="" goto missing_value
    set "JAVA_LIB_DIR=%~2"
    shift
    shift
    goto parse_args
)
if /I "%~1"=="create-empty-db" (
    set "MODE=create-empty-db"
    shift
    goto parse_args
)
if /I "%~1"=="start-server" (
    set "MODE=start-server"
    shift
    goto parse_args
)
echo Unknown admin.bat argument. 1>&2
exit /b 2

:missing_value
echo Missing value for admin.bat option. 1>&2
exit /b 2

:args_done
if not exist "%ADMIN_DIR%\logs\" mkdir "%ADMIN_DIR%\logs"
if not exist "%ADMIN_DIR%\dbBackup\" mkdir "%ADMIN_DIR%\dbBackup"
if not exist "%ADMIN_DIR%\tutorial\" mkdir "%ADMIN_DIR%\tutorial"
if not exist "%ADMIN_DIR%\logs\" (
    echo Could not create the admin directories. 1>&2
    exit /b 12
)
if not exist "%ADMIN_DIR%\dbBackup\" (
    echo Could not create the admin directories. 1>&2
    exit /b 12
)
if not exist "%ADMIN_DIR%\tutorial\" (
    echo Could not create the admin directories. 1>&2
    exit /b 12
)
set "ADMIN_LOG_FILE=%ADMIN_DIR%\logs\admin.log"
set "SERVER_LOG_FILE=%ADMIN_DIR%\logs\server.log"
set "DB_URI_FILE=jdbc:hsqldb:file:%DB_PARENTDIR%\%DB_NAME%"

rem Java 17+ needs the same module opening as the normal CodeON starter.
set "JAVA_VERSION="
for /f "tokens=3" %%V in ('java -version 2^>^&1 ^| findstr /i /c:"version"') do if not defined JAVA_VERSION set "JAVA_VERSION=%%~V"
if not defined JAVA_VERSION goto unknown_java
for /f "tokens=1,2 delims=." %%A in ("%JAVA_VERSION%") do (
    if "%%A"=="1" (set "JAVA_MAJOR=%%B") else set "JAVA_MAJOR=%%A"
)
if not defined JAVA_MAJOR goto unknown_java
echo(%JAVA_MAJOR%|findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 goto unknown_java
set "JAVA_OPEN_ARG="
if %JAVA_MAJOR% GEQ 17 set "JAVA_OPEN_ARG=--add-opens java.base/java.lang=ALL-UNNAMED"

if exist "%DB_PARENTDIR%\%DB_NAME%.script" goto database_ready
if exist "%DB_PARENTDIR%\" (
    echo Database directory exists but the expected database file is missing; refusing to overwrite it. 1>&2
    exit /b 12
)
call java %JAVA_OPEN_ARG% -cp "%JAVA_LIB_DIR%\*" de.fhg.iais.roberta.main.Administration create-empty-db "%DB_URI_FILE%" >>"%ADMIN_LOG_FILE%" 2>&1
set "JAVA_RC=%errorlevel%"
if not "%JAVA_RC%"=="0" (
    echo Database creation failed; server will not be started. See "%ADMIN_LOG_FILE%". 1>&2
    exit /b %JAVA_RC%
)

:database_ready
if /I "%MODE%"=="create-empty-db" exit /b 0
call java %JAVA_OPEN_ARG% -cp "%JAVA_LIB_DIR%\*" de.fhg.iais.roberta.main.ServerStarter ^
    -d "database.parentdir=%DB_PARENTDIR%" ^
    -d "database.name=%DB_NAME%" ^
    -d "server.staticresources.dir=.\staticResources" ^
    -d "database.mode=embedded" ^
    -d "server.admin.dir=%ADMIN_DIR%" ^
    -d "server.ip=127.0.0.1" >>"%SERVER_LOG_FILE%" 2>&1
exit /b %errorlevel%

:unknown_java
echo Unable to determine the Java version; no database or server was started. 1>&2
exit /b 12
