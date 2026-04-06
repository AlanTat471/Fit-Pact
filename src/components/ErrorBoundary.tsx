import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
          <p className="text-destructive font-medium mb-2">Something went wrong</p>
          <p className="text-muted-foreground text-sm mb-4 text-center max-w-md">
            {this.state.error?.message}
          </p>
          <Button
            variant="outline"
            onClick={() => window.location.replace("/dashboard")}
          >
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
