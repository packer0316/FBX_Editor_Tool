# three.js 與自訂 Shader 顏色差異分析與對齊策略

> 目標：找出 **three.js 預設材質管線**（MeshStandardMaterial 等）與目前 **自訂 ShaderMaterial（Matcap / Rim / Flash / Dissolve 等）** 之間的顏色差異來源，並設計一套「對所有模型都通用」的 shader 處理流程，讓最終顏色盡量貼近 three.js 的輸出。

---

## 1. 問題場景與觀察

- 同一隻模型，在下列兩種狀態下顏色有明顯差距：  
  - **A. three.js 預設 PBR 材質**（`MeshStandardMaterial`，經過 `MaterialFixService` 修正後）  
  - **B. 自訂 ShaderMaterial**（Matcap / Normal Map / Rim Light / Flash / Dissolve 等特效）  
- A 與 B 的差異包含：
  - 飽和度、對比度不同
  - 高光壓暗或過亮
  - 局部顏色偏紫 / 偏藍 / 偏灰

目標不是「做一個專門給某隻怪物的調整」，而是 **建立一套通用的 shader 顏色管線**，讓任何 FBX 模型丟進來後，在 three.js 預設材質與自訂 shader 的顏色感受接近。

---

## 2. three.js 預設顏色管線（概念版）

以目前 `SceneViewer` 為例，three.js 管線大致如下：

1. **Renderer 設定**
   - `gl.outputColorSpace = THREE.SRGBColorSpace`  
   - `gl.toneMapping = THREE.ACESFilmicToneMapping`  
   - `gl.toneMappingExposure = toneMappingExposure`（由 UI / CameraPreset 控制）

2. **貼圖色彩空間**
   - BaseColor / Matcap / Emissive 等「顏色貼圖」 → `texture.colorSpace = THREE.SRGBColorSpace`
   - Normal / Mask / Rough / Metal 等「資料貼圖」 → `texture.colorSpace = THREE.LinearSRGBColorSpace`
   - 在 WebGL2 / 有 sRGB 內部格式時，**硬體會自動把 sRGB 貼圖 sample 解碼到 Linear**。

3. **材質 / Shader 計算（Linear 空間）**
   - three.js 內建的 shader（例如 `MeshStandardMaterial`）都在 **Linear 色域** 下做光照、BRDF、環境反射等計算。

4. **Tone Mapping + 輸出色彩空間**
   - 先做 ACES Filmic tone mapping（壓縮 HDR 範圍，加強高光與中間調過渡）。  
   - 再把 Linear 顏色轉回 sRGB（`Linear → sRGB`），餵給螢幕。
   - 這一步是透過 shader chunk：`<tonemapping_fragment>` + `<colorspace_fragment>` 自動插入。

> 重點：**three.js 期望「材質 Shader 的輸出顏色是 Linear」**，由框架負責做 tone mapping 與 Linear→sRGB 轉換。

---

## 3. 目前自訂 Shader 管線（簡化說明）

### 3.1 SceneViewer 的設定

- `SceneViewer` 在 `<Canvas>` 的 `onCreated` 中：
  - `gl.outputColorSpace = THREE.SRGBColorSpace;`
  - `gl.toneMapping = THREE.ACESFilmicToneMapping;`
  - `gl.toneMappingExposure` 由 UI 控制。
- Matcap / Mask / Normal / Flash 等貼圖載入後，透過 `setTextureColorSpace` 設定：
  - Matcap / Flash 等顏色貼圖 → `SRGBColorSpace`
  - Normal / Mask / Dissolve 等資料貼圖 → `LinearSRGBColorSpace`

### 3.2 自訂 fragment shader 的顏色處理

目前自訂 ShaderMaterial（`SceneViewer` 中 inline 的 GLSL）主要流程：

1. **BaseColor**
   - `baseTexColor = texture2D(baseTexture, vUv);`
   - `albedo = pow(baseTexColor.rgb, vec3(2.2));`  // sRGB → Linear（手動 γ 校正）
   - `finalColor *= albedo;`

2. **Matcap / AddMatcap**
   - `matcapCol = texture2D(matcapTexture, matcapUv).rgb;`
   - `matcapCol = pow(matcapCol, vec3(2.2));`       // 同樣手動 sRGB → Linear
   - 與 `finalColor` 用 `mix` 或加法混合（仍在 Linear 思維下）。

