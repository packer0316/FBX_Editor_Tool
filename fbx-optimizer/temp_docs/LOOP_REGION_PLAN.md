# 區間播放（Loop Region）功能實作計劃

> **建立日期**: 2025.12.02  
> **完成日期**: 2025.12.03  
> **狀態**: ✅ 已完成

---

## 📋 功能概述

在導演模式時間軸上添加「區間播放」功能，讓用戶可以設定 In/Out 點，播放時只在指定區間內循環。

---

## 🎬 業界 UX 參考分析

### Premiere Pro / DaVinci Resolve
- **快捷鍵**：`I` 設定入點、`O` 設定出點
- **視覺**：時間軸刻度尺上顯示藍色/黃色區間條
- **行為**：播放時在區間內循環（需開啟 Loop）
- **清除**：`Option/Alt + X` 清除入出點

### After Effects
- **工作區域（Work Area）**：時間軸上方的可拖曳區域條
- **拖曳調整**：可拖曳左右邊界或整體移動
- **預覽**：RAM Preview 只渲染工作區域

### 共通 UX 模式
1. **視覺反饋**：在時間軸頂部顯示區間條
2. **快捷鍵操作**：I/O 設定，快捷鍵清除
3. **拖曳調整**：可拖曳邊界微調
4. **播放邏輯**：Loop 開啟時在區間內循環

---

## 🎯 設計方案

### UX 設計

#### 時間軸區間條
```
時間軸刻度尺區域（TimelineRuler 上方）：
┌──────────────────────────────────────────────────────────────────────┐
│ 0:00    0:10       0:20       0:30       0:40       0:50    1:00     │
│ ├────────┼──────────┼──────────┼──────────┼──────────┼────────┤     │
│          ├══════════════════════════════════╡                        │
│          │◀ In Point         Out Point ▶│   ← 區間條（半透明藍色）  │
│          └══════════════════════════════════┘                        │
└──────────────────────────────────────────────────────────────────────┘
```

#### 底部控制列（PlaybackControls 右側新增）
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [⏮][▶][⏹][⏭] [🔁]  │  00:13:14 / 01:11:15  │  Frame:[404] FPS:[30] Total:[2145] │
│                      │                        │                                    │
│                      │   ┌──────────────────────────────────────┐              │
│                      │   │ [🔄] In: [00:05:00]  Out: [00:25:00] │ ← 新增區域   │
│                      │   └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘

[🔄] = 區間播放開關按鈕（Region Loop Toggle）
[00:05:00] = 可編輯的時間輸入框
```

### 底部 UI 元素說明

| 元素 | 說明 |
|------|------|
| **區間開關按鈕** | 開啟/關閉區間播放功能，圖標可用 `Scissors` 或自訂 |
| **In 輸入框** | 顯示/編輯入點時間（格式：MM:SS:FF） |
| **Out 輸入框** | 顯示/編輯出點時間（格式：MM:SS:FF） |

### 操作方式

| 操作 | 方式 | 說明 |
|------|------|------|
| 開啟/關閉區間播放 | 點擊區間開關按鈕 | 切換區間播放功能 |
| 設定入點 | `I` 快捷鍵 | 在當前幀設定 In Point |
| 設定出點 | `O` 快捷鍵 | 在當前幀設定 Out Point |
| 手動輸入時間 | 直接編輯 In/Out 輸入框 | 精確設定入出點 |
| 清除區間 | `Alt + X` 或雙擊區間條 | 清除入出點 |
| 調整邊界 | 拖曳區間條左/右邊緣 | 微調入出點位置 |
| 移動區間 | 拖曳區間條中央 | 平移整個區間 |
| 跳到入點 | `Shift + I`（可選） | 播放頭跳到入點 |
| 跳到出點 | `Shift + O`（可選） | 播放頭跳到出點 |

### 播放邏輯

```
播放時：
1. 如果 loopRegion.enabled && inPoint && outPoint 都有值
   → 播放到 outPoint 後跳回 inPoint 繼續
2. 如果只設定了 inPoint
   → 從 inPoint 開始播放到 totalFrames
3. 如果只設定了 outPoint
   → 從 0 播放到 outPoint
4. 如果沒有設定區間
   → 正常播放（0 到 totalFrames）
