# 🔐 JR 3D Viewer 專案安全與版權審查報告

> **審查日期**：2024年11月25日  
> **專案版本**：0.0.0  
> **審查範圍**：安全疑慮、資安風險、版權使用

---

## 📋 目錄

1. [執行摘要](#執行摘要)
2. [安全疑慮問題](#1-安全疑慮問題)
3. [資安風險問題](#2-資安風險問題)
4. [版權使用問題](#3-版權使用問題)
5. [改善建議](#改善建議)
6. [合規檢查清單](#合規檢查清單)

---

## 執行摘要

### 整體風險等級：🟡 中等風險

| 類別 | 風險等級 | 關鍵問題數 | 狀態 |
|------|---------|-----------|------|
| 安全疑慮 | 🟡 中等 | 3 | ⚠️ 需改善 |
| 資安風險 | 🟡 中等 | 4 | ⚠️ 需改善 |
| 版權合規 | 🔴 高風險 | 2 | ❌ 急需處理 |

### 主要發現

✅ **優點**：
- 使用了現代化的架構設計（DDD 分層）
- 沒有使用危險的 DOM 操作（如 `dangerouslySetInnerHTML`）
- 前端驗證機制存在

⚠️ **需改善**：
- 缺少文件類型和大小驗證
- 未實施 Content Security Policy (CSP)
- 依賴包未定期更新檢查
- 未實施 Blob URL 清理機制

❌ **嚴重問題**：
- **lamejs 版權風險**：LGPL 授權可能與商業使用衝突
- **Effekseer 授權不明**：未確認商業使用授權
- **Spine Runtime 授權**：需付費授權但未明確說明

---

## 1. 安全疑慮問題

### 1.1 文件上傳安全 🟡

#### ❌ 問題：缺少完整的文件驗證

**影響範圍**：
- `src/App.tsx` - `handleFileUpload()`
- `src/application/use-cases/LoadEffectUseCase.ts`
- `src/application/use-cases/LoadSpineModelUseCase.ts`
- `src/presentation/features/audio-panel/components/AudioPanel.tsx`

**風險描述**：
```typescript
// 當前實作：僅檢查文件副檔名
const effectFile = files.find(f => 
    f.name.match(/\.(efk|efkefc|efkp)$/i)
);
```

**問題**：
- ❌ 未驗證文件大小（可能導致 DoS 攻擊）
- ❌ 未檢查 MIME 類型（僅依賴副檔名可被繞過）
- ❌ 未限制上傳速率
- ❌ 未掃描惡意內容

**潛在攻擊場景**：
1. **巨型文件攻擊**：上傳 GB 級別的文件導致瀏覽器崩潰
2. **偽裝文件**：將惡意文件重命名為 `.fbx` 或 `.efk`
3. **資源耗盡**：連續上傳大量文件耗盡記憶體

**影響等級**：🟡 中等

---

### 1.2 Blob URL 記憶體洩漏 🟡

#### ⚠️ 問題：Blob URL 未及時釋放

**影響範圍**：
- `src/application/use-cases/LoadEffectUseCase.ts` (Line 64)
- `src/infrastructure/spine/SpineLoaderAdapter.ts` (Line 285)
- `src/domain/services/model/ModelLoaderService.ts` (Line 103)
- `src/presentation/features/audio-panel/components/AudioPanel.tsx` (Line 40)

**風險描述**：
```typescript
// 創建 Blob URL 但未釋放
const blobUrl = URL.createObjectURL(file);
// ❌ 缺少 URL.revokeObjectURL(blobUrl)
```

**問題**：
- ❌ 長時間運行會累積未釋放的 Blob URL
- ❌ 記憶體洩漏可能導致瀏覽器性能下降
- ❌ 切換模型時舊的 Blob URL 未清理

**影響等級**：🟡 中等

---

### 1.3 第三方依賴漏洞 🟡

#### ⚠️ 問題：未實施依賴包安全掃描

**當前依賴版本**：
```json
{
  "react": "^19.2.0",              // ✅ 最新版本
  "three": "^0.181.2",              // ✅ 最新版本
  "vite": "^7.2.4",                 // ✅ 最新版本
  "lamejs": "^1.2.1",               // ⚠️ 2016年最後更新（8年未維護）
  "@types/three": "^0.181.0"        // ✅ 最新版本
}
```

**問題**：
- ❌ 未使用 `npm audit` 或 `snyk` 定期掃描
- ⚠️ `lamejs` 長期未維護，可能存在未知漏洞
- ❌ 未建立依賴包更新策略

**影響等級**：🟡 中等

---

## 2. 資安風險問題

### 2.1 缺少 Content Security Policy (CSP) 🔴

#### ❌ 問題：未實施 CSP 防護

**影響範圍**：`index.html`

**當前狀態**：
```html
<!-- index.html -->
<head>
    <meta charset="UTF-8" />
    <!-- ❌ 缺少 CSP meta tag -->
</head>
```

**風險描述**：
- ❌ 未限制外部資源載入
- ❌ 未防範 XSS 攻擊
- ❌ 未限制 inline script

**影響等級**：🔴 高風險

**建議 CSP 配置**：
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self' blob:;
  worker-src 'self' blob:;
  child-src 'self' blob:;
">
```

---

### 2.2 全域腳本載入風險 🟡

#### ⚠️ 問題：直接從 CDN 載入第三方腳本

**影響範圍**：`index.html`

```html
<!-- 全域載入 -->
<script src="/lame.min.js"></script>
<script src="/effekseer/effekseer.min.js"></script>
```

**風險描述**：
- ⚠️ 全域腳本可能污染 `window` 物件
- ⚠️ 無 Subresource Integrity (SRI) 檢查
- ⚠️ 可能被中間人攻擊（MITM）篡改
- ⚠️ 無版本鎖定，可能被惡意更新

**影響等級**：🟡 中等

---

### 2.3 使用者輸入驗證不足 🟡

#### ⚠️ 問題：INI 文件解析缺少安全檢查

**影響範圍**：`src/utils/ini/iniParser.ts`

**當前實作**：
```typescript
export async function parseIniFromFile(file: File): Promise<IniParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // ❌ 未驗證 content 長度
        // ❌ 未檢查惡意字元
        // ❌ 未限制解析深度
        resolve(parseIniContent(content));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.readAsText(file);
  });
}
```

**風險描述**：
- ❌ 未限制文件大小（可能解析巨型文件）
- ❌ 未檢查惡意內容（如極長字串）
- ❌ 未限制片段數量（可能創建數千個片段）

**影響等級**：🟡 中等

---

### 2.4 CORS 與資源隔離 🟢

#### ✅ 良好實踐：使用 Blob URL 進行資源隔離

**當前實作**：
```typescript
// 使用 Blob URL 而非直接載入外部資源
const blobUrl = URL.createObjectURL(file);
```

**優點**：
- ✅ 避免 CORS 問題
- ✅ 資源在本地處理
- ✅ 不洩漏文件路徑

**影響等級**：🟢 安全

---

## 3. 版權使用問題

### 3.1 LGPL 授權風險 🔴

#### ❌ 嚴重問題：lamejs 使用 LGPL 授權

**套件資訊**：
- **套件名稱**：`lamejs` (v1.2.1)
- **授權**：LGPL (GNU Lesser General Public License)
- **使用方式**：全域載入 (`/lame.min.js`)
- **用途**：MP3 音訊編碼

**授權要求**：
```
LGPL 要求：
1. ✅ 保留版權聲明（當前未保留）
2. ⚠️ 若修改源碼，必須開源修改部分
3. ⚠️ 若靜態連結，整個程式可能需開源
4. ✅ 動態連結可保持專有
5. ❌ 未提供 LGPL 授權聲明
```

**當前狀態**：
- ❌ `public/lame.min.js` 中無授權聲明
- ❌ 專案根目錄未包含 `LICENSES/` 目錄
- ❌ README 未說明第三方授權

**法律風險**：🔴 高風險

**解決方案選項**：

**選項 1：改用 MIT 授權的替代方案** ⭐ 推薦
```bash
# 使用 Web Audio API 原生編碼（無需第三方庫）
# 或使用 @breezystack/lamejs (MIT 授權)
npm install @breezystack/lamejs
```

**選項 2：正確聲明 LGPL 授權**
```markdown
<!-- 在 README.md 中新增 -->
## 第三方授權聲明

本專案使用以下 LGPL 授權的第三方庫：
- lamejs (v1.2.1) - LGPL 授權
  - 授權文件：https://github.com/zhuker/lamejs/blob/master/LICENSE
  - 用途：MP3 音訊編碼
```

**選項 3：移除 MP3 編碼功能**
```typescript
// 改用瀏覽器原生支援的 WAV 或 WebM 格式
```

---

### 3.2 Effekseer 授權不明 🔴

#### ❌ 嚴重問題：未確認 Effekseer 商業使用授權

**套件資訊**：
- **套件名稱**：Effekseer WebGL Runtime (v1.70e)
- **來源**：`/effekseer/effekseer.min.js`、`effekseer.wasm`
- **官方授權**：需查閱 Effekseer 官方授權條款

**官方授權資訊**：
```
Effekseer 授權：
- 個人使用：免費
- 商業使用：需購買授權 或 遵守開源授權
- Runtime：通常免費，但需確認
```

**當前狀態**：
- ❌ `public/effekseer/` 目錄未包含 LICENSE 文件
- ❌ `docs/` 中未說明授權狀態
- ⚠️ 使用備份文件 (`effekseer.min.js.backup`) 來源不明

**法律風險**：🔴 高風險

**改善措施**：
1. 確認專案性質（個人/商業/開源）
2. 前往 Effekseer 官網確認授權條款
3. 若為商業專案，購買授權或移除功能
4. 在 `public/effekseer/README.md` 中記錄授權資訊

**參考連結**：
- 官網：https://effekseer.github.io/
- GitHub：https://github.com/effekseer/Effekseer

---

### 3.3 Spine Runtime 授權問題 🔴

#### ⚠️ 規劃中功能：Spine 2D 整合需付費授權

**相關文件**：`docs/SPINE_INTEGRATION_PLAN.md`

**授權資訊**：
```markdown
# 技術選型：@esotericsoftware/spine-threejs

❌ 缺點：
- 需要付費授權（Spine Professional）
- Essential: $69 USD (單一平台)
- Professional: $299 USD (所有平台)
- Enterprise: $2,499 USD (含源碼)
```

**當前狀態**：
- ⚠️ 規劃使用 `@esotericsoftware/spine-threejs`
- ❌ 未確認是否已購買授權
- ⚠️ 若未購買授權，不能用於商業專案

**法律風險**：🔴 高風險（若實施且未授權）

**解決方案**：

**選項 1：使用免費替代方案**
```markdown
改用 pixi-spine：
- 授權：Spine Runtimes License（免費用於 Spine Essential）
- 限制：僅支援 Spine Essential 功能
```

**選項 2：購買 Spine 授權**
```
前往官網購買：https://esotericsoftware.com/spine-purchase
根據專案需求選擇版本
```

---

### 3.4 其他依賴授權審查 ✅

#### ✅ 以下依賴使用 MIT 授權（安全）

```json
{
  "react": "MIT",
  "react-dom": "MIT",
  "three": "MIT",
  "@react-three/fiber": "MIT",
  "@react-three/drei": "MIT",
  "tailwindcss": "MIT",
  "vite": "MIT",
  "typescript": "Apache-2.0",
  "lucide-react": "ISC",
  "clsx": "MIT"
}
```

**狀態**：✅ 安全，可商業使用

---

## 改善建議

### 🚨 緊急（1週內）

#### 1. 解決 LGPL 授權問題
```bash
# 選項 A：移除 lamejs
npm uninstall lamejs
# 使用 Web Audio API 原生編碼

# 選項 B：添加授權聲明
mkdir -p public/licenses
# 將 lamejs 的 LICENSE 複製到 public/licenses/LAMEJS_LICENSE
```

**實作範例**：
```typescript
// src/infrastructure/audio/WebAudioAdapter.ts

/**
 * 使用 Web Audio API 原生編碼為 WAV（替代 lamejs）
 */
async exportToWAV(track: AudioTrack): Promise<void> {
  const offlineContext = new OfflineAudioContext(
    2, // stereo
    track.duration * 44100,
    44100
  );
  
  // ... 渲染音訊 ...
  
  const renderedBuffer = await offlineContext.startRendering();
  
  // 編碼為 WAV
  const wavBlob = this.encodeWAV(renderedBuffer);
  const wavUrl = URL.createObjectURL(wavBlob);
  
  const link = document.createElement('a');
  link.href = wavUrl;
  link.download = `${track.name}.wav`;
  link.click();
  
  URL.revokeObjectURL(wavUrl);
}

private encodeWAV(buffer: AudioBuffer): Blob {
  // 實作 WAV 編碼（純 JavaScript，無需第三方庫）
  // ...
}
```

#### 2. 確認 Effekseer 授權
```markdown
<!-- 在 public/effekseer/README.md 中添加 -->

# Effekseer Web Runtime 授權聲明

- 版本：1.70e
- 授權：[根據官方確認填寫]
- 來源：https://github.com/effekseer/Effekseer
- 商業使用：[是/否，根據授權條款]

## 授權條款

[貼上完整授權條款]
```

#### 3. 新增 LICENSE 文件
```bash
# 在專案根目錄創建
touch LICENSE
```

```markdown
<!-- LICENSE -->
MIT License

Copyright (c) 2024 [您的名稱/組織]

[完整 MIT 授權條款]

---

## 第三方授權聲明

本專案使用以下第三方組件：

### lamejs (v1.2.1)
- 授權：LGPL
- 來源：https://github.com/zhuker/lamejs
- 授權文件：見 public/licenses/LAMEJS_LICENSE

### Effekseer WebGL Runtime (v1.70e)
- 授權：[填寫]
- 來源：https://github.com/effekseer/Effekseer
- 授權文件：見 public/licenses/EFFEKSEER_LICENSE
```

---

### ⚠️ 重要（1個月內）

#### 4. 實施文件驗證
```typescript
// src/utils/fileValidation.ts

export interface FileValidationConfig {
  maxSize: number;           // bytes
  allowedExtensions: string[];
  allowedMimeTypes: string[];
}

export class FileValidator {
  /**
   * 驗證文件安全性
   * 
   * @throws {Error} 當文件不符合安全要求時
   */
  static validate(file: File, config: FileValidationConfig): void {
    // 1. 大小檢查
    if (file.size > config.maxSize) {
      throw new Error(
        `文件過大：${(file.size / 1024 / 1024).toFixed(2)} MB，` +
        `最大允許：${(config.maxSize / 1024 / 1024).toFixed(2)} MB`
      );
    }

    // 2. 副檔名檢查
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !config.allowedExtensions.includes(`.${ext}`)) {
      throw new Error(`不支援的文件類型：${ext}`);
    }

    // 3. MIME 類型檢查
    if (!config.allowedMimeTypes.includes(file.type)) {
      throw new Error(`不安全的 MIME 類型：${file.type}`);
    }

    // 4. 文件名檢查（防止路徑遍歷）
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      throw new Error('文件名包含非法字元');
    }
  }
}

// 使用範例
const FBX_VALIDATION_CONFIG: FileValidationConfig = {
  maxSize: 100 * 1024 * 1024, // 100 MB
  allowedExtensions: ['.fbx', '.png', '.jpg', '.jpeg'],
  allowedMimeTypes: [
    'application/octet-stream',
    'image/png',
    'image/jpeg'
  ]
};
```

**整合到現有代碼**：
```typescript
// src/application/use-cases/LoadModelUseCase.ts

import { FileValidator, FBX_VALIDATION_CONFIG } from '@/utils/fileValidation';

public static async execute(files: FileList): Promise<LoadModelResult> {
  // 驗證所有文件
  for (let i = 0; i < files.length; i++) {
    FileValidator.validate(files[i], FBX_VALIDATION_CONFIG);
  }
  
  // ... 原有邏輯
}
```

#### 5. 實施 Blob URL 清理
```typescript
// src/utils/blobUrlManager.ts

/**
 * Blob URL 生命週期管理
 */
export class BlobUrlManager {
  private static urls = new Map<string, string>();

  /**
   * 創建並追蹤 Blob URL
   */
  static create(blob: Blob | File, id: string): string {
    // 清理舊的 URL（如果存在）
    this.revoke(id);

    const url = URL.createObjectURL(blob);
    this.urls.set(id, url);
    
    console.log(`[BlobUrlManager] Created: ${id} -> ${url}`);
    return url;
  }

  /**
   * 釋放 Blob URL
   */
  static revoke(id: string): void {
    const url = this.urls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.urls.delete(id);
      console.log(`[BlobUrlManager] Revoked: ${id}`);
    }
  }

  /**
   * 釋放所有 Blob URL
   */
  static revokeAll(): void {
    for (const [id, url] of this.urls.entries()) {
      URL.revokeObjectURL(url);
      console.log(`[BlobUrlManager] Revoked: ${id}`);
    }
    this.urls.clear();
  }

  /**
   * 獲取當前追蹤的 URL 數量
   */
  static getCount(): number {
    return this.urls.size;
  }
}

