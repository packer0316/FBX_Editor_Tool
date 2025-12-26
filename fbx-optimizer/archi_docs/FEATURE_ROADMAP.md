# 📋 功能發展路線圖（Feature Roadmap）

> **文件維護者**: JR.H  
> **建立日期**: 2025.12.26  
> **最後更新**: 2025.12.26  
> **狀態**: 規劃中

---

## 📊 專案現況分析

JR 3D Viewer 是一個功能豐富的 3D 模型檢視與動畫編輯工具，已實作的核心功能包括：

### ✅ 已實作功能

| 類別 | 功能 |
|------|------|
| **模型管理** | FBX 載入、多模型管理、Transform 控制、Wireframe、透明度調整 |
| **動畫系統** | 動畫播放、動畫優化、動畫片段創建、INI 匯入 |
| **Director Mode** | 時間軸編輯、多軌道、拖放片段、區間播放、吸附功能 |
| **程式化動畫** | FadeIn/FadeOut、MoveBy/ScaleTo、緩動效果 |
| **Shader 系統** | Matcap、Rim Light、Dissolve、Bleach、Flash 等效果 |
| **特效系統** | Effekseer 整合、骨骼綁定、動畫觸發器 |
| **音效系統** | 音效載入、觸發器、音量控制 |
| **2D 系統** | Layer 合成器、Spine 動畫整合 |
| **快照功能** | 視圖快照、Transform 快照 |
| **匯出功能** | GLB 模型匯出、Shader 配置匯出、音效配置匯出 |

---

## 🚀 建議新增功能（依優先級排序）

### 🔴 高優先級（High Priority）— 顯著提升使用體驗

#### 1. 專案儲存與載入（Project Save/Load）

**問題痛點**：
- 目前所有編輯狀態在頁面重新載入後會遺失
- 用戶需要重新設定 Shader、音效觸發、Director Mode 編排
- 無法分享專案給其他團隊成員

**建議實作**：
```typescript
interface ProjectFile {
  version: string;
  createdAt: string;
  updatedAt: string;
  
  // 模型資料（儲存路徑/設定，不儲存模型本身）
  models: {
    name: string;
    filePath?: string;  // 本地路徑（可選）
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    shaderGroups: ShaderGroup[];
    audioTracks: AudioTrack[];
    effects: EffectItem[];
    proceduralActions: ProceduralAction[];
  }[];
  
  // Director Mode 編排
  directorSession?: {
    fps: number;
    totalFrames: number;
    tracks: DirectorTrack[];
  };
  
  // 2D Layers
  layers?: Layer[];
  
  // Spine 實例
  spineInstances?: SpineInstance[];
  
  // 全域設定
  settings: {
    backgroundColor: string;
    cameraSettings: CameraSettings;
    // ...
  };
}
```

**功能清單**：
- [ ] 匯出專案為 `.jr3d` 檔案（JSON + ZIP 打包資源）
- [ ] 匯入專案檔案並恢復完整狀態
- [ ] 自動儲存草稿（LocalStorage / IndexedDB）
- [ ] 最近開啟的專案列表

**預估工作量**：5-8 小時

---

#### 2. Undo/Redo（撤銷/重做）

**問題痛點**：
- 誤刪 Clip、誤移動片段無法復原
- 複雜編輯操作缺乏安全網
- 專業編輯軟體的基本期望功能

**建議實作**：
- 使用 Zustand temporal middleware 或自訂歷史棧
- 追蹤重要操作：addClip, moveClip, removeClip, addTrack, removeTrack
- 不追蹤：播放狀態、UI 狀態（縮放、滾動）

**快捷鍵**：
| 快捷鍵 | 功能 |
|--------|------|
| `Ctrl + Z` | 撤銷 |
| `Ctrl + Y` / `Ctrl + Shift + Z` | 重做 |

**預估工作量**：4-6 小時

---

#### 3. 截圖與錄影功能（Screenshot & Recording）

**問題痛點**：
- 無法快速輸出模型預覽圖
- 無法錄製動畫為影片分享給非技術人員
- 需要第三方螢幕錄製工具

**建議實作**：

