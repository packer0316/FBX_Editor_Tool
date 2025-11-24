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

### 音訊處理
- **Web Audio API**：原生瀏覽器 API
- **MP3 編碼**：lamejs 1.2.1（透過全域載入）

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

### 5. 播放清單系統

**功能**：連續播放多個動畫片段

**邏輯**：
- 添加片段時會複製（clone），確保每個項目有唯一引用
- 移除片段時自動調整當前播放索引
- 重新排序時會停止播放（安全考量）
- 片段結束時自動播放下一個

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
    ├── PlaylistUseCase.ts             # 播放清單管理用例
    └── AudioSyncUseCase.ts            # 音訊同步用例
```

**規則**：
- ✅ 協調 Domain 和 Infrastructure 層
- ✅ 實現具體的業務用例
- ✅ 不包含 UI 邏輯

### Infrastructure Layer（基礎設施層）

```
infrastructure/
└── audio/
    ├── WebAudioAdapter.ts             # Web Audio API 封裝
    └── AudioGraphBuilder.ts           # 音訊效果圖形建立器
```

**規則**：
- ✅ 封裝外部 API（Web Audio API）
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
│   └── audio-panel/                   # 音訊面板
│       └── components/
│           └── AudioPanel.tsx
└── hooks/
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

// 播放清單
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
   - 播放清單管理
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
- ❌ 避免全域狀態管理庫（目前未使用 Redux、Zustand 等）

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

---

## 📚 相關資源

- **Three.js 文檔**：https://threejs.org/docs/
- **React Three Fiber**：https://docs.pmnd.rs/react-three-fiber/
- **Web Audio API**：https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

## 🔄 最近重構記錄

1. **架構重構**：從單一檔案結構重構為 DDD 分層架構
2. **命名重構**：將模糊變數名改為業務意義明確的名稱
3. **重複邏輯提取**：提取共用工具函數（arrayUtils、textureLoaderUtils、shaderGroupUtils）
4. **深層嵌套簡化**：使用 Guard Clauses 和 Early Return
5. **文檔完善**：為所有 Public Function 加上完整的 JSDoc 註釋

---

**最後更新**：2024年（重構後）  
**維護者**：開發團隊  
**專案狀態**：生產就緒 ✅