3. **Rim / Flash / Dissolve / NormalMap**
   - 所有運算都以「我們認為是 Linear 的顏色」為基礎。

4. **輸出前再做一次 Gamma**
   - `finalColor = pow(finalColor, vec3(1.0 / 2.2));` // Linear → sRGB
   - `gl_FragColor = vec4(finalColor, baseTexColor.a);`

5. **沒有使用 three.js 的 tone mapping / colorspace chunk**
   - Shader **沒有** `#include <tonemapping_fragment>` / `#include <colorspace_fragment>`，
   - three.js 也因此不會在這個 Shader 上自動套用 ACES Filmic 與 Linear→sRGB。

---

## 4. 顏色差異的真正來源

整體來看，three.js 與自訂 shader 在幾個關鍵點不同：

### 4.1 sRGB → Linear 的位置與次數

- **three.js 內建材質**：
  - sRGB 貼圖 → 由 GPU 或 shader chunk 自動解碼到 Linear，然後所有光照在 Linear 空間運算。

- **自訂 Shader**：
  - 已經把貼圖的 `colorSpace` 設成 `SRGBColorSpace`，在 WebGL2 / sRGB 內部格式下，**硬體就會自動解碼到 Linear**。  
  - 但 shader 又手動做了一次 `pow(color, 2.2)`，等於有機會「**二次解碼**」，導致顏色偏亮、對比變怪。
  - 若在某些平台沒有 sRGB 內部格式，則這次 `pow` 又是必要的。→ 實務上需要一個「只在需要時才做」的機制。

### 4.2 Tone Mapping 的缺失

- three.js 的 PBR 材質會經過 ACES Filmic tone mapping：
  - 高光被壓縮，中間調有比較順的過渡。
  - 這會顯著影響「亮度感」與「顏色對比」。  
- 自訂 shader 目前 **完全沒有 tone mapping**：
  - 計算完後直接 `pow(1/2.2)` 就輸出，沒有經過 ACES Filmic。
  - 所以在同樣的曝光值下，自訂 shader 的亮部通常會看起來更亮或更硬。

### 4.3 最終 Linear → sRGB 的責任歸屬

- **three.js 預設預期**：
  - Fragment shader 輸出 Linear 顏色給 `gl_FragColor`，  
  - 然後透過 `<tonemapping_fragment>` + `<colorspace_fragment>` 做 tone mapping + Linear→sRGB。

- **自訂 shader 現狀**：
  - Shader 自己做 Linear→sRGB（`pow(1/2.2)`），
  - three.js 的 color management / tone mapping 對這個 shader 幾乎沒有參與。

結果就是：**兩條顏色管線完全不同**，即使看到的是同一張貼圖，畫面也不可能完全一致。

---

## 5. 通用的「顏色對齊」策略設計

這裡設計一套 **「對所有模型通用」的顏色處理策略**，原則是：

1. **Renderer 與三方材質：照 three.js 的標準走。**
2. **自訂 Shader：盡量模擬 three.js 的同一條顏色管線。**

### 5.1 Renderer / 場景 層級

（目前專案已經大致符合，只是列出來當作設計依據）

1. `WebGLRenderer`：
   - `outputColorSpace = THREE.SRGBColorSpace`
   - `toneMapping = THREE.ACESFilmicToneMapping`
   - `toneMappingExposure` 從 UI / CameraPreset 控制。

2. 貼圖載入邏輯（**已實作**）：
   - 顏色貼圖（albedo、matcap、flash、emissive） → `SRGBColorSpace`
   - 資料貼圖（normal、mask、dissolve、metal、rough） → `LinearSRGBColorSpace`

3. 環境光與 HDRI：
   - 使用 `Environment` + `PMREM`，並暴露 `environmentIntensity`，讓內建材質與自訂 shader 共享相同的光照基準。

### 5.2 自訂 Shader 顏色管線（建議版本）

> 目標：**讓自訂 Shader 的輸出顏色盡量遵守 three.js 的 Linear 工作流程與 tone mapping。**

1. **在 shader 裡面，統一用 Linear 顏色運算**
   - 假設貼圖已經正確設定 `colorSpace`：
     - 在 WebGL2 + sRGB texture 格式時，GPU sample 回來的已經是 Linear，**不需要再 `pow(2.2)`**。
   - 建議：
     - **移除** `pow(baseTexColor.rgb, vec3(2.2))`、`pow(matcapCol, vec3(2.2))` 等固定 γ 解碼。
     - 若要支援沒有 sRGB 內部格式的環境，可以：
       - 在 JS 端用 flag 控制，例如 `useManualGammaFix`，或
       - 在 shader 裡用 `#ifdef USE_MANUAL_GAMMA_DECODE` 包起來，只在需要時啟用。

