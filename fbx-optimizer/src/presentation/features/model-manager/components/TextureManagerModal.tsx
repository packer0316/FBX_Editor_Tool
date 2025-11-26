import { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import * as THREE from 'three';
import type { ThemeStyle } from '../../../hooks/useTheme';

interface TextureInfo {
  name: string;
  texture: THREE.Texture;
  materialName: string;
  textureType: string; // map, normalMap, roughnessMap, etc.
}

interface TextureManagerModalProps {
  model: THREE.Group | null;
  onClose: () => void;
  theme: ThemeStyle;
}

/**
 * 貼圖管理彈出視窗
 * 顯示模型使用的所有貼圖，並允許用戶上傳替換
 */
export default function TextureManagerModal({ model, onClose, theme }: TextureManagerModalProps) {
  const [textures, setTextures] = useState<TextureInfo[]>(() => {
    if (!model) return [];
    return extractTexturesFromModel(model);
  });

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  /**
   * 從模型中提取所有貼圖
   */
  function extractTexturesFromModel(model: THREE.Group): TextureInfo[] {
    const texturesList: TextureInfo[] = [];
    const processedTextures = new Set<THREE.Texture>();

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material;
        const materials = Array.isArray(material) ? material : [material];

        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
            // 檢查各種貼圖類型
            const textureTypes = [
              { key: 'map', label: '主貼圖 (Diffuse)' },
              { key: 'normalMap', label: '法線貼圖 (Normal)' },
              { key: 'roughnessMap', label: '粗糙度貼圖 (Roughness)' },
              { key: 'metalnessMap', label: '金屬度貼圖 (Metalness)' },
              { key: 'aoMap', label: '環境光遮蔽貼圖 (AO)' },
              { key: 'emissiveMap', label: '自發光貼圖 (Emissive)' },
              { key: 'alphaMap', label: '透明度貼圖 (Alpha)' },
            ];

            textureTypes.forEach(({ key, label }) => {
              const texture = (mat as any)[key];
              if (texture && texture instanceof THREE.Texture && !processedTextures.has(texture)) {
                processedTextures.add(texture);
                texturesList.push({
                  name: texture.name || texture.uuid || `${label}`,
                  texture: texture,
                  materialName: mat.name || 'Unnamed Material',
                  textureType: label,
                });
              }
            });
          }
        });
      }
    });

    return texturesList;
  }

  /**
   * 處理貼圖上傳
   */
  const handleTextureUpload = async (textureInfo: TextureInfo, file: File) => {
    try {
      // 創建 URL 來載入新貼圖
      const url = URL.createObjectURL(file);
      const loader = new THREE.TextureLoader();

      loader.load(
        url,
        (newTexture) => {
          // 複製原貼圖的設置
          newTexture.wrapS = textureInfo.texture.wrapS;
          newTexture.wrapT = textureInfo.texture.wrapT;
          newTexture.repeat.copy(textureInfo.texture.repeat);
          newTexture.offset.copy(textureInfo.texture.offset);
          newTexture.rotation = textureInfo.texture.rotation;
          newTexture.flipY = textureInfo.texture.flipY;
          newTexture.encoding = textureInfo.texture.encoding;
          newTexture.name = file.name;
          newTexture.needsUpdate = true;

          // 更新模型中的貼圖
          if (model) {
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const material = child.material;
                const materials = Array.isArray(material) ? material : [material];

                materials.forEach((mat) => {
                  // 找到並替換對應的貼圖
                  const textureTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
                  
                  textureTypes.forEach((key) => {
                    if ((mat as any)[key] === textureInfo.texture) {
                      // 釋放舊貼圖
                      textureInfo.texture.dispose();
                      // 設置新貼圖
                      (mat as any)[key] = newTexture;
                      mat.needsUpdate = true;
                    }
                  });
                });
              }
            });
          }

          // 等待圖片完全載入後再更新狀態（確保預覽圖可用）
          if (newTexture.image && newTexture.image instanceof HTMLImageElement) {
            newTexture.image.onload = () => {
              // 更新狀態
              setTextures((prev) =>
                prev.map((t) =>
                  t.texture === textureInfo.texture
                    ? { ...t, texture: newTexture, name: file.name }
                    : t
                )
              );
            };
            
            // 如果圖片已經載入完成
            if (newTexture.image.complete) {
              setTextures((prev) =>
                prev.map((t) =>
                  t.texture === textureInfo.texture
                    ? { ...t, texture: newTexture, name: file.name }
                    : t
                )
              );
            }
          } else {
            // 如果不是 HTMLImageElement，直接更新
            setTextures((prev) =>
              prev.map((t) =>
                t.texture === textureInfo.texture
                  ? { ...t, texture: newTexture, name: file.name }
                  : t
              )
            );
          }

          // 清理 URL（延遲一點以確保圖片載入完成）
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 1000);

          alert(`貼圖「${file.name}」已成功替換！`);
        },
        undefined,
        (error) => {
          console.error('載入貼圖失敗:', error);
          alert('載入貼圖失敗，請檢查檔案格式');
          URL.revokeObjectURL(url);
        }
      );
    } catch (error) {
      console.error('處理貼圖失敗:', error);
      alert('處理貼圖失敗');
    }
  };

  /**
   * 觸發檔案選擇
   */
  const triggerFileInput = (textureKey: string) => {
    const input = fileInputRefs.current[textureKey];
    if (input) {
      input.click();
    }
  };

  /**
   * 生成貼圖預覽 URL
   */
  const getTexturePreviewUrl = (texture: THREE.Texture): string => {
    try {
      if (texture.image) {
        if (texture.image instanceof HTMLImageElement) {
          // 如果圖片已載入，返回 src
          if (texture.image.complete && texture.image.src) {
            return texture.image.src;
          }
          // 如果圖片還在載入中，返回 src（即使還沒完全載入）
          return texture.image.src || '';
        } else if (texture.image instanceof HTMLCanvasElement) {
          return texture.image.toDataURL();
        } else if (texture.image instanceof ImageBitmap) {
          // 處理 ImageBitmap（創建臨時 canvas）
          const canvas = document.createElement('canvas');
          canvas.width = texture.image.width;
          canvas.height = texture.image.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(texture.image, 0, 0);
            return canvas.toDataURL();
          }
        }
      }
    } catch (error) {
      console.warn('無法生成貼圖預覽:', error);
    }
    return '';
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative w-[90vw] max-w-4xl max-h-[85vh] ${theme.panelBg} border ${theme.panelBorder} rounded-2xl shadow-2xl overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題列 */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.panelBorder} ${theme.toolbarBg}`}>
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-blue-400" />
            <h2 className={`text-lg font-bold ${theme.text}`}>貼圖管理</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="關閉"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 貼圖列表 */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {textures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ImageIcon className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg">此模型沒有貼圖</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {textures.map((textureInfo, index) => {
                const textureKey = `texture-${index}`;
                const previewUrl = getTexturePreviewUrl(textureInfo.texture);

                return (
                  <div
                    key={textureKey}
                    className={`${theme.panelBg} border ${theme.panelBorder} rounded-xl overflow-hidden hover:border-blue-500/50 transition-all`}
                  >
                    {/* 貼圖預覽 */}
                    <div className="relative aspect-square bg-black/30">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={textureInfo.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* 貼圖資訊 */}
                    <div className="p-3 space-y-2">
                      <div>
                        <div className="text-xs text-gray-400">名稱</div>
                        <div className="text-sm text-white truncate" title={textureInfo.name}>
                          {textureInfo.name}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">類型</div>
                        <div className="text-sm text-blue-400">{textureInfo.textureType}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">材質</div>
                        <div className="text-sm text-gray-300 truncate" title={textureInfo.materialName}>
                          {textureInfo.materialName}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">尺寸</div>
                        <div className="text-sm text-gray-300">
                          {textureInfo.texture.image?.width || '?'} × {textureInfo.texture.image?.height || '?'}
                        </div>
                      </div>

                      {/* 上傳按鈕 */}
                      <button
                        onClick={() => triggerFileInput(textureKey)}
                        className="w-full mt-3 py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        替換貼圖
                      </button>

                      {/* 隱藏的檔案輸入 */}
                      <input
                        ref={(el) => (fileInputRefs.current[textureKey] = el)}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleTextureUpload(textureInfo, file);
                          }
                          // 重置 input 以允許重複選擇同一檔案
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部說明 */}
        <div className={`px-6 py-3 border-t ${theme.panelBorder} ${theme.toolbarBg}`}>
          <p className="text-xs text-gray-400">
            💡 提示：點擊「替換貼圖」按鈕來上傳新的貼圖檔案（支援 JPG、PNG 等格式）
          </p>
        </div>
      </div>
    </div>
  );
}

