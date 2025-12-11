# 專案上下文文檔 (PROJECT_CONTEXT.md)

> **給 AI 助手的專案說明**：此文件提供專案的完整技術上下文，幫助 AI 快速理解專案架構、資料流和商業邏輯。

---

## 📋 專案概述

**專案名稱**：JR 3D Viewer / FBX Optimizer  
**專案類型**：Web-based 3D 模型檢視與優化工具  
**主要功能**：FBX 模型載入、動畫優化、Shader 效果應用、音訊同步、模型導出

---

## 🛠️ 技術棧

### 核心技術
- **前端框架**：React 19.2.0 + TypeScript 5.9.3
- **建置工具**：Vite 7.2.4
- **3D 渲染**：Three.js 0.181.2
- **React 3D 整合**：@react-three/fiber 9.4.0 + @react-three/drei 10.7.7
- **樣式**：Tailwind CSS 3.4.18
- **圖示**：Lucide React 0.554.0
- **狀態管理**：Zustand（Director Mode 專用）

### 音訊處理
- **Web Audio API**：原生瀏覽器 API
- **MP3 編碼**：lamejs 1.2.1（透過全域載入）

### Spine 動畫
- **Spine Runtime**：spine-ts 3.8（本地整合於 vendor/）
- **渲染方式**：Canvas 2D API

### 開發工具
- **Linter**：ESLint 9.39.1 + TypeScript ESLint
- **CSS 處理**：PostCSS + Autoprefixer

---

## 🏗️ 架構設計

### 架構模式：Domain-Driven Design (DDD) 啟發

專案採用分層架構，明確分離業務邏輯、應用邏輯、基礎設施和表現層：

```
src/
├── domain/              # 領域層：核心業務邏輯（無外部依賴）
│   ├── services/       # 領域服務（業務邏輯）
│   └── value-objects/  # 值對象（不可變數據結構）
├── application/         # 應用層：用例協調
│   └── use-cases/      # 業務用例（協調 Domain + Infrastructure）
├── infrastructure/      # 基礎設施層：外部依賴封裝
│   └── audio/          # 音訊 API 適配器
├── presentation/        # 表現層：UI 和用戶交互
│   ├── features/       # 功能模組（按功能組織）
│   └── hooks/          # React Hooks（UI 邏輯）
└── utils/              # 工具函數（通用工具）
```

### 架構原則

1. **依賴方向**：Presentation → Application → Domain ← Infrastructure
2. **Domain 層獨立**：不依賴任何外部框架（React、Three.js 等）
3. **單一職責**：每個類別/函數只負責一件事
4. **不可變更新**：使用函數式更新模式，不直接修改狀態

---

## 📊 核心資料流

### 1. 模型載入流程

```
用戶拖放檔案
  ↓
App.tsx → handleFileUpload()
  ↓
LoadModelUseCase.execute(files)
  ↓
ModelLoaderService.classifyFiles()      # 分類 FBX 和貼圖
  ↓
ModelLoaderService.loadFBX()            # 載入 FBX，設定貼圖 URL 修改器
  ↓
MaterialFixService.fixMaterials()      # 修復材質問題
  ↓
ModelLoaderService.extractMeshNames()   # 提取 mesh 名稱
  ↓
返回 LoadModelResult { model, meshNames, defaultShaderGroup, animations }
  ↓
App.tsx 更新狀態 → SceneViewer 渲染模型
```

### 2. 動畫優化流程

```
用戶調整 tolerance 滑桿
  ↓
App.tsx → useEffect([tolerance, originalClip])
  ↓
optimizeAnimationClip(originalClip, tolerance)
  ↓
AnimationOptimizer.optimize()
  ↓
對每個 Track 執行 optimizeTrack()
  ↓
線性插值檢查：是否可以移除關鍵幀？
  ↓
返回優化後的 AnimationClip
  ↓
App.tsx 更新 optimizedClip → SceneViewer 播放新動畫
```

### 3. Shader 應用流程

```
用戶在 MaterialShaderTool 中選擇 mesh 和 shader 功能
  ↓
更新 shaderGroups 狀態（透過 updateShaderGroupFeatureParam）
  ↓
SceneViewer useEffect([model, shaderGroups])
  ↓
遍歷模型中的每個 mesh
  ↓
找到對應的 shaderGroup
  ↓
載入所需貼圖（loadTexture）
  ↓
建立 THREE.ShaderMaterial（包含 vertex/fragment shader）
  ↓
設定 uniforms（貼圖、顏色、參數等）
  ↓
應用材質到 mesh
```

