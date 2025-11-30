# Spine 動畫整合架構設計

## 📋 專案概述

在 JR 3D Viewer / FBX Optimizer 專案中整合 **Spine 3.8.99** 動畫支援，包含：
- `.skel`（二進制骨架）+ `.atlas`（圖集）檔案讀取
- 2D Layer 內的 Spine 元素渲染
- Spine 專用編輯面板
- Director Mode 時間軸整合

---

## 🏗️ 架構設計

### 分層架構（遵循 DDD 原則）

```
src/
├── domain/
│   ├── value-objects/
│   │   ├── Element2D.ts          # 擴充 SpineElement2D 類型
│   │   └── SpineInstance.ts      # [NEW] Spine 實例值物件
│   └── entities/
│       └── director/
│           └── director.types.ts  # 擴充支援 Spine 動畫來源
│
├── application/use-cases/
│   ├── LoadSpineUseCase.ts       # [NEW] 載入 Spine 骨架
│   └── SpineAnimationUseCase.ts  # [NEW] Spine 動畫控制
│
├── infrastructure/
│   └── spine/
│       ├── SpineRuntimeAdapter.ts    # [NEW] Spine Runtime 封裝
│       └── SpineCanvasRenderer.ts    # [NEW] Canvas 渲染器
│
├── presentation/
│   ├── features/
│   │   ├── spine-panel/              # [NEW] Spine 編輯面板
│   │   │   └── components/
│   │   │       ├── SpineInspectorPanel.tsx
│   │   │       ├── SpineAnimationTab.tsx
│   │   │       ├── SpineSkinTab.tsx
│   │   │       ├── SpineSlotTab.tsx          # ✅ 已實作
│   │   │       └── SpineTransformTab.tsx     # ✅ 已實作（額外新增）
│   │   ├── layer-composer/
│   │   │   └── components/
│   │   │       ├── Layer2DRenderer.tsx   # 修改：支援 Spine 渲染
│   │   │       └── SpineElement.tsx      # [NEW] Spine 元素組件
│   │   └── director/
│   │       └── components/
│   │           └── ActionSourcePanel.tsx  # 修改：新增 Spine 動畫來源
│   └── hooks/
│       └── useSpineInstance.ts       # [NEW] Spine 實例管理 Hook
│
└── types/
    └── spine.d.ts                    # [NEW] Spine Runtime 類型定義
```

---

## 🎯 核心類型定義

### 1. SpineElement2D（2D 元素）

```typescript
// src/domain/value-objects/Element2D.ts

export type Element2DType = 'image' | 'text' | 'shape' | 'html' | 'spine';

/**
 * Spine 元素
 */
export interface SpineElement2D extends Element2DBase {
  type: 'spine';
  
  /** Spine 實例 ID（對應 SpineInstance） */
  spineInstanceId: string;
  
  /** 當前播放的動畫名稱 */
  currentAnimation: string | null;
  
  /** 動畫是否循環 */
  loop: boolean;
  
  /** 播放速度（1.0 = 正常） */
  timeScale: number;
  
  /** 當前 Skin 名稱 */
  currentSkin: string | null;
  
  /** 是否自動播放 */
  autoPlay: boolean;
  
  /** 翻轉 X 軸 */
  flipX: boolean;
  
  /** 翻轉 Y 軸 */
  flipY: boolean;
}

// 類型守衛
export const isSpineElement = (element: Element2D): element is SpineElement2D => 
  element.type === 'spine';
```

### 2. SpineInstance（Spine 實例值物件）