// 在 App.tsx 中使用
useEffect(() => {
  return () => {
    // 組件卸載時清理所有 Blob URL
    BlobUrlManager.revokeAll();
  };
}, []);
```

#### 6. 實施 CSP
```html
<!-- index.html -->
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self' data:;
    connect-src 'self' blob:;
    worker-src 'self' blob:;
    child-src 'self' blob:;
  ">
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>J.R. 3D Viewer</title>
</head>
```

#### 7. 添加依賴掃描腳本
```json
// package.json

{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "check:updates": "npm outdated"
  }
}
```

**設置 GitHub Actions**：
```yaml
# .github/workflows/security-audit.yml

name: Security Audit

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 1'  # 每週一執行

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm audit
      - run: npm outdated
```

---

### 🔵 建議（3個月內）

#### 8. 實施 Subresource Integrity (SRI)

如果使用 CDN 載入腳本，添加 SRI 檢查：

```bash
# 生成 SRI hash
openssl dgst -sha384 -binary public/lame.min.js | openssl base64 -A
```

```html
<script 
  src="/lame.min.js"
  integrity="sha384-[生成的 hash]"
  crossorigin="anonymous"
></script>
```

#### 9. 實施速率限制

```typescript
// src/utils/rateLimiter.ts

export class RateLimiter {
  private attempts = new Map<string, number[]>();
  
