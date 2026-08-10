"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { MessageBar, MessageBarBody, MessageBarTitle, Button } from "@fluentui/react-components";

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
        <div style={{ padding: "24px", maxWidth: "600px", margin: "40px auto", fontFamily: "Segoe UI, sans-serif" }}>
          <MessageBar intent="error">
            <MessageBarBody>
              <MessageBarTitle>Something went wrong</MessageBarTitle>
              {this.state.error?.message || "An unexpected rendering error has occurred in this view."}
            </MessageBarBody>
          </MessageBar>
          <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
            <Button appearance="primary" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
            <Button onClick={() => this.setState({ hasError: false, error: null })}>
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
