@echo off
setlocal enabledelayedexpansion

echo Installing AnyCode...

where bun >nul 2>&1
if %errorlevel% neq 0 (
    echo Bun is required but not installed. Install it from https://bun.sh
    exit /b 1
)

set "INSTALL_DIR=%USERPROFILE%\.local\bin"
if defined ANYCODE_INSTALL_DIR set "INSTALL_DIR=%ANYCODE_INSTALL_DIR%"

set "TMPDIR=%TEMP%\anycode-install"
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
mkdir "%TMPDIR%"

echo Cloning...
git clone --depth 1 https://github.com/anymousxe/anycode.git "%TMPDIR%\anycode"

echo Installing dependencies...
cd /d "%TMPDIR%\anycode"
bun install

echo Building...
cd packages\opencode
bun run script\build.ts --single

echo Copying binary to %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /y dist\anycode-windows-x64\bin\anycode.exe "%INSTALL_DIR%\anycode.exe" >nul

cd /d "%USERPROFILE%"
rmdir /s /q "%TMPDIR%"

echo.
echo Done! Run 'anycode' to start.
echo Make sure %INSTALL_DIR% is in your PATH.
