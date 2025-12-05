@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title FBX 編輯工具 - 更新到最新版本

echo.
echo ========================================
echo   FBX 編輯工具 - 更新到最新版本
echo ========================================
echo.

:: 進入 fbx-optimizer 目錄
if exist "fbx-optimizer" (
    cd fbx-optimizer
) else (
    echo ❌ 錯誤：找不到 fbx-optimizer 資料夾
    echo 請確保在正確的專案根目錄執行此腳本
    pause
    exit /b 1
)

echo [1/3] 正在檢查 Git 倉庫...
echo.

:: 檢查是否在 Git 倉庫中
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ❌ 錯誤：此資料夾不是 Git 倉庫
    echo 請確保您在正確的專案資料夾中執行此腳本
    cd ..
    pause
    exit /b 1
)

echo ✓ Git 倉庫檢查完成
echo.

echo [2/5] 正在檢查本地修改...
echo.

:: 檢查是否有未提交的修改
git status --porcelain >nul 2>&1
if errorlevel 1 (
    echo ❌ Git 狀態檢查失敗
    cd ..
    pause
    exit /b 1
)

:: 檢查是否有修改的檔案
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set CHANGES=%%i

if %CHANGES% GTR 0 (
    echo ⚠️  偵測到本地有未提交的修改：
    echo.
    git status --short
    echo.
    echo ══════════════════════════════════════
    echo   警告：即將還原所有本地修改！
    echo ══════════════════════════════════════
    echo.
    echo 請選擇：
    echo   [1] 繼續更新（將丟失所有本地修改）
    echo   [2] 取消更新（保留本地修改）
    echo.
    choice /C 12 /N /M "請輸入選擇 (1 或 2): "
    
    if errorlevel 2 (
        echo.
        echo ✓ 已取消更新
        cd ..
        pause
        exit /b 0
    )
    
    echo.
    echo [3/5] 正在還原本地修改...
    echo.
    
    :: 清理未追蹤的檔案和目錄
    git clean -fd
    if errorlevel 1 (
        echo ❌ 清理未追蹤檔案失敗
        cd ..
        pause
        exit /b 1
    )
    
    :: 還原所有修改
    git reset --hard HEAD
    if errorlevel 1 (
        echo ❌ 還原本地修改失敗
        cd ..
        pause
        exit /b 1
    )
    
    echo ✓ 本地修改已還原
    echo.
) else (
    echo ✓ 沒有本地修改，無需還原
    echo.
    echo [3/5] 跳過還原步驟...
    echo.
)

echo [4/5] 正在從 GitHub 拉取最新代碼...
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
        cd ..
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
    cd ..
    pause
    exit /b 1
)

echo.
:: 使用 reset 而不是 pull，確保強制同步
git reset --hard origin/%CURRENT_BRANCH%
if errorlevel 1 (
    echo.
    echo ❌ 同步代碼失敗
    cd ..
    pause
    exit /b 1
)

echo.
echo ✓ 代碼更新完成
echo.

echo [5/5] 正在更新依賴套件...
echo.

:: 更新 npm 依賴
call npm install
if errorlevel 1 (
    echo.
    echo ❌ 依賴套件安裝失敗
    echo 請手動執行 npm install 檢查錯誤
    cd ..
    pause
    exit /b 1
)

echo.
echo ✓ 依賴套件更新完成
echo.

cd ..

echo.
echo ========================================
echo   🎉 更新成功！
echo ========================================
echo.
echo 您現在可以執行「一鍵啟動.bat」來啟動應用程式
echo.

pause

