import { getEffekseerRuntimeAdapter } from './effectRuntimeStore';

/**
 * 載入 Effekseer 特效檔的 Use Case（支援單檔或資料夾）
 * 
 * 支援兩種模式：
 * 1. 單檔模式：只載入 .efk，資源需在 public/ 下
 * 2. 資料夾模式：上傳 .efk + 所有關聯檔案（.png, .efkmat 等）
 */
export class LoadEffectUseCase {
    /**
     * 載入特效檔案（支援單檔或多檔）
     * 
     * @param params - 載入參數
     * @param params.id - 特效的唯一識別 ID
     * @param params.files - 檔案陣列（單檔或資料夾內的所有檔案）
     * @param params.scale - 特效縮放倍率（預設 1.0）
     * @returns Promise<string> - 返回特效的 Blob URL
     * @throws {Error} 當載入失敗時拋出錯誤
     * 
     * @example
     * ```typescript
     * // 單檔模式
     * await LoadEffectUseCase.execute({
     *   id: 'effect_001',
     *   files: [efkFile],
     *   scale: 1.0
     * });
     * 
     * // 資料夾模式
     * await LoadEffectUseCase.execute({
     *   id: 'effect_002',
     *   files: [efkFile, texture1, texture2, materialFile],
     *   scale: 1.0
     * });
     * ```
     */
    public static async execute(params: {
        id: string;
        files: File[];
        scale?: number;
    }): Promise<string> {
        const { id, files, scale } = params;

        if (!files || files.length === 0) {
            throw new Error('[LoadEffectUseCase] 檔案陣列不能為空');
        }

        // 找出主特效檔
        const effectFile = files.find(f => 
            f.name.match(/\.(efk|efkefc|efkp)$/i)
        );

        if (!effectFile) {
            throw new Error('[LoadEffectUseCase] 找不到主特效檔（.efk / .efkefc / .efkp）');
        }

        console.log(`[LoadEffectUseCase] 開始載入特效: ${effectFile.name}，共 ${files.length} 個檔案`);

        // 建立資源映射表（檔名 -> Blob URL）
        const resourceMap = new Map<string, string>();

        for (const file of files) {
            const blobUrl = URL.createObjectURL(file);
            
            // 取得相對路徑（如果有 webkitRelativePath）
            const relativePath = (file as any).webkitRelativePath || file.name;
            
            // 正規化路徑（統一使用 / 分隔符）
            const normalizedPath = relativePath.replace(/\\/g, '/');
            
            // 同時註冊完整路徑和純檔名
            resourceMap.set(normalizedPath, blobUrl);
            resourceMap.set(file.name, blobUrl);
            
            console.log(`[LoadEffectUseCase] 資源映射: ${normalizedPath} -> ${blobUrl}`);
        }

        // 建立主特效檔的 Blob URL
        const effectBlobUrl = resourceMap.get(effectFile.name)!;

        // 透過 Adapter 載入特效（傳入資源映射表）
        const adapter = getEffekseerRuntimeAdapter();
        await adapter.loadEffect({
            id,
            url: effectBlobUrl,
            scale: scale ?? 1.0,
            resourceMap  // 傳入資源映射表，用於 redirect
        });

        console.log(`[LoadEffectUseCase] ✓ 特效載入成功: ${id} (${files.length} 個檔案)`);

        return effectBlobUrl;
    }
}

