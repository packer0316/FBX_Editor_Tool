/**
 * EffectHandleRegistry - 追蹤正在播放且綁定到骨骼的特效
 * 
 * 負責管理特效 Handle 的生命週期，並在每幀更新綁定骨骼的特效位置
 */

import * as THREE from 'three';

interface TrackedEffect {
    handle: effekseer.EffekseerHandle;
    bone: THREE.Object3D;
    offset: [number, number, number];      // 位置偏移
    rotationOffset: [number, number, number]; // 旋轉偏移 (degrees)
    scale: [number, number, number];       // 縮放
    timerId?: number; // duration 計時器 ID（如果有設定 duration）
}

class EffectHandleRegistryClass {
    private trackedEffects: Map<string, TrackedEffect> = new Map();

    /**
     * 註冊一個需要跟隨骨骼的特效（通用方法）
     * 
     * @param key - 唯一識別碼
     * @param handle - Effekseer Handle
     * @param bone - 要跟隨的骨骼
     * @param offset - 位置偏移
     * @param rotationOffset - 旋轉偏移 (degrees)
     * @param scale - 縮放
     */
    register(
        key: string,
        handle: effekseer.EffekseerHandle,
        bone: THREE.Object3D,
        offset: [number, number, number] = [0, 0, 0],
        rotationOffset: [number, number, number] = [0, 0, 0],
        scale: [number, number, number] = [1, 1, 1]
    ): void {
        this.trackedEffects.set(key, {
            handle,
            bone,
            offset,
            rotationOffset,
            scale
        });
        console.log(`[EffectHandleRegistry] 註冊跟隨特效: ${key}, 骨骼: ${bone.name}`);
    }

    /**
     * 註冊一個由 Trigger 觸發的特效
     * 如果該 Trigger 已有播放中的實例，會先停止舊的再註冊新的
     * 
     * @param effectId - 特效 ID
     * @param triggerId - 觸發器 ID
     * @param handle - Effekseer Handle
     * @param bone - 要跟隨的骨骼
     * @param offset - 位置偏移
     * @param rotationOffset - 旋轉偏移 (degrees)
     * @param scale - 縮放
     * @param duration - 播放持續時間（秒），不設定則播放到特效自然結束
     */
    registerWithTrigger(
        effectId: string,
        triggerId: string,
        handle: effekseer.EffekseerHandle,
        bone: THREE.Object3D,
        offset: [number, number, number] = [0, 0, 0],
        rotationOffset: [number, number, number] = [0, 0, 0],
        scale: [number, number, number] = [1, 1, 1],
        duration?: number
    ): void {
        const key = `${effectId}-${triggerId}`;
        
        // 如果該 trigger 已有播放中的實例，先停止它（包含計時器）
        if (this.trackedEffects.has(key)) {
            const oldEffect = this.trackedEffects.get(key);
            if (oldEffect) {
                if (oldEffect.timerId !== undefined) {
                    clearTimeout(oldEffect.timerId);
                }
                if (oldEffect.handle.exists) {
                    oldEffect.handle.stop();
                }
                console.log(`[EffectHandleRegistry] 停止舊的 Trigger 實例: ${key}`);
            }
            this.trackedEffects.delete(key);
        }

        // 設定 duration 計時器（如果有指定）
        let timerId: number | undefined;
        if (duration !== undefined && duration > 0) {
            timerId = window.setTimeout(() => {
                const effect = this.trackedEffects.get(key);
                if (effect && effect.handle.exists) {
                    effect.handle.stop();
                    console.log(`[EffectHandleRegistry] Duration 到期，停止特效: ${key} (${duration}秒)`);
                }
                this.trackedEffects.delete(key);
            }, duration * 1000);
        }

        // 註冊新的實例
        this.trackedEffects.set(key, {
            handle,
            bone,
            offset,
            rotationOffset,
            scale,
            timerId
        });
        console.log(`[EffectHandleRegistry] 註冊 Trigger 特效: ${key}, 骨骼: ${bone.name}${duration ? `, duration: ${duration}秒` : ''}`);
    }

    /**
     * 移除追蹤的特效
     */
    unregister(key: string): void {
        if (this.trackedEffects.has(key)) {
            const effect = this.trackedEffects.get(key);
            if (effect?.timerId !== undefined) {
                clearTimeout(effect.timerId);
            }
            this.trackedEffects.delete(key);
            console.log(`[EffectHandleRegistry] 移除跟隨特效: ${key}`);
        }
    }