```

### 視覺設計

- **區間條顏色**：半透明藍色 `bg-blue-500/30`
- **邊界手柄**：白色/亮色小三角或矩形，hover 時高亮
- **入點標記**：左側黃色三角 `▶`
- **出點標記**：右側黃色三角 `◀`
- **區間文字**：可選顯示區間長度

---

## 📁 需要修改的檔案

### 1. 類型定義
**檔案**：`src/domain/entities/director/director.types.ts`

```typescript
// 新增
export interface LoopRegion {
  /** 入點幀數（null 表示未設定） */
  inPoint: number | null;
  
  /** 出點幀數（null 表示未設定） */
  outPoint: number | null;
  
  /** 是否啟用區間播放（有入出點時自動啟用） */
  enabled: boolean;
}

// 修改 TimelineState
export interface TimelineState {
  // ...existing
  loopRegion: LoopRegion;
}
```

### 2. Zustand Store
**檔案**：`src/presentation/stores/directorStore.ts`

```typescript
// 新增 Actions
setInPoint: (frame: number | null) => void;
setOutPoint: (frame: number | null) => void;
clearLoopRegion: () => void;
setLoopRegionEnabled: (enabled: boolean) => void;

// 新增初始狀態
const initialTimelineState: TimelineState = {
  // ...existing
  loopRegion: {
    inPoint: null,
    outPoint: null,
    enabled: true,  // 預設啟用（有入出點時生效）
  },
};
```

### 3. 播放邏輯
**檔案**：`src/presentation/features/director/hooks/useTimelinePlayback.ts`

```typescript
// 修改 onTick 邏輯
directorEventBus.onTick(({ delta }) => {
  const { loopRegion, totalFrames, isLooping } = state.timeline;
  
  let newFrame = frameRef.current + delta * fps;
  
  // 區間播放邏輯
  const effectiveStart = loopRegion.enabled && loopRegion.inPoint !== null 
    ? loopRegion.inPoint 
    : 0;
  const effectiveEnd = loopRegion.enabled && loopRegion.outPoint !== null 
    ? loopRegion.outPoint 
    : totalFrames;
  
  if (newFrame >= effectiveEnd) {
    if (isLooping) {
      newFrame = effectiveStart + (newFrame - effectiveEnd);
    } else {
      newFrame = effectiveEnd;
      state.pause();
    }
  }
  // ...
});
```

### 4. 快捷鍵
**檔案**：`src/presentation/features/director/hooks/useKeyboardShortcuts.ts`

```typescript
// 新增快捷鍵處理
case 'i':
case 'I':
  e.preventDefault();
  setInPoint(timeline.currentFrame);
  break;

case 'o':
case 'O':
  e.preventDefault();
  setOutPoint(timeline.currentFrame);
  break;

case 'x':
case 'X':
  if (e.altKey) {
    e.preventDefault();
    clearLoopRegion();
  }
  break;
```

### 5. 區間條 UI 組件（新增）
**檔案**：`src/presentation/features/director/components/LoopRegionBar.tsx`

```tsx
interface LoopRegionBarProps {
  pixelsPerFrame: number;
  scrollOffsetX: number;
  containerWidth: number;
}

// 功能：
// - 顯示半透明區間條
// - 左右邊界可拖曳調整
// - 中央可拖曳平移
// - 雙擊清除
```

### 6. 整合到 TimelineEditor
**檔案**：`src/presentation/features/director/components/TimelineEditor.tsx`

```tsx
// 在 TimelineRuler 上方或重疊位置添加 LoopRegionBar
<div className="relative">
  <LoopRegionBar 
    pixelsPerFrame={pixelsPerFrame}
    scrollOffsetX={ui.scrollOffsetX}
    containerWidth={containerWidth}
  />
  <TimelineRuler ... />
</div>
```

### 7. 播放控制列 UI 更新
**檔案**：`src/presentation/features/director/components/PlaybackControls.tsx`

```tsx
// 新增區間播放控制區域（在現有 UI 右側或下方）
<div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-4">
  {/* 區間播放開關按鈕 */}
  <button
    onClick={toggleLoopRegionEnabled}
    className={`p-1.5 rounded transition-colors ${
      loopRegion.enabled && (loopRegion.inPoint !== null || loopRegion.outPoint !== null)
        ? 'bg-cyan-500/20 text-cyan-400'
        : 'hover:bg-white/10 text-gray-400 hover:text-white'
    }`}
    title="區間播放"
  >
    <Scissors size={16} />  {/* 或其他合適圖標 */}
  </button>
  
  {/* In Point 輸入框 */}
  <div className="flex items-center gap-1">
    <span className="text-xs text-gray-500">In:</span>
    <input
      type="text"
      value={formatFrameTime(loopRegion.inPoint ?? 0, fps)}
      onChange={handleInPointChange}
      placeholder="--:--:--"
      className="w-20 bg-black/30 border border-white/10 rounded px-2 py-1 
                 text-xs text-gray-300 text-center font-mono
                 focus:outline-none focus:border-cyan-500"
      disabled={!loopRegion.enabled}
    />
  </div>
  
  {/* Out Point 輸入框 */}
  <div className="flex items-center gap-1">
    <span className="text-xs text-gray-500">Out:</span>
    <input
      type="text"
      value={formatFrameTime(loopRegion.outPoint ?? timeline.totalFrames, fps)}
      onChange={handleOutPointChange}
      placeholder="--:--:--"
      className="w-20 bg-black/30 border border-white/10 rounded px-2 py-1 
                 text-xs text-gray-300 text-center font-mono
                 focus:outline-none focus:border-cyan-500"
      disabled={!loopRegion.enabled}
    />
  </div>
