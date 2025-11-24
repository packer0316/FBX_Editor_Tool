import { useState } from 'react';

/**
 * 檔案拖放 Hook
 * 
 * 提供檔案拖放功能的 UI 狀態管理。此 Hook 處理拖曳進入、離開和放下事件，
 * 並提供視覺反饋狀態（isFileDragging）。
 * 
 * @param onDrop - 當檔案被放下時的回調函數，接收 FileList 作為參數
 * @returns 包含拖曳狀態和事件處理函數的物件
 * 
 * @example
 * ```typescript
 * const handleFileDrop = (files: FileList) => {
 *   console.log('收到', files.length, '個檔案');
 * };
 * 
 * const { isFileDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(handleFileDrop);
 * 
 * return (
 *   <div
 *     onDragOver={handleDragOver}
 *     onDragLeave={handleDragLeave}
 *     onDrop={handleDrop}
 *     className={isFileDragging ? 'dragging' : ''}
 *   >
 *     拖放檔案到這裡
 *   </div>
 * );
 * ```
 */
export function useFileDrop(onDrop: (files: FileList) => void) {
  const [isFileDragging, setIsFileDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files);
    }
  };

  return {
    isFileDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}

