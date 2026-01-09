# efk_loader_error_fix_260109

## 摘要

本報告記錄 **JR 3D Viewer / FBX_Editor_Tool** 專案中，於「網頁模式（Vite dev / browser）」使用 **「上傳特效資料夾」** 功能時，Effekseer 1.70（`fbx-optimizer/efk170`）會拋出：

- `Uncaught TypeError: Failed to execute 'texImage2D' on 'WebGL2RenderingContext': Overload resolution failed.`

導致特效載入失敗的根本原因，並完整說明本次修復採用的最終方案：**改走 Effekseer 1.70 原生支援的 `loadEffect(ArrayBuffer)` + `setResourceLoader()` 供應資源**，徹底避開 `redirect()` 回傳 `blob:` / `data:` URL 的相容性問題。

> 文件命名：`efk_loader_error_fix_260109`（民國 115/01/09）

---

## 問題現象

### 使用情境

- 執行模式：**網頁模式**（Vite dev / browser）
- 操作：點擊 UI「上傳特效資料夾」，選擇包含 `.efk` 與貼圖/材質的資料夾（例如 Boss 效果資料夾）
- 結果：控制台出現 `texImage2D` 相關錯誤，特效載入失敗

### 錯誤訊息（代表性）

- `Uncaught TypeError: Failed to execute 'texImage2D' on 'WebGL2RenderingContext': Overload resolution failed.`
- Stack 常見落點：`effekseer.min.js` / `ReloadResources` / `EffekseerEffect._reload`

---

## 根因分析（為什麼會發生）

### 1) Effekseer 1.70 的資源載入器是「看副檔名決定走哪條路」

EffekseerForWebGL 1.70（`fbx-optimizer/efk170/effekseer.js`）內部 `_loadResource(path, onload, onerror)` 會依據 `path` 的副檔名選擇載入策略：

- `.png` / `.jpg`：用 `new Image()` 載入，並在 onload 後做 power-of-two 轉換
- `.tga`：直接回報 not supported
- 其他：走 XHR `arraybuffer`（二進位）

也就是說：**資源 URL 的字串內容（尤其副檔名）會影響 Effekseer 用哪種方式解碼資源。**

### 2) `redirect()` 回傳 `data:` / `blob:` URL 會破壞「副檔名判斷」

早期實作為了讓「任意資料夾」可載入，採用：

- 將資源轉成 `blob:` 或 `data:` URL
- 在 `EffekseerContext.loadEffect(..., redirect)` 裡，透過 `redirect(path)` 回傳對應的 URL

但實際上：

- `data:image/png;base64,...` **沒有 `.png` 副檔名**
- `blob:http://localhost:5173/<uuid>` 也通常 **沒有 `.png` / `.jpg` 副檔名**

因此 Effekseer 內部會把這些 URL 當作「非圖片副檔名」或「非預期路徑」，改走 **XHR arraybuffer** 的二進位流程，最後得到的不是可用的 `HTMLImageElement/Canvas`，導致：

- 內部 texture 上傳階段 `texImage2D(...)` 的參數型別不符合，直接炸 `Overload resolution failed`

> 核心點：**這不是你資源不存在，也不是 CORS，而是 Effekseer 1.70 內部 loader 對 URL 字串的解析/分流策略與 `data:`/`blob:` URL 不相容。**

### 3) 另一路徑：`Module.resourcesMap` 的 key 也依賴「正確的 path」

Effekseer 1.70 也支援用 `Module.resourcesMap[path] = ArrayBuffer` 直接餵資源（同 `loadEffectPackage` 的行為），但 key 的 `path` 是經過：

- `effect.baseDir + path`
- 再 `redirect()`（若有）

拼出的結果，若 redirect 回傳 data/blob URL，key 會變得不可控，命中率也不穩定。

---

## 修復策略總覽

### 我們最終採用的方案（推薦／穩定）

**改用 Effekseer 1.70 原生支援的「ArrayBuffer 載入效果 + setResourceLoader 供應資源」：**

1. `.efk` 主檔：使用 `loadEffect(ArrayBuffer, ...)`（不是 URL 字串）
2. 貼圖/材質/模型：在載入前呼叫 `effekseerContext.setResourceLoader(loader)`
   - loader 優先從「使用者上傳的檔案」Map 中找到對應的 ArrayBuffer
   - 圖片（png/jpg/jpeg）：ArrayBuffer → Blob → `Image()` →（必要時）轉 power-of-two canvas → onload(image/canvas)
   - 其他（二進位）：直接 onload(ArrayBuffer)
   - 若 Map 找不到：fallback 回原本 URL 載入（維持原行為）

這條路徑完全避開了：

- `redirect()` 回傳 `data:` / `blob:` URL
- 副檔名判斷失準
- 造成 `texImage2D` 型別錯誤

---

## 本次程式改動（完整紀錄）

### 1) `LoadEffectUseCase`：從「URL/resourceMap」改為「ArrayBuffer + resources Map」

