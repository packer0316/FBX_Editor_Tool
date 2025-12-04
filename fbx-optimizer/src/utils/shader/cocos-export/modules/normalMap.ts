/**
 * Normal Map 功能模組
 * 
 * 支援參數：
 * - strength: 法線強度
 * - nonColor: 是否為 Non-Color（線性）模式，Cocos 的 value: normal 預設就是線性
 * - useUV2: 是否使用第二層 UV（a_texCoord1）
 */
import type { ShaderFeatureModule } from '../types';

export const normalMapModule: ShaderFeatureModule = {
  name: 'normal_map',
  
  // Cocos Creator 的 value: normal 預設就是線性（Non-Color）
  properties: (params) => `
        normalMap:      { value: normal }
        normalStrength: { value: ${params.strength?.toFixed(2) ?? '1.00'}, range: [0.0, 5.0], editor: { type: slider, parent: USE_NORMAL_MAP } }`,
  
  uniforms: `
  #if USE_NORMAL_MAP
    uniform sampler2D normalMap;
  #endif`,
  
  // 根據 useUV2 決定是否宣告專用的 normal map UV
  vertexDeclarations: (params) => {
    const useUV2 = params.useUV2 ?? false;
    if (useUV2) {
      return `
  #if USE_NORMAL_MAP
    in vec2 a_texCoord1;  // 第二層 UV 輸入
    out mediump vec4 v_tangent;
    out vec2 v_uv_normal;  // 法線貼圖專用 UV（第二層）
  #endif`;
    }
    return `
  #if USE_NORMAL_MAP
    out mediump vec4 v_tangent;
  #endif`;
  },
  
  // 根據 useUV2 決定 UV 來源
  vertexMain: (params) => {
    const useUV2 = params.useUV2 ?? false;
    if (useUV2) {
      return `
    #if USE_NORMAL_MAP
      v_tangent.xyz = normalize((matWorld * vec4(In.tangent.xyz, 0.0)).xyz);
      v_tangent.w = In.tangent.w;
      v_uv_normal = a_texCoord1;  // 使用第二層 UV
    #endif`;
    }
    return `
    #if USE_NORMAL_MAP
      v_tangent.xyz = normalize((matWorld * vec4(In.tangent.xyz, 0.0)).xyz);
      v_tangent.w = In.tangent.w;
    #endif`;
  },
  
  // 根據 useUV2 決定是否宣告 v_uv_normal
  fragmentDeclarations: (params) => {
    const useUV2 = params.useUV2 ?? false;
    return `
  #if USE_NORMAL_MAP
    in mediump vec4 v_tangent;${useUV2 ? '\n    in vec2 v_uv_normal;' : ''}
    uniform NormalMapValue {
      float normalStrength;
    };
  #endif`;
  },
  
  // 根據 useUV2 決定使用哪個 UV 採樣
  fragmentMain: (params) => {
    const useUV2 = params.useUV2 ?? false;
    const uvVar = useUV2 ? 'v_uv_normal' : 'v_uv';
    return `
    #if USE_NORMAL_MAP
      vec3 nmmp = texture(normalMap, ${uvVar}).xyz - vec3(0.5);
      vec3 bitangent = cross(v_worldNormal, v_tangent.xyz) * (v_tangent.w > 0.0 ? 1.0 : -1.0);
      finalNormal = normalize(
        (nmmp.x * normalStrength) * normalize(v_tangent.xyz) +
        (nmmp.y * normalStrength) * normalize(bitangent) +
        nmmp.z * normalize(v_worldNormal)
      );
    #endif`;
  },
  
  dependencies: []
};

