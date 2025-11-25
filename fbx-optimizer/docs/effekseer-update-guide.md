# Effekseer WebGL Runtime 更新指南

## 當前版本

你目前使用的 Effekseer Runtime 來自 npm 套件 `@zaniar/effekseer-webgl-wasm` (v1.62.5000)

## 如何更新到最新版本

### 方法 1：手動從官方網站下載（推薦）

1. 前往 Effekseer 官方網站下載頁面：
   ```
   https://effekseer.github.io/en/download.html
   ```

2. 下載「Runtime for Web」最新版本

3. 解壓縮後，找到以下檔案：
   - `effekseer.min.js`
   - `effekseer.wasm`

4. 將這兩個檔案複製到專案的 `public/effekseer/` 資料夾，替換舊檔案

### 方法 2：從 GitHub Releases 下載

1. 前往 GitHub Releases 頁面：
   ```
   https://github.com/effekseer/EffekseerForWebGL/releases
   ```

2. 下載最新的 Release（例如 `170a`）

3. 解壓縮找到 `Release` 資料夾中的：
   - `effekseer.min.js`
   - `effekseer.wasm`

4. 複製到 `public/effekseer/` 替換舊檔案

### 方法 3：使用最新的 npm 套件

檢查是否有更新的 npm 套件：

```bash
npm search effekseer
```

如果有更新版本，可以安裝並從 `node_modules` 複製檔案：

```bash
npm install @zaniar/effekseer-webgl-wasm@latest
```

然後複製：
```
node_modules/@zaniar/effekseer-webgl-wasm/dist/effekseer.min.js -> public/effekseer/
node_modules/@zaniar/effekseer-webgl-wasm/dist/effekseer.wasm -> public/effekseer/
```

## 更新後的測試步驟

1. 清除瀏覽器快取（Ctrl+Shift+Delete）

2. 重新整理專案：
   ```bash
   npm run dev
   ```

3. 開啟瀏覽器 Console，確認沒有載入錯誤

4. 切換到 Effect 分頁，等待「✓ 就緒」狀態

5. 上傳 `.efk` 檔案測試

## 版本相容性注意事項

- Effekseer 1.6x 版本可能與 1.7x 版本的特效檔不相容
- 如果更新後仍有問題，可能需要在 Effekseer Editor 中重新匯出特效檔
- 建議使用與 Editor 同版本的 Runtime

## 備份建議

更新前，建議先備份目前的檔案：

```powershell
# 在專案根目錄執行
Copy-Item public\effekseer\effekseer.min.js public\effekseer\effekseer.min.js.backup
Copy-Item public\effekseer\effekseer.wasm public\effekseer\effekseer.wasm.backup
```

如果更新後有問題，可以還原：

```powershell
Copy-Item public\effekseer\effekseer.min.js.backup public\effekseer\effekseer.min.js
Copy-Item public\effekseer\effekseer.wasm.backup public\effekseer\effekseer.wasm
```

## 相關連結

- [Effekseer 官方網站](https://effekseer.github.io/)
- [EffekseerForWebGL GitHub](https://github.com/effekseer/EffekseerForWebGL)
- [Effekseer 下載頁面](https://effekseer.github.io/en/download.html)

