import { getEffekseerRuntimeAdapter } from './effectRuntimeStore';

/**
 * 初始化 Effekseer WebGL Runtime 的 Use Case
 *
 * - 透過 Application 層取得 Runtime 單例
 * - 使用指定 Canvas 建立 WebGL Context 並初始化 Effekseer
 *
 * 此 Use Case 僅負責「初始化」，不處理特效載入或播放邏輯。
 */
export class InitEffekseerRuntimeUseCase {
    /**
     * 使用 Three.js 的 WebGL Context 初始化 Effekseer Runtime（官方推薦方式）
     *
     * @param params - 初始化參數
     * @param params.webglContext - Three.js renderer.getContext() 的 WebGL Context
     * @returns Promise，當 Runtime 初始化完成後解析
     * @throws {Error} 當 Effekseer 未載入或初始化失敗時
     *
     * @example
     * ```typescript
     * const webglContext = renderer.getContext();
     * await InitEffekseerRuntimeUseCase.execute({ webglContext });
     * ```
     */
    public static async execute(params: { webglContext: WebGLRenderingContext }): Promise<void> {
        const adapter = getEffekseerRuntimeAdapter();
        await adapter.initWithThreeContext(params.webglContext);
    }
}


