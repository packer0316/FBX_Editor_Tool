import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';

// ESM 需要手動定義 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// ⚠️ 重要：必須在 app.whenReady() 之前註冊協議為特權協議
// 否則 <script src="app-resource://..."> 會被安全機制阻擋
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-resource',
    privileges: {
      standard: true,      // 允許標準 URL 解析
      secure: true,        // 視為安全協議
      supportFetchAPI: true, // 支援 fetch API
      corsEnabled: true,   // 允許 CORS
      stream: true,        // 支援串流
    }
  }
]);

function createWindow() {
  const win = new BrowserWindow({
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
    win.loadURL(`http://localhost:${devPort}`);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.setMenuBarVisibility(false);

  // 🔧 阻止拖放檔案導致的頁面導航（解決拖放閃爍問題）
  win.webContents.on('will-navigate', (event, url) => {
    // 如果是 file:// 協議，表示是拖放檔案，阻止導航
    if (url.startsWith('file://')) {
      event.preventDefault();
      console.log('[Electron] 阻止拖放導航:', url);
    }
  });

  // 阻止新視窗開啟（拖放有時會觸發）
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
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
      const mimeTypes: Record<string, string> = {
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
    } catch (error) {
      console.error('[Protocol] ✗ 載入資源失敗:', resourcePath, error);
      return new Response('Not Found', { status: 404 });
    }
  });
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

