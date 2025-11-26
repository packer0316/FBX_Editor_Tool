# 🔑 Git 連接方式說明 - SSH vs HTTPS

## ❌ 常見錯誤

如果您看到這個錯誤：
```
git@github.com: Permission denied (publickey).
fatal: Could not read from remote repository.
```

這表示您的 Git 倉庫使用 **SSH 連接方式**，但沒有設置 SSH 密鑰。

---

## 📚 SSH vs HTTPS 的區別

### 🔐 SSH 方式
- **URL 格式**: `git@github.com:username/repo.git`
- **優點**: 不需要每次輸入密碼（使用密鑰對）
- **缺點**: 需要預先設置 SSH 密鑰
- **適合**: 經常推送代碼的開發者

### 🌐 HTTPS 方式
- **URL 格式**: `https://github.com/username/repo.git`
- **優點**: 無需設置，開箱即用
- **缺點**: Push 時需要輸入帳號密碼（或使用 Personal Access Token）
- **適合**: 只需要拉取 Public 倉庫的用戶

---

## ✅ 解決方案

### 方法 1：自動切換（推薦）

**最新版的「更新到最新版本.bat」已經內建自動切換功能！**

直接執行更新腳本，它會：
1. 自動偵測 SSH URL
2. 自動切換為 HTTPS URL
3. 繼續更新流程

### 方法 2：使用切換工具

執行 `切換為HTTPS連接.bat`：
1. 顯示當前連接方式
2. 確認是否切換
3. 自動完成切換

### 方法 3：手動切換

開啟命令提示字元，進入專案資料夾：

```bash
cd fbx-optimizer

# 查看當前 URL
git remote get-url origin

# 切換為 HTTPS（將 YOUR_USERNAME 和 YOUR_REPO 替換為實際值）
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# 確認已切換
git remote get-url origin
```

---

## 🔍 如何查看當前使用的連接方式

```bash
cd fbx-optimizer
git remote get-url origin
```

**輸出示例：**

SSH 方式：
```
git@github.com:username/repo.git
```

HTTPS 方式：
```
https://github.com/username/repo.git
```

---

## 💡 為什麼 Public 倉庫建議用 HTTPS？

對於 **Public（公開）倉庫**：

✅ **HTTPS 的優勢：**
- 無需設置 SSH 密鑰
- 任何人都能立即拉取代碼
- 適合團隊協作（不需要每個人都設置密鑰）
- 適合只讀用戶

❌ **SSH 的限制：**
- 需要每個用戶生成並上傳 SSH 公鑰到 GitHub
- 設置步驟較複雜
- 對於只拉取代碼的用戶來說過於繁瑣

---

## 🔧 如果您需要 Push（推送）代碼

如果您需要推送代碼到倉庫，有以下選擇：

### 選項 1：使用 Personal Access Token (PAT)
1. 繼續使用 HTTPS
2. 在 GitHub 生成 Personal Access Token
3. Push 時使用 Token 作為密碼

### 選項 2：設置 SSH 密鑰
1. 生成 SSH 密鑰對
2. 將公鑰添加到 GitHub
3. 切換回 SSH URL

詳細設置請參考：
- [GitHub PAT 教學](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub SSH 教學](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

---

## 📋 總結

| 用戶類型 | 建議方式 | 原因 |
|---------|---------|------|
| 只拉取代碼 | HTTPS | 簡單，無需設置 |
| 偶爾推送 | HTTPS + PAT | 相對簡單 |
| 經常推送 | SSH | 一次設置，永久方便 |

---

## 🆘 仍然有問題？

1. 確認已安裝 Git
2. 確認網路連線正常
3. 確認 GitHub 倉庫 URL 正確
4. 查看詳細錯誤訊息

如需更多幫助，請聯繫專案維護者。

