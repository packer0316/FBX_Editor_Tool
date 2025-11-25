import { getEffekseerRuntimeAdapter } from './effectRuntimeStore';

/**
 * Effekseer 每幀更新與渲染的 Use Case
 *
 * 由 Presentation 層（例如 SceneViewer 中的 useFrame）呼叫，
 * 負責在遊戲主迴圈中驅動 Effekseer Runtime 的 update / render。
 *
 * Phase 1 僅處理：
 * - 單一 Canvas 上的 update + draw（尚未同步相機矩陣）
 */
export class EffekseerFrameUpdateUseCase {
    /**
     * 在一個 frame 內更新與繪製 Effekseer 特效
     *
     * @param params - 每幀更新參數
     * @param params.deltaTime - 與 R3F `useFrame` 一致的秒數（s）
     *
     * @example
     * ```typescript
     * EffekseerFrameUpdateUseCase.execute({ deltaTime: delta });
     * ```
     */
    public static execute(params: { deltaTime: number }): void {
        const { deltaTime } = params;
        const adapter = getEffekseerRuntimeAdapter();
        adapter.update(deltaTime);
        adapter.render();
    }
}



