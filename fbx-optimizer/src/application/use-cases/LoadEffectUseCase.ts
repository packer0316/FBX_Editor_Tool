import { getEffekseerRuntimeAdapter } from './effectRuntimeStore';

/**
 * 載入 Effekseer 特效檔的 Use Case（資料夾模式）
 *
 * 重點：不要用 redirect 回傳 data: URL（Effekseer 1.70 會用「副檔名」判斷載入方式，
 * data: URL 沒有 .png/.jpg 副檔名，會被當成二進位，最後導致 texImage2D 參數型別錯誤）。
 *
 * 正確作法：用 ArrayBuffer 載入 .efk，並透過 setResourceLoader 以 ArrayBuffer 供應資源。
 */
export class LoadEffectUseCase {
    public static async execute(params: {
        id: string;
        files: File[];
        scale?: number;
    }): Promise<void> {
        const { id, files, scale } = params;

        if (!files || files.length === 0) {
            throw new Error('[LoadEffectUseCase] 檔案陣列不能為空');
        }

        // 找出主特效檔
        const effectFile = files.find(f => f.name.match(/\.(efk|efkefc|efkp)$/i));
        if (!effectFile) {
            throw new Error('[LoadEffectUseCase] 找不到主特效檔（.efk / .efkefc / .efkp）');
        }

        console.log(`[LoadEffectUseCase] 🚀 開始處理特效: ${effectFile.name}（共 ${files.length} 個檔案）`);

        // 找出根資料夾名稱（用於去除 webkitRelativePath 的第一層）
        const effectRelativePath = (effectFile as any).webkitRelativePath || effectFile.name;
        const rootFolder = effectRelativePath.includes('/') ? effectRelativePath.split('/')[0] + '/' : '';

        // 讀取所有檔案為 ArrayBuffer
        console.log('[LoadEffectUseCase] 📂 讀取檔案內容為 ArrayBuffer...');
        const fileBuffers = await Promise.all(files.map(async (file) => ({ file, buffer: await file.arrayBuffer() })));

        const effectBuffer = fileBuffers.find(x => x.file === effectFile)!.buffer;

        // 建立資源映射表（路徑 -> ArrayBuffer）
        const resources = new Map<string, ArrayBuffer>();

        for (const { file, buffer } of fileBuffers) {
            // 主特效檔不放到資源表（由 loadEffect(buffer) 載入）
            if (file === effectFile) continue;

            const relativePath = (file as any).webkitRelativePath || file.name;
            const normalizedPath = String(relativePath).replace(/\\/g, '/');
            const pathWithoutRoot = rootFolder && normalizedPath.startsWith(rootFolder)
                ? normalizedPath.substring(rootFolder.length)
                : normalizedPath;
            const pureFileName = file.name;

            // 註冊多種 key，讓 Effekseer 引用的相對路徑更容易命中
            const keys = new Set<string>([
                normalizedPath,
                pathWithoutRoot,
                pureFileName,
                `./${pureFileName}`,
                `./${pathWithoutRoot}`,
                // 只取最後一段（避免 efk 只寫檔名）
                normalizedPath.split('/').pop() || pureFileName,
            ]);

            for (const key of keys) {
                if (key) resources.set(key, buffer);
            }
        }

        const adapter = getEffekseerRuntimeAdapter();
        await adapter.waitForReady();

        await adapter.loadEffectFromArrayBuffer({
            id,
            effectBuffer,
            scale: scale ?? 1.0,
            resources,
        });

        console.log(`[LoadEffectUseCase] ✅ 特效載入完成: ${id}`);
    }
}
