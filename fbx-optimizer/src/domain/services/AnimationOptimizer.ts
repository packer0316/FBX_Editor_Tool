import * as THREE from 'three';

/**
 * 優化動畫片段 (Animation Clip)
 * 透過移除線性插值中多餘的關鍵幀來減小數據量。
 */
export class AnimationOptimizer {
    /**
     * 優化動畫片段
     * 
     * @param originalClip 原始的 AnimationClip
     * @param tolerance 誤差容忍度 (0 = 不優化, 值越大刪除越多)
     * @returns 優化後的 AnimationClip
     */
    optimize(originalClip: THREE.AnimationClip, tolerance: number): THREE.AnimationClip {
        if (tolerance <= 0) {
            return originalClip.clone();
        }

        const optimizedTracks: THREE.KeyframeTrack[] = [];

        // 遍歷所有軌道 (Tracks)
        for (const track of originalClip.tracks) {
            const optimizedTrack = this.optimizeTrack(track, tolerance);
            optimizedTracks.push(optimizedTrack);
        }

        // 建立新的 AnimationClip
        return new THREE.AnimationClip(originalClip.name, originalClip.duration, optimizedTracks);
    }

    /**
     * 優化單個軌道 (Track)
     * 
     * 對單個 KeyframeTrack 進行優化，移除可以線性插值近似的關鍵幀。
     * 此方法會保留第一幀和最後一幀，並對中間的關鍵幀進行評估。
     * 
     * @param track - 要優化的 KeyframeTrack
     * @param tolerance - 誤差容忍度，與 optimize 方法相同
     * @returns 優化後的 KeyframeTrack，包含更少的關鍵幀
     * @private
     */
    private optimizeTrack(track: THREE.KeyframeTrack, tolerance: number): THREE.KeyframeTrack {
        const times = track.times;
        const values = track.values;
        const stride = track.getValueSize(); // 每個關鍵幀的數值數量 (例如 Vector3 是 3, Quaternion 是 4)

        const newTimes: number[] = [];
        const newValues: number[] = [];

        // 總是保留第一幀
        newTimes.push(times[0]);
        for (let valueIndex = 0; valueIndex < stride; valueIndex++) {
            newValues.push(values[valueIndex]);
        }

        let lastKeptIndex = 0;

        // 從第二幀遍歷到倒數第二幀
        for (let currentKeyframeIndex = 1; currentKeyframeIndex < times.length - 1; currentKeyframeIndex++) {
            const nextKeyframeIndex = currentKeyframeIndex + 1;

            // 檢查當前幀是否可以被移除
            // 判斷依據：當前幀的數值是否可以由 "上一保留幀" 和 "下一幀" 線性插值近似
            const previousKeptTime = times[lastKeptIndex];
            const nextKeyframeTime = times[nextKeyframeIndex];
            const currentKeyframeTime = times[currentKeyframeIndex];

            // 計算插值比例 (0~1)
            const interpolationAlpha = (currentKeyframeTime - previousKeptTime) / (nextKeyframeTime - previousKeptTime);

            let canRemoveKeyframe = true;

            for (let valueIndex = 0; valueIndex < stride; valueIndex++) {
                const previousKeptValue = values[lastKeptIndex * stride + valueIndex];
                const nextKeyframeValue = values[nextKeyframeIndex * stride + valueIndex];
                const currentKeyframeValue = values[currentKeyframeIndex * stride + valueIndex];

                // 線性插值預測值
                const interpolatedValue = previousKeptValue + (nextKeyframeValue - previousKeptValue) * interpolationAlpha;

                // 檢查誤差
                if (Math.abs(currentKeyframeValue - interpolatedValue) > tolerance) {
                    canRemoveKeyframe = false;
                    break;
                }
            }

            // 如果不能移除，則保留此幀，並更新 lastKeptIndex
            if (!canRemoveKeyframe) {
                newTimes.push(times[currentKeyframeIndex]);
                for (let valueIndex = 0; valueIndex < stride; valueIndex++) {
                    newValues.push(values[currentKeyframeIndex * stride + valueIndex]);
                }
                lastKeptIndex = currentKeyframeIndex;
            }
        }

        // 總是保留最後一幀
        const lastKeyframeIndex = times.length - 1;
        if (lastKeyframeIndex > 0) {
            newTimes.push(times[lastKeyframeIndex]);
            for (let valueIndex = 0; valueIndex < stride; valueIndex++) {
                newValues.push(values[lastKeyframeIndex * stride + valueIndex]);
            }
        }

        // 根據原始軌道類型建立新軌道
        const TrackConstructor = track.constructor as any;
        return new TrackConstructor(track.name, newTimes, newValues);
    }
}

