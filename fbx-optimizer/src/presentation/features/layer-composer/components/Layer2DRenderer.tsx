import React, { memo, useMemo, useRef, useCallback, useEffect, useState } from 'react';
import type { Element2D } from '../../../../domain/value-objects/Element2D';
import { isImageElement, isShapeElement, isTextElement } from '../../../../domain/value-objects/Element2D';
import type { Layer } from '../../../../domain/value-objects/Layer';

/** XY 軸指示器組件 - 顯示在元素中心，Y軸向上為正 */
const AxisIndicator: React.FC = () => (
  <div
    className="absolute pointer-events-none"
    style={{
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 9999
    }}
  >
    <svg
      width="100"
      height="100"
      viewBox="0 0 100 100"
    >
      {/* 原點圓圈 */}
      <circle cx="50" cy="50" r="6" fill="#fff" stroke="#333" strokeWidth="2" />
      
      {/* X 軸 (紅色) - 向右 */}
      <line x1="50" y1="50" x2="90" y2="50" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
      <polygon points="96,50 84,44 84,56" fill="#ef4444" />
      <text x="82" y="68" fontSize="14" fontWeight="bold" fill="#ef4444">X</text>
      
      {/* Y 軸 (綠色) - 向上 */}
      <line x1="50" y1="50" x2="50" y2="10" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" />
      <polygon points="50,4 44,16 56,16" fill="#22c55e" />
      <text x="58" y="18" fontSize="14" fontWeight="bold" fill="#22c55e">Y</text>
    </svg>
  </div>
);

export interface Layer2DRendererProps {
  layer: Layer;
  zIndex: number;
  isActiveLayer: boolean;
  activeElementId: string | null;
  onSelectElement?: (layerId: string, elementId: string) => void;
  onUpdateElement?: (layerId: string, elementId: string, updates: Partial<Element2D>) => void;
  pointerEnabled?: boolean;
}

const getSizeStyle = (element: Element2D) => ({
  width: element.size.unit === 'percent' ? `${element.size.width}%` : `${element.size.width}px`,
  height: element.size.unit === 'percent' ? `${element.size.height}%` : `${element.size.height}px`
});

const getPositionStyle = (element: Element2D) => ({
  left: element.position.unit === 'percent' ? `${element.position.x}%` : `${element.position.x}px`,
  // Y 軸向上為正：用 100% - y 或 bottom 定位
  top: element.position.unit === 'percent' 
    ? `calc(100% - ${element.position.y}%)` 
    : undefined,
  bottom: element.position.unit === 'px' ? `${element.position.y}px` : undefined
});

const renderElementContent = (element: Element2D) => {
  if (isTextElement(element)) {
    return (
      <div
        className="w-full h-full flex items-center justify-center px-4 text-center"
        style={{
          fontSize: `${element.fontSize}px`,
          fontFamily: element.fontFamily,
          fontWeight: element.fontWeight,
          color: element.color,
          textAlign: element.textAlign,
          lineHeight: element.lineHeight,
          textShadow: element.textShadow
        }}
      >
        {element.content}
      </div>
    );
  }

  if (isImageElement(element)) {
    return (
      <img
        src={element.src}
        alt={element.name}
        className="w-full h-full"
        style={{
          objectFit: element.objectFit,
          borderRadius: `${element.borderRadius}px`,
          filter: element.filter
        }}
      />
    );
  }

  if (isShapeElement(element)) {
    const commonStyle: React.CSSProperties = {
      backgroundColor: element.shape === 'line' ? 'transparent' : element.fillColor,
      borderRadius: element.shape === 'circle' ? '50%' : 0,
      borderWidth: element.strokeWidth,
      borderStyle: element.strokeWidth > 0 ? 'solid' : 'none',
      borderColor: element.strokeColor,
      borderImage: 'initial'
    };

    if (element.shape === 'line') {
      return (
        <div
          className="w-full h-full"
          style={{
            borderTopWidth: element.strokeWidth,
            borderTopColor: element.strokeColor,
            borderTopStyle: 'solid',
            borderImage: 'initial'
          }}
        />
      );
    }

    return <div className="w-full h-full" style={commonStyle} />;
  }

  return (
    <div
      className="w-full h-full text-xs"
      dangerouslySetInnerHTML={{ __html: (element as any).html ?? '' }}
    />
  );
};