### 4. 音訊同步流程

```
動畫播放 → SceneViewer 每幀更新時間
  ↓
onTimeUpdate(time) → App.tsx handleTimeUpdate()
  ↓
AudioSyncUseCase.handleTimeUpdate(time, isPlaying, clip, audioTracks)
  ↓
檢查每個 audioTrack 的 triggers
  ↓
如果 clip.name 匹配且時間跨越 trigger.frame
  ↓
WebAudioAdapter.play(track)
  ↓
AudioGraphBuilder.createPlaybackGraph()  # 建立效果圖形
  ↓
播放音訊（應用 EQ、濾波器、回音等效果）
```

### 5. 模型導出流程

```
用戶點擊「導出優化模型」
  ↓
App.tsx → handleExport()
  ↓
ExportModelUseCase.execute(model, optimizedClip, fileName)
  ↓
複製模型 → 替換動畫 → GLTFExporter.parse()
  ↓
生成 GLB ArrayBuffer → 建立 Blob → 觸發下載
```

### 6. Director Mode 播放流程

```
進入 Director Mode → 暫停所有模型、禁用 LOOP
  ↓
用戶拖曳動作到時間軸 → 創建 Clip（記錄 sourceModelId, startFrame）
  ↓
點擊播放 → useTimelinePlayback Hook
  ↓
requestAnimationFrame 循環更新 currentFrame
  ↓
檢查每個 Track 的 Clips 是否在播放範圍
  ↓
計算 Clip 局部時間 = (currentFrame - startFrame) / fps
  ↓
updateModel(modelId, { currentTime: localTime })
  ↓
同步觸發音效與特效（檢查 trigger.clipId 和 trigger.frame）
  ↓
SceneViewer 各模型獨立播放對應動畫
```

### 7. Spine 動畫載入與播放流程

```
用戶上傳 Spine 檔案（.skel + .atlas + 圖片）
  ↓
SpineFileUploader 解析檔案
  ↓
SpineRuntimeAdapter.load() 建立骨架
  ↓
SpineInstance 存入 spineStore (Zustand)
  ↓
handleAddSpineElement() 創建 SpineElement2D
  ↓
添加到 Layer.children
  ↓
Layer2DRenderer 渲染 SpineElement 組件
  ↓
SpineElement 內部：
  - 初始化 SpineCanvasRenderer
  - 啟動 requestAnimationFrame 動畫循環
  - 調用 adapter.update() 推進動畫
  - 調用 renderer.render() 渲染骨架
```

### 8. Director Mode 下的 Spine 同步流程

```
Director 時間軸播放
  ↓
useDirectorSpineTrigger 訂閱 directorStore
  ↓
根據 currentFrame 計算 Spine Clip 的 localTime
  ↓
調用 adapter.resume() / adapter.pause() / adapter.seek()
  ↓
調用 onUpdateSpineElement() 更新 element.isPlaying, element.currentTime
  ↓
layers state 更新 → SpineElement 重新渲染
  ↓
SpineElement 動畫循環（element.isPlaying === true 時）：
  - adapter.update(deltaTime) 推進骨架動畫
  - renderer.render() 渲染到 Canvas
  - onUpdate({ currentTime }) 同步時間回父組件
```

**⚠️ 關鍵注意事項**：
- `SpineElement` 的動畫循環依賴 `onUpdate` 回調同步時間
- 若 `onUpdate` 為 undefined（如非 2D 模組時），時間無法同步
- 可能導致 seek useEffect 被錯誤觸發，造成動畫「卡住」
- **解決方案**：Director 模式下確保 `onUpdateElement` 始終可用

### 9. Effekseer 特效載入與資源追蹤流程

```
用戶點擊「載入」按鈕
  ↓
handleLoad() 檢查 effectResourceCache
  ↓
┌─ 有快取 ─────────────────────────────────────┐
│  直接使用快取的資源列表                        │
│  更新 item.resourceStatus                     │
└────────────────────────────────────────────────┘
  ↓ 無快取
EffekseerRuntimeAdapter.loadEffect(url, { redirect })
  ↓
redirect 回調攔截每個資源請求
  ├─ 解析資源路徑和類型
  ├─ fetch HEAD 檢查資源是否存在
  └─ 記錄到 resourceStatusMap
  ↓
載入完成後
  ├─ 存入 effectResourceCache（路徑 → 資源列表）
  └─ 更新 item.resourceStatus
```

