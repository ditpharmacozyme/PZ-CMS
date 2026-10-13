import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBFBFA] text-[#1b1c1a] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-[#E9E9E7] rounded-xl shadow-lg p-6 space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <span className="material-symbols-outlined text-2xl">error</span>
            </div>
            <div>
              <h1 className="font-display-xl text-xl font-bold text-[#1b1c1a]">Something went wrong</h1>
              <p className="font-body-md text-sm text-[#5F5F5B] mt-1">
                The application encountered an unexpected runtime error.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="text-left bg-[#F4F4F3] border border-[#E9E9E7] rounded-lg p-3 text-xs font-mono text-[#57574F] overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm cursor-pointer"
              >
                Reload Studio
              </button>
              <button
                onClick={this.handleResetCache}
                className="flex-1 bg-[#F1F1F0] hover:bg-[#E9E9E7] text-[#1b1c1a] font-medium py-2.5 px-4 rounded-lg transition-colors text-sm cursor-pointer"
              >
                Clear Cache & Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
