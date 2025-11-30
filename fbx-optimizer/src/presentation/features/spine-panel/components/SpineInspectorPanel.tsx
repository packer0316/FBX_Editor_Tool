/**
 * SpineInspectorPanel - Spine 檢視面板
 * 
 * 當選中 Spine 元素時，顯示 Spine 專用的編輯面板。
 * 包含：Animation、Skin、Slot、Transform 分頁。
 */

import React, { useState } from 'react';
import { Bone, Play, Palette, Move, Layers } from 'lucide-react';
import type { SpineElement2D } from '../../../../domain/value-objects/Element2D';
import type { SpineInstance } from '../../../../domain/value-objects/SpineInstance';
import { SpineAnimationTab } from './SpineAnimationTab';
import { SpineSkinTab } from './SpineSkinTab';
import { SpineSlotTab } from './SpineSlotTab';
import { SpineTransformTab } from './SpineTransformTab';

// ============================================================================
// 類型定義
// ============================================================================

interface SpineInspectorPanelProps {
  /** Spine 元素 */
  element: SpineElement2D;
  /** Spine 實例 */
  spineInstance: SpineInstance | null;
  /** 更新元素 */
  onUpdateElement: (updates: Partial<SpineElement2D>) => void;
}

type TabType = 'animation' | 'skin' | 'slot' | 'transform';

// ============================================================================
// 子組件
// ============================================================================

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors
      ${active 
        ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50' 
        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
      }
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// ============================================================================
// 主組件
// ============================================================================

export const SpineInspectorPanel: React.FC<SpineInspectorPanelProps> = ({
  element,
  spineInstance,
  onUpdateElement,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('animation');

  if (!spineInstance) {
    return (
      <div className="p-4 rounded-xl border border-white/5 bg-white/5 text-sm text-gray-400">
        <div className="flex items-center gap-2 mb-2">
          <Bone className="w-4 h-4 text-purple-400" />
          <span>Spine 元素</span>
        </div>
        <p>找不到對應的 Spine 實例資料。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Bone className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">{element.name}</h3>
            <p className="text-xs text-gray-500">
              {spineInstance.skeletonInfo.width}×{spineInstance.skeletonInfo.height} · 
              v{spineInstance.skeletonInfo.version}
            </p>
          </div>
        </div>
      </div>

      {/* 分頁標籤 */}
      <div className="flex gap-1 p-1 bg-black/20 rounded-xl">
        <TabButton
          active={activeTab === 'animation'}
          onClick={() => setActiveTab('animation')}
          icon={<Play size={14} />}
          label="動畫"
        />
        <TabButton
          active={activeTab === 'skin'}
          onClick={() => setActiveTab('skin')}
          icon={<Palette size={14} />}
          label="皮膚"
        />
        <TabButton
          active={activeTab === 'slot'}
          onClick={() => setActiveTab('slot')}
          icon={<Layers size={14} />}
          label="插槽"
        />
        <TabButton
          active={activeTab === 'transform'}
          onClick={() => setActiveTab('transform')}
          icon={<Move size={14} />}
          label="變換"
        />
      </div>

      {/* 分頁內容 */}
      <div className="bg-black/20 rounded-xl p-4 flex-1 overflow-y-auto">
        {activeTab === 'animation' && (
          <SpineAnimationTab
            element={element}
            spineInstance={spineInstance}
            onUpdateElement={onUpdateElement}
          />
        )}
        {activeTab === 'skin' && (
          <SpineSkinTab
            element={element}
            spineInstance={spineInstance}
            onUpdateElement={onUpdateElement}
          />
        )}
        {activeTab === 'slot' && (
          <SpineSlotTab
            spineInstance={spineInstance}
          />
        )}
        {activeTab === 'transform' && (
          <SpineTransformTab
            element={element}
            onUpdateElement={onUpdateElement}
          />
        )}
      </div>
    </div>
  );
};

export default SpineInspectorPanel;

