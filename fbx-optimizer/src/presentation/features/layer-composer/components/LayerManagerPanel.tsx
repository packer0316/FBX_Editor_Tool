import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronsDownUp, Eye, EyeOff, GripVertical, HelpCircle, ImageIcon, Layers, Lock, PlusCircle, Trash2, Type, Unlock, X, Bone, Wand2 } from 'lucide-react';
import { ImageToolsPanel } from './ImageToolsPanel';
import type { Layer } from '../../../../domain/value-objects/Layer';
import type { Element2D, ImageElement2D, ShapeElement2D, TextElement2D, SpineElement2D, SpineFitMode } from '../../../../domain/value-objects/Element2D';
import { isImageElement, isShapeElement, isTextElement, isSpineElement } from '../../../../domain/value-objects/Element2D';
import type { SpineInstance } from '../../../../domain/value-objects/SpineInstance';
import { SpineFileUploader } from '../../spine-panel/components/SpineFileUploader';
import { sortLayersByPriority } from '../../../../utils/layer/layerUtils';
import type { ThemeStyle, ThemeMode } from '../../../hooks/useTheme';

interface LayerManagerPanelProps {
  layers: Layer[];
  activeLayerId: string | null;
  activeElementId: string | null;
  onSelectLayer: (layerId: string) => void;
  onSelectElement: (layerId: string, elementId: string) => void;
  onCreateLayer: (direction: 'front' | 'back') => void;
  onDeleteLayer: (layerId: string) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onToggleLayerLock: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onToggleExpand: (layerId: string) => void;
  onUpdateLayerPriority: (layerId: string, priority: number) => void;
  onUpdateLayerOpacity: (layerId: string, opacity: number) => void;
  onReorderLayer: (direction: 'front' | 'back', fromIndex: number, toIndex: number) => void;
  onAddTextElement: (layerId: string) => void;
  onAddImageElement: (layerId: string, dataUrl: string) => void;
  onAddSpineElement?: (layerId: string, spineInstance: SpineInstance) => void;
  onReorderElement: (layerId: string, fromIndex: number, toIndex: number) => void;
  onUpdateElement: (layerId: string, elementId: string, updates: Partial<Element2D>) => void;
  onRemoveElement: (layerId: string, elementId: string) => void;
  currentTheme: ThemeStyle;
  themeMode: ThemeMode;
}

interface DragState {
  direction: 'front' | 'back';
  index: number;
}

