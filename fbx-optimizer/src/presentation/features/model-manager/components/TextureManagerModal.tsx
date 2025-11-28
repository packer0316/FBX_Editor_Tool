import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Image as ImageIcon, GripHorizontal } from 'lucide-react';
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

  // 視窗大小狀態
  const [modalSize, setModalSize] = useState({ width: 750, height: 600 });

  // 拖動功能 - 使用 ref 直接操作 DOM 避免重新渲染
  const modalRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    rafId: 0
  });

  // 調整大小功能
  const resizeStateRef = useRef({
    isResizing: false,
    startX: 0,
    startY: 0,
    startWidth: 750,
    startHeight: 600
  });

  const updateModalPosition = useCallback(() => {
    if (modalRef.current) {
      modalRef.current.style.transform = `translate(calc(-50% + ${dragStateRef.current.currentX}px), calc(-50% + ${dragStateRef.current.currentY}px))`;
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStateRef.current.isDragging = true;
    dragStateRef.current.startX = e.clientX - dragStateRef.current.currentX;
    dragStateRef.current.startY = e.clientY - dragStateRef.current.currentY;

    if (modalRef.current) {
      modalRef.current.style.cursor = 'grabbing';
    }
  }, []);

  // 開始調整大小
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStateRef.current.isResizing = true;
    resizeStateRef.current.startX = e.clientX;
    resizeStateRef.current.startY = e.clientY;
    resizeStateRef.current.startWidth = modalSize.width;
    resizeStateRef.current.startHeight = modalSize.height;
  }, [modalSize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 處理拖動
      if (dragStateRef.current.isDragging) {
        dragStateRef.current.currentX = e.clientX - dragStateRef.current.startX;
        dragStateRef.current.currentY = e.clientY - dragStateRef.current.startY;

        // 使用 requestAnimationFrame 節流
        if (dragStateRef.current.rafId) {
          cancelAnimationFrame(dragStateRef.current.rafId);
        }
        dragStateRef.current.rafId = requestAnimationFrame(updateModalPosition);
      }

      // 處理調整大小
      if (resizeStateRef.current.isResizing) {
        const deltaX = e.clientX - resizeStateRef.current.startX;
        const deltaY = e.clientY - resizeStateRef.current.startY;

        setModalSize({
          width: Math.max(500, Math.min(window.innerWidth * 0.95, resizeStateRef.current.startWidth + deltaX)),
          height: Math.max(400, Math.min(window.innerHeight * 0.95, resizeStateRef.current.startHeight + deltaY))
        });
      }
    };

    const handleMouseUp = () => {
      dragStateRef.current.isDragging = false;
      resizeStateRef.current.isResizing = false;
      if (modalRef.current) {
        modalRef.current.style.cursor = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (dragStateRef.current.rafId) {
        cancelAnimationFrame(dragStateRef.current.rafId);
      }
    };
  }, [updateModalPosition]);

  /**
   * 從模型中提取所有貼圖
   * 注意：當 shader 被應用後，原始材質會存在 userData.originalMaterial 中
   */
  function extractTexturesFromModel(model: THREE.Group): TextureInfo[] {
    const texturesList: TextureInfo[] = [];
    const processedTextures = new Set<THREE.Texture>();

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // 優先使用原始材質（shader 應用前的材質）
        const originalMaterial = (child as any).userData?.originalMaterial;
        const currentMaterial = child.material;

        // 如果有原始材質，使用原始材質；否則使用當前材質
        const material = originalMaterial || currentMaterial;
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
          // 完整複製原貼圖的所有關鍵屬性
          const oldTexture = textureInfo.texture;

          // 基本屬性
          newTexture.name = file.name;
          newTexture.wrapS = oldTexture.wrapS;
          newTexture.wrapT = oldTexture.wrapT;
          newTexture.repeat.copy(oldTexture.repeat);
          newTexture.offset.copy(oldTexture.offset);
          newTexture.rotation = oldTexture.rotation;
          newTexture.center.copy(oldTexture.center);

          // 翻轉設置
          newTexture.flipY = oldTexture.flipY;

          // 顏色空間和編碼（關鍵！）
          // Three.js r152+ 使用 colorSpace，舊版使用 encoding
          if ('colorSpace' in oldTexture) {
            (newTexture as any).colorSpace = (oldTexture as any).colorSpace;
          } else if ('encoding' in oldTexture) {
            (newTexture as any).encoding = (oldTexture as any).encoding;
          }

          // 過濾設置
          newTexture.minFilter = oldTexture.minFilter;
          newTexture.magFilter = oldTexture.magFilter;
          newTexture.anisotropy = oldTexture.anisotropy;

          // Alpha 和混合設置
          newTexture.premultiplyAlpha = oldTexture.premultiplyAlpha;
          newTexture.format = oldTexture.format;
          newTexture.type = oldTexture.type;

          // 生成 mipmap
          newTexture.generateMipmaps = oldTexture.generateMipmaps;

          // 標記需要更新
          newTexture.needsUpdate = true;

          // 更新模型中的貼圖
          if (model) {
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                // 1. 更新原始材質（userData.originalMaterial）- 這是 shader 應用前保存的材質
                const originalMaterial = (child as any).userData?.originalMaterial;
                let updatedOriginalMap = false;

                if (originalMaterial) {
                  const origMaterials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
                  origMaterials.forEach((mat: any) => {
                    const textureTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
                    textureTypes.forEach((key) => {
                      if (mat[key] === textureInfo.texture) {
                        mat[key] = newTexture;
                        mat.needsUpdate = true;
                        if (key === 'map') updatedOriginalMap = true;
                      }
                    });
                  });
                }

                // 2. 更新當前材質
                const currentMaterial = child.material;
                const materials = Array.isArray(currentMaterial) ? currentMaterial : [currentMaterial];

                materials.forEach((mat) => {
                  // 如果是 ShaderMaterial，更新 uniform
                  if (mat instanceof THREE.ShaderMaterial && mat.uniforms) {
                    // 如果原始材質的 map 被更新了，也更新 shader 的 baseTexture
                    if (updatedOriginalMap && mat.uniforms.baseTexture) {
                      mat.uniforms.baseTexture.value = newTexture;
                      mat.needsUpdate = true;
                    }
                    // 也直接檢查 baseTexture 是否等於舊貼圖
                    if (mat.uniforms.baseTexture && mat.uniforms.baseTexture.value === textureInfo.texture) {
                      mat.uniforms.baseTexture.value = newTexture;
                      mat.needsUpdate = true;
                    }
                  } else {
                    // 標準材質，找到並替換對應的貼圖
                    const textureTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];

                    textureTypes.forEach((key) => {
                      if ((mat as any)[key] === textureInfo.texture) {
                        (mat as any)[key] = newTexture;
                        mat.needsUpdate = true;
                      }
                    });
                  }
                });
              }
            });

            // 釋放舊貼圖
            textureInfo.texture.dispose();
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
   * 使用 canvas 將圖片轉換為 Data URL，避免 Blob URL 失效問題
   */
  const getTexturePreviewUrl = (texture: THREE.Texture): string => {
    try {
      if (texture.image) {
        // 通用方法：使用 canvas 將任何圖片類型轉換為 Data URL
        const drawToCanvas = (source: CanvasImageSource, width: number, height: number): string => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(source, 0, 0, width, height);
            return canvas.toDataURL('image/png');
          }
          return '';
        };

        if (texture.image instanceof HTMLImageElement) {
          // 如果圖片已載入完成，用 canvas 轉換為 Data URL
          if (texture.image.complete && texture.image.naturalWidth > 0) {
            return drawToCanvas(texture.image, texture.image.naturalWidth, texture.image.naturalHeight);
          }
          // 如果 src 存在且不是 blob URL，直接返回
          if (texture.image.src && !texture.image.src.startsWith('blob:')) {
            return texture.image.src;
          }
          return '';
        } else if (texture.image instanceof HTMLCanvasElement) {
          return texture.image.toDataURL();
        } else if (texture.image instanceof ImageBitmap) {
          return drawToCanvas(texture.image, texture.image.width, texture.image.height);
        }
      }
    } catch (error) {
      console.warn('無法生成貼圖預覽:', error);
    }
    return '';
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`fixed ${theme.panelBg} border ${theme.panelBorder} rounded-2xl shadow-2xl overflow-hidden flex flex-col will-change-transform`}
        style={{
          width: modalSize.width,
          height: modalSize.height,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題列 - 可拖動 */}
        <div
          className={`flex items-center justify-between px-6 py-3 border-b ${theme.panelBorder} ${theme.toolbarBg} cursor-grab active:cursor-grabbing select-none`}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <GripHorizontal className="w-4 h-4 text-gray-500" />
            <ImageIcon className="w-5 h-5 text-blue-400" />
            <h2 className={`text-lg font-bold ${theme.text}`}>貼圖管理</h2>
          </div>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="關閉"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 貼圖列表 */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          {textures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ImageIcon className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg">此模型沒有貼圖</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 min-w-[700px]">
              {textures.map((textureInfo, index) => {
                const textureKey = `texture-${index}`;
                const previewUrl = getTexturePreviewUrl(textureInfo.texture);

                return (
                  <div
                    key={textureKey}
                    className={`${theme.panelBg} border ${theme.panelBorder} rounded-xl overflow-hidden hover:border-blue-500/50 transition-all flex flex-row`}
                  >
                    {/* 左側：貼圖預覽 + 替換按鈕 */}
                    <div className="flex flex-col flex-shrink-0 p-3">
                      <div className="relative w-24 h-24 bg-black/30 rounded-lg overflow-hidden">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={textureInfo.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-gray-600" />
                          </div>
                        )}
                      </div>
                      {/* 替換按鈕 */}
                      <button
                        onClick={() => triggerFileInput(textureKey)}
                        className="mt-2 py-1.5 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        替換貼圖
                      </button>
                      {/* 隱藏的檔案輸入 */}
                      <input
                        ref={(el) => { fileInputRefs.current[textureKey] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleTextureUpload(textureInfo, file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </div>

                    {/* 右側：貼圖資訊 */}
                    <div className="flex-1 flex items-start px-4 py-3 gap-4">
                      <div className="w-[140px] flex-shrink-0">
                        <div className="text-xs text-gray-400 mb-1">名稱</div>
                        <div className="text-sm text-white break-words leading-relaxed">
                          {textureInfo.name}
                        </div>
                      </div>
                      <div className="w-[120px] flex-shrink-0">
                        <div className="text-xs text-gray-400 mb-1">類型</div>
                        <div className="text-sm text-blue-400 break-words leading-relaxed">{textureInfo.textureType}</div>
                      </div>
                      <div className="w-[140px] flex-shrink-0">
                        <div className="text-xs text-gray-400 mb-1">材質</div>
                        <div className="text-sm text-gray-300 break-words leading-relaxed">
                          {textureInfo.materialName}
                        </div>
                      </div>
                      <div className="w-[90px] flex-shrink-0">
                        <div className="text-xs text-gray-400 mb-1">尺寸</div>
                        <div className="text-sm text-gray-300">
                          {(textureInfo.texture.image as any)?.width || '?'} × {(textureInfo.texture.image as any)?.height || '?'}
                        </div>
                      </div>
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

        {/* 調整大小拖把 - 右下角 */}
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize group"
          onMouseDown={handleResizeStart}
        >
          <svg
            className="w-full h-full text-gray-500 group-hover:text-blue-400 transition-colors"
            viewBox="0 0 24 24"
          >
            <path fill="currentColor" d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      </div>
    </div>,
    document.body
  );
}