#### 檔案

- `fbx-optimizer/src/application/use-cases/LoadEffectUseCase.ts`

#### 舊行為（問題來源）

- 讀取使用者選取的檔案後，把資源轉成 `blob:` 或 `data:` URL
- 使用 `effekseerContext.loadEffect(urlString, scale, onload, onerror, redirect)`
- `redirect()` 回傳 URL（blob/data），導致 Effekseer 1.70 走錯 loader 分支

#### 新行為（修復後）

- 讀取所有 `File` → `ArrayBuffer`
- 找出主 `.efk` 的 `ArrayBuffer` 作為 `effectBuffer`
- 建立 `Map<string, ArrayBuffer>` 作為 `resources`
  - 以多種 key 註冊（完整路徑 / 去 root / 純檔名 / `./xxx` / 最後一段）
- 呼叫 `adapter.loadEffectFromArrayBuffer({ id, effectBuffer, scale, resources })`

> 注意：此 UseCase 的回傳改為 `Promise<void>`（不再回傳 effect URL）

---

### 2) `EffekseerRuntimeAdapter`：新增 `loadEffectFromArrayBuffer` 並注入 `setResourceLoader`

#### 檔案

- `fbx-optimizer/src/infrastructure/effect/EffekseerRuntimeAdapter.ts`

#### 新增功能

- `loadEffectFromArrayBuffer(...)`
  - 確保 runtime 已初始化
  - 設定 `effekseerContext.setResourceLoader(...)`
  - 用 `effekseerContext.loadEffect(effectBuffer, scale, onload, onerror)` 載入主特效
  - 成功後放入 `loadedEffects`

#### `setResourceLoader` 的行為

- 若 `path` 副檔名是 `.png/.jpg/.jpeg`：
  - 從 resources Map 取出 ArrayBuffer（若有）
  - 轉 Blob → 產生 `objectURL` → `Image()` 載入
  - onload 後做 power-of-two 轉換（比照 `efk170/effekseer.js` 的 `_convertPowerOfTwoImage`）
  - 回傳 `HTMLImageElement` 或 `Canvas` 給 Effekseer
- 其他副檔名：
  - 若 Map 有：直接回傳 ArrayBuffer
  - 否則 fallback：走 XHR `arraybuffer`

---

### 3) `EffectTestPanel`：維持呼叫 UseCase，但不依賴回傳 URL

#### 檔案

- `fbx-optimizer/src/presentation/features/effect-panel/components/EffectTestPanel.tsx`

#### 調整點

- `handleUploadEffectFolder` 原本依賴 `LoadEffectUseCase.execute(...)` 回傳值（舊設計）
- 修復後 `LoadEffectUseCase.execute(...)` 直接完成載入，不再需要回傳 URL
- UI 邏輯維持：載入成功後新增卡片並標記 `isLoaded: true`

---

## 為什麼這個方案「最不麻煩、最穩」

### 你原本的期待

> 「在 Electron 打包模式/網頁模式下，都能自由選擇電腦任意資料夾載入 efk，像音效一樣」

### Effekseer 1.70 的現實限制

Effekseer 的 `.efk` 並不是單檔，會在載入過程中「動態要求」多個資源，並且其載入器行為受 URL 字串與副檔名影響；因此「直接把資源變成 blob/data URL 再 redirect」在 1.70 會踩到 loader 的分支判斷問題。

### ArrayBuffer + ResourceLoader 的優勢

- **不依賴 URL 字串**（因此不受副檔名判斷誤差影響）
- **在瀏覽器與 Electron 都一致**（來源是 File/ArrayBuffer）
- 可控性高：資源搜尋 key、fallback 行為都在我們手上

---

## 後續建議 / 注意事項

1. **效能/記憶體**
   - 上傳資料夾會把所有資源讀入記憶體（ArrayBuffer）
   - 大型特效/大量貼圖會佔用顯著 RAM
   - 可考慮：只餵「該 efk 目錄」內資源、或做 LRU cache/釋放機制

2. **圖片格式限制**
   - 依 Effekseer 1.70 loader：主要支援 `.png/.jpg(.jpeg)`
   - `.tga` 在內部明確 `not supported`
   - `.dds` 不在預設 loader 的圖片分支（可能會被當二進位）

3. **多特效同時上傳**
   - 若同資料夾有多個 `.efk`，目前流程會逐一載入
   - `setResourceLoader` 是 context 層級，後續若要同時載不同資料夾需注意資源 map 的生命週期/覆寫策略

---

## 參考（Effekseer 1.70 原始碼位置）

- `fbx-optimizer/efk170/effekseer.js`
  - `_loadResource`：以副檔名決定 Image vs XHR
  - `Module._loadImage` / `Module._loadBinary`：資源載入入口
  - `setResourceLoader`：可替換 `_loadResource` 實作
  - `loadEffect(data: string|ArrayBuffer, ...)`：支援 `ArrayBuffer` 載入