  /**
   * 檢查是否超過速率限制
   * 
   * @param key - 識別碼（如 IP、用戶 ID）
   * @param maxAttempts - 最大嘗試次數
   * @param windowMs - 時間窗口（毫秒）
   */
  check(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // 清除過期記錄
    const validAttempts = attempts.filter(time => now - time < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      return false; // 超過限制
    }
    
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    
    return true; // 允許
  }
}

// 使用範例
const uploadLimiter = new RateLimiter();

async function handleFileUpload(files: FileList) {
  if (!uploadLimiter.check('user', 10, 60000)) {
    throw new Error('上傳過於頻繁，請稍後再試');
  }
  
  // ... 處理上傳
}
```

#### 10. 添加錯誤邊界

```typescript
// src/presentation/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 這裡可以發送錯誤報告到監控服務
    // reportErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>發生錯誤</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            重新載入
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

```typescript
// src/main.tsx

import { ErrorBoundary } from './presentation/components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
```

---

## 合規檢查清單

### 安全性檢查

- [ ] 實施文件大小限制（建議：FBX ≤ 100MB，音訊 ≤ 50MB）
- [ ] 實施文件類型驗證（MIME + 副檔名）
- [ ] 實施 Blob URL 清理機制
- [ ] 添加速率限制（防止 DoS）
- [ ] 實施 CSP 策略
- [ ] 添加錯誤邊界
- [ ] 定期執行 `npm audit`