| 功能 | 說明 |
|------|------|
| **快速截圖** | 按下快捷鍵或點擊按鈕，截取當前畫面為 PNG |
| **自訂尺寸截圖** | 支援設定輸出解析度（如 1920x1080、4K） |
| **透明背景截圖** | 輸出 PNG 時保留 Alpha 通道 |
| **動畫錄影** | 錄製動畫播放為 WebM / GIF |
| **批次截圖** | 對多個快照位置自動截圖 |

**技術方案**：
- 截圖：`renderer.domElement.toDataURL()` 或 `canvas.toBlob()`
- 錄影：`MediaRecorder` API + Canvas capture

**預估工作量**：6-10 小時

---

#### 4. Director Mode 會話儲存/載入

**問題痛點**：
- Director Mode 的編排結果無法保存
- 重新開啟頁面需要重新排列所有片段
- 多人協作時無法分享編排

**建議實作**：
```typescript
interface DirectorSession {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  
  timeline: {
    fps: number;
    totalFrames: number;
  };
  
  tracks: DirectorTrack[];
  
  // 標記（未來功能）
  markers?: TimelineMarker[];
}
```

**功能清單**：
- [ ] 儲存當前 Director 編排為 JSON
- [ ] 載入 Director 編排檔案
- [ ] 快速切換多個編排版本
- [ ] 與專案儲存功能整合

**預估工作量**：3-4 小時

---

### 🟡 中優先級（Medium Priority）— 提升工作效率

#### 5. 片段速度調整（Clip Speed Control）

**問題痛點**：
- 無法加速或放慢特定動畫片段
- 需要編輯原始動畫檔案

**建議實作**：
- ClipBlock 右鍵選單添加「速度調整」選項
- 雙擊 ClipBlock 開啟詳細設定面板
- 支援 0.1x ~ 4.0x 速度範圍
- 片段長度根據速度自動計算

**注意事項**：
- 已有 `DirectorClip.speed` 欄位，需實作 UI 和播放邏輯
- 調整速度後 endFrame 需重新計算

**預估工作量**：3-4 小時

---

#### 6. 時間軸標記系統（Timeline Markers）

**問題痛點**：
- 無法標記重要時間點（如特效觸發點、音效同步點）
- 難以在時間軸上快速導航到關鍵幀

**建議實作**：
```typescript
interface TimelineMarker {
  id: string;
  frame: number;
  label: string;
  color: string;
  icon?: string;  // emoji 或 icon name
}
```

**功能清單**：
- [ ] 在當前播放頭位置添加標記（快捷鍵 `M`）
- [ ] 標記顯示在 TimelineRuler 上
- [ ] 點擊標記跳轉到該幀
- [ ] 編輯/刪除標記
- [ ] 標記隨 Director Session 儲存

**預估工作量**：4-5 小時

---

#### 7. 多選片段與批次操作（Multi-Select Clips）

**問題痛點**：
- 一次只能選中一個片段
- 無法批次移動、刪除多個片段
- 複製多個片段到其他軌道很繁瑣

**建議實作**：
- `Ctrl + Click` 多選片段
- `Shift + Click` 範圍選擇
- 拖動選取框圈選
- 批次操作：移動、刪除、複製

**預估工作量**：6-8 小時

---

#### 8. Shader 預設模板（Shader Presets）

**問題痛點**：
- 每次都需要手動設定 Shader 參數
- 常用的 Shader 組合無法快速套用
- 不同模型難以保持一致風格

**建議實作**：
- 儲存當前 Shader 設定為預設模板
- 內建常用模板（遊戲角色、卡通風格、寫實風格）
- 一鍵套用模板到新模型
- 模板管理（重命名、刪除、匯出/匯入）

**預估工作量**：4-5 小時

---

### 🟢 低優先級（Low Priority）— 錦上添花

#### 9. 動畫曲線編輯器（Animation Curve Editor）

**問題痛點**：
- 程式化動畫的緩動曲線選擇有限
- 無法精確控制動畫過渡效果
- 高級用戶需要更細緻的控制

**建議實作**：
- 貝塞爾曲線編輯器 UI
- 預設曲線模板（Ease、Spring、Bounce 等）
- 曲線預覽動畫
- 自訂曲線儲存

**預估工作量**：8-12 小時

---

#### 10. 虛擬化軌道渲染（Virtualized Track Rendering）

**問題痛點**：
- 大量軌道時效能下降
- 滾動不流暢
- 記憶體佔用過高

**建議實作**：
- 只渲染可視區域的 TrackRow 和 ClipBlock
- 使用 `react-window` 或 `react-virtualized`
- 動態計算可視範圍