**⚠️ Effekseer 快取注意事項**：
- Effekseer Runtime 有內部快取，重複載入時 `redirect` 不會被呼叫
- 使用 `effectResourceCache`（應用層 Map）解決此問題
- **清除快取是全域操作**：會影響所有模型的特效狀態
- 詳細架構：`archi_docs/EFFEKSEER_INTEGRATION_ARCHITECTURE.md`

---

## 💼 關鍵商業邏輯

### 1. 動畫優化演算法

**目的**：減少動畫檔案大小，同時保持視覺品質

**演算法**：
- 對每個 KeyframeTrack 進行處理
- 對於每個關鍵幀（除了第一幀和最後一幀）：
  - 計算是否可以由前一個保留幀和後一個關鍵幀線性插值近似
  - 如果插值誤差 < tolerance，則移除該關鍵幀
- 總是保留第一幀和最後一幀

**參數**：
- `tolerance`：誤差容忍度（0.001-0.1），值越大刪除越多關鍵幀

### 2. 材質修復邏輯

**問題**：FBX 模型載入後可能出現全黑、顏色錯誤等問題

**修復項目**：
- 關閉頂點顏色（避免模型變黑）
- 確保有貼圖時基礎顏色為白色
- 修復全黑問題（無貼圖且顏色為黑色時設為灰色）
- 重置 PBR 參數（roughness、metalness）
- 啟用雙面渲染

### 3. Shader 組合系統

**概念**：將多個 shader 效果組合應用於選定的 mesh

**結構**：
- `ShaderGroup`：包含多個 `ShaderFeature` 和選定的 `selectedMeshes`
- `ShaderFeature`：單一 shader 效果（Matcap、Rim Light、Flash 等）
- 每個 mesh 只能屬於一個 ShaderGroup（切換時會自動從其他組移除）

**Shader 類型**：
- `matcap`：材質捕捉（環境光照模擬）
- `matcap_add`：加法 Matcap
- `rim_light`：邊緣光
- `flash`：閃光效果（動態掃描）
- `dissolve`：溶解效果
- `alpha_test`：Alpha 測試
- `normal_map`：法線貼圖

### 4. 音訊觸發系統

**概念**：根據動畫播放時間自動觸發音訊

**匹配機制**：
- 使用 `clip.name` 而非 `clip.uuid` 來匹配觸發器
- 原因：優化後的動畫 UUID 會改變，但名稱保持不變
- 當動畫時間跨越 `trigger.frame` 時觸發播放

**音訊效果**：
- EQ（低/中/高頻）
- 濾波器（低通/高通）
- 回音效果
- 音高調整（detune）
- 播放速率調整

### 5. 動作序列播放系統

**功能**：連續播放多個動畫片段

**邏輯**：
- 添加片段時會複製（clone），確保每個項目有唯一引用
- 移除片段時自動調整當前播放索引
- 重新排序時會停止播放（安全考量）
- 片段結束時自動播放下一個

### 6. Director Mode（導演模式）

**概念**：類似影片剪輯軟體的多軌道時間軸編輯器

**核心類型**：
- `DirectorTrack`：軌道，包含多個 Clip
- `DirectorClip`：片段，記錄來源模型、動畫、起始幀
- `TimelineState`：時間軸狀態（totalFrames, fps, currentFrame, isPlaying）

**全域時間軸同步**：
```typescript
// 計算 Clip 局部時間
function getClipLocalTime(globalFrame: number, clip: Clip, fps: number): number | null {
  if (globalFrame < clip.startFrame || globalFrame > clip.endFrame) {
    return null; // Clip 不在播放範圍
  }
  return (globalFrame - clip.startFrame) / fps;
}
```

**狀態管理**：
- 使用 Zustand 獨立管理 Director 狀態
- 進入 Director Mode 時自動禁用所有模型的 LOOP 設置
- 退出時恢復原始 LOOP 狀態

**音效與特效同步**：
- 片段的 `sourceModelId` 對應到模型的 `audioTracks` 和 `effects`
- 檢查 `trigger.clipId` 和 `trigger.frame` 匹配時觸發

---

## 📁 目錄結構詳解

### Domain Layer（領域層）

