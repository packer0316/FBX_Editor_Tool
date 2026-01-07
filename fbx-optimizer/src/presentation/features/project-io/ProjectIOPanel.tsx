/**
 * 專案匯出/載入面板
 * 
 * 提供專案匯出和載入的 UI 介面，包含：
 * - 匯出選項勾選
 * - 匯出按鈕
 * - 載入按鈕
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Upload, Package, Film, Palette, Volume2, Sparkles, Loader2, Layers } from 'lucide-react';
import type { ThemeStyle } from '../../hooks/useTheme';
import { createDefaultExportOptions, type ExportOptions } from '../../../domain/value-objects/ProjectState';

// ============================================================================
// Props 介面
// ============================================================================

export interface ProjectIOPanelProps {
  /** 是否顯示面板 */
  isOpen: boolean;
  
  /** 關閉面板回調 */
  onClose: () => void;
  
  /** 匯出專案回調 */
  onExport: (options: ExportOptions, projectName: string) => Promise<boolean>;
  
  /** 載入專案回調 */
  onLoad: (file: File) => Promise<boolean>;
  
  /** 是否有模型可匯出（舊版相容，現在不使用） */
  hasModels?: boolean;
  
  /** 主題樣式 */
  theme: ThemeStyle;
  
  /** 是否正在處理 */
  isProcessing?: boolean;
  
  /** 處理進度 (0-100) */
  progress?: number;
  
  /** 處理訊息 */
  progressMessage?: string;
}

// ============================================================================
// 組件
// ============================================================================

