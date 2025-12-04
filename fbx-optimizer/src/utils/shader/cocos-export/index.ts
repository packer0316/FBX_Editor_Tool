/**
 * Cocos Creator Shader 匯出功能
 * 
 * 使用方式：
 * import { downloadShaderFile, generateShaderFile } from '@/utils/shader/cocos-export';
 * 
 * // 直接下載
 * downloadShaderFile(shaderGroup, 'my-shader');
 * 
 * // 取得內容
 * const content = generateShaderFile(shaderGroup);
 */

export { generateShaderFile, downloadShaderFile } from './generator';
export type { ShaderFeatureModule, ExportOptions, ExtractedFeature, GeneratorContext } from './types';

