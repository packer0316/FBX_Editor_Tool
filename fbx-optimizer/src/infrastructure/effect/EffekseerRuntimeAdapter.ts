/**
 * Effekseer WebGL Runtime 適配器（雛型）
 *
 * 封裝 EffekseerForWebGL 的初始化與基本操作，未來會由 Use Case / Hook 呼叫，
 * 目前僅提供最小可用 API，支援：
 * - 使用指定的 Canvas 初始化 WebGL 與 Effekseer Runtime
 * - 載入特效檔（.efk / .efkefc / .efkp 等）並以 id 快取
 * - 播放特效（基於 effectId，位置暫時使用世界原點）
 * - 更新與渲染迴圈（update / draw）
 *
 * 注意：本類別目前只負責「與 Effekseer Runtime 溝通」，不處理骨骼綁定、
 * 時間線或 Domain Value Object，這些都會在 Application / Domain 層處理。
 *
 * @example
 * ```typescript
 * const adapter = new EffekseerRuntimeAdapter();
 * await adapter.initWithCanvas(canvasElement);
 * await adapter.loadEffect({ id: 'slash', url: '/effects/slash01.efk' });
 * adapter.play({ id: 'slash' });
 * // 在 render 迴圈中：
 * adapter.update(deltaTime);
 * adapter.render();
 * ```
 */
import * as THREE from 'three';
import { composeEffekseerMatrix } from './effekseerTransformUtils';

export class EffekseerRuntimeAdapter {
    public effekseerContext: effekseer.EffekseerContext | null = null; // 公開以供相機矩陣同步
    public loadedEffects: Map<string, effekseer.EffekseerEffect> = new Map(); // 公開以供外部載入特效
    private isRuntimeInitialized = false;

    /**
     * 檢查 Effekseer Runtime 是否已準備好可以使用
     * 
     * @returns true 如果 Runtime 已初始化且 Context 已建立
     */
    public isReady(): boolean {
        return this.isRuntimeInitialized && this.effekseerContext !== null;
    }

    /**
     * 使用 Three.js WebGL Context 初始化 Effekseer Runtime（官方推薦方式）
     *
     * @param webglContext - Three.js renderer.getContext() 返回的 WebGL Context
     * @throws {Error} 當 effekseer 未載入或 Runtime 初始化失敗時
     */
    // 儲存當前 WebGL Context 引用，用於偵測 context 變更
    private currentWebglContext: WebGLRenderingContext | null = null;

    public async initWithThreeContext(webglContext: WebGLRenderingContext): Promise<void> {
        // 檢查 WebGL Context 是否改變（例如 DPR 變更導致重新創建）
        const contextChanged = this.currentWebglContext !== null && this.currentWebglContext !== webglContext;
        
        if (contextChanged) {
            console.log('[EffekseerRuntimeAdapter] WebGL Context 已變更，重新建立 Effekseer Context...');
            // 清理舊的 context 和已載入的特效
            this.loadedEffects.clear();
            this.effekseerContext = null;
        }
        
        // 檢查是否已經完全初始化（且 context 未變更）
        if (this.isRuntimeInitialized && this.effekseerContext && !contextChanged) {
            console.log('[EffekseerRuntimeAdapter] 已經初始化完成，直接復用');
            return;
        }

        if (typeof effekseer === 'undefined') {
            throw new Error(
                '[EffekseerRuntimeAdapter] effekseer 未載入，請確認 index.html 已正確引入 /effekseer/effekseer.min.js'
            );
        }

        // 儲存當前 WebGL Context 引用
        this.currentWebglContext = webglContext;

        // 初始化 WebAssembly Runtime（只需一次，用於載入 effekseer.wasm）
        if (!this.isRuntimeInitialized) {
            await new Promise<void>((resolve, reject) => {
                try {
                    effekseer.initRuntime(
                        '/effekseer/effekseer.wasm',
                        () => {
                            console.log('[EffekseerRuntimeAdapter] WASM 載入完成');
                            resolve();
                        },
                        () => reject(new Error('[EffekseerRuntimeAdapter] Effekseer WASM 載入失敗'))
                    );
                } catch (error) {
                    reject(error as Error);
                }
            });

            this.isRuntimeInitialized = true;
            console.log('[EffekseerRuntimeAdapter] Runtime 初始化完成');
        }

        // 透過 createContext 建立專用的 EffekseerContext
        const context = effekseer.createContext();
        if (!context) {
            throw new Error('[EffekseerRuntimeAdapter] createContext() 失敗 - Runtime 可能尚未就緒');
        }
        
        console.log('[EffekseerRuntimeAdapter] Context 建立成功，準備初始化 WebGL');
        // 使用 Three.js 的 WebGL Context（官方範例方式）
        context.init(webglContext);
        
        // 啟用狀態保存/恢復（避免 Three.js 操作後 WebGL 狀態失效）
        // 注意：setRestorationOfStatesFlag(false) 會導致專案運行一段時間後特效消失
        context.setRestorationOfStatesFlag(true);
        
        console.log('[EffekseerRuntimeAdapter] WebGL 初始化完成（啟用狀態恢復）');
        
        this.effekseerContext = context;
    }

