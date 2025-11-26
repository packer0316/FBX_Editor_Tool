@echo off
chcp 65001 >nul
title FBX 編輯工具 - 首次安裝

echo.
echo ========================================
echo   FBX 編輯工具 - 首次安裝
echo ========================================
echo.
echo 此腳本會自動完成以下操作：
echo   1. 從 GitHub 下載專案代碼
echo   2. 安裝所有必要的依賴套件
echo   3. 準備好運行環境
echo.
echo ⚠️  注意：請確保已安裝以下軟體：
echo   - Node.js (v16 或更高)
echo   - Git
echo.

:: 檢查是否已安裝 Git
where git >nul 2>&1
if errorlevel 1 (
    echo ❌ 錯誤：未找到 Git
    echo.
    echo 請先安裝 Git：
    echo   下載地址：https://git-scm.com/
    echo.
    pause
    exit /b 1
)

echo ✓ Git 已安裝
echo.

:: 檢查是否已安裝 Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo ❌ 錯誤：未找到 Node.js
    echo.
    echo 請先安裝 Node.js：
    echo   下載地址：https://nodejs.org/
    echo   建議安裝 LTS 版本
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js 已安裝
node --version
echo.

:: 檢查是否已經存在 FBX_Editor_Tool 資料夾
if exist "FBX_Editor_Tool" (
    echo ⚠️  警告：FBX_Editor_Tool 資料夾已存在
    echo.
    set /p OVERWRITE="是否刪除並重新下載？(Y/N): "
    if /i "%OVERWRITE%"=="Y" (
        echo.
        echo 正在刪除舊資料夾...
        rmdir /s /q "FBX_Editor_Tool"
        echo ✓ 已刪除
        echo.
    ) else (
        echo.
        echo 已取消安裝
        pause
        exit /b 0
    )
)

echo [1/3] 正在從 GitHub 下載專案...
echo.
echo 倉庫地址：https://github.com/packer0316/FBX_Editor_Tool.git
echo.

:: Clone 倉庫（使用 HTTPS）
git clone https://github.com/packer0316/FBX_Editor_Tool.git
if errorlevel 1 (
    echo.
    echo ❌ 下載失敗
    echo.
    echo 可能的原因：
    echo   1. 網路連線問題
    echo   2. GitHub 連線受阻
    echo   3. 倉庫不存在或無權限
    echo.
    pause
    exit /b 1
)

echo.
echo ✓ 專案下載完成
echo.

echo [2/3] 正在進入專案資料夾並安裝依賴...
echo.

:: 進入專案資料夾
cd FBX_Editor_Tool\fbx-optimizer
if errorlevel 1 (
    echo ❌ 無法進入專案資料夾
    pause
    exit /b 1
)

:: 安裝依賴
echo 正在安裝 npm 套件（這可能需要幾分鐘）...
echo.
call npm install
if errorlevel 1 (
    echo.
    echo ❌ 依賴安裝失敗
    echo.
    echo 請檢查：
    echo   1. Node.js 版本是否正確（建議 v16+）
    echo   2. 網路連線是否正常
    echo   3. npm 是否正常運作
    echo.
    cd ..\..
    pause
    exit /b 1
)

echo.
echo ✓ 依賴安裝完成
echo.

:: 返回專案根目錄
cd ..\..

echo [3/3] 安裝完成，準備啟動...
echo.

echo ========================================
echo   🎉 安裝成功！
echo ========================================
echo.
echo 專案已下載到：%CD%\FBX_Editor_Tool
echo.
echo 📋 接下來的步驟：
echo.
echo   1. 進入 FBX_Editor_Tool 資料夾
echo   2. 雙擊「一鍵啟動.bat」啟動應用程式
echo.
echo 💡 未來更新方法：
echo   - 雙擊「更新到最新版本.bat」即可更新到最新版本
echo.
echo 🆘 需要幫助？
echo   - 查看「如何移至其他電腦使用.txt」
echo   - 查看 fbx-optimizer/README_UPDATE.md
echo.

set /p LAUNCH="是否現在啟動應用程式？(Y/N): "
if /i "%LAUNCH%"=="Y" (
    echo.
    echo 正在啟動...
    cd FBX_Editor_Tool
    start "" "一鍵啟動.bat"
    echo.
    echo 應用程式正在啟動中...
    echo 瀏覽器將自動開啟
)

echo.
pause