```typescript
// src/domain/value-objects/SpineInstance.ts

/**
 * Spine 動畫資訊
 */
export interface SpineAnimationInfo {
  /** 動畫名稱 */
  name: string;
  /** 動畫時長（秒） */
  duration: number;
  /** 動畫幀數（duration * fps） */
  frameCount: number;
}

/**
 * Spine Skin 資訊
 */
export interface SpineSkinInfo {
  /** Skin 名稱 */
  name: string;
}

/**
 * Spine Slot 資訊
 */
export interface SpineSlotInfo {
  /** Slot 名稱 */
  name: string;
  /** 目前附加的 Attachment 名稱 */
  attachment: string | null;
  /** 可用的 Attachment 列表 */
  attachments: string[];
}

/**
 * Spine 骨架資訊
 */
export interface SpineSkeletonInfo {
  /** 原始寬度 */
  width: number;
  /** 原始高度 */
  height: number;
  /** 版本號 */
  version: string;
  /** 動畫列表 */
  animations: SpineAnimationInfo[];
  /** Skin 列表 */
  skins: SpineSkinInfo[];
  /** Slot 列表 */
  slots: SpineSlotInfo[];
}

/**
 * Spine 實例
 */
export interface SpineInstance {
  /** 唯一 ID */
  id: string;
  
  /** 顯示名稱 */
  name: string;
  
  /** 原始檔案（.skel） */
  skelFile: File;
  
  /** Atlas 檔案 */
  atlasFile: File;
  
  /** 圖片檔案列表 */
  imageFiles: File[];
  
  /** 骨架資訊 */
  skeletonInfo: SpineSkeletonInfo;
  
  /** 當前播放狀態 */
  isPlaying: boolean;
  
  /** 當前時間（秒） */
  currentTime: number;
  
  /** 建立時間 */
  createdAt: number;
}
```

### 3. Director Mode 擴充

```typescript
// src/domain/entities/director/director.types.ts

/**
 * 動畫來源類型
 */
export type AnimationSourceType = '3d-model' | 'spine';

/**
 * 擴充 DraggingClipData 以支援 Spine
 */
export interface DraggingClipData {
  type: 'new' | 'existing';
  
  /** 來源類型：3D 模型或 Spine */
  sourceType: AnimationSourceType;
  
  // 3D 模型來源（sourceType === '3d-model'）
  sourceModelId?: string;
  sourceModelName?: string;
  
  // Spine 來源（sourceType === 'spine'）
  spineInstanceId?: string;
  spineInstanceName?: string;
  
  sourceAnimationId: string;
  sourceAnimationName: string;
  durationFrames: number;
  color?: string;
}

/**
 * 擴充 DirectorClip 以支援 Spine
 */
export interface DirectorClip {
  // ... 現有屬性 ...
  
  /** 來源類型 */
  sourceType: AnimationSourceType;
  
  /** Spine 實例 ID（sourceType === 'spine' 時使用） */
  spineInstanceId?: string;
}
```

---

## 🔧 Infrastructure 層

### SpineRuntimeAdapter（Spine Runtime 封裝）

```typescript
// src/infrastructure/spine/SpineRuntimeAdapter.ts

import * as spine from '@esotericsoftware/spine-webgl';

/**
 * Spine Runtime 適配器
 * 
 * 職責：
 * - 載入 .skel 和 .atlas 檔案
 * - 管理 Spine 實例生命週期
 * - 提供動畫控制 API
 */
export class SpineRuntimeAdapter {
  private static instance: SpineRuntimeAdapter | null = null;
  private skeletons: Map<string, spine.Skeleton> = new Map();
  private states: Map<string, spine.AnimationState> = new Map();
  private atlases: Map<string, spine.TextureAtlas> = new Map();
  
  static getInstance(): SpineRuntimeAdapter {
    if (!this.instance) {
      this.instance = new SpineRuntimeAdapter();
    }
    return this.instance;
  }
  
  /**
   * 載入 Spine 骨架
   */
  async load(params: {
    id: string;
    skelFile: File;
    atlasFile: File;
    imageFiles: File[];
  }): Promise<SpineSkeletonInfo> {
    // 1. 讀取 .atlas 檔案
    // 2. 建立 TextureAtlas（使用 imageFiles）
    // 3. 讀取 .skel 二進制檔案
    // 4. 建立 Skeleton 和 AnimationState
    // 5. 提取骨架資訊
    // 6. 儲存到 Map 中
  }
  
  /**
   * 播放動畫
   */
  playAnimation(id: string, animationName: string, loop: boolean): void {
    const state = this.states.get(id);
    if (state) {
      state.setAnimation(0, animationName, loop);
    }
  }
  
  /**
   * 設定 Skin
   */
  setSkin(id: string, skinName: string): void {
    const skeleton = this.skeletons.get(id);
    if (skeleton) {
      skeleton.setSkinByName(skinName);
      skeleton.setSlotsToSetupPose();
    }
  }
  
  /**
   * 更新動畫
   */
  update(id: string, deltaTime: number): void {
    const skeleton = this.skeletons.get(id);
    const state = this.states.get(id);
    if (skeleton && state) {
      state.update(deltaTime);
      state.apply(skeleton);
      skeleton.updateWorldTransform();
    }
  }
  
  /**
   * 取得骨架（用於渲染）
   */
  getSkeleton(id: string): spine.Skeleton | null {
    return this.skeletons.get(id) ?? null;
  }
  
  /**
   * 清理資源（防止 Memory Leak）
   */
  cleanup(id: string): void {
    this.skeletons.delete(id);
    this.states.delete(id);
    const atlas = this.atlases.get(id);
    if (atlas) {
      atlas.dispose();
      this.atlases.delete(id);
    }
  }
  
  /**
   * 清理所有資源
   */
  cleanupAll(): void {
    for (const [id] of this.skeletons) {
      this.cleanup(id);
    }
  }
}

// 取得單例
export const getSpineRuntimeAdapter = () => SpineRuntimeAdapter.getInstance();
```

