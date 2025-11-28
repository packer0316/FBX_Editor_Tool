# 🔐 安全政策 (Security Policy)

## 支援的版本

我們目前支援以下版本的安全更新：

| 版本 | 支援狀態 |
| ---- | ------- |
| 0.x  | ✅ 支援 |

---

## 回報漏洞

如果您發現了安全漏洞，我們非常感謝您負責任地揭露問題。

### 🚨 請勿公開揭露

- ❌ 請勿在 GitHub Issues 中公開發布安全漏洞
- ❌ 請勿在社交媒體或公共論壇上發布
- ✅ 請使用私密管道回報

### 📧 回報管道

請通過以下方式私密回報安全問題：

1. **電子郵件**：[請在此填寫安全聯繫郵箱]
2. **GitHub Security Advisory**：使用 GitHub 的私密漏洞回報功能

### 📝 回報內容

請在回報中包含以下資訊：

1. **漏洞類型**：（例如：XSS、SQL 注入、權限提升等）
2. **影響範圍**：受影響的檔案、功能或組件
3. **重現步驟**：詳細的步驟說明
4. **影響評估**：潛在的影響和嚴重程度
5. **建議修復方案**（如果有）
6. **您的聯繫方式**：以便我們與您溝通

### 📋 回報範例

```markdown
**漏洞類型**：檔案上傳驗證繞過

**影響範圍**：
- 檔案：src/application/use-cases/LoadModelUseCase.ts
- 功能：FBX 模型上傳

**重現步驟**：
1. 準備一個惡意 .exe 檔案
2. 將副檔名改為 .fbx
3. 上傳該檔案
4. 系統未進行 MIME 類型檢查，接受了惡意檔案

**影響評估**：
- 嚴重程度：中等
- 可能導致：記憶體耗盡、DoS 攻擊

**建議修復**：
添加 MIME 類型檢查和檔案大小限制

**聯繫方式**：security@example.com
```

---

## 回應流程

### ⏱️ 回應時間

- **初步確認**：收到回報後 48 小時內
- **詳細分析**：7 個工作日內
- **修復發布**：根據嚴重程度，14-30 天內

### 📊 嚴重程度分類

| 等級 | 說明 | 回應時間 |
|------|------|---------|
| 🔴 **嚴重** | 可遠程執行代碼、資料洩漏 | 7 天內修復 |
| 🟠 **高** | 權限提升、認證繞過 | 14 天內修復 |
| 🟡 **中等** | XSS、CSRF、資訊洩漏 | 30 天內修復 |
| 🟢 **低** | 配置問題、最佳實踐建議 | 下次版本更新 |

### 🎁 感謝名單

我們會在以下地方公開感謝回報者（如您同意）：

- 專案 README.md
- 版本發布說明
- SECURITY.md 檔案

---

## 已知安全問題

根據最新的安全審查（2025.11.28），以下問題已被識別並計劃修復：

### 🟡 中等風險

1. **檔案上傳驗證不足**
   - 狀態：⏳ 計劃中
   - 預計修復：v0.1.0
   - 臨時緩解措施：限制檔案來源

2. **Blob URL 記憶體洩漏**
   - 狀態：⏳ 計劃中
   - 預計修復：v0.1.0
   - 臨時緩解措施：定期重新載入頁面

3. **缺少 Content Security Policy**
   - 狀態：⏳ 計劃中
   - 預計修復：v0.1.0

完整的安全審查報告請參見：[docs/SECURITY_AND_LICENSE_AUDIT.md](./docs/SECURITY_AND_LICENSE_AUDIT.md)

---

## 安全最佳實踐

### 對於使用者

1. ✅ 只上傳來自信任來源的檔案
2. ✅ 定期清除瀏覽器快取
3. ✅ 使用最新版本的瀏覽器
4. ✅ 不要在生產環境中使用開發版本

### 對於開發者

1. ✅ 定期執行 `npm audit` 檢查依賴漏洞
2. ✅ 使用 ESLint 和 TypeScript 嚴格模式
3. ✅ 進行代碼審查
4. ✅ 遵循最小權限原則
5. ✅ 驗證所有使用者輸入
6. ✅ 使用 HTTPS
7. ✅ 實施 Content Security Policy

---

## 依賴安全

### 自動化掃描

我們使用以下工具定期掃描依賴漏洞：

- ✅ npm audit（每週執行）
- 🔄 GitHub Dependabot（計劃啟用）
- 🔄 Snyk（考慮中）

### 依賴更新策略

- **主要依賴**：每月檢查更新
- **安全補丁**：立即應用
- **主版本升級**：經過測試後應用

### 當前依賴狀態

最後檢查時間：2025.11.28

```bash
# 執行安全審計
npm audit

# 檢查過時套件
npm outdated
```

**已知問題**：
- ⚠️ lamejs (v1.2.1)：2016 年後未更新，但無已知漏洞
  - 計劃：考慮替換為維護中的替代品

---

## 安全配置建議

### Content Security Policy (CSP)

建議在生產環境中使用以下 CSP 配置：

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self' blob:;
  worker-src 'self' blob:;
">
```

### HTTPS

- ✅ 生產環境必須使用 HTTPS
- ✅ 使用 HSTS (HTTP Strict Transport Security)

### 檔案上傳限制

建議配置：

```typescript
const UPLOAD_LIMITS = {
  FBX_MAX_SIZE: 100 * 1024 * 1024,      // 100 MB
  TEXTURE_MAX_SIZE: 10 * 1024 * 1024,   // 10 MB
  AUDIO_MAX_SIZE: 50 * 1024 * 1024,     // 50 MB
  EFFECT_MAX_SIZE: 20 * 1024 * 1024     // 20 MB
};
```

---

## 版本更新與通知

### 安全更新通知

當發布安全更新時，我們會通過以下方式通知：

1. ✅ GitHub Releases 頁面
2. ✅ 專案 README.md
3. ✅ Git commit 訊息標註 `[SECURITY]`

### 更新日誌

所有安全相關的更新都會在 CHANGELOG.md 中明確標註：

```markdown
## [0.1.0] - 2025.11.28

### Security
- 🔒 修復檔案上傳驗證繞過問題
- 🔒 實施 Blob URL 自動清理機制
- 🔒 添加 Content Security Policy
```

---

## 聯繫資訊

### 安全團隊

- **安全負責人**：[請填寫]
- **郵箱**：[請填寫安全聯繫郵箱]
- **PGP Key**：[如有，請提供]

### 一般支援

- **GitHub Issues**：https://github.com/[your-repo]/issues（非安全問題）
- **文檔**：README.md、docs/

---

## 授權與隱私

### 資料處理

本應用程式：

- ✅ 在瀏覽器本地處理所有檔案
- ✅ 不上傳任何資料到伺服器
- ✅ 不收集個人資訊
- ✅ 不使用 Cookie 或追蹤技術

### 第三方服務

本應用程式不使用任何第三方服務或 API。
所有處理都在使用者的瀏覽器中本地完成。

---

## 感謝名單

感謝以下人員/組織協助改善本專案的安全性：

- [待添加]

---

## 參考資源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [npm Security Best Practices](https://docs.npmjs.com/security)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)

---

**最後更新**：2025.11.28  
**版本**：1.0  
**維護者**：JR.H