/** 提示教學面板 */
const HintPanel: React.FC<{ isOpen: boolean; onClose: () => void; currentTheme: ThemeStyle }> = ({ isOpen, onClose, currentTheme }) => {
  if (!isOpen) return null;
  
  return (
    <div className={`mb-4 p-4 rounded-xl border border-blue-400/30 ${currentTheme.cardBg} text-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-blue-400 font-medium">
          <HelpCircle size={16} />
          圖層系統說明
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`p-1 rounded ${currentTheme.itemHover} text-gray-400 hover:text-blue-400`}
        >
          <X size={14} />
        </button>
      </div>
      <div className={`space-y-2 text-xs ${currentTheme.text} opacity-80`}>
        <p><span className="text-teal-500 font-medium">前景層 (Priority &gt; 0)</span>：顯示在 3D 場景前方</p>
        <p><span className="text-blue-500 font-medium">3D Scene (Priority = 0)</span>：固定為基礎層，不可調整</p>
        <p><span className="text-purple-500 font-medium">背景層 (Priority &lt; 0)</span>：顯示在 3D 場景後方</p>
        <div className={`pt-2 border-t ${currentTheme.dividerBorder} opacity-50 flex items-center gap-3 text-gray-400`}>
          <span className="flex items-center gap-1"><Eye size={12} /> 顯示/隱藏</span>
          <span className="flex items-center gap-1"><Lock size={12} /> 鎖定/解鎖</span>
        </div>
      </div>
    </div>
  );
};

const SectionDivider: React.FC<{ label: string; color: 'teal' | 'purple'; currentTheme: ThemeStyle }> = ({ label, color, currentTheme }) => (
  <div className={`flex items-center gap-2 text-xs uppercase tracking-wider mb-2 ${
    color === 'teal' ? 'text-teal-500' : 'text-purple-500'
  }`}>
    <div className={`flex-1 h-px ${color === 'teal' ? 'bg-teal-500/20' : 'bg-purple-500/20'}`} />
    <span className="font-semibold opacity-80">{label}</span>
    <div className={`flex-1 h-px ${color === 'teal' ? 'bg-teal-500/20' : 'bg-purple-500/20'}`} />
  </div>
);

/** 用於數值輸入轉換 */
const numberValue = (value: number | string, fallback = 0): number => {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : fallback;
};

interface ElementBadgeProps {
  element: Element2D;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<Element2D>) => void;
  onRemove: () => void;
  // 拖拽相關
  isDragging: boolean;
  dragFromIndex: number | null;
  dragOverIndex: number | null;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (index: number) => void;
  currentTheme: ThemeStyle;
  themeMode: ThemeMode;
}

/** 插入指示器組件 - 顯示放置位置 */
const InsertionIndicator: React.FC<{ show: boolean }> = ({ show }) => (
  <div 
    className={`
      relative h-0.5 my-0.5 rounded-full overflow-hidden
      transition-all duration-200 ease-out
      ${show ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}
    `}
  >
    {/* 漸層背景 */}
    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500" />
    {/* 閃爍動畫層 */}
    <div 
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
      style={{
        animation: show ? 'shimmer 1.5s ease-in-out infinite' : 'none',
      }}
    />
    {/* 兩端的圓點裝飾 */}
    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
    <style>{`
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `}</style>
  </div>
);

/** 計算元素的拖曳狀態樣式 */
const getDragStyles = (
  index: number,
  dragFromIndex: number | null,
  dragOverIndex: number | null,
  isDragging: boolean
): {
  transform: string;
  opacity: number;
  showIndicatorBefore: boolean;
  showIndicatorAfter: boolean;
} => {
  const base = {
    transform: '',
    opacity: 1,
    showIndicatorBefore: false,
    showIndicatorAfter: false,
  };

  if (dragFromIndex === null || dragOverIndex === null) return base;

  // 被拖曳的元素：降低透明度，輕微縮小
  if (isDragging) {
    return {
      ...base,
      transform: 'scale(0.98)',
      opacity: 0.4,
    };
  }

  // 計算插入指示器位置
  if (dragFromIndex !== dragOverIndex) {
    // 向下拖動
    if (dragFromIndex < dragOverIndex) {
      if (index === dragOverIndex) {
        return { ...base, showIndicatorAfter: true };
      }
    }
    // 向上拖動  
    else if (dragFromIndex > dragOverIndex) {
      if (index === dragOverIndex) {
        return { ...base, showIndicatorBefore: true };
      }
    }
  }

  return base;
};

const ElementBadge: React.FC<ElementBadgeProps> = ({ 
  element,
  index,
  isExpanded, 
  onToggleExpand, 
  onUpdate, 
  onRemove,
  isDragging,
  dragFromIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  currentTheme,
  themeMode
}) => {
  const dragStyles = getDragStyles(index, dragFromIndex, dragOverIndex, isDragging);
  const hasDragActive = dragFromIndex !== null;
  
  const updateTextElement = (updates: Partial<TextElement2D>) => {
    if (isTextElement(element)) {
      onUpdate(updates);
    }
  };

  const updateImageElement = (updates: Partial<ImageElement2D>) => {
    if (isImageElement(element)) {
      onUpdate(updates);
    }
  };

  const updateShapeElement = (updates: Partial<ShapeElement2D>) => {
    if (isShapeElement(element)) {
      onUpdate(updates);
    }
  };

  const updateSpineElement = (updates: Partial<SpineElement2D>) => {
    if (isSpineElement(element)) {
      onUpdate(updates);
    }
  };

  const updatePosition = (axis: 'x' | 'y', value: number) => {
    onUpdate({
      position: { ...element.position, [axis]: value }
    });
  };

  const updateSize = (axis: 'width' | 'height', value: number) => {
    onUpdate({
      size: { ...element.size, [axis]: value }
    });
  };

  return (
    <>
      {/* 插入指示器 - 顯示在元素前方 */}
      <InsertionIndicator show={dragStyles.showIndicatorBefore} />
      
      <div
        draggable={!isExpanded}
        onDragStart={(e) => {
          e.stopPropagation();
          // 設置拖曳圖像為透明（我們用自訂樣式代替）
          const img = new Image();
          img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          e.dataTransfer.setDragImage(img, 0, 0);
          onDragStart(index);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOver(e, index);
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          onDragEnd();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDrop(index);
        }}
        className={`
          group rounded-lg border text-sm relative
          transition-all duration-200 ease-out
          ${isExpanded 
            ? 'border-blue-400/60 bg-blue-500/10' 
            : `${currentTheme.cardBorder} ${currentTheme.cardBg} hover:border-blue-400/30`
          }
          ${isDragging 
            ? 'border-dashed border-blue-400/60 bg-gradient-to-r from-blue-500/5 to-purple-500/5' 
            : ''
          }
          ${hasDragActive && !isDragging
            ? 'hover:border-blue-400/40 hover:bg-blue-500/5 hover:shadow-md hover:shadow-blue-500/10'
            : ''
          }
        `}
        style={{
          transform: dragStyles.transform || undefined,
          opacity: dragStyles.opacity,
          zIndex: isDragging ? 1 : 10,
        }}
      >
      {/* 標題列 */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${isExpanded ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleExpand();
        }}
      >
        <div className="flex items-center gap-2">
          {/* 拖曳把手 - 只在未展開時顯示 */}
          {!isExpanded && (
            <GripVertical 
              size={14} 
              className={`
                text-gray-500 flex-shrink-0
                transition-colors duration-150
                ${isDragging ? 'text-blue-400' : 'group-hover:text-gray-400'}
              `}
            />
          )}
          {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          {element.type === 'text' && <Type size={14} className="text-blue-400 flex-shrink-0" />}
          {element.type === 'image' && <ImageIcon size={14} className="text-emerald-500 flex-shrink-0" />}
          {element.type === 'shape' && <ChevronsDownUp size={14} className="text-amber-500 flex-shrink-0" />}
          {element.type === 'html' && <span className="text-xs font-mono text-purple-400">{'</>'}</span>}
          {element.type === 'spine' && <Bone size={14} className="text-purple-400 flex-shrink-0" />}
          <span className={`text-xs font-medium truncate ${currentTheme.text}`}>{element.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* 顯示/隱藏 按鈕 */}
          <button
            type="button"
            className={`p-1 rounded transition-colors ${
              element.visible ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-gray-400 hover:bg-gray-500/10'
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onUpdate({ visible: !element.visible });
            }}
            title={element.visible ? '隱藏' : '顯示'}
          >
            {element.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          {/* 鎖定/解鎖 按鈕 */}
          <button
            type="button"
            className={`p-1 rounded transition-colors ${
              element.locked ? 'text-amber-500 hover:bg-amber-500/10' : 'text-gray-400 hover:bg-gray-500/10'
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onUpdate({ locked: !element.locked });
            }}
            title={element.locked ? '解鎖' : '鎖定'}
          >
            {element.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          {/* 刪除按鈕 */}
          <button
            type="button"
            className="p-1 rounded transition-colors text-gray-400 hover:text-red-500 hover:bg-red-500/10"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            title="刪除元素"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 展開的編輯面板 */}
      {isExpanded && (
        <div className={`px-3 pb-3 pt-1 border-t ${currentTheme.dividerBorder} space-y-3`} onClick={(e) => e.stopPropagation()}>
          {/* 名稱 */}
          <div>
            <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>名稱</label>
            <input
              type="text"
              className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none focus:ring-1 focus:ring-blue-500 ${currentTheme.text} text-xs`}
              value={element.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
          </div>

          {/* Z-Index 與透明度 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>Z-Index</label>
              <input
                type="number"
                className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                value={element.zIndex}
                onChange={(e) => onUpdate({ zIndex: numberValue(e.target.value, element.zIndex) })}
              />
            </div>
            <div>
              <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>透明度 {Math.round(element.opacity * 100)}%</label>
              <div className="flex items-center h-[30px]">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  className={`w-full h-2 rounded-full cursor-pointer appearance-none bg-gray-600/30
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                    [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full`}
                  value={element.opacity}
                  onChange={(e) => onUpdate({ opacity: numberValue(e.target.value, element.opacity) })}
                />
              </div>
            </div>
          </div>

          {/* 位置 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>X</label>
              <input
                type="number"
                className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                value={element.position.x}
                onChange={(e) => updatePosition('x', numberValue(e.target.value, element.position.x))}
              />
            </div>
            <div>
              <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>Y</label>
              <input
                type="number"
                className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                value={element.position.y}
                onChange={(e) => updatePosition('y', numberValue(e.target.value, element.position.y))}
              />
            </div>
            <div>
              <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>單位</label>
              <select
                className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} ${currentTheme.text} text-xs outline-none`}
                value={element.position.unit}
                onChange={(e) => onUpdate({ position: { ...element.position, unit: e.target.value as 'px' | 'percent' } })}
              >
                <option value="percent" className={themeMode === 'light' ? 'text-black' : 'text-white'}>%</option>
                <option value="px" className={themeMode === 'light' ? 'text-black' : 'text-white'}>px</option>
              </select>
            </div>
          </div>

          {/* 尺寸 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>寬</label>
              <input
                type="number"
                className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                value={element.size.width}
                onChange={(e) => updateSize('width', numberValue(e.target.value, element.size.width))}
              />
            </div>
            <div>
              <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>高</label>
              <input
                type="number"
                className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                value={element.size.height}
                onChange={(e) => updateSize('height', numberValue(e.target.value, element.size.height))}
              />
            </div>
            <div>
              <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>旋轉</label>
              <input
                type="number"
                className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                value={element.rotation}
                onChange={(e) => onUpdate({ rotation: numberValue(e.target.value, element.rotation) })}
              />
            </div>
          </div>

          {/* 文字設定 */}
          {isTextElement(element) && (
            <div className={`space-y-2 pt-2 border-t ${currentTheme.dividerBorder} opacity-80`}>
              <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>文字內容</label>
              <textarea
                className={`w-full px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                rows={2}
                value={element.content}
                onChange={(e) => updateTextElement({ content: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>字體大小</label>
                  <input
                    type="number"
                    className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                    value={element.fontSize}
                    onChange={(e) => updateTextElement({ fontSize: numberValue(e.target.value, element.fontSize) })}
                  />
                </div>
                <div>
                  <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>顏色</label>
                  <input
                    type="color"
                    className={`w-full mt-1 h-7 rounded border ${currentTheme.dividerBorder}`}
                    value={element.color}
                    onChange={(e) => updateTextElement({ color: e.target.value })}
                  />
                </div>
                <div>
                  <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>對齊</label>
                  <select
                    className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} ${currentTheme.text} text-xs outline-none`}
                    value={element.textAlign}
                    onChange={(e) => updateTextElement({ textAlign: e.target.value as TextElement2D['textAlign'] })}
                  >
                    <option value="left" className={themeMode === 'light' ? 'text-black' : 'text-white'}>左</option>
                    <option value="center" className={themeMode === 'light' ? 'text-black' : 'text-white'}>中</option>
                    <option value="right" className={themeMode === 'light' ? 'text-black' : 'text-white'}>右</option>
                  </select>
                </div>
              </div>
              {/* 顯示底板開關 */}
              <div className="flex items-center justify-between pt-2">
                <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>顯示底板</label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTextElement({ showBackground: !element.showBackground });
                  }}
                  className={`
                    relative w-10 h-5 rounded-full transition-colors duration-200
                    ${element.showBackground ? 'bg-blue-500' : 'bg-gray-400'}
                  `}
                >
                  <div
                    className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                      ${element.showBackground ? 'translate-x-5' : 'translate-x-0.5'}
                    `}
                  />
                </button>
              </div>
            </div>
          )}

          {/* 圖片設定 */}
          {isImageElement(element) && (
            <div className={`space-y-2 pt-2 border-t ${currentTheme.dividerBorder} opacity-80`}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>適應模式</label>
                  <select
                    className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} ${currentTheme.text} text-xs outline-none`}
                    value={element.objectFit}
                    onChange={(e) => updateImageElement({ objectFit: e.target.value as ImageElement2D['objectFit'] })}
                  >
                    <option value="contain" className={themeMode === 'light' ? 'text-black' : 'text-white'}>Contain</option>
                    <option value="cover" className={themeMode === 'light' ? 'text-black' : 'text-white'}>Cover</option>
                    <option value="fill" className={themeMode === 'light' ? 'text-black' : 'text-white'}>Fill</option>
                    <option value="none" className={themeMode === 'light' ? 'text-black' : 'text-white'}>None</option>
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>圓角</label>
                  <input
                    type="number"
                    className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                    value={element.borderRadius}
                    onChange={(e) => updateImageElement({ borderRadius: numberValue(e.target.value, element.borderRadius) })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 形狀設定 */}
          {isShapeElement(element) && (
            <div className={`space-y-2 pt-2 border-t ${currentTheme.dividerBorder} opacity-80`}>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>填色</label>
                  <input
                    type="color"
                    className={`w-full mt-1 h-7 rounded border ${currentTheme.dividerBorder}`}
                    value={element.fillColor}
                    onChange={(e) => updateShapeElement({ fillColor: e.target.value })}
                  />
                </div>
                <div>
                  <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>邊框色</label>
                  <input
                    type="color"
                    className={`w-full mt-1 h-7 rounded border ${currentTheme.dividerBorder}`}
                    value={element.strokeColor}
                    onChange={(e) => updateShapeElement({ strokeColor: e.target.value })}
                  />
                </div>
                <div>
                  <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>邊框寬</label>
                  <input
                    type="number"
                    className={`w-full mt-1 px-2 py-1.5 ${currentTheme.inputBg} rounded border ${currentTheme.inputBorder} focus:outline-none ${currentTheme.text} text-xs`}
                    value={element.strokeWidth}
                    onChange={(e) => updateShapeElement({ strokeWidth: numberValue(e.target.value, element.strokeWidth) })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Spine 設定 */}
          {isSpineElement(element) && (
            <div className={`space-y-3 pt-2 border-t ${currentTheme.dividerBorder} opacity-80`}>
              {/* 縮放 */}
              <div>
                <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>
                  縮放 {((element as SpineElement2D).scale ?? 1).toFixed(2)}x
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 relative h-4 flex items-center">
                    <div className="absolute w-full h-1.5 bg-gray-600/30 rounded-full" />
                    <div 
                      className="absolute h-1.5 bg-purple-500/60 rounded-full" 
                      style={{ width: `${(((element as SpineElement2D).scale ?? 1) - 0.1) / 2.9 * 100}%` }}
                    />
                    <input
                      type="range"
                      min={0.1}
                      max={3}
                      step={0.05}
                      draggable={false}
                      className="absolute w-full h-4 cursor-pointer appearance-none bg-transparent
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                        [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full"
                      value={(element as SpineElement2D).scale ?? 1}
                      onMouseDown={(e) => e.stopPropagation()}
                      onDragStart={(e) => e.preventDefault()}
                      onChange={(e) => updateSpineElement({ scale: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  {[0.5, 0.75, 1.0, 1.5, 2.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSpineElement({ scale: s })}
                      className={`flex-1 py-1 text-[10px] rounded transition-colors ${
                        Math.abs(((element as SpineElement2D).scale ?? 1) - s) < 0.01
                          ? 'bg-purple-500/30 text-purple-600 dark:text-purple-200 border border-purple-500/50 shadow-sm font-medium'
                          : `${currentTheme.inputBg} ${currentTheme.text} opacity-60 hover:opacity-100 border ${currentTheme.inputBorder}`
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* 適應模式 */}
              <div>
                <label className={`text-[10px] ${currentTheme.sectionLabel} uppercase`}>適應模式</label>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {([
                    { mode: 'fill' as SpineFitMode, label: 'Fill' },
                    { mode: 'contain' as SpineFitMode, label: 'Contain' },
                    { mode: 'cover' as SpineFitMode, label: 'Cover' },
                    { mode: 'none' as SpineFitMode, label: 'None' },
                  ]).map(({ mode, label }) => (
                    <button
                      key={mode}
                      onClick={() => updateSpineElement({ fitMode: mode })}
                      className={`py-1 text-[10px] rounded transition-colors ${
                        ((element as SpineElement2D).fitMode ?? 'fill') === mode
                          ? 'bg-purple-500/30 text-purple-600 dark:text-purple-200 border border-purple-500/50 shadow-sm font-medium'
                          : `${currentTheme.inputBg} ${currentTheme.text} opacity-60 hover:opacity-100 border ${currentTheme.inputBorder}`
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
      </div>
      
      {/* 插入指示器 - 顯示在元素後方 */}
      <InsertionIndicator show={dragStyles.showIndicatorAfter} />
    </>
  );
};

const LayerCard: React.FC<{
  layer: Layer;
  isActive: boolean;
  direction: 'front' | 'back';
  index: number;
  onDragStart: (direction: 'front' | 'back', index: number) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>, direction: 'front' | 'back', index: number) => void;
  onDrop: (direction: 'front' | 'back', index: number) => void;
  onSelectLayer: (layerId: string) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onToggleLayerLock: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onUpdateLayerPriority: (layerId: string, priority: number) => void;
  onUpdateLayerOpacity: (layerId: string, opacity: number) => void;
  onAddTextElement: (layerId: string) => void;
  onTriggerAddImage: (layerId: string) => void;
  onTriggerAddSpine?: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onToggleExpand: (layerId: string) => void;
  children: React.ReactNode;
  currentTheme: ThemeStyle;
  themeMode: ThemeMode;
}> = ({
  layer,
  isActive,
  direction,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onRenameLayer,
  onUpdateLayerPriority,
  onUpdateLayerOpacity,
  onAddTextElement,
  onTriggerAddImage,
  onTriggerAddSpine,
  onDeleteLayer,
  onToggleExpand,
  children,
  currentTheme,
  themeMode
}) => (
  <div
    onDragOver={(event) => onDragOver(event, direction, index)}
    onDrop={() => onDrop(direction, index)}
    className={`rounded-xl border px-4 py-3 mb-3 transition-colors ${
      isActive 
        ? 'border-blue-400/60 bg-blue-500/10 shadow-lg shadow-blue-500/5' 
        : `${currentTheme.cardBorder} ${currentTheme.cardBg} hover:border-blue-400/30`
    }`}
    onClick={() => onSelectLayer(layer.id)}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 flex items-center gap-2">
        {/* 拖曳把手：只有從這裡才能開始拖曳排序（避免拖拉滑桿時誤觸整張卡片拖曳） */}
        <div
          draggable
          className={`p-1 rounded text-gray-500 hover:text-blue-400 cursor-grab active:cursor-grabbing transition-colors`}
          title="拖曳排序"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.stopPropagation();
            // 設置拖曳圖像為透明（避免出現整張 UI 被抓起來的殘影）
            const img = new Image();
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            event.dataTransfer.setDragImage(img, 0, 0);
            onDragStart(direction, index);
          }}
        >
          <GripVertical size={16} />
        </div>
        <button
          type="button"
          className={`p-1 rounded transition-colors text-gray-400 hover:text-blue-400 hover:bg-blue-500/5`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand(layer.id);
          }}
          title={layer.expanded ? '收合' : '展開'}
        >
          {layer.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <input
          type="text"
          className={`w-full bg-transparent text-sm font-bold ${currentTheme.text} focus:outline-none`}
          value={layer.name}
          onChange={(event) => {
            event.stopPropagation();
            onRenameLayer(layer.id, event.target.value);
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`p-1.5 rounded-full ${currentTheme.inputBg} hover:bg-blue-500/10 text-gray-400 hover:text-emerald-500 transition-colors`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLayerVisibility(layer.id);
          }}
        >
          {layer.visible ? <Eye size={16} className="text-emerald-500" /> : <EyeOff size={16} />}
        </button>
        <button
          type="button"
          className={`p-1.5 rounded-full ${currentTheme.inputBg} hover:bg-blue-500/10 text-gray-400 hover:text-amber-500 transition-colors`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLayerLock(layer.id);
          }}
        >
          {layer.locked ? <Lock size={16} className="text-amber-500" /> : <Unlock size={16} />}
        </button>
        <button
          type="button"
          className="p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteLayer(layer.id);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>

    {/* 屬性區塊 - 緊湊橫向佈局（阻止拖曳事件冒泡） */}
    <div 
      className="flex items-center gap-4 mt-3 text-xs"
      onMouseDown={(event) => event.stopPropagation()}
      onDragStart={(event) => event.preventDefault()}
    >
      {/* Priority */}
      <div className="flex items-center gap-2">
        <span className={`${currentTheme.sectionLabel}`}>層級</span>
        <input
          type="number"
          className={`w-12 ${currentTheme.inputBg} rounded px-2 py-1 ${currentTheme.text} text-center border ${currentTheme.inputBorder} outline-none`}
          defaultValue={layer.priority}
          key={`priority-${layer.id}-${layer.priority}`}
          onBlur={(event) => {
            event.stopPropagation();
            const value = event.target.value.trim();
            if (value === '') {
              event.target.value = String(layer.priority);
              return;
            }
            const nextValue = Number(value);
            if (Number.isNaN(nextValue) || nextValue === 0) {
              event.target.value = String(layer.priority);
              return;
            }
            onUpdateLayerPriority(layer.id, nextValue);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          onClick={(event) => event.stopPropagation()}
        />
      </div>

      {/* 分隔線 */}
      <div className={`w-px h-4 ${currentTheme.dividerBg}`} />

      {/* Opacity */}
      <div className="flex items-center gap-2 flex-1">
        <span className={`${currentTheme.sectionLabel}`}>透明</span>
        <div className="flex-1 relative h-4 flex items-center">
          {/* 底色軌道 */}
          <div className="absolute w-full h-1.5 bg-gray-600/20 rounded-full" />
          {/* 進度軌道 */}
          <div 
            className="absolute h-1.5 bg-blue-500/60 rounded-full" 
            style={{ width: `${layer.opacity * 100}%` }}
          />
          {/* 滑桿 */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            draggable={false}
            className="absolute w-full h-4 cursor-pointer appearance-none bg-transparent
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer
              [&::-webkit-slider-runnable-track]:bg-transparent
              [&::-moz-range-track]:bg-transparent"
            value={layer.opacity}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onDragStart={(event) => event.preventDefault()}
            onChange={(event) => {
              event.stopPropagation();
              const nextValue = Number(event.target.value);
              if (Number.isNaN(nextValue)) {
                return;
              }
              onUpdateLayerOpacity(layer.id, nextValue);
            }}
          />
        </div>
        <span className={`${currentTheme.text} opacity-60 w-8 text-right font-mono`}>{Math.round(layer.opacity * 100)}%</span>
      </div>

      {/* 分隔線 */}
      <div className={`w-px h-4 ${currentTheme.dividerBg}`} />

      {/* 添加元素按鈕 - 圖標式 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`p-1.5 rounded ${currentTheme.inputBg} hover:bg-blue-500/10 text-gray-500 hover:text-blue-500 transition-colors border ${currentTheme.inputBorder}`}
          onClick={(event) => {
            event.stopPropagation();
            onAddTextElement(layer.id);
          }}
          title="添加文字"
        >
          <Type size={14} />
        </button>
        <button
          type="button"
          className={`p-1.5 rounded ${currentTheme.inputBg} hover:bg-blue-500/10 text-gray-500 hover:text-emerald-500 transition-colors border ${currentTheme.inputBorder}`}
          onClick={(event) => {
            event.stopPropagation();
            onTriggerAddImage(layer.id);
          }}
          title="添加圖片"
        >
          <ImageIcon size={14} />
        </button>
        {onTriggerAddSpine && (
          <button
            type="button"
            className={`p-1.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-colors border border-purple-500/20`}
            onClick={(event) => {
              event.stopPropagation();
              onTriggerAddSpine(layer.id);
            }}
            title="添加 Spine"
          >
            <Bone size={14} />
          </button>
        )}
      </div>
    </div>

    {children}
  </div>
);

export const LayerManagerPanel: React.FC<LayerManagerPanelProps> = ({
  layers,
  activeLayerId,
  activeElementId,
  onSelectLayer,
  onSelectElement,
  onCreateLayer,
  onDeleteLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onRenameLayer,
  onToggleExpand,
  onUpdateLayerPriority,
  onUpdateLayerOpacity,
  onReorderLayer,
  onAddTextElement,
  onAddImageElement,
  onAddSpineElement,
  onReorderElement,
  onUpdateElement,
  onRemoveElement,
  currentTheme,
  themeMode
}) => {
  const frontLayers = useMemo(
    () => sortLayersByPriority(layers.filter(layer => layer.priority > 0)),
    [layers]
  );
  const backLayers = useMemo(
    () => sortLayersByPriority(layers.filter(layer => layer.priority < 0)),
    [layers]
  );
  const baseLayer = layers.find(layer => layer.priority === 0);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pendingImageLayerId, setPendingImageLayerId] = useState<string | null>(null);
  const [pendingSpineLayerId, setPendingSpineLayerId] = useState<string | null>(null);
  const [showSpineUploader, setShowSpineUploader] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [expandedElementId, setExpandedElementId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 元素拖拽排序狀態
  const [elementDragState, setElementDragState] = useState<{
    layerId: string;
    fromIndex: number;
  } | null>(null);
  const [elementDragOverIndex, setElementDragOverIndex] = useState<number | null>(null);
  
  // 使用 ref 來保存拖拽狀態，避免 onDragEnd 先於 onDrop 觸發導致狀態丟失
  const elementDragStateRef = useRef<{ layerId: string; fromIndex: number } | null>(null);
  const elementDragOverIndexRef = useRef<number | null>(null);

  const handleDragStart = (direction: 'front' | 'back', index: number) => {
    setDragState({ direction, index });
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, direction: 'front' | 'back', index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (direction: 'front' | 'back', index: number) => {
    if (!dragState || dragState.direction !== direction) {
      setDragState(null);
      return;
    }
    onReorderLayer(direction, dragState.index, index);
    setDragState(null);
  };

  const triggerImageUpload = (layerId: string) => {
    setPendingImageLayerId(layerId);
    fileInputRef.current?.click();
  };

  const triggerSpineUpload = useCallback((layerId: string) => {
    setPendingSpineLayerId(layerId);
    setShowSpineUploader(true);
  }, []);

  const handleSpineUploadSuccess = useCallback((spineInstance: SpineInstance) => {
    if (pendingSpineLayerId && onAddSpineElement) {
      onAddSpineElement(pendingSpineLayerId, spineInstance);
    }
    setShowSpineUploader(false);
    setPendingSpineLayerId(null);
  }, [pendingSpineLayerId, onAddSpineElement]);

  const handleSpineUploadClose = useCallback(() => {
    setShowSpineUploader(false);
    setPendingSpineLayerId(null);
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !pendingImageLayerId) {
        setPendingImageLayerId(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        onAddImageElement(pendingImageLayerId, dataUrl);
        setPendingImageLayerId(null);
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    [pendingImageLayerId, onAddImageElement]
  );

  // 元素拖拽處理
  const handleElementDragStart = useCallback((layerId: string, index: number) => {
    const state = { layerId, fromIndex: index };
    setElementDragState(state);
    elementDragStateRef.current = state;
    setElementDragOverIndex(null);
    elementDragOverIndexRef.current = null;
  }, []);

  const handleElementDragOver = useCallback((layerId: string, index: number) => {
    const dragState = elementDragStateRef.current || elementDragState;
    if (!dragState || dragState.layerId !== layerId) return;
    if (dragState.fromIndex !== index) {
      setElementDragOverIndex(index);
      elementDragOverIndexRef.current = index;
    }
  }, [elementDragState]);

  const handleElementDragEnd = useCallback(() => {
    // 延遲清空狀態，確保 onDrop 可以讀取到
    setTimeout(() => {
      setElementDragState(null);
      setElementDragOverIndex(null);
      elementDragStateRef.current = null;
      elementDragOverIndexRef.current = null;
    }, 0);
  }, []);

  const handleElementDrop = useCallback((layerId: string, _toIndex: number) => {
    // 使用 ref 中保存的狀態（因為 onDragEnd 可能先觸發導致 state 被清空）
    const dragState = elementDragStateRef.current || elementDragState;
    const targetIndex = elementDragOverIndexRef.current ?? elementDragOverIndex;
    
    if (!dragState || dragState.layerId !== layerId || targetIndex === null) {
      handleElementDragEnd();
      return;
    }
    
    const { fromIndex } = dragState;
    if (fromIndex !== targetIndex) {
      onReorderElement(layerId, fromIndex, targetIndex);
    }
    handleElementDragEnd();
  }, [elementDragState, elementDragOverIndex, onReorderElement, handleElementDragEnd]);

  const renderLayerList = (list: Layer[], direction: 'front' | 'back') => (
    <div>
      {list.map((layer, index) => {
        const elements = layer.children;
        return (
          <LayerCard
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
            direction={direction}
            index={index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onSelectLayer={onSelectLayer}
            onToggleLayerVisibility={onToggleLayerVisibility}
            onToggleLayerLock={onToggleLayerLock}
            onRenameLayer={onRenameLayer}
            onUpdateLayerPriority={onUpdateLayerPriority}
            onUpdateLayerOpacity={onUpdateLayerOpacity}
            onAddTextElement={onAddTextElement}
            onTriggerAddImage={triggerImageUpload}
            onTriggerAddSpine={onAddSpineElement ? triggerSpineUpload : undefined}
            onDeleteLayer={onDeleteLayer}
            onToggleExpand={onToggleExpand}
            currentTheme={currentTheme}
            themeMode={themeMode}
          >
            {layer.expanded && elements.length > 0 && (
              <div className="mt-2 space-y-1">
                {elements.map((element, elementIndex) => (
                  <ElementBadge
                    key={element.id}
                    element={element}
                    index={elementIndex}
                    isExpanded={expandedElementId === element.id}
                    onToggleExpand={() => {
                      const isCurrentlyExpanded = expandedElementId === element.id;
                      setExpandedElementId(isCurrentlyExpanded ? null : element.id);
                      // 展開時選取，收合時取消選取
                      if (isCurrentlyExpanded) {
                        onSelectElement(layer.id, '');  // 傳空字串表示取消選取
                      } else {
                        onSelectElement(layer.id, element.id);
                      }
                    }}
                    onUpdate={(updates) => onUpdateElement(layer.id, element.id, updates)}
                    onRemove={() => onRemoveElement(layer.id, element.id)}
                    isDragging={elementDragState?.layerId === layer.id && elementDragState?.fromIndex === elementIndex}
                    dragFromIndex={elementDragState?.layerId === layer.id ? elementDragState.fromIndex : null}
                    dragOverIndex={elementDragState?.layerId === layer.id ? elementDragOverIndex : null}
                    onDragStart={(idx) => handleElementDragStart(layer.id, idx)}
                    onDragOver={(e, idx) => handleElementDragOver(layer.id, idx)}
                    onDragEnd={handleElementDragEnd}
                    onDrop={(idx) => handleElementDrop(layer.id, idx)}
                    currentTheme={currentTheme}
                    themeMode={themeMode}
                  />
                ))}
              </div>
            )}
          </LayerCard>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={`text-base font-bold ${currentTheme.text}`}>Layer 管理</h3>
          <button
            type="button"
            onClick={() => setShowHint(prev => !prev)}
            className={`p-1 rounded transition-colors ${showHint ? 'text-blue-500 bg-blue-500/10' : 'text-gray-400 hover:text-blue-500'}`}
            title="顯示說明"
          >
            <HelpCircle size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowTools(prev => !prev)}
            className={`p-1 rounded transition-colors ${showTools ? 'text-cyan-500 bg-cyan-500/10' : 'text-gray-400 hover:text-cyan-500'}`}
            title="圖片工具"
          >
            <Wand2 size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-200 border border-teal-500/20 hover:bg-teal-500/20 transition-all font-medium"
            onClick={() => onCreateLayer('front')}
          >
            <PlusCircle size={14} /> 前景
          </button>
          <button
            type="button"
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-200 border border-purple-500/20 hover:bg-purple-500/20 transition-all font-medium"
            onClick={() => onCreateLayer('back')}
          >
            <PlusCircle size={14} /> 背景
          </button>
        </div>
      </div>

      {/* 提示教學面板 */}
      <HintPanel isOpen={showHint} onClose={() => setShowHint(false)} currentTheme={currentTheme} />

      {/* 圖片工具面板 */}
      <ImageToolsPanel isOpen={showTools} onClose={() => setShowTools(false)} currentTheme={currentTheme} themeMode={themeMode} />

      {/* 前景層 */}
      <SectionDivider label="前景" color="teal" currentTheme={currentTheme} />
      {frontLayers.length === 0 ? (
        <p className={`text-xs ${currentTheme.sectionLabel} text-center py-4 border border-dashed ${currentTheme.cardBorder} rounded-xl opacity-60`}>尚未新增前景層</p>
      ) : (
        renderLayerList(frontLayers, 'front')
      )}

      {/* 3D Scene 基礎層 */}
      {baseLayer && (
        <div className={`rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-600 dark:text-blue-100 shadow-sm shadow-blue-500/5`}>
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-blue-500" />
            <span className="font-bold">{baseLayer.name}</span>
          </div>
        </div>
      )}

      {/* 背景層 */}
      <SectionDivider label="背景" color="purple" currentTheme={currentTheme} />
      {backLayers.length === 0 ? (
        <p className={`text-xs ${currentTheme.sectionLabel} text-center py-4 border border-dashed ${currentTheme.cardBorder} rounded-xl opacity-60`}>尚未新增背景層</p>
      ) : (
        renderLayerList(backLayers, 'back')
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Spine 上傳模態框 */}
      {showSpineUploader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`relative w-full max-w-md ${currentTheme.panelBg} rounded-2xl border ${currentTheme.panelBorder} shadow-2xl`}>
            <div className={`flex items-center justify-between p-4 border-b ${currentTheme.dividerBorder}`}>
              <h3 className={`text-lg font-bold ${currentTheme.text} flex items-center gap-2`}>
                <Bone size={20} className="text-purple-500" />
                新增 Spine 動畫
              </h3>
              <button
                onClick={handleSpineUploadClose}
                className={`p-1.5 rounded-lg ${currentTheme.itemHover} text-gray-400 hover:text-red-500 transition-colors`}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <SpineFileUploader
                onUploadSuccess={handleSpineUploadSuccess}
                onUploadError={(err) => console.error('[LayerManagerPanel] Spine 載入失敗:', err)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


