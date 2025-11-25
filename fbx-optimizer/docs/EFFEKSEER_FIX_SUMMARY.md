# ✅ Effekseer 整合問題修正總結

## 問題根源

經過仔細研究官方 Sample (`efk170/Sample/index.html`)，發現我們的實作與官方範例有重大差異：

### 錯誤的做法（之前）
1. ❌ 使用自己建立的 Canvas 和 WebGL Context
2. ❌ 使用 ArrayBuffer 載入特效
3. ❌ 手動處理資源映射（Data URI、預載入等）
4. ❌ 沒有同步 Three.js 相機矩陣
5. ❌ 沒有設定快速渲染模式

### 正確的做法（官方範例）
1. ✅ 使用 Three.js renderer 的 WebGL Context
2. ✅ 使用 URL 字串載入特效（Blob URL）
3. ✅ 讓 Effekseer 自動處理相對路徑的資源
4. ✅ 同步 Three.js 的投影矩陣和視圖矩陣
5. ✅ 設定 `setRestorationOfStatesFlag(false)` 快速渲染

## 主要修改

### 1. EffekseerRuntimeAdapter
**修改前**：
```typescript
// 使用自己的 Canvas
public async initWithCanvas(canvas: HTMLCanvasElement)
const webglContext = canvas.getContext('webgl');
context.init(webglContext, { instanceMaxCount: 2000, squareMaxCount: 8000 });

// 使用 ArrayBuffer + redirect
effect = context.loadEffect(buffer, scale, onload, onerror, redirect);
```

**修改後**：
```typescript
// 使用 Three.js 的 WebGL Context
public async initWithThreeContext(webglContext: WebGLRenderingContext)
context.init(webglContext); // 官方範例方式
context.setRestorationOfStatesFlag(false); // 快速渲染模式

// 使用 URL 字串
effect = context.loadEffect(url, scale, onload, onerror);
```

### 2. InitEffekseerRuntimeUseCase
**修改前**：
```typescript
execute(params: { canvas: HTMLCanvasElement })
```

**修改後**：
```typescript
execute(params: { webglContext: WebGLRenderingContext })
```

### 3. LoadEffectUseCase
**修改前**：
```typescript
// 複雜的資源映射邏輯
const resourceMap = new Map<string, HTMLImageElement>();
// 預載入所有圖片...
// 將 File 轉為 ArrayBuffer...
await adapter.loadEffect({ buffer, resourceMap });
```

**修改後**：
```typescript
// 簡單的 Blob URL
const blobUrl = URL.createObjectURL(file);
await adapter.loadEffect({ id, url: blobUrl, scale });
```

### 4. SceneViewer / EffekseerFrameBridge
**新增功能**：
```typescript
// 在 R3F 內部取得 WebGL Context
const { gl, camera } = useThree();
const webglContext = gl.getContext() as WebGLRenderingContext;
InitEffekseerRuntimeUseCase.execute({ webglContext });

// 同步相機矩陣（每幀）
context.setProjectionMatrix(camera.projectionMatrix.elements);
context.setCameraMatrix(camera.matrixWorldInverse.elements);

// 重置 Three.js 狀態
state.gl.resetState();
```

### 5. EffectTestPanel
**修改前**：
- 多選檔案/資料夾
- 處理 `.png`、`.efkmat` 等關聯檔案

**修改後**：
- 只選擇單一 `.efk` 檔案
- Effekseer 自動處理相對路徑的資源

## 關鍵改進

1. **簡化架構**
   - 移除了複雜的資源預載入和映射邏輯
   - 完全依賴 Effekseer 官方的資源載入機制

2. **正確的 WebGL Context**
   - 與 Three.js 共享同一個 WebGL Context
   - 避免多個 Context 導致的衝突

3. **相機矩陣同步**
   - 每幀同步 Three.js 相機到 Effekseer
   - 確保特效在正確的視角顯示

4. **快速渲染模式**
   - `setRestorationOfStatesFlag(false)` 提升性能
   - 每幀結束後呼叫 `gl.resetState()` 恢復 Three.js 狀態

## 測試步驟

1. **重新整理瀏覽器**（Ctrl + Shift + R）

2. **查看 Console**，應該會看到：
   ```
   [EffekseerFrameBridge] 開始初始化 Effekseer Runtime...
   [EffekseerRuntimeAdapter] WASM 載入完成
   [EffekseerRuntimeAdapter] Context 建立成功，準備初始化 WebGL
   [EffekseerRuntimeAdapter] WebGL 初始化完成（快速渲染模式）
   [EffekseerFrameBridge] ✓ Effekseer Runtime 初始化成功
   [EffectTestPanel] ✓ Effekseer Runtime 已就緒
   ```

3. **切換到 Effect 分頁**

4. **上傳單一 `.efk` 檔案**（例如 `efk170/Resources/Laser01.efk`）

5. **點擊 Play** - 特效應該正常顯示！

## 注意事項

- `.efk` 檔案引用的資源（貼圖等）需要與 `.efk` 在同一相對路徑
- 如果上傳的 `.efk` 檔案中有相對路徑的資源，Effekseer 會嘗試從 Blob URL 的 baseDir 載入
- 對於複雜的特效專案，建議使用 `.efkpkg` Package 格式

## 參考資料

- 官方 Sample：`efk170/Sample/index.html`
- Effekseer 1.70e WebGL Runtime
- [Effekseer 官方網站](https://effekseer.github.io/)

---

**修正完成時間**：2024  
**修正方式**：完全按照官方 Sample 重寫整合邏輯


