// 向後兼容：重新導出到新位置
import { AnimationOptimizer } from '../domain/services/AnimationOptimizer';
import { copyClipIdentifier, type IdentifiableClip } from './clip/clipIdentifierUtils';

const optimizer = new AnimationOptimizer();

export function optimizeAnimationClip(originalClip: IdentifiableClip, tolerance: number): IdentifiableClip {
    const optimizedClip = optimizer.optimize(originalClip, tolerance) as IdentifiableClip;
    copyClipIdentifier(originalClip, optimizedClip, false);
    return optimizedClip;
}
