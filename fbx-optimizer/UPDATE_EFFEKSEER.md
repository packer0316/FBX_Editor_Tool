# 😤 Effekseer 更新說明（因為自動下載失敗了）

## 問題：無法自動下載最新版本

GitHub 的下載連結一直 404，npm 上也只有舊版本 (1.62.5000)。

## 🔥 手動更新步驟（3分鐘搞定）

### 步驟 1：開啟下載頁面
在瀏覽器中開啟：
```
https://effekseer.github.io/en/download.html
```

### 步驟 2：下載 Runtime for Web
- 找到 "Runtime" 區塊
- 點擊 "WebGL / WebGPU" 或 "Runtime for Web"
- 下載 zip 檔案

### 步驟 3：解壓縮
解壓縮下載的 zip 檔案，找到 `Release` 資料夾中的：
- `effekseer.min.js`
- `effekseer.wasm`

### 步驟 4：替換檔案
將這兩個檔案複製到你的專案資料夾：
```
C:\Users\User\Desktop\project\JR 3D Viewer\fbx-optimizer\public\effekseer\
```

**直接覆蓋舊檔案即可！**

（已經幫你備份了舊版本：`effekseer.min.js.backup` 和 `effekseer.wasm.backup`）

### 步驟 5：測試
1. 重新整理瀏覽器（Ctrl + Shift + R 強制重新載入）
2. 切換到 Effect 分頁
3. 等待「✓ 就緒」狀態
4. 上傳你的 `.efk` 檔案
5. 點擊 Play

## 🎯 如果還是不行怎麼辦？

那就代表問題不是版本問題，而是：

### 選項 A：特效檔案本身有問題
- 在 Effekseer Editor 中重新匯出特效
- 確保使用與 Runtime 相同的版本
- 或者改用 `.efkpkg` Package 格式

### 選項 B：改用其他特效庫
使用 Three.js / React Three Fiber 的特效系統：

```bash
npm install @react-three/drei
```

然後在程式碼中：
```tsx
import { Sparkles } from '@react-three/drei'

<Sparkles 
  count={100}
  scale={10}
  size={2}
  speed={0.4}
  color="orange"
/>
```

### 選項 C：暫時跳過特效功能
先完成其他功能，之後再回來處理 Effekseer。

## 📝 還原備份

如果更新後出問題，可以還原：

```powershell
Copy-Item "public\effekseer\effekseer.min.js.backup" "public\effekseer\effekseer.min.js" -Force
Copy-Item "public\effekseer\effekseer.wasm.backup" "public\effekseer\effekseer.wasm" -Force
```

---

**抱歉無法直接幫你下載，GitHub 的下載連結一直有問題** 😅

但手動下載只要 3 分鐘，而且更可靠！