### SpineCanvasRenderer（Canvas 渲染器）

```typescript
// src/infrastructure/spine/SpineCanvasRenderer.ts

import * as spine from '@esotericsoftware/spine-canvas';

/**
 * Spine Canvas 渲染器
 * 
 * 使用 Canvas 2D API 渲染 Spine 骨架
 * 適用於 2D Layer 整合
 */
export class SpineCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private skeletonRenderer: spine.SkeletonRenderer;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d')!;
    this.skeletonRenderer = new spine.SkeletonRenderer(this.context);
    this.skeletonRenderer.triangleRendering = true;
  }
  
  /**
   * 渲染骨架
   */
  render(skeleton: spine.Skeleton): void {
    this.context.save();
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 置中並縮放
    this.context.translate(this.canvas.width / 2, this.canvas.height / 2);
    
    this.skeletonRenderer.draw(skeleton);
    this.context.restore();
  }
  
  /**
   * 調整畫布大小
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
  
  /**
   * 清理
   */
  dispose(): void {
    // Canvas 自動由 DOM 管理
  }
}
```

---

## 🎨 Spine 專用面板設計

### 面板結構

```
SpineInspectorPanel
├── Header（檔案名稱、版本資訊）
├── Tab Navigation
│   ├── Animation（動畫控制）
│   ├── Skin（皮膚切換）
│   ├── Slot（插槽管理）
│   └── Transform（變換控制）
└── Tab Content
```

### Animation Tab（動畫分頁）

```typescript
// src/presentation/features/spine-panel/components/SpineAnimationTab.tsx

interface SpineAnimationTabProps {
  spineInstance: SpineInstance;
  element: SpineElement2D;
  onUpdate: (updates: Partial<SpineElement2D>) => void;
}

/**
 * 功能：
 * 1. 動畫列表（可選擇播放的動畫）
 * 2. 播放控制（播放/暫停/停止）
 * 3. 時間軸滑桿（可拖動 seek）
 * 4. 循環開關
 * 5. 播放速度調整（0.1x ~ 2.0x）
 * 6. 自動播放開關
 */
```

### Skin Tab（皮膚分頁）

```typescript
// src/presentation/features/spine-panel/components/SpineSkinTab.tsx

interface SpineSkinTabProps {
  spineInstance: SpineInstance;
  element: SpineElement2D;
  onUpdate: (updates: Partial<SpineElement2D>) => void;
}

/**
 * 功能：
 * 1. Skin 列表（單選）
 * 2. Skin 預覽縮圖
 * 3. 套用 Skin 按鈕
 */
```

### Slot Tab（插槽分頁）

```typescript
// src/presentation/features/spine-panel/components/SpineSlotTab.tsx

interface SpineSlotTabProps {
  spineInstance: SpineInstance;
}

/**
 * 功能：
 * 1. Slot 列表（樹狀結構）
 * 2. 各 Slot 的 Attachment 切換
 * 3. Slot 可見性開關
 */
```

### Transform Tab（變換分頁）

