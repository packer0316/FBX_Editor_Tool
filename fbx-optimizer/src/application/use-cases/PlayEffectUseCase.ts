import { getEffekseerRuntimeAdapter } from './effectRuntimeStore';

/**
 * 播放 Effekseer 特效的 Use Case
 * 
 * 在指定位置播放已載入的特效。
 */
export class PlayEffectUseCase {
    /**
     * 播放特效
     * 
     * @param params - 播放參數
     * @param params.id - 要播放的特效 ID（必須已透過 LoadEffectUseCase 載入）
     * @param params.x - 世界座標 X（預設 0）
     * @param params.y - 世界座標 Y（預設 0）
     * @param params.z - 世界座標 Z（預設 0）
     * @param params.rx - 旋轉 X (radians)
     * @param params.ry - 旋轉 Y (radians)
     * @param params.rz - 旋轉 Z (radians)
     * @param params.sx - 縮放 X
     * @param params.sy - 縮放 Y
     * @param params.sz - 縮放 Z
     * @param params.speed - 播放速度
     * @returns EffekseerHandle | null - 特效實例的 Handle，如果播放失敗則返回 null
     * 
     * @example
     * ```typescript
     * const handle = PlayEffectUseCase.execute({
     *   id: 'effect_001',
     *   x: 0,
     *   y: 1,
     *   z: 0,
     *   speed: 2.0
     * });
     * ```
     */
    public static execute(params: {
        id: string;
        x?: number; y?: number; z?: number;
        rx?: number; ry?: number; rz?: number;
        sx?: number; sy?: number; sz?: number;
        speed?: number;
    }): effekseer.EffekseerHandle | null {
        const adapter = getEffekseerRuntimeAdapter();
        const handle = adapter.play(params);

        if (handle) {
            console.log(`[PlayEffectUseCase] 特效播放成功: ${params.id}`);
        }

        return handle;
    }
}


