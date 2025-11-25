## Effekseer 開發步驟流程（Effekseer_dev_step）

> 本文件是從 `docs/effekseer-integration-plan.md` 萃取而來的「實作路線圖」，目標是讓你可以 **一步一步叫我幫你開發**，每一階段都可以單獨驗收。
>
> 分成三個大階段（Phase 1～3），每個 Phase 拆成具體 Step，盡量對應到專案現有的 DDD 分層與檔案結構。

---

## Phase 1：MVP – 單特效 + 獨立 Canvas 預覽

> 目標：能在現有 3D Viewer 附近 **載入單一 Effekseer 特效檔**，用獨立 `<canvas>` 疊在上方，手動 Play / Stop / Loop，先確認「能跑、看得到」。

### Step 1-1：準備 Effekseer Web Runtime 資源

- **目標**
  - 把 Effekseer Web Runtime 所需的檔案放進專案，並決定放置位置與載入方式。
- **工作項目**
  - 在 `public/effekseer/` 之類的資料夾放入：
    - `effekseer.min.js`
    - 對應的 `.wasm`（例如 `effekseer.wasm`，實際名稱依官方套件為準）
  - 確認 Vite 可以正確從 `public` 伺服靜態資源（例如：`/effekseer/effekseer.min.js`）。
- **完成條件**
  - 在瀏覽器 DevTools Console 中，能夠透過 `<script>` 或動態載入成功取得 `effekseer` 全域物件（或模組匯入方式，依官方版本而定）。

### Step 1-2：Infrastructure – 建立 EffekseerRuntimeAdapter 雛型

- **對應層級**
  - `src/infrastructure/effect/EffekseerRuntimeAdapter.ts`
- **目標**
  - 包一層最小可用的 Adapter，把 Effekseer 的 init / load / play / stop / update / draw 封裝起來。
  - 先以「獨立 Canvas 疊加」為前提設計介面。
- **建議公開介面（暫定，可之後再擴充）**
  - `initWithCanvas(canvas: HTMLCanvasElement): Promise<void>`
  - `loadEffect(params: { id: string; url: string }): Promise<void>`
  - `play(params: { id: string }): void`
  - `stop(params: { id: string }): void`
  - `update(deltaTime: number): void`
  - `render(viewMatrix?: THREE.Matrix4, projectionMatrix?: THREE.Matrix4): void`
- **完成條件**
  - 有一個可在開發工具中呼叫、且不依賴 React 的 Adapter 類別或模組（可被未來 Use Case / Hook 使用）。

### Step 1-3：Presentation – SceneViewer 疊加 Effekseer Canvas

- **對應層級**
  - `src/presentation/features/scene-viewer/components/SceneViewer.tsx`
- **目標**
  - 在現有 Three.js / R3F Viewer 上方，新增一個透明 `<canvas>` 專門給 Effekseer 用。
- **工作項目**
  - 在 `SceneViewer` 容器外層加一層可以「重疊兩個 canvas」的結構，例如：
    - 一個包裹的 div，裡面放 R3F Canvas + Effekseer Canvas（絕對定位）。
  - 使用 `useRef` 取得 Effekseer Canvas DOM。
  - 在 `useEffect` 中呼叫 `EffekseerRuntimeAdapter.initWithCanvas`。
- **完成條件**
  - 畫面上可以看到 R3F 3D 場景 + 一個透明的 Effekseer Canvas 疊在上方（暫時還沒有特效畫面也沒關係）。

### Step 1-4：Presentation – 接上基本 update / render 迴圈

- **目標**
  - 在 R3F 的 `useFrame` 或等效的 render loop 中，幫 Effekseer 做 `update` 與 `render`。
- **工作項目**
  - 在 `SceneViewer` 中，透過 `useFrame((state, delta) => { ... })`：
    - 呼叫 `effekseerRuntimeAdapter.update(delta)`。
    - 呼叫 `effekseerRuntimeAdapter.render()`。
  - Phase 1 可以先不傳相機矩陣（或暫時用預設值），只要能顯示特效即可。
- **完成條件**
  - 不論特效有沒有載入，只要畫面在跑，就會定期呼叫 Effekseer 的 `update` 與 `draw`，且不會造成錯誤或明顯效能問題。

### Step 1-5：簡易 UI – 載入單一特效 + Play / Stop / Loop

- **對應層級**
  - Presentation：在右邊功能列 新增一個 特效(efk) 區塊（例如 `SceneToolbar` 或一個暫時的「Effect Debug」區）。
- **目標**
  - 提供最小 UI：
    - 匯入一個 `.efk` 檔。
    - 按下 Play / Stop / Loop 按鈕控制播放。
