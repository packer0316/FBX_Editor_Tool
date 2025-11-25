# 📁 Effekseer 資料夾上傳功能說明

## ✅ 功能概述

**狀態**：✅ 已完成  
**日期**：2024年11月24日

現在 JR 3D Viewer 支援上傳完整的 Effekseer 特效資料夾，包含：
- ✅ 主特效檔（`.efk` / `.efkefc` / `.efkp`）
- ✅ 貼圖檔案（`.png` / `.jpg` / `.jpeg`）
- ✅ 材質檔案（`.efkmat`）
- ✅ 其他關聯資源

系統會自動建立資源映射表，並透過 Effekseer 的 `redirect` callback 重定向所有相對路徑。

---

## 🚀 使用方式

### 方式 1：選擇資料夾（推薦）

1. **切換到 Effect 分頁**
2. **點擊「選擇檔案」按鈕**
3. **在檔案選擇對話框中，選擇「資料夾」**
   - Windows: 點擊資料夾，然後點擊「選擇資料夾」
   - Mac: 點擊資料夾，然後點擊「Upload」
4. **系統會自動上傳資料夾內的所有檔案**
5. **看到「✓ 已載入：[特效名稱] (+ X 個關聯檔案)」**
6. **點擊「Play」播放特效**

### 方式 2：多選檔案

1. **切換到 Effect 分頁**
2. **點擊「選擇檔案」按鈕**
3. **在檔案選擇對話框中，按住 Ctrl (Windows) 或 Cmd (Mac)**
4. **選擇所有需要的檔案**（`.efk` + `.png` + `.efkmat` 等）
5. **點擊「開啟」**
6. **系統會處理所有選中的檔案**

---

## 🔧 技術實作

### 1. LoadEffectUseCase 修改

```typescript
// 支援多檔案上傳
public static async execute(params: {
    id: string;
    files: File[];  // 改為檔案陣列
    scale?: number;
}): Promise<string>
```

**功能**：
- 自動找出主特效檔（`.efk` / `.efkefc` / `.efkp`）
- 為每個檔案建立 Blob URL
- 建立資源映射表（檔名 -> Blob URL）
- 支援 `webkitRelativePath` 保留資料夾結構

### 2. EffekseerRuntimeAdapter 資源重定向

```typescript
const redirect = (path: string) => {
    // 多種匹配策略
    const strategies = [
        normalizedPath,                           // 完整路徑
        normalizedPath.split('/').pop() || '',   // 純檔名
        normalizedPath.replace(/^\.\//, ''),    // 移除 ./
        normalizedPath.replace(/^\.\.\//, ''),  // 移除 ../
    ];
    
    for (const key of strategies) {
        if (resourceMap.has(key)) {
            return resourceMap.get(key)!;
        }
    }
    
    return path; // 找不到就返回原路徑
};
```

**功能**：
- Effekseer 請求資源時（如 `Texture/laser.png`），透過 `redirect` 返回對應的 Blob URL
- 支援多種路徑格式（完整路徑、相對路徑、純檔名）
- 自動正規化路徑（統一使用 `/` 分隔符）

### 3. UI 修改

```html
<input
    type="file"
    accept=".efk,.efkefc,.efkp,.png,.jpg,.jpeg,.efkmat"
    multiple
    webkitdirectory=""
    directory=""
/>
```

**功能**：
- `multiple`：允許多選檔案
- `webkitdirectory`：啟用資料夾選擇（Chrome/Edge）
- `directory`：啟用資料夾選擇（Firefox）
- `accept`：限制可選的檔案類型

---

## 📋 支援的檔案類型

### 主特效檔
- ✅ `.efk` - Effekseer 特效檔
- ✅ `.efkefc` - Effekseer Curve 檔
- ✅ `.efkp` - Effekseer Project 檔

### 貼圖檔案
- ✅ `.png` - PNG 圖片
- ✅ `.jpg` / `.jpeg` - JPEG 圖片

### 材質檔案
- ✅ `.efkmat` - Effekseer 材質檔

---

## 🎯 資料夾結構範例

### 範例 1：扁平結構
```
MyEffect/
├── MyEffect.efk          ← 主特效檔
├── texture1.png          ← 貼圖
├── texture2.png
└── material.efkmat       ← 材質
```

**處理方式**：
- 所有檔案的 `webkitRelativePath` 都是 `MyEffect/[檔名]`
- 資源映射表會註冊完整路徑和純檔名

### 範例 2：階層結構
```
MyEffect/
├── MyEffect.efk          ← 主特效檔
├── Texture/
│   ├── glow.png
│   └── particle.png
└── Material/
    └── shader.efkmat
```

