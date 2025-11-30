/**
 * SpineTransformTab - 變換分頁
 * 
 * 管理 Spine 元素的位置、大小等變換屬性。
 * 注意：縮放、適應模式等功能已移至 Spine 字卡中。
 */

import React, { useCallback } from 'react';
import { Move, Maximize2 } from 'lucide-react';
import type { SpineElement2D } from '../../../../domain/value-objects/Element2D';

// ============================================================================
// 類型定義
// ============================================================================

interface SpineTransformTabProps {
  element: SpineElement2D;
  onUpdateElement: (updates: Partial<SpineElement2D>) => void;
}

// ============================================================================
// 子組件
// ============================================================================

const InputRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-gray-400 w-16">{label}</span>
    {children}
  </div>
);

const NumberInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}> = ({ value, onChange, min, max, step = 1, unit = '' }) => (
  <div className="flex items-center gap-1">
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      min={min}
      max={max}
      step={step}
      className="w-20 px-2 py-1.5 bg-black/30 border border-white/10 rounded-lg text-sm text-white
        focus:outline-none focus:border-purple-400/50"
    />
    {unit && <span className="text-xs text-gray-500">{unit}</span>}
  </div>
);

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ 
  title, 
  icon,
  children 
}) => (
  <div className="mb-4">
    <h4 className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-3">
      {icon}
      {title}
    </h4>
    <div className="space-y-2">
      {children}
    </div>
  </div>
);

// ============================================================================
// 主組件
// ============================================================================

export const SpineTransformTab: React.FC<SpineTransformTabProps> = ({
  element,
  onUpdateElement,
}) => {
  // 位置更新
  const handlePositionChange = useCallback((axis: 'x' | 'y', value: number) => {
    onUpdateElement({
      position: {
        ...element.position,
        [axis]: value,
      },
    });
  }, [element.position, onUpdateElement]);

  // 尺寸更新
  const handleSizeChange = useCallback((dimension: 'width' | 'height', value: number) => {
    onUpdateElement({
      size: {
        ...element.size,
        [dimension]: value,
      },
    });
  }, [element.size, onUpdateElement]);

  // 單位更新
  const handlePositionUnitChange = useCallback((unit: 'px' | 'percent') => {
    onUpdateElement({
      position: {
        ...element.position,
        unit,
      },
    });
  }, [element.position, onUpdateElement]);

  const handleSizeUnitChange = useCallback((unit: 'px' | 'percent') => {
    onUpdateElement({
      size: {
        ...element.size,
        unit,
      },
    });
  }, [element.size, onUpdateElement]);

  return (
    <div className="space-y-4">
      {/* 位置 */}
      <Section title="位置" icon={<Move size={12} />}>
        <div className="grid grid-cols-2 gap-3">
          <InputRow label="X">
            <NumberInput
              value={element.position.x}
              onChange={(v) => handlePositionChange('x', v)}
              step={1}
              unit={element.position.unit === 'percent' ? '%' : 'px'}
            />
          </InputRow>
          <InputRow label="Y">
            <NumberInput
              value={element.position.y}
              onChange={(v) => handlePositionChange('y', v)}
              step={1}
              unit={element.position.unit === 'percent' ? '%' : 'px'}
            />
          </InputRow>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => handlePositionUnitChange('percent')}
            className={`flex-1 py-1 text-xs rounded transition-colors ${
              element.position.unit === 'percent'
                ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            百分比 %
          </button>
          <button
            onClick={() => handlePositionUnitChange('px')}
            className={`flex-1 py-1 text-xs rounded transition-colors ${
              element.position.unit === 'px'
                ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            像素 px
          </button>
        </div>
      </Section>

      {/* 尺寸 */}
      <Section title="尺寸" icon={<Maximize2 size={12} />}>
        <div className="grid grid-cols-2 gap-3">
          <InputRow label="寬度">
            <NumberInput
              value={element.size.width}
              onChange={(v) => handleSizeChange('width', v)}
              min={10}
              step={1}
              unit={element.size.unit === 'percent' ? '%' : 'px'}
            />
          </InputRow>
          <InputRow label="高度">
            <NumberInput
              value={element.size.height}
              onChange={(v) => handleSizeChange('height', v)}
              min={10}
              step={1}
              unit={element.size.unit === 'percent' ? '%' : 'px'}
            />
          </InputRow>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => handleSizeUnitChange('percent')}
            className={`flex-1 py-1 text-xs rounded transition-colors ${
              element.size.unit === 'percent'
                ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            百分比 %
          </button>
          <button
            onClick={() => handleSizeUnitChange('px')}
            className={`flex-1 py-1 text-xs rounded transition-colors ${
              element.size.unit === 'px'
                ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            像素 px
          </button>
        </div>
      </Section>

      {/* 提示 */}
      <div className="text-xs text-gray-500 bg-black/20 rounded-lg p-3">
        💡 縮放、適應模式等設定請在左側 Spine 字卡中調整
      </div>
    </div>
  );
};

export default SpineTransformTab;
