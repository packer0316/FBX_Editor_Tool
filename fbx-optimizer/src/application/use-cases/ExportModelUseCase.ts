import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

/**
 * 導出模型 Use Case
 * 
 * 負責協調模型導出的業務邏輯，將優化後的模型和動畫片段導出為 GLB 格式。
 * 此 Use Case 會：
 * - 複製模型以避免修改原始物件
 * - 將優化的動畫片段附加到模型
 * - 使用 GLTFExporter 導出為 GLB 格式
 * - 自動觸發瀏覽器下載
 * 
 * @example
 * ```typescript
 * await ExportModelUseCase.execute(model, optimizedClip, 'myModel.fbx');
 * // 瀏覽器會自動下載 optimized_myModel.glb
 * ```
 */
export class ExportModelUseCase {
  /**
   * 執行模型導出
   * 
   * @param model - 要導出的 Three.js 模型群組
   * @param clip - 要附加到模型的動畫片段（通常是優化後的片段）
   * @param fileName - 原始檔案名稱（用於生成下載檔名，會自動移除 .fbx 副檔名）
   * @returns Promise，當導出成功時解析，失敗時拒絕
   * @throws {Error} 當導出過程發生錯誤時拋出 '導出失敗' 錯誤
   * 
   * @example
   * ```typescript
   * try {
   *   await ExportModelUseCase.execute(model, optimizedClip, 'character.fbx');
   *   alert('導出成功！');
   * } catch (error) {
   *   console.error('導出失敗:', error);
   * }
   * ```
   */
  static async execute(
    model: THREE.Group,
    clip: THREE.AnimationClip,
    fileName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 複製模型以避免修改原始物件
        const exportModel = model.clone();

        // 替換動畫
        exportModel.animations = [clip];

        // 導出為 GLB
        const exporter = new GLTFExporter();
        exporter.parse(
          exportModel,
          (glbArrayBuffer: ArrayBuffer | { [key: string]: any }) => {
            if (!(glbArrayBuffer instanceof ArrayBuffer)) {
              throw new Error('Expected ArrayBuffer from GLTFExporter');
            }
            const blob = new Blob([glbArrayBuffer], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `optimized_${fileName.replace('.fbx', '') || 'model'}.glb`;
            link.click();
            resolve();
          },
          (error: Error) => {
            console.error('Export failed:', error);
            reject(new Error('導出失敗'));
          },
          { binary: true }
        );
      } catch (error) {
        console.error('Export failed:', error);
        reject(new Error('導出失敗'));
      }
    });
  }
}

