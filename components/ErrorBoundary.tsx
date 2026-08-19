"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HOME_ROUTE } from "@/lib/navigation";

interface Props {
  children?: ReactNode;
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
    console.error("Uncaught rendering error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "24px", maxWidth: "600px", margin: "40px auto" }}>
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              {this.state.error?.message || "An unexpected rendering error has occurred in this view."}
            </AlertDescription>
          </Alert>
          <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
            <Button onClick={() => this.setState({ hasError: false, error: null })}>
              Try Again
            </Button>
            <Button as="a" href={HOME_ROUTE} variant="secondary">
              Go Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