</div>
```

### 8. 快捷鍵提示更新
**檔案**：`src/presentation/features/director/hooks/useKeyboardShortcuts.ts`

```typescript
shortcuts: [
  // ...existing
  { key: 'I', description: '設定入點' },
  { key: 'O', description: '設定出點' },
  { key: 'Alt + X', description: '清除區間' },
],
```

---

## 🔧 實作順序

### Step 1：類型定義與 Store（基礎）
1. 在 `director.types.ts` 添加 `LoopRegion` 類型
2. 修改 `TimelineState` 添加 `loopRegion` 欄位
3. 在 `directorStore.ts` 添加相關 actions 和初始狀態

### Step 2：快捷鍵（快速驗證）
1. 在 `useKeyboardShortcuts.ts` 添加 I/O/Alt+X 處理
2. 更新快捷鍵提示列表
3. 測試快捷鍵設定入出點

### Step 3：播放邏輯（核心）
1. 修改 `useTimelinePlayback.ts` 的播放邊界邏輯
2. 測試區間循環播放

### Step 4：播放控制列 UI（按鈕 + 輸入框）
1. 在 `PlaybackControls.tsx` 添加區間播放開關按鈕
2. 添加 In/Out 時間輸入框
3. 實作時間格式解析和顯示

### Step 5：時間軸區間條（視覺）
1. 創建 `LoopRegionBar.tsx` 組件
2. 實作拖曳調整功能
3. 整合到 `TimelineEditor.tsx`

### Step 6：優化與細節
1. 輸入框 focus 時暫停快捷鍵
2. 區間長度顯示（可選）
3. 動畫過渡效果

---

## ⚠️ 注意事項

### 不改動現有 UI
- LoopRegionBar 作為獨立層疊加在 TimelineRuler 上
- 不修改 PlaybackControls 的按鈕佈局
- 不修改現有的 Loop 按鈕行為

### 邊界情況處理
- inPoint > outPoint 時自動交換
- inPoint/outPoint 超出 totalFrames 時 clamp
- 播放頭在區間外時，播放從 inPoint 開始

### 效能考量
- LoopRegionBar 使用 React.memo
- 拖曳時使用 requestAnimationFrame 節流
- 避免不必要的 store 更新

---

## 📊 預估工時

| 步驟 | 預估時間 |
|------|----------|
| Step 1: 類型與 Store | 15 分鐘 |
| Step 2: 快捷鍵 | 10 分鐘 |
| Step 3: 播放邏輯 | 20 分鐘 |
| Step 4: 播放控制列 UI | 25 分鐘 |
| Step 5: 時間軸區間條 | 40 分鐘 |
| Step 6: 優化 | 15 分鐘 |
| **總計** | **~2 小時** |

---

## ✅ 驗收標準

### 功能
- [ ] `I` 鍵在當前幀設定入點
- [ ] `O` 鍵在當前幀設定出點
- [ ] `Alt + X` 清除區間
- [ ] 播放時在區間內循環
- [ ] 快捷鍵提示已更新

### 底部控制列 UI
- [ ] 區間播放開關按鈕可切換功能
- [ ] In 輸入框顯示入點時間
- [ ] Out 輸入框顯示出點時間
- [ ] 可手動編輯 In/Out 時間
- [ ] 按鈕高亮顯示啟用狀態

### 時間軸區間條 UI
- [ ] 時間軸上顯示區間條
- [ ] 可拖曳區間邊界調整
- [ ] 可拖曳區間條平移
- [ ] 雙擊區間條清除

---

*確認計劃後即可開始實作*

