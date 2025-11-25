# Effekseer 整合與 3D 模型同步預覽規劃

> 目標：在現有 JR 3D Viewer / FBX Optimizer 中，提供「專業級特效預覽」能力，支援 Effekseer 效果載入、綁定到 3D 模型並隨動畫時間線同步播放，且符合既有 DDD 架構與程式風格。

---

## 1. 產品目標與定位

1. **主要目標**
   - 支援載入 Effekseer 專案/特效檔（`.efk`, `.efkefc`, `.efkp` 等）。
   - 能在現有的 3D 預覽框（`SceneViewer`）中，與 FBX 模型 **同一個視角、同一支相機** 同步預覽特效。
   - 特效能綁定到模型的骨骼 / 節點（例如：右手武器、腳底、頭頂）。
   - 能與動畫時間線同步（播放 / 暫停 / 抓 frame）進行精準對位。

2. **專業級預覽工具定位**
   - 面向美術與技術美術（TA），需要：
     - 可視化地調整特效的時間點、綁定點與參數。
     - 快速切換不同動畫（攻擊、待機、受擊）與特效組合。
     - 能觀察在實際遊戲用燈光 / shader pipeline 下的最終效果。

3. **非目標（第一階段不做）**
   - 不做 Effekseer 編輯器功能（關卡編輯、粒子樹狀結構修改）。
   - 不做 Runtime 匹配 Cocos/Unity/XR 完全一致的表現，只求「預覽接近」。
   - 不處理多機制網路同步，只專注本地預覽。

---

## 2. 使用情境與 User Flow

### 2.1 典型工作流程（卡片式 UI）

1. 使用者載入 FBX 模型與動畫。
2. 使用者在「特效面板」中：
   - 看到與 Material 面板一致風格的 **字卡式 UI**，每一張卡片代表一個特效綁定（`EffectBinding`）。
   - 透過拖放或按鈕匯入一組 Effekseer 專案或單一特效檔。
   - 從特效列表中選擇一個特效（例如：`SwordSlash01`），建立一張新的特效卡片。
3. 使用者在每一張「特效字卡」中（可展開 / 縮起）設定：
   - **骨骼綁定**：下拉選擇要掛在哪一個 bone（例如：`RightHand`），風格與音效面板一致。
   - **時間設定**：選擇對應動畫片段、開始時間（frame 或秒）、持續時間 `duration`、`isLoop`（單次或迴圈），行為與音效觸發邏輯一致。
   - **Transform 調整**：針對該 efk 單獨調整：
     - `positionOffset`（x/y/z）
     - `rotationOffset`（x/y/z，度數或弧度）
     - `scale`（x/y/z 或 uniform）
4. 使用者在時間線拖動 / 播放模型動畫：
   - Effekseer 特效會依照每張卡片的時間設定自動啟動 / 停止，並依照 `isLoop` 控制是否重複播放。
   - 特效位置會跟隨骨骼移動（例如武器揮動時特效尾巴跟著走），同時疊加卡片上設定的 `positionOffset` / `rotationOffset` / `scale`。
5. 使用者可以：
   - 透過卡片右上角的開關，單獨啟用 / 停用某個特效字卡。
   - 透過群組開關，快速開關一整組特效 preset。
   - 截圖 / 錄影作為確認輸出。

---

## 3. 技術選型與整合策略

### 3.1 Effekseer Web Runtime

預期採用 **Effekseer for WebGL**：
- 透過官方 `effekseer.min.js` + WebAssembly（`.wasm`）載入 Runtime。
- 支援載入多種 Effekseer 資產與其關聯檔案：
  - 主特效檔：`.efk`, `.efkefc`, `.efkp`
  - 材質設定檔：`.efkmat`
  - 貼圖資源：`.png`, `.jpg` 等
- 提供 API：
  - 初始化（`effekseer.init`）
  - 載入特效（`effekseer.loadEffect`）
  - 建立播放實例（`play` / `stop` / `setLocation` / `setRotation` / `setScale`）
  - 每幀更新與描畫（`update` / `draw`）

> 需求補充：當使用者匯入一個 efk 時，系統需要 **解析出該特效所需的關聯檔（efkmat、貼圖等）**，並支援：
> - 一次把整個資料夾丟進來「全部匯入」。
> - 或者先只匯入 efk，系統列出缺少的關聯檔，讓使用者再分批匯入補齊。

### 3.2 與 Three.js / React Three Fiber 的整合策略

有兩種主要策略：

1. **共用 WebGL context（推薦，長期目標）**
   - 使用 R3F / three.js 已存在的 `WebGLRenderer.getContext()`。
   - 將此 context 傳給 Effekseer Runtime 建立 `EffekseerRenderer`。
   - 讓 Effekseer 在同一個 Canvas、同一組相機矩陣下渲染粒子。

2. **獨立 Canvas 疊加（短期可選方案）**
   - 在 3D Viewer 上方疊一層透明 `<canvas>` 給 Effekseer。
   - 手動同步相機與投影矩陣。
   - 優點：實作較快，與現有 R3F 場景耦合較低。

