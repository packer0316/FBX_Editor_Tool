import { useState } from 'react';
import { Moon, Sun, Zap, Terminal, Sunset, Snowflake, Ghost } from 'lucide-react';

export type ThemeMode = 'dark' | 'light' | 'cyberpunk' | 'matrix' | 'synthwave' | 'nord' | 'dracula';

export interface ThemeStyle {
  bg: string;
  text: string;
  toolbarBg: string;
  toolbarBorder: string;
  panelBg: string;
  panelBorder: string;
  button: string;
  activeButton: string;
  sceneBg: string;
  gridColor: string;
  gridCellColor: string;
}

export interface ThemeOption {
  id: ThemeMode;
  name: string;
  icon: typeof Moon;
  color: string;
}

const themeStyles: Record<ThemeMode, ThemeStyle> = {
  dark: {
    bg: 'bg-gray-900',
    text: 'text-white',
    toolbarBg: 'bg-gray-900',
    toolbarBorder: 'border-gray-700',
    panelBg: 'bg-gray-800',
    panelBorder: 'border-gray-700',
    button: 'text-gray-400 hover:bg-gray-800 hover:text-white',
    activeButton: 'bg-blue-600 text-white',
    sceneBg: '#111827',
    gridColor: '#4a4a4a',
    gridCellColor: '#2a2a2a'
  },
  light: {
    bg: 'bg-gray-900',
    text: 'text-white',
    toolbarBg: 'bg-gray-900',
    toolbarBorder: 'border-gray-700',
    panelBg: 'bg-gray-800',
    panelBorder: 'border-gray-700',
    button: 'text-gray-400 hover:bg-gray-800 hover:text-white',
    activeButton: 'bg-blue-600 text-white',
    sceneBg: '#f0f0f0',
    gridColor: '#cccccc',
    gridCellColor: '#e5e5e5'
  },
  cyberpunk: {
    bg: 'bg-[#050510]',
    text: 'text-[#00f3ff]',
    toolbarBg: 'bg-[#0a0a1a]',
    toolbarBorder: 'border-[#ff00ff]/30',
    panelBg: 'bg-[#0a0a1a]/90',
    panelBorder: 'border-[#00f3ff]/30',
    button: 'text-[#ff00ff] hover:text-[#00f3ff] hover:shadow-[0_0_10px_#00f3ff] transition-all duration-300',
    activeButton: 'bg-[#ff00ff]/20 text-[#00f3ff] shadow-[0_0_15px_#ff00ff]',
    sceneBg: '#020205',
    gridColor: '#ff00ff',
    gridCellColor: '#00f3ff'
  },
  matrix: {
    bg: 'bg-black',
    text: 'text-[#00ff41]',
    toolbarBg: 'bg-[#0d0d0d]',
    toolbarBorder: 'border-[#008f11]',
    panelBg: 'bg-[#0d0d0d]/90',
    panelBorder: 'border-[#008f11]',
    button: 'text-[#008f11] hover:text-[#00ff41] hover:bg-[#003b00]',
    activeButton: 'bg-[#003b00] text-[#00ff41] shadow-[0_0_10px_#00ff41]',
    sceneBg: '#000000',
    gridColor: '#003b00',
    gridCellColor: '#008f11'
  },
  synthwave: {
    bg: 'bg-[#2b003b]',
    text: 'text-[#ff9e00]',
    toolbarBg: 'bg-[#240030]',
    toolbarBorder: 'border-[#ff0090]',
    panelBg: 'bg-[#240030]/90',
    panelBorder: 'border-[#ff0090]',
    button: 'text-[#ff0090] hover:text-[#00f3ff] hover:bg-[#ff0090]/20',
    activeButton: 'bg-[#ff0090]/30 text-[#ff9e00] shadow-[0_0_15px_#ff0090]',
    sceneBg: '#1a0024',
    gridColor: '#ff0090',
    gridCellColor: '#570a57'
  },
  nord: {
    bg: 'bg-[#2e3440]',
    text: 'text-[#eceff4]',
    toolbarBg: 'bg-[#3b4252]',
    toolbarBorder: 'border-[#88c0d0]',
    panelBg: 'bg-[#3b4252]/95',
    panelBorder: 'border-[#81a1c1]',
    button: 'text-[#d8dee9] hover:text-[#88c0d0] hover:bg-[#4c566a]',
    activeButton: 'bg-[#88c0d0]/20 text-[#88c0d0] border border-[#88c0d0]',
    sceneBg: '#2e3440',
    gridColor: '#4c566a',
    gridCellColor: '#434c5e'
  },
  dracula: {
    bg: 'bg-[#282a36]',
    text: 'text-[#f8f8f2]',
    toolbarBg: 'bg-[#44475a]',
    toolbarBorder: 'border-[#bd93f9]',
    panelBg: 'bg-[#44475a]/95',
    panelBorder: 'border-[#ff79c6]',
    button: 'text-[#bd93f9] hover:text-[#ff79c6] hover:bg-[#6272a4]',
    activeButton: 'bg-[#bd93f9]/20 text-[#50fa7b] border border-[#bd93f9]',
    sceneBg: '#282a36',
    gridColor: '#6272a4',
    gridCellColor: '#44475a'
  }
};

export const themeOptions: ThemeOption[] = [
  { id: 'dark', name: '深色', icon: Moon, color: '#111827' },
  { id: 'light', name: '亮色', icon: Sun, color: '#f0f0f0' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: Zap, color: '#050510' },
  { id: 'matrix', name: 'Matrix', icon: Terminal, color: '#000000' },
  { id: 'synthwave', name: 'Synthwave', icon: Sunset, color: '#2b003b' },
  { id: 'nord', name: 'Nord', icon: Snowflake, color: '#2e3440' },
  { id: 'dracula', name: 'Dracula', icon: Ghost, color: '#282a36' },
];

/**
 * 主題管理 Hook
 * 
 * 提供應用程式主題切換功能，支援多種預設主題（深色、亮色、Cyberpunk、Matrix 等）。
 * 此 Hook 管理當前主題狀態，並提供對應的樣式類別和選項。
 * 
 * @param initialTheme - 初始主題模式，預設為 'dark'
 * @returns 包含主題模式、設定函數、當前主題樣式和主題選項的物件
 * 
 * @example
 * ```typescript
 * const { themeMode, setThemeMode, currentTheme, themeOptions } = useTheme('dark');
 * 
 * return (
 *   <div className={currentTheme.bg}>
 *     <button onClick={() => setThemeMode('cyberpunk')}>
 *       切換主題
 *     </button>
 *   </div>
 * );
 * ```
 */
export function useTheme(initialTheme: ThemeMode = 'dark') {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme);
  const currentTheme = themeStyles[themeMode];

  return {
    themeMode,
    setThemeMode,
    currentTheme,
    themeOptions,
  };
}

