import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    console.error('Uncaught error in React ErrorBoundary:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Ops! Ocorreu uma instabilidade</h2>
            <p className="text-xs text-slate-400 mb-6">
              A interface encontrou um dado inesperado e foi protegida pelo Error Boundary. Seus dados continuam 100% seguros no banco.
            </p>
            {this.state.error && (
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-left mb-6 overflow-x-auto">
                <p className="text-[11px] font-mono text-rose-400">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm shadow-lg shadow-sky-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recarregar Sistema</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
