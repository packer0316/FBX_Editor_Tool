## Effekseer Web Runtime 資源放置說明

此資料夾用來存放 Effekseer 的 Web Runtime 檔案（JS + WASM），供前端直接從 `/effekseer/...` 路徑載入。

### 必須放入的檔案（請由官方下載）

- `effekseer.min.js`
- `effekseer.wasm`（實際檔名依官方發佈為準，例如 `effekseer.wasm` 或其他）

> **注意**：本倉庫不直接附帶這些編譯後的二進位檔與壓縮 JS，請從 Effekseer 官方或其 GitHub 釋出的 Web Runtime 套件下載後，手動放入本資料夾。

放好之後，開發環境下可以透過下列 URL 存取：

- `http://localhost:5173/effekseer/effekseer.min.js`
- `http://localhost:5173/effekseer/effekseer.wasm`

當你打開瀏覽器 DevTools Console，應該能看到全域的 `effekseer` 物件（之後 Step 1-2 我們會包成 TypeScript Adapter）。



