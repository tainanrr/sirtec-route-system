import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[main.tsx] Iniciando aplicação...");

// Garantir que o tema claro seja aplicado inicialmente
try {
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("dark");
    // Garantir que o body tenha as classes necessárias
    document.body.classList.add("bg-background", "text-foreground");
    console.log("[main.tsx] Tema aplicado com sucesso");
  }
} catch (error) {
  console.warn("[main.tsx] Erro ao aplicar tema inicial:", error);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  const error = new Error("Root element not found");
  console.error("[main.tsx] ERRO CRÍTICO:", error);
  throw error;
}

console.log("[main.tsx] Root element encontrado, renderizando App...");

try {
  const root = createRoot(rootElement);
  console.log("[main.tsx] React root criado, renderizando...");
  
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  console.log("[main.tsx] App renderizado com sucesso!");
} catch (error) {
  console.error("[main.tsx] ERRO ao renderizar aplicação:", error);
  console.error("[main.tsx] Stack trace:", error instanceof Error ? error.stack : "N/A");
  
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; background: white; color: black;">
        <h1>Erro ao carregar aplicação</h1>
        <p><strong>Erro:</strong> ${error instanceof Error ? error.message : String(error)}</p>
        ${error instanceof Error && error.stack ? `<pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${error.stack}</pre>` : ''}
        <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 10px; cursor: pointer;">Recarregar</button>
      </div>
    `;
  }
}