    /**
     * 載入特效並以 id 快取
     *
     * 若同一個 id 已經載入過，會直接略過，不會重複載入。
     *
     * @param params - 載入參數
     * @param params.id - 在系統內部用來識別此特效的唯一 id
     * @param params.buffer - 特效檔案的 ArrayBuffer
     * @param params.scale - 特效縮放倍率（預設 1.0）
     * @param params.resourceMap - 資源映射表（檔名 -> ArrayBuffer），用於解析特效的關聯檔案
     * @throws {Error} 當 Effekseer Context 尚未初始化或載入失敗時
     */
    /**
     * 使用 URL 載入特效（支援資源重定向）
     * 
     * @param params.id - 特效 ID
     * @param params.url - 特效檔案的 URL（Blob URL 或 HTTP URL）
     * @param params.scale - 縮放倍率
     * @param params.resourceMap - 資源映射表（檔名 -> Blob URL），用於重定向關聯檔案
     */
    public async loadEffect(params: {
        id: string;
        url: string;
        scale?: number;
        resourceMap?: Map<string, string>;
    }): Promise<void> {
        if (!this.isRuntimeInitialized || !this.effekseerContext) {
            throw new Error('[EffekseerRuntimeAdapter] 尚未初始化，請先呼叫 initWithThreeContext()');
        }

        if (this.loadedEffects.has(params.id)) {
            console.log(`[EffekseerRuntimeAdapter] 特效已載入過: ${params.id}`);
            return;
        }

        const { id, url, scale, resourceMap } = params;

        let effect: effekseer.EffekseerEffect;

        await new Promise<void>((resolve, reject) => {
            const onload = () => {
                console.log(`[EffekseerRuntimeAdapter] ✓ 特效載入完成: ${id}`);
                resolve();
            };
            const onerror = (message: string, path: string) => {
                console.error(`[EffekseerRuntimeAdapter] ✗ 特效載入失敗: ${message} (${path})`);
                reject(new Error(`[EffekseerRuntimeAdapter] 載入特效失敗: ${message} (${path})`));
            };

            // 資源重定向函數：當 Effekseer 請求相對路徑的資源時，返回對應的 Blob URL
            const redirect = resourceMap ? (path: string) => {
                // 正規化路徑
                const normalizedPath = path.replace(/\\/g, '/');
                
                // 嘗試多種匹配策略
                const strategies = [
                    normalizedPath,                           // 完整路徑
                    normalizedPath.split('/').pop() || '',   // 純檔名
                    normalizedPath.replace(/^\.\//, ''),    // 移除 ./
                    normalizedPath.replace(/^\.\.\//, ''),  // 移除 ../
                ];

                for (const key of strategies) {
                    if (resourceMap.has(key)) {
                        const redirectUrl = resourceMap.get(key)!;
                        console.log(`[EffekseerRuntimeAdapter] 資源重定向: ${path} -> ${redirectUrl}`);
                        return redirectUrl;
                    }
                }

                console.warn(`[EffekseerRuntimeAdapter] ⚠️ 找不到資源: ${path}`);
                return path; // 找不到就返回原路徑，讓 Effekseer 自己處理
            } : undefined;

            // 使用 URL 字串載入特效（官方範例方式）
            console.log(`[EffekseerRuntimeAdapter] 開始載入特效: ${id} from ${url}`);
            if (resourceMap) {
                console.log(`[EffekseerRuntimeAdapter] 啟用資源重定向，共 ${resourceMap.size} 個資源`);
            }

            effect = this.effekseerContext!.loadEffect(
                url,
                scale ?? 1.0,
                onload,
                onerror,
                redirect  // 傳入重定向函數
            );
        });

        this.loadedEffects.set(id, effect!);
    }

    // 已移除未使用的輔助方法（改用官方 URL 載入方式）

    /**
     * 播放指定 id 的特效
     *
     * @param params - 播放參數
     * @param params.id - 先前透過 `loadEffect` 載入時使用的特效 id
     * @param params.x - 世界座標 X（預設 0）
     * @param params.y - 世界座標 Y（預設 0）
     * @param params.z - 世界座標 Z（預設 0）
     * @param params.rx - 旋轉 X (radians)（預設 0）
     * @param params.ry - 旋轉 Y (radians)（預設 0）
     * @param params.rz - 旋轉 Z (radians)（預設 0）
     * @param params.sx - 縮放 X（預設 1）
     * @param params.sy - 縮放 Y（預設 1）
     * @param params.sz - 縮放 Z（預設 1）
     * @param params.speed - 播放速度（預設 1）
     * @returns 播放中的特效 Handle，如果特效尚未載入或 Context 未初始化則回傳 null
     */
    public play(params: { 
        id: string; 
        x?: number; y?: number; z?: number;
        rx?: number; ry?: number; rz?: number;
        sx?: number; sy?: number; sz?: number;
        speed?: number;
    }): effekseer.EffekseerHandle | null {
        if (!this.isRuntimeInitialized || !this.effekseerContext) {
            console.warn('[EffekseerRuntimeAdapter] 尚未初始化，無法播放特效');
            return null;
        }

        const effect = this.loadedEffects.get(params.id);
        if (!effect) {
            console.warn(`[EffekseerRuntimeAdapter] 特效尚未載入: ${params.id}`);
            return null;
        }

        // 統一用 setMatrix（避免 setRotation/setScale 分散修正，導致不同路徑方向不一致）
        // 位置交給 matrix，play 一律從原點建立 instance
        const handle = this.effekseerContext.play(effect, 0, 0, 0);
        
        if (handle) {
            const x = params.x ?? 0;
            const y = params.y ?? 0;
            const z = params.z ?? 0;

            const rx = params.rx ?? 0;
            const ry = params.ry ?? 0;
            const rz = params.rz ?? 0;

            const sx = params.sx ?? 1;
            const sy = params.sy ?? 1;
            const sz = params.sz ?? 1;

            const worldPosition = new THREE.Vector3(x, y, z);
            const worldQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
            const worldScale = new THREE.Vector3(sx, sy, sz);

            handle.setMatrix(composeEffekseerMatrix({ worldPosition, worldQuaternion, worldScale }));

            // Apply Speed
            if (params.speed !== undefined) {
                handle.setSpeed(params.speed);
            }
        }

        return handle;
    }

    /**
     * 停止所有特效播放
     *
     * 後續若需要支援「依照 bindingId / handle 停止」，會在更高階的 Registry 中管理。
     */
    public stop(): void {
        if (!this.isRuntimeInitialized || !this.effekseerContext) return;
        this.effekseerContext.stopAll();
    }

    /**
     * 清理指定特效的資源
     * 
     * 從載入的特效列表中移除指定的特效，釋放記憶體。
     * 通常在刪除模型時呼叫此方法。
     * 
     * @param effectId - 要清理的特效 ID
     */
    public cleanup(effectId: string): void {
        const effect = this.loadedEffects.get(effectId);
        if (effect && this.effekseerContext) {
            // Release effect resource
            this.effekseerContext.releaseEffect(effect);
            this.loadedEffects.delete(effectId);
        }
    }

    /**
     * 清除所有快取的特效資源
     * 
     * 釋放所有已載入的特效，清空快取。
     * 這對於強制重新載入資源或釋放大量記憶體很有用。
     */
    public clearAllCache(): void {
        if (!this.effekseerContext) {
            console.warn('[EffekseerRuntimeAdapter] Context 不存在，無法清除快取');
            return;
        }

        console.log(`[EffekseerRuntimeAdapter] 🗑️ 開始清除快取，共 ${this.loadedEffects.size} 個特效`);
        
        // 釋放所有特效資源
        for (const [id, effect] of this.loadedEffects) {
            try {
                this.effekseerContext.releaseEffect(effect);
                console.log(`[EffekseerRuntimeAdapter] ✓ 釋放特效: ${id}`);
            } catch (error) {
                console.error(`[EffekseerRuntimeAdapter] ✗ 釋放特效失敗: ${id}`, error);
            }
        }
        
        // 清空 Map
        this.loadedEffects.clear();
        
        console.log('[EffekseerRuntimeAdapter] ✅ 快取已清除');
    }

    /**
     * 更新 Effekseer 的播放狀態
     *
     * Effekseer API 的 `update` 以「幀數」為單位，因此這裡使用 `deltaTime * 60` 估計幀數。
     *
     * @param deltaTime - 與 R3F `useFrame` 相同的秒數（s）
     */
    public update(deltaTime: number): void {
        if (!this.isRuntimeInitialized || !this.effekseerContext) return;

        const deltaFrames = deltaTime * 60;
        try {
            this.effekseerContext.update(deltaFrames);
        } catch (error) {
            // 某些瀏覽器／平台在 WebAssembly 內部可能會拋出
            // "null function or function signature mismatch" 之類錯誤。
            // 為了避免整個 React 應用被未捕捉例外中斷，這裡僅記錄一次錯誤並忽略後續 frame。
            console.error('[EffekseerRuntimeAdapter] update 發生錯誤，該 frame 將被略過:', error);
        }
    }

    /**
     * 渲染所有當前活躍的特效
     *
     * 目前尚未從 Three.js 相機同步投影 / 視圖矩陣，會在之後的階段整合。
     */
    public render(): void {
        if (!this.isRuntimeInitialized || !this.effekseerContext) return;
        try {
            this.effekseerContext.draw();
        } catch (error) {
            console.error('[EffekseerRuntimeAdapter] render 發生錯誤，該 frame 將被略過:', error);
        }
    }
}


