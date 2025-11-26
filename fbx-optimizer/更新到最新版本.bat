@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title FBX 編輯工具 - 更新到最新版本

echo.
echo ========================================
echo   FBX 編輯工具 - 更新到最新版本
echo ========================================
echo.

echo [1/3] 正在檢查 Git 倉庫...
echo.

:: 檢查是否在 Git 倉庫中
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ❌ 錯誤：此資料夾不是 Git 倉庫
    echo 請確保您在正確的專案資料夾中執行此腳本
    pause
    exit /b 1
)

echo ✓ Git 倉庫檢查完成
echo.

echo [2/3] 正在從 GitHub 拉取最新代碼...
echo.

:: 檢查遠端 URL 是否為 SSH，如果是則切換為 HTTPS
for /f "tokens=*" %%a in ('git remote get-url origin') do set REMOTE_URL=%%a
echo 當前遠端 URL: %REMOTE_URL%

:: 如果是 SSH URL，轉換為 HTTPS URL
echo %REMOTE_URL% | findstr /C:"git@github.com" >nul
if not errorlevel 1 (
    echo.
    echo ⚠️  偵測到 SSH URL，正在切換為 HTTPS URL...
    echo    （這樣不需要 SSH 密鑰即可拉取代碼）
    
    :: 將 git@github.com:user/repo.git 轉換為 https://github.com/user/repo.git
    set HTTPS_URL=%REMOTE_URL:git@github.com:=https://github.com/%
    echo    新 URL: !HTTPS_URL!
    
    git remote set-url origin !HTTPS_URL!
    if errorlevel 1 (
        echo ❌ 切換 URL 失敗
        pause
        exit /b 1
    )
    echo ✓ 已切換為 HTTPS URL
    echo.
)

:: 顯示當前分支
for /f "tokens=*" %%a in ('git branch --show-current') do set CURRENT_BRANCH=%%a
echo 當前分支: %CURRENT_BRANCH%
echo.

:: 拉取最新代碼
git fetch origin
if errorlevel 1 (
    echo.
    echo ❌ 從遠端拉取失敗
    echo.
    echo 可能的原因：
    echo 1. 網路連線問題
    echo 2. GitHub 倉庫不存在或無權限訪問
    echo 3. Git 未正確安裝
    echo.
    echo 請檢查以上問題後重試
    pause
    exit /b 1
)

echo.
git pull origin %CURRENT_BRANCH%
if errorlevel 1 (
    echo.
    echo ❌ 合併代碼失敗
    echo 可能有衝突需要手動解決
    pause
    exit /b 1
)

echo.
echo ✓ 代碼更新完成
echo.

echo [3/3] 正在更新依賴套件...
echo.

:: 檢查是否有 package.json
if not exist "package.json" (
    echo ⚠️ 未找到 package.json，跳過依賴更新
    goto :done
)

:: 更新 npm 依賴
call npm install
if errorlevel 1 (
    echo.
    echo ❌ 依賴套件安裝失敗
    echo 請手動執行 npm install 檢查錯誤
    pause
    exit /b 1
)

echo.
echo ✓ 依賴套件更新完成
echo.

:done
echo.
echo ========================================
echo   🎉 更新成功！
echo ========================================
echo.
echo 您現在可以執行「一鍵啟動.bat」來啟動應用程式
echo.

pause

