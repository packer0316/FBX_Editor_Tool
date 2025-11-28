import React, { useMemo } from 'react';
import type { Element2D, ImageElement2D, ShapeElement2D, TextElement2D } from '../../../../domain/value-objects/Element2D';
import { isImageElement, isShapeElement, isTextElement } from '../../../../domain/value-objects/Element2D';
import type { Layer } from '../../../../domain/value-objects/Layer';

interface Element2DEditorPanelProps {
  layer: Layer | undefined;
  element: Element2D | undefined;
  onUpdate: (updates: Partial<Element2D>) => void;
  onRemove: () => void;
}

const Section: React.FC<{ title: string }> = ({ title, children }) => (
  <div className="mb-5">
    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">{title}</p>
    <div className="space-y-3">{children}</div>
  </div>
);

const InputRow: React.FC<{ label: string }> = ({ label, children }) => (
  <label className="flex flex-col gap-1 text-sm text-gray-300">
    <span className="text-xs text-gray-400">{label}</span>
    {children}
  </label>
);

const numberValue = (value: number | string, fallback = 0): number => {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const Element2DEditorPanel: React.FC<Element2DEditorPanelProps> = ({
  layer,
  element,
  onUpdate,
  onRemove
}) => {
  const info = useMemo(() => {
    if (!layer || !element) {
      return null;
    }

    return {
      general: [
        { label: 'Layer', value: layer.name },
        { label: 'Element', value: element.name }
      ]
    };
  }, [layer, element]);

  if (!layer || !element) {
    return (
      <div className="p-4 rounded-xl border border-white/5 bg-white/5 text-sm text-gray-400">
        選擇任一 2D Layer 與元素即可進行細部設定。
      </div>
    );
  }

  const updatePosition = (axis: 'x' | 'y', value: number) => {
    onUpdate({
      position: {
        ...element.position,
        [axis]: value
      }
    });
  };

  const updateSize = (axis: 'width' | 'height', value: number) => {
    onUpdate({
      size: {
        ...element.size,
        [axis]: value
      }
    });
  };

  const updatePositionUnit = (unit: 'px' | 'percent') => {
    onUpdate({
      position: {
        ...element.position,
        unit
      }
    });
  };

  const updateSizeUnit = (unit: 'px' | 'percent') => {
    onUpdate({
      size: {
        ...element.size,
        unit
      }
    });
  };

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
        {info?.general.map(item => (
          <div key={item.label} className="bg-black/30 border border-white/5 rounded-lg px-3 py-2">
            <p className="uppercase tracking-wide text-[10px] opacity-60">{item.label}</p>
            <p className="text-sm text-white mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      <Section title="基本設定">
        <InputRow label="名稱">
          <input
            type="text"
            className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
            value={element.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
          />
        </InputRow>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${element.visible ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50' : 'bg-black/30 border-white/10 text-gray-300'}`}
            onClick={() => onUpdate({ visible: !element.visible })}
          >
            {element.visible ? '顯示中' : '已隱藏'}
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${element.locked ? 'bg-gray-600/40 text-gray-200 border-gray-500' : 'bg-black/30 border-white/10 text-gray-300'}`}
            onClick={() => onUpdate({ locked: !element.locked })}
          >
            {element.locked ? '已鎖定' : '可編輯'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InputRow label="Priority (Z)">
            <input
              type="number"
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
              value={element.zIndex}
              onChange={(event) => onUpdate({ zIndex: numberValue(event.target.value, element.zIndex) })}
            />
          </InputRow>
          <InputRow label="透明度">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={element.opacity}
              onChange={(event) => onUpdate({ opacity: numberValue(event.target.value, element.opacity) })}
            />
          </InputRow>
        </div>
      </Section>

      <Section title="位置與尺寸">
        <div className="grid grid-cols-2 gap-3">
          <InputRow label="X">
            <input
              type="number"
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
              value={element.position.x}
              onChange={(event) => updatePosition('x', numberValue(event.target.value, element.position.x))}
            />
          </InputRow>
          <InputRow label="Y">
            <input
              type="number"
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
              value={element.position.y}
              onChange={(event) => updatePosition('y', numberValue(event.target.value, element.position.y))}
            />
          </InputRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InputRow label="座標單位">
            <select
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 text-white text-sm"
              value={element.position.unit}
              onChange={(event) => updatePositionUnit(event.target.value as 'px' | 'percent')}
            >
              <option value="percent">%</option>
              <option value="px">px</option>
            </select>
          </InputRow>
          <InputRow label="旋轉">
            <input
              type="number"
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
              value={element.rotation}
              onChange={(event) => onUpdate({ rotation: numberValue(event.target.value, element.rotation) })}
            />
          </InputRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InputRow label="寬度">
            <input
              type="number"
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
              value={element.size.width}
              onChange={(event) => updateSize('width', numberValue(event.target.value, element.size.width))}
            />
          </InputRow>
          <InputRow label="高度">
            <input
              type="number"
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
              value={element.size.height}
              onChange={(event) => updateSize('height', numberValue(event.target.value, element.size.height))}
            />
          </InputRow>
        </div>

        <InputRow label="尺寸單位">
          <select
            className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 text-white text-sm"
            value={element.size.unit}
            onChange={(event) => updateSizeUnit(event.target.value as 'px' | 'percent')}
          >
            <option value="px">px</option>
            <option value="percent">%</option>
          </select>
        </InputRow>
      </Section>

      {isTextElement(element) && (
        <Section title="文字設定">
          <InputRow label="文字內容">
            <textarea
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
              rows={3}
              value={element.content}
              onChange={(event) => updateTextElement({ content: event.target.value })}
            />
          </InputRow>
          <div className="grid grid-cols-2 gap-3">
            <InputRow label="字體大小(px)">
              <input
                type="number"
                className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
                value={element.fontSize}
                onChange={(event) => updateTextElement({ fontSize: numberValue(event.target.value, element.fontSize) })}
              />
            </InputRow>
            <InputRow label="字重">
              <input
                type="number"
                className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
                value={element.fontWeight}
                onChange={(event) => updateTextElement({ fontWeight: numberValue(event.target.value, element.fontWeight) })}
              />
            </InputRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InputRow label="文字顏色">
              <input
                type="color"
                className="h-10 rounded"
                value={element.color}
                onChange={(event) => updateTextElement({ color: event.target.value })}
              />
            </InputRow>
            <InputRow label="行高">
              <input
                type="number"
                step={0.1}
                className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
                value={element.lineHeight}
                onChange={(event) => updateTextElement({ lineHeight: numberValue(event.target.value, element.lineHeight) })}
              />
            </InputRow>
          </div>
          <InputRow label="對齊">
            <select
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 text-white text-sm"
              value={element.textAlign}
              onChange={(event) => updateTextElement({ textAlign: event.target.value as TextElement2D['textAlign'] })}
            >
              <option value="left">靠左</option>
              <option value="center">置中</option>
              <option value="right">靠右</option>
            </select>
          </InputRow>
        </Section>
      )}

      {isImageElement(element) && (
        <Section title="圖片設定">
          <InputRow label="適應模式">
            <select
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 text-white text-sm"
              value={element.objectFit}
              onChange={(event) => updateImageElement({ objectFit: event.target.value as ImageElement2D['objectFit'] })}
            >
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
              <option value="fill">Fill</option>
              <option value="none">None</option>
            </select>
          </InputRow>

          <InputRow label="圓角(px)">
            <input
              type="number"
              className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
              value={element.borderRadius}
              onChange={(event) => updateImageElement({ borderRadius: numberValue(event.target.value, element.borderRadius) })}
            />
          </InputRow>
        </Section>
      )}

      {isShapeElement(element) && (
        <Section title="形狀設定">
          <InputRow label="填色">
            <input
              type="color"
              className="h-10 rounded"
              value={element.fillColor}
              onChange={(event) => updateShapeElement({ fillColor: event.target.value })}
            />
          </InputRow>
          <div className="grid grid-cols-2 gap-3">
            <InputRow label="邊框色">
              <input
                type="color"
                className="h-10 rounded"
                value={element.strokeColor}
                onChange={(event) => updateShapeElement({ strokeColor: event.target.value })}
              />
            </InputRow>
            <InputRow label="邊框寬度">
              <input
                type="number"
                className="px-3 py-2 bg-black/30 rounded-lg border border-white/10 focus:outline-none text-white text-sm"
                value={element.strokeWidth}
                onChange={(event) => updateShapeElement({ strokeWidth: numberValue(event.target.value, element.strokeWidth) })}
              />
            </InputRow>
          </div>
        </Section>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="w-full py-2 rounded-lg text-sm font-medium border border-red-500/40 text-red-200 hover:bg-red-500/10 transition-colors"
      >
        刪除此元素
      </button>
    </div>
  );
};