```typescript
// 複用 Element2DEditorPanel 的 Transform 區塊
/**
 * 功能：
 * 1. Position（X, Y）
 * 2. Size（Width, Height）
 * 3. Rotation
 * 4. Opacity
 * 5. Flip X / Flip Y
 */
```

---

## 🎬 Director Mode 整合

### ActionSourcePanel 擴充

```typescript
// src/presentation/features/director/components/ActionSourcePanel.tsx

interface ActionSourcePanelProps {
  // 現有 3D 模型來源
  actionSources: ActionSource[];
  
  // [NEW] Spine 動畫來源
  spineInstances: SpineInstance[];
}

/**
 * UI 結構：
 * 
 * Action Source Panel
 * ├── 3D Models Section（摺疊區塊）
 * │   └── [Model Cards with Animations]
 * └── Spine Animations Section（摺疊區塊）
 *     └── [Spine Cards with Animations]
 */
```

### Spine 動畫在時間軸上的表示

```typescript
// DirectorClip 擴充後，Spine 動畫片段的建立

const createSpineClip = (params: {
  trackId: string;
  spineInstance: SpineInstance;
  animation: SpineAnimationInfo;
  startFrame: number;
}): DirectorClip => ({
  id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  trackId: params.trackId,
  
  // Spine 特有
  sourceType: 'spine',
  spineInstanceId: params.spineInstance.id,
  sourceModelId: params.spineInstance.id,  // 向後兼容
  sourceModelName: params.spineInstance.name,
  
  sourceAnimationId: params.animation.name,
  sourceAnimationName: params.animation.name,
  sourceAnimationDuration: params.animation.frameCount,
  
  startFrame: params.startFrame,
  endFrame: params.startFrame + params.animation.frameCount - 1,
  
  speed: 1.0,
  loop: false,
  blendIn: 0,
  blendOut: 0,
  color: '#9333ea',  // 紫色區分 Spine 動畫
});
```

---

## 🛡️ 效能與記憶體管理

### 1. 資源載入優化

```typescript
// 使用 Web Worker 解析大型 .skel 檔案
// src/infrastructure/spine/SpineParserWorker.ts

self.onmessage = async (e: MessageEvent<{ skelBuffer: ArrayBuffer }>) => {
  const { skelBuffer } = e.data;
  // 在 Worker 中解析二進制資料
  // 只回傳必要的資訊，不傳遞整個骨架物件
  self.postMessage({ success: true, skeletonInfo: {...} });
};
```

### 2. 渲染優化

```typescript
// 使用 requestAnimationFrame 節流
// 只在元素可見時更新

const useSpineAnimation = (spineId: string, isVisible: boolean) => {
  const animationFrameRef = useRef<number>();
  
  useEffect(() => {
    if (!isVisible) return;
    
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      getSpineRuntimeAdapter().update(spineId, deltaTime);
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [spineId, isVisible]);
};
```

### 3. Memory Leak 防護

```typescript
// SpineElement 組件的清理

const SpineElement: React.FC<SpineElementProps> = ({ element }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SpineCanvasRenderer | null>(null);
  
  useEffect(() => {
    // 初始化渲染器
    if (canvasRef.current) {
      rendererRef.current = new SpineCanvasRenderer(canvasRef.current);
    }
    
    // 清理函數（組件卸載時執行）
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);
  
  // 當元素被刪除時，清理 Spine 實例
  useEffect(() => {
    return () => {
      getSpineRuntimeAdapter().cleanup(element.spineInstanceId);
    };
  }, [element.spineInstanceId]);
  
  return <canvas ref={canvasRef} />;
};
```

### 4. Spine 實例管理

```typescript
// src/presentation/hooks/useSpineInstanceManager.ts

interface SpineInstanceManager {
  instances: Map<string, SpineInstance>;
  
  add: (instance: SpineInstance) => void;
  remove: (id: string) => void;
  get: (id: string) => SpineInstance | undefined;
  
  // 清理所有實例（應用關閉時）
  cleanupAll: () => void;
}

export const useSpineInstanceManager = create<SpineInstanceManager>((set, get) => ({
  instances: new Map(),
  
  add: (instance) => {
    set(state => {
      const newInstances = new Map(state.instances);
      newInstances.set(instance.id, instance);
      return { instances: newInstances };
    });
  },
  
  remove: (id) => {
    // 1. 清理 Runtime 資源
    getSpineRuntimeAdapter().cleanup(id);
    
    // 2. 從狀態中移除
    set(state => {
      const newInstances = new Map(state.instances);
      newInstances.delete(id);
      return { instances: newInstances };
    });
  },
  
  cleanupAll: () => {
    const { instances } = get();
    instances.forEach((_, id) => {
      getSpineRuntimeAdapter().cleanup(id);
    });
    set({ instances: new Map() });
  },
}));
```

