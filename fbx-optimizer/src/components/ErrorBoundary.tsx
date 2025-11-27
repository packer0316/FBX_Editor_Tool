import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary 捕獲到錯誤:', error, errorInfo);
    this.setState({ errorInfo });
    
    // 如果是 DOM 操作錯誤，記錄更多信息
    if (error.message.includes('insertBefore') || error.message.includes('NotFoundError')) {
      console.error('DOM 操作錯誤 - 這可能是由於組件在渲染過程中意外卸載導致的');
      console.error('錯誤堆疊:', error.stack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white p-8">
          <div className="max-w-2xl w-full bg-gray-800 rounded-lg p-6 border border-red-500">
            <h2 className="text-2xl font-bold text-red-400 mb-4">發生錯誤</h2>
            <p className="text-gray-300 mb-4">
              {this.state.error?.message || '未知錯誤'}
            </p>
            {this.state.error?.stack && (
              <details className="mb-4">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-200 mb-2">
                  錯誤詳情
                </summary>
                <pre className="bg-gray-900 p-4 rounded text-xs overflow-auto max-h-64 text-gray-400">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-4">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                重試
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                重新載入頁面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