建議規劃：
- **Phase 1**：可以先用「獨立 Canvas 疊加」快速打通功能。
- **Phase 2**：再升級為「共用 WebGL context」以獲得更佳效能與正確 Z-order。

---

## 4. 架構設計（對應 DDD 分層）

### 4.1 Domain Layer（`src/domain`）

**新 Value Objects（草案）**

1. `EffectAsset`  
   - 描述一個可用的 Effekseer 特效資源（不含實際 Runtime 物件）。
   - 欄位示意：
     - `id: string`（唯一 ID）
     - `name: string`
     - `fileName: string`（主特效檔，例如 `.efk`）
     - `tags: string[]`
     - `dependencies: EffectAssetDependency[]`（此特效所需的關聯檔資訊）

2. `EffectAssetDependency`
   - 描述某一個特效所依賴的單一外部檔案。
   - 欄位示意：
     - `type: 'material' | 'texture' | 'sound' | 'model' | 'other'`
     - `fileName: string`（例如：`slash_01.efkmat`、`slash_tex_01.png`）
     - `isLoaded: boolean`（目前是否已被成功匯入並綁定）
     - `sourcePath?: string`（實際載入路徑或 Blob URL，供 Infrastructure 使用）

3. `EffectBinding`
   - 描述「某個特效如何綁定到模型與動畫」的資料，對應 UI 上的一張字卡。
   - 欄位示意：
     - `effectId: string`（對應 `EffectAsset.id`）
     - `targetBoneName: string`（從骨骼列表選擇，UI 行為與音效 bone 選擇一致）
     - `positionOffset: { x: number; y: number; z: number }`（每張 efk 卡可單獨調整）
     - `rotationOffset: { x: number; y: number; z: number }`（以度數或弧度配置，UI 提供滑桿 / 輸入框）
     - `scale: { x: number; y: number; z: number }`（支持 uniform 縮放，UI 可提供「鎖定比例」）
     - `clipId: string`（對應動畫片段 ID，沿用 `IdentifiableClip` 系統）
     - `startFrame: number`（或對應秒數，由 UI 負責 frame↔time 換算）
     - `durationFrame?: number`
     - `isLoop: boolean`（是否迴圈播放，語意與音效的 loop 一致）

4. （選擇性）`EffectPreset`
   - 一組特效與多個綁定的集合，用於快速切換某個技能/狀態的整組特效。

**新 Domain Services（可選）**

1. `EffectTimelineService`
   - 根據 `currentTime`（或 frame）、`EffectBinding` 列表，計算出在當前時間「應該啟動 / 停止哪些特效實例」。
   - 輸出一組簡單指令：
     - `effectsToPlay: { effectId; bindingId; instanceId? }[]`
     - `effectsToStop: { bindingId | instanceId }[]`

> Domain 不直接處理 Effekseer Runtime，只處理「時間與邏輯」。

---

### 4.2 Application Layer（`src/application/use-cases`）

**建議新增 Use Cases**

1. `LoadEffectLibraryUseCase`
   - 負責：從檔案或資料夾載入多個 Effekseer 資源，建立 `EffectAsset` 清單，並分析每個特效對關聯檔的需求。
   - 雙向輸入/輸出：
     - `execute(params: { files: File[]; autoResolveDependencies: boolean }): Promise<EffectAsset[]>`
   - 行為說明：
     - 掃描 `files` 中所有 efk/efkefc/efkp，為每一個建立對應的 `EffectAsset`。
     - 解析特效檔中的 metadata 或路徑資訊，推導出對應的 `.efkmat`、貼圖檔等，填入 `EffectAsset.dependencies`。
     - 若 `autoResolveDependencies = true`：
       - 嘗試在同一批 `files` 或相同資料夾層級自動找到所有關聯檔，並標記 `isLoaded = true`。
     - 若 `autoResolveDependencies = false`：
       - 僅建立 dependency 列表但不強迫全部存在，未找到的標記為 `isLoaded = false`，交由 UI 提示使用者後續匯入。

2. `BindEffectToModelUseCase`
   - 負責：建立 / 更新 `EffectBinding`。
   - 包含檢查：
     - 骨骼名稱是否存在於目前模型中。
     - 動畫片段是否存在、時間範圍是否合法。

3. `UpdateEffectTimelineUseCase`
   - 負責：在每次動畫時間更新時，決定特效播放指令。
   - 使用 `EffectTimelineService`：
     - `execute(params: { currentTime; clipId; bindings: EffectBinding[] }): EffectTimelineCommand`

4. `ToggleEffectPreviewUseCase`
   - 負責：開關單一或多個特效的預覽開關（例如只看武器特效、不看腳底灰塵）。

> Use Cases 僅輸出「要播什麼 / 停什麼」的抽象指令，實際執行交給 Infrastructure（EffekseerAdapter）。

---

### 4.3 Infrastructure Layer（`src/infrastructure`）

新增命名空間：`src/infrastructure/effect/`

