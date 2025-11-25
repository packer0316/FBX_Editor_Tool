import { getEffekseerRuntimeAdapter } from './effectRuntimeStore';

/**
 * 停止所有 Effekseer 特效的 Use Case
 * 
 * 停止當前所有正在播放的特效實例。
 */
export class StopAllEffectsUseCase {
    /**
     * 停止所有特效
     * 
     * @example
     * ```typescript
     * StopAllEffectsUseCase.execute();
     * ```
     */
    public static execute(): void {
        const adapter = getEffekseerRuntimeAdapter();
        adapter.stop();
        console.log('[StopAllEffectsUseCase] 已停止所有特效');
    }
}

