# 🎮 Effekseer 特效使用指南

## 📋 快速開始

### 步驟 1：準備特效檔案

將你的特效檔案和**所有關聯資源**放到 `public/effekseer/` 下：

```
public/effekseer/
├── BigExplosion_Orange.efk     ← 主特效檔
├── TSTreeTurtle_add.png        ← 貼圖檔案（必須！）
├── BS03_vfx_01.png             ← 其他貼圖
├── shock_tex_01.png
├── vfx_noise_009.png
├── vfx_noise_016.png
└── cannon_dissolve_1.efkmat    ← 材質檔案
```

⚠️ **重要**：所有在 `.efk` 中引用的資源都必須放在同一個資料夾下！

### 步驟 2：上傳特效檔

1. **重新整理瀏覽器**（Ctrl + Shift + R）
2. **切換到 Effect 分頁**
3. **點擊「選擇檔案」按鈕**（在「上傳特效檔」區域）
4. **選擇 `BigExplosion_Orange.efk`**
5. **看到「特效載入成功」**

### 步驟 3：播放特效

1. **點擊「▶ Play」**
2. **特效會在場景原點 (0,0,0) 播放**
3. **可以開啟「Loop」重複播放**

---

## 🔧 常見問題

### Q: 為什麼顯示「not found (blob:http://...)」錯誤？

**原因**：你上傳了 `.efk` 檔案，但關聯的資源（貼圖、材質）沒有放在 `public/effekseer/` 下。

**解決方式**：
1. 檢查錯誤訊息中找不到的檔案名稱（例如：`TSTreeTurtle_add.png`）
2. 將該檔案複製到 `public/effekseer/` 下
3. 重新上傳 `.efk` 檔案

### Q: 特效太大或太小怎麼辦？

**方式 1**：修改程式碼中的 scale 參數

在 `EffectTestPanel.tsx` 的 `handleFileSelect` 中：
```typescript
const effect = context.loadEffect(
    blobUrl,
    1.0, // ← 修改這裡：1.0 = 原始大小，10.0 = 放大 10 倍
    ...
);
```

**方式 2**：在 Effekseer 編輯器中調整

### Q: 特效位置不對怎麼辦？

目前特效固定播放在 (0,0,0)。如需修改：

在 `EffectTestPanel.tsx` 的 `handlePlay` 中：
```typescript
PlayEffectUseCase.execute({
    id: effectId,
    x: 0,   // ← 修改 X 座標
    y: 0,   // ← 修改 Y 座標
    z: 0    // ← 修改 Z 座標
});
```

---

## 📁 資料夾結構範例

### 範例 1：所有檔案放在根目錄

```
public/effekseer/
├── MyEffect.efk
├── texture1.png
├── texture2.png
└── material.efkmat
```

✅ **適用情況**：`.efk` 中的資源路徑是純檔名（如 `texture1.png`）

### 範例 2：有子資料夾

```
public/effekseer/
├── MyEffect.efk
├── Texture/
│   ├── texture1.png
│   └── texture2.png
└── Material/
    └── material.efkmat
```

✅ **適用情況**：`.efk` 中的資源路徑是相對路徑（如 `Texture/texture1.png`）

### 範例 3：特效放在子資料夾

```
public/effekseer/
└── MyEffects/
    ├── Effect1/
    │   ├── Effect1.efk
    │   └── glow.png
    └── Effect2/
        ├── Effect2.efk
        └── fire.png
```

⚠️ **注意**：上傳 `.efk` 時，Effekseer 會從 Blob URL 的位置找相對路徑，可能找不到資源。**建議所有資源都放在同一個資料夾**。

---

## ✅ 完整工作流程

### 1. 從 Effekseer 編輯器匯出

在 Effekseer 編輯器中：
1. 開啟你的特效專案
2. 選單 → File → Export
3. 勾選「Export all resources」
4. 匯出到資料夾

### 2. 複製到 Public 資料夾

```bash
# Windows (PowerShell)
Copy-Item -Recurse "C:\path\to\exported\effect\*" "public\effekseer\"

# Mac/Linux
cp -r /path/to/exported/effect/* public/effekseer/
```

### 3. 確認檔案結構

確保所有檔案都在 `public/effekseer/` 下：
- ✅ `.efk` 主檔
- ✅ 所有 `.png` 貼圖
- ✅ 所有 `.efkmat` 材質
- ✅ 其他關聯檔案

### 4. 上傳並測試

1. 重新整理瀏覽器
2. 上傳 `.efk` 檔案
3. 點擊 Play
4. 如果有錯誤，檢查 Console 找出缺少的檔案
5. 補齊檔案後重新上傳

---

## 🎨 進階技巧

### 同時管理多個特效

如果你有多個特效要測試，可以這樣組織：

```
public/effekseer/
├── Effect1/
│   ├── effect.efk
│   └── resources...
├── Effect2/
│   ├── effect.efk
│   └── resources...
└── Effect3/
    ├── effect.efk
    └── resources...
```

但記得上傳時要上傳對應資料夾內的 `.efk`。

### 除錯技巧

1. **檢查 Console 日誌**
   ```
   [EffectTestPanel] ✓ 特效載入成功
   [PlayEffectUseCase] 特效播放成功: effect_xxxxx
   ```

2. **檢查資源是否可訪問**
   在瀏覽器網址列輸入：
   ```
   http://localhost:5173/effekseer/TSTreeTurtle_add.png
   ```
   應該能看到圖片，而不是 404。

3. **檢查相對路徑**
   在 Effekseer 編輯器中：
   - 右鍵點擊貼圖節點
   - 查看「Path」欄位
   - 確保路徑與實際檔案結構一致

---

## 📝 檢查清單

上傳特效前，請確認：

- [ ] `.efk` 檔案已放在 `public/effekseer/` 下
- [ ] 所有關聯資源（貼圖、材質）都在同一個資料夾
- [ ] 檔名沒有中文或特殊字元
- [ ] 可以在瀏覽器中直接訪問資源 URL
- [ ] Dev server 正在運行（`npm run dev`）

---

## 🎊 成功！

如果一切正常，你應該能：
- ✅ 順利上傳 `.efk` 檔案
- ✅ 沒有「not found」錯誤
- ✅ 特效正常播放
- ✅ 所有貼圖和材質都正確顯示

享受你的 Effekseer 特效吧！🎉

---

**最後更新**：2024年11月24日

