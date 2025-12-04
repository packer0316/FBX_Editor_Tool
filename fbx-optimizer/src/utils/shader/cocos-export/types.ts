/**
 * Cocos Creator Shader 匯出功能 - 類型定義
 */

/**
 * 字串或函數型態，用於支援動態生成 shader 片段
 * 函數接收 params 參數，回傳對應的 shader 程式碼
 */
export type StringOrFn = string | ((params: Record<string, any>) => string);

/**
 * Shader 功能模組介面
 * 每個功能（Matcap、Normal Map 等）都是一個獨立模組
 * 欄位可以是字串或函數，函數會接收 params 動態生成對應程式碼
 */
export interface ShaderFeatureModule {
  /** 模組名稱（對應 ShaderFeatureType） */
  name: string;
  
  /** 
   * 生成 CCEffect properties 區塊
   * @param params UI 設定的參數值
   */
  properties: (params: Record<string, any>) => string;
  
  /** Uniform 區塊定義（fragment shader 中的 uniform 宣告） */
  uniforms: StringOrFn;
  
  /** Vertex Shader 需要的 varying/attribute 宣告 */
  vertexDeclarations: StringOrFn;
  
  /** Vertex Shader 主函數內的計算程式碼 */
  vertexMain: StringOrFn;
  
  /** Fragment Shader 需要的 varying/函數宣告 */
  fragmentDeclarations: StringOrFn;
  
  /** Fragment Shader 主函數內的計算程式碼 */
  fragmentMain: StringOrFn;
  
  /** 依賴的其他模組（如 Normal Map 需要 tangent） */
  dependencies?: string[];
}

/**
 * 匯出選項
 */
export interface ExportOptions {
  /** 檔案名稱（不含副檔名） */
  fileName: string;
  
  /** 是否包含 transparent technique */
  includeTransparent?: boolean;
  
  /** 是否包含 shadow-caster pass */
  includeShadowCaster?: boolean;
}

/**
 * 從 ShaderGroup 中提取的功能資訊
 */
export interface ExtractedFeature {
  type: string;
  params: Record<string, any>;
  enabled: boolean;
}

/**
 * 生成器上下文，用於在模組間共享狀態
 */
export interface GeneratorContext {
  /** 啟用的功能列表 */
  enabledFeatures: ExtractedFeature[];
  
  /** 是否使用 Normal Map（影響其他模組的法線計算） */
  hasNormalMap: boolean;
  
  /** 是否使用 RGB 通道遮罩模式 */
  hasRGBMask: boolean;
}