- **工作項目**
  - 建立一個簡易 React 組件（未必是最終 EffectPanel，只是 MVP 控制器）：
    - 檔案選擇 / 拖放，取得單一檔案 URL。
    - 呼叫 `EffekseerRuntimeAdapter.loadEffect({ id: 'debugEffect', url })`。
    - 三個按鈕：
      - `Play` → `play({ id: 'debugEffect' })`
      - `Stop` → `stop({ id: 'debugEffect' })`
      - `Loop` → 可先用 Effekseer 內建的 loop 設定或重複 Play。
- **完成條件**
  - 實際匯入一個 efk 檔後，能在 Viewer 上看到特效播放，並可透過按鈕手動控制。
  - 這個時候 **尚未與 FBX 模型骨骼 / 時間線對齊**，純粹是「能看」的階段。

---

## Phase 2：骨骼綁定 + 動畫時間線同步

> 目標：讓 Effekseer 特效可以像 AudioTrigger 一樣，根據動畫 clip / currentTime 自動觸發，並綁在指定骨骼上跟著模型一起動。

### Step 2-1：Domain – 定義 Effect 相關 Value Objects

- **對應層級**
  - `src/domain/value-objects/`
- **目標**
  - 把 Effekseer 特效在「邏輯層」需要的資料結構定義出來，避免 UI / Infrastructure 直接綁死在 effekseer.js 的型別上。
- **建議新增 VO**
  - `EffectAsset`
  - `EffectAssetDependency`
  - `EffectBinding`
- **重點**
  - 僅描述「資料與行為語意」，不引用任何 Effekseer / Three.js 具體類別。
- **完成條件**
  - 有完整的 TypeScript 型別與文件註解（依專案規範），可被 Use Cases 與 Presentation 參照。

### Step 2-2：Domain Service – EffectTimelineService

- **對應層級**
  - `src/domain/services/`
- **目標**
  - 根據 `currentTime`、`clipId` 與多個 `EffectBinding`，計算出：
    - 目前時間點「哪些特效應該開始播放」
    - 目前時間點「哪些特效應該停止」
- **工作項目**
  - 定義輸入：
    - `currentTime` 或 `currentFrame`
    - `clipId`
    - `bindings: EffectBinding[]`
  - 定義輸出（例如）：
    - `effectsToPlay: { bindingId: string; effectId: string }[]`
    - `effectsToStop: { bindingId: string }[]`
- **完成條件**
  - 純函式或 service 類別，無任何 React / Three / Effekseer 相依。

### Step 2-3：Application – Use Cases（Load / Bind / Update）

- **對應層級**
  - `src/application/use-cases/`
- **目標**
  - 提供三個核心 Use Case，供 UI / SceneViewer 呼叫：
    - `LoadEffectLibraryUseCase`
    - `BindEffectToModelUseCase`
    - `UpdateEffectTimelineUseCase`
- **大致職責**
  - `LoadEffectLibraryUseCase.execute({ files, autoResolveDependencies })`
    - 從多個檔案建立 `EffectAsset[]`，並填入 `dependencies`。
  - `BindEffectToModelUseCase.execute(bindingInput)`
    - 檢查骨骼名稱、clip 是否存在，建立合法的 `EffectBinding`。
  - `UpdateEffectTimelineUseCase.execute({ currentTime, clipId, bindings })`
    - 使用 `EffectTimelineService`，回傳「要播 / 要停」的指令集。
- **完成條件**
  - Use Cases 以靜態 `execute()` 實作，並符合專案命名與文件註解規範。

### Step 2-4：Infrastructure – 擴充 EffekseerRuntimeAdapter 支援綁定與多實例

- **目標**
  - 讓 Adapter 能夠以 `bindingId` / `clipId` 等邏輯 ID 管理多個特效實例。
- **工作項目**
  - 規劃內部的 registry（可獨立成 `EffectInstanceRegistry` 或整合在 Adapter）：
    - `bindingId → Effekseer instance handle`
  - 提供介面：
    - `playForBinding(bindingId: string, effectId: string, worldMatrix: Matrix4): void`
    - `stopForBinding(bindingId: string): void`
    - `updateInstanceTransform(bindingId: string, worldMatrix: Matrix4): void`
- **完成條件**
  - 從外部只需要知道 bindingId，就可以對應到正確的 Effekseer instance，並更新位置。

### Step 2-5：Presentation – SceneViewer 接上骨骼位置與時間線

- **對應層級**
  - `SceneViewer` + 既有的 `useBoneExtraction` / 動畫時間更新機制。
- **目標**
  - 在每幀：
    - 取得目前播放的 `clipId` 與 `currentTime`。
    - 呼叫 `UpdateEffectTimelineUseCase.execute(...)`。
    - 將結果轉換為對 EffekseerRuntimeAdapter 的 play/stop 呼叫。
    - 將骨骼 world matrix + offset 傳給 Adapter 更新實例位置。
