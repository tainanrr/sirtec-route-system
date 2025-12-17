import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Garantir que o tema claro seja aplicado inicialmente
try {
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("dark");
    // Garantir que o body tenha as classes necessárias
    document.body.classList.add("bg-background", "text-foreground");
  }
} catch (error) {
  console.warn("Erro ao aplicar tema inicial:", error);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  console.error("Erro ao renderizar aplicação:", error);
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif;">
      <h1>Erro ao carregar aplicação</h1>
      <p>${error instanceof Error ? error.message : String(error)}</p>
      <button onclick="window.location.reload()">Recarregar</button>
    </div>
  `;
}
