import * as THREE from 'three';

/**
 * 優化動畫片段 (Animation Clip)
 * 透過移除線性插值中多餘的關鍵幀來減小數據量。
 * 
 * @param originalClip 原始的 AnimationClip
 * @param tolerance 誤差容忍度 (0 = 不優化, 值越大刪除越多)
 * @returns 優化後的 AnimationClip
 */
export function optimizeAnimationClip(originalClip: THREE.AnimationClip, tolerance: number): THREE.AnimationClip {
    if (tolerance <= 0) {
        return originalClip.clone();
    }

    const optimizedTracks: THREE.KeyframeTrack[] = [];

    // 遍歷所有軌道 (Tracks)
    for (const track of originalClip.tracks) {
        const optimizedTrack = optimizeTrack(track, tolerance);
        optimizedTracks.push(optimizedTrack);
    }

    // 建立新的 AnimationClip
    return new THREE.AnimationClip(originalClip.name, originalClip.duration, optimizedTracks);
}

/**
 * 優化單個軌道 (Track)
 */
function optimizeTrack(track: THREE.KeyframeTrack, tolerance: number): THREE.KeyframeTrack {
    const times = track.times;
    const values = track.values;
    const stride = track.getValueSize(); // 每個關鍵幀的數值數量 (例如 Vector3 是 3, Quaternion 是 4)

    const newTimes: number[] = [];
    const newValues: number[] = [];

    // 總是保留第一幀
    newTimes.push(times[0]);
    for (let k = 0; k < stride; k++) {
        newValues.push(values[k]);
    }

    let lastKeptIndex = 0;

    // 從第二幀遍歷到倒數第二幀
    for (let i = 1; i < times.length - 1; i++) {
        const nextIndex = i + 1;

        // 檢查當前幀是否可以被移除
        // 判斷依據：當前幀的數值是否可以由 "上一保留幀" 和 "下一幀" 線性插值近似
        const t0 = times[lastKeptIndex];
        const t1 = times[nextIndex];
        const tCurrent = times[i];

        // 計算插值比例 (0~1)
        const alpha = (tCurrent - t0) / (t1 - t0);

        let canRemove = true;

        for (let k = 0; k < stride; k++) {
            const v0 = values[lastKeptIndex * stride + k];
            const v1 = values[nextIndex * stride + k];
            const vCurrent = values[i * stride + k];

            // 線性插值預測值
            const vInterpolated = v0 + (v1 - v0) * alpha;

            // 檢查誤差
            if (Math.abs(vCurrent - vInterpolated) > tolerance) {
                canRemove = false;
                break;
            }
        }

        // 如果不能移除，則保留此幀，並更新 lastKeptIndex
        if (!canRemove) {
            newTimes.push(times[i]);
            for (let k = 0; k < stride; k++) {
                newValues.push(values[i * stride + k]);
            }
            lastKeptIndex = i;
        }
    }

    // 總是保留最後一幀
    const lastIndex = times.length - 1;
    if (lastIndex > 0) {
        newTimes.push(times[lastIndex]);
        for (let k = 0; k < stride; k++) {
            newValues.push(values[lastIndex * stride + k]);
        }
    }

    // 根據原始軌道類型建立新軌道
    const TrackConstructor = track.constructor as any;
    return new TrackConstructor(track.name, newTimes, newValues);
}