1. `EffekseerRuntimeAdapter.ts`
   - 任務：
     - 負責載入 `effekseer.min.js` / `.wasm`，初始化 Runtime。
     - 管理解耦：
       - 不直接暴露第三方 API 給 Presentation / Application。
       - 對外只提供 TypeScript 介面，例如：
         - `initWithWebGLContext(gl: WebGLRenderingContext, canvas: HTMLCanvasElement): Promise<void>`
         - `loadEffect(asset: EffectAsset, url: string): Promise<void>`
         - `play(bindingId: string, worldMatrix: Matrix4): EffectInstanceHandle`
         - `stop(bindingId: string | EffectInstanceHandle): void`
         - `update(deltaTime: number): void`
         - `render(viewMatrix: Matrix4, projectionMatrix: Matrix4): void`

2. `EffectInstanceRegistry.ts`（可與 Adapter 結合）
   - 管理特效實例與 `bindingId` / `clipId` 之間的關聯。
   - 提供：
     - 依 `bindingId` 找到目前活躍的特效實例。
     - 在 Use Case 發出指令時，真正對 Effekseer 執行 `play/stop`。

> Infrastructure 隔離 Effekseer 與其他層，未來若更換特效引擎（例如 Cocos 原生粒子）時，可以替換實作。

---

### 4.4 Presentation Layer（`src/presentation`）

#### 4.4.1 3D Viewer 整合（`SceneViewer`）

1. **新增 Effekseer 渲染流程 Hook**
   - 在 `SceneViewer` 中：
     - 取得 WebGL context 與相機矩陣。
     - 在每幀 `useFrame`：
       - 呼叫 `EffekseerRuntimeAdapter.update(deltaTime)`;
       - 呼叫 `EffekseerRuntimeAdapter.render(viewMatrix, projectionMatrix)`.

2. **骨骼 / 節點的位置同步**
   - 已有 `useBoneExtraction` 取得骨骼資訊，可在 `SceneViewer`：
     - 每幀根據 `EffectBinding`：
       - 查詢對應骨骼的 world matrix。
       - 套用 `positionOffset / rotationOffset / scale`。
       - 將結果傳給 `EffekseerRuntimeAdapter` 更新特效實例位置。

3. **動畫時間同步**
   - 利用現有 `onTimeUpdate` 機制（目前用在 AudioSync）。
   - 在 `App.tsx` 中：
     - 將 `currentTime`、`currentClipId` 傳給新的 Effect Use Case。
   - 用戶拖動進度條 / 播放 / 暫停時，特效預覽跟著同步。

#### 4.4.2 新 UI 模組：Effect Panel（字卡式 UI，與 Material / Audio 一致）

新增 Feature：`presentation/features/effect-panel/components/EffectPanel.tsx`

**整體 UI 風格**
- 延續目前 **MaterialShaderTool** 與 **AudioPanel** 的設計語言：
  - 每個特效綁定使用一張可展開 / 縮起的 **字卡（Card）**。
  - 卡片標題列顯示：特效名稱、綁定骨骼名稱、簡短時間資訊（例如：`Attack_01 @ 0.33s / 20f`）。
  - 右側提供卡片層級的啟用開關（Enable/Disable）與刪除按鈕。

**主要職責**

1. **特效資源管理**
   - 顯示已載入的 `EffectAsset` 清單。
   - 支援：
     - 匯入檔案（拖放 / 按鈕），一次可以丟整個資料夾或多檔：
       - 模式 A：**全部匯入**（建議給 TA 使用）。勾選「自動解析關聯檔」，內部以 `autoResolveDependencies = true` 呼叫 Use Case，盡可能一次抓齊 efk + efkmat + png。
       - 模式 B：**分批匯入**。先匯入 efk，系統列出缺少的 efkmat / png 清單，使用者之後再拖入這些檔案補齊。
     - 篩選 / 搜尋（依名稱 / 標籤）。
   - 針對每一個 `EffectAsset` 顯示關聯檔狀態：
     - 已就緒（所有 dependencies `isLoaded = true`）。
     - 部分缺失（用醒目顏色提示缺少的 efkmat / 貼圖名稱）。
   - 從清單中選擇特效時，建立對應的 `EffectBinding` 字卡。

2. **綁定設定 UI（每張字卡的展開內容）**
   - **基本資訊區**
     - 特效選擇下拉（`EffectAsset`）。
     - 綁定骨骼下拉（從模型骨骼列表），UI 操作與音效面板的 bone 選擇一致。
   - **時間設定區**
     - 動畫片段下拉選單（`IdentifiableClip` / `clipId`）。
     - `startFrame` / `startTime`（可切換輸入模式，底層仍以 frame 儲存）。
     - `durationFrame`（或直接顯示對應秒數）。
     - `isLoop` 切換（單次或迴圈播放，UX 與音效 loop 開關一致）。
   - **Transform 設定區**
     - `positionOffset`：x / y / z 三軸輸入（可用數值框 + 小幅 Slider），針對該 efk 單獨調整。
     - `rotationOffset`：x / y / z 三軸輸入（度數顯示，內部可轉換為弧度）。
     - `scale`：x / y / z 三軸輸入，提供「鎖定比例」勾選時同步調整三軸。

3. **預覽控制**
   - 全域開關：開關所有特效預覽（類似「Mute All」概念）。
   - 個別開關：每個綁定字卡一個 toggle，快速只關閉其中一個特效。
   - 未來可擴充：
     - 一鍵「只看這組特效」（Solo 功能，暫時關閉其他字卡）。
     - 不同 `EffectPreset` 的快速切換（多張卡片群組管理）。

