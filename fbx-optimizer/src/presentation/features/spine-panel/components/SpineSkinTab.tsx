/**
 * SpineSkinTab - 皮膚分頁
 * 
 * 管理 Spine 皮膚的選擇和切換。
 */

import React, { useCallback } from 'react';
import { Palette, Check } from 'lucide-react';
import type { SpineElement2D } from '../../../../domain/value-objects/Element2D';
import type { SpineInstance, SpineSkinInfo } from '../../../../domain/value-objects/SpineInstance';

// ============================================================================
// 類型定義
// ============================================================================

interface SpineSkinTabProps {
  element: SpineElement2D;
  spineInstance: SpineInstance;
  onUpdateElement: (updates: Partial<SpineElement2D>) => void;
}

// ============================================================================
// 子組件
// ============================================================================

const SkinItem: React.FC<{
  skin: SpineSkinInfo;
  isActive: boolean;
  onClick: () => void;
}> = ({ skin, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors
      ${isActive 
        ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50' 
        : 'bg-white/5 text-gray-300 hover:bg-white/10'
      }
    `}
  >
    <div className="flex items-center gap-2">
      <Palette size={14} className={isActive ? 'text-purple-400' : 'text-gray-500'} />
      <span className="text-sm">{skin.name}</span>
    </div>
    {isActive && (
      <Check size={14} className="text-purple-400" />
    )}
  </button>
);

// ============================================================================
// 主組件
// ============================================================================

export const SpineSkinTab: React.FC<SpineSkinTabProps> = ({
  element,
  spineInstance,
  onUpdateElement,
}) => {
  const skins = spineInstance.skeletonInfo.skins;

  // 選擇皮膚
  const handleSelectSkin = useCallback((skinName: string) => {
    onUpdateElement({ currentSkin: skinName });
  }, [onUpdateElement]);

  return (
    <div className="space-y-4">
      {/* 皮膚列表 */}
      <div>
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
          可用皮膚 ({skins.length})
        </h4>
        
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {skins.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">
              <Palette className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>沒有可用的皮膚</p>
            </div>
          ) : (
            skins.map((skin) => (
              <SkinItem
                key={skin.name}
                skin={skin}
                isActive={element.currentSkin === skin.name}
                onClick={() => handleSelectSkin(skin.name)}
              />
            ))
          )}
        </div>
      </div>

      {/* 當前皮膚資訊 */}
      {element.currentSkin && (
        <div className="bg-white/5 px-3 py-2 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">當前皮膚</div>
          <div className="flex items-center gap-2 text-purple-300">
            <Palette size={14} />
            <span>{element.currentSkin}</span>
          </div>
        </div>
      )}

      {/* 說明 */}
      <div className="text-xs text-gray-500 bg-black/20 rounded-lg p-3">
        <p className="mb-1">💡 提示</p>
        <p>皮膚可以改變骨架的外觀，例如不同的服裝或配色。</p>
      </div>
    </div>
  );
};

export default SpineSkinTab;


