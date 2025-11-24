# 模型亮度一致性分析與優化方案

## 1. 問題概述
將 FBX 或其他模型載入目前的 React Three Fiber Viewport（`SceneViewer`）後，成品普遍比 3ds Max 與 Cocos Creator 暗，當套用自訂 material shader（例如 `shaderScript/3d-unlit-custom_matcap_OPTIMIZED.effect`）時，亮度差距更為明顯。這代表載入流程的色彩管理、燈光校正與著色器實作都與內容產製軟體不一致，導致最終輸出偏暗。

## 2. 造成偏暗的主要因素
1. **色彩空間 / Gamma 不一致**  
   - `SceneViewer` 中的 `<Canvas>` 未強制 `gl.outputColorSpace = THREE.SRGBColorSpace`，貼圖也沒有統一 `encoding`，導致在 Linear 空間渲染卻於 sRGB 螢幕顯示而無 Gamma 補償。  
   - 自訂 matcap shader 直接輸出 `finalColor`，缺少 `linear → sRGB` 的轉換，也未將貼圖樣本轉回 Linear，再與燈光混合。

2. **Tone Mapping 與曝光差異**  
   - 3ds Max / Cocos Creator 預設採用 ACES 或 Gamma 2.2 曲線並可調曝光；Viewer 沒有 tone mapping，因此高光被壓暗。  

3. **燈光 Rig 與環境差異**  
   - 目前僅使用 1 個 ambient + 3 個 directional light，缺少 HDR 環境光與反射。Max/Cocos 常結合 IBL + Skylight，提供更高基底亮度。  
   - Directional light 的強度（1.2 / 0.6 / 0.4）未對應到實際單位，與內容端的光源能量不同。

4. **材質參數轉換遺漏**  
   - 3ds Max/Cocos 輸出的 BaseColor、Roughness、Metallic 等參數在載入後未被正規化，部分 mesh 被自訂 matcap 替換時完全脫離 PBR，導致顏色失真。  
   - Matcap/Unlit shader 缺少曝光、色溫、View Dependent 補償，造成套用 shader 時更暗。

5. **缺乏基準校正流程**  
   - 沒有 “參考球”（gray card + chrome ball）用來比對，導致美術端無法快速調整亮度到一致水準。

## 3. 診斷流程（建議每次引入新資產時執行）
1. **建立比較場景**：同一模型放在 3ds Max、Cocos Creator 與 Viewer，使用同一套 HDR + 光源。  
2. **確認色彩空間**：檢查所有 BaseColor / Emissive 貼圖是否為 sRGB，Metal/Rough/Normal 是否為 Linear。  
3. **開啟 Tone Mapping 分析**：在 Viewer 中動態切換 `ACESFilmic`, `Reinhard`, `Linear` 並記錄曝光差異。  
4. **比對 Matcap Shader 輸出**：以純白貼圖測試 shader，確認是否在 gamma 空間混色。  
5. **量測 Luminance**：擷取螢幕後以 NIT 或 0~255 分析，確認亮度偏差百分比，將結果寫回測試紀錄。

## 4. 優化方案與步驟

### 4.1 色彩管理統一
1. 在 `<Canvas>` 透過 `gl={(canvas) => { canvas.outputColorSpace = THREE.SRGBColorSpace; canvas.toneMapping = THREE.ACESFilmicToneMapping; }}` 統一輸出。  
2. 模型載入後遍歷 `map`, `emissiveMap`, `matcap`, `flash`, `dissolve` 等貼圖：  
   - BaseColor / Matcap / Emissive → `texture.encoding = THREE.sRGBEncoding`.  
   - Normal / Metallic / Roughness / Mask → `LinearEncoding`.  
3. 在 `shaderScript` 的 fragment shader 中：  
   - 取樣貼圖後先 `vec3 albedo = pow(textureColor.rgb, vec3(2.2));`（sRGB → Linear）。  
   - 所有顏色運算完成後 `finalColor = pow(finalColor, vec3(1.0/2.2));`（Linear → sRGB）再輸出。  
4. 鎖定 `THREE.ColorManagement.enabled = true`，避免 r3f 不同版本的預設差異。

### 4.2 Tone Mapping 與曝光
1. 選擇 ACESFilmic 作為預設 tone mapping，暴露 `toneMappingExposure` 與 `whitePoint` 於 UI。  
2. 建立 “相機預設” 列表（室外/室內/夜間）供美術選擇曝光，並將設定同步到 `SceneViewer`.  
3. 匯入同一 HDRI（例如 3ds Max 用的 skylight HDR），並以 `PMREMGenerator` 轉成 prefiltered cube map，確保 IBL 亮度一致。

### 4.3 光源校正
1. 使用物理單位：`directionalLight.intensity = lux / PI`，依 3ds Max 場景設定轉換。  
2. 將主光、補光、背光儲存在可配置檔，允許美術以數字比對。  
3. 增加 `EnvironmentLight`（IBL）強度控制，讓模型在無 shader 加持時也能獲得一致基底亮度。  
4. 針對陰影：啟用 `castShadow` + 接地 plane `receiveShadow`，同時設定 `shadow.bias` 避免自陰影使模型看起來更暗。

### 4.4 材質 / Shader 校正
1. **PBR 材質**  
   - 讀取 FBX 後建立 `MeshStandardMaterial`，確保 `metalness`, `roughness`, `emissiveIntensity` 依原來源縮放。  
   - 若來源使用 “Spec-Gloss” workflow，需在讀取階段轉換為 Metal-Rough（可參考 Babylon.js / GLTF pipeline）。

2. **自訂 Matcap Shader**  
   - 在 uniforms 中加入 `exposure`, `gamma`, `ambientIntensity`，允許 UI 控制。  
   - 將 matcap / additive matcap 的輸出做 `finalColor = mix(linearBase, linearMatcap, weight)`。  
   - 為 shader 加入 `#ifdef USE_TONEMAP`，可套用 ACES 曲線，確保與 PBR 管線一致。

3. **貼圖前處理**  
   - 建立簡易紋理工具，匯入貼圖後自動檢查是否為 sRGB/Linear，並紀錄在 metadata 供 shader 使用。  
   - 對於舊素材若亮度不足，可於匯入時套用 LUT 或曝光補償，再儲存新版本。

### 4.5 美術驗收流程
1. **Reference Kit**：提供灰球 (18% gray) + 鏡面球 + Color Checker 作為 Viewer 預設場景，任何模型匯入前，先確認這些參考的亮度是否與 3ds Max/Cocos 一致。  
2. **自動截圖比較**：建立 `npm run snapshot` 腳本，載入相同模型後在 3 個平台各截一次圖，使用 SSIM 或 Delta-E 評估差異。  
3. **校正報告**：在 CI 中輸出差異報表，若亮度誤差 > 5% 則標記為需調整。  
4. **文件化設定**：維護一份 `lighting-presets.md`，列出 HDRI、光源強度、色溫、曝光值，確保跨專案一致。

## 5. 未來建議
- 導入 `glTF` + `KHR_materials_variants` 以保留更多材質屬性，減少 FBX 轉換資訊流失。  
- 若需要與 Cocos Runtime 一致，可將 shader 改寫成 HLSL/GLSL 共用核心，並用 preprocessor 控制差異。  
- 建立 “Look Dev” 模式，允許在 Viewer 中選擇不同渲染 profile（例如 “Max 相機”、“Creator 相機”）以快速比對。  

---
> **執行建議**：先實作色彩管理與 tone mapping（4.1、4.2），再調整燈光與 shader。若一次完成過多修改，很難追蹤哪一項帶來改善，因此建議逐項啟用並拍攝對照圖。

