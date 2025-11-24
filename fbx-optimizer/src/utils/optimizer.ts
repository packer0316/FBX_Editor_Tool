// 向後兼容：重新導出到新位置
import { AnimationOptimizer } from '../domain/services/AnimationOptimizer';

const optimizer = new AnimationOptimizer();

export function optimizeAnimationClip(originalClip: any, tolerance: number): any {
    return optimizer.optimize(originalClip, tolerance);
}