2. **不要在 shader 結尾做 `pow(1/2.2)`**
   - `finalColor` 保持 Linear，直接交給 three.js 的 tone mapping / colorspace chunk 處理。
   - 這樣一來，無論是 PBR 材質還是自訂 shader，最終都經過同一套 ACES + Linear→sRGB 流程。

3. **導入 three.js 的 tone mapping / colorspace chunk**

   通用做法（概念）是：

   ```glsl
   // 計算完成後，保持 Linear 顏色
   vec3 finalColorLinear = ...;
   float alpha = baseTexColor.a;

   gl_FragColor = vec4( finalColorLinear, alpha );

   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   ```

   - `ShaderMaterial.toneMapped` 預設為 `true`，保持預設即可。
   - 這樣 shader 的輸出就會與 `MeshStandardMaterial` 共享同一套 tone mapping / 色彩空間處理。

4. **維持「通用」而不是「模型客製」**

   - 不在 shader 內寫死任何「針對某隻模型」的補償係數（例如：只對某隻怪物加 1.2 倍亮度）。  
   - 所有可調的東西（例如 Matcap 強度、Rim intensity、Flash intensity）全部走 **uniform 參數 + UI 面板**：
     - 這些參數只是「效果強度」，**不應該用來彌補色域 / γ / tone mapping 的系統性問題**。

---

## 6. 實作層面建議（摘要）

以下是未來在程式碼層面可以落實的步驟（此文件僅做設計與分析，不代表已實作）：

1. **調整 ShaderMaterial fragment：**
   - 把 base / matcap 等 `pow(2.2)` 解碼移除或用 `#ifdef` 保護。
   - 把最後的 `pow(1.0/2.2)` 移除，改為輸出 Linear 的 `finalColorLinear`。
   - 在 shader 末尾加入 `#include <tonemapping_fragment>`、`#include <colorspace_fragment>`。

2. **若要支援舊平台 / 無 sRGB Texture：**
   - 在 JS 端偵測是否支援 sRGB 內部格式。
   - 若不支援，則在 `ShaderMaterial` 的 `defines` 中加上 `USE_MANUAL_GAMMA_DECODE`，讓 shader 啟用 `pow(2.2)`。

3. **統一曝光與環境強度邏輯：**
   - 確保自訂 shader 在沒有任何特殊效果（無 matcap、無 rim、無 flash）時，輸出顏色接近於原本的 `MeshStandardMaterial`：
     - BaseColor / BaseMap 一樣、光源一致、tone mapping 一致。
   - 之後再疊加 Matcap / Rim / Flash 時，偏差才會在「效果強度」而不是「系統性顏色」。

4. **建立測試流程：**
   - 對同一模型：
     1. 使用 `MeshStandardMaterial` 截圖作為參考。
     2. 啟用自訂 shader（僅 BaseColor，不開啟特效）再截一張。  
     3. 比較兩張圖的平均亮度與顏色差異（肉眼或工具）。  
   - 當兩張圖的色感接近時，代表顏色管線已經對齊，之後再調整特效強度就會比較直覺。

---

## 7. 總結

- three.js 預設管線的關鍵在於：**Linear 工作流程 + ACES Filmic tone mapping + sRGB 輸出**。  
- 目前自訂 shader 與三者之間存在：
  - 可能的 **雙重 sRGB→Linear 解碼**
  - **缺少 tone mapping**
  - 自行做 Linear→sRGB 而沒有經過 three.js 的色彩管理
- 要達成「所有模型都泛用、與 three.js 接近的顏色」，建議：
  1. 讓自訂 shader 的計算完全在 Linear 空間完成；  
  2. 不在 shader 內手動做 γ 編碼，而是交給 three.js 的 `<tonemapping_fragment>` + `<colorspace_fragment>`；  
  3. 透過貼圖 `colorSpace` 與平台偵測決定是否需要手動 sRGB 解碼。  

只要這三點一致，three.js 預設材質與自訂 shader 在顏色上的落差就會大幅縮小，之後的差異主要只會來自「光照模型」與「特效設計」，而不是系統性的顏色問題。




