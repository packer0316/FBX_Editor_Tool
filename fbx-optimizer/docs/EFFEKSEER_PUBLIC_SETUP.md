# 📁 Effekseer 特效放置於 Public 資料夾指南

## ✅ 簡易設定方式（推薦）

將特效檔案和所有關聯資源放到 `public/effekseer/` 下，讓 Effekseer 自動處理相對路徑。

---

## 📂 資料夾結構

### 方式 1：扁平結構（簡單特效）

```
public/effekseer/
├── effekseer.min.js
├── effekseer.wasm
├── Resources/                    ← 官方範例（已存在）
│   ├── Laser01.efk
│   ├── Texture/
│   └── ...
└── MyEffects/                    ← 你的自訂特效資料夾
    ├── MyEffect1.efk             ← 主特效檔
    ├── texture1.png              ← 貼圖
    ├── texture2.png
    └── material.efkmat           ← 材質
```

**載入方式**：
```
URL: /effekseer/MyEffects/MyEffect1.efk
```

### 方式 2：階層結構（複雜特效）

```
public/effekseer/
└── MyEffects/
    ├── Explosion/
    │   ├── Explosion.efk         ← 主特效檔
    │   ├── Texture/
    │   │   ├── fire.png
    │   │   └── smoke.png
    │   └── Material/
    │       └── shader.efkmat
    └── Laser/
        ├── Laser.efk
        └── glow.png
```

**載入方式**：
```
URL: /effekseer/MyEffects/Explosion/Explosion.efk
```

---

## 🎮 使用步驟

### 1. 將特效放到 Public 資料夾

```bash
# 建立你的特效資料夾
mkdir public/effekseer/MyEffects

# 複製你的特效檔案（保持原始資料夾結構）
# Windows:
xcopy /E /I "C:\path\to\your\effect" "public\effekseer\MyEffects\YourEffect"

# Mac/Linux:
cp -r /path/to/your/effect public/effekseer/MyEffects/YourEffect
```

### 2. 修改 EffectTestPanel 載入路徑

目前的「載入官方範例」按鈕使用：
```typescript
const sampleUrl = '/effekseer/Resources/Laser01.efk';
```

你可以：
- **選項 A**：直接修改這個 URL 為你的特效路徑
- **選項 B**：新增一個下拉選單，讓使用者選擇不同的特效
- **選項 C**：新增多個按鈕，每個按鈕對應一個特效

---

## 🔧 快速修改範例（選項 A）

如果你想測試自己的特效，最快的方式：

1. **將特效放到 `public/effekseer/MyEffects/` 下**

2. **暫時修改 `EffectTestPanel.tsx`**：

```typescript
const handleLoadSample = async () => {
    // ... 省略 ...
    
    // 修改這行，改成你的特效路徑
    const sampleUrl = '/effekseer/MyEffects/YourEffect/YourEffect.efk';
    
    // ... 省略 ...
};
```

3. **重新整理瀏覽器**

4. **點擊「載入官方範例特效」按鈕**（實際上會載入你的特效）

5. **點擊「Play」**

---

## 🎨 進階：新增多個預設特效（選項 B）

如果你想同時管理多個特效，可以新增下拉選單：

### 1. 準備特效列表

在 `EffectTestPanel.tsx` 中新增：

```typescript
const PRESET_EFFECTS = [
    { id: 'laser01', name: 'Laser01 (官方)', path: '/effekseer/Resources/Laser01.efk', scale: 10.0 },
    { id: 'laser02', name: 'Laser02 (官方)', path: '/effekseer/Resources/Laser02.efk', scale: 10.0 },
    { id: 'myeffect1', name: '我的特效1', path: '/effekseer/MyEffects/Effect1/Effect1.efk', scale: 1.0 },
    { id: 'myeffect2', name: '我的特效2', path: '/effekseer/MyEffects/Effect2/Effect2.efk', scale: 5.0 },
];
```

### 2. 新增 UI 元素

```tsx
<div className="space-y-2">
    <label className="block text-sm font-medium text-gray-300">
        選擇預設特效
    </label>
    <select
        className="w-full px-3 py-2 bg-gray-700 text-white rounded"
        onChange={(e) => {
            const selected = PRESET_EFFECTS.find(ef => ef.id === e.target.value);
            if (selected) loadPresetEffect(selected);
        }}
    >
        <option value="">-- 請選擇 --</option>
        {PRESET_EFFECTS.map(ef => (
            <option key={ef.id} value={ef.id}>{ef.name}</option>
        ))}
    </select>
</div>
```

---

## ✅ 優點

### Public 資料夾方式的優點：

1. **簡單可靠**
   - 不需要處理複雜的 Blob URL 和資源映射
   - Effekseer 直接從 HTTP URL 載入，完全按照官方範例的方式

2. **易於管理**
   - 可以直接在檔案系統中檢視和編輯
   - 方便團隊共享和版本控制

3. **效能更好**
   - HTTP 快取機制
   - 不需要將大量檔案載入到記憶體

4. **除錯容易**
   - 可以直接在瀏覽器中訪問資源 URL
   - 網路面板可以清楚看到載入狀態

---

## ⚠️ 注意事項

### 1. 保持相對路徑結構

如果你的 `.efk` 檔案中引用了相對路徑的資源，例如：
```
Texture/fire.png
Material/shader.efkmat
```

你必須保持相同的資料夾結構：
```
public/effekseer/MyEffects/YourEffect/
├── YourEffect.efk
├── Texture/
│   └── fire.png
└── Material/
    └── shader.efkmat
```

### 2. 路徑大小寫

- Windows 不區分大小寫，但 Linux/Mac 區分
- 建議統一使用小寫或保持原始大小寫

### 3. 檔名避免特殊字元

- 避免使用空格、中文、特殊符號
- 建議使用 `a-z`、`0-9`、`-`、`_`

---

## 🧪 測試清單

### ✅ 確認事項

- [ ] 特效檔案已放到 `public/effekseer/` 下
- [ ] 保持了原始的資料夾結構
- [ ] 路徑中沒有中文或特殊字元
- [ ] 可以在瀏覽器中直接訪問特效 URL（如 `http://localhost:5173/effekseer/MyEffects/test.efk`）
- [ ] Console 沒有 404 錯誤

### 🔍 除錯方式

**檢查特效是否可訪問**：
1. 在瀏覽器打開 `http://localhost:5173/effekseer/MyEffects/YourEffect.efk`
2. 應該會下載檔案，而不是顯示 404

**檢查資源是否可訪問**：
1. 在瀏覽器打開 `http://localhost:5173/effekseer/MyEffects/texture.png`
2. 應該會顯示圖片

---

## 📝 快速開始範例

```bash
# 1. 將你的特效複製到 public
cp -r ~/Downloads/MyEffect public/effekseer/MyEffects/

# 2. 檢查檔案結構
ls -R public/effekseer/MyEffects/

# 3. 啟動 dev server（如果還沒啟動）
npm run dev

# 4. 在瀏覽器中測試檔案是否可訪問
# 訪問: http://localhost:5173/effekseer/MyEffects/MyEffect/MyEffect.efk
```

---

## 🎊 完成！

現在你可以：
1. ✅ 將特效放到 `public/effekseer/` 下
2. ✅ 使用簡單的 HTTP URL 載入
3. ✅ Effekseer 自動處理所有相對路徑
4. ✅ 不需要擔心複雜的資源映射問題

簡單又可靠！🚀

---

**建立時間**：2024年11月24日  
**適用情境**：穩定的特效資源、團隊共享、版本控制