```
domain/
├── services/
│   ├── AnimationOptimizer.ts          # 動畫優化演算法
│   ├── AnimationClipService.ts        # 動畫片段操作（創建子片段）
│   └── model/
│       ├── ModelLoaderService.ts      # FBX 載入、貼圖處理、mesh 提取
│       └── MaterialFixService.ts     # 材質修復邏輯
└── value-objects/
    ├── ShaderFeature.ts               # Shader 功能類型定義
    ├── AudioTrack.ts                  # 音訊軌道資料結構
    └── AudioTrigger.ts                # 音訊觸發器資料結構
```

**規則**：
- ✅ 不依賴 React、Three.js 等外部框架
- ✅ 純 TypeScript，可被任何平台重用
- ✅ 包含核心業務邏輯

### Application Layer（應用層）

```
application/
└── use-cases/
    ├── LoadModelUseCase.ts            # 載入模型用例
    ├── ExportModelUseCase.ts          # 導出模型用例
    ├── CreateClipUseCase.ts           # 創建動畫片段用例
    ├── PlaylistUseCase.ts             # 動作序列播放管理用例
    └── AudioSyncUseCase.ts            # 音訊同步用例
```

**規則**：
- ✅ 協調 Domain 和 Infrastructure 層
- ✅ 實現具體的業務用例
- ✅ 不包含 UI 邏輯

### Infrastructure Layer（基礎設施層）

```
infrastructure/
├── audio/
│   ├── WebAudioAdapter.ts             # Web Audio API 封裝
│   └── AudioGraphBuilder.ts           # 音訊效果圖形建立器
├── effect/
│   └── EffekseerRuntimeAdapter.ts     # Effekseer Runtime 封裝
└── spine/
    ├── SpineRuntimeAdapter.ts         # Spine Runtime 3.8 封裝（單例模式）
    └── SpineCanvasRenderer.ts         # Canvas 2D 骨架渲染器
```

**規則**：
- ✅ 封裝外部 API（Web Audio API、Spine Runtime）
- ✅ 可以替換實現（例如改用其他音訊庫）

### Presentation Layer（表現層）

```
presentation/
├── features/
│   ├── scene-viewer/                  # 3D 場景檢視器
│   │   └── components/
│   │       └── SceneViewer.tsx       # 主要 3D 渲染組件
│   ├── optimization-panel/            # 優化控制面板
│   │   └── components/
│   │       └── OptimizationControls.tsx
│   ├── shader-panel/                  # Shader 工具面板
│   │   └── components/
│   │       └── MaterialShaderTool.tsx
│   ├── model-inspector/               # 模型檢查器
│   │   └── components/
│   │       └── ModelInspector.tsx
│   ├── audio-panel/                   # 音訊面板
│   │   └── components/
│   │       └── AudioPanel.tsx
│   └── spine-panel/                   # Spine 面板
│       └── components/
│           ├── SpineInspectorPanel.tsx
│           ├── SpineFileUploader.tsx
│           ├── SpineAnimationTab.tsx
│           ├── SpineSkinTab.tsx
│           └── SpineSlotTab.tsx
├── hooks/
    ├── useTheme.ts                    # 主題管理
    ├── usePanelResize.ts              # 面板大小調整
    ├── useFileDrop.ts                 # 檔案拖放
    ├── useClickOutside.ts             # 點擊外部關閉
    └── useBoneExtraction.ts           # 骨骼提取
```

**規則**：
- ✅ 只包含 UI 和用戶交互邏輯
- ✅ 通過 Use Cases 調用業務邏輯
- ✅ 每個 Feature 模組獨立

### Utils（工具函數）

```
utils/
├── animation/
│   └── animationUtils.ts             # 動畫相關工具（關鍵幀計數）
├── array/
│   └── arrayUtils.ts                 # 陣列操作工具（不可變更新）
├── shader/
│   └── shaderGroupUtils.ts           # ShaderGroup 操作工具
├── texture/
│   └── textureLoaderUtils.ts         # 貼圖載入工具
└── optimizer.ts                      # 動畫優化器（向後兼容）
```

---

## 🔄 狀態管理

### App.tsx 主要狀態

```typescript
// 模型相關
model: THREE.Group | null
meshNames: string[]
file: File | null

// 動畫相關
originalClip: THREE.AnimationClip | null
masterClip: THREE.AnimationClip | null
optimizedClip: THREE.AnimationClip | null
createdClips: THREE.AnimationClip[]
tolerance: number

// 播放控制
isPlaying: boolean
currentTime: number
duration: number

// Shader 相關
shaderGroups: ShaderGroup[]

// 音訊相關
audioTracks: AudioTrack[]

// 動作序列播放
playlist: THREE.AnimationClip[]
isPlaylistPlaying: boolean
currentPlaylistIndex: number

// UI 狀態
themeMode: ThemeMode
showGrid: boolean
cameraSettings: { fov, near, far }
// ... 其他 UI 狀態
```

