所有功能實作完成！讓我整理一下實作的內容：
實作完成總結
我已經完成了 Cocos Creator Shader 匯出功能的完整實作：
1. 建立的檔案結構

src/utils/shader/cocos-export/
├── index.ts              # 主匯出入口
├── types.ts              # 類型定義
├── generator.ts          # 組合器
├── templates/
│   ├── base.ts           # 基礎模板
│   └── techniques.ts     # techniques 模板
└── modules/
    ├── matcap.ts         # Matcap 模組
    ├── matcapAdd.ts      # Matcap Add 模組
    ├── matcapRGB.ts      # RGB 通道遮罩模組
    ├── normalMap.ts      # Normal Map 模組
    ├── rimLight.ts       # Rim Light 模組
    ├── bleach.ts         # Bleach 模組
    ├── dissolve.ts       # Dissolve 模組
    ├── flash.ts          # Flash 模組
    └── alphaTest.ts      # Alpha Test 模組

2. 功能特點
動態拼接：根據啟用的功能動態生成 shader 程式碼
模組化設計：每個 shader 功能是獨立模組，包含 properties、uniforms、vertex/fragment 程式碼
參數值帶入：匯出時使用 UI 設定的參數值
貼圖路徑留空：所有貼圖參數使用預設值（grey、white、normal 等）
RGB 通道遮罩：支援 Matcap 的 RGB 通道遮罩模式

3. UI 修改
在 MaterialShaderTool.tsx 的組合標題旁新增了下載圖示按鈕（<Download />），點擊後會：
根據該組合的啟用功能生成 .effect 檔案
自動下載為 {組合名稱}.effect