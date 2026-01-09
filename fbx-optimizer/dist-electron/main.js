import { app, BrowserWindow, protocol, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
// ESM 需要手動定義 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';
// 進度視窗
let progressWindow = null;
let mainWindow = null;
// 創建進度視窗
function createProgressWindow() {
    if (progressWindow) {
        progressWindow.focus();
        return;
    }
    progressWindow = new BrowserWindow({
        width: 400,
        height: 160,
        resizable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        frame: false,
        alwaysOnTop: true,
        transparent: false,
        backgroundColor: '#1e1e1e',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // 載入進度視窗的 HTML
    const progressHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
          color: #fff;
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 24px;
          user-select: none;
          -webkit-app-region: drag;
        }
        .title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #4fc3f7;
        }
        .status {
          font-size: 13px;
          color: #aaa;
          margin-bottom: 16px;
        }
        .progress-container {
          background: #333;
          border-radius: 8px;
          height: 12px;
          overflow: hidden;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #4fc3f7, #29b6f6);
          border-radius: 8px;
          transition: width 0.3s ease;
          width: 0%;
        }
        .info {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          font-size: 12px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="title">🚀 正在下載更新</div>
      <div class="status" id="status">準備中...</div>
      <div class="progress-container">
        <div class="progress-bar" id="progress"></div>
      </div>
      <div class="info">
        <span id="speed">-- MB/s</span>
        <span id="percent">0%</span>
      </div>
    </body>
    </html>
  `;
    progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(progressHtml)}`);
    progressWindow.on('closed', () => {
        progressWindow = null;
    });
}
// 更新進度視窗
function updateProgress(percent, bytesPerSecond, transferred, total) {
    if (!progressWindow)
        return;
    const speed = (bytesPerSecond / 1024 / 1024).toFixed(2);
    const transferredMB = (transferred / 1024 / 1024).toFixed(1);
    const totalMB = (total / 1024 / 1024).toFixed(1);
    progressWindow.webContents.executeJavaScript(`
    document.getElementById('progress').style.width = '${percent.toFixed(1)}%';
    document.getElementById('percent').textContent = '${percent.toFixed(1)}%';
    document.getElementById('speed').textContent = '${speed} MB/s';
    document.getElementById('status').textContent = '已下載 ${transferredMB} MB / ${totalMB} MB';
  `).catch(() => { });
    // 同時更新主視窗的任務欄進度
    if (mainWindow) {
        mainWindow.setProgressBar(percent / 100);
    }
}
// 關閉進度視窗
function closeProgressWindow() {
    if (progressWindow) {
        // 因為設定了 closable: false，需要用 destroy() 強制關閉
        progressWindow.destroy();
        progressWindow = null;
    }
    // 清除任務欄進度
    if (mainWindow) {
        mainWindow.setProgressBar(-1);
    }
}
// ⚠️ 重要：必須在 app.whenReady() 之前註冊協議為特權協議
// 否則 <script src="app-resource://..."> 會被安全機制阻擋
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app-resource',
        privileges: {
            standard: true, // 允許標準 URL 解析
            secure: true, // 視為安全協議
            supportFetchAPI: true, // 支援 fetch API
            corsEnabled: true, // 允許 CORS
            stream: true, // 支援串流
        }
    }
]);
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        title: 'JR 3D Viewer',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // 允許載入本地檔案
        },
    });
    if (isDev) {
        // 開發模式可能使用不同的 port
        const devPort = process.env.DEV_PORT || '5173';
        mainWindow.loadURL(`http://localhost:${devPort}`);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.setMenuBarVisibility(false);
    // 🔧 阻止拖放檔案導致的頁面導航（解決拖放閃爍問題）
    mainWindow.webContents.on('will-navigate', (event, url) => {
        // 如果是 file:// 協議，表示是拖放檔案，阻止導航
        if (url.startsWith('file://')) {
            event.preventDefault();
            console.log('[Electron] 阻止拖放導航:', url);
        }
    });
    // 阻止新視窗開啟（拖放有時會觸發）
    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
app.whenReady().then(() => {
    // ========== 自動更新設定 ==========
    // 只在生產環境檢查更新
    if (!isDev) {
        // 設定更新日誌
        autoUpdater.logger = console;
        // 禁用自動下載，讓用戶決定是否更新
        autoUpdater.autoDownload = false;
        // 檢查更新
        autoUpdater.checkForUpdates();
    }
    // 註冊自定義協議來載入 extraResources
    protocol.handle('app-resource', async (request) => {
        // URL 結構：app-resource://public/effekseer/manifest.json?t=123
        // parsed.hostname = 'public'
        // parsed.pathname = '/effekseer/manifest.json'
        // 需要把 hostname + pathname 組合成完整路徑
        const parsed = new URL(request.url);
        const hostname = parsed.hostname; // 'public'
        const pathname = decodeURIComponent(parsed.pathname); // '/effekseer/manifest.json'
        // 組合成 'public/effekseer/manifest.json'（移除開頭斜線）
        const relativePath = hostname + pathname.replace(/^\/+/, '/');
        const resourcePath = path.join(process.resourcesPath, relativePath);
        console.log('[Protocol] 請求:', request.url);
        console.log('[Protocol] 解析路徑:', resourcePath);
        try {
            const data = await readFile(resourcePath);
            // 根據檔案副檔名設定 MIME type
            let mimeType = 'application/octet-stream';
            const ext = path.extname(resourcePath).toLowerCase();
            const mimeTypes = {
                '.wasm': 'application/wasm',
                '.js': 'application/javascript',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.efk': 'application/octet-stream',
                '.efkmat': 'application/octet-stream',
                '.efkmodel': 'application/octet-stream',
            };
            mimeType = mimeTypes[ext] || mimeType;
            return new Response(data, {
                headers: {
                    'Content-Type': mimeType,
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        catch (error) {
            console.error('[Protocol] ✗ 載入資源失敗:', resourcePath, error);
            return new Response('Not Found', { status: 404 });
        }
    });
    createWindow();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// ========== 自動更新事件處理 ==========
autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] 正在檢查更新...');
});
autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] 發現新版本:', info.version);
    // 詢問用戶是否要更新
    dialog.showMessageBox({
        type: 'info',
        title: '🎉 發現新版本',
        message: `發現新版本 ${info.version}！\n\n是否立即下載更新？`,
        detail: '選擇「稍後」將繼續使用目前版本，下次啟動時會再次詢問。',
        buttons: ['立即更新', '稍後'],
        defaultId: 0,
        cancelId: 1,
    }).then((result) => {
        if (result.response === 0) {
            // 用戶選擇更新，開始下載
            createProgressWindow();
            autoUpdater.downloadUpdate();
        }
        else {
            // 用戶選擇稍後，不做任何事
            console.log('[AutoUpdater] 用戶選擇稍後更新');
        }
    });
});
autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] 目前已是最新版本');
});
autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] 更新錯誤:', err);
    closeProgressWindow();
    const errorMessage = err.message || '';
    // 靜默處理以下錯誤，不顯示彈窗：
    // 1. 404 錯誤（repo 為 private 或不存在）
    // 2. 網路連線錯誤（沒有網路、DNS 解析失敗、連線逾時等）
    const silentErrors = [
        '404',
        'Not Found',
        'ENOTFOUND', // DNS 查詢失敗（無法找到主機）
        'ENETUNREACH', // 網路無法連線
        'EAI_AGAIN', // DNS 暫時失敗
        'ETIMEDOUT', // 連線逾時
        'ECONNREFUSED', // 連線被拒絕
        'ECONNRESET', // 連線被重置
        'EHOSTUNREACH', // 主機無法連線
        'net::ERR', // Chromium 網路錯誤
        'getaddrinfo', // DNS 解析錯誤
        'fetch failed', // fetch 失敗
    ];
    const isSilentError = silentErrors.some(keyword => errorMessage.includes(keyword));
    if (isSilentError) {
        console.log('[AutoUpdater] 無法連線到更新伺服器（網路問題或 repo 不可用），跳過更新檢查');
        return;
    }
    // 其他錯誤才顯示彈窗
    dialog.showMessageBox({
        type: 'error',
        title: '更新錯誤',
        message: `更新過程中發生錯誤：\n${err.message}`,
        buttons: ['確定']
    });
});
autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[AutoUpdater] 下載進度: ${progressObj.percent.toFixed(1)}%`);
    updateProgress(progressObj.percent, progressObj.bytesPerSecond, progressObj.transferred, progressObj.total);
});
autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] 更新已下載:', info.version);
    // 更新進度視窗顯示完成狀態
    if (progressWindow) {
        progressWindow.webContents.executeJavaScript(`
      document.getElementById('progress').style.width = '100%';
      document.getElementById('percent').textContent = '100%';
      document.getElementById('speed').textContent = '完成';
      document.getElementById('status').textContent = '下載完成！準備安裝...';
      document.querySelector('.title').textContent = '✅ 下載完成';
      document.querySelector('.progress-bar').style.background = 'linear-gradient(90deg, #4caf50, #8bc34a)';
    `).catch(() => { });
    }
    // 短暫延遲後關閉進度視窗並顯示對話框
    setTimeout(() => {
        closeProgressWindow();
        dialog.showMessageBox({
            type: 'info',
            title: '✅ 更新已就緒',
            message: `新版本 ${info.version} 已下載完成！\n是否立即重啟安裝？`,
            buttons: ['立即重啟', '稍後'],
            defaultId: 0,
        }).then((result) => {
            if (result.response === 0) {
                // 靜默安裝並在完成後自動啟動應用程式
                // 參數: (isSilent: true, isForceRunAfter: true)
                autoUpdater.quitAndInstall(true, true);
            }
        });
    }, 800);
});
//# sourceMappingURL=main.js.map