@echo off
setlocal enabledelayedexpansion

echo Installing AnyCode...

set "INSTALL_DIR=%USERPROFILE%\.local\bin"
if defined ANYCODE_INSTALL_DIR set "INSTALL_DIR=%ANYCODE_INSTALL_DIR%"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo Downloading...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/anymousxe/anycode/releases/latest/download/anycode.exe' -OutFile '%INSTALL_DIR%\anycode.exe'"

if errorlevel 1 (
    echo Download failed. Trying with curl...
    curl -fsSL -o "%INSTALL_DIR%\anycode.exe" "https://github.com/anymousxe/anycode/releases/latest/download/anycode.exe"
    if errorlevel 1 (
        echo Both download methods failed. Please check your internet connection.
        exit /b 1
    )
)

echo Adding %INSTALL_DIR% to PATH...
powershell -Command "$dir='%INSTALL_DIR%'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if($p -notlike \"*$dir*\"){[Environment]::SetEnvironmentVariable('Path',$p+';'+$dir,'User')}"

echo.
echo Done! Close this terminal and open a new one, then run 'anycode'.
