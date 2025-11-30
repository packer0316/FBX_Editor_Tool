# Director Mode 時間軸縮放問題分析與優化計畫

> 分析日期：2025-11-30  
> 相關檔案：`TimelineEditor.tsx`, `TimelineRuler.tsx`, `TrackRow.tsx`, `ClipBlock.tsx`, `Playhead.tsx`

---

## 📋 目錄

1. [問題描述](#問題描述)
2. [現有實作分析](#現有實作分析)
3. [問題根因分析](#問題根因分析)
4. [主流影音編輯器縮放行為參考](#主流影音編輯器縮放行為參考)
5. [優化 TODO List（含風險解決方案）](#優化-todo-list含風險解決方案)
6. [預期效果](#預期效果)

---

## 📝 問題描述

使用者反饋：在 Director Mode 中使用滑鼠滾輪對影軌進行縮放時，會出現「怪怪的」刷新問題，不符合主流影音編輯器的縮放體驗。

### 具體現象
- 縮放時畫面有明顯抖動/閃爍
- 滑鼠位置為中心的縮放效果不穩定
- 時間刻度尺與軌道內容可能出現短暫不同步
- 縮放體驗不夠平滑流暢

---

## 🔍 現有實作分析

### 1. 縮放核心邏輯 (`TimelineEditor.tsx`)

```typescript
// Line 16-17
const ZOOM_STEP = 0.1; // 每次縮放步進

// Line 26-27
const pixelsPerFrame = DEFAULT_PIXELS_PER_FRAME * ui.zoom;
const timelineWidth = timeline.totalFrames * pixelsPerFrame;

// Line 35-58: handleWheel
const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ui.zoom + delta));
  
  if (containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left + ui.scrollOffsetX;
    const frameAtMouse = mouseX / pixelsPerFrame;
    
    // 更新 zoom
    setZoom(newZoom);
    
    // 調整滾動位置以保持滑鼠位置不變
    const newPixelsPerFrame = DEFAULT_PIXELS_PER_FRAME * newZoom;
    const newScrollX = frameAtMouse * newPixelsPerFrame - (e.clientX - rect.left);
    setScrollOffset(Math.max(0, newScrollX), ui.scrollOffsetY);
  } else {
    setZoom(newZoom);
  }
}, [ui.zoom, ui.scrollOffsetX, ui.scrollOffsetY, pixelsPerFrame, setZoom, setScrollOffset]);
```

### 2. 時間刻度尺渲染 (`TimelineRuler.tsx`)

```typescript
// Line 24-35: 刻度間隔計算
const { majorInterval, minorInterval } = useMemo(() => {
  if (pixelsPerFrame >= 8) {
    return { majorInterval: fps, minorInterval: fps / 6 };
  } else if (pixelsPerFrame >= 4) {
    return { majorInterval: fps * 2, minorInterval: fps / 2 };
  } else if (pixelsPerFrame >= 2) {
    return { majorInterval: fps * 5, minorInterval: fps };
  } else {
    return { majorInterval: fps * 10, minorInterval: fps * 2 };
  }
}, [pixelsPerFrame, fps]);

// Line 69-74: 使用 CSS transform 偏移
<div
  className="absolute top-0 left-0 h-full"
  style={{
    width: totalFrames * pixelsPerFrame,
    transform: `translateX(-${scrollOffsetX}px)`,
  }}
>
```

### 3. 狀態管理 (`directorStore.ts`)

```typescript
// setZoom 和 setScrollOffset 是分開的 Action
setZoom: (zoom: number) => {
  set((state) => ({ ui: { ...state.ui, zoom: clampedZoom } }));
},

setScrollOffset: (x: number, y: number) => {
  set((state) => ({ ui: { ...state.ui, scrollOffsetX: x, scrollOffsetY: y } }));
},
```

---

## 🔴 問題根因分析

| # | 問題 | 嚴重度 | 影響 |
|---|------|--------|------|
| 1 | `setZoom()` 和 `setScrollOffset()` 分開呼叫 | 🔴 Critical | 觸發兩次渲染導致閃爍 |
| 2 | TimelineRuler 用 Transform，軌道用原生 scroll | 🟡 High | 同步時機不一致 |
| 3 | 固定 ZOOM_STEP = 0.1 | 🟡 Medium | 不支援觸控板精確縮放 |
| 4 | 刻度全量渲染 | 🟢 Low | 大量 DOM 節點影響效能 |
| 5 | 只處理左邊界 | 🟢 Low | 右邊界可能超界 |
| 6 | Store scrollOffset 未同步到 DOM | 🔴 Critical | 縮放後位置不正確 |

---

## 🎬 主流影音編輯器縮放行為參考

### Adobe Premiere Pro / DaVinci Resolve / Final Cut Pro

1. **以滑鼠位置為中心縮放** - 滑鼠指向的時間點保持在螢幕同一位置
2. **平滑縮放動畫** - 有 easing 過渡效果
3. **自適應刻度密度** - 刻度變化有平滑過渡
4. **虛擬化渲染** - 只渲染可視區域
5. **指數縮放步進** - 放大時精細、縮小時快速

---

## 📋 優化 TODO List（含風險解決方案）

> ⚠️ **實作順序建議**：按照 TODO 編號順序實作，後續 TODO 可能依賴前面的修改。

---

### 🔴 TODO-1: 合併 setZoom 和 setScrollOffset 為單一 Action

**優先級**：Critical  
**檔案**：`src/presentation/stores/directorStore.ts`

#### 任務描述
新增 `setZoomWithScroll()` Action，在單次 `set()` 呼叫中同時更新 zoom 和 scrollOffset，避免雙重渲染導致的閃爍。

#### 風險與解決方案

| 風險類型 | 風險等級 | 解決方案 |
|----------|----------|----------|
| 耦合問題 | 🟢 低 | 保留原有 `setZoom` 和 `setScrollOffset`，新增 `setZoomWithScroll` 作為複合操作 |
| Memory Leak | 🟢 無 | 純狀態更新，無額外資源分配 |

#### 實作代碼

```typescript
// 在 directorStore.ts 的 DirectorActions interface 中新增
interface DirectorActions {
  // ... 現有 actions
  setZoomWithScroll: (zoom: number, scrollX: number, scrollY: number) => void;
}

// 在 store 實作中新增
setZoomWithScroll: (zoom: number, scrollX: number, scrollY: number) => {
  const clampedZoom = Math.max(0.25, Math.min(zoom, 4));
  const clampedScrollX = Math.max(0, scrollX);
  const clampedScrollY = Math.max(0, scrollY);
  
  set(
    (state) => ({
      ui: { 
        ...state.ui, 
        zoom: clampedZoom,
        scrollOffsetX: clampedScrollX,
        scrollOffsetY: clampedScrollY,
      },
    }),
    undefined,
    'setZoomWithScroll'
  );
},
```

#### 驗收標準
- [ ] 新增 `setZoomWithScroll` Action
- [ ] 單次 `set()` 呼叫更新所有值
- [ ] 現有的 `setZoom` 和 `setScrollOffset` 保持不變
- [ ] TypeScript 類型正確

---

### 🔴 TODO-2: 同步 Store scrollOffset 到 DOM scrollLeft

**優先級**：Critical  
**檔案**：`src/presentation/features/director/components/TimelineEditor.tsx`

#### 任務描述
新增 `useEffect` 監聽 `ui.scrollOffsetX/Y` 變化，並同步到 `containerRef.current.scrollLeft/Top`。

#### ⚠️ 風險與解決方案（重要！）

| 風險類型 | 風險等級 | 問題說明 | 解決方案 |
|----------|----------|----------|----------|
| **無限循環** | 🔴 高 | DOM scroll → Store → useEffect → DOM scroll → ... | 使用 Ref 標記區分滾動來源 |
| Memory Leak | 🟢 無 | useEffect 有 cleanup | 無需額外處理 |

#### ❌ 錯誤實作（會造成無限循環）

```typescript
// ⚠️ 這樣寫會無限循環！
useEffect(() => {
  if (containerRef.current) {
    containerRef.current.scrollLeft = ui.scrollOffsetX;  // 觸發 onScroll
  }
}, [ui.scrollOffsetX]);

const handleScroll = (e) => {
  setScrollOffset(target.scrollLeft, target.scrollTop);  // 更新 Store → 觸發 useEffect
};
```

#### ✅ 正確實作代碼

```typescript
// TimelineEditor.tsx

// 1. 新增 Ref 標記
const isInternalScrollRef = useRef(false);
const lastScrollXRef = useRef(0);
const lastScrollYRef = useRef(0);

// 2. 修改 handleScroll，忽略程式觸發的滾動
const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
  const target = e.target as HTMLDivElement;
  
  // 若是程式觸發的滾動，且值接近預期，則忽略
  if (isInternalScrollRef.current) {
    const isExpectedX = Math.abs(target.scrollLeft - lastScrollXRef.current) < 2;
    const isExpectedY = Math.abs(target.scrollTop - lastScrollYRef.current) < 2;
    
    if (isExpectedX && isExpectedY) {
      isInternalScrollRef.current = false;
      return;  // 忽略程式觸發的 scroll 事件
    }
  }
  
  // 使用者滾動，更新 Store
  setScrollOffset(target.scrollLeft, target.scrollTop);
}, [setScrollOffset]);

// 3. 新增 useEffect 同步 Store → DOM
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;
  
  const needUpdateX = Math.abs(container.scrollLeft - ui.scrollOffsetX) > 1;
  const needUpdateY = Math.abs(container.scrollTop - ui.scrollOffsetY) > 1;
  
  if (needUpdateX || needUpdateY) {
    // 標記為程式觸發的滾動
    isInternalScrollRef.current = true;
    lastScrollXRef.current = ui.scrollOffsetX;
    lastScrollYRef.current = ui.scrollOffsetY;
    
    // 同步到 DOM
    if (needUpdateX) container.scrollLeft = ui.scrollOffsetX;
    if (needUpdateY) container.scrollTop = ui.scrollOffsetY;
  }
}, [ui.scrollOffsetX, ui.scrollOffsetY]);
```

#### 驗收標準
- [ ] 縮放後 DOM scrollLeft 正確更新
- [ ] 使用者手動滾動時 Store 正確更新
- [ ] 無無限循環問題（可用 console.log 計數驗證）
- [ ] 使用 `Math.abs() < 2` 容差避免浮點數誤差

---

### 🔴 TODO-3: 修正 Scroll 邊界計算

**優先級**：Critical  
**檔案**：`src/presentation/features/director/components/TimelineEditor.tsx`

#### 任務描述
在縮放時計算新的 scrollX，需同時處理左右邊界，避免超出時間軸範圍。

#### 風險與解決方案

| 風險類型 | 風險等級 | 解決方案 |
|----------|----------|----------|
| 耦合問題 | 🟢 無 | 純計算邏輯 |
| Memory Leak | 🟢 無 | 無資源分配 |

#### 實作代碼

```typescript
// 修改 handleWheel 函數

const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ui.zoom + delta));
  
  if (containerRef.current) {
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    
    // 計算滑鼠指向的幀位置
    const mouseX = e.clientX - rect.left + ui.scrollOffsetX;
    const frameAtMouse = mouseX / pixelsPerFrame;
    
    // 計算新的時間軸寬度和最大滾動值
    const newPixelsPerFrame = DEFAULT_PIXELS_PER_FRAME * newZoom;
    const newTimelineWidth = timeline.totalFrames * newPixelsPerFrame;
    const maxScrollX = Math.max(0, newTimelineWidth - containerWidth);
    
    // 計算新的滾動位置（保持滑鼠位置不變）
    const rawScrollX = frameAtMouse * newPixelsPerFrame - (e.clientX - rect.left);
    
    // 邊界限制：左邊界 0，右邊界 maxScrollX
    const newScrollX = Math.max(0, Math.min(rawScrollX, maxScrollX));
    
    // 使用合併更新（依賴 TODO-1）
    setZoomWithScroll(newZoom, newScrollX, ui.scrollOffsetY);
  } else {
    setZoom(newZoom);
  }
}, [ui.zoom, ui.scrollOffsetX, ui.scrollOffsetY, pixelsPerFrame, timeline.totalFrames, setZoomWithScroll, setZoom]);
```

#### 驗收標準
- [ ] 縮小到最小時，scrollX 不會變成負數
- [ ] 放大到最大時，scrollX 不會超過 `timelineWidth - containerWidth`
- [ ] 使用 `setZoomWithScroll` 合併更新（依賴 TODO-1）

---

### 🟡 TODO-4: 改為指數縮放步進

**優先級**：High  
**檔案**：`src/presentation/features/director/components/TimelineEditor.tsx`

#### 任務描述
將固定的 `ZOOM_STEP = 0.1` 改為根據 `e.deltaY` 計算的指數縮放，支援觸控板精確縮放。

#### 風險與解決方案

| 風險類型 | 風險等級 | 解決方案 |
|----------|----------|----------|
| 耦合問題 | 🟢 無 | 只修改縮放計算邏輯 |
| Memory Leak | 🟢 無 | 無資源分配 |

#### 實作代碼

```typescript
// 刪除固定的 ZOOM_STEP
// const ZOOM_STEP = 0.1;  // 刪除這行

// 修改 handleWheel
const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault();
  
  // 指數縮放：根據 deltaY 計算縮放因子
  // deltaY 正值 = 向下滾動 = 縮小
  // deltaY 負值 = 向上滾動 = 放大
  const ZOOM_SENSITIVITY = 0.001;  // 可調整靈敏度
  const zoomFactor = Math.pow(1 + ZOOM_SENSITIVITY, -e.deltaY);
  
  // 應用縮放因子（乘法而非加法）
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ui.zoom * zoomFactor));
  
  // ... 其餘邏輯不變
}, [...]);

// 縮放按鈕改用固定倍率
const handleZoomIn = useCallback(() => {
  const newZoom = Math.min(MAX_ZOOM, ui.zoom * 1.2);  // 放大 20%
  setZoom(newZoom);
}, [ui.zoom, setZoom]);

const handleZoomOut = useCallback(() => {
  const newZoom = Math.max(MIN_ZOOM, ui.zoom / 1.2);  // 縮小 20%
  setZoom(newZoom);
}, [ui.zoom, setZoom]);
```

#### 驗收標準
- [ ] 滾輪快速滑動時縮放幅度大
- [ ] 滾輪慢速滑動時縮放幅度小
- [ ] 觸控板 pinch-to-zoom 手勢正常運作
- [ ] 按鈕縮放使用固定 20% 步進

---

### 🟡 TODO-5: 統一 TimelineRuler 與軌道的滾動機制

**優先級**：High  
**檔案**：`TimelineRuler.tsx`, `TimelineEditor.tsx`

#### 任務描述
統一使用原生 scroll，將 TimelineRuler 放入同一個 scroll 容器中，確保同步。

#### 風險與解決方案

| 風險類型 | 風險等級 | 問題說明 | 解決方案 |
|----------|----------|----------|----------|
| 耦合問題 | 🟡 中 | 需修改多個組件結構 | 採用方案 B：TimelineRuler 改用 scrollOffsetX 計算顯示範圍 |
| Memory Leak | 🟢 無 | 無額外資源分配 | - |

#### 實作方案

**方案 A（推薦）**：TimelineRuler 保持獨立，但改為虛擬化渲染

保持現有結構，只渲染可視區域的刻度（同時解決 TODO-6）。

**方案 B**：合併到同一 scroll 容器

將 TimelineRuler 放入軌道的 scroll 容器中，使用 `position: sticky` 固定在頂部。

```tsx
// TimelineEditor.tsx 結構調整
<div ref={containerRef} className="flex-1 overflow-auto">
  {/* 時間刻度尺（使用 sticky 定位） */}
  <div className="sticky top-0 z-10 h-6 bg-gray-800">
    <TimelineRuler
      totalFrames={timeline.totalFrames}
      fps={timeline.fps}
      pixelsPerFrame={pixelsPerFrame}
      // 不再需要 scrollOffsetX，因為在同一容器內
    />
  </div>
  
  {/* 軌道內容 */}
  <div style={{ width: timelineWidth }}>
    {tracks.map(track => ...)}
  </div>
</div>
```

#### 驗收標準
- [ ] TimelineRuler 與軌道內容完全同步
- [ ] 無視覺錯位現象
- [ ] 選擇方案後更新相關組件

---

### 🟢 TODO-6: 虛擬化 TimelineRuler 刻度渲染

**優先級**：Medium  
**檔案**：`src/presentation/features/director/components/TimelineRuler.tsx`

#### 任務描述
只渲染可視區域內的刻度（±1 緩衝），減少 DOM 節點數量。

#### 風險與解決方案

| 風險類型 | 風險等級 | 問題說明 | 解決方案 |
|----------|----------|----------|----------|
| 耦合問題 | 🟡 中 | 需要 `containerWidth` 作為新 prop | 從父組件傳入或使用 ResizeObserver |
| Memory Leak | 🟢 無 | useMemo 自動清理 | - |

#### 實作代碼

```typescript
// TimelineRuler.tsx

interface TimelineRulerProps {
  totalFrames: number;
  fps: number;
  pixelsPerFrame: number;
  scrollOffsetX: number;
  containerWidth: number;  // 新增：可視區域寬度
}

export const TimelineRuler: React.FC<TimelineRulerProps> = memo(({
  totalFrames,
  fps,
  pixelsPerFrame,
  scrollOffsetX,
  containerWidth,
}) => {
  // ... 現有的 majorInterval/minorInterval 計算

  // 只生成可視區域的刻度
  const visibleTicks = useMemo(() => {
    // 計算可視範圍（加 ±1 緩衝）
    const startFrame = Math.max(0, Math.floor(scrollOffsetX / pixelsPerFrame) - minorInterval);
    const endFrame = Math.min(
      totalFrames,
      Math.ceil((scrollOffsetX + containerWidth) / pixelsPerFrame) + minorInterval
    );
    
    const result: { frame: number; isMajor: boolean; label?: string }[] = [];
    
    // 從最近的 minorInterval 倍數開始
    const firstFrame = Math.floor(startFrame / minorInterval) * minorInterval;
    
    for (let frame = firstFrame; frame <= endFrame; frame += minorInterval) {
      if (frame < 0) continue;
      
      const isMajor = frame % majorInterval === 0;
      const seconds = Math.floor(frame / fps);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      
      result.push({
        frame,
        isMajor,
        label: isMajor ? `${minutes}:${secs.toString().padStart(2, '0')}` : undefined,
      });
    }
    
    return result;
  }, [totalFrames, fps, majorInterval, minorInterval, scrollOffsetX, containerWidth, pixelsPerFrame]);

  // 渲染只使用 visibleTicks
  return (
    <div className="...">
      {visibleTicks.map(({ frame, isMajor, label }) => (
        // ...
      ))}
    </div>
  );
});
```

#### 驗收標準
- [ ] 刻度數量不超過 `(containerWidth / minorPixels) + 2`
- [ ] 滾動時刻度正確更新
- [ ] 無視覺閃爍

---

### 🟢 TODO-7: 虛擬化 ClipBlock 渲染

**優先級**：Medium  
**檔案**：`src/presentation/features/director/components/TrackRow.tsx`

#### 任務描述
只渲染可視區域內的 ClipBlock，當 Clip 數量超過 50 個時效果明顯。

#### 風險與解決方案

| 風險類型 | 風險等級 | 問題說明 | 解決方案 |
|----------|----------|----------|----------|
| 耦合問題 | 🟡 中 | 需要可視區域範圍 | 從父組件傳入 scrollOffsetX 和 containerWidth |
| Memory Leak | 🟢 無 | ClipBlock 已有正確的事件清理邏輯 | 現有清理邏輯正確，無需修改 |

#### ClipBlock 現有清理邏輯確認（正確，無需修改）

```typescript
// ClipBlock.tsx Line 80-118
useEffect(() => {
  if (!isDragging) return;
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);  // ✅ 正確清理
    document.removeEventListener('mouseup', handleMouseUp);      // ✅ 正確清理
  };
}, [isDragging, ...]);
```

#### 實作代碼

```typescript
// TrackRow.tsx

interface TrackRowProps {
  track: DirectorTrack;
  pixelsPerFrame: number;
  timelineWidth: number;
  isHeaderOnly?: boolean;
  scrollOffsetX?: number;      // 新增
  containerWidth?: number;     // 新增
}

// 在渲染 clips 時過濾
const visibleClips = useMemo(() => {
  if (scrollOffsetX === undefined || containerWidth === undefined) {
    return track.clips;  // 向後兼容
  }
  
  const visibleStart = scrollOffsetX / pixelsPerFrame;
  const visibleEnd = (scrollOffsetX + containerWidth) / pixelsPerFrame;
  
  return track.clips.filter(clip => {
    // Clip 與可視區域有交集
    return clip.endFrame >= visibleStart && clip.startFrame <= visibleEnd;
  });
}, [track.clips, scrollOffsetX, containerWidth, pixelsPerFrame]);

// 渲染時使用 visibleClips
{visibleClips.map(clip => (
  <ClipBlock key={clip.id} clip={clip} ... />
))}
```

#### 驗收標準
- [ ] 只渲染可視區域內的 Clip
- [ ] 滾動時 Clip 正確出現/消失
- [ ] 拖曳 Clip 時功能正常

---

### 🔵 TODO-8: 加入縮放動畫過渡

**優先級**：Low  
**檔案**：`TimelineEditor.tsx`, CSS

#### 任務描述
為縮放過程加入平滑動畫效果。

#### 風險與解決方案

| 風險類型 | 風險等級 | 問題說明 | 解決方案 |
|----------|----------|----------|----------|
| 耦合問題 | 🟢 無 | 純 CSS 或 framer-motion | 優先使用純 CSS |
| Memory Leak | 🟡 低 | framer-motion 動畫未停止 | **使用純 CSS transition 避免此風險** |

#### ✅ 推薦實作（純 CSS，無 Memory Leak）

```typescript
// TimelineEditor.tsx
const [isZooming, setIsZooming] = useState(false);
const zoomTimeoutRef = useRef<number>();

const handleWheel = useCallback((e: WheelEvent) => {
  // 標記正在縮放
  setIsZooming(true);
  
  // 清除之前的 timeout
  if (zoomTimeoutRef.current) {
    clearTimeout(zoomTimeoutRef.current);
  }
  
  // 停止縮放 150ms 後恢復動畫
  zoomTimeoutRef.current = window.setTimeout(() => {
    setIsZooming(false);
  }, 150);
  
  // ... 縮放邏輯
}, [...]);

// 清理 timeout（重要！避免 Memory Leak）
useEffect(() => {
  return () => {
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
  };
}, []);

// JSX 中使用
<div
  style={{ 
    width: timelineWidth,
    transition: isZooming ? 'none' : 'width 0.15s ease-out',
  }}
>
```

#### 驗收標準
- [ ] 縮放時無動畫（避免卡頓）
- [ ] 停止縮放後有平滑過渡
- [ ] 組件卸載時 clearTimeout

---

### 🔵 TODO-9: 加入縮放視覺回饋

**優先級**：Low  
**檔案**：`TimelineEditor.tsx`

#### 任務描述
在縮放時顯示當前縮放百分比的提示。

#### 風險與解決方案

| 風險類型 | 風險等級 | 問題說明 | 解決方案 |
|----------|----------|----------|----------|
| Memory Leak | 🟡 低 | setTimeout 未清理 | **必須在 useEffect cleanup 中 clearTimeout** |

#### ✅ 安全實作代碼

```typescript
// TimelineEditor.tsx

const [showZoomToast, setShowZoomToast] = useState(false);
const toastTimeoutRef = useRef<number>();

const handleWheel = useCallback((e: WheelEvent) => {
  // 顯示 toast
  setShowZoomToast(true);
  
  // 清除之前的 timeout
  if (toastTimeoutRef.current) {
    clearTimeout(toastTimeoutRef.current);
  }
  
  // 1 秒後隱藏
  toastTimeoutRef.current = window.setTimeout(() => {
    setShowZoomToast(false);
  }, 1000);
  
  // ... 縮放邏輯
}, [...]);

// ⚠️ 重要：清理 timeout
useEffect(() => {
  return () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  };
}, []);

// JSX
{showZoomToast && (
  <div className="absolute top-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-mono z-50">
    {Math.round(ui.zoom * 100)}%
  </div>
)}
```

#### 驗收標準
- [ ] 縮放時顯示百分比 toast
- [ ] 停止縮放 1 秒後自動隱藏
- [ ] 組件卸載時 clearTimeout

---

### 🔵 TODO-10: 支援鍵盤縮放快捷鍵

**優先級**：Low  
**檔案**：`src/presentation/features/director/hooks/useKeyboardShortcuts.ts`

#### 任務描述
新增縮放相關快捷鍵：`+/-` 縮放、`Ctrl+0` 重設。

#### 風險與解決方案

| 風險類型 | 風險等級 | 問題說明 | 解決方案 |
|----------|----------|----------|----------|
| Memory Leak | 🟢 無 | 現有 Hook 已有正確清理 | 無需額外處理 |

#### 現有清理邏輯確認（正確）

```typescript
// useKeyboardShortcuts.ts Line 103-106
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);  // ✅ 正確清理
}, [handleKeyDown]);
```

#### 實作代碼

```typescript
// useKeyboardShortcuts.ts - 在 handleKeyDown 的 switch 中新增

case '=':  // 或 '+' (需要 Shift)
case '+':
  e.preventDefault();
  setZoom(Math.min(MAX_ZOOM, ui.zoom * 1.2));
  break;

case '-':
  e.preventDefault();
  setZoom(Math.max(MIN_ZOOM, ui.zoom / 1.2));
  break;

case '0':
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    setZoom(1.0);  // 重設為 100%
  }
  break;

// 更新 shortcuts 列表
return {
  shortcuts: [
    // ... 現有快捷鍵
    { key: '+/-', description: '縮放時間軸' },
    { key: 'Ctrl + 0', description: '重設縮放' },
  ],
};
```

#### 驗收標準
- [ ] `+` 或 `=` 放大 20%
- [ ] `-` 縮小 20%
- [ ] `Ctrl+0` 重設為 100%
- [ ] 快捷鍵提示更新

---

## 📊 預期效果

完成以上優化後：

| 指標 | 優化前 | 優化後 |
|------|--------|--------|
| 縮放閃爍 | ❌ 明顯 | ✅ 無閃爍 |
| 滑鼠中心縮放 | ❌ 不穩定 | ✅ 穩定 |
| 刻度同步 | ❌ 偶爾錯位 | ✅ 完全同步 |
| 觸控板支援 | ❌ 不支援 | ✅ 支援 pinch-to-zoom |
| 大量元素效能 | ❌ 卡頓 | ✅ 60fps |
| Memory Leak | ⚠️ 潛在風險 | ✅ 已處理 |

---

## 📚 參考資料

- [React 18 自動批次處理](https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching)
- [Zustand 批次更新](https://github.com/pmndrs/zustand#transient-updates-for-often-occurring-state-changes)
- [CSS Transform 效能優化](https://web.dev/rendering-performance/)
- [虛擬化滾動列表](https://tanstack.com/virtual/latest)
