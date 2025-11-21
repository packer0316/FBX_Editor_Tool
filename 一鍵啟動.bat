@echo off
chcp 65001
echo ==========================================
echo 正在啟動 FBX 瘦身工具...
echo 請勿關閉此視窗，網頁將自動開啟。
echo ==========================================

cd /d "%~dp0fbx-optimizer"

:: 開啟瀏覽器
start "" "http://localhost:5173"

:: 啟動伺服器
npm run dev

pause