### 狀態更新模式

- **不可變更新**：使用 `updateArrayItemById`、`updateShaderGroupById` 等工具函數
- **Use Cases**：複雜業務邏輯透過 Use Cases 處理
- **Hooks**：UI 相關邏輯封裝在自訂 Hooks 中

---

## 🎨 UI 組件架構

### 主要組件

1. **SceneViewer**：3D 場景渲染
   - 使用 `@react-three/fiber` 渲染 Three.js 場景
   - 處理動畫播放、材質應用、相機控制
   - 透過 `forwardRef` 暴露播放控制 API

2. **OptimizationControls**：動畫優化控制
   - Tolerance 滑桿
   - 導出按鈕

3. **MaterialShaderTool**：Shader 效果工具
   - ShaderGroup 管理
   - Feature 添加/移除
   - 參數調整

4. **ModelInspector**：模型檢查器
   - 動畫片段列表
   - 動作序列播放管理
   - 片段創建/刪除

5. **AudioPanel**：音訊管理
   - 音訊軌道管理
   - 觸發器設定
   - 效果調整（EQ、濾波器、回音）

---

## 🔌 關鍵整合點

### Three.js 整合

- **模型載入**：FBXLoader + LoadingManager（貼圖 URL 修改）
- **動畫播放**：AnimationMixer + AnimationAction
- **Shader 應用**：自訂 ShaderMaterial（vertex + fragment shader）
- **場景管理**：透過 `@react-three/fiber` 的 Canvas 組件

### Web Audio API 整合

- **音訊載入**：fetch → decodeAudioData
- **效果處理**：BiquadFilter（EQ、濾波器）+ DelayNode（回音）
- **離線渲染**：OfflineAudioContext（用於導出）
- **MP3 編碼**：lamejs（全域載入）

---

## 📝 命名慣例

### 變數命名
- **camelCase**：變數、函數參數（例如：`currentTime`、`audioTracks`）
- **UPPER_CASE**：常數（例如：`SAMPLE_RATE`、`MP3_SAMPLE_BLOCK_SIZE`）
- **PascalCase**：類別、介面、類型（例如：`AnimationOptimizer`、`LoadModelResult`）

### 函數命名
- **動詞開頭**：`loadModel`、`exportAudio`、`createSubClip`
- **Use Cases**：`execute()` 靜態方法
- **Hooks**：`use` 前綴（例如：`useTheme`、`useFileDrop`）

### 檔案命名
- **組件**：PascalCase（例如：`SceneViewer.tsx`）
- **工具函數**：camelCase（例如：`arrayUtils.ts`）
- **Use Cases**：PascalCase + `UseCase` 後綴（例如：`LoadModelUseCase.ts`）
- **Services**：PascalCase + `Service` 後綴（例如：`ModelLoaderService.ts`）

---

## 🚫 架構限制

### 依賴規則

1. **Domain 層**：
   - ❌ 不能依賴 Application、Infrastructure、Presentation 層
   - ❌ 不能依賴 React、Three.js 等外部框架
   - ✅ 只能依賴 TypeScript 標準庫和 Three.js 類型定義

2. **Application 層**：
   - ✅ 可以依賴 Domain 層
   - ✅ 可以依賴 Infrastructure 層
   - ❌ 不能依賴 Presentation 層

3. **Infrastructure 層**：
   - ✅ 可以依賴 Domain 層（實現 Domain 定義的介面）
   - ❌ 不能依賴 Application、Presentation 層

4. **Presentation 層**：
   - ✅ 可以依賴 Application 層（透過 Use Cases）
   - ✅ 可以依賴 Domain 層（使用 Value Objects）
   - ❌ 不能直接依賴 Infrastructure 層（應透過 Use Cases）

### 狀態管理規則

- ✅ 使用 React `useState`、`useRef` 管理本地狀態
- ✅ 複雜業務邏輯封裝在 Use Cases 中
- ✅ UI 邏輯封裝在自訂 Hooks 中
- ✅ Director Mode 使用 Zustand 管理全域狀態（`directorStore`）
- ❌ 其他功能避免全域狀態管理庫

### 檔案組織規則

