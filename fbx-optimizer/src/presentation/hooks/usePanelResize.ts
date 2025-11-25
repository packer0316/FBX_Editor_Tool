import { useState, useEffect } from 'react';

/**
 * 面板高度調整 Hook
 * 
 * 提供面板垂直拖曳調整高度的功能。此 Hook 管理拖曳狀態和面板高度，
 * 並自動處理滑鼠事件監聽和清理。
 * 
 * @param initialHeight - 初始面板高度（像素），預設為 384
 * @param minHeight - 最小允許高度（像素），預設為 200
 * @param maxHeight - 最大允許高度（像素），預設為視窗高度減 100
 * @returns 包含面板高度、拖曳狀態和滑鼠按下處理函數的物件
 * 
 * @example
 * ```typescript
 * const { panelHeight, isDragging, handleMouseDown } = usePanelResize(400, 200, 800);
 * 
 * return (
 *   <div style={{ height: panelHeight }}>
 *     <div onMouseDown={handleMouseDown} className="resize-handle" />
 *   </div>
 * );
 * ```
 */
export function usePanelResize(
  initialHeight: number = 384,
  minHeight: number = 200,
  maxHeight: number = window.innerHeight - 100
) {
  const [panelHeight, setPanelHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newHeight = window.innerHeight - e.clientY;
      // 限制最小和最大高度
      const clampedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
      setPanelHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minHeight, maxHeight]);

  return { panelHeight, isDragging, handleMouseDown };
}

/**
 * 右側面板寬度調整 Hook
 * 
 * 提供右側面板水平拖曳調整寬度的功能。此 Hook 管理拖曳狀態和面板寬度，
 * 並自動處理滑鼠事件監聽和清理。
 * 
 * @param initialWidth - 初始面板寬度（像素），預設為 350
 * @param minWidth - 最小允許寬度（像素），預設為 350
 * @param maxWidth - 最大允許寬度（像素），預設為 600
 * @returns 包含面板寬度、拖曳狀態和滑鼠按下處理函數的物件
 * 
 * @example
 * ```typescript
 * const { rightPanelWidth, isResizingRight, handleRightPanelMouseDown } = useRightPanelResize(350, 350, 600);
 * 
 * return (
 *   <div style={{ width: rightPanelWidth }}>
 *     <div onMouseDown={handleRightPanelMouseDown} className="resize-handle" />
 *   </div>
 * );
 * ```
 */
export function useRightPanelResize(
  initialWidth: number = 350,
  minWidth: number = 350,
  maxWidth: number = 600
) {
  const [rightPanelWidth, setRightPanelWidth] = useState(initialWidth);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  };

  // 響應式調整：監聽視窗大小變化
  useEffect(() => {
    const handleResize = () => {
      const availableWidth = window.innerWidth - 64; // 64px 為左側工具列和間距
      const responsiveMaxWidth = Math.min(maxWidth, availableWidth);
      
      // 如果當前寬度超過可用寬度，自動調整
      if (rightPanelWidth > responsiveMaxWidth) {
        setRightPanelWidth(Math.max(minWidth, responsiveMaxWidth));
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // 初始檢查

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [rightPanelWidth, minWidth, maxWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRight) return;

      const newWidth = window.innerWidth - e.clientX;
      const availableWidth = window.innerWidth - 64;
      const responsiveMaxWidth = Math.min(maxWidth, availableWidth);
      // 限制最小和最大寬度
      const clampedWidth = Math.max(minWidth, Math.min(newWidth, responsiveMaxWidth));
      setRightPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
    };

    if (isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingRight, minWidth, maxWidth]);

  return { rightPanelWidth, isResizingRight, handleRightPanelMouseDown };
}

