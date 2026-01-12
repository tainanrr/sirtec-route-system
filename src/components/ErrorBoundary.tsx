import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Erro capturado:", error);
    console.error("[ErrorBoundary] ErrorInfo:", errorInfo);
    console.error("[ErrorBoundary] Stack:", error.stack);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          backgroundColor: "#f9fafb",
          fontFamily: "system-ui, sans-serif"
        }}>
          <div style={{
            maxWidth: "600px",
            width: "100%",
            textAlign: "center"
          }}>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px", color: "#111827" }}>
              Algo deu errado
            </h1>
            <p style={{ color: "#6b7280", marginBottom: "24px" }}>
              Ocorreu um erro inesperado. Por favor, tente recarregar a página.
            </p>
            {this.state.error && (
              <details style={{
                textAlign: "left",
                backgroundColor: "#f3f4f6",
                padding: "16px",
                borderRadius: "8px",
                marginBottom: "24px"
              }}>
                <summary style={{ cursor: "pointer", fontWeight: "500", marginBottom: "8px" }}>
                  Detalhes do erro
                </summary>
                <pre style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  overflow: "auto",
                  whiteSpace: "pre-wrap"
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && `\n\n${this.state.errorInfo.componentStack}`}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              style={{
                width: "100%",
                padding: "12px 24px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "500",
                cursor: "pointer"
              }}
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