---

## 5. 資料流與互動流程設計

### 5.1 特效載入流程

```text
使用者拖放 Effekseer 檔案
  ↓
EffectPanel → 呼叫 LoadEffectLibraryUseCase.execute(files)
  ↓
Use Case 驗證副檔名 / 命名，轉成 EffectAsset[]
  ↓
App.tsx 更新 state.effectAssets
  ↓
EffectPanel 顯示特效清單
```

### 5.2 綁定與時間線同步流程

```text
使用者在 EffectPanel 新增一個綁定
  ↓
EffectPanel 送出表單 → BindEffectToModelUseCase.execute(bindingInput)
  ↓
Use Case 驗證（骨骼存在 / clip 存在 / 時間範圍）
  ↓
返回 EffectBinding → App.tsx 更新 state.effectBindings
  ↓
SceneViewer 在 useFrame:
  - 讀取當前動畫 clipId / currentTime
  - 呼叫 UpdateEffectTimelineUseCase.execute({ currentTime, clipId, bindings })
  - 取得 effectsToPlay / effectsToStop 指令
  - 轉交 EffekseerRuntimeAdapter 實際 play/stop + 更新位移
```

### 5.3 與既有系統的整合點

1. **與 AudioSync 系統**
   - 類似 AudioTrigger，可在未來擴充 `EffectTrigger`，實現「音效與特效一起觸發」。
   - 第一階段可先僅依靠時間線控制，不必綁死在 AudioTrigger 上。

2. **與 Playlist / 動作序列**
   - `PlaylistUseCase` 已支持 `IdentifiableClip` 與 `clipId`。
   - `EffectBinding.clipId` 應使用同一套 ID 系統，確保在序列播放時仍能正確觸發特效。

3. **與 Shader / Lighting Pipeline**
   - Effekseer 使用自己的 shader pipeline，可能與現有 Matcap / PBR 有亮度差異。
   - 第一階段先確保能正常渲染與同步，之後再針對亮度 / 顏色做比對與微調。

---

## 6. 開發分階段計畫

### Phase 1：基礎整合（MVP）

目標：**能載入單一特效，手動播放，並大致跟模型一起看**。

1. Infrastructure
   - 實作 `EffekseerRuntimeAdapter`（初始化、載入特效、play/stop、update/render）。
   - 暫時使用「獨立 Canvas 疊加」方式整合 R3F。

2. Presentation
   - 在 `SceneViewer` 接上 Effekseer 的 update / render。
   - 提供簡單 UI：
     - 匯入一個特效檔。
     - 手動按鈕：Play / Stop / Loop。

3. 不做時間線 / 骨骼綁定，只先確認效能與兼容性。

### Phase 2：骨骼綁定 + 時間線同步

1. Domain
   - 建立 `EffectAsset` / `EffectBinding` VO。
   - 建立 `EffectTimelineService`。

2. Application
   - 實作 `LoadEffectLibraryUseCase`、`BindEffectToModelUseCase`、`UpdateEffectTimelineUseCase`。

3. Presentation
   - 新增 `EffectPanel` UI。
   - 在 `SceneViewer` 中：
     - 從骨骼取得 world matrix，套用 offset 傳給 Effekseer。
     - 利用現有動畫時間（`currentTime`）驅動 `UpdateEffectTimelineUseCase`。

### Phase 3：專業級體驗優化

1. 多特效 / 多 Preset 管理。
2. 與 AudioTrigger 整合，支援「特效 + 音效」同時觸發。
3. Snapshot / 錄影支援（方便美術做比較與審核）。
4. 顏色 / 亮度調整，與現有 shader pipeline 的對齊（可參考現有兩篇 shader / brightness 文檔）。

---

## 7. 風險與待決議事項

1. **Effekseer 版本與授權**
   - 需確認 Web Runtime 版本與專案在商用時的授權條款。

2. **效能與平台相容性**
   - 大量粒子特效可能影響 FPS，需要預先設計效能測試場景。
   - 需測試主流瀏覽器（Chromium / Firefox / Safari）與不同 GPU 的相容情況。

3. **顏色與亮度的一致性**
   - Effekseer 自身的 shader pipeline 可能與三方 PBR pipeline 有差異。
   - 後續需要再撰寫一份「Effekseer 顏色對齊策略」文檔，類似現有 `model-brightness-alignment.md`、`shader-color-matching-threejs.md`。

4. **與未來 Runtime 的對應**
   - 若遊戲最終是 Cocos / Unity / Unreal，需要確認：
     - Effekseer 在目標引擎中的表現與 Web Runtime 是否接近。
     - 是否需要額外 profile / preset 來模擬各個平台。

---

## 8. 總結

- 此規劃文件定義了 Effekseer 在 FBX Optimizer 中的 **角色、流程與分層架構**，確保未來開發可以分階段推進且容易維護。
- 建議先依照 Phase 1 快速打通「單特效 + 3D Viewer」預覽，再逐步引入骨骼綁定與時間線同步，最後再做顏色與專業級 UX 優化。

