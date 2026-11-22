import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught marketplace error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  public render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string };
        if (parsed?.error) {
          friendly = parsed.error;
        }
      } catch {
        // Keep original message
      }

      return (
        <div className="min-h-screen bg-[#F3F3EE] text-[#112419] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-black/10 rounded-2xl p-8">
            <p className="text-xs font-semibold tracking-wide text-[#538063] mb-2">
              CampusTrade UTM
            </p>
            <h1 className="text-2xl font-bold tracking-tight mb-3">
              Something interrupted your session
            </h1>
            <p className="text-sm text-[#4A5D50] leading-relaxed mb-6 break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="px-5 py-2.5 rounded-lg bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0D5938] transition-colors cursor-pointer"
            >
              Return to Marketplace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