**注意事項**：
- 程式碼中已有 `TODO-7` 標記此功能
- 需確保拖放功能仍正常運作

**預估工作量**：4-6 小時

---

#### 11. 自訂快捷鍵（Customizable Hotkeys）

**問題痛點**：
- 快捷鍵固定無法更改
- 不同用戶習慣不同的操作方式
- 某些快捷鍵可能與系統衝突

**建議實作**：
- 快捷鍵設定面板
- 衝突檢測
- 重設為預設值
- 設定隨專案或瀏覽器儲存

**預估工作量**：4-5 小時

---

#### 12. 效能分析面板增強（Enhanced Performance Monitor）

**問題痛點**：
- 現有效能監控資訊有限
- 難以診斷效能瓶頸
- 缺少歷史數據對比

**建議實作**：
- FPS 歷史圖表
- 記憶體使用趨勢
- Draw Call 詳細分解
- 紋理記憶體統計
- 效能警告提示

**預估工作量**：4-6 小時

---

#### 13. 批次匯出功能（Batch Export）

**問題痛點**：
- 多個模型需要逐一匯出
- 多個快照需要手動截圖
- 流程繁瑣耗時

**建議實作**：
- 選擇多個模型批次匯出 GLB
- 自動遍歷所有快照位置截圖
- 匯出進度指示
- 匯出完成通知

**預估工作量**：4-5 小時

---

## 📈 功能優先級矩陣

| 功能 | 影響力 | 實作難度 | 建議優先級 |
|------|--------|----------|------------|
| 專案儲存/載入 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 🔴 高 |
| Undo/Redo | ⭐⭐⭐⭐⭐ | ⭐⭐ | 🔴 高 |
| 截圖與錄影 | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🔴 高 |
| Director 會話儲存 | ⭐⭐⭐⭐ | ⭐⭐ | 🔴 高 |
| 片段速度調整 | ⭐⭐⭐ | ⭐⭐ | 🟡 中 |
| 時間軸標記 | ⭐⭐⭐ | ⭐⭐ | 🟡 中 |
| 多選片段 | ⭐⭐⭐ | ⭐⭐⭐ | 🟡 中 |
| Shader 預設模板 | ⭐⭐⭐ | ⭐⭐ | 🟡 中 |
| 曲線編輯器 | ⭐⭐ | ⭐⭐⭐⭐ | 🟢 低 |
| 虛擬化渲染 | ⭐⭐ | ⭐⭐⭐ | 🟢 低 |
| 自訂快捷鍵 | ⭐⭐ | ⭐⭐ | 🟢 低 |
| 效能分析增強 | ⭐⭐ | ⭐⭐⭐ | 🟢 低 |
| 批次匯出 | ⭐⭐ | ⭐⭐ | 🟢 低 |

---

## 🎯 建議開發順序

### Phase 1：核心體驗提升（1-2 週）

1. **Undo/Redo** — 基礎編輯安全網
2. **Director 會話儲存/載入** — 保護編輯成果
3. **截圖功能** — 快速輸出預覽

### Phase 2：專業功能完善（1-2 週）

4. **專案儲存/載入** — 完整工作流程支援
5. **片段速度調整** — 補完 Director Mode 功能
6. **時間軸標記** — 增強導航效率

### Phase 3：進階功能（2-3 週）

7. **多選片段** — 批次操作能力
8. **Shader 預設模板** — 加速工作流程
9. **錄影功能** — 完整輸出方案

### Phase 4：優化與擴展（持續進行）

10. 虛擬化渲染
11. 曲線編輯器
12. 其他增強功能

---

## 📝 附註

### 與現有架構的整合考量

- **狀態管理**：建議將專案/會話儲存功能與 Zustand Store 整合
- **檔案格式**：優先使用 JSON 格式，方便調試和版本控制
- **向後兼容**：新版本應能讀取舊版本的專案檔案
- **效能考量**：大型專案檔案考慮分塊載入

### 技術債務

在實作新功能前，建議先處理以下已標記的 TODO：
- `TODO-7`：虛擬化軌道渲染
- `TODO-8`：縮放動畫過渡
- `TODO-9`：縮放視覺回饋
- `TODO-10`：鍵盤縮放倍率優化

---

*此文檔將隨開發進度持續更新*

