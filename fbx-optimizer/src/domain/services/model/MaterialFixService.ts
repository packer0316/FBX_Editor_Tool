import * as THREE from 'three';

/**
 * 材質修復服務
 * 
 * 負責修復 FBX 模型載入後可能出現的材質問題。許多 FBX 模型在載入到 Three.js
 * 後會出現材質顯示異常（如全黑、顏色錯誤等），此服務會自動修復這些問題。
 * 
 * 修復的項目包括：
 * - 關閉頂點顏色（避免模型變黑）
 * - 確保有貼圖時基礎顏色為白色
 * - 修復全黑問題（無貼圖且顏色為黑色時設為灰色）
 * - 重置 PBR 參數（roughness、metalness）
 * - 啟用雙面渲染（避免法線反轉導致看不見）
 * 
 * @example
 * ```typescript
 * const model = await loader.loadFBX(file);
 * MaterialFixService.fixMaterials(model);
 * scene.add(model);
 * ```
 */
export class MaterialFixService {
  /**
   * 修復模型中的所有材質
   * 
   * 遍歷模型樹狀結構，找出所有 Mesh 節點，並對每個材質執行修復操作。
   * 此方法會直接修改材質屬性，無需返回值。
   * 
   * @param model - Three.js 模型群組，將修復其中所有 mesh 的材質
   * 
   * @example
   * ```typescript
   * const model = await loadModel();
   * MaterialFixService.fixMaterials(model);
   * // 現在模型的材質應該能正常顯示了
   * ```
   */
  /**
   * 設定貼圖的色彩編碼
   * 
   * 根據貼圖類型設定正確的色彩編碼：
   * - BaseColor / Matcap / Emissive → sRGB
   * - Normal / Metallic / Roughness / Mask → Linear
   * 
   * @param texture - 貼圖物件
   * @param textureType - 貼圖類型（'baseColor' | 'matcap' | 'emissive' | 'normal' | 'metallic' | 'roughness' | 'mask' | 'other'）
   */
  private static setTextureEncoding(texture: THREE.Texture, textureType: string): void {
    if (!texture) return;

    // BaseColor / Matcap / Emissive → sRGB
    if (textureType === 'baseColor' || textureType === 'matcap' || textureType === 'emissive') {
      texture.colorSpace = THREE.SRGBColorSpace;
    } 
    // Normal / Metallic / Roughness / Mask → Linear
    else if (textureType === 'normal' || textureType === 'metallic' || textureType === 'roughness' || textureType === 'mask') {
      texture.colorSpace = THREE.LinearSRGBColorSpace;
    }
  }

  static fixMaterials(model: THREE.Group): void {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshStandardMaterial | THREE.MeshPhongMaterial;

        console.log(`[Mesh: ${mesh.name}]Material: `, material);

        if (material) {
          // 1. 關閉頂點顏色 (Vertex Colors)
          // 很多 FBX 模型會帶有頂點顏色 (通常是黑色或用作遮罩)，這會導致模型在 Three.js 中變黑
          material.vertexColors = false;

          // 2. 確保有貼圖時，基礎顏色是白色的
          if (material.map) {
            console.log(`  - Has Texture: ${material.map.name || 'Unnamed'} `);
            material.color.setHex(0xffffff);

            // 設定 BaseColor 貼圖為 sRGB
            this.setTextureEncoding(material.map, 'baseColor');
          }

          // 3. 遍歷所有貼圖並設定正確的色彩編碼
          if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = material as THREE.MeshStandardMaterial;
            
            // BaseColor / Diffuse
            if (stdMat.map) {
              this.setTextureEncoding(stdMat.map, 'baseColor');
            }
            
            // Emissive
            if (stdMat.emissiveMap) {
              this.setTextureEncoding(stdMat.emissiveMap, 'emissive');
            }
            
            // Normal
            if (stdMat.normalMap) {
              this.setTextureEncoding(stdMat.normalMap, 'normal');
            }
            
            // Metallic
            if (stdMat.metalnessMap) {
              this.setTextureEncoding(stdMat.metalnessMap, 'metallic');
            }
            
            // Roughness
            if (stdMat.roughnessMap) {
              this.setTextureEncoding(stdMat.roughnessMap, 'roughness');
            }
            
            // AO (通常也是 Linear)
            if (stdMat.aoMap) {
              this.setTextureEncoding(stdMat.aoMap, 'mask');
            }
          }

          // 4. 處理其他可能的貼圖（例如 MeshPhongMaterial 的 specularMap）
          if ((material as THREE.MeshPhongMaterial).isMeshPhongMaterial) {
            const phongMat = material as THREE.MeshPhongMaterial;
            if (phongMat.specularMap) {
              this.setTextureEncoding(phongMat.specularMap, 'mask');
            }
          }

          // 5. 嘗試修復全黑問題：如果沒有貼圖，給一個預設顏色
          if (!material.map && material.color.getHex() === 0x000000) {
            console.warn(`  - Black color detected without texture.Resetting to gray.`);
            material.color.setHex(0x888888);
          }

          // 6. 重置一些可能導致變黑的 PBR 參數
          if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = material as THREE.MeshStandardMaterial;
            stdMat.roughness = 0.7; // 避免過度光滑導致全黑反射
            stdMat.metalness = 0.1; // 避免全金屬導致全黑 (如果沒有環境貼圖)
          }

          // 7. 雙面渲染 (避免法線反轉導致看不見)
          material.side = THREE.DoubleSide;

          // 8. 確保材質更新
          material.needsUpdate = true;
        }
      }
    });
  }
}

