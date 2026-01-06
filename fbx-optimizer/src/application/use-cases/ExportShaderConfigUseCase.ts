/**
 * ExportShaderConfigUseCase - 匯出 Shader 配置為 ZIP 檔案
 * 
 * 功能：
 * 1. 收集所有 ShaderGroup 配置
 * 2. 提取所有使用的貼圖檔案
 * 3. 打包成 ZIP 檔案（config.json + textures/）
 * 4. 下載
 */

import JSZip from 'jszip';
import type { ShaderGroup } from '../../domain/value-objects/ShaderFeature';
import type { ShaderConfigExport, ShaderGroupExport, ShaderFeatureExport, TextureFileInfo } from '../../domain/value-objects/ShaderConfig';

export class ExportShaderConfigUseCase {
  /**
   * 匯出 Shader 配置為 ZIP 檔案
   * 
   * @param shaderGroups - 要匯出的 ShaderGroup 陣列
   * @param modelName - 模型名稱（可選，用於檔名）
   */
  public static async execute(
    shaderGroups: ShaderGroup[],
    modelName?: string
  ): Promise<void> {
    try {
      const zip = new JSZip();
      const textureFiles: TextureFileInfo[] = [];
      let textureCounter = 0;

      // 複製 shaderGroups 並收集貼圖檔案
      const exportGroups: ShaderGroupExport[] = shaderGroups.map((group) => {
        const exportFeatures: ShaderFeatureExport[] = group.features.map((feature) => {
          const exportParams: Record<string, any> = {};

          // 處理每個參數
          Object.entries(feature.params).forEach(([key, value]) => {
            // 如果是貼圖參數（File 物件）
            if (value instanceof File) {
              textureCounter++;
              const extension = value.name.split('.').pop() || 'png';
              const relativePath = `textures/${key}_${textureCounter}.${extension}`;
              
              textureFiles.push({
                paramPath: `${group.id}.${feature.id}.${key}`,
                file: value,
                relativePath
              });

              exportParams[key] = relativePath;
            } 
            // 如果是其他類型（數字、字串、布林等）
            else {
              exportParams[key] = value;
            }
          });

          return {
            type: feature.type,
            name: feature.name,
            description: feature.description,
            icon: feature.icon,
            enabled: feature.enabled,
            params: exportParams
          };
        });

        return {
          id: group.id,
          name: group.name,
          selectedMeshes: group.selectedMeshes,
          features: exportFeatures,
          enabled: group.enabled ?? true
        };
      });

      // 建立 config.json
      const config: ShaderConfigExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        modelName: modelName,
        shaderGroups: exportGroups
      };

      // 加入 config.json 到 ZIP
      zip.file('config.json', JSON.stringify(config, null, 2));

      // 加入所有貼圖檔案到 ZIP
      for (const textureInfo of textureFiles) {
        const arrayBuffer = await textureInfo.file.arrayBuffer();
        zip.file(textureInfo.relativePath, arrayBuffer);
      }

      // 生成 ZIP 並下載
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -10);
      const fileName = modelName ? `shader_${modelName}_${timestamp}` : `shader_config_${timestamp}`;
      link.download = `${fileName}.zip`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理
      setTimeout(() => URL.revokeObjectURL(url), 100);

      console.log(`✅ Shader 配置已匯出: ${link.download}`);
      console.log(`   - 包含 ${textureFiles.length} 個貼圖檔案`);
    } catch (error) {
      console.error('❌ 匯出 Shader 配置失敗:', error);
      throw error;
    }
  }
}

