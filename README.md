# 🎨 FBX 編輯工具

一個強大的 3D 模型 FBX 檔案編輯和預覽工具。

## ✨ 功能特色

- 🎮 3D 模型實時預覽
- 🎬 動畫播放與編輯
- 🎨 材質和貼圖管理
- 🎵 音效同步
- ✨ 特效系統
- 📐 模型變換控制
- 🎪 相機公轉與模型自轉
- ⌨️ WASD 鍵盤相機控制

## 🚀 快速開始

### 方法 1：使用安裝腳本（推薦）

1. 確保已安裝 [Node.js](https://nodejs.org/) (v16+) 和 [Git](https://git-scm.com/)
2. 下載 `首次安裝-給新用戶.bat`
3. 雙擊執行，等待自動安裝
4. 完成後執行 `一鍵啟動.bat`

### 方法 2：手動安裝

```bash
# 克隆倉庫
git clone https://github.com/packer0316/FBX_Editor_Tool.git

# 進入專案目錄
cd FBX_Editor_Tool/fbx-optimizer

# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

## 📦 必備環境

- **Node.js**: v16 或更高版本（建議使用 LTS）
- **Git**: 最新版本
- **瀏覽器**: Chrome、Edge、Firefox 等現代瀏覽器

## 🎮 使用說明

### 啟動應用程式

雙擊 `一鍵啟動.bat`，應用程式會自動在瀏覽器中開啟。

### 更新到最新版本

雙擊 `更新到最新版本.bat`，腳本會自動：
- 從 GitHub 拉取最新代碼
- 更新依賴套件
- 完成後可重新啟動

## 📚 文檔

- [如何移至其他電腦使用](./如何移至其他電腦使用.txt)
- [更新指南](./fbx-optimizer/README_UPDATE.md)
- [SSH vs HTTPS 說明](./fbx-optimizer/README_SSH_vs_HTTPS.md)
- [WASD 相機控制](./fbx-optimizer/docs/WASD_CAMERA_CONTROL_PLAN.md)

## 🔄 常見操作

### 模型操作
- 拖放 FBX 檔案到視窗中載入
- 使用滑鼠旋轉、縮放、平移視角
- 使用 WASD/QE 鍵移動相機
- 點擊模型卡片展開詳細控制

### 動畫控制
- 播放/暫停動畫
- 創建動畫片段
- 動作序列播放

### 貼圖管理
- 點擊「貼圖」按鈕查看所有貼圖
- 上傳新貼圖替換
- 支援 JPG、PNG 等格式

## 🛠️ 開發

```bash
# 開發模式
npm run dev

# 建構生產版本
npm run build

# 預覽生產版本
npm run preview
```

## 📂 專案結構

```
FBX_Editor_Tool/
├── fbx-optimizer/           # 主應用程式
│   ├── src/                 # 原始碼
│   ├── public/              # 公共資源
│   ├── docs/                # 文檔
│   └── package.json         # 依賴配置
├── 一鍵啟動.bat             # 啟動腳本
├── 更新到最新版本.bat       # 更新腳本
└── 首次安裝-給新用戶.bat    # 安裝腳本
```

## 🤝 貢獻

這是一個公開專案，歡迎提出問題或建議！

## 📝 授權

請查看 LICENSE 檔案了解詳情。

## 🆘 需要幫助？

- 查看 [常見問題](./如何移至其他電腦使用.txt)
- 提交 [Issue](https://github.com/packer0316/FBX_Editor_Tool/issues)
- 查看專案文檔

---

最後更新：2025.11.28

