/**
 * Cocos Creator Shader 生成器
 * 負責收集模組並拼接成完整的 .effect 檔案
 */
import type { ShaderFeatureModule, ExtractedFeature, GeneratorContext, StringOrFn } from './types';
import type { ShaderGroup, ShaderFeature } from '../../../domain/value-objects/ShaderFeature';

/**
 * 解析 StringOrFn 類型的欄位
 * 如果是函數則執行並傳入 params，否則直接返回字串
 */
function resolveStringOrFn(value: StringOrFn, params: Record<string, any>): string {
  if (typeof value === 'function') {
    return value(params);
  }
  return value;
}
import {
  vertexIncludes,
  vertexBaseIO,
  vertexMainBase,
  fragmentIncludes,
  fragmentBaseIO,
  fragmentBaseUniforms,
  fragmentMainStart,
  fragmentMainEnd,
  baseProperties
} from './templates/base';
import { generateCCEffect, generateVertexProgram, generateFragmentProgram } from './templates/techniques';

// 匯入所有模組
import { matcapModule } from './modules/matcap';
import { matcapAddModule } from './modules/matcapAdd';
import { normalMapModule } from './modules/normalMap';
import { rimLightModule } from './modules/rimLight';
import { bleachModule } from './modules/bleach';
import { dissolveModule } from './modules/dissolve';
import { flashModule } from './modules/flash';
import { alphaTestModule } from './modules/alphaTest';

/**
 * 功能模組註冊表
 */
const moduleRegistry: Record<string, ShaderFeatureModule> = {
  'matcap': matcapModule,
  'matcap_add': matcapAddModule,
  'normal_map': normalMapModule,
  'rim_light': rimLightModule,
  'bleach': bleachModule,
  'dissolve': dissolveModule,
  'flash': flashModule,
  'alpha_test': alphaTestModule,
};

/**
 * 從 ShaderGroup 中提取啟用的功能
 */
function extractFeatures(group: ShaderGroup): ExtractedFeature[] {
  return group.features
    .filter((f: ShaderFeature) => f.enabled !== false)
    .map((f: ShaderFeature) => ({
      type: f.type,
      params: f.params,
      enabled: f.enabled !== false
    }));
}

/**
 * 檢查特定 feature 是否使用 RGB 通道遮罩模式
 */
function isFeatureRGBMode(feature: ExtractedFeature): boolean {
  if (feature.type !== 'matcap' && feature.type !== 'matcap_add') {
    return false;
  }
  return !!(
    feature.params.useMaskR ||
    feature.params.useMaskG ||
    feature.params.useMaskB
  );
}

/**
 * 檢查是否有任何 matcap 使用 RGB 通道遮罩模式
 */
function checkRGBMaskMode(features: ExtractedFeature[]): boolean {
  return features.some(f => isFeatureRGBMode(f));
}

/**
 * 獲取 feature 的 params，並根據需要注入 isRGBMode
 */
function getFeatureParams(feature: ExtractedFeature): Record<string, any> {
  if (feature.type === 'matcap' || feature.type === 'matcap_add') {
    return {
      ...feature.params,
      isRGBMode: isFeatureRGBMode(feature)
    };
  }
  return feature.params;
}

/**
 * 生成 properties 區塊
 */
function generateProperties(features: ExtractedFeature[], _context: GeneratorContext): string {
  let properties = baseProperties;
  
  for (const feature of features) {
    const module = moduleRegistry[feature.type];
    if (module) {
      const params = getFeatureParams(feature);
      properties += module.properties(params);
    }
  }
  
  return properties;
}

/**
 * 生成 Vertex Shader
 */
function generateVertexShader(features: ExtractedFeature[], _context: GeneratorContext): string {
  // 收集所有模組的 vertex declarations
  let declarations = vertexBaseIO;
  let mainCustomCode = '';
  
  for (const feature of features) {
    const module = moduleRegistry[feature.type];
    if (module) {
      const params = getFeatureParams(feature);
      const vertexDecl = resolveStringOrFn(module.vertexDeclarations, params);
      const vertexMain = resolveStringOrFn(module.vertexMain, params);
      
      if (vertexDecl) {
        declarations += vertexDecl;
      }
      if (vertexMain) {
        mainCustomCode += vertexMain;
      }
    }
  }
  
  // 替換 vertex main 中的佔位符
  const mainFunction = vertexMainBase.replace('{{VERTEX_CUSTOM}}', mainCustomCode);
  
  return generateVertexProgram(vertexIncludes, declarations, mainFunction);
}

/**
 * 生成 Fragment Shader
 */
function generateFragmentShader(features: ExtractedFeature[], _context: GeneratorContext): string {
  // 收集所有模組的 uniforms 和 declarations
  let uniforms = '';
  let declarations = fragmentBaseIO;
  let mainCode = '';
  
  // 收集常量 uniform（放入 Constant 區塊）
  const constantUniforms: string[] = [];
  
  for (const feature of features) {
    const module = moduleRegistry[feature.type];
    if (module) {
      const params = getFeatureParams(feature);
      const moduleUniforms = resolveStringOrFn(module.uniforms, params);
      const fragmentDecl = resolveStringOrFn(module.fragmentDeclarations, params);
      const fragmentMain = resolveStringOrFn(module.fragmentMain, params);
      
      if (moduleUniforms) {
        uniforms += moduleUniforms;
      }
      if (fragmentDecl) {
        declarations += fragmentDecl;
      }
      if (fragmentMain) {
        mainCode += fragmentMain;
      }
    }
  }
  
  // 組合 uniforms
  const baseUniformsBlock = fragmentBaseUniforms.replace('{{CONSTANT_UNIFORMS}}', constantUniforms.join('\n    '));
  declarations += '\n' + baseUniformsBlock;
  declarations += '\n' + uniforms;
  
  // 組合 main 函數
  const mainFunction = fragmentMainStart + '\n' + mainCode + '\n' + fragmentMainEnd;
  
  return generateFragmentProgram(fragmentIncludes, declarations, mainFunction);
}

/**
 * 生成完整的 .effect 檔案內容
 */
export function generateShaderFile(group: ShaderGroup): string {
  // 1. 提取啟用的功能
  const features = extractFeatures(group);
  
  if (features.length === 0) {
    throw new Error('沒有啟用任何 shader 功能');
  }
  
  // 2. 建立上下文
  const context: GeneratorContext = {
    enabledFeatures: features,
    hasNormalMap: features.some(f => f.type === 'normal_map'),
    hasRGBMask: checkRGBMaskMode(features)
  };
  
  // 3. 生成各區塊
  const properties = generateProperties(features, context);
  const vertexShader = generateVertexShader(features, context);
  const fragmentShader = generateFragmentShader(features, context);
  
  // 4. 組合完整檔案
  const ccEffect = generateCCEffect(properties);
  
  return ccEffect + vertexShader + fragmentShader;
}

/**
 * 下載 .effect 檔案
 */
export function downloadShaderFile(group: ShaderGroup, fileName?: string): void {
  try {
    const content = generateShaderFile(group);
    const name = fileName || group.name || 'custom-shader';
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.effect`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('匯出 shader 失敗:', error);
    throw error;
  }
}
