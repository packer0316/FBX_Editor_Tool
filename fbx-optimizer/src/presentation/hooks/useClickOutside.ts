import { useEffect, RefObject } from 'react';

/**
 * 點擊外部關閉 Hook
 * 
 * 監聽點擊事件，當點擊發生在指定元素外部時執行回調函數。
 * 此 Hook 通常用於實現下拉選單、彈出視窗等 UI 元件的自動關閉功能。
 * 
 * @param refs - React Ref 陣列，指定要監聽的元素。點擊這些元素外部時會觸發回調
 * @param callback - 當點擊外部時執行的回調函數
 * @param isEnabled - 是否啟用監聽，預設為 true。設為 false 時不會註冊事件監聽器
 * 
 * @example
 * ```typescript
 * const menuRef = useRef<HTMLDivElement>(null);
 * const [isOpen, setIsOpen] = useState(false);
 * 
 * useClickOutside([menuRef], () => setIsOpen(false), isOpen);
 * 
 * return (
 *   <div ref={menuRef}>
 *     {isOpen && <Menu />}
 *   </div>
 * );
 * ```
 */
export function useClickOutside(
  refs: RefObject<HTMLElement>[],
  callback: () => void,
  isEnabled: boolean = true
) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      const isOutside = refs.every(
        (ref) => ref.current && !ref.current.contains(event.target as Node)
      );

      if (isOutside) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [refs, callback, isEnabled]);
}