===============================================================================================================



# Effekseer 整合與 3D 模型同步預覽規劃

> 目標：在現有 JR 3D Viewer / FBX Optimizer 中，提供「專業級特效預覽」能力，支援 Effekseer 效果載入、綁定到 3D 模型並隨動畫時間線同步播放，且符合既有 DDD 架構與程式風格。

---

## 1. 產品目標與定位

1. **主要目標**
   - 支援載入 Effekseer 專案/特效檔（`.efk`, `.efkefc`, `.efkp` 等）。
   - 能在現有的 3D 預覽框（`SceneViewer`）中，與 FBX 模型 **同一個視角、同一支相機** 同步預覽特效。
   - 特效能綁定到模型的骨骼 / 節點（例如：右手武器、腳底、頭頂）。
   - 能與動畫時間線同步（播放 / 暫停 / 抓 frame）進行精準對位。

2. **專業級預覽工具定位**
   - 面向美術與技術美術（TA），需要：
     - 可視化地調整特效的時間點、綁定點與參數。
     - 快速切換不同動畫（攻擊、待機、受擊）與特效組合。
     - 能觀察在實際遊戲用燈光 / shader pipeline 下的最終效果。

3. **非目標（第一階段不做）**
   - 不做 Effekseer 編輯器功能（關卡編輯、粒子樹狀結構修改）。
   - 不做 Runtime 匹配 Cocos/Unity/XR 完全一致的表現，只求「預覽接近」。
   - 不處理多機制網路同步，只專注本地預覽。

---

## 2. 使用情境與 User Flow

### 2.1 典型工作流程（卡片式 UI）

1. 使用者載入 FBX 模型與動畫。
2. 使用者在「特效面板」中：
   - 看到與 Material 面板一致風格的 **字卡式 UI**，每一張卡片代表一個特效綁定（`EffectBinding`）。
   - 透過拖放或按鈕匯入一組 Effekseer 專案或單一特效檔。
   - 從特效列表中選擇一個特效（例如：`SwordSlash01`），建立一張新的特效卡片。
3. 使用者在每一張「特效字卡」中（可展開 / 縮起）設定：
   - **骨骼綁定**：下拉選擇要掛在哪一個 bone（例如：`RightHand`），風格與音效面板一致。
   - **時間設定**：選擇對應動畫片段、開始時間（frame 或秒）、持續時間 `duration`、`isLoop`（單次或迴圈），行為與音效觸發邏輯一致。
   - **Transform 調整**：針對該 efk 單獨調整：
     - `positionOffset`（x/y/z）
     - `rotationOffset`（x/y/z，度數或弧度）
     - `scale`（x/y/z 或 uniform）
4. 使用者在時間線拖動 / 播放模型動畫：
   - Effekseer 特效會依照每張卡片的時間設定自動啟動 / 停止，並依照 `isLoop` 控制是否重複播放。
   - 特效位置會跟隨骨骼移動（例如武器揮動時特效尾巴跟著走），同時疊加卡片上設定的 `positionOffset` / `rotationOffset` / `scale`。
5. 使用者可以：
   - 透過卡片右上角的開關，單獨啟用 / 停用某個特效字卡。
   - 透過群組開關，快速開關一整組特效 preset。
   - 截圖 / 錄影作為確認輸出。

---

## 3. 技術選型與整合策略

### 3.1 Effekseer Web Runtime

預期採用 **Effekseer for WebGL**：
- 透過官方 `effekseer.min.js` + WebAssembly（`.wasm`）載入 Runtime。
- 支援載入多種 Effekseer 資產與其關聯檔案：
  - 主特效檔：`.efk`, `.efkefc`, `.efkp`
  - 材質設定檔：`.efkmat`
  - 貼圖資源：`.png`, `.jpg` 等
- 提供 API：
  - 初始化（`effekseer.init`）
  - 載入特效（`effekseer.loadEffect`）
  - 建立播放實例（`play` / `stop` / `setLocation` / `setRotation` / `setScale`）
  - 每幀更新與描畫（`update` / `draw`）

> 需求補充：當使用者匯入一個 efk 時，系統需要 **解析出該特效所需的關聯檔（efkmat、貼圖等）**，並支援：
> - 一次把整個資料夾丟進來「全部匯入」。
> - 或者先只匯入 efk，系統列出缺少的關聯檔，讓使用者再分批匯入補齊。

### 3.2 與 Three.js / React Three Fiber 的整合策略

有兩種主要策略：

1. **共用 WebGL context（推薦，長期目標）**
   - 使用 R3F / three.js 已存在的 `WebGLRenderer.getContext()`。
   - 將此 context 傳給 Effekseer Runtime 建立 `EffekseerRenderer`。
   - 讓 Effekseer 在同一個 Canvas、同一組相機矩陣下渲染粒子。

2. **獨立 Canvas 疊加（短期可選方案）**
   - 在 3D Viewer 上方疊一層透明 `<canvas>` 給 Effekseer。
   - 手動同步相機與投影矩陣。
   - 優點：實作較快，與現有 R3F 場景耦合較低。