    /**
     * 更新所有追蹤中的特效位置和旋轉
     * 應該在每幀呼叫
     * 
     * 使用 setMatrix 直接設定變換矩陣，避免歐拉角順序問題
     * 位置偏移使用 Local Space（模擬 parent-child 關係）
     */
    updateAll(): void {
        const keysToRemove: string[] = [];

        this.trackedEffects.forEach((tracked, key) => {
            // 檢查 handle 是否還存在
            if (!tracked.handle.exists) {
                keysToRemove.push(key);
                return;
            }

            // 獲取骨骼的世界位置
            const boneWorldPos = new THREE.Vector3();
            tracked.bone.getWorldPosition(boneWorldPos);

            // 獲取骨骼的世界旋轉
            const boneWorldQuat = new THREE.Quaternion();
            tracked.bone.getWorldQuaternion(boneWorldQuat);

            // 將 local offset 轉換到 world space（模擬 parent-child 關係）
            const offsetVec = new THREE.Vector3(
                tracked.offset[0],
                tracked.offset[1],
                tracked.offset[2]
            );
            offsetVec.applyQuaternion(boneWorldQuat);

            // 計算最終位置 = 骨骼位置 + 轉換後的偏移量
            const finalPos = new THREE.Vector3(
                boneWorldPos.x + offsetVec.x,
                boneWorldPos.y + offsetVec.y,
                boneWorldPos.z + offsetVec.z
            );

            // 計算最終旋轉（使用 Quaternion 相乘，正確模擬 parent-child 關係）
            const offsetEuler = new THREE.Euler(
                tracked.rotationOffset[0] * Math.PI / 180,
                tracked.rotationOffset[1] * Math.PI / 180,
                tracked.rotationOffset[2] * Math.PI / 180
            );
            const offsetQuat = new THREE.Quaternion().setFromEuler(offsetEuler);
            const finalQuat = boneWorldQuat.clone().multiply(offsetQuat);

            // 縮放
            const finalScale = new THREE.Vector3(
                tracked.scale[0],
                tracked.scale[1],
                tracked.scale[2]
            );

            // 建立變換矩陣並傳給 Effekseer（避免歐拉角順序問題）
            const matrix = new THREE.Matrix4();
            matrix.compose(finalPos, finalQuat, finalScale);

            // 使用 setMatrix 直接設定變換
            tracked.handle.setMatrix(new Float32Array(matrix.elements));
        });

        // 清理已結束的特效
        keysToRemove.forEach(key => {
            this.trackedEffects.delete(key);
            console.log(`[EffectHandleRegistry] 自動清理已結束特效: ${key}`);
        });
    }

    /**
     * 停止並移除所有指定 effectId 的播放實例
     * 用於刪除 trigger 或刪除整個特效時
     * 
     * @param effectId - 特效 ID
     */
    stopAllByEffectId(effectId: string): void {
        const keysToRemove: string[] = [];
        
        this.trackedEffects.forEach((tracked, key) => {
            // 檢查 key 是否以 effectId 開頭
            if (key.startsWith(`${effectId}-`)) {
                // 清理計時器
                if (tracked.timerId !== undefined) {
                    clearTimeout(tracked.timerId);
                }
                // 停止特效
                if (tracked.handle.exists) {
                    tracked.handle.stop();
                }
                keysToRemove.push(key);
            }
        });

        keysToRemove.forEach(key => {
            this.trackedEffects.delete(key);
        });

        if (keysToRemove.length > 0) {
            console.log(`[EffectHandleRegistry] 停止 ${effectId} 的所有實例 (${keysToRemove.length} 個)`);
        }
    }

    /**
     * 停止並移除特定 Trigger 的播放實例
     * 
     * @param effectId - 特效 ID
     * @param triggerId - 觸發器 ID
     */
    stopByTrigger(effectId: string, triggerId: string): void {
        const key = `${effectId}-${triggerId}`;
        const tracked = this.trackedEffects.get(key);
        
        if (tracked) {
            // 清理計時器
            if (tracked.timerId !== undefined) {
                clearTimeout(tracked.timerId);
            }
            // 停止特效
            if (tracked.handle.exists) {
                tracked.handle.stop();
            }
            this.trackedEffects.delete(key);
            console.log(`[EffectHandleRegistry] 停止 Trigger 實例: ${key}`);
        }
    }

    /**
     * 清空所有追蹤的特效
     */
    clear(): void {
        // 停止所有播放中的特效
        this.trackedEffects.forEach((tracked) => {
            if (tracked.handle.exists) {
                tracked.handle.stop();
            }
        });
        this.trackedEffects.clear();
        console.log('[EffectHandleRegistry] 清空所有追蹤特效');
    }

    /**
     * 獲取當前追蹤的特效數量
     */
    get count(): number {
        return this.trackedEffects.size;
    }
}

// 全域單例
export const EffectHandleRegistry = new EffectHandleRegistryClass();

