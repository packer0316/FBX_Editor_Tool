# 📜 第三方授權聲明

本目錄包含 JR 3D Viewer 專案所使用的第三方開源軟體授權文件。

---

## 📋 授權清單

### 1. lamejs (v1.2.1)

- **授權類型**：LGPL-3.0 (GNU Lesser General Public License)
- **用途**：MP3 音訊編碼
- **來源**：https://github.com/zhuker/lamejs
- **授權文件**：[LAMEJS_LICENSE.txt](./LAMEJS_LICENSE.txt)
- **使用方式**：全域腳本載入 (`/lame.min.js`)

#### ⚠️ LGPL 授權要求

根據 LGPL-3.0 授權條款：

1. ✅ **保留版權聲明**：所有副本必須包含原始版權聲明
2. ✅ **提供授權文件**：必須附帶 LGPL 授權副本（本文件）
3. ✅ **動態連結允許專有**：通過全域腳本載入（動態連結）允許本專案保持其他授權
4. ⚠️ **修改源碼需開源**：若修改 lamejs 源碼，修改部分必須開源
5. ✅ **通知使用者**：使用者需被告知專案使用了 LGPL 授權的組件

#### 📌 本專案合規狀態

- ✅ 保留完整授權文件（本目錄）
- ✅ 使用動態載入方式（`<script src="/lame.min.js">`）
- ✅ 未修改 lamejs 源碼
- ✅ 在專案文檔中聲明使用 lamejs

---

### 2. Effekseer WebGL Runtime (v1.70e)

- **授權類型**：MIT License
- **用途**：WebGL 特效渲染引擎
- **來源**：https://github.com/effekseer/Effekseer
- **官網**：https://effekseer.github.io/
- **授權文件**：[EFFEKSEER_LICENSE.txt](./EFFEKSEER_LICENSE.txt)
- **使用檔案**：
  - `/effekseer/effekseer.min.js`
  - `/effekseer/effekseer.wasm`

#### ✅ MIT 授權許可

MIT 授權是最寬鬆的開源授權之一，允許：

- ✅ 商業使用
- ✅ 修改
- ✅ 分發
- ✅ 私人使用
- ✅ 可用於專有軟體

#### 📌 本專案合規狀態

- ✅ 保留完整授權文件（本目錄）
- ✅ 保留版權聲明
- ✅ 在專案文檔中聲明使用 Effekseer

---

### 3. Three.js (v0.181.2)

- **授權類型**：MIT License
- **用途**：3D WebGL 渲染引擎
- **來源**：https://github.com/mrdoob/three.js
- **安裝方式**：npm 套件
- **授權文件**：包含於 `node_modules/three/LICENSE`

---

### 4. React (v19.2.0)

- **授權類型**：MIT License
- **用途**：前端 UI 框架
- **來源**：https://github.com/facebook/react
- **安裝方式**：npm 套件
- **授權文件**：包含於 `node_modules/react/LICENSE`

---

## 🔍 授權相容性矩陣

| 組件 | 授權 | 商業使用 | 修改 | 分發 | 專有軟體 | 開源要求 |
|------|------|---------|-----|------|----------|----------|
| lamejs | LGPL-3.0 | ✅ | ⚠️¹ | ✅ | ✅² | ⚠️³ |
| Effekseer | MIT | ✅ | ✅ | ✅ | ✅ | ❌ |
| Three.js | MIT | ✅ | ✅ | ✅ | ✅ | ❌ |
| React | MIT | ✅ | ✅ | ✅ | ✅ | ❌ |

**註解**：
1. ⚠️¹ 修改 LGPL 組件需開源修改部分
2. ✅² 動態連結（本專案使用方式）允許專有軟體
3. ⚠️³ 修改部分需遵守 LGPL 開源要求

---

## 📝 使用建議

### 對於商業使用

如果您計劃將本專案用於商業用途：

1. ✅ **MIT 組件（Effekseer, Three.js, React）**：無需擔心，可自由使用
2. ⚠️ **LGPL 組件（lamejs）**：
   - 當前使用方式（全域腳本）符合 LGPL 要求
   - 不要修改 lamejs 源碼，否則需開源修改部分
   - 或考慮替換為 MIT 授權的替代方案

### 替代方案建議

如果希望完全避免 LGPL 授權：

#### 選項 1：使用 Web Audio API 原生編碼
```javascript
// 改用瀏覽器原生 WAV 編碼（無需第三方庫）
// 優點：無授權問題，瀏覽器原生支援
// 缺點：檔案較大（WAV 未壓縮）
```

#### 選項 2：使用其他 MIT 授權的 MP3 編碼器
```bash
# 例如：@breezystack/lamejs (MIT 授權)
npm install @breezystack/lamejs
```

---

## 📞 授權問題聯繫

如有授權相關疑問，請聯繫：

- **專案維護者**：[請在此填寫聯繫方式]
- **lamejs 問題**：https://github.com/zhuker/lamejs/issues
- **Effekseer 問題**：https://github.com/effekseer/Effekseer/issues

---

## 🔄 更新日誌

| 日期 | 版本 | 更新內容 |
|------|------|----------|
| 2024-11-25 | v1.0 | 初始授權文件，包含 lamejs 和 Effekseer |

---

## ⚖️ 免責聲明

本文件旨在提供授權資訊的概述，但不構成法律建議。
對於具體的授權合規問題，請諮詢專業法律顧問。

本專案力求遵守所有相關開源授權條款。
如發現任何授權合規問題，請立即通知我們，我們將儘快處理。

---

**最後更新**：2024年11月25日  
**文件維護**：專案開發團隊

