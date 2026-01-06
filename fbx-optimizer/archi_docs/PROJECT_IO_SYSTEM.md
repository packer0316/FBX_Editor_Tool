# 專案匯出/載入系統設計

> **文件維護者**: JR.H  
> **建立日期**: 2025.01  
> **最後更新**: 2025.01.06  
> **狀態**: 已實作（含 Shader 整合）

---

## 目錄

1. [核心設計理念](#核心設計理念)
2. [UI 設計](#ui-設計)
3. [專案檔案格式設計](#專案檔案格式設計)
4. [資料結構設計](#資料結構設計)
5. [匯出流程](#匯出流程詳細)
6. [載入流程](#載入流程詳細)
7. [ID 映射表說明](#id-映射表說明)
8. [關鍵檔案位置](#關鍵檔案位置)
9. [已實作功能](#已實作功能)

---

## 核心設計理念

由於 `THREE.Group`（模型）和 `THREE.AnimationClip`（動畫片段）無法直接 JSON 序列化，系統需要：

1. 保存可序列化的「狀態資料」
2. 保存「原始素材檔案」（FBX、貼圖）
3. 載入時：先載入素材 → 再還原狀態

**已實作功能**：

- ✅ 3D 模型（必選）
- ✅ 動作切割 & 導演模式編排（可選）
- ✅ Shader 配置（可選）
- ✅ 程式動作（Procedural Animation）

**預留擴充接口**（UI 顯示反灰）：

- ⏳ Audio
- ⏳ Effekseer (EFK)

---

## UI 設計

### 入口：取代旋轉工具按鈕

修改 `LeftToolbar.tsx`，將「旋轉工具（未實作）」按鈕替換為「專案匯出匯入」按鈕。

**圖標**：使用 `Package` 圖標

### 彈出視窗：ProjectIOPanel

```
┌─────────────────────────────────────┐
│  專案匯出 / 載入                     │  ← 標題
├─────────────────────────────────────┤
│                                     │
│  ── 匯出選項 ──                      │
│                                     │
│  ☑ 3D 模型 (必選)                   │  ← 固定勾選，disabled
│  ☑ 動作 & 導演模式編排               │  ← 可勾選
│  ☑ Shader 配置                      │  ← 可勾選（已實作）
│                                     │
│  ── 未實作功能 ──                    │
│                                     │
│  ☐ Audio (未實作)                   │  ← 反灰，disabled
│  ☐ Effekseer (未實作)               │  ← 反灰，disabled
│                                     │
├─────────────────────────────────────┤
│  [ 匯出專案 ]    [ 載入專案 ]         │  ← 按鈕
└─────────────────────────────────────┘
```

### 匯出選項介面類型

```typescript
interface ExportOptions {
  include3DModels: true;           // 必選，永遠 true
  includeAnimations: boolean;      // 動作切割 & 導演模式
  includeShader: boolean;          // Shader 配置（已實作）
  includeAudio: false;             // 預留，暫時 false
  includeEffekseer: false;         // 預留，暫時 false
}
```

---

## 專案檔案格式設計

使用 **`.jr3d`** 副檔名（實際為 ZIP 格式），內部結構：

```
project.jr3d (ZIP 格式)
├── manifest.json          # 專案描述檔
├── project-state.json     # 完整狀態資料
├── models/                # 模型素材
│   ├── model_001/
│   │   ├── model.fbx
│   │   ├── texture1.jpg
│   │   ├── texture2.png
│   │   └── shader/        # Shader 專用資料夾
│   │       └── textures/  # Shader 貼圖（matcap、normal map 等）
│   │           ├── matcap_0_0_1.png
│   │           └── texture_0_1_1.png
│   └── model_002/
│       └── ...
└── audio/                 # 預留：音效素材（暫不使用）
    └── ...
```

---

## 資料結構設計

### 1. 專案狀態（可序列化）

```typescript
interface ProjectState {
  version: string;              // 專案格式版本 "1.0.0"
  name: string;                 // 專案名稱
  createdAt: string;            // ISO 時間戳
  updatedAt: string;

  // 匯出選項記錄
  exportOptions: ExportOptions;

  // 多模型狀態
  models: SerializableModelState[];

  // 導演模式狀態（可選）
  director?: SerializableDirectorState;

  // 全域設定（相機等）
  globalSettings: GlobalSettings;

  // 預留擴充欄位
  shader?: unknown;             // 未使用（shader 資料存在 models 中）
  audio?: unknown;              // 未實作
  effekseer?: unknown;          // 未實作
  spine?: unknown;              // 未實作
}
```

### 2. 可序列化模型狀態

```typescript
interface SerializableModelState {
  id: string;
  name: string;

  // 素材路徑（相對於 ZIP 內部）
  modelPath: string;           // "model.fbx"
  texturePaths: string[];      // ["texture1.jpg", "texture2.png"]

  // 切割動作記憶（當 includeAnimations = true）
  createdClips?: SerializableClipInfo[];

  // Transform 設定
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  renderPriority: number;
  visible: boolean;
  opacity: number;
  isLoopEnabled: boolean;

  // Shader 設定（當 includeShader = true）
  shaderGroups?: SerializableShaderGroup[];
  isShaderEnabled?: boolean;
}
```

### 3. 可序列化 Shader 設定

```typescript
interface SerializableShaderFeature {
  type: string;              // 功能類型（如 'matcap', 'rim_light'）
  name: string;              // 功能名稱
  description: string;       // 功能描述
  icon: string;              // 圖示
  enabled: boolean;          // 是否啟用
  params: Record<string, any>; // 參數（貼圖會轉為相對路徑）
}

interface SerializableShaderGroup {
  id: string;                // 組合唯一識別碼
  name: string;              // 組合名稱
  selectedMeshes: string[];  // 套用到的 Mesh 名稱列表
  features: SerializableShaderFeature[];
  enabled: boolean;          // 是否啟用
}
```

### 4. 可序列化動作片段

```typescript
interface SerializableClipInfo {
  customId: string;           // 唯一識別碼
  displayName: string;        // 顯示名稱
  originalName: string;       // 原始動畫名稱
  startFrame: number;         // 起始幀
  endFrame: number;           // 結束幀
  duration: number;           // 時長（秒）
  fps: number;                // 幀率
}
```

### 5. 可序列化導演狀態

```typescript
interface SerializableDirectorState {
  timeline: {
    totalFrames: number;
    fps: number;
    loopRegion: LoopRegion;
  };
  tracks: SerializableTrack[];
}

interface SerializableDirectorClip {
  id: string;
  trackId: string;
  sourceType: AnimationSourceType;  // '3d-model' | 'spine' | 'procedural'
  sourceModelId: string;
  sourceModelName: string;
  sourceAnimationId: string;
  sourceAnimationName: string;
  sourceAnimationDuration: number;
  startFrame: number;
  endFrame: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  loop: boolean;
  blendIn: number;
  blendOut: number;
  color: string;
  
  // 程式動作專用
  proceduralType?: ProceduralAnimationType;
  proceduralConfig?: ProceduralAnimationConfig;
  
  // Spine 專用
  spineInstanceId?: string;
  spineLayerId?: string;
  spineElementId?: string;
  spineSkin?: string;
}
```

---

## 匯出流程（詳細）

### Step 1：收集模型資料

```typescript
// 對每個 ModelInstance 收集：
{
  id: model.id,
  name: model.name,
  file: model.file,                    // FBX File 物件
  textureFiles: model.textureFiles,    // 貼圖 File 物件陣列
  position: model.position,
  rotation: model.rotation,
  scale: model.scale,
  opacity: model.opacity,
  visible: model.visible,
  renderPriority: model.renderPriority,
  isLoopEnabled: model.isLoopEnabled,
}
```

### Step 2：序列化 Shader 配置

```typescript
// 遍歷 model.shaderGroups，將 File 物件轉為相對路徑
function serializeShaderFeature(feature, groupIndex, featureIndex, textureInfos) {
  const params = {};
  for (const [key, value] of Object.entries(feature.params)) {
    if (value instanceof File) {
      // 轉為相對路徑
      const relativePath = `shader/textures/${key}_${groupIndex}_${featureIndex}_1.png`;
      textureInfos.push({ file: value, relativePath });
      params[key] = relativePath;
    } else {
      params[key] = value;
    }
  }
  return { ...feature, params };
}
```

### Step 3：序列化導演模式（含程式動作）

```typescript
// 導演模式狀態
clips: track.clips.map(clip => ({
  // ...基本欄位...
  sourceType: clip.sourceType,
  
  // 程式動作專用欄位
  proceduralType: clip.proceduralType,
  proceduralConfig: clip.proceduralConfig,
  
  // Spine 專用欄位
  spineInstanceId: clip.spineInstanceId,
  spineLayerId: clip.spineLayerId,
  spineElementId: clip.spineElementId,
}))
```

### Step 4：打包 ZIP

```typescript
const zip = new JSZip();

// 1. manifest.json
zip.file('manifest.json', JSON.stringify(manifest));

// 2. project-state.json
zip.file('project-state.json', JSON.stringify(projectState));

// 3. 模型檔案
for (const model of models) {
  const folder = zip.folder(`models/${model.id}`);
  folder.file(model.file.name, model.file);
  
  // 模型貼圖
  for (const tex of model.textureFiles) {
    folder.file(tex.name, tex);
  }
  
  // Shader 貼圖
  for (const shaderTex of shaderTextureInfos) {
    folder.file(shaderTex.relativePath, shaderTex.file);
  }
}

// 4. 下載
const blob = await zip.generateAsync({ type: 'blob' });
```

---

## 載入流程（詳細）

### Step 1：解壓縮 & 驗證

```typescript
const zip = await JSZip.loadAsync(file);
const manifest = JSON.parse(await zip.file('manifest.json').async('string'));

if (!isVersionCompatible(manifest.version)) {
  throw new Error('專案版本不相容');
}

const projectState = JSON.parse(await zip.file('project-state.json').async('string'));
```

### Step 2：還原模型

使用 `LoadModelUseCase.executeAndCreateInstance` 載入 FBX + 貼圖

### Step 3：還原 Transform 設定

```typescript
updateModel(newModelId, {
  position, rotation, scale, opacity, visible, renderPriority, isLoopEnabled
});
```

### Step 4：還原 Shader 配置

```typescript
// 遍歷 savedModel.shaderGroups
// 將相對路徑的貼圖從 ZIP 中讀取並轉為 File 物件
for (const [key, value] of Object.entries(feature.params)) {
  if (typeof value === 'string' && value.startsWith('shader/textures/')) {
    const texturePath = `models/${savedModel.id}/${value}`;
    const blob = await zip.file(texturePath).async('blob');
    params[key] = new File([blob], fileName, { type: mimeType });
  }
}

// 更新模型
updateModel(newModelId, { shaderGroups, isShaderEnabled });
```

### Step 5：還原切割動作

使用 `AnimationClipService.createSubClip` 重建動作

### Step 6：還原導演模式（含程式動作）

```typescript
// 還原片段時傳遞程式動作參數
callbacks.addClip({
  ...基本欄位,
  proceduralType: savedClip.proceduralType,
  spineInstanceId: savedClip.spineInstanceId,
  // ...
});

// 還原程式動作設定
callbacks.updateClip(addedClip.id, {
  ...基本設定,
  proceduralConfig: savedClip.proceduralConfig,
});
```

---

## ID 映射表說明

由於載入時會重新生成 ID，需要維護映射關係：

```
┌─────────────────────────────────────────────────────────────┐
│                    ID 映射流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  匯出時保存：                                                │
│    Model.id = "model_123"                                   │
│    CreatedClip.customId = "clip_456"                        │
│    DirectorClip.sourceModelId = "model_123"                 │
│    DirectorClip.sourceAnimationId = "clip_456"              │
│                                                             │
│  載入時映射：                                                │
│    modelIdMap: "model_123" → "model_789" (新生成)           │
│    clipIdMap: "clip_456" → "clip_012" (新生成)              │
│                                                             │
│  還原 Director 時：                                          │
│    sourceModelId = modelIdMap.get("model_123") → "model_789"│
│    sourceAnimationId = clipIdMap.get("clip_456") → "clip_012"│
│                                                             │
│  ⚠️ 程式動作不需要 clipIdMap（使用原始 ID）                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 關鍵檔案位置

| 檔案 | 說明 |
|------|------|
| `src/domain/value-objects/ProjectState.ts` | 類型定義（SerializableShaderGroup 等） |
| `src/application/use-cases/ExportProjectUseCase.ts` | 匯出邏輯（含 Shader 序列化） |
| `src/application/use-cases/LoadProjectUseCase.ts` | 載入邏輯（含 Shader/程式動作還原） |
| `src/presentation/features/project-io/ProjectIOPanel.tsx` | 匯出匯入視窗 |
| `src/presentation/stores/directorStore.ts` | Director Mode 狀態（updateClip 含 proceduralConfig） |

---

## 已實作功能

| 功能 | 狀態 | 相關欄位 |
|------|------|----------|
| 3D 模型 | ✅ 已實作 | `models`, `texturePaths` |
| Transform 設定 | ✅ 已實作 | `position`, `rotation`, `scale`, `opacity` |
| 切割動作 | ✅ 已實作 | `createdClips` |
| 導演模式 | ✅ 已實作 | `director`, `tracks`, `clips` |
| 程式動作 | ✅ 已實作 | `proceduralType`, `proceduralConfig` |
| Shader 配置 | ✅ 已實作 | `shaderGroups`, `isShaderEnabled` |
| Shader 貼圖 | ✅ 已實作 | `shader/textures/` 資料夾 |
| Audio | ⏳ 預留 | `audio` |
| Effekseer | ⏳ 預留 | `effekseer` |
| Spine | ⏳ 預留 | `spine` |

---

## 依賴

```bash
npm install jszip
npm install @types/jszip --save-dev
```

