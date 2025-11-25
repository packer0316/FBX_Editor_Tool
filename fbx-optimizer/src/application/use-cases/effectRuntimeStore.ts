import { EffekseerRuntimeAdapter } from '../../infrastructure/effect/EffekseerRuntimeAdapter';

let effekseerRuntimeAdapter: EffekseerRuntimeAdapter | null = null;

/**
 * 提供 EffekseerRuntimeAdapter 的單例存取方法
 *
 * Application 層透過此方法取得同一個 Runtime 實例，
 * 避免 Presentation 直接依賴 Infrastructure。
 */
export function getEffekseerRuntimeAdapter(): EffekseerRuntimeAdapter {
    if (!effekseerRuntimeAdapter) {
        effekseerRuntimeAdapter = new EffekseerRuntimeAdapter();
    }
    return effekseerRuntimeAdapter;
}

/**
 * 檢查 Effekseer Runtime 是否已經初始化
 * 
 * @returns true 如果 Runtime 已經初始化並可以使用
 */
export function isEffekseerRuntimeReady(): boolean {
    if (!effekseerRuntimeAdapter) {
        return false;
    }
    return effekseerRuntimeAdapter.isReady();
}


