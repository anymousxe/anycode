@echo off
setlocal enabledelayedexpansion

echo Installing AnyCode...

set "INSTALL_DIR=%USERPROFILE%\.local\bin"
if defined ANYCODE_INSTALL_DIR set "INSTALL_DIR=%ANYCODE_INSTALL_DIR%"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

set "URL=https://github.com/anymousxe/anycode/releases/latest/download/anycode.exe"
set "DEST=%INSTALL_DIR%\anycode.exe"

echo Downloading...
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%URL%' -OutFile '%DEST%' -UseBasicParsing; if (!(Test-Path '%DEST%')) { exit 1 } } catch { exit 1 }"

if errorlevel 1 (
    echo PowerShell download failed. Trying with curl...
    curl -fsSL -o "%DEST%" "%URL%"
    if errorlevel 1 (
        echo Both download methods failed. Please check your internet connection.
        exit /b 1
    )
)

if not exist "%DEST%" (
    echo Downloaded file not found. Something went wrong.
    exit /b 1
)

for %%A in ("%DEST%") do set "SIZE=%%~zA"
if %SIZE% LSS 1000000 (
    echo Downloaded file is too small (%SIZE% bytes). The download may have failed.
    del "%DEST%"
    exit /b 1
)

echo Adding %INSTALL_DIR% to PATH...
powershell -Command "$dir='%INSTALL_DIR%'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if($p -notlike \"*$dir*\"){[Environment]::SetEnvironmentVariable('Path',$p+';'+$dir,'User')}"

echo.
echo Done! Close this terminal and open a new one, then run 'anycode'.
