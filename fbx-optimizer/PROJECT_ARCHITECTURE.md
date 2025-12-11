# 🏗️ JR 3D Viewer 專案架構文檔

> 本文檔提供專案的完整技術架構說明，幫助開發者快速理解系統設計。

---

## 📋 專案簡介

**專案名稱**：JR 3D Viewer / FBX Optimizer  
**專案類型**：Web-based 3D 模型檢視與優化工具  
**技術棧**：React 19 + TypeScript + Three.js + Vite

---

## 🎯 核心功能模組

### 1. 多模型管理系統
- 同時載入與管理多個 FBX 模型
- 每個模型獨立的動畫、Shader、音效、特效設定
- 模型位置、旋轉、縮放控制

### 2. 動畫系統
- 動畫播放控制（播放/暫停/跳轉/循環）
- 動畫優化（關鍵幀壓縮）
- 片段創建與管理
- 動作序列播放（Playlist）

### 3. Shader 系統
- Matcap 材質捕捉
- Rim Light 邊緣光
- Flash 閃光掃描
- Dissolve 溶解效果
- Alpha Test / Normal Map

### 4. 音效系統
- 音效載入與管理
- 動畫觸發器（根據幀數自動播放）
- EQ / 濾波器 / 回音效果
- MP3 導出

### 5. Effekseer 特效系統
- 粒子特效載入與播放
- 與 Three.js 場景整合
- 動畫時間同步
- 資源追蹤與管理（引用資源列表）
- 快取管理（全域快取清除）
- 打包匯出（ZIP 壓縮）

### 6. 2D 圖層合成系統
- 多圖層管理（前景/背景）
- 2D 元素：文字、圖片、形狀
- 圖層優先級與透明度控制

### 7. Director Mode（導演模式）
- 多模型動畫統一編排（類似影片剪輯軟體）
- 時間軸與多軌道管理
- 跨模型動畫同步播放
- 全域時間軸控制

### 8. Spine 動畫系統
- Spine Runtime 3.8 整合
- 2D 圖層中的骨架動畫渲染
- 動畫、皮膚、插槽控制
- Director Mode 時間軸同步

---

## 🏛️ 分層架構（DDD 啟發）

```
src/
├── domain/              # 領域層：純業務邏輯（零外部依賴）
│   ├── services/        # 業務服務
│   └── value-objects/   # 值物件（資料結構定義）
├── application/         # 應用層：Use Cases
│   └── use-cases/       # 業務用例
├── infrastructure/      # 基礎設施層：外部 API 封裝
│   ├── audio/           # Web Audio API
│   └── effect/          # Effekseer Runtime
├── presentation/        # 表現層：React UI
│   ├── features/        # 功能模組
│   ├── hooks/           # 共用 Hooks
│   └── components/      # 共用組件
├── utils/               # 工具函數
└── types/               # 類型定義
```

### 依賴規則
```
Presentation → Application → Domain ← Infrastructure
     ↓              ↓           ↑          ↓
   React        Use Cases   純邏輯    外部API封裝
```

---

## 📂 Domain Layer 詳解

### Value Objects（資料結構）

| 檔案 | 說明 |
|------|------|
| `ModelInstance.ts` | 模型實例（含動畫、Shader、音效等完整資料） |
| `ShaderFeature.ts` | Shader 功能與組合定義 |
| `AudioTrack.ts` | 音效軌道資料 |
| `AudioTrigger.ts` | 音效觸發器（動畫幀→音效） |
| `EffectTrigger.ts` | 特效觸發器 |
| `Layer.ts` | 2D 圖層定義 |
| `Element2D.ts` | 2D 元素（文字/圖片/形狀） |
| `CameraPreset.ts` | 相機預設參數 |
| `director.types.ts` | Director Mode 類型定義（Track、Clip、Timeline） |

### Services（業務邏輯）

| 檔案 | 說明 |
|------|------|
| `AnimationOptimizer.ts` | 動畫關鍵幀優化演算法 |
| `AnimationClipService.ts` | 動畫片段操作（創建子片段） |
| `LayerService.ts` | 2D 圖層業務邏輯 |
| `ModelLoaderService.ts` | FBX 載入與貼圖處理 |
| `MaterialFixService.ts` | 材質修復（解決全黑問題） |

---

## 📂 Application Layer 詳解

### Use Cases 分類

#### 模型相關
| Use Case | 說明 |
|----------|------|
| `LoadModelUseCase` | 載入 FBX 模型 |
| `ExportModelUseCase` | 導出 GLB 模型 |

#### 動畫相關
| Use Case | 說明 |
|----------|------|
| `CreateClipUseCase` | 創建動畫片段 |
| `PlaylistUseCase` | 動作序列播放管理 |

#### 音效/特效同步
| Use Case | 說明 |
|----------|------|
| `AudioSyncUseCase` | 音效觸發同步 |
| `EffectSyncUseCase` | 特效觸發同步 |