const Layer2DRendererComponent: React.FC<Layer2DRendererProps> = ({
  layer,
  zIndex,
  isActiveLayer,
  activeElementId,
  onSelectElement,
  onUpdateElement,
  pointerEnabled = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    elementId: string;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const visibleElements = useMemo(
    () => layer.children.filter(element => element.visible),
    [layer.children]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent, element: Element2D) => {
    // 只有選中且未鎖定的元素才能拖動
    const isActive = isActiveLayer && element.id === activeElementId;
    if (!isActive || element.locked || !onUpdateElement) return;

    e.preventDefault();
    e.stopPropagation();

    setDragging({
      elementId: element.id,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: element.position.x,
      startPosY: element.position.y
    });
  }, [isActiveLayer, activeElementId, onUpdateElement]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !containerRef.current || !onUpdateElement) return;

    const element = layer.children.find(el => el.id === dragging.elementId);
    if (!element) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragging.startX;
    const deltaY = e.clientY - dragging.startY;

    let newX: number;
    let newY: number;

    if (element.position.unit === 'percent') {
      // 百分比模式：將像素差值轉換為百分比
      const deltaXPercent = (deltaX / containerRect.width) * 100;
      const deltaYPercent = (deltaY / containerRect.height) * 100;
      newX = dragging.startPosX + deltaXPercent;
      newY = dragging.startPosY - deltaYPercent; // Y軸向上為正：向上拖動(deltaY負)增加Y值
    } else {
      // 像素模式
      newX = dragging.startPosX + deltaX;
      newY = dragging.startPosY - deltaY; // Y軸向上為正：向上拖動(deltaY負)增加Y值
    }

    onUpdateElement(layer.id, element.id, {
      position: {
        ...element.position,
        x: Math.round(newX * 100) / 100,
        y: Math.round(newY * 100) / 100
      }
    });
  }, [dragging, layer.id, layer.children, onUpdateElement]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // 全域監聽 mousemove 和 mouseup
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  if (layer.type !== '2d' || !layer.visible || visibleElements.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        zIndex,
        pointerEvents: pointerEnabled ? 'auto' : 'none'
      }}
    >
      {visibleElements.map(element => {
        const style: React.CSSProperties = {
          ...getSizeStyle(element),
          ...getPositionStyle(element),
          opacity: layer.opacity * element.opacity,
          transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
          zIndex: element.zIndex
        };

        const isActive = isActiveLayer && element.id === activeElementId;
        const isDragging = dragging?.elementId === element.id;

        return (
          <div
            key={element.id}
            role="button"
            tabIndex={0}
            className={`absolute cursor-pointer ${isDragging ? '' : 'transition-all duration-150'}`}
            style={{
              ...style,
              outline: isActive ? '1px dashed rgba(96, 165, 250, 0.8)' : 'none',
              outlineOffset: '3px',
              cursor: isActive && !element.locked ? 'move' : 'pointer'
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (!isDragging) {
                onSelectElement?.(layer.id, element.id);
              }
            }}
            onMouseDown={(e) => handleMouseDown(e, element)}
          >
            {/* 選中時顯示 XY 軸指示器 */}
            {isActive && <AxisIndicator />}
            {/* 根據元素類型和 showBackground 決定是否顯示底板 */}
            {isTextElement(element) && !element.showBackground ? (
              // 文字無底板模式
              <div className="w-full h-full overflow-hidden">
                {renderElementContent(element)}
              </div>
            ) : (
              // 有底板模式（預設）
              <div className="w-full h-full overflow-hidden rounded-md bg-white/5 backdrop-blur-[1px] border border-white/10 shadow-lg">
                {renderElementContent(element)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const Layer2DRenderer = memo(Layer2DRendererComponent);