- ✅ 每個功能模組放在 `presentation/features/` 下
- ✅ 共用 Hooks 放在 `presentation/hooks/` 下
- ✅ 工具函數按類別組織在 `utils/` 下
- ❌ 避免在 `components/` 根目錄放置檔案（已廢棄，應使用 `presentation/features/`）

---

## 🔍 關鍵檔案說明

### 入口檔案

- **`main.tsx`**：React 應用入口，渲染 `App` 組件
- **`App.tsx`**：主應用組件，協調所有功能模組

### 核心業務邏輯

- **`AnimationOptimizer.ts`**：動畫優化核心演算法
- **`ModelLoaderService.ts`**：模型載入與貼圖處理
- **`MaterialFixService.ts`**：材質問題修復

### 關鍵 Use Cases

- **`LoadModelUseCase.ts`**：模型載入業務流程
- **`ExportModelUseCase.ts`**：模型導出業務流程
- **`AudioSyncUseCase.ts`**：音訊同步邏輯

### 重要組件

- **`SceneViewer.tsx`**：3D 場景渲染核心（約 800 行）
- **`MaterialShaderTool.tsx`**：Shader 效果管理
- **`AudioPanel.tsx`**：音訊軌道管理

---

## 🐛 已知問題與限制

1. **貼圖載入**：使用 URL 修改器攔截貼圖請求，依賴檔名匹配
2. **音訊觸發**：使用片段名稱而非 UUID 匹配（因為優化後 UUID 會改變）
3. **Shader 更新**：每次 features 改變時會重新建立 ShaderMaterial（確保 defines 正確更新）
4. **Shader 與貼圖管理**：當 Shader 被應用後，原始材質會存在 `userData.originalMaterial` 中，貼圖管理面板需從此處讀取貼圖

---

## ⚡ 效能優化技巧

### 1. 拖拉視窗優化（Modal Drag Optimization）

**問題**：使用 React `useState` 管理拖拉位置會導致每次 mousemove 都觸發重新渲染，造成卡頓

**解決方案**：使用 ref 直接操作 DOM，繞過 React 虛擬 DOM

```typescript
// ❌ 錯誤做法：每次移動都觸發重新渲染
const [position, setPosition] = useState({ x: 0, y: 0 });
const handleMouseMove = (e) => {
  setPosition({ x: e.clientX - startX, y: e.clientY - startY });
};

// ✅ 正確做法：使用 ref 直接操作 DOM
const dragStateRef = useRef({
  isDragging: false,
  currentX: 0,
  currentY: 0,
  rafId: 0
});

const handleMouseMove = (e: MouseEvent) => {
  if (!dragStateRef.current.isDragging) return;
  
  dragStateRef.current.currentX = e.clientX - startX;
  dragStateRef.current.currentY = e.clientY - startY;
  
  // 使用 requestAnimationFrame 節流
  if (dragStateRef.current.rafId) {
    cancelAnimationFrame(dragStateRef.current.rafId);
  }
  dragStateRef.current.rafId = requestAnimationFrame(() => {
    modalRef.current.style.transform = `translate(${dragStateRef.current.currentX}px, ${dragStateRef.current.currentY}px)`;
  });
};
```

**關鍵技術**：
- **useRef 存儲拖拉狀態**：避免觸發 React 重新渲染
- **requestAnimationFrame 節流**：限制 DOM 更新頻率至 60fps
- **直接操作 DOM style**：繞過 React 虛擬 DOM diff
- **will-change-transform**：提示瀏覽器啟用 GPU 加速

**應用場景**：
- Modal 拖拉
- 滑桿拖動
- 任何需要高頻率更新 UI 位置的場景

### 2. 進度條渲染優化

**解決方案**：使用 CSS Transform (`scaleX`) 更新進度，避免觸發 reflow

```typescript
// ✅ 使用 scaleX 而非 width
<div 
  style={{ transform: `scaleX(${progress / 100})` }}
  className="origin-left"
/>
```

### 3. 貼圖管理與 Shader 整合

**問題**：開啟 Shader 後替換貼圖，模型身上的貼圖不會更新

**解決方案**：替換貼圖時同時更新原始材質和 ShaderMaterial 的 uniform

```typescript
// 1. 更新原始材質
const originalMaterial = child.userData?.originalMaterial;
if (originalMaterial) {
  originalMaterial.map = newTexture;
  originalMaterial.needsUpdate = true;
}

// 2. 更新 ShaderMaterial 的 uniform
if (mat instanceof THREE.ShaderMaterial && mat.uniforms?.baseTexture) {
  mat.uniforms.baseTexture.value = newTexture;
  mat.needsUpdate = true;
}
```

