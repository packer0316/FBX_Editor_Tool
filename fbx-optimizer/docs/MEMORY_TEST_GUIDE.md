# 記憶體洩漏測試驗證指南

本指南說明如何驗證模型切換記憶體洩漏修復是否有效。

---

## 🧪 測試環境

- **瀏覽器**: Chrome（推薦）或 Edge
- **工具**: Chrome DevTools
- **測試檔案**: 兩個不同的 FBX 模型（建議 > 5MB）

---

## 📋 測試步驟

### 步驟 1: 準備環境

1. 開啟應用程式（`npm run dev`）
2. 打開 Chrome DevTools（F12）
3. 切換到 **Memory** 面板

### 步驟 2: 建立基準（Baseline）

1. 載入第一個 FBX 模型（拖放到畫面）
2. 等待載入完成
3. 載入第二個 FBX 模型
4. 等待載入完成
5. 在 Memory 面板點擊 **Take snapshot** 按鈕
6. 記錄 Snapshot 1 的大小（例如：52.3 MB）

### 步驟 3: 執行壓力測試

1. **快速切換模型卡片 50 次**：
   - 點擊模型 A 卡片
   - 點擊模型 B 卡片
   - 重複以上步驟 25 次（共 50 次切換）

2. 切換完成後，**等待 5 秒**

3. 點擊 Memory 面板的垃圾桶圖示 **Collect garbage** 強制 GC

4. 再次 **Take snapshot**（Snapshot 2）

### 步驟 4: 比較結果

1. 在 Memory 面板選擇 **Comparison** 視圖
2. 比較 Snapshot 1 和 Snapshot 2
3. 關注以下指標：

#### ✅ 成功指標
- **總記憶體增長** < 10 MB
- `AnimationMixer` 數量 = 2（每個模型一個）
- `AnimationClip` 數量穩定（約 2-4 個）
- `Float32Array` 增長 < 5 MB

#### ❌ 失敗指標
- **總記憶體增長** > 50 MB
- `AnimationMixer` 數量隨切換次數增長
- `AnimationClip` 數量 > 10 個
- `Float32Array` 線性增長

### 步驟 5: 深入分析（可選）

1. 在 Comparison 視圖搜尋關鍵字：
   - `AnimationMixer`
   - `AnimationClip`
   - `QuaternionKeyframeTrack`
   - `Float32Array`

2. 點擊物件查看保留路徑（Retainer Path）
3. 確認沒有意外的引用保持物件存活

---

## 📊 測試結果範例

### 修復前（失敗）
```
Snapshot 1: 52.3 MB
Snapshot 2: 156.8 MB (+104.5 MB ❌)

AnimationMixer: 50 個 ❌
AnimationClip: 12 個 ❌
Float32Array: +85 MB ❌
```

### 修復後（成功）
```
Snapshot 1: 52.3 MB
Snapshot 2: 58.7 MB (+6.4 MB ✅)

AnimationMixer: 2 個 ✅
AnimationClip: 3 個 ✅
Float32Array: +2 MB ✅
```

---

## 🐛 常見問題排查

### 問題 1: 記憶體仍然增長 20-30 MB
**可能原因**:
- 瀏覽器快取
- 其他組件的記憶體使用
- GC 尚未執行

**解決方案**:
- 多執行幾次 GC
- 等待更長時間（10-15 秒）
- 重新載入頁面重新測試

### 問題 2: 控制台出現 `_cacheIndex` 錯誤
**可能原因**:
- 時間同步邏輯仍在切換過程中呼叫 `seekTo`
- Hook 的防禦性檢查失效

**解決方案**:
- 檢查 `useAnimationMixer` 中的 `initializedRef` 檢查
- 確認 `seekTo` 有 try-catch 包裹
- 增加 `currentTime` 設置的延遲時間

### 問題 3: AnimationMixer 數量異常
**預期**: 2 個（每個載入的模型一個）

**如果 > 2**:
- 檢查 ModelPreview 是否正確清理
- 檢查是否有其他組件創建 Mixer
- 使用 Retainer Path 追蹤來源

**如果 = 0**:
- 可能 GC 過於積極
- 正常情況，模型仍在使用中

---

## 🔍 進階測試

### 測試 1: 長時間運行穩定性
1. 使用自動化腳本切換模型 500 次
2. 每 100 次切換拍一次 snapshot
3. 繪製記憶體增長曲線

**預期**: 曲線應該平穩，無持續上升趨勢

### 測試 2: 多模型測試
1. 載入 5 個不同模型
2. 隨機切換 100 次
3. 檢查記憶體是否穩定

**預期**: 記憶體增長應與模型數量成正比，而非切換次數

### 測試 3: Tolerance 變更測試
1. 載入一個模型
2. 將 tolerance 從 0 改為 0.01
3. 再改回 0
4. 重複 10 次

**預期**: 
- `useClipOptimizer` 快取應該命中
- 不應該重複計算相同的 tolerance

---

## 📝 測試報告範本

```markdown
## 記憶體測試報告

**日期**: 2025-11-29
**測試者**: [Your Name]
**分支**: memoryLeak修正

### 測試環境
- 瀏覽器: Chrome 120.0.6099.130
- 模型 A: DT3_boss_004.fbx (8.2 MB)
- 模型 B: 251127.fbx (12.5 MB)

### 測試結果
| 指標 | Baseline | After 50 switches | 增長 | 狀態 |
|------|----------|-------------------|------|------|
| 總記憶體 | 52.3 MB | 58.7 MB | +6.4 MB | ✅ |
| AnimationMixer | 2 | 2 | 0 | ✅ |
| AnimationClip | 3 | 3 | 0 | ✅ |
| Float32Array | - | - | +2 MB | ✅ |

### Heap Snapshot 分析
- AnimationMixer 保留在預期範圍內
- 無意外的 Retainer Path
- GC 能夠正確回收舊物件

### 功能測試
- [x] 載入模型正常
- [x] 切換模型正常
- [x] 動畫播放正常
- [x] 無控制台錯誤

### 結論
✅ 記憶體洩漏修復有效，可以合併到主分支。
```

---

## ✅ 驗證檢查清單

在提交修復前，請確認：

- [ ] 基本測試：50 次切換記憶體增長 < 10 MB
- [ ] 無 `_cacheIndex` 錯誤
- [ ] AnimationMixer 數量穩定
- [ ] 所有功能正常運作
- [ ] 無控制台警告或錯誤
- [ ] Heap Snapshot 分析通過
- [ ] 已撰寫測試報告

---

**相關文件**:
- [REFACTOR_STATUS.md](./REFACTOR_STATUS.md)
- [MODEL_SWITCHING_MEMORY_FIX.md](./MODEL_SWITCHING_MEMORY_FIX.md)