---

## 📦 依賴套件

```json
// package.json

{
  "dependencies": {
    "@esotericsoftware/spine-canvas": "^3.8.99",
    "@esotericsoftware/spine-core": "^3.8.99"
  }
}
```

> ⚠️ **注意**：Spine Runtime 3.8.99 對應 Spine Editor 3.8 版本。確保匯出的 `.skel` 和 `.atlas` 檔案版本一致。

---

## 🔄 選中互斥整合

Spine 元素作為 2D 元素的一種，自動繼承現有的選中互斥邏輯：

```typescript
// App.tsx 中的現有邏輯自動適用

const handleSelectElement = useCallback((layerId: string, elementId: string) => {
  // ...
  // 選中 2D 元素（包含 Spine）時，取消 3D 模型選中
  if (newElementId) {
    setActiveModelId(null);
  }
}, [setActiveModelId]);
```

---

## 📋 TODO List

### Phase 1：基礎架構（優先級：高）

| # | 任務 | 檔案路徑 | 預估時間 |
|---|------|----------|----------|
| 1-1 | 安裝 Spine Runtime 依賴 | `package.json` | 10 min |
| 1-2 | 建立 Spine 類型定義 | `src/types/spine.d.ts` | 30 min |
| 1-3 | 實作 SpineInstance 值物件 | `src/domain/value-objects/SpineInstance.ts` | 30 min |
| 1-4 | 擴充 Element2D 支援 Spine 類型 | `src/domain/value-objects/Element2D.ts` | 20 min |
| 1-5 | 實作 SpineRuntimeAdapter | `src/infrastructure/spine/SpineRuntimeAdapter.ts` | 2 hr |
| 1-6 | 實作 SpineCanvasRenderer | `src/infrastructure/spine/SpineCanvasRenderer.ts` | 1 hr |

### Phase 2：檔案載入（優先級：高）

| # | 任務 | 檔案路徑 | 預估時間 |
|---|------|----------|----------|
| 2-1 | 實作 LoadSpineUseCase | `src/application/use-cases/LoadSpineUseCase.ts` | 1 hr |
| 2-2 | 建立 Spine 檔案上傳組件 | `src/presentation/features/spine-panel/components/SpineFileUploader.tsx` | 1 hr |
| 2-3 | 整合到 LayerManagerPanel（新增 Spine 按鈕） | `src/presentation/features/layer-composer/components/LayerManagerPanel.tsx` | 30 min |

### Phase 3：2D Layer 渲染（優先級：高）

| # | 任務 | 檔案路徑 | 預估時間 |
|---|------|----------|----------|
| 3-1 | 實作 SpineElement 組件 | `src/presentation/features/layer-composer/components/SpineElement.tsx` | 2 hr |
| 3-2 | 修改 Layer2DRenderer 支援 Spine | `src/presentation/features/layer-composer/components/Layer2DRenderer.tsx` | 1 hr |
| 3-3 | 實作 useSpineAnimation Hook | `src/presentation/hooks/useSpineAnimation.ts` | 1 hr |

### Phase 4：Spine 編輯面板（優先級：中）

| # | 任務 | 檔案路徑 | 預估時間 |
|---|------|----------|----------|
| 4-1 | 實作 SpineInspectorPanel | `src/presentation/features/spine-panel/components/SpineInspectorPanel.tsx` | 1 hr |
| 4-2 | 實作 SpineAnimationTab | `src/presentation/features/spine-panel/components/SpineAnimationTab.tsx` | 2 hr |
| 4-3 | 實作 SpineSkinTab | `src/presentation/features/spine-panel/components/SpineSkinTab.tsx` | 1 hr |
| 4-4 | ✅ 實作 SpineSlotTab | `src/presentation/features/spine-panel/components/SpineSlotTab.tsx` | 1 hr |
| 4-5 | 整合面板到主 App | `src/App.tsx` | 30 min |