- **工作項目**
  - 整合 App 層已有的「動畫時間同步給 Audio」邏輯，擴充讓特效也能收到 `currentTime`。
  - 使用 `useBoneExtraction` 每幀更新骨骼世界座標：
    - 根據 `EffectBinding.targetBoneName` 找到對應骨骼。
    - 套用 `positionOffset / rotationOffset / scale`。
    - 組成 worldMatrix 傳給 Adapter。
- **完成條件**
  - 指定一個動畫 clip + 一組 EffectBinding 後：
    - 播放動畫時，特效會在對的時間自動出現 / 消失。
    - 特效會跟隨指定骨骼移動，並套用 offset。

### Step 2-6：Presentation – 初版 EffectPanel UI

- **對應層級**
  - `presentation/features/effect-panel/components/EffectPanel.tsx`（新檔案）
- **目標**
  - 提供與 AudioPanel / MaterialShaderTool 風格一致的「字卡式」 Effect 綁定 UI。
- **工作項目（初版即可）**
  - 顯示已載入的 `EffectAsset` 清單。
  - 可以新增 / 編輯 / 刪除 `EffectBinding`：
    - 選擇特效（EffectAsset）
    - 選擇綁定骨骼（從骨骼列表）
    - 選擇 clipId
    - 設定 startFrame / durationFrame / isLoop
    - 調整 position / rotation / scale offset
- **完成條件**
  - 透過 UI 配置的 binding，能直接驅動 SceneViewer 裡的特效表現。

---

## Phase 3：專業級體驗與整合優化

> 目標：在已有功能基礎上，提升 UX、性能與與其他子系統（Audio / Shader）的協作體驗。

### Step 3-1：多特效 / 多 Preset 管理

- **目標**
  - 支援一組 `EffectPreset`，一次管理多個綁定，快速切換技能 / 狀態。
- **工作項目**
  - Domain：新增 `EffectPreset` VO（包含多個 `EffectBinding` 或其引用）。
  - Presentation：在 EffectPanel 中提供 Preset 清單與切換 UI。
- **完成條件**
  - 可以定義多組特效 preset，並在 Viewer 中快速切換。

### Step 3-2：與 AudioTrigger / Playlist 整合

- **目標**
  - 讓同一個動作可以同時觸發「音效 + 特效」。
- **工作項目**
  - 設計 `EffectTrigger` 結構（若需要），或在現有 Trigger 系統中擴充。
  - 在 Playlist / Timeline 中同時考慮 `clipId` 對 audio / effect 的觸發。
- **完成條件**
  - 當播放一段動作序列時，相同的 `clipId` 可以同時驅動音效與特效，時間對齊。

### Step 3-3：顏色 / 亮度對齊與 Shader Pipeline 調整

- **目標**
  - 讓 Effekseer 粒子效果在視覺上盡量接近現有 Matcap / PBR pipeline 的亮度與色相。
- **工作項目**
  - 參考：
    - `docs/model-brightness-alignment.md`
    - `docs/shader-color-matching-threejs.md`
  - 針對 Effekseer 的輸出顏色進行校正（可能在 Adapter 或 post-process 層處理）。
- **完成條件**
  - 在相同燈光 / 環境條件下，特效與模型的亮度落差在可接受範圍內，並有文件紀錄調整策略。

### Step 3-4：效能與平台相容性調優

- **目標**
  - 在多特效、多粒子情況下仍維持流暢 FPS，並確保主流瀏覽器相容。
- **工作項目**
  - 建立效能測試場景（多模型 + 多特效）。
  - 針對粒子數量、更新頻率、渲染順序進行 Profiling 與優化。
- **完成條件**
  - 在目標硬體 / 瀏覽器上通過基本效能指標，並有記錄效能建議（例如：最大同時特效數量）。

---

## 使用方式建議（你如何一步一步叫我做）

你可以照下面的順序，一步一步叫我幫你開發：

1. **從 Phase 1 開始**：
   - 先說：「我們來做 `Step 1-1`」，我會幫你準備 Effekseer Runtime 資源與基本載入方式。
   - 你驗收 OK 之後，再說：「下一步 `Step 1-2`」……以此類推。
2. **每一個 Step 完成後**：
   - 你可以在 VSCode / 瀏覽器實際跑跑看，有問題就直接截圖 / 貼錯誤訊息，我會在同一個 Step 裡幫你 Debug。
3. **Phase 1 全部完成後**：
   - 再一起進 Phase 2，開始把骨骼 / 時間線 / EffectPanel UI 串起來。

你只要告訴我：「現在要做：`Phase X - Step Y-Z`」，我就會依照這份文件的定義，幫你在對應的檔案與層級裡實作與調整。  


