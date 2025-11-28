# 2D 層級系統整合分析報告

> **專案名稱**：JR 3D Viewer - 2D/3D 混合層級系統  
> **文件版本**：v1.1（更新：2D/3D 優先權 + 純 2D Camera 規格）  
> **建立日期**：2025.11.28  
> **狀態**：規劃階段 📋

---

## 📋 目錄

1. [執行摘要](#執行摘要)
2. [現有架構分析](#現有架構分析)
3. [需求分析](#需求分析)
4. [技術方案設計](#技術方案設計)
5. [資料結構設計](#資料結構設計)
6. [UI/UX 設計](#uiux-設計)
7. [實施計畫](#實施計畫)
8. [技術挑戰與解決方案](#技術挑戰與解決方案)
9. [效能考量](#效能考量)
10. [未來擴展](#未來擴展)

---

## 📊 執行摘要

### 專案目標

在既有 3D Viewer（3D 模型邏輯 **完全不動**）的前提下，建立一個**多層級混合渲染系統**，允許用戶：

- ✅ 將 3D 場景視為優先權 `priority = 0` 的特殊層級
- ✅ 使用「純 2D 相機」渲染所有 2D 素材（不受 Three.js 相機影響）
- ✅ 透過 `priority` 由大到小決定層級位置：`priority > 0` 顯示在 3D 前方，`priority < 0` 顯示在 3D 後方
- ✅ 自由新增、排序、掛載 2D 素材層（Layer 為父節點、2D 素材為子節點）
- ✅ 預覽區可獨立開關 2D / 3D 顯示（可同時開啟或全部關閉）
- ✅ 導出包含所有層級的合成結果

### 核心價值

1. **內容豐富度提升**：結合 3D 模型與 2D 圖形設計
2. **創作彈性**：UI 設計師可在 3D 場景前後添加裝飾、說明、特效
3. **簡報/展示應用**：可製作結合 3D 與 2D 的動態簡報
4. **遊戲 UI 原型**：模擬遊戲中的 UI 疊加效果

---

## 🏗️ 現有架構分析

### 目前技術棧

```
前端框架：React 19.2.0 + TypeScript 5.9.3
3D 渲染：Three.js 0.181.2 + @react-three/fiber
建置工具：Vite 7.2.4
架構模式：Domain-Driven Design (DDD)
```

### 目前 3D 場景架構

```typescript
SceneViewer (React Component)
  └─ Canvas (@react-three/fiber)
       ├─ 3D Models (THREE.Group)
       ├─ Animation System (THREE.AnimationMixer)
       ├─ Shader System (Custom ShaderMaterial)
       ├─ Effekseer Effects
       ├─ OrbitControls
       └─ Lights + Environment
```

### 架構優勢

- ✅ **模組化設計**：Domain / Application / Infrastructure / Presentation 分層清晰
- ✅ **已支援多模型**：`ModelInstanceForRender[]` 結構可作為參考
- ✅ **完善的狀態管理**：使用 React Hooks + Use Cases
- ✅ **擴展性良好**：可無縫加入新功能模組

### 架構限制

- ⚠️ 目前所有內容都在 `<Canvas>` 內渲染（Three.js WebGL 上下文）
- ⚠️ 2D 元素若要與 3D 場景混合，需要處理渲染順序和深度問題
- ⚠️ 2D 互動事件需要額外處理（不能直接使用 Three.js 事件系統）

---

## 📝 需求分析

### 功能需求（依最新規格更新）

#### FR-1: 層級管理系統

- FR-1.1: 用戶可創建多個 2D 層級並設定 `priority`（整數）
- FR-1.2: 層級排序依 `priority` 由大到小自動決定（不再依靠手動排序值）
- FR-1.3: `priority > 0` 的層顯示在 3D 前方、`priority < 0` 顯示在 3D 後方，`priority = 0` 保留給 3D 主層
- FR-1.4: 用戶可顯示/隱藏特定層級
- FR-1.5: 用戶可刪除層級
- FR-1.6: 用戶可重命名層級並鎖定以避免誤觸
- FR-1.7: 3D 層固定存在、邏輯不可被修改（僅可透過既有 3D 功能面板控制）

#### FR-2: 2D 素材管理

- FR-2.1: 用戶可在任意 2D 層下新增素材（圖片、文字、形狀、HTML 等）
- FR-2.2: 2D 素材以「父層 Layer → 子節點素材」樹狀顯示，可展開/收合
- FR-2.3: 層級展開後可直接拖拉子節點以調整渲染順序
- FR-2.4: 支援圖片格式（PNG, JPG, WebP, SVG）與純文字、向量形狀
- FR-2.5: 素材預覽與編輯完全在 2D 平面完成，不依賴 3D 相機

#### FR-3: 2D 元素編輯

- FR-3.1: 用戶可拖動元素調整位置（以 2D 畫布座標為準）
- FR-3.2: 用戶可縮放元素
- FR-3.3: **（更新）** 移除字卡的「公轉 / 自轉」動畫控制，改以純定位 + 尺寸設定為主
- FR-3.4: 用戶可調整透明度
- FR-3.5: 用戶可調整層內渲染順序（透過拖拉列表或直接輸入 z-index）

#### FR-4: 預覽與顯示控制

- FR-4.1: 預覽區新增「3D」「2D」兩個 toggle，可以單獨或同時開關
- FR-4.2: 預覽區在「僅 2D」模式時顯示純 2D 畫面；僅 3D 模式時回復既有 3D viewer；兩者全關時顯示提示畫面
- FR-4.3: 當 2D 關閉時不渲染任何 2D 層（節省效能）；當 3D 關閉時暫停 Three.js loop
- FR-4.4: 合成導出可選擇「僅 2D」「僅 3D」「2D+3D」

#### FR-5: 合成與導出

- FR-5.1: 保留既有截圖/錄影流程，但需考量 2D 層一併輸出
- FR-5.2: 導出專案檔案時需保存 Layer / Element 的 priority 與排序資訊

### 非功能需求

#### NFR-1: 效能

- 支援至少 20 個層級不卡頓
- 2D 層級渲染不影響 3D 場景幀率（目標 60 FPS）
- 大圖片自動壓縮/降採樣

#### NFR-2: 易用性

- 直覺的拖放介面
- 即時預覽（WYSIWYG）
- 支援鍵盤快捷鍵（Ctrl+Z, Ctrl+C, Delete 等）

#### NFR-3: 相容性

- 與現有 3D 功能完全相容
- 不破壞現有程式碼架構
- 向後相容（沒有 2D 層時仍可正常運作）

---

## 🔧 技術方案設計

### 方案比較

#### 方案 A：HTML/CSS Overlay（推薦）✅

**架構**：使用絕對定位的 HTML 層覆蓋在 Canvas 上方/下方

```tsx
<div className="viewer-container">
  {/* 前景 2D 層 */}
  {layers.filter(l => l.position === 'front').map(layer => (
    <div className="layer-2d" style={{ zIndex: layer.priority }}>
      {layer.elements}
    </div>
  ))}
  
  {/* 3D Canvas */}
  <Canvas style={{ zIndex: 100 }}>
    {/* 3D 場景 */}
  </Canvas>
  
  {/* 背景 2D 層 */}
  {layers.filter(l => l.position === 'back').map(layer => (
    <div className="layer-2d" style={{ zIndex: layer.priority }}>
      {layer.elements}
    </div>
  ))}
</div>
```

**優點**：
- ✅ 簡單直覺，使用原生 HTML/CSS
- ✅ 效能好，瀏覽器原生優化
- ✅ 支援所有 CSS 特性（動畫、濾鏡、混合模式）
- ✅ 易於實現互動（原生 DOM 事件）
- ✅ 可使用 React 組件生態系

**缺點**：
- ⚠️ 2D 元素無法插入 3D 場景「內部」（只能在前後）
- ⚠️ 需要處理 Canvas 透明度（如果 2D 層在背景）

---

#### 方案 B：Three.js Sprite/Plane

**架構**：在 Three.js 場景內使用 Sprite 或 Plane 渲染 2D 內容

```tsx
<Canvas>
  <Sprite position={[0, 0, 10]}>
    <spriteMaterial map={texture} />
  </Sprite>
  <Model /> {/* 3D 模型 */}
  <Sprite position={[0, 0, -5]}>
    <spriteMaterial map={texture} />
  </Sprite>
</Canvas>
```

**優點**：
- ✅ 可以在 3D 空間中任意定位
- ✅ 自動處理深度排序
- ✅ 可與 3D 物件互動（碰撞、遮擋）

**缺點**：
- ❌ 複雜度高，需要將 HTML 轉換為紋理
- ❌ 互動性差（需要自訂事件處理）
- ❌ 無法使用原生 CSS 特性
- ❌ 文字渲染品質問題

---

#### 方案 C：混合方案

在前/後使用 **方案 A**（HTML Overlay），3D 場景內插入使用 **方案 B**（Three.js Sprite）

**推薦用於進階需求**（第二階段實作）

---

### 選定方案：方案 A（HTML/CSS Overlay）

基於以下理由：

1. **符合需求**：用戶主要需求是「前景/背景」層，不需要 3D 空間定位
2. **開發效率**：使用熟悉的 HTML/CSS/React 技術
3. **易維護**：程式碼清晰，易於除錯
4. **效能優秀**：瀏覽器原生優化，不增加 WebGL 負擔

---

## 💾 資料結構設計

### 核心資料模型（新增 priority 與父子層概念）

#### Layer（層級）

```typescript
/**
 * 層級類型
 */
export type LayerType = '3d' | '2d';

/**
 * 層級位置（相對於 3D 場景）
 */
export type LayerPosition = 'back' | 'front' | 'inline'; // inline 為 3D 層

/**
 * 2D 元素類型
 */
export type Element2DType = 'image' | 'text' | 'shape' | 'html';

/**
 * 2D 元素基礎介面
 */
export interface Element2DBase {
  id: string;
  type: Element2DType;
  name: string;
  position: { x: number; y: number }; // CSS px or %
  size: { width: number; height: number }; // CSS px or %
  rotation: number; // deg
  opacity: number; // 0-1
  zIndex: number; // 層內順序
  visible: boolean;
  locked: boolean; // 鎖定（不可編輯）
}

/**
 * 圖片元素
 */
export interface ImageElement extends Element2DBase {
  type: 'image';
  src: string; // URL or Data URL
  fit: 'contain' | 'cover' | 'fill' | 'none';
  filters?: string; // CSS filter
}

/**
 * 文字元素
 */
export interface TextElement extends Element2DBase {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  textShadow?: string;
}

/**
 * 形狀元素
 */
export interface ShapeElement extends Element2DBase {
  type: 'shape';
  shape: 'rect' | 'circle' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * HTML 元素（自訂內容）
 */
export interface HTMLElement extends Element2DBase {
  type: 'html';
  html: string; // 原始 HTML
  css?: string; // 自訂 CSS
}

/**
 * 2D 元素聯集類型
 */
export type Element2D = ImageElement | TextElement | ShapeElement | HTMLElement;

/**
 * 層級介面
 */
export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  position: LayerPosition;
  priority: number; // 新增：排序依據，整數，越大越前
  order?: number; // 過渡期兼容舊邏輯，未來可移除
  visible: boolean;
  locked: boolean;
  opacity: number; // 整層透明度
  children: Element2D[]; // 新增：2D 素材清單（type = '2d' 時使用），3D 層則為空陣列
  
  // 3D 層級專用（參考現有結構）
  model?: THREE.Group | null;
  clip?: THREE.AnimationClip | null;
  shaderGroups?: ShaderGroup[];
}
```

### App 狀態擴展

```typescript
// App.tsx 新增狀態
const [layers, setLayers] = useState<Layer[]>([
  {
    id: '3d-main',
    name: '3D Scene',
    type: '3d',
    position: 'inline',
    priority: 0, // 基準層
    visible: true,
    locked: true,
    opacity: 1.0,
    children: [],
    model, // 現有 3D 模型
    clip: playingClip,
    shaderGroups
  }
]);

const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
```

---

## 🎨 UI/UX 設計

### 使用者介面布局（加入 2D/3D 開關 + 層級排序提示）

```
┌────────────────────────────────────────────────────────────┐
│  Top Toolbar (現有)                                         │
├──────┬──────────────────────────────────────────┬──────────┤
│      │                                          │          │
│ Left │          Viewer Area                     │  Right   │
│ Tool │  ┌────────────────────────────────────┐  │  Panel   │
│ bar  │  │ [Toggle] 2D □ 3D □                 │  │          │
│      │  │  ├─ Front Layers (priority > 0)    │  │ Tabs:    │
│      │  │  │   ├─ Layer 3 (p=20)             │  │  - Layer │
│      │  │  │   │    ├─ 🖼 Logo               │  │  - 2D    │
│      │  │  │   │    └─ 📝 Title             │  │  - Opt   │
│      │  │  │   └─ Layer 2 (p=5)              │  │  - Shade │
│      │  │  │                                 │  │  - Audio │
│      │  │  ├─ 3D Scene (priority = 0)        │  │          │
│      │  │  │   └─ [3D Canvas Preview]        │  │          │
│      │  │  └─ Back Layers (priority < 0)     │  │          │
│      │  │      └─ Layer 1 (p=-10)            │  │          │
│      │  └────────────────────────────────────┘  │          │
│      │                                          │          │
├──────┴──────────────────────────────────────────┴──────────┤
│  Bottom Panel (Animation Timeline)                         │
└────────────────────────────────────────────────────────────┘
```

### 新增 UI 組件

#### 1. LayerManagerPanel（層級管理面板）

**位置**：右側面板新增分頁

**功能**：
- 顯示所有層級列表（依 priority 由大到小）
- 支援父層（Layer）/子節點（素材）樹狀展開
- 直接在列表中拖動以調整 priority（或輸入數值）
- 顯示/隱藏切換
- 鎖定/解鎖切換
- 重命名
- 刪除
- 添加新層級按鈕

**設計草圖**：
```
┌─ Layer Manager ────────────────┐
│ [+ Add Layer ▼]                │
│                                 │
│ ┌─ Layer 3 (2D) ──────────┐    │
│ │ 👁 🔓 Front | Opacity: 100% │  │
│ └─────────────────────────┘    │
│                                 │
│ ┌─ 3D Scene ──────────────┐    │
│ │ 👁 🔒 Inline | [Active]  │    │
│ └─────────────────────────┘    │
│                                 │
│ ┌─ Layer 1 (2D) ──────────┐    │
│ │ 👁 🔓 Back | Opacity: 80% │   │
│ └─────────────────────────┘    │
└─────────────────────────────────┘
```

#### 2. Element2DEditorPanel（2D 元素編輯器）

**位置**：右側面板新增分頁（當選擇 2D 層時顯示）

**功能**：
- 添加元素（圖片、文字、形狀）
- 元素列表
- 屬性編輯器
  - 位置（X, Y）
  - 大小（Width, Height）
  - 旋轉角度（僅靜態設定，無公轉/自轉動畫）
  - 透明度
  - Z-index
- 刪除元素

**設計草圖**：
```
┌─ 2D Elements ─────────────────┐
│ [+ Add] [Image] [Text] [Shape] │
│                                 │
│ Layer: "Layer 3" (2D)           │
│                                 │
│ Elements:                       │
│ ├─ 🖼️ Logo.png                 │
│ ├─ 📝 Title Text                │
│ └─ ⬜ Background Rect          │
│                                 │
│ ── Selected: Logo.png ────      │
│ Position X: [150] Y: [200]      │
│ Size W: [300] H: [200]          │
│ Rotation: [0]° (無公/自轉)      │
│ Opacity: [100]%                 │
│ Z-index: [10]                   │
│                                 │
│ [Delete Element]                │
└─────────────────────────────────┘
```

#### 3. Layer2DRenderer（2D 層級渲染器）

**位置**：SceneViewer 組件內部

**功能**：
- 渲染 2D 層級到 HTML
- 處理元素拖動
- 處理元素選擇
- 響應式縮放
- 內建純 2D 畫布相機（使用 container 尺寸 + transform 計算）

**實作概念**：
```tsx
<div className="relative w-full h-full">
  {/* 背景 2D 層 */}
  {backLayers.map(layer => (
    <Layer2DRenderer 
      key={layer.id}
      layer={layer}
      zIndex={layer.priority}
      onElementClick={handleElementClick}
    />
  ))}
  
  {/* 3D Canvas */}
  <Canvas className="absolute inset-0" style={{ zIndex: 100 }}>
    {/* 3D 內容 */}
  </Canvas>
  
  {/* 前景 2D 層 */}
  {frontLayers.map(layer => (
    <Layer2DRenderer 
      key={layer.id}
      layer={layer}
      zIndex={100 + layer.priority}
      onElementClick={handleElementClick}
    />
  ))}
</div>
```

#### 4. PreviewModeToggle（2D/3D 顯示控制）

**位置**：3D 預覽區頂部工具列

**功能**：
- 兩顆切換鈕：`[2D]`、`[3D]`，可單獨或同時啟用
- 提示目前顯示模式（僅 2D / 僅 3D / 2D+3D / 全關）
- 當 2D 關閉時，Layer2DRenderer 完全卸載；當 3D 關閉時，暫停 `SceneViewer` 的渲染 loop
- 當兩者全關時，顯示占位提示（例如「請開啟 2D 或 3D 預覽」）

---

## 🛠️ 實施計畫

### 第一階段：核心基礎（2-3 週）

#### Week 1: 資料結構與狀態管理

**任務**：
- [ ] 建立 `Layer` 相關 Value Objects
  - `src/domain/value-objects/Layer.ts`
  - `src/domain/value-objects/Element2D.ts`
- [ ] 建立 Layer 管理服務
  - `src/domain/services/LayerService.ts`
- [ ] 建立 Use Cases
  - `src/application/use-cases/CreateLayerUseCase.ts`
  - `src/application/use-cases/UpdateLayerUseCase.ts`
  - `src/application/use-cases/DeleteLayerUseCase.ts`
  - `src/application/use-cases/ReorderLayersUseCase.ts`（實際調整 priority）
  - `src/application/use-cases/UpdateLayerPriorityUseCase.ts`
- [ ] 建立工具函數
  - `src/utils/layer/layerUtils.ts`
- [ ] 擴展 App.tsx 狀態管理

**預期產出**：
- 完整的 Layer 資料模型
- 基本的 CRUD 操作
- 單元測試（可選）

#### Week 2-3: UI 組件開發

**任務**：
- [ ] 建立 LayerManagerPanel 組件
  - `src/presentation/features/layer-manager/components/LayerManagerPanel.tsx`
  - 層級列表顯示
  - 拖放排序（使用 `react-beautiful-dnd` 或 `dnd-kit`）
  - 可見性/鎖定切換
  - 添加/刪除層級
- [ ] 建立 Layer2DRenderer 組件
  - `src/presentation/features/layer-2d/components/Layer2DRenderer.tsx`
  - 渲染圖片元素
  - 基本定位與樣式
- [ ] 整合到 App.tsx
  - 將現有 3D 場景包裝為 Layer
  - 支援添加簡單的 2D 背景層

**預期產出**：
- 可運作的層級管理介面
- 基本的 2D 層渲染（僅圖片）
- 可切換層級順序

---

### 第二階段：元素編輯器（2-3 週）

#### Week 4-5: 2D 元素管理

**任務**：
- [ ] 建立 Element2DEditorPanel 組件
  - `src/presentation/features/element-2d-editor/components/Element2DEditorPanel.tsx`
- [ ] 實作元素類型
  - [ ] ImageElement 渲染與編輯
  - [ ] TextElement 渲染與編輯
  - [ ] ShapeElement 渲染與編輯
- [ ] 實作元素拖動功能
  - 使用 `react-draggable` 或自訂實作
- [ ] 實作元素變換（Transform）
  - 位置調整
  - 大小調整（Resize Handles）
  - 旋轉（Rotation Handle，僅靜態，無公/自轉動畫）
- [ ] 屬性面板
  - 即時屬性編輯
  - 顏色選擇器
  - 字體選擇器

**預期產出**：
- 完整的 2D 元素編輯器
- WYSIWYG 編輯體驗
- 支援多種元素類型

#### Week 6: 互動與優化

**任務**：
- [ ] 實作選擇框（Selection Box）
- [ ] 實作多選功能
- [ ] 實作剪貼簿（Copy/Paste）
- [ ] 實作復原/重做（Undo/Redo）
  - 使用 `use-undo` 或自訂實作
- [ ] 鍵盤快捷鍵
  - Delete: 刪除元素
  - Ctrl+C/V: 複製/貼上
  - Ctrl+Z/Y: 復原/重做
  - Arrow Keys: 微調位置
- [ ] 效能優化
  - 虛擬化長列表（react-window）
  - 防抖（debounce）屬性更新

**預期產出**：
- 流暢的編輯體驗
- 完整的互動功能
- 效能達標（60 FPS）

---

### 第三階段：進階功能（2-3 週）

#### Week 7-8: 導出與持久化

**任務**：
- [ ] 實作專案檔案匯出
  - 建立 Use Case: `ExportProjectUseCase.ts`
  - JSON 格式儲存所有層級資料
  - 將圖片轉換為 Data URL（或打包）
- [ ] 實作專案檔案匯入
  - 建立 Use Case: `ImportProjectUseCase.ts`
  - 解析 JSON 並重建層級結構
- [ ] 實作合成圖片導出
  - 使用 `html2canvas` 或 Canvas API
  - 將 2D + 3D 合成為單一圖片
- [ ] 實作視頻導出（可選）
  - 使用 MediaRecorder API
  - 錄製包含所有層級的動畫

**預期產出**：
- 完整的專案儲存/載入功能
- 高品質合成圖片導出
- （可選）視頻導出功能

#### Week 9: 測試與文檔

**任務**：
- [ ] 撰寫使用者文檔
  - `docs/2D_LAYER_USAGE_GUIDE.md`
- [ ] 撰寫開發者文檔
  - `docs/2D_LAYER_ARCHITECTURE.md`
- [ ] 整合測試
  - 測試各種場景組合
  - 邊界條件測試
- [ ] 效能測試
  - 壓力測試（50+ 層級）
  - 大圖片處理測試
- [ ] Bug 修復與優化

**預期產出**：
- 完整文檔
- 穩定的功能
- 測試報告

---

### 第四階段：進階特性（可選，2-4 週）

- [ ] 動畫系統
  - CSS Animations 支援
  - 關鍵幀動畫編輯器
  - 動畫與 3D 動畫同步
- [ ] 濾鏡與特效
  - CSS Filters（模糊、銳化、色彩調整）
  - 混合模式（Blend Modes）
  - SVG 濾鏡
- [ ] 3D 空間內 2D 元素（方案 B）
  - 使用 Three.js Sprite
  - 3D 空間定位
  - 深度排序
- [ ] 協作功能
  - 圖層註釋
  - 版本控制
  - 分享連結

---

## ⚠️ 技術挑戰與解決方案

### 挑戰 1：Canvas 透明度處理

**問題**：如果 2D 層在背景，需要 Canvas 透明才能看到下方內容

**解決方案**：
```tsx
<Canvas
  gl={{
    alpha: true, // 啟用透明度
    preserveDrawingBuffer: true
  }}
  style={{ 
    background: 'transparent', // CSS 透明
    position: 'absolute',
    zIndex: 100
  }}
>
  <color attach="background" args={['transparent']} />
  {/* 或 */}
  {/* 不設定 background，讓 canvas 自然透明 */}
</Canvas>
```

**注意**：
- 透明 Canvas 可能影響效能（約 5-10% 效能損失）
- 需要設定適當的背景色或移除 `<color>` 節點

---

### 挑戰 2：事件穿透（Event Propagation）

**問題**：2D 層在 Canvas 前方時，滑鼠事件會被攔截，無法操作 3D 場景

**解決方案**：
```tsx
// 2D 層級容器
<div
  className="layer-2d"
  style={{
    pointerEvents: isEditMode ? 'auto' : 'none' // 編輯模式才接收事件
  }}
>
  {elements.map(el => (
    <div
      key={el.id}
      style={{
        pointerEvents: 'auto' // 個別元素總是可點擊
      }}
    />
  ))}
</div>
```

**策略**：
- **檢視模式**：2D 層 `pointer-events: none`，事件穿透到 Canvas
- **編輯模式**：2D 層 `pointer-events: auto`，可編輯元素
- **混合模式**：容器 `none`，但個別元素 `auto`（僅元素可點擊）

---

### 挑戰 3：響應式布局

**問題**：2D 元素位置需要在不同螢幕尺寸下保持相對位置

**解決方案**：
```typescript
// 使用百分比 + transform
interface Position {
  x: number; // 0-100 (%)
  y: number; // 0-100 (%)
  unit: 'percent' | 'px';
}

// 渲染時轉換
const style = {
  left: position.unit === 'percent' ? `${position.x}%` : `${position.x}px`,
  top: position.unit === 'percent' ? `${position.y}%` : `${position.y}px`,
  transform: `translate(-50%, -50%)` // 以中心點為基準
};
```

**建議**：
- 預設使用百分比定位（響應式）
- 進階使用者可切換到像素定位（精確控制）
- 提供「鎖定比例」選項

---

### 挑戰 4：大圖片效能

**問題**：高解析度圖片會占用大量記憶體，影響效能

**解決方案**：
```typescript
// 圖片壓縮工具
async function compressImage(file: File, maxWidth: number = 1920): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = URL.createObjectURL(file);
  });
}
```

**策略**：
- 上傳時自動壓縮大圖（> 1920px）
- 使用 WebP 格式（更小體積）
- Lazy Loading（視需要載入）

---

### 挑戰 5：合成導出品質

**問題**：使用 `html2canvas` 可能導致模糊或失真

**解決方案**：
```typescript
import html2canvas from 'html2canvas';

async function captureComposite() {
  const container = document.getElementById('viewer-container')!;
  
  // 高解析度截圖
  const canvas = await html2canvas(container, {
    scale: 2, // 2x 解析度
    useCORS: true, // 允許跨域圖片
    allowTaint: false,
    backgroundColor: null // 保留透明度
  });
  
  return canvas.toDataURL('image/png');
}
```

**替代方案**：
- 使用 Canvas API 手動合成（更高品質）
- 分別截取 2D 和 3D，再用 Canvas 合併
- 使用 OffscreenCanvas（效能更好）

---

## ⚡ 效能考量

### 效能目標

- **渲染幀率**：60 FPS（16.67ms/frame）
- **層級上限**：50 個層級不卡頓
- **元素上限**：每層 100 個元素
- **記憶體使用**：< 500 MB（包含 3D 模型）

### 優化策略

#### 1. 虛擬化渲染

```typescript
// 只渲染可見區域的元素
const visibleElements = useMemo(() => {
  return elements.filter(el => 
    isElementInViewport(el, viewportBounds)
  );
}, [elements, viewportBounds]);
```

#### 2. 批次更新

```typescript
// 使用 requestAnimationFrame 批次更新
const updateElementPosition = useCallback(
  debounce((id: string, position: Position) => {
    requestAnimationFrame(() => {
      setElements(prev => 
        prev.map(el => el.id === id ? { ...el, position } : el)
      );
    });
  }, 16), // 60 FPS
  []
);
```

#### 3. Memoization

```tsx
// 使用 React.memo 避免不必要的重渲染
const Element2DRenderer = React.memo(({ element }: { element: Element2D }) => {
  // ...
}, (prev, next) => {
  return isEqual(prev.element, next.element);
});
```

#### 4. Web Workers（進階）

```typescript
// 將圖片處理移到 Worker
const worker = new Worker('imageProcessor.worker.ts');
worker.postMessage({ type: 'compress', file });
worker.onmessage = (e) => {
  const compressedImage = e.data;
  // 使用壓縮後的圖片
};
```

---

## 🚀 未來擴展

### 短期（3-6 個月）

1. **模板系統**
   - 預設層級模板（簡報、海報、名片等）
   - 一鍵套用模板
   - 社群模板分享

2. **智慧對齊**
   - 自動對齊輔助線
   - 磁吸功能
   - 均勻分佈

3. **樣式庫**
   - 預設文字樣式
   - 色彩主題
   - 圖形元件庫

### 中期（6-12 個月）

1. **動畫編輯器**
   - 時間軸編輯
   - 關鍵幀動畫
   - 緩動函數

2. **外掛系統**
   - 支援第三方外掛
   - Figma/Sketch 匯入
   - SVG 動畫支援

3. **協作功能**
   - 多人即時編輯
   - 評論系統
   - 版本歷史

### 長期（1-2 年）

1. **AI 輔助**
   - 自動排版建議
   - 智慧去背
   - 風格轉換

2. **雲端整合**
   - 雲端儲存
   - 資產管理
   - CDN 加速

3. **遊戲引擎整合**
   - Unity/Unreal 匯出
   - 互動腳本
   - 物理模擬

---

## 📚 參考資源

### 相關技術

- **React DnD**: https://react-dnd.github.io/react-dnd/
- **dnd-kit**: https://dndkit.com/
- **html2canvas**: https://html2canvas.hertzen.com/
- **Fabric.js**: http://fabricjs.com/ (Canvas 繪圖庫，可作為參考)
- **Konva.js**: https://konvajs.org/ (另一個 Canvas 庫)

### 類似產品

- **Figma**: https://www.figma.com/ (設計工具參考)
- **Canva**: https://www.canva.com/ (模板系統參考)
- **Spline**: https://spline.design/ (3D + 2D 混合參考)
- **Rive**: https://rive.app/ (動畫編輯器參考)

---

## ✅ 檢查清單

### 開發前檢查

- [ ] 確認需求與產品團隊對齊
- [ ] 評估開發時程是否合理
- [ ] 確認技術可行性
- [ ] 建立原型驗證核心概念
- [ ] 設定效能基準測試

### 開發中檢查

- [ ] 遵循現有架構模式（DDD）
- [ ] 撰寫單元測試（可選但推薦）
- [ ] 定期效能測試
- [ ] Code Review
- [ ] 更新文檔

### 發布前檢查

- [ ] 完整的功能測試
- [ ] 跨瀏覽器測試（Chrome, Firefox, Safari, Edge）
- [ ] 響應式測試（不同螢幕尺寸）
- [ ] 效能達標
- [ ] 撰寫使用者文檔
- [ ] 準備範例/教學

---

## 📝 附錄

### A. 檔案結構預覽

```
src/
├── domain/
│   ├── value-objects/
│   │   ├── Layer.ts                    # 層級定義
│   │   ├── Element2D.ts                # 2D 元素定義
│   │   └── LayerPosition.ts            # 位置類型
│   └── services/
│       └── LayerService.ts             # 層級業務邏輯
├── application/
│   └── use-cases/
│       ├── CreateLayerUseCase.ts
│       ├── UpdateLayerUseCase.ts
│       ├── DeleteLayerUseCase.ts
│       ├── ReorderLayersUseCase.ts
│       ├── UpdateLayerPriorityUseCase.ts
│       ├── AddElement2DUseCase.ts
│       ├── UpdateElement2DUseCase.ts
│       └── ExportCompositeUseCase.ts
├── infrastructure/
│   └── canvas/
│       └── CompositeRenderer.ts        # 合成渲染器
├── presentation/
│   └── features/
│       ├── layer-manager/
│       │   └── components/
│       │       └── LayerManagerPanel.tsx
│       ├── layer-2d/
│       │   └── components/
│       │       ├── Layer2DRenderer.tsx
│       │       ├── ImageElementRenderer.tsx
│       │       ├── TextElementRenderer.tsx
│       │       └── ShapeElementRenderer.tsx
│       └── element-2d-editor/
│           └── components/
│               ├── Element2DEditorPanel.tsx
│               ├── TransformControls.tsx
│               └── PropertyEditor.tsx
└── utils/
    └── layer/
        ├── layerUtils.ts
        └── element2DUtils.ts
```

### B. 關鍵 API 介面

```typescript
// LayerService
class LayerService {
  static createLayer(type: LayerType, position: LayerPosition): Layer;
  static updateLayer(layer: Layer, updates: Partial<Layer>): Layer;
  static reorderLayers(layers: Layer[], from: number, to: number): Layer[]; // 過渡期
  static updateLayerPriority(layers: Layer[], layerId: string, newPriority: number): Layer[];
  static addElement(layer: Layer, element: Element2D): Layer;
  static removeElement(layer: Layer, elementId: string): Layer;
  static updateElement(layer: Layer, elementId: string, updates: Partial<Element2D>): Layer;
}

// Use Case 範例
class CreateLayerUseCase {
  static execute(params: {
    type: LayerType;
    position: LayerPosition;
    name?: string;
  }): Layer {
    const layer = LayerService.createLayer(params.type, params.position);
    if (params.name) {
      layer.name = params.name;
    }
    return layer;
  }
}
```

---

## 🎯 結論

此 2D 層級系統的整合將顯著提升 JR 3D Viewer 的功能性與創作彈性，使其從單純的「3D 模型檢視器」進化為「多媒體創作平台」。

### 核心優勢

✅ **架構優雅**：完全相容現有 DDD 架構  
✅ **技術可行**：使用成熟的 HTML/CSS/React 技術  
✅ **效能良好**：不影響 3D 場景渲染效能  
✅ **易於維護**：模組化設計，職責清晰  
✅ **可擴展**：為未來進階功能預留空間  

### 建議

1. **採用漸進式開發**：先完成核心功能，再逐步添加進階特性
2. **重視使用者回饋**：每個階段完成後收集使用者意見
3. **保持文檔更新**：隨著開發進度更新技術文檔
4. **效能優先**：定期進行效能測試，確保不影響使用體驗

---

**文件維護者**：(JR.H)  
**最後更新**：2025.11.28  
**狀態**：待審核 ✅

---

## 📞 聯絡資訊

如有任何問題或建議，請透過以下方式聯繫：

- **GitHub Issues**: [專案 Issues 頁面]
- **Email**: [(JR.H)]
- **Discord**: [(JR.H)]

---

_此文件將隨專案進展持續更新。_