建議規劃：
- **Phase 1**：可以先用「獨立 Canvas 疊加」快速打通功能。
- **Phase 2**：再升級為「共用 WebGL context」以獲得更佳效能與正確 Z-order。

---

## 4. 架構設計（對應 DDD 分層）

### 4.1 Domain Layer（`src/domain`）

**新 Value Objects（草案）**

1. `EffectAsset`  
   - 描述一個可用的 Effekseer 特效資源（不含實際 Runtime 物件）。
   - 欄位示意：
     - `id: string`（唯一 ID）
     - `name: string`
     - `fileName: string`（主特效檔，例如 `.efk`）
     - `tags: string[]`
     - `dependencies: EffectAssetDependency[]`（此特效所需的關聯檔資訊）

2. `EffectAssetDependency`
   - 描述某一個特效所依賴的單一外部檔案。
   - 欄位示意：
     - `type: 'material' | 'texture' | 'sound' | 'model' | 'other'`
     - `fileName: string`（例如：`slash_01.efkmat`、`slash_tex_01.png`）
     - `isLoaded: boolean`（目前是否已被成功匯入並綁定）
     - `sourcePath?: string`（實際載入路徑或 Blob URL，供 Infrastructure 使用）

3. `EffectBinding`
   - 描述「某個特效如何綁定到模型與動畫」的資料，對應 UI 上的一張字卡。
   - 欄位示意：
     - `effectId: string`（對應 `EffectAsset.id`）
     - `targetBoneName: string`（從骨骼列表選擇，UI 行為與音效 bone 選擇一致）
     - `positionOffset: { x: number; y: number; z: number }`（每張 efk 卡可單獨調整）
     - `rotationOffset: { x: number; y: number; z: number }`（以度數或弧度配置，UI 提供滑桿 / 輸入框）
     - `scale: { x: number; y: number; z: number }`（支持 uniform 縮放，UI 可提供「鎖定比例」）
     - `clipId: string`（對應動畫片段 ID，沿用 `IdentifiableClip` 系統）
     - `startFrame: number`（或對應秒數，由 UI 負責 frame↔time 換算）
     - `durationFrame?: number`
     - `isLoop: boolean`（是否迴圈播放，語意與音效的 loop 一致）

4. （選擇性）`EffectPreset`
   - 一組特效與多個綁定的集合，用於快速切換某個技能/狀態的整組特效。

**新 Domain Services（可選）**

1. `EffectTimelineService`
   - 根據 `currentTime`（或 frame）、`EffectBinding` 列表，計算出在當前時間「應該啟動 / 停止哪些特效實例」。
   - 輸出一組簡單指令：
     - `effectsToPlay: { effectId; bindingId; instanceId? }[]`
     - `effectsToStop: { bindingId | instanceId }[]`

> Domain 不直接處理 Effekseer Runtime，只處理「時間與邏輯」。

---

### 4.2 Application Layer（`src/application/use-cases`）

**建議新增 Use Cases**

1. `LoadEffectLibraryUseCase`
   - 負責：從檔案或資料夾載入多個 Effekseer 資源，建立 `EffectAsset` 清單，並分析每個特效對關聯檔的需求。
   - 雙向輸入/輸出：
     - `execute(params: { files: File[]; autoResolveDependencies: boolean }): Promise<EffectAsset[]>`
   - 行為說明：
     - 掃描 `files` 中所有 efk/efkefc/efkp，為每一個建立對應的 `EffectAsset`。
     - 解析特效檔中的 metadata 或路徑資訊，推導出對應的 `.efkmat`、貼圖檔等，填入 `EffectAsset.dependencies`。
     - 若 `autoResolveDependencies = true`：
       - 嘗試在同一批 `files` 或相同資料夾層級自動找到所有關聯檔，並標記 `isLoaded = true`。
     - 若 `autoResolveDependencies = false`：
       - 僅建立 dependency 列表但不強迫全部存在，未找到的標記為 `isLoaded = false`，交由 UI 提示使用者後續匯入。

2. `BindEffectToModelUseCase`
   - 負責：建立 / 更新 `EffectBinding`。
   - 包含檢查：
     - 骨骼名稱是否存在於目前模型中。
     - 動畫片段是否存在、時間範圍是否合法。

3. `UpdateEffectTimelineUseCase`
   - 負責：在每次動畫時間更新時，決定特效播放指令。
   - 使用 `EffectTimelineService`：
     - `execute(params: { currentTime; clipId; bindings: EffectBinding[] }): EffectTimelineCommand`

4. `ToggleEffectPreviewUseCase`
   - 負責：開關單一或多個特效的預覽開關（例如只看武器特效、不看腳底灰塵）。

> Use Cases 僅輸出「要播什麼 / 停什麼」的抽象指令，實際執行交給 Infrastructure（EffekseerAdapter）。

---

### 4.3 Infrastructure Layer（`src/infrastructure`）

新增命名空間：`src/infrastructure/effect/`