export default function ProjectIOPanel({
  isOpen,
  onClose,
  onExport,
  onLoad,
  // hasModels is deprecated, now use include3DModels/include2D options
  theme,
  isProcessing = false,
  progress = 0,
  progressMessage = '',
}: ProjectIOPanelProps) {
  // 匯出選項狀態
  const [exportOptions, setExportOptions] = useState<ExportOptions>(createDefaultExportOptions());
  
  // 專案名稱
  const [projectName, setProjectName] = useState('MyProject');
  
  // 載入檔案 input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 依賴邏輯：當 3D 和 2D 都取消時，自動取消相關選項
  useEffect(() => {
    // 如果 3D 和 2D 都沒勾選，取消動作選項
    if (!exportOptions.include3DModels && !exportOptions.include2D) {
      if (exportOptions.includeAnimations) {
        setExportOptions(prev => ({ ...prev, includeAnimations: false }));
      }
    }
    // 如果 3D 沒勾選，取消 Shader 選項
    if (!exportOptions.include3DModels) {
      if (exportOptions.includeShader) {
        setExportOptions(prev => ({ ...prev, includeShader: false }));
      }
    }
  }, [exportOptions.include3DModels, exportOptions.include2D]);
  
  // 計算是否可以勾選動作選項（需要 3D 或 2D 至少一個）
  const canSelectAnimations = exportOptions.include3DModels || exportOptions.include2D;
  
  // 計算是否可以勾選 Shader 選項（需要 3D）
  const canSelectShader = exportOptions.include3DModels;
  
  // 計算是否可以匯出（至少要選一個 3D 或 2D）
  const canExport = exportOptions.include3DModels || exportOptions.include2D;

  // 如果面板未開啟，不渲染
  if (!isOpen) return null;

  // 處理匯出
  const handleExport = async () => {
    if (!canExport) {
      alert('請至少勾選 3D 模型或 2D 圖層');
      return;
    }
    
    if (!projectName.trim()) {
      alert('請輸入專案名稱');
      return;
    }

    const success = await onExport(exportOptions, projectName.trim());
    if (success) {
      onClose();
    }
  };

  // 處理載入
  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查副檔名
    if (!file.name.endsWith('.jr3d')) {
      alert('請選擇 .jr3d 專案檔案');
      return;
    }

    const success = await onLoad(file);
    if (success) {
      onClose();
    }

    // 重置 input
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 面板 */}
      <div className={`relative w-[400px] ${theme.panelBg} ${theme.panelBorder} border rounded-2xl shadow-2xl overflow-hidden`}>
        {/* 標題列 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.panelBorder}`}>
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-400" />
            <h2 className={`text-lg font-semibold ${theme.text}`}>專案匯出 / 載入</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className={`p-1.5 rounded-lg transition-colors ${theme.button} ${theme.itemHover} disabled:opacity-50`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容區 */}
        <div className="p-5 space-y-5">
          {/* 專案名稱 */}
          <div>
            <label className={`block text-sm font-medium ${theme.textSecondary} mb-2`}>
              專案名稱
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isProcessing}
              placeholder="輸入專案名稱..."
              className={`w-full px-3 py-2 rounded-lg ${theme.inputBg} ${theme.inputBorder} border ${theme.text} focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50`}
            />
          </div>

          {/* 匯出選項 */}
          <div>
            <label className={`block text-sm font-medium ${theme.textSecondary} mb-3`}>
              匯出選項
            </label>
            <div className="space-y-2">
              {/* 3D 模型 */}
              <label className={`flex items-center gap-3 p-3 rounded-lg ${theme.itemBg} ${theme.itemBorder} border cursor-pointer hover:bg-white/5 transition-colors`}>
                <input
                  type="checkbox"
                  checked={exportOptions.include3DModels}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    include3DModels: e.target.checked,
                  })}
                  disabled={isProcessing}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <Package className="w-4 h-4 text-blue-400" />
                <span className={theme.text}>3D 模型</span>
              </label>

              {/* 2D 圖層 */}
              <label className={`flex items-center gap-3 p-3 rounded-lg ${theme.itemBg} ${theme.itemBorder} border cursor-pointer hover:bg-white/5 transition-colors`}>
                <input
                  type="checkbox"
                  checked={exportOptions.include2D}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    include2D: e.target.checked,
                  })}
                  disabled={isProcessing}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className={theme.text}>2D 圖層（Spine、圖片、文字）</span>
              </label>

              {/* 動作 & 導演模式 */}
              <label className={`flex items-center gap-3 p-3 rounded-lg ${theme.itemBg} ${theme.itemBorder} border transition-colors ${
                canSelectAnimations 
                  ? 'cursor-pointer hover:bg-white/5' 
                  : 'opacity-50 cursor-not-allowed'
              }`}>
                <input
                  type="checkbox"
                  checked={exportOptions.includeAnimations}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    includeAnimations: e.target.checked,
                  })}
                  disabled={isProcessing || !canSelectAnimations}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <Film className="w-4 h-4 text-green-400" />
                <span className={theme.text}>動作 & 導演模式編排</span>
                {!canSelectAnimations && (
                  <span className="ml-auto text-xs text-gray-500">需勾選 3D 或 2D</span>
                )}
              </label>

              {/* Shader */}
              <label className={`flex items-center gap-3 p-3 rounded-lg ${theme.itemBg} ${theme.itemBorder} border transition-colors ${
                canSelectShader 
                  ? 'cursor-pointer hover:bg-white/5' 
                  : 'opacity-50 cursor-not-allowed'
              }`}>
                <input
                  type="checkbox"
                  checked={exportOptions.includeShader}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    includeShader: e.target.checked,
                  })}
                  disabled={isProcessing || !canSelectShader}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <Palette className="w-4 h-4 text-purple-400" />
                <span className={theme.text}>Shader 配置</span>
                {!canSelectShader && (
                  <span className="ml-auto text-xs text-gray-500">需勾選 3D</span>
                )}
              </label>
            </div>
          </div>

          {/* 未實作功能 */}
          <div>
            <label className={`block text-sm font-medium text-gray-500 mb-3`}>
              未實作功能
            </label>
            <div className="space-y-2 opacity-50">
              {/* Audio */}
              <label className={`flex items-center gap-3 p-3 rounded-lg ${theme.itemBg} ${theme.itemBorder} border cursor-not-allowed`}>
                <input
                  type="checkbox"
                  checked={false}
                  disabled={true}
                  className="w-4 h-4 rounded"
                />
                <Volume2 className="w-4 h-4 text-yellow-400" />
                <span className="text-gray-500">Audio</span>
                <span className="ml-auto text-xs text-gray-600">未實作</span>
              </label>

              {/* Effekseer */}
              <label className={`flex items-center gap-3 p-3 rounded-lg ${theme.itemBg} ${theme.itemBorder} border cursor-not-allowed`}>
                <input
                  type="checkbox"
                  checked={false}
                  disabled={true}
                  className="w-4 h-4 rounded"
                />
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-gray-500">Effekseer</span>
                <span className="ml-auto text-xs text-gray-600">未實作</span>
              </label>
            </div>
          </div>

          {/* 進度條 */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className={theme.textSecondary}>{progressMessage}</span>
                <span className={theme.text}>{Math.round(progress)}%</span>
              </div>
              <div className={`h-2 rounded-full ${theme.itemBg} overflow-hidden`}>
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 按鈕區 */}
        <div className={`flex gap-3 px-5 py-4 border-t ${theme.panelBorder}`}>
          <button
            onClick={handleExport}
            disabled={isProcessing || !canExport}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
              ${canExport && !isProcessing
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            匯出專案
          </button>
          
          <button
            onClick={handleLoadClick}
            disabled={isProcessing}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
              ${!isProcessing
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            載入專案
          </button>
        </div>

        {/* 隱藏的檔案輸入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jr3d"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