#### Effekseer 相關
| Use Case | 說明 |
|----------|------|
| `InitEffekseerRuntimeUseCase` | 初始化 Effekseer |
| `LoadEffectUseCase` | 載入特效檔 |
| `PlayEffectUseCase` | 播放特效 |
| `StopAllEffectsUseCase` | 停止所有特效 |

#### 2D 圖層相關
| Use Case | 說明 |
|----------|------|
| `InitializeLayerStackUseCase` | 初始化圖層堆疊 |
| `CreateLayerUseCase` | 創建圖層 |
| `UpdateLayerUseCase` | 更新圖層 |
| `DeleteLayerUseCase` | 刪除圖層 |
| `ReorderLayersUseCase` | 重新排序圖層 |
| `AddElement2DUseCase` | 添加 2D 元素 |
| `UpdateElement2DUseCase` | 更新 2D 元素 |
| `RemoveElement2DUseCase` | 移除 2D 元素 |

---

## 📂 Infrastructure Layer 詳解

### Audio 模組
| 檔案 | 說明 |
|------|------|
| `WebAudioAdapter.ts` | Web Audio API 封裝 + AudioController |
| `AudioGraphBuilder.ts` | 音效處理圖形建立（EQ/濾波/回音） |

### Effect 模組
| 檔案 | 說明 |
|------|------|
| `EffekseerRuntimeAdapter.ts` | Effekseer WebGL Runtime 封裝 |

### Spine 模組
| 檔案 | 說明 |
|------|------|
| `SpineRuntimeAdapter.ts` | Spine Runtime 3.8 封裝（單例模式） |
| `SpineCanvasRenderer.ts` | Canvas 2D 骨架渲染器 |

---

## 📂 Presentation Layer 詳解

### Features（功能模組）

| 模組 | 主要組件 | 說明 |
|------|----------|------|
| `scene-viewer` | `SceneViewer.tsx` | 3D 場景渲染核心 |
| | `LeftToolbar.tsx` | 左側工具列 |
| | `SceneToolbar.tsx` | 頂部工具列 |
| | `KeyboardCameraControls.tsx` | WASD 鍵盤相機控制 |
| `model-manager` | `ModelManagerPanel.tsx` | 多模型管理面板 |
| `model-inspector` | `ModelInspector.tsx` | 動畫片段管理 |
| `shader-panel` | `MaterialShaderTool.tsx` | Shader 效果工具 |
| `audio-panel` | `AudioPanel.tsx` | 音效管理面板 |
| `effect-panel` | `EffectTestPanel.tsx` | 特效測試面板 |
| `layer-composer` | `LayerManagerPanel.tsx` | 2D 圖層管理 |
| | `Layer2DRenderer.tsx` | 2D 圖層渲染器 |
| | `Element2DEditorPanel.tsx` | 2D 元素編輯器 |
| | `SpineElement.tsx` | Spine 骨架動畫元素 |
| `spine-panel` | `SpineInspectorPanel.tsx` | Spine 檢查器面板 |
| | `SpineFileUploader.tsx` | Spine 檔案上傳 |
| | `SpineAnimationTab.tsx` | 動畫控制分頁 |
| | `SpineSkinTab.tsx` | 皮膚切換分頁 |
| | `SpineSlotTab.tsx` | 插槽控制分頁 |
| `optimization-panel` | `OptimizationControls.tsx` | 動畫優化控制 |
| `director` | `DirectorPanel.tsx` | Director Mode 主面板 |
| | `ActionSourcePanel.tsx` | 動作來源面板 |
| | `TimelineEditor.tsx` | 時間軸編輯器 |
| | `TrackRow.tsx` | 軌道行 |
| | `ClipBlock.tsx` | 片段方塊 |

### Hooks（共用邏輯）

| Hook | 說明 |
|------|------|
| `useTheme` | 主題管理（dark/light） |
| `usePanelResize` | 面板大小拖曳調整 |
| `useFileDrop` | 檔案拖放處理 |
| `useClickOutside` | 點擊外部關閉 |
| `useBoneExtraction` | 骨骼提取 |
| `useModelsManager` | 多模型狀態管理 |
| `useKeyboardCameraControls` | 鍵盤相機控制 |
| `useTimelinePlayback` | Director Mode 時間軸播放控制 |
| `useDragAndDrop` | Director Mode 拖放邏輯 |
| `useKeyboardShortcuts` | Director Mode 快捷鍵 |
| `useDirectorSpineTrigger` | Director Mode Spine 動畫觸發 |

### Stores（狀態管理）

| Store | 說明 |
|------|------|
| `directorStore` | Director Mode 全域狀態（Zustand） |
| `spineStore` | Spine 實例管理（Zustand） |

---

## 📂 Utils 詳解

| 目錄/檔案 | 說明 |
|-----------|------|
| `animation/animationUtils.ts` | 動畫工具（關鍵幀計數） |
| `array/arrayUtils.ts` | 陣列不可變更新工具 |
| `clip/clipIdentifierUtils.ts` | 動畫片段唯一識別工具 |
| `shader/shaderGroupUtils.ts` | ShaderGroup 操作工具 |
| `texture/textureLoaderUtils.ts` | 貼圖載入工具 |
| `layer/layerUtils.ts` | 圖層排序工具 |
| `ini/iniParser.ts` | INI 檔案解析 |
| `optimizer.ts` | 動畫優化入口 |
| `AudioController.ts` | 音效控制器（已整合至 WebAudioAdapter） |