1. `EffekseerRuntimeAdapter.ts`
   - 任務：
     - 負責載入 `effekseer.min.js` / `.wasm`，初始化 Runtime。
     - 管理解耦：
       - 不直接暴露第三方 API 給 Presentation / Application。
       - 對外只提供 TypeScript 介面，例如：
         - `initWithWebGLContext(gl: WebGLRenderingContext, canvas: HTMLCanvasElement): Promise<void>`
         - `loadEffect(asset: EffectAsset, url: string): Promise<void>`
         - `play(bindingId: string, worldMatrix: Matrix4): EffectInstanceHandle`
         - `stop(bindingId: string | EffectInstanceHandle): void`
         - `update(deltaTime: number): void`
         - `render(viewMatrix: Matrix4, projectionMatrix: Matrix4): void`

2. `EffectInstanceRegistry.ts`（可與 Adapter 結合）
   - 管理特效實例與 `bindingId` / `clipId` 之間的關聯。
   - 提供：
     - 依 `bindingId` 找到目前活躍的特效實例。
     - 在 Use Case 發出指令時，真正對 Effekseer 執行 `play/stop`。

> Infrastructure 隔離 Effekseer 與其他層，未來若更換特效引擎（例如 Cocos 原生粒子）時，可以替換實作。

---

### 4.4 Presentation Layer（`src/presentation`）

#### 4.4.1 3D Viewer 整合（`SceneViewer`）

1. **新增 Effekseer 渲染流程 Hook**
   - 在 `SceneViewer` 中：
     - 取得 WebGL context 與相機矩陣。
     - 在每幀 `useFrame`：
       - 呼叫 `EffekseerRuntimeAdapter.update(deltaTime)`;
       - 呼叫 `EffekseerRuntimeAdapter.render(viewMatrix, projectionMatrix)`.

2. **骨骼 / 節點的位置同步**
   - 已有 `useBoneExtraction` 取得骨骼資訊，可在 `SceneViewer`：
     - 每幀根據 `EffectBinding`：
       - 查詢對應骨骼的 world matrix。
       - 套用 `positionOffset / rotationOffset / scale`。
       - 將結果傳給 `EffekseerRuntimeAdapter` 更新特效實例位置。

3. **動畫時間同步**
   - 利用現有 `onTimeUpdate` 機制（目前用在 AudioSync）。
   - 在 `App.tsx` 中：
     - 將 `currentTime`、`currentClipId` 傳給新的 Effect Use Case。
   - 用戶拖動進度條 / 播放 / 暫停時，特效預覽跟著同步。

#### 4.4.2 新 UI 模組：Effect Panel（字卡式 UI，與 Material / Audio 一致）

新增 Feature：`presentation/features/effect-panel/components/EffectPanel.tsx`

**整體 UI 風格**
- 延續目前 **MaterialShaderTool** 與 **AudioPanel** 的設計語言：
  - 每個特效綁定使用一張可展開 / 縮起的 **字卡（Card）**。
  - 卡片標題列顯示：特效名稱、綁定骨骼名稱、簡短時間資訊（例如：`Attack_01 @ 0.33s / 20f`）。
  - 右側提供卡片層級的啟用開關（Enable/Disable）與刪除按鈕。

**主要職責**

1. **特效資源管理**
   - 顯示已載入的 `EffectAsset` 清單。
   - 支援：
     - 匯入檔案（拖放 / 按鈕），一次可以丟整個資料夾或多檔：
       - 模式 A：**全部匯入**（建議給 TA 使用）。勾選「自動解析關聯檔」，內部以 `autoResolveDependencies = true` 呼叫 Use Case，盡可能一次抓齊 efk + efkmat + png。
       - 模式 B：**分批匯入**。先匯入 efk，系統列出缺少的 efkmat / png 清單，使用者之後再拖入這些檔案補齊。
     - 篩選 / 搜尋（依名稱 / 標籤）。
   - 針對每一個 `EffectAsset` 顯示關聯檔狀態：
     - 已就緒（所有 dependencies `isLoaded = true`）。
     - 部分缺失（用醒目顏色提示缺少的 efkmat / 貼圖名稱）。
   - 從清單中選擇特效時，建立對應的 `EffectBinding` 字卡。

2. **綁定設定 UI（每張字卡的展開內容）**
   - **基本資訊區**
     - 特效選擇下拉（`EffectAsset`）。
     - 綁定骨骼下拉（從模型骨骼列表），UI 操作與音效面板的 bone 選擇一致。
   - **時間設定區**
     - 動畫片段下拉選單（`IdentifiableClip` / `clipId`）。
     - `startFrame` / `startTime`（可切換輸入模式，底層仍以 frame 儲存）。
     - `durationFrame`（或直接顯示對應秒數）。
     - `isLoop` 切換（單次或迴圈播放，UX 與音效 loop 開關一致）。
   - **Transform 設定區**
     - `positionOffset`：x / y / z 三軸輸入（可用數值框 + 小幅 Slider），針對該 efk 單獨調整。
     - `rotationOffset`：x / y / z 三軸輸入（度數顯示，內部可轉換為弧度）。
     - `scale`：x / y / z 三軸輸入，提供「鎖定比例」勾選時同步調整三軸。

3. **預覽控制**
   - 全域開關：開關所有特效預覽（類似「Mute All」概念）。
   - 個別開關：每個綁定字卡一個 toggle，快速只關閉其中一個特效。
   - 未來可擴充：
     - 一鍵「只看這組特效」（Solo 功能，暫時關閉其他字卡）。
     - 不同 `EffectPreset` 的快速切換（多張卡片群組管理）。