---

## 📚 相關資源

- **Three.js 文檔**：https://threejs.org/docs/
- **React Three Fiber**：https://docs.pmnd.rs/react-three-fiber/
- **Web Audio API**：https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

## 🔄 最近重構記錄

### 第一階段：架構重構（2025年11月）

1. **架構重構**：從單一檔案結構重構為 DDD 分層架構
2. **命名重構**：將模糊變數名改為業務意義明確的名稱
3. **重複邏輯提取**：提取共用工具函數（arrayUtils、textureLoaderUtils、shaderGroupUtils）
4. **深層嵌套簡化**：使用 Guard Clauses 和 Early Return
5. **文檔完善**：為所有 Public Function 加上完整的 JSDoc 註釋

### 第二階段：動作與序列播放系統重構（2025年11月）

#### 問題識別

經過完整的系統分析，識別出以下關鍵問題：

1. **P0 - 相同名稱動作序列播放問題** 🔴
   - **根本原因**：`clip.clone()` 後名稱不變，導致 Audio Trigger 使用名稱匹配時重複觸發
   - **影響**：相同名稱片段無法區分，Audio 觸發混亂，進度顯示錯誤

2. **P1 - 進度條邏輯與色彩不統一** 🟡
   - **問題**：動作列表、序列播放、主時間軸三處進度條樣式、顏色、高度不一致
   - **影響**：使用者體驗不一致，維護困難

3. **P1 - 進度條不順暢、卡頓** 🟡
   - **原因**：狀態更新延遲、未使用 `useMemo` 快取、時間更新節流問題
   - **影響**：播放體驗差，視覺不流暢

4. **P2 - 邏輯待優化** 🔵
   - 片段名稱衝突無警告
   - 播放模式狀態管理複雜
   - Audio Trigger 匹配策略不夠精確
   - 效能可進一步優化

#### 解決方案與實現

1. **片段唯一識別系統**
   - 建立 `IdentifiableClip` 類型，擴展 `THREE.AnimationClip`
   - 新增 `customId`（唯一識別碼）和 `displayName`（顯示名稱）屬性
   - 實現 `clipIdentifierUtils.ts` 工具集：
     - `generateUniqueClipId()`: 生成唯一 ID
     - `generateUniqueDisplayName()`: 自動處理名稱衝突（添加序號）
     - `setClipIdentifier()`: 設定片段識別屬性
     - `copyClipIdentifier()`: 複製時保留識別資訊
     - `getClipId()` / `getClipDisplayName()`: 安全取得識別資訊
     - `isSameClip()`: 精確比對片段

2. **統一的進度條組件**
   - 建立 `ProgressBar.tsx` 組件，統一樣式和行為
   - 定義標準色彩語意：
     - `completed`: 綠色（已完成）
     - `playing`: 藍色（播放中）
     - `pending`: 深灰色（待播放）
     - `inactive`: 更深灰色（未啟動）
   - 統一尺寸選項：`sm` (h-1.5)、`md` (h-2)、`lg` (h-3)
   - 內建 Audio Markers 支援，使用 Tooltip 顯示詳細資訊
   - 使用 CSS Transform 優化渲染效能

3. **Audio Trigger 系統改進**
   - 更新 `AudioTrigger` 介面：
     - 將 `clipUuid` 改為 `clipId`（使用 `customId` 而非 UUID）
     - 保留 `clipName` 僅供顯示
   - 更新 `AudioSyncUseCase.handleTimeUpdate()`：
     - 使用 `getClipId()` 進行精確匹配
     - 解決相同名稱片段的觸發混亂問題
   - 更新 `AudioPanel` 組件：
     - Trigger 創建使用 `customId`
     - 顯示使用 `displayName`

4. **效能優化**
   - 在 `ModelInspector` 中使用 `useMemo` 快取 Audio Markers 計算
   - 在 `ProgressBar` 中使用 `useMemo` 快取 Marker 位置計算
   - 使用 CSS Transform (`scaleX`) 更新進度，避免觸發 reflow
   - 進度值範圍檢查（0-100）確保渲染正常

5. **自動命名衝突處理**
   - `AnimationClipService.createSubClip()` 接收現有名稱列表
   - `CreateClipUseCase.execute()` 傳遞現有片段
   - 自動生成唯一顯示名稱（例如：`Attack` → `Attack_1` → `Attack_2`）

