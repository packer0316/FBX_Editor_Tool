import * as THREE from 'three';

/**
 * 貼圖載入工具函數
 * 提供統一的貼圖載入邏輯
 */

/**
 * 載入貼圖（支援 File 物件或 URL 字串）
 * @param textureLoader Three.js 貼圖載入器
 * @param textureParam 貼圖參數（File 物件或 URL 字串）
 * @param onLoad 載入完成回調（可選）
 * @returns 載入的貼圖，如果參數為 null 則返回 null
 */
export function loadTexture(
    textureLoader: THREE.TextureLoader,
    textureParam: File | string | null | undefined,
    onLoad?: (texture: THREE.Texture) => void
): THREE.Texture | null {
    if (!textureParam) return null;

    const textureUrl = typeof textureParam === 'string'
        ? textureParam
        : URL.createObjectURL(textureParam);

    return textureLoader.load(textureUrl, onLoad);
}

