@echo off
setlocal enabledelayedexpansion

echo Installing AnyCode...

set "INSTALL_DIR=%USERPROFILE%\.local\bin"
if defined ANYCODE_INSTALL_DIR set "INSTALL_DIR=%ANYCODE_INSTALL_DIR%"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo Downloading...
curl -fsSL -o "%INSTALL_DIR%\anycode.exe" "https://github.com/anymousxe/anycode/releases/latest/download/anycode-windows-x64.exe"

echo Adding %INSTALL_DIR% to PATH...
powershell -Command "$p = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($p -notlike '*%INSTALL_DIR%*') { [Environment]::SetEnvironmentVariable('Path', $p + ';%INSTALL_DIR%', 'User') }"

echo.
echo Done! Close this terminal and open a new one, then run 'anycode'.