6. **序列播放邏輯改善**
   - `PlaylistUseCase` 使用 `IdentifiableClip` 並在 clone 時保留原 `customId`，確保「動作」面板設定的音效在「動作序列播放」中也能觸發
   - 透過 React key 使用 `clipId + playlistIndex`，避免 UI 重新排序衝突
   - UI 顯示使用 `displayName`，內部匹配使用 `customId`

#### 受影響的檔案

**新增**：
- `src/utils/clip/clipIdentifierUtils.ts` - 片段識別工具集
- `src/presentation/components/ProgressBar.tsx` - 統一進度條組件

**重大更新**：
- `src/domain/value-objects/AudioTrigger.ts` - `clipUuid` → `clipId`
- `src/domain/services/AnimationClipService.ts` - 支援唯一命名
- `src/application/use-cases/CreateClipUseCase.ts` - 傳遞現有片段
- `src/application/use-cases/PlaylistUseCase.ts` - 使用 `IdentifiableClip`
- `src/application/use-cases/AudioSyncUseCase.ts` - 使用 `customId` 匹配
- `src/App.tsx` - 使用 `IdentifiableClip` 類型
- `src/presentation/features/audio-panel/components/AudioPanel.tsx` - 更新 Trigger 邏輯
- `src/presentation/features/model-inspector/components/ModelInspector.tsx` - 使用新進度條組件

#### 成果

✅ **解決相同名稱片段問題**：使用 `customId` 確保片段唯一識別  
✅ **統一進度條體驗**：三處進度條樣式、色彩、行為完全一致  
✅ **提升效能**：使用 `useMemo` 和 CSS Transform 優化渲染  
✅ **改善使用者體驗**：自動處理名稱衝突，減少困惑  
✅ **強化可維護性**：統一組件，減少重複程式碼

### 第三階段：Spine 整合與 Director Mode 修復（2025年11月）

#### 新增功能

1. **Spine 動畫系統整合**
   - Spine Runtime 3.8 本地整合（`vendor/spine-ts-3.8/`）
   - `SpineRuntimeAdapter`：單例模式封裝 Runtime API
   - `SpineCanvasRenderer`：Canvas 2D 渲染器
   - `SpineElement`：2D 圖層中的骨架動畫組件
   - `spineStore`：Zustand 狀態管理

2. **Spine 面板功能**
   - `SpineFileUploader`：支援 .skel + .atlas + 圖片上傳
   - `SpineAnimationTab`：動畫選擇與播放控制
   - `SpineSkinTab`：皮膚切換
   - `SpineSlotTab`：插槽 Attachment 控制

3. **Director Mode Spine 整合**
   - `useDirectorSpineTrigger`：根據時間軸控制 Spine 播放
   - Spine Clip 可拖放到時間軸
   - 支援 seek、pause、resume 操作

#### 問題修復

**Director Mode 下 Spine 動畫卡住問題**

- **問題描述**：在 Director 模式下播放 Spine 動畫，切換到非 2D 模組（3D、Audio 等）時，動畫會卡住
- **根本原因**：`SpineElement` 的動畫循環依賴 `onUpdate` 回調同步時間。當切換到非 2D 模組時，`onUpdateElement` 變為 `undefined`，導致 `element.currentTime` 無法同步，觸發錯誤的 seek 操作使動畫「倒退」
- **解決方案**：修改 `App.tsx` 中 `Layer2DRenderer` 的 `onUpdateElement` prop，在 Director 模式下始終保持可用
  ```typescript
  // 修改前
  onUpdateElement={isPointerEditing ? handleUpdateElementById : undefined}
  
  // 修改後
  onUpdateElement={(isPointerEditing || isDirectorMode) ? handleUpdateElementById : undefined}
  ```

#### 受影響的檔案

**新增**：
- `src/infrastructure/spine/SpineRuntimeAdapter.ts`
- `src/infrastructure/spine/SpineCanvasRenderer.ts`
- `src/presentation/features/layer-composer/components/SpineElement.tsx`
- `src/presentation/features/spine-panel/` 整個目錄
- `src/presentation/features/director/hooks/useDirectorSpineTrigger.ts`
- `src/presentation/stores/spineStore.ts`
- `src/domain/value-objects/SpineInstance.ts`
- `src/domain/value-objects/Element2D.ts`（新增 SpineElement2D 類型）

**修改**：
- `src/App.tsx`：整合 Spine 系統、修復 Director Mode 問題

---

**最後更新**：2025.12.12  
**維護者**：JR.H  
**專案狀態**：生產就緒 ✅