### 授權合規

- [ ] 解決 lamejs LGPL 問題（移除或添加聲明）
- [ ] 確認 Effekseer 授權狀態
- [ ] 確認 Spine Runtime 授權狀態（若實施）
- [ ] 在 README 中添加授權聲明
- [ ] 創建 LICENSE 文件
- [ ] 在 `public/licenses/` 中保存第三方授權

### 文檔完整性

- [ ] 更新 README.md（包含授權資訊）
- [ ] 創建 SECURITY.md（安全政策）
- [ ] 創建 CONTRIBUTING.md（包含授權要求）
- [ ] 更新 PROJECT_CONTEXT.md（包含安全架構）

---

## 參考資源

### 安全性

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [npm audit 文檔](https://docs.npmjs.com/cli/v8/commands/npm-audit)

### 授權

- [choosealicense.com](https://choosealicense.com/)
- [SPDX License List](https://spdx.org/licenses/)
- [GitHub License API](https://docs.github.com/en/rest/licenses)

### 相關法規

- [GDPR (歐盟數據保護)](https://gdpr.eu/)
- [著作權法 (台灣)](https://law.moj.gov.tw/)
- [開源軟體授權合規指南](https://opensource.org/licenses)

---

## 更新日誌

| 日期 | 版本 | 更新內容 |
|------|------|----------|
| 2024-11-25 | v1.0 | 初始審查報告 |

---

**最後更新**：2024年11月25日  
**審查人員**：AI 代碼審查助手  
**下次審查**：建議 3 個月後或重大更新時

---

## 附錄 A：快速修復腳本

```bash
#!/bin/bash
# quick-security-fix.sh

echo "🔐 開始安全性修復..."

# 1. 添加 LICENSE 文件
echo "📝 創建 LICENSE 文件..."
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024 [您的名稱]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

[完整 MIT 授權條款]
EOF

# 2. 創建第三方授權目錄
echo "📁 創建第三方授權目錄..."
mkdir -p public/licenses

# 3. 執行安全掃描
echo "🔍 執行依賴安全掃描..."
npm audit

# 4. 檢查過時依賴
echo "📦 檢查過時依賴..."
npm outdated

# 5. 創建 SECURITY.md
echo "🛡️ 創建 SECURITY.md..."
cat > SECURITY.md << 'EOF'
# 安全政策

## 回報漏洞

如果您發現安全漏洞，請通過以下方式聯繫我們：
[您的聯繫方式]

## 支援的版本

| 版本 | 支援狀態 |
| ---- | ------- |
| 0.x  | ✅ 支援 |

EOF

echo "✅ 安全性修復完成！"
echo "⚠️ 請手動檢查："
echo "  1. 確認 Effekseer 授權"
echo "  2. 決定 lamejs 處理方式"
echo "  3. 實施文件驗證"
echo "  4. 實施 CSP 策略"
```

**使用方式**：
```bash
chmod +x quick-security-fix.sh
./quick-security-fix.sh
```

---

**END OF REPORT**