---

## 🔄 核心資料流

### 模型載入流程
```
用戶拖放檔案 → App.tsx handleFileUpload()
    → LoadModelUseCase.execute()
    → ModelLoaderService.loadFBX()
    → MaterialFixService.fixMaterials()
    → 返回 { model, meshNames, animations }
    → App.tsx 更新狀態
    → SceneViewer 渲染
```

### 音效觸發流程
```
SceneViewer 播放動畫 → onTimeUpdate(time)
    → App.tsx handleTimeUpdate()
    → AudioSyncUseCase.handleTimeUpdate()
    → 檢查 Trigger 是否應觸發
    → WebAudioAdapter.play()
```

### Shader 應用流程
```
MaterialShaderTool 選擇效果
    → 更新 shaderGroups 狀態
    → SceneViewer useEffect 監聽
    → 載入貼圖、建立 ShaderMaterial
    → 應用到對應 Mesh
```

---

## 🎨 狀態管理

### App.tsx 主要狀態分類

```typescript
// 多模型管理
const { models, activeModel, addModel, removeModel } = useModelsManager();

// 動畫控制
const [currentTime, setCurrentTime] = useState(0);
const [isPlaying, setIsPlaying] = useState(true);
const [createdClips, setCreatedClips] = useState<IdentifiableClip[]>([]);

// Shader 系統
const [shaderGroups, setShaderGroups] = useState<ShaderGroup[]>([]);

// 音效系統
const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);

// 特效系統
const [effects, setEffects] = useState<EffectItem[]>([]);

// 2D 圖層
const [layers, setLayers] = useState<Layer[]>([]);
```

---

## 🔧 關鍵技術點

### 1. 片段唯一識別（IdentifiableClip）
```typescript
interface IdentifiableClip extends THREE.AnimationClip {
  customId: string;      // 唯一 ID（不隨 clone 改變）
  displayName: string;   // 顯示名稱
}
```
解決相同名稱動畫片段的音效觸發混亂問題。

### 2. 圖層優先級系統
```typescript
interface Layer {
  priority: number;  // >0: 3D 前方, =0: 3D 層, <0: 3D 後方
}
```

### 3. Effekseer 整合
- 使用 Three.js 的 WebGL Context
- 在 `scene.onAfterRender` 中繪製特效
- 每幀同步相機矩陣

### 4. Spine 整合架構

```
Spine 檔案載入
    ↓
SpineFileUploader → SpineRuntimeAdapter.load()
    ↓
SpineInstance 存入 spineStore (Zustand)
    ↓
SpineElement2D 添加到 Layer
    ↓
Layer2DRenderer → SpineElement 組件
    ↓
SpineCanvasRenderer 渲染到 Canvas
```

**Director Mode 整合**：
- `useDirectorSpineTrigger` 根據時間軸控制 Spine 播放
- 調用 `adapter.resume()`、`adapter.pause()`、`adapter.seek()`
- `SpineElement` 的動畫循環調用 `adapter.update()` 推進動畫

**重要注意事項**：
- Spine 動畫更新依賴 `SpineElement` 的 `requestAnimationFrame` 循環
- 在 Director 模式下，需確保 `onUpdateElement` 可用以同步時間
- 切換右側面板時需保持 Spine 元素的更新回調可用

---

## 📁 檔案快速索引

### 入口點
- `main.tsx` - React 應用入口
- `App.tsx` - 主應用組件（約 1366 行）

### 核心渲染
- `SceneViewer.tsx` - 3D 場景渲染

### 主要面板
- `MaterialShaderTool.tsx` - Shader 工具
- `ModelInspector.tsx` - 動畫管理
- `AudioPanel.tsx` - 音效管理
- `LayerManagerPanel.tsx` - 圖層管理

---

## 🚀 開發指南

### 新增 Use Case
1. 在 `application/use-cases/` 創建 `XxxUseCase.ts`
2. 實現靜態 `execute()` 方法
3. 在 `App.tsx` 中調用

### 新增 Value Object
1. 在 `domain/value-objects/` 創建 `Xxx.ts`
2. 定義 TypeScript interface
3. 必要時添加類型守衛函數

### 新增 UI 功能
1. 在 `presentation/features/` 創建新資料夾
2. 在 `components/` 放置 React 組件
3. 在 `hooks/` 放置相關邏輯（如需要）

---

## 📖 相關文檔

- **Effekseer 整合架構**：`archi_docs/EFFEKSEER_INTEGRATION_ARCHITECTURE.md`
- **Spine 整合架構**：`archi_docs/SPINE_INTEGRATION_ARCHITECTURE.md`
- **Director Mode 設計**：`archi_docs/DIRECTOR_MODE_DESIGN.md`

---

**最後更新**：2025.12.12  
**維護者**：JR.H

