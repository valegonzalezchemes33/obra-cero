"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary${this.props.name ? ` ${this.props.name}` : ""}]:`, error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="inline-flex h-10 w-10 rounded-full bg-destructive/10 items-center justify-center mb-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Error en {this.props.name || "esta sección"}</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            Ocurrió un error inesperado. Puede deberse a un problema de conexión o datos.
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
