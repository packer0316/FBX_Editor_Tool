/**
 * ImportShaderConfigUseCase - 從 ZIP 檔案匯入 Shader 配置
 * 
 * 功能：
 * 1. 解壓縮 ZIP 檔案
 * 2. 讀取 config.json
 * 3. 載入所有貼圖檔案
 * 4. 還原 ShaderGroup 配置
 */

import JSZip from 'jszip';
import type { ShaderGroup, ShaderFeature } from '../../domain/value-objects/ShaderFeature';
import type { ShaderConfigExport } from '../../domain/value-objects/ShaderConfig';

export class ImportShaderConfigUseCase {
  /**
   * 從 ZIP 檔案匯入 Shader 配置
   * 
   * @param zipFile - ZIP 檔案
   * @returns 還原的 ShaderGroup 陣列
   */
  public static async execute(zipFile: File): Promise<ShaderGroup[]> {
    try {
      console.log('📦 開始匯入 Shader 配置:', zipFile.name);

      // 解壓縮 ZIP
      const zip = await JSZip.loadAsync(zipFile);

      // 讀取 config.json
      const configFile = zip.file('config.json');
      if (!configFile) {
        throw new Error('ZIP 檔案中找不到 config.json');
      }

      const configText = await configFile.async('text');
      const config: ShaderConfigExport = JSON.parse(configText);

      console.log('📄 Config 版本:', config.version);
      console.log('📅 匯出日期:', config.exportDate);
      console.log('📦 ShaderGroup 數量:', config.shaderGroups.length);

      // 載入所有貼圖檔案並建立映射表
      const textureMap = new Map<string, File>();

      // 遍歷 ZIP 中的 textures/ 資料夾
      const textureFiles = Object.keys(zip.files).filter(path => path.startsWith('textures/'));
      
      for (const texturePath of textureFiles) {
        const file = zip.file(texturePath);
        if (file && !file.dir) {
          const blob = await file.async('blob');
          const fileName = texturePath.split('/').pop() || texturePath;
          const fileObj = new File([blob], fileName, { type: blob.type || 'image/png' });
          textureMap.set(texturePath, fileObj);
          console.log('🖼️  載入貼圖:', texturePath);
        }
      }

      console.log(`✅ 載入 ${textureMap.size} 個貼圖檔案`);

      // 還原 ShaderGroups
      const shaderGroups: ShaderGroup[] = config.shaderGroups.map((exportGroup) => {
        const features: ShaderFeature[] = exportGroup.features.map((exportFeature) => {
          const params: Record<string, any> = {};

          // 還原參數，將貼圖路徑轉換回 File 物件
          Object.entries(exportFeature.params).forEach(([key, value]) => {
            // 如果是字串且看起來像貼圖路徑
            if (typeof value === 'string' && value.startsWith('textures/')) {
              const textureFile = textureMap.get(value);
              if (textureFile) {
                params[key] = textureFile;
                console.log(`   🔗 連結貼圖: ${key} -> ${value}`);
              } else {
                console.warn(`   ⚠️  找不到貼圖: ${value}`);
                params[key] = null;
              }
            } else {
              params[key] = value;
            }
          });

          return {
            id: `${exportFeature.type}_${Date.now()}_${Math.random()}`,
            type: exportFeature.type as any,
            name: exportFeature.name,
            description: exportFeature.description,
            icon: exportFeature.icon,
            expanded: false,
            enabled: exportFeature.enabled,
            params
          };
        });

        return {
          id: exportGroup.id || `group_${Date.now()}`,
          name: exportGroup.name,
          selectedMeshes: exportGroup.selectedMeshes,
          features,
          expanded: true
        };
      });

      console.log('✅ Shader 配置匯入成功');
      return shaderGroups;
    } catch (error) {
      console.error('❌ 匯入 Shader 配置失敗:', error);
      throw error;
    }
  }
}