**處理方式**：
- Effekseer 請求 `Texture/glow.png`
- `redirect` 函數會找到 `MyEffect/Texture/glow.png` 的 Blob URL
- 返回正確的 URL 給 Effekseer

---

## 🐛 常見問題

### Q1: 為什麼我的特效載入失敗？

**可能原因**：
1. 資料夾中沒有 `.efk` 檔案
2. 關聯檔案的路徑與 `.efk` 中記錄的不一致
3. 檔案名稱包含特殊字元或非 ASCII 字元

**解決方式**：
- 確保資料夾中有主特效檔
- 保持原始的資料夾結構
- 避免使用中文或特殊字元命名檔案

### Q2: 為什麼部分貼圖沒有顯示？

**可能原因**：
1. 貼圖檔案沒有一起上傳
2. 路徑大小寫不一致（Linux/Mac 區分大小寫）

**解決方式**：
- 確保上傳整個資料夾，包含所有關聯檔案
- 檢查 Console 中的「找不到資源」警告

### Q3: 我可以上傳 `.efkpkg` 檔案嗎？

**目前不支援**：
- `.efkpkg` 是 Effekseer 的打包格式，需要特殊的解壓縮邏輯
- 建議使用 Effekseer 編輯器匯出未打包的資料夾

**未來計畫**：
- Phase 3 將考慮支援 `.efkpkg` 格式

---

## 📊 資源映射範例

假設上傳了以下資料夾：

```
BigExplosion/
├── BigExplosion.efk
├── fire.png
└── smoke.png
```

**資源映射表**：

| 原始路徑 (Effekseer 請求) | 映射的 Blob URL |
|--------------------------|-----------------|
| `BigExplosion/BigExplosion.efk` | `blob:http://localhost:5173/xxxxx` |
| `BigExplosion.efk` | `blob:http://localhost:5173/xxxxx` |
| `BigExplosion/fire.png` | `blob:http://localhost:5173/yyyyy` |
| `fire.png` | `blob:http://localhost:5173/yyyyy` |
| `BigExplosion/smoke.png` | `blob:http://localhost:5173/zzzzz` |
| `smoke.png` | `blob:http://localhost:5173/zzzzz` |

**重定向流程**：

1. Effekseer 載入 `BigExplosion.efk`
2. 解析到需要 `fire.png`
3. 呼叫 `redirect("fire.png")`
4. 查找映射表，返回 `blob:http://localhost:5173/yyyyy`
5. Effekseer 從 Blob URL 載入圖片 ✅

---

## 🔍 除錯技巧

### 1. 檢查 Console 日誌

```javascript
[LoadEffectUseCase] 開始載入特效: BigExplosion.efk，共 3 個檔案
[LoadEffectUseCase] 資源映射: BigExplosion/BigExplosion.efk -> blob:...
[LoadEffectUseCase] 資源映射: BigExplosion/fire.png -> blob:...
[EffekseerRuntimeAdapter] 啟用資源重定向，共 6 個資源
[EffekseerRuntimeAdapter] 資源重定向: fire.png -> blob:...
```

### 2. 資源找不到警告

```javascript
[EffekseerRuntimeAdapter] ⚠️ 找不到資源: Texture/missing.png
```

**解決方式**：檢查該檔案是否存在於上傳的資料夾中

### 3. 檢查上傳的檔案

在 `handleFileSelect` 中加入調試：

```typescript
console.log('上傳的檔案：', files.map(f => ({
    name: f.name,
    path: f.webkitRelativePath,
    size: f.size
})));
```

---

## 🎊 測試方式

1. **使用你的自訂特效資料夾**
2. **切換到 Effect 分頁**
3. **點擊「選擇檔案」，選擇整個資料夾**
4. **看到「✓ 已載入：[特效名稱] (+ X 個關聯檔案)」**
5. **點擊「Play」**
6. **特效應該正常顯示，包含所有貼圖和材質！** 🎉

---

## 📚 相關檔案

- `src/application/use-cases/LoadEffectUseCase.ts` - 多檔案載入邏輯
- `src/infrastructure/effect/EffekseerRuntimeAdapter.ts` - 資源重定向實作
- `src/presentation/features/effect-panel/components/EffectTestPanel.tsx` - UI 元件

---

**功能完成時間**：2024年11月24日  
**開發時間**：約 30 分鐘  
**主要挑戰**：資源路徑映射、多種路徑格式支援

🎉 **資料夾上傳功能完成！** 🎉


