import React, { memo, useMemo, useRef, useCallback, useEffect, useState } from 'react';
import type { Element2D, SpineElement2D } from '../../../../domain/value-objects/Element2D';
import { isImageElement, isShapeElement, isTextElement, isSpineElement } from '../../../../domain/value-objects/Element2D';
import type { Layer } from '../../../../domain/value-objects/Layer';
import { SpineElement } from './SpineElement';

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

  // Spine 元素不在這裡渲染，而是在 Layer2DRendererComponent 中單獨處理
  if (isSpineElement(element)) {
    return null;
  }

  return (
    <div
      className="w-full h-full text-xs"
      dangerouslySetInnerHTML={{ __html: (element as any).html ?? '' }}
    />
  );
};

/** Resize Handle 類型 */
type ResizeHandleType = 'right' | 'bottom' | 'corner';

/** Resize 手柄組件 */
const ResizeHandle: React.FC<{
  type: ResizeHandleType;
  onResizeStart: (type: ResizeHandleType, e: React.MouseEvent) => void;
}> = ({ type, onResizeStart }) => {
  const handleStyles: Record<ResizeHandleType, React.CSSProperties> = {
    right: {
      position: 'absolute',
      right: -4,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 8,
      height: 40,
      cursor: 'ew-resize',
    },
    bottom: {
      position: 'absolute',
      bottom: -4,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 40,
      height: 8,
      cursor: 'ns-resize',
    },
    corner: {
      position: 'absolute',
      right: -6,
      bottom: -6,
      width: 12,
      height: 12,
      cursor: 'nwse-resize',
    },
  };

  return (
    <div
      style={handleStyles[type]}
      className={`
        bg-purple-500/80 rounded-sm z-50
        hover:bg-purple-400 transition-colors
        ${type === 'corner' ? 'rounded-full' : ''}
      `}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onResizeStart(type, e);
      }}
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
  
  const [resizing, setResizing] = useState<{
    elementId: string;
    type: ResizeHandleType;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    aspectRatio: number;
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
    setResizing(null);
  }, []);

  // Resize 開始
  const handleResizeStart = useCallback((elementId: string, type: ResizeHandleType, e: React.MouseEvent) => {
    const element = layer.children.find(el => el.id === elementId);
    if (!element || element.locked || !onUpdateElement) return;

    setResizing({
      elementId,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: element.size.width,
      startHeight: element.size.height,
      aspectRatio: element.size.width / element.size.height,
    });
  }, [layer.children, onUpdateElement]);

  // Resize 移動
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing || !containerRef.current || !onUpdateElement) return;

    const element = layer.children.find(el => el.id === resizing.elementId);
    if (!element) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - resizing.startX;
    const deltaY = e.clientY - resizing.startY;

    let newWidth = resizing.startWidth;
    let newHeight = resizing.startHeight;

    if (element.size.unit === 'percent') {
      const deltaWidthPercent = (deltaX / containerRect.width) * 100;
      const deltaHeightPercent = (deltaY / containerRect.height) * 100;

      if (resizing.type === 'right') {
        newWidth = Math.max(5, resizing.startWidth + deltaWidthPercent);
      } else if (resizing.type === 'bottom') {
        newHeight = Math.max(5, resizing.startHeight + deltaHeightPercent);
      } else if (resizing.type === 'corner') {
        // 等比縮放：以寬度變化為基準
        newWidth = Math.max(5, resizing.startWidth + deltaWidthPercent);
        newHeight = newWidth / resizing.aspectRatio;
      }
    } else {
      if (resizing.type === 'right') {
        newWidth = Math.max(20, resizing.startWidth + deltaX);
      } else if (resizing.type === 'bottom') {
        newHeight = Math.max(20, resizing.startHeight + deltaY);
      } else if (resizing.type === 'corner') {
        // 等比縮放：以對角線方向為基準
        const avgDelta = (deltaX + deltaY) / 2;
        newWidth = Math.max(20, resizing.startWidth + avgDelta);
        newHeight = newWidth / resizing.aspectRatio;
      }
    }

    onUpdateElement(layer.id, element.id, {
      size: {
        ...element.size,
        width: Math.round(newWidth * 100) / 100,
        height: Math.round(newHeight * 100) / 100,
      }
    });
  }, [resizing, layer.id, layer.children, onUpdateElement]);

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

  // Resize 的全域監聽
  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, handleResizeMove, handleMouseUp]);

  if (layer.type !== '2d' || !layer.visible || visibleElements.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      data-layer-id={layer.id}
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

        // Spine 元素特殊渲染
        if (isSpineElement(element)) {
          const containerRect = containerRef.current?.getBoundingClientRect();
          const isResizing = resizing?.elementId === element.id;
          return (
            <div
              key={element.id}
              className={`absolute ${element.locked ? '' : 'cursor-pointer'} ${isDragging || isResizing ? '' : 'transition-all duration-150'}`}
              style={{
                ...style,
                outline: isActive ? '2px solid rgba(168, 85, 247, 0.8)' : 'none',
                outlineOffset: '2px',
                cursor: element.locked ? 'default' : (isActive ? 'move' : 'pointer'),
                pointerEvents: element.locked ? 'none' : 'auto'
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (!isDragging && !isResizing && !element.locked) {
                  onSelectElement?.(layer.id, element.id);
                }
              }}
              onMouseDown={(e) => handleMouseDown(e, element)}
            >
              {isActive && <AxisIndicator />}
              <SpineElement
                element={element as SpineElement2D}
                isActive={isActive}
                containerWidth={containerRect?.width ?? 800}
                containerHeight={containerRect?.height ?? 600}
                onClick={() => onSelectElement?.(layer.id, element.id)}
                onUpdate={(updates) => onUpdateElement?.(layer.id, element.id, updates)}
              />
              {/* Resize 手柄 */}
              {isActive && !element.locked && (
                <>
                  <ResizeHandle type="right" onResizeStart={(type, e) => handleResizeStart(element.id, type, e)} />
                  <ResizeHandle type="bottom" onResizeStart={(type, e) => handleResizeStart(element.id, type, e)} />
                  <ResizeHandle type="corner" onResizeStart={(type, e) => handleResizeStart(element.id, type, e)} />
                </>
              )}
            </div>
          );
        }

        const isResizing = resizing?.elementId === element.id;
        return (
          <div
            key={element.id}
            role="button"
            tabIndex={element.locked ? -1 : 0}
            className={`absolute ${element.locked ? '' : 'cursor-pointer'} ${isDragging || isResizing ? '' : 'transition-all duration-150'}`}
            style={{
              ...style,
              outline: isActive ? '2px solid rgba(96, 165, 250, 0.8)' : 'none',
              outlineOffset: '2px',
              cursor: element.locked ? 'default' : (isActive ? 'move' : 'pointer'),
              pointerEvents: element.locked ? 'none' : 'auto'
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (!isDragging && !isResizing && !element.locked) {
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
            {/* Resize 手柄 */}
            {isActive && !element.locked && (
              <>
                <ResizeHandle type="right" onResizeStart={(type, e) => handleResizeStart(element.id, type, e)} />
                <ResizeHandle type="bottom" onResizeStart={(type, e) => handleResizeStart(element.id, type, e)} />
                <ResizeHandle type="corner" onResizeStart={(type, e) => handleResizeStart(element.id, type, e)} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const Layer2DRenderer = memo(Layer2DRendererComponent);


