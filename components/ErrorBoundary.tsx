import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * 全局错误边界组件
 * 捕获子组件树中的 JavaScript 错误，防止整个应用崩溃白屏
 */
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });
        // 可以在这里添加错误日志上报
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black flex items-center justify-center p-4">
                    <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
                        {/* 错误图标 */}
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                            <svg
                                className="w-8 h-8 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>

                        {/* 错误标题 */}
                        <h1 className="text-xl font-bold text-white mb-2">
                            应用出现错误
                        </h1>

                        {/* 错误描述 */}
                        <p className="text-zinc-400 mb-6">
                            很抱歉，应用遇到了一个问题。请尝试刷新页面或联系技术支持。
                        </p>

                        {/* 错误详情（开发模式） */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="mb-6 p-4 bg-zinc-950 border border-zinc-800 rounded text-left overflow-auto max-h-32">
                                <p className="text-red-400 font-mono text-sm break-all">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        {/* 重试按钮 */}
                        <button
                            onClick={this.handleRetry}
                            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors"
                        >
                            刷新页面
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