### Phase 5：Director Mode 整合（優先級：中）

| # | 任務 | 檔案路徑 | 預估時間 |
|---|------|----------|----------|
| 5-1 | 擴充 DirectorClip 類型 | `src/domain/entities/director/director.types.ts` | 20 min |
| 5-2 | 修改 ActionSourcePanel 支援 Spine | `src/presentation/features/director/components/ActionSourcePanel.tsx` | 1 hr |
| 5-3 | 修改 useDragAndDrop 支援 Spine | `src/presentation/features/director/hooks/useDragAndDrop.ts` | 1 hr |
| 5-4 | 實作 useDirectorSpineTrigger | `src/presentation/features/director/hooks/useDirectorSpineTrigger.ts` | 1.5 hr |
| 5-5 | 修改 ClipBlock 顯示 Spine 標識 | `src/presentation/features/director/components/ClipBlock.tsx` | 30 min |

### Phase 6：狀態管理與清理（優先級：高）✅ 已完成

| # | 任務 | 檔案路徑 | 預估時間 |
|---|------|----------|----------|
| ✅ 6-1 | 實作 useSpineStore (Zustand) | `src/presentation/stores/spineStore.ts` | 1 hr |
| ✅ 6-2 | 整合到 App 生命週期（清理） | `src/App.tsx` | 30 min |
| ✅ 6-3 | 撰寫單元測試 | `src/test/spine/spineStore.test.ts` | 2 hr |

### Phase 7：優化與修正（優先級：低）✅

| # | 任務 | 檔案路徑 | 預估時間 |
|---|------|----------|----------|
| ⏭️ 7-1 | Web Worker 大檔案解析（可選，已跳過） | `src/infrastructure/spine/SpineParserWorker.ts` | 2 hr |
| ✅ 7-2 | 效能監控整合 | `src/presentation/features/performance-monitor/` | 1 hr |
| ✅ 7-3 | 錯誤處理與使用者提示（Toast 系統） | `src/presentation/components/Toast/` | 1 hr |

---

## ⏱️ 總預估時間

| Phase | 預估時間 |
|-------|----------|
| Phase 1 | 4.5 hr |
| Phase 2 | 2.5 hr |
| Phase 3 | 4 hr |
| Phase 4 | 5.5 hr |
| Phase 5 | 4 hr |
| Phase 6 | 3.5 hr |
| Phase 7 | 4 hr |
| **Total** | **~28 hr** |

---

## 🌐 離線可用性

本設計**完全支援離線使用**：

| 組件 | 離線狀態 | 說明 |
|------|----------|------|
| Spine Runtime | ✅ | npm 安裝後打包進應用程式 |
| 檔案載入 | ✅ | 使用本地 `.skel` / `.atlas` / 圖片 |
| 渲染引擎 | ✅ | Canvas 2D API（瀏覽器內建） |
| 動畫控制 | ✅ | 純本地計算，無 API 依賴 |
| Director 時間軸 | ✅ | Zustand 狀態管理，前端處理 |

> **唯一需要網路的時機**：首次 `npm install` 安裝依賴。之後 Vite 會將所有依賴打包進 bundle，完全本地運行。

---

## 🚨 風險與注意事項

### 1. Spine Runtime 授權
Spine Runtime 需要有效的 Spine 授權才能使用。確保專案有合法授權。

### 2. 版本相容性
`.skel` 檔案必須與 Runtime 版本匹配（3.8.99）。不同版本的檔案可能無法正確載入。

### 3. 大檔案處理
複雜的 Spine 骨架可能有大型 Atlas 和多張貼圖，需要適當的載入進度提示。

### 4. Canvas vs WebGL
本設計使用 Canvas 2D 渲染，適合簡單場景。若需要更好效能，可考慮使用 WebGL 渲染器。

### 5. 與 Three.js 共存
Spine 使用獨立的 Canvas，不直接整合到 Three.js 場景中，避免渲染衝突。

