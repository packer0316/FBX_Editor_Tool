@echo off
chcp 65001 >nul
echo ========================================
echo   JR 3D Viewer - Electron 打包工具
echo ========================================
echo.

cd /d "%~dp0fbx-optimizer"

echo 正在打包 Electron 應用程式...
echo.

call npm run electron:build

echo.
if %ERRORLEVEL% EQU 0 (
    echo ✅ 打包完成！
    echo.
    echo 輸出位置：
    echo   - 安裝程式：fbx-optimizer\release\JR 3D Viewer Setup *.exe
    echo   - 免安裝版：fbx-optimizer\release\win-unpacked\
) else (
    echo ❌ 打包失敗，請檢查錯誤訊息
)

echo.
pause