---

## 5. 資料流與互動流程設計

### 5.1 特效載入流程

```text
使用者拖放 Effekseer 檔案
  ↓
EffectPanel → 呼叫 LoadEffectLibraryUseCase.execute(files)
  ↓
Use Case 驗證副檔名 / 命名，轉成 EffectAsset[]
  ↓
App.tsx 更新 state.effectAssets
  ↓
EffectPanel 顯示特效清單
```

### 5.2 綁定與時間線同步流程

```text
使用者在 EffectPanel 新增一個綁定
  ↓
EffectPanel 送出表單 → BindEffectToModelUseCase.execute(bindingInput)
  ↓
Use Case 驗證（骨骼存在 / clip 存在 / 時間範圍）
  ↓
返回 EffectBinding → App.tsx 更新 state.effectBindings
  ↓
SceneViewer 在 useFrame:
  - 讀取當前動畫 clipId / currentTime
  - 呼叫 UpdateEffectTimelineUseCase.execute({ currentTime, clipId, bindings })
  - 取得 effectsToPlay / effectsToStop 指令
  - 轉交 EffekseerRuntimeAdapter 實際 play/stop + 更新位移
```

### 5.3 與既有系統的整合點

1. **與 AudioSync 系統**
   - 類似 AudioTrigger，可在未來擴充 `EffectTrigger`，實現「音效與特效一起觸發」。
   - 第一階段可先僅依靠時間線控制，不必綁死在 AudioTrigger 上。

2. **與 Playlist / 動作序列**
   - `PlaylistUseCase` 已支持 `IdentifiableClip` 與 `clipId`。
   - `EffectBinding.clipId` 應使用同一套 ID 系統，確保在序列播放時仍能正確觸發特效。

3. **與 Shader / Lighting Pipeline**
   - Effekseer 使用自己的 shader pipeline，可能與現有 Matcap / PBR 有亮度差異。
   - 第一階段先確保能正常渲染與同步，之後再針對亮度 / 顏色做比對與微調。

---

## 6. 開發分階段計畫

### Phase 1：基礎整合（MVP）

目標：**能載入單一特效，手動播放，並大致跟模型一起看**。

1. Infrastructure
   - 實作 `EffekseerRuntimeAdapter`（初始化、載入特效、play/stop、update/render）。
   - 暫時使用「獨立 Canvas 疊加」方式整合 R3F。

2. Presentation
   - 在 `SceneViewer` 接上 Effekseer 的 update / render。
   - 提供簡單 UI：
     - 匯入一個特效檔。
     - 手動按鈕：Play / Stop / Loop。

3. 不做時間線 / 骨骼綁定，只先確認效能與兼容性。

### Phase 2：骨骼綁定 + 時間線同步

1. Domain
   - 建立 `EffectAsset` / `EffectBinding` VO。
   - 建立 `EffectTimelineService`。

2. Application
   - 實作 `LoadEffectLibraryUseCase`、`BindEffectToModelUseCase`、`UpdateEffectTimelineUseCase`。

3. Presentation
   - 新增 `EffectPanel` UI。
   - 在 `SceneViewer` 中：
     - 從骨骼取得 world matrix，套用 offset 傳給 Effekseer。
     - 利用現有動畫時間（`currentTime`）驅動 `UpdateEffectTimelineUseCase`。

### Phase 3：專業級體驗優化

1. 多特效 / 多 Preset 管理。
2. 與 AudioTrigger 整合，支援「特效 + 音效」同時觸發。
3. Snapshot / 錄影支援（方便美術做比較與審核）。
4. 顏色 / 亮度調整，與現有 shader pipeline 的對齊（可參考現有兩篇 shader / brightness 文檔）。

---

## 7. 風險與待決議事項

1. **Effekseer 版本與授權**
   - 需確認 Web Runtime 版本與專案在商用時的授權條款。

2. **效能與平台相容性**
   - 大量粒子特效可能影響 FPS，需要預先設計效能測試場景。
   - 需測試主流瀏覽器（Chromium / Firefox / Safari）與不同 GPU 的相容情況。

3. **顏色與亮度的一致性**
   - Effekseer 自身的 shader pipeline 可能與三方 PBR pipeline 有差異。
   - 後續需要再撰寫一份「Effekseer 顏色對齊策略」文檔，類似現有 `model-brightness-alignment.md`、`shader-color-matching-threejs.md`。

4. **與未來 Runtime 的對應**
   - 若遊戲最終是 Cocos / Unity / Unreal，需要確認：
     - Effekseer 在目標引擎中的表現與 Web Runtime 是否接近。
     - 是否需要額外 profile / preset 來模擬各個平台。

---

## 8. 總結

- 此規劃文件定義了 Effekseer 在 FBX Optimizer 中的 **角色、流程與分層架構**，確保未來開發可以分階段推進且容易維護。
- 建議先依照 Phase 1 快速打通「單特效 + 3D Viewer」預覽，再逐步引入骨骼綁定與時間線同步，最後再做顏色與專業級 UX 優化。

